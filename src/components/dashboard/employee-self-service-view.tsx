"use client"

import * as React from "react"
import { HorizontalScrollContainer } from "@/components/common/horizontal-scroll-container"
import { Camera, Loader2, Pencil, X } from "lucide-react"

import {
  createMyLeaveRequest,
  getCurrentEmployee,
  getEmployeeById,
  getCurrentAdmin,
  listAttendanceHolidays,
  listBranches,
  listDepartments,
  listEmployees,
  listMyLeaveBalances,
  listLeavePolicies,
  listMyLeaveRequests,
  listLeaveTypes,
  updateUserById,
  type AdminRecord,
} from "@/lib/admin-api"
import { API_BASE_URL, AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string" && reader.result.trim()) {
        resolve(reader.result)
        return
      }
      reject(new Error("Could not read the selected file."))
    }
    reader.onerror = () => reject(new Error("Could not read the selected file."))
    reader.readAsDataURL(file)
  })
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
    <div className="flex min-w-0 flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 break-words font-medium text-slate-900 sm:text-right dark:text-slate-100">{value}</span>
    </div>
  )
}

function EmptyStateRow({ text }: { text: string }) {
  return <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
}

function WaveInfoRows({
  rows,
}: {
  rows: Array<{
    label: string
    value: string
  }>
}) {
  return (
    <div className="space-y-1">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="space-y-1">
          <InfoRow label={row.label} value={row.value} />
          {index < rows.length - 1 ? <div className="profile-wave-separator" aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  )
}

type WaveSeparatorVariant = "subtle" | "layered"

function WaveSeparator({
  variant = "subtle",
  inverted = false,
  className,
}: {
  variant?: WaveSeparatorVariant
  inverted?: boolean
  className?: string
}) {
  return (
    <div
      className={`profile-section-wave ${className ?? ""}`.trim()}
      data-variant={variant}
      data-inverted={inverted ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="profile-section-wave__layer profile-section-wave__layer--one" />
      <div className="profile-section-wave__layer profile-section-wave__layer--two" />
      <div className="profile-section-wave__glow" />
    </div>
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

function SectionEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7 text-slate-500 transition-all duration-300 hover:-translate-y-0.5 hover:text-primary"
      aria-label={`Edit ${label}`}
      onClick={onClick}
    >
      <Pencil className="size-3.5 transition-transform duration-300 hover:rotate-12" />
    </Button>
  )
}

function SectionHeading({
  title,
  onEdit,
}: {
  title: string
  onEdit?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {onEdit ? <SectionEditButton label={title} onClick={onEdit} /> : null}
    </div>
  )
}

export function EmployeeSelfServiceProfileView() {
  const { loading, error, token, currentUser, employee, refresh } = useSelfEmployeeData()
  const profilePhotoInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isEditing, setIsEditing] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<SelfProfileTab>("summary")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const profilePhotoUrl =
    readString(employee, ["profile_photo_url"], "") ||
    readString(asRecord(employee?.company_user), ["profile_photo_url"], "") ||
    readString(asRecord(asRecord(employee?.company_user)?.user), ["profile_photo_url"], "")
  const fullName =
    readString(employee, ["full_name", "fullName", "name"], "") ||
    [readString(employee, ["first_name"], ""), readString(employee, ["last_name"], "")]
      .filter(Boolean)
      .join(" ") ||
    [readString(currentUser, ["first_name"], ""), readString(currentUser, ["last_name"], "")]
      .filter(Boolean)
      .join(" ")
  const initials = (fullName || readString(currentUser, ["email"], "U"))
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
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
  const [profilePhotoSaving, setProfilePhotoSaving] = React.useState(false)
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

  React.useEffect(() => {
    if (!currentUser && !employee) {
      return
    }
    setFirstName(readString(currentUser, ["first_name", "firstName"], ""))
    setLastName(readString(currentUser, ["last_name", "lastName"], ""))
    setEmail(readString(currentUser, ["email"], ""))
    const companyUser = asRecord(employee?.company_user)
    const nestedUser = asRecord(companyUser?.user)
    const linkedUser = nestedUser ?? companyUser
    const linkedPhone = readString(linkedUser, ["phone", "phone_number"], "")
    const myPhone = readString(currentUser, ["phone", "phone_number"], "")
    setPhoneNumber(myPhone || linkedPhone)
  }, [currentUser, employee])

  const handleProfileUpdate = async () => {
    if (!token) {
      setMessage("Session expired. Please sign in again.")
      return
    }
    if (loggedInUserId === null) {
      setMessage("Unable to resolve user id for profile update.")
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const payload: AdminRecord = {}
      if (firstName.trim()) {
        payload.first_name = firstName.trim()
      }
      if (lastName.trim()) {
        payload.last_name = lastName.trim()
      }
      if (email.trim()) {
        payload.email = email.trim()
      }
      if (phoneNumber.trim()) {
        payload.phone = phoneNumber.trim()
      }
      if (!Object.keys(payload).length) {
        setMessage("Nothing to update.")
        return
      }

      await updateUserById(loggedInUserId, token, payload)
      setIsEditing(false)
      setMessage("Profile updated successfully.")
      await refresh()
    } catch (errorObject) {
      const text = errorObject instanceof Error ? errorObject.message : "Failed to update profile."
      setMessage(text)
    } finally {
      setSaving(false)
    }
  }

  const baseEditorValues = React.useMemo(
    () => ({
      first_name: readString(currentUser, ["first_name", "firstName"], ""),
      last_name: readString(currentUser, ["last_name", "lastName"], ""),
      phone: readString(currentUser, ["phone", "phone_number"], ""),
      email: readString(currentUser, ["email"], ""),
      password: "",
      user_no: readString(currentUser, ["user_no", "employee_no"], ""),
      status: readString(currentUser, ["status"], "") || readString(employee, ["employment_status"], ""),
      profile_photo_url: profilePhotoUrl || "",
    }),
    [currentUser, employee, profilePhotoUrl]
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

  const handleProfilePhotoChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""

      if (!file) {
        return
      }

      if (!file.type.startsWith("image/")) {
        setMessage("Please choose an image file for your profile photo.")
        return
      }

      if (!token) {
        setMessage("Session expired. Please sign in again.")
        return
      }

      if (loggedInUserId === null) {
        setMessage("Unable to resolve user id for profile photo update.")
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        setMessage("Profile photo must be 5 MB or smaller.")
        return
      }

      setProfilePhotoSaving(true)
      setMessage(null)

      try {
        const dataUrl = await readFileAsDataUrl(file)
        await updateUserById(loggedInUserId, token, {
          profile_photo_url: dataUrl,
        })
        setMessage("Profile photo updated successfully.")
        await refresh()
      } catch (errorObject) {
        const text = errorObject instanceof Error ? errorObject.message : "Failed to update profile photo."
        setMessage(text)
      } finally {
        setProfilePhotoSaving(false)
      }
    },
    [loggedInUserId, refresh, token]
  )

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="group relative size-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                <input
                  ref={profilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleProfilePhotoChange(event)}
                />
                {profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profilePhotoUrl} alt="Profile photo" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {initials || "U"}
                  </div>
                )}
                <button
                  type="button"
                  className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform duration-300 hover:scale-105"
                  aria-label={profilePhotoSaving ? "Updating profile photo" : "Edit profile photo"}
                  onClick={() => profilePhotoInputRef.current?.click()}
                  disabled={profilePhotoSaving}
                >
                  {profilePhotoSaving ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                </button>
              </div>
              <CardTitle>My Details</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false)
                  setMessage(null)
                  return
                }
                setIsEditing(true)
              }}
              disabled={loading || saving}
              aria-label={isEditing ? "Cancel editing profile" : "Edit profile"}
            >
              {isEditing ? <X className="size-4" /> : <Pencil className="size-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-500">Loading your profile...</p> : null}
          {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && (currentUser || employee) ? (
            <div className="grid gap-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SelfProfileTab)}>
                <HorizontalScrollContainer>
                  <TabsList
                    variant="line"
                    size="sm"
                    className="profile-tabs-list inline-flex min-w-max gap-1 rounded-lg border border-slate-200 px-1 py-1 dark:border-slate-800"
                  >
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="profile-tabs-trigger data-[state=active]:rounded-md data-[state=active]:bg-slate-100 dark:data-[state=active]:bg-slate-800"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </HorizontalScrollContainer>
                <TabsContent value={activeTab} className="mt-3">
                  <div key={activeTab} className="grid gap-4 animate-in slide-in-from-right-2 fade-in-0 duration-300">

              {activeTab === "summary" ? (
              <div className="grid gap-3">
                <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
                <section className="summary-wave-card flex h-full flex-col space-y-2 p-4">
                  <SectionHeading
                    title="Identity"
                    onEdit={() => openSectionEditor("identity", "Identity", ["first_name", "last_name", "user_no"])}
                  />
                  <WaveInfoRows
                    rows={[
                      {
                        label: "Employee ID",
                        value: readString(employee, ["id", "employee_id", "employeeId"], "-"),
                      },
                      {
                        label: "Employee No",
                        value:
                          readString(currentUser, ["user_no", "employee_no", "employeeNo"], "") ||
                          readString(employee, ["employee_no", "employee_number", "employee_code", "employeeId", "user_no"], "") ||
                          readNestedEmployeeNumber(currentUser) ||
                          readString(currentUser, ["employee_no", "employeeNo", "employee_id", "employeeId", "user_no"], "-"),
                      },
                      {
                        label: "Full Name",
                        value:
                          [readString(currentUser, ["first_name"], ""), readString(currentUser, ["last_name"], "")]
                            .filter(Boolean)
                            .join(" ") ||
                          readString(employee, ["full_name", "fullName", "name"], "") ||
                          [readString(employee, ["first_name"], ""), readString(employee, ["last_name"], "")]
                            .filter(Boolean)
                            .join(" ") ||
                          "-",
                      },
                    ]}
                  />
                </section>

                <section className="summary-wave-card flex h-full flex-col space-y-2 p-4">
                  <SectionHeading
                    title="Contact & Employment"
                    onEdit={() => openSectionEditor("contact-employment", "Contact & Employment", ["email", "phone", "status"])}
                  />
                  <WaveInfoRows
                    rows={[
                      { label: "Email", value: readString(currentUser, ["email"]) },
                      {
                        label: "Phone",
                        value: readString(employee, ["phone", "phone_number"], "") || readString(currentUser, ["phone", "phone_number"]),
                      },
                      { label: "Employment Status", value: readString(employee, ["employment_status", "status"], "-") },
                      { label: "Employment Type", value: formatEmploymentType(employee?.employment_type) },
                      { label: "Hire Date", value: formatDate(employee?.hire_date) },
                    ]}
                  />
                </section>
                </div>

                <div>
                  <WaveSeparator variant="layered" className="my-1 md:my-2" />
                </div>

                <div className="grid gap-3 md:grid-cols-2 md:items-stretch">
                <section className="summary-wave-card flex h-full flex-col space-y-2 p-4">
                  <SectionHeading
                    title="Organization"
                  />
                  <WaveInfoRows
                    rows={[
                      {
                        label: "Branch",
                        value:
                          resolveBranchNameFromEmployee(employee) ||
                          readString(asRecord(employee?.branch), ["name", "branch_name"], "") ||
                          readString(employee, ["branch_name", "branch"], "-"),
                      },
                      {
                        label: "Department",
                        value:
                          resolveDepartmentNameFromEmployee(employee) ||
                          readString(asRecord(employee?.department), ["name", "department_name"], "") ||
                          readString(employee, ["department_name", "department"], "-"),
                      },
                    ]}
                  />
                </section>

                <section className="summary-wave-card flex h-full flex-col space-y-2 p-4">
                  <SectionHeading
                    title="Role & Leadership"
                  />
                  <WaveInfoRows
                    rows={[
                      {
                        label: "Position",
                        value:
                          readString(asRecord(employee?.primary_position), ["name", "position_name"], "") ||
                          readString(asRecord(employee?.position), ["name", "position_name"], "") ||
                          readString(employee, ["position_name", "position", "designation_name"], "-"),
                      },
                      {
                        label: "Designation",
                        value:
                          readString(asRecord(employee?.primary_designation), ["name", "designation_name"], "") ||
                          readString(asRecord(employee?.designation), ["name", "designation_name"], "") ||
                          readString(employee, ["designation_name", "designation"], "-"),
                      },
                      {
                        label: "Manager",
                        value: (() => {
                          const manager = asRecord(employee?.manager)
                          const managerCompanyUser = asRecord(manager?.company_user)
                          const managerUser = asRecord(managerCompanyUser?.user)
                          return (
                            [readString(manager, ["first_name"], ""), readString(manager, ["last_name"], "")]
                              .filter(Boolean)
                              .join(" ") ||
                            [readString(managerUser, ["first_name"], ""), readString(managerUser, ["last_name"], "")]
                              .filter(Boolean)
                              .join(" ") ||
                            readString(manager, ["name"], "-")
                          )
                        })(),
                      },
                    ]}
                  />
                </section>
                </div>
              </div>
              ) : null}

              {activeTab === "summary" && employee ? (
                <WaveSeparator variant="layered" className="my-2 md:my-3" />
              ) : null}

              {activeTab === "summary" && employee ? (
                <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
                  <section className="summary-wave-card flex h-full flex-col space-y-2 p-4">
                    <SectionHeading
                      title="Reporting & Assignment"
                    />
                    <WaveInfoRows
                      rows={[
                        {
                          label: "Reports To",
                          value: (() => {
                            const manager = asRecord(employee.manager)
                            const managerCompanyUser = asRecord(manager?.company_user)
                            const managerUser = asRecord(managerCompanyUser?.user)
                            return (
                              [readString(manager, ["first_name"], ""), readString(manager, ["last_name"], "")]
                                .filter(Boolean)
                                .join(" ") ||
                              [readString(managerUser, ["first_name"], ""), readString(managerUser, ["last_name"], "")]
                                .filter(Boolean)
                                .join(" ") ||
                              readString(manager, ["name"], "-")
                            )
                          })(),
                        },
                        {
                          label: "Manager Employee No",
                          value: (() => {
                            const manager = asRecord(employee.manager)
                            const managerCompanyUser = asRecord(manager?.company_user)
                            const managerUser = asRecord(managerCompanyUser?.user)
                            return readString(manager, ["employee_no"], "") || readString(managerUser, ["user_no"], "-")
                          })(),
                        },
                        {
                          label: "Primary Branch",
                          value:
                            readString(asRecord(employee.primary_branch), ["name", "branch_name"], "") ||
                            resolveBranchNameFromEmployee(employee) ||
                            "-",
                        },
                        {
                          label: "Primary Department",
                          value:
                            readString(asRecord(employee.primary_department), ["name", "department_name"], "") ||
                            resolveDepartmentNameFromEmployee(employee) ||
                            "-",
                        },
                        {
                          label: "Primary Position",
                          value:
                            readString(asRecord(employee.primary_position), ["name", "position_name"], "") ||
                            readString(asRecord(employee.position), ["name", "position_name"], "-"),
                        },
                        {
                          label: "Primary Designation",
                          value:
                            readString(asRecord(employee.primary_designation), ["name", "designation_name"], "") ||
                            readString(asRecord(employee.designation), ["name", "designation_name"], "-"),
                        },
                      ]}
                    />
                  </section>
                  <section className="summary-wave-card flex h-full flex-col space-y-2 p-4">
                    <SectionHeading
                      title="Additional Details"
                      onEdit={() =>
                        openSectionEditor("additional-details", "Additional Details", [
                          "first_name",
                          "last_name",
                          "phone",
                          "email",
                          "user_no",
                          "status",
                          "password",
                        ])
                      }
                    />
                    <WaveInfoRows
                      rows={[
                        { label: "Middle Name", value: readString(employee, ["middle_name"], "-") },
                        { label: "Preferred Name", value: readString(employee, ["preferred_name"], "-") },
                        { label: "Gender", value: readString(employee, ["gender"], "-") },
                        { label: "Date of Birth", value: formatDate(employee.date_of_birth) },
                        { label: "Marital Status", value: readString(employee, ["marital_status"], "-") },
                        { label: "Nationality", value: readString(employee, ["nationality"], "-") },
                        { label: "Exit Reason", value: readString(employee, ["exit_reason"], "-") },
                        { label: "Probation End Date", value: formatDate(employee.probation_end_date) },
                        { label: "Confirmation Date", value: formatDate(employee.confirmation_date) },
                        { label: "Exit Date", value: formatDate(employee.exit_date) },
                        { label: "Notes", value: readString(employee, ["notes"], "-") },
                      ]}
                    />
                  </section>
                </div>
              ) : null}

              {activeTab === "assignments" && employee ? (
                <WaveSeparator variant="subtle" className="my-1 md:my-2" />
              ) : null}

              {activeTab === "assignments" && employee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Department Assignments</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.departments) && employee.departments.length ? (
                        employee.departments.map((entry, index) => {
                          const record = asRecord(entry)
                          const department = asRecord(record?.department)
                          const branch = asRecord(department?.branch)
                          return (
                            <div key={`department-${index}`} className="assignment-detail-card">
                              <InfoRow label="Department" value={readString(department, ["name", "department_name"], "-")} />
                              <InfoRow label="Code" value={readString(department, ["code"], "-")} />
                              <InfoRow label="Branch" value={readString(branch, ["name", "branch_name"], "-")} />
                              <InfoRow label="Primary" value={formatUnknownValue(record?.is_primary)} />
                              <InfoRow label="Status" value={readString(department, ["status"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No department assignments available." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activeTab === "assignments" && employee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Position Assignments</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.position_assignments) && employee.position_assignments.length ? (
                        employee.position_assignments.map((entry, index) => {
                          const record = asRecord(entry)
                          const position = asRecord(record?.position)
                          const designation = asRecord(record?.designation)
                          return (
                            <div key={`position-assignment-${index}`} className="assignment-detail-card">
                              <InfoRow label="Position" value={readString(position, ["name", "position_name"], "-")} />
                              <InfoRow label="Designation" value={readString(designation, ["name", "designation_name"], "-")} />
                              <InfoRow label="Assignment Type" value={readString(record, ["assignment_type"], "-")} />
                              <InfoRow label="Status" value={readString(record, ["status"], "-")} />
                              <InfoRow label="Start Date" value={formatDate(record?.start_date)} />
                              <InfoRow label="End Date" value={formatDate(record?.end_date)} />
                              <InfoRow label="Primary" value={formatUnknownValue(record?.is_primary)} />
                              <InfoRow label="Notes" value={readString(record, ["notes"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No position assignments available." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Designation Assignments</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.designation_assignments) && employee.designation_assignments.length ? (
                        employee.designation_assignments.map((entry, index) => {
                          const record = asRecord(entry)
                          const designation = asRecord(record?.designation)
                          return (
                            <div key={`designation-assignment-${index}`} className="assignment-detail-card">
                              <InfoRow label="Designation" value={readString(designation, ["name", "designation_name"], "-")} />
                              <InfoRow label="Code" value={readString(designation, ["code"], "-")} />
                              <InfoRow label="Current" value={formatUnknownValue(record?.is_current)} />
                              <InfoRow label="Start Date" value={formatDate(record?.start_date)} />
                              <InfoRow label="End Date" value={formatDate(record?.end_date)} />
                              <InfoRow label="Remarks" value={readString(record, ["remarks"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No designation assignments available." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activeTab === "personal" && employee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Contacts</CardTitle>
                        <SectionEditButton
                          label="Contacts"
                          onClick={() => openSectionEditor("contacts", "Contacts", ["phone", "email"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.contacts) && employee.contacts.length ? (
                        employee.contacts.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`contact-${index}`} className="rounded-md p-3">
                              <InfoRow label="Type" value={readString(record, ["contact_type"], "-")} />
                              <InfoRow label="Phone" value={readString(record, ["phone_number", "phone"], "-")} />
                              <InfoRow label="Email" value={readString(record, ["email"], "-")} />
                              <InfoRow label="Primary" value={formatUnknownValue(record?.is_primary)} />
                              <InfoRow label="Verified" value={formatUnknownValue(record?.is_verified)} />
                              <InfoRow label="Notes" value={readString(record, ["notes"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No contacts available." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Addresses</CardTitle>
                        <SectionEditButton
                          label="Addresses"
                          onClick={() => openSectionEditor("addresses", "Addresses", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.addresses) && employee.addresses.length ? (
                        employee.addresses.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`address-${index}`} className="rounded-md p-3">
                              <InfoRow label="Type" value={readString(record, ["address_type", "type"], "-")} />
                              <InfoRow label="Address" value={readString(record, ["address_line", "address"], "-")} />
                              <InfoRow label="City" value={readString(record, ["city"], "-")} />
                              <InfoRow label="Country" value={readString(record, ["country"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No addresses available." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Relatives</CardTitle>
                        <SectionEditButton
                          label="Relatives"
                          onClick={() => openSectionEditor("relatives", "Relatives", ["phone", "email"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.relatives) && employee.relatives.length ? (
                        employee.relatives.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`relative-${index}`} className="rounded-md p-3">
                              <InfoRow label="Name" value={readString(record, ["name", "full_name"], "-")} />
                              <InfoRow label="Relationship" value={readString(record, ["relationship"], "-")} />
                              <InfoRow label="Phone" value={readString(record, ["phone_number", "phone"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No relatives available." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activeTab === "records" && employee ? (
                <WaveSeparator variant="subtle" inverted className="my-1 md:my-2" />
              ) : null}

              {activeTab === "records" && employee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Identifications</CardTitle>
                        <SectionEditButton
                          label="Identifications"
                          onClick={() => openSectionEditor("identifications", "Identifications", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.identifications) && employee.identifications.length ? (
                        employee.identifications.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`identification-${index}`} className="rounded-md p-3">
                              <InfoRow label="Type" value={readString(record, ["identification_type", "type"], "-")} />
                              <InfoRow label="Number" value={readString(record, ["number", "id_number"], "-")} />
                              <InfoRow label="Issue Date" value={formatDate(record?.issue_date)} />
                              <InfoRow label="Expiry Date" value={formatDate(record?.expiry_date)} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No identifications available." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Bank Accounts</CardTitle>
                        <SectionEditButton
                          label="Bank Accounts"
                          onClick={() => openSectionEditor("bank-accounts", "Bank Accounts", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.bank_accounts) && employee.bank_accounts.length ? (
                        employee.bank_accounts.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`bank-${index}`} className="rounded-md p-3">
                              <InfoRow label="Bank Name" value={readString(record, ["bank_name"], "-")} />
                              <InfoRow label="Account Name" value={readString(record, ["account_name"], "-")} />
                              <InfoRow label="Account Number" value={readString(record, ["account_number"], "-")} />
                              <InfoRow label="Currency" value={readString(record, ["currency"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No bank accounts available." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activeTab === "records" && employee ? (
                <WaveSeparator variant="subtle" className="my-1 md:my-2" />
              ) : null}

              {activeTab === "records" && employee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Academic Qualifications</CardTitle>
                        <SectionEditButton
                          label="Academic Qualifications"
                          onClick={() => openSectionEditor("academic-qualifications", "Academic Qualifications", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.academic_qualifications) && employee.academic_qualifications.length ? (
                        employee.academic_qualifications.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`academic-${index}`} className="rounded-md p-3">
                              <InfoRow label="Qualification" value={readString(record, ["qualification", "name"], "-")} />
                              <InfoRow label="Institution" value={readString(record, ["institution"], "-")} />
                              <InfoRow label="Year" value={readString(record, ["year"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No academic qualifications available." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Professional Qualifications</CardTitle>
                        <SectionEditButton
                          label="Professional Qualifications"
                          onClick={() => openSectionEditor("professional-qualifications", "Professional Qualifications", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.professional_qualifications) && employee.professional_qualifications.length ? (
                        employee.professional_qualifications.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`professional-${index}`} className="rounded-md p-3">
                              <InfoRow label="Qualification" value={readString(record, ["qualification", "name"], "-")} />
                              <InfoRow label="Issuer" value={readString(record, ["issuer", "institution"], "-")} />
                              <InfoRow label="Year" value={readString(record, ["year"], "-")} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No professional qualifications available." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {activeTab === "records" && employee ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Experience Details</CardTitle>
                        <SectionEditButton
                          label="Experience Details"
                          onClick={() => openSectionEditor("experience-details", "Experience Details", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.experience_details) && employee.experience_details.length ? (
                        employee.experience_details.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`experience-${index}`} className="rounded-md p-3">
                              <InfoRow label="Company" value={readString(record, ["company_name", "company"], "-")} />
                              <InfoRow label="Role" value={readString(record, ["role", "position"], "-")} />
                              <InfoRow label="Start Date" value={formatDate(record?.start_date)} />
                              <InfoRow label="End Date" value={formatDate(record?.end_date)} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No experience details available." />
                      )}
                    </CardContent>
                  </Card>

                  <Card className="summary-wave-card">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">Documents</CardTitle>
                        <SectionEditButton
                          label="Documents"
                          onClick={() => openSectionEditor("documents", "Documents", ["status", "user_no"])}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {Array.isArray(employee.documents) && employee.documents.length ? (
                        employee.documents.map((entry, index) => {
                          const record = asRecord(entry)
                          return (
                            <div key={`document-${index}`} className="rounded-md p-3">
                              <InfoRow label="Type" value={readString(record, ["document_type", "type"], "-")} />
                              <InfoRow label="Title" value={readString(record, ["title", "name"], "-")} />
                              <InfoRow label="Status" value={readString(record, ["status"], "-")} />
                              <InfoRow label="Uploaded At" value={formatDate(record?.created_at)} />
                            </div>
                          )
                        })
                      ) : (
                        <EmptyStateRow text="No documents available." />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
          {isEditing ? (
            <div className="mt-4 grid animate-in slide-in-from-top-2 fade-in-0 duration-300 gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Phone Number</Label>
                <Input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleProfileUpdate} disabled={saving || loading}>Save Profile</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setMessage(null)
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
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
        </CardContent>
      </Card>

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
          {loading ? <p className="text-sm text-slate-500">Loading organization details...</p> : null}
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
  const { loading, error, employee } = useSelfEmployeeData()

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Promotion Context</CardTitle>
          <CardDescription>Track your current level and promotion-related context.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-slate-500">Loading promotion context...</p> : null}
          {!loading && error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!loading && !error && employee ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <InfoRow label="Current Position" value={readString(asRecord(employee.position), ["name", "position_name"])} />
                <InfoRow label="Current Designation" value={readString(asRecord(employee.designation), ["name", "designation_name"])} />
                <InfoRow label="Department" value={readString(asRecord(employee.department), ["name", "department_name"])} />
              </div>
              <div>
                <InfoRow label="Employment Status" value={readString(employee, ["employment_status", "status"])} />
                <InfoRow label="Last Updated" value={formatDate(employee["updated_at"])} />
                <InfoRow label="Joined Date" value={formatDate(employee["hire_date"] ?? employee["joining_date"])} />
              </div>
            </div>
          ) : null}
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Promotion approvals and final decisions are managed by HR/admin workflows. You can view your current context here and follow up through your manager or HR.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function EmployeeSelfServiceLeaveView({ tab }: EmployeeSelfServiceLeaveViewProps) {
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
  const [holidays, setHolidays] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [message, setMessage] = React.useState<string | null>(null)

  const [requestForm, setRequestForm] = React.useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })

  const employeeId = readNumber(employee, ["id", "employee_id"])

  const readEndpointError = React.useCallback(
    (errorObject: unknown, fallbackMessage: string) => {
      const message = errorObject instanceof Error ? errorObject.message : fallbackMessage
      const status =
        typeof errorObject === "object" && errorObject !== null && "status" in errorObject
          ? (errorObject as { status?: number }).status
          : undefined

      if (status === 403) {
        return "This section is not available for your account yet."
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
        listAttendanceHolidays(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
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
      } else {
        setBalances([])
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

    if (leaveTypes.length === 0) {
      setMessage("Leave requests cannot be submitted until leave types are available to your account.")
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await createMyLeaveRequest(token, {
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason.trim(),
        submit: true,
      })
      setRequestForm({ leave_type_id: "", start_date: "", end_date: "", reason: "" })
      setMessage("Leave request submitted.")
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

  if (loadingProfile) {
    return <div className="px-4 py-2 text-sm text-slate-500">Loading your profile...</div>
  }

  if (profileError) {
    return <div className="px-4 py-2 text-sm text-red-600">{profileError}</div>
  }

  if (employeeId === null) {
    return <div className="px-4 py-2 text-sm text-red-600">Employee profile not found.</div>
  }

  if (tab === "requests") {
    return (
      <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request Leave</CardTitle>
            <CardDescription>Submit a new leave request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Leave Type</Label>
              <Select value={requestForm.leave_type_id} onValueChange={(value) => setRequestForm((prev) => ({ ...prev, leave_type_id: value ?? "" }))}>
                <SelectTrigger disabled={leaveTypes.length === 0}>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((row) => {
                    const id = readNumber(row, ["id"])
                    if (id === null) {
                      return null
                    }
                    return <SelectItem key={id} value={String(id)}>{readString(row, ["name", "code"], `Type #${id}`)}</SelectItem>
                  })}
                </SelectContent>
              </Select>
              {leaveTypesError ? <p className="text-xs text-slate-500">{leaveTypesError}</p> : null}
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={requestForm.start_date} onChange={(event) => setRequestForm((prev) => ({ ...prev, start_date: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" value={requestForm.end_date} onChange={(event) => setRequestForm((prev) => ({ ...prev, end_date: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input value={requestForm.reason} onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))} />
            </div>
            <Button onClick={onRequestLeave} disabled={loading || leaveTypes.length === 0}>Submit Request</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Requests</CardTitle>
            <CardDescription>View your submitted leave requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.length === 0 ? <p className="text-sm text-slate-500">No leave requests found.</p> : null}
            {requests.map((row, index) => (
              <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-medium">{readString(row, ["leave_no", "request_no", "reason"], "Request")}</p>
                <p className="text-slate-600 dark:text-slate-300">{formatDate(row.start_date)} to {formatDate(row.end_date)}</p>
                <p className="text-slate-600 dark:text-slate-300">Status: {readString(row, ["status"], "pending")}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {message ? <p className="text-sm text-slate-700 md:col-span-2 dark:text-slate-300">{message}</p> : null}
        {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
      </div>
    )
  }

  if (tab === "balances") {
    return (
      <div className="grid gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Leave Balances</CardTitle>
            <CardDescription>Your current leave balances by leave type and fiscal year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-slate-500">Loading balances...</p> : null}
            {!loading && balances.length === 0 ? <p className="text-sm text-slate-500">No balance records found.</p> : null}
            {balances.map((row, index) => (
              <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <p className="font-medium">{readString(asRecord(row.leave_type), ["name"], "Leave type")}</p>
                <p className="text-slate-600 dark:text-slate-300">Fiscal Year: {readString(row, ["fiscal_year"], "-")}</p>
                <p className="text-slate-600 dark:text-slate-300">Available: {String(row.available_days ?? row.remaining_days ?? "-")}</p>
              </div>
            ))}
            {balancesError ? <p className="text-sm text-slate-500">{balancesError}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tab === "holidays") {
    return (
      <div className="grid gap-4 px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Holiday Calendar</CardTitle>
            <CardDescription>Office holidays from the attendance calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-slate-500">Loading holidays...</p> : null}
            {!loading && holidays.length === 0 ? <p className="text-sm text-slate-500">No holidays found.</p> : null}
            {holidays.map((row, index) => {
              const holidayStart =
                readString(row, ["holiday_date", "from_date", "start_date", "date"], "") || "-"
              const holidayEnd = readString(row, ["to_date", "end_date"], "")
              const holidayType = readString(row, ["type"], "")
              const dateLabel =
                holidayEnd && holidayEnd !== holidayStart
                  ? `${formatDate(holidayStart)} - ${formatDate(holidayEnd)}`
                  : formatDate(holidayStart)

              return (
                <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{readString(row, ["name", "title"], "Holiday")}</p>
                  <p className="text-slate-600 dark:text-slate-300">Date: {dateLabel}</p>
                  {holidayType ? <p className="text-slate-600 dark:text-slate-300">Type: {holidayType}</p> : null}
                </div>
              )
            })}
            {holidaysError ? <p className="text-sm text-slate-500">{holidaysError}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Leave Policies</CardTitle>
          <CardDescription>Read-only policy guidance for your leave requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <p className="text-sm text-slate-500">Loading policies...</p> : null}
          {!loading && policies.length === 0 ? <p className="text-sm text-slate-500">No leave policies found.</p> : null}
          {policies.map((row, index) => (
            <div key={String(row.id ?? index)} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-medium">{readString(row, ["name"], "Policy")}</p>
              <p className="text-slate-600 dark:text-slate-300">Status: {readString(row, ["status"], "-")}</p>
              <p className="text-slate-600 dark:text-slate-300">Accrual: {readString(row, ["accrual_method"], "-")}</p>
            </div>
          ))}
          {policiesError ? <p className="text-sm text-slate-500">{policiesError}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}
