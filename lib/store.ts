import { createToken } from "@/lib/crypto"
import { supabase } from "@/lib/supabase"
import type {
  Draft,
  Mailbox,
  MailboxScope,
  ManagedUser,
  Message,
  MessageEvent,
  ResendSettings,
  Session,
  Thread,
  User,
  UserRole,
  Workspace,
} from "@/lib/types"

/** Reads with no scope argument stay unrestricted, which keeps the owner paths unchanged. */
const ALL_MAILBOXES: MailboxScope = { kind: "all" }

/**
 * The single place that decides which mailboxes a read may touch. Returns the id
 * list to filter on, or `null` for unrestricted access. An empty list yields an
 * empty result, and `mailbox_id is null` never matches `in(...)`, so mail with no
 * mailbox link stays owner-only without a second condition.
 */
function mailboxFilter(scope: MailboxScope = ALL_MAILBOXES) {
  return scope.kind === "all" ? null : scope.mailboxIds
}

function isInScope(mailboxId: string | undefined, scope: MailboxScope = ALL_MAILBOXES) {
  const allowed = mailboxFilter(scope)
  if (!allowed) return true
  return Boolean(mailboxId) && allowed.includes(mailboxId as string)
}

// ── Bootstrap ──────────────────────────────────────────────

export async function getBootstrapState() {
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
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

export async function createUser(
  email: string,
  passwordHash: string,
  options?: { role?: UserRole; mustChangePassword?: boolean }
) {
  const user: User = {
    id: createToken("user"),
    email,
    passwordHash,
    role: options?.role ?? "member",
    isActive: true,
    mustChangePassword: options?.mustChangePassword ?? false,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("users").insert({
    id: user.id,
    email: user.email,
    password_hash: user.passwordHash,
    role: user.role,
    is_active: user.isActive,
    must_change_password: user.mustChangePassword,
    created_at: user.createdAt,
  })

  if (error) throw new Error(error.message)
  return user
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: true })
  const { data: links } = await supabase.from("mailbox_users").select("mailbox_id, user_id")
  const { data: mailboxes } = await supabase.from("mailboxes").select("*")

  const mailboxById = new Map((mailboxes || []).map((row) => [row.id as string, mapMailbox(row)]))
  const mailboxesByUser = new Map<string, Mailbox[]>()

  for (const link of links || []) {
    const mailbox = mailboxById.get(link.mailbox_id as string)
    if (!mailbox) continue
    const list = mailboxesByUser.get(link.user_id as string) ?? []
    list.push(mailbox)
    mailboxesByUser.set(link.user_id as string, list)
  }

  return (users || []).map((row) => {
    const user = mapUser(row)
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
      mailboxes: (mailboxesByUser.get(user.id) ?? []).sort((a, b) => a.address.localeCompare(b.address)),
    }
  })
}

export async function setUserActive(userId: string, isActive: boolean) {
  const { error } = await supabase.from("users").update({ is_active: isActive }).eq("id", userId)
  if (error) throw new Error(error.message)
  if (!isActive) {
    await deleteSessionsForUser(userId)
  }
}

export async function updateUserPassword(userId: string, passwordHash: string, mustChangePassword: boolean) {
  const { error } = await supabase
    .from("users")
    .update({ password_hash: passwordHash, must_change_password: mustChangePassword })
    .eq("id", userId)

  if (error) throw new Error(error.message)
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.from("users").delete().eq("id", userId)
  if (error) throw new Error(error.message)
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

  const defaultFromName = "Resend Panel"
  const defaultFromEmail = "onboarding@resend.dev"

  const { error: settingsError } = await supabase.from("resend_settings").insert({
    id: createToken("settings"),
    workspace_id: workspace.id,
    token_encrypted: "",
    from_name: defaultFromName,
    from_email: defaultFromEmail,
    inbound_email: `inbox@${workspace.id.slice(0, 8)}.local`,
    updated_at: new Date().toISOString(),
  })

  if (settingsError) throw new Error(settingsError.message)

  // A new workspace ships with one mailbox owned by the owner, so composing works
  // immediately, exactly as it did before mailboxes existed.
  const mailbox = await createMailbox(workspace.id, defaultFromEmail, defaultFromName)
  await setMailboxesForUser(owner.id, [mailbox.id])

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

export async function deleteSessionsForUser(userId: string) {
  await supabase.from("sessions").delete().eq("user_id", userId)
}

// ── Mailboxes ──────────────────────────────────────────────

export async function listMailboxes(workspaceId: string) {
  const { data } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("address", { ascending: true })

  return (data || []).map(mapMailbox)
}

export async function listMailboxesForUser(workspaceId: string, userId: string) {
  const { data: links } = await supabase.from("mailbox_users").select("mailbox_id").eq("user_id", userId)
  const mailboxIds = (links || []).map((row) => row.mailbox_id as string)
  if (!mailboxIds.length) return []

  const { data } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("id", mailboxIds)
    .order("address", { ascending: true })

  return (data || []).map(mapMailbox)
}

export async function findMailboxById(workspaceId: string, mailboxId: string) {
  const { data } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", mailboxId)
    .maybeSingle()

  if (!data) return null
  return mapMailbox(data)
}

export async function findMailboxByAddress(workspaceId: string, address: string) {
  const { data } = await supabase
    .from("mailboxes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .ilike("address", address)
    .maybeSingle()

  if (!data) return null
  return mapMailbox(data)
}

export async function createMailbox(workspaceId: string, address: string, displayName: string) {
  const mailbox: Mailbox = {
    id: createToken("mbx"),
    workspaceId,
    address,
    displayName,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("mailboxes").insert({
    id: mailbox.id,
    workspace_id: mailbox.workspaceId,
    address: mailbox.address,
    display_name: mailbox.displayName,
    created_at: mailbox.createdAt,
  })

  if (error) throw new Error(error.message)
  return mailbox
}

export async function updateMailbox(mailboxId: string, displayName: string) {
  const { error } = await supabase.from("mailboxes").update({ display_name: displayName }).eq("id", mailboxId)
  if (error) throw new Error(error.message)
}

/**
 * Deleting a mailbox keeps its mail: the `on delete set null` foreign key drops the
 * link, so those threads and messages fall back to being visible to the owner only.
 */
export async function deleteMailbox(mailboxId: string) {
  const { error } = await supabase.from("mailboxes").delete().eq("id", mailboxId)
  if (error) throw new Error(error.message)
}

export async function setMailboxesForUser(userId: string, mailboxIds: string[]) {
  const { error: deleteError } = await supabase.from("mailbox_users").delete().eq("user_id", userId)
  if (deleteError) throw new Error(deleteError.message)

  if (!mailboxIds.length) return

  const now = new Date().toISOString()
  const { error } = await supabase.from("mailbox_users").insert(
    mailboxIds.map((mailboxId) => ({
      mailbox_id: mailboxId,
      user_id: userId,
      created_at: now,
    }))
  )

  if (error) throw new Error(error.message)
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
  options?: { messageAt?: string; mailboxId?: string }
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
    // A thread keeps the first mailbox it was linked to; only fill an empty link.
    const mailboxId = (existing.mailbox_id as string | null) ?? options?.mailboxId ?? null
    await supabase
      .from("threads")
      .update({
        participants: mergedParticipants,
        updated_at: now,
        last_message_at: lastMessageAt,
        mailbox_id: mailboxId,
      })
      .eq("id", existing.id)

    return mapThread({
      ...existing,
      participants: mergedParticipants,
      updated_at: now,
      last_message_at: lastMessageAt,
      mailbox_id: mailboxId,
    })
  }

  const initialAt = messageAt ?? new Date().toISOString()
  const thread: Thread = {
    id: createToken("thread"),
    workspaceId,
    mailboxId: options?.mailboxId,
    subject: normalizedSubject,
    participants: uniqueParticipants,
    createdAt: initialAt,
    updatedAt: initialAt,
    lastMessageAt: initialAt,
  }

  const { error } = await supabase.from("threads").insert({
    id: thread.id,
    workspace_id: thread.workspaceId,
    mailbox_id: thread.mailboxId ?? null,
    subject: thread.subject,
    participants: thread.participants,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    last_message_at: thread.lastMessageAt,
  })

  if (error) throw new Error(error.message)
  return thread
}

export async function listThreads(workspaceId: string, scope?: MailboxScope) {
  let query = supabase.from("threads").select("*").eq("workspace_id", workspaceId)

  const allowed = mailboxFilter(scope)
  if (allowed) query = query.in("mailbox_id", allowed)

  const { data } = await query.order("last_message_at", { ascending: false })

  return (data || []).map(mapThread)
}

// Previews are scoped per message rather than per thread: a member never reads
// preview text from a mailbox they do not own, even inside a thread they can open.
export async function getThreadPreviews(workspaceId: string, scope?: MailboxScope) {
  let query = supabase
    .from("messages")
    .select("thread_id, text, from_email")
    .eq("workspace_id", workspaceId)

  const allowed = mailboxFilter(scope)
  if (allowed) query = query.in("mailbox_id", allowed)

  const { data } = await query.order("created_at", { ascending: false })

  const previews: Record<string, { text: string; fromEmail: string }> = {}

  for (const row of data || []) {
    const threadId = row.thread_id as string
    if (previews[threadId]) continue
    previews[threadId] = {
      text: (row.text as string).replace(/\s+/g, " ").trim(),
      fromEmail: row.from_email as string,
    }
  }

  return previews
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

/**
 * Access to a thread is decided by the thread's own mailbox link. Messages inside an
 * accessible thread are returned in full, so a reply sent from another mailbox stays
 * visible in the conversation it belongs to.
 */
export async function getThreadWithMessages(workspaceId: string, threadId: string, scope?: MailboxScope) {
  const { data: threadData } = await supabase
    .from("threads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", threadId)
    .maybeSingle()

  if (!threadData) return null
  if (!isInScope((threadData.mailbox_id as string | null) ?? undefined, scope)) return null

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
    mailbox_id: message.mailboxId ?? null,
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

export async function listMessages(
  workspaceId: string,
  direction?: Message["direction"],
  scope?: MailboxScope
) {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (direction) {
    query = query.eq("direction", direction)
  }

  const allowed = mailboxFilter(scope)
  if (allowed) query = query.in("mailbox_id", allowed)

  const { data } = await query
  const messages = (data || []).map(mapMessage)

  return messages.sort((a, b) => compareMessagesByTimestamp(a, b, "desc"))
}

export async function getMessage(workspaceId: string, messageId: string, scope?: MailboxScope) {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", messageId)
    .maybeSingle()

  if (!data) return null

  const message = mapMessage(data)
  if (!isInScope(message.mailboxId, scope)) return null

  return message
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
  userId: string,
  draft: Pick<Draft, "subject" | "to" | "cc" | "bcc" | "text"> & { id?: string; threadId?: string }
) {
  if (draft.id) {
    const { data: existing } = await supabase
      .from("drafts")
      .select("*")
      .eq("id", draft.id)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
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
    userId,
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
    user_id: item.userId,
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

export async function deleteDraft(draftId: string, userId: string) {
  await supabase.from("drafts").delete().eq("id", draftId).eq("user_id", userId)
}

// Drafts are private to the author, not shared across the workspace.
export async function listDrafts(workspaceId: string, userId: string) {
  const { data } = await supabase
    .from("drafts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  return (data || []).map(mapDraft)
}

// ── Stats ──────────────────────────────────────────────────

export async function getStats(workspaceId: string, userId: string, scope?: MailboxScope) {
  let messagesQuery = supabase.from("messages").select("*").eq("workspace_id", workspaceId)

  const allowed = mailboxFilter(scope)
  if (allowed) messagesQuery = messagesQuery.in("mailbox_id", allowed)

  const { data: messages } = await messagesQuery
  const allMessages = (messages || []).map(mapMessage)

  let eventsQuery = supabase
    .from("message_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(8)

  // Events carry no mailbox of their own, so restrict them to the messages in scope.
  if (allowed) eventsQuery = eventsQuery.in("message_id", allMessages.map((message) => message.id))

  const { data: events } = await eventsQuery
  const allEvents = (events || []).map(mapEvent)

  const countBy = (predicate: (m: Message) => boolean) => allMessages.filter(predicate).length

  const { data: drafts } = await supabase
    .from("drafts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)

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
    role: (row.role as UserRole) ?? "member",
    isActive: (row.is_active as boolean) ?? true,
    mustChangePassword: (row.must_change_password as boolean) ?? false,
    createdAt: row.created_at as string,
  }
}

function mapMailbox(row: Record<string, unknown>): Mailbox {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    address: row.address as string,
    displayName: (row.display_name as string) ?? "",
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
    mailboxId: (row.mailbox_id as string | null) ?? undefined,
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
    mailboxId: (row.mailbox_id as string | null) ?? undefined,
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
    userId: (row.user_id as string | null) ?? undefined,
    threadId: row.thread_id as string | undefined,
    subject: row.subject as string,
    to: row.to as string,
    cc: row.cc as string,
    bcc: row.bcc as string,
    text: row.text as string,
    updatedAt: row.updated_at as string,
  }
}
