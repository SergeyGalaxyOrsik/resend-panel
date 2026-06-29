import crypto from "node:crypto"

type WebhookHeaders = {
  signature: string | null
  id?: string | null
  timestamp?: string | null
}

function getSvixSecretBytes(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret
  return Buffer.from(encoded, "base64")
}

function verifySvixWebhook(payload: string, headers: WebhookHeaders, secret: string) {
  const { signature, id, timestamp } = headers
  if (!signature || !id || !timestamp) {
    return false
  }

  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = crypto.createHmac("sha256", getSvixSecretBytes(secret)).update(signedContent).digest("base64")

  for (const part of signature.split(" ")) {
    const [version, sig] = part.split(",", 2)
    if (version !== "v1" || !sig) continue

    try {
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return true
      }
    } catch {
      // Signature length mismatch — try next part.
    }
  }

  return false
}

function verifyLegacyWebhook(payload: string, signature: string, secret: string) {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  const normalized = signature.replace(/^sha256=/, "")

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))
  } catch {
    return false
  }
}

export function getResendWebhookSecret(kind: "inbound" | "events") {
  if (kind === "inbound") {
    return process.env.RESEND_INBOUND_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET
  }

  return process.env.RESEND_EVENTS_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET
}

export function verifyResendWebhook(payload: string, headers: WebhookHeaders, secret: string | undefined) {
  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }

  if (!headers.signature) {
    return false
  }

  if (headers.id && headers.timestamp) {
    return verifySvixWebhook(payload, headers, secret)
  }

  return verifyLegacyWebhook(payload, headers.signature, secret)
}

export function mapResendEventType(type: string): "delivered" | "opened" | "clicked" | "bounced" | "failed" | null {
  switch (type) {
    case "email.delivered":
      return "delivered"
    case "email.opened":
      return "opened"
    case "email.clicked":
      return "clicked"
    case "email.bounced":
      return "bounced"
    case "email.delivery_delayed":
    case "email.failed":
      return "failed"
    default:
      return null
  }
}
