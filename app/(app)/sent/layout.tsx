import type { ReactNode } from "react"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { SentTwoPane } from "@/components/sent-two-pane"

export default async function SentLayout({ children }: { children: ReactNode }) {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const messages = await listMessages(workspace.id, "outbound")

  return <SentTwoPane messages={messages}>{children}</SentTwoPane>
}
