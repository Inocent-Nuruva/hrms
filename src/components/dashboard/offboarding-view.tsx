"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { Plus, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  addOffboardingDocument,
  approveOffboardingRequest,
  assignOffboardingClearance,
  cancelOffboardingRequest,
  completeOffboardingRequest,
  completeOffboardingClearance,
  completeOffboardingTask,
  createOffboardingAction,
  createOffboardingAsset,
  createOffboardingClearance,
  createOffboardingRequest,
  createOffboardingSettlement,
  createOffboardingTask,
  createEmployeeFinanceOffboardingRecoveries,
  createOffboardingWorkflow,
  createOffboardingWorkflowStep,
  deleteOffboardingDocument,
  delegateOffboardingApproval,
  emergencyOffboardingAccessTermination,
  downloadOffboardingDocument,
  extractOffboardingItemsFromRecord,
  finalizeOffboardingRequest,
  fileToBase64UploadDto,
  getCurrentEmployee,
  getOffboardingRequest,
  getOffboardingApprovals,
  getOffboardingAuditLogs,
  getOffboardingDashboard,
  getOffboardingExitInterview,
  getOffboardingProgress,
  listBranches,
  listDepartments,
  listEmployees,
  listOffboardingActions,
  listOffboardingAssets,
  listOffboardingAccessOperations,
  listMyOffboardingApprovals,
  listMyOffboardingClearances,
  listMyOffboardingRequests,
  listMyOffboardingTasks,
  listOffboardingDocuments,
  listOffboardingItemsFromOwnRequests,
  listOffboardingLetters,
  listOffboardingRequests,
  listOffboardingSettlements,
  listOffboardingWorkflows,
  reassignOffboardingTask,
  reopenOffboardingTask,
  rejectOffboardingRequest,
  retryOffboardingAccessTermination,
  submitOffboardingRequest,
  updateOffboardingAction,
  updateOffboardingAssetReturn,
  updateOffboardingDocument,
  updateOffboardingExitInterview,
  updateOffboardingSettlement,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canPerformPermission } from "@/lib/dashboard-permissions"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { asRecord, isLikelyRefreshToken, readString as readTokenString } from "@/utils/token-utils"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
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
import { Button } from "@/components/ui/button"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { FluentSelect } from "@/components/ui/fluent-select"
import { notifySubmittedRequestApprovers } from "@/lib/request-notifications"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

function readStoredToken() {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  const legacy = window.sessionStorage.getItem("ess_auth_token")?.trim() ?? ""
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  let parsedAccess = ""
  let parsedRefresh = ""
  if (!authTokensRaw) return direct || legacy
  try {
    const parsed = JSON.parse(authTokensRaw) as unknown
    if (typeof parsed === "string") {
      parsedAccess = parsed.trim()
    }
    const root = asRecord(parsed)
    const rootTokens = asRecord(root?.tokens)
    const rootData = asRecord(root?.data)
    const rootDataTokens = asRecord(rootData?.tokens)
    for (const candidate of [root, rootTokens, rootData, rootDataTokens]) {
      const access = readTokenString(candidate, ["accessToken", "access_token", "token"])
      const refresh = readTokenString(candidate, ["refreshToken", "refresh_token"])
      if (refresh && !parsedRefresh) parsedRefresh = refresh
      if (access && !isLikelyRefreshToken(access, refresh ?? parsedRefresh)) {
        parsedAccess = access
        break
      }
    }
  } catch {
    parsedAccess = authTokensRaw.trim()
  }
  return (
    parsedAccess ||
    (direct && !isLikelyRefreshToken(direct, parsedRefresh) ? direct : "") ||
    (legacy && !isLikelyRefreshToken(legacy, parsedRefresh) ? legacy : "")
  )
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return "-"
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function StatusDot({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase()
  const label =
    status.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim() || "—"
  const tone =
    ["active", "approved", "completed", "cleared", "submitted"].includes(normalized)
      ? "good"
      : ["inactive", "rejected", "cancelled", "canceled"].includes(normalized)
        ? "bad"
        : ["pending", "draft", "in_progress", "in_review"].includes(normalized)
          ? "warn"
          : "neutral"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        tone === "good" && "text-emerald-600",
        tone === "bad" && "text-rose-600",
        tone === "warn" && "text-amber-600",
        tone === "neutral" && "text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
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

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

type Tab = "requests" | "workflows" | "my-tasks" | "my-approvals" | "my-clearances"
type OffboardingLookupKey = "employees" | "branches" | "departments" | "workflows"

const OFFBOARDING_TASK_TYPE_OPTIONS = [
  "hr",
  "it",
  "finance",
  "manager",
  "security",
  "admin",
  "general",
] as const

const OFFBOARDING_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const
const OFFBOARDING_CLEARANCE_TYPE_OPTIONS = [
  "laptop",
  "id_card",
  "email",
  "system_access",
  "vehicle",
  "documents",
  "finance",
  "other",
] as const
const OFFBOARDING_ACTION_TYPE_OPTIONS = [
  "email_disable",
  "sso_revoke",
  "vpn_revoke",
  "hrms_lock",
  "device_recovery",
  "badge_deactivation",
  "payroll_stop",
  "other",
] as const
const OFFBOARDING_ACTION_STATUS_OPTIONS = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const
const OFFBOARDING_ASSET_TYPE_OPTIONS = [
  "laptop",
  "id_card",
  "sim_card",
  "keys",
  "vehicle",
  "access_card",
  "phone",
  "other",
] as const
const OFFBOARDING_ASSET_STATUS_OPTIONS = [
  "pending",
  "returned",
  "missing",
  "waived",
] as const
const OFFBOARDING_SETTLEMENT_ITEM_TYPE_OPTIONS = [
  "final_salary",
  "leave_encashment",
  "loan_recovery",
  "salary_advance_recovery",
  "gratuity",
  "severance",
  "tax_clearance",
  "other",
] as const
const OFFBOARDING_SETTLEMENT_STATUS_OPTIONS = [
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "waived",
] as const
const OFFBOARDING_EXIT_INTERVIEW_STATUS_OPTIONS = ["draft", "completed"] as const
const OFFBOARDING_KNOWLEDGE_TRANSFER_OPTIONS = [
  "not_started",
  "in_progress",
  "completed",
  "not_required",
] as const

function statusIsDraft(status: string) {
  const s = status.trim().toLowerCase()
  return s === "draft" || s === "pending_submit" || s === "new" || s === ""
}

function statusIsCancellable(status: string) {
  const s = status.trim().toLowerCase()
  return ["draft", "pending", "submitted", "in_review", "in_progress", "pending_approval"].includes(s)
}

function toTitleCaseWords(value: string) {
  const normalized = value.trim().replace(/[_-]+/g, " ")
  if (!normalized) return "—"
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatDateTimeValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "—"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

function readCompanyUserId(row: AdminRecord) {
  const direct = readNumber(row, ["company_user_id", "companyUserId", "assigned_to_company_user_id", "owner_company_user_id"])
  if (direct !== null) {
    return direct
  }
  const nestedCompanyUser = asRecord(row.company_user) ?? asRecord(row.companyUser)
  const nestedUser = asRecord(row.user)
  return (
    readNumber(nestedCompanyUser ?? {}, ["id", "company_user_id", "companyUserId"]) ??
    readNumber(nestedUser ?? {}, ["company_user_id", "companyUserId", "id"]) ??
    null
  )
}

function readBooleanLike(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") {
      return value
    }
    if (value === 1 || value === "1") {
      return true
    }
    if (value === 0 || value === "0") {
      return false
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (normalized === "true" || normalized === "yes") {
        return true
      }
      if (normalized === "false" || normalized === "no") {
        return false
      }
    }
  }
  return null
}

function isRequestFinalized(row: AdminRecord | null) {
  if (!row) {
    return false
  }
  if (readBooleanLike(row, ["is_finalized", "isFinalized"]) === true) {
    return true
  }
  return readString(row, ["finalized_at", "finalizedAt"]) !== "-"
}

export function OffboardingView() {
  const searchParams = useSearchParams()
  const highlightedRequestId = React.useMemo(
    () =>
      searchParams?.get("highlight") ??
      searchParams?.get("requestId") ??
      searchParams?.get("request_id") ??
      "",
    [searchParams]
  )
  const actor = useDashboardActor()
  const isEmployeeMode = actor.ready ? actor.accessMode === "employee" || !actor.isAdmin : false
  const canManage = actor.ready && actor.isAdmin
  const canViewWorkflows =
    actor.ready &&
    canPerformPermission(actor.permissionLabels, {
      permissions: [
        "offboarding_workflows:read",
        "offboarding_workflows:create",
        "offboarding_workflows:update",
        "offboarding_workflows:delete",
      ],
      mode: "any",
    })
  const canSelfCreate =
    actor.ready &&
    (isEmployeeMode || canPerformPermission(actor.permissionLabels, "offboarding_requests:create"))
  const canCreateRequest = canManage || canSelfCreate

  const [tab, setTab] = React.useState<Tab>("requests")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [, setBranches] = React.useState<AdminRecord[]>([])
  const [, setDepartments] = React.useState<AdminRecord[]>([])
  const [selfEmployee, setSelfEmployee] = React.useState<AdminRecord | null>(null)
  const [selfEmployeeId, setSelfEmployeeId] = React.useState<number | null>(null)

  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])
  const [myTasks, setMyTasks] = React.useState<AdminRecord[]>([])
  const [myApprovals, setMyApprovals] = React.useState<AdminRecord[]>([])
  const [myClearances, setMyClearances] = React.useState<AdminRecord[]>([])
  const [loadedTabs, setLoadedTabs] = React.useState<Partial<Record<Tab, boolean>>>({
    requests: false,
    workflows: false,
    "my-tasks": false,
    "my-approvals": false,
    "my-clearances": false,
  })
  const [loadedLookups, setLoadedLookups] = React.useState<Record<OffboardingLookupKey, boolean>>({
    employees: false,
    branches: false,
    departments: false,
    workflows: false,
  })

  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const [requestSheetOpen, setRequestSheetOpen] = React.useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState("")

  const [requestDetailsOpen, setRequestDetailsOpen] = React.useState(false)
  const [selectedRequest, setSelectedRequest] = React.useState<AdminRecord | null>(null)
  const [requestApprovals, setRequestApprovals] = React.useState<AdminRecord[]>([])
  const [requestAuditLogs, setRequestAuditLogs] = React.useState<AdminRecord[]>([])
  const [showDocumentComposer, setShowDocumentComposer] = React.useState(false)
  const [showTaskComposer, setShowTaskComposer] = React.useState(false)
  const [showClearanceComposer, setShowClearanceComposer] = React.useState(false)
  const [showActionComposer, setShowActionComposer] = React.useState(false)
  const [showAssetComposer, setShowAssetComposer] = React.useState(false)
  const [showSettlementComposer, setShowSettlementComposer] = React.useState(false)

  function autoResizeTextarea(event: React.FormEvent<HTMLTextAreaElement>) {
    const element = event.currentTarget
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }
  const [requestDocuments, setRequestDocuments] = React.useState<AdminRecord[]>([])
  const [requestProgress, setRequestProgress] = React.useState<AdminRecord | null>(null)
  const [requestActions, setRequestActions] = React.useState<AdminRecord[]>([])
  const [requestAssets, setRequestAssets] = React.useState<AdminRecord[]>([])
  const [requestLetters, setRequestLetters] = React.useState<AdminRecord[]>([])
  const [requestAccessOperations, setRequestAccessOperations] = React.useState<AdminRecord[]>([])
  const [requestSettlements, setRequestSettlements] = React.useState<AdminRecord[]>([])
  const [requestExitInterview, setRequestExitInterview] = React.useState<AdminRecord | null>(null)
  const [documentUploadFile, setDocumentUploadFile] = React.useState<File | null>(null)
  const [documentForm, setDocumentForm] = React.useState({
    title: "",
    description: "",
    document_type: "",
    expiry_date: "",
  })
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    description: "",
    task_type: "general",
    priority: "medium",
    assigned_to_company_user_id: "",
    due_date: "",
  })
  const [clearanceForm, setClearanceForm] = React.useState({
    clearance_type: "documents",
    status: "pending",
    remarks: "",
    owner_company_user_id: "",
    due_date: "",
  })
  const [actionForm, setActionForm] = React.useState({
    action_type: "email_disable",
    system_name: "",
    owner_company_user_id: "",
    status: "pending",
    due_date: "",
    notes: "",
  })
  const [assetForm, setAssetForm] = React.useState({
    asset_type: "laptop",
    asset_label: "",
    asset_identifier: "",
    owner_company_user_id: "",
    status: "pending",
    due_date: "",
    remarks: "",
  })
  const [settlementForm, setSettlementForm] = React.useState({
    item_type: "final_salary",
    title: "",
    owner_company_user_id: "",
    status: "pending",
    amount: "",
    currency: "TZS",
    due_date: "",
    remarks: "",
  })
  const [exitInterviewForm, setExitInterviewForm] = React.useState({
    status: "draft",
    exit_reason_category: "",
    employee_feedback: "",
    manager_feedback: "",
    rehire_eligible: "unknown",
    knowledge_transfer_status: "not_started",
    handover_notes: "",
    final_notes: "",
  })

  const [requestForm, setRequestForm] = React.useState({
    employee_id: "",
    branch_id: "",
    department_id: "",
    workflow_id: "",
    title: "",
    description: "",
    offboarding_type: "resignation",
    reason: "",
    notice_date: "",
    last_working_date: "",
    submit: "false",
  })

  const [workflowForm, setWorkflowForm] = React.useState({
    name: "",
    description: "",
    is_default: "false",
    status: "active",
  })

  const [stepForm, setStepForm] = React.useState({
    approval_level: "1",
    step_name: "",
    task_title: "",
    task_description: "",
    task_type: "hr",
    approver_type: "role",
    role_id: "",
    position_id: "",
    company_user_id: "",
    assigned_branch_id: "",
    assigned_department_id: "",
    action_type: "recommend",
    is_required: "true",
    expected_duration_days: "1",
  })

  const employeeCompanyUserOptions = React.useMemo(
    () =>
      employees
        .map((row) => {
          const companyUserId = readCompanyUserId(row)
          if (companyUserId === null) {
            return null
          }
          return {
            companyUserId,
            label: employeeLabel(row),
          }
        })
        .filter(
          (
            option
          ): option is {
            companyUserId: number
            label: string
          } => option !== null
        ),
    [employees]
  )

  const selectedRequestTasks = React.useMemo(() => {
    const detailTasks = extractOffboardingItemsFromRecord(selectedRequest, ["tasks"]).tasks
    const progressTasks = extractOffboardingItemsFromRecord(requestProgress, ["tasks"]).tasks
    const seen = new Set<string>()
    return [...detailTasks, ...progressTasks].filter((row, index) => {
      const key = String(readNumber(row, ["id", "task_id"]) ?? `task-${index}`)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [requestProgress, selectedRequest])

  const selectedRequestClearances = React.useMemo(() => {
    const detailClearances = extractOffboardingItemsFromRecord(selectedRequest, ["clearances"]).clearances
    const progressClearances = extractOffboardingItemsFromRecord(requestProgress, ["clearances"]).clearances
    const seen = new Set<string>()
    return [...detailClearances, ...progressClearances].filter((row, index) => {
      const key = String(readNumber(row, ["id", "clearance_id"]) ?? `clearance-${index}`)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }, [requestProgress, selectedRequest])

  const employeeLabel = (employee: AdminRecord) => {
    const fullName = readString(employee, ["full_name", "name"])
    if (fullName !== "-") return fullName
    const first = readString(employee, ["first_name"])
    const last = readString(employee, ["last_name"])
    return [first, last].filter((v) => v !== "-").join(" ") || "Unnamed"
  }

  const requestLabel = (row: AdminRecord) => {
    const explicitTitle = readString(row, ["title", "name", "request_name", "request_title"])
    if (explicitTitle !== "-") return explicitTitle
    const requestNo = readString(row, ["request_no", "offboarding_no", "code"])
    if (requestNo !== "-") return requestNo
    const id = readNumber(row, ["id"])
    return id === null ? "Unnamed request" : `Request #${id}`
  }

  const loadLookups = React.useCallback(async (token: string, lookupKeys: OffboardingLookupKey[], force = false) => {
    const missingKeys = force ? lookupKeys : lookupKeys.filter((key) => !loadedLookups[key])
    if (missingKeys.length === 0) {
      return
    }

    const results = await Promise.all(
      missingKeys.map(async (key) => {
        switch (key) {
          case "employees":
            return { key, result: await listEmployees(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "branches":
            return { key, result: await listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "departments":
            return { key, result: await listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
          case "workflows":
            return { key, result: await listOffboardingWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }) }
        }
      })
    )

    results.forEach((entry) => {
      if (!entry) return
      switch (entry.key) {
        case "employees":
          setEmployees(entry.result.rows)
          break
        case "branches":
          setBranches(entry.result.rows)
          break
        case "departments":
          setDepartments(entry.result.rows)
          break
        case "workflows":
          setWorkflows(entry.result.rows)
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

  const ensureLookups = React.useCallback(async (lookupKeys: OffboardingLookupKey[], force = false) => {
    const token = readStoredToken()
    if (!token) {
      const msg = "Authentication required. Please log in again."
      setError(msg)
      showErrorAlert(msg)
      return false
    }

    setLoading(true)
    setError(null)
    try {
      await loadLookups(token, lookupKeys, force)
      return true
    } catch (errorObject) {
      const msg = errorObject instanceof Error ? errorObject.message : "Failed to load offboarding form data."
      setError(msg)
      showErrorAlert(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [loadLookups])

  const loadSelfEmployee = React.useCallback(async (token: string) => {
    try {
      const me = await getCurrentEmployee(token)
      if (!me) return null
      setSelfEmployee(me)
      const id = readNumber(me, ["id", "employee_id", "employeeId"])
      if (id !== null) setSelfEmployeeId(id)
      return me
    } catch {
      return null
    }
  }, [])

  const reloadAll = React.useCallback(async (targetTab: Tab = tab, force = false) => {
    void force
    const token = readStoredToken()
    if (!token) {
      const msg = "Authentication required. Please log in again."
      setError(msg)
      showErrorAlert(msg)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (targetTab === "requests") {
        let employeeFilter = selfEmployeeId ?? undefined
        if (isEmployeeMode) {
          let mine: AdminRecord[] = []
          try {
            mine = await listMyOffboardingRequests(token)
          } catch {
            mine = []
          }
          if (mine.length > 0) {
            setRequests(mine)
          } else {
            if (employeeFilter == null) {
              const me = await loadSelfEmployee(token)
              employeeFilter = me
                ? readNumber(me, ["id", "employee_id", "employeeId"]) ?? undefined
                : undefined
            }
            const requestsResult = await listOffboardingRequests(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
              employee_id: employeeFilter,
            })
            setRequests(requestsResult.rows)
          }
        } else {
          const requestsResult = await listOffboardingRequests(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          })
          setRequests(requestsResult.rows)
        }
        if (canManage) {
          try {
            await getOffboardingDashboard(token)
          } catch {
            // optional
          }
        }
      } else if (targetTab === "workflows") {
        const workflowsResult = await listOffboardingWorkflows(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        setWorkflows(workflowsResult.rows)
        setLoadedLookups((current) => ({ ...current, workflows: true }))
        if (!selectedWorkflowId && workflowsResult.rows.length > 0) {
          const firstId = readNumber(workflowsResult.rows[0], ["id", "workflow_id"])
          if (firstId !== null) setSelectedWorkflowId(String(firstId))
        }
      } else if (targetTab === "my-tasks") {
        let tasks = await listMyOffboardingTasks(token)
        if (tasks.length === 0) {
          let employeeFilter = selfEmployeeId
          if (isEmployeeMode && employeeFilter == null) {
            const me = await loadSelfEmployee(token)
            employeeFilter = me ? readNumber(me, ["id", "employee_id", "employeeId"]) : null
          }
          try {
            const fallback = await listOffboardingItemsFromOwnRequests(
              token,
              "tasks",
              isEmployeeMode ? employeeFilter : null
            )
            if (fallback.length > 0) tasks = fallback
          } catch {
            // keep empty
          }
        }
        setMyTasks(tasks)
      } else if (targetTab === "my-approvals") {
        setMyApprovals(await listMyOffboardingApprovals(token))
      } else if (targetTab === "my-clearances") {
        let clearances = await listMyOffboardingClearances(token)
        if (clearances.length === 0) {
          let employeeFilter = selfEmployeeId
          if (isEmployeeMode && employeeFilter == null) {
            const me = await loadSelfEmployee(token)
            employeeFilter = me ? readNumber(me, ["id", "employee_id", "employeeId"]) : null
          }
          try {
            const fallback = await listOffboardingItemsFromOwnRequests(
              token,
              "clearances",
              isEmployeeMode ? employeeFilter : null
            )
            if (fallback.length > 0) clearances = fallback
          } catch {
            // keep empty
          }
        }
        setMyClearances(clearances)
      }
      setLoadedTabs((current) => ({ ...current, [targetTab]: true }))
    } catch (errorObject) {
      const msg = errorObject instanceof Error ? errorObject.message : "Failed to load offboarding data."
      if (/forbidden/i.test(msg)) {
        if (targetTab === "my-tasks") setMyTasks([])
        if (targetTab === "my-clearances") setMyClearances([])
        if (targetTab === "my-approvals") setMyApprovals([])
        setLoadedTabs((current) => ({ ...current, [targetTab]: true }))
        setError(null)
      } else {
        setError(msg)
        showErrorAlert(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [canManage, isEmployeeMode, loadSelfEmployee, selectedWorkflowId, selfEmployeeId, tab])

  React.useEffect(() => {
    if (actor.ready && tab === "workflows" && !canViewWorkflows) {
      setTab("requests")
    }
  }, [actor.ready, canViewWorkflows, tab])

  React.useEffect(() => {
    if (loadedTabs[tab]) return
    void reloadAll(tab)
  }, [loadedTabs, reloadAll, tab])

  function pickDefaultWorkflowId(rows: AdminRecord[]): string {
    if (!rows.length) return ""
    const active = rows.filter((row) => {
      const status = readString(row, ["status"]).toLowerCase()
      return status === "-" || status === "" || status === "active"
    })
    const pool = active.length > 0 ? active : rows
    const defaultRow =
      pool.find(
        (row) =>
          row.is_default === true ||
          String(row.is_default ?? "").toLowerCase() === "true" ||
          row.isDefault === true
      ) ?? pool[0]
    const id = readNumber(defaultRow, ["id", "workflow_id"])
    return id === null ? "" : String(id)
  }

  function workflowDisplayName(workflowId: string, rows: AdminRecord[] = workflows): string {
    if (!workflowId) return "No workflow available"
    const match = rows.find(
      (row) => String(readNumber(row, ["id", "workflow_id"]) ?? "") === workflowId
    )
    if (!match) return `Workflow #${workflowId}`
    const name = readString(match, ["name", "title"])
    return name === "-" ? `Workflow #${workflowId}` : name
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
      description: "",
      task_type: "general",
      priority: "medium",
      assigned_to_company_user_id: "",
      due_date: "",
    })
  }

  function resetClearanceForm() {
    setClearanceForm({
      clearance_type: "documents",
      status: "pending",
      remarks: "",
      owner_company_user_id: "",
      due_date: "",
    })
  }

  function resetActionForm() {
    setActionForm({
      action_type: "email_disable",
      system_name: "",
      owner_company_user_id: "",
      status: "pending",
      due_date: "",
      notes: "",
    })
  }

  function resetAssetForm() {
    setAssetForm({
      asset_type: "laptop",
      asset_label: "",
      asset_identifier: "",
      owner_company_user_id: "",
      status: "pending",
      due_date: "",
      remarks: "",
    })
  }

  function resetSettlementForm() {
    setSettlementForm({
      item_type: "final_salary",
      title: "",
      owner_company_user_id: "",
      status: "pending",
      amount: "",
      currency: "TZS",
      due_date: "",
      remarks: "",
    })
  }

  function syncExitInterviewForm(record: AdminRecord | null) {
    setExitInterviewForm({
      status: readString(record ?? {}, ["status"]) === "-" ? "draft" : readString(record ?? {}, ["status"]),
      exit_reason_category:
        readString(record ?? {}, ["exit_reason_category", "exitReasonCategory"]) === "-"
          ? ""
          : readString(record ?? {}, ["exit_reason_category", "exitReasonCategory"]),
      employee_feedback:
        readString(record ?? {}, ["employee_feedback", "employeeFeedback"]) === "-"
          ? ""
          : readString(record ?? {}, ["employee_feedback", "employeeFeedback"]),
      manager_feedback:
        readString(record ?? {}, ["manager_feedback", "managerFeedback"]) === "-"
          ? ""
          : readString(record ?? {}, ["manager_feedback", "managerFeedback"]),
      rehire_eligible: (() => {
        const value = readBooleanLike(record ?? {}, ["rehire_eligible", "rehireEligible"])
        if (value === null) {
          return "unknown"
        }
        return value ? "true" : "false"
      })(),
      knowledge_transfer_status:
        readString(record ?? {}, ["knowledge_transfer_status", "knowledgeTransferStatus"]) === "-"
          ? "not_started"
          : readString(record ?? {}, ["knowledge_transfer_status", "knowledgeTransferStatus"]),
      handover_notes:
        readString(record ?? {}, ["handover_notes", "handoverNotes"]) === "-"
          ? ""
          : readString(record ?? {}, ["handover_notes", "handoverNotes"]),
      final_notes:
        readString(record ?? {}, ["final_notes", "finalNotes"]) === "-"
          ? ""
          : readString(record ?? {}, ["final_notes", "finalNotes"]),
    })
  }

  function readCurrentRequestId() {
    return readNumber(selectedRequest ?? {}, ["id", "request_id"])
  }

  function resolveEmployeeOptionLabel(companyUserId: number | null) {
    if (companyUserId === null) {
      return "Unassigned"
    }
    const match = employeeCompanyUserOptions.find((option) => option.companyUserId === companyUserId)
    if (match) {
      return match.label
    }
    return `Company user #${companyUserId}`
  }

  async function reloadCurrentRequestActivity(requestId?: number | null) {
    const id = requestId ?? readCurrentRequestId()
    if (id === null) {
      return
    }
    await reloadAll("requests", true)
    await openRequestDetails({
      ...(selectedRequest ?? {}),
      id,
      request_id: id,
    })
  }

  async function openRequestSheet() {
    if (!canCreateRequest) return
    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    if (isEmployeeMode || !canManage) {
      const me = selfEmployee ?? (await loadSelfEmployee(token))
      const id = me ? readNumber(me, ["id", "employee_id", "employeeId"]) : null
      if (id === null) {
        showErrorAlert("Could not load your employee profile. Please try again.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const workflowsResult = await listOffboardingWorkflows(token, {
          page: 1,
          limit: 100,
          sortBy: "created_at",
          sortOrder: "DESC",
        })
        const rows = workflowsResult.rows
        setWorkflows(rows)
        setLoadedLookups((current) => ({ ...current, workflows: true }))
        const defaultWorkflowId = pickDefaultWorkflowId(rows)
        setRequestForm((prev) => ({
          ...prev,
          employee_id: String(id),
          workflow_id: defaultWorkflowId,
          offboarding_type: "resignation",
          title: prev.title || "My resignation",
          submit: "true",
        }))
        setRequestSheetOpen(true)
      } catch (errorObject) {
        const msg =
          errorObject instanceof Error ? errorObject.message : "Failed to load exit workflows."
        setError(msg)
        showErrorAlert(msg)
      } finally {
        setLoading(false)
      }
      return
    }

    const loaded = await ensureLookups(["employees", "branches", "departments", "workflows"])
    if (!loaded) return
    setRequestSheetOpen(true)
  }

  async function openWorkflowSheet() {
    if (!canManage) return
    const loaded = await ensureLookups(["workflows"])
    if (!loaded) return
    setWorkflowSheetOpen(true)
  }

  async function submitRequestForm() {
    const token = readStoredToken()
    if (!token) return false
    if (!requestForm.employee_id || !requestForm.title.trim() || !requestForm.reason.trim() || !requestForm.last_working_date) {
      showErrorAlert("Employee, title, reason and last working date are required.")
      return false
    }
    if (isEmployeeMode && selfEmployeeId != null && Number(requestForm.employee_id) !== selfEmployeeId) {
      showErrorAlert("You can only create an offboarding request for yourself.")
      return false
    }
    setSaving(true)
    try {
      const createdRequest = await createOffboardingRequest(token, {
        employee_id: Number(requestForm.employee_id),
        branch_id: requestForm.branch_id ? Number(requestForm.branch_id) : undefined,
        department_id: requestForm.department_id ? Number(requestForm.department_id) : undefined,
        workflow_id: requestForm.workflow_id ? Number(requestForm.workflow_id) : undefined,
        title: requestForm.title.trim(),
        description: requestForm.description.trim() || undefined,
        offboarding_type: requestForm.offboarding_type,
        reason: requestForm.reason.trim(),
        notice_date: requestForm.notice_date || undefined,
        last_working_date: requestForm.last_working_date,
        submit: requestForm.submit === "true",
        metadata: {},
      })
      if (requestForm.submit === "true") {
        const createdRecord = asRecord(createdRequest)
        const createdRequestId = readNumber(createdRecord ?? {}, ["id", "request_id"])
        const selectedEmployee =
          employees.find(
            (row) => readNumber(row, ["id", "employee_id", "user_id"]) === Number(requestForm.employee_id)
          ) ?? selfEmployee
        void notifySubmittedRequestApprovers({
          kind: "offboarding_request",
          token,
          request: createdRequest,
          requesterName: selectedEmployee ? employeeLabel(selectedEmployee) : undefined,
          loadRequest:
            createdRequestId === null
              ? undefined
              : () => getOffboardingRequest(token, createdRequestId),
        })
      }
      showSuccessAlert("Offboarding request created.")
      await reloadAll(tab, true)
      return true
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create offboarding request.")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function openRequestDetails(row: AdminRecord) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) return
    setSelectedRequest(row)
    setRequestDetailsOpen(true)
    setShowDocumentComposer(false)
    setShowTaskComposer(false)
    setShowClearanceComposer(false)
    setShowActionComposer(false)
    setShowAssetComposer(false)
    setShowSettlementComposer(false)
    resetDocumentForm()
    resetTaskForm()
    resetClearanceForm()
    resetActionForm()
    resetAssetForm()
    resetSettlementForm()
    void ensureLookups(["employees"])
    try {
      const [detail, approvals, audit, docs, progress, actions, assets, letters, accessOperations, settlements, exitInterview] = await Promise.all([
        getOffboardingRequest(token, id),
        getOffboardingApprovals(token, id),
        getOffboardingAuditLogs(token, id),
        listOffboardingDocuments(token, id),
        getOffboardingProgress(token, id),
        listOffboardingActions(token, id).catch(() => []),
        listOffboardingAssets(token, id).catch(() => []),
        listOffboardingLetters(token, id).catch(() => []),
        listOffboardingAccessOperations(token, id).catch(() => []),
        listOffboardingSettlements(token, id).catch(() => []),
        getOffboardingExitInterview(token, id).catch(() => null),
      ])
      if (detail) {
        setSelectedRequest({ ...row, ...detail })
      }
      setRequestApprovals(approvals)
      setRequestAuditLogs(audit)
      setRequestDocuments(docs)
      setRequestProgress(progress)
      setRequestActions(actions)
      setRequestAssets(assets)
      setRequestLetters(letters)
      setRequestAccessOperations(accessOperations)
      setRequestSettlements(settlements)
      setRequestExitInterview(exitInterview)
      syncExitInterviewForm(exitInterview)
    } catch {
      setRequestApprovals([])
      setRequestAuditLogs([])
      setRequestDocuments([])
      setRequestProgress(null)
      setRequestActions([])
      setRequestAssets([])
      setRequestLetters([])
      setRequestAccessOperations([])
      setRequestSettlements([])
      setRequestExitInterview(null)
      syncExitInterviewForm(null)
    }
  }

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
        String(readNumber(row, ["id", "request_id"]) ?? "") === highlightedRequestId
      ) ?? { id: highlightedRequestId, request_id: highlightedRequestId }

    openedHighlightedRequestRef.current = highlightedRequestId
    void openRequestDetails(highlightedRow)
  }, [highlightedRequestId, requests, tab])

  async function runRequestAction(
    row: AdminRecord,
    action: "submit" | "approve" | "reject" | "cancel" | "complete" | "finalize"
  ) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) return
    setSaving(true)
    try {
      if (action === "submit") {
        const submittedRequest = await submitOffboardingRequest(token, id, {
          workflow_id: readNumber(row, ["workflow_id"]) ?? undefined,
        })
        void notifySubmittedRequestApprovers({
          kind: "offboarding_request",
          token,
          request: submittedRequest ?? row,
          loadRequest: () => getOffboardingRequest(token, id),
        })
      }
      if (action === "approve") {
        await approveOffboardingRequest(token, id, { approve: true, comments: "Approved" })
      }
      if (action === "reject") {
        await rejectOffboardingRequest(token, id, { comments: "Rejected" })
      }
      if (action === "cancel") {
        await cancelOffboardingRequest(token, id, {
          reason: isEmployeeMode ? "Cancelled by employee" : "Cancelled by admin",
        })
      }
      if (action === "complete") await completeOffboardingRequest(token, id)
      if (action === "finalize") await finalizeOffboardingRequest(token, id)
      const pastTense =
        action === "submit"
          ? "submitted"
          : action === "approve"
            ? "approved"
            : action === "reject"
              ? "rejected"
              : action === "cancel"
                ? "cancelled"
                : action === "complete"
                  ? "completed"
                  : "finalized"
      showSuccessAlert(`Request ${pastTense} successfully.`)
      await reloadAll("requests", true)
      if (requestDetailsOpen) {
        await openRequestDetails({ ...row, id })
      }
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Action failed.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestDocument() {
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
      await addOffboardingDocument(token, requestId, {
        title: documentForm.title.trim(),
        description: documentForm.description.trim() || undefined,
        document_type: documentForm.document_type.trim() || undefined,
        expiry_date: documentForm.expiry_date || undefined,
        file,
      })
      showSuccessAlert("Offboarding document uploaded.")
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
      const result = await downloadOffboardingDocument(token, requestId, documentId)
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

  async function saveRequestDocument(documentRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const documentId = readNumber(documentRow, ["id", "document_id"])
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Missing document identifiers.")
      return
    }
    const currentTitle = readString(documentRow, ["title", "name", "file_name"])
    const nextTitle = window.prompt("Document title", currentTitle === "-" ? "" : currentTitle)
    if (nextTitle == null) return
    const currentDescription = readString(documentRow, ["description", "notes", "remarks"])
    const nextDescription = window.prompt(
      "Description",
      currentDescription === "-" ? "" : currentDescription
    )
    if (nextDescription == null) return

    setSaving(true)
    try {
      await updateOffboardingDocument(token, requestId, documentId, {
        title: nextTitle.trim() || currentTitle,
        description: nextDescription.trim() || undefined,
      })
      showSuccessAlert("Document updated.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to update document.")
    } finally {
      setSaving(false)
    }
  }

  async function removeRequestDocument(documentRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const documentId = readNumber(documentRow, ["id", "document_id"])
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Missing document identifiers.")
      return
    }
    if (typeof window !== "undefined" && !window.confirm("Delete this offboarding document?")) {
      return
    }

    setSaving(true)
    try {
      await deleteOffboardingDocument(token, requestId, documentId)
      showSuccessAlert("Document deleted.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to delete document.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestTask() {
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
      await createOffboardingTask(token, requestId, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        task_type: taskForm.task_type,
        priority: taskForm.priority,
        assigned_to_company_user_id:
          taskForm.assigned_to_company_user_id && Number(taskForm.assigned_to_company_user_id) > 0
            ? Number(taskForm.assigned_to_company_user_id)
            : undefined,
        due_date: taskForm.due_date || undefined,
      })
      showSuccessAlert("Offboarding task created.")
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
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const taskId = readNumber(taskRow, ["id", "task_id"])
    if (!token || requestId === null || taskId === null) {
      showErrorAlert("Missing task identifiers.")
      return
    }

    setSaving(true)
    try {
      await completeOffboardingTask(token, requestId, taskId, { remarks: "Completed" })
      showSuccessAlert("Task marked complete.")
      await reloadCurrentRequestActivity(requestId)
      await reloadAll("my-tasks", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to complete task.")
    } finally {
      setSaving(false)
    }
  }

  async function reopenRequestTask(taskRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const taskId = readNumber(taskRow, ["id", "task_id"])
    if (!token || requestId === null || taskId === null) {
      showErrorAlert("Missing task identifiers.")
      return
    }

    setSaving(true)
    try {
      await reopenOffboardingTask(token, requestId, taskId, { remarks: "Reopened from request detail." })
      showSuccessAlert("Task reopened.")
      await reloadCurrentRequestActivity(requestId)
      await reloadAll("my-tasks", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to reopen task.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestClearance() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }

    setSaving(true)
    try {
      await createOffboardingClearance(token, requestId, {
        clearance_type: clearanceForm.clearance_type,
        status: clearanceForm.status,
        remarks: clearanceForm.remarks.trim() || undefined,
        owner_company_user_id:
          clearanceForm.owner_company_user_id && Number(clearanceForm.owner_company_user_id) > 0
            ? Number(clearanceForm.owner_company_user_id)
            : undefined,
        due_date: clearanceForm.due_date || undefined,
      })
      showSuccessAlert("Clearance item created.")
      resetClearanceForm()
      setShowClearanceComposer(false)
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create clearance.")
    } finally {
      setSaving(false)
    }
  }

  async function completeRequestClearance(clearanceRow: AdminRecord) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const clearanceId = readNumber(clearanceRow, ["id", "clearance_id"])
    if (!token || requestId === null || clearanceId === null) {
      showErrorAlert("Missing clearance identifiers.")
      return
    }

    setSaving(true)
    try {
      await completeOffboardingClearance(token, requestId, clearanceId, {
        status: "cleared",
        remarks: "Cleared",
      })
      showSuccessAlert("Clearance marked cleared.")
      await reloadCurrentRequestActivity(requestId)
      await reloadAll("my-clearances", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to complete clearance.")
    } finally {
      setSaving(false)
    }
  }

  async function assignRequestClearance(clearanceRow: AdminRecord, ownerCompanyUserId: string) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const clearanceId = readNumber(clearanceRow, ["id", "clearance_id"])
    const ownerId = Number(ownerCompanyUserId)
    if (!token || requestId === null || clearanceId === null || !Number.isFinite(ownerId) || ownerId < 1) {
      showErrorAlert("Choose a clearance owner.")
      return
    }

    setSaving(true)
    try {
      await assignOffboardingClearance(token, requestId, clearanceId, {
        owner_company_user_id: ownerId,
      })
      showSuccessAlert("Clearance owner assigned.")
      await reloadCurrentRequestActivity(requestId)
      await reloadAll("my-clearances", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to assign clearance.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestActionItem() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }

    setSaving(true)
    try {
      await createOffboardingAction(token, requestId, {
        action_type: actionForm.action_type,
        system_name: actionForm.system_name.trim() || undefined,
        owner_company_user_id:
          actionForm.owner_company_user_id && Number(actionForm.owner_company_user_id) > 0
            ? Number(actionForm.owner_company_user_id)
            : undefined,
        status: actionForm.status,
        due_date: actionForm.due_date || undefined,
        notes: actionForm.notes.trim() || undefined,
      })
      showSuccessAlert("Offboarding action created.")
      resetActionForm()
      setShowActionComposer(false)
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create action.")
    } finally {
      setSaving(false)
    }
  }

  async function saveRequestActionStatus(actionRow: AdminRecord, status: string) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const actionId = readNumber(actionRow, ["id", "action_id"])
    if (!token || requestId === null || actionId === null || !status.trim()) {
      showErrorAlert("Missing action identifiers.")
      return
    }

    setSaving(true)
    try {
      await updateOffboardingAction(token, requestId, actionId, { status })
      showSuccessAlert("Access action updated.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to update action.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestAsset() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }
    if (!assetForm.asset_label.trim()) {
      showErrorAlert("Asset label is required.")
      return
    }

    setSaving(true)
    try {
      await createOffboardingAsset(token, requestId, {
        asset_type: assetForm.asset_type,
        asset_label: assetForm.asset_label.trim(),
        asset_identifier: assetForm.asset_identifier.trim() || undefined,
        owner_company_user_id:
          assetForm.owner_company_user_id && Number(assetForm.owner_company_user_id) > 0
            ? Number(assetForm.owner_company_user_id)
            : undefined,
        status: assetForm.status,
        due_date: assetForm.due_date || undefined,
        remarks: assetForm.remarks.trim() || undefined,
      })
      showSuccessAlert("Asset return item created.")
      resetAssetForm()
      setShowAssetComposer(false)
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create asset return item.")
    } finally {
      setSaving(false)
    }
  }

  async function saveRequestAssetStatus(assetRow: AdminRecord, status: string) {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    const assetReturnId = readNumber(assetRow, ["id", "asset_return_id"])
    if (!token || requestId === null || assetReturnId === null || !status.trim()) {
      showErrorAlert("Missing asset identifiers.")
      return
    }

    setSaving(true)
    try {
      await updateOffboardingAssetReturn(token, requestId, assetReturnId, { status })
      showSuccessAlert("Asset return updated.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to update asset return.")
    } finally {
      setSaving(false)
    }
  }

  async function submitRequestSettlement() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }
    if (!settlementForm.title.trim()) {
      showErrorAlert("Settlement title is required.")
      return
    }

    setSaving(true)
    try {
      await createOffboardingSettlement(token, requestId, {
        item_type: settlementForm.item_type,
        title: settlementForm.title.trim(),
        owner_company_user_id:
          settlementForm.owner_company_user_id && Number(settlementForm.owner_company_user_id) > 0
            ? Number(settlementForm.owner_company_user_id)
            : undefined,
        status: settlementForm.status,
        amount: settlementForm.amount.trim() || undefined,
        currency: settlementForm.currency.trim() || undefined,
        due_date: settlementForm.due_date || undefined,
        remarks: settlementForm.remarks.trim() || undefined,
      })
      showSuccessAlert("Settlement item created.")
      resetSettlementForm()
      setShowSettlementComposer(false)
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create settlement item.")
    } finally {
      setSaving(false)
    }
  }

  async function saveExitInterview() {
    const token = readStoredToken()
    const requestId = readCurrentRequestId()
    if (!token || requestId === null) {
      showErrorAlert("Missing request context.")
      return
    }

    setSaving(true)
    try {
      const updated = await updateOffboardingExitInterview(token, requestId, {
        status: exitInterviewForm.status,
        exit_reason_category: exitInterviewForm.exit_reason_category.trim() || undefined,
        employee_feedback: exitInterviewForm.employee_feedback.trim() || undefined,
        manager_feedback: exitInterviewForm.manager_feedback.trim() || undefined,
        rehire_eligible:
          exitInterviewForm.rehire_eligible === "unknown"
            ? undefined
            : exitInterviewForm.rehire_eligible === "true",
        knowledge_transfer_status: exitInterviewForm.knowledge_transfer_status,
        handover_notes: exitInterviewForm.handover_notes.trim() || undefined,
        final_notes: exitInterviewForm.final_notes.trim() || undefined,
      })
      const nextRecord = asRecord(updated) ?? requestExitInterview ?? {}
      setRequestExitInterview(nextRecord)
      syncExitInterviewForm(nextRecord)
      showSuccessAlert("Exit interview saved.")
      await reloadCurrentRequestActivity(requestId)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to save exit interview.")
    } finally {
      setSaving(false)
    }
  }

  async function completeMyTask(row: AdminRecord) {
    const token = readStoredToken()
    const requestId =
      readNumber(row, ["offboarding_request_id", "request_id", "offboardingRequestId"]) ??
      readNumber(asRecord(row.request) ?? {}, ["id"])
    const taskId = readNumber(row, ["id", "task_id"])
    if (!token || requestId === null || taskId === null) {
      showErrorAlert("Missing task identifiers.")
      return
    }
    setSaving(true)
    try {
      await completeOffboardingTask(token, requestId, taskId, { remarks: "Completed" })
      showSuccessAlert("Task marked complete.")
      await reloadAll("my-tasks", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to complete task.")
    } finally {
      setSaving(false)
    }
  }

  async function approveFromMyQueue(row: AdminRecord, approve: boolean) {
    const token = readStoredToken()
    const requestId =
      readNumber(row, ["offboarding_request_id", "request_id", "offboardingRequestId"]) ??
      readNumber(asRecord(row.request) ?? {}, ["id"]) ??
      readNumber(row, ["id"])
    if (!token || requestId === null) {
      showErrorAlert("Missing request id.")
      return
    }
    setSaving(true)
    try {
      if (approve) {
        await approveOffboardingRequest(token, requestId, { approve: true, comments: "Approved" })
      } else {
        await rejectOffboardingRequest(token, requestId, { comments: "Rejected" })
      }
      showSuccessAlert(approve ? "Request approved." : "Request rejected.")
      await reloadAll("my-approvals", true)
      await reloadAll("requests", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Approval action failed.")
    } finally {
      setSaving(false)
    }
  }

  async function submitWorkflowForm() {
    const token = readStoredToken()
    if (!token || !workflowForm.name.trim()) return
    setSaving(true)
    try {
      await createOffboardingWorkflow(token, {
        name: workflowForm.name.trim(),
        description: workflowForm.description.trim(),
        is_default: workflowForm.is_default === "true",
        status: workflowForm.status,
        steps: [],
      })
      setWorkflowSheetOpen(false)
      showSuccessAlert("Workflow created.")
      await reloadAll(tab, true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create workflow.")
    } finally {
      setSaving(false)
    }
  }

  const selectedWorkflow = React.useMemo(() => {
    if (!selectedWorkflowId) return null
    return (
      workflows.find(
        (row) => String(readNumber(row, ["id", "workflow_id"]) ?? "") === selectedWorkflowId
      ) ?? null
    )
  }, [selectedWorkflowId, workflows])

  const selectedWorkflowSteps = React.useMemo(() => {
    if (!selectedWorkflow) return [] as AdminRecord[]
    const steps = Array.isArray(selectedWorkflow.steps)
      ? (selectedWorkflow.steps as AdminRecord[])
      : []
    return [...steps].sort(
      (a, b) =>
        (readNumber(a, ["approval_level", "step_order", "order"]) ?? 0) -
        (readNumber(b, ["approval_level", "step_order", "order"]) ?? 0)
    )
  }, [selectedWorkflow])

  function openAddStepDialog() {
    if (!canManage || !selectedWorkflowId) {
      showErrorAlert("Select a workflow first.")
      return
    }
    const nextLevel = String(
      (selectedWorkflowSteps.reduce(
        (max, step) => Math.max(max, readNumber(step, ["approval_level"]) ?? 0),
        0
      ) || 0) + 1
    )
    setStepForm((prev) => ({
      ...prev,
      approval_level: nextLevel,
      step_name: "",
      task_title: "",
      task_description: "",
      task_type: "hr",
      action_type: "verify",
      is_required: "true",
      expected_duration_days: "2",
    }))
    setStepDialogOpen(true)
  }

  async function submitWorkflowStepForm() {
    const token = readStoredToken()
    if (!token || !selectedWorkflowId) return
    if (!stepForm.step_name.trim() || !stepForm.task_title.trim()) {
      showErrorAlert("Step name and task title are required.")
      return
    }
    setSaving(true)
    try {
      await createOffboardingWorkflowStep(token, selectedWorkflowId, {
        approval_level: Number(stepForm.approval_level) || 1,
        step_name: stepForm.step_name.trim(),
        task_title: stepForm.task_title.trim(),
        task_description: stepForm.task_description.trim(),
        task_type: stepForm.task_type,
        approver_type: stepForm.approver_type,
        role_id: stepForm.role_id ? Number(stepForm.role_id) : undefined,
        position_id: stepForm.position_id ? Number(stepForm.position_id) : undefined,
        company_user_id: stepForm.company_user_id ? Number(stepForm.company_user_id) : undefined,
        assigned_branch_id: stepForm.assigned_branch_id
          ? Number(stepForm.assigned_branch_id)
          : undefined,
        assigned_department_id: stepForm.assigned_department_id
          ? Number(stepForm.assigned_department_id)
          : undefined,
        action_type: stepForm.action_type,
        is_required: stepForm.is_required === "true",
        expected_duration_days: Number(stepForm.expected_duration_days) || 1,
      })
      setStepDialogOpen(false)
      showSuccessAlert("Workflow step added.")
      await reloadAll("workflows", true)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to add workflow step.")
    } finally {
      setSaving(false)
    }
  }

  const canActOnSelected =
    selectedRequest != null &&
    (canManage ||
      (isEmployeeMode &&
        selfEmployeeId != null &&
        (readNumber(selectedRequest, ["employee_id"]) === selfEmployeeId ||
          readNumber(asRecord(selectedRequest.employee) ?? {}, ["id", "employee_id"]) ===
            selfEmployeeId)))

  return (
    <section className="flex w-full min-w-0 flex-col overflow-hidden border border-border bg-background shadow-sm">
      <div className="flex flex-col gap-1 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {isEmployeeMode ? "My Offboarding" : "Offboarding"}
          </h1>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {canManage
              ? "Review exit requests, approvals, tasks, and manage workflows."
              : "Submit and track your exit request, plus any tasks or clearances assigned to you."}
          </p>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          {requests.length} {requests.length === 1 ? "request" : "requests"}
        </span>
      </div>

      <div className="inline-flex w-full flex-wrap items-center gap-1 border-b border-border bg-muted/[0.12] px-3">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={cn(
            "border-b-2 px-1.5 py-1.5 text-xs font-medium transition-colors",
            tab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {isEmployeeMode ? "My requests" : "Requests"}
        </button>
        <button
          type="button"
          onClick={() => setTab("my-approvals")}
          className={cn(
            "border-b-2 px-1.5 py-1.5 text-xs font-medium transition-colors",
            tab === "my-approvals"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My approvals
        </button>
        <button
          type="button"
          onClick={() => setTab("my-tasks")}
          className={cn(
            "border-b-2 px-1.5 py-1.5 text-xs font-medium transition-colors",
            tab === "my-tasks"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My tasks
        </button>
        <button
          type="button"
          onClick={() => setTab("my-clearances")}
          className={cn(
            "border-b-2 px-1.5 py-1.5 text-xs font-medium transition-colors",
            tab === "my-clearances"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My clearances
        </button>
        {canViewWorkflows ? (
          <button
            type="button"
            onClick={() => setTab("workflows")}
            className={cn(
              "border-b-2 px-1.5 py-1.5 text-xs font-medium transition-colors",
              tab === "workflows"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Workflows
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              {isEmployeeMode ? "Your offboarding requests" : "Offboarding requests"}
            </p>
            <div className="flex items-center gap-1.5">
              {canCreateRequest ? (
                <Button type="button" size="sm" onClick={() => void openRequestSheet()}>
                  <Plus data-icon="inline-start" />
                  {isEmployeeMode ? "Start exit request" : "Create request"}
                </Button>
              ) : null}
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm"
                onClick={() => void reloadAll("requests", true)}
                disabled={loading}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loading && requests.length === 0 ? (
            <EmptyState title="Loading…" description="Checking for offboarding requests." />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No offboarding requests"
              description={
                canManage
                  ? "There are no offboarding requests yet. Create one when an employee is leaving."
                  : canCreateRequest
                    ? "You have not started an exit request yet."
                    : "No offboarding requests available."
              }
            />
          ) : (
            <div className="min-w-0 overflow-hidden">
              <ResizableTable
                title="Offboarding Requests"
                data={requests}
                itemsPerPage={15}
                loading={loading}
                showExport={false}
                storageKey="offboarding-requests-v2"
                compact
                frameClassName="rounded-none border border-border shadow-none"
                onRowSelect={(_, row) => {
                  if (row) void openRequestDetails(row)
                }}
                columns={[
                  {
                    key: "request",
                    label: "Request",
                    defaultWidth: 160,
                    render: (row) => (
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {requestLabel(row)}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {readString(row, ["offboarding_type", "type"])}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "employee",
                    label: "Employee",
                    defaultWidth: 140,
                    render: (row) => {
                      const nested = asRecord(row.employee)
                      if (nested) return employeeLabel(nested)
                      return readString(row, ["employee_name", "employeeName", "full_name"])
                    },
                  },
                  {
                    key: "last_working_date",
                    label: "Last day",
                    defaultWidth: 100,
                    render: (row) =>
                      readString(row, ["last_working_date", "lastWorkingDate", "exit_date"]),
                  },
                  {
                    key: "status",
                    label: "Status",
                    defaultWidth: 100,
                    render: (row) => (
                      <StatusDot status={readString(row, ["status"])} />
                    ),
                  },
                  {
                    key: "updated",
                    label: "Updated",
                    defaultWidth: 120,
                    render: (row) =>
                      readString(row, ["updated_at", "updatedAt", "created_at", "createdAt"]),
                  },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}

      {canCreateRequest ? (
        <Sheet open={requestSheetOpen} onOpenChange={setRequestSheetOpen}>
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-y-auto p-0 data-[side=right]:w-full sm:data-[side=right]:w-[22rem] data-[side=right]:sm:max-w-none"
          >
            <SheetHeader className="space-y-1 border-b border-border/60 px-4 py-3 text-left">
              <SheetTitle className="text-base">
                {isEmployeeMode ? "Start your exit request" : "Create offboarding request"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {isEmployeeMode
                  ? "Tell HR you are leaving. Save a draft or submit for approval."
                  : "Capture exit details and optionally attach a workflow."}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 px-4 py-3">
              {canManage && !isEmployeeMode ? (
              <label className="grid gap-0.5 text-[11px]">
                <span className="font-medium text-muted-foreground">Employee</span>
                <FluentSelect
                  ariaLabel="Employee"
                  value={requestForm.employee_id}
                  placeholder="Select employee"
                  onChange={(value) =>
                    setRequestForm((prev) => ({ ...prev, employee_id: value }))
                  }
                  options={[
                    { value: "", label: "Select employee" },
                    ...employees.flatMap((employee) => {
                      const id = readNumber(employee, ["id", "employee_id", "user_id"])
                      if (id === null) return []
                      return [{ value: String(id), label: employeeLabel(employee) }]
                    }),
                  ]}
                />
              </label>
              ) : (
                <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-[11px]">
                  <p className="font-medium text-muted-foreground">Employee</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {selfEmployee ? employeeLabel(selfEmployee) : "You (signed-in employee)"}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-0.5 text-[11px]">
                  <span className="font-medium text-muted-foreground">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    value={requestForm.offboarding_type}
                    onChange={(value) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        offboarding_type: value,
                      }))
                    }
                    options={[
                      { value: "resignation", label: "Resignation" },
                      { value: "termination", label: "Termination" },
                      { value: "retirement", label: "Retirement" },
                      { value: "contract_end", label: "Contract end" },
                      { value: "absconded", label: "Absconded" },
                      { value: "deceased", label: "Deceased" },
                      { value: "layoff", label: "Layoff" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </label>
                <label className="grid gap-0.5 text-[11px]">
                  <span className="font-medium text-muted-foreground">Save mode</span>
                  <FluentSelect
                    ariaLabel="Save mode"
                    value={requestForm.submit}
                    onChange={(value) =>
                      setRequestForm((prev) => ({ ...prev, submit: value }))
                    }
                    options={[
                      { value: "false", label: "Save draft" },
                      { value: "true", label: "Submit now" },
                    ]}
                  />
                </label>
              </div>

              <label className="grid gap-0.5 text-[11px]">
                <span className="font-medium text-muted-foreground">Title</span>
                <input
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  placeholder="e.g. Resignation - IT Officer"
                  value={requestForm.title}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-0.5 text-[11px]">
                  <span className="font-medium text-muted-foreground">Notice date</span>
                  <DatePickerPresets
                    value={requestForm.notice_date}
                    onChange={(value) =>
                      setRequestForm((prev) => ({ ...prev, notice_date: value }))
                    }
                    placeholder="Notice date"
                    className="h-8 text-xs"
                  />
                </label>
                <label className="grid gap-0.5 text-[11px]">
                  <span className="font-medium text-muted-foreground">Last working date</span>
                  <DatePickerPresets
                    value={requestForm.last_working_date}
                    onChange={(value) =>
                      setRequestForm((prev) => ({ ...prev, last_working_date: value }))
                    }
                    placeholder="Last working date"
                    className="h-8 text-xs"
                  />
                </label>
              </div>

              {isEmployeeMode || !canManage ? (
                <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-[11px]">
                  <p className="font-medium text-muted-foreground">Workflow</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">
                    {workflowDisplayName(requestForm.workflow_id)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Assigned automatically — cannot be changed.
                  </p>
                </div>
              ) : (
                <label className="grid gap-0.5 text-[11px]">
                  <span className="font-medium text-muted-foreground">Workflow</span>
                  <FluentSelect
                    ariaLabel="Workflow"
                    value={requestForm.workflow_id}
                    placeholder="Optional"
                    onChange={(value) =>
                      setRequestForm((prev) => ({ ...prev, workflow_id: value }))
                    }
                    options={[
                      { value: "", label: "Optional" },
                      ...workflows.flatMap((row) => {
                        const id = readNumber(row, ["id", "workflow_id"])
                        if (id === null) return []
                        return [{ value: String(id), label: readString(row, ["name", "title"]) }]
                      }),
                    ]}
                  />
                </label>
              )}

              <label className="grid gap-0.5 text-[11px]">
                <span className="font-medium text-muted-foreground">Reason</span>
                <Textarea
                  className="min-h-14 rounded-md border border-input px-2 py-1.5 text-xs"
                  placeholder="Reason for leaving"
                  value={requestForm.reason}
                  onInput={autoResizeTextarea}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                />
              </label>

              <label className="grid gap-0.5 text-[11px]">
                <span className="font-medium text-muted-foreground">Description</span>
                <Textarea
                  className="min-h-12 rounded-md border border-input px-2 py-1.5 text-xs"
                  placeholder="Optional notes"
                  value={requestForm.description}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>
            </div>
            <SheetFooter className="border-t border-border/60 px-4 py-2.5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setRequestSheetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={saving}
                onClick={async () => {
                  const created = await submitRequestForm()
                  if (created) setRequestSheetOpen(false)
                }}
              >
                {saving
                  ? "Saving…"
                  : requestForm.submit === "true"
                    ? "Submit request"
                    : "Save draft"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}

      {tab === "my-approvals" ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Approvals waiting on you</p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm"
              onClick={() => void reloadAll("my-approvals", true)}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loading && myApprovals.length === 0 ? (
            <EmptyState title="Loading…" description="Loading your approval queue." />
          ) : myApprovals.length === 0 ? (
            <EmptyState
              title="No pending approvals"
              description="When someone submits an offboarding request that needs you, it will show here."
            />
          ) : (
            <div className="min-w-0 overflow-hidden">
              <ResizableTable
                title="My Offboarding Approvals"
                data={myApprovals}
                itemsPerPage={15}
                loading={loading}
                showExport={false}
                storageKey="offboarding-my-approvals-v1"
                compact
                frameClassName="rounded-none border border-border shadow-none"
                columns={[
                  {
                    key: "request",
                    label: "Request",
                    defaultWidth: 180,
                    render: (row) =>
                      readString(row, ["title", "request_title", "request_no"]) !== "-"
                        ? readString(row, ["title", "request_title", "request_no"])
                        : `Request #${readNumber(row, ["offboarding_request_id", "request_id", "id"]) ?? "—"}`,
                  },
                  {
                    key: "status",
                    label: "Status",
                    defaultWidth: 100,
                    render: (row) => (
                      <StatusDot status={readString(row, ["status", "approval_status"])} />
                    ),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    defaultWidth: 160,
                    render: (row) => (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation()
                            void approveFromMyQueue(row, true)
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation()
                            void approveFromMyQueue(row, false)
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}

      {tab === "my-tasks" ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Tasks assigned to you</p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm"
              onClick={() => void reloadAll("my-tasks", true)}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loading && myTasks.length === 0 ? (
            <EmptyState title="Loading…" description="Loading your offboarding tasks." />
          ) : myTasks.length === 0 ? (
            <EmptyState
              title="No tasks assigned"
              description="When HR assigns exit tasks to you, they will show up here."
            />
          ) : (
            <div className="min-w-0 overflow-hidden">
              <ResizableTable
                title="My Offboarding Tasks"
                data={myTasks}
                itemsPerPage={15}
                loading={loading}
                showExport={false}
                storageKey="offboarding-my-tasks-v1"
                compact
                frameClassName="rounded-none border border-border shadow-none"
                columns={[
                  {
                    key: "task",
                    label: "Task",
                    defaultWidth: 180,
                    render: (row) => readString(row, ["title", "task_title", "name", "step_name"]),
                  },
                  {
                    key: "status",
                    label: "Status",
                    defaultWidth: 100,
                    render: (row) => <StatusDot status={readString(row, ["status"])} />,
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    defaultWidth: 120,
                    render: (row) => {
                      const status = readString(row, ["status"]).toLowerCase()
                      if (status === "completed" || status === "done") return "—"
                      return (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={saving}
                          onClick={(e) => {
                            e.stopPropagation()
                            void completeMyTask(row)
                          }}
                        >
                          Complete
                        </Button>
                      )
                    },
                  },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}

      {tab === "my-clearances" ? (
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Clearances assigned to you</p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm"
              onClick={() => void reloadAll("my-clearances", true)}
              disabled={loading}
              aria-label="Refresh"
            >
              <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {loading && myClearances.length === 0 ? (
            <EmptyState title="Loading…" description="Loading your clearances." />
          ) : myClearances.length === 0 ? (
            <EmptyState
              title="No clearances assigned"
              description="Department clearances that need your sign-off will appear here."
            />
          ) : (
            <div className="min-w-0 overflow-hidden">
              <ResizableTable
                title="My Offboarding Clearances"
                data={myClearances}
                itemsPerPage={15}
                loading={loading}
                showExport={false}
                storageKey="offboarding-my-clearances-v1"
                compact
                frameClassName="rounded-none border border-border shadow-none"
                columns={[
                  {
                    key: "name",
                    label: "Clearance",
                    defaultWidth: 180,
                    render: (row) =>
                      readString(row, ["title", "name", "clearance_name", "department_name"]),
                  },
                  {
                    key: "status",
                    label: "Status",
                    defaultWidth: 100,
                    render: (row) => <StatusDot status={readString(row, ["status"])} />,
                  },
                  {
                    key: "due",
                    label: "Due",
                    defaultWidth: 100,
                    render: (row) => readString(row, ["due_date", "dueDate"]),
                  },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}

      {tab === "workflows" && canViewWorkflows ? (
        <div className="flex flex-col gap-4 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Exit workflows</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each workflow is a ordered checklist for leaving the company (HR → IT → Finance → Manager).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {canManage ? (
                <Button type="button" size="sm" onClick={() => void openWorkflowSheet()}>
                  <Plus data-icon="inline-start" />
                  New workflow
                </Button>
              ) : null}
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-sm"
                onClick={() => void reloadAll("workflows", true)}
                disabled={loading}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`size-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {loading && workflows.length === 0 ? (
            <EmptyState title="Loading…" description="Loading exit workflows." />
          ) : workflows.length === 0 ? (
            <EmptyState
              title="No exit workflows"
              description={
                canManage
                  ? "Create a workflow to define the clearance steps every departure should follow."
                  : "No exit workflows are available yet."
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
              {/* Workflow picker */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Workflows
                </p>
                <ul className="flex flex-col gap-1.5">
                  {workflows.map((row, index) => {
                    const id = readNumber(row, ["id", "workflow_id"])
                    if (id === null) return null
                    const active = selectedWorkflowId === String(id)
                    const stepCount = Array.isArray(row.steps) ? row.steps.length : 0
                    const isDefault =
                      row.is_default === true ||
                      String(row.is_default ?? "").toLowerCase() === "true"
                    return (
                      <li key={`wf-pick-${id}-${index}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedWorkflowId(String(id))}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                            active
                              ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                              : "border-border/70 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {readString(row, ["name", "title"])}
                            </p>
                            <StatusDot status={readString(row, ["status"])} />
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {stepCount} step{stepCount === 1 ? "" : "s"}
                            {isDefault ? " · Default" : ""}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Selected workflow detail */}
              <div className="min-w-0 rounded-xl border border-border/70 bg-background">
                {selectedWorkflow ? (
                  <div className="flex flex-col gap-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">
                            {readString(selectedWorkflow, ["name", "title"])}
                          </h2>
                          {(selectedWorkflow.is_default === true ||
                            String(selectedWorkflow.is_default ?? "").toLowerCase() ===
                              "true") && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Default
                            </span>
                          )}
                          <StatusDot status={readString(selectedWorkflow, ["status"])} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {readString(selectedWorkflow, ["description"]) === "-"
                            ? "No description provided."
                            : readString(selectedWorkflow, ["description"])}
                        </p>
                      </div>
                      {canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={openAddStepDialog}
                          disabled={!selectedWorkflowId}
                        >
                          <Plus data-icon="inline-start" />
                          Add step
                        </Button>
                      ) : null}
                    </div>

                    {selectedWorkflowSteps.length === 0 ? (
                      <EmptyState
                        title="No steps yet"
                        description={
                          canManage
                            ? "Add ordered steps (for example HR review, IT access revocation, finance settlement)."
                            : "This workflow has no steps configured."
                        }
                      />
                    ) : (
                      <div className="flex flex-col gap-1">
                        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Exit path ({selectedWorkflowSteps.length} steps)
                        </p>
                        <ol className="relative flex flex-col border-l border-border pl-5">
                          {selectedWorkflowSteps.map((step, index) => {
                            const level =
                              readNumber(step, ["approval_level", "step_order"]) ?? index + 1
                            const stepName = readString(step, ["step_name", "name", "title"])
                            const taskTitle = readString(step, ["task_title", "taskTitle"])
                            const taskDescription = readString(step, [
                              "task_description",
                              "taskDescription",
                              "description",
                            ])
                            const taskType = readString(step, ["task_type", "taskType"])
                            const actionType = readString(step, ["action_type", "actionType"])
                            const days = readNumber(step, [
                              "expected_duration_days",
                              "expectedDurationDays",
                            ])
                            const required =
                              step.is_required === true ||
                              String(step.is_required ?? "").toLowerCase() === "true"
                            const isLast = index === selectedWorkflowSteps.length - 1

                            return (
                              <li
                                key={`wf-step-${readNumber(step, ["id"]) ?? index}`}
                                className={cn("relative pb-5", isLast && "pb-0")}
                              >
                                <span className="absolute top-1 -left-[1.55rem] flex size-6 items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold text-foreground shadow-sm">
                                  {level}
                                </span>
                                <div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-foreground">
                                        {stepName === "-" ? `Step ${level}` : stepName}
                                      </p>
                                      {taskTitle !== "-" ? (
                                        <p className="mt-0.5 text-xs text-foreground/90">
                                          {taskTitle}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {taskType !== "-" ? (
                                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                                          {taskType.replace(/[_-]+/g, " ")}
                                        </span>
                                      ) : null}
                                      {actionType !== "-" ? (
                                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                                          {actionType.replace(/[_-]+/g, " ")}
                                        </span>
                                      ) : null}
                                      {required ? (
                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                          Required
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                          Optional
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {taskDescription !== "-" ? (
                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                      {taskDescription}
                                    </p>
                                  ) : null}
                                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                    {days !== null ? (
                                      <span>~{days} day{days === 1 ? "" : "s"}</span>
                                    ) : null}
                                    {readString(step, ["approver_type"]) !== "-" ? (
                                      <span>
                                        Assigned by{" "}
                                        {readString(step, ["approver_type"]).replace(/[_-]+/g, " ")}
                                        {readNumber(step, ["role_id"])
                                          ? ` · role #${readNumber(step, ["role_id"])}`
                                          : ""}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {!isLast ? (
                                  <p className="mt-2 pl-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                                    then
                                  </p>
                                ) : (
                                  <p className="mt-2 pl-1 text-[10px] font-medium tracking-wide text-emerald-600 uppercase">
                                    exit complete
                                  </p>
                                )}
                              </li>
                            )
                          })}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a workflow"
                    description="Choose a workflow on the left to inspect its exit path."
                  />
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {canManage ? (
        <Sheet open={workflowSheetOpen} onOpenChange={setWorkflowSheetOpen}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-[26rem] data-[side=right]:sm:max-w-none"
          >
            <SheetHeader>
              <SheetTitle>New exit workflow</SheetTitle>
              <SheetDescription>
                Create the workflow shell first, then add ordered clearance steps.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 grid gap-3 px-4 pb-4">
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Name</span>
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="e.g. Standard employee exit"
                  value={workflowForm.name}
                  onChange={(event) =>
                    setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Description</span>
                <Textarea
                  className="min-h-20 rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="What this exit path covers"
                  value={workflowForm.description}
                  onChange={(event) =>
                    setWorkflowForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Status</span>
                  <FluentSelect
                    ariaLabel="Status"
                    value={workflowForm.status}
                    onChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, status: value }))
                    }
                    options={[
                      { value: "active", label: "Active" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Default</span>
                  <FluentSelect
                    ariaLabel="Default"
                    value={workflowForm.is_default}
                    onChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, is_default: value }))
                    }
                    options={[
                      { value: "false", label: "No" },
                      { value: "true", label: "Yes" },
                    ]}
                  />
                </label>
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setWorkflowSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void submitWorkflowForm()}>
                {saving ? "Saving…" : "Create workflow"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : null}

      {canManage ? (
        <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
          <DialogPopup from="bottom" className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add workflow step</DialogTitle>
              <DialogDescription>
                Steps run in order by level (1, then 2, then 3…).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Level</span>
                  <input
                    type="number"
                    min={1}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={stepForm.approval_level}
                    onChange={(event) =>
                      setStepForm((prev) => ({ ...prev, approval_level: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Duration (days)</span>
                  <input
                    type="number"
                    min={1}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={stepForm.expected_duration_days}
                    onChange={(event) =>
                      setStepForm((prev) => ({
                        ...prev,
                        expected_duration_days: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Step name</span>
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="e.g. IT access revocation"
                  value={stepForm.step_name}
                  onChange={(event) =>
                    setStepForm((prev) => ({ ...prev, step_name: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Task title</span>
                <input
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="What the assignee must do"
                  value={stepForm.task_title}
                  onChange={(event) =>
                    setStepForm((prev) => ({ ...prev, task_title: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Task description</span>
                <Textarea
                  className="min-h-20 rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Optional details"
                  value={stepForm.task_description}
                  onChange={(event) =>
                    setStepForm((prev) => ({ ...prev, task_description: event.target.value }))
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Team / type</span>
                  <FluentSelect
                    ariaLabel="Team / type"
                    value={stepForm.task_type}
                    onChange={(value) =>
                      setStepForm((prev) => ({ ...prev, task_type: value }))
                    }
                    options={[
                      { value: "hr", label: "HR" },
                      { value: "it", label: "IT" },
                      { value: "finance", label: "Finance" },
                      { value: "manager", label: "Manager" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Action</span>
                  <FluentSelect
                    ariaLabel="Action"
                    value={stepForm.action_type}
                    onChange={(value) =>
                      setStepForm((prev) => ({ ...prev, action_type: value }))
                    }
                    options={[
                      { value: "verify", label: "Verify" },
                      { value: "approve", label: "Approve" },
                      { value: "recommend", label: "Recommend" },
                      { value: "complete", label: "Complete" },
                    ]}
                  />
                </label>
              </div>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Required?</span>
                <FluentSelect
                  ariaLabel="Required?"
                  value={stepForm.is_required}
                  onChange={(value) =>
                    setStepForm((prev) => ({ ...prev, is_required: value }))
                  }
                  options={[
                    { value: "true", label: "Required" },
                    { value: "false", label: "Optional" },
                  ]}
                />
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStepDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void submitWorkflowStepForm()}
              >
                {saving ? "Saving…" : "Add step"}
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>
      ) : null}

      <Dialog open={requestDetailsOpen} onOpenChange={setRequestDetailsOpen}>
        <DialogPopup from="bottom" className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest ? requestLabel(selectedRequest) : "Request details"}
            </DialogTitle>
            <DialogDescription>
              Summary of this offboarding request.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest ? (
            <div className="max-h-[72vh] space-y-4 overflow-y-auto py-2 pr-1">
              <div className="grid gap-2 text-xs md:grid-cols-4">
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusDot status={readString(selectedRequest, ["status"])} />
                  </div>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className="mt-1 font-medium text-foreground">
                    {toTitleCaseWords(readString(selectedRequest, ["offboarding_type", "type"]))}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last working day</p>
                  <p className="mt-1 font-medium text-foreground">
                    {formatDateTimeValue(
                      readString(selectedRequest, ["last_working_date", "lastWorkingDate"])
                    )}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Progress</p>
                  <p className="mt-1 font-medium text-foreground">
                    {requestProgress
                      ? String(requestProgress.progress_percentage ?? requestProgress.progress ?? "—")
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-border/70 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="mt-1 text-foreground">
                  {readString(selectedRequest, ["reason", "description"])}
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Documents</p>
                      <p className="text-xs text-muted-foreground">
                        Exit letters, handover files, and supporting documents.
                      </p>
                    </div>
                    {canManage || canActOnSelected ? (
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
                        {showDocumentComposer ? "Hide upload" : "Upload"}
                      </Button>
                    ) : null}
                  </div>

                  {showDocumentComposer ? (
                    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Title</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={documentForm.title}
                          onChange={(event) =>
                            setDocumentForm((prev) => ({ ...prev, title: event.target.value }))
                          }
                          placeholder="Document title"
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Document type</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={documentForm.document_type}
                          onChange={(event) =>
                            setDocumentForm((prev) => ({ ...prev, document_type: event.target.value }))
                          }
                          placeholder="e.g. clearance_form"
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Expiry date</span>
                        <DatePickerPresets
                          value={documentForm.expiry_date}
                          onChange={(value) =>
                            setDocumentForm((prev) => ({ ...prev, expiry_date: value }))
                          }
                          placeholder="Expiry date"
                          className="h-8 text-xs"
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">File</span>
                        <input
                          type="file"
                          className="block h-8 rounded-md border border-input bg-background px-2 py-1 text-xs file:mr-2 file:border-0 file:bg-transparent file:text-xs"
                          onChange={(event) => setDocumentUploadFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Description</span>
                        <Textarea
                          className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                          value={documentForm.description}
                          onChange={(event) =>
                            setDocumentForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Optional document notes"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
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
                          disabled={saving}
                          onClick={() => void submitRequestDocument()}
                        >
                          {saving ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {requestDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No offboarding documents attached yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestDocuments.map((documentRow, index) => {
                        const documentId = readNumber(documentRow, ["id", "document_id"])
                        return (
                          <div
                            key={`offboarding-document-${documentId ?? index}`}
                            className="rounded-md border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {readString(documentRow, ["title", "name", "file_name"])}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {toTitleCaseWords(readString(documentRow, ["document_type", "type"]))}
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
                                {canManage ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => void saveRequestDocument(documentRow)}
                                      disabled={saving}
                                    >
                                      Edit
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
                            <div className="mt-2 grid gap-2 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Uploaded</p>
                                <p className="mt-0.5 text-foreground">
                                  {formatDateTimeValue(documentRow.created_at ?? documentRow.uploaded_at)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Description</p>
                                <p className="mt-0.5 text-foreground">
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
                    <div>
                      <p className="text-sm font-semibold text-foreground">Tasks</p>
                      <p className="text-xs text-muted-foreground">
                        Work items assigned during the exit process.
                      </p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          void ensureLookups(["employees"])
                          resetTaskForm()
                          setShowTaskComposer((current) => !current)
                        }}
                        disabled={saving}
                      >
                        {showTaskComposer ? "Hide form" : "Create task"}
                      </Button>
                    ) : null}
                  </div>

                  {showTaskComposer ? (
                    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Title</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={taskForm.title}
                          onChange={(event) =>
                            setTaskForm((prev) => ({ ...prev, title: event.target.value }))
                          }
                          placeholder="Task title"
                        />
                      </label>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">Task type</span>
                          <FluentSelect
                            ariaLabel="Task type"
                            value={taskForm.task_type}
                            onChange={(value) =>
                              setTaskForm((prev) => ({ ...prev, task_type: value }))
                            }
                            options={OFFBOARDING_TASK_TYPE_OPTIONS.map((type) => ({
                              value: type,
                              label: toTitleCaseWords(type),
                            }))}
                          />
                        </label>
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">Priority</span>
                          <FluentSelect
                            ariaLabel="Priority"
                            value={taskForm.priority}
                            onChange={(value) =>
                              setTaskForm((prev) => ({ ...prev, priority: value }))
                            }
                            options={OFFBOARDING_PRIORITY_OPTIONS.map((priority) => ({
                              value: priority,
                              label: toTitleCaseWords(priority),
                            }))}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Assigned user</span>
                        <FluentSelect
                          ariaLabel="Assigned user"
                          value={taskForm.assigned_to_company_user_id}
                          placeholder="Optional assignee"
                          onChange={(value) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              assigned_to_company_user_id: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Optional assignee" },
                            ...employeeCompanyUserOptions.map((option) => ({
                              value: String(option.companyUserId),
                              label: option.label,
                            })),
                          ]}
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Due date</span>
                        <input
                          type="datetime-local"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={taskForm.due_date}
                          onChange={(event) =>
                            setTaskForm((prev) => ({ ...prev, due_date: event.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Description</span>
                        <Textarea
                          className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                          value={taskForm.description}
                          onChange={(event) =>
                            setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="Optional instructions"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
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
                          disabled={saving}
                          onClick={() => void submitRequestTask()}
                        >
                          {saving ? "Creating..." : "Create task"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedRequestTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No offboarding tasks have been created for this request.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRequestTasks.map((taskRow, index) => {
                        const taskId = readNumber(taskRow, ["id", "task_id"])
                        const taskStatus = readString(taskRow, ["status", "task_status"])
                        const normalizedStatus = taskStatus.trim().toLowerCase()
                        const assignedCompanyUserId = readCompanyUserId(taskRow)
                        return (
                          <div
                            key={`offboarding-task-${taskId ?? index}`}
                            className="rounded-md border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {readString(taskRow, ["title", "task_title", "name", "step_name"])}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {toTitleCaseWords(readString(taskRow, ["task_type", "type"]))} •{" "}
                                  {toTitleCaseWords(taskStatus)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {normalizedStatus !== "completed" && normalizedStatus !== "done" ? (
                                  <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={saving}
                                    onClick={() => void completeRequestTask(taskRow)}
                                  >
                                    Complete
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={saving}
                                    onClick={() => {
                                      const token = readStoredToken()
                                      const requestId = readNumber(selectedRequest, ["id"])
                                      const target = window.prompt("Reassign to company user id")
                                      if (!token || requestId === null || taskId === null || !target) return
                                      void reassignOffboardingTask(token, requestId, taskId, {
                                        assigned_to_company_user_id: Number(target),
                                      })
                                        .then(() => showSuccessAlert("Task reassigned."))
                                        .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Reassign failed."))
                                    }}
                                  >
                                    Reassign
                                  </Button>
                                  </>
                                ) : canManage ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={saving}
                                    onClick={() => void reopenRequestTask(taskRow)}
                                  >
                                    Reopen
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-2 grid gap-2 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</p>
                                <p className="mt-0.5 text-foreground">
                                  {resolveEmployeeOptionLabel(assignedCompanyUserId)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Due</p>
                                <p className="mt-0.5 text-foreground">{formatDateTimeValue(taskRow.due_date)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Description</p>
                                <p className="mt-0.5 text-foreground">
                                  {readString(taskRow, ["description", "task_description", "remarks"])}
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
                    <div>
                      <p className="text-sm font-semibold text-foreground">Clearances</p>
                      <p className="text-xs text-muted-foreground">
                        Department sign-off items required before exit closes.
                      </p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          void ensureLookups(["employees"])
                          resetClearanceForm()
                          setShowClearanceComposer((current) => !current)
                        }}
                        disabled={saving}
                      >
                        {showClearanceComposer ? "Hide form" : "Create clearance"}
                      </Button>
                    ) : null}
                  </div>

                  {showClearanceComposer ? (
                    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3">
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Clearance type</span>
                        <FluentSelect
                          ariaLabel="Clearance type"
                          value={clearanceForm.clearance_type}
                          onChange={(value) =>
                            setClearanceForm((prev) => ({
                              ...prev,
                              clearance_type: value,
                            }))
                          }
                          options={OFFBOARDING_CLEARANCE_TYPE_OPTIONS.map((type) => ({
                            value: type,
                            label: toTitleCaseWords(type),
                          }))}
                        />
                      </label>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">Initial status</span>
                          <FluentSelect
                            ariaLabel="Initial status"
                            value={clearanceForm.status}
                            onChange={(value) =>
                              setClearanceForm((prev) => ({ ...prev, status: value }))
                            }
                            options={[
                              { value: "pending", label: "Pending" },
                              { value: "cleared", label: "Cleared" },
                              { value: "not_cleared", label: "Not cleared" },
                            ]}
                          />
                        </label>
                        <label className="grid gap-1 text-xs">
                          <span className="font-medium text-muted-foreground">Owner</span>
                          <FluentSelect
                            ariaLabel="Owner"
                            value={clearanceForm.owner_company_user_id}
                            placeholder="Optional owner"
                            onChange={(value) =>
                              setClearanceForm((prev) => ({
                                ...prev,
                                owner_company_user_id: value,
                              }))
                            }
                            options={[
                              { value: "", label: "Optional owner" },
                              ...employeeCompanyUserOptions.map((option) => ({
                                value: String(option.companyUserId),
                                label: option.label,
                              })),
                            ]}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Due date</span>
                        <input
                          type="datetime-local"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={clearanceForm.due_date}
                          onChange={(event) =>
                            setClearanceForm((prev) => ({ ...prev, due_date: event.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-medium text-muted-foreground">Remarks</span>
                        <Textarea
                          className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                          value={clearanceForm.remarks}
                          onChange={(event) =>
                            setClearanceForm((prev) => ({ ...prev, remarks: event.target.value }))
                          }
                          placeholder="Optional instructions"
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                          onClick={() => {
                            resetClearanceForm()
                            setShowClearanceComposer(false)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="h-8 px-3 text-xs"
                          disabled={saving}
                          onClick={() => void submitRequestClearance()}
                        >
                          {saving ? "Creating..." : "Create clearance"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {selectedRequestClearances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No clearances have been added for this request yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRequestClearances.map((clearanceRow, index) => {
                        const clearanceId = readNumber(clearanceRow, ["id", "clearance_id"])
                        const clearanceStatus = readString(clearanceRow, ["status"])
                        const normalizedStatus = clearanceStatus.trim().toLowerCase()
                        const ownerCompanyUserId =
                          readNumber(clearanceRow, ["owner_company_user_id"]) ??
                          readCompanyUserId(clearanceRow)
                        return (
                          <div
                            key={`offboarding-clearance-${clearanceId ?? index}`}
                            className="rounded-md border border-border/70 bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {toTitleCaseWords(
                                    readString(clearanceRow, [
                                      "clearance_type",
                                      "title",
                                      "name",
                                      "department_name",
                                    ])
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {toTitleCaseWords(clearanceStatus)}
                                </p>
                              </div>
                              {normalizedStatus !== "cleared" && canManage ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <FluentSelect
                                    ariaLabel="Assign clearance owner"
                                    className="max-w-[10rem]"
                                    size="small"
                                    value={ownerCompanyUserId == null ? "" : String(ownerCompanyUserId)}
                                    disabled={saving}
                                    placeholder="Assign owner"
                                    onChange={(value) => {
                                      if (value) {
                                        void assignRequestClearance(clearanceRow, value)
                                      }
                                    }}
                                    options={[
                                      { value: "", label: "Assign owner" },
                                      ...employeeCompanyUserOptions.map((option) => ({
                                        value: String(option.companyUserId),
                                        label: option.label,
                                      })),
                                    ]}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={saving}
                                    onClick={() => void completeRequestClearance(clearanceRow)}
                                  >
                                    Mark cleared
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <div className="mt-2 grid gap-2 text-xs">
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</p>
                                <p className="mt-0.5 text-foreground">
                                  {resolveEmployeeOptionLabel(ownerCompanyUserId)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Due</p>
                                <p className="mt-0.5 text-foreground">{formatDateTimeValue(clearanceRow.due_date)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remarks</p>
                                <p className="mt-0.5 text-foreground">
                                  {readString(clearanceRow, ["remarks", "notes", "description"])}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 text-xs md:grid-cols-2">
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Approvals</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{requestApprovals.length}</p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Audit log entries</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{requestAuditLogs.length}</p>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Approvals</p>
                    <p className="text-xs text-muted-foreground">
                      Current approval trail for this offboarding request.
                    </p>
                  </div>
                  {requestApprovals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No approval records returned for this request.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestApprovals.map((approvalRow, index) => (
                        <div
                          key={`offboarding-approval-${readNumber(approvalRow, ["id", "approval_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {readString(approvalRow, ["title", "step_name", "approval_name", "name"])}
                            </p>
                            <StatusDot status={readString(approvalRow, ["status", "approval_status"])} />
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Approver</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(approvalRow, ["approver_name", "company_user_name", "assigned_to_name", "name"])}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Comments</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(approvalRow, ["comments", "remark", "remarks", "notes"])}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="justify-self-start text-xs font-medium text-primary"
                              onClick={() => {
                                const token = readStoredToken()
                                const requestId = readNumber(selectedRequest, ["id"])
                                const approvalId = readNumber(approvalRow, ["id", "approval_id"])
                                const target = window.prompt("Delegate to company user id")
                                const reason = window.prompt("Reason")
                                if (!token || requestId === null || approvalId === null || !target || !reason) return
                                void delegateOffboardingApproval(token, requestId, approvalId, {
                                  target_company_user_id: Number(target),
                                  reason,
                                })
                                  .then(() => showSuccessAlert("Approval delegated."))
                                  .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Delegate failed."))
                              }}
                            >
                              Delegate
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Audit log</p>
                    <p className="text-xs text-muted-foreground">
                      Timeline of request activity returned by the backend.
                    </p>
                  </div>
                  {requestAuditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No audit log records returned for this request.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestAuditLogs.map((auditRow, index) => (
                        <div
                          key={`offboarding-audit-${readNumber(auditRow, ["id", "audit_log_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {toTitleCaseWords(
                                readString(auditRow, ["action", "event", "event_name", "title"])
                              )}
                            </p>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateTimeValue(
                                auditRow.created_at ?? auditRow.createdAt ?? auditRow.timestamp
                              )}
                            </span>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Actor</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(auditRow, ["actor_name", "performed_by_name", "user_name", "company_user_name"])}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(auditRow, ["description", "notes", "remark", "remarks"])}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Exit interview</p>
                      <p className="text-xs text-muted-foreground">
                        Capture employee feedback, handover notes, and rehire recommendation.
                      </p>
                    </div>
                    {(canManage || canActOnSelected) && requestDetailsOpen ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        disabled={saving}
                        onClick={() => void saveExitInterview()}
                      >
                        {saving ? "Saving..." : "Save interview"}
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-2 text-xs">
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Status</span>
                        <FluentSelect
                          ariaLabel="Status"
                          value={exitInterviewForm.status}
                          disabled={!canManage && !canActOnSelected}
                          onChange={(value) =>
                            setExitInterviewForm((prev) => ({ ...prev, status: value }))
                          }
                          options={OFFBOARDING_EXIT_INTERVIEW_STATUS_OPTIONS.map((status) => ({
                            value: status,
                            label: toTitleCaseWords(status),
                          }))}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Knowledge transfer</span>
                        <FluentSelect
                          ariaLabel="Knowledge transfer"
                          value={exitInterviewForm.knowledge_transfer_status}
                          disabled={!canManage && !canActOnSelected}
                          onChange={(value) =>
                            setExitInterviewForm((prev) => ({
                              ...prev,
                              knowledge_transfer_status: value,
                            }))
                          }
                          options={OFFBOARDING_KNOWLEDGE_TRANSFER_OPTIONS.map((status) => ({
                            value: status,
                            label: toTitleCaseWords(status),
                          }))}
                        />
                      </label>
                    </div>
                    <label className="grid gap-1">
                      <span className="font-medium text-muted-foreground">Exit reason category</span>
                      <input
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={exitInterviewForm.exit_reason_category}
                        disabled={!canManage && !canActOnSelected}
                        onChange={(event) =>
                          setExitInterviewForm((prev) => ({
                            ...prev,
                            exit_reason_category: event.target.value,
                          }))
                        }
                        placeholder="Optional category"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium text-muted-foreground">Rehire eligible</span>
                      <FluentSelect
                        ariaLabel="Rehire eligible"
                        value={exitInterviewForm.rehire_eligible}
                        disabled={!canManage && !canActOnSelected}
                        onChange={(value) =>
                          setExitInterviewForm((prev) => ({
                            ...prev,
                            rehire_eligible: value,
                          }))
                        }
                        options={[
                          { value: "unknown", label: "Not set" },
                          { value: "true", label: "Yes" },
                          { value: "false", label: "No" },
                        ]}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium text-muted-foreground">Employee feedback</span>
                      <Textarea
                        className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                        value={exitInterviewForm.employee_feedback}
                        disabled={!canManage && !canActOnSelected}
                        onChange={(event) =>
                          setExitInterviewForm((prev) => ({
                            ...prev,
                            employee_feedback: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium text-muted-foreground">Manager feedback</span>
                      <Textarea
                        className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                        value={exitInterviewForm.manager_feedback}
                        disabled={!canManage && !canActOnSelected}
                        onChange={(event) =>
                          setExitInterviewForm((prev) => ({
                            ...prev,
                            manager_feedback: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium text-muted-foreground">Handover notes</span>
                      <Textarea
                        className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                        value={exitInterviewForm.handover_notes}
                        disabled={!canManage && !canActOnSelected}
                        onChange={(event) =>
                          setExitInterviewForm((prev) => ({
                            ...prev,
                            handover_notes: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium text-muted-foreground">Final notes</span>
                      <Textarea
                        className="min-h-20 rounded-md border border-input px-2 py-1.5 text-xs"
                        value={exitInterviewForm.final_notes}
                        disabled={!canManage && !canActOnSelected}
                        onChange={(event) =>
                          setExitInterviewForm((prev) => ({
                            ...prev,
                            final_notes: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Access actions</p>
                      <p className="text-xs text-muted-foreground">
                        Track system disablement and access revocation steps.
                      </p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          resetActionForm()
                          setShowActionComposer((current) => !current)
                        }}
                        disabled={saving}
                      >
                        {showActionComposer ? "Hide form" : "Create action"}
                      </Button>
                    ) : null}
                  </div>

                  {showActionComposer ? (
                    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Action type</span>
                          <FluentSelect
                            ariaLabel="Action type"
                            value={actionForm.action_type}
                            onChange={(value) =>
                              setActionForm((prev) => ({ ...prev, action_type: value }))
                            }
                            options={OFFBOARDING_ACTION_TYPE_OPTIONS.map((type) => ({
                              value: type,
                              label: toTitleCaseWords(type),
                            }))}
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Status</span>
                          <FluentSelect
                            ariaLabel="Status"
                            value={actionForm.status}
                            onChange={(value) =>
                              setActionForm((prev) => ({ ...prev, status: value }))
                            }
                            options={OFFBOARDING_ACTION_STATUS_OPTIONS.map((status) => ({
                              value: status,
                              label: toTitleCaseWords(status),
                            }))}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">System name</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={actionForm.system_name}
                          onChange={(event) =>
                            setActionForm((prev) => ({ ...prev, system_name: event.target.value }))
                          }
                          placeholder="e.g. Microsoft 365"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Owner</span>
                        <FluentSelect
                          ariaLabel="Owner"
                          value={actionForm.owner_company_user_id}
                          placeholder="Optional owner"
                          onChange={(value) =>
                            setActionForm((prev) => ({
                              ...prev,
                              owner_company_user_id: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Optional owner" },
                            ...employeeCompanyUserOptions.map((option) => ({
                              value: String(option.companyUserId),
                              label: option.label,
                            })),
                          ]}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Due date</span>
                        <input
                          type="datetime-local"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={actionForm.due_date}
                          onChange={(event) =>
                            setActionForm((prev) => ({ ...prev, due_date: event.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Notes</span>
                        <Textarea
                          className="min-h-16 rounded-md border border-input px-2 py-1.5 text-xs"
                          value={actionForm.notes}
                          onChange={(event) =>
                            setActionForm((prev) => ({ ...prev, notes: event.target.value }))
                          }
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => {
                          resetActionForm()
                          setShowActionComposer(false)
                        }}>
                          Cancel
                        </Button>
                        <Button type="button" className="h-8 px-3 text-xs" disabled={saving} onClick={() => void submitRequestActionItem()}>
                          {saving ? "Creating..." : "Create action"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {requestActions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No access actions have been added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestActions.map((actionRow, index) => (
                        <div
                          key={`offboarding-action-${readNumber(actionRow, ["id", "action_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {toTitleCaseWords(readString(actionRow, ["action_type", "title", "name"]))}
                            </p>
                            {canManage ? (
                              <FluentSelect
                                ariaLabel="Update access action status"
                                size="small"
                                value={readString(actionRow, ["status"])}
                                disabled={saving}
                                onChange={(value) => void saveRequestActionStatus(actionRow, value)}
                                options={OFFBOARDING_ACTION_STATUS_OPTIONS.map((status) => ({
                                  value: status,
                                  label: toTitleCaseWords(status),
                                }))}
                              />
                            ) : (
                              <StatusDot status={readString(actionRow, ["status"])} />
                            )}
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">System</p>
                              <p className="mt-0.5 text-foreground">{readString(actionRow, ["system_name", "systemName"])}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</p>
                              <p className="mt-0.5 text-foreground">
                                {resolveEmployeeOptionLabel(readNumber(actionRow, ["owner_company_user_id"]))}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Asset returns</p>
                      <p className="text-xs text-muted-foreground">
                        Track laptops, cards, phones, keys, and other company property.
                      </p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          resetAssetForm()
                          setShowAssetComposer((current) => !current)
                        }}
                        disabled={saving}
                      >
                        {showAssetComposer ? "Hide form" : "Add asset"}
                      </Button>
                    ) : null}
                  </div>

                  {showAssetComposer ? (
                    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Asset type</span>
                          <FluentSelect
                            ariaLabel="Asset type"
                            value={assetForm.asset_type}
                            onChange={(value) =>
                              setAssetForm((prev) => ({ ...prev, asset_type: value }))
                            }
                            options={OFFBOARDING_ASSET_TYPE_OPTIONS.map((type) => ({
                              value: type,
                              label: toTitleCaseWords(type),
                            }))}
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Status</span>
                          <FluentSelect
                            ariaLabel="Status"
                            value={assetForm.status}
                            onChange={(value) =>
                              setAssetForm((prev) => ({ ...prev, status: value }))
                            }
                            options={OFFBOARDING_ASSET_STATUS_OPTIONS.map((status) => ({
                              value: status,
                              label: toTitleCaseWords(status),
                            }))}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Asset label</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={assetForm.asset_label}
                          onChange={(event) =>
                            setAssetForm((prev) => ({ ...prev, asset_label: event.target.value }))
                          }
                          placeholder="e.g. Dell Latitude 5440"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Asset identifier</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={assetForm.asset_identifier}
                          onChange={(event) =>
                            setAssetForm((prev) => ({ ...prev, asset_identifier: event.target.value }))
                          }
                          placeholder="Serial / tag"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Owner</span>
                        <FluentSelect
                          ariaLabel="Owner"
                          value={assetForm.owner_company_user_id}
                          placeholder="Optional owner"
                          onChange={(value) =>
                            setAssetForm((prev) => ({
                              ...prev,
                              owner_company_user_id: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Optional owner" },
                            ...employeeCompanyUserOptions.map((option) => ({
                              value: String(option.companyUserId),
                              label: option.label,
                            })),
                          ]}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Due date</span>
                        <input
                          type="datetime-local"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={assetForm.due_date}
                          onChange={(event) =>
                            setAssetForm((prev) => ({ ...prev, due_date: event.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Remarks</span>
                        <Textarea
                          className="min-h-16 rounded-md border border-input px-2 py-1.5 text-xs"
                          value={assetForm.remarks}
                          onChange={(event) =>
                            setAssetForm((prev) => ({ ...prev, remarks: event.target.value }))
                          }
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => {
                          resetAssetForm()
                          setShowAssetComposer(false)
                        }}>
                          Cancel
                        </Button>
                        <Button type="button" className="h-8 px-3 text-xs" disabled={saving} onClick={() => void submitRequestAsset()}>
                          {saving ? "Creating..." : "Add asset"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {requestAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No asset return items have been added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestAssets.map((assetRow, index) => (
                        <div
                          key={`offboarding-asset-${readNumber(assetRow, ["id", "asset_return_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {readString(assetRow, ["asset_label", "title", "name"])}
                            </p>
                            {canManage ? (
                              <FluentSelect
                                ariaLabel="Update asset return status"
                                size="small"
                                value={readString(assetRow, ["status"])}
                                disabled={saving}
                                onChange={(value) => void saveRequestAssetStatus(assetRow, value)}
                                options={OFFBOARDING_ASSET_STATUS_OPTIONS.map((status) => ({
                                  value: status,
                                  label: toTitleCaseWords(status),
                                }))}
                              />
                            ) : (
                              <StatusDot status={readString(assetRow, ["status"])} />
                            )}
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                              <p className="mt-0.5 text-foreground">
                                {toTitleCaseWords(readString(assetRow, ["asset_type", "type"]))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Identifier</p>
                              <p className="mt-0.5 text-foreground">{readString(assetRow, ["asset_identifier", "identifier"])}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Settlements</p>
                      <p className="text-xs text-muted-foreground">
                        Final salary, recoveries, gratuity, and other financial closeout items.
                      </p>
                    </div>
                    {canManage ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => {
                          resetSettlementForm()
                          setShowSettlementComposer((current) => !current)
                        }}
                        disabled={saving}
                      >
                        {showSettlementComposer ? "Hide form" : "Add settlement"}
                      </Button>
                    ) : null}
                  </div>

                  {showSettlementComposer ? (
                    <div className="grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Item type</span>
                          <FluentSelect
                            ariaLabel="Item type"
                            value={settlementForm.item_type}
                            onChange={(value) =>
                              setSettlementForm((prev) => ({ ...prev, item_type: value }))
                            }
                            options={OFFBOARDING_SETTLEMENT_ITEM_TYPE_OPTIONS.map((type) => ({
                              value: type,
                              label: toTitleCaseWords(type),
                            }))}
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Status</span>
                          <FluentSelect
                            ariaLabel="Status"
                            value={settlementForm.status}
                            onChange={(value) =>
                              setSettlementForm((prev) => ({ ...prev, status: value }))
                            }
                            options={OFFBOARDING_SETTLEMENT_STATUS_OPTIONS.map((status) => ({
                              value: status,
                              label: toTitleCaseWords(status),
                            }))}
                          />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Title</span>
                        <input
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={settlementForm.title}
                          onChange={(event) =>
                            setSettlementForm((prev) => ({ ...prev, title: event.target.value }))
                          }
                          placeholder="e.g. Leave encashment"
                        />
                      </label>
                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Amount</span>
                          <input
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={settlementForm.amount}
                            onChange={(event) =>
                              setSettlementForm((prev) => ({ ...prev, amount: event.target.value }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="font-medium text-muted-foreground">Currency</span>
                          <input
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={settlementForm.currency}
                            onChange={(event) =>
                              setSettlementForm((prev) => ({ ...prev, currency: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Owner</span>
                        <FluentSelect
                          ariaLabel="Owner"
                          value={settlementForm.owner_company_user_id}
                          placeholder="Optional owner"
                          onChange={(value) =>
                            setSettlementForm((prev) => ({
                              ...prev,
                              owner_company_user_id: value,
                            }))
                          }
                          options={[
                            { value: "", label: "Optional owner" },
                            ...employeeCompanyUserOptions.map((option) => ({
                              value: String(option.companyUserId),
                              label: option.label,
                            })),
                          ]}
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Due date</span>
                        <input
                          type="datetime-local"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={settlementForm.due_date}
                          onChange={(event) =>
                            setSettlementForm((prev) => ({ ...prev, due_date: event.target.value }))
                          }
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-medium text-muted-foreground">Remarks</span>
                        <Textarea
                          className="min-h-16 rounded-md border border-input px-2 py-1.5 text-xs"
                          value={settlementForm.remarks}
                          onChange={(event) =>
                            setSettlementForm((prev) => ({ ...prev, remarks: event.target.value }))
                          }
                        />
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => {
                          resetSettlementForm()
                          setShowSettlementComposer(false)
                        }}>
                          Cancel
                        </Button>
                        <Button type="button" className="h-8 px-3 text-xs" disabled={saving} onClick={() => void submitRequestSettlement()}>
                          {saving ? "Creating..." : "Add settlement"}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {requestSettlements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No settlement items have been added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestSettlements.map((settlementRow, index) => (
                        <div
                          key={`offboarding-settlement-${readNumber(settlementRow, ["id", "item_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {readString(settlementRow, ["title", "name"])}
                            </p>
                            <div className="flex items-center gap-2">
                              <StatusDot status={readString(settlementRow, ["status"])} />
                              <button
                                type="button"
                                className="text-xs font-medium text-primary"
                                onClick={() => {
                                  const token = readStoredToken()
                                  const requestId = readNumber(selectedRequest, ["id"])
                                  const itemId = readNumber(settlementRow, ["id", "item_id"])
                                  const status = window.prompt("New settlement status", readString(settlementRow, ["status"]) || "PENDING")
                                  if (!token || requestId === null || itemId === null || !status) return
                                  void updateOffboardingSettlement(token, requestId, itemId, { status })
                                    .then(() => showSuccessAlert("Settlement updated."))
                                    .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Update failed."))
                                }}
                              >
                                Update
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                              <p className="mt-0.5 text-foreground">
                                {toTitleCaseWords(readString(settlementRow, ["item_type", "type"]))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(settlementRow, ["amount"])} {readString(settlementRow, ["currency"])}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Generated letters</p>
                    <p className="text-xs text-muted-foreground">
                      Relieving and service letter records returned by the backend.
                    </p>
                  </div>
                  {requestLetters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No generated letters were returned for this request.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestLetters.map((letterRow, index) => (
                        <div
                          key={`offboarding-letter-${readNumber(letterRow, ["id", "letter_id", "document_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {readString(letterRow, ["title", "name", "document_name", "file_name"])}
                            </p>
                            <StatusDot status={readString(letterRow, ["status", "document_status"])} />
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                              <p className="mt-0.5 text-foreground">
                                {toTitleCaseWords(readString(letterRow, ["type", "document_type", "category"]))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Created</p>
                              <p className="mt-0.5 text-foreground">
                                {formatDateTimeValue(letterRow.created_at ?? letterRow.createdAt ?? letterRow.generated_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Access operations</p>
                      <p className="text-xs text-muted-foreground">
                        Technical access-termination operations tracked for this exit.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary"
                        onClick={() => {
                          const token = readStoredToken()
                          const requestId = readNumber(selectedRequest, ["id"])
                          const reason = window.prompt("Emergency termination reason")
                          if (!token || requestId === null || !reason) return
                          void emergencyOffboardingAccessTermination(token, requestId, { reason })
                            .then(() => showSuccessAlert("Emergency access termination started."))
                            .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Emergency termination failed."))
                        }}
                      >
                        Emergency terminate
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary"
                        onClick={() => {
                          const token = readStoredToken()
                          const requestId = readNumber(selectedRequest, ["id"])
                          if (!token || requestId === null) return
                          void retryOffboardingAccessTermination(token, requestId)
                            .then(() => showSuccessAlert("Access termination retried."))
                            .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Retry failed."))
                        }}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary"
                        onClick={() => {
                          const token = readStoredToken()
                          const requestId = readNumber(selectedRequest, ["id"])
                          if (!token || requestId === null) return
                          void createEmployeeFinanceOffboardingRecoveries(token, requestId)
                            .then(() => showSuccessAlert("Finance recoveries created."))
                            .catch((errorObject) => showErrorAlert(errorObject instanceof Error ? errorObject.message : "Recoveries failed."))
                        }}
                      >
                        Finance recoveries
                      </button>
                    </div>
                  </div>
                  {requestAccessOperations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No access operations were returned for this request.</p>
                  ) : (
                    <div className="space-y-2">
                      {requestAccessOperations.map((operationRow, index) => (
                        <div
                          key={`offboarding-access-op-${readNumber(operationRow, ["id", "operation_id"]) ?? index}`}
                          className="rounded-md border border-border/70 bg-background p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {toTitleCaseWords(readString(operationRow, ["operation_type", "action_type", "name", "title"]))}
                            </p>
                            <StatusDot status={readString(operationRow, ["status"])} />
                          </div>
                          <div className="mt-2 grid gap-2 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">System</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(operationRow, ["system_name", "systemName", "provider"])}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Updated</p>
                              <p className="mt-0.5 text-foreground">
                                {formatDateTimeValue(operationRow.updated_at ?? operationRow.updatedAt ?? operationRow.created_at)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                              <p className="mt-0.5 text-foreground">
                                {readString(operationRow, ["notes", "remark", "remarks", "error_message"])}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {selectedRequest ? (
              <>
                {(canManage || canActOnSelected) &&
                statusIsDraft(readString(selectedRequest, ["status"])) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void runRequestAction(selectedRequest, "submit")}
                  >
                    Submit
                  </Button>
                ) : null}
                {canManage &&
                ["submitted", "pending", "pending_approval", "in_review"].includes(
                  readString(selectedRequest, ["status"]).toLowerCase()
                ) ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void runRequestAction(selectedRequest, "approve")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void runRequestAction(selectedRequest, "reject")}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {canManage &&
                ["approved", "in_progress"].includes(
                  readString(selectedRequest, ["status"]).toLowerCase()
                ) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void runRequestAction(selectedRequest, "complete")}
                  >
                    Complete
                  </Button>
                ) : null}
                {canManage &&
                !isRequestFinalized(selectedRequest) &&
                ["completed"].includes(readString(selectedRequest, ["status"]).toLowerCase()) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void runRequestAction(selectedRequest, "finalize")}
                  >
                    Finalize
                  </Button>
                ) : null}
                {(canManage || canActOnSelected) &&
                statusIsCancellable(readString(selectedRequest, ["status"])) ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => void runRequestAction(selectedRequest, "cancel")}
                  >
                    Cancel request
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setRequestDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
