import { promises as fs } from "node:fs"
import path from "node:path"
import { createToken } from "@/lib/crypto"
import type {
  AppStore,
  Draft,
  Message,
  MessageEvent,
  ResendSettings,
  Session,
  Thread,
  User,
  Workspace,
} from "@/lib/types"

const STORE_DIR = path.join(process.cwd(), ".data")
const STORE_PATH = path.join(STORE_DIR, "resend-panel.json")

const emptyStore = (): AppStore => ({
  users: [],
  workspaces: [],
  sessions: [],
  settings: null,
  threads: [],
  messages: [],
  events: [],
  drafts: [],
})

let writeQueue: Promise<unknown> = Promise.resolve()

async function ensureStoreFile() {
  await fs.mkdir(STORE_DIR, { recursive: true })
  try {
    await fs.access(STORE_PATH)
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(emptyStore(), null, 2), "utf8")
  }
}

export async function readStore(): Promise<AppStore> {
  await ensureStoreFile()
  const raw = await fs.readFile(STORE_PATH, "utf8")

  try {
    const parsed = JSON.parse(raw) as Partial<AppStore>
    return {
      ...emptyStore(),
      ...parsed,
      settings: parsed.settings ?? null,
    }
  } catch {
    const initial = emptyStore()
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8")
    return initial
  }
}

export async function updateStore<T>(
  mutator: (store: AppStore) => Promise<T> | T
): Promise<T> {
  const run = async () => {
    const store = await readStore()
    const result = await mutator(store)
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8")
    return result
  }

  writeQueue = writeQueue.then(run, run)
  return writeQueue as Promise<T>
}

export async function getBootstrapState() {
  const store = await readStore()
  return {
    hasUsers: store.users.length > 0,
    hasWorkspace: store.workspaces.length > 0,
    owner: store.users[0] ?? null,
    workspace: store.workspaces[0] ?? null,
  }
}

export async function createWorkspaceForOwner(owner: User, name?: string) {
  return updateStore((store) => {
    const workspace: Workspace = {
      id: createToken("ws"),
      ownerUserId: owner.id,
      name: name || "Primary workspace",
      createdAt: new Date().toISOString(),
    }

    store.workspaces = [workspace]
    store.settings = {
      id: createToken("settings"),
      workspaceId: workspace.id,
      tokenEncrypted: "",
      fromName: "Resend Panel",
      fromEmail: "onboarding@resend.dev",
      inboundEmail: `inbox@${workspace.id.slice(0, 8)}.local`,
      updatedAt: new Date().toISOString(),
    }

    return workspace
  })
}

export async function createSession(userId: string) {
  return updateStore((store) => {
    const session: Session = {
      id: createToken("session"),
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    }

    store.sessions = store.sessions.filter((item) => item.userId !== userId)
    store.sessions.push(session)
    return session
  })
}

export async function revokeSession(sessionId: string) {
  await updateStore((store) => {
    store.sessions = store.sessions.filter((item) => item.id !== sessionId)
  })
}

export async function findSession(sessionToken: string) {
  const store = await readStore()
  return store.sessions.find((item) => item.id === sessionToken) ?? null
}

export async function findUserByEmail(email: string) {
  const store = await readStore()
  return store.users.find((item) => item.email === email) ?? null
}

export async function findUserById(userId: string) {
  const store = await readStore()
  return store.users.find((item) => item.id === userId) ?? null
}

export async function createUser(email: string, passwordHash: string) {
  return updateStore((store) => {
    const user: User = {
      id: createToken("user"),
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    }

    store.users.push(user)
    return user
  })
}

export async function getCurrentWorkspace() {
  const store = await readStore()
  return store.workspaces[0] ?? null
}

export async function getCurrentSettings() {
  const store = await readStore()
  return store.settings
}

export async function updateResendSettings(
  updater: Partial<Pick<ResendSettings, "tokenEncrypted" | "fromName" | "fromEmail" | "inboundEmail">>
) {
  return updateStore((store) => {
    if (!store.settings) {
      throw new Error("Workspace settings are missing.")
    }

    store.settings = {
      ...store.settings,
      ...updater,
      updatedAt: new Date().toISOString(),
    }

    return store.settings
  })
}

export async function ensureThread(workspaceId: string, subject: string, participants: string[]) {
  return updateStore((store) => {
    const normalizedSubject = subject.trim() || "No subject"
    const existing = store.threads.find(
      (thread) =>
        thread.workspaceId === workspaceId &&
        thread.subject.toLowerCase() === normalizedSubject.toLowerCase()
    )

    if (existing) {
      existing.participants = Array.from(new Set([...existing.participants, ...participants]))
      existing.updatedAt = new Date().toISOString()
      existing.lastMessageAt = existing.updatedAt
      return existing
    }

    const thread: Thread = {
      id: createToken("thread"),
      workspaceId,
      subject: normalizedSubject,
      participants: Array.from(new Set(participants)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    }

    store.threads.unshift(thread)
    return thread
  })
}

export async function upsertDraft(
  workspaceId: string,
  draft: Pick<Draft, "subject" | "to" | "cc" | "bcc" | "text"> & { id?: string; threadId?: string }
) {
  return updateStore((store) => {
    const existing = draft.id
      ? store.drafts.find((item) => item.id === draft.id && item.workspaceId === workspaceId)
      : null

    if (existing) {
      existing.subject = draft.subject
      existing.to = draft.to
      existing.cc = draft.cc
      existing.bcc = draft.bcc
      existing.text = draft.text
      existing.updatedAt = new Date().toISOString()
      existing.threadId = draft.threadId
      return existing
    }

    const item: Draft = {
      id: createToken("draft"),
      workspaceId,
      threadId: draft.threadId,
      subject: draft.subject,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      text: draft.text,
      updatedAt: new Date().toISOString(),
    }

    store.drafts.unshift(item)
    return item
  })
}

export async function deleteDraft(draftId: string) {
  await updateStore((store) => {
    store.drafts = store.drafts.filter((draft) => draft.id !== draftId)
  })
}

export async function createMessage(
  payload: Omit<Message, "id" | "createdAt" | "updatedAt"> & { id?: string }
) {
  return updateStore((store) => {
    const message: Message = {
      id: payload.id ?? createToken("message"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload,
    }

    store.messages.unshift(message)
    return message
  })
}

export async function updateMessage(messageId: string, updater: Partial<Message>) {
  return updateStore((store) => {
    const message = store.messages.find((item) => item.id === messageId)
    if (!message) {
      throw new Error("Message not found.")
    }

    Object.assign(message, updater, {
      updatedAt: new Date().toISOString(),
    })

    return message
  })
}

export async function createEvent(
  workspaceId: string,
  messageId: string,
  type: MessageEvent["type"],
  payload: Record<string, unknown>
) {
  return updateStore((store) => {
    const event: MessageEvent = {
      id: createToken("event"),
      workspaceId,
      messageId,
      type,
      payload,
      createdAt: new Date().toISOString(),
    }

    store.events.unshift(event)
    return event
  })
}

export async function listMessages(workspaceId: string, direction?: Message["direction"]) {
  const store = await readStore()
  return store.messages
    .filter((message) => message.workspaceId === workspaceId)
    .filter((message) => (direction ? message.direction === direction : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listThreads(workspaceId: string) {
  const store = await readStore()
  return store.threads
    .filter((thread) => thread.workspaceId === workspaceId)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
}

export async function listDrafts(workspaceId: string) {
  const store = await readStore()
  return store.drafts
    .filter((draft) => draft.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getThreadWithMessages(workspaceId: string, threadId: string) {
  const store = await readStore()
  const thread = store.threads.find(
    (item) => item.workspaceId === workspaceId && item.id === threadId
  )
  if (!thread) {
    return null
  }

  const messages = store.messages
    .filter((message) => message.workspaceId === workspaceId && message.threadId === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return { thread, messages }
}

export async function getStats(workspaceId: string) {
  const store = await readStore()
  const messages = store.messages.filter((message) => message.workspaceId === workspaceId)
  const events = store.events.filter((event) => event.workspaceId === workspaceId)

  const countBy = (predicate: (message: Message) => boolean) => messages.filter(predicate).length

  return {
    messages: messages.length,
    sent: countBy((message) => message.direction === "outbound"),
    inbox: countBy((message) => message.direction === "inbound"),
    drafts: store.drafts.filter((draft) => draft.workspaceId === workspaceId).length,
    failed: messages.filter((message) => message.status === "failed").length,
    delivered: events.filter((event) => event.type === "delivered").length,
    opened: events.filter((event) => event.type === "opened").length,
    clicked: events.filter((event) => event.type === "clicked").length,
    replied: messages.filter((message) => message.inReplyTo).length,
    recentEvents: events.slice(0, 8),
  }
}
