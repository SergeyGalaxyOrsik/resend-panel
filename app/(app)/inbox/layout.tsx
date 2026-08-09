import type { ReactNode } from "react"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getThreadPreviews, listThreads } from "@/lib/store"
import { InboxTwoPane } from "@/components/inbox-two-pane"

export default async function InboxLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  const threads = await listThreads(workspace.id, scope)
  const previews = await getThreadPreviews(workspace.id, scope)

  return (
    <InboxTwoPane threads={threads} previews={previews}>
      {children}
    </InboxTwoPane>
  )
}
