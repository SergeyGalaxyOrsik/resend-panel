import { notFound } from "next/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getMessage } from "@/lib/store"
import { MessageView } from "@/components/message-view"

type Props = {
  params: Promise<{ messageId: string }>
}

export default async function SentMessagePage({ params }: Props) {
  const { messageId } = await params
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const message = await getMessage(workspace.id, messageId)
  if (!message || message.direction !== "outbound") notFound()

  return <MessageView message={message} />
}
