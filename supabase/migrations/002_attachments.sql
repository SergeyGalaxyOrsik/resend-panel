-- Attachments
create table if not exists attachments (
  id text primary key,
  message_id text not null references messages(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  filename text not null,
  content_type text not null default '',
  size integer not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_message_id on attachments(message_id);
create index if not exists idx_attachments_workspace_id on attachments(workspace_id);

alter table attachments enable row level security;

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
