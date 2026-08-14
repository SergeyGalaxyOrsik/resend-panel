import { describe, expect, it } from "vitest"
import {
  ADDRESS_ATTEMPT_LIMIT,
  EMAIL_ATTEMPT_LIMIT,
  addressKey,
  emailKey,
  lockoutDurationMs,
  mergeStates,
  passwordChangeKey,
} from "@/lib/rate-limit"

describe("throttle keys", () => {
  it("normalises the email, so casing and spacing share one counter", () => {
    expect(emailKey("  Owner@Example.COM ")).toBe("email:owner@example.com")
  })

  it("keeps address, email and password-change counters apart", () => {
    expect(addressKey("203.0.113.7")).toBe("ip:203.0.113.7")
    expect(passwordChangeKey("user_1")).toBe("password:user_1")
    expect(emailKey("a@b.c")).not.toBe(addressKey("a@b.c"))
  })
})

describe("lockoutDurationMs", () => {
  it("starts at a minute on the first lockout", () => {
    expect(lockoutDurationMs(EMAIL_ATTEMPT_LIMIT, EMAIL_ATTEMPT_LIMIT)).toBe(60_000)
  })

  it("doubles with every further failure", () => {
    expect(lockoutDurationMs(EMAIL_ATTEMPT_LIMIT + 1, EMAIL_ATTEMPT_LIMIT)).toBe(120_000)
    expect(lockoutDurationMs(EMAIL_ATTEMPT_LIMIT + 2, EMAIL_ATTEMPT_LIMIT)).toBe(240_000)
  })

  it("stops at half an hour, so a locked-out colleague can wait it out", () => {
    expect(lockoutDurationMs(EMAIL_ATTEMPT_LIMIT + 20, EMAIL_ATTEMPT_LIMIT)).toBe(30 * 60_000)
  })

  it("gives a shared address more room than a single account", () => {
    expect(ADDRESS_ATTEMPT_LIMIT).toBeGreaterThan(EMAIL_ATTEMPT_LIMIT)
  })
})

describe("mergeStates", () => {
  const open = { locked: false, retryAfterMinutes: 0, retryAfterMs: 0 }
  const short = { locked: true, retryAfterMinutes: 1, retryAfterMs: 60_000 }
  const long = { locked: true, retryAfterMinutes: 5, retryAfterMs: 300_000 }

  it("is open only when every key is open", () => {
    expect(mergeStates([open, open])).toEqual(open)
    expect(mergeStates([])).toEqual(open)
  })

  it("takes the strictest key, so one locked counter locks the attempt", () => {
    expect(mergeStates([open, short])).toEqual(short)
    expect(mergeStates([short, long, open])).toEqual(long)
  })
})
