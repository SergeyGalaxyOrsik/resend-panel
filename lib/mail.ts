import type { Message, MailFolder } from "@/lib/types"

/**
 * Identity colours for avatars. Every tone is dark enough for white text at 4.5:1
 * in light mode and light enough to stay legible on the dark surface, so an avatar
 * is never a contrast accident regardless of which address hashes into it.
 */
const AVATAR_TONES = [
  "bg-rose-700 dark:bg-rose-600",
  "bg-orange-700 dark:bg-orange-600",
  "bg-amber-700 dark:bg-amber-600",
  "bg-emerald-700 dark:bg-emerald-600",
  "bg-teal-700 dark:bg-teal-600",
  "bg-cyan-700 dark:bg-cyan-600",
  "bg-sky-700 dark:bg-sky-600",
  "bg-indigo-700 dark:bg-indigo-600",
  "bg-violet-700 dark:bg-violet-600",
  "bg-fuchsia-700 dark:bg-fuchsia-600",
] as const

/** Strips `Display Name <addr@host>` down to the address. */
export function extractAddress(value: string) {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] ?? value).trim()
}

/** The part worth reading at a glance: a display name if there is one, else the local part. */
export function displayNameFor(value: string) {
  const named = value.match(/^\s*"?([^"<]+?)"?\s*</)
  if (named?.[1]?.trim()) return named[1].trim()

  const address = extractAddress(value)
  return address || value
}

export function getInitials(value: string) {
  const address = extractAddress(value)
  const local = address.split("@")[0] ?? address
  const parts = local.split(/[.\s_-]+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  }

  return local.slice(0, 2).toUpperCase() || "?"
}

/**
 * Hashes the whole address rather than the initials: hashing two letters puts far
 * too many different people on the same colour.
 */
export function avatarTone(value: string) {
  const address = extractAddress(value).toLowerCase()
  let hash = 0

  for (let index = 0; index < address.length; index += 1) {
    hash = (hash * 31 + address.charCodeAt(index)) % 100000
  }

  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

/**
 * Gmail's list-date rule: time for today, day and month for this year, full date
 * beyond that. Keeps the right-hand column narrow and scannable.
 */
export function formatListDate(value: string, locale: string) {
  const date = new Date(value)
  const now = new Date()

  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (sameDay) {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date)
  }

  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date)
  }

  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date)
}

export function formatFullDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "short" }).format(new Date(value))
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Falls back to stripping the HTML when a message carries no plain-text part. */
export function snippetFrom(message: Pick<Message, "text" | "html">) {
  const text = message.text?.trim()
  if (text) return text.replace(/\s+/g, " ").trim()

  return (message.html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export const THREAD_FOLDERS = ["inbox", "starred", "archive", "trash"] as const

export type ThreadFolder = (typeof THREAD_FOLDERS)[number]

export function isThreadFolder(value: string): value is ThreadFolder {
  return (THREAD_FOLDERS as readonly string[]).includes(value)
}

/** Where a folder's rows link to, and where "back" returns to. */
export function folderBasePath(folder: MailFolder) {
  return `/${folder}` as const
}
