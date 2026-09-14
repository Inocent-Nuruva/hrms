import {
  hasPermission,
  type DashboardAccessMode,
} from "@/lib/dashboard-permissions"

export type HomeDashboardKind =
  | "platform"
  | "employee"
  | "hr"
  | "management"
  | "manager"
  | "sales-field"
  | "company"

export function showsPersonalRoutesAlongsideWorkRoutes(
  kind: HomeDashboardKind | null | undefined,
  permissionLabels: string[] = [],
) {
  return (
    kind === "hr" ||
    kind === "manager" ||
    hasPermission(permissionLabels, {
      permissions: [
        "manager_self_service:read",
        "manager_team:read",
        "view_manager_dashboard",
        "manager_dashboards:read",
        "data_scope:department",
        "data_scope:branch",
        "data_scope:team",
      ],
      mode: "any",
    })
  )
}

type UnknownRecord = Record<string, unknown>

function asUnknownRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function readDepartmentLabel(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return null
}

function isHumanResourcesLabel(value: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") ?? ""
  return (
    normalized === "hr" ||
    normalized.includes("human resource") ||
    normalized.includes("people operations") ||
    normalized.includes("people ops")
  )
}

/**
 * Detect an HR employee from either `/api/employees/me` or an employee
 * dashboard envelope. The API uses both direct employee records and nested
 * `{ employee: ... }` payloads, so checking only the first response level can
 * make the sidebar change between a hot reload and a fresh login.
 */
export function isHumanResourcesEmployeeRecord(value: unknown) {
  const root = asUnknownRecord(value)
  if (!root) return false

  const queue: UnknownRecord[] = [root]
  const visited = new Set<UnknownRecord>()
  const wrapperKeys = ["employee", "data", "result", "item", "profile"]
  const departmentKeys = [
    "department",
    "primary_department",
    "primaryDepartment",
    "employee_department",
  ]

  while (queue.length > 0) {
    const record = queue.shift()
    if (!record || visited.has(record)) continue
    visited.add(record)

    if (
      isHumanResourcesLabel(
        readDepartmentLabel(record, [
          "department_name",
          "departmentName",
          "primary_department_name",
          "primaryDepartmentName",
        ]),
      )
    ) {
      return true
    }

    for (const key of departmentKeys) {
      const department = asUnknownRecord(record[key])
      if (
        department &&
        isHumanResourcesLabel(
          readDepartmentLabel(department, [
            "name",
            "department_name",
            "departmentName",
            "display_name",
          ]),
        )
      ) {
        return true
      }
    }

    for (const key of wrapperKeys) {
      const nested = asUnknownRecord(record[key])
      if (nested && !visited.has(nested)) queue.push(nested)
    }
  }

  return false
}

function normalizeRoleName(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function isHrRole(name: string) {
  const words = name.split(" ").filter(Boolean)
  return (
    name === "hr" ||
    words.includes("hr") ||
    name.startsWith("hr ") ||
    name.endsWith(" hr") ||
    name.includes("human resource") ||
    name.includes("people ops") ||
    name.includes("people operations")
  )
}

function isManagementRole(name: string) {
  return (
    name.includes("management") ||
    name.includes("executive") ||
    name.includes("director") ||
    name.includes("c level") ||
    name === "cfo" ||
    name === "coo" ||
    name === "ceo"
  )
}

function isManagerRole(name: string) {
  if (isHrRole(name) || isManagementRole(name)) return false
  return (
    name === "manager" ||
    name.endsWith(" manager") ||
    name.includes("line manager") ||
    name.includes("team lead") ||
    name.includes("team leader") ||
    name.includes("supervisor")
  )
}

function isSalesFieldRole(name: string) {
  return (
    name.includes("sales field") ||
    name.includes("field sales") ||
    (name.includes("sales") && name.includes("field"))
  )
}

function isCompanyAdminRole(name: string) {
  return (
    name.includes("company admin") ||
    name === "admin" ||
    name === "administrator" ||
    name.includes("super admin") ||
    name === "owner" ||
    name === "root"
  )
}

function kindFromRoles(roleNames: string[]): HomeDashboardKind | null {
  const names = roleNames.map(normalizeRoleName).filter(Boolean)
  if (names.some(isHrRole)) return "hr"
  if (names.some(isManagementRole)) return "management"
  if (names.some(isManagerRole)) return "manager"
  if (names.some(isSalesFieldRole)) return "sales-field"
  if (names.some(isCompanyAdminRole)) return "company"
  return null
}

function kindFromSpecificPermissions(permissionLabels: string[]): HomeDashboardKind | null {
  if (
    hasPermission(permissionLabels, {
      permissions: ["view_hr_dashboard", "hr_dashboards:read"],
      mode: "any",
    })
  ) {
    return "hr"
  }
  if (
    hasPermission(permissionLabels, {
      permissions: ["view_management_dashboard", "management_dashboards:read"],
      mode: "any",
    })
  ) {
    return "management"
  }
  if (
    hasPermission(permissionLabels, {
      permissions: [
        "view_manager_dashboard",
        "manager_dashboards:read",
        "manager_self_service:read",
        "manager_team:read",
        "data_scope:department",
        "data_scope:branch",
        "data_scope:team",
      ],
      mode: "any",
    })
  ) {
    return "manager"
  }
  if (
    hasPermission(permissionLabels, {
      permissions: ["view_sales_field", "sales_field:read"],
      mode: "any",
    })
  ) {
    return "sales-field"
  }
  if (
    hasPermission(permissionLabels, {
      permissions: ["view_company_dashboard", "view_company_data"],
      mode: "any",
    })
  ) {
    return "company"
  }
  return null
}

/**
 * Pick the home dashboard for `/dashboard`.
 * Role names win (HR Manager vs Company Admin), then specific dashboard
 * grants. Shared `dashboards:read` is not used here so one grant cannot
 * collapse every role into the HR view.
 */
export function resolveHomeDashboardKind(input: {
  accessMode: DashboardAccessMode
  scope?: "platform" | "company" | null
  permissionLabels: string[]
  roleNames?: string[]
}): HomeDashboardKind {
  if (input.scope === "platform") return "platform"

  const fromRole = kindFromRoles(input.roleNames ?? [])
  if (fromRole) return fromRole

  // Some HR users intentionally keep the employee shell for self-service,
  // while the API grants their HR work surface explicitly. That dedicated
  // grant must be evaluated before the generic employee fallback.
  if (
    hasPermission(input.permissionLabels, {
      permissions: ["view_hr_dashboard", "hr_dashboards:read"],
      mode: "any",
    })
  ) {
    return "hr"
  }

  if (input.accessMode === "employee") return "employee"

  const fromGrant = kindFromSpecificPermissions(input.permissionLabels)
  if (fromGrant) return fromGrant

  return "company"
}

function hasLeaveRequestWorkPermission(permissionLabels: string[]) {
  return hasPermission(permissionLabels, {
    permissions: [
      "leave_requests:read",
      "leave_requests:approve",
      "leave_requests:update",
    ],
    mode: "any",
  })
}

export function isCompanyLeaveRequestsPath(url: string) {
  const path = url.split("?")[0] ?? url
  return (
    path === "/dashboard/leave-management/requests" ||
    path.startsWith("/dashboard/leave-management/requests/")
  )
}

/**
 * Company-wide leave request queues belong to HR, not company admin.
 */
export function canSeeHrLeaveRequestsQueue(input: {
  homeDashboardKind?: HomeDashboardKind | null
  accessMode: DashboardAccessMode
  scope?: "platform" | "company" | null
  permissionLabels: string[]
  roleNames?: string[]
}) {
  const kind =
    input.homeDashboardKind ??
    resolveHomeDashboardKind({
      accessMode: input.accessMode,
      scope: input.scope,
      permissionLabels: input.permissionLabels,
      roleNames: input.roleNames ?? [],
    })
  return kind === "hr" && hasLeaveRequestWorkPermission(input.permissionLabels)
}
