import { expect, test } from "@playwright/test"

test("login page is usable", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })

  await page.goto("/login")
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  await expect(page.getByText(/forgot password/i)).toBeVisible()
  await page.screenshot({ path: "outputs/ui-audit/login.png", fullPage: true })

  await page.getByRole("button", { name: /sign in/i }).click()
  await expect(page.getByText(/email is required|password is required|invalid credentials/i).first()).toBeVisible()

  await page.locator('input[type="email"]').fill("not-an-email")
  await page.locator('input[type="password"], input[autocomplete="current-password"]').first().fill("short")
  await page.getByRole("button", { name: /sign in/i }).click()

  const crash = await page.getByText(/next.js error|application error/i).count()
  expect(crash).toBe(0)
  expect(consoleErrors.filter((text) => /chunkloaderror|hydration/i.test(text))).toEqual([])
})

test("forgot-password page is reachable from login", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("link", { name: /forgot password/i }).click()
  await expect(page).toHaveURL(/forgot-password/)
  await page.screenshot({ path: "outputs/ui-audit/forgot-password.png", fullPage: true })
  await expect(page.locator("body")).not.toContainText(/next.js error/i)
})
