import { buildHtmlFromText } from "@/lib/email"
import {
  createEvent,
  createMessage,
  ensureThread,
  findMessageByProviderId,
  getCurrentSettings,
  getCurrentWorkspace,
  recordInboundReceipt,
} from "@/lib/store"
import type { MessageStatus } from "@/lib/types"

type ResendListResponse<T> = {
  data: T[]
  has_more: boolean
}

type ResendSentItem = {
  id: string
  subject?: string
  from?: string
  to?: string[] | null
  cc?: string[] | null
  bcc?: string[] | null
  created_at?: string
  last_event?: string
  message_id?: string
}

type ResendReceivedItem = {
  id: string
  subject?: string
  from?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  created_at?: string
  message_id?: string
}

type ResendEmailDetail = {
  id: string
  subject?: string
  from?: string
  to?: string[]
  html?: string | null
  text?: string | null
  created_at?: string
  last_event?: string
}

function parseAddress(value: string | undefined) {
  if (!value) return { name: "Unknown", email: "unknown@example.com" }
  const match = value.match(/^(.*?)<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, "") || match[2], email: match[2].trim() }
  }
  return { name: value, email: value }
}

function mapLastEvent(event: string | undefined): MessageStatus {
  switch (event) {
    case "delivered":
      return "delivered"
    case "bounced":
    case "failed":
      return "failed"
    case "sent":
      return "sent"
    default:
      return "sent"
  }
}

async function fetchResendList<T>(token: string, path: string): Promise<T[]> {
  const items: T[] = []
  let after: string | undefined

  while (true) {
    const url = new URL(`https://api.resend.com${path}`)
    if (after) url.searchParams.set("after", after)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(body?.message || `Resend list failed (${response.status}).`)
    }

    const payload = (await response.json()) as ResendListResponse<T>
    items.push(...(payload.data ?? []))

    if (!payload.has_more || !payload.data?.length) {
      break
    }

    const last = payload.data[payload.data.length - 1] as { id?: string }
    after = last.id
  }

  return items
}

async function fetchSentDetail(token: string, id: string) {
  const response = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return (await response.json()) as ResendEmailDetail
}

async function fetchReceivedDetail(token: string, id: string) {
  const response = await fetch(`https://api.resend.com/emails/receiving/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return (await response.json()) as ResendEmailDetail & { html?: string; text?: string }
}

export async function syncResendHistory(token: string) {
  const workspace = await getCurrentWorkspace()
  const settings = await getCurrentSettings()
  if (!workspace) {
    throw new Error("Workspace is missing.")
  }

  const [sentItems, receivedItems] = await Promise.all([
    fetchResendList<ResendSentItem>(token, "/emails"),
    fetchResendList<ResendReceivedItem>(token, "/emails/receiving"),
  ])

  let imported = 0

  for (const item of sentItems) {
    if (!item.id || (await findMessageByProviderId(item.id))) {
      continue
    }

    const detail = await fetchSentDetail(token, item.id)
    const from = parseAddress(item.from ?? detail?.from)
    const to = (item.to ?? detail?.to ?? []).map(String)
    const subject = item.subject ?? detail?.subject ?? "No subject"
    const text = detail?.text ?? subject
    const html = detail?.html ?? buildHtmlFromText(text)
    const createdAt = item.created_at ?? detail?.created_at ?? new Date().toISOString()

    const thread = await ensureThread(workspace.id, subject, [from.email, ...to])
    const message = await createMessage({
      workspaceId: workspace.id,
      threadId: thread.id,
      direction: "outbound",
      status: mapLastEvent(item.last_event ?? detail?.last_event),
      subject,
      fromName: from.name,
      fromEmail: from.email,
      to,
      cc: (item.cc ?? []).map(String),
      bcc: (item.bcc ?? []).map(String),
      text,
      html,
      providerId: item.id,
      sentAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    })

    await createEvent(workspace.id, message.id, "sent", { providerId: item.id, source: "resend-sync" })
    if (item.last_event === "delivered") {
      await createEvent(workspace.id, message.id, "delivered", { providerId: item.id, source: "resend-sync" })
    }

    imported += 1
  }

  for (const item of receivedItems) {
    if (!item.id || (await findMessageByProviderId(item.id))) {
      continue
    }

    const detail = await fetchReceivedDetail(token, item.id)
    const from = parseAddress(item.from ?? detail?.from)
    const to = (item.to ?? detail?.to ?? [settings?.inboundEmail].filter(Boolean)).map(String)
    const subject = item.subject ?? detail?.subject ?? "No subject"
    const text = detail?.text ?? subject
    const html = detail?.html ?? buildHtmlFromText(text)
    const createdAt = item.created_at ?? detail?.created_at ?? new Date().toISOString()

    const thread = await ensureThread(workspace.id, subject, [from.email, ...to])
    const message = await createMessage({
      workspaceId: workspace.id,
      threadId: thread.id,
      direction: "inbound",
      status: "received",
      subject,
      fromName: from.name,
      fromEmail: from.email,
      to,
      cc: (item.cc ?? []).map(String),
      bcc: (item.bcc ?? []).map(String),
      text,
      html,
      providerId: item.id,
      receivedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    })

    const externalId = item.message_id || item.id
    if (externalId) {
      await recordInboundReceipt(externalId, message.id)
    }

    await createEvent(workspace.id, message.id, "received", { providerId: item.id, source: "resend-sync" })
    imported += 1
  }

  return {
    imported,
    sent: sentItems.length,
    received: receivedItems.length,
  }
}
