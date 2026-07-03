"use client"

import { useActionState, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AuthState } from "@/lib/types"
import { cn } from "@/lib/utils"
import { FileAttachments } from "@/components/file-attachments"

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

function renderPreview(text: string, placeholder: string) {
  const escaped = escapeHtml(text.trim() || placeholder)
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noreferrer noopener" class="text-primary underline">${url}</a>`
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
  const [text, setText] = useState(initialText)
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    id: string
    filename: string
    contentType: string
    size: number
    storagePath: string
  }>>([])
  const t = useTranslations("compose")
  const previewHtml = useMemo(() => renderPreview(text, t("previewPlaceholder")), [text, t])

  return (
    <div className={cn("grid gap-6", compact ? "lg:grid-cols-[1.2fr_0.8fr]" : "xl:grid-cols-[1.3fr_0.7fr]")}>
      <Card className="border-border/80">
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
            {attachedFiles.map((file) => (
              <input key={file.id} type="hidden" name="attachmentIds" value={file.id} />
            ))}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subject">{t("subject")}</Label>
                <Input id="subject" name="subject" defaultValue={initialSubject} placeholder={t("subjectPlaceholder")} required />
              </div>

              {!hideRecipients ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="to">{t("to")}</Label>
                  <Input id="to" name="to" defaultValue={initialTo} placeholder={t("toPlaceholder")} required />
                </div>
              ) : (
                <input type="hidden" name="to" value={initialTo} />
              )}

              <div className="space-y-2">
                <Label htmlFor="cc">{t("cc")}</Label>
                <Input id="cc" name="cc" defaultValue={initialCc} placeholder={t("ccPlaceholder")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bcc">{t("bcc")}</Label>
                <Input id="bcc" name="bcc" defaultValue={initialBcc} placeholder={t("bccPlaceholder")} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="text">{t("message")}</Label>
                <span className="text-xs text-muted-foreground">{t("livePreviewHint")}</span>
              </div>
              <Textarea
                id="text"
                name="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t("messagePlaceholder")}
                className="min-h-[300px]"
                required
              />
            </div>

            <FileAttachments
              files={attachedFiles}
              onFilesChange={setAttachedFiles}
              disabled={pending}
            />

            <div className="flex flex-wrap gap-3">
              <Button type="submit" name="intent" value="save" variant="outline">
                {t("saveDraft")}
              </Button>
              <Button type="submit" name="intent" value="send" disabled={pending}>
                {pending ? t("sending") : t("sendMessage")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-muted/30">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">{t("preview")}</CardTitle>
          <CardDescription>{t("previewDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm max-w-none rounded-xl border bg-background p-6 text-sm leading-7"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
