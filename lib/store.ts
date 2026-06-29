import { getSupabase } from "@/lib/supabase"
import { createToken } from "@/lib/crypto"
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
  const { data: users } = await getSupabase().from("users").select("id").limit(1)
  const { data: workspaces } = await getSupabase().from("workspaces").select("id").limit(1)

  return {
    hasUsers: (users?.length ?? 0) > 0,
    hasWorkspace: (workspaces?.length ?? 0) > 0,
    owner: null as User | null,
    workspace: null as Workspace | null,
  }
}

// ── Users ──────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  const { data } = await getSupabase().from("users").select("*").eq("email", email).single()
  if (!data) return null
  return mapUser(data)
}

export async function findUserById(userId: string) {
  const { data } = await getSupabase().from("users").select("*").eq("id", userId).single()
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

  await getSupabase().from("users").insert({
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
  })

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

  await getSupabase().from("workspaces").insert({
    id: workspace.id,
    name: workspace.name,
    owner_user_id: workspace.ownerUserId,
    created_at: workspace.createdAt,
  })

  await getSupabase().from("resend_settings").insert({
    id: createToken("settings"),
    workspace_id: workspace.id,
    token_encrypted: "",
    from_name: "Resend Panel",
    from_email: "onboarding@resend.dev",
    inbound_email: `inbox@${workspace.id.slice(0, 8)}.local`,
    updated_at: new Date().toISOString(),
  })

  return workspace
}

export async function getCurrentWorkspace() {
  const { data } = await getSupabase().from("workspaces").select("*").limit(1).single()
  if (!data) return null
  return mapWorkspace(data)
}

// ── Sessions ───────────────────────────────────────────────

export async function createSession(userId: string) {
  await getSupabase().from("sessions").delete().eq("user_id", userId)

  const session: Session = {
    id: createToken("session"),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  }

  await getSupabase().from("sessions").insert({
    id: session.id,
    user_id: session.userId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
  })

  return session
}

export async function findSession(sessionToken: string) {
  const { data } = await getSupabase().from("sessions").select("*").eq("id", sessionToken).single()
  if (!data) return null
  return mapSession(data)
}

export async function revokeSession(sessionId: string) {
  await getSupabase().from("sessions").delete().eq("id", sessionId)
}

// ── Settings ───────────────────────────────────────────────

export async function getCurrentSettings() {
  const { data } = await getSupabase().from("resend_settings").select("*").limit(1).single()
  if (!data) return null
  return mapSettings(data)
}

export async function updateResendSettings(
  updater: Partial<Pick<ResendSettings, "tokenEncrypted" | "fromName" | "fromEmail" | "inboundEmail">>
) {
  const { data: current } = await getSupabase().from("resend_settings").select("*").limit(1).single()
  if (!current) throw new Error("Workspace settings are missing.")

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updater.tokenEncrypted !== undefined) updates.token_encrypted = updater.tokenEncrypted
  if (updater.fromName !== undefined) updates.from_name = updater.fromName
  if (updater.fromEmail !== undefined) updates.from_email = updater.fromEmail
  if (updater.inboundEmail !== undefined) updates.inbound_email = updater.inboundEmail

  await getSupabase().from("resend_settings").update(updates).eq("id", current.id)

  return mapSettings({ ...current, ...updates })
}

// ── Threads ────────────────────────────────────────────────

export async function ensureThread(workspaceId: string, subject: string, participants: string[]) {
  const normalizedSubject = subject.trim() || "No subject"
  const uniqueParticipants = Array.from(new Set(participants))

  const { data: existing } = await getSupabase()
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .ilike("subject", normalizedSubject)
    .single()

  if (existing) {
    const mergedParticipants = Array.from(new Set([...(existing.participants || []), ...uniqueParticipants]))
    await getSupabase()
      .from("threads")
      .update({
        participants: mergedParticipants,
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    return mapThread({ ...existing, participants: mergedParticipants, updated_at: new Date().toISOString(), last_message_at: new Date().toISOString() })
  }

  const thread: Thread = {
    id: createToken("thread"),
    workspaceId,
    subject: normalizedSubject,
    participants: uniqueParticipants,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  }

  await getSupabase().from("threads").insert({
    id: thread.id,
    workspace_id: thread.workspaceId,
    subject: thread.subject,
    participants: thread.participants,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    last_message_at: thread.lastMessageAt,
  })

  return thread
}

export async function listThreads(workspaceId: string) {
  const { data } = await getSupabase()
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false })

  return (data || []).map(mapThread)
}

export async function getThreadWithMessages(workspaceId: string, threadId: string) {
  const { data: threadData } = await getSupabase()
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", threadId)
    .single()

  if (!threadData) return null

  const { data: messagesData } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })

  return {
    thread: mapThread(threadData),
    messages: (messagesData || []).map(mapMessage),
  }
}

// ── Messages ───────────────────────────────────────────────

export async function createMessage(
  payload: Omit<Message, "id" | "createdAt" | "updatedAt"> & { id?: string }
) {
  const message: Message = {
    id: payload.id ?? createToken("message"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...payload,
  }

  await getSupabase().from("messages").insert({
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

  return message
}

export async function updateMessage(messageId: string, updater: Partial<Message>) {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (updater.status !== undefined) updates.status = updater.status
  if (updater.providerId !== undefined) updates.provider_id = updater.providerId
  if (updater.sentAt !== undefined) updates.sent_at = updater.sentAt
  if (updater.html !== undefined) updates.html = updater.html
  if (updater.text !== undefined) updates.text = updater.text

  const { data, error } = await getSupabase()
    .from("messages")
    .update(updates)
    .eq("id", messageId)
    .select()
    .single()

  if (error || !data) throw new Error("Message not found.")
  return mapMessage(data)
}

export async function listMessages(workspaceId: string, direction?: Message["direction"]) {
  let query = getSupabase()
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (direction) {
    query = query.eq("direction", direction)
  }

  const { data } = await query
  return (data || []).map(mapMessage)
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

  await getSupabase().from("message_events").insert({
    id: event.id,
    workspace_id: event.workspaceId,
    message_id: event.messageId,
    type: event.type,
    payload: event.payload,
    created_at: event.createdAt,
  })

  return event
}

// ── Drafts ─────────────────────────────────────────────────

export async function upsertDraft(
  workspaceId: string,
  draft: Pick<Draft, "subject" | "to" | "cc" | "bcc" | "text"> & { id?: string; threadId?: string }
) {
  if (draft.id) {
    const { data: existing } = await getSupabase()
      .from("drafts")
      .select("*")
      .eq("id", draft.id)
      .eq("workspace_id", workspaceId)
      .single()

    if (existing) {
      await getSupabase()
        .from("drafts")
        .update({
          subject: draft.subject,
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          text: draft.text,
          thread_id: draft.threadId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", draft.id)

      return mapDraft({ ...existing, subject: draft.subject, to: draft.to, cc: draft.cc, bcc: draft.bcc, text: draft.text, thread_id: draft.threadId, updated_at: new Date().toISOString() })
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

  await getSupabase().from("drafts").insert({
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

  return item
}

export async function deleteDraft(draftId: string) {
  await getSupabase().from("drafts").delete().eq("id", draftId)
}

export async function listDrafts(workspaceId: string) {
  const { data } = await getSupabase()
    .from("drafts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })

  return (data || []).map(mapDraft)
}

// ── Stats ──────────────────────────────────────────────────

export async function getStats(workspaceId: string) {
  const { data: messages } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)

  const { data: events } = await getSupabase()
    .from("message_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(8)

  const allMessages = (messages || []).map(mapMessage)
  const allEvents = (events || []).map(mapEvent)

  const countBy = (predicate: (m: Message) => boolean) => allMessages.filter(predicate).length

  return {
    messages: allMessages.length,
    sent: countBy((m) => m.direction === "outbound"),
    inbox: countBy((m) => m.direction === "inbound"),
    drafts: (await listDrafts(workspaceId)).length,
    failed: allMessages.filter((m) => m.status === "failed").length,
    delivered: allEvents.filter((e) => e.type === "delivered").length,
    opened: allEvents.filter((e) => e.type === "opened").length,
    clicked: allEvents.filter((e) => e.type === "clicked").length,
    replied: allMessages.filter((m) => m.inReplyTo).length,
    recentEvents: allEvents,
  }
}

// ── Mappers (snake_case → camelCase) ──────────────────────

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  }
}

function mapWorkspace(row: any): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
  }
}

function mapSession(row: any): Session {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

function mapSettings(row: any): ResendSettings {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    tokenEncrypted: row.token_encrypted,
    fromName: row.from_name,
    fromEmail: row.from_email,
    inboundEmail: row.inbound_email,
    updatedAt: row.updated_at,
  }
}

function mapThread(row: any): Thread {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    subject: row.subject,
    participants: row.participants || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
  }
}

function mapMessage(row: any): Message {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    threadId: row.thread_id,
    direction: row.direction,
    status: row.status,
    subject: row.subject,
    fromName: row.from_name,
    fromEmail: row.from_email,
    to: row.to || [],
    cc: row.cc || [],
    bcc: row.bcc || [],
    text: row.text,
    html: row.html,
    providerId: row.provider_id,
    inReplyTo: row.in_reply_to,
    references: row.references_list || [],
    sentAt: row.sent_at,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: any): MessageEvent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    messageId: row.message_id,
    type: row.type,
    payload: row.payload || {},
    createdAt: row.created_at,
  }
}

function mapDraft(row: any): Draft {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    threadId: row.thread_id,
    subject: row.subject,
    to: row.to,
    cc: row.cc,
    bcc: row.bcc,
    text: row.text,
    updatedAt: row.updated_at,
  }
}
