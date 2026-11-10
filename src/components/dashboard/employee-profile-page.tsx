"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  EyeIcon,
  EyeOffIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UnlinkIcon,
  UploadIcon,
  UserRoundXIcon,
} from "lucide-react"
import { SearchSparkle20Regular as SearchIcon } from "@fluentui/react-icons"
import {
  Button as FluentButton,
  Field as FluentField,
  Input as FluentInput,
  Textarea as FluentTextarea,
} from "@fluentui/react-components"
import { getCountryCallingCode } from "libphonenumber-js"
import { countries as countryCodes } from "country-flag-icons"

import { CountryFlag } from "@/components/country-flag"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import {
  createEmployeeDocument,
  createEmployeeMovement,
  createEmployeePosition,
  createEmployeeSectionItem,
  cancelEmployeeMovement,
  deleteEmployeePosition,
  deleteEmployeeDocument,
  deleteEmployeeSectionItem,
  downloadEmployeeDocument,
  downloadEmploymentLetter,
  downloadEmployeeLetterPreview,
  fileToBase64UploadDto,
  getEmployeeById,
  isEmployeeStatusValue,
  listBranches,
  listCostCenters,
  listDepartmentPositions,
  listDepartments,
  listEmployeeGrades,
  listEmployeeMovementOperations,
  listEmployeeMovements,
  listEmployeePositions,
  listAllEmployees,
  listEmployees,
  generateEmployeeTemplateLetter,
  listEmployeeLetterHistory,
  listPositions,
  patchEmployeeById,
  patchEmployeeAssignment,
  patchEmployeePosition,
  patchEmployeeSectionItem,
  removeEmployeeLinkedAccount,
  submitEmployeeMovement,
  unlinkEmployeeCompanyUser,
  updateUserById,
  type AdminRecord,
  type EmployeeAssignmentPayload,
  type EmployeeStatusPayload,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { pageBleedClass } from "@/components/dashboard/talent-visuals"
import { EmployeeStatusDialog } from "@/components/dashboard/employee-status-dialog"
import { EmployeeStatusHistorySection } from "@/components/dashboard/employee-status-history"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import {
  filterEmployeesByDirectorySearch,
  getEmployeeDirectoryContactSummary,
} from "@/lib/employee-directory-search"
import { AnimatePresence, motion } from "framer-motion"
import { useDashboardMotion } from "@/lib/dashboard-motion"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt"
const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated"

function normalizeEmployeeStatus(value: unknown): EmployeeStatusPayload["employment_status"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return isEmployeeStatusValue(normalized) ? normalized : "active"
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

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return "-"
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry) => typeof entry === "object" && entry !== null) as AdminRecord[]
}

function firstRecordArray(...values: unknown[]) {
  for (const value of values) {
    const list = asRecordArray(value)
    if (list.length > 0) {
      return list
    }
  }
  return [] as AdminRecord[]
}

function readNestedString(value: unknown, keys: string[]) {
  const record = asRecord(value)
  if (!record) {
    return "-"
  }
  return readString(record, keys)
}

function mergeEmployeeProfileRecord(record: AdminRecord | null) {
  if (!record) {
    return null
  }

  const nestedEmployee =
    asRecord(record.employee) ??
    asRecord(record.employee_profile) ??
    asRecord(record.profile) ??
    null

  const merged: AdminRecord = {
    ...record,
    ...(nestedEmployee ?? {}),
  }

  if (!merged.company_user && record.companyUser) {
    merged.company_user = record.companyUser
  }
  if (!merged.primary_branch && record.primaryBranch) {
    merged.primary_branch = record.primaryBranch
  }
  if (!merged.primary_department && record.primaryDepartment) {
    merged.primary_department = record.primaryDepartment
  }
  if (!merged.primary_position && record.primaryPosition) {
    merged.primary_position = record.primaryPosition
  }
  if (!merged.position && record.positionDetail) {
    merged.position = record.positionDetail
  }
  if (!merged.manager && record.managerDetail) {
    merged.manager = record.managerDetail
  }

  if (!merged.contacts && record.contact_details) {
    merged.contacts = record.contact_details
  }
  if (!merged.addresses && record.addressDetails) {
    merged.addresses = record.addressDetails
  }
  if (!merged.relatives && record.nextOfKin) {
    merged.relatives = record.nextOfKin
  }
  if (!merged.identifications && record.identificationDocuments) {
    merged.identifications = record.identificationDocuments
  }
  if (!merged.bank_accounts && record.bankAccounts) {
    merged.bank_accounts = record.bankAccounts
  }
  if (!merged.department_assignments && record.departmentAssignments) {
    merged.department_assignments = record.departmentAssignments
  }
  if (!merged.academic_qualifications && record.academicQualifications) {
    merged.academic_qualifications = record.academicQualifications
  }
  if (!merged.professional_qualifications && record.professionalQualifications) {
    merged.professional_qualifications = record.professionalQualifications
  }
  if (!merged.experience_details && record.experienceDetails) {
    merged.experience_details = record.experienceDetails
  }
  if (!merged.position_assignments && record.positionAssignments) {
    merged.position_assignments = record.positionAssignments
  }
  if (!merged.employee_movements && record.employeeMovements) {
    merged.employee_movements = record.employeeMovements
  }

  return merged
}

function formatProfileDate(value: unknown) {
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
  }).format(parsed)
}

function getProfileSectionItems(employee: AdminRecord, keys: string[]) {
  const values = keys.map((key) => employee[key])
  return firstRecordArray(...values)
}

function employeeDisplayName(row: AdminRecord) {
  const named = readString(row, ["full_name", "fullName", "employee_name", "employeeName", "name"])
  if (named !== "-") {
    return named
  }
  const first = readString(row, ["first_name", "firstName"])
  const middle = readString(row, ["middle_name", "middleName"])
  const last = readString(row, ["last_name", "lastName"])
  return [first, middle, last].filter((part) => part !== "-").join(" ").trim() || "-"
}

function employeeDisplayNameFromLinkedUser(row: AdminRecord) {
  const companyUser = resolveCompanyUserRecord(row)
  if (companyUser) {
    const userNamed = readString(companyUser, ["full_name", "fullName", "employee_name", "employeeName", "name"])
    if (userNamed !== "-") {
      return userNamed
    }
    const userFirst = readString(companyUser, ["first_name", "firstName"])
    const userLast = readString(companyUser, ["last_name", "lastName"])
    const userName = [userFirst, userLast].filter((part) => part !== "-").join(" ").trim()
    if (userName) {
      return userName
    }
  }
  return employeeDisplayName(row)
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

function formatLabelValue(value: string) {
  if (!value || value === "-") return "-"
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function statusTone(status: string) {
  const normalized = status.trim().toLowerCase()
  if (["terminated", "exited"].includes(normalized)) {
    return "text-rose-600 dark:text-rose-400"
  }
  if (["inactive", "completed"].includes(normalized)) {
    return "text-muted-foreground"
  }
  if (["pending", "probation", "suspended"].includes(normalized)) {
    return "text-amber-600 dark:text-amber-400"
  }
  if (normalized === "active") {
    return "text-emerald-600 dark:text-emerald-400"
  }
  return "text-foreground"
}

function assignmentTypeTone(assignmentType: string) {
  const normalized = assignmentType.trim().toLowerCase()
  if (normalized === "primary") {
    return "text-primary"
  }
  if (normalized === "acting") {
    return "text-amber-600 dark:text-amber-400"
  }
  if (normalized === "temporary") {
    return "text-orange-600 dark:text-orange-400"
  }
  return "text-muted-foreground"
}

function SummaryField({
  label,
  value,
  children,
  index = 0,
  reduce,
}: {
  label: string
  value?: string
  children?: React.ReactNode
  index?: number
  reduce: boolean
}) {
  return (
    <motion.div
      variants={
        reduce
          ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
          : {
              hidden: { opacity: 0, y: 16, scale: 0.96 },
              show: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { type: "spring", stiffness: 320, damping: 26, delay: index * 0.035 },
              },
            }
      }
      className="min-w-0 px-3 py-3"
    >
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-sm font-semibold text-foreground">
        {children ?? value ?? "-"}
      </dd>
    </motion.div>
  )
}

function recordPreview(record: AdminRecord) {
  return [
    readString(record, ["name", "type", "contact_type", "bank_name", "institution", "employee_no", "code"]),
    readString(record, ["email", "phone_number", "phone", "account_number", "id_number"]),
  ]
    .filter((entry) => entry !== "-")
    .join(" • ") || "Record"
}

function renderRecordFields(record: AdminRecord, sectionTitle: string) {
  const fields: Array<{ label: string; value: string }> = []

  const normalizeLabel = (key: string) => {
    if (key === "is_primary") {
      if (sectionTitle.toLowerCase() === "departments") {
        return "Primary Department"
      }
      return "Primary Contact"
    }
    if (key === "is_verified") {
      return "Verified"
    }
    return key.replace(/_/g, " ")
  }

  const normalizeValue = (key: string, value: unknown) => {
    if (typeof value === "boolean") {
      if (key === "is_primary" || key === "is_verified") {
        return value ? "Yes" : "No"
      }
      return value ? "Yes" : "No"
    }
    if (
      typeof value === "string" &&
      (key.endsWith("_at") || key.endsWith("_date") || key === "date_of_birth")
    ) {
      return key.endsWith("_at") ? formatDateTime(value) : formatProfileDate(value)
    }
    return String(value)
  }

  for (const [key, rawValue] of Object.entries(record)) {
    if (key === "id" || key.endsWith("_id") || key.startsWith("__")) {
      continue
    }
    if (rawValue === null || rawValue === undefined) {
      continue
    }
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      fields.push({ label: normalizeLabel(key), value: normalizeValue(key, rawValue) })
      continue
    }
    if (Array.isArray(rawValue)) {
      fields.push({ label: normalizeLabel(key), value: `${rawValue.length} item(s)` })
      continue
    }
    const nested = asRecord(rawValue)
    if (nested) {
      const nestedSummary = [readString(nested, ["name"]), readString(nested, ["code"]), readString(nested, ["email"])]
        .filter((entry) => entry !== "-")
        .join(" • ")
      fields.push({ label: normalizeLabel(key), value: nestedSummary || "Available" })
    }
  }
  return fields
}

function readNumber(value: unknown): number | null {
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

function readRelatedId(row: AdminRecord, recordKeys: string[], idKeys: string[]) {
  for (const key of [...idKeys, ...recordKeys]) {
    const value = row[key]
    const id = readNumber(value)
    if (id !== null) return id
    const nested = asRecord(value)
    if (nested) {
      const nestedId = readNumber(
        nested.id ?? nested.department_id ?? nested.departmentId ?? nested.position_id ?? nested.positionId
      )
      if (nestedId !== null) return nestedId
    }
  }
  return null
}

function isPrimaryEmployeePosition(row: AdminRecord) {
  const primary = row.is_primary ?? row.isPrimary
  if (primary === true || primary === 1 || primary === "1") return true
  if (typeof primary === "string" && primary.trim().toLowerCase() === "true") return true
  const assignmentType = readString(row, ["assignment_type", "assignmentType"])
  return assignmentType !== "-" && assignmentType.trim().toLowerCase() === "primary"
}

function relatedDepartmentIds(row: AdminRecord) {
  const ids = new Set<number>()
  const directId = readRelatedId(
    row,
    ["primary_department", "primaryDepartment", "department", "departmentDetail"],
    ["primary_department_id", "primaryDepartmentId", "department_id", "departmentId"]
  )
  if (directId !== null) ids.add(directId)

  const directIds = Array.isArray(row.department_ids)
    ? row.department_ids
    : Array.isArray(row.departmentIds)
      ? row.departmentIds
      : []
  for (const value of directIds) {
    const id = readNumber(value)
    if (id !== null) ids.add(id)
  }

  const assignments = Array.isArray(row.departments) ? row.departments : []
  for (const assignment of assignments) {
    const record = asRecord(assignment)
    if (!record) continue
    const assignmentId = readRelatedId(
      record,
      ["department", "departmentDetail"],
      ["department_id", "departmentId", "id"]
    )
    if (assignmentId !== null) ids.add(assignmentId)
  }
  return ids
}

function relatedDepartmentNames(row: AdminRecord) {
  const names = new Set<string>()
  const addName = (value: unknown) => {
    if (typeof value === "string" && value.trim()) names.add(value.trim().toLowerCase())
  }
  addName(row.department_name)
  addName(row.departmentName)
  for (const key of ["primary_department", "primaryDepartment", "department", "departmentDetail"]) {
    const record = asRecord(row[key])
    if (record) addName(readString(record, ["name", "department_name", "departmentName"]))
  }
  const assignments = Array.isArray(row.departments) ? row.departments : []
  for (const assignment of assignments) {
    const record = asRecord(assignment)
    const department = asRecord(record?.department)
    if (department) addName(readString(department, ["name", "department_name", "departmentName"]))
  }
  return names
}

function relatedBranchId(row: AdminRecord) {
  return readRelatedId(
    row,
    ["branch", "branchDetail", "primary_branch", "primaryBranch"],
    ["branch_id", "branchId", "primary_branch_id", "primaryBranchId"]
  )
}

function normalizeDepartmentScopedPositionOptions(rows: AdminRecord[], departmentId: number) {
  return rows.map((row) => {
    const nestedPosition =
      asRecord(row.position) ??
      asRecord(row.positionDetail) ??
      asRecord(row.primary_position) ??
      asRecord(row.primaryPosition)
    const position = nestedPosition ? { ...row, ...nestedPosition } : row
    const existingDepartmentIds = [
      ...(Array.isArray(position.department_ids) ? position.department_ids : []),
      ...(Array.isArray(position.departmentIds) ? position.departmentIds : []),
    ]
      .map((value) => readNumber(value))
      .filter((value): value is number => value !== null)

    const departmentIds = Array.from(new Set([...existingDepartmentIds, departmentId]))
  return {
    ...position,
    department_ids: departmentIds,
    departmentIds,
  }
  })
}

function fallbackDepartmentScopedPositionOptions(
  rows: AdminRecord[],
  departmentId: number,
  branchId: number | null
) {
  const byDepartment = rows.filter((row) => relatedDepartmentIds(row).has(departmentId))
  if (byDepartment.length > 0) {
    return byDepartment
  }

  return rows.filter((row) => {
    const departmentIds = relatedDepartmentIds(row)
    if (departmentIds.size > 0) {
      return false
    }
    const positionBranchId = relatedBranchId(row)
    return branchId === null || positionBranchId === null || positionBranchId === branchId
  })
}

function recordOptionLabel(row: AdminRecord) {
  return readString(row, [
    "name",
    "title",
    "department_name",
    "departmentName",
    "position_name",
    "positionName",
    "display_name",
    "displayName",
    "code",
  ])
}

function emptyPositionAssignmentForm(): PositionAssignmentFormState {
  return {
    position_id: "",
    assignment_type: "SECONDARY",
    status: "ACTIVE",
    is_primary: "false",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: "",
    notes: "",
  }
}

function resolvePositionAssignmentPositionId(row: AdminRecord) {
  return readRelatedId(
    row,
    ["position", "positionDetail", "primary_position", "primaryPosition"],
    ["position_id", "positionId", "primary_position_id", "primaryPositionId"]
  )
}

function positionAssignmentPreview(row: AdminRecord) {
  const positionRecord =
    asRecord(row.position) ??
    asRecord(row.positionDetail) ??
    asRecord(row.primary_position) ??
    asRecord(row.primaryPosition)
  const positionName = positionRecord ? recordOptionLabel(positionRecord) : "-"
  const fallbackPosition = readString(row, ["position_name", "positionName", "title", "name"])
  const previewPosition = positionName !== "-" ? positionName : fallbackPosition
  return previewPosition !== "-" ? previewPosition : "Position assignment"
}

function readPositionAssignmentForm(row: AdminRecord): PositionAssignmentFormState {
  const positionId = resolvePositionAssignmentPositionId(row)
  const assignmentType = readString(row, ["assignment_type", "assignmentType"])
  const status = readString(row, ["status"])
  const startDate = readString(row, ["start_date", "startDate", "effective_from", "effectiveFrom"])
  const endDate = readString(row, ["end_date", "endDate", "effective_to", "effectiveTo"])
  const notes = readString(row, ["notes"])
  return {
    position_id: positionId === null ? "" : String(positionId),
    assignment_type: assignmentType === "-" ? "SECONDARY" : assignmentType.toUpperCase(),
    status: status === "-" ? "ACTIVE" : status.toUpperCase(),
    is_primary: isPrimaryEmployeePosition(row) ? "true" : "false",
    start_date: startDate === "-" ? "" : startDate.slice(0, 10),
    end_date: endDate === "-" ? "" : endDate.slice(0, 10),
    notes: notes === "-" ? "" : notes,
  }
}

function emptyDepartmentAssignmentForm(): DepartmentAssignmentFormState {
  return {
    department_id: "",
    is_primary: "false",
    effective_date: new Date().toISOString().slice(0, 10),
    reason: "",
  }
}

function resolveDepartmentAssignmentDepartmentId(row: AdminRecord) {
  return readRelatedId(
    row,
    ["department", "departmentDetail", "primary_department", "primaryDepartment"],
    ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId"]
  )
}

function isPrimaryDepartmentAssignment(row: AdminRecord) {
  const primary = row.is_primary ?? row.isPrimary
  if (primary === true || primary === 1 || primary === "1") return true
  if (typeof primary === "string" && primary.trim().toLowerCase() === "true") return true
  return false
}

function departmentAssignmentPreview(row: AdminRecord) {
  const departmentRecord =
    asRecord(row.department) ??
    asRecord(row.departmentDetail) ??
    asRecord(row.primary_department) ??
    asRecord(row.primaryDepartment)
  const departmentName = departmentRecord ? recordOptionLabel(departmentRecord) : "-"
  const fallbackDepartment = readString(row, ["department_name", "departmentName", "name", "title"])
  return departmentName !== "-" ? departmentName : fallbackDepartment !== "-" ? fallbackDepartment : "Department assignment"
}

function readDepartmentAssignmentForm(row: AdminRecord): DepartmentAssignmentFormState {
  const departmentId = resolveDepartmentAssignmentDepartmentId(row)
  return {
    department_id: departmentId === null ? "" : String(departmentId),
    is_primary: isPrimaryDepartmentAssignment(row) ? "true" : "false",
    effective_date: new Date().toISOString().slice(0, 10),
    reason: "",
  }
}

type EmployeeMovementFormState = {
  movement_type: string
  title: string
  reason: string
  effective_date: string
  new_branch_id: string
  new_department_id: string
  new_position_id: string
  new_grade_id: string
  new_cost_center_id: string
  new_manager_employee_id: string
  new_employment_type: string
}

const EMPLOYEE_MOVEMENT_TYPE_OPTIONS = [
  "DEPARTMENT_TRANSFER",
  "BRANCH_TRANSFER",
  "POSITION_CHANGE",
  "PROMOTION",
  "DEMOTION",
  "REPORTING_MANAGER_CHANGE",
  "GRADE_CHANGE",
  "COST_CENTER_CHANGE",
  "EMPLOYMENT_TYPE_CHANGE",
  "COMPOSITE",
]

const EMPLOYMENT_TYPE_OPTIONS = [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
  "temporary",
]

function emptyEmployeeMovementForm(): EmployeeMovementFormState {
  return {
    movement_type: "DEPARTMENT_TRANSFER",
    title: "",
    reason: "",
    effective_date: new Date().toISOString().slice(0, 10),
    new_branch_id: "",
    new_department_id: "",
    new_position_id: "",
    new_grade_id: "",
    new_cost_center_id: "",
    new_manager_employee_id: "",
    new_employment_type: "",
  }
}

function resolveMovementEmployeeId(row: AdminRecord) {
  return readRelatedId(row, ["employee"], ["employeeId", "employee_id"])
}

function movementBelongsToEmployee(row: AdminRecord, employeeId: number) {
  return resolveMovementEmployeeId(row) === employeeId
}

function movementSupportsSubmit(status: string) {
  return ["draft", "returned_for_correction"].includes(status.trim().toLowerCase())
}

function movementSupportsCancel(status: string) {
  return ["draft", "submitted", "pending_approval", "returned_for_correction"].includes(
    status.trim().toLowerCase()
  )
}

function movementChangeValueSummary(value: unknown) {
  if (value === null || value === undefined) {
    return "-"
  }
  if (typeof value === "string") {
    return value.trim() || "-"
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "-" : `${value.length} item(s)`
  }
  const record = asRecord(value)
  if (!record) {
    return "-"
  }
  const summary = [
    readString(record, ["name", "full_name", "fullName", "title", "code", "employee_no", "employeeNo"]),
    readString(record, ["employment_type", "employmentType", "currency"]),
    readString(record, ["base_salary", "baseSalary", "amount"]),
  ]
    .filter((entry, index, entries) => entry !== "-" && entries.indexOf(entry) === index)
    .join(" • ")

  if (summary) {
    return summary
  }

  try {
    return JSON.stringify(record)
  } catch {
    return "Available"
  }
}

function buildEmployeeAssignmentPayload(
  employee: AdminRecord,
  departments: Array<{ department_id: number; is_primary?: boolean }>,
  effectiveDate: string,
  reason: string
): EmployeeAssignmentPayload {
  return {
    effective_date: effectiveDate,
    branch_id: readRelatedId(
      employee,
      ["primary_branch", "primaryBranch", "branch", "branchDetail"],
      ["primary_branch_id", "primaryBranchId", "branch_id", "branchId"]
    ),
    departments,
    primary_position_id: readRelatedId(
      employee,
      ["primary_position", "primaryPosition", "position", "positionDetail"],
      ["primary_position_id", "primaryPositionId", "position_id", "positionId"]
    ),
    reports_to: readRelatedId(employee, ["manager", "managerDetail"], ["reports_to", "manager_id", "managerId"]),
    grade_id: readRelatedId(employee, ["grade", "gradeDetail"], ["grade_id", "gradeId"]),
    cost_center_id: readRelatedId(
      employee,
      ["cost_center", "costCenter", "cost_center_detail", "costCenterDetail"],
      ["cost_center_id", "costCenterId"]
    ),
    reason,
  }
}

function resolveCompanyUserId(employee: AdminRecord): number | null {
  const companyUser = asRecord(employee.company_user)
  if (!companyUser) {
    return null
  }

  const directUserId = readNumber(companyUser.user_id)
  if (directUserId !== null) {
    return directUserId
  }

  const nestedUser = asRecord(companyUser.user)
  if (!nestedUser) {
    return null
  }

  return readNumber(nestedUser.id)
}

function resolveCompanyUserRecord(employee: AdminRecord): AdminRecord | null {
  const companyUser = asRecord(employee.company_user)
  if (!companyUser) {
    return null
  }

  const nestedUser = asRecord(companyUser.user)
  if (nestedUser) {
    return nestedUser
  }

  return companyUser
}

function sectionTitleToApiSection(title: string): EmployeeProfileSection | null {
  const normalized = title.toLowerCase()
  if (normalized === "contacts") return "contacts"
  if (normalized === "addresses") return "addresses"
  if (normalized === "relatives") return "relatives"
  if (normalized === "identifications") return "identifications"
  if (normalized === "bank accounts") return "bank-accounts"
  if (normalized === "academic qualifications") return "academic-qualifications"
  if (normalized === "professional qualifications") return "professional-qualifications"
  if (normalized === "experience details") return "experience-details"
  return null
}

function sectionTitleToRouteKey(title: string) {
  return title.toLowerCase().replaceAll(" ", "_")
}

function routeKeyToSectionTitle(routeKey: string | null | undefined) {
  if (!routeKey) {
    return null
  }

  const normalized = routeKey.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  return (
    {
      contacts: "Contacts",
      documents: "Documents",
      addresses: "Addresses",
      relatives: "Relatives",
      identifications: "Identifications",
      bank_accounts: "Bank Accounts",
      departments: "Departments",
      positions: "Positions",
      movements: "Movements",
      status_history: "Status History",
      academic_qualifications: "Academic Qualifications",
      professional_qualifications: "Professional Qualifications",
      experience_details: "Experience Details",
      company_user: "Company User",
    }[normalized] ?? null
  )
}

type SectionEntry = { key: string; label: string; value: string; kind: "text" | "boolean" }

type PositionAssignmentFormState = {
  position_id: string
  assignment_type: string
  status: string
  is_primary: string
  start_date: string
  end_date: string
  notes: string
}

const POSITION_ASSIGNMENT_TYPE_OPTIONS = ["PRIMARY", "ACTING", "TEMPORARY", "SECONDARY"]
const POSITION_ASSIGNMENT_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "COMPLETED"]

type DepartmentAssignmentFormState = {
  department_id: string
  is_primary: string
  effective_date: string
  reason: string
}

const EDUCATION_LEVEL_OPTIONS = [
  "Primary",
  "Lower Secondary",
  "Upper Secondary",
  "Certificate",
  "Diploma",
  "Advanced Diploma",
  "Bachelor's Degree",
  "Postgraduate Diploma",
  "Master's Degree",
  "Doctorate (PhD)",
  "Professional Qualification",
  "Vocational Training",
  "Other",
]

const DOCUMENT_TYPE_OPTIONS = [
  "certificate",
  "cv",
  "offer_letter",
  "contract",
  "id",
  "other",
]

const DOCUMENT_CLASSIFICATION_OPTIONS = [
  "PRIVATE",
  "CONFIDENTIAL",
  "RESTRICTED",
]

const RELATIONSHIP_OPTIONS = [
  "Spouse",
  "Parent",
  "Child",
  "Sibling",
  "Guardian",
  "Grandparent",
  "Grandchild",
  "Uncle/Aunt",
  "Cousin",
  "Friend",
  "Other",
]

type CountryOption = { code: string; name: string }
type CountryDialOption = { iso: string; code: string; name: string }

const regionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

function safeCountryName(code: string) {
  try {
    return regionDisplayNames?.of(code) ?? code
  } catch {
    return code
  }
}

const COUNTRY_OPTIONS: CountryOption[] = (countryCodes as string[])
  .map((code) => ({
    code,
    name: safeCountryName(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = (countryCodes as string[])
  .map((iso) => {
    try {
      const callingCode = getCountryCallingCode(iso as Parameters<typeof getCountryCallingCode>[0])
      return { iso, code: `+${callingCode}`, name: safeCountryName(iso) }
    } catch {
      return null
    }
  })
  .filter((entry): entry is CountryDialOption => entry !== null)
  .sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code, undefined, { numeric: true })
    if (codeCompare !== 0) {
      return codeCompare
    }
    return a.name.localeCompare(b.name)
  })

function findCountryOption(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  return (
    COUNTRY_OPTIONS.find(
      (option) => option.name.toLowerCase() === normalized || option.code.toLowerCase() === normalized
    ) ?? null
  )
}

function CountrySelectInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const normalizedValue = value.trim().toLowerCase()
  const selected = COUNTRY_OPTIONS.find(
    (option) => option.name.toLowerCase() === normalizedValue || option.code.toLowerCase() === normalizedValue
  ) ?? null

  const filtered = COUNTRY_OPTIONS.filter((option) => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return true
    }
    return option.name.toLowerCase().includes(term) || option.code.toLowerCase().includes(term)
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        }
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <CountryFlag code={selected.code} className="h-4 w-6 rounded-sm border border-slate-200" />
          ) : null}
          <span className="truncate text-slate-900">{selected?.name ?? "Select country"}</span>
        </span>
        <span className="text-slate-400">▼</span>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search country..."
          className="mb-2 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
        />
        <div className="max-h-56 overflow-auto">
          {filtered.map((option) => {
            return (
              <button
                key={option.code}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onChange(option.name)
                  setOpen(false)
                  setSearch("")
                }}
              >
                <CountryFlag code={option.code} className="h-4 w-6 rounded-sm border border-slate-200" />
                <span className="flex-1 truncate">{option.name}</span>
                <span className="text-xs text-slate-500">{option.code}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "-"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`
  }
  const mb = kb / 1024
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`
  }
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function DocumentFileInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const fileMeta = React.useMemo(() => {
    if (!value.trim()) {
      return null
    }
    try {
      const parsed = JSON.parse(value) as {
        file_name?: string
        file_extension?: string
        mime_type?: string
        file_size?: number
      }
      if (parsed && (parsed.file_name || parsed.mime_type || typeof parsed.file_size === "number")) {
        return parsed
      }
    } catch {
      return null
    }
    return null
  }, [value])

  const applyFile = (file: File) => {
    const ext = file.name.includes(".") ? file.name.split(".").pop() ?? "" : ""
    const payload = {
      file_name: file.name,
      file_extension: ext,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size,
    }
    onChange(JSON.stringify(payload))
  }

  return (
    <div className="grid gap-2">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            applyFile(file)
          }
          event.currentTarget.value = ""
        }}
      />
      <button
        type="button"
        className={`min-h-24 rounded-md border border-dashed px-3 py-3 text-left text-sm ${
          isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-white"
        }`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) {
            applyFile(file)
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="mb-1 inline-flex items-center gap-2 font-medium text-slate-700">
          <UploadIcon className="size-4" />
          Drop file here or click to choose
        </span>
      </button>
      {fileMeta ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
          <p><span className="font-semibold">File:</span> {fileMeta.file_name ?? "-"}</p>
          <p><span className="font-semibold">Extension:</span> {fileMeta.file_extension ?? "-"}</p>
          <p><span className="font-semibold">MIME:</span> {fileMeta.mime_type ?? "-"}</p>
          <p><span className="font-semibold">Size:</span> {typeof fileMeta.file_size === "number" ? formatFileSize(fileMeta.file_size) : "-"}</p>
        </div>
      ) : value.trim() ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="JSON metadata"
        />
      ) : null}
    </div>
  )
}

function splitPhoneValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return { dialCode: "+255", number: "" }
  }

  const matched = COUNTRY_DIAL_OPTIONS
    .slice()
    .sort((first, second) => second.code.length - first.code.length)
    .find((option) => trimmed.startsWith(option.code))

  if (!matched) {
    return { dialCode: "+255", number: trimmed }
  }

  return {
    dialCode: matched.code,
    number: trimmed.slice(matched.code.length).trim(),
  }
}

function PhoneWithCountryCodeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const parsed = splitPhoneValue(value)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selected = COUNTRY_DIAL_OPTIONS.find((option) => option.code === parsed.dialCode) ?? null

  const filtered = COUNTRY_DIAL_OPTIONS.filter((option) => {
    const term = search.trim().toLowerCase()
    if (!term) {
      return true
    }
    return (
      option.code.toLowerCase().includes(term) ||
      option.name.toLowerCase().includes(term) ||
      option.iso.toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex h-10 w-36 items-center justify-between rounded-md border border-slate-300 bg-white px-2 text-sm"
            />
          }
        >
          <span className="flex items-center gap-2 truncate">
            {selected ? (
              <CountryFlag code={selected.iso} className="h-4 w-6 rounded-sm border border-slate-200" />
            ) : null}
            <span className="truncate text-slate-900">{selected?.code ?? parsed.dialCode}</span>
          </span>
          <span className="text-slate-400">▼</span>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code or country..."
            className="mb-2 h-9 w-full rounded-md border border-slate-300 px-2 text-sm"
          />
          <div className="max-h-56 overflow-auto">
            {filtered.map((option) => {
              return (
                <button
                  key={`${option.iso}-${option.code}`}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    onChange(`${option.code}${parsed.number}`)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <CountryFlag code={option.iso} className="h-4 w-6 rounded-sm border border-slate-200" />
                  <span className="font-medium text-slate-900">{option.code}</span>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
      <input
        value={parsed.number}
        onChange={(event) => {
          const digits = event.target.value
          onChange(`${parsed.dialCode}${digits}`)
        }}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        placeholder="Phone number"
      />
    </div>
  )
}

function renderEntryInput({
  entry,
  value,
  onChange,
}: {
  entry: SectionEntry
  value: string
  onChange: (value: string) => void
}) {
  if (entry.kind === "boolean") {
    return (
      <FluentSelect
        ariaLabel={entry.label}
        className="w-full"
        value={value}
        onChange={onChange}
        options={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
    )
  }

  if (entry.key === "education_level") {
    return (
      <FluentSelect
        ariaLabel={entry.label}
        className="w-full"
        value={value}
        placeholder="Select education level"
        onChange={onChange}
        options={[
          { value: "", label: "Select education level" },
          ...EDUCATION_LEVEL_OPTIONS.map((level) => ({ value: level, label: level })),
        ]}
      />
    )
  }

  if (entry.key === "type") {
    return (
      <FluentSelect
        ariaLabel={entry.label}
        className="w-full"
        value={value}
        placeholder="Select document type"
        onChange={onChange}
        options={[
          { value: "", label: "Select document type" },
          ...DOCUMENT_TYPE_OPTIONS.map((type) => ({ value: type, label: type })),
        ]}
      />
    )
  }

  if (entry.key === "classification") {
    return (
      <FluentSelect
        ariaLabel={entry.label}
        className="w-full"
        value={value}
        placeholder="Select classification"
        onChange={onChange}
        options={[
          { value: "", label: "Select classification" },
          ...DOCUMENT_CLASSIFICATION_OPTIONS.map((classification) => ({
            value: classification,
            label: classification,
          })),
        ]}
      />
    )
  }

  if (entry.key === "relationship") {
    return (
      <FluentSelect
        ariaLabel={entry.label}
        className="w-full"
        value={value}
        placeholder="Select relationship"
        onChange={onChange}
        options={[
          { value: "", label: "Select relationship" },
          ...RELATIONSHIP_OPTIONS.map((relationship) => ({
            value: relationship,
            label: relationship,
          })),
        ]}
      />
    )
  }

  if (entry.key === "phone" || entry.key === "phone_number") {
    return <PhoneWithCountryCodeInput value={value} onChange={onChange} />
  }

  if (
    entry.key === "file_url" ||
    entry.key === "academic_certificate_document_url" ||
    entry.key === "professional_certificate_document_url"
  ) {
    return <DocumentFileInput value={value} onChange={onChange} />
  }

  if (entry.key.includes("country")) {
    return <CountrySelectInput value={value} onChange={onChange} />
  }

  if (entry.key === "responsibilities_description" || entry.key === "notes") {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    )
  }

  if (entry.key.endsWith("_date")) {
    return (
      <DatePickerPresets value={value} onChange={onChange} />
    )
  }

  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
    />
  )
}

function sectionSchema(sectionTitle: string): SectionEntry[] {
  const name = sectionTitle.toLowerCase()
  if (name === "contacts") {
    return [
      { key: "contact_type", label: "Contact Type", value: "personal", kind: "text" },
      { key: "is_primary", label: "Primary Contact", value: "false", kind: "boolean" },
      { key: "is_verified", label: "Verified", value: "false", kind: "boolean" },
      { key: "phone_number", label: "Phone Number", value: "", kind: "text" },
      { key: "email", label: "Email", value: "", kind: "text" },
      { key: "notes", label: "Notes", value: "", kind: "text" },
    ]
  }
  if (name === "addresses") {
    return [
      { key: "address_type", label: "Address Type", value: "home", kind: "text" },
      { key: "is_primary", label: "Primary Address", value: "false", kind: "boolean" },
      { key: "address_line_1", label: "Address Line 1", value: "", kind: "text" },
      { key: "address_line_2", label: "Address Line 2", value: "", kind: "text" },
      { key: "city", label: "City", value: "", kind: "text" },
      { key: "state", label: "State", value: "", kind: "text" },
      { key: "country", label: "Country", value: "", kind: "text" },
      { key: "postal_code", label: "Postal Code", value: "", kind: "text" },
    ]
  }
  if (name === "relatives") {
    return [
      { key: "is_emergency_contact", label: "Emergency Contact", value: "false", kind: "boolean" },
      { key: "is_primary", label: "Primary Relative", value: "false", kind: "boolean" },
      { key: "full_name", label: "Full Name", value: "", kind: "text" },
      { key: "relationship", label: "Relationship", value: "", kind: "text" },
      { key: "phone", label: "Phone", value: "", kind: "text" },
      { key: "email", label: "Email", value: "", kind: "text" },
      { key: "address", label: "Address", value: "", kind: "text" },
      { key: "occupation", label: "Occupation", value: "", kind: "text" },
    ]
  }
  if (name === "identifications") {
    return [
      { key: "identification_type", label: "Identification Type", value: "national_id", kind: "text" },
      { key: "is_primary", label: "Primary Identification", value: "false", kind: "boolean" },
      { key: "identification_number", label: "Identification Number", value: "", kind: "text" },
      { key: "issued_country", label: "Issued Country", value: "", kind: "text" },
      { key: "expiry_date", label: "Expiry Date", value: "", kind: "text" },
    ]
  }
  if (name === "bank accounts") {
    return [
      { key: "is_primary", label: "Primary Account", value: "false", kind: "boolean" },
      { key: "bank_name", label: "Bank Name", value: "", kind: "text" },
      { key: "account_name", label: "Account Name", value: "", kind: "text" },
      { key: "account_number", label: "Account Number", value: "", kind: "text" },
      { key: "branch_name", label: "Branch Name", value: "", kind: "text" },
      { key: "swift_code", label: "Swift Code", value: "", kind: "text" },
      { key: "mobile_money_provider", label: "Mobile Money Provider", value: "", kind: "text" },
    ]
  }
  if (name === "academic qualifications") {
    return [
      { key: "country_of_residence", label: "Country of Residence", value: "", kind: "text" },
      { key: "education_level", label: "Education Level", value: "", kind: "text" },
      { key: "institution_name", label: "Institution Name", value: "", kind: "text" },
      { key: "degree_or_certificate", label: "Degree or Certificate", value: "", kind: "text" },
      { key: "field_of_study", label: "Field of Study", value: "", kind: "text" },
      { key: "start_date", label: "Start Date", value: "", kind: "text" },
      { key: "end_date", label: "End Date", value: "", kind: "text" },
      { key: "academic_certificate_document_url", label: "Academic Certificate URL", value: "", kind: "text" },
    ]
  }
  if (name === "professional qualifications") {
    return [
      { key: "country_of_residence", label: "Country of Residence", value: "", kind: "text" },
      { key: "institution_name", label: "Institution Name", value: "", kind: "text" },
      { key: "programme_name", label: "Programme Name", value: "", kind: "text" },
      { key: "issuing_organization", label: "Issuing Organization", value: "", kind: "text" },
      { key: "issue_date", label: "Issue Date", value: "", kind: "text" },
      { key: "expiry_date", label: "Expiry Date", value: "", kind: "text" },
      { key: "professional_certificate_document_url", label: "Professional Certificate Attachment", value: "", kind: "text" },
    ]
  }
  if (name === "experience details") {
    return [
      { key: "company_name", label: "Company Name", value: "", kind: "text" },
      { key: "job_title", label: "Job Title", value: "", kind: "text" },
      { key: "responsibilities_description", label: "Responsibilities Description", value: "", kind: "text" },
      { key: "start_date", label: "Start Date", value: "", kind: "text" },
      { key: "end_date", label: "End Date", value: "", kind: "text" },
      { key: "currently_working", label: "Currently Working", value: "false", kind: "boolean" },
    ]
  }
  if (name === "documents") {
    return [
      { key: "type", label: "Type", value: "other", kind: "text" },
      { key: "title", label: "Title", value: "", kind: "text" },
      { key: "classification", label: "Classification", value: "PRIVATE", kind: "text" },
      { key: "retention_until", label: "Retention Until", value: "", kind: "text" },
      { key: "notes", label: "Notes", value: "", kind: "text" },
    ]
  }
  return []
}

function editableEntries(record: AdminRecord, sectionTitle: string) {
  const schema = sectionSchema(sectionTitle)
  if (schema.length > 0) {
    return schema.map((entry) => {
      const raw = record[entry.key]
      if (entry.kind === "boolean") {
        return { ...entry, value: raw === true ? "true" : "false" }
      }
      if (raw === null || raw === undefined) {
        return { ...entry, value: "" }
      }
      return { ...entry, value: String(raw) }
    })
  }

  const hiddenKeys = new Set(["id", "employee_id", "company_user_id", "company_id", "user_id", "created_at", "updated_at"])
  const entries: Array<{ key: string; label: string; value: string; kind: "text" | "boolean" }> = []

  for (const [key, rawValue] of Object.entries(record)) {
    if (hiddenKeys.has(key) || key.endsWith("_id")) {
      continue
    }
    if (rawValue === null || rawValue === undefined) {
      continue
    }
    if (Array.isArray(rawValue) || typeof rawValue === "object") {
      continue
    }

    let label = key.replace(/_/g, " ")
    if (key === "is_primary") {
      label = sectionTitle.toLowerCase() === "departments" ? "Primary Department" : "Primary Contact"
    }
    if (key === "is_verified") {
      label = "Verified"
    }

    if (typeof rawValue === "boolean") {
      entries.push({ key, label, value: rawValue ? "true" : "false", kind: "boolean" })
      continue
    }

    entries.push({ key, label, value: String(rawValue), kind: "text" })
  }

  return entries
}

const PROFILE_SECTION_DEFS: Array<{
  title: string
  /** Compact tab label (matches Employees top-tab density). Full title used in content. */
  tabLabel: string
  keys: string[]
  special?: "company_user"
}> = [
  { title: "Contacts", tabLabel: "Contacts", keys: ["contacts", "contact_details", "contactDetails"] },
  { title: "Documents", tabLabel: "Documents", keys: ["documents", "employee_documents", "employeeDocuments"] },
  { title: "Letters", tabLabel: "Letters", keys: [] },
  { title: "Addresses", tabLabel: "Addresses", keys: ["addresses", "address_details", "addressDetails"] },
  { title: "Relatives", tabLabel: "Relatives", keys: ["relatives", "next_of_kin", "nextOfKin"] },
  { title: "Identifications", tabLabel: "IDs", keys: ["identifications", "identification_documents", "identificationDocuments"] },
  { title: "Bank Accounts", tabLabel: "Banks", keys: ["bank_accounts", "bankAccounts"] },
  { title: "Departments", tabLabel: "Depts", keys: ["departments", "department_assignments", "departmentAssignments"] },
  { title: "Positions", tabLabel: "Positions", keys: ["position_assignments", "positionAssignments"] },
  { title: "Movements", tabLabel: "Movements", keys: ["employee_movements", "employeeMovements"] },
  { title: "Status History", tabLabel: "History", keys: [] },
  { title: "Academic Qualifications", tabLabel: "Academic", keys: ["academic_qualifications", "academicQualifications"] },
  { title: "Professional Qualifications", tabLabel: "Professional", keys: ["professional_qualifications", "professionalQualifications"] },
  { title: "Experience Details", tabLabel: "Experience", keys: ["experience_details", "experienceDetails"] },
  { title: "Company User", tabLabel: "User", keys: [], special: "company_user" },
]

function resolveProfileSectionItems(employee: AdminRecord, def: (typeof PROFILE_SECTION_DEFS)[number]) {
  if (def.special === "company_user") {
    return firstRecordArray(
      employee.company_user ? [asRecord(employee.company_user) ?? {}] : [],
      employee.companyUser ? [asRecord(employee.companyUser) ?? {}] : []
    ).map((companyUser) => ({
      ...companyUser,
      __linked_account: true,
      __can_manage_linked_account: true,
    }))
  }
  const items = getProfileSectionItems(employee, def.keys)
  if (def.title !== "Contacts" || items.length > 0) {
    return items
  }

  const accountContact = getEmployeeDirectoryContactSummary(employee)
  const companyUserId = readNumber(
    employee.company_user_id ?? employee.companyUserId,
  )
  return accountContact && companyUserId !== null
    ? [
        {
          contact_type: "Linked account",
          ...accountContact,
          source: "Employee or company-user account",
          __linked_account: true,
          __can_manage_linked_account: true,
        },
      ]
    : []
}

function ProfileSectionsTabs({
  employee,
  employeeId,
  onMutated,
  requestedRouteKey,
  header,
}: {
  employee: AdminRecord
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
  header?: React.ReactNode
}) {
  const sections = React.useMemo(
    () =>
      PROFILE_SECTION_DEFS.map((def) => {
        const items = resolveProfileSectionItems(employee, def)
        return {
          title: def.title,
          tabLabel: def.tabLabel,
          routeKey: sectionTitleToRouteKey(def.title),
          items,
          count: items.length,
        }
      }),
    [employee]
  )

  const requestedTitle = routeKeyToSectionTitle(requestedRouteKey)
  const [activeTitle, setActiveTitle] = React.useState(
    () => requestedTitle ?? sections[0]?.title ?? "Contacts"
  )

  React.useEffect(() => {
    if (requestedTitle) {
      setActiveTitle(requestedTitle)
    }
  }, [requestedTitle])

  const active = sections.find((section) => section.title === activeTitle) ?? sections[0]
  const activeIndex = Math.max(0, sections.findIndex((section) => section.title === active?.title))
  const [slideDirection, setSlideDirection] = React.useState(1)
  const motionPreset = useDashboardMotion()

  const selectSection = React.useCallback((title: string) => {
    const nextIndex = sections.findIndex((section) => section.title === title)
    if (nextIndex < 0 || title === activeTitle) return
    setSlideDirection(nextIndex > activeIndex ? 1 : -1)
    setActiveTitle(title)
  }, [activeIndex, activeTitle, sections])

  return (
    <div className="border border-border bg-card">
      {header}
      <div
        className="flex flex-wrap items-center gap-x-0.5 gap-y-0.5 border-t border-border px-2 py-1"
        role="tablist"
        aria-label="Employee profile sections"
      >
        {sections.map((section) => {
          const isActive = section.title === active?.title
          const needsAttention = requestedRouteKey === section.routeKey
          return (
            <button
              key={section.routeKey}
              type="button"
              role="tab"
              title={`${section.title} (${section.count})`}
              aria-label={`${section.title}, ${section.count} items`}
              aria-selected={isActive}
              onClick={() => selectSection(section.title)}
              className={cn(
                "inline-flex h-6 items-center border-b-2 px-1.5 text-[10px] font-semibold whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                needsAttention && !isActive ? "text-primary" : null
              )}
            >
              {section.tabLabel}
              <span
                className={cn(
                  "ml-1 tabular-nums",
                  isActive ? "text-primary/70" : "text-muted-foreground"
                )}
              >
                {section.count}
              </span>
            </button>
          )
        })}
      </div>

        <div className="relative overflow-hidden border-t border-border p-4 sm:p-5">
          <AnimatePresence mode="wait" custom={slideDirection} initial={false}>
            {active ? (
              <motion.div
                key={active.routeKey}
                custom={slideDirection}
                initial={
                  motionPreset.reduce
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: slideDirection * 48 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  motionPreset.reduce
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: slideDirection * -48 }
                }
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {active.title === "Departments" ? (
                  <DepartmentAssignmentsSection
                    items={active.items}
                    employee={employee}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                ) : active.title === "Positions" ? (
                  <PositionAssignmentsSection
                    items={active.items}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                ) : active.title === "Movements" ? (
                  <EmployeeMovementsSection
                    items={active.items}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                ) : active.title === "Status History" ? (
                  <EmployeeStatusHistorySection employeeId={employeeId} token={readStoredToken()} />
                ) : active.title === "Letters" ? (
                  <EmployeeLettersSection employeeId={employeeId} />
                ) : (
                  <Section
                    title={active.title}
                    items={active.items}
                    employeeId={employeeId}
                    onMutated={onMutated}
                    requestedRouteKey={requestedRouteKey}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
    </div>
  )
}

function EmployeeLettersSection({ employeeId }: { employeeId: number | null }) {
  const [history, setHistory] = React.useState<AdminRecord[]>([])
  const [letterType, setLetterType] = React.useState<"JOINING_FORM" | "OTHER">("JOINING_FORM")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token || employeeId === null) return
    try {
      setError(null)
      setHistory(await listEmployeeLetterHistory(token, employeeId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load generated letters.")
    }
  }, [employeeId])

  React.useEffect(() => { void refresh() }, [refresh])

  async function preview() {
    const token = readStoredToken()
    if (!token || employeeId === null) return
    setBusy(true)
    try {
      const blob = await downloadEmployeeLetterPreview(token, employeeId, letterType)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the letter.")
    } finally { setBusy(false) }
  }

  async function generate() {
    const token = readStoredToken()
    if (!token || employeeId === null) return
    setBusy(true)
    try {
      await generateEmployeeTemplateLetter(token, employeeId, letterType)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the letter.")
    } finally { setBusy(false) }
  }

  async function download(id: number) {
    const token = readStoredToken()
    if (!token) return
    try {
      const blob = await downloadEmploymentLetter(token, id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "employee-letter.pdf"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the letter.")
    }
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">Template type
          <select className="h-9 rounded-md border border-border bg-background px-2" value={letterType} onChange={(event) => setLetterType(event.target.value as typeof letterType)}>
            <option value="JOINING_FORM">Joining form</option><option value="OTHER">Other letter</option>
          </select>
        </label>
        <button type="button" disabled={busy || employeeId === null} onClick={() => void preview()} className="rounded-md border border-border px-3 py-2 text-sm">Preview</button>
        <button type="button" disabled={busy || employeeId === null} onClick={() => void generate()} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Generate and save</button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="divide-y divide-border rounded-md border border-border">
        {history.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No generated letters yet.</p> : history.map((row) => (
          <div key={String(row.id)} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div><p className="text-sm font-medium">{String(row.title ?? "Generated letter")}</p><p className="text-xs text-muted-foreground">{String(row.document_type ?? "")} · {String(row.created_at ?? "")}</p></div>
            <button type="button" onClick={() => void download(Number(row.id))} className="rounded-md border border-border px-3 py-1.5 text-sm">Download PDF</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function Section({
  title,
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  title: string
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const [editingRecord, setEditingRecord] = React.useState<{ item: AdminRecord; index: number } | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<{ item: AdminRecord; index: number } | null>(null)
  const [linkedAccountAction, setLinkedAccountAction] = React.useState<"unlink" | "remove" | null>(null)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editForm, setEditForm] = React.useState<Record<string, string>>({})
  const [addForm, setAddForm] = React.useState<Record<string, string>>({})
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null)
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [downloadingId, setDownloadingId] = React.useState("")
  const token = readStoredToken()
  const apiSection = sectionTitleToApiSection(title)
  const isDocumentsSection = title.toLowerCase() === "documents"
  const isContactsSection = title.toLowerCase() === "contacts"
  const routeKey = sectionTitleToRouteKey(title)
  const isHighlighted = requestedRouteKey === routeKey
  const supportsMutations = Boolean((apiSection || isDocumentsSection) && employeeId)
  const supportsAdd = supportsMutations
  const supportsDelete = supportsMutations
  const supportsEdit = Boolean(apiSection && !isDocumentsSection)

  React.useEffect(() => {
    if (!editingRecord) {
      setEditForm({})
      return
    }
    const initial = Object.fromEntries(
      editableEntries(editingRecord.item, title).map((entry) => [entry.key, entry.value])
    )
    setEditForm(initial)
  }, [editingRecord, title])

  const templateEntries = React.useMemo(() => {
    return sectionSchema(title)
  }, [title])

  React.useEffect(() => {
    if (!addingRecord) {
      setAddForm({})
      setDocumentUploadFile(null)
      return
    }
    const initial = Object.fromEntries(templateEntries.map((entry) => [entry.key, entry.value]))
    setAddForm(initial)
  }, [addingRecord, templateEntries])

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label={`${title} section`}
        className={cn(
          "scroll-mt-24 outline-none",
          isHighlighted && "ring-2 ring-primary/30"
        )}
      >
        {supportsAdd || items.length === 0 || isHighlighted ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {items.length === 0 ? (
              <span className="text-xs font-medium text-primary/70">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="bg-primary/12 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Needs attention
              </span>
            ) : null}
          </div>
          {supportsAdd ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>
        ) : null}
        {mutationError && !addingRecord && !deletingRecord && !editingRecord ? (
          <p className="mb-2 text-sm text-rose-600">{mutationError}</p>
        ) : null}
        {items.length === 0 ? (
          <p className="border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No data available.
          </p>
        ) : (
          <div>
            {items.map((item, index) => (
              <div
                key={`${title}-${index}`}
                className="border-t border-border py-3 first:border-t-0 first:pt-0"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-foreground">{recordPreview(item)}</p>
                    {isDocumentsSection ? (
                      (() => {
                        const documentUrl = readString(item, ["file_url"])
                        if (documentUrl === "-") {
                          return null
                        }
                        return (
                          <a
                            href={documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                          >
                            Open attachment
                          </a>
                        )
                      })()
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.__linked_account === true &&
                    item.__can_manage_linked_account === true &&
                    employeeId &&
                    token ? (
                      <>
                        <button
                          type="button"
                          aria-label="Unlink user account from employee"
                          className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => setLinkedAccountAction("unlink")}
                        >
                          <UnlinkIcon className="size-4" /> Unlink
                        </button>
                        <button
                          type="button"
                          aria-label="Delete linked account access"
                          className="inline-flex h-8 items-center gap-1 px-2 text-xs font-medium text-rose-600 hover:text-rose-700"
                          onClick={() => setLinkedAccountAction("remove")}
                        >
                          <UserRoundXIcon className="size-4" /> Delete access
                        </button>
                      </>
                    ) : null}
                    {isDocumentsSection && employeeId && token ? (
                      <button
                        type="button"
                        aria-label={`Download ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                        disabled={downloadingId === String(readNumber(item.id) ?? index)}
                        onClick={() => {
                          const itemId = readNumber(item.id)
                          if (itemId === null) {
                            setMutationError("This file does not have an id to download.")
                            return
                          }
                          setDownloadingId(String(itemId))
                          void downloadEmployeeDocument(token, employeeId, itemId)
                            .then((result) => {
                              const url = URL.createObjectURL(result.blob)
                              const link = document.createElement("a")
                              link.href = url
                              link.download = result.filename
                              link.click()
                              URL.revokeObjectURL(url)
                            })
                            .catch((errorObject) => {
                              setMutationError(
                                errorObject instanceof Error
                                  ? errorObject.message
                                  : "Could not download this file.",
                              )
                            })
                            .finally(() => setDownloadingId(""))
                        }}
                      >
                        <DownloadIcon className="size-4" />
                      </button>
                    ) : null}
                    {supportsEdit && readNumber(item.id) !== null ? (
                      <button
                        type="button"
                        aria-label={`Edit ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord({ item, index })}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                    ) : null}
                    {supportsDelete && readNumber(item.id) !== null ? (
                      <button
                        type="button"
                        aria-label={`${isContactsSection ? "Remove" : "Delete"} ${title} record ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord({ item, index })}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  {renderRecordFields(item, title)
                    .filter((entry) => entry.value.trim() !== "" && entry.value !== "-" && entry.value !== "Available")
                    .map((entry) => (
                      <div key={`${title}-${index}-${entry.label}`} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {entry.label}
                        </p>
                        {entry.label.toLowerCase().includes("country") ? (
                          <span className="inline-flex items-center gap-1 break-words text-foreground">
                            {(() => {
                              const option = findCountryOption(entry.value)
                              if (!option) {
                                return null
                              }
                              return (
                                <CountryFlag
                                  code={option.code}
                                  className="h-3 w-4 rounded-sm border border-border"
                                />
                              )
                            })()}
                            <span>{entry.value}</span>
                          </span>
                        ) : (
                          <p className="break-words text-foreground">{entry.value}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRecord(null)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit {title} Record</AlertDialogTitle>
            <AlertDialogDescription>
              Update the selected {title.toLowerCase()} information for this employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {editingRecord
              ? editableEntries(editingRecord.item, title).map((entry) => (
                  <div key={entry.key} className={entry.key === "responsibilities_description" || entry.key === "notes" ? "sm:col-span-2" : ""}>
                    {renderEntryInput({
                      entry,
                      value: editForm[entry.key] ?? entry.value,
                      onChange: (value) => {
                        setEditForm((current) => ({ ...current, [entry.key]: value }))
                      },
                    })}
                  </div>
                ))
              : null}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Close</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !editingRecord || !supportsEdit}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                if (!editingRecord || !apiSection || !employeeId || !token) {
                  return
                }
                const itemId = readNumber(editingRecord.item.id)
                if (itemId === null) {
                  setMutationError("Missing record id; cannot update this item.")
                  return
                }
                const payload: AdminRecord = {}
                for (const entry of editableEntries(editingRecord.item, title)) {
                  const raw = editForm[entry.key] ?? entry.value
                  payload[entry.key] = entry.kind === "boolean" ? raw === "true" : raw
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (!apiSection) {
                    setMutationError("Edit is not supported for this section.")
                    return
                  }
                  await patchEmployeeSectionItem(token, employeeId, apiSection, itemId, payload)
                  setEditingRecord(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to update record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={linkedAccountAction !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setLinkedAccountAction(null)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {linkedAccountAction === "remove"
                ? "Delete linked account access?"
                : "Unlink this user account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {linkedAccountAction === "remove"
                ? "The login will be detached from this employee and its company access will be deactivated. The employee profile and audit history will be retained."
                : "The login will be detached from this employee. The user account will remain available as a separate company account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? (
            <p className="text-sm text-rose-600">{mutationError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !employeeId || !token}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50",
                linkedAccountAction === "remove"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-primary",
              )}
              onClick={async () => {
                if (!linkedAccountAction || !employeeId || !token) return
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (linkedAccountAction === "remove") {
                    await removeEmployeeLinkedAccount(token, employeeId)
                  } else {
                    await unlinkEmployeeCompanyUser(token, employeeId)
                  }
                  setLinkedAccountAction(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(
                    errorObject instanceof Error
                      ? errorObject.message
                      : "Failed to update the linked account.",
                  )
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting
                ? "Working..."
                : linkedAccountAction === "remove"
                  ? "Delete access"
                  : "Unlink account"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRecord(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{isContactsSection ? "Remove contact" : "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isContactsSection
                ? "The contact row will remain for audit history, but its email and phone values will be cleared. For an exited employee, matching login contact values will also be released for reuse."
                : `Are you sure you want to delete this ${title.toLowerCase()} record? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={!supportsDelete || submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
              onClick={async () => {
                if (!deletingRecord || !employeeId || !token) {
                  return
                }
                const itemId = readNumber(deletingRecord.item.id)
                if (itemId === null) {
                  setMutationError("Missing record id; cannot delete this item.")
                  return
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (isDocumentsSection) {
                    await deleteEmployeeDocument(token, employeeId, itemId)
                  } else if (apiSection) {
                    await deleteEmployeeSectionItem(token, employeeId, apiSection, itemId)
                  } else {
                    setMutationError("Delete is not supported for this section.")
                    return
                  }
                  setDeletingRecord(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to delete record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? (isContactsSection ? "Removing..." : "Deleting...") : isContactsSection ? "Remove contact" : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open) {
            setAddingRecord(false)
            setMutationError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Add {title} Record</AlertDialogTitle>
            <AlertDialogDescription>
              Fill in the details to create a new {title.toLowerCase()} record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            {templateEntries.length === 0 ? (
              <p className="text-sm text-slate-500 md:col-span-2">
                Add form is not yet configured for this section.
              </p>
            ) : (
              templateEntries.map((entry) => (
                <label key={`add-${title}-${entry.key}`} className="grid min-w-0 gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</span>
                  {renderEntryInput({
                    entry,
                    value: addForm[entry.key] ?? entry.value,
                    onChange: (nextValue) => setAddForm((prev) => ({ ...prev, [entry.key]: nextValue })),
                  })}
                </label>
              ))
            )}
            {isDocumentsSection ? (
              <label className="grid min-w-0 gap-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Attachment
                </span>
                <input
                  type="file"
                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setDocumentUploadFile(file)
                  }}
                />
                <p className="text-xs text-slate-500">
                  {documentUploadFile
                    ? `${documentUploadFile.name} · ${formatFileSize(documentUploadFile.size)}`
                    : "Choose the document file to upload."}
                </p>
              </label>
            ) : null}
          </div>
          {isDocumentsSection && !documentUploadFile ? (
            <p className="text-sm text-amber-700">Choose a file before adding this document.</p>
          ) : null}
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || !supportsAdd || templateEntries.length === 0}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={async () => {
                if (!employeeId || !token || templateEntries.length === 0) {
                  return
                }
                const payload: AdminRecord = {}
                for (const entry of templateEntries) {
                  const raw = addForm[entry.key] ?? entry.value
                  if (!raw.trim() && entry.kind !== "boolean") {
                    continue
                  }
                  payload[entry.key] = entry.kind === "boolean" ? raw === "true" : raw
                }
                setSubmitting(true)
                setMutationError(null)
                try {
                  if (isDocumentsSection) {
                    if (!documentUploadFile) {
                      setMutationError("Choose a file before adding this document.")
                      return
                    }
                    payload.file = await fileToBase64UploadDto(documentUploadFile)
                    await createEmployeeDocument(token, employeeId, payload)
                  } else if (apiSection) {
                    await createEmployeeSectionItem(token, employeeId, apiSection, payload)
                  } else {
                    setMutationError("Add is not supported for this section.")
                    return
                  }
                  setAddingRecord(false)
                  setDocumentUploadFile(null)
                  await onMutated()
                } catch (errorObject) {
                  setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to add record.")
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DepartmentAssignmentsSection({
  items,
  employee,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  items: AdminRecord[]
  employee: AdminRecord
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const token = readStoredToken()
  const routeKey = sectionTitleToRouteKey("Departments")
  const isHighlighted = requestedRouteKey === routeKey
  const [departmentOptions, setDepartmentOptions] = React.useState<AdminRecord[]>([])
  const [departmentsLoading, setDepartmentsLoading] = React.useState(false)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<AdminRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<AdminRecord | null>(null)
  const [form, setForm] = React.useState<DepartmentAssignmentFormState>(() =>
    emptyDepartmentAssignmentForm()
  )
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  React.useEffect(() => {
    if (!addingRecord && !editingRecord) {
      setForm(emptyDepartmentAssignmentForm())
      return
    }
    if (editingRecord) {
      setForm(readDepartmentAssignmentForm(editingRecord))
      return
    }
    setForm(emptyDepartmentAssignmentForm())
  }, [addingRecord, editingRecord])

  React.useEffect(() => {
    if (!token || (!addingRecord && !editingRecord)) {
      return
    }

    let cancelled = false
    setDepartmentsLoading(true)

    void listDepartments(token, {
      page: 1,
      limit: 200,
      sortBy: "name",
      sortOrder: "ASC",
    })
      .then((result) => {
        if (!cancelled) {
          setDepartmentOptions(result.rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDepartmentOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDepartmentsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, editingRecord, token])

  const closeDialogs = React.useCallback(() => {
    setAddingRecord(false)
    setEditingRecord(null)
    setDeletingRecord(null)
    setMutationError(null)
    setSubmitting(false)
  }, [])

  const currentAssignments = React.useMemo(
    () =>
      items
        .map((item) => {
          const departmentId = resolveDepartmentAssignmentDepartmentId(item)
          if (departmentId === null) {
            return null
          }
          return {
            id: readNumber(item.id),
            department_id: departmentId,
            is_primary: isPrimaryDepartmentAssignment(item),
          }
        })
        .filter(
          (
            assignment
          ): assignment is { id: number | null; department_id: number; is_primary: boolean } =>
            assignment !== null
        ),
    [items]
  )

  const renderAssignmentField = (label: string, value: string) => {
    if (!value || value === "-") {
      return null
    }
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-foreground">{value}</p>
      </div>
    )
  }

  const submitMutation = React.useCallback(async () => {
    if (!employeeId || !token) {
      setMutationError("Authentication required. Please log in again.")
      return
    }

    const departmentId = Number(form.department_id)
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      setMutationError("Select a department.")
      return
    }
    if (!form.effective_date.trim()) {
      setMutationError("Effective date is required.")
      return
    }

    const editingAssignmentId = editingRecord ? readNumber(editingRecord.id) : null
    const duplicate = currentAssignments.find(
      (assignment) =>
        assignment.department_id === departmentId &&
        assignment.id !== editingAssignmentId
    )
    if (duplicate) {
      setMutationError("This department is already assigned to the employee.")
      return
    }

    let nextAssignments = currentAssignments
      .filter((assignment) => assignment.id !== editingAssignmentId)
      .map((assignment) => ({
        department_id: assignment.department_id,
        is_primary: assignment.is_primary,
      }))

    nextAssignments.push({
      department_id: departmentId,
      is_primary: form.is_primary === "true",
    })

    if (form.is_primary === "true") {
      nextAssignments = nextAssignments.map((assignment) => ({
        ...assignment,
        is_primary: assignment.department_id === departmentId,
      }))
    } else if (!nextAssignments.some((assignment) => assignment.is_primary) && nextAssignments.length > 0) {
      nextAssignments = nextAssignments.map((assignment, index) => ({
        ...assignment,
        is_primary: index === 0,
      }))
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await patchEmployeeAssignment(
        token,
        employeeId,
        buildEmployeeAssignmentPayload(
          employee,
          nextAssignments,
          form.effective_date,
          form.reason
        )
      )
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update department assignments."
      )
    } finally {
      setSubmitting(false)
    }
  }, [
    closeDialogs,
    currentAssignments,
    editingRecord,
    employee,
    employeeId,
    form,
    onMutated,
    token,
  ])

  const deleteMutation = React.useCallback(async () => {
    if (!deletingRecord || !employeeId || !token) {
      return
    }

    const deletingAssignmentId = readNumber(deletingRecord.id)
    if (deletingAssignmentId === null) {
      setMutationError("Missing assignment id; cannot delete this department.")
      return
    }

    let nextAssignments = currentAssignments
      .filter((assignment) => assignment.id !== deletingAssignmentId)
      .map((assignment) => ({
        department_id: assignment.department_id,
        is_primary: assignment.is_primary,
      }))

    if (!nextAssignments.some((assignment) => assignment.is_primary) && nextAssignments.length > 0) {
      nextAssignments = nextAssignments.map((assignment, index) => ({
        ...assignment,
        is_primary: index === 0,
      }))
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await patchEmployeeAssignment(
        token,
        employeeId,
        buildEmployeeAssignmentPayload(
          employee,
          nextAssignments,
          new Date().toISOString().slice(0, 10),
          ""
        )
      )
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete department assignment."
      )
    } finally {
      setSubmitting(false)
    }
  }, [closeDialogs, currentAssignments, deletingRecord, employee, employeeId, onMutated, token])

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Departments section"
        className={cn(
          "scroll-mt-24 px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted &&
            "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Departments</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
            {items.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
                Not provided
              </span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {employeeId ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No department assignments available.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const departmentName = departmentAssignmentPreview(item)
              const assignedAt = formatDateTime(item.created_at)
              const branchName = readNestedString(item.department, ["branch_name", "branchName"])
              return (
                <div
                  key={`departments-${index}`}
                  className="border-b border-border pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {departmentName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {isPrimaryDepartmentAssignment(item) ? (
                          <span className="text-xs text-muted-foreground">Primary</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit department assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord(item)}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete department assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord(item)}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {renderAssignmentField("Assigned At", assignedAt)}
                    {renderAssignmentField("Branch", branchName)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={addingRecord || Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingRecord ? "Edit Department Assignment" : "Add Department Assignment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingRecord
                ? "Update the selected employee department assignment."
                : "Create a new department assignment for this employee."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Department
              </span>
              <FluentSelect
                ariaLabel="Department"
                className="w-full"
                value={form.department_id}
                onChange={(value) =>
                  setForm((current) => ({ ...current, department_id: value }))
                }
                disabled={departmentsLoading}
                placeholder={departmentsLoading ? "Loading departments..." : "Select department"}
                options={[
                  {
                    value: "",
                    label: departmentsLoading ? "Loading departments..." : "Select department",
                  },
                  ...departmentOptions.flatMap((option) => {
                    const optionId = readNumber(option.id)
                    if (optionId === null) {
                      return []
                    }
                    return [{ value: String(optionId), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Primary Assignment
              </span>
              <FluentSelect
                ariaLabel="Primary Assignment"
                className="w-full"
                value={form.is_primary}
                onChange={(value) =>
                  setForm((current) => ({ ...current, is_primary: value }))
                }
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ]}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Effective Date
              </span>
              <DatePickerPresets
                value={form.effective_date}
                onChange={(value) =>
                  setForm((current) => ({ ...current, effective_date: value }))
                }
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </span>
              <Textarea
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reason: event.target.value }))
                }
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitMutation()}
            >
              {submitting ? "Saving..." : editingRecord ? "Save" : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this employee department assignment and keep the remaining assignment history aligned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => void deleteMutation()}
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PositionAssignmentsSection({
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const token = readStoredToken()
  const routeKey = sectionTitleToRouteKey("Positions")
  const isHighlighted = requestedRouteKey === routeKey
  const [positionOptions, setPositionOptions] = React.useState<AdminRecord[]>([])
  const [positionsLoading, setPositionsLoading] = React.useState(false)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<AdminRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = React.useState<AdminRecord | null>(null)
  const [form, setForm] = React.useState<PositionAssignmentFormState>(() => emptyPositionAssignmentForm())
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  React.useEffect(() => {
    if (!addingRecord && !editingRecord) {
      setForm(emptyPositionAssignmentForm())
      return
    }
    if (editingRecord) {
      setForm(readPositionAssignmentForm(editingRecord))
      return
    }
    setForm(emptyPositionAssignmentForm())
  }, [addingRecord, editingRecord])

  React.useEffect(() => {
    if (!token || (!addingRecord && !editingRecord)) {
      return
    }

    let cancelled = false
    setPositionsLoading(true)

    void listPositions(token, {
      page: 1,
      limit: 200,
      sortBy: "name",
      sortOrder: "ASC",
    })
      .then((result) => {
        if (!cancelled) {
          setPositionOptions(result.rows)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPositionOptions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPositionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, editingRecord, token])

  const closeDialogs = React.useCallback(() => {
    setAddingRecord(false)
    setEditingRecord(null)
    setDeletingRecord(null)
    setMutationError(null)
    setSubmitting(false)
  }, [])

  const submitMutation = React.useCallback(async () => {
    if (!employeeId || !token) {
      setMutationError("Authentication required. Please log in again.")
      return
    }

    const positionId = Number(form.position_id)
    if (!Number.isFinite(positionId) || positionId <= 0) {
      setMutationError("Select a position.")
      return
    }
    if (!form.start_date.trim()) {
      setMutationError("Start date is required.")
      return
    }

    const payload: AdminRecord = {
      employee_id: employeeId,
      position_id: positionId,
      assignment_type: form.assignment_type,
      status: form.status,
      is_primary: form.is_primary === "true",
      start_date: form.start_date,
      end_date: form.end_date.trim() || null,
      notes: form.notes.trim() || null,
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      if (editingRecord) {
        const assignmentId = readNumber(editingRecord.id)
        if (assignmentId === null) {
          setMutationError("Missing assignment id; cannot update this position.")
          return
        }
        await patchEmployeePosition(token, assignmentId, payload)
      } else {
        await createEmployeePosition(token, payload)
      }
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to save position assignment.")
    } finally {
      setSubmitting(false)
    }
  }, [closeDialogs, editingRecord, employeeId, form, onMutated, token])

  const deleteMutation = React.useCallback(async () => {
    if (!deletingRecord || !token) {
      return
    }

    const assignmentId = readNumber(deletingRecord.id)
    if (assignmentId === null) {
      setMutationError("Missing assignment id; cannot delete this position.")
      return
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await deleteEmployeePosition(token, assignmentId)
      closeDialogs()
      await onMutated()
    } catch (errorObject) {
      setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to delete position assignment.")
    } finally {
      setSubmitting(false)
    }
  }, [closeDialogs, deletingRecord, onMutated, token])

  const renderAssignmentField = (label: string, value: string, className?: string) => {
    if (!value || value === "-") {
      return null
    }
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("break-words text-foreground", className)}>{value}</p>
      </div>
    )
  }

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Positions section"
        className={cn(
          "scroll-mt-24 px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Positions</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {items.length}
            </span>
            {items.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {employeeId ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No position assignments available.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const status = readString(item, ["status"])
              const assignmentType = readString(item, ["assignment_type", "assignmentType"])
              const positionName = positionAssignmentPreview(item)
              const departmentName = readNestedString(
                item.department ?? item.departmentDetail ?? item.primary_department,
                ["name", "department_name", "departmentName"]
              )
              const startDate = formatProfileDate(
                readString(item, ["start_date", "startDate", "effective_from", "effectiveFrom"])
              )
              const endDate = formatProfileDate(
                readString(item, ["end_date", "endDate", "effective_to", "effectiveTo"])
              )
              const notes = readString(item, ["notes"])

              return (
                <div key={`positions-${index}`} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">{positionName}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {assignmentType !== "-" ? (
                          <span className={cn("font-medium", assignmentTypeTone(assignmentType))}>
                            {formatLabelValue(assignmentType)}
                          </span>
                        ) : null}
                        {status !== "-" ? (
                          <span className={cn("font-medium", statusTone(status))}>
                            {formatLabelValue(status)}
                          </span>
                        ) : null}
                        {isPrimaryEmployeePosition(item) &&
                        assignmentType.trim().toLowerCase() !== "primary" ? (
                          <span className="font-medium text-primary">Primary</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Edit position assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRecord(item)}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete position assignment ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setDeletingRecord(item)}
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {renderAssignmentField("Department", departmentName)}
                    {renderAssignmentField("Start Date", startDate)}
                    {renderAssignmentField("End Date", endDate)}
                    {renderAssignmentField("Notes", notes)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={addingRecord || Boolean(editingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {editingRecord ? "Edit Position Assignment" : "Add Position Assignment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {editingRecord
                ? "Update the selected employee position assignment."
                : "Create a new position assignment for this employee."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Position
              </span>
              <FluentSelect
                ariaLabel="Position"
                className="w-full"
                value={form.position_id}
                onChange={(value) => setForm((current) => ({ ...current, position_id: value }))}
                disabled={positionsLoading}
                placeholder={positionsLoading ? "Loading positions..." : "Select position"}
                options={[
                  {
                    value: "",
                    label: positionsLoading ? "Loading positions..." : "Select position",
                  },
                  ...positionOptions.flatMap((option) => {
                    const optionId = readNumber(option.id)
                    if (optionId === null) {
                      return []
                    }
                    return [{ value: String(optionId), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assignment Type
              </span>
              <FluentSelect
                ariaLabel="Assignment Type"
                className="w-full"
                value={form.assignment_type}
                onChange={(value) =>
                  setForm((current) => ({ ...current, assignment_type: value }))
                }
                options={POSITION_ASSIGNMENT_TYPE_OPTIONS.map((option) => ({
                  value: option,
                  label: formatLabelValue(option),
                }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </span>
              <FluentSelect
                ariaLabel="Status"
                className="w-full"
                value={form.status}
                onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                options={POSITION_ASSIGNMENT_STATUS_OPTIONS.map((option) => ({
                  value: option,
                  label: formatLabelValue(option),
                }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Start Date
              </span>
              <DatePickerPresets
                value={form.start_date}
                onChange={(value) => setForm((current) => ({ ...current, start_date: value }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                End Date
              </span>
              <DatePickerPresets
                value={form.end_date}
                onChange={(value) => setForm((current) => ({ ...current, end_date: value }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Primary Assignment
              </span>
              <FluentSelect
                ariaLabel="Primary Assignment"
                className="w-full"
                value={form.is_primary}
                onChange={(value) =>
                  setForm((current) => ({ ...current, is_primary: value }))
                }
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ]}
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </span>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => void submitMutation()}
            >
              {submitting ? "Saving..." : editingRecord ? "Save" : "Add"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deletingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialogs()
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this employee position assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              onClick={() => void deleteMutation()}
            >
              {submitting ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EmployeeMovementsSection({
  items,
  employeeId,
  onMutated,
  requestedRouteKey,
}: {
  items: AdminRecord[]
  employeeId: number | null
  onMutated: () => Promise<void>
  requestedRouteKey?: string | null
}) {
  const sectionRef = React.useRef<HTMLDivElement | null>(null)
  const token = readStoredToken()
  const routeKey = sectionTitleToRouteKey("Movements")
  const isHighlighted = requestedRouteKey === routeKey
  const [branchOptions, setBranchOptions] = React.useState<AdminRecord[]>([])
  const [departmentOptions, setDepartmentOptions] = React.useState<AdminRecord[]>([])
  const [positionOptions, setPositionOptions] = React.useState<AdminRecord[]>([])
  const [managerOptions, setManagerOptions] = React.useState<AdminRecord[]>([])
  const [gradeOptions, setGradeOptions] = React.useState<AdminRecord[]>([])
  const [costCenterOptions, setCostCenterOptions] = React.useState<AdminRecord[]>([])
  const [scopedPositionOptions, setScopedPositionOptions] = React.useState<AdminRecord[]>([])
  const [scopedPositionOptionsLoading, setScopedPositionOptionsLoading] = React.useState(false)
  const [scopedPositionOptionsLoaded, setScopedPositionOptionsLoaded] = React.useState(false)
  const [scopedManagerOptions, setScopedManagerOptions] = React.useState<AdminRecord[]>([])
  const [scopedManagerOptionsLoading, setScopedManagerOptionsLoading] = React.useState(false)
  const [scopedManagerOptionsLoaded, setScopedManagerOptionsLoaded] = React.useState(false)
  const [optionsLoading, setOptionsLoading] = React.useState(false)
  const [addingRecord, setAddingRecord] = React.useState(false)
  const [viewingRecord, setViewingRecord] = React.useState<AdminRecord | null>(null)
  const [movementOperations, setMovementOperations] = React.useState<AdminRecord[]>([])
  const [operationsLoading, setOperationsLoading] = React.useState(false)
  const [form, setForm] = React.useState<EmployeeMovementFormState>(() => emptyEmployeeMovementForm())
  const [mutationError, setMutationError] = React.useState<string | null>(null)
  const [detailError, setDetailError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [actioningId, setActioningId] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!isHighlighted || !sectionRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      sectionRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isHighlighted, items.length])

  React.useEffect(() => {
    if (!addingRecord) {
      setForm(emptyEmployeeMovementForm())
      setMutationError(null)
      return
    }

    if (!token) {
      return
    }

    let cancelled = false
    setOptionsLoading(true)

    void Promise.allSettled([
      listBranches(token, { page: 1, limit: 200 }),
      listDepartments(token, { page: 1, limit: 200 }),
      listPositions(token, { page: 1, limit: 200 }),
      listEmployeeGrades(token),
      listCostCenters(token),
    ])
      .then(([branches, departments, positions, grades, costCenters]) => {
        if (cancelled) {
          return
        }
        const failedOptions: string[] = []
        if (branches.status === "fulfilled") {
          setBranchOptions(branches.value.rows)
        } else {
          failedOptions.push("branches")
        }
        if (departments.status === "fulfilled") {
          setDepartmentOptions(departments.value.rows)
        } else {
          failedOptions.push("departments")
        }
        if (positions.status === "fulfilled") {
          setPositionOptions(positions.value.rows)
        } else {
          failedOptions.push("positions")
        }
        if (grades.status === "fulfilled") {
          setGradeOptions(grades.value)
        } else {
          failedOptions.push("grades")
        }
        if (costCenters.status === "fulfilled") {
          setCostCenterOptions(costCenters.value)
        } else {
          failedOptions.push("cost centers")
        }
        setManagerOptions([])
        if (failedOptions.length > 0) {
          setMutationError(`Some movement options could not be loaded: ${failedOptions.join(", ")}.`)
        }
      })
      .catch((errorObject) => {
        if (!cancelled) {
          setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to load movement options.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, token])

  React.useEffect(() => {
    if (!viewingRecord || !token) {
      setMovementOperations([])
      setDetailError(null)
      return
    }

    const movementId = readNumber(viewingRecord.id)
    if (movementId === null) {
      setMovementOperations([])
      setDetailError("Missing movement id; unable to load operations.")
      return
    }

    let cancelled = false
    setOperationsLoading(true)
    setDetailError(null)

    void listEmployeeMovementOperations(token, movementId)
      .then((rows) => {
        if (!cancelled) {
          setMovementOperations(rows)
        }
      })
      .catch((errorObject) => {
        if (!cancelled) {
          setMovementOperations([])
          setDetailError(errorObject instanceof Error ? errorObject.message : "Failed to load movement operations.")
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOperationsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token, viewingRecord])

  React.useEffect(() => {
    if (!addingRecord || !token || !form.new_department_id) {
      setScopedPositionOptions([])
      setScopedPositionOptionsLoaded(false)
      setScopedPositionOptionsLoading(false)
      setScopedManagerOptions([])
      setScopedManagerOptionsLoaded(false)
      setScopedManagerOptionsLoading(false)
      return
    }

    const selectedDepartmentId = Number(form.new_department_id)
    if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
      setScopedPositionOptions([])
      setScopedPositionOptionsLoaded(false)
      setScopedPositionOptionsLoading(false)
      setScopedManagerOptions([])
      setScopedManagerOptionsLoaded(false)
      setScopedManagerOptionsLoading(false)
      return
    }

    let cancelled = false
    setScopedPositionOptionsLoading(true)
    setScopedPositionOptionsLoaded(false)
    setScopedManagerOptionsLoading(true)
    setScopedManagerOptionsLoaded(false)

    void Promise.allSettled([
      listDepartmentPositions(token, selectedDepartmentId),
      listEmployees(token, {
        page: 1,
        limit: 200,
        sortBy: "created_at",
        sortOrder: "DESC",
        department_id: selectedDepartmentId,
      }),
    ])
      .then(([positions, managers]) => {
        if (cancelled) {
          return
        }
        if (positions.status === "fulfilled") {
          setScopedPositionOptions(
            normalizeDepartmentScopedPositionOptions(positions.value, selectedDepartmentId)
          )
          setScopedPositionOptionsLoaded(true)
        } else {
          setScopedPositionOptions([])
          setScopedPositionOptionsLoaded(false)
        }
        if (managers.status === "fulfilled") {
          setScopedManagerOptions(
            managers.value.rows.filter((row) => readNumber(row.id) !== employeeId)
          )
          setScopedManagerOptionsLoaded(true)
        } else {
          setScopedManagerOptions([])
          setScopedManagerOptionsLoaded(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScopedPositionOptionsLoading(false)
          setScopedManagerOptionsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [addingRecord, employeeId, form.new_department_id, token])

  const selectedBranchId = React.useMemo(() => {
    const parsed = Number(form.new_branch_id)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [form.new_branch_id])

  const filteredDepartmentOptions = React.useMemo(() => {
    if (selectedBranchId === null) {
      return departmentOptions
    }
    const matching = departmentOptions.filter((row) => relatedBranchId(row) === selectedBranchId)
    if (matching.length > 0) {
      return matching
    }
    return departmentOptions.filter((row) => relatedBranchId(row) === null)
  }, [departmentOptions, selectedBranchId])

  const selectedDepartmentName = React.useMemo(() => {
    const selected = filteredDepartmentOptions.find(
      (row) => String(readNumber(row.id) ?? "") === form.new_department_id
    )
    const label = selected ? recordOptionLabel(selected) : ""
    return label === "-" ? "" : label.trim().toLowerCase()
  }, [filteredDepartmentOptions, form.new_department_id])

  const availablePositionOptions = React.useMemo(() => {
    if (!form.new_department_id) {
      return positionOptions
    }

    const selectedDepartmentId = Number(form.new_department_id)
    if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
      return positionOptions
    }

    if (scopedPositionOptionsLoaded) {
      return scopedPositionOptions
    }

    return fallbackDepartmentScopedPositionOptions(
      positionOptions,
      selectedDepartmentId,
      selectedBranchId
    )
  }, [
    form.new_department_id,
    positionOptions,
    scopedPositionOptions,
    scopedPositionOptionsLoaded,
    selectedBranchId,
  ])

  const filteredCostCenterOptions = React.useMemo(() => {
    const selectedDepartmentId = form.new_department_id ? Number(form.new_department_id) : null
    return costCenterOptions.filter((row) => {
      const costCenterDepartmentId = readRelatedId(
        row,
        ["department", "departmentDetail", "primary_department", "primaryDepartment"],
        ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId"]
      )
      if (selectedDepartmentId === null) {
        return true
      }
      return costCenterDepartmentId === null || costCenterDepartmentId === selectedDepartmentId
    })
  }, [costCenterOptions, form.new_department_id])

  const availableManagerOptions = React.useMemo(() => {
    const eligible = managerOptions.filter((row) => readNumber(row.id) !== employeeId)
    if (!form.new_department_id) {
      return eligible
    }

    if (scopedManagerOptionsLoaded) {
      return scopedManagerOptions
    }

    return eligible.filter((row) => {
      const selectedDepartmentId = Number(form.new_department_id)
      if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
        return true
      }
      return (
        relatedDepartmentIds(row).has(selectedDepartmentId) ||
        (selectedDepartmentName !== "" && relatedDepartmentNames(row).has(selectedDepartmentName))
      )
    })
  }, [
    employeeId,
    form.new_department_id,
    managerOptions,
    scopedManagerOptions,
    scopedManagerOptionsLoaded,
    selectedDepartmentName,
  ])

  React.useEffect(() => {
    if (!addingRecord || !form.new_department_id) {
      return
    }

    const stillVisible = filteredDepartmentOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_department_id
    )
    if (!stillVisible) {
      setForm((current) => ({
        ...current,
        new_department_id: "",
        new_position_id: "",
        new_cost_center_id: "",
        new_manager_employee_id: "",
      }))
    }
  }, [addingRecord, filteredDepartmentOptions, form.new_department_id])

  React.useEffect(() => {
    if (!addingRecord || !form.new_position_id) {
      return
    }

    const stillVisible = availablePositionOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_position_id
    )
    if (!stillVisible) {
      setForm((current) => ({ ...current, new_position_id: "" }))
    }
  }, [addingRecord, availablePositionOptions, form.new_position_id])

  React.useEffect(() => {
    if (!addingRecord || !form.new_manager_employee_id) {
      return
    }

    const stillVisible = availableManagerOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_manager_employee_id
    )
    if (!stillVisible) {
      setForm((current) => ({ ...current, new_manager_employee_id: "" }))
    }
  }, [addingRecord, availableManagerOptions, form.new_manager_employee_id])

  React.useEffect(() => {
    if (!addingRecord || !form.new_cost_center_id) {
      return
    }

    const stillVisible = filteredCostCenterOptions.some(
      (row) => String(readNumber(row.id) ?? "") === form.new_cost_center_id
    )
    if (!stillVisible) {
      setForm((current) => ({ ...current, new_cost_center_id: "" }))
    }
  }, [addingRecord, filteredCostCenterOptions, form.new_cost_center_id])

  const sortedItems = React.useMemo(
    () =>
      [...items].sort((first, second) => {
        const firstCreatedAt = new Date(readString(first, ["createdAt", "created_at"])).getTime()
        const secondCreatedAt = new Date(readString(second, ["createdAt", "created_at"])).getTime()
        return (Number.isFinite(secondCreatedAt) ? secondCreatedAt : 0) - (Number.isFinite(firstCreatedAt) ? firstCreatedAt : 0)
      }),
    [items]
  )

  const showBranchField = form.movement_type === "BRANCH_TRANSFER" || form.movement_type === "COMPOSITE"
  const showDepartmentField = form.movement_type === "DEPARTMENT_TRANSFER" || form.movement_type === "COMPOSITE"
  const showPositionField = ["POSITION_CHANGE", "PROMOTION", "DEMOTION", "COMPOSITE"].includes(form.movement_type)
  const showManagerField = form.movement_type === "REPORTING_MANAGER_CHANGE" || form.movement_type === "COMPOSITE"
  const showGradeField = form.movement_type === "GRADE_CHANGE" || form.movement_type === "COMPOSITE"
  const showCostCenterField = form.movement_type === "COST_CENTER_CHANGE" || form.movement_type === "COMPOSITE"
  const showEmploymentTypeField =
    form.movement_type === "EMPLOYMENT_TYPE_CHANGE" || form.movement_type === "COMPOSITE"

  const closeAddDialog = React.useCallback(() => {
    setAddingRecord(false)
    setMutationError(null)
    setSubmitting(false)
  }, [])

  const submitCreate = React.useCallback(async () => {
    if (!token || employeeId === null) {
      setMutationError("Authentication required. Please log in again.")
      return
    }

    if (!form.title.trim()) {
      setMutationError("Title is required.")
      return
    }
    if (!form.reason.trim()) {
      setMutationError("Reason is required.")
      return
    }
    if (!form.effective_date.trim()) {
      setMutationError("Effective date is required.")
      return
    }

    const selectedTargets = [
      form.new_branch_id,
      form.new_department_id,
      form.new_position_id,
      form.new_grade_id,
      form.new_cost_center_id,
      form.new_manager_employee_id,
      form.new_employment_type,
    ].filter((value) => value.trim() !== "")

    if (showBranchField && !form.new_branch_id) {
      setMutationError("Choose the target branch for this movement.")
      return
    }
    if (showDepartmentField && !form.new_department_id) {
      setMutationError("Choose the target department for this movement.")
      return
    }
    if (showPositionField && !form.new_position_id) {
      setMutationError("Choose the target position for this movement.")
      return
    }
    if (showManagerField && !form.new_manager_employee_id) {
      setMutationError("Choose the target reporting manager for this movement.")
      return
    }
    if (showGradeField && !form.new_grade_id) {
      setMutationError("Choose the target grade for this movement.")
      return
    }
    if (showCostCenterField && !form.new_cost_center_id) {
      setMutationError("Choose the target cost center for this movement.")
      return
    }
    if (showEmploymentTypeField && !form.new_employment_type) {
      setMutationError("Choose the target employment type for this movement.")
      return
    }
    if (form.movement_type === "COMPOSITE" && selectedTargets.length === 0) {
      setMutationError("Choose at least one target change for a composite movement.")
      return
    }

    const payload: AdminRecord = {
      employee_id: employeeId,
      movement_type: form.movement_type,
      title: form.title.trim(),
      reason: form.reason.trim(),
      effective_date: form.effective_date,
    }

    if (form.new_branch_id) {
      payload.new_branch_id = Number(form.new_branch_id)
    }
    if (form.new_department_id) {
      payload.new_department_id = Number(form.new_department_id)
    }
    if (form.new_position_id) {
      payload.new_position_id = Number(form.new_position_id)
    }
    if (form.new_grade_id) {
      payload.new_grade_id = Number(form.new_grade_id)
    }
    if (form.new_cost_center_id) {
      payload.new_cost_center_id = Number(form.new_cost_center_id)
    }
    if (form.new_manager_employee_id) {
      payload.new_manager_employee_id = Number(form.new_manager_employee_id)
    }
    if (form.new_employment_type) {
      payload.new_employment_type = form.new_employment_type
    }

    setSubmitting(true)
    setMutationError(null)
    try {
      await createEmployeeMovement(token, payload)
      closeAddDialog()
      await onMutated()
    } catch (errorObject) {
      setMutationError(errorObject instanceof Error ? errorObject.message : "Failed to create movement.")
    } finally {
      setSubmitting(false)
    }
  }, [
    closeAddDialog,
    employeeId,
    form,
    onMutated,
    showBranchField,
    showCostCenterField,
    showDepartmentField,
    showEmploymentTypeField,
    showGradeField,
    showManagerField,
    showPositionField,
    token,
  ])

  const triggerMovementAction = React.useCallback(
    async (movement: AdminRecord, action: "submit" | "cancel") => {
      if (!token) {
        setMutationError("Authentication required. Please log in again.")
        return
      }

      const movementId = readNumber(movement.id)
      if (movementId === null) {
        setMutationError("Missing movement id; cannot continue.")
        return
      }

      setActioningId(movementId)
      setMutationError(null)
      try {
        if (action === "submit") {
          await submitEmployeeMovement(token, movementId)
        } else {
          await cancelEmployeeMovement(token, movementId)
        }
        await onMutated()
      } catch (errorObject) {
        setMutationError(errorObject instanceof Error ? errorObject.message : `Failed to ${action} movement.`)
      } finally {
        setActioningId(null)
      }
    },
    [onMutated, token]
  )

  const renderMovementField = (label: string, value: string, className?: string) => {
    if (!value || value === "-") {
      return null
    }
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("break-words text-foreground", className)}>{value}</p>
      </div>
    )
  }

  return (
    <>
      <div
        id={`employee-profile-section-${routeKey}`}
        ref={sectionRef}
        tabIndex={-1}
        aria-label="Movements section"
        className={cn(
          "scroll-mt-24 px-3 py-3 outline-none transition-all duration-500 lg:px-4",
          isHighlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background bg-amber-50/80 shadow-sm"
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Movements</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {sortedItems.length}
            </span>
            {sortedItems.length === 0 ? (
              <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Not provided</span>
            ) : null}
            {isHighlighted ? (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                Needs attention
              </span>
            ) : null}
          </div>
          {employeeId !== null ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted"
              onClick={() => setAddingRecord(true)}
            >
              <PlusIcon className="size-4" /> Add
            </button>
          ) : null}
        </div>

        {mutationError ? <p className="mb-2 text-sm text-rose-600">{mutationError}</p> : null}

        {sortedItems.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No employee movements available.</p>
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item, index) => {
              const movementId = readNumber(item.id)
              const movementNo = readString(item, ["movementNo", "movement_no"])
              const movementType = readString(item, ["movementType", "movement_type"])
              const status = readString(item, ["status"])
              const effectiveDate = formatProfileDate(readString(item, ["effectiveDate", "effective_date"]))
              const createdAt = formatDateTime(readString(item, ["createdAt", "created_at"]))
              const applicationError = readString(item, ["applicationError", "application_error"])
              const changes = asRecordArray(item.changes)

              return (
                <div key={`movements-${movementId ?? index}`} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {readString(item, ["title"])}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {movementNo !== "-" ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {movementNo}
                          </span>
                        ) : null}
                        {movementType !== "-" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            {formatLabelValue(movementType)}
                          </span>
                        ) : null}
                        {status !== "-" ? (
                          <span className={cn("font-medium", statusTone(status))}>
                            {formatLabelValue(status)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`View movement ${index + 1}`}
                        className="p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setViewingRecord(item)}
                      >
                        <EyeIcon className="size-4" />
                      </button>
                      {status !== "-" && movementSupportsSubmit(status) ? (
                        <button
                          type="button"
                          disabled={actioningId === movementId}
                          className="rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                          onClick={() => {
                            void triggerMovementAction(item, "submit")
                          }}
                        >
                          {actioningId === movementId ? "Submitting..." : "Submit"}
                        </button>
                      ) : null}
                      {status !== "-" && movementSupportsCancel(status) ? (
                        <button
                          type="button"
                          disabled={actioningId === movementId}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          onClick={() => {
                            void triggerMovementAction(item, "cancel")
                          }}
                        >
                          {actioningId === movementId ? "Working..." : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                    {renderMovementField("Effective Date", effectiveDate)}
                    {renderMovementField("Created", createdAt)}
                    {renderMovementField("Reason", readString(item, ["reason"]))}
                    {renderMovementField(
                      "Application Error",
                      applicationError,
                      "text-rose-600 dark:text-rose-400"
                    )}
                  </div>
                  {changes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {changes.map((change, changeIndex) => (
                        <span
                          key={`movement-change-${movementId ?? index}-${changeIndex}`}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {formatLabelValue(readString(change, ["field"]))}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog
        open={addingRecord}
        onOpenChange={(open) => {
          if (!open) {
            closeAddDialog()
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Add Employee Movement</AlertDialogTitle>
            <AlertDialogDescription>
              Create a movement draft for this employee, then submit it from the movements list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Movement Type
              </span>
              <FluentSelect
                ariaLabel="Movement Type"
                className="w-full"
                value={form.movement_type}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    movement_type: value,
                    new_branch_id: "",
                    new_department_id: "",
                    new_position_id: "",
                    new_grade_id: "",
                    new_cost_center_id: "",
                    new_manager_employee_id: "",
                    new_employment_type: "",
                  }))
                }
                disabled={optionsLoading}
                options={EMPLOYEE_MOVEMENT_TYPE_OPTIONS.map((option) => ({
                  value: option,
                  label: formatLabelValue(option),
                }))}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Effective Date
              </span>
              <DatePickerPresets
                value={form.effective_date}
                onChange={(value) => setForm((current) => ({ ...current, effective_date: value }))}
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
              </span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Movement title"
              />
            </label>

            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </span>
              <Textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Why this movement is needed"
              />
            </label>

            {showBranchField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Branch
                </span>
                <FluentSelect
                  ariaLabel="Target Branch"
                  className="w-full"
                  value={form.new_branch_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      new_branch_id: value,
                      new_department_id: "",
                      new_position_id: "",
                      new_cost_center_id: "",
                      new_manager_employee_id: "",
                    }))
                  }
                  disabled={optionsLoading}
                  placeholder={optionsLoading ? "Loading branches..." : "Select branch"}
                  options={[
                    { value: "", label: optionsLoading ? "Loading branches..." : "Select branch" },
                    ...branchOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showDepartmentField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Department
                </span>
                <FluentSelect
                  ariaLabel="Target Department"
                  className="w-full"
                  value={form.new_department_id}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      new_department_id: value,
                      new_position_id: "",
                      new_cost_center_id: "",
                      new_manager_employee_id: "",
                    }))
                  }
                  disabled={optionsLoading}
                  placeholder={optionsLoading ? "Loading departments..." : "Select department"}
                  options={[
                    {
                      value: "",
                      label: optionsLoading ? "Loading departments..." : "Select department",
                    },
                    ...filteredDepartmentOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showPositionField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Position
                </span>
                <FluentSelect
                  ariaLabel="Target Position"
                  className="w-full"
                  value={form.new_position_id}
                  onChange={(value) => setForm((current) => ({ ...current, new_position_id: value }))}
                  disabled={optionsLoading || (Boolean(form.new_department_id) && scopedPositionOptionsLoading)}
                  placeholder={
                    optionsLoading || (form.new_department_id && scopedPositionOptionsLoading)
                      ? "Loading positions..."
                      : form.new_department_id && availablePositionOptions.length > 0
                        ? "Select department position"
                        : "Select position"
                  }
                  options={[
                    {
                      value: "",
                      label:
                        optionsLoading || (form.new_department_id && scopedPositionOptionsLoading)
                          ? "Loading positions..."
                          : form.new_department_id && availablePositionOptions.length > 0
                            ? "Select department position"
                            : "Select position",
                    },
                    ...availablePositionOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showManagerField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Manager
                </span>
                <FluentSelect
                  ariaLabel="Target Manager"
                  className="w-full"
                  value={form.new_manager_employee_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, new_manager_employee_id: value }))
                  }
                  disabled={optionsLoading || (Boolean(form.new_department_id) && scopedManagerOptionsLoading)}
                  placeholder={
                    optionsLoading || (form.new_department_id && scopedManagerOptionsLoading)
                      ? "Loading managers..."
                      : form.new_department_id && availableManagerOptions.length > 0
                        ? "Select department manager"
                        : "Select manager"
                  }
                  options={[
                    {
                      value: "",
                      label:
                        optionsLoading || (form.new_department_id && scopedManagerOptionsLoading)
                          ? "Loading managers..."
                          : form.new_department_id && availableManagerOptions.length > 0
                            ? "Select department manager"
                            : "Select manager",
                    },
                    ...availableManagerOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: employeeDisplayName(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showGradeField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Grade
                </span>
                <FluentSelect
                  ariaLabel="Target Grade"
                  className="w-full"
                  value={form.new_grade_id}
                  onChange={(value) => setForm((current) => ({ ...current, new_grade_id: value }))}
                  disabled={optionsLoading}
                  placeholder={optionsLoading ? "Loading grades..." : "Select grade"}
                  options={[
                    { value: "", label: optionsLoading ? "Loading grades..." : "Select grade" },
                    ...gradeOptions.flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showCostCenterField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Cost Center
                </span>
                <FluentSelect
                  ariaLabel="Target Cost Center"
                  className="w-full"
                  value={form.new_cost_center_id}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, new_cost_center_id: value }))
                  }
                  disabled={optionsLoading}
                  placeholder={
                    optionsLoading
                      ? "Loading cost centers..."
                      : form.new_department_id && filteredCostCenterOptions.length > 0
                        ? "Select department cost center"
                        : "Select cost center"
                  }
                  options={[
                    {
                      value: "",
                      label: optionsLoading
                        ? "Loading cost centers..."
                        : form.new_department_id && filteredCostCenterOptions.length > 0
                          ? "Select department cost center"
                          : "Select cost center",
                    },
                    ...(form.new_department_id ? filteredCostCenterOptions : costCenterOptions).flatMap((option) => {
                      const optionId = readNumber(option.id)
                      if (optionId === null) {
                        return []
                      }
                      return [{ value: String(optionId), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
            ) : null}

            {showEmploymentTypeField ? (
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Target Employment Type
                </span>
                <FluentSelect
                  ariaLabel="Target Employment Type"
                  className="w-full"
                  value={form.new_employment_type}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, new_employment_type: value }))
                  }
                  placeholder="Select employment type"
                  options={[
                    { value: "", label: "Select employment type" },
                    ...EMPLOYMENT_TYPE_OPTIONS.map((option) => ({
                      value: option,
                      label: formatLabelValue(option),
                    })),
                  ]}
                />
              </label>
            ) : null}
          </div>
          {mutationError ? <p className="text-sm text-rose-600">{mutationError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={submitting || optionsLoading}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:opacity-50"
              onClick={() => {
                void submitCreate()
              }}
            >
              {submitting ? "Adding..." : "Add Draft"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(viewingRecord)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingRecord(null)
            setMovementOperations([])
            setDetailError(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Movement Details</AlertDialogTitle>
            <AlertDialogDescription>
              Review movement changes, lifecycle status, and downstream operations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {viewingRecord ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {renderMovementField("Movement No", readString(viewingRecord, ["movementNo", "movement_no"]))}
                {renderMovementField("Type", formatLabelValue(readString(viewingRecord, ["movementType", "movement_type"])))}
                {renderMovementField("Status", formatLabelValue(readString(viewingRecord, ["status"])), statusTone(readString(viewingRecord, ["status"])))}
                {renderMovementField("Effective Date", formatProfileDate(readString(viewingRecord, ["effectiveDate", "effective_date"])))}
                {renderMovementField("Created", formatDateTime(readString(viewingRecord, ["createdAt", "created_at"])))}
                {renderMovementField("Updated", formatDateTime(readString(viewingRecord, ["updatedAt", "updated_at"])))}
                {renderMovementField("Submitted", formatDateTime(readString(viewingRecord, ["submittedAt", "submitted_at"])))}
                {renderMovementField("Approved", formatDateTime(readString(viewingRecord, ["approvedAt", "approved_at"])))}
              </div>

              <div className="grid gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Title
                </p>
                <p className="text-sm text-foreground">{readString(viewingRecord, ["title"])}</p>
              </div>

              <div className="grid gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Reason
                </p>
                <p className="text-sm text-foreground">{readString(viewingRecord, ["reason"])}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Changes
                </p>
                {asRecordArray(viewingRecord.changes).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No change breakdown was returned for this movement.</p>
                ) : (
                  <div className="space-y-2">
                    {asRecordArray(viewingRecord.changes).map((change, index) => (
                      <div key={`movement-detail-change-${index}`} className="rounded-lg border border-border p-3">
                        <p className="text-sm font-semibold text-foreground">
                          {formatLabelValue(readString(change, ["field"]))}
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {renderMovementField("From", movementChangeValueSummary(change.oldValue))}
                          {renderMovementField("To", movementChangeValueSummary(change.newValue))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Operations
                </p>
                {operationsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading movement operations...</p>
                ) : detailError ? (
                  <p className="text-sm text-rose-600">{detailError}</p>
                ) : movementOperations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No downstream operations were returned.</p>
                ) : (
                  <div className="space-y-2">
                    {movementOperations.map((operation, index) => (
                      <div key={`movement-operation-${readNumber(operation.id) ?? index}`} className="rounded-lg border border-border p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {formatLabelValue(readString(operation, ["operationType", "operation_type"]))}
                          </span>
                          <span className={cn("text-xs font-medium", statusTone(readString(operation, ["status"])))}>{formatLabelValue(readString(operation, ["status"]))}</span>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {renderMovementField("Resource Key", readString(operation, ["resourceKey", "resource_key"]))}
                          {renderMovementField("Updated", formatDateTime(readString(operation, ["updatedAt", "updated_at"])))}
                          {renderMovementField("Error", readString(operation, ["errorMessage", "error_message"]), "text-rose-600 dark:text-rose-400")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function EmployeeProfilePage({
  employeeNo,
  requestedMissingItem,
}: {
  employeeNo: string
  requestedMissingItem?: string | null
}) {
  const router = useRouter()
  const motionPreset = useDashboardMotion()
  const [employee, setEmployee] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [identityDialogOpen, setIdentityDialogOpen] = React.useState(false)
  const [identitySubmitting, setIdentitySubmitting] = React.useState(false)
  const [identityError, setIdentityError] = React.useState<string | null>(null)
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [profilePassword, setProfilePassword] = React.useState("")
  const [showProfilePassword, setShowProfilePassword] = React.useState(false)
  const [branchId, setBranchId] = React.useState("")
  const [departmentId, setDepartmentId] = React.useState("")
  const [positionId, setPositionId] = React.useState("")
  const [managerId, setManagerId] = React.useState("")
  const [gradeId, setGradeId] = React.useState("")
  const [costCenterId, setCostCenterId] = React.useState("")
  const [assignmentEffectiveDate, setAssignmentEffectiveDate] = React.useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [assignmentReason, setAssignmentReason] = React.useState("")
  const [branchOptions, setBranchOptions] = React.useState<AdminRecord[]>([])
  const [departmentOptions, setDepartmentOptions] = React.useState<AdminRecord[]>([])
  const [positionOptions, setPositionOptions] = React.useState<AdminRecord[]>([])
  const [managerOptions, setManagerOptions] = React.useState<AdminRecord[]>([])
  const [gradeOptions, setGradeOptions] = React.useState<AdminRecord[]>([])
  const [costCenterOptions, setCostCenterOptions] = React.useState<AdminRecord[]>([])
  const [organizationOptionsLoading, setOrganizationOptionsLoading] = React.useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false)
  const [profileSearchOpen, setProfileSearchOpen] = React.useState(false)
  const [profileSearch, setProfileSearch] = React.useState("")
  const [profileSearchResults, setProfileSearchResults] = React.useState<AdminRecord[]>([])
  const [profileSearchLoading, setProfileSearchLoading] = React.useState(false)
  const [profileSearchError, setProfileSearchError] = React.useState<string | null>(null)
  const currentEmployeeStatus = employee
    ? normalizeEmployeeStatus(employee.employment_status ?? employee.status)
    : "active"
  const requestedSectionTitle = React.useMemo(
    () => routeKeyToSectionTitle(requestedMissingItem),
    [requestedMissingItem]
  )
  const requestedRouteKey = React.useMemo(
    () => (requestedSectionTitle ? sectionTitleToRouteKey(requestedSectionTitle) : null),
    [requestedSectionTitle]
  )
  const selectedBranchId = React.useMemo(() => {
    const parsed = Number(branchId)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [branchId])
  const filteredDepartmentOptions = React.useMemo(() => {
    if (selectedBranchId === null) {
      return departmentOptions
    }
    const matching = departmentOptions.filter((row) => relatedBranchId(row) === selectedBranchId)
    if (matching.length > 0) {
      return matching
    }
    return departmentOptions.filter((row) => relatedBranchId(row) === null)
  }, [departmentOptions, selectedBranchId])
  const selectedDepartmentName = React.useMemo(() => {
    const selected = filteredDepartmentOptions.find((row) => String(readNumber(row.id) ?? "") === departmentId)
    const label = selected ? recordOptionLabel(selected) : ""
    return label === "-" ? "" : label.trim().toLowerCase()
  }, [departmentId, filteredDepartmentOptions])
  const departmentPositionOptions = React.useMemo(() => {
    if (!departmentId) {
      return []
    }

    const selectedDepartmentId = Number(departmentId)
    if (!Number.isFinite(selectedDepartmentId) || selectedDepartmentId <= 0) {
      return []
    }

    const matching = fallbackDepartmentScopedPositionOptions(
      positionOptions,
      selectedDepartmentId,
      selectedBranchId
    )
    const currentEmployee = employee
    const selected = positionOptions.find((row) => String(readNumber(row.id) ?? "") === positionId)
      ?? (currentEmployee && positionId && readRelatedId(currentEmployee, ["primary_position", "primaryPosition", "position", "positionDetail"], ["primary_position_id", "primaryPositionId", "position_id", "positionId"]) === Number(positionId)
        ? (currentEmployee.primary_position ?? currentEmployee.primaryPosition ?? currentEmployee.position ?? currentEmployee.positionDetail) as AdminRecord
        : null)
    return selected && !matching.some((row) => readNumber(row.id) === readNumber(selected.id))
      ? [...matching, selected]
      : matching
  }, [departmentId, employee, positionId, positionOptions, selectedBranchId])
  const filteredCostCenterOptions = React.useMemo(() => {
    const selectedDepartmentId = departmentId ? Number(departmentId) : null
    return costCenterOptions.filter((row) => {
      const costCenterDepartmentId = readRelatedId(
        row,
        ["department", "departmentDetail", "primary_department", "primaryDepartment"],
        ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId"]
      )
      if (selectedDepartmentId === null) {
        return true
      }
      return costCenterDepartmentId === null || costCenterDepartmentId === selectedDepartmentId
    })
  }, [costCenterOptions, departmentId])
  const filteredManagerOptions = React.useMemo(
    () => {
      const eligible = managerOptions.filter((row) => readNumber(row.id) !== readNumber(employee?.id))
      return eligible.filter((row) => {
        if (!departmentId) return false
        return (
          relatedDepartmentIds(row).has(Number(departmentId)) ||
          (selectedDepartmentName !== "" && relatedDepartmentNames(row).has(selectedDepartmentName))
        )
      })
    },
    [departmentId, employee?.id, managerOptions, selectedDepartmentName]
  )

  React.useEffect(() => {
    if (!identityDialogOpen || !departmentId) {
      return
    }

      const hasSelectedDepartment = filteredDepartmentOptions.some(
      (row) => String(readNumber(row.id) ?? "") === departmentId
      ) || departmentOptions.some((row) => String(readNumber(row.id) ?? "") === departmentId)
    if (!hasSelectedDepartment) {
      const currentEmployee = employee
      const selectedDepartment = departmentOptions.find((row) => String(readNumber(row.id) ?? "") === departmentId)
        ?? (currentEmployee && readRelatedId(currentEmployee, ["primary_department", "primaryDepartment", "department", "departmentDetail"], ["primary_department_id", "primaryDepartmentId", "department_id", "departmentId"]) === Number(departmentId)
          ? (currentEmployee.primary_department ?? currentEmployee.primaryDepartment ?? currentEmployee.department ?? currentEmployee.departmentDetail) as AdminRecord
          : null)
      if (selectedDepartment) {
        setDepartmentOptions((current) => current.some((row) => readNumber(row.id) === readNumber(selectedDepartment.id))
          ? current
          : [...current, selectedDepartment])
      }
    }
  }, [departmentId, departmentOptions, employee, filteredDepartmentOptions, identityDialogOpen])

  React.useEffect(() => {
    if (!identityDialogOpen || !positionId) {
      return
    }

    const hasSelectedPosition = departmentPositionOptions.some(
      (row) => String(readNumber(row.id) ?? "") === positionId
    )
    if (!hasSelectedPosition) {
      setPositionId("")
    }
  }, [departmentPositionOptions, identityDialogOpen, positionId])

  React.useEffect(() => {
    if (!identityDialogOpen || !managerId) {
      return
    }

    const hasSelectedManager = filteredManagerOptions.some(
      (row) => String(readNumber(row.id) ?? "") === managerId
    )
    if (!hasSelectedManager) {
      setManagerId("")
    }
  }, [filteredManagerOptions, identityDialogOpen, managerId])

  React.useEffect(() => {
    if (!identityDialogOpen || !costCenterId) {
      return
    }

    const hasSelectedCostCenter = filteredCostCenterOptions.some(
      (row) => String(readNumber(row.id) ?? "") === costCenterId
    )
    if (!hasSelectedCostCenter) {
      setCostCenterId("")
    }
  }, [costCenterId, filteredCostCenterOptions, identityDialogOpen])

  const fetchEmployee = React.useCallback(async () => {
      const token = readStoredToken()
      if (!token) {
        setError("Authentication required. Please log in again.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const decodedNo = decodeURIComponent(employeeNo)
        const result = await listEmployees(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: decodedNo,
        })

        const matched = result.rows.find(
          (row) =>
            readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"]) === decodedNo
        )
        if (!matched) {
          setError("Employee not found.")
          setEmployee(null)
        } else {
          const employeeId = readNumber(matched.id)
          if (employeeId === null) {
            setEmployee(mergeEmployeeProfileRecord(matched))
          } else {
            const [detailedEmployee, assignmentResult, movementResult] = await Promise.all([
              getEmployeeById(employeeId, token).catch(() => null),
              listEmployeePositions(token, {
                employee_id: employeeId,
                page: 1,
                limit: 100,
              }).catch(() => null),
              listEmployeeMovements(token).catch(() => null),
            ])
            const mergedEmployee = mergeEmployeeProfileRecord(detailedEmployee ?? matched)
            const movementRows =
              movementResult?.filter((row) => movementBelongsToEmployee(row, employeeId)) ??
              firstRecordArray(mergedEmployee?.employee_movements, mergedEmployee?.employeeMovements)
            setEmployee(
              mergedEmployee
                ? {
                    ...mergedEmployee,
                    position_assignments: assignmentResult?.rows ?? firstRecordArray(mergedEmployee.position_assignments),
                    employee_movements: movementRows,
                    employeeMovements: movementRows,
                  }
                : mergedEmployee
            )
          }
        }
      } catch (errorObject) {
        setError(errorObject instanceof Error ? errorObject.message : "Failed to load employee profile.")
      } finally {
        setLoading(false)
      }
    }, [employeeNo])

  const loadOrganizationOptions = React.useCallback(async (selectedBranchId = "", selectedDepartmentId = "") => {
    void selectedBranchId
    const token = readStoredToken()
    if (!token) return
    setOrganizationOptionsLoading(true)
    setIdentityError(null)
    try {
      const selectedDepartmentNumber = Number(selectedDepartmentId)
      const hasSelectedDepartment = Number.isFinite(selectedDepartmentNumber) && selectedDepartmentNumber > 0
      const [branches, departments, positions, managers, grades, costCenters] = await Promise.allSettled([
        listBranches(token, { page: 1, limit: 100 }),
        listDepartments(token, { page: 1, limit: 100 }),
        hasSelectedDepartment
          ? listDepartmentPositions(token, selectedDepartmentId).then((rows) =>
              normalizeDepartmentScopedPositionOptions(rows, selectedDepartmentNumber)
            )
          : Promise.resolve<AdminRecord[]>([]),
        hasSelectedDepartment
          ? listEmployees(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
              department_id: selectedDepartmentNumber,
            }).then((result) => result.rows)
          : Promise.resolve<AdminRecord[]>([]),
        listEmployeeGrades(token),
        listCostCenters(token),
      ])
      const failedOptions: string[] = []
      if (branches.status === "fulfilled") {
        setBranchOptions(branches.value.rows)
      } else {
        failedOptions.push("branches")
      }
      if (departments.status === "fulfilled") {
        setDepartmentOptions(departments.value.rows)
      } else {
        failedOptions.push("departments")
      }
      if (positions.status === "fulfilled") {
        setPositionOptions(positions.value)
      } else {
        setPositionOptions([])
        if (hasSelectedDepartment) {
          failedOptions.push("positions")
        }
      }
      if (managers.status === "fulfilled") {
        setManagerOptions(managers.value)
      } else {
        setManagerOptions([])
      }
      if (grades.status === "fulfilled") {
        setGradeOptions(grades.value)
      } else {
        failedOptions.push("grades")
      }
      if (costCenters.status === "fulfilled") {
        setCostCenterOptions(costCenters.value)
      } else {
        failedOptions.push("cost centers")
      }
      if (failedOptions.length > 0) {
        setIdentityError(`Some organization options could not be loaded: ${failedOptions.join(", ")}.`)
      }
    } catch (errorObject) {
      setIdentityError(errorObject instanceof Error ? errorObject.message : "Failed to load organization options.")
    } finally {
      setOrganizationOptionsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchEmployee()
  }, [fetchEmployee])

  React.useEffect(() => {
    if (!profileSearchOpen) {
      setProfileSearch("")
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      setProfileSearchError(null)
      return
    }

    const trimmedSearch = profileSearch.trim()
    if (trimmedSearch.length < 2) {
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      setProfileSearchError(null)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setProfileSearchError("Authentication required. Please log in again.")
      setProfileSearchResults([])
      setProfileSearchLoading(false)
      return
    }

    let cancelled = false
    setProfileSearchLoading(true)
    setProfileSearchError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const result = await listEmployees(token, {
          page: 1,
          limit: 8,
          sortBy: "created_at",
          sortOrder: "DESC",
          search: trimmedSearch,
        })
        if (cancelled) {
          return
        }
        let rows = result.rows
        const looksLikeEmailOrPhone =
          trimmedSearch.includes("@") || trimmedSearch.replace(/\D+/g, "").length >= 6
        if (rows.length === 0 && looksLikeEmailOrPhone) {
          const directoryRows = await listAllEmployees(token, {}, { pageSize: 100, maxPages: 20 })
          if (cancelled) {
            return
          }
          rows = filterEmployeesByDirectorySearch(directoryRows, trimmedSearch)
        }
        setProfileSearchResults(rows.slice(0, 8))
      } catch (errorObject) {
        if (cancelled) {
          return
        }
        setProfileSearchResults([])
        setProfileSearchError(errorObject instanceof Error ? errorObject.message : "Failed to search employees.")
      } finally {
        if (!cancelled) {
          setProfileSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [profileSearch, profileSearchOpen])

  function openEmployeeProfile(row: AdminRecord) {
    const nextEmployeeNo = readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"])
    if (nextEmployeeNo === "-") {
      return
    }
    setProfileSearchOpen(false)
    router.push(`/dashboard/employees/profile/${encodeURIComponent(nextEmployeeNo)}`)
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">Loading employee profile...</div>
  }

  if (error || !employee) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 dark:border-slate-700 dark:bg-slate-900/60">
        <p className="text-sm text-rose-600">{error ?? "Employee not found."}</p>
        <button
          type="button"
          className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
          onClick={() => router.push("/dashboard/employees/all")}
        >
          Back to All Employees
        </button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 pb-4", pageBleedClass)}>
      <div className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-primary">{employeeDisplayNameFromLinkedUser(employee)}</h2>
            <Popover open={profileSearchOpen} onOpenChange={setProfileSearchOpen}>
              <PopoverTrigger
                type="button"
                aria-label="Search employee profiles"
                title="Search employee profiles"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                <SearchIcon className="size-4" />
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[340px] p-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Find Another Employee</p>
                    <p className="text-xs text-muted-foreground">Search by name, employee number, email, or phone.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                    <SearchIcon className="size-4 shrink-0 text-slate-400" />
                    <input
                      type="text"
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Search employee profile"
                      className="h-10 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {profileSearchError ? <p className="text-xs text-rose-600">{profileSearchError}</p> : null}
                  {profileSearchLoading ? <p className="text-xs text-muted-foreground">Searching employees...</p> : null}
                  {!profileSearchLoading && !profileSearchError && profileSearch.trim().length > 0 && profileSearch.trim().length < 2 ? (
                    <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
                  ) : null}
                  {!profileSearchLoading && !profileSearchError && profileSearch.trim().length >= 2 && profileSearchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No employees matched your search.</p>
                  ) : null}
                  {profileSearchResults.length > 0 ? (
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {profileSearchResults.map((row, index) => {
                        const nextEmployeeNo = readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "employeeNumber"])
                        return (
                          <button
                            key={`${nextEmployeeNo}-${index}`}
                            type="button"
                            className="flex w-full items-start justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => openEmployeeProfile(row)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">{employeeDisplayNameFromLinkedUser(row)}</span>
                              <span className="block truncate text-xs text-muted-foreground">{readString(row, ["email", "work_email", "personal_email"])}</span>
                            </span>
                            <span className="shrink-0 pl-3 text-xs text-muted-foreground">{nextEmployeeNo}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <FluentButton
              appearance="primary"
              onClick={() => {
                const companyUser = resolveCompanyUserRecord(employee)
                const currentBranchId = String(
                  readRelatedId(
                    employee,
                    ["primary_branch", "primaryBranch", "branch", "branchDetail"],
                    ["primary_branch_id", "primaryBranchId", "branch_id", "branchId"]
                  ) ?? ""
                )
                const currentDepartmentId = String(
                  readRelatedId(
                    employee,
                    ["primary_department", "primaryDepartment", "department", "departmentDetail"],
                    ["primary_department_id", "primaryDepartmentId", "department_id", "departmentId"]
                  ) ?? ""
                )
                setFirstName(readString(companyUser ?? employee, ["first_name", "firstName"]) === "-" ? "" : readString(companyUser ?? employee, ["first_name", "firstName"]))
                setLastName(readString(companyUser ?? employee, ["last_name", "lastName"]) === "-" ? "" : readString(companyUser ?? employee, ["last_name", "lastName"]))
                setUsername(readString(companyUser ?? {}, ["username", "user_no"]) === "-" ? "" : readString(companyUser ?? {}, ["username", "user_no"]))
                setEmail(readString(companyUser ?? {}, ["email"]) === "-" ? "" : readString(companyUser ?? {}, ["email"]))
                setProfilePassword("")
                setShowProfilePassword(false)
                setBranchId(currentBranchId)
                setDepartmentId(currentDepartmentId)
                setPositionId(
                  String(
                    readRelatedId(
                      employee,
                      ["primary_position", "primaryPosition", "position", "positionDetail"],
                      ["primary_position_id", "primaryPositionId", "position_id", "positionId"]
                    ) ?? ""
                  )
                )
                setManagerId(
                  String(
                    readRelatedId(
                      employee,
                      ["manager", "managerDetail", "reportsTo"],
                      ["reports_to", "reportsToId", "manager_id", "managerId"]
                    ) ?? ""
                  )
                )
                setGradeId(
                  String(
                    readRelatedId(
                      employee,
                      ["grade", "gradeDetail"],
                      ["grade_id", "gradeId"]
                    ) ?? ""
                  )
                )
                setCostCenterId(
                  String(
                    readRelatedId(
                      employee,
                      ["cost_center", "costCenter", "cost_center_detail", "costCenterDetail"],
                      ["cost_center_id", "costCenterId"]
                    ) ?? ""
                  )
                )
                setAssignmentEffectiveDate(new Date().toISOString().slice(0, 10))
                setAssignmentReason("")
                setIdentityError(null)
                setIdentityDialogOpen(true)
                void loadOrganizationOptions(currentBranchId, currentDepartmentId)
              }}
            >
              Update Profile
            </FluentButton>
            <FluentButton
              appearance="secondary"
              onClick={() => setStatusDialogOpen(true)}
            >
              Update Status
            </FluentButton>
          </div>
        </div>
      </div>

      {(() => {
          const employeeNo = readString(employee, [
            "employee_no",
            "employeeNo",
            "user_no",
            "employee_number",
            "employeeNumber",
          ])
          const statusRaw = readString(employee, [
            "employment_status",
            "employmentStatus",
            "status",
          ])
          const employmentType = formatLabelValue(
            readString(employee, ["employment_type", "employmentType"])
          )
          const branch =
            readString(employee, ["branch_name", "branchName"]) !== "-"
              ? readString(employee, ["branch_name", "branchName"])
              : readNestedString(employee.primary_branch ?? employee.branch, [
                  "name",
                  "branch_name",
                  "branchName",
                ])
          const department =
            readString(employee, ["department_name", "departmentName"]) !== "-"
              ? readString(employee, ["department_name", "departmentName"])
              : readNestedString(employee.primary_department ?? employee.department, [
                  "name",
                  "department_name",
                  "departmentName",
                ])
          const position =
            readString(employee, ["position_name", "positionName"]) !== "-"
              ? readString(employee, ["position_name", "positionName"])
              : readNestedString(employee.primary_position ?? employee.position, [
                  "name",
                  "position_name",
                  "positionName",
                ])
          const manager =
            readString(employee, ["manager_name", "managerName"]) !== "-"
              ? readString(employee, ["manager_name", "managerName"])
              : employeeDisplayName(asRecord(employee.manager) ?? {})

          return (
            <ProfileSectionsTabs
              employee={employee}
              employeeId={readNumber(employee.id)}
              onMutated={fetchEmployee}
              requestedRouteKey={requestedRouteKey}
              header={
                <motion.dl
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                  variants={motionPreset.metrics}
                  initial="hidden"
                  animate="show"
                >
                  <SummaryField label="Employee No" value={employeeNo} index={0} reduce={motionPreset.reduce} />
                  <SummaryField label="Status" index={1} reduce={motionPreset.reduce}>
                    <span className={cn("text-sm font-semibold", statusTone(statusRaw))}>
                      {formatLabelValue(statusRaw)}
                    </span>
                  </SummaryField>
                  <SummaryField
                    label="Employment Type"
                    value={employmentType}
                    index={2}
                    reduce={motionPreset.reduce}
                  />
                  <SummaryField
                    label="Hire Date"
                    value={formatProfileDate(employee.hire_date ?? employee.hireDate)}
                    index={3}
                    reduce={motionPreset.reduce}
                  />
                  <SummaryField label="Branch" value={branch} index={4} reduce={motionPreset.reduce} />
                  <SummaryField label="Department" value={department} index={5} reduce={motionPreset.reduce} />
                  <SummaryField label="Position" value={position} index={6} reduce={motionPreset.reduce} />
                  <SummaryField label="Manager" value={manager} index={7} reduce={motionPreset.reduce} />
                  <SummaryField
                    label="Last Updated"
                    value={formatDateTime(employee.updated_at ?? employee.updatedAt)}
                    index={8}
                    reduce={motionPreset.reduce}
                  />
                  <SummaryField
                    label="Employee Id"
                    value={String(employee.id ?? "-")}
                    index={9}
                    reduce={motionPreset.reduce}
                  />
                </motion.dl>
              }
            />
          )
        })()}

      <EmployeeStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        token={readStoredToken()}
        employeeId={readNumber(employee.id) ?? 0}
        employeeName={employeeDisplayNameFromLinkedUser(employee)}
        currentStatus={currentEmployeeStatus}
        currentNotes={readString(employee, ["notes"]) === "-" ? "" : readString(employee, ["notes"])}
        onSaved={async () => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(EMPLOYEE_STATUS_REFRESH_KEY, String(Date.now()))
            window.dispatchEvent(new CustomEvent(EMPLOYEE_STATUS_REFRESH_EVENT))
          }
          await fetchEmployee()
        }}
      />

      <Sheet open={identityDialogOpen} onOpenChange={setIdentityDialogOpen}>
        <SheetContent
          side="right"
          className="flex h-dvh min-h-0 w-full min-w-0 max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 p-0 data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-dvh data-[side=right]:w-full data-[side=right]:max-w-full data-[side=right]:border-l data-[side=right]:sm:max-w-2xl"
        >
          <SheetHeader className="shrink-0 gap-1 border-b border-border px-4 py-4 pr-14 sm:pl-6 sm:pr-14">
            <SheetTitle>Update Profile</SheetTitle>
            <SheetDescription>
              Update account details and keep branch, department, position, manager, grade, and cost center in sync.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <FluentField label="First name" className="min-w-0">
              <FluentInput
                value={firstName}
                onChange={(_event, data) => setFirstName(data.value)}
                className="!w-full"
                placeholder="Enter first name"
              />
            </FluentField>
            <FluentField label="Last name" className="min-w-0">
              <FluentInput
                value={lastName}
                onChange={(_event, data) => setLastName(data.value)}
                className="!w-full"
                placeholder="Enter last name"
              />
            </FluentField>
            <FluentField label="Username" className="min-w-0">
              <FluentInput
                value={username}
                onChange={(_event, data) => setUsername(data.value)}
                className="!w-full"
                placeholder="Enter username"
              />
            </FluentField>
            <FluentField label="Email" className="min-w-0">
              <FluentInput
                type="email"
                value={email}
                onChange={(_event, data) => setEmail(data.value)}
                className="!w-full"
                placeholder="Enter email"
              />
            </FluentField>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 [&>*]:min-w-0">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</span>
                <FluentSelect
                  ariaLabel="Branch"
                  className="w-full min-w-0"
                  value={branchId}
                  disabled={organizationOptionsLoading}
                  placeholder="No branch"
                  onChange={(value) => {
                    const nextBranchId = value
                    setBranchId(nextBranchId)
                    setDepartmentId("")
                    setPositionId("")
                    setManagerId("")
                    setCostCenterId("")
                    void loadOrganizationOptions(nextBranchId, "")
                  }}
                  options={[
                    { value: "", label: "No branch" },
                    ...branchOptions.flatMap((option) => {
                      const id = readNumber(option.id)
                      return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Department</span>
                <FluentSelect
                  ariaLabel="Department"
                  className="w-full min-w-0"
                  value={departmentId}
                  disabled={organizationOptionsLoading}
                  placeholder="Select department"
                  onChange={(value) => {
                    const nextDepartmentId = value
                    setDepartmentId(nextDepartmentId)
                    setPositionId("")
                    setManagerId("")
                    setCostCenterId("")
                    void loadOrganizationOptions(branchId, nextDepartmentId)
                  }}
                  options={[
                    { value: "", label: "Select department" },
                    ...filteredDepartmentOptions.flatMap((option) => {
                      const id = readNumber(option.id)
                      return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Position</span>
                <FluentSelect
                  ariaLabel="Position"
                  className="w-full min-w-0"
                  value={positionId}
                  disabled={!departmentId || organizationOptionsLoading}
                  placeholder={
                    departmentPositionOptions.length === 0
                      ? "No positions configured for this department"
                      : "Select position"
                  }
                  onChange={(value) => setPositionId(value)}
                  options={[
                    {
                      value: "",
                      label:
                        departmentPositionOptions.length === 0
                          ? "No positions configured for this department"
                          : "Select position",
                    },
                    ...departmentPositionOptions.flatMap((option) => {
                      const id = readNumber(option.id)
                      return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                    }),
                  ]}
                />
                {departmentPositionOptions.length === 0 ? (
                  <span className="text-[11px] font-normal normal-case tracking-normal text-destructive">
                    Create positions for this exact department in {" "}
                    <Link href="/dashboard/positions" className="font-medium text-primary hover:underline">
                      Positions
                    </Link>
                    .
                  </span>
                ) : null}
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manager</span>
              <FluentSelect
                ariaLabel="Manager"
                className="w-full min-w-0"
                value={managerId}
                disabled={!departmentId || organizationOptionsLoading}
                placeholder="No manager"
                onChange={(value) => setManagerId(value)}
                options={[
                  { value: "", label: "No manager" },
                  ...filteredManagerOptions.flatMap((option) => {
                    const id = readNumber(option.id)
                    return id === null
                      ? []
                      : [{ value: String(id), label: employeeDisplayNameFromLinkedUser(option) }]
                  }),
                ]}
              />
              <span className="text-[11px] font-normal normal-case tracking-normal text-muted-foreground">
                Shows all other employees in the selected department.
              </span>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Grade</span>
              <FluentSelect
                ariaLabel="Grade"
                className="w-full min-w-0"
                value={gradeId}
                disabled={organizationOptionsLoading}
                placeholder="No grade"
                onChange={(value) => setGradeId(value)}
                options={[
                  { value: "", label: "No grade" },
                  ...gradeOptions.flatMap((option) => {
                    const id = readNumber(option.id)
                    return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cost Center</span>
              <FluentSelect
                ariaLabel="Cost Center"
                className="w-full min-w-0"
                value={costCenterId}
                disabled={organizationOptionsLoading}
                placeholder="No cost center"
                onChange={(value) => setCostCenterId(value)}
                options={[
                  { value: "", label: "No cost center" },
                  ...filteredCostCenterOptions.flatMap((option) => {
                    const id = readNumber(option.id)
                    return id === null ? [] : [{ value: String(id), label: recordOptionLabel(option) }]
                  }),
                ]}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assignment Effective Date
              </span>
              <DatePickerPresets
                value={assignmentEffectiveDate}
                onChange={setAssignmentEffectiveDate}
              />
            </label>
            <FluentField label="New password (optional)" className="min-w-0">
              <div className="relative">
                <FluentInput
                  type={showProfilePassword ? "text" : "password"}
                  value={profilePassword}
                  onChange={(_event, data) => setProfilePassword(data.value)}
                  minLength={6}
                  className="password-reveal-managed !w-full pr-10"
                  placeholder="Leave blank to keep current password"
                />
                <FluentButton
                  type="button"
                  appearance="subtle"
                  aria-label={showProfilePassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setShowProfilePassword((prev) => !prev)}
                >
                  {showProfilePassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </FluentButton>
              </div>
            </FluentField>
            <FluentField label="Assignment reason (optional)" className="min-w-0 sm:col-span-2">
              <FluentTextarea
                value={assignmentReason}
                onChange={(_event, data) => setAssignmentReason(data.value)}
                className="!w-full"
              />
            </FluentField>
            </div>
            {identityError ? <p role="alert" className="mt-3 text-sm text-rose-600">{identityError}</p> : null}
          </div>
          <SheetFooter className="mt-0 w-full shrink-0 flex-row justify-end gap-2 border-t border-border bg-background px-4 py-3 sm:px-6">
            <FluentButton
              type="button"
              disabled={identitySubmitting}
              appearance="secondary"
              onClick={() => setIdentityDialogOpen(false)}
            >
              Cancel
            </FluentButton>
            <FluentButton
              type="button"
              disabled={identitySubmitting}
              appearance="primary"
              onClick={async () => {
                const token = readStoredToken()
                const userId = resolveCompanyUserId(employee)
                const employeeId = readNumber(employee.id)
                const trimmedFirstName = firstName.trim()
                const trimmedLastName = lastName.trim()
                const trimmedUsername = username.trim()
                const trimmedEmail = email.trim()
                const trimmedPassword = profilePassword.trim()

                if (!token) {
                  setIdentityError("Authentication required. Please log in again.")
                  return
                }
                if (employeeId === null) {
                  setIdentityError("Unable to identify this employee record.")
                  return
                }
                if (!trimmedFirstName) {
                  setIdentityError("First name is required.")
                  return
                }
                if (!trimmedLastName) {
                  setIdentityError("Last name is required.")
                  return
                }
                if (userId !== null && !trimmedUsername) {
                  setIdentityError("Username is required.")
                  return
                }
                if (userId !== null && !trimmedEmail) {
                  setIdentityError("Email is required.")
                  return
                }
                if (userId !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
                  setIdentityError("Please enter a valid email address.")
                  return
                }
                if (trimmedPassword && trimmedPassword.length < 6) {
                  setIdentityError("Password must be at least 6 characters.")
                  return
                }
                if ((departmentId || positionId || branchId || managerId || gradeId || costCenterId) && !assignmentEffectiveDate.trim()) {
                  setIdentityError("Assignment effective date is required.")
                  return
                }

                setIdentitySubmitting(true)
                setIdentityError(null)
                try {
                  const payload: AdminRecord = {
                    first_name: trimmedFirstName,
                    last_name: trimmedLastName,
                    user_no: trimmedUsername,
                    email: trimmedEmail,
                  }
                  if (trimmedPassword) {
                    payload.password = trimmedPassword
                  }
                  // Names/email sync between the user and its employee records
                  // server-side in one transaction, so a linked user is updated
                  // directly; unlinked employees are patched on their own.
                  if (userId !== null) {
                    await updateUserById(userId, token, payload)
                  } else {
                    await patchEmployeeById(employeeId, token, {
                      first_name: trimmedFirstName,
                      last_name: trimmedLastName,
                    })
                  }
                  if (departmentId || positionId || branchId || managerId || gradeId || costCenterId) {
                    await patchEmployeeAssignment(token, employeeId, {
                    effective_date: assignmentEffectiveDate.trim(),
                    branch_id: branchId ? Number(branchId) : null,
                    departments: departmentId ? [
                      {
                        department_id: Number(departmentId),
                        is_primary: true,
                      },
                    ] : [],
                    primary_position_id: positionId ? Number(positionId) : null,
                    reports_to: managerId ? Number(managerId) : null,
                    grade_id: gradeId ? Number(gradeId) : null,
                    cost_center_id: costCenterId ? Number(costCenterId) : null,
                    reason: assignmentReason.trim() || undefined,
                    })
                  }
                  setIdentityDialogOpen(false)
                  await fetchEmployee()
                } catch (errorObject) {
                  setIdentityError(errorObject instanceof Error ? errorObject.message : "Failed to update user details.")
                } finally {
                  setIdentitySubmitting(false)
                }
              }}
            >
              {identitySubmitting ? "Updating..." : "Update Profile"}
            </FluentButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
