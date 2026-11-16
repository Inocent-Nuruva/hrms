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

function readBalanceTypeKey(row: LeaveBalanceRow, index: number): string {
  const typeId = readNumber(row, ["leave_type_id", "leaveTypeId", "type_id", "typeId"])
  if (typeId !== null) {
    return `id:${typeId}`
  }

  const nestedType = asRecord(row.leave_type) ?? asRecord(row.leaveType) ?? asRecord(row.type)
  const typeName =
    readString(row, ["leave_type_name", "leaveTypeName", "type_name", "typeName"]) ||
    (nestedType ? readString(nestedType, ["name", "code", "title"]) : "")
  return typeName ? `name:${typeName.toLowerCase()}` : `row:${index}`
}

function countLeaveTypes(rows: LeaveBalanceRow[]): number {
  return new Set(rows.map((row, index) => readBalanceTypeKey(row, index))).size
}

export function readBalanceEmployeeId(row: LeaveBalanceRow): number | null {
  const direct = readNumber(row, ["employee_id", "employeeId"])
  if (direct !== null) {
    return direct
  }
  if (typeof row.employee === "number" && Number.isFinite(row.employee)) {
    return row.employee
  }
  const nested = asRecord(row.employee) ?? asRecord(row.Employee) ?? asRecord(row.user)
  if (!nested) {
    return readNumber(row, ["user_id", "userId"])
  }
  return readNumber(nested, ["id", "employee_id", "employeeId", "user_id", "userId"])
}

function isBareEmployeeId(value: string): boolean {
  return /^\d+$/.test(value) || /^#\d+$/.test(value)
}

function composedPersonName(row: LeaveBalanceRow): string {
  const first = readString(row, ["first_name", "firstName"])
  const last = readString(row, ["last_name", "lastName"])
  return [first, last].filter(Boolean).join(" ").trim()
}

export function resolveLeaveBalanceEmployeeName(
  row: LeaveBalanceRow,
  nameById?: Map<number, string>,
): string {
  const nested = asRecord(row.employee) ?? asRecord(row.Employee) ?? asRecord(row.user)
  if (nested) {
    const nestedFull = readString(nested, ["full_name", "fullName", "employee_name", "employeeName", "name"])
    if (nestedFull && !isBareEmployeeId(nestedFull)) {
      return nestedFull
    }
    const nestedComposed = composedPersonName(nested)
    if (nestedComposed) {
      return nestedComposed
    }
  }

  const composed = composedPersonName(row)
  if (composed) {
    return composed
  }

  const inline = readString(row, ["employee_name", "employeeName", "full_name", "fullName"])
  if (inline && !isBareEmployeeId(inline)) {
    return inline
  }

  const leaveTypeName = readString(row, [
    "leave_type_name",
    "leaveTypeName",
    "type_name",
    "typeName",
  ])
  const rawName = readString(row, ["name"])
  if (rawName && !isBareEmployeeId(rawName) && rawName.toLowerCase() !== leaveTypeName.toLowerCase()) {
    return rawName
  }

  const employeeId = readBalanceEmployeeId(row)
  if (employeeId !== null) {
    const mapped = nameById?.get(employeeId)?.trim()
    if (mapped && !isBareEmployeeId(mapped)) {
      return mapped
    }
  }

  return employeeId !== null ? `#${employeeId}` : "Unknown employee"
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
      typeCount: countLeaveTypes(nextRows),
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

  return Array.from(groups.values()).sort((left, right) => compareText(left.employeeName, right.employeeName))
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
