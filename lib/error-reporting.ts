import { logger } from "@/lib/logger"

/**
 * Optional Sentry reporting, written against the envelope endpoint directly.
 *
 * The SDK would pull in a large dependency and a build plugin for what this
 * install needs, which is "tell me when a webhook fails". With `SENTRY_DSN` unset
 * every call here is a no-op and the structured log is the whole story.
 */

type DsnParts = { url: string; publicKey: string }

let cachedDsn: DsnParts | null | undefined

/** `https://<publicKey>@<host>/<projectId>` */
function parseDsn(dsn: string | undefined): DsnParts | null {
  if (!dsn) return null

  try {
    const parsed = new URL(dsn)
    const projectId = parsed.pathname.replace(/^\//, "")
    if (!parsed.username || !projectId) return null

    return {
      url: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
      publicKey: parsed.username,
    }
  } catch {
    return null
  }
}

function getDsn() {
  if (cachedDsn === undefined) {
    cachedDsn = parseDsn(process.env.SENTRY_DSN)
    if (process.env.SENTRY_DSN && !cachedDsn) {
      logger.warn("sentry.dsn_invalid")
    }
  }

  return cachedDsn
}

export function isErrorReportingEnabled() {
  return Boolean(getDsn())
}

export type ReportContext = {
  /** Groups the event in Sentry, e.g. "webhook.inbound". */
  scope: string
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

/**
 * Sends one error event. Reporting never throws and never blocks the caller's
 * own failure handling: if the report fails, that failure is logged and dropped.
 */
export async function reportError(error: unknown, context: ReportContext) {
  const dsn = getDsn()
  if (!dsn) return

  const normalized = error instanceof Error ? error : new Error(String(error))
  const eventId = crypto.randomUUID().replace(/-/g, "")
  const sentAt = new Date().toISOString()

  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "node",
    level: "error",
    logger: context.scope,
    environment: process.env.NODE_ENV ?? "development",
    server_name: process.env.HOSTNAME || undefined,
    tags: { scope: context.scope, ...context.tags },
    extra: context.extra,
    exception: {
      values: [
        {
          type: normalized.name,
          value: normalized.message,
          stacktrace: normalized.stack ? { frames: [{ filename: normalized.stack }] } : undefined,
        },
      ],
    },
  }

  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: sentAt }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n")

  try {
    const response = await fetch(dsn.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=resend-panel/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: envelope,
    })

    if (!response.ok) {
      logger.warn("sentry.report_rejected", { status: response.status })
    }
  } catch (reportingError) {
    logger.warn("sentry.report_failed", { error: reportingError })
  }
}
