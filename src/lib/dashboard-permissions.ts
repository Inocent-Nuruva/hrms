import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, readString } from "@/utils/token-utils"

export const DASHBOARD_ACTOR_EVENT = "hrms:dashboard-actor-changed"
export const DASHBOARD_PERMISSION_STORAGE_KEY = "hrms.dashboard.actorPermissions"
export const DASHBOARD_ACCESS_MODE_STORAGE_KEY = "hrms.dashboard.accessMode"
export const DASHBOARD_IS_ADMIN_STORAGE_KEY = "hrms.dashboard.isAdmin"
export const DASHBOARD_AUTH_COOKIE = "hrms_dashboard_auth"
export const DASHBOARD_TOKEN_COOKIE = "hrms_dashboard_token"
export const DASHBOARD_PERMISSIONS_COOKIE = "hrms_dashboard_permissions"

const LEGACY_ADMIN_USER_STORAGE_KEY = "hrms.admin.user"

type PermissionMode = "any" | "all"

export type PermissionRequirement =
  | string
  | {
      permissions: string[]
      mode?: PermissionMode
    }

export type DashboardAccessMode = "admin" | "employee"

export type DashboardActorSnapshot = {
  permissionLabels: string[]
  accessMode: DashboardAccessMode
  isAdmin: boolean
  ready: boolean
  version: number
}

type DashboardActorIdentityResolution = {
  permissionLabels: string[]
  hasExplicitAdminIdentity: boolean
  hasExplicitEmployeeIdentity: boolean
  hasPermissionBasedAdminAccess: boolean
  accessMode: DashboardAccessMode
  isAdmin: boolean
}

const ADMIN_BYPASS_LABELS = new Set([
  "*",
  "*:*",
  "all",
  "admin",
  "administrator",
  "super_admin",
  "super-admin",
  "root",
  "owner",
  "admin:*",
  "super_admin:*",
  "super-admin:*",
  "root:*",
])

const ADMIN_DASHBOARD_LANDING_ROUTES = [
  "/dashboard/branches",
  "/dashboard/departments",
  // Do NOT use /dashboard/employees/all here — normal employees often have
  // employees:read for self-service and must not flip into admin mode.
  "/dashboard/employees/registration",
  "/dashboard/employees/onboarding",
  "/dashboard/employees/profile-update-approvals",
  "/dashboard/attendance/daily-summaries",
  "/dashboard/attendance/policies",
  "/dashboard/attendance/shifts",
  "/dashboard/access-control",
  "/dashboard/positions",
]

/**
 * HR/admin employee-directory routes. Blocked for accessMode === "employee"
 * even when the JWT includes a broad `employees:read` grant for self-service.
 */
const ADMIN_ONLY_EMPLOYEE_DIRECTORY_PREFIXES = [
  "/dashboard/employees/all",
  "/dashboard/employees/registration",
  "/dashboard/employees/onboarding",
  "/dashboard/employees/profile-update-approvals",
  "/dashboard/employees/profile",
] as const

/** Permissions that unlock the company employee directory (not basic self-service read). */
const EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS: PermissionRequirement = {
  permissions: [
    "employees:create",
    "employees:update",
    "employees:delete",
    "company_users:create",
    "users:create",
    "create_company_user",
  ],
  mode: "any",
}

export function isAdminOnlyEmployeeDirectoryRoute(url: string) {
  const path = url.split("?")[0] ?? url
  return ADMIN_ONLY_EMPLOYEE_DIRECTORY_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

const ADMIN_IDENTITY_HINTS = new Set([
  "admin",
  "administrator",
  "hr",
  "human resources",
  "human_resources",
  "human-resources",
  "super admin",
  "super_admin",
  "super-admin",
  "root",
  "owner",
])

const EMPLOYEE_IDENTITY_HINTS = new Set([
  "employee",
  "staff",
  "self service",
  "self_service",
  "self-service",
  "ess",
])

const ATTENDANCE_ROUTE_PERMISSIONS: PermissionRequirement = {
  permissions: [
    "attendance_policies:read",
    "attendance_devices:read",
    "attendance_checkpoints:read",
    "attendance_holiday_groups:read",
    "attendance_geofences:read",
    "attendance_wifi_networks:read",
    "attendance_mobile_punches:read",
    "attendance_holidays:read",
    "attendance_device_sync_logs:read",
    "attendance_summaries:read",
    "attendance_processing:read",
    "attendance_recalculation:execute",
    "shifts:read",
    "shift_breaks:read",
    "shift_assignments:read",
    "shift_schedules:read",
    "shift_rotation_groups:read",
    "shift_rotation_rules:read",
    "timetables:read",
    "timetable_days:read",
    "timetable_holiday_rules:read",
    "timetable_rotations:read",
    "timetable_rotation_rules:read",
    "employee_timetables:read",
    "self_service_requests:approve",
  ],
  mode: "any",
}

export const DASHBOARD_ROUTE_PERMISSIONS: Record<string, PermissionRequirement | null> = {
  "/dashboard/me/profile": null,
  "/dashboard/me/organization": null,
  "/dashboard/me/promotion": null,
  "/dashboard/me/offboarding": {
    permissions: [
      "offboarding_requests:read",
      "offboarding_workflows:read",
      "offboarding_requests:create",
    ],
    mode: "any",
  },
  "/dashboard/me/leave": null,
  "/dashboard/me/leave/requests": null,
  "/dashboard/me/leave/balances": null,
  "/dashboard/me/leave/holidays": null,
  "/dashboard/me/leave/policies": null,
  "/dashboard/attendance/today": null,
  "/dashboard/attendance/punch-action": null,
  "/dashboard/attendance/attendance-history": null,
  "/dashboard/attendance/schedule-preview": null,
  "/dashboard/attendance/corrections": null,
  "/dashboard/employees": {
    permissions: [
      "employees:create",
      "employees:update",
      "employees:delete",
      "company_users:create",
      "users:create",
      "create_company_user",
      "offboarding_requests:read",
      "offboarding_workflows:read",
      "onboarding_requests:read",
      "onboarding_workflows:read",
      "self_service_requests:approve",
    ],
    mode: "any",
  },
  // Directory: employees:read alone is intentionally NOT enough for the employee
  // shell (see canAccessDashboardRoute accessMode gate). Admin shell still uses this
  // requirement; manage permissions keep pure self-service tokens out of the directory.
  "/dashboard/employees/all": {
    permissions: [
      "employees:create",
      "employees:update",
      "employees:delete",
      "employees:read",
      "company_users:create",
      "users:create",
      "create_company_user",
    ],
    mode: "any",
  },
  "/dashboard/employees/registration": {
    permissions: [
      "employees:create",
      "company_users:create",
      "users:create",
      "create_company_user",
    ],
    mode: "any",
  },
  "/dashboard/employees/offboarding": {
    permissions: ["offboarding_requests:read", "offboarding_workflows:read"],
    mode: "any",
  },
  "/dashboard/employees/onboarding": {
    permissions: ["onboarding_requests:read", "onboarding_workflows:read"],
    mode: "any",
  },
  // Other employees' profiles — not self profile under /dashboard/me/profile.
  "/dashboard/employees/profile": EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS,
  "/dashboard/employees/profile/": EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS,
  "/dashboard/employees/profile-update-approvals": "self_service_requests:approve",
  "/dashboard/attendance": ATTENDANCE_ROUTE_PERMISSIONS,
  "/dashboard/attendance/settings": "attendance_policies:read",
  "/dashboard/attendance/policies": "attendance_policies:read",
  "/dashboard/attendance/devices": "attendance_devices:read",
  "/dashboard/attendance/checkpoints": "attendance_checkpoints:read",
  "/dashboard/attendance/holiday-groups": "attendance_holiday_groups:read",
  "/dashboard/attendance/geofences": "attendance_geofences:read",
  "/dashboard/attendance/wifi-networks": "attendance_wifi_networks:read",
  "/dashboard/attendance/mobile-punches": "attendance_mobile_punches:read",
  "/dashboard/attendance/holidays": "attendance_holidays:read",
  "/dashboard/attendance/device-sync-logs": "attendance_device_sync_logs:read",
  "/dashboard/attendance/daily-summaries": "attendance_summaries:read",
  "/dashboard/attendance/recalculation-jobs": {
    permissions: ["attendance_processing:read", "attendance_recalculation:execute"],
    mode: "any",
  },
  "/dashboard/attendance/unmatched-logs": "attendance_processing:read",
  "/dashboard/attendance/shifts": "shifts:read",
  "/dashboard/attendance/shift-breaks": "shift_breaks:read",
  "/dashboard/attendance/shift-assignments": "shift_assignments:read",
  "/dashboard/attendance/shift-schedules": "shift_schedules:read",
  "/dashboard/attendance/shift-rotation-groups": "shift_rotation_groups:read",
  "/dashboard/attendance/shift-rotation-rules": "shift_rotation_rules:read",
  "/dashboard/attendance/correction-requests": "self_service_requests:approve",
  "/dashboard/attendance/timetables": "timetables:read",
  "/dashboard/attendance/timetable-days": "timetable_days:read",
  "/dashboard/attendance/timetable-holiday-rules": "timetable_holiday_rules:read",
  "/dashboard/attendance/timetable-rotations": "timetable_rotations:read",
  "/dashboard/attendance/timetable-rotation-rules": "timetable_rotation_rules:read",
  "/dashboard/attendance/employee-timetables": "employee_timetables:read",
  "/dashboard/departments": "departments:read",
  "/dashboard/branches": "branches:read",
  "/dashboard/positions": "positions:read",
  "/dashboard/leave-management": {
    permissions: [
      "leave_types:read",
      "leave_requests:read",
      "leave_balances:read",
      "leave-balances.view",
      "leave-balances.manage",
      "holidays:read",
      "attendance_holidays:read",
      "leave_policies:read",
      "leave_workflows:read",
      "attendance_business_trips:read",
      "attendance_business_trips:create",
      "attendance_business_trips:update",
    ],
    mode: "any",
  },
  "/dashboard/leave-management/types": "leave_types:read",
  "/dashboard/leave-management/requests": "leave_requests:read",
  "/dashboard/leave-management/balances": {
    permissions: ["leave_balances:read", "leave-balances.view", "leave-balances.manage"],
    mode: "any",
  },
  "/dashboard/leave-management/business-trips": {
    permissions: [
      "attendance_business_trips:read",
      "attendance_business_trips:create",
      "attendance_business_trips:update",
    ],
    mode: "any",
  },
  "/dashboard/leave-management/holidays": {
    permissions: ["holidays:read", "attendance_holidays:read"],
    mode: "any",
  },
  "/dashboard/leave-management/policies": "leave_policies:read",
  "/dashboard/leave-management/workflows": "leave_workflows:read",
  "/dashboard/operations/promotion": null,
  "/dashboard/operations/recruitment": "view_company_data",
  "/dashboard/operations/payroll": null,
  "/dashboard/operations/reports": "view_company_data",
  "/dashboard/operations/scheduled-reporting": "view_company_data",
  "/dashboard/access-control": {
    permissions: [
      "attendance_devices:read",
      "access_doors:read",
      "access_schedule_templates:read",
      "access_organizations:read",
      "access_groups:read",
      "roles:read",
      "permissions:read",
    ],
    mode: "any",
  },
  "/dashboard/access-control/devices": "attendance_devices:read",
  "/dashboard/access-control/doors": "access_doors:read",
  "/dashboard/access-control/templates": "access_schedule_templates:read",
  "/dashboard/access-control/organizations": "access_organizations:read",
  "/dashboard/access-control/groups": "access_groups:read",
  "/dashboard/access-control/roles": "roles:read",
  "/dashboard/access-control/permissions": "permissions:read",
  "/dashboard/roles": "roles:read",
  "/dashboard/permissions": "permissions:read",
  "/dashboard/settings": null,
  "/dashboard/settings/default-avatars": {
    permissions: [
      "view_company_data",
      "users:update",
      "employees:update",
      "employees:create",
      "employees:read",
    ],
    mode: "any",
  },
}

function decodeBase64Url(input: string) {
  try {
    if (typeof atob === "function") {
      const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
      return atob(padded)
    }
    return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  } catch {
    return null
  }
}

export function canonicalizePermissionLabel(label: string) {
  return label.trim().toLowerCase().replace(/\./g, ":")
}

function isAdminBypassLabel(label: string) {
  const normalized = canonicalizePermissionLabel(label)
  if (ADMIN_BYPASS_LABELS.has(normalized)) {
    return true
  }
  return normalized.endsWith(":*")
}

function looksLikePermissionLabel(label: string) {
  const normalized = canonicalizePermissionLabel(label)
  return (
    isAdminBypassLabel(normalized) ||
    normalized.includes(":") ||
    normalized.startsWith("view_") ||
    normalized.startsWith("create_") ||
    normalized.startsWith("update_") ||
    normalized.startsWith("delete_") ||
    normalized.startsWith("manage_")
  )
}

export function normalizePermissionLabels(permissionLabels: string[]) {
  return Array.from(
    new Set(
      permissionLabels
        .map((label) => canonicalizePermissionLabel(label))
        .filter((label) => label.length > 0)
    )
  )
}

export function decodeJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  const decoded = decodeBase64Url(parts[1])
  if (!decoded) {
    return null
  }

  try {
    return asRecord(JSON.parse(decoded))
  } catch {
    return null
  }
}

export function collectPermissionLabelsFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    const normalized = canonicalizePermissionLabel(value)
    if (looksLikePermissionLabel(normalized)) {
      sink.add(normalized)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPermissionLabelsFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const direct = readString(record, [
    "name",
    "key",
    "code",
    "slug",
    "permission",
    "action",
    "role",
    "user_type",
    "type",
  ])
  if (direct) {
    collectPermissionLabelsFromUnknown(direct, sink)
  }

  for (const key of [
    "permissions",
    "permission",
    "authorities",
    "scopes",
    "actions",
    "role_permissions",
    "rolePermissions",
    "granted_permissions",
    "grantedPermissions",
    "roles",
    "data",
    "items",
    "records",
    "results",
    "user",
    "profile",
    "meta",
  ]) {
    collectPermissionLabelsFromUnknown(record[key], sink)
  }
}

export function readPermissionLabelsFromUnknown(...sources: unknown[]) {
  const labels = new Set<string>()

  for (const source of sources) {
    if (!source) {
      continue
    }

    if (typeof source === "string" && source.includes(".")) {
      collectPermissionLabelsFromUnknown(decodeJwtPayload(source), labels)
      continue
    }

    collectPermissionLabelsFromUnknown(source, labels)
  }

  return normalizePermissionLabels(Array.from(labels))
}

function normalizeIdentityHint(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ")
}

function collectDashboardIdentityHintsFromUnknown(
  value: unknown,
  sink: Set<string>
) {
  if (typeof value === "string" && value.trim()) {
    sink.add(normalizeIdentityHint(value))
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectDashboardIdentityHintsFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const direct = readString(record, [
    "user_type",
    "userType",
    "role",
    "role_name",
    "roleName",
    "type",
    "account_type",
    "accountType",
  ])
  if (direct) {
    sink.add(normalizeIdentityHint(direct))
  }

  for (const key of ["user", "profile", "role", "roles", "data", "items", "results"]) {
    collectDashboardIdentityHintsFromUnknown(record[key], sink)
  }
}

function readDashboardIdentityHintsFromUnknown(...sources: unknown[]) {
  const hints = new Set<string>()

  for (const source of sources) {
    if (!source) {
      continue
    }

    if (typeof source === "string" && source.includes(".")) {
      collectDashboardIdentityHintsFromUnknown(decodeJwtPayload(source), hints)
      continue
    }

    collectDashboardIdentityHintsFromUnknown(source, hints)
  }

  return hints
}

function resolvePermissionRequirement(
  requirement: PermissionRequirement | null | undefined
): { permissions: string[]; mode: PermissionMode } | null {
  if (!requirement) {
    return null
  }

  if (typeof requirement === "string") {
    return { permissions: [requirement], mode: "any" }
  }

  return {
    permissions: requirement.permissions,
    mode: requirement.mode ?? "any",
  }
}

export function hasPermission(
  permissionLabels: string[],
  requirement: PermissionRequirement | null | undefined
) {
  const resolved = resolvePermissionRequirement(requirement)
  if (!resolved || resolved.permissions.length === 0) {
    return true
  }

  const normalizedPermissions = normalizePermissionLabels(permissionLabels)
  if (normalizedPermissions.some(isAdminBypassLabel)) {
    return true
  }

  if (normalizedPermissions.length === 0) {
    return false
  }

  const requiredPermissions = normalizePermissionLabels(resolved.permissions)
  if (requiredPermissions.length === 0) {
    return true
  }

  if (resolved.mode === "all") {
    return requiredPermissions.every((required) => normalizedPermissions.includes(required))
  }

  return requiredPermissions.some((required) => normalizedPermissions.includes(required))
}

function resolveRequiredPermissions(url: string) {
  const exactMatch = DASHBOARD_ROUTE_PERMISSIONS[url]
  if (exactMatch !== undefined) {
    return exactMatch
  }

  const matchedEntry = Object.entries(DASHBOARD_ROUTE_PERMISSIONS)
    .sort(([left], [right]) => right.length - left.length)
    .find(([route]) => url === route || url.startsWith(`${route}/`))

  return matchedEntry?.[1]
}

export function canAccessDashboardRoute(
  url: string,
  permissionLabels: string[],
  accessMode?: DashboardAccessMode
) {
  // Hard block: employee shell never reaches the company employee directory
  // even if the token still includes a broad employees:read claim.
  if (accessMode === "employee" && isAdminOnlyEmployeeDirectoryRoute(url)) {
    return false
  }

  // Admin / HR shell: allow directory with employees:read (manage grants preferred).
  if (accessMode === "admin" && isAdminOnlyEmployeeDirectoryRoute(url)) {
    return hasPermission(permissionLabels, {
      permissions: [
        "employees:read",
        "employees:create",
        "employees:update",
        "employees:delete",
        "company_users:create",
        "users:create",
        "create_company_user",
        "self_service_requests:approve",
        "onboarding_requests:read",
        "onboarding_workflows:read",
      ],
      mode: "any",
    })
  }

  return hasPermission(permissionLabels, resolveRequiredPermissions(url))
}

export function canPerformPermission(
  permissionLabels: string[],
  requirement: PermissionRequirement
) {
  return hasPermission(permissionLabels, requirement)
}

export function hasAdminDashboardAccess(permissionLabels: string[]) {
  return ADMIN_DASHBOARD_LANDING_ROUTES.some((route) =>
    canAccessDashboardRoute(route, permissionLabels)
  )
}

function resolveDashboardActorIdentity(...sources: unknown[]): DashboardActorIdentityResolution {
  const permissionLabels = readPermissionLabelsFromUnknown(...sources)
  const identityHints = readDashboardIdentityHintsFromUnknown(...sources)
  const hasExplicitAdminIdentity = Array.from(identityHints).some((hint) =>
    ADMIN_IDENTITY_HINTS.has(hint)
  )
  const hasExplicitEmployeeIdentity = Array.from(identityHints).some((hint) =>
    EMPLOYEE_IDENTITY_HINTS.has(hint)
  )
  const hasPermissionBasedAdminAccess = hasAdminDashboardAccess(permissionLabels)
  const accessMode: DashboardAccessMode = hasExplicitAdminIdentity
    ? "admin"
    : hasExplicitEmployeeIdentity
      ? "employee"
      : hasPermissionBasedAdminAccess
        ? "admin"
        : "employee"

  return {
    permissionLabels,
    hasExplicitAdminIdentity,
    hasExplicitEmployeeIdentity,
    hasPermissionBasedAdminAccess,
    accessMode,
    isAdmin: accessMode === "admin",
  }
}

function writeCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === "undefined") {
    return
  }

  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"]
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure")
  }
  if (typeof maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`)
  }
  document.cookie = parts.join("; ")
}

function clearCookie(name: string) {
  writeCookie(name, "", 0)
}

export function buildDashboardActorSnapshotFromSources(
  ...sources: unknown[]
): DashboardActorSnapshot {
  const { permissionLabels, accessMode, isAdmin } = resolveDashboardActorIdentity(...sources)

  return {
    permissionLabels,
    accessMode,
    isAdmin,
    ready: true,
    version: Date.now(),
  }
}

export function publishDashboardActorSnapshot(snapshot: DashboardActorSnapshot) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(
    DASHBOARD_PERMISSION_STORAGE_KEY,
    JSON.stringify(snapshot.permissionLabels)
  )
  window.sessionStorage.setItem(DASHBOARD_ACCESS_MODE_STORAGE_KEY, snapshot.accessMode)
  window.sessionStorage.setItem(DASHBOARD_IS_ADMIN_STORAGE_KEY, snapshot.isAdmin ? "1" : "0")

  writeCookie(DASHBOARD_AUTH_COOKIE, "1")
  writeCookie(DASHBOARD_PERMISSIONS_COOKIE, JSON.stringify(snapshot.permissionLabels))

  window.dispatchEvent(
    new CustomEvent<DashboardActorSnapshot>(DASHBOARD_ACTOR_EVENT, {
      detail: snapshot,
    })
  )
}

export function publishDashboardActorSnapshotFromSources(...sources: unknown[]) {
  const snapshot = buildDashboardActorSnapshotFromSources(...sources)
  publishDashboardActorSnapshot(snapshot)
  return snapshot
}

export function clearDashboardActorSnapshot() {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.removeItem(DASHBOARD_PERMISSION_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_ACCESS_MODE_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_IS_ADMIN_STORAGE_KEY)

  clearCookie(DASHBOARD_AUTH_COOKIE)
  clearCookie(DASHBOARD_TOKEN_COOKIE)
  clearCookie(DASHBOARD_PERMISSIONS_COOKIE)

  window.dispatchEvent(
    new CustomEvent<DashboardActorSnapshot>(DASHBOARD_ACTOR_EVENT, {
      detail: {
        permissionLabels: [],
        accessMode: "employee",
        isAdmin: false,
        ready: true,
        version: Date.now(),
      },
    })
  )
}

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return ""
  }

  const pattern = `${name}=`
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(pattern))

  if (!match) {
    return ""
  }

  return decodeURIComponent(match.slice(pattern.length))
}

function readDashboardActorBrowserSources() {
  if (typeof window === "undefined") {
    return [] as unknown[]
  }

  const localSources: unknown[] = []
  const hasActiveAuthSession =
    Boolean(window.localStorage.getItem(AUTH_STORAGE_KEYS.user)) ||
    Boolean(window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens))

  const sourceKeys = hasActiveAuthSession
    ? [AUTH_STORAGE_KEYS.user, AUTH_STORAGE_KEYS.tokens]
    : [
        AUTH_STORAGE_KEYS.user,
        AUTH_STORAGE_KEYS.tokens,
        LEGACY_ADMIN_USER_STORAGE_KEY,
        "hrms.admin.accessToken",
      ]

  for (const key of sourceKeys) {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      continue
    }

    if (key === "hrms.admin.accessToken") {
      localSources.push(rawValue)
      continue
    }

    try {
      localSources.push(JSON.parse(rawValue))
    } catch {
      localSources.push(rawValue)
    }
  }

  const cookiePermissions = readCookieValue(DASHBOARD_PERMISSIONS_COOKIE)
  if (cookiePermissions) {
    try {
      const parsed = JSON.parse(cookiePermissions) as unknown
      if (Array.isArray(parsed)) {
        localSources.push(parsed.filter((entry) => typeof entry === "string"))
      }
    } catch {
      // Ignore malformed cookie snapshot.
    }
  }

  const tokenCookie = readCookieValue(DASHBOARD_TOKEN_COOKIE)
  if (tokenCookie) {
    localSources.push(tokenCookie)
  }

  return localSources
}

export function readDashboardActorSnapshotFromBrowser(): DashboardActorSnapshot {
  if (typeof window === "undefined") {
    return {
      permissionLabels: [],
      accessMode: "employee",
      isAdmin: false,
      ready: false,
      version: 0,
    }
  }

  const rawPermissions = window.sessionStorage.getItem(DASHBOARD_PERMISSION_STORAGE_KEY)
  if (rawPermissions) {
    try {
      const parsed = JSON.parse(rawPermissions) as unknown
      const permissionLabels = normalizePermissionLabels(
        Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : []
      )
      const rawAccessMode = window.sessionStorage.getItem(DASHBOARD_ACCESS_MODE_STORAGE_KEY)
      const rawIsAdmin = window.sessionStorage.getItem(DASHBOARD_IS_ADMIN_STORAGE_KEY)
      const derivedSnapshot = buildDashboardActorSnapshotFromSources(
        permissionLabels,
        ...readDashboardActorBrowserSources()
      )
      return {
        permissionLabels,
        accessMode: rawAccessMode === "admin" || rawAccessMode === "employee"
          ? rawAccessMode
          : derivedSnapshot.accessMode,
        isAdmin:
          rawIsAdmin === "1"
            ? true
            : rawIsAdmin === "0"
              ? false
              : derivedSnapshot.isAdmin,
        ready: true,
        version: Date.now(),
      }
    } catch {
      // Fall through to storage/cookie sources.
    }
  }

  return buildDashboardActorSnapshotFromSources(...readDashboardActorBrowserSources())
}

export function readDashboardPermissionLabelsFromBrowser() {
  return readDashboardActorSnapshotFromBrowser().permissionLabels
}

export function getDashboardAccessModeFromBrowser(): DashboardAccessMode {
  return readDashboardActorSnapshotFromBrowser().accessMode
}

export function hasDashboardAdminIdentity() {
  return readDashboardActorSnapshotFromBrowser().isAdmin
}

export function persistDashboardAccessToken(token: string) {
  if (typeof window === "undefined") {
    return
  }

  if (!token.trim()) {
    clearCookie(DASHBOARD_TOKEN_COOKIE)
    clearCookie(DASHBOARD_AUTH_COOKIE)
    return
  }

  writeCookie(DASHBOARD_AUTH_COOKIE, "1")
  writeCookie(DASHBOARD_TOKEN_COOKIE, token.trim())
}

export function publishDashboardActorSnapshotFromBrowserStorage(...sources: unknown[]) {
  const snapshot = buildDashboardActorSnapshotFromSources(
    ...readDashboardActorBrowserSources(),
    ...sources
  )
  publishDashboardActorSnapshot(snapshot)
  return snapshot
}

export function subscribeToDashboardActorSnapshot(
  listener: () => void
) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      !event.key ||
      [
        AUTH_STORAGE_KEYS.tokens,
        AUTH_STORAGE_KEYS.user,
        "hrms.admin.accessToken",
        LEGACY_ADMIN_USER_STORAGE_KEY,
        DASHBOARD_PERMISSION_STORAGE_KEY,
        DASHBOARD_ACCESS_MODE_STORAGE_KEY,
        DASHBOARD_IS_ADMIN_STORAGE_KEY,
      ].includes(event.key)
    ) {
      listener()
    }
  }

  window.addEventListener(DASHBOARD_ACTOR_EVENT, listener)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(DASHBOARD_ACTOR_EVENT, listener)
    window.removeEventListener("storage", handleStorage)
  }
}
