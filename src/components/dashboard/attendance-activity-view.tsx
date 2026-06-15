"use client"

import * as React from "react"
import {
  AlarmClockCheckIcon,
  CalendarDaysIcon,
  Clock3Icon,
  MapPinIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TimerResetIcon,
} from "lucide-react"

import { TableScrollContainer } from "@/components/common/table-scroll-container"
import {
  createAttendanceMobilePunchCheckIn,
  createAttendanceMobilePunchCheckOut,
  getMyAttendanceSchedule,
  getMyAttendanceToday,
  listAttendanceDailySummaries,
  listAttendanceGeofences,
  listAttendanceProcessingJobs,
  listAttendanceUnmatchedLogs,
  listAttendanceWifiNetworks,
  listBranches,
  listEmployees,
  listMyAttendanceHistory,
  listMyAttendancePunches,
  processAttendanceRange,
  queueAttendanceRecalculation,
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
    groupTitle: "Employee Attendance",
    description: "See your current attendance state for today.",
  },
  "punch-action": {
    title: "Punch Action",
    groupTitle: "Employee Attendance",
    description: "Submit a mobile check-in or check-out using your current location and optional network details.",
  },
  "punch-history": {
    title: "Punch History",
    groupTitle: "Employee Attendance",
    description: "Review your recorded punch events.",
  },
  "attendance-history": {
    title: "Attendance History",
    groupTitle: "Employee Attendance",
    description: "Review your attendance history records.",
  },
  "schedule-preview": {
    title: "Schedule Preview",
    groupTitle: "Employee Attendance",
    description: "Preview the schedule entries currently available for you.",
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

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") return value.trim() || "-"
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "-"
  if (typeof value === "object") return JSON.stringify(value)
  return "-"
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
      <div className="mt-6 rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <CalendarDaysIcon className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">No attendance summary yet</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your attendance data for today has not been published yet. Refresh again in a moment.
        </p>
      </div>
    )
  }

  const status =
    readFirstValue(record, ["attendance_status", "status", "summary_status", "state"]) ?? "Pending"
  const scheduleStart =
    readFirstValue(record, ["schedule_start_at", "schedule_start_time", "shift_start_at", "start_time"]) ?? "Not set"
  const scheduleEnd =
    readFirstValue(record, ["schedule_end_at", "schedule_end_time", "shift_end_at", "end_time"]) ?? "Not set"
  const firstPunch =
    readFirstValue(record, ["first_check_in_at", "first_punch_at", "check_in_at", "clock_in_at"]) ?? "Not recorded"
  const lastPunch =
    readFirstValue(record, ["last_check_out_at", "last_punch_at", "check_out_at", "clock_out_at"]) ?? "Not recorded"
  const workedHours =
    readFirstValue(record, ["worked_hours", "worked_duration", "total_worked_hours", "hours_worked"]) ?? "Still calculating"
  const branch =
    readFirstValue(record, ["branch_name", "branch", "location_name", "site_name"]) ?? "Assigned branch"
  const shift =
    readFirstValue(record, ["shift_name", "schedule_name", "timetable_name"]) ?? "Daily schedule"
  const lateness =
    readFirstValue(record, ["late_minutes", "lateness_minutes", "minutes_late"]) ?? "0"
  const overtime =
    readFirstValue(record, ["overtime_minutes", "overtime_hours", "extra_time"]) ?? "0"

  const tone = statusTone(status)
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
  ])

  const extraEntries = Object.entries(record).filter(
    ([key, value]) => !hiddenKeys.has(key) && value !== null && value !== undefined && stringifyValue(value) !== "-"
  )
  const compactExtraEntries = extraEntries.slice(0, 6)

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.95fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                {shift}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Your day at a glance</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                A simple snapshot of today’s attendance progress, expected schedule, and anything that still needs your attention.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock3Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Start</span>
                </div>
                <p className="mt-2.5 text-base font-semibold text-slate-900">{scheduleStart}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="flex items-center gap-2 text-slate-500">
                  <TimerResetIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">End</span>
                </div>
                <p className="mt-2.5 text-base font-semibold text-slate-900">{scheduleEnd}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="flex items-center gap-2 text-slate-500">
                  <AlarmClockCheckIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Worked</span>
                </div>
                <p className="mt-2.5 text-base font-semibold text-slate-900">{workedHours}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                <div className="flex items-center gap-2 text-slate-500">
                  <MapPinIcon className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Branch</span>
                </div>
                <p className="mt-2.5 text-base font-semibold text-slate-900">{branch}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${tone.panel}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Today&apos;s pulse</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/70 bg-white/80 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">First punch</p>
                <p className="mt-2 break-words text-base font-semibold text-slate-900">{firstPunch}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/80 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Last punch</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{lastPunch}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/80 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Late by</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{lateness}</p>
              </div>
              <div className="rounded-xl border border-white/70 bg-white/80 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Overtime</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{overtime}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {compactExtraEntries.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Extra details</h3>
              <p className="text-sm text-slate-600">More attendance fields returned by the system for today.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {compactExtraEntries.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {prettifyLabel(key)}
                </p>
                <p className="mt-1.5 truncate text-sm font-medium text-slate-800" title={stringifyValue(value)}>
                  {stringifyValue(value)}
                </p>
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

    return next
  })
}

function resolveVisibleColumns(rows: AdminRecord[]) {
  const preferred = [
    "id",
    "employee_name",
    "employee_no",
    "employee_id",
    "employee_no",
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
  return [...ordered, ...extras].slice(0, 8)
}

function asNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    throw new Error("Please enter a valid number.")
  }
  return parsed
}

function buildPunchPayload(values: Record<string, string>) {
  const latitude = asNumber(values.latitude)
  const longitude = asNumber(values.longitude)
  if (latitude === undefined || longitude === undefined) {
    throw new Error("Latitude and longitude are required.")
  }

  return {
    latitude,
    longitude,
    employeeId: asNumber(values.employeeId),
    geofenceId: asNumber(values.geofenceId),
    wifiNetworkId: asNumber(values.wifiNetworkId),
    accuracyMeters: asNumber(values.accuracyMeters),
    wifiSsid: values.wifiSsid.trim() || undefined,
    wifiBssid: values.wifiBssid.trim() || undefined,
    ipAddress: values.ipAddress.trim() || undefined,
    deviceIdentifier: values.deviceIdentifier.trim() || undefined,
    overrideReason: values.overrideReason.trim() || undefined,
  }
}

function buildRecalculatePayload(values: Record<string, string>) {
  if (!values.start_date.trim() || !values.end_date.trim()) {
    throw new Error("Start date and end date are required.")
  }

  return {
    start_date: values.start_date.trim(),
    end_date: values.end_date.trim(),
    employee_id: asNumber(values.employee_id),
    reason: values.reason.trim() || undefined,
    process_immediately: values.process_immediately === "true",
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

function TableBlock({ rows }: { rows: AdminRecord[] }) {
  const columns = React.useMemo(() => resolveVisibleColumns(rows), [rows])

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50/90 text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3.5 text-xs font-semibold uppercase tracking-[0.08em] whitespace-nowrap">
                {prettifyLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white [&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr]:transition-colors [&_tr]:hover:bg-slate-50">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-slate-500">
                No records found yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`row-${index}`} className="align-top">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-4 text-slate-700 whitespace-nowrap">
                    {stringifyValue(row[column])}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableScrollContainer>
  )
}

export function AttendanceActivityView({ section }: { section: string }) {
  const activeSection = React.useMemo(() => resolveSection(section), [section])
  const config = React.useMemo(() => SECTION_CONFIG[activeSection], [activeSection])

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [singleRecord, setSingleRecord] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [geofences, setGeofences] = React.useState<AdminRecord[]>([])
  const [wifiNetworks, setWifiNetworks] = React.useState<AdminRecord[]>([])
  const [punchValues, setPunchValues] = React.useState<Record<string, string>>({
    employeeId: "",
    geofenceId: "",
    wifiNetworkId: "",
    latitude: "",
    longitude: "",
    accuracyMeters: "",
    wifiSsid: "",
    wifiBssid: "",
    ipAddress: "",
    deviceIdentifier: "",
    overrideReason: "",
  })
  const [recalculateValues, setRecalculateValues] = React.useState<Record<string, string>>({
    start_date: "",
    end_date: "",
    employee_id: "",
    reason: "",
    process_immediately: "true",
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
    const needsLookups = activeSection === "punch-action"
    if (!needsLookups) {
      return
    }
    const token = readStoredToken()
    if (!token) {
      return
    }

    let cancelled = false
    const loadLookups = async () => {
      try {
        const [geofencesResult, wifiResult] = await Promise.all([
          listAttendanceGeofences(token, { page: 1, limit: 100 }),
          listAttendanceWifiNetworks(token, { page: 1, limit: 100 }),
        ])
        if (cancelled) return
        setGeofences(geofencesResult.rows)
        setWifiNetworks(wifiResult.rows)
      } catch {
        if (cancelled) return
        setGeofences([])
        setWifiNetworks([])
      }
    }
    void loadLookups()
    return () => {
      cancelled = true
    }
  }, [activeSection])

  const fetchSectionData = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setRows([])
      setSingleRecord(null)
      setError("Authentication required. Please log in again.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (activeSection === "today") {
        const payload = await getMyAttendanceToday(token)
        setSingleRecord(payload)
        setRows([])
        return
      }

      if (activeSection === "schedule-preview") {
        const payload = await getMyAttendanceSchedule(token)
        setRows(Array.isArray(payload) ? payload : [])
        setSingleRecord(null)
        return
      }

      if (activeSection === "punch-history") {
        const result = await listMyAttendancePunches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      if (activeSection === "attendance-history") {
        const result = await listMyAttendanceHistory(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      if (activeSection === "daily-summaries") {
        const [result, branchesResult, employeesResult] = await Promise.all([
          listAttendanceDailySummaries(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
          listBranches(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }),
          listEmployees(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }),
        ])
        setRows(enrichRowsWithReadableNames(result.rows, branchesResult.rows, employeesResult.rows))
        setSingleRecord(null)
        return
      }

      if (activeSection === "recalculation-jobs") {
        const result = await listAttendanceProcessingJobs(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      if (activeSection === "unmatched-logs") {
        const result = await listAttendanceUnmatchedLogs(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setRows(result.rows)
        setSingleRecord(null)
        return
      }

      setRows([])
      setSingleRecord(null)
    } catch (errorObject) {
      setRows([])
      setSingleRecord(null)
      setError(formatLoadError(errorObject, `Failed to load ${config.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [activeSection, config.title])

  React.useEffect(() => {
    void fetchSectionData()
  }, [fetchSectionData])

  const submitPunch = async (kind: "check-in" | "check-out") => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    try {
      const payload = buildPunchPayload(punchValues)
      if (kind === "check-in") {
        await createAttendanceMobilePunchCheckIn(token, payload)
        setMessage("Check-in submitted successfully.")
      } else {
        await createAttendanceMobilePunchCheckOut(token, payload)
        setMessage("Check-out submitted successfully.")
      }
      setError(null)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not submit this punch action."))
    }
  }

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
      await fetchSectionData()
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
      await queueAttendanceRecalculation(token, buildRecalculatePayload(recalculateValues))
      setMessage("Attendance recalculation queued successfully.")
      setError(null)
      await fetchSectionData()
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not queue attendance recalculation."))
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
      await fetchSectionData()
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not process this attendance range."))
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {config.groupTitle}
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{config.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">{config.description}</p>
            </div>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={() => {
              setMessage(null)
              void fetchSectionData()
            }}
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}

        {loading ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}

        {!loading && activeSection === "today" ? <TodayOverview record={singleRecord} /> : null}

        {!loading && activeSection === "punch-action" ? (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Latitude</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.latitude} onChange={(event) => setPunchValues((current) => ({ ...current, latitude: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Longitude</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.longitude} onChange={(event) => setPunchValues((current) => ({ ...current, longitude: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Accuracy Meters</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.accuracyMeters} onChange={(event) => setPunchValues((current) => ({ ...current, accuracyMeters: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Employee Id</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.employeeId} onChange={(event) => setPunchValues((current) => ({ ...current, employeeId: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Geofence</span>
                <select className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.geofenceId} onChange={(event) => setPunchValues((current) => ({ ...current, geofenceId: event.target.value }))}>
                  <option value="">Select geofence</option>
                  {geofences.map((item, index) => (
                    <option key={`geofence-${index}`} value={stringifyValue(item.id)}>
                      {stringifyValue(item.name ?? item.geofence_name ?? item.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Wi-Fi Network</span>
                <select className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.wifiNetworkId} onChange={(event) => setPunchValues((current) => ({ ...current, wifiNetworkId: event.target.value }))}>
                  <option value="">Select Wi-Fi network</option>
                  {wifiNetworks.map((item, index) => (
                    <option key={`wifi-${index}`} value={stringifyValue(item.id)}>
                      {stringifyValue(item.name ?? item.ssid ?? item.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Wi-Fi SSID</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.wifiSsid} onChange={(event) => setPunchValues((current) => ({ ...current, wifiSsid: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Wi-Fi BSSID</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.wifiBssid} onChange={(event) => setPunchValues((current) => ({ ...current, wifiBssid: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">IP Address</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.ipAddress} onChange={(event) => setPunchValues((current) => ({ ...current, ipAddress: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-slate-700">Device Identifier</span>
                <input className="rounded-md border border-slate-300 px-3 py-2" value={punchValues.deviceIdentifier} onChange={(event) => setPunchValues((current) => ({ ...current, deviceIdentifier: event.target.value }))} />
              </label>
            </div>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Override Reason</span>
              <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" value={punchValues.overrideReason} onChange={(event) => setPunchValues((current) => ({ ...current, overrideReason: event.target.value }))} />
            </label>
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800" type="button" onClick={() => void submitPunch("check-in")}>
                Check In
              </button>
              <button className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button" onClick={() => void submitPunch("check-out")}>
                Check Out
              </button>
            </div>
          </div>
        ) : null}

        {!loading && activeSection === "recalculation-jobs" ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap gap-3">
              <button className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800" type="button" onClick={() => void runPendingJobs()}>
                Run Pending Jobs
              </button>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-base font-semibold text-slate-900">Queue Recalculation</h2>
                <div className="mt-4 grid gap-3">
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={recalculateValues.start_date} onChange={(event) => setRecalculateValues((current) => ({ ...current, start_date: event.target.value }))} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={recalculateValues.end_date} onChange={(event) => setRecalculateValues((current) => ({ ...current, end_date: event.target.value }))} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Employee Id (optional)" value={recalculateValues.employee_id} onChange={(event) => setRecalculateValues((current) => ({ ...current, employee_id: event.target.value }))} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Reason" value={recalculateValues.reason} onChange={(event) => setRecalculateValues((current) => ({ ...current, reason: event.target.value }))} />
                  <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={recalculateValues.process_immediately} onChange={(event) => setRecalculateValues((current) => ({ ...current, process_immediately: event.target.value }))}>
                    <option value="true">Process immediately</option>
                    <option value="false">Queue only</option>
                  </select>
                  <button className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" type="button" onClick={() => void queueRecalculation()}>
                    Queue Recalculation
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-base font-semibold text-slate-900">Process Attendance Range</h2>
                <div className="mt-4 grid gap-3">
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={rangeValues.start_date} onChange={(event) => setRangeValues((current) => ({ ...current, start_date: event.target.value }))} />
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={rangeValues.end_date} onChange={(event) => setRangeValues((current) => ({ ...current, end_date: event.target.value }))} />
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
            <TableBlock rows={rows} />
          </div>
        ) : null}

        {!loading &&
        activeSection !== "today" &&
        activeSection !== "punch-action" &&
        activeSection !== "recalculation-jobs" ? (
          <div className="mt-6">
            <TableBlock rows={rows} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
