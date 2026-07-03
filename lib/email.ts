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

  const html = pickFirstNonEmptyString(body, record, [
    "html",
    "content",
    "body",
    "html_body",
    "htmlBody",
    "body_html",
    "bodyHtml",
  ])

  const text = pickFirstNonEmptyString(body, record, [
    "text",
    "plaintext",
    "plain_text",
    "plainText",
    "body_text",
    "bodyText",
    "text_body",
    "textBody",
  ])

  const messageId = pickFirstNonEmptyString(body, record, [
    "message_id",
    "messageId",
    "id",
    "message_ID",
  ])

  const inReplyTo = pickFirstNonEmptyString(body, record, [
    "in_reply_to",
    "inReplyTo",
    "in_reply_ID",
    "inReplyID",
  ])

  const references = Array.isArray(body.references)
    ? body.references.map(String)
    : typeof body.references === "string"
      ? body.references.split(/\s+/).filter(Boolean)
      : Array.isArray(record.references)
        ? record.references.map(String)
        : typeof record.references === "string"
          ? String(record.references).split(/\s+/).filter(Boolean)
          : []

  const emailId = pickFirstNonEmptyString(body, record, [
    "email_id",
    "emailId",
    "id",
  ])

  return { subject, from, to, text, html, messageId, inReplyTo, references, emailId }
}

function pickFirstNonEmptyString(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  keys: string[]
): string {
  for (const obj of [a, b]) {
    for (const key of keys) {
      const val = obj[key]
      if (typeof val === "string" && val.trim()) {
        return val
      }
    }
  }
  return ""
}

export async function fetchResendEmail(
  emailId: string,
  token: string
): Promise<{ html: string; text: string } | null> {
  try {
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${emailId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "resend-panel/1.0",
        },
      }
    )

    if (!response.ok) return null

    const data = (await response.json()) as Record<string, unknown>
    return {
      html: String(data.html ?? ""),
      text: String(data.text ?? ""),
    }
  } catch {
    return null
  }
}

