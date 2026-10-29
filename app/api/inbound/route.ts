import { NextResponse } from "next/server"
import { inboundWebhookAction } from "@/app/actions"
import { reportError } from "@/lib/error-reporting"
import { logger } from "@/lib/logger"
import { recordFailedDelivery } from "@/lib/webhook-deliveries"
import { getResendWebhookSecret, verifyResendWebhook } from "@/lib/webhooks"

export async function POST(request: Request) {
  const deliveryId = request.headers.get("svix-id")
  let body: Record<string, unknown> | null = null

  try {
    const rawBody = await request.text()
    const signature = request.headers.get("svix-signature") || request.headers.get("resend-signature")

    if (
      !verifyResendWebhook(
        rawBody,
        {
          signature,
          id: deliveryId,
          timestamp: request.headers.get("svix-timestamp"),
        },
        getResendWebhookSecret("inbound")
      )
    ) {
      logger.warn("webhook.signature_rejected", { kind: "inbound", deliveryId })
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
    }

    body = JSON.parse(rawBody) as Record<string, unknown>
    const data = (body.data ?? body.email ?? body) as Record<string, unknown>

    logger.debug("webhook.received", {
      kind: "inbound",
      deliveryId,
      fields: Object.keys(data),
      htmlLength: typeof data.html === "string" ? data.html.length : 0,
      textLength: typeof data.text === "string" ? data.text.length : 0,
    })

    const result = await inboundWebhookAction(body)
    logger.info("webhook.processed", { kind: "inbound", deliveryId, ...result })
    return NextResponse.json(result)
  } catch (error) {
    // The payload is kept so the message can be replayed from /webhooks. Without
    // this, a processing bug turned a received email into nothing at all once
    // Resend gave up retrying.
    const storedId = await recordFailedDelivery({
      kind: "inbound",
      externalId: deliveryId,
      payload: body ?? {},
      error,
    })

    logger.error("webhook.failed", { kind: "inbound", deliveryId, deadLetterId: storedId, error })
    await reportError(error, {
      scope: "webhook.inbound",
      tags: { kind: "inbound" },
      extra: { deliveryId, deadLetterId: storedId },
    })

    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message, deadLetterId: storedId }, { status: 500 })
  }
}
