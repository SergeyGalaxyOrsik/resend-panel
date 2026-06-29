import Link from "next/link"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts } from "@/lib/store"
import { formatDate } from "@/lib/format"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DraftsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const drafts = await listDrafts(workspace.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Drafts</h2>
        <p className="text-sm text-muted-foreground">
          {drafts.length} draft{drafts.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts"
          description="Start composing a message to create a draft."
          actionLabel="Compose"
          href="/compose"
        />
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => (
            <Link
              key={draft.id}
              href={`/drafts/${draft.id}/edit`}
              className="block rounded-2xl border border-border/60 bg-white/90 px-5 py-4 transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {draft.to || "No recipients"}
                    </span>
                    <Badge className="shrink-0 text-xs">
                      Draft
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {draft.subject || "No subject"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(draft.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
