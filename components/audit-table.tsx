"use client"

import { useTranslations } from "next-intl"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditAction, AuditEntry } from "@/lib/types"

/**
 * Message keys cannot carry the dots in an action name, so the union maps to flat
 * keys here. An action with no entry falls back to its raw name, which keeps a
 * freshly added action readable instead of blowing up the page.
 */
const ACTION_LABEL_KEYS: Record<AuditAction, string> = {
  "auth.signed_in": "signedIn",
  "auth.sign_in_blocked": "signInBlocked",
  "auth.signed_out": "signedOut",
  "auth.password_changed": "passwordChanged",
  "auth.sessions_revoked": "sessionsRevoked",
  "settings.updated": "settingsUpdated",
  "settings.token_updated": "tokenUpdated",
  "settings.history_synced": "historySynced",
  "user.created": "userCreated",
  "user.mailboxes_assigned": "mailboxesAssigned",
  "user.activated": "userActivated",
  "user.deactivated": "userDeactivated",
  "user.deleted": "userDeleted",
  "mailbox.created": "mailboxCreated",
  "mailbox.updated": "mailboxUpdated",
  "mailbox.deleted": "mailboxDeleted",
  "webhook.retried": "webhookRetried",
}

/** Actions that took something away read differently from ones that added. */
const DESTRUCTIVE_ACTIONS = new Set<AuditAction>([
  "auth.sign_in_blocked",
  "user.deactivated",
  "user.deleted",
  "mailbox.deleted",
  "auth.sessions_revoked",
])

type AuditTableProps = {
  entries: AuditEntry[]
  /** Formatted on the server so the list does not shift locale after hydration. */
  timestamps: Record<string, string>
}

export function AuditTable({ entries, timestamps }: AuditTableProps) {
  const t = useTranslations("audit")

  if (!entries.length) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">{t("when")}</TableHead>
            <TableHead>{t("actor")}</TableHead>
            <TableHead>{t("action")}</TableHead>
            <TableHead>{t("target")}</TableHead>
            <TableHead className="whitespace-nowrap">{t("address")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const labelKey = ACTION_LABEL_KEYS[entry.action]
            const label = labelKey && t.has(`actions.${labelKey}`) ? t(`actions.${labelKey}`) : entry.action
            const details = summarize(entry.metadata)

            return (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {timestamps[entry.id]}
                </TableCell>
                <TableCell>{entry.actorEmail || t("systemActor")}</TableCell>
                <TableCell
                  className={DESTRUCTIVE_ACTIONS.has(entry.action) ? "font-medium text-destructive-foreground" : "font-medium"}
                >
                  {label}
                </TableCell>
                <TableCell>
                  <span className="block max-w-[28ch] truncate">{entry.target || "—"}</span>
                  {details ? (
                    <span className="block max-w-[28ch] truncate text-xs text-muted-foreground" title={details}>
                      {details}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{entry.ip || "—"}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** One line of "key: value", skipping empties so the row stays scannable. */
function summarize(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== false)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" · ")
}
