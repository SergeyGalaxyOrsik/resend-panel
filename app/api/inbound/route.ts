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

    const body = JSON.parse(rawBody) as Record<string, unknown>
    const data = (body.data ?? body.email ?? body) as Record<string, unknown>

    console.log("[inbound] webhook keys:", Object.keys(body))
    console.log("[inbound] data keys:", Object.keys(data))
    console.log("[inbound] html field:", typeof data.html === "string" ? `${data.html.length} chars` : data.html)
    console.log("[inbound] text field:", typeof data.text === "string" ? `${data.text.length} chars` : data.text)
    console.log("[inbound] content field:", typeof data.content === "string" ? `${data.content.length} chars` : data.content)

    const result = await inboundWebhookAction(body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
