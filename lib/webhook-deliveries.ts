import { createToken } from "@/lib/crypto"
import { logger } from "@/lib/logger"
import { supabase } from "@/lib/supabase"
import type { WebhookDelivery, WebhookDeliveryKind, WebhookDeliveryStatus } from "@/lib/types"

/**
 * The webhook dead-letter queue.
 *
 * `/api/inbound` answered a failure with a 500 and kept nothing. Resend retries
 * for a while and then gives up, so a bug in processing meant a received email
 * simply never existed. The payload is now stored on every failure, which makes
 * the failure recoverable instead of merely visible.
 *
 * Storing it must never be what breaks the response, so the write is swallowed
 * and logged like the audit log's.
 */

export async function recordFailedDelivery(input: {
  kind: WebhookDeliveryKind
  externalId?: string | null
  payload: unknown
  error: unknown
}) {
  const message = input.error instanceof Error ? input.error.message : String(input.error)

  try {
    // A provider retry of the same delivery updates the row instead of piling up.
    const existing = input.externalId ? await findByExternalId(input.externalId) : null

    if (existing) {
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          error: message,
          attempts: existing.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      return existing.id
    }

    const id = createToken("whd")
    const { error } = await supabase.from("webhook_deliveries").insert({
      id,
      kind: input.kind,
      external_id: input.externalId ?? null,
      status: "failed",
      payload: (input.payload ?? {}) as Record<string, unknown>,
      error: message,
      attempts: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      logger.error("webhook.deadletter_write_failed", { kind: input.kind, reason: error.message })
      return null
    }

    return id
  } catch (writeError) {
    logger.error("webhook.deadletter_write_failed", { kind: input.kind, error: writeError })
    return null
  }
}

export async function findByExternalId(externalId: string) {
  const { data } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("external_id", externalId)
    .maybeSingle()

  return data ? mapDelivery(data) : null
}

export async function findDelivery(id: string) {
  const { data } = await supabase.from("webhook_deliveries").select("*").eq("id", id).maybeSingle()
  return data ? mapDelivery(data) : null
}

export async function listDeliveries(status?: WebhookDeliveryStatus, limit = 100) {
  let query = supabase
    .from("webhook_deliveries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status) query = query.eq("status", status)

  const { data } = await query
  return (data || []).map(mapDelivery)
}

export async function countFailedDeliveries() {
  const { count } = await supabase
    .from("webhook_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")

  return count ?? 0
}

export async function markDeliveryStatus(id: string, status: WebhookDeliveryStatus, error = "") {
  await supabase
    .from("webhook_deliveries")
    .update({
      status,
      error,
      updated_at: new Date().toISOString(),
      resolved_at: status === "failed" ? null : new Date().toISOString(),
    })
    .eq("id", id)
}

export async function bumpAttempts(id: string, attempts: number) {
  await supabase
    .from("webhook_deliveries")
    .update({ attempts, updated_at: new Date().toISOString() })
    .eq("id", id)
}

function mapDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: row.id as string,
    kind: row.kind as WebhookDeliveryKind,
    externalId: (row.external_id as string | null) ?? null,
    status: row.status as WebhookDeliveryStatus,
    payload: (row.payload as Record<string, unknown>) ?? {},
    error: (row.error as string) ?? "",
    attempts: (row.attempts as number) ?? 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? null,
  }
}
