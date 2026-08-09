import { notFound } from "next/navigation"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getMessage } from "@/lib/store"
import { MessageView } from "@/components/message-view"

type Props = {
  params: Promise<{ messageId: string }>
}

export default async function SentMessagePage({ params }: Props) {
  const { messageId } = await params
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  const message = await getMessage(workspace.id, messageId, scope)
  if (!message || message.direction !== "outbound") notFound()

  return <MessageView message={message} />
}
