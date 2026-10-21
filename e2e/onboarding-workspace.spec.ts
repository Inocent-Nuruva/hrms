import { expect, test, type Page } from "@playwright/test"
import { DASHBOARD_AUTH_COOKIE } from "../src/lib/dashboard-permissions"

async function prepareWorkspace(page: Page, canActivate = true, extraPermissions: string[] = []) {
  await page.context().addCookies([{ name: DASHBOARD_AUTH_COOKIE, value: "1", url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" }])
  const permissions = ["view_company_dashboard", "view_company_data", "data_scope:company", "employees:read", "onboarding_requests:read", ...(canActivate ? ["onboarding_requests:complete"] : []), ...extraPermissions]
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
  const state = { ready: false, completed: false, failOverview: false, failActivation: false, activationCalls: 0 }
  const employee = { id: 501, first_name: "Amina", last_name: "Test", employee_no: "TEST-501", employment_status: "onboarding", primary_department: { id: 1, name: "Finance" } }
  const requirement = { id: "signed employment contract", label: "Signed contract covering the start date", group: "Contract", owner: "HR / Employee", required: true, status: "pending", action: "contracts" }
  const readiness = () => ({ employee_id: 501, employee_status: state.completed ? "active" : "onboarding", request_status: state.completed ? "completed" : "in_progress", ready_to_activate: state.ready && !state.completed, closed: state.completed, blocker_count: state.ready ? 0 : 1, completed_required: state.ready ? 10 : 9, total_required: 10, next_action: state.ready ? null : requirement, requirements: [{ ...requirement, status: state.ready ? "complete" : "pending" }] })
  const request = () => ({ id: 55, employee_id: 501, employee: { ...employee, employment_status: state.completed ? "active" : "onboarding" }, onboarding_no: "TEST-ONB-55", title: "Onboarding for Amina Test", status: state.completed ? "completed" : "in_progress", progress_percentage: "100.00", tasks: [], approvals: [] })
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    let payload: unknown = { data: [] }
    if (path === "/api/onboarding/requests/overview") {
      if (state.failOverview) return route.fulfill({ status: 503, json: { message: "Readiness temporarily unavailable" } })
      payload = { data: state.completed ? [] : [{ id: 55, employee_id: 501, employee_name: "Amina Test", employee_no: "TEST-501", onboarding_no: "TEST-ONB-55", department: "Finance", stage: state.ready ? "Ready for activation" : "Contract", overdue: true, overdue_task_count: 0, owners: [state.ready ? "Authorized HR" : "HR / Employee"], planned_completion_date: "2026-01-01", blockers: state.ready ? [] : [requirement], readiness: readiness() }], next_cursor: null }
    } else if (path === "/api/onboarding/requests/55/readiness") payload = readiness()
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

  test("keeps invite, registration, onboarding and contracts in the employee workspace", async ({ page }) => {
    await prepareWorkspace(page, true, ["employees:create", "employees:update"])
    await page.goto("/dashboard/employees/onboarding")
    for (const [label, route] of [["Invite", "invite"], ["Registration", "registration"], ["Contracts", "contracts"], ["Onboarding", "onboarding"]]) {
      await page.getByRole("tab", { name: label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/dashboard/employees/${route}$`))
    }
    await expect(page.getByText("1 of 1 open requests", { exact: false })).toBeVisible()
  })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`filters and reviews employee readiness at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await prepareWorkspace(page)
      await page.goto("/dashboard/employees/onboarding")
      await expect(page.getByText("1 of 1 open requests", { exact: false })).toBeVisible()
      await page.getByRole("searchbox", { name: "Search onboarding overview" }).fill("missing employee")
      await expect(page.getByText("No open requests match these filters.")).toBeVisible()
      await page.getByRole("button", { name: "Clear filters", exact: true }).click()
      await page.getByRole("combobox", { name: "Responsible owner", exact: true }).click()
      await page.getByRole("option", { name: "HR / Employee", exact: true }).click()
      await page.getByRole("button", { name: "Review onboarding for Amina Test", exact: true }).click()
      await expect(page.getByText("Activation overview · Amina Test")).toBeVisible()
      await expect(page.getByRole("button", { name: "Activate employee", exact: true })).toBeDisabled()
      await expect(page.getByRole("button", { name: "Review Signed contract covering the start date", exact: true })).toBeVisible()
      const dialog = page.getByRole("dialog")
      await expect.poll(async () => {
        const current = await dialog.boundingBox()
        return current !== null && current.x >= -1 && current.x + current.width <= viewport.width + 1
      }).toBe(true)
      const bounds = await dialog.boundingBox()
      expect(Math.round(bounds?.width ?? Infinity)).toBeLessThanOrEqual(viewport.width)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (viewport.width < 640) {
        const label = page.getByRole("dialog").locator("p").filter({ hasText: /^Signed contract covering the start date$/ })
        expect((await label.boundingBox())?.width).toBeGreaterThan(200)
      }
      await page.screenshot({ path: test.info().outputPath("readiness-dialog.png"), fullPage: true })
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
    await expect(page.getByText("Activation overview · Amina Test")).toBeVisible()
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
    await activate.click()
    await expect(page.locator("main").getByText("Employee is not ready for activation: signed employment contract", { exact: true })).toBeVisible()
    expect(state.completed).toBe(false)
    state.failActivation = false
    await activate.click()
    await expect(page.getByText("Onboarding finalized", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Activate employee", exact: true })).toHaveCount(0)
    expect(state.activationCalls).toBe(2)
  })
})
