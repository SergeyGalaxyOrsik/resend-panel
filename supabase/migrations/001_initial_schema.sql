-- Users
create table if not exists users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Workspaces
create table if not exists workspaces (
  id text primary key,
  name text not null default 'Primary workspace',
  owner_user_id text not null references users(id),
  created_at timestamptz not null default now()
);

-- Sessions
create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_sessions_user_id on sessions(user_id);

-- Resend Settings
create table if not exists resend_settings (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  token_encrypted text not null default '',
  from_name text not null default 'Resend Panel',
  from_email text not null default 'onboarding@resend.dev',
  inbound_email text not null default '',
  updated_at timestamptz not null default now()
);

-- Threads
create table if not exists threads (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  subject text not null default 'No subject',
  participants text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists idx_threads_workspace_id on threads(workspace_id);

-- Messages
create table if not exists messages (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  thread_id text not null default '',
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'delivered', 'failed', 'received')),
  subject text not null default '',
  from_name text not null default '',
  from_email text not null default '',
  "to" text[] not null default '{}',
  cc text[] not null default '{}',
  bcc text[] not null default '{}',
  text text not null default '',
  html text not null default '',
  provider_id text,
  in_reply_to text,
  references_list text[] default '{}',
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_messages_workspace_id on messages(workspace_id);
create index if not exists idx_messages_thread_id on messages(thread_id);
create index if not exists idx_messages_direction on messages(direction);
create index if not exists idx_messages_provider_id on messages(provider_id);

-- Message Events
create table if not exists message_events (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  message_id text not null,
  type text not null check (type in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'received')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_message_events_workspace_id on message_events(workspace_id);
create index if not exists idx_message_events_message_id on message_events(message_id);

-- Drafts
create table if not exists drafts (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  thread_id text,
  subject text not null default '',
  "to" text not null default '',
  cc text not null default '',
  bcc text not null default '',
  text text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists idx_drafts_workspace_id on drafts(workspace_id);

-- Inbound idempotency
create table if not exists inbound_receipts (
  external_id text primary key,
  message_id text not null,
  created_at timestamptz not null default now()
);

-- RLS (defense in depth; server uses service role)
alter table users enable row level security;
alter table workspaces enable row level security;
alter table sessions enable row level security;
alter table resend_settings enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table message_events enable row level security;
alter table drafts enable row level security;
alter table inbound_receipts enable row level security;
