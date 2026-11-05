"use client"

import { requiresEvidenceBeforeSubmission } from "@/lib/leave-evidence"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { EmployeeProfileRequiredState } from "@/components/dashboard/employee-profile-required-state"
import * as React from "react"
import { motion } from "framer-motion"
import {
  Badge as FluentBadge,
  Button as FluentButton,
  Card as FluentCard,
  CardFooter as FluentCardFooter,
  Dialog as FluentDialog,
  DialogActions as FluentDialogActions,
  DialogBody as FluentDialogBody,
  DialogContent as FluentDialogContent,
  DialogSurface as FluentDialogSurface,
  DialogTitle as FluentDialogTitle,
  Dropdown as FluentDropdown,
  Field as FluentField,
  Input as FluentInput,
  Option as FluentOption,
  Textarea as FluentTextarea,
  makeStyles,
  Persona,
  PresenceBadge,
  ProgressBar,
  Tab,
  TabList,
  Table as FluentTable,
  TableBody as FluentTableBody,
  TableCell as FluentTableCell,
  TableHeader as FluentTableHeader,
  TableHeaderCell as FluentTableHeaderCell,
  TableRow as FluentTableRow,
  Text as FluentText,
} from "@fluentui/react-components"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Briefcase20Regular,
  Building20Regular,
  PeopleTeam20Regular,
  Calendar20Regular,
  Person20Regular,
  Location20Regular,
  Briefcase20Color,
  Building20Color,
  CalendarClock20Color,
  CalendarSync20Color,
  ArrowClockwiseRegular as PayrollRefreshIcon,
  ArrowDownloadRegular as PayrollDownloadIcon,
  CalendarLtrRegular as PayrollCalendarIcon,
  DocumentRegular as PayrollDocumentIcon,
  EyeRegular as PayrollDetailsIcon,
  WalletRegular as PayrollWalletIcon,
  BuildingBank20Regular,
  History20Regular,
  Money20Regular,
  PersonMoney20Regular,
  ReceiptMoney20Regular,
  Savings20Regular,
  ShieldCheckmark20Regular,
  Camera20Color,
  Add20Regular,
  ContactCard20Color,
  ContactCard20Regular,
  Edit16Regular,
  LocationAdd20Regular,
  PeopleAdd20Regular,
  PeopleTeam20Color,
  Person20Color,
  ArrowSync20Regular,
  DocumentPdf20Regular,
  Eye20Regular,
  Send20Regular,
  Edit20Regular,
  Dismiss20Regular,
  Save20Regular,
} from "@fluentui/react-icons"
import { ArrowLeft, ArrowRightIcon, CheckCircle2, PencilIcon, RefreshCwIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import { HeroBand, heroGhostButtonClass, heroPanelClass, pageBleedClass } from "@/components/dashboard/talent-visuals"

import {
  acknowledgeMyMovement,
  cancelMyProfileUpdateRequest,
  getEmployeeDashboard,
  getMyAttendanceAssignments,
  getMyAttendanceOverview,
  getMyAttendanceToday,
  getMyDashboard,
  getMyMovement,
  getMyStatus,
  createMyLeaveRequest,
  uploadMyLeaveRequestDocument,
  getCurrentEmployee,
  getEmployeeById,
  getCurrentAdmin,
  listAttendanceHolidays,
  listBranches,
  listDepartments,
  listEmployees,
  listMyAttendanceCorrectionRequests,
  listMyAttendancePunches,
  listMyLeaveBalances,
  listMyMovements,
  listLeavePolicies,
  listMyLeaveRequests,
  listLeaveTypes,
  createMyProfileChangeRequest,
  createMyEmployeeSectionItem,
  listCompanyBanks,
  getMyProfileChangeRequest,
  submitMyProfileChangeRequest,
  cancelMyProfileChangeRequest,
  getMyProfileUpdateRequest,
  listMyProfileUpdateRequests,
  listMyTeamAttendance,
  submitMyProfileUpdateRequest,
  cancelMyLeaveRequest,
  downloadMyLeaveRequestPdf,
  getMyPayslip,
  getMyPayrollSummary,
  submitMyLeaveRequest,
  updateMyLeaveRequest,
  resubmitMyLeaveRequest,
  uploadMyProfilePhoto,
  selectMyProfileAvatar,
  listSelectableAvatarsForMe,
  listMyPayslips,
  extractDefaultAvatarImageUrl,
  downloadMyPayslip,
  readDefaultAvatarId,
  resolveBackendMediaUrl,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  ensureMyProfilePhotoUrl,
  setMyProfilePhotoUrl,
  useMyProfilePhoto,
} from "@/lib/my-profile-photo"
import { AUTH_STORAGE_KEYS, resolveApiBaseUrl } from "@/utils/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { LeaveWorkflowDialog } from "@/components/leave/leave-workflow-progress"
import { LeaveAccrualProjectionCard } from "@/components/leave/leave-accrual-projection-card"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

function BackToSettingsLink() {
  return (
    <Link
      href="/dashboard/settings"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to Settings
    </Link>
  )
}

type SelfLeaveTab = "requests" | "balances" | "holidays" | "policies"
type SelfProfileTab = "summary" | "assignments" | "personal" | "records" | "updates"

const useProfileNavigationStyles = makeStyles({
  tabList: {
    minWidth: "max-content",
  },
  tab: {
    fontSize: "10.72px",
    lineHeight: "16px",
  },
})

type EmployeeSelfServiceLeaveViewProps = {
  tab: SelfLeaveTab
}

const SELF_SERVICE_UNAVAILABLE_MESSAGE = "This section is not available for your account yet."

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function asRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is AdminRecord =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry)
      )
    : []
}

function readString(row: AdminRecord | null, keys: string[], fallback = "-") {
  if (!row) {
    return fallback
  }
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return fallback
}

function readNumber(row: AdminRecord | null, keys: string[]) {
  if (!row) {
    return null
  }
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

function readNumberish(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

function formatTimeValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const [hours, minutes] = value.split(":")
  const parsedHours = Number(hours)
  const parsedMinutes = Number(minutes)
  if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) {
    return value
  }

  const date = new Date()
  date.setHours(parsedHours, parsedMinutes, 0, 0)
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

/** Coerce API punch times (ISO, HH:mm, unix ms/s, nested objects) to a display clock. */
function coerceAttendancePunchValue(value: unknown): string {
  if (value == null || value === "" || value === "-" || value === "—") {
    return ""
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : NaN
    if (Number.isFinite(ms)) {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(ms))
    }
    return ""
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed || trimmed === "-" || trimmed === "—") {
      return ""
    }
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return formatTimeValue(trimmed)
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        minute: "2-digit",
      }).format(parsed)
    }
    return trimmed
  }

  const record = asRecord(value)
  if (record) {
    return (
      coerceAttendancePunchValue(record.punched_at) ||
      coerceAttendancePunchValue(record.punchedAt) ||
      coerceAttendancePunchValue(record.punch_time) ||
      coerceAttendancePunchValue(record.punchTime) ||
      coerceAttendancePunchValue(record.punch_at) ||
      coerceAttendancePunchValue(record.punchAt) ||
      coerceAttendancePunchValue(record.time) ||
      coerceAttendancePunchValue(record.at) ||
      coerceAttendancePunchValue(record.timestamp) ||
      coerceAttendancePunchValue(record.datetime) ||
      coerceAttendancePunchValue(record.created_at) ||
      coerceAttendancePunchValue(record.createdAt)
    )
  }

  return ""
}

function readAttendanceTimeValue(
  record: AdminRecord | null | undefined,
  keys: string[],
  fallbackRecord?: AdminRecord | null | undefined
) {
  if (record) {
    for (const key of keys) {
      const formatted = coerceAttendancePunchValue(record[key])
      if (formatted) return formatted
    }
  }
  if (fallbackRecord) {
    for (const key of keys) {
      const formatted = coerceAttendancePunchValue(fallbackRecord[key])
      if (formatted) return formatted
    }
  }
  return ""
}

const PROFILE_CHECK_IN_KEYS = [
  "checkInAt",
  "check_in_at",
  "firstCheckInAt",
  "first_check_in_at",
  "first_punch",
  "first_punch_at",
  "firstPunchAt",
  "check_in_time",
  "checkInTime",
  "check_in",
  "checkIn",
  "clock_in_at",
  "clockInAt",
  "clock_in",
  "clockIn",
  "in_time",
  "inTime",
  "actual_check_in_at",
  "actualCheckInAt",
]

const PROFILE_CHECK_OUT_KEYS = [
  "checkOutAt",
  "check_out_at",
  "lastCheckOutAt",
  "last_check_out_at",
  "last_punch",
  "last_punch_at",
  "lastPunchAt",
  "check_out_time",
  "checkOutTime",
  "check_out",
  "checkOut",
  "clock_out_at",
  "clockOutAt",
  "clock_out",
  "clockOut",
  "out_time",
  "outTime",
  "actual_check_out_at",
  "actualCheckOutAt",
]

function profilePunchType(row: AdminRecord): "CHECK_IN" | "CHECK_OUT" | "" {
  const raw = String(
    row.punch_type ??
      row.punchType ??
      row.type ??
      row.direction ??
      row.event_type ??
      row.eventType ??
      row.in_out ??
      row.inOut ??
      ""
  )
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")

  if (!raw) return ""
  if (raw.includes("OUT") || raw === "CHECKOUT" || raw.endsWith("_OUT")) return "CHECK_OUT"
  if (raw.includes("IN") || raw === "CHECKIN" || raw.endsWith("_IN")) return "CHECK_IN"
  return ""
}

function profilePunchSortKey(row: AdminRecord): number {
  const candidates = [
    row.punched_at,
    row.punchedAt,
    row.punch_time,
    row.punchTime,
    row.punch_at,
    row.punchAt,
    row.timestamp,
    row.created_at,
    row.createdAt,
    row.time,
    row.at,
  ]
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1e12 ? value : value > 1e9 ? value * 1000 : value
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Date.parse(value)
      if (!Number.isNaN(parsed)) return parsed
      const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
      if (match) {
        return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)
      }
    }
  }
  return 0
}

function profilePunchTimeRaw(row: AdminRecord): string {
  return (
    coerceAttendancePunchValue(row.punched_at) ||
    coerceAttendancePunchValue(row.punchedAt) ||
    coerceAttendancePunchValue(row.punch_time) ||
    coerceAttendancePunchValue(row.punchTime) ||
    coerceAttendancePunchValue(row.punch_at) ||
    coerceAttendancePunchValue(row.punchAt) ||
    coerceAttendancePunchValue(row.time) ||
    coerceAttendancePunchValue(row.at) ||
    coerceAttendancePunchValue(row.timestamp) ||
    coerceAttendancePunchValue(row.created_at) ||
    coerceAttendancePunchValue(row.createdAt)
  )
}

/** First check-in / last check-out from punch history (dashboard source of truth). */
function punchTimesFromHistory(punches: AdminRecord[] | undefined): { first: string; last: string } {
  if (!Array.isArray(punches) || punches.length === 0) {
    return { first: "", last: "" }
  }

  const sorted = [...punches].sort((a, b) => profilePunchSortKey(a) - profilePunchSortKey(b))
  const checkIns = sorted.filter((row) => profilePunchType(row) === "CHECK_IN")
  const checkOuts = sorted.filter((row) => profilePunchType(row) === "CHECK_OUT")

  let first = checkIns.length > 0 ? profilePunchTimeRaw(checkIns[0]!) : ""
  let last = checkOuts.length > 0 ? profilePunchTimeRaw(checkOuts[checkOuts.length - 1]!) : ""

  if (!first || !last) {
    const allTimes = sorted.map(profilePunchTimeRaw).filter(Boolean)
    if (!first && allTimes.length > 0) first = allTimes[0] ?? ""
    if (!last && allTimes.length > 1) last = allTimes[allTimes.length - 1] ?? ""
  }

  if (first && last && first === last && sorted.length === 1) {
    last = ""
  }

  return { first, last }
}

function localDateIso(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function isPunchOnLocalDate(row: AdminRecord, dateIso: string): boolean {
  const candidates = [
    row.attendance_date,
    row.attendanceDate,
    row.work_date,
    row.workDate,
    row.date,
    row.punched_at,
    row.punchedAt,
    row.created_at,
    row.createdAt,
  ]
  for (const value of candidates) {
    if (typeof value !== "string" || !value.trim()) continue
    if (value.slice(0, 10) === dateIso) return true
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      if (localDateIso(parsed) === dateIso) return true
    }
  }
  return false
}

function resolveTodayPunchTimes(
  today: AdminRecord | null | undefined,
  punchesToday?: AdminRecord[]
): { first: string; last: string } {
  const summary = today
    ? asRecord(today.summary) ??
      asRecord(today.daily_summary) ??
      asRecord(today.dailySummary) ??
      asRecord(today.attendance)
    : null

  const fromHistory = punchTimesFromHistory(punchesToday)

  let first =
    fromHistory.first ||
    readAttendanceTimeValue(today, PROFILE_CHECK_IN_KEYS, summary)

  let last =
    fromHistory.last ||
    readAttendanceTimeValue(today, PROFILE_CHECK_OUT_KEYS, summary)

  // Nested punch lists on the today payload (same as dashboard home).
  if (today && (!first || !last)) {
    const listCandidates = [
      today.punches,
      today.punch_logs,
      today.punchLogs,
      today.events,
      today.attendance_logs,
      today.attendanceLogs,
      summary?.punches,
      summary?.punch_logs,
      summary?.events,
    ]
    for (const candidate of listCandidates) {
      if (!Array.isArray(candidate) || candidate.length === 0) continue
      const nested = punchTimesFromHistory(
        candidate
          .map((entry) => asRecord(entry))
          .filter((entry): entry is AdminRecord => entry !== null)
      )
      if (!first && nested.first) first = nested.first
      if (!last && nested.last) last = nested.last
      if (first && last) break
    }
  }

  if (first && last && first === last) {
    const onlyOneHistory = Array.isArray(punchesToday) && punchesToday.length === 1
    if (onlyOneHistory) {
      last = ""
    }
  }

  return { first, last }
}

function formatMinutesDuration(value: unknown) {
  const minutes = readNumberish(value)
  if (minutes === null) {
    return "-"
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes.toString().padStart(2, "0")}m`
}

function formatUnknownValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-"
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "-"
  }
  if (typeof value === "string") {
    return value.trim() || "-"
  }
  return "-"
}

function formatDayValue(value: unknown) {
  const numeric = readNumberish(value)
  if (numeric === null) {
    return "-"
  }
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
}

function readAttendanceValue(
  record: AdminRecord | null | undefined,
  keys: string[],
  fallbackRecord?: AdminRecord | null | undefined,
  fallback = ""
) {
  const direct = readString(record ?? null, keys, "")
  if (direct) {
    return direct
  }
  const next = readString(fallbackRecord ?? null, keys, "")
  if (next) {
    return next
  }
  return fallback
}

function resolveProfileAttendanceState(rawState: string, firstPunch: string, lastPunch: string) {
  const normalized = formatPunchState(rawState)
  const lower = normalized.trim().toLowerCase()
  const hasFirstPunch = firstPunch !== "-"
  const hasLastPunch = lastPunch !== "-"

  if (hasLastPunch && (lower === "not checked in" || lower === "no activity")) {
    return "Checked out"
  }

  if (hasFirstPunch && !hasLastPunch && (lower === "not checked in" || lower === "no activity")) {
    return "Checked in"
  }

  return normalized
}

function formatLeaveBalanceValue(value: unknown) {
  const numeric = readNumberish(value)
  if (numeric === null) {
    return null
  }
  return numeric.toFixed(2)
}

function findBalanceAvailableDays(row: AdminRecord | null) {
  if (!row) {
    return null
  }
  return readNumberish(
    row.available_days ??
      row.availableDays ??
      row.available ??
      row.remaining_days ??
      row.remainingDays ??
      row.remaining ??
      row.balance ??
      row.current_balance ??
      row.currentBalance
  )
}

function readLeaveTypeId(row: AdminRecord | null) {
  if (!row) {
    return null
  }
  const nestedLeaveType =
    asRecord(row.leave_type) ?? asRecord(row.leaveType) ?? asRecord(row.type) ?? asRecord(row.leave)
  return (
    readNumberish(row.leave_type_id ?? row.leaveTypeId ?? row.type_id ?? row.typeId) ??
    readNumberish(nestedLeaveType?.id ?? nestedLeaveType?.leave_type_id ?? nestedLeaveType?.leaveTypeId)
  )
}

function countInclusiveLeaveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) {
    return null
  }

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const startTime = start.getTime()
  const endTime = end.getTime()
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return null
  }

  return Math.floor((endTime - startTime) / 86_400_000) + 1
}

function readRequestedLeaveDays(row: AdminRecord | null) {
  if (!row) {
    return null
  }

  const explicitDays = readNumberish(
    row.days ?? row.total_days ?? row.totalDays ?? row.number_of_days ?? row.numberOfDays ?? row.duration_days
  )
  if (explicitDays !== null) {
    return explicitDays
  }

  const startDate = readString(row, ["start_date"], "")
  const endDate = readString(row, ["end_date"], "")
  return countInclusiveLeaveDays(startDate, endDate)
}

function buildLeaveBalanceSubmissionError(availableDays: number | null) {
  const normalizedAvailable = availableDays !== null ? availableDays.toFixed(2) : null

  if (normalizedAvailable !== null && Number(normalizedAvailable) < 0) {
    return `This leave type is already overdrawn (${normalizedAvailable} day(s) available). New submitted requests are blocked until HR adjusts the balance or the leave policy allows negative balances.`
  }

  if (normalizedAvailable !== null) {
    return `This request exceeds the available balance for the selected leave type (${normalizedAvailable} day(s) left).`
  }

  return "This request exceeds the available balance for the selected leave type."
}

function validateLeaveSubmissionBalance({
  availableDays,
  requestedDays,
}: {
  availableDays: number | null
  requestedDays: number | null
}) {
  if (availableDays === null) {
    return null
  }

  if (availableDays < 0) {
    return buildLeaveBalanceSubmissionError(availableDays)
  }

  if (requestedDays !== null && requestedDays > availableDays) {
    return buildLeaveBalanceSubmissionError(availableDays)
  }

  return null
}

function formatLeaveRequestError(errorObject: unknown, availableDays: number | null) {
  const fallback = errorObject instanceof Error ? errorObject.message : "Failed to submit leave request."
  if (!(errorObject instanceof Error)) {
    return fallback
  }

  const message = errorObject.message.trim()
  if (!/insufficient leave balance/i.test(message)) {
    return fallback
  }

  const parsedAvailable = message.match(/available:\s*(-?\d+(?:\.\d+)?)\s*day/i)
  const parsedDays = parsedAvailable ? Number(parsedAvailable[1]) : availableDays
  const normalizedAvailable = Number.isFinite(parsedDays) ? Number(parsedDays) : availableDays

  return buildLeaveBalanceSubmissionError(normalizedAvailable ?? null)
}

function resolveLeaveStatusMeta(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_")

  if (normalized === "draft") {
    return {
      key: "draft" as const,
      label: "Draft",
      badgeClassName: "bg-slate-500/12 text-slate-700 dark:text-slate-300",
      helperText: "Saved as draft",
      textClassName: "text-slate-700 dark:text-slate-300",
      barClassName: "bg-slate-400",
      chipClassName: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
    }
  }

  if (normalized === "returned_for_correction") {
    return {
      key: "returned" as const,
      label: "Returned",
      badgeClassName: "bg-orange-500/12 text-orange-800 dark:text-orange-300",
      helperText: "Needs your changes — edit and resubmit",
      textClassName: "text-orange-700 dark:text-orange-300",
      barClassName: "bg-orange-500",
      chipClassName: "bg-orange-500/10 text-orange-800 dark:text-orange-300",
    }
  }

  if (
    [
      "pending",
      "submitted",
      "in_review",
      "under_review",
      "pending_department_manager",
      "pending_hr",
    ].includes(normalized)
  ) {
    return {
      key: "pending" as const,
      label:
        normalized === "pending_department_manager"
          ? "Pending manager"
          : normalized === "pending_hr"
            ? "Pending HR"
            : normalized === "in_review"
              ? "Pending management"
              : raw.replace(/_/g, " ") || "Pending",
      badgeClassName: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
      helperText: "Awaiting review",
      textClassName: "text-amber-700 dark:text-amber-300",
      barClassName: "bg-amber-500",
      chipClassName: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
    }
  }

  if (normalized === "approved" || normalized === "completed") {
    return {
      key: "approved" as const,
      label: normalized === "completed" ? "Completed" : "Approved",
      badgeClassName: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      helperText: "Approved",
      textClassName: "text-emerald-700 dark:text-emerald-300",
      barClassName: "bg-emerald-500",
      chipClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    }
  }

  if (normalized === "rejected") {
    return {
      key: "rejected" as const,
      label: "Rejected",
      badgeClassName: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
      helperText: "Rejected",
      textClassName: "text-rose-700 dark:text-rose-300",
      barClassName: "bg-rose-500",
      chipClassName: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    }
  }

  if (normalized === "cancelled") {
    return {
      key: "cancelled" as const,
      label: "Cancelled",
      badgeClassName: "bg-muted text-muted-foreground",
      helperText: "Cancelled",
      textClassName: "text-muted-foreground",
      barClassName: "bg-slate-300 dark:bg-slate-600",
      chipClassName: "bg-muted text-muted-foreground",
    }
  }

  return {
    key: "other" as const,
    label: raw.replace(/_/g, " ") || "Pending",
    badgeClassName: "bg-primary/10 text-primary",
    helperText: raw ? "In progress" : "",
    textClassName: "text-primary",
    barClassName: "bg-primary",
    chipClassName: "bg-primary/10 text-primary",
  }
}

function resolveMovementStatusMeta(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  const normalized = raw.toLowerCase().replace(/[\s-]+/g, "_")

  if (normalized === "draft") {
    return {
      label: "Draft",
      badgeTone: "muted" as const,
      helperText: "Saved but not submitted.",
    }
  }

  if (["submitted", "pending_approval", "returned_for_correction", "scheduled", "applying"].includes(normalized)) {
    return {
      label: raw.replace(/_/g, " ") || "Pending approval",
      badgeTone: "amber" as const,
      helperText: "Still moving through the workflow.",
    }
  }

  if (["approved", "applied"].includes(normalized)) {
    return {
      label: normalized === "applied" ? "Applied" : "Approved",
      badgeTone: "success" as const,
      helperText: normalized === "applied" ? "Already applied to your profile." : "Approved and waiting for acknowledgement or application.",
    }
  }

  if (normalized === "application_failed" || normalized === "rejected") {
    return {
      label: normalized === "application_failed" ? "Application failed" : "Rejected",
      badgeTone: "primary" as const,
      helperText: normalized === "application_failed" ? "HR needs to retry or correct this movement." : "This request was rejected.",
    }
  }

  if (normalized === "cancelled") {
    return {
      label: "Cancelled",
      badgeTone: "muted" as const,
      helperText: "This movement was cancelled.",
    }
  }

  return {
    label: raw.replace(/_/g, " ") || "In progress",
    badgeTone: "primary" as const,
    helperText: "",
  }
}

function readMovementId(row: AdminRecord | null | undefined) {
  if (!row) return null
  return readNumber(row, ["id", "movementId", "movement_id"])
}

function readMovementType(row: AdminRecord | null | undefined) {
  return readString(row ?? null, ["movementType", "movement_type"], "Movement")
}

function readMovementAcknowledgedAt(row: AdminRecord | null | undefined) {
  return readString(row ?? null, ["employeeAcknowledgedAt", "employee_acknowledged_at"], "")
}

function needsMovementAcknowledgement(row: AdminRecord | null | undefined) {
  if (!row) return false
  const requiresAcknowledgement = Boolean(
    row.employeeAcknowledgementRequired ?? row.employee_acknowledgement_required
  )
  if (!requiresAcknowledgement) return false
  return !readMovementAcknowledgedAt(row)
}

function stringifyMovementValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value.trim() || "—"
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.length ? value.map((entry) => stringifyMovementValue(entry)).join(", ") : "—"

  const record = asRecord(value)
  if (record) {
    const preferred =
      readString(record, ["name", "title", "label", "code", "full_name", "display_name", "displayName"], "") ||
      readString(record, ["employee_no", "employeeNo", "movementNo"], "")
    if (preferred && preferred !== "-") {
      return preferred
    }

    const amount = readString(record, ["amount", "salary", "base_salary", "baseSalary"], "")
    if (amount && amount !== "-") {
      return amount
    }

    const entries = Object.entries(record)
      .filter(([, entry]) => entry !== null && entry !== undefined && entry !== "")
      .slice(0, 3)
      .map(([key, entry]) => `${key}: ${stringifyMovementValue(entry)}`)
    return entries.length ? entries.join(" | ") : "—"
  }

  return String(value)
}

function formatMovementLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function movementStatusClass(status: string) {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (normalized === "approved" || normalized === "applied") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }
  if (normalized === "rejected" || normalized === "application_failed") {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }
  if (["submitted", "pending_approval", "returned_for_correction", "scheduled", "applying"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }
  if (normalized === "cancelled" || normalized === "draft") {
    return "border-slate-200 bg-slate-100 text-slate-600"
  }
  return "border-sky-200 bg-sky-50 text-sky-700"
}

function readPayslipId(row: AdminRecord | null | undefined) {
  if (!row) return null
  return readNumber(row, ["id", "payslip_id", "payslipId"])
}

function readPayslipCurrency(row: AdminRecord | null | undefined) {
  return readString(row ?? null, ["currency", "currency_code", "currencyCode"], "")
}

function formatPayslipMoney(value: unknown, currency = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${currency ? `${currency} ` : ""}${value.toLocaleString()}`
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return `${currency ? `${currency} ` : ""}${parsed.toLocaleString()}`
    }
    return value.trim()
  }
  return "—"
}

function readPayslipPeriodLabel(row: AdminRecord | null | undefined) {
  if (!row) return "Payslip"

  const periodRecord =
    asRecord(row.payroll_period) ??
    asRecord(row.payrollPeriod) ??
    asRecord(row.period)

  const namedPeriod =
    readString(periodRecord, ["name", "title", "code"], "") ||
    readString(row, ["period_name", "periodName", "month_name", "monthName"], "")
  if (namedPeriod && namedPeriod !== "-") return namedPeriod

  const month = readString(periodRecord, ["month_name", "monthName", "month"], "") || readString(row, ["month_name", "monthName", "month"], "")
  const year = readString(periodRecord, ["year"], "") || readString(row, ["year"], "")
  if (month && year) return `${month} ${year}`
  if (month) return month
  if (year) return year

  const startDate = readString(periodRecord, ["start_date", "startDate"], "") || readString(row, ["start_date", "startDate"], "")
  const endDate = readString(periodRecord, ["end_date", "endDate"], "") || readString(row, ["end_date", "endDate"], "")
  if (startDate !== "-" || endDate !== "-") {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  return "Payslip"
}

function readPayslipStatus(row: AdminRecord | null | undefined) {
  return readString(row ?? null, ["status"], "")
}

function readPayslipLineItems(
  row: AdminRecord | null | undefined,
  keys: string[]
) {
  if (!row) return []
  for (const key of keys) {
    const value = row[key]
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is AdminRecord =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry)
      )
    }
  }
  return []
}

function downloadLocalBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function readLeaveTotalsValue(totals: Record<string, number> | undefined, keys: string[]) {
  if (!totals) {
    return null
  }

  for (const key of keys) {
    const value = totals[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function formatEmploymentType(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  return value
    .split("_")
    .filter(Boolean)
    .map((item) => item[0]?.toUpperCase() + item.slice(1))
    .join(" ")
}

function formatPunchState(value: unknown): string {
  if (!value) return "No activity";
  const str = String(value).trim();
  if (!str) return "No activity";

  const lower = str.toLowerCase().replace(/[- ]/g, "_");

  const semanticMap: Record<string, string> = {
    not_checked_in: "Not checked in",
    no_activity: "No activity",
    checked_in: "Checked in",
    checked_out: "Checked out",
    on_break: "On break",
    present: "Present",
    absent: "Absent",
    late: "Late",
    half_day: "Half day",
    off_day: "Off day",
    holiday: "Holiday",
    on_leave: "On leave",
  };

  if (semanticMap[lower]) {
    return semanticMap[lower];
  }

  // Fallback: make it title case
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatProcessingState(value: unknown): string {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  const lower = str.toLowerCase().replace(/[- ]/g, "_");
  const map: Record<string, string> = {
    pending: "Pending",
    processed: "Processed",
    recalculating: "Recalculating",
    in_progress: "In progress",
  };
  if (map[lower]) return map[lower];
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

function readStoredUser() {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
  if (!raw) {
    return null
  }

  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return null
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
    return asRecord(JSON.parse(atob(padded)))
  } catch {
    return null
  }
}

function findCurrentEmployee(employees: AdminRecord[], currentUser: AdminRecord | null, currentAdmin: AdminRecord | null) {
  const currentUserId = readNumber(currentUser, ["id", "user_id"])
  const currentUserEmail = readString(currentUser, ["email"], "").toLowerCase()
  const adminId = readNumber(currentAdmin, ["id", "user_id"])
  const adminEmail = readString(currentAdmin, ["email"], "").toLowerCase()

  return (
    employees.find((employee) => {
      const companyUser = asRecord(employee.company_user)
      const nestedUser = asRecord(companyUser?.user)
      const linkedUser = nestedUser ?? companyUser

      const linkedUserId = readNumber(linkedUser, ["id", "user_id"])
      const linkedUserEmail = readString(linkedUser, ["email"], "").toLowerCase()
      const employeeUserId = readNumber(employee, ["user_id", "company_user_id"])
      const employeeEmail = readString(employee, ["email"], "").toLowerCase()

      if (currentUserId !== null && linkedUserId !== null && linkedUserId === currentUserId) {
        return true
      }
      if (currentUserId !== null && employeeUserId !== null && employeeUserId === currentUserId) {
        return true
      }
      if (adminId !== null && linkedUserId !== null && linkedUserId === adminId) {
        return true
      }
      if (adminId !== null && employeeUserId !== null && employeeUserId === adminId) {
        return true
      }
      if (currentUserEmail && linkedUserEmail && linkedUserEmail === currentUserEmail) {
        return true
      }
      if (currentUserEmail && employeeEmail && employeeEmail === currentUserEmail) {
        return true
      }
      if (adminEmail && linkedUserEmail && linkedUserEmail === adminEmail) {
        return true
      }
      if (adminEmail && employeeEmail && employeeEmail === adminEmail) {
        return true
      }

      return false
    }) ?? null
  )
}

function resolveEmployeeId(...sources: Array<AdminRecord | null>) {
  for (const source of sources) {
    const value = readNumber(source, ["employee_id", "employeeId", "id"])
    if (value !== null) {
      return value
    }
  }
  return null
}

function readNestedUserValue(currentUser: AdminRecord | null, keys: string[], fallback = "") {
  if (!currentUser) {
    return fallback
  }
  const direct = readString(currentUser, keys, "")
  if (direct) {
    return direct
  }

  const nestedUser = asRecord(currentUser.user)
  const nestedUserValue = readString(nestedUser, keys, "")
  if (nestedUserValue) {
    return nestedUserValue
  }

  const companies = Array.isArray(currentUser.companies) ? currentUser.companies : []
  for (const company of companies) {
    const value = readString(asRecord(company), keys, "")
    if (value) {
      return value
    }
  }

  return fallback
}

function readNestedEmployeeNumber(currentUser: AdminRecord | null) {
  return (
    readNestedUserValue(currentUser, ["employee_no", "employeeNo", "user_no"], "") ||
    readNestedUserValue(currentUser, ["employee_id", "employeeId"], "")
  )
}

function readNestedEmployeeId(currentUser: AdminRecord | null) {
  const direct = readNumber(currentUser, ["employee_id", "employeeId"])
  if (direct !== null) {
    return direct
  }
  const nestedUser = asRecord(currentUser?.user)
  const nestedValue = readNumber(nestedUser, ["employee_id", "employeeId"])
  if (nestedValue !== null) {
    return nestedValue
  }
  const companies = Array.isArray(currentUser?.companies) ? currentUser?.companies : []
  for (const company of companies) {
    const value = readNumber(asRecord(company), ["employeeId", "employee_id"])
    if (value !== null) {
      return value
    }
  }
  return null
}

function resolveBranchNameFromEmployee(employee: AdminRecord | null) {
  if (!employee) {
    return ""
  }

  const direct =
    readString(asRecord(employee.primary_branch), ["name", "branch_name"], "") ||
    readString(asRecord(employee.branch), ["name", "branch_name"], "") ||
    readString(employee, ["branch_name", "branch"], "")
  if (direct) {
    return direct
  }

  const departmentAssignments = Array.isArray(employee.departments) ? employee.departments : []
  for (const assignment of departmentAssignments) {
    const assignmentRecord = asRecord(assignment)
    const assignmentDepartment = asRecord(assignmentRecord?.department)
    const assignmentBranch = asRecord(assignmentDepartment?.branch) ?? asRecord(assignmentRecord?.branch)
    const value =
      readString(assignmentBranch, ["name", "branch_name"], "") ||
      readString(assignmentRecord, ["branch_name"], "")
    if (value) {
      return value
    }
  }

  return ""
}

function resolveDepartmentNameFromEmployee(employee: AdminRecord | null) {
  if (!employee) {
    return ""
  }

  const direct =
    readString(asRecord(employee.primary_department), ["name", "department_name"], "") ||
    readString(asRecord(employee.department), ["name", "department_name"], "") ||
    readString(employee, ["department_name", "department"], "")
  if (direct) {
    return direct
  }

  const departmentAssignments = Array.isArray(employee.departments) ? employee.departments : []
  for (const assignment of departmentAssignments) {
    const assignmentRecord = asRecord(assignment)
    const assignmentDepartment = asRecord(assignmentRecord?.department)
    const value =
      readString(assignmentDepartment, ["name", "department_name"], "") ||
      readString(assignmentRecord, ["department_name"], "")
    if (value) {
      return value
    }
  }

  return ""
}

function hasEmployeeProfileData(employee: AdminRecord | null) {
  if (!employee) {
    return false
  }
  return (
    readNumber(employee, ["id", "employee_id"]) !== null &&
    Boolean(
      readString(employee, ["employee_no", "employee_number", "employee_code", "user_no"], "") ||
        asRecord(employee.branch) ||
        asRecord(employee.department) ||
        asRecord(employee.position) ||
        readNumber(employee, ["branch_id", "department_id", "position_id", "company_user_id", "user_id"]) !== null
    )
  )
}

function employeeBelongsToCurrentUser(
  employee: AdminRecord | null,
  currentUser: AdminRecord | null,
  currentAdmin: AdminRecord | null,
) {
  if (!employee) return true

  const employeeCompanyUser = asRecord(employee.company_user)
  const linkedUser = asRecord(employeeCompanyUser?.user) ?? employeeCompanyUser
  const employeeUserId =
    readNumber(linkedUser, ["id", "user_id"]) ?? readNumber(employee, ["user_id"])
  const currentUserId =
    readNumber(currentUser, ["id", "user_id"]) ?? readNumber(currentAdmin, ["id", "user_id"])

  // The employee endpoint may return a rich but unrelated record for admin
  // accounts. Only reject it when both records expose comparable user IDs.
  return employeeUserId === null || currentUserId === null || employeeUserId === currentUserId
}

function isMissingCoreEmployeeFields(employee: AdminRecord | null) {
  if (!employee) {
    return true
  }
  const employeeNo = readString(employee, ["employee_no", "employee_number", "employee_code", "user_no"], "")
  const branchName = resolveBranchNameFromEmployee(employee)
  const departmentName = resolveDepartmentNameFromEmployee(employee)
  const positionName =
    readString(asRecord(employee.primary_position), ["name", "position_name"], "") ||
    readString(asRecord(employee.position), ["name", "position_name"], "")
  return !employeeNo || !branchName || !departmentName || !positionName
}

function mergeEmployeeRecords(primary: AdminRecord | null, secondary: AdminRecord | null) {
  if (!primary && !secondary) {
    return null
  }
  if (!primary) {
    return secondary
  }
  if (!secondary) {
    return primary
  }

  // Keep /employees/me payload as source of truth, then backfill missing keys only.
  const merged: AdminRecord = { ...secondary, ...primary }
  for (const [key, value] of Object.entries(primary)) {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value
    }
  }
  return merged
}

function enrichEmployeeWithOrgNames(employee: AdminRecord | null, resources: { branches: AdminRecord[]; departments: AdminRecord[] }) {
  if (!employee) {
    return employee
  }

  const branchNameFromEmployee = resolveBranchNameFromEmployee(employee)
  const departmentNameFromEmployee = resolveDepartmentNameFromEmployee(employee)

  const branchId = readNumber(employee, ["primary_branch_id", "branch_id", "branchId"])
  const departmentId = readNumber(employee, ["primary_department_id", "department_id", "departmentId"])

  const branchMatch =
    branchId !== null
      ? resources.branches.find((item) => readNumber(item, ["id", "branch_id"]) === branchId)
      : null
  const departmentMatch =
    departmentId !== null
      ? resources.departments.find((item) => readNumber(item, ["id", "department_id"]) === departmentId)
      : null

  const branchNameFromLookup = readString(branchMatch ?? null, ["name", "branch_name"], "")
  const departmentNameFromLookup = readString(departmentMatch ?? null, ["name", "department_name"], "")

  const next: AdminRecord = { ...employee }
  if (!branchNameFromEmployee && branchNameFromLookup) {
    next.branch_name = branchNameFromLookup
    next.branch = { ...(asRecord(next.branch) ?? {}), name: branchNameFromLookup }
  }
  if (!departmentNameFromEmployee && departmentNameFromLookup) {
    next.department_name = departmentNameFromLookup
    next.department = { ...(asRecord(next.department) ?? {}), name: departmentNameFromLookup }
  }
  return next
}

function enrichEmployeeFromAssignments(employee: AdminRecord | null) {
  if (!employee) {
    return employee
  }

  const branchNameFromEmployee = resolveBranchNameFromEmployee(employee)
  const departmentNameFromEmployee = resolveDepartmentNameFromEmployee(employee)

  if (branchNameFromEmployee && departmentNameFromEmployee) {
    return employee
  }

  const departmentAssignments = Array.isArray(employee.departments) ? employee.departments : []
  const assignmentRecord = asRecord(departmentAssignments[0])
  if (!assignmentRecord) {
    return employee
  }

  const assignmentBranch = asRecord(assignmentRecord.branch)
  const assignmentDepartment = asRecord(assignmentRecord.department)
  const branchName =
    readString(assignmentBranch, ["name", "branch_name"], "") || readString(assignmentRecord, ["branch_name"], "")
  const departmentName =
    readString(assignmentDepartment, ["name", "department_name"], "") || readString(assignmentRecord, ["department_name"], "")

  const next: AdminRecord = { ...employee }
  if (!branchNameFromEmployee && branchName) {
    next.branch_name = branchName
    next.branch = { ...(asRecord(next.branch) ?? {}), name: branchName }
  }
  if (!departmentNameFromEmployee && departmentName) {
    next.department_name = departmentName
    next.department = { ...(asRecord(next.department) ?? {}), name: departmentName }
  }
  return next
}

async function fetchEmployeeFromUrl(token: string, employeeUrl: string) {
  const path = employeeUrl.startsWith("/") ? employeeUrl : `/${employeeUrl}`
  const baseUrl = resolveApiBaseUrl()
  const response = await fetch(baseUrl ? `${baseUrl}${path}` : path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })
  if (!response.ok) {
    return null
  }
  const payload = (await response.json()) as unknown
  const root = asRecord(payload)
  const record =
    asRecord(root?.data) ??
    asRecord(root?.result) ??
    asRecord(root?.item) ??
    asRecord(asRecord(root?.data)?.employee) ??
    asRecord(asRecord(root?.result)?.employee) ??
    asRecord(root?.employee) ??
    root
  return record && typeof record === "object" ? (record as AdminRecord) : null
}

function useSelfEmployeeData() {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [token, setToken] = React.useState("")
  const [currentUser, setCurrentUser] = React.useState<AdminRecord | null>(null)
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null)

  const refresh = React.useCallback(async () => {
    const nextToken = readStoredToken()
    setToken(nextToken)

    if (!nextToken) {
      setError("Your session has expired. Please sign in again.")
      setEmployee(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const currentAdmin = await getCurrentAdmin(nextToken)
      const sessionUser = readStoredUser()
      const tokenPayload = decodeJwtPayload(nextToken)
      const mergedCurrentUser = {
        ...(currentAdmin ?? {}),
        ...(tokenPayload ?? {}),
        ...(sessionUser ?? {}),
      }
      setCurrentUser(mergedCurrentUser)

      let resolvedEmployee = await getCurrentEmployee(nextToken).catch(() => null)
      if (!employeeBelongsToCurrentUser(resolvedEmployee, mergedCurrentUser, currentAdmin)) {
        resolvedEmployee = null
      }
      const employeeFromMe = resolvedEmployee
      const hasRichEmployeeData = hasEmployeeProfileData(resolvedEmployee)

      if (!hasRichEmployeeData) {
        const searchEmail = readString(mergedCurrentUser, ["email"], "")
        const employeesResult = await listEmployees(nextToken, {
          page: 1,
          limit: 200,
          search: searchEmail || undefined,
        }).catch(() => ({
          rows: [] as AdminRecord[],
        }))
        const match = findCurrentEmployee(employeesResult.rows, mergedCurrentUser, currentAdmin)
        const matchedEmployeeId = resolveEmployeeId(match)
        resolvedEmployee = match

        if (matchedEmployeeId !== null) {
          const detailedEmployee = await getEmployeeById(matchedEmployeeId, nextToken).catch(() => null)
          if (detailedEmployee) {
            resolvedEmployee = mergeEmployeeRecords(resolvedEmployee, detailedEmployee)
          }
        }

        if (!hasEmployeeProfileData(resolvedEmployee)) {
          const nestedEmployeeId = readNestedEmployeeId(mergedCurrentUser)
          if (nestedEmployeeId !== null) {
            const detailedEmployee = await getEmployeeById(nestedEmployeeId, nextToken).catch(() => null)
            if (detailedEmployee) {
              resolvedEmployee = mergeEmployeeRecords(resolvedEmployee, detailedEmployee)
            }
          }
        }
      }

      if (!hasEmployeeProfileData(resolvedEmployee)) {
        const employeeUrl = readString(mergedCurrentUser, ["my_employee_url"], "")
        if (employeeUrl) {
          const fromUrl = await fetchEmployeeFromUrl(nextToken, employeeUrl).catch(() => null)
          if (fromUrl) {
            resolvedEmployee = fromUrl
          }
        }
      }

      if (isMissingCoreEmployeeFields(resolvedEmployee)) {
        const likelyEmployeeId = resolveEmployeeId(
          resolvedEmployee,
          { employee_id: readNestedEmployeeId(mergedCurrentUser) },
        )
        if (likelyEmployeeId !== null) {
          const detailedEmployee = await getEmployeeById(likelyEmployeeId, nextToken).catch(() => null)
          if (detailedEmployee) {
            resolvedEmployee = mergeEmployeeRecords(resolvedEmployee, detailedEmployee)
          }
        }
      }

      // Re-assert /employees/me as authoritative when present.
      if (!employeeBelongsToCurrentUser(resolvedEmployee, mergedCurrentUser, currentAdmin)) {
        resolvedEmployee = null
      }
      resolvedEmployee = mergeEmployeeRecords(employeeFromMe, resolvedEmployee)

      resolvedEmployee = enrichEmployeeFromAssignments(resolvedEmployee)

      if (resolvedEmployee) {
        const needsBranchName =
          !readString(asRecord(resolvedEmployee.branch), ["name", "branch_name"], "") &&
          !readString(asRecord(resolvedEmployee.primary_branch), ["name", "branch_name"], "") &&
          !readString(resolvedEmployee, ["branch_name", "branch"], "") &&
          readNumber(resolvedEmployee, ["primary_branch_id", "branch_id", "branchId"]) !== null
        const needsDepartmentName =
          !readString(asRecord(resolvedEmployee.department), ["name", "department_name"], "") &&
          !readString(asRecord(resolvedEmployee.primary_department), ["name", "department_name"], "") &&
          !readString(resolvedEmployee, ["department_name", "department"], "") &&
          readNumber(resolvedEmployee, ["primary_department_id", "department_id", "departmentId"]) !== null

        if (needsBranchName || needsDepartmentName) {
          const [branchesResult, departmentsResult] = await Promise.all([
            listBranches(nextToken).catch(() => [] as AdminRecord[]),
            listDepartments(nextToken).catch(() => [] as AdminRecord[]),
          ])
          const branches = Array.isArray(branchesResult) ? branchesResult : branchesResult.rows
          const departments = Array.isArray(departmentsResult) ? departmentsResult : departmentsResult.rows
          resolvedEmployee = enrichEmployeeWithOrgNames(resolvedEmployee, { branches, departments })
        }
      }

      setEmployee(resolvedEmployee)
      if (!resolvedEmployee && !currentAdmin) {
        setError("Could not find your employee profile in the current company.")
      }
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load your profile."
      setError(message)
      setCurrentUser(null)
      setEmployee(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    loading,
    error,
    token,
    currentUser,
    employee,
    refresh,
  }
}

// Doodles / decorative backgrounds (from reference, for visual interest on stat and info cards)
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

function Doodle({
  name = "doodle-circles",
  className,
}: {
  name?: string
  className?: string
}) {
  const doodleType = name.replace("doodle-", "")
  return (
    <svg
      className={cn(
        "pointer-events-none doodle",
        `doodle-${doodleType}`,
        "absolute inset-0 h-full w-full",
        className
      )}
      aria-hidden="true"
    >
      <use href={`#${name}`} />
    </svg>
  )
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}



function resolveDisplayName(currentUser: AdminRecord | null, employee: AdminRecord | null) {
  const fromUser = [readString(currentUser, ["first_name"], ""), readString(currentUser, ["last_name"], "")]
    .filter(Boolean)
    .join(" ")
  const fromEmployee = [readString(employee, ["first_name"], ""), readString(employee, ["last_name"], "")]
    .filter(Boolean)
    .join(" ")
  return fromUser || fromEmployee || "You"
}

function resolveEmployeeNumber(currentUser: AdminRecord | null, employee: AdminRecord | null) {
  return (
    readString(currentUser, ["user_no", "employee_no", "employeeNo"], "") ||
    readString(employee, ["employee_no", "employee_number", "employee_code", "user_no"], "") ||
    readNestedEmployeeNumber(currentUser) ||
    "-"
  )
}

function resolveProfilePhotoUrl(
  currentUser: AdminRecord | null,
  employee: AdminRecord | null,
  preferredUrl?: string | null
) {
  const preferred = typeof preferredUrl === "string" ? preferredUrl.trim() : ""
  if (preferred) {
    return resolveBackendMediaUrl(preferred) || preferred
  }
  const candidate =
    readString(employee, ["profile_photo_url"], "") ||
    readString(asRecord(employee?.company_user), ["profile_photo_url"], "") ||
    readString(asRecord(asRecord(employee?.company_user)?.user), ["profile_photo_url"], "") ||
    readString(currentUser, ["profile_photo_url"], "")
  return resolveBackendMediaUrl(candidate) || candidate
}

function resolveManagerDisplay(employee: AdminRecord | null) {
  const manager = asRecord(employee?.manager)
  const managerCompanyUser = asRecord(manager?.company_user)
  const managerUser = asRecord(managerCompanyUser?.user)
  return {
    name:
      [readString(manager, ["first_name"], ""), readString(manager, ["last_name"], "")]
        .filter(Boolean)
        .join(" ") ||
      [readString(managerUser, ["first_name"], ""), readString(managerUser, ["last_name"], "")]
        .filter(Boolean)
        .join(" ") ||
      readString(manager, ["name"], "-"),
    employeeNo: readString(manager, ["employee_no"], "") || readString(managerUser, ["user_no"], "-"),
  }
}

type EditableUserField =
  | "first_name"
  | "last_name"
  | "phone"
  | "email"
  | "city"
  | "password"
  | "user_no"
  | "status"
  | "profile_photo_url"
  | "personal_phone_number"
  | "personal_email"
  | "address_line_1"
  | "address_line_2"
  | "state"
  | "country"
  | "postal_code"
  | "emergency_contact_name"
  | "emergency_contact_relationship"
  | "emergency_contact_phone"
  | "emergency_contact_email"
  | "emergency_contact_address"
  | "emergency_contact_occupation"

type SectionEditorState = {
  key: string
  title: string
  fields: EditableUserField[]
  requestType?: "CONTACT_INFORMATION" | "ADDRESS_INFORMATION" | "EMERGENCY_CONTACT"
}

function getEditableFieldLabel(field: EditableUserField) {
  if (field === "profile_photo_url") {
    return "Profile picture"
  }
  const labels: Partial<Record<EditableUserField, string>> = {
    personal_phone_number: "Phone number",
    personal_email: "Email address",
    address_line_1: "Address",
    address_line_2: "Address line 2",
    state: "State / region",
    emergency_contact_name: "Full name",
    emergency_contact_relationship: "Relationship",
    emergency_contact_phone: "Phone number",
    emergency_contact_email: "Email address",
    emergency_contact_address: "Address",
    emergency_contact_occupation: "Occupation",
  }
  if (labels[field]) return labels[field]
  return field.replaceAll("_", " ")
}

function isRequiredPersonalRecordField(field: EditableUserField) {
  return [
    "address_line_1",
    "city",
    "emergency_contact_name",
    "emergency_contact_relationship",
    "emergency_contact_phone",
  ].includes(field)
}

type ApiErrorWithPayload = Error & {
  status?: number
  payload?: unknown
}

function formatApiErrorLines(errorObject: unknown, fallback: string) {
  if (!errorObject || typeof errorObject !== "object") {
    return [fallback]
  }
  const payload = (errorObject as ApiErrorWithPayload).payload
  if (payload !== undefined) {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.message)) {
      const lines = record.message
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
      if (lines.length) {
        return lines
      }
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return [record.message.trim()]
    }
  }
  if (errorObject instanceof Error && errorObject.message) {
    return [errorObject.message]
  }
  return [fallback]
}

function readProfileUpdateRequestId(row: AdminRecord | null | undefined) {
  if (!row) {
    return null
  }
  return readNumber(row, ["id", "request_id", "profile_update_request_id", "profileUpdateRequestId"])
}

type DoodleVariant = "doodle-circles" | "doodle-curves" | "doodle-grass"

function AssignmentField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2 sm:flex-col sm:items-stretch sm:justify-start sm:gap-0.5 sm:px-0 sm:py-0">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-medium text-foreground break-words sm:text-left">
        {value}
      </span>
    </div>
  )
}

function AssignmentBadge({
  children,
  tone = "primary",
}: {
  children: React.ReactNode
  tone?: "primary" | "success" | "muted" | "amber" | "violet"
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-500/12 text-amber-800 dark:text-amber-300"
        : tone === "violet"
          ? "bg-violet-500/12 text-violet-700 dark:text-violet-300"
          : tone === "muted"
            ? "bg-muted text-muted-foreground"
            : "bg-primary/10 text-primary"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        toneClass
      )}
    >
      {children}
    </span>
  )
}

function EmptyAssignmentState({ message }: { message: string }) {
  return (
    <div className="px-3 py-4 text-sm text-muted-foreground">{message}</div>
  )
}

const assignmentsStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const assignmentsItem = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 },
  },
}

function SelfServiceSectionCard({
  title,
  children,
  count,
  subtitle,
  action,
  barClassName = "bg-primary",
}: {
  title: string
  children: React.ReactNode
  count?: number
  subtitle?: string
  action?: React.ReactNode
  /** @deprecated kept for call-site compatibility */
  doodle?: DoodleVariant
  barClassName?: string
}) {
  return (
    <section className="min-w-0 max-w-full border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
      <div className="flex min-w-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className={cn("size-1.5 shrink-0 rounded-full", barClassName)} aria-hidden="true" />
              {title}
            </h3>
            {subtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {typeof count === "number" ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                {count}
              </span>
            ) : null}
            {action}
          </div>
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function ProfileDataField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  )
}

function ProfileDataItem({
  title,
  badge,
  fields,
  barClassName = "bg-primary",
  persona,
}: {
  title?: string
  badge?: React.ReactNode
  fields: Array<{ label: string; value: React.ReactNode }>
  barClassName?: string
  persona?: { name: string; secondaryText?: string }
}) {
  return (
    <div className="min-w-0 border-b border-border/40 py-3 last:border-b-0">
      <div className="min-w-0 px-3">
        {title || badge || persona ? (
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            {persona ? (
              <Persona
                name={persona.name}
                secondaryText={persona.secondaryText}
                avatar={{ initials: persona.name.slice(0, 2).toUpperCase(), color: "colorful" }}
                size="small"
                className="[&_.fui-Persona__primaryText]:font-medium [&_.fui-Persona__secondaryText]:text-muted-foreground"
              />
            ) : title ? <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className={cn("size-1.5 rounded-full", barClassName)} aria-hidden="true" />{title}</p> : <span />}
            {badge}
          </div>
        ) : null}
        <div className="grid gap-2.5 sm:grid-cols-2">{fields.map((field) => (
          <ProfileDataField key={field.label} label={field.label} value={field.value} />
        ))}</div>
      </div>
    </div>
  )
}

function ProfileEmptyRow({
  message,
  actionLabel,
  icon,
  onAction,
}: {
  message: string
  actionLabel?: string
  icon?: React.ReactElement
  onAction?: () => void
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-3 py-6 text-center">
      {icon ? (
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction ? (
        <FluentButton appearance="primary" size="small" icon={icon} onClick={onAction}>
          {actionLabel}
        </FluentButton>
      ) : null}
    </div>
  )
}

function requestStatusTone(status: string) {
  const key = status.toLowerCase()
  if (key.includes("approv") || key.includes("complete") || key === "done") {
    return {
      bar: "bg-emerald-500",
      badge: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    }
  }
  if (key.includes("reject") || key.includes("cancel") || key.includes("denied")) {
    return {
      bar: "bg-rose-500",
      badge: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
    }
  }
  if (key.includes("pend") || key.includes("submit") || key.includes("review") || key.includes("progress")) {
    return {
      bar: "bg-amber-500",
      badge: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
    }
  }
  if (key.includes("draft")) {
    return {
      bar: "bg-slate-400",
      badge: "bg-muted text-muted-foreground",
    }
  }
  return {
    bar: "bg-primary",
    badge: "bg-primary/10 text-primary",
  }
}

function ProfileRequestRow({
  title,
  status,
  dateLabel,
  detail,
}: {
  title: string
  status: string
  dateLabel: string
  detail?: string
}) {
  const tone = requestStatusTone(status)
  return (
    <div className="flex min-w-0 bg-background">
      <div className={cn("w-1 shrink-0", tone.bar)} />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 px-3 py-2.5 sm:gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
          {detail ? <p className="line-clamp-2 break-words text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <span
          className={cn(
            "inline-flex max-w-[40%] shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            tone.badge
          )}
        >
          {status}
        </span>
      </div>
    </div>
  )
}

const profileTabStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const profileTabItem = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.7 },
  },
}

const SELF_SERVICE_SECTION_TAB_LABELS: Record<string, string> = {
  contacts: "Contacts",
  documents: "Documents",
  addresses: "Addresses",
  relatives: "Relatives",
  identifications: "IDs",
  bank_accounts: "Banks",
  departments: "Depts",
  academic_qualifications: "Academic",
  professional_qualifications: "Professional",
  experience_details: "Experience",
  company_user: "User",
}

const TANZANIA_LICENSED_BANKS = [
  "Absa Bank Tanzania Limited",
  "Access Bank Tanzania Limited",
  "Akiba Commercial Bank Plc",
  "Amana Bank Limited",
  "Azania Bank Limited",
  "Bank of Africa Tanzania Limited",
  "Bank of Baroda Tanzania Limited",
  "Bank of India Tanzania Limited",
  "China Dasheng Bank Limited",
  "Citibank Tanzania Limited",
  "Cooperative Bank of Tanzania Limited",
  "CRDB Bank Plc",
  "DCB Commercial Bank Plc",
  "Diamond Trust Bank Tanzania Plc",
  "Ecobank Tanzania Limited",
  "Equity Bank Tanzania Limited",
  "Exim Bank Tanzania Limited",
  "Guaranty Trust Bank Tanzania Limited",
  "Habib African Bank Limited",
  "I&M Bank Tanzania Limited",
  "International Commercial Bank Tanzania Limited",
  "KCB Bank Tanzania Limited",
  "Letshego Faidika Bank Tanzania Limited",
  "Mkombozi Commercial Bank Plc",
  "Mwalimu Commercial Bank Plc",
  "Mwanga Hakika Bank Limited",
  "National Bank of Commerce Limited",
  "NMB Bank Plc",
  "NCBA Bank Tanzania Limited",
  "People's Bank of Zanzibar Limited",
  "Stanbic Bank Tanzania Limited",
  "Standard Chartered Bank Tanzania Limited",
  "Tanzania Commercial Bank Plc",
  "United Bank for Africa Tanzania Limited",
] as const

const TANZANIA_BANK_LOGO_DOMAINS: Record<(typeof TANZANIA_LICENSED_BANKS)[number], string> = {
  "Absa Bank Tanzania Limited": "absa.co.tz",
  "Access Bank Tanzania Limited": "accessbank.co.tz",
  "Akiba Commercial Bank Plc": "acbtz.co.tz",
  "Amana Bank Limited": "amanabank.co.tz",
  "Azania Bank Limited": "azaniabank.co.tz",
  "Bank of Africa Tanzania Limited": "boatanzania.co.tz",
  "Bank of Baroda Tanzania Limited": "bankofbaroda.co.tz",
  "Bank of India Tanzania Limited": "bankofindia.co.tz",
  "China Dasheng Bank Limited": "chinadashengbank.co.tz",
  "Citibank Tanzania Limited": "citi.com",
  "Cooperative Bank of Tanzania Limited": "coopbank.co.tz",
  "CRDB Bank Plc": "crdbbank.co.tz",
  "DCB Commercial Bank Plc": "dcb.co.tz",
  "Diamond Trust Bank Tanzania Plc": "diamondtrust.co.tz",
  "Ecobank Tanzania Limited": "ecobank.com",
  "Equity Bank Tanzania Limited": "equitybank.co.tz",
  "Exim Bank Tanzania Limited": "eximbank.co.tz",
  "Guaranty Trust Bank Tanzania Limited": "gtbank.co.tz",
  "Habib African Bank Limited": "habibafricanbank.co.tz",
  "I&M Bank Tanzania Limited": "imbank.co.tz",
  "International Commercial Bank Tanzania Limited": "icbank.co.tz",
  "KCB Bank Tanzania Limited": "kcbgroup.com",
  "Letshego Faidika Bank Tanzania Limited": "letshego.co.tz",
  "Mkombozi Commercial Bank Plc": "mkombozibank.co.tz",
  "Mwalimu Commercial Bank Plc": "mwalimubank.co.tz",
  "Mwanga Hakika Bank Limited": "mwangahakikabank.co.tz",
  "National Bank of Commerce Limited": "nbc.co.tz",
  "NMB Bank Plc": "nmbbank.co.tz",
  "NCBA Bank Tanzania Limited": "ncbagroup.co.tz",
  "People's Bank of Zanzibar Limited": "pbzbank.co.tz",
  "Stanbic Bank Tanzania Limited": "stanbicbank.co.tz",
  "Standard Chartered Bank Tanzania Limited": "sc.com",
  "Tanzania Commercial Bank Plc": "tcbbank.co.tz",
  "United Bank for Africa Tanzania Limited": "ubagroup.com",
}

function getTanzaniaBankLogoUrl(bank: (typeof TANZANIA_LICENSED_BANKS)[number]) {
  return `https://${TANZANIA_BANK_LOGO_DOMAINS[bank]}/favicon.ico`
}

function TanzaniaBankLogo({
  bank,
  className,
}: {
  bank: (typeof TANZANIA_LICENSED_BANKS)[number]
  className?: string
}) {
  const initials = bank
    .split(/\s+/)
    .filter((word) => !["bank", "tanzania", "limited", "plc"].includes(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "B"

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-primary/10 text-[8px] font-bold text-primary",
        className,
      )}
    >
      {initials}
      {/* Institution favicons are decorative, externally hosted, and intentionally not image-optimized. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getTanzaniaBankLogoUrl(bank)}
        alt=""
        className="absolute inset-0 size-full bg-white object-contain"
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
    </span>
  )
}

function SelfServiceProfileSectionTabs({
  sections,
  initialSectionId,
}: {
  sections: Array<{
    id: string
    title: string
    count: number
    content: React.ReactNode
  }>
  initialSectionId?: string
}) {
  const [activeId, setActiveId] = React.useState(
    sections.some((section) => section.id === initialSectionId)
      ? initialSectionId ?? ""
      : sections[0]?.id ?? ""
  )
  const active = sections.find((section) => section.id === activeId) ?? sections[0]

  React.useEffect(() => {
    if (initialSectionId && sections.some((section) => section.id === initialSectionId)) {
      setActiveId(initialSectionId)
      return
    }
    if (!sections.some((section) => section.id === activeId) && sections[0]) {
      setActiveId(sections[0].id)
    }
  }, [activeId, initialSectionId, sections])

  if (!active) return null

  return (
    <div className="space-y-3">
      <div className="tab-rail-scroll" role="tablist" aria-label="Personal profile sections">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {sections.map((section) => {
            const isActive = section.id === active.id
            const tabLabel = SELF_SERVICE_SECTION_TAB_LABELS[section.id] ?? section.title
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                title={`${section.title} (${section.count})`}
                aria-label={`${section.title}, ${section.count} items`}
                aria-selected={isActive}
                onClick={() => setActiveId(section.id)}
                className={cn(
                  "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                  isActive
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                )}
              >
                {tabLabel}
                <span
                  className={cn(
                    "ml-1 tabular-nums opacity-70",
                    section.count === 0 && !isActive
                      ? "text-rose-600 opacity-100 dark:text-rose-400"
                      : null
                  )}
                >
                  {section.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <motion.div
        key={active.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {active.content}
      </motion.div>
    </div>
  )
}

function AssignmentSection({
  title,
  subtitle,
  icon: Icon,
  count,
  children,
  barClassName = "bg-primary",
}: {
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  count?: number
  children: React.ReactNode
  barClassName?: string
}) {
  return (
    <section className="min-w-0 border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
      <div className="flex">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? <Icon className="size-5 shrink-0" /> : <span className={cn("size-1.5 shrink-0 rounded-full", barClassName)} />}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {subtitle ? (
                <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {typeof count === "number" ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
              {count}
            </span>
          ) : null}
        </div>
      </div>
      <div>{children}</div>
    </section>
  )
}

function AssignmentItemCard({
  title,
  badge,
  barClassName = "bg-primary",
  children,
}: {
  title: string
  badge?: React.ReactNode
  barClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 border-b border-border/40 py-3 last:border-b-0">
      <div className="min-w-0 px-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><span className={cn("size-1.5 rounded-full", barClassName)} aria-hidden="true" />{title}</p>
          {badge}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </div>
  )
}

type ProfileAssignmentsTabProps = {
  employee: AdminRecord
  assignmentSummaryRows: Array<{ label: string; value: string }>
  scheduleDays: AdminRecord[]
}

function ProfileAssignmentsTab({ employee, assignmentSummaryRows, scheduleDays }: ProfileAssignmentsTabProps) {
  const departments = Array.isArray(employee.departments) ? employee.departments : []
  const positionAssignments = Array.isArray(employee.position_assignments)
    ? employee.position_assignments
    : []
  const previewDays = scheduleDays.slice(0, 7)
  const offDaysCount = previewDays.filter(
    (day) => day.is_off_day === true || day.is_off_day === "true"
  ).length

  const snapshotChips = [
    { key: "dept", label: "Departments", value: String(departments.length) },
    { key: "pos", label: "Positions", value: String(positionAssignments.length) },
    { key: "sched", label: "Schedule days", value: String(previewDays.length) },
    {
      key: "off",
      label: "Off days",
      value: String(offDaysCount),
      highlight: offDaysCount > 0,
    },
  ]

  return (
    <FluentCard appearance="outline" size="small" className={cn(pageBleedClass, "!flex-col !items-stretch !gap-5 !rounded-none !border-x-0 !border-border/70 !bg-card !p-4 shadow-sm sm:!border-x sm:!p-5")}>
    <motion.div
      className="space-y-4"
      variants={assignmentsStagger}
      initial="hidden"
      animate="show"
    >
      {/* Snapshot chips */}
      <motion.div
        variants={assignmentsItem}
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto border-b border-border/60"
      >
        {snapshotChips.map((chip, index, arr) => (
          <div
            key={chip.key}
            className={cn(
              "flex min-w-[5.5rem] shrink-0 flex-col justify-center px-3 py-2",
              chip.highlight ? "bg-violet-500/10" : "bg-background",
              index < arr.length - 1 ? "border-r border-border/60" : null
            )}
          >
            <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {chip.label}
            </span>
            <span
              className={cn(
                "text-base font-semibold tabular-nums leading-tight",
                chip.highlight
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-primary"
              )}
            >
              {chip.value}
            </span>
          </div>
        ))}
      </motion.div>

      <div className="grid gap-3 lg:grid-cols-2">
        <motion.div variants={assignmentsItem}>
          <AssignmentSection
            title="Department"
            subtitle="Your org placement"
            icon={Building20Color}
            count={departments.length}
          >
            {departments.length ? (
              departments.map((entry, index) => {
                const record = asRecord(entry)
                const department = asRecord(record?.department)
                const branch = asRecord(department?.branch)
                const departmentName = readString(
                  department,
                  ["name", "department_name"],
                  "Department"
                )
                const isPrimary = formatUnknownValue(record?.is_primary) === "Yes"
                return (
                  <AssignmentItemCard
                    key={`department-${index}`}
                    title={departmentName}
                    barClassName={isPrimary ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}
                    badge={isPrimary ? <AssignmentBadge tone="success">Primary</AssignmentBadge> : null}
                  >
                    <AssignmentField label="Code" value={readString(department, ["code"], "—")} />
                    <AssignmentField
                      label="Branch"
                      value={readString(branch, ["name", "branch_name"], "—")}
                    />
                    <AssignmentField
                      label="Status"
                      value={readString(department, ["status"], "—")}
                    />
                  </AssignmentItemCard>
                )
              })
            ) : (
              <EmptyAssignmentState message="No department assigned." />
            )}
          </AssignmentSection>
        </motion.div>

        <motion.div variants={assignmentsItem}>
          <AssignmentSection
            title="Position"
            subtitle="Role assignment"
            icon={Briefcase20Color}
            count={positionAssignments.length}
          >
            {positionAssignments.length ? (
              positionAssignments.map((entry, index) => {
                const record = asRecord(entry)
                const position = asRecord(record?.position)
                const positionName = readString(position, ["name", "position_name"], "Position")
                const status = readString(record, ["status"], "active")
                const isActive = status.toLowerCase() === "active"
                return (
                  <AssignmentItemCard
                    key={`position-assignment-${index}`}
                    title={positionName}
                    barClassName={isActive ? "bg-emerald-500" : "bg-primary"}
                    badge={
                      <AssignmentBadge tone={isActive ? "success" : "muted"}>
                        {status}
                      </AssignmentBadge>
                    }
                  >
                    <AssignmentField
                      label="Type"
                      value={readString(record, ["assignment_type"], "—")}
                    />
                    <AssignmentField
                      label="Primary"
                      value={formatUnknownValue(record?.is_primary)}
                    />
                    <AssignmentField label="Start" value={formatDate(record?.start_date)} />
                    <AssignmentField label="End" value={formatDate(record?.end_date)} />
                    <AssignmentField label="Notes" value={readString(record, ["notes"], "—")} />
                  </AssignmentItemCard>
                )
              })
            ) : (
              <EmptyAssignmentState message="No position assigned." />
            )}
          </AssignmentSection>
        </motion.div>
      </div>

      <motion.div variants={assignmentsItem}>
        <AssignmentSection
          title="Attendance assignment"
          subtitle="Shifts, timetables, and overrides"
          icon={CalendarClock20Color}
          count={assignmentSummaryRows.length}
        >
          {assignmentSummaryRows.length ? (
            <div className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto">
              {assignmentSummaryRows.map((row, index, arr) => (
                <div
                  key={row.label}
                  className={cn(
                    "flex min-w-[7rem] shrink-0 flex-col justify-center px-3 py-2.5",
                    index < arr.length - 1 ? "border-r border-border/60" : null
                  )}
                >
                  <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="mt-0.5 truncate text-base font-semibold tabular-nums text-primary">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAssignmentState message="No attendance assignment summary is available yet." />
          )}
        </AssignmentSection>
      </motion.div>

      <motion.div variants={assignmentsItem}>
        <AssignmentSection
          title="Upcoming schedule"
          subtitle="Next published work days"
          icon={CalendarSync20Color}
          count={previewDays.length}
          barClassName="bg-sky-500"
        >
          {previewDays.length ? (
            <div className="divide-y divide-border/70">
              {previewDays.map((day, index) => {
                const shift = asRecord(day.shift)
                const timetable = asRecord(day.timetable)
                const isOffDay = day.is_off_day === true || day.is_off_day === "true"
                const shiftName = isOffDay
                  ? "Off Day"
                  : readString(shift, ["name", "code"], "—")
                const startTime =
                  !shift || isOffDay ? "—" : formatTimeValue(shift.start_time)
                const endTime =
                  !shift || isOffDay ? "—" : formatTimeValue(shift.end_time)
                const expectedWork = isOffDay
                  ? "—"
                  : formatMinutesDuration(shift?.expected_work_minutes)
                const source = readString(day, ["source"], "—")
                const timetableName = readString(timetable, ["name", "code"], "—")

                return (
                  <motion.div
                    key={String(day.date ?? index)}
                    className="flex bg-background"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 + index * 0.05, duration: 0.28 }}
                  >
                    <div
                      className={cn(
                        "w-1 shrink-0",
                        isOffDay ? "bg-violet-500" : "bg-primary"
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
                      <div className="w-[7.5rem] shrink-0">
                        <div className="text-xs font-semibold text-foreground">
                          {formatDate(day.date)}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-[11px] font-semibold",
                            isOffDay
                              ? "text-violet-700 dark:text-violet-300"
                              : "text-muted-foreground"
                          )}
                        >
                          {shiftName}
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
                              startTime === "—"
                                ? "text-muted-foreground/45"
                                : "text-primary"
                            )}
                          >
                            {startTime}
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
                              endTime === "—"
                                ? "text-muted-foreground/45"
                                : "text-primary"
                            )}
                          >
                            {endTime}
                          </div>
                        </div>
                        <div className="hidden min-w-[5.5rem] shrink-0 text-right sm:block">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Work
                          </div>
                          <div className="text-sm font-semibold tabular-nums text-foreground">
                            {expectedWork}
                          </div>
                        </div>
                        <div className="hidden min-w-[6rem] shrink-0 text-right md:block">
                          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Timetable
                          </div>
                          <div className="truncate text-sm font-medium text-foreground">
                            {timetableName}
                          </div>
                        </div>
                      </div>
                      {isOffDay ? (
                        <AssignmentBadge tone="violet">Off</AssignmentBadge>
                      ) : source !== "—" ? (
                        <span className="hidden text-[11px] text-muted-foreground lg:inline">
                          {source}
                        </span>
                      ) : null}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <EmptyAssignmentState message="No schedule preview has been published yet." />
          )}
        </AssignmentSection>
      </motion.div>
    </motion.div>
    </FluentCard>
  )
}

function asRecordList(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => asRecord(entry)).filter((entry): entry is AdminRecord => entry !== null)
}

function ProfilePersonalTab({
  employee,
  onRequestAdd,
}: {
  employee: AdminRecord
  onRequestAdd: (kind: "contact" | "address" | "relative") => void
}) {
  const contacts = asRecordList(employee.contacts)
  const addresses = asRecordList(employee.addresses)
  const relatives = asRecordList(employee.relatives)

  return (
    <FluentCard appearance="outline" size="small" className={cn(pageBleedClass, "!flex-col !items-stretch !gap-5 !rounded-none !border-x-0 !border-border/70 !bg-card !p-4 shadow-sm sm:!border-x sm:!p-5")}>
    <motion.div className="space-y-4" variants={profileTabStagger} initial="hidden" animate="show">
      <motion.div
        variants={profileTabItem}
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto border-b border-border/60"
      >
        {[
          { label: "Contacts", value: contacts.length },
          { label: "Addresses", value: addresses.length },
          { label: "Relatives", value: relatives.length },
        ].map((chip, index, arr) => (
          <div
            key={chip.label}
            className={cn(
              "flex min-w-[5.5rem] shrink-0 flex-col justify-center bg-background px-3 py-2",
              index < arr.length - 1 ? "border-r border-border/60" : null
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {chip.label}
            </span>
            <span className="text-base font-semibold tabular-nums text-primary">{chip.value}</span>
          </div>
        ))}
      </motion.div>

      <motion.div variants={profileTabItem}>
        <SelfServiceProfileSectionTabs
          sections={[
            {
              id: "contacts",
              title: "Contacts",
              count: contacts.length,
              content: (
                <SelfServiceSectionCard title="Contacts" count={contacts.length} subtitle="Phone and email">
                  {contacts.length ? (
                    contacts.map((record, index) => {
                      const isPrimary = formatUnknownValue(record.is_primary) === "Yes"
                      return (
                        <ProfileDataItem
                          key={`contact-${index}`}
                          persona={{
                            name: readString(record, ["contact_type"], "Contact"),
                            secondaryText: readString(record, ["email", "phone_number", "phone"], ""),
                          }}
                          barClassName={isPrimary ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}
                          badge={
                            isPrimary ? (
                              <AssignmentBadge tone="success">Primary</AssignmentBadge>
                            ) : null
                          }
                          fields={[
                            {
                              label: "Phone",
                              value: readString(record, ["phone_number", "phone"], "—"),
                            },
                            { label: "Email", value: readString(record, ["email"], "—") },
                            {
                              label: "Verified",
                              value: formatUnknownValue(record.is_verified),
                            },
                            { label: "Notes", value: readString(record, ["notes"], "—") },
                          ]}
                        />
                      )
                    })
                  ) : (
                    <ProfileEmptyRow
                      message="No contacts available yet. Send the details to HR for approval."
                      actionLabel="Add contact"
                      icon={<ContactCard20Regular />}
                      onAction={() => onRequestAdd("contact")}
                    />
                  )}
                </SelfServiceSectionCard>
              ),
            },
            {
              id: "addresses",
              title: "Addresses",
              count: addresses.length,
              content: (
                <SelfServiceSectionCard title="Addresses" count={addresses.length} subtitle="Home and work">
                  {addresses.length ? (
                    addresses.map((record, index) => (
                      <ProfileDataItem
                        key={`address-${index}`}
                        title={readString(record, ["address_type", "type"], "Address")}
                        fields={[
                          {
                            label: "Address",
                            value: readString(record, ["address_line", "address"], "—"),
                          },
                          { label: "City", value: readString(record, ["city"], "—") },
                          { label: "Country", value: readString(record, ["country"], "—") },
                          {
                            label: "State / region",
                            value: readString(record, ["state", "region", "province"], "—"),
                          },
                        ]}
                      />
                    ))
                  ) : (
                    <ProfileEmptyRow
                      message="No addresses available yet. Send an address to HR for approval."
                      actionLabel="Add address"
                      icon={<LocationAdd20Regular />}
                      onAction={() => onRequestAdd("address")}
                    />
                  )}
                </SelfServiceSectionCard>
              ),
            },
            {
              id: "relatives",
              title: "Relatives",
              count: relatives.length,
              content: (
                <SelfServiceSectionCard
                  title="Relatives"
                  count={relatives.length}
                  subtitle="Emergency contacts"
                >
                  {relatives.length ? (
                    relatives.map((record, index) => (
                      <ProfileDataItem
                        key={`relative-${index}`}
                        title={readString(record, ["name", "full_name"], "Relative")}
                        fields={[
                          {
                            label: "Relationship",
                            value: readString(record, ["relationship"], "—"),
                          },
                          {
                            label: "Phone",
                            value: readString(record, ["phone_number", "phone"], "—"),
                          },
                          { label: "Email", value: readString(record, ["email"], "—") },
                        ]}
                      />
                    ))
                  ) : (
                    <ProfileEmptyRow
                      message="No relatives available yet. Send an emergency contact to HR for approval."
                      actionLabel="Add relative"
                      icon={<PeopleAdd20Regular />}
                      onAction={() => onRequestAdd("relative")}
                    />
                  )}
                </SelfServiceSectionCard>
              ),
            },
          ]}
        />
      </motion.div>
    </motion.div>
    </FluentCard>
  )
}

function ProfileRecordsTab({
  employee,
  correctionRequests,
  teamAttendance,
  initialSectionId,
  token,
  onRefresh,
}: {
  employee: AdminRecord | null
  correctionRequests: AdminRecord[]
  teamAttendance: AdminRecord[]
  initialSectionId?: string
  token: string
  onRefresh: () => Promise<void>
}) {
  const identifications = asRecordList(employee?.identifications)
  const bankAccounts = asRecordList(employee?.bank_accounts)
  const academic = asRecordList(employee?.academic_qualifications)
  const professional = asRecordList(employee?.professional_qualifications)
  const experience = asRecordList(employee?.experience_details)
  const documents = asRecordList(employee?.documents)
  const [bankDialogOpen, setBankDialogOpen] = React.useState(false)
  const [manualBankName, setManualBankName] = React.useState(false)
  const [companyBanks, setCompanyBanks] = React.useState<AdminRecord[]>([])
  const [bankSaving, setBankSaving] = React.useState(false)
  const [bankError, setBankError] = React.useState("")
  const [bankDraft, setBankDraft] = React.useState({
    bank_name: "",
    account_name: "",
    account_number: "",
    branch_name: "",
    account_currency: "TZS",
    is_primary: false,
  })

  React.useEffect(() => {
    if (!token) return
    void listCompanyBanks(token).then(setCompanyBanks).catch(() => setCompanyBanks([]))
  }, [token])

  const bankChoices = React.useMemo(() => {
    const choices = TANZANIA_LICENSED_BANKS.map((name) => ({ name, logo_url: "" }))
    for (const record of companyBanks) {
      const name = readString(record, ["name"], "").trim()
      if (!name || choices.some((choice) => choice.name.toLowerCase() === name.toLowerCase())) continue
      choices.push({ name: name as (typeof TANZANIA_LICENSED_BANKS)[number], logo_url: readString(record, ["logo_url"], "") })
    }
    return choices
  }, [companyBanks])
  const selectedBankChoice = bankChoices.find((choice) => choice.name === bankDraft.bank_name)

  async function saveBankAccount() {
    if (!bankDraft.bank_name.trim() || !bankDraft.account_number.trim()) {
      setBankError("Bank name and account number are required.")
      return
    }
    if (!token) {
      setBankError("Your session has expired. Please sign in again.")
      return
    }
    setBankSaving(true)
    setBankError("")
    try {
      await createMyEmployeeSectionItem(token, "bank-accounts", {
        bank_name: bankDraft.bank_name.trim(),
        account_name: bankDraft.account_name.trim() || undefined,
        account_number: bankDraft.account_number.trim(),
        branch_name: bankDraft.branch_name.trim() || undefined,
        account_currency: bankDraft.account_currency.trim().toUpperCase() || "TZS",
        is_primary: bankDraft.is_primary,
      })
      await onRefresh()
      setBankDialogOpen(false)
      setManualBankName(false)
      setBankDraft({
        bank_name: "",
        account_name: "",
        account_number: "",
        branch_name: "",
        account_currency: "TZS",
        is_primary: false,
      })
    } catch (errorObject) {
      setBankError(errorObject instanceof Error ? errorObject.message : "Could not add the bank account.")
    } finally {
      setBankSaving(false)
    }
  }

  const pendingCorrections = correctionRequests.filter((row) => {
    const status = readString(row, ["status"], "").toLowerCase()
    return status && !status.includes("cancel") && !status.includes("reject") && status !== "approved"
  }).length

  return (
    <FluentCard appearance="outline" size="small" className={cn(pageBleedClass, "!flex-col !items-stretch !gap-5 !rounded-none !border-x-0 !border-border/70 !bg-card !p-4 shadow-sm sm:!border-x sm:!p-5")}>
    <motion.div className="flex flex-col gap-4" variants={profileTabStagger} initial="hidden" animate="show">
      <motion.div
        variants={profileTabItem}
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto border-b border-border/60"
      >
        {[
          {
            label: "Corrections",
            value: String(correctionRequests.length),
            highlight: pendingCorrections > 0,
          },
          { label: "Team today", value: String(teamAttendance.length), highlight: false },
          { label: "IDs", value: String(identifications.length), highlight: false },
          { label: "Documents", value: String(documents.length), highlight: false },
        ].map((chip, index, arr) => (
          <div
            key={chip.label}
            className={cn(
              "flex min-w-[5.5rem] shrink-0 flex-col justify-center px-3 py-2",
              chip.highlight ? "bg-amber-500/10" : "bg-background",
              index < arr.length - 1 ? "border-r border-border/60" : null
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {chip.label}
            </span>
            <span
              className={cn(
                "text-base font-semibold tabular-nums",
                chip.highlight ? "text-amber-700 dark:text-amber-300" : "text-primary"
              )}
            >
              {chip.value}
            </span>
          </div>
        ))}
      </motion.div>

      <div className="divide-y divide-border/70">
        <motion.div variants={profileTabItem} className="py-4 first:pt-0">
          <SelfServiceSectionCard
            title="Attendance corrections"
            count={correctionRequests.length}
            subtitle="Your correction requests"
            barClassName="bg-amber-500"
          >
            {correctionRequests.length === 0 ? (
              <ProfileEmptyRow message="No attendance correction requests found." />
            ) : (
              <div role="list" aria-label="Attendance correction requests" className="max-h-64 divide-y divide-border/50 overflow-y-auto overscroll-contain">
              {correctionRequests.map((row, index) => {
                const titleText =
                  readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                  readString(row, ["reason", "request_type", "change_type"], "Correction request")
                const createdAt =
                  formatDateTime(row.created_at) !== "-"
                    ? formatDateTime(row.created_at)
                    : formatDate(row.date)
                return (
                  <div key={String(row.id ?? index)} role="listitem" className="py-1">
                  <ProfileRequestRow
                    title={titleText}
                    status={readString(row, ["status"], "draft")}
                    dateLabel={createdAt}
                  />
                  </div>
                )
              })
              }
              </div>
            )}
          </SelfServiceSectionCard>
        </motion.div>

      </div>

      <motion.div variants={profileTabItem} className="py-4">
        <SelfServiceSectionCard
          title="Direct reports today"
          count={teamAttendance.length}
          subtitle="Team attendance snapshot"
        >
          {teamAttendance.length === 0 ? (
            <ProfileEmptyRow message="No team attendance rows were returned for your account." />
          ) : (
            <div role="list" aria-label="Direct reports attendance" className="max-h-80 divide-y divide-border/50 overflow-y-auto overscroll-contain">
            {teamAttendance.map((row, index) => {
              const nestedEmployee = asRecord(row.employee)
              const employeeLabel =
                readString(row, ["employee_name", "full_name", "name"], "") ||
                readString(nestedEmployee, ["full_name", "name"], "") ||
                [
                  readString(nestedEmployee, ["first_name"], ""),
                  readString(nestedEmployee, ["last_name"], ""),
                ]
                  .filter(Boolean)
                  .join(" ") ||
                "Direct report"
              const status = readString(row, ["status", "attendance_status"], "—")
              const checkIn = formatUnknownValue(row.check_in_at ?? row.first_punch_at)
              return (
                <div key={String(row.id ?? index)} role="listitem">
                <ProfileDataItem
                  title={employeeLabel}
                  barClassName={
                    status.toLowerCase().includes("absent")
                      ? "bg-rose-500"
                      : status.toLowerCase().includes("late")
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }
                  badge={
                    status !== "—" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {status}
                      </span>
                    ) : null
                  }
                  fields={[
                    {
                      label: "Date",
                      value: formatDate(row.date ?? row.attendance_date),
                    },
                    { label: "Check in", value: checkIn },
                  ]}
                />
                </div>
              )
            })
            }
            </div>
          )}
        </SelfServiceSectionCard>
      </motion.div>

      {employee ? (
        <motion.div variants={profileTabItem} className="order-first">
          <SelfServiceProfileSectionTabs
            initialSectionId={initialSectionId}
            sections={[
              {
                id: "identifications",
                title: "Identifications",
                count: identifications.length,
                content: (
                  <SelfServiceSectionCard title="Identifications" count={identifications.length}>
                    {identifications.length ? (
                      identifications.map((record, index) => (
                        <ProfileDataItem
                          key={`identification-${index}`}
                          title={readString(record, ["identification_type", "type"], "ID")}
                          fields={[
                            {
                              label: "Number",
                              value: readString(record, ["number", "id_number"], "—"),
                            },
                            { label: "Issue date", value: formatDate(record.issue_date) },
                            { label: "Expiry date", value: formatDate(record.expiry_date) },
                          ]}
                        />
                      ))
                    ) : (
                      <ProfileEmptyRow message="No identifications available." />
                    )}
                  </SelfServiceSectionCard>
                ),
              },
              {
                id: "bank_accounts",
                title: "Bank Accounts",
                count: bankAccounts.length,
                content: (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <FluentButton appearance="primary" icon={<Add20Regular />} onClick={() => setBankDialogOpen(true)}>
                        Add bank account
                      </FluentButton>
                    </div>
                    <SelfServiceSectionCard title="Bank Accounts" count={bankAccounts.length}>
                    {bankAccounts.length ? (
                      bankAccounts.map((record, index) => (
                        <ProfileDataItem
                          key={`bank-${index}`}
                          title={readString(record, ["bank_name"], "Bank account")}
                          fields={[
                            {
                              label: "Account name",
                              value: readString(record, ["account_name"], "—"),
                            },
                            {
                              label: "Account number",
                              value: readString(record, ["account_number"], "—"),
                            },
                            { label: "Currency", value: readString(record, ["account_currency", "currency"], "—") },
                            { label: "Status", value: readString(record, ["verification_status"], "Pending") },
                          ]}
                        />
                      ))
                    ) : (
                      <ProfileEmptyRow message="No bank accounts available." />
                    )}
                    </SelfServiceSectionCard>
                  </div>
                ),
              },
              {
                id: "academic_qualifications",
                title: "Academic Qualifications",
                count: academic.length,
                content: (
                  <SelfServiceSectionCard title="Academic Qualifications" count={academic.length}>
                    {academic.length ? (
                      academic.map((record, index) => (
                        <ProfileDataItem
                          key={`academic-${index}`}
                          title={readString(record, ["qualification", "name"], "Qualification")}
                          fields={[
                            {
                              label: "Institution",
                              value: readString(record, ["institution"], "—"),
                            },
                            { label: "Year", value: readString(record, ["year"], "—") },
                          ]}
                        />
                      ))
                    ) : (
                      <ProfileEmptyRow message="No academic qualifications available." />
                    )}
                  </SelfServiceSectionCard>
                ),
              },
              {
                id: "professional_qualifications",
                title: "Professional Qualifications",
                count: professional.length,
                content: (
                  <SelfServiceSectionCard
                    title="Professional Qualifications"
                    count={professional.length}
                  >
                    {professional.length ? (
                      professional.map((record, index) => (
                        <ProfileDataItem
                          key={`professional-${index}`}
                          title={readString(record, ["qualification", "name"], "Qualification")}
                          fields={[
                            {
                              label: "Issuer",
                              value: readString(record, ["issuer", "institution"], "—"),
                            },
                            { label: "Year", value: readString(record, ["year"], "—") },
                          ]}
                        />
                      ))
                    ) : (
                      <ProfileEmptyRow message="No professional qualifications available." />
                    )}
                  </SelfServiceSectionCard>
                ),
              },
              {
                id: "experience_details",
                title: "Experience Details",
                count: experience.length,
                content: (
                  <SelfServiceSectionCard title="Experience Details" count={experience.length}>
                    {experience.length ? (
                      experience.map((record, index) => (
                        <ProfileDataItem
                          key={`experience-${index}`}
                          title={readString(record, ["company_name", "company"], "Experience")}
                          fields={[
                            {
                              label: "Role",
                              value: readString(record, ["role", "position"], "—"),
                            },
                            { label: "Start", value: formatDate(record.start_date) },
                            { label: "End", value: formatDate(record.end_date) },
                          ]}
                        />
                      ))
                    ) : (
                      <ProfileEmptyRow message="No experience details available." />
                    )}
                  </SelfServiceSectionCard>
                ),
              },
              {
                id: "documents",
                title: "Documents",
                count: documents.length,
                content: (
                  <SelfServiceSectionCard title="Documents" count={documents.length}>
                    {documents.length ? (
                      documents.map((record, index) => {
                        const status = readString(record, ["status"], "—")
                        return (
                          <ProfileDataItem
                            key={`document-${index}`}
                            title={readString(record, ["title", "name"], "Document")}
                            badge={
                              status !== "—" ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {status}
                                </span>
                              ) : null
                            }
                            fields={[
                              {
                                label: "Type",
                                value: readString(record, ["document_type", "type"], "—"),
                              },
                              { label: "Uploaded", value: formatDate(record.created_at) },
                            ]}
                          />
                        )
                      })
                    ) : (
                      <ProfileEmptyRow message="No documents available." />
                    )}
                  </SelfServiceSectionCard>
                ),
              },
            ]}
          />
        </motion.div>
      ) : null}
    </motion.div>
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add bank account</DialogTitle>
            <DialogDescription>Add the account used for payroll. HR must verify it before payroll can use it.</DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {[
              ["bank_name", "Bank name *"],
              ["account_name", "Account name"],
              ["account_number", "Account number *"],
              ["branch_name", "Branch name"],
              ["account_currency", "Currency"],
            ].map(([field, label]) => (
              <div key={field} className={cn("min-w-0 space-y-1", field === "account_number" && "sm:col-span-2")}>
                <Label htmlFor={`bank-${field}`}>{label}</Label>
                {field === "bank_name" ? (
                  <div className="relative min-w-0">
                    {manualBankName ? (
                      <div className="flex min-w-0 gap-2">
                        <Input
                          id="bank-bank_name"
                          autoFocus
                          placeholder="Enter bank name"
                          value={bankDraft.bank_name}
                          onChange={(event) => setBankDraft((current) => ({ ...current, bank_name: event.target.value }))}
                        />
                        <Button type="button" variant="outline" onClick={() => {
                          setManualBankName(false)
                          setBankDraft((current) => ({ ...current, bank_name: "" }))
                        }}>Choose list</Button>
                      </div>
                    ) : (
                      <>
                    {bankDraft.bank_name && TANZANIA_LICENSED_BANKS.includes(bankDraft.bank_name as (typeof TANZANIA_LICENSED_BANKS)[number]) ? (
                      <TanzaniaBankLogo
                        bank={bankDraft.bank_name as (typeof TANZANIA_LICENSED_BANKS)[number]}
                        className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2"
                      />
                    ) : selectedBankChoice?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveBackendMediaUrl(selectedBankChoice.logo_url) ?? undefined}
                        alt=""
                        className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-5 -translate-y-1/2 rounded-sm object-contain"
                      />
                    ) : null}
                    <FluentDropdown
                      id="bank-bank_name"
                      aria-label="Bank name"
                      placeholder="Select a Tanzanian bank"
                      className="!w-full !min-w-0"
                      button={{ className: cn("!w-full !min-w-0", bankDraft.bank_name && "!pl-10") }}
                      value={bankDraft.bank_name}
                      selectedOptions={bankDraft.bank_name ? [bankDraft.bank_name] : []}
                      onOptionSelect={(_, data) => {
                        if (data.optionValue === "__other__") {
                          setManualBankName(true)
                          setBankDraft((current) => ({ ...current, bank_name: "" }))
                          return
                        }
                        setBankDraft((current) => ({ ...current, bank_name: data.optionValue ?? "" }))
                      }}
                    >
                      <FluentOption value="__other__" text="Other bank">
                        <span className="flex items-center gap-2.5"><Add20Regular />Other bank — enter manually</span>
                      </FluentOption>
                      {bankChoices.map((choice) => (
                        <FluentOption key={choice.name} value={choice.name} text={choice.name}>
                          <span className="flex min-w-0 items-center gap-2.5">
                            {TANZANIA_LICENSED_BANKS.includes(choice.name as (typeof TANZANIA_LICENSED_BANKS)[number]) ? (
                              <TanzaniaBankLogo bank={choice.name as (typeof TANZANIA_LICENSED_BANKS)[number]} />
                            ) : choice.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={resolveBackendMediaUrl(choice.logo_url) ?? undefined} alt="" className="size-5 shrink-0 rounded-sm object-contain" />
                            ) : (
                              <BuildingBank20Regular className="size-5 shrink-0 text-primary" />
                            )}
                            <span className="truncate">{choice.name}</span>
                          </span>
                        </FluentOption>
                      ))}
                    </FluentDropdown>
                      </>
                    )}
                  </div>
                ) : (
                  <Input
                    id={`bank-${field}`}
                    value={String(bankDraft[field as keyof typeof bankDraft])}
                    onChange={(event) => setBankDraft((current) => ({ ...current, [field]: event.target.value }))}
                  />
                )}
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={bankDraft.is_primary}
                onChange={(event) => setBankDraft((current) => ({ ...current, is_primary: event.target.checked }))}
              />
              Make this my primary bank account
            </label>
            {bankError ? <p className="text-sm text-destructive sm:col-span-2">{bankError}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={bankSaving} onClick={() => setBankDialogOpen(false)}>Cancel</Button>
            <Button type="button" disabled={bankSaving} onClick={() => void saveBankAccount()}>
              {bankSaving ? <FluentLoadingIndicator className="mr-1 size-4 animate-spin" /> : null}
              Add account
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </FluentCard>
  )
}

function UpdateActionTile({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Request ${title.toLowerCase()} update`}
      className="group flex min-h-[4.75rem] min-w-0 items-center gap-3 border border-border/70 bg-background px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Icon className="size-6 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-5 text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-primary/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  )
}

function ProfileUpdatesTab({
  profileUpdateRequests,
  openSectionEditor,
  onSubmitRequest,
  onCancelRequest,
  loading,
}: {
  profileUpdateRequests: AdminRecord[]
  openSectionEditor: (key: string, title: string, fields: EditableUserField[]) => void
  onSubmitRequest: (id: number | string, requestType?: string) => Promise<void>
  onCancelRequest: (id: number | string, requestType?: string) => Promise<void>
  loading: boolean
}) {
  const statusCounts = React.useMemo(() => {
    let pending = 0
    let approved = 0
    let other = 0
    for (const row of profileUpdateRequests) {
      const status = readString(row, ["status"], "").toLowerCase()
      if (status.includes("approv") || status.includes("complete")) approved += 1
      else if (
        status.includes("pend") ||
        status.includes("submit") ||
        status.includes("review") ||
        status.includes("draft")
      ) {
        pending += 1
      } else {
        other += 1
      }
    }
    return { pending, approved, other, total: profileUpdateRequests.length }
  }, [profileUpdateRequests])

  const updateActions = [
    {
      key: "personal-details",
      title: "Personal details",
      description: "Name, email, phone, and city",
      fields: ["first_name", "last_name", "email", "phone", "city"] as EditableUserField[],
      label: "Personal Details",
      icon: Person20Color,
    },
    {
      key: "contact-details",
      title: "Contact details",
      description: "Email, phone, and city",
      fields: ["email", "phone", "city"] as EditableUserField[],
      label: "Contact Details",
      icon: ContactCard20Color,
    },
    {
      key: "profile-photo",
      title: "Profile photo",
      description: "Change your picture",
      fields: ["profile_photo_url"] as EditableUserField[],
      label: "Profile Picture",
      icon: Camera20Color,
    },
  ]

  return (
    <FluentCard appearance="outline" size="small" className={cn(pageBleedClass, "!flex-col !items-stretch !gap-5 !rounded-none !border-x-0 !border-border/70 !bg-card !p-4 shadow-sm sm:!border-x sm:!p-5")}>
    <motion.div
      className="w-full min-w-0 max-w-full space-y-4"
      variants={profileTabStagger}
      initial="hidden"
      animate="show"
    >
      {/* Primary actions */}
      <motion.div
        variants={profileTabItem}
        className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 max-w-full">
          <h2 className="text-base font-semibold text-foreground">Update requests</h2>
          <p className="text-sm text-muted-foreground">
            Submit a change for HR approval, or track requests you already sent.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 w-full shrink-0 bg-primary !text-white hover:bg-primary/90 sm:w-auto"
          onClick={() =>
            openSectionEditor("personal-details", "Personal Details", [
              "first_name",
              "last_name",
              "email",
              "phone",
              "city",
            ])
          }
        >
          <PencilIcon className="mr-1.5 size-3.5" />
          Request update
        </Button>
      </motion.div>

      <motion.div
        variants={profileTabItem}
        className="flex max-w-full min-w-0 flex-nowrap items-stretch overflow-x-auto overscroll-x-contain border-b border-border/60"
      >
        {[
          { label: "All", value: String(statusCounts.total), className: "text-primary" },
          {
            label: "Open",
            value: String(statusCounts.pending),
            className:
              statusCounts.pending > 0
                ? "text-amber-700 dark:text-amber-300"
                : "text-foreground",
          },
          {
            label: "Approved",
            value: String(statusCounts.approved),
            className: "text-emerald-700 dark:text-emerald-300",
          },
          { label: "Other", value: String(statusCounts.other), className: "text-foreground" },
        ].map((chip, index, arr) => (
          <div
            key={chip.label}
            className={cn(
              "flex min-w-0 flex-1 basis-0 flex-col justify-center bg-background px-2.5 py-2 sm:min-w-[5.5rem] sm:flex-none sm:basis-auto sm:px-3",
              index < arr.length - 1 ? "border-r border-border/60" : null
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {chip.label}
            </span>
            <span className={cn("text-base font-semibold tabular-nums", chip.className)}>
              {chip.value}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Quick update types */}
      <motion.div variants={profileTabItem} className="min-w-0 max-w-full">
        <section aria-labelledby="profile-update-actions-title">
          <div className="mb-3">
            <h3 id="profile-update-actions-title" className="text-sm font-semibold text-foreground">
              What do you want to change?
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Each request is sent to HR for approval.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
            {updateActions.map((action) => (
              <UpdateActionTile
                key={action.key}
                title={action.title}
                description={action.description}
                icon={action.icon}
                onClick={() => openSectionEditor(action.key, action.label, action.fields)}
              />
            ))}
          </div>
        </section>
      </motion.div>

      <motion.div variants={profileTabItem}>
        <SelfServiceSectionCard
          title="Your requests"
          count={profileUpdateRequests.length}
          subtitle="History of submitted profile changes"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() =>
                openSectionEditor("personal-details", "Personal Details", [
                  "first_name",
                  "last_name",
                  "email",
                  "phone",
                  "city",
                ])
              }
            >
              <PencilIcon className="mr-1 size-3.5" />
              New request
            </Button>
          }
        >
          {profileUpdateRequests.length === 0 ? (
            <div className="space-y-3 px-3 py-5 text-center">
              <p className="text-sm text-muted-foreground">
                You have not submitted any profile update requests yet.
              </p>
              <Button
                type="button"
                size="sm"
                className="h-9 bg-primary !text-white hover:bg-primary/90"
                onClick={() =>
                  openSectionEditor("personal-details", "Personal Details", [
                    "first_name",
                    "last_name",
                    "email",
                    "phone",
                    "city",
                  ])
                }
              >
                <PencilIcon className="mr-1.5 size-3.5" />
                Request an update
              </Button>
            </div>
          ) : (
            profileUpdateRequests.map((row, index) => {
              const requestId = readProfileUpdateRequestId(row)
              const status = readString(row, ["status"], "draft").toLowerCase()
              const titleText =
                readString(row, ["title", "request_no", "reference_no", "reference"], "") ||
                readString(row, ["reason", "request_type", "change_type"], "Profile update")
              const createdAt =
                formatDateTime(row.created_at) !== "-"
                  ? formatDateTime(row.created_at)
                  : formatDate(row.date)
              const canSubmit = requestId !== null && status === "draft"
              const canCancel = requestId !== null && status !== "cancelled" && status !== "approved" && status !== "rejected"
              return (
                <motion.div
                  key={String(requestId ?? row.id ?? index)}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + index * 0.04, duration: 0.25 }}
                >
                  <div className="overflow-hidden">
                    <ProfileRequestRow
                      title={titleText}
                      status={readString(row, ["status"], "draft")}
                      dateLabel={createdAt}
                      detail={readString(row, ["reason"], "") || undefined}
                    />
                    {canSubmit || canCancel ? (
                      <div className="flex flex-wrap gap-1.5 border-t border-border/70 bg-background px-3 py-2">
                        {canSubmit ? (
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-primary px-2 text-[10px] font-semibold uppercase tracking-wide !text-white"
                            disabled={loading}
                            onClick={() => void onSubmitRequest(requestId, readString(row, ["request_type"], ""))}
                          >
                            Submit
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 border-rose-300 px-2 text-[10px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                            disabled={loading}
                            onClick={() => void onCancelRequest(requestId, readString(row, ["request_type"], ""))}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )
            })
          )}
        </SelfServiceSectionCard>
      </motion.div>
    </motion.div>
    </FluentCard>
  )
}

type ProfileSummaryTabProps = {
  currentUser: AdminRecord | null
  employee: AdminRecord | null
  attendanceTodayRecord: AdminRecord | null
  attendancePunchesToday?: AdminRecord[]
  dashboardLeave: AdminRecord | null
  employmentStatus: AdminRecord | null
  scheduleDays: AdminRecord[]
  correctionRequests: AdminRecord[]
  profileUpdateRequests: AdminRecord[]
  openSectionEditor: (key: string, title: string, fields: EditableUserField[]) => void
}

function profilePunchStatusTone(punchState: string) {
  const key = punchState.toLowerCase()
  if (key.includes("checked out") || key === "present") {
    return {
      bar: "bg-emerald-500",
      label: "text-emerald-700 dark:text-emerald-300",
      chip: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    }
  }
  if (key.includes("checked in") || key.includes("on break")) {
    return {
      bar: "bg-sky-500",
      label: "text-sky-700 dark:text-sky-300",
      chip: "bg-sky-500/10 text-sky-800 dark:text-sky-200",
    }
  }
  if (key.includes("late") || key.includes("half day")) {
    return {
      bar: "bg-amber-500",
      label: "text-amber-700 dark:text-amber-300",
      chip: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
    }
  }
  if (key.includes("absent")) {
    return {
      bar: "bg-rose-500",
      label: "text-rose-700 dark:text-rose-300",
      chip: "bg-rose-500/10 text-rose-800 dark:text-rose-200",
    }
  }
  if (key.includes("leave") || key.includes("holiday") || key.includes("off")) {
    return {
      bar: "bg-violet-500",
      label: "text-violet-700 dark:text-violet-300",
      chip: "bg-violet-500/10 text-violet-800 dark:text-violet-200",
    }
  }
  return {
    bar: "bg-primary",
    label: "text-primary",
    chip: "bg-primary/10 text-primary",
  }
}

function ProfileSummaryFieldRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid min-h-10 grid-cols-[minmax(6.5rem,0.9fr)_minmax(0,1.1fr)] items-center gap-3 py-1.5">
      <FluentText size={100} weight="semibold" className="truncate uppercase tracking-wide text-muted-foreground">
        {label}
      </FluentText>
      <FluentText size={300} className="min-w-0 text-right text-foreground [overflow-wrap:anywhere]">{value}</FluentText>
    </div>
  )
}

function ProfileSummarySection({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  action?: React.ReactElement | null
  children: React.ReactNode
}) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex min-h-11 min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <FluentText size={300} weight="semibold" className="block" truncate>{title}</FluentText>
            {subtitle ? <FluentText size={200} className="block truncate text-muted-foreground">{subtitle}</FluentText> : null}
          </div>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  )
}

function ProfileSummaryTab({
  currentUser,
  employee,
  attendanceTodayRecord,
  attendancePunchesToday = [],
  dashboardLeave,
  correctionRequests,
  profileUpdateRequests,
  openSectionEditor,
}: ProfileSummaryTabProps) {
  const { url: myProfilePhotoUrl } = useMyProfilePhoto()
  const displayName = resolveDisplayName(currentUser, employee)
  const employeeNumber = resolveEmployeeNumber(currentUser, employee)
  const profilePhotoUrl = resolveProfilePhotoUrl(currentUser, employee, myProfilePhotoUrl)
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  const employmentStatusLabel = readString(employee, ["employment_status", "status"], "Active")
  const employmentTypeLabel = formatEmploymentType(employee?.employment_type)
  const hireDateLabel = formatDate(employee?.hire_date)
  const positionLabel =
    readString(asRecord(employee?.primary_position), ["name", "position_name"], "") ||
    readString(asRecord(employee?.position), ["name", "position_name"], "") ||
    "Position"
  const departmentLabel =
    resolveDepartmentNameFromEmployee(employee) ||
    readString(asRecord(employee?.primary_department), ["name", "department_name"], "") ||
    readString(employee, ["department_name", "department"], "") ||
    "Department"
  const branchLabel =
    resolveBranchNameFromEmployee(employee) ||
    readString(asRecord(employee?.branch), ["name", "branch_name"], "") ||
    readString(employee, ["branch_name", "branch"], "-")
  const manager = resolveManagerDisplay(employee)
  const pendingCorrections = correctionRequests.filter(
    (row) => readString(row, ["status"], "").toLowerCase() !== "cancelled"
  ).length
  const pendingProfileUpdates = profileUpdateRequests.filter(
    (row) => readString(row, ["status"], "").toLowerCase() !== "cancelled"
  ).length
  const pendingLeave = readArray(dashboardLeave?.pending_requests).length
  const leaveBalancesCount = readArray(dashboardLeave?.balances).length
  const attendanceTodaySummary =
    asRecord(attendanceTodayRecord?.summary) ??
    asRecord(attendanceTodayRecord?.daily_summary) ??
    asRecord(attendanceTodayRecord?.dailySummary) ??
    asRecord(attendanceTodayRecord?.attendance) ??
    null
  const rawPunchState = readAttendanceValue(
    attendanceTodayRecord,
    ["punch_state", "punchState", "status"],
    attendanceTodaySummary
  )
  const processingState = formatProcessingState(
    readAttendanceValue(attendanceTodayRecord, ["processing_state", "processingState"], attendanceTodaySummary)
  )

  const email = readString(currentUser, ["email"], "-")
  const phone =
    readString(employee, ["phone", "phone_number"], "") ||
    readString(currentUser, ["phone", "phone_number"], "-")
  const empId = readString(employee, ["id", "employee_id", "employeeId"], "-")

  // Same sources as the employee dashboard: today payload + punch history.
  const punchTimes = resolveTodayPunchTimes(attendanceTodayRecord, attendancePunchesToday)
  const firstPunch = punchTimes.first || "—"
  const lastPunch = punchTimes.last || "—"
  const punchState = resolveProfileAttendanceState(rawPunchState, firstPunch, lastPunch)
  const punchTone = profilePunchStatusTone(punchState)
  const todayDateLabel = formatDate(attendanceTodayRecord?.date) || "Today"
  const openRequestsTotal = pendingLeave + pendingCorrections + pendingProfileUpdates

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <div
        className={cn(
          heroPanelClass,
          pageBleedClass,
          "!rounded-none border border-border/70 !bg-card !py-4 !text-foreground shadow-sm sm:!px-5",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-1 overflow-hidden" aria-hidden>
          <span className="w-1/4 bg-[#f25022]" />
          <span className="w-1/4 bg-[#7fba00]" />
          <span className="w-1/4 bg-[#00a4ef]" />
          <span className="w-1/4 bg-[#ffb900]" />
        </div>
        <div className="relative z-10 space-y-4 pt-1">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
            <Persona
              name={displayName}
              secondaryText={positionLabel}
              avatar={{
                image: profilePhotoUrl ? { src: profilePhotoUrl, alt: displayName } : undefined,
                initials: initials || "ME",
              }}
              size="large"
              className="min-w-0 [&_.fui-Persona__primaryText]:font-semibold [&_.fui-Persona__secondaryText]:text-muted-foreground"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] font-medium capitalize text-primary">
                {employmentStatusLabel}
              </span>
              <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted"
                  onClick={() =>
                    openSectionEditor("profile-photo", "Profile Picture", ["profile_photo_url"])
                  }
              >
                Change photo
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Employee no.", value: employeeNumber },
              { label: "Department", value: departmentLabel },
              { label: "Branch", value: branchLabel },
              { label: "Employment", value: employmentTypeLabel },
              { label: "Joined", value: hireDateLabel },
            ].map((field) => (
              <div key={field.label} className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </p>
                <p className="truncate text-xs font-semibold text-foreground">{field.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's attendance detail row */}
      <div className={cn(
        pageBleedClass,
        "divide-y divide-border overflow-hidden border-y border-border sm:border-x"
      )}>
        <div className="flex bg-background">
          <div className={cn("w-1 shrink-0", punchTone.bar)} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
            <div className="w-[7.5rem] shrink-0">
              <div className="text-xs font-semibold text-foreground">Today</div>
              <div className={cn("mt-0.5 text-[11px] font-semibold capitalize", punchTone.label)}>
                {punchState}
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
              <div className="hidden min-w-[6.5rem] shrink-0 text-right sm:block">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Processing
                </div>
                <div className="truncate text-sm font-medium text-foreground">
                  {processingState || todayDateLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex bg-background">
          <div
            className={cn(
              "w-1 shrink-0",
              "bg-primary"
            )}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2.5">
            <div className="w-[7.5rem] shrink-0">
              <div className="text-xs font-semibold text-foreground">Requests</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">Open items</div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Leave
                </div>
                <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {pendingLeave}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Corrections
                </div>
                <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {pendingCorrections}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Profile
                </div>
                <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {pendingProfileUpdates}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Leave types
                </div>
                <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {leaveBalancesCount}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Open requests
                </div>
                <div className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {openRequestsTotal}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* One Fluent surface keeps the summary aligned without nested cards or heavy dividers. */}
      <FluentCard
        appearance="outline"
        size="small"
        className={cn(
          pageBleedClass,
          "min-w-0 !gap-0 !rounded-none !border-x-0 !border-border/70 !bg-card !p-4 shadow-sm sm:!border-x sm:!p-5"
        )}
      >
      <div className="grid min-w-0 grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
        <ProfileSummarySection
          title="Contact"
          subtitle="Personal details"
          icon={Person20Color}
          action={
            <FluentButton
              type="button"
              appearance="subtle"
              size="small"
              icon={<Edit16Regular />}
              onClick={() =>
                openSectionEditor("contact-details", "Contact Details", [
                  "first_name",
                  "last_name",
                  "email",
                  "phone",
                ])
              }
            >
              Edit
            </FluentButton>
          }
        >
          <ProfileSummaryFieldRow label="Email" value={email} />
          <ProfileSummaryFieldRow label="Phone" value={phone} />
          <ProfileSummaryFieldRow label="Employee ID" value={empId} />
          <FluentCardFooter className="mt-2 flex flex-wrap items-center gap-1 !px-0 !py-0">
            <FluentButton
              type="button"
              appearance="subtle"
              size="small"
              onClick={() =>
                openSectionEditor("profile-photo", "Profile Picture", ["profile_photo_url"])
              }
            >
              Change Photo
            </FluentButton>
          </FluentCardFooter>
        </ProfileSummarySection>

        <ProfileSummarySection
          title="Organization"
          subtitle="Work placement"
          icon={Building20Color}
        >
          <ProfileSummaryFieldRow label="Branch" value={branchLabel} />
          <ProfileSummaryFieldRow label="Department" value={departmentLabel} />
          <ProfileSummaryFieldRow label="Position" value={positionLabel} />
        </ProfileSummarySection>

        <ProfileSummarySection title="Reporting" subtitle="Manager chain" icon={PeopleTeam20Color}>
          <ProfileSummaryFieldRow label="Reports to" value={manager.name || "—"} />
          <ProfileSummaryFieldRow label="Manager no." value={manager.employeeNo || "—"} />
          <ProfileSummaryFieldRow label="Full name" value={displayName} />
        </ProfileSummarySection>

        <ProfileSummarySection
          title="Employment"
          subtitle="Status & tenure"
          icon={Briefcase20Color}
        >
          <ProfileSummaryFieldRow
            label="Status"
            value={
              <span
                className={cn(
                  "font-semibold",
                  employmentStatusLabel.toLowerCase() === "active"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-foreground"
                )}
              >
                {employmentStatusLabel}
              </span>
            }
          />
          <ProfileSummaryFieldRow label="Type" value={employmentTypeLabel} />
          <ProfileSummaryFieldRow label="Hired" value={hireDateLabel} />
        </ProfileSummarySection>
      </div>
      </FluentCard>
    </div>
  )
}


export function EmployeeSelfServiceProfileView() {
  const { loading, error, token, currentUser, employee, refresh } = useSelfEmployeeData()
  const { url: myProfilePhotoUrl, refresh: refreshMyProfilePhoto } = useMyProfilePhoto(token)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const profileNavigationStyles = useProfileNavigationStyles()
  const activeTab = (searchParams?.get("tab") as SelfProfileTab) || "summary"
  const editTarget = searchParams?.get("edit") ?? ""
  const autoOpenedEditTargetRef = React.useRef("")
  const [message, setMessage] = React.useState<string | null>(null)
  useFluentToastState(message, setMessage, "success")
  const tabs: Array<{ key: SelfProfileTab; label: string }> = [
    { key: "summary", label: "Summary" },
    { key: "assignments", label: "Assignments" },
    { key: "personal", label: "Personal" },
    { key: "records", label: "Records" },
    { key: "updates", label: "Update Requests" },
  ]
  const [sectionEditor, setSectionEditor] = React.useState<SectionEditorState | null>(null)
  const [sectionSaving, setSectionSaving] = React.useState(false)
  const [sectionError, setSectionError] = React.useState<string | null>(null)
  const [sectionErrorLines, setSectionErrorLines] = React.useState<string[]>([])
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = React.useState("")
  const [profilePhotoFileName, setProfilePhotoFileName] = React.useState("")
  const [selectedProfilePhotoFile, setSelectedProfilePhotoFile] = React.useState<File | null>(null)
  const [defaultAvatars, setDefaultAvatars] = React.useState<AdminRecord[]>([])
  const [defaultAvatarsLoading, setDefaultAvatarsLoading] = React.useState(false)
  const [selectedDefaultAvatarId, setSelectedDefaultAvatarId] = React.useState<string | number | null>(
    null
  )
  const [dashboardOverview, setDashboardOverview] = React.useState<AdminRecord | null>(null)
  const [employmentStatus, setEmploymentStatus] = React.useState<AdminRecord | null>(null)
  const [attendanceOverview, setAttendanceOverview] = React.useState<AdminRecord | null>(null)
  const [attendanceTodayDirect, setAttendanceTodayDirect] = React.useState<AdminRecord | null>(null)
  const [attendancePunchesToday, setAttendancePunchesToday] = React.useState<AdminRecord[]>([])
  const [attendanceAssignments, setAttendanceAssignments] = React.useState<AdminRecord | null>(null)
  const [teamAttendance, setTeamAttendance] = React.useState<AdminRecord[]>([])
  const [correctionRequests, setCorrectionRequests] = React.useState<AdminRecord[]>([])
  const [profileUpdateRequests, setProfileUpdateRequests] = React.useState<AdminRecord[]>([])
  const [sectionValues, setSectionValues] = React.useState<Record<EditableUserField, string>>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    city: "",
    password: "",
    user_no: "",
    status: "",
    profile_photo_url: "",
    personal_phone_number: "",
    personal_email: "",
    address_line_1: "",
    address_line_2: "",
    state: "",
    country: "",
    postal_code: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    emergency_contact_email: "",
    emergency_contact_address: "",
    emergency_contact_occupation: "",
  })
  const profilePhotoInputRef = React.useRef<HTMLInputElement | null>(null)
  const baseEditorValues = React.useMemo(
    () => ({
      first_name:
        readString(currentUser, ["first_name", "firstName"], "") ||
        readString(employee, ["first_name", "firstName"], ""),
      last_name:
        readString(currentUser, ["last_name", "lastName"], "") ||
        readString(employee, ["last_name", "lastName"], ""),
      phone:
        readString(currentUser, ["phone", "phone_number"], "") ||
        readString(employee, ["phone", "phone_number"], ""),
      email:
        readString(currentUser, ["email"], "") ||
        readString(employee, ["email"], ""),
      city:
        readString(employee, ["city"], "") ||
        readString(asRecordList(employee?.addresses)[0] ?? null, ["city"], ""),
      password: "",
      user_no:
        readString(currentUser, ["user_no", "employee_no"], "") ||
        readString(employee, ["user_no", "employee_no", "employeeId"], ""),
      status: readString(currentUser, ["status"], "") || readString(employee, ["employment_status"], ""),
      profile_photo_url: resolveProfilePhotoUrl(currentUser, employee, myProfilePhotoUrl),
      personal_phone_number: "",
      personal_email: "",
      address_line_1: "",
      address_line_2: "",
      state: "",
      country: "",
      postal_code: "",
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      emergency_contact_email: "",
      emergency_contact_address: "",
      emergency_contact_occupation: "",
    }),
    [currentUser, employee, myProfilePhotoUrl]
  )

  const openSectionEditor = React.useCallback(
    (
      key: string,
      title: string,
      fields: EditableUserField[],
      requestType?: SectionEditorState["requestType"],
    ) => {
      setSectionError(null)
      setSectionErrorLines([])
      setProfilePhotoPreviewUrl("")
      setProfilePhotoFileName("")
      setSelectedProfilePhotoFile(null)
      setSelectedDefaultAvatarId(null)
      setSectionValues(baseEditorValues)
      setSectionEditor({ key, title, fields, requestType })
    },
    [baseEditorValues]
  )

  React.useEffect(() => {
    if (!token || !sectionEditor || sectionEditor.fields[0] !== "profile_photo_url") {
      return
    }
    let cancelled = false
    setDefaultAvatarsLoading(true)

    void listSelectableAvatarsForMe(token)
      .then((rows) => {
        if (!cancelled) setDefaultAvatars(rows)
      })
      .catch(() => {
        if (!cancelled) setDefaultAvatars([])
      })
      .finally(() => {
        if (!cancelled) setDefaultAvatarsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [employee, sectionEditor, token])

  const handleDefaultAvatarSelected = React.useCallback((row: AdminRecord) => {
    const imageUrl = extractDefaultAvatarImageUrl(row)
    const id = readDefaultAvatarId(row)
    if (id == null) {
      setSectionError("This avatar has no valid id.")
      setSectionErrorLines([])
      return
    }
    if (!imageUrl) {
      setSectionError("This avatar has no image available.")
      setSectionErrorLines([])
      return
    }

    const name =
      (typeof row.avatar_name === "string" && row.avatar_name) ||
      (typeof row.name === "string" && row.name) ||
      "Default avatar"

    // Default gallery selection uses PATCH /api/me/profile/avatar (not file upload).
    // Keep a numeric id only — backend DTO is number | null.
    setSelectedDefaultAvatarId(id)
    setSelectedProfilePhotoFile(null)
    setProfilePhotoFileName(name)
    setProfilePhotoPreviewUrl(imageUrl)
    setSectionError(null)
    setSectionErrorLines([])
  }, [])

  const handleSectionFieldChange = React.useCallback((field: EditableUserField, value: string) => {
    setSectionValues((previous) => ({ ...previous, [field]: value }))
  }, [])

  const handleProfilePhotoSelected = React.useCallback((file: File | null) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setSectionError("Please choose an image file.")
      setSectionErrorLines([])
      return
    }

    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setSectionError("Please choose an image smaller than 5 MB.")
      setSectionErrorLines([])
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (!result) {
        setSectionError("We couldn't read that image. Please try another file.")
        setSectionErrorLines([])
        return
      }
      setSectionError(null)
      setSectionErrorLines([])
      // Device image upload uses POST /api/me/profile/photo — clears default avatar pick.
      setSelectedDefaultAvatarId(null)
      setSelectedProfilePhotoFile(file)
      setProfilePhotoFileName(file.name)
      setProfilePhotoPreviewUrl(result)
      setSectionValues((previous) => ({
        ...previous,
        profile_photo_url: previous.profile_photo_url,
      }))
    }
    reader.onerror = () => {
      setSectionError("We couldn't read that image. Please try another file.")
      setSectionErrorLines([])
    }
    reader.readAsDataURL(file)
  }, [])

  const handleSectionSave = React.useCallback(async () => {
    if (!token || !sectionEditor) {
      setSectionError("Session expired. Please sign in again.")
      setSectionErrorLines([])
      return
    }

    const isProfilePhotoSection =
      sectionEditor.fields.length === 1 && sectionEditor.fields[0] === "profile_photo_url"

    // Profile picture:
    // - default avatar → PATCH /api/me/profile/avatar { default_avatar_id }
    // - device image  → POST /api/me/profile/photo (multipart file)
    if (isProfilePhotoSection) {
      const hasDefaultAvatar = selectedDefaultAvatarId != null && String(selectedDefaultAvatarId).trim() !== ""
      const hasUploadFile = Boolean(selectedProfilePhotoFile)

      if (!hasDefaultAvatar && !hasUploadFile) {
        setSectionError("Choose a default avatar or upload an image.")
        setSectionErrorLines([])
        return
      }

      setSectionSaving(true)
      setSectionError(null)
      setSectionErrorLines([])
      try {
        let result: AdminRecord | null = null

        if (hasDefaultAvatar) {
          const avatarId =
            typeof selectedDefaultAvatarId === "number"
              ? selectedDefaultAvatarId
              : Number(selectedDefaultAvatarId)
          if (!Number.isFinite(avatarId)) {
            throw new Error("Invalid default avatar id.")
          }
          result = await selectMyProfileAvatar(token, avatarId)
        } else if (selectedProfilePhotoFile) {
          result = await uploadMyProfilePhoto(token, selectedProfilePhotoFile)
        }

        const submittedForApproval =
          Boolean(selectedProfilePhotoFile) && result?.approval_required !== false
        if (submittedForApproval) {
          try {
            const profileUpdatesResult = await listMyProfileUpdateRequests(token, {
              page: 1,
              limit: 20,
            })
            setProfileUpdateRequests(profileUpdatesResult.rows)
          } catch {
            // Submission succeeded; refreshing the request list is best-effort.
          }
          setSectionEditor(null)
          setSelectedProfilePhotoFile(null)
          setSelectedDefaultAvatarId(null)
          setProfilePhotoFileName("")
          setProfilePhotoPreviewUrl("")
          setMessage("Profile picture submitted for HR approval.")
          return
        }

        const rawResultUrl =
          readString(result, ["profile_photo_url", "photo_url", "url", "avatar_url"], "") ||
          readString(asRecord(result?.user), ["profile_photo_url", "photo_url", "url", "avatar_url"], "") ||
          readString(asRecord(result?.employee), ["profile_photo_url", "photo_url", "url", "avatar_url"], "") ||
          ""
        const resultUrl =
          resolveBackendMediaUrl(rawResultUrl) || rawResultUrl.trim() || ""
        const previewUrl =
          resolveBackendMediaUrl(profilePhotoPreviewUrl) || profilePhotoPreviewUrl.trim() || ""

        // Publish immediately so the sidebar footer updates before any follow-up GET.
        // Show the selected image immediately. The canonical backend URL is
        // fetched just below and will be used on the next refresh/navigation.
        const optimisticUrl = previewUrl || resultUrl
        if (optimisticUrl) {
          setMyProfilePhotoUrl(optimisticUrl)
        }

        let canonicalUrl = optimisticUrl
        try {
          const fresh = await ensureMyProfilePhotoUrl(token, { force: true })
          // Only replace if the server returned a real URL (never clear optimistic).
          if (fresh) {
            canonicalUrl = fresh
            setMyProfilePhotoUrl(fresh)
          }
        } catch {
          // Save already succeeded; photo URL refresh is best-effort.
        }

        // A local data preview is ideal for instant feedback, but retain the
        // durable backend URL in the shared store once the request completes.
        if (resultUrl && resultUrl !== canonicalUrl) {
          canonicalUrl = resultUrl
          setMyProfilePhotoUrl(resultUrl)
        }

        if (canonicalUrl) {
          setSectionValues((previous) => ({
            ...previous,
            profile_photo_url: canonicalUrl,
          }))
        }

        // Force every subscriber (including sidebar) to re-read the store.
        void refreshMyProfilePhoto()
        setSectionEditor(null)
        setSelectedProfilePhotoFile(null)
        setSelectedDefaultAvatarId(null)
        setProfilePhotoFileName("")
        setProfilePhotoPreviewUrl("")
        setMessage(
          hasDefaultAvatar
            ? "Default avatar applied."
            : "Profile picture updated."
        )
        try {
          await refresh()
        } catch {
          // Photo was saved; profile reload is best-effort.
        }
      } catch (errorObject) {
        const status =
          typeof errorObject === "object" &&
          errorObject !== null &&
          "status" in errorObject
            ? Number((errorObject as { status?: number }).status)
            : null
        const lines = formatApiErrorLines(
          errorObject,
          hasDefaultAvatar
            ? status === 500
              ? "This avatar failed on the server. Try another avatar, or upload your own photo."
              : "Failed to select default avatar."
            : "Failed to upload profile picture."
        )
        setSectionError(lines[0] ?? "Failed to update profile picture.")
        setSectionErrorLines(lines)
      } finally {
        setSectionSaving(false)
      }
      return
    }

    const hasChangedValue = sectionEditor.fields.some((field) => {
      if (field === "password") return Boolean(sectionValues[field].trim())
      if (field === "profile_photo_url") return false
      return sectionValues[field].trim() !== baseEditorValues[field].trim()
    })
    if (!hasChangedValue) {
      setSectionError(null)
      setSectionErrorLines([])
      setSectionEditor(null)
      setMessage("No changes to submit.")
      return
    }

    const requestedChanges: AdminRecord = {}
    for (const field of sectionEditor.fields) {
      const nextValue = sectionValues[field].trim()
      if (field === "password") {
        if (nextValue) {
          requestedChanges.password = nextValue
        }
        continue
      }
      if (field === "profile_photo_url") {
        continue
      }
      if (nextValue === baseEditorValues[field].trim()) continue
      requestedChanges[field] = nextValue
    }
    if (!Object.keys(requestedChanges).length) {
      setSectionError("Nothing to update for this section.")
      setSectionErrorLines([])
      return
    }
    if ("password" in requestedChanges) {
      setSectionError("Password changes must use the account password-change flow, not an HR profile-change request.")
      setSectionErrorLines([])
      return
    }
    if (
      sectionEditor.requestType === "CONTACT_INFORMATION" &&
      !requestedChanges.personal_phone_number &&
      !requestedChanges.personal_email
    ) {
      setSectionError("Add a phone number or email address.")
      setSectionErrorLines([])
      return
    }
    if (
      sectionEditor.requestType === "ADDRESS_INFORMATION" &&
      (!requestedChanges.address_line_1 || !requestedChanges.city)
    ) {
      setSectionError("Address and city are required.")
      setSectionErrorLines([])
      return
    }
    if (
      sectionEditor.requestType === "EMERGENCY_CONTACT" &&
      (!requestedChanges.emergency_contact_name ||
        !requestedChanges.emergency_contact_relationship ||
        !requestedChanges.emergency_contact_phone)
    ) {
      setSectionError("Name, relationship, and phone are required.")
      setSectionErrorLines([])
      return
    }
    setSectionSaving(true)
    setSectionError(null)
    setSectionErrorLines([])
    try {
      const groups: Array<{ request_type: string; changes: AdminRecord }> = []
      if (sectionEditor.requestType) {
        groups.push({
          request_type: sectionEditor.requestType,
          changes: requestedChanges,
        })
      } else {
        const fieldGroups: Array<[string, string[]]> = [
          ["PERSONAL_INFORMATION", ["first_name", "last_name"]],
          ["CONTACT_INFORMATION", ["email", "phone"]],
          ["ADDRESS_INFORMATION", ["city"]],
        ]
        for (const [request_type, fields] of fieldGroups) {
          const changes = Object.fromEntries(
            fields
              .filter((field) => field in requestedChanges)
              .map((field) => [field, requestedChanges[field]]),
          )
          if (Object.keys(changes).length) groups.push({ request_type, changes })
        }
      }
      if (!groups.length) throw new Error("No supported personal profile changes were selected.")

      // Create all typed drafts before submitting any. If draft creation fails,
      // any created drafts remain editable and visible in request history.
      const drafts: AdminRecord[] = []
      for (const group of groups) {
        drafts.push(asRecord(await createMyProfileChangeRequest(token, {
          ...group,
          reason: `Requested changes to ${sectionEditor.title.toLowerCase()}.`,
        })) ?? {})
      }
      for (const draft of drafts) {
        const requestId = readProfileUpdateRequestId(draft)
        if (requestId === null) throw new Error("The profile change draft did not return a request ID.")
        const submittedRequest = asRecord(await submitMyProfileChangeRequest(token, requestId))
        void notifySubmittedRequestApprovers({
          kind: "profile_update_request",
          token,
          request: submittedRequest,
          loadRequest: () => getMyProfileChangeRequest(token, requestId),
        })
      }
      setMessage(`${sectionEditor.title} update submitted for HR approval.`)
      setSectionEditor(null)
      const profileUpdatesResult = await listMyProfileUpdateRequests(token, {
        page: 1,
        limit: 20,
      })
      setProfileUpdateRequests(profileUpdatesResult.rows)
    } catch (errorObject) {
      const lines = formatApiErrorLines(errorObject, "Failed to submit profile update request.")
      setSectionError(lines[0] ?? "Failed to submit profile update request.")
      setSectionErrorLines(lines)
    } finally {
      setSectionSaving(false)
    }
  }, [
    profilePhotoPreviewUrl,
    baseEditorValues,
    refresh,
    refreshMyProfilePhoto,
    sectionEditor,
    sectionValues,
    selectedDefaultAvatarId,
    selectedProfilePhotoFile,
    token,
  ])

  React.useEffect(() => {
    if (
      activeTab !== "summary" ||
      editTarget !== "profile-photo" ||
      sectionEditor ||
      autoOpenedEditTargetRef.current === editTarget
    ) {
      return
    }
    autoOpenedEditTargetRef.current = editTarget
    openSectionEditor("profile-photo", "Profile Picture", ["profile_photo_url"])
  }, [activeTab, editTarget, openSectionEditor, sectionEditor])

  const handleSubmitProfileUpdateRequest = React.useCallback(async (id: number | string, requestType = "") => {
    if (!token) {
      setMessage("Session expired. Please sign in again.")
      return
    }

    setSectionSaving(true)
    setMessage(null)
    try {
      const canonical = Boolean(requestType)
      const request = canonical
        ? await submitMyProfileChangeRequest(token, id)
        : await submitMyProfileUpdateRequest(token, id)
      void notifySubmittedRequestApprovers({
        kind: "profile_update_request",
        token,
        request: asRecord(request) ?? {},
        loadRequest: () => canonical
          ? getMyProfileChangeRequest(token, id)
          : getMyProfileUpdateRequest(token, id),
      })
      const profileUpdatesResult = await listMyProfileUpdateRequests(token, { page: 1, limit: 20 })
      setProfileUpdateRequests(profileUpdatesResult.rows)
      setMessage("Profile update request submitted.")
    } catch (errorObject) {
      const lines = formatApiErrorLines(errorObject, "Failed to submit profile update request.")
      setMessage(lines[0] ?? "Failed to submit profile update request.")
    } finally {
      setSectionSaving(false)
    }
  }, [token])

  const handleCancelProfileUpdateRequest = React.useCallback(async (id: number | string, requestType = "") => {
    if (!token) {
      setMessage("Session expired. Please sign in again.")
      return
    }

    setSectionSaving(true)
    setMessage(null)
    try {
      if (requestType) await cancelMyProfileChangeRequest(token, id)
      else await cancelMyProfileUpdateRequest(token, id)
      const profileUpdatesResult = await listMyProfileUpdateRequests(token, { page: 1, limit: 20 })
      setProfileUpdateRequests(profileUpdatesResult.rows)
      setMessage("Profile update request cancelled.")
    } catch (errorObject) {
      const lines = formatApiErrorLines(errorObject, "Failed to cancel profile update request.")
      setMessage(lines[0] ?? "Failed to cancel profile update request.")
    } finally {
      setSectionSaving(false)
    }
  }, [token])

  React.useEffect(() => {
    if (!token) {
      setDashboardOverview(null)
      setEmploymentStatus(null)
      setAttendanceOverview(null)
      setAttendanceTodayDirect(null)
      setAttendancePunchesToday([])
      setAttendanceAssignments(null)
      setTeamAttendance([])
      setCorrectionRequests([])
      setProfileUpdateRequests([])
      return
    }

    let cancelled = false
    const todayIso = localDateIso()
    const dashboardOverviewRequest = getEmployeeDashboard(token).catch(() => getMyDashboard(token))

    void Promise.allSettled([
      dashboardOverviewRequest,
      getMyStatus(token),
      getMyAttendanceOverview(token, { page: 1, limit: 20, sortBy: "created_at", sortOrder: "DESC" }),
      // Same endpoints the employee dashboard uses for check-in / check-out times.
      getMyAttendanceToday(token),
      listMyAttendancePunches(token, { page: 1, limit: 50, sortBy: "created_at", sortOrder: "DESC" }),
      getMyAttendanceAssignments(token),
      listMyTeamAttendance(token, { page: 1, limit: 5 }),
      listMyAttendanceCorrectionRequests(token, { page: 1, limit: 5, sortBy: "created_at", sortOrder: "DESC" }),
      listMyProfileUpdateRequests(token, { page: 1, limit: 5 }),
    ]).then((results) => {
      if (cancelled) {
        return
      }

      const [
        dashboardResult,
        statusResult,
        overviewResult,
        todayResult,
        punchesResult,
        assignmentsResult,
        teamResult,
        correctionsResult,
        profileUpdatesResult,
      ] = results

      setDashboardOverview(dashboardResult.status === "fulfilled" ? asRecord(dashboardResult.value) : null)
      setEmploymentStatus(statusResult.status === "fulfilled" ? asRecord(statusResult.value) : null)
      setAttendanceOverview(overviewResult.status === "fulfilled" ? asRecord(overviewResult.value) : null)
      setAttendanceTodayDirect(
        todayResult.status === "fulfilled" ? asRecord(todayResult.value) : null
      )

      if (punchesResult.status === "fulfilled") {
        const allPunches = punchesResult.value.rows
        const todayPunches = allPunches.filter((row) => isPunchOnLocalDate(row, todayIso))
        setAttendancePunchesToday(todayPunches.length > 0 ? todayPunches : allPunches)
      } else {
        setAttendancePunchesToday([])
      }

      setAttendanceAssignments(assignmentsResult.status === "fulfilled" ? asRecord(assignmentsResult.value) : null)
      setTeamAttendance(teamResult.status === "fulfilled" ? teamResult.value.rows : [])

      if (correctionsResult.status === "fulfilled") {
        setCorrectionRequests(correctionsResult.value.rows)
      } else {
        setCorrectionRequests([])
      }

      if (profileUpdatesResult.status === "fulfilled") {
        setProfileUpdateRequests(profileUpdatesResult.value.rows)
      } else {
        setProfileUpdateRequests([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [token])

  const attendanceTodayRecord = React.useMemo(
    () =>
      // Prefer dedicated /me/attendance/today (same as dashboard home).
      attendanceTodayDirect ??
      asRecord(attendanceOverview?.today) ??
      asRecord(dashboardOverview?.attendance_today) ??
      asRecord(dashboardOverview?.attendance_overview),
    [attendanceOverview, attendanceTodayDirect, dashboardOverview]
  )
  const dashboardLeave = React.useMemo(() => asRecord(dashboardOverview?.leave), [dashboardOverview])
  const scheduleDays = React.useMemo(
    () =>
      readArray(asRecord(dashboardOverview?.schedule_preview)?.days)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is AdminRecord => entry !== null),
    [dashboardOverview]
  )
  const assignmentSummaryRows = React.useMemo(() => {
    if (!attendanceAssignments) {
      return [] as Array<{ label: string; value: string }>
    }

    const defaultTimetable = asRecord(attendanceAssignments.default_timetable)
    const defaultShift = asRecord(attendanceAssignments.default_shift)

    return [
      { label: "Default Timetable", value: readString(defaultTimetable, ["name", "code"], "-") },
      { label: "Default Shift", value: readString(defaultShift, ["name", "code"], "-") },
      { label: "Shift Assignments", value: String(readArray(attendanceAssignments.shift_assignments).length) },
      { label: "Timetable Assignments", value: String(readArray(attendanceAssignments.timetable_assignments).length) },
      { label: "Schedule Overrides", value: String(readArray(attendanceAssignments.schedule_overrides).length) },
    ]
  }, [attendanceAssignments])

  const openedFromSettings = editTarget === "profile-photo"

  return (
    <div className="grid gap-4">
      {openedFromSettings ? (
        <div>
          <BackToSettingsLink />
        </div>
      ) : null}
      <DoodleSprites />
      <div className="tab-rail-scroll border-b border-border/80">
        <TabList
          aria-label="Profile sections"
          size="small"
          selectedValue={activeTab}
          onTabSelect={(_event, data) => {
            const nextTab = String(data.value)
            if (tabs.some((tab) => tab.key === nextTab)) {
              router.push(`${pathname}?tab=${nextTab}`, { scroll: false })
            }
          }}
          className={profileNavigationStyles.tabList}
        >
          {tabs.map((tab) => {
            return (
              <Tab
                key={tab.key}
                value={tab.key}
                className={profileNavigationStyles.tab}
              >
                {tab.label}
              </Tab>
            )
          })}
        </TabList>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <FluentLoadingIndicator size="large" />
          <p className="text-sm text-muted-foreground">Loading your profile...</p>
        </div>
      ) : null}
      {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!loading && !error && !(currentUser || employee) ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We signed you in, but we could not load your employee workspace yet. Refresh once, and if it still stays empty, check that your public app URL and API URL point to the same reachable backend.
        </div>
      ) : null}
      {!loading && !error && (currentUser || employee) ? (
        <div key={activeTab} className="grid gap-4 animate-in slide-in-from-right-2 fade-in-0 duration-300">
          {activeTab === "summary" ? (
            <ProfileSummaryTab
              currentUser={currentUser}
              employee={employee}
              attendanceTodayRecord={attendanceTodayRecord}
              attendancePunchesToday={attendancePunchesToday}
              dashboardLeave={dashboardLeave}
              employmentStatus={employmentStatus}
              scheduleDays={scheduleDays}
              correctionRequests={correctionRequests}
              profileUpdateRequests={profileUpdateRequests}
              openSectionEditor={openSectionEditor}
            />
          ) : null}

          {activeTab === "assignments" && employee ? (
            <ProfileAssignmentsTab
              employee={employee}
              assignmentSummaryRows={assignmentSummaryRows}
              scheduleDays={scheduleDays}
            />
          ) : null}

          {activeTab === "personal" && employee ? (
            <ProfilePersonalTab
              employee={employee}
              onRequestAdd={(kind) => {
                if (kind === "contact") {
                  openSectionEditor(
                    "add-contact",
                    "Contact",
                    ["personal_phone_number", "personal_email"],
                    "CONTACT_INFORMATION",
                  )
                  return
                }
                if (kind === "address") {
                  openSectionEditor(
                    "add-address",
                    "Address",
                    [
                      "address_line_1",
                      "address_line_2",
                      "city",
                      "state",
                      "postal_code",
                      "country",
                    ],
                    "ADDRESS_INFORMATION",
                  )
                  return
                }
                openSectionEditor(
                  "add-relative",
                  "Emergency Contact",
                  [
                    "emergency_contact_name",
                    "emergency_contact_relationship",
                    "emergency_contact_phone",
                    "emergency_contact_email",
                    "emergency_contact_address",
                    "emergency_contact_occupation",
                  ],
                  "EMERGENCY_CONTACT",
                )
              }}
            />
          ) : null}

          {activeTab === "records" ? (
            <ProfileRecordsTab
              employee={employee}
              correctionRequests={correctionRequests}
              teamAttendance={teamAttendance}
              initialSectionId={searchParams?.get("section") ?? undefined}
              token={token}
              onRefresh={refresh}
            />
          ) : null}

          {activeTab === "updates" ? (
            <ProfileUpdatesTab
              profileUpdateRequests={profileUpdateRequests}
              openSectionEditor={openSectionEditor}
              onSubmitRequest={handleSubmitProfileUpdateRequest}
              onCancelRequest={handleCancelProfileUpdateRequest}
              loading={sectionSaving}
            />
          ) : null}


          </div>
        ) : null}
          <Dialog open={Boolean(sectionEditor)} onOpenChange={(open) => (!open ? setSectionEditor(null) : undefined)}>
            <DialogPopup from="bottom" className="sm:max-w-xl">
              <DialogHeader>
                {openedFromSettings ? <BackToSettingsLink /> : null}
                <DialogTitle>
                  {sectionEditor
                    ? `${sectionEditor.key.startsWith("add-") ? "Add" : "Edit"} ${sectionEditor.title}`
                    : "Edit Section"}
                </DialogTitle>
                {sectionEditor?.requestType ? (
                  <DialogDescription>
                    Enter the details below. They will be sent to HR for approval before appearing on your profile.
                  </DialogDescription>
                ) : null}
              </DialogHeader>
              <div className="grid gap-3">
                {sectionEditor?.requestType === "CONTACT_INFORMATION" ? (
                  <p className="text-sm text-muted-foreground">Provide at least a phone number or an email address.</p>
                ) : null}
                {sectionEditor?.fields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">
                      {getEditableFieldLabel(field)}
                      {sectionEditor.requestType && isRequiredPersonalRecordField(field) ? " *" : ""}
                    </Label>
                    {field === "profile_photo_url" ? (
                      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-16 ring-1 ring-border" size="lg">
                            {profilePhotoPreviewUrl || sectionValues.profile_photo_url ? (
                              <AvatarImage
                                src={profilePhotoPreviewUrl || sectionValues.profile_photo_url}
                                alt="Selected profile picture"
                              />
                            ) : null}
                            <AvatarFallback className="text-sm font-semibold">PP</AvatarFallback>
                          </Avatar>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {profilePhotoFileName || "No new image selected"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Pick a default avatar or upload your own image. Changes apply when you save.
                            </p>
                          </div>
                        </div>
                        <input
                          ref={profilePhotoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            setSelectedDefaultAvatarId(null)
                            handleProfilePhotoSelected(event.target.files?.[0] ?? null)
                            event.currentTarget.value = ""
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => profilePhotoInputRef.current?.click()}
                          >
                            {profilePhotoFileName ? "Choose Another Image" : "Upload Image"}
                          </Button>
                        </div>

                        <div className="space-y-2 border-t border-border/60 pt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Default avatars
                          </p>
                          {defaultAvatarsLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                              <FluentLoadingIndicator className="size-3.5 animate-spin" />
                              Loading avatars…
                            </div>
                          ) : defaultAvatars.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No default avatars available yet.
                            </p>
                          ) : (
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                              {defaultAvatars.map((avatarRow) => {
                                const avatarId = readDefaultAvatarId(avatarRow)
                                const imageUrl = extractDefaultAvatarImageUrl(avatarRow)
                                const name =
                                  (typeof avatarRow.avatar_name === "string" && avatarRow.avatar_name) ||
                                  (typeof avatarRow.name === "string" && avatarRow.name) ||
                                  "Avatar"
                                const selected =
                                  selectedDefaultAvatarId != null &&
                                  avatarId != null &&
                                  String(selectedDefaultAvatarId) === String(avatarId)
                                return (
                                  <button
                                    key={String(avatarId ?? name)}
                                    type="button"
                                    title={name}
                                    onClick={() => void handleDefaultAvatarSelected(avatarRow)}
                                    className={cn(
                                      "relative overflow-hidden rounded-lg border bg-background p-1 transition-all hover:border-primary/50 hover:shadow-sm",
                                      selected && "border-primary ring-2 ring-primary/30"
                                    )}
                                  >
                                    <Avatar className="size-full aspect-square w-full rounded-md" size="lg">
                                      {imageUrl ? <AvatarImage src={imageUrl} alt={name} className="object-cover" /> : null}
                                      <AvatarFallback className="rounded-md text-[10px]">
                                        {name.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Input
                        type={
                          field === "password"
                            ? "password"
                            : field.includes("email")
                              ? "email"
                              : field.includes("phone")
                                ? "tel"
                                : "text"
                        }
                        value={sectionValues[field]}
                        placeholder={field === "password" ? "Leave blank to keep current password" : undefined}
                        required={Boolean(sectionEditor.requestType && isRequiredPersonalRecordField(field))}
                        onChange={(event) => handleSectionFieldChange(field, event.target.value)}
                      />
                    )}
                    {field === "profile_photo_url" ? (
                      <p className="text-xs text-muted-foreground">
                        Supported: common image formats like PNG and JPG, up to 5 MB.
                      </p>
                    ) : null}
                  </div>
                ))}
                {sectionError ? <p className="text-sm text-red-600">Request failed.</p> : null}
                {sectionErrorLines.length ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {sectionErrorLines.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSectionEditor(null)} disabled={sectionSaving}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSectionSave()}
                  disabled={
                    sectionSaving ||
                    (sectionEditor?.fields.length === 1 &&
                      sectionEditor.fields[0] === "profile_photo_url" &&
                      !selectedProfilePhotoFile &&
                      selectedDefaultAvatarId == null)
                  }
                >
                  {sectionSaving ? <FluentLoadingIndicator className="mr-1 size-4 animate-spin" /> : null}
                  {sectionEditor?.fields.length === 1 && sectionEditor.fields[0] === "profile_photo_url"
                    ? selectedDefaultAvatarId != null
                      ? "Apply Avatar"
                      : "Upload Picture"
                    : sectionEditor?.requestType
                      ? "Send to HR"
                      : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

    </div>
  )
}

export function EmployeeOrganizationView() {
  const { loading, error, employee } = useSelfEmployeeData()
  const branchRecords = [
    asRecord(employee?.primary_branch),
    asRecord(employee?.branch),
    ...(Array.isArray(employee?.departments) ? employee.departments.map((assignment) => {
      const record = asRecord(assignment)
      return asRecord(asRecord(record?.department)?.branch) ?? asRecord(record?.branch)
    }) : []),
  ]
  const workLocation = branchRecords
    .map((branch) => readString(branch, ["city", "address", "country"], ""))
    .find(Boolean) || readString(employee, ["work_location", "workLocation"], "")
  const manager = resolveManagerDisplay(employee)
  const supervisor = asRecord(employee?.supervisor)
  const supervisorName = manager.name !== "-" ? manager.name : (
    readString(supervisor, ["full_name", "name"], "") ||
    [readString(supervisor, ["first_name"], ""), readString(supervisor, ["last_name"], "")].filter(Boolean).join(" ") ||
    readString(supervisor, ["email"], "")
  )
  const status = employee ? readString(employee, ["employment_status", "status"]) : ""

  return (
    <section className={cn(pageBleedClass, "px-4 py-4 sm:px-5")} aria-labelledby="organization-details-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Building20Regular aria-hidden="true" className="shrink-0 text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 id="organization-details-title" className="text-base font-semibold text-foreground">My Organization Details</h1>
              {!loading && !error && employee && status ? (
                <FluentBadge
                  appearance="tint"
                  color={status.toLowerCase() === "active" ? "success" : "informative"}
                  icon={<PresenceBadge status={status.toLowerCase() === "active" ? "available" : "away"} />}
                  className="capitalize"
                  aria-label={`Employment status: ${status}`}
                >
                  {status}
                </FluentBadge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Your workplace, role, and reporting line</p>
          </div>
        </div>
        <FluentBadge appearance="outline" color="subtle">Read only</FluentBadge>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10" role="status">
          <FluentLoadingIndicator />
          <p className="text-sm text-muted-foreground">Loading organization details…</p>
        </div>
      ) : error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : employee ? (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Branch", value: resolveBranchNameFromEmployee(employee), icon: Building20Regular },
              { label: "Department", value: resolveDepartmentNameFromEmployee(employee), icon: PeopleTeam20Regular },
              { label: "Position", value: readString(asRecord(employee.primary_position), ["name", "position_name"], "") || readString(asRecord(employee.position), ["name", "position_name"], "") || readString(employee, ["position_name"], ""), icon: Briefcase20Regular },
              { label: "Date joined", value: formatDate(employee["hire_date"] ?? employee["joining_date"]), icon: Calendar20Regular },
              { label: "Supervisor", value: supervisorName, icon: Person20Regular },
              { label: "Work location", value: workLocation, icon: Location20Regular },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="border-t border-border pt-3">
                <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon aria-hidden="true" className="shrink-0 text-primary" />{label}</dt>
                <dd className="mt-2 break-words text-sm font-medium text-foreground">{value && value !== "-" && value !== "—" ? value : <span className="font-normal text-muted-foreground">Not provided</span>}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : <p className="mt-5 text-sm text-muted-foreground">Organization details are not available yet.</p>}
    </section>
  )
}

export function EmployeePromotionView() {
  const { loading, error, token, employee } = useSelfEmployeeData()
  const actor = useDashboardActor()
  const canRecordMovements =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/movements/cases", actor.permissionLabels, actor.accessMode)
  const [movementsLoading, setMovementsLoading] = React.useState(false)
  const [movementsError, setMovementsError] = React.useState<string | null>(null)
  const [movements, setMovements] = React.useState<AdminRecord[]>([])
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [selectedMovement, setSelectedMovement] = React.useState<AdminRecord | null>(null)
  const [acknowledgingId, setAcknowledgingId] = React.useState<number | null>(null)
  const [message, setMessage] = React.useState<string | null>(null)
  useFluentToastState(message, setMessage, "success")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "awaiting" | "applied">("all")

  const loadMovements = React.useCallback(async () => {
    if (!token) {
      setMovements([])
      return
    }

    setMovementsLoading(true)
    setMovementsError(null)
    try {
      const rows = await listMyMovements(token)
      setMovements(rows)
    } catch (errorObject) {
      setMovements([])
      setMovementsError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load your movement history."
      )
    } finally {
      setMovementsLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    if (!loading && token) {
      void loadMovements()
    }
  }, [loadMovements, loading, token])

  const openMovementDetail = React.useCallback(async (row: AdminRecord) => {
    const id = readMovementId(row)
    if (!token || id === null) {
      setSelectedMovement(row)
      setDetailOpen(true)
      return
    }

    setSelectedMovement(row)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const detail = await getMyMovement(token, id)
      if (detail) {
        setSelectedMovement(detail)
      }
    } catch (errorObject) {
      setMovementsError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load movement details."
      )
    } finally {
      setDetailLoading(false)
    }
  }, [token])

  const handleAcknowledgeMovement = React.useCallback(async (row: AdminRecord) => {
    const id = readMovementId(row)
    if (!token || id === null || !needsMovementAcknowledgement(row)) {
      return
    }

    setAcknowledgingId(id)
    setMessage(null)
    try {
      await acknowledgeMyMovement(token, id)
      const acknowledgedAt = new Date().toISOString()
      setMovements((current) =>
        current.map((entry) =>
          readMovementId(entry) === id
            ? { ...entry, employeeAcknowledgedAt: acknowledgedAt }
            : entry
        )
      )
      setSelectedMovement((current) =>
        current && readMovementId(current) === id
          ? { ...current, employeeAcknowledgedAt: acknowledgedAt }
          : current
      )
      setMessage("Movement acknowledged. HR can now see you have reviewed it.")
    } catch (errorObject) {
      setMovementsError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not acknowledge this movement."
      )
    } finally {
      setAcknowledgingId(null)
    }
  }, [token])

  const movementSummary = React.useMemo(() => {
    let awaitingAcknowledgement = 0
    let approvedOrApplied = 0
    for (const movement of movements) {
      if (needsMovementAcknowledgement(movement)) {
        awaitingAcknowledgement += 1
      }
      const status = readString(movement, ["status"], "").toLowerCase()
      if (status === "approved" || status === "applied") {
        approvedOrApplied += 1
      }
    }

    return {
      total: movements.length,
      awaitingAcknowledgement,
      approvedOrApplied,
    }
  }, [movements])

  const visibleMovements = React.useMemo(() => {
    return movements.filter((movement) => {
      if (statusFilter === "awaiting") return needsMovementAcknowledgement(movement)
      if (statusFilter === "applied") {
        const status = readString(movement, ["status"], "").toLowerCase()
        return status === "approved" || status === "applied"
      }
      return true
    })
  }, [movements, statusFilter])

  const employeeName = readString(employee, ["full_name", "name", "first_name"], "You")
  const detailChanges = Array.isArray(selectedMovement?.changes)
    ? selectedMovement?.changes.filter((entry): entry is AdminRecord => Boolean(asRecord(entry)))
    : []
  const detailStatus = readString(selectedMovement, ["status"], "")
  const detailStatusMeta = resolveMovementStatusMeta(detailStatus)
  const listLoading = loading || movementsLoading
  const employeeRecordMissing = [error, movementsError].some((value) => {
    const normalized = value?.toLowerCase() ?? ""
    return normalized.includes("employee profile") ||
      normalized.includes("no employee record") ||
      (normalized.includes("employee record") && /(not linked|not found|missing)/.test(normalized))
  })

  if (employeeRecordMissing) {
    return (
      <EmployeeProfileRequiredState
        description="Your promotions and transfers need to be linked to an employee record. Complete or update your profile, then return here to review movement history."
        returnLabel="My promotion"
        completionNote="Your movement history will appear after your employee record is available."
      />
    )
  }

  return (
    <section className="space-y-4">
      <HeroBand
        variant="dashboard"
        eyebrow="My movements"
        title="Promotions & movements"
        identityInline
        identity={(
          <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-sky-50 via-blue-50 to-violet-100 ring-1 ring-blue-100 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-violet-950/50 dark:ring-blue-900">
            <PeopleTeam20Color className="size-8" aria-hidden="true" />
          </div>
        )}
        description={
          canRecordMovements
            ? "Your own promotions and transfers. Record changes for other employees from Movement operations."
            : "Transfers, promotions, reporting-line changes, and other HR updates assigned to you."
        }
        actions={
          <button
            type="button"
            className={heroGhostButtonClass}
            onClick={() => void loadMovements()}
            disabled={listLoading || !token}
          >
            {listLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-3">
          {([
            { key: "all", label: "All", value: movementSummary.total, valueClass: "text-slate-800", activeClass: "bg-slate-50" },
            { key: "awaiting", label: "Awaiting you", value: movementSummary.awaitingAcknowledgement, valueClass: "text-amber-600", activeClass: "bg-amber-50/80" },
            { key: "applied", label: "Applied", value: movementSummary.approvedOrApplied, valueClass: "text-emerald-600", activeClass: "bg-emerald-50/80" },
          ] as const).map((item, index) => {
            const active = statusFilter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                aria-pressed={active}
                className={cn(
                  "relative min-w-0 px-3 py-2 text-left transition-colors",
                  active ? item.activeClass : "hover:bg-muted/40",
                )}
              >
                {index > 0 ? <span className="absolute top-2 bottom-2 left-0 w-px bg-border" aria-hidden /> : null}
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className={cn("mt-0.5 text-lg font-semibold tabular-nums leading-tight tracking-tight", item.valueClass)}>
                  {item.value}
                </p>
              </button>
            )
          })}
        </div>
      </div>
      {movementsError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {movementsError}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {listLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
            <FluentLoadingIndicator className="size-4 animate-spin" />
            Loading your movements…
          </div>
        ) : visibleMovements.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">
              {statusFilter === "awaiting"
                ? "Nothing waiting on you"
                : statusFilter === "applied"
                  ? "No applied movements"
                  : "No movements yet"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {statusFilter === "all"
                ? canRecordMovements
                  ? "Nothing on your own record yet. Create a promotion, transfer, or reporting change from Movement operations."
                  : "When HR records a promotion, transfer, or reporting change for you, it will show up here."
                : "Try All to see the rest of your movement history."}
            </p>
            {statusFilter === "all" && canRecordMovements ? (
              <Link
                href="/dashboard/movements/cases"
                className="mt-3 inline-flex h-8 items-center rounded-md bg-sky-50 px-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
              >
                Open movement operations
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {visibleMovements.map((movement) => {
              const id = readMovementId(movement) ?? 0
              const status = readString(movement, ["status"], "")
              const statusMeta = resolveMovementStatusMeta(status)
              const movementType = readMovementType(movement)
              const requiresAcknowledgement = needsMovementAcknowledgement(movement)
              const isAcknowledging = acknowledgingId === id
              const reason = readString(movement, ["reason"], "")
              const changeCount = Array.isArray(movement.changes) ? movement.changes.length : 0
              return (
                <div key={id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {readString(movement, ["title"], formatMovementLabel(movementType))}
                      </p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${movementStatusClass(status)}`}>
                        {statusMeta.label}
                      </span>
                      {requiresAcknowledgement ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Needs you
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {[
                        formatMovementLabel(movementType),
                        `Effective ${formatDate(movement.effectiveDate ?? movement.effective_date)}`,
                        changeCount ? `${changeCount} change${changeCount === 1 ? "" : "s"}` : "",
                      ].filter(Boolean).join(" · ")}
                    </p>
                    {reason && reason !== "-" ? (
                      <p className="mt-1 line-clamp-1 text-sm text-slate-600">{reason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {requiresAcknowledgement ? (
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        onClick={() => void handleAcknowledgeMovement(movement)}
                        disabled={isAcknowledging}
                      >
                        {isAcknowledging ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                        Acknowledge
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-md bg-sky-50 px-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
                      onClick={() => void openMovementDetail(movement)}
                    >
                      View
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailLoading(false)
        }}
      >
        <DialogPopup className="flex max-h-[min(90dvh,calc(100vh-1.5rem))] w-[calc(100%-1.5rem)] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {readString(selectedMovement, ["title"], formatMovementLabel(readMovementType(selectedMovement)))}
            </DialogTitle>
            <DialogDescription>
              {[
                readString(selectedMovement, ["movementNo", "movement_no"], ""),
                formatMovementLabel(readMovementType(selectedMovement)),
                formatDate(selectedMovement?.effectiveDate ?? selectedMovement?.effective_date),
              ].filter((part) => part && part !== "-").join(" · ")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {detailLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <FluentLoadingIndicator className="size-4 animate-spin" />
                Loading movement details…
              </div>
            ) : selectedMovement ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="text-slate-600">
                      Recorded by{" "}
                      <span className="font-medium text-slate-900">
                        {readString(asRecord(selectedMovement.requestedBy ?? selectedMovement.requested_by), ["full_name", "name", "email"], "HR")}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {[
                        readString(asRecord(selectedMovement.employee), ["full_name", "name"], employeeName),
                        formatDate(selectedMovement.submittedAt ?? selectedMovement.submitted_at ?? selectedMovement.createdAt ?? selectedMovement.created_at),
                      ].filter((part) => part && part !== "-").join(" · ")}
                    </p>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${movementStatusClass(detailStatus)}`}>
                    {detailStatusMeta.label}
                  </span>
                </div>
                {readString(selectedMovement, ["reason"], "") && readString(selectedMovement, ["reason"], "") !== "-" ? (
                  <p className="text-sm text-slate-600">{readString(selectedMovement, ["reason"])}</p>
                ) : null}
                {detailChanges.length ? (
                  <div className="space-y-4">
                    {detailChanges.map((change, index) => (
                      <div key={`${readMovementId(selectedMovement)}-change-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-baseline">
                        <p className="text-xs font-medium text-slate-500 sm:col-span-3">
                          {formatMovementLabel(readString(change, ["field", "field_name", "fieldName"], "Change"))}
                        </p>
                        <p className="min-w-0 break-words text-sm text-slate-500">
                          {stringifyMovementValue(change.oldValue ?? change.old_value)}
                        </p>
                        <ArrowRightIcon className="hidden size-4 text-slate-300 sm:block" />
                        <p className="min-w-0 break-words text-sm font-medium text-slate-900">
                          {stringifyMovementValue(change.newValue ?? change.new_value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No field changes were recorded.</p>
                )}
                {needsMovementAcknowledgement(selectedMovement) ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      onClick={() => void handleAcknowledgeMovement(selectedMovement)}
                      disabled={acknowledgingId === readMovementId(selectedMovement)}
                    >
                      {acknowledgingId === readMovementId(selectedMovement) ? (
                        <FluentLoadingIndicator className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Acknowledge
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}

export function EmployeePayrollView() {
  const { loading, error, token, employee } = useSelfEmployeeData()
  const [payslipsLoading, setPayslipsLoading] = React.useState(false)
  const [payslipsError, setPayslipsError] = React.useState<string | null>(null)
  const [payslips, setPayslips] = React.useState<AdminRecord[]>([])
  const [payrollSummaryDetails, setPayrollSummaryDetails] = React.useState<AdminRecord | null>(null)
  const [mounted, setMounted] = React.useState(false)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [selectedPayslip, setSelectedPayslip] = React.useState<AdminRecord | null>(null)
  const [downloadingId, setDownloadingId] = React.useState<number | null>(null)
  const [historyPage, setHistoryPage] = React.useState(1)
  const historyPageSize = 5

  const loadPayslips = React.useCallback(async () => {
    if (!token) {
      setPayslips([])
      setPayrollSummaryDetails(null)
      return
    }

    setPayslipsLoading(true)
    setPayslipsError(null)
    try {
      const [payslipResult, summaryResult] = await Promise.allSettled([
        listMyPayslips(token),
        getMyPayrollSummary(token, new Date().getFullYear()),
      ])
      if (payslipResult.status === "fulfilled") {
        setPayslips(payslipResult.value)
      } else {
        setPayslips([])
        throw payslipResult.reason
      }
      setPayrollSummaryDetails(
        summaryResult.status === "fulfilled" ? asRecord(summaryResult.value) : null
      )
    } catch (errorObject) {
      setPayslips([])
      setPayrollSummaryDetails(null)
      setPayslipsError(
        errorObject instanceof Error ? errorObject.message : "Could not load your payslips."
      )
    } finally {
      setPayslipsLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    setMounted(true)
    if (!loading && token) {
      void loadPayslips()
    }
  }, [loadPayslips, loading, token])

  const openPayslipDetail = React.useCallback(async (row: AdminRecord) => {
    const id = readPayslipId(row)
    if (!token || id === null) {
      setSelectedPayslip(row)
      setDetailOpen(true)
      return
    }

    setSelectedPayslip(row)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const detail = await getMyPayslip(token, id)
      if (detail) {
        setSelectedPayslip(detail)
      }
    } catch (errorObject) {
      setPayslipsError(
        errorObject instanceof Error ? errorObject.message : "Could not load payslip details."
      )
    } finally {
      setDetailLoading(false)
    }
  }, [token])

  const handleDownloadPayslip = React.useCallback(async (row: AdminRecord) => {
    const id = readPayslipId(row)
    if (!token || id === null) return

    setDownloadingId(id)
    try {
      const result = await downloadMyPayslip(token, id)
      downloadLocalBlob(result.blob, result.filename)
    } catch (errorObject) {
      setPayslipsError(
        errorObject instanceof Error ? errorObject.message : "Could not download the selected payslip."
      )
    } finally {
      setDownloadingId(null)
    }
  }, [token])

  const employeeName = readString(employee, ["full_name", "name", "first_name"], "You")
  const selectedCurrency = readPayslipCurrency(selectedPayslip)
  const earningsRows = readPayslipLineItems(selectedPayslip, ["earnings", "earning_lines", "earningLines"])
  const deductionRows = readPayslipLineItems(selectedPayslip, ["deductions", "deduction_lines", "deductionLines"])
  const ytdSummary = asRecord(payrollSummaryDetails?.ytd)
  const taxSummaryRows = asRecordArray(payrollSummaryDetails?.tax_summary)
  const pensionSummaryRows = asRecordArray(payrollSummaryDetails?.pension_summary)
  const salaryHistoryRows = asRecordArray(payrollSummaryDetails?.salary_history)
  const bankDetails = asRecord(payrollSummaryDetails?.bank_details)
  const summaryCurrency =
    readString(salaryHistoryRows[0] ?? null, ["currency"], "") ||
    readPayslipCurrency(payslips[0] ?? null)
  const taxTotal = taxSummaryRows.reduce(
    (sum, row) => sum + (readNumberish(row.amount) ?? 0),
    0,
  )
  const pensionTotal = pensionSummaryRows.reduce(
    (sum, row) => sum + (readNumberish(row.amount) ?? 0),
    0,
  )

  const listLoading = loading || payslipsLoading
  const latestPayslip = payslips[0] ?? null
  const latestPayslipId = latestPayslip ? readPayslipId(latestPayslip) : null
  const latestStatus = latestPayslip ? readPayslipStatus(latestPayslip) : ""
  const latestStatusKey = latestStatus.toLowerCase()
  const latestBadgeColor = latestStatusKey.includes("paid") || latestStatusKey.includes("publish")
    ? "success"
    : latestStatusKey.includes("pending") || latestStatusKey.includes("process")
      ? "warning"
      : "informative"

  const latestCurrency = readPayslipCurrency(latestPayslip)
  const latestGross = readNumberish(latestPayslip?.gross_pay ?? latestPayslip?.grossPay) ?? 0
  const latestNet = readNumberish(latestPayslip?.net_pay ?? latestPayslip?.netPay) ?? 0
  const latestTax = readNumberish(latestPayslip?.tax_amount ?? latestPayslip?.taxAmount) ?? 0
  const latestDeductions = readNumberish(
    latestPayslip?.total_deductions ?? latestPayslip?.totalDeductions,
  ) ?? Math.max(0, latestGross - latestNet)
  const otherDeductions = Math.max(0, latestDeductions - latestTax)
  const ytdGross = readNumberish(ytdSummary?.gross_pay) ?? 0
  const ytdNet = readNumberish(ytdSummary?.net_pay) ?? 0
  const ytdDeductions = readNumberish(ytdSummary?.deductions) ?? 0
  const ytdMaximum = Math.max(ytdGross, ytdNet + ytdDeductions, 1)
  const historyPageCount = Math.max(1, Math.ceil(payslips.length / historyPageSize))
  const visiblePayslips = payslips.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize,
  )
  const trendData = [...payslips].reverse().slice(-8).map((payslip) => ({
    period: readPayslipPeriodLabel(payslip),
    gross: readNumberish(payslip.gross_pay ?? payslip.grossPay) ?? 0,
    net: readNumberish(payslip.net_pay ?? payslip.netPay) ?? 0,
  }))

  React.useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPageCount))
  }, [historyPageCount])

  return (
    <section className="space-y-5 pb-8">
      <div className={pageBleedClass}>
      <FluentCard
        className={cn(
          "relative overflow-hidden !rounded-none !border-x-0 !border-y !border-border !bg-primary !p-0 shadow-sm",
        )}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-r from-primary via-primary to-primary/90">
          <div className="finance-hero-drift absolute -right-16 -top-24 size-80 rounded-full border-[42px] border-primary-foreground/[0.12]" />
          <div className="finance-hero-orbit absolute right-16 top-[calc(50%-4.5rem)] size-36 rounded-full border border-primary-foreground/15" />
          <div className="finance-hero-band absolute bottom-0 right-28 h-32 w-56 bg-primary-foreground/[0.08]" />
          <div className="finance-hero-line absolute left-[46%] top-5 h-24 w-px bg-primary-foreground/15" />
          <div className="finance-hero-dot absolute left-[49%] top-9 size-2 rounded-full bg-primary-foreground/25" />
          <div className="finance-hero-dot finance-hero-dot-delayed absolute left-[51%] top-16 size-1.5 rounded-full bg-primary-foreground/20" />
        </div>
        <header className="relative flex flex-wrap items-center justify-between gap-5 px-5 py-5 text-primary-foreground sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <PersonMoney20Regular className="size-9 shrink-0 text-primary-foreground/90" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-primary-foreground sm:text-2xl">My payroll</h1>
                <FluentBadge
                  appearance="ghost"
                  color={latestStatus ? latestBadgeColor : "warning"}
                  className="!gap-2 !rounded-none !px-1 !font-medium !text-primary-foreground"
                  icon={<span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current ring-[3px] ring-current/10" />}
                >
                  {latestStatus ? formatMovementLabel(latestStatus) : "Awaiting first payslip"}
                </FluentBadge>
              </div>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-primary-foreground/90">
                <span>Welcome back,</span>
                <span className="relative isolate inline-block break-words pb-1 text-xl font-semibold tracking-tight text-primary-foreground after:absolute after:inset-x-0 after:bottom-1 after:-z-10 after:h-2 after:-rotate-2 after:rounded-sm after:bg-primary-foreground/20 sm:text-2xl">
                  {employeeName}
                </span>
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-primary-foreground/90">
                <PayrollCalendarIcon />
                <span>Current period: {latestPayslip ? readPayslipPeriodLabel(latestPayslip) : "Not published yet"}</span>
              </div>
            </div>
          </div>
          <FluentButton
            appearance="subtle"
            size="large"
            className="!ml-auto !size-11 !min-w-11 !shrink-0 !text-primary-foreground hover:!bg-primary-foreground/10 disabled:!opacity-50 [&_svg]:!size-6"
            aria-label={mounted && listLoading ? "Refreshing payroll" : "Refresh payroll"}
            title="Refresh payroll"
            aria-busy={mounted && listLoading}
            icon={mounted && listLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <PayrollRefreshIcon />}
            disabled={mounted ? listLoading || !token : undefined}
            onClick={() => void loadPayslips()}
          />
        </header>
      </FluentCard>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Net take-home",
            value: latestPayslip ? formatPayslipMoney(latestNet, latestCurrency) : "—",
            detail: latestPayslip ? readPayslipPeriodLabel(latestPayslip) : "Latest published pay",
            icon: Savings20Regular,
            tone: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Gross earnings",
            value: latestPayslip ? formatPayslipMoney(latestGross, latestCurrency) : "—",
            detail: "Before deductions",
            icon: Money20Regular,
            tone: "text-primary",
          },
          {
            label: "Total deductions",
            value: latestPayslip ? formatPayslipMoney(latestDeductions, latestCurrency) : "—",
            detail: "Tax and other deductions",
            icon: ReceiptMoney20Regular,
            tone: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Tax withheld",
            value: latestPayslip ? formatPayslipMoney(latestTax, latestCurrency) : "—",
            detail: "Latest published period",
            icon: ShieldCheckmark20Regular,
            tone: "text-rose-600 dark:text-rose-400",
          },
        ].map((metric) => {
          const MetricIcon = metric.icon
          return (
            <FluentCard key={metric.label} className="relative isolate min-w-0 overflow-hidden !rounded-none !border-0 !border-b !border-r !border-border !gap-1 !px-5 !py-3 !shadow-none sm:!px-6">
              <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${metric.tone}`}>
                <div className="absolute -right-12 -top-16 size-56 rounded-full border-[28px] border-current opacity-[0.06]" />
                <div className="absolute right-6 top-8 size-28 rounded-full border border-current opacity-[0.12]" />
                <div className="absolute -bottom-10 right-20 h-40 w-20 rotate-[25deg] bg-current opacity-[0.035]" />
                <div className="absolute left-[55%] top-8 h-20 w-px rotate-[38deg] bg-current opacity-[0.12]" />
                <div className="absolute left-[58%] top-10 size-1.5 rounded-full bg-current opacity-[0.15]" />
                <div className="absolute left-[62%] top-16 size-1 rounded-full bg-current opacity-[0.12]" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <FluentText size={200} weight="semibold" className="!text-muted-foreground">
                  {metric.label}
                </FluentText>
                <MetricIcon className={`size-5 ${metric.tone}`} />
              </div>
              <FluentText size={500} weight="semibold" className="!my-0 !block !tracking-tight !text-foreground tabular-nums">
                {metric.value}
              </FluentText>
              <FluentText size={200} className="!mt-0 !block !text-muted-foreground">
                {metric.detail}
              </FluentText>
            </FluentCard>
          )
        })}
      </div>

      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {payslipsError ? (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {payslipsError}
        </div>
      ) : null}

      <div className="relative isolate grid items-start gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <FluentCard className="!gap-0 !rounded-none !border-0 !border-b !border-border !bg-transparent !p-5 !shadow-none">
            <div className="flex items-start gap-3">
              <ReceiptMoney20Regular className="mt-0.5 size-6 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">How your pay is calculated</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A transparent gross-to-net breakdown for your latest payslip.</p>
              </div>
            </div>
            <dl className="mt-4 divide-y divide-border text-sm">
              {[
                { label: "Gross earnings", value: latestGross, icon: Money20Regular },
                { label: "Tax", value: -latestTax, icon: ShieldCheckmark20Regular },
                { label: "Other deductions", value: -otherDeductions, icon: ReceiptMoney20Regular },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <dt className="flex items-center gap-3 text-muted-foreground"><Icon className="shrink-0 text-primary" />{label}</dt>
                  <dd className="font-medium tabular-nums">{latestPayslip ? formatPayslipMoney(value, latestCurrency) : "—"}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-4 text-primary">
                <dt className="flex items-center gap-3 font-semibold"><Savings20Regular />Net take-home</dt>
                <dd className="text-lg font-semibold tabular-nums">{latestPayslip ? formatPayslipMoney(latestNet, latestCurrency) : "—"}</dd>
              </div>
            </dl>
          </FluentCard>

          <FluentCard className="!gap-0 !rounded-none !border-0 !border-b !border-border !bg-transparent !p-5 !shadow-none">
            <div className="flex items-start gap-3">
              <History20Regular className="mt-0.5 size-6 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Pay trend</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Gross and net pay across your latest published periods.</p>
              </div>
            </div>
            {trendData.length > 0 ? (
              <div className="mt-4 h-64 w-full" aria-label="Historical gross and net pay chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} width={55} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatPayslipMoney(value, latestCurrency)} />
                    <Area type="monotone" dataKey="gross" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.08} strokeWidth={2} />
                    <Area type="monotone" dataKey="net" stroke="#107c10" fill="#107c10" fillOpacity={0.08} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <History20Regular aria-hidden="true" className="mb-1 size-10 text-primary/70" />
              <p className="text-sm font-semibold">Your pay journey starts here</p>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">Compare gross and take-home pay once your first payslip is published.</p>
            </div>}
          </FluentCard>

          <FluentCard className="overflow-hidden !gap-0 !rounded-none !border-0 !border-b !border-border !bg-transparent !p-0 !shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Earnings history</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{payslips.length} published {payslips.length === 1 ? "payslip" : "payslips"}</p>
          </div>
          <PayrollCalendarIcon className="size-6 text-primary" />
        </div>
        {listLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <FluentLoadingIndicator className="size-4 animate-spin" /> Loading your payslips…
          </div>
        ) : payslips.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <PayrollDocumentIcon aria-hidden="true" className="mx-auto mb-3 size-10 text-primary/70" />
            <p className="text-sm font-semibold text-foreground">No payslips published yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">When a payslip is published to your account, it will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <FluentTable className="min-w-[760px]">
              <FluentTableHeader><FluentTableRow><FluentTableHeaderCell>Pay period</FluentTableHeaderCell><FluentTableHeaderCell>Gross</FluentTableHeaderCell><FluentTableHeaderCell>Deductions</FluentTableHeaderCell><FluentTableHeaderCell>Net pay</FluentTableHeaderCell><FluentTableHeaderCell>Status</FluentTableHeaderCell><FluentTableHeaderCell>Actions</FluentTableHeaderCell></FluentTableRow></FluentTableHeader>
              <FluentTableBody>
            {visiblePayslips.map((payslip) => {
              const id = readPayslipId(payslip) ?? 0
              const currency = readPayslipCurrency(payslip)
              const status = readPayslipStatus(payslip)
              const statusKey = status.toLowerCase()
              const badgeColor = statusKey.includes("paid") || statusKey.includes("publish") ? "success" : statusKey.includes("pending") || statusKey.includes("process") ? "warning" : "informative"
              const isDownloading = downloadingId === id
              return (
                <FluentTableRow key={id}>
                  <FluentTableCell><div className="font-medium">{readPayslipPeriodLabel(payslip)}</div><div className="text-xs text-muted-foreground">{readString(payslip, ["payslip_number", "payslipNo", "payslip_no"], `Payslip #${id}`)}</div></FluentTableCell>
                  <FluentTableCell>{formatPayslipMoney(payslip.gross_pay ?? payslip.grossPay, currency)}</FluentTableCell>
                  <FluentTableCell>{formatPayslipMoney(payslip.total_deductions ?? payslip.totalDeductions ?? Math.max(0, (readNumberish(payslip.gross_pay ?? payslip.grossPay) ?? 0) - (readNumberish(payslip.net_pay ?? payslip.netPay) ?? 0)), currency)}</FluentTableCell>
                  <FluentTableCell><span className="font-semibold">{formatPayslipMoney(payslip.net_pay ?? payslip.netPay, currency)}</span></FluentTableCell>
                  <FluentTableCell><FluentBadge appearance="tint" color={badgeColor}>{status ? formatMovementLabel(status) : "Available"}</FluentBadge></FluentTableCell>
                  <FluentTableCell><div className="flex items-center gap-1">
                    <FluentButton appearance="subtle" icon={<PayrollDetailsIcon />} onClick={() => void openPayslipDetail(payslip)}>Details</FluentButton>
                    <FluentButton
                      appearance="secondary"
                      icon={isDownloading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <PayrollDownloadIcon />}
                      aria-label={`Download payslip for ${readPayslipPeriodLabel(payslip)}`}
                      disabled={isDownloading}
                      onClick={() => void handleDownloadPayslip(payslip)}
                    />
                  </div></FluentTableCell>
                </FluentTableRow>
              )
            })}
              </FluentTableBody>
            </FluentTable>
          </div>
        )}
        {payslips.length > historyPageSize ? <div className="flex items-center justify-between border-t border-border px-5 py-3"><span className="text-sm text-muted-foreground">Page {historyPage} of {historyPageCount}</span><div className="flex gap-2"><FluentButton appearance="subtle" disabled={historyPage === 1} onClick={() => setHistoryPage((page) => page - 1)}>Previous</FluentButton><FluentButton appearance="subtle" disabled={historyPage === historyPageCount} onClick={() => setHistoryPage((page) => page + 1)}>Next</FluentButton></div></div> : null}
          </FluentCard>
        </div>

        <aside className="relative flex flex-col gap-4 xl:sticky xl:top-4">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-5 -left-2 hidden w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent xl:block">
            <span className="absolute inset-y-[15%] -left-1 w-2 rounded-full bg-primary/10 blur-sm" />
            <span className="absolute left-1/2 top-12 size-1.5 -translate-x-1/2 rotate-45 bg-primary/50 ring-4 ring-background" />
          </div>
          <FluentCard className="!gap-0 !rounded-none !border-0 !border-b !border-border !bg-transparent !p-5 !shadow-none">
            <div className="flex items-start gap-3">
              <PayrollWalletIcon className="mt-0.5 size-6 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Quick actions</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your most-used payroll tasks.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <FluentButton className="!justify-start !px-3 !py-2.5" data-dashboard-action="true" appearance="primary" icon={latestPayslip && downloadingId === latestPayslipId ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <PayrollDownloadIcon />} disabled={!latestPayslip || downloadingId === latestPayslipId} onClick={() => latestPayslip && void handleDownloadPayslip(latestPayslip)}>Download latest payslip</FluentButton>
              <FluentButton as="a" href="/dashboard/me/profile?tab=records&section=bank_accounts" className="!justify-start !px-3 !py-2.5" data-dashboard-action="true" appearance="subtle" icon={<PayrollWalletIcon />}>Manage bank account</FluentButton>
              <FluentButton className="!justify-start !px-3 !py-2.5" data-dashboard-action="true" appearance="subtle" icon={<PayrollDocumentIcon />} disabled={!latestPayslip} onClick={() => latestPayslip && void openPayslipDetail(latestPayslip)}>View latest payslip</FluentButton>
            </div>
            <div className="mt-5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><BuildingBank20Regular />Bank</span><span className="font-medium text-right">{readString(bankDetails, ["bank_name"], "Not provided")}</span></div>
              <div className="mt-2 flex justify-between gap-3"><span className="text-muted-foreground">Account</span><span className="font-medium text-right">{readString(bankDetails, ["account_number_masked"], "—")}</span></div>
            </div>
          </FluentCard>

          <FluentCard className="!gap-0 !rounded-none !border-0 !border-b !border-border !bg-transparent !p-5 !shadow-none">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Savings20Regular className="size-6 text-primary" /><h2 className="text-sm font-semibold">Year-to-date summary</h2></div><FluentBadge appearance="tint" color="brand">{new Date().getFullYear()}</FluentBadge></div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Published payroll totals for the current year.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[["Gross pay", ytdGross, "brand"], ["Net pay", ytdNet, "success"], ["Deductions", ytdDeductions, "warning"], ["Tax paid", taxTotal, "error"], ["Pension", pensionTotal, "brand"]].map(([label, value, color]) => (
                <div key={String(label)} className="min-w-0 border-l-2 border-primary/25 py-1 pl-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="my-2 break-words text-base font-semibold tabular-nums">{formatPayslipMoney(value, summaryCurrency)}</p>
                  <ProgressBar value={Math.min(1, Number(value) / ytdMaximum)} color={color as "brand" | "success" | "warning" | "error"} thickness="medium" />
                </div>
              ))}
            </div>
          </FluentCard>
        </aside>
      </div>

      <FluentDialog
        open={detailOpen}
        onOpenChange={(_, data) => {
          setDetailOpen(data.open)
          if (!data.open) setDetailLoading(false)
        }}
      >
        <FluentDialogSurface className="!max-w-3xl">
          <FluentDialogBody>
            <FluentDialogTitle>
              {selectedPayslip ? readString(selectedPayslip, ["payslip_number", "payslipNo", "payslip_no"], "Payslip details") : "Payslip details"}
            </FluentDialogTitle>
            <FluentDialogContent className="space-y-4">
          {detailLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" /> Loading payslip details…
            </div>
          ) : selectedPayslip ? (
            <div className="space-y-4">
              <FluentCard className="rounded-xl border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <AssignmentField label="Period" value={readPayslipPeriodLabel(selectedPayslip)} />
                  <AssignmentField label="Status" value={<FluentBadge appearance="tint" color="informative">{readPayslipStatus(selectedPayslip) ? formatMovementLabel(readPayslipStatus(selectedPayslip)) : "Available"}</FluentBadge>} />
                  <AssignmentField label="Gross pay" value={formatPayslipMoney(selectedPayslip.gross_pay ?? selectedPayslip.grossPay, selectedCurrency)} />
                  <AssignmentField label="Net pay" value={formatPayslipMoney(selectedPayslip.net_pay ?? selectedPayslip.netPay, selectedCurrency)} />
                  <AssignmentField label="Tax" value={formatPayslipMoney(selectedPayslip.tax_amount ?? selectedPayslip.taxAmount, selectedCurrency)} />
                  <AssignmentField label="Deductions" value={formatPayslipMoney(selectedPayslip.total_deductions ?? selectedPayslip.totalDeductions, selectedCurrency)} />
                  <AssignmentField label="Employee" value={readString(asRecord(selectedPayslip.employee), ["full_name", "name"], employeeName)} />
                  <AssignmentField label="Payroll number" value={readString(selectedPayslip, ["payroll_number", "payrollNumber"], "—")} />
                  <AssignmentField label="Issued" value={formatDate(selectedPayslip.issued_at ?? selectedPayslip.issuedAt)} />
                </div>
              </FluentCard>
              {earningsRows.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Earnings</h3>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {earningsRows.map((line, index) => (
                      <div key={`earning-${index}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div><p className="text-sm font-medium">{readString(line, ["name", "component_name", "componentName", "code"], "Earning")}</p><p className="text-xs text-muted-foreground">{readString(line, ["description"], "Payroll earning line")}</p></div>
                        <span className="text-sm font-semibold tabular-nums">{formatPayslipMoney(line.amount ?? line.value, selectedCurrency)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {deductionRows.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Deductions</h3>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {deductionRows.map((line, index) => (
                      <div key={`deduction-${index}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div><p className="text-sm font-medium">{readString(line, ["name", "component_name", "componentName", "code"], "Deduction")}</p><p className="text-xs text-muted-foreground">{readString(line, ["description"], "Payroll deduction line")}</p></div>
                        <span className="text-sm font-semibold tabular-nums">{formatPayslipMoney(line.amount ?? line.value, selectedCurrency)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
            </FluentDialogContent>
          <FluentDialogActions>
            <FluentButton appearance="secondary" onClick={() => setDetailOpen(false)}>Close</FluentButton>
            {selectedPayslip ? (
              <FluentButton
                appearance="primary"
                icon={downloadingId === readPayslipId(selectedPayslip) ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <PayrollDownloadIcon />}
                onClick={() => void handleDownloadPayslip(selectedPayslip)}
                disabled={downloadingId === readPayslipId(selectedPayslip)}
              >
                Download payslip
              </FluentButton>
            ) : null}
          </FluentDialogActions>
          </FluentDialogBody>
        </FluentDialogSurface>
      </FluentDialog>
    </section>
  )
}

export function EmployeeSelfServiceLeaveView({ tab }: EmployeeSelfServiceLeaveViewProps) {
  type LeaveBalancesResponse = {
    rows: AdminRecord[]
    current_fiscal_year?: string
    totals?: Record<string, number>
  }

  const { loading: loadingProfile, error: profileError, token, employee } = useSelfEmployeeData()
  const searchParams = useSearchParams()
  const highlightedRequestId = React.useMemo(
    () =>
      searchParams?.get("highlight") ??
      searchParams?.get("requestId") ??
      searchParams?.get("request_id") ??
      "",
    [searchParams]
  )
  const [loading, setLoading] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [leaveTypesError, setLeaveTypesError] = React.useState<string | null>(null)
  const [balancesError, setBalancesError] = React.useState<string | null>(null)
  const [holidaysError, setHolidaysError] = React.useState<string | null>(null)
  const [policiesError, setPoliciesError] = React.useState<string | null>(null)
  const [leaveTypes, setLeaveTypes] = React.useState<AdminRecord[]>([])
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [balances, setBalances] = React.useState<AdminRecord[]>([])
  const [leaveBalancesFull, setLeaveBalancesFull] = React.useState<LeaveBalancesResponse | null>(null)
  const [holidays, setHolidays] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [message, setMessage] = React.useState<string | null>(null)
  useFluentToastState(message, setMessage, "success")
  const [actionErrorMessage, setActionErrorMessage] = React.useState<string | null>(null)
  useFluentToastState(actionErrorMessage, setActionErrorMessage, "error")
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [requestToCancel, setRequestToCancel] = React.useState<number | string | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")
  const [workflowDialogOpen, setWorkflowDialogOpen] = React.useState(false)
  const [workflowRequestId, setWorkflowRequestId] = React.useState<number | string | null>(null)
  const [workflowRequestRow, setWorkflowRequestRow] = React.useState<AdminRecord | null>(null)
  const [leaveRequestStatusFilter, setLeaveRequestStatusFilter] = React.useState<string | null>(null)
  const [holidayFilter, setHolidayFilter] = React.useState<"all" | "year" | "upcoming">("all")

  const [requestForm, setRequestForm] = React.useState({
    leave_type_id: "",
    duration_type: "FULL_DAY",
    start_date: "",
    end_date: "",
    half_day_session: "FIRST_HALF",
    start_time: "09:00",
    end_time: "13:00",
    reason: "",
  })
  const [leaveAttachmentFile, setLeaveAttachmentFile] = React.useState<File | null>(null)
  // Set while the dialog edits an existing draft or returned request.
  const [editingLeaveRequest, setEditingLeaveRequest] = React.useState<{
    id: number
    status: string
    returnReason: string
  } | null>(null)

  const employeeId = readNumber(employee, ["id", "employee_id"])
  const activeTab = tab

  const leaveRequestStatusCounts = React.useMemo(() => {
    const counts = {
      all: requests.length,
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    }
    for (const row of requests) {
      const meta = resolveLeaveStatusMeta(readString(row, ["status"], "pending"))
      if (meta.key === "draft") counts.draft += 1
      else if (meta.key === "pending" || meta.key === "returned") counts.pending += 1
      else if (meta.key === "approved") counts.approved += 1
      else if (meta.key === "rejected") counts.rejected += 1
      else if (meta.key === "cancelled") counts.cancelled += 1
    }
    return counts
  }, [requests])

  const filteredLeaveRequests = React.useMemo(() => {
    if (!leaveRequestStatusFilter) return requests
    return requests.filter((row) => {
      const meta = resolveLeaveStatusMeta(readString(row, ["status"], "pending"))
      return (
        meta.key === leaveRequestStatusFilter ||
        (leaveRequestStatusFilter === "pending" && meta.key === "returned")
      )
    })
  }, [leaveRequestStatusFilter, requests])

  const openLeaveWorkflowDialog = React.useCallback((id: number | string, row: AdminRecord | null) => {
    setWorkflowRequestId(id)
    setWorkflowRequestRow(row)
    setWorkflowDialogOpen(true)
  }, [])

  const availableLeaveTypes = React.useMemo(() => {
    const options = new Map<string, { id: string; label: string }>()
    // leaveTypes is already filtered to the employee's eligible types (gender), so
    // other sources may only relabel those, never add restricted types back.
    const eligibleIds = new Set(
      leaveTypes
        .map((row) => readNumberish(row.id ?? row.leave_type_id))
        .filter((id): id is number => id !== null)
        .map(String),
    )

    const addOption = (idValue: unknown, labelValue: unknown) => {
      const id = readNumberish(idValue)
      const label = typeof labelValue === "string" ? labelValue.trim() : ""
      if (id === null || !label) {
        return
      }
      if (eligibleIds.size > 0 && !eligibleIds.has(String(id))) {
        return
      }
      options.set(String(id), { id: String(id), label })
    }

    leaveTypes.forEach((row) => {
      addOption(row.id ?? row.leave_type_id, readString(row, ["name", "code"], ""))
    })

    balances.forEach((row) => {
      const leaveType = asRecord(row.leave_type)
      addOption(leaveType?.id ?? row.leave_type_id, readString(leaveType, ["name", "code"], ""))
    })

    requests.forEach((row) => {
      const leaveType = asRecord(row.leave_type)
      addOption(leaveType?.id ?? row.leave_type_id, readString(leaveType, ["name", "code"], ""))
    })

    policies.forEach((row) => {
      const policyTypes = Array.isArray(row.leave_types) ? row.leave_types : []
      policyTypes.forEach((entry) => {
        const policyType = asRecord(entry)
        const leaveType = asRecord(policyType?.leave_type)
        addOption(leaveType?.id ?? policyType?.leave_type_id, readString(leaveType, ["name", "code"], ""))
      })
    })

    return Array.from(options.values())
  }, [balances, leaveTypes, policies, requests])

  const leaveTypeLabelById = React.useMemo(() => {
    const labels = new Map<string, string>()

    leaveTypes.forEach((row) => {
      const id = readNumberish(row.id ?? row.leave_type_id)
      const label =
        readString(asRecord(row.leave_type), ["name", "display_name", "code"], "") ||
        readString(row, ["name", "display_name", "code"], "")

      if (id !== null && label) {
        labels.set(String(id), label)
      }
    })

    return labels
  }, [leaveTypes])

  const balanceTotals = React.useMemo(() => {
    const totals = leaveBalancesFull?.totals
    return [
      {
        label: "Allocated",
        value: readLeaveTotalsValue(totals, ["allocated_days", "allocated"]),
      },
      {
        label: "Used",
        value: readLeaveTotalsValue(totals, ["used_days", "used"]),
      },
      {
        label: "Pending",
        value: readLeaveTotalsValue(totals, ["pending_days", "pending"]),
      },
      {
        label: "Carried Forward",
        value: readLeaveTotalsValue(totals, ["carried_forward_days", "carried_forward"]),
      },
      {
        label: "Expired",
        value: readLeaveTotalsValue(totals, ["expired_days", "expired"]),
      },
      {
        label: "Available",
        value: readLeaveTotalsValue(totals, ["available_days", "available", "remaining_days", "remaining"]),
      },
    ]
  }, [leaveBalancesFull?.totals])

  const selectedLeaveTypeLabel = React.useMemo(() => {
    if (!requestForm.leave_type_id) {
      return ""
    }
    return availableLeaveTypes.find((item) => item.id === requestForm.leave_type_id)?.label ?? ""
  }, [availableLeaveTypes, requestForm.leave_type_id])

  const selectedLeaveTypeRecord = React.useMemo(
    () => leaveTypes.find((row) => String(row.id ?? row.leave_type_id ?? "") === requestForm.leave_type_id) ?? null,
    [leaveTypes, requestForm.leave_type_id],
  )
  const selectedLeaveTypeRequiresAttachment =
    selectedLeaveTypeRecord?.requires_attachment === true ||
    selectedLeaveTypeRecord?.requires_attachment === "true"

  const selectedLeaveBalance = React.useMemo(() => {
    if (!requestForm.leave_type_id) {
      return null
    }

    const selectedTypeId = readNumberish(requestForm.leave_type_id)
    if (selectedTypeId === null) {
      return null
    }

    const matchedRow =
      balances.find((row) => {
        const rowTypeId = readLeaveTypeId(asRecord(row))
        return rowTypeId !== null && rowTypeId === selectedTypeId
      }) ?? null

    if (!matchedRow) {
      return null
    }

    const availableDays = findBalanceAvailableDays(matchedRow)
    return {
      availableDays,
      formattedAvailable: formatLeaveBalanceValue(availableDays),
      fiscalYear: readString(matchedRow, ["fiscal_year"], ""),
    }
  }, [balances, requestForm.leave_type_id])

  const requestedLeaveDays = React.useMemo(() => {
    if (requestForm.duration_type === "HALF_DAY") return 0.5
    if (requestForm.duration_type === "SHORT_LEAVE") {
      const [startHour, startMinute] = requestForm.start_time.split(":").map(Number)
      const [endHour, endMinute] = requestForm.end_time.split(":").map(Number)
      const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute)
      return minutes > 0 ? Number((minutes / 480).toFixed(2)) : null
    }
    return countInclusiveLeaveDays(requestForm.start_date, requestForm.end_date)
  }, [requestForm.duration_type, requestForm.end_date, requestForm.end_time, requestForm.start_date, requestForm.start_time])

  const leaveSubmissionBalanceError = React.useMemo(
    () =>
      validateLeaveSubmissionBalance({
        availableDays: selectedLeaveBalance?.availableDays ?? null,
        requestedDays: requestedLeaveDays,
      }),
    [requestedLeaveDays, selectedLeaveBalance?.availableDays]
  )

  const readEndpointError = React.useCallback(
    (errorObject: unknown, fallbackMessage: string) => {
      const message = errorObject instanceof Error ? errorObject.message : fallbackMessage
      const status =
        typeof errorObject === "object" && errorObject !== null && "status" in errorObject
          ? (errorObject as { status?: number }).status
          : undefined

      if (status === 403) {
        return SELF_SERVICE_UNAVAILABLE_MESSAGE
      }

      if (/\/api\//.test(message)) {
        return fallbackMessage
      }

      return message
    },
    []
  )

  const loadData = React.useCallback(async () => {
    if (!token || employeeId === null) {
      return
    }

    setLoading(true)
    setError(null)
    setLeaveTypesError(null)
    setBalancesError(null)
    setHolidaysError(null)
    setPoliciesError(null)

    try {
      if (activeTab === "requests") {
        const [requestsResult, typesResult, balancesResult] = await Promise.allSettled([
          listMyLeaveRequests(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listLeaveTypes(token, { page: 1, limit: 100 }),
          listMyLeaveBalances(token, { page: 1, limit: 100 }),
        ])

        if (requestsResult.status === "fulfilled") {
          setRequests(requestsResult.value.rows)
        } else {
          setRequests([])
          setError(readEndpointError(requestsResult.reason, "Failed to load leave requests."))
        }

        if (typesResult.status === "fulfilled") {
          setLeaveTypes(typesResult.value.rows)
        } else {
          setLeaveTypes([])
          setLeaveTypesError(readEndpointError(typesResult.reason, "Failed to load leave types."))
        }

        if (balancesResult.status === "fulfilled") {
          setBalances(balancesResult.value.rows)
          setLeaveBalancesFull(balancesResult.value)
          setBalancesError(null)
        } else {
          setBalances([])
          setLeaveBalancesFull(null)
          setBalancesError(readEndpointError(balancesResult.reason, "Failed to load leave balances."))
        }
      }

      if (activeTab === "balances") {
        const [balancesResult, typesResult] = await Promise.allSettled([
          listMyLeaveBalances(token, { page: 1, limit: 100 }),
          listLeaveTypes(token, { page: 1, limit: 100 }),
        ])

        if (balancesResult.status === "fulfilled") {
          setBalances(balancesResult.value.rows)
          setLeaveBalancesFull(balancesResult.value)
        } else {
          throw balancesResult.reason
        }

        if (typesResult.status === "fulfilled") {
          setLeaveTypes(typesResult.value.rows)
          setLeaveTypesError(null)
        } else {
          setLeaveTypes([])
          setLeaveTypesError(readEndpointError(typesResult.reason, "Failed to load leave types."))
        }
      }

      if (activeTab === "holidays") {
        const holidaysResult = await listAttendanceHolidays(token, { page: 1, limit: 365 })
        setHolidays(holidaysResult.rows)
      }

      if (activeTab === "policies") {
        const policiesResult = await listLeavePolicies(token, { page: 1, limit: 100 })
        setPolicies(policiesResult.rows)
      }
    } catch (errorObject) {
      if (activeTab === "balances") {
        setBalances([])
        setLeaveBalancesFull(null)
        setBalancesError(readEndpointError(errorObject, "Failed to load leave balances."))
      } else if (activeTab === "holidays") {
        setHolidays([])
        setHolidaysError(readEndpointError(errorObject, "Failed to load holiday calendar."))
      } else if (activeTab === "policies") {
        setPolicies([])
        setPoliciesError(readEndpointError(errorObject, "Failed to load leave policies."))
      } else {
        setError(readEndpointError(errorObject, "Failed to load leave data."))
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, employeeId, readEndpointError, token])

  React.useEffect(() => {
    setMounted(true)
    void loadData()
  }, [loadData])

  const openedHighlightedRequestRef = React.useRef("")
  React.useEffect(() => {
    if (activeTab !== "requests" || !highlightedRequestId) {
      return
    }
    if (openedHighlightedRequestRef.current === highlightedRequestId) {
      return
    }

    const highlightedRow =
      requests.find((row) =>
        String(readNumber(row, ["id", "leave_request_id", "leaveRequestId"]) ?? "") ===
        highlightedRequestId
      ) ?? null

    openedHighlightedRequestRef.current = highlightedRequestId
    openLeaveWorkflowDialog(highlightedRequestId, highlightedRow ?? { id: highlightedRequestId })
  }, [activeTab, highlightedRequestId, openLeaveWorkflowDialog, requests])

  const onRequestLeave = React.useCallback(async (submit: boolean) => {
    if (!token || employeeId === null) {
      setActionErrorMessage("Your profile is not ready for leave requests.")
      return
    }

    if (!requestForm.leave_type_id || !requestForm.start_date || !requestForm.end_date) {
      setActionErrorMessage("Leave type and dates are required.")
      return
    }

    if (new Date(`${requestForm.start_date}T00:00:00`).getTime() > new Date(`${requestForm.end_date}T00:00:00`).getTime()) {
      setActionErrorMessage("Start date cannot be after end date.")
      return
    }

    if (submit && !requestForm.reason.trim()) {
      setActionErrorMessage("A reason is required before submitting the request.")
      return
    }

    if (submit && leaveSubmissionBalanceError) {
      setActionErrorMessage(leaveSubmissionBalanceError)
      return
    }
    if (submit && requiresEvidenceBeforeSubmission(selectedLeaveTypeRecord) && !leaveAttachmentFile) {
      setActionErrorMessage("This leave type requires a supporting attachment before submission.")
      return
    }

    if (availableLeaveTypes.length === 0) {
      setActionErrorMessage("Leave requests cannot be created until leave types are available to your account.")
      return
    }

    setLoading(true)
    setMessage(null)
    setActionErrorMessage(null)

    try {
      if (editingLeaveRequest) {
        const requestId = editingLeaveRequest.id
        await updateMyLeaveRequest(token, requestId, {
          leave_type_id: Number(requestForm.leave_type_id),
          duration_type: requestForm.duration_type,
          start_date: requestForm.start_date,
          end_date: requestForm.end_date,
          ...(requestForm.duration_type === "HALF_DAY" ? { half_day_session: requestForm.half_day_session } : {}),
          ...(requestForm.duration_type === "SHORT_LEAVE" ? { start_time: requestForm.start_time, end_time: requestForm.end_time } : {}),
          reason: requestForm.reason.trim() || "Draft",
        })
        if (leaveAttachmentFile) {
          await uploadMyLeaveRequestDocument(token, requestId, leaveAttachmentFile)
        }
        if (submit) {
          if (editingLeaveRequest.status === "returned_for_correction") {
            await resubmitMyLeaveRequest(token, requestId)
          } else {
            await submitMyLeaveRequest(token, requestId)
          }
        }
        setEditingLeaveRequest(null)
        setRequestForm({
          leave_type_id: "",
          duration_type: "FULL_DAY",
          start_date: "",
          end_date: "",
          half_day_session: "FIRST_HALF",
          start_time: "09:00",
          end_time: "13:00",
          reason: "",
        })
        setLeaveAttachmentFile(null)
        setMessage(submit ? "Leave request updated and sent for approval." : "Leave request changes saved.")
        setRequestDialogOpen(false)
        await loadData()
        return
      }

      // Create as draft only when explicitly requested. Submit sends submit:true so
      // the API creates the request in the approval workflow, not as a draft.
      const payload = await createMyLeaveRequest(token, {
        leave_type_id: Number(requestForm.leave_type_id),
        duration_type: requestForm.duration_type,
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        ...(requestForm.duration_type === "HALF_DAY" ? { half_day_session: requestForm.half_day_session } : {}),
        ...(requestForm.duration_type === "SHORT_LEAVE" ? { start_time: requestForm.start_time, end_time: requestForm.end_time } : {}),
        reason: requestForm.reason.trim() || (submit ? "" : "Draft"),
        submit: submit === true && !leaveAttachmentFile,
      })

      const created =
        asRecord(payload) ??
        asRecord(asRecord(payload)?.data) ??
        asRecord(asRecord(payload)?.result) ??
        asRecord(asRecord(payload)?.item)
      const createdId =
        readNumber(created, ["id", "leave_request_id", "leaveRequestId"]) ??
        readNumber(asRecord(created?.leave_request), ["id"]) ??
        readNumber(asRecord(created?.leaveRequest), ["id"])

      if (leaveAttachmentFile) {
        if (createdId === null) throw new Error("The leave request was created, but its ID was not returned, so the attachment could not be uploaded.")
        await uploadMyLeaveRequestDocument(token, createdId, leaveAttachmentFile)
        if (submit) await submitMyLeaveRequest(token, createdId)
      }

      // Some backends still create a draft even when submit:true — finish the flow.
      if (submit) {
        const createdStatus = readString(created, ["status"], "").toLowerCase()

        if (!leaveAttachmentFile && createdId !== null && (createdStatus === "draft" || createdStatus === "" || createdStatus === "-")) {
          await submitMyLeaveRequest(token, createdId)
        }

      }

      setRequestForm({
        leave_type_id: "",
        duration_type: "FULL_DAY",
        start_date: "",
        end_date: "",
        half_day_session: "FIRST_HALF",
        start_time: "09:00",
        end_time: "13:00",
        reason: "",
      })
      setLeaveAttachmentFile(null)
      setMessage(submit ? "Leave request submitted for approval." : "Leave request saved as a draft.")
      setRequestDialogOpen(false)
      await loadData()
    } catch (errorObject) {
      const text = submit
        ? formatLeaveRequestError(errorObject, selectedLeaveBalance?.availableDays ?? null)
        : errorObject instanceof Error
          ? errorObject.message
          : "Failed to save draft."
      setActionErrorMessage(text)
    } finally {
      setLoading(false)
    }
  }, [
    availableLeaveTypes.length,
    editingLeaveRequest,
    employeeId,
    leaveSubmissionBalanceError,
    loadData,
    requestForm,
    leaveAttachmentFile,
    selectedLeaveTypeRecord,
    selectedLeaveBalance?.availableDays,
    token,
  ])

  const onCancelRequest = async (id: number | string, reason: string = "Cancelled by user") => {
    if (!token) return
    setLoading(true)
    setMessage(null)
    setActionErrorMessage(null)
    try {
      await cancelMyLeaveRequest(token, id, reason)
      setMessage("Leave request cancelled.")
      await loadData()
    } catch (errorObject) {
      const text = errorObject instanceof Error ? errorObject.message : "Failed to cancel request."
      setActionErrorMessage(text)
    } finally {
      setLoading(false)
    }
  }

  const openEditLeaveRequest = (id: number, row: AdminRecord) => {
    const readDate = (value: unknown) => (typeof value === "string" ? value.slice(0, 10) : "")
    const readTime = (value: unknown, fallback: string) =>
      typeof value === "string" && value ? value.slice(0, 5) : fallback
    setEditingLeaveRequest({
      id,
      status: readString(row, ["status"], "draft").toLowerCase(),
      returnReason: readString(row, ["return_reason"], ""),
    })
    setRequestForm({
      leave_type_id: String(
        readNumber(row, ["leave_type_id"]) ?? readNumber(asRecord(row.leave_type), ["id"]) ?? ""
      ),
      duration_type: readString(row, ["duration_type"], "FULL_DAY"),
      start_date: readDate(row.start_date),
      end_date: readDate(row.end_date),
      half_day_session: readString(row, ["half_day_session"], "FIRST_HALF"),
      start_time: readTime(row.start_time, "09:00"),
      end_time: readTime(row.end_time, "13:00"),
      reason: readString(row, ["reason"], "") === "-" ? "" : readString(row, ["reason"], ""),
    })
    setLeaveAttachmentFile(null)
    setRequestDialogOpen(true)
  }

  const closeRequestDialog = (open: boolean) => {
    setRequestDialogOpen(open)
    if (!open && editingLeaveRequest) {
      setEditingLeaveRequest(null)
      setRequestForm({
        leave_type_id: "",
        duration_type: "FULL_DAY",
        start_date: "",
        end_date: "",
        half_day_session: "FIRST_HALF",
        start_time: "09:00",
        end_time: "13:00",
        reason: "",
      })
      setLeaveAttachmentFile(null)
    }
  }

  const openCancelDialog = (id: number | string) => {
    setRequestToCancel(id)
    setCancelReason("")
    setCancelDialogOpen(true)
  }

  const onConfirmCancelRequest = async () => {
    if (requestToCancel === null) {
      return
    }
    await onCancelRequest(requestToCancel, cancelReason.trim() || "Cancelled by user")
    setCancelDialogOpen(false)
    setRequestToCancel(null)
    setCancelReason("")
  }

  const onDownloadPdf = async (id: number | string) => {
    if (!token) return
    try {
      const result = await downloadMyLeaveRequestPdf(token, id)
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (errorObject) {
      const text = errorObject instanceof Error ? errorObject.message : "Failed to download PDF."
      setActionErrorMessage(text)
    }
  }

  const onSubmitRequest = async (id: number | string) => {
    if (!token) return
    const requestRow =
      requests.find((row) => String(readNumber(row, ["id", "leave_request_id", "leaveRequestId"]) ?? "") === String(id)) ??
      null
    const requestLeaveTypeId = readLeaveTypeId(requestRow)
    const requestBalanceRow =
      requestLeaveTypeId === null
        ? null
        : (balances.find((row) => readLeaveTypeId(row) === requestLeaveTypeId) ?? null)
    const availableDays = findBalanceAvailableDays(requestBalanceRow)
    const requestedDays = readRequestedLeaveDays(requestRow)
    const balanceError = validateLeaveSubmissionBalance({
      availableDays,
      requestedDays,
    })

    if (balanceError) {
      setActionErrorMessage(balanceError)
      return
    }

    setLoading(true)
    setMessage(null)
    setActionErrorMessage(null)
    try {
      await submitMyLeaveRequest(token, id)
      setMessage("Leave request submitted.")
      await loadData()
    } catch (errorObject) {
      const text = formatLeaveRequestError(errorObject, availableDays)
      setActionErrorMessage(text)
    } finally {
      setLoading(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <FluentLoadingIndicator size="large" />
        <p className="text-sm text-muted-foreground">Loading your profile...</p>
      </div>
    )
  }

  if (profileError) {
    if (profileError.toLowerCase().includes("employee profile")) {
      return (
        <EmployeeProfileRequiredState
          description="Leave requests and balances are connected to your employee profile. Complete the required details once, then return here to continue."
          returnLabel="My leave"
          completionNote="Your leave information will be available after your profile is ready."
        />
      )
    }
    return <div className="px-4 py-2 text-sm text-red-600">{profileError}</div>
  }

  if (employeeId === null) {
    return (
      <EmployeeProfileRequiredState
        description="Leave requests and balances are connected to your employee profile. Complete the required details once, then return here to continue."
        returnLabel="My leave"
        completionNote="Your leave information will be available after your profile is ready."
      />
    )
  }

  let tabContent: React.ReactNode = null
  if (activeTab === "requests") {
    const statusChips: Array<{
      key: string | null
      label: string
      value: number
    }> = [
      { key: null, label: "All", value: leaveRequestStatusCounts.all },
      { key: "pending", label: "Open", value: leaveRequestStatusCounts.pending },
      { key: "draft", label: "Draft", value: leaveRequestStatusCounts.draft },
      { key: "approved", label: "Approved", value: leaveRequestStatusCounts.approved },
      { key: "rejected", label: "Rejected", value: leaveRequestStatusCounts.rejected },
      { key: "cancelled", label: "Cancelled", value: leaveRequestStatusCounts.cancelled },
    ]

    tabContent = (
      <motion.section className="w-full min-w-0 max-w-full space-y-5" variants={profileTabStagger} initial="hidden" animate="show">
        <motion.header variants={profileTabItem} className="flex flex-col gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              <CalendarClock20Color className="size-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Leave requests</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Request time off and follow each request through approval.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FluentButton appearance="subtle" icon={<ArrowSync20Regular className={loading ? "animate-spin" : ""} />} onClick={() => void loadData()} disabled={loading}>Refresh</FluentButton>
            <FluentButton appearance="primary" icon={<CalendarClock20Color />} onClick={() => setRequestDialogOpen(true)}>New request</FluentButton>
          </div>
        </motion.header>

        <motion.div variants={profileTabItem} className="min-w-0 overflow-x-auto border-b border-border" role="presentation">
          <TabList
            aria-label="Filter leave requests by status"
            selectedValue={leaveRequestStatusFilter ?? "all"}
            onTabSelect={(_event, data) => setLeaveRequestStatusFilter(data.value === "all" ? null : String(data.value))}
            size="small"
            className="min-w-max"
          >
          {statusChips.map((chip) => {
            return (
              <Tab key={chip.label} value={chip.key ?? "all"} className="gap-2">
                {chip.label}<FluentBadge appearance="tint" color="informative" size="small">{chip.value}</FluentBadge>
              </Tab>
            )
          })}
          </TabList>
        </motion.div>

        {leaveRequestStatusFilter ? (
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Showing {filteredLeaveRequests.length} of {requests.length} requests</span>
            <FluentButton appearance="subtle" size="small" onClick={() => setLeaveRequestStatusFilter(null)}>Clear filter</FluentButton>
          </div>
        ) : null}

        {loading && requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
            <FluentLoadingIndicator size="large" />
            <p className="text-sm">Loading your leave requests…</p>
          </div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <motion.div variants={profileTabItem} className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
            <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              <CalendarClock20Color className="size-9" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold text-foreground">No leave requests yet</h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">When you need time off, create a request here. You can check its approval progress at any time.</p>
            <FluentButton appearance="primary" icon={<CalendarClock20Color />} onClick={() => setRequestDialogOpen(true)} className="mt-5">New request</FluentButton>
          </motion.div>
        ) : null}

        {!loading && requests.length > 0 && filteredLeaveRequests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">No requests match this status.</p>
            <FluentButton appearance="subtle" onClick={() => setLeaveRequestStatusFilter(null)}>Show all requests</FluentButton>
          </div>
        ) : null}

        {filteredLeaveRequests.length > 0 ? (
          <motion.div variants={profileTabItem} className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-foreground">Your requests</h3>
              <span className="text-sm text-muted-foreground">{filteredLeaveRequests.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <FluentTable aria-label="Your leave requests" size="small" className="w-full min-w-[560px]">
                <FluentTableHeader>
                  <FluentTableRow>
                    <FluentTableHeaderCell>Request</FluentTableHeaderCell>
                    <FluentTableHeaderCell>Dates</FluentTableHeaderCell>
                    <FluentTableHeaderCell>Status</FluentTableHeaderCell>
                    <FluentTableHeaderCell className="text-right">Actions</FluentTableHeaderCell>
                  </FluentTableRow>
                </FluentTableHeader>
                <FluentTableBody>
                  {filteredLeaveRequests.map((row, index) => {
              const id = readNumber(row, ["id"])
              const status = readString(row, ["status"], "pending").toLowerCase()
              // The API enforces policy cutoffs and start dates for approved leave.
              const canCancel = [
                "pending",
                "draft",
                "pending_department_manager",
                "pending_hr",
                "in_review",
                "returned_for_correction",
                "approved",
              ].includes(status)
              const canEdit = status === "draft" || status === "returned_for_correction"
              const statusMeta = resolveLeaveStatusMeta(status)
              const leaveType =
                readString(asRecord(row.leave_type), ["name", "display_name", "code"], "") ||
                readString(row, ["leave_type_name"], "Leave")
              const leaveNo = readString(row, ["leave_no", "request_no"], "")
              const reason = readString(row, ["reason"], "")
              const daysRaw =
                readString(row, ["days", "total_days", "number_of_days", "duration_days"], "") ||
                (readNumberish(row.days ?? row.total_days ?? row.number_of_days) !== null
                  ? String(readNumberish(row.days ?? row.total_days ?? row.number_of_days))
                  : "")
              const daysLabel = daysRaw && daysRaw !== "-" ? daysRaw : "—"
              const startLabel = formatDate(row.start_date)
              const endLabel = formatDate(row.end_date)
              const slipId =
                leaveNo && leaveNo !== "-"
                  ? leaveNo
                  : id !== null
                    ? `LR-${id}`
                    : `REQ-${index + 1}`
              const isHighlighted =
                highlightedRequestId &&
                (String(id) === String(highlightedRequestId) ||
                  String(leaveNo) === String(highlightedRequestId))

              return (
                <FluentTableRow key={String(row.id ?? index)} className={isHighlighted ? "bg-blue-50/70 dark:bg-blue-950/20" : undefined}>
                  <FluentTableCell>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{leaveType}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{slipId} · {daysLabel} {daysLabel === "1" ? "day" : "days"}</p>
                      {reason && reason !== "-" ? <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground" title={reason}>{reason}</p> : null}
                    </div>
                  </FluentTableCell>
                  <FluentTableCell>
                    <p className="font-medium text-foreground">{startLabel} – {endLabel}</p>
                    {statusMeta.helperText ? <p className="mt-0.5 text-xs text-muted-foreground">{statusMeta.helperText}</p> : null}
                  </FluentTableCell>
                  <FluentTableCell>
                    <FluentBadge appearance="tint" color={status === "approved" ? "success" : status === "rejected" ? "danger" : status === "cancelled" ? "subtle" : status === "pending" ? "warning" : "informative"}>{statusMeta.label}</FluentBadge>
                  </FluentTableCell>
                  <FluentTableCell>
                    <div className="flex justify-end gap-1">
                      {id ? <FluentButton appearance="subtle" size="small" icon={<Eye20Regular />} aria-label={`View workflow for ${slipId}`} title="View approval progress" disabled={loading} onClick={() => openLeaveWorkflowDialog(id, row)} /> : null}
                      {id ? <FluentButton appearance="subtle" size="small" icon={<DocumentPdf20Regular />} aria-label={`Download PDF for ${slipId}`} title="Download request PDF" disabled={loading} onClick={() => void onDownloadPdf(id)} /> : null}
                      {id && canEdit ? <FluentButton appearance={status === "returned_for_correction" ? "primary" : "subtle"} size="small" icon={<Edit20Regular />} disabled={loading} onClick={() => openEditLeaveRequest(id, row)}>{status === "returned_for_correction" ? "Edit & resubmit" : "Edit"}</FluentButton> : null}
                      {id && status === "draft" ? <FluentButton appearance="primary" size="small" icon={<Send20Regular />} disabled={loading} onClick={() => void onSubmitRequest(id)}>Submit</FluentButton> : null}
                      {id && canCancel ? <FluentButton appearance="subtle" size="small" icon={<Dismiss20Regular />} aria-label={status === "draft" ? `Discard ${slipId}` : `Cancel ${slipId}`} title={status === "draft" ? "Discard draft" : "Cancel request"} disabled={loading} onClick={() => openCancelDialog(id)} /> : null}
                    </div>
                  </FluentTableCell>
                </FluentTableRow>
              )
                  })}
                </FluentTableBody>
              </FluentTable>
            </div>
          </motion.div>
        ) : null}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </motion.section>
    )
  }
  if (activeTab === "balances") {
    const fiscalYear = leaveBalancesFull?.current_fiscal_year || "2026"
    const showBalancesError = balancesError && balancesError !== SELF_SERVICE_UNAVAILABLE_MESSAGE
    const balanceMetrics = [
      { key: "allocated", label: "Total allowance", value: balanceTotals[0]?.value, hint: "Days granted" },
      { key: "used", label: "Used", value: balanceTotals[1]?.value, hint: "Days taken" },
      { key: "pending", label: "Awaiting approval", value: balanceTotals[2]?.value, hint: "Requested days" },
      { key: "carried", label: "Carried over", value: balanceTotals[3]?.value, hint: "From last year" },
      { key: "expired", label: "Expired", value: balanceTotals[4]?.value, hint: "No longer available" },
      { key: "available", label: "Available to use", value: balanceTotals[5]?.value, hint: "Remaining days" },
    ]
    tabContent = (
      <section className="w-full min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/70 pb-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Your leave balance</h2>
            <p className="text-sm text-muted-foreground">A clear view of your allowance, leave taken, and days still available.</p>
          </div>
          <FluentBadge appearance="outline" color="informative">Fiscal year {fiscalYear}</FluentBadge>
        </div>
        {loading ? (
          <div className="flex min-h-24 items-center justify-center gap-3 py-4">
            <FluentLoadingIndicator size="large" />
            <p className="text-sm text-muted-foreground">Loading your leave balances…</p>
          </div>
        ) : null}
        {!loading && balances.length === 0 ? (
          <FluentCard appearance="outline" className="flex min-h-56 flex-col items-center justify-center gap-2 p-8 text-center">
            <CalendarClock20Color className="size-12" />
            <FluentText weight="semibold">No leave balance yet</FluentText>
            <FluentText className="max-w-lg text-muted-foreground">
              Your leave allowance will appear here once it has been set up for this fiscal year. Contact your HR team if you think a balance is missing.
            </FluentText>
          </FluentCard>
        ) : null}
        {balances.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {balanceMetrics.map((item) => (
            <FluentCard key={item.key} appearance="outline" className={`!min-h-0 min-w-0 p-3 ${item.key === "available" ? "border-primary/40 bg-primary/5" : ""}`}>
              <div className="flex flex-col items-start gap-2">
                <FluentText size={200} weight="semibold" className="uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </FluentText>
                <FluentText size={400} weight="semibold" className={item.key === "available" ? "text-primary" : "text-foreground"}>
                  {formatDayValue(item.value)} <span className="text-xs font-normal text-muted-foreground">days</span>
                </FluentText>
                <FluentText size={200} className="text-muted-foreground">{item.hint}</FluentText>
              </div>
            </FluentCard>
          ))}
        </div> : null}
        {balances.length > 0 ? <LeaveAccrualProjectionCard token={token} /> : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {balances.map((row, index) => (
            <FluentCard key={String(row.id ?? index)} appearance="outline" className="min-w-0 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <FluentText weight="semibold" className="truncate">
                  {(() => {
                    const nestedLeaveType = asRecord(row.leave_type)
                    const nestedLabel =
                      readString(nestedLeaveType, ["name", "display_name", "code"], "") ||
                      readString(row, ["leave_type_name", "leave_type_code"], "")

                    if (nestedLabel) {
                      return nestedLabel
                    }

                    const leaveTypeId = readNumberish(row.leave_type_id ?? nestedLeaveType?.id)
                    if (leaveTypeId !== null) {
                      return leaveTypeLabelById.get(String(leaveTypeId)) ?? `Leave type #${leaveTypeId}`
                    }

                    return "Leave type"
                  })()}
                  </FluentText>
                  <FluentText size={200} className="text-muted-foreground">Fiscal year {readString(row, ["fiscal_year"], fiscalYear)}</FluentText>
                </div>
                <FluentBadge appearance="outline" color="informative">Leave</FluentBadge>
              </div>
              <div className="mt-4 divide-y divide-border/70">
                {[
                  { label: "Allowance", value: row.allocated_days },
                  { label: "Used", value: row.used_days },
                  { label: "Awaiting approval", value: row.pending_days },
                  { label: "Carried over", value: row.carried_forward_days },
                  { label: "Expired", value: row.expired_days },
                  { label: "Available", value: row.available_days ?? row.remaining_days },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <FluentText size={300} className="text-muted-foreground">{item.label}</FluentText>
                    <FluentText size={300} weight={item.label === "Available" ? "semibold" : "regular"} className={item.label === "Available" ? "text-primary" : "text-foreground"}>
                      {formatDayValue(item.value)} days
                    </FluentText>
                  </div>
                ))}
              </div>
            </FluentCard>
          ))}
        </div>
        {showBalancesError ? <p className="text-sm text-slate-500">{balancesError}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    )
  }

  if (activeTab === "holidays") {
    const showHolidaysError = holidaysError && holidaysError !== SELF_SERVICE_UNAVAILABLE_MESSAGE
    const todayStamp = new Date().toISOString().slice(0, 10)
    const thisYear = String(new Date().getFullYear())
    const sortedHolidays = [...holidays].sort((left, right) => {
      const leftDate = readString(left, ["holiday_date", "from_date", "start_date", "date"], "")
      const rightDate = readString(right, ["holiday_date", "from_date", "start_date", "date"], "")
      return leftDate.localeCompare(rightDate)
    })
    const holidayDateOf = (row: AdminRecord) =>
      readString(row, ["holiday_date", "from_date", "start_date", "date"], "")
    const thisYearCount = sortedHolidays.filter((row) => holidayDateOf(row).startsWith(thisYear)).length
    const upcomingCount = sortedHolidays.filter((row) => holidayDateOf(row) >= todayStamp).length
    const visibleHolidays = sortedHolidays.filter((row) => {
      const date = holidayDateOf(row)
      if (holidayFilter === "year") return date.startsWith(thisYear)
      if (holidayFilter === "upcoming") return date >= todayStamp
      return true
    })
    tabContent = (
      <section className="w-full min-w-0 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <CalendarClock20Color className="size-9 shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-lg font-semibold leading-6 text-foreground">Holiday calendar</h2>
              <p className="text-sm leading-5 text-muted-foreground">Company holidays published for your team this year.</p>
            </div>
          </div>
          <FluentButton
            appearance="secondary"
            icon={<ArrowSync20Regular className={loading ? "animate-spin" : ""} />}
            onClick={() => void loadData()}
            disabled={mounted ? loading : undefined}
          >
            Refresh
          </FluentButton>
        </header>
        {showHolidaysError ? (
          <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {holidaysError}
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { key: "year" as const, label: "This year", value: thisYearCount, detail: "Published for this year" },
            { key: "upcoming" as const, label: "Coming up", value: upcomingCount, detail: "Today and future dates" },
            { key: "all" as const, label: "All listed", value: sortedHolidays.length, detail: "Company holidays" },
          ].map((item) => (
            <FluentButton
              key={item.key}
              appearance="outline"
              aria-pressed={holidayFilter === item.key}
              onClick={() => setHolidayFilter(item.key)}
              className={`!h-auto !w-full !justify-start !whitespace-normal !p-3 text-left ${holidayFilter === item.key ? "border-primary bg-primary/5" : ""}`}
            >
              <div className="flex w-full items-center justify-between gap-3 text-left">
                <div className="flex flex-col gap-1">
                  <FluentText size={200} weight="semibold" className="uppercase tracking-wide text-muted-foreground">{item.label}</FluentText>
                  <FluentText size={400} weight="semibold">{loading ? "…" : item.value}</FluentText>
                  <FluentText size={200} className="text-muted-foreground">{item.detail}</FluentText>
                </div>
                <PayrollCalendarIcon className="size-5 text-primary" />
              </div>
            </FluentButton>
          ))}
        </div>
        <section aria-label="Company holidays" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FluentText size={400} weight="semibold">Holiday dates</FluentText>
            <FluentText size={200} className="text-muted-foreground">Showing {visibleHolidays.length} of {sortedHolidays.length}</FluentText>
          </div>
          {loading && sortedHolidays.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center gap-3 text-sm text-muted-foreground">
              <FluentLoadingIndicator size="large" />
              Loading holidays…
            </div>
          ) : sortedHolidays.length === 0 ? (
            <FluentCard appearance="outline" className="flex min-h-44 flex-col items-center justify-center gap-2 p-6 text-center">
              <CalendarClock20Color className="size-10" />
              <FluentText weight="semibold">No holidays published</FluentText>
              <FluentText size={300} className="text-muted-foreground">
              No company holidays have been published yet.
              </FluentText>
            </FluentCard>
          ) : visibleHolidays.length === 0 ? (
            <FluentCard appearance="outline" className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
              <FluentText weight="semibold">No holidays match this filter</FluentText>
              <FluentButton appearance="subtle" onClick={() => setHolidayFilter("all")}>Show all holidays</FluentButton>
            </FluentCard>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleHolidays.map((row, index) => {
                const holidayStart =
                  readString(row, ["holiday_date", "from_date", "start_date", "date"], "") || "-"
                const holidayEnd = readString(row, ["to_date", "end_date"], "")
                const holidayType = readString(row, ["type", "holiday_type", "category"], "")
                const holidayBranch = readString(asRecord(row.branch), ["name", "branch_name"], "")
                const holidayDescription = readString(row, ["description", "notes", "remarks"], "")
                const dateLabel =
                  holidayEnd && holidayEnd !== holidayStart && holidayEnd !== "-"
                    ? `${formatDate(holidayStart)} – ${formatDate(holidayEnd)}`
                    : formatDate(holidayStart)

                return (
                  <FluentCard
                    key={String(row.id ?? index)}
                    appearance="outline"
                    className="min-w-0 p-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <CalendarClock20Color className="mt-0.5 size-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <FluentText weight="semibold" className="min-w-0">{readString(row, ["name", "title"], "Holiday")}</FluentText>
                          {holidayType ? (
                            <span className={`text-xs font-semibold uppercase tracking-wide ${holidayType.toLowerCase() === "religious" ? "text-violet-700 dark:text-violet-300" : "text-primary"}`}>
                              {holidayType}
                            </span>
                          ) : null}
                        </div>
                        <FluentText size={300} className="mt-1 block text-muted-foreground">{dateLabel}</FluentText>
                        {[holidayBranch, holidayDescription].filter((value) => value && value !== "-").length > 0 ? (
                          <FluentText size={200} className="mt-1 block text-muted-foreground">
                            {[holidayBranch, holidayDescription].filter((value) => value && value !== "-").join(" · ")}
                          </FluentText>
                        ) : null}
                      </div>
                    </div>
                  </FluentCard>
                )
              })}
            </div>
          )}
        </section>
      </section>
    )
  }

  if (activeTab === "policies") {
    const showPoliciesError = policiesError && policiesError !== SELF_SERVICE_UNAVAILABLE_MESSAGE
    tabContent = (
      <section className="w-full min-w-0 space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Leave Policies</h2>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <FluentLoadingIndicator size="large" />
            <p className="text-sm text-muted-foreground">Loading policies...</p>
          </div>
        ) : null}
        {!loading && policies.length === 0 ? <p className="text-sm text-slate-500">No leave policies found.</p> : null}
        <div className="space-y-2">
          {policies.map((row, index) => (
            <div key={String(row.id ?? index)} className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ backgroundColor: 'var(--primary)' }}>
              <Doodle name="doodle-circles" />
              <div className="relative z-10">
                <p className="font-medium">{readString(row, ["name"], "Policy")}</p>
                <p className="text-white/80">Status: {readString(row, ["status"], "-")}</p>
                <p className="text-white/80">Accrual: {readString(row, ["accrual_method"], "-")}</p>
              </div>
            </div>
          ))}
        </div>
        {showPoliciesError ? <p className="text-sm text-slate-500">{policiesError}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <DoodleSprites />
      <div className="flex-1 min-h-0 relative">
        {tabContent}
      </div>
      <FluentDialog open={requestDialogOpen} onOpenChange={(_event, data) => closeRequestDialog(data.open)}>
        <FluentDialogSurface className="w-[min(680px,96vw)]">
          <FluentDialogBody className="min-h-0">
            <FluentDialogTitle action={
              <FluentButton appearance="subtle" aria-label="Close leave request" icon={<Dismiss20Regular />} onClick={() => closeRequestDialog(false)} />
            }>{editingLeaveRequest ? "Edit leave request" : "Request leave"}</FluentDialogTitle>
            <FluentText as="p" size={300} className="text-muted-foreground">
              {editingLeaveRequest?.status === "returned_for_correction"
                ? "Your approver returned this request. Update it and resubmit for approval."
                : editingLeaveRequest
                  ? "Update your draft, then save it or submit it for approval."
                  : "Choose the leave type and dates. Submit for approval now, or save a draft to finish later."}
            </FluentText>
            {editingLeaveRequest?.returnReason && editingLeaveRequest.returnReason !== "-" ? (
              <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">
                <span className="font-medium">Reason returned:</span> {editingLeaveRequest.returnReason}
              </div>
            ) : null}
            <FluentDialogContent className="grid max-h-[65vh] min-h-0 gap-4 overflow-y-auto py-4 pr-1">
            <FluentField label="Leave type">
              <FluentDropdown
                placeholder={availableLeaveTypes.length > 0 ? "Select leave type" : "No leave types available"}
                selectedOptions={requestForm.leave_type_id ? [requestForm.leave_type_id] : []}
                value={selectedLeaveTypeLabel}
                onOptionSelect={(_event, data) => setRequestForm((prev) => ({ ...prev, leave_type_id: data.optionValue ?? "" }))}
              >
                {availableLeaveTypes.map((row) => <FluentOption key={row.id} value={row.id}>{row.label}</FluentOption>)}
              </FluentDropdown>
            </FluentField>
            <div className="space-y-1">
              {availableLeaveTypes.length === 0 && leaveTypesError ? <p className="text-xs text-slate-500">{leaveTypesError}</p> : null}
              {selectedLeaveBalance?.formattedAvailable ? (
                <p className={cn(
                  "text-xs",
                  selectedLeaveBalance.availableDays !== null && selectedLeaveBalance.availableDays < 0
                    ? "text-rose-600"
                    : "text-muted-foreground"
                )}>
                  Available balance: {selectedLeaveBalance.formattedAvailable} day(s)
                  {selectedLeaveBalance.fiscalYear ? ` for ${selectedLeaveBalance.fiscalYear}` : ""}
                  {selectedLeaveBalance.availableDays !== null && selectedLeaveBalance.availableDays < 0
                    ? ". This leave type is already overdrawn, so submission may be blocked until HR adjusts the balance."
                    : ""}
                </p>
              ) : null}
              {selectedLeaveTypeRequiresAttachment ? (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{requiresEvidenceBeforeSubmission(selectedLeaveTypeRecord) ? "A supporting attachment is required before submission." : `You can submit now and upload evidence within ${selectedLeaveTypeRecord?.attachment_grace_days ?? 3} calendar days after submission.`}</p>
              ) : null}
              {requestedLeaveDays !== null && requestForm.start_date && requestForm.end_date ? (
                <p className="text-xs text-muted-foreground">
                  Requested duration: {requestedLeaveDays.toFixed(2)} day(s)
                </p>
              ) : null}
              {leaveSubmissionBalanceError ? (
                <p className="text-xs text-rose-600">{leaveSubmissionBalanceError}</p>
              ) : null}
            </div>
            <FluentField label="Duration">
              <FluentDropdown
                selectedOptions={[requestForm.duration_type]}
                value={requestForm.duration_type === "HALF_DAY" ? "Half day" : requestForm.duration_type === "SHORT_LEAVE" ? "Short leave by hours" : "Full day or multiple days"}
                onOptionSelect={(_event, data) => {
                  const value = data.optionValue ?? "FULL_DAY"
                  setRequestForm((prev) => ({ ...prev, duration_type: value as typeof prev.duration_type, ...(value !== "FULL_DAY" && prev.start_date ? { end_date: prev.start_date } : {}) }))
                }}
              >
                <FluentOption value="FULL_DAY">Full day or multiple days</FluentOption>
                <FluentOption value="HALF_DAY">Half day</FluentOption>
                <FluentOption value="SHORT_LEAVE">Short leave by hours</FluentOption>
              </FluentDropdown>
            </FluentField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FluentField label="Start date"><DatePickerPresets value={requestForm.start_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, start_date: value, ...(prev.duration_type === "FULL_DAY" ? {} : { end_date: value }) }))} placeholder="Select start date" className="max-w-none" /></FluentField>
              <FluentField label="End date"><DatePickerPresets value={requestForm.end_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, end_date: value, ...(prev.duration_type === "FULL_DAY" ? {} : { start_date: value }) }))} placeholder="Select end date" className="max-w-none" /></FluentField>
            </div>
            {requestForm.duration_type === "HALF_DAY" ? (
              <FluentField label="Half-day session" hint="Half-day leave uses the same start and end date.">
                <FluentDropdown selectedOptions={[requestForm.half_day_session]} value={requestForm.half_day_session === "SECOND_HALF" ? "Second half" : "First half"} onOptionSelect={(_event, data) => setRequestForm((prev) => ({ ...prev, half_day_session: (data.optionValue ?? "FIRST_HALF") as typeof prev.half_day_session }))}>
                  <FluentOption value="FIRST_HALF">First half</FluentOption><FluentOption value="SECOND_HALF">Second half</FluentOption>
                </FluentDropdown>
              </FluentField>
            ) : null}
            {requestForm.duration_type === "SHORT_LEAVE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <FluentField label="Start time"><FluentInput type="time" value={requestForm.start_time} onChange={(event) => setRequestForm((prev) => ({ ...prev, start_time: event.target.value }))} /></FluentField>
                <FluentField label="End time"><FluentInput type="time" value={requestForm.end_time} onChange={(event) => setRequestForm((prev) => ({ ...prev, end_time: event.target.value }))} /></FluentField>
                <p className="text-xs text-muted-foreground sm:col-span-2">Short leave uses one date. The server calculates the balance deduction from the configured working-day length.</p>
              </div>
            ) : null}
            <FluentField label={`Supporting attachment ${selectedLeaveTypeRequiresAttachment ? (requiresEvidenceBeforeSubmission(selectedLeaveTypeRecord) ? "(required to submit)" : "(can be uploaded later)") : "(optional)"}`} hint={leaveAttachmentFile ? `Selected: ${leaveAttachmentFile.name}` : undefined}>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-3 file:py-1.5" onChange={(event) => setLeaveAttachmentFile(event.target.files?.[0] ?? null)} />
            </FluentField>
            <FluentField label="Reason" hint={requestForm.reason.trim() ? undefined : "Required to submit"}>
              <FluentTextarea
                resize="vertical"
                rows={4}
                placeholder="Why are you taking leave?"
                value={requestForm.reason}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </FluentField>
            </FluentDialogContent>
            <FluentDialogActions position="end">
              <FluentButton appearance="secondary" onClick={() => closeRequestDialog(false)}>Close</FluentButton>
              <FluentButton appearance="secondary" icon={<Save20Regular />} onClick={() => void onRequestLeave(false)} disabled={loading || availableLeaveTypes.length === 0}>{loading ? "Saving…" : editingLeaveRequest ? "Save changes" : "Save draft"}</FluentButton>
              <FluentButton appearance="primary" icon={<Send20Regular />} onClick={() => void onRequestLeave(true)} disabled={loading || availableLeaveTypes.length === 0 || Boolean(leaveSubmissionBalanceError)}>{loading ? "Submitting…" : editingLeaveRequest?.status === "returned_for_correction" ? "Save & resubmit" : "Submit request"}</FluentButton>
            </FluentDialogActions>
          </FluentDialogBody>
        </FluentDialogSurface>
      </FluentDialog>
      <LeaveWorkflowDialog
        open={workflowDialogOpen}
        onOpenChange={(open) => {
          setWorkflowDialogOpen(open)
          if (!open) {
            setWorkflowRequestId(null)
            setWorkflowRequestRow(null)
          }
        }}
        token={token}
        requestId={workflowRequestId}
        fallbackRow={workflowRequestRow}
      />

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel Leave Request</DialogTitle>
            <DialogDescription>Provide a short reason for cancelling this leave request.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea
              id="cancel-reason"
              className="min-h-24"
              maxLength={2000}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false)
                setRequestToCancel(null)
                setCancelReason("")
              }}
            >
              Close
            </Button>
            <Button type="button" variant="destructive" onClick={() => void onConfirmCancelRequest()} disabled={loading}>
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
