"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { Thread } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { threadMatchesSearch } from "@/lib/mail-search"
import { Badge } from "@/components/ui/badge"
import { MailSearchInput } from "@/components/mail-search-input"
import { SortToggle, type SortOrder } from "@/components/sort-toggle"
import {
  EmailsTable,
  EmailsTableBody,
  EmailsTableCell,
  EmailsTableHead,
  EmailsTableHeader,
  EmailsTableRow,
  ViewEmailAction,
} from "@/components/emails-table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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
        <div className="rounded-lg border border-dashed border-border/70 bg-card p-12 text-center text-sm text-muted-foreground">
          {tm("noSearchResults")}
        </div>
      ) : (
        <EmailsTable>
          <EmailsTableHeader>
            <EmailsTableHead>{tm("columnSubject")}</EmailsTableHead>
            <EmailsTableHead>{tm("columnParticipants")}</EmailsTableHead>
            <EmailsTableHead className="w-[160px]">{tm("lastActivity")}</EmailsTableHead>
            <EmailsTableHead className="w-[100px]">{tm("columnActions")}</EmailsTableHead>
          </EmailsTableHeader>
          <EmailsTableBody>
            {sortedThreads.map((thread) => (
              <EmailsTableRow key={thread.id}>
                <EmailsTableCell className="max-w-[280px] font-medium">
                  <span className="block truncate">{thread.subject}</span>
                </EmailsTableCell>
                <EmailsTableCell className="max-w-[320px] text-sm text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="block cursor-help truncate">
                        {thread.participants.join(", ")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      {thread.participants.join(", ")}
                    </TooltipContent>
                  </Tooltip>
                </EmailsTableCell>
                <EmailsTableCell className="text-sm text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="w-fit border-0 bg-muted text-muted-foreground">
                      {t("participants", { count: thread.participants.length })}
                    </Badge>
                    <time dateTime={thread.lastMessageAt} className="tabular-nums">
                      {formatDate(thread.lastMessageAt, locale)}
                    </time>
                  </div>
                </EmailsTableCell>
                <EmailsTableCell>
                  <ViewEmailAction href={`/inbox/${thread.id}`} />
                </EmailsTableCell>
              </EmailsTableRow>
            ))}
          </EmailsTableBody>
        </EmailsTable>
      )}
    </div>
  )
}
