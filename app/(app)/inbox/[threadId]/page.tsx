import { notFound } from "next/navigation"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getThreadWithMessages } from "@/lib/store"
import { ThreadView } from "@/components/thread-view"

type Props = {
  params: Promise<{ threadId: string }>
}

export default async function ThreadPage({ params }: Props) {
  const { threadId } = await params
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  const result = await getThreadWithMessages(workspace.id, threadId, scope)
  if (!result) notFound()

  return <ThreadView thread={result.thread} messages={result.messages} variant="two-pane" />
}
