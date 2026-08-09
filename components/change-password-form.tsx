"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AuthState } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

const initialState: AuthState = {}

export function ChangePasswordForm({ action, required }: { action: Action; required: boolean }) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const t = useTranslations("auth")
  const tc = useTranslations("common")

  return (
    <Card className="border-border/80 bg-white/95 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.35)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{t("changePassword")}</CardTitle>
        <CardDescription>
          {required ? t("changePasswordRequired") : t("changePasswordDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={pending}>
            {pending ? tc("pleaseWait") : t("changePassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
