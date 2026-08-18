export type ReadinessCheck = {
  key: string
  label: string
  done: boolean
}

const CHECK_LABELS: Record<string, string> = {
  isActiveEmployee: "Active employee",
  hasActiveUser: "Has a login",
  hasBranch: "Assigned to a branch",
  hasDepartment: "Assigned to a department",
  hasTimetable: "Has a timetable",
  hasShift: "Has a shift",
  hasDeviceAssignment: "Assigned to a clock-in device",
  hasFingerprint: "Fingerprint registered",
  hasCardOrPin: "Card or PIN set up",
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function parseReadinessChecks(row: Record<string, unknown>): Record<string, boolean> {
  const raw = row.checks ?? row.check
  const record =
    typeof raw === "string" && raw.trim()
      ? (() => {
          try {
            return asRecord(JSON.parse(raw))
          } catch {
            return null
          }
        })()
      : asRecord(raw)
  if (!record) {
    return {}
  }
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === true || value === "true" || value === 1 || value === "1"
  }
  return out
}

export function readinessCheckItems(row: Record<string, unknown>): ReadinessCheck[] {
  const checks = parseReadinessChecks(row)
  return Object.entries(CHECK_LABELS).map(([key, label]) => ({
    key,
    label,
    done: checks[key] === true,
  }))
}

export function readinessIssueText(row: Record<string, unknown>): string {
  const issues = row.issues ?? row.issue
  if (typeof issues === "string" && issues.trim()) {
    return issues.trim()
  }
  if (Array.isArray(issues)) {
    return issues
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(". ")
  }
  const missing = readinessCheckItems(row)
    .filter((item) => !item.done)
    .map((item) => item.label.toLowerCase())
  if (missing.length === 0) {
    return ""
  }
  return `Still needs ${missing.join(", ")}.`
}

export function readinessPersonName(row: Record<string, unknown>): string {
  const name = [row.fullName, row.full_name, row.employee_name, row.employeeName, row.name]
    .find((value) => typeof value === "string" && value.trim())
  return typeof name === "string" ? name.trim() : "Employee"
}

export function isEmployeeReady(row: Record<string, unknown>): boolean {
  return row.isReady === true || row.is_ready === true || row.ready === true
}
