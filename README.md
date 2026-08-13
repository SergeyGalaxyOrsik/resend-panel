# Resend Panel

Self-hosted email management panel powered by [Resend](https://resend.com). A Gmail-style
mail client over your Resend account: folders, read state, stars, archive and trash,
bulk actions, keyboard shortcuts and a sandboxed message reader.

## Features

- **Auth bootstrap** — first user becomes workspace owner, registration closes automatically
- **Folders** — Inbox, Starred, Sent, Drafts, Archive, Trash, with unread counts in the rail
- **Conversation list** — unread rows in bold, per-row star, hover actions, multi-select with a
  bulk toolbar, and Gmail's keyboard shortcuts (`j`/`k`, `x`, `s`, `e`, `#`, `⇧I`, `⇧U`, `/`)
- **Reader** — collapsed thread history, attachments, and an inline reply that sends
- **Sandboxed message rendering** — inbound HTML runs in a scriptless iframe, so a message can
  neither execute JavaScript nor leak its CSS into the panel
- **Global search** — one search box across every folder, with results at a shareable URL
- **Compose & drafts** — send through the Resend API, save and resume drafts
- **Delivery stats** — sent, delivered, opened, clicked, failed metrics
- **Settings** — encrypted Resend API token storage, connection test, sender identity config
- **Light and dark themes** — follows the system by default

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `j` / `k` | Move down / up the list |
| `Enter` or `o` | Open the conversation under the cursor |
| `x` | Select / deselect |
| `s` | Star / unstar |
| `e` | Archive (or move back to Inbox from Archive) |
| `#` or `Delete` | Move to trash (delete forever when already in Trash) |
| `⇧I` / `⇧U` | Mark read / unread |
| `/` | Focus search |
| `Esc` | Clear the selection |
| `⌘B` / `Ctrl+B` | Collapse the folder rail |

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19)
- [shadcn/ui](https://ui.shadcn.com) (`b0` preset theme) + Tailwind CSS 4 + next-themes
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
├── (auth)/                 # Login, register, forced password change
├── (app)/                  # Protected routes, inside the mail shell
│   ├── inbox/ starred/ archive/ trash/ sent/   # folder lists
│   ├── search/             # results for the global search box
│   ├── thread/[threadId]/  # the one reader, ?from= decides where "back" goes
│   ├── drafts/, compose/, dashboard/, statistics/
│   └── settings/, users/, mailboxes/           # owner only
├── mail-actions.ts         # star / archive / trash / read mutations
├── api/inbound/            # Inbound email webhook
├── api/events/             # Delivery/open/click events
components/
├── mail/                   # shell, sidebar, list, reader, search
├── email-body.tsx          # sandboxed iframe renderer for message HTML
lib/
├── store.ts                # Supabase data layer, folder queries and mutations
├── mail.ts                 # avatars, initials, list date formatting
├── email-html.ts           # message sanitizer and preview text
└── supabase.ts             # Supabase client
scripts/
├── migrate-json-to-supabase.ts
└── repair-workspace.ts
```

## License

[MIT](LICENSE)
