export type ID = string

export type Timestamp = string

export type UserRole = "owner" | "member"

export type User = {
  id: ID
  email: string
  passwordHash: string
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Timestamp
}

export type Mailbox = {
  id: ID
  workspaceId: ID
  address: string
  displayName: string
  createdAt: Timestamp
}

export type ManagedUser = Omit<User, "passwordHash"> & {
  mailboxes: Mailbox[]
}

/**
 * Which mailboxes a request is allowed to read.
 * `all` is the owner; `mailboxes` restricts every read to the listed ids, which
 * also hides mail with no mailbox link (unrecognised inbound, deleted mailboxes).
 */
export type MailboxScope = { kind: "all" } | { kind: "mailboxes"; mailboxIds: ID[] }

export type Workspace = {
  id: ID
  name: string
  ownerUserId: ID
  createdAt: Timestamp
}

export type Session = {
  id: ID
  userId: ID
  createdAt: Timestamp
  expiresAt: Timestamp
}

export type ResendSettings = {
  id: ID
  workspaceId: ID
  tokenEncrypted: string
  fromName: string
  fromEmail: string
  inboundEmail: string
  updatedAt: Timestamp
}

export type Thread = {
  id: ID
  workspaceId: ID
  mailboxId?: ID
  subject: string
  participants: string[]
  isStarred: boolean
  isArchived: boolean
  isTrashed: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  lastMessageAt: Timestamp
}

/**
 * A thread plus everything the list row needs, so the list renders from one query
 * instead of a preview lookup per row.
 */
export type ThreadSummary = Thread & {
  unreadCount: number
  messageCount: number
  snippet: string
  /** Who the row is "about": the other party, not your own mailbox. */
  correspondent: string
  hasAttachments: boolean
}

/**
 * Views the thread list can render. `drafts` is the one that is not thread-backed
 * and has its own page; `search` spans every folder except trash.
 */
export type MailFolder = "inbox" | "starred" | "archive" | "trash" | "sent" | "drafts" | "search"

export type FolderCounts = {
  inbox: number
  starred: number
  archive: number
  trash: number
  drafts: number
}

export type MessageDirection = "inbound" | "outbound"

export type MessageStatus =
  | "draft"
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "received"

export type Message = {
  id: ID
  workspaceId: ID
  mailboxId?: ID
  threadId: ID
  direction: MessageDirection
  status: MessageStatus
  subject: string
  fromName: string
  fromEmail: string
  to: string[]
  cc: string[]
  bcc: string[]
  text: string
  html: string
  isRead: boolean
  providerId?: string
  inReplyTo?: string
  references?: string[]
  sentAt?: Timestamp
  receivedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type MessageEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed"
  | "received"

export type MessageEvent = {
  id: ID
  workspaceId: ID
  messageId: ID
  type: MessageEventType
  payload: Record<string, unknown>
  createdAt: Timestamp
}

export type Draft = {
  id: ID
  workspaceId: ID
  userId?: ID
  threadId?: ID
  subject: string
  to: string
  cc: string
  bcc: string
  text: string
  updatedAt: Timestamp
}

export type AppStore = {
  users: User[]
  workspaces: Workspace[]
  sessions: Session[]
  settings: ResendSettings | null
  threads: Thread[]
  messages: Message[]
  events: MessageEvent[]
  drafts: Draft[]
}

export type AuthState = {
  error?: string
  success?: string
}

/** `createUserAction` returns the generated password once, so the owner can hand it over. */
export type CreateUserState = AuthState & {
  createdEmail?: string
  temporaryPassword?: string
}

export type Attachment = {
  id: ID
  messageId: ID | null
  workspaceId: ID
  filename: string
  contentType: string
  size: number
  storagePath: string
  createdAt: Timestamp
}

