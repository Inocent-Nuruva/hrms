export type DailySummarySearchRecord = Record<string, unknown>

function asRecord(value: unknown): DailySummarySearchRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as DailySummarySearchRecord
}

function readTrimmedString(record: DailySummarySearchRecord | null, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function readNested(record: DailySummarySearchRecord, keys: string[]): DailySummarySearchRecord | null {
  for (const key of keys) {
    const nested = asRecord(record[key])
    if (nested) return nested
  }
  return null
}

export function tokenizeNameSearch(search: string): string[] {
  return search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function joinNameParts(record: DailySummarySearchRecord | null): string {
  if (!record) return ""
  return [
    readTrimmedString(record, ["first_name", "firstName", "preferred_name", "preferredName"]),
    readTrimmedString(record, ["middle_name", "middleName"]),
    readTrimmedString(record, ["last_name", "lastName"]),
  ]
    .filter(Boolean)
    .join(" ")
}

/** Name / employee-number haystack only — never the rest of the payload. */
export function buildEmployeeNameHaystack(record: DailySummarySearchRecord): string {
  const nestedEmployee = readNested(record, ["employee", "employeeDetail", "employee_details", "staff"])
  const parts = [
    readTrimmedString(record, [
      "employee_name",
      "employeeName",
      "full_name",
      "fullName",
      "display_name",
      "displayName",
    ]),
    readTrimmedString(record, [
      "employee_no",
      "employeeNo",
      "employee_number",
      "employeeNumber",
      "employee_code",
      "employeeCode",
    ]),
    joinNameParts(record),
    nestedEmployee
      ? readTrimmedString(nestedEmployee, [
          "employee_name",
          "employeeName",
          "full_name",
          "fullName",
          "display_name",
          "displayName",
        ])
      : null,
    nestedEmployee
      ? readTrimmedString(nestedEmployee, ["employee_no", "employeeNo", "employee_number", "employeeNumber"])
      : null,
    joinNameParts(nestedEmployee),
  ]

  return parts
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
}

export function matchesEmployeeNameSearch(
  record: DailySummarySearchRecord,
  search: string,
): boolean {
  const tokens = tokenizeNameSearch(search)
  if (tokens.length === 0) return true
  const haystack = buildEmployeeNameHaystack(record)
  return tokens.every((token) => haystack.includes(token))
}

export function filterRowsByEmployeeNameSearch<T extends DailySummarySearchRecord>(
  rows: T[],
  search: string,
): T[] {
  const tokens = tokenizeNameSearch(search)
  if (tokens.length === 0) return rows
  return rows.filter((row) => matchesEmployeeNameSearch(row, search))
}

export function readPrimaryEmployeeId(record: DailySummarySearchRecord): number | null {
  for (const key of ["employee_id", "employeeId", "employeeID"] as const) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
  }
  return null
}

export function readDirectoryEmployeeId(record: DailySummarySearchRecord): number | null {
  for (const key of ["id", "employee_id", "employeeId"] as const) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed) && parsed > 0) return parsed
    }
  }
  return null
}
