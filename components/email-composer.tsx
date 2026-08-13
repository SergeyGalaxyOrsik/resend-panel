"use client"

import { useActionState, useState, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { PaperclipIcon, SendHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AuthState, Mailbox } from "@/lib/types"
import { FileAttachments } from "@/components/file-attachments"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type EmailComposerProps = {
  action: Action
  initialTo?: string
  initialCc?: string
  initialBcc?: string
  initialSubject?: string
  initialText?: string
  threadId?: string
  draftId?: string
  replyToMessageId?: string
  mailboxes?: Mailbox[]
  defaultMailboxId?: string
}

const initialState: AuthState = {}

/**
 * One column, one card, in the order a message is actually written: who it is from,
 * who it goes to, what it says. Cc and Bcc stay folded away until asked for, the way
 * they are in every mail client, because most messages never use them.
 */
export function EmailComposer({
  action,
  initialTo = "",
  initialCc = "",
  initialBcc = "",
  initialSubject = "",
  initialText = "",
  threadId,
  draftId,
  replyToMessageId,
  mailboxes = [],
  defaultMailboxId = "",
}: EmailComposerProps) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [text, setText] = useState(initialText)
  const [showCopies, setShowCopies] = useState(Boolean(initialCc || initialBcc))
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ id: string; filename: string; contentType: string; size: number; storagePath: string }>
  >([])
  const t = useTranslations("compose")
  const hasMailboxes = mailboxes.length > 0

  return (
    <form action={formAction} className="overflow-hidden rounded-xl border bg-card">
      {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
      {draftId ? <input type="hidden" name="draftId" value={draftId} /> : null}
      {replyToMessageId ? (
        <input type="hidden" name="replyToMessageId" value={replyToMessageId} />
      ) : null}
      {attachedFiles.map((file) => (
        <input key={file.id} type="hidden" name="attachmentIds" value={file.id} />
      ))}

      {state.error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="border-b bg-muted px-4 py-3 text-sm">{state.success}</p>
      ) : null}

      <div className="divide-y">
        {mailboxes.length > 1 ? (
          <FieldRow htmlFor="mailboxId" label={t("from")}>
            <select
              id="mailboxId"
              name="mailboxId"
              defaultValue={defaultMailboxId || mailboxes[0].id}
              className="h-8 w-full min-w-0 rounded-md bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {mailboxes.map((mailbox) => (
                <option key={mailbox.id} value={mailbox.id}>
                  {mailbox.displayName
                    ? `${mailbox.displayName} <${mailbox.address}>`
                    : mailbox.address}
                </option>
              ))}
            </select>
          </FieldRow>
        ) : mailboxes.length === 1 ? (
          <>
            <input type="hidden" name="mailboxId" value={mailboxes[0].id} />
            <FieldRow label={t("from")}>
              <span className="truncate text-sm text-muted-foreground">
                {mailboxes[0].displayName
                  ? `${mailboxes[0].displayName} <${mailboxes[0].address}>`
                  : mailboxes[0].address}
              </span>
            </FieldRow>
          </>
        ) : null}

        <FieldRow
          htmlFor="to"
          label={t("to")}
          action={
            !showCopies ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => setShowCopies(true)}
              >
                {t("addCopies")}
              </Button>
            ) : null
          }
        >
          <Input
            id="to"
            name="to"
            unstyled
            defaultValue={initialTo}
            placeholder={t("toPlaceholder")}
            className="h-8 text-sm"
            required
          />
        </FieldRow>

        {showCopies ? (
          <>
            <FieldRow htmlFor="cc" label={t("cc")}>
              <Input
                id="cc"
                name="cc"
                unstyled
                defaultValue={initialCc}
                placeholder={t("ccPlaceholder")}
                className="h-8 text-sm"
              />
            </FieldRow>
            <FieldRow htmlFor="bcc" label={t("bcc")}>
              <Input
                id="bcc"
                name="bcc"
                unstyled
                defaultValue={initialBcc}
                placeholder={t("bccPlaceholder")}
                className="h-8 text-sm"
              />
            </FieldRow>
          </>
        ) : null}

        <FieldRow htmlFor="subject" label={t("subject")}>
          <Input
            id="subject"
            name="subject"
            unstyled
            defaultValue={initialSubject}
            placeholder={t("subjectPlaceholder")}
            className="h-8 text-sm"
            required
          />
        </FieldRow>
      </div>

      <div className="border-t">
        <Label htmlFor="text" className="sr-only">
          {t("message")}
        </Label>
        <Textarea
          id="text"
          name="text"
          unstyled
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("messagePlaceholder")}
          className="block w-full [&_textarea]:min-h-72 [&_textarea]:px-4 [&_textarea]:py-3 [&_textarea]:text-sm [&_textarea]:leading-6"
          required
        />
      </div>

      <div className="border-t px-4 py-3">
        <FileAttachments files={attachedFiles} onFilesChange={setAttachedFiles} disabled={pending} />
      </div>

      {!hasMailboxes ? (
        <p className="border-t bg-muted px-4 py-3 text-sm text-muted-foreground">{t("noMailbox")}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-4 py-3">
        <Button type="submit" name="intent" value="send" loading={pending} disabled={!hasMailboxes}>
          <SendHorizontalIcon />
          {pending ? t("sending") : t("sendMessage")}
        </Button>
        <Button type="submit" name="intent" value="save" variant="ghost" disabled={pending}>
          {t("saveDraft")}
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <PaperclipIcon className="size-3.5" />
          {t("attachmentHint")}
        </span>
      </div>
    </form>
  )
}

function FieldRow({
  htmlFor,
  label,
  action,
  children,
}: {
  htmlFor?: string
  label: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-4">
      <Label
        htmlFor={htmlFor}
        className="w-16 shrink-0 py-2 text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      <div className="min-w-0 flex-1 py-1">{children}</div>
      {action}
    </div>
  )
}
