/**
 * Structured logging.
 *
 * The webhook handlers used to narrate themselves with `console.log("[inbound]
 * html field:", …)`, which reads fine in a terminal and is useless in a log
 * aggregator: no level, no event name, nothing to filter or alert on.
 *
 * One line of JSON per event, with a stable `event` name and whatever fields the
 * call site has. In development the same record is printed as a readable line,
 * because a wall of JSON in a dev terminal helps nobody.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogFields = Record<string, unknown>

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase()
  if (configured && configured in LEVEL_ORDER) {
    return configured as LogLevel
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug"
}

function structured() {
  // Aggregators want JSON; a developer watching `bun run dev` does not.
  return process.env.LOG_FORMAT === "json" || process.env.NODE_ENV === "production"
}

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel()]) {
    return
  }

  const detail = serializeFields(fields)
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log

  if (structured()) {
    sink(JSON.stringify({ level, event, time: new Date().toISOString(), ...detail }))
    return
  }

  sink(`[${level}] ${event}${Object.keys(detail).length ? ` ${JSON.stringify(detail)}` : ""}`)
}

/** Errors do not survive JSON.stringify, so they are unpacked before the write. */
function serializeFields(fields: LogFields): LogFields {
  const out: LogFields = {}

  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message, stack: value.stack }
      continue
    }

    out[key] = value
  }

  return out
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
}
