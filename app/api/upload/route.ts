import { NextResponse } from "next/server"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace } from "@/lib/store"
import { uploadAttachment, validateFileSize, createAttachmentRecord } from "@/lib/attachments"
import { createToken } from "@/lib/crypto"

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser()
    const workspace = await getCurrentWorkspace()
    if (!workspace) {
      return NextResponse.json({ error: "Workspace missing." }, { status: 400 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files.length) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 })
    }

    const validation = validateFileSize(files)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const results = []

    for (const file of files) {
      const buffer = await file.arrayBuffer()
      const fileId = createToken("file")

      const { path, size } = await uploadAttachment(
        workspace.id,
        fileId,
        file.name,
        file.type || "application/octet-stream",
        buffer
      )

      const attachment = await createAttachmentRecord(
        "", // messageId will be set later
        workspace.id,
        file.name,
        file.type || "application/octet-stream",
        size,
        path
      )

      results.push({
        id: attachment.id,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        storagePath: path,
      })
    }

    return NextResponse.json({ files: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
