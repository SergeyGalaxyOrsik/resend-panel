"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { Message } from "@/lib/types"
import { compareMessageTimestamps, formatMessageDate, getMessageTimestamp } from "@/lib/format"
import { messageMatchesSearch } from "@/lib/mail-search"
import { MailSearchInput } from "@/components/mail-search-input"
import { SortToggle, type SortOrder } from "@/components/sort-toggle"
import {
  EmailsTable,
  EmailsTableBody,
  EmailsTableCell,
  EmailsTableHead,
  EmailsTableHeader,
  EmailsTableRow,
  MessageStatusBadge,
  ViewEmailAction,
} from "@/components/emails-table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type MessageListProps = {
  messages: Message[]
  emptyLabel?: string
  variant?: "inbox" | "sent"
}

export function MessageList({ messages, emptyLabel, variant = "inbox" }: MessageListProps) {
  const locale = useLocale()
  const t = useTranslations("mail")
  const tc = useTranslations("common")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const sortedMessages = useMemo(() => {
    const filtered = messages.filter((message) => messageMatchesSearch(message, searchQuery))
    return filtered.sort((a, b) => compareMessageTimestamps(a, b, sortOrder))
  }, [messages, searchQuery, sortOrder])

  if (messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-card p-12 text-center text-sm text-muted-foreground">
        {emptyLabel ?? t("noMessages")}
      </div>
    )
  }

  const contactColumn = variant === "inbox" ? t("columnFrom") : t("columnTo")

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <MailSearchInput value={searchQuery} onChange={setSearchQuery} />
        <SortToggle value={sortOrder} onChange={setSortOrder} className="ml-auto" />
      </div>

      {sortedMessages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-card p-12 text-center text-sm text-muted-foreground">
          {t("noSearchResults")}
        </div>
      ) : (
        <EmailsTable>
          <EmailsTableHeader>
            <EmailsTableHead>{contactColumn}</EmailsTableHead>
            <EmailsTableHead>{t("columnSubject")}</EmailsTableHead>
            <EmailsTableHead className="w-[120px]">{t("columnStatus")}</EmailsTableHead>
            <EmailsTableHead className="w-[160px]">
              {variant === "inbox" ? t("receivedAt") : t("sentAt")}
            </EmailsTableHead>
            <EmailsTableHead className="w-[100px]">{t("columnActions")}</EmailsTableHead>
          </EmailsTableHeader>
          <EmailsTableBody>
            {sortedMessages.map((message) => {
              const contact =
                variant === "inbox" ? message.fromEmail : message.to[0] || tc("unknown")
              const timestampLabel =
                message.direction === "outbound" ? t("sentAt") : t("receivedAt")

              return (
                <EmailsTableRow key={message.id}>
                  <EmailsTableCell className="max-w-[220px] font-medium">
                    <span className="block truncate">{contact}</span>
                  </EmailsTableCell>
                  <EmailsTableCell className="max-w-[320px] text-sm text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block cursor-help truncate">{message.subject}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">{message.subject}</TooltipContent>
                    </Tooltip>
                  </EmailsTableCell>
                  <EmailsTableCell>
                    <MessageStatusBadge status={message.status} />
                  </EmailsTableCell>
                  <EmailsTableCell className="text-sm text-muted-foreground">
                    <span className="block text-[11px] font-medium uppercase tracking-wide">
                      {timestampLabel}
                    </span>
                    <time
                      dateTime={getMessageTimestamp(message)}
                      className="mt-0.5 block tabular-nums"
                    >
                      {formatMessageDate(message, locale)}
                    </time>
                  </EmailsTableCell>
                  <EmailsTableCell>
                    <ViewEmailAction href={`/inbox/${message.threadId}`} />
                  </EmailsTableCell>
                </EmailsTableRow>
              )
            })}
          </EmailsTableBody>
        </EmailsTable>
      )}
    </div>
  )
}
