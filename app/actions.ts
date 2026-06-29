'use server'

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
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
  deleteDraft,
  ensureThread,
  getBootstrapState,
  getCurrentSettings,
  getCurrentWorkspace,
  getThreadWithMessages,
  listMessages,
  listDrafts,
  upsertDraft,
  updateMessage,
  updateResendSettings,
} from "@/lib/store"
import type { AuthState } from "@/lib/types"

function readField(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function requireAtLeastOneRecipient(to: string[]) {
  if (!to.length) {
    throw new Error("Add at least one recipient.")
  }
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const state = await getBootstrapState()
  if (state.hasUsers) {
    return { error: "Registration is closed after the first account is created." }
  }

  const email = normalizeEmail(readField(formData, "email"))
  const password = readField(formData, "password")
  const confirmPassword = readField(formData, "confirmPassword")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  const user = await registerOwner(email, password)
  await createMessage({
    workspaceId: state.workspace?.id || "",
    threadId: "",
    direction: "outbound",
    status: "draft",
    subject: "Welcome",
    fromName: "Resend Panel",
    fromEmail: "onboarding@resend.dev",
    to: [email],
    cc: [],
    bcc: [],
    text: "Welcome to Resend Panel",
    html: buildHtmlFromText("Welcome to Resend Panel"),
  }).catch(() => null)

  if (state.workspace) {
    // no-op: registration will create workspace below if absent
  }

  await clearSession()
  await establishSession(user.id)
  await createMessage({
    workspaceId: state.workspace?.id || "",
    threadId: "",
    direction: "inbound",
    status: "received",
    subject: "Welcome",
    fromName: "Resend Panel",
    fromEmail: "onboarding@resend.dev",
    to: [email],
    cc: [],
    bcc: [],
    text: "Your workspace is ready.",
    html: buildHtmlFromText("Your workspace is ready."),
  }).catch(() => null)
  redirect("/dashboard")
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(readField(formData, "email"))
  const password = readField(formData, "password")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const user = await verifyLogin(email, password)
  if (!user) {
    return { error: "Invalid email or password." }
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
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    return { error: "Workspace is missing." }
  }

  const token = readField(formData, "resendToken")
  const fromName = readField(formData, "fromName") || "Resend Panel"
  const fromEmail = readField(formData, "fromEmail") || "onboarding@resend.dev"
  const inboundEmail = readField(formData, "inboundEmail") || `inbox@${workspace.id.slice(0, 8)}.local`

  await updateResendSettings({
    tokenEncrypted: token ? encryptSecret(token) : "",
    fromName,
    fromEmail,
    inboundEmail,
  })

  revalidatePath("/settings")
  return { success: `Settings saved for ${user.email}.` }
}

async function sendMessage(
  workspaceId: string,
  settingsToken: string | null,
  payload: {
    subject: string
    text: string
    to: string[]
    cc: string[]
    bcc: string[]
    threadId?: string
    replyToMessageId?: string
  }
) {
  const subject = normalizeSubject(payload.subject)
  const html = buildHtmlFromText(payload.text)
  const message = await createMessage({
    workspaceId,
    threadId: payload.threadId || "",
    direction: "outbound",
    status: "queued",
    subject,
    fromName: "Resend Panel",
    fromEmail: "onboarding@resend.dev",
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    text: buildTextPreview(payload.text),
    html,
    inReplyTo: payload.replyToMessageId,
    references: payload.replyToMessageId ? [payload.replyToMessageId] : [],
  })

  if (!settingsToken) {
    await updateMessage(message.id, { status: "failed" })
    await createEvent(workspaceId, message.id, "failed", { reason: "Resend token is not configured." })
    return { error: "Set your Resend API token in Settings first." }
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settingsToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Resend Panel <onboarding@resend.dev>",
        to: payload.to,
        cc: payload.cc.length ? payload.cc : undefined,
        bcc: payload.bcc.length ? payload.bcc : undefined,
        subject,
        html,
        text: payload.text,
        reply_to: payload.replyToMessageId ? ["onboarding@resend.dev"] : undefined,
      }),
    })

    const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!response.ok) {
      const reason = data?.message || `Resend request failed with ${response.status}.`
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

    return { success: "Message sent." }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Resend error."
    await updateMessage(message.id, { status: "failed" })
    await createEvent(workspaceId, message.id, "failed", { reason })
    return { error: reason }
  }
}

export async function composeAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  const settings = await getCurrentSettings()

  if (!workspace) {
    return { error: "Workspace is missing." }
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

  if (!subject && intent !== "save") {
    return { error: "Subject is required." }
  }

  if (!text) {
    return { error: "Message body is required." }
  }

  if (intent === "save") {
    await upsertDraft(workspace.id, { id: draftId, threadId, subject, to: to.join(", "), cc: cc.join(", "), bcc: bcc.join(", "), text })
    revalidatePath("/drafts")
    revalidatePath("/compose")
    return { success: "Draft saved." }
  }

  let finalRecipients = to
  let finalSubject = subject
  let finalThreadId = threadId
  let replyTarget = replyToMessageId

  if (threadId) {
    const thread = await getThreadWithMessages(workspace.id, threadId)
    if (!thread) {
      return { error: "Thread not found." }
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
  }

  requireAtLeastOneRecipient(finalRecipients)

  const settingsToken = getResendToken(settings?.tokenEncrypted)
  const result = await sendMessage(workspace.id, settingsToken, {
    subject: finalSubject,
    text,
    to: finalRecipients,
    cc,
    bcc,
    threadId: finalThreadId,
    replyToMessageId: replyTarget,
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
  const workspace = await getCurrentWorkspace()
  if (!workspace) {
    throw new Error("Workspace is missing.")
  }

  const payload = extractInboundPayload(requestBody)
  const thread = await ensureThread(
    workspace.id,
    payload.subject,
    Array.from(new Set([payload.from, ...payload.to]))
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
    receivedAt: new Date().toISOString(),
    inReplyTo: payload.inReplyTo || undefined,
    references: payload.references,
  })

  await createEvent(workspace.id, message.id, "received", {
    messageId: payload.messageId,
    inReplyTo: payload.inReplyTo,
  })

  revalidatePath("/dashboard")
  revalidatePath("/inbox")
  revalidatePath("/statistics")
}

