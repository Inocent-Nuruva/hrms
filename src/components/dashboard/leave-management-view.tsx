"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import {
  Check,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { SearchToggleField } from "@/components/common/search-toggle-field"

import {
  addLeaveRequestDocument,
  adjustLeaveBalance,
  cancelLeaveRequest,
  carryForwardLeaveBalances,
  createLeaveHoliday,
  createLeavePolicy,
  createLeaveRequest,
  createLeaveType,
  createLeaveWorkflow,
  createLeaveWorkflowStep,
  deleteLeaveHoliday,
  deleteLeavePolicy,
  deleteLeaveType,
  deleteLeaveWorkflow,
  deleteLeaveWorkflowStep,
  downloadLeaveRequestDocument,
  downloadLeaveRequestPdf,
  fileToBase64UploadDto,
  getCurrentAdmin,
  getLeaveRequest,
  getLeaveWorkflow,
  leaveRequestApprovalAction,
  listBranches,
  listDepartments,
  listAllEmployees,
  generateLeaveBalances,
  listLeaveBalanceAdjustments,
  listLeaveBalanceTransactions,
  listAllLeaveBalances,
  listLeaveHolidays,
  listLeavePolicies,
  listLeaveRequests,
  listLeaveTypes,
  listLeaveWorkflowSteps,
  listLeaveWorkflows,
  listPositions,
  listResource,
  patchLeaveHoliday,
  patchLeavePolicy,
  patchLeaveRequestMedicalDetail,
  patchLeaveType,
  patchLeaveWorkflow,
  resubmitLeaveRequest,
  submitLeaveRequest,
  patchLeaveWorkflowStep,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import {
  formatBalanceDays,
  groupLeaveBalancesByEmployee,
  readBalanceDays,
  readBalanceEmployeeId,
  readBalanceFiscalYear,
  resolveLeaveBalanceEmployeeName,
  sortLeaveBalanceRows,
  type LeaveBalanceEmployeeGroup,
} from "@/lib/leave-balance-groups"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { TalentDoodle, TalentDoodleSprites } from "@/components/dashboard/talent-visuals"
import ExampleProgress from "@/components/ui/progress-1"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
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
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  notifyLeaveRequestRequester,
  notifySubmittedRequestApprovers,
} from "@/lib/request-notifications"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type LeaveTab = "types" | "requests" | "balances" | "holidays" | "policies" | "workflows"
type LeaveLookupKey = "types" | "employees" | "departments" | "positions" | "branches" | "roles"
type LeaveManagementViewProps = {
  activeTab?: LeaveTab
  showTabButtons?: boolean
}

function createEmptyLeaveTypeForm() {
  return {
    name: "",
    code: "",
    description: "",
    status: "active",
    is_paid: "true",
    requires_attachment: "false",
    is_carry_forward_allowed: "false",
    max_carry_forward_days: "0",
    max_days_per_year: "0",
    gender_restriction: "any",
  }
}

function createEmptyLeaveMedicalForm() {
  return {
    sickness_nature: "",
    doctor_name: "",
    doctor_phone: "",
    hospital_name: "",
    treatment_start_date: "",
    treatment_end_date: "",
    attachment_url: "",
  }
}

type WorkflowStepPayload = {
  approval_level: number
  approver_type: string
  action_type: string
  role_id?: number
  position_id?: number
  company_user_id?: number
  assigned_branch_id?: number
  assigned_department_id?: number
  is_required: boolean
}

type HolidayImportCountryCode = "TZ" | "KE" | "UG"

type ImportableHoliday = {
  countryCode: HolidayImportCountryCode
  countryName: string
  name: string
  localName: string
  holidayDate: string
  isRecurring: boolean
  type: string
}

const HOLIDAY_IMPORT_COUNTRIES: Array<{ code: HolidayImportCountryCode; label: string }> = [
  { code: "TZ", label: "Tanzania" },
  { code: "KE", label: "Kenya" },
  { code: "UG", label: "Uganda" },
]

const TAB_LOOKUP_REQUIREMENTS: Record<LeaveTab, LeaveLookupKey[]> = {
  types: [],
  requests: ["employees", "types"],
  balances: ["employees", "types"],
  holidays: [],
  policies: [],
  workflows: [],
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

function readSessionCompanyName() {
  if (typeof window === "undefined") {
    return ""
  }

  const tryRecord = (record: AdminRecord | null) => {
    if (!record) {
      return ""
    }
    const direct = readString(record, [
      "companyName",
      "company_name",
      "organization_name",
      "tenant_name",
      "display_name",
    ])
    if (direct !== "-") {
      return direct
    }
    const nested =
      asRecord(record.company) ?? asRecord(record.organization) ?? asRecord(record.tenant)
    if (nested) {
      const nestedName = readString(nested, ["name", "companyName", "company_name", "display_name"])
      if (nestedName !== "-") {
        return nestedName
      }
    }
    return ""
  }

  try {
    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    if (rawUser) {
      const fromUser = tryRecord(asRecord(JSON.parse(rawUser)))
      if (fromUser) {
        return fromUser
      }
    }
  } catch {
    // ignore malformed user payload
  }

  const token = readStoredToken()
  if (token) {
    const fromToken = tryRecord(decodeJwtPayload(token))
    if (fromToken) {
      return fromToken
    }
  }

  return ""
}

function resolveLeaveTypeCompanyName(row: AdminRecord) {
  const fromRow = readString(row, [
    "company_name",
    "companyName",
    "organization_name",
    "company",
  ])
  if (fromRow !== "-" && !/^\d+$/.test(fromRow)) {
    return fromRow
  }

  const nested =
    asRecord(row.company) ?? asRecord(row.organization) ?? asRecord(row.tenant)
  if (nested) {
    const nestedName = readString(nested, ["name", "company_name", "companyName", "display_name"])
    if (nestedName !== "-") {
      return nestedName
    }
  }

  return readSessionCompanyName() || fromRow
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

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as AdminRecord) : null
}

function readBoolean(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") {
      return value
    }
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") {
        return true
      }
      if (value.toLowerCase() === "false") {
        return false
      }
    }
  }
  return false
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function readDisplayValue(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value === null || value === undefined) {
      continue
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value)
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No"
    }
  }
  return "-"
}

function formatLeaveDateTime(value: string) {
  if (!value || value === "-") {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatLeaveDays(value: string) {
  if (!value || value === "-") {
    return "-"
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return value
  }
  if (parsed === 0) {
    return "0 (not fixed)"
  }
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2)
}

function leaveTypeIdFromRow(row: AdminRecord) {
  const direct = readNumber(row, ["leave_type_id", "leaveTypeId", "type_id", "typeId"])
  if (direct !== null) {
    return direct
  }
  const nested = asRecord(row.leave_type) ?? asRecord(row.leaveType) ?? asRecord(row.type)
  if (nested) {
    return readNumber(nested, ["id", "leave_type_id", "leaveTypeId", "type_id", "typeId"])
  }
  return null
}

function formFromBalanceRow(row: AdminRecord) {
  return {
    employee_id: String(readBalanceEmployeeId(row) ?? readNumber(row, ["employee_id", "employeeId"]) ?? ""),
    leave_type_id: String(leaveTypeIdFromRow(row) ?? ""),
    fiscal_year:
      readString(row, ["fiscal_year", "fiscalYear"]) === "-"
        ? String(new Date().getFullYear())
        : readString(row, ["fiscal_year", "fiscalYear"]),
    allocated_days: String(readNumber(row, ["allocated_days", "allocated"]) ?? 0),
    carried_forward_days: String(
      readNumber(row, ["carried_forward_days", "carried_forward", "carriedForwardDays", "carriedForward"]) ?? 0
    ),
    expired_days: String(readNumber(row, ["expired_days", "expired", "expiredDays"]) ?? 0),
  }
}

function formatGenderRestriction(value: string) {
  if (!value || value === "-") {
    return "Any"
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "any") return "Any"
  if (normalized === "female") return "Female"
  if (normalized === "male") return "Male"
  return value
}

function normalizeHolidayValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function readHolidayDate(row: AdminRecord) {
  const raw = readString(row, ["holiday_date", "date", "from_date", "start_date"])
  return raw === "-" ? "" : raw.split("T")[0]?.split(" ")[0] ?? raw
}

function holidayMatchKey(name: string, date: string) {
  return `${normalizeHolidayValue(name)}::${date.trim()}`
}

function progressPercent(completed: number, total: number) {
  if (total <= 0) {
    return 0
  }
  return Math.round((completed / total) * 100)
}

function readLeaveTypeId(row: AdminRecord | null | undefined) {
  if (!row) {
    return null
  }
  return readNumber(row, ["id", "leave_type_id", "leaveTypeId"])
}

function readLeaveHolidayId(row: AdminRecord | null | undefined) {
  if (!row) {
    return null
  }
  return readNumber(row, ["id", "holiday_id", "leave_holiday_id", "leaveHolidayId"])
}

function buildWorkflowStepPayload(form: {
  approval_level: string
  approver_type: string
  action_type: string
  role_id: string
  position_id: string
  company_user_id: string
  assigned_branch_id: string
  assigned_department_id: string
  is_required: string
}): WorkflowStepPayload {
  return {
    approval_level: Number(form.approval_level),
    approver_type: form.approver_type,
    action_type: form.action_type,
    role_id: form.role_id ? Number(form.role_id) : undefined,
    position_id: form.position_id ? Number(form.position_id) : undefined,
    company_user_id: form.company_user_id ? Number(form.company_user_id) : undefined,
    assigned_branch_id: form.assigned_branch_id ? Number(form.assigned_branch_id) : undefined,
    assigned_department_id: form.assigned_department_id ? Number(form.assigned_department_id) : undefined,
    is_required: form.is_required === "true",
  }
}

function getWorkflowStepFieldHint(approverType: string) {
  if (approverType === "position") {
    return "Use Position to choose who approves this step. Role and Company User are ignored for this step."
  }
  if (approverType === "company_user") {
    return "Use Company User to assign a specific approver. Role and Position are ignored for this step."
  }
  return "Use Role to route this step by role. Position and Company User are ignored for this step."
}

function leaveRequestLabel(row: AdminRecord) {
  const title = readString(row, ["leave_no", "request_no", "title", "reason"])
  if (title !== "-") return title
  const employeeId = readNumber(row, ["employee_id"])
  if (employeeId !== null) return `Employee #${employeeId} request`
  const id = readNumber(row, ["id"])
  return id === null ? "Unnamed request" : `Request #${id}`
}

type SearchableOption = {
  value: string
  label: string
}

function SearchableSelect({
  value,
  options,
  placeholder,
  onValueChange,
  id,
}: {
  value: string
  options: SearchableOption[]
  placeholder: string
  onValueChange: (value: string) => void
  id: string
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? ""

  return (
    <div className="space-y-1">
      <input
        list={id}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        placeholder={placeholder}
        value={selectedLabel}
        onChange={(event) => {
          const nextLabel = event.target.value
          const exact = options.find((option) => option.label.toLowerCase() === nextLabel.toLowerCase())
          if (exact) {
            onValueChange(exact.value)
            return
          }
          const contains = options.find((option) => option.label.toLowerCase().includes(nextLabel.toLowerCase()))
          onValueChange(contains?.value ?? "")
        }}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
    </div>
  )
}

function StatusIndicator({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase()
  const label =
    status
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || "—"

  const tone =
    ["active", "approved", "completed", "present"].includes(normalized)
      ? "good"
      : ["inactive", "rejected", "cancelled", "canceled", "terminated"].includes(normalized)
        ? "bad"
        : ["pending", "submitted", "in_review", "draft", "probation", "suspended"].includes(
              normalized
            )
          ? "warn"
          : "neutral"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
        tone === "bad" && "text-rose-600 dark:text-rose-400",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "neutral" && "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "good" && "bg-emerald-500",
          tone === "bad" && "bg-rose-500",
          tone === "warn" && "bg-amber-500",
          tone === "neutral" && "bg-muted-foreground/50"
        )}
      />
      {label}
    </span>
  )
}

type LeaveActor = {
  membershipId: number | null
  userId: number | null
  email: string
  employeeId: number | null
  isCompanyAdmin: boolean
}

type LeaveApprovalRecord = {
  id: number | null
  level: number
  status: string
  companyUserId: number | null
  userId: number | null
  email: string
  name: string
  actedAt: string
  comments: string
  isCurrentLevel: boolean
}

function asRecordList(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is AdminRecord => !!entry && typeof entry === "object")
}

function personName(record: AdminRecord | null, fallback = "Unknown") {
  if (!record) return fallback
  const full = readString(record, ["full_name", "fullName", "name"])
  if (full !== "-") return full
  const first = readString(record, ["first_name", "firstName"])
  const last = readString(record, ["last_name", "lastName"])
  const composed = [first !== "-" ? first : "", last !== "-" ? last : ""].filter(Boolean).join(" ").trim()
  return composed || fallback
}

function resolveLeaveActor(token: string, profile: AdminRecord | null): LeaveActor {
  const jwt = decodeJwtPayload(token)
  const membershipId =
    readNumber(jwt ?? {}, ["membershipId", "membership_id", "company_user_id", "companyUserId"]) ??
    readNumber(profile ?? {}, ["membership_id", "membershipId", "company_user_id", "companyUserId"])
  const userId =
    readNumber(jwt ?? {}, ["sub", "user_id", "userId", "id"]) ??
    readNumber(profile ?? {}, ["id", "user_id", "userId"])
  const email = (
    readString(jwt ?? {}, ["email"]) !== "-"
      ? readString(jwt ?? {}, ["email"])
      : readString(profile ?? {}, ["email"])
  )
    .trim()
    .toLowerCase()
  const employeeId = readNumber(profile ?? {}, ["employee_id", "employeeId"])
  const roleNames = Array.isArray(jwt?.roles)
    ? jwt!.roles.map((role) => String(role).toLowerCase())
    : asRecordList(profile?.roles).map((role) =>
        readString(role, ["name", "display_name"]).toLowerCase()
      )
  const isCompanyAdmin = roleNames.some(
    (role) => role.includes("company_admin") || role.includes("admin")
  )

  return {
    membershipId,
    userId,
    email: email === "-" ? "" : email,
    employeeId,
    isCompanyAdmin,
  }
}

function getLeaveApprovals(row: AdminRecord): LeaveApprovalRecord[] {
  const currentLevel =
    readNumber(row, ["current_approval_level", "currentApprovalLevel"]) ?? 0

  const approvalKeys = [
    "approvals",
    "approval_chain",
    "approvalChain",
    "leave_request_approvals",
    "leaveRequestApprovals",
    "workflow_approvals",
    "workflowApprovals",
  ] as const

  let source = asRecordList(row.approvals)
  if (source.length === 0) {
    for (const key of approvalKeys) {
      const list = asRecordList(row[key])
      if (list.length > 0) {
        source = list
        break
      }
    }
  }

  const currentCycle = readNumber(row, ["approval_cycle", "approvalCycle"])
  if (currentCycle !== null && source.length > 0) {
    const cycleFiltered = source.filter((approval) => {
      const cycle = readNumber(approval, ["approval_cycle", "approvalCycle"])
      return cycle === null || cycle === currentCycle
    })
    if (cycleFiltered.length > 0) {
      source = cycleFiltered
    }
  }

  return source
    .map((approval) => {
      const approver =
        asRecord(approval.approver) ??
        asRecord(approval.company_user) ??
        asRecord(approval.companyUser)
      const nestedUser = asRecord(approver?.user)
      const level = readNumber(approval, ["approval_level", "approvalLevel", "level"]) ?? 0
      const status = readString(approval, ["status"]).toLowerCase()
      const approverName =
        personName(approver, "") ||
        personName(nestedUser, "") ||
        readString(approval, ["approver_name", "approverName", "name"]) ||
        "Approver"
      return {
        id: readNumber(approval, ["id"]),
        level,
        status: status === "-" ? "pending" : status,
        companyUserId: readNumber(approval, [
          "approver_company_user_id",
          "approverCompanyUserId",
          "company_user_id",
          "companyUserId",
        ]),
        userId:
          readNumber(nestedUser ?? {}, ["id", "user_id", "userId"]) ??
          readNumber(approver ?? {}, ["user_id", "userId", "id"]),
        email: (
          readString(approver ?? {}, ["email"]) ||
          readString(nestedUser ?? {}, ["email"])
        ).toLowerCase(),
        name: approverName,
        actedAt:
          readString(approval, ["acted_at", "actedAt", "updated_at", "updatedAt"]) === "-"
            ? ""
            : readString(approval, ["acted_at", "actedAt", "updated_at", "updatedAt"]),
        comments:
          readString(approval, ["comments", "comment", "notes"]) === "-"
            ? ""
            : readString(approval, ["comments", "comment", "notes"]),
        isCurrentLevel: currentLevel > 0 ? level === currentLevel : level === 1,
      }
    })
    .sort((a, b) => a.level - b.level || (a.name || "").localeCompare(b.name || ""))
}

function isLeaveActorMatch(actor: LeaveActor, approval: LeaveApprovalRecord) {
  if (
    actor.membershipId !== null &&
    approval.companyUserId !== null &&
    actor.membershipId === approval.companyUserId
  ) {
    return true
  }
  if (actor.userId !== null && approval.userId !== null && actor.userId === approval.userId) {
    return true
  }
  if (actor.email && approval.email && actor.email === approval.email) {
    return true
  }
  return false
}

function normalizeLeaveStatusLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ")
}

function isLeaveRequestTerminalStatus(status: string) {
  const normalized = normalizeLeaveStatusLabel(status)
  return ["rejected", "cancelled", "canceled", "completed", "approved"].includes(normalized)
}

function isLeaveRequestApprovalOpenStatus(status: string) {
  const normalized = normalizeLeaveStatusLabel(status)
  if (!normalized || isLeaveRequestTerminalStatus(normalized)) {
    return false
  }
  return (
    normalized === "pending" ||
    normalized === "submitted" ||
    normalized === "in review" ||
    normalized.includes("pending") ||
    normalized.includes("awaiting") ||
    normalized.includes("review")
  )
}

function getLeaveRequestPermissions(row: AdminRecord, actor: LeaveActor | null) {
  const status = readString(row, ["status"]).toLowerCase()
  const isTerminal = isLeaveRequestTerminalStatus(status)
  const approvals = getLeaveApprovals(row)
  const currentLevel =
    readNumber(row, ["current_approval_level", "currentApprovalLevel"]) ??
    (status === "in_review" || status === "submitted" ? 1 : 0)

  const pendingAtCurrent = approvals.filter(
    (approval) =>
      approval.status === "pending" &&
      (currentLevel > 0 ? approval.level === currentLevel : approval.isCurrentLevel)
  )

  const myPending = actor
    ? pendingAtCurrent.find((approval) => isLeaveActorMatch(actor, approval))
    : undefined

  const canApproveOrReject =
    !isTerminal &&
    Boolean(myPending) &&
    isLeaveRequestApprovalOpenStatus(status)

  const employeeId = readNumber(row, ["employee_id", "employeeId"])
  const nestedEmployee = asRecord(row.employee)
  const requestEmployeeId = employeeId ?? readNumber(nestedEmployee ?? {}, ["id"])
  const isOwner =
    actor !== null &&
    ((actor.employeeId !== null &&
      requestEmployeeId !== null &&
      actor.employeeId === requestEmployeeId) ||
      (actor.userId !== null &&
        readNumber(nestedEmployee ?? {}, ["user_id", "userId"]) === actor.userId))

  const canCancel =
    !isTerminal &&
    status !== "approved" &&
    Boolean(actor) &&
    (isOwner || Boolean(actor?.isCompanyAdmin))

  const pendingNames = pendingAtCurrent.map((approval) => approval.name).filter(Boolean)
  const waitingLabel =
    pendingNames.length === 0
      ? currentLevel > 0
        ? `Waiting at level ${currentLevel}`
        : "No active approver"
      : pendingNames.length === 1
        ? `Pending: ${pendingNames[0]}`
        : `Pending: ${pendingNames[0]} +${pendingNames.length - 1}`

  return {
    status,
    isTerminal,
    canApproveOrReject,
    canCancel,
    currentLevel,
    myPending,
    pendingAtCurrent,
    waitingLabel,
    approvals,
    reasonApprove: canApproveOrReject
      ? "You can approve this request at the current level."
      : isTerminal
        ? "This request is already closed."
        : pendingAtCurrent.length === 0
          ? "No pending approval step is available."
          : `Waiting for ${pendingNames.join(", ") || "another approver"} at level ${currentLevel || "—"}.`,
    reasonCancel: canCancel
      ? "You can cancel this request."
      : isTerminal
        ? "This request is already closed."
        : "Only the requester or a company admin can cancel this request.",
  }
}

function ApprovalChain({
  row,
  actor,
  compact = false,
}: {
  row: AdminRecord
  actor: LeaveActor | null
  compact?: boolean
}) {
  const permissions = getLeaveRequestPermissions(row, actor)
  const levels = Array.from(new Set(permissions.approvals.map((item) => item.level))).sort(
    (a, b) => a - b
  )

  if (permissions.approvals.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", compact && "mt-2")}>
        No approval chain is attached to this request yet.
      </p>
    )
  }

  return (
    <div className={cn("flex flex-col", compact ? "mt-3 gap-2" : "gap-3")}>
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Approval chain</p>
          <p className="text-[11px] text-muted-foreground">{permissions.waitingLabel}</p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{permissions.waitingLabel}</p>
      )}

      <ol className="relative flex flex-col gap-0 border-l border-border/80 pl-4">
        {levels.map((level) => {
          const items = permissions.approvals.filter((item) => item.level === level)
          const isCurrent = permissions.currentLevel > 0 && level === permissions.currentLevel
          const levelDone = items.length > 0 && items.every((item) => item.status === "approved")
          const levelRejected = items.some((item) => item.status === "rejected")

          return (
            <li key={`approval-level-${level}`} className="relative pb-4 last:pb-0">
              <span
                className={cn(
                  "absolute top-1.5 -left-[1.28rem] size-2.5 rounded-full ring-4 ring-background",
                  levelRejected
                    ? "bg-rose-500"
                    : levelDone
                      ? "bg-emerald-500"
                      : isCurrent
                        ? "bg-amber-500"
                        : "bg-muted-foreground/40"
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-foreground">Level {level}</p>
                {isCurrent ? (
                  <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Current
                  </span>
                ) : null}
                {levelDone ? (
                  <span className="text-[10px] font-medium text-emerald-600">Complete</span>
                ) : null}
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {items.map((item) => {
                  const mine = actor ? isLeaveActorMatch(actor, item) : false
                  return (
                    <li
                      key={`${item.id ?? item.name}-${item.level}-${item.companyUserId ?? item.userId}`}
                      className={cn(
                        "rounded-md border border-border/60 px-2.5 py-2",
                        isCurrent && item.status === "pending" && "border-amber-500/30 bg-amber-500/5",
                        mine && item.status === "pending" && "ring-1 ring-primary/30"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {item.name}
                            {mine ? (
                              <span className="ml-1 text-[10px] font-normal text-primary">(you)</span>
                            ) : null}
                          </p>
                          {item.email && item.email !== "-" ? (
                            <p className="truncate text-[11px] text-muted-foreground">{item.email}</p>
                          ) : null}
                        </div>
                        <StatusIndicator status={item.status} />
                      </div>
                      {item.comments ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">{item.comments}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function LeaveManagementView({
  activeTab = "types",
  showTabButtons = true,
}: LeaveManagementViewProps) {
  const searchParams = useSearchParams()
  const actor = useDashboardActor()
  const canCreateTypes = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_types:create", "leave_types:update"],
    mode: "any",
  })
  const canDeleteTypes = canPerformPermission(actor.permissionLabels, "leave_types:delete")
  const canCreateRequests = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_requests:create", "leave_requests:update"],
    mode: "any",
  })
  const canAdjustBalances = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_balances:update", "leave_balances:create", "leave-balances.manage"],
    mode: "any",
  })
  const canMutateHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:create", "holidays:update", "attendance_holidays:create"],
    mode: "any",
  })
  const canMutatePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:create", "leave_policies:update"],
    mode: "any",
  })
  const canMutateWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:create", "leave_workflows:update"],
    mode: "any",
  })
  const highlightedRequestId = React.useMemo(
    () =>
      searchParams?.get("highlight") ??
      searchParams?.get("requestId") ??
      searchParams?.get("request_id") ??
      "",
    [searchParams]
  )
  const [tab, setTab] = React.useState<LeaveTab>(activeTab)
  const [types, setTypes] = React.useState<AdminRecord[]>([])
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [requestSearch, setRequestSearch] = React.useState("")
  const [requestStatusFilter, setRequestStatusFilter] = React.useState("all")
  const [typeSearch, setTypeSearch] = React.useState("")
  const [typeStatusFilter, setTypeStatusFilter] = React.useState("all")
  const [balances, setBalances] = React.useState<AdminRecord[]>([])
  const [balanceAdjustments, setBalanceAdjustments] = React.useState<AdminRecord[]>([])
  const [balanceTransactions, setBalanceTransactions] = React.useState<AdminRecord[]>([])
  const [holidays, setHolidays] = React.useState<AdminRecord[]>([])
  const [policies, setPolicies] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [roles, setRoles] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingTypeDelete, setPendingTypeDelete] = React.useState<AdminRecord | null>(null)
  const [pendingHolidayDelete, setPendingHolidayDelete] = React.useState<AdminRecord | null>(null)
  const [pendingRequestCancel, setPendingRequestCancel] = React.useState<AdminRecord | null>(null)
  const [pendingPolicyDelete, setPendingPolicyDelete] = React.useState<AdminRecord | null>(null)
  const [pendingWorkflowDelete, setPendingWorkflowDelete] = React.useState<AdminRecord | null>(null)
  const [typeDialogOpen, setTypeDialogOpen] = React.useState(false)
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)
  const [balanceDialogOpen, setBalanceDialogOpen] = React.useState(false)
  const [holidayDialogOpen, setHolidayDialogOpen] = React.useState(false)
  const [holidayImportDialogOpen, setHolidayImportDialogOpen] = React.useState(false)
  const [holidayRemoveDialogOpen, setHolidayRemoveDialogOpen] = React.useState(false)
  const [policySheetOpen, setPolicySheetOpen] = React.useState(false)
  const [editingPolicyId, setEditingPolicyId] = React.useState<number | null>(null)
  const [policyPreviewOpen, setPolicyPreviewOpen] = React.useState(false)
  const [selectedPolicyRow, setSelectedPolicyRow] = React.useState<AdminRecord | null>(null)
  const [selectedBalanceRow, setSelectedBalanceRow] = React.useState<AdminRecord | null>(null)
  const [selectedBalanceGroup, setSelectedBalanceGroup] = React.useState<LeaveBalanceEmployeeGroup | null>(null)
  const [employeeBalanceDetailsOpen, setEmployeeBalanceDetailsOpen] = React.useState(false)
  const [returnToEmployeeBalances, setReturnToEmployeeBalances] = React.useState(false)
  const returnToEmployeeBalancesRef = React.useRef(false)
  const selectedBalanceGroupRef = React.useRef<LeaveBalanceEmployeeGroup | null>(null)
  selectedBalanceGroupRef.current = selectedBalanceGroup
  const [balanceBulkDialog, setBalanceBulkDialog] = React.useState<null | "generate" | "carry-forward">(null)
  const [balanceBulkYear, setBalanceBulkYear] = React.useState(String(new Date().getFullYear()))
  const [workflowSteps, setWorkflowSteps] = React.useState<AdminRecord[]>([])
  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<number | null>(null)
  const [editingWorkflowStepId, setEditingWorkflowStepId] = React.useState<number | null>(null)
  const [selectedLeaveTypeRow, setSelectedLeaveTypeRow] = React.useState<AdminRecord | null>(null)
  const [editingLeaveTypeRow, setEditingLeaveTypeRow] = React.useState<AdminRecord | null>(null)
  const [leaveTypeDetailsOpen, setLeaveTypeDetailsOpen] = React.useState(false)
  const [selectedLeaveRequestRow, setSelectedLeaveRequestRow] = React.useState<AdminRecord | null>(null)
  const [leaveRequestDetailsOpen, setLeaveRequestDetailsOpen] = React.useState(false)
  const [currentActor, setCurrentActor] = React.useState<LeaveActor | null>(null)
  const [cancelReason, setCancelReason] = React.useState("Cancelled by admin")
  const [leaveMedicalForm, setLeaveMedicalForm] = React.useState(createEmptyLeaveMedicalForm)
  const [leaveDocumentFile, setLeaveDocumentFile] = React.useState<File | null>(null)
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState("")
  const [holidayImportCountry, setHolidayImportCountry] = React.useState<HolidayImportCountryCode>("TZ")
  const [holidayImportYear, setHolidayImportYear] = React.useState(String(new Date().getFullYear()))
  const [holidayImportCatalog, setHolidayImportCatalog] = React.useState<ImportableHoliday[]>([])
  const [holidayImportLoading, setHolidayImportLoading] = React.useState(false)
  const [holidayImportBusy, setHolidayImportBusy] = React.useState(false)
  const [holidayImportError, setHolidayImportError] = React.useState<string | null>(null)
  const [holidayImportProgress, setHolidayImportProgress] = React.useState<{
    completed: number
    total: number
    label: string
  } | null>(null)
  const [holidayRemoveCountry, setHolidayRemoveCountry] = React.useState<HolidayImportCountryCode>("TZ")
  const [holidayRemoveYear, setHolidayRemoveYear] = React.useState(String(new Date().getFullYear()))
  const [holidayRemoveCatalog, setHolidayRemoveCatalog] = React.useState<ImportableHoliday[]>([])
  const [holidayRemoveLoading, setHolidayRemoveLoading] = React.useState(false)
  const [holidayRemoveBusy, setHolidayRemoveBusy] = React.useState(false)
  const [holidayRemoveError, setHolidayRemoveError] = React.useState<string | null>(null)
  const [holidayRemoveProgress, setHolidayRemoveProgress] = React.useState<{
    completed: number
    total: number
    label: string
  } | null>(null)
  const [loadedLookups, setLoadedLookups] = React.useState<Record<LeaveLookupKey, boolean>>({
    types: false,
    employees: false,
    departments: false,
    positions: false,
    branches: false,
    roles: false,
  })

  const [typeForm, setTypeForm] = React.useState(createEmptyLeaveTypeForm)

  const [requestForm, setRequestForm] = React.useState({
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    submit: "true",
  })

  const [balanceForm, setBalanceForm] = React.useState({
    employee_id: "",
    leave_type_id: "",
    fiscal_year: String(new Date().getFullYear()),
    allocated_days: "0",
    carried_forward_days: "0",
    expired_days: "0",
  })

  const [holidayForm, setHolidayForm] = React.useState({
    name: "",
    holiday_date: "",
    is_recurring: "false",
  })

  const [policyForm, setPolicyForm] = React.useState({
    name: "",
    description: "",
    accrual_method: "yearly",
    accrual_rate: "0",
    allow_negative_balance: "false",
    status: "active",
    applicable_department_id: "",
    applicable_position_id: "",
    max_consecutive_days: "1",
    min_service_months: "0",
    leave_type_id: "",
    annual_quota_days: "0",
    max_per_request_days: "0",
    requires_approval: "true",
  })

  const [workflowForm, setWorkflowForm] = React.useState({
    name: "",
    leave_type_id: "",
    status: "active",
    is_default: "false",
  })

  const [workflowStepForm, setWorkflowStepForm] = React.useState({
    approval_level: "1",
    approver_type: "role",
    action_type: "recommend",
    role_id: "",
    position_id: "",
    company_user_id: "",
    assigned_branch_id: "",
    assigned_department_id: "",
    is_required: "true",
  })

  const hydrateLeaveMedicalForm = React.useCallback((row: AdminRecord | null) => {
    const medical = row ? asRecord(row.medical_detail) : null
    const readMedicalValue = (key: string) => {
      if (!medical) {
        return ""
      }
      const value = readString(medical, [key])
      return value === "-" ? "" : value
    }
    setLeaveMedicalForm({
      sickness_nature: readMedicalValue("sickness_nature"),
      doctor_name: readMedicalValue("doctor_name"),
      doctor_phone: readMedicalValue("doctor_phone"),
      hospital_name: readMedicalValue("hospital_name"),
      treatment_start_date: readMedicalValue("treatment_start_date").replace("T", " ").split(" ")[0] ?? "",
      treatment_end_date: readMedicalValue("treatment_end_date").replace("T", " ").split(" ")[0] ?? "",
      attachment_url: readMedicalValue("attachment_url"),
    })
  }, [])

  const leaveRequestDocuments = React.useMemo(() => {
    if (!selectedLeaveRequestRow || !Array.isArray(selectedLeaveRequestRow.documents)) {
      return [] as AdminRecord[]
    }
    return selectedLeaveRequestRow.documents
      .map((value) => asRecord(value))
      .filter((value): value is AdminRecord => Boolean(value))
  }, [selectedLeaveRequestRow])

  React.useEffect(() => {
    hydrateLeaveMedicalForm(selectedLeaveRequestRow)
    setLeaveDocumentFile(null)
  }, [hydrateLeaveMedicalForm, selectedLeaveRequestRow])

  const loadedLookupsRef = React.useRef(loadedLookups)
  loadedLookupsRef.current = loadedLookups

  const loadLookups = React.useCallback(async (token: string, lookupKeys: LeaveLookupKey[], force = false) => {
    const missingKeys = force ? lookupKeys : lookupKeys.filter((key) => !loadedLookupsRef.current[key])
    if (missingKeys.length === 0) {
      return
    }

    const results = await Promise.all(
      missingKeys.map(async (key) => {
        switch (key) {
          case "types":
            return { key, result: await listLeaveTypes(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "employees":
            return {
              key,
              result: {
                rows: await listAllEmployees(token, {}, { cacheTtlMs: force ? 0 : undefined }),
              },
            }
          case "departments":
            return { key, result: await listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "positions":
            return { key, result: await listPositions(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "branches":
            return { key, result: await listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "roles":
            return {
              key,
              result: await listResource("roles", token).then((rows) => ({
                rows,
                page: 1,
                limit: 100,
                total: rows.length,
                totalPages: 1,
              })),
            }
        }
      })
    )

    results.forEach((entry) => {
      if (!entry) {
        return
      }
      switch (entry.key) {
        case "types":
          setTypes(entry.result.rows)
          break
        case "employees":
          setEmployees(entry.result.rows)
          break
        case "departments":
          setDepartments(entry.result.rows)
          break
        case "positions":
          setPositions(entry.result.rows)
          break
        case "branches":
          setBranches(entry.result.rows)
          break
        case "roles":
          setRoles(entry.result.rows)
          break
      }
    })

    setLoadedLookups((current) => {
      let changed = false
      const next = { ...current }
      missingKeys.forEach((key) => {
        if (!next[key]) {
          next[key] = true
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [])

  const ensureLookups = React.useCallback(async (lookupKeys: LeaveLookupKey[], force = false) => {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return false
    }

    if (lookupKeys.length === 0) {
      return true
    }

    setLoading(true)
    setError(null)
    try {
      await loadLookups(token, lookupKeys, force)
      return true
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load form data."
      setError(message)
      showErrorAlert(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [loadLookups])

  const reloadAll = React.useCallback(async (targetTab: LeaveTab = tab, force = false) => {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setLoading(true)
    setError(null)
    try {
      await loadLookups(token, TAB_LOOKUP_REQUIREMENTS[targetTab], force)

      switch (targetTab) {
        case "types": {
          const result = await listLeaveTypes(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
          setTypes(result.rows)
          break
        }
        case "requests": {
          const result = await listLeaveRequests(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
          setRequests(result.rows)
          break
        }
        case "balances": {
          const result = await listAllLeaveBalances(
            token,
            { sortBy: "created_at", sortOrder: "DESC" },
            { cacheTtlMs: force ? 0 : undefined },
          )
          setBalances(result.rows)
          const [adjustments, transactions] = await Promise.all([
            listLeaveBalanceAdjustments(token, { limit: 50 }).catch(() => []),
            listLeaveBalanceTransactions(token, { limit: 50 }).catch(() => []),
          ])
          setBalanceAdjustments(adjustments)
          setBalanceTransactions(transactions)
          break
        }
        case "holidays": {
          const result = await listLeaveHolidays(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
          setHolidays(result.rows)
          break
        }
        case "policies": {
          const result = await listLeavePolicies(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
          setPolicies(result.rows)
          break
        }
        case "workflows": {
          const result = await listLeaveWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" })
          setWorkflows(result.rows)
          break
        }
      }

    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load leave management data."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [loadLookups, tab])

  React.useEffect(() => {
    setTab(activeTab)
  }, [activeTab])

  // Always refetch the active tab when it changes (or on login remount).
  // Previously we skipped after the first load via loadedTabs, so new leave
  // requests/workflows created elsewhere never appeared until a full hard refresh.
  React.useEffect(() => {
    void reloadAll(tab, false)
  }, [reloadAll, tab])

  React.useEffect(() => {
    if (tab !== "types") {
      setLeaveTypeDetailsOpen(false)
      return
    }
    setSelectedLeaveTypeRow((current) => {
      if (!current) {
        return null
      }
      if (types.length === 0) {
        return null
      }
      const currentId = readLeaveTypeId(current)
      const refreshed = types.find((row) => readLeaveTypeId(row) === currentId)
      return refreshed ?? null
    })
  }, [tab, types])

  const resetTypeForm = React.useCallback(() => {
    setTypeForm(createEmptyLeaveTypeForm())
    setEditingLeaveTypeRow(null)
  }, [])

  const openTypeDialogForCreate = React.useCallback(() => {
    resetTypeForm()
    setTypeDialogOpen(true)
  }, [resetTypeForm])

  const openTypeDialogForEdit = React.useCallback((row: AdminRecord) => {
    setEditingLeaveTypeRow(row)
    setTypeForm({
      name: readString(row, ["name"]) === "-" ? "" : readString(row, ["name"]),
      code: readString(row, ["code"]) === "-" ? "" : readString(row, ["code"]),
      description:
        readString(row, ["description"]) === "-" ? "" : readString(row, ["description"]),
      status: readString(row, ["status"]) === "inactive" ? "inactive" : "active",
      is_paid: readBoolean(row, ["is_paid"]) ? "true" : "false",
      requires_attachment: readBoolean(row, ["requires_attachment"]) ? "true" : "false",
      is_carry_forward_allowed: readBoolean(row, ["is_carry_forward_allowed"]) ? "true" : "false",
      max_carry_forward_days:
        readDisplayValue(row, ["max_carry_forward_days"]) === "-"
          ? "0"
          : readDisplayValue(row, ["max_carry_forward_days"]),
      max_days_per_year:
        readDisplayValue(row, ["max_days_per_year"]) === "-"
          ? "0"
          : readDisplayValue(row, ["max_days_per_year"]),
      gender_restriction:
        (() => {
          const value = readString(row, ["gender_restriction"]).toLowerCase()
          if (value === "male" || value === "female") {
            return value
          }
          return "any"
        })(),
    })
    setTypeDialogOpen(true)
  }, [])

  function openLeaveTypeDetails(row: AdminRecord) {
    setSelectedLeaveTypeRow(row)
    setLeaveTypeDetailsOpen(true)
  }

  const openLeaveRequestDetails = React.useCallback(async (row: AdminRecord) => {
    setSelectedLeaveRequestRow(row)
    setLeaveRequestDetailsOpen(true)

    const token = readStoredToken()
    const requestId = readNumber(row, ["id", "leave_request_id", "leaveRequestId"])
    if (!token || requestId === null) {
      return
    }

    try {
      const detail = await getLeaveRequest(token, requestId)
      if (detail) {
        setSelectedLeaveRequestRow({
          ...row,
          ...detail,
        })
      }
    } catch (errorObject) {
      console.warn("[leave] Failed to load highlighted leave request detail.", errorObject)
    }
  }, [])

  const refreshLeaveRequestDetail = React.useCallback(async (row: AdminRecord | null) => {
    const token = readStoredToken()
    const requestId = row ? readNumber(row, ["id", "leave_request_id", "leaveRequestId"]) : null
    if (!token || requestId === null) {
      return null
    }

    const detail = await getLeaveRequest(token, requestId)
    if (!detail) {
      return null
    }

    setSelectedLeaveRequestRow((current) => ({
      ...(current ?? row ?? {}),
      ...(row ?? {}),
      ...detail,
    }))

    setRequests((current) =>
      current.map((entry) =>
        readNumber(entry, ["id", "leave_request_id", "leaveRequestId"]) === requestId
          ? { ...entry, ...detail }
          : entry
      )
    )

    return detail
  }, [])

  const openedHighlightedRequestRef = React.useRef("")
  React.useEffect(() => {
    if (tab !== "requests" || !highlightedRequestId) {
      return
    }
    if (openedHighlightedRequestRef.current === highlightedRequestId) {
      return
    }

    const highlightedRow =
      requests.find((row) =>
        String(readNumber(row, ["id", "leave_request_id", "leaveRequestId"]) ?? "") ===
        highlightedRequestId
      ) ?? { id: highlightedRequestId }

    openedHighlightedRequestRef.current = highlightedRequestId
    void openLeaveRequestDetails(highlightedRow)
  }, [highlightedRequestId, openLeaveRequestDetails, requests, tab])

  const fetchHolidayCatalog = React.useCallback(async (country: HolidayImportCountryCode, yearValue: string) => {
    const year = Number(yearValue)
    if (!Number.isInteger(year) || year < 1970 || year > 2100) {
      throw new Error("Enter a valid year between 1970 and 2100.")
    }

    const response = await fetch(`/api/holiday-catalog?country=${country}&year=${year}`, {
      method: "GET",
      cache: "no-store",
    })
    const payload = await response.json() as { error?: string; holidays?: ImportableHoliday[] }
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load country holidays.")
    }
    return Array.isArray(payload.holidays) ? payload.holidays : []
  }, [])

  const loadHolidayImportCatalog = React.useCallback(async () => {
    setHolidayImportLoading(true)
    setHolidayImportError(null)
    try {
      const holidays = await fetchHolidayCatalog(holidayImportCountry, holidayImportYear)
      setHolidayImportCatalog(holidays)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load country holidays."
      setHolidayImportCatalog([])
      setHolidayImportError(message)
    } finally {
      setHolidayImportLoading(false)
    }
  }, [fetchHolidayCatalog, holidayImportCountry, holidayImportYear])

  const loadHolidayRemoveCatalog = React.useCallback(async () => {
    setHolidayRemoveLoading(true)
    setHolidayRemoveError(null)
    try {
      const holidays = await fetchHolidayCatalog(holidayRemoveCountry, holidayRemoveYear)
      setHolidayRemoveCatalog(holidays)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load country holidays."
      setHolidayRemoveCatalog([])
      setHolidayRemoveError(message)
    } finally {
      setHolidayRemoveLoading(false)
    }
  }, [fetchHolidayCatalog, holidayRemoveCountry, holidayRemoveYear])

  React.useEffect(() => {
    if (!holidayImportDialogOpen) {
      if (!holidayImportBusy) {
        setHolidayImportProgress(null)
      }
      return
    }
    void loadHolidayImportCatalog()
  }, [holidayImportBusy, holidayImportDialogOpen, loadHolidayImportCatalog])

  React.useEffect(() => {
    if (!holidayRemoveDialogOpen) {
      if (!holidayRemoveBusy) {
        setHolidayRemoveProgress(null)
      }
      return
    }
    void loadHolidayRemoveCatalog()
  }, [holidayRemoveBusy, holidayRemoveDialogOpen, loadHolidayRemoveCatalog])

  const existingHolidayKeys = React.useMemo(() => {
    return new Set(
      holidays.map((row) => holidayMatchKey(readString(row, ["name"]), readHolidayDate(row)))
    )
  }, [holidays])

  const selectedHolidayMatches = React.useMemo(() => {
    return holidayImportCatalog.filter((entry) => existingHolidayKeys.has(holidayMatchKey(entry.name, entry.holidayDate)))
  }, [existingHolidayKeys, holidayImportCatalog])

  const selectedHolidayMissing = React.useMemo(() => {
    return holidayImportCatalog.filter((entry) => !existingHolidayKeys.has(holidayMatchKey(entry.name, entry.holidayDate)))
  }, [existingHolidayKeys, holidayImportCatalog])

  const removableCountryHolidays = React.useMemo(() => {
    return holidays.filter((row) =>
      holidayRemoveCatalog.some((entry) => holidayMatchKey(entry.name, entry.holidayDate) === holidayMatchKey(readString(row, ["name"]), readHolidayDate(row)))
    )
  }, [holidayRemoveCatalog, holidays])

  const employeeNameById = React.useMemo(() => {
    const names = new Map<number, string>()
    employees.forEach((row) => {
      const label = personName(row, "")
      if (!label) {
        return
      }
      ;(["id", "employee_id", "employeeId", "user_id", "userId"] as const).forEach((key) => {
        const id = readNumber(row, [key])
        if (id !== null && !names.has(id)) {
          names.set(id, label)
        }
      })
    })
    return names
  }, [employees])

  const employeeLabel = (employeeId: number | null) => {
    if (employeeId === null) {
      return "-"
    }
    return employeeNameById.get(employeeId) ?? `#${employeeId}`
  }

  const employeeLabelFromRow = (row: AdminRecord) => {
    return resolveLeaveBalanceEmployeeName(row, employeeNameById)
  }

  const leaveTypeLabelFromRequest = (row: AdminRecord) => {
    const nestedType = asRecord(row.leave_type) ?? asRecord(row.leaveType)
    if (nestedType) {
      const name = readString(nestedType, ["name", "code"])
      if (name !== "-") return name
    }
    const direct = readString(row, ["leave_type_name", "leaveTypeName", "leave_type", "leave_type_id"])
    if (direct !== "-" && Number.isNaN(Number(direct))) return direct
    return leaveTypeLabel(readNumber(row, ["leave_type_id", "leaveTypeId"]))
  }

  React.useEffect(() => {
    const token = readStoredToken()
    if (!token) {
      setCurrentActor(null)
      return
    }
    let cancelled = false
    void getCurrentAdmin(token)
      .then((profile) => {
        if (cancelled) return
        setCurrentActor(resolveLeaveActor(token, profile))
      })
      .catch(() => {
        if (cancelled) return
        setCurrentActor(resolveLeaveActor(token, null))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const leaveTypeLabel = (leaveTypeId: number | null) => {
    if (leaveTypeId === null) {
      return "-"
    }
    const match = types.find((row) => readNumber(row, ["id", "leave_type_id", "leaveTypeId", "type_id", "typeId"]) === leaveTypeId)
    if (!match) {
      return `#${leaveTypeId}`
    }
    return readString(match, ["name", "leave_type_name", "leaveTypeName", "type_name", "typeName", "title"])
  }

  const leaveTypeLabelFromRow = (row: AdminRecord) => {
    const nestedLeaveType =
      asRecord(row.leave_type) ??
      asRecord(row.leaveType) ??
      asRecord(row.type)

    const inlineLeaveTypeName = readString(row, [
      "leave_type_name",
      "leaveTypeName",
      "type_name",
      "typeName",
    ])
    if (inlineLeaveTypeName !== "-") {
      return inlineLeaveTypeName
    }
    if (nestedLeaveType) {
      const nestedLeaveTypeName = readString(nestedLeaveType, [
        "name",
        "leave_type_name",
        "leaveTypeName",
        "type_name",
        "typeName",
        "title",
      ])
      if (nestedLeaveTypeName !== "-") {
        return nestedLeaveTypeName
      }
    }
    return leaveTypeLabel(
      readNumber(row, ["leave_type_id", "leaveTypeId", "type_id", "typeId", "leave_type", "leaveType"])
    )
  }

  const groupedBalances = React.useMemo(
    () => groupLeaveBalancesByEmployee(balances, (row) => employeeLabelFromRow(row)),
    [balances, employees]
  )

  const balanceGroupColumns = React.useMemo(
    () => [
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 160,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.employeeName,
        render: (group: LeaveBalanceEmployeeGroup) => group.employeeName,
      },
      {
        key: "types",
        label: "Types",
        defaultWidth: 60,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.typeCount,
        render: (group: LeaveBalanceEmployeeGroup) => String(group.typeCount),
      },
      {
        key: "fiscal_year",
        label: "FY",
        defaultWidth: 70,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.fiscalYears.join(", "),
        render: (group: LeaveBalanceEmployeeGroup) => group.fiscalYears.join(", ") || "-",
      },
      {
        key: "allocated_days",
        label: "Alloc",
        defaultWidth: 70,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.allocatedDays,
        render: (group: LeaveBalanceEmployeeGroup) => formatBalanceDays(group.allocatedDays),
      },
      {
        key: "used_days",
        label: "Used",
        defaultWidth: 60,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.usedDays,
        render: (group: LeaveBalanceEmployeeGroup) => formatBalanceDays(group.usedDays),
      },
      {
        key: "remaining",
        label: "Rem",
        defaultWidth: 60,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.remainingDays,
        render: (group: LeaveBalanceEmployeeGroup) => formatBalanceDays(group.remainingDays),
      },
    ],
    []
  )

  React.useEffect(() => {
    setSelectedBalanceGroup((current) => {
      if (!current) {
        return current
      }
      return groupedBalances.find((group) => group.key === current.key) ?? current
    })
  }, [groupedBalances])

  const selectedBalanceGroupRows = React.useMemo(
    () =>
      selectedBalanceGroup
        ? sortLeaveBalanceRows(selectedBalanceGroup.rows, (row) => leaveTypeLabelFromRow(row))
        : [],
    [selectedBalanceGroup, types]
  )

  const resetBalanceForm = React.useCallback(() => {
    setBalanceForm({
      employee_id: "",
      leave_type_id: "",
      fiscal_year: String(new Date().getFullYear()),
      allocated_days: "0",
      carried_forward_days: "0",
      expired_days: "0",
    })
  }, [])

  const optionLabel = (rows: AdminRecord[], id: number | null, nameKeys: string[] = ["name", "title"]) => {
    if (id === null) {
      return "-"
    }
    const match = rows.find((row) => readNumber(row, ["id", "role_id", "department_id", "position_id", "branch_id", "user_id"]) === id)
    if (!match) {
      return `#${id}`
    }
    return readString(match, nameKeys)
  }

  const employeeOptions: SearchableOption[] = employees
    .map((employee) => {
      const id = readNumber(employee, ["id", "employee_id", "user_id"])
      if (id === null) return null
      return { value: String(id), label: employeeLabel(id) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const leaveTypeOptions: SearchableOption[] = types
    .map((type) => {
      const id = readNumber(type, ["id"])
      if (id === null) return null
      return { value: String(id), label: readString(type, ["name"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const positionOptions: SearchableOption[] = positions
    .map((row) => {
      const id = readNumber(row, ["id", "position_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["name", "title"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const filteredTypes = types.filter((row) => {
    const status = readString(row, ["status"]).toLowerCase()
    if (typeStatusFilter !== "all" && status !== typeStatusFilter) {
      return false
    }
    const query = typeSearch.trim().toLowerCase()
    if (!query) {
      return true
    }
    return [
      readString(row, ["name"]),
      readString(row, ["code"]),
      readString(row, ["description"]),
      readString(row, ["gender_restriction"]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query)
  })

  const filteredRequests = requests.filter((row) => {
    const status = readString(row, ["status"]).toLowerCase()
    if (requestStatusFilter !== "all" && status !== requestStatusFilter) {
      return false
    }
    const query = requestSearch.trim().toLowerCase()
    if (!query) {
      return true
    }
    const employee = employeeLabel(readNumber(row, ["employee_id"])).toLowerCase()
    const leaveType = readString(row, ["leave_type_name", "leave_type", "leave_type_id"]).toLowerCase()
    const reason = readString(row, ["reason"]).toLowerCase()
    const dateRange = `${readString(row, ["start_date"])} ${readString(row, ["end_date"])}`.toLowerCase()
    return employee.includes(query) || leaveType.includes(query) || reason.includes(query) || dateRange.includes(query)
  })

  async function importCountryHolidays() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    if (selectedHolidayMissing.length === 0) {
      showSuccessAlert("All selected country holidays are already in the list.")
      return
    }

    setHolidayImportBusy(true)
    setError(null)
    try {
      const total = selectedHolidayMissing.length
      setHolidayImportProgress({
        completed: 0,
        total,
        label: `Importing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry}`,
      })

      let completed = 0
      for (const entry of selectedHolidayMissing) {
        await createLeaveHoliday(token, {
          name: entry.name.trim(),
          holiday_date: entry.holidayDate,
          is_recurring: entry.isRecurring,
        })
        completed += 1
        setHolidayImportProgress({
          completed,
          total,
          label: `Importing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((country) => country.code === holidayImportCountry)?.label ?? holidayImportCountry}`,
        })
      }
      await reloadAll(tab, true)
      setHolidayImportProgress({
        completed: total,
        total,
        label: `Imported holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry}`,
      })
      showSuccessAlert(
        `${selectedHolidayMissing.length} holiday${selectedHolidayMissing.length === 1 ? "" : "ies"} imported for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry}.`
      )
      setHolidayImportDialogOpen(false)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to import country holidays."
      setError(message)
      showErrorAlert(message)
    } finally {
      setHolidayImportBusy(false)
      window.setTimeout(() => {
        setHolidayImportProgress((current) => {
          if (!current || current.completed < current.total) {
            return current
          }
          return null
        })
      }, 1800)
    }
  }

  async function removeCountryHolidays() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    if (removableCountryHolidays.length === 0) {
      showSuccessAlert("No imported country holidays matched the current list.")
      return
    }

    setHolidayRemoveBusy(true)
    setError(null)
    try {
      const total = removableCountryHolidays.length
      setHolidayRemoveProgress({
        completed: 0,
        total,
        label: `Removing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}`,
      })

      let completed = 0
      for (const row of removableCountryHolidays) {
        const id = readLeaveHolidayId(row)
        if (id === null) {
          continue
        }
        await deleteLeaveHoliday(token, id)
        completed += 1
        setHolidayRemoveProgress({
          completed,
          total,
          label: `Removing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}`,
        })
      }
      await reloadAll(tab, true)
      setHolidayRemoveProgress({
        completed: total,
        total,
        label: `Removed holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}`,
      })
      showSuccessAlert(
        `${removableCountryHolidays.length} holiday${removableCountryHolidays.length === 1 ? "" : "ies"} removed for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}.`
      )
      setHolidayRemoveDialogOpen(false)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to remove country holidays."
      setError(message)
      showErrorAlert(message)
    } finally {
      setHolidayRemoveBusy(false)
      window.setTimeout(() => {
        setHolidayRemoveProgress((current) => {
          if (!current || current.completed < current.total) {
            return current
          }
          return null
        })
      }, 1800)
    }
  }

  async function submitTypeForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    if (!typeForm.name.trim() || !typeForm.code.trim()) {
      const message = "Leave type name and code are required."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: typeForm.name.trim(),
        code: typeForm.code.trim(),
        description: typeForm.description.trim(),
        status: typeForm.status,
        is_paid: typeForm.is_paid === "true",
        requires_attachment: typeForm.requires_attachment === "true",
        is_carry_forward_allowed: typeForm.is_carry_forward_allowed === "true",
        max_carry_forward_days: Number(typeForm.max_carry_forward_days || "0"),
        max_days_per_year: Number(typeForm.max_days_per_year || "0"),
        gender_restriction: typeForm.gender_restriction,
      }

      const editingId = readLeaveTypeId(editingLeaveTypeRow)
      if (editingId !== null) {
        await patchLeaveType(token, editingId, payload)
      } else {
        await createLeaveType(token, payload)
      }

      resetTypeForm()
      setTypeDialogOpen(false)
      setLeaveTypeDetailsOpen(false)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error
        ? errorObject.message
        : editingLeaveTypeRow
          ? "Failed to update leave type."
          : "Failed to create leave type."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    if (!requestForm.employee_id) {
      const message = "Please select an employee."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (!requestForm.leave_type_id) {
      const message = "Please select a leave type."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (!requestForm.start_date || !requestForm.end_date) {
      const message = "Please select both start and end dates."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (new Date(requestForm.start_date).getTime() > new Date(requestForm.end_date).getTime()) {
      const message = "Start date cannot be after end date."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (!requestForm.reason.trim()) {
      const message = "Reason is required."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const createdRequest = await createLeaveRequest(token, {
        employee_id: Number(requestForm.employee_id),
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason.trim(),
        submit: requestForm.submit === "true",
      })
      if (requestForm.submit === "true") {
        const createdRecord = asRecord(createdRequest)
        const nestedLeaveRequest = asRecord(createdRecord?.leave_request)
        const nestedLeaveRequestCamel = asRecord(createdRecord?.leaveRequest)
        const createdRequestId =
          (createdRecord
            ? readNumber(createdRecord, ["id", "request_id", "leave_request_id", "leaveRequestId"])
            : null) ??
          (nestedLeaveRequest ? readNumber(nestedLeaveRequest, ["id"]) : null) ??
          (nestedLeaveRequestCamel ? readNumber(nestedLeaveRequestCamel, ["id"]) : null)
        void notifySubmittedRequestApprovers({
          kind: "leave_request",
          token,
          request: createdRequest,
          loadRequest:
            createdRequestId === null
              ? undefined
              : () => getLeaveRequest(token, createdRequestId),
          requesterName:
            employees.find((row) =>
              readNumber(row, ["id", "employee_id", "user_id"]) === Number(requestForm.employee_id)
            )
              ? employeeLabelFromRow(
                  employees.find((row) =>
                    readNumber(row, ["id", "employee_id", "user_id"]) ===
                    Number(requestForm.employee_id)
                  ) as AdminRecord
                )
              : undefined,
        })
      }
      setRequestForm({
        employee_id: "",
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        submit: "true",
      })
      setRequestDialogOpen(false)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function openRequestDialog() {
    const loaded = await ensureLookups(["types", "employees"])
    if (!loaded) {
      return
    }
    setRequestDialogOpen(true)
  }

  async function submitBalanceAdjustment() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await adjustLeaveBalance(token, {
        employee_id: Number(balanceForm.employee_id),
        leave_type_id: Number(balanceForm.leave_type_id),
        fiscal_year: balanceForm.fiscal_year,
        allocated_days: Number(balanceForm.allocated_days),
        carried_forward_days: Number(balanceForm.carried_forward_days),
        expired_days: Number(balanceForm.expired_days),
      })
      showSuccessAlert("Leave balance updated.")
      finishBalanceEditor()
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to adjust leave balance."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function findMatchingBalanceRow(employeeId: string, leaveTypeId: string, fiscalYear: string) {
    const employeeNumber = Number(employeeId)
    const typeNumber = Number(leaveTypeId)
    if (!Number.isFinite(employeeNumber) || !Number.isFinite(typeNumber)) {
      return null
    }
    const year = fiscalYear.trim()
    const pool = [...(selectedBalanceGroup?.rows ?? []), ...balances]
    return (
      pool.find((row) => {
        const rowEmployee = readBalanceEmployeeId(row)
        const rowType = leaveTypeIdFromRow(row)
        const rowYear = readString(row, ["fiscal_year", "fiscalYear"])
        return (
          rowEmployee === employeeNumber &&
          rowType === typeNumber &&
          (year === "" || rowYear === "-" || rowYear === year)
        )
      }) ?? null
    )
  }

  function applyBalanceSelection(next: { employee_id: string; leave_type_id: string; fiscal_year: string }) {
    const match = findMatchingBalanceRow(next.employee_id, next.leave_type_id, next.fiscal_year)
    if (match) {
      setSelectedBalanceRow(match)
      setBalanceForm(formFromBalanceRow(match))
      return
    }
    setSelectedBalanceRow(null)
    setBalanceForm((prev) => ({
      ...prev,
      ...next,
      allocated_days: "0",
      carried_forward_days: "0",
      expired_days: "0",
    }))
  }

  function openEmployeeBalanceDetails(group: LeaveBalanceEmployeeGroup) {
    setSelectedBalanceGroup(group)
    setEmployeeBalanceDetailsOpen(true)
  }

  function openBalanceBulkDialog(action: "generate" | "carry-forward") {
    const yearFromRows = groupedBalances.find((group) => group.fiscalYears.length > 0)?.fiscalYears[0]
    setBalanceBulkYear(yearFromRows || String(new Date().getFullYear()))
    setBalanceBulkDialog(action)
  }

  async function submitBalanceBulkAction() {
    const token = readStoredToken()
    if (!token || !balanceBulkDialog) {
      return
    }
    const fiscalYear = balanceBulkYear.trim()
    if (!/^\d{4}$/.test(fiscalYear)) {
      showErrorAlert("Enter a valid four-digit fiscal year.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (balanceBulkDialog === "generate") {
        await generateLeaveBalances(token, {
          fiscal_year: fiscalYear,
          force_recalculate: true,
        })
        showSuccessAlert("Leave balances generated.")
      } else {
        await carryForwardLeaveBalances(token, {
          fiscal_year: fiscalYear,
        })
        showSuccessAlert("Carry-forward calculated.")
      }
      setBalanceBulkDialog(null)
      await reloadAll("balances", true)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : balanceBulkDialog === "generate"
            ? "Generate failed."
            : "Carry-forward failed."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function finishBalanceEditor() {
    const shouldReturn = returnToEmployeeBalancesRef.current && Boolean(selectedBalanceGroupRef.current)
    returnToEmployeeBalancesRef.current = false
    setReturnToEmployeeBalances(false)
    setBalanceDialogOpen(false)
    setSelectedBalanceRow(null)
    resetBalanceForm()
    if (shouldReturn) {
      window.setTimeout(() => {
        setEmployeeBalanceDetailsOpen(true)
      }, 50)
    }
  }

  async function openBalanceDialog(row?: AdminRecord) {
    const cameFromEmployee = employeeBalanceDetailsOpen
    if (row && cameFromEmployee) {
      returnToEmployeeBalancesRef.current = true
      setReturnToEmployeeBalances(true)
    }
    const loaded = await ensureLookups(["types", "employees"])
    if (!loaded) {
      if (row && cameFromEmployee) {
        returnToEmployeeBalancesRef.current = false
        setReturnToEmployeeBalances(false)
      }
      return
    }
    if (row) {
      returnToEmployeeBalancesRef.current = cameFromEmployee
      setReturnToEmployeeBalances(cameFromEmployee)
      setEmployeeBalanceDetailsOpen(false)
      setSelectedBalanceRow(row)
      setBalanceForm(formFromBalanceRow(row))
    } else {
      returnToEmployeeBalancesRef.current = false
      setReturnToEmployeeBalances(false)
      setSelectedBalanceRow(null)
      resetBalanceForm()
    }
    setBalanceDialogOpen(true)
  }

  async function submitHolidayForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await createLeaveHoliday(token, {
        name: holidayForm.name.trim(),
        holiday_date: holidayForm.holiday_date,
        is_recurring: holidayForm.is_recurring === "true",
      })
      setHolidayForm({ name: "", holiday_date: "", is_recurring: "false" })
      setHolidayDialogOpen(false)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitPolicyForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: policyForm.name.trim(),
        description: policyForm.description.trim(),
        accrual_method: policyForm.accrual_method,
        accrual_rate: Number(policyForm.accrual_rate),
        allow_negative_balance: policyForm.allow_negative_balance === "true",
        status: policyForm.status,
        applicable_department_id: policyForm.applicable_department_id ? Number(policyForm.applicable_department_id) : undefined,
        applicable_position_id: policyForm.applicable_position_id ? Number(policyForm.applicable_position_id) : undefined,
        max_consecutive_days: Number(policyForm.max_consecutive_days),
        min_service_months: Number(policyForm.min_service_months),
        leave_types: [
          {
            leave_type_id: Number(policyForm.leave_type_id),
            annual_quota_days: Number(policyForm.annual_quota_days),
            max_per_request_days: Number(policyForm.max_per_request_days),
            requires_approval: policyForm.requires_approval === "true",
          },
        ],
      }
      if (editingPolicyId === null) {
        await createLeavePolicy(token, payload)
      } else {
        await patchLeavePolicy(token, editingPolicyId, payload)
      }
      setPolicyForm((prev) => ({
        ...prev,
        name: "",
        description: "",
        leave_type_id: "",
      }))
      setEditingPolicyId(null)
      setPolicySheetOpen(false)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error
        ? errorObject.message
        : editingPolicyId === null
          ? "Failed to create leave policy."
          : "Failed to update leave policy."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function togglePolicyStatus(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id", "policy_id"])
    if (!token || id === null) {
      return
    }
    const nextStatus = readString(row, ["status"]).toLowerCase() === "active" ? "inactive" : "active"
    setSaving(true)
    try {
      await patchLeavePolicy(token, id, { status: nextStatus })
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update policy status."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removePolicy(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id", "policy_id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeavePolicy(token, id)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete policy."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function loadPolicyIntoForm(row: AdminRecord) {
    const policyId = readNumber(row, ["id", "policy_id"])
    const rawLeaveTypes = Array.isArray(row.leave_types) ? row.leave_types : []
    const firstLeaveType = rawLeaveTypes[0]
    const leaveTypeRecord =
      firstLeaveType && typeof firstLeaveType === "object"
        ? (firstLeaveType as AdminRecord)
        : null

    const readPolicyNumber = (keys: string[]) => {
      const value = readNumber(row, keys)
      return value !== null ? String(value) : "0"
    }

    setPolicyForm({
      name: readString(row, ["name", "title"]) === "-" ? "" : readString(row, ["name", "title"]),
      description: readString(row, ["description"]) === "-" ? "" : readString(row, ["description"]),
      accrual_method: readString(row, ["accrual_method"]) === "-" ? "yearly" : readString(row, ["accrual_method"]),
      accrual_rate: readPolicyNumber(["accrual_rate"]),
      allow_negative_balance: readBoolean(row, ["allow_negative_balance"]) ? "true" : "false",
      status: readString(row, ["status"]).toLowerCase() === "inactive" ? "inactive" : "active",
      applicable_department_id: String(readNumber(row, ["applicable_department_id"]) ?? ""),
      applicable_position_id: String(readNumber(row, ["applicable_position_id"]) ?? ""),
      max_consecutive_days: readPolicyNumber(["max_consecutive_days"]),
      min_service_months: readPolicyNumber(["min_service_months"]),
      leave_type_id: String(
        readNumber(row, ["leave_type_id"]) ??
          (leaveTypeRecord ? readNumber(leaveTypeRecord, ["leave_type_id", "id"]) : null) ??
          ""
      ),
      annual_quota_days: String(
        readNumber(row, ["annual_quota_days"]) ??
          (leaveTypeRecord ? readNumber(leaveTypeRecord, ["annual_quota_days"]) : null) ??
          "0"
      ),
      max_per_request_days: String(
        readNumber(row, ["max_per_request_days"]) ??
          (leaveTypeRecord ? readNumber(leaveTypeRecord, ["max_per_request_days"]) : null) ??
          "0"
      ),
      requires_approval: String(
        readBoolean(row, ["requires_approval"]) ||
          (leaveTypeRecord ? readBoolean(leaveTypeRecord, ["requires_approval"]) : false)
      ),
    })
    setEditingPolicyId(policyId)
    setPolicySheetOpen(true)
  }

  function openPolicyPreview(row: AdminRecord) {
    setSelectedPolicyRow(row)
    setPolicyPreviewOpen(true)
  }

  function openCreatePolicySheet() {
    void (async () => {
      const loaded = await ensureLookups(["types", "departments", "positions"])
      if (!loaded) {
        return
      }
      setEditingPolicyId(null)
      setPolicyForm({
        name: "",
        description: "",
        accrual_method: "yearly",
        accrual_rate: "0",
        allow_negative_balance: "false",
        status: "active",
        applicable_department_id: "",
        applicable_position_id: "",
        max_consecutive_days: "1",
        min_service_months: "0",
        leave_type_id: "",
        annual_quota_days: "0",
        max_per_request_days: "0",
        requires_approval: "true",
      })
      setPolicySheetOpen(true)
    })()
  }

  async function submitWorkflowForm() {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (editingWorkflowId === null && workflowSteps.length === 0) {
      const message = "Add at least one workflow step before creating the workflow."
      setError(message)
      showErrorAlert(message)
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingWorkflowId === null) {
        await createLeaveWorkflow(token, {
          name: workflowForm.name.trim(),
          leave_type_id: Number(workflowForm.leave_type_id),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
          steps: workflowSteps.map((row) => buildWorkflowStepPayload({
            approval_level: String(readNumber(row, ["approval_level"]) ?? 1),
            approver_type: readString(row, ["approver_type"]) === "-" ? "role" : String(row.approver_type ?? "role"),
            action_type: readString(row, ["action_type"]) === "-" ? "recommend" : String(row.action_type ?? "recommend"),
            role_id: String(readNumber(row, ["role_id"]) ?? ""),
            position_id: String(readNumber(row, ["position_id"]) ?? ""),
            company_user_id: String(readNumber(row, ["company_user_id"]) ?? ""),
            assigned_branch_id: String(readNumber(row, ["assigned_branch_id"]) ?? ""),
            assigned_department_id: String(readNumber(row, ["assigned_department_id"]) ?? ""),
            is_required: readBoolean(row, ["is_required"]) ? "true" : "false",
          })),
        })
      } else {
        await patchLeaveWorkflow(token, editingWorkflowId, {
          name: workflowForm.name.trim(),
          leave_type_id: Number(workflowForm.leave_type_id),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
        })
      }
      setWorkflowForm({
        name: "",
        leave_type_id: "",
        status: "active",
        is_default: "false",
      })
      setEditingWorkflowId(null)
      setSelectedWorkflowId("")
      setWorkflowSteps([])
      setWorkflowSheetOpen(false)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function openCreateWorkflowSheet() {
    void (async () => {
      const loaded = await ensureLookups(["types"])
      if (!loaded) {
        return
      }
      setEditingWorkflowId(null)
      setSelectedWorkflowId("")
      setWorkflowSteps([])
      setWorkflowForm({
        name: "",
        leave_type_id: "",
        status: "active",
        is_default: "false",
      })
      setWorkflowSheetOpen(true)
    })()
  }

  async function openEditWorkflowSheet(row: AdminRecord) {
    const loaded = await ensureLookups(["types"])
    if (!loaded) {
      return
    }
    const workflowId = readNumber(row, ["id", "workflow_id"])
    if (workflowId === null) {
      return
    }
    setEditingWorkflowId(workflowId)
    setWorkflowForm({
      name: readString(row, ["name", "title"]) === "-" ? "" : readString(row, ["name", "title"]),
      leave_type_id: String(readNumber(row, ["leave_type_id"]) ?? ""),
      status: readString(row, ["status"]).toLowerCase() === "inactive" ? "inactive" : "active",
      is_default: readBoolean(row, ["is_default"]) ? "true" : "false",
    })
    setSelectedWorkflowId(String(workflowId))
    await loadWorkflowSteps(String(workflowId))
    setWorkflowSheetOpen(true)
  }

  async function loadWorkflowSteps(workflowId: string) {
    const token = readStoredToken()
    if (!token || !workflowId) {
      setWorkflowSteps([])
      return
    }
    try {
      const detailed = await getLeaveWorkflow(token, workflowId)
      const inlineSteps =
        Array.isArray(detailed?.steps) ? (detailed?.steps as AdminRecord[]) :
        Array.isArray(detailed?.workflow_steps) ? (detailed?.workflow_steps as AdminRecord[]) : []
      if (inlineSteps.length > 0) {
        setWorkflowSteps(inlineSteps)
        return
      }
      const rows = await listLeaveWorkflowSteps(token, workflowId)
      setWorkflowSteps(rows)
    } catch {
      setWorkflowSteps([])
    }
  }

  async function submitWorkflowStepForm(workflowIdOverride?: string) {
    const token = readStoredToken()
    const workflowId = workflowIdOverride ?? selectedWorkflowId
    const stepPayload = buildWorkflowStepPayload(workflowStepForm)

    if (!Number.isFinite(stepPayload.approval_level) || stepPayload.approval_level < 1) {
      const message = "Approval level must be 1 or higher."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (stepPayload.approver_type === "role" && !stepPayload.role_id) {
      const message = "Choose a role for this workflow step."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (stepPayload.approver_type === "position" && !stepPayload.position_id) {
      const message = "Choose a position for this workflow step."
      setError(message)
      showErrorAlert(message)
      return
    }
    if (stepPayload.approver_type === "company_user" && !stepPayload.company_user_id) {
      const message = "Choose a company user for this workflow step."
      setError(message)
      showErrorAlert(message)
      return
    }

    if (!workflowId) {
      const draftStepId = editingWorkflowStepId ?? -Date.now()
      const draftStep: AdminRecord = {
        id: draftStepId,
        step_id: draftStepId,
        approval_level: stepPayload.approval_level,
        approver_type: stepPayload.approver_type,
        action_type: stepPayload.action_type,
        role_id: stepPayload.role_id ?? null,
        position_id: stepPayload.position_id ?? null,
        company_user_id: stepPayload.company_user_id ?? null,
        assigned_branch_id: stepPayload.assigned_branch_id ?? null,
        assigned_department_id: stepPayload.assigned_department_id ?? null,
        is_required: stepPayload.is_required,
      }

      setWorkflowSteps((current) => {
        if (editingWorkflowStepId === null) {
          return [...current, draftStep].sort((left, right) => (readNumber(left, ["approval_level"]) ?? 0) - (readNumber(right, ["approval_level"]) ?? 0))
        }
        return current
          .map((row) => {
            const id = readNumber(row, ["id", "step_id"])
            return id === editingWorkflowStepId ? draftStep : row
          })
          .sort((left, right) => (readNumber(left, ["approval_level"]) ?? 0) - (readNumber(right, ["approval_level"]) ?? 0))
      })
      setWorkflowStepForm((prev) => ({ ...prev, approval_level: String((Number(prev.approval_level) || 0) + 1) }))
      setEditingWorkflowStepId(null)
      setStepDialogOpen(false)
      return
    }

    if (!token) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingWorkflowStepId === null) {
        await createLeaveWorkflowStep(token, workflowId, stepPayload)
      } else {
        await patchLeaveWorkflowStep(token, workflowId, editingWorkflowStepId, stepPayload)
      }
      setWorkflowStepForm((prev) => ({ ...prev, approval_level: String((Number(prev.approval_level) || 0) + 1) }))
      setEditingWorkflowStepId(null)
      setStepDialogOpen(false)
      await loadWorkflowSteps(workflowId)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create workflow step."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function openCreateStepDialog() {
    void (async () => {
      const loaded = await ensureLookups(["employees", "departments", "positions", "branches", "roles"])
      if (!loaded) {
        return
      }
      setEditingWorkflowStepId(null)
      setWorkflowStepForm({
        approval_level: String((workflowSteps.length || 0) + 1),
        approver_type: "role",
        action_type: "recommend",
        role_id: "",
        position_id: "",
        company_user_id: "",
        assigned_branch_id: "",
        assigned_department_id: "",
        is_required: "true",
      })
      setStepDialogOpen(true)
    })()
  }

  function openEditStepDialog(row: AdminRecord) {
    void (async () => {
      const loaded = await ensureLookups(["employees", "departments", "positions", "branches", "roles"])
      if (!loaded) {
        return
      }
      const stepId = readNumber(row, ["id", "step_id"])
      if (stepId === null) {
        return
      }
      setEditingWorkflowStepId(stepId)
      setWorkflowStepForm({
        approval_level: String(readNumber(row, ["approval_level"]) ?? 1),
        approver_type: readString(row, ["approver_type"]) === "-" ? "role" : String(row.approver_type ?? "role"),
        action_type: readString(row, ["action_type"]) === "-" ? "recommend" : String(row.action_type ?? "recommend"),
        role_id: String(readNumber(row, ["role_id"]) ?? ""),
        position_id: String(readNumber(row, ["position_id"]) ?? ""),
        company_user_id: String(readNumber(row, ["company_user_id"]) ?? ""),
        assigned_branch_id: String(readNumber(row, ["assigned_branch_id"]) ?? ""),
        assigned_department_id: String(readNumber(row, ["assigned_department_id"]) ?? ""),
        is_required: readBoolean(row, ["is_required"]) ? "true" : "false",
      })
      setStepDialogOpen(true)
    })()
  }

  async function toggleWorkflowStatus(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id", "workflow_id"])
    if (!token || id === null) {
      return
    }
    const nextStatus = readString(row, ["status"]).toLowerCase() === "active" ? "inactive" : "active"
    setSaving(true)
    try {
      await patchLeaveWorkflow(token, id, { status: nextStatus })
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update workflow status."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeWorkflow(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id", "workflow_id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveWorkflow(token, id)
      if (String(id) === selectedWorkflowId) {
        setSelectedWorkflowId("")
        setWorkflowSteps([])
      }
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeWorkflowStep(row: AdminRecord) {
    const token = readStoredToken()
    const stepId = readNumber(row, ["id", "step_id"])
    if (stepId === null) {
      return
    }
    if (!selectedWorkflowId) {
      setWorkflowSteps((current) => current.filter((entry) => {
        const entryId = readNumber(entry, ["id", "step_id"])
        return entryId !== stepId
      }))
      return
    }
    if (!token) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveWorkflowStep(token, selectedWorkflowId, stepId)
      await loadWorkflowSteps(selectedWorkflowId)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete workflow step."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleTypeStatus(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    const currentStatus = readString(row, ["status"]) === "active" ? "active" : "inactive"
    const nextStatus = currentStatus === "active" ? "inactive" : "active"
    setSaving(true)
    try {
      await patchLeaveType(token, id, { status: nextStatus })
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update leave type status."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeType(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveType(token, id)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete leave type."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function approveRequest(
    row: AdminRecord,
    action: "approve" | "reject" | "return_for_correction" = "approve"
  ) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    const permissions = getLeaveRequestPermissions(row, currentActor)
    if (!permissions.canApproveOrReject) {
      showErrorAlert(permissions.reasonApprove)
      return
    }
    setSaving(true)
    try {
      // API: POST /api/leave/requests/{id}/approval-action
      // body: { action: approve | reject | return_for_correction, comments?: string }
      // Do not send `approve` — backend rejects that property.
      const defaultComment =
        action === "approve"
          ? "Approved from dashboard"
          : action === "reject"
            ? "Rejected from dashboard"
            : "Returned for correction from dashboard"

      const actionResult = await leaveRequestApprovalAction(token, id, {
        action,
        comments: defaultComment,
      })
      void notifyLeaveRequestRequester({
        action,
        actorName: permissions.myPending?.name,
        token,
        request: actionResult ?? row,
        loadRequest: () => getLeaveRequest(token, id),
      })

      const successMessage =
        action === "approve"
          ? "Leave request approved."
          : action === "reject"
            ? "Leave request rejected."
            : "Leave request returned for correction."
      showSuccessAlert(successMessage)
      await reloadAll(tab, true)
      if (selectedLeaveRequestRow && readNumber(selectedLeaveRequestRow, ["id"]) === id) {
        const refreshed = (await listLeaveRequests(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })).rows.find((item) => readNumber(item, ["id"]) === id)
        if (refreshed) setSelectedLeaveRequestRow(refreshed)
      }
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function cancelRequest(row: AdminRecord, reason: string) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    if (!reason.trim()) {
      return
    }
    const permissions = getLeaveRequestPermissions(row, currentActor)
    if (!permissions.canCancel) {
      showErrorAlert(permissions.reasonCancel)
      return
    }
    setSaving(true)
    try {
      await cancelLeaveRequest(token, id, reason.trim())
      showSuccessAlert("Leave request cancelled.")
      await reloadAll(tab, true)
      setLeaveRequestDetailsOpen(false)
      setSelectedLeaveRequestRow(null)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to cancel leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function downloadRequestPdf(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSaving(true)
    try {
      const result = await downloadLeaveRequestPdf(token, id)
      downloadBlob(result.blob, result.filename)
      showSuccessAlert("Leave request PDF downloaded.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to download leave request PDF."
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function saveLeaveMedicalDetail(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSaving(true)
    try {
      await patchLeaveRequestMedicalDetail(token, id, {
        sickness_nature: leaveMedicalForm.sickness_nature.trim() || undefined,
        doctor_name: leaveMedicalForm.doctor_name.trim() || undefined,
        doctor_phone: leaveMedicalForm.doctor_phone.trim() || undefined,
        hospital_name: leaveMedicalForm.hospital_name.trim() || undefined,
        treatment_start_date: leaveMedicalForm.treatment_start_date || undefined,
        treatment_end_date: leaveMedicalForm.treatment_end_date || undefined,
        attachment_url: leaveMedicalForm.attachment_url.trim() || undefined,
      })
      await refreshLeaveRequestDetail(row)
      showSuccessAlert("Medical detail saved.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to save medical detail."
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadLeaveDocument(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }
    if (!leaveDocumentFile) {
      showErrorAlert("Choose a document to upload first.")
      return
    }

    setSaving(true)
    try {
      const file = await fileToBase64UploadDto(leaveDocumentFile)
      await addLeaveRequestDocument(token, id, { file })
      setLeaveDocumentFile(null)
      await refreshLeaveRequestDetail(row)
      showSuccessAlert("Leave document uploaded.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to upload leave document."
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function downloadRequestDocument(row: AdminRecord, documentRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readNumber(row, ["id"])
    const documentId = readNumber(documentRow, ["id"])
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSaving(true)
    try {
      const result = await downloadLeaveRequestDocument(token, requestId, documentId)
      downloadBlob(result.blob, result.filename)
      showSuccessAlert("Leave document downloaded.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to download leave document."
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleHolidayRecurring(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await patchLeaveHoliday(token, id, {
        is_recurring: !readBoolean(row, ["is_recurring"]),
      })
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to update holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeHoliday(row: AdminRecord) {
    const token = readStoredToken()
    const id = readLeaveHolidayId(row)
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveHoliday(token, id)
      await reloadAll(tab, true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  const refreshButton = (
    <button
      type="button"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm"
      onClick={() => void reloadAll(tab, true)}
      disabled={loading}
      aria-label="Refresh"
      title="Refresh"
    >
      <RefreshCw className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
    </button>
  )

  return (
    <div className="space-y-2">
      {showTabButtons ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {["types", "requests", "balances", "holidays", "policies", "workflows"].map((entry) => {
            const key = entry as LeaveTab
            return (
              <button
                key={entry}
                type="button"
                className={
                  tab === key
                    ? "inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium !text-white"
                    : "inline-flex h-8 items-center rounded-md border border-slate-300 px-2.5 text-xs"
                }
                onClick={() => setTab(key)}
              >
                {entry === "types"
                  ? "Leave Types"
                  : entry === "requests"
                    ? "Leave Requests"
                    : entry === "balances"
                      ? "Leave Balances"
                      : entry === "holidays"
                        ? "Holidays"
                        : entry === "policies"
                          ? "Leave Policies"
                          : "Leave Workflows"}
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {tab === "types" ? (
        <div className="space-y-2">
          <ResizableTable
            title="Leave Types"
            toolbarStart={
              <>
                <SearchToggleField
                  className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
                  placeholder="Search leave types"
                  value={typeSearch}
                  onChange={setTypeSearch}
                />
                <select
                  className="h-8 w-[8.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                  value={typeStatusFilter}
                  onChange={(event) => setTypeStatusFilter(event.target.value)}
                  aria-label="Filter leave type status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </>
            }
            toolbarActions={
              <>
                {canCreateTypes ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={() => openTypeDialogForCreate()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Leave Type
                  </button>
                ) : null}
                {refreshButton}
              </>
            }
            data={filteredTypes}
            onRowSelect={(_, row) => {
              if (row) {
                openLeaveTypeDetails(row)
              }
            }}
            columns={[
              { key: "name", label: "Name", defaultWidth: 110, sortable: true, render: (r) => readString(r, ["name"]) },
              { key: "code", label: "Code", defaultWidth: 55, sortable: true, render: (r) => readString(r, ["code"]) },
              {
                key: "status",
                label: "Status",
                defaultWidth: 55,
                sortable: true,
                render: (r) => <StatusIndicator status={readString(r, ["status"])} />,
              },
              { key: "is_paid", label: "Paid", defaultWidth: 45, render: (r) => readBoolean(r, ["is_paid"]) ? "Y" : "N" },
              { key: "actions", label: "Actions", defaultWidth: 80, sortable: false, render: (row) => {
                  const isActive = readString(row, ["status"]) === "active";
                  return (
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      {canCreateTypes ? (
                        <Switch
                          size="sm"
                          checked={isActive}
                          onCheckedChange={() => void toggleTypeStatus(row)}
                          aria-label="Toggle Status"
                          className="scale-90"
                        />
                      ) : null}
                      {canCreateTypes ? (
                        <button
                          type="button"
                          className="group rounded-md border border-sky-200 p-1.5 text-sky-600 transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:bg-sky-50 hover:shadow-sm active:scale-95"
                          onClick={() => openTypeDialogForEdit(row)}
                          aria-label="Edit leave type"
                          title="Edit leave type"
                        >
                          <Pencil className="size-3.5 transition-transform duration-300 group-hover:scale-110" />
                        </button>
                      ) : null}
                      {canDeleteTypes ? (
                        <button
                          type="button"
                          className="group rounded-md border border-rose-200 p-1.5 text-rose-600 transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:bg-rose-50 hover:shadow-sm active:scale-95"
                          onClick={() => setPendingTypeDelete(row)}
                          aria-label="Delete leave type"
                          title="Delete leave type"
                        >
                          <Trash2 className="size-3.5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                        </button>
                      ) : null}
                    </div>
                  );
                } },
            ]}
            itemsPerPage={20}
            loading={loading}
            storageKey="leave-types"
          />

          <Dialog
            open={leaveTypeDetailsOpen}
            onOpenChange={(open) => {
              setLeaveTypeDetailsOpen(open)
              if (!open) {
                setSelectedLeaveTypeRow(null)
              }
            }}
          >
            <DialogPopup
              from="bottom"
              className="flex max-h-[min(92dvh,36rem)] w-[calc(100%-1rem)] max-w-md flex-col gap-0 overflow-hidden p-3 sm:max-w-lg sm:p-4"
            >
              <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <DialogTitle className="text-base leading-snug sm:text-lg">
                    {selectedLeaveTypeRow ? readString(selectedLeaveTypeRow, ["name"]) : "Leave type details"}
                  </DialogTitle>
                  {selectedLeaveTypeRow ? (
                    <StatusIndicator status={readString(selectedLeaveTypeRow, ["status"])} />
                  ) : null}
                </div>
                <DialogDescription className="text-xs">
                  {selectedLeaveTypeRow
                    ? readDisplayValue(selectedLeaveTypeRow, ["code"])
                    : "Leave type details"}
                </DialogDescription>
              </DialogHeader>

              {selectedLeaveTypeRow ? (
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain py-2 pr-0.5">
                  <p className="rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-xs leading-relaxed text-slate-700">
                    {readString(selectedLeaveTypeRow, ["description"])}
                  </p>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-slate-200 bg-white p-2.5 text-xs sm:grid-cols-3">
                    {[
                      { label: "ID", value: readDisplayValue(selectedLeaveTypeRow, ["id"]) },
                      { label: "Company", value: resolveLeaveTypeCompanyName(selectedLeaveTypeRow) },
                      { label: "Code", value: readDisplayValue(selectedLeaveTypeRow, ["code"]) },
                      { label: "Status", value: readDisplayValue(selectedLeaveTypeRow, ["status"]) },
                      { label: "Paid", value: readBoolean(selectedLeaveTypeRow, ["is_paid"]) ? "Yes" : "No" },
                      {
                        label: "Attachment",
                        value: readBoolean(selectedLeaveTypeRow, ["requires_attachment"]) ? "Yes" : "No",
                      },
                      {
                        label: "Carry forward",
                        value: readBoolean(selectedLeaveTypeRow, ["is_carry_forward_allowed"]) ? "Yes" : "No",
                      },
                      {
                        label: "Gender",
                        value: formatGenderRestriction(
                          readDisplayValue(selectedLeaveTypeRow, ["gender_restriction"])
                        ),
                      },
                      {
                        label: "Max days / year",
                        value: formatLeaveDays(readDisplayValue(selectedLeaveTypeRow, ["max_days_per_year"])),
                      },
                      {
                        label: "Max CF days",
                        value: formatLeaveDays(
                          readDisplayValue(selectedLeaveTypeRow, ["max_carry_forward_days"])
                        ),
                      },
                      {
                        label: "Created",
                        value: formatLeaveDateTime(readDisplayValue(selectedLeaveTypeRow, ["created_at"])),
                      },
                      {
                        label: "Updated",
                        value: formatLeaveDateTime(readDisplayValue(selectedLeaveTypeRow, ["updated_at"])),
                      },
                    ].map((item) => (
                      <div key={item.label} className="min-w-0 border-b border-slate-100 pb-1.5 last:border-b-0 sm:border-b-0 sm:pb-0">
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          {item.label}
                        </dt>
                        <dd className="mt-0.5 truncate font-medium text-slate-900" title={item.value}>
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <DialogFooter className="mt-2 shrink-0 border-t border-slate-100 pt-2 sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-sky-200 px-3 text-xs font-medium text-sky-700"
                  onClick={() => {
                    if (!selectedLeaveTypeRow) {
                      return
                    }
                    setLeaveTypeDetailsOpen(false)
                    openTypeDialogForEdit(selectedLeaveTypeRow)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
                  onClick={() => setLeaveTypeDetailsOpen(false)}
                >
                  Close
                </button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-2">
          <div className="flex min-w-0 items-center justify-between gap-1.5 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <SearchToggleField
                className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
                placeholder="Search leave requests"
                value={requestSearch}
                onChange={setRequestSearch}
              />
              <select
                className="h-8 w-[8.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                value={requestStatusFilter}
                onChange={(event) => setRequestStatusFilter(event.target.value)}
                aria-label="Filter leave request status"
              >
                <option value="all">All statuses</option>
                <option value="draft">draft</option>
                <option value="submitted">submitted</option>
                <option value="in_review">in_review</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="cancelled">cancelled</option>
                <option value="completed">completed</option>
              </select>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canCreateRequests ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                  onClick={() => void openRequestDialog()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Leave Request
                </button>
              ) : null}
              {refreshButton}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {loading && filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading leave requests…</p>
            ) : filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No leave requests found.</p>
            ) : (
              filteredRequests.map((row, index) => {
                const permissions = getLeaveRequestPermissions(row, currentActor)
                const rowKey = String(readNumber(row, ["id"]) ?? leaveRequestLabel(row) ?? index)

                return (
                  <div
                    key={`leave-request-card-${rowKey}`}
                    className="rounded-lg border border-border/70 bg-background p-3"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 text-left"
                      onClick={() => void openLeaveRequestDetails(row)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {employeeLabelFromRow(row)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {leaveRequestLabel(row)} · {leaveTypeLabelFromRequest(row)}
                        </p>
                      </div>
                      <StatusIndicator status={readString(row, ["status"])} />
                    </button>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">Start</span>
                        <span className="font-medium text-foreground">
                          {readString(row, ["start_date"]) || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">End</span>
                        <span className="font-medium text-foreground">
                          {readString(row, ["end_date"]) || "—"}
                        </span>
                      </div>
                    </div>

                    <ApprovalChain row={row} actor={currentActor} compact />

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-emerald-300 px-2 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        disabled={!permissions.canApproveOrReject || saving}
                        title={permissions.reasonApprove}
                        onClick={() => void approveRequest(row, "approve")}
                      >
                        <Check className="size-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-amber-300 px-2 text-xs font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        disabled={!permissions.canApproveOrReject || saving}
                        title={permissions.reasonApprove}
                        onClick={() => void approveRequest(row, "reject")}
                      >
                        <X className="size-3.5" />
                        Reject
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-2 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                        disabled={!permissions.canCancel || saving}
                        title={permissions.reasonCancel}
                        onClick={() => {
                          setPendingRequestCancel(row)
                          setCancelReason("Cancelled by admin")
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    {!permissions.canApproveOrReject && !permissions.isTerminal ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {permissions.waitingLabel}
                      </p>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>

          {/* Desktop / tablet table */}
          <div className="hidden min-w-0 md:block">
            <ResizableTable
              title="Leave Requests"
              toolbarStart={
                <>
                  <SearchToggleField
                    className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
                    placeholder="Search leave requests"
                    value={requestSearch}
                    onChange={setRequestSearch}
                  />
                  <select
                    className="h-8 w-[8.5rem] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900"
                    value={requestStatusFilter}
                    onChange={(event) => setRequestStatusFilter(event.target.value)}
                    aria-label="Filter leave request status"
                  >
                    <option value="all">All statuses</option>
                    <option value="draft">draft</option>
                    <option value="submitted">submitted</option>
                    <option value="in_review">in_review</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                    <option value="cancelled">cancelled</option>
                    <option value="completed">completed</option>
                  </select>
                </>
              }
              toolbarActions={
                <>
                  {canCreateRequests ? (
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                      onClick={() => void openRequestDialog()}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Leave Request
                    </button>
                  ) : null}
                  {refreshButton}
                </>
              }
              data={filteredRequests}
              onRowSelect={(_, row) => {
                if (row) {
                  void openLeaveRequestDetails(row)
                }
              }}
              columns={[
                {
                  key: "leave_id",
                  label: "ID",
                  defaultWidth: 72,
                  render: (r) => leaveRequestLabel(r),
                },
                {
                  key: "employee",
                  label: "Employee",
                  defaultWidth: 110,
                  render: (r) => employeeLabelFromRow(r),
                },
                {
                  key: "leave_type",
                  label: "Type",
                  defaultWidth: 90,
                  render: (r) => leaveTypeLabelFromRequest(r),
                },
                {
                  key: "start_date",
                  label: "Start",
                  defaultWidth: 84,
                  render: (r) => readString(r, ["start_date"]),
                },
                {
                  key: "end_date",
                  label: "End",
                  defaultWidth: 84,
                  render: (r) => readString(r, ["end_date"]),
                },
                {
                  key: "status",
                  label: "Status",
                  defaultWidth: 100,
                  render: (r) => <StatusIndicator status={readString(r, ["status"])} />,
                },
                {
                  key: "pending",
                  label: "Pending with",
                  defaultWidth: 130,
                  sortable: false,
                  render: (r) => {
                    const permissions = getLeaveRequestPermissions(r, currentActor)
                    if (permissions.isTerminal) {
                      return <span className="text-[11px] text-muted-foreground">—</span>
                    }
                    return (
                      <span className="block max-w-full truncate text-xs text-foreground" title={permissions.waitingLabel}>
                        {permissions.waitingLabel}
                      </span>
                    )
                  },
                },
                {
                  key: "actions",
                  label: "Actions",
                  defaultWidth: 56,
                  sortable: false,
                  render: (row) => {
                    const permissions = getLeaveRequestPermissions(row, currentActor)

                    if (permissions.isTerminal) {
                      return (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )
                    }

                    return (
                      <div
                        className="flex w-full items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
                            aria-label="Request actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            <DropdownMenuItem
                              disabled={!permissions.canApproveOrReject || saving}
                              onClick={() => {
                                if (!permissions.canApproveOrReject) return
                                void approveRequest(row, "approve")
                              }}
                              className="text-emerald-700 focus:text-emerald-700"
                            >
                              <Check className="size-3.5" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!permissions.canApproveOrReject || saving}
                              onClick={() => {
                                if (!permissions.canApproveOrReject) return
                                void approveRequest(row, "reject")
                              }}
                              className="text-amber-700 focus:text-amber-700"
                            >
                              <X className="size-3.5" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={saving}
                              onClick={() => {
                                const token = readStoredToken()
                                const id = readNumber(row, ["id"])
                                if (!token || id === null) return
                                void submitLeaveRequest(token, id)
                                  .then(() => { showSuccessAlert("Leave request submitted."); return reloadAll("requests", true) })
                                  .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Submit failed."))
                              }}
                            >
                              Submit draft
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={saving}
                              onClick={() => {
                                const token = readStoredToken()
                                const id = readNumber(row, ["id"])
                                if (!token || id === null) return
                                void resubmitLeaveRequest(token, id)
                                  .then(() => { showSuccessAlert("Leave request resubmitted."); return reloadAll("requests", true) })
                                  .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Resubmit failed."))
                              }}
                            >
                              Resubmit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={!permissions.canCancel || saving}
                              onClick={() => {
                                if (!permissions.canCancel) return
                                setPendingRequestCancel(row)
                                setCancelReason("Cancelled by admin")
                              }}
                            >
                              Cancel request
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void openLeaveRequestDetails(row)}
                            >
                              View approval chain
                            </DropdownMenuItem>
                            {!permissions.canApproveOrReject ? (
                              <div className="border-t border-border px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                                {permissions.reasonApprove}
                              </div>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  },
                },
              ]}
              itemsPerPage={15}
              loading={loading}
              showExport={false}
              storageKey="leave-requests-v3"
            />
          </div>

          <Dialog
            open={leaveRequestDetailsOpen}
            onOpenChange={(open) => {
              setLeaveRequestDetailsOpen(open)
              if (!open) {
                setSelectedLeaveRequestRow(null)
                setLeaveDocumentFile(null)
                setLeaveMedicalForm(createEmptyLeaveMedicalForm())
              }
            }}
          >
            <DialogPopup
              from="bottom"
              className="flex max-h-[min(92dvh,40rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-3 sm:max-w-xl sm:p-4"
            >
              <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-base leading-snug sm:text-lg">
                    {selectedLeaveRequestRow
                      ? leaveRequestLabel(selectedLeaveRequestRow)
                      : "Leave request"}
                  </DialogTitle>
                  {selectedLeaveRequestRow ? (
                    <StatusIndicator status={readString(selectedLeaveRequestRow, ["status"])} />
                  ) : null}
                </div>
                <DialogDescription className="text-xs">
                  {selectedLeaveRequestRow
                    ? `${employeeLabelFromRow(selectedLeaveRequestRow)} · ${leaveTypeLabelFromRequest(selectedLeaveRequestRow)}`
                    : "Approval details"}
                </DialogDescription>
              </DialogHeader>

              {selectedLeaveRequestRow ? (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border/60 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</p>
                      <p className="font-medium text-foreground">
                        {readString(selectedLeaveRequestRow, ["start_date"])}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/60 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">End</p>
                      <p className="font-medium text-foreground">
                        {readString(selectedLeaveRequestRow, ["end_date"])}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Medical detail</p>
                        <p className="text-[11px] text-muted-foreground">
                          Save treatment details and any medical attachment URL returned by your document store.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={saving}
                        onClick={() => void saveLeaveMedicalDetail(selectedLeaveRequestRow)}
                      >
                        Save medical detail
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Sickness nature</p>
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={leaveMedicalForm.sickness_nature}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              sickness_nature: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Doctor name</p>
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={leaveMedicalForm.doctor_name}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              doctor_name: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Doctor phone</p>
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={leaveMedicalForm.doctor_phone}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              doctor_phone: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Hospital name</p>
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={leaveMedicalForm.hospital_name}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              hospital_name: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Treatment start</p>
                        <input
                          type="date"
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={leaveMedicalForm.treatment_start_date}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              treatment_start_date: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Treatment end</p>
                        <input
                          type="date"
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          value={leaveMedicalForm.treatment_end_date}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              treatment_end_date: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-xs font-medium text-slate-600">Attachment URL</p>
                        <input
                          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                          placeholder="https://..."
                          value={leaveMedicalForm.attachment_url}
                          onChange={(event) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              attachment_url: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Supporting documents</p>
                        <p className="text-[11px] text-muted-foreground">
                          Upload a file to the request and download previously attached documents.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={saving || !leaveDocumentFile}
                        onClick={() => void uploadLeaveDocument(selectedLeaveRequestRow)}
                      >
                        Upload document
                      </button>
                    </div>
                    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-3 py-3">
                      <input
                        type="file"
                        className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setLeaveDocumentFile(file)
                        }}
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {leaveDocumentFile
                          ? `Ready to upload: ${leaveDocumentFile.name}`
                          : "Choose a PDF, image, or other supporting document."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {leaveRequestDocuments.length === 0 ? (
                        <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                          No supporting documents attached yet.
                        </div>
                      ) : (
                        leaveRequestDocuments.map((documentRow, index) => (
                          <div
                            key={`leave-document-${readNumber(documentRow, ["id"]) ?? index}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">
                                {readString(documentRow, ["file_name"])}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {readString(documentRow, ["file_type"])} · uploaded{" "}
                                {formatLeaveDateTime(readString(documentRow, ["uploaded_at"]))}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={saving}
                              onClick={() =>
                                void downloadRequestDocument(
                                  selectedLeaveRequestRow,
                                  documentRow
                                )
                              }
                            >
                              <Download className="size-3.5" />
                              Download
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <ApprovalChain row={selectedLeaveRequestRow} actor={currentActor} />

                  {(() => {
                    const permissions = getLeaveRequestPermissions(
                      selectedLeaveRequestRow,
                      currentActor
                    )
                    return (
                      <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                        <button
                          type="button"
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                          disabled={saving}
                          onClick={() => void downloadRequestPdf(selectedLeaveRequestRow)}
                        >
                          <Download className="size-3.5" />
                          PDF
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-emerald-300 px-3 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                          disabled={!permissions.canApproveOrReject || saving}
                          title={permissions.reasonApprove}
                          onClick={() => void approveRequest(selectedLeaveRequestRow, "approve")}
                        >
                          <Check className="size-3.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-amber-300 px-3 text-xs font-medium text-amber-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                          disabled={!permissions.canApproveOrReject || saving}
                          title={permissions.reasonApprove}
                          onClick={() => void approveRequest(selectedLeaveRequestRow, "reject")}
                        >
                          <X className="size-3.5" />
                          Reject
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                          disabled={!permissions.canCancel || saving}
                          title={permissions.reasonCancel}
                          onClick={() => {
                            setPendingRequestCancel(selectedLeaveRequestRow)
                            setCancelReason("Cancelled by admin")
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )
                  })()}
                </div>
              ) : null}
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Leave Request</DialogTitle>
            <DialogDescription>Fill leave request details then submit or save as draft.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={requestForm.employee_id} onValueChange={(value) => setRequestForm((prev) => ({ ...prev, employee_id: value ?? "" }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select employee">
                  {employeeOptions.find((option) => option.value === requestForm.employee_id)?.label ?? "Select employee"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {employeeOptions.map((option) => (
                  <SelectItem key={`request-employee-dialog-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={requestForm.leave_type_id} onValueChange={(value) => setRequestForm((prev) => ({ ...prev, leave_type_id: value ?? "" }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select leave type">
                  {leaveTypeOptions.find((option) => option.value === requestForm.leave_type_id)?.label ?? "Select leave type"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {leaveTypeOptions.map((option) => (
                  <SelectItem key={`request-type-dialog-${option.value}`} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.submit} onChange={(event) => setRequestForm((prev) => ({ ...prev, submit: event.target.value }))}>
              <option value="true">Submit now</option>
              <option value="false">Save draft</option>
            </select>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">Start date</p>
              <DatePickerPresets value={requestForm.start_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, start_date: value }))} placeholder="Start date" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">End date</p>
              <DatePickerPresets value={requestForm.end_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, end_date: value }))} placeholder="End date" />
            </div>
            <div />
            <Textarea
              containerClassName="md:col-span-3"
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reason"
              value={requestForm.reason}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setRequestDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white" disabled={saving} onClick={() => void submitRequestForm()}>
              {saving ? "Saving..." : "Create Leave Request"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={typeDialogOpen}
        onOpenChange={(open) => {
          setTypeDialogOpen(open)
          if (!open) {
            resetTypeForm()
          }
        }}
      >
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLeaveTypeRow ? "Edit Leave Type" : "Create Leave Type"}</DialogTitle>
            <DialogDescription>
              {editingLeaveTypeRow
                ? "Update leave type details, then save your changes."
                : "Enter leave type details, then save them."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Type name" value={typeForm.name} onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Type code" value={typeForm.code} onChange={(event) => setTypeForm((prev) => ({ ...prev, code: event.target.value }))} />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.status} onChange={(event) => setTypeForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.is_paid} onChange={(event) => setTypeForm((prev) => ({ ...prev, is_paid: event.target.value }))}>
              <option value="true">Paid</option>
              <option value="false">Unpaid</option>
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.requires_attachment} onChange={(event) => setTypeForm((prev) => ({ ...prev, requires_attachment: event.target.value }))}>
              <option value="false">Attachment Optional</option>
              <option value="true">Attachment Required</option>
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.is_carry_forward_allowed} onChange={(event) => setTypeForm((prev) => ({ ...prev, is_carry_forward_allowed: event.target.value }))}>
              <option value="false">No carry forward</option>
              <option value="true">Carry forward allowed</option>
            </select>
            <input
              type="number"
              min={0}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Max carry forward days"
              value={typeForm.max_carry_forward_days}
              onChange={(event) => setTypeForm((prev) => ({ ...prev, max_carry_forward_days: event.target.value }))}
            />
            <input
              type="number"
              min={0}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Max days per year"
              value={typeForm.max_days_per_year}
              onChange={(event) => setTypeForm((prev) => ({ ...prev, max_days_per_year: event.target.value }))}
            />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={typeForm.gender_restriction} onChange={(event) => setTypeForm((prev) => ({ ...prev, gender_restriction: event.target.value }))}>
              <option value="any">Any gender</option>
              <option value="male">Male only</option>
              <option value="female">Female only</option>
            </select>
            <div className="md:col-span-2" />
            <Textarea
              containerClassName="md:col-span-3"
              className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Description"
              value={typeForm.description}
              onChange={(event) => setTypeForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setTypeDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white" disabled={saving} onClick={() => void submitTypeForm()}>
              {saving ? "Saving..." : editingLeaveTypeRow ? "Save Leave Type" : "Add Leave Type"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={balanceDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            finishBalanceEditor()
            return
          }
          setBalanceDialogOpen(true)
        }}
      >
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedBalanceRow || returnToEmployeeBalances ? "Edit leave balance" : "Adjust leave balance"}</DialogTitle>
            <DialogDescription>
              {returnToEmployeeBalances && selectedBalanceGroup
                ? `${selectedBalanceGroup.employeeName}${balanceForm.fiscal_year ? ` · FY ${balanceForm.fiscal_year}` : ""}`
                : selectedBalanceRow
                  ? `${employeeLabelFromRow(selectedBalanceRow)}${balanceForm.fiscal_year ? ` · FY ${balanceForm.fiscal_year}` : ""}`
                  : "Choose an employee and leave type, then set the days."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {returnToEmployeeBalances ? null : (
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Employee</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={balanceForm.employee_id}
                  onChange={(event) =>
                    applyBalanceSelection({
                      employee_id: event.target.value,
                      leave_type_id: balanceForm.leave_type_id,
                      fiscal_year: balanceForm.fiscal_year,
                    })
                  }
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => {
                    const id = readNumber(employee, ["id", "employee_id", "user_id"])
                    if (id === null) return null
                    return <option key={id} value={String(id)}>{employeeLabel(id)}</option>
                  })}
                </select>
              </label>
            )}
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Leave type</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                value={balanceForm.leave_type_id}
                onChange={(event) =>
                  applyBalanceSelection({
                    employee_id: balanceForm.employee_id,
                    leave_type_id: event.target.value,
                    fiscal_year: balanceForm.fiscal_year,
                  })
                }
              >
                <option value="">Select leave type</option>
                {(returnToEmployeeBalances && selectedBalanceGroup ? selectedBalanceGroup.rows : types).map((entry, index) => {
                  const id = leaveTypeIdFromRow(entry) ?? readNumber(entry, ["id"])
                  if (id === null) return null
                  const label = returnToEmployeeBalances ? leaveTypeLabelFromRow(entry) : readString(entry, ["name"])
                  return (
                    <option key={`${id}-${index}`} value={String(id)}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </label>
            {returnToEmployeeBalances ? null : (
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Fiscal year</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="2026"
                  value={balanceForm.fiscal_year}
                  onChange={(event) =>
                    applyBalanceSelection({
                      employee_id: balanceForm.employee_id,
                      leave_type_id: balanceForm.leave_type_id,
                      fiscal_year: event.target.value,
                    })
                  }
                />
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Allocated</span>
                <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.allocated_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, allocated_days: event.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Carried forward</span>
                <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.carried_forward_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, carried_forward_days: event.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Expired</span>
                <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.expired_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, expired_days: event.target.value }))} />
              </label>
            </div>
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => finishBalanceEditor()}>
              Cancel
            </button>
            <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white" disabled={saving} onClick={() => void submitBalanceAdjustment()}>
              {saving ? "Saving..." : selectedBalanceRow ? "Save" : "Adjust"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={employeeBalanceDetailsOpen}
        onOpenChange={(open) => {
          setEmployeeBalanceDetailsOpen(open)
          if (!open && !returnToEmployeeBalancesRef.current) {
            setSelectedBalanceGroup(null)
          }
        }}
      >
        <DialogPopup
          from="bottom"
          className="flex max-h-[min(92dvh,40rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-3 sm:max-w-xl sm:p-4"
        >
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle className="text-base leading-snug sm:text-lg">
              {selectedBalanceGroup?.employeeName ?? "Leave balances"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedBalanceGroup
                ? `${selectedBalanceGroup.typeCount} leave type${selectedBalanceGroup.typeCount === 1 ? "" : "s"}${
                    selectedBalanceGroup.fiscalYears.length > 0
                      ? ` · FY ${selectedBalanceGroup.fiscalYears.join(", ")}`
                      : ""
                  }`
                : "All leave balances for this employee."}
            </DialogDescription>
          </DialogHeader>

          {selectedBalanceGroup ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-2">
              <TalentDoodleSprites />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Allocated", value: selectedBalanceGroup.allocatedDays },
                  { label: "Used", value: selectedBalanceGroup.usedDays },
                  { label: "Remaining", value: selectedBalanceGroup.remainingDays },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="relative overflow-hidden rounded-2xl p-3 text-white"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    <TalentDoodle />
                    <div className="relative z-10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
                        {item.label}
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums leading-none">
                        {formatBalanceDays(item.value)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-md border border-slate-200">
                <div
                  className={cn(
                    "grid gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500",
                    canAdjustBalances
                      ? "grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_3.5rem_2rem]"
                      : "grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_3.5rem]"
                  )}
                >
                  <span>Type</span>
                  <span className="text-right">Alloc</span>
                  <span className="text-right">Used</span>
                  <span className="text-right">Rem</span>
                  {canAdjustBalances ? <span className="sr-only">Actions</span> : null}
                </div>
                {selectedBalanceGroupRows.map((row, index) => {
                  const typeName = leaveTypeLabelFromRow(row)
                  const rowKey = String(
                    readNumber(row, ["id", "leave_type_id", "leaveTypeId"]) ?? `${typeName}-${index}`
                  )
                  return (
                    <div
                      key={rowKey}
                      className={cn(
                        "grid items-center gap-2 border-b border-slate-100 px-2.5 py-2 text-xs last:border-b-0",
                        index % 2 === 1 ? "bg-primary/[0.08]" : "bg-background",
                        canAdjustBalances
                          ? "grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_3.5rem_2rem]"
                          : "grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_3.5rem]"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900" title={typeName}>
                          {typeName}
                        </p>
                        {selectedBalanceGroup.fiscalYears.length > 1 ? (
                          <p className="text-[10px] text-muted-foreground">
                            FY {readBalanceFiscalYear(row) || "-"}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-right tabular-nums text-slate-700">
                        {formatBalanceDays(readBalanceDays(row, ["allocated_days", "allocated", "allocatedDays"]))}
                      </span>
                      <span className="text-right tabular-nums text-slate-700">
                        {formatBalanceDays(readBalanceDays(row, ["used_days", "used", "usedDays"]))}
                      </span>
                      <span className="text-right tabular-nums font-medium text-slate-900">
                        {formatBalanceDays(readBalanceDays(row, ["remaining_days", "remaining", "remainingDays"]))}
                      </span>
                      {canAdjustBalances ? (
                        <button
                          type="button"
                          className="admin-table-icon-button justify-self-end"
                          title={`Edit ${typeName}`}
                          onClick={() => void openBalanceDialog(row)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <DialogFooter className="mt-2 shrink-0 border-t border-slate-100 pt-2 sm:justify-end">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
              onClick={() => setEmployeeBalanceDetailsOpen(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>Enter holiday details, then save them.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Holiday name" value={holidayForm.name} onChange={(event) => setHolidayForm((prev) => ({ ...prev, name: event.target.value }))} />
            <DatePickerPresets value={holidayForm.holiday_date} onChange={(value) => setHolidayForm((prev) => ({ ...prev, holiday_date: value }))} placeholder="Holiday date" />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={holidayForm.is_recurring} onChange={(event) => setHolidayForm((prev) => ({ ...prev, is_recurring: event.target.value }))}>
              <option value="false">One-time</option>
              <option value="true">Recurring</option>
            </select>
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setHolidayDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white" disabled={saving} onClick={() => void submitHolidayForm()}>
              {saving ? "Saving..." : "Add Holiday"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={holidayImportDialogOpen} onOpenChange={setHolidayImportDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Country Holidays</DialogTitle>
            <DialogDescription>Select a country and year, review what is missing, then import those holidays.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Country</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={holidayImportCountry}
                  onChange={(event) => setHolidayImportCountry(event.target.value as HolidayImportCountryCode)}
                  disabled={holidayImportBusy}
                >
                  {HOLIDAY_IMPORT_COUNTRIES.map((entry) => (
                    <option key={`import-country-${entry.code}`} value={entry.code}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Year</span>
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={holidayImportYear}
                  onChange={(event) => setHolidayImportYear(event.target.value)}
                  disabled={holidayImportBusy}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span>
                {holidayImportLoading
                  ? "Loading official holidays..."
                  : `${holidayImportCatalog.length} official holiday${holidayImportCatalog.length === 1 ? "" : "s"} available for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry} ${holidayImportYear}.`}
              </span>
              {!holidayImportLoading && holidayImportCatalog.length > 0 ? (
                <>
                  <span>{selectedHolidayMissing.length} ready to import</span>
                  <span>{selectedHolidayMatches.length} already in this list</span>
                </>
              ) : null}
            </div>
            {holidayImportError ? <p className="text-sm text-rose-600">{holidayImportError}</p> : null}
            {holidayImportProgress ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <ExampleProgress
                  label={holidayImportProgress.label}
                  value={progressPercent(holidayImportProgress.completed, holidayImportProgress.total)}
                  helperText={`${holidayImportProgress.completed} of ${holidayImportProgress.total} holidays processed`}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setHolidayImportDialogOpen(false)}
              disabled={holidayImportBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              onClick={() => void loadHolidayImportCatalog()}
              disabled={holidayImportLoading || holidayImportBusy}
            >
              {holidayImportLoading ? "Refreshing..." : "Refresh List"}
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void importCountryHolidays()}
              disabled={holidayImportLoading || holidayImportBusy || selectedHolidayMissing.length === 0}
            >
              {holidayImportBusy ? "Importing..." : "Import Holidays"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={holidayRemoveDialogOpen} onOpenChange={setHolidayRemoveDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Remove Country Holidays</DialogTitle>
            <DialogDescription>Select a country and year to remove holidays that match a previously imported country set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Country</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={holidayRemoveCountry}
                  onChange={(event) => setHolidayRemoveCountry(event.target.value as HolidayImportCountryCode)}
                  disabled={holidayRemoveBusy}
                >
                  {HOLIDAY_IMPORT_COUNTRIES.map((entry) => (
                    <option key={`remove-country-${entry.code}`} value={entry.code}>{entry.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">Year</span>
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={holidayRemoveYear}
                  onChange={(event) => setHolidayRemoveYear(event.target.value)}
                  disabled={holidayRemoveBusy}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span>
                {holidayRemoveLoading
                  ? "Loading country holidays..."
                  : `${removableCountryHolidays.length} holiday${removableCountryHolidays.length === 1 ? "" : "s"} currently match ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry} ${holidayRemoveYear}.`}
              </span>
              {!holidayRemoveLoading && holidayRemoveCatalog.length > 0 ? (
                <span>{holidayRemoveCatalog.length} official holidays checked against your list</span>
              ) : null}
            </div>
            {holidayRemoveError ? <p className="text-sm text-rose-600">{holidayRemoveError}</p> : null}
            {holidayRemoveProgress ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <ExampleProgress
                  label={holidayRemoveProgress.label}
                  value={progressPercent(holidayRemoveProgress.completed, holidayRemoveProgress.total)}
                  helperText={`${holidayRemoveProgress.completed} of ${holidayRemoveProgress.total} holidays removed`}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setHolidayRemoveDialogOpen(false)}
              disabled={holidayRemoveBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              onClick={() => void loadHolidayRemoveCatalog()}
              disabled={holidayRemoveLoading || holidayRemoveBusy}
            >
              {holidayRemoveLoading ? "Refreshing..." : "Refresh List"}
            </button>
            <button
              type="button"
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void removeCountryHolidays()}
              disabled={holidayRemoveLoading || holidayRemoveBusy || removableCountryHolidays.length === 0}
            >
              {holidayRemoveBusy ? "Removing..." : "Remove Country Holidays"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {tab === "balances" ? (
        <div className="space-y-2">
          <ResizableTable
            title="Leave Balances"
            toolbarActions={
              <>
            {canAdjustBalances ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                onClick={() => openBalanceBulkDialog("generate")}
              >
                Generate
              </button>
            ) : null}
            {canAdjustBalances ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                onClick={() => openBalanceBulkDialog("carry-forward")}
              >
                Carry forward
              </button>
            ) : null}
            {canAdjustBalances ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                onClick={() => void openBalanceDialog()}
              >
                <Plus className="h-3.5 w-3.5" />
                Adjust Leave Balance
              </button>
            ) : null}
            {refreshButton}
              </>
            }
            data={groupedBalances}
            getRowId={(group) => group.key}
            onRowSelect={(_, group) => {
              if (group) {
                openEmployeeBalanceDetails(group)
              }
            }}
            columns={balanceGroupColumns}
            itemsPerPage={20}
            loading={loading}
            storageKey="leave-balances-by-employee"
          />
          {balanceAdjustments.length > 0 ? (
          <ResizableTable
            title="Balance adjustments"
            data={balanceAdjustments}
            columns={[
              { key: "employee", label: "Employee", render: (r) => employeeLabelFromRow(r) },
              { key: "days", label: "Days", render: (r) => readString(r, ["days", "adjustment_days", "amount"]) },
              { key: "reason", label: "Reason", render: (r) => readString(r, ["reason", "remarks"]) },
            ]}
            itemsPerPage={10}
            loading={false}
            showExport={false}
            storageKey="leave-balance-adjustments"
          />
          ) : null}
          {balanceTransactions.length > 0 ? (
          <ResizableTable
            title="Balance transactions"
            data={balanceTransactions}
            columns={[
              { key: "employee", label: "Employee", render: (r) => employeeLabelFromRow(r) },
              { key: "type", label: "Type", render: (r) => readString(r, ["transaction_type", "type"]) },
              { key: "days", label: "Days", render: (r) => readString(r, ["days", "amount"]) },
            ]}
            itemsPerPage={10}
            loading={false}
            showExport={false}
            storageKey="leave-balance-transactions"
          />
          ) : null}
        </div>
      ) : null}

      {tab === "holidays" ? (
        <div className="space-y-2">
          <ResizableTable
            title="Holidays"
            toolbarActions={
              <>
                {canMutateHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
                    onClick={() => setHolidayImportDialogOpen(true)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Import
                  </button>
                ) : null}
                {canMutateHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700"
                    onClick={() => setHolidayRemoveDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Country
                  </button>
                ) : null}
                {canMutateHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={() => setHolidayDialogOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Holiday
                  </button>
                ) : null}
                {refreshButton}
              </>
            }
            data={holidays}
            columns={[
              { key: "name", label: "Name", defaultWidth: 110, sortable: true, render: (r) => readString(r, ["name"]) },
              { key: "holiday_date", label: "Date", defaultWidth: 70, sortable: true, render: (r) => readString(r, ["holiday_date"]) },
              {
                key: "is_recurring",
                label: "Recur",
                defaultWidth: 50,
                render: (r) => (
                  <Switch
                    size="sm"
                    checked={readBoolean(r, ["is_recurring"])}
                    onCheckedChange={() => void toggleHolidayRecurring(r)}
                    aria-label="Toggle recurring"
                    className="scale-90"
                  />
                ),
              },
              { key: "actions", label: "Act", defaultWidth: 45, sortable: false, render: (row) => (
                <div className="flex justify-end" onClick={e=>e.stopPropagation()}>
                  <button type="button" className="rounded-md border border-rose-200 p-2 text-rose-600" onClick={() => setPendingHolidayDelete(row)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) },
            ]}
            itemsPerPage={20}
            loading={loading}
            storageKey="leave-holidays"
          />
        </div>
      ) : null}

      {tab === "policies" ? (
        <div className="space-y-2">
          <ResizableTable
            title="Leave Policies"
            toolbarActions={
              <>
                {canMutatePolicies ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={openCreatePolicySheet}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Policy
                  </button>
                ) : null}
                {refreshButton}
              </>
            }
            data={policies}
            itemsPerPage={15}
            loading={loading}
            storageKey="leave-policies"
            onRowSelect={(_, row) => {
              if (row) openPolicyPreview(row)
            }}
            columns={[
              { key: "name", label: "Name", defaultWidth: 140, sortable: true },
              { key: "accrual_method", label: "Accrual", defaultWidth: 90, sortable: true },
              { key: "status", label: "Status", defaultWidth: 80, sortable: true },
              {
                key: "actions",
                label: "Actions",
                defaultWidth: 90,
                sortable: false,
                render: (row) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin-table-icon-button"
                      aria-label="Edit"
                      onClick={() => loadPolicyIntoForm(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="admin-table-icon-button"
                      aria-label="Toggle status"
                      disabled={saving}
                      onClick={() => void togglePolicyStatus(row)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ),
              },
            ]}
          />

          <Sheet open={policySheetOpen} onOpenChange={setPolicySheetOpen}>
            <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none">
              <SheetHeader>
                <SheetTitle>{editingPolicyId === null ? "Create Leave Policy" : "Edit Leave Policy"}</SheetTitle>
                <SheetDescription>
                  Fill in policy details, limits, and applicability settings.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid gap-3 px-4 pb-4 md:grid-cols-2">
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Policy name" value={policyForm.name} onChange={(event) => setPolicyForm((prev) => ({ ...prev, name: event.target.value }))} />
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={policyForm.accrual_method} onChange={(event) => setPolicyForm((prev) => ({ ...prev, accrual_method: event.target.value }))}>
                  <option value="monthly">monthly</option>
                  <option value="yearly">yearly</option>
                  <option value="manual">manual</option>
                </select>
                <input type="number" min={0} className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Accrual rate" value={policyForm.accrual_rate} onChange={(event) => setPolicyForm((prev) => ({ ...prev, accrual_rate: event.target.value }))} />
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={policyForm.status} onChange={(event) => setPolicyForm((prev) => ({ ...prev, status: event.target.value }))}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>

                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={policyForm.leave_type_id} onChange={(event) => setPolicyForm((prev) => ({ ...prev, leave_type_id: event.target.value }))}>
                  <option value="">Select leave type</option>
                  {types.map((type, index) => {
                    const id = readNumber(type, ["id"])
                    if (id === null) return null
                    return <option key={`policy-type-${id}-${index}`} value={String(id)}>{readString(type, ["name"])}</option>
                  })}
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={policyForm.applicable_department_id} onChange={(event) => setPolicyForm((prev) => ({ ...prev, applicable_department_id: event.target.value }))}>
                  <option value="">Department (optional)</option>
                  {departments.map((row, index) => {
                    const id = readNumber(row, ["id", "department_id"])
                    if (id === null) return null
                    return <option key={`policy-dept-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option>
                  })}
                </select>
                <SearchableSelect
                  id="leave-policy-position-options"
                  value={policyForm.applicable_position_id}
                  options={positionOptions}
                  placeholder="Search position (optional)"
                  onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, applicable_position_id: value }))}
                />
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={policyForm.allow_negative_balance} onChange={(event) => setPolicyForm((prev) => ({ ...prev, allow_negative_balance: event.target.value }))}>
                  <option value="false">No negative balance</option>
                  <option value="true">Allow negative balance</option>
                </select>

                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Longest continuous leave this policy allows.</p>
                  <input type="number" min={1} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Max consecutive days" value={policyForm.max_consecutive_days} onChange={(event) => setPolicyForm((prev) => ({ ...prev, max_consecutive_days: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Minimum months in service before eligibility.</p>
                  <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Min service months" value={policyForm.min_service_months} onChange={(event) => setPolicyForm((prev) => ({ ...prev, min_service_months: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Total days allocated per year for this leave type.</p>
                  <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Annual quota days" value={policyForm.annual_quota_days} onChange={(event) => setPolicyForm((prev) => ({ ...prev, annual_quota_days: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Maximum days allowed in a single request.</p>
                  <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Max/request days" value={policyForm.max_per_request_days} onChange={(event) => setPolicyForm((prev) => ({ ...prev, max_per_request_days: event.target.value }))} />
                </div>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={policyForm.requires_approval} onChange={(event) => setPolicyForm((prev) => ({ ...prev, requires_approval: event.target.value }))}>
                  <option value="true">Requires approval</option>
                  <option value="false">No approval</option>
                </select>
                <Textarea
                  containerClassName="md:col-span-2"
                  className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Description"
                  value={policyForm.description}
                  onChange={(event) => setPolicyForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <SheetFooter className="mt-4">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                  onClick={() => {
                    setEditingPolicyId(null)
                    setPolicySheetOpen(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white"
                  disabled={saving}
                  onClick={() => void submitPolicyForm()}
                >
                  {saving ? "Saving..." : editingPolicyId === null ? "Create Policy" : "Save Changes"}
                </button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Dialog open={policyPreviewOpen} onOpenChange={setPolicyPreviewOpen}>
            <DialogPopup from="bottom" className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedPolicyRow ? readString(selectedPolicyRow, ["name", "title"]) : "Policy details"}</DialogTitle>
                <DialogDescription>Review policy details and open it in the editor sheet if you want to update it.</DialogDescription>
              </DialogHeader>
              {selectedPolicyRow ? (
                <div className="grid gap-3 py-2 md:grid-cols-2">
                  <div className="rounded-md border border-slate-200 p-3 text-sm"><span className="text-slate-500">Status:</span> {readString(selectedPolicyRow, ["status"])}</div>
                  <div className="rounded-md border border-slate-200 p-3 text-sm"><span className="text-slate-500">Accrual:</span> {readString(selectedPolicyRow, ["accrual_method"])}</div>
                  <div className="rounded-md border border-slate-200 p-3 text-sm"><span className="text-slate-500">Department:</span> {optionLabel(departments, readNumber(selectedPolicyRow, ["applicable_department_id"]), ["name", "title"])}</div>
                  <div className="rounded-md border border-slate-200 p-3 text-sm"><span className="text-slate-500">Position:</span> {optionLabel(positions, readNumber(selectedPolicyRow, ["applicable_position_id"]), ["name", "title"])}</div>
                  <div className="rounded-md border border-slate-200 p-3 text-sm"><span className="text-slate-500">Max consecutive days:</span> {String(readNumber(selectedPolicyRow, ["max_consecutive_days"]) ?? "-")}</div>
                  <div className="rounded-md border border-slate-200 p-3 text-sm"><span className="text-slate-500">Min service months:</span> {String(readNumber(selectedPolicyRow, ["min_service_months"]) ?? "-")}</div>
                  <div className="rounded-md border border-slate-200 p-3 text-sm md:col-span-2"><span className="text-slate-500">Description:</span> {readString(selectedPolicyRow, ["description"])}</div>
                </div>
              ) : null}
              <DialogFooter>
                <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setPolicyPreviewOpen(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white"
                  onClick={() => {
                    if (selectedPolicyRow) {
                      loadPolicyIntoForm(selectedPolicyRow)
                    }
                    setPolicyPreviewOpen(false)
                  }}
                >
                  Open in Editor
                </button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}

      {tab === "workflows" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {canMutateWorkflows ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                onClick={openCreateWorkflowSheet}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Workflow
              </button>
            ) : null}
            {refreshButton}
          </div>

          <div className="space-y-2">
            <ResizableTable
              title="Leave Workflows"
              data={workflows}
              itemsPerPage={15}
              loading={loading}
              storageKey="leave-workflows"
              onRowSelect={(_, row) => {
                if (row) void openEditWorkflowSheet(row)
              }}
              columns={[
                { key: "name", label: "Name", defaultWidth: 140, sortable: true },
                { key: "status", label: "Status", defaultWidth: 80, sortable: true },
                { key: "is_default", label: "Default", defaultWidth: 70, sortable: true },
                {
                  key: "actions",
                  label: "Actions",
                  defaultWidth: 90,
                  sortable: false,
                  render: (row) => (
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="admin-table-icon-button"
                        aria-label="Edit"
                        onClick={() => void openEditWorkflowSheet(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="admin-table-icon-button"
                        aria-label="Toggle status"
                        disabled={saving}
                        onClick={() => void toggleWorkflowStatus(row)}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <Sheet open={workflowSheetOpen} onOpenChange={setWorkflowSheetOpen}>
            <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-1/2 sm:max-w-none">
              <SheetHeader>
                <SheetTitle>{editingWorkflowId === null ? "Create Leave Workflow" : "Edit Leave Workflow"}</SheetTitle>
                <SheetDescription>
                  Configure workflow details. Add approval steps using the step dialog and manage them here.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Workflow name" value={workflowForm.name} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))} />
                  <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowForm.leave_type_id} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, leave_type_id: event.target.value }))}>
                    <option value="">Select leave type</option>
                    {leaveTypeOptions.map((type) => (
                      <option key={`sheet-type-${type.value}`} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                  <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowForm.status} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                  <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowForm.is_default} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, is_default: event.target.value }))}>
                    <option value="false">Not default</option>
                    <option value="true">Default workflow</option>
                  </select>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Workflow Steps Summary ({workflowSteps.length})</p>
                    <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium" disabled={saving} onClick={openCreateStepDialog}>
                      Add Workflow Step
                    </button>
                  </div>
                  {workflowSteps.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No steps yet. Use Add Workflow Step to stage approval steps here, then save the workflow once the flow looks right.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {workflowSteps.map((row, index) => {
                        const stepId = readNumber(row, ["id", "step_id"])
                        return (
                          <div key={`sheet-step-${stepId ?? index}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                            <div className="text-sm">
                              <p className="font-medium text-slate-800">
                                Level {String(readNumber(row, ["approval_level"]) ?? "-")} · {readString(row, ["action_type"])}
                              </p>
                              <p className="text-xs text-slate-500">
                                Approver: {readString(row, ["approver_type"])} · Required: {readBoolean(row, ["is_required"]) ? "Yes" : "No"}
                              </p>
                            </div>
                            <div className="inline-flex items-center gap-2">
                              <button type="button" className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-100" onClick={() => openEditStepDialog(row)} aria-label="Edit step">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" className="rounded-md border border-rose-300 p-2 text-rose-700 hover:bg-rose-50" onClick={() => void removeWorkflowStep(row)} aria-label="Delete step">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <SheetFooter className="sm:flex-row sm:justify-end">
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setWorkflowSheetOpen(false)}>Cancel</button>
                <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white" disabled={saving} onClick={() => void submitWorkflowForm()}>
                  {editingWorkflowId === null ? "Create Workflow" : "Save Workflow"}
                </button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
            <DialogPopup from="bottom" className="sm:max-w-[900px]">
              <DialogHeader>
                <DialogTitle>{editingWorkflowStepId === null ? "Add Workflow Step" : "Edit Workflow Step"}</DialogTitle>
                <DialogDescription>Define approver, level, and assignment for this step.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Step guide</p>
                  <p>
                    1. Set the approval level order. 2. Choose what the step does. 3. Choose how the approver is assigned. 4. Optionally narrow the step by branch or department.
                  </p>
                  <p className="mt-1">{getWorkflowStepFieldHint(workflowStepForm.approver_type)}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Approval level</span>
                    <input type="number" min={1} className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" placeholder="Approval level" value={workflowStepForm.approval_level} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, approval_level: event.target.value }))} />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Step action</span>
                    <select className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" value={workflowStepForm.action_type} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, action_type: event.target.value }))}>
                      <option value="recommend">recommend</option><option value="verify">verify</option><option value="approve">approve</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Approver assignment type</span>
                    <select
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal"
                      value={workflowStepForm.approver_type}
                      onChange={(event) => {
                        const nextType = event.target.value
                        setWorkflowStepForm((prev) => ({
                          ...prev,
                          approver_type: nextType,
                          role_id: nextType === "role" ? prev.role_id : "",
                          position_id: nextType === "position" ? prev.position_id : "",
                          company_user_id: nextType === "company_user" ? prev.company_user_id : "",
                        }))
                      }}
                    >
                      <option value="role">role</option><option value="position">position</option><option value="company_user">company user</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Role</span>
                    <select disabled={workflowStepForm.approver_type !== "role"} className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal disabled:cursor-not-allowed disabled:bg-slate-100" value={workflowStepForm.role_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, role_id: event.target.value }))}>
                      <option value="">Role (optional)</option>{roles.map((row, index) => { const id = readNumber(row, ["id", "role_id"]); if (id === null) return null; return <option key={`dlg-role-${id}-${index}`} value={String(id)}>{readString(row, ["display_name", "name"])}</option> })}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Position</span>
                    <select disabled={workflowStepForm.approver_type !== "position"} className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal disabled:cursor-not-allowed disabled:bg-slate-100" value={workflowStepForm.position_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, position_id: event.target.value }))}>
                      <option value="">Position (optional)</option>{positions.map((row, index) => { const id = readNumber(row, ["id", "position_id"]); if (id === null) return null; return <option key={`dlg-pos-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option> })}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Company user</span>
                    <select disabled={workflowStepForm.approver_type !== "company_user"} className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal disabled:cursor-not-allowed disabled:bg-slate-100" value={workflowStepForm.company_user_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, company_user_id: event.target.value }))}>
                      <option value="">Company user (optional)</option>{employeeOptions.map((option) => <option key={`dlg-user-${option.value}`} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Assigned branch</span>
                    <select className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" value={workflowStepForm.assigned_branch_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, assigned_branch_id: event.target.value }))}>
                      <option value="">Assigned branch (optional)</option>{branches.map((row, index) => { const id = readNumber(row, ["id", "branch_id"]); if (id === null) return null; return <option key={`dlg-branch-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option> })}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Assigned department</span>
                    <select className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" value={workflowStepForm.assigned_department_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, assigned_department_id: event.target.value }))}>
                      <option value="">Assigned department (optional)</option>{departments.map((row, index) => { const id = readNumber(row, ["id", "department_id"]); if (id === null) return null; return <option key={`dlg-dept-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option> })}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-slate-700">
                    <span>Requirement</span>
                    <select className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal" value={workflowStepForm.is_required} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, is_required: event.target.value }))}>
                      <option value="true">Required</option><option value="false">Optional</option>
                    </select>
                  </label>
                </div>
              </div>
              <DialogFooter>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setStepDialogOpen(false)}>Cancel</button>
                <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white" disabled={saving} onClick={async () => {
                  const targetWorkflowId = selectedWorkflowId || (editingWorkflowId !== null ? String(editingWorkflowId) : "")
                  if (targetWorkflowId) {
                    setSelectedWorkflowId(targetWorkflowId)
                  }
                  await submitWorkflowStepForm(targetWorkflowId || undefined)
                }}>
                  {editingWorkflowStepId === null ? "Add Step" : "Save Step"}
                </button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

        </div>
      ) : null}

      <AlertDialog
        open={Boolean(balanceBulkDialog)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setBalanceBulkDialog(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {balanceBulkDialog === "carry-forward" ? "Carry forward leave balances" : "Generate leave balances"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {balanceBulkDialog === "carry-forward"
                ? "Move unused days from the previous year into this fiscal year for leave types that allow carry forward."
                : "Create or recalculate allocated balances for every employee in this fiscal year."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Fiscal year</p>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              inputMode="numeric"
              maxLength={4}
              placeholder="2026"
              value={balanceBulkYear}
              onChange={(event) => setBalanceBulkYear(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void submitBalanceBulkAction()}
            >
              {saving
                ? balanceBulkDialog === "carry-forward"
                  ? "Calculating..."
                  : "Generating..."
                : balanceBulkDialog === "carry-forward"
                  ? "Carry forward"
                  : "Generate"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingTypeDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTypeDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave type? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingTypeDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingTypeDelete) {
                  return
                }
                const row = pendingTypeDelete
                setPendingTypeDelete(null)
                await removeType(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingHolidayDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingHolidayDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this holiday? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingHolidayDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingHolidayDelete) {
                  return
                }
                const row = pendingHolidayDelete
                setPendingHolidayDelete(null)
                await removeHoliday(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingPolicyDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPolicyDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingPolicyDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingPolicyDelete) {
                  return
                }
                const row = pendingPolicyDelete
                setPendingPolicyDelete(null)
                await removePolicy(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingWorkflowDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingWorkflowDelete(null)
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave workflow? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingWorkflowDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingWorkflowDelete) {
                  return
                }
                const row = pendingWorkflowDelete
                setPendingWorkflowDelete(null)
                await removeWorkflow(row)
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRequestCancel)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRequestCancel(null)
            setCancelReason("Cancelled by admin")
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a reason for cancellation. This will be recorded against the request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason
            </label>
            <Textarea
              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Enter cancellation reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingRequestCancel || !cancelReason.trim()}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingRequestCancel) {
                  return
                }
                const row = pendingRequestCancel
                const reason = cancelReason
                setPendingRequestCancel(null)
                setCancelReason("Cancelled by admin")
                await cancelRequest(row, reason)
              }}
            >
              {saving ? "Cancelling..." : "Cancel Request"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
