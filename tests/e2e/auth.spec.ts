import { expect, test } from "@playwright/test"

/** A fresh address per run, so a real account is never the one locked out. */
function throwawayEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.invalid`
}

/** Ids, not labels: the panel ships in three languages and the ids do not move. */
async function attemptSignIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.locator("form button[type=submit]").click()
  await page.getByRole("alert").first().waitFor({ state: "visible" })
}

test.describe("sign-in", () => {
  test("an anonymous visitor is sent to sign in", async ({ page }) => {
    await page.goto("/inbox")
    await expect(page).toHaveURL(/\/(login|register)/)
  })

  test("wrong credentials are refused", async ({ page }) => {
    await page.goto("/login")
    test.skip(!page.url().includes("/login"), "Workspace has no accounts yet")

    await attemptSignIn(page, throwawayEmail(), "not-the-password")

    // Same message whether or not the address exists: a wrong password must not
    // confirm an account.
    await expect(page.getByRole("alert").first()).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("repeated failures lock the attempt out", async ({ page }) => {
    await page.goto("/login")
    test.skip(!page.url().includes("/login"), "Workspace has no accounts yet")

    const email = throwawayEmail()

    // The limit is five failures per email; the sixth is refused before the
    // password is checked at all.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await attemptSignIn(page, email, `wrong-${attempt}`)
    }

    await expect(page.getByRole("alert").first()).toContainText(/too many|слишком много|失败次数过多/i)
  })
})
