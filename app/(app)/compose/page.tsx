import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getCurrentSettings, getThreadWithMessages } from "@/lib/store"
import { getReplyRecipients, renderThreadSubject } from "@/lib/email"
import { composeAction } from "@/app/actions"
import { EmailComposer } from "@/components/email-composer"

type Props = {
  searchParams: Promise<{ threadId?: string }>
}

export default async function ComposePage({ searchParams }: Props) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const { threadId } = await searchParams

  let initialTo = ""
  let initialSubject = ""
  let replyToMessageId = ""
  let title = "New message"
  let description = "Write and send an email through Resend."

  if (threadId) {
    const result = await getThreadWithMessages(workspace.id, threadId)
    if (result) {
      const lastMessage = result.messages[result.messages.length - 1]
      if (lastMessage) {
        initialTo = getReplyRecipients(lastMessage).join(", ")
        replyToMessageId = lastMessage.id
      }
      initialSubject = `Re: ${renderThreadSubject(result.thread.subject)}`
      title = "Reply"
      description = `Replying to ${result.thread.subject}`
    }
  }

  return (
    <EmailComposer
      title={title}
      description={description}
      action={composeAction}
      initialTo={initialTo}
      initialSubject={initialSubject}
      threadId={threadId}
      replyToMessageId={replyToMessageId}
    />
  )
}
