'use server'

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { clearSession, establishSession, registerOwner, requireCurrentUser, verifyLogin } from "@/lib/auth"
import {
  buildHtmlFromText,
  buildTextPreview,
  extractInboundPayload,
  getReplyRecipients,
  getResendToken,
  normalizeRecipients,
  normalizeSubject,
  renderThreadSubject,
} from "@/lib/email"
import { encryptSecret, normalizeEmail } from "@/lib/crypto"
import {
  createEvent,
  createMessage,
  createWorkspaceForOwner,
  deleteDraft,
  ensureThread,
  findMessageByProviderId,
  getBootstrapState,
  getCurrentSettings,
  getCurrentWorkspace,
  getThreadWithMessages,
  hasInboundReceipt,
  recordInboundReceipt,
  upsertDraft,
  updateMessage,
  updateResendSettings,
} from "@/lib/store"
import { mapResendEventType } from "@/lib/webhooks"
import { syncResendHistory } from "@/lib/resend-sync"
import type { AuthState } from "@/lib/types"

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

  await clearSession()
  await establishSession(user.id)
  redirect("/dashboard")
}

export async function logoutAction() {
  await clearSession()
  redirect("/login")
}

export async function saveSettingsAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const t = await getTranslations("errors")
  const user = await requireCurrentUser()
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
  await requireCurrentUser()
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
  await requireCurrentUser()
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
  const fromName = settings?.fromName || "Resend Panel"
  const fromEmail = settings?.fromEmail || "onboarding@resend.dev"
  const from = `${fromName} <${fromEmail}>`

  const message = await createMessage({
    workspaceId,
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
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  const settings = await getCurrentSettings()

  if (!workspace) {
    return { error: t("workspaceMissing") }
  }

  const intent = readField(formData, "intent") || "send"
  const subject = readField(formData, "subject")
  const text = readField(formData, "text")
  const to = normalizeRecipients(readField(formData, "to"))
  const cc = normalizeRecipients(readField(formData, "cc"))
  const bcc = normalizeRecipients(readField(formData, "bcc"))
  const threadId = readField(formData, "threadId") || undefined
  const replyToMessageId = readField(formData, "replyToMessageId") || undefined
  const draftId = readField(formData, "draftId") || undefined
  const attachmentIds = formData.getAll("attachmentIds") as string[]

  if (!subject && intent !== "save") {
    return { error: t("subjectRequired") }
  }

  if (!text) {
    return { error: t("messageBodyRequired") }
  }

  if (intent === "save") {
    await upsertDraft(workspace.id, { id: draftId, threadId, subject, to: to.join(", "), cc: cc.join(", "), bcc: bcc.join(", "), text })
    revalidatePath("/drafts")
    revalidatePath("/compose")
    return { success: t("draftSaved") }
  }

  let finalRecipients = to
  let finalSubject = subject
  let finalThreadId = threadId
  let replyTarget = replyToMessageId
  let references: string[] = []

  if (threadId) {
    const thread = await getThreadWithMessages(workspace.id, threadId)
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
    const participants = Array.from(new Set([...(settings?.fromEmail ? [settings.fromEmail] : []), ...finalRecipients]))
    const thread = await ensureThread(workspace.id, finalSubject, participants)
    finalThreadId = thread.id
  }

  await requireAtLeastOneRecipient(finalRecipients)

  const settingsToken = getResendToken(settings?.tokenEncrypted)
  const result = await sendMessage(workspace.id, settingsToken, settings, {
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
    await deleteDraft(draftId)
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

  const receivedAt = new Date().toISOString()
  const thread = await ensureThread(
    workspace.id,
    payload.subject,
    Array.from(new Set([payload.from, ...payload.to])),
    { messageAt: receivedAt }
  )

  const message = await createMessage({
    workspaceId: workspace.id,
    threadId: thread.id,
    direction: "inbound",
    status: "received",
    subject: payload.subject,
    fromName: payload.from,
    fromEmail: payload.from,
    to: payload.to,
    cc: [],
    bcc: [],
    text: payload.text || payload.html,
    html: payload.html || buildHtmlFromText(payload.text || payload.subject),
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
