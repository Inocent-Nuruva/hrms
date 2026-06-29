"use client"

import * as React from "react"
import {
  AlarmClockCheckIcon,
  CalendarDaysIcon,
  Clock3Icon,
  Filter,
  MapPinIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  TimerResetIcon,
} from "lucide-react"

import { TableScrollContainer } from "@/components/common/table-scroll-container"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  createMyAttendanceCheckIn,
  createMyAttendanceCheckOut,
  getMyAttendanceSchedule,
  getMyAttendanceToday,
  rebuildAttendanceDailySummaries,
  listAttendanceDailySummaries,
  listAttendanceProcessingJobs,
  listAttendanceUnmatchedLogs,
  listBranches,
  listEmployees,
  listMyAttendanceHistory,
  listMyAttendancePunches,
  processAttendanceRange,
  runPendingAttendanceProcessingJobs,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

type AttendanceActivitySectionKey =
  | "daily-summaries"
  | "recalculation-jobs"
  | "unmatched-logs"
  | "today"
  | "punch-action"
  | "punch-history"
  | "attendance-history"
  | "schedule-preview"

type SectionConfig = {
  title: string
  groupTitle: string
  description: string
}

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const DAILY_SUMMARY_STATUS_OPTIONS = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "OFF_DAY",
  "HOLIDAY",
  "ON_LEAVE",
]

const SECTION_CONFIG: Record<AttendanceActivitySectionKey, SectionConfig> = {
  "daily-summaries": {
    title: "Daily Summaries",
    groupTitle: "Attendance Operations",
    description: "Review processed daily attendance summaries returned by the attendance engine.",
  },
  "recalculation-jobs": {
    title: "Recalculation Jobs",
    groupTitle: "Attendance Operations",
    description: "Review attendance processing jobs and run recalculation actions when data needs to be rebuilt.",
  },
  "unmatched-logs": {
    title: "Unmatched Logs",
    groupTitle: "Attendance Operations",
    description: "Review processed events that could not be matched back to an employee cleanly.",
  },
  today: {
    title: "Today",
    groupTitle: "My Attendance",
    description: "",
  },
  "punch-action": {
    title: "Punch Action",
    groupTitle: "My Attendance",
    description: "",
  },
  "punch-history": {
    title: "Punch History",
    groupTitle: "My Attendance",
    description: "Review your recorded punch events.",
  },
  "attendance-history": {
    title: "Attendance History",
    groupTitle: "My Attendance",
    description: "",
  },
  "schedule-preview": {
    title: "Schedule Preview",
    groupTitle: "My Attendance",
    description: "",
  },
}

function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) {
    return direct
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) {
    return ""
  }

  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function resolveSection(section: string): AttendanceActivitySectionKey {
  return (
    Object.keys(SECTION_CONFIG).includes(section) ? section : "daily-summaries"
  ) as AttendanceActivitySectionKey
}

function getTodayDateInputValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatLoadError(errorObject: unknown, fallback: string) {
  if (errorObject instanceof Error && errorObject.message) {
    return errorObject.message
  }
  return fallback
}

function prettifyLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function isTimeValue(value: string) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function formatDisplayDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date)
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDisplayTime(value: string) {
  const [hours, minutes] = value.split(":")
  const hourNumber = Number(hours)
  const minuteNumber = Number(minutes)
  if (!Number.isInteger(hourNumber) || !Number.isInteger(minuteNumber)) {
    return value
  }

  const date = new Date()
  date.setHours(hourNumber, minuteNumber, 0, 0)
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "-"
    if (isIsoDateString(trimmed)) {
      return formatDisplayDate(trimmed)
    }
    if (isTimeValue(trimmed)) {
      return formatDisplayTime(trimmed)
    }
    return trimmed
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return JSON.stringify(value)
  return "-"
}

function formatOptionalValue(value: unknown, fallback: string) {
  const formatted = stringifyValue(value)
  return formatted === "-" ? fallback : formatted
}

function readFirstValue(record: AdminRecord | null | undefined, keys: string[]) {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (value === null || value === undefined) {
      continue
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value)
    }
  }
  return null
}

function statusTone(statusValue: string | null) {
  const normalized = statusValue?.trim().toUpperCase() ?? ""
  if (normalized.includes("PRESENT") || normalized.includes("COMPLETE")) {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      accent: "bg-emerald-500",
      panel: "border-emerald-100 bg-emerald-50/60",
    }
  }
  if (normalized.includes("LATE") || normalized.includes("MISSING")) {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      accent: "bg-amber-500",
      panel: "border-amber-100 bg-amber-50/60",
    }
  }
  if (normalized.includes("ABSENT") || normalized.includes("REJECT")) {
    return {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      accent: "bg-rose-500",
      panel: "border-rose-100 bg-rose-50/60",
    }
  }
  return {
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    accent: "bg-sky-500",
    panel: "border-sky-100 bg-sky-50/60",
  }
}

function TodayOverview({ record }: { record: AdminRecord | null }) {
  if (!record) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        No attendance summary yet. Your data for today has not been published.
      </div>
    )
  }

  const effective = record && record.summary && typeof record.summary === "object" && !Array.isArray(record.summary)
    ? (record.summary as AdminRecord)
    : (record || {})

  const status = (
    readWithFallback(record, ["punch_state", "processing_state"], null) ||
    readWithFallback(effective, ["attendance_status", "status", "summary_status", "state"], null)
  ) ?? "Pending"
  const scheduleStart = formatOptionalValue(
    readWithFallback(record, ["schedule_start_at", "schedule_start_time", "shift_start_at", "start_time"], effective),
    "Not set"
  )
  const scheduleEnd = formatOptionalValue(
    readWithFallback(record, ["schedule_end_at", "schedule_end_time", "shift_end_at", "end_time"], effective),
    "Not set"
  )
  const firstPunch = formatOptionalValue(
    readWithFallback(record, ["first_punch", "first_check_in_at", "first_punch_at", "check_in_at", "clock_in_at"], null),
    "Not recorded"
  )
  const lastPunch = formatOptionalValue(
    readWithFallback(record, ["last_punch", "last_check_out_at", "last_punch_at", "check_out_at", "clock_out_at"], null),
    "Not recorded"
  )
  const workedHours = readWithFallback(record, ["worked_hours", "worked_duration", "total_worked_hours", "hours_worked"], effective) ?? "Still calculating"
  const branch = readWithFallback(record, ["branch_name", "branch", "location_name", "site_name"], effective) ?? "Assigned branch"
  const shift = readWithFallback(record, ["shift_name", "schedule_name", "timetable_name"], effective) || ""
  const lateness = readWithFallback(record, ["late_minutes", "lateness_minutes", "minutes_late"], effective) ?? "0"
  const overtime = readWithFallback(record, ["overtime_minutes", "overtime_hours", "extra_time"], effective) ?? "0"

  const hiddenKeys = new Set([
    "attendance_status",
    "status",
    "summary_status",
    "state",
    "schedule_start_at",
    "schedule_start_time",
    "shift_start_at",
    "start_time",
    "schedule_end_at",
    "schedule_end_time",
    "shift_end_at",
    "end_time",
    "first_check_in_at",
    "first_punch_at",
    "check_in_at",
    "clock_in_at",
    "last_check_out_at",
    "last_punch_at",
    "check_out_at",
    "clock_out_at",
    "worked_hours",
    "worked_duration",
    "total_worked_hours",
    "hours_worked",
    "branch_name",
    "branch",
    "location_name",
    "site_name",
    "shift_name",
    "schedule_name",
    "timetable_name",
    "late_minutes",
    "lateness_minutes",
    "minutes_late",
    "overtime_minutes",
    "overtime_hours",
    "extra_time",
    "date",
    "summary",
    "punches",
    "punch_state",
    "processing_state",
    "first_punch",
    "last_punch",
    "action_flags",
  ])

  const extraEntries = Object.entries(record).filter(
    ([key, value]) => !hiddenKeys.has(key) && value !== null && value !== undefined && stringifyValue(value) !== "-"
  )
  const compactExtraEntries = extraEntries.slice(0, 6)

  return (
    <div className="space-y-4">
      {shift && (
        <div className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
          {shift}
        </div>
      )}

      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Schedule</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-2">
            <Clock3Icon className="mt-0.5 size-3.5 text-primary shrink-0" />
            <div className="text-xs">
              <div className="text-muted-foreground">Start</div>
              <div className="font-medium text-foreground">{scheduleStart}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <TimerResetIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
            <div className="text-xs">
              <div className="text-muted-foreground">End</div>
              <div className="font-medium text-foreground">{scheduleEnd}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <AlarmClockCheckIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
            <div className="text-xs">
              <div className="text-muted-foreground">Worked</div>
              <div className="font-medium text-foreground">{workedHours}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <MapPinIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
            <div className="text-xs">
              <div className="text-muted-foreground">Branch</div>
              <div className="font-medium text-foreground">{branch}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Today&apos;s pulse</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-2">
            <div className="text-xs">
              <div className="text-muted-foreground">First punch</div>
              <div className="font-medium text-foreground">{firstPunch}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-xs">
              <div className="text-muted-foreground">Last punch</div>
              <div className="font-medium text-foreground">{lastPunch}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-xs">
              <div className="text-muted-foreground">Late by</div>
              <div className="font-medium text-foreground">{lateness} min</div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="text-xs">
              <div className="text-muted-foreground">Overtime</div>
              <div className="font-medium text-foreground">{overtime} min</div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">Status: <span className="font-medium text-foreground">{status}</span></div>

      {(record as any)?.action_flags && (
        <div className="text-xs text-muted-foreground">
          Can check-in: <span className="font-medium text-foreground">{String((record as any).action_flags.can_check_in ?? "-")}</span> • Can check-out: <span className="font-medium text-foreground">{String((record as any).action_flags.can_check_out ?? "-")}</span>
        </div>
      )}

      {compactExtraEntries.length ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Extra details</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {compactExtraEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <div className="text-muted-foreground min-w-[90px]">{prettifyLabel(key)}</div>
                <div className="font-medium text-foreground truncate" title={stringifyValue(value)}>
                  {stringifyValue(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function readNumberFromRow(row: AdminRecord, keys: string[]) {
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

function readStringFromRow(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function readNestedRecord(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as AdminRecord
    }
  }
  return null
}

function readWithFallback(
  record: AdminRecord | null | undefined,
  keys: string[],
  fallbackRecord?: AdminRecord | null | undefined
) {
  let val = readFirstValue(record, keys)
  if (val === null || val === undefined) {
    val = readFirstValue(fallbackRecord, keys)
  }
  return val
}

function getEmployeeOptionLabel(employee: AdminRecord) {
  const id = readNumberFromRow(employee, ["id", "employee_id", "employeeId"])
  const employeeNo = readStringFromRow(employee, ["employee_no", "employeeNo", "employee_number"])
  const fullName =
    readStringFromRow(employee, ["employee_name", "employeeName", "full_name", "fullName", "display_name", "name"]) ??
    [
      readStringFromRow(employee, ["first_name", "firstName", "preferred_name", "preferredName"]),
      readStringFromRow(employee, ["middle_name", "middleName"]),
      readStringFromRow(employee, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()

  const parts = [fullName || "Employee", employeeNo || null, id !== null ? `ID ${id}` : null].filter(Boolean)
  return parts.join(" · ")
}

function getBranchOptionLabel(branch: AdminRecord) {
  return (
    readStringFromRow(branch, ["branch_name", "branchName", "name", "title"]) ??
    (readNumberFromRow(branch, ["id", "branch_id", "branchId"]) !== null
      ? `Branch ${readNumberFromRow(branch, ["id", "branch_id", "branchId"])}`
      : "Branch")
  )
}

function normalizeDateOnly(value: string | null) {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed.slice(0, 10)
}

function applyDailySummaryFilters(
  rows: AdminRecord[],
  filters: Record<string, string>,
  employeeSearch: string
) {
  const fromDate = normalizeDateOnly(filters.from_date || null)
  const toDate = normalizeDateOnly(filters.to_date || null)
  const employeeId = filters.employee_id.trim()
  const organizationId = filters.organization_id.trim()
  const status = filters.status.trim().toUpperCase()
  const employeeSearchTerm = employeeSearch.trim().toLowerCase()

  return rows.filter((row) => {
    const attendanceDate = normalizeDateOnly(
      readStringFromRow(row, [
        "attendance_date",
        "attendanceDate",
        "date",
        "summary_date",
        "summaryDate",
        "work_date",
        "workDate",
      ])
    )

    if (fromDate && (!attendanceDate || attendanceDate < fromDate)) {
      return false
    }

    if (toDate && (!attendanceDate || attendanceDate > toDate)) {
      return false
    }

    if (employeeId) {
      const rowEmployeeId = readNumberFromRow(row, ["employee_id", "employeeId", "id"])
      if (rowEmployeeId === null || String(rowEmployeeId) !== employeeId) {
        return false
      }
    }

    if (organizationId) {
      const rowOrganizationId = readNumberFromRow(row, ["branch_id", "branchId", "organization_id", "organizationId"])
      if (rowOrganizationId === null || String(rowOrganizationId) !== organizationId) {
        return false
      }
    }

    if (status) {
      const rowStatus = (
        readStringFromRow(row, ["attendance_status", "attendanceStatus", "status", "summary_status", "summaryStatus", "state"]) ?? ""
      )
        .trim()
        .toUpperCase()
      if (rowStatus !== status) {
        return false
      }
    }

    if (employeeSearchTerm) {
      const nestedEmployee = readNestedRecord(row, ["employee"])
      const rowEmployeeId = readNumberFromRow(row, ["employee_id", "employeeId", "id"])
      const searchableEmployeeText = [
        readStringFromRow(row, ["employee_name", "employeeName", "full_name", "fullName", "display_name", "displayName", "name"]),
        readStringFromRow(row, ["employee_no", "employeeNo", "employee_number", "employeeNumber", "employee_code", "employeeCode"]),
        nestedEmployee ? getEmployeeOptionLabel(nestedEmployee) : null,
        rowEmployeeId !== null ? String(rowEmployeeId) : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase()

      if (!searchableEmployeeText.includes(employeeSearchTerm)) {
        return false
      }
    }

    return true
  })
}

function enrichRowsWithReadableNames(rows: AdminRecord[], branches: AdminRecord[], employees: AdminRecord[]) {
  const branchNameById = new Map<number, string>()
  const employeeNameById = new Map<number, string>()

  branches.forEach((branch) => {
    const id = readNumberFromRow(branch, ["id", "branch_id"])
    const name = readStringFromRow(branch, ["name", "branch_name", "title"])
    if (id !== null && name) {
      branchNameById.set(id, name)
    }
  })

  employees.forEach((employee) => {
    const id = readNumberFromRow(employee, ["id", "employee_id"])
    const employeeNo = readStringFromRow(employee, ["employee_no", "employee_number", "employee_code"])
    const fullName =
      readStringFromRow(employee, ["full_name", "display_name", "name"]) ??
      [employee.first_name, employee.middle_name, employee.last_name]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
        .trim()
    if (id !== null && fullName) {
      employeeNameById.set(id, employeeNo ? `${fullName} (${employeeNo})` : fullName)
    }
  })

  return rows.map((row) => {
    const next = { ...row }
    const branchId = readNumberFromRow(row, ["branch_id", "branchId"])
    const employeeId = readNumberFromRow(row, ["employee_id", "employeeId"])

    if (!readStringFromRow(next, ["branch_name", "branchName"]) && branchId !== null) {
      const branchName = branchNameById.get(branchId)
      if (branchName) {
        next.branch_name = branchName
      }
    }

    if (!readStringFromRow(next, ["employee_name", "employeeName"]) && employeeId !== null) {
      const employeeName = employeeNameById.get(employeeId)
      if (employeeName) {
        next.employee_name = employeeName
      }
    }

    const nestedEmployee = readNestedRecord(row, ["employee"])
    if (!readStringFromRow(next, ["employee_name", "employeeName"]) && nestedEmployee) {
      const nestedEmployeeNo = readStringFromRow(nestedEmployee, ["employee_no", "employeeNo"])
      const nestedEmployeeName =
        readStringFromRow(nestedEmployee, ["full_name", "fullName", "display_name", "displayName", "name"]) ??
        [
          readStringFromRow(nestedEmployee, ["first_name", "firstName", "preferred_name", "preferredName"]),
          readStringFromRow(nestedEmployee, ["middle_name", "middleName"]),
          readStringFromRow(nestedEmployee, ["last_name", "lastName"]),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()

      if (nestedEmployeeName) {
        next.employee_name = nestedEmployeeNo ? `${nestedEmployeeName} (${nestedEmployeeNo})` : nestedEmployeeName
      }
    }

    if (!readStringFromRow(next, ["attendance_date"]) ) {
      const attendanceDate = readStringFromRow(row, [
        "attendance_date",
        "attendanceDate",
        "date",
        "summary_date",
        "summaryDate",
        "work_date",
        "workDate",
      ])
      if (attendanceDate) {
        next.attendance_date = attendanceDate
      }
    }

    if (!readStringFromRow(next, ["timetable_used"])) {
      const timetableUsed = readStringFromRow(row, [
        "timetable_used",
        "timetableUsed",
        "timetable_name",
        "timetableName",
        "timetable_used_name",
        "timetableUsedName",
        "shift_name",
        "shiftName",
        "schedule_name",
        "scheduleName",
        "schedule_source",
        "scheduleSource",
      ])
      if (timetableUsed) {
        next.timetable_used = timetableUsed
      }
    }

    if (!readStringFromRow(next, ["attendance_status"])) {
      const attendanceStatus = readStringFromRow(row, [
        "attendance_status",
        "attendanceStatus",
        "status",
        "summary_status",
        "summaryStatus",
        "state",
      ])
      if (attendanceStatus) {
        next.attendance_status = attendanceStatus
      }
    }

    if (!readStringFromRow(next, ["check_in_time"])) {
      const checkInTime = readStringFromRow(row, [
        "check_in_time",
        "checkInTime",
        "check_in_at",
        "checkInAt",
        "first_check_in_at",
        "firstCheckInAt",
        "first_punch_at",
        "firstPunchAt",
        "clock_in_at",
        "clockInAt",
        "expected_check_in_time",
        "expectedCheckInTime",
      ])
      if (checkInTime) {
        next.check_in_time = checkInTime
      }
    }

    if (!readStringFromRow(next, ["check_out_time"])) {
      const checkOutTime = readStringFromRow(row, [
        "check_out_time",
        "checkOutTime",
        "check_out_at",
        "checkOutAt",
        "last_check_out_at",
        "lastCheckOutAt",
        "last_punch_at",
        "lastPunchAt",
        "clock_out_at",
        "clockOutAt",
        "expected_check_out_time",
        "expectedCheckOutTime",
      ])
      if (checkOutTime) {
        next.check_out_time = checkOutTime
      }
    }

    return next
  })
}

function resolveVisibleColumns(rows: AdminRecord[], section: AttendanceActivitySectionKey) {
  const preferred =
    section === "daily-summaries"
      ? [
          "employee_name",
          "branch_name",
          "attendance_date",
          "attendance_status",
          "timetable_used",
          "check_in_time",
          "check_out_time",
        ]
      : section === "attendance-history"
      ? [
          "attendanceDate",
          "attendanceStatus",
          "checkInAt",
          "checkOutAt",
          "workMinutes",
          "remarks",
        ]
      : section === "schedule-preview"
      ? [
          "date",
          "shift",
          "time_range",
          "expected_work",
          "is_off_day",
        ]
      : [
          "id",
          "employee_name",
          "employee_no",
          "employee_id",
          "date",
          "attendance_date",
          "punch_type",
          "status",
          "attendance_status",
          "branch_name",
          "branch_id",
          "job_status",
          "created_at",
          "updated_at",
          "start_date",
          "end_date",
          "shift_name",
          "schedule_date",
        ]
  const keySet = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keySet.add(key)))
  if (section === "daily-summaries") {
    return preferred
  }
  if (section === "attendance-history") {
    return preferred
  }
  if (section === "schedule-preview") {
    return preferred
  }
  const ordered = preferred.filter((key) => {
    if (!keySet.has(key)) {
      return false
    }
    if (key === "branch_id" && keySet.has("branch_name")) {
      return false
    }
    if (key === "employee_id" && keySet.has("employee_name")) {
      return false
    }
    return true
  })
  const extras = Array.from(keySet).filter((key) => !ordered.includes(key)).sort((a, b) => a.localeCompare(b))
  const limit = 8
  return [...ordered, ...extras].slice(0, limit)
}

function resolveDailySummaryCellValue(column: string, row: AdminRecord): React.ReactNode {
  const nestedEmployee = readNestedRecord(row, ["employee"])
  if (column === "employee_name") {
    const nestedEmployeeFullName =
      [
        readFirstValue(nestedEmployee, ["first_name", "firstName"]),
        readFirstValue(nestedEmployee, ["middle_name", "middleName"]),
        readFirstValue(nestedEmployee, ["last_name", "lastName"]),
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || null

    return (
      readFirstValue(row, ["employee_name", "employeeName", "full_name", "fullName", "display_name", "displayName", "name"]) ??
      readFirstValue(nestedEmployee, [
        "full_name",
        "fullName",
        "display_name",
        "displayName",
        "name",
        "preferred_name",
        "preferredName",
      ]) ??
      nestedEmployeeFullName
    )
  }
  if (column === "branch_name") {
    return readFirstValue(row, ["branch_name", "branchName", "branch", "location_name", "locationName", "site_name", "siteName"])
  }
  if (column === "attendance_date") {
    return readFirstValue(row, ["attendance_date", "attendanceDate", "date", "summary_date", "summaryDate", "work_date", "workDate"])
  }
  if (column === "attendance_status") {
    return readFirstValue(row, ["attendance_status", "attendanceStatus", "status", "summary_status", "summaryStatus", "state"])
  }
  if (column === "timetable_used") {
    return readFirstValue(row, [
      "timetable_used",
      "timetableUsed",
      "timetable_name",
      "timetableName",
      "timetable_used_name",
      "timetableUsedName",
      "shift_name",
      "shiftName",
      "schedule_name",
      "scheduleName",
      "schedule_source",
      "scheduleSource",
      "timetable",
    ])
  }
  if (column === "check_in_time") {
    return readFirstValue(row, [
      "check_in_time",
      "checkInTime",
      "check_in_at",
      "checkInAt",
      "first_check_in_at",
      "firstCheckInAt",
      "first_punch_at",
      "firstPunchAt",
      "clock_in_at",
      "clockInAt",
      "expected_check_in_time",
      "expectedCheckInTime",
    ])
  }
  if (column === "check_out_time") {
    return readFirstValue(row, [
      "check_out_time",
      "checkOutTime",
      "check_out_at",
      "checkOutAt",
      "last_check_out_at",
      "lastCheckOutAt",
      "last_punch_at",
      "lastPunchAt",
      "clock_out_at",
      "clockOutAt",
      "expected_check_out_time",
      "expectedCheckOutTime",
    ])
  }
  return stringifyValue(row[column])
}

function resolveTableCellValue(section: AttendanceActivitySectionKey, column: string, row: AdminRecord): React.ReactNode {
  if (section === "daily-summaries") {
    return resolveDailySummaryCellValue(column, row)
  }
  if (section === "attendance-history") {
    if (column === "attendanceDate" || column === "attendance_date") {
      const val = readFirstValue(row, ["attendanceDate", "attendance_date", "date"])
      if (!val) return "—"
      return formatDisplayDate(val)
    }
    if (column === "attendanceStatus" || column === "attendance_status") {
      const status = readFirstValue(row, ["attendanceStatus", "attendance_status", "status"]) || "-"
      const tone = statusTone(status)
      // color only, no chip/pill
      const textClass = tone.badge.split(" ").find(c => c.startsWith("text-")) || "text-foreground"
      return <span className={`text-xs font-medium ${textClass}`}>{status}</span>
    }
    if (column === "checkInAt" || column === "check_in_at") {
      const val = readFirstValue(row, ["checkInAt", "check_in_at", "checkInTime"])
      if (!val) return "—"
      try {
        const d = new Date(val)
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } catch {
        return formatDisplayTime(val) || val
      }
    }
    if (column === "checkOutAt" || column === "check_out_at") {
      const val = readFirstValue(row, ["checkOutAt", "check_out_at", "checkOutTime"])
      if (!val) return "—"
      try {
        const d = new Date(val)
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } catch {
        return formatDisplayTime(val) || val
      }
    }
    if (column === "workMinutes") {
      const mins = readFirstValue(row, ["workMinutes", "work_minutes", "workedMinutes"])
      if (mins == null || mins === "-") return "—"
      const m = Number(mins)
      if (!Number.isFinite(m)) return mins
      const h = Math.floor(m / 60)
      const mm = m % 60
      return `${h}h ${mm.toString().padStart(2, "0")}m`
    }
    if (column === "remarks") {
      const r = row.remarks || row.remarksList || row.remarks
      if (Array.isArray(r)) {
        const userRemarks = r.filter((x: string) => typeof x === "string" && !x.includes("AFTER_MINUTES") && !x.includes("POLICY"))
        return userRemarks.length ? userRemarks.join(", ") : "—"
      }
      return stringifyValue(r) || "—"
    }
    return stringifyValue(row[column]) || "—"
  }
  if (section === "schedule-preview") {
    if (column === "date") {
      const val = readFirstValue(row, ["date"])
      return val ? formatDisplayDate(val) : "—"
    }
    if (column === "shift") {
      const shift = row.shift as { name?: string } | undefined
      if (row.is_off_day) return "Off Day"
      return shift?.name || "—"
    }
    if (column === "time_range") {
      const shift = row.shift as { start_time?: string; end_time?: string } | undefined
      if (!shift || row.is_off_day) return "—"
      return `${shift.start_time || ""} - ${shift.end_time || ""}`
    }
    if (column === "expected_work") {
      const shift = row.shift as { expected_work_minutes?: number } | undefined
      const mins = shift?.expected_work_minutes || readFirstValue(row, ["expected_work_minutes"])
      if (!mins) return "—"
      const m = Number(mins)
      if (!Number.isFinite(m)) return mins
      const h = Math.floor(m / 60)
      const mm = m % 60
      return `${h}h ${mm.toString().padStart(2, "0")}m`
    }
    if (column === "is_off_day") {
      return row.is_off_day 
        ? <span className="text-xs text-muted-foreground">Off</span> 
        : <span className="text-xs">Work</span>
    }
    return stringifyValue(row[column]) || "—"
  }
  return stringifyValue(row[column])
}

function asNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    throw new Error("Please enter a valid number.")
  }
  return parsed
}

function buildRecalculatePayload(values: Record<string, string>) {
  if (!values.start_date.trim() || !values.end_date.trim()) {
    throw new Error("Start date and end date are required.")
  }

  return {
    start_date: values.start_date.trim(),
    end_date: values.end_date.trim(),
    employee_id: asNumber(values.employee_id),
    force_rebuild: values.force_rebuild === "true",
    reason: values.reason.trim() || undefined,
    async: values.async === "true",
  }
}

function buildRangePayload(values: Record<string, string>) {
  if (!values.start_date.trim() || !values.end_date.trim()) {
    throw new Error("Start date and end date are required.")
  }

  return {
    start_date: values.start_date.trim(),
    end_date: values.end_date.trim(),
    employee_id: asNumber(values.employee_id),
    rebuild_summaries: values.rebuild_summaries === "true",
    force_rebuild_summaries: values.force_rebuild_summaries === "true",
    batch_size: asNumber(values.batch_size) ?? 500,
  }
}

function TableBlock({
  rows,
  section,
}: {
  rows: AdminRecord[]
  section: AttendanceActivitySectionKey
}) {
  const columns = React.useMemo(() => resolveVisibleColumns(rows, section), [rows, section])

  return (
    <div className="border border-border bg-card">
      <TableScrollContainer className="!rounded-none !border-0 !bg-transparent !shadow-none !p-0">
        <table className="w-full min-w-[720px] text-left text-sm md:min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-muted">
              {columns.map((column) => (
                <th 
                  key={column} 
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[1.2px] whitespace-nowrap text-left text-muted-foreground"
                >
                  {prettifyLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground [&_tr:nth-child(even)]:bg-muted/10">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No attendance records found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr 
                  key={`row-${index}`} 
                  className="align-middle hover:bg-muted/30 transition-colors"
                >
                  {columns.map((column) => (
                    <td 
                      key={column} 
                      className="px-4 py-3.5 text-sm break-words whitespace-normal align-middle text-foreground/90"
                    >
                      {resolveTableCellValue(section, column, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  )
}

export function AttendanceActivityView({ section }: { section: string }) {
  const activeSection = React.useMemo(() => resolveSection(section), [section])
  const config = React.useMemo(() => SECTION_CONFIG[activeSection], [activeSection])
  const lastFetchKeyRef = React.useRef<string | null>(null)
  const lastFetchAtRef = React.useRef(0)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [dailySummaryRows, setDailySummaryRows] = React.useState<AdminRecord[]>([])
  const [singleRecord, setSingleRecord] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [employeeSearch, setEmployeeSearch] = React.useState("")
  const [dailySummaryFilters, setDailySummaryFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      organization_id: "",
      status: "",
    }
  })
  const [appliedDailySummaryFilters, setAppliedDailySummaryFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      organization_id: "",
      status: "",
    }
  })
  const [hasAppliedDailySummaryFilters, setHasAppliedDailySummaryFilters] = React.useState(false)
  const [historyFilters, setHistoryFilters] = React.useState<Record<string, string>>(() => ({
    from_date: "",
    to_date: "",
  }))
  const filteredEmployeeOptions = React.useMemo(() => {
    const search = employeeSearch.trim().toLowerCase()
    if (!search) {
      return employees
    }

    return employees.filter((employee) =>
      getEmployeeOptionLabel(employee).toLowerCase().includes(search)
    )
  }, [employeeSearch, employees])
  const [recalculateValues, setRecalculateValues] = React.useState<Record<string, string>>({
    start_date: "",
    end_date: "",
    employee_id: "",
    reason: "",
    force_rebuild: "true",
    async: "true",
  })
  const [rangeValues, setRangeValues] = React.useState<Record<string, string>>({
    start_date: "",
    end_date: "",
    employee_id: "",
    rebuild_summaries: "true",
    force_rebuild_summaries: "false",
    batch_size: "500",
  })

  React.useEffect(() => {
    if (activeSection !== "daily-summaries") {
      return
    }

    const token = readStoredToken()
    if (!token) {
      return
    }

    let isActive = true

    const loadDailySummarySupportData = async () => {
      try {
        const [branchesResult, employeesResult] = await Promise.all([
          listBranches(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }),
          listEmployees(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }),
        ])

        if (!isActive) {
          return
        }

        setBranches(branchesResult.rows)
        setEmployees(employeesResult.rows)
      } catch {
        if (!isActive) {
          return
        }
      }
    }

    void loadDailySummarySupportData()

    return () => {
      isActive = false
    }
  }, [activeSection])

  const fetchSectionData = React.useCallback(async (force = false) => {
    const token = readStoredToken()
    if (!token) {
      setRows([])
      setSingleRecord(null)
      setError("Authentication required. Please log in again.")
      return
    }

    const requestKey = JSON.stringify({
      activeSection,
      historyFilters,
      dailySummaryFilters: appliedDailySummaryFilters,
    })

    if (!force) {
      const now = Date.now()
      if (lastFetchKeyRef.current === requestKey && now - lastFetchAtRef.current < 1500) {
        return
      }
      lastFetchKeyRef.current = requestKey
      lastFetchAtRef.current = now
    }

    setLoading(true)
    setError(null)
    try {
      if (activeSection === "today") {
        const payload = await getMyAttendanceToday(token)
        setDailySummaryRows([])
        setSingleRecord(payload)
        setRows([])
        return
      }

      if (activeSection === "schedule-preview") {
        const payload: any = await getMyAttendanceSchedule(token)
        const days = Array.isArray(payload) ? payload : (payload?.days || [])
        setDailySummaryRows([])
        setRows(days)
        setSingleRecord(null)
        return
      }

      if (activeSection === "punch-history") {
        const result = await listMyAttendancePunches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setDailySummaryRows([])
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      if (activeSection === "attendance-history") {
        const result = await listMyAttendanceHistory(token, { 
          page: 1, 
          limit: 100, 
          sortBy: "created_at", 
          sortOrder: "DESC",
          from_date: historyFilters.from_date || undefined,
          to_date: historyFilters.to_date || undefined,
        })
        setDailySummaryRows([])
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      if (activeSection === "daily-summaries") {
        if (!hasAppliedDailySummaryFilters) {
          setDailySummaryRows([])
          setRows([])
          setSingleRecord(null)
          return
        }

        const result = await listAttendanceDailySummaries(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          from_date: appliedDailySummaryFilters.from_date || undefined,
          to_date: appliedDailySummaryFilters.to_date || undefined,
          employee_id: appliedDailySummaryFilters.employee_id ? Number(appliedDailySummaryFilters.employee_id) : undefined,
          organization_id: appliedDailySummaryFilters.organization_id ? Number(appliedDailySummaryFilters.organization_id) : undefined,
          status: appliedDailySummaryFilters.status || undefined,
        })
        const enrichedRows = enrichRowsWithReadableNames(result.rows, branches, employees)
        setDailySummaryRows(enrichedRows)
        setRows(applyDailySummaryFilters(enrichedRows, appliedDailySummaryFilters, ""))
        setSingleRecord(null)
        return
      }

      if (activeSection === "recalculation-jobs") {
        const result = await listAttendanceProcessingJobs(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setDailySummaryRows([])
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      if (activeSection === "unmatched-logs") {
        const result = await listAttendanceUnmatchedLogs(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setDailySummaryRows([])
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      setDailySummaryRows([])
      setRows([])
      setSingleRecord(null)
    } catch (errorObject) {
      setDailySummaryRows([])
      setRows([])
      setSingleRecord(null)
      setError(formatLoadError(errorObject, `Failed to load ${config.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [activeSection, appliedDailySummaryFilters, branches, config.title, employees, hasAppliedDailySummaryFilters, historyFilters])

  React.useEffect(() => {
    void fetchSectionData()
  }, [fetchSectionData])

  React.useEffect(() => {
    if (activeSection !== "daily-summaries") {
      return
    }
    setRows(applyDailySummaryFilters(dailySummaryRows, appliedDailySummaryFilters, employeeSearch))
  }, [activeSection, appliedDailySummaryFilters, dailySummaryRows, employeeSearch])

  const runPendingJobs = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    try {
      await runPendingAttendanceProcessingJobs(token)
      setMessage("Pending recalculation jobs started successfully.")
      setError(null)
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not run pending jobs."))
    }
  }

  const queueRecalculation = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    try {
      await rebuildAttendanceDailySummaries(token, buildRecalculatePayload(recalculateValues))
      setMessage("Attendance summary rebuild started successfully.")
      setError(null)
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not start the attendance summary rebuild."))
    }
  }

  const runRange = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    try {
      await processAttendanceRange(token, buildRangePayload(rangeValues))
      setMessage("Attendance range processing started successfully.")
      setError(null)
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not process this attendance range."))
    }
  }

  if (activeSection === 'punch-action') {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        Punch actions are only available in the mobile app.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {config.groupTitle}
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{config.title}</h1>
          </div>
          <div className="flex items-center gap-1">
            {activeSection === "attendance-history" && (
              <Popover>
                <PopoverTrigger>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted"
                    type="button"
                    aria-label="Filter by date"
                  >
                    <Filter className="size-3.5 text-primary" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-foreground">Filter by date range</div>
                    <div className="grid gap-3">
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-slate-700">From date</span>
                        <DatePickerPresets
                          value={historyFilters.from_date}
                          onChange={(value) => setHistoryFilters((current) => ({ ...current, from_date: value }))}
                          placeholder="From date"
                          className="h-8 text-xs"
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-slate-700">To date</span>
                        <DatePickerPresets
                          value={historyFilters.to_date}
                          onChange={(value) => setHistoryFilters((current) => ({ ...current, to_date: value }))}
                          placeholder="To date"
                          className="h-8 text-xs"
                        />
                      </label>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <button
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted"
              type="button"
              onClick={() => {
                setMessage(null)
                void fetchSectionData(true)
              }}
            >
              <RefreshCwIcon className="size-3.5 text-primary" />
            </button>
          </div>
        </div>
      </div>

      <div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}

        {loading ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {activeSection === "daily-summaries" && rows.length ? "Updating results…" : "Loading…"}
          </p>
        ) : null}

        {!loading && activeSection === "today" ? <TodayOverview record={singleRecord} /> : null}

        {activeSection === "daily-summaries" ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-slate-900">Filters</h2>
                </div>
                <label className="relative block w-full lg:max-w-sm">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Search employee by name, number, or ID"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">From date</span>
                    <DatePickerPresets
                      value={dailySummaryFilters.from_date}
                      onChange={(value) => setDailySummaryFilters((current) => ({ ...current, from_date: value }))}
                      placeholder="From date"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">To date</span>
                    <DatePickerPresets
                      value={dailySummaryFilters.to_date}
                      onChange={(value) => setDailySummaryFilters((current) => ({ ...current, to_date: value }))}
                      placeholder="To date"
                    />
                  </label>
                </div>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <label className="grid gap-1 text-sm lg:max-w-md">
                    <span className="font-medium text-slate-700">Employee</span>
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      value={dailySummaryFilters.employee_id}
                      onChange={(event) => setDailySummaryFilters((current) => ({ ...current, employee_id: event.target.value }))}
                    >
                      <option value="">All employees</option>
                      {filteredEmployeeOptions.map((employee, index) => {
                        const employeeId = readNumberFromRow(employee, ["id", "employee_id", "employeeId"])
                        if (employeeId === null) return null
                        return (
                          <option key={`attendance-employee-${employeeId}-${index}`} value={String(employeeId)}>
                            {getEmployeeOptionLabel(employee)}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Organization</span>
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      value={dailySummaryFilters.organization_id}
                      onChange={(event) => setDailySummaryFilters((current) => ({ ...current, organization_id: event.target.value }))}
                    >
                      <option value="">All organizations</option>
                      {branches.map((branch, index) => {
                        const branchId = readNumberFromRow(branch, ["id", "branch_id", "branchId"])
                        if (branchId === null) return null
                        return (
                          <option key={`attendance-branch-${branchId}-${index}`} value={String(branchId)}>
                            {getBranchOptionLabel(branch)}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Status</span>
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      value={dailySummaryFilters.status}
                      onChange={(event) => setDailySummaryFilters((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="">All statuses</option>
                      {DAILY_SUMMARY_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {prettifyLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-3 md:self-end">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setHasAppliedDailySummaryFilters(true)
                        setAppliedDailySummaryFilters({ ...dailySummaryFilters })
                        setMessage(null)
                        setError(null)
                      }}
                    >
                      Apply Filters
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      type="button"
                      onClick={() => {
                        const today = getTodayDateInputValue()
                        const resetFilters = {
                          from_date: today,
                          to_date: today,
                          employee_id: "",
                          organization_id: "",
                          status: "",
                        }
                        setEmployeeSearch("")
                        setDailySummaryFilters(resetFilters)
                        setAppliedDailySummaryFilters(resetFilters)
                        setHasAppliedDailySummaryFilters(false)
                        setDailySummaryRows([])
                        setRows([])
                        setError(null)
                        setMessage(null)
                      }}
                    >
                      Reset To Today
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-3">
                <p className="text-xs text-slate-500">
                  Update the fields you need, then click Apply Filters to refresh results.
                </p>
                {!hasAppliedDailySummaryFilters ? (
                  <p className="text-xs text-slate-500">
                    Daily summaries are loaded only after you apply filters.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Date filter is now in the popover next to refresh icon for attendance-history */}

        {/* Punch Action is only available in the native mobile app (iOS/Android). No content shown in browser. */}

        {!loading && activeSection === "recalculation-jobs" ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800" type="button" onClick={() => void runPendingJobs()}>
                Run Pending Jobs
              </button>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-base font-semibold text-slate-900">Rebuild Daily Summaries</h2>
                <div className="mt-4 grid gap-3">
                  <DatePickerPresets value={recalculateValues.start_date} onChange={(value) => setRecalculateValues((current) => ({ ...current, start_date: value }))} placeholder="Start date" />
                  <DatePickerPresets value={recalculateValues.end_date} onChange={(value) => setRecalculateValues((current) => ({ ...current, end_date: value }))} placeholder="End date" />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Employee Id (optional)" value={recalculateValues.employee_id} onChange={(event) => setRecalculateValues((current) => ({ ...current, employee_id: event.target.value }))} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason" value={recalculateValues.reason} onChange={(event) => setRecalculateValues((current) => ({ ...current, reason: event.target.value }))} />
                  <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={recalculateValues.force_rebuild} onChange={(event) => setRecalculateValues((current) => ({ ...current, force_rebuild: event.target.value }))}>
                    <option value="true">Force rebuild existing summaries</option>
                    <option value="false">Upsert without clearing</option>
                  </select>
                  <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={recalculateValues.async} onChange={(event) => setRecalculateValues((current) => ({ ...current, async: event.target.value }))}>
                    <option value="true">Queue in background</option>
                    <option value="false">Run synchronously</option>
                  </select>
                  <button className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button" onClick={() => void queueRecalculation()}>
                    Rebuild Daily Summaries
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-base font-semibold text-slate-900">Process Attendance Range</h2>
                <div className="mt-4 grid gap-3">
                  <DatePickerPresets value={rangeValues.start_date} onChange={(value) => setRangeValues((current) => ({ ...current, start_date: value }))} placeholder="Start date" />
                  <DatePickerPresets value={rangeValues.end_date} onChange={(value) => setRangeValues((current) => ({ ...current, end_date: value }))} placeholder="End date" />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Employee Id (optional)" value={rangeValues.employee_id} onChange={(event) => setRangeValues((current) => ({ ...current, employee_id: event.target.value }))} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Batch size" value={rangeValues.batch_size} onChange={(event) => setRangeValues((current) => ({ ...current, batch_size: event.target.value }))} />
                  <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={rangeValues.rebuild_summaries} onChange={(event) => setRangeValues((current) => ({ ...current, rebuild_summaries: event.target.value }))}>
                    <option value="true">Rebuild summaries</option>
                    <option value="false">Keep current summaries</option>
                  </select>
                  <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={rangeValues.force_rebuild_summaries} onChange={(event) => setRangeValues((current) => ({ ...current, force_rebuild_summaries: event.target.value }))}>
                    <option value="false">Normal rebuild</option>
                    <option value="true">Force rebuild</option>
                  </select>
                  <button className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button" onClick={() => void runRange()}>
                    Process Range
                  </button>
                </div>
              </div>
            </div>
            <TableBlock rows={rows} section={activeSection} />
          </div>
        ) : null}

        {((activeSection === "daily-summaries" || !loading) &&
          activeSection !== "today" &&
          activeSection !== "recalculation-jobs") ? (
          <div className="mt-6">
            <TableBlock rows={rows} section={activeSection} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
