'use client'

import { useMemo, useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AuthState } from "@/lib/types"
import { cn } from "@/lib/utils"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type EmailComposerProps = {
  title: string
  description: string
  action: Action
  initialTo?: string
  initialCc?: string
  initialBcc?: string
  initialSubject?: string
  initialText?: string
  threadId?: string
  draftId?: string
  replyToMessageId?: string
  hideRecipients?: boolean
  compact?: boolean
}

const initialState: AuthState = {}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderPreview(text: string) {
  const escaped = escapeHtml(text.trim() || "Your message preview will appear here.")
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noreferrer noopener" class="text-zinc-950 underline">${url}</a>`
  )

  return linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("")
}

export function EmailComposer({
  title,
  description,
  action,
  initialTo = "",
  initialCc = "",
  initialBcc = "",
  initialSubject = "",
  initialText = "",
  threadId,
  draftId,
  replyToMessageId,
  hideRecipients = false,
  compact = false,
}: EmailComposerProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const previewHtml = useMemo(() => renderPreview(initialText), [initialText])

  return (
    <div className={cn("grid gap-6", compact ? "lg:grid-cols-[1.2fr_0.8fr]" : "xl:grid-cols-[1.3fr_0.7fr]")}>
      <Card className="border-border/80 bg-white/90 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.32)]">
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
            {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
            {draftId ? <input type="hidden" name="draftId" value={draftId} /> : null}
            {replyToMessageId ? <input type="hidden" name="replyToMessageId" value={replyToMessageId} /> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" defaultValue={initialSubject} placeholder="Project update" required />
              </div>

              {!hideRecipients ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="to">To</Label>
                  <Input id="to" name="to" defaultValue={initialTo} placeholder="name@company.com" required />
                </div>
              ) : (
                <input type="hidden" name="to" value={initialTo} />
              )}

              <div className="space-y-2">
                <Label htmlFor="cc">CC</Label>
                <Input id="cc" name="cc" defaultValue={initialCc} placeholder="cc@company.com" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bcc">BCC</Label>
                <Input id="bcc" name="bcc" defaultValue={initialBcc} placeholder="bcc@company.com" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="text">Message</Label>
                <span className="text-xs text-muted-foreground">Plain text with live preview</span>
              </div>
              <Textarea
                id="text"
                name="text"
                defaultValue={initialText}
                placeholder="Write your email here..."
                className="min-h-[300px]"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" name="intent" value="save" variant="outline" className="rounded-xl">
                Save draft
              </Button>
              <Button type="submit" name="intent" value="send" className="rounded-xl" disabled={pending}>
                {pending ? "Sending..." : "Send message"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-zinc-950 text-white shadow-[0_24px_80px_-32px_rgba(0,0,0,0.48)]">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-white">Preview</CardTitle>
          <CardDescription className="text-zinc-400">
            This is the sanitized message preview that will be used for the final HTML payload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-invert max-w-none rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-7 text-zinc-100"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

