"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { HorizontalScrollContainer } from "@/components/common/horizontal-scroll-container"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { Ban, CheckCheck, CircleHelp, Pencil, Plus, RefreshCw, Send, Trash2, X } from "lucide-react"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"

import { cn } from "@/lib/utils"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import {
  acknowledgeOnboardingRequest,
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
  listBranches,
  listDepartments,
  listEmployees,
  listPendingEmployeeInvitations,
  listMyOnboardingRequests,
  listOnboardingDocuments,
  listOnboardingRequests,
  listOnboardingTasks,
  listOnboardingWorkflowSteps,
  listOnboardingWorkflows,
  listResource,
  listAllRoleUsers,
  listShiftResources,
  listTimetableResources,
  patchOnboardingWorkflow,
  patchOnboardingWorkflowStep,
  rejectOnboardingRequest,
  resendEmployeeInvitation,
  submitOnboardingRequest,
  uploadOnboardingDocument,
  verifyOnboardingDocument,
  type AdminRecord,
  type OnboardingProvisioning,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { BadgeCheck } from "@/components/animate-ui/icons/badge-check"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  recordHasRole,
  personDisplayName,
  recordMatchesId,
  resolveApprovalOwnerLabel,
  resolveAuditActorLabel,
  resolveResponsiblePartyLabel,
  summarizeOnboardingApprovals,
} from "@/lib/onboarding-activity-labels"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"
import { matchesEmployeeDirectorySearch } from "@/lib/employee-directory-search"

type OnboardingTab = "invitations" | "requests" | "workflows"
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
      const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
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

function invitationDeliveryValue(
  row: AdminRecord,
  channel: "email" | "sms",
  keys: string[]
) {
  const delivery = toRecord(row.delivery)
  const channelDelivery = toRecord(delivery?.[channel])
  return channelDelivery ? readString(channelDelivery, keys) : "-"
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
    toRecord(row.company_user) ??
    toRecord(row.companyUser) ??
    toRecord(row.user) ??
    toRecord(row.profile) ??
    null
  return String(
    row.employment_status ??
      row.employmentStatus ??
      nested?.employment_status ??
      nested?.employmentStatus ??
      ""
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
  },
) {
  const [main, ...draftLists] = await Promise.all([
    listOnboardingRequests(token, requestQuery),
    ...ONBOARDING_DRAFT_LIST_STATUSES.map((status) =>
      listOnboardingRequests(token, { ...requestQuery, status }).catch(() => ({
        rows: [] as AdminRecord[],
      })),
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
      readNumber(row, ["employee_id", "employeeId"]) ??
      readNumber(nested ?? {}, ["id", "employee_id", "employeeId"])
    if (id !== null) {
      ids.add(id)
    }
  })
  return ids
}

function defaultOnboardingWorkflowId(workflows: AdminRecord[]) {
  const preferred =
    workflows.find((row) => row.is_default === true || row.isDefault === true) ?? workflows[0] ?? null
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

type RequestAction =
  | "submit"
  | "approve"
  | "reject"
  | "cancel"
  | "complete"
  | "delete"

type OnboardingWorkflowStepDraft = {
  id?: number
  is_required: boolean
  name: string
  description: string
  step_type: string
  assigned_role_id?: number
  assigned_user_id?: number
  due_days: number
}

function normalizeWorkflowStep(row: AdminRecord): OnboardingWorkflowStepDraft {
  const stepId = readNumber(row, ["id", "step_id", "workflow_step_id"])
  const name = readString(row, ["name", "step_name", "title", "task_title"])
  const description = readString(row, ["description", "step_description", "details"])
  const stepType = readString(row, ["step_type", "task_type", "type"])
  const assignedRoleId = readNumber(row, ["assigned_role_id", "role_id"])
  const assignedUserId = readNumber(row, ["assigned_user_id", "company_user_id", "user_id"])
  const dueDays = readNumber(row, ["due_days", "expected_duration_days", "dueDays"])

  return {
    ...(stepId !== null && stepId > 0 ? { id: stepId } : {}),
    is_required:
      row.is_required === true ||
      row.isRequired === true ||
      String(row.is_required ?? row.isRequired ?? "true").toLowerCase() === "true",
    name: name === "-" ? "" : name,
    description: description === "-" ? "" : description,
    step_type: stepType === "-" ? "task" : stepType,
    due_days: dueDays !== null && dueDays > 0 ? dueDays : 1,
    ...(assignedRoleId !== null && assignedRoleId > 0 ? { assigned_role_id: assignedRoleId } : {}),
    ...(assignedUserId !== null && assignedUserId > 0 ? { assigned_user_id: assignedUserId } : {}),
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

const ENVELOPE_STATUS_VALUES = new Set([
  "success",
  "ok",
  "error",
  "fail",
  "failed",
  "true",
  "false",
])

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
          lower.includes("inactive") || lower.includes("disabled") || lower.includes("archived")
            ? "inactive"
            : "active"
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
  const payload: {
    is_required: boolean
    name: string
    description: string
    step_type: string
    due_days: number
    assigned_role_id?: number
    assigned_user_id?: number
  } = {
    is_required: Boolean(step.is_required),
    name: String(step.name ?? "").trim(),
    description: String(step.description ?? "").trim(),
    step_type: String(step.step_type ?? "task").trim() || "task",
    due_days: Number(step.due_days) > 0 ? Number(step.due_days) : 1,
  }
  if (typeof step.assigned_role_id === "number" && step.assigned_role_id > 0) {
    payload.assigned_role_id = step.assigned_role_id
  }
  if (typeof step.assigned_user_id === "number" && step.assigned_user_id > 0) {
    payload.assigned_user_id = step.assigned_user_id
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

  const status = normalized(
    row.status ?? row.request_status ?? row.onboarding_status ?? row.workflow_status
  )

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
  if (value === "draft" || value === "pending" || value === "submitted" || value === "in_review" || value === PENDING_ONBOARDING_STATUS) {
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
  const detail = [model, vendor, integrationType, branchLabel]
    .filter((value) => value !== "-")
    .join(" • ")

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
        className={cn(
          "overflow-y-auto rounded-md border border-slate-200 bg-white",
          compact ? "max-h-28" : "max-h-44"
        )}
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
    () =>
      searchParams?.get("highlight") ??
      searchParams?.get("requestId") ??
      searchParams?.get("request_id") ??
      "",
    [searchParams]
  )
  const requestedTab = searchParams?.get("tab") ?? ""
  const actor = useDashboardActor()
  const actorPermissions = actor.permissionLabels
  const isEmployeeMode = actor.ready ? actor.accessMode === "employee" || !actor.isAdmin : false
  const canViewOnboardingRequests = React.useMemo(
    () =>
      actor.ready &&
      (isEmployeeMode ||
        canPerformPermission(actorPermissions, {
          permissions: [
            "onboarding_requests:read",
            "onboarding_requests:create",
            "onboarding_requests:update",
            "onboarding_requests:approve",
            "onboarding_requests:cancel",
            "onboarding_requests:complete",
          ],
          mode: "any",
        })),
    [actor.ready, actorPermissions, isEmployeeMode],
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
    [actor.ready, actorPermissions],
  )
  const canViewPendingInvitations = React.useMemo(
    () =>
      actor.ready &&
      canPerformPermission(actorPermissions, {
        permissions: [
          "employees:create",
          "onboarding_requests:read",
          "onboarding_workflows:read",
        ],
        mode: "any",
      }),
    [actor.ready, actorPermissions],
  )
  const canResendPendingInvitations = React.useMemo(
    () => canPerformPermission(actorPermissions, "employees:create"),
    [actorPermissions],
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
    requestedTab === "invitations" ? "invitations" : "requests",
  )
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [users, setUsers] = React.useState<AdminRecord[]>([])
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
  const [showDocumentComposer, setShowDocumentComposer] = React.useState(false)
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null)
  const [documentForm, setDocumentForm] = React.useState({
    title: "",
    description: "",
    document_type_code: "",
    expiry_date: "",
  })
  const [showTaskComposer, setShowTaskComposer] = React.useState(false)
  const [taskForm, setTaskForm] = React.useState({
    title: "",
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
    step_type: "task",
    due_days: "1",
    is_required: "true",
    assigned_user_id: "",
    assigned_role_id: "",
  })
  const [workflowSteps, setWorkflowSteps] = React.useState<OnboardingWorkflowStepDraft[]>([])
  const [persistedWorkflowStepIds, setPersistedWorkflowStepIds] = React.useState<number[]>([])
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const [roleUsers, setRoleUsers] = React.useState<AdminRecord[]>([])
  const [roleUsersLoading, setRoleUsersLoading] = React.useState(false)
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null)
  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<number | null>(null)
  const [requestSheetOpen, setRequestSheetOpen] = React.useState(false)
  const [selectedInvitation, setSelectedInvitation] = React.useState<AdminRecord | null>(null)

  React.useEffect(() => {
    if (requestedTab === "invitations") {
      setActiveTab("invitations")
    }
  }, [requestedTab])

  const resolveBranchLabel = React.useCallback(
    (branchId: number | null) =>
      resolveOptionLabel(branches, branchId, ["id", "branch_id"], ["name", "title"]),
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

  const loadLookups = React.useCallback(async (token: string, lookupKeys: OnboardingLookupKey[], force = false) => {
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
            return { key, result: await listOnboardingWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "users": {
            const companyUsers = await listAllCurrentCompanyUsers(token, { maxPages: 30 }).catch(
              () => [] as AdminRecord[],
            )
            return {
              key,
              result: {
                rows: companyUsers,
                page: 1,
                limit: companyUsers.length,
                total: companyUsers.length,
                totalPages: 1,
              },
            }
          }
          case "roles":
            return { key, result: await listResource("roles", token) }
          case "branches":
            return { key, result: await listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "departments":
            return { key, result: await listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "shifts":
            return { key, result: await listShiftResources(token, "shifts", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
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
            return { key, result: await listTimetableResources(token, "timetables", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "accessGroups":
            return { key, result: await listAccessControlResources(token, "groups", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "accessOrganizations":
            return { key, result: await listAccessControlResources(token, "organizations", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "attendanceDevices":
            return { key, result: await listAttendanceDevices(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
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
  }, [loadedLookups])

  const ensureLookups = React.useCallback(async (lookupKeys: OnboardingLookupKey[], force = false) => {
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
  }, [loadLookups])

  const reloadAll = React.useCallback(async (targetTab: OnboardingTab = activeTab, force = false) => {
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
        requestEmployeeFilter && Number(requestEmployeeFilter) > 0
          ? Number(requestEmployeeFilter)
          : undefined,
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
        ? "invitations:pending"
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
        const invitationRows = await listPendingEmployeeInvitations(token)
        setInvitations(invitationRows)
        invitationsFetchKeyRef.current = fetchKey
      } else if (targetTab === "requests") {
        if (isEmployeeMode) {
          const mine = await listMyOnboardingRequests(token)
          setRequests(mine)
          requestsFetchKeyRef.current = fetchKey
        } else {
          const [requestRowsResult, employeesResult, recentEmployeesResult, workflowsResult] =
            await Promise.all([
            listOnboardingRequestsIncludingDrafts(token, requestQuery),
            listEmployees(token, {
              page: 1,
              limit: 200,
              sortBy: "created_at",
              sortOrder: "DESC",
              employment_status: "onboarding",
            }),
            listEmployees(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            }),
            listOnboardingWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
          ])
          const onboardingEmployees = mergeEmployeeRows(
            employeesResult.rows,
            recentEmployeesResult.rows,
          ).filter(isOnboardingEligibleEmployee)
          setEmployees(onboardingEmployees)
          setWorkflows(workflowsResult.rows)
          setLoadedLookups((current) => ({ ...current, employees: true, workflows: true }))

          let requestRows = requestRowsResult
          const defaultWorkflowId = defaultOnboardingWorkflowId(workflowsResult.rows)
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
                const name =
                  getEmployeeDisplayName(employee) || formatEmployeeOptionLabel(employee, employeeId)
                return ensureDraftOnboardingRequest(token, {
                  employee_id: employeeId,
                  workflow_id: defaultWorkflowId ?? undefined,
                  title:
                    name && name !== "Unknown employee"
                      ? `Onboarding for ${name}`
                      : "Onboarding",
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
  }, [
    activeTab,
    debouncedRequestSearch,
    debouncedWorkflowSearch,
    loadLookups,
    isEmployeeMode,
    canCreateOnboardingRequests,
    requestEmployeeFilter,
    requestStatusFilter,
    workflowStatusFilter,
  ])

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
  }, [
    activeTab,
    actor.ready,
    canViewOnboardingRequests,
    canViewOnboardingWorkflows,
    canViewPendingInvitations,
  ])

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
      const value = String(row.status ?? "").trim().toLowerCase()
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

  const resendPendingInvitation = React.useCallback(async (row: AdminRecord) => {
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
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to resend the invitation."
      )
    } finally {
      setResendingInvitationId(null)
    }
  }, [reloadAll])

  const selectableEmployees = React.useMemo(
    () => employees.filter(isOnboardingEligibleEmployee),
    [employees]
  )

  const employeeLabelById = React.useMemo(() => {
    const map = new Map<number, string>()
    employees.forEach((row) => {
      const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
      if (employeeId === null) return
      map.set(employeeId, formatEmployeeOptionLabel(row, employeeId))
    })
    return map
  }, [employees])

  const requestRowEmployeeLabel = React.useCallback((row: AdminRecord) => {
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
  }, [employeeLabelById])

  const filteredRequests = React.useMemo(() => {
    const searchValue = requestSearch.trim().toLowerCase()
    return requests.filter((row) => {
      const statusValue = String(row.status ?? "").trim().toLowerCase()
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
      const statusValue = String(row.status ?? "").trim().toLowerCase()
      if (workflowStatusFilter !== "all" && statusValue !== workflowStatusFilter) {
        return false
      }
      if (!searchValue) {
        return true
      }
      return [row.id, row.workflow_id, row.name, row.title, row.description, row.status, row.is_default]
        .some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(searchValue)
        )
    })
  }, [workflowSearch, workflowStatusFilter, workflows])

  const workflowStatusOptions = React.useMemo(() => {
    const statuses = new Set<string>(WORKFLOW_STATUS_FILTER_OPTIONS)
    workflows.forEach((row) => {
      const value = String(row.status ?? "").trim().toLowerCase()
      if (value) statuses.add(value)
    })
    return Array.from(statuses)
  }, [workflows])

  function resolveOptionLabel(
    rows: AdminRecord[],
    id: number | null,
    idKeys: string[],
    labelKeys: string[]
  ) {
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
      shiftAssignment:
        mode === "shift"
          ? previous.shiftAssignment
          : { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
      timetableAssignment:
        mode === "timetable"
          ? previous.timetableAssignment
          : { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
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
    const roleId = Number(workflowForm.assigned_role_id)
    const selectedId = Number(workflowForm.assigned_user_id)
    const hasRole = Number.isFinite(roleId) && roleId > 0
    const roleSource = roleUsers.map(flattenAssigneeRecord)
    const catalog = users.map(flattenAssigneeRecord)
    const source = hasRole && roleSource.length > 0 ? roleSource : catalog
    const filtered = filterAssigneesForStep(source, {
      roleId: hasRole && roleSource.length === 0 ? roleId : null,
      selectedId: Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null,
    })
    const usable = filtered.length > 0 ? filtered : catalog
    const seen = new Set<number>()
    return usable.filter((row) => {
      const id = preferredAssigneeId(row)
      if (id === null || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [roleUsers, users, workflowForm.assigned_role_id, workflowForm.assigned_user_id])

  React.useEffect(() => {
    const roleId = Number(workflowForm.assigned_role_id)
    if (!Number.isFinite(roleId) || roleId <= 0) {
      setRoleUsers([])
      setRoleUsersLoading(false)
      return
    }
    const token = readStoredToken()
    if (!token) {
      setRoleUsers([])
      return
    }
    let cancelled = false
    setRoleUsersLoading(true)
    void (async () => {
      try {
        const result = await listAllRoleUsers(token, roleId, { maxPages: 30 })
        if (!cancelled) {
          setRoleUsers(result.map(flattenAssigneeRecord))
        }
      } catch {
        if (!cancelled) {
          setRoleUsers([])
        }
      } finally {
        if (!cancelled) {
          setRoleUsersLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workflowForm.assigned_role_id])

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
        : [{ id: assignedId, full_name: `User #${assignedId}` }, ...current],
    )
    return String(assignedId)
  }

  function resetWorkflowStepForm() {
    setWorkflowForm((prev) => ({
      ...prev,
      step_name: "",
      step_description: "",
      step_type: "task",
      due_days: "1",
      is_required: "true",
      assigned_user_id: "",
      assigned_role_id: "",
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
      step_type: "task",
      due_days: "1",
      is_required: "true",
      assigned_user_id: "",
      assigned_role_id: "",
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
      document_type_code: "",
      expiry_date: "",
    })
    setDocumentUploadFile(null)
  }

  function resetTaskForm() {
    setTaskForm({
      title: "",
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
      return { error: "Step name is required.", step: null as AdminRecord | null }
    }

    if (!workflowForm.step_description.trim()) {
      return { error: "Step description is required.", step: null as AdminRecord | null }
    }

    const dueDays = Number(workflowForm.due_days)
    if (!Number.isFinite(dueDays) || dueDays < 1) {
      return { error: "Due days must be 1 or greater.", step: null as AdminRecord | null }
    }

    const assignedRoleId = Number(workflowForm.assigned_role_id)
    const assignedUserId = Number(workflowForm.assigned_user_id)
    const hasAssignedRole = Number.isFinite(assignedRoleId) && assignedRoleId > 0
    const hasAssignedUser = Number.isFinite(assignedUserId) && assignedUserId > 0

    if (!hasAssignedRole && !hasAssignedUser) {
      return { error: "Select at least a role or a user for this step.", step: null as AdminRecord | null }
    }

    const stepPayload: OnboardingWorkflowStepDraft = {
      is_required: workflowForm.is_required === "true",
      name: workflowForm.step_name.trim(),
      description: workflowForm.step_description.trim(),
      step_type: workflowForm.step_type.trim() || "task",
      due_days: dueDays,
    }

    if (hasAssignedRole) {
      stepPayload.assigned_role_id = assignedRoleId
    }
    if (hasAssignedUser) {
      stepPayload.assigned_user_id = assignedUserId
    }

    return { error: null, step: stepPayload }
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
      const loaded = await ensureLookups(["roles", "users"])
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
      const loaded = await ensureLookups(["roles", "users"])
      if (!loaded) {
        return
      }
      setEditingStepIndex(index)
      const assignedUserSelectValue = await hydrateAssignedUser(
        typeof step.assigned_user_id === "number" ? step.assigned_user_id : null,
      )
      setWorkflowForm((prev) => ({
        ...prev,
        step_name: String(step.name ?? ""),
        step_description: String(step.description ?? ""),
        step_type: String(step.step_type ?? "task"),
        due_days: String(step.due_days ?? "1"),
        is_required: String(step.is_required ?? true) === "true" ? "true" : "false",
        assigned_user_id: assignedUserSelectValue,
        assigned_role_id: typeof step.assigned_role_id === "number" ? String(step.assigned_role_id) : "",
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
      listRow ??
      workflows.find((row) => readNumber(row, ["id", "workflow_id"]) === workflowId) ??
      null

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
      step_type: "task",
      due_days: "1",
      is_required: "true",
      assigned_user_id: "",
      assigned_role_id: "",
    }))
    setWorkflowSteps(listSteps)
    setPersistedWorkflowStepIds(
      listSteps
        .map((step) => step.id)
        .filter((stepId): stepId is number => typeof stepId === "number" && stepId > 0)
    )
    setWorkflowSheetOpen(true)

    // Lookups are only needed for step assignment dropdowns; don't block showing details.
    void ensureLookups(["roles", "users"])

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
        step_type: "task",
        due_days: "1",
        is_required: "true",
        assigned_user_id: "",
        assigned_role_id: "",
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
    const loaded = await ensureLookups(["roles", "users"])
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
    const cloneName =
      sourceName !== "-" ? `${sourceName} Copy` : `Workflow ${workflowId} Copy`

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
        employees.find((row) => readNumber(row, ["id", "employee_id", "user_id"]) === Number(requestForm.employee_id)) ??
        null
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
        if (
          createdRequestId !== null &&
          (isOnboardingDraftStatus(createdStatus) || createdStatus === "-")
        ) {
          submittedRequest = await submitOnboardingRequest(token, createdRequestId, {
            ...(createdRecord ?? {}),
            employee_id: Number(requestForm.employee_id),
            ...(requestForm.workflow_id
              ? { workflow_id: Number(requestForm.workflow_id) }
              : {}),
          })
        }
        void notifySubmittedRequestApprovers({
          kind: "onboarding_request",
          token,
          request: submittedRequest,
          requesterName: selectedEmployee ? formatEmployeeOptionLabel(selectedEmployee, Number(requestForm.employee_id)) : undefined,
          loadRequest:
            createdRequestId === null
              ? undefined
              : () => getOnboardingRequest(token, createdRequestId),
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
        const workflowId = readNumber(sourceRow ?? {}, ["workflow_id", "onboarding_workflow_id"])
        const submittedRequest = await submitOnboardingRequest(
          token,
          requestId,
          {
            ...(sourceRow ?? {}),
            ...(workflowId !== null ? { workflow_id: workflowId } : {}),
          }
        )
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
        await rejectOnboardingRequest(token, requestId, { comments: "Rejected" })
      } else if (action === "cancel") {
        await cancelOnboardingRequest(token, requestId, { reason: "Cancelled by admin" })
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
          action === "delete"
            ? "Onboarding request removed from list."
            : `Onboarding request ${action}d successfully.`
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
      detailRecord.steps ??
        detailRecord.workflow_steps ??
        detailRecord.tasks ??
        detailRecord.activities
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
      const matchedProgress =
        progressByKey.get(stepIdKey) ?? progressByKey.get(stepNameKey) ?? null
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
      const owner = resolveResponsibleParty(source) !== "-" ? resolveResponsibleParty(source) : resolveResponsibleParty(step)
      const actionLabel = readString(step, ["action_type", "task_type", "name", "title", "step_name"])
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
      summarizeOnboardingApprovals(
        [selectedRequestDetails, selectedRequestProgress, selectedRequestRow],
        roles,
        users
      ),
    [roles, selectedRequestDetails, selectedRequestProgress, selectedRequestRow, users]
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
          ? branchAccessIds.map((id) =>
              resolveProvisioningLabel(branches, id, ["id", "branch_id"], ["name", "title"])
            )
          : [],
      attendanceMode:
        provisioning?.attendance_mode && String(provisioning.attendance_mode).trim()
          ? toTitleCaseWords(String(provisioning.attendance_mode))
          : "-",
      shiftLabel:
        shiftAssignment?.shift_id
          ? resolveProvisioningLabel(
              shiftRecords,
              shiftAssignment.shift_id,
              ["id", "shift_id"],
              ["name", "title", "code"]
            )
          : "-",
      shiftEffectiveFrom: shiftAssignment?.effective_from || "-",
      shiftEffectiveTo: shiftAssignment?.effective_to || "-",
      rotationGroupLabel:
        shiftAssignment?.rotation_group_id
          ? resolveProvisioningLabel(
              rotationGroupRecords,
              shiftAssignment.rotation_group_id,
              ["id", "rotation_group_id", "rotationGroupId", "shift_rotation_group_id"],
              ["name", "title", "rotation_group_name", "code"]
            )
          : "-",
      timetableLabel:
        timetableAssignment?.timetable_id
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
      accessGroupLabel:
        deviceAssignment?.access_group_id
          ? resolveProvisioningLabel(
              accessGroups,
              deviceAssignment.access_group_id,
              ["id", "access_group_id"],
              ["name", "title"]
            )
          : "-",
      organizationLabel:
        deviceAssignment?.organization_id
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
        typeof deviceAssignment?.max_open_door_time === "number"
          ? String(deviceAssignment.max_open_door_time)
          : "-",
      openDoorTime:
        typeof deviceAssignment?.open_door_time === "number"
          ? String(deviceAssignment.open_door_time)
          : "-",
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

  const resolveRequestTaskOwner = React.useCallback((task: AdminRecord) => {
    const nestedUser =
      toRecord(task.assigned_company_user) ??
      toRecord(task.assignee) ??
      toRecord(task.user) ??
      null
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
  }, [departments, users])

  function readCurrentRequestId() {
    return readNumber(selectedRequestDetails ?? selectedRequestRow ?? {}, ["id", "request_id"])
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
        document_type_code: documentForm.document_type_code.trim() || undefined,
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

  async function downloadRequestDocument(documentRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const documentId = readNumber(documentRow, ["id", "document_id"])
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Missing document identifiers.")
      return
    }

    setSaving(true)
    try {
      const result = await downloadOnboardingDocument(token, requestId, documentId)
      const url = window.URL.createObjectURL(result.blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      showSuccessAlert("Document download started.")
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to download document.")
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
    if (!taskForm.title.trim()) {
      showErrorAlert("Task title is required.")
      return
    }

    setSaving(true)
    try {
      await createOnboardingTask(token, requestId, {
        title: taskForm.title.trim(),
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
      showSuccessAlert("Onboarding task created.")
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
        completion_notes: "Completed by admin",
      })
      showSuccessAlert("Onboarding task completed.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to complete task.")
    } finally {
      setSaving(false)
    }
  }

  async function acknowledgeSelectedRequest() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }
    const version =
      readString(selectedRequestDetails ?? selectedRequestRow ?? {}, [
        "employee_acknowledgement_version",
        "acknowledgement_version",
      ])
    const acknowledgementVersion = version && version !== "-" ? version : "v1"
    setSaving(true)
    try {
      await acknowledgeOnboardingRequest(token, requestId, {
        accepted: true,
        acknowledgement_version: acknowledgementVersion,
      })
      showSuccessAlert("Onboarding acknowledgement recorded.")
      await reloadCurrentRequestActivity(requestId)
      await reloadAll("requests", true)
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error ? errorObject.message : "Failed to acknowledge onboarding."
      )
    } finally {
      setSaving(false)
    }
  }

  async function delegateSelectedApproval(approvalRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const approvalId = readNumber(approvalRow, ["id", "approval_id"])
    if (!token || requestId === null || approvalId === null) {
      showErrorAlert("Missing approval identifiers.")
      return
    }
    const target = window.prompt("Delegate to company user id")
    const reason = window.prompt("Reason")
    if (!target || !reason) return
    setSaving(true)
    try {
      await delegateOnboardingApproval(token, requestId, approvalId, {
        delegate_company_user_id: Number(target),
        reason,
      })
      showSuccessAlert("Onboarding approval delegated.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Delegate failed.")
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
    setShowDocumentComposer(false)
    setShowTaskComposer(false)
    resetDocumentForm()
    resetTaskForm()

    try {
      const lookupsPromise = loadLookups(token, ["roles", "users"])
      const [detail, progress, auditLogs, documents, tasks] = await Promise.all([
        getOnboardingRequest(token, requestId),
        getOnboardingProgress(token, requestId),
        getOnboardingAuditLogs(token, requestId),
        listOnboardingDocuments(token, requestId),
        listOnboardingTasks(token, requestId),
      ])
      await lookupsPromise
      setSelectedRequestDetails(detail)
      setSelectedRequestProgress(progress)
      setSelectedRequestAuditLogs(auditLogs)
      setSelectedRequestDocuments(documents)
      setSelectedRequestTasks(tasks)

      const assignedWorkflow = detail
        ? toRecord(detail.workflow ?? detail.assigned_workflow)
        : null
      const workflowId =
        (detail ? readNumber(detail, ["workflow_id", "onboarding_workflow_id"]) : null) ??
        readNumber(row, ["workflow_id", "onboarding_workflow_id"]) ??
        (assignedWorkflow ? readNumber(assignedWorkflow, ["id", "workflow_id"]) : null)
      if (workflowId !== null) {
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

    const highlightedRow =
      requests.find((row) =>
        String(readNumber(row, ["id", "request_id"]) ?? "") === highlightedRequestId
      ) ?? { id: highlightedRequestId, request_id: highlightedRequestId }

    openedHighlightedRequestRef.current = highlightedRequestId
    void openRequestDetails(highlightedRow)
  }, [activeTab, highlightedRequestId, requests])

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
      allowedActions.has("approve")
    const canReject =
      !pendingEmployee &&
      canApproveOnboardingRequests &&
      !isDraft &&
      !isCancelled &&
      !isCompleted &&
      allowedActions.has("reject")
    const canCancel =
      !pendingEmployee &&
      canCancelOnboardingRequests &&
      !isCancelled &&
      !isCompleted &&
      allowedActions.has("cancel")
    const canComplete =
      !pendingEmployee &&
      canCompleteOnboardingRequests &&
      !isCancelled &&
      !isCompleted &&
      allowedActions.has("complete")
    const canDelete =
      !pendingEmployee && canUpdateOnboardingRequests && allowedActions.has("delete")

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
        {!pendingEmployee &&
        !canSubmit &&
        !canApprove &&
        !canReject &&
        !canCancel &&
        !canComplete &&
        !canDelete ? (
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
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                  statusBadgeClass(status)
                )}
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
            {requestNo !== "-" ? (
              <p className="truncate text-[11px] text-muted-foreground">{requestNo}</p>
            ) : null}
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
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(requestStatus)}`}>
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
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(workflowStatus)}`}>
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
                variant="outline"
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
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={() => void cloneWorkflow(workflowId, row)}
                aria-label={`Clone workflow ${workflowId ?? ""}`}
                title="Clone workflow"
                disabled={saving}
              >
                Copy
              </Button>
            ) : null}
            {canDeleteOnboardingWorkflows ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
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
    <div className="space-y-2 px-4 pb-6 pt-2 lg:px-6">
      <div className="tab-rail-scroll">
        <div className="inline-flex min-w-full items-center gap-1 border-b border-border/80">
          {canViewPendingInvitations ? (
            <button
              type="button"
              onClick={() => setActiveTab("invitations")}
              className={cn(
                "shrink-0 border-b-2 px-1.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-200",
                activeTab === "invitations"
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
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
                  : "border-transparent text-slate-600 hover:text-slate-900"
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
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              Workflows
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {activeTab === "invitations" && canViewPendingInvitations ? (
        <div className="space-y-2">
          <ResizableTable
            title="Pending Employee Invitations"
            data={filteredInvitations}
            columns={invitationColumns}
            loading={loading}
            storageKey="pending-employee-invitations"
            enableAnimations
            itemsPerPage={15}
            showExport={false}
            getRowId={(row, index) =>
              String(readNumber(row, ["id", "invitation_id"]) ?? index)
            }
            onRowSelect={(_, row) => setSelectedInvitation(row ?? null)}
            toolbarStart={
              <SearchToggleField
                className="min-w-0 !w-auto !max-w-[14rem] !flex-none"
                placeholder="Search name, email or phone"
                value={invitationSearch}
                onChange={setInvitationSearch}
              />
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
                      ["Status", toTitleCaseWords(readString(selectedInvitation, ["status"]))],
                      ["Email", readString(selectedInvitation, ["email"])],
                      ["Phone", readString(selectedInvitation, ["phone"])],
                      ["Employment type", toTitleCaseWords(readString(selectedInvitation, ["employment_type"]))],
                      ["Sent", formatInvitationDate(selectedInvitation.created_at ?? selectedInvitation.createdAt)],
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
                    const lastError = invitationDeliveryValue(selectedInvitation, channel, ["last_error", "lastError"])
                    const messageId = invitationDeliveryValue(selectedInvitation, channel, ["message_id", "messageId"])
                    const transport = invitationDeliveryValue(selectedInvitation, channel, ["transport"])
                    const deliveryService =
                      transport === "system_smtp" || (transport === "-" && channel === "email")
                        ? "Platform SMTP (MAIL_*)"
                        : transport === "sms_gateway" || (transport === "-" && channel === "sms")
                          ? "SMS gateway"
                          : transport
                    const failureReason =
                      lastError !== "-"
                        ? lastError
                        : status.toLowerCase() === "failed"
                          ? "The current backend did not return the stored failure reason. Deploy the backend update, then resend to capture the latest provider error."
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
                            {toTitleCaseWords(status)}
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
                            <dt className="font-medium text-muted-foreground">Failure reason</dt>
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
                    Invitation emails use the platform SMTP connection, not a company report SMTP profile. You can test both from the dedicated{" "}
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
                <SearchToggleField
                  className="min-w-0 !w-auto !max-w-[14rem] !flex-none"
                  placeholder="Search name, email, phone, user_no"
                  value={requestSearch}
                  onChange={setRequestSearch}
                />
                <select
                  className="h-8 min-w-[8.5rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                  value={requestStatusFilter}
                  onChange={(event) => setRequestStatusFilter(event.target.value)}
                  aria-label="Filter request status"
                >
                  {requestStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? "All statuses" : toTitleCaseWords(status)}
                    </option>
                  ))}
                </select>
                {isEmployeeMode ? null : (
                  <select
                    className="h-8 min-w-[9rem] max-w-[12rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                    value={requestEmployeeFilter}
                    onChange={(event) => setRequestEmployeeFilter(event.target.value)}
                    aria-label="Filter by employee"
                  >
                    <option value="">All employees</option>
                    {employees.map((row, index) => {
                      const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
                      if (employeeId === null) return null
                      return (
                        <option key={`req-emp-${employeeId}-${index}`} value={String(employeeId)}>
                          {resolveEmployeeLabel(employeeId)}
                        </option>
                      )
                    })}
                  </select>
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
                      Start onboarding for an employee. Fill the basics first; add provisioning only if they need
                      system access setup now.
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
                          onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="e.g. Onboarding for Jane Doe"
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Employee
                        <Select
                          value={requestForm.employee_id}
                          onValueChange={(value) => setRequestForm((prev) => ({ ...prev, employee_id: value ?? "" }))}
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
                          onValueChange={(value) => setRequestForm((prev) => ({ ...prev, workflow_id: value ?? "" }))}
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
                          onValueChange={(value) => setRequestForm((prev) => ({ ...prev, submit: value ?? "true" }))}
                        >
                          <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                            <SelectValue placeholder="Submission mode">
                              {resolveBooleanLabel(requestForm.submit)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className={selectPopupClassName}>
                            <SelectItem value="true" className="text-slate-900">Submit immediately</SelectItem>
                            <SelectItem value="false" className="text-slate-900">Save as draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Planned start
                        <Input
                          className="h-9"
                          type="date"
                          value={requestForm.planned_start_date}
                          onChange={(event) =>
                            setRequestForm((prev) => ({ ...prev, planned_start_date: event.target.value }))
                          }
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                        Planned completion
                        <Input
                          className="h-9"
                          type="date"
                          value={requestForm.planned_completion_date}
                          onChange={(event) =>
                            setRequestForm((prev) => ({ ...prev, planned_completion_date: event.target.value }))
                          }
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                        Description
                        <Input
                          className="h-9"
                          value={requestForm.description}
                          onChange={(event) =>
                            setRequestForm((prev) => ({ ...prev, description: event.target.value }))
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
                              shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
                              timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
                              deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
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
                              Provisioning means preparing the employee&apos;s access before or during onboarding:
                              which roles they get, which branches they can work in, their shift or timetable, and
                              which attendance/access devices they should appear on. Turn this on only if you want
                              to set those up now; you can skip it and configure access later.
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
                                  <SelectItem value="none" className="text-slate-900">None for now</SelectItem>
                                  <SelectItem value="shift" className="text-slate-900">Shift</SelectItem>
                                  <SelectItem value="timetable" className="text-slate-900">Timetable</SelectItem>
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
                                      <SelectItem value="none" className="text-slate-900">Select shift</SelectItem>
                                      {requestShiftOptions.map((option) => (
                                        <SelectItem key={option.id} value={String(option.id)} className="text-slate-900">
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective from
                                  <Input
                                    className="h-9"
                                    type="date"
                                    value={requestProvisioning.shiftAssignment.effectiveFrom}
                                    onChange={(event) =>
                                      updateRequestShiftAssignmentField("effectiveFrom", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective to
                                  <Input
                                    className="h-9"
                                    type="date"
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
                                            ? requestRotationGroupOptions.find(
                                                (option) =>
                                                  String(option.id) ===
                                                  requestProvisioning.shiftAssignment.rotationGroupId
                                              )?.label ??
                                              `Rotation group #${requestProvisioning.shiftAssignment.rotationGroupId}`
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
                                      <SelectItem value="none" className="text-slate-900">Select timetable</SelectItem>
                                      {requestTimetableOptions.map((option) => (
                                        <SelectItem key={option.id} value={String(option.id)} className="text-slate-900">
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective from
                                  <Input
                                    className="h-9"
                                    type="date"
                                    value={requestProvisioning.timetableAssignment.effectiveFrom}
                                    onChange={(event) =>
                                      updateRequestTimetableAssignmentField("effectiveFrom", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Effective to
                                  <Input
                                    className="h-9"
                                    type="date"
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
                                      <SelectItem value="none" className="text-slate-900">Select access group</SelectItem>
                                      {requestAccessGroupOptions.map((option) => (
                                        <SelectItem key={option.id} value={String(option.id)} className="text-slate-900">
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
                                      <SelectItem value="none" className="text-slate-900">None</SelectItem>
                                      {requestAccessOrganizationOptions.map((option) => (
                                        <SelectItem key={option.id} value={String(option.id)} className="text-slate-900">
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
                                          (option) => option.value === requestProvisioning.deviceAssignment.userVerifyMode
                                        )?.label ?? "Select verify mode"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className={selectPopupClassName}>
                                      <SelectItem value="none" className="text-slate-900">Not set</SelectItem>
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
                                  <Input
                                    className="h-9 bg-white text-slate-900"
                                    type="datetime-local"
                                    value={requestProvisioning.deviceAssignment.validBeginTime}
                                    onChange={(event) =>
                                      updateRequestDeviceAssignmentField("validBeginTime", event.target.value)
                                    }
                                  />
                                </label>
                                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                                  Valid until
                                  <Input
                                    className="h-9 bg-white text-slate-900"
                                    type="datetime-local"
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
                  <Button
                    type="button"
                    className="h-9 px-3"
                    onClick={() => void submitRequest()}
                    disabled={saving}
                  >
                    {saving ? "Creating…" : "Create Request"}
                  </Button>
                </footer>
              </div>
            </SheetContent>
          </Sheet>

          <Dialog open={requestDetailsOpen} onOpenChange={setRequestDetailsOpen}>
            <DialogPopup from="bottom" className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Onboarding Request Activity</DialogTitle>
                <DialogDescription>
                  View workflow ownership, pending step, and completed activity history for this request.
                </DialogDescription>
              </DialogHeader>

              {requestDetailsLoading ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  Loading request activity...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Request ID</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {readNumber(selectedRequestRow ?? {}, ["id", "request_id"]) ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {resolveEmployeeLabel(readNumber(selectedRequestRow ?? {}, ["employee_id"]))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {readString(selectedRequestRow ?? {}, ["status", "request_status"])}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Updated</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {toTimestamp(
                          readString(selectedRequestRow ?? {}, ["updated_at", "modified_at", "created_at"])
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold text-slate-900">Submitted Request</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Submission Mode</p>
                        <p className="text-sm text-slate-900">
                          {resolveBooleanLabel(
                            String(selectedRequestDetails?.submit ?? selectedRequestRow?.submit ?? "false")
                          )}
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
                            selectedRequestDetails?.planned_start_date ??
                              selectedRequestRow?.planned_start_date
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
                  </div>

                  {isOnboardingActableStatus(
                    readString(selectedRequestDetails ?? selectedRequestRow ?? {}, [
                      "status",
                      "request_status",
                    ])
                  ) ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                        Pending approval
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{approvalSummary.waitingLabel}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Only the assigned approver for the current workflow level can approve or reject.
                      </p>
                    </div>
                  ) : null}

                  {(() => {
                    const acknowledgedAt = readString(
                      selectedRequestDetails ?? selectedRequestRow ?? {},
                      ["employee_acknowledged_at", "employeeAcknowledgedAt"]
                    )
                    const needsAcknowledgement = !acknowledgedAt || acknowledgedAt === "-"
                    return (
                      <div className="space-y-3 rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Employee acknowledgement</p>
                            <p className="text-xs text-muted-foreground">
                              {needsAcknowledgement
                                ? "Record that the employee has reviewed this onboarding request."
                                : `Acknowledged ${toTimestamp(acknowledgedAt)}.`}
                            </p>
                          </div>
                          {needsAcknowledgement ? (
                            <Button
                              type="button"
                              className="h-8 px-3 text-xs"
                              disabled={saving}
                              onClick={() => void acknowledgeSelectedRequest()}
                            >
                              Acknowledge
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Approval trail</p>
                      <p className="text-xs text-muted-foreground">
                        {approvalSummary.currentLevel > 0
                          ? `Current level ${approvalSummary.currentLevel}. ${approvalSummary.waitingLabel}.`
                          : approvalSummary.waitingLabel}
                      </p>
                    </div>
                    {approvalSummary.rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No approval records on this request.</p>
                    ) : (
                      <div className="space-y-2">
                        {approvalSummary.rows.map((approval, index) => (
                          <div
                            key={`onboarding-approval-${approval.id ?? index}`}
                            className={cn(
                              "rounded-md border bg-white p-3",
                              approval.isCurrent ? "border-amber-300" : "border-slate-200"
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">
                                {approval.name ||
                                  readString(approval.raw, ["title", "step_name", "approval_name", "name"]) ||
                                  `Level ${approval.level || index + 1}`}
                              </p>
                              <span className="text-xs text-slate-500">
                                {toTitleCaseWords(approval.status || "pending")}
                                {approval.level > 0 ? ` • Level ${approval.level}` : ""}
                                {approval.isCurrent ? " • Current" : ""}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              Approver:{" "}
                              <span className="font-medium text-slate-800">{approval.name || "-"}</span>
                            </p>
                            {approval.comments ? (
                              <p className="mt-1 text-xs text-slate-600">{approval.comments}</p>
                            ) : null}
                            {canApproveOnboardingRequests ? (
                              <button
                                type="button"
                                className="mt-2 text-xs font-medium text-primary"
                                onClick={() => void delegateSelectedApproval(approval.raw)}
                              >
                                Delegate
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedRequestProvisioningSummary ? (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                      <p className="text-sm font-semibold text-slate-900">Provisioning Summary</p>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.attendanceMode}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Shift</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.shiftLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Shift Effective From</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.shiftEffectiveFrom}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Shift Effective To</p>
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
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.timetableLabel}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Timetable Effective From</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.timetableEffectiveFrom}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Timetable Effective To</p>
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
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Device Employee No</p>
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
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.validEnabled}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valid Begin Time</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.validBeginTime}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valid End Time</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.validEndTime}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Verify Mode</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.userVerifyMode}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Local UI Right</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.localUiRight}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Close Delay Enabled</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.closeDelayEnabled}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Max Open Door Time</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.maxOpenDoorTime}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Open Door Time</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.openDoorTime}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sync Now</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.syncNow}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Continue On Error</p>
                          <p className="text-sm text-slate-900">
                            {selectedRequestProvisioningSummary.continueOnError}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3 rounded-lg border border-border p-4">
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
                      <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Title
                          <Input
                            className="h-9 bg-white text-slate-900"
                            value={documentForm.title}
                            onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))}
                            placeholder="Document title"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Document type code
                          <Input
                            className="h-9 bg-white text-slate-900"
                            value={documentForm.document_type_code}
                            onChange={(event) =>
                              setDocumentForm((prev) => ({ ...prev, document_type_code: event.target.value }))
                            }
                            placeholder="Optional code"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Expiry date
                          <Input
                            className="h-9 bg-white text-slate-900"
                            type="date"
                            value={documentForm.expiry_date}
                            onChange={(event) => setDocumentForm((prev) => ({ ...prev, expiry_date: event.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          File
                          <Input
                            className="h-9 bg-white text-slate-900 file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-medium"
                            type="file"
                            onChange={(event) => setDocumentUploadFile(event.target.files?.[0] ?? null)}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">
                          Description
                          <textarea
                            className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            value={documentForm.description}
                            onChange={(event) => setDocumentForm((prev) => ({ ...prev, description: event.target.value }))}
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

                    {selectedRequestDocuments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No onboarding documents attached yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRequestDocuments.map((documentRow, index) => {
                          const documentId = readNumber(documentRow, ["id", "document_id"])
                          const title = readString(documentRow, ["title", "name", "file_name"])
                          const typeCode = readString(documentRow, ["document_type_code", "type_code", "type"])
                          const isVerified = asTruthyBoolean(
                            documentRow.is_verified ?? documentRow.verified ?? documentRow.isVerified
                          )
                          return (
                            <div
                              key={`onboarding-document-${documentId ?? index}`}
                              className="rounded-md border border-slate-200 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{title !== "-" ? title : `Document #${documentId ?? index + 1}`}</p>
                                  <p className="text-xs text-slate-500">
                                    {typeCode !== "-" ? typeCode : "No type"} •{" "}
                                    {isVerified ? "Verified" : "Pending verification"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void downloadRequestDocument(documentRow)}
                                    disabled={saving}
                                  >
                                    Download
                                  </Button>
                                  {canUpdateOnboardingRequests ? (
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
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Expiry</p>
                                  <p className="text-sm text-slate-900">{toTimestamp(documentRow.expiry_date)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Uploaded</p>
                                  <p className="text-sm text-slate-900">
                                    {toTimestamp(documentRow.created_at ?? documentRow.uploaded_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Description</p>
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

                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Tasks</p>
                      {canUpdateOnboardingRequests ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            void ensureLookups(["users", "departments"])
                            resetTaskForm()
                            setShowTaskComposer((current) => !current)
                          }}
                          disabled={saving}
                        >
                          {showTaskComposer ? "Hide task form" : "Create task"}
                        </Button>
                      ) : null}
                    </div>

                    {showTaskComposer ? (
                      <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Title
                          <Input
                            className="h-9 bg-white text-slate-900"
                            value={taskForm.title}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                            placeholder="Task title"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Task type
                          <select
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                            value={taskForm.task_type}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, task_type: event.target.value }))}
                          >
                            {ONBOARDING_TASK_TYPE_OPTIONS.map((type) => (
                              <option key={type} value={type}>
                                {toTitleCaseWords(type)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Assigned user
                          <select
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                            value={taskForm.assigned_company_user_id}
                            onChange={(event) =>
                              setTaskForm((prev) => ({ ...prev, assigned_company_user_id: event.target.value }))
                            }
                          >
                            <option value="">Optional user</option>
                            {users.map((row, index) => {
                              const userId = readNumber(row, ["id", "company_user_id", "user_id"])
                              if (userId === null) return null
                              return (
                                <option key={`onboarding-task-user-${userId}-${index}`} value={String(userId)}>
                                  {resolveOptionLabel(users, userId, ["id", "company_user_id", "user_id"], ["full_name", "name", "email"])}
                                </option>
                              )
                            })}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Assigned department
                          <select
                            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                            value={taskForm.assigned_department_id}
                            onChange={(event) =>
                              setTaskForm((prev) => ({ ...prev, assigned_department_id: event.target.value }))
                            }
                          >
                            <option value="">Optional department</option>
                            {departments.map((row, index) => {
                              const departmentId = readNumber(row, ["id", "department_id"])
                              if (departmentId === null) return null
                              return (
                                <option key={`onboarding-task-dept-${departmentId}-${index}`} value={String(departmentId)}>
                                  {resolveOptionLabel(departments, departmentId, ["id", "department_id"], ["name", "title"])}
                                </option>
                              )
                            })}
                          </select>
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                          Due date
                          <Input
                            className="h-9 bg-white text-slate-900"
                            type="datetime-local"
                            value={taskForm.due_date}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700 md:col-span-2">
                          Description
                          <textarea
                            className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            value={taskForm.description}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
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
                            {saving ? "Creating..." : "Create task"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {selectedRequestTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No onboarding tasks have been created for this request.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRequestTasks.map((taskRow, index) => {
                          const taskId = readNumber(taskRow, ["id", "task_id"])
                          const taskStatus = readString(taskRow, ["status", "task_status"])
                          const isTaskClosed = ["completed", "cancelled"].includes(taskStatus.trim().toLowerCase())
                          return (
                            <div
                              key={`onboarding-task-${taskId ?? index}`}
                              className="rounded-md border border-slate-200 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">
                                    {readString(taskRow, ["title", "name", "task_title"])}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {toTitleCaseWords(readString(taskRow, ["task_type", "type"]))} •{" "}
                                    {taskStatus !== "-" ? toTitleCaseWords(taskStatus) : "Pending"}
                                  </p>
                                </div>
                                {!isTaskClosed && (canUpdateOnboardingRequests || canCompleteOnboardingRequests) ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void completeRequestTask(taskRow)}
                                    disabled={saving}
                                  >
                                    Complete task
                                  </Button>
                                ) : null}
                              </div>
                              <div className="mt-2 grid gap-2 md:grid-cols-3">
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Owner</p>
                                  <p className="text-sm text-slate-900">{resolveRequestTaskOwner(taskRow)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Due</p>
                                  <p className="text-sm text-slate-900">{toTimestamp(taskRow.due_date)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Completed</p>
                                  <p className="text-sm text-slate-900">{toTimestamp(taskRow.completed_at)}</p>
                                </div>
                                <div className="md:col-span-3">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Description</p>
                                  <p className="text-sm text-slate-900">
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

                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold text-slate-900">Workflow Map</p>
                    <div className="space-y-3">
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
                          <div key={node.key} className="relative pl-8">
                            {idx < requestTimelineNodes.length - 1 ? (
                              <span className="absolute left-[11px] top-6 h-[calc(100%-0.25rem)] w-px bg-slate-200" />
                            ) : null}
                            <span
                              className={`absolute left-0 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                                isDone
                                  ? "bg-emerald-500 text-white"
                                  : isPending
                                    ? "bg-amber-500 text-white"
                                    : "bg-slate-300 text-slate-700"
                              }`}
                            >
                              {node.index}
                            </span>
                            <div className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {toTitleCaseWords(String(node.actionLabel))}
                                </p>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                                  {toTitleCaseWords(String(node.status))}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-600">
                                {isPending && approvalSummary.pendingNames.length > 0 ? "Pending approver" : "Owner"}:{" "}
                                <span className="font-medium text-slate-800">
                                  {isPending && approvalSummary.pendingNames.length > 0
                                    ? approvalSummary.pendingNames.join(", ")
                                    : node.owner || "-"}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                Required:{" "}
                                <span className="font-medium text-slate-800">{node.required ? "Yes" : "No"}</span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">Completed: {node.completedAt}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <p className="text-sm font-semibold text-slate-900">Activity Record</p>
                    {selectedRequestAuditLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity record available for this request.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRequestAuditLogs.map((entry, index) => (
                          <div
                            key={`audit-${readString(entry, ["id", "log_id"])}-${index}`}
                            className="rounded-md border border-slate-200 bg-white p-3"
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
                              By:{" "}
                              <span className="font-medium text-slate-800">
                                {resolveAuditActorLabel(entry, users) || "-"}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {readString(entry, ["description", "message", "remarks", "comment"])}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
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
                    isOnboardingActableStatus(selectedStatus)
                  return (
                    <>
                      {showApprove && approvalSummary.waitingLabel ? (
                        <p className="mr-auto text-xs text-muted-foreground">{approvalSummary.waitingLabel}</p>
                      ) : null}
                      {showSubmit ? (
                        <Button
                          type="button"
                          disabled={saving || selectedId === null}
                          onClick={() => void runRequestAction(selectedId, "submit")}
                        >
                          Submit request
                        </Button>
                      ) : null}
                      {showApprove ? (
                        <Button
                          type="button"
                          disabled={saving || selectedId === null}
                          onClick={() => void runRequestAction(selectedId, "approve")}
                        >
                          Approve
                        </Button>
                      ) : null}
                    </>
                  )
                })()}
                <Button type="button" variant="outline" onClick={() => setRequestDetailsOpen(false)}>
                  Close
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
                <SearchToggleField
                  className="min-w-0 !w-auto !max-w-[14rem] !flex-none"
                  placeholder="Search workflows"
                  value={workflowSearch}
                  onChange={setWorkflowSearch}
                />
                <select
                  className="h-8 min-w-[8.5rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                  value={workflowStatusFilter}
                  onChange={(event) => setWorkflowStatusFilter(event.target.value)}
                  aria-label="Filter workflow status"
                >
                  {workflowStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? "All statuses" : toTitleCaseWords(status)}
                    </option>
                  ))}
                </select>
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
            <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none">
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
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    Workflow name
                    <Input
                      className="h-9 bg-white text-slate-900"
                      value={workflowForm.name}
                      onChange={(event) => setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Workflow name"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    Status
                    <Select
                      value={workflowForm.status || "active"}
                      onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, status: value ?? "active" }))}
                    >
                      <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                        <SelectValue placeholder="Status">
                          <span className="text-slate-900">
                            {toTitleCaseWords(workflowForm.status || "active")}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectPopupClassName}>
                        <SelectItem value="active" className="text-slate-900">Active</SelectItem>
                        <SelectItem value="inactive" className="text-slate-900">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    Default workflow
                    <Select
                      value={workflowForm.is_default || "false"}
                      onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, is_default: value ?? "false" }))}
                    >
                      <SelectTrigger className="h-9 w-full bg-white text-slate-900">
                        <SelectValue placeholder="Default workflow">
                          <span className="text-slate-900">
                            {workflowForm.is_default === "true" ? "Default" : "Not default"}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className={selectPopupClassName}>
                        <SelectItem value="true" className="text-slate-900">Default</SelectItem>
                        <SelectItem value="false" className="text-slate-900">Not default</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-700">
                    Description
                    <Input
                      className="h-9 bg-white text-slate-900"
                      value={workflowForm.description}
                      onChange={(event) => setWorkflowForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Workflow description"
                    />
                  </label>
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={openCreateStepDialog} disabled={saving}>
                      Add Step
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="mb-3 text-sm font-medium">
                    Workflow Steps ({workflowSteps.length})
                  </p>
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
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Step Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Step Type</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead>Due Days</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="sticky right-0 z-10 bg-muted text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workflowSteps.map((step, index) => (
                            <TableRow key={`step-${index}`}>
                              <TableCell className="font-medium">{step.name || `Step ${index + 1}`}</TableCell>
                              <TableCell>{step.description || "-"}</TableCell>
                              <TableCell>{toTitleCaseWords(step.step_type || "task")}</TableCell>
                              <TableCell>{resolveYesNoLabel(step.is_required)}</TableCell>
                              <TableCell>{step.due_days ? `${String(step.due_days)} day(s)` : "-"}</TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  roles,
                                  step.assigned_role_id ?? null,
                                  ["id", "role_id"],
                                  ["display_name", "name", "title"]
                                )}
                              </TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  users,
                                  step.assigned_user_id ?? null,
                                  ["id", "user_id", "company_user_id"],
                                  ["full_name", "name", "email"]
                                )}
                              </TableCell>
                              <TableCell className="sticky right-0 z-10 bg-background">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => editWorkflowStep(step, index)}
                                    aria-label={`Edit step ${index + 1}`}
                                    title="Edit step"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => removeWorkflowStep(index)}
                                    aria-label={`Remove step ${index + 1}`}
                                    title="Remove step"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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

          <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
            <DialogPopup from="bottom" className="sm:max-w-[980px]">
              <DialogHeader>
                <DialogTitle>{editingStepIndex === null ? "Add Workflow Step" : "Edit Workflow Step"}</DialogTitle>
                <DialogDescription>
                  Configure one step and save it to the list before creating the workflow.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={workflowForm.step_name}
                  onChange={(event) => setWorkflowForm((prev) => ({ ...prev, step_name: event.target.value }))}
                  placeholder="Step name"
                  className="h-11"
                />
                <Input
                  value={workflowForm.step_description}
                  onChange={(event) =>
                    setWorkflowForm((prev) => ({ ...prev, step_description: event.target.value }))
                  }
                  placeholder="Step description"
                  className="h-11"
                />
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.step_type}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, step_type: value ?? "task" }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
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
                    Step type is limited to the values accepted by the onboarding workflow API.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.is_required}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, is_required: value ?? "true" }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Required">{resolveYesNoLabel(workflowForm.is_required)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Mark this as required if onboarding cannot proceed without this step.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={workflowForm.due_days}
                    onChange={(event) =>
                      setWorkflowForm((prev) => ({ ...prev, due_days: event.target.value }))
                    }
                    placeholder="Due days"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of days expected to complete this step. Minimum is 1 day.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.assigned_role_id || "none"}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => {
                        const nextRole = !value || value === "none" ? "" : value
                        const nextRoleId = Number(nextRole)
                        const selectedUserId = Number(prev.assigned_user_id)
                        const selectedUser = findAssigneeRecord(users, selectedUserId)
                        const keepUser =
                          !nextRole ||
                          !selectedUser ||
                          Number.isNaN(selectedUserId) ||
                          recordHasRole(selectedUser, nextRoleId)
                        return {
                          ...prev,
                          assigned_role_id: nextRole,
                          assigned_user_id: keepUser ? prev.assigned_user_id : "",
                        }
                      })
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Assigned role (optional)">
                        {workflowForm.assigned_role_id
                          ? resolveOptionLabel(roles, Number(workflowForm.assigned_role_id), ["id", "role_id"], [
                              "display_name",
                              "name",
                              "title",
                            ])
                          : "No role selected"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role selected</SelectItem>
                      {roles.map((row) => {
                        const roleId = readNumber(row, ["id", "role_id"])
                        if (roleId === null) return null
                        return (
                          <SelectItem key={roleId} value={String(roleId)}>
                            {resolveOptionLabel(roles, roleId, ["id", "role_id"], ["display_name", "name", "title"])}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign a role if this step should be owned by a role-based queue. Choosing a role filters the user list to people in that role.
                  </p>
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
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Assigned user (optional)">
                        {workflowForm.assigned_user_id
                          ? resolveOptionLabel(
                              users,
                              Number(workflowForm.assigned_user_id),
                              ["id", "company_user_id", "user_id"],
                              ["full_name", "name", "email"]
                            )
                          : "No specific user"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific user</SelectItem>
                      {roleUsersLoading ? (
                        <SelectItem value="loading" disabled>
                          Loading people in this role…
                        </SelectItem>
                      ) : null}
                      {assignableUsers.map((row) => {
                        const userId = preferredAssigneeId(row)
                        if (userId === null) return null
                        const label = resolveOptionLabel(
                          [row, ...users],
                          userId,
                          ["id", "company_user_id", "user_id"],
                          ["full_name", "name", "email"]
                        )
                        return (
                          <SelectItem
                            key={userId}
                            value={String(userId)}
                            data-search-text={`${label} ${userId}`}
                          >
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {workflowForm.assigned_role_id
                      ? roleUsersLoading
                        ? "Loading people assigned to this role…"
                        : roleUsers.length > 0
                          ? "Showing people in the selected role. Use search in the list to find someone."
                          : "Could not load that role’s members. Showing all company users so you can still pick someone."
                      : "Assign a person if this step should go to someone specific. You can choose a role, a user, or both, but not neither."}
                  </p>
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
                <Button type="button" onClick={addWorkflowStep}>
                  {editingStepIndex === null ? "Add Step" : "Save Step"}
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}
    </div>
  )
}
