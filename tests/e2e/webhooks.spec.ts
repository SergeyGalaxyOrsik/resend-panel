import { expect, test } from "@playwright/test"

test.describe("webhook endpoints", () => {
  // With no signing secret configured the handlers deliberately accept anything
  // outside production, so there is nothing to assert.
  test.skip(
    !process.env.RESEND_INBOUND_WEBHOOK_SECRET && !process.env.RESEND_WEBHOOK_SECRET,
    "No inbound signing secret configured"
  )

  test("an unsigned inbound delivery is rejected", async ({ request }) => {
    const response = await request.post("/api/inbound", {
      data: { type: "email.received", data: { from: "a@example.com", to: ["b@example.com"] } },
    })

    expect(response.status()).toBe(401)
  })

  test("a forged signature is rejected", async ({ request }) => {
    const response = await request.post("/api/inbound", {
      headers: {
        "svix-id": "msg_forged",
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "v1,Zm9yZ2VkIHNpZ25hdHVyZQ==",
      },
      data: { type: "email.received", data: { from: "a@example.com", to: ["b@example.com"] } },
    })

    expect(response.status()).toBe(401)
  })
})
