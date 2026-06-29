# Resend Panel Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Resend Panel application by adding all missing page routes (auth pages, protected app shell layout, dashboard, inbox, sent, compose, drafts, statistics, settings, and inbound webhook endpoint).

**Architecture:** Next.js App Router with file-based routing. Auth pages live at `/login` and `/register`. Protected pages are nested under a shared layout that wraps them with `AppShell`. Each page is a server component that fetches data and renders client components for interactivity. Server actions in `app/actions.ts` handle all mutations.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (radix-nova), Tailwind CSS 4, TypeScript 5, file-based JSON store, node:crypto for password hashing and AES-256-GCM encryption.

---

## File Structure

### Create:
- `app/(auth)/login/page.tsx` — Login page (server component)
- `app/(auth)/register/page.tsx` — Register page (server component)
- `app/(auth)/layout.tsx` — Centered auth layout
- `app/(app)/layout.tsx` — Protected layout with AppShell
- `app/(app)/dashboard/page.tsx` — Dashboard with stats
- `app/(app)/inbox/page.tsx` — Thread list (inbound + outbound)
- `app/(app)/inbox/[threadId]/page.tsx` — Thread conversation view
- `app/(app)/sent/page.tsx` — Sent messages list
- `app/(app)/compose/page.tsx` — New message composer
- `app/(app)/drafts/page.tsx` — Drafts list
- `app/(app)/drafts/[draftId]/edit/page.tsx` — Edit draft
- `app/(app)/statistics/page.tsx` — Statistics dashboard
- `app/(app)/settings/page.tsx` — Resend settings form
- `app/api/inbound/route.ts` — Inbound webhook endpoint
- `components/message-list.tsx` — Reusable message list component
- `components/thread-view.tsx` — Thread conversation view component
- `components/settings-form.tsx` — Settings form component

### Modify:
- `app/page.tsx` — Replace default page with redirect to dashboard/login
- `app/layout.tsx` — Update metadata

---

## Task 1: Auth Bootstrap — Redirect Root to Auth

**Covers:** Auth bootstrap (root redirect)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace root page with server-side redirect**

```tsx
import { redirect } from "next/navigation"
import { getCurrentSession, getBootstrapState } from "@/lib/store"

export default async function Home() {
  const bootstrap = await getBootstrapState()
  if (!bootstrap.hasUsers) {
    redirect("/register")
  }

  const session = await getCurrentSession()
  if (!session) {
    redirect("/login")
  }

  redirect("/dashboard")
}
```

- [ ] **Step 2: Update layout metadata**

Edit `app/layout.tsx` — change metadata title and description:

```tsx
export const metadata: Metadata = {
  title: "Resend Panel",
  description: "Email management powered by Resend",
};
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: redirect root to register/login based on bootstrap state"
```

---

## Task 2: Auth Layout + Login Page

**Covers:** Auth bootstrap (login route, session check)

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create auth layout**

`app/(auth)/layout.tsx`:

```tsx
import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(24,24,27,0.08),transparent_35%),linear-gradient(180deg,rgba(250,250,250,1),rgba(244,244,245,1))] px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create login page**

`app/(auth)/login/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { getCurrentSession, getBootstrapState } from "@/lib/store"
import { loginAction } from "@/app/actions"
import { AuthForm } from "@/components/auth-form"
import Link from "next/link"

export default async function LoginPage() {
  const bootstrap = await getBootstrapState()
  if (!bootstrap.hasUsers) {
    redirect("/register")
  }

  const session = await getCurrentSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <>
      <AuthForm
        title="Sign in"
        description="Enter your credentials to access your workspace."
        action={loginAction}
        submitLabel="Sign in"
      />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
          Create account
        </Link>
      </p>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
mkdir -p "app/(auth)/login"
git add "app/(auth)/layout.tsx" "app/(auth)/login/page.tsx"
git commit -m "feat: add auth layout and login page with bootstrap guard"
```

---

## Task 3: Register Page

**Covers:** Auth bootstrap (registration, first-user-is-owner)

**Files:**
- Create: `app/(auth)/register/page.tsx`

- [ ] **Step 1: Create register page**

`app/(auth)/register/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { getCurrentSession, getBootstrapState } from "@/lib/store"
import { registerAction } from "@/app/actions"
import { AuthForm } from "@/components/auth-form"
import Link from "next/link"

export default async function RegisterPage() {
  const bootstrap = await getBootstrapState()
  if (bootstrap.hasUsers) {
    redirect("/login")
  }

  const session = await getCurrentSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <>
      <AuthForm
        title="Create account"
        description="The first account becomes the workspace owner."
        action={registerAction}
        submitLabel="Create account"
        confirmPassword
      />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Sign in instead
        </Link>
      </p>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(auth)/register"
git add "app/(auth)/register/page.tsx"
git commit -m "feat: add registration page with first-user-is-owner guard"
```

---

## Task 4: Protected App Layout

**Covers:** App shell (protected layout with sidebar)

**Files:**
- Create: `app/(app)/layout.tsx`

- [ ] **Step 1: Create protected layout**

`app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace } from "@/lib/store"
import { logoutAction } from "@/app/actions"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()

  return (
    <AppShell user={user} workspace={workspace} logoutAction={logoutAction}>
      {children}
    </AppShell>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(app)"
git add "app/(app)/layout.tsx"
git commit -m "feat: add protected app layout with AppShell and auth guard"
```

---

## Task 5: Dashboard Page

**Covers:** Statistics (dashboard view), App shell (dashboard route)

**Files:**
- Create: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

`app/(app)/dashboard/page.tsx`:

```tsx
import Link from "next/link"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { StatCards } from "@/components/stat-cards"
import { EmptyState } from "@/components/empty-state"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const stats = await getStats(workspace.id)

  return (
    <div className="space-y-6">
      <StatCards
        stats={[
          { label: "Total messages", value: stats.messages },
          { label: "Sent", value: stats.sent },
          { label: "Inbox", value: stats.inbox },
          { label: "Drafts", value: stats.drafts },
          { label: "Delivered", value: stats.delivered },
          { label: "Opened", value: stats.opened },
          { label: "Clicked", value: stats.clicked },
          { label: "Failed", value: stats.failed },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-white/90">
          <CardHeader>
            <CardTitle className="text-lg">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent events.</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {event.type}
                      </Badge>
                      <span className="text-muted-foreground">{event.messageId.slice(0, 12)}…</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <EmptyState
          title="Compose a message"
          description="Send your first email through Resend Panel."
          actionLabel="New message"
          href="/compose"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(app)/dashboard"
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat: add dashboard page with stats and recent activity"
```

---

## Task 6: Message List Component

**Covers:** Email flow (message list rendering)

**Files:**
- Create: `components/message-list.tsx`

- [ ] **Step 1: Create message list component**

`components/message-list.tsx`:

```tsx
import Link from "next/link"
import type { Message } from "@/lib/types"
import { formatDate, formatRelative } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MessageListProps = {
  messages: Message[]
  emptyLabel?: string
  variant?: "inbox" | "sent"
}

export function MessageList({ messages, emptyLabel = "No messages.", variant = "inbox" }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => {
        const display =
          variant === "inbox"
            ? message.fromEmail
            : message.to[0] || "unknown"

        return (
          <Link
            key={message.id}
            href={`/inbox/${message.threadId}`}
            className={cn(
              "flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-white/90 px-5 py-4 transition-colors hover:bg-zinc-50",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{display}</span>
                <Badge variant="outline" className="shrink-0 capitalize text-xs">
                  {message.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{message.subject}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(message.createdAt)}</span>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/message-list.tsx
git commit -m "feat: add reusable message list component"
```

---

## Task 7: Inbox — Thread List

**Covers:** Email flow (inbox thread listing)

**Files:**
- Create: `app/(app)/inbox/page.tsx`

- [ ] **Step 1: Create inbox page**

`app/(app)/inbox/page.tsx`:

```tsx
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { MessageList } from "@/components/message-list"
import { EmptyState } from "@/components/empty-state"

export default async function InboxPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const messages = await listMessages(workspace.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">All messages</h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? "s" : ""} in your workspace.
        </p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Send your first email to get started."
          actionLabel="Compose"
          href="/compose"
        />
      ) : (
        <MessageList messages={messages} variant="inbox" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(app)/inbox"
git add "app/(app)/inbox/page.tsx"
git commit -m "feat: add inbox page with message list"
```

---

## Task 8: Thread View Component + Thread Page

**Covers:** Email flow (thread conversation view, reply flow)

**Files:**
- Create: `components/thread-view.tsx`
- Create: `app/(app)/inbox/[threadId]/page.tsx`

- [ ] **Step 1: Create thread view component**

`components/thread-view.tsx`:

```tsx
import Link from "next/link"
import type { Message, Thread } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reply } from "lucide-react"

type ThreadViewProps = {
  thread: Thread
  messages: Message[]
}

export function ThreadView({ thread, messages }: ThreadViewProps) {
  const lastMessage = messages[messages.length - 1]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{thread.subject}</h2>
          <p className="text-sm text-muted-foreground">
            {thread.participants.join(", ")}
          </p>
        </div>
        <Link
          href={`/compose?threadId=${thread.id}`}
        >
          <Button className="rounded-xl gap-2">
            <Reply className="size-4" />
            Reply
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="border-border/60 bg-white/90">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">
                    {message.direction === "inbound" ? message.fromEmail : message.to[0]}
                  </CardTitle>
                  <Badge variant="outline" className="capitalize text-xs">
                    {message.direction}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(message.createdAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create thread page**

`app/(app)/inbox/[threadId]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getThreadWithMessages } from "@/lib/store"
import { ThreadView } from "@/components/thread-view"

type Props = {
  params: Promise<{ threadId: string }>
}

export default async function ThreadPage({ params }: Props) {
  const { threadId } = await params
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const result = await getThreadWithMessages(workspace.id, threadId)
  if (!result) notFound()

  return <ThreadView thread={result.thread} messages={result.messages} />
}
```

- [ ] **Step 3: Commit**

```bash
git add components/thread-view.tsx "app/(app)/inbox/[threadId]/page.tsx"
git commit -m "feat: add thread view component and thread detail page"
```

---

## Task 9: Sent Page

**Covers:** Email flow (sent messages listing)

**Files:**
- Create: `app/(app)/sent/page.tsx`

- [ ] **Step 1: Create sent page**

`app/(app)/sent/page.tsx`:

```tsx
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { MessageList } from "@/components/message-list"
import { EmptyState } from "@/components/empty-state"

export default async function SentPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const messages = await listMessages(workspace.id, "outbound")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Sent messages</h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} sent message{messages.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title="No sent messages"
          description="Compose your first email to see it here."
          actionLabel="Compose"
          href="/compose"
        />
      ) : (
        <MessageList messages={messages} variant="sent" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(app)/sent"
git add "app/(app)/sent/page.tsx"
git commit -m "feat: add sent messages page"
```

---

## Task 10: Compose Page

**Covers:** Email flow (compose new message)

**Files:**
- Create: `app/(app)/compose/page.tsx`

- [ ] **Step 1: Create compose page**

`app/(app)/compose/page.tsx`:

```tsx
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getCurrentSettings, getThreadWithMessages } from "@/lib/store"
import { getReplyRecipients, renderThreadSubject } from "@/lib/email"
import { composeAction } from "@/app/actions"
import { EmailComposer } from "@/components/email-composer"

type Props = {
  searchParams: Promise<{ threadId?: string }>
}

export default async function ComposePage({ searchParams }: Props) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const { threadId } = await searchParams

  let initialTo = ""
  let initialSubject = ""
  let replyToMessageId = ""
  let title = "New message"
  let description = "Write and send an email through Resend."

  if (threadId) {
    const result = await getThreadWithMessages(workspace.id, threadId)
    if (result) {
      const lastMessage = result.messages[result.messages.length - 1]
      if (lastMessage) {
        initialTo = getReplyRecipients(lastMessage).join(", ")
        replyToMessageId = lastMessage.id
      }
      initialSubject = `Re: ${renderThreadSubject(result.thread.subject)}`
      title = "Reply"
      description = `Replying to ${result.thread.subject}`
    }
  }

  return (
    <EmailComposer
      title={title}
      description={description}
      action={composeAction}
      initialTo={initialTo}
      initialSubject={initialSubject}
      threadId={threadId}
      replyToMessageId={replyToMessageId}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(app)/compose"
git add "app/(app)/compose/page.tsx"
git commit -m "feat: add compose page with reply support"
```

---

## Task 11: Drafts Page + Edit Draft

**Covers:** Email flow (draft management)

**Files:**
- Create: `app/(app)/drafts/page.tsx`
- Create: `app/(app)/drafts/[draftId]/edit/page.tsx`

- [ ] **Step 1: Create drafts list page**

`app/(app)/drafts/page.tsx`:

```tsx
import Link from "next/link"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DraftsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const drafts = await listDrafts(workspace.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Drafts</h2>
        <p className="text-sm text-muted-foreground">
          {drafts.length} draft{drafts.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts"
          description="Start composing a message to create a draft."
          actionLabel="Compose"
          href="/compose"
        />
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/drafts/${draft.id}/edit`}
              className="block rounded-2xl border border-border/60 bg-white/90 px-5 py-4 transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {draft.to || "No recipients"}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Draft
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {draft.subject || "No subject"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(draft.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create edit draft page**

`app/(app)/drafts/[draftId]/edit/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace } from "@/lib/store"
import { composeAction } from "@/app/actions"
import { EmailComposer } from "@/components/email-composer"

type Props = {
  params: Promise<{ draftId: string }>
}

export default async function EditDraftPage({ params }: Props) {
  const { draftId } = await params
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const { listDrafts } = await import("@/lib/store")
  const drafts = await listDrafts(workspace.id)
  const draft = drafts.find((d) => d.id === draftId)
  if (!draft) notFound()

  return (
    <EmailComposer
      title="Edit draft"
      description="Continue editing your message."
      action={composeAction}
      initialTo={draft.to}
      initialCc={draft.cc}
      initialBcc={draft.bcc}
      initialSubject={draft.subject}
      initialText={draft.text}
      threadId={draft.threadId}
      draftId={draft.id}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
mkdir -p "app/(app)/drafts/[draftId]/edit"
git add "app/(app)/drafts/page.tsx" "app/(app)/drafts/[draftId]/edit/page.tsx"
git commit -m "feat: add drafts list and edit draft pages"
```

---

## Task 12: Statistics Page

**Covers:** Statistics (dedicated stats view)

**Files:**
- Create: `app/(app)/statistics/page.tsx`

- [ ] **Step 1: Create statistics page**

`app/(app)/statistics/page.tsx`:

```tsx
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { StatCards } from "@/components/stat-cards"
import { formatDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function StatisticsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const stats = await getStats(workspace.id)
  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0"
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0"
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Email statistics</h2>
        <p className="text-sm text-muted-foreground">
          Performance metrics for your workspace.
        </p>
      </div>

      <StatCards
        stats={[
          { label: "Total sent", value: stats.sent },
          { label: "Delivered", value: stats.delivered, description: `${deliveryRate}% delivery rate` },
          { label: "Opened", value: stats.opened, description: `${openRate}% open rate` },
          { label: "Clicked", value: stats.clicked, description: `${clickRate}% click rate` },
          { label: "Failed", value: stats.failed },
          { label: "Inbound", value: stats.inbox },
          { label: "Replied", value: stats.replied },
          { label: "Drafts", value: stats.drafts },
        ]}
      />

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Message</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEvents.map((event) => (
                    <tr key={event.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="capitalize">{event.type}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {event.messageId.slice(0, 16)}…
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/(app)/statistics"
git add "app/(app)/statistics/page.tsx"
git commit -m "feat: add statistics page with delivery metrics and event table"
```

---

## Task 13: Settings Page

**Covers:** Settings (API token management)

**Files:**
- Create: `app/(app)/settings/page.tsx`
- Create: `components/settings-form.tsx`

- [ ] **Step 1: Create settings form component**

`components/settings-form.tsx`:

```tsx
"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AuthState } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type SettingsFormProps = {
  action: Action
  initialFromName: string
  initialFromEmail: string
  initialInboundEmail: string
}

const initialState: AuthState = {}

export function SettingsForm({
  action,
  initialFromName,
  initialFromEmail,
  initialInboundEmail,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <Card className="border-border/80 bg-white/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.32)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Resend settings</CardTitle>
        <CardDescription>
          Configure your Resend API token and email sender identity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}
        {state.success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.success}
          </div>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resendToken">Resend API Token</Label>
            <Input
              id="resendToken"
              name="resendToken"
              type="password"
              placeholder="re_..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Your token is encrypted and stored server-side. It never reaches the browser.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromName">From name</Label>
              <Input
                id="fromName"
                name="fromName"
                defaultValue={initialFromName}
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From email</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={initialFromEmail}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inboundEmail">Inbound email</Label>
            <Input
              id="inboundEmail"
              name="inboundEmail"
              defaultValue={initialInboundEmail}
              placeholder="inbox@workspace.resend.dev"
            />
            <p className="text-xs text-muted-foreground">
              Configure this address in your Resend dashboard to receive inbound emails.
            </p>
          </div>

          <Button type="submit" className="rounded-xl" disabled={pending}>
            {pending ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create settings page**

`app/(app)/settings/page.tsx`:

```tsx
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getCurrentSettings } from "@/lib/store"
import { saveSettingsAction } from "@/app/actions"
import { SettingsForm } from "@/components/settings-form"

export default async function SettingsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const settings = await getCurrentSettings()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your Resend integration and sender identity.
        </p>
      </div>

      <SettingsForm
        action={saveSettingsAction}
        initialFromName={settings?.fromName ?? ""}
        initialFromEmail={settings?.fromEmail ?? ""}
        initialInboundEmail={settings?.inboundEmail ?? ""}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
mkdir -p "app/(app)/settings"
git add "app/(app)/settings/page.tsx" components/settings-form.tsx
git commit -m "feat: add settings page with Resend token and sender config"
```

---

## Task 14: Inbound Webhook Endpoint

**Covers:** Email flow (receive email via webhook)

**Files:**
- Create: `app/api/inbound/route.ts`

- [ ] **Step 1: Create inbound webhook route**

`app/api/inbound/route.ts`:

```ts
import { NextResponse } from "next/server"
import { inboundWebhookAction } from "@/app/actions"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await inboundWebhookAction(body)
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p "app/api/inbound"
git add "app/api/inbound/route.ts"
git commit -m "feat: add inbound webhook endpoint for Resend"
```

---

## Task 15: Final Verification

**Covers:** All sections (verification)

**Files:** (none — verification only)

- [ ] **Step 1: Build and verify no TypeScript errors**

```bash
bun run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

```bash
bun run lint
```

Expected: No errors.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build/lint issues"
```

(Only if Step 1 or 2 produced errors that needed fixing.)
