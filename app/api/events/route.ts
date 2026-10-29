import { NextResponse } from "next/server"
import { resendEventWebhookAction } from "@/app/actions"
import { reportError } from "@/lib/error-reporting"
import { logger } from "@/lib/logger"
import { recordFailedDelivery } from "@/lib/webhook-deliveries"
import { getResendWebhookSecret, verifyResendWebhook } from "@/lib/webhooks"

export async function POST(request: Request) {
  const deliveryId = request.headers.get("svix-id")
  let body: unknown = null

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
        getResendWebhookSecret("events")
      )
    ) {
      logger.warn("webhook.signature_rejected", { kind: "events", deliveryId })
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 })
    }

    body = JSON.parse(rawBody) as unknown
    const result = await resendEventWebhookAction(body)
    logger.info("webhook.processed", { kind: "events", deliveryId, ...result })
    return NextResponse.json(result)
  } catch (error) {
    const storedId = await recordFailedDelivery({
      kind: "events",
      externalId: deliveryId,
      payload: body ?? {},
      error,
    })

    logger.error("webhook.failed", { kind: "events", deliveryId, deadLetterId: storedId, error })
    await reportError(error, {
      scope: "webhook.events",
      tags: { kind: "events" },
      extra: { deliveryId, deadLetterId: storedId },
    })

    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message, deadLetterId: storedId }, { status: 500 })
  }
}
