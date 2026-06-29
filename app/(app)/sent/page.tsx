import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { MessageList } from "@/components/message-list"
import { EmptyState } from "@/components/empty-state"

export default async function SentPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const messages = await listMessages(workspace.id, "outbound")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Sent messages</h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} sent message{messages.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title="No sent messages"
          description="Compose your first email to see it here."
          actionLabel="Compose"
          href="/compose"
        />
      ) : (
        <MessageList messages={messages} variant="sent" />
      )}
    </div>
  )
}
