import { getLocale, getTranslations } from "next-intl/server"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { MessageList } from "@/components/message-list"
import { EmptyState } from "@/components/empty-state"

export default async function SentPage() {
  await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const t = await getTranslations("sent")
  const tn = await getTranslations("nav")
  const locale = await getLocale()
  const messages = await listMessages(workspace.id, "outbound")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("messageCount", { count: messages.length })}</p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actionLabel={tn("compose")}
          href="/compose"
        />
      ) : (
        <MessageList messages={messages} variant="sent" emptyLabel={t("noMessages")} locale={locale} />
      )}
    </div>
  )
}
