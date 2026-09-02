type LeaveRequestRecord = Record<string, unknown>

const MEDICAL_LEAVE_PATTERN = /(^|[^a-z])(sick(?:ness)?|medical|illness)([^a-z]|$)/i

function asRecord(value: unknown): LeaveRequestRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as LeaveRequestRecord)
    : null
}

function readText(record: LeaveRequestRecord | null, keys: string[]) {
  if (!record) return ""
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

/**
 * Medical details belong to sick/medical leave requests. The current API does
 * not expose a dedicated boolean on LeaveType, so use its stable code first and
 * its display name as a fallback.
 */
export function isMedicalLeaveRequest(row: LeaveRequestRecord | null | undefined) {
  if (!row) return false

  const leaveType = asRecord(row.leave_type) ?? asRecord(row.leaveType)
  const values = [
    readText(leaveType, ["code"]),
    readText(leaveType, ["name", "display_name", "displayName"]),
    readText(row, ["leave_type_code", "leaveTypeCode"]),
    readText(row, ["leave_type_name", "leaveTypeName"]),
  ]

  return values.some((value) => MEDICAL_LEAVE_PATTERN.test(value))
}
