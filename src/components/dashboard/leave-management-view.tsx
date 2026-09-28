"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useDashboardIdentity } from "@/components/dashboard/dashboard-identity"
import {
  LeaveWorkflowEditorSheet,
  type LeaveWorkflowEditorStep,
} from "@/components/dashboard/leave-workflow-editor-sheet"
import {
  LeavePolicyEditorSheet,
  emptyLeavePolicyForm,
} from "@/components/dashboard/leave-policy-editor-sheet"
import { LeavePolicyPreviewSheet } from "@/components/dashboard/leave-policy-preview-sheet"
import { LeaveTypesCatalog } from "@/components/dashboard/leave-types-catalog"
import { LeavePoliciesCatalog } from "@/components/dashboard/leave-policies-catalog"
import { LeaveWorkflowsCatalog } from "@/components/dashboard/leave-workflows-catalog"
import { LeaveWorkflowStepDialog } from "@/components/dashboard/leave-workflow-step-dialog"
import { canSeeHrLeaveRequestsQueue } from "@/lib/dashboard-home"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { LEAVE_BALANCE_IMPORT_PERMISSIONS } from "@/lib/leave-balance-import"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Info,
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
  type LeaveBalanceAdjustMode,
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
  downloadLeaveImportTemplate,
  fileToBase64UploadDto,
  getCurrentAdmin,
  getLeavePolicy,
  getLeaveRequest,
  getLeaveWorkflow,
  leaveRequestApprovalAction,
  listBranches,
  listDepartments,
  listEmployeeGrades,
  listAllEmployees,
  generateLeaveBalances,
  importLeaveRequests,
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
  type LeaveImportResult,
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
import { isMedicalLeaveRequest } from "@/lib/leave-request-kind"
import {
  leavePolicyRecordToForm,
  type LeavePolicyFormValue,
} from "@/lib/leave-policy-form"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
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
import { WorkflowChoiceCard, WorkflowSelect } from "@/components/dashboard/leave-workflow-ui"
import { MarkCheckbox } from "@/components/ui/mark-checkbox"
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
const WORKFLOW_CREATE_DRAFT_KEY = "hrms.leaveWorkflow.createDraft.v1"

type WorkflowCreateDraft = {
  form: {
    name: string
    leave_type_id: string
    status: string
    is_default: string
  }
  steps: AdminRecord[]
  stage: "details" | "path"
}

function readWorkflowCreateDraft(): WorkflowCreateDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(WORKFLOW_CREATE_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkflowCreateDraft
    if (!parsed?.form) return null
    return parsed
  } catch {
    return null
  }
}

function writeWorkflowCreateDraft(draft: WorkflowCreateDraft) {
  window.localStorage.setItem(WORKFLOW_CREATE_DRAFT_KEY, JSON.stringify(draft))
}

function clearWorkflowCreateDraft() {
  window.localStorage.removeItem(WORKFLOW_CREATE_DRAFT_KEY)
}

type LeaveTab = "types" | "requests" | "balances" | "transactions" | "holidays" | "policies" | "workflows"
type LeaveLookupKey = "types" | "employees" | "departments" | "positions" | "branches" | "roles" | "grades"
type LeaveManagementViewProps = {
  activeTab?: LeaveTab
  showTabButtons?: boolean
}

type LeaveTypeWizardStep = "details" | "rules" | "review"

const LEAVE_TYPE_WIZARD_STEPS: Array<{ key: LeaveTypeWizardStep; number: string; label: string }> = [
  { key: "details", number: "01", label: "Basic details" },
  { key: "rules", number: "02", label: "Usage rules" },
  { key: "review", number: "03", label: "Review" },
]

type LeaveRequestWizardStep = "who" | "when" | "review"

const LEAVE_REQUEST_WIZARD_STEPS: Array<{ key: LeaveRequestWizardStep; number: string; label: string }> = [
  { key: "who", number: "01", label: "Who & type" },
  { key: "when", number: "02", label: "Dates" },
  { key: "review", number: "03", label: "Review" },
]

function emptyLeaveRequestForm() {
  return {
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    submit: "true",
  }
}

function LeaveTypeField({
  label,
  help,
  className,
  children,
}: {
  label: string
  help: string
  className?: string
  children: React.ReactElement<{ id?: string }>
}) {
  const generatedId = React.useId()
  const controlId = children.props.id ?? generatedId

  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <label htmlFor={controlId}>{label}</label>
        <Popover>
          <PopoverTrigger
            className="inline-flex size-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={`${label}: ${help}`}
          >
            <Info className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-3 text-left text-xs font-normal leading-relaxed">
            {help}
          </PopoverContent>
        </Popover>
      </span>
      {React.cloneElement(children, { id: controlId })}
    </div>
  )
}

const leaveTypeControlClass =
  "mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-foreground"

function deriveLeaveTypeCode(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((part) => part && part !== "LEAVE")
    .join("_")
    .slice(0, 48)
    .replace(/_+$/, "")
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

const TRANSACTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  INITIAL_ALLOCATION: "Initial leave days assigned to an employee.",
  ACCRUAL: "Leave days earned through the configured accrual process.",
  RECALCULATION: "Balance rebuilt after a policy, holiday, or calculation change.",
  ADJUSTMENT: "Manual balance increase or decrease recorded by HR.",
  CARRY_FORWARD: "Unused days moved into a new leave year.",
  TAKEN: "Days consumed by an approved leave request.",
  RESERVED: "Days held while a leave request is pending approval.",
  RESERVATION_RELEASED: "Held days returned after a request is cancelled or rejected.",
  CANCELLED_REVERSAL: "Previously consumed days restored after cancellation.",
  EXPIRED: "Days removed because their validity period ended.",
  MANUAL_CORRECTION: "A direct correction made to resolve a balance discrepancy.",
  ATTENDANCE_DEDUCTION: "Days deducted by an attendance or absence rule.",
}

function formatTransactionType(value: string) {
  if (!value || value === "-") {
    return "-"
  }

  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const TAB_LOOKUP_REQUIREMENTS: Record<LeaveTab, LeaveLookupKey[]> = {
  types: [],
  requests: ["employees", "types"],
  balances: ["employees", "types"],
  transactions: ["employees", "types"],
  holidays: [],
  policies: ["types", "departments", "positions", "branches", "grades"],
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

function emptyBalanceForm() {
  return {
    employee_id: "",
    leave_type_id: "",
    fiscal_year: String(new Date().getFullYear()),
    mode: "SET" as LeaveBalanceAdjustMode,
    amount: "0",
    remaining: "0",
    reason: "",
  }
}

function formFromBalanceRow(row: AdminRecord) {
  const remaining = readBalanceDays(row, ["remaining_days", "remaining", "remainingDays"])
  return {
    employee_id: String(readBalanceEmployeeId(row) ?? readNumber(row, ["employee_id", "employeeId"]) ?? ""),
    leave_type_id: String(leaveTypeIdFromRow(row) ?? ""),
    fiscal_year:
      readString(row, ["fiscal_year", "fiscalYear"]) === "-"
        ? String(new Date().getFullYear())
        : readString(row, ["fiscal_year", "fiscalYear"]),
    mode: "SET" as LeaveBalanceAdjustMode,
    amount: String(remaining),
    remaining: String(remaining),
    reason: "",
  }
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
  const normalizedStatus = normalizeLeaveStatusLabel(status)
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
  const waitingLabel = isTerminal
    ? normalizedStatus === "approved"
      ? "All approvals completed"
      : normalizedStatus === "rejected"
        ? currentLevel > 0
          ? `Rejected at level ${currentLevel}`
          : "Request rejected"
        : normalizedStatus === "completed"
          ? "Leave completed"
          : normalizedStatus === "cancelled" || normalizedStatus === "canceled"
            ? "Request cancelled"
            : "Request closed"
    : pendingNames.length === 0
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

function formatLeaveRequestCardDate(value: string) {
  if (!value || value === "-") return "Not set"
  const dateOnly = value.slice(0, 10)
  const parsed = new Date(`${dateOnly}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function leaveRequestDuration(row: AdminRecord) {
  const start = readString(row, ["start_date"])
  const end = readString(row, ["end_date"])
  if (!start || !end || start === "-" || end === "-") return ""
  const startDate = new Date(`${start.slice(0, 10)}T00:00:00`)
  const endDate = new Date(`${end.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return ""
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1
  if (days < 1) return ""
  return `${days} ${days === 1 ? "day" : "days"}`
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
          const isCurrent =
            !permissions.isTerminal && permissions.currentLevel > 0 && level === permissions.currentLevel
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
  const router = useRouter()
  const actor = useDashboardActor()
  const identity = useDashboardIdentity()
  const canCreateTypes = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_types:create", "leave_types:update"],
    mode: "any",
  })
  const canDeleteTypes = canPerformPermission(actor.permissionLabels, "leave_types:delete")
  const canCreateRequests = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_requests:create", "leave_requests:update"],
    mode: "any",
  })
  const canReadTypes = canPerformPermission(actor.permissionLabels, "leave_types:read")
  const canReadRequests = canSeeHrLeaveRequestsQueue({
    homeDashboardKind: identity.homeDashboardKind,
    accessMode: actor.accessMode,
    scope: actor.scope,
    permissionLabels: actor.permissionLabels,
    roleNames: actor.roleNames,
  })
  const canReadBalances = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_balances:read", "leave-balances.view", "leave-balances.manage"],
    mode: "any",
  })
  const canAdjustBalances = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_balances:update", "leave_balances:create", "leave-balances.manage"],
    mode: "any",
  })
  const canUseBalanceBulkImport = canPerformPermission(actor.permissionLabels, {
    permissions: [
      LEAVE_BALANCE_IMPORT_PERMISSIONS.export,
      LEAVE_BALANCE_IMPORT_PERMISSIONS.bulkImport,
      LEAVE_BALANCE_IMPORT_PERMISSIONS.history,
    ],
    mode: "any",
  })
  const canReadHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:read", "attendance_holidays:read"],
    mode: "any",
  })
  const canCreateHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:create", "attendance_holidays:create"],
    mode: "any",
  })
  const canUpdateHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:update", "attendance_holidays:update"],
    mode: "any",
  })
  const canDeleteHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:delete", "attendance_holidays:delete"],
    mode: "any",
  })
  const canReadPolicies = canPerformPermission(actor.permissionLabels, "leave_policies:read")
  const canCreatePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:create"],
    mode: "any",
  })
  const canUpdatePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:update"],
    mode: "any",
  })
  const canDeletePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:delete"],
    mode: "any",
  })
  const canReadWorkflows = canPerformPermission(actor.permissionLabels, "leave_workflows:read")
  const canCreateWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:create"],
    mode: "any",
  })
  const canUpdateWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:update"],
    mode: "any",
  })
  const canDeleteWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:delete"],
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
  const [transactionSearch, setTransactionSearch] = React.useState("")
  const [transactionTypeFilter, setTransactionTypeFilter] = React.useState("all")

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
  const [grades, setGrades] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingTypeDelete, setPendingTypeDelete] = React.useState<AdminRecord | null>(null)
  const [pendingHolidayDelete, setPendingHolidayDelete] = React.useState<AdminRecord | null>(null)
  const [pendingRequestCancel, setPendingRequestCancel] = React.useState<AdminRecord | null>(null)
  const [pendingPolicyDelete, setPendingPolicyDelete] = React.useState<AdminRecord | null>(null)
  const [pendingWorkflowDelete, setPendingWorkflowDelete] = React.useState<AdminRecord | null>(null)
  const [typeDialogOpen, setTypeDialogOpen] = React.useState(false)
  const [typeDialogStep, setTypeDialogStep] = React.useState<LeaveTypeWizardStep>("details")
  const [typeCodeManuallyEdited, setTypeCodeManuallyEdited] = React.useState(false)
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)
  const [requestDialogStep, setRequestDialogStep] = React.useState<LeaveRequestWizardStep>("who")
  const [requestImportOpen, setRequestImportOpen] = React.useState(false)
  const [requestImportFile, setRequestImportFile] = React.useState<File | null>(null)
  const [requestImportResult, setRequestImportResult] = React.useState<LeaveImportResult | null>(null)
  const [requestImportBusy, setRequestImportBusy] = React.useState(false)
  const [requestTemplateBusy, setRequestTemplateBusy] = React.useState(false)
  const [balanceDialogOpen, setBalanceDialogOpen] = React.useState(false)
  const [holidayDialogOpen, setHolidayDialogOpen] = React.useState(false)
  const [holidayImportDialogOpen, setHolidayImportDialogOpen] = React.useState(false)
  const [holidayRemoveDialogOpen, setHolidayRemoveDialogOpen] = React.useState(false)
  const [policySheetOpen, setPolicySheetOpen] = React.useState(false)
  const [editingPolicyId, setEditingPolicyId] = React.useState<number | null>(null)
  const [policyPreviewOpen, setPolicyPreviewOpen] = React.useState(false)
  const [policyPreviewLoading, setPolicyPreviewLoading] = React.useState(false)
  const [policyPreviewForm, setPolicyPreviewForm] = React.useState<LeavePolicyFormValue | null>(null)
  const policyPreviewRequestRef = React.useRef(0)
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
  const [workflowStartStage, setWorkflowStartStage] = React.useState<"details" | "path">("details")
  const [workflowDraft, setWorkflowDraft] = React.useState<WorkflowCreateDraft | null>(null)
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<number | null>(null)
  const [editingWorkflowStepId, setEditingWorkflowStepId] = React.useState<number | null>(null)
  const [editingLeaveTypeRow, setEditingLeaveTypeRow] = React.useState<AdminRecord | null>(null)
  const [selectedLeaveRequestRow, setSelectedLeaveRequestRow] = React.useState<AdminRecord | null>(null)
  const [leaveRequestDetailsOpen, setLeaveRequestDetailsOpen] = React.useState(false)
  const [currentActor, setCurrentActor] = React.useState<LeaveActor | null>(null)
  const [cancelReason, setCancelReason] = React.useState("Cancelled by admin")
  const [leaveMedicalForm, setLeaveMedicalForm] = React.useState(createEmptyLeaveMedicalForm)
  const [leaveMedicalAttachmentFile, setLeaveMedicalAttachmentFile] = React.useState<File | null>(null)
  const [leaveDocumentFile, setLeaveDocumentFile] = React.useState<File | null>(null)
  const leaveMedicalAttachmentInputRef = React.useRef<HTMLInputElement>(null)
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
    grades: false,
  })

  const [typeForm, setTypeForm] = React.useState(createEmptyLeaveTypeForm)

  const [requestForm, setRequestForm] = React.useState(emptyLeaveRequestForm)

  const [balanceForm, setBalanceForm] = React.useState(emptyBalanceForm)

  const [holidayForm, setHolidayForm] = React.useState({
    name: "",
    holiday_date: "",
    is_recurring: "false",
  })

  const [policyForm, setPolicyForm] = React.useState(emptyLeavePolicyForm)

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

  const visibleLeaveTabs = React.useMemo(
    () =>
      [
        { key: "types" as LeaveTab, label: "Leave Types", visible: canReadTypes },
        { key: "requests" as LeaveTab, label: "Leave Requests", visible: canReadRequests },
        { key: "balances" as LeaveTab, label: "Leave Balances", visible: canReadBalances },
        { key: "transactions" as LeaveTab, label: "Balance Transactions", visible: canReadBalances },
        { key: "holidays" as LeaveTab, label: "Holidays", visible: canReadHolidays },
        { key: "policies" as LeaveTab, label: "Leave Policies", visible: canReadPolicies },
        { key: "workflows" as LeaveTab, label: "Leave Workflows", visible: canReadWorkflows },
      ].filter((entry) => entry.visible),
    [
      canReadBalances,
      canReadHolidays,
      canReadPolicies,
      canReadRequests,
      canReadTypes,
      canReadWorkflows,
    ],
  )

  React.useEffect(() => {
    setWorkflowDraft(readWorkflowCreateDraft())
  }, [])

  React.useEffect(() => {
    if (!actor.ready || activeTab !== "requests" || canReadRequests) {
      return
    }
    const fallback = visibleLeaveTabs.find((entry) => entry.key !== "requests")
    router.replace(fallback ? `/dashboard/leave-management/${fallback.key}` : "/dashboard/leave-management")
  }, [activeTab, actor.ready, canReadRequests, router, visibleLeaveTabs])

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
    setLeaveMedicalAttachmentFile(null)
    if (leaveMedicalAttachmentInputRef.current) {
      leaveMedicalAttachmentInputRef.current.value = ""
    }
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
          case "grades":
            return {
              key,
              result: {
                rows: await listEmployeeGrades(token),
              },
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
        case "grades":
          setGrades(entry.result.rows)
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

    const missingKeys = force ? lookupKeys : lookupKeys.filter((key) => !loadedLookupsRef.current[key])
    if (missingKeys.length === 0) {
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
          const adjustments = await listLeaveBalanceAdjustments(token, { limit: 50 }).catch(() => [])
          setBalanceAdjustments(adjustments)
          break
        }
        case "transactions": {
          const transactions = await listLeaveBalanceTransactions(token, { limit: 50 }).catch(() => [])
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
    const fallbackTab = visibleLeaveTabs[0]?.key ?? activeTab
    const nextTab = visibleLeaveTabs.some((entry) => entry.key === activeTab) ? activeTab : fallbackTab
    setTab((current) => (current === nextTab ? current : nextTab))
  }, [activeTab, visibleLeaveTabs])

  React.useEffect(() => {
    const fallbackTab = visibleLeaveTabs[0]?.key
    if (!fallbackTab) {
      return
    }
    if (!visibleLeaveTabs.some((entry) => entry.key === tab)) {
      setTab(fallbackTab)
    }
  }, [tab, visibleLeaveTabs])

  // Always refetch the active tab when it changes (or on login remount).
  // Previously we skipped after the first load via loadedTabs, so new leave
  // requests/workflows created elsewhere never appeared until a full hard refresh.
  React.useEffect(() => {
    void reloadAll(tab, false)
  }, [reloadAll, tab])

  const resetTypeForm = React.useCallback(() => {
    setTypeForm(createEmptyLeaveTypeForm())
    setEditingLeaveTypeRow(null)
    setTypeDialogStep("details")
    setTypeCodeManuallyEdited(false)
  }, [])

  const openTypeDialogForCreate = React.useCallback(() => {
    resetTypeForm()
    setTypeDialogOpen(true)
  }, [resetTypeForm])

  const openTypeDialogForEdit = React.useCallback((row: AdminRecord) => {
    setTypeDialogStep("details")
    setTypeCodeManuallyEdited(true)
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
        label: "Leave Types",
        defaultWidth: 85,
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
    setBalanceForm(emptyBalanceForm())
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

  const leaveTypeOptions = types
    .map((type) => {
      const id = readNumber(type, ["id", "leave_type_id", "leaveTypeId"])
      if (id === null) return null
      const label = readString(type, ["name", "leave_type_name", "leaveTypeName", "title", "code"])
      const yearlyMax = readDisplayValue(type, ["max_days_per_year", "maxDaysPerYear"])
      const carryMax = readDisplayValue(type, ["max_carry_forward_days", "maxCarryForwardDays"])
      return {
        value: String(id),
        label: label && label !== "-" ? label : `Leave type ${id}`,
        maxDaysPerYear: yearlyMax === "-" ? "0" : yearlyMax,
        maxCarryForwardDays: carryMax === "-" ? "0" : carryMax,
        carryForwardAllowed: readBoolean(type, ["is_carry_forward_allowed", "isCarryForwardAllowed"]),
      }
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option))

  const gradeOptions: SearchableOption[] = grades
    .map((row) => {
      const id = readNumber(row, ["id", "grade_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["name", "title", "grade_name"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const policyBranchOptions: SearchableOption[] = branches
    .map((row) => {
      const id = readNumber(row, ["id", "branch_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["name", "title"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const positionOptions: SearchableOption[] = positions
    .map((row) => {
      const id = readNumber(row, ["id", "position_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["name", "title"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const workflowRoleOptions: SearchableOption[] = roles
    .map((row) => {
      const id = readNumber(row, ["id", "role_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["display_name", "name", "title"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const workflowBranchOptions: SearchableOption[] = branches
    .map((row) => {
      const id = readNumber(row, ["id", "branch_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["name", "title"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const workflowDepartmentOptions: SearchableOption[] = departments
    .map((row) => {
      const id = readNumber(row, ["id", "department_id"])
      if (id === null) return null
      return { value: String(id), label: readString(row, ["name", "title"]) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  const workflowEditorSteps: LeaveWorkflowEditorStep[] = workflowSteps.map((row, index) => {
    const stepId = readNumber(row, ["id", "step_id"])
    const approverTypeValue = readString(row, ["approver_type"])
    const approverType = approverTypeValue === "-" ? "role" : approverTypeValue
    const approverId =
      approverType === "position"
        ? readNumber(row, ["position_id"])
        : approverType === "company_user"
          ? readNumber(row, ["company_user_id"])
          : readNumber(row, ["role_id"])
    const directApproverLabel =
      approverType === "position"
        ? readString(row, ["position_name", "approver_name"])
        : approverType === "company_user"
          ? readString(row, ["company_user_name", "approver_name", "user_name"])
          : readString(row, ["role_name", "approver_name"])
    const resolvedApproverLabel =
      approverType === "position"
        ? optionLabel(positions, approverId)
        : approverType === "company_user"
          ? employeeOptions.find((option) => option.value === String(approverId ?? ""))?.label ??
            (approverId === null ? "Approver not selected" : `User #${approverId}`)
          : optionLabel(roles, approverId, ["display_name", "name", "title"])
    const branchId = readNumber(row, ["assigned_branch_id"])
    const departmentId = readNumber(row, ["assigned_department_id"])

    return {
      key: `workflow-editor-step-${stepId ?? index}`,
      level: String(readNumber(row, ["approval_level"]) ?? "—"),
      action: readString(row, ["action_type"]) === "-" ? "recommend" : readString(row, ["action_type"]),
      approverType,
      approverLabel: directApproverLabel !== "-" ? directApproverLabel : resolvedApproverLabel,
      branchLabel: branchId === null ? "All branches" : optionLabel(branches, branchId),
      departmentLabel: departmentId === null ? "All departments" : optionLabel(departments, departmentId),
      isRequired: readBoolean(row, ["is_required"]),
    }
  })

  const workflowDraftRow: AdminRecord | null = workflowDraft
    ? {
        id: "local-draft",
        name: workflowDraft.form.name.trim() || "Untitled workflow",
        status: "draft",
        is_default: false,
        leave_type_id: workflowDraft.form.leave_type_id,
        leave_type_name:
          leaveTypeOptions.find((option) => option.value === workflowDraft.form.leave_type_id)?.label ?? "",
        _isLocalDraft: true,
      }
    : null
  const canSubmitPolicyChanges = editingPolicyId === null ? canCreatePolicies : canUpdatePolicies
  const canSubmitWorkflowChanges = editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows
  const canManageWorkflowSteps = editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows

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

  const transactionTypes = React.useMemo(
    () => Array.from(
      new Set(
        balanceTransactions
          .map((row) => readString(row, ["transaction_type", "type"]))
          .filter((value) => value && value !== "-"),
      ),
    ).sort(),
    [balanceTransactions],
  )

  const filteredBalanceTransactions = React.useMemo(() => {
    const query = transactionSearch.trim().toLowerCase()
    return balanceTransactions.filter((row) => {
      const type = readString(row, ["transaction_type", "type"])
      if (transactionTypeFilter !== "all" && type !== transactionTypeFilter) {
        return false
      }
      if (!query) return true
      return [
        employeeLabelFromRow(row),
        type,
        formatTransactionType(type),
        readString(row, ["amount_days", "days", "amount"]),
        readString(row, ["reason", "description"]),
      ].join(" ").toLowerCase().includes(query)
    })
  }, [balanceTransactions, transactionSearch, transactionTypeFilter])

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
      setRequestForm(emptyLeaveRequestForm())
      setRequestDialogStep("who")
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

  async function downloadRequestImportTemplate() {
    const token = readStoredToken()
    if (!token) return
    setRequestTemplateBusy(true)
    try {
      const result = await downloadLeaveImportTemplate(token)
      downloadBlob(result.blob, result.filename)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Template download failed.")
    } finally {
      setRequestTemplateBusy(false)
    }
  }

  async function uploadRequestImport() {
    const token = readStoredToken()
    if (!token || !requestImportFile) return
    setRequestImportBusy(true)
    setRequestImportResult(null)
    try {
      const result = await importLeaveRequests(token, requestImportFile)
      setRequestImportResult(result)
      if (result.created > 0) await reloadAll("requests", true)
      if (result.failed === 0) {
        showSuccessAlert(`${result.created} leave request${result.created === 1 ? "" : "s"} imported.`)
      }
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Leave import failed.")
    } finally {
      setRequestImportBusy(false)
    }
  }

  async function openRequestDialog() {
    const loaded = await ensureLookups(["types", "employees"])
    if (!loaded) {
      return
    }
    setRequestForm(emptyLeaveRequestForm())
    setRequestDialogStep("who")
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

    const employeeId = Number(balanceForm.employee_id)
    const leaveTypeId = Number(balanceForm.leave_type_id)
    const amount = Number(balanceForm.amount)
    const fiscalYear = balanceForm.fiscal_year.trim()
    const reason = balanceForm.reason.trim()
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      showErrorAlert("Please select an employee.")
      return
    }
    if (!Number.isFinite(leaveTypeId) || leaveTypeId <= 0) {
      showErrorAlert("Please select a leave type.")
      return
    }
    if (!/^\d{4}$/.test(fiscalYear)) {
      showErrorAlert("Enter a valid four-digit fiscal year.")
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      showErrorAlert("Enter a valid amount of 0 or more.")
      return
    }
    if (!reason) {
      showErrorAlert("A reason is required.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      await adjustLeaveBalance(token, {
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        fiscal_year: fiscalYear,
        mode: balanceForm.mode,
        amount,
        reason,
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
      amount: "0",
      remaining: "0",
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
    if (!canCreateHolidays) {
      return
    }
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
    if ((editingPolicyId === null && !canCreatePolicies) || (editingPolicyId !== null && !canUpdatePolicies)) {
      return
    }
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      showErrorAlert(message)
      return
    }

    const assignments = policyForm.leave_types.filter((row) => Number(row.leave_type_id) > 0)
    if (assignments.length === 0) {
      const message = "Add at least one leave type quota to this policy."
      setError(message)
      showErrorAlert(message)
      return
    }

    const optionalId = (value: string) => {
      const parsed = Number(value)
      return value && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
    }
    const optionalNumber = (value: string) => {
      if (!value.trim()) return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: policyForm.name.trim(),
        description: policyForm.description.trim() || undefined,
        status: policyForm.status,
        accrual_method: policyForm.accrual_method,
        accrual_rate: optionalNumber(policyForm.accrual_rate),
        priority: optionalNumber(policyForm.priority) ?? 0,
        applicable_branch_id: optionalId(policyForm.applicable_branch_id),
        applicable_department_id: optionalId(policyForm.applicable_department_id),
        applicable_position_id: optionalId(policyForm.applicable_position_id),
        applicable_grade_id: optionalId(policyForm.applicable_grade_id),
        applicable_employment_type: policyForm.applicable_employment_type || undefined,
        applicable_confirmation_status: policyForm.applicable_confirmation_status || undefined,
        max_consecutive_days: optionalNumber(policyForm.max_consecutive_days),
        min_service_months: optionalNumber(policyForm.min_service_months) ?? 0,
        allow_during_probation: policyForm.allow_during_probation === "true",
        allow_negative_balance: policyForm.allow_negative_balance === "true",
        weekly_off_treatment: policyForm.weekly_off_treatment,
        holiday_treatment: policyForm.holiday_treatment,
        allow_half_day: policyForm.allow_half_day === "true",
        allow_short_leave: policyForm.allow_short_leave === "true",
        minimum_short_leave_minutes:
          policyForm.allow_short_leave === "true" ? optionalNumber(policyForm.minimum_short_leave_minutes) : undefined,
        maximum_short_leave_minutes:
          policyForm.allow_short_leave === "true" ? optionalNumber(policyForm.maximum_short_leave_minutes) : undefined,
        minimum_notice_days: optionalNumber(policyForm.minimum_notice_days),
        maximum_backdate_days: optionalNumber(policyForm.maximum_backdate_days) ?? 0,
        cancellation_requires_approval: policyForm.cancellation_requires_approval === "true",
        cancellation_cutoff_days: optionalNumber(policyForm.cancellation_cutoff_days) ?? 0,
        maximum_accumulation_days: optionalNumber(policyForm.maximum_accumulation_days),
        attendance_balance_deduction_enabled: policyForm.attendance_balance_deduction_enabled === "true",
        absent_day_deduction_days: optionalNumber(policyForm.absent_day_deduction_days),
        unpaid_leave_day_deduction_days: optionalNumber(policyForm.unpaid_leave_day_deduction_days),
        half_day_deduction_days: optionalNumber(policyForm.half_day_deduction_days),
        leave_types: assignments.map((row) => ({
          leave_type_id: Number(row.leave_type_id),
          annual_quota_days: Number(row.annual_quota_days) || 0,
          max_per_request_days: optionalNumber(row.max_per_request_days),
          requires_approval: row.requires_approval === "true",
          encashment_enabled: row.encashment_enabled === "true",
          maximum_encashment_days: optionalNumber(row.maximum_encashment_days),
          minimum_balance_after_encashment: optionalNumber(row.minimum_balance_after_encashment),
          encashment_requires_approval: row.encashment_requires_approval === "true",
          maximum_accumulation_days: optionalNumber(row.maximum_accumulation_days),
        })),
      }
      if (editingPolicyId === null) {
        await createLeavePolicy(token, payload)
      } else {
        await patchLeavePolicy(token, editingPolicyId, payload)
      }
      setPolicyForm(emptyLeavePolicyForm())
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
    if (!canUpdatePolicies) {
      return
    }
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
    if (!canDeletePolicies) {
      return
    }
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

  async function resolvePolicyRecord(row: AdminRecord): Promise<AdminRecord> {
    const token = readStoredToken()
    const policyId = readNumber(row, ["id", "policy_id"])
    if (!token || policyId === null) {
      return row
    }
    try {
      const detailed = await getLeavePolicy(token, policyId)
      return detailed ? { ...row, ...detailed } : row
    } catch {
      return row
    }
  }

  async function loadPolicyIntoForm(row: AdminRecord) {
    if (!canUpdatePolicies) {
      return
    }
    const loaded = await ensureLookups(["types", "departments", "positions", "branches", "grades"])
    if (!loaded) {
      return
    }
    const policyId = readNumber(row, ["id", "policy_id"])
    const detailed = await resolvePolicyRecord(row)
    setPolicyForm(leavePolicyRecordToForm(detailed))
    setEditingPolicyId(policyId)
    setPolicySheetOpen(true)
  }

  function openPolicyPreview(row: AdminRecord) {
    const requestId = ++policyPreviewRequestRef.current
    setSelectedPolicyRow(row)
    setPolicyPreviewForm(leavePolicyRecordToForm(row))
    setPolicyPreviewOpen(true)
    setPolicyPreviewLoading(true)
    void (async () => {
      await ensureLookups(["types", "departments", "positions", "branches", "grades"])
      const detailed = await resolvePolicyRecord(row)
      if (policyPreviewRequestRef.current !== requestId) {
        return
      }
      setSelectedPolicyRow(detailed)
      setPolicyPreviewForm(leavePolicyRecordToForm(detailed))
      setPolicyPreviewLoading(false)
    })()
  }

  function openCreatePolicySheet() {
    if (!canCreatePolicies) {
      return
    }
    void (async () => {
      const loaded = await ensureLookups(["types", "departments", "positions", "branches", "grades"])
      if (!loaded) {
        return
      }
      setEditingPolicyId(null)
      setPolicyForm(emptyLeavePolicyForm())
      setPolicySheetOpen(true)
    })()
  }

  async function submitWorkflowForm() {
    if ((editingWorkflowId === null && !canCreateWorkflows) || (editingWorkflowId !== null && !canUpdateWorkflows)) {
      return
    }
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
      setWorkflowStartStage("details")
      clearWorkflowCreateDraft()
      setWorkflowDraft(null)
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
    if (!canCreateWorkflows) {
      return
    }
    void (async () => {
      const loaded = await ensureLookups(["types"])
      if (!loaded) {
        return
      }
      setEditingWorkflowId(null)
      setSelectedWorkflowId("")
      const draft = readWorkflowCreateDraft()
      if (draft) {
        setWorkflowForm({
          name: draft.form.name ?? "",
          leave_type_id: draft.form.leave_type_id ?? "",
          status: draft.form.status === "inactive" ? "inactive" : "active",
          is_default: draft.form.is_default === "true" ? "true" : "false",
        })
        setWorkflowSteps(Array.isArray(draft.steps) ? draft.steps : [])
        setWorkflowStartStage(draft.stage === "path" ? "path" : "details")
      } else {
        setWorkflowSteps([])
        setWorkflowForm({
          name: "",
          leave_type_id: "",
          status: "active",
          is_default: "false",
        })
        setWorkflowStartStage("details")
      }
      setWorkflowSheetOpen(true)
    })()
  }

  async function openEditWorkflowSheet(row: AdminRecord) {
    if (!canUpdateWorkflows) {
      return
    }
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
    setWorkflowStartStage("path")
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
    const workflowId = workflowIdOverride ?? selectedWorkflowId
    const canManageDraftSteps = editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows
    if ((!workflowId && !canManageDraftSteps) || (workflowId && !canUpdateWorkflows)) {
      return
    }
    const token = readStoredToken()
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
    const canManageDraftSteps = editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows
    if (!canManageDraftSteps) {
      return
    }
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
    const canManageDraftSteps = editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows
    if (!canManageDraftSteps) {
      return
    }
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
    if (!canUpdateWorkflows) {
      return
    }
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
    if (!canDeleteWorkflows) {
      return
    }
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
    const canManageDraftSteps = editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows
    if ((!selectedWorkflowId && !canManageDraftSteps) || (selectedWorkflowId && !canDeleteWorkflows)) {
      return
    }
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
      let attachmentUrl = leaveMedicalForm.attachment_url.trim()
      if (leaveMedicalAttachmentFile) {
        const file = await fileToBase64UploadDto(leaveMedicalAttachmentFile)
        const uploadedDocument = asRecord(
          await addLeaveRequestDocument(token, id, { file })
        )
        attachmentUrl = uploadedDocument ? readString(uploadedDocument, ["file_url"]) : ""
        if (!attachmentUrl) {
          throw new Error("The attachment was uploaded, but its file reference was not returned.")
        }
        setLeaveMedicalForm((current) => ({ ...current, attachment_url: attachmentUrl }))
        setLeaveMedicalAttachmentFile(null)
        if (leaveMedicalAttachmentInputRef.current) {
          leaveMedicalAttachmentInputRef.current.value = ""
        }
      }
      await patchLeaveRequestMedicalDetail(token, id, {
        sickness_nature: leaveMedicalForm.sickness_nature.trim() || undefined,
        doctor_name: leaveMedicalForm.doctor_name.trim() || undefined,
        doctor_phone: leaveMedicalForm.doctor_phone.trim() || undefined,
        hospital_name: leaveMedicalForm.hospital_name.trim() || undefined,
        treatment_start_date: leaveMedicalForm.treatment_start_date || undefined,
        treatment_end_date: leaveMedicalForm.treatment_end_date || undefined,
        attachment_url: attachmentUrl || undefined,
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
    if (!canUpdateHolidays) {
      return
    }
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
    if (!canDeleteHolidays) {
      return
    }
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

  const canContinueLeaveTypeWizard = Boolean(typeForm.name.trim() && typeForm.code.trim())
  const leaveTypeWizardIndex = LEAVE_TYPE_WIZARD_STEPS.findIndex((item) => item.key === typeDialogStep)
  const leaveRequestWizardIndex = LEAVE_REQUEST_WIZARD_STEPS.findIndex((item) => item.key === requestDialogStep)
  const canContinueRequestWho = Boolean(requestForm.employee_id && requestForm.leave_type_id)
  const canContinueRequestWhen = Boolean(
    requestForm.start_date &&
      requestForm.end_date &&
      new Date(requestForm.start_date).getTime() <= new Date(requestForm.end_date).getTime(),
  )
  const requestEmployeeLabel =
    employeeOptions.find((option) => option.value === requestForm.employee_id)?.label || "Not selected"
  const requestLeaveTypeLabel =
    leaveTypeOptions.find((option) => option.value === requestForm.leave_type_id)?.label || "Not selected"
  const formatRequestDate = (value: string) => {
    if (!value) return "Not set"
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  }
  const leaveRequestReviewItems = [
    { label: "Employee", value: requestEmployeeLabel },
    { label: "Leave type", value: requestLeaveTypeLabel },
    { label: "Start", value: formatRequestDate(requestForm.start_date) },
    { label: "End", value: formatRequestDate(requestForm.end_date) },
    { label: "Action", value: requestForm.submit === "true" ? "Submit now" : "Save as draft" },
  ]
  const leaveTypeReviewItems = [
    { label: "Leave type", value: `${typeForm.name.trim() || "Not named"} · ${typeForm.code.trim() || "No code"}` },
    { label: "Availability", value: typeForm.status === "active" ? "Active" : "Inactive" },
    { label: "Pay", value: typeForm.is_paid === "true" ? "Paid leave" : "Unpaid leave" },
    { label: "Document", value: typeForm.requires_attachment === "true" ? "Required" : "Optional" },
    {
      label: "Unused days",
      value:
        typeForm.is_carry_forward_allowed === "true"
          ? `Move to next year · up to ${Number(typeForm.max_carry_forward_days) || 0} days`
          : "Expire at year end",
    },
    {
      label: "Yearly maximum",
      value: Number(typeForm.max_days_per_year) > 0 ? `${typeForm.max_days_per_year} days` : "No limit",
    },
    {
      label: "Who can use it",
      value:
        typeForm.gender_restriction === "male"
          ? "Male employees only"
          : typeForm.gender_restriction === "female"
            ? "Female employees only"
            : "Everyone",
    },
  ]

  return (
    <div className="space-y-2">
      {showTabButtons ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleLeaveTabs.map(({ key, label }) => {
            return (
              <button
                key={key}
                type="button"
                className={
                  tab === key
                    ? "inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium !text-white"
                    : "inline-flex h-8 items-center rounded-md border border-slate-300 px-2.5 text-xs"
                }
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {tab === "types" ? (
        <LeaveTypesCatalog
          types={types}
          loading={loading}
          canEdit={canCreateTypes}
          canDelete={canDeleteTypes}
          onRefresh={() => void reloadAll(tab, true)}
          onCreate={openTypeDialogForCreate}
          onEdit={openTypeDialogForEdit}
          onDelete={(row) => setPendingTypeDelete(row)}
          onToggleStatus={(row) => void toggleTypeStatus(row)}
        />
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
              <FluentSelect
                ariaLabel="Filter leave request status"
                size="small"
                className="w-[8.5rem]"
                value={requestStatusFilter}
                onChange={setRequestStatusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "draft", label: "draft" },
                  { value: "submitted", label: "submitted" },
                  { value: "in_review", label: "in_review" },
                  { value: "approved", label: "approved" },
                  { value: "rejected", label: "rejected" },
                  { value: "cancelled", label: "cancelled" },
                  { value: "completed", label: "completed" },
                ]}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canCreateRequests ? (
                <>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold"
                    onClick={() => {
                      setRequestImportFile(null)
                      setRequestImportResult(null)
                      setRequestImportOpen(true)
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Import
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={() => void openRequestDialog()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Leave Request
                  </button>
                </>
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
                const status = readString(row, ["status"])
                const normalizedStatus = normalizeLeaveStatusLabel(status)
                const completedSuccessfully =
                  normalizedStatus === "approved" || normalizedStatus === "completed"
                const duration = leaveRequestDuration(row)
                const hasActions = permissions.canApproveOrReject || permissions.canCancel

                return (
                  <div
                    key={`leave-request-card-${rowKey}`}
                    className="overflow-hidden rounded-lg border border-border/70 bg-background"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30"
                      onClick={() => void openLeaveRequestDetails(row)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {employeeLabelFromRow(row)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {leaveRequestLabel(row)}
                        </p>
                        <p className="mt-1 truncate text-xs font-medium text-foreground/80">
                          {leaveTypeLabelFromRequest(row)}
                        </p>
                      </div>
                      <StatusIndicator status={status} />
                    </button>

                    <div className="mx-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-muted/45 px-3 py-2.5">
                      <div className="min-w-0">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Starts
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {formatLeaveRequestCardDate(readString(row, ["start_date"]))}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                        <ArrowRight className="size-3.5" />
                        {duration ? <span className="whitespace-nowrap text-[10px]">{duration}</span> : null}
                      </div>
                      <div className="min-w-0 text-right">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Ends
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {formatLeaveRequestCardDate(readString(row, ["end_date"]))}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mx-3 mt-2.5 flex w-[calc(100%_-_1.5rem)] items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-left transition-colors hover:bg-muted/30"
                      onClick={() => void openLeaveRequestDetails(row)}
                    >
                      <span
                        className={cn(
                          "inline-flex size-5 shrink-0 items-center justify-center",
                          permissions.isTerminal
                            ? completedSuccessfully
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                            : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {permissions.isTerminal ? (
                          completedSuccessfully ? (
                            <Check className="size-3.5" />
                          ) : (
                            <X className="size-3.5" />
                          )
                        ) : (
                          <Clock3 className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Approval progress
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-foreground">
                          {permissions.waitingLabel}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>

                    {hasActions ? (
                      <div className="mt-3 flex gap-2 border-t border-border/60 px-3 py-2.5">
                        {permissions.canApproveOrReject ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={saving}
                              title={permissions.reasonApprove}
                              onClick={() => void approveRequest(row, "approve")}
                            >
                              <Check className="size-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950/30"
                              disabled={saving}
                              title={permissions.reasonApprove}
                              onClick={() => void approveRequest(row, "reject")}
                            >
                              <X className="size-3.5" />
                              Reject
                            </button>
                          </>
                        ) : null}
                        {permissions.canCancel ? (
                          <button
                            type="button"
                            className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            disabled={saving}
                            title={permissions.reasonCancel}
                            onClick={() => {
                              setPendingRequestCancel(row)
                              setCancelReason("Cancelled by admin")
                            }}
                          >
                            Cancel request
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 flex w-full items-center justify-center gap-1 border-t border-border/60 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                        onClick={() => void openLeaveRequestDetails(row)}
                      >
                        View request details
                        <ChevronRight className="size-3.5" />
                      </button>
                    )}
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
                  <span className="mr-1 shrink-0 text-xs font-semibold text-foreground">
                    Leave Requests
                  </span>
                  <SearchToggleField
                    className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
                    placeholder="Search leave requests"
                    value={requestSearch}
                    onChange={setRequestSearch}
                  />
                  <FluentSelect
                    ariaLabel="Filter leave request status"
                    size="small"
                    className="w-[8.5rem]"
                    value={requestStatusFilter}
                    onChange={setRequestStatusFilter}
                    options={[
                      { value: "all", label: "All statuses" },
                      { value: "draft", label: "draft" },
                      { value: "submitted", label: "submitted" },
                      { value: "in_review", label: "in_review" },
                      { value: "approved", label: "approved" },
                      { value: "rejected", label: "rejected" },
                      { value: "cancelled", label: "cancelled" },
                      { value: "completed", label: "completed" },
                    ]}
                  />
                </>
              }
              toolbarActions={
                <>
                  {canCreateRequests ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold"
                        onClick={() => {
                          setRequestImportFile(null)
                          setRequestImportResult(null)
                          setRequestImportOpen(true)
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Import Excel
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                        onClick={() => void openRequestDialog()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Leave Request
                      </button>
                    </>
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

                  {isMedicalLeaveRequest(selectedLeaveRequestRow) ? (
                  <div className="grid gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">Medical detail</p>
                        <p className="text-[11px] text-muted-foreground">
                          Save treatment details and upload a supporting medical attachment.
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
                        <DatePickerPresets
                          value={leaveMedicalForm.treatment_start_date}
                          placeholder="Select treatment start"
                          onChange={(value) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              treatment_start_date: value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-600">Treatment end</p>
                        <DatePickerPresets
                          value={leaveMedicalForm.treatment_end_date}
                          placeholder="Select treatment end"
                          onChange={(value) =>
                            setLeaveMedicalForm((current) => ({
                              ...current,
                              treatment_end_date: value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-xs font-medium text-slate-600">Medical attachment</p>
                        <input
                          ref={leaveMedicalAttachmentInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
                          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                          onChange={(event) =>
                            setLeaveMedicalAttachmentFile(event.target.files?.[0] ?? null)
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {leaveMedicalAttachmentFile
                            ? `Ready to upload when you save: ${leaveMedicalAttachmentFile.name}`
                            : leaveMedicalForm.attachment_url
                              ? "A medical attachment is already saved. Choose another file to replace it."
                              : "Choose a PDF, image, Word, Excel, or text file (up to 10 MB)."}
                        </p>
                      </div>
                    </div>
                  </div>
                  ) : null}

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
                        {permissions.canApproveOrReject ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                              disabled={saving}
                              title={permissions.reasonApprove}
                              onClick={() => void approveRequest(selectedLeaveRequestRow, "approve")}
                            >
                              <Check className="size-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950/30 sm:flex-none"
                              disabled={saving}
                              title={permissions.reasonApprove}
                              onClick={() => void approveRequest(selectedLeaveRequestRow, "reject")}
                            >
                              <X className="size-3.5" />
                              Reject
                            </button>
                          </>
                        ) : null}
                        {permissions.canCancel ? (
                          <button
                            type="button"
                            className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 sm:flex-none"
                            disabled={saving}
                            title={permissions.reasonCancel}
                            onClick={() => {
                              setPendingRequestCancel(selectedLeaveRequestRow)
                              setCancelReason("Cancelled by admin")
                            }}
                          >
                            Cancel request
                          </button>
                        ) : null}
                      </div>
                    )
                  })()}
                </div>
              ) : null}
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}

      <Dialog
        open={requestImportOpen}
        onOpenChange={(open) => {
          if (!requestImportBusy) setRequestImportOpen(open)
        }}
      >
        <DialogPopup from="bottom" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Leave Requests</DialogTitle>
            <DialogDescription>
              Download the company template, fill one leave request per row, then upload the completed Excel file. Normal leave rules, balances, overlaps, and approvals still apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
              disabled={requestTemplateBusy}
              onClick={() => void downloadRequestImportTemplate()}
            >
              <Download className="size-4" />
              {requestTemplateBusy ? "Preparing template…" : "Download Excel template"}
            </button>
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Completed Excel file
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={requestImportBusy}
                onChange={(event) => {
                  setRequestImportFile(event.target.files?.[0] ?? null)
                  setRequestImportResult(null)
                }}
              />
            </label>
            {requestImportResult ? (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">
                  {requestImportResult.created} created · {requestImportResult.failed} failed · {requestImportResult.total} total
                </p>
                {requestImportResult.failed > 0 ? (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-rose-700">
                    {requestImportResult.results
                      .filter((row) => row.status === "failed")
                      .map((row) => (
                        <p key={`${row.row}-${row.employee_no}`}>
                          Row {row.row} ({row.employee_no || "no employee"}): {row.message || "Import failed"}
                        </p>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              disabled={requestImportBusy}
              onClick={() => setRequestImportOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:opacity-60"
              disabled={!requestImportFile || requestImportBusy}
              onClick={() => void uploadRequestImport()}
            >
              {requestImportBusy ? "Importing…" : "Import leave requests"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open)
          if (!open) {
            setRequestForm(emptyLeaveRequestForm())
            setRequestDialogStep("who")
          }
        }}
      >
        <DialogPopup
          from="bottom"
          className="grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Create leave request</DialogTitle>
            <DialogDescription>
              {requestDialogStep === "who"
                ? "Choose the employee and the leave type they are taking."
                : requestDialogStep === "when"
                  ? "Set the start and end dates for this leave."
                  : "Add a reason, then submit now or save a draft."}
            </DialogDescription>
          </DialogHeader>
          <nav className="grid grid-cols-3 gap-2" aria-label="Leave request steps">
            {LEAVE_REQUEST_WIZARD_STEPS.map((item, index) => {
              const active = item.key === requestDialogStep
              const done = leaveRequestWizardIndex > index
              const unlocked =
                item.key === "who" ||
                (item.key === "when" && canContinueRequestWho) ||
                (item.key === "review" && canContinueRequestWho && canContinueRequestWhen)
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!unlocked}
                  aria-current={active ? "step" : undefined}
                  onClick={() => unlocked && setRequestDialogStep(item.key)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "border-primary bg-primary text-white"
                      : done
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : unlocked
                          ? "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      active ? "bg-white/20" : done ? "bg-primary text-white" : "bg-slate-100",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : item.number}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
            {requestDialogStep === "who" ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Who is taking leave?</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Pick the employee and the leave type this request uses.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LeaveTypeField label="Employee" help="The person this leave request is for.">
                    <div className="mt-1">
                      <WorkflowSelect
                        value={requestForm.employee_id}
                        options={employeeOptions}
                        placeholder="Select employee"
                        onValueChange={(next) => setRequestForm((prev) => ({ ...prev, employee_id: next }))}
                      />
                    </div>
                  </LeaveTypeField>
                  <LeaveTypeField label="Leave type" help="Annual, sick, maternity, and other types already set up.">
                    <div className="mt-1">
                      <WorkflowSelect
                        value={requestForm.leave_type_id}
                        options={leaveTypeOptions}
                        placeholder="Select leave type"
                        onValueChange={(next) => setRequestForm((prev) => ({ ...prev, leave_type_id: next }))}
                      />
                    </div>
                  </LeaveTypeField>
                </div>
              </section>
            ) : null}

            {requestDialogStep === "when" ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">When is the leave?</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {requestEmployeeLabel} · {requestLeaveTypeLabel}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LeaveTypeField label="Start date" help="First day of the leave.">
                    <div className="mt-1">
                      <DatePickerPresets
                        value={requestForm.start_date}
                        onChange={(value) => setRequestForm((prev) => ({ ...prev, start_date: value }))}
                        placeholder="Start date"
                      />
                    </div>
                  </LeaveTypeField>
                  <LeaveTypeField label="End date" help="Last day of the leave.">
                    <div className="mt-1">
                      <DatePickerPresets
                        value={requestForm.end_date}
                        onChange={(value) => setRequestForm((prev) => ({ ...prev, end_date: value }))}
                        placeholder="End date"
                      />
                    </div>
                  </LeaveTypeField>
                </div>
                {requestForm.start_date &&
                requestForm.end_date &&
                new Date(requestForm.start_date).getTime() > new Date(requestForm.end_date).getTime() ? (
                  <p className="text-xs text-rose-600">Start date cannot be after end date.</p>
                ) : null}
              </section>
            ) : null}

            {requestDialogStep === "review" ? (
              <section className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {leaveRequestReviewItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-border dark:bg-muted/30"
                    >
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <LeaveTypeField label="Reason" help="Why this leave is needed. Approvers will see this.">
                  <Textarea
                    className="mt-1 min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Reason for leave"
                    value={requestForm.reason}
                    onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </LeaveTypeField>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">What should happen next?</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <WorkflowChoiceCard
                      active={requestForm.submit === "true"}
                      layoutId="leave-request-submit-choice"
                      onClick={() => setRequestForm((prev) => ({ ...prev, submit: "true" }))}
                    >
                      <span className={cn("block text-sm font-semibold", requestForm.submit === "true" ? "text-white" : "text-slate-900")}>
                        Submit now
                      </span>
                      <span className={cn("mt-0.5 block text-xs", requestForm.submit === "true" ? "text-white/80" : "text-slate-500")}>
                        Send it into the approval path.
                      </span>
                    </WorkflowChoiceCard>
                    <WorkflowChoiceCard
                      active={requestForm.submit === "false"}
                      layoutId="leave-request-submit-choice"
                      onClick={() => setRequestForm((prev) => ({ ...prev, submit: "false" }))}
                    >
                      <span className={cn("block text-sm font-semibold", requestForm.submit === "false" ? "text-white" : "text-slate-900")}>
                        Save as draft
                      </span>
                      <span className={cn("mt-0.5 block text-xs", requestForm.submit === "false" ? "text-white/80" : "text-slate-500")}>
                        Keep it until you are ready to submit.
                      </span>
                    </WorkflowChoiceCard>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 pt-3 dark:border-border">
            {requestDialogStep !== "who" ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setRequestDialogStep(requestDialogStep === "review" ? "when" : "who")}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setRequestDialogOpen(false)}
            >
              Cancel
            </button>
            {requestDialogStep === "who" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueRequestWho}
                onClick={() => setRequestDialogStep("when")}
              >
                Next: Dates
              </button>
            ) : requestDialogStep === "when" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueRequestWhen}
                onClick={() => setRequestDialogStep("review")}
              >
                Next: Review
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !requestForm.reason.trim()}
                onClick={() => void submitRequestForm()}
              >
                {saving ? "Saving..." : requestForm.submit === "true" ? "Submit request" : "Save draft"}
              </button>
            )}
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
        <DialogPopup
          from="bottom"
          className="grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>{editingLeaveTypeRow ? "Edit Leave Type" : "Create Leave Type"}</DialogTitle>
            <DialogDescription>
              {typeDialogStep === "details"
                ? "Start with the name employees will see."
                : typeDialogStep === "rules"
                  ? "Choose the simple rules for using this leave."
                  : "Check the details before saving."}
            </DialogDescription>
          </DialogHeader>
          <nav className="grid grid-cols-3 gap-2" aria-label="Leave type steps">
            {LEAVE_TYPE_WIZARD_STEPS.map((item, index) => {
              const active = item.key === typeDialogStep
              const done = leaveTypeWizardIndex > index
              const unlocked = item.key === "details" || canContinueLeaveTypeWizard
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!unlocked}
                  aria-current={active ? "step" : undefined}
                  onClick={() => unlocked && setTypeDialogStep(item.key)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "border-primary bg-primary text-white"
                      : done
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : unlocked
                          ? "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      active ? "bg-white/20" : done ? "bg-primary text-white" : "bg-slate-100",
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : item.number}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">{item.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
            {typeDialogStep === "details" ? (
              <section aria-labelledby="leave-type-basic-heading" className="space-y-3">
              <div>
                <h3 id="leave-type-basic-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
                  Basic details
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">How this leave type will appear to HR and employees.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <LeaveTypeField label="Leave name" help="The name employees will see. Example: Sick Leave.">
                  <input
                    autoFocus
                    required
                    className={leaveTypeControlClass}
                    placeholder="Example: Sick Leave"
                    value={typeForm.name}
                    onChange={(event) => {
                      const name = event.target.value
                      setTypeForm((prev) => ({
                        ...prev,
                        name,
                        ...(typeCodeManuallyEdited ? {} : { code: deriveLeaveTypeCode(name) }),
                      }))
                    }}
                  />
                </LeaveTypeField>
                <LeaveTypeField label="Short code" help="Created from the leave name for reports. You can change it.">
                  <input
                    required
                    className={leaveTypeControlClass}
                    placeholder="Example: SICK"
                    value={typeForm.code}
                    onChange={(event) => {
                      setTypeCodeManuallyEdited(true)
                      setTypeForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                    }}
                  />
                </LeaveTypeField>
                <LeaveTypeField label="Availability" help="Active means staff can use it. Inactive turns it off.">
                  <div className="mt-1">
                    <WorkflowSelect
                      value={typeForm.status}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                      ]}
                      placeholder="Choose status"
                      onValueChange={(next) => {
                        if (next) setTypeForm((prev) => ({ ...prev, status: next }))
                      }}
                    />
                  </div>
                </LeaveTypeField>
              </div>
              </section>
            ) : null}

            {typeDialogStep === "rules" ? (
              <section aria-labelledby="leave-type-rules-heading" className="space-y-3">
              <div>
                <h3 id="leave-type-rules-heading" className="text-sm font-semibold text-slate-900 dark:text-white">
                  Usage rules
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">Simple rules for pay, documents, unused days, and who can use this leave.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <MarkCheckbox
                  className="md:col-span-2"
                  checked={typeForm.is_paid === "true"}
                  onCheckedChange={(checked) => setTypeForm((prev) => ({ ...prev, is_paid: checked ? "true" : "false" }))}
                  label="Paid leave"
                  description="Employee keeps their normal salary while on this leave."
                />
                <MarkCheckbox
                  className="md:col-span-2"
                  checked={typeForm.requires_attachment === "true"}
                  onCheckedChange={(checked) =>
                    setTypeForm((prev) => ({ ...prev, requires_attachment: checked ? "true" : "false" }))
                  }
                  label="Document required"
                  description="Employee must upload proof, such as a medical note."
                />
                <MarkCheckbox
                  className="md:col-span-2"
                  checked={typeForm.is_carry_forward_allowed === "true"}
                  onCheckedChange={(checked) =>
                    setTypeForm((prev) => ({
                      ...prev,
                      is_carry_forward_allowed: checked ? "true" : "false",
                      ...(checked ? {} : { max_carry_forward_days: "0" }),
                    }))
                  }
                  label="Carry unused days"
                  description="Unused days can move into the next year instead of expiring."
                />
                {typeForm.is_carry_forward_allowed === "true" ? (
                  <LeaveTypeField label="Days that can move forward" help="The most unused days an employee can keep for next year.">
                    <input
                      type="number"
                      min={0}
                      className={leaveTypeControlClass}
                      value={typeForm.max_carry_forward_days}
                      onChange={(event) => setTypeForm((prev) => ({ ...prev, max_carry_forward_days: event.target.value }))}
                    />
                  </LeaveTypeField>
                ) : null}
                <LeaveTypeField label="Yearly maximum" help="The most days an employee can receive in one year. Enter 0 for no limit.">
                  <input
                    type="number"
                    min={0}
                    className={leaveTypeControlClass}
                    value={typeForm.max_days_per_year}
                    onChange={(event) => setTypeForm((prev) => ({ ...prev, max_days_per_year: event.target.value }))}
                  />
                </LeaveTypeField>
                <LeaveTypeField label="Who can use this leave?" help="Choose Everyone unless this leave is only for male or female staff." className={typeForm.is_carry_forward_allowed === "true" ? "md:col-span-2" : undefined}>
                  <div className="mt-1">
                    <WorkflowSelect
                      value={typeForm.gender_restriction}
                      options={[
                        { value: "any", label: "Everyone" },
                        { value: "male", label: "Male employees only" },
                        { value: "female", label: "Female employees only" },
                      ]}
                      placeholder="Choose who can use this"
                      onValueChange={(next) => {
                        if (next) setTypeForm((prev) => ({ ...prev, gender_restriction: next }))
                      }}
                    />
                  </div>
                </LeaveTypeField>
              </div>
              </section>
            ) : null}

            {typeDialogStep === "review" ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {leaveTypeReviewItems.map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-border dark:bg-muted/30">
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <LeaveTypeField label="Description" help="Explain when this leave should be used. You can leave this blank.">
                  <Textarea
                    className="mt-1 min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Optional description"
                    value={typeForm.description}
                    onChange={(event) => setTypeForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </LeaveTypeField>
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 pt-3 dark:border-border">
            {typeDialogStep !== "details" ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() => setTypeDialogStep(typeDialogStep === "review" ? "rules" : "details")}
              >
                Back
              </button>
            ) : null}
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setTypeDialogOpen(false)}>
              Cancel
            </button>
            {typeDialogStep === "details" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueLeaveTypeWizard}
                onClick={() => setTypeDialogStep("rules")}
              >
                Next: Usage rules
              </button>
            ) : typeDialogStep === "rules" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white"
                onClick={() => setTypeDialogStep("review")}
              >
                Next: Review
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !canContinueLeaveTypeWizard}
                onClick={() => void submitTypeForm()}
              >
                {saving ? "Saving..." : editingLeaveTypeRow ? "Save Leave Type" : "Add Leave Type"}
              </button>
            )}
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
                <FluentSelect
                  ariaLabel="Employee"
                  className="w-full"
                  value={balanceForm.employee_id}
                  placeholder="Select employee"
                  onChange={(value) =>
                    applyBalanceSelection({
                      employee_id: value,
                      leave_type_id: balanceForm.leave_type_id,
                      fiscal_year: balanceForm.fiscal_year,
                    })
                  }
                  options={[
                    { value: "", label: "Select employee" },
                    ...employees.flatMap((employee) => {
                      const id = readNumber(employee, ["id", "employee_id", "user_id"])
                      if (id === null) return []
                      return [{ value: String(id), label: employeeLabel(id) }]
                    }),
                  ]}
                />
              </label>
            )}
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Leave type</span>
              <FluentSelect
                ariaLabel="Leave type"
                className="w-full"
                value={balanceForm.leave_type_id}
                placeholder="Select leave type"
                onChange={(value) =>
                  applyBalanceSelection({
                    employee_id: balanceForm.employee_id,
                    leave_type_id: value,
                    fiscal_year: balanceForm.fiscal_year,
                  })
                }
                options={[
                  { value: "", label: "Select leave type" },
                  ...(returnToEmployeeBalances && selectedBalanceGroup ? selectedBalanceGroup.rows : types).flatMap((entry) => {
                    const id = leaveTypeIdFromRow(entry) ?? readNumber(entry, ["id"])
                    if (id === null) return []
                    const name = returnToEmployeeBalances ? leaveTypeLabelFromRow(entry) : readString(entry, ["name"])
                    return [{ value: String(id), label: name }]
                  }),
                ]}
              />
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
            <p className="text-xs text-slate-500">
              Current remaining:{" "}
              <span className="font-medium text-slate-900">{formatBalanceDays(Number(balanceForm.remaining) || 0)}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Mode</span>
                <FluentSelect
                  ariaLabel="Mode"
                  className="w-full"
                  value={balanceForm.mode}
                  onChange={(value) =>
                    setBalanceForm((prev) => ({ ...prev, mode: value as LeaveBalanceAdjustMode }))
                  }
                  options={[
                    { value: "SET", label: "Set remaining to" },
                    { value: "ADD", label: "Add days" },
                    { value: "DEDUCT", label: "Deduct days" },
                  ]}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Amount</span>
                <input
                  type="number"
                  min={0}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={balanceForm.amount}
                  onChange={(event) => setBalanceForm((prev) => ({ ...prev, amount: event.target.value }))}
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Reason</span>
              <Textarea
                className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Why is this balance being changed?"
                value={balanceForm.reason}
                onChange={(event) => setBalanceForm((prev) => ({ ...prev, reason: event.target.value }))}
              />
            </label>
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
            <FluentSelect
              ariaLabel="Holiday repeat"
              value={holidayForm.is_recurring}
              onChange={(value) => setHolidayForm((prev) => ({ ...prev, is_recurring: value }))}
              options={[
                { value: "false", label: "One-time" },
                { value: "true", label: "Recurring" },
              ]}
            />
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
                <FluentSelect
                  ariaLabel="Country"
                  className="w-full"
                  value={holidayImportCountry}
                  disabled={holidayImportBusy}
                  onChange={(value) => setHolidayImportCountry(value as HolidayImportCountryCode)}
                  options={HOLIDAY_IMPORT_COUNTRIES.map((entry) => ({
                    value: entry.code,
                    label: entry.label,
                  }))}
                />
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
                <FluentSelect
                  ariaLabel="Country"
                  className="w-full"
                  value={holidayRemoveCountry}
                  disabled={holidayRemoveBusy}
                  onChange={(value) => setHolidayRemoveCountry(value as HolidayImportCountryCode)}
                  options={HOLIDAY_IMPORT_COUNTRIES.map((entry) => ({
                    value: entry.code,
                    label: entry.label,
                  }))}
                />
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
            {canUseBalanceBulkImport ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground"
                onClick={() => router.push("/dashboard/leave-management/balance-import")}
              >
                <Download className="h-3.5 w-3.5" />
                Bulk import
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
            toolbarStart={
              <span className="text-xs font-semibold text-foreground">
                Balance adjustments
              </span>
            }
            data={balanceAdjustments}
            columns={[
              { key: "employee", label: "Employee", render: (r) => employeeLabelFromRow(r) },
              { key: "leave_type", label: "Leave type", render: (r) => readString(asRecord(r.leave_type) ?? {}, ["name", "code"]) || "—" },
              {
                key: "balance",
                label: "Balance",
                render: (r) => `${readString(r, ["old_balance_days"]) || "—"} → ${readString(r, ["new_balance_days"]) || "—"}`,
              },
              { key: "days", label: "Days", render: (r) => readString(r, ["adjustment_amount_days", "days", "adjustment_days", "amount"]) },
              {
                key: "source",
                label: "Source",
                render: (r) =>
                  readString(r, ["source"]) === "BULK_IMPORT"
                    ? `Bulk import · ${readString(r, ["import_batch_id"]) || "—"}`
                    : "Manual",
              },
              { key: "reason", label: "Reason", render: (r) => readString(r, ["reason", "remarks"]) },
            ]}
            itemsPerPage={10}
            loading={false}
            showExport={false}
            storageKey="leave-balance-adjustments"
          />
          ) : null}
        </div>
      ) : null}

      {tab === "transactions" ? (
        <ResizableTable
          title="Balance transactions"
          toolbarStart={
            <>
              <span className="mr-1 shrink-0 text-xs font-semibold text-foreground">
                Balance transaction history
              </span>
              <SearchToggleField
                className="min-w-0 !w-auto !max-w-[13rem] !flex-none"
                placeholder="Search transactions"
                value={transactionSearch}
                onChange={setTransactionSearch}
              />
              <FluentSelect
                ariaLabel="Filter balance transaction type"
                size="small"
                className="w-[11rem]"
                value={transactionTypeFilter}
                onChange={setTransactionTypeFilter}
                options={[
                  { value: "all", label: "All transaction types" },
                  ...transactionTypes.map((type) => ({
                    value: type,
                    label: formatTransactionType(type),
                  })),
                ]}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-primary"
                      aria-label="Transaction type descriptions"
                    />
                  }
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col items-stretch gap-0 rounded-lg border border-primary/25 bg-background p-3 text-left text-foreground shadow-xl"
                >
                  <div className="mb-2 border-b border-border pb-2 text-xs font-semibold text-primary">
                    Transaction type descriptions
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(TRANSACTION_TYPE_DESCRIPTIONS).map(([type, description]) => (
                      <div key={type} className="space-y-0.5">
                        <div className="text-xs font-bold text-primary">{formatTransactionType(type)}</div>
                        <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-bold text-primary">-</span> means no value was recorded or the field does not apply to that transaction.
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          }
          data={filteredBalanceTransactions}
          columns={[
            { key: "employee", label: "Employee", render: (r) => employeeLabelFromRow(r) },
            {
              key: "type",
              label: "Type",
              render: (r) => formatTransactionType(readString(r, ["transaction_type", "type"])),
            },
            {
              key: "days",
              label: "Days",
              render: (r) => readString(r, ["amount_days", "days", "amount"]),
            },
          ]}
          itemsPerPage={10}
          loading={loading}
          showExport={false}
          storageKey="leave-balance-transactions"
        />
      ) : null}

      {tab === "holidays" ? (
        <div className="space-y-2">
          <ResizableTable
            title="Holidays"
            toolbarActions={
              <>
                {canCreateHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
                    onClick={() => setHolidayImportDialogOpen(true)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Import
                  </button>
                ) : null}
                {canDeleteHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700"
                    onClick={() => setHolidayRemoveDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Country
                  </button>
                ) : null}
                {canCreateHolidays ? (
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
                    disabled={!canUpdateHolidays}
                    onCheckedChange={canUpdateHolidays ? () => void toggleHolidayRecurring(r) : undefined}
                    aria-label="Toggle recurring"
                    className="scale-90"
                  />
                ),
              },
              ...(canDeleteHolidays
                ? [{
                    key: "actions",
                    label: "Act",
                    defaultWidth: 45,
                    sortable: false,
                    render: (row: AdminRecord) => (
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="rounded-md border border-rose-200 p-2 text-rose-600"
                          onClick={() => setPendingHolidayDelete(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ),
                  }]
                : []),
            ]}
            itemsPerPage={20}
            loading={loading}
            storageKey="leave-holidays"
          />
        </div>
      ) : null}

      {tab === "policies" ? (
        <div className="space-y-2">
          <LeavePoliciesCatalog
            policies={policies}
            loading={loading}
            canCreate={canCreatePolicies}
            canEdit={canUpdatePolicies}
            canDelete={canDeletePolicies}
            saving={saving}
            onRefresh={() => void reloadAll(tab, true)}
            onCreate={openCreatePolicySheet}
            onOpen={openPolicyPreview}
            onEdit={(row) => void loadPolicyIntoForm(row)}
            onDelete={(row) => setPendingPolicyDelete(row)}
            onToggleStatus={(row) => void togglePolicyStatus(row)}
          />

          <LeavePolicyEditorSheet
            open={policySheetOpen}
            mode={editingPolicyId === null ? "create" : "edit"}
            value={policyForm}
            leaveTypeOptions={leaveTypeOptions}
            branchOptions={policyBranchOptions}
            departmentOptions={workflowDepartmentOptions}
            positionOptions={positionOptions}
            gradeOptions={gradeOptions}
            saving={saving}
            canSubmit={canSubmitPolicyChanges}
            onOpenChange={(open) => {
              setPolicySheetOpen(open)
              if (!open) setEditingPolicyId(null)
            }}
            onValueChange={(patch) => setPolicyForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={submitPolicyForm}
          />

          <LeavePolicyPreviewSheet
            open={policyPreviewOpen}
            loading={policyPreviewLoading}
            value={policyPreviewForm}
            leaveTypeOptions={leaveTypeOptions}
            branchOptions={policyBranchOptions}
            departmentOptions={workflowDepartmentOptions}
            positionOptions={positionOptions}
            gradeOptions={gradeOptions}
            canEdit={canUpdatePolicies}
            onOpenChange={(open) => {
              setPolicyPreviewOpen(open)
              if (!open) {
                setPolicyPreviewLoading(false)
              }
            }}
            onEdit={() => {
              if (selectedPolicyRow) {
                void loadPolicyIntoForm(selectedPolicyRow)
              }
              setPolicyPreviewOpen(false)
            }}
          />
        </div>
      ) : null}

      {tab === "workflows" ? (
        <div className="space-y-2">
            <LeaveWorkflowsCatalog
              workflows={workflows}
              draftRow={workflowDraftRow}
              loading={loading}
              canCreate={canCreateWorkflows}
              canEdit={canUpdateWorkflows}
              canDelete={canDeleteWorkflows}
              saving={saving}
              onRefresh={() => void reloadAll(tab, true)}
              onCreate={openCreateWorkflowSheet}
              onOpen={(row) => {
                if (readBoolean(row, ["_isLocalDraft"])) {
                  openCreateWorkflowSheet()
                  return
                }
                if (canUpdateWorkflows) void openEditWorkflowSheet(row)
              }}
              onEdit={(row) => {
                if (readBoolean(row, ["_isLocalDraft"])) {
                  openCreateWorkflowSheet()
                  return
                }
                void openEditWorkflowSheet(row)
              }}
              onDelete={(row) => {
                if (readBoolean(row, ["_isLocalDraft"])) {
                  clearWorkflowCreateDraft()
                  setWorkflowDraft(null)
                  return
                }
                setPendingWorkflowDelete(row)
              }}
              onToggleStatus={(row) => void toggleWorkflowStatus(row)}
              draftBanner={
                workflowDraft ? (
                  <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-950">
                        Draft: {workflowDraft.form.name.trim() || "Untitled workflow"}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800">
                        {(leaveTypeOptions.find((option) => option.value === workflowDraft.form.leave_type_id)?.label || "No leave type")}
                        {" · "}
                        {workflowDraft.steps.length} {workflowDraft.steps.length === 1 ? "step" : "steps"}
                        {" · "}
                        Continue where you left off
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-white px-2.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                        onClick={() => {
                          clearWorkflowCreateDraft()
                          setWorkflowDraft(null)
                        }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-white transition hover:brightness-95"
                        onClick={openCreateWorkflowSheet}
                      >
                        Continue draft
                      </button>
                    </div>
                  </div>
                ) : null
              }
            />

          <LeaveWorkflowEditorSheet
            open={workflowSheetOpen}
            mode={editingWorkflowId === null ? "create" : "edit"}
            value={workflowForm}
            leaveTypeOptions={leaveTypeOptions}
            steps={workflowEditorSteps}
            saving={saving}
            canSubmit={canSubmitWorkflowChanges}
            canManageSteps={canManageWorkflowSteps}
            canDeleteSteps={canDeleteWorkflows || !selectedWorkflowId}
            startStage={workflowStartStage}
            onOpenChange={setWorkflowSheetOpen}
            onValueChange={(patch) => setWorkflowForm((prev) => ({ ...prev, ...patch }))}
            onSaveDraft={(stage) => {
              const draft = {
                form: workflowForm,
                steps: workflowSteps,
                stage,
              }
              writeWorkflowCreateDraft(draft)
              setWorkflowDraft(draft)
              showSuccessAlert("Draft saved. Continue it from Leave Workflows.")
            }}
            onDiscard={() => {
              clearWorkflowCreateDraft()
              setWorkflowDraft(null)
              setWorkflowForm({
                name: "",
                leave_type_id: "",
                status: "active",
                is_default: "false",
              })
              setWorkflowSteps([])
              setWorkflowStartStage("details")
            }}
            onAddStep={openCreateStepDialog}
            onEditStep={(index) => {
              const step = workflowSteps[index]
              if (step) {
                openEditStepDialog(step)
              }
            }}
            onDeleteStep={(index) => {
              const step = workflowSteps[index]
              if (step) {
                void removeWorkflowStep(step)
              }
            }}
            onSubmit={submitWorkflowForm}
          />

          <LeaveWorkflowStepDialog
            open={stepDialogOpen}
            mode={editingWorkflowStepId === null ? "create" : "edit"}
            value={workflowStepForm}
            roleOptions={workflowRoleOptions}
            positionOptions={positionOptions}
            companyUserOptions={employeeOptions}
            branchOptions={workflowBranchOptions}
            departmentOptions={workflowDepartmentOptions}
            saving={saving}
            canSubmit={canManageWorkflowSteps}
            onOpenChange={setStepDialogOpen}
            onValueChange={(patch) => setWorkflowStepForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={async () => {
              const targetWorkflowId = selectedWorkflowId || (editingWorkflowId !== null ? String(editingWorkflowId) : "")
              if (targetWorkflowId) {
                setSelectedWorkflowId(targetWorkflowId)
              }
              await submitWorkflowStepForm(targetWorkflowId || undefined)
            }}
          />

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
