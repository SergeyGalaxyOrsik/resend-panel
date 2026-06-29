import { redirect } from "next/navigation"
import { getCurrentSession } from "@/lib/auth"
import { getBootstrapState } from "@/lib/store"
import { loginAction } from "@/app/actions"
import { AuthForm } from "@/components/auth-form"
import Link from "next/link"

export default async function LoginPage() {
  const bootstrap = await getBootstrapState()
  if (!bootstrap.hasUsers) {
    redirect("/register")
  }

  const session = await getCurrentSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <>
      <AuthForm
        title="Sign in"
        description="Enter your credentials to access your workspace."
        action={loginAction}
        submitLabel="Sign in"
      />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
          Create account
        </Link>
      </p>
    </>
  )
}
