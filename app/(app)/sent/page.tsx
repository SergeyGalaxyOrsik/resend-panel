import { getTranslations } from "next-intl/server"
import { EmptyState } from "@/components/empty-state"

export default async function SentPage() {
  const t = await getTranslations("sent")
  const tn = await getTranslations("nav")

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
      <EmptyState
        title={t("selectMessageTitle")}
        description={t("selectMessageDescription")}
        actionLabel={tn("compose")}
        href="/compose"
      />
    </div>
  )
}
