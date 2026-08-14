-- Audit log: who changed what, kept apart from message_events so mail activity
-- and administrative activity never dilute each other.

create table if not exists audit_log (
  id text primary key,
  workspace_id text references workspaces(id) on delete cascade,
  -- Nullable on purpose: the actor may be gone (deleted account) or absent
  -- (a failed sign-in has no session yet). actor_email keeps the record readable.
  actor_user_id text references users(id) on delete set null,
  actor_email text not null default '',
  action text not null,
  target text not null default '',
  metadata jsonb not null default '{}',
  ip text not null default '',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created_at on audit_log(created_at desc);
create index if not exists idx_audit_log_workspace_id on audit_log(workspace_id, created_at desc);
create index if not exists idx_audit_log_action on audit_log(action);

alter table audit_log enable row level security;
