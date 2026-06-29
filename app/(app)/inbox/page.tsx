import { getLocale, getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listThreads } from "@/lib/store"
import { formatRelative } from "@/lib/format"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"

export default async function InboxPage() {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("inbox")
  const locale = await getLocale()
  const threads = await listThreads(workspace.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("threadCount", { count: threads.length })}</p>
        </div>
        <Link
          href="/compose"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("newMessage")}
        </Link>
      </div>

      {threads.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actionLabel={t("newMessage")}
          href="/compose"
        />
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/inbox/${thread.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card px-5 py-4 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{thread.subject}</span>
                  <Badge className="shrink-0 text-xs">
                    {t("participants", { count: thread.participants.length })}
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{thread.participants.join(", ")}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelative(thread.lastMessageAt, locale)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
