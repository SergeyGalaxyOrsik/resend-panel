import { requireOwner } from "@/lib/auth"
import { getCurrentWorkspace, listMailboxes, listManagedUsers } from "@/lib/store"
import {
  assignMailboxesAction,
  createUserAction,
  deleteUserAction,
  setUserActiveAction,
} from "@/app/actions"
import { getTranslations } from "next-intl/server"
import { ContentPage } from "@/components/mail/content-page"
import { UsersManager } from "@/components/users-manager"
import { formatDate, getFormatLocale } from "@/lib/format"

export default async function UsersPage() {
  const owner = await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("users")
  const locale = await getFormatLocale()
  const users = await listManagedUsers()
  const mailboxes = await listMailboxes(workspace.id)

  const createdLabels = Object.fromEntries(
    users.map((user) => [user.id, formatDate(user.createdAt, locale)])
  )

  return (
    <ContentPage title={t("title")} description={t("description")}>
      <UsersManager
        users={users}
        mailboxes={mailboxes}
        currentUserId={owner.id}
        createdLabels={createdLabels}
        createAction={createUserAction}
        assignAction={assignMailboxesAction}
        setActiveAction={setUserActiveAction}
        deleteAction={deleteUserAction}
      />
    </ContentPage>
  )
}
