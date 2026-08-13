import { getTranslations } from "next-intl/server"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listThreadSummaries } from "@/lib/store"
import { MailList } from "@/components/mail/mail-list"
import type { MailFolder } from "@/lib/types"

/**
 * Every thread-backed folder is the same page with a different filter, so they
 * share one server component instead of six near-identical routes.
 */
export async function MailFolderView({
  folder,
  query,
}: {
  folder: MailFolder
  query?: string
}) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  const threads = await listThreadSummaries(workspace.id, folder, scope, { query })

  const t = await getTranslations("folders")
  const te = await getTranslations("empty")

  const title =
    folder === "search"
      ? te("searchTitle", { query: query ?? "" })
      : t(folder as Exclude<MailFolder, "search">)

  return (
    <MailList
      threads={threads}
      folder={folder}
      title={title}
      emptyTitle={folder === "search" ? te("searchNoResultsTitle") : te(`${folder}Title`)}
      emptyDescription={te(`${folder}Description`)}
    />
  )
}
