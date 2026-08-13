import { buildHtmlFromText, extractEmailAddress } from "@/lib/email"
import {
  createEvent,
  createMessage,
  ensureThread,
  findMessageByProviderId,
  getCurrentSettings,
  getCurrentWorkspace,
  listMailboxes,
  recordInboundReceipt,
  refreshAllThreadLastMessageAt,
  updateMessage,
} from "@/lib/store"
import type { Mailbox, MessageStatus } from "@/lib/types"

type ResendListResponse<T> = {
  data: T[]
  has_more: boolean
}

type ResendRecord = Record<string, unknown>

type ResendSentItem = ResendRecord & {
  id: string
  subject?: string
  from?: string
  to?: string[] | null
  cc?: string[] | null
  bcc?: string[] | null
  created_at?: string
  createdAt?: string
  last_event?: string
  message_id?: string
}

type ResendReceivedItem = ResendRecord & {
  id: string
  subject?: string
  from?: string
  to?: string[]
  cc?: string[]
  bcc?: string[]
  created_at?: string
  createdAt?: string
  received_at?: string
  receivedAt?: string
  message_id?: string
}

function unwrapResendRecord<T extends ResendRecord>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null

  const record = payload as ResendRecord
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return record.data as T
  }

  return record as T
}

function readResendTimestamp(
  item: ResendRecord,
  detail: ResendRecord | null | undefined,
  direction: "outbound" | "inbound"
) {
  const keys =
    direction === "outbound"
      ? ["sent_at", "sentAt", "created_at", "createdAt"]
      : ["received_at", "receivedAt", "created_at", "createdAt"]

  for (const source of [detail, item]) {
    if (!source) continue
    for (const key of keys) {
      const value = source[key]
      if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
        return value
      }
    }
  }

  return null
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
  return unwrapResendRecord<ResendRecord>(await response.json())
}

async function fetchReceivedDetail(token: string, id: string) {
  const response = await fetch(`https://api.resend.com/emails/receiving/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return unwrapResendRecord<ResendRecord>(await response.json())
}

async function backfillMessageTimestamps(
  messageId: string,
  direction: "outbound" | "inbound",
  occurredAt: string
) {
  if (direction === "outbound") {
    await updateMessage(messageId, {
      sentAt: occurredAt,
      createdAt: occurredAt,
    })
    return
  }

  await updateMessage(messageId, {
    receivedAt: occurredAt,
    createdAt: occurredAt,
  })
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

  // Imported mail is attached to a mailbox the same way live mail is: outbound by
  // sender address, inbound by recipient. Anything else stays unlinked (owner-only).
  const mailboxes = await listMailboxes(workspace.id)
  const findMailbox = (addresses: string[]): Mailbox | undefined => {
    for (const address of addresses) {
      const normalized = extractEmailAddress(address)
      const match = mailboxes.find((mailbox) => mailbox.address.toLowerCase() === normalized)
      if (match) return match
    }
    return undefined
  }

  let imported = 0
  let backfilled = 0

  for (const item of sentItems) {
    if (!item.id) continue

    const detail = await fetchSentDetail(token, item.id)
    const occurredAt = readResendTimestamp(item, detail, "outbound")
    if (!occurredAt) continue

    const existing = await findMessageByProviderId(item.id)
    if (existing) {
      await backfillMessageTimestamps(existing.id, "outbound", occurredAt)
      backfilled += 1
      continue
    }

    const from = parseAddress(String(item.from ?? detail?.from ?? ""))
    const to = (item.to ?? (detail?.to as string[] | undefined) ?? []).map(String)
    const subject = String(item.subject ?? detail?.subject ?? "No subject")
    const text = String(detail?.text ?? subject)
    const html = String(detail?.html ?? buildHtmlFromText(text))

    const mailbox = findMailbox([from.email])
    const thread = await ensureThread(workspace.id, subject, [from.email, ...to], {
      messageAt: occurredAt,
      mailboxId: mailbox?.id,
    })
    const message = await createMessage({
      workspaceId: workspace.id,
      mailboxId: mailbox?.id,
      threadId: thread.id,
      direction: "outbound",
      status: mapLastEvent(String(item.last_event ?? detail?.last_event ?? "")),
      subject,
      fromName: from.name,
      fromEmail: from.email,
      to,
      cc: (item.cc ?? []).map(String),
      bcc: (item.bcc ?? []).map(String),
      text,
      html,
      providerId: item.id,
      sentAt: occurredAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    })

    await createEvent(workspace.id, message.id, "sent", { providerId: item.id, source: "resend-sync" })
    if (item.last_event === "delivered") {
      await createEvent(workspace.id, message.id, "delivered", { providerId: item.id, source: "resend-sync" })
    }

    imported += 1
  }

  for (const item of receivedItems) {
    if (!item.id) continue

    const detail = await fetchReceivedDetail(token, item.id)
    const occurredAt = readResendTimestamp(item, detail, "inbound")
    if (!occurredAt) continue

    const existing = await findMessageByProviderId(item.id)
    if (existing) {
      await backfillMessageTimestamps(existing.id, "inbound", occurredAt)
      backfilled += 1
      continue
    }

    const from = parseAddress(String(item.from ?? detail?.from ?? ""))
    const to = (item.to ?? (detail?.to as string[] | undefined) ?? [settings?.inboundEmail].filter(Boolean)).map(String)
    const subject = String(item.subject ?? detail?.subject ?? "No subject")
    const text = String(detail?.text ?? subject)
    const html = String(detail?.html ?? buildHtmlFromText(text))

    const mailbox = findMailbox(to)
    const thread = await ensureThread(workspace.id, subject, [from.email, ...to], {
      messageAt: occurredAt,
      mailboxId: mailbox?.id,
    })
    const message = await createMessage({
      workspaceId: workspace.id,
      mailboxId: mailbox?.id,
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
      // Backfilled history is not new mail: importing it must not light up the inbox.
      isRead: true,
      providerId: item.id,
      receivedAt: occurredAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    })

    const externalId = String(item.message_id || item.id)
    if (externalId) {
      await recordInboundReceipt(externalId, message.id)
    }

    await createEvent(workspace.id, message.id, "received", { providerId: item.id, source: "resend-sync" })
    imported += 1
  }

  await refreshAllThreadLastMessageAt(workspace.id)

  return {
    imported,
    backfilled,
    sent: sentItems.length,
    received: receivedItems.length,
  }
}
