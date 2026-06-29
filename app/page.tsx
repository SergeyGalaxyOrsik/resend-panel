import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth"
import { getBootstrapState } from "@/lib/store"

export default async function Home() {
  const bootstrap = await getBootstrapState()
  if (!bootstrap.hasUsers) {
    redirect("/register")
  }

  const session = await getCurrentSession()
  if (!session) {
    redirect("/login")
  }

  redirect("/dashboard")
}
