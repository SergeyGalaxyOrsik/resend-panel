import { getTranslations } from "next-intl/server"
import { EmptyState } from "@/components/empty-state"

export default async function InboxPage() {
  const t = await getTranslations("inbox")

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
      <EmptyState
        title={t("selectThreadTitle")}
        description={t("selectThreadDescription")}
        actionLabel={t("newMessage")}
        href="/compose"
      />
    </div>
  )
}
