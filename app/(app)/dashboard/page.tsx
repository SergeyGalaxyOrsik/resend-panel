import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { StatCards } from "@/components/stat-cards"
import { EmptyState } from "@/components/empty-state"
import { formatDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const stats = await getStats(workspace.id)

  return (
    <div className="space-y-6">
      <StatCards
        stats={[
          { label: "Total messages", value: stats.messages },
          { label: "Sent", value: stats.sent },
          { label: "Inbox", value: stats.inbox },
          { label: "Drafts", value: stats.drafts },
          { label: "Delivered", value: stats.delivered },
          { label: "Opened", value: stats.opened },
          { label: "Clicked", value: stats.clicked },
          { label: "Failed", value: stats.failed },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-white/90">
          <CardHeader>
            <CardTitle className="text-lg">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent events.</p>
            ) : (
              <ul className="space-y-3">
                {stats.recentEvents.map((event) => (
                  <li key={event.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className="capitalize">
                        {event.type}
                      </Badge>
                      <span className="text-muted-foreground">{event.messageId.slice(0, 12)}…</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <EmptyState
          title="Compose a message"
          description="Send your first email through Resend Panel."
          actionLabel="New message"
          href="/compose"
        />
      </div>
    </div>
  )
}
