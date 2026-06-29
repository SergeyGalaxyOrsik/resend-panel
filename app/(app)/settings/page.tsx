import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, getCurrentSettings } from "@/lib/store"
import { saveSettingsAction } from "@/app/actions"
import { SettingsForm } from "@/components/settings-form"

export default async function SettingsPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const settings = await getCurrentSettings()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your Resend integration and sender identity.
        </p>
      </div>

      <SettingsForm
        action={saveSettingsAction}
        initialFromName={settings?.fromName ?? ""}
        initialFromEmail={settings?.fromEmail ?? ""}
        initialInboundEmail={settings?.inboundEmail ?? ""}
      />
    </div>
  )
}