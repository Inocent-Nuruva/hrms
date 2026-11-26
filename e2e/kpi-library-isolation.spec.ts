import { expect, test } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

test("KPI Library loads its definitions without requesting assignments", async ({ page }) => {
  const user = await installDashboardFixture(page, "company", ["kpi_definitions:create", "kpi_assignments:read"])
  let assignmentRequests = 0
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) {
      await route.fulfill({ json: { ...user, data: user } })
    } else if (path === "/api/hr/kpi/assignments") {
      assignmentRequests += 1
      await route.fulfill({ status: 400, json: { message: "Employee does not belong to active company" } })
    } else if (path === "/api/hr/kpi/definitions") {
      await route.fulfill({ json: [{ id: 1, code: "SERVICE_QUALITY", status: "published", currentVersion: { id: 1, version: 1, name: "Service quality", category: "Service", measurementType: "numeric", publishedAt: "2026-11-01T00:00:00Z" } }] })
    } else {
      await route.fulfill({ json: [] })
    }
  })

  await page.goto("/dashboard/kpi", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("table", { name: "KPI definitions" })).toContainText("Service quality")
  await expect(page.getByRole("region", { name: "Library overview" })).toContainText("1")
  expect(assignmentRequests).toBe(0)
})
