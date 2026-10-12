// Permanent delete is only offered for employees still in onboarding; the
// backend enforces the same rule and the remaining safety checks.

type StatusSource = Record<string, unknown>

export function employmentStatusOf(row: StatusSource): string {
  for (const key of ["employment_status", "employmentStatus", "status"]) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase()
    }
  }
  return ""
}

export function canDeletePermanently(row: StatusSource): boolean {
  return employmentStatusOf(row) === "onboarding"
}

export const PERMANENT_DELETE_CONFIRMATION = "DELETE"

export function isPermanentDeleteConfirmed(input: string): boolean {
  return input.trim() === PERMANENT_DELETE_CONFIRMATION
}

export function permanentDeleteSummary(result: {
  user_account_removed?: boolean
  company_user_removed?: boolean
}): string {
  if (result.user_account_removed) {
    return "Employee and login permanently deleted."
  }
  if (result.company_user_removed) {
    return "Employee permanently deleted. Their login was kept because it is used by another company."
  }
  return "Employee permanently deleted."
}
