export function mergeUniqueNavItems<T extends { url?: string; title: string }>(
  ...groups: T[][]
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const group of groups) {
    for (const item of group) {
      const key = item.url || item.title
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

function normalizeDashboardPath(url: string) {
  const path = url.split("?")[0] ?? url
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path
}

const PERSONAL_ATTENDANCE_ROUTES = new Set([
  "/dashboard/attendance/today",
  "/dashboard/attendance/punch-action",
  "/dashboard/attendance/attendance-history",
  "/dashboard/attendance/schedule-preview",
  "/dashboard/attendance/corrections",
])

export function isSelfServiceDashboardRoute(url: string) {
  const path = normalizeDashboardPath(url)
  if (path === "/dashboard/me" || path.startsWith("/dashboard/me/")) {
    return true
  }
  return PERSONAL_ATTENDANCE_ROUTES.has(path)
}

export function canShowDashboardRouteInNavigation(
  url: string,
  accessMode?: "admin" | "employee",
) {
  if (!isSelfServiceDashboardRoute(url)) {
    return true
  }
  return accessMode !== "admin"
}

export function selfServiceHomeFor(url: string): string | null {
  const path = normalizeDashboardPath(url)
  if (path.startsWith("/dashboard/me/performance") || path.startsWith("/dashboard/performance")) {
    return "/dashboard/me/performance/overview"
  }
  if (path.startsWith("/dashboard/me/probation") || path.startsWith("/dashboard/probation")) {
    return "/dashboard/me/probation"
  }
  if (path.startsWith("/dashboard/me/field") || path.startsWith("/dashboard/field")) {
    return "/dashboard/me/field/visits"
  }
  if (path.startsWith("/dashboard/me/finance") || path.startsWith("/dashboard/finance")) {
    return "/dashboard/me/finance"
  }
  if (path.startsWith("/dashboard/me/activities") || path.startsWith("/dashboard/activities")) {
    return "/dashboard/me/activities/today"
  }
  if (path.startsWith("/dashboard/me/movements") || path.startsWith("/dashboard/movements")) {
    return "/dashboard/me/movements"
  }
  if (path.startsWith("/dashboard/me/insights") || path.startsWith("/dashboard/insights")) {
    return "/dashboard/me/insights"
  }
  if (path.startsWith("/dashboard/me/leave") || path.startsWith("/dashboard/leave-management")) {
    return "/dashboard/me/leave/requests"
  }
  if (path.startsWith("/dashboard/me/payroll") || path.startsWith("/dashboard/operations/payroll")) {
    return "/dashboard/me/payroll"
  }
  if (path.startsWith("/dashboard/me/requests")) {
    return "/dashboard/me/requests/actions"
  }
  if (path.startsWith("/dashboard/me/onboarding") || path.startsWith("/dashboard/employees/onboarding")) {
    return "/dashboard/me/onboarding"
  }
  if (path.startsWith("/dashboard/me/offboarding") || path.startsWith("/dashboard/employees/offboarding")) {
    return "/dashboard/me/offboarding"
  }
  if (path.startsWith("/dashboard/me/team")) {
    return "/dashboard/me/profile"
  }
  if (PERSONAL_ATTENDANCE_ROUTES.has(path) || path.startsWith("/dashboard/attendance")) {
    return "/dashboard/attendance/today"
  }
  if (path === "/dashboard/me" || path.startsWith("/dashboard/me/")) {
    return "/dashboard/me/profile"
  }
  return null
}
