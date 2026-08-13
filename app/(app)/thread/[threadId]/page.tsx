import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import {
  getCurrentWorkspace,
  getThreadWithMessages,
  listMailboxes,
  listMailboxesForUser,
} from "@/lib/store"
import { getAttachmentUrl, listAttachments } from "@/lib/attachments"
import { ThreadReader, type ReaderAttachment } from "@/components/mail/thread-reader"
import { isThreadFolder } from "@/lib/mail"

type Props = {
  params: Promise<{ threadId: string }>
  searchParams: Promise<{ from?: string }>
}

/** One reader for every folder; `from` only decides where "back" returns to. */
export default async function ThreadPage({ params, searchParams }: Props) {
  const { threadId } = await params
  const { from } = await searchParams

  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  const result = await getThreadWithMessages(workspace.id, threadId, scope)
  if (!result) notFound()

  const mailboxes =
    user.role === "owner"
      ? await listMailboxes(workspace.id)
      : await listMailboxesForUser(workspace.id, user.id)

  // Reply from the mailbox the conversation belongs to when the user has it.
  const threadMailboxId = result.thread.mailboxId
  const replyMailboxId =
    threadMailboxId && mailboxes.some((mailbox) => mailbox.id === threadMailboxId)
      ? threadMailboxId
      : (mailboxes[0]?.id ?? "")

  // Loaded here rather than fetched per message in the browser: one round trip, and
  // the signed URLs never travel through an unauthenticated endpoint.
  const attachments: ReaderAttachment[] = []
  for (const message of result.messages) {
    for (const attachment of await listAttachments(message.id)) {
      attachments.push({
        id: attachment.id,
        messageId: message.id,
        filename: attachment.filename,
        contentType: attachment.contentType,
        size: attachment.size,
        url: await getAttachmentUrl(attachment.storagePath),
      })
    }
  }

  const t = await getTranslations("folders")
  const tm = await getTranslations("mail")
  const origin = from === "sent" || from === "search" || (from && isThreadFolder(from)) ? from : "inbox"

  return (
    <ThreadReader
      thread={result.thread}
      messages={result.messages}
      attachments={attachments}
      backTo={origin === "search" ? "/search" : `/${origin}`}
      backLabel={origin === "search" ? tm("backToResults") : tm("backTo", { folder: t(origin) })}
      mailboxId={replyMailboxId}
      canReply={mailboxes.length > 0}
    />
  )
}
