-- Gmail-style mail state: read/unread per message, star/archive/trash per thread.

-- Read state lives on the message, so a thread is unread when any message in it is.
alter table messages add column if not exists is_read boolean not null default false;

-- Everything that already exists predates the feature: mark it read so the first
-- load after the migration is not a wall of bold rows.
update messages set is_read = true where is_read = false;

-- Outbound mail is authored here, so it is never unread.
alter table messages alter column is_read set default false;

create index if not exists idx_messages_unread
  on messages (workspace_id, thread_id)
  where is_read = false;

-- Thread-level state. Archive and trash are mutually exclusive in the UI but kept
-- as separate flags so restoring from trash returns a thread to where it was.
alter table threads add column if not exists is_starred boolean not null default false;
alter table threads add column if not exists is_archived boolean not null default false;
alter table threads add column if not exists is_trashed boolean not null default false;
alter table threads add column if not exists trashed_at timestamptz;

create index if not exists idx_threads_folder
  on threads (workspace_id, is_trashed, is_archived, last_message_at desc);

create index if not exists idx_threads_starred
  on threads (workspace_id, is_starred)
  where is_starred = true;
