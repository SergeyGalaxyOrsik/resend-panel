import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace, listMessages } from "@/lib/store"
import { MessageList } from "@/components/message-list"
import { EmptyState } from "@/components/empty-state"

export default async function InboxPage() {
  const user = await requireCurrentUser()
  const workspace = await getCurrentWorkspace()
  if (!workspace) return null

  const messages = await listMessages(workspace.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">All messages</h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? "s" : ""} in your workspace.
        </p>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Send your first email to get started."
          actionLabel="Compose"
          href="/compose"
        />
      ) : (
        <MessageList messages={messages} variant="inbox" />
      )}
    </div>
  )
}
