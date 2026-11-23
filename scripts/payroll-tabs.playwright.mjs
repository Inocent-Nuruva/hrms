import { chromium } from "playwright"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"
const PAYROLL_URL = `${BASE_URL}/dashboard/operations/payroll`

function encodeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.test`
}

const token = encodeJwt({
  sub: 2,
  email: "admin@alliance.co.tz",
  scope: "company",
  userType: "COMPANY_USER",
  companyId: 1,
  roles: ["COMPANY_ADMIN"],
  permissions: ["company_dashboard:read", "company_data:read"],
})

const user = {
  email: "admin@alliance.co.tz",
  first_name: "Admin",
  last_name: "User",
  roles: ["COMPANY_ADMIN"],
  permissions: ["company_dashboard:read", "company_data:read"],
}

function json(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  })
}

function emptyPage() {
  return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await run(page)
  } finally {
    await browser.close()
  }
}

async function run(page) {
  const hits = {
    runs: 0,
    inputs: 0,
    profiles: 0,
    periods: 0,
    components: 0,
    dashboard: 0,
  }

  page.on("console", (msg) => {
    console.log("console", msg.type(), msg.text())
  })
  page.on("pageerror", (error) => {
    console.log("pageerror", error.message)
  })
  page.on("request", (request) => {
    const url = request.url()
    if (url.includes("/api/")) {
      console.log("request", request.method(), url)
    }
  })

  await page.route("**/*", async (route) => {
    const url = route.request().url()
    if (!url.includes("/api/")) {
      return route.continue()
    }
    console.log("mock", route.request().method(), url)
    if (url.includes("/api/payroll/runs") && !url.includes("/process") && !url.includes("/approve")) {
      hits.runs += 1
      return json(route, {
        data: [{ id: 41, run_no: "PR-41", run_type: "REGULAR", status: "PENDING" }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
    }
    if (url.includes("/api/payroll/inputs")) {
      hits.inputs += 1
      return json(route, {
        data: [{ id: 9, employee_id: 1, component_code: "BASIC", amount: "100", status: "DRAFT" }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
    }
    if (url.includes("/api/payroll/employees/profiles")) {
      hits.profiles += 1
      return json(route, {
        data: [{ id: 3, employee_id: 1, payroll_number: "PN-1", payroll_enabled: true }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })
    }
    if (url.includes("/api/payroll/configuration/periods")) {
      hits.periods += 1
      return json(route, { data: [{ id: 8, name: "August 2026", month: 8, year: 2026 }] })
    }
    if (url.includes("/api/payroll/configuration/components")) {
      hits.components += 1
      return json(route, { data: [{ id: 2, code: "BASIC", name: "Basic Pay" }] })
    }
    if (url.includes("/api/payroll/reports/dashboard")) {
      hits.dashboard += 1
      return json(route, { data: { active_runs: 1, pending_inputs: 1 } })
    }
    if (url.includes("/api/users/me")) {
      return json(route, { data: user })
    }
    if (
      url.includes("/api/payroll/configuration/") ||
      url.includes("/api/payroll/")
    ) {
      return json(route, emptyPage())
    }
    return json(route, { data: user })
  })

  await page.addInitScript(
    ({ accessToken, sessionUser }) => {
      window.localStorage.setItem(
        "ess.auth.tokens",
        JSON.stringify({ accessToken, refreshToken: "refresh" }),
      )
      window.localStorage.setItem("ess.auth.user", JSON.stringify(sessionUser))
      window.localStorage.setItem("hrms.admin.accessToken", accessToken)
    },
    { accessToken: token, sessionUser: user },
  )

  await page.goto(PAYROLL_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  console.log("url", page.url())
  console.log("title", await page.title())
  const visibleText = (await page.locator("body").innerText()).slice(0, 1500)
  console.log("body", visibleText)

  const heading = page.getByRole("heading", { name: /Payroll/i }).first()
  if ((await heading.count()) === 0) {
    await page.screenshot({ path: "/tmp/payroll-tabs.png", fullPage: true })
    throw new Error("Payroll heading not found. See /tmp/payroll-tabs.png")
  }
  await heading.waitFor({ timeout: 15000 })

  console.log(
    "buttons",
    await page.getByRole("button").allTextContents(),
  )

  const tabResults = []
  for (const tab of ["Runs", "Inputs", "Profiles", "Periods", "Configuration"]) {
    const tabButton = page.locator("button", { hasText: tab }).last()
    await tabButton.click({ force: true })
    await page.waitForTimeout(2000)
    const shimmerCount = await page.locator(".animate-pulse").count()
    const bodyText = await page.locator("body").innerText()
    console.log("tab-text", tab, bodyText.slice(0, 400))
    tabResults.push({
      tab,
      shimmerCount,
      hasRowText:
        bodyText.includes("PR-41") ||
        bodyText.includes("BASIC") ||
        bodyText.includes("PN-1") ||
        bodyText.includes("August 2026") ||
        bodyText.includes("Basic Pay") ||
        bodyText.includes("No data") ||
        bodyText.includes("0 of") ||
        shimmerCount === 0,
    })
  }

  await page.waitForTimeout(2000)

  const summary = {
    hits,
    tabResults,
    loopDetected: hits.runs > 8 || hits.inputs > 8 || hits.profiles > 8 || hits.components > 8,
  }
  console.log(JSON.stringify(summary, null, 2))

  if (summary.loopDetected) {
    throw new Error("Payroll tabs are still refetching in a loop.")
  }
  if (tabResults.some((entry) => entry.shimmerCount > 0 && !entry.hasRowText)) {
    throw new Error("A payroll tab stayed on the loading shimmer.")
  }

}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
