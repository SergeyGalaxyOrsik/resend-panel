export type ID = string

export type Timestamp = string

export type User = {
  id: ID
  email: string
  passwordHash: string
  createdAt: Timestamp
}

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
  subject: string
  participants: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
  lastMessageAt: Timestamp
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

export type Attachment = {
  id: ID
  messageId: ID
  workspaceId: ID
  filename: string
  contentType: string
  size: number
  storagePath: string
  createdAt: Timestamp
}

