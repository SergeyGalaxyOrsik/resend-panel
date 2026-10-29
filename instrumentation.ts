import type { Instrumentation } from "next"

import { assertRuntimeEnv } from "@/lib/env"
import { reportError } from "@/lib/error-reporting"
import { logger } from "@/lib/logger"

/**
 * Runs once per server instance, before the first request is served. A container
 * with a missing or placeholder `APP_SECRET` dies here with the variable named,
 * instead of booting and mangling every secret it touches.
 *
 * The build itself has no secrets, so the check is skipped while Next is
 * prerendering; `docker build` stays runnable without a key.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  if (process.env.NEXT_PHASE?.includes("build")) {
    return
  }

  assertRuntimeEnv()
}

/**
 * Every server error Next catches, in one line of structured JSON and, when a DSN
 * is configured, in Sentry. Route handlers report their own failures with more
 * context; this is the net under everything else.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  logger.error("request.failed", {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    error,
  })

  await reportError(error, {
    scope: "request",
    tags: { routerKind: context.routerKind },
    extra: { path: request.path, method: request.method, routePath: context.routePath },
  })
}
