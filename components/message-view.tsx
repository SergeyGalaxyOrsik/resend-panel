"use client"

import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import type { Message } from "@/lib/types"
import { formatMessageDate, getMessageTimestamp } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { MessageStatusBadge } from "@/components/emails-table"
import { cn } from "@/lib/utils"

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

type MessageViewProps = {
  message: Message
}

export function MessageView({ message }: MessageViewProps) {
  const t = useTranslations("sent")
  const tm = useTranslations("mail")
  const tc = useTranslations("common")
  const locale = useLocale()

  const recipient = message.to[0] ?? tc("unknown")
  const initials = getInitials(recipient)
  const timestamp = getMessageTimestamp(message)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-4 md:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          render={<Link href="/sent" aria-label={t("backToSent")} />}
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
          <div className="truncate font-medium text-sm">{recipient}</div>
          <div className="truncate text-muted-foreground text-xs">{message.subject}</div>
        </div>
        <MessageStatusBadge status={message.status} />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2 md:px-6">
        <Button variant="outline" size="sm" render={<Link href={`/inbox/${message.threadId}`} />}>
          <ExternalLinkIcon />
          {t("viewThread")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="space-y-1">
              <p>
                <span className="font-medium text-foreground">{tm("columnTo")}: </span>
                {message.to.join(", ")}
              </p>
              {message.cc.length > 0 ? (
                <p>
                  <span className="font-medium text-foreground">Cc: </span>
                  {message.cc.join(", ")}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <span className="block text-[11px] font-medium uppercase tracking-wide">{tm("sentAt")}</span>
              <time dateTime={timestamp} className="tabular-nums">
                {formatMessageDate(message, locale)}
              </time>
            </div>
          </div>

          <div
            className="prose prose-sm max-w-none overflow-hidden break-words text-sm leading-relaxed text-foreground/85 [&_*]:max-w-full [&_img]:h-auto [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: message.html }}
          />
        </div>
      </div>
    </div>
  )
}
