import { beforeAll, describe, expect, it } from "vitest"

const APP_SECRET = "1f8b0a2c4d6e8f00112233445566778899aabbccddeeff00112233445566778"

beforeAll(() => {
  process.env.APP_SECRET = APP_SECRET
})

const {
  encryptSecret,
  decryptSecret,
  generateTemporaryPassword,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} = await import("@/lib/crypto")

describe("password hashing", () => {
  it("verifies the password it hashed", () => {
    const hash = hashPassword("correct horse battery staple")
    expect(verifyPassword("correct horse battery staple", hash)).toBe(true)
  })

  it("rejects a wrong password", () => {
    const hash = hashPassword("correct horse battery staple")
    expect(verifyPassword("Correct horse battery staple", hash)).toBe(false)
  })

  it("salts, so the same password hashes differently every time", () => {
    expect(hashPassword("repeated")).not.toBe(hashPassword("repeated"))
  })

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyPassword("anything", "not-a-hash")).toBe(false)
    expect(verifyPassword("anything", "bcrypt$10$salt$hash")).toBe(false)
    expect(verifyPassword("anything", "")).toBe(false)
  })
})

describe("secret encryption", () => {
  it("round-trips a value", () => {
    const encrypted = encryptSecret("re_live_token")
    expect(encrypted).not.toContain("re_live_token")
    expect(decryptSecret(encrypted)).toBe("re_live_token")
  })

  it("is authenticated: a tampered ciphertext does not decrypt", () => {
    const [prefix, version, iv, tag, body] = encryptSecret("re_live_token").split(":")
    const flipped = body.startsWith("A") ? `B${body.slice(1)}` : `A${body.slice(1)}`

    expect(() => decryptSecret([prefix, version, iv, tag, flipped].join(":"))).toThrow()
  })

  it("passes through a value stored before encryption existed", () => {
    expect(decryptSecret("re_plain_legacy_token")).toBe("re_plain_legacy_token")
  })
})

describe("temporary passwords", () => {
  it("has the requested length and avoids look-alike characters", () => {
    const password = generateTemporaryPassword(24)
    expect(password).toHaveLength(24)
    expect(password).not.toMatch(/[0O1lI]/)
  })

  it("does not repeat itself", () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword())
  })
})

describe("normalizeEmail", () => {
  it("trims and lowercases, so one account cannot be created twice", () => {
    expect(normalizeEmail("  Owner@Example.COM ")).toBe("owner@example.com")
  })
})
