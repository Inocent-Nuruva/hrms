import { chromium } from "playwright"

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001"

function encodeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.test`
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const permissions = ["view_company_dashboard", "performance:read", "performance:create"]
  const token = encodeJwt({
    sub: 2,
    email: "hr@alliance.co.tz",
    roles: ["HR"],
    permissions,
  })

  await page.route("**/*", async (route) => {
    const url = route.request().url()
    if (!url.includes("/api/")) return route.continue()
    if (url.includes("/api/performance/kpis") && route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: 88,
              code: "ATT-01",
              name: "Attendance",
              status: "ACTIVE",
              currentVersionId: 14,
              versions: [
                {
                  id: 14,
                  versionNumber: 1,
                  description: "On-time rate",
                  measurementUnit: "%",
                  measurementDirection: "HIGHER_IS_BETTER",
                  scoringFormula: "PERCENT_TO_TARGET",
                  dataSourceType: "ATTENDANCE",
                },
              ],
            },
          ],
        }),
      })
    }
    if (url.includes("/api/performance/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    })
  })

  await page.addInitScript(
    ({ accessToken, permissionLabels }) => {
      window.localStorage.setItem(
        "ess.auth.tokens",
        JSON.stringify({ accessToken, refreshToken: "refresh" }),
      )
      window.localStorage.setItem(
        "ess.auth.user",
        JSON.stringify({ email: "hr@alliance.co.tz", roles: ["HR"], permissions: permissionLabels }),
      )
      window.localStorage.setItem("hrms.admin.accessToken", accessToken)
      window.sessionStorage.setItem("hrms.dashboard.actorPermissions", JSON.stringify(permissionLabels))
      window.sessionStorage.setItem("hrms.dashboard.accessMode", JSON.stringify("admin"))
    },
    { accessToken: token, permissionLabels: permissions },
  )

  await page.goto(`${BASE_URL}/dashboard/performance/setup`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  await page.getByRole("button", { name: "KPIs" }).click()
  await page.waitForTimeout(800)
  const body = await page.locator("body").innerText()
  const hasNewVersion = body.includes("New version")
  const hasAttendance = body.includes("Attendance") || body.includes("ATT-01")
  if (hasNewVersion) {
    await page.getByRole("button", { name: "New version" }).first().click()
    await page.waitForTimeout(400)
  }
  const dialogText = await page.locator("body").innerText()
  const hasDialog = dialogText.includes("New KPI version")
  await page.screenshot({ path: "/tmp/kpi-version.png", fullPage: true })
  await browser.close()
  console.log(JSON.stringify({ hasNewVersion, hasAttendance, hasDialog }, null, 2))
  if (!hasDialog && !hasNewVersion) {
    throw new Error("KPI version action did not appear on the setup screen.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
