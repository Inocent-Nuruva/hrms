export type LeaveBalanceRow = Record<string, unknown>

export type LeaveBalanceEmployeeGroup = {
  key: string
  employeeId: number | null
  employeeName: string
  fiscalYears: string[]
  typeCount: number
  allocatedDays: number
  usedDays: number
  remainingDays: number
  rows: LeaveBalanceRow[]
}

function readNumber(row: LeaveBalanceRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readString(row: LeaveBalanceRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
  }
  return ""
}

export function readBalanceDays(row: LeaveBalanceRow, keys: string[]): number {
  return readNumber(row, keys) ?? 0
}

export function formatBalanceDays(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.00"
  }
  return value.toFixed(2)
}

export function readBalanceFiscalYear(row: LeaveBalanceRow): string {
  return readString(row, ["fiscal_year", "fiscalYear"])
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true })
}

export function groupLeaveBalancesByEmployee(
  rows: LeaveBalanceRow[],
  resolveEmployeeName: (row: LeaveBalanceRow) => string,
): LeaveBalanceEmployeeGroup[] {
  const groups = new Map<string, LeaveBalanceEmployeeGroup>()

  rows.forEach((row, index) => {
    const employeeId = readNumber(row, ["employee_id", "employeeId"])
    const employeeName = resolveEmployeeName(row).trim() || "Unknown employee"
    const key =
      employeeId !== null
        ? `id:${employeeId}`
        : employeeName !== "Unknown employee"
          ? `name:${employeeName.toLowerCase()}`
          : `row:${index}`

    const existing = groups.get(key)
    const nextRows = existing ? [...existing.rows, row] : [row]
    const fiscalYears = new Set(existing?.fiscalYears ?? [])
    const fiscalYear = readBalanceFiscalYear(row)
    if (fiscalYear) {
      fiscalYears.add(fiscalYear)
    }

    groups.set(key, {
      key,
      employeeId: existing?.employeeId ?? employeeId,
      employeeName: existing?.employeeName ?? employeeName,
      fiscalYears: Array.from(fiscalYears).sort(compareText),
      typeCount: nextRows.length,
      allocatedDays:
        (existing?.allocatedDays ?? 0) +
        readBalanceDays(row, ["allocated_days", "allocated", "allocatedDays"]),
      usedDays:
        (existing?.usedDays ?? 0) + readBalanceDays(row, ["used_days", "used", "usedDays"]),
      remainingDays:
        (existing?.remainingDays ?? 0) +
        readBalanceDays(row, ["remaining_days", "remaining", "remainingDays"]),
      rows: nextRows,
    })
  })

  return Array.from(groups.values()).sort((left, right) =>
    compareText(left.employeeName, right.employeeName),
  )
}

export function sortLeaveBalanceRows(
  rows: LeaveBalanceRow[],
  resolveTypeName: (row: LeaveBalanceRow) => string,
): LeaveBalanceRow[] {
  return [...rows].sort((left, right) => {
    const yearCompare = compareText(readBalanceFiscalYear(left), readBalanceFiscalYear(right))
    if (yearCompare !== 0) {
      return yearCompare
    }
    return compareText(resolveTypeName(left), resolveTypeName(right))
  })
}
