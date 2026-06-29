import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getCurrentSession } from "@/lib/auth"
import { getBootstrapState } from "@/lib/store"
import { loginAction } from "@/app/actions"
import { AuthForm } from "@/components/auth-form"
import { Link } from "@/i18n/navigation"
import { LanguageSwitcher } from "@/components/language-switcher"

export default async function LoginPage() {
  const t = await getTranslations("auth")
  const bootstrap = await getBootstrapState()
  if (!bootstrap.hasUsers) {
    redirect("/register")
  }

  const session = await getCurrentSession()
  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <AuthForm
        title={t("signIn")}
        description={t("signInDescription")}
        action={loginAction}
        submitLabel={t("signIn")}
      />
      {!bootstrap.hasUsers ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
            {t("createAccount")}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
