"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { Thread } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { threadMatchesSearch } from "@/lib/mail-search"
import { Badge } from "@/components/ui/badge"
import { MailSearchInput } from "@/components/mail-search-input"
import { SortToggle, type SortOrder } from "@/components/sort-toggle"

type ThreadListProps = {
  threads: Thread[]
}

export function ThreadList({ threads }: ThreadListProps) {
  const locale = useLocale()
  const t = useTranslations("inbox")
  const tm = useTranslations("mail")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const sortedThreads = useMemo(() => {
    const filtered = threads.filter((thread) => threadMatchesSearch(thread, searchQuery))
    return filtered.sort((a, b) => {
      const diff = new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime()
      return sortOrder === "asc" ? diff : -diff
    })
  }, [threads, searchQuery, sortOrder])

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MailSearchInput value={searchQuery} onChange={setSearchQuery} />
        <SortToggle value={sortOrder} onChange={setSortOrder} className="ml-auto" />
      </div>

      {sortedThreads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-12 text-center text-sm text-muted-foreground">
          {tm("noSearchResults")}
        </div>
      ) : (
      <div className="min-w-0 space-y-2">
        {sortedThreads.map((thread) => (
          <Link
            key={thread.id}
            href={`/inbox/${thread.id}`}
            className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-border/60 bg-card px-5 py-4 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{thread.subject}</span>
                <Badge className="shrink-0 text-xs">
                  {t("participants", { count: thread.participants.length })}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{thread.participants.join(", ")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tm("lastActivity")}
              </p>
              <time
                dateTime={thread.lastMessageAt}
                className="mt-0.5 block whitespace-nowrap text-xs tabular-nums text-foreground"
              >
                {formatDate(thread.lastMessageAt, locale)}
              </time>
            </div>
          </Link>
        ))}
      </div>
      )}
    </div>
  )
}
