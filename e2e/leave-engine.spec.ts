import { expect, test, type Page } from "@playwright/test"

import { loginAs, readTestUser } from "./helpers/auth"

/**
 * Leave policy engine screens: policy versions, year-end rollover, statutory
 * rules and leave payroll integration, on desktop and phone widths.
 * Needs HRMS_E2E_ADMIN_EMAIL/PASSWORD for an HR admin on a test database.
 */

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(String(error.message || error)))
  return errors
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "page should not scroll sideways").toBeLessThanOrEqual(1)
}

test.describe("leave policy engine (HR admin)", () => {
  test.beforeEach(async ({ page }) => {
    // Log in at desktop width (the helper checks the desktop sidebar), and
    // retry once: a cold dev server can be slow to finish the redirect.
    const viewport = page.viewportSize()
    await page.setViewportSize({ width: 1440, height: 900 })
    try {
      await loginAs(page, readTestUser("admin"))
    } catch {
      await loginAs(page, readTestUser("admin"))
    }
    if (viewport) await page.setViewportSize(viewport)
  })

  test("year-end rollover: runs, preview lines and report", async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto("/dashboard/leave-management/rollover")
    await expect(page.getByRole("heading", { name: "Year-end leave rollover" })).toBeVisible({ timeout: 60_000 })
    // Open a run that has lines (a completed run), not an empty re-preview.
    const completedRow = page.getByRole("row").filter({ hasText: "Completed" }).first()
    await expect(completedRow).toBeVisible({ timeout: 30_000 })
    const closeHelp = page.getByRole("button", { name: "Close help" })
    if (await closeHelp.isVisible().catch(() => false)) await closeHelp.click()
    await completedRow.getByRole("button", { name: "Open" }).click()
    const lines = page.getByTestId("rollover-lines")
    await expect(lines).toBeVisible({ timeout: 30_000 })
    await expect(lines.locator("tbody tr").first()).toBeVisible()
    await expect(page.getByRole("button", { name: /Report \(CSV\)/ })).toBeVisible()
    await page.getByRole("button", { name: "Lapsing" }).click()
    await page.screenshot({ path: "test-results/leave-engine/rollover-desktop.png", fullPage: true })
    expect(errors).toEqual([])
  })

  test("statutory rules: verification gate and test configuration", async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto("/dashboard/leave-management/statutory")
    await expect(page.getByRole("heading", { name: "Statutory leave rules" })).toBeVisible({ timeout: 60_000 })
    const sets = page.getByTestId("statutory-rule-set")
    await expect(sets.first()).toBeVisible({ timeout: 30_000 })
    const mainland = sets.filter({ hasText: "Tanzania Mainland statutory leave" })
    await expect(mainland.getByText("Not verified")).toBeVisible()
    await expect(mainland.getByRole("button", { name: "Activate" })).toBeDisabled()
    await expect(sets.filter({ hasText: "TEST ONLY" }).getByText("TEST configuration", { exact: true })).toBeVisible()
    await expect(page.getByText("Which rules apply to whom")).toBeVisible()
    await page.getByRole("button", { name: "New rule set" }).click()
    await expect(page.getByLabel("Statutory rule set editor")).toBeVisible()
    await page.getByRole("button", { name: "Close" }).click()
    await page.screenshot({ path: "test-results/leave-engine/statutory-desktop.png", fullPage: true })
    expect(errors).toEqual([])
  })

  test("leave payroll integration: component readiness", async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto("/dashboard/leave-management/payroll-integration")
    await expect(page.getByRole("heading", { name: "Leave payroll integration" })).toBeVisible({ timeout: 60_000 })
    const encashment = page.getByTestId("leave-payroll-component").filter({ hasText: "Leave encashment" })
    await expect(encashment).toBeVisible({ timeout: 30_000 })
    await expect(encashment.getByText(/Waiting for Finance|Confirmed by Finance|Test configuration/)).toBeVisible()
    await expect(page.getByRole("button", { name: "Check payroll payments now" })).toBeVisible()
    await page.screenshot({ path: "test-results/leave-engine/payroll-desktop.png", fullPage: true })
    expect(errors).toEqual([])
  })

  test("policies: versions, compare and affected employees", async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto("/dashboard/leave-management/policies")
    const panel = page.getByLabel("Policy versions")
    await expect(panel).toBeVisible({ timeout: 60_000 })
    const select = panel.getByLabel("Policy")
    await expect(select.locator("option").nth(1)).toBeAttached({ timeout: 30_000 })
    const value = await select.locator("option").nth(1).getAttribute("value")
    await select.selectOption(value ?? "")
    const versions = page.getByTestId("policy-versions")
    await expect(versions.locator("tbody tr").nth(1)).toBeVisible({ timeout: 30_000 })
    await expect(versions.getByText("Active").first()).toBeVisible()
    await versions.getByRole("button", { name: "Compare" }).first().click()
    await expect(panel.getByText(/^Changes v\d+ → v\d+/)).toBeVisible({ timeout: 30_000 })
    await versions.getByRole("button", { name: "Affected employees" }).first().click()
    await expect(page.getByTestId("policy-impact")).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: "test-results/leave-engine/policy-versions-desktop.png", fullPage: true })
    expect(errors).toEqual([])
  })

  test.describe("phone width", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    for (const [path, heading] of [
      ["/dashboard/leave-management/rollover", "Year-end leave rollover"],
      ["/dashboard/leave-management/statutory", "Statutory leave rules"],
      ["/dashboard/leave-management/payroll-integration", "Leave payroll integration"],
    ] as const) {
      test(`${heading} fits a phone screen`, async ({ page }) => {
        const errors = trackErrors(page)
        await page.goto(path)
        await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 60_000 })
        await page.waitForTimeout(1500)
        await expectNoHorizontalScroll(page)
        await page.screenshot({
          path: `test-results/leave-engine/${path.split("/").pop()}-mobile.png`,
          fullPage: true,
        })
        expect(errors).toEqual([])
      })
    }
  })
})
