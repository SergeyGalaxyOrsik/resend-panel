# Resend Panel

Self-hosted email management panel powered by [Resend](https://resend.com). A Gmail-style
mail client over your Resend account: folders, read state, stars, archive and trash,
bulk actions, keyboard shortcuts and a sandboxed message reader.

![Resend Panel inbox: folder rail with unread counts, conversation list with unread rows in bold, stars and attachment markers](docs/inbox.png)

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

## Screenshots

<img src="docs/inbox_black.png" alt="The same inbox rendered in dark mode" />

<p align="center"><sub><b>Dark theme.</b> Follows the system by default, or pick light or dark explicitly.</sub></p>

<img src="docs/thread.png" alt="Conversation reader with the older message collapsed and the newest one expanded" />

<p align="center"><sub><b>Reader.</b> Older messages stay collapsed, the newest opens, and the reply box sends without leaving the thread.</sub></p>

<img src="docs/compose.png" alt="Composer showing From, To, Subject, body and an attachment dropzone" />

<p align="center"><sub><b>Composer.</b> One column, Cc and Bcc on demand, drag-and-drop attachments.</sub></p>

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
| `DATABASE_URL` | Migrations | Postgres URI for `bun run migrate` and Docker startup migrations. Use the **session pooler** string (Supabase → Connect → Session pooler): the direct `db.<ref>.supabase.co` host is IPv6-only and fails on IPv4-only networks |
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

Fill a fresh workspace with demo mail for screenshots or a walkthrough (register the
owner account first, then run this):

```bash
bun run seed          # add demo threads, drafts and delivery events
bun run seed --reset  # clear the demo mail first, then reseed
```

Install and run:

```bash
bun install
bun run dev
```

### Resend Setup

1. Paste your Resend API token in **Settings**.
2. In the Resend dashboard create **two** webhooks (Webhooks → Add Webhook). They point at
   different endpoints and each has its own signing secret.

#### Webhook 1 — inbound mail

- **Endpoint:** `https://your-domain/api/inbound`
- **Events:** `email.received`, and nothing else
- **Signing secret:** copy into `RESEND_INBOUND_WEBHOOK_SECRET`

> [!WARNING]
> Subscribe this endpoint to `email.received` only. It treats every payload it receives as a
> new incoming message, so any other event pointed at it lands in the inbox as a junk
> conversation.

#### Webhook 2 — delivery events

- **Endpoint:** `https://your-domain/api/events`
- **Signing secret:** copy into `RESEND_EVENTS_WEBHOOK_SECRET`

Select exactly these six events. They are the ones the panel actually reads:

| Event | What it drives |
|-------|----------------|
| `email.delivered` | Sets the message status to delivered; **Delivered** tile and delivery rate |
| `email.opened` | **Opened** tile and open rate |
| `email.clicked` | **Clicked** tile and click rate |
| `email.bounced` | Recorded against the message, shown in **Recent activity** |
| `email.failed` | Recorded as a failure, shown in **Recent activity** |
| `email.delivery_delayed` | Recorded as a failure, shown in **Recent activity** |

Everything else Resend offers is deliberately ignored: the endpoint answers
`{"ignored":true}` and stores nothing.

- `email.sent` — redundant. The panel writes its own `sent` event the moment the send
  call to the Resend API succeeds, so it never needs the webhook to tell it.
- `email.scheduled`, `email.suppressed`, `email.complained`
- `domain.created`, `domain.updated`, `domain.deleted`
- `contact.created`, `contact.updated`, `contact.deleted`

Subscribing to them does no harm beyond filling the Resend webhook log with ignored
deliveries.

> [!NOTE]
> Only `email.delivered` changes a message's own status today. Bounces and failures are
> stored as events and show up in the activity feed, but the message keeps the status it
> already had.

> [!TIP]
> Seeing `{"ignored":true,"reason":"message not found"}` on a subscribed event is normal for
> mail this install did not send. Events are matched to messages by the Resend message id,
> which the panel records only for messages it sent itself, so anything sent from another
> deployment, another database, or straight from the Resend API is acknowledged and dropped.

## Docker

Build and run locally:

```bash
docker build -t resend-panel .
docker run --rm -p 3000:3000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SECRET_KEY=your-secret-key \
  -e DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-1-[region].pooler.supabase.com:5432/postgres \
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
├── seed-demo-data.ts       # demo mail for screenshots and walkthroughs
├── migrate-json-to-supabase.ts
└── repair-workspace.ts
```

## Built on Resend

This panel is a client for [Resend](https://resend.com) and does nothing without it.
Sending, inbound routing, delivery events, domain verification and attachments all run
through the Resend API. Their open-source work lives at
**[github.com/resend](https://github.com/resend)** — worth a look, and worth a star.

Resend Panel is an independent, community project. It is not affiliated with, maintained
by, or endorsed by Resend.

## License

[MIT](LICENSE)
