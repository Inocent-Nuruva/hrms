import { test, type Page } from "@playwright/test"
import { DASHBOARD_AUTH_COOKIE } from "../../src/lib/dashboard-permissions"

export async function installDashboardFixture(
  page: Page,
  scope: "platform" | "company" | "employee",
  grants: string[]
) {
  const platform = scope === "platform"
  const employee = scope === "employee"
  const user = {
    id: 31,
    fullName: "UAT tester",
    email: "tester@example.test",
    scope: platform ? "platform" : "company",
    userType: platform ? "OWNER" : "COMPANY_USER",
    roles: platform
      ? [
          grants.includes("companies:delete")
            ? "SUPER_ADMIN"
            : "PLATFORM_ADMINISTRATOR",
        ]
      : [employee ? "EMPLOYEE" : "HR"],
    permissions: platform
      ? grants
      : [...(employee ? ["data_scope:self"] : ["data_scope:company", "company_dashboard:read"]), ...grants],
    ...(platform ? {} : { companyId: 17, companyMembershipId: 33 }),
    dashboardType: employee ? "employee" : "admin",
    accessContextResolved: true,
  }
  const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ ...user, sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`
  await page.context().addCookies([
    {
      name: DASHBOARD_AUTH_COOKIE,
      value: "1",
      url: test.info().project.use.baseURL!,
    },
  ])
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem(
        "hrms.auth.session.v1",
        JSON.stringify({
          tokens: { accessToken: token, refreshToken: "fixture" },
          user,
          credentialVersion: "test-fixture",
        })
      )
      localStorage.setItem("hrms.admin.accessToken", token)
      localStorage.setItem("ess.auth.user", JSON.stringify(user))
      sessionStorage.setItem(
        "hrms.dashboard.actorPermissions",
        JSON.stringify(user.permissions)
      )
    },
    { user, token }
  )

  return user
}
