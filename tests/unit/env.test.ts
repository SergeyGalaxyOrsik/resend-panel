import { afterEach, describe, expect, it, vi } from "vitest"
import { LEGACY_DEV_SECRET, assertRuntimeEnv, checkAppSecret, collectEnvProblems } from "@/lib/env"

const VALID = "1f8b0a2c4d6e8f00112233445566778899aabbccddeeff00112233445566778"

/** The checks take an env object, so a case is just a literal rather than a mutation. */
function env(values: Record<string, string>) {
  return values as unknown as NodeJS.ProcessEnv
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("checkAppSecret", () => {
  it("accepts a generated key", () => {
    expect(checkAppSecret(VALID)).toBeNull()
  })

  it("rejects an empty or missing value", () => {
    expect(checkAppSecret("")?.variable).toBe("APP_SECRET")
    expect(checkAppSecret(undefined)?.variable).toBe("APP_SECRET")
  })

  it("rejects the shipped placeholder", () => {
    expect(checkAppSecret(LEGACY_DEV_SECRET)?.message).toContain("placeholder")
  })

  it("rejects a key that is too short", () => {
    expect(checkAppSecret("short-secret")?.message).toContain("characters")
  })

  it("rejects a long but repetitive key", () => {
    expect(checkAppSecret("a".repeat(64))?.message).toContain("random")
  })
})

describe("assertRuntimeEnv", () => {
  const complete = env({
    APP_SECRET: VALID,
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret",
  })

  it("passes on a complete configuration", () => {
    expect(() => assertRuntimeEnv({ ...complete, NODE_ENV: "production" })).not.toThrow()
  })

  it("throws in production, naming every missing variable", () => {
    let thrown: Error | null = null
    try {
      assertRuntimeEnv(env({ NODE_ENV: "production" }))
    } catch (error) {
      thrown = error as Error
    }

    expect(thrown?.message).toContain("APP_SECRET")
    expect(thrown?.message).toContain("SUPABASE_URL")
    expect(thrown?.message).toContain("SUPABASE_SECRET_KEY")
  })

  it("only warns outside production, so a scratch install still runs", () => {
    expect(() => assertRuntimeEnv(env({ NODE_ENV: "development" }))).not.toThrow()
  })

  it("accepts the older SUPABASE_SERVICE_KEY name", () => {
    const problems = collectEnvProblems(
      env({
        APP_SECRET: VALID,
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_KEY: "legacy",
      })
    )

    expect(problems).toEqual([])
  })
})
