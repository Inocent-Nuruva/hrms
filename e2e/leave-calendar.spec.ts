import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

async function holidayFixture(page: Page, attendanceWriter: boolean) {
  const permissions = ["holidays:read", "holidays:create", "holidays:update", "holidays:delete"]
  if (attendanceWriter) permissions.push("attendance_holidays:create", "attendance_holidays:update", "attendance_holidays:delete")
  const user = await installDashboardFixture(page, "company", permissions)
  const branch = { id: 11, branch_id: 7, branch_name: "North", name: "North festival", holiday_date: "2031-04-07", is_recurring: false }
  const company = { id: 12, branch_id: null, name: "Founders day", holiday_date: "2031-04-08", is_recurring: true }
  await page.route("**/api/**", async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (path === "/api/holiday-catalog") return route.fallback()
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    if (path === "/api/leave/holidays") json = { data: [branch, company], meta: { page: 1, totalPages: 1, totalItems: 2 } }
    if (path === "/api/leave/holidays/branches") json = [{ id: 7, name: "North" }]
    if (path === "/api/leave/holidays/11" && req.method() === "PATCH") {
      Object.assign(branch, req.postDataJSON())
      json = branch
    }
    return route.fulfill({ json })
  })
}

for (const [layout, width, height] of [["desktop", 1366, 900], ["mobile", 390, 844]] as const) {
  test("edits a branch holiday in Leave on " + layout, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await holidayFixture(page, true)
    await page.goto("/dashboard/leave-management/holidays")
    await page.getByRole("button", { name: "Edit North festival" }).click()
    const editor = page.getByRole("dialog", { name: "Edit Holiday" })
    await expect(editor.getByText("Applies to North")).toBeVisible()
    await editor.getByRole("textbox", { name: "Holiday name" }).fill("North celebration")
    const saved = page.waitForRequest(req => req.url().includes("/api/leave/holidays/11") && req.method() === "PATCH")
    await editor.getByRole("button", { name: "Save changes" }).click()
    expect((await saved).postDataJSON()).toMatchObject({ name: "North celebration", branch_id: 7 })
    await expect(page.getByRole("button", { name: "Edit North celebration" })).toBeVisible()
    await page.getByRole("button", { name: "Add Holiday", exact: true }).click()
    await page.getByRole("combobox", { name: "Applies to" }).click()
    await expect(page.getByRole("option")).toHaveText(["All branches", "North"])
  })
}

test("keeps branch actions out of Leave-only controls and displays the import choices", async ({ page }) => {
  await holidayFixture(page, false)
  await page.goto("/dashboard/leave-management/holidays")
  await expect(page.getByText("North festival", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Edit North festival" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Delete North festival" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Edit Founders day" })).toBeVisible()
  await page.getByRole("button", { name: "Import", exact: true }).click()
  const importer = page.getByRole("dialog", { name: "Import Country Holidays" })
  await importer.getByRole("combobox", { name: "Country" }).click()
  for (const name of ["Tanzania", "Kenya", "Uganda"]) await expect(page.getByRole("option", { name, exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  for (const [country, name] of [["TZ", "Tanzania"], ["KE", "Kenya"], ["UG", "Uganda"]]) {
    const response = await page.request.get("/api/holiday-catalog", { params: { country, year: 2026 } })
    expect(response.ok()).toBe(true)
    const catalog = await response.json()
    expect(catalog.countryName).toBe(name)
    expect(catalog.holidays.length).toBeGreaterThan(0)
    expect(catalog.holidays.every((row: { type: string }) => row.type === "public")).toBe(true)
  }
})

test("cancelling statutory verification preserves the decision and rejection requires explicit submission", async ({ page }) => {
  const user = await installDashboardFixture(page, "company", ["leave_statutory:read", "leave_statutory:approve"])
  const decisions: unknown[] = []
  const draft = { id: 41, name: "Review example", version_no: 1, status: "draft", jurisdiction_code: "TEST", verification_status: "unverified", rules: [], legal_references: [] }
  await page.route("**/api/**", async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    if (path === "/api/leave/statutory/rule-sets") json = [draft]
    if (path === "/api/leave/statutory/settings") json = { branches: [], company: {}, default_jurisdiction_code: null }
    if (path === "/api/leave/statutory/rule-sets/41/verify") {
      decisions.push(req.postDataJSON())
      draft.verification_status = req.postDataJSON().verified ? "verified" : "rejected"
      json = draft
    }
    await route.fulfill({ json })
  })
  await page.goto("/dashboard/leave-management/statutory")
  const card = page.getByTestId("statutory-rule-set")
  await expect(card.getByRole("button", { name: "Activate" })).toBeDisabled()
  await card.getByRole("button", { name: "Record verification" }).click()
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(decisions).toEqual([])
  await card.getByRole("button", { name: "Record rejection" }).click()
  const dialog = page.getByRole("alertdialog")
  await dialog.getByRole("textbox", { name: "Verification notes" }).fill("Fixture review requires a new source.")
  await dialog.getByRole("button", { name: "Record rejection" }).click()
  await expect(card.getByText("Verification rejected")).toBeVisible()
  expect(decisions).toEqual([{ verified: false, notes: "Fixture review requires a new source." }])
})

test("shows policy approval, default-workflow save and shared Business Trips controls", async ({ page }) => {
  const user = await installDashboardFixture(page, "company", ["leave_policies:read", "leave_policies:update", "leave_policies:approve",
    "leave_workflows:read", "leave_workflows:create", "leave_workflows:update", "attendance_business_trips:read", "attendance_business_trips:create"])
  const workflow = { id: 7, name: "Fallback review", status: "active", is_default: true, leave_type_id: null }
  const steps = [
    { id: 81, approval_level: 1, action_type: "recommend", approver_type: "role", role_id: 101, role_name: "DEPARTMENT_MANAGER", is_required: true },
    { id: 82, approval_level: 2, action_type: "approve", approver_type: "role", role_id: 102, role_name: "HR_MANAGER", is_required: true },
  ]
  const version = { id: 3, name: "Example policy", version_no: 1, lifecycle_status: "draft", status: "active" }
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    if (path === "/api/leave/policies") json = { data: [version] }
    if (path === "/api/leave/policies/3/versions") json = { data: [version] }
    if (path === "/api/leave/workflows") json = { data: [workflow] }
    if (path === "/api/leave/workflows/7") json = { ...workflow, steps }
    await route.fulfill({ json })
  })
  await page.goto("/dashboard/leave-management/policies")
  const panel = page.getByLabel("Policy versions", { exact: true })
  await panel.getByRole("combobox", { name: "Policy" }).click()
  await page.getByRole("option", { name: "Example policy (v1)" }).click()
  await expect(panel.getByRole("button", { name: "Submit", exact: true })).toBeVisible()
  await expect(panel.getByRole("button", { name: "Approve", exact: true })).toBeVisible()
  await page.goto("/dashboard/leave-management/workflows")
  await page.getByRole("button", { name: "Edit Fallback review" }).click()
  const saved = page.waitForRequest(req => new URL(req.url()).pathname === "/api/leave/workflows/7" && req.method() === "PATCH")
  await page.getByRole("button", { name: "Save workflow", exact: true }).click()
  expect((await saved).postDataJSON()).toMatchObject({ is_default: true, leave_type_id: null })
  await page.goto("/dashboard/leave-management/workflows")
  await page.getByRole("button", { name: "New workflow", exact: true }).click()
  await page.getByPlaceholder("e.g. Annual leave approval").fill("Fallback example")
  await page.getByRole("button", { name: /Default Fallback/ }).click()
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect(page.getByRole("button", { name: "Create workflow", exact: true })).toBeVisible()
  for (const path of ["/dashboard/leave-management/business-trips", "/dashboard/attendance/business-trips"]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/dashboard\/leave-management\/business-trips$/)
    await expect(page.getByRole("heading", { name: "Business trips", exact: true }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "New trip" })).toBeVisible()
  }
})

test("offers Request in the employee's own Encash leave panel", async ({ page }) => {
  const user = await installDashboardFixture(page, "employee", [])
  const employee = { id: 19, user_id: user.id, employee_no: "DEMO-19", branch: { name: "North" }, department: { name: "Finance" }, position: { name: "Clerk" } }
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path)) json = { ...user, data: user }
    if (path === "/api/employees/me") json = { data: employee }
    if (path === "/api/me/leave/balances") json = { data: [{ employee_id: employee.id, leave_balances: [{ id: 9, fiscal_year: "2031", leave_type_id: 4, leave_type_name: "Annual", available_days: 5 }] }] }
    if (path === "/api/leave/comp-off/eligibility") json = { types: [], convertible_overtime: [] }
    if (path === "/api/me/leave/accrual" || path === "/api/leave/encashments/me") json = []
    await route.fulfill({ json })
  })
  await page.goto("/dashboard/me/leave/balances")
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: "Encash leave" }) }).last()
  await panel.getByRole("combobox", { name: "Leave balance" }).click()
  await page.getByRole("option", { name: /Annual.*2031/ }).click()
  await panel.getByLabel("Days to encash").fill("2")
  await panel.getByLabel("Reason").fill("Test encashment")
  const request = page.waitForRequest(req => new URL(req.url()).pathname === "/api/leave/encashments" && req.method() === "POST")
  await panel.getByRole("button", { name: "Request", exact: true }).click()
  expect((await request).postDataJSON()).toEqual({ leave_type_id: 4, fiscal_year: "2031", requested_days: 2, reason: "Test encashment" })
})
