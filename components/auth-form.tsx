"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AuthState } from "@/lib/types"
import { Label } from "@/components/ui/label"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type AuthFormProps = {
  title: string
  description: string
  action: Action
  submitLabel: string
  confirmPassword?: boolean
}

const initialState: AuthState = {}

export function AuthForm({ title, description, action, submitLabel, confirmPassword }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const t = useTranslations("auth")
  const tc = useTranslations("common")

  return (
    <Card className="border-border/80 bg-white/95 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.35)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}
        {state.success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.success}
          </div>
        ) : null}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {confirmPassword ? (
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
          ) : null}
          <Button type="submit" className="w-full rounded-xl" disabled={pending}>
            {pending ? tc("pleaseWait") : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
