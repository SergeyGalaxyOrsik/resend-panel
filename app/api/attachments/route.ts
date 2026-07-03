import { NextResponse } from "next/server"
import { listAttachments, getAttachmentUrl } from "@/lib/attachments"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get("messageId")

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 })
  }

  const attachments = await listAttachments(messageId)
  const results = []

  for (const att of attachments) {
    const url = await getAttachmentUrl(att.storagePath)
    results.push({
      id: att.id,
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      url,
    })
  }

  return NextResponse.json({ attachments: results })
}
