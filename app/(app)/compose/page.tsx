import { getTranslations } from "next-intl/server"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getCurrentSettings, getThreadWithMessages } from "@/lib/store"
import { getReplyRecipients, renderThreadSubject } from "@/lib/email"
import { composeAction } from "@/app/actions"
import { EmailComposer } from "@/components/email-composer"

type Props = {
  searchParams: Promise<{ threadId?: string }>
}

export default async function ComposePage({ searchParams }: Props) {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("compose")
  const { threadId } = await searchParams

  let initialTo = ""
  let initialSubject = ""
  let replyToMessageId = ""
  let title = t("newMessage")
  let description = t("newMessageDescription")

  if (threadId) {
    const result = await getThreadWithMessages(workspace.id, threadId)
    if (result) {
      const lastMessage = result.messages[result.messages.length - 1]
      if (lastMessage) {
        initialTo = getReplyRecipients(lastMessage).join(", ")
        replyToMessageId = lastMessage.id
      }
      initialSubject = `Re: ${renderThreadSubject(result.thread.subject)}`
      title = t("reply")
      description = t("replyingTo", { subject: result.thread.subject })
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
