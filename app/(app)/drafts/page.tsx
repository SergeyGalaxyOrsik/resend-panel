import { FileTextIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts } from "@/lib/store"
import { formatDate, getFormatLocale } from "@/lib/format"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function DraftsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("drafts")
  const tm = await getTranslations("mail")
  const tn = await getTranslations("nav")
  const tc = await getTranslations("common")
  const locale = await getFormatLocale()
  const drafts = await listDrafts(workspace.id, user.id)

  return (
    <div className="min-w-0 space-y-6">
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
        <div className="min-w-0 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent">
                <TableHead className="h-12 px-4 font-medium">{tm("columnTo")}</TableHead>
                <TableHead className="h-12 px-4 font-medium">{tm("columnSubject")}</TableHead>
                <TableHead className="h-12 px-4 font-medium w-[120px]">{tm("columnStatus")}</TableHead>
                <TableHead className="h-12 px-4 font-medium w-[160px]">{tm("lastActivity")}</TableHead>
                <TableHead className="h-12 px-4 font-medium w-[100px]">{tm("columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((draft) => (
                <TableRow key={draft.id} className="hover:bg-muted/50">
                  <TableCell className="h-16 max-w-[220px] px-4 font-medium">
                    <span className="block truncate">{draft.to || tc("noRecipients")}</span>
                  </TableCell>
                  <TableCell className="h-16 max-w-[320px] px-4 text-sm text-muted-foreground">
                    <span className="block truncate">{draft.subject || tc("noSubject")}</span>
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <Badge
                      variant="outline"
                      className="border-0 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                    >
                      {t("badge")}
                    </Badge>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm text-muted-foreground tabular-nums">
                    {formatDate(draft.updatedAt, locale)}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      render={<Link href={`/drafts/${draft.id}/edit`} aria-label={tm("viewDetails")} />}
                    >
                      <FileTextIcon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
