"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { RotateCcwIcon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AuthState, WebhookDelivery } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type WebhookDeliveriesProps = {
  deliveries: WebhookDelivery[]
  timestamps: Record<string, string>
  retryAction: Action
  discardAction: Action
}

const initialState: AuthState = {}

export function WebhookDeliveries({
  deliveries,
  timestamps,
  retryAction,
  discardAction,
}: WebhookDeliveriesProps) {
  const t = useTranslations("webhooks")

  if (!deliveries.length) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {deliveries.map((delivery) => (
        <DeliveryRow
          key={delivery.id}
          delivery={delivery}
          timestamp={timestamps[delivery.id]}
          retryAction={retryAction}
          discardAction={discardAction}
        />
      ))}
    </ul>
  )
}

function DeliveryRow({
  delivery,
  timestamp,
  retryAction,
  discardAction,
}: {
  delivery: WebhookDelivery
  timestamp?: string
  retryAction: Action
  discardAction: Action
}) {
  const t = useTranslations("webhooks")
  const [retryState, retry, retrying] = useActionState(retryAction, initialState)
  const [discardState, discard, discarding] = useActionState(discardAction, initialState)
  const message = retryState.error || discardState.error || retryState.success || discardState.success
  const isFailure = Boolean(retryState.error || discardState.error)
  const open = delivery.status === "failed"

  return (
    <li className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3">
        <Badge variant={open ? "destructive" : "outline"}>{t(`status.${delivery.status}`)}</Badge>
        <span className="text-sm font-medium">{t(`kind.${delivery.kind}`)}</span>
        <span className="text-xs text-muted-foreground">{timestamp}</span>
        <span className="text-xs text-muted-foreground">{t("attempts", { count: delivery.attempts })}</span>

        {open ? (
          <div className="ml-auto flex items-center gap-2">
            <form action={retry}>
              <input type="hidden" name="deliveryId" value={delivery.id} />
              <Button type="submit" size="sm" loading={retrying} disabled={discarding}>
                <RotateCcwIcon />
                {t("retry")}
              </Button>
            </form>
            <form action={discard}>
              <input type="hidden" name="deliveryId" value={delivery.id} />
              <Button type="submit" size="sm" variant="outline" loading={discarding} disabled={retrying}>
                <XIcon />
                {t("discard")}
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 px-4 py-3">
        <p className="text-sm break-words text-destructive-foreground">{delivery.error || "—"}</p>
        {message ? (
          <p className={isFailure ? "text-xs text-destructive-foreground" : "text-xs text-muted-foreground"}>
            {message}
          </p>
        ) : null}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">{t("showPayload")}</summary>
          {/* The payload is what makes a replay possible, so it is readable rather than hidden. */}
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-5">
            {JSON.stringify(delivery.payload, null, 2)}
          </pre>
        </details>
      </div>
    </li>
  )
}
