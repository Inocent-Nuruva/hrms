"use client"

import * as React from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion"
import {
  AlarmClockCheckIcon,
  Filter,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  TimerResetIcon,
} from "lucide-react"

import { ResizableTable } from "@/components/ui/resizable-table"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { TimeClockPicker } from "@/components/ui/time-clock-picker"
import { Textarea } from "@/components/ui/textarea"
import { LumaSpin } from "@/components/ui/luma-spin"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  cancelMyAttendanceCorrectionRequest,
  createMyAttendanceCorrectionRequest,
  downloadAttendanceReport,
  getMyAttendanceCorrectionRequest,
  getMyAttendanceSchedule,
  getMyAttendanceToday,
  listMyAttendanceCorrectionRequests,
  refreshAttendanceDailySummaries,
  listAttendanceDailySummariesPage,
  listAttendanceProcessingJobs,
  listAttendanceUnmatchedLogs,
  listBranches,
  listEmployees,
  listMyAttendanceHistory,
  runPendingAttendanceProcessingJobs,
  submitMyAttendanceCorrectionRequest,
  type AdminRecord,
  type RefreshAttendanceDailySummariesInput,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"

type AttendanceActivitySectionKey =
  | "daily-summaries"
  | "recalculation-jobs"
  | "unmatched-logs"
  | "today"
  | "punch-action"
  | "attendance-history"
  | "schedule-preview"
  | "corrections"

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
  "corrections": {
    title: "Correction Requests",
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

// Doodles / decorative backgrounds (matching the design used on holidays, requests, balances, promotion, payroll)
function DoodleSprites() {
  return (
    <svg width="0" height="0" className="hidden" aria-hidden="true">
      <symbol id="doodle-circles" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" opacity="0.3">
          <path d="M 323.074 256.963 C 312.956 263.991 295.834 280.024 295.479 292.107 C 294.971 309.41 311.806 311.371 322.384 317.098" />
          <path d="M 322.384 225.723 C 303.276 230.431 291.393 236.843 273.403 256.963 C 252.542 280.29 261.674 308.503 261.674 315.536" />
          <path d="M 320.316 193.268 C 285.716 194.491 258.866 221.733 245.117 244.813 C 225.414 277.888 238.218 316.923 236.839 320.568" />
        </g>
      </symbol>
      <symbol id="doodle-curves" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeWidth="4" opacity="0.25">
          <path d="M 50 50 Q 150 20 250 80 Q 100 150 200 250" />
          <path d="M 30 100 Q 120 70 220 140 Q 80 200 180 280" />
        </g>
      </symbol>
      <symbol id="doodle-grass" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" opacity="0.2">
          <path d="M 20 300 Q 40 200 30 100" />
          <path d="M 60 300 Q 80 180 70 80" />
          <path d="M 100 300 Q 120 220 110 120" />
          <path d="M 150 300 Q 170 190 160 90" />
          <path d="M 200 300 Q 220 210 210 110" />
          <path d="M 250 300 Q 270 200 260 100" />
          <path d="M 290 300 Q 310 220 300 120" />
        </g>
      </symbol>
    </svg>
  );
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

function formatClockValue(value: unknown) {
  if (typeof value !== "string") {
    return "—"
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase() === "invalid date") {
    return "—"
  }

  if (isTimeValue(trimmed)) {
    return formatDisplayTime(trimmed)
  }

  if (isIsoDateString(trimmed) || trimmed.includes("T") || /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)) {
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed)
    }
  }

  return trimmed
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

function formatMinutesLabel(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—"
  }
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) {
    return stringifyValue(value)
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`
}

function formatHistoryDateLabel(value: string | null) {
  if (!value) return "—"
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatHistoryTimeLabel(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  const raw = String(value)
  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  // Already a time-like string (HH:mm / HH:mm:ss)
  if (/^\d{1,2}:\d{2}/.test(raw)) {
    return raw.slice(0, 5)
  }
  return raw
}

/** Clear color map for attendance day statuses (summary chips + row accent). */
function attendanceHistoryStatusTone(status: string) {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_")

  if (
    key.includes("early_depart") ||
    key.includes("early_leave") ||
    key === "early_departure" ||
    key.includes("early_out")
  ) {
    return {
      bar: "bg-violet-500",
      chip: "bg-violet-500/10 text-violet-800 dark:text-violet-300",
      label: "text-violet-700 dark:text-violet-300",
      count: "text-violet-700 dark:text-violet-300",
    }
  }
  if (key.includes("late")) {
    return {
      bar: "bg-amber-500",
      chip: "bg-amber-500/10 text-amber-900 dark:text-amber-300",
      label: "text-amber-800 dark:text-amber-300",
      count: "text-amber-800 dark:text-amber-300",
    }
  }
  if (key.includes("half")) {
    return {
      bar: "bg-orange-500",
      chip: "bg-orange-500/10 text-orange-900 dark:text-orange-300",
      label: "text-orange-800 dark:text-orange-300",
      count: "text-orange-800 dark:text-orange-300",
    }
  }
  if (key.includes("absent")) {
    return {
      bar: "bg-rose-500",
      chip: "bg-rose-500/10 text-rose-800 dark:text-rose-300",
      label: "text-rose-700 dark:text-rose-300",
      count: "text-rose-700 dark:text-rose-300",
    }
  }
  if (key.includes("holiday")) {
    return {
      bar: "bg-indigo-500",
      chip: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-300",
      label: "text-indigo-700 dark:text-indigo-300",
      count: "text-indigo-700 dark:text-indigo-300",
    }
  }
  if (key.includes("leave") || key.includes("on_leave")) {
    return {
      bar: "bg-sky-500",
      chip: "bg-sky-500/10 text-sky-900 dark:text-sky-300",
      label: "text-sky-800 dark:text-sky-300",
      count: "text-sky-800 dark:text-sky-300",
    }
  }
  if (key.includes("off") || key.includes("weekend") || key.includes("rest")) {
    return {
      bar: "bg-slate-400",
      chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      label: "text-slate-600 dark:text-slate-300",
      count: "text-slate-700 dark:text-slate-300",
    }
  }
  if (key.includes("present") || key.includes("on_time") || key === "ok" || key === "worked") {
    return {
      bar: "bg-emerald-500",
      chip: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      label: "text-emerald-700 dark:text-emerald-300",
      count: "text-emerald-700 dark:text-emerald-300",
    }
  }
  return {
    bar: "bg-primary",
    chip: "bg-primary/10 text-primary",
    label: "text-primary",
    count: "text-primary",
  }
}

function schedulePreviewDayKind(row: AdminRecord): string {
  if (isOffDayValue(row.is_off_day) || isOffDayValue(row.isOffDay)) {
    return "Off Day"
  }
  if (
    isOffDayValue(row.is_holiday) ||
    isOffDayValue(row.isHoliday) ||
    Boolean(readStringFromRow(row, ["holiday_name", "holidayName"]))
  ) {
    return "Holiday"
  }
  if (
    isOffDayValue(row.is_on_leave) ||
    isOffDayValue(row.on_leave) ||
    Boolean(readStringFromRow(row, ["leave_type", "leaveType", "leave_status"]))
  ) {
    return "On Leave"
  }
  const shift = readNestedRecord(row, ["shift"])
  const shiftName = readStringFromRow(shift ?? row, [
    "name",
    "shift_name",
    "code",
    "schedule_name",
  ])
  if (shift || shiftName) {
    return "Working"
  }
  return "Unassigned"
}

function schedulePreviewKindTone(kind: string) {
  return attendanceHistoryStatusTone(kind)
}

function isOffDayValue(value: unknown) {
  return value === true || value === "true"
}

function asRecordValue(value: unknown): AdminRecord | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as AdminRecord
  }
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(value)
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as AdminRecord)
        : null
    } catch {
      return null
    }
  }
  return null
}

function toIsoDateTime(dateValue: string, timeValue: string) {
  if (!dateValue.trim() || !timeValue.trim()) {
    return undefined
  }
  const timestamp = new Date(`${dateValue}T${timeValue}`)
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("Please provide a valid correction date and time.")
  }
  return timestamp.toISOString()
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
  if (normalized.includes("PRESENT") || normalized.includes("COMPLETE") || normalized.includes("APPROV")) {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
      accent: "bg-emerald-500",
      panel: "border-emerald-100 bg-emerald-50/60",
    }
  }
  if (normalized.includes("LATE") || normalized.includes("MISSING") || normalized.includes("SUBMIT") || normalized.includes("PENDING")) {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
      accent: "bg-amber-500",
      panel: "border-amber-100 bg-amber-50/60",
    }
  }
  if (normalized.includes("ABSENT") || normalized.includes("REJECT") || normalized.includes("CANCEL")) {
    return {
      badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
      accent: "bg-rose-500",
      panel: "border-rose-100 bg-rose-50/60",
    }
  }
  if (normalized.includes("DRAFT")) {
    return {
      badge: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      accent: "bg-slate-400",
      panel: "border-slate-100 bg-slate-50/60",
    }
  }
  return {
    badge: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    accent: "bg-sky-500",
    panel: "border-sky-100 bg-sky-50/60",
  }
}

/** Correction request list tones (chips + row accent). */
function correctionRequestStatusTone(statusValue: string) {
  const key = statusValue.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (key.includes("approv") || key.includes("complete")) {
    return {
      bar: "bg-emerald-500",
      chip: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
      label: "text-emerald-700 dark:text-emerald-300",
      count: "text-emerald-700 dark:text-emerald-300",
    }
  }
  if (key.includes("submit") || key.includes("pending") || key.includes("review")) {
    return {
      bar: "bg-amber-500",
      chip: "bg-amber-500/10 text-amber-900 dark:text-amber-300",
      label: "text-amber-800 dark:text-amber-300",
      count: "text-amber-800 dark:text-amber-300",
    }
  }
  if (key.includes("reject") || key.includes("deny")) {
    return {
      bar: "bg-rose-500",
      chip: "bg-rose-500/10 text-rose-800 dark:text-rose-300",
      label: "text-rose-700 dark:text-rose-300",
      count: "text-rose-700 dark:text-rose-300",
    }
  }
  if (key.includes("cancel")) {
    return {
      bar: "bg-slate-400",
      chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
      label: "text-slate-600 dark:text-slate-300",
      count: "text-slate-700 dark:text-slate-300",
    }
  }
  if (key.includes("draft")) {
    return {
      bar: "bg-sky-500",
      chip: "bg-sky-500/10 text-sky-900 dark:text-sky-300",
      label: "text-sky-800 dark:text-sky-300",
      count: "text-sky-800 dark:text-sky-300",
    }
  }
  return {
    bar: "bg-primary",
    chip: "bg-primary/10 text-primary",
    label: "text-primary",
    count: "text-primary",
  }
}

function TodayOverview({ record }: { record: AdminRecord | null }) {
  const prefersReducedMotion = useReducedMotion()
  const animate = !prefersReducedMotion

  if (!record) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">No attendance for today</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your data for today has not been published yet.
        </p>
      </div>
    )
  }

  const effective =
    record && record.summary && typeof record.summary === "object" && !Array.isArray(record.summary)
      ? (record.summary as AdminRecord)
      : record || {}

  const statusRaw =
    readStringFromRow(effective, ["attendance_status", "status", "attendanceStatus"]) ||
    readStringFromRow(record, ["attendance_status", "status", "attendanceStatus", "punch_state"]) ||
    "Today"
  const tone = attendanceHistoryStatusTone(statusRaw)

  const scheduleStartRaw = readWithFallback(
    record,
    ["schedule_start_at", "schedule_start_time", "shift_start_at", "start_time"],
    effective
  )
  const scheduleEndRaw = readWithFallback(
    record,
    ["schedule_end_at", "schedule_end_time", "shift_end_at", "end_time"],
    effective
  )
  const firstPunchRaw = readWithFallback(
    record,
    ["first_punch", "first_check_in_at", "first_punch_at", "check_in_at", "clock_in_at"],
    effective
  )
  const lastPunchRaw = readWithFallback(
    record,
    ["last_punch", "last_check_out_at", "last_punch_at", "check_out_at", "clock_out_at"],
    effective
  )

  const scheduleStart = formatHistoryTimeLabel(scheduleStartRaw ?? "—")
  const scheduleEnd = formatHistoryTimeLabel(scheduleEndRaw ?? "—")
  const firstPunch = formatHistoryTimeLabel(firstPunchRaw ?? "—")
  const lastPunch = formatHistoryTimeLabel(lastPunchRaw ?? "—")

  const workedRaw = readWithFallback(
    record,
    ["worked_hours", "worked_duration", "total_worked_hours", "hours_worked", "work_minutes", "worked_minutes"],
    effective
  )
  const workedLabel =
    workedRaw === null || workedRaw === undefined || workedRaw === ""
      ? "—"
      : typeof workedRaw === "number" || /^\d+(\.\d+)?$/.test(String(workedRaw))
        ? // Prefer minutes formatting when value looks like minutes (> 24 unlikely for hours-as-number display)
          Number(workedRaw) > 24
          ? formatMinutesLabel(workedRaw)
          : String(workedRaw)
        : formatOptionalValue(workedRaw, "—")

  const branch =
    formatOptionalValue(
      readWithFallback(record, ["branch_name", "branch", "location_name", "site_name"], effective),
      "—"
    )
  const shift =
    formatOptionalValue(
      readWithFallback(record, ["shift_name", "schedule_name", "timetable_name"], effective),
      ""
    )
  const latenessNum = Number(
    readWithFallback(record, ["late_minutes", "lateness_minutes", "minutes_late"], effective) ?? 0
  )
  const overtimeNum = Number(
    readWithFallback(record, ["overtime_minutes", "overtime_hours", "extra_time"], effective) ?? 0
  )
  const lateness = Number.isFinite(latenessNum) ? latenessNum : 0
  const overtime = Number.isFinite(overtimeNum) ? overtimeNum : 0

  const summaryChips: Array<{ key: string; label: string; value: string; toneKey: string }> = [
    { key: "status", label: "Status", value: statusRaw.replace(/[_-]+/g, " "), toneKey: statusRaw },
    {
      key: "late",
      label: "Late",
      value: lateness > 0 ? `${lateness}m` : "0m",
      toneKey: lateness > 0 ? "late" : "present",
    },
    {
      key: "ot",
      label: "Overtime",
      value: overtime > 0 ? `${overtime}m` : "0m",
      toneKey: overtime > 0 ? "late" : "present",
    },
    {
      key: "worked",
      label: "Worked",
      value: workedLabel,
      toneKey: "present",
    },
  ]

  const rowSpring = (index: number) =>
    animate
      ? {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring" as const,
            stiffness: 420,
            damping: 28,
            mass: 0.7,
            delay: index * 0.04,
          },
        }
      : { opacity: 1, y: 0, scale: 1 }

  return (
    <div className="space-y-3">
      <motion.div
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
        initial={animate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {summaryChips.map((chip, index, arr) => {
          const chipTone = attendanceHistoryStatusTone(chip.toneKey)
          return (
            <div
              key={chip.key}
              className={cn(
                "flex min-w-[5.25rem] shrink-0 flex-col justify-center px-3 py-2",
                chipTone.chip,
                index < arr.length - 1 ? "border-r border-border/60" : null
              )}
            >
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {chip.label}
              </span>
              <span className={cn("text-base font-semibold tabular-nums capitalize", chipTone.count)}>
                {chip.value}
              </span>
            </div>
          )
        })}
      </motion.div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        <AnimatePresence mode="popLayout">
          <motion.div
            key="schedule-row"
            initial={animate ? { opacity: 0, y: 10, scale: 0.99 } : false}
            animate={rowSpring(0)}
            className="flex bg-background"
          >
            <div className="w-1 shrink-0 bg-primary" />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
              <div className="w-[7rem] shrink-0">
                <div className="text-xs font-semibold text-foreground">Schedule</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {shift || "Assigned shift"}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Start
                  </div>
                  <div
                    className={cn(
                      "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                      scheduleStart === "—" ? "text-muted-foreground/45" : "text-primary"
                    )}
                  >
                    {scheduleStart}
                  </div>
                </div>
                <div className="text-muted-foreground/40" aria-hidden>
                  →
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    End
                  </div>
                  <div
                    className={cn(
                      "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                      scheduleEnd === "—" ? "text-muted-foreground/45" : "text-primary"
                    )}
                  >
                    {scheduleEnd}
                  </div>
                </div>
                <div className="hidden min-w-[6rem] shrink-0 text-right sm:block">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Branch
                  </div>
                  <div className="truncate text-sm font-medium text-foreground">{branch}</div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            key="punches-row"
            initial={animate ? { opacity: 0, y: 10, scale: 0.99 } : false}
            animate={rowSpring(1)}
            className="flex bg-background"
          >
            <div className={cn("w-1 shrink-0", tone.bar)} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
              <div className="w-[7rem] shrink-0">
                <div className="text-xs font-semibold text-foreground">Punches</div>
                <div className={cn("mt-0.5 text-[11px] font-semibold capitalize", tone.label)}>
                  {statusRaw.replace(/[_-]+/g, " ")}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Check in
                  </div>
                  <div
                    className={cn(
                      "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                      firstPunch === "—" ? "text-muted-foreground/45" : "text-primary"
                    )}
                  >
                    {firstPunch}
                  </div>
                </div>
                <div className="text-muted-foreground/40" aria-hidden>
                  →
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Check out
                  </div>
                  <div
                    className={cn(
                      "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                      lastPunch === "—" ? "text-muted-foreground/45" : "text-primary"
                    )}
                  >
                    {lastPunch}
                  </div>
                </div>
                <div className="hidden min-w-[4.5rem] shrink-0 text-right sm:block">
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Worked
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    {workedLabel}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            key="metrics-row"
            initial={animate ? { opacity: 0, y: 10, scale: 0.99 } : false}
            animate={rowSpring(2)}
            className="flex bg-background"
          >
            <div
              className={cn(
                "w-1 shrink-0",
                lateness > 0 ? "bg-amber-500" : overtime > 0 ? "bg-sky-500" : "bg-emerald-500"
              )}
            />
            <div className="flex min-w-0 flex-1 items-center gap-4 px-3 py-2.5">
              <div className="w-[7rem] shrink-0">
                <div className="text-xs font-semibold text-foreground">Metrics</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Today</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Lateness
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      lateness > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300"
                    )}
                  >
                    {lateness} min
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Overtime
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      overtime > 0 ? "text-sky-700 dark:text-sky-300" : "text-foreground"
                    )}
                  >
                    {overtime} min
                  </div>
                </div>
                {branch !== "—" ? (
                  <div className="min-w-0 sm:hidden">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Branch
                    </div>
                    <div className="truncate text-sm font-medium text-foreground">{branch}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
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

function collectSearchableText(value: unknown, depth = 0): string[] {
  if (value == null || depth > 3) {
    return []
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim()
    return text ? [text] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSearchableText(item, depth + 1))
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectSearchableText(item, depth + 1)
    )
  }
  return []
}

/** Free-text haystack for a daily summary row (employee, branch, status, times, etc.). */
function buildDailySummarySearchText(row: AdminRecord): string {
  const nestedEmployee = readNestedRecord(row, ["employee"])
  const nestedBranch = readNestedRecord(row, ["branch", "organization", "org"])
  const parts: Array<string | number | null> = [
    readStringFromRow(row, [
      "employee_name",
      "employeeName",
      "full_name",
      "fullName",
      "display_name",
      "displayName",
      "name",
    ]),
    readStringFromRow(row, [
      "employee_no",
      "employeeNo",
      "employee_number",
      "employeeNumber",
      "employee_code",
      "employeeCode",
    ]),
    readNumberFromRow(row, ["employee_id", "employeeId"]),
    nestedEmployee ? getEmployeeOptionLabel(nestedEmployee) : null,
    readStringFromRow(row, [
      "branch_name",
      "branchName",
      "organization_name",
      "organizationName",
      "org_name",
      "orgName",
    ]),
    readNumberFromRow(row, ["branch_id", "branchId", "organization_id", "organizationId"]),
    nestedBranch ? getBranchOptionLabel(nestedBranch) : null,
    readStringFromRow(row, [
      "attendance_status",
      "attendanceStatus",
      "status",
      "summary_status",
      "summaryStatus",
      "state",
    ]),
    readStringFromRow(row, [
      "attendance_date",
      "attendanceDate",
      "date",
      "summary_date",
      "summaryDate",
      "work_date",
      "workDate",
    ]),
    readStringFromRow(row, [
      "check_in_time",
      "checkInTime",
      "check_in_at",
      "checkInAt",
      "check_out_time",
      "checkOutTime",
      "check_out_at",
      "checkOutAt",
    ]),
    // Catch remaining primitives so any column value is searchable.
    ...collectSearchableText(row),
  ]

  return parts
    .filter((value): value is string | number => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value).toLowerCase())
    .join(" ")
}

/** Client-side free-text search over loaded rows (all tokens must match). */
function filterDailySummaryRowsBySearch(rows: AdminRecord[], search: string) {
  const term = search.trim().toLowerCase()
  if (!term) {
    return rows
  }

  const tokens = term.split(/\s+/).filter(Boolean)
  if (!tokens.length) {
    return rows
  }

  return rows.filter((row) => {
    const haystack = buildDailySummarySearchText(row)
    return tokens.every((token) => haystack.includes(token))
  })
}

/** Parse "HH:mm" or "H:mm" into minutes from midnight. */
function parseTimeInputToMinutes(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Extract clock time (minutes) from a row field that may be time-only or ISO datetime. */
function extractRowTimeMinutes(row: AdminRecord, keys: string[]): number | null {
  const raw = readStringFromRow(row, keys)
  if (!raw) return null
  const trimmed = raw.trim()
  // ISO / datetime: take the time portion after T or space
  const timeChunk = trimmed.includes("T")
    ? trimmed.split("T")[1] ?? ""
    : trimmed.includes(" ")
      ? trimmed.split(" ").slice(-1)[0] ?? ""
      : trimmed
  const match = timeChunk.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}

const CHECK_IN_TIME_KEYS = [
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
]

/** Client-side check-in time window (after / before). Rows without check-in are excluded when a time filter is set. */
function filterDailySummaryRowsByCheckInTime(
  rows: AdminRecord[],
  checkInAfter: string,
  checkInBefore: string
) {
  const afterMinutes = parseTimeInputToMinutes(checkInAfter)
  const beforeMinutes = parseTimeInputToMinutes(checkInBefore)
  if (afterMinutes === null && beforeMinutes === null) {
    return rows
  }

  return rows.filter((row) => {
    const checkInMinutes = extractRowTimeMinutes(row, CHECK_IN_TIME_KEYS)
    if (checkInMinutes === null) {
      return false
    }
    if (afterMinutes !== null && checkInMinutes < afterMinutes) {
      return false
    }
    if (beforeMinutes !== null && checkInMinutes > beforeMinutes) {
      return false
    }
    return true
  })
}

function filterDailySummaryDisplayRows(
  rows: AdminRecord[],
  search: string,
  checkInAfter: string,
  checkInBefore: string
) {
  return filterDailySummaryRowsByCheckInTime(
    filterDailySummaryRowsBySearch(rows, search),
    checkInAfter,
    checkInBefore
  )
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
    const directTimetableValue = readFirstValue(row, [
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
    if (directTimetableValue && directTimetableValue.toLowerCase() !== "invalid date") {
      return directTimetableValue
    }

    const nestedTimetable = readNestedRecord(row, ["timetable", "schedule", "shift"])
    if (nestedTimetable) {
      return (
        readFirstValue(nestedTimetable, ["name", "timetable_name", "timetableName", "code", "shift_name", "shiftName"]) ??
        "—"
      )
    }

    return "—"
  }
  if (column === "check_in_time") {
    return formatClockValue(readFirstValue(row, [
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
    ]))
  }
  if (column === "check_out_time") {
    return formatClockValue(readFirstValue(row, [
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
    ]))
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

/**
 * Build POST /api/attendance/daily-summaries/refresh body as documented
 * (RefreshAttendanceDailySummariesDto), including legacy fields for compatibility.
 */
function buildRefreshSummariesPayload(values: Record<string, string>): RefreshAttendanceDailySummariesInput {
  if (!values.start_date.trim() || !values.end_date.trim()) {
    throw new Error("Start date and end date are required.")
  }

  const processingSource =
    values.processing_source === "fetch_and_process" || values.processing_source === "database_only"
      ? values.processing_source
      : "database_only"
  const executionMode =
    values.execution_mode === "immediate" || values.execution_mode === "background"
      ? values.execution_mode
      : "background"
  const mode =
    values.mode === "summaries_only" || values.mode === "from_raw_logs"
      ? values.mode
      : processingSource === "fetch_and_process"
        ? "from_raw_logs"
        : "summaries_only"
  const execution = executionMode === "immediate" ? "sync" : "async"

  const payload: RefreshAttendanceDailySummariesInput = {
    start_date: values.start_date.trim(),
    end_date: values.end_date.trim(),
    processing_source: processingSource,
    mode,
    execution_mode: executionMode,
    execution,
  }

  const employeeId = asNumber(values.employee_id)
  if (employeeId !== undefined) {
    payload.employee_id = employeeId
  }
  const deviceId = asNumber(values.device_id)
  if (deviceId !== undefined) {
    payload.device_id = deviceId
  }

  return payload
}

function AttendanceViewLoader({ label = "Loading attendance data…" }: { label?: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-10 shadow-sm">
      <LumaSpin />
      <p className="text-sm font-medium text-foreground">{label}</p>
    </div>
  )
}

function TableBlock({
  rows,
  section,
  loading = false,
  toolbarStart,
  toolbarActions,
  itemsPerPage = 20,
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  rows: AdminRecord[]
  section: AttendanceActivitySectionKey
  loading?: boolean
  toolbarStart?: React.ReactNode
  toolbarActions?: React.ReactNode
  itemsPerPage?: number
  page?: number
  totalPages?: number | null
  totalItems?: number | null
  onPageChange?: (page: number) => void
}) {
  const columns = React.useMemo(() => resolveVisibleColumns(rows, section), [rows, section])

  return (
    <div>
      <ResizableTable
        title="Attendance Activity"
        data={rows}
        columns={columns.map((c: string) => ({
          key: c,
          label: prettifyLabel(c),
          defaultWidth: 75,
          render: (row: AdminRecord) => resolveTableCellValue(section, c, row),
        }))}
        itemsPerPage={itemsPerPage}
        loading={loading}
        showExport={false}
        toolbarStart={toolbarStart}
        toolbarActions={toolbarActions}
        storageKey="attendance-activity"
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </div>
  )
}

const DAILY_SUMMARY_PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const
const DEFAULT_DAILY_SUMMARY_PAGE_SIZE = 50

export function AttendanceActivityView({ section }: { section: string }) {
  const activeSection = React.useMemo(() => resolveSection(section), [section])
  const config = React.useMemo(() => SECTION_CONFIG[activeSection], [activeSection])
  const lastFetchKeyRef = React.useRef<string | null>(null)
  const lastFetchAtRef = React.useRef(0)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [dailySummaryRows, setDailySummaryRows] = React.useState<AdminRecord[]>([])
  const [dailySummaryPage, setDailySummaryPage] = React.useState(1)
  const [dailySummaryPageSize, setDailySummaryPageSize] = React.useState(DEFAULT_DAILY_SUMMARY_PAGE_SIZE)
  const [dailySummaryTotal, setDailySummaryTotal] = React.useState<number | null>(null)
  const [dailySummaryTotalPages, setDailySummaryTotalPages] = React.useState<number | null>(null)
  const [singleRecord, setSingleRecord] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const branchesRef = React.useRef<AdminRecord[]>([])
  const employeesRef = React.useRef<AdminRecord[]>([])
  /** Free-text search across the current loaded page (employee, branch, status, dates, etc.). */
  const [recordSearch, setRecordSearch] = React.useState("")
  const [dailySummaryFilters, setDailySummaryFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      branch_id: "",
      status: "",
      check_in_after: "",
      check_in_before: "",
    }
  })
  const [appliedDailySummaryFilters, setAppliedDailySummaryFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      branch_id: "",
      status: "",
      check_in_after: "",
      check_in_before: "",
    }
  })
  const [hasAppliedDailySummaryFilters, setHasAppliedDailySummaryFilters] = React.useState(true)
  const [dailySummaryFiltersOpen, setDailySummaryFiltersOpen] = React.useState(false)
  const [rebuildFormOpen, setRebuildFormOpen] = React.useState(false)
  const [recalcActionBusy, setRecalcActionBusy] = React.useState(false)
  const [historyFilters, setHistoryFilters] = React.useState<Record<string, string>>(() => ({
    from_date: "",
    to_date: "",
  }))
  /** null = all days; otherwise filter attendance-history rows by status label */
  const [historyStatusFilter, setHistoryStatusFilter] = React.useState<string | null>(null)
  /** null = all; filter schedule-preview by day kind (Working / Off Day / …) */
  const [scheduleKindFilter, setScheduleKindFilter] = React.useState<string | null>(null)
  /** null = all; filter correction requests by status */
  const [correctionStatusFilter, setCorrectionStatusFilter] = React.useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const [correctionRequests, setCorrectionRequests] = React.useState<AdminRecord[]>([])
  const [correctionDialogOpen, setCorrectionDialogOpen] = React.useState(false)
  const [correctionBusy, setCorrectionBusy] = React.useState(false)
  const [pendingCorrectionAction, setPendingCorrectionAction] = React.useState<{
    id: string | number
    action: "submit" | "cancel"
  } | null>(null)
  const [attendanceExporting, setAttendanceExporting] = React.useState(false)
  const [correctionForm, setCorrectionForm] = React.useState({
    attendance_date: getTodayDateInputValue(),
    request_type: "check_in",
    requested_check_in_at: "",
    requested_check_out_at: "",
    requested_status: "PRESENT",
    reason: "",
  })
  const dailySummaryActiveFilterCount = React.useMemo(() => {
    const today = getTodayDateInputValue()
    let count = 0
    if (
      appliedDailySummaryFilters.from_date !== today ||
      appliedDailySummaryFilters.to_date !== today
    ) {
      count += 1
    }
    if (appliedDailySummaryFilters.employee_id) count += 1
    if (appliedDailySummaryFilters.branch_id) count += 1
    if (appliedDailySummaryFilters.status) count += 1
    if (appliedDailySummaryFilters.check_in_after) count += 1
    if (appliedDailySummaryFilters.check_in_before) count += 1
    if (recordSearch.trim()) count += 1
    if (dailySummaryPageSize !== DEFAULT_DAILY_SUMMARY_PAGE_SIZE) count += 1
    return count
  }, [appliedDailySummaryFilters, dailySummaryPageSize, recordSearch])

  const branchNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    branches.forEach((branch) => {
      const id = readNumberFromRow(branch, ["id", "branch_id", "branchId"])
      if (id === null) return
      map.set(String(id), getBranchOptionLabel(branch))
    })
    return map
  }, [branches])

  const applyDailySummaryDraftFilters = React.useCallback(() => {
    setHasAppliedDailySummaryFilters(true)
    setDailySummaryPage(1)
    setAppliedDailySummaryFilters({ ...dailySummaryFilters })
    setMessage(null)
    setError(null)
    setDailySummaryFiltersOpen(false)
  }, [dailySummaryFilters])

  const resetDailySummaryFiltersToToday = React.useCallback(() => {
    const today = getTodayDateInputValue()
    const resetFilters = {
      from_date: today,
      to_date: today,
      employee_id: "",
      branch_id: "",
      status: "",
      check_in_after: "",
      check_in_before: "",
    }
    setRecordSearch("")
    setDailySummaryPage(1)
    setDailySummaryPageSize(DEFAULT_DAILY_SUMMARY_PAGE_SIZE)
    setDailySummaryFilters(resetFilters)
    setAppliedDailySummaryFilters(resetFilters)
    setHasAppliedDailySummaryFilters(true)
    setError(null)
    setMessage(null)
    setDailySummaryFiltersOpen(false)
  }, [])

  /** Form state for POST /api/attendance/daily-summaries/refresh */
  const [recalculateValues, setRecalculateValues] = React.useState<Record<string, string>>({
    start_date: "",
    end_date: "",
    employee_id: "",
    device_id: "",
    processing_source: "database_only",
    mode: "from_raw_logs",
    execution_mode: "background",
    execution: "async",
  })

  React.useEffect(() => {
    branchesRef.current = branches
  }, [branches])

  React.useEffect(() => {
    employeesRef.current = employees
  }, [employees])

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

  // Re-attach employee/branch names when support lists arrive, without re-fetching summaries.
  React.useEffect(() => {
    if (activeSection !== "daily-summaries") {
      return
    }
    if (!branches.length && !employees.length) {
      return
    }

    setDailySummaryRows((current) => {
      if (!current.length) {
        return current
      }
      return enrichRowsWithReadableNames(current, branches, employees)
    })
  }, [activeSection, branches, employees])

  const loadSectionData = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setRows([])
      setSingleRecord(null)
      setDailySummaryRows([])
      setCorrectionRequests([])
      setLoading(false)
      setError("Authentication required. Please log in again.")
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (activeSection === "today") {
        const payload = await getMyAttendanceToday(token)
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setSingleRecord(payload)
        setRows([])
        setCorrectionRequests([])
        return
      }

      if (activeSection === "schedule-preview") {
        const payload: unknown = await getMyAttendanceSchedule(token)
        const daysRecord = asRecordValue(payload)
        const days = Array.isArray(payload) ? payload : (Array.isArray(daysRecord?.days) ? daysRecord.days : [])
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(days)
        setSingleRecord(null)
        setCorrectionRequests([])
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
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(result.rows)
        setCorrectionRequests([])
        setSingleRecord(null)
        return
      }

      if (activeSection === "corrections") {
        const correctionsResult = await listMyAttendanceCorrectionRequests(token, {
          page: 1,
          limit: 20,
        }).catch(() => ({ rows: [] }))
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows([])
        setSingleRecord(null)
        setCorrectionRequests(correctionsResult.rows)
        return
      }

      if (activeSection === "daily-summaries") {
        if (!hasAppliedDailySummaryFilters) {
          setDailySummaryRows([])
          setDailySummaryTotal(null)
          setDailySummaryTotalPages(null)
          setRows([])
          setSingleRecord(null)
          setCorrectionRequests([])
          return
        }

        // Server page size is user-selectable. Free-text search stays client-side on the loaded page.
        const branchId = appliedDailySummaryFilters.branch_id
          ? Number(appliedDailySummaryFilters.branch_id)
          : undefined
        const result = await listAttendanceDailySummariesPage(token, {
          page: dailySummaryPage,
          limit: dailySummaryPageSize,
          sortBy: "created_at",
          sortOrder: "DESC",
          from_date: appliedDailySummaryFilters.from_date || undefined,
          to_date: appliedDailySummaryFilters.to_date || undefined,
          employee_id: appliedDailySummaryFilters.employee_id
            ? Number(appliedDailySummaryFilters.employee_id)
            : undefined,
          // Prefer branch_id; also send organization_id for APIs that scope branches that way.
          branch_id: branchId && Number.isFinite(branchId) ? branchId : undefined,
          organization_id: branchId && Number.isFinite(branchId) ? branchId : undefined,
          status: appliedDailySummaryFilters.status || undefined,
        })
        const enrichedRows = enrichRowsWithReadableNames(
          result.rows,
          branchesRef.current,
          employeesRef.current
        )
        const totalPages =
          result.totalPages ??
          (result.total !== null
            ? Math.max(1, Math.ceil(result.total / dailySummaryPageSize))
            : result.rows.length >= dailySummaryPageSize
              ? dailySummaryPage + 1
              : dailySummaryPage)
        // Always keep the full unfiltered server page in dailySummaryRows.
        setDailySummaryRows(enrichedRows)
        setDailySummaryTotal(result.total ?? enrichedRows.length)
        setDailySummaryTotalPages(totalPages)
        setRows(enrichedRows)
        setSingleRecord(null)
        setCorrectionRequests([])
        return
      }

      if (activeSection === "recalculation-jobs") {
        const result = await listAttendanceProcessingJobs(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(result.rows)
        setSingleRecord(null)
        setCorrectionRequests([])
        return
      }

      if (activeSection === "unmatched-logs") {
        const result = await listAttendanceUnmatchedLogs(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(result.rows)
        setSingleRecord(null)
        setCorrectionRequests([])
        return
      }

      setDailySummaryRows([])
      setDailySummaryTotal(null)
      setDailySummaryTotalPages(null)
      setRows([])
      setSingleRecord(null)
      setCorrectionRequests([])
    } catch (errorObject) {
      setDailySummaryRows([])
      setDailySummaryTotal(null)
      setDailySummaryTotalPages(null)
      setRows([])
      setSingleRecord(null)
      setCorrectionRequests([])
      setError(formatLoadError(errorObject, `Failed to load ${config.title.toLowerCase()}.`))
    } finally {
      setLoading(false)
    }
  }, [
    activeSection,
    appliedDailySummaryFilters,
    config.title,
    dailySummaryPage,
    dailySummaryPageSize,
    hasAppliedDailySummaryFilters,
    historyFilters,
  ])

  const fetchSectionData = React.useCallback(async (force = false) => {
    const requestKey = JSON.stringify({
      activeSection,
      historyFilters,
      dailySummaryFilters: appliedDailySummaryFilters,
      dailySummaryPage,
      dailySummaryPageSize,
      hasAppliedDailySummaryFilters,
    })

    if (!force) {
      const now = Date.now()
      if (lastFetchKeyRef.current === requestKey && now - lastFetchAtRef.current < 1500) {
        return
      }
      lastFetchKeyRef.current = requestKey
      lastFetchAtRef.current = now
    }

    await loadSectionData()
  }, [
    activeSection,
    appliedDailySummaryFilters,
    dailySummaryPage,
    dailySummaryPageSize,
    hasAppliedDailySummaryFilters,
    historyFilters,
    loadSectionData,
  ])

  React.useEffect(() => {
    void fetchSectionData()
  }, [fetchSectionData])

  // Free-text + check-in time filters are display-only over the stored server page.
  // Clearing them restores every loaded row immediately (dailySummaryRows is never shrunk).
  const displayedDailySummaryRows = React.useMemo(() => {
    if (activeSection !== "daily-summaries") {
      return rows
    }
    return filterDailySummaryDisplayRows(
      dailySummaryRows,
      recordSearch,
      appliedDailySummaryFilters.check_in_after || "",
      appliedDailySummaryFilters.check_in_before || ""
    )
  }, [
    activeSection,
    appliedDailySummaryFilters.check_in_after,
    appliedDailySummaryFilters.check_in_before,
    dailySummaryRows,
    recordSearch,
    rows,
  ])

  const runPendingJobs = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    setRecalcActionBusy(true)
    try {
      await runPendingAttendanceProcessingJobs(token)
      setMessage("Pending recalculation jobs started successfully.")
      setError(null)
      await loadSectionData()
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not run pending jobs."))
    } finally {
      setRecalcActionBusy(false)
    }
  }

  const queueRecalculation = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }
    setRecalcActionBusy(true)
    try {
      const payload = buildRefreshSummariesPayload(recalculateValues)
      await refreshAttendanceDailySummaries(token, payload)
      setMessage(
        payload.execution_mode === "immediate"
          ? "Attendance refresh completed."
          : "Attendance refresh started in the background."
      )
      setError(null)
      setRebuildFormOpen(false)
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not refresh attendance daily summaries."))
    } finally {
      setRecalcActionBusy(false)
    }
  }

  const submitCorrectionRequest = async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    if (!correctionForm.attendance_date.trim() || !correctionForm.reason.trim()) {
      setError("Attendance date and reason are required.")
      return
    }

    setCorrectionBusy(true)
    setError(null)
    setMessage(null)

    try {
      const createdRequest = await createMyAttendanceCorrectionRequest(token, {
        attendance_date: correctionForm.attendance_date,
        request_type: correctionForm.request_type,
        requested_check_in_at: toIsoDateTime(
          correctionForm.attendance_date,
          correctionForm.requested_check_in_at
        ),
        requested_check_out_at: toIsoDateTime(
          correctionForm.attendance_date,
          correctionForm.requested_check_out_at
        ),
        requested_status: correctionForm.requested_status,
        reason: correctionForm.reason.trim(),
      })
      const createdRecord = asRecordValue(createdRequest)
      const createdRequestId = readNumberFromRow(createdRecord ?? {}, ["id", "request_id"])
      const createdStatus = (
        readStringFromRow(createdRecord ?? {}, ["status", "request_status"]) ?? ""
      ).toLowerCase()
      if (createdRequestId !== null && !["", "-", "draft"].includes(createdStatus)) {
        void notifySubmittedRequestApprovers({
          kind: "attendance_correction_request",
          token,
          request: createdRequest,
          loadRequest: () => getMyAttendanceCorrectionRequest(token, createdRequestId),
        })
      }
      setMessage("Attendance correction request created.")
      setCorrectionDialogOpen(false)
      setCorrectionForm({
        attendance_date: getTodayDateInputValue(),
        request_type: "check_in",
        requested_check_in_at: "",
        requested_check_out_at: "",
        requested_status: "PRESENT",
        reason: "",
      })
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not create the attendance correction request."))
    } finally {
      setCorrectionBusy(false)
    }
  }

  const updateCorrectionRequestStatus = React.useCallback(
    async (id: string | number, action: "submit" | "cancel") => {
      const token = readStoredToken()
      if (!token) {
        setError("Authentication required. Please log in again.")
        return
      }

      setCorrectionBusy(true)
      setError(null)
      setMessage(null)

      try {
        if (action === "submit") {
          const submittedRequest = await submitMyAttendanceCorrectionRequest(token, id)
          void notifySubmittedRequestApprovers({
            kind: "attendance_correction_request",
            token,
            request: submittedRequest ?? { id },
            loadRequest: () => getMyAttendanceCorrectionRequest(token, id),
          })
          setMessage("Attendance correction request submitted.")
        } else {
          await cancelMyAttendanceCorrectionRequest(token, id)
          setMessage("Attendance correction request cancelled.")
        }
        await loadSectionData()
      } catch (errorObject) {
        setError(
          formatLoadError(
            errorObject,
            action === "submit"
              ? "Could not submit the attendance correction request."
              : "Could not cancel the attendance correction request."
          )
        )
      } finally {
        setCorrectionBusy(false)
      }
    },
    [loadSectionData]
  )

  React.useEffect(() => {
    if (!pendingCorrectionAction) return

    let cancelled = false
    void updateCorrectionRequestStatus(
      pendingCorrectionAction.id,
      pendingCorrectionAction.action
    ).finally(() => {
      if (!cancelled) setPendingCorrectionAction(null)
    })

    return () => {
      cancelled = true
    }
  }, [pendingCorrectionAction, updateCorrectionRequestStatus])

  const exportDailySummaryReport = async (format: "xlsx" | "csv" | "pdf") => {
    const token = readStoredToken()
    if (!token) {
      toast.error("Authentication required. Please log in again.")
      return
    }

    setAttendanceExporting(true)
    setError(null)
    setMessage(null)

    try {
      const blobResult = await downloadAttendanceReport(token, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
        search: recordSearch.trim() || undefined,
        from_date: dailySummaryFilters.from_date || undefined,
        to_date: dailySummaryFilters.to_date || undefined,
        employee_id: dailySummaryFilters.employee_id
          ? Number(dailySummaryFilters.employee_id)
          : undefined,
        branch_id: dailySummaryFilters.branch_id
          ? Number(dailySummaryFilters.branch_id)
          : undefined,
        organization_id: dailySummaryFilters.branch_id
          ? Number(dailySummaryFilters.branch_id)
          : undefined,
        status: dailySummaryFilters.status || undefined,
        format,
      })

      const url = URL.createObjectURL(blobResult.blob)
      const link = document.createElement("a")
      link.href = url
      link.download = blobResult.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success(`Attendance report downloaded as ${format.toUpperCase()}.`)
    } catch (errorObject) {
      toast.error(formatLoadError(errorObject, "Could not download the attendance report."))
    } finally {
      setAttendanceExporting(false)
    }
  }

  if (activeSection === 'punch-action') {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        Punch actions are only available in the mobile app.
      </div>
    )
  }

  const dailySummaryFilterControlClass =
    "h-6 w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 text-[10px] leading-none text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
  const dailySummaryFilterLabelClass =
    "grid min-w-0 gap-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"

  const dailySummaryFilterPopover = activeSection === "daily-summaries" ? (
    <Popover open={dailySummaryFiltersOpen} onOpenChange={setDailySummaryFiltersOpen}>
      <PopoverTrigger
        className={cn(
          "relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs font-medium text-foreground transition hover:bg-muted",
          dailySummaryActiveFilterCount > 0 && "border-primary/40 bg-primary/5"
        )}
        aria-label="Open filters"
        title="Filters"
      >
        <Filter className="size-3 text-primary" />
        {dailySummaryActiveFilterCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-primary-foreground">
            {dailySummaryActiveFilterCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-1rem,17.5rem)] p-2"
        align="end"
        sideOffset={6}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className="inline-flex h-5 items-center rounded px-1.5 text-[9px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={resetDailySummaryFiltersToToday}
              >
                Reset
              </button>
              <button
                type="button"
                className="inline-flex h-5 items-center rounded bg-primary px-1.5 text-[9px] font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={loading}
                onClick={applyDailySummaryDraftFilters}
              >
                Apply
              </button>
            </div>
          </div>

          <label className="relative block w-full">
            <SearchIcon className="pointer-events-none absolute left-1.5 top-1/2 size-2.5 -translate-y-1/2 text-slate-400" />
            <input
              className={cn(dailySummaryFilterControlClass, "pl-6 pr-6")}
              value={recordSearch}
              onChange={(event) => setRecordSearch(event.target.value)}
              placeholder="Search…"
              aria-label="Search daily summaries by any field"
            />
            {recordSearch.trim() ? (
              <button
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-0.5 text-[9px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                onClick={() => setRecordSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-1">
            <label className={dailySummaryFilterLabelClass}>
              <span>From</span>
              <DatePickerPresets
                value={dailySummaryFilters.from_date}
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({ ...current, from_date: value }))
                }
                placeholder="From"
                className="h-6 gap-0.5 border-slate-300 bg-white px-1.5 text-[10px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-2.5"
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>To</span>
              <DatePickerPresets
                value={dailySummaryFilters.to_date}
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({ ...current, to_date: value }))
                }
                placeholder="To"
                className="h-6 gap-0.5 border-slate-300 bg-white px-1.5 text-[10px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-2.5"
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Employee</span>
              <select
                className={dailySummaryFilterControlClass}
                value={dailySummaryFilters.employee_id}
                onChange={(event) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    employee_id: event.target.value,
                  }))
                }
              >
                <option value="">All</option>
                {employees.map((employee, index) => {
                  const employeeId = readNumberFromRow(employee, [
                    "id",
                    "employee_id",
                    "employeeId",
                  ])
                  if (employeeId === null) return null
                  return (
                    <option
                      key={`attendance-employee-${employeeId}-${index}`}
                      value={String(employeeId)}
                    >
                      {getEmployeeOptionLabel(employee)}
                    </option>
                  )
                })}
              </select>
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Branch</span>
              <select
                className={dailySummaryFilterControlClass}
                value={dailySummaryFilters.branch_id}
                onChange={(event) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    branch_id: event.target.value,
                  }))
                }
              >
                <option value="">All</option>
                {branches.map((branch, index) => {
                  const branchId = readNumberFromRow(branch, ["id", "branch_id", "branchId"])
                  if (branchId === null) return null
                  return (
                    <option
                      key={`attendance-branch-${branchId}-${index}`}
                      value={String(branchId)}
                    >
                      {getBranchOptionLabel(branch)}
                    </option>
                  )
                })}
              </select>
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Status</span>
              <select
                className={dailySummaryFilterControlClass}
                value={dailySummaryFilters.status}
                onChange={(event) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="">All</option>
                {DAILY_SUMMARY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {prettifyLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Rows</span>
              <select
                className={dailySummaryFilterControlClass}
                value={String(dailySummaryPageSize)}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setDailySummaryPageSize(
                    Number.isFinite(next) && next > 0 ? next : DEFAULT_DAILY_SUMMARY_PAGE_SIZE
                  )
                  setDailySummaryPage(1)
                }}
                aria-label="Number of records to display"
              >
                {DAILY_SUMMARY_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>After</span>
              <TimeClockPicker
                value={dailySummaryFilters.check_in_after}
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    check_in_after: value,
                  }))
                }
                placeholder="Any"
                aria-label="Only show check-ins after this time"
                className={dailySummaryFilterControlClass}
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Before</span>
              <TimeClockPicker
                value={dailySummaryFilters.check_in_before}
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    check_in_before: value,
                  }))
                }
                placeholder="Any"
                aria-label="Only show check-ins before this time"
                className={dailySummaryFilterControlClass}
              />
            </label>
          </div>

          <div className="flex items-center gap-0.5 border-t border-border/70 pt-1.5">
            <span className="mr-auto text-[9px] text-muted-foreground">Export</span>
            <button
              type="button"
              className="inline-flex h-5 items-center rounded border border-slate-300 bg-white px-1.5 text-[9px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]"
              onClick={() => void exportDailySummaryReport("xlsx")}
              disabled={attendanceExporting}
            >
              {attendanceExporting ? "…" : "XLSX"}
            </button>
            <button
              type="button"
              className="inline-flex h-5 items-center rounded border border-slate-300 bg-white px-1.5 text-[9px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]"
              onClick={() => void exportDailySummaryReport("csv")}
              disabled={attendanceExporting}
            >
              CSV
            </button>
            <button
              type="button"
              className="inline-flex h-5 items-center rounded border border-slate-300 bg-white px-1.5 text-[9px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]"
              onClick={() => void exportDailySummaryReport("pdf")}
              disabled={attendanceExporting}
            >
              PDF
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ) : null

  const refreshButton = (
    <button
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      type="button"
      disabled={loading}
      aria-label="Refresh"
      title="Refresh"
      onClick={() => {
        setMessage(null)
        void fetchSectionData(true)
      }}
    >
      <RefreshCwIcon className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
    </button>
  )

  const sectionTitleBlock = (
    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {config.groupTitle}
      </span>
      {config.groupTitle !== "My Attendance" ? (
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {config.title}
        </h1>
      ) : null}
    </div>
  )

  return (
    <div className="space-y-4">
      <DoodleSprites />
      {/* Daily summaries + recalculation jobs host titles/actions on the table toolbar row. */}
      {activeSection !== "daily-summaries" && activeSection !== "recalculation-jobs" ? (
        <div className="flex flex-nowrap items-center justify-between gap-2">
          {sectionTitleBlock}
          <div className="flex shrink-0 items-center gap-1">
            {activeSection === "corrections" && (
              <button
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
                type="button"
                onClick={() => setCorrectionDialogOpen(true)}
              >
                <PlusIcon className="size-3.5 text-primary" />
                Request correction
              </button>
            )}
            {activeSection === "attendance-history" && (
              <>
                <Popover>
                  <PopoverTrigger
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted"
                    aria-label="Filter by date"
                    title="Filter by date"
                  >
                    <Filter className="size-3.5 text-primary" />
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="end">
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-foreground">Filter by date range</div>
                      <div className="grid gap-3">
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">From date</span>
                          <DatePickerPresets
                            value={historyFilters.from_date}
                            onChange={(value) =>
                              setHistoryFilters((current) => ({ ...current, from_date: value }))
                            }
                            placeholder="From date"
                            className="h-8 text-xs"
                          />
                        </label>
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">To date</span>
                          <DatePickerPresets
                            value={historyFilters.to_date}
                            onChange={(value) =>
                              setHistoryFilters((current) => ({ ...current, to_date: value }))
                            }
                            placeholder="To date"
                            className="h-8 text-xs"
                          />
                        </label>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
                  title="Reset filters"
                  aria-label="Reset filters"
                  disabled={
                    !historyFilters.from_date &&
                    !historyFilters.to_date &&
                    !historyStatusFilter
                  }
                  onClick={() => {
                    setHistoryFilters({ from_date: "", to_date: "" })
                    setHistoryStatusFilter(null)
                  }}
                >
                  <RotateCcwIcon className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </>
            )}
            {refreshButton}
          </div>
        </div>
      ) : null}

      <div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-600">{message}</p> : null}

        {loading &&
        activeSection !== "daily-summaries" &&
        activeSection !== "recalculation-jobs" &&
        rows.length === 0 &&
        !singleRecord &&
        correctionRequests.length === 0 ? (
          <div className="mt-4">
            <AttendanceViewLoader label={`Loading ${config.title.toLowerCase()}…`} />
          </div>
        ) : null}

        {!loading && activeSection === "today" ? <TodayOverview record={singleRecord} /> : null}

        {!loading && activeSection === "attendance-history" ? (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No attendance history</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a different date range from the filter.
                </p>
              </div>
            ) : (
              (() => {
                const statusTallies = Object.entries(
                  rows.reduce<Record<string, number>>((acc, row) => {
                    const status =
                      readStringFromRow(row, [
                        "attendance_status",
                        "status",
                        "attendanceStatus",
                      ]) || "Unknown"
                    const key = status.trim() || "Unknown"
                    acc[key] = (acc[key] || 0) + 1
                    return acc
                  }, {})
                ).sort((a, b) => b[1] - a[1])

                const filteredRows = historyStatusFilter
                  ? rows.filter((row) => {
                      const status =
                        readStringFromRow(row, [
                          "attendance_status",
                          "status",
                          "attendanceStatus",
                        ]) || "Unknown"
                      return status.trim() === historyStatusFilter
                    })
                  : rows

                const animate = !prefersReducedMotion

                return (
                  <>
                    {/* Summary grids — click to filter; width hugs content (no empty right space) */}
                    <motion.div
                      className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
                      initial={animate ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <button
                        type="button"
                        onClick={() => setHistoryStatusFilter(null)}
                        className={cn(
                          "flex min-w-[4.5rem] shrink-0 cursor-pointer flex-col justify-center border-r border-border px-3 py-2 text-left transition",
                          historyStatusFilter === null
                            ? "bg-primary/10"
                            : "hover:bg-muted/40"
                        )}
                        title="Show all days"
                        aria-pressed={historyStatusFilter === null}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Days
                        </span>
                        <span className="text-base font-semibold tabular-nums text-foreground">
                          {rows.length}
                        </span>
                      </button>
                      {statusTallies.map(([status, count], index, arr) => {
                        const tone = attendanceHistoryStatusTone(status)
                        const isActive = historyStatusFilter === status
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() =>
                              setHistoryStatusFilter((current) =>
                                current === status ? null : status
                              )
                            }
                            className={cn(
                              "flex min-w-[5.5rem] shrink-0 cursor-pointer flex-col justify-center px-3 py-2 text-left transition",
                              tone.chip,
                              isActive
                                ? "ring-2 ring-inset ring-primary/40"
                                : "hover:brightness-95 dark:hover:brightness-110",
                              index < arr.length - 1 ? "border-r border-border/60" : null
                            )}
                            title={
                              isActive
                                ? `Clear ${status.replace(/[_-]+/g, " ")} filter`
                                : `Filter by ${status.replace(/[_-]+/g, " ")}`
                            }
                            aria-pressed={isActive}
                          >
                            <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              {status.replace(/[_-]+/g, " ")}
                            </span>
                            <span className={cn("text-base font-semibold tabular-nums", tone.count)}>
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </motion.div>

                    {historyStatusFilter ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Showing{" "}
                          <span className="font-semibold capitalize text-foreground">
                            {historyStatusFilter.replace(/[_-]+/g, " ")}
                          </span>{" "}
                          · {filteredRows.length} of {rows.length}
                        </span>
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => setHistoryStatusFilter(null)}
                        >
                          Clear status
                        </button>
                      </div>
                    ) : null}

                    {/* Day rows — animate on load and when filtering */}
                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      <AnimatePresence mode="popLayout">
                        {filteredRows.length === 0 ? (
                          <motion.div
                            key="empty-filter"
                            initial={animate ? { opacity: 0, y: 8 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            exit={animate ? { opacity: 0 } : undefined}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            No days match this status.
                          </motion.div>
                        ) : (
                          filteredRows.map((row, index) => {
                            const dateRaw =
                              readStringFromRow(row, [
                                "attendance_date",
                                "date",
                                "attendanceDate",
                              ]) || null
                            const status =
                              readStringFromRow(row, [
                                "attendance_status",
                                "status",
                                "attendanceStatus",
                              ]) || "—"
                            const tone = attendanceHistoryStatusTone(status)
                            const checkIn = readFirstValue(row, [
                              "check_in_at",
                              "checkInAt",
                              "first_punch",
                              "first_punch_at",
                            ])
                            const checkOut = readFirstValue(row, [
                              "check_out_at",
                              "checkOutAt",
                              "last_punch",
                              "last_punch_at",
                            ])
                            const worked = readFirstValue(row, [
                              "work_minutes",
                              "worked_minutes",
                              "workMinutes",
                              "workedMinutes",
                            ])
                            const remarks = readStringFromRow(row, [
                              "remarks",
                              "notes",
                              "comment",
                            ])
                            const inLabel = formatHistoryTimeLabel(checkIn)
                            const outLabel = formatHistoryTimeLabel(checkOut)
                            const missingIn = inLabel === "—"
                            const missingOut = outLabel === "—"
                            const rowKey = String(row.id ?? `${dateRaw}-${status}-${index}`)

                            return (
                              <motion.div
                                key={rowKey}
                                layout={animate}
                                initial={
                                  animate
                                    ? { opacity: 0, y: 10, scale: 0.99 }
                                    : false
                                }
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  scale: 1,
                                  transition: {
                                    type: "spring",
                                    stiffness: 420,
                                    damping: 28,
                                    mass: 0.7,
                                    delay: Math.min(index, 12) * 0.02,
                                  },
                                }}
                                exit={
                                  animate
                                    ? { opacity: 0, y: -6, transition: { duration: 0.12 } }
                                    : undefined
                                }
                                className="flex bg-background transition-colors hover:bg-muted/25"
                              >
                                <div className={cn("w-1 shrink-0", tone.bar)} />
                                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                                  <div className="w-[8rem] shrink-0 sm:w-[9.5rem]">
                                    <div className="text-xs font-medium text-foreground">
                                      {formatHistoryDateLabel(dateRaw)}
                                    </div>
                                    <div
                                      className={cn(
                                        "mt-0.5 text-[11px] font-semibold capitalize",
                                        tone.label
                                      )}
                                    >
                                      {status.replace(/[_-]+/g, " ")}
                                    </div>
                                  </div>

                                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Check in
                                      </div>
                                      <div
                                        className={cn(
                                          "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                                          missingIn
                                            ? "text-muted-foreground/45"
                                            : "text-primary"
                                        )}
                                      >
                                        {inLabel}
                                      </div>
                                    </div>
                                    <div className="text-muted-foreground/40" aria-hidden>
                                      →
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Check out
                                      </div>
                                      <div
                                        className={cn(
                                          "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                                          missingOut
                                            ? "text-muted-foreground/45"
                                            : "text-primary"
                                        )}
                                      >
                                        {outLabel}
                                      </div>
                                    </div>
                                    <div className="hidden min-w-[4.5rem] shrink-0 text-right sm:block">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Worked
                                      </div>
                                      <div className="text-sm font-semibold tabular-nums text-foreground">
                                        {formatMinutesLabel(worked)}
                                      </div>
                                    </div>
                                  </div>

                                  {remarks ? (
                                    <p className="hidden max-w-[8rem] truncate text-[11px] text-muted-foreground lg:block">
                                      {remarks}
                                    </p>
                                  ) : null}
                                </div>
                              </motion.div>
                            )
                          })
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )
              })()
            )}
          </div>
        ) : null}

        {!loading && activeSection === "schedule-preview" ? (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No schedule preview</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No scheduled days were returned for your account.
                </p>
              </div>
            ) : (
              (() => {
                const kindTallies = Object.entries(
                  rows.reduce<Record<string, number>>((acc, row) => {
                    const kind = schedulePreviewDayKind(row)
                    acc[kind] = (acc[kind] || 0) + 1
                    return acc
                  }, {})
                ).sort((a, b) => b[1] - a[1])

                const filteredRows = scheduleKindFilter
                  ? rows.filter((row) => schedulePreviewDayKind(row) === scheduleKindFilter)
                  : rows

                const animate = !prefersReducedMotion

                return (
                  <>
                    <motion.div
                      className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
                      initial={animate ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <button
                        type="button"
                        onClick={() => setScheduleKindFilter(null)}
                        className={cn(
                          "flex min-w-[4.5rem] shrink-0 cursor-pointer flex-col justify-center border-r border-border px-3 py-2 text-left transition",
                          scheduleKindFilter === null ? "bg-primary/10" : "hover:bg-muted/40"
                        )}
                        title="Show all days"
                        aria-pressed={scheduleKindFilter === null}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Days
                        </span>
                        <span className="text-base font-semibold tabular-nums text-foreground">
                          {rows.length}
                        </span>
                      </button>
                      {kindTallies.map(([kind, count], index, arr) => {
                        const tone = schedulePreviewKindTone(kind)
                        const isActive = scheduleKindFilter === kind
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() =>
                              setScheduleKindFilter((current) =>
                                current === kind ? null : kind
                              )
                            }
                            className={cn(
                              "flex min-w-[5.5rem] shrink-0 cursor-pointer flex-col justify-center px-3 py-2 text-left transition",
                              tone.chip,
                              isActive
                                ? "ring-2 ring-inset ring-primary/40"
                                : "hover:brightness-95 dark:hover:brightness-110",
                              index < arr.length - 1 ? "border-r border-border/60" : null
                            )}
                            title={
                              isActive
                                ? `Clear ${kind} filter`
                                : `Filter by ${kind}`
                            }
                            aria-pressed={isActive}
                          >
                            <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              {kind}
                            </span>
                            <span className={cn("text-base font-semibold tabular-nums", tone.count)}>
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </motion.div>

                    {scheduleKindFilter ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Showing{" "}
                          <span className="font-semibold text-foreground">{scheduleKindFilter}</span>{" "}
                          · {filteredRows.length} of {rows.length}
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-primary hover:underline"
                          onClick={() => setScheduleKindFilter(null)}
                        >
                          Clear filter
                        </button>
                      </div>
                    ) : null}

                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      <AnimatePresence mode="popLayout">
                        {filteredRows.length === 0 ? (
                          <motion.div
                            key="schedule-empty"
                            initial={animate ? { opacity: 0, y: 8 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            exit={animate ? { opacity: 0 } : undefined}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            No days match this filter.
                          </motion.div>
                        ) : (
                          filteredRows.map((row, index) => {
                            const shift = readNestedRecord(row, ["shift"])
                            const timetable = readNestedRecord(row, ["timetable"])
                            const kind = schedulePreviewDayKind(row)
                            const tone = schedulePreviewKindTone(kind)
                            const isOffDay = kind === "Off Day" || kind === "Holiday"
                            const dateRaw =
                              readStringFromRow(row, ["date", "attendance_date"]) ||
                              String(readFirstValue(row, ["date", "attendance_date"]) ?? "")
                            const shiftName = isOffDay
                              ? kind
                              : readStringFromRow(shift ?? row, [
                                  "name",
                                  "shift_name",
                                  "code",
                                  "schedule_name",
                                ]) || "—"
                            const startRaw = !shift || isOffDay
                              ? null
                              : readWithFallback(shift, ["start_time", "startTime"], row)
                            const endRaw = !shift || isOffDay
                              ? null
                              : readWithFallback(shift, ["end_time", "endTime"], row)
                            const startLabel = formatHistoryTimeLabel(startRaw ?? "—")
                            const endLabel = formatHistoryTimeLabel(endRaw ?? "—")
                            const missingStart = startLabel === "—"
                            const missingEnd = endLabel === "—"
                            const expectedWork = isOffDay
                              ? "—"
                              : formatMinutesLabel(
                                  readWithFallback(shift, ["expected_work_minutes"], row)
                                )
                            const timetableName = timetable
                              ? readStringFromRow(timetable, ["name", "code"])
                              : null
                            const rowKey = String(row.id ?? row.date ?? `${kind}-${index}`)

                            return (
                              <motion.div
                                key={rowKey}
                                layout={animate}
                                initial={
                                  animate ? { opacity: 0, y: 10, scale: 0.99 } : false
                                }
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  scale: 1,
                                  transition: {
                                    type: "spring",
                                    stiffness: 420,
                                    damping: 28,
                                    mass: 0.7,
                                    delay: Math.min(index, 12) * 0.02,
                                  },
                                }}
                                exit={
                                  animate
                                    ? { opacity: 0, y: -6, transition: { duration: 0.12 } }
                                    : undefined
                                }
                                className="flex bg-background transition-colors hover:bg-muted/25"
                              >
                                <div className={cn("w-1 shrink-0", tone.bar)} />
                                <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
                                  <div className="w-[8rem] shrink-0 sm:w-[9.5rem]">
                                    <div className="text-xs font-medium text-foreground">
                                      {formatHistoryDateLabel(dateRaw || null)}
                                    </div>
                                    <div
                                      className={cn(
                                        "mt-0.5 text-[11px] font-semibold",
                                        tone.label
                                      )}
                                    >
                                      {kind}
                                    </div>
                                  </div>

                                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Start
                                      </div>
                                      <div
                                        className={cn(
                                          "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                                          missingStart
                                            ? "text-muted-foreground/45"
                                            : "text-primary"
                                        )}
                                      >
                                        {startLabel}
                                      </div>
                                    </div>
                                    <div className="text-muted-foreground/40" aria-hidden>
                                      →
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        End
                                      </div>
                                      <div
                                        className={cn(
                                          "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                                          missingEnd
                                            ? "text-muted-foreground/45"
                                            : "text-primary"
                                        )}
                                      >
                                        {endLabel}
                                      </div>
                                    </div>
                                    <div className="hidden min-w-[5.5rem] shrink-0 sm:block">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Shift
                                      </div>
                                      <div className="truncate text-sm font-semibold text-foreground">
                                        {shiftName}
                                      </div>
                                    </div>
                                    <div className="hidden min-w-[4.5rem] shrink-0 text-right sm:block">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Expected
                                      </div>
                                      <div className="text-sm font-semibold tabular-nums text-foreground">
                                        {expectedWork}
                                      </div>
                                    </div>
                                  </div>

                                  {timetableName ? (
                                    <p className="hidden max-w-[7rem] truncate text-[11px] text-muted-foreground lg:block">
                                      {timetableName}
                                    </p>
                                  ) : null}
                                </div>
                              </motion.div>
                            )
                          })
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )
              })()
            )}
          </div>
        ) : null}

        {!loading && activeSection === "corrections" ? (
          <div className="space-y-3">
            {correctionRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No correction requests</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use “Request correction” to create one.
                </p>
              </div>
            ) : (
              (() => {
                const statusTallies = Object.entries(
                  correctionRequests.reduce<Record<string, number>>((acc, row) => {
                    const status = (
                      readFirstValue(row, ["status"]) ?? "draft"
                    )
                      .toString()
                      .trim()
                      .toLowerCase() || "draft"
                    acc[status] = (acc[status] || 0) + 1
                    return acc
                  }, {})
                ).sort((a, b) => b[1] - a[1])

                const filteredRequests = correctionStatusFilter
                  ? correctionRequests.filter((row) => {
                      const status = (
                        readFirstValue(row, ["status"]) ?? "draft"
                      )
                        .toString()
                        .trim()
                        .toLowerCase()
                      return status === correctionStatusFilter
                    })
                  : correctionRequests

                const animate = !prefersReducedMotion

                return (
                  <>
                    <motion.div
                      className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
                      initial={animate ? { opacity: 0, y: 8 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectionStatusFilter(null)}
                        className={cn(
                          "flex min-w-[4.5rem] shrink-0 cursor-pointer flex-col justify-center border-r border-border px-3 py-2 text-left transition",
                          correctionStatusFilter === null
                            ? "bg-primary/10"
                            : "hover:bg-muted/40"
                        )}
                        title="Show all requests"
                        aria-pressed={correctionStatusFilter === null}
                      >
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          All
                        </span>
                        <span className="text-base font-semibold tabular-nums text-foreground">
                          {correctionRequests.length}
                        </span>
                      </button>
                      {statusTallies.map(([status, count], index, arr) => {
                        const tone = correctionRequestStatusTone(status)
                        const isActive = correctionStatusFilter === status
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() =>
                              setCorrectionStatusFilter((current) =>
                                current === status ? null : status
                              )
                            }
                            className={cn(
                              "flex min-w-[5.5rem] shrink-0 cursor-pointer flex-col justify-center px-3 py-2 text-left transition",
                              tone.chip,
                              isActive
                                ? "ring-2 ring-inset ring-primary/40"
                                : "hover:brightness-95 dark:hover:brightness-110",
                              index < arr.length - 1 ? "border-r border-border/60" : null
                            )}
                            title={
                              isActive
                                ? `Clear ${status} filter`
                                : `Filter by ${status}`
                            }
                            aria-pressed={isActive}
                          >
                            <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              {status.replace(/[_-]+/g, " ")}
                            </span>
                            <span className={cn("text-base font-semibold tabular-nums", tone.count)}>
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </motion.div>

                    {correctionStatusFilter ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          Showing{" "}
                          <span className="font-semibold capitalize text-foreground">
                            {correctionStatusFilter.replace(/[_-]+/g, " ")}
                          </span>{" "}
                          · {filteredRequests.length} of {correctionRequests.length}
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer font-medium text-primary hover:underline"
                          onClick={() => setCorrectionStatusFilter(null)}
                        >
                          Clear status
                        </button>
                      </div>
                    ) : null}

                    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                      <AnimatePresence mode="popLayout">
                        {filteredRequests.length === 0 ? (
                          <motion.div
                            key="corrections-empty"
                            initial={animate ? { opacity: 0, y: 8 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            exit={animate ? { opacity: 0 } : undefined}
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                          >
                            No requests match this status.
                          </motion.div>
                        ) : (
                          filteredRequests.map((row, index) => {
                            const id = readFirstValue(row, ["id"]) ?? `${index}`
                            const status = (
                              readFirstValue(row, ["status"]) ?? "draft"
                            )
                              .toString()
                              .trim()
                              .toLowerCase()
                            const tone = correctionRequestStatusTone(status)
                            const canSubmit = status === "draft"
                            const canCancel = ["draft", "submitted"].includes(status)
                            const requestType = prettifyLabel(
                              readFirstValue(row, ["request_type", "requestType"]) ??
                                "attendance correction"
                            )
                            const attendanceDate = formatOptionalValue(
                              readFirstValue(row, ["attendance_date", "attendanceDate"]),
                              "—"
                            )
                            const reason = formatOptionalValue(
                              readFirstValue(row, ["reason"]),
                              "No reason"
                            )
                            const requestedIn = formatHistoryTimeLabel(
                              readFirstValue(row, [
                                "requested_check_in_at",
                                "requestedCheckInAt",
                                "requested_check_in",
                              ])
                            )
                            const requestedOut = formatHistoryTimeLabel(
                              readFirstValue(row, [
                                "requested_check_out_at",
                                "requestedCheckOutAt",
                                "requested_check_out",
                              ])
                            )
                            const requestedStatus = formatOptionalValue(
                              readFirstValue(row, ["requested_status", "requestedStatus"]),
                              "—"
                            )
                            const hasPunchRequest =
                              requestedIn !== "—" || requestedOut !== "—"

                            return (
                              <motion.div
                                key={String(id)}
                                layout={animate}
                                initial={
                                  animate ? { opacity: 0, y: 10, scale: 0.99 } : false
                                }
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  scale: 1,
                                  transition: {
                                    type: "spring",
                                    stiffness: 420,
                                    damping: 28,
                                    mass: 0.7,
                                    delay: Math.min(index, 12) * 0.02,
                                  },
                                }}
                                exit={
                                  animate
                                    ? { opacity: 0, y: -6, transition: { duration: 0.12 } }
                                    : undefined
                                }
                                className="flex bg-background transition-colors hover:bg-muted/25"
                              >
                                <div className={cn("w-1 shrink-0", tone.bar)} />
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-3 py-2 sm:flex-nowrap">
                                  <div className="w-[8.5rem] shrink-0 sm:w-[10rem]">
                                    <div className="text-xs font-medium text-foreground">
                                      {formatHistoryDateLabel(
                                        attendanceDate === "—" ? null : attendanceDate
                                      )}
                                    </div>
                                    <div
                                      className={cn(
                                        "mt-0.5 text-[11px] font-semibold capitalize",
                                        tone.label
                                      )}
                                    >
                                      {status.replace(/[_-]+/g, " ")}
                                    </div>
                                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                      {requestType}
                                    </div>
                                  </div>

                                  <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                    {hasPunchRequest ? (
                                      <>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Req. in
                                          </div>
                                          <div
                                            className={cn(
                                              "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                                              requestedIn === "—"
                                                ? "text-muted-foreground/45"
                                                : "text-primary"
                                            )}
                                          >
                                            {requestedIn}
                                          </div>
                                        </div>
                                        <div className="text-muted-foreground/40" aria-hidden>
                                          →
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Req. out
                                          </div>
                                          <div
                                            className={cn(
                                              "text-base font-semibold tabular-nums leading-tight sm:text-lg",
                                              requestedOut === "—"
                                                ? "text-muted-foreground/45"
                                                : "text-primary"
                                            )}
                                          >
                                            {requestedOut}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                          Requested status
                                        </div>
                                        <div className="text-sm font-semibold capitalize text-primary">
                                          {String(requestedStatus).replace(/[_-]+/g, " ")}
                                        </div>
                                      </div>
                                    )}
                                    <div className="hidden min-w-0 max-w-[12rem] flex-1 sm:block">
                                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                        Reason
                                      </div>
                                      <div className="truncate text-xs text-foreground">
                                        {reason}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1.5">
                                    {canSubmit ? (
                                      <button
                                        className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                        type="button"
                                        disabled={correctionBusy}
                                        onClick={() => setPendingCorrectionAction({ id, action: "submit" })}
                                      >
                                        Submit
                                      </button>
                                    ) : null}
                                    {canCancel ? (
                                      <button
                                        className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-border px-2.5 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40"
                                        type="button"
                                        disabled={correctionBusy}
                                        onClick={() => setPendingCorrectionAction({ id, action: "cancel" })}
                                      >
                                        Cancel
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )
              })()
            )}
          </div>
        ) : null}

        {activeSection === "daily-summaries" ? (
          <div className="space-y-2">
            {dailySummaryActiveFilterCount > 0 ? (
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">Active:</span>
                {(() => {
                  const today = getTodayDateInputValue()
                  const customRange =
                    appliedDailySummaryFilters.from_date !== today ||
                    appliedDailySummaryFilters.to_date !== today
                  if (!customRange) return null
                  return (
                    <span className="rounded border border-border bg-muted/40 px-1.5 py-px">
                      {appliedDailySummaryFilters.from_date || "…"}
                      →
                      {appliedDailySummaryFilters.to_date || "…"}
                    </span>
                  )
                })()}
                {appliedDailySummaryFilters.employee_id ? (
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-px">
                    Emp #{appliedDailySummaryFilters.employee_id}
                  </span>
                ) : null}
                {appliedDailySummaryFilters.branch_id ? (
                  <span className="max-w-[8rem] truncate rounded border border-border bg-muted/40 px-1.5 py-px">
                    {branchNameById.get(appliedDailySummaryFilters.branch_id) ||
                      `Br #${appliedDailySummaryFilters.branch_id}`}
                  </span>
                ) : null}
                {appliedDailySummaryFilters.status ? (
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-px">
                    {prettifyLabel(appliedDailySummaryFilters.status)}
                  </span>
                ) : null}
                {appliedDailySummaryFilters.check_in_after ? (
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-px">
                    ≥{appliedDailySummaryFilters.check_in_after}
                  </span>
                ) : null}
                {appliedDailySummaryFilters.check_in_before ? (
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-px">
                    ≤{appliedDailySummaryFilters.check_in_before}
                  </span>
                ) : null}
                {dailySummaryPageSize !== DEFAULT_DAILY_SUMMARY_PAGE_SIZE ? (
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-px">
                    {dailySummaryPageSize}/pg
                  </span>
                ) : null}
                {recordSearch.trim() ? (
                  <span className="max-w-[7rem] truncate rounded border border-border bg-muted/40 px-1.5 py-px">
                    “{recordSearch.trim()}”
                  </span>
                ) : null}
                <button
                  type="button"
                  className="text-[10px] font-medium text-primary hover:underline"
                  onClick={resetDailySummaryFiltersToToday}
                >
                  Clear
                </button>
              </div>
            ) : null}
            <TableBlock
              rows={displayedDailySummaryRows}
              section={activeSection}
              loading={loading}
              itemsPerPage={
                recordSearch.trim()
                  ? Math.max(displayedDailySummaryRows.length, 1)
                  : dailySummaryPageSize
              }
              page={recordSearch.trim() ? 1 : dailySummaryPage}
              totalPages={recordSearch.trim() ? 1 : dailySummaryTotalPages}
              totalItems={
                recordSearch.trim()
                  ? displayedDailySummaryRows.length
                  : dailySummaryTotal
              }
              // While free-text searching, page over the filtered subset only (no server page jumps).
              onPageChange={recordSearch.trim() ? undefined : setDailySummaryPage}
              toolbarStart={sectionTitleBlock}
              toolbarActions={
                <>
                  <label className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-background px-1 text-[10px] text-muted-foreground">
                    <span className="hidden sm:inline pl-0.5">Rows</span>
                    <select
                      className="h-5 max-w-[3.25rem] cursor-pointer rounded border-0 bg-transparent py-0 pl-0.5 pr-0 text-[10px] font-medium text-foreground outline-none"
                      value={String(dailySummaryPageSize)}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setDailySummaryPageSize(
                          Number.isFinite(next) && next > 0
                            ? next
                            : DEFAULT_DAILY_SUMMARY_PAGE_SIZE
                        )
                        setDailySummaryPage(1)
                      }}
                      aria-label="Number of records to display"
                      title="Records per page"
                    >
                      {DAILY_SUMMARY_PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  {dailySummaryFilterPopover}
                  {refreshButton}
                </>
              }
            />
          </div>
        ) : null}

        {/* Date filter is now in the popover next to refresh icon for attendance-history */}

        {/* Punch Action is only available in the native mobile app (iOS/Android). No content shown in browser. */}

        {activeSection === "recalculation-jobs" ? (
          <TableBlock
            rows={rows}
            section={activeSection}
            loading={loading}
            toolbarStart={sectionTitleBlock}
            toolbarActions={
              <>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={recalcActionBusy || loading}
                  onClick={() => void runPendingJobs()}
                  title="Run pending jobs"
                >
                  <AlarmClockCheckIcon className="size-3.5" />
                  <span className="hidden sm:inline">Run pending</span>
                </button>

                <Popover open={rebuildFormOpen} onOpenChange={setRebuildFormOpen}>
                  <PopoverTrigger
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted"
                    aria-label="Refresh daily summaries"
                    title="Refresh daily summaries"
                  >
                    <TimerResetIcon className="size-3.5 text-primary" />
                    <span className="hidden sm:inline">Rebuild</span>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(100vw-1.5rem,19rem)] p-2.5" align="end">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Refresh summaries
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <label className="grid min-w-0 gap-0.5 text-[10px]">
                          <span className="font-medium text-slate-600 dark:text-slate-300">Start</span>
                          <DatePickerPresets
                            value={recalculateValues.start_date}
                            onChange={(value) =>
                              setRecalculateValues((current) => ({ ...current, start_date: value }))
                            }
                            placeholder="Start"
                            className="h-7 gap-1 border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-3"
                          />
                        </label>
                        <label className="grid min-w-0 gap-0.5 text-[10px]">
                          <span className="font-medium text-slate-600 dark:text-slate-300">End</span>
                          <DatePickerPresets
                            value={recalculateValues.end_date}
                            onChange={(value) =>
                              setRecalculateValues((current) => ({ ...current, end_date: value }))
                            }
                            placeholder="End"
                            className="h-7 gap-1 border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-3"
                          />
                        </label>
                      </div>
                      <input
                        className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
                        placeholder="Employee ID (optional)"
                        value={recalculateValues.employee_id}
                        onChange={(event) =>
                          setRecalculateValues((current) => ({
                            ...current,
                            employee_id: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
                        placeholder="Device ID (optional)"
                        value={recalculateValues.device_id}
                        onChange={(event) =>
                          setRecalculateValues((current) => ({
                            ...current,
                            device_id: event.target.value,
                          }))
                        }
                      />
                      <select
                        className="h-7 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
                        value={recalculateValues.processing_source}
                        onChange={(event) => {
                          const processing_source = event.target.value
                          setRecalculateValues((current) => ({
                            ...current,
                            processing_source,
                            // Keep legacy mode in sync with processing_source defaults from the API sample.
                            mode:
                              processing_source === "fetch_and_process"
                                ? "from_raw_logs"
                                : current.mode === "from_raw_logs"
                                  ? "from_raw_logs"
                                  : "summaries_only",
                          }))
                        }}
                        aria-label="Processing source"
                      >
                        <option value="database_only">Database only</option>
                        <option value="fetch_and_process">Fetch from device &amp; process</option>
                      </select>
                      <select
                        className="h-7 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
                        value={recalculateValues.mode}
                        onChange={(event) =>
                          setRecalculateValues((current) => ({
                            ...current,
                            mode: event.target.value,
                          }))
                        }
                        aria-label="Refresh mode"
                      >
                        <option value="from_raw_logs">From raw logs</option>
                        <option value="summaries_only">Summaries only</option>
                      </select>
                      <select
                        className="h-7 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
                        value={recalculateValues.execution_mode}
                        onChange={(event) => {
                          const execution_mode = event.target.value
                          setRecalculateValues((current) => ({
                            ...current,
                            execution_mode,
                            execution: execution_mode === "immediate" ? "sync" : "async",
                          }))
                        }}
                        aria-label="Execution mode"
                      >
                        <option value="background">Background</option>
                        <option value="immediate">Immediate</option>
                      </select>
                      <button
                        type="button"
                        className="inline-flex h-7 w-full items-center justify-center rounded-md bg-primary px-2 text-[11px] font-semibold !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={recalcActionBusy}
                        onClick={() => void queueRecalculation()}
                      >
                        {recalcActionBusy ? "Starting…" : "Start rebuild"}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {refreshButton}
              </>
            }
          />
        ) : null}

        {!loading &&
        activeSection !== "daily-summaries" &&
        activeSection !== "today" &&
        activeSection !== "attendance-history" &&
        activeSection !== "schedule-preview" &&
        activeSection !== "recalculation-jobs" &&
        activeSection !== "corrections" ? (
          <div className="mt-6">
            <TableBlock rows={rows} section={activeSection} loading={loading} />
          </div>
        ) : null}


      </div>

      <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request attendance correction</DialogTitle>
            <DialogDescription>Create a correction request for an incorrect or missing attendance record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Attendance date</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  type="date"
                  value={correctionForm.attendance_date}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, attendance_date: event.target.value }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Request type</span>
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  value={correctionForm.request_type}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, request_type: event.target.value }))}
                >
                  <option value="check_in">Check in</option>
                  <option value="check_out">Check out</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Requested check-in time</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  type="time"
                  value={correctionForm.requested_check_in_at}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, requested_check_in_at: event.target.value }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Requested check-out time</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  type="time"
                  value={correctionForm.requested_check_out_at}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, requested_check_out_at: event.target.value }))}
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Requested status</span>
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={correctionForm.requested_status}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, requested_status: event.target.value }))}
              >
                {DAILY_SUMMARY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {prettifyLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Reason</span>
              <Textarea
                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={correctionForm.reason}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Explain what should be corrected."
              />
            </label>
          </div>
          <DialogFooter>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={() => setCorrectionDialogOpen(false)}
            >
              Close
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={correctionBusy}
              onClick={() => void submitCorrectionRequest()}
            >
              Create request
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
