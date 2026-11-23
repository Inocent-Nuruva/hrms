import { expect, test, type Page } from "@playwright/test"

/**
 * Browser check that sidebar module names are identical for every role and
 * screen size. The backend is fully mocked in the browser (no server or
 * database is contacted), so this verifies the real frontend layout only.
 * Screenshots land in outputs/sidebar-module-names/.
 */

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8888"

type Persona = {
  key: string
  roles: string[]
  permissions: string[]
  dashboardType: "admin" | "employee"
}

const personas: Persona[] = [
  { key: "employee", roles: ["EMPLOYEE"], permissions: ["data_scope:self"], dashboardType: "employee" },
  {
    key: "hr-manager",
    roles: ["HR_MANAGER"],
    permissions: [
      "data_scope:company",
      "employees:read",
      "employees:create",
      "employees:update",
      "attendance_summaries:read",
      "attendance_policies:read",
      "shifts:read",
      "leave_requests:read",
      "leave_types:read",
      "self_service_requests:final_approve",
    ],
    dashboardType: "admin",
  },
]

const viewports = [
  { key: "desktop", width: 1440, height: 900 },
  { key: "tablet", width: 820, height: 1180 },
  { key: "phone", width: 390, height: 844 },
]

function fakeJwt(sub: number) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b64({ alg: "none" })}.${b64({ sub, companyId: 1, exp: 4_102_444_800 })}.sig`
}

async function signInAs(page: Page, persona: Persona) {
  const user = {
    id: 7,
    fullName: `Test ${persona.key}`,
    email: `${persona.key}@example.test`,
    role: persona.roles[0],
    roles: persona.roles,
    scope: "company",
    dashboardType: persona.dashboardType,
    companyId: 1,
    companyName: "Example Co",
    permissions: persona.permissions,
    accessContextResolved: true,
  }

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === "/api/users/me") {
      return route.fulfill({ json: { data: user } })
    }
    return route.fulfill({ json: { data: [], items: [], total: 0 } })
  })

  await page.context().addCookies([
    { name: "hrms_dashboard_auth", value: "1", url: test.info().project.use.baseURL ?? "http://localhost:3000" },
  ])
  await page.addInitScript(
    ([session, token]) => {
      window.localStorage.setItem("hrms.auth.session.v1", session)
      window.localStorage.setItem("hrms.admin.accessToken", token)
    },
    [
      JSON.stringify({ tokens: { accessToken: fakeJwt(7), refreshToken: "r" }, user, credentialVersion: "e2e-1" }),
      fakeJwt(7),
    ] as const,
  )
}

for (const persona of personas) {
  for (const viewport of viewports) {
    test(`sidebar module names – ${persona.key} – ${viewport.key}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await signInAs(page, persona)
      test.setTimeout(240_000)
      // The sidebar is part of the dashboard layout, so any page shows it. Settings
      // is used because it renders without business data from the mocked API.
      await page.goto("/dashboard/settings", { waitUntil: "domcontentloaded", timeout: 180_000 })

      // The first-login "Complete your profile" panel can cover the page; dismiss it if it appears.
      const finishLater = page.getByRole("button", { name: "Finish later" })
      await finishLater.waitFor({ state: "visible", timeout: 20_000 }).then(() => finishLater.click()).catch(() => undefined)

      // Below the md breakpoint (768px) the sidebar is a slide-over opened from the header.
      if (viewport.width < 768) {
        await page.getByRole("button", { name: "Open navigation" }).click()
        // The slide-over focuses its search box; blur it so the suggestion list doesn't cover the menu.
        await page.waitForTimeout(500)
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      }
      const nav = page.locator('[data-sidebar="sidebar"]:visible').first()
      await expect(nav).toBeVisible({ timeout: 60_000 })
      const sidebar = nav

      // Module names are the same for every role. "My attendance" and
      // "My employee workspace" are groups *inside* these modules and stay
      // collapsed here, so they must not appear as top-level names.
      await expect(sidebar.getByRole("button", { name: "Attendance", exact: true })).toBeVisible({ timeout: 60_000 })
      await expect(sidebar.getByRole("button", { name: "Employees", exact: true })).toBeVisible()
      await expect(sidebar.getByRole("button", { name: "My profile", exact: true }).filter({ visible: true })).toHaveCount(0)
      await expect(sidebar.getByRole("button", { name: "My attendance", exact: true }).filter({ visible: true })).toHaveCount(0)

      const box = await sidebar.boundingBox()
      expect(box?.width ?? 0).toBeLessThanOrEqual(viewport.width)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(1)

      await page.screenshot({ path: `outputs/sidebar-module-names/${persona.key}-${viewport.key}.png` })
    })
  }
}
