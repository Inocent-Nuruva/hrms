import { canPerformPermission } from "@/lib/dashboard-permissions"
import type { AdminRecord } from "@/lib/admin-api"

export const ONBOARDING_APPROVAL_PERMISSION = "onboarding_requests:approve"
export const ONBOARDING_TASK_COMPLETION_PERMISSION = "onboarding_tasks:complete"

export function requiredPermissionForOnboardingStep(stepType: string) {
  return stepType.trim().toLowerCase() === "sign_off"
    ? ONBOARDING_APPROVAL_PERMISSION
    : ONBOARDING_TASK_COMPLETION_PERMISSION
}

function addPermissionName(value: unknown, names: Set<string>) {
  if (typeof value === "string") {
    const name = value.trim()
    if (name) names.add(name)
    return
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return

  const record = value as AdminRecord
  for (const key of ["name", "permission_name", "permissionName", "code"]) {
    const candidate = record[key]
    if (typeof candidate === "string" && candidate.trim()) {
      names.add(candidate.trim())
      return
    }
  }
}

function collectPermissionCollection(value: unknown, names: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((entry) => addPermissionName(entry, names))
    return
  }
  addPermissionName(value, names)
}

export function onboardingAssigneePermissionNames(row: AdminRecord | null | undefined) {
  const names = new Set<string>()
  const visited = new Set<object>()

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || visited.has(value)) return
    visited.add(value)
    const record = value as AdminRecord

    for (const key of ["permission_names", "permissionNames", "permissions", "direct_permissions", "directPermissions"]) {
      collectPermissionCollection(record[key], names)
    }

    for (const roleKey of ["roles", "role_assignments", "roleAssignments"]) {
      const roles = record[roleKey]
      if (!Array.isArray(roles)) continue
      roles.forEach((roleEntry) => {
        if (!roleEntry || typeof roleEntry !== "object") return
        const roleRecord = roleEntry as AdminRecord
        const role =
          roleRecord.role && typeof roleRecord.role === "object"
            ? (roleRecord.role as AdminRecord)
            : roleRecord
        collectPermissionCollection(role.permissions, names)
      })
    }

    for (const nestedKey of ["user", "company_user", "companyUser"]) {
      visit(record[nestedKey])
    }
  }

  visit(row)
  return Array.from(names)
}

export function onboardingAssigneeHasPermission(
  row: AdminRecord | null | undefined,
  stepType: string,
) {
  return canPerformPermission(
    onboardingAssigneePermissionNames(row),
    requiredPermissionForOnboardingStep(stepType),
  )
}
