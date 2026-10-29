import { createToken } from "@/lib/crypto"
import { getClientAddress, getUserAgent } from "@/lib/request"
import { supabase } from "@/lib/supabase"
import type { AuditAction, AuditEntry } from "@/lib/types"

/**
 * The administrative trail. Anything that changes who can get in, what they can
 * reach, or which credentials the workspace sends with is written here.
 *
 * Two rules hold this together. Writing an audit row must never fail the action
 * it describes, so every write is swallowed and logged. And secrets never enter
 * the row: a token change records that it changed, never the token.
 */

type RecordAuditInput = {
  action: AuditAction
  actor?: { id?: string | null; email?: string | null } | null
  workspaceId?: string | null
  target?: string
  metadata?: Record<string, unknown>
}

export async function recordAudit(input: RecordAuditInput) {
  try {
    const [ip, userAgent] = await Promise.all([safeAddress(), safeUserAgent()])

    const { error } = await supabase.from("audit_log").insert({
      id: createToken("audit"),
      workspace_id: input.workspaceId ?? null,
      actor_user_id: input.actor?.id ?? null,
      actor_email: input.actor?.email ?? "",
      action: input.action,
      target: input.target ?? "",
      metadata: input.metadata ?? {},
      ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error("[audit] write failed", { action: input.action, reason: error.message })
    }
  } catch (error) {
    console.error("[audit] write failed", {
      action: input.action,
      reason: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function listAuditEntries(limit = 100, offset = 0): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return (data || []).map(mapAuditEntry)
}

export async function countAuditEntries() {
  const { count } = await supabase.from("audit_log").select("id", { count: "exact", head: true })
  return count ?? 0
}

function mapAuditEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorEmail: (row.actor_email as string) ?? "",
    action: row.action as AuditAction,
    target: (row.target as string) ?? "",
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    ip: (row.ip as string) ?? "",
    userAgent: (row.user_agent as string) ?? "",
    createdAt: row.created_at as string,
  }
}

/** Header reads throw outside a request (background jobs, scripts). */
async function safeAddress() {
  try {
    return await getClientAddress()
  } catch {
    return ""
  }
}

async function safeUserAgent() {
  try {
    return await getUserAgent()
  } catch {
    return ""
  }
}
