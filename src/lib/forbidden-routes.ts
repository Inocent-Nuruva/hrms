import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import type { DashboardAccessMode } from "@/lib/dashboard-permissions"
import {
  canSeeHrLeaveRequestsQueue,
  isCompanyLeaveRequestsPath,
  showsPersonalRoutesAlongsideWorkRoutes,
  type HomeDashboardKind,
} from "@/lib/dashboard-home"
import {
  isDashboardRouteEnabledForCompanyModules,
  readPublishedCompanyModules,
} from "@/lib/company-modules"
import {
  canShowDashboardRouteInNavigation,
  isSelfServiceDashboardRoute,
  selfServiceHomeFor,
} from "@/lib/dashboard-nav"
import { allDashboardSectionTabGroups } from "@/lib/dashboard-sections"

export const FORBIDDEN_ROUTES_EVENT = "hrms:forbidden-routes-changed"
// Version the learned-denial cache whenever route permission semantics change.
// Otherwise a route denied under an older frontend policy stays hidden even
// after a newly supported backend permission has been granted.
const STORAGE_KEY = "hrms.forbiddenRoutes.v2"
const CONFIRMED_STORAGE_KEY = "hrms.confirmedPlatformRoutes"

// Attendance download still works without analytics grants. A 403 from
// /api/analytics/* must not hide the whole Reports page or bounce to /dashboard.
// Company SMS pages are the same: a 403 from /api/sms/* must not hide the
// section root or bounce Overview / Registry / Logs back to /dashboard.
const DO_NOT_REMEMBER = new Set([
  "/dashboard/operations/reports",
  "/dashboard/sms",
  "/dashboard/sms/overview",
  "/dashboard/sms/registry",
  "/dashboard/sms/logs",
])

function shouldRememberForbiddenRoute(url: string) {
  const path = normalizePath(url)
  const prefix = tabPrefix(url)
  if (DO_NOT_REMEMBER.has(path) || DO_NOT_REMEMBER.has(prefix)) {
    return false
  }
  return !isSelfServiceDashboardRoute(url)
}

/**
 * JWT `companies:read` is also issued to company-scoped System Administrators.
 * GET /api/companies is platform-scope only and returns
 * "Platform access is required" for those users. Hide the nav item until the
 * list call actually succeeds.
 */
const PLATFORM_SCOPED_ROUTES = new Set([
  "/dashboard/companies",
  "/dashboard/sms/platform",
])

function normalizePath(url: string) {
  const path = url.split("?")[0] ?? url
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path
}

function tabPrefix(url: string) {
  const path = normalizePath(url)
  const parts = path.split("/").filter(Boolean)
  if (parts[0] !== "dashboard") return path
  if (parts[1] === "me") {
    if (parts[2] && parts[3]) return `/dashboard/me/${parts[2]}/${parts[3]}`
    if (parts[2]) return `/dashboard/me/${parts[2]}`
    return path
  }
  if (parts[1] && parts[2]) {
    return `/dashboard/${parts[1]}/${parts[2]}`
  }
  if (parts[1]) return `/dashboard/${parts[1]}`
  return path
}

function readPrefixes(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is string =>
            typeof entry === "string" &&
            entry.startsWith("/dashboard") &&
            !DO_NOT_REMEMBER.has(entry),
        )
      : []
  } catch {
    return []
  }
}

function notifyRouteAccessChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(FORBIDDEN_ROUTES_EVENT))
}

function writePrefixes(prefixes: string[]) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefixes))
  notifyRouteAccessChanged()
}

function readConfirmedPrefixes(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(CONFIRMED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is string =>
            typeof entry === "string" && PLATFORM_SCOPED_ROUTES.has(entry),
        )
      : []
  } catch {
    return []
  }
}

function writeConfirmedPrefixes(prefixes: string[]) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(CONFIRMED_STORAGE_KEY, JSON.stringify(prefixes))
  notifyRouteAccessChanged()
}

export function isPlatformScopedDashboardRoute(url: string) {
  return PLATFORM_SCOPED_ROUTES.has(tabPrefix(url))
}

export function isConfirmedPlatformRoute(url: string) {
  const prefix = tabPrefix(url)
  const confirmed = readConfirmedPrefixes()
  if (confirmed.includes(prefix)) return true
  // Company SMS platform uses the same platform gate as Companies.
  if (prefix === "/dashboard/sms/platform") {
    return confirmed.includes("/dashboard/companies")
  }
  return false
}

export function confirmPlatformRoute(url: string) {
  const prefix = tabPrefix(url)
  if (!PLATFORM_SCOPED_ROUTES.has(prefix)) return
  const forbidden = readPrefixes().filter((entry) => entry !== prefix)
  if (forbidden.length !== readPrefixes().length) {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(forbidden))
  }
  const confirmed = readConfirmedPrefixes()
  if (confirmed.includes(prefix)) {
    notifyRouteAccessChanged()
    return
  }
  writeConfirmedPrefixes([...confirmed, prefix])
}

export function rememberForbiddenRoute(url: string) {
  const prefix = tabPrefix(url)
  if (!shouldRememberForbiddenRoute(url)) return
  const confirmed = readConfirmedPrefixes().filter((entry) => entry !== prefix)
  if (confirmed.length !== readConfirmedPrefixes().length) {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(CONFIRMED_STORAGE_KEY, JSON.stringify(confirmed))
    }
  }
  const current = readPrefixes()
  if (current.includes(prefix)) {
    notifyRouteAccessChanged()
    return
  }
  writePrefixes([...current, prefix])
}

export function forgetForbiddenRoute(url: string) {
  const prefix = tabPrefix(url)
  const current = readPrefixes()
  const next = current.filter((entry) => entry !== prefix)
  if (next.length === current.length) return
  writePrefixes(next)
}

export function clearDashboardRouteMemory() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.sessionStorage.removeItem(CONFIRMED_STORAGE_KEY)
  notifyRouteAccessChanged()
}

export function isRememberedForbiddenRoute(url: string) {
  const path = normalizePath(url)
  const currentPrefix = tabPrefix(url)
  if (!shouldRememberForbiddenRoute(url)) {
    return false
  }
  if (DO_NOT_REMEMBER.has(path) || DO_NOT_REMEMBER.has(currentPrefix)) {
    return false
  }
  return readPrefixes().some((prefix) => {
    if (path === prefix) return true
    // Hide detail pages under a remembered tab, not sibling tabs in the same section.
    const depth = prefix.split("/").filter(Boolean).length
    if (depth < 3) return false
    return path.startsWith(`${prefix}/`)
  })
}

function isPathInSectionGroup(path: string, itemUrl: string) {
  if (path === itemUrl || path.startsWith(`${itemUrl}/`)) return true
  // Section roots like /dashboard/sms are not tab urls. Still treat them as
  // part of the group so a missing grant on the parent opens the first child
  // instead of bouncing to /dashboard.
  return path !== "/dashboard" && itemUrl.startsWith(`${path}/`)
}

export function firstVisibleSiblingOrHome(
  url: string,
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  const path = normalizePath(url)
  for (const group of allDashboardSectionTabGroups()) {
    const inGroup = group.items.some((item) => isPathInSectionGroup(path, item.url))
    if (!inGroup) continue
    const visible = group.items.find((item) =>
      canSeeDashboardPage(item.url, permissionLabels, accessMode),
    )
    if (visible) return visible.url
  }
  if (accessMode === "employee") {
    return selfServiceHomeFor(path) ?? "/dashboard"
  }
  return "/dashboard"
}

const STRUCTURE_CHILD_ROUTES = [
  "/dashboard/structure/cost-centers",
  "/dashboard/structure/grades",
  "/dashboard/structure/numbering",
]

const SMS_CHILD_ROUTES = [
  "/dashboard/sms/overview",
  "/dashboard/sms/registry",
  "/dashboard/sms/logs",
  "/dashboard/sms/platform",
]

function canSeeStructureSection(
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  return STRUCTURE_CHILD_ROUTES.some(
    (child) =>
      !isRememberedForbiddenRoute(child) &&
      canAccessDashboardRoute(child, permissionLabels, accessMode),
  )
}

export function hideStructureNavIfEmpty(
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  if (canSeeStructureSection(permissionLabels, accessMode)) return
  rememberForbiddenRoute("/dashboard/structure")
}

function canSeeSmsSection(
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  return SMS_CHILD_ROUTES.some(
    (child) =>
      !isRememberedForbiddenRoute(child) &&
      canAccessDashboardRoute(child, permissionLabels, accessMode),
  )
}

export function hideSmsNavIfEmpty(
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  if (canSeeSmsSection(permissionLabels, accessMode)) return
  rememberForbiddenRoute("/dashboard/sms")
}

export function canSeeDashboardPage(
  url: string,
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
  options?: {
    roleNames?: string[]
    scope?: "platform" | "company" | null
    homeDashboardKind?: HomeDashboardKind | null
  },
) {
  const managerCanSeeSelfService =
    isSelfServiceDashboardRoute(url) &&
    showsPersonalRoutesAlongsideWorkRoutes(
      options?.homeDashboardKind,
      permissionLabels,
    )
  if (
    !canShowDashboardRouteInNavigation(url, accessMode) &&
    !managerCanSeeSelfService
  ) {
    return false
  }
  if (!isDashboardRouteEnabledForCompanyModules(url, readPublishedCompanyModules())) {
    return false
  }
  if (isRememberedForbiddenRoute(url)) {
    return false
  }
  // Fail-closed: company-scoped admins have companies:read but cannot list
  // the platform tenant registry. Do not paint Companies until confirmed.
  if (isPlatformScopedDashboardRoute(url) && !isConfirmedPlatformRoute(url)) {
    return false
  }
  const path = url.split("?")[0] ?? url
  if (path === "/dashboard/structure") {
    return canSeeStructureSection(permissionLabels, accessMode)
  }
  if (path === "/dashboard/sms") {
    return canSeeSmsSection(permissionLabels, accessMode)
  }
  if (isCompanyLeaveRequestsPath(url)) {
    return canSeeHrLeaveRequestsQueue({
      homeDashboardKind: options?.homeDashboardKind,
      accessMode: accessMode ?? "employee",
      scope: options?.scope,
      permissionLabels,
      roleNames: options?.roleNames,
    })
  }
  return canAccessDashboardRoute(url, permissionLabels, accessMode)
}
