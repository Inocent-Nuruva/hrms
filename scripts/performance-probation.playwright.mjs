import { chromium } from "playwright"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"

function encodeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.test`
}

const permissions = [
  "view_company_dashboard",
  "view_company_data",
  "performance:read",
  "performance:create",
  "probation:read",
  "probation:create",
]

const token = encodeJwt({
  sub: 2,
  email: "admin@alliance.co.tz",
  scope: "company",
  userType: "COMPANY_USER",
  companyId: 1,
  roles: ["COMPANY_ADMIN"],
  permissions,
})

const user = {
  email: "admin@alliance.co.tz",
  first_name: "Admin",
  last_name: "User",
  roles: ["COMPANY_ADMIN"],
  permissions,
}

function json(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const failures = []
  try {
    page.on("pageerror", (error) => {
      console.log("pageerror", error.message)
    })

    await page.route("**/*", async (route) => {
      const url = route.request().url()
      if (!url.includes("/api/")) {
        return route.continue()
      }
      if (url.includes("/api/performance/dashboard/summary")) {
        return json(route, { data: { average_score: 84, open_reviews: 6, completion_rate: 71 } })
      }
      if (url.includes("/api/performance/financial-years")) {
        return json(route, { data: [{ id: 12, code: "FY2026", name: "FY 2026", status: "OPEN" }] })
      }
      if (url.includes("/api/performance/periods")) {
        return json(route, {
          data: [{ id: 3, name: "Q2 2026", periodType: "QUARTERLY", status: "SELF_REVIEW" }],
        })
      }
      if (url.includes("/api/performance/kpis")) {
        return json(route, { data: [{ id: 8, code: "ATT-01", name: "Attendance", status: "ACTIVE" }] })
      }
      if (url.includes("/api/performance/plans")) {
        return json(route, {
          data: [{ id: 21, status: "ACTIVE", employee: { full_name: "Amina Juma" } }],
        })
      }
      if (url.includes("/api/performance/appeals")) {
        return json(route, { data: [{ id: 5, status: "OPEN", reason: "Score too low", employee: { full_name: "Amina Juma" } }] })
      }
      if (url.includes("/api/performance/improvement-plans")) {
        return json(route, { data: [{ id: 2, summary: "Raise close rate", status: "OPEN" }] })
      }
      if (url.includes("/api/performance/me/summary")) {
        return json(route, { data: { current_score: 78 } })
      }
      if (url.includes("/api/performance/me/assignments")) {
        return json(route, { data: [{ id: 41, status: "OPEN", totalWeight: "100" }] })
      }
      if (url.includes("/api/performance/me/reviews")) {
        return json(route, { data: [{ id: 9, status: "SELF_REVIEW_PENDING", finalScore: "78" }] })
      }
      if (url.includes("/api/performance/me/achievements")) {
        return json(route, { data: [{ id: 4, name: "Attendance", achievement_value: 96, status: "OPEN" }] })
      }
      if (url.includes("/api/performance/me/improvement-plans")) {
        return json(route, { data: [{ id: 2, summary: "Raise close rate", status: "OPEN" }] })
      }
      if (url.includes("/api/performance/manager/summary")) {
        return json(route, { data: { team_size: 6, pending_reviews: 2, average_score: 81 } })
      }
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
      if (url.includes("/api/probation/cases/18")) {
        return json(route, {
          data: {
            id: 18,
            caseNo: "PRB-18",
            status: "IN_REVIEW",
            currentDueDate: "2026-09-01",
            employee: { full_name: "Amina Juma" },
          },
        })
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
        return json(route, { data: [{ id: 120, full_name: "Amina Juma" }], meta: { page: 1, limit: 100, total: 1 } })
      }
      if (url.includes("/api/users/me")) {
        return json(route, { data: user })
      }
      if (url.includes("/api/performance/") || url.includes("/api/probation/")) {
        return json(route, { data: [] })
      }
      return json(route, { data: user })
    })

    await page.addInitScript(
      ({ accessToken, sessionUser, permissionLabels }) => {
        window.localStorage.setItem(
          "ess.auth.tokens",
          JSON.stringify({ accessToken, refreshToken: "refresh" }),
        )
        window.localStorage.setItem("ess.auth.user", JSON.stringify(sessionUser))
        window.localStorage.setItem("hrms.admin.accessToken", accessToken)
        window.sessionStorage.setItem("hrms.dashboard.actorPermissions", JSON.stringify(permissionLabels))
        window.sessionStorage.setItem("hrms.dashboard.accessMode", JSON.stringify("admin"))
        window.sessionStorage.setItem("hrms.dashboard.isAdmin", "true")
      },
      { accessToken: token, sessionUser: user, permissionLabels: permissions },
    )

    const checks = [
      {
        path: "/dashboard/performance/overview",
        expect: ["Company review cycle", "Average score"],
      },
      {
        path: "/dashboard/performance/setup",
        expect: ["Performance setup", "Years", "Rating scales"],
      },
      {
        path: "/dashboard/probation/overview",
        expect: ["Confirmation pipeline", "Open cases"],
      },
      {
        path: "/dashboard/probation/cases",
        expect: ["Probation cases"],
      },
      {
        path: "/dashboard/me/performance/overview",
        expect: ["Your scorecard", "Current score"],
      },
      {
        path: "/dashboard/me/probation",
        expect: ["probation"],
      },
    ]

    for (const check of checks) {
      await page.goto(`${BASE_URL}${check.path}`, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(1800)
      const body = await page.locator("body").innerText()
      const missing = check.expect.filter((needle) => !body.includes(needle))
      const file = `/tmp/${check.path.replaceAll("/", "-").replace(/^-/, "")}.png`
      await page.screenshot({ path: file, fullPage: true })
      console.log(JSON.stringify({ path: check.path, url: page.url(), missing, file }, null, 2))
      if (missing.length > 0) {
        failures.push(`${check.path} missing ${missing.join(", ")}`)
      }
    }
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    throw new Error(failures.join(" | "))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
