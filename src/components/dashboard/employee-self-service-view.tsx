"use client"

import * as React from "react"
import {
  BriefcaseIcon,
  Building2Icon,
  CalendarIcon,
  ClockIcon,
  Loader2,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"

import { LumaSpin } from "@/components/ui/luma-spin"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

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
  listMyProfileUpdateRequests,
  listMyTeamAttendance,
  updateUserById,
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
type SelfProfileTab = "summary" | "assignments" | "personal" | "records"

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

function readNumberFromRecord(row: AdminRecord | null, keys: string[]) {
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

function resolveLoggedInUserId(currentUser: AdminRecord | null, token: string) {
  const tokenPayload = decodeJwtPayload(token)
  const tokenCandidates: Array<unknown> = [
    tokenPayload?.sub,
    tokenPayload?.user_id,
    tokenPayload?.id,
    asRecord(tokenPayload?.user)?.id,
  ]
  for (const candidate of tokenCandidates) {
    const value = readNumberish(candidate)
    if (value !== null) {
      return value
    }
  }

  const nestedUser = asRecord(currentUser?.user)
  const memberships = Array.isArray(currentUser?.memberships) ? currentUser.memberships : []
  const firstMembership = asRecord(memberships[0])
  const membershipUser = asRecord(firstMembership?.user)

  return (
    readNumberFromRecord(nestedUser, ["id", "user_id"]) ??
    readNumberFromRecord(membershipUser, ["id", "user_id"]) ??
    readNumberFromRecord(currentUser, ["user_id", "id"])
  )
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

function EmptyStateRow({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>
}

function CleanInfoRows({
  rows,
}: {
  rows: Array<{
    label: string
    value: string
  }>
}) {
  return (
    <div className="divide-y divide-border/70 text-sm">
      {rows.map((row, index) => (
        <InfoRow key={`${row.label}-${index}`} label={row.label} value={row.value} />
      ))}
    </div>
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

function resolveEmploymentStatusTone(status: string) {
  const normalized = status.trim().toLowerCase()
  if (!normalized || normalized === "-") {
    return "outline" as const
  }
  if (["active", "confirmed", "employed"].includes(normalized)) {
    return "default" as const
  }
  if (["probation", "pending", "on_leave", "on leave"].includes(normalized)) {
    return "secondary" as const
  }
  if (["inactive", "terminated", "resigned", "exited"].includes(normalized)) {
    return "destructive" as const
  }
  return "outline" as const
}

function SectionEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground transition hover:bg-muted hover:text-primary"
      aria-label={`Edit ${label}`}
      onClick={onClick}
    >
      <PencilIcon className="size-3.5" />
    </Button>
  )
}

function SectionHeading({ title, onEdit }: { title: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1">
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      {onEdit ? <SectionEditButton label={title} onClick={onEdit} /> : null}
    </div>
  )
}

function SummarySectionCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm md:p-5", className)}>
      {children}
    </div>
  )
}

function SelfServiceStatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function RequestStatusList({
  title,
  emptyText,
  rows,
}: {
  title: string
  emptyText: string
  rows: AdminRecord[]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {rows.length === 0 ? <EmptyStateRow text={emptyText} /> : null}
        {rows.map((row, index) => {
          const titleText =
            readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
            readString(row, ["reason", "request_type", "change_type"], "Request")
          const createdAt =
            formatDateTime(row.created_at) !== "-" ? formatDateTime(row.created_at) : formatDate(row.date)
          return (
            <div key={String(row.id ?? index)} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{titleText}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                  {readString(row, ["status"], "draft")}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{createdAt}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
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
  selfServiceNotes: string[]
  openSectionEditor: (key: string, title: string, fields: EditableUserField[]) => void
}

function ProfileSummaryTab({
  currentUser,
  employee,
  attendanceTodayRecord,
  dashboardActions,
  dashboardLeave,
  employmentStatus,
  scheduleDays,
  correctionRequests,
  profileUpdateRequests,
  selfServiceNotes,
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

  // Project's own design, reference style only (colored cards with header + icon, title, clear items list, bottom stats)
  const infoCards = [
    {
      color: "#1e40af", // deep blue - project friendly
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
    },
    {
      color: "#047857", // emerald
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
      color: "#b45309", // amber
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
      color: "#6d28d9", // violet
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

  return (
    <div className="space-y-6">
      {/* Clean Profile Header - project's own design */}
      <div className="rounded-2xl border bg-card p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar className="size-16 ring-2 ring-border md:size-20">
            {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={displayName} /> : null}
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initials || "ME"}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>
              <Badge variant={resolveEmploymentStatusTone(employmentStatusLabel)} className="text-xs">
                {employmentStatusLabel}
              </Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{employeeNumber}</span>
              <span className="mx-1.5 text-border">•</span>
              {positionLabel}
              <span className="mx-1.5 text-border">•</span>
              {departmentLabel}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>Hired {formatDate(employee?.hire_date)}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                <BriefcaseIcon className="size-3.5" />
                <span>{formatEmploymentType(employee?.employment_type)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Key Stats — clean and scannable (project's design) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SelfServiceStatCard label="Today's Status" value={punchState} hint={processingState || undefined} />
        <SelfServiceStatCard
          label="Check In"
          value={formatUnknownValue(dashboardActions?.can_check_in)}
          hint={formatDate(attendanceTodayRecord?.date)}
        />
        <SelfServiceStatCard
          label="Check Out"
          value={formatUnknownValue(dashboardActions?.can_check_out)}
          hint={
            readString(attendanceTodayRecord, ["first_punch", "first_punch_at"], "") || undefined
          }
        />
        <SelfServiceStatCard
          label="Leave Balances"
          value={String(readArray(dashboardLeave?.balances).length)}
          hint={`${readArray(dashboardLeave?.pending_requests).length} pending · ${pendingCorrections} corrections`}
        />
      </div>

      {/* My Info cards - project's own Tailwind design (reference only for layout/colored cards + header/icon/title/items/stats) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {infoCards.map((card, index) => {
          const IconComp = card.icon;
          return (
            <div
              key={index}
              className="rounded-2xl p-4 text-white flex flex-col min-h-[180px]"
              style={{ backgroundColor: card.color }}
            >
              {/* Header inspired by reference */}
              <div className="flex items-start justify-between">
                <div className="text-xs font-medium uppercase tracking-[0.5px] opacity-80">{card.label}</div>
                <IconComp className="size-5 opacity-90" />
              </div>

              {/* Title */}
              <div className="mt-2 text-lg font-semibold tracking-tight">{card.title}</div>

              {/* Items - all visible, project's readable style */}
              <div className="mt-3 flex-1 space-y-1 text-sm leading-snug opacity-95">
                {card.items.map((item, i) => (
                  <div key={i}>{item}</div>
                ))}
              </div>

              {/* Bottom stats row (reference style) */}
              <div className="mt-4 flex items-center gap-4 text-xs opacity-80 border-t border-white/20 pt-3">
                <div className="flex items-center gap-1">
                  <span className="font-medium">•</span> {card.stat1}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">•</span> {card.stat2}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selfServiceNotes.length > 0 ? (
        <SummarySectionCard>
          <SectionHeading title="Notes" />
          <div className="space-y-2 text-sm text-muted-foreground">
            {selfServiceNotes.map((note, index) => (
              <p key={`${note}-${index}`} className="leading-relaxed">
                {note}
              </p>
            ))}
          </div>
        </SummarySectionCard>
      ) : null}
    </div>
  )
}


export function EmployeeSelfServiceProfileView() {
  const { loading, error, token, currentUser, employee, refresh } = useSelfEmployeeData()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeTab = (searchParams?.get("tab") as SelfProfileTab) || "summary"
  const [message, setMessage] = React.useState<string | null>(null)
  const tabs: Array<{ key: SelfProfileTab; label: string }> = [
    { key: "summary", label: "Summary" },
    { key: "assignments", label: "Assignments" },
    { key: "personal", label: "Personal" },
    { key: "records", label: "Records" },
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
  const [selfServiceNotes, setSelfServiceNotes] = React.useState<string[]>([])
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
  const loggedInUserId = React.useMemo(() => resolveLoggedInUserId(currentUser, token), [currentUser, token])

  const baseEditorValues = React.useMemo(
    () => ({
      first_name: readString(currentUser, ["first_name", "firstName"], ""),
      last_name: readString(currentUser, ["last_name", "lastName"], ""),
      phone: readString(currentUser, ["phone", "phone_number"], ""),
      email: readString(currentUser, ["email"], ""),
      password: "",
      user_no: readString(currentUser, ["user_no", "employee_no"], ""),
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
    if (loggedInUserId === null) {
      setSectionError("Unable to resolve user id for section update.")
      setSectionErrorLines([])
      return
    }
    const payload: AdminRecord = {}
    for (const field of sectionEditor.fields) {
      const nextValue = sectionValues[field].trim()
      if (field === "password") {
        if (nextValue) {
          payload.password = nextValue
        }
        continue
      }
      if (nextValue) {
        payload[field] = nextValue
      }
    }
    if (!Object.keys(payload).length) {
      setSectionError("Nothing to update for this section.")
      setSectionErrorLines([])
      return
    }
    setSectionSaving(true)
    setSectionError(null)
    setSectionErrorLines([])
    try {
      await updateUserById(loggedInUserId, token, payload)
      setMessage(`${sectionEditor.title} updated successfully.`)
      setSectionEditor(null)
      await refresh()
    } catch (errorObject) {
      const lines = formatApiErrorLines(errorObject, "Failed to update profile section.")
      setSectionError(lines[0] ?? "Failed to update profile section.")
      setSectionErrorLines(lines)
    } finally {
      setSectionSaving(false)
    }
  }, [loggedInUserId, refresh, sectionEditor, sectionValues, token])

  React.useEffect(() => {
    if (!token) {
      setDashboardOverview(null)
      setEmploymentStatus(null)
      setAttendanceOverview(null)
      setAttendanceAssignments(null)
      setTeamAttendance([])
      setCorrectionRequests([])
      setProfileUpdateRequests([])
      setSelfServiceNotes([])
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
      listMyProfileUpdateRequests(token, { page: 1, limit: 5, sortBy: "created_at", sortOrder: "DESC" }),
    ]).then((results) => {
      if (cancelled) {
        return
      }

      const notes: string[] = []
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
        const message = correctionsResult.reason instanceof Error ? correctionsResult.reason.message : ""
        if (message) {
          notes.push(`Correction requests: ${message}`)
        }
      }

      if (profileUpdatesResult.status === "fulfilled") {
        setProfileUpdateRequests(profileUpdatesResult.value.rows)
      } else {
        setProfileUpdateRequests([])
        const message =
          profileUpdatesResult.reason instanceof Error ? profileUpdatesResult.reason.message : ""
        if (message) {
          notes.push(`Profile update requests: ${message}`)
        }
      }

      setSelfServiceNotes(notes)
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
              selfServiceNotes={selfServiceNotes}
              openSectionEditor={openSectionEditor}
            />
          ) : null}

          {activeTab === "assignments" && employee ? (
            <div className="space-y-5">
              {/* Department Assignments */}
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Department Assignments</div>
                {Array.isArray(employee.departments) && employee.departments.length ? (
                  employee.departments.map((entry, index) => {
                    const record = asRecord(entry)
                    const department = asRecord(record?.department)
                    const branch = asRecord(department?.branch)
                    return (
                      <div key={`department-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <div className="flex gap-2.5">
                            <Building2Icon className="mt-0.5 size-3.5 text-primary shrink-0" />
                            <div>
                              <div className="text-muted-foreground">Department</div>
                              <div className="font-medium text-foreground">{readString(department, ["name", "department_name"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Code</div>
                              <div className="font-medium text-foreground">{readString(department, ["code"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <MapPinIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                            <div>
                              <div className="text-muted-foreground">Branch</div>
                              <div className="font-medium text-foreground">{readString(branch, ["name", "branch_name"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Primary</div>
                              <div className="font-medium text-foreground">{formatUnknownValue(record?.is_primary)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Status</div>
                              <div className="font-medium text-foreground">{readString(department, ["status"], "-")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-xs text-muted-foreground">No department assignments available.</div>
                )}
              </div>

              <div className="border-t border-border/50" />

              {/* Position Assignments */}
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Position Assignments</div>
                {Array.isArray(employee.position_assignments) && employee.position_assignments.length ? (
                  employee.position_assignments.map((entry, index) => {
                    const record = asRecord(entry)
                    const position = asRecord(record?.position)
                    const designation = asRecord(record?.designation)
                    return (
                      <div key={`position-assignment-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <div className="flex gap-2.5">
                            <BriefcaseIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                            <div>
                              <div className="text-muted-foreground">Position</div>
                              <div className="font-medium text-foreground">{readString(position, ["name", "position_name"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Designation</div>
                              <div className="font-medium text-foreground">{readString(designation, ["name", "designation_name"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Assignment Type</div>
                              <div className="font-medium text-foreground">{readString(record, ["assignment_type"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Status</div>
                              <div className="font-medium text-foreground">{readString(record, ["status"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <CalendarIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                            <div>
                              <div className="text-muted-foreground">Start Date</div>
                              <div className="font-medium text-foreground">{formatDate(record?.start_date)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">End Date</div>
                              <div className="font-medium text-foreground">{formatDate(record?.end_date)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Primary</div>
                              <div className="font-medium text-foreground">{formatUnknownValue(record?.is_primary)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Notes</div>
                              <div className="font-medium text-foreground">{readString(record, ["notes"], "-")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-xs text-muted-foreground">No position assignments available.</div>
                )}
              </div>

              <div className="border-t border-border/50" />

              {/* Designation Assignments */}
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Designation Assignments</div>
                {Array.isArray(employee.designation_assignments) && employee.designation_assignments.length ? (
                  employee.designation_assignments.map((entry, index) => {
                    const record = asRecord(entry)
                    const designation = asRecord(record?.designation)
                    return (
                      <div key={`designation-assignment-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                        <div className="grid gap-3 sm:grid-cols-2 text-xs">
                          <div className="flex gap-2.5">
                            <BriefcaseIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                            <div>
                              <div className="text-muted-foreground">Designation</div>
                              <div className="font-medium text-foreground">{readString(designation, ["name", "designation_name"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Code</div>
                              <div className="font-medium text-foreground">{readString(designation, ["code"], "-")}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Current</div>
                              <div className="font-medium text-foreground">{formatUnknownValue(record?.is_current)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <CalendarIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                            <div>
                              <div className="text-muted-foreground">Start Date</div>
                              <div className="font-medium text-foreground">{formatDate(record?.start_date)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">End Date</div>
                              <div className="font-medium text-foreground">{formatDate(record?.end_date)}</div>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div>
                              <div className="text-muted-foreground">Remarks</div>
                              <div className="font-medium text-foreground">{readString(record, ["remarks"], "-")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-xs text-muted-foreground">No designation assignments available.</div>
                )}
              </div>

              <div className="border-t border-border/50" />

              {/* Attendance Assignment Summary */}
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attendance Assignment Summary</div>
                {assignmentSummaryRows.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    {assignmentSummaryRows.map((row, idx) => (
                      <div key={idx} className="flex gap-2.5">
                        <div>
                          <div className="text-muted-foreground">{row.label}</div>
                          <div className="font-medium text-foreground">{row.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No attendance assignment summary is available yet.</div>
                )}
              </div>

              <div className="border-t border-border/50" />

              {/* Upcoming Schedule Preview */}
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Upcoming Schedule Preview</div>
                {scheduleDays.length ? (
                  <div className="space-y-3 text-xs">
                    {scheduleDays.slice(0, 5).map((day, index) => {
                      const shift = asRecord(day.shift)
                      const timetable = asRecord(day.timetable)
                      return (
                        <div key={String(day.date ?? index)} className={index > 0 ? "pt-3 border-t border-border/50" : ""}>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex gap-2.5">
                              <CalendarIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                              <div>
                                <div className="text-muted-foreground">Date</div>
                                <div className="font-medium text-foreground">{formatDate(day.date)}</div>
                              </div>
                            </div>
                            <div className="flex gap-2.5">
                              <div>
                                <div className="text-muted-foreground">Source</div>
                                <div className="font-medium text-foreground">{readString(day, ["source"], "-")}</div>
                              </div>
                            </div>
                            <div className="flex gap-2.5">
                              <div>
                                <div className="text-muted-foreground">Shift</div>
                                <div className="font-medium text-foreground">{readString(shift, ["name", "code"], "-")}</div>
                              </div>
                            </div>
                            <div className="flex gap-2.5">
                              <div>
                                <div className="text-muted-foreground">Time</div>
                                <div className="font-medium text-foreground">{`${readString(shift, ["start_time"], "-")} to ${readString(shift, ["end_time"], "-")}`}</div>
                              </div>
                            </div>
                            <div className="flex gap-2.5">
                              <div>
                                <div className="text-muted-foreground">Timetable</div>
                                <div className="font-medium text-foreground">{readString(timetable, ["name", "code"], "-")}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No schedule preview has been published yet.</div>
                )}
              </div>
            </div>
          ) : null}

              {activeTab === "personal" && employee ? (
                <div className="space-y-5">
                  {/* Contacts */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contacts</div>
                    {Array.isArray(employee.contacts) && employee.contacts.length ? (
                      employee.contacts.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`contact-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Type</div>
                                  <div className="font-medium text-foreground">{readString(record, ["contact_type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Phone</div>
                                  <div className="font-medium text-foreground">{readString(record, ["phone_number", "phone"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Email</div>
                                  <div className="font-medium text-foreground">{readString(record, ["email"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Primary</div>
                                  <div className="font-medium text-foreground">{formatUnknownValue(record?.is_primary)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Verified</div>
                                  <div className="font-medium text-foreground">{formatUnknownValue(record?.is_verified)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Notes</div>
                                  <div className="font-medium text-foreground">{readString(record, ["notes"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No contacts available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Addresses */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Addresses</div>
                    {Array.isArray(employee.addresses) && employee.addresses.length ? (
                      employee.addresses.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`address-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Type</div>
                                  <div className="font-medium text-foreground">{readString(record, ["address_type", "type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Address</div>
                                  <div className="font-medium text-foreground">{readString(record, ["address_line", "address"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">City</div>
                                  <div className="font-medium text-foreground">{readString(record, ["city"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Country</div>
                                  <div className="font-medium text-foreground">{readString(record, ["country"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No addresses available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Relatives */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Relatives</div>
                    {Array.isArray(employee.relatives) && employee.relatives.length ? (
                      employee.relatives.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`relative-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Name</div>
                                  <div className="font-medium text-foreground">{readString(record, ["name", "full_name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Relationship</div>
                                  <div className="font-medium text-foreground">{readString(record, ["relationship"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Phone</div>
                                  <div className="font-medium text-foreground">{readString(record, ["phone_number", "phone"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No relatives available.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "records" ? (
                <div className="space-y-5">
                  {/* Attendance Correction Requests */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attendance Correction Requests</div>
                    {correctionRequests.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No attendance correction requests found.</div>
                    ) : (
                      correctionRequests.map((row, index) => {
                        const titleText =
                          readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                          readString(row, ["reason", "request_type", "change_type"], "Request")
                        const createdAt =
                          formatDateTime(row.created_at) !== "-" ? formatDateTime(row.created_at) : formatDate(row.date)
                        return (
                          <div key={String(row.id ?? index)} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <p className="font-medium text-foreground">{titleText}</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {readString(row, ["status"], "draft")}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{createdAt}</p>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Profile Update Requests */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Profile Update Requests</div>
                    {profileUpdateRequests.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No profile update requests found.</div>
                    ) : (
                      profileUpdateRequests.map((row, index) => {
                        const titleText =
                          readString(row, ["title", "request_no", "leave_no", "reference_no", "reference"], "") ||
                          readString(row, ["reason", "request_type", "change_type"], "Request")
                        const createdAt =
                          formatDateTime(row.created_at) !== "-" ? formatDateTime(row.created_at) : formatDate(row.date)
                        return (
                          <div key={String(row.id ?? index)} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="flex items-start justify-between gap-3 text-xs">
                              <p className="font-medium text-foreground">{titleText}</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {readString(row, ["status"], "draft")}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">{createdAt}</p>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Direct Reports Today */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Direct Reports Today</div>
                    {teamAttendance.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No team attendance rows were returned for your account.</div>
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
                          <div key={String(row.id ?? index)} className={index > 0 ? "mt-2 pt-2 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Employee</div>
                                  <div className="font-medium text-foreground">{employeeLabel}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Date</div>
                                  <div className="font-medium text-foreground">{formatDate(row.date ?? row.attendance_date)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Status</div>
                                  <div className="font-medium text-foreground">{readString(row, ["status", "attendance_status"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Check In</div>
                                  <div className="font-medium text-foreground">{formatUnknownValue(row.check_in_at ?? row.first_punch_at)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "records" && employee ? (
                <div className="space-y-5">
                  {/* Identifications */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Identifications</div>
                    {Array.isArray(employee.identifications) && employee.identifications.length ? (
                      employee.identifications.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`identification-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Type</div>
                                  <div className="font-medium text-foreground">{readString(record, ["identification_type", "type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Number</div>
                                  <div className="font-medium text-foreground">{readString(record, ["number", "id_number"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Issue Date</div>
                                  <div className="font-medium text-foreground">{formatDate(record?.issue_date)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Expiry Date</div>
                                  <div className="font-medium text-foreground">{formatDate(record?.expiry_date)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No identifications available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Bank Accounts */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Bank Accounts</div>
                    {Array.isArray(employee.bank_accounts) && employee.bank_accounts.length ? (
                      employee.bank_accounts.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`bank-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Bank Name</div>
                                  <div className="font-medium text-foreground">{readString(record, ["bank_name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Account Name</div>
                                  <div className="font-medium text-foreground">{readString(record, ["account_name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Account Number</div>
                                  <div className="font-medium text-foreground">{readString(record, ["account_number"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Currency</div>
                                  <div className="font-medium text-foreground">{readString(record, ["currency"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No bank accounts available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Academic Qualifications */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Academic Qualifications</div>
                    {Array.isArray(employee.academic_qualifications) && employee.academic_qualifications.length ? (
                      employee.academic_qualifications.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`academic-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Qualification</div>
                                  <div className="font-medium text-foreground">{readString(record, ["qualification", "name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Institution</div>
                                  <div className="font-medium text-foreground">{readString(record, ["institution"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Year</div>
                                  <div className="font-medium text-foreground">{readString(record, ["year"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No academic qualifications available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Professional Qualifications */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Professional Qualifications</div>
                    {Array.isArray(employee.professional_qualifications) && employee.professional_qualifications.length ? (
                      employee.professional_qualifications.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`professional-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Qualification</div>
                                  <div className="font-medium text-foreground">{readString(record, ["qualification", "name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Issuer</div>
                                  <div className="font-medium text-foreground">{readString(record, ["issuer", "institution"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Year</div>
                                  <div className="font-medium text-foreground">{readString(record, ["year"], "-")}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No professional qualifications available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Experience Details */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Experience Details</div>
                    {Array.isArray(employee.experience_details) && employee.experience_details.length ? (
                      employee.experience_details.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`experience-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Company</div>
                                  <div className="font-medium text-foreground">{readString(record, ["company_name", "company"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Role</div>
                                  <div className="font-medium text-foreground">{readString(record, ["role", "position"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Start Date</div>
                                  <div className="font-medium text-foreground">{formatDate(record?.start_date)}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">End Date</div>
                                  <div className="font-medium text-foreground">{formatDate(record?.end_date)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No experience details available.</div>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Documents */}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Documents</div>
                    {Array.isArray(employee.documents) && employee.documents.length ? (
                      employee.documents.map((entry, index) => {
                        const record = asRecord(entry)
                        return (
                          <div key={`document-${index}`} className={index > 0 ? "mt-3 pt-3 border-t border-border/50" : ""}>
                            <div className="grid gap-3 sm:grid-cols-2 text-xs">
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Type</div>
                                  <div className="font-medium text-foreground">{readString(record, ["document_type", "type"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Title</div>
                                  <div className="font-medium text-foreground">{readString(record, ["title", "name"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Status</div>
                                  <div className="font-medium text-foreground">{readString(record, ["status"], "-")}</div>
                                </div>
                              </div>
                              <div className="flex gap-2.5">
                                <div>
                                  <div className="text-muted-foreground">Uploaded At</div>
                                  <div className="font-medium text-foreground">{formatDate(record?.created_at)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground">No documents available.</div>
                    )}
                  </div>
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
    <div className="grid gap-4 px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Promotion</CardTitle>
          <CardDescription>Promotion updates will appear here when they are available.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10">
              <LumaSpin />
              <p className="text-sm text-muted-foreground">Loading promotion context...</p>
            </div>
          ) : null}
          {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center">
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-semibold text-foreground">No promotion updates right now</h3>
                <p className="text-sm text-muted-foreground">
                  You do not have any active promotion records at the moment. HR or your manager will update this page when something changes.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
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
  const leaveTabs = [
    { key: "requests", label: "Requests" },
    { key: "balances", label: "Balances" },
    { key: "holidays", label: "Holidays" },
    { key: "policies", label: "Policies" },
  ] as const
  const [activeTab, setActiveTab] = React.useState<SelfLeaveTab>(tab)

  React.useEffect(() => {
    setActiveTab(tab)
  }, [tab])

  const setActiveLeaveTab = React.useCallback((nextTab: SelfLeaveTab) => {
    setActiveTab(nextTab)
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/dashboard/me/leave/${nextTab}`)
    }
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
      const requestsResult = await listMyLeaveRequests(token, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
      })
      setRequests(requestsResult.rows)

      const [typesResult, balancesResult, holidaysResult, policiesResult] = await Promise.allSettled([
        listLeaveTypes(token, { page: 1, limit: 100 }),
        listMyLeaveBalances(token, { page: 1, limit: 100 }),
        listAttendanceHolidays(token, { page: 1, limit: 365 }),
        listLeavePolicies(token, { page: 1, limit: 100 }),
      ])

      if (typesResult.status === "fulfilled") {
        setLeaveTypes(typesResult.value.rows)
      } else {
        setLeaveTypes([])
        setLeaveTypesError(readEndpointError(typesResult.reason, "Failed to load leave types."))
      }

      if (balancesResult.status === "fulfilled") {
        setBalances(balancesResult.value.rows)
        setLeaveBalancesFull(balancesResult.value)
      } else {
        setBalances([])
        setLeaveBalancesFull(null)
        setBalancesError(readEndpointError(balancesResult.reason, "Failed to load leave balances."))
      }

      if (holidaysResult.status === "fulfilled") {
        setHolidays(holidaysResult.value.rows)
      } else {
        setHolidays([])
        setHolidaysError(readEndpointError(holidaysResult.reason, "Failed to load holiday calendar."))
      }

      if (policiesResult.status === "fulfilled") {
        setPolicies(policiesResult.value.rows)
      } else {
        setPolicies([])
        setPoliciesError(readEndpointError(policiesResult.reason, "Failed to load leave policies."))
      }
    } catch (errorObject) {
      const text = errorObject instanceof Error ? errorObject.message : "Failed to load leave data."
      setError(text)
    } finally {
      setLoading(false)
    }
  }, [employeeId, readEndpointError, token])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  const onRequestLeave = async () => {
    if (!token || employeeId === null) {
      setMessage("Your profile is not ready for leave requests.")
      return
    }

    if (!requestForm.leave_type_id || !requestForm.start_date || !requestForm.end_date || !requestForm.reason.trim()) {
      setMessage("Leave type, dates, and reason are required.")
      return
    }

    if (availableLeaveTypes.length === 0) {
      setMessage("Leave requests cannot be submitted until leave types are available to your account.")
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
        submit: true,
      })
      setRequestForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
      setMessage("Leave request submitted.")
      setRequestDialogOpen(false)
      setActiveLeaveTab("requests")
      await loadData()
    } catch (errorObject) {
      const text =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to submit leave request."
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
      <div className="space-y-4 px-4 lg:px-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Button type="button" onClick={() => setRequestDialogOpen(true)} className="sm:hidden">
                New Leave Request
              </Button>
            </div>
            <Button type="button" onClick={() => setRequestDialogOpen(true)} className="hidden sm:inline-flex sm:self-start">
              New Leave Request
            </Button>
          </div>
          <div className="space-y-2 pt-3">
            <div className="space-y-1">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">My Requests</h2>
            </div>
            {requests.length === 0 ? <p className="text-sm text-slate-500">No leave requests found.</p> : null}
            {requests.map((row, index) => {
              const id = readNumber(row, ["id"])
              const status = readString(row, ["status"], "pending").toLowerCase()
              const canCancel = ["pending", "draft"].includes(status)
              return (
                <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{readString(row, ["leave_no", "request_no", "reason"], "Request")}</p>
                  <p className="text-slate-600 dark:text-slate-300">{formatDate(row.start_date)} to {formatDate(row.end_date)}</p>
                  <p className="text-slate-600 dark:text-slate-300">Status: {readString(row, ["status"], "pending")}</p>
                  <p className="text-slate-600 dark:text-slate-300">Leave Type: {readString(asRecord(row.leave_type), ["name"], "-")}</p>
                  <div className="mt-2 flex gap-2">
                    {id && (
                      <Button variant="outline" size="sm" onClick={() => void onDownloadPdf(id)} disabled={loading}>
                        Download PDF
                      </Button>
                    )}
                    {id && canCancel && (
                      <Button variant="destructive" size="sm" onClick={() => openCancelDialog(id)} disabled={loading}>
                        Cancel
                      </Button>
                    )}
                    {id && status === "draft" && (
                      <Button size="sm" onClick={() => void onSubmitRequest(id)} disabled={loading}>
                        Submit
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {message ? <p className="text-sm text-slate-700 md:col-span-2 dark:text-slate-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
      </div>
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
        <div className="space-y-2">
          {balances.map((row, index) => (
            <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-medium">{readString(asRecord(row.leave_type), ["name"], "Leave type")}</p>
              <p className="text-slate-600 dark:text-slate-300">Fiscal Year: {readString(row, ["fiscal_year"], fiscalYear)}</p>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                <div>Allocated: {String(row.allocated_days ?? "-")}</div>
                <div>Used: {String(row.used_days ?? "-")}</div>
                <div>Pending: {String(row.pending_days ?? "-")}</div>
                <div>Available: {String(row.available_days ?? row.remaining_days ?? "-")}</div>
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
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-sm text-slate-500">
            No holidays were returned by `/api/attendance/holidays`.
          </div>
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
              <div key={String(row.id ?? index)} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-foreground">{readString(row, ["name", "title"], "Holiday")}</p>
                  {holidayType ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                      {holidayType}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-slate-600 dark:text-slate-300">{dateLabel}</p>
                {holidayBranch ? <p className="mt-1 text-xs text-slate-500">Branch: {holidayBranch}</p> : null}
                {holidayDescription ? <p className="mt-2 text-xs text-slate-500">{holidayDescription}</p> : null}
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
            <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-medium">{readString(row, ["name"], "Policy")}</p>
              <p className="text-slate-600 dark:text-slate-300">Status: {readString(row, ["status"], "-")}</p>
              <p className="text-slate-600 dark:text-slate-300">Accrual: {readString(row, ["accrual_method"], "-")}</p>
            </div>
          ))}
        </div>
        {showPoliciesError ? <p className="text-sm text-slate-500">{policiesError}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    )
  }

  return (
    <div>
      <div className="sticky top-(--header-height) z-40 mb-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="glass-scrollbar overflow-x-auto">
          <div className="inline-flex min-w-full items-center gap-4 border-b border-border/80">
            {leaveTabs.map((t) => {
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveLeaveTab(t.key)}
                  className={cn(
                    "border-b-2 px-1 py-2 text-[0.92rem] font-medium whitespace-nowrap transition-colors duration-200",
                    isActive
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  )}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {tabContent}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogPopup className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>Submit a new leave request without leaving this page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Leave Type</Label>
              <Select value={requestForm.leave_type_id} onValueChange={(value) => setRequestForm((prev) => ({ ...prev, leave_type_id: value ?? "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder={availableLeaveTypes.length > 0 ? "Select leave type" : "No leave types available"} />
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
              <textarea
                className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            <Button type="button" onClick={() => void onRequestLeave()} disabled={loading || availableLeaveTypes.length === 0}>
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
            <textarea
              id="cancel-reason"
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
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
