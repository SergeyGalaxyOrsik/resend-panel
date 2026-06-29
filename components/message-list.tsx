import Link from "next/link"
import type { Message } from "@/lib/types"
import { formatRelative } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type MessageListProps = {
  messages: Message[]
  emptyLabel?: string
  variant?: "inbox" | "sent"
}

export function MessageList({
  messages,
  emptyLabel = "No messages.",
  variant = "inbox",
}: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-white/80 p-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map((message) => {
        const display =
          variant === "inbox"
            ? message.fromEmail
            : message.to[0] || "unknown"

        return (
          <Link
            key={message.id}
            href={`/inbox/${message.threadId}`}
            className={cn(
              "flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-white/90 px-5 py-4 transition-colors hover:bg-zinc-50"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {display}
                </span>
                <Badge className="shrink-0 capitalize text-xs">
                  {message.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {message.subject}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(message.createdAt)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
