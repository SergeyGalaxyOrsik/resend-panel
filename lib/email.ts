import { decryptSecret } from "@/lib/crypto"
import type { Message } from "@/lib/types"

export function normalizeRecipients(value: string) {
  return value
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeSubject(subject: string) {
  const trimmed = subject.trim()
  return trimmed || "No subject"
}

export function stripSubjectPrefix(subject: string) {
  return subject.replace(/^((re|fw|fwd)\s*:\s*)+/gi, "").trim() || "No subject"
}

export function buildTextPreview(text: string) {
  return text.trim()
}

export function buildHtmlFromText(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noreferrer noopener">${url}</a>`
  )

  return linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("")
}

export function renderThreadSubject(subject: string) {
  return stripSubjectPrefix(subject)
}

export function getReplyRecipients(message: Message) {
  if (message.direction === "inbound") {
    return [message.fromEmail]
  }

  return message.to.length > 0 ? [message.to[0]] : []
}

export function getResendToken(encoded: string | null | undefined) {
  if (!encoded) {
    return null
  }

  return decryptSecret(encoded)
}

export function extractInboundPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid inbound payload.")
  }

  const record = payload as Record<string, unknown>
  const body = (record.data ?? record.email ?? record) as Record<string, unknown>

  const subject = String(body.subject ?? record.subject ?? "No subject")
  const from = String(body.from ?? record.from ?? "unknown@example.com")
  const to = Array.isArray(body.to) ? body.to.map(String) : normalizeRecipients(String(body.to ?? ""))
  const text = String(body.text ?? body.plaintext ?? record.text ?? "")
  const html = String(body.html ?? record.html ?? "")
  const messageId = String(body.message_id ?? body.messageId ?? record.messageId ?? "")
  const inReplyTo = String(body.in_reply_to ?? body.inReplyTo ?? record.inReplyTo ?? "")
  const references = Array.isArray(body.references)
    ? body.references.map(String)
    : typeof body.references === "string"
      ? body.references.split(/\s+/).filter(Boolean)
      : []

  return { subject, from, to, text, html, messageId, inReplyTo, references }
}

