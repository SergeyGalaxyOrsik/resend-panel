import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { getMailboxScope, requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listThreads } from "@/lib/store"
import { logoutAction } from "@/app/actions"
import { ResendAppShell } from "@/components/resend-app-shell"
import { TooltipProvider } from "@/components/ui/tooltip"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()

  if (!workspace) {
    redirect("/login")
  }

  const scope = await getMailboxScope(user, workspace.id)
  const threads = await listThreads(workspace.id, scope)

  return (
    <TooltipProvider>
      <ResendAppShell
        user={{ email: user.email, role: user.role }}
        workspace={workspace}
        threads={threads}
        logoutAction={logoutAction}
      >
        {children}
      </ResendAppShell>
    </TooltipProvider>
  )
}
