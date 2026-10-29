import { expect, test } from "@playwright/test"

test.describe("health endpoint", () => {
  test("reports the configuration and the database", async ({ request }) => {
    const response = await request.get("/api/health")
    const body = await response.json()

    expect(body).toMatchObject({
      status: expect.stringMatching(/^(ok|degraded)$/),
      checks: {
        config: expect.stringMatching(/^(ok|error)$/),
        database: expect.stringMatching(/^(ok|error)$/),
      },
    })

    // The status code has to agree with the checks, which is the whole contract a
    // monitor relies on.
    const healthy = body.checks.config === "ok" && body.checks.database === "ok"
    expect(response.status()).toBe(healthy ? 200 : 503)
    expect(body.status).toBe(healthy ? "ok" : "degraded")
  })

  test("says nothing about why it is unhealthy", async ({ request }) => {
    const raw = await (await request.get("/api/health")).text()

    // Unauthenticated route: it must not name variables or leak a connection string.
    expect(raw).not.toContain("APP_SECRET")
    expect(raw).not.toContain("SUPABASE")
    expect(raw).not.toContain("postgres")
  })
})
