"use client"

import * as React from "react"
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
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

import {
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
  listMyProfileUpdateRequests,
  listMyTeamAttendance,
  submitMyProfileUpdateRequest,
  cancelMyLeaveRequest,
  submitMyLeaveRequest,
  type AdminRecord,
} from "@/lib/admin-api"
import { API_BASE_URL, AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

function resolveLeaveStatusMeta(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  const normalized = raw.toLowerCase()

  if (normalized === "draft") {
    return {
      label: "Draft",
      badgeClassName: "border-white/30 bg-white/15 text-white",
      helperText: "Saved as draft",
    }
  }

  if (["pending", "submitted", "in_review", "under_review"].includes(normalized)) {
    return {
      label: raw || "Pending",
      badgeClassName: "border-emerald-200/40 bg-emerald-300/20 text-white",
      helperText: "Submitted",
    }
  }

  if (normalized === "approved") {
    return {
      label: "Approved",
      badgeClassName: "border-sky-200/40 bg-sky-300/20 text-white",
      helperText: "Submitted",
    }
  }

  if (normalized === "rejected") {
    return {
      label: "Rejected",
      badgeClassName: "border-rose-200/40 bg-rose-300/20 text-white",
      helperText: "Submitted",
    }
  }

  if (normalized === "cancelled") {
    return {
      label: "Cancelled",
      badgeClassName: "border-slate-200/40 bg-slate-200/20 text-white",
      helperText: "No longer active",
    }
  }

  return {
    label: raw || "Pending",
    badgeClassName: "border-white/30 bg-white/15 text-white",
    helperText: raw ? "Submitted" : "",
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

function resolveProfilePhotoUrl(currentUser: AdminRecord | null, employee: AdminRecord | null) {
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
  | "password"
  | "user_no"
  | "status"
  | "profile_photo_url"

type SectionEditorState = {
  key: string
  title: string
  fields: EditableUserField[]
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

const DOODLE_VARIANTS = ["doodle-circles", "doodle-curves", "doodle-grass"] as const
const PALE_PRIMARY = "color-mix(in srgb, var(--primary) 18%, white)"

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
      className={cn("relative overflow-hidden rounded-2xl border border-white/15 bg-primary p-4 text-primary-foreground", className)}
    >
      <Doodle name={doodle} className="text-white/30" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

function AssignmentField({ label, value, inverse = false }: { label: string; value: string; inverse?: boolean }) {
  return (
    <div>
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", inverse ? "text-white/70" : "text-muted-foreground")}>
        {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-medium", inverse ? "text-white" : "text-foreground")}>{value}</p>
    </div>
  )
}

function AssignmentStatCard({
  label,
  value,
  doodle = "doodle-circles",
}: {
  label: string
  value: string
  doodle?: (typeof DOODLE_VARIANTS)[number]
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl px-1 py-1">
      <Doodle name={doodle} className="text-primary/14" />
      <div className="relative z-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em] text-primary">{value}</p>
      </div>
    </div>
  )
}

function EmptyAssignmentCard({ message, doodle = "doodle-curves" }: { message: string; doodle?: (typeof DOODLE_VARIANTS)[number] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl px-5 py-3.5">
      <Doodle name={doodle} className="text-primary/14" />
      <p className="relative z-10 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function AssignmentBadge({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide",
        inverse
          ? "border border-white/20 bg-white/10 text-white"
          : "border border-primary/20 bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  )
}

function SelfServiceSectionCard({
  title,
  children,
  doodle = "doodle-circles",
}: {
  title: string
  children: React.ReactNode
  doodle?: (typeof DOODLE_VARIANTS)[number]
}) {
  return (
    <SummaryPrimaryCard doodle={doodle}>
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">{title}</div>
        {children}
      </div>
    </SummaryPrimaryCard>
  )
}

function AssignmentSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-primary" /> : null}
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      </div>
      {children}
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
  const positionAssignments = Array.isArray(employee.position_assignments) ? employee.position_assignments : []
  const designationAssignments = Array.isArray(employee.designation_assignments) ? employee.designation_assignments : []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AssignmentSection title="Department" icon={Building2Icon}>
          {departments.length ? (
            <div className="space-y-2">
              {departments.map((entry, index) => {
                const record = asRecord(entry)
                const department = asRecord(record?.department)
                const branch = asRecord(department?.branch)
                const departmentName = readString(department, ["name", "department_name"], "Department")
                return (
                  <SummaryPrimaryCard key={`department-${index}`} doodle={pickDoodle(index)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-semibold tracking-tight text-white">{departmentName}</p>
                      {formatUnknownValue(record?.is_primary) === "Yes" ? (
                        <AssignmentBadge inverse>Primary</AssignmentBadge>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <AssignmentField label="Code" value={readString(department, ["code"], "-")} inverse />
                      <AssignmentField label="Branch" value={readString(branch, ["name", "branch_name"], "-")} inverse />
                      <AssignmentField label="Status" value={readString(department, ["status"], "-")} inverse />
                    </div>
                  </SummaryPrimaryCard>
                )
              })}
            </div>
          ) : (
            <EmptyAssignmentCard message="No department assigned." />
          )}
        </AssignmentSection>

        <AssignmentSection title="Position" icon={BriefcaseIcon}>
          {positionAssignments.length ? (
            <div className="space-y-2">
              {positionAssignments.map((entry, index) => {
                const record = asRecord(entry)
                const position = asRecord(record?.position)
                const designation = asRecord(record?.designation)
                const positionName = readString(position, ["name", "position_name"], "Position")
                return (
                  <SummaryPrimaryCard key={`position-assignment-${index}`} doodle={pickDoodle(index + 1)}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-semibold tracking-tight text-white">{positionName}</p>
                      <AssignmentBadge inverse>{readString(record, ["status"], "active")}</AssignmentBadge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <AssignmentField label="Designation" value={readString(designation, ["name", "designation_name"], "-")} inverse />
                      <AssignmentField label="Assignment Type" value={readString(record, ["assignment_type"], "-")} inverse />
                      <AssignmentField label="Primary" value={formatUnknownValue(record?.is_primary)} inverse />
                      <AssignmentField label="Start Date" value={formatDate(record?.start_date)} inverse />
                      <AssignmentField label="End Date" value={formatDate(record?.end_date)} inverse />
                      <AssignmentField label="Notes" value={readString(record, ["notes"], "-")} inverse />
                    </div>
                  </SummaryPrimaryCard>
                )
              })}
            </div>
          ) : (
            <EmptyAssignmentCard message="No position assigned." doodle="doodle-grass" />
          )}
        </AssignmentSection>
      </div>

      <AssignmentSection title="Designation" icon={BriefcaseIcon}>
        {designationAssignments.length ? (
          <div className="space-y-2">
            {designationAssignments.map((entry, index) => {
              const record = asRecord(entry)
              const designation = asRecord(record?.designation)
              const designationName = readString(designation, ["name", "designation_name"], "Designation")
              return (
                <SummaryPrimaryCard key={`designation-assignment-${index}`} doodle={pickDoodle(index + 2)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-semibold tracking-tight text-white">{designationName}</p>
                    {formatUnknownValue(record?.is_current) === "Yes" ? (
                      <AssignmentBadge inverse>Current</AssignmentBadge>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AssignmentField label="Code" value={readString(designation, ["code"], "-")} inverse />
                    <AssignmentField label="Start Date" value={formatDate(record?.start_date)} inverse />
                    <AssignmentField label="End Date" value={formatDate(record?.end_date)} inverse />
                    <AssignmentField label="Remarks" value={readString(record, ["remarks"], "-")} inverse />
                  </div>
                </SummaryPrimaryCard>
              )
            })}
          </div>
        ) : (
          <EmptyAssignmentCard message="No designation assigned." doodle="doodle-circles" />
        )}
      </AssignmentSection>

      <AssignmentSection title="Attendance Assignment Summary" icon={ClockIcon}>
        {assignmentSummaryRows.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {assignmentSummaryRows.map((row, index) => (
              <AssignmentStatCard key={row.label} label={row.label} value={row.value} doodle={pickDoodle(index)} />
            ))}
          </div>
        ) : (
          <EmptyAssignmentCard message="No attendance assignment summary is available yet." doodle="doodle-grass" />
        )}
      </AssignmentSection>

      <AssignmentSection title="Upcoming Schedule Preview" icon={CalendarIcon}>
        {scheduleDays.length ? (
          <div className="space-y-2">
            {scheduleDays.slice(0, 5).map((day, index) => {
              const shift = asRecord(day.shift)
              const timetable = asRecord(day.timetable)
              const isOffDay = day.is_off_day === true || day.is_off_day === "true"
              const shiftName = isOffDay ? "Off Day" : readString(shift, ["name", "code"], "-")
              const timeRange = !shift || isOffDay
                ? "—"
                : `${formatTimeValue(shift.start_time)} to ${formatTimeValue(shift.end_time)}`
              const expectedWork = isOffDay ? "—" : formatMinutesDuration(shift?.expected_work_minutes)

              return (
                <SummaryPrimaryCard key={String(day.date ?? index)} doodle={pickDoodle(index + 3)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-semibold tracking-tight text-white">{formatDate(day.date)}</p>
                    {isOffDay ? <AssignmentBadge inverse>Off Day</AssignmentBadge> : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <AssignmentField label="Shift" value={shiftName} inverse />
                    <AssignmentField label="Time" value={timeRange} inverse />
                    <AssignmentField label="Source" value={readString(day, ["source"], "-")} inverse />
                    <AssignmentField label="Timetable" value={readString(timetable, ["name", "code"], "-")} inverse />
                    <AssignmentField label="Expected Work" value={expectedWork} inverse />
                  </div>
                </SummaryPrimaryCard>
              )
            })}
          </div>
        ) : (
          <EmptyAssignmentCard message="No schedule preview has been published yet." doodle="doodle-curves" />
        )}
      </AssignmentSection>
    </div>
  )
}

type ProfileSummaryTabProps = {
  currentUser: AdminRecord | null
  employee: AdminRecord | null
  attendanceTodayRecord: AdminRecord | null
  dashboardActions: AdminRecord | null
  dashboardLeave: AdminRecord | null
  employmentStatus: AdminRecord | null
  scheduleDays: AdminRecord[]
  correctionRequests: AdminRecord[]
  profileUpdateRequests: AdminRecord[]
  openSectionEditor: (key: string, title: string, fields: EditableUserField[]) => void
}

function ProfileSummaryTab({
  currentUser,
  employee,
  attendanceTodayRecord,
  dashboardActions,
  dashboardLeave,
  correctionRequests,
  profileUpdateRequests,
  openSectionEditor,
}: ProfileSummaryTabProps) {
  const displayName = resolveDisplayName(currentUser, employee)
  const employeeNumber = resolveEmployeeNumber(currentUser, employee)
  const profilePhotoUrl = resolveProfilePhotoUrl(currentUser, employee)
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
  const employmentStatusLabel = readString(employee, ["employment_status", "status"], "Active")
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
  const punchState = formatPunchState(readString(attendanceTodayRecord, ["punch_state", "status"], ""))
  const processingState = formatProcessingState(readString(attendanceTodayRecord, ["processing_state"], ""))

  const email = readString(currentUser, ["email"], "-");
  const phone = readString(employee, ["phone", "phone_number"], "") || readString(currentUser, ["phone", "phone_number"], "-");
  const empId = readString(employee, ["id", "employee_id", "employeeId"], "-");

  // Project's own design, reference style only. Uniform system color via var(--primary) + doodles
  const infoCards = [
    {
      icon: UserIcon,
      label: "Personal",
      title: "Contact",
      items: [
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Employee ID: ${empId}`,
      ],
      stat1: "Email",
      stat2: "Phone",
      onEdit: () => openSectionEditor("contact-details", "Contact Details", ["first_name", "last_name", "email", "phone"]),
      editLabel: "Edit Profile",
    },
    {
      icon: Building2Icon,
      label: "Work",
      title: "Organization",
      items: [
        `Branch: ${branchLabel}`,
        `Department: ${departmentLabel}`,
        `Position: ${positionLabel}`,
      ],
      stat1: "Branch",
      stat2: "Dept",
    },
    {
      icon: UsersIcon,
      label: "Team",
      title: "Reporting",
      items: [
        `Reports To: ${manager.name || "-"}`,
        `Manager No: ${manager.employeeNo || "-"}`,
        `Full Name: ${displayName}`,
      ],
      stat1: "Manager",
      stat2: "Reports",
    },
    {
      icon: BriefcaseIcon,
      label: "Status",
      title: "Employment",
      items: [
        `Status: ${employmentStatusLabel}`,
        `Type: ${formatEmploymentType(employee?.employment_type)}`,
        `Hired: ${formatDate(employee?.hire_date)}`,
      ],
      stat1: "Active",
      stat2: "Full-time",
    },
  ];

  const checkInValue = formatUnknownValue(dashboardActions?.can_check_in);
  const checkInHint = formatDate(attendanceTodayRecord?.date);
  const checkOutValue = formatUnknownValue(dashboardActions?.can_check_out);
  const checkOutHint = readString(attendanceTodayRecord, ["first_punch", "first_punch_at"], "") || undefined;
  const leaveValue = String(readArray(dashboardLeave?.balances).length);
  const leaveHint = `${readArray(dashboardLeave?.pending_requests).length} pending · ${pendingCorrections} corrections · ${pendingProfileUpdates} profile updates`;
  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div 
        className="relative overflow-hidden rounded-2xl p-5 md:p-6 text-white"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <Doodle name="doodle-circles" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar className="size-16 ring-2 ring-white/30 md:size-20">
              {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-white/20 text-xl font-semibold text-white">
                {initials || "ME"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-white">{displayName}</h1>
                <Badge className="text-xs bg-white/20 text-white hover:bg-white/30 border-white/30">
                  {employmentStatusLabel}
                </Badge>
              </div>

              <div className="text-sm text-white/80">
                <span className="font-medium text-white">{employeeNumber}</span>
                <span className="mx-1.5 text-white/50">•</span>
                {positionLabel}
                <span className="mx-1.5 text-white/50">•</span>
                {departmentLabel}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-white/90">
                <CalendarIcon className="size-3" />
                Hired <span className="font-medium text-white">{formatDate(employee?.hire_date)}</span>
                <span className="text-white/40">·</span>
                <BriefcaseIcon className="size-3" />
                <span className="font-medium text-white">{formatEmploymentType(employee?.employment_type)}</span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => openSectionEditor("personal-details", "Personal Details", ["first_name", "last_name", "email", "phone"])}
          >
            <PencilIcon className="mr-1 size-3.5" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Status items on individual cards with pale system color + doodles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Today's Status */}
        <div 
          className="relative overflow-hidden rounded-2xl p-4 text-foreground" 
          style={{ backgroundColor: PALE_PRIMARY, color: 'var(--primary)' }}
        >
          <Doodle name="doodle-circles" />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Today&apos;s Status</p>
            <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">{punchState}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{processingState}</p>
          </div>
        </div>

        {/* Check In */}
        <div 
          className="relative overflow-hidden rounded-2xl p-4 text-foreground" 
          style={{ backgroundColor: PALE_PRIMARY, color: 'var(--primary)' }}
        >
          <Doodle name="doodle-curves" />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Check In</p>
            <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">{checkInValue}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{checkInHint}</p>
          </div>
        </div>

        {/* Check Out */}
        <div 
          className="relative overflow-hidden rounded-2xl p-4 text-foreground" 
          style={{ backgroundColor: PALE_PRIMARY, color: 'var(--primary)' }}
        >
          <Doodle name="doodle-grass" />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Check Out</p>
            <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">{checkOutValue}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{checkOutHint}</p>
          </div>
        </div>

        {/* Leave Balances */}
        <div 
          className="relative overflow-hidden rounded-2xl p-4 text-foreground" 
          style={{ backgroundColor: PALE_PRIMARY, color: 'var(--primary)' }}
        >
          <Doodle name="doodle-circles" />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Leave Balances</p>
            <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">{leaveValue}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{leaveHint}</p>
          </div>
        </div>
      </div>

      {/* My Info cards - pale system color */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {infoCards.map((card, index) => {
          const IconComp = card.icon;
          return (
            <div
              key={index}
              className="relative overflow-hidden rounded-2xl p-4 text-foreground flex flex-col min-h-[180px]"
              style={{ backgroundColor: PALE_PRIMARY, color: 'var(--primary)' }}
            >
              <Doodle name={index % 2 === 0 ? "doodle-circles" : "doodle-curves"} />
              <div className="relative z-10">
                {/* Header inspired by reference */}
                <div className="flex items-start justify-between">
                  <div className="text-xs font-medium uppercase tracking-[0.5px] text-muted-foreground">{card.label}</div>
                  <div className="flex items-center gap-2">
                    {card.onEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={card.onEdit}
                      >
                        <PencilIcon className="mr-1 size-3.5" />
                        {card.editLabel ?? "Edit"}
                      </Button>
                    ) : null}
                    <IconComp className="size-5 text-primary opacity-90" />
                  </div>
                </div>

                {/* Title */}
                <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">{card.title}</div>

                {/* Items - all visible, project's readable style */}
                <div className="mt-3 flex-1 space-y-1 text-sm leading-snug text-foreground opacity-95">
                  {card.items.map((item, i) => (
                    <div key={i}>{item}</div>
                  ))}
                </div>

                {/* Bottom stats row (reference style) */}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground border-t border-border/20 pt-3">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">•</span> {card.stat1}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">•</span> {card.stat2}
                  </div>
                  {card.label === "Personal" ? (
                    <button
                      type="button"
                      className="ml-auto font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => openSectionEditor("password", "Password", ["password"])}
                    >
                      Change Password
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
}


export function EmployeeSelfServiceProfileView() {
  const { loading, error, token, currentUser, employee } = useSelfEmployeeData()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeTab = (searchParams?.get("tab") as SelfProfileTab) || "summary"
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
    password: "",
    user_no: "",
    status: "",
    profile_photo_url: "",
  })
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
      password: "",
      user_no:
        readString(currentUser, ["user_no", "employee_no"], "") ||
        readString(employee, ["user_no", "employee_no", "employeeId"], ""),
      status: readString(currentUser, ["status"], "") || readString(employee, ["employment_status"], ""),
      profile_photo_url: "",
    }),
    [currentUser, employee]
  )

  const openSectionEditor = React.useCallback(
    (key: string, title: string, fields: EditableUserField[]) => {
      setSectionError(null)
      setSectionErrorLines([])
      setSectionValues(baseEditorValues)
      setSectionEditor({ key, title, fields })
    },
    [baseEditorValues]
  )

  const handleSectionFieldChange = React.useCallback((field: EditableUserField, value: string) => {
    setSectionValues((previous) => ({ ...previous, [field]: value }))
  }, [])

  const handleSectionSave = React.useCallback(async () => {
    if (!token || !sectionEditor) {
      setSectionError("Session expired. Please sign in again.")
      setSectionErrorLines([])
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
      const requestId = readNumber(createdRequest, ["id", "request_id"])
      if (requestId !== null) {
        await submitMyProfileUpdateRequest(token, requestId)
      }

      setMessage(`${sectionEditor.title} update submitted for HR approval.`)
      setSectionEditor(null)
      const profileUpdatesResult = await listMyProfileUpdateRequests(token, {
        page: 1,
        limit: 5,
      })
      setProfileUpdateRequests(profileUpdatesResult.rows)
    } catch (errorObject) {
      const lines = formatApiErrorLines(errorObject, "Failed to submit profile update request.")
      setSectionError(lines[0] ?? "Failed to submit profile update request.")
      setSectionErrorLines(lines)
    } finally {
      setSectionSaving(false)
    }
  }, [sectionEditor, sectionValues, token])

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
  const dashboardActions = React.useMemo(
    () => asRecord(dashboardOverview?.action_flags) ?? asRecord(attendanceTodayRecord?.action_flags),
    [attendanceTodayRecord, dashboardOverview]
  )
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
      {!loading && !error && (currentUser || employee) ? (
        <div key={activeTab} className="grid gap-4 animate-in slide-in-from-right-2 fade-in-0 duration-300">
          {activeTab === "summary" ? (
            <ProfileSummaryTab
              currentUser={currentUser}
              employee={employee}
              attendanceTodayRecord={attendanceTodayRecord}
              dashboardActions={dashboardActions}
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
                <div className="space-y-5">
                  {/* Contacts */}
                  <SelfServiceSectionCard title="Contacts" doodle="doodle-circles">
                    {Array.isArray(employee.contacts) && employee.contacts.length ? (
                      employee.contacts.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`contact-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Type</div>
                                  <div className="font-medium text-white">{readString(record, ["contact_type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Phone</div>
                                  <div className="font-medium text-white">{readString(record, ["phone_number", "phone"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Email</div>
                                  <div className="font-medium text-white">{readString(record, ["email"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Primary</div>
                                  <div className="font-medium text-white">{formatUnknownValue(record?.is_primary)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Verified</div>
                                  <div className="font-medium text-white">{formatUnknownValue(record?.is_verified)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Notes</div>
                                  <div className="font-medium text-white">{readString(record, ["notes"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No contacts available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Addresses */}
                  <SelfServiceSectionCard title="Addresses" doodle="doodle-curves">
                    {Array.isArray(employee.addresses) && employee.addresses.length ? (
                      employee.addresses.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`address-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Type</div>
                                  <div className="font-medium text-white">{readString(record, ["address_type", "type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Address</div>
                                  <div className="font-medium text-white">{readString(record, ["address_line", "address"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">City</div>
                                  <div className="font-medium text-white">{readString(record, ["city"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Country</div>
                                  <div className="font-medium text-white">{readString(record, ["country"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No addresses available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Relatives */}
                  <SelfServiceSectionCard title="Relatives" doodle="doodle-grass">
                    {Array.isArray(employee.relatives) && employee.relatives.length ? (
                      employee.relatives.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`relative-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Name</div>
                                  <div className="font-medium text-white">{readString(record, ["name", "full_name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Relationship</div>
                                  <div className="font-medium text-white">{readString(record, ["relationship"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Phone</div>
                                  <div className="font-medium text-white">{readString(record, ["phone_number", "phone"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No relatives available.</div>
                    )}
                  </SelfServiceSectionCard>
                </div>
              ) : null}

              {activeTab === "records" ? (
                <div className="space-y-5">
                  {/* Attendance Correction Requests */}
                  <SelfServiceSectionCard title="Attendance Correction Requests" doodle="doodle-circles">
                    {correctionRequests.length === 0 ? (
                      <div className="text-xs text-white/80">No attendance correction requests found.</div>
                    ) : (
                      correctionRequests.map((row, index) => {
                        const titleText =
                          readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                          readString(row, ["reason", "request_type", "change_type"], "Request")
                        const createdAt =
                          formatDateTime(row.created_at) !== "-" ? formatDateTime(row.created_at) : formatDate(row.date)
                        return (
                          <div key={String(row.id ?? index)} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <p className="font-medium text-white">{titleText}</p>
                              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                                {readString(row, ["status"], "draft")}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-white/70">{createdAt}</p>
                          </div>
                        )
                      })
                    )}
                  </SelfServiceSectionCard>

                  {/* Profile Update Requests */}
                  <SelfServiceSectionCard title="Profile Update Requests" doodle="doodle-curves">
                    {profileUpdateRequests.length === 0 ? (
                      <div className="text-xs text-white/80">No profile update requests found.</div>
                    ) : (
                      profileUpdateRequests.map((row, index) => {
                        const titleText =
                          readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                          readString(row, ["reason", "request_type", "change_type"], "Request")
                        const createdAt =
                          formatDateTime(row.created_at) !== "-" ? formatDateTime(row.created_at) : formatDate(row.date)
                        return (
                          <div key={String(row.id ?? index)} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <p className="font-medium text-white">{titleText}</p>
                              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                                {readString(row, ["status"], "draft")}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-white/70">{createdAt}</p>
                          </div>
                        )
                      })
                    )}
                  </SelfServiceSectionCard>

                  {/* Direct Reports Today */}
                  <SelfServiceSectionCard title="Direct Reports Today" doodle="doodle-grass">
                    {teamAttendance.length === 0 ? (
                      <div className="text-xs text-white/80">No team attendance rows were returned for your account.</div>
                    ) : (
                      teamAttendance.map((row, index) => {
                        const nestedEmployee = asRecord(row.employee)
                        const employeeLabel =
                          readString(row, ["employee_name", "full_name", "name"], "") ||
                          readString(nestedEmployee, ["full_name", "name"], "") ||
                          [readString(nestedEmployee, ["first_name"], ""), readString(nestedEmployee, ["last_name"], "")]
                            .filter(Boolean)
                            .join(" ") ||
                          "Direct report"
                        return (
                          <div key={String(row.id ?? index)} className={index > 0 ? "mt-2 border-t border-white/15 pt-2" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Employee</div>
                                  <div className="font-medium text-white">{employeeLabel}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Date</div>
                                  <div className="font-medium text-white">{formatDate(row.date ?? row.attendance_date)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Status</div>
                                  <div className="font-medium text-white">{readString(row, ["status", "attendance_status"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Check In</div>
                                  <div className="font-medium text-white">{formatUnknownValue(row.check_in_at ?? row.first_punch_at)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </SelfServiceSectionCard>
                </div>
              ) : null}

              {activeTab === "updates" ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Profile Update Requests
                    </div>
                    {profileUpdateRequests.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No profile update requests found.</div>
                    ) : (
                      <div className="space-y-3">
                      {profileUpdateRequests.map((row, index) => {
                        const titleText =
                          readString(row, ["title", "request_no", "reference_no", "reference"], "") ||
                          readString(row, ["reason", "request_type", "change_type"], "Profile update")
                        const createdAt =
                          formatDateTime(row.created_at) !== "-" ? formatDateTime(row.created_at) : formatDate(row.date)
                        const statusLabel = readString(row, ["status"], "draft")
                        return (
                          <div
                            key={String(row.id ?? index)}
                            className="relative overflow-hidden rounded-2xl border border-white/15 bg-primary p-4 text-primary-foreground"
                          >
                            <Doodle name={pickDoodle(index)} className="text-white/20" />
                            <div className="relative z-10 flex items-start justify-between gap-3">
                              <div className="space-y-2">
                                <p className="text-base font-semibold tracking-tight text-white">{titleText}</p>
                                <p className="text-xs text-white/70">{createdAt}</p>
                                {readString(row, ["reason"], "") ? (
                                  <p className="text-sm text-white/85">{readString(row, ["reason"], "")}</p>
                                ) : null}
                              </div>
                              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                                {statusLabel}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "records" && employee ? (
                <div className="space-y-5">
                  {/* Identifications */}
                  <SelfServiceSectionCard title="Identifications" doodle="doodle-circles">
                    {Array.isArray(employee.identifications) && employee.identifications.length ? (
                      employee.identifications.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`identification-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Type</div>
                                  <div className="font-medium text-white">{readString(record, ["identification_type", "type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Number</div>
                                  <div className="font-medium text-white">{readString(record, ["number", "id_number"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Issue Date</div>
                                  <div className="font-medium text-white">{formatDate(record?.issue_date)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Expiry Date</div>
                                  <div className="font-medium text-white">{formatDate(record?.expiry_date)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No identifications available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Bank Accounts */}
                  <SelfServiceSectionCard title="Bank Accounts" doodle="doodle-curves">
                    {Array.isArray(employee.bank_accounts) && employee.bank_accounts.length ? (
                      employee.bank_accounts.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`bank-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Bank Name</div>
                                  <div className="font-medium text-white">{readString(record, ["bank_name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Account Name</div>
                                  <div className="font-medium text-white">{readString(record, ["account_name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Account Number</div>
                                  <div className="font-medium text-white">{readString(record, ["account_number"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Currency</div>
                                  <div className="font-medium text-white">{readString(record, ["currency"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No bank accounts available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Academic Qualifications */}
                  <SelfServiceSectionCard title="Academic Qualifications" doodle="doodle-grass">
                    {Array.isArray(employee.academic_qualifications) && employee.academic_qualifications.length ? (
                      employee.academic_qualifications.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`academic-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Qualification</div>
                                  <div className="font-medium text-white">{readString(record, ["qualification", "name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Institution</div>
                                  <div className="font-medium text-white">{readString(record, ["institution"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Year</div>
                                  <div className="font-medium text-white">{readString(record, ["year"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No academic qualifications available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Professional Qualifications */}
                  <SelfServiceSectionCard title="Professional Qualifications" doodle="doodle-circles">
                    {Array.isArray(employee.professional_qualifications) && employee.professional_qualifications.length ? (
                      employee.professional_qualifications.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`professional-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Qualification</div>
                                  <div className="font-medium text-white">{readString(record, ["qualification", "name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Issuer</div>
                                  <div className="font-medium text-white">{readString(record, ["issuer", "institution"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Year</div>
                                  <div className="font-medium text-white">{readString(record, ["year"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No professional qualifications available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Experience Details */}
                  <SelfServiceSectionCard title="Experience Details" doodle="doodle-curves">
                    {Array.isArray(employee.experience_details) && employee.experience_details.length ? (
                      employee.experience_details.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`experience-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Company</div>
                                  <div className="font-medium text-white">{readString(record, ["company_name", "company"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Role</div>
                                  <div className="font-medium text-white">{readString(record, ["role", "position"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Start Date</div>
                                  <div className="font-medium text-white">{formatDate(record?.start_date)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">End Date</div>
                                  <div className="font-medium text-white">{formatDate(record?.end_date)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No experience details available.</div>
                    )}
                  </SelfServiceSectionCard>

                  {/* Documents */}
                  <SelfServiceSectionCard title="Documents" doodle="doodle-grass">
                    {Array.isArray(employee.documents) && employee.documents.length ? (
                      employee.documents.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`document-${index}`} className={index > 0 ? "mt-3 border-t border-white/15 pt-3" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Type</div>
                                  <div className="font-medium text-white">{readString(record, ["document_type", "type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Title</div>
                                  <div className="font-medium text-white">{readString(record, ["title", "name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Status</div>
                                  <div className="font-medium text-white">{readString(record, ["status"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-white/70">Uploaded At</div>
                                  <div className="font-medium text-white">{formatDate(record?.created_at)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-white/80">No documents available.</div>
                    )}
                  </SelfServiceSectionCard>
                </div>
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
                    <Label className="text-xs uppercase tracking-wide text-slate-500">{field.replaceAll("_", " ")}</Label>
                    <Input
                      type={field === "password" ? "password" : "text"}
                      value={sectionValues[field]}
                      placeholder={field === "password" ? "Leave blank to keep current password" : undefined}
                      onChange={(event) => handleSectionFieldChange(field, event.target.value)}
                    />
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
                <Button type="button" onClick={() => void handleSectionSave()} disabled={sectionSaving}>
                  {sectionSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Save Changes
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

  const [requestForm, setRequestForm] = React.useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })

  const employeeId = readNumber(employee, ["id", "employee_id"])
  const activeTab = tab

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
        const [requestsResult, typesResult] = await Promise.allSettled([
          listMyLeaveRequests(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          }),
          listLeaveTypes(token, { page: 1, limit: 100 }),
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

  const onRequestLeave = async (submit: boolean) => {
    if (!token || employeeId === null) {
      setMessage("Your profile is not ready for leave requests.")
      return
    }

    if (!requestForm.leave_type_id || !requestForm.start_date || !requestForm.end_date) {
      setMessage("Leave type and dates are required.")
      return
    }

    if (submit && !requestForm.reason.trim()) {
      setMessage("A reason is required before submitting the request.")
      return
    }

    if (availableLeaveTypes.length === 0) {
      setMessage("Leave requests cannot be created until leave types are available to your account.")
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await createMyLeaveRequest(token, {
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date ? `${requestForm.start_date}T00:00:00` : "",
        end_date: requestForm.end_date ? `${requestForm.end_date}T00:00:00` : "",
        reason: requestForm.reason.trim(),
        submit,
      })
      setRequestForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
      setMessage(submit ? "Leave request submitted." : "Leave request saved as a draft.")
      setRequestDialogOpen(false)
      await loadData()
    } catch (errorObject) {
      const text =
        errorObject instanceof Error
          ? errorObject.message
          : submit
            ? "Failed to submit leave request."
            : "Failed to save draft."
      setMessage(text)
    } finally {
      setLoading(false)
    }
  }

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
      const base = API_BASE_URL || "http://192.168.1.30:8888"
      const res = await fetch(`${base}/api/me/leave/requests/${id}/pdf`, {
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
    setLoading(true)
    setMessage(null)
    try {
      await submitMyLeaveRequest(token, id)
      setMessage("Leave request submitted.")
      await loadData()
    } catch (errorObject) {
      const text = errorObject instanceof Error ? errorObject.message : "Failed to submit request."
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
    tabContent = (
      <section className="space-y-4 px-4 py-2 lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">My Requests</h2>
          {requests.length > 0 && (
            <div className="flex gap-2">
              <Button type="button" onClick={() => setRequestDialogOpen(true)} className="sm:hidden bg-primary text-white hover:bg-primary/90 !text-white">
                New Leave Request
              </Button>
              <Button type="button" onClick={() => setRequestDialogOpen(true)} className="hidden sm:inline-flex bg-primary text-white hover:bg-primary/90 !text-white">
                New Leave Request
              </Button>
            </div>
          )}
        </div>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No leave requests found.</p>
            <Button
              type="button"
              onClick={() => setRequestDialogOpen(true)}
              className="mt-6 bg-primary text-white hover:bg-primary/90 !text-white"
            >
              New Leave Request
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((row, index) => {
              const id = readNumber(row, ["id"])
              const status = readString(row, ["status"], "pending").toLowerCase()
              const canCancel = ["pending", "draft"].includes(status)
              const statusMeta = resolveLeaveStatusMeta(status)
              return (
                <div key={String(row.id ?? index)} className="relative overflow-hidden rounded-2xl p-4 text-white" style={{ backgroundColor: 'var(--primary)' }}>
                  <Doodle name="doodle-circles" />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{readString(row, ["leave_no", "request_no", "reason"], "Request")}</p>
                      <Badge className={cn("border text-xs uppercase tracking-wide", statusMeta.badgeClassName)}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <p className="text-white/80">{formatDate(row.start_date)} to {formatDate(row.end_date)}</p>
                    <p className="text-white/80">{statusMeta.helperText || `Status: ${readString(row, ["status"], "pending")}`}</p>
                    <p className="text-white/80">Leave Type: {readString(asRecord(row.leave_type), ["name"], "-")}</p>
                    <div className="mt-2 flex gap-2">
                      {id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void onDownloadPdf(id)}
                          disabled={loading}
                          className="border-primary bg-primary text-white hover:bg-primary/90 hover:text-white"
                        >
                          Download PDF
                        </Button>
                      )}
                      {id && canCancel && (
                        <Button variant="destructive" size="sm" onClick={() => openCancelDialog(id)} disabled={loading} className="!text-white">
                          Cancel
                        </Button>
                      )}
                      {id && status === "draft" && (
                        <Button size="sm" onClick={() => void onSubmitRequest(id)} disabled={loading} className="bg-white/20 text-white hover:bg-white/30">
                          Submit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
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
            <DialogDescription>Save a draft or submit a new leave request without leaving this page.</DialogDescription>
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={requestForm.start_date} onChange={(event) => setRequestForm((prev) => ({ ...prev, start_date: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={requestForm.end_date} onChange={(event) => setRequestForm((prev) => ({ ...prev, end_date: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Textarea
                className="min-h-24"
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
              Save Draft
            </Button>
            <Button type="button" onClick={() => void onRequestLeave(true)} disabled={loading || availableLeaveTypes.length === 0} className="bg-primary text-white hover:bg-primary/90 !text-white">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
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
