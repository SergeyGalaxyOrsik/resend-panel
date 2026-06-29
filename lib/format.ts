import { getLocale } from "next-intl/server"

export function formatDate(value: string, locale?: string) {
  return new Intl.DateTimeFormat(locale ?? "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
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
  return getLocale()
}
