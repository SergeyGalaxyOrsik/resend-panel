import crypto from "node:crypto"

const DEFAULT_SECRET = "resend-panel-dev-secret-change-me"

function getSecret() {
  return process.env.APP_SECRET || DEFAULT_SECRET
}

function deriveKey() {
  return crypto.createHash("sha256").update(getSecret()).digest()
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto
    .pbkdf2Sync(password, salt, 120_000, 64, "sha512")
    .toString("hex")

  return `pbkdf2$120000$${salt}$${hash}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, salt, expected] = storedHash.split("$")
  if (algorithm !== "pbkdf2" || !iterations || !salt || !expected) {
    return false
  }

  const actual = crypto
    .pbkdf2Sync(password, salt, Number(iterations), 64, "sha512")
    .toString("hex")

  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    "enc:v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":")
}

export function decryptSecret(payload: string) {
  if (!payload.startsWith("enc:v1:")) {
    return payload
  }

  const [, , ivValue, tagValue, bodyValue] = payload.split(":")
  const iv = Buffer.from(ivValue, "base64")
  const tag = Buffer.from(tagValue, "base64")
  const body = Buffer.from(bodyValue, "base64")
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")
}

export function createToken(prefix = "sess") {
  return `${prefix}_${crypto.randomUUID()}`
}

