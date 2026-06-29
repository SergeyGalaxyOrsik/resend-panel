import { createToken } from "@/lib/crypto"
import { supabase } from "@/lib/supabase"
import type {
  Draft,
  Message,
  MessageEvent,
  ResendSettings,
  Session,
  Thread,
  User,
  Workspace,
} from "@/lib/types"

// ── Bootstrap ──────────────────────────────────────────────

export async function getBootstrapState() {
  const { data: users } = await supabase.from("users").select("id, email, password_hash, created_at").limit(1)
  const { data: workspaces } = await supabase.from("workspaces").select("id, name, owner_user_id, created_at").limit(1)

  return {
    hasUsers: (users?.length ?? 0) > 0,
    hasWorkspace: (workspaces?.length ?? 0) > 0,
    owner: users?.[0] ? mapUser(users[0]) : null,
    workspace: workspaces?.[0] ? mapWorkspace(workspaces[0]) : null,
  }
}

// ── Users ──────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  const { data } = await supabase.from("users").select("*").eq("email", email).maybeSingle()
  if (!data) return null
  return mapUser(data)
}

export async function findUserById(userId: string) {
  const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle()
  if (!data) return null
  return mapUser(data)
}

export async function createUser(email: string, passwordHash: string) {
  const user: User = {
    id: createToken("user"),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("users").insert({
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
  })

  if (error) throw new Error(error.message)
  return user
}

// ── Workspaces ─────────────────────────────────────────────

export async function createWorkspaceForOwner(owner: User, name?: string) {
  const workspace: Workspace = {
    id: createToken("ws"),
    ownerUserId: owner.id,
    name: name || "Primary workspace",
    createdAt: new Date().toISOString(),
  }

  const { error: wsError } = await supabase.from("workspaces").insert({
    id: workspace.id,
    name: workspace.name,
    owner_user_id: workspace.ownerUserId,
    created_at: workspace.createdAt,
  })

  if (wsError) throw new Error(wsError.message)

  const { error: settingsError } = await supabase.from("resend_settings").insert({
    id: createToken("settings"),
    workspace_id: workspace.id,
    token_encrypted: "",
    from_name: "Resend Panel",
    from_email: "onboarding@resend.dev",
    inbound_email: `inbox@${workspace.id.slice(0, 8)}.local`,
    updated_at: new Date().toISOString(),
  })

  if (settingsError) throw new Error(settingsError.message)

  return workspace
}

export async function getCurrentWorkspace() {
  const { data } = await supabase.from("workspaces").select("*").limit(1).maybeSingle()
  if (!data) return null
  return mapWorkspace(data)
}

// ── Sessions ───────────────────────────────────────────────

export async function createSession(userId: string) {
  await supabase.from("sessions").delete().eq("user_id", userId)

  const session: Session = {
    id: createToken("session"),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  }

  const { error } = await supabase.from("sessions").insert({
    id: session.id,
    user_id: session.userId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
  })

  if (error) throw new Error(error.message)
  return session
}

export async function findSession(sessionToken: string) {
  const { data } = await supabase.from("sessions").select("*").eq("id", sessionToken).maybeSingle()
  if (!data) return null
  return mapSession(data)
}

export async function revokeSession(sessionId: string) {
  await supabase.from("sessions").delete().eq("id", sessionId)
}

// ── Settings ───────────────────────────────────────────────

export async function getCurrentSettings() {
  const { data } = await supabase.from("resend_settings").select("*").limit(1).maybeSingle()
  if (!data) return null
  return mapSettings(data)
}

export async function updateResendSettings(
  updater: Partial<Pick<ResendSettings, "tokenEncrypted" | "fromName" | "fromEmail" | "inboundEmail">>
) {
  const { data: current } = await supabase.from("resend_settings").select("*").limit(1).maybeSingle()
  if (!current) throw new Error("Workspace settings are missing.")

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updater.tokenEncrypted !== undefined) updates.token_encrypted = updater.tokenEncrypted
  if (updater.fromName !== undefined) updates.from_name = updater.fromName
  if (updater.fromEmail !== undefined) updates.from_email = updater.fromEmail
  if (updater.inboundEmail !== undefined) updates.inbound_email = updater.inboundEmail

  const { error } = await supabase.from("resend_settings").update(updates).eq("id", current.id)
  if (error) throw new Error(error.message)

  return mapSettings({ ...current, ...updates })
}

// ── Threads ────────────────────────────────────────────────

export async function ensureThread(
  workspaceId: string,
  subject: string,
  participants: string[],
  options?: { messageAt?: string }
) {
  const normalizedSubject = subject.trim() || "No subject"
  const uniqueParticipants = Array.from(new Set(participants))
  const messageAt = options?.messageAt

  const { data: existingList } = await supabase
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .ilike("subject", normalizedSubject)
    .limit(1)

  const existing = existingList?.[0]

  if (existing) {
    const mergedParticipants = Array.from(new Set([...(existing.participants || []), ...uniqueParticipants]))
    const existingLast = existing.last_message_at as string
    const lastMessageAt =
      messageAt && new Date(messageAt).getTime() > new Date(existingLast).getTime() ? messageAt : existingLast
    const now = new Date().toISOString()
    await supabase
      .from("threads")
      .update({
        participants: mergedParticipants,
        updated_at: now,
        last_message_at: lastMessageAt,
      })
      .eq("id", existing.id)

    return mapThread({
      ...existing,
      participants: mergedParticipants,
      updated_at: now,
      last_message_at: lastMessageAt,
    })
  }

  const initialAt = messageAt ?? new Date().toISOString()
  const thread: Thread = {
    id: createToken("thread"),
    workspaceId,
    subject: normalizedSubject,
    participants: uniqueParticipants,
    createdAt: initialAt,
    updatedAt: initialAt,
    lastMessageAt: initialAt,
  }

  const { error } = await supabase.from("threads").insert({
    id: thread.id,
    workspace_id: thread.workspaceId,
    subject: thread.subject,
    participants: thread.participants,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    last_message_at: thread.lastMessageAt,
  })

  if (error) throw new Error(error.message)
  return thread
}

export async function listThreads(workspaceId: string) {
  const { data } = await supabase
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false })

  return (data || []).map(mapThread)
}

export async function refreshAllThreadLastMessageAt(workspaceId: string) {
  const { data: threads } = await supabase.from("threads").select("id").eq("workspace_id", workspaceId)
  if (!threads?.length) return

  for (const thread of threads) {
    await refreshThreadLastMessageAt(workspaceId, thread.id as string)
  }
}

export async function refreshThreadLastMessageAt(workspaceId: string, threadId: string) {
  const { data: messages } = await supabase
    .from("messages")
    .select("sent_at, received_at, created_at, direction")
    .eq("workspace_id", workspaceId)
    .eq("thread_id", threadId)

  if (!messages?.length) return

  let latest = messages[0].created_at as string
  let latestTime = 0

  for (const row of messages) {
    const direction = row.direction as Message["direction"]
    const candidate =
      direction === "outbound"
        ? ((row.sent_at as string | null) ?? (row.created_at as string))
        : ((row.received_at as string | null) ?? (row.created_at as string))
    const time = new Date(candidate).getTime()
    if (time > latestTime) {
      latestTime = time
      latest = candidate
    }
  }

  await supabase.from("threads").update({ last_message_at: latest }).eq("id", threadId)
}

export async function getThreadWithMessages(workspaceId: string, threadId: string) {
  const { data: threadData } = await supabase
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", threadId)
    .maybeSingle()

  if (!threadData) return null

  const { data: messagesData } = await supabase
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })

  const messages = (messagesData || []).map(mapMessage)

  return {
    thread: mapThread(threadData),
    messages: messages.sort((a, b) => compareMessagesByTimestamp(a, b, "asc")),
  }
}

// ── Messages ───────────────────────────────────────────────

export async function createMessage(
  payload: Omit<Message, "id" | "createdAt" | "updatedAt"> & {
    id?: string
    createdAt?: string
    updatedAt?: string
  }
) {
  const now = new Date().toISOString()
  const message: Message = {
    ...payload,
    id: payload.id ?? createToken("message"),
    createdAt: payload.createdAt ?? now,
    updatedAt: payload.updatedAt ?? now,
  }

  const { error } = await supabase.from("messages").insert({
    id: message.id,
    workspace_id: message.workspaceId,
    thread_id: message.threadId,
    direction: message.direction,
    status: message.status,
    subject: message.subject,
    from_name: message.fromName,
    from_email: message.fromEmail,
    to: message.to,
    cc: message.cc,
    bcc: message.bcc,
    text: message.text,
    html: message.html,
    provider_id: message.providerId,
    in_reply_to: message.inReplyTo,
    references_list: message.references,
    sent_at: message.sentAt,
    received_at: message.receivedAt,
    created_at: message.createdAt,
    updated_at: message.updatedAt,
  })

  if (error) throw new Error(error.message)
  return message
}

export async function updateMessage(messageId: string, updater: Partial<Message>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updater.status !== undefined) updates.status = updater.status
  if (updater.providerId !== undefined) updates.provider_id = updater.providerId
  if (updater.sentAt !== undefined) updates.sent_at = updater.sentAt
  if (updater.receivedAt !== undefined) updates.received_at = updater.receivedAt
  if (updater.createdAt !== undefined) updates.created_at = updater.createdAt
  if (updater.html !== undefined) updates.html = updater.html
  if (updater.text !== undefined) updates.text = updater.text
  if (updater.threadId !== undefined) updates.thread_id = updater.threadId

  const { data, error } = await supabase.from("messages").update(updates).eq("id", messageId).select().maybeSingle()

  if (error || !data) throw new Error("Message not found.")
  return mapMessage(data)
}

export async function findMessageByProviderId(providerId: string) {
  const { data } = await supabase.from("messages").select("*").eq("provider_id", providerId).maybeSingle()
  if (!data) return null
  return mapMessage(data)
}

export async function listMessages(workspaceId: string, direction?: Message["direction"]) {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (direction) {
    query = query.eq("direction", direction)
  }

  const { data } = await query
  const messages = (data || []).map(mapMessage)

  return messages.sort((a, b) => compareMessagesByTimestamp(a, b, "desc"))
}

function compareMessagesByTimestamp(a: Message, b: Message, order: "asc" | "desc") {
  const aTime = new Date(a.direction === "outbound" ? a.sentAt ?? a.createdAt : a.receivedAt ?? a.createdAt).getTime()
  const bTime = new Date(b.direction === "outbound" ? b.sentAt ?? b.createdAt : b.receivedAt ?? b.createdAt).getTime()
  const diff = aTime - bTime
  return order === "asc" ? diff : -diff
}

// ── Events ─────────────────────────────────────────────────

export async function createEvent(
  workspaceId: string,
  messageId: string,
  type: MessageEvent["type"],
  payload: Record<string, unknown>
) {
  const event: MessageEvent = {
    id: createToken("event"),
    workspaceId,
    messageId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("message_events").insert({
    id: event.id,
    workspace_id: event.workspaceId,
    message_id: event.messageId,
    type: event.type,
    payload: event.payload,
    created_at: event.createdAt,
  })

  if (error) throw new Error(error.message)
  return event
}

// ── Inbound idempotency ────────────────────────────────────

export async function hasInboundReceipt(externalId: string) {
  if (!externalId) return false
  const { data } = await supabase.from("inbound_receipts").select("external_id").eq("external_id", externalId).maybeSingle()
  return Boolean(data)
}

export async function recordInboundReceipt(externalId: string, messageId: string) {
  if (!externalId) return
  await supabase.from("inbound_receipts").insert({
    external_id: externalId,
    message_id: messageId,
    created_at: new Date().toISOString(),
  })
}

// ── Drafts ─────────────────────────────────────────────────

export async function upsertDraft(
  workspaceId: string,
  draft: Pick<Draft, "subject" | "to" | "cc" | "bcc" | "text"> & { id?: string; threadId?: string }
) {
  if (draft.id) {
    const { data: existing } = await supabase
      .from("drafts")
      .select("*")
      .eq("id", draft.id)
      .eq("workspace_id", workspaceId)
      .maybeSingle()

    if (existing) {
      const updatedAt = new Date().toISOString()
      await supabase
        .from("drafts")
        .update({
          subject: draft.subject,
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          text: draft.text,
          thread_id: draft.threadId,
          updated_at: updatedAt,
        })
        .eq("id", draft.id)

      return mapDraft({
        ...existing,
        subject: draft.subject,
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        text: draft.text,
        thread_id: draft.threadId,
        updated_at: updatedAt,
      })
    }
  }

  const item: Draft = {
    id: createToken("draft"),
    workspaceId,
    threadId: draft.threadId,
    subject: draft.subject,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    text: draft.text,
    updatedAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("drafts").insert({
    id: item.id,
    workspace_id: item.workspaceId,
    thread_id: item.threadId,
    subject: item.subject,
    to: item.to,
    cc: item.cc,
    bcc: item.bcc,
    text: item.text,
    updated_at: item.updatedAt,
  })

  if (error) throw new Error(error.message)
  return item
}

export async function deleteDraft(draftId: string) {
  await supabase.from("drafts").delete().eq("id", draftId)
}

export async function listDrafts(workspaceId: string) {
  const { data } = await supabase
    .from("drafts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })

  return (data || []).map(mapDraft)
}

// ── Stats ──────────────────────────────────────────────────

export async function getStats(workspaceId: string) {
  const { data: messages } = await supabase.from("messages").select("*").eq("workspace_id", workspaceId)

  const { data: events } = await supabase
    .from("message_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(8)

  const allMessages = (messages || []).map(mapMessage)
  const allEvents = (events || []).map(mapEvent)

  const countBy = (predicate: (m: Message) => boolean) => allMessages.filter(predicate).length

  const { data: drafts } = await supabase.from("drafts").select("id").eq("workspace_id", workspaceId)

  return {
    messages: allMessages.length,
    sent: countBy((m) => m.direction === "outbound"),
    inbox: countBy((m) => m.direction === "inbound"),
    drafts: drafts?.length ?? 0,
    failed: allMessages.filter((m) => m.status === "failed").length,
    delivered: allEvents.filter((e) => e.type === "delivered").length,
    opened: allEvents.filter((e) => e.type === "opened").length,
    clicked: allEvents.filter((e) => e.type === "clicked").length,
    replied: allMessages.filter((m) => m.inReplyTo).length,
    recentEvents: allEvents,
    avgResponseMinutes: computeAvgResponseMinutes(allMessages),
  }
}

function computeAvgResponseMinutes(messages: Message[]) {
  const byThread = new Map<string, Message[]>()
  for (const message of messages) {
    if (!message.threadId) continue
    const list = byThread.get(message.threadId) ?? []
    list.push(message)
    byThread.set(message.threadId, list)
  }

  const deltas: number[] = []
  for (const threadMessages of byThread.values()) {
    const sorted = [...threadMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const firstInbound = sorted.find((m) => m.direction === "inbound")
    const firstOutboundAfter = sorted.find(
      (m) => m.direction === "outbound" && firstInbound && m.createdAt > firstInbound.createdAt
    )
    if (firstInbound && firstOutboundAfter) {
      const ms = new Date(firstOutboundAfter.createdAt).getTime() - new Date(firstInbound.createdAt).getTime()
      if (ms > 0) deltas.push(ms / 60000)
    }
  }

  if (!deltas.length) return null
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
}

// ── Legacy JSON read (migration only) ─────────────────────

export async function readStore() {
  const { promises: fs } = await import("node:fs")
  const path = await import("node:path")
  const storePath = path.join(process.cwd(), ".data", "resend-panel.json")
  try {
    const raw = await fs.readFile(storePath, "utf8")
    return JSON.parse(raw) as {
      users: User[]
      workspaces: Workspace[]
      sessions: Session[]
      settings: ResendSettings | null
      threads: Thread[]
      messages: Message[]
      events: MessageEvent[]
      drafts: Draft[]
    }
  } catch {
    return {
      users: [],
      workspaces: [],
      sessions: [],
      settings: null,
      threads: [],
      messages: [],
      events: [],
      drafts: [],
    }
  }
}

// ── Mappers ────────────────────────────────────────────────

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    createdAt: row.created_at as string,
  }
}

function mapWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: row.id as string,
    name: row.name as string,
    ownerUserId: row.owner_user_id as string,
    createdAt: row.created_at as string,
  }
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
  }
}

function mapSettings(row: Record<string, unknown>): ResendSettings {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    tokenEncrypted: row.token_encrypted as string,
    fromName: row.from_name as string,
    fromEmail: row.from_email as string,
    inboundEmail: row.inbound_email as string,
    updatedAt: row.updated_at as string,
  }
}

function mapThread(row: Record<string, unknown>): Thread {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    subject: row.subject as string,
    participants: (row.participants as string[]) || [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastMessageAt: row.last_message_at as string,
  }
}

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    threadId: row.thread_id as string,
    direction: row.direction as Message["direction"],
    status: row.status as Message["status"],
    subject: row.subject as string,
    fromName: row.from_name as string,
    fromEmail: row.from_email as string,
    to: (row.to as string[]) || [],
    cc: (row.cc as string[]) || [],
    bcc: (row.bcc as string[]) || [],
    text: row.text as string,
    html: row.html as string,
    providerId: row.provider_id as string | undefined,
    inReplyTo: row.in_reply_to as string | undefined,
    references: (row.references_list as string[]) || [],
    sentAt: row.sent_at as string | undefined,
    receivedAt: row.received_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapEvent(row: Record<string, unknown>): MessageEvent {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    messageId: row.message_id as string,
    type: row.type as MessageEvent["type"],
    payload: (row.payload as Record<string, unknown>) || {},
    createdAt: row.created_at as string,
  }
}

function mapDraft(row: Record<string, unknown>): Draft {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    threadId: row.thread_id as string | undefined,
    subject: row.subject as string,
    to: row.to as string,
    cc: row.cc as string,
    bcc: row.bcc as string,
    text: row.text as string,
    updatedAt: row.updated_at as string,
  }
}
