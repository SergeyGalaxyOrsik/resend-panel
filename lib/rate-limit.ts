import { supabase } from "@/lib/supabase"

/**
 * Login throttling.
 *
 * Password checking used to be free: `loginAction` called `verifyLogin` as often
 * as a client cared to ask. Every failure now costs a row in `login_throttle`,
 * and past the threshold the account stops answering for a while.
 *
 * Two keys are counted for one attempt. The email key stops a targeted guess at
 * one account; the address key stops one client spraying many accounts. Whichever
 * locks first wins, and a successful login clears both.
 */

/** Failures allowed before an email is locked out. */
export const EMAIL_ATTEMPT_LIMIT = 5

/** Address limit is looser: a shared office NAT is one address for everybody. */
export const ADDRESS_ATTEMPT_LIMIT = 20

/** Failures older than this stop counting, so a typo last week costs nothing. */
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

const FIRST_LOCKOUT_MS = 60 * 1000
const MAX_LOCKOUT_MS = 30 * 60 * 1000

/** Every failed check sleeps this long, which alone caps a probe at ~3/second. */
const FAILURE_DELAY_MS = 300

export type ThrottleKey = string

export function emailKey(email: string): ThrottleKey {
  return `email:${email.trim().toLowerCase()}`
}

export function addressKey(address: string): ThrottleKey {
  return `ip:${address.trim()}`
}

export function passwordChangeKey(userId: string): ThrottleKey {
  return `password:${userId}`
}

function limitFor(key: ThrottleKey) {
  return key.startsWith("ip:") ? ADDRESS_ATTEMPT_LIMIT : EMAIL_ATTEMPT_LIMIT
}

/**
 * Doubles per failure past the limit and stops at half an hour: long enough to
 * make guessing hopeless, short enough that a locked-out colleague can wait it out.
 */
export function lockoutDurationMs(attempts: number, limit: number) {
  const excess = Math.max(0, attempts - limit)
  return Math.min(FIRST_LOCKOUT_MS * 2 ** excess, MAX_LOCKOUT_MS)
}

export type ThrottleState = {
  locked: boolean
  /** Whole minutes left, rounded up, for the message shown to the user. */
  retryAfterMinutes: number
  retryAfterMs: number
}

const OPEN: ThrottleState = { locked: false, retryAfterMinutes: 0, retryAfterMs: 0 }

function stateFor(lockedUntil: string | null | undefined, now = Date.now()): ThrottleState {
  if (!lockedUntil) return OPEN

  const remaining = new Date(lockedUntil).getTime() - now
  if (remaining <= 0) return OPEN

  return {
    locked: true,
    retryAfterMs: remaining,
    retryAfterMinutes: Math.max(1, Math.ceil(remaining / 60_000)),
  }
}

/** The strictest of the keys decides, so one locked key locks the attempt. */
export function mergeStates(states: ThrottleState[]): ThrottleState {
  return states.reduce((worst, state) => (state.retryAfterMs > worst.retryAfterMs ? state : worst), OPEN)
}

export async function checkThrottle(keys: ThrottleKey[]): Promise<ThrottleState> {
  if (!keys.length) return OPEN

  const { data } = await supabase.from("login_throttle").select("key, locked_until").in("key", keys)

  return mergeStates((data || []).map((row) => stateFor(row.locked_until as string | null)))
}

/**
 * Records one failure against every key and returns the resulting lock. The read
 * and the write are not one transaction: two simultaneous guesses can land on the
 * same count, which costs the attacker an attempt and nobody else anything.
 */
export async function registerFailure(keys: ThrottleKey[]): Promise<ThrottleState> {
  await delay(FAILURE_DELAY_MS)

  if (!keys.length) return OPEN

  const nowMs = Date.now()
  const now = new Date(nowMs).toISOString()
  const { data } = await supabase.from("login_throttle").select("*").in("key", keys)
  const existing = new Map((data || []).map((row) => [row.key as string, row]))

  const states: ThrottleState[] = []

  for (const key of keys) {
    const row = existing.get(key)
    const withinWindow =
      row && nowMs - new Date(row.first_attempt_at as string).getTime() < ATTEMPT_WINDOW_MS
    const attempts = (withinWindow ? (row.attempts as number) : 0) + 1
    const limit = limitFor(key)
    const lockedUntil =
      attempts >= limit ? new Date(nowMs + lockoutDurationMs(attempts, limit)).toISOString() : null

    await supabase.from("login_throttle").upsert(
      {
        key,
        attempts,
        first_attempt_at: withinWindow ? (row.first_attempt_at as string) : now,
        last_attempt_at: now,
        locked_until: lockedUntil,
      },
      { onConflict: "key" }
    )

    states.push(stateFor(lockedUntil, nowMs))
  }

  return mergeStates(states)
}

/** Called after a password check succeeds, so an honest user starts clean. */
export async function clearThrottle(keys: ThrottleKey[]) {
  if (!keys.length) return
  await supabase.from("login_throttle").delete().in("key", keys)
}

/** Drops counters whose window closed and whose lock expired. */
export async function purgeExpiredThrottles(now = new Date()) {
  const cutoff = new Date(now.getTime() - ATTEMPT_WINDOW_MS).toISOString()
  // The timestamp is quoted: a PostgREST `or` value carrying dots and colons is
  // only unambiguous inside quotes.
  await supabase
    .from("login_throttle")
    .delete()
    .lt("last_attempt_at", cutoff)
    .or(`locked_until.is.null,locked_until.lt."${now.toISOString()}"`)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
