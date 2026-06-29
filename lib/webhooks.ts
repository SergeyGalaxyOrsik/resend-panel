import crypto from "node:crypto"

export function verifyResendWebhook(payload: string, signature: string | null, secret: string | undefined) {
  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }

  if (!signature) {
    return false
  }

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex")
  const normalized = signature.replace(/^sha256=/, "")

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))
  } catch {
    return false
  }
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
