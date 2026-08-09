import { requireAuthenticatedUser } from "@/lib/auth"
import { changePasswordAction, logoutAction } from "@/app/actions"
import { ChangePasswordForm } from "@/components/change-password-form"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Button } from "@/components/ui/button"
import { getTranslations } from "next-intl/server"

export default async function ChangePasswordPage() {
  // Deliberately not requireCurrentUser(): that helper redirects here while the
  // forced-change flag is set, which would loop.
  const user = await requireAuthenticatedUser()
  const t = await getTranslations("nav")

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      <ChangePasswordForm action={changePasswordAction} required={user.mustChangePassword} />
      <form action={logoutAction} className="flex justify-center">
        <Button type="submit" variant="link" size="sm">
          {t("logOut")}
        </Button>
      </form>
    </div>
  )
}
