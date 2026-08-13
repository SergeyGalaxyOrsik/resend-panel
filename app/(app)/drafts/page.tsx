import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts } from "@/lib/store"
import { DraftList } from "@/components/mail/draft-list"

export default async function DraftsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const drafts = await listDrafts(workspace.id, user.id)

  return <DraftList drafts={drafts} />
}
