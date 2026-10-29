-- Send idempotency: one row per attempted send, keyed by a token the composer
-- generates once. A retry with the same key is answered from the row instead of
-- calling Resend a second time.

create table if not exists send_receipts (
  key text primary key,
  workspace_id text references workspaces(id) on delete cascade,
  user_id text references users(id) on delete set null,
  -- Null while the send is in flight, set when Resend has accepted the message.
  message_id text,
  thread_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_send_receipts_created_at on send_receipts(created_at);

alter table send_receipts enable row level security;
