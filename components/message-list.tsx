"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { Message } from "@/lib/types"
import { compareMessageTimestamps, formatMessageDate, getMessageTimestamp } from "@/lib/format"
import { messageMatchesSearch } from "@/lib/mail-search"
import { Badge } from "@/components/ui/badge"
import { MailSearchInput } from "@/components/mail-search-input"
import { SortToggle, type SortOrder } from "@/components/sort-toggle"
import { cn } from "@/lib/utils"

type MessageListProps = {
  messages: Message[]
  emptyLabel?: string
  variant?: "inbox" | "sent"
}

export function MessageList({ messages, emptyLabel, variant = "inbox" }: MessageListProps) {
  const locale = useLocale()
  const t = useTranslations("mail")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const sortedMessages = useMemo(() => {
    const filtered = messages.filter((message) => messageMatchesSearch(message, searchQuery))
    return filtered.sort((a, b) => compareMessageTimestamps(a, b, sortOrder))
  }, [messages, searchQuery, sortOrder])

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-12 text-center text-sm text-muted-foreground">
        {emptyLabel ?? t("noMessages")}
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MailSearchInput value={searchQuery} onChange={setSearchQuery} />
        <SortToggle value={sortOrder} onChange={setSortOrder} className="ml-auto" />
      </div>

      {sortedMessages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-12 text-center text-sm text-muted-foreground">
          {t("noSearchResults")}
        </div>
      ) : (
      <div className="min-w-0 space-y-2">
        {sortedMessages.map((message) => {
          const display = variant === "inbox" ? message.fromEmail : message.to[0] || "unknown"
          const timestampLabel =
            message.direction === "outbound" ? t("sentAt") : t("receivedAt")

          return (
            <Link
              key={message.id}
              href={`/inbox/${message.threadId}`}
              className={cn(
                "flex min-w-0 items-start justify-between gap-4 rounded-2xl border border-border/60 bg-white/90 px-5 py-4 transition-colors hover:bg-zinc-50"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">{display}</span>
                  <Badge className="shrink-0 capitalize text-xs">{message.status}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{message.subject}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {timestampLabel}
                </p>
                <time
                  dateTime={getMessageTimestamp(message)}
                  className="mt-0.5 block whitespace-nowrap text-xs tabular-nums text-foreground"
                >
                  {formatMessageDate(message, locale)}
                </time>
              </div>
            </Link>
          )
        })}
      </div>
      )}
    </div>
  )
}
