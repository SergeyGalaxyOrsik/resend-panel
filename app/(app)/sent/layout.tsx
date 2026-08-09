import type { ReactNode } from "react"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { SentTwoPane } from "@/components/sent-two-pane"

export default async function SentLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  const messages = await listMessages(workspace.id, "outbound", scope)

  return <SentTwoPane messages={messages}>{children}</SentTwoPane>
}
