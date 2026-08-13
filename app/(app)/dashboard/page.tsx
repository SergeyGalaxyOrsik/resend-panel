import { getLocale, getTranslations } from "next-intl/server"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { ContentPage } from "@/components/mail/content-page"
import { StatCards } from "@/components/stat-cards"
import { formatDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("dashboard")
  const tn = await getTranslations("nav")
  const locale = await getLocale()
  const scope = await getMailboxScope(user, workspace.id)
  const stats = await getStats(workspace.id, user.id, scope)

  return (
    <ContentPage
      title={tn("dashboard")}
      description={workspace.name}
      actions={
        <Button size="sm" render={<Link href="/compose" />}>
          {t("newMessage")}
        </Button>
      }
    >
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRecentEvents")}</p>
            ) : (
              <ul className="divide-y">
                {stats.recentEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {event.type}
                      </Badge>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {event.messageId.slice(0, 16)}…
                      </span>
                    </span>
                    <time
                      dateTime={event.createdAt}
                      className="shrink-0 text-xs text-muted-foreground tabular-nums"
                    >
                      {formatDate(event.createdAt, locale)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </ContentPage>
  )
}
