import { getTranslations } from "next-intl/server"
import { requireOwner } from "@/lib/auth"
import { listDeliveries } from "@/lib/webhook-deliveries"
import { formatDate, getFormatLocale } from "@/lib/format"
import { discardWebhookDeliveryAction, retryWebhookDeliveryAction } from "@/app/actions"
import { ContentPage } from "@/components/mail/content-page"
import { WebhookDeliveries } from "@/components/webhook-deliveries"

export default async function WebhooksPage() {
  await requireOwner()

  const t = await getTranslations("webhooks")
  const locale = await getFormatLocale()
  const deliveries = await listDeliveries()

  const timestamps = Object.fromEntries(
    deliveries.map((delivery) => [delivery.id, formatDate(delivery.createdAt, locale)])
  )

  return (
    <ContentPage title={t("title")} description={t("description")}>
      <WebhookDeliveries
        deliveries={deliveries}
        timestamps={timestamps}
        retryAction={retryWebhookDeliveryAction}
        discardAction={discardWebhookDeliveryAction}
      />
    </ContentPage>
  )
}
