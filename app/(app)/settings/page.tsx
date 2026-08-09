import { getTranslations } from "next-intl/server"
import { requireOwner } from "@/lib/auth"
import { getCurrentWorkspace, getCurrentSettings } from "@/lib/store"
import { saveSettingsAction, syncResendHistoryAction, testResendConnectionAction } from "@/app/actions"
import { SettingsForm } from "@/components/settings-form"

export default async function SettingsPage() {
  await requireOwner()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("settings")
  const settings = await getCurrentSettings()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <SettingsForm
        action={saveSettingsAction}
        testAction={testResendConnectionAction}
        syncAction={syncResendHistoryAction}
        initialFromName={settings?.fromName ?? ""}
        initialFromEmail={settings?.fromEmail ?? ""}
        initialInboundEmail={settings?.inboundEmail ?? ""}
        hasToken={Boolean(settings?.tokenEncrypted)}
      />
    </div>
  )
}
