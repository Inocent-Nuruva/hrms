import fs from "node:fs"
import path from "node:path"
import type { Page } from "@playwright/test"

export type PageAudit = {
  role: string
  path: string
  finalUrl: string
  heading: string | null
  status: "ok" | "redirected-login" | "error" | "blank" | "empty"
  issues: string[]
  consoleErrors: string[]
  pageErrors: string[]
}

const NOISE = [
  /Download the React DevTools/i,
  /\[HMR\]/i,
  /Fast Refresh/i,
  /was preloaded using link preload/i,
  /Failed to load resource: the server responded with a status of 4/i,
]

function isNoisy(text: string) {
  return NOISE.some((pattern) => pattern.test(text))
}

export function attachPageListeners(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    if (!isNoisy(text)) consoleErrors.push(text.slice(0, 400))
  })
  page.on("pageerror", (error) => {
    pageErrors.push(String(error.message || error).slice(0, 400))
  })

  return { consoleErrors, pageErrors }
}

export async function auditRoute(
  page: Page,
  role: string,
  route: string,
  bags: { consoleErrors: string[]; pageErrors: string[] },
): Promise<PageAudit> {
  bags.consoleErrors.length = 0
  bags.pageErrors.length = 0

  const issues: string[] = []
  await page.goto(route, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1800)

  const finalUrl = page.url()
  if (/\/login(?:\?|$)/.test(finalUrl)) {
    return {
      role,
      path: route,
      finalUrl,
      heading: null,
      status: "redirected-login",
      issues: ["Redirected to login — session dropped or route is blocked."],
      consoleErrors: [...bags.consoleErrors],
      pageErrors: [...bags.pageErrors],
    }
  }

  const heading =
    (await page.locator("h1").first().textContent().catch(() => null))?.trim() ||
    (await page.locator('[class*="font-semibold"]').first().textContent().catch(() => null))?.trim() ||
    null

  const bodyText = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim()
  const lower = bodyText.toLowerCase()

  if (!bodyText || bodyText.length < 40) {
    issues.push("Page body looks blank or extremely thin.")
  }
  if (/next.js error|application error|this page could not|chunkloaderror/i.test(bodyText)) {
    issues.push("Framework crash / Next.js error overlay visible.")
  }
  if (/authentication required\. please log in again/i.test(bodyText)) {
    issues.push("Page shows authentication-required error while still on dashboard.")
  }
  if (/failed to load|could not load|could not create|the form options could not/i.test(lower)) {
    issues.push("Visible load/create failure copy.")
  }
  if (/no records found/i.test(bodyText) && bodyText.length < 800) {
    issues.push("Empty state only: “No records found.” with no next-action guidance.")
  }
  if (/something went wrong|unexpected error|internal server error/i.test(lower)) {
    issues.push("Generic error copy on screen.")
  }

  let status: PageAudit["status"] = "ok"
  if (issues.some((issue) => /crash|authentication-required|failure copy|generic error/i.test(issue))) {
    status = "error"
  } else if (issues.some((issue) => /blank/i.test(issue))) {
    status = "blank"
  } else if (issues.some((issue) => /empty state/i.test(issue))) {
    status = "empty"
  }

  if (bags.pageErrors.length > 0) {
    issues.push(`Unhandled page error: ${bags.pageErrors[0]}`)
    status = "error"
  }

  return {
    role,
    path: route,
    finalUrl,
    heading,
    status,
    issues,
    consoleErrors: [...new Set(bags.consoleErrors)].slice(0, 8),
    pageErrors: [...new Set(bags.pageErrors)].slice(0, 8),
  }
}

export async function collectNavLabels(page: Page) {
  const labels = await page.locator('[data-slot="sidebar-inner"] span, [data-sidebar="sidebar"] span').allTextContents()
  return [...new Set(labels.map((label) => label.trim()).filter((label) => label.length > 1 && label.length < 40))]
}

export async function writeAuditReport(audits: PageAudit[], extra: Record<string, unknown>) {
  const dir = path.join(process.cwd(), "outputs", "ui-audit")
  fs.mkdirSync(dir, { recursive: true })

  const summary = {
    generatedAt: new Date().toISOString(),
    totals: {
      pages: audits.length,
      ok: audits.filter((row) => row.status === "ok" && row.issues.length === 0).length,
      empty: audits.filter((row) => row.status === "empty").length,
      error: audits.filter((row) => row.status === "error" || row.status === "redirected-login").length,
      blank: audits.filter((row) => row.status === "blank").length,
      withIssues: audits.filter((row) => row.issues.length > 0).length,
    },
    extra,
    pages: audits,
  }

  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(summary, null, 2))

  const lines = [
    "# HRMS full-app UI audit",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    `- Pages checked: ${summary.totals.pages}`,
    `- Clean: ${summary.totals.ok}`,
    `- With issues: ${summary.totals.withIssues}`,
    `- Errors / login redirects: ${summary.totals.error}`,
    `- Empty: ${summary.totals.empty}`,
    `- Blank: ${summary.totals.blank}`,
    "",
    "## Pages with issues",
    "",
  ]

  const problemPages = audits.filter((row) => row.issues.length > 0 || row.consoleErrors.length > 0)
  if (problemPages.length === 0) {
    lines.push("None.")
  } else {
    for (const row of problemPages) {
      lines.push(`### ${row.role} — ${row.path}`)
      lines.push(`- Final URL: ${row.finalUrl}`)
      lines.push(`- Heading: ${row.heading ?? "—"}`)
      lines.push(`- Status: ${row.status}`)
      for (const issue of row.issues) lines.push(`- Issue: ${issue}`)
      for (const error of row.consoleErrors.slice(0, 3)) lines.push(`- Console: ${error}`)
      lines.push("")
    }
  }

  fs.writeFileSync(path.join(dir, "report.md"), lines.join("\n"))
  return summary
}
