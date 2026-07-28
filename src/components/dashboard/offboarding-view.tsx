"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { ResizableTable } from "@/components/ui/resizable-table"
import { Textarea } from "@/components/ui/textarea"
import { Plus, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  approveOffboardingRequest,
  cancelOffboardingRequest,
  completeOffboardingRequest,
  completeOffboardingTask,
  createOffboardingRequest,
  createOffboardingWorkflow,
  createOffboardingWorkflowStep,
  getCurrentEmployee,
  getOffboardingRequest,
  getOffboardingApprovals,
  getOffboardingAuditLogs,
  getOffboardingDashboard,
  getOffboardingProgress,
  listBranches,
  listDepartments,
  listEmployees,
  listMyOffboardingApprovals,
  listMyOffboardingClearances,
  listMyOffboardingTasks,
  listOffboardingDocuments,
  listOffboardingItemsFromOwnRequests,
  listOffboardingRequests,
  listOffboardingWorkflows,
  rejectOffboardingRequest,
  submitOffboardingRequest,
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

function statusIsDraft(status: string) {
  const s = status.trim().toLowerCase()
  return s === "draft" || s === "pending_submit" || s === "new" || s === ""
}

function statusIsCancellable(status: string) {
  const s = status.trim().toLowerCase()
  return ["draft", "pending", "submitted", "in_review", "in_progress", "pending_approval"].includes(s)
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

  function autoResizeTextarea(event: React.FormEvent<HTMLTextAreaElement>) {
    const element = event.currentTarget
    element.style.height = "auto"
    element.style.height = `${element.scrollHeight}px`
  }
  const [requestDocuments, setRequestDocuments] = React.useState<AdminRecord[]>([])
  const [requestProgress, setRequestProgress] = React.useState<AdminRecord | null>(null)

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
        if (isEmployeeMode && employeeFilter == null) {
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
          employee_id: isEmployeeMode && employeeFilter ? employeeFilter : undefined,
        })
        setRequests(requestsResult.rows)
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
    if (isEmployeeMode && tab === "workflows") setTab("requests")
  }, [isEmployeeMode, tab])

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
    try {
      const [detail, approvals, audit, docs, progress] = await Promise.all([
        getOffboardingRequest(token, id),
        getOffboardingApprovals(token, id),
        getOffboardingAuditLogs(token, id),
        listOffboardingDocuments(token, id),
        getOffboardingProgress(token, id),
      ])
      if (detail) {
        setSelectedRequest({ ...row, ...detail })
      }
      setRequestApprovals(approvals)
      setRequestAuditLogs(audit)
      setRequestDocuments(docs)
      setRequestProgress(progress)
    } catch {
      setRequestApprovals([])
      setRequestAuditLogs([])
      setRequestDocuments([])
      setRequestProgress(null)
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
    action: "submit" | "approve" | "reject" | "cancel" | "complete"
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
      const pastTense =
        action === "submit"
          ? "submitted"
          : action === "approve"
            ? "approved"
            : action === "reject"
              ? "rejected"
              : action === "cancel"
                ? "cancelled"
                : "completed"
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
      await completeOffboardingTask(token, requestId, taskId, { notes: "Completed" })
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {isEmployeeMode ? "My Offboarding" : "Offboarding"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Review exit requests, approvals, tasks, and manage workflows."
            : "Submit and track your exit request, plus any tasks or clearances assigned to you."}
        </p>
      </div>

      <div className="inline-flex w-fit flex-wrap items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab === "my-clearances"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My clearances
        </button>
        {canManage ? (
          <button
            type="button"
            onClick={() => setTab("workflows")}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="flex flex-col gap-3">
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
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={requestForm.employee_id}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, employee_id: event.target.value }))
                  }
                >
                  <option value="">Select employee</option>
                  {employees.map((employee, index) => {
                    const id = readNumber(employee, ["id", "employee_id", "user_id"])
                    if (id === null) return null
                    return (
                      <option key={`off-emp-${id}-${index}`} value={String(id)}>
                        {employeeLabel(employee)}
                      </option>
                    )
                  })}
                </select>
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
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={requestForm.offboarding_type}
                    onChange={(event) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        offboarding_type: event.target.value,
                      }))
                    }
                  >
                    <option value="resignation">Resignation</option>
                    <option value="termination">Termination</option>
                    <option value="retirement">Retirement</option>
                    <option value="contract_end">Contract end</option>
                    <option value="absconded">Absconded</option>
                    <option value="deceased">Deceased</option>
                    <option value="layoff">Layoff</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="grid gap-0.5 text-[11px]">
                  <span className="font-medium text-muted-foreground">Save mode</span>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={requestForm.submit}
                    onChange={(event) =>
                      setRequestForm((prev) => ({ ...prev, submit: event.target.value }))
                    }
                  >
                    <option value="false">Save draft</option>
                    <option value="true">Submit now</option>
                  </select>
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
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={requestForm.workflow_id}
                    onChange={(event) =>
                      setRequestForm((prev) => ({ ...prev, workflow_id: event.target.value }))
                    }
                  >
                    <option value="">Optional</option>
                    {workflows.map((row, index) => {
                      const id = readNumber(row, ["id", "workflow_id"])
                      if (id === null) return null
                      return (
                        <option key={`off-wf-${id}-${index}`} value={String(id)}>
                          {readString(row, ["name", "title"])}
                        </option>
                      )
                    })}
                  </select>
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
        <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-3">
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
        <div className="flex flex-col gap-3">
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

      {tab === "workflows" && canManage ? (
        <div className="flex flex-col gap-4">
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
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={workflowForm.status}
                    onChange={(event) =>
                      setWorkflowForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Default</span>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={workflowForm.is_default}
                    onChange={(event) =>
                      setWorkflowForm((prev) => ({ ...prev, is_default: event.target.value }))
                    }
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
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
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={stepForm.task_type}
                    onChange={(event) =>
                      setStepForm((prev) => ({ ...prev, task_type: event.target.value }))
                    }
                  >
                    <option value="hr">HR</option>
                    <option value="it">IT</option>
                    <option value="finance">Finance</option>
                    <option value="manager">Manager</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Action</span>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={stepForm.action_type}
                    onChange={(event) =>
                      setStepForm((prev) => ({ ...prev, action_type: event.target.value }))
                    }
                  >
                    <option value="verify">Verify</option>
                    <option value="approve">Approve</option>
                    <option value="recommend">Recommend</option>
                    <option value="complete">Complete</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Required?</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={stepForm.is_required}
                  onChange={(event) =>
                    setStepForm((prev) => ({ ...prev, is_required: event.target.value }))
                  }
                >
                  <option value="true">Required</option>
                  <option value="false">Optional</option>
                </select>
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
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedRequest ? requestLabel(selectedRequest) : "Request details"}
            </DialogTitle>
            <DialogDescription>
              Summary of this offboarding request.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest ? (
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusDot status={readString(selectedRequest, ["status"])} />
                  </div>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className="mt-1 font-medium text-foreground">
                    {readString(selectedRequest, ["offboarding_type", "type"])}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Last working day
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {readString(selectedRequest, ["last_working_date", "lastWorkingDate"])}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Approvals
                  </p>
                  <p className="mt-1 font-medium text-foreground">{requestApprovals.length}</p>
                </div>
              </div>
              <div className="rounded-md border border-border/70 px-3 py-2 text-xs">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="mt-1 text-foreground">
                  {readString(selectedRequest, ["reason", "description"])}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md border border-border/70 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Docs</p>
                  <p className="mt-1 text-sm font-semibold">{requestDocuments.length}</p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Audit</p>
                  <p className="mt-1 text-sm font-semibold">{requestAuditLogs.length}</p>
                </div>
                <div className="rounded-md border border-border/70 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Progress</p>
                  <p className="mt-1 text-sm font-semibold">
                    {requestProgress
                      ? String(
                          requestProgress.progress_percentage ??
                            requestProgress.progress ??
                            "—"
                        )
                      : "—"}
                  </p>
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
    </div>
  )
}
