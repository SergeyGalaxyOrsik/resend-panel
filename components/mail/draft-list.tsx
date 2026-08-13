"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Trash2Icon } from "lucide-react"
import { deleteDraftAction } from "@/app/mail-actions"
import { formatFullDate, formatListDate } from "@/lib/mail"
import type { Draft } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Same row rhythm as the mail list so the two read as one product, but drafts have
 * no read state, no star and no thread, so the row is deliberately simpler.
 */
export function DraftList({ drafts }: { drafts: Draft[] }) {
  const t = useTranslations("mail")
  const tf = useTranslations("folders")
  const te = useTranslations("empty")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [pending, startTransition] = React.useTransition()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <h1 className="truncate text-sm font-semibold">{tf("drafts")}</h1>
        {drafts.length > 0 ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {t("draftTotal", { count: drafts.length })}
          </span>
        ) : null}
      </div>

      {drafts.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 py-16 text-center">
          <p className="text-sm font-medium">{te("draftsTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{te("draftsDescription")}</p>
        </div>
      ) : (
        <ul
          className={cn(
            "min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain bg-mail-read",
            pending && "opacity-70"
          )}
        >
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="group/row relative flex items-start gap-2 px-3 transition-colors hover:bg-foreground/5 md:items-center"
            >
              <Link
                href={`/drafts/${draft.id}/edit`}
                className="flex min-w-0 flex-1 items-start gap-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:h-11 md:items-center md:gap-4 md:py-0"
              >
                <span className="min-w-0 flex-1 md:flex md:items-baseline md:gap-4">
                  <span className="flex min-w-0 items-center gap-2 md:w-52 md:shrink-0">
                    <span className="shrink-0 text-xs font-medium text-destructive">
                      {t("draftBadge")}
                    </span>
                    <span className="truncate text-sm">{draft.to || tc("noRecipients")}</span>
                  </span>

                  <span className="block min-w-0 text-sm md:flex-1 md:truncate">
                    <span className="block truncate md:inline">
                      {draft.subject || tc("noSubject")}
                    </span>
                    {draft.text ? (
                      <span className="block truncate text-muted-foreground md:inline md:before:px-1.5 md:before:text-muted-foreground/50 md:before:content-['·']">
                        {draft.text}
                      </span>
                    ) : null}
                  </span>
                </span>

                <time
                  dateTime={draft.updatedAt}
                  title={formatFullDate(draft.updatedAt, locale)}
                  className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums md:w-20 md:group-hover/row:invisible"
                >
                  {formatListDate(draft.updatedAt, locale)}
                </time>
              </Link>

              <span className="absolute inset-y-0 right-2 hidden items-center md:group-hover/row:flex md:group-focus-within/row:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("delete")}
                      disabled={pending}
                      onClick={() => startTransition(() => deleteDraftAction(draft.id))}
                    >
                      <Trash2Icon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("delete")}</TooltipContent>
                </Tooltip>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
