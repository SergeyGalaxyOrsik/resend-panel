import Link from "next/link"
import type { Message, Thread } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Reply } from "lucide-react"

type ThreadViewProps = {
  thread: Thread
  messages: Message[]
}

export function ThreadView({ thread, messages }: ThreadViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{thread.subject}</h2>
          <p className="text-sm text-muted-foreground">
            {thread.participants.join(", ")}
          </p>
        </div>
        <Link
          href={`/compose?threadId=${thread.id}`}
        >
          <Button className="rounded-xl gap-2">
            <Reply className="size-4" />
            Reply
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="border-border/60 bg-white/90">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">
                    {message.direction === "inbound" ? message.fromEmail : message.to[0]}
                  </CardTitle>
                  <Badge className="capitalize text-xs">
                    {message.direction}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(message.createdAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="prose prose-sm max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: message.html }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
