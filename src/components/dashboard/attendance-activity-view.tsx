"use client"

import { AttendanceTodayPanel } from "@/components/dashboard/dashboard-attendance-actions"
import type { AttendanceDailySummaryStatusCounts } from "@/lib/admin-api"
import {
  ARRIVAL_STATUS,
  DEPARTURE_STATUS,
  DIMENSION_FILTERS,
  PRIMARY_STATUS,
  PUNCH_STATUS,
  dimensionDef,
  primaryStatusLabel,
  readAttendanceDimensions,
} from "@/lib/attendance-status"
import { DateInput } from "@/components/ui/date-input"
import { DateTimeInput } from "@/components/ui/date-time-input"
import * as React from "react"
import {
  Button,
  Field,
  Input,
  Skeleton,
  SkeletonItem,
  Tab,
  TabList,
} from "@fluentui/react-components"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import {
  Add20Regular,
  ArrowReset20Regular,
  ArrowSync20Regular,
  Building20Regular,
  Calendar20Regular,
  CheckmarkCircle16Regular,
  ChevronDown20Regular,
  ClockAlarm20Regular,
  Code20Regular,
  Desktop20Regular,
  DismissCircle16Regular,
  Edit20Regular,
  Filter20Regular,
  PersonQuestionMark20Regular,
  Warning20Regular,
} from "@fluentui/react-icons"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useAuth } from "@/hooks/useAuth"
import { ResizableTable } from "@/components/ui/resizable-table"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { TimeClockPicker } from "@/components/ui/time-clock-picker"
import { TimeInput } from "@/components/ui/time-input"
import { Textarea } from "@/components/ui/textarea"
import { FluentSelect } from "@/components/ui/fluent-select"
import { toast } from "@/components/ui/fluent-toast-store"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  ATTENDANCE_PAGE_STACK,
  AttendanceEmployeeCell,
  AttendanceExportButton,
  AttendancePageHead,
  formatWorkedMinutes,
  downloadAttendanceCsv,
  AttendanceShiftTimeline,
  AttendanceStatusBadge,
  AttendanceStatusCounters,
  attendanceStatusTone,
  buildStatusCounters,
  normalizeStatusKey,
  prettifyStatus,
} from "@/components/dashboard/attendance-ops-ui"
import {
  cancelMyAttendanceCorrectionRequest,
  addMyAttendanceCorrectionDocument,
  clearAttendanceDailySummaryAdjustment,
  createMyAttendanceCorrectionRequest,
  downloadAttendanceReport,
  getAttendanceDailySummary,
  getMyAttendanceCorrectionRequest,
  getMyAttendanceSchedule,
  getMyAttendanceToday,
  listAttendanceProcessingExceptionsPage,
  listAttendanceUnmatchedLogsPage,
  listAttendanceProcessingJobsPage,
  getAttendanceProcessingExceptionStatusCounts,
  listMyAttendanceCorrectionRequests,
  refreshAttendanceDailySummaries,
  listAttendanceDailySummariesPage,
  getAttendanceDailySummaryStatusCounts,
  listAttendanceDevices,
  listBranches,
  listEmployees,
  listMyAttendanceHistory,
  runPendingAttendanceProcessingJobs,
  submitMyAttendanceCorrectionRequest,
  updateMyAttendanceCorrectionRequest,
  fileToBase64UploadDto,
  updateAttendanceProcessingException,
  upsertAttendanceDailySummaryAdjustment,
  type AdminRecord,
  type RefreshAttendanceDailySummariesInput,
} from "@/lib/admin-api"
import {
  readDirectoryEmployeeId,
  readPrimaryEmployeeId,
} from "@/lib/attendance-daily-summary-search"
import { cn } from "@/lib/utils"
import { getSelfServiceStatusMeta } from "@/components/dashboard/self-service-approval-timeline"
import { useDashboardMotion } from "@/lib/dashboard-motion"
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
  | "processing-exceptions"
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
// Must match the backend AttendanceDailyStatusEnum.
const DAILY_SUMMARY_STATUS_OPTIONS = [
  "PRESENT",
  "LATE",
  "EARLY_DEPARTURE",
  "LATE_AND_EARLY_DEPARTURE",
  "HALF_DAY",
  "OVERTIME",
  "ABSENT",
  "LEAVE",
  "ANNUAL_LEAVE",
  "SICK_LEAVE",
  "UNPAID_LEAVE",
  "OFF_DAY",
  "OFF_DAY_PRESENT",
  "HOLIDAY",
  "BUSINESS_TRIP",
  "OFFICIAL_DUTY",
  "NOT_TRACKED",
  "NO_SHIFT_SCHEDULE",
  "MANUAL_CORRECTION",
]

// Filter choices: every status, plus ON_LEAVE meaning any leave type
// (the backend expands it to LEAVE, ANNUAL_LEAVE, SICK_LEAVE, UNPAID_LEAVE).
const DAILY_SUMMARY_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "ON_LEAVE", label: "On leave (any type)" },
  ...DAILY_SUMMARY_STATUS_OPTIONS.map((status) => ({
    value: status,
    label: status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  })),
]

// Statuses an employee may request; must match the backend AttendanceDailyStatusEnum.
const CORRECTION_REQUESTED_STATUS_OPTIONS = [
  "PRESENT",
  "LATE",
  "EARLY_DEPARTURE",
  "HALF_DAY",
  "ABSENT",
  "OFF_DAY_PRESENT",
  "OFFICIAL_DUTY",
  "BUSINESS_TRIP",
]

const CORRECTION_REQUEST_TYPE_OPTIONS = [
  { value: "check_in", label: "Missing / wrong check in" },
  { value: "check_out", label: "Missing / wrong check out" },
  { value: "check_in_and_check_out", label: "Check in and check out" },
  { value: "status_correction", label: "Wrong attendance status" },
]

function createEmptyCorrectionForm() {
  return {
    attendance_date: getTodayDateInputValue(),
    request_type: "check_in",
    requested_check_in_at: "",
    requested_check_out_at: "",
    requested_status: "PRESENT",
    reason: "",
  }
}

/** ISO timestamp → local "HH:mm" for a time input. */
function toTimeInputValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

const SECTION_CONFIG: Record<AttendanceActivitySectionKey, SectionConfig> = {
  "daily-summaries": {
    title: "Daily Summaries",
    groupTitle: "Attendance Operations",
    description: "Review processed daily attendance summaries returned by the attendance engine.",
  },
  "processing-exceptions": {
    title: "Processing Exceptions",
    groupTitle: "Attendance Operations",
    description: "Review unresolved attendance processing exceptions and resolve or ignore them.",
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
    title: "My Schedule",
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
  if (key.includes("returned")) {
    return {
      bar: "bg-orange-500",
      chip: "bg-orange-500/10 text-orange-900 dark:text-orange-300",
      label: "text-orange-700 dark:text-orange-300",
      count: "text-orange-700 dark:text-orange-300",
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

type SummaryFilterTab = {
  value: string | null
  label: string
  count: number
  countClassName?: string
}

function SummaryFilterTabs({
  ariaLabel,
  selectedValue,
  tabs,
  onSelectedValueChange,
}: {
  ariaLabel: string
  selectedValue: string | null
  tabs: SummaryFilterTab[]
  onSelectedValueChange: (value: string | null) => void
}) {
  const allValue = "__all__"
  const fluentSelectedValue = selectedValue ?? allValue

  return (
    <TabList
      aria-label={ariaLabel}
      appearance="subtle"
      size="small"
      selectedValue={fluentSelectedValue}
      onTabSelect={(_event, data) => {
        const value = String(data.value)
        const nextValue = value === allValue ? null : value
        onSelectedValueChange(nextValue === selectedValue ? null : nextValue)
      }}
      className="inline-flex max-w-full overflow-x-auto border-b border-border"
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.value ?? allValue}
          value={tab.value ?? allValue}
          className="min-w-fit shrink-0 !px-2.5"
        >
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[11px] font-medium">{tab.label}</span>
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground",
                tab.countClassName
              )}
            >
              {tab.count}
            </span>
          </span>
        </Tab>
      ))}
    </TabList>
  )
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
  const todayDims = readAttendanceDimensions(effective) ?? readAttendanceDimensions(record)

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
    ...(todayDims
      ? [
          { key: "status", label: "Status", value: primaryStatusLabel(todayDims), toneKey: todayDims.primary ?? statusRaw },
          { key: "arrival", label: "Arrival", value: dimensionDef(ARRIVAL_STATUS, todayDims.arrival).label, toneKey: todayDims.arrival === "LATE" ? "late" : todayDims.arrival ?? "" },
          { key: "departure", label: "Departure", value: dimensionDef(DEPARTURE_STATUS, todayDims.departure).label, toneKey: todayDims.departure ?? "" },
          { key: "record", label: "Record", value: dimensionDef(PUNCH_STATUS, todayDims.punch).label, toneKey: todayDims.punch ?? "" },
        ]
      : [{ key: "status", label: "Status", value: statusRaw.replace(/[_-]+/g, " "), toneKey: statusRaw }]),
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
        className="grid w-full grid-cols-2 items-stretch sm:grid-cols-4"
        initial={animate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        role="group"
        aria-label="Attendance summary"
      >
        {summaryChips.map((chip, index, arr) => {
          const chipTone = attendanceHistoryStatusTone(chip.toneKey)
          return (
            <div
              key={chip.key}
              className={cn(
                "flex min-w-0 flex-col justify-center px-3 py-2",
                chipTone.chip,
                index < arr.length - 1 ? "border-r border-border/60" : null,
                index < 2 ? "border-b border-border/60 sm:border-b-0" : null
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

const ATTENDANCE_EMPLOYEE_ID_KEYS = [
  "employee_id",
  "employeeId",
  "employeeID",
  "employee",
  "employee_record_id",
  "employeeRecordId",
  "company_user_id",
  "companyUserId",
  "companyUserID",
  "user_id",
  "userId",
  "userID",
]

const ATTENDANCE_EMPLOYEE_NO_KEYS = [
  "employee_no",
  "employeeNo",
  "employee_number",
  "employeeNumber",
  "employee_code",
  "employeeCode",
  "staff_no",
  "staffNo",
  "staff_number",
  "staffNumber",
]

const ATTENDANCE_EMPLOYEE_NAME_KEYS = [
  "employee_name",
  "employeeName",
  "full_name",
  "fullName",
  "display_name",
  "displayName",
  "name",
]

function collectEmployeeIdentityIds(record: AdminRecord | null | undefined) {
  const ids = new Set<number>()
  if (!record) {
    return ids
  }

  ATTENDANCE_EMPLOYEE_ID_KEYS.forEach((key) => {
    const id = readNumberFromRow(record, [key])
    if (id !== null) {
      ids.add(id)
    }
  })
  return ids
}

function readEmployeeIdentityLabel(row: AdminRecord) {
  const nestedEmployee =
    readNestedRecord(row, ["employee", "employeeDetail", "employee_details", "staff"]) ??
    readNestedRecord(readNestedRecord(row, ["attendance", "summary", "daily_summary", "dailySummary"]) ?? {}, [
      "employee",
      "employeeDetail",
    ])
  const nestedUser =
    readNestedRecord(row, ["user", "company_user", "companyUser"]) ??
    readNestedRecord(nestedEmployee ?? {}, ["user", "company_user", "companyUser"])

  const employeeNo =
    readFirstValue(row, ATTENDANCE_EMPLOYEE_NO_KEYS) ??
    readFirstValue(nestedEmployee, ATTENDANCE_EMPLOYEE_NO_KEYS) ??
    readFirstValue(nestedUser, ATTENDANCE_EMPLOYEE_NO_KEYS)
  const rawName =
    readFirstValue(row, ATTENDANCE_EMPLOYEE_NAME_KEYS) ??
    readFirstValue(nestedEmployee, ATTENDANCE_EMPLOYEE_NAME_KEYS) ??
    readFirstValue(nestedUser, ATTENDANCE_EMPLOYEE_NAME_KEYS) ??
    [
      readFirstValue(nestedEmployee, ["first_name", "firstName", "preferred_name", "preferredName"]) ??
        readFirstValue(nestedUser, ["first_name", "firstName"]),
      readFirstValue(nestedEmployee, ["middle_name", "middleName"]),
      readFirstValue(nestedEmployee, ["last_name", "lastName"]) ??
        readFirstValue(nestedUser, ["last_name", "lastName"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim()
  const employeeLabel = composeEmployeeIdentity(rawName || null, employeeNo)

  if (employeeLabel.name) {
    return employeeLabel.number ? `${employeeLabel.name} (${employeeLabel.number})` : employeeLabel.name
  }

  const employeeId = Array.from(collectEmployeeIdentityIds(row))[0] ?? null
  return employeeId === null ? "—" : `Employee ID ${employeeId}`
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

/** Client-side name search over loaded daily summary rows. */

/** Parse "HH:mm" or "H:mm" into minutes from midnight. */

/** Extract clock time (minutes) from a row field that may be time-only or ISO datetime. */


/** Client-side check-in time window (after / before). Rows without check-in are excluded when a time filter is set. */





function enrichRowsWithReadableNames(
  rows: AdminRecord[],
  branches: AdminRecord[],
  employees: AdminRecord[]
) {
  const branchNameById = new Map<number, string>()
  const employeeNameById = new Map<number, string>()
  const employeeNameByNumber = new Map<string, string>()

  branches.forEach((branch) => {
    const id = readNumberFromRow(branch, ["id", "branch_id"])
    const name = readStringFromRow(branch, ["name", "branch_name", "title"])
    if (id !== null && name) {
      branchNameById.set(id, name)
    }
  })

  employees.forEach((employee) => {
    const employeeNo = readStringFromRow(employee, ATTENDANCE_EMPLOYEE_NO_KEYS)
    const fullName =
      readStringFromRow(employee, ATTENDANCE_EMPLOYEE_NAME_KEYS) ??
      [employee.first_name, employee.middle_name, employee.last_name]
        .filter((value) => typeof value === "string" && value.trim())
        .join(" ")
        .trim()
    const label = composeEmployeeIdentity(fullName || null, employeeNo)
    const displayName = label.name
      ? label.number
        ? `${label.name} (${label.number})`
        : label.name
      : fullName
    const employeeId = readDirectoryEmployeeId(employee)
    if (displayName && employeeId !== null) {
      employeeNameById.set(employeeId, displayName)
    }
    if (displayName && employeeNo) {
      employeeNameByNumber.set(employeeNo.trim().toLowerCase(), displayName)
    }
  })

  return rows.map((row) => {
    const next = { ...row }
    const branchId = readNumberFromRow(row, ["branch_id", "branchId"])
    const employeeId = readPrimaryEmployeeId(row)

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

    if (!readStringFromRow(next, ["employee_name", "employeeName"])) {
      const employeeNo = readStringFromRow(row, ATTENDANCE_EMPLOYEE_NO_KEYS)
      const employeeName = employeeNo
        ? employeeNameByNumber.get(employeeNo.trim().toLowerCase())
        : undefined
      if (employeeName) {
        next.employee_name = employeeName
      }
    }

    const nestedEmployee = readNestedRecord(row, ["employee", "employeeDetail", "employee_details", "staff"])
    if (!readStringFromRow(next, ["employee_name", "employeeName"]) && nestedEmployee) {
      const nestedEmployeeNo = readStringFromRow(nestedEmployee, ATTENDANCE_EMPLOYEE_NO_KEYS)
      const nestedEmployeeName =
        readStringFromRow(nestedEmployee, ATTENDANCE_EMPLOYEE_NAME_KEYS) ??
        [
          readStringFromRow(nestedEmployee, ["first_name", "firstName", "preferred_name", "preferredName"]),
          readStringFromRow(nestedEmployee, ["middle_name", "middleName"]),
          readStringFromRow(nestedEmployee, ["last_name", "lastName"]),
        ]
          .filter(Boolean)
          .join(" ")
          .trim()

      if (nestedEmployeeName) {
        const nestedLabel = composeEmployeeIdentity(nestedEmployeeName, nestedEmployeeNo)
        next.employee_name = nestedLabel.number
          ? `${nestedLabel.name ?? nestedEmployeeName} (${nestedLabel.number})`
          : nestedLabel.name ?? nestedEmployeeName
      }
    }

    if (!readStringFromRow(next, ["employee_name", "employeeName"])) {
      next.employee_name = readEmployeeIdentityLabel(row)
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
          "check_in_time",
          "check_out_time",
          "attendance_status",
          "arrival_status",
          "departure_status",
          "worked_minutes",
        ]
      : section === "processing-exceptions"
      ? [
          "employee_name",
          "exception_type",
          "status",
          "attendance_date",
          "device_name",
          "created_at",
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
      : section === "recalculation-jobs"
      ? [
          "id",
          "status",
          "attempts",
          "companyName",
          "createdAt",
          "dateFrom",
          "dateTo",
          "employee_name",
        ]
      : section === "unmatched-logs"
      ? [
          "id",
          "attendanceDate",
          "branch_name",
          "companyName",
          "createdAt",
          "device_name",
          "direction",
          "employee_name",
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
  if (section === "processing-exceptions") {
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
    if ((key === "company_id" || key === "companyId") && keySet.has("companyName")) {
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

    const rawName =
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
    const employeeNo =
      readStringFromRow(row, ["employee_no", "employeeNo", "employee_number", "employeeNumber"]) ??
      readStringFromRow(nestedEmployee ?? {}, ["employee_no", "employeeNo", "employee_number"])
    return composeEmployeeIdentity(rawName, employeeNo).name ?? rawName
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
    ]))
  }
  return stringifyValue(row[column])
}

function formatBooleanSummaryValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return null
    }
    if (normalized === "true") {
      return "Yes"
    }
    if (normalized === "false") {
      return "No"
    }
    return prettifyLabel(value)
  }
  return stringifyValue(value)
}

function nullIfDash(value: string) {
  return value === "—" || value === "-" ? null : value
}

function composeEmployeeIdentity(name: string | null, employeeNo: string | null) {
  const rawName = name?.trim() || ""
  const rawNumber = employeeNo?.trim() || ""
  const wrapped = rawName.match(/^(.*?)(?:\s+\(([^)]+)\))+$/)
  const cleanName = (wrapped?.[1] || rawName).trim()
  const wrappedNumber = wrapped?.[2]?.trim() || ""
  const number = rawNumber || wrappedNumber
  if (cleanName && number && cleanName.includes(number) && !wrapped) {
    return { name: cleanName, number }
  }
  return {
    name: cleanName || number || null,
    number: number || null,
  }
}

function parseClockMinutes(value: string | null | undefined) {
  if (!value || value === "—" || value === "-") return null
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridian = match[3]?.toUpperCase()
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (meridian === "PM" && hours < 12) hours += 12
  if (meridian === "AM" && hours === 12) hours = 0
  return hours * 60 + minutes
}

function formatPrettyDate(value: string | null | undefined) {
  if (!value || value === "—") return "Date not provided"
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatPrettyDateTime(value: string | null | undefined) {
  if (!value || value === "—") return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function splitRemarkChips(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(/[,|]/)
    .map((entry) => prettifyLabel(entry.trim()))
    .filter(Boolean)
}

function readMinutesNumber(row: AdminRecord | null, keys: string[]) {
  if (!row) return null
  const value = readFirstValue(row, keys)
  const minutes = Number(value)
  return Number.isFinite(minutes) ? minutes : null
}

function clockPercent(minutes: number, rangeStart: number, span: number) {
  return Math.min(100, Math.max(0, ((minutes - rangeStart) / span) * 100))
}

function buildDailySummaryDetailsRecord(row: AdminRecord | null): AdminRecord | null {
  if (!row) {
    return null
  }

  const nestedEmployee = readNestedRecord(row, ["employee"])
  const nestedTimetable = readNestedRecord(row, ["timetable", "schedule", "shift"])
  const adjustment = readNestedRecord(row, ["adjustment", "manual_adjustment", "manualAdjustment"])

  const employeeName =
    typeof resolveDailySummaryCellValue("employee_name", row) === "string"
      ? String(resolveDailySummaryCellValue("employee_name", row)).trim()
      : readStringFromRow(row, ["employee_name", "employeeName", "full_name", "fullName"])
  const employeeNo = readStringFromRow(row, [
    "employee_no",
    "employeeNo",
    "employee_number",
    "employeeNumber",
    "employee_code",
    "employeeCode",
  ]) ?? readStringFromRow(nestedEmployee ?? {}, ["employee_no", "employeeNo", "employee_number"])
  const employeeLabel = composeEmployeeIdentity(employeeName, employeeNo)

  const branchName =
    typeof resolveDailySummaryCellValue("branch_name", row) === "string"
      ? String(resolveDailySummaryCellValue("branch_name", row)).trim()
      : null
  const attendanceDate =
    typeof resolveDailySummaryCellValue("attendance_date", row) === "string"
      ? String(resolveDailySummaryCellValue("attendance_date", row)).trim()
      : null

  const rawStatus = readFirstValue(row, [
    "attendance_status",
    "attendanceStatus",
    "status",
    "summary_status",
    "summaryStatus",
    "state",
  ])
  const timetableName =
    typeof resolveDailySummaryCellValue("timetable_used", row) === "string"
      ? String(resolveDailySummaryCellValue("timetable_used", row)).trim()
      : null
  const checkInTime =
    typeof resolveDailySummaryCellValue("check_in_time", row) === "string"
      ? String(resolveDailySummaryCellValue("check_in_time", row)).trim()
      : null
  const checkOutTime =
    typeof resolveDailySummaryCellValue("check_out_time", row) === "string"
      ? String(resolveDailySummaryCellValue("check_out_time", row)).trim()
      : null

  const expectedStart = formatClockValue(
    readFirstValue(nestedTimetable, ["start_time", "startTime", "expected_check_in_time", "expectedCheckInTime"])
  )
  const expectedEnd = formatClockValue(
    readFirstValue(nestedTimetable, ["end_time", "endTime", "expected_check_out_time", "expectedCheckOutTime"])
  )
  const scheduleWindow =
    expectedStart !== "—" || expectedEnd !== "—"
      ? [expectedStart !== "—" ? expectedStart : null, expectedEnd !== "—" ? expectedEnd : null]
          .filter(Boolean)
          .join(" - ")
      : null

  const adjustmentNotes = readFirstValue(adjustment, [
    "notes",
    "adjustment_notes",
    "adjustmentNotes",
  ]) ?? readFirstValue(row, ["notes", "adjustment_notes", "adjustmentNotes"])

  const remarksValue = row.remarks ?? row.remarksList
  const remarks =
    Array.isArray(remarksValue)
      ? remarksValue
          .filter((entry) => typeof entry === "string" && entry.trim())
          .map((entry) => entry.trim())
          .join(", ")
      : typeof remarksValue === "string" && remarksValue.trim()
        ? remarksValue.trim()
        : null
  const workedTime = nullIfDash(
    formatMinutesLabel(readFirstValue(row, ["worked_minutes", "workedMinutes", "work_minutes", "workMinutes"]))
  )
  const expectedWorkTime = nullIfDash(
    formatMinutesLabel(readFirstValue(nestedTimetable ?? row, ["expected_work_minutes", "expectedWorkMinutes"]))
  )
  const breakTime = nullIfDash(
    formatMinutesLabel(readFirstValue(row, ["break_minutes", "breakMinutes"]))
  )
  const lateTime = nullIfDash(
    formatMinutesLabel(readFirstValue(row, ["late_minutes", "lateMinutes"]))
  )
  const earlyDepartureTime = nullIfDash(
    formatMinutesLabel(readFirstValue(row, ["early_departure_minutes", "earlyDepartureMinutes"]))
  )
  const overtimeTime = nullIfDash(
    formatMinutesLabel(readFirstValue(row, ["overtime_minutes", "overtimeMinutes"]))
  )

  return {
    employee: employeeLabel.name,
    employee_no: employeeLabel.number,
    branch: branchName || null,
    attendance_date: attendanceDate || null,
    attendance_status: rawStatus ? prettifyLabel(rawStatus) : null,
    timetable_used: timetableName && timetableName !== "—" ? timetableName : null,
    scheduled_hours: scheduleWindow || null,
    check_in_time: checkInTime && checkInTime !== "—" ? checkInTime : null,
    check_out_time: checkOutTime && checkOutTime !== "—" ? checkOutTime : null,
    worked_time: workedTime,
    expected_work_time: expectedWorkTime,
    break_time: breakTime,
    late_time: lateTime,
    early_departure_time: earlyDepartureTime,
    overtime_time: overtimeTime,
    holiday: formatBooleanSummaryValue(readFirstValue(row, ["is_holiday", "isHoliday"])),
    approved_leave: formatBooleanSummaryValue(
      readFirstValue(row, ["has_approved_leave", "hasApprovedLeave"])
    ),
    approved_business_trip: formatBooleanSummaryValue(
      readFirstValue(row, ["has_approved_business_trip", "hasApprovedBusinessTrip"])
    ),
    adjustment_notes: adjustmentNotes || null,
    remarks: remarks || null,
    created_at: readFirstValue(row, ["created_at", "createdAt"]),
    updated_at: readFirstValue(row, ["updated_at", "updatedAt"]),
  }
}

function DailySummaryDetailsContent({
  row,
  detailsError,
}: {
  row: AdminRecord | null
  detailsError: string | null
}) {
  const motionPreset = useDashboardMotion()
  const details = React.useMemo(() => buildDailySummaryDetailsRecord(row), [row])

  if (!details) {
    return <p className="text-sm text-muted-foreground">No daily summary details are available for this record.</p>
  }

  const nestedDepartment = row ? readNestedRecord(row, ["department"]) : null
  const nestedPosition = row ? readNestedRecord(row, ["position"]) : null
  const statusValue = readFirstValue(details, ["attendance_status"]) ?? "Unknown"
  const statusUi = statusTone(statusValue)
  const employeeValue = readFirstValue(details, ["employee"]) || "Employee not identified"
  const employeeNo = readFirstValue(details, ["employee_no"])
  const branchValue = readFirstValue(details, ["branch"])
  const departmentValue = readStringFromRow(nestedDepartment ?? {}, [
    "name",
    "department_name",
    "departmentName",
  ])
  const positionValue = readStringFromRow(nestedPosition ?? {}, [
    "name",
    "position_name",
    "positionName",
    "title",
  ])
  const scheduleValue = readFirstValue(details, ["scheduled_hours"]) ?? "—"
  const timetableValue = readFirstValue(details, ["timetable_used"])
  const checkInValue = readFirstValue(details, ["check_in_time"]) ?? "—"
  const checkOutValue = readFirstValue(details, ["check_out_time"]) ?? "—"
  const workedValue = readFirstValue(details, ["worked_time"]) ?? "—"
  const expectedWorkValue = readFirstValue(details, ["expected_work_time"]) ?? "—"
  const breakValue = readFirstValue(details, ["break_time"]) ?? "—"
  const lateValue = readFirstValue(details, ["late_time"]) ?? "—"
  const earlyDepartureValue = readFirstValue(details, ["early_departure_time"]) ?? "—"
  const overtimeValue = readFirstValue(details, ["overtime_time"]) ?? "—"
  const remarksChips = splitRemarkChips(readFirstValue(details, ["remarks"]))
  const adjustmentNotesValue = readFirstValue(details, ["adjustment_notes"])
  const missingCheckout = checkOutValue === "—"
  const needsReview = remarksChips.some((entry) => /missing|review|manual/i.test(entry))

  const scheduledStart = parseClockMinutes(scheduleValue.split(" - ")[0] ?? null)
  const scheduledEnd = parseClockMinutes(scheduleValue.split(" - ")[1] ?? null)
  const checkInMinutes = parseClockMinutes(checkInValue)
  const checkOutMinutes = parseClockMinutes(checkOutValue)
  const timelinePoints = [scheduledStart, scheduledEnd, checkInMinutes, checkOutMinutes].filter(
    (value): value is number => value !== null,
  )
  const rangeStart = timelinePoints.length > 0 ? Math.max(0, Math.min(...timelinePoints) - 45) : 8 * 60
  const rangeEnd = timelinePoints.length > 0 ? Math.min(24 * 60, Math.max(...timelinePoints) + 45) : 18 * 60
  const span = Math.max(rangeEnd - rangeStart, 60)
  const scheduledLeft =
    scheduledStart !== null ? clockPercent(scheduledStart, rangeStart, span) : 8
  const scheduledRight =
    scheduledEnd !== null ? clockPercent(scheduledEnd, rangeStart, span) : 92
  const actualStart = checkInMinutes ?? scheduledStart
  const actualEnd = checkOutMinutes ?? scheduledEnd ?? rangeEnd
  const actualLeft = actualStart !== null ? clockPercent(actualStart, rangeStart, span) : null
  const actualRight = actualEnd !== null ? clockPercent(actualEnd, rangeStart, span) : null
  const checkInLeft = checkInMinutes !== null ? clockPercent(checkInMinutes, rangeStart, span) : null
  const checkOutLeft = checkOutMinutes !== null ? clockPercent(checkOutMinutes, rangeStart, span) : null

  const workedMinutes = readMinutesNumber(row, ["worked_minutes", "workedMinutes", "work_minutes", "workMinutes"])
  const expectedMinutes = readMinutesNumber(
    row ? readNestedRecord(row, ["timetable", "schedule", "shift"]) ?? row : null,
    ["expected_work_minutes", "expectedWorkMinutes"],
  )
  const workedRatio =
    workedMinutes !== null && expectedMinutes && expectedMinutes > 0
      ? Math.min(100, Math.round((workedMinutes / expectedMinutes) * 100))
      : null

  const contextItems = [
    branchValue,
    departmentValue,
    positionValue,
    timetableValue ? prettifyLabel(timetableValue) : null,
  ].filter((item): item is string => Boolean(item))

  const flags = [
    { label: "Leave", on: readFirstValue(details, ["approved_leave"]) === "Yes" },
    { label: "Business trip", on: readFirstValue(details, ["approved_business_trip"]) === "Yes" },
    { label: "Holiday", on: readFirstValue(details, ["holiday"]) === "Yes" },
  ]

  const metrics = [
    { label: "Worked", value: workedValue, warn: workedValue === "0h 00m" || workedValue === "—" },
    { label: "Expected", value: expectedWorkValue, warn: false },
    { label: "Break", value: breakValue, warn: false },
    { label: "Late", value: lateValue, warn: lateValue !== "0h 00m" && lateValue !== "—" },
    { label: "Left early", value: earlyDepartureValue, warn: earlyDepartureValue !== "0h 00m" && earlyDepartureValue !== "—" },
    { label: "Overtime", value: overtimeValue, warn: overtimeValue !== "0h 00m" && overtimeValue !== "—" },
  ]

  return (
    <motion.div
      className="space-y-4 pr-1"
      variants={motionPreset.container}
      initial="hidden"
      animate="show"
    >
      {detailsError ? (
        <motion.div
          variants={motionPreset.item}
          className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          Showing the latest available details. {detailsError}
        </motion.div>
      ) : null}

      <motion.div variants={motionPreset.rise} className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold tracking-tight text-foreground">{employeeValue}</h3>
            {employeeNo ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {employeeNo}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar20Regular className="size-4" />
              {formatPrettyDate(readFirstValue(details, ["attendance_date"]))}
            </span>
            {contextItems.map((item) => (
              <React.Fragment key={item}>
                <span className="text-border">·</span>
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <motion.div
          className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", statusUi.badge)}
          initial={motionPreset.reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          <span className={cn("size-1.5 rounded-full", statusUi.accent)} />
          <span>{statusValue}</span>
        </motion.div>
      </motion.div>

      <motion.div
        variants={motionPreset.item}
        className="overflow-hidden rounded-xl border border-border/80 bg-muted/20"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Day timeline
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled {scheduleValue}
              {missingCheckout ? " · checkout still open" : ""}
            </p>
          </div>
          {needsReview ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <Warning20Regular className="size-4" />
              Manual review
            </span>
          ) : null}
        </div>

        <div className="px-4 pb-2 pt-6">
          <div className="relative h-14">
            <div className="absolute inset-x-0 top-6 h-2 rounded-full bg-border/70" />
            {scheduledStart !== null && scheduledEnd !== null ? (
              <motion.div
                className="absolute top-6 h-2 rounded-full bg-primary/25"
                initial={motionPreset.reduce ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  left: `${scheduledLeft}%`,
                  width: `${Math.max(scheduledRight - scheduledLeft, 2)}%`,
                  transformOrigin: "left center",
                }}
              />
            ) : null}
            {actualLeft !== null && actualRight !== null ? (
              <motion.div
                className={cn(
                  "absolute top-[1.35rem] h-3 rounded-full",
                  missingCheckout
                    ? "bg-gradient-to-r from-amber-500 to-amber-400/10"
                    : "bg-primary",
                )}
                initial={motionPreset.reduce ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  left: `${actualLeft}%`,
                  width: `${Math.max(actualRight - actualLeft, 2)}%`,
                  transformOrigin: "left center",
                }}
              />
            ) : null}

            {checkInLeft !== null ? (
              <motion.div
                className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${checkInLeft}%` }}
                initial={motionPreset.reduce ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.16 }}
              >
                <span className="text-xs font-bold tabular-nums text-foreground">{checkInValue}</span>
                <span className="mt-1 size-2.5 rounded-full bg-emerald-500 ring-4 ring-background" />
              </motion.div>
            ) : null}

            {checkOutLeft !== null ? (
              <motion.div
                className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${checkOutLeft}%` }}
                initial={motionPreset.reduce ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.24 }}
              >
                <span className="text-xs font-bold tabular-nums text-foreground">{checkOutValue}</span>
                <span className="mt-1 size-2.5 rounded-full bg-primary ring-4 ring-background" />
              </motion.div>
            ) : scheduledEnd !== null && missingCheckout ? (
              <motion.div
                className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                style={{ left: `${scheduledRight}%` }}
                animate={
                  motionPreset.reduce
                    ? { opacity: 1 }
                    : { opacity: [0.45, 1, 0.45] }
                }
                transition={motionPreset.reduce ? undefined : { duration: 1.6, repeat: Infinity }}
              >
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Missing</span>
                <span className="mt-1 size-2.5 rounded-full bg-amber-500 ring-4 ring-background" />
              </motion.div>
            ) : null}
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                In
              </div>
              <div
                className={cn(
                  "mt-0.5 text-2xl font-bold tabular-nums tracking-tight",
                  checkInValue === "—" ? "text-muted-foreground/50" : "text-foreground",
                )}
              >
                {checkInValue}
              </div>
            </div>
            <div className="mb-1.5 h-px min-w-8 flex-1 bg-border" />
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Out
              </div>
              <div
                className={cn(
                  "mt-0.5 text-2xl font-bold tabular-nums tracking-tight",
                  missingCheckout || checkOutValue === "—"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-foreground",
                )}
              >
                {checkOutValue}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-y divide-border/70 border-t border-border/70 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
          {metrics.map((metric) => (
            <motion.div
              key={metric.label}
              className="px-4 py-3"
              variants={motionPreset.item}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {metric.label}
              </div>
              <div
                className={cn(
                  "mt-1 text-lg font-semibold tabular-nums tracking-tight",
                  metric.warn ? "text-amber-700 dark:text-amber-300" : "text-foreground",
                )}
              >
                {metric.value}
              </div>
              {metric.label === "Worked" && workedRatio !== null ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/80">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={motionPreset.reduce ? false : { width: 0 }}
                    animate={{ width: `${workedRatio}%` }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {flags.map((flag) => (
              <span
                key={flag.label}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                  flag.on
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {flag.on ? <CheckmarkCircle16Regular /> : <DismissCircle16Regular />}
                <span>{flag.label}: {flag.on ? "Yes" : "No"}</span>
              </span>
            ))}
          </div>
          {remarksChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {remarksChips.map((remark, index) => (
                <motion.span
                  key={remark}
                  className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                  initial={motionPreset.reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.05 }}
                >
                  {remark}
                </motion.span>
              ))}
            </div>
          ) : null}
        </div>

        {adjustmentNotesValue ? (
          <div className="border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Adjustment · </span>
            {adjustmentNotesValue}
          </div>
        ) : null}
      </motion.div>

      <motion.p variants={motionPreset.item} className="text-[11px] text-muted-foreground">
        Created {formatPrettyDateTime(readFirstValue(details, ["created_at"]))}
        <span className="mx-2 text-border">·</span>
        Updated {formatPrettyDateTime(readFirstValue(details, ["updated_at"]))}
      </motion.p>
    </motion.div>
  )
}

function UnmatchedLogDetailsContent({
  row,
  detailsError,
}: {
  row: AdminRecord | null
  detailsError: string | null
}) {
  const [technicalOpen, setTechnicalOpen] = React.useState(false)

  if (!row) {
    return <p className="text-sm text-muted-foreground">No unmatched log details are available.</p>
  }

  const humanizeCode = (value: string) => value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

  const employeeName = readFirstValue(row, ["employee_name", "employeeName"]) ?? "Unmatched employee"
  const employeeNo = readFirstValue(row, ATTENDANCE_EMPLOYEE_NO_KEYS) ?? "Not provided"
  const companyName = readFirstValue(row, ["companyName", "company_name"]) ?? "Company unavailable"
  const branchName = readFirstValue(row, ["branch_name", "branchName"]) ?? "Branch unavailable"
  const deviceName = readFirstValue(row, ["device_name", "deviceName"]) ?? "Device unavailable"
  const attendanceDate = readFirstValue(row, ["attendance_date", "attendanceDate"])
  const receivedAt = readFirstValue(row, ["received_at", "receivedAt", "created_at", "createdAt"])
  const status = humanizeCode(readFirstValue(row, ["processing_status", "processingStatus", "status"]) ?? "Unmatched")
  const reason = humanizeCode(readFirstValue(row, ["processing_reason", "processingReason", "reason"]) ?? "Identity not found")
  const direction = humanizeCode(readFirstValue(row, ["direction"]) ?? "Not determined")
  const processingVersion = readFirstValue(row, ["processing_version", "processingVersion"])
  const payloadHash = readFirstValue(row, ["payload_hash", "payloadHash"])
  const payloadValue = ["raw_payload_snapshot", "rawPayloadSnapshot", "raw_payload", "rawPayload", "payload"]
    .map((key) => row[key])
    .find((value) => value !== null && value !== undefined)
  let payloadRecord: AdminRecord | null = null
  let payloadFallback = "Payload not available."
  if (typeof payloadValue === "string" && payloadValue.trim()) {
    try {
      const parsedPayload = JSON.parse(payloadValue)
      if (parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)) {
        payloadRecord = parsedPayload as AdminRecord
      } else {
        payloadFallback = String(parsedPayload)
      }
    } catch {
      payloadFallback = payloadValue
    }
  } else if (payloadValue && typeof payloadValue === "object") {
    payloadRecord = payloadValue as AdminRecord
  }

  const payloadLabelOverrides: Record<string, string> = {
    time: "Event time",
    employeeNoString: "Employee number",
    serialNo: "Device serial number",
    userType: "User type",
    doorNo: "Door number",
    cardReaderNo: "Card reader number",
    cardNo: "Card number",
    MACAddr: "MAC address",
    RS485No: "RS-485 number",
    remoteHostAddr: "Remote host",
    attendanceStatus: "Attendance status",
    verifyNo: "Verification number",
    deviceNo: "Device number",
    major: "Major event code",
    minor: "Minor event code",
    type: "Event type",
  }
  const payloadPriority = [
    "time",
    "employeeNoString",
    "serialNo",
    "userType",
    "attendanceStatus",
    "doorNo",
    "cardReaderNo",
    "remoteHostAddr",
    "type",
    "major",
    "minor",
  ]
  const formatPayloadLabel = (key: string) => payloadLabelOverrides[key] ?? key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  const formatPayloadValue = (key: string, value: unknown) => {
    if (key === "time" && typeof value === "string") {
      return formatPrettyDateTime(value)
    }
    if (typeof value === "boolean") return value ? "Yes" : "No"
    if (value && typeof value === "object") return JSON.stringify(value)
    if (value === "") return "Not provided"
    return String(value)
  }
  const payloadEntries = payloadRecord
    ? Object.entries(payloadRecord)
        .sort(([firstKey], [secondKey]) => {
          const firstPriority = payloadPriority.indexOf(firstKey)
          const secondPriority = payloadPriority.indexOf(secondKey)
          if (firstPriority === -1 && secondPriority === -1) return firstKey.localeCompare(secondKey)
          if (firstPriority === -1) return 1
          if (secondPriority === -1) return -1
          return firstPriority - secondPriority
        })
        .map(([key, value]) => ({
          key,
          label: formatPayloadLabel(key),
          value: formatPayloadValue(key, value),
        }))
    : []

  const overviewItems = [
    { label: "Company", value: companyName, icon: <Building20Regular /> },
    { label: "Branch", value: branchName, icon: <Building20Regular /> },
    { label: "Device", value: deviceName, icon: <Desktop20Regular /> },
    { label: "Attendance date", value: formatPrettyDate(attendanceDate), icon: <Calendar20Regular /> },
    { label: "Received", value: formatPrettyDateTime(receivedAt), icon: <ClockAlarm20Regular /> },
    { label: "Direction", value: direction, icon: <ArrowSync20Regular /> },
  ]

  return (
    <div className="space-y-5 pr-1">
      {detailsError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Showing the latest available details. {detailsError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <PersonQuestionMark20Regular />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{employeeName}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Employee number {employeeNo}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Warning20Regular />
          {status}
        </span>
      </div>

      <section>
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Log context</h4>
        <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {overviewItems.map((item) => (
            <div key={item.label} className="flex min-w-0 items-start gap-2.5">
              <span className="mt-0.5 text-primary">{item.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-0.5 break-words text-sm font-medium text-foreground">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/70 py-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Processing result</h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{status}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Reason</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{reason}</p>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-border/70 bg-muted/20">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground"
          aria-expanded={technicalOpen}
          onClick={() => setTechnicalOpen((current) => !current)}
        >
          <Code20Regular />
          Technical payload
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {technicalOpen ? "Hide event details" : "Show event details"}
          </span>
          <ChevronDown20Regular className={cn("transition-transform", technicalOpen && "rotate-180")} />
        </button>
        {technicalOpen ? <div className="border-t border-border/70 p-4">
          {payloadEntries.length > 0 ? (
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {payloadEntries.map((item) => (
                <div key={item.key} className="min-w-0">
                  <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{payloadFallback}</p>
          )}
          {payloadHash || processingVersion ? (
            <dl className="mt-5 grid gap-4 border-t border-border/70 pt-4 text-xs sm:grid-cols-2">
              {processingVersion ? <div><dt className="font-medium text-muted-foreground">Processing version</dt><dd className="mt-1 text-sm font-medium text-foreground">{processingVersion}</dd></div> : null}
              {payloadHash ? <div><dt className="font-medium text-muted-foreground">Payload reference</dt><dd className="mt-1 break-all font-mono text-[11px] text-foreground">{payloadHash}</dd></div> : null}
            </dl>
          ) : null}
        </div> : null}
      </div>
    </div>
  )
}

function resolveTableCellValue(section: AttendanceActivitySectionKey, column: string, row: AdminRecord): React.ReactNode {
  if (section === "daily-summaries") {
    if (column === "arrival_cutoff") {
      const start = readFirstValue(row, ["scheduleStartAt", "schedule_start_at"])
      const flags = readNestedRecord(row, ["flags"])
      const grace = flags?.graceInMinutes
      if (typeof start !== "string" || typeof grace !== "number") return "—"
      const cutoff = new Date(new Date(start).getTime() + Math.max(0, grace) * 60000)
      if (Number.isNaN(cutoff.getTime())) return "—"
      const zone = readStringFromRow(row, ["timezone"])
      try {
        const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", ...(zone ? { timeZone: zone } : {}) }).format(cutoff)
        return <span>{time} <span className="text-muted-foreground">({grace} min grace)</span></span>
      } catch {
        return "—"
      }
    }
    if (column === "attendance_status") {
      const dims = readAttendanceDimensions(row)
      return dims
        ? <AttendanceStatusBadge status={dims.primary} label={primaryStatusLabel(dims)} tone={PRIMARY_STATUS[dims.primary ?? ""]?.tone ?? "neutral"} />
        : <AttendanceStatusBadge status={resolveDailySummaryCellValue(column, row)} />
    }
    if (column === "punch_status" || column === "arrival_status" || column === "departure_status") {
      const dims = readAttendanceDimensions(row)
      if (!dims) return "—"
      const value = column === "punch_status" ? dims.punch : column === "arrival_status" ? dims.arrival : dims.departure
      const definitions = column === "punch_status" ? PUNCH_STATUS : column === "arrival_status" ? ARRIVAL_STATUS : DEPARTURE_STATUS
      if (!value) return "—"
      const definition = dimensionDef(definitions, value)
      const lateMinutes = readFirstValue(row, ["lateMinutes", "late_minutes"])
      return <div><AttendanceStatusBadge status={value} label={definition.label} tone={definition.tone} />{column === "arrival_status" && value === "LATE" && Number(lateMinutes) > 0 ? <div className="text-xs text-muted-foreground">{String(lateMinutes)} min late</div> : null}</div>
    }
    if (column === "employee_name") {
      const employee = readNestedRecord(row, ["employee"])
      const employeeNo =
        readStringFromRow(row, ["employee_no", "employeeNo", "employee_number"]) ??
        readStringFromRow(employee ?? {}, ["employee_no", "employeeNo", "employee_number"])
      const department =
        readStringFromRow(row, ["department_name", "departmentName"]) ??
        readStringFromRow(employee ?? {}, ["department_name", "departmentName"])
      const name = String(resolveDailySummaryCellValue(column, row) ?? "").trim() || employeeNo || "Unknown employee"
      return <AttendanceEmployeeCell name={name} meta={[employeeNo, department].filter(Boolean).join(", ") || undefined} />
    }
    if (column === "attendance_date") {
      const value = resolveDailySummaryCellValue(column, row)
      return typeof value === "string" && value ? <span className="tabular-nums">{formatDisplayDate(value.slice(0, 10))}</span> : "—"
    }
    if (column === "check_in_time" || column === "check_out_time") {
      const value = resolveDailySummaryCellValue(column, row)
      const empty = value == null || value === "" || value === "—"
      if (column === "check_out_time" && empty) {
        const checkedIn = resolveDailySummaryCellValue("check_in_time", row)
        const date = String(resolveDailySummaryCellValue("attendance_date", row) ?? "")
        const today = new Date()
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
        if (checkedIn && checkedIn !== "—" && date.startsWith(todayKey)) {
          return <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Still in</span>
        }
      }
      return empty ? <span className="text-muted-foreground">—</span> : <span className="tabular-nums">{value}</span>
    }
    if (column === "worked_minutes") {
      const minutes = readMinutesNumber(row, ["worked_minutes", "workedMinutes", "work_minutes", "workMinutes"])
      return minutes == null ? <span className="text-muted-foreground">—</span> : <span className="tabular-nums">{formatWorkedMinutes(minutes)}</span>
    }
    if (column === "shift_timeline") {
      const timetable = readNestedRecord(row, ["timetable", "schedule", "shift"])
      const date = String(resolveDailySummaryCellValue("attendance_date", row) ?? "")
      const today = new Date()
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      return (
        <AttendanceShiftTimeline
          checkIn={resolveDailySummaryCellValue("check_in_time", row)}
          checkOut={resolveDailySummaryCellValue("check_out_time", row)}
          shiftStart={readFirstValue(timetable, ["start_time", "startTime", "expected_check_in_time", "expectedCheckInTime"])}
          shiftEnd={readFirstValue(timetable, ["end_time", "endTime", "expected_check_out_time", "expectedCheckOutTime"])}
          status={resolveDailySummaryCellValue("attendance_status", row)}
          isToday={date.startsWith(todayKey)}
        />
      )
    }
    return resolveDailySummaryCellValue(column, row)
  }
  if ((section === "processing-exceptions" || section === "recalculation-jobs") && column === "status") {
    return <AttendanceStatusBadge status={readFirstValue(row, ["status"])} />
  }
  if (section === "recalculation-jobs" && column === "employee_name") {
    const employeeName = readStringFromRow(row, ["employee_name", "employeeName"])
    return employeeName && employeeName !== "—" ? employeeName : "All employees"
  }
  if (section === "processing-exceptions") {
    if (column === "exception_type") {
      return prettifyLabel(
        readFirstValue(row, ["exception_type", "exceptionType", "type"]) ?? "-"
      )
    }
    if (column === "status") {
      const status = readFirstValue(row, ["status"]) ?? "-"
      const tone = statusTone(String(status))
      const textClass = tone.badge.split(" ").find((entry) => entry.startsWith("text-")) || "text-foreground"
      return <span className={`text-xs font-medium ${textClass}`}>{String(status)}</span>
    }
    if (column === "employee_name") {
      const employeeName = String(
        readFirstValue(row, ["employee_name", "employeeName", "full_name", "fullName"]) ?? ""
      ).trim()
      const employeeNo = String(readFirstValue(row, ATTENDANCE_EMPLOYEE_NO_KEYS) ?? "").trim()
      if (!employeeName || employeeName === employeeNo) {
        return <span className="text-muted-foreground">Unmatched employee</span>
      }
      return employeeNo && employeeName.endsWith(` (${employeeNo})`)
        ? employeeName.slice(0, -employeeNo.length - 3)
        : employeeName
    }
    if (column === "attendance_date") {
      return readFirstValue(row, ["attendance_date", "attendanceDate", "date"]) ?? "—"
    }
    if (column === "device_name" || column === "device_id") {
      const deviceName = readFirstValue(row, ["device_name", "deviceName", "terminal_name", "terminalName"])
      return deviceName ? String(deviceName) : <span className="text-muted-foreground">Unknown device</span>
    }
    if (column === "created_at") {
      const createdAt = readFirstValue(row, ["created_at", "createdAt"])
      return createdAt ? formatPrettyDateTime(createdAt) : "—"
    }
    return stringifyValue(row[column]) || "—"
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

function getProcessingExceptionId(row: AdminRecord | null) {
  return readNumberFromRow(row ?? {}, ["id", "exception_id", "exceptionId"])
}

function AttendanceViewLoader({
  section,
  label = "Loading attendance data…",
}: {
  section: AttendanceActivitySectionKey
  label?: string
}) {
  const hasFilterTabs = ["attendance-history", "schedule-preview", "corrections"].includes(section)
  const rowCount = section === "today" ? 3 : 5

  return (
    <Skeleton aria-label={label}>
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-1.5">
          {Array.from({ length: hasFilterTabs ? 3 : 4 }, (_, index) => (
            <SkeletonItem
              key={index}
              className={cn("h-7", hasFilterTabs ? "w-20" : "w-24")}
            />
          ))}
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {Array.from({ length: rowCount }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(7rem,0.8fr)_repeat(3,minmax(5rem,1fr))] items-center gap-4 border-b border-border px-3 py-3 last:border-b-0"
            >
              <SkeletonItem className="h-3 w-28 max-w-full" />
              <SkeletonItem className="h-3 w-20 max-w-full" />
              <SkeletonItem className="h-3 w-24 max-w-full" />
              <SkeletonItem className="h-3 w-16 max-w-full justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </Skeleton>
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
  onRowSelect,
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
  onRowSelect?: (rowId: string, row?: AdminRecord) => void
}) {
  const columns = React.useMemo(() => resolveVisibleColumns(rows, section), [rows, section])

  return (
    <div>
      <ResizableTable
        title="Attendance Activity"
        data={rows}
        columns={columns.map((c: string) => ({
          key: c,
          label:
            c === "shift_timeline"
              ? "Shift"
              : section === "daily-summaries" && c === "employee_name"
                ? "Employee"
                : section === "daily-summaries" && c === "branch_name"
                  ? "Branch"
                  : section === "daily-summaries" && c === "attendance_date"
                    ? "Date"
                    : section === "daily-summaries" && c === "attendance_status"
                      ? "Attendance status"
                      : section === "daily-summaries" && c === "punch_status"
                        ? "Completeness"
                      : section === "daily-summaries" && c === "check_in_time"
                        ? "Check in"
                        : section === "daily-summaries" && c === "check_out_time"
                          ? "Check out"
                          : section === "daily-summaries" && c === "worked_minutes"
                            ? "Worked"
                            : prettifyLabel(c),
          sortable: !["shift_timeline", "arrival_cutoff", "punch_status", "arrival_status", "departure_status"].includes(c),
          defaultWidth:
            section === "daily-summaries"
              ? c === "employee_name" ? 250 : c === "shift_timeline" ? 190 : c === "attendance_status" ? 150 : 120
              : 75,
          render: (row: AdminRecord) => resolveTableCellValue(section, c, row),
        }))}
        itemsPerPage={itemsPerPage}
        loading={loading}
        showExport={false}
        toolbarStart={toolbarStart}
        toolbarActions={toolbarActions}
        sortIconOnly={section === "unmatched-logs"}
        storageKey={section === "daily-summaries" ? "attendance-daily-summaries-v2" : "attendance-activity"}
        variant="card"
        itemLabel={section === "daily-summaries" ? "people" : "records"}
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={onPageChange}
        onRowSelect={onRowSelect}
      />
    </div>
  )
}

/** Rows per page for Unmatched logs and Recalculation jobs (paged on the server). */
const OPS_PAGE_SIZE = 50
const DAILY_SUMMARY_PAGE_SIZE_OPTIONS = [20, 50, 100, 130, 200] as const
const DEFAULT_DAILY_SUMMARY_PAGE_SIZE = 130
const PROCESSING_EXCEPTION_PAGE_SIZE_OPTIONS = [50, 100, 200] as const
const DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE = 100
const PROCESSING_EXCEPTION_STATUS_OPTIONS = ["OPEN", "RESOLVED", "IGNORED"] as const
const PROCESSING_EXCEPTION_TYPE_OPTIONS = [
  "MISSING_CHECK_IN",
  "MISSING_CHECK_OUT",
  "MISSING_BOTH_CHECK_IN_AND_CHECK_OUT",
  "DUPLICATE_PUNCH",
  "INVALID_PUNCH_TIME",
  "MANUAL_REVIEW_REQUIRED",
] as const

type DailySummaryAdjustmentFormState = {
  check_in_at: string
  check_out_at: string
  attendance_status: string
  break_minutes: string
  worked_minutes: string
  late_minutes: string
  early_departure_minutes: string
  overtime_minutes: string
  notes: string
}

const EMPTY_DAILY_SUMMARY_ADJUSTMENT_FORM: DailySummaryAdjustmentFormState = {
  check_in_at: "",
  check_out_at: "",
  attendance_status: "",
  break_minutes: "",
  worked_minutes: "",
  late_minutes: "",
  early_departure_minutes: "",
  overtime_minutes: "",
  notes: "",
}

function toDateTimeLocalInputValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return ""
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    const offset = parsed.getTimezoneOffset() * 60_000
    return new Date(parsed.getTime() - offset).toISOString().slice(0, 16)
  }

  return value.trim().replace(" ", "T").slice(0, 16)
}

function toIsoDateTimeOrUndefined(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Please enter a valid date and time.")
  }
  return parsed.toISOString()
}

function readDailySummaryIdentity(row: AdminRecord | null) {
  if (!row) {
    return { employeeId: null, attendanceDate: "" }
  }

  const employeeId = readNumberFromRow(row, ["employee_id", "employeeId"])
  const attendanceDateValue = readFirstValue(row, [
    "attendance_date",
    "attendanceDate",
    "date",
    "summary_date",
    "summaryDate",
    "work_date",
    "workDate",
  ])
  const attendanceDate =
    typeof attendanceDateValue === "string" && attendanceDateValue.trim()
      ? attendanceDateValue.trim().slice(0, 10)
      : ""

  return { employeeId, attendanceDate }
}

function readDailySummaryAdjustmentForm(row: AdminRecord | null): DailySummaryAdjustmentFormState {
  if (!row) {
    return EMPTY_DAILY_SUMMARY_ADJUSTMENT_FORM
  }

  const adjustment = readNestedRecord(row, ["adjustment", "manual_adjustment", "manualAdjustment"])

  const readValue = (keys: string[]) =>
    readFirstValue(adjustment, keys) ?? readFirstValue(row, keys)

  return {
    check_in_at: toDateTimeLocalInputValue(readValue(["check_in_at", "checkInAt", "first_check_in_at", "firstCheckInAt"])),
    check_out_at: toDateTimeLocalInputValue(readValue(["check_out_at", "checkOutAt", "last_check_out_at", "lastCheckOutAt"])),
    attendance_status: String(
      readValue(["attendance_status", "attendanceStatus", "status", "summary_status", "summaryStatus"]) ?? ""
    ),
    break_minutes: String(readValue(["break_minutes", "breakMinutes"]) ?? ""),
    worked_minutes: String(readValue(["worked_minutes", "workedMinutes", "work_minutes", "workMinutes"]) ?? ""),
    late_minutes: String(readValue(["late_minutes", "lateMinutes"]) ?? ""),
    early_departure_minutes: String(readValue(["early_departure_minutes", "earlyDepartureMinutes"]) ?? ""),
    overtime_minutes: String(readValue(["overtime_minutes", "overtimeMinutes"]) ?? ""),
    notes: String(readValue(["notes", "adjustment_notes", "adjustmentNotes"]) ?? ""),
  }
}

function buildDailySummaryAdjustmentPayload(form: DailySummaryAdjustmentFormState) {
  const payload: AdminRecord = {}

  const checkInAt = toIsoDateTimeOrUndefined(form.check_in_at)
  if (checkInAt) {
    payload.check_in_at = checkInAt
  }

  const checkOutAt = toIsoDateTimeOrUndefined(form.check_out_at)
  if (checkOutAt) {
    payload.check_out_at = checkOutAt
  }

  const attendanceStatus = form.attendance_status.trim()
  if (attendanceStatus) {
    payload.attendance_status = attendanceStatus
  }

  for (const [key, value] of Object.entries({
    break_minutes: form.break_minutes,
    worked_minutes: form.worked_minutes,
    late_minutes: form.late_minutes,
    early_departure_minutes: form.early_departure_minutes,
    overtime_minutes: form.overtime_minutes,
  })) {
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("Adjustment minute values must be numbers greater than or equal to 0.")
    }
    payload[key] = parsed
  }

  const notes = form.notes.trim()
  if (notes) {
    payload.notes = notes
  }

  return payload
}

export function AttendanceActivityView({ section }: { section: string }) {
  const { user } = useAuth()
  const actor = useDashboardActor()
  const canResolveExceptions = actor.permissionLabels.includes("attendance_processing:execute")
  const activeSection = React.useMemo(() => resolveSection(section), [section])
  const config = React.useMemo(() => SECTION_CONFIG[activeSection], [activeSection])
  const lastFetchKeyRef = React.useRef<string | null>(null)
  const lastFetchAtRef = React.useRef(0)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [dailySummaryRows, setDailySummaryRows] = React.useState<AdminRecord[]>([])
  const [dailySummaryFetchedAt, setDailySummaryFetchedAt] = React.useState<Date | null>(null)
  const [dailySummaryPage, setDailySummaryPage] = React.useState(1)
  const [exceptionPage, setExceptionPage] = React.useState(1)
  // Server paging for Unmatched logs and Recalculation jobs.
  const [opsPage, setOpsPage] = React.useState(1)
  const [opsTotal, setOpsTotal] = React.useState<number | null>(null)
  const [opsTotalPages, setOpsTotalPages] = React.useState<number | null>(null)
  React.useEffect(() => {
    setOpsPage(1)
  }, [activeSection])
  const [exceptionTotal, setExceptionTotal] = React.useState<number | null>(null)
  const [exceptionTotalPages, setExceptionTotalPages] = React.useState<number | null>(null)
  const [exceptionStatusCounts, setExceptionStatusCounts] = React.useState<{
    total: number
    counts: Record<string, number>
  } | null>(null)
  const [dailySummaryPageSize, setDailySummaryPageSize] = React.useState(DEFAULT_DAILY_SUMMARY_PAGE_SIZE)
  const [dailySummaryTotal, setDailySummaryTotal] = React.useState<number | null>(null)
  const [dailySummaryTotalPages, setDailySummaryTotalPages] = React.useState<number | null>(null)
  const [dailySummaryStatusCounts, setDailySummaryStatusCounts] = React.useState<{
    total: number
    counts: Record<string, number>
    dimensions?: AttendanceDailySummaryStatusCounts["dimensions"]
  } | null>(null)
  const [singleRecord, setSingleRecord] = React.useState<AdminRecord | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)
  const [detailsLoading, setDetailsLoading] = React.useState(false)
  const [detailsError, setDetailsError] = React.useState<string | null>(null)
  const [detailsRow, setDetailsRow] = React.useState<AdminRecord | null>(null)
  const [detailsActionBusy, setDetailsActionBusy] = React.useState<"" | "clear-adjustment" | "save-exception">("")
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = React.useState(false)
  const [adjustmentBusy, setAdjustmentBusy] = React.useState(false)
  const [adjustmentForm, setAdjustmentForm] = React.useState<DailySummaryAdjustmentFormState>(
    EMPTY_DAILY_SUMMARY_ADJUSTMENT_FORM
  )
  const [exceptionStatus, setExceptionStatus] = React.useState("RESOLVED")
  const [exceptionResolutionNote, setExceptionResolutionNote] = React.useState("")
  const [processingExceptionFiltersOpen, setProcessingExceptionFiltersOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  useFluentToastState(message, setMessage, "success")

  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const branchesRef = React.useRef<AdminRecord[]>([])
  const employeesRef = React.useRef<AdminRecord[]>([])
  const devicesRef = React.useRef<AdminRecord[]>([])
  /** Free-text search — sent to GET /api/attendance/daily-summaries after a short debounce. */
  const [recordSearch, setRecordSearch] = React.useState("")
  const debouncedRecordSearch = useDebouncedValue(recordSearch, 300)

  const [dailySummaryFilters, setDailySummaryFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      branch_id: "",
      status: "",
      primary_status: "",
      punch_status: "",
      arrival_status: "",
      departure_status: "",
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
      primary_status: "",
      punch_status: "",
      arrival_status: "",
      departure_status: "",
      check_in_after: "",
      check_in_before: "",
    }
  })
  const [processingExceptionFilters, setProcessingExceptionFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      search: "",
      status: "OPEN",
      exception_type: "",
      limit: String(DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE),
    }
  })
  const [appliedProcessingExceptionFilters, setAppliedProcessingExceptionFilters] = React.useState<Record<string, string>>(() => {
    const today = getTodayDateInputValue()
    return {
      from_date: today,
      to_date: today,
      employee_id: "",
      search: "",
      status: "OPEN",
      exception_type: "",
      limit: String(DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE),
    }
  })
  /**
   * The daily summaries filters as backend query params. The page, the status
   * counters and every export use this, so they always agree.
   */
  const buildDailySummaryQuery = React.useCallback(() => {
    const branchId = Number(appliedDailySummaryFilters.branch_id)
    return {
      sortBy: "created_at" as const,
      sortOrder: "DESC" as const,
      search: debouncedRecordSearch.trim() || undefined,
      from_date: appliedDailySummaryFilters.from_date || undefined,
      to_date: appliedDailySummaryFilters.to_date || undefined,
      branch_id: appliedDailySummaryFilters.branch_id && Number.isFinite(branchId) ? branchId : undefined,
      status: appliedDailySummaryFilters.status || undefined,
      primary_status: appliedDailySummaryFilters.primary_status || undefined,
      punch_status: appliedDailySummaryFilters.punch_status || undefined,
      arrival_status: appliedDailySummaryFilters.arrival_status || undefined,
      departure_status: appliedDailySummaryFilters.departure_status || undefined,
      check_in_after: appliedDailySummaryFilters.check_in_after || undefined,
      check_in_before: appliedDailySummaryFilters.check_in_before || undefined,
    }
  }, [appliedDailySummaryFilters, debouncedRecordSearch])

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
  const [correctionEvidenceFile, setCorrectionEvidenceFile] = React.useState<File | null>(null)
  const [correctionSaveMode, setCorrectionSaveMode] = React.useState<"draft" | "submit" | null>(null)
  const [pendingCorrectionAction, setPendingCorrectionAction] = React.useState<{
    id: string | number
    action: "submit" | "cancel"
  } | null>(null)
  const [attendanceExporting, setAttendanceExporting] = React.useState(false)
  const [correctionForm, setCorrectionForm] = React.useState(createEmptyCorrectionForm)
  // Set when the dialog edits an existing draft or returned request.
  const [correctionEditing, setCorrectionEditing] = React.useState<{
    id: string | number
    status: string
    reviewerNote: string
  } | null>(null)
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
    if (dailySummaryPageSize !== DEFAULT_DAILY_SUMMARY_PAGE_SIZE) count += 1
    return count
  }, [appliedDailySummaryFilters, dailySummaryPageSize])

  const processingExceptionActiveFilterCount = React.useMemo(() => {
    const today = getTodayDateInputValue()
    let count = 0
    if (
      appliedProcessingExceptionFilters.from_date !== today ||
      appliedProcessingExceptionFilters.to_date !== today
    ) {
      count += 1
    }
    if (appliedProcessingExceptionFilters.employee_id) count += 1
    if (appliedProcessingExceptionFilters.search.trim()) count += 1
    if (appliedProcessingExceptionFilters.status && appliedProcessingExceptionFilters.status !== "OPEN") count += 1
    if (appliedProcessingExceptionFilters.exception_type) count += 1
    if (appliedProcessingExceptionFilters.limit !== String(DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE)) count += 1
    return count
  }, [appliedProcessingExceptionFilters])

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
    setDailySummaryPage(1)
    setDailySummaryPageSize(DEFAULT_DAILY_SUMMARY_PAGE_SIZE)
    setDailySummaryFilters(resetFilters)
    setAppliedDailySummaryFilters(resetFilters)
    setHasAppliedDailySummaryFilters(true)
    setError(null)
    setMessage(null)
    setDailySummaryFiltersOpen(false)
  }, [])

  const applyProcessingExceptionDraftFilters = React.useCallback(() => {
    setAppliedProcessingExceptionFilters({ ...processingExceptionFilters })
    setExceptionPage(1)
    setMessage(null)
    setError(null)
    setProcessingExceptionFiltersOpen(false)
  }, [processingExceptionFilters])

  const resetProcessingExceptionFiltersToToday = React.useCallback(() => {
    const today = getTodayDateInputValue()
    const resetFilters = {
      from_date: today,
      to_date: today,
      employee_id: "",
      search: "",
      status: "OPEN",
      exception_type: "",
      limit: String(DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE),
    }
    setProcessingExceptionFilters(resetFilters)
    setAppliedProcessingExceptionFilters(resetFilters)
    setExceptionPage(1)
    setError(null)
    setMessage(null)
    setProcessingExceptionFiltersOpen(false)
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
    if (activeSection === "daily-summaries") {
      setAdjustmentForm(readDailySummaryAdjustmentForm(detailsRow))
      return
    }
    if (activeSection === "processing-exceptions") {
      const currentStatus = String(readFirstValue(detailsRow, ["status"]) ?? "OPEN").trim().toUpperCase()
      setExceptionStatus(
        currentStatus === "RESOLVED" || currentStatus === "IGNORED" || currentStatus === "OPEN"
          ? currentStatus
          : "RESOLVED"
      )
      setExceptionResolutionNote(
        String(readFirstValue(detailsRow, ["resolution_note", "resolutionNote", "notes"]) ?? "")
      )
      return
    }
  }, [activeSection, detailsRow])

  React.useEffect(() => {
    if (activeSection !== "daily-summaries" && activeSection !== "processing-exceptions") {
      return
    }

    const token = readStoredToken()
    if (!token) {
      return
    }

    let isActive = true

    const loadDailySummarySupportData = async () => {
      try {
        const [branchesResult, employeesResult] = await Promise.allSettled([
          listBranches(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }),
          listEmployees(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }),
        ])

        if (!isActive) {
          return
        }

        if (branchesResult.status === "fulfilled") {
          setBranches(branchesResult.value.rows)
        }
        if (employeesResult.status === "fulfilled") {
          setEmployees(employeesResult.value.rows)
        }
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
    if (activeSection !== "daily-summaries" && activeSection !== "processing-exceptions") {
      return
    }
    if (!branches.length && !employees.length) {
      return
    }

    if (activeSection === "daily-summaries") {
      setDailySummaryRows((current) => {
        if (!current.length) {
          return current
        }
        return enrichRowsWithReadableNames(current, branches, employees)
      })
      return
    }

    setRows((current) => {
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
        const [result, today] = await Promise.all([
          listMyAttendanceHistory(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
            from_date: historyFilters.from_date || undefined,
            to_date: historyFilters.to_date || undefined,
          }),
          getMyAttendanceToday(token).catch(() => null),
        ])
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(result.rows)
        setCorrectionRequests([])
        setSingleRecord(today)
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

        // Every filter is applied by the backend (name/employee number,
        // branch, status, date range, check-in window), one page at a time.
        const listParams = buildDailySummaryQuery()

        const [result, statusCounts] = await Promise.all([
          listAttendanceDailySummariesPage(token, {
            ...listParams,
            page: dailySummaryPage,
            limit: dailySummaryPageSize,
          }),
          getAttendanceDailySummaryStatusCounts(token, listParams).catch(() => null),
        ])
        setDailySummaryStatusCounts(statusCounts)
        const resultRows = result.rows
        const resultTotal = result.total
        const visibleRows = enrichRowsWithReadableNames(
          resultRows,
          branchesRef.current,
          employeesRef.current,
        )
        const totalPages =
          result.totalPages ??
          (resultTotal !== null
            ? Math.max(1, Math.ceil(resultTotal / dailySummaryPageSize))
            : resultRows.length >= dailySummaryPageSize
              ? dailySummaryPage + 1
              : dailySummaryPage)
        setDailySummaryRows(visibleRows)
        setDailySummaryFetchedAt(new Date())
        setDailySummaryTotal(resultTotal ?? visibleRows.length)
        setDailySummaryTotalPages(totalPages)
        setRows(visibleRows)
        setSingleRecord(null)
        setCorrectionRequests([])
        return
      }

      if (activeSection === "recalculation-jobs") {
        // One page from the server; the employee name lookup runs alongside.
        const [result, employeeResult] = await Promise.all([
          listAttendanceProcessingJobsPage(token, { page: opsPage, limit: OPS_PAGE_SIZE, sortBy: "created_at", sortOrder: "DESC" }),
          employeesRef.current.length
            ? Promise.resolve(null)
            : listEmployees(token, { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" }).catch(() => null),
        ])
        let employeeDirectory = employeesRef.current
        if (employeeResult) {
          employeeDirectory = employeeResult.rows
          setEmployees(employeeDirectory)
        }
        setOpsTotal(result.total)
        setOpsTotalPages(result.totalPages)
        const companyRows = enrichRowsWithReadableNames(result.rows, [], employeeDirectory).map((row) => {
          const employeeId = readNumberFromRow(row, ["employee_id", "employeeId"])
          const employeeName = readStringFromRow(row, ["employee_name", "employeeName"])
          return {
            ...row,
            companyName:
              readStringFromRow(row, ["companyName", "company_name"]) ||
              user?.companyName ||
              "Company",
            employee_name:
              (employeeName && employeeName !== "—" ? employeeName : null) ||
              (employeeId === null ? "All employees" : "Employee unavailable"),
          }
        })
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(companyRows)
        setSingleRecord(null)
        setCorrectionRequests([])
        return
      }

      if (activeSection === "processing-exceptions") {
        const exceptionEmployeeId = appliedProcessingExceptionFilters.employee_id
          ? Number(appliedProcessingExceptionFilters.employee_id)
          : undefined
        const exceptionLimit = Number(appliedProcessingExceptionFilters.limit)
        // One page from the server with every filter applied there (dates,
        // search, status, type). Loading every page and filtering in the
        // browser made the page wait for thousands of rows.
        const serverExceptionParams = {
          page: exceptionPage,
          limit:
            Number.isFinite(exceptionLimit) && exceptionLimit > 0
              ? exceptionLimit
              : DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE,
          sortBy: "created_at",
          sortOrder: "DESC",
          employee_id:
            exceptionEmployeeId && Number.isFinite(exceptionEmployeeId)
              ? exceptionEmployeeId
              : undefined,
          from_date: appliedProcessingExceptionFilters.from_date || undefined,
          to_date: appliedProcessingExceptionFilters.to_date || undefined,
          search: appliedProcessingExceptionFilters.search.trim() || undefined,
          status: appliedProcessingExceptionFilters.status || undefined,
          exception_type: appliedProcessingExceptionFilters.exception_type || undefined,
        } as const
        const [result, statusCounts] = await Promise.all([
          listAttendanceProcessingExceptionsPage(token, serverExceptionParams),
          getAttendanceProcessingExceptionStatusCounts(token, serverExceptionParams).catch(() => null),
        ])
        const filteredRows = enrichRowsWithReadableNames(
          result.rows,
          branchesRef.current,
          employeesRef.current
        )
        setExceptionTotal(result.total)
        setExceptionTotalPages(result.totalPages)
        setExceptionStatusCounts(statusCounts)
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(filteredRows)
        setSingleRecord(null)
        setCorrectionRequests([])
        return
      }

      if (activeSection === "unmatched-logs") {
        // One page from the server; name lookups run alongside instead of
        // one after another, and devices are only fetched once per visit.
        const lookupParams = { page: 1, limit: 200, sortBy: "created_at", sortOrder: "DESC" } as const
        const [result, devicesResult, branchesResult, employeesResult] = await Promise.all([
          listAttendanceUnmatchedLogsPage(token, {
            page: opsPage,
            limit: OPS_PAGE_SIZE,
            sortBy: "event_time",
            sortOrder: "DESC",
          }),
          devicesRef.current.length
            ? Promise.resolve(null)
            : listAttendanceDevices(token, lookupParams).catch(() => null),
          branchesRef.current.length ? Promise.resolve(null) : listBranches(token, lookupParams).catch(() => null),
          employeesRef.current.length ? Promise.resolve(null) : listEmployees(token, lookupParams).catch(() => null),
        ])
        if (devicesResult) devicesRef.current = devicesResult.rows
        const deviceDirectory = devicesRef.current
        let branchDirectory = branchesRef.current
        if (branchesResult) {
          branchDirectory = branchesResult.rows
          setBranches(branchDirectory)
        }
        let employeeDirectory = employeesRef.current
        if (employeesResult) {
          employeeDirectory = employeesResult.rows
          setEmployees(employeeDirectory)
        }
        setOpsTotal(result.total)
        setOpsTotalPages(result.totalPages)
        const branchNameById = new Map(
          branchDirectory.flatMap((branch) => {
            const id = readNumberFromRow(branch, ["id", "branch_id", "branchId"])
            const name = readStringFromRow(branch, ["name", "branch_name", "branchName"])
            return id !== null && name ? [[id, name] as const] : []
          })
        )
        const deviceNameById = new Map(
          deviceDirectory.flatMap((device) => {
            const id = readNumberFromRow(device, ["id", "device_id", "deviceId", "attendance_device_id"])
            const name = readStringFromRow(device, ["device_name", "deviceName", "name", "device_code"])
            return id !== null && name ? [[id, name] as const] : []
          })
        )
        const employeeNameByNumber = new Map(
          employeeDirectory.flatMap((employee) => {
            const employeeNo = readStringFromRow(employee, ATTENDANCE_EMPLOYEE_NO_KEYS)
            const employeeName =
              readStringFromRow(employee, ATTENDANCE_EMPLOYEE_NAME_KEYS) ||
              [
                readStringFromRow(employee, ["preferred_name", "preferredName", "first_name", "firstName"]),
                readStringFromRow(employee, ["middle_name", "middleName"]),
                readStringFromRow(employee, ["last_name", "lastName"]),
              ]
                .filter(Boolean)
                .join(" ")
                .trim()
            return employeeNo && employeeName
              ? [[employeeNo.trim().toLowerCase(), employeeName] as const]
              : []
          })
        )
        const readableRows = result.rows.map((row) => {
          const branchId = readNumberFromRow(row, ["branch_id", "branchId"])
          const deviceId = readNumberFromRow(row, ["device_id", "deviceId"])
          const employeeNo = readStringFromRow(row, ATTENDANCE_EMPLOYEE_NO_KEYS)
          const source = readStringFromRow(row, ["source"])
          const sourceLabel = source
            ? `${source.charAt(0).toUpperCase()}${source.slice(1).toLowerCase()}`
            : null
          const direction = readStringFromRow(row, ["direction"])
          return {
            ...row,
            branch_name:
              readStringFromRow(row, ["branch_name", "branchName"]) ||
              (branchId !== null ? branchNameById.get(branchId) : null) ||
              "Unknown branch",
            companyName:
              readStringFromRow(row, ["companyName", "company_name"]) ||
              user?.companyName ||
              "Company",
            device_name:
              readStringFromRow(row, ["device_name", "deviceName"]) ||
              (deviceId !== null ? deviceNameById.get(deviceId) : null) ||
              (sourceLabel ? `${sourceLabel} attendance device` : "Attendance device"),
            direction:
              !direction || direction.toUpperCase() === "UNKNOWN"
                ? "Not determined"
                : prettifyLabel(direction),
            employee_name:
              readStringFromRow(row, ["employee_name", "employeeName"]) ||
              (employeeNo ? employeeNameByNumber.get(employeeNo.trim().toLowerCase()) : null) ||
              "Unmatched employee",
          }
        })
        setDailySummaryRows([])
        setDailySummaryTotal(null)
        setDailySummaryTotalPages(null)
        setRows(readableRows)
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
    buildDailySummaryQuery,
    appliedProcessingExceptionFilters,
    config.title,
    dailySummaryPage,
    dailySummaryPageSize,
    exceptionPage,
    opsPage,
    hasAppliedDailySummaryFilters,
    historyFilters,
    user?.companyName,
  ])

  const openRecordDetails = React.useCallback(
    async (row?: AdminRecord) => {
      if (!row) {
        return
      }

      setDetailsOpen(true)
      setDetailsError(null)
      setDetailsRow(row)

      if (activeSection !== "daily-summaries") {
        setDetailsLoading(false)
        return
      }

      const token = readStoredToken()
      const employeeId = readNumberFromRow(row, ["employee_id", "employeeId"])
      const attendanceDateRaw = readFirstValue(row, [
        "attendance_date",
        "attendanceDate",
        "date",
        "summary_date",
        "summaryDate",
        "work_date",
        "workDate",
      ])
      const attendanceDate =
        typeof attendanceDateRaw === "string" && attendanceDateRaw.trim()
          ? attendanceDateRaw.trim().slice(0, 10)
          : ""

      if (!token || employeeId === null || !attendanceDate) {
        return
      }

      setDetailsLoading(true)
      try {
        const detail = await getAttendanceDailySummary(token, employeeId, attendanceDate)
        if (detail) {
          setDetailsRow({ ...row, ...detail })
        }
      } catch (errorObject) {
        setDetailsError(
          formatLoadError(errorObject, "Could not load the latest attendance summary details.")
        )
      } finally {
        setDetailsLoading(false)
      }
    },
    [activeSection]
  )

  const detailsTitle = React.useMemo(() => {
    if (activeSection === "daily-summaries") return "Daily summary details"
    if (activeSection === "processing-exceptions") return "Processing exception details"
    if (activeSection === "recalculation-jobs") return "Recalculation job details"
    if (activeSection === "unmatched-logs") return "Unmatched log details"
    return "Attendance record details"
  }, [activeSection])

  const detailsDescription = React.useMemo(() => {
      if (activeSection === "daily-summaries") {
        if (detailsLoading) {
          return "Loading the latest processed attendance summary details."
        }
        return undefined
    }
    if (activeSection === "processing-exceptions") {
      if (detailsError) {
        return `Review the selected attendance processing exception. ${detailsError}`
      }
      return "Review the selected attendance processing exception and update its status."
    }
    if (activeSection === "recalculation-jobs") {
      if (detailsError) {
        return `Review the selected attendance processing job. ${detailsError}`
      }
      return "Review the selected attendance processing job."
    }
    if (activeSection === "unmatched-logs") {
      if (detailsError) {
        return `Review the selected unmatched attendance log. ${detailsError}`
      }
      return "Review the selected unmatched attendance log."
    }
    return "Selected attendance record details."
  }, [activeSection, detailsError, detailsLoading])

  const detailsDisplayRow = React.useMemo(() => {
    if (activeSection === "daily-summaries") {
      return buildDailySummaryDetailsRecord(detailsRow)
    }
    return detailsRow
  }, [activeSection, detailsRow])

  const fetchSectionData = React.useCallback(async (force = false) => {
    const requestKey = JSON.stringify({
      activeSection,
      historyFilters,
      dailySummaryFilters: appliedDailySummaryFilters,
      dailySummaryPage,
      dailySummaryPageSize,
      dailySummarySearch: debouncedRecordSearch,
      hasAppliedDailySummaryFilters,
      processingExceptionFilters: appliedProcessingExceptionFilters,
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
    appliedProcessingExceptionFilters,
    dailySummaryPage,
    dailySummaryPageSize,
    debouncedRecordSearch,
    hasAppliedDailySummaryFilters,
    historyFilters,
    loadSectionData,
  ])

  React.useEffect(() => {
    void fetchSectionData()
  }, [fetchSectionData])

  React.useEffect(() => {
    if (activeSection !== "daily-summaries") return
    setDailySummaryPage((current) => (current === 1 ? current : 1))
  }, [activeSection, debouncedRecordSearch])

  const displayedDailySummaryRows = React.useMemo(() => {
    if (activeSection !== "daily-summaries") {
      return rows
    }
    // The backend already applied every filter.
    return dailySummaryRows
  }, [
    activeSection,
    dailySummaryRows,
    rows,
  ])

  const isOpsSection =
    activeSection === "daily-summaries" ||
    activeSection === "processing-exceptions" ||
    activeSection === "recalculation-jobs" ||
    activeSection === "unmatched-logs"
  const [opsStatusFilter, setOpsStatusFilter] = React.useState("")
  React.useEffect(() => {
    setOpsStatusFilter("")
  }, [activeSection])
  const readOpsStatus = React.useCallback(
    (row: AdminRecord) =>
      activeSection === "daily-summaries"
        ? resolveDailySummaryCellValue("attendance_status", row)
        : readFirstValue(row, ["status"]),
    [activeSection],
  )
  const opsBaseRows = activeSection === "daily-summaries" ? displayedDailySummaryRows : rows
  const opsCounters = React.useMemo(
    () =>
      activeSection === "unmatched-logs"
        ? []
        : activeSection === "processing-exceptions" && exceptionStatusCounts
          ? [
              { key: "", label: "All", count: exceptionStatusCounts.total },
              ...["OPEN", "RESOLVED", "IGNORED"].map((key) => ({
                key,
                label: prettifyStatus(key),
                count: exceptionStatusCounts.counts[key] ?? 0,
                tone: attendanceStatusTone(key),
              })),
            ]
        : activeSection === "daily-summaries" && dailySummaryStatusCounts?.dimensions
          ? buildDimensionCounters(dailySummaryStatusCounts.total, dailySummaryStatusCounts.dimensions)
        : activeSection === "daily-summaries" && dailySummaryStatusCounts
          ? [
              { key: "", label: "All", count: dailySummaryStatusCounts.total },
              ...[
                "PRESENT",
                "LATE",
                "EARLY_DEPARTURE",
                "ABSENT",
                "ON_LEAVE",
                ...Object.keys(dailySummaryStatusCounts.counts)
                  .map(normalizeStatusKey)
                  .filter((key) => !["PRESENT", "LATE", "EARLY_DEPARTURE", "ABSENT", "ON_LEAVE"].includes(key))
                  .sort(),
              ].map((key) => ({
                key,
                label: prettifyStatus(key),
                count: Object.entries(dailySummaryStatusCounts.counts)
                  .filter(([status]) => normalizeStatusKey(status) === key)
                  .reduce((sum, [, count]) => sum + count, 0),
                tone: attendanceStatusTone(key),
              })),
            ]
        : buildStatusCounters(opsBaseRows, readOpsStatus, {
            order:
              activeSection === "processing-exceptions"
                ? ["OPEN", "RESOLVED", "IGNORED"]
                : activeSection === "recalculation-jobs"
                  ? ["PENDING", "RUNNING", "COMPLETED", "FAILED"]
                  : ["PRESENT", "LATE", "EARLY_DEPARTURE", "ABSENT", "ON_LEAVE"],
          }),
    [activeSection, dailySummaryStatusCounts, exceptionStatusCounts, opsBaseRows, readOpsStatus],
  )
  const usesServerStatusFilter =
    (activeSection === "daily-summaries" && dailySummaryStatusCounts != null) ||
    (activeSection === "processing-exceptions" && exceptionStatusCounts != null)
  const opsStatusValue = !usesServerStatusFilter
    ? opsStatusFilter
    : activeSection === "processing-exceptions"
      ? normalizeStatusKey(appliedProcessingExceptionFilters.status)
      : dailySummaryStatusCounts?.dimensions
        ? activeDimensionCounterKey(appliedDailySummaryFilters)
        : normalizeStatusKey(appliedDailySummaryFilters.status)
  const changeOpsStatus = (key: string) => {
    if (!usesServerStatusFilter) {
      setOpsStatusFilter(key)
      return
    }
    if (activeSection === "daily-summaries" && dailySummaryStatusCounts?.dimensions) {
      const patch = dimensionCounterFilterPatch(key)
      setDailySummaryFilters((current) => ({ ...current, ...patch }))
      setAppliedDailySummaryFilters((current) => ({ ...current, ...patch }))
      setDailySummaryPage(1)
      return
    }
    if (activeSection === "processing-exceptions") {
      setProcessingExceptionFilters((current) => ({ ...current, status: key }))
      setAppliedProcessingExceptionFilters((current) => ({ ...current, status: key }))
      setExceptionPage(1)
      return
    }
    const raw =
      Object.keys(dailySummaryStatusCounts?.counts ?? {}).find((status) => normalizeStatusKey(status) === key) ?? key
    setDailySummaryFilters((current) => ({ ...current, status: key ? raw : "" }))
    setAppliedDailySummaryFilters((current) => ({ ...current, status: key ? raw : "" }))
    setDailySummaryPage(1)
  }
  const opsRows = React.useMemo(
    () =>
      opsStatusFilter && !usesServerStatusFilter
        ? opsBaseRows.filter((row) => normalizeStatusKey(readOpsStatus(row)) === opsStatusFilter)
        : opsBaseRows,
    [opsBaseRows, opsStatusFilter, readOpsStatus, usesServerStatusFilter],
  )

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

  const saveDailySummaryAdjustment = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    const { employeeId, attendanceDate } = readDailySummaryIdentity(detailsRow)
    if (employeeId === null || !attendanceDate) {
      setError("The selected summary is missing its employee or date.")
      return
    }

    setAdjustmentBusy(true)
    setError(null)
    setMessage(null)
    try {
      const payload = buildDailySummaryAdjustmentPayload(adjustmentForm)
      const updated = await upsertAttendanceDailySummaryAdjustment(token, employeeId, attendanceDate, payload)
      setAdjustmentDialogOpen(false)
      setDetailsRow((current) =>
        current ? { ...current, ...(asRecordValue(updated) ?? {}) } : current
      )
      toast.success("Attendance daily summary adjustment saved.")
      await fetchSectionData(true)
    } catch (errorObject) {
      toast.error(formatLoadError(errorObject, "Could not save the attendance summary adjustment."))
    } finally {
      setAdjustmentBusy(false)
    }
  }, [adjustmentForm, detailsRow, fetchSectionData])

  const clearDailySummaryAdjustment = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    const { employeeId, attendanceDate } = readDailySummaryIdentity(detailsRow)
    if (employeeId === null || !attendanceDate) {
      setError("The selected summary is missing its employee or date.")
      return
    }

    setDetailsActionBusy("clear-adjustment")
    setError(null)
    setMessage(null)
    try {
      await clearAttendanceDailySummaryAdjustment(token, employeeId, attendanceDate)
      toast.success("Attendance daily summary adjustment cleared.")
      await fetchSectionData(true)
      const fresh = await getAttendanceDailySummary(token, employeeId, attendanceDate).catch(() => null)
      setDetailsRow((current) =>
        fresh ? { ...(current ?? {}), ...fresh } : current
      )
      setAdjustmentForm(readDailySummaryAdjustmentForm(fresh))
    } catch (errorObject) {
      toast.error(formatLoadError(errorObject, "Could not clear the attendance summary adjustment."))
    } finally {
      setDetailsActionBusy("")
    }
  }, [detailsRow, fetchSectionData])

  const saveProcessingException = React.useCallback(async () => {
    if (!canResolveExceptions) return
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    const exceptionId = getProcessingExceptionId(detailsRow)
    if (exceptionId === null) {
      setError("The selected processing exception is missing its id.")
      return
    }

    setDetailsActionBusy("save-exception")
    setError(null)
    setMessage(null)
    try {
      const updated = await updateAttendanceProcessingException(token, exceptionId, {
        status: exceptionStatus,
        resolution_note: exceptionResolutionNote.trim() || undefined,
      })
      const updatedRecord = asRecordValue(updated)
      if (updatedRecord) {
        setDetailsRow((current) => ({ ...(current ?? {}), ...updatedRecord }))
      }
      setMessage(`Processing exception marked as ${exceptionStatus.toLowerCase()}.`)
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(formatLoadError(errorObject, "Could not update the processing exception."))
    } finally {
      setDetailsActionBusy("")
    }
  }, [canResolveExceptions, detailsRow, exceptionResolutionNote, exceptionStatus, fetchSectionData])

  const saveCorrectionRequest = async (mode: "draft" | "submit") => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      return
    }

    if (!correctionForm.attendance_date.trim()) {
      setError("Attendance date is required.")
      return
    }

    setCorrectionBusy(true)
    setCorrectionSaveMode(mode)
    setError(null)
    setMessage(null)

    try {
      const usesCheckIn = correctionForm.request_type !== "check_out" &&
        correctionForm.request_type !== "status_correction"
      const usesCheckOut = correctionForm.request_type !== "check_in" &&
        correctionForm.request_type !== "status_correction"
      const payload = {
        attendance_date: correctionForm.attendance_date,
        request_type: correctionForm.request_type,
        requested_check_in_at: usesCheckIn
          ? (toIsoDateTime(correctionForm.attendance_date, correctionForm.requested_check_in_at) ?? null)
          : null,
        requested_check_out_at: usesCheckOut
          ? (toIsoDateTime(correctionForm.attendance_date, correctionForm.requested_check_out_at) ?? null)
          : null,
        requested_status:
          correctionForm.request_type === "status_correction"
            ? correctionForm.requested_status
            : null,
        reason: correctionForm.reason.trim() || null,
      }
      const createdRequest = correctionEditing
        ? await updateMyAttendanceCorrectionRequest(token, correctionEditing.id, payload)
        : await createMyAttendanceCorrectionRequest(token, payload)
      const createdRecord = asRecordValue(createdRequest)
      const createdRequestId =
        readNumberFromRow(createdRecord ?? {}, ["id", "request_id"]) ??
        (correctionEditing ? Number(correctionEditing.id) : null)
      const createdStatus = (
        readStringFromRow(createdRecord ?? {}, ["status", "request_status"]) ?? ""
      ).toLowerCase()

      let submittedRequest = createdRequest
      let wasSubmitted = !["", "-", "draft", "returned_for_correction"].includes(createdStatus)
      if (correctionEvidenceFile && createdRequestId !== null) {
        const file = await fileToBase64UploadDto(correctionEvidenceFile)
        await addMyAttendanceCorrectionDocument(token, createdRequestId, file)
      }
      if (mode === "submit" && !wasSubmitted) {
        if (createdRequestId === null) {
          throw new Error("The request was saved as a draft, but its id was not returned so it could not be submitted.")
        }
        submittedRequest = await submitMyAttendanceCorrectionRequest(token, createdRequestId)
        wasSubmitted = true
      }

      if (mode === "submit" && wasSubmitted) {
        void notifySubmittedRequestApprovers({
          kind: "attendance_correction_request",
          token,
          request: submittedRequest,
          loadRequest:
            createdRequestId !== null
              ? () => getMyAttendanceCorrectionRequest(token, createdRequestId)
              : undefined,
        })
      }
      setMessage(
        mode === "submit"
          ? correctionEditing
            ? "Attendance correction request updated and resubmitted."
            : "Attendance correction request submitted."
          : correctionEditing
            ? "Attendance correction request changes saved."
            : "Attendance correction request saved as draft."
      )
      setCorrectionDialogOpen(false)
      setCorrectionEditing(null)
      setCorrectionForm(createEmptyCorrectionForm())
      setCorrectionEvidenceFile(null)
      await fetchSectionData(true)
    } catch (errorObject) {
      setError(
        formatLoadError(
          errorObject,
          mode === "submit"
            ? "Could not create and submit the attendance correction request."
            : "Could not save the attendance correction request as a draft."
        )
      )
    } finally {
      setCorrectionBusy(false)
      setCorrectionSaveMode(null)
    }
  }

  const openCorrectionEditor = (row: AdminRecord) => {
    const id = readFirstValue(row, ["id"])
    if (id === null || id === undefined) return
    const requestType = String(readFirstValue(row, ["request_type"]) ?? "check_in")
    setCorrectionEditing({
      id: id as string | number,
      status: String(readFirstValue(row, ["status"]) ?? "draft").toLowerCase(),
      reviewerNote: String(
        readFirstValue(row, ["review_comment", "manager_review_comment"]) ?? ""
      ),
    })
    setCorrectionForm({
      attendance_date: String(
        readFirstValue(row, ["attendance_date"]) ?? getTodayDateInputValue()
      ).slice(0, 10),
      // Legacy "missing_punch" requests are edited as check in + check out.
      request_type: requestType === "missing_punch" ? "check_in_and_check_out" : requestType,
      requested_check_in_at: toTimeInputValue(readFirstValue(row, ["requested_check_in_at"])),
      requested_check_out_at: toTimeInputValue(readFirstValue(row, ["requested_check_out_at"])),
      requested_status: String(readFirstValue(row, ["requested_status"]) ?? "PRESENT"),
      reason: String(readFirstValue(row, ["reason"]) ?? ""),
    })
    setCorrectionEvidenceFile(null)
    setCorrectionDialogOpen(true)
  }

  const closeCorrectionDialog = (open: boolean) => {
    setCorrectionDialogOpen(open)
    if (!open && correctionEditing) {
      setCorrectionEditing(null)
      setCorrectionForm(createEmptyCorrectionForm())
      setCorrectionEvidenceFile(null)
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
        ...buildDailySummaryQuery(),
        include_all_employees:
          Boolean(appliedDailySummaryFilters.from_date) &&
          appliedDailySummaryFilters.from_date === appliedDailySummaryFilters.to_date,
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
      <AttendanceTodayPanel />
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
        <Filter20Regular className="size-3 text-primary" />
        {dailySummaryActiveFilterCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-primary-foreground">
            {dailySummaryActiveFilterCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(22rem,calc(100vw-1rem))] p-3"
        align="end"
        sideOffset={6}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={resetDailySummaryFiltersToToday}
              >
                Reset
              </button>
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={loading}
                onClick={applyDailySummaryDraftFilters}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <label className={dailySummaryFilterLabelClass}>
              <span>From</span>
              <DatePickerPresets
                value={dailySummaryFilters.from_date}
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({ ...current, from_date: value }))
                }
                placeholder="From"
                className="h-8 w-full min-w-0 gap-1 border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-3"
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
                className="h-8 w-full min-w-0 gap-1 border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-3"
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Employee name or number</span>
              <input
                type="text"
                value={recordSearch}
                onChange={(event) => setRecordSearch(event.target.value)}
                placeholder="e.g. Amina or AIC-EMP-1001"
                aria-label="Employee name or employee number"
                className="w-full min-w-0 rounded border border-border bg-background text-foreground"
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Branch</span>
              <FluentSelect
                ariaLabel="Branch"
                size="small"
                className="w-full min-w-0"
                value={dailySummaryFilters.branch_id}
                placeholder="All"
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    branch_id: value,
                  }))
                }
                options={[
                  { value: "", label: "All" },
                  ...branches.flatMap((branch) => {
                    const branchId = readNumberFromRow(branch, ["id", "branch_id", "branchId"])
                    if (branchId === null) return []
                    return [{ value: String(branchId), label: getBranchOptionLabel(branch) }]
                  }),
                ]}
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Status</span>
              <FluentSelect
                ariaLabel="Status"
                size="small"
                className="w-full min-w-0"
                value={dailySummaryFilters.status}
                placeholder="All"
                onChange={(value) =>
                  setDailySummaryFilters((current) => ({
                    ...current,
                    status: value,
                  }))
                }
                options={DAILY_SUMMARY_STATUS_FILTER_OPTIONS}
              />
            </label>
            {DIMENSION_FILTERS.map((filter) => (
              <label key={filter.param} className={dailySummaryFilterLabelClass}>
                <span>{filter.label}</span>
                <FluentSelect
                  ariaLabel={filter.label}
                  size="small"
                  className="w-full min-w-0"
                  value={dailySummaryFilters[filter.param] ?? ""}
                  placeholder="All"
                  onChange={(value) =>
                    setDailySummaryFilters((current) => ({ ...current, [filter.param]: value }))
                  }
                  options={[
                    { value: "", label: "All" },
                    ...Object.entries(filter.options)
                      .filter(([value]) => filter.param !== "punch_status" || value !== "INVALID")
                      .map(([value, def]) => ({ value: filter.param === "punch_status" && value === "IN_PROGRESS" ? IN_PROGRESS_PUNCH_VALUES : value, label: def.label })),
                  ]}
                />
              </label>
            ))}
            <label className={dailySummaryFilterLabelClass}>
              <span>Rows</span>
              <FluentSelect
                ariaLabel="Number of records to display"
                size="small"
                className="w-full min-w-0"
                value={String(dailySummaryPageSize)}
                onChange={(value) => {
                  const next = Number(value)
                  setDailySummaryPageSize(
                    Number.isFinite(next) && next > 0 ? next : DEFAULT_DAILY_SUMMARY_PAGE_SIZE
                  )
                  setDailySummaryPage(1)
                }}
                options={DAILY_SUMMARY_PAGE_SIZE_OPTIONS.map((size) => ({
                  value: String(size),
                  label: String(size),
                }))}
              />
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

          <div className="flex items-center gap-1.5 border-t border-border/70 pt-2">
            <span className="mr-auto text-[10px] font-medium text-muted-foreground">Export</span>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]"
              onClick={() => void exportDailySummaryReport("xlsx")}
              disabled={attendanceExporting}
            >
              {attendanceExporting ? "…" : "XLSX"}
            </button>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]"
              onClick={() => void exportDailySummaryReport("csv")}
              disabled={attendanceExporting}
            >
              CSV
            </button>
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 dark:hover:bg-[#303030]"
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

  const processingExceptionFilterPopover = activeSection === "processing-exceptions" ? (
    <Popover open={processingExceptionFiltersOpen} onOpenChange={setProcessingExceptionFiltersOpen}>
      <PopoverTrigger
        className={cn(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-xs font-medium text-foreground transition hover:bg-muted",
          processingExceptionActiveFilterCount > 0 && "border-primary/40 bg-primary/5"
        )}
        aria-label="Filter processing exceptions"
        title="Filter processing exceptions"
      >
        <Filter20Regular className="size-3.5 text-primary" />
        {processingExceptionActiveFilterCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-semibold text-primary-foreground">
            {processingExceptionActiveFilterCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-1rem,20rem)] p-3" align="end" sideOffset={6}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Exception filters
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="inline-flex h-6 items-center rounded px-2 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={resetProcessingExceptionFiltersToToday}
              >
                Reset
              </button>
              <button
                type="button"
                className="inline-flex h-6 items-center rounded bg-primary px-2 text-[10px] font-semibold !text-white transition hover:brightness-95 disabled:opacity-60"
                disabled={loading}
                onClick={applyProcessingExceptionDraftFilters}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className={dailySummaryFilterLabelClass}>
              <span>From</span>
              <DatePickerPresets
                value={processingExceptionFilters.from_date}
                onChange={(value) =>
                  setProcessingExceptionFilters((current) => ({ ...current, from_date: value }))
                }
                placeholder="From"
                className="h-7 gap-1 border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-3"
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>To</span>
              <DatePickerPresets
                value={processingExceptionFilters.to_date}
                onChange={(value) =>
                  setProcessingExceptionFilters((current) => ({ ...current, to_date: value }))
                }
                placeholder="To"
                className="h-7 gap-1 border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100 [&_svg]:size-3"
              />
            </label>
            <label className={`${dailySummaryFilterLabelClass} col-span-2`}>
              <span>Search name or number</span>
              <input
                className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-[11px] text-slate-900 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-100"
                value={processingExceptionFilters.search}
                onChange={(event) =>
                  setProcessingExceptionFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Example: Mwaija or 00000010"
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Employee</span>
              <FluentSelect
                ariaLabel="Employee"
                size="small"
                className="w-full min-w-0"
                value={processingExceptionFilters.employee_id}
                placeholder="All"
                onChange={(value) =>
                  setProcessingExceptionFilters((current) => ({ ...current, employee_id: value }))
                }
                options={[
                  { value: "", label: "All" },
                  ...employees.flatMap((employee) => {
                    const employeeId = readNumberFromRow(employee, ["id", "employee_id", "employeeId"])
                    if (employeeId === null) return []
                    return [{ value: String(employeeId), label: getEmployeeOptionLabel(employee) }]
                  }),
                ]}
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Status</span>
              <FluentSelect
                ariaLabel="Status"
                size="small"
                className="w-full min-w-0"
                value={processingExceptionFilters.status}
                placeholder="All"
                onChange={(value) =>
                  setProcessingExceptionFilters((current) => ({ ...current, status: value }))
                }
                options={[
                  { value: "", label: "All" },
                  ...PROCESSING_EXCEPTION_STATUS_OPTIONS.map((status) => ({
                    value: status,
                    label: prettifyLabel(status),
                  })),
                ]}
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Type</span>
              <FluentSelect
                ariaLabel="Type"
                size="small"
                className="w-full min-w-0"
                value={processingExceptionFilters.exception_type}
                placeholder="All"
                onChange={(value) =>
                  setProcessingExceptionFilters((current) => ({ ...current, exception_type: value }))
                }
                options={[
                  { value: "", label: "All" },
                  ...PROCESSING_EXCEPTION_TYPE_OPTIONS.map((type) => ({
                    value: type,
                    label: prettifyLabel(type),
                  })),
                ]}
              />
            </label>
            <label className={dailySummaryFilterLabelClass}>
              <span>Rows</span>
              <FluentSelect
                ariaLabel="Rows"
                size="small"
                className="w-full min-w-0"
                value={processingExceptionFilters.limit}
                onChange={(value) =>
                  setProcessingExceptionFilters((current) => ({ ...current, limit: value }))
                }
                options={PROCESSING_EXCEPTION_PAGE_SIZE_OPTIONS.map((size) => ({
                  value: String(size),
                  label: String(size),
                }))}
              />
            </label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ) : null

  const refreshButton = (
    <Button
      appearance="subtle"
      className="!h-8 !min-h-8 !min-w-8"
      type="button"
      disabled={loading}
      aria-label="Refresh"
      title="Refresh"
      icon={
        <ArrowSync20Regular
          className={cn("text-primary", loading && "animate-spin")}
        />
      }
      onClick={() => {
        setMessage(null)
        void fetchSectionData(true)
      }}
    />
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
    <div className={ATTENDANCE_PAGE_STACK}>
      <DoodleSprites />
      {/* Data-heavy views host their titles/actions on the table toolbar row. */}
      {activeSection !== "daily-summaries" &&
      activeSection !== "processing-exceptions" &&
      activeSection !== "recalculation-jobs" &&
      activeSection !== "unmatched-logs" ? (
        <div className="flex flex-nowrap items-center justify-between gap-2">
          {sectionTitleBlock}
          <div className="flex shrink-0 items-center gap-1">
            {activeSection === "corrections" && (
              <button
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted"
                type="button"
                onClick={() => setCorrectionDialogOpen(true)}
              >
                <Add20Regular className="size-4 text-primary" />
                Request correction
              </button>
            )}
            {activeSection === "attendance-history" && (
              <>
                <Popover>
                  <PopoverTrigger
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Filter by date"
                    title="Filter by date"
                  >
                    <Filter20Regular className="size-3.5 text-primary" />
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
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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
                  <ArrowReset20Regular className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </>
            )}
            {processingExceptionFilterPopover}
            {refreshButton}
          </div>
        </div>
      ) : null}

      {isOpsSection ? (
        <div className="space-y-3">
          <AttendancePageHead
            section={config.groupTitle}
            title={config.title}
            description={activeSection === "daily-summaries" ? undefined : config.description}
            actions={
              <>
                {activeSection === "daily-summaries" ? (
                  <DatePickerPresets
                    placeholder="Attendance date"
                    className="h-9 min-w-[11rem] text-[13px]"
                    value={
                      appliedDailySummaryFilters.from_date === appliedDailySummaryFilters.to_date
                        ? appliedDailySummaryFilters.from_date || ""
                        : ""
                    }
                    onChange={(value) => {
                      if (!value) return
                      setDailySummaryFilters((current) => ({ ...current, from_date: value, to_date: value }))
                      setAppliedDailySummaryFilters((current) => ({ ...current, from_date: value, to_date: value }))
                      setDailySummaryPage(1)
                    }}
                  />
                ) : null}
                {activeSection === "daily-summaries" ? null : (
                <AttendanceExportButton
                  count={opsRows.length}
                  disabled={loading}
                  onExport={() => {
                    const keys = resolveVisibleColumns(opsRows, activeSection).filter((key) => key !== "shift_timeline")
                    downloadAttendanceCsv(
                      `${activeSection}-${new Date().toISOString().slice(0, 10)}`,
                      keys.map((key) => ({
                        label: prettifyLabel(key),
                        value: (row: AdminRecord) => {
                          const value =
                            row[key]
                          return typeof value === "string" || typeof value === "number" ? value : stringifyValue(value)
                        },
                      })),
                      opsRows,
                    )
                  }}
                />
                )}
              </>
            }
          />
          {opsCounters.length > 1 ? (
            <AttendanceStatusCounters
              items={opsCounters}
              value={opsStatusValue}
              onChange={changeOpsStatus}
              note={
                activeSection === "daily-summaries" && !usesServerStatusFilter && (dailySummaryTotalPages ?? 1) > 1
                  ? "Counts cover the rows loaded on this page."
                  : undefined
              }
            />
          ) : null}
        </div>
      ) : null}

      <div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {loading &&
        activeSection !== "daily-summaries" &&
        activeSection !== "processing-exceptions" &&
        activeSection !== "recalculation-jobs" &&
        activeSection !== "unmatched-logs" &&
        rows.length === 0 &&
        !singleRecord &&
        correctionRequests.length === 0 ? (
          <div className="mt-4">
            <AttendanceViewLoader
              section={activeSection}
              label={`Loading ${config.title.toLowerCase()}…`}
            />
          </div>
        ) : null}

        {!loading && activeSection === "today" ? <TodayOverview record={singleRecord} /> : null}

        {!loading && activeSection === "attendance-history" ? (
          <div className="space-y-3">
            <motion.section
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="border-y border-border"
              aria-label="Today at a glance"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-1 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Today at a glance
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    Live attendance status
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(new Date())}
                </span>
              </div>
              <div className="py-3">
                <TodayOverview record={singleRecord} />
              </div>
            </motion.section>

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
                    <SummaryFilterTabs
                      ariaLabel="Filter attendance history"
                      selectedValue={historyStatusFilter}
                      onSelectedValueChange={setHistoryStatusFilter}
                      tabs={[
                        { value: null, label: "Days", count: rows.length },
                        ...statusTallies.map(([status, count]) => ({
                          value: status,
                          label: status.replace(/[_-]+/g, " "),
                          count,
                          countClassName: attendanceHistoryStatusTone(status).count,
                        })),
                      ]}
                    />

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
                    <SummaryFilterTabs
                      ariaLabel="Filter schedule preview"
                      selectedValue={scheduleKindFilter}
                      onSelectedValueChange={setScheduleKindFilter}
                      tabs={[
                        { value: null, label: "Days", count: rows.length },
                        ...kindTallies.map(([kind, count]) => ({
                          value: kind,
                          label: kind,
                          count,
                          countClassName: schedulePreviewKindTone(kind).count,
                        })),
                      ]}
                    />

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
                    <SummaryFilterTabs
                      ariaLabel="Filter correction requests"
                      selectedValue={correctionStatusFilter}
                      onSelectedValueChange={setCorrectionStatusFilter}
                      tabs={[
                        { value: null, label: "All", count: correctionRequests.length },
                        ...statusTallies.map(([status, count]) => ({
                          value: status,
                          label: status.replace(/[_-]+/g, " "),
                          count,
                          countClassName: correctionRequestStatusTone(status).count,
                        })),
                      ]}
                    />

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
                            const canSubmit = ["draft", "returned_for_correction"].includes(status)
                            const canCancel = [
                              "draft",
                              "submitted",
                              "pending_manager_approval",
                              "pending_hr_approval",
                              "returned_for_correction",
                            ].includes(status)
                            const reviewerNote = formatOptionalValue(
                              readFirstValue(row, ["review_comment", "manager_review_comment"]),
                              ""
                            )
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
                                      {getSelfServiceStatusMeta(status)?.label ??
                                        status.replace(/[_-]+/g, " ")}
                                    </div>
                                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                      {requestType}
                                    </div>
                                    {status === "returned_for_correction" && reviewerNote ? (
                                      <div
                                        className="mt-0.5 line-clamp-2 text-[11px] text-orange-700 dark:text-orange-300"
                                        title={reviewerNote}
                                      >
                                        Fix: {reviewerNote}
                                      </div>
                                    ) : null}
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
                                        className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-border px-2.5 text-[11px] font-medium text-primary transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                        type="button"
                                        disabled={correctionBusy}
                                        onClick={() => openCorrectionEditor(row)}
                                      >
                                        Edit
                                      </button>
                                    ) : null}
                                    {canSubmit ? (
                                      <button
                                        className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                                        type="button"
                                        disabled={correctionBusy}
                                        onClick={() => setPendingCorrectionAction({ id, action: "submit" })}
                                      >
                                        {status === "returned_for_correction" ? "Resubmit" : "Submit"}
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
              rows={opsRows}
              section={activeSection}
              loading={loading}
              itemsPerPage={dailySummaryPageSize}
              page={dailySummaryPage}
              totalPages={
                recordSearch.trim() && displayedDailySummaryRows.length === 0
                  ? 1
                  : dailySummaryTotalPages
              }
              totalItems={
                recordSearch.trim() && displayedDailySummaryRows.length === 0
                  ? 0
                  : dailySummaryTotal
              }
              onPageChange={setDailySummaryPage}
              onRowSelect={(_, row) => {
                void openRecordDetails(row)
              }}
              toolbarActions={
                <>
                  <FluentSearchBox
                    size="small"
                    className="min-w-[10rem] max-w-[16rem] flex-1 sm:min-w-[12rem]"
                    value={recordSearch}
                    onChange={(_event, data) => setRecordSearch(data.value)}
                    placeholder="Search names…"
                    aria-label="Search daily summaries by employee name"
                  />
                  <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-muted/40 px-2 text-[10px] font-medium text-muted-foreground">
                    <span>Rows</span>
                    <FluentSelect
                      ariaLabel="Rows per page"
                      size="small"
                      className="max-w-[3.25rem]"
                      value={String(dailySummaryPageSize)}
                      onChange={(value) => {
                        const next = Number(value)
                        setDailySummaryPageSize(
                          Number.isFinite(next) && next > 0
                            ? next
                            : DEFAULT_DAILY_SUMMARY_PAGE_SIZE
                        )
                        setDailySummaryPage(1)
                      }}
                      options={DAILY_SUMMARY_PAGE_SIZE_OPTIONS.map((size) => ({
                        value: String(size),
                        label: String(size),
                      }))}
                    />
                  </div>
                  {dailySummaryFilterPopover}
                  {dailySummaryFetchedAt ? <span className="text-xs text-muted-foreground">Fetched {dailySummaryFetchedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
                  {refreshButton}
                </>
              }
            />
          </div>
        ) : null}

        {/* Date filter is now in the popover next to refresh icon for attendance-history */}

        {/* Punch Action is only available in the native mobile app (iOS/Android). No content shown in browser. */}

        {activeSection === "processing-exceptions" ? (
          <TableBlock
            rows={opsRows}
            section={activeSection}
            loading={loading}
            itemsPerPage={Number(appliedProcessingExceptionFilters.limit) || DEFAULT_PROCESSING_EXCEPTION_PAGE_SIZE}
            page={exceptionPage}
            totalPages={exceptionTotalPages}
            totalItems={exceptionTotal}
            onPageChange={setExceptionPage}
            onRowSelect={(_, row) => void openRecordDetails(row)}
            toolbarActions={
              <>
                {processingExceptionFilterPopover}
                {refreshButton}
              </>
            }
          />
        ) : null}

        {activeSection === "unmatched-logs" ? (
          <TableBlock
            rows={rows}
            section={activeSection}
            loading={loading}
            itemsPerPage={OPS_PAGE_SIZE}
            page={opsPage}
            totalPages={opsTotalPages}
            totalItems={opsTotal}
            onPageChange={setOpsPage}
            toolbarActions={refreshButton}
            onRowSelect={(_, row) => {
              void openRecordDetails(row)
            }}
          />
        ) : null}

        {activeSection === "recalculation-jobs" ? (
          <div>
            <TableBlock
              rows={opsRows}
              section={activeSection}
              loading={loading}
              itemsPerPage={OPS_PAGE_SIZE}
              page={opsPage}
              totalPages={opsTotalPages}
              totalItems={opsTotal}
              onPageChange={setOpsPage}
              onRowSelect={(_, row) => {
                void openRecordDetails(row)
              }}
              toolbarActions={
                <>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={recalcActionBusy || loading}
                    onClick={() => void runPendingJobs()}
                    title="Run pending jobs"
                  >
                    <ClockAlarm20Regular className="size-4" />
                    <span className="hidden sm:inline">Run pending</span>
                  </button>

                  <Popover open={rebuildFormOpen} onOpenChange={setRebuildFormOpen}>
                    <PopoverTrigger
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted"
                      aria-label="Refresh daily summaries"
                      title="Refresh daily summaries"
                    >
                      <ArrowReset20Regular className="size-4 text-primary" />
                      <span className="hidden sm:inline">Rebuild</span>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(100vw-1.5rem,21rem)] p-3" align="end">
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rebuild daily summaries
                      </div>
                      <div className="grid gap-2">
                        <Field label="Start date" size="small">
                          <DatePickerPresets
                            value={recalculateValues.start_date}
                            onChange={(value) =>
                              setRecalculateValues((current) => ({ ...current, start_date: value }))
                            }
                            placeholder="Select start date"
                            className="w-full [&_.fui-Input]:!w-full"
                          />
                        </Field>
                        <Field label="End date" size="small">
                          <DatePickerPresets
                            value={recalculateValues.end_date}
                            onChange={(value) =>
                              setRecalculateValues((current) => ({ ...current, end_date: value }))
                            }
                            placeholder="Select end date"
                            className="w-full [&_.fui-Input]:!w-full"
                          />
                        </Field>
                      </div>
                      <Field label="Employee ID" hint="Optional" size="small">
                        <Input
                          size="small"
                          value={recalculateValues.employee_id}
                          onChange={(_event, data) =>
                            setRecalculateValues((current) => ({
                              ...current,
                              employee_id: data.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Device ID" hint="Optional" size="small">
                        <Input
                          size="small"
                          value={recalculateValues.device_id}
                          onChange={(_event, data) =>
                            setRecalculateValues((current) => ({
                              ...current,
                              device_id: data.value,
                            }))
                          }
                        />
                      </Field>
                      <FluentSelect
                        label="Processing source"
                        ariaLabel="Processing source"
                        size="small"
                        className="w-full"
                        value={recalculateValues.processing_source}
                        onChange={(processing_source) => {
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
                        options={[
                          { value: "database_only", label: "Database only" },
                          { value: "fetch_and_process", label: "Fetch from device & process" },
                        ]}
                      />
                      <FluentSelect
                        label="Refresh mode"
                        ariaLabel="Refresh mode"
                        size="small"
                        className="w-full"
                        value={recalculateValues.mode}
                        onChange={(mode) =>
                          setRecalculateValues((current) => ({
                            ...current,
                            mode,
                          }))
                        }
                        options={[
                          { value: "from_raw_logs", label: "From raw logs" },
                          { value: "summaries_only", label: "Summaries only" },
                        ]}
                      />
                      <FluentSelect
                        label="Execution mode"
                        ariaLabel="Execution mode"
                        size="small"
                        className="w-full"
                        value={recalculateValues.execution_mode}
                        onChange={(execution_mode) => {
                          setRecalculateValues((current) => ({
                            ...current,
                            execution_mode,
                            execution: execution_mode === "immediate" ? "sync" : "async",
                          }))
                        }}
                        options={[
                          { value: "background", label: "Background" },
                          { value: "immediate", label: "Immediate" },
                        ]}
                      />
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
          </div>
        ) : null}

        {!loading &&
        activeSection !== "daily-summaries" &&
        activeSection !== "today" &&
        activeSection !== "attendance-history" &&
        activeSection !== "schedule-preview" &&
        activeSection !== "processing-exceptions" &&
        activeSection !== "recalculation-jobs" &&
        activeSection !== "unmatched-logs" &&
        activeSection !== "corrections" ? (
          <div className="mt-6">
            <TableBlock
              rows={rows}
              section={activeSection}
              loading={loading}
              onRowSelect={
                activeSection === "unmatched-logs"
                  ? (_, row) => {
                      void openRecordDetails(row)
                    }
                  : undefined
              }
            />
          </div>
        ) : null}


      </div>

      <Dialog open={correctionDialogOpen} onOpenChange={closeCorrectionDialog}>
        <DialogPopup className="sm:max-w-lg" bodyClassName="!h-full !max-h-none">
          <DialogHeader>
            <DialogTitle>
              {correctionEditing ? "Edit attendance correction" : "Request attendance correction"}
            </DialogTitle>
            <DialogDescription>
              {correctionEditing?.status === "returned_for_correction"
                ? "Your reviewer returned this request. Update it and resubmit it for approval."
                : correctionEditing
                  ? "Update your draft correction request."
                  : "Create a correction request for an incorrect or missing attendance record."}
            </DialogDescription>
          </DialogHeader>
          {correctionEditing?.reviewerNote ? (
            <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
              <span className="font-medium">Reviewer note:</span> {correctionEditing.reviewerNote}
            </div>
          ) : null}
          <div className="grid gap-4">
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Attendance date</span>
                <DateInput
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"

                  value={correctionForm.attendance_date}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, attendance_date: event.target.value }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Request type</span>
                <FluentSelect
                  ariaLabel="Request type"
                  value={correctionForm.request_type}
                  onChange={(value) => setCorrectionForm((current) => ({ ...current, request_type: value }))}
                  options={CORRECTION_REQUEST_TYPE_OPTIONS}
                />
              </label>
              {correctionForm.request_type !== "check_out" &&
              correctionForm.request_type !== "status_correction" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Requested check-in time</span>
                <TimeInput
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  aria-label="Requested check-in time"
                  value={correctionForm.requested_check_in_at}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, requested_check_in_at: event.target.value }))}
                />
              </label>
              ) : null}
              {correctionForm.request_type !== "check_in" &&
              correctionForm.request_type !== "status_correction" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Requested check-out time</span>
                <TimeInput
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  aria-label="Requested check-out time"
                  value={correctionForm.requested_check_out_at}
                  onChange={(event) => setCorrectionForm((current) => ({ ...current, requested_check_out_at: event.target.value }))}
                />
              </label>
              ) : null}
            </div>
            {correctionForm.request_type === "status_correction" ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Requested status</span>
              <FluentSelect
                ariaLabel="Requested status"
                value={correctionForm.requested_status}
                onChange={(value) => setCorrectionForm((current) => ({ ...current, requested_status: value }))}
                options={CORRECTION_REQUESTED_STATUS_OPTIONS.map((status) => ({
                  value: status,
                  label: prettifyLabel(status),
                }))}
              />
            </label>
            ) : null}
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Reason</span>
              <Textarea
                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={correctionForm.reason}
                onChange={(event) => setCorrectionForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Explain what should be corrected if a reason is required by your attendance policy."
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Supporting evidence</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt"
                disabled={correctionBusy}
                onChange={(event) => setCorrectionEvidenceFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
              />
              <span className="text-xs text-muted-foreground">
                {correctionEvidenceFile
                  ? `${correctionEvidenceFile.name} selected`
                  : "Attach a document if your attendance policy requires supporting evidence. Maximum 10 MB."}
              </span>
            </label>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 mt-auto border-t border-border bg-background py-3">
            <Button
              appearance="secondary"
              type="button"
              disabled={correctionBusy}
              onClick={() => void saveCorrectionRequest("draft")}
            >
              {correctionSaveMode === "draft"
                ? "Saving…"
                : correctionEditing
                  ? "Save changes"
                  : "Save as draft"}
            </Button>
            <Button
              appearance="outline"
              type="button"
              disabled={correctionBusy}
              onClick={() => closeCorrectionDialog(false)}
            >
              Close
            </Button>
            <Button
              appearance="primary"
              type="button"
              disabled={correctionBusy}
              onClick={() => void saveCorrectionRequest("submit")}
            >
              {correctionSaveMode === "submit"
                ? "Submitting…"
                : correctionEditing?.status === "returned_for_correction"
                  ? "Save & resubmit"
                  : correctionEditing
                    ? "Save & submit"
                    : "Create request"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <RecordDetailsDialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open)
          if (!open) {
            setDetailsError(null)
            setDetailsLoading(false)
            setDetailsActionBusy("")
            setAdjustmentDialogOpen(false)
          }
        }}
        title={detailsTitle}
        description={detailsDescription}
        popupClassName={activeSection === "daily-summaries" || activeSection === "unmatched-logs" ? "sm:max-w-3xl" : undefined}
        row={detailsDisplayRow}
        content={
          activeSection === "daily-summaries" ? (
            <DailySummaryDetailsContent row={detailsRow} detailsError={detailsError} />
          ) : activeSection === "unmatched-logs" ? (
            <UnmatchedLogDetailsContent row={detailsRow} detailsError={detailsError} />
          ) : undefined
        }
        resolveLabel={(key) => prettifyLabel(key)}
        resolveValue={(key, row) => stringifyValue(row[key])}
        footer={
          activeSection === "daily-summaries" && detailsRow ? (
            <div className="flex w-full flex-wrap justify-end gap-2">
              <Button
                type="button"
                appearance="subtle"
                icon={<ArrowReset20Regular />}
                onClick={() => void clearDailySummaryAdjustment()}
                disabled={detailsActionBusy === "clear-adjustment"}
              >
                {detailsActionBusy === "clear-adjustment" ? "Clearing..." : "Clear adjustment"}
              </Button>
              <Button
                type="button"
                appearance="primary"
                icon={<Edit20Regular />}
                onClick={() => setAdjustmentDialogOpen(true)}
              >
                Adjust summary
              </Button>
            </div>
          ) : activeSection === "processing-exceptions" && detailsRow && canResolveExceptions ? (
            <div className="flex w-full flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_1fr]">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Status</span>
                  <FluentSelect
                    ariaLabel="Status"
                    value={exceptionStatus}
                    onChange={setExceptionStatus}
                    options={[
                      { value: "OPEN", label: "Open" },
                      { value: "RESOLVED", label: "Resolved" },
                      { value: "IGNORED", label: "Ignored" },
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-slate-700">Resolution note</span>
                  <Textarea
                    className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    aria-label="Resolution note"
                    value={exceptionResolutionNote}
                    onChange={(event) => setExceptionResolutionNote(event.target.value)}
                    placeholder="Explain how this exception was resolved or why it is being ignored."
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void saveProcessingException()}
                  disabled={detailsActionBusy === "save-exception"}
                >
                  {detailsActionBusy === "save-exception" ? "Saving..." : "Save exception status"}
                </button>
              </div>
            </div>
          ) : null
        }
      />

      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogPopup className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Adjust daily summary</DialogTitle>
            <DialogDescription>
              Apply a manual attendance adjustment while keeping the raw punches unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Check-in at</span>
                <DateTimeInput
                  aria-label="Check-in at"
                  value={adjustmentForm.check_in_at}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, check_in_at: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Check-out at</span>
                <DateTimeInput
                  aria-label="Check-out at"
                  value={adjustmentForm.check_out_at}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, check_out_at: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Attendance status</span>
                <FluentSelect
                  ariaLabel="Attendance status"
                  placeholder="Keep current"
                  value={adjustmentForm.attendance_status}
                  onChange={(value) =>
                    setAdjustmentForm((current) => ({ ...current, attendance_status: value }))
                  }
                  options={[
                    { value: "", label: "Keep current" },
                    ...DAILY_SUMMARY_STATUS_OPTIONS.map((status) => ({
                      value: status,
                      label: prettifyLabel(status),
                    })),
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Break minutes</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  inputMode="numeric"
                  value={adjustmentForm.break_minutes}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, break_minutes: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Worked minutes</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  inputMode="numeric"
                  value={adjustmentForm.worked_minutes}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, worked_minutes: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Late minutes</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  inputMode="numeric"
                  value={adjustmentForm.late_minutes}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, late_minutes: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Early departure minutes</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  inputMode="numeric"
                  value={adjustmentForm.early_departure_minutes}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({
                      ...current,
                      early_departure_minutes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium text-slate-700">Overtime minutes</span>
                <input
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  inputMode="numeric"
                  value={adjustmentForm.overtime_minutes}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, overtime_minutes: event.target.value }))
                  }
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Notes</span>
              <Textarea
                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                value={adjustmentForm.notes}
                onChange={(event) =>
                  setAdjustmentForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Document why this manual adjustment was approved."
              />
            </label>
          </div>
          <DialogFooter>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={() => setAdjustmentDialogOpen(false)}
            >
              Close
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium !text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              disabled={adjustmentBusy}
              onClick={() => void saveDailySummaryAdjustment()}
            >
              {adjustmentBusy ? "Saving..." : "Save adjustment"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}

const DIMENSION_FILTER_KEYS = ["status", "primary_status", "punch_status", "arrival_status", "departure_status"] as const
const MISSING_PUNCH_VALUES = "MISSING_CHECK_IN,MISSING_CHECK_OUT,MISSING_BOTH"
const IN_PROGRESS_PUNCH_VALUES = "IN_PROGRESS,INVALID"

/** Counter keys: "" (all), "primary:X", "arrival:LATE", "departure:EARLY_DEPARTURE", "punch:missing". */
function dimensionCounterFilterPatch(key: string): Record<string, string> {
  const patch: Record<string, string> = Object.fromEntries(DIMENSION_FILTER_KEYS.map((k) => [k, ""]))
  const [dimension, value] = key.split(":")
  if (dimension === "primary") patch.primary_status = value
  else if (dimension === "arrival") patch.arrival_status = value
  else if (dimension === "departure") patch.departure_status = value
  else if (dimension === "punch") patch.punch_status = value === "missing" ? MISSING_PUNCH_VALUES : value === "in_progress" ? IN_PROGRESS_PUNCH_VALUES : value
  return patch
}

function activeDimensionCounterKey(filters: Record<string, string>): string {
  if (filters.primary_status) return `primary:${filters.primary_status}`
  if (filters.arrival_status) return `arrival:${filters.arrival_status}`
  if (filters.departure_status) return `departure:${filters.departure_status}`
  if (filters.punch_status) return filters.punch_status === MISSING_PUNCH_VALUES ? "punch:missing" : filters.punch_status === IN_PROGRESS_PUNCH_VALUES ? "punch:in_progress" : `punch:${filters.punch_status}`
  return ""
}

function buildDimensionCounters(
  total: number,
  dims: { primary: Record<string, number>; punch: Record<string, number>; arrival: Record<string, number>; departure: Record<string, number> },
) {
  const core = ["PRESENT", "ABSENT", "LEAVE", "NOT_YET_CHECKED_IN"]
  const primaryKeys = [...core, ...Object.keys(dims.primary).filter((k) => !core.includes(k) && dims.primary[k] > 0).sort()]
  const missing = (dims.punch.MISSING_CHECK_IN ?? 0) + (dims.punch.MISSING_CHECK_OUT ?? 0) + (dims.punch.MISSING_BOTH ?? 0)
  return [
    { key: "", label: "All", count: total },
    ...primaryKeys.map((k) => ({
      key: `primary:${k}`,
      label: PRIMARY_STATUS[k]?.label ?? prettifyStatus(k),
      count: dims.primary[k] ?? 0,
      tone: PRIMARY_STATUS[k]?.tone ?? attendanceStatusTone(k),
    })),
    { key: "arrival:LATE", label: "Late arrival", count: dims.arrival.LATE ?? 0, tone: "warn" as const },
    { key: "departure:EARLY_DEPARTURE", label: "Early departure", count: dims.departure.EARLY_DEPARTURE ?? 0, tone: "warn" as const },
    { key: "punch:missing", label: "Missing punches", count: missing, tone: "bad" as const },
    { key: "punch:in_progress", label: "In progress", count: (dims.punch.INVALID ?? 0) + (dims.punch.IN_PROGRESS ?? 0), tone: "info" as const },
  ]
}
