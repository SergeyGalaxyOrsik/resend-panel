/**
 * Fills the workspace with realistic demo mail for documentation screenshots.
 *
 *   bun run scripts/seed-demo-data.ts
 *   bun run scripts/seed-demo-data.ts --reset   # clear demo mail first, then reseed
 *
 * Register the owner account in the app first: the workspace and its default
 * mailbox are created by registration, and this script seeds into whatever
 * workspace it finds.
 *
 * Every address and company below is fictional. Domains are under .test / .example,
 * which are reserved by RFC 2606 and can never belong to a real organisation.
 */
import { createToken } from "../lib/crypto"
import { supabase } from "../lib/supabase"

const OWN_DOMAIN = "northport.test"

/** The workspace's own addresses: what the panel sends from and receives on. */
const MAILBOXES = [
  { address: `hello@${OWN_DOMAIN}`, displayName: "Northport" },
  { address: `support@${OWN_DOMAIN}`, displayName: "Northport Support" },
]

type Seed = {
  subject: string
  /** The other party. */
  from: { name: string; email: string }
  /** Which of our mailboxes the conversation belongs to. */
  mailbox: number
  /** Minutes ago the last message landed. */
  agoMinutes: number
  unread?: boolean
  starred?: boolean
  archived?: boolean
  trashed?: boolean
  attachment?: { filename: string; contentType: string; body: string }
  /** Alternating inbound/outbound bodies, starting inbound. */
  messages: string[]
}

const HOUR = 60
const DAY = 24 * HOUR

const SEEDS: Seed[] = [
  {
    subject: "Invoice INV-2043 is ready",
    from: { name: "Meridian Billing", email: "billing@meridian-apps.test" },
    mailbox: 0,
    agoMinutes: 24,
    unread: true,
    attachment: {
      filename: "INV-2043.txt",
      contentType: "text/plain",
      body: "Meridian Apps\nInvoice INV-2043\nPeriod: March 2026\nAmount due: EUR 480.00\nDue date: 2026-04-14\n",
    },
    messages: [
      "Hi Northport team,\n\nYour invoice INV-2043 for March is attached. The amount due is EUR 480.00, payable by 14 April.\n\nNothing is needed from you if the card on file is still current.\n\nMeridian Billing",
    ],
  },
  {
    subject: "Re: Onboarding call next week",
    from: { name: "Priya Raman", email: "priya@harborlight.test" },
    mailbox: 0,
    agoMinutes: 95,
    unread: true,
    messages: [
      "Hello,\n\nWe would like to get our team onto Northport before the quarter closes. Would Tuesday or Wednesday afternoon work for a walkthrough?\n\nPriya",
      "Hi Priya,\n\nWednesday at 14:00 CET works well on our side. I will send a calendar invite shortly with a dial-in link.\n\nIs there anything specific you would like us to cover? Most teams want to see routing rules and the shared inbox first.\n\nBest,\nNorthport",
      "Wednesday 14:00 is confirmed. Routing rules are exactly what we want to see, plus how permissions work for contractors.\n\nThanks,\nPriya",
    ],
  },
  {
    subject: "Password reset requested",
    from: { name: "Alder Identity", email: "no-reply@alder-id.test" },
    mailbox: 1,
    agoMinutes: 3 * HOUR,
    unread: true,
    messages: [
      "A password reset was requested for your Alder account.\n\nUse code 419-882 to continue. The code expires in 30 minutes.\n\nIf you did not request this, no action is needed and the code can be ignored.",
    ],
  },
  {
    subject: "Quarterly usage summary",
    from: { name: "Meridian Apps", email: "reports@meridian-apps.test" },
    mailbox: 0,
    agoMinutes: 6 * HOUR,
    starred: true,
    messages: [
      "Your workspace sent 12,480 messages last quarter, up 18% from the previous one.\n\nDelivery held at 99.2%. Two domains showed elevated bounce rates and are listed in the dashboard.\n\nNo action is required.",
    ],
  },
  {
    subject: "Contract for review",
    from: { name: "Tomas Weber", email: "t.weber@stonebridge-legal.test" },
    mailbox: 0,
    agoMinutes: 9 * HOUR,
    starred: true,
    attachment: {
      filename: "service-agreement-draft.txt",
      contentType: "text/plain",
      body: "SERVICE AGREEMENT (DRAFT)\n\n1. Term\nThis agreement runs for twelve months from the effective date.\n\n2. Scope\nThe supplier provides the hosted service described in Schedule A.\n\n3. Payment\nInvoices are issued monthly and payable within 30 days.\n",
    },
    messages: [
      "Good afternoon,\n\nPlease find the draft service agreement attached. Clause 7 has been updated to reflect the shorter notice period we discussed.\n\nI would appreciate your comments by Friday.\n\nKind regards,\nTomas Weber",
      "Thanks Tomas,\n\nWe have reviewed the draft. Clause 7 looks right now. One question on clause 12: does the data retention window start at termination or at the final invoice?\n\nEverything else is agreed on our side.\n\nNorthport",
    ],
  },
  {
    subject: "Shipment SW-77120 is on its way",
    from: { name: "Seawall Logistics", email: "tracking@seawall-logistics.test" },
    mailbox: 0,
    agoMinutes: 26 * HOUR,
    messages: [
      "Your shipment SW-77120 left the Rotterdam depot this morning and is scheduled to arrive on Thursday between 09:00 and 13:00.\n\nA signature will be required on delivery.",
    ],
  },
  {
    subject: "Feedback on the new dashboard",
    from: { name: "Ana Ferreira", email: "ana@brightloom.test" },
    mailbox: 1,
    agoMinutes: 30 * HOUR,
    messages: [
      "Hello,\n\nThe team has been using the new dashboard for a week. The unread count in the sidebar is the change everyone noticed first, and it has cut the time we spend triaging in the morning.\n\nOne request: could the conversation list remember which folder we came from when going back?\n\nAna",
      "Hi Ana,\n\nThank you, that is good to hear. Returning to the folder you came from is already in place, and starring now survives a page reload as well.\n\nWe will follow up when the next build ships.\n\nNorthport",
    ],
  },
  {
    subject: "Domain verification completed",
    from: { name: "Alder Identity", email: "no-reply@alder-id.test" },
    mailbox: 1,
    agoMinutes: 2 * DAY,
    messages: [
      `The DNS records for ${OWN_DOMAIN} have been verified.\n\nSending from this domain is now enabled. DKIM and SPF both pass, and DMARC is set to quarantine.`,
    ],
  },
  {
    subject: "Partnership enquiry",
    from: { name: "Jonas Lind", email: "jonas.lind@fjordworks.test" },
    mailbox: 0,
    agoMinutes: 3 * DAY,
    messages: [
      "Hi,\n\nWe build scheduling tools for maritime operators and several of our customers already use Northport for their support inbox. An integration seems worth exploring.\n\nWould you be open to a short call?\n\nJonas Lind\nFjordworks",
      "Hi Jonas,\n\nHappy to talk. Our API covers threads, messages and delivery events, which should be enough for what you describe.\n\nI have attached nothing for now, but can share the API notes ahead of the call if useful.\n\nNorthport",
    ],
  },
  {
    subject: "Your seat has been assigned",
    from: { name: "Brightloom Workspace", email: "notifications@brightloom.test" },
    mailbox: 1,
    agoMinutes: 4 * DAY,
    messages: [
      "You have been added to the Brightloom workspace by Ana Ferreira.\n\nYour role is Editor. Sign in with your existing address to accept.",
    ],
  },
  {
    subject: "Re: Bug report on attachments over 8 MB",
    from: { name: "Karel Novak", email: "karel@stonebridge-legal.test" },
    mailbox: 1,
    agoMinutes: 5 * DAY,
    messages: [
      "Hello,\n\nUploading a 9 MB PDF fails silently for us. Nothing appears in the composer and no error is shown.\n\nKarel",
      "Hi Karel,\n\nThat is the per-file limit rather than a fault: files are capped at 10 MB each and 25 MB per message. The silent failure is the real bug, and the composer now reports it.\n\nA fix is going out this week.\n\nNorthport",
      "Understood, thanks for the quick answer. The limit itself is fine for us.\n\nKarel",
    ],
  },
  {
    subject: "Renewal notice for your plan",
    from: { name: "Meridian Billing", email: "billing@meridian-apps.test" },
    mailbox: 0,
    agoMinutes: 8 * DAY,
    messages: [
      "Your annual plan renews on 2 May 2026.\n\nThe card ending 4417 will be charged EUR 5,760. To change the plan before renewal, open the billing page in your account.",
    ],
  },
  {
    subject: "Security review scheduled",
    from: { name: "Ines Duarte", email: "ines@fjordworks.test" },
    mailbox: 0,
    agoMinutes: 12 * DAY,
    archived: true,
    messages: [
      "Hello,\n\nOur annual security review is scheduled for the last week of the month. We will need the current subprocessor list and your incident history for the past twelve months.\n\nInes",
    ],
  },
  {
    subject: "Welcome to Seawall Logistics",
    from: { name: "Seawall Logistics", email: "hello@seawall-logistics.test" },
    mailbox: 0,
    agoMinutes: 20 * DAY,
    archived: true,
    messages: [
      "Your account is active.\n\nTracking numbers can be entered on the portal, and delivery notifications will arrive at this address.",
    ],
  },
  {
    subject: "Old newsletter: March edition",
    from: { name: "Harborlight Weekly", email: "weekly@harborlight.test" },
    mailbox: 1,
    agoMinutes: 40 * DAY,
    trashed: true,
    messages: [
      "This month: three notes on queue design, a short piece on backpressure, and a reader question about retries.\n\nUnsubscribe at any time from the link in the footer.",
    ],
  },
  {
    subject: "Duplicate receipt",
    from: { name: "Meridian Billing", email: "billing@meridian-apps.test" },
    mailbox: 0,
    agoMinutes: 45 * DAY,
    trashed: true,
    messages: [
      "This is a duplicate of receipt R-88120 and can be disregarded.",
    ],
  },
  {
    subject: "Notes from the migration",
    from: { name: "Priya Raman", email: "priya@harborlight.test" },
    mailbox: 0,
    agoMinutes: 400 * DAY,
    messages: [
      "Writing down what we learned moving 40,000 messages last year, so the next team has it.\n\nThe threading rule by subject held up better than expected. The one thing to watch is timezone drift on imported timestamps.\n\nPriya",
    ],
  },
]

const DRAFTS = [
  {
    to: "priya@harborlight.test",
    subject: "Re: Onboarding call next week",
    text: "Hi Priya,\n\nAhead of Wednesday, here are the three things we will walk through:\n\n1. Shared inbox and routing rules\n2. Permissions for contractors\n3. Delivery reporting\n\n",
    agoMinutes: 40,
  },
  {
    to: "jonas.lind@fjordworks.test",
    subject: "API notes",
    text: "Jonas,\n\nAttaching the API notes before our call. The endpoints you will care about are threads, messages and events.\n\n",
    agoMinutes: 5 * HOUR,
  },
  {
    to: "",
    subject: "",
    text: "Reminder: write up the retention policy question from the Stonebridge thread.",
    agoMinutes: 2 * DAY,
  },
]

function at(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString()
}

function htmlFromText(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("\n")

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">\n${paragraphs}\n</div>`
}

async function main() {
  const reset = process.argv.includes("--reset")

  const { data: workspaceRow } = await supabase
    .from("workspaces")
    .select("*")
    .limit(1)
    .maybeSingle()

  if (!workspaceRow) {
    console.error(
      "No workspace found. Register the owner account at /register first, then run this again."
    )
    process.exit(1)
  }

  const workspaceId = workspaceRow.id as string
  const ownerUserId = workspaceRow.owner_user_id as string
  console.log(`Workspace ${workspaceId}`)

  if (reset) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("workspace_id", workspaceId)
    const messageIds = (existing || []).map((row) => row.id as string)

    if (messageIds.length) {
      await supabase.from("message_events").delete().in("message_id", messageIds)
      await supabase.from("attachments").delete().in("message_id", messageIds)
    }

    await supabase.from("messages").delete().eq("workspace_id", workspaceId)
    await supabase.from("threads").delete().eq("workspace_id", workspaceId)
    await supabase.from("drafts").delete().eq("workspace_id", workspaceId)
    console.log(`Cleared ${messageIds.length} existing messages`)
  }

  // ── Mailboxes ────────────────────────────────────────────
  const mailboxIds: string[] = []

  for (const mailbox of MAILBOXES) {
    const { data: found } = await supabase
      .from("mailboxes")
      .select("id")
      .eq("workspace_id", workspaceId)
      .ilike("address", mailbox.address)
      .maybeSingle()

    if (found) {
      mailboxIds.push(found.id as string)
      continue
    }

    const id = createToken("mbx")
    const { error } = await supabase.from("mailboxes").insert({
      id,
      workspace_id: workspaceId,
      address: mailbox.address,
      display_name: mailbox.displayName,
      created_at: new Date().toISOString(),
    })
    if (error) throw new Error(`mailbox ${mailbox.address}: ${error.message}`)

    await supabase
      .from("mailbox_users")
      .insert({ mailbox_id: id, user_id: ownerUserId, created_at: new Date().toISOString() })

    mailboxIds.push(id)
  }
  console.log(`Mailboxes ready: ${MAILBOXES.map((m) => m.address).join(", ")}`)

  // The sender identity shown in the composer.
  await supabase
    .from("resend_settings")
    .update({
      from_name: "Northport",
      from_email: MAILBOXES[0].address,
      inbound_email: MAILBOXES[1].address,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)

  // ── Threads, messages, events, attachments ───────────────
  let threadCount = 0
  let messageCount = 0
  /** Counts outbound messages so the engagement funnel is spread across them. */
  let outboundIndex = 0
  let eventCount = 0
  let attachmentCount = 0

  for (const seed of SEEDS) {
    const mailboxId = mailboxIds[seed.mailbox]
    const ourAddress = MAILBOXES[seed.mailbox].address
    const threadId = createToken("thread")

    // Messages run oldest to newest and land on `agoMinutes` for the last one.
    const gap = 55
    const total = seed.messages.length
    const timestamps = seed.messages.map((_, index) =>
      at(seed.agoMinutes + (total - 1 - index) * gap)
    )
    const lastMessageAt = timestamps[total - 1]

    const { error: threadError } = await supabase.from("threads").insert({
      id: threadId,
      workspace_id: workspaceId,
      mailbox_id: mailboxId,
      subject: seed.subject,
      participants: [seed.from.email, ourAddress],
      is_starred: Boolean(seed.starred),
      is_archived: Boolean(seed.archived),
      is_trashed: Boolean(seed.trashed),
      trashed_at: seed.trashed ? lastMessageAt : null,
      created_at: timestamps[0],
      updated_at: lastMessageAt,
      last_message_at: lastMessageAt,
    })
    if (threadError) throw new Error(`thread ${seed.subject}: ${threadError.message}`)
    threadCount += 1

    let previousMessageId: string | null = null

    for (let index = 0; index < total; index += 1) {
      const inbound = index % 2 === 0
      const body = seed.messages[index]
      const timestamp = timestamps[index]
      const messageId = createToken("message")

      // Only the newest message of an unread thread stays unread, which is what
      // makes the row bold without pretending the whole history is unopened.
      const isRead = !(seed.unread && index === total - 1)

      const { error: messageError } = await supabase.from("messages").insert({
        id: messageId,
        workspace_id: workspaceId,
        mailbox_id: mailboxId,
        thread_id: threadId,
        direction: inbound ? "inbound" : "outbound",
        status: inbound ? "received" : "delivered",
        subject: index === 0 ? seed.subject : `Re: ${seed.subject}`,
        from_name: inbound ? seed.from.name : MAILBOXES[seed.mailbox].displayName,
        from_email: inbound ? seed.from.email : ourAddress,
        to: inbound ? [ourAddress] : [seed.from.email],
        cc: [],
        bcc: [],
        text: body,
        html: htmlFromText(body),
        is_read: isRead,
        in_reply_to: previousMessageId,
        references_list: previousMessageId ? [previousMessageId] : [],
        sent_at: inbound ? null : timestamp,
        received_at: inbound ? timestamp : null,
        created_at: timestamp,
        updated_at: timestamp,
      })
      if (messageError) throw new Error(`message ${seed.subject}: ${messageError.message}`)
      messageCount += 1

      if (!inbound) {
        // A plausible funnel: everything sends and delivers, most get opened, some
        // get clicked. Without this the statistics screen is a wall of zeroes.
        const types: Array<"sent" | "delivered" | "opened" | "clicked"> = ["sent", "delivered"]
        // One message goes unopened and one of the opened ones gets a click, so the
        // rates read like a real account rather than a perfect 100%.
        if (outboundIndex !== 3) types.push("opened")
        if (outboundIndex === 1) types.push("clicked")
        outboundIndex += 1

        for (const [offset, type] of types.entries()) {
          await supabase.from("message_events").insert({
            id: createToken("event"),
            workspace_id: workspaceId,
            message_id: messageId,
            type,
            payload: { source: "seed" },
            // Staggered so the event feed reads as a sequence, not a single instant.
            created_at: new Date(new Date(timestamp).getTime() + offset * 90_000).toISOString(),
          })
          eventCount += 1
        }
      }

      previousMessageId = messageId

      // The attachment hangs off the first message, which is where it was sent.
      if (seed.attachment && index === 0) {
        const attachmentId = createToken("att")
        const extension = seed.attachment.filename.split(".").pop() || "bin"
        const storagePath = `${workspaceId}/${attachmentId}.${extension}`
        const bytes = new TextEncoder().encode(seed.attachment.body)

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(storagePath, bytes, {
            contentType: seed.attachment.contentType,
            upsert: true,
          })

        if (uploadError) {
          console.warn(`  attachment upload skipped (${seed.attachment.filename}): ${uploadError.message}`)
        } else {
          const { error: attachmentError } = await supabase.from("attachments").insert({
            id: attachmentId,
            message_id: messageId,
            workspace_id: workspaceId,
            filename: seed.attachment.filename,
            content_type: seed.attachment.contentType,
            size: bytes.byteLength,
            storage_path: storagePath,
            created_at: timestamp,
          })
          if (attachmentError) throw new Error(`attachment: ${attachmentError.message}`)
          attachmentCount += 1
        }
      }
    }
  }

  // ── Drafts ───────────────────────────────────────────────
  for (const draft of DRAFTS) {
    const { error } = await supabase.from("drafts").insert({
      id: createToken("draft"),
      workspace_id: workspaceId,
      user_id: ownerUserId,
      thread_id: null,
      subject: draft.subject,
      to: draft.to,
      cc: "",
      bcc: "",
      text: draft.text,
      updated_at: at(draft.agoMinutes),
    })
    if (error) throw new Error(`draft: ${error.message}`)
  }

  console.log(
    `Seeded ${threadCount} threads, ${messageCount} messages, ${eventCount} events, ` +
      `${attachmentCount} attachments, ${DRAFTS.length} drafts.`
  )
}

main().catch((error) => {
  console.error("Seed failed:", error)
  process.exit(1)
})
