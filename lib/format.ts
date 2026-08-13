import type { Message } from "@/lib/types"

export function formatDate(value: string, locale?: string) {
  return new Intl.DateTimeFormat(locale ?? "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function getMessageTimestamp(message: Pick<Message, "direction" | "sentAt" | "receivedAt" | "createdAt">) {
  if (message.direction === "outbound") {
    return message.sentAt ?? message.createdAt
  }

  return message.receivedAt ?? message.createdAt
}

/**
 * Minutes only stay readable for about an hour. Past that this steps up to hours
 * and then to days, so "2481m" reads as "1d 17h".
 */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainderMinutes = minutes % 60

  if (hours < 24) {
    return remainderMinutes ? `${hours}h ${remainderMinutes}m` : `${hours}h`
  }

  const days = Math.floor(hours / 24)
  const remainderHours = hours % 24

  return remainderHours ? `${days}d ${remainderHours}h` : `${days}d`
}

export async function getFormatLocale() {
  const { getLocale } = await import("next-intl/server")
  return getLocale()
}
