"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"
import { getCountryCallingCode } from "libphonenumber-js"
import { countries as countryCodes } from "country-flag-icons"
import { CountryFlag } from "@/components/country-flag"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Textarea } from "@/components/ui/textarea"
import {
  isEmployeeStatusValue,
  type AdminRecord,
  type EmployeeAssignmentPayload,
  type EmployeeStatusPayload,
  type EmployeeProfileSection,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { motion } from "framer-motion"

export const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
export const EMPLOYEE_STATUS_REFRESH_KEY = "hrms.employees.status.updatedAt"
export const EMPLOYEE_STATUS_REFRESH_EVENT = "hrms:employee-status-updated"

export function normalizeEmployeeStatus(value: unknown): EmployeeStatusPayload["employment_status"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return isEmployeeStatusValue(normalized) ? normalized : "active"
}

export function readStoredToken() {
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

export function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return "-"
}

export function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

export function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry) => typeof entry === "object" && entry !== null) as AdminRecord[]
}

export function firstRecordArray(...values: unknown[]) {
  for (const value of values) {
    const list = asRecordArray(value)
    if (list.length > 0) {
      return list
    }
  }
  return [] as AdminRecord[]
}

export function readNestedString(value: unknown, keys: string[]) {
  const record = asRecord(value)
  if (!record) {
    return "-"
  }
  return readString(record, keys)
}

export function mergeEmployeeProfileRecord(record: AdminRecord | null) {
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

export function formatProfileDate(value: unknown) {
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

export function getProfileSectionItems(employee: AdminRecord, keys: string[]) {
  const values = keys.map((key) => employee[key])
  return firstRecordArray(...values)
}

export function employeeDisplayName(row: AdminRecord) {
  const named = readString(row, ["full_name", "fullName", "employee_name", "employeeName", "name"])
  if (named !== "-") {
    return named
  }
  const first = readString(row, ["first_name", "firstName"])
  const middle = readString(row, ["middle_name", "middleName"])
  const last = readString(row, ["last_name", "lastName"])
  return [first, middle, last].filter((part) => part !== "-").join(" ").trim() || "-"
}

export function employeeDisplayNameFromLinkedUser(row: AdminRecord) {
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

export function formatDateTime(value: unknown) {
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

export function formatLabelValue(value: string) {
  if (!value || value === "-") return "-"
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function statusTone(status: string) {
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

export function assignmentTypeTone(assignmentType: string) {
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

export function SummaryField({
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

export function recordPreview(record: AdminRecord) {
  return [
    readString(record, ["name", "type", "contact_type", "bank_name", "institution", "employee_no", "code"]),
    readString(record, ["email", "phone_number", "phone", "account_number", "id_number"]),
  ]
    .filter((entry) => entry !== "-")
    .join(" • ") || "Record"
}

export function renderRecordFields(record: AdminRecord, sectionTitle: string) {
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

  // Employee-uploaded documents keep their optional expiry date in metadata.
  const documentExpiry = (record.metadata as { expiry_date?: unknown } | null | undefined)?.expiry_date
  if (sectionTitle.toLowerCase() === "documents" && typeof documentExpiry === "string" && documentExpiry) {
    fields.push({ label: "expiry date", value: normalizeValue("expiry_date", documentExpiry) })
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

export function readNumber(value: unknown): number | null {
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

export function readRelatedId(row: AdminRecord, recordKeys: string[], idKeys: string[]) {
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

export function isPrimaryEmployeePosition(row: AdminRecord) {
  const primary = row.is_primary ?? row.isPrimary
  if (primary === true || primary === 1 || primary === "1") return true
  if (typeof primary === "string" && primary.trim().toLowerCase() === "true") return true
  const assignmentType = readString(row, ["assignment_type", "assignmentType"])
  return assignmentType !== "-" && assignmentType.trim().toLowerCase() === "primary"
}

export function relatedDepartmentIds(row: AdminRecord) {
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

export function relatedDepartmentNames(row: AdminRecord) {
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

export function relatedBranchId(row: AdminRecord) {
  return readRelatedId(
    row,
    ["branch", "branchDetail", "primary_branch", "primaryBranch"],
    ["branch_id", "branchId", "primary_branch_id", "primaryBranchId"]
  )
}

export function normalizeDepartmentScopedPositionOptions(rows: AdminRecord[], departmentId: number) {
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

export function fallbackDepartmentScopedPositionOptions(
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

export function recordOptionLabel(row: AdminRecord) {
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

export function emptyPositionAssignmentForm(): PositionAssignmentFormState {
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

export function resolvePositionAssignmentPositionId(row: AdminRecord) {
  return readRelatedId(
    row,
    ["position", "positionDetail", "primary_position", "primaryPosition"],
    ["position_id", "positionId", "primary_position_id", "primaryPositionId"]
  )
}

export function positionAssignmentPreview(row: AdminRecord) {
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

export function readPositionAssignmentForm(row: AdminRecord): PositionAssignmentFormState {
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

export function emptyDepartmentAssignmentForm(): DepartmentAssignmentFormState {
  return {
    department_id: "",
    is_primary: "false",
    effective_date: new Date().toISOString().slice(0, 10),
    reason: "",
  }
}

export function resolveDepartmentAssignmentDepartmentId(row: AdminRecord) {
  return readRelatedId(
    row,
    ["department", "departmentDetail", "primary_department", "primaryDepartment"],
    ["department_id", "departmentId", "primary_department_id", "primaryDepartmentId"]
  )
}

export function isPrimaryDepartmentAssignment(row: AdminRecord) {
  const primary = row.is_primary ?? row.isPrimary
  if (primary === true || primary === 1 || primary === "1") return true
  if (typeof primary === "string" && primary.trim().toLowerCase() === "true") return true
  return false
}

export function departmentAssignmentPreview(row: AdminRecord) {
  const departmentRecord =
    asRecord(row.department) ??
    asRecord(row.departmentDetail) ??
    asRecord(row.primary_department) ??
    asRecord(row.primaryDepartment)
  const departmentName = departmentRecord ? recordOptionLabel(departmentRecord) : "-"
  const fallbackDepartment = readString(row, ["department_name", "departmentName", "name", "title"])
  return departmentName !== "-" ? departmentName : fallbackDepartment !== "-" ? fallbackDepartment : "Department assignment"
}

export function readDepartmentAssignmentForm(row: AdminRecord): DepartmentAssignmentFormState {
  const departmentId = resolveDepartmentAssignmentDepartmentId(row)
  return {
    department_id: departmentId === null ? "" : String(departmentId),
    is_primary: isPrimaryDepartmentAssignment(row) ? "true" : "false",
    effective_date: new Date().toISOString().slice(0, 10),
    reason: "",
  }
}

export type EmployeeMovementFormState = {
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

export const EMPLOYEE_MOVEMENT_TYPE_OPTIONS = [
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

export const EMPLOYMENT_TYPE_OPTIONS = [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
  "temporary",
]

export function emptyEmployeeMovementForm(): EmployeeMovementFormState {
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

export function resolveMovementEmployeeId(row: AdminRecord) {
  return readRelatedId(row, ["employee"], ["employeeId", "employee_id"])
}

export function movementBelongsToEmployee(row: AdminRecord, employeeId: number) {
  return resolveMovementEmployeeId(row) === employeeId
}

export function movementSupportsSubmit(status: string) {
  return ["draft", "returned_for_correction"].includes(status.trim().toLowerCase())
}

export function movementSupportsCancel(status: string) {
  return ["draft", "submitted", "pending_approval", "returned_for_correction"].includes(
    status.trim().toLowerCase()
  )
}

export function movementChangeValueSummary(value: unknown) {
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

export function buildEmployeeAssignmentPayload(
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

export function resolveCompanyUserId(employee: AdminRecord): number | null {
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

export function resolveCompanyUserRecord(employee: AdminRecord): AdminRecord | null {
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

export function sectionTitleToApiSection(title: string): EmployeeProfileSection | null {
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

export function sectionTitleToRouteKey(title: string) {
  return title.toLowerCase().replaceAll(" ", "_")
}

export function routeKeyToSectionTitle(routeKey: string | null | undefined) {
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
      contracts: "Contracts",
      leave: "Leave",
      academic_qualifications: "Academic Qualifications",
      professional_qualifications: "Professional Qualifications",
      experience_details: "Experience Details",
      company_user: "Company User",
    }[normalized] ?? null
  )
}

export type SectionEntry = { key: string; label: string; value: string; kind: "text" | "boolean" }

export type PositionAssignmentFormState = {
  position_id: string
  assignment_type: string
  status: string
  is_primary: string
  start_date: string
  end_date: string
  notes: string
}

export const POSITION_ASSIGNMENT_TYPE_OPTIONS = ["PRIMARY", "ACTING", "TEMPORARY", "SECONDARY"]
export const POSITION_ASSIGNMENT_STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "COMPLETED"]

export type DepartmentAssignmentFormState = {
  department_id: string
  is_primary: string
  effective_date: string
  reason: string
}

export const EDUCATION_LEVEL_OPTIONS = [
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

export const DOCUMENT_TYPE_OPTIONS = [
  "certificate",
  "cv",
  "offer_letter",
  "contract",
  "id",
  "other",
]

export const DOCUMENT_CLASSIFICATION_OPTIONS = [
  "PRIVATE",
  "CONFIDENTIAL",
  "RESTRICTED",
]

export const RELATIONSHIP_OPTIONS = [
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

export type CountryOption = { code: string; name: string }
export type CountryDialOption = { iso: string; code: string; name: string }

export const regionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null

export function safeCountryName(code: string) {
  try {
    return regionDisplayNames?.of(code) ?? code
  } catch {
    return code
  }
}

export const COUNTRY_OPTIONS: CountryOption[] = (countryCodes as string[])
  .map((code) => ({
    code,
    name: safeCountryName(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = (countryCodes as string[])
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

export function findCountryOption(value: string) {
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

export function CountrySelectInput({
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

export function formatFileSize(bytes: number) {
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

export function DocumentFileInput({
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

export function splitPhoneValue(value: string) {
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

export function PhoneWithCountryCodeInput({
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

export function renderEntryInput({
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

export function sectionSchema(sectionTitle: string): SectionEntry[] {
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

export function editableEntries(record: AdminRecord, sectionTitle: string) {
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
