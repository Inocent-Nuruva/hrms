import { expect, test, type Page } from "@playwright/test"
import { installDashboardFixture } from "./helpers/dashboard-fixture"

async function workspace(
  page: Page,
  scope: "employee" | "company",
  grants: string[]
) {
  const user = await installDashboardFixture(page, scope, grants, false)
  const employee = { id: 14, name: "Robin Vale (E014)" }
  const data = {
    id: 51,
    employee_id: 14,
    employee: employee.name,
    submitted_by: "Test manager",
    recommendation_type: "PROMOTION",
    rationale: "Led a successful project and coached two new analysts.",
    proposal: { proposed_position_title: "Senior analyst" },
    status: "SUBMITTED",
    proposed_effective_date: null,
    submitted_at: "2026-11-01T12:00:00Z",
    reviewed_at: null,
    feedback: null as string | null,
    revises_id: null as number | null,
  }
  const mine: (typeof data)[] = [
    { ...data, status: "RETURNED", feedback: "Add the delivery results." },
  ]
  let queue = [{ ...data }]
  const writes: string[] = []
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname
    let json: unknown = { data: [] }
    if (["/api/users/me", "/api/auth/me", "/api/auth/session"].includes(path))
      json = { ...user, data: user }
    else if (path === "/api/me/insights")
      json = {
        attendance: {
          from_date: "2026-10-26",
          to_date: "2026-11-24",
          total_days: 15,
          present_days: 12,
          absent_days: 1,
          half_days: 1,
          late_days: 3,
          leave_days: 1,
        },
        leave: {
          approved: 4,
          returned_for_correction: 1,
          pending_total: 3,
          draft: 0,
        },
      }
    else if (path === "/api/me/team/recommendations/options")
      json = {
        employees: [employee],
        departments: [{ id: 2, name: "Operations", branch_id: 4 }],
        branches: [{ id: 4, name: "Central" }],
      }
    else if (path === "/api/me/team/recommendations") {
      if (request.method() === "POST") {
        const body = request.postDataJSON()
        writes.push(JSON.stringify(body))
        mine.unshift({
          ...data,
          ...body,
          id: 52 + mine.length,
          status: "SUBMITTED",
          feedback: null,
        })
        json = { id: mine[0].id, status: "SUBMITTED" }
      } else json = { data: mine }
    } else if (path === "/api/hr/recommendations/pending")
      json = { data: queue }
    else if (
      path === "/api/hr/recommendations/51/decision" &&
      request.method() === "POST"
    ) {
      writes.push(JSON.stringify(request.postDataJSON()))
      queue = []
      json = { id: 51, status: "RETURNED" }
    } else if (
      path.startsWith("/api/hr/self-service/approvals/profile-updates")
    ) {
      const row = {
        id: 61,
        employee_id: 14,
        employee_name: "Robin Vale",
        request_no: "PR-61",
        request_type: "PROFILE_UPDATE",
        status: "PENDING_HR_APPROVAL",
        can_approve: true,
        review_stage: "hr",
        submitted_at: "2026-11-01T12:00:00Z",
        payload: { changes: { preferred_name: "Robin" } },
      }
      json = path.endsWith("/61")
        ? row
        : {
            data: [row],
            meta: {
              totalItems: 1,
              totalPages: 1,
              currentPage: 1,
              itemCount: 1,
              itemsPerPage: 100,
            },
          }
    }
    await route.fulfill({ json })
  })
  return writes
}

for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
] as const) {
  test(
    "personal insights and permission-filtered To do on " + device,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height })
      await workspace(page, "employee", [])
      await page.goto("/dashboard/me/insights", {
        waitUntil: "domcontentloaded",
      })
      await expect(
        page.getByRole("heading", { name: "My insights", exact: true })
      ).toBeVisible()
      await expect(page.getByText("Recorded days").locator("..")).toContainText(
        "15"
      )
      await expect(
        page.getByText("Awaiting review", { exact: true }).locator("..")
      ).toContainText("2")
      await expect(page).toHaveURL(/\/me\/insights$/)
      if (device === "desktop")
        await page
          .getByRole("heading", { name: "My insights", exact: true })
          .locator("..")
          .screenshot({ path: info.outputPath("my-insights.png") })
      const open = page.getByRole("button", { name: "Open navigation" })
      if (await open.isVisible()) await open.click()
      const allQueues = page.getByRole("button", {
        name: "All queues",
        exact: true,
      })
      if (!(await allQueues.isVisible()))
        await page
          .getByRole("button", { name: /^To do Pinned by default/ })
          .click()
      await allQueues.click()
      await expect(page).toHaveURL(/\/dashboard\/to-do$/)
      const queues = page.getByRole("navigation", { name: "To do queues" })
      await expect(
        queues.getByRole("link", { name: "Employee Requests" })
      ).toBeVisible()
      await expect(
        queues.getByRole("link", { name: "Review recommendations" })
      ).toHaveCount(0)
      await expect(
        queues.getByRole("link", { name: "Profile Update Approvals" })
      ).toHaveCount(0)
      await page.goto("/dashboard/to-do/recommendations", {
        waitUntil: "domcontentloaded",
      })
      await expect(page).not.toHaveURL(/\/to-do\/recommendations$/)
      await page.goto("/dashboard/me/team/recommendations", {
        waitUntil: "domcontentloaded",
      })
      await expect(page).not.toHaveURL(/\/team\/recommendations$/)
    }
  )
  test(
    "manager sends a transfer and revises a returned proposal on " + device,
    async ({ page }, info) => {
      await page.setViewportSize({ width, height })
      const writes = await workspace(page, "company", [
        "manager_recommendations:submit",
      ])
      await page.goto("/dashboard/me/team/recommendations", {
        waitUntil: "domcontentloaded",
      })
      await expect(
        page.getByRole("heading", { name: "Team recommendations", exact: true })
      ).toBeVisible()
      await page.getByLabel("Team member").selectOption("14")
      await page.getByLabel("Recommendation type").selectOption("TRANSFER")
      await page.getByLabel("Proposed branch").selectOption("4")
      await page.getByLabel("Proposed department").selectOption("2")
      await page
        .getByRole("textbox", { name: "Rationale", exact: true })
        .fill("Matching this assignment to the Operations vacancy.")
      if (device === "desktop")
        await page
          .getByRole("heading", { name: "New recommendation" })
          .locator("..")
          .screenshot({ path: info.outputPath("team-recommendation.png") })
      await page
        .getByRole("button", { name: "Submit recommendation", exact: true })
        .click()
      await expect(
        page.getByText("Recommendation submitted to HR.")
      ).toBeVisible()
      expect(JSON.parse(writes[0])).toMatchObject({
        employee_id: 14,
        recommendation_type: "TRANSFER",
        proposal: { proposed_department_id: 2, proposed_branch_id: 4 },
      })
      await page
        .getByRole("button", { name: "Revise recommendation", exact: true })
        .click()
      await expect(
        page.getByRole("heading", { name: "Revise recommendation #51" })
      ).toBeFocused()
      await expect(page.getByLabel("Team member")).toBeDisabled()
      await page
        .getByRole("textbox", { name: "Rationale", exact: true })
        .fill("Delivered the migration and coached three analysts.")
      await page.getByRole("button", { name: "Submit revision" }).click()
      await expect(page.getByText(/Revision of #51/)).toBeVisible()
      expect(JSON.parse(writes[1])).toMatchObject({
        revises_id: 51,
        employee_id: 14,
        recommendation_type: "PROMOTION",
      })
    }
  )
  test(
    "HR reviews recommendations and profile updates on " + device,
    async ({ page }) => {
      await page.setViewportSize({ width, height })
      const writes = await workspace(page, "company", [
        "manager_recommendations:review",
        "self_service_requests:final_approve",
      ])
      await page.goto("/dashboard/to-do", { waitUntil: "domcontentloaded" })
      const queues = page.getByRole("navigation", { name: "To do queues" })
      await queues.getByRole("link", { name: "Review recommendations" }).click()
      const card = page.getByRole("article")
      await expect(card).toContainText("Senior analyst")
      await card.getByRole("button", { name: "Return", exact: true }).click()
      await expect(card.getByRole("alert")).toContainText("five characters")
      await card
        .getByLabel("Feedback to the manager")
        .fill("Add the delivery results.")
      await card.getByRole("button", { name: "Return", exact: true }).click()
      await expect(
        page.getByText("No recommendations await your review.")
      ).toBeVisible()
      expect(JSON.parse(writes[0])).toMatchObject({
        decision: "RETURN",
        comment: "Add the delivery results.",
      })
      await page.goto(
        "/dashboard/employees/profile-update-approvals?highlight=61",
        { waitUntil: "domcontentloaded" }
      )
      const dialog = page.getByRole("alertdialog", { name: "PR-61" })
      await expect(
        dialog.getByRole("button", { name: "Reject", exact: true })
      ).toBeVisible()
      await expect(
        dialog.getByRole("button", { name: "Return", exact: true })
      ).toBeVisible()
      const corrections = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          "/api/hr/self-service/approvals/attendance-corrections"
      )
      await page.goto("/dashboard/attendance/correction-requests", {
        waitUntil: "domcontentloaded",
      })
      expect((await corrections).ok()).toBe(true)
    }
  )
}
