import { NextResponse } from "next/server"
import { inboundWebhookAction } from "@/app/actions"
import { getResendWebhookSecret, verifyResendWebhook } from "@/lib/webhooks"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("svix-signature") || request.headers.get("resend-signature")

    if (
      !verifyResendWebhook(
        rawBody,
        {
          signature,
          id: request.headers.get("svix-id"),
          timestamp: request.headers.get("svix-timestamp"),
        },
        getResendWebhookSecret("inbound")
      )
    ) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
    }

    const body = JSON.parse(rawBody) as unknown
    const result = await inboundWebhookAction(body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
