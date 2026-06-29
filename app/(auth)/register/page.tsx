import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth"
import { getBootstrapState } from "@/lib/store"
import { registerAction } from "@/app/actions"
import { AuthForm } from "@/components/auth-form"
import Link from "next/link"

export default async function RegisterPage() {
  const bootstrap = await getBootstrapState()
  if (bootstrap.hasUsers) {
    redirect("/login")
  }

  const session = await getCurrentSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <>
      <AuthForm
        title="Create account"
        description="The first account becomes the workspace owner."
        action={registerAction}
        submitLabel="Create account"
        confirmPassword
      />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
          Sign in instead
        </Link>
      </p>
    </>
  )
}
