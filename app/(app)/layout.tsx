import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace } from "@/lib/store"
import { logoutAction } from "@/app/actions"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()

  return (
    <AppShell user={user} workspace={workspace} logoutAction={logoutAction}>
      {children}
    </AppShell>
  )
}
