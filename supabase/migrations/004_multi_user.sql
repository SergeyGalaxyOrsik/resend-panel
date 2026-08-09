-- Multi-user support: roles, mailboxes, and per-mailbox scoping of mail.

-- Users: role, activation, forced password change
alter table users add column if not exists role text not null default 'member';
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists must_change_password boolean not null default false;

do $$
begin
  alter table users add constraint users_role_check check (role in ('owner', 'member'));
exception
  when duplicate_object then null;
end
$$;

-- The existing installation is single-user: the workspace owner becomes role 'owner'.
update users u
set role = 'owner'
where u.role <> 'owner'
  and exists (select 1 from workspaces w where w.owner_user_id = u.id);

-- Fallback for installations whose workspace row is missing: promote the earliest account.
update users
set role = 'owner'
where id = (select id from users order by created_at asc limit 1)
  and not exists (select 1 from users where role = 'owner');

-- Mailboxes
create table if not exists mailboxes (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  address text not null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists idx_mailboxes_workspace_address on mailboxes(workspace_id, lower(address));
create index if not exists idx_mailboxes_workspace_id on mailboxes(workspace_id);

create table if not exists mailbox_users (
  mailbox_id text not null references mailboxes(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mailbox_id, user_id)
);

create index if not exists idx_mailbox_users_user_id on mailbox_users(user_id);

-- Mail is attached to the mailbox it arrived at / was sent from.
-- Deleting a mailbox keeps the mail and nulls the link, which makes it owner-only.
alter table threads add column if not exists mailbox_id text references mailboxes(id) on delete set null;
alter table messages add column if not exists mailbox_id text references mailboxes(id) on delete set null;
alter table drafts add column if not exists user_id text references users(id) on delete cascade;

create index if not exists idx_threads_mailbox_id on threads(mailbox_id);
create index if not exists idx_messages_mailbox_id on messages(mailbox_id);
create index if not exists idx_drafts_user_id on drafts(user_id);

-- Seed mailboxes from the single-user Resend settings so nothing changes for an existing install.
insert into mailboxes (id, workspace_id, address, display_name, created_at)
select
  'mbx_' || gen_random_uuid(),
  s.workspace_id,
  lower(trim(s.from_email)),
  coalesce(nullif(trim(s.from_name), ''), ''),
  now()
from resend_settings s
where trim(coalesce(s.from_email, '')) <> ''
  and not exists (
    select 1 from mailboxes m
    where m.workspace_id = s.workspace_id
      and lower(m.address) = lower(trim(s.from_email))
  );

insert into mailboxes (id, workspace_id, address, display_name, created_at)
select
  'mbx_' || gen_random_uuid(),
  s.workspace_id,
  lower(trim(s.inbound_email)),
  coalesce(nullif(trim(s.from_name), ''), ''),
  now()
from resend_settings s
where trim(coalesce(s.inbound_email, '')) <> ''
  and not exists (
    select 1 from mailboxes m
    where m.workspace_id = s.workspace_id
      and lower(m.address) = lower(trim(s.inbound_email))
  );

-- Every seeded mailbox belongs to the owner.
insert into mailbox_users (mailbox_id, user_id, created_at)
select m.id, w.owner_user_id, now()
from mailboxes m
join workspaces w on w.id = m.workspace_id
on conflict do nothing;

-- Backfill existing mail: outbound by sender address, inbound by recipient address.
update messages msg
set mailbox_id = m.id
from mailboxes m
where msg.mailbox_id is null
  and m.workspace_id = msg.workspace_id
  and msg.direction = 'outbound'
  and lower(trim(msg.from_email)) = lower(m.address);

update messages msg
set mailbox_id = m.id
from mailboxes m
where msg.mailbox_id is null
  and m.workspace_id = msg.workspace_id
  and msg.direction = 'inbound'
  and exists (
    select 1
    from unnest(msg."to") as recipient
    where lower(trim(recipient)) = lower(m.address)
       or lower(recipient) like '%<' || lower(m.address) || '>%'
  );

-- A thread takes the mailbox of its earliest linked message.
update threads t
set mailbox_id = earliest.mailbox_id
from (
  select distinct on (m.thread_id) m.thread_id, m.mailbox_id
  from messages m
  where m.mailbox_id is not null
    and m.thread_id <> ''
  order by m.thread_id, m.created_at asc
) as earliest
where t.mailbox_id is null
  and t.id = earliest.thread_id;

-- Existing drafts belong to the owner.
update drafts d
set user_id = w.owner_user_id
from workspaces w
where d.user_id is null
  and w.id = d.workspace_id;

-- RLS (defense in depth; server uses service role)
alter table mailboxes enable row level security;
alter table mailbox_users enable row level security;
