import { getLocale, getTranslations } from "next-intl/server"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { StatCards } from "@/components/stat-cards"
import { EmptyState } from "@/components/empty-state"
import { formatDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("dashboard")
  const locale = await getLocale()
  const stats = await getStats(workspace.id)

  return (
    <div className="space-y-6">
      <StatCards
        stats={[
          { label: t("totalMessages"), value: stats.messages },
          { label: t("sent"), value: stats.sent },
          { label: t("inbox"), value: stats.inbox },
          { label: t("drafts"), value: stats.drafts },
          { label: t("delivered"), value: stats.delivered },
          { label: t("opened"), value: stats.opened },
          { label: t("clicked"), value: stats.clicked },
          { label: t("failed"), value: stats.failed },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-white/90">
          <CardHeader>
            <CardTitle className="text-lg">{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRecentEvents")}</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className="capitalize">{event.type}</Badge>
                      <span className="text-muted-foreground">{event.messageId.slice(0, 12)}…</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(event.createdAt, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <EmptyState
          title={t("composeTitle")}
          description={t("composeDescription")}
          actionLabel={t("newMessage")}
          href="/compose"
        />
      </div>
    </div>
  )
}
