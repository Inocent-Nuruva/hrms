"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { motion } from "framer-motion"
import {
  Button as FluentButton,
  Card as FluentCard,
  CardFooter as FluentCardFooter,
  makeStyles,
  Persona,
  Tab,
  TabList,
  Text as FluentText,
} from "@fluentui/react-components"
import {
  Briefcase20Color,
  Building20Color,
  CalendarClock20Color,
  CalendarSync20Color,
  Camera20Color,
  ContactCard20Color,
  Edit16Regular,
  PeopleTeam20Color,
  Person20Color,
  PersonKey20Color,
} from "@fluentui/react-icons"
import {
  ArrowLeft, ArrowRightIcon, CheckCircle2, BriefcaseIcon, Building2Icon, CalendarIcon, ClockIcon, DownloadIcon, FileTextIcon, PencilIcon, RefreshCwIcon, UserIcon, UsersIcon } from "lucide-react";
import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import { CompactStatStrip, HeroBand, TalentDoodleSprites, heroGhostButtonClass, heroPanelClass, pageBleedClass } from "@/components/dashboard/talent-visuals"

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
  createMyProfileUpdateRequest,
  getMyProfileUpdateRequest,
  listMyProfileUpdateRequests,
  listMyTeamAttendance,
  submitMyProfileUpdateRequest,
  cancelMyLeaveRequest,
  downloadMyLeaveRequestPdf,
  getMyLeaveRequest,
  getMyPayslip,
  getMyPayrollSummary,
  submitMyLeaveRequest,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { OvertimeRequestsPanel } from "@/components/dashboard/overtime-requests-panel"
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

  if (["pending", "submitted", "in_review", "under_review"].includes(normalized)) {
    return {
      key: "pending" as const,
      label: raw.replace(/_/g, " ") || "Pending",
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

function resolvePayslipStatusTone(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (["generated", "sent", "paid", "published", "available"].includes(normalized)) {
    return "success" as const
  }
  if (["pending", "queued", "processing", "draft"].includes(normalized)) {
    return "amber" as const
  }
  if (["failed", "cancelled", "rejected"].includes(normalized)) {
    return "primary" as const
  }
  return "muted" as const
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium leading-tight text-foreground">{value}</span>
    </div>
  )
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

type SectionEditorState = {
  key: string
  title: string
  fields: EditableUserField[]
}

function getEditableFieldLabel(field: EditableUserField) {
  if (field === "profile_photo_url") {
    return "Profile picture"
  }
  return field.replaceAll("_", " ")
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

function ProfileEmptyRow({ message }: { message: string }) {
  return <div className="px-3 py-4 text-sm text-muted-foreground">{message}</div>
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

function SelfServiceProfileSectionTabs({
  sections,
}: {
  sections: Array<{
    id: string
    title: string
    count: number
    content: React.ReactNode
  }>
}) {
  const [activeId, setActiveId] = React.useState(sections[0]?.id ?? "")
  const active = sections.find((section) => section.id === activeId) ?? sections[0]

  React.useEffect(() => {
    if (!sections.some((section) => section.id === activeId) && sections[0]) {
      setActiveId(sections[0].id)
    }
  }, [activeId, sections])

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
    <FluentCard appearance="outline" size="small" className="!flex-col !items-stretch !gap-5 !rounded-none !border-border/70 !bg-card !p-4 shadow-sm sm:!p-5">
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

function ProfilePersonalTab({ employee }: { employee: AdminRecord }) {
  const contacts = asRecordList(employee.contacts)
  const addresses = asRecordList(employee.addresses)
  const relatives = asRecordList(employee.relatives)

  return (
    <FluentCard appearance="outline" size="small" className="!flex-col !items-stretch !gap-5 !rounded-none !border-border/70 !bg-card !p-4 shadow-sm sm:!p-5">
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
                    <ProfileEmptyRow message="No contacts available." />
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
                    <ProfileEmptyRow message="No addresses available." />
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
                    <ProfileEmptyRow message="No relatives available." />
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
}: {
  employee: AdminRecord | null
  correctionRequests: AdminRecord[]
  teamAttendance: AdminRecord[]
}) {
  const identifications = asRecordList(employee?.identifications)
  const bankAccounts = asRecordList(employee?.bank_accounts)
  const academic = asRecordList(employee?.academic_qualifications)
  const professional = asRecordList(employee?.professional_qualifications)
  const experience = asRecordList(employee?.experience_details)
  const documents = asRecordList(employee?.documents)

  const pendingCorrections = correctionRequests.filter((row) => {
    const status = readString(row, ["status"], "").toLowerCase()
    return status && !status.includes("cancel") && !status.includes("reject") && status !== "approved"
  }).length

  return (
    <FluentCard appearance="outline" size="small" className="!flex-col !items-stretch !gap-5 !rounded-none !border-border/70 !bg-card !p-4 shadow-sm sm:!p-5">
    <motion.div className="space-y-4" variants={profileTabStagger} initial="hidden" animate="show">
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
        <motion.div variants={profileTabItem}>
          <SelfServiceProfileSectionTabs
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
                            { label: "Currency", value: readString(record, ["currency"], "—") },
                          ]}
                        />
                      ))
                    ) : (
                      <ProfileEmptyRow message="No bank accounts available." />
                    )}
                  </SelfServiceSectionCard>
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
  onSubmitRequest: (id: number | string) => Promise<void>
  onCancelRequest: (id: number | string) => Promise<void>
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
    {
      key: "password",
      title: "Password",
      description: "Update sign-in password",
      fields: ["password"] as EditableUserField[],
      label: "Password",
      icon: PersonKey20Color,
    },
  ]

  return (
    <FluentCard appearance="outline" size="small" className="!flex-col !items-stretch !gap-5 !rounded-none !border-border/70 !bg-card !p-4 shadow-sm sm:!p-5">
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
                            onClick={() => void onSubmitRequest(requestId)}
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
                            onClick={() => void onCancelRequest(requestId)}
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
      <div className="divide-y divide-border overflow-hidden border border-border">
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
        className="w-full min-w-0 !gap-0 !rounded-none !border-border/70 !bg-card !p-4 shadow-sm sm:!p-5"
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
              onClick={() => openSectionEditor("password", "Password", ["password"])}
            >
              Change Password
            </FluentButton>
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
    }),
    [currentUser, employee, myProfilePhotoUrl]
  )

  const openSectionEditor = React.useCallback(
    (key: string, title: string, fields: EditableUserField[]) => {
      setSectionError(null)
      setSectionErrorLines([])
      setProfilePhotoPreviewUrl("")
      setProfilePhotoFileName("")
      setSelectedProfilePhotoFile(null)
      setSelectedDefaultAvatarId(null)
      setSectionValues(baseEditorValues)
      setSectionEditor({ key, title, fields })
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
      const apiField = field === "phone" ? "phone_number" : field
      requestedChanges[apiField] = nextValue
    }
    if (!Object.keys(requestedChanges).length) {
      setSectionError("Nothing to update for this section.")
      setSectionErrorLines([])
      return
    }
    setSectionSaving(true)
    setSectionError(null)
    setSectionErrorLines([])
    try {
      const requestPayload: AdminRecord = {
        requested_changes: requestedChanges,
        reason: `Requested changes to ${sectionEditor.title.toLowerCase()}.`,
      }

      const createdRequest = asRecord(await createMyProfileUpdateRequest(token, requestPayload))
      const requestId = readProfileUpdateRequestId(createdRequest)
      if (requestId !== null) {
        try {
          const submittedRequest = await submitMyProfileUpdateRequest(token, requestId)
          void notifySubmittedRequestApprovers({
            kind: "profile_update_request",
            token,
            request: submittedRequest ?? createdRequest,
            loadRequest: () => getMyProfileUpdateRequest(token, requestId),
          })
          setMessage(`${sectionEditor.title} update submitted for HR approval.`)
        } catch (errorObject) {
          const status =
            typeof errorObject === "object" && errorObject !== null && "status" in errorObject
              ? Number((errorObject as { status?: number }).status)
              : null
          if (status === 404) {
            setMessage(`${sectionEditor.title} update saved as a draft. Submit it from Update Requests.`)
          } else {
            throw errorObject
          }
        }
      } else {
        setMessage(`${sectionEditor.title} update saved as a draft.`)
      }
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
    profilePhotoFileName,
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

  const handleSubmitProfileUpdateRequest = React.useCallback(async (id: number | string) => {
    if (!token) {
      setMessage("Session expired. Please sign in again.")
      return
    }

    setSectionSaving(true)
    setMessage(null)
    try {
      const request = await submitMyProfileUpdateRequest(token, id)
      void notifySubmittedRequestApprovers({
        kind: "profile_update_request",
        token,
        request: asRecord(request) ?? {},
        loadRequest: () => getMyProfileUpdateRequest(token, id),
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

  const handleCancelProfileUpdateRequest = React.useCallback(async (id: number | string) => {
    if (!token) {
      setMessage("Session expired. Please sign in again.")
      return
    }

    setSectionSaving(true)
    setMessage(null)
    try {
      await cancelMyProfileUpdateRequest(token, id)
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
            <ProfilePersonalTab employee={employee} />
          ) : null}

          {activeTab === "records" ? (
            <ProfileRecordsTab
              employee={employee}
              correctionRequests={correctionRequests}
              teamAttendance={teamAttendance}
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
                <DialogTitle>{sectionEditor ? `Edit ${sectionEditor.title}` : "Edit Section"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                {sectionEditor?.fields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">{getEditableFieldLabel(field)}</Label>
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
                        type={field === "password" ? "password" : "text"}
                        value={sectionValues[field]}
                        placeholder={field === "password" ? "Leave blank to keep current password" : undefined}
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

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>My Organization Details</CardTitle>
          <CardDescription>Read-only information about your branch, department, and role context.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <FluentLoadingIndicator size="large" />
              <p className="text-sm text-muted-foreground">Loading organization details...</p>
            </div>
          ) : null}
          {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && employee ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <InfoRow label="Branch" value={readString(asRecord(employee.branch), ["name", "branch_name"])} />
                <InfoRow label="Department" value={readString(asRecord(employee.department), ["name", "department_name"])} />
                <InfoRow label="Position" value={readString(asRecord(employee.position), ["name", "position_name"])} />
              </div>
              <div>
                <InfoRow label="Employment Status" value={readString(employee, ["employment_status", "status"])} />
                <InfoRow label="Date Joined" value={formatDate(employee["hire_date"] ?? employee["joining_date"])} />
                <InfoRow label="Supervisor" value={readString(asRecord(employee.supervisor), ["full_name", "name", "email"])} />
                <InfoRow label="Work Location" value={readString(asRecord(employee.branch), ["city", "address", "country"])} />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
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

  return (
    <section className="space-y-4">
      <HeroBand
        eyebrow="My movements"
        title="Promotions & movements"
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
        getMyPayrollSummary(token),
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

  const payslipSummary = React.useMemo(() => {
    const latest = payslips[0] ?? null
    const currency = readPayslipCurrency(latest)
    return {
      total: payslips.length,
      latestNet: latest ? formatPayslipMoney(latest.net_pay ?? latest.netPay, currency) : "—",
      latestGross: latest ? formatPayslipMoney(latest.gross_pay ?? latest.grossPay, currency) : "—",
    }
  }, [payslips])

  const employeeName = readString(employee, ["full_name", "name", "first_name"], "You")
  const selectedCurrency = readPayslipCurrency(selectedPayslip)
  const earningsRows = readPayslipLineItems(selectedPayslip, ["earnings", "earning_lines", "earningLines"])
  const deductionRows = readPayslipLineItems(selectedPayslip, ["deductions", "deduction_lines", "deductionLines"])
  const ytdSummary = asRecord(payrollSummaryDetails?.ytd)
  const taxSummaryRows = asRecordArray(payrollSummaryDetails?.tax_summary)
  const pensionSummaryRows = asRecordArray(payrollSummaryDetails?.pension_summary)
  const salaryHistoryRows = asRecordArray(payrollSummaryDetails?.salary_history)
  const payrollDocuments = asRecordArray(payrollSummaryDetails?.payroll_documents)
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

  return (
    <section className="space-y-4">
      <HeroBand
        eyebrow="My finance"
        title="Payroll"
        description="Payslips issued to you, with period totals, a detailed breakdown, and download."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void loadPayslips()}
            disabled={mounted ? listLoading || !token : undefined}
          >
            {mounted && listLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      <OvertimeRequestsPanel token={token} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <CompactStatStrip
        items={[
          { label: "Payslips", value: String(payslipSummary.total) },
          { label: "Latest gross", value: payslipSummary.latestGross },
          { label: "Latest net", value: payslipSummary.latestNet },
        ]}
      />
      {payrollSummaryDetails ? (
        <div className="grid gap-3 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">YTD pay</CardTitle>
              <CardDescription>
                {String(readNumber(payrollSummaryDetails, ["year"]) ?? new Date().getFullYear())}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <AssignmentField label="Gross" value={formatPayslipMoney(ytdSummary?.gross_pay, summaryCurrency)} />
              <AssignmentField label="Taxable" value={formatPayslipMoney(ytdSummary?.taxable_pay, summaryCurrency)} />
              <AssignmentField label="Deductions" value={formatPayslipMoney(ytdSummary?.deductions, summaryCurrency)} />
              <AssignmentField label="Net" value={formatPayslipMoney(ytdSummary?.net_pay, summaryCurrency)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tax and pension</CardTitle>
              <CardDescription>Current year totals</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <AssignmentField label="Tax" value={formatPayslipMoney(taxTotal, summaryCurrency)} />
              <AssignmentField label="Pension" value={formatPayslipMoney(pensionTotal, summaryCurrency)} />
              <AssignmentField label="Tax rows" value={String(taxSummaryRows.length)} />
              <AssignmentField label="Pension rows" value={String(pensionSummaryRows.length)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bank payroll</CardTitle>
              <CardDescription>Payment destination</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <AssignmentField label="Bank" value={readString(bankDetails, ["bank_name"], "—")} />
              <AssignmentField label="Branch" value={readString(bankDetails, ["bank_branch_code"], "—")} />
              <AssignmentField label="Account" value={readString(bankDetails, ["account_number_masked"], "—")} />
              <AssignmentField label="Status" value={readString(bankDetails, ["verification_status"], "—")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>Published payroll files</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <AssignmentField label="Payslips" value={String(payrollDocuments.length)} />
              <AssignmentField label="Salary records" value={String(salaryHistoryRows.length)} />
              <AssignmentField
                label="Latest salary"
                value={formatPayslipMoney(salaryHistoryRows[0]?.base_salary, readString(salaryHistoryRows[0] ?? null, ["currency"], summaryCurrency))}
              />
              <AssignmentField label="Effective" value={formatDate(salaryHistoryRows[0]?.effective_from)} />
            </CardContent>
          </Card>
        </div>
      ) : null}
      {salaryHistoryRows.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Salary history</CardTitle>
            <CardDescription>Compensation changes used by payroll.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/70 p-0">
            {salaryHistoryRows.slice(0, 5).map((row, index) => (
              <div key={`salary-history-${readString(row, ["id"], String(index))}`} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-4">
                <span className="font-medium text-foreground">
                  {formatPayslipMoney(row.base_salary, readString(row, ["currency"], summaryCurrency))}
                </span>
                <span className="text-muted-foreground">{readString(row, ["pay_frequency"], "—")}</span>
                <span className="text-muted-foreground">{formatDate(row.effective_from)}</span>
                <span className="text-muted-foreground">{readString(row, ["status"], "—")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {payslipsError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {payslipsError}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {listLoading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
            <FluentLoadingIndicator className="size-4 animate-spin" />
            Loading your payslips...
          </div>
        ) : payslips.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No payslips have been published to your account yet.
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {payslips.map((payslip) => {
              const id = readPayslipId(payslip) ?? 0
              const currency = readPayslipCurrency(payslip)
              const status = readPayslipStatus(payslip)
              const statusTone = resolvePayslipStatusTone(status)
              const isDownloading = downloadingId === id

              return (
                <div key={id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {readString(payslip, ["payslip_number", "payslipNo", "payslip_no"], `Payslip #${id}`)}
                      </p>
                      <AssignmentBadge tone={statusTone}>
                        {status && status !== "-" ? formatMovementLabel(status) : "Available"}
                      </AssignmentBadge>
                    </div>
                    <p className="text-sm text-muted-foreground">{readPayslipPeriodLabel(payslip)}</p>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="size-3.5" />
                        <span>
                          Issued {formatDate(payslip.issued_at ?? payslip.issuedAt ?? payslip.created_at ?? payslip.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BriefcaseIcon className="size-3.5" />
                        <span>Gross {formatPayslipMoney(payslip.gross_pay ?? payslip.grossPay, currency)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UsersIcon className="size-3.5" />
                        <span>Net {formatPayslipMoney(payslip.net_pay ?? payslip.netPay, currency)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileTextIcon className="size-3.5" />
                        <span>{currency || "Currency pending"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void openPayslipDetail(payslip)}>
                      Details
                    </Button>
                    <Button type="button" onClick={() => void handleDownloadPayslip(payslip)} disabled={isDownloading}>
                      {isDownloading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <DownloadIcon className="size-4" />}
                      Download
                    </Button>
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
              if (!open) {
                setDetailLoading(false)
              }
            }}
          >
            <DialogPopup className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedPayslip
                    ? readString(selectedPayslip, ["payslip_number", "payslipNo", "payslip_no"], "Payslip details")
                    : "Payslip details"}
                </DialogTitle>
                <DialogDescription>
                  Review payroll totals, issue dates, and any earnings or deduction rows returned by the backend.
                </DialogDescription>
              </DialogHeader>

              {detailLoading ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                  Loading payslip details...
                </div>
              ) : selectedPayslip ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Card>
                      <CardContent className="grid gap-3 p-4">
                        <AssignmentField label="Period" value={readPayslipPeriodLabel(selectedPayslip)} />
                        <AssignmentField label="Status" value={<AssignmentBadge tone={resolvePayslipStatusTone(readPayslipStatus(selectedPayslip))}>{readPayslipStatus(selectedPayslip) ? formatMovementLabel(readPayslipStatus(selectedPayslip)) : "Available"}</AssignmentBadge>} />
                        <AssignmentField label="Gross Pay" value={formatPayslipMoney(selectedPayslip.gross_pay ?? selectedPayslip.grossPay, selectedCurrency)} />
                        <AssignmentField label="Net Pay" value={formatPayslipMoney(selectedPayslip.net_pay ?? selectedPayslip.netPay, selectedCurrency)} />
                        <AssignmentField label="Tax" value={formatPayslipMoney(selectedPayslip.tax_amount ?? selectedPayslip.taxAmount, selectedCurrency)} />
                        <AssignmentField label="Deductions" value={formatPayslipMoney(selectedPayslip.total_deductions ?? selectedPayslip.totalDeductions, selectedCurrency)} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="grid gap-3 p-4">
                        <AssignmentField label="Employee" value={readString(asRecord(selectedPayslip.employee), ["full_name", "name"], employeeName)} />
                        <AssignmentField label="Payroll No" value={readString(selectedPayslip, ["payroll_number", "payrollNumber"], "—")} />
                        <AssignmentField label="Currency" value={selectedCurrency || "—"} />
                        <AssignmentField label="Issued At" value={formatDate(selectedPayslip.issued_at ?? selectedPayslip.issuedAt)} />
                        <AssignmentField label="Created At" value={formatDate(selectedPayslip.created_at ?? selectedPayslip.createdAt)} />
                        <AssignmentField label="Updated At" value={formatDate(selectedPayslip.updated_at ?? selectedPayslip.updatedAt)} />
                      </CardContent>
                    </Card>
                  </div>

                  {earningsRows.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Earnings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {earningsRows.map((line, index) => (
                          <div key={`earning-${index}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {readString(line, ["name", "component_name", "componentName", "code"], "Earning")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {readString(line, ["description"], "Payroll earning line")}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {formatPayslipMoney(line.amount ?? line.value, selectedCurrency)}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  {deductionRows.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Deductions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {deductionRows.map((line, index) => (
                          <div key={`deduction-${index}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {readString(line, ["name", "component_name", "componentName", "code"], "Deduction")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {readString(line, ["description"], "Payroll deduction line")}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {formatPayslipMoney(line.amount ?? line.value, selectedCurrency)}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
                {selectedPayslip ? (
                  <Button
                    type="button"
                    onClick={() => void handleDownloadPayslip(selectedPayslip)}
                    disabled={downloadingId === readPayslipId(selectedPayslip)}
                  >
                    {downloadingId === readPayslipId(selectedPayslip) ? (
                      <FluentLoadingIndicator className="size-4 animate-spin" />
                    ) : (
                      <DownloadIcon className="size-4" />
                    )}
                    Download payslip
                  </Button>
                ) : null}
              </DialogFooter>
            </DialogPopup>
          </Dialog>
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
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false)
  const [requestToCancel, setRequestToCancel] = React.useState<number | string | null>(null)
  const [cancelReason, setCancelReason] = React.useState("")
  const [workflowDialogOpen, setWorkflowDialogOpen] = React.useState(false)
  const [workflowRequestId, setWorkflowRequestId] = React.useState<number | string | null>(null)
  const [workflowRequestRow, setWorkflowRequestRow] = React.useState<AdminRecord | null>(null)
  const [leaveRequestStatusFilter, setLeaveRequestStatusFilter] = React.useState<string | null>(null)

  const [requestForm, setRequestForm] = React.useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })

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
      else if (meta.key === "pending") counts.pending += 1
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
      return meta.key === leaveRequestStatusFilter
    })
  }, [leaveRequestStatusFilter, requests])

  const openLeaveWorkflowDialog = React.useCallback((id: number | string, row: AdminRecord | null) => {
    setWorkflowRequestId(id)
    setWorkflowRequestRow(row)
    setWorkflowDialogOpen(true)
  }, [])

  const availableLeaveTypes = React.useMemo(() => {
    const options = new Map<string, { id: string; label: string }>()

    const addOption = (idValue: unknown, labelValue: unknown) => {
      const id = readNumberish(idValue)
      const label = typeof labelValue === "string" ? labelValue.trim() : ""
      if (id === null || !label) {
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

  const requestedLeaveDays = React.useMemo(
    () => countInclusiveLeaveDays(requestForm.start_date, requestForm.end_date),
    [requestForm.end_date, requestForm.start_date]
  )

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
      setMessage("Your profile is not ready for leave requests.")
      return
    }

    if (!requestForm.leave_type_id || !requestForm.start_date || !requestForm.end_date) {
      setMessage("Leave type and dates are required.")
      return
    }

    if (new Date(`${requestForm.start_date}T00:00:00`).getTime() > new Date(`${requestForm.end_date}T00:00:00`).getTime()) {
      setMessage("Start date cannot be after end date.")
      return
    }

    if (submit && !requestForm.reason.trim()) {
      setMessage("A reason is required before submitting the request.")
      return
    }

    if (submit && leaveSubmissionBalanceError) {
      setMessage(leaveSubmissionBalanceError)
      return
    }

    if (availableLeaveTypes.length === 0) {
      setMessage("Leave requests cannot be created until leave types are available to your account.")
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // Create as draft only when explicitly requested. Submit sends submit:true so
      // the API creates the request in the approval workflow, not as a draft.
      const payload = await createMyLeaveRequest(token, {
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason.trim() || (submit ? "" : "Draft"),
        submit: submit === true,
      })

      // Some backends still create a draft even when submit:true — finish the flow.
      if (submit) {
        const created =
          asRecord(payload) ??
          asRecord(asRecord(payload)?.data) ??
          asRecord(asRecord(payload)?.result) ??
          asRecord(asRecord(payload)?.item)
        const createdId =
          readNumber(created, ["id", "leave_request_id", "leaveRequestId"]) ??
          readNumber(asRecord(created?.leave_request), ["id"]) ??
          readNumber(asRecord(created?.leaveRequest), ["id"])
        const createdStatus = readString(created, ["status"], "").toLowerCase()

        if (createdId !== null && (createdStatus === "draft" || createdStatus === "" || createdStatus === "-")) {
          await submitMyLeaveRequest(token, createdId)
        }
        if (createdId !== null) {
          void notifySubmittedRequestApprovers({
            kind: "leave_request",
            token,
            request: payload,
            loadRequest: () => getMyLeaveRequest(token, createdId),
          })
        }
      }

      setRequestForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
      setMessage(submit ? "Leave request submitted for approval." : "Leave request saved as a draft.")
      setRequestDialogOpen(false)
      await loadData()
    } catch (errorObject) {
      const text = submit
        ? formatLeaveRequestError(errorObject, selectedLeaveBalance?.availableDays ?? null)
        : errorObject instanceof Error
          ? errorObject.message
          : "Failed to save draft."
      setMessage(text)
    } finally {
      setLoading(false)
    }
  }, [
    availableLeaveTypes.length,
    employeeId,
    leaveSubmissionBalanceError,
    loadData,
    requestForm,
    selectedLeaveBalance?.availableDays,
    token,
  ])

  const onCancelRequest = async (id: number | string, reason: string = "Cancelled by user") => {
    if (!token) return
    setLoading(true)
    setMessage(null)
    try {
      await cancelMyLeaveRequest(token, id, reason)
      setMessage("Leave request cancelled.")
      await loadData()
    } catch (errorObject) {
      const text = errorObject instanceof Error ? errorObject.message : "Failed to cancel request."
      setMessage(text)
    } finally {
      setLoading(false)
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
      setMessage(text)
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
      setMessage(balanceError)
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const submittedRequest = await submitMyLeaveRequest(token, id)
      void notifySubmittedRequestApprovers({
        kind: "leave_request",
        token,
        request: submittedRequest ?? { id },
        loadRequest: () => getMyLeaveRequest(token, id),
      })
      setMessage("Leave request submitted.")
      await loadData()
    } catch (errorObject) {
      const text = formatLeaveRequestError(errorObject, availableDays)
      setMessage(text)
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
    return <div className="px-4 py-2 text-sm text-red-600">{profileError}</div>
  }

  if (employeeId === null) {
    return <div className="px-4 py-2 text-sm text-red-600">Employee profile not found.</div>
  }

  let tabContent: React.ReactNode = null
  if (activeTab === "requests") {
    const statusChips: Array<{
      key: string | null
      label: string
      value: number
      className: string
      valueClassName: string
    }> = [
      {
        key: null,
        label: "All",
        value: leaveRequestStatusCounts.all,
        className: !leaveRequestStatusFilter ? "bg-primary/10" : "bg-background",
        valueClassName: "text-primary",
      },
      {
        key: "pending",
        label: "Open",
        value: leaveRequestStatusCounts.pending,
        className:
          leaveRequestStatusFilter === "pending" ? "bg-amber-500/15" : "bg-background",
        valueClassName: "text-amber-700 dark:text-amber-300",
      },
      {
        key: "draft",
        label: "Draft",
        value: leaveRequestStatusCounts.draft,
        className:
          leaveRequestStatusFilter === "draft" ? "bg-slate-500/15" : "bg-background",
        valueClassName: "text-slate-700 dark:text-slate-300",
      },
      {
        key: "approved",
        label: "Approved",
        value: leaveRequestStatusCounts.approved,
        className:
          leaveRequestStatusFilter === "approved" ? "bg-emerald-500/15" : "bg-background",
        valueClassName: "text-emerald-700 dark:text-emerald-300",
      },
      {
        key: "rejected",
        label: "Rejected",
        value: leaveRequestStatusCounts.rejected,
        className:
          leaveRequestStatusFilter === "rejected" ? "bg-rose-500/15" : "bg-background",
        valueClassName: "text-rose-700 dark:text-rose-300",
      },
      {
        key: "cancelled",
        label: "Cancelled",
        value: leaveRequestStatusCounts.cancelled,
        className:
          leaveRequestStatusFilter === "cancelled" ? "bg-muted" : "bg-background",
        valueClassName: "text-muted-foreground",
      },
    ]

    tabContent = (
      <motion.section
        className="w-full min-w-0 max-w-full space-y-4"
        variants={profileTabStagger}
        initial="hidden"
        animate="show"
      >
        <motion.div
          variants={profileTabItem}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
              Leave requests
            </h2>
            <p className="text-sm text-muted-foreground">
              {requests.length === 0
                ? "Request time off and track approval progress."
                : leaveRequestStatusFilter
                  ? `${filteredLeaveRequests.length} of ${requests.length} request${requests.length === 1 ? "" : "s"}`
                  : `${requests.length} request${requests.length === 1 ? "" : "s"} on file`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {leaveRequestStatusFilter ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => setLeaveRequestStatusFilter(null)}
              >
                Clear filter
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              onClick={() => setRequestDialogOpen(true)}
              className="h-9 bg-primary px-3 !text-white hover:bg-primary/90"
            >
              <CalendarIcon className="mr-1.5 size-3.5" />
              New request
            </Button>
          </div>
        </motion.div>

        <motion.div
          variants={profileTabItem}
          className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
        >
          {statusChips.map((chip, index, arr) => {
            const isActive = leaveRequestStatusFilter === chip.key
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() =>
                  setLeaveRequestStatusFilter((prev) =>
                    chip.key === null ? null : prev === chip.key ? null : chip.key
                  )
                }
                className={cn(
                  "flex min-w-[5.25rem] shrink-0 cursor-pointer flex-col justify-center px-3 py-2 text-left transition-colors",
                  chip.className,
                  isActive || (chip.key === null && !leaveRequestStatusFilter)
                    ? "ring-inset"
                    : "hover:bg-muted/40",
                  index < arr.length - 1 ? "border-r border-border/60" : null
                )}
              >
                <span className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {chip.label}
                </span>
                <span
                  className={cn(
                    "text-base font-semibold tabular-nums leading-tight",
                    chip.valueClassName
                  )}
                >
                  {chip.value}
                </span>
              </button>
            )
          })}
        </motion.div>

        {loading && requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <FluentLoadingIndicator size="large" />
            <p className="text-sm text-muted-foreground">Loading leave requests…</p>
          </div>
        ) : null}

        {!loading && requests.length === 0 ? (
          <motion.div
            variants={profileTabItem}
            className="overflow-hidden rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center"
          >
            <p className="text-sm font-medium text-foreground">No leave requests yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit a request when you need time off. Approvals show up here.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setRequestDialogOpen(true)}
              className="mt-4 h-9 bg-primary !text-white hover:bg-primary/90"
            >
              <CalendarIcon className="mr-1.5 size-3.5" />
              New request
            </Button>
          </motion.div>
        ) : null}

        {!loading && requests.length > 0 && filteredLeaveRequests.length === 0 ? (
          <motion.div
            variants={profileTabItem}
            className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
          >
            No requests match this filter.
            <button
              type="button"
              className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setLeaveRequestStatusFilter(null)}
            >
              Show all
            </button>
          </motion.div>
        ) : null}

        {filteredLeaveRequests.length > 0 ? (
          <motion.div
            variants={profileTabItem}
            className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
          >
            {filteredLeaveRequests.map((row, index) => {
              const id = readNumber(row, ["id"])
              const status = readString(row, ["status"], "pending").toLowerCase()
              const canCancel = ["pending", "draft"].includes(status)
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
                <motion.article
                  key={String(row.id ?? index)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    delay: Math.min(index, 12) * 0.04,
                  }}
                  className={cn(
                    "flex bg-background",
                    isHighlighted ? "bg-primary/[0.04]" : null
                  )}
                >
                  <div className={cn("w-1 shrink-0", statusMeta.barClassName)} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{leaveType}</h3>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              statusMeta.badgeClassName
                            )}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">{slipId}</span>
                          {statusMeta.helperText ? (
                            <>
                              <span className="mx-1 text-border">·</span>
                              {statusMeta.helperText}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Days
                        </p>
                        <p className="text-lg font-semibold tabular-nums leading-none text-primary">
                          {daysLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
                      <div className="min-w-[5.5rem]">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          From
                        </p>
                        <p
                          className={cn(
                            "text-base font-semibold tabular-nums leading-tight",
                            startLabel === "-" ? "text-muted-foreground/50" : "text-primary"
                          )}
                        >
                          {startLabel}
                        </p>
                      </div>
                      <div className="hidden text-muted-foreground/40 sm:block" aria-hidden>
                        →
                      </div>
                      <div className="min-w-[5.5rem]">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          To
                        </p>
                        <p
                          className={cn(
                            "text-base font-semibold tabular-nums leading-tight",
                            endLabel === "-" ? "text-muted-foreground/50" : "text-primary"
                          )}
                        >
                          {endLabel}
                        </p>
                      </div>
                      {reason && reason !== "-" ? (
                        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Reason
                          </p>
                          <p className="truncate text-sm text-foreground">{reason}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={loading}
                          onClick={() => openLeaveWorkflowDialog(id, row)}
                        >
                          Workflow
                        </Button>
                      ) : null}
                      {id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={loading}
                          onClick={() => void onDownloadPdf(id)}
                        >
                          PDF
                        </Button>
                      ) : null}
                      {id && status === "draft" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-primary px-2 text-xs !text-white hover:bg-primary/90"
                          disabled={loading}
                          onClick={() => void onSubmitRequest(id)}
                        >
                          Submit
                        </Button>
                      ) : null}
                      {id && canCancel ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          disabled={loading}
                          onClick={() => openCancelDialog(id)}
                        >
                          {status === "draft" ? "Discard" : "Cancel"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </motion.div>
        ) : null}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </motion.section>
    )
  }
  if (activeTab === "balances") {
    const fiscalYear = leaveBalancesFull?.current_fiscal_year || "2026"
    const showBalancesError = balancesError && balancesError !== SELF_SERVICE_UNAVAILABLE_MESSAGE
    tabContent = (
      <section className="w-full min-w-0 space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Leave Balances</h2>
          <p className="text-sm text-muted-foreground">Fiscal Year: {fiscalYear}</p>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <FluentLoadingIndicator size="large" />
            <p className="text-sm text-muted-foreground">Loading balances...</p>
          </div>
        ) : null}
        {!loading && balances.length === 0 ? <p className="text-sm text-slate-500">No balance records found.</p> : null}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border/70 pb-3 sm:grid-cols-3 xl:grid-cols-6">
          {balanceTotals.map((item) => (
            <div key={item.label} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-0.5 text-lg font-semibold tracking-tight text-primary">
                {formatDayValue(item.value)}
              </p>
              <p className="text-[11px] text-muted-foreground">days</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {balances.map((row, index) => (
            <div key={String(row.id ?? index)} className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ backgroundColor: 'var(--primary)' }}>
              <Doodle name="doodle-circles" />
              <div className="relative z-10">
                <p className="font-medium">
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
                </p>
                <p className="text-white/80">Fiscal Year: {readString(row, ["fiscal_year"], fiscalYear)}</p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {[
                    { label: "Allocated", value: row.allocated_days },
                    { label: "Used", value: row.used_days },
                    { label: "Pending", value: row.pending_days },
                    { label: "Carried forward", value: row.carried_forward_days },
                    { label: "Expired", value: row.expired_days },
                    { label: "Available", value: row.available_days ?? row.remaining_days },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-white">
                        {formatDayValue(item.value)} <span className="text-xs font-normal text-white/70">days</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
    tabContent = (
      <section className="w-full min-w-0 space-y-4">
        <TalentDoodleSprites />
        <HeroBand
          eyebrow="My leave"
          title="Holiday calendar"
          description="Company holidays published for your team this year."
          actions={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
              onClick={() => void loadData()}
              disabled={mounted ? loading : undefined}
            >
              {mounted && loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
          }
        />
        {showHolidaysError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            {holidaysError}
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <CompactStatStrip
          items={[
            { label: "This year", value: loading ? "…" : String(thisYearCount) },
            { label: "Upcoming", value: loading ? "…" : String(upcomingCount) },
            { label: "Holidays", value: loading ? "…" : String(sortedHolidays.length) },
          ]}
        />
        <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
          {loading && sortedHolidays.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading holidays...
            </div>
          ) : sortedHolidays.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No company holidays have been published yet.
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {sortedHolidays.map((row, index) => {
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
                  <div
                    key={String(row.id ?? index)}
                    className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {readString(row, ["name", "title"], "Holiday")}
                      </p>
                      <p className="text-sm text-muted-foreground">{dateLabel}</p>
                      {[holidayType, holidayBranch, holidayDescription].filter((value) => value && value !== "-").length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {[holidayType, holidayBranch, holidayDescription]
                            .filter((value) => value && value !== "-")
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
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
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogPopup className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit for approval immediately, or save a draft to finish later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Leave Type</Label>
              <Select value={requestForm.leave_type_id} onValueChange={(value) => setRequestForm((prev) => ({ ...prev, leave_type_id: value ?? "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder={availableLeaveTypes.length > 0 ? "Select leave type" : "No leave types available"}>
                    {selectedLeaveTypeLabel || undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableLeaveTypes.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {requestedLeaveDays !== null && requestForm.start_date && requestForm.end_date ? (
                <p className="text-xs text-muted-foreground">
                  Requested duration: {requestedLeaveDays.toFixed(2)} day(s)
                </p>
              ) : null}
              {leaveSubmissionBalanceError ? (
                <p className="text-xs text-rose-600">{leaveSubmissionBalanceError}</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="leave-start-date">Start Date</Label>
                <DatePickerPresets
                  id="leave-start-date"
                  value={requestForm.start_date}
                  onChange={(value) => setRequestForm((prev) => ({ ...prev, start_date: value }))}
                  placeholder="Pick start date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="leave-end-date">End Date</Label>
                <DatePickerPresets
                  id="leave-end-date"
                  value={requestForm.end_date}
                  onChange={(value) => setRequestForm((prev) => ({ ...prev, end_date: value }))}
                  placeholder="Pick end date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason {requestForm.reason.trim() ? null : <span className="font-normal text-muted-foreground">(required to submit)</span>}</Label>
              <Textarea
                className="min-h-24"
                placeholder="Why are you taking leave?"
                value={requestForm.reason}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRequestLeave(false)}
              disabled={loading || availableLeaveTypes.length === 0}
            >
              {loading ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              onClick={() => void onRequestLeave(true)}
              disabled={loading || availableLeaveTypes.length === 0 || Boolean(leaveSubmissionBalanceError)}
              className="bg-primary !text-white hover:bg-primary/90"
            >
              {loading ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
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
