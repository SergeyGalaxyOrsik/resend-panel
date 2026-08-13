"use client"

import * as React from "react"
import { useActionState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FilmIcon,
  ImageIcon,
  InboxIcon,
  MailIcon,
  PaperclipIcon,
  ReplyIcon,
  SendHorizontalIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { composeAction } from "@/app/actions"
import {
  deleteForeverAction,
  setArchivedAction,
  setReadAction,
  setStarredAction,
  setTrashedAction,
} from "@/app/mail-actions"
import { EmailBody } from "@/components/email-body"
import { avatarTone, displayNameFor, formatFileSize, formatFullDate, formatListDate, getInitials } from "@/lib/mail"
import { buildPreviewText } from "@/lib/email-html"
import { getMessageTimestamp } from "@/lib/format"
import type { AuthState, Message, Thread } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type ReaderAttachment = {
  id: string
  messageId: string
  filename: string
  contentType: string
  size: number
  url: string
}

type ThreadReaderProps = {
  thread: Thread
  messages: Message[]
  attachments: ReaderAttachment[]
  backTo: string
  backLabel: string
  mailboxId: string
  canReply: boolean
}

const initialReplyState: AuthState = {}

export function ThreadReader({
  thread,
  messages,
  attachments,
  backTo,
  backLabel,
  mailboxId,
  canReply,
}: ThreadReaderProps) {
  const t = useTranslations("mail")
  const tc = useTranslations("compose")
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()

  const lastMessage = messages[messages.length - 1]
  const markedRef = React.useRef<string | null>(null)

  /**
   * Opening a conversation reads it, which is what the folder badge counts. The ref
   * keeps the revalidation that follows from firing the action a second time.
   */
  React.useEffect(() => {
    if (markedRef.current === thread.id) return
    if (messages.every((message) => message.isRead)) return

    markedRef.current = thread.id
    setReadAction([thread.id], true)
  }, [messages, thread.id])

  // Everything is collapsed except the newest message and anything still unread,
  // so a long conversation opens on the part that actually needs reading.
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => {
    const open = new Set(messages.filter((message) => !message.isRead).map((message) => message.id))
    if (lastMessage) open.add(lastMessage.id)
    return open
  })

  function toggleMessage(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function afterAction() {
    router.push(backTo)
  }

  function runAndLeave(action: () => Promise<void>) {
    startTransition(async () => {
      await action()
      afterAction()
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-0.5 border-b px-2 md:px-3">
        <ReaderAction
          icon={ArrowLeftIcon}
          label={backLabel}
          render={<Link href={backTo} />}
        />

        <span className="w-2" aria-hidden />

        {thread.isTrashed ? (
          <>
            <ReaderAction
              icon={ArchiveRestoreIcon}
              label={t("restore")}
              disabled={pending}
              onClick={() => runAndLeave(() => setTrashedAction([thread.id], false))}
            />
            <ReaderAction
              icon={Trash2Icon}
              label={t("deleteForever")}
              disabled={pending}
              onClick={() => runAndLeave(() => deleteForeverAction([thread.id]))}
            />
          </>
        ) : (
          <>
            <ReaderAction
              icon={thread.isArchived ? InboxIcon : ArchiveIcon}
              label={thread.isArchived ? t("moveToInbox") : t("archive")}
              disabled={pending}
              onClick={() => runAndLeave(() => setArchivedAction([thread.id], !thread.isArchived))}
            />
            <ReaderAction
              icon={Trash2Icon}
              label={t("delete")}
              disabled={pending}
              onClick={() => runAndLeave(() => setTrashedAction([thread.id], true))}
            />
          </>
        )}

        <ReaderAction
          icon={MailIcon}
          label={t("markUnread")}
          disabled={pending}
          onClick={() => runAndLeave(() => setReadAction([thread.id], false))}
        />

        <ReaderAction
          icon={StarIcon}
          label={thread.isStarred ? t("unstar") : t("star")}
          pressed={thread.isStarred}
          disabled={pending}
          iconClassName={thread.isStarred ? "fill-mail-star text-mail-star" : undefined}
          onClick={() =>
            startTransition(async () => {
              await setStarredAction([thread.id], !thread.isStarred)
            })
          }
        />

        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {t("messageTotal", { count: messages.length })}
        </span>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", pending && "opacity-70")}>
        <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 md:py-7">
          <h1 className="text-xl font-semibold break-words md:text-2xl">{thread.subject}</h1>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {thread.participants.join(", ")}
          </p>

          <div className="mt-6 space-y-3">
            {messages.map((message, index) => (
              <MessageCard
                key={message.id}
                message={message}
                attachments={attachments.filter((item) => item.messageId === message.id)}
                expanded={expanded.has(message.id)}
                isLast={index === messages.length - 1}
                onToggle={() => toggleMessage(message.id)}
                locale={locale}
              />
            ))}
          </div>

          {canReply && !thread.isTrashed ? (
            <ReplyBox
              threadId={thread.id}
              subject={thread.subject}
              mailboxId={mailboxId}
              recipient={
                lastMessage
                  ? displayNameFor(
                      lastMessage.direction === "inbound"
                        ? lastMessage.fromEmail
                        : (lastMessage.to[0] ?? "")
                    )
                  : ""
              }
            />
          ) : null}

          {!canReply ? (
            <p className="mt-6 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              {tc("noMailbox")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function MessageCard({
  message,
  attachments,
  expanded,
  isLast,
  onToggle,
  locale,
}: {
  message: Message
  attachments: ReaderAttachment[]
  expanded: boolean
  isLast: boolean
  onToggle: () => void
  locale: string
}) {
  const t = useTranslations("mail")
  const sender = message.fromEmail
  const name = displayNameFor(message.fromName || sender)
  const timestamp = getMessageTimestamp(message)

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card",
        !expanded && "transition-colors hover:bg-accent/40"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:px-4"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white",
            avatarTone(sender)
          )}
        >
          {getInitials(sender)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{sender}</span>
          </span>

          {expanded ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {t("columnTo")}: {message.to.join(", ") || "—"}
              {message.cc.length ? ` · Cc: ${message.cc.join(", ")}` : ""}
            </span>
          ) : (
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {buildPreviewText(message.text, message.html)}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {attachments.length ? (
            <PaperclipIcon className="size-3.5 text-muted-foreground" aria-label={t("hasAttachments")} />
          ) : null}
          <time
            dateTime={timestamp}
            title={formatFullDate(timestamp, locale)}
            className="text-xs text-muted-foreground tabular-nums"
          >
            {isLast ? formatFullDate(timestamp, locale) : formatListDate(timestamp, locale)}
          </time>
        </span>
      </button>

      {expanded ? (
        <div className="border-t">
          {/*
           * The message renders in a sandboxed frame, so its own CSS cannot reach the
           * panel around it. No prose wrapper here: it would fight the mail's layout.
           */}
          <EmailBody html={message.html} text={message.text} title={message.subject} />

          {attachments.length ? (
            <div className="flex flex-wrap gap-2 border-t px-3 py-3 md:px-4">
              {attachments.map((attachment) => (
                <AttachmentChip key={attachment.id} attachment={attachment} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function AttachmentChip({ attachment }: { attachment: ReaderAttachment }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <FileTypeIcon contentType={attachment.contentType} />
      <span className="truncate">{attachment.filename}</span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatFileSize(attachment.size)}
      </span>
      <DownloadIcon className="size-3.5 shrink-0 text-muted-foreground" />
    </a>
  )
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  const className = "size-4 shrink-0 text-muted-foreground"

  if (contentType.startsWith("image/")) return <ImageIcon className={className} />
  if (contentType.startsWith("video/")) return <FilmIcon className={className} />
  if (contentType.includes("pdf") || contentType.includes("document")) {
    return <FileTextIcon className={className} />
  }

  return <FileIcon className={className} />
}

function ReplyBox({
  threadId,
  subject,
  mailboxId,
  recipient,
}: {
  threadId: string
  subject: string
  mailboxId: string
  recipient: string
}) {
  const t = useTranslations("mail")
  const tc = useTranslations("compose")
  const [state, formAction, pending] = useActionState(composeAction, initialReplyState)
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")

  if (!open) {
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)}>
          <ReplyIcon />
          {t("reply")}
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          render={<Link href={`/compose?threadId=${threadId}`} />}
        >
          {t("openInComposer")}
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="mt-4 rounded-xl border bg-card p-3 md:p-4">
      <input type="hidden" name="threadId" value={threadId} />
      <input type="hidden" name="subject" value={subject} />
      {mailboxId ? <input type="hidden" name="mailboxId" value={mailboxId} /> : null}

      <p className="mb-2 text-sm text-muted-foreground">
        {t("replyingTo", { recipient: recipient || "—" })}
      </p>

      {state.error ? (
        <p className="mb-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {state.error}
        </p>
      ) : null}

      <Textarea
        name="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={tc("messagePlaceholder")}
        className="[&_textarea]:min-h-32"
        required
        autoFocus
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="send" loading={pending} disabled={!text.trim()}>
          <SendHorizontalIcon />
          {pending ? tc("sending") : tc("sendMessage")}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="save"
          variant="ghost"
          disabled={pending || !text.trim()}
        >
          {tc("saveDraft")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {tc("discard")}
        </Button>
      </div>
    </form>
  )
}

function ReaderAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  pressed,
  iconClassName,
  render,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  disabled?: boolean
  pressed?: boolean
  iconClassName?: string
  render?: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          disabled={disabled}
          render={render}
        >
          <Icon className={iconClassName} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
