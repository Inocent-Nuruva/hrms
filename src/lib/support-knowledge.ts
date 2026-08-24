export type SupportPage = {
  title: string
  url: string
  hint: string
  keywords: string[]
}

export const SUPPORT_PAGES: SupportPage[] = [
  { title: "My profile", url: "/dashboard/me/profile", hint: "Name, photo, and contact details", keywords: ["profile", "photo", "name", "contact", "me"] },
  { title: "My attendance", url: "/dashboard/attendance/today", hint: "Today’s state and punch history", keywords: ["attendance", "punch", "clock", "timesheet", "today"] },
  { title: "My leave", url: "/dashboard/me/leave/requests", hint: "Requests, balances, and holidays", keywords: ["leave", "holiday", "vacation", "balance", "time off"] },
  { title: "My payroll", url: "/dashboard/me/finance/payroll", hint: "Your payslips and payment details", keywords: ["payslip", "salary", "pay", "wage"] },
  { title: "My performance", url: "/dashboard/me/performance/overview", hint: "Reviews, scores, and plans", keywords: ["performance", "review", "kpi", "score"] },
  { title: "My probation", url: "/dashboard/me/probation", hint: "Your confirmation case", keywords: ["probation", "confirmation"] },
  { title: "My field", url: "/dashboard/me/field/visits", hint: "Visits, plans, and follow-ups", keywords: ["field", "visit", "customer"] },
  { title: "My finance", url: "/dashboard/me/finance/payroll", hint: "Payroll, loans, and advances", keywords: ["advance", "loan", "finance", "payroll"] },
  { title: "My activities", url: "/dashboard/me/activities/today", hint: "Daily activity reports", keywords: ["activity", "daily report"] },
  { title: "My movements", url: "/dashboard/me/movements", hint: "Transfers and role changes", keywords: ["movement", "transfer"] },
  { title: "My team", url: "/dashboard/me/team/overview", hint: "People who report to you", keywords: ["team", "reports"] },
  { title: "My requests", url: "/dashboard/me/requests/actions", hint: "Things waiting on you", keywords: ["request", "approval"] },
  { title: "Onboarding", url: "/dashboard/me/onboarding", hint: "Your joining checklist", keywords: ["onboarding", "joining", "new hire"] },
  { title: "Offboarding", url: "/dashboard/me/offboarding", hint: "Your exit checklist", keywords: ["offboarding", "exit", "resign"] },
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
  { title: "Payroll", url: "/dashboard/operations/payroll", hint: "Runs, inputs, profiles, and configuration", keywords: ["payroll", "payslip", "salary", "run"] },
  { title: "Reports", url: "/dashboard/operations/reports", hint: "Attendance downloads", keywords: ["report", "download", "export"] },
  { title: "Notifications", url: "/dashboard/operations/notifications", hint: "Company alerts", keywords: ["notification", "inbox"] },
  { title: "SMS", url: "/dashboard/sms/overview", hint: "Templates and message logs", keywords: ["sms", "text", "message"] },
  { title: "Insights", url: "/dashboard/insights/hr", hint: "HR and management dashboards", keywords: ["insight", "analytics", "dashboard"] },
]

const STOP_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "in", "on", "for", "is", "are",
  "how", "do", "i", "me", "my", "we", "you", "it", "this", "that", "where",
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

function scorePage(page: SupportPage, tokens: string[]) {
  const title = page.title.toLowerCase()
  const hint = page.hint.toLowerCase()
  const haystack = `${title} ${hint} ${page.keywords.join(" ")}`
  let score = 0
  for (const token of tokens) {
    if (title === token) score += 12
    else if (title.includes(token)) score += 8
    if (page.keywords.some((keyword) => keyword === token || keyword.includes(token) || token.includes(keyword))) {
      score += 6
    }
    if (haystack.includes(token)) score += 2
  }
  return score
}

export function findSupportPages(question: string, limit = 3) {
  const tokens = tokensFrom(question)
  if (tokens.length === 0) return []
  return SUPPORT_PAGES
    .map((page) => ({ page, score: scorePage(page, tokens) }))
    .filter((entry) => entry.score >= 6)
    .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title))
    .slice(0, limit)
    .map((entry) => entry.page)
}

export function formatSupportMatch(pages: SupportPage[], extra?: string): SupportMatch {
  if (pages.length === 0) {
    return {
      reply: extra ?? "I could not match that to a page. Try another word, or send this chat to IT support.",
      links: [],
    }
  }
  const lines = pages.map((page) => `${page.title}: ${page.hint} [${page.title}](${page.url})`)
  return {
    reply: [extra, ...lines].filter(Boolean).join("\n"),
    links: pages.map((page) => ({ title: page.title, url: page.url })),
  }
}

export function localSupportAnswer(question: string, previousQuestion = ""): SupportMatch {
  const combined = `${previousQuestion} ${question}`.trim()
  const query = question.toLowerCase().trim()

  if (/dark|theme|night|light mode/.test(query)) {
    return {
      reply: "Use the sun and moon button in the top bar to switch between light and dark.",
      links: [],
    }
  }

  const pages = findSupportPages(/^(point me|show me|that|there|it|yes)$/i.test(query) ? previousQuestion || question : combined)
  if (pages.length > 0) {
    return formatSupportMatch(pages, "Open one of these:")
  }

  return {
    reply: "I can take you to the page if you name it — payroll, SMS, branches, settings, leave, or attendance. Or send this chat to IT support.",
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

If several pages could match, list the best two or three with links.
If you cannot match, say so and suggest escalating to IT support.
`.trim()
