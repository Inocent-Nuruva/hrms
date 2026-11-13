import { expect, test, type Page } from "@playwright/test"
import { DASHBOARD_AUTH_COOKIE } from "../src/lib/dashboard-permissions"

async function prepareWorkspace(page: Page, canActivate = true, extraPermissions: string[] = []) {
  await page.context().addCookies([{ name: DASHBOARD_AUTH_COOKIE, value: "1", url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" }])
  const permissions = ["view_company_dashboard", "view_company_data", "data_scope:company", "employees:read", "employment_contracts:read", "onboarding_requests:read", ...(canActivate ? ["onboarding_requests:complete"] : []), ...extraPermissions]
  const user = { id: 90, fullName: "Test HR", first_name: "Test", last_name: "HR", email: "phase4@example.test", roles: ["HR"], permissions, scope: "company", companyId: 10, company_id: 10, dashboardType: "admin", accessContextResolved: true }
  const token = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: 90, email: user.email, scope: "company", userType: "COMPANY_USER", companyId: 10, companyMembershipId: 90, roles: user.roles, permissions, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`
  await page.addInitScript(({ token, user, permissions }) => {
    localStorage.setItem("ess.auth.tokens", JSON.stringify({ accessToken: token, refreshToken: "fixture" }))
    localStorage.setItem("ess.auth.user", JSON.stringify(user))
    localStorage.setItem("hrms.admin.accessToken", token)
    sessionStorage.setItem("hrms.dashboard.actorPermissions", JSON.stringify(permissions))
    sessionStorage.setItem("hrms.dashboard.accessMode", JSON.stringify("admin"))
    sessionStorage.setItem("hrms.dashboard.isAdmin", "true")
  }, { token, user, permissions })
  const state = { ready: false, completed: false, failOverview: false, failActivation: false, failNote: false, activationCalls: 0, notes: [] as Array<Record<string, unknown>> }
  const employee = { id: 501, first_name: "Amina", last_name: "Test", employee_no: "TEST-501", employment_status: "onboarding", primary_department: { id: 1, name: "Finance" } }
  const requirement = { id: "signed employment contract", label: "Signed contract covering the start date", group: "Contract", owner: "HR / Employee", required: true, status: "pending", action: "contracts" }
  const readiness = () => ({ employee_id: 501, employee_status: state.completed ? "active" : "onboarding", request_status: state.completed ? "completed" : "in_progress", ready_to_activate: state.ready && !state.completed, closed: state.completed, blocker_count: state.ready ? 0 : 1, completed_required: state.ready ? 10 : 9, total_required: 10, next_action: state.ready ? null : requirement, requirements: [{ ...requirement, status: state.ready ? "complete" : "pending" }] })
  const request = () => ({ id: 55, employee_id: 501, employee: { ...employee, employment_status: state.completed ? "active" : "onboarding" }, onboarding_no: "TEST-ONB-55", title: "Onboarding for Amina Test", status: state.completed ? "completed" : "in_progress", progress_percentage: "100.00", tasks: [], approvals: [], employee_details_review: { status: "submitted", sections: [{ key: "personal", label: "Personal details", status: "pending", fields: [{ label: "Full name", value: "Amina Test" }] }, { key: "contact", label: "Contact details", status: "changes_requested", fields: [{ label: "Email", value: "amina@example.test" }] }] } })
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    let payload: unknown = { data: [] }
    if (path === "/api/onboarding/requests/overview") {
      if (state.failOverview) return route.fulfill({ status: 503, json: { message: "Readiness temporarily unavailable" } })
      payload = { data: state.completed ? [] : [{ id: 55, employee_id: 501, employee_name: "Amina Test", employee_no: "TEST-501", onboarding_no: "TEST-ONB-55", department: "Finance", stage: state.ready ? "Ready for activation" : "Contract", overdue: true, overdue_task_count: 0, owners: [state.ready ? "Authorized HR" : "HR / Employee"], planned_completion_date: "2026-01-01", blockers: state.ready ? [] : [requirement], readiness: readiness() }], next_cursor: null }
    } else if (path === "/api/onboarding/requests/55/workspace/visit") payload = { previous_viewed_at: null, viewed_at: new Date().toISOString() }
    else if (path === "/api/onboarding/requests/55/workspace/notes") {
      if (route.request().method() === "POST") {
        if (state.failNote) return route.fulfill({ status: 503, json: { message: "Notes temporarily unavailable" } })
        state.notes.push({ ...route.request().postDataJSON(), id: state.notes.length + 1, author_name: "Test HR", created_at: new Date().toISOString() })
        payload = { message: "Handoff note saved" }
      } else payload = state.notes
    }
    else if (path === "/api/onboarding/requests/55/readiness") payload = readiness()
    else if (path === "/api/onboarding/requests/55/complete") {
      state.activationCalls += 1
      if (state.failActivation) return route.fulfill({ status: 400, json: { message: "Employee is not ready for activation: signed employment contract" } })
      state.completed = true
      payload = { message: "Onboarding completed successfully", data: request() }
    } else if (path === "/api/onboarding/requests/55") payload = request()
    else if (path === "/api/onboarding/requests/55/progress") payload = { progress_percentage: 100 }
    else if (path === "/api/onboarding/requests") payload = { data: [request()], meta: { total: 1, page: 1, limit: 100 } }
    else if (path === "/api/employees") payload = { data: [employee], meta: { total: 1 } }
    else if (path.includes("/auth/me") || path === "/api/users/me") payload = { ...user, data: user }
    return route.fulfill({ status: 200, json: payload })
  })
  return state
}

test.describe("onboarding HR workspace with isolated API fixtures", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
  })

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`reviews employee details at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await prepareWorkspace(page, true, ["onboarding_requests:update"])
    await page.goto("/dashboard/employees/onboarding")
    await page.getByRole("button", { name: "Review onboarding for Amina Test" }).click()
    await page.getByRole("tab", { name: "Employee details" }).click()
    const workspace = page.getByRole("region", { name: "Employee onboarding workspace" })
    await expect(workspace.getByText("1 of 2 sections reviewed")).toBeVisible()
    await expect(workspace.getByText("Awaiting review", { exact: true })).toBeVisible()
    await expect(workspace.getByText("Amina Test", { exact: true })).toBeVisible()
    await expect(workspace.getByRole("button", { name: "Request changes & notify employee" })).toBeDisabled()
    await workspace.getByRole("textbox", { name: "Review note" }).fill("Please check this information.")
    await expect(workspace.getByRole("button", { name: "Request changes & notify employee" })).toBeEnabled()
    await workspace.getByRole("button", { name: "Next section" }).click()
    await expect(workspace.getByText("amina@example.test")).toBeVisible()
    await workspace.getByRole("button", { name: "Previous section" }).click()
    await expect(workspace.getByRole("textbox", { name: "Review note" })).toHaveText("Please check this information.")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath("employee-review.png"), fullPage: true })
  })
  }

  for (const [theme, accent] of [["light", "#303194"], ["dark", "#303194"], ["light", "#0078D4"], ["dark", "#0078D4"]]) {
    test(`keeps onboarding navigation and support readable in ${theme} mode with ${accent}`, async ({ page }) => {
      await prepareWorkspace(page)
      await page.addInitScript(({ mode, color }) => {
        localStorage.setItem("hrms.theme", mode)
        localStorage.setItem("hrms.accent.color", color)
      }, { mode: theme, color: accent })
      await page.goto("/dashboard/employees/onboarding")
      await page.addStyleTag({ content: 'button:not(.fui-Button) { color: var(--foreground); }' })
      await expect(page.getByRole("navigation", { name: "Workspace areas" })).toHaveCount(0)
      await expect(page.getByRole("tab", { name: "Onboarding", exact: true })).toHaveAttribute("aria-selected", "true")
      const support = page.getByRole("button", { name: "Open help chat", exact: true })
      await expect(support).toHaveCSS("color", "rgb(255, 255, 255)")
      await expect(support.locator("svg")).toHaveCSS("color", "rgb(255, 255, 255)")
      await support.press("Enter")
      await expect(page.getByText("Help and IT support", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Close help chat", exact: true })).toHaveCSS("color", "rgb(255, 255, 255)")
    })
  }

  test("keeps invite, registration, onboarding and contracts in the employee workspace", async ({ page }) => {
    await prepareWorkspace(page, true, ["employees:create", "employees:update"])
    await page.goto("/dashboard/employees/onboarding")
    for (const [label, route] of [["Invite", "invite"], ["Registration", "registration"], ["Contracts", "contracts"], ["Onboarding", "onboarding"]]) {
      await page.getByRole("tab", { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/dashboard/employees/${route}$`))
    }
    await expect(page.getByText("1 of 1 open requests", { exact: false })).toBeVisible()
  })

  for (const viewport of [{ width: 2560, height: 1440 }, { width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`filters and reviews employee readiness at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await prepareWorkspace(page)
      await page.goto("/dashboard/employees/onboarding")
      await expect(page.getByText("1 of 1 open requests", { exact: false })).toBeVisible()
      await page.getByRole("searchbox", { name: "Search onboarding overview" }).fill("missing employee")
      await expect(page.getByText("No open requests match these filters.")).toBeVisible()
      await page.getByRole("button", { name: "Clear filters", exact: true }).click()
      await expect(page.getByRole("combobox", { name: "Responsible owner", exact: true })).not.toBeVisible()
      await page.getByRole("button", { name: "Filters", exact: true }).click()
      await page.getByRole("combobox", { name: "Responsible owner", exact: true }).click()
      await page.getByRole("option", { name: "HR / Employee", exact: true }).click()
      await page.getByRole("button", { name: "Show results", exact: true }).click()
      await expect(page.getByRole("button", { name: "Remove Responsible owner filter: HR / Employee", exact: true })).toBeVisible()
      await expect(page.getByRole("combobox", { name: "Responsible owner", exact: true })).not.toBeVisible()
      await page.getByRole("button", { name: "Remove Responsible owner filter: HR / Employee", exact: true }).click()
      await expect(page.getByRole("button", { name: "Clear filters", exact: true })).not.toBeVisible()
      await expect(page.getByText("1 of 1 open requests", { exact: false })).toBeVisible()
      await page.getByRole("button", { name: "Review onboarding for Amina Test", exact: true }).click()
      await expect(page.getByRole("region", { name: "Activation overview · Amina Test" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Activate employee", exact: true })).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Manage contract for Signed contract covering the start date", exact: true })).toBeVisible()
      const dialog = page.getByRole("region", { name: "Employee onboarding workspace", exact: true })
      const sheet = page.getByRole("dialog", { name: "Employee onboarding workspace", exact: true })
      await expect(sheet).toBeVisible()
      await expect.poll(async () => {
        const bounds = await sheet.boundingBox()
        return bounds !== null && Math.abs(bounds.x) <= 1 && Math.abs(bounds.y) <= 1 && Math.abs(bounds.width - viewport.width) <= 1 && Math.abs(bounds.height - viewport.height) <= 1
      }).toBe(true)
      await expect.poll(async () => {
        const current = await dialog.boundingBox()
        return current !== null && Math.abs(current.x) <= 1 && Math.abs(current.width - viewport.width) <= 1
      }).toBe(true)
      const bounds = await dialog.boundingBox()
      expect(Math.round(bounds?.width ?? Infinity)).toBeLessThanOrEqual(viewport.width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (viewport.width < 640) {
        const label = dialog.getByRole("heading", { name: "Signed contract covering the start date", exact: true })
        await expect(label).toBeVisible()
        expect((await label.boundingBox())?.width).toBeGreaterThan(150)
      }
      await page.screenshot({ path: test.info().outputPath("readiness-dialog.png"), fullPage: true })
      await sheet.press("Escape")
      await expect(sheet).not.toBeVisible()
      await expect(page).not.toHaveURL(/request_id=/)
      await expect(page.getByRole("button", { name: "Review onboarding for Amina Test", exact: true })).toBeVisible()
    })
  }

  test("recovers from overview failure without showing false ready counts", async ({ page }) => {
    const state = await prepareWorkspace(page)
    state.failOverview = true
    await page.goto("/dashboard/employees/onboarding")
    await expect(page.getByText("Overview unavailable", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Review onboarding for Amina Test", exact: true })).toHaveCount(0)
    state.failOverview = false
    await page.getByRole("button", { name: "Refresh overview", exact: true }).click()
    await expect(page.getByText("1 of 1 open requests", { exact: false })).toBeVisible()
  })

  test("does not offer activation to a read-only HR viewer", async ({ page }) => {
    const state = await prepareWorkspace(page, false)
    state.ready = true
    await page.goto("/dashboard/employees/onboarding?request_id=55")
    await expect(page.getByRole("region", { name: "Activation overview · Amina Test" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Activate employee", exact: true })).toHaveCount(0)
    expect(state.activationCalls).toBe(0)
  })

  test("handles a changed activation prerequisite and retries successfully", async ({ page }) => {
    const state = await prepareWorkspace(page)
    state.ready = true
    state.failActivation = true
    await page.goto("/dashboard/employees/onboarding?request_id=55")
    const activate = page.getByRole("button", { name: "Activate employee", exact: true })
    await expect(activate).toBeEnabled()
    await page.screenshot({ path: test.info().outputPath("ready-for-activation.png"), fullPage: true })
    await activate.click()
    await page.getByRole("button", { name: "Confirm activation", exact: true }).click()
    await expect(page.locator("main").getByText("Employee is not ready for activation: signed employment contract", { exact: true })).toBeVisible()
    expect(state.completed).toBe(false)
    state.failActivation = false
    await activate.click()
    await page.getByRole("button", { name: "Confirm activation", exact: true }).click()
    await expect(page.getByText("Onboarding finalized", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "Activate employee", exact: true })).toHaveCount(0)
    expect(state.activationCalls).toBe(2)
    await page.screenshot({ path: test.info().outputPath("onboarding-finalized.png"), fullPage: true })
  })

  test("preserves overview filters and opens focused workspace tabs", async ({ page }) => {
    await prepareWorkspace(page)
    await page.goto("/dashboard/employees/onboarding")
    await page.getByRole("searchbox", { name: "Search onboarding overview" }).fill("Amina")
    await page.getByRole("button", { name: "Review onboarding for Amina Test", exact: true }).click()
    await page.getByRole("button", { name: "Manage contract for Signed contract covering the start date", exact: true }).click()
    await expect(page.getByRole("tab", { name: "Contract", exact: true })).toHaveAttribute("aria-selected", "true")
    await page.getByRole("button", { name: "← Back to onboarding", exact: true }).click()
    await expect(page.getByRole("searchbox", { name: "Search onboarding overview" })).toHaveValue("Amina")
    await expect(page).not.toHaveURL(/request_id=/)
  })

  test("shows real dependency reasons for an approval that cannot proceed", async ({ page }) => {
    await prepareWorkspace(page)
    const approval = { id: "approval-3", label: "Starting salary review", group: "Approvals", owner: "Payroll approver", required: true, status: "pending", action: "approvals", actionable: false, waiting_reason: "Waiting for earlier required workflow steps to complete." }
    await page.route("**/api/onboarding/requests/55/readiness", (route) => route.fulfill({ json: { employee_id: 501, employee_status: "onboarding", request_status: "in_progress", closed: false, ready_to_activate: false, blocker_count: 1, completed_required: 0, total_required: 1, next_action: approval, requirements: [approval] } }))
    await page.goto("/dashboard/employees/onboarding?request_id=55")
    await page.getByRole("button", { name: "More information about Starting salary review", exact: true }).hover()
    await expect(page.getByText("Waiting on a prerequisite:", { exact: false })).toBeVisible()
    await expect(page.getByRole("button", { name: "Activate employee", exact: true })).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath("waiting-on-approval.png"), fullPage: true })
  })

  test("preserves masked payroll identifiers when editing payroll setup", async ({ page }) => {
    await prepareWorkspace(page, true, ["payroll:profiles:read", "payroll:profiles"])
    const requirement = { id: "TIN", label: "Tax identification number", group: "Employment & payroll", owner: "Payroll", required: true, status: "pending", action: "payroll" }
    await page.route("**/api/onboarding/requests/55/readiness", (route) => route.fulfill({ json: { employee_id: 501, employee_status: "onboarding", request_status: "in_progress", closed: false, ready_to_activate: false, blocker_count: 1, completed_required: 0, total_required: 1, next_action: requirement, requirements: [requirement] } }))
    let submitted: Record<string, unknown> | null = null
    await page.route("**/api/payroll/employees/profiles*", async (route) => {
      if (route.request().method() === "POST") {
        submitted = route.request().postDataJSON()
        return route.fulfill({ json: { message: "Saved" } })
      }
      return route.fulfill({ json: { data: [{ employeeId: 501, payrollNumber: "PAY-501", effectiveFrom: "2026-10-01", taxpayerIdentificationNumber: "*****6789", socialSecurityNumber: "*****3456", healthInsuranceNumber: "*****1234", version: 4 }] } })
    })
    await page.goto("/dashboard/employees/onboarding?request_id=55")
    await page.getByRole("button", { name: "Open payroll for Tax identification number", exact: true }).click()
    const drawer = page.getByRole("dialog", { name: "Payroll setup", exact: true })
    await expect(drawer.getByLabel("Tax identification number", { exact: true })).toHaveValue("")
    await drawer.getByRole("textbox", { name: /^Payroll number/ }).fill("PAY-502")
    await drawer.getByRole("button", { name: "Save payroll setup", exact: true }).click()
    await expect(drawer).not.toBeVisible()
    expect(submitted).toMatchObject({ payroll_number: "PAY-502", expected_version: 4, preserve_existing_identifiers: true })
    expect(submitted).not.toHaveProperty("taxpayer_identification_number")
    expect(submitted).not.toHaveProperty("social_security_number")
    expect(submitted).not.toHaveProperty("health_insurance_number")
    await page.getByRole("button", { name: "Implement salary", exact: true }).click()
    await expect(page.getByRole("dialog", { name: "Joining salary & payroll", exact: true })).toBeVisible()
  })

  test("retains a handoff draft after failure and saves an employee-visible message", async ({ page }) => {
    const state = await prepareWorkspace(page, true, ["onboarding_requests:update"])
    state.failNote = true
    await page.goto("/dashboard/employees/onboarding?request_id=55")
    await page.getByRole("button", { name: "Handoff", exact: true }).first().click()
    await page.getByLabel("Note visibility", { exact: true }).selectOption("employee")
    const note = page.getByLabel("Handoff note", { exact: true })
    await note.fill("Please review and sign the prepared contract.")
    await page.getByRole("button", { name: "Save handoff note", exact: true }).click()
    await expect(page.getByText("Notes temporarily unavailable", { exact: true })).toBeVisible()
    await expect(note).toHaveValue("Please review and sign the prepared contract.")
    state.failNote = false
    await page.getByRole("button", { name: "Save handoff note", exact: true }).click()
    await expect(page.getByText("Visible to employee", { exact: true })).toBeVisible()
    await expect(note).toHaveValue("")
    expect(state.notes).toHaveLength(1)
  })
})
