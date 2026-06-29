# Resend Panel

Self-hosted email management panel powered by [Resend](https://resend.com). Single-tenant workspace with auth, inbox, compose, reply, drafts, and delivery statistics.

## Features

- **Auth bootstrap** — first user becomes workspace owner, registration closes automatically
- **Inbox & threads** — receive inbound emails via Resend webhook, threaded conversation view
- **Compose & reply** — send emails through Resend API, reply within threads with live preview
- **Drafts** — save and resume drafts
- **Delivery stats** — sent, delivered, opened, clicked, failed metrics
- **Settings** — encrypted Resend API token storage, connection test, sender identity config

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19)
- [shadcn/ui](https://ui.shadcn.com) sidebar-09 + Tailwind CSS 4
- [Supabase](https://supabase.com) Postgres (hosted)
- AES-256-GCM encryption for secrets

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) or Node.js 18+
- Hosted Supabase project
- A [Resend](https://resend.com) account and API token

### Installation

```bash
git clone https://github.com/SergeyGalaxyOrsik/resend-panel.git
cd resend-panel
cp .env.example .env
```

Configure `.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Hosted Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes | Server-only secret key (`SUPABASE_SERVICE_KEY` also supported) |
| `DATABASE_URL` | Docker | Direct Postgres URI for startup migrations (Supabase → Database → Connection string) |
| `APP_SECRET` | Yes | Encryption key. Generate with `openssl rand -hex 32` |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Prod | Signing secret for webhook → `/api/inbound` (`email.received`) |
| `RESEND_EVENTS_WEBHOOK_SECRET` | Prod | Signing secret for webhook → `/api/events` (delivered, opened, …) |
| `RESEND_WEBHOOK_SECRET` | Optional | Legacy fallback if both webhooks share one secret |

Apply schema manually or via Docker (migrations run automatically on container start):

```bash
bun run migrate
# or: SQL in supabase/migrations/001_initial_schema.sql via Supabase dashboard
```

Migrate legacy JSON data (optional):

```bash
bun run scripts/migrate-json-to-supabase.ts
```

Install and run:

```bash
bun install
bun run dev
```

### Resend Setup

1. Paste API token in **Settings**
2. Webhook **`email.received`** → `https://your-domain/api/inbound` — copy its signing secret to `RESEND_INBOUND_WEBHOOK_SECRET`
3. Webhook **delivery events** (delivered, opened, clicked, bounced, failed) → `https://your-domain/api/events` — copy its signing secret to `RESEND_EVENTS_WEBHOOK_SECRET`

## Docker

Build and run locally:

```bash
docker build -t resend-panel .
docker run --rm -p 3000:3000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SECRET_KEY=your-secret-key \
  -e DATABASE_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres \
  -e APP_SECRET=$(openssl rand -hex 32) \
  -e RESEND_INBOUND_WEBHOOK_SECRET=whsec_inbound_secret \
  -e RESEND_EVENTS_WEBHOOK_SECRET=whsec_events_secret \
  resend-panel
```

Open [http://localhost:3000](http://localhost:3000).

For production, point Resend webhooks at your public host, e.g. `https://your-domain/api/inbound` and `https://your-domain/api/events`.

## Project Structure

```
app/
├── (auth)/              # Login, register
├── (app)/               # Protected routes (sidebar-09 shell)
│   ├── dashboard/
│   ├── inbox/[threadId]/
│   ├── sent/, compose/, drafts/, statistics/, settings/
├── api/inbound/         # Inbound email webhook
├── api/events/          # Delivery/open/click events
lib/
├── store.ts             # Supabase data layer
├── supabase.ts          # Supabase client
scripts/
├── migrate-json-to-supabase.ts
└── repair-workspace.ts
```

## License

[MIT](LICENSE)
