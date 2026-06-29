import type { ReactNode } from "react"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getThreadPreviews, listThreads } from "@/lib/store"
import { InboxTwoPane } from "@/components/inbox-two-pane"

export default async function InboxLayout({ children }: { children: ReactNode }) {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const threads = await listThreads(workspace.id)
  const previews = await getThreadPreviews(workspace.id)

  return (
    <InboxTwoPane threads={threads} previews={previews}>
      {children}
    </InboxTwoPane>
  )
}
