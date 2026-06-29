/**
 * Migrates legacy JSON store to hosted Supabase.
 * Run: bun run scripts/migrate-json-to-supabase.ts
 */
import { readStore, createWorkspaceForOwner } from "../lib/store"
import { supabase } from "../lib/supabase"

async function upsertThread(thread: Awaited<ReturnType<typeof readStore>>["threads"][0]) {
  const { error } = await supabase.from("threads").upsert({
    id: thread.id,
    workspace_id: thread.workspaceId,
    subject: thread.subject,
    participants: thread.participants,
    created_at: thread.createdAt,
    updated_at: thread.updatedAt,
    last_message_at: thread.lastMessageAt,
  })
  if (error) throw new Error(`thread ${thread.id}: ${error.message}`)
}

async function upsertSettings(settings: NonNullable<Awaited<ReturnType<typeof readStore>>["settings"]>) {
  const { error } = await supabase.from("resend_settings").upsert({
    id: settings.id,
    workspace_id: settings.workspaceId,
    token_encrypted: settings.tokenEncrypted,
    from_name: settings.fromName,
    from_email: settings.fromEmail,
    inbound_email: settings.inboundEmail,
    updated_at: settings.updatedAt,
  })
  if (error) throw new Error(`settings: ${error.message}`)
}

async function main() {
  const store = await readStore()
  if (!store.users.length) {
    console.log("No JSON data to migrate.")
    return
  }

  for (const user of store.users) {
    const { error } = await supabase.from("users").upsert({
      id: user.id,
      email: user.email,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    })
    if (error) console.warn(`user ${user.email}: ${error.message}`)
  }

  for (const workspace of store.workspaces) {
    const { error } = await supabase.from("workspaces").upsert({
      id: workspace.id,
      name: workspace.name,
      owner_user_id: workspace.ownerUserId,
      created_at: workspace.createdAt,
    })
    if (error) console.warn(`workspace: ${error.message}`)
  }

  if (store.settings) {
    await upsertSettings(store.settings)
  } else if (store.users[0] && !store.workspaces.length) {
    await createWorkspaceForOwner(store.users[0])
  }

  for (const session of store.sessions) {
    await supabase.from("sessions").upsert({
      id: session.id,
      user_id: session.userId,
      created_at: session.createdAt,
      expires_at: session.expiresAt,
    })
  }

  for (const thread of store.threads) {
    await upsertThread(thread)
  }

  for (const message of store.messages) {
    if (!message.workspaceId) continue
    const { error } = await supabase.from("messages").upsert({
      id: message.id,
      workspace_id: message.workspaceId,
      thread_id: message.threadId,
      direction: message.direction,
      status: message.status,
      subject: message.subject,
      from_name: message.fromName,
      from_email: message.fromEmail,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      text: message.text,
      html: message.html,
      provider_id: message.providerId,
      in_reply_to: message.inReplyTo,
      references_list: message.references,
      sent_at: message.sentAt,
      received_at: message.receivedAt,
      created_at: message.createdAt,
      updated_at: message.updatedAt,
    })
    if (error) console.warn(`message ${message.id}: ${error.message}`)
  }

  for (const event of store.events) {
    await supabase.from("message_events").upsert({
      id: event.id,
      workspace_id: event.workspaceId,
      message_id: event.messageId,
      type: event.type,
      payload: event.payload,
      created_at: event.createdAt,
    })
  }

  for (const draft of store.drafts) {
    await supabase.from("drafts").upsert({
      id: draft.id,
      workspace_id: draft.workspaceId,
      thread_id: draft.threadId,
      subject: draft.subject,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      text: draft.text,
      updated_at: draft.updatedAt,
    })
  }

  console.log("Migration complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
