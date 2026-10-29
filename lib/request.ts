import { headers } from "next/headers"

/**
 * Best effort client address, used to key throttling and to label sessions.
 *
 * Behind a proxy the only truth is `x-forwarded-for`, which a client can forge
 * when the app is exposed directly. That is acceptable here: a forged address
 * splits an attacker's own counter, it never unlocks somebody else's account,
 * because the email key is counted separately.
 */
export async function getClientAddress() {
  const headerList = await headers()
  const forwarded = headerList.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }

  return headerList.get("x-real-ip") || headerList.get("cf-connecting-ip") || ""
}

export async function getUserAgent() {
  const headerList = await headers()
  return (headerList.get("user-agent") || "").slice(0, 300)
}
