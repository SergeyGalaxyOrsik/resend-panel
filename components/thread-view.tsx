"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { Message, Thread } from "@/lib/types"
import { formatDate } from "@/lib/format"
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
  const td = useTranslations("direction")
  const locale = useLocale()

  return (
    <div className="space-y-6">
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

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{thread.subject}</h2>
          <p className="text-sm text-muted-foreground">{thread.participants.join(", ")}</p>
        </div>
        <Link href={`/compose?threadId=${thread.id}`}>
          <Button className="gap-2">
            <Reply className="size-4" />
            {t("reply")}
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">
                    {message.direction === "inbound" ? message.fromEmail : message.to[0]}
                  </CardTitle>
                  <Badge className="capitalize text-xs">{td(message.direction)}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(message.createdAt, locale)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: message.html }} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
