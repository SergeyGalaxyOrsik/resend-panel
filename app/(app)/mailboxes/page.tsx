import { requireOwner } from "@/lib/auth"
import { getCurrentWorkspace, listMailboxes, listManagedUsers } from "@/lib/store"
import { createMailboxAction, deleteMailboxAction, updateMailboxAction } from "@/app/actions"
import { MailboxesManager } from "@/components/mailboxes-manager"
import { formatDate, getFormatLocale } from "@/lib/format"

export default async function MailboxesPage() {
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

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
    <MailboxesManager
      mailboxes={mailboxes}
      assignedCounts={assignedCounts}
      createdLabels={createdLabels}
      createAction={createMailboxAction}
      updateAction={updateMailboxAction}
      deleteAction={deleteMailboxAction}
    />
  )
}
