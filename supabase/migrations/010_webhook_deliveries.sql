-- Dead letters for webhooks. A delivery that fails to process is kept whole here
-- with its payload, so the mail it carried can be replayed instead of lost.

create table if not exists webhook_deliveries (
  id text primary key,
  kind text not null check (kind in ('inbound', 'events')),
  -- The provider's delivery id (svix-id), used to recognise a redelivery.
  external_id text,
  status text not null default 'failed' check (status in ('failed', 'resolved', 'discarded')),
  payload jsonb not null default '{}',
  error text not null default '',
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_webhook_deliveries_status on webhook_deliveries(status, created_at desc);
create index if not exists idx_webhook_deliveries_external_id on webhook_deliveries(external_id);

alter table webhook_deliveries enable row level security;
