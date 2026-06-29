"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AuthState } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type SettingsFormProps = {
  action: Action
  testAction: Action
  syncAction: Action
  initialFromName: string
  initialFromEmail: string
  initialInboundEmail: string
  hasToken: boolean
}

const initialState: AuthState = {}

export function SettingsForm({
  action,
  testAction,
  syncAction,
  initialFromName,
  initialFromEmail,
  initialInboundEmail,
  hasToken,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [testState, testFormAction, testPending] = useActionState(testAction, initialState)
  const [syncState, syncFormAction, syncPending] = useActionState(syncAction, initialState)
  const feedback = state.error || testState.error || syncState.error
  const success = state.success || testState.success || syncState.success
  const t = useTranslations("settings")
  const ta = useTranslations("auth")

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{t("formTitle")}</CardTitle>
        <CardDescription>{t("formDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {feedback}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        {hasToken ? (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            {t("tokenConfigured")} <span className="font-mono">re_••••••••</span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("noToken")}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resendToken">{t("resendToken")}</Label>
            <Input
              id="resendToken"
              name="resendToken"
              type="password"
              placeholder={hasToken ? t("tokenPlaceholderKeep") : t("tokenPlaceholderNew")}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{t("tokenHint")}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromName">{t("fromName")}</Label>
              <Input id="fromName" name="fromName" defaultValue={initialFromName} placeholder={t("fromNamePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">{t("fromEmail")}</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={initialFromEmail}
                placeholder={ta("emailPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inboundEmail">{t("inboundEmail")}</Label>
            <Input
              id="inboundEmail"
              name="inboundEmail"
              defaultValue={initialInboundEmail}
              placeholder={t("inboundPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t.rich("webhookHint", {
                inbound: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
                events: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("saveSettings")}
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap gap-3">
          <form action={testFormAction}>
            <Button type="submit" variant="outline" disabled={testPending || !hasToken}>
              {testPending ? t("testing") : t("testConnection")}
            </Button>
          </form>
          <form action={syncFormAction}>
            <Button type="submit" variant="outline" disabled={syncPending || !hasToken}>
              {syncPending ? t("syncing") : t("syncHistory")}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
