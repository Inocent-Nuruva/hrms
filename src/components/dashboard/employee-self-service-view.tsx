"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  BriefcaseIcon,
  Building2Icon,
  CalendarIcon,
  ClockIcon,
  Loader2,
  PencilIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"

import { LumaSpin } from "@/components/ui/luma-spin"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"

import {
  cancelMyProfileUpdateRequest,
  getMyAttendanceAssignments,
  getMyAttendanceOverview,
  getMyDashboard,
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
  listMyLeaveBalances,
  listLeavePolicies,
  listMyLeaveRequests,
  listLeaveTypes,
  createMyProfileUpdateRequest,
  getMyProfileUpdateRequest,
  listMyProfileUpdateRequests,
  listMyTeamAttendance,
  submitMyProfileUpdateRequest,
  cancelMyLeaveRequest,
  getMyLeaveRequest,
  submitMyLeaveRequest,
  uploadMyProfilePhoto,
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
import { usePathname, useSearchParams } from "next/navigation"
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
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type SelfLeaveTab = "requests" | "balances" | "holidays" | "policies"
type SelfProfileTab = "summary" | "assignments" | "personal" | "records" | "updates"

type EmployeeSelfServiceLeaveViewProps = {
  tab: SelfLeaveTab
}

const SELF_SERVICE_UNAVAILABLE_MESSAGE = "This section is not available for your account yet."

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
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

function formatAttendancePunchValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }

  const trimmed = value.trim()
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
          const likelyEmployeeId = resolveEmployeeId(
            mergedCurrentUser,
            currentAdmin,
            asRecord(mergedCurrentUser.user),
            asRecord(tokenPayload?.user),
            asRecord(Array.isArray(tokenPayload?.companies) ? tokenPayload?.companies[0] : null)
          )
          if (likelyEmployeeId !== null) {
            const detailedEmployee = await getEmployeeById(likelyEmployeeId, nextToken).catch(() => null)
            if (detailedEmployee) {
              resolvedEmployee = mergeEmployeeRecords(resolvedEmployee, detailedEmployee)
            }
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
          mergedCurrentUser,
          currentAdmin,
          asRecord(mergedCurrentUser.user),
          asRecord(tokenPayload?.user),
          asRecord(Array.isArray(tokenPayload?.companies) ? tokenPayload?.companies[0] : null)
        )
        if (likelyEmployeeId !== null) {
          const detailedEmployee = await getEmployeeById(likelyEmployeeId, nextToken).catch(() => null)
          if (detailedEmployee) {
            resolvedEmployee = mergeEmployeeRecords(resolvedEmployee, detailedEmployee)
          }
        }
      }

      // Re-assert /employees/me as authoritative when present.
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
    return preferred
  }
  return (
    readString(employee, ["profile_photo_url"], "") ||
    readString(asRecord(employee?.company_user), ["profile_photo_url"], "") ||
    readString(asRecord(asRecord(employee?.company_user)?.user), ["profile_photo_url"], "") ||
    readString(currentUser, ["profile_photo_url"], "")
  )
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

const DOODLE_VARIANTS = ["doodle-circles", "doodle-curves", "doodle-grass"] as const

function pickDoodle(index: number) {
  return DOODLE_VARIANTS[index % DOODLE_VARIANTS.length]
}

function SummaryPrimaryCard({
  children,
  doodle = "doodle-circles",
  className = "",
}: {
  children: React.ReactNode
  doodle?: (typeof DOODLE_VARIANTS)[number]
  className?: string
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border border-white/15 bg-primary p-4 !text-white", className)}
    >
      <Doodle name={doodle} className="text-white/30" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

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
  doodle?: (typeof DOODLE_VARIANTS)[number]
  barClassName?: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex">
        <div className={cn("w-1 shrink-0", barClassName)} />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {typeof count === "number" ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                {count}
              </span>
            ) : null}
            {action}
          </div>
        </div>
      </div>
      <div className="divide-y divide-border/70 border-t border-border/70">{children}</div>
    </div>
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
}: {
  title?: string
  badge?: React.ReactNode
  fields: Array<{ label: string; value: React.ReactNode }>
  barClassName?: string
}) {
  return (
    <div className="flex">
      <div className={cn("w-1 shrink-0 self-stretch", barClassName)} />
      <div className="min-w-0 flex-1 px-3 py-3">
        {title || badge ? (
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : <span />}
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
    <div className="flex bg-background">
      <div className={cn("w-1 shrink-0", tone.bar)} />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
          {detail ? <p className="text-xs text-muted-foreground line-clamp-2">{detail}</p> : null}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
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
      <div className="glass-scrollbar overflow-x-auto" role="tablist" aria-label="Personal profile sections">
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
                  "border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
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
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex">
        <div className={cn("w-1 shrink-0", barClassName)} />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
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
      <div className="border-t border-border/70">{children}</div>
    </div>
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
    <div className="flex border-b border-border/70 last:border-b-0">
      <div className={cn("w-1 shrink-0 self-stretch", barClassName)} />
      <div className="min-w-0 flex-1 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
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
  const designationAssignments = Array.isArray(employee.designation_assignments)
    ? employee.designation_assignments
    : []
  const previewDays = scheduleDays.slice(0, 7)
  const offDaysCount = previewDays.filter(
    (day) => day.is_off_day === true || day.is_off_day === "true"
  ).length

  const snapshotChips = [
    { key: "dept", label: "Departments", value: String(departments.length) },
    { key: "pos", label: "Positions", value: String(positionAssignments.length) },
    { key: "des", label: "Designations", value: String(designationAssignments.length) },
    { key: "sched", label: "Schedule days", value: String(previewDays.length) },
    {
      key: "off",
      label: "Off days",
      value: String(offDaysCount),
      highlight: offDaysCount > 0,
    },
  ]

  return (
    <motion.div
      className="space-y-4"
      variants={assignmentsStagger}
      initial="hidden"
      animate="show"
    >
      {/* Snapshot chips */}
      <motion.div
        variants={assignmentsItem}
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
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
            icon={Building2Icon}
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
            icon={BriefcaseIcon}
            count={positionAssignments.length}
          >
            {positionAssignments.length ? (
              positionAssignments.map((entry, index) => {
                const record = asRecord(entry)
                const position = asRecord(record?.position)
                const designation = asRecord(record?.designation)
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
                      label="Designation"
                      value={readString(designation, ["name", "designation_name"], "—")}
                    />
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
          title="Designation"
          subtitle="Current and historical titles"
          icon={BriefcaseIcon}
          count={designationAssignments.length}
        >
          {designationAssignments.length ? (
            designationAssignments.map((entry, index) => {
              const record = asRecord(entry)
              const designation = asRecord(record?.designation)
              const designationName = readString(
                designation,
                ["name", "designation_name"],
                "Designation"
              )
              const isCurrent = formatUnknownValue(record?.is_current) === "Yes"
              return (
                <AssignmentItemCard
                  key={`designation-assignment-${index}`}
                  title={designationName}
                  barClassName={isCurrent ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}
                  badge={
                    isCurrent ? <AssignmentBadge tone="primary">Current</AssignmentBadge> : null
                  }
                >
                  <AssignmentField label="Code" value={readString(designation, ["code"], "—")} />
                  <AssignmentField label="Start" value={formatDate(record?.start_date)} />
                  <AssignmentField label="End" value={formatDate(record?.end_date)} />
                  <AssignmentField label="Remarks" value={readString(record, ["remarks"], "—")} />
                </AssignmentItemCard>
              )
            })
          ) : (
            <EmptyAssignmentState message="No designation assigned." />
          )}
        </AssignmentSection>
      </motion.div>

      <motion.div variants={assignmentsItem}>
        <AssignmentSection
          title="Attendance assignment"
          subtitle="Shifts, timetables, and overrides"
          icon={ClockIcon}
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
          icon={CalendarIcon}
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
    <motion.div className="space-y-4" variants={profileTabStagger} initial="hidden" animate="show">
      <motion.div
        variants={profileTabItem}
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
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
                          title={readString(record, ["contact_type"], "Contact")}
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
  )
}

function ProfileRecordsTab({
  employee,
  correctionRequests,
  profileUpdateRequests,
  teamAttendance,
}: {
  employee: AdminRecord | null
  correctionRequests: AdminRecord[]
  profileUpdateRequests: AdminRecord[]
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
    <motion.div className="space-y-4" variants={profileTabStagger} initial="hidden" animate="show">
      <motion.div
        variants={profileTabItem}
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
      >
        {[
          {
            label: "Corrections",
            value: String(correctionRequests.length),
            highlight: pendingCorrections > 0,
          },
          {
            label: "Profile updates",
            value: String(profileUpdateRequests.length),
            highlight: false,
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

      <div className="grid gap-3 lg:grid-cols-2">
        <motion.div variants={profileTabItem}>
          <SelfServiceSectionCard
            title="Attendance corrections"
            count={correctionRequests.length}
            subtitle="Your correction requests"
            barClassName="bg-amber-500"
          >
            {correctionRequests.length === 0 ? (
              <ProfileEmptyRow message="No attendance correction requests found." />
            ) : (
              correctionRequests.map((row, index) => {
                const titleText =
                  readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                  readString(row, ["reason", "request_type", "change_type"], "Correction request")
                const createdAt =
                  formatDateTime(row.created_at) !== "-"
                    ? formatDateTime(row.created_at)
                    : formatDate(row.date)
                return (
                  <ProfileRequestRow
                    key={String(row.id ?? index)}
                    title={titleText}
                    status={readString(row, ["status"], "draft")}
                    dateLabel={createdAt}
                  />
                )
              })
            )}
          </SelfServiceSectionCard>
        </motion.div>

        <motion.div variants={profileTabItem}>
          <SelfServiceSectionCard
            title="Profile update requests"
            count={profileUpdateRequests.length}
            subtitle="Recent change requests"
            barClassName="bg-sky-500"
          >
            {profileUpdateRequests.length === 0 ? (
              <ProfileEmptyRow message="No profile update requests found." />
            ) : (
              profileUpdateRequests.map((row, index) => {
                const titleText =
                  readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                  readString(row, ["reason", "request_type", "change_type"], "Profile update")
                const createdAt =
                  formatDateTime(row.created_at) !== "-"
                    ? formatDateTime(row.created_at)
                    : formatDate(row.date)
                return (
                  <ProfileRequestRow
                    key={String(row.id ?? index)}
                    title={titleText}
                    status={readString(row, ["status"], "draft")}
                    dateLabel={createdAt}
                    detail={readString(row, ["reason"], "") || undefined}
                  />
                )
              })
            )}
          </SelfServiceSectionCard>
        </motion.div>
      </div>

      <motion.div variants={profileTabItem}>
        <SelfServiceSectionCard
          title="Direct reports today"
          count={teamAttendance.length}
          subtitle="Team attendance snapshot"
        >
          {teamAttendance.length === 0 ? (
            <ProfileEmptyRow message="No team attendance rows were returned for your account." />
          ) : (
            teamAttendance.map((row, index) => {
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
                <ProfileDataItem
                  key={String(row.id ?? index)}
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
              )
            })
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
    },
    {
      key: "contact-details",
      title: "Contact details",
      description: "Email, phone, and city",
      fields: ["email", "phone", "city"] as EditableUserField[],
      label: "Contact Details",
    },
    {
      key: "profile-photo",
      title: "Profile photo",
      description: "Change your picture",
      fields: ["profile_photo_url"] as EditableUserField[],
      label: "Profile Picture",
    },
    {
      key: "password",
      title: "Password",
      description: "Update sign-in password",
      fields: ["password"] as EditableUserField[],
      label: "Password",
    },
  ]

  return (
    <motion.div className="space-y-4" variants={profileTabStagger} initial="hidden" animate="show">
      {/* Primary actions */}
      <motion.div
        variants={profileTabItem}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Update requests</h2>
          <p className="text-sm text-muted-foreground">
            Submit a change for HR approval, or track requests you already sent.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 bg-primary !text-white hover:bg-primary/90"
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
        className="inline-flex max-w-full flex-nowrap items-stretch overflow-x-auto rounded-lg border border-border"
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
              "flex min-w-[5.5rem] shrink-0 flex-col justify-center bg-background px-3 py-2",
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
      <motion.div variants={profileTabItem}>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex">
            <div className="w-1 shrink-0 bg-primary" />
            <div className="min-w-0 flex-1 px-3 py-2.5">
              <h3 className="text-sm font-semibold text-foreground">What do you want to change?</h3>
              <p className="text-[11px] text-muted-foreground">
                Each request is sent to HR for approval.
              </p>
            </div>
          </div>
          <div className="grid gap-0 border-t border-border/70 sm:grid-cols-2">
            {updateActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => openSectionEditor(action.key, action.label, action.fields)}
                className="flex items-center gap-3 border-b border-border/70 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <PencilIcon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{action.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{action.description}</span>
                </span>
                <span className="text-xs font-medium text-primary">Request →</span>
              </button>
            ))}
          </div>
        </div>
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
  )
}

type ProfileSummaryTabProps = {
  currentUser: AdminRecord | null
  employee: AdminRecord | null
  attendanceTodayRecord: AdminRecord | null
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
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 text-right text-sm font-medium text-foreground break-words">{value}</span>
    </div>
  )
}

function ProfileSummarySection({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  barClassName = "bg-primary",
}: {
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  children: React.ReactNode
  barClassName?: string
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex">
        <div className={cn("w-1 shrink-0", barClassName)} />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 border-r border-t border-primary/40 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{title}</div>
              {subtitle ? (
                <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
              ) : null}
            </div>
          </div>
          {action}
        </div>
      </div>
      <div className="divide-y divide-border/70 border-t border-border/70">{children}</div>
    </div>
  )
}

function ProfileSummaryTab({
  currentUser,
  employee,
  attendanceTodayRecord,
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

  const firstPunchRaw = readAttendanceValue(
    attendanceTodayRecord,
    [
      "first_punch",
      "first_check_in_at",
      "firstCheckInAt",
      "first_punch_at",
      "firstPunchAt",
      "check_in_at",
      "checkInAt",
      "check_in",
      "checkIn",
      "clock_in_at",
      "clockInAt",
      "check_in_time",
      "checkInTime",
    ],
    attendanceTodaySummary
  )
  const lastPunchRaw = readAttendanceValue(
    attendanceTodayRecord,
    [
      "last_punch",
      "last_check_out_at",
      "lastCheckOutAt",
      "last_punch_at",
      "lastPunchAt",
      "check_out_at",
      "checkOutAt",
      "check_out",
      "checkOut",
      "clock_out_at",
      "clockOutAt",
      "check_out_time",
      "checkOutTime",
    ],
    attendanceTodaySummary
  )
  const firstPunch = formatAttendancePunchValue(firstPunchRaw)
  const lastPunch = formatAttendancePunchValue(lastPunchRaw)
  const punchState = resolveProfileAttendanceState(rawPunchState, firstPunch, lastPunch)
  const punchTone = profilePunchStatusTone(punchState)
  const todayDateLabel = formatDate(attendanceTodayRecord?.date) || "Today"
  const openRequestsTotal = pendingLeave + pendingCorrections + pendingProfileUpdates

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      {/* Profile header — primary background, compact meta */}
      <div
        className="relative overflow-hidden rounded-2xl p-4 text-white md:p-5"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <Doodle name="doodle-circles" />
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <Avatar className="size-14 shrink-0 ring-2 ring-white/30 md:size-16">
              {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-white/20 text-lg font-semibold text-white">
                {initials || "ME"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-2.5">
              {/* Identity: who you are */}
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[11px] font-semibold capitalize text-white">
                    {employmentStatusLabel}
                  </span>
                </div>
                <p className="text-sm font-medium text-white/95">{positionLabel}</p>
              </div>

              {/* Labeled facts — avoids the old unlabeled · list */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    Employee no.
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{employeeNumber}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    Department
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{departmentLabel}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    Branch
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{branchLabel}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    Employment
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{employmentTypeLabel}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                    Joined
                  </p>
                  <p className="truncate text-sm font-semibold text-white">{hireDateLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() =>
                openSectionEditor("personal-details", "Personal Details", [
                  "first_name",
                  "last_name",
                  "email",
                  "phone",
                ])
              }
            >
              <PencilIcon className="mr-1 size-3" />
              Edit Profile
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() =>
                openSectionEditor("profile-photo", "Profile Picture", ["profile_photo_url"])
              }
            >
              <PencilIcon className="mr-1 size-3" />
              Change Photo
            </Button>
          </div>
        </div>
      </div>

      {/* Today's attendance detail row */}
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
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

      {/* My info sections — compact bordered lists */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProfileSummarySection
          title="Contact"
          subtitle="Personal details"
          icon={UserIcon}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() =>
                openSectionEditor("contact-details", "Contact Details", [
                  "first_name",
                  "last_name",
                  "email",
                  "phone",
                ])
              }
            >
              <PencilIcon className="mr-1 size-3.5" />
              Edit
            </Button>
          }
        >
          <ProfileSummaryFieldRow label="Email" value={email} />
          <ProfileSummaryFieldRow label="Phone" value={phone} />
          <ProfileSummaryFieldRow label="Employee ID" value={empId} />
          <div className="flex flex-wrap items-center gap-3 px-3 py-2">
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => openSectionEditor("password", "Password", ["password"])}
            >
              Change Password
            </button>
            <button
              type="button"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              onClick={() =>
                openSectionEditor("profile-photo", "Profile Picture", ["profile_photo_url"])
              }
            >
              Change Photo
            </button>
          </div>
        </ProfileSummarySection>

        <ProfileSummarySection
          title="Organization"
          subtitle="Work placement"
          icon={Building2Icon}
        >
          <ProfileSummaryFieldRow label="Branch" value={branchLabel} />
          <ProfileSummaryFieldRow label="Department" value={departmentLabel} />
          <ProfileSummaryFieldRow label="Position" value={positionLabel} />
        </ProfileSummarySection>

        <ProfileSummarySection title="Reporting" subtitle="Manager chain" icon={UsersIcon}>
          <ProfileSummaryFieldRow label="Reports to" value={manager.name || "—"} />
          <ProfileSummaryFieldRow label="Manager no." value={manager.employeeNo || "—"} />
          <ProfileSummaryFieldRow label="Full name" value={displayName} />
        </ProfileSummarySection>

        <ProfileSummarySection
          title="Employment"
          subtitle="Status & tenure"
          icon={BriefcaseIcon}
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
    </div>
  )
}


export function EmployeeSelfServiceProfileView() {
  const { loading, error, token, currentUser, employee, refresh } = useSelfEmployeeData()
  const { url: myProfilePhotoUrl, refresh: refreshMyProfilePhoto } = useMyProfilePhoto(token)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeTab = (searchParams?.get("tab") as SelfProfileTab) || "summary"
  const editTarget = searchParams?.get("edit") ?? ""
  const autoOpenedEditTargetRef = React.useRef("")
  const [message, setMessage] = React.useState<string | null>(null)
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
  const [dashboardOverview, setDashboardOverview] = React.useState<AdminRecord | null>(null)
  const [employmentStatus, setEmploymentStatus] = React.useState<AdminRecord | null>(null)
  const [attendanceOverview, setAttendanceOverview] = React.useState<AdminRecord | null>(null)
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
      setSectionValues(baseEditorValues)
      setSectionEditor({ key, title, fields })
    },
    [baseEditorValues]
  )

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

    // Profile picture uses POST /api/me/profile/photo and applies immediately.
    if (isProfilePhotoSection) {
      if (!selectedProfilePhotoFile) {
        setSectionError("Choose an image to upload as your profile picture.")
        setSectionErrorLines([])
        return
      }

      setSectionSaving(true)
      setSectionError(null)
      setSectionErrorLines([])
      try {
        const uploaded = await uploadMyProfilePhoto(token, selectedProfilePhotoFile)
        const uploadedUrl =
          readString(uploaded, ["profile_photo_url", "photo_url", "url", "avatar_url"], "") ||
          readString(asRecord(uploaded?.user), ["profile_photo_url", "photo_url", "url", "avatar_url"], "") ||
          readString(asRecord(uploaded?.employee), ["profile_photo_url", "photo_url", "url", "avatar_url"], "") ||
          ""

        if (uploadedUrl) {
          setMyProfilePhotoUrl(uploadedUrl)
        }

        const canonicalUrl =
          (await ensureMyProfilePhotoUrl(token, { force: true })) ||
          uploadedUrl ||
          profilePhotoPreviewUrl ||
          null

        if (canonicalUrl) {
          setMyProfilePhotoUrl(canonicalUrl)
          setSectionValues((previous) => ({
            ...previous,
            profile_photo_url: canonicalUrl,
          }))
        }

        void refreshMyProfilePhoto()
        setSectionEditor(null)
        setSelectedProfilePhotoFile(null)
        setProfilePhotoFileName("")
        setProfilePhotoPreviewUrl("")
        setMessage("Profile picture updated.")
        await refresh()
      } catch (errorObject) {
        const lines = formatApiErrorLines(errorObject, "Failed to upload profile picture.")
        setSectionError(lines[0] ?? "Failed to upload profile picture.")
        setSectionErrorLines(lines)
      } finally {
        setSectionSaving(false)
      }
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
      if (nextValue) {
        const apiField = field === "phone" ? "phone_number" : field
        requestedChanges[apiField] = nextValue
      }
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
    profilePhotoPreviewUrl,
    refresh,
    refreshMyProfilePhoto,
    sectionEditor,
    sectionValues,
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
      setAttendanceAssignments(null)
      setTeamAttendance([])
      setCorrectionRequests([])
      setProfileUpdateRequests([])
      return
    }

    let cancelled = false

    void Promise.allSettled([
      getMyDashboard(token),
      getMyStatus(token),
      getMyAttendanceOverview(token, { page: 1, limit: 20, sortBy: "created_at", sortOrder: "DESC" }),
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
        assignmentsResult,
        teamResult,
        correctionsResult,
        profileUpdatesResult,
      ] = results

      setDashboardOverview(dashboardResult.status === "fulfilled" ? asRecord(dashboardResult.value) : null)
      setEmploymentStatus(statusResult.status === "fulfilled" ? asRecord(statusResult.value) : null)
      setAttendanceOverview(overviewResult.status === "fulfilled" ? asRecord(overviewResult.value) : null)
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
      asRecord(attendanceOverview?.today) ??
      asRecord(dashboardOverview?.attendance_today) ??
      asRecord(dashboardOverview?.attendance_overview),
    [attendanceOverview, dashboardOverview]
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

  return (
    <div className="grid gap-4">
      <DoodleSprites />
      <div className="glass-scrollbar overflow-x-auto">
        <div className="inline-flex min-w-full items-center gap-4 border-b border-border/80">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <Link
                key={tab.key}
                href={`${pathname}?tab=${tab.key}`}
                className={cn(
                  "border-b-2 px-1 py-2 text-[0.92rem] font-medium whitespace-nowrap transition-colors duration-200",
                  isActive
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <LumaSpin />
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
              profileUpdateRequests={profileUpdateRequests}
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
                              Choose an image from your device. Your profile picture is updated as soon as you save.
                            </p>
                          </div>
                        </div>
                        <input
                          ref={profilePhotoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
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
                            {profilePhotoFileName ? "Choose Another Image" : "Choose Image"}
                          </Button>
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
                      !selectedProfilePhotoFile)
                  }
                >
                  {sectionSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  {sectionEditor?.fields.length === 1 && sectionEditor.fields[0] === "profile_photo_url"
                    ? "Upload Picture"
                    : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

      {message ? <p className="px-1 text-sm text-slate-700 dark:text-slate-300">{message}</p> : null}
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
              <LumaSpin />
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
                <InfoRow label="Designation" value={readString(asRecord(employee.designation), ["name", "designation_name"])} />
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
  const { loading, error } = useSelfEmployeeData()

  return (
    <section className="space-y-4 px-4 py-2 lg:px-6">
      <DoodleSprites />
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10">
          <LumaSpin />
          <p className="text-sm text-muted-foreground">Loading promotion context...</p>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="max-w-sm mx-auto">
          <div className="relative overflow-hidden rounded-2xl p-6 text-white flex flex-col items-center justify-center min-h-[180px]" style={{ backgroundColor: 'var(--primary)' }}>
            <Doodle name="doodle-circles" />
            <div className="relative z-10 flex flex-col items-center">
              <h3 className="text-xl font-semibold tracking-tight text-center">
                No promotion currently assigned to you
              </h3>
              <p className="mt-2 text-sm text-white/70 text-center">
                When HR processes or approves a promotion for you, the details will show up here.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function EmployeePayrollView() {
  return (
    <section className="space-y-4 px-4 py-2 lg:px-6">
      <DoodleSprites />
      <div className="max-w-sm mx-auto">
        <div className="relative overflow-hidden rounded-2xl p-6 text-white flex flex-col items-center justify-center min-h-[180px]" style={{ backgroundColor: 'var(--primary)' }}>
          <Doodle name="doodle-circles" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center justify-center gap-4">
              <ChartBar size={36} className="text-white/90" />
              <Settings size={36} className="text-white/90" />
              <Sparkles size={36} className="text-white/90" />
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-center mt-4">Coming Soon</h3>
          </div>
        </div>
      </div>
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
      const baseUrl = resolveApiBaseUrl()
      const res = await fetch(`${baseUrl}/api/me/leave/requests/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Failed to generate PDF")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `leave_request_${id}.pdf`
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
        <LumaSpin />
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
        className="space-y-4 px-1 py-1 md:px-0"
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
            <LumaSpin />
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

        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </motion.section>
    )
  }
  if (activeTab === "balances") {
    const fiscalYear = leaveBalancesFull?.current_fiscal_year || "2026"
    const showBalancesError = balancesError && balancesError !== SELF_SERVICE_UNAVAILABLE_MESSAGE
    tabContent = (
      <section className="space-y-4 px-4 py-2 lg:px-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Leave Balances</h2>
          <p className="text-sm text-muted-foreground">Fiscal Year: {fiscalYear}</p>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <LumaSpin />
            <p className="text-sm text-muted-foreground">Loading balances...</p>
          </div>
        ) : null}
        {!loading && balances.length === 0 ? <p className="text-sm text-slate-500">No balance records found.</p> : null}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b border-border/70 pb-3">
          {balanceTotals.map((item) => (
            <div key={item.label} className="min-w-[88px]">
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
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-white/80">
                  <div>Allocated: {String(row.allocated_days ?? "-")}</div>
                  <div>Used: {String(row.used_days ?? "-")}</div>
                  <div>Pending: {String(row.pending_days ?? "-")}</div>
                  <div>Available: {String(row.available_days ?? row.remaining_days ?? "-")}</div>
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
    const sortedHolidays = [...holidays].sort((left, right) => {
      const leftDate = readString(left, ["holiday_date", "from_date", "start_date", "date"], "")
      const rightDate = readString(right, ["holiday_date", "from_date", "start_date", "date"], "")
      return leftDate.localeCompare(rightDate)
    })
    tabContent = (
      <section className="space-y-4 px-4 py-2 lg:px-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Holiday Calendar</h2>
          <p className="text-sm text-muted-foreground">Company holidays pulled from the attendance holiday calendar.</p>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <LumaSpin />
            <p className="text-sm text-muted-foreground">Loading holidays...</p>
          </div>
        ) : null}
        {!loading && sortedHolidays.length === 0 ? (
          <p className="text-sm text-slate-500">No holidays were returned by `/api/attendance/holidays`.</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedHolidays.map((row, index) => {
            const holidayStart =
              readString(row, ["holiday_date", "from_date", "start_date", "date"], "") || "-"
            const holidayEnd = readString(row, ["to_date", "end_date"], "")
            const holidayType = readString(row, ["type", "holiday_type", "category"], "")
            const holidayBranch = readString(asRecord(row.branch), ["name", "branch_name"], "")
            const holidayDescription = readString(row, ["description", "notes", "remarks"], "")
            const dateLabel =
              holidayEnd && holidayEnd !== holidayStart
                ? `${formatDate(holidayStart)} - ${formatDate(holidayEnd)}`
                : formatDate(holidayStart)

            return (
              <div key={String(row.id ?? index)} className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ backgroundColor: 'var(--primary)' }}>
                <Doodle name="doodle-circles" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{readString(row, ["name", "title"], "Holiday")}</p>
                    {holidayType ? (
                      <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/90">
                        {holidayType}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-white/80">{dateLabel}</p>
                  {holidayBranch ? <p className="mt-1 text-xs text-white/60">Branch: {holidayBranch}</p> : null}
                  {holidayDescription ? <p className="mt-2 text-xs text-white/60">{holidayDescription}</p> : null}
                </div>
              </div>
            )
          })}
        </div>
        {showHolidaysError ? <p className="text-sm text-slate-500">{holidaysError}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    )
  }

  if (activeTab === "policies") {
    const showPoliciesError = policiesError && policiesError !== SELF_SERVICE_UNAVAILABLE_MESSAGE
    tabContent = (
      <section className="space-y-4 px-4 py-2 lg:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Leave Policies</h2>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <LumaSpin />
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
            {message ? <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p> : null}
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
