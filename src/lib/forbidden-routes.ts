import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import type { DashboardAccessMode } from "@/lib/dashboard-permissions"
import { allDashboardSectionTabGroups } from "@/lib/dashboard-sections"

export const FORBIDDEN_ROUTES_EVENT = "hrms:forbidden-routes-changed"
const STORAGE_KEY = "hrms.forbiddenRoutes"

// Attendance download still works without analytics grants. A 403 from
// /api/analytics/* must not hide the whole Reports page or bounce to /dashboard.
const DO_NOT_REMEMBER = new Set(["/dashboard/operations/reports"])

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

function writePrefixes(prefixes: string[]) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefixes))
  window.dispatchEvent(new Event(FORBIDDEN_ROUTES_EVENT))
}

export function rememberForbiddenRoute(url: string) {
  const prefix = tabPrefix(url)
  if (DO_NOT_REMEMBER.has(prefix)) return
  const current = readPrefixes()
  if (current.includes(prefix)) return
  writePrefixes([...current, prefix])
}

export function forgetForbiddenRoute(url: string) {
  const prefix = tabPrefix(url)
  const current = readPrefixes()
  const next = current.filter((entry) => entry !== prefix)
  if (next.length === current.length) return
  writePrefixes(next)
}

export function isRememberedForbiddenRoute(url: string) {
  const path = normalizePath(url)
  return readPrefixes().some((prefix) => {
    if (path === prefix) return true
    // Hide detail pages under a remembered tab, not sibling tabs in the same section.
    const depth = prefix.split("/").filter(Boolean).length
    if (depth < 3) return false
    return path.startsWith(`${prefix}/`)
  })
}

export function firstVisibleSiblingOrHome(
  url: string,
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  const path = normalizePath(url)
  for (const group of allDashboardSectionTabGroups()) {
    const inGroup = group.items.some(
      (item) => path === item.url || path.startsWith(`${item.url}/`),
    )
    if (!inGroup) continue
    const visible = group.items.find((item) =>
      canSeeDashboardPage(item.url, permissionLabels, accessMode),
    )
    if (visible) return visible.url
  }
  return "/dashboard"
}

export function canSeeDashboardPage(
  url: string,
  permissionLabels: string[],
  accessMode?: DashboardAccessMode,
) {
  if (isRememberedForbiddenRoute(url)) {
    return false
  }
  return canAccessDashboardRoute(url, permissionLabels, accessMode)
}
