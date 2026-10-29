-- Sessions: keep one row per device instead of one row per account, and record
-- enough about each to recognise it.

alter table sessions add column if not exists last_seen_at timestamptz not null default now();
alter table sessions add column if not exists ip text not null default '';
alter table sessions add column if not exists user_agent text not null default '';

-- Expired rows were never deleted, only ignored on read.
create index if not exists idx_sessions_expires_at on sessions(expires_at);
delete from sessions where expires_at < now();
