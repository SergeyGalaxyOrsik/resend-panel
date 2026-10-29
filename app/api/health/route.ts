import { NextResponse } from "next/server"
import { collectEnvProblems } from "@/lib/env"
import { logger } from "@/lib/logger"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

/** Nothing here may be cached: a cached health check reports the past. */
export const dynamic = "force-dynamic"

/** A hung database should fail the check rather than hang the monitor. */
const DATABASE_TIMEOUT_MS = 3000

type CheckState = "ok" | "error"

/**
 * Liveness and readiness in one endpoint, for the Docker HEALTHCHECK and whatever
 * watches the deployment.
 *
 * It answers 200 only when the process can actually do its job: configuration
 * valid and the database answering. Details stay out of the response because this
 * route is unauthenticated; the reason for a failure goes to the log instead.
 */
export async function GET() {
  const started = Date.now()
  const configProblems = collectEnvProblems()
  const config: CheckState = configProblems.length ? "error" : "ok"

  const database = await checkDatabase()
  const healthy = config === "ok" && database === "ok"

  if (!healthy) {
    logger.warn("health.degraded", {
      config,
      database,
      problems: configProblems.map((problem) => problem.variable),
    })
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { config, database },
      durationMs: Date.now() - started,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  )
}

async function checkDatabase(): Promise<CheckState> {
  if (!isSupabaseConfigured()) {
    return "error"
  }

  try {
    const query = supabase.from("workspaces").select("id", { count: "exact", head: true })
    const { error } = await withTimeout(query, DATABASE_TIMEOUT_MS)

    if (error) {
      logger.warn("health.database_error", { reason: error.message })
      return "error"
    }

    return "ok"
  } catch (error) {
    logger.warn("health.database_unreachable", { error })
    return "error"
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Database check timed out after ${ms}ms`)), ms)
    ),
  ])
}
