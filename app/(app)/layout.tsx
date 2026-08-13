import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getFolderCounts } from "@/lib/store"
import { logoutAction } from "@/app/actions"
import { MailShell } from "@/components/mail/mail-shell"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()

  if (!workspace) {
    redirect("/login")
  }

  const scope = await getMailboxScope(user, workspace.id)
  const counts = await getFolderCounts(workspace.id, user.id, scope)

  // The sidebar persists its own state in a cookie; reading it here means the rail
  // renders in the right state on the server instead of snapping after hydration.
  const cookieStore = await cookies()
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <MailShell
      email={user.email}
      role={user.role}
      workspace={workspace}
      counts={counts}
      defaultSidebarOpen={defaultSidebarOpen}
      logoutAction={logoutAction}
    >
      {children}
    </MailShell>
  )
}
