import { supabase } from "@/lib/supabase"

/**
 * Send idempotency.
 *
 * A send used to be a bare POST to Resend. A double-clicked button, a browser
 * retry, or a timeout on a request Resend had in fact accepted all produced a
 * second delivery, and nothing in the panel could tell the difference.
 *
 * The composer mints one key per message it holds. The key is reserved here
 * before the API call and completed after it, so a retry either replays the
 * finished result or is refused as still in flight. The same key also goes to
 * Resend as `Idempotency-Key`, which covers the case this table cannot: the
 * request that timed out after Resend had already queued the mail.
 */

export type SendReceipt = {
  key: string
  messageId: string | null
  threadId: string | null
  createdAt: string
  completedAt: string | null
}

export type Reservation =
  | { status: "reserved" }
  | { status: "duplicate"; receipt: SendReceipt }

/** Postgres unique violation, which is how a duplicate key announces itself. */
const UNIQUE_VIOLATION = "23505"

/** Long enough to cover Resend's own idempotency window with room to spare. */
const RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export async function reserveSendKey(
  key: string,
  context: { workspaceId: string; userId: string }
): Promise<Reservation> {
  const { error } = await supabase.from("send_receipts").insert({
    key,
    workspace_id: context.workspaceId,
    user_id: context.userId,
    created_at: new Date().toISOString(),
  })

  if (!error) {
    return { status: "reserved" }
  }

  if (error.code !== UNIQUE_VIOLATION) {
    throw new Error(error.message)
  }

  const receipt = await findSendReceipt(key)
  if (!receipt) {
    // Deleted between the insert and the read: the retry may proceed.
    return { status: "reserved" }
  }

  return { status: "duplicate", receipt }
}

export async function findSendReceipt(key: string): Promise<SendReceipt | null> {
  const { data } = await supabase.from("send_receipts").select("*").eq("key", key).maybeSingle()
  if (!data) return null

  return {
    key: data.key as string,
    messageId: (data.message_id as string | null) ?? null,
    threadId: (data.thread_id as string | null) ?? null,
    createdAt: data.created_at as string,
    completedAt: (data.completed_at as string | null) ?? null,
  }
}

export async function completeSendKey(
  key: string,
  result: { messageId: string; threadId?: string }
) {
  await supabase
    .from("send_receipts")
    .update({
      message_id: result.messageId,
      thread_id: result.threadId ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("key", key)
}

/**
 * Frees the key after a failed send so the composer's retry is allowed through.
 * Resend's own idempotency window is what stops that retry from becoming a second
 * delivery when the failure was only the response going missing.
 */
export async function releaseSendKey(key: string) {
  await supabase.from("send_receipts").delete().eq("key", key)
}

export async function purgeOldSendReceipts(now = new Date()) {
  const cutoff = new Date(now.getTime() - RECEIPT_RETENTION_MS).toISOString()
  await supabase.from("send_receipts").delete().lt("created_at", cutoff)
}
