import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts, listMailboxes, listMailboxesForUser } from "@/lib/store"
import { composeAction } from "@/app/actions"
import { EmailComposer } from "@/components/email-composer"

type Props = {
  params: Promise<{ draftId: string }>
}

export default async function EditDraftPage({ params }: Props) {
  const { draftId } = await params
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("compose")
  const drafts = await listDrafts(workspace.id, user.id)
  const draft = drafts.find((d) => d.id === draftId)
  if (!draft) notFound()

  const mailboxes =
    user.role === "owner"
      ? await listMailboxes(workspace.id)
      : await listMailboxesForUser(workspace.id, user.id)

  return (
    <EmailComposer
      title={t("editDraft")}
      description={t("editDraftDescription")}
      action={composeAction}
      initialTo={draft.to}
      initialCc={draft.cc}
      initialBcc={draft.bcc}
      initialSubject={draft.subject}
      initialText={draft.text}
      threadId={draft.threadId}
      draftId={draft.id}
      mailboxes={mailboxes}
      defaultMailboxId={mailboxes[0]?.id ?? ""}
    />
  )
}
