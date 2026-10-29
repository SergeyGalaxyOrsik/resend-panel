/**
 * Startup validation for the secrets the panel cannot work without.
 *
 * `APP_SECRET` is the one that used to fail quietly: a missing or truncated key
 * still derives *a* 32-byte AES key, so the Resend token encrypts and decrypts
 * fine until the value changes, at which point every stored secret turns into
 * garbage with no explanation. Checking it once at boot turns that into a
 * startup error naming the variable.
 */

/** Kept in sync with the value `lib/crypto.ts` used to fall back to. */
export const LEGACY_DEV_SECRET = "resend-panel-dev-secret-change-me"

/** 32 bytes of hex, which is what `openssl rand -hex 32` produces. */
export const MIN_APP_SECRET_LENGTH = 32

/** A hex key has 16 distinct characters; anything under this is a typed-in string. */
const MIN_DISTINCT_CHARACTERS = 8

export type EnvProblem = {
  variable: string
  message: string
}

export function checkAppSecret(value = process.env.APP_SECRET): EnvProblem | null {
  const secret = (value ?? "").trim()

  if (!secret) {
    return {
      variable: "APP_SECRET",
      message: "not set. Generate one with `openssl rand -hex 32`.",
    }
  }

  if (secret === LEGACY_DEV_SECRET) {
    return {
      variable: "APP_SECRET",
      message: "still the shipped placeholder. Generate one with `openssl rand -hex 32`.",
    }
  }

  if (secret.length < MIN_APP_SECRET_LENGTH) {
    return {
      variable: "APP_SECRET",
      message: `only ${secret.length} characters, at least ${MIN_APP_SECRET_LENGTH} are required. Generate one with \`openssl rand -hex 32\`.`,
    }
  }

  if (new Set(secret).size < MIN_DISTINCT_CHARACTERS) {
    return {
      variable: "APP_SECRET",
      message: `made of ${new Set(secret).size} distinct characters, which is too repetitive to be random. Generate one with \`openssl rand -hex 32\`.`,
    }
  }

  return null
}

export function checkSupabaseEnv(env: NodeJS.ProcessEnv = process.env): EnvProblem[] {
  const problems: EnvProblem[] = []

  if (!env.SUPABASE_URL) {
    problems.push({ variable: "SUPABASE_URL", message: "not set." })
  }

  if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_KEY) {
    problems.push({ variable: "SUPABASE_SECRET_KEY", message: "not set (SUPABASE_SERVICE_KEY also accepted)." })
  }

  return problems
}

export function collectEnvProblems(env: NodeJS.ProcessEnv = process.env): EnvProblem[] {
  const appSecret = checkAppSecret(env.APP_SECRET)
  return [...(appSecret ? [appSecret] : []), ...checkSupabaseEnv(env)]
}

function formatProblems(problems: EnvProblem[]) {
  return problems.map((problem) => `  - ${problem.variable} is ${problem.message}`).join("\n")
}

/**
 * Throws in production, warns everywhere else. A developer running `bun run dev`
 * against a scratch database should not have to generate a key first; a
 * production container that would silently mangle its own secrets should refuse
 * to start.
 */
export function assertRuntimeEnv(env: NodeJS.ProcessEnv = process.env) {
  const problems = collectEnvProblems(env)
  if (!problems.length) {
    return
  }

  const summary = `Resend Panel cannot start with this configuration:\n${formatProblems(problems)}`

  if (env.NODE_ENV === "production") {
    throw new Error(summary)
  }

  console.warn(`[env] ${summary}\n[env] Continuing because NODE_ENV is not production.`)
}
