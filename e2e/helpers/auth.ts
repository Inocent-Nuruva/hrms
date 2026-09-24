import { expect, type Page } from "@playwright/test"

export type TestUser = {
  role: "admin" | "hr"
  email: string
  password: string
}

export function readTestUser(role: TestUser["role"]): TestUser {
  const prefix = role === "admin" ? "HRMS_E2E_ADMIN" : "HRMS_E2E_HR"
  const email = process.env[`${prefix}_EMAIL`]?.trim()
  const password = process.env[`${prefix}_PASSWORD`]

  if (!email || !password) {
    throw new Error(
      `Set ${prefix}_EMAIL and ${prefix}_PASSWORD before running ${role} e2e tests.`,
    )
  }

  return {
    role,
    email,
    password,
  }
}

export async function loginAs(page: Page, user: TestUser) {
  await page.context().clearCookies()
  await page.goto("/login")
  await page.evaluate(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  await page.reload()

  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
  await page.locator('input[type="email"]').fill(user.email)
  await page.locator('input[type="password"], input[autocomplete="current-password"]').first().fill(user.password)
  await page.getByRole("button", { name: /sign in/i }).click()

  const twoFactor = page.getByText(/two-factor authentication/i)
  const errorBox = page.locator(".text-destructive, .input-message-error").first()

  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 40_000 }),
    twoFactor.waitFor({ state: "visible", timeout: 40_000 }),
    errorBox.waitFor({ state: "visible", timeout: 40_000 }),
  ]).catch(() => undefined)

  if (await twoFactor.isVisible().catch(() => false)) {
    throw new Error(`Login for ${user.email} stopped on 2FA. Provide a code or disable 2FA for this test account.`)
  }

  if (!page.url().includes("/dashboard")) {
    const message = (await errorBox.textContent().catch(() => null))?.trim()
    throw new Error(`Login failed for ${user.email}. Current URL: ${page.url()}${message ? ` — ${message}` : ""}`)
  }

  await page.waitForTimeout(1500)
  await expect(page.getByText("Dashboard", { exact: true }).first()).toBeVisible({ timeout: 20_000 })
}
