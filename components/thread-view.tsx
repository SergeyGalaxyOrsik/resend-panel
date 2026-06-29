"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { Message, Thread } from "@/lib/types"
import { formatMessageDate, getMessageTimestamp, compareMessageTimestamps } from "@/lib/format"
import { useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Reply } from "lucide-react"

type ThreadViewProps = {
  thread: Thread
  messages: Message[]
}

export function ThreadView({ thread, messages }: ThreadViewProps) {
  const t = useTranslations("inbox")
  const tm = useTranslations("mail")
  const td = useTranslations("direction")
  const locale = useLocale()

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => compareMessageTimestamps(a, b, "asc")),
    [messages]
  )

  return (
    <div className="min-w-0 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/inbox">{t("title")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{thread.subject}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold">{thread.subject}</h2>
          <p className="break-all text-sm text-muted-foreground">{thread.participants.join(", ")}</p>
        </div>
        <Link href={`/compose?threadId=${thread.id}`}>
          <Button className="gap-2">
            <Reply className="size-4" />
            {t("reply")}
          </Button>
        </Link>
      </div>

      <div className="min-w-0 space-y-4">
        {sortedMessages.map((message) => {
          const timestampLabel = message.direction === "outbound" ? tm("sentAt") : tm("receivedAt")
          const timestamp = getMessageTimestamp(message)

          return (
          <Card key={message.id} className="min-w-0 overflow-hidden border-border/60">
            <CardHeader className="pb-2">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CardTitle className="truncate text-sm font-medium">
                    {message.direction === "inbound" ? message.fromEmail : message.to[0]}
                  </CardTitle>
                  <Badge className="shrink-0 capitalize text-xs">{td(message.direction)}</Badge>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {timestampLabel}
                  </p>
                  <time
                    dateTime={timestamp}
                    className="mt-0.5 block whitespace-nowrap text-xs tabular-nums text-muted-foreground"
                  >
                    {formatMessageDate(message, locale)}
                  </time>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <div
                className="prose prose-sm max-w-none overflow-hidden break-words text-sm [&_*]:max-w-full [&_img]:h-auto [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
            </CardContent>
          </Card>
          )
        })}
      </div>
    </div>
  )
}
