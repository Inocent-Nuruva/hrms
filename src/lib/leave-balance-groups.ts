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

function asRecord(value: unknown): LeaveBalanceRow | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as LeaveBalanceRow)
    : null
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

export function readBalanceEmployeeId(row: LeaveBalanceRow): number | null {
  const direct = readNumber(row, ["employee_id", "employeeId"])
  if (direct !== null) {
    return direct
  }
  const nested = asRecord(row.employee) ?? asRecord(row.Employee)
  if (!nested) {
    return null
  }
  return readNumber(nested, ["id", "employee_id", "employeeId"])
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true })
}

function mergeBalanceGroups(
  left: LeaveBalanceEmployeeGroup,
  right: LeaveBalanceEmployeeGroup,
  key: string,
): LeaveBalanceEmployeeGroup {
  const fiscalYears = new Set([...left.fiscalYears, ...right.fiscalYears])
  return {
    key,
    employeeId: left.employeeId ?? right.employeeId,
    employeeName: left.employeeName || right.employeeName,
    fiscalYears: Array.from(fiscalYears).sort(compareText),
    typeCount: left.rows.length + right.rows.length,
    allocatedDays: left.allocatedDays + right.allocatedDays,
    usedDays: left.usedDays + right.usedDays,
    remainingDays: left.remainingDays + right.remainingDays,
    rows: [...left.rows, ...right.rows],
  }
}

function collapseGroupsWithSameEmployeeName(
  groups: LeaveBalanceEmployeeGroup[],
): LeaveBalanceEmployeeGroup[] {
  if (groups.length <= 1 || !groups.every((group) => group.typeCount === 1)) {
    return groups
  }

  const byName = new Map<string, LeaveBalanceEmployeeGroup>()
  const leftovers: LeaveBalanceEmployeeGroup[] = []

  groups.forEach((group) => {
    const nameKey = group.employeeName.trim().toLowerCase()
    if (!nameKey || nameKey === "unknown employee") {
      leftovers.push(group)
      return
    }
    const existing = byName.get(nameKey)
    byName.set(
      nameKey,
      existing ? mergeBalanceGroups(existing, group, `name:${nameKey}`) : { ...group, key: `name:${nameKey}` },
    )
  })

  const merged = Array.from(byName.values())
  if (merged.length === groups.length) {
    return groups
  }

  return [...merged, ...leftovers].sort((left, right) =>
    compareText(left.employeeName, right.employeeName),
  )
}

export function groupLeaveBalancesByEmployee(
  rows: LeaveBalanceRow[],
  resolveEmployeeName: (row: LeaveBalanceRow) => string,
): LeaveBalanceEmployeeGroup[] {
  const groups = new Map<string, LeaveBalanceEmployeeGroup>()

  rows.forEach((row, index) => {
    const employeeId = readBalanceEmployeeId(row)
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

  return collapseGroupsWithSameEmployeeName(
    Array.from(groups.values()).sort((left, right) =>
      compareText(left.employeeName, right.employeeName),
    ),
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
