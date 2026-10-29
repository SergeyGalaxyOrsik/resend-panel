import crypto from "node:crypto"
import { LEGACY_DEV_SECRET, checkAppSecret } from "@/lib/env"

let warnedAboutSecret = false

/**
 * The key every stored secret is encrypted with. A bad `APP_SECRET` is refused
 * outright in production: deriving a key from a placeholder means the ciphertext
 * survives but stops decrypting the moment a real key is configured, and that
 * failure surfaces far away from its cause. Outside production the old fallback
 * is kept so a scratch install still runs, with one warning.
 */
function getSecret() {
  const problem = checkAppSecret()
  if (!problem) {
    return process.env.APP_SECRET as string
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`APP_SECRET is ${problem.message}`)
  }

  if (!warnedAboutSecret) {
    warnedAboutSecret = true
    console.warn(`[crypto] APP_SECRET is ${problem.message} Falling back to the development key.`)
  }

  return process.env.APP_SECRET?.trim() || LEGACY_DEV_SECRET
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

// Alphabet without look-alikes (0/O, 1/l/I), because the owner reads this out loud.
const TEMPORARY_PASSWORD_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateTemporaryPassword(length = 16) {
  const bytes = crypto.randomBytes(length)
  let password = ""
  for (let index = 0; index < length; index += 1) {
    password += TEMPORARY_PASSWORD_ALPHABET[bytes[index] % TEMPORARY_PASSWORD_ALPHABET.length]
  }

  return password
}

