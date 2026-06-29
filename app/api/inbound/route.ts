import { NextResponse } from "next/server"
import { inboundWebhookAction } from "@/app/actions"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await inboundWebhookAction(body)
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
