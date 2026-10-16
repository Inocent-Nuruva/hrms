"use client"

import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import { DateTimeInput } from "@/components/ui/date-time-input"
import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { HorizontalScrollContainer } from "@/components/common/horizontal-scroll-container"
import {
  Button as FluentButton,
  Field,
  Table as FluentTable,
  TableBody as FluentTableBody,
  TableCell as FluentTableCell,
  TableCellLayout,
  TableHeader as FluentTableHeader,
  TableHeaderCell,
  TableRow as FluentTableRow,
} from "@fluentui/react-components"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import {
  Add16Regular,
  ClipboardTaskListLtr20Regular,
  Delete16Regular,
  Edit16Regular,
} from "@fluentui/react-icons"
import {
  Ban,
  CalendarDays,
  CheckCheck,
  CircleHelp,
  Copy,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"

import { cn } from "@/lib/utils"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import {
  approveOnboardingRequest,
  cancelOnboardingRequest,
  completeOnboardingRequest,
  completeOnboardingTask,
  cloneOnboardingWorkflow,
  createOnboardingRequest,
  createOnboardingTask,
  ensureDraftOnboardingRequest,
  createOnboardingWorkflow,
  createOnboardingWorkflowStep,
  delegateOnboardingApproval,
  deleteOnboardingDocument,
  deleteOnboardingRequest,
  deleteOnboardingWorkflow,
  deleteOnboardingWorkflowStep,
  downloadEmployeeDocument,
  downloadOnboardingDocument,
  fileToBase64UploadDto,
  getOnboardingAuditLogs,
  getOnboardingProgress,
  getCurrentCompanyUser,
  getOnboardingRequest,
  getOnboardingWorkflow,
  getUserById,
  listAccessControlResources,
  listAllCurrentCompanyUsers,
  listAttendanceDevices,
  listAllEmployees,
  listBranches,
  listDepartments,
  listEmployees,
  listEmployeeInvitationHistory,
  listMyOnboardingRequests,
  listOnboardingDocuments,
  listOnboardingRequests,
  listOnboardingTasks,
  listOnboardingWorkflowSteps,
  listOnboardingWorkflows,
  listResource,
  listShiftResources,
  listTimetableResources,
  patchOnboardingRequest,
  patchOnboardingWorkflow,
  patchOnboardingWorkflowStep,
  rejectOnboardingRequest,
  reviewOnboardingEmployeeDetails,
  resendEmployeeInvitation,
  submitOnboardingRequest,
  uploadOnboardingDocument,
  verifyOnboardingDocument,
  type AdminRecord,
  type EmployeeInvitationHistoryStatus,
  type OnboardingProvisioning,
} from "@/lib/admin-api"
import {
  INVITATION_STATUS_FILTERS,
  canResendInvitation,
  invitationEffectiveStatus,
} from "@/lib/employee-invitation-status"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { FluentSelect } from "@/components/ui/fluent-select"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { BadgeCheck } from "@/components/animate-ui/icons/badge-check"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  buildOnboardingProvisioningPayload,
  type OnboardingDeviceAssignmentDraft,
  type OnboardingProvisioningDraft,
  type OnboardingShiftAssignmentDraft,
  type OnboardingTimetableAssignmentDraft,
} from "@/lib/onboarding-provisioning"
import {
  filterAssigneesForStep,
  findAssigneeRecord,
  flattenAssigneeRecord,
  isOnboardingActableStatus,
  isOnboardingDraftStatus,
  preferredAssigneeId,
  personDisplayName,
  recordMatchesId,
  resolveApprovalOwnerLabel,
  resolveAuditActorLabel,
  resolveResponsiblePartyLabel,
  summarizeOnboardingApprovals,
} from "@/lib/onboarding-activity-labels"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"
import { matchesEmployeeDirectorySearch } from "@/lib/employee-directory-search"
import {
  onboardingAssigneeHasPermission,
  requiredPermissionForOnboardingStep,
} from "@/lib/onboarding-assignee-permissions"

type OnboardingTab = "invitations" | "requests" | "workflows"

const ONBOARDING_DOCUMENT_TYPES = [
  { value: "identity_document", label: "Identity document", section: "identification" },
  { value: "academic_certificate", label: "Academic certificate", section: "education" },
  { value: "professional_certificate", label: "Professional certificate", section: "education" },
  { value: "curriculum_vitae", label: "CV / résumé", section: "experience" },
  { value: "employment_contract", label: "Employment contract", section: "assignment" },
  { value: "offer_letter", label: "Offer letter", section: "assignment" },
  { value: "bank_document", label: "Bank document", section: "banking" },
  { value: "medical_document", label: "Medical document", section: "personal" },
  { value: "other", label: "Other", section: "personal" },
] as const
const TASK_DUE_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? "00" : "30"
  const value = `${String(hours).padStart(2, "0")}:${minutes}`
  return { value, label: new Date(2000, 0, 1, hours, Number(minutes)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }
})
type OnboardingLookupKey =
  | "employees"
  | "workflows"
  | "users"
  | "roles"
  | "branches"
  | "departments"
  | "shifts"
  | "rotationGroups"
  | "timetables"
  | "accessGroups"
  | "accessOrganizations"
  | "attendanceDevices"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
function readStoredToken() {
  if (typeof window === "undefined") {
    return ""
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (authTokensRaw) {
    try {
      const parsed = JSON.parse(authTokensRaw) as {
        accessToken?: string
        access_token?: string
      }
      const accessToken = (parsed.accessToken ?? parsed.access_token ?? "").trim()
      if (accessToken) {
        return accessToken
      }
    } catch {
      // Fall through to legacy key.
    }
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
}

function readString(row: AdminRecord, keys: string[], fallback = "-") {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return fallback
}

function readNumber(row: AdminRecord, keys: string[]) {
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

function toTitleCaseWords(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function toRecord(value: unknown): AdminRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as AdminRecord
}

function collectDepartmentIds(row: AdminRecord) {
  const ids = new Set<number>()
  const sources = [
    row,
    toRecord(row.company_user),
    toRecord(row.companyUser),
    toRecord(row.user),
    toRecord(row.employee),
    toRecord(row.profile),
  ].filter((source): source is AdminRecord => Boolean(source))

  sources.forEach((source) => {
    const directId = readNumber(source, [
      "department_id",
      "departmentId",
      "primary_department_id",
      "primaryDepartmentId",
    ])
    if (directId !== null) ids.add(directId)

    for (const key of ["department", "departmentDetail", "primary_department", "primaryDepartment"]) {
      const department = toRecord(source[key])
      const departmentId = department ? readNumber(department, ["id", "department_id"]) : null
      if (departmentId !== null) ids.add(departmentId)
    }

    const directIds = Array.isArray(source.department_ids)
      ? source.department_ids
      : Array.isArray(source.departmentIds)
        ? source.departmentIds
        : []
    directIds.forEach((value) => {
      const departmentId = readNumber({ value }, ["value"])
      if (departmentId !== null) ids.add(departmentId)
    })

    for (const collectionKey of [
      "departments",
      "department_assignments",
      "departmentAssignments",
      "employee_departments",
      "employeeDepartments",
    ]) {
      const collection = source[collectionKey]
      if (!Array.isArray(collection)) continue
      collection.forEach((value) => {
        const directDepartmentId = readNumber({ value }, ["value"])
        if (directDepartmentId !== null) {
          ids.add(directDepartmentId)
          return
        }
        const assignment = toRecord(value)
        const nestedDepartment = assignment
          ? (toRecord(assignment.department) ?? toRecord(assignment.departmentDetail))
          : null
        const departmentId = assignment
          ? readNumber(
              assignment,
              collectionKey === "departments" ? ["department_id", "departmentId", "id"] : ["department_id", "departmentId"],
            )
          : null
        const nestedDepartmentId = nestedDepartment ? readNumber(nestedDepartment, ["id", "department_id"]) : null
        if (departmentId !== null) ids.add(departmentId)
        if (nestedDepartmentId !== null) ids.add(nestedDepartmentId)
      })
    }
  })

  return ids
}

function employeeMatchesCompanyUser(employee: AdminRecord, companyUser: AdminRecord) {
  const employeeMembership = toRecord(employee.company_user) ?? toRecord(employee.companyUser)
  const employeeUser = toRecord(employeeMembership?.user) ?? toRecord(employee.user)
  const companyMembership = toRecord(companyUser.company_user) ?? toRecord(companyUser.companyUser)
  const companyAccount = toRecord(companyUser.user) ?? toRecord(companyMembership?.user)
  const ids = (record: AdminRecord | null, keys: string[]) =>
    record
      ? keys.map((key) => readNumber(record, [key])).filter((id): id is number => id !== null)
      : []

  const companyMembershipIds = [
    ...ids(companyUser, ["id", "company_user_id", "companyUserId"]),
    ...ids(companyMembership, ["id", "company_user_id", "companyUserId"]),
  ]
  const employeeMembershipIds = [
    ...ids(employee, ["company_user_id", "companyUserId"]),
    ...ids(employeeMembership, ["id", "company_user_id", "companyUserId"]),
  ]
  if (
    companyMembershipIds.length > 0 &&
    employeeMembershipIds.length > 0 &&
    companyMembershipIds.some((id) => employeeMembershipIds.includes(id))
  ) {
    return true
  }

  const companyAccountIds = [
    ...ids(companyUser, ["user_id", "userId"]),
    ...ids(companyAccount, ["id", "user_id", "userId"]),
    ...ids(companyMembership, ["user_id", "userId"]),
  ]
  const employeeAccountIds = [
    ...ids(employee, ["user_id", "userId"]),
    ...ids(employeeUser, ["id", "user_id", "userId"]),
    ...ids(employeeMembership, ["user_id", "userId"]),
  ]
  if (
    companyAccountIds.length > 0 &&
    employeeAccountIds.length > 0 &&
    companyAccountIds.some((id) => employeeAccountIds.includes(id))
  ) {
    return true
  }

  const companyEmail = readString(companyAccount ?? companyUser, ["email"], "").trim().toLowerCase()
  const employeeEmail = readString(employeeUser ?? employee, ["email"], "").trim().toLowerCase()
  return Boolean(companyEmail && employeeEmail && companyEmail === employeeEmail)
}

function formatInvitationDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function invitationDeliveryStatus(row: AdminRecord, channel: "email" | "sms") {
  const delivery = toRecord(row.delivery)
  const channelDelivery = toRecord(delivery?.[channel])
  return channelDelivery ? readString(channelDelivery, ["status"]) : "-"
}

function invitationDeliveryValue(row: AdminRecord, channel: "email" | "sms", keys: string[]) {
  const delivery = toRecord(row.delivery)
  const channelDelivery = toRecord(delivery?.[channel])
  return channelDelivery ? readString(channelDelivery, keys) : "-"
}

function formatInvitationDeliveryError(value: string) {
  if (!value || value === "-") return value
  const normalized = value.trim()
  const lower = normalized.toLowerCase()

  if (lower.includes("sendasdenied") || lower.includes("not allowed to send as")) {
    return "The SMTP account cannot use the configured sender address. Use the authenticated mailbox as the sender or grant Send As permission."
  }
  if (lower.includes("authentication unsuccessful") || lower.includes("invalid login")) {
    return "SMTP authentication failed. Check the username, password, and mailbox SMTP AUTH setting."
  }

  const withoutDiagnostics = normalized.split("[BeginDiagnosticData]", 1)[0]?.trim() || normalized
  return withoutDiagnostics.length > 320 ? `${withoutDiagnostics.slice(0, 317)}…` : withoutDiagnostics
}

function invitationDisplayName(row: AdminRecord | null) {
  if (!row) return "Invitation"
  const name = [row.first_name, row.last_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ")
  return name || readString(row, ["email"], "Invitation")
}

function getEmployeeDisplayName(row: AdminRecord) {
  const sources = [
    row,
    toRecord(row.company_user),
    toRecord(row.companyUser),
    toRecord(row.user),
    toRecord(row.person),
    toRecord(row.profile),
    toRecord(row.employee),
  ].filter((source): source is AdminRecord => Boolean(source))

  for (const source of sources) {
    const named = readString(source, [
      "full_name",
      "fullName",
      "employee_name",
      "employeeName",
      "display_name",
      "displayName",
      "preferred_name",
      "preferredName",
    ])
    if (named !== "-") {
      return named
    }

    const assembled = [
      readString(source, ["first_name", "firstName"]),
      readString(source, ["middle_name", "middleName"]),
      readString(source, ["last_name", "lastName"]),
    ]
      .filter((part) => part !== "-")
      .join(" ")
      .trim()
    if (assembled) {
      return assembled
    }
  }

  // Avoid treating generic "name" as a primary name first — some payloads put non-person values there.
  for (const source of sources) {
    const genericName = readString(source, ["name"])
    if (genericName !== "-") {
      const employeeNo = readString(row, ["employee_no", "employee_number", "user_no", "employeeNo"])
      if (employeeNo === "-" || genericName !== employeeNo) {
        return genericName
      }
    }
  }

  return ""
}

function formatEmployeeOptionLabel(row: AdminRecord, fallbackId?: number | null) {
  const name = getEmployeeDisplayName(row)
  const employeeNo = readString(row, ["employee_no", "employee_number", "user_no", "employeeNo", "employee_code"])
  const id = fallbackId ?? readNumber(row, ["id", "employee_id", "user_id"])

  if (name && employeeNo !== "-") {
    return `${name} (${employeeNo})`
  }
  if (name) {
    return name
  }
  if (employeeNo !== "-") {
    return employeeNo
  }
  if (id !== null) {
    return `Employee #${id}`
  }
  return "Unknown employee"
}

const ONBOARDING_ELIGIBLE_EMPLOYEE_STATUSES = new Set(["onboarding"])

function getEmployeeEmploymentStatus(row: AdminRecord) {
  const nested =
    toRecord(row.company_user) ?? toRecord(row.companyUser) ?? toRecord(row.user) ?? toRecord(row.profile) ?? null
  return String(
    row.employment_status ?? row.employmentStatus ?? nested?.employment_status ?? nested?.employmentStatus ?? ""
  )
    .trim()
    .toLowerCase()
}

function mergeOnboardingRequestRows(...groups: AdminRecord[][]) {
  const byKey = new Map<string, AdminRecord>()
  for (const row of groups.flat()) {
    const requestId = readNumber(row, ["id", "request_id", "onboarding_request_id"])
    const employeeId = readNumber(row, ["employee_id", "employeeId"])
    const key =
      requestId !== null
        ? `request:${requestId}`
        : employeeId !== null
          ? `employee:${employeeId}:${String(row.status ?? "")}`
          : JSON.stringify(row)
    if (!byKey.has(key)) {
      byKey.set(key, row)
    }
  }
  return Array.from(byKey.values())
}

const ONBOARDING_DRAFT_LIST_STATUSES = ["draft", "not_started", "pending", "new"] as const

async function listOnboardingRequestsIncludingDrafts(
  token: string,
  requestQuery: {
    page: number
    limit: number
    sortBy: "created_at"
    sortOrder: "DESC"
    search?: string
    employee_id?: number
  }
) {
  const [main, ...draftLists] = await Promise.all([
    listOnboardingRequests(token, requestQuery),
    ...ONBOARDING_DRAFT_LIST_STATUSES.map((status) =>
      listOnboardingRequests(token, { ...requestQuery, status }).catch(() => ({
        rows: [] as AdminRecord[],
      }))
    ),
  ])
  return mergeOnboardingRequestRows(main.rows, ...draftLists.map((result) => result.rows))
}

function isOnboardingEligibleEmployee(row: AdminRecord) {
  return ONBOARDING_ELIGIBLE_EMPLOYEE_STATUSES.has(getEmployeeEmploymentStatus(row))
}

function isPendingOnboardingRow(row: AdminRecord) {
  return row.pending_employee_onboarding === true
}

function collectRequestEmployeeIds(rows: AdminRecord[]) {
  const ids = new Set<number>()
  rows.forEach((row) => {
    if (isPendingOnboardingRow(row)) {
      const pendingId = readNumber(row, ["employee_id", "employeeId"])
      if (pendingId !== null) {
        ids.add(pendingId)
      }
      return
    }
    const nested = toRecord(row.employee) ?? toRecord(row.employee_profile)
    const id =
      readNumber(row, ["employee_id", "employeeId"]) ?? readNumber(nested ?? {}, ["id", "employee_id", "employeeId"])
    if (id !== null) {
      ids.add(id)
    }
  })
  return ids
}

function defaultOnboardingWorkflowId(workflows: AdminRecord[]) {
  const preferred = workflows.find((row) => row.is_default === true || row.isDefault === true) ?? workflows[0] ?? null
  return preferred ? readNumber(preferred, ["id", "workflow_id"]) : null
}

function buildPendingOnboardingRow(employee: AdminRecord): AdminRecord {
  const employeeId = readNumber(employee, ["id", "employee_id", "employeeId"])
  const name = getEmployeeDisplayName(employee) || formatEmployeeOptionLabel(employee, employeeId)
  return {
    pending_employee_onboarding: true,
    employee_id: employeeId,
    employee,
    title: name && name !== "Unknown employee" ? `Onboarding for ${name}` : "Onboarding",
    status: PENDING_ONBOARDING_STATUS,
  }
}

function mergeEmployeeRows(...groups: AdminRecord[][]) {
  const byId = new Map<number, AdminRecord>()
  groups.flat().forEach((row) => {
    const id = readNumber(row, ["id", "employee_id", "user_id"])
    if (id === null) {
      return
    }
    if (!byId.has(id)) {
      byId.set(id, row)
    }
  })
  return Array.from(byId.values())
}

function toRecordList(value: unknown): AdminRecord[] {
  if (Array.isArray(value)) {
    return value.map((entry) => toRecord(entry)).filter((entry): entry is AdminRecord => Boolean(entry))
  }
  const record = toRecord(value)
  return record ? [record] : []
}

function toTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

type RequestAction = "submit" | "approve" | "reject" | "cancel" | "complete" | "delete"

type OnboardingWorkflowStepDraft = {
  id?: number
  is_required: boolean
  name: string
  description: string
  checklist_items: WorkflowChecklistItem[]
  metadata?: AdminRecord
  step_type: string
  assigned_role_id?: number
  assigned_user_id?: number
  assigned_department_id?: number
  due_days: number
}

type WorkflowChecklistItem = {
  name: string
  description: string
}

function workflowStepChecklist(row: AdminRecord) {
  const metadata = toRecord(row.metadata)
  const value = metadata?.checklist_items ?? metadata?.checklistItems
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === "string") {
        const name = item.trim()
        return name ? { name, description: "" } : null
      }
      const record = toRecord(item)
      if (!record) return null
      const name = readString(record, ["name", "title"], "").trim()
      const description = readString(record, ["description", "instructions"], "").trim()
      return name ? { name, description } : null
    })
    .filter((item): item is WorkflowChecklistItem => item !== null)
}

function normalizeWorkflowStep(row: AdminRecord): OnboardingWorkflowStepDraft {
  const stepId = readNumber(row, ["id", "step_id", "workflow_step_id"])
  const name = readString(row, ["name", "step_name", "title", "task_title"])
  const description = readString(row, ["description", "step_description", "details"])
  const stepType = readString(row, ["step_type", "task_type", "type"])
  const assignedRoleId = readNumber(row, ["assigned_role_id", "role_id"])
  const assignedUserId = readNumber(row, ["assigned_user_id", "company_user_id", "user_id"])
  const assignedDepartmentId = readNumber(row, ["assigned_department_id", "department_id"])
  const dueDays = readNumber(row, ["due_days", "expected_duration_days", "dueDays"])

  return {
    ...(stepId !== null && stepId > 0 ? { id: stepId } : {}),
    is_required:
      row.is_required === true ||
      row.isRequired === true ||
      String(row.is_required ?? row.isRequired ?? "true").toLowerCase() === "true",
    name: name === "-" ? "" : name,
    description: description === "-" ? "" : description,
    checklist_items: workflowStepChecklist(row),
    ...(toRecord(row.metadata) ? { metadata: toRecord(row.metadata) ?? undefined } : {}),
    step_type: stepType === "-" ? "task" : stepType,
    due_days: dueDays !== null && dueDays > 0 ? dueDays : 1,
    ...(assignedRoleId !== null && assignedRoleId > 0 ? { assigned_role_id: assignedRoleId } : {}),
    ...(assignedUserId !== null && assignedUserId > 0 ? { assigned_user_id: assignedUserId } : {}),
    ...(assignedDepartmentId !== null && assignedDepartmentId > 0
      ? { assigned_department_id: assignedDepartmentId }
      : {}),
  }
}

async function loadAssigneeById(token: string, assignedId: number): Promise<AdminRecord | null> {
  const fromCompany = await getCurrentCompanyUser(token, assignedId).catch(() => null)
  if (fromCompany && preferredAssigneeId(fromCompany) !== null) {
    return fromCompany
  }
  return getUserById(assignedId, token).catch(() => null)
}

function extractWorkflowSteps(record: AdminRecord | null): AdminRecord[] {
  if (!record) {
    return []
  }

  const stepKeys = [
    "steps",
    "workflow_steps",
    "workflowSteps",
    "tasks",
    "activities",
    "onboarding_steps",
    "onboardingSteps",
    "items",
  ] as const

  for (const key of stepKeys) {
    const direct = toRecordList(record[key])
    if (direct.length > 0) {
      return direct
    }
  }

  for (const key of ["workflow", "data", "result", "item", "details", "record"]) {
    const nested = toRecord(record[key])
    if (!nested) continue
    for (const stepKey of stepKeys) {
      const nestedSteps = toRecordList(nested[stepKey])
      if (nestedSteps.length > 0) {
        return nestedSteps
      }
    }
  }

  return []
}

const ENVELOPE_STATUS_VALUES = new Set(["success", "ok", "error", "fail", "failed", "true", "false"])

function isWorkflowStatusValue(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === "-") return false
  if (ENVELOPE_STATUS_VALUES.has(normalized)) return false
  return ["active", "inactive", "draft", "archived", "enabled", "disabled"].includes(normalized)
}

function unwrapWorkflowDetail(payload: AdminRecord | null): AdminRecord | null {
  if (!payload) {
    return null
  }

  // Prefer a record that looks like the workflow entity itself (name / id), not an API envelope.
  const scoreWorkflowShape = (row: AdminRecord) => {
    let score = 0
    if (readNumber(row, ["id", "workflow_id"]) !== null) score += 2
    if (readString(row, ["name", "title", "workflow_name", "workflowName"]) !== "-") score += 3
    if (isWorkflowStatusValue(readString(row, ["status", "workflow_status"]))) score += 1
    if (extractWorkflowSteps(row).length > 0) score += 2
    // Penalize step-shaped rows and pure envelopes.
    if (readString(row, ["step_type", "task_type"]) !== "-") score -= 5
    if (ENVELOPE_STATUS_VALUES.has(readString(row, ["status"]).toLowerCase())) score -= 2
    return score
  }

  let best: AdminRecord = payload
  let bestScore = scoreWorkflowShape(payload)

  const visit = (row: AdminRecord, depth: number) => {
    if (depth > 4) return
    for (const key of ["workflow", "data", "result", "item", "details", "record"]) {
      const nested = toRecord(row[key])
      if (!nested) continue
      const score = scoreWorkflowShape(nested)
      if (score > bestScore) {
        best = nested
        bestScore = score
      }
      visit(nested, depth + 1)
    }
  }

  visit(payload, 0)

  // If the best record has no inline steps, try pulling them from the original payload tree.
  if (extractWorkflowSteps(best).length === 0) {
    const payloadSteps = extractWorkflowSteps(payload)
    if (payloadSteps.length > 0) {
      return { ...best, steps: payloadSteps }
    }
  }

  return best
}

function workflowFormFromRecord(record: AdminRecord | null): {
  name: string
  description: string
  status: string | null
  is_default: string | null
} {
  if (!record) {
    return {
      name: "",
      description: "",
      status: null,
      is_default: null,
    }
  }

  // Walk common nestings so list/detail wrappers still yield name/status.
  const sources = [
    record,
    toRecord(record.workflow),
    toRecord(record.data),
    toRecord(record.result),
    toRecord(record.item),
    toRecord(record.details),
  ].filter((entry): entry is AdminRecord => Boolean(entry))

  let name = ""
  let description = ""
  let status: string | null = null
  let isDefault: string | null = null

  for (const source of sources) {
    if (!name) {
      const candidate = readString(source, ["name", "title", "workflow_name", "workflowName"])
      if (candidate !== "-") name = candidate
    }
    if (!description) {
      const candidate = readString(source, ["description", "summary", "workflow_description"])
      if (candidate !== "-") description = candidate
    }
    if (status === null) {
      const candidate = readString(source, ["status", "workflow_status", "workflowStatus"])
      if (candidate !== "-" && isWorkflowStatusValue(candidate)) {
        const lower = candidate.toLowerCase()
        status =
          lower.includes("inactive") || lower.includes("disabled") || lower.includes("archived") ? "inactive" : "active"
      }
    }
    if (isDefault === null) {
      const rawDefault = source.is_default ?? source.default ?? source.isDefault
      if (rawDefault !== undefined && rawDefault !== null) {
        isDefault = asTruthyBoolean(rawDefault) ? "true" : "false"
      }
    }
  }

  return {
    name,
    description,
    status,
    is_default: isDefault,
  }
}

/** API body for POST/PATCH workflow steps — never send 0 ids. */
function toWorkflowStepApiPayload(step: OnboardingWorkflowStepDraft) {
  const metadata: AdminRecord = { ...(step.metadata ?? {}) }
  delete metadata.checklist_items
  delete metadata.checklistItems
  if (step.checklist_items.length > 0) {
    metadata.checklist_items = step.checklist_items
  }

  const payload: {
    is_required: boolean
    name: string
    description: string
    step_type: string
    due_days: number
    assigned_role_id?: number
    assigned_user_id?: number
    assigned_department_id?: number
    metadata?: AdminRecord
  } = {
    is_required: Boolean(step.is_required),
    name: String(step.name ?? "").trim(),
    description: String(step.description ?? "").trim(),
    step_type: String(step.step_type ?? "task").trim() || "task",
    due_days: Number(step.due_days) > 0 ? Number(step.due_days) : 1,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  }
  if (typeof step.assigned_role_id === "number" && step.assigned_role_id > 0) {
    payload.assigned_role_id = step.assigned_role_id
  }
  if (typeof step.assigned_user_id === "number" && step.assigned_user_id > 0) {
    payload.assigned_user_id = step.assigned_user_id
  }
  if (typeof step.assigned_department_id === "number" && step.assigned_department_id > 0) {
    payload.assigned_department_id = step.assigned_department_id
  }
  return payload
}

const REQUEST_STATUS_FILTER_OPTIONS = [
  "all",
  "not_started",
  "draft",
  "pending",
  "submitted",
  "in_review",
  "active",
  "in_progress",
  "approved",
  "rejected",
  "cancelled",
  "completed",
] as const

const PENDING_ONBOARDING_STATUS = "not_started"

const WORKFLOW_STATUS_FILTER_OPTIONS = ["all", "active", "inactive"] as const

const USER_VERIFY_MODE_OPTIONS = [
  { value: "fpOrCard", label: "Fingerprint or card" },
  { value: "card", label: "Card only" },
  { value: "fp", label: "Fingerprint only" },
  { value: "cardAndPw", label: "Card and password" },
  { value: "fpAndCard", label: "Fingerprint and card" },
  { value: "fpAndPw", label: "Fingerprint and password" },
  { value: "fpAndCardAndPw", label: "Fingerprint, card and password" },
  { value: "cardOrFpOrPw", label: "Card, fingerprint or password" },
] as const

const ONBOARDING_TASK_TYPE_OPTIONS = [
  "general",
  "hr",
  "it",
  "department",
  "manager",
  "document",
  "asset",
  "induction",
  "acknowledgement",
  "system",
] as const

const selectPopupClassName = "z-[400]"

const EMPTY_ONBOARDING_SHIFT_ASSIGNMENT: OnboardingShiftAssignmentDraft = {
  shiftId: "",
  effectiveFrom: "",
  effectiveTo: "",
  rotationGroupId: "",
  isPrimary: true,
}

const EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT: OnboardingTimetableAssignmentDraft = {
  timetableId: "",
  effectiveFrom: "",
  effectiveTo: "",
}

const EMPTY_ONBOARDING_DEVICE_ASSIGNMENT: OnboardingDeviceAssignmentDraft = {
  enabled: false,
  employeeNo: "",
  accessGroupId: "",
  organizationId: "",
  validEnabled: false,
  validBeginTime: "",
  validEndTime: "",
  localUiRight: false,
  closeDelayEnabled: false,
  maxOpenDoorTime: "",
  openDoorTime: "",
  userVerifyMode: "",
  deviceIds: [],
  syncNow: true,
  continueOnError: false,
}

const EMPTY_REQUEST_PROVISIONING: OnboardingProvisioningDraft = {
  roleIds: [],
  branchAccessIds: [],
  attendanceMode: "",
  shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
  timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
  deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
}

function asTruthyBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    return value !== 0
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true
    }
    if (["false", "0", "no", "n", ""].includes(normalized)) {
      return false
    }
  }
  return Boolean(value)
}

function hasEmployeeReviewValue(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
  return !["", "-", "n/a", "not provided", "none", "null", "undefined"].includes(normalized)
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function toDateOnlyValue(value: Date | undefined) {
  if (!value) return ""
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseAllowedActions(row: AdminRecord): Set<RequestAction> {
  const picked = new Set<RequestAction>()
  const normalized = (value: unknown) =>
    String(value ?? "")
      .toLowerCase()
      .trim()

  const tryAdd = (value: unknown) => {
    const action = normalized(value)
    if (
      action === "submit" ||
      action === "approve" ||
      action === "reject" ||
      action === "cancel" ||
      action === "complete" ||
      action === "delete"
    ) {
      picked.add(action)
    }
  }

  const direct = row.available_actions
  if (Array.isArray(direct)) {
    direct.forEach((item) => {
      if (item && typeof item === "object") {
        const nested = item as AdminRecord
        tryAdd(nested.action)
        tryAdd(nested.name)
        tryAdd(nested.type)
      } else {
        tryAdd(item)
      }
    })
  } else if (typeof direct === "string") {
    direct
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach(tryAdd)
  }

  tryAdd(row.next_action)
  tryAdd(row.action_type)
  tryAdd(row.current_action)

  const nestedStep = (row.current_step ?? row.step ?? row.pending_step ?? null) as AdminRecord | null
  if (nestedStep) {
    tryAdd(nestedStep.action_type)
    tryAdd(nestedStep.next_action)
  }

  const status = normalized(row.status ?? row.request_status ?? row.onboarding_status ?? row.workflow_status)

  // Status-based fallbacks when API does not expose available_actions.
  if (picked.size === 0) {
    if (isOnboardingDraftStatus(status)) {
      picked.add("submit")
      picked.add("cancel")
    } else if (isOnboardingActableStatus(status)) {
      picked.add("approve")
      picked.add("reject")
      picked.add("cancel")
    } else if (["ready_for_activation", "activating", "approved", "processing"].includes(status)) {
      picked.add("complete")
      picked.add("cancel")
    } else if (status === "rejected") {
      picked.add("delete")
    } else if (status === "cancelled" || status === "completed") {
      picked.add("delete")
    } else if (status && status !== PENDING_ONBOARDING_STATUS) {
      // Unknown non-empty status: still allow cancel when not terminal.
      if (!["completed", "cancelled", "rejected"].includes(status)) {
        picked.add("cancel")
      }
    }
  }

  // Backend: "Only active onboarding requests can be acted on".
  if (isOnboardingDraftStatus(status)) {
    picked.delete("approve")
    picked.delete("reject")
    picked.delete("complete")
    picked.add("submit")
  }

  return picked
}

function statusBadgeClass(status: string) {
  const value = status.trim().toLowerCase()
  if (value === "completed" || value === "approved") {
    return "bg-emerald-100 text-emerald-700"
  }
  if (value === "cancelled" || value === "rejected") {
    return "bg-rose-100 text-rose-700"
  }
  if (value === "active" || value === "in_progress" || value === "processing") {
    return "bg-sky-100 text-sky-700"
  }
  if (
    value === "draft" ||
    value === "pending" ||
    value === "submitted" ||
    value === "in_review" ||
    value === PENDING_ONBOARDING_STATUS
  ) {
    return "bg-amber-100 text-amber-700"
  }
  return "bg-slate-100 text-slate-700"
}

function toggleNumericId(currentValues: number[], id: number, checked: boolean) {
  if (checked) {
    return currentValues.includes(id) ? currentValues : [...currentValues, id]
  }
  return currentValues.filter((value) => value !== id)
}

function readRecordId(row: AdminRecord, keys: string[]) {
  const value = readNumber(row, keys)
  return value !== null ? value : null
}

function buildAttendanceDeviceLabel(row: AdminRecord, resolveBranchLabel: (branchId: number | null) => string) {
  const deviceName = readString(row, ["device_name", "deviceName", "name", "title"])
  const deviceCode = readString(row, ["device_code", "deviceCode"])
  const serial = readString(row, ["device_serial_number", "deviceSerialNumber", "serial_no"])
  const model = readString(row, ["device_model", "deviceModel", "model"])
  const vendor = readString(row, ["vendor_name", "vendorName"])
  const integrationType = readString(row, ["integration_type", "integrationType"])
  const branchLabel = resolveBranchLabel(readNumber(row, ["branch_id", "branchId"]))

  const title = [deviceName, deviceCode, serial].filter((value) => value !== "-")
  const detail = [model, vendor, integrationType, branchLabel].filter((value) => value !== "-").join(" • ")

  if (title.length === 0) {
    return detail || `Device #${readNumber(row, ["id", "device_id"]) ?? "?"}`
  }

  return detail ? `${title.join(" • ")} (${detail})` : title.join(" • ")
}

function MultiSelectChecklist({
  label,
  options,
  selectedIds,
  onToggle,
  emptyText,
  hint,
  compact = false,
}: {
  label: string
  options: Array<{ id: number; label: string; description?: string }>
  selectedIds: number[]
  onToggle: (id: number, checked: boolean) => void
  emptyText: string
  hint?: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={cn("grid", compact ? "gap-1" : "gap-2")}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("font-medium text-slate-900", compact ? "text-xs" : "text-sm")}>{label}</p>
        {selectedIds.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">{selectedIds.length} selected</span>
        ) : null}
      </div>
      <div
        className={cn("overflow-y-auto rounded-md border border-slate-200 bg-white", compact ? "max-h-28" : "max-h-44")}
      >
        {options.length === 0 ? (
          <div className={cn("text-muted-foreground", compact ? "px-2 py-2 text-xs" : "px-3 py-3 text-sm")}>
            {emptyText}
          </div>
        ) : (
          <div className={cn("grid gap-0.5", compact ? "p-1" : "p-2")}>
            {options.map((option) => {
              const checked = selectedIds.includes(option.id)
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md hover:bg-slate-50",
                    compact ? "px-1.5 py-1 text-xs" : "px-2 py-2 text-sm"
                  )}
                >
                  <Checkbox checked={checked} onCheckedChange={(value) => onToggle(option.id, Boolean(value))} />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">{option.label}</span>
                    {option.description ? (
                      <span className="block text-[11px] text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function OnboardingView() {
  const searchParams = useSearchParams()
  const highlightedRequestId = React.useMemo(
    () => searchParams?.get("highlight") ?? searchParams?.get("requestId") ?? searchParams?.get("request_id") ?? "",
    [searchParams]
  )
  const requestedTab = searchParams?.get("tab") ?? ""
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const isEmployeeMode = actor.ready ? actor.accessMode === "employee" || !actor.isAdmin : false
  const canViewOnboardingRequests = React.useMemo(
    () => actor.ready && (isEmployeeMode || canPerformPermission(actorPermissions, "onboarding_requests:read")),
    [actor.ready, actorPermissions, isEmployeeMode]
  )
  const canViewOnboardingWorkflows = React.useMemo(
    () =>
      actor.ready &&
      canPerformPermission(actorPermissions, {
        permissions: [
          "onboarding_workflows:read",
          "onboarding_workflows:create",
          "onboarding_workflows:update",
          "onboarding_workflows:delete",
        ],
        mode: "any",
      }),
    [actor.ready, actorPermissions]
  )
  const canReadEmployeeDirectory = React.useMemo(
    () => canPerformPermission(actorPermissions, "employees:read"),
    [actorPermissions]
  )
  const canReadOnboardingDocuments = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_documents:read"),
    [actorPermissions]
  )
  const canReadOnboardingTasks = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_tasks:read"),
    [actorPermissions]
  )
  const canReadRoles = React.useMemo(() => canPerformPermission(actorPermissions, "roles:read"), [actorPermissions])
  const canReadCompanyUsers = React.useMemo(
    () =>
      canPerformPermission(actorPermissions, {
        permissions: ["company_users:read", "users:read"],
        mode: "any",
      }),
    [actorPermissions]
  )
  const canViewPendingInvitations = React.useMemo(
    () =>
      actor.ready &&
      canPerformPermission(actorPermissions, {
        permissions: ["employees:create", "onboarding_requests:read", "onboarding_workflows:read"],
        mode: "any",
      }),
    [actor.ready, actorPermissions]
  )
  const canResendPendingInvitations = React.useMemo(
    () => canPerformPermission(actorPermissions, "employees:create"),
    [actorPermissions]
  )
  const canCreateOnboardingRequests = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_requests:create"),
    [actorPermissions]
  )
  const canUpdateOnboardingRequests = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_requests:update"),
    [actorPermissions]
  )
  const canApproveOnboardingRequests = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_requests:approve"),
    [actorPermissions]
  )
  const canCancelOnboardingRequests = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_requests:cancel"),
    [actorPermissions]
  )
  const canCompleteOnboardingRequests = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_requests:complete"),
    [actorPermissions]
  )
  const canCreateOnboardingWorkflows = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_workflows:create"),
    [actorPermissions]
  )
  const canUpdateOnboardingWorkflows = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_workflows:update"),
    [actorPermissions]
  )
  const canDeleteOnboardingWorkflows = React.useMemo(
    () => canPerformPermission(actorPermissions, "onboarding_workflows:delete"),
    [actorPermissions]
  )
  const [activeTab, setActiveTab] = React.useState<OnboardingTab>(
    requestedTab === "invitations" ? "invitations" : "requests"
  )
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [users, setUsers] = React.useState<AdminRecord[]>([])
  const [workflowDepartmentEmployees, setWorkflowDepartmentEmployees] = React.useState<AdminRecord[]>([])
  const [roles, setRoles] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [shiftRecords, setShiftRecords] = React.useState<AdminRecord[]>([])
  const [rotationGroupRecords, setRotationGroupRecords] = React.useState<AdminRecord[]>([])
  const [timetableRecords, setTimetableRecords] = React.useState<AdminRecord[]>([])
  const [accessGroups, setAccessGroups] = React.useState<AdminRecord[]>([])
  const [accessOrganizations, setAccessOrganizations] = React.useState<AdminRecord[]>([])
  const [attendanceDevices, setAttendanceDevices] = React.useState<AdminRecord[]>([])
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [invitations, setInvitations] = React.useState<AdminRecord[]>([])
  const [invitationSearch, setInvitationSearch] = React.useState("")
  const [invitationStatusFilter, setInvitationStatusFilter] =
    React.useState<EmployeeInvitationHistoryStatus>("pending")
  const [requestSearch, setRequestSearch] = React.useState("")
  const [requestStatusFilter, setRequestStatusFilter] = React.useState("all")
  const [requestEmployeeFilter, setRequestEmployeeFilter] = React.useState("")
  const [workflowSearch, setWorkflowSearch] = React.useState("")
  const [workflowStatusFilter, setWorkflowStatusFilter] = React.useState("all")
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])
  const debouncedRequestSearch = useDebouncedValue(requestSearch, 350)
  const debouncedWorkflowSearch = useDebouncedValue(workflowSearch, 350)
  const [, setLoadedTabs] = React.useState<Record<OnboardingTab, boolean>>({
    invitations: false,
    requests: false,
    workflows: false,
  })
  const invitationsFetchKeyRef = React.useRef<string | null>(null)
  const requestsFetchKeyRef = React.useRef<string | null>(null)
  const workflowsFetchKeyRef = React.useRef<string | null>(null)
  const [loadedLookups, setLoadedLookups] = React.useState<Record<OnboardingLookupKey, boolean>>({
    employees: false,
    workflows: false,
    users: false,
    roles: false,
    branches: false,
    departments: false,
    shifts: false,
    rotationGroups: false,
    timetables: false,
    accessGroups: false,
    accessOrganizations: false,
    attendanceDevices: false,
  })
  const [requestDetailsOpen, setRequestDetailsOpen] = React.useState(false)
  const [resendingInvitationId, setResendingInvitationId] = React.useState<number | null>(null)
  const [requestDetailsLoading, setRequestDetailsLoading] = React.useState(false)
  const [selectedRequestRow, setSelectedRequestRow] = React.useState<AdminRecord | null>(null)
  const [selectedRequestDetails, setSelectedRequestDetails] = React.useState<AdminRecord | null>(null)
  const [selectedRequestProgress, setSelectedRequestProgress] = React.useState<AdminRecord | null>(null)
  const [selectedRequestAuditLogs, setSelectedRequestAuditLogs] = React.useState<AdminRecord[]>([])
  const [selectedRequestDocuments, setSelectedRequestDocuments] = React.useState<AdminRecord[]>([])
  const [selectedRequestTasks, setSelectedRequestTasks] = React.useState<AdminRecord[]>([])
  const [selectedWorkflowSteps, setSelectedWorkflowSteps] = React.useState<AdminRecord[]>([])
  const [employeeReviewStep, setEmployeeReviewStep] = React.useState(0)
  const [employeeReviewComments, setEmployeeReviewComments] = React.useState<Record<string, string>>({})
  const [allowIncompleteWorkflowStart, setAllowIncompleteWorkflowStart] = React.useState(false)
  const [showDocumentComposer, setShowDocumentComposer] = React.useState(false)
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null)
  const [documentForm, setDocumentForm] = React.useState({
    title: "",
    description: "",
    document_type: "",
    expiry_date: "",
  })
  const [showTaskComposer, setShowTaskComposer] = React.useState(false)
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    asset_items: [""],
    description: "",
    task_type: "general",
    assigned_company_user_id: "",
    assigned_department_id: "",
    due_date: "",
  })

  const [requestForm, setRequestForm] = React.useState({
    employee_id: "",
    workflow_id: "",
    title: "",
    description: "",
    planned_start_date: "",
    planned_completion_date: "",
    submit: "true",
  })
  const [requestProvisioningEnabled, setRequestProvisioningEnabled] = React.useState(false)
  const [requestProvisioning, setRequestProvisioning] = React.useState<OnboardingProvisioningDraft>({
    ...EMPTY_REQUEST_PROVISIONING,
    shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
    timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
    deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
  })

  const [workflowForm, setWorkflowForm] = React.useState({
    name: "",
    description: "",
    status: "active",
    is_default: "false",
    step_name: "",
    step_description: "",
    step_checklist_items: [] as WorkflowChecklistItem[],
    step_type: "task",
    due_days: "1",
    is_required: "true",
    assigned_user_id: "",
    assigned_department_id: "",
  })

  React.useEffect(() => {
    const departmentId = Number(workflowForm.assigned_department_id)
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      setWorkflowDepartmentEmployees([])
      return
    }

    const accessToken = readStoredToken()
    if (!accessToken) {
      setWorkflowDepartmentEmployees([])
      return
    }

    let cancelled = false
    void listAllEmployees(
      accessToken,
      { department_id: departmentId, employment_status: "active" },
      { pageSize: 100, maxPages: 50 },
    )
      .then((rows) => {
        if (!cancelled) setWorkflowDepartmentEmployees(rows)
      })
      .catch(() => {
        if (!cancelled) setWorkflowDepartmentEmployees([])
      })

    return () => {
      cancelled = true
    }
  }, [workflowForm.assigned_department_id])
  const [workflowSteps, setWorkflowSteps] = React.useState<OnboardingWorkflowStepDraft[]>([])
  const [persistedWorkflowStepIds, setPersistedWorkflowStepIds] = React.useState<number[]>([])
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const stepTitleInputRef = React.useRef<HTMLInputElement>(null)
  const [checklistItemDialogOpen, setChecklistItemDialogOpen] = React.useState(false)
  const [editingChecklistItemIndex, setEditingChecklistItemIndex] = React.useState<number | null>(null)
  const [checklistItemForm, setChecklistItemForm] = React.useState({
    name: "",
    description: "",
  })
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null)
  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<number | null>(null)
  const [requestSheetOpen, setRequestSheetOpen] = React.useState(false)
  const [selectedInvitation, setSelectedInvitation] = React.useState<AdminRecord | null>(null)
  const [changeWorkflowDialogOpen, setChangeWorkflowDialogOpen] = React.useState(false)
  const [changeWorkflowRequest, setChangeWorkflowRequest] = React.useState<AdminRecord | null>(null)
  const [replacementWorkflowId, setReplacementWorkflowId] = React.useState("")
  const [approvalAssignmentDialogOpen, setApprovalAssignmentDialogOpen] = React.useState(false)
  const [approvalToReassign, setApprovalToReassign] = React.useState<AdminRecord | null>(null)
  const [replacementApproverId, setReplacementApproverId] = React.useState("")
  const [approvalReassignmentReason, setApprovalReassignmentReason] = React.useState("")

  React.useEffect(() => {
    if (!stepDialogOpen) {
      return
    }

    const focusTitle = window.requestAnimationFrame(() => stepTitleInputRef.current?.focus())
    return () => window.cancelAnimationFrame(focusTitle)
  }, [stepDialogOpen])

  React.useEffect(() => {
    if (requestedTab === "invitations") {
      setActiveTab("invitations")
    }
  }, [requestedTab])

  const resolveBranchLabel = React.useCallback(
    (branchId: number | null) => resolveOptionLabel(branches, branchId, ["id", "branch_id"], ["name", "title"]),
    [branches]
  )

  const requestRoleOptions = React.useMemo(
    () =>
      roles
        .map((row) => {
          const id = readRecordId(row, ["id", "role_id"])
          if (id === null) return null
          return {
            id,
            label: readString(row, ["display_name", "name", "title"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [roles]
  )

  const requestBranchAccessOptions = React.useMemo(
    () =>
      branches
        .map((row) => {
          const id = readRecordId(row, ["id", "branch_id"])
          if (id === null) return null
          return {
            id,
            label: readString(row, ["name", "title"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [branches]
  )

  const requestShiftOptions = React.useMemo(
    () =>
      shiftRecords
        .map((row) => {
          const id = readRecordId(row, ["id", "shift_id"])
          if (id === null) return null
          return {
            id,
            label: readString(row, ["name", "title", "code"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [shiftRecords]
  )

  const requestTimetableOptions = React.useMemo(
    () =>
      timetableRecords
        .map((row) => {
          const id = readRecordId(row, ["id", "timetable_id"])
          if (id === null) return null
          return {
            id,
            label: readString(row, ["name", "title", "code"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [timetableRecords]
  )

  const requestRotationGroupOptions = React.useMemo(
    () =>
      rotationGroupRecords
        .map((row) => {
          const id = readRecordId(row, ["id", "rotation_group_id", "rotationGroupId"])
          if (id === null) return null
          const name = readString(row, ["name", "title", "rotation_group_name", "rotationGroupName"])
          const code = readString(row, ["code", "rotation_group_code", "rotationGroupCode"])
          const label =
            name !== "-" && code !== "-"
              ? `${name} (${code})`
              : name !== "-"
                ? name
                : code !== "-"
                  ? code
                  : `Rotation group #${id}`
          return { id, label }
        })
        .filter((option): option is { id: number; label: string } => option !== null),
    [rotationGroupRecords]
  )

  const requestAccessGroupOptions = React.useMemo(
    () =>
      accessGroups
        .map((row) => {
          const id = readRecordId(row, ["id", "access_group_id"])
          if (id === null) return null
          return {
            id,
            label: readString(row, ["name", "title"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [accessGroups]
  )

  const requestAccessOrganizationOptions = React.useMemo(
    () =>
      accessOrganizations
        .map((row) => {
          const id = readRecordId(row, ["id", "organization_id"])
          if (id === null) return null
          return {
            id,
            label: readString(row, ["name", "title"]),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [accessOrganizations]
  )

  const requestAttendanceDeviceOptions = React.useMemo(
    () =>
      attendanceDevices
        .map((row) => {
          const id = readRecordId(row, ["id", "device_id", "attendance_device_id"])
          if (id === null) return null
          return {
            id,
            label: buildAttendanceDeviceLabel(row, resolveBranchLabel),
          }
        })
        .filter((option): option is { id: number; label: string } => option !== null && option.label !== "-"),
    [attendanceDevices, resolveBranchLabel]
  )

  const resolveProvisioningLabel = React.useCallback(
    (rows: AdminRecord[], id: number | null, idKeys: string[], labelKeys: string[]) =>
      resolveOptionLabel(rows, id, idKeys, labelKeys),
    []
  )

  const loadLookups = React.useCallback(
    async (token: string, lookupKeys: OnboardingLookupKey[], force = false) => {
      const missingKeys = force ? lookupKeys : lookupKeys.filter((key) => !loadedLookups[key])
      if (missingKeys.length === 0) {
        return
      }

      const results = await Promise.all(
        missingKeys.map(async (key) => {
          switch (key) {
            case "employees": {
              const onboardingEmployees = await listEmployees(token, {
                page: 1,
                limit: 200,
                sortBy: "created_at",
                sortOrder: "DESC",
                employment_status: "onboarding",
              })
              const merged = mergeEmployeeRows(onboardingEmployees.rows).filter(isOnboardingEligibleEmployee)
              return {
                key,
                result: {
                  ...onboardingEmployees,
                  rows: merged,
                },
              }
            }
            case "workflows":
              return {
                key,
                result: await listOnboardingWorkflows(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "users": {
              const [companyUsers, employeeDirectory] = await Promise.all([
                listAllCurrentCompanyUsers(token, { maxPages: 30 }).catch(() => [] as AdminRecord[]),
                listEmployees(token, {
                  page: 1,
                  limit: 200,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }).then((result) => result.rows).catch(() => [] as AdminRecord[]),
              ])
              const withDepartmentAssignments = companyUsers.map((companyUser) => {
                const flattened = flattenAssigneeRecord(companyUser)
                const linkedEmployees = employeeDirectory.filter((employee) =>
                  employeeMatchesCompanyUser(employee, companyUser)
                )
                const departmentIds = new Set(collectDepartmentIds(flattened))
                linkedEmployees.forEach((employee) => collectDepartmentIds(employee).forEach((id) => departmentIds.add(id)))
                return { ...flattened, department_ids: Array.from(departmentIds) }
              })
              return {
                key,
                result: {
                  rows: withDepartmentAssignments,
                  page: 1,
                  limit: withDepartmentAssignments.length,
                  total: withDepartmentAssignments.length,
                  totalPages: 1,
                },
              }
            }
            case "roles":
              return { key, result: await listResource("roles", token) }
            case "branches":
              return {
                key,
                result: await listBranches(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "departments":
              return {
                key,
                result: await listDepartments(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "shifts":
              return {
                key,
                result: await listShiftResources(token, "shifts", {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "rotationGroups":
              return {
                key,
                result: await listShiftResources(token, "shift-rotation-groups", {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "timetables":
              return {
                key,
                result: await listTimetableResources(token, "timetables", {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "accessGroups":
              return {
                key,
                result: await listAccessControlResources(token, "groups", {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "accessOrganizations":
              return {
                key,
                result: await listAccessControlResources(token, "organizations", {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
            case "attendanceDevices":
              return {
                key,
                result: await listAttendanceDevices(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              }
          }
        })
      )

      results.forEach((entry) => {
        if (!entry) return
        switch (entry.key) {
          case "employees":
            setEmployees(entry.result.rows)
            break
          case "workflows":
            setWorkflows(entry.result.rows)
            break
          case "users":
            setUsers(entry.result.rows)
            break
          case "roles":
            setRoles(entry.result)
            break
          case "branches":
            setBranches(entry.result.rows)
            break
          case "departments":
            setDepartments(entry.result.rows)
            break
          case "shifts":
            setShiftRecords(entry.result.rows)
            break
          case "rotationGroups":
            setRotationGroupRecords(entry.result.rows)
            break
          case "timetables":
            setTimetableRecords(entry.result.rows)
            break
          case "accessGroups":
            setAccessGroups(entry.result.rows)
            break
          case "accessOrganizations":
            setAccessOrganizations(entry.result.rows)
            break
          case "attendanceDevices":
            setAttendanceDevices(entry.result.rows)
            break
        }
      })

      setLoadedLookups((current) => {
        const next = { ...current }
        missingKeys.forEach((key) => {
          next[key] = true
        })
        return next
      })
    },
    [loadedLookups]
  )

  const ensureLookups = React.useCallback(
    async (lookupKeys: OnboardingLookupKey[], force = false) => {
      const token = readStoredToken()
      if (!token) {
        const message = "Authentication required. Please log in again."
        setError(message)
        showErrorAlert(message)
        return false
      }

      setLoading(true)
      setError(null)
      try {
        await loadLookups(token, lookupKeys, force)
        return true
      } catch (errorObject) {
        const message = errorObject instanceof Error ? errorObject.message : "Failed to load onboarding form data."
        setError(message)
        showErrorAlert(message)
        return false
      } finally {
        setLoading(false)
      }
    },
    [loadLookups]
  )

  const reloadAll = React.useCallback(
    async (targetTab: OnboardingTab = activeTab, force = false) => {
      const token = readStoredToken()
      if (!token) {
        const message = "Authentication required. Please log in again."
        setError(message)
        showErrorAlert(message)
        return
      }

      const requestQuery = {
        page: 1,
        limit: 100,
        sortBy: "created_at" as const,
        sortOrder: "DESC" as const,
        search: debouncedRequestSearch.trim() || undefined,
        employee_id:
          requestEmployeeFilter && Number(requestEmployeeFilter) > 0 ? Number(requestEmployeeFilter) : undefined,
      }
      const workflowQuery = {
        page: 1,
        limit: 100,
        sortBy: "created_at" as const,
        sortOrder: "DESC" as const,
        search: debouncedWorkflowSearch.trim() || undefined,
        status: workflowStatusFilter !== "all" ? workflowStatusFilter : undefined,
      }

      const fetchKey =
        targetTab === "invitations"
          ? `invitations:${invitationStatusFilter}`
          : targetTab === "requests"
            ? `requests:${JSON.stringify(requestQuery)}`
            : `workflows:${JSON.stringify(workflowQuery)}`

      if (!force) {
        const lastKey =
          targetTab === "invitations"
            ? invitationsFetchKeyRef.current
            : targetTab === "requests"
              ? requestsFetchKeyRef.current
              : workflowsFetchKeyRef.current
        if (lastKey === fetchKey) {
          return
        }
      }

      setLoading(true)
      setError(null)
      try {
        if (targetTab === "invitations") {
          const { data: invitationRows } = await listEmployeeInvitationHistory(
            token,
            { status: invitationStatusFilter, limit: 100 },
          )
          setInvitations(invitationRows)
          invitationsFetchKeyRef.current = fetchKey
        } else if (targetTab === "requests") {
          if (isEmployeeMode) {
            const mine = await listMyOnboardingRequests(token)
            setRequests(mine)
            requestsFetchKeyRef.current = fetchKey
          } else {
            const [requestRowsResult, employeesResult, recentEmployeesResult, workflowsResult] = await Promise.all([
              listOnboardingRequestsIncludingDrafts(token, requestQuery),
              canReadEmployeeDirectory
                ? listEmployees(token, {
                    page: 1,
                    limit: 200,
                    sortBy: "created_at",
                    sortOrder: "DESC",
                    employment_status: "onboarding",
                  })
                : Promise.resolve(null),
              canReadEmployeeDirectory
                ? listEmployees(token, {
                    page: 1,
                    limit: 100,
                    sortBy: "created_at",
                    sortOrder: "DESC",
                  })
                : Promise.resolve(null),
              canViewOnboardingWorkflows
                ? listOnboardingWorkflows(token, {
                    page: 1,
                    limit: 100,
                    sortBy: "created_at",
                    sortOrder: "DESC",
                  })
                : Promise.resolve(null),
            ])
            const onboardingEmployees = mergeEmployeeRows(
              employeesResult?.rows ?? [],
              recentEmployeesResult?.rows ?? []
            ).filter(isOnboardingEligibleEmployee)
            if (employeesResult || recentEmployeesResult) {
              setEmployees(onboardingEmployees)
            }
            if (workflowsResult) {
              setWorkflows(workflowsResult.rows)
            }
            setLoadedLookups((current) => ({
              ...current,
              ...(employeesResult || recentEmployeesResult ? { employees: true } : {}),
              ...(workflowsResult ? { workflows: true } : {}),
            }))

            let requestRows = requestRowsResult
            const defaultWorkflowId = defaultOnboardingWorkflowId(workflowsResult?.rows ?? [])
            const missingEmployees = onboardingEmployees.filter((employee) => {
              const employeeId = readNumber(employee, ["id", "employee_id", "employeeId"])
              return employeeId !== null && !collectRequestEmployeeIds(requestRows).has(employeeId)
            })

            if (canCreateOnboardingRequests && missingEmployees.length > 0) {
              const createdDrafts = await Promise.allSettled(
                missingEmployees.map((employee) => {
                  const employeeId = readNumber(employee, ["id", "employee_id", "employeeId"])
                  if (employeeId === null) {
                    return Promise.resolve(null)
                  }
                  const name = getEmployeeDisplayName(employee) || formatEmployeeOptionLabel(employee, employeeId)
                  return ensureDraftOnboardingRequest(token, {
                    employee_id: employeeId,
                    workflow_id: defaultWorkflowId ?? undefined,
                    title: name && name !== "Unknown employee" ? `Onboarding for ${name}` : "Onboarding",
                  })
                })
              )
              const createdRows = createdDrafts.flatMap((result) => {
                if (result.status !== "fulfilled" || !result.value) {
                  return []
                }
                return [result.value]
              })
              const refreshedRows = await listOnboardingRequestsIncludingDrafts(token, requestQuery)
              requestRows = mergeOnboardingRequestRows(refreshedRows, createdRows, requestRows)
            }

            const coveredEmployeeIds = collectRequestEmployeeIds(requestRows)
            const pendingRows = onboardingEmployees
              .filter((employee) => {
                const employeeId = readNumber(employee, ["id", "employee_id", "employeeId"])
                return employeeId !== null && !coveredEmployeeIds.has(employeeId)
              })
              .map(buildPendingOnboardingRow)

            setRequests([...pendingRows, ...requestRows])
            requestsFetchKeyRef.current = fetchKey
          }
        } else {
          const workflowsResult = await listOnboardingWorkflows(token, workflowQuery)
          setWorkflows(workflowsResult.rows)
          setLoadedLookups((current) => ({ ...current, workflows: true }))
          workflowsFetchKeyRef.current = fetchKey
        }
        setLoadedTabs((current) => ({ ...current, [targetTab]: true }))
      } catch (errorObject) {
        const message = errorObject instanceof Error ? errorObject.message : "Failed to load onboarding data."
        setError(message)
        showErrorAlert(message)
      } finally {
        setLoading(false)
      }
    },
    [
      activeTab,
      debouncedRequestSearch,
      debouncedWorkflowSearch,
      loadLookups,
      isEmployeeMode,
      canReadEmployeeDirectory,
      canCreateOnboardingRequests,
      canViewOnboardingWorkflows,
      requestEmployeeFilter,
      requestStatusFilter,
      workflowStatusFilter,
      invitationStatusFilter,
    ]
  )

  React.useEffect(() => {
    if (!actor.ready) return
    if (activeTab === "invitations" && canViewPendingInvitations) return
    if (activeTab === "requests" && canViewOnboardingRequests) return
    if (activeTab === "workflows" && canViewOnboardingWorkflows) return
    if (canViewOnboardingRequests) {
      setActiveTab("requests")
    } else if (canViewOnboardingWorkflows) {
      setActiveTab("workflows")
    } else if (canViewPendingInvitations) {
      setActiveTab("invitations")
    }
  }, [activeTab, actor.ready, canViewOnboardingRequests, canViewOnboardingWorkflows, canViewPendingInvitations])

  React.useEffect(() => {
    if (!actor.ready) return
    if (activeTab === "invitations" && !canViewPendingInvitations) return
    if (activeTab === "requests" && !canViewOnboardingRequests) return
    if (activeTab === "workflows" && !canViewOnboardingWorkflows) return
    void reloadAll(activeTab)
  }, [
    activeTab,
    actor.ready,
    canViewOnboardingRequests,
    canViewOnboardingWorkflows,
    canViewPendingInvitations,
    debouncedRequestSearch,
    debouncedWorkflowSearch,
    requestEmployeeFilter,
    requestStatusFilter,
    workflowStatusFilter,
    invitationStatusFilter,
    reloadAll,
  ])

  function resolveEmployeeLabel(employeeId: number | null) {
    if (employeeId === null) {
      return "Unknown employee"
    }

    const employee = employees.find((row) => readNumber(row, ["id", "employee_id", "user_id"]) === employeeId)
    if (!employee) {
      return `Employee #${employeeId}`
    }

    return formatEmployeeOptionLabel(employee, employeeId)
  }

  function resolveWorkflowLabel(workflowId: number | null) {
    if (workflowId === null) {
      return "Attach workflow (optional)"
    }

    const workflow = workflows.find((row) => readNumber(row, ["id", "workflow_id"]) === workflowId)
    if (!workflow) {
      return `Workflow #${workflowId}`
    }

    const workflowName = readString(workflow, ["name", "title"])
    return workflowName !== "-" ? workflowName : `Workflow #${workflowId}`
  }

  const requestStatusOptions = React.useMemo(() => {
    const statuses = new Set<string>(REQUEST_STATUS_FILTER_OPTIONS)
    requests.forEach((row) => {
      const value = String(row.status ?? "")
        .trim()
        .toLowerCase()
      if (value) statuses.add(value)
    })
    return Array.from(statuses)
  }, [requests])

  const filteredInvitations = React.useMemo(() => {
    const searchValue = invitationSearch.trim().toLowerCase()
    if (!searchValue) {
      return invitations
    }
    return invitations.filter((row) =>
      [
        row.id,
        row.first_name,
        row.last_name,
        row.email,
        row.phone,
        row.status,
        invitationDeliveryStatus(row, "email"),
        invitationDeliveryStatus(row, "sms"),
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(searchValue)
      )
    )
  }, [invitationSearch, invitations])

  const resendPendingInvitation = React.useCallback(
    async (row: AdminRecord) => {
      const invitationId = readNumber(row, ["id", "invitation_id"])
      const token = readStoredToken()
      if (invitationId === null || !token) {
        showErrorAlert("Unable to resend this invitation.")
        return
      }

      setResendingInvitationId(invitationId)
      try {
        await resendEmployeeInvitation(token, invitationId)
        invitationsFetchKeyRef.current = null
        await reloadAll("invitations", true)
        showSuccessAlert("Invitation resent by email and SMS.")
      } catch (errorObject) {
        showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to resend the invitation.")
      } finally {
        setResendingInvitationId(null)
      }
    },
    [reloadAll]
  )

  const selectableEmployees = React.useMemo(() => employees.filter(isOnboardingEligibleEmployee), [employees])

  const employeeLabelById = React.useMemo(() => {
    const map = new Map<number, string>()
    employees.forEach((row) => {
      const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
      if (employeeId === null) return
      map.set(employeeId, formatEmployeeOptionLabel(row, employeeId))
    })
    return map
  }, [employees])

  const requestRowEmployeeLabel = React.useCallback(
    (row: AdminRecord) => {
      const inlineName = getEmployeeDisplayName(row)
      if (inlineName) {
        return inlineName
      }
      const nestedEmployee = toRecord(row.employee) ?? toRecord(row.employee_profile)
      if (nestedEmployee) {
        const nestedName = getEmployeeDisplayName(nestedEmployee)
        if (nestedName) {
          return nestedName
        }
      }
      const employeeId = readNumber(row, ["employee_id", "employeeId"])
      return employeeLabelById.get(employeeId ?? -1) ?? (employeeId === null ? "-" : `Employee #${employeeId}`)
    },
    [employeeLabelById]
  )

  const filteredRequests = React.useMemo(() => {
    const searchValue = requestSearch.trim().toLowerCase()
    return requests.filter((row) => {
      const statusValue = String(row.status ?? "")
        .trim()
        .toLowerCase()
      if (requestStatusFilter === "draft") {
        if (!isOnboardingDraftStatus(statusValue)) {
          return false
        }
      } else if (requestStatusFilter !== "all" && statusValue !== requestStatusFilter) {
        return false
      }

      if (!searchValue) return true

      const nestedEmployee = toRecord(row.employee) ?? toRecord(row.employee_profile) ?? row
      if (matchesEmployeeDirectorySearch(nestedEmployee, requestSearch.trim())) {
        return true
      }

      const rowValues = [
        row.id,
        row.request_id,
        row.request_no,
        row.request_code,
        row.onboarding_no,
        row.onboarding_code,
        row.reference_no,
        row.title,
        row.name,
        row.status,
        requestRowEmployeeLabel(row),
      ]
      return rowValues.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(searchValue)
      )
    })
  }, [requests, requestSearch, requestStatusFilter, requestRowEmployeeLabel])

  const filteredWorkflows = React.useMemo(() => {
    const searchValue = workflowSearch.trim().toLowerCase()
    return workflows.filter((row) => {
      const statusValue = String(row.status ?? "")
        .trim()
        .toLowerCase()
      if (workflowStatusFilter !== "all" && statusValue !== workflowStatusFilter) {
        return false
      }
      if (!searchValue) {
        return true
      }
      return [row.id, row.workflow_id, row.name, row.title, row.description, row.status, row.is_default].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(searchValue)
      )
    })
  }, [workflowSearch, workflowStatusFilter, workflows])

  const workflowStatusOptions = React.useMemo(() => {
    const statuses = new Set<string>(WORKFLOW_STATUS_FILTER_OPTIONS)
    workflows.forEach((row) => {
      const value = String(row.status ?? "")
        .trim()
        .toLowerCase()
      if (value) statuses.add(value)
    })
    return Array.from(statuses)
  }, [workflows])

  function resolveOptionLabel(rows: AdminRecord[], id: number | null, idKeys: string[], labelKeys: string[]) {
    if (id === null) return "-"
    const found = rows.find((row) => recordMatchesId(row, id, idKeys))
    if (!found) return "-"
    const person = personDisplayName(found)
    if (person) return person
    const label = readString(found, labelKeys)
    return label !== "-" ? label : "-"
  }

  function resolveBooleanLabel(value: string) {
    return value === "true" ? "Submit immediately" : "Save as draft"
  }

  function resolveYesNoLabel(value: unknown) {
    return String(value) === "true" || value === true ? "Yes" : "No"
  }

  function updateRequestProvisioningField<K extends keyof OnboardingProvisioningDraft>(
    field: K,
    value: OnboardingProvisioningDraft[K]
  ) {
    setRequestProvisioning((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function updateRequestShiftAssignmentField<K extends keyof OnboardingShiftAssignmentDraft>(
    field: K,
    value: OnboardingShiftAssignmentDraft[K]
  ) {
    setRequestProvisioning((previous) => ({
      ...previous,
      shiftAssignment: {
        ...previous.shiftAssignment,
        [field]: value,
      },
    }))
  }

  function updateRequestTimetableAssignmentField<K extends keyof OnboardingTimetableAssignmentDraft>(
    field: K,
    value: OnboardingTimetableAssignmentDraft[K]
  ) {
    setRequestProvisioning((previous) => ({
      ...previous,
      timetableAssignment: {
        ...previous.timetableAssignment,
        [field]: value,
      },
    }))
  }

  function updateRequestDeviceAssignmentField<K extends keyof OnboardingDeviceAssignmentDraft>(
    field: K,
    value: OnboardingDeviceAssignmentDraft[K]
  ) {
    setRequestProvisioning((previous) => ({
      ...previous,
      deviceAssignment: {
        ...previous.deviceAssignment,
        [field]: value,
      },
    }))
  }

  function setRequestAttendanceMode(mode: OnboardingProvisioningDraft["attendanceMode"]) {
    setRequestProvisioning((previous) => ({
      ...previous,
      attendanceMode: mode,
      shiftAssignment: mode === "shift" ? previous.shiftAssignment : { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
      timetableAssignment:
        mode === "timetable" ? previous.timetableAssignment : { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
    }))
  }

  function extractProvisioning(record: AdminRecord | null): OnboardingProvisioning | null {
    if (!record) {
      return null
    }
    const directProvisioning = toRecord(record.provisioning)
    if (directProvisioning) {
      return directProvisioning as unknown as OnboardingProvisioning
    }

    const metadata = toRecord(record.metadata)
    const nestedProvisioning = metadata ? toRecord(metadata.provisioning) : null
    if (nestedProvisioning) {
      return nestedProvisioning as unknown as OnboardingProvisioning
    }

    return null
  }

  function extractMetadata(record: AdminRecord | null) {
    if (!record) {
      return null
    }
    return toRecord(record.metadata)
  }

  const resolveResponsibleParty = React.useCallback(
    (step: AdminRecord) => resolveResponsiblePartyLabel(step, roles, users) || "-",
    [roles, users]
  )

  const assignableUsers = React.useMemo(() => {
    const departmentId = Number(workflowForm.assigned_department_id)
    const selectedId = Number(workflowForm.assigned_user_id)
    const catalog = users.map((user) => {
      const flattened = flattenAssigneeRecord(user)
      const linkedEmployees = workflowDepartmentEmployees.filter((employee) =>
        employeeMatchesCompanyUser(employee, user)
      )
      const departmentIds = new Set(collectDepartmentIds(flattened))
      linkedEmployees.forEach((employee) => {
        collectDepartmentIds(employee).forEach((id) => departmentIds.add(id))
      })
      return { ...flattened, department_ids: Array.from(departmentIds) }
    })
    const filtered = filterAssigneesForStep(catalog, {
      selectedId: Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null,
    })
    const departmentUsers =
      Number.isFinite(departmentId) && departmentId > 0
        ? filtered.filter((row) => collectDepartmentIds(row).has(departmentId))
        : []
    const seen = new Set<number>()
    return departmentUsers.filter((row) => {
      const id = preferredAssigneeId(row)
      if (id === null || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [users, workflowDepartmentEmployees, workflowForm.assigned_department_id, workflowForm.assigned_user_id])

  const workflowDepartmentOptions = React.useMemo(
    () =>
      departments
        .map((department) => {
          const id = readNumber(department, ["id", "department_id"])
          if (id === null) return null
          const departmentName = resolveOptionLabel(
            departments,
            id,
            ["id", "department_id"],
            ["name", "title", "code"]
          )
          const branchId = readNumber(department, ["branch_id", "branchId"])
          const branchName =
            branchId === null
              ? ""
              : resolveOptionLabel(branches, branchId, ["id", "branch_id"], ["name", "title", "code"])
          return { id, label: branchName && branchName !== "-" ? `${branchName} — ${departmentName}` : departmentName }
        })
        .filter((option): option is { id: number; label: string } => option !== null)
        .sort((left, right) => left.label.localeCompare(right.label)),
    [branches, departments]
  )

  const selectedWorkflowDepartmentLabel = React.useMemo(() => {
    const selectedId = Number(workflowForm.assigned_department_id)
    return workflowDepartmentOptions.find((option) => option.id === selectedId)?.label ?? "Select department"
  }, [workflowDepartmentOptions, workflowForm.assigned_department_id])

  const selectedStepAssigneeId = React.useMemo(() => {
    const value = Number(workflowForm.assigned_user_id)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [workflowForm.assigned_user_id])
  const selectedStepAssignee = React.useMemo(
    () =>
      selectedStepAssigneeId === null
        ? null
        : users.find(
            (row) => readNumber(row, ["company_user_id", "companyUserId"]) === selectedStepAssigneeId
          ) ?? findAssigneeRecord(users, selectedStepAssigneeId),
    [selectedStepAssigneeId, users]
  )
  const requiredStepPermission = React.useMemo(
    () => requiredPermissionForOnboardingStep(workflowForm.step_type),
    [workflowForm.step_type]
  )
  const selectedStepAssigneeMissingPermission =
    selectedStepAssigneeId !== null &&
    (!selectedStepAssignee || !onboardingAssigneeHasPermission(selectedStepAssignee, workflowForm.step_type))
  const selectedStepAssigneeLabel = selectedStepAssignee
    ? personDisplayName(selectedStepAssignee) || `User #${selectedStepAssigneeId}`
    : selectedStepAssigneeId !== null
      ? `User #${selectedStepAssigneeId}`
      : ""

  const replacementApproverMembershipId = React.useMemo(() => {
    const value = Number(replacementApproverId)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [replacementApproverId])
  const replacementApprover = React.useMemo(
    () =>
      replacementApproverMembershipId === null
        ? null
        : users.find(
            (row) => readNumber(row, ["company_user_id", "companyUserId"]) === replacementApproverMembershipId
          ) ?? findAssigneeRecord(users, replacementApproverMembershipId),
    [replacementApproverMembershipId, users]
  )
  const replacementApproverMissingPermission =
    replacementApproverMembershipId !== null &&
    (!replacementApprover || !onboardingAssigneeHasPermission(replacementApprover, "sign_off"))
  const approvalAssignmentCandidates = React.useMemo(() => {
    const seen = new Set<number>()
    return users.map(flattenAssigneeRecord).filter((row) => {
      const id = preferredAssigneeId(row)
      if (id === null || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [users])

  const taskAssignableUsers = React.useMemo(() => {
    const departmentId = Number(taskForm.assigned_department_id)
    if (!Number.isFinite(departmentId) || departmentId <= 0) return []
    const catalog = users.map(flattenAssigneeRecord)
    const hasDepartmentData = catalog.some((row) => collectDepartmentIds(row).size > 0)
    const filtered = catalog.filter((row) => collectDepartmentIds(row).has(departmentId))
    const source = hasDepartmentData ? filtered : catalog
    const seen = new Set<number>()
    return source.filter((row) => {
      const id = preferredAssigneeId(row)
      if (id === null || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [taskForm.assigned_department_id, users])

  async function hydrateAssignedUser(assignedId: number | null) {
    if (assignedId === null || assignedId <= 0) {
      return ""
    }
    const existing = findAssigneeRecord(users, assignedId)
    if (existing) {
      return String(preferredAssigneeId(existing) ?? assignedId)
    }
    const token = readStoredToken()
    if (!token) {
      return String(assignedId)
    }
    const extra = await loadAssigneeById(token, assignedId)
    if (extra) {
      setUsers((current) => (findAssigneeRecord(current, assignedId) ? current : [extra, ...current]))
      return String(preferredAssigneeId(extra) ?? assignedId)
    }
    setUsers((current) =>
      findAssigneeRecord(current, assignedId)
        ? current
        : [{ id: assignedId, full_name: `User #${assignedId}` }, ...current]
    )
    return String(assignedId)
  }

  function resetWorkflowStepForm() {
    setChecklistItemDialogOpen(false)
    setEditingChecklistItemIndex(null)
    setChecklistItemForm({ name: "", description: "" })
    setWorkflowForm((prev) => ({
      ...prev,
      step_name: "",
      step_description: "",
      step_checklist_items: [],
      step_type: "task",
      due_days: "1",
      is_required: "true",
      assigned_user_id: "",
      assigned_department_id: "",
    }))
  }

  function resetWorkflowForm() {
    setWorkflowForm({
      name: "",
      description: "",
      status: "active",
      is_default: "false",
      step_name: "",
      step_description: "",
      step_checklist_items: [],
      step_type: "task",
      due_days: "1",
      is_required: "true",
      assigned_user_id: "",
      assigned_department_id: "",
    })
    setWorkflowSteps([])
    setPersistedWorkflowStepIds([])
    setEditingStepIndex(null)
  }

  function resetRequestForm() {
    setRequestForm({
      employee_id: "",
      workflow_id: "",
      title: "",
      description: "",
      planned_start_date: "",
      planned_completion_date: "",
      submit: "true",
    })
    setRequestProvisioningEnabled(false)
    setRequestProvisioning({
      ...EMPTY_REQUEST_PROVISIONING,
      shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
      timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
      deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
    })
  }

  function resetDocumentForm() {
    setDocumentForm({
      title: "",
      description: "",
      document_type: "",
      expiry_date: "",
    })
    setDocumentUploadFile(null)
  }

  function resetTaskForm() {
    setTaskForm({
      title: "",
      asset_items: [""],
      description: "",
      task_type: "general",
      assigned_company_user_id: "",
      assigned_department_id: "",
      due_date: "",
    })
  }

  async function openRequestSheet() {
    const loaded = await ensureLookups(["employees", "workflows"])
    if (!loaded) {
      return
    }
    resetRequestForm()
    setRequestSheetOpen(true)
  }

  async function enableRequestProvisioning() {
    const loaded = await ensureLookups([
      "roles",
      "branches",
      "shifts",
      "rotationGroups",
      "timetables",
      "accessGroups",
      "accessOrganizations",
      "attendanceDevices",
    ])
    if (!loaded) {
      return
    }
    setRequestProvisioningEnabled(true)
  }

  function buildStepFromWorkflowForm() {
    if (!workflowForm.step_name.trim()) {
      return {
        error: "Step name is required.",
        step: null as AdminRecord | null,
      }
    }

    const checklistItems: WorkflowChecklistItem[] =
      workflowForm.step_type === "sign_off"
        ? []
        : workflowForm.step_checklist_items.map((item) => ({
            name: item.name.trim(),
            description: item.description.trim(),
          }))
    if (
      workflowForm.step_type !== "sign_off" &&
      (checklistItems.length === 0 || checklistItems.some((item) => !item.name))
    ) {
      return {
        error: "Add at least one named checklist item.",
        step: null as AdminRecord | null,
      }
    }

    const dueDays = Number(workflowForm.due_days)
    if (!Number.isFinite(dueDays) || dueDays < 1) {
      return {
        error: "Due days must be 1 or greater.",
        step: null as AdminRecord | null,
      }
    }

    const assignedUserId = Number(workflowForm.assigned_user_id)
    const assignedDepartmentId = Number(workflowForm.assigned_department_id)
    const hasAssignedUser = Number.isFinite(assignedUserId) && assignedUserId > 0
    const hasAssignedDepartment = Number.isFinite(assignedDepartmentId) && assignedDepartmentId > 0

    if (!hasAssignedDepartment) {
      return {
        error: "Select a department for this step.",
        step: null as AdminRecord | null,
      }
    }

    if (hasAssignedUser && selectedStepAssigneeMissingPermission) {
      return {
        error: `${selectedStepAssigneeLabel} needs ${requiredStepPermission} before this step can be assigned to them.`,
        step: null as AdminRecord | null,
      }
    }

    const stepPayload: OnboardingWorkflowStepDraft = {
      is_required: workflowForm.is_required === "true",
      name: workflowForm.step_name.trim(),
      description: workflowForm.step_description.trim(),
      checklist_items: checklistItems,
      step_type: workflowForm.step_type.trim() || "task",
      due_days: dueDays,
    }

    if (hasAssignedUser) {
      stepPayload.assigned_user_id = assignedUserId
    }
    if (hasAssignedDepartment) {
      stepPayload.assigned_department_id = assignedDepartmentId
    }

    return { error: null, step: stepPayload }
  }

  function openCreateChecklistItemDialog() {
    setEditingChecklistItemIndex(null)
    setChecklistItemForm({ name: "", description: "" })
    setChecklistItemDialogOpen(true)
  }

  function openEditChecklistItemDialog(item: WorkflowChecklistItem, index: number) {
    setEditingChecklistItemIndex(index)
    setChecklistItemForm({ ...item })
    setChecklistItemDialogOpen(true)
  }

  function saveWorkflowChecklistItem() {
    const name = checklistItemForm.name.trim()
    if (!name) {
      showErrorAlert("Checklist item name is required.")
      return
    }
    const nextItem = {
      name,
      description: checklistItemForm.description.trim(),
    }
    setWorkflowForm((prev) => ({
      ...prev,
      step_checklist_items:
        editingChecklistItemIndex === null
          ? [...prev.step_checklist_items, nextItem]
          : prev.step_checklist_items.map((item, index) => (index === editingChecklistItemIndex ? nextItem : item)),
    }))
    setChecklistItemDialogOpen(false)
    setEditingChecklistItemIndex(null)
    setChecklistItemForm({ name: "", description: "" })
  }

  function addWorkflowStep() {
    const { error: stepError, step } = buildStepFromWorkflowForm()
    if (stepError || !step) {
      showErrorAlert(stepError ?? "Invalid step.")
      return
    }

    if (editingStepIndex !== null) {
      setWorkflowSteps((prev) =>
        prev.map((entry, idx) =>
          idx === editingStepIndex
            ? ({
                ...step,
                ...(entry.id ? { id: entry.id } : {}),
              } as OnboardingWorkflowStepDraft)
            : entry
        )
      )
      showSuccessAlert("Workflow step updated.")
    } else {
      setWorkflowSteps((prev) => [...prev, step as OnboardingWorkflowStepDraft])
      showSuccessAlert("Workflow step added.")
    }
    setEditingStepIndex(null)
    setStepDialogOpen(false)
    resetWorkflowStepForm()
  }

  function openCreateStepDialog() {
    void (async () => {
      const loaded = await ensureLookups(["users", "departments"])
      if (!loaded) {
        return
      }
      setEditingStepIndex(null)
      resetWorkflowStepForm()
      setStepDialogOpen(true)
    })()
  }

  function removeWorkflowStep(index: number) {
    setWorkflowSteps((prev) => prev.filter((_, stepIndex) => stepIndex !== index))
    showSuccessAlert("Workflow step removed.")
  }

  function editWorkflowStep(step: OnboardingWorkflowStepDraft, index: number) {
    void (async () => {
      const loaded = await ensureLookups(["users", "departments"])
      if (!loaded) {
        return
      }
      setEditingStepIndex(index)
      const assignedUserSelectValue = await hydrateAssignedUser(
        typeof step.assigned_user_id === "number" ? step.assigned_user_id : null
      )
      setWorkflowForm((prev) => ({
        ...prev,
        step_name: String(step.name ?? ""),
        step_description: String(step.description ?? ""),
        step_checklist_items: step.checklist_items.map((item) => ({ ...item })),
        step_type: String(step.step_type ?? "task"),
        due_days: String(step.due_days ?? "1"),
        is_required: String(step.is_required ?? true) === "true" ? "true" : "false",
        assigned_user_id: assignedUserSelectValue,
        assigned_department_id:
          typeof step.assigned_department_id === "number" ? String(step.assigned_department_id) : "",
      }))
      setStepDialogOpen(true)
    })()
  }

  async function openEditWorkflowSheet(workflowId: number | null, listRow?: AdminRecord | null) {
    if (workflowId === null) {
      return
    }
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    // Prefer the full list row from state when the caller only passes an id.
    const resolvedListRow =
      listRow ?? workflows.find((row) => readNumber(row, ["id", "workflow_id"]) === workflowId) ?? null

    // Prefill immediately from the table row so the sheet never looks like a blank create form.
    const listBasics = workflowFormFromRecord(resolvedListRow)
    const listSteps = extractWorkflowSteps(resolvedListRow).map((step) => normalizeWorkflowStep(step))

    setEditingWorkflowId(workflowId)
    setEditingStepIndex(null)
    setWorkflowForm((prev) => ({
      ...prev,
      name: listBasics.name,
      description: listBasics.description,
      status: listBasics.status ?? "active",
      is_default: listBasics.is_default ?? "false",
      step_name: "",
      step_description: "",
      step_checklist_items: [],
      step_type: "task",
      due_days: "1",
      is_required: "true",
      assigned_user_id: "",
      assigned_department_id: "",
    }))
    setWorkflowSteps(listSteps)
    setPersistedWorkflowStepIds(
      listSteps.map((step) => step.id).filter((stepId): stepId is number => typeof stepId === "number" && stepId > 0)
    )
    setWorkflowSheetOpen(true)

    // Lookups are only needed for step assignment dropdowns; don't block showing details.
    void ensureLookups(["users", "departments"])

    setSaving(true)
    setError(null)
    try {
      const rawWorkflow = await getOnboardingWorkflow(token, workflowId)
      const workflow = unwrapWorkflowDetail(rawWorkflow)
      if (!workflow) {
        throw new Error("Workflow details were not returned by the API.")
      }

      let normalizedSteps = extractWorkflowSteps(workflow).map((step) => normalizeWorkflowStep(step))

      // Some APIs expose steps only via the nested steps collection endpoint.
      if (normalizedSteps.length === 0) {
        try {
          const stepRows = await listOnboardingWorkflowSteps(token, workflowId)
          if (stepRows.length > 0) {
            normalizedSteps = stepRows.map((step) => normalizeWorkflowStep(step))
          }
        } catch {
          // Endpoint may not exist; keep list/detail steps.
        }
      }

      // Never wipe good list prefill with empty detail fields.
      if (normalizedSteps.length === 0 && listSteps.length > 0) {
        normalizedSteps = listSteps
      }

      const detailBasics = workflowFormFromRecord(workflow)

      setWorkflowForm((prev) => ({
        ...prev,
        name: detailBasics.name || listBasics.name || prev.name,
        description: detailBasics.description || listBasics.description || prev.description,
        status: detailBasics.status ?? listBasics.status ?? prev.status ?? "active",
        is_default: detailBasics.is_default ?? listBasics.is_default ?? prev.is_default ?? "false",
        step_name: "",
        step_description: "",
        step_checklist_items: [],
        step_type: "task",
        due_days: "1",
        is_required: "true",
        assigned_user_id: "",
        assigned_department_id: "",
      }))
      setWorkflowSteps(normalizedSteps)
      setPersistedWorkflowStepIds(
        normalizedSteps
          .map((step) => step.id)
          .filter((stepId): stepId is number => typeof stepId === "number" && stepId > 0)
      )
      setEditingWorkflowId(workflowId)
    } catch (errorObject) {
      // Keep list prefill visible; only surface the load error.
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load workflow details."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function openCreateWorkflowSheet() {
    if (!canCreateOnboardingWorkflows) {
      showErrorAlert("You do not have permission to create onboarding workflows.")
      return
    }
    const loaded = await ensureLookups(["users", "departments"])
    if (!loaded) {
      return
    }
    resetWorkflowForm()
    setEditingWorkflowId(null)
    setWorkflowSheetOpen(true)
  }

  async function removeWorkflow(workflowId: number | null) {
    if (!canDeleteOnboardingWorkflows) {
      showErrorAlert("You do not have permission to delete onboarding workflows.")
      return
    }
    if (workflowId === null) {
      return
    }
    if (typeof window !== "undefined" && !window.confirm("Delete this onboarding workflow? This cannot be undone.")) {
      return
    }
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      try {
        await deleteOnboardingWorkflow(token, workflowId)
      } catch {
        const workflow = await getOnboardingWorkflow(token, workflowId)
        const stepIds = toRecordList(
          workflow?.steps ?? workflow?.workflow_steps ?? workflow?.tasks ?? workflow?.activities
        )
          .map((step) => readNumber(step, ["id", "step_id", "workflow_step_id"]))
          .filter((stepId): stepId is number => typeof stepId === "number" && stepId > 0)

        for (const stepId of stepIds) {
          await deleteOnboardingWorkflowStep(token, workflowId, stepId)
        }

        await deleteOnboardingWorkflow(token, workflowId)
      }
      showSuccessAlert("Workflow deleted successfully.")
      await reloadAll(activeTab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function cloneWorkflow(workflowId: number | null, row: AdminRecord) {
    if (!canCreateOnboardingWorkflows) {
      showErrorAlert("You do not have permission to clone onboarding workflows.")
      return
    }
    if (workflowId === null) {
      return
    }
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    const sourceName = readString(row, ["name", "title"])
    const cloneName = sourceName !== "-" ? `${sourceName} Copy` : `Workflow ${workflowId} Copy`

    setSaving(true)
    setError(null)
    try {
      await cloneOnboardingWorkflow(token, workflowId, {
        name: cloneName,
        is_default: false,
      })
      showSuccessAlert("Onboarding workflow cloned.")
      await reloadAll("workflows", true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to clone workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitWorkflow() {
    if (editingWorkflowId === null && !canCreateOnboardingWorkflows) {
      showErrorAlert("You do not have permission to create onboarding workflows.")
      return
    }
    if (editingWorkflowId !== null && !canUpdateOnboardingWorkflows) {
      showErrorAlert("You do not have permission to update onboarding workflows.")
      return
    }

    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    if (!workflowForm.name.trim()) {
      showErrorAlert("Workflow name is required.")
      return
    }

    if (workflowSteps.length === 0) {
      showErrorAlert("Add at least one workflow step.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editingWorkflowId === null) {
        await createOnboardingWorkflow(token, {
          name: workflowForm.name.trim(),
          description: workflowForm.description.trim() || undefined,
          status: workflowForm.status || "active",
          is_default: workflowForm.is_default === "true",
          steps: workflowSteps.map((step) => toWorkflowStepApiPayload(step)),
        })
        showSuccessAlert("Onboarding workflow created.")
      } else {
        await patchOnboardingWorkflow(token, editingWorkflowId, {
          name: workflowForm.name.trim(),
          description: workflowForm.description.trim() || undefined,
          status: workflowForm.status || "active",
          is_default: workflowForm.is_default === "true",
        })

        const remainingStepIds = new Set(persistedWorkflowStepIds)
        for (const step of workflowSteps) {
          const stepPayload = toWorkflowStepApiPayload(step)

          if (typeof step.id === "number" && step.id > 0) {
            await patchOnboardingWorkflowStep(token, editingWorkflowId, step.id, stepPayload)
            remainingStepIds.delete(step.id)
          } else {
            await createOnboardingWorkflowStep(token, editingWorkflowId, stepPayload)
          }
        }

        for (const stepId of remainingStepIds) {
          await deleteOnboardingWorkflowStep(token, editingWorkflowId, stepId)
        }

        showSuccessAlert("Onboarding workflow updated.")
      }

      resetWorkflowForm()
      setWorkflowSheetOpen(false)
      setEditingWorkflowId(null)
      await reloadAll(activeTab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function startPendingOnboarding(row: AdminRecord) {
    if (!canCreateOnboardingRequests) {
      showErrorAlert("You do not have permission to create onboarding requests.")
      return
    }
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }
    const employee =
      toRecord(row.employee) ??
      employees.find((entry) => {
        const employeeId = readNumber(entry, ["id", "employee_id", "employeeId"])
        return employeeId !== null && employeeId === readNumber(row, ["employee_id", "employeeId"])
      }) ??
      row
    const employeeId = readNumber(employee, ["id", "employee_id", "employeeId"]) ?? readNumber(row, ["employee_id"])
    if (employeeId === null) {
      showErrorAlert("Unable to start onboarding because the employee is missing.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const name = getEmployeeDisplayName(employee) || formatEmployeeOptionLabel(employee, employeeId)
      await ensureDraftOnboardingRequest(token, {
        employee_id: employeeId,
        workflow_id: defaultOnboardingWorkflowId(workflows) ?? undefined,
        title: name && name !== "Unknown employee" ? `Onboarding for ${name}` : "Onboarding",
      })
      showSuccessAlert("Onboarding request created.")
      await reloadAll("requests", true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to start onboarding."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitRequest() {
    if (!canCreateOnboardingRequests) {
      showErrorAlert("You do not have permission to create onboarding requests.")
      return
    }

    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    if (!requestForm.employee_id || !requestForm.title.trim()) {
      showErrorAlert("Employee and title are required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const selectedEmployee =
        employees.find(
          (row) => readNumber(row, ["id", "employee_id", "user_id"]) === Number(requestForm.employee_id)
        ) ?? null
      const fallbackEmployeeNo = readString(selectedEmployee ?? {}, [
        "employee_no",
        "employee_number",
        "employee_code",
        "user_no",
      ])
      const provisioningResult = requestProvisioningEnabled
        ? buildOnboardingProvisioningPayload(requestProvisioning, {
            fallbackEmployeeNo: fallbackEmployeeNo !== "-" ? fallbackEmployeeNo : undefined,
          })
        : {}
      if (provisioningResult.error) {
        throw new Error(provisioningResult.error)
      }

      const createdRequest = await createOnboardingRequest(token, {
        employee_id: Number(requestForm.employee_id),
        workflow_id: requestForm.workflow_id ? Number(requestForm.workflow_id) : undefined,
        title: requestForm.title.trim(),
        description: requestForm.description.trim(),
        planned_start_date: requestForm.planned_start_date || undefined,
        planned_completion_date: requestForm.planned_completion_date || undefined,
        submit: requestForm.submit === "true",
        provisioning: provisioningResult.provisioning,
      })
      if (requestForm.submit === "true") {
        const createdRecord = toRecord(createdRequest)
        const createdRequestId = readNumber(createdRecord ?? {}, ["id", "request_id"])
        const createdStatus = readString(createdRecord ?? {}, [
          "status",
          "request_status",
          "onboarding_status",
          "workflow_status",
        ])
        let submittedRequest: unknown = createdRequest
        if (createdRequestId !== null && (isOnboardingDraftStatus(createdStatus) || createdStatus === "-")) {
          submittedRequest = await submitOnboardingRequest(token, createdRequestId, {
            allow_incomplete_employee_details: true,
          })
        }
        void notifySubmittedRequestApprovers({
          kind: "onboarding_request",
          token,
          request: submittedRequest,
          requesterName: selectedEmployee
            ? formatEmployeeOptionLabel(selectedEmployee, Number(requestForm.employee_id))
            : undefined,
          loadRequest: createdRequestId === null ? undefined : () => getOnboardingRequest(token, createdRequestId),
        })
      }

      resetRequestForm()
      setRequestSheetOpen(false)
      showSuccessAlert("Onboarding request created.")
      await reloadAll(activeTab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create onboarding request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function runRequestAction(requestId: number | null, action: RequestAction) {
    if (requestId === null) {
      return
    }

    if (action === "submit" && !canCreateOnboardingRequests && !canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to submit onboarding requests.")
      return
    }
    if (action === "approve" || action === "reject") {
      if (!canApproveOnboardingRequests) {
        showErrorAlert("You do not have permission to approve onboarding requests.")
        return
      }
    }
    if (action === "cancel" && !canCancelOnboardingRequests) {
      showErrorAlert("You do not have permission to cancel onboarding requests.")
      return
    }
    if (action === "complete" && !canCompleteOnboardingRequests) {
      showErrorAlert("You do not have permission to complete onboarding requests.")
      return
    }
    if (action === "delete" && !canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to delete onboarding requests.")
      return
    }

    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (action === "submit") {
        const sourceRow =
          requests.find((row) => readNumber(row, ["id", "request_id"]) === requestId) ??
          selectedRequestRow ??
          selectedRequestDetails
        const submittedRequest = await submitOnboardingRequest(token, requestId, {
          allow_incomplete_employee_details: allowIncompleteWorkflowStart,
        })
        void notifySubmittedRequestApprovers({
          kind: "onboarding_request",
          token,
          request: submittedRequest ?? sourceRow,
          loadRequest: () => getOnboardingRequest(token, requestId),
        })
      } else if (action === "approve") {
        await approveOnboardingRequest(token, requestId, {
          approve: true,
          comments: "Approved",
        })
      } else if (action === "reject") {
        await rejectOnboardingRequest(token, requestId, {
          comments: "Rejected",
        })
      } else if (action === "cancel") {
        await cancelOnboardingRequest(token, requestId, {
          reason: "Cancelled by admin",
        })
      } else if (action === "complete") {
        await completeOnboardingRequest(token, requestId)
      } else if (action === "delete") {
        await deleteOnboardingRequest(token, requestId)
      }

      if (action === "approve") {
        showSuccessAlert("Approval recorded for this level.")
      } else if (action === "submit") {
        showSuccessAlert("Onboarding request submitted. It can now be approved.")
      } else {
        showSuccessAlert(
          action === "delete" ? "Onboarding request removed from list." : `Onboarding request ${action}d successfully.`
        )
      }
      await reloadAll(activeTab, true)
      if (requestDetailsOpen && readCurrentRequestId() === requestId) {
        await openRequestDetails({
          ...(selectedRequestRow ?? {}),
          id: requestId,
          request_id: requestId,
        })
      }
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : `Failed to ${action} request.`
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  const requestTimelineNodes = React.useMemo(() => {
    if (!selectedRequestRow) {
      return []
    }

    const progressRecord = selectedRequestProgress ?? {}
    const detailRecord = selectedRequestDetails ?? {}
    const workflowRecord = toRecord(detailRecord.workflow ?? detailRecord.assigned_workflow ?? null)

    const progressSteps = toRecordList(
      progressRecord.steps ??
        progressRecord.workflow_steps ??
        progressRecord.progress_steps ??
        progressRecord.activities ??
        progressRecord.tasks
    )
    const workflowSteps =
      selectedWorkflowSteps.length > 0
        ? selectedWorkflowSteps
        : toRecordList(workflowRecord?.steps ?? workflowRecord?.workflow_steps ?? null)
    const requestSteps = toRecordList(
      detailRecord.steps ?? detailRecord.workflow_steps ?? detailRecord.tasks ?? detailRecord.activities
    )

    const seed = workflowSteps.length ? workflowSteps : progressSteps.length ? progressSteps : requestSteps
    const progressByKey = new Map<string, AdminRecord>()
    const addProgressEntry = (entry: AdminRecord) => {
      const keys = [
        readString(entry, ["id", "step_id", "task_id", "approval_level"]),
        readString(entry, ["step_name", "name", "title", "task_title"]),
      ]
      keys
        .filter((key) => key && key !== "-")
        .forEach((key) => {
          progressByKey.set(String(key).toLowerCase(), entry)
        })
    }
    progressSteps.forEach(addProgressEntry)
    requestSteps.forEach(addProgressEntry)

    const nodes = seed.map((step, index) => {
      const stepIdKey = readString(step, ["id", "step_id", "task_id", "approval_level"]).toLowerCase()
      const stepNameKey = readString(step, ["step_name", "name", "title", "task_title"]).toLowerCase()
      const matchedProgress = progressByKey.get(stepIdKey) ?? progressByKey.get(stepNameKey) ?? null
      const source = matchedProgress ?? step
      const stepStatus = String(
        source.status ??
          source.step_status ??
          source.approval_status ??
          source.state ??
          (index === 0 ? "pending" : "queued")
      )
        .trim()
        .toLowerCase()
      const owner =
        resolveResponsibleParty(source) !== "-" ? resolveResponsibleParty(source) : resolveResponsibleParty(step)
      const actionLabel = readString(
        { ...step, ...source },
        ["name", "title", "step_name", "task_title", "action_type", "task_type"]
      )
      return {
        key: `${readString(step, ["id", "step_id", "task_id"])}-${index}`,
        index: index + 1,
        actionLabel: actionLabel === "-" ? `Step ${index + 1}` : actionLabel,
        status: stepStatus,
        owner,
        completedAt: toTimestamp(
          source.completed_at ?? source.done_at ?? source.approved_at ?? source.updated_at ?? source.executed_at
        ),
        required: String(step.is_required ?? source.is_required) === "true" || step.is_required === true,
      }
    })

    if (nodes.length === 0) {
      const fallbackStatus = String(
        readString(selectedRequestRow, ["status", "request_status", "onboarding_status", "workflow_status"])
      )
        .trim()
        .toLowerCase()
      return [
        {
          key: "fallback-step",
          index: 1,
          actionLabel: "Request Created",
          status: fallbackStatus || "pending",
          owner: readString(selectedRequestRow, ["employee_name", "full_name", "name"]),
          completedAt: toTimestamp(readString(selectedRequestRow, ["updated_at", "created_at"])),
          required: true,
        },
      ]
    }

    return nodes
  }, [
    resolveResponsibleParty,
    selectedRequestDetails,
    selectedRequestProgress,
    selectedRequestRow,
    selectedWorkflowSteps,
  ])

  const approvalSummary = React.useMemo(
    () =>
      summarizeOnboardingApprovals([selectedRequestDetails, selectedRequestProgress, selectedRequestRow], roles, users),
    [roles, selectedRequestDetails, selectedRequestProgress, selectedRequestRow, users]
  )

  const displayedRequestDocuments = React.useMemo<AdminRecord[]>(
    () => [
      ...selectedRequestDocuments.map((document) => ({ ...document, source: "onboarding" })),
      ...toRecordList(selectedRequestDetails?.employee_documents).map((document) => ({
        ...document,
        source: "employee_profile",
      })),
    ],
    [selectedRequestDetails, selectedRequestDocuments]
  )

  const selectedRequestProvisioningSummary = React.useMemo(() => {
    const detailProvisioning = extractProvisioning(selectedRequestDetails)
    const rowProvisioning = extractProvisioning(selectedRequestRow)
    const provisioning = detailProvisioning ?? rowProvisioning
    const metadata = extractMetadata(selectedRequestDetails) ?? extractMetadata(selectedRequestRow)
    if (!provisioning && !metadata) {
      return null
    }

    const roleIds = Array.isArray(provisioning?.role_ids)
      ? provisioning.role_ids.filter((value): value is number => typeof value === "number")
      : []
    const branchAccessIds = Array.isArray(provisioning?.branch_access_ids)
      ? provisioning.branch_access_ids.filter((value): value is number => typeof value === "number")
      : []
    const shiftAssignment = provisioning?.shift_assignment
    const timetableAssignment = provisioning?.timetable_assignment
    const deviceAssignment = provisioning?.device_assignment

    return {
      rawProvisioning: provisioning,
      roleLabels:
        roleIds.length > 0
          ? roleIds.map((id) =>
              resolveProvisioningLabel(roles, id, ["id", "role_id"], ["display_name", "name", "title"])
            )
          : [],
      branchAccessLabels:
        branchAccessIds.length > 0
          ? branchAccessIds.map((id) => resolveProvisioningLabel(branches, id, ["id", "branch_id"], ["name", "title"]))
          : [],
      attendanceMode:
        provisioning?.attendance_mode && String(provisioning.attendance_mode).trim()
          ? toTitleCaseWords(String(provisioning.attendance_mode))
          : "-",
      shiftLabel: shiftAssignment?.shift_id
        ? resolveProvisioningLabel(
            shiftRecords,
            shiftAssignment.shift_id,
            ["id", "shift_id"],
            ["name", "title", "code"]
          )
        : "-",
      shiftEffectiveFrom: shiftAssignment?.effective_from || "-",
      shiftEffectiveTo: shiftAssignment?.effective_to || "-",
      rotationGroupLabel: shiftAssignment?.rotation_group_id
        ? resolveProvisioningLabel(
            rotationGroupRecords,
            shiftAssignment.rotation_group_id,
            ["id", "rotation_group_id", "rotationGroupId", "shift_rotation_group_id"],
            ["name", "title", "rotation_group_name", "code"]
          )
        : "-",
      timetableLabel: timetableAssignment?.timetable_id
        ? resolveProvisioningLabel(
            timetableRecords,
            timetableAssignment.timetable_id,
            ["id", "timetable_id"],
            ["name", "title", "code"]
          )
        : "-",
      timetableEffectiveFrom: timetableAssignment?.effective_from || "-",
      timetableEffectiveTo: timetableAssignment?.effective_to || "-",
      deviceConfigured: deviceAssignment ? "Configured" : "Not configured",
      deviceEmployeeNo: deviceAssignment?.employee_no || "-",
      accessGroupLabel: deviceAssignment?.access_group_id
        ? resolveProvisioningLabel(
            accessGroups,
            deviceAssignment.access_group_id,
            ["id", "access_group_id"],
            ["name", "title"]
          )
        : "-",
      organizationLabel: deviceAssignment?.organization_id
        ? resolveProvisioningLabel(
            accessOrganizations,
            deviceAssignment.organization_id,
            ["id", "organization_id"],
            ["name", "title"]
          )
        : "-",
      validEnabled: deviceAssignment?.valid_enabled ? "Yes" : "No",
      validBeginTime: deviceAssignment?.valid_begin_time || "-",
      validEndTime: deviceAssignment?.valid_end_time || "-",
      userVerifyMode: deviceAssignment?.user_verify_mode || "-",
      localUiRight: deviceAssignment?.local_ui_right ? "Yes" : "No",
      closeDelayEnabled: deviceAssignment?.close_delay_enabled ? "Yes" : "No",
      maxOpenDoorTime:
        typeof deviceAssignment?.max_open_door_time === "number" ? String(deviceAssignment.max_open_door_time) : "-",
      openDoorTime:
        typeof deviceAssignment?.open_door_time === "number" ? String(deviceAssignment.open_door_time) : "-",
      syncNow: deviceAssignment?.sync_now ? "Yes" : "No",
      continueOnError: deviceAssignment?.continue_on_error ? "Yes" : "No",
      deviceLabels:
        Array.isArray(deviceAssignment?.device_ids) && deviceAssignment.device_ids.length > 0
          ? deviceAssignment.device_ids.map((id) =>
              resolveProvisioningLabel(
                attendanceDevices,
                id,
                ["id", "device_id"],
                ["device_name", "name", "title", "device_code", "device_serial_number", "serial_no"]
              )
            )
          : [],
      metadata,
    }
  }, [
    accessGroups,
    accessOrganizations,
    attendanceDevices,
    branches,
    resolveProvisioningLabel,
    roles,
    rotationGroupRecords,
    selectedRequestDetails,
    selectedRequestRow,
    shiftRecords,
    timetableRecords,
  ])

  const resolveRequestTaskOwner = React.useCallback(
    (task: AdminRecord) => {
      const nestedUser = toRecord(task.assigned_company_user) ?? toRecord(task.assignee) ?? toRecord(task.user) ?? null
      const nestedPerson = personDisplayName(nestedUser)
      if (nestedPerson) {
        return nestedPerson
      }

      const assignedUserId = readNumber(task, ["assigned_company_user_id", "assigned_user_id", "user_id"])
      if (assignedUserId !== null) {
        const userLabel = resolveOptionLabel(
          users,
          assignedUserId,
          ["id", "company_user_id", "user_id"],
          ["full_name", "name", "email"]
        )
        if (userLabel !== "-") {
          return userLabel
        }
      }

      const nestedDepartment = toRecord(task.assigned_department) ?? toRecord(task.department) ?? null
      if (nestedDepartment) {
        const nestedLabel = readString(nestedDepartment, ["name", "title"])
        if (nestedLabel !== "-") {
          return `Department: ${nestedLabel}`
        }
      }

      const assignedDepartmentId = readNumber(task, ["assigned_department_id", "department_id"])
      if (assignedDepartmentId !== null) {
        const departmentLabel = resolveOptionLabel(
          departments,
          assignedDepartmentId,
          ["id", "department_id"],
          ["name", "title"]
        )
        if (departmentLabel !== "-") {
          return `Department: ${departmentLabel}`
        }
      }

      return "-"
    },
    [departments, users]
  )

  function readCurrentRequestId() {
    return readNumber(selectedRequestDetails ?? selectedRequestRow ?? {}, ["id", "request_id"])
  }

  const employeeDetailsReview = React.useMemo(() => {
    const review = toRecord(selectedRequestDetails?.employee_details_review)
    const sections = toRecordList(review?.sections)
    return {
      status: readString(review ?? {}, ["status"], "not_submitted").toLowerCase(),
      submittedAt: readString(review ?? {}, ["submitted_at"]),
      notProvidedItems: Array.isArray(review?.not_provided_items)
        ? review.not_provided_items.filter((item): item is string => typeof item === "string")
        : [],
      sections,
    }
  }, [selectedRequestDetails])
  const employeeDetailsReviewCounts = React.useMemo(
    () =>
      employeeDetailsReview.sections.reduce<{
        approved: number
        changesRequested: number
        pending: number
      }>(
        (counts, section) => {
          const status = readString(section, ["status"], "pending").toLowerCase()
          if (status === "approved") counts.approved += 1
          else if (status === "changes_requested") counts.changesRequested += 1
          else counts.pending += 1
          return counts
        },
        { approved: 0, changesRequested: 0, pending: 0 }
      ),
    [employeeDetailsReview.sections]
  )
  const currentEmployeeReviewSection = employeeDetailsReview.sections[employeeReviewStep] ?? null
  const currentEmployeeReviewStatus = readString(currentEmployeeReviewSection ?? {}, ["status"], "pending").toLowerCase()
  const selectedRequestSummary = React.useMemo(() => {
    const request = selectedRequestDetails ?? selectedRequestRow ?? {}
    const employee = toRecord(request.employee)
    const employeeId = readNumber(request, ["employee_id"])
    const nestedName = personDisplayName(employee)
    const employeeNumber = readString(employee ?? {}, ["employee_no", "employee_number"], "")
    const rowName = readString(request, ["employee_name", "employee_full_name"], "")
    const fallbackName = resolveEmployeeLabel(employeeId)
    const name = nestedName || (rowName !== "-" ? rowName : "") || fallbackName
    return {
      employee: employeeNumber && employeeNumber !== "-" ? `${name} (${employeeNumber})` : name,
      status: readString(request, ["status", "request_status"], "Not available"),
      updated: toTimestamp(request.updated_at ?? request.modified_at ?? request.created_at),
    }
  }, [employees, selectedRequestDetails, selectedRequestRow])

  async function saveEmployeeDetailReview(status: "approved" | "changes_requested") {
    if (!canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to review employee details.")
      return
    }
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const sectionKey = currentEmployeeReviewSection ? readString(currentEmployeeReviewSection, ["key"]) : ""
    const comment = employeeReviewComments[sectionKey]?.trim() ?? ""
    if (!token || requestId === null || !sectionKey || sectionKey === "-") {
      showErrorAlert("Missing employee review context.")
      return
    }
    if (status === "approved" && currentEmployeeReviewStatus === "approved") {
      return
    }
    if (status === "changes_requested" && !comment) {
      showErrorAlert("Explain what the employee needs to correct before returning this section.")
      return
    }

    setSaving(true)
    try {
      await reviewOnboardingEmployeeDetails(token, requestId, [
        {
          section_key: sectionKey,
          status,
          comment: comment || undefined,
        },
      ])
      showSuccessAlert(
        status === "approved" ? "Section verified." : "Section returned to the employee with your reason."
      )
      const nextStep = Math.min(employeeReviewStep + 1, Math.max(employeeDetailsReview.sections.length - 1, 0))
      await reloadCurrentRequestActivity(requestId)
      setEmployeeReviewStep(nextStep)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to save the review decision.")
    } finally {
      setSaving(false)
    }
  }

  async function reloadCurrentRequestActivity(requestId?: number | null) {
    const id = requestId ?? readCurrentRequestId()
    if (id === null) {
      return
    }
    await reloadAll("requests", true)
    await openRequestDetails({
      ...(selectedRequestRow ?? {}),
      id,
      request_id: id,
    })
  }

  async function submitRequestDocument() {
    if (!canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to manage onboarding documents.")
      return
    }

    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }
    if (!documentForm.title.trim()) {
      showErrorAlert("Document title is required.")
      return
    }
    if (!documentForm.document_type) {
      showErrorAlert("Select the type of document being uploaded.")
      return
    }
    if (!documentUploadFile) {
      showErrorAlert("Choose a document file before uploading.")
      return
    }

    setSaving(true)
    try {
      const file = await fileToBase64UploadDto(documentUploadFile)
      await uploadOnboardingDocument(token, requestId, {
        title: documentForm.title.trim(),
        description: documentForm.description.trim() || undefined,
        document_type: documentForm.document_type || undefined,
        expiry_date: documentForm.expiry_date || undefined,
        file,
      })
      showSuccessAlert("Onboarding document uploaded.")
      resetDocumentForm()
      setShowDocumentComposer(false)
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to upload document.")
    } finally {
      setSaving(false)
    }
  }

  async function viewRequestDocument(documentRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const employeeId = readNumber(selectedRequestDetails ?? selectedRequestRow ?? {}, ["employee_id"])
    const documentId = readNumber(documentRow, ["id", "document_id"])
    const source = readString(documentRow, ["source"], "onboarding").toLowerCase()
    if (!token || documentId === null) {
      showErrorAlert("Missing document identifiers.")
      return
    }
    if (source === "employee_profile" && employeeId === null) {
      showErrorAlert("Missing employee information for this document.")
      return
    }
    if (source !== "employee_profile" && requestId === null) {
      showErrorAlert("Missing onboarding request information for this document.")
      return
    }

    setSaving(true)
    try {
      const result =
        source === "employee_profile"
          ? await downloadEmployeeDocument(token, employeeId!, documentId)
          : await downloadOnboardingDocument(token, requestId!, documentId)
      const url = window.URL.createObjectURL(result.blob)
      const mimeType = result.contentType ?? readString(documentRow, ["mime_type"], "")
      const canPreview = mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/")
      const link = document.createElement("a")
      link.href = url
      if (canPreview) {
        link.target = "_blank"
        link.rel = "noopener noreferrer"
      } else {
        link.download = result.filename
      }
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to open document.")
    } finally {
      setSaving(false)
    }
  }

  async function setRequestDocumentVerified(documentRow: AdminRecord, isVerified: boolean) {
    if (!canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to verify onboarding documents.")
      return
    }

    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const documentId = readNumber(documentRow, ["id", "document_id"])
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Missing document identifiers.")
      return
    }

    setSaving(true)
    try {
      await verifyOnboardingDocument(token, requestId, documentId, {
        is_verified: isVerified,
      })
      showSuccessAlert(isVerified ? "Document verified." : "Document marked unverified.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to update document verification.")
    } finally {
      setSaving(false)
    }
  }

  async function removeRequestDocument(documentRow: AdminRecord) {
    if (!canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to delete onboarding documents.")
      return
    }

    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const documentId = readNumber(documentRow, ["id", "document_id"])
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Missing document identifiers.")
      return
    }
    if (typeof window !== "undefined" && !window.confirm("Delete this onboarding document?")) {
      return
    }

    setSaving(true)
    try {
      await deleteOnboardingDocument(token, requestId, documentId)
      showSuccessAlert("Onboarding document deleted.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to delete document.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestTask() {
    if (!canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to manage onboarding tasks.")
      return
    }

    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }
    const assetItems = taskForm.asset_items.map((item) => item.trim())
    if (taskForm.task_type !== "asset" && !taskForm.title.trim()) {
      showErrorAlert("Task title is required.")
      return
    }
    if (taskForm.task_type === "asset" && (assetItems.length === 0 || assetItems.some((item) => !item))) {
      showErrorAlert("Enter a name for every item to provide.")
      return
    }
    if (taskForm.task_type === "asset" && !taskForm.assigned_department_id) {
      showErrorAlert("Select the department responsible for providing these items.")
      return
    }

    setSaving(true)
    try {
      const titles = taskForm.task_type === "asset" ? assetItems : [taskForm.title.trim()]
      for (const title of titles) {
        await createOnboardingTask(token, requestId, {
          title,
          description: taskForm.description.trim() || undefined,
          task_type: taskForm.task_type || "general",
          assigned_company_user_id:
            taskForm.assigned_company_user_id && Number(taskForm.assigned_company_user_id) > 0
              ? Number(taskForm.assigned_company_user_id)
              : undefined,
          assigned_department_id:
            taskForm.assigned_department_id && Number(taskForm.assigned_department_id) > 0
              ? Number(taskForm.assigned_department_id)
              : undefined,
          due_date: taskForm.due_date || undefined,
        })
      }
      showSuccessAlert(
        taskForm.task_type === "asset"
          ? `${titles.length} item${titles.length === 1 ? "" : "s"} added and assigned.`
          : "Onboarding task created."
      )
      resetTaskForm()
      setShowTaskComposer(false)
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create task.")
    } finally {
      setSaving(false)
    }
  }

  async function completeRequestTask(taskRow: AdminRecord) {
    if (!canUpdateOnboardingRequests && !canCompleteOnboardingRequests) {
      showErrorAlert("You do not have permission to complete onboarding tasks.")
      return
    }

    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const taskId = readNumber(taskRow, ["id", "task_id"])
    if (!token || requestId === null || taskId === null) {
      showErrorAlert("Missing task identifiers.")
      return
    }

    setSaving(true)
    try {
      await completeOnboardingTask(token, requestId, taskId, {
        completion_notes: "Completed from onboarding workspace",
      })
      showSuccessAlert("Onboarding task completed.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to complete task.")
    } finally {
      setSaving(false)
    }
  }

  function openApprovalAssignmentDialog(approvalRow: AdminRecord) {
    if (!canUpdateOnboardingRequests) {
      showErrorAlert("You do not have permission to change onboarding approvers.")
      return
    }
    const status = readString(approvalRow, ["status", "approval_status"]).toLowerCase()
    if (status !== "pending") {
      showErrorAlert("Only a pending approval can be reassigned.")
      return
    }
    setApprovalToReassign(approvalRow)
    setReplacementApproverId("")
    setApprovalReassignmentReason("")
    setRequestDetailsOpen(false)
    setApprovalAssignmentDialogOpen(true)
    void ensureLookups(["users"], true)
  }

  async function saveApprovalAssignment() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const approvalId = readNumber(approvalToReassign ?? {}, ["id", "approval_id"])
    if (!token || requestId === null || approvalId === null) {
      showErrorAlert("Missing approval identifiers.")
      return
    }
    if (replacementApproverMembershipId === null) {
      showErrorAlert("Select the replacement approver.")
      return
    }
    if (replacementApproverMissingPermission) {
      showErrorAlert("The replacement person needs onboarding_requests:approve before being assigned.")
      return
    }
    if (!approvalReassignmentReason.trim()) {
      showErrorAlert("Enter a reason for changing the approver.")
      return
    }
    setSaving(true)
    try {
      await delegateOnboardingApproval(token, requestId, approvalId, {
        delegate_company_user_id: replacementApproverMembershipId,
        reason: approvalReassignmentReason,
      })
      setApprovalAssignmentDialogOpen(false)
      setApprovalToReassign(null)
      showSuccessAlert("Approver changed successfully.")
      await reloadCurrentRequestActivity(requestId)
      setRequestDetailsOpen(true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to change the approver.")
    } finally {
      setSaving(false)
    }
  }

  async function openRequestDetails(row: AdminRecord) {
    const requestId = readNumber(row, ["id", "request_id"])
    if (requestId === null) {
      showErrorAlert("Unable to open request details because request ID is missing.")
      return
    }

    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSelectedRequestRow(row)
    setRequestDetailsOpen(true)
    setRequestDetailsLoading(true)
    setSelectedRequestDetails(null)
    setSelectedRequestProgress(null)
    setSelectedRequestAuditLogs([])
    setSelectedRequestDocuments([])
    setSelectedRequestTasks([])
    setSelectedWorkflowSteps([])
    setEmployeeReviewStep(0)
    setEmployeeReviewComments({})
    setAllowIncompleteWorkflowStart(false)
    setShowDocumentComposer(false)
    setShowTaskComposer(false)
    resetDocumentForm()
    resetTaskForm()

    try {
      const lookupKeys: OnboardingLookupKey[] = []
      if (canReadRoles) lookupKeys.push("roles")
      if (canReadCompanyUsers) lookupKeys.push("users")
      const lookupsPromise = lookupKeys.length > 0 ? loadLookups(token, lookupKeys) : Promise.resolve()
      const [detail, progress, auditLogs, documents, tasks] = await Promise.all([
        getOnboardingRequest(token, requestId),
        getOnboardingProgress(token, requestId),
        getOnboardingAuditLogs(token, requestId),
        canReadOnboardingDocuments ? listOnboardingDocuments(token, requestId) : Promise.resolve([]),
        canReadOnboardingTasks ? listOnboardingTasks(token, requestId) : Promise.resolve([]),
      ])
      await lookupsPromise
      setSelectedRequestDetails(detail)
      setSelectedRequestProgress(progress)
      setSelectedRequestAuditLogs(auditLogs)
      setSelectedRequestDocuments(documents)
      setSelectedRequestTasks(tasks)
      const detailReview = toRecord(detail?.employee_details_review)
      const detailSections = toRecordList(detailReview?.sections)
      setEmployeeReviewComments(
        Object.fromEntries(
          detailSections.map((section) => {
            const key = readString(section, ["key"])
            const comment = readString(section, ["comment"], "")
            return [key, comment === "-" ? "" : comment]
          })
        )
      )

      const assignedWorkflow = detail ? toRecord(detail.workflow ?? detail.assigned_workflow) : null
      const workflowId =
        (detail ? readNumber(detail, ["workflow_id", "onboarding_workflow_id"]) : null) ??
        readNumber(row, ["workflow_id", "onboarding_workflow_id"]) ??
        (assignedWorkflow ? readNumber(assignedWorkflow, ["id", "workflow_id"]) : null)
      if (workflowId !== null && canViewOnboardingWorkflows) {
        const workflow = await getOnboardingWorkflow(token, workflowId)
        if (workflow) {
          const workflowSteps = toRecordList(
            workflow.steps ?? workflow.workflow_steps ?? workflow.tasks ?? workflow.activities
          )
          setSelectedWorkflowSteps(workflowSteps)
        }
      }
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load request details."
      setError(message)
      showErrorAlert(message)
    } finally {
      setRequestDetailsLoading(false)
    }
  }

  const openedHighlightedRequestRef = React.useRef("")
  React.useEffect(() => {
    if (activeTab !== "requests" || !highlightedRequestId) {
      return
    }
    if (openedHighlightedRequestRef.current === highlightedRequestId) {
      return
    }

    const highlightedRow = requests.find(
      (row) => String(readNumber(row, ["id", "request_id"]) ?? "") === highlightedRequestId
    ) ?? { id: highlightedRequestId, request_id: highlightedRequestId }

    openedHighlightedRequestRef.current = highlightedRequestId
    void openRequestDetails(highlightedRow)
  }, [activeTab, highlightedRequestId, requests])

  function openChangeWorkflowDialog(row: AdminRecord) {
    const requestId = readNumber(row, ["id", "request_id"])
    const token = readStoredToken()
    if (!token || requestId === null) {
      showErrorAlert("Unable to change the workflow because the request ID is missing.")
      return
    }

    const currentWorkflowId = readNumber(row, ["workflow_id", "onboarding_workflow_id"])
    setChangeWorkflowRequest(row)
    setReplacementWorkflowId(currentWorkflowId === null ? "" : String(currentWorkflowId))
    setChangeWorkflowDialogOpen(true)

    void ensureLookups(["workflows"], true)
    void getOnboardingRequest(token, requestId)
      .then((detail) => {
        const resolved = detail ?? row
        const workflowId = readNumber(resolved, ["workflow_id", "onboarding_workflow_id"])
        setChangeWorkflowRequest({ ...row, ...resolved })
        setReplacementWorkflowId(workflowId === null ? "" : String(workflowId))
      })
      .catch((errorObject) => {
        showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to refresh the onboarding request.")
      })
  }

  async function saveRequestWorkflowChange() {
    const requestId = readNumber(changeWorkflowRequest ?? {}, ["id", "request_id"])
    const workflowId = Number(replacementWorkflowId)
    const currentWorkflowId = readNumber(changeWorkflowRequest ?? {}, ["workflow_id", "onboarding_workflow_id"])
    const token = readStoredToken()
    if (!token || requestId === null) {
      showErrorAlert("Missing onboarding request information.")
      return
    }
    if (!Number.isFinite(workflowId) || workflowId <= 0) {
      showErrorAlert("Select a replacement workflow.")
      return
    }
    if (workflowId === currentWorkflowId) {
      showErrorAlert("Select a different workflow.")
      return
    }

    setSaving(true)
    try {
      await patchOnboardingRequest(token, requestId, { workflow_id: workflowId })
      setChangeWorkflowDialogOpen(false)
      setChangeWorkflowRequest(null)
      showSuccessAlert("Onboarding workflow changed and pending assignments were refreshed.")
      await reloadAll("requests", true)
      if (requestDetailsOpen && readCurrentRequestId() === requestId) {
        await reloadCurrentRequestActivity(requestId)
      }
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to change the workflow.")
    } finally {
      setSaving(false)
    }
  }

  function renderOnboardingRequestActions(row: AdminRecord) {
    const pendingEmployee = isPendingOnboardingRow(row)
    const requestId = pendingEmployee ? null : readNumber(row, ["id", "request_id"])
    const requestStatus = String(
      readString(row, ["status", "request_status", "onboarding_status", "workflow_status"])
    ).toLowerCase()
    const isCancelled = requestStatus === "cancelled"
    const isCompleted = requestStatus === "completed" || requestStatus === "rejected"
    const isDraft = isOnboardingDraftStatus(requestStatus)
    const allowedActions = parseAllowedActions(row)
    const rowApprovalSummary = summarizeOnboardingApprovals([row], roles, users)
    const hasPendingApproval = rowApprovalSummary.pending.length > 0
    const canSubmit =
      !pendingEmployee &&
      (canCreateOnboardingRequests || canUpdateOnboardingRequests) &&
      isDraft &&
      !isCancelled &&
      allowedActions.has("submit")
    const canApprove =
      !pendingEmployee &&
      canApproveOnboardingRequests &&
      !isDraft &&
      !isCancelled &&
      !isCompleted &&
      hasPendingApproval &&
      allowedActions.has("approve")
    const canReject =
      !pendingEmployee &&
      canApproveOnboardingRequests &&
      !isDraft &&
      !isCancelled &&
      !isCompleted &&
      hasPendingApproval &&
      allowedActions.has("reject")
    const canCancel =
      !pendingEmployee && canCancelOnboardingRequests && !isCancelled && !isCompleted && allowedActions.has("cancel")
    const canComplete =
      !pendingEmployee &&
      canCompleteOnboardingRequests &&
      !isCancelled &&
      !isCompleted &&
      allowedActions.has("complete")
    const canDelete = !pendingEmployee && canUpdateOnboardingRequests && allowedActions.has("delete")
    const canChangeWorkflow =
      !pendingEmployee &&
      canUpdateOnboardingRequests &&
      !isCancelled &&
      !isCompleted &&
      (isDraft || hasPendingApproval)

    return (
      <div
        className="flex min-h-8 flex-wrap items-center justify-end gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        {pendingEmployee ? (
          canCreateOnboardingRequests ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={saving}
              onClick={() => void startPendingOnboarding(row)}
            >
              Start
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Awaiting request</span>
          )
        ) : canSubmit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            title="Submit"
            aria-label="Submit"
            disabled={saving}
            onClick={() => void runRequestAction(requestId, "submit")}
          >
            <Send className="h-3.5 w-3.5" />
            Submit
          </Button>
        ) : null}
        {!pendingEmployee && canApprove ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            title="Approve"
            aria-label="Approve"
            disabled={saving}
            onClick={() => void runRequestAction(requestId, "approve")}
          >
            <BadgeCheck size={14} animation="path-loop" animateOnHover="path-loop" />
            Approve
          </Button>
        ) : null}
        {canReject ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            title="Reject"
            aria-label="Reject"
            disabled={saving}
            onClick={() => void runRequestAction(requestId, "reject")}
          >
            <CircleX size={14} animation="default" animateOnHover="default" />
            Reject
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            title="Cancel"
            aria-label="Cancel"
            disabled={saving}
            onClick={() => void runRequestAction(requestId, "cancel")}
          >
            <Ban className="h-3.5 w-3.5" />
            Cancel
          </Button>
        ) : null}
        {canComplete ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-[11px]"
            title="Complete"
            aria-label="Complete"
            disabled={saving}
            onClick={() => void runRequestAction(requestId, "complete")}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Complete
          </Button>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] text-rose-600"
            title="Delete"
            aria-label="Delete"
            disabled={saving}
            onClick={() => void runRequestAction(requestId, "delete")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {canChangeWorkflow ? (
          <button
            type="button"
            className="admin-table-icon-button"
            title="Change workflow"
            aria-label="Change workflow"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => openChangeWorkflowDialog(row)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {!pendingEmployee &&
        !canSubmit &&
        !canApprove &&
        !canReject &&
        !canCancel &&
        !canComplete &&
        !canDelete &&
        !canChangeWorkflow ? (
          <span className="text-[11px] text-muted-foreground">No actions</span>
        ) : null}
      </div>
    )
  }

  const invitationColumns: Column<AdminRecord>[] = [
    {
      key: "name",
      label: "Invitee",
      defaultWidth: 170,
      render: (row) => invitationDisplayName(row),
    },
    {
      key: "email",
      label: "Email",
      defaultWidth: 210,
      render: (row) => readString(row, ["email"]),
    },
    {
      key: "phone",
      label: "Phone",
      defaultWidth: 145,
      render: (row) => readString(row, ["phone"]),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 105,
      render: (row) => {
        const status = invitationEffectiveStatus(row)
        return (
          <span
            className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", statusBadgeClass(status))}
          >
            {toTitleCaseWords(status || "-")}
          </span>
        )
      },
    },
    {
      key: "delivery",
      label: "Delivery",
      defaultWidth: 170,
      sortable: false,
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {(["email", "sms"] as const).map((channel) => {
            const status = invitationDeliveryStatus(row, channel)
            return (
              <span
                key={channel}
                className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", statusBadgeClass(status))}
              >
                {channel.toUpperCase()}: {toTitleCaseWords(status)}
              </span>
            )
          })}
        </div>
      ),
    },
    {
      key: "created_at",
      label: "Sent",
      defaultWidth: 155,
      render: (row) => formatInvitationDate(row.created_at ?? row.createdAt),
    },
    {
      key: "expires_at",
      label: "Expires",
      defaultWidth: 155,
      render: (row) => formatInvitationDate(row.expires_at ?? row.expiresAt),
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 110,
      sortable: false,
      render: (row) => {
        const invitationId = readNumber(row, ["id", "invitation_id"])
        const resending = invitationId !== null && resendingInvitationId === invitationId
        if (!canResendPendingInvitations) {
          return <span className="text-[11px] text-muted-foreground">View only</span>
        }
        if (!canResendInvitation(row)) {
          return <span className="text-[11px] text-muted-foreground">-</span>
        }
        return (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={invitationId === null || resending}
            onClick={() => void resendPendingInvitation(row)}
          >
            <Send className={cn("mr-1.5 h-3.5 w-3.5", resending ? "animate-pulse" : "")} />
            {resending ? "Sending..." : "Resend"}
          </Button>
        )
      },
    },
  ]

  const onboardingRequestColumns: Column<AdminRecord>[] = [
    {
      key: "id",
      label: "ID",
      defaultWidth: 90,
      render: (row) => {
        const requestId = isPendingOnboardingRow(row) ? null : readNumber(row, ["id", "request_id"])
        const requestNo = readString(row, ["onboarding_no", "request_no", "request_code"])
        return (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{requestId ?? "-"}</p>
            {requestNo !== "-" ? <p className="truncate text-[11px] text-muted-foreground">{requestNo}</p> : null}
          </div>
        )
      },
    },
    {
      key: "employee",
      label: "Employee",
      defaultWidth: 140,
      render: (row) => requestRowEmployeeLabel(row),
    },
    {
      key: "title",
      label: "Title",
      defaultWidth: 180,
      render: (row) => readString(row, ["title", "name"]),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 120,
      render: (row) => {
        const requestStatus = String(
          readString(row, ["status", "request_status", "onboarding_status", "workflow_status"])
        ).toLowerCase()
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(requestStatus)}`}
          >
            {toTitleCaseWords(readString(row, ["status"]))}
          </span>
        )
      },
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 220,
      sortable: false,
      render: (row) => renderOnboardingRequestActions(row),
    },
  ]

  const onboardingWorkflowColumns: Column<AdminRecord>[] = [
    {
      key: "id",
      label: "ID",
      defaultWidth: 80,
      render: (row) => readNumber(row, ["id", "workflow_id"]) ?? "-",
    },
    {
      key: "name",
      label: "Name",
      defaultWidth: 160,
      render: (row) => readString(row, ["name", "title"]),
    },
    {
      key: "description",
      label: "Description",
      defaultWidth: 220,
      render: (row) => (
        <span className="block max-w-full truncate text-xs text-slate-600" title={readString(row, ["description"])}>
          {readString(row, ["description"])}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 110,
      render: (row) => {
        const workflowStatus = readString(row, ["status"])
        return (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(workflowStatus)}`}
          >
            {toTitleCaseWords(workflowStatus)}
          </span>
        )
      },
    },
    {
      key: "default",
      label: "Default",
      defaultWidth: 80,
      render: (row) => (asTruthyBoolean(row.is_default ?? row.default) ? "Yes" : "No"),
    },
    {
      key: "actions",
      label: "Actions",
      defaultWidth: 140,
      sortable: false,
      render: (row) => {
        const workflowId = readNumber(row, ["id", "workflow_id"])
        return (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            {canUpdateOnboardingWorkflows ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 px-0"
                onClick={() => void openEditWorkflowSheet(workflowId, row)}
                aria-label={`Edit workflow ${workflowId ?? ""}`}
                title="Edit workflow"
                disabled={saving}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canCreateOnboardingWorkflows ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 px-0"
                onClick={() => void cloneWorkflow(workflowId, row)}
                aria-label={`Clone workflow ${workflowId ?? ""}`}
                title="Clone workflow"
                disabled={saving}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canDeleteOnboardingWorkflows ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 px-0 text-rose-600"
                onClick={() => void removeWorkflow(workflowId)}
                aria-label={`Delete workflow ${workflowId ?? ""}`}
                title="Delete workflow"
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <section className="overflow-hidden border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-1 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
            Onboarding
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Manage invitations, employee onboarding requests, and reusable workflows
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted-foreground">
          {canViewPendingInvitations ? <span>{invitations.length} invitations</span> : null}
          {canViewOnboardingRequests ? <span>{filteredRequests.length} requests</span> : null}
          {canViewOnboardingWorkflows ? <span>{filteredWorkflows.length} workflows</span> : null}
        </div>
      </div>
      <div className="tab-rail-scroll bg-muted/[0.12] px-3">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {canViewPendingInvitations ? (
            <button
              type="button"
              onClick={() => setActiveTab("invitations")}
              className={cn(
                "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                activeTab === "invitations"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Pending Invitations
              {invitations.length > 0 ? ` (${invitations.length})` : ""}
            </button>
          ) : null}
          {canViewOnboardingRequests ? (
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={cn(
                "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                activeTab === "requests"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Requests
            </button>
          ) : null}
          {canViewOnboardingWorkflows ? (
            <button
              type="button"
              onClick={() => setActiveTab("workflows")}
              className={cn(
                "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                activeTab === "workflows"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Workflows
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {activeTab === "invitations" && canViewPendingInvitations ? (
        <div className="space-y-2">
          <ResizableTable
            title="Employee Invitations"
            data={filteredInvitations}
            columns={invitationColumns}
            loading={loading}
            storageKey="pending-employee-invitations"
            enableAnimations
            compact
            toolbarClassName="mb-0 border-b border-border bg-muted/[0.12] px-3 py-2"
            frameClassName="rounded-none border-0 shadow-none"
            itemsPerPage={15}
            showExport={false}
            getRowId={(row, index) => String(readNumber(row, ["id", "invitation_id"]) ?? index)}
            onRowSelect={(_, row) => setSelectedInvitation(row ?? null)}
            toolbarStart={
              <>
                <FluentSearchBox
                  size="small"
                  aria-label="Search invitations"
                  className="!w-[14rem] max-w-full shrink-0"
                  placeholder="Search name, email or phone"
                  value={invitationSearch}
                  onChange={(_event, data) => setInvitationSearch(data.value)}
                />
                <FluentSelect
                  ariaLabel="Filter invitation status"
                  size="small"
                  className="min-w-[8.5rem]"
                  value={invitationStatusFilter}
                  onChange={(value) =>
                    setInvitationStatusFilter(value as EmployeeInvitationHistoryStatus)
                  }
                  options={INVITATION_STATUS_FILTERS}
                />
              </>
            }
            toolbarActions={
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm disabled:opacity-60"
                onClick={() => void reloadAll("invitations", true)}
                disabled={loading}
                aria-label="Refresh pending invitations"
                title="Refresh"
              >
                <RefreshCw className={cn("size-3.5 text-primary", loading ? "animate-spin" : "")} />
              </button>
            }
          />
          <Sheet
            open={selectedInvitation !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedInvitation(null)
            }}
          >
            <SheetContent
              side="right"
              className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-[32rem] data-[side=right]:sm:max-w-none"
            >
              <SheetHeader>
                <SheetTitle>{invitationDisplayName(selectedInvitation)}</SheetTitle>
                <SheetDescription>
                  Invitation details and the latest result returned by each delivery channel.
                </SheetDescription>
              </SheetHeader>

              {selectedInvitation ? (
                <div className="space-y-5 px-4 pb-6">
                  <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                    {[
                      ["Status", toTitleCaseWords(invitationEffectiveStatus(selectedInvitation) || "-")],
                      ["Email", readString(selectedInvitation, ["email"])],
                      ["Phone", readString(selectedInvitation, ["phone"])],
                      ["Employment type", toTitleCaseWords(readString(selectedInvitation, ["employment_type"]))],
                      ["Created", formatInvitationDate(selectedInvitation.created_at ?? selectedInvitation.createdAt)],
                      ["Expires", formatInvitationDate(selectedInvitation.expires_at ?? selectedInvitation.expiresAt)],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {label}
                        </p>
                        <p className="mt-0.5 break-words text-sm text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {(["email", "sms"] as const).map((channel) => {
                    const status = invitationDeliveryStatus(selectedInvitation, channel)
                    const lastError = formatInvitationDeliveryError(
                      invitationDeliveryValue(selectedInvitation, channel, ["last_error", "lastError"])
                    )
                    const messageId = invitationDeliveryValue(selectedInvitation, channel, ["message_id", "messageId"])
                    const transport = invitationDeliveryValue(selectedInvitation, channel, ["transport"])
                    const deliveryService =
                      transport === "system_smtp" || (transport === "-" && channel === "email")
                        ? "Platform SMTP (MAIL_*)"
                        : transport === "company_smtp"
                          ? "Company SMTP"
                          : transport === "sms_gateway" || (transport === "-" && channel === "sms")
                            ? "SMS gateway"
                            : transport
                    const gatewayAccepted = channel === "sms" && ["accepted", "sent"].includes(status.toLowerCase())
                    const statusLabel = gatewayAccepted ? "Accepted by gateway" : toTitleCaseWords(status)
                    const failureReason =
                      lastError !== "-"
                        ? lastError
                        : status.toLowerCase() === "failed"
                          ? "The current backend did not return the stored failure reason. Deploy the backend update, then resend to capture the latest provider error."
                          : gatewayAccepted
                            ? "The SMS gateway accepted the request. Handset delivery is not confirmed because the gateway did not return a delivery receipt."
                            : "No failure recorded."
                    return (
                      <section key={channel} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground">
                            {channel === "email" ? "Email delivery" : "SMS delivery"}
                          </h3>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                              statusBadgeClass(status)
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <dl className="grid gap-2 text-xs">
                          <div>
                            <dt className="font-medium text-muted-foreground">Delivery service</dt>
                            <dd className="mt-0.5 text-foreground">{deliveryService}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-muted-foreground">Provider reference</dt>
                            <dd className="mt-0.5 break-all text-foreground">{messageId}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-muted-foreground">
                              {gatewayAccepted ? "Delivery details" : "Failure reason"}
                            </dt>
                            <dd
                              className={cn(
                                "mt-0.5 whitespace-pre-wrap break-words",
                                status.toLowerCase() === "failed" ? "text-destructive" : "text-foreground"
                              )}
                            >
                              {failureReason}
                            </dd>
                          </div>
                        </dl>
                      </section>
                    )
                  })}

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    Invitation emails use the platform SMTP connection configured with MAIL_* settings. You can test it
                    from the dedicated{" "}
                    <Link href="/dashboard/smtp" className="font-semibold underline underline-offset-2">
                      SMTP page
                    </Link>
                    .
                  </div>

                  {canResendPendingInvitations ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          readNumber(selectedInvitation, ["id", "invitation_id"]) === null ||
                          resendingInvitationId === readNumber(selectedInvitation, ["id", "invitation_id"])
                        }
                        onClick={() => void resendPendingInvitation(selectedInvitation)}
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Resend invitation
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </SheetContent>
          </Sheet>
        </div>
      ) : activeTab === "requests" && canViewOnboardingRequests ? (
        <div className="space-y-2">
          <ResizableTable
            title="Onboarding Requests"
            data={filteredRequests}
            columns={onboardingRequestColumns}
            loading={loading}
            storageKey="onboarding-requests"
            enableAnimations
            compact
            toolbarClassName="mb-0 border-b border-border bg-muted/[0.12] px-3 py-2"
            frameClassName="rounded-none border-0 shadow-none"
            itemsPerPage={15}
            showExport={false}
            getRowId={(row, index) => {
              if (isPendingOnboardingRow(row)) {
                return `pending-${readNumber(row, ["employee_id", "employeeId"]) ?? index}`
              }
              return String(readNumber(row, ["id", "request_id"]) ?? index)
            }}
            onRowSelect={(_, row) => {
              if (!row || isPendingOnboardingRow(row)) {
                return
              }
              void openRequestDetails(row)
            }}
            toolbarStart={
              <>
                <FluentSearchBox
                  size="small"
                  aria-label="Search onboarding requests"
                  className="!w-[14rem] max-w-full shrink-0"
                  placeholder="Search name, email, phone, user no."
                  value={requestSearch}
                  onChange={(_event, data) => setRequestSearch(data.value)}
                />
                <FluentSelect
                  ariaLabel="Filter request status"
                  size="small"
                  className="min-w-[8.5rem]"
                  value={requestStatusFilter}
                  onChange={setRequestStatusFilter}
                  options={requestStatusOptions.map((status) => ({
                    value: status,
                    label: status === "all" ? "All statuses" : toTitleCaseWords(status),
                  }))}
                />
                {isEmployeeMode ? null : (
                  <FluentSelect
                    ariaLabel="Filter by employee"
                    size="small"
                    className="min-w-[9rem] max-w-[12rem]"
                    value={requestEmployeeFilter}
                    placeholder="All employees"
                    onChange={setRequestEmployeeFilter}
                    options={[
                      { value: "", label: "All employees" },
                      ...employees.flatMap((row) => {
                        const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
                        if (employeeId === null) return []
                        return [{ value: String(employeeId), label: resolveEmployeeLabel(employeeId) }]
                      }),
                    ]}
                  />
                )}
              </>
            }
            toolbarActions={
              <>
                {canCreateOnboardingRequests && !isEmployeeMode ? (
                  <Button
                    type="button"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => {
                      void openRequestSheet()
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create Request
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm disabled:opacity-60"
                  onClick={() => void reloadAll(activeTab, true)}
                  disabled={loading}
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw className={cn("size-3.5 text-primary", loading ? "animate-spin" : "")} />
                </button>
              </>
            }
          />

          <Sheet open={requestSheetOpen} onOpenChange={setRequestSheetOpen}>
            <SheetContent
              side="right"
              showCloseButton={false}
              className={cn(
                "gap-0 p-0",
                "data-[side=right]:w-[min(100vw-1rem,36rem)] data-[side=right]:max-w-[36rem]",
                "sm:data-[side=right]:max-w-[36rem]"
              )}
            >
              <div className="flex h-full min-h-0 flex-col bg-background">
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SheetTitle className="text-base font-semibold text-slate-900">
                      Create Onboarding Request
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Start onboarding for an employee. Fill the basics first; add provisioning only if they need system
                      access setup now.
                    </SheetDescription>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="About create onboarding request"
                          />
                        }
                      >
                        <CircleHelp className="h-3.5 w-3.5" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        align="start"
                        className="max-w-80 bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white"
                      >
                        Start onboarding for an employee. Fill the basics first; add provisioning only if they need
                        system access setup now.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                    onClick={() => setRequestSheetOpen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <div className="w-full space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                        Request title
                        <Input
                          className="h-9 bg-white text-slate-900 placeholder:text-slate-400"
                          value={requestForm.title}
                          onChange={(event) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              title: event.target.value,
                            }))
                          }
                          placeholder="e.g. Onboarding for Jane Doe"
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Employee
                        <Select
                          value={requestForm.employee_id}
                          onValueChange={(value) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              employee_id: value ?? "",
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                            <SelectValue placeholder="Select employee">
                              <span className="truncate text-slate-900">
                                {requestForm.employee_id
                                  ? resolveEmployeeLabel(Number(requestForm.employee_id))
                                  : "Select employee"}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent
                            className={cn(selectPopupClassName, "min-w-[min(100vw-2rem,22rem)]")}
                            alignItemWithTrigger={false}
                            align="start"
                          >
                            {selectableEmployees.length === 0 ? (
                              <SelectItem value="__no_employees__" disabled className="text-slate-500">
                                No onboarding/pending employees
                              </SelectItem>
                            ) : (
                              selectableEmployees.map((row, index) => {
                                const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
                                if (employeeId === null) return null
                                const label = formatEmployeeOptionLabel(row, employeeId)
                                const searchBits = [
                                  label,
                                  getEmployeeDisplayName(row),
                                  readString(row, ["employee_no", "employee_number", "user_no", "employeeNo"]),
                                  readString(row, ["email", "work_email", "personal_email"]),
                                  getEmployeeEmploymentStatus(row),
                                  String(employeeId),
                                ]
                                  .filter((part) => part && part !== "-")
                                  .join(" ")
                                return (
                                  <SelectItem
                                    key={`create-req-employee-${employeeId}-${index}`}
                                    value={String(employeeId)}
                                    className="text-slate-900"
                                    data-search-text={searchBits}
                                  >
                                    {label}
                                  </SelectItem>
                                )
                              })
                            )}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Workflow
                        <Select
                          value={requestForm.workflow_id}
                          onValueChange={(value) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              workflow_id: value ?? "",
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                            <SelectValue placeholder="Optional">
                              <span className="truncate text-slate-900">
                                {requestForm.workflow_id
                                  ? resolveWorkflowLabel(Number(requestForm.workflow_id))
                                  : "Optional — pick a checklist"}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className={selectPopupClassName}>
                            {workflows.map((row) => {
                              const workflowId = readNumber(row, ["id", "workflow_id"])
                              if (workflowId === null) return null
                              return (
                                <SelectItem key={workflowId} value={String(workflowId)} className="text-slate-900">
                                  {readString(row, ["name", "title"])}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        When to start
                        <Select
                          value={requestForm.submit}
                          onValueChange={(value) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              submit: value ?? "true",
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                            <SelectValue placeholder="Submission mode">
                              {resolveBooleanLabel(requestForm.submit)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className={selectPopupClassName}>
                            <SelectItem value="true" className="text-slate-900">
                              Submit immediately
                            </SelectItem>
                            <SelectItem value="false" className="text-slate-900">
                              Save as draft
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Planned start
                        <DateInput
                          className="h-9"

                          value={requestForm.planned_start_date}
                          onChange={(event) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              planned_start_date: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Planned completion
                        <DateInput
                          className="h-9"

                          value={requestForm.planned_completion_date}
                          onChange={(event) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              planned_completion_date: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                        Description
                        <Input
                          className="h-9"
                          value={requestForm.description}
                          onChange={(event) =>
                            setRequestForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          placeholder="Optional notes for HR / managers"
                        />
                      </label>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="include-provisioning"
                          checked={requestProvisioningEnabled}
                          onCheckedChange={(value) => {
                            const checked = Boolean(value)
                            if (checked) {
                              void enableRequestProvisioning()
                              return
                            }
                            setRequestProvisioningEnabled(false)
                            setRequestProvisioning({
                              ...EMPTY_REQUEST_PROVISIONING,
                              shiftAssignment: {
                                ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT,
                              },
                              timetableAssignment: {
                                ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT,
                              },
                              deviceAssignment: {
                                ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT,
                              },
                            })
                          }}
                        />
                        <label htmlFor="include-provisioning" className="text-sm font-medium text-slate-900">
                          Include provisioning
                        </label>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label="What is provisioning?"
                              />
                            }
                          >
                            <CircleHelp className="h-3.5 w-3.5" />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="start"
                            className="max-w-80 bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white"
                          >
                            <p className="font-medium text-white">What does this mean?</p>
                            <p className="mt-1 text-slate-200">
                              Provisioning means preparing the employee&apos;s access before or during onboarding: which
                              roles they get, which branches they can work in, their shift or timetable, and which
                              attendance/access devices they should appear on. Turn this on only if you want to set
                              those up now; you can skip it and configure access later.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {requestProvisioningEnabled ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <MultiSelectChecklist
                              compact
                              label="Roles (what they can do in the system)"
                              options={requestRoleOptions}
                              selectedIds={requestProvisioning.roleIds}
                              onToggle={(id, checked) =>
                                updateRequestProvisioningField(
                                  "roleIds",
                                  toggleNumericId(requestProvisioning.roleIds, id, checked)
                                )
                              }
                              emptyText="No roles available."
                            />
                            <MultiSelectChecklist
                              compact
                              label="Branch access (where they can work)"
                              options={requestBranchAccessOptions}
                              selectedIds={requestProvisioning.branchAccessIds}
                              onToggle={(id, checked) =>
                                updateRequestProvisioningField(
                                  "branchAccessIds",
                                  toggleNumericId(requestProvisioning.branchAccessIds, id, checked)
                                )
                              }
                              emptyText="No branches available."
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                              Attendance mode
                              <Select
                                value={requestProvisioning.attendanceMode || "none"}
                                onValueChange={(value) =>
                                  setRequestAttendanceMode(
                                    value === "none" ? "" : (value as OnboardingProvisioningDraft["attendanceMode"])
                                  )
                                }
                              >
                                <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                  <SelectValue placeholder="Attendance mode" />
                                </SelectTrigger>
                                <SelectContent className={selectPopupClassName}>
                                  <SelectItem value="none" className="text-slate-900">
                                    None for now
                                  </SelectItem>
                                  <SelectItem value="shift" className="text-slate-900">
                                    Shift
                                  </SelectItem>
                                  <SelectItem value="timetable" className="text-slate-900">
                                    Timetable
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </label>

                            {requestProvisioning.attendanceMode === "shift" ? (
                              <>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Shift
                                  <Select
                                    value={requestProvisioning.shiftAssignment.shiftId || "none"}
                                    onValueChange={(value) =>
                                      updateRequestShiftAssignmentField(
                                        "shiftId",
                                        (value ?? "none") === "none" ? "" : (value ?? "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                      <SelectValue placeholder="Select shift" />
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">
                                        Select shift
                                      </SelectItem>
                                      {requestShiftOptions.map((option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={String(option.id)}
                                          className="text-slate-900"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective from
                                  <DateInput
                                    className="h-9"

                                    value={requestProvisioning.shiftAssignment.effectiveFrom}
                                    onChange={(event) =>
                                      updateRequestShiftAssignmentField("effectiveFrom", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective to
                                  <DateInput
                                    className="h-9"

                                    value={requestProvisioning.shiftAssignment.effectiveTo}
                                    onChange={(event) =>
                                      updateRequestShiftAssignmentField("effectiveTo", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Rotation group (optional)
                                  <Select
                                    value={requestProvisioning.shiftAssignment.rotationGroupId || "none"}
                                    onValueChange={(value) =>
                                      updateRequestShiftAssignmentField(
                                        "rotationGroupId",
                                        (value ?? "none") === "none" ? "" : (value ?? "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                      <SelectValue placeholder="Select rotation group">
                                        <span className="text-slate-900">
                                          {requestProvisioning.shiftAssignment.rotationGroupId
                                            ? (requestRotationGroupOptions.find(
                                                (option) =>
                                                  String(option.id) ===
                                                  requestProvisioning.shiftAssignment.rotationGroupId
                                              )?.label ??
                                              `Rotation group #${requestProvisioning.shiftAssignment.rotationGroupId}`)
                                            : "None"}
                                        </span>
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">
                                        None
                                      </SelectItem>
                                      {requestRotationGroupOptions.map((option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={String(option.id)}
                                          className="text-slate-900"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                              </>
                            ) : null}

                            {requestProvisioning.attendanceMode === "timetable" ? (
                              <>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Timetable
                                  <Select
                                    value={requestProvisioning.timetableAssignment.timetableId || "none"}
                                    onValueChange={(value) =>
                                      updateRequestTimetableAssignmentField(
                                        "timetableId",
                                        (value ?? "none") === "none" ? "" : (value ?? "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                      <SelectValue placeholder="Select timetable" />
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">
                                        Select timetable
                                      </SelectItem>
                                      {requestTimetableOptions.map((option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={String(option.id)}
                                          className="text-slate-900"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective from
                                  <DateInput
                                    className="h-9"

                                    value={requestProvisioning.timetableAssignment.effectiveFrom}
                                    onChange={(event) =>
                                      updateRequestTimetableAssignmentField("effectiveFrom", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective to
                                  <DateInput
                                    className="h-9"

                                    value={requestProvisioning.timetableAssignment.effectiveTo}
                                    onChange={(event) =>
                                      updateRequestTimetableAssignmentField("effectiveTo", event.target.value)
                                    }
                                  />
                                </label>
                              </>
                            ) : null}
                          </div>

                          <div className="border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="device-provisioning"
                                checked={requestProvisioning.deviceAssignment.enabled}
                                onCheckedChange={(value) =>
                                  updateRequestDeviceAssignmentField("enabled", Boolean(value))
                                }
                              />
                              <label htmlFor="device-provisioning" className="text-sm font-medium text-slate-900">
                                Also set up access devices
                              </label>
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                      aria-label="What are access devices?"
                                    />
                                  }
                                >
                                  <CircleHelp className="h-3.5 w-3.5" />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  align="start"
                                  className="max-w-80 bg-slate-900 px-3 py-2 text-left text-xs leading-relaxed text-white"
                                >
                                  Attendance or door devices the employee should be registered on (for fingerprint,
                                  card, or face check-in). Skip if devices will be assigned later.
                                </TooltipContent>
                              </Tooltip>
                            </div>

                            {requestProvisioning.deviceAssignment.enabled ? (
                              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Access group
                                  <Select
                                    value={requestProvisioning.deviceAssignment.accessGroupId || "none"}
                                    onValueChange={(value) =>
                                      updateRequestDeviceAssignmentField(
                                        "accessGroupId",
                                        (value ?? "none") === "none" ? "" : (value ?? "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                      <SelectValue placeholder="Access group" />
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">
                                        Select access group
                                      </SelectItem>
                                      {requestAccessGroupOptions.map((option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={String(option.id)}
                                          className="text-slate-900"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Organization
                                  <Select
                                    value={requestProvisioning.deviceAssignment.organizationId || "none"}
                                    onValueChange={(value) =>
                                      updateRequestDeviceAssignmentField(
                                        "organizationId",
                                        (value ?? "none") === "none" ? "" : (value ?? "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                      <SelectValue placeholder="Optional" />
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">
                                        None
                                      </SelectItem>
                                      {requestAccessOrganizationOptions.map((option) => (
                                        <SelectItem
                                          key={option.id}
                                          value={String(option.id)}
                                          className="text-slate-900"
                                        >
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Employee no. on device
                                  <Input
                                    className="h-9 bg-white text-slate-900"
                                    value={requestProvisioning.deviceAssignment.employeeNo}
                                    onChange={(event) =>
                                      updateRequestDeviceAssignmentField("employeeNo", event.target.value)
                                    }
                                    placeholder="Optional override"
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Verify mode
                                  <Select
                                    value={requestProvisioning.deviceAssignment.userVerifyMode || "none"}
                                    onValueChange={(value) =>
                                      updateRequestDeviceAssignmentField(
                                        "userVerifyMode",
                                        (value ?? "none") === "none" ? "" : (value ?? "")
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                                      <SelectValue placeholder="Select verify mode">
                                        {USER_VERIFY_MODE_OPTIONS.find(
                                          (option) =>
                                            option.value === requestProvisioning.deviceAssignment.userVerifyMode
                                        )?.label ?? "Select verify mode"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">
                                        Not set
                                      </SelectItem>
                                      {USER_VERIFY_MODE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value} className="text-slate-900">
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Valid from
                                  <DateTimeInput
                                    aria-label="Valid from"
                                    value={requestProvisioning.deviceAssignment.validBeginTime}
                                    onChange={(event) =>
                                      updateRequestDeviceAssignmentField("validBeginTime", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Valid until
                                  <DateTimeInput
                                    aria-label="Valid until"
                                    value={requestProvisioning.deviceAssignment.validEndTime}
                                    onChange={(event) =>
                                      updateRequestDeviceAssignmentField("validEndTime", event.target.value)
                                    }
                                  />
                                </label>
                                <div className="sm:col-span-2 lg:col-span-3">
                                  <MultiSelectChecklist
                                    compact
                                    label="Devices to enroll"
                                    options={requestAttendanceDeviceOptions}
                                    selectedIds={requestProvisioning.deviceAssignment.deviceIds}
                                    onToggle={(id, checked) =>
                                      updateRequestDeviceAssignmentField(
                                        "deviceIds",
                                        toggleNumericId(requestProvisioning.deviceAssignment.deviceIds, id, checked)
                                      )
                                    }
                                    emptyText="No attendance devices available."
                                  />
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-3">
                                  {[
                                    ["validEnabled", "Use validity window"],
                                    ["localUiRight", "Allow local device UI"],
                                    ["closeDelayEnabled", "Enable close delay"],
                                    ["syncNow", "Sync to devices now"],
                                    ["continueOnError", "Continue if one device fails"],
                                  ].map(([key, label]) => (
                                    <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700">
                                      <Checkbox
                                        checked={Boolean(
                                          requestProvisioning.deviceAssignment[
                                            key as keyof OnboardingDeviceAssignmentDraft
                                          ]
                                        )}
                                        onCheckedChange={(value) =>
                                          updateRequestDeviceAssignmentField(
                                            key as keyof OnboardingDeviceAssignmentDraft,
                                            Boolean(value) as never
                                          )
                                        }
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-background px-4 py-3 sm:px-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3"
                    onClick={() => setRequestSheetOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" className="h-9 px-3" onClick={() => void submitRequest()} disabled={saving}>
                    {saving ? "Creating…" : "Create Request"}
                  </Button>
                </footer>
              </div>
            </SheetContent>
          </Sheet>

          <Dialog open={requestDetailsOpen} onOpenChange={setRequestDetailsOpen}>
            <DialogPopup
              from="bottom"
              showCloseButton={false}
              className="flex h-[calc(100vh-0.5rem)] w-[calc(100vw-0.5rem)] max-h-none max-w-none flex-col overflow-hidden border border-border bg-background p-0 shadow-sm sm:h-[calc(100vh-1rem)] sm:w-[calc(100vw-1rem)] sm:max-w-none"
            >
              <DialogClose className="absolute right-3 top-3 z-30 inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <X className="size-4" aria-hidden="true" />
                <span className="sr-only">Close onboarding request</span>
              </DialogClose>
              <DialogHeader className="z-20 grid shrink-0 gap-2.5 border-b border-border bg-background px-3 py-2.5 pr-14 md:grid-cols-[minmax(180px,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-sm font-semibold tracking-tight text-foreground">
                    Onboarding request
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-[10px] text-muted-foreground">
                    Review employee details and track the remaining onboarding work.
                  </DialogDescription>
                </div>
                <div className="hidden shrink-0 items-center divide-x divide-border md:flex">
                  <div className="px-3 text-right">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Employee</p>
                    <p className="mt-0.5 max-w-56 truncate text-[11px] font-semibold text-foreground">
                      {selectedRequestSummary.employee}
                    </p>
                  </div>
                  <div className="px-3 text-right">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-foreground">
                      {toTitleCaseWords(selectedRequestSummary.status)}
                    </p>
                  </div>
                  <div className="pl-3 text-right">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Updated</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-foreground">{selectedRequestSummary.updated}</p>
                  </div>
                </div>
              </DialogHeader>

              {requestDetailsLoading ? (
                <div className="m-3 border border-border p-4 text-sm text-muted-foreground">
                  Loading request activity...
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto text-foreground [&_.border-slate-200]:border-border [&_.border-slate-300]:border-border [&_.bg-slate-50]:bg-muted/20 [&_.bg-white]:bg-background [&_.text-slate-500]:text-muted-foreground [&_.text-slate-600]:text-muted-foreground [&_.text-slate-700]:text-foreground [&_.text-slate-800]:text-foreground [&_.text-slate-900]:text-foreground">

                  <section className="overflow-hidden border-b border-border bg-background">
                    <div className="flex flex-col gap-2 border-b border-border bg-muted/[0.12] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Employee details review</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Verify each section. Return only the sections that need correction and include a reason.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
                        <span className="bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          {employeeDetailsReviewCounts.approved} approved
                        </span>
                        <span className="bg-rose-500/10 px-2 py-1 font-semibold text-rose-700 dark:text-rose-400">
                          {employeeDetailsReviewCounts.changesRequested} changes
                        </span>
                        <span className="bg-amber-500/10 px-2 py-1 font-semibold text-amber-700 dark:text-amber-400">
                          {employeeDetailsReviewCounts.pending} pending
                        </span>
                        <span
                          className={cn(
                            "px-2 py-1 font-semibold",
                            employeeDetailsReview.status === "approved"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : employeeDetailsReview.status === "changes_requested"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                : employeeDetailsReview.status === "submitted" ||
                                    employeeDetailsReview.status === "in_review"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                          )}
                        >
                          {toTitleCaseWords(employeeDetailsReview.status)}
                        </span>
                      </div>
                    </div>

                    {employeeDetailsReview.notProvidedItems.length > 0 ? (
                      <div className="border-b border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        Employee marked as unavailable: {employeeDetailsReview.notProvidedItems
                          .map((key) => key === "professional_qualifications" ? "Professional qualifications" : key === "experience_details" ? "Previous work experience" : key)
                          .join(", ")}.
                      </div>
                    ) : null}

                    {employeeDetailsReview.sections.length === 0 ? (
                      <div className="p-5 text-sm text-muted-foreground">
                        Employee review details are not available yet.
                      </div>
                    ) : (
                      <div className="grid min-h-[280px] lg:grid-cols-[200px_minmax(0,1fr)]">
                        <nav className="border-b border-border bg-muted/[0.12] p-1.5 lg:border-b-0 lg:border-r">
                          <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
                            {employeeDetailsReview.sections.map((section, index) => {
                              const sectionStatus = readString(section, ["status"], "pending").toLowerCase()
                              const active = index === employeeReviewStep
                              const sectionFields = toRecordList(section.fields)
                              const allFieldsPresent =
                                sectionFields.length > 0 &&
                                sectionFields.every((field) => hasEmployeeReviewValue(readString(field, ["value"])))
                              return (
                                <li key={readString(section, ["key"], String(index))}>
                                  <button
                                    type="button"
                                    onClick={() => setEmployeeReviewStep(index)}
                                    className={cn(
                                      "flex min-h-11 w-full items-center gap-2 border border-transparent px-2 py-1.5 text-left text-[11px] transition",
                                      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                                        sectionStatus === "approved"
                                          ? "bg-emerald-500 text-white"
                                          : allFieldsPresent
                                            ? "bg-emerald-500 text-white ring-2 ring-emerald-200"
                                            : active
                                              ? "bg-white/20 text-white"
                                            : sectionStatus === "changes_requested"
                                              ? "bg-rose-100 text-rose-700"
                                              : "bg-slate-200 text-slate-700"
                                      )}
                                    >
                                      {sectionStatus === "approved" ? "✓" : index + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-medium">
                                        {readString(section, ["label"], "Section")}
                                      </span>
                                      <span
                                        className={cn(
                                          "mt-0.5 inline-flex px-1.5 py-0.5 text-[9px] font-medium",
                                          sectionStatus === "approved"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : sectionStatus === "changes_requested"
                                              ? "bg-destructive/10 text-destructive"
                                              : sectionStatus === "in_review" || sectionStatus === "submitted"
                                                ? "bg-primary/10 text-primary"
                                                : "bg-amber-100 text-amber-700"
                                        )}
                                      >
                                        {toTitleCaseWords(sectionStatus)}
                                      </span>
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ol>
                        </nav>

                        {currentEmployeeReviewSection ? (
                          <div className="space-y-3 p-3 sm:p-4">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Step {employeeReviewStep + 1} of {employeeDetailsReview.sections.length}
                              </p>
                              <h3 className="text-sm font-semibold text-foreground">
                                {readString(currentEmployeeReviewSection, ["label"], "Employee details")}
                              </h3>
                            </div>

                            <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                              {toRecordList(currentEmployeeReviewSection.fields).map((reviewField, index) => (
                                (() => {
                                  const value = readString(reviewField, ["value"])
                                  const isFilled = hasEmployeeReviewValue(value)
                                  return (
                                    <div
                                      key={`${readString(reviewField, ["label"])}-${index}`}
                                      className="border-b border-border/70 py-1.5"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {isFilled ? (
                                          <CheckCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                        ) : (
                                          <span className="size-3.5 shrink-0 rounded-full border border-slate-300" />
                                        )}
                                        <p
                                          className={cn(
                                            "text-[10px] font-medium uppercase tracking-wide",
                                            isFilled ? "text-emerald-700" : "text-muted-foreground"
                                          )}
                                        >
                                          {readString(reviewField, ["label"], "Field")}
                                        </p>
                                      </div>
                                      <p
                                        className={cn(
                                          "mt-0.5 whitespace-pre-wrap pl-5 text-xs",
                                          isFilled ? "text-foreground" : "text-muted-foreground"
                                        )}
                                      >
                                        {value}
                                      </p>
                                    </div>
                                  )
                                })()
                              ))}
                            </div>

                            {toRecordList(currentEmployeeReviewSection.attachments).length > 0 ? (
                              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                                <p className="text-xs font-semibold text-foreground">Uploaded evidence</p>
                                <div className="grid gap-2 md:grid-cols-2">
                                  {toRecordList(currentEmployeeReviewSection.attachments).map((attachment, index) => {
                                    const mimeType = readString(attachment, ["mime_type"], "")
                                    const canPreview =
                                      mimeType.startsWith("image/") ||
                                      mimeType === "application/pdf" ||
                                      mimeType.startsWith("text/")
                                    return (
                                      <div
                                        key={`employee-review-attachment-${readNumber(attachment, ["id"]) ?? index}`}
                                        className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                                      >
                                        <div className="min-w-0">
                                          <p className="truncate text-xs font-medium text-foreground">
                                            {readString(attachment, ["title", "original_file_name"], `Attachment ${index + 1}`)}
                                          </p>
                                          <p className="truncate text-[10px] text-muted-foreground">
                                            {readString(attachment, ["original_file_name", "document_type"], "Document")}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          disabled={saving}
                                          onClick={() => void viewRequestDocument(attachment)}
                                        >
                                          {canPreview ? <Eye data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                                          {canPreview ? "View" : "Download"}
                                        </Button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}

                            <label className="grid gap-1.5 text-xs font-medium text-foreground">
                              Review note
                              <Textarea
                                className="min-h-16 border border-input bg-background px-3 py-2 text-xs font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                                value={
                                  employeeReviewComments[readString(currentEmployeeReviewSection, ["key"], "")] ?? ""
                                }
                                onChange={(event) => {
                                  const key = readString(currentEmployeeReviewSection, ["key"], "")
                                  setEmployeeReviewComments((current) => ({
                                    ...current,
                                    [key]: event.target.value,
                                  }))
                                }}
                                placeholder="Required when returning this section; optional when verifying."
                              />
                            </label>

                            {canUpdateOnboardingRequests ? (
                              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={
                                    saving ||
                                    !employeeReviewComments[
                                      readString(currentEmployeeReviewSection, ["key"], "")
                                    ]?.trim()
                                  }
                                  onClick={() => void saveEmployeeDetailReview("changes_requested")}
                                >
                                  Request changes & notify employee
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={saving || currentEmployeeReviewStatus === "approved"}
                                  onClick={() => void saveEmployeeDetailReview("approved")}
                                >
                                  {currentEmployeeReviewStatus === "approved" ? "Approved" : "Approve & notify employee"}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </section>

                  <div className="grid items-start gap-px border-b border-border bg-border xl:grid-cols-2 [&>div]:bg-background [&>section]:bg-background">
                  <section className="space-y-2 bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Submitted request</p>
                    <div className="grid gap-x-4 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Request Code</p>
                        <p className="text-sm text-slate-900">
                          {readString(selectedRequestDetails ?? selectedRequestRow ?? {}, [
                            "request_no",
                            "request_code",
                            "onboarding_no",
                            "onboarding_code",
                            "reference_no",
                          ])}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Workflow</p>
                        <p className="text-sm text-slate-900">
                          {resolveWorkflowLabel(
                            readNumber(selectedRequestDetails ?? selectedRequestRow ?? {}, [
                              "workflow_id",
                              "onboarding_workflow_id",
                            ])
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Workflow stage</p>
                        <p className="text-sm text-slate-900">
                          {isOnboardingDraftStatus(
                            readString(selectedRequestDetails ?? selectedRequestRow ?? {}, ["status", "request_status"])
                          )
                            ? "Waiting for HR to start"
                            : "Workflow started"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</p>
                        <p className="text-sm text-slate-900">
                          {readString(selectedRequestDetails ?? selectedRequestRow ?? {}, ["title", "name"])}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planned Start</p>
                        <p className="text-sm text-slate-900">
                          {toTimestamp(
                            selectedRequestDetails?.planned_start_date ?? selectedRequestRow?.planned_start_date
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Planned Completion</p>
                        <p className="text-sm text-slate-900">
                          {toTimestamp(
                            selectedRequestDetails?.planned_completion_date ??
                              selectedRequestRow?.planned_completion_date
                          )}
                        </p>
                      </div>
                      <div className="md:col-span-2 xl:col-span-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Description</p>
                        <p className="text-sm text-slate-900">
                          {readString(selectedRequestDetails ?? selectedRequestRow ?? {}, ["description", "notes"])}
                        </p>
                      </div>
                    </div>
                  </section>

                  {isOnboardingActableStatus(
                    readString(selectedRequestDetails ?? selectedRequestRow ?? {}, ["status", "request_status"])
                  ) && approvalSummary.pending.length > 0 ? (
                    <div className="border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/25">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Pending approval</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{approvalSummary.waitingLabel}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Only the assigned approver for the current workflow level can approve or reject.
                      </p>
                    </div>
                  ) : null}

                  {(() => {
                    const acknowledgedAt = readString(selectedRequestDetails ?? selectedRequestRow ?? {}, [
                      "employee_acknowledged_at",
                      "employeeAcknowledgedAt",
                    ])
                    const needsAcknowledgement = !acknowledgedAt || acknowledgedAt === "-"
                    return (
                      <section className="space-y-2 bg-background p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Employee acknowledgement</p>
                            <p className="text-xs text-muted-foreground">
                              {needsAcknowledgement
                                ? "Waiting for the employee to acknowledge this request from their onboarding dashboard."
                                : `Acknowledged ${toTimestamp(acknowledgedAt)}.`}
                            </p>
                          </div>
                        </div>
                      </section>
                    )
                  })()}

                  <section className="space-y-2 bg-background p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Approval trail</p>
                      {approvalSummary.pending.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {approvalSummary.currentLevel > 0
                            ? `Current level ${approvalSummary.currentLevel}. ${approvalSummary.waitingLabel}.`
                            : approvalSummary.waitingLabel}
                        </p>
                      ) : null}
                    </div>
                    {approvalSummary.rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No approval records on this request.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {approvalSummary.rows.map((approval, index) => (
                          <div
                            key={`onboarding-approval-${approval.id ?? index}`}
                            className="py-2.5 first:pt-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {approval.name ||
                                  readString(approval.raw, ["title", "step_name", "approval_name", "name"]) ||
                                  `Level ${approval.level || index + 1}`}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {approval.status.toLowerCase() === "pending" && !approval.isCurrent
                                  ? "Queued"
                                  : toTitleCaseWords(approval.status || "pending")}
                                {approval.level > 0 ? ` • Level ${approval.level}` : ""}
                                {approval.isCurrent ? " • Current" : ""}
                              </span>
                            </div>
                            {approval.email ? (
                              <a className="mt-0.5 block text-xs text-primary hover:underline" href={`mailto:${approval.email}`}>
                                {approval.email}
                              </a>
                            ) : null}
                            {approval.comments ? (
                              <p className="mt-1 text-xs text-muted-foreground">{approval.comments}</p>
                            ) : null}
                            {canUpdateOnboardingRequests && approval.status.toLowerCase() === "pending" && approval.isCurrent ? (
                              <button
                                type="button"
                                className="mt-2 text-xs font-medium text-primary"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => openApprovalAssignmentDialog(approval.raw)}
                              >
                                Change approver
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {selectedRequestProvisioningSummary ? (
                    <details className="group bg-background xl:col-span-2">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
                        <span>Provisioning summary</span>
                        <span className="text-[10px] font-medium text-muted-foreground group-open:hidden">
                          Open configuration details
                        </span>
                        <span className="hidden text-[10px] font-medium text-muted-foreground group-open:inline">
                          Hide details
                        </span>
                      </summary>
                      <div className="grid gap-x-4 gap-y-2 border-t border-border px-3 py-2.5 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Roles</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.roleLabels.length > 0
                              ? selectedRequestProvisioningSummary.roleLabels.join(", ")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Branch Access</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.branchAccessLabels.length > 0
                              ? selectedRequestProvisioningSummary.branchAccessLabels.join(", ")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Attendance Mode</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.attendanceMode}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Shift</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.shiftLabel}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Shift Effective From
                          </p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.shiftEffectiveFrom}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Shift Effective To
                          </p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.shiftEffectiveTo}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rotation Group</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.rotationGroupLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Timetable</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.timetableLabel}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Timetable Effective From
                          </p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.timetableEffectiveFrom}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Timetable Effective To
                          </p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.timetableEffectiveTo}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Device Setup</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.deviceConfigured}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Device Employee No
                          </p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.deviceEmployeeNo}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Access Group</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.accessGroupLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Organization</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.organizationLabel}
                          </p>
                        </div>
                        <div className="md:col-span-2 xl:col-span-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Devices</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.deviceLabels.length > 0
                              ? selectedRequestProvisioningSummary.deviceLabels.join(", ")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Validity Enabled</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.validEnabled}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valid Begin Time</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.validBeginTime}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valid End Time</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.validEndTime}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verify Mode</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.userVerifyMode}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Local UI Right</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.localUiRight}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Close Delay Enabled
                          </p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.closeDelayEnabled}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Max Open Door Time
                          </p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.maxOpenDoorTime}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open Door Time</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.openDoorTime}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sync Now</p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.syncNow}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Continue On Error
                          </p>
                          <p className="text-sm text-slate-900">{selectedRequestProvisioningSummary.continueOnError}</p>
                        </div>
                      </div>
                    </details>
                  ) : null}

                  <div className="space-y-2 bg-background p-3 xl:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Documents</p>
                      {canUpdateOnboardingRequests ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            resetDocumentForm()
                            setShowDocumentComposer((current) => !current)
                          }}
                          disabled={saving}
                        >
                          {showDocumentComposer ? "Hide upload" : "Upload document"}
                        </Button>
                      ) : null}
                    </div>

                    {showDocumentComposer ? (
                      <div className="grid gap-3 border border-border bg-muted/[0.12] p-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Title
                          <Input
                            className="h-9 bg-white text-slate-900"
                            value={documentForm.title}
                            onChange={(event) =>
                              setDocumentForm((prev) => ({
                                ...prev,
                                title: event.target.value,
                              }))
                            }
                            placeholder="Document title"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Document type
                          <Select
                            value={documentForm.document_type}
                            onValueChange={(value) =>
                              setDocumentForm((prev) => ({ ...prev, document_type: value ?? "" }))
                            }
                          >
                            <SelectTrigger className="h-9 w-full bg-background">
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {ONBOARDING_DOCUMENT_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </label>
                        <div className="grid gap-1 text-xs font-medium text-slate-700">
                          <span>Expiry date</span>
                          <Popover>
                            <PopoverTrigger className="flex h-9 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-left text-sm font-normal text-foreground outline-none transition hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                              <CalendarDays className="text-muted-foreground" />
                              <span className={documentForm.expiry_date ? "text-foreground" : "text-muted-foreground"}>
                                {documentForm.expiry_date
                                  ? parseDateOnly(documentForm.expiry_date)?.toLocaleDateString()
                                  : "Select expiry date"}
                              </span>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={parseDateOnly(documentForm.expiry_date)}
                                onSelect={(date) =>
                                  setDocumentForm((prev) => ({ ...prev, expiry_date: toDateOnlyValue(date) }))
                                }
                                fromYear={new Date().getFullYear()}
                                toYear={new Date().getFullYear() + 50}
                              />
                              {documentForm.expiry_date ? (
                                <div className="flex justify-end border-t border-border p-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDocumentForm((prev) => ({ ...prev, expiry_date: "" }))}
                                  >
                                    Clear date
                                  </Button>
                                </div>
                              ) : null}
                            </PopoverContent>
                          </Popover>
                        </div>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          File
                          <Input
                            className="h-9 bg-white text-slate-900 file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-medium"
                            type="file"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null
                              setDocumentUploadFile(file)
                              if (!file) return
                              setDocumentForm((prev) => ({
                                ...prev,
                                title: prev.title.trim() || file.name.replace(/\.[^.]+$/, ""),
                              }))
                            }}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">
                          Description
                          <Textarea
                            className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            value={documentForm.description}
                            onChange={(event) =>
                              setDocumentForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                            placeholder="Optional document notes"
                          />
                        </label>
                        <div className="flex justify-end gap-2 md:col-span-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              resetDocumentForm()
                              setShowDocumentComposer(false)
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="h-8 px-3 text-xs"
                            onClick={() => void submitRequestDocument()}
                            disabled={saving}
                          >
                            {saving ? "Uploading..." : "Upload"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {displayedRequestDocuments.length === 0 ? (
                      <p className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        No onboarding documents attached yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {displayedRequestDocuments.map((documentRow, index) => {
                          const documentId = readNumber(documentRow, ["id", "document_id"])
                          const title = readString(documentRow, ["title", "name", "file_name"])
                          const typeCode = readString(documentRow, ["document_type", "document_type_code", "type_code", "type"])
                          const source = readString(documentRow, ["source"], "onboarding").toLowerCase()
                          const mimeType = readString(documentRow, ["mime_type"], "")
                          const canPreview =
                            mimeType.startsWith("image/") ||
                            mimeType === "application/pdf" ||
                            mimeType.startsWith("text/")
                          const isVerified = asTruthyBoolean(
                            documentRow.is_verified ?? documentRow.verified ?? documentRow.isVerified
                          )
                          return (
                            <div
                              key={`onboarding-document-${documentId ?? index}`}
                              className="border border-border bg-background p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {title !== "-" ? title : `Document #${documentId ?? index + 1}`}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {typeCode !== "-" ? toTitleCaseWords(typeCode) : "No type"} •{" "}
                                    {source === "employee_profile"
                                      ? "Employee upload"
                                      : isVerified
                                        ? "Verified"
                                        : "Pending verification"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void viewRequestDocument(documentRow)}
                                    disabled={saving}
                                  >
                                    {canPreview ? <Eye data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                                    {canPreview ? "View" : "Download"}
                                  </Button>
                                  {canUpdateOnboardingRequests && source === "onboarding" ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px]"
                                        onClick={() => void setRequestDocumentVerified(documentRow, !isVerified)}
                                        disabled={saving}
                                      >
                                        {isVerified ? "Mark unverified" : "Verify"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="h-7 px-2 text-[11px] text-rose-600"
                                        onClick={() => void removeRequestDocument(documentRow)}
                                        disabled={saving}
                                      >
                                        Delete
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-2 grid gap-2 md:grid-cols-3">
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Expiry
                                  </p>
                                  <p className="text-sm text-slate-900">{toTimestamp(documentRow.expiry_date)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Uploaded
                                  </p>
                                  <p className="text-sm text-slate-900">
                                    {toTimestamp(documentRow.created_at ?? documentRow.uploaded_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Description
                                  </p>
                                  <p className="text-sm text-slate-900">
                                    {readString(documentRow, ["description", "notes", "remarks"])}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 bg-background p-3 xl:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Tasks</p>
                      {canUpdateOnboardingRequests ? (
                        <Button
                          type="button"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            void ensureLookups(["users", "departments"])
                            resetTaskForm()
                            setShowTaskComposer((current) => !current)
                          }}
                          disabled={saving}
                        >
                          {!showTaskComposer ? <Plus data-icon="inline-start" /> : null}
                          {showTaskComposer ? "Hide task form" : "Add task"}
                        </Button>
                      ) : null}
                    </div>

                    {showTaskComposer ? (
                      <div className="grid gap-3 border border-border bg-muted/[0.12] p-3 md:grid-cols-2">
                        {taskForm.task_type === "asset" ? (
                          <div className="grid gap-2 md:col-span-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-slate-700">Items to provide</p>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 px-2.5 text-xs"
                                onClick={() =>
                                  setTaskForm((prev) => ({
                                    ...prev,
                                    asset_items: [...prev.asset_items, ""],
                                  }))
                                }
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add another item
                              </Button>
                            </div>
                            {taskForm.asset_items.map((item, index) => (
                              <div key={`asset-item-${index}`} className="flex items-center gap-2">
                                <span className="w-5 text-right text-xs font-semibold text-slate-500">
                                  {index + 1}.
                                </span>
                                <Input
                                  className="h-9 flex-1 bg-white text-slate-900"
                                  value={item}
                                  onChange={(event) =>
                                    setTaskForm((prev) => ({
                                      ...prev,
                                      asset_items: prev.asset_items.map((entry, itemIndex) =>
                                        itemIndex === index ? event.target.value : entry
                                      ),
                                    }))
                                  }
                                  placeholder={index === 0 ? "e.g. Laptop" : "Another item"}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-slate-500 hover:text-red-600"
                                  onClick={() =>
                                    setTaskForm((prev) => ({
                                      ...prev,
                                      asset_items:
                                        prev.asset_items.length === 1
                                          ? [""]
                                          : prev.asset_items.filter((_, itemIndex) => itemIndex !== index),
                                    }))
                                  }
                                  aria-label={`Remove item ${index + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <label className="grid gap-1 text-xs font-medium text-slate-700">
                            Title
                            <Input
                              className="h-9 bg-white text-slate-900"
                              value={taskForm.title}
                              onChange={(event) =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="Task title"
                            />
                          </label>
                        )}
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Task type
                          <FluentSelect
                            ariaLabel="Task type"
                            value={taskForm.task_type}
                            onChange={(value) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                task_type: value,
                              }))
                            }
                            options={ONBOARDING_TASK_TYPE_OPTIONS.map((type) => ({
                              value: type,
                              label: toTitleCaseWords(type),
                            }))}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Department{taskForm.task_type === "asset" ? " *" : ""}
                          <FluentSelect
                            ariaLabel="Department"
                            value={taskForm.assigned_department_id}
                            placeholder={taskForm.task_type === "asset" ? "Select department" : "Optional department"}
                            onChange={(value) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                assigned_department_id: value,
                                assigned_company_user_id: "",
                              }))
                            }
                            options={[
                              {
                                value: "",
                                label: taskForm.task_type === "asset" ? "Select department" : "Optional department",
                              },
                              ...departments.flatMap((row) => {
                                const departmentId = readNumber(row, ["id", "department_id"])
                                if (departmentId === null) return []
                                return [{
                                  value: String(departmentId),
                                  label: resolveOptionLabel(
                                    departments,
                                    departmentId,
                                    ["id", "department_id"],
                                    ["name", "title"]
                                  ),
                                }]
                              }),
                            ]}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Specific person (optional)
                          <FluentSelect
                            ariaLabel="Specific person"
                            value={taskForm.assigned_company_user_id}
                            disabled={taskForm.task_type === "asset" && !taskForm.assigned_department_id}
                            placeholder={
                              taskForm.assigned_department_id
                                ? "Everyone in the department"
                                : taskForm.task_type === "asset"
                                  ? "Select a department first"
                                  : "Optional user"
                            }
                            onChange={(value) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                assigned_company_user_id: value,
                              }))
                            }
                            options={[
                              {
                                value: "",
                                label: taskForm.assigned_department_id
                                  ? "Everyone in the department"
                                  : taskForm.task_type === "asset"
                                    ? "Select a department first"
                                    : "Optional user",
                              },
                              ...(taskForm.assigned_department_id ? taskAssignableUsers : users).flatMap((row) => {
                                const userId = preferredAssigneeId(row)
                                if (userId === null) return []
                                return [{
                                  value: String(userId),
                                  label: resolveOptionLabel(
                                    [row, ...users],
                                    userId,
                                    ["id", "company_user_id", "user_id"],
                                    ["full_name", "name", "email"]
                                  ),
                                }]
                              }),
                            ]}
                          />
                          {taskForm.assigned_department_id ? (
                            <span className="font-normal text-slate-500">
                              Leave blank to notify and assign the whole department.
                            </span>
                          ) : null}
                        </label>
                        <div className="grid gap-1 text-xs font-medium text-slate-700">
                          <span>Due date</span>
                          <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-2">
                            <Popover>
                              <PopoverTrigger className="flex h-9 items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-left text-sm font-normal outline-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                                <CalendarDays className="text-muted-foreground" />
                                <span className={taskForm.due_date ? "text-foreground" : "text-muted-foreground"}>
                                  {taskForm.due_date
                                    ? parseDateOnly(taskForm.due_date.slice(0, 10))?.toLocaleDateString()
                                    : "Select date"}
                                </span>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={parseDateOnly(taskForm.due_date.slice(0, 10))}
                                  onSelect={(date) =>
                                    setTaskForm((prev) => ({
                                      ...prev,
                                      due_date: date
                                        ? `${toDateOnlyValue(date)}T${prev.due_date.split("T")[1] || "17:00"}`
                                        : "",
                                    }))
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                            <Select
                              value={taskForm.due_date.split("T")[1] || "17:00"}
                              onValueChange={(value) =>
                                setTaskForm((prev) => ({
                                  ...prev,
                                  due_date: prev.due_date
                                    ? `${prev.due_date.slice(0, 10)}T${value ?? "17:00"}`
                                    : prev.due_date,
                                }))
                              }
                              disabled={!taskForm.due_date}
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue placeholder="Time" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {TASK_DUE_TIME_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">
                          Description
                          <Textarea
                            className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            value={taskForm.description}
                            onChange={(event) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                            placeholder="Optional task instructions"
                          />
                        </label>
                        <div className="flex justify-end gap-2 md:col-span-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              resetTaskForm()
                              setShowTaskComposer(false)
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="h-8 px-3 text-xs"
                            onClick={() => void submitRequestTask()}
                            disabled={saving}
                          >
                            {saving ? "Creating..." : taskForm.task_type === "asset" ? "Add items" : "Create task"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {selectedRequestTasks.length === 0 ? (
                      <p className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        No onboarding tasks have been created for this request.
                      </p>
                    ) : (
                      <div className="divide-y divide-border overflow-hidden border border-border">
                        {selectedRequestTasks.map((taskRow, index) => {
                          const taskId = readNumber(taskRow, ["id", "task_id"])
                          const taskStatus = readString(taskRow, ["status", "task_status"])
                          const isTaskClosed = ["completed", "cancelled"].includes(taskStatus.trim().toLowerCase())
                          return (
                            <div
                              key={`onboarding-task-${taskId ?? index}`}
                              className="bg-background px-3 py-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {readString(taskRow, ["title", "name", "task_title"])}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {readString(taskRow, ["task_type", "type"]).toLowerCase() === "asset"
                                      ? "Item handover"
                                      : toTitleCaseWords(readString(taskRow, ["task_type", "type"]))}{" "}
                                    • {taskStatus !== "-" ? toTitleCaseWords(taskStatus) : "Pending"}
                                  </p>
                                </div>
                                {!isTaskClosed && (canUpdateOnboardingRequests || canCompleteOnboardingRequests) ? (
                                  <Button
                                    type="button"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void completeRequestTask(taskRow)}
                                    disabled={saving}
                                  >
                                    {readString(taskRow, ["task_type", "type"]).toLowerCase() === "asset"
                                      ? "Mark as given"
                                      : "Complete task"}
                                  </Button>
                                ) : null}
                              </div>
                              <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    {readString(taskRow, ["task_type", "type"]).toLowerCase() === "asset"
                                      ? "Provider"
                                      : "Owner"}
                                  </p>
                                  <p className="text-xs text-slate-900">{resolveRequestTaskOwner(taskRow)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Due</p>
                                  <p className="text-xs text-slate-900">{toTimestamp(taskRow.due_date)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Completed
                                  </p>
                                  <p className="text-xs text-slate-900">{toTimestamp(taskRow.completed_at)}</p>
                                </div>
                                <div className="md:col-span-3">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Description
                                  </p>
                                  <p className="text-xs text-slate-900">
                                    {readString(taskRow, ["description", "completion_notes", "notes"])}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <section className="space-y-2 bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Workflow map</p>
                    <div className="divide-y divide-border overflow-hidden border border-border">
                      {requestTimelineNodes.map((node, idx) => {
                        const isDone =
                          node.status.includes("complete") ||
                          node.status.includes("approved") ||
                          node.status.includes("done") ||
                          node.status.includes("verified")
                        const isPending =
                          node.status.includes("pending") ||
                          node.status.includes("review") ||
                          node.status.includes("in_progress") ||
                          node.status.includes("active")
                        const badgeClass = isDone
                          ? "bg-emerald-100 text-emerald-700"
                          : isPending
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        return (
                          <div key={node.key} className="relative bg-background py-2 pl-10 pr-3">
                            {idx < requestTimelineNodes.length - 1 ? (
                              <span className="absolute left-[19px] top-8 h-[calc(100%-1rem)] w-px bg-slate-200" />
                            ) : null}
                            <span
                              className={`absolute left-2 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                isDone
                                  ? "bg-emerald-500 text-white"
                                  : isPending
                                    ? "bg-amber-500 text-white"
                                    : "bg-slate-300 text-slate-700"
                              }`}
                            >
                              {node.index}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {toTitleCaseWords(String(node.actionLabel))}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                                  {toTitleCaseWords(String(node.status))}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-600">
                                {isPending && approvalSummary.pendingLabels.length > 0 ? "Pending approver" : "Owner"}:{" "}
                                <span className="font-medium text-slate-800">
                                  {isPending && approvalSummary.pendingLabels.length > 0
                                    ? approvalSummary.pendingLabels.join(", ")
                                    : node.owner && node.owner !== "-"
                                      ? node.owner
                                      : "Unassigned"}
                                </span>
                              </p>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                <span>
                                  {isPending ? "Waiting to be completed" : isDone ? "Completed" : "Not started"}
                                </span>
                                {node.required ? <span>Required step</span> : null}
                                {node.completedAt !== "-" ? <span>Completed {node.completedAt}</span> : null}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section className="space-y-2 bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Activity record</p>
                    {selectedRequestAuditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity record available for this request.</p>
                    ) : (
                      <div className="divide-y divide-border overflow-hidden border border-border">
                        {selectedRequestAuditLogs.map((entry, index) => (
                          <div
                            key={`audit-${readString(entry, ["id", "log_id"])}-${index}`}
                            className="bg-background px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">
                                {toTitleCaseWords(
                                  readString(entry, ["action", "event", "type", "activity"]) || "Updated"
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {toTimestamp(
                                  entry.created_at ?? entry.timestamp ?? entry.occurred_at ?? entry.updated_at
                                )}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              By <span className="font-medium text-slate-800">{resolveAuditActorLabel(entry, users) || "-"}</span>
                              {readString(entry, ["description", "message", "remarks", "comment"]) !== "-"
                                ? ` • ${readString(entry, ["description", "message", "remarks", "comment"])}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  </div>
                </div>
              )}

              <DialogFooter className="z-20 shrink-0 border-t border-border bg-background/95 px-3 py-2 backdrop-blur">
                {(() => {
                  const selectedStatus = String(
                    readString(selectedRequestDetails ?? selectedRequestRow ?? {}, [
                      "status",
                      "request_status",
                      "onboarding_status",
                      "workflow_status",
                    ])
                  ).toLowerCase()
                  const selectedId = readCurrentRequestId()
                  const showSubmit =
                    isOnboardingDraftStatus(selectedStatus) &&
                    (canCreateOnboardingRequests || canUpdateOnboardingRequests)
                  const showApprove =
                    canApproveOnboardingRequests &&
                    !isOnboardingDraftStatus(selectedStatus) &&
                    isOnboardingActableStatus(selectedStatus) &&
                    approvalSummary.pending.length > 0
                  return (
                    <>
                      {showApprove && approvalSummary.waitingLabel ? (
                        <p className="mr-auto text-xs text-muted-foreground">{approvalSummary.waitingLabel}</p>
                      ) : null}
                      {showSubmit ? (
                        <div className="mr-auto flex flex-wrap items-center gap-3">
                          {employeeDetailsReview.status !== "approved" ? (
                            <label className="flex max-w-xl items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                              <Checkbox
                                checked={allowIncompleteWorkflowStart}
                                onCheckedChange={(value) => setAllowIncompleteWorkflowStart(Boolean(value))}
                              />
                              <span>
                                Start before the employee finishes or HR verifies every section. The employee can
                                continue updating details while the workflow runs.
                              </span>
                            </label>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              saving ||
                              selectedId === null ||
                              (employeeDetailsReview.status !== "approved" && !allowIncompleteWorkflowStart)
                            }
                            onClick={() => void runRequestAction(selectedId, "submit")}
                          >
                            Start onboarding workflow
                          </Button>
                        </div>
                      ) : null}
                      {showApprove ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving || selectedId === null}
                          onClick={() => void runRequestAction(selectedId, "approve")}
                        >
                          Approve
                        </Button>
                      ) : null}
                    </>
                  )
                })()}
                <Button type="button" variant="outline" size="sm" onClick={() => setRequestDetailsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

          <Dialog open={changeWorkflowDialogOpen} onOpenChange={setChangeWorkflowDialogOpen}>
            <DialogPopup from="bottom" className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Change onboarding workflow</DialogTitle>
                <DialogDescription>
                  Select the workflow that should replace the one currently attached to this request.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">
                    {readString(changeWorkflowRequest ?? {}, ["onboarding_no", "request_no", "title"])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pending approvals and tasks from the old workflow will be replaced. A workflow cannot be changed
                    after an approval or task has been actioned.
                  </p>
                </div>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Replacement workflow
                  <Select value={replacementWorkflowId} onValueChange={(value) => setReplacementWorkflowId(value ?? "")}>
                      <SelectTrigger className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20">
                      <SelectValue placeholder="Select workflow">
                        {replacementWorkflowId
                          ? resolveWorkflowLabel(Number(replacementWorkflowId))
                          : loading
                            ? "Loading workflows…"
                            : "Select workflow"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {workflows.map((workflow) => {
                        const workflowId = readNumber(workflow, ["id", "workflow_id"])
                        if (workflowId === null) return null
                        return (
                          <SelectItem key={workflowId} value={String(workflowId)}>
                            {readString(workflow, ["name", "title"])}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setChangeWorkflowDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saving || !replacementWorkflowId} onClick={saveRequestWorkflowChange}>
                  {saving ? "Changing…" : "Change Workflow"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

          <Dialog
            open={approvalAssignmentDialogOpen}
            onOpenChange={(open) => {
              setApprovalAssignmentDialogOpen(open)
              if (!open) setRequestDetailsOpen(true)
            }}
          >
            <DialogPopup from="bottom" className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Change approval assignee</DialogTitle>
                <DialogDescription>
                  Replace the person assigned to this pending approval. The workflow template itself is not changed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  New approver
                  <Select value={replacementApproverId} onValueChange={(value) => setReplacementApproverId(value ?? "")}>
                    <SelectTrigger
                      className="h-11 w-full"
                      aria-invalid={replacementApproverMissingPermission || undefined}
                    >
                      <SelectValue placeholder="Select approver">
                        {replacementApprover
                          ? personDisplayName(replacementApprover) || `User #${replacementApproverMembershipId}`
                          : loading
                            ? "Loading people…"
                            : "Select approver"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {approvalAssignmentCandidates.map((user) => {
                        const userId = preferredAssigneeId(user)
                        if (userId === null) return null
                        const label = personDisplayName(user) || `User #${userId}`
                        const hasPermission = onboardingAssigneeHasPermission(user, "sign_off")
                        return (
                          <SelectItem key={userId} value={String(userId)}>
                            {label}{hasPermission ? "" : " — missing approval permission"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </label>
                {replacementApproverMissingPermission ? (
                  <Alert variant="destructive">
                    <ShieldAlert className="size-4" />
                    <AlertTitle>Approval permission required</AlertTitle>
                    <AlertDescription>
                      This person needs <code className="text-xs">onboarding_requests:approve</code>. Use the permission
                      link from the workflow assignment warning or Company Access Management before assigning them.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Reason for change
                  <Textarea
                    value={approvalReassignmentReason}
                    onChange={(event) => setApprovalReassignmentReason(event.target.value)}
                    placeholder="Explain why the approver is being replaced"
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApprovalAssignmentDialogOpen(false)
                    setRequestDetailsOpen(true)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    saving ||
                    replacementApproverMembershipId === null ||
                    replacementApproverMissingPermission ||
                    !approvalReassignmentReason.trim()
                  }
                  onClick={saveApprovalAssignment}
                >
                  {saving ? "Changing…" : "Change Approver"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      ) : activeTab === "workflows" && canViewOnboardingWorkflows ? (
        <div className="space-y-2">
          <ResizableTable
            title="Onboarding Workflows"
            data={filteredWorkflows}
            columns={onboardingWorkflowColumns}
            loading={loading}
            storageKey="onboarding-workflows"
            enableAnimations
            compact
            toolbarClassName="mb-0 border-b border-border bg-muted/[0.12] px-3 py-2"
            frameClassName="rounded-none border-0 shadow-none"
            itemsPerPage={15}
            showExport={false}
            getRowId={(row, index) => String(readNumber(row, ["id", "workflow_id"]) ?? index)}
            onRowSelect={(_, row) => {
              if (!row || !canUpdateOnboardingWorkflows) {
                return
              }
              void openEditWorkflowSheet(readNumber(row, ["id", "workflow_id"]), row)
            }}
            toolbarStart={
              <>
                <FluentSearchBox
                  size="small"
                  aria-label="Search onboarding workflows"
                  className="!w-[14rem] max-w-full shrink-0"
                  placeholder="Search workflows"
                  value={workflowSearch}
                  onChange={(_event, data) => setWorkflowSearch(data.value)}
                />
                <FluentSelect
                  ariaLabel="Filter workflow status"
                  size="small"
                  className="min-w-[8.5rem]"
                  value={workflowStatusFilter}
                  onChange={setWorkflowStatusFilter}
                  options={workflowStatusOptions.map((status) => ({
                    value: status,
                    label: status === "all" ? "All statuses" : toTitleCaseWords(status),
                  }))}
                />
              </>
            }
            toolbarActions={
              <>
                {canCreateOnboardingWorkflows ? (
                  <Button
                    type="button"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => {
                      void openCreateWorkflowSheet()
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create Workflow
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-sm disabled:opacity-60"
                  onClick={() => void reloadAll(activeTab, true)}
                  disabled={loading}
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw className={cn("size-3.5 text-primary", loading ? "animate-spin" : "")} />
                </button>
              </>
            }
          />

          <Sheet
            open={workflowSheetOpen}
            onOpenChange={(open) => {
              setWorkflowSheetOpen(open)
              if (!open) {
                setEditingWorkflowId(null)
                setEditingStepIndex(null)
              }
            }}
          >
            <SheetContent
              side="right"
              className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none"
            >
              <SheetHeader>
                <SheetTitle>
                  {editingWorkflowId === null
                    ? "Create Workflow"
                    : `Edit Workflow${workflowForm.name ? `: ${workflowForm.name}` : ""}`}
                </SheetTitle>
                <SheetDescription>
                  {editingWorkflowId === null
                    ? "Configure workflow details, add steps, then create the workflow."
                    : saving
                      ? "Loading full workflow details…"
                      : "Review and update the saved workflow details and steps."}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-4">
                {editingWorkflowId !== null && saving ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    Loading workflow details from the server…
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Workflow name" size="small" className="gap-1">
                    <Input
                      size="medium"
                      className="rounded-md !border !border-input bg-background focus-within:!border-primary focus-within:ring-2 focus-within:ring-primary/20"
                      value={workflowForm.name}
                      onChange={(_event, data) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          name: data.value,
                        }))
                      }
                      placeholder="Workflow name"
                    />
                  </Field>
                  <Field label="Status" size="small" className="gap-1">
                    <Select
                      value={workflowForm.status || "active"}
                      onValueChange={(value) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          status: value ?? "active",
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Workflow status">
                        <SelectValue placeholder="Status">
                          <span>{toTitleCaseWords(workflowForm.status || "active")}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectPopupClassName}>
                        <SelectItem value="active">
                          Active
                        </SelectItem>
                        <SelectItem value="inactive">
                          Inactive
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Default workflow" size="small" className="gap-1">
                    <Select
                      value={workflowForm.is_default || "false"}
                      onValueChange={(value) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          is_default: value ?? "false",
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Default workflow">
                        <SelectValue placeholder="Default workflow">
                          <span>
                            {workflowForm.is_default === "true" ? "Default" : "Not default"}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectPopupClassName}>
                        <SelectItem value="true">
                          Default
                        </SelectItem>
                        <SelectItem value="false">
                          Not default
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Description" size="small" className="gap-1">
                    <Input
                      size="medium"
                      className="rounded-md !border !border-input bg-background focus-within:!border-primary focus-within:ring-2 focus-within:ring-primary/20"
                      value={workflowForm.description}
                      onChange={(_event, data) =>
                        setWorkflowForm((prev) => ({
                          ...prev,
                          description: data.value,
                        }))
                      }
                      placeholder="Workflow description"
                    />
                  </Field>
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <FluentButton
                      type="button"
                      appearance="primary"
                      size="small"
                      icon={<Add16Regular />}
                      onClick={openCreateStepDialog}
                      disabled={saving}
                    >
                      Add Step
                    </FluentButton>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Workflow Steps ({workflowSteps.length})</p>
                  {workflowSteps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {editingWorkflowId === null
                        ? "No steps added yet. Click Add Step to create your first workflow step."
                        : saving
                          ? "Loading steps…"
                          : "This workflow has no steps yet. Click Add Step to add one."}
                    </p>
                  ) : (
                    <HorizontalScrollContainer className="rounded-lg border border-border">
                      <FluentTable
                        aria-label="Workflow steps"
                        size="small"
                        style={{ tableLayout: "fixed", width: "100%" }}
                      >
                        <FluentTableHeader>
                          <FluentTableRow>
                            <TableHeaderCell style={{ width: "31%" }}>Step name</TableHeaderCell>
                            <TableHeaderCell style={{ width: "26%" }}>Checklist</TableHeaderCell>
                            <TableHeaderCell style={{ width: "28%" }}>Assignment</TableHeaderCell>
                            <TableHeaderCell className="text-right" style={{ width: "15%" }}>
                              Actions
                            </TableHeaderCell>
                          </FluentTableRow>
                        </FluentTableHeader>
                        <FluentTableBody>
                          {workflowSteps.map((step, index) => (
                            <FluentTableRow key={`step-${index}`}>
                              <FluentTableCell>
                                <TableCellLayout
                                  media={<ClipboardTaskListLtr20Regular />}
                                  description={`${toTitleCaseWords(step.step_type || "task")} · ${resolveYesNoLabel(step.is_required) === "Yes" ? "Required" : "Optional"} · ${step.due_days ? `${String(step.due_days)} day(s)` : "No due date"}`}
                                >
                                  {step.name || `Step ${index + 1}`}
                                </TableCellLayout>
                              </FluentTableCell>
                              <FluentTableCell>
                                <TableCellLayout
                                  description={step.description || undefined}
                                  truncate
                                >
                                  {step.checklist_items.length > 0
                                    ? step.checklist_items.map((item) => item.name).join(", ")
                                    : "No checklist"}
                                </TableCellLayout>
                              </FluentTableCell>
                              <FluentTableCell>
                                <TableCellLayout
                                  description={
                                    step.assigned_user_id
                                      ? resolveOptionLabel(
                                          users,
                                          step.assigned_user_id,
                                          ["id", "user_id", "company_user_id"],
                                          ["full_name", "name", "email"]
                                        )
                                      : step.assigned_department_id
                                        ? "Whole department"
                                        : step.assigned_role_id
                                          ? "Legacy role assignment"
                                          : "Unassigned"
                                  }
                                >
                                  {resolveOptionLabel(
                                    departments,
                                    step.assigned_department_id ?? null,
                                    ["id", "department_id"],
                                    ["name", "title", "code"]
                                  )}
                                </TableCellLayout>
                              </FluentTableCell>
                              <FluentTableCell>
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="size-7 p-0"
                                    onClick={() => editWorkflowStep(step, index)}
                                    aria-label={`Edit step ${index + 1}`}
                                    title="Edit step"
                                  >
                                    <Edit16Regular data-icon="icon-only" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="size-7 p-0 text-rose-600"
                                    onClick={() => removeWorkflowStep(index)}
                                    aria-label={`Remove step ${index + 1}`}
                                    title="Remove step"
                                  >
                                    <Delete16Regular data-icon="icon-only" />
                                  </Button>
                                </div>
                              </FluentTableCell>
                            </FluentTableRow>
                          ))}
                        </FluentTableBody>
                      </FluentTable>
                    </HorizontalScrollContainer>
                  )}
                </div>
              </div>

              <SheetFooter className="sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setWorkflowSheetOpen(false)
                    setEditingWorkflowId(null)
                    resetWorkflowForm()
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={() => void submitWorkflow()} disabled={saving}>
                  {editingWorkflowId === null ? "Create Workflow" : "Save Workflow"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Dialog
            open={stepDialogOpen}
            onOpenChange={(open) => {
              setStepDialogOpen(open)
              if (!open) {
                setChecklistItemDialogOpen(false)
                setEditingChecklistItemIndex(null)
              }
            }}
          >
            <DialogPopup from="bottom" className="sm:max-w-[980px]">
              <DialogHeader>
                <DialogTitle>{editingStepIndex === null ? "Add Workflow Step" : "Edit Workflow Step"}</DialogTitle>
                <DialogDescription>
                  Configure one step and save it to the list before creating the workflow.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-medium text-foreground md:col-span-2">
                  Step title
                  <Input
                    ref={stepTitleInputRef}
                    value={workflowForm.step_name}
                    onChange={(_, data) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        step_name: data.value,
                      }))
                    }
                    placeholder="e.g. Prepare employee workstation"
                    autoFocus
                    className="h-11 rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </label>
                {workflowForm.step_type !== "sign_off" ? (
                  <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Checklist</p>
                        <p className="text-xs text-muted-foreground">
                          Each item becomes a separately trackable task when the workflow runs.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={openCreateChecklistItemDialog}>
                        <Plus className="h-4 w-4" />
                        Add checklist item
                      </Button>
                    </div>
                    {workflowForm.step_checklist_items.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                        No checklist items yet. Add the first item to continue.
                      </div>
                    ) : (
                      <ol className="grid gap-2">
                        {workflowForm.step_checklist_items.map((item, itemIndex) => (
                          <li
                            key={`workflow-checklist-${itemIndex}`}
                            className="flex items-start gap-3 rounded-md border border-border bg-background p-3"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {itemIndex + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{item.name}</p>
                              {item.description ? (
                                <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs text-muted-foreground">No description</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditChecklistItemDialog(item, itemIndex)}
                                aria-label={`Edit checklist item ${itemIndex + 1}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setWorkflowForm((prev) => ({
                                    ...prev,
                                    step_checklist_items: prev.step_checklist_items.filter(
                                      (_, index) => index !== itemIndex
                                    ),
                                  }))
                                }
                                aria-label={`Remove checklist item ${itemIndex + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                    Sign-off records one approval and does not create checklist tasks.
                  </div>
                )}
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.step_type}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        step_type: value ?? "task",
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20">
                      <SelectValue placeholder="Step type">
                        {toTitleCaseWords(workflowForm.step_type || "task")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="sign_off">Sign Off</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose whether this step creates tasks or records an approval.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.is_required}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        is_required: value ?? "true",
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20">
                      <SelectValue placeholder="Required">{resolveYesNoLabel(workflowForm.is_required)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose Yes if onboarding cannot continue until this step is complete.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={workflowForm.due_days}
                    onChange={(event) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        due_days: event.target.value,
                      }))
                    }
                    placeholder="Due days"
                    className="h-11 rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                  <p className="text-xs text-muted-foreground">
                    Set how many days the assignee has to complete this step (at least 1).
                  </p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.assigned_department_id || "none"}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        assigned_department_id: !value || value === "none" ? "" : value,
                        assigned_user_id: "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20">
                      <SelectValue placeholder="Select department">
                        {workflowForm.assigned_department_id
                          ? selectedWorkflowDepartmentLabel
                          : "Select department"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select department</SelectItem>
                      {workflowDepartmentOptions.map((department) => {
                        return (
                          <SelectItem key={department.id} value={String(department.id)}>
                            {department.label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose the department responsible for completing this step.</p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.assigned_user_id || "none"}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        assigned_user_id: !value || value === "none" ? "" : value,
                      }))
                    }
                    disabled={!workflowForm.assigned_department_id}
                  >
                    <SelectTrigger
                      className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      aria-invalid={selectedStepAssigneeMissingPermission || undefined}
                    >
                      <SelectValue placeholder="Specific person (optional)">
                        {workflowForm.assigned_user_id
                          ? selectedStepAssigneeLabel
                          : workflowForm.assigned_department_id
                            ? "Whole department"
                            : "Select department first"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Whole department</SelectItem>
                      {assignableUsers.map((row) => {
                        const userId = preferredAssigneeId(row)
                        if (userId === null) return null
                        const label = resolveOptionLabel(
                          [row, ...users],
                          userId,
                          ["id", "company_user_id", "user_id"],
                          ["full_name", "name", "email"]
                        )
                        const hasRequiredPermission = onboardingAssigneeHasPermission(row, workflowForm.step_type)
                        return (
                          <SelectItem key={userId} value={String(userId)} data-search-text={`${label} ${userId}`}>
                            {label}{hasRequiredPermission ? "" : " — missing required permission"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {workflowForm.assigned_department_id && assignableUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No active company users are assigned to this department.
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Choose a person from the selected department, or leave this as Whole department to assign the step
                    to its active members. Assignees can track their tasks under My Requests → To do.
                  </p>
                  {selectedStepAssigneeMissingPermission ? (
                    <Alert variant="destructive" className="mt-2">
                      <ShieldAlert className="size-4" />
                      <AlertTitle>Permission required before assignment</AlertTitle>
                      <AlertDescription className="grid gap-2">
                        <p>
                          {selectedStepAssigneeLabel} cannot be assigned to this step until they have the
                          <code className="mx-1 rounded bg-destructive/10 px-1 py-0.5 text-xs">
                            {requiredStepPermission}
                          </code>
                          permission.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <Link
                                href={`/dashboard/companies?membership_id=${selectedStepAssigneeId}&permission=${encodeURIComponent(requiredStepPermission)}`}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                          >
                            Fix user permission
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={loading}
                            onClick={() => void ensureLookups(["users"], true)}
                          >
                            <RefreshCw className={cn("size-3.5", loading ? "animate-spin" : "")} />
                            Recheck permissions
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStepDialogOpen(false)
                    setEditingStepIndex(null)
                    resetWorkflowStepForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={addWorkflowStep}
                  disabled={selectedStepAssigneeMissingPermission}
                  className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  {editingStepIndex === null ? "Add Step" : "Save Step"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

          <Dialog
            open={changeWorkflowDialogOpen}
            onOpenChange={(open) => {
              setChangeWorkflowDialogOpen(open)
              if (!open) setChangeWorkflowRequest(null)
            }}
          >
            <DialogPopup from="bottom" className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Change onboarding workflow</DialogTitle>
                <DialogDescription>
                  Select the workflow that should replace the one currently attached to this request.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">
                    {readString(changeWorkflowRequest ?? {}, ["onboarding_no", "request_no", "title"])}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pending approvals and tasks from the old workflow will be replaced. A workflow cannot be changed
                    after an approval or task has been actioned.
                  </p>
                </div>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Replacement workflow
                  <Select value={replacementWorkflowId} onValueChange={(value) => setReplacementWorkflowId(value ?? "")}>
                    <SelectTrigger className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20">
                      <SelectValue placeholder="Select workflow">
                        {replacementWorkflowId
                          ? resolveWorkflowLabel(Number(replacementWorkflowId))
                          : "Select workflow"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {workflows.map((workflow) => {
                        const workflowId = readNumber(workflow, ["id", "workflow_id"])
                        if (workflowId === null) return null
                        return (
                          <SelectItem key={workflowId} value={String(workflowId)}>
                            {readString(workflow, ["name", "title"])}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setChangeWorkflowDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saving || !replacementWorkflowId} onClick={saveRequestWorkflowChange}>
                  {saving ? "Changing…" : "Change Workflow"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

          <Dialog
            open={approvalAssignmentDialogOpen}
            onOpenChange={(open) => {
              setApprovalAssignmentDialogOpen(open)
              if (!open) {
                setApprovalToReassign(null)
                setReplacementApproverId("")
                setApprovalReassignmentReason("")
                setRequestDetailsOpen(true)
              }
            }}
          >
            <DialogPopup from="bottom" className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Change approval assignee</DialogTitle>
                <DialogDescription>
                  Replace the person assigned to this pending approval. The workflow template itself is not changed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  New approver
                  <Select value={replacementApproverId} onValueChange={(value) => setReplacementApproverId(value ?? "")}>
                    <SelectTrigger
                      className="h-11 w-full rounded-md !border !border-input bg-background focus-visible:!border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      aria-invalid={replacementApproverMissingPermission || undefined}
                    >
                      <SelectValue placeholder="Select approver">
                        {replacementApprover
                          ? personDisplayName(replacementApprover) || `User #${replacementApproverMembershipId}`
                          : "Select approver"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {approvalAssignmentCandidates.map((user) => {
                        const userId = preferredAssigneeId(user)
                        if (userId === null) return null
                        const label = personDisplayName(user) || `User #${userId}`
                        const hasPermission = onboardingAssigneeHasPermission(user, "sign_off")
                        return (
                          <SelectItem key={userId} value={String(userId)}>
                            {label}{hasPermission ? "" : " — missing approval permission"}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </label>
                {replacementApproverMissingPermission ? (
                  <Alert variant="destructive">
                    <ShieldAlert className="size-4" />
                    <AlertTitle>Approval permission required</AlertTitle>
                    <AlertDescription className="grid gap-2">
                      <p>
                        This person needs <code className="text-xs">onboarding_requests:approve</code> before they can
                        replace the current approver.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          render={
                            <Link
                              href={`/dashboard/companies?membership_id=${replacementApproverMembershipId}&permission=onboarding_requests%3Aapprove`}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          Fix user permission
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={loading}
                          onClick={() => void ensureLookups(["users"], true)}
                        >
                          <RefreshCw className={cn("size-3.5", loading ? "animate-spin" : "")} />
                          Recheck permissions
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Reason for change
                  <Textarea
                    value={approvalReassignmentReason}
                    onChange={(event) => setApprovalReassignmentReason(event.target.value)}
                    placeholder="Explain why the approver is being replaced"
                    className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setApprovalAssignmentDialogOpen(false)
                    setApprovalToReassign(null)
                    setReplacementApproverId("")
                    setApprovalReassignmentReason("")
                    setRequestDetailsOpen(true)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    saving ||
                    replacementApproverMembershipId === null ||
                    replacementApproverMissingPermission ||
                    !approvalReassignmentReason.trim()
                  }
                  onClick={saveApprovalAssignment}
                >
                  {saving ? "Changing…" : "Change Approver"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

          <Dialog
            open={checklistItemDialogOpen}
            onOpenChange={(open) => {
              setChecklistItemDialogOpen(open)
              if (!open) {
                setEditingChecklistItemIndex(null)
                setChecklistItemForm({ name: "", description: "" })
              }
            }}
          >
            <DialogPopup from="bottom" className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>
                  {editingChecklistItemIndex === null ? "Add Checklist Item" : "Edit Checklist Item"}
                </DialogTitle>
                <DialogDescription>
                  Give this item a clear name and add any instructions the assignee needs.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Checklist name
                  <Input
                    value={checklistItemForm.name}
                    onChange={(event) =>
                      setChecklistItemForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Provide laptop"
                    autoFocus
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Description (optional)
                  <Textarea
                    value={checklistItemForm.description}
                    onChange={(event) =>
                      setChecklistItemForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Add specifications, access details, or other instructions"
                    className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setChecklistItemDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={saveWorkflowChecklistItem}
                  className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  {editingChecklistItemIndex === null ? "Add Item" : "Save Item"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}
    </section>
  )
}
