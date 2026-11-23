import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

async function attendanceWorkspace(page: Page, operator: boolean) {
  const grants = ["attendance_processing:read", "team_attendance:read"]
  if (operator) grants.push("attendance_processing:execute")
  const user = await installDashboardFixture(page, "company", grants)
  const today = new Date().toISOString().slice(0, 10)
  const exception = {
    id: 71, employee_name: "Example employee", employee_no: "QA/0001",
    exception_type: "MISSING_CHECK_OUT", status: "OPEN", attendance_date: today,
    message: "End punch missing", resolution_note: "",
  }
  const remote = {
    id: 42, employee_id: 128, employee_name: "Example employee",
    start_date: today, end_date: today, reason: "Test remote work", status: "PENDING",
  }
  await page.route("**/api/**", async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    if (path === "/api/attendance/processing/exceptions") json = { data: [exception], meta: { totalPages: 1, totalItems: 1 } }
    if (path === "/api/attendance/processing/exceptions/71" && request.method() === "PATCH") {
      Object.assign(exception, request.postDataJSON())
      json = exception
    }
    if (path === "/api/attendance/work-from-home/requests") json = [remote]
    if (path === "/api/attendance/work-from-home/requests/42/review" && request.method() === "PATCH") {
      remote.status = request.postDataJSON().decision === "APPROVE" ? "APPROVED" : "REJECTED"
      json = remote
    }
    await route.fulfill({ json })
  })
}

for (const [layout, width, height] of [["desktop", 1366, 900], ["mobile", 390, 844]] as const) {
  test(`opens the Today bookmark and reviews remote work and exceptions on ${layout}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await attendanceWorkspace(page, true)
    await page.goto("/dashboard/attendance/today")
    await expect(page).toHaveURL(/\/dashboard\/attendance\/attendance-history(?:[?#]|$)/)
    await page.goto("/dashboard/attendance/work-from-home-requests")
    await expect(page.getByText("Test remote work", { exact: true })).toBeVisible()
    const review = page.waitForRequest(r => r.method() === "PATCH" && r.url().endsWith("/42/review"))
    await page.getByRole("button", { name: "Approve", exact: true }).click()
    expect((await review).postDataJSON()).toMatchObject({ decision: "APPROVE" })
    await page.goto("/dashboard/attendance/processing-exceptions")
    await page.getByText("Example employee", { exact: true }).first().click()
    const detail = page.getByRole("dialog")
    await expect(detail.getByText("Processing exception details", { exact: true })).toBeVisible()
    await detail.getByPlaceholder("Explain how this exception was resolved or why it is being ignored.").fill("Reviewed test record")
    const saved = page.waitForRequest(r => r.method() === "PATCH" && r.url().endsWith("/processing/exceptions/71"))
    await detail.getByRole("button", { name: "Save exception status" }).click()
    expect((await saved).postDataJSON()).toMatchObject({ resolution_note: "Reviewed test record" })
  })
}

test("attendance readers can inspect company requests and exceptions", async ({ page }) => {
  await attendanceWorkspace(page, false)
  await page.goto("/dashboard/attendance/work-from-home-requests")
  await expect(page.getByText("Test remote work", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0)
  await page.goto("/dashboard/attendance/processing-exceptions")
  await page.getByText("Example employee", { exact: true }).first().click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("button", { name: "Save exception status" })).toHaveCount(0)
})

test("a linked employee with older session data sees the withdrawal action for their own remote-work request", async ({ page }) => {
  const user = await installDashboardFixture(page, "employee", [])
  const own = { id: 45, employee_id: 781, start_date: "2031-05-12", end_date: "2031-05-12", reason: "Own remote-work request", status: "PENDING" }
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    if (path.endsWith("/work-from-home/requests/mine")) json = [own]
    await route.fulfill({ json })
  })
  await page.goto("/dashboard/attendance/work-from-home-requests")
  await expect(page.getByText(own.reason, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Withdraw request" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0)
})
