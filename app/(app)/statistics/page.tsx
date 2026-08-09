import { getLocale, getTranslations } from "next-intl/server"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { StatCards } from "@/components/stat-cards"
import { formatDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"

export default async function StatisticsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("statistics")
  const locale = await getLocale()
  const scope = await getMailboxScope(user, workspace.id)
  const stats = await getStats(workspace.id, user.id, scope)
  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0"
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0"
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

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
          { label: t("avgResponse"), value: stats.avgResponseMinutes != null ? `${stats.avgResponseMinutes}m` : "—" },
        ]}
      />

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-lg">{t("recentEvents")}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">{t("type")}</th>
                    <th className="pb-3 pr-4">{t("message")}</th>
                    <th className="pb-3">{t("date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEvents.map((event) => (
                    <tr key={event.id} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <Badge className="capitalize">{event.type}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {event.messageId.slice(0, 16)}…
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">{formatDate(event.createdAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
