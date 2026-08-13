"use server"

import { revalidatePath } from "next/cache"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import {
  deleteDraft,
  deleteThreadsForever,
  getCurrentWorkspace,
  setThreadsArchived,
  setThreadsRead,
  setThreadsStarred,
  setThreadsTrashed,
} from "@/lib/store"

/**
 * Every mail mutation can move a thread between folders and change a badge, so all
 * mail surfaces are refreshed together rather than guessing which ones moved.
 */
const MAIL_PATHS = ["/inbox", "/starred", "/archive", "/trash", "/sent", "/drafts", "/dashboard"] as const

function revalidateMail() {
  for (const path of MAIL_PATHS) {
    revalidatePath(path, "layout")
  }
}

async function mailContext() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const scope = await getMailboxScope(user, workspace.id)
  return { workspaceId: workspace.id, scope }
}

export async function setStarredAction(threadIds: string[], isStarred: boolean) {
  const context = await mailContext()
  if (!context) return

  await setThreadsStarred(context.workspaceId, threadIds, isStarred, context.scope)
  revalidateMail()
}

export async function setArchivedAction(threadIds: string[], isArchived: boolean) {
  const context = await mailContext()
  if (!context) return

  await setThreadsArchived(context.workspaceId, threadIds, isArchived, context.scope)
  revalidateMail()
}

export async function setTrashedAction(threadIds: string[], isTrashed: boolean) {
  const context = await mailContext()
  if (!context) return

  await setThreadsTrashed(context.workspaceId, threadIds, isTrashed, context.scope)
  revalidateMail()
}

export async function deleteForeverAction(threadIds: string[]) {
  const context = await mailContext()
  if (!context) return

  await deleteThreadsForever(context.workspaceId, threadIds, context.scope)
  revalidateMail()
}

export async function setReadAction(threadIds: string[], isRead: boolean) {
  const context = await mailContext()
  if (!context) return

  await setThreadsRead(context.workspaceId, threadIds, isRead, context.scope)
  revalidateMail()
}

export async function deleteDraftAction(draftId: string) {
  const user = await requireCurrentUser()
  await deleteDraft(draftId, user.id)
  revalidatePath("/drafts", "layout")
}
