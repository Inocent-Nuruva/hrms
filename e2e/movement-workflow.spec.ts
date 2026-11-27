import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

const defaults = {
  source: "installation",
  require_management_approval: true,
  allow_backdating: false,
  max_backdate_days: 30,
}
const movement = (id: number, title: string, status: string) => ({
  id,
  title,
  movement_no: "MOV-" + id,
  movement_type: "DEPARTMENT_TRANSFER",
  status,
  effective_date: "2026-11-01",
  employee_acknowledgement_required: true,
  employee_acknowledged_at: null as string | null,
})

async function workspace(
  page: Page,
  scope: "employee" | "company",
  grants: string[]
) {
  const user = await installDashboardFixture(page, scope, grants)
  let policy = { ...defaults }
  const rows = [
    movement(1, "Scheduled transfer", "SCHEDULED"),
    movement(2, "Applied transfer", "APPLIED"),
  ]
  const requests: string[] = []
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    requests.push(method + " " + path)
    let json: unknown = { data: [] }
    if (["/api/auth/session", "/api/auth/me", "/api/users/me"].includes(path))
      json = { ...user, data: user }
    if (path === "/api/employee-movements/settings") {
      if (method === "PUT")
        policy = { ...route.request().postDataJSON(), source: "company" }
      if (method === "DELETE") policy = { ...defaults }
      json = policy
    }
    if (path === "/api/employee-movements/team")
      json = [
        {
          ...rows[1],
          title: "Reporting team transfer",
          employee: { id: 7, first_name: "Taylor", last_name: "Test" },
        },
      ]
    if (path === "/api/me/movements") json = rows
    if (path === "/api/me/movements/2/acknowledge" && method === "POST") {
      rows[1].employee_acknowledged_at = new Date().toISOString()
      json = rows[1]
    }
    await route.fulfill({ json })
  })
  return requests
}

for (const [device, width, height] of [
  ["desktop", 1366, 900],
  ["tablet", 820, 1180],
  ["mobile", 390, 844],
] as const) {
  test(
    "movement settings, case and reporting team on " + device,
    async ({ page }) => {
      await page.setViewportSize({ width, height })
      const requests = await workspace(page, "company", [
        "employee_movements:manage-settings",
        "employee_movements:create",
        "employee_movements:read",
        device === "mobile" ? "manager_self_service:read" : "manager_team:read",
      ])
      await page.goto("/dashboard/movements/settings")
      await expect(
        page.getByRole("heading", { name: "Movement settings" })
      ).toBeVisible()
      const limit = page.getByLabel("Maximum backdate days")
      await expect(limit).toHaveValue("30")
      await page
        .getByRole("checkbox", { name: "Allow backdating for users with backdate permission" })
        .check()
      await limit.fill("12")
      await page.getByRole("button", { name: "Save settings" }).click()
      await expect(page.getByText("Movement settings saved.")).toBeVisible()
      await page.reload()
      await expect(limit).toHaveValue("12")
      await page
        .getByRole("button", { name: "Restore installation defaults" })
        .click()
      await expect(limit).toHaveValue("30")
      await page.goto("/dashboard/movements/cases")
      await page
        .getByRole("button", { name: "New movement", exact: true })
        .first()
        .click()
      const acknowledgement = page.getByRole("checkbox", { name: "Require employee acknowledgement after the movement is applied" })
      await expect(acknowledgement).not.toBeChecked()
      await acknowledgement.check()
      await expect(acknowledgement).toBeChecked()
      const hrCalls = requests.filter(
        (url) => url === "GET /api/employee-movements"
      ).length
      await page.goto("/dashboard/team/movements")
      await expect(
        page.getByText("Reporting team transfer").first()
      ).toBeVisible()
      expect(requests).toContain("GET /api/employee-movements/team")
      expect(
        requests.filter((url) => url === "GET /api/employee-movements")
      ).toHaveLength(hrCalls)
    }
  )

  test("movement employee acknowledgement on " + device, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const requests = await workspace(page, "employee", [])
    await page.goto("/dashboard/me/movements")
    await expect(
      page.getByText("Scheduled transfer", { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/After application/).first()).toBeVisible()
    const button = page.getByRole("button", {
      name: "Acknowledge",
      exact: true,
    })
    await expect(button).toHaveCount(1)
    await button.click()
    await expect(button).toHaveCount(0)
    expect(requests).toContain("POST /api/me/movements/2/acknowledge")
    await page.goto("/dashboard/movements/settings")
    await expect(page).not.toHaveURL(/movements\/settings$/)
    expect(requests).not.toContain("GET /api/employee-movements/settings")
  })
}
