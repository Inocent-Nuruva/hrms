import { chromium } from "playwright"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"

function encodeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.test`
}

function json(route, payload) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(payload),
  })
}

async function seed(page, { accessMode, permissions, user }) {
  const token = encodeJwt({
    sub: 2,
    email: user.email,
    scope: "company",
    userType: "COMPANY_USER",
    companyId: 1,
    roles: user.roles,
    permissions,
  })
  await page.addInitScript(
    ({ accessToken, sessionUser, permissionLabels, mode }) => {
      window.localStorage.setItem(
        "ess.auth.tokens",
        JSON.stringify({ accessToken, refreshToken: "refresh" }),
      )
      window.localStorage.setItem("ess.auth.user", JSON.stringify(sessionUser))
      window.localStorage.setItem("hrms.admin.accessToken", accessToken)
      window.sessionStorage.setItem("hrms.dashboard.actorPermissions", JSON.stringify(permissionLabels))
      window.sessionStorage.setItem("hrms.dashboard.accessMode", JSON.stringify(mode))
      window.sessionStorage.setItem("hrms.dashboard.isAdmin", mode === "admin" ? "true" : "false")
    },
    { accessToken: token, sessionUser: user, permissionLabels: permissions, mode: accessMode },
  )
}

async function mockApis(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url()
    if (!url.includes("/api/")) return route.continue()
    if (url.includes("/api/performance/dashboard/summary")) {
      return json(route, { data: { average_score: 84, open_reviews: 6, completion_rate: 71 } })
    }
    if (url.includes("/api/performance/financial-years")) {
      return json(route, { data: [{ id: 12, code: "FY2026", name: "FY 2026", status: "OPEN", startDate: "2026-01-01", endDate: "2026-12-31" }] })
    }
    if (url.includes("/api/performance/periods")) {
      return json(route, { data: [{ id: 3, name: "Q2 2026", periodType: "QUARTERLY", status: "SELF_REVIEW" }] })
    }
    if (url.includes("/api/performance/kpis")) {
      return json(route, { data: [{ id: 8, code: "ATT-01", name: "Attendance", status: "ACTIVE" }] })
    }
    if (url.includes("/api/performance/plans")) {
      return json(route, { data: [{ id: 21, status: "ACTIVE", employee: { full_name: "Amina Juma" }, items: [] }] })
    }
    if (url.includes("/api/performance/appeals")) {
      return json(route, { data: [{ id: 5, status: "OPEN", reason: "Score too low", employee: { full_name: "Amina Juma" } }] })
    }
    if (url.includes("/api/performance/improvement-plans")) {
      return json(route, { data: [{ id: 2, summary: "Raise close rate", status: "OPEN", milestones: [{ id: 9, title: "Week 2" }] }] })
    }
    if (url.includes("/api/performance/me/summary")) return json(route, { data: { current_score: 78 } })
    if (url.includes("/api/performance/me/assignments")) return json(route, { data: [{ id: 41, status: "OPEN", totalWeight: "100" }] })
    if (url.includes("/api/performance/me/reviews")) return json(route, { data: [{ id: 9, status: "SELF_REVIEW_PENDING", finalScore: "78", periodAssignmentId: 41 }] })
    if (url.includes("/api/performance/me/achievements")) return json(route, { data: [{ id: 4, name: "Attendance", achievement_value: 96, status: "OPEN" }] })
    if (url.includes("/api/performance/me/improvement-plans")) return json(route, { data: [{ id: 2, summary: "Raise close rate", status: "OPEN" }] })
    if (url.includes("/api/performance/manager/summary")) return json(route, { data: { team_size: 6, pending_reviews: 2, average_score: 81 } })
    if (url.includes("/api/performance/manager/team-achievements")) {
      return json(route, { data: [{ id: 7, employee: { full_name: "Amina Juma" }, name: "Attendance", achievement_value: 96 }] })
    }
    if (url.includes("/api/probation/dashboard/summary")) {
      return json(route, { data: { open_cases: 4, due_this_week: 1, confirmation_rate: 88 } })
    }
    if (url.includes("/api/probation/policies")) {
      return json(route, { data: [{ id: 4, code: "FT-90", name: "Full time 90 days", status: "ACTIVE", probationPeriodDays: 90 }] })
    }
    if (url.includes("/api/probation/cases/my-team")) {
      return json(route, { data: [{ id: 19, caseNo: "PRB-19", status: "IN_REVIEW", employee: { full_name: "Amina Juma" } }] })
    }
    if (url.includes("/api/probation/cases/18") || url.includes("/api/probation/cases/19")) {
      return json(route, { data: { id: 18, caseNo: "PRB-18", status: "IN_REVIEW", currentDueDate: "2026-09-01", employee: { full_name: "Amina Juma" } } })
    }
    if (url.includes("/api/probation/cases")) {
      return json(route, { data: [{ id: 18, caseNo: "PRB-18", status: "IN_REVIEW", employee: { full_name: "Amina Juma" } }] })
    }
    if (url.includes("/api/me/probation")) {
      return json(route, {
        data: {
          id: 18,
          caseNo: "PRB-18",
          status: "IN_PROGRESS",
          currentDueDate: "2026-09-01",
          policy: { name: "Full time 90 days", criteria: [{ code: "QUALITY", name: "Quality" }] },
          objectives: [{ id: 1, title: "Learn the product", employeeCompletionPercent: "40" }],
        },
      })
    }
    if (url.includes("/api/employees")) {
      return json(route, { data: [{ id: 120, full_name: "Amina Juma" }], meta: { page: 1, total: 1 } })
    }
    if (url.includes("/api/users/me")) return json(route, { data: { email: "admin@alliance.co.tz" } })
    if (url.includes("/api/performance/") || url.includes("/api/probation/")) return json(route, { data: [] })
    return json(route, { data: {} })
  })
}

async function visit(page, path, needles) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1600)
  const body = (await page.locator("body").innerText()).toLowerCase()
  const missing = needles.filter((needle) => !body.includes(needle.toLowerCase()))
  const nav = (await page.locator("nav, aside, [data-sidebar]").first().innerText().catch(() => "")).toLowerCase()
  return { path, url: page.url(), missing, nav, body: body.slice(0, 500) }
}

async function clickIfVisible(page, name) {
  const button = page.getByRole("button", { name }).first()
  if ((await button.count()) > 0 && (await button.isVisible().catch(() => false))) {
    await button.click({ force: true })
    await page.waitForTimeout(400)
    return true
  }
  return false
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const report = { hr: [], employee: [], clicks: {}, failures: [] }

  const hrContext = await browser.newContext()
  const hrPage = await hrContext.newPage()
  await mockApis(hrPage)
  await seed(hrPage, {
    accessMode: "admin",
    permissions: [
      "view_company_dashboard",
      "view_company_data",
      "performance:read",
      "performance:create",
      "probation:read",
      "probation:create",
    ],
    user: {
      email: "hr@alliance.co.tz",
      first_name: "HR",
      last_name: "Admin",
      roles: ["COMPANY_ADMIN", "HR"],
      permissions: ["view_company_dashboard", "performance:read", "probation:read"],
    },
  })

  for (const check of [
    ["/dashboard/performance/overview", ["Company review cycle", "Average score"]],
    ["/dashboard/performance/setup", ["Performance setup", "Years", "KPIs"]],
    ["/dashboard/performance/plans", ["Employee plans", "Generate from rules"]],
    ["/dashboard/performance/reviews", ["Reviews and appeals", "Moderate"]],
    ["/dashboard/performance/improvement", ["Improvement plans", "New PIP"]],
    ["/dashboard/probation/overview", ["Confirmation pipeline", "Open cases"]],
    ["/dashboard/probation/policies", ["Probation policies", "New policy"]],
    ["/dashboard/probation/cases", ["Probation cases"]],
    ["/dashboard/probation/team", ["Team cases"]],
  ]) {
    const result = await visit(hrPage, check[0], check[1])
    report.hr.push(result)
    if (result.missing.length) report.failures.push(`HR ${result.path}: missing ${result.missing.join(", ")}`)
  }
  report.clicks.hrNew = await clickIfVisible(hrPage, /New policy|New PIP|New plan|New/i)
  report.clicks.hrNavHasPerformance = (report.hr.at(-1)?.nav || "").includes("performance")
  report.clicks.hrNavHasProbation = (report.hr.at(-1)?.nav || "").includes("probation")
  report.clicks.hrNavHidesMyPerformance = !(report.hr.at(-1)?.nav || "").includes("my performance")
  await hrContext.close()

  const empContext = await browser.newContext()
  const empPage = await empContext.newPage()
  await mockApis(empPage)
  await seed(empPage, {
    accessMode: "employee",
    permissions: [],
    user: {
      email: "staff@alliance.co.tz",
      first_name: "Amina",
      last_name: "Juma",
      roles: ["EMPLOYEE"],
      permissions: [],
    },
  })

  for (const check of [
    ["/dashboard/me/performance/overview", ["Your scorecard", "Current score"]],
    ["/dashboard/me/performance/assignments", ["Assignments"]],
    ["/dashboard/me/performance/reviews", ["Self-review", "Appeal"]],
    ["/dashboard/me/performance/achievements", ["Achievements"]],
    ["/dashboard/me/performance/improvement", ["Acknowledge"]],
    ["/dashboard/me/performance/team", ["Team performance"]],
    ["/dashboard/me/probation", ["confirmation", "Self-assessment"]],
  ]) {
    const result = await visit(empPage, check[0], check[1])
    report.employee.push(result)
    if (result.missing.length) report.failures.push(`Employee ${result.path}: missing ${result.missing.join(", ")}`)
  }
  const lastNav = report.employee.at(-1)?.nav || ""
  report.clicks.employeeHasMyPerformance = lastNav.includes("my performance")
  report.clicks.employeeHasMyProbation = lastNav.includes("my probation")
  report.clicks.employeeHidesHrPerformance = !lastNav.split("\n").some((line) => line.trim() === "performance")
  report.clicks.selfReview = await clickIfVisible(empPage, /Self-review/i)

  await empPage.goto(`${BASE_URL}/dashboard/performance/overview`, { waitUntil: "domcontentloaded" })
  await empPage.waitForTimeout(1500)
  report.clicks.employeeHrRedirect = !empPage.url().includes("/dashboard/performance/")
  await empContext.close()
  await browser.close()

  console.log(JSON.stringify(report, null, 2))
  if (report.failures.length) {
    throw new Error(report.failures.join(" | "))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
