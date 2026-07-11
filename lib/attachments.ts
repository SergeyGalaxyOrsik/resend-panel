import { supabase } from "@/lib/supabase"
import { createToken } from "@/lib/crypto"
import type { Attachment } from "@/lib/types"

const BUCKET = "attachments"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024 // 25MB

export { MAX_FILE_SIZE, MAX_TOTAL_SIZE }

function mapAttachment(row: any): Attachment {
  return {
    id: row.id,
    messageId: row.message_id,
    workspaceId: row.workspace_id,
    filename: row.filename,
    contentType: row.content_type,
    size: row.size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }
}

export async function uploadAttachment(
  workspaceId: string,
  fileId: string,
  filename: string,
  contentType: string,
  buffer: ArrayBuffer
): Promise<{ path: string; size: number }> {
  const ext = filename.split(".").pop() || "bin"
  const path = `${workspaceId}/${fileId}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  return { path, size: buffer.byteLength }
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  return data?.signedUrl || ""
}

export async function getAttachmentBuffer(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) return null
  return data.arrayBuffer()
}

export async function deleteAttachmentFile(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath])
}

export async function createAttachmentRecord(
  messageId: string | null,
  workspaceId: string,
  filename: string,
  contentType: string,
  size: number,
  storagePath: string
): Promise<Attachment> {
  const attachment: Attachment = {
    id: createToken("att"),
    messageId,
    workspaceId,
    filename,
    contentType,
    size,
    storagePath,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("attachments").insert({
    id: attachment.id,
    message_id: attachment.messageId,
    workspace_id: attachment.workspaceId,
    filename: attachment.filename,
    content_type: attachment.contentType,
    size: attachment.size,
    storage_path: attachment.storagePath,
    created_at: attachment.createdAt,
  })

  if (error) throw new Error(error.message)
  return attachment
}

export async function listAttachments(messageId: string): Promise<Attachment[]> {
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true })

  return (data || []).map(mapAttachment)
}

export async function listAttachmentsByWorkspace(workspaceId: string): Promise<Attachment[]> {
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  return (data || []).map(mapAttachment)
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single()

  if (data?.storage_path) {
    await deleteAttachmentFile(data.storage_path)
  }

  await supabase.from("attachments").delete().eq("id", attachmentId)
}

export async function deleteAttachmentsByMessage(messageId: string): Promise<void> {
  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("message_id", messageId)

  if (data?.length) {
    const paths = data.map((r) => r.storage_path)
    await supabase.storage.from(BUCKET).remove(paths)
  }

  await supabase.from("attachments").delete().eq("message_id", messageId)
}

export function validateFileSize(files: File[]): { valid: boolean; error?: string } {
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File "${file.name}" exceeds 10MB limit.` }
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    return { valid: false, error: `Total file size exceeds 25MB limit.` }
  }

  return { valid: true }
}
