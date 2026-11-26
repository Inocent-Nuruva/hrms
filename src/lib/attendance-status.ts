/**
 * The four independent attendance status dimensions (mirrors backend
 * attendance-status-dimensions.enum.ts). The legacy composite
 * `attendanceStatus` (LATE, OVERTIME, ...) stays for payroll-facing views.
 */

export type AttendanceStatusTone = "ok" | "late" | "warn" | "bad" | "info" | "neutral"

type Def = { label: string; tone: AttendanceStatusTone }

// Spec colours: Green=ok, Red=bad, Orange=warn, Blue=info, Grey=neutral.
export const PRIMARY_STATUS: Record<string, Def> = {
  PRESENT: { label: "Present", tone: "ok" },
  ABSENT: { label: "Absent", tone: "bad" },
  HALF_DAY: { label: "Half Day", tone: "warn" },
  LEAVE: { label: "On Leave", tone: "info" },
  OFFICIAL_DUTY: { label: "Official Duty", tone: "info" },
  OFF_DAY: { label: "Off Day", tone: "neutral" },
  HOLIDAY: { label: "Holiday", tone: "info" },
  NO_SHIFT_SCHEDULE: { label: "No Shift Scheduled", tone: "warn" },
  NOT_YET_CHECKED_IN: { label: "Not Yet Checked In", tone: "neutral" },
  UNDETERMINED: { label: "Undetermined", tone: "warn" },
  NOT_APPLICABLE: { label: "Not Applicable", tone: "neutral" },
}

export const PUNCH_STATUS: Record<string, Def> = {
  COMPLETE: { label: "Complete", tone: "ok" },
  MISSING_CHECK_IN: { label: "Missing Check-In", tone: "bad" },
  MISSING_CHECK_OUT: { label: "Missing Check-Out", tone: "bad" },
  MISSING_BOTH: { label: "Missing Both Punches", tone: "bad" },
  IN_PROGRESS: { label: "In Progress", tone: "info" },
  INVALID: { label: "In Progress", tone: "info" },
  NOT_REQUIRED: { label: "Not Required", tone: "neutral" },
}

export const ARRIVAL_STATUS: Record<string, Def> = {
  ON_TIME: { label: "On Time", tone: "ok" },
  EARLY_ARRIVAL: { label: "Early Arrival", tone: "ok" },
  LATE: { label: "Late Arrival", tone: "warn" },
  NOT_YET_CHECKED_IN: { label: "Not Yet Checked In", tone: "neutral" },
  UNKNOWN: { label: "Unknown", tone: "warn" },
  NOT_APPLICABLE: { label: "N/A", tone: "neutral" },
}

export const DEPARTURE_STATUS: Record<string, Def> = {
  ON_TIME: { label: "On Time", tone: "ok" },
  EARLY_DEPARTURE: { label: "Early Departure", tone: "warn" },
  LATE_DEPARTURE: { label: "Late Departure", tone: "info" },
  NOT_YET_CHECKED_OUT: { label: "Not Yet Checked Out", tone: "neutral" },
  UNKNOWN: { label: "Unknown", tone: "warn" },
  NOT_APPLICABLE: { label: "N/A", tone: "neutral" },
}

export type AttendanceDimensions = {
  primary: string | null
  punch: string | null
  arrival: string | null
  departure: string | null
  isProvisional: boolean
  leaveTypeName: string | null
}

type Row = Record<string, unknown>

function pick(row: Row, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim().toUpperCase()
  }
  return null
}

/** Reads the four dimensions from a summary row (camelCase or snake_case). */
export function readAttendanceDimensions(row: Row | null | undefined): AttendanceDimensions | null {
  if (!row) return null
  const primary = pick(row, ["primaryStatus", "primary_status"])
  if (!primary) return null
  const leave = row.leaveTypeName ?? row.leave_type_name
  return {
    primary,
    punch: pick(row, ["punchStatus", "punch_status"]),
    arrival: pick(row, ["arrivalStatus", "arrival_status"]),
    departure: pick(row, ["departureStatus", "departure_status"]),
    isProvisional: row.isProvisional === true || row.is_provisional === true,
    leaveTypeName: typeof leave === "string" && leave.trim() ? leave.trim() : null,
  }
}

export function primaryStatusLabel(dims: AttendanceDimensions): string {
  if (dims.primary === "LEAVE" && dims.leaveTypeName) return dims.leaveTypeName
  const label = PRIMARY_STATUS[dims.primary ?? ""]?.label ?? dims.primary ?? "—"
  return dims.isProvisional && dims.primary !== "PRESENT" ? `${label} (Provisional)` : label
}

export function dimensionDef(table: Record<string, Def>, value: string | null): Def {
  if (!value) return { label: "—", tone: "neutral" }
  return table[value] ?? { label: value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), tone: "neutral" }
}

export const DIMENSION_FILTERS = [
  { param: "primary_status", label: "Attendance status", options: PRIMARY_STATUS },
  { param: "punch_status", label: "Record completeness", options: PUNCH_STATUS },
  { param: "arrival_status", label: "Arrival", options: ARRIVAL_STATUS },
  { param: "departure_status", label: "Departure", options: DEPARTURE_STATUS },
] as const

/** Present/late/absent buckets for summary rates, using the dimensions when available. */
export function attendanceDimensionCategory(row: Row): "present" | "late" | "absent" | null | undefined {
  const dims = readAttendanceDimensions(row)
  if (!dims) return undefined
  if (dims.primary === "ABSENT") return "absent"
  if (dims.primary === "PRESENT" || dims.primary === "HALF_DAY" || dims.primary === "OFFICIAL_DUTY") {
    return dims.arrival === "LATE" ? "late" : "present"
  }
  return null
}
