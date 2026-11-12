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

const KPI_READ_ROLES = new Set([
  "COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "MANAGEMENT",
])
const KPI_WRITE_ROLES = new Set([
  "COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER",
])
const KPI_ADMIN_ROLES = new Set(["COMPANY_ADMIN", "HR_MANAGER"])
const KPI_PERSONAL_ROLES = new Set([
  "EMPLOYEE", "COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER",
])

/** Navigation only. KPI API guards and record scope remain authoritative. */
export function canShowKpiNavigationRoute(
  url: string,
  roleNames: string[],
  scope: "platform" | "company" | null | undefined,
  permissionLabels: string[] = [],
) {
  const path = normalizeDashboardPath(url)
  if (!path.startsWith("/dashboard/kpi") && !path.startsWith("/dashboard/me/kpi") &&
      !path.startsWith("/dashboard/me/scorecards") && !path.startsWith("/dashboard/me/evaluations")) {
    return true
  }
  if (scope !== "company") return false
  const roles = new Set(roleNames.map((role) => role.trim().toUpperCase()))
  const hasAny = (allowed: Set<string>) => [...roles].some((role) => allowed.has(role))
  const canReadAssignments = permissionLabels.includes("kpi_assignments:read")
  const canManageAssignments = permissionLabels.includes("kpi_assignments:create") || permissionLabels.includes("kpi_assignments:update") || permissionLabels.includes("kpi_targets:revise")
  if (path === "/dashboard/me/kpi/reports") return roles.has("EMPLOYEE")
  if (path.startsWith("/dashboard/me/")) return hasAny(KPI_PERSONAL_ROLES)
  if (path === "/dashboard/kpi/create" ||
      path === "/dashboard/kpi/periods" ||
      path === "/dashboard/kpi/templates" ||
      path.startsWith("/dashboard/kpi/evaluation-cycles") ||
      path.startsWith("/dashboard/kpi/evaluation-templates") ||
      path.startsWith("/dashboard/kpi/scoring-policies") ||
      path.startsWith("/dashboard/kpi/scorecard-templates")) return hasAny(KPI_ADMIN_ROLES)
  if (path.startsWith("/dashboard/kpi/assignments") || path.startsWith("/dashboard/kpi/targets")) return hasAny(KPI_WRITE_ROLES) || canReadAssignments || canManageAssignments
  if (path.startsWith("/dashboard/kpi/reviews") ||
      path.startsWith("/dashboard/kpi/evaluations") ||
      path.startsWith("/dashboard/kpi/scorecards/new") ||
      /\/dashboard\/kpi\/scorecards\/[^/]+\/edit(?:\/|$)/.test(path)) return hasAny(KPI_WRITE_ROLES)
  return hasAny(KPI_READ_ROLES) || (path === "/dashboard/kpi" && canReadAssignments)
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
  if (path.startsWith("/dashboard/me/probation") || path.startsWith("/dashboard/probation")) {
    return "/dashboard/me/probation"
  }
  if (path.startsWith("/dashboard/me/field") || path.startsWith("/dashboard/field")) {
    return "/dashboard/me/field/visits"
  }
  if (path.startsWith("/dashboard/me/finance") || path.startsWith("/dashboard/finance")) {
    return "/dashboard/me/finance/payroll"
  }
  if (path.startsWith("/dashboard/me/activities") || path.startsWith("/dashboard/activities")) {
    return "/dashboard/me/activities/today"
  }
  if (path.startsWith("/dashboard/me/movements") || path.startsWith("/dashboard/movements")) {
    return "/dashboard/me/movements"
  }
  if (path.startsWith("/dashboard/me/insights")) {
    return "/dashboard"
  }
  if (path.startsWith("/dashboard/me/leave") || path.startsWith("/dashboard/leave-management")) {
    return "/dashboard/me/leave/requests"
  }
  if (path.startsWith("/dashboard/me/payroll") || path.startsWith("/dashboard/operations/payroll")) {
    return "/dashboard/me/finance/payroll"
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
