-- Login throttling: a failure counter per identity, so password guessing costs time.
--
-- One row per key. A key is an email ("email:someone@example.com") or a client
-- address ("ip:203.0.113.7"); the email key stops a targeted guess, the address
-- key stops one client spraying many accounts.

create table if not exists login_throttle (
  key text primary key,
  attempts integer not null default 0,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  locked_until timestamptz
);

create index if not exists idx_login_throttle_locked_until on login_throttle(locked_until);

alter table login_throttle enable row level security;
