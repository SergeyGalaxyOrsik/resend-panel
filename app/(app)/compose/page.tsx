import { getTranslations } from "next-intl/server"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import {
  getCurrentWorkspace,
  getThreadWithMessages,
  listMailboxes,
  listMailboxesForUser,
} from "@/lib/store"
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

  const t = await getTranslations("compose")
  const { threadId } = await searchParams
  const scope = await getMailboxScope(user, workspace.id)
  const mailboxes =
    user.role === "owner"
      ? await listMailboxes(workspace.id)
      : await listMailboxesForUser(workspace.id, user.id)

  let initialTo = ""
  let initialSubject = ""
  let replyToMessageId = ""
  let title = t("newMessage")
  let description = t("newMessageDescription")
  let defaultMailboxId = mailboxes[0]?.id ?? ""

  if (threadId) {
    const result = await getThreadWithMessages(workspace.id, threadId, scope)
    if (result) {
      const lastMessage = result.messages[result.messages.length - 1]
      if (lastMessage) {
        initialTo = getReplyRecipients(lastMessage).join(", ")
        replyToMessageId = lastMessage.id
      }
      initialSubject = `Re: ${renderThreadSubject(result.thread.subject)}`
      title = t("reply")
      description = t("replyingTo", { subject: result.thread.subject })

      // Reply from the mailbox the conversation belongs to, when the user has it.
      const threadMailboxId = result.thread.mailboxId
      if (threadMailboxId && mailboxes.some((mailbox) => mailbox.id === threadMailboxId)) {
        defaultMailboxId = threadMailboxId
      }
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
      mailboxes={mailboxes}
      defaultMailboxId={defaultMailboxId}
    />
  )
}
