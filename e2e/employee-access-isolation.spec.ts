import { expect, test } from "@playwright/test"
import { DASHBOARD_AUTH_COOKIE } from "../src/lib/dashboard-permissions"

test.use({ video: "off" })

test("employee can use personal pages but cannot open management routes", async ({ page }) => {
  const permissions = ["data_scope:self", "employees:read", "leave_requests:read", "leave_balances:read", "leave_types:read", "attendance_summaries:read", "attendance_policies:read", "offboarding_requests:read", "notifications:read"]
  const user = { id: 90, email: "employee@example.test", fullName: "Test Employee", roles: ["EMPLOYEE"], permissions, scope: "company", companyId: 10, company_id: 10, dashboardType: "employee", accessContextResolved: true }
  const token = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: 90, scope: "company", userType: "COMPANY_USER", companyId: 10, companyMembershipId: 90, roles: user.roles, permissions, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`
  await page.context().addCookies([{ name: DASHBOARD_AUTH_COOKIE, value: "1", url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000" }])
  await page.addInitScript(({ token, user, permissions }) => {
    localStorage.setItem("ess.auth.tokens", JSON.stringify({ accessToken: token, refreshToken: "fixture" }))
    localStorage.setItem("ess.auth.user", JSON.stringify(user))
    localStorage.setItem("hrms.admin.accessToken", token)
    sessionStorage.setItem("hrms.dashboard.actorPermissions", JSON.stringify(permissions))
    sessionStorage.setItem("hrms.dashboard.accessMode", "employee")
    sessionStorage.setItem("hrms.dashboard.actorRoles", JSON.stringify(["EMPLOYEE"]))
    sessionStorage.setItem("hrms.dashboard.scope", "company")
  }, { token, user, permissions })
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({ status: 200, json: path.includes("auth/me") ? { ...user, dashboard_type: "employee" } : { data: [] } })
  })
  await page.goto("/dashboard/me/leave/requests", { waitUntil: "domcontentloaded", timeout: 120000 })
  await expect(page).toHaveURL(/\/dashboard\/me\/leave\/requests/)
  for (const path of ["/dashboard/employees/all", "/dashboard/leave-management/balances", "/dashboard/attendance/daily-summaries", "/dashboard/me/team/members", "/dashboard/operations/reports"]) {
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 120000 })
    await expect(page).not.toHaveURL(new RegExp(path.replaceAll("/", "\\/") + "(?:[/?]|$)"), { timeout: 20000 })
  }
})
