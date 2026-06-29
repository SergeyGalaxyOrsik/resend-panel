# Resend Panel

Self-hosted email management panel powered by [Resend](https://resend.com). Single-tenant workspace with auth, inbox, compose, reply, drafts, and delivery statistics.

## Features

- **Auth bootstrap** — first user becomes workspace owner, registration closes automatically
- **Inbox & threads** — receive inbound emails via Resend webhook, threaded conversation view
- **Compose & reply** — send emails through Resend API, reply within threads
- **Drafts** — save and resume drafts
- **Delivery stats** — sent, delivered, opened, clicked, failed metrics
- **Settings** — encrypted Resend API token storage, sender identity config

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19)
- [shadcn/ui](https://ui.shadcn.com) (radix-nova) + Tailwind CSS 4
- File-based JSON store (no external database required)
- AES-256-GCM encryption for secrets

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+ or [Bun](https://bun.sh)
- A [Resend](https://resend.com) account and API token

### Installation

```bash
git clone https://github.com/SergeyGalaxyOrsik/resend-panel.git
cd resend-panel
cp .env.example .env
```

Generate an encryption key:

```bash
# macOS/Linux
echo "APP_SECRET=$(openssl rand -hex 32)" >> .env
```

Install dependencies and start the dev server:

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The first account you create becomes the workspace owner.

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_SECRET` | Yes | Encryption key for API tokens. Generate with `openssl rand -hex 32` |
| `NODE_ENV` | No | Set to `production` in deployed environments |

### Resend Setup

1. Create a [Resend](https://resend.com) account
2. Go to **Settings** in the panel and paste your API token
3. Configure inbound email in your Resend dashboard pointing to `/api/inbound`

## Project Structure

```
app/
├── (auth)/              # Login, register (public)
│   ├── login/
│   ├── register/
│   └── layout.tsx
├── (app)/               # Protected routes (sidebar shell)
│   ├── dashboard/
│   ├── inbox/
│   │   └── [threadId]/
│   ├── sent/
│   ├── compose/
│   ├── drafts/
│   │   └── [draftId]/edit/
│   ├── statistics/
│   ├── settings/
│   └── layout.tsx
├── api/inbound/         # Resend webhook endpoint
├── actions.ts           # Server actions
└── layout.tsx           # Root layout
components/              # UI components
lib/                     # Auth, store, crypto, email utils
```

## License

[MIT](LICENSE)
