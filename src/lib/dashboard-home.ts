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

function normalizeRoleName(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
}

function isHrRole(name: string) {
  return (
    name === "hr" ||
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
      permissions: ["view_manager_dashboard", "manager_dashboards:read"],
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

  if (input.accessMode === "employee") return "employee"

  const fromGrant = kindFromSpecificPermissions(input.permissionLabels)
  if (fromGrant) return fromGrant

  return "company"
}
