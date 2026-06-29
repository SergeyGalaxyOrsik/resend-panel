import { notFound } from "next/navigation"
import { requireCurrentUser } from "@/lib/auth"
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

  const result = await getThreadWithMessages(workspace.id, threadId)
  if (!result) notFound()

  return <ThreadView thread={result.thread} messages={result.messages} />
}
