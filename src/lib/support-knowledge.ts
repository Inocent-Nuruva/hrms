export type SupportPage = {
  title: string
  url: string
  hint: string
  keywords: string[]
  audience?: "self" | "company"
}

export const SUPPORT_PAGES: SupportPage[] = [
  { title: "My profile", url: "/dashboard/me/profile", hint: "Name, photo, and contact details", keywords: ["profile", "photo", "name", "contact", "me"], audience: "self" },
  { title: "My attendance", url: "/dashboard/attendance/today", hint: "Today’s punches and timesheet", keywords: ["attendance", "punch", "clock", "clock-in", "timesheet", "today"], audience: "self" },
  { title: "My leave", url: "/dashboard/me/leave/requests", hint: "Request leave and see balances", keywords: ["leave", "holiday", "vacation", "balance", "time off", "off"], audience: "self" },
  { title: "My payroll", url: "/dashboard/me/finance/payroll", hint: "Your own payslips and salary details", keywords: ["payslip", "payslips", "salary", "wage", "my payroll"], audience: "self" },
  { title: "My performance", url: "/dashboard/me/performance/overview", hint: "Reviews, scores, and plans", keywords: ["performance", "review", "kpi", "score"], audience: "self" },
  { title: "My probation", url: "/dashboard/me/probation", hint: "Your confirmation case", keywords: ["probation", "confirmation"], audience: "self" },
  { title: "My field", url: "/dashboard/me/field/visits", hint: "Visits, plans, and follow-ups", keywords: ["field", "visit", "customer"], audience: "self" },
  { title: "My finance", url: "/dashboard/me/finance/payroll", hint: "Your loans, advances, and payslips", keywords: ["advance", "loan", "finance"], audience: "self" },
  { title: "My activities", url: "/dashboard/me/activities/today", hint: "Daily activity reports", keywords: ["activity", "daily report"], audience: "self" },
  { title: "My movements", url: "/dashboard/me/movements", hint: "Transfers and role changes", keywords: ["movement", "transfer"], audience: "self" },
  { title: "My team", url: "/dashboard/me/team/overview", hint: "People who report to you", keywords: ["team", "direct reports"], audience: "self" },
  { title: "My requests", url: "/dashboard/me/requests/actions", hint: "Approvals waiting on you", keywords: ["request", "approval", "pending"], audience: "self" },
  { title: "Onboarding", url: "/dashboard/me/onboarding", hint: "Your joining checklist", keywords: ["onboarding", "joining", "new hire"], audience: "self" },
  { title: "My contracts", url: "/dashboard/me/contracts", hint: "View and sign your employment contracts", keywords: ["contract", "sign", "employment"], audience: "self" },
  { title: "Offboarding", url: "/dashboard/me/offboarding", hint: "Your exit checklist", keywords: ["offboarding", "exit", "resign"], audience: "self" },
  { title: "Settings", url: "/dashboard/settings", hint: "Password, two-factor, devices, and notification preferences", keywords: ["settings", "password", "2fa", "two-factor", "mfa", "device", "notification", "alert"] },
  { title: "Help", url: "/dashboard/help", hint: "Shortcuts and pages you can open", keywords: ["help", "shortcut"] },
  { title: "Branches", url: "/dashboard/branches", hint: "Company branch locations", keywords: ["branch", "branches", "location", "office"] },
  { title: "Departments", url: "/dashboard/departments", hint: "Company departments", keywords: ["department", "departments"] },
  { title: "Companies", url: "/dashboard/companies", hint: "Company records", keywords: ["company", "companies"] },
  { title: "Positions", url: "/dashboard/positions", hint: "Job titles and positions", keywords: ["position", "job", "title"] },
  { title: "Employees", url: "/dashboard/employees/all", hint: "Directory and employee records", keywords: ["employee", "staff", "directory"] },
  { title: "Access control", url: "/dashboard/access-control", hint: "Roles, devices, and doors", keywords: ["access", "role", "door", "device"] },
  { title: "Attendance", url: "/dashboard/attendance", hint: "Summaries, shifts, and attendance setup", keywords: ["attendance", "shift", "summary"] },
  { title: "Leave management", url: "/dashboard/leave-management", hint: "Types, requests, and balances", keywords: ["leave", "approval"] },
  { title: "Performance", url: "/dashboard/performance/overview", hint: "Company review cycle", keywords: ["performance", "review"] },
  { title: "Probation", url: "/dashboard/probation/overview", hint: "Confirmation cases and policies", keywords: ["probation", "confirmation"] },
  { title: "Field", url: "/dashboard/field/overview", hint: "Visits, map, and parties", keywords: ["field", "visit", "map"] },
  { title: "Finance", url: "/dashboard/finance/overview", hint: "Products, applications, and accounts", keywords: ["finance", "loan", "advance"] },
  { title: "Activities", url: "/dashboard/activities/overview", hint: "Team reports and reviews", keywords: ["activity", "report"] },
  { title: "Movements", url: "/dashboard/movements/overview", hint: "Transfers and promotions", keywords: ["movement", "transfer", "promotion"] },
  { title: "Cost centers", url: "/dashboard/structure/cost-centers", hint: "Where spend is assigned", keywords: ["cost", "center", "structure"] },
  { title: "Grades", url: "/dashboard/structure/grades", hint: "Pay grades and ranks", keywords: ["grade", "structure"] },
  { title: "Employee numbering", url: "/dashboard/structure/numbering", hint: "Prefix and next employee number", keywords: ["numbering", "prefix", "employee number"] },
  { title: "Invite and register", url: "/dashboard/operations/recruitment", hint: "Invites and new hires", keywords: ["invite", "register", "recruit", "hire"] },
  { title: "Payroll setup & operations", url: "/dashboard/operations/payroll", hint: "Company payroll runs, inputs, and configuration (HR/finance)", keywords: ["payroll", "setup", "run", "salary processing"], audience: "company" },
  { title: "Reports", url: "/dashboard/operations/reports", hint: "Attendance downloads", keywords: ["report", "download", "export"], audience: "company" },
  { title: "Notifications", url: "/dashboard/operations/notifications", hint: "Company alerts", keywords: ["notification", "inbox"], audience: "company" },
  { title: "SMS", url: "/dashboard/sms/overview", hint: "Send texts, templates, and message logs", keywords: ["sms", "text", "message", "test sms"], audience: "company" },
  { title: "Insights", url: "/dashboard/insights/hr", hint: "HR and management dashboards", keywords: ["insight", "analytics", "dashboard"], audience: "company" },
  { title: "Are we ready?", url: "/dashboard/insights/readiness", hint: "Clock-in setup, system health, and blocked actions", keywords: ["ready", "readiness", "clock-in", "clock in", "setup", "health"], audience: "company" },
]

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "in", "on", "for", "is", "are",
  "how", "do", "i", "we", "you", "it", "this", "that", "where",
  "find", "open", "page", "pages", "route", "routes", "link", "links", "go",
  "point", "please", "can", "what", "which",
])

export type SupportMatch = {
  reply: string
  links: Array<{ title: string; url: string }>
}

function tokensFrom(question: string) {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function scorePage(
  page: SupportPage,
  tokens: string[],
  query: string,
  accessMode?: "admin" | "employee",
) {
  const title = page.title.toLowerCase()
  const hint = page.hint.toLowerCase()
  const haystack = `${title} ${hint} ${page.keywords.join(" ")}`
  let score = 0
  for (const token of tokens) {
    if (title === token) score += 14
    else if (title.includes(token)) score += 8
    if (page.keywords.some((keyword) => keyword === token || keyword === query)) {
      score += 8
    } else if (
      page.keywords.some(
        (keyword) => keyword.includes(token) || (token.length > 3 && token.includes(keyword)),
      )
    ) {
      score += 4
    }
    if (haystack.includes(token)) score += 1
  }
  if (query.includes("my ") && page.audience === "self") score += 10
  if (query.includes("my ") && page.audience === "company") score -= 6
  if (accessMode === "employee" && page.audience === "self") score += 5
  if (accessMode === "employee" && page.audience === "company") score -= 4
  if (accessMode === "admin" && !query.includes("my ") && page.audience === "company") score += 3
  return score
}

export function findSupportPages(
  question: string,
  limit = 3,
  accessMode?: "admin" | "employee",
) {
  const tokens = tokensFrom(question)
  if (tokens.length === 0) return []
  const query = question.toLowerCase().trim()
  return SUPPORT_PAGES
    .map((page) => ({ page, score: scorePage(page, tokens, query, accessMode) }))
    .filter((entry) => entry.score >= 8)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
    .slice(0, limit)
    .map((entry) => entry.page)
}

export function formatSupportMatch(pages: SupportPage[], extra?: string): SupportMatch {
  if (pages.length === 0) {
    return {
      reply:
        extra ??
        "I could not match that to a page. Try naming the area (leave, payroll, attendance, SMS). If you are stuck, tap Escalate to IT support.",
      links: [],
    }
  }
  const intro =
    extra ??
    (pages.length === 1
      ? `Open ${pages[0].title} — ${pages[0].hint}`
      : "These are different pages. Pick the one that matches what you need:")
  const lines =
    pages.length === 1
      ? [`[${pages[0].title}](${pages[0].url})`]
      : pages.map((page) => `- ${page.title}: ${page.hint} [${page.title}](${page.url})`)
  return {
    reply: [intro, ...lines].filter(Boolean).join("\n"),
    links: pages.map((page) => ({ title: page.title, url: page.url })),
  }
}

export function localSupportAnswer(
  question: string,
  previousQuestion = "",
  accessMode?: "admin" | "employee",
): SupportMatch {
  const query = question.toLowerCase().trim()

  if (/^(hi|hello|hey|howdy|good morning|good afternoon|good evening|help|yo)\b/.test(query)) {
    return {
      reply:
        "Hi. Ask me where to go in HRMS — leave, payroll, attendance, SMS, clock-in — and I will point you there. If I cannot help, tap Escalate to IT support.",
      links: [],
    }
  }

  if (/dark|theme|night|light mode/.test(query)) {
    return {
      reply: "Use the sun and moon button in the top bar to switch between light and dark.",
      links: [],
    }
  }

  if (/escalat|it support|ticket|human|filbert|innocent|inocent/.test(query)) {
    return {
      reply:
        "Tap Escalate to IT support below. That emails Filbert and Innocent with this chat so they can follow up.",
      links: [],
    }
  }

  if (/clock[\s-]?in|punch|biometric|attendance policy|work schedule|someone.?s schedule/.test(query)) {
    return formatSupportMatch(
      [
        SUPPORT_PAGES.find((page) => page.url === "/dashboard/insights/readiness")!,
        SUPPORT_PAGES.find((page) => page.url === "/dashboard/attendance/today")!,
      ].filter(Boolean),
      "Clock-in is two different things:\n- HR sets the company rules on Are we ready? (tap Set up clock-in).\n- You punch in on My attendance.",
    )
  }

  const followUp = /^(point me|show me|that|there|it|yes|the first one|ok|okay)$/i.test(query)
  const combined = followUp ? previousQuestion || question : question
  const pages = findSupportPages(combined, 3, accessMode)
  if (pages.length > 0) {
    if (pages.length === 1) {
      return formatSupportMatch(pages)
    }
    const payrollMix = pages.some((page) => page.title === "Payroll") && pages.some((page) => page.title === "My payroll")
    return formatSupportMatch(
      pages,
      payrollMix
        ? "These are different pages. Payroll is for HR/finance processing company runs. My payroll is your own payslip. Pick the one you need:"
        : "These are different pages. Pick the one that matches what you need:",
    )
  }

  return {
    reply:
      "I can take you there if you name the area — leave, payroll, attendance, SMS, clock-in, or settings. Or tap Escalate to IT support.",
    links: [],
  }
}

export const SUPPORT_KNOWLEDGE = `
You are the HRMS in-app assistant. Help people find pages and complete everyday tasks.
Never mention APIs, endpoints, tokens, JSON, backend routes, or internal IDs.
When you name a page, always include a markdown link using the exact path from this list.

${SUPPORT_PAGES.map((page) => `- [${page.title}](${page.url}) — ${page.hint}. Keywords: ${page.keywords.join(", ")}`).join("\n")}

Theme: the sun and moon button in the top bar switches light and dark. There is no separate theme page.

Notification preferences are on Settings. Each row has its own switches.

If several pages could match, list the best two or three with links and explain the difference in one sentence.
If the person says hello, greet them and ask what they need. Do not dump a page list.
Clock-in setup lives on Insights → Are we ready? behind the Set up clock-in button. Personal punches live on My attendance.
Help and IT support is under development.
If you cannot match, say so and tell them to tap Escalate to IT support.
`.trim()
