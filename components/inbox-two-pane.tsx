"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { SearchIcon, PlusIcon } from "lucide-react"
import type { Thread } from "@/lib/types"
import { formatCompactRelative } from "@/lib/format"
import { threadMatchesSearch } from "@/lib/mail-search"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export type ThreadPreview = {
  text: string
  fromEmail: string
}

type InboxTwoPaneProps = {
  threads: Thread[]
  previews: Record<string, ThreadPreview>
  children: React.ReactNode
}

const AVATAR_COLORS = [
  "bg-emerald-500/80",
  "bg-amber-500/80",
  "bg-violet-500/80",
  "bg-sky-500/80",
  "bg-rose-500/80",
  "bg-orange-500/80",
  "bg-cyan-500/80",
  "bg-teal-500/80",
  "bg-fuchsia-500/80",
  "bg-indigo-500/80",
] as const

function getInitials(value: string) {
  const local = value.split("@")[0] ?? value
  const parts = local.split(/[.\s_-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

function avatarColor(initials: string) {
  let hash = 0
  for (const char of initials) {
    hash = (hash + char.charCodeAt(0)) % AVATAR_COLORS.length
  }
  return AVATAR_COLORS[hash] ?? "bg-foreground/60"
}

function getSender(thread: Thread, preview?: ThreadPreview) {
  if (preview?.fromEmail) return preview.fromEmail
  return thread.participants[0] ?? "unknown"
}

export function InboxTwoPane({ threads, previews, children }: InboxTwoPaneProps) {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations("inbox")
  const tm = useTranslations("mail")
  const [searchQuery, setSearchQuery] = useState("")

  const selectedId = pathname.startsWith("/inbox/") ? pathname.split("/")[2] : undefined
  const isDetailView = Boolean(selectedId)

  const filteredThreads = useMemo(
    () => threads.filter((thread) => threadMatchesSearch(thread, searchQuery)),
    [threads, searchQuery]
  )

  return (
    <div className="grid h-full min-h-0 overflow-hidden grid-cols-1 bg-background text-foreground md:grid-cols-[360px_1fr]">
      <aside
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden border-border/60 md:border-r",
          isDetailView ? "hidden md:flex" : "flex"
        )}
      >
        <div className="z-10 shrink-0 border-b border-border/60 bg-background px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base">{t("title")}</h2>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-muted-foreground text-xs">
                {t("threadCount", { count: threads.length })}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                render={<Link href="/compose" aria-label={t("newMessage")} />}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
          <div className="mt-2">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon className="size-3.5 opacity-60" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={tm("searchPlaceholder")}
              />
            </InputGroup>
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filteredThreads.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {threads.length === 0 ? t("emptyTitle") : tm("noSearchResults")}
            </li>
          ) : (
            filteredThreads.map((thread) => {
              const preview = previews[thread.id]
              const sender = getSender(thread, preview)
              const initials = getInitials(sender)
              const isSelected = thread.id === selectedId

              return (
                <li key={thread.id}>
                  <Link
                    href={`/inbox/${thread.id}`}
                    className={cn(
                      "flex w-full items-start gap-3 border-border/40 border-b px-4 py-3 text-left transition-colors",
                      isSelected ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full font-medium text-[11px] text-background",
                        avatarColor(initials)
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{sender}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatCompactRelative(thread.lastMessageAt, locale)}
                        </span>
                      </div>
                      <div className="truncate text-sm">{thread.subject}</div>
                      {preview?.text ? (
                        <p className="line-clamp-1 text-muted-foreground text-xs">{preview.text}</p>
                      ) : (
                        <p className="line-clamp-1 text-muted-foreground text-xs">
                          {thread.participants.join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      <main
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden",
          isDetailView ? "flex" : "hidden md:flex"
        )}
      >
        {children}
      </main>
    </div>
  )
}
