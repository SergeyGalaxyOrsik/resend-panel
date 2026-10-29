import crypto from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getResendWebhookSecret,
  mapResendEventType,
  verifyResendWebhook,
} from "@/lib/webhooks"

const SECRET = `whsec_${Buffer.from("a-signing-secret-worth-32-bytes!!").toString("base64")}`
const PAYLOAD = JSON.stringify({ type: "email.delivered", data: { email_id: "re_1" } })

/** What Svix puts in `svix-signature` for a given delivery. */
function sign(payload: string, id: string, timestamp: string, secret = SECRET) {
  const key = Buffer.from(secret.replace("whsec_", ""), "base64")
  const signature = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64")
  return `v1,${signature}`
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("svix signature verification", () => {
  const id = "msg_2abc"
  const timestamp = "1730000000"

  it("accepts a correctly signed payload", () => {
    const headers = { signature: sign(PAYLOAD, id, timestamp), id, timestamp }
    expect(verifyResendWebhook(PAYLOAD, headers, SECRET)).toBe(true)
  })

  it("rejects a payload that was modified after signing", () => {
    const headers = { signature: sign(PAYLOAD, id, timestamp), id, timestamp }
    expect(verifyResendWebhook(`${PAYLOAD} `, headers, SECRET)).toBe(false)
  })

  it("rejects a signature made with another secret", () => {
    const otherSecret = `whsec_${Buffer.from("another-secret-of-the-same-size!").toString("base64")}`
    const headers = { signature: sign(PAYLOAD, id, timestamp, otherSecret), id, timestamp }
    expect(verifyResendWebhook(PAYLOAD, headers, SECRET)).toBe(false)
  })

  it("rejects a signature bound to a different delivery id or timestamp", () => {
    expect(
      verifyResendWebhook(PAYLOAD, { signature: sign(PAYLOAD, id, timestamp), id: "msg_other", timestamp }, SECRET)
    ).toBe(false)
    expect(
      verifyResendWebhook(PAYLOAD, { signature: sign(PAYLOAD, id, timestamp), id, timestamp: "1730000001" }, SECRET)
    ).toBe(false)
  })

  it("accepts a payload whose signature header carries several versions", () => {
    const signature = `v0,ignored ${sign(PAYLOAD, id, timestamp)}`
    expect(verifyResendWebhook(PAYLOAD, { signature, id, timestamp }, SECRET)).toBe(true)
  })

  it("rejects a missing signature", () => {
    expect(verifyResendWebhook(PAYLOAD, { signature: null, id, timestamp }, SECRET)).toBe(false)
  })
})

describe("legacy hmac verification", () => {
  it("accepts a hex digest of the raw body", () => {
    const secret = "shared-secret"
    const signature = crypto.createHmac("sha256", secret).update(PAYLOAD).digest("hex")

    expect(verifyResendWebhook(PAYLOAD, { signature }, secret)).toBe(true)
    expect(verifyResendWebhook(PAYLOAD, { signature: `sha256=${signature}` }, secret)).toBe(true)
    expect(verifyResendWebhook(PAYLOAD, { signature: signature.replace(/.$/, "0") }, secret)).toBe(false)
  })
})

describe("an unconfigured secret", () => {
  it("is refused in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(verifyResendWebhook(PAYLOAD, { signature: "anything" }, undefined)).toBe(false)
  })

  it("is allowed in development, so a local tunnel works without one", () => {
    vi.stubEnv("NODE_ENV", "development")
    expect(verifyResendWebhook(PAYLOAD, { signature: null }, undefined)).toBe(true)
  })
})

describe("secret selection", () => {
  it("prefers the per-endpoint secret and falls back to the shared one", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "shared")
    expect(getResendWebhookSecret("inbound")).toBe("shared")
    expect(getResendWebhookSecret("events")).toBe("shared")

    vi.stubEnv("RESEND_INBOUND_WEBHOOK_SECRET", "inbound-only")
    expect(getResendWebhookSecret("inbound")).toBe("inbound-only")
    expect(getResendWebhookSecret("events")).toBe("shared")
  })
})

describe("event mapping", () => {
  it("maps the six subscribed events", () => {
    expect(mapResendEventType("email.delivered")).toBe("delivered")
    expect(mapResendEventType("email.opened")).toBe("opened")
    expect(mapResendEventType("email.clicked")).toBe("clicked")
    expect(mapResendEventType("email.bounced")).toBe("bounced")
    expect(mapResendEventType("email.failed")).toBe("failed")
    expect(mapResendEventType("email.delivery_delayed")).toBe("failed")
  })

  it("ignores everything else, including the redundant email.sent", () => {
    expect(mapResendEventType("email.sent")).toBeNull()
    expect(mapResendEventType("contact.created")).toBeNull()
    expect(mapResendEventType("")).toBeNull()
  })
})
