"use client"

import { useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { Message, Thread } from "@/lib/types"
import { formatMessageDate, getMessageTimestamp, compareMessageTimestamps } from "@/lib/format"
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
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ForwardIcon,
  MoreHorizontalIcon,
  ReplyIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ThreadViewProps = {
  thread: Thread
  messages: Message[]
  variant?: "default" | "two-pane"
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

export function ThreadView({ thread, messages, variant = "default" }: ThreadViewProps) {
  const t = useTranslations("inbox")
  const tm = useTranslations("mail")
  const td = useTranslations("direction")
  const locale = useLocale()

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => compareMessageTimestamps(a, b, "asc")),
    [messages]
  )

  const primaryContact = thread.participants[0] ?? "unknown"
  const initials = getInitials(primaryContact)

  if (variant === "two-pane") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-4 md:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            render={<Link href="/inbox" aria-label={t("backToInbox")} />}
          >
            <ArrowLeftIcon />
          </Button>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full font-medium text-[12px] text-background",
              avatarColor(initials)
            )}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-sm">{primaryContact}</div>
            <div className="truncate text-muted-foreground text-xs">{thread.subject}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("reply")}
              render={<Link href={`/compose?threadId=${thread.id}`} />}
            >
              <ReplyIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("forward")} disabled>
              <ForwardIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("archive")} disabled>
              <ArchiveIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("delete")} disabled>
              <Trash2Icon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t("more")} disabled>
              <MoreHorizontalIcon />
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2 md:px-6">
          <Button variant="outline" size="sm" render={<Link href={`/compose?threadId=${thread.id}`} />}>
            <ReplyIcon />
            {t("reply")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {sortedMessages.map((message) => {
              const timestampLabel = message.direction === "outbound" ? tm("sentAt") : tm("receivedAt")
              const timestamp = getMessageTimestamp(message)
              const sender = message.direction === "inbound" ? message.fromEmail : message.to[0]

              return (
                <article key={message.id} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-foreground">{sender}</span>
                      <Badge className="shrink-0 capitalize">{td(message.direction)}</Badge>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11px] font-medium uppercase tracking-wide">
                        {timestampLabel}
                      </span>
                      <time dateTime={timestamp} className="tabular-nums">
                        {formatMessageDate(message, locale)}
                      </time>
                    </div>
                  </div>
                  <div
                    className="prose prose-sm max-w-none overflow-hidden break-words text-sm leading-relaxed text-foreground/85 [&_*]:max-w-full [&_img]:h-auto [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: message.html }}
                  />
                </article>
              )
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 px-4 py-4 md:px-6">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-muted-foreground text-sm">{t("replyPlaceholder")}</div>
            <div className="mt-8 flex items-center justify-end">
              <Button size="sm" render={<Link href={`/compose?threadId=${thread.id}`} />}>
                {t("reply")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            <ReplyIcon className="size-4" />
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
