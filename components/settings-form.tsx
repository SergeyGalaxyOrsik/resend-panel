"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AuthState } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type SettingsFormProps = {
  action: Action
  initialFromName: string
  initialFromEmail: string
  initialInboundEmail: string
}

const initialState: AuthState = {}

export function SettingsForm({
  action,
  initialFromName,
  initialFromEmail,
  initialInboundEmail,
}: SettingsFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <Card className="border-border/80 bg-white/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.32)]">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl">Resend settings</CardTitle>
        <CardDescription>
          Configure your Resend API token and email sender identity.
        </CardDescription>
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
            <Label htmlFor="resendToken">Resend API Token</Label>
            <Input
              id="resendToken"
              name="resendToken"
              type="password"
              placeholder="re_..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Your token is encrypted and stored server-side. It never reaches the browser.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromName">From name</Label>
              <Input
                id="fromName"
                name="fromName"
                defaultValue={initialFromName}
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">From email</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={initialFromEmail}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inboundEmail">Inbound email</Label>
            <Input
              id="inboundEmail"
              name="inboundEmail"
              defaultValue={initialInboundEmail}
              placeholder="inbox@workspace.resend.dev"
            />
            <p className="text-xs text-muted-foreground">
              Configure this address in your Resend dashboard to receive inbound emails.
            </p>
          </div>

          <Button type="submit" className="rounded-xl" disabled={pending}>
            {pending ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}