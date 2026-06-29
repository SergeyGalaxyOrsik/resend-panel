import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getStats } from "@/lib/store"
import { StatCards } from "@/components/stat-cards"
import { formatDate } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function StatisticsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const stats = await getStats(workspace.id)
  const deliveryRate = stats.sent > 0 ? ((stats.delivered / stats.sent) * 100).toFixed(1) : "0"
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : "0"
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Email statistics</h2>
        <p className="text-sm text-muted-foreground">
          Performance metrics for your workspace.
        </p>
      </div>

      <StatCards
        stats={[
          { label: "Total sent", value: stats.sent },
          { label: "Delivered", value: stats.delivered, description: `${deliveryRate}% delivery rate` },
          { label: "Opened", value: stats.opened, description: `${openRate}% open rate` },
          { label: "Clicked", value: stats.clicked, description: `${clickRate}% click rate` },
          { label: "Failed", value: stats.failed },
          { label: "Inbound", value: stats.inbox },
          { label: "Replied", value: stats.replied },
          { label: "Drafts", value: stats.drafts },
        ]}
      />

      <Card className="border-border/80 bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Message</th>
                    <th className="pb-3">Date</th>
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
                      <td className="py-3 text-xs text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </td>
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
