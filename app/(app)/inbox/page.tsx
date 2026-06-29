import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listThreads } from "@/lib/store"
import { ThreadList } from "@/components/thread-list"
import { EmptyState } from "@/components/empty-state"

export default async function InboxPage() {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("inbox")
  const threads = await listThreads(workspace.id)

  return (
    <div className="min-w-0 space-y-6">
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
        <ThreadList threads={threads} />
      )}
    </div>
  )
}
