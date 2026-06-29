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

export function formatMessageDate(message: Pick<Message, "direction" | "sentAt" | "receivedAt" | "createdAt">, locale?: string) {
  return formatDate(getMessageTimestamp(message), locale)
}

export function compareMessageTimestamps(
  a: Pick<Message, "direction" | "sentAt" | "receivedAt" | "createdAt">,
  b: Pick<Message, "direction" | "sentAt" | "receivedAt" | "createdAt">,
  order: "asc" | "desc" = "desc"
) {
  const diff = new Date(getMessageTimestamp(a)).getTime() - new Date(getMessageTimestamp(b)).getTime()
  return order === "asc" ? diff : -diff
}

export function formatCompactRelative(value: string, locale?: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.max(1, Math.floor(diff / 60_000))

  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  if (days < 7) {
    return new Intl.DateTimeFormat(locale ?? "en", { weekday: "short" }).format(date)
  }

  return new Intl.DateTimeFormat(locale ?? "en", { month: "short", day: "numeric" }).format(date)
}

export function formatRelative(value: string, locale?: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.floor(diff / 60_000))

  if (minutes < 60) {
    return formatRelativeUnit("minutes", minutes, locale)
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return formatRelativeUnit("hours", hours, locale)
  }

  const days = Math.floor(hours / 24)
  return formatRelativeUnit("days", days, locale)
}

function formatRelativeUnit(unit: "minutes" | "hours" | "days", count: number, locale?: string) {
  const resolvedLocale = locale ?? "en"

  const templates: Record<string, Record<typeof unit, string>> = {
    en: { minutes: "{count}m ago", hours: "{count}h ago", days: "{count}d ago" },
    ru: { minutes: "{count} мин. назад", hours: "{count} ч. назад", days: "{count} дн. назад" },
    zh: { minutes: "{count} 分钟前", hours: "{count} 小时前", days: "{count} 天前" },
  }

  const template = templates[resolvedLocale]?.[unit] ?? templates.en[unit]
  return template.replace("{count}", String(count))
}

export async function getFormatLocale() {
  const { getLocale } = await import("next-intl/server")
  return getLocale()
}
