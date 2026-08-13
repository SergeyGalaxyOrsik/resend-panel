import { getLocale, getTranslations } from "next-intl/server"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { ContentPage } from "@/components/mail/content-page"
import { StatCards } from "@/components/stat-cards"
import { formatDate, formatDuration } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"

export default async function StatisticsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("statistics")
  const locale = await getLocale()
  const scope = await getMailboxScope(user, workspace.id)
  const stats = await getStats(workspace.id, user.id, scope)
  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0.0"
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0.0"
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0.0"

  return (
    <ContentPage title={t("title")} description={t("description")}>
      <div className="space-y-6">
        {stats.messages === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            actionLabel={t("openSettings")}
            href="/settings"
          />
        ) : null}

        <StatCards
          stats={[
            { label: t("totalSent"), value: stats.sent },
            { label: t("delivered"), value: stats.delivered, description: t("deliveryRate", { rate: deliveryRate }) },
            { label: t("opened"), value: stats.opened, description: t("openRate", { rate: openRate }) },
            { label: t("clicked"), value: stats.clicked, description: t("clickRate", { rate: clickRate }) },
            { label: t("failed"), value: stats.failed },
            { label: t("inbound"), value: stats.inbox },
            { label: t("replied"), value: stats.replied },
            { label: t("avgResponse"), value: stats.avgResponseMinutes != null ? formatDuration(stats.avgResponseMinutes) : "—" },
          ]}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("recentEvents")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t("type")}</TableHead>
                      <TableHead>{t("message")}</TableHead>
                      <TableHead className="text-right">{t("date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {event.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {event.messageId.slice(0, 16)}…
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {formatDate(event.createdAt, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ContentPage>
  )
}
