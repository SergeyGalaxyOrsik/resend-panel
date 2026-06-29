import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts } from "@/lib/store"
import { formatDate, getFormatLocale } from "@/lib/format"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"

export default async function DraftsPage() {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("drafts")
  const tn = await getTranslations("nav")
  const tc = await getTranslations("common")
  const locale = await getFormatLocale()
  const drafts = await listDrafts(workspace.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("draftCount", { count: drafts.length })}</p>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actionLabel={tn("compose")}
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
                    <span className="truncate text-sm font-medium">{draft.to || tc("noRecipients")}</span>
                    <Badge className="shrink-0 text-xs">{t("badge")}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {draft.subject || tc("noSubject")}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(draft.updatedAt, locale)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
