import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MailboxScope } from "@/lib/types"

/**
 * Mailbox isolation lives entirely in application code: the server talks to
 * Supabase with the secret key, so a query that forgets its scope returns another
 * mailbox's mail and nothing in the database stops it.
 *
 * These tests stand a recording client in for Supabase and assert the filters the
 * store actually sends, plus the decisions it makes on the rows that come back.
 */

type Filter = { op: string; column: string; value: unknown }
type Call = { table: string; filters: Filter[] }

const calls: Call[] = []
let rows: Record<string, Record<string, unknown>[]> = {}

function builderFor(table: string) {
  const call: Call = { table, filters: [] }
  calls.push(call)

  const result = () => ({ data: rows[table] ?? [], error: null, count: (rows[table] ?? []).length })

  const builder: Record<string, unknown> = {}
  const chain = (op: string) => (column: string, value: unknown) => {
    call.filters.push({ op, column, value })
    return builder
  }

  Object.assign(builder, {
    select: () => builder,
    eq: chain("eq"),
    neq: chain("neq"),
    in: chain("in"),
    gte: chain("gte"),
    lt: chain("lt"),
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    update: () => builder,
    insert: () => builder,
    delete: () => builder,
    maybeSingle: () => Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve, reject),
  })

  return builder
}

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => builderFor(table) },
  isSupabaseConfigured: () => true,
  getSupabaseUrl: () => "https://project.supabase.co",
}))

const { getThreadWithMessages, listThreadSummaries, getFolderCounts } = await import("@/lib/store")
const MEMBER: MailboxScope = { kind: "mailboxes", mailboxIds: ["mbx_support"] }
const OWNER: MailboxScope = { kind: "all" }

function filtersFor(table: string) {
  return calls.filter((call) => call.table === table).flatMap((call) => call.filters)
}

function mailboxFiltersFor(table: string) {
  return filtersFor(table).filter((filter) => filter.column === "mailbox_id")
}

beforeEach(() => {
  calls.length = 0
  rows = {}
})

describe("listThreadSummaries", () => {
  it("restricts both the thread and the message read to the member's mailboxes", async () => {
    rows.threads = [{ id: "thr_1", workspace_id: "ws_1", mailbox_id: "mbx_support", participants: [] }]
    rows.messages = [
      {
        id: "msg_1",
        thread_id: "thr_1",
        text: "hello",
        from_email: "a@example.com",
        to: ["support@example.com"],
        direction: "inbound",
        is_read: false,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]

    await listThreadSummaries("ws_1", "inbox", MEMBER)

    // The message read matters as much as the thread read: the snippet is message text.
    expect(mailboxFiltersFor("threads")).toContainEqual({
      op: "in",
      column: "mailbox_id",
      value: ["mbx_support"],
    })
    expect(mailboxFiltersFor("messages")).toContainEqual({
      op: "in",
      column: "mailbox_id",
      value: ["mbx_support"],
    })
  })

  it("leaves the owner unfiltered", async () => {
    rows.threads = [{ id: "thr_1", workspace_id: "ws_1", mailbox_id: null, participants: [] }]
    rows.messages = []

    await listThreadSummaries("ws_1", "inbox", OWNER)

    expect(mailboxFiltersFor("threads")).toEqual([])
    expect(mailboxFiltersFor("messages")).toEqual([])
  })

  it("returns nothing, and reads nothing, for a member with no mailboxes", async () => {
    rows.threads = []

    const summaries = await listThreadSummaries("ws_1", "inbox", { kind: "mailboxes", mailboxIds: [] })

    expect(summaries).toEqual([])
    expect(mailboxFiltersFor("threads")).toContainEqual({ op: "in", column: "mailbox_id", value: [] })
  })

  it("scopes the outbound lookup that builds the Sent folder", async () => {
    rows.messages = [{ thread_id: "thr_1" }]
    rows.threads = [{ id: "thr_1", workspace_id: "ws_1", mailbox_id: "mbx_support", participants: [] }]

    await listThreadSummaries("ws_1", "sent", MEMBER)

    expect(mailboxFiltersFor("messages").length).toBeGreaterThanOrEqual(2)
  })
})

describe("getThreadWithMessages", () => {
  it("opens a thread that belongs to one of the member's mailboxes", async () => {
    rows.threads = [{ id: "thr_1", workspace_id: "ws_1", mailbox_id: "mbx_support", participants: [] }]
    rows.messages = []

    const result = await getThreadWithMessages("ws_1", "thr_1", MEMBER)
    expect(result?.thread.id).toBe("thr_1")
  })

  it("refuses a thread from another mailbox", async () => {
    rows.threads = [{ id: "thr_2", workspace_id: "ws_1", mailbox_id: "mbx_billing", participants: [] }]

    expect(await getThreadWithMessages("ws_1", "thr_2", MEMBER)).toBeNull()
  })

  it("refuses unrouted mail, which stays owner-only", async () => {
    rows.threads = [{ id: "thr_3", workspace_id: "ws_1", mailbox_id: null, participants: [] }]

    expect(await getThreadWithMessages("ws_1", "thr_3", MEMBER)).toBeNull()
    expect((await getThreadWithMessages("ws_1", "thr_3", OWNER))?.thread.id).toBe("thr_3")
  })
})

describe("getFolderCounts", () => {
  it("scopes every folder count, so a badge cannot leak another mailbox's volume", async () => {
    rows.threads = []
    rows.drafts = []

    await getFolderCounts("ws_1", "user_1", MEMBER)

    const threadCalls = calls.filter((call) => call.table === "threads")
    expect(threadCalls.length).toBeGreaterThan(0)
    for (const call of threadCalls) {
      expect(call.filters).toContainEqual({ op: "in", column: "mailbox_id", value: ["mbx_support"] })
    }
  })

  it("keeps drafts personal: they are filtered by user, not by mailbox", async () => {
    rows.threads = []
    rows.drafts = []

    await getFolderCounts("ws_1", "user_1", OWNER)

    expect(filtersFor("drafts")).toContainEqual({ op: "eq", column: "user_id", value: "user_1" })
  })
})
