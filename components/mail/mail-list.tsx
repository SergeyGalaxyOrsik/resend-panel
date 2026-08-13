"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  InboxIcon,
  MailOpenIcon,
  MailIcon,
  PaperclipIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import {
  deleteForeverAction,
  setArchivedAction,
  setReadAction,
  setStarredAction,
  setTrashedAction,
} from "@/app/mail-actions"
import { avatarTone, displayNameFor, formatFullDate, formatListDate, getInitials } from "@/lib/mail"
import type { MailFolder, ThreadSummary } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type MailListProps = {
  threads: ThreadSummary[]
  folder: MailFolder
  title: string
  emptyTitle: string
  emptyDescription: string
}

/** Every action the list can run, in one shape, so the toolbar and the keys agree. */
type RowAction = "star" | "unstar" | "archive" | "unarchive" | "trash" | "restore" | "purge" | "read" | "unread"

export function MailList({ threads, folder, title, emptyTitle, emptyDescription }: MailListProps) {
  const t = useTranslations("mail")
  const locale = useLocale()
  const router = useRouter()

  const [rawSelected, setSelected] = React.useState<ReadonlySet<string>>(new Set())
  const [rawCursor, setCursor] = React.useState(-1)
  const [pending, startTransition] = React.useTransition()
  const listRef = React.useRef<HTMLUListElement>(null)

  /**
   * Acting on a row removes it from the folder, so both the selection and the
   * cursor are derived against the rows that actually exist. Deriving beats
   * correcting them afterwards: there is no frame where either points at a row
   * that is already gone.
   */
  const selected = React.useMemo(() => {
    const available = new Set(threads.map((thread) => thread.id))
    return new Set([...rawSelected].filter((id) => available.has(id)))
  }, [rawSelected, threads])

  const cursor = Math.min(rawCursor, threads.length - 1)

  const inTrash = folder === "trash"
  const inArchive = folder === "archive"
  const allSelected = threads.length > 0 && selected.size === threads.length
  const someSelected = selected.size > 0

  const run = React.useCallback(
    (action: RowAction, ids: string[], clearSelection = true) => {
      if (!ids.length) return

      startTransition(async () => {
        switch (action) {
          case "star":
            await setStarredAction(ids, true)
            break
          case "unstar":
            await setStarredAction(ids, false)
            break
          case "archive":
            await setArchivedAction(ids, true)
            break
          case "unarchive":
            await setArchivedAction(ids, false)
            break
          case "trash":
            await setTrashedAction(ids, true)
            break
          case "restore":
            await setTrashedAction(ids, false)
            break
          case "purge":
            await deleteForeverAction(ids)
            break
          case "read":
            await setReadAction(ids, true)
            break
          case "unread":
            await setReadAction(ids, false)
            break
        }
        if (clearSelection) setSelected(new Set())
      })
    },
    [startTransition]
  )

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(threads.map((thread) => thread.id)))
  }

  /** Bulk actions act on the selection; a bare keypress acts on the cursor row. */
  const targets = React.useCallback(
    (fallbackIndex: number) => {
      if (selected.size) return [...selected]
      const thread = threads[fallbackIndex]
      return thread ? [thread.id] : []
    },
    [selected, threads]
  )

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return
      }

      const key = event.key
      const move = (delta: number) => {
        event.preventDefault()
        setCursor((current) => {
          const next = Math.min(threads.length - 1, Math.max(0, current + delta))
          listRef.current
            ?.querySelectorAll("[data-row]")
            [next]?.scrollIntoView({ block: "nearest" })
          return next
        })
      }

      if (key === "j" || key === "ArrowDown") return move(cursor < 0 ? 0 : 1)
      if (key === "k" || key === "ArrowUp") return move(cursor < 0 ? 0 : -1)

      if (key === "Escape") {
        setSelected(new Set())
        return
      }

      const active = threads[cursor]

      if ((key === "Enter" || key === "o") && active) {
        event.preventDefault()
        router.push(`/thread/${active.id}?from=${folder}`)
        return
      }

      if (key === "x" && active) {
        event.preventDefault()
        toggleRow(active.id)
        return
      }

      if (key === "s" && active) {
        event.preventDefault()
        run(active.isStarred ? "unstar" : "star", [active.id], false)
        return
      }

      if (key === "e" && !inTrash) {
        event.preventDefault()
        run(inArchive ? "unarchive" : "archive", targets(cursor))
        return
      }

      if (key === "#" || key === "Delete") {
        event.preventDefault()
        run(inTrash ? "purge" : "trash", targets(cursor))
        return
      }

      if (key === "I") {
        event.preventDefault()
        run("read", targets(cursor))
        return
      }

      if (key === "U") {
        event.preventDefault()
        run("unread", targets(cursor))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cursor, folder, inArchive, inTrash, router, run, targets, threads])

  const selectionIds = [...selected]

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Padding mirrors the row below it exactly: the select-all box and the row
          boxes have to land on the same vertical axis. */}
      <div className="flex h-12 shrink-0 items-center gap-1 border-b pr-2 pl-1 md:pr-3 md:pl-2">
        <span className="hidden h-8 shrink-0 items-center px-1.5 md:flex">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            disabled={threads.length === 0}
            aria-label={t("selectAll")}
          />
        </span>

        {someSelected ? (
          <>
            <span className="mx-1 text-sm font-medium tabular-nums">
              {t("selectedCount", { count: selected.size })}
            </span>
            {!inTrash ? (
              <ToolbarAction
                icon={inArchive ? InboxIcon : ArchiveIcon}
                label={inArchive ? `${t("moveToInbox")} (E)` : `${t("archive")} (E)`}
                disabled={pending}
                onClick={() => run(inArchive ? "unarchive" : "archive", selectionIds)}
              />
            ) : (
              <ToolbarAction
                icon={ArchiveRestoreIcon}
                label={t("restore")}
                disabled={pending}
                onClick={() => run("restore", selectionIds)}
              />
            )}
            <ToolbarAction
              icon={Trash2Icon}
              label={inTrash ? t("deleteForever") : `${t("delete")} (#)`}
              disabled={pending}
              onClick={() => run(inTrash ? "purge" : "trash", selectionIds)}
            />
            <ToolbarAction
              icon={MailOpenIcon}
              label={`${t("markRead")} (⇧I)`}
              disabled={pending}
              onClick={() => run("read", selectionIds)}
            />
            <ToolbarAction
              icon={MailIcon}
              label={`${t("markUnread")} (⇧U)`}
              disabled={pending}
              onClick={() => run("unread", selectionIds)}
            />
            <ToolbarAction
              icon={StarIcon}
              label={t("star")}
              disabled={pending}
              onClick={() => run("star", selectionIds)}
            />
          </>
        ) : (
          <>
            <h1 className="ml-2 truncate text-sm font-semibold md:ml-1">{title}</h1>
            {threads.length > 0 ? (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                {t("threadTotal", { count: threads.length })}
              </span>
            ) : null}
          </>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-16 text-center">
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className={cn(
            "min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain bg-mail-read",
            pending && "opacity-70"
          )}
        >
          {threads.map((thread, index) => {
            const unread = thread.unreadCount > 0
            const isSelected = selected.has(thread.id)
            const name = displayNameFor(thread.correspondent)

            return (
              <li
                key={thread.id}
                data-row
                className={cn(
                  "group/row relative flex items-start gap-1 pr-2 pl-1 transition-colors md:items-center md:pr-3 md:pl-2",
                  unread ? "bg-mail-unread" : "hover:bg-foreground/5",
                  isSelected && "bg-mail-selected hover:bg-mail-selected",
                  index === cursor && "ring-1 ring-ring ring-inset"
                )}
              >
                <span className="hidden h-11 shrink-0 items-center px-1.5 md:flex">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleRow(thread.id)}
                    aria-label={t("selectRow", { subject: thread.subject })}
                  />
                </span>

                <span className="flex h-11 shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={thread.isStarred ? t("unstar") : t("star")}
                    aria-pressed={thread.isStarred}
                    onClick={() => run(thread.isStarred ? "unstar" : "star", [thread.id], false)}
                  >
                    <StarIcon
                      className={cn(
                        "opacity-100",
                        thread.isStarred
                          ? "fill-mail-star text-mail-star"
                          : "text-muted-foreground/50"
                      )}
                    />
                  </Button>
                </span>

                <Link
                  href={`/thread/${thread.id}?from=${folder}`}
                  className="flex min-w-0 flex-1 items-start gap-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:h-11 md:items-center md:gap-4 md:py-0"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white md:hidden",
                      avatarTone(thread.correspondent)
                    )}
                  >
                    {getInitials(thread.correspondent)}
                  </span>

                  <span className="min-w-0 flex-1 md:flex md:items-baseline md:gap-4">
                    <span
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 md:w-52 md:shrink-0",
                        unread ? "font-semibold" : "font-normal"
                      )}
                    >
                      <span className="truncate text-sm">{name}</span>
                      {thread.messageCount > 1 ? (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {thread.messageCount}
                        </span>
                      ) : null}
                    </span>

                    <span className="block min-w-0 text-sm md:flex-1 md:truncate">
                      {/* Each holds one line on its own row on mobile and collapses
                          into a single truncated line from md up. */}
                      <span
                        className={cn(
                          "block truncate md:inline",
                          unread ? "font-semibold" : undefined
                        )}
                      >
                        {thread.subject}
                      </span>
                      {/* Guarded: the separator is drawn by the snippet, so an empty
                          one would leave a dangling dot after the subject. */}
                      {thread.snippet ? (
                        <span className="block truncate text-muted-foreground md:inline md:before:px-1.5 md:before:text-muted-foreground/50 md:before:content-['·']">
                          {thread.snippet}
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1.5 md:group-hover/row:invisible">
                    {thread.hasAttachments ? (
                      <PaperclipIcon
                        className="size-3.5 text-muted-foreground"
                        aria-label={t("hasAttachments")}
                      />
                    ) : null}
                    <time
                      dateTime={thread.lastMessageAt}
                      title={formatFullDate(thread.lastMessageAt, locale)}
                      className={cn(
                        "w-16 text-right text-xs tabular-nums md:w-20",
                        unread ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {formatListDate(thread.lastMessageAt, locale)}
                    </time>
                  </span>
                </Link>

                {/*
                 * Row actions sit on top of the date rather than beside it, so the
                 * date column never shifts and rows stay aligned on hover.
                 */}
                <span className="absolute inset-y-0 right-2 hidden items-center gap-0.5 pl-2 md:group-hover/row:flex md:group-focus-within/row:flex">
                  {!inTrash ? (
                    <ToolbarAction
                      icon={inArchive ? InboxIcon : ArchiveIcon}
                      label={inArchive ? t("moveToInbox") : t("archive")}
                      disabled={pending}
                      onClick={() => run(inArchive ? "unarchive" : "archive", [thread.id])}
                    />
                  ) : (
                    <ToolbarAction
                      icon={ArchiveRestoreIcon}
                      label={t("restore")}
                      disabled={pending}
                      onClick={() => run("restore", [thread.id])}
                    />
                  )}
                  <ToolbarAction
                    icon={Trash2Icon}
                    label={inTrash ? t("deleteForever") : t("delete")}
                    disabled={pending}
                    onClick={() => run(inTrash ? "purge" : "trash", [thread.id])}
                  />
                  <ToolbarAction
                    icon={unread ? MailOpenIcon : MailIcon}
                    label={unread ? t("markRead") : t("markUnread")}
                    disabled={pending}
                    onClick={() => run(unread ? "read" : "unread", [thread.id])}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ToolbarAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled}>
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
