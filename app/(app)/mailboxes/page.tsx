import { requireOwner } from "@/lib/auth"
import { getCurrentWorkspace, listMailboxes, listManagedUsers } from "@/lib/store"
import { createMailboxAction, deleteMailboxAction, updateMailboxAction } from "@/app/actions"
import { getTranslations } from "next-intl/server"
import { ContentPage } from "@/components/mail/content-page"
import { MailboxesManager } from "@/components/mailboxes-manager"
import { formatDate, getFormatLocale } from "@/lib/format"

export default async function MailboxesPage() {
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("mailboxes")
  const locale = await getFormatLocale()
  const mailboxes = await listMailboxes(workspace.id)
  const users = await listManagedUsers()

  const assignedCounts: Record<string, number> = {}
  for (const user of users) {
    for (const mailbox of user.mailboxes) {
      assignedCounts[mailbox.id] = (assignedCounts[mailbox.id] ?? 0) + 1
    }
  }

  const createdLabels = Object.fromEntries(
    mailboxes.map((mailbox) => [mailbox.id, formatDate(mailbox.createdAt, locale)])
  )

  return (
    <ContentPage title={t("title")} description={t("description")}>
      <MailboxesManager
        mailboxes={mailboxes}
        assignedCounts={assignedCounts}
        createdLabels={createdLabels}
        createAction={createMailboxAction}
        updateAction={updateMailboxAction}
        deleteAction={deleteMailboxAction}
      />
    </ContentPage>
  )
}
