'use server'

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import {
  clearSession,
  establishSession,
  getMailboxScope,
  registerOwner,
  requireAuthenticatedUser,
  requireCurrentUser,
  requireOwner,
  verifyLogin,
} from "@/lib/auth"
import {
  buildHtmlFromText,
  buildTextPreview,
  extractInboundPayload,
  fetchResendEmail,
  formatFromHeader,
  getReplyRecipients,
  getResendToken,
  normalizeRecipients,
  normalizeSubject,
  renderThreadSubject,
} from "@/lib/email"
import {
  encryptSecret,
  generateTemporaryPassword,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/crypto"
import {
  createEvent,
  createMailbox,
  createMessage,
  createUser,
  createWorkspaceForOwner,
  deleteDraft,
  deleteMailbox,
  deleteSessionsForUser,
  deleteUser,
  ensureThread,
  findMailboxByAddress,
  findMailboxById,
  findMessageByProviderId,
  findUserByEmail,
  findUserById,
  getBootstrapState,
  getCurrentSettings,
  getCurrentWorkspace,
  getThreadWithMessages,
  hasInboundReceipt,
  listMailboxes,
  listMailboxesForUser,
  recordInboundReceipt,
  setMailboxesForUser,
  setUserActive,
  updateMailbox,
  upsertDraft,
  updateMessage,
  updateResendSettings,
  updateUserPassword,
} from "@/lib/store"
import { mapResendEventType } from "@/lib/webhooks"
import { syncResendHistory } from "@/lib/resend-sync"
import type { AuthState, CreateUserState, Mailbox } from "@/lib/types"

function readField(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

async function requireAtLeastOneRecipient(to: string[]) {
  if (!to.length) {
    const t = await getTranslations("errors")
    throw new Error(t("addRecipient"))
  }
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const state = await getBootstrapState()
  if (state.hasUsers) {
    return { error: t("registrationClosed") }
  }

  const email = normalizeEmail(readField(formData, "email"))
  const password = readField(formData, "password")
  const confirmPassword = readField(formData, "confirmPassword")

  if (!email || !password) {
    return { error: t("emailPasswordRequired") }
  }

  if (password.length < 8) {
    return { error: t("passwordMinLength") }
  }

  if (password !== confirmPassword) {
    return { error: t("passwordsDoNotMatch") }
  }

  const user = await registerOwner(email, password)
  await createWorkspaceForOwner(user)

  await clearSession()
  await establishSession(user.id)
  redirect("/dashboard")
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const email = normalizeEmail(readField(formData, "email"))
  const password = readField(formData, "password")

  if (!email || !password) {
    return { error: t("emailPasswordRequired") }
  }

  const user = await verifyLogin(email, password)
  if (!user) {
    return { error: t("invalidCredentials") }
  }

  if (!user.isActive) {
    return { error: t("accountDeactivated") }
  }

  await clearSession()
  await establishSession(user.id)
  redirect(user.mustChangePassword ? "/change-password" : "/dashboard")
}

export async function changePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const user = await requireAuthenticatedUser()

  const currentPassword = readField(formData, "currentPassword")
  const password = readField(formData, "password")
  const confirmPassword = readField(formData, "confirmPassword")

  if (!currentPassword || !password) {
    return { error: t("emailPasswordRequired") }
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return { error: t("currentPasswordInvalid") }
  }

  if (password.length < 8) {
    return { error: t("passwordMinLength") }
  }

  if (password !== confirmPassword) {
    return { error: t("passwordsDoNotMatch") }
  }

  if (password === currentPassword) {
    return { error: t("passwordMustDiffer") }
  }

  await updateUserPassword(user.id, hashPassword(password), false)
  redirect("/dashboard")
}

export async function logoutAction() {
  await clearSession()
  redirect("/login")
}

export async function saveSettingsAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const user = await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const token = readField(formData, "resendToken")
  const fromName = readField(formData, "fromName") || "Resend Panel"
  const fromEmail = readField(formData, "fromEmail") || "onboarding@resend.dev"
  const inboundEmail = readField(formData, "inboundEmail") || `inbox@${workspace.id.slice(0, 8)}.local`

  const currentSettings = await getCurrentSettings()
  const settingsUpdate: Parameters<typeof updateResendSettings>[0] = {
    fromName,
    fromEmail,
    inboundEmail,
  }
  if (token) {
    settingsUpdate.tokenEncrypted = encryptSecret(token)
  } else if (currentSettings?.tokenEncrypted) {
    settingsUpdate.tokenEncrypted = currentSettings.tokenEncrypted
  }

  await updateResendSettings(settingsUpdate)

  revalidatePath("/settings")
  return { success: t("settingsSaved", { email: user.email }) }
}

export async function testResendConnectionAction(_prev: AuthState): Promise<AuthState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const settings = await getCurrentSettings()
  const token = getResendToken(settings?.tokenEncrypted)

  if (!token) {
    return { error: t("addResendToken") }
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null
      return { error: data?.message || t("connectionFailed", { status: response.status }) }
    }

    return { success: t("connectionVerified") }
  } catch (error) {
    const reason = error instanceof Error ? error.message : t("unknownError")
    return { error: reason }
  }
}

export async function syncResendHistoryAction(_prev: AuthState): Promise<AuthState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const settings = await getCurrentSettings()
  const token = getResendToken(settings?.tokenEncrypted)

  if (!token) {
    return { error: t("addResendToken") }
  }

  try {
    const result = await syncResendHistory(token)

    revalidatePath("/dashboard")
    revalidatePath("/sent")
    revalidatePath("/inbox")
    revalidatePath("/statistics")

    return {
      success: t("syncCompleted", {
        imported: result.imported,
        backfilled: result.backfilled,
        sent: result.sent,
        received: result.received,
      }),
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : t("unknownError")
    return { error: reason }
  }
}

async function sendMessage(
  workspaceId: string,
  settingsToken: string | null,
  settings: Awaited<ReturnType<typeof getCurrentSettings>>,
  mailbox: Mailbox,
  payload: {
    subject: string
    text: string
    to: string[]
    cc: string[]
    bcc: string[]
    threadId?: string
    replyToMessageId?: string
    references?: string[]
    attachmentIds?: string[]
  }
) {
  const t = await getTranslations("errors")
  const subject = normalizeSubject(payload.subject)
  const html = buildHtmlFromText(payload.text)
  // The sender comes from the selected mailbox, not from the workspace-wide settings.
  const fromName = mailbox.displayName.trim() || settings?.fromName || "Resend Panel"
  const fromEmail = mailbox.address
  const from = formatFromHeader(mailbox, settings?.fromName || "Resend Panel")

  const message = await createMessage({
    workspaceId,
    mailboxId: mailbox.id,
    threadId: payload.threadId || "",
    direction: "outbound",
    status: "queued",
    subject,
    fromName,
    fromEmail,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    text: buildTextPreview(payload.text),
    html,
    inReplyTo: payload.replyToMessageId,
    references: payload.references || (payload.replyToMessageId ? [payload.replyToMessageId] : []),
  })

  if (payload.attachmentIds?.length) {
    const { supabase } = await import("@/lib/supabase")
    for (const attId of payload.attachmentIds) {
      await supabase
        .from("attachments")
        .update({ message_id: message.id })
        .eq("id", attId)
    }
  }

  const attachments: Array<{ filename: string; content: string }> = []
  if (payload.attachmentIds?.length) {
    const { listAttachments, getAttachmentBuffer } = await import("@/lib/attachments")
    const atts = await listAttachments(message.id)
    for (const att of atts) {
      const buffer = await getAttachmentBuffer(att.storagePath)
      if (buffer) {
        const base64 = Buffer.from(buffer).toString("base64")
        attachments.push({
          filename: att.filename,
          content: base64,
        })
      }
    }
  }

  if (!settingsToken) {
    await updateMessage(message.id, { status: "failed" })
    await createEvent(workspaceId, message.id, "failed", { reason: t("resendTokenNotConfigured") })
    return { error: t("setResendTokenFirst") }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settingsToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        cc: payload.cc.length ? payload.cc : undefined,
        bcc: payload.bcc.length ? payload.bcc : undefined,
        subject,
        html,
        text: payload.text,
        reply_to: fromEmail,
        attachments: attachments.length ? attachments : undefined,
        headers: payload.replyToMessageId
          ? {
              "In-Reply-To": payload.replyToMessageId,
              References: payload.references?.join(" ") || payload.replyToMessageId,
            }
          : undefined,
      }),
    })

    const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!response.ok) {
      const reason = data?.message || t("connectionFailed", { status: response.status })
      await updateMessage(message.id, { status: "failed" })
      await createEvent(workspaceId, message.id, "failed", { reason })
      return { error: reason }
    }

    await updateMessage(message.id, {
      status: "sent",
      providerId: data?.id,
      sentAt: new Date().toISOString(),
    })
    await createEvent(workspaceId, message.id, "sent", { providerId: data?.id })

    return { success: t("messageSent"), messageId: message.id, threadId: payload.threadId }
  } catch (error) {
    const reason = error instanceof Error ? error.message : t("unknownError")
    await updateMessage(message.id, { status: "failed" })
    await createEvent(workspaceId, message.id, "failed", { reason })
    return { error: reason }
  }
}

export async function composeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  const settings = await getCurrentSettings()

  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const scope = await getMailboxScope(user, workspace.id)
  const intent = readField(formData, "intent") || "send"
  const subject = readField(formData, "subject")
  const text = readField(formData, "text")
  const to = normalizeRecipients(readField(formData, "to"))
  const cc = normalizeRecipients(readField(formData, "cc"))
  const bcc = normalizeRecipients(readField(formData, "bcc"))
  const threadId = readField(formData, "threadId") || undefined
  const replyToMessageId = readField(formData, "replyToMessageId") || undefined
  const draftId = readField(formData, "draftId") || undefined
  const mailboxId = readField(formData, "mailboxId")
  const attachmentIds = formData.getAll("attachmentIds") as string[]

  if (!subject && intent !== "save") {
    return { error: t("subjectRequired") }
  }

  if (!text) {
    return { error: t("messageBodyRequired") }
  }

  if (intent === "save") {
    await upsertDraft(workspace.id, user.id, { id: draftId, threadId, subject, to: to.join(", "), cc: cc.join(", "), bcc: bcc.join(", "), text })
    revalidatePath("/drafts")
    revalidatePath("/compose")
    return { success: t("draftSaved") }
  }

  // The mailbox is re-checked here: the select in the UI is only a convenience.
  const allowedMailboxes =
    user.role === "owner"
      ? await listMailboxes(workspace.id)
      : await listMailboxesForUser(workspace.id, user.id)

  if (!allowedMailboxes.length) {
    return { error: t("noMailboxAssigned") }
  }

  const mailbox = mailboxId
    ? allowedMailboxes.find((item) => item.id === mailboxId)
    : allowedMailboxes[0]

  if (!mailbox) {
    return { error: t("mailboxNotAllowed") }
  }

  let finalRecipients = to
  let finalSubject = subject
  let finalThreadId = threadId
  let replyTarget = replyToMessageId
  let references: string[] = []

  if (threadId) {
    const thread = await getThreadWithMessages(workspace.id, threadId, scope)
    if (!thread) {
      return { error: t("threadNotFound") }
    }

    finalSubject = `Re: ${renderThreadSubject(thread.thread.subject)}`
    if (!finalRecipients.length) {
      const latest = thread.messages[thread.messages.length - 1]
      if (latest) {
        finalRecipients = getReplyRecipients(latest)
      }
    }

    if (!replyTarget && thread.messages.length) {
      replyTarget = thread.messages[thread.messages.length - 1].id
    }
    finalThreadId = thread.thread.id
    const last = thread.messages[thread.messages.length - 1]
    references = last?.references?.length ? [...last.references] : replyTarget ? [replyTarget] : []
  } else {
    const participants = Array.from(new Set([mailbox.address, ...finalRecipients]))
    const thread = await ensureThread(workspace.id, finalSubject, participants, { mailboxId: mailbox.id })
    finalThreadId = thread.id
  }

  await requireAtLeastOneRecipient(finalRecipients)

  const settingsToken = getResendToken(settings?.tokenEncrypted)
  const result = await sendMessage(workspace.id, settingsToken, settings, mailbox, {
    subject: finalSubject,
    text,
    to: finalRecipients,
    cc,
    bcc,
    threadId: finalThreadId,
    replyToMessageId: replyTarget,
    references,
    attachmentIds,
  })

  if (result.error) {
    return { error: result.error }
  }

  if (draftId) {
    await deleteDraft(draftId, user.id)
  }

  revalidatePath("/dashboard")
  revalidatePath("/sent")
  revalidatePath("/inbox")
  revalidatePath("/statistics")
  if (finalThreadId) {
    revalidatePath(`/inbox/${finalThreadId}`)
  }

  redirect(finalThreadId ? `/inbox/${finalThreadId}` : "/sent")
}

export async function inboundWebhookAction(requestBody: unknown) {
  const t = await getTranslations("errors")
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    throw new Error(t("workspaceMissing"))
  }

  const payload = extractInboundPayload(requestBody)

  if (payload.messageId && (await hasInboundReceipt(payload.messageId))) {
    return { duplicate: true }
  }

  // Route the email to the mailbox it was addressed to. If none matches, it is stored
  // without a mailbox link, which makes it visible to the owner only.
  let mailbox: Mailbox | null = null
  for (const address of payload.toAddresses) {
    mailbox = await findMailboxByAddress(workspace.id, address)
    if (mailbox) break
  }

  const receivedAt = new Date().toISOString()
  const thread = await ensureThread(
    workspace.id,
    payload.subject,
    Array.from(new Set([payload.from, ...payload.to])),
    { messageAt: receivedAt, mailboxId: mailbox?.id }
  )

  // Fetch email content from Resend API if html/text are missing (webhook doesn't include body)
  let html = payload.html
  let text = payload.text
  if ((!html || !text) && payload.emailId) {
    console.log("[inbound] html/text empty, fetching from Resend API for email_id:", payload.emailId)
    const settings = await getCurrentSettings()
    const token = getResendToken(settings?.tokenEncrypted)
    if (token) {
      const emailData = await fetchResendEmail(payload.emailId, token)
      if (emailData) {
        html = html || emailData.html
        text = text || emailData.text
        console.log("[inbound] fetched from API - html:", html?.length || 0, "chars, text:", text?.length || 0, "chars")
      } else {
        console.log("[inbound] fetchResendEmail returned null")
      }
    } else {
      console.log("[inbound] no Resend token configured")
    }
  }

  const message = await createMessage({
    workspaceId: workspace.id,
    mailboxId: mailbox?.id,
    threadId: thread.id,
    direction: "inbound",
    status: "received",
    subject: payload.subject,
    fromName: payload.from,
    fromEmail: payload.from,
    to: payload.to,
    cc: [],
    bcc: [],
    text: text || payload.subject,
    html: html || buildHtmlFromText(text || payload.subject),
    receivedAt,
    inReplyTo: payload.inReplyTo || undefined,
    references: payload.references,
  })

  if (payload.messageId) {
    await recordInboundReceipt(payload.messageId, message.id)
  }

  await createEvent(workspace.id, message.id, "received", {
    messageId: payload.messageId,
    inReplyTo: payload.inReplyTo,
  })

  revalidatePath("/dashboard")
  revalidatePath("/inbox")
  revalidatePath("/statistics")

  return { received: true, messageId: message.id }
}

export async function resendEventWebhookAction(requestBody: unknown) {
  const t = await getTranslations("errors")
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    throw new Error(t("workspaceMissing"))
  }

  if (!requestBody || typeof requestBody !== "object") {
    throw new Error("Invalid event payload.")
  }

  const record = requestBody as Record<string, unknown>
  const type = String(record.type ?? "")
  const data = (record.data ?? record) as Record<string, unknown>
  const providerId = String(data.email_id ?? data.id ?? "")
  const mapped = mapResendEventType(type)

  if (!mapped || !providerId) {
    return { ignored: true }
  }

  const message = await findMessageByProviderId(providerId)
  if (!message) {
    return { ignored: true, reason: "message not found" }
  }

  await createEvent(workspace.id, message.id, mapped, { type, providerId, data })

  if (mapped === "delivered") {
    await updateMessage(message.id, { status: "delivered" })
  }

  revalidatePath("/statistics")
  revalidatePath("/dashboard")

  return { processed: true, type: mapped }
}

// ── User administration (owner only) ───────────────────────

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const email = normalizeEmail(readField(formData, "email"))
  if (!email) {
    return { error: t("emailRequired") }
  }

  if (await findUserByEmail(email)) {
    return { error: t("emailAlreadyExists") }
  }

  // The generated password is returned once and never stored in the clear.
  const temporaryPassword = generateTemporaryPassword()
  const user = await createUser(email, hashPassword(temporaryPassword), {
    role: "member",
    mustChangePassword: true,
  })

  const mailboxIds = formData.getAll("mailboxIds").map(String).filter(Boolean)
  if (mailboxIds.length) {
    const mailboxes = await listMailboxes(workspace.id)
    const allowed = mailboxIds.filter((id) => mailboxes.some((mailbox) => mailbox.id === id))
    await setMailboxesForUser(user.id, allowed)
  }

  revalidatePath("/users")
  return { success: t("userCreated", { email }), createdEmail: email, temporaryPassword }
}

export async function assignMailboxesAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const userId = readField(formData, "userId")
  const user = userId ? await findUserById(userId) : null
  if (!user) {
    return { error: t("userNotFound") }
  }

  const mailboxes = await listMailboxes(workspace.id)
  const mailboxIds = formData
    .getAll("mailboxIds")
    .map(String)
    .filter((id) => mailboxes.some((mailbox) => mailbox.id === id))

  await setMailboxesForUser(user.id, mailboxIds)

  revalidatePath("/users")
  return { success: t("mailboxesAssigned", { email: user.email }) }
}

export async function setUserActiveAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const owner = await requireOwner()

  const userId = readField(formData, "userId")
  const isActive = readField(formData, "isActive") === "true"
  const user = userId ? await findUserById(userId) : null

  if (!user) {
    return { error: t("userNotFound") }
  }

  if (user.id === owner.id) {
    return { error: t("cannotModifyOwner") }
  }

  // Deactivating drops the account's sessions, so an open tab stops working immediately.
  await setUserActive(user.id, isActive)

  revalidatePath("/users")
  return { success: isActive ? t("userActivated", { email: user.email }) : t("userDeactivated", { email: user.email }) }
}

export async function deleteUserAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const owner = await requireOwner()

  const userId = readField(formData, "userId")
  const user = userId ? await findUserById(userId) : null

  if (!user) {
    return { error: t("userNotFound") }
  }

  if (user.id === owner.id) {
    return { error: t("cannotModifyOwner") }
  }

  await deleteSessionsForUser(user.id)
  await deleteUser(user.id)

  revalidatePath("/users")
  return { success: t("userDeleted", { email: user.email }) }
}

// ── Mailbox administration (owner only) ────────────────────

export async function createMailboxAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const address = normalizeEmail(readField(formData, "address"))
  const displayName = readField(formData, "displayName")

  if (!address || !address.includes("@")) {
    return { error: t("mailboxAddressInvalid") }
  }

  if (await findMailboxByAddress(workspace.id, address)) {
    return { error: t("mailboxExists") }
  }

  await createMailbox(workspace.id, address, displayName)

  revalidatePath("/mailboxes")
  revalidatePath("/users")
  return { success: t("mailboxCreated", { address }) }
}

export async function updateMailboxAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const mailboxId = readField(formData, "mailboxId")
  const displayName = readField(formData, "displayName")
  const mailbox = mailboxId ? await findMailboxById(workspace.id, mailboxId) : null

  if (!mailbox) {
    return { error: t("mailboxNotFound") }
  }

  await updateMailbox(mailbox.id, displayName)

  revalidatePath("/mailboxes")
  revalidatePath("/users")
  return { success: t("mailboxUpdated", { address: mailbox.address }) }
}

export async function deleteMailboxAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const mailboxId = readField(formData, "mailboxId")
  const mailbox = mailboxId ? await findMailboxById(workspace.id, mailboxId) : null

  if (!mailbox) {
    return { error: t("mailboxNotFound") }
  }

  // Mail is kept: the foreign keys null the link, so those threads and messages
  // fall back to being readable by the owner only.
  await deleteMailbox(mailbox.id)

  revalidatePath("/mailboxes")
  revalidatePath("/users")
  revalidatePath("/inbox")
  revalidatePath("/sent")
  return { success: t("mailboxDeleted", { address: mailbox.address }) }
}
