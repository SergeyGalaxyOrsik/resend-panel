import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { requireOwner } from "@/lib/auth"
import { countAuditEntries, listAuditEntries } from "@/lib/audit"
import { formatDate, getFormatLocale } from "@/lib/format"
import { ContentPage } from "@/components/mail/content-page"
import { AuditTable } from "@/components/audit-table"
import { Button } from "@/components/ui/button"

const PAGE_SIZE = 50

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireOwner()

  const { page } = await searchParams
  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const t = await getTranslations("audit")
  const locale = await getFormatLocale()
  const [entries, total] = await Promise.all([
    listAuditEntries(PAGE_SIZE, offset),
    countAuditEntries(),
  ])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const timestamps = Object.fromEntries(
    entries.map((entry) => [entry.id, formatDate(entry.createdAt, locale)])
  )

  return (
    <ContentPage title={t("title")} description={t("description")}>
      <div className="space-y-4">
        <AuditTable entries={entries} timestamps={timestamps} />

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t("pageOf", { page: currentPage, pages: lastPage, total })}
            </p>
            <div className="flex items-center gap-2">
              <PageLink href={`/audit?page=${currentPage - 1}`} disabled={currentPage <= 1}>
                {t("previous")}
              </PageLink>
              <PageLink href={`/audit?page=${currentPage + 1}`} disabled={currentPage >= lastPage}>
                {t("next")}
              </PageLink>
            </div>
          </div>
        ) : null}
      </div>
    </ContentPage>
  )
}

/**
 * `disabled` on an anchor is decoration, so the dead end of the range renders as
 * a real button instead of a link that still navigates.
 */
function PageLink({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" render={<Link href={href} />}>
      {children}
    </Button>
  )
}
