import { notFound } from "next/navigation"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listDrafts } from "@/lib/store"
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

  const drafts = await listDrafts(workspace.id)
  const draft = drafts.find((d) => d.id === draftId)
  if (!draft) notFound()

  return (
    <EmailComposer
      title="Edit draft"
      description="Continue editing your message."
      action={composeAction}
      initialTo={draft.to}
      initialCc={draft.cc}
      initialBcc={draft.bcc}
      initialSubject={draft.subject}
      initialText={draft.text}
      threadId={draft.threadId}
      draftId={draft.id}
    />
  )
}
