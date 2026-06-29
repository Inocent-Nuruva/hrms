"use client"

import * as React from "react"
import { TableScrollContainer } from "@/components/common/table-scroll-container"
import { Plus, RefreshCw } from "lucide-react"

import {
  addOffboardingDocument,
  approveOffboardingRequest,
  cancelOffboardingRequest,
  completeOffboardingRequest,
  createOffboardingClearance,
  createOffboardingRequest,
  createOffboardingTask,
  createOffboardingWorkflow,
  createOffboardingWorkflowStep,
  deleteOffboardingWorkflow,
  getOffboardingApprovals,
  getOffboardingAuditLogs,
  getOffboardingProgress,
  listBranches,
  listDepartments,
  listEmployees,
  listOffboardingDocuments,
  listOffboardingRequests,
  listOffboardingWorkflows,
  rejectOffboardingRequest,
  submitOffboardingRequest,
  type AdminRecord,
} from "@/lib/admin-api"
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
import { DatePickerPresets } from "@/components/ui/date-picker-presets"

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

type Tab = "requests" | "workflows"

export function OffboardingView() {
  const [tab, setTab] = React.useState<Tab>("requests")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])

  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])

  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [requestSheetOpen, setRequestSheetOpen] = React.useState(false)
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState("")

  const [requestDetailsOpen, setRequestDetailsOpen] = React.useState(false)
  const [clearanceDialogOpen, setClearanceDialogOpen] = React.useState(false)
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

  const [taskForm, setTaskForm] = React.useState({
    request_id: "",
    title: "",
    description: "",
    task_type: "hr",
    priority: "medium",
    assigned_to_company_user_id: "",
    due_date: "",
  })

  const [clearanceForm, setClearanceForm] = React.useState({
    request_id: "",
    clearance_type: "laptop",
    status: "pending",
    remarks: "",
  })

  const [documentForm, setDocumentForm] = React.useState({
    request_id: "",
    title: "",
    description: "",
    file_name: "",
    original_file_name: "",
    file_path: "",
    document_type: "",
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

  const reloadAll = React.useCallback(async () => {
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
      const [
        employeesResult,
        branchesResult,
        departmentsResult,
        requestsResult,
        workflowsResult,
      ] = await Promise.all([
        listEmployees(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listOffboardingRequests(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listOffboardingWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      ])
      setEmployees(employeesResult.rows)
      setBranches(branchesResult.rows)
      setDepartments(departmentsResult.rows)
      setRequests(requestsResult.rows)
      setWorkflows(workflowsResult.rows)
    } catch (errorObject) {
      const msg = errorObject instanceof Error ? errorObject.message : "Failed to load offboarding data."
      setError(msg)
      showErrorAlert(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  async function submitRequestForm() {
    const token = readStoredToken()
    if (!token) return false
    if (!requestForm.employee_id || !requestForm.title.trim() || !requestForm.reason.trim() || !requestForm.last_working_date) {
      showErrorAlert("Employee, title, reason and last working date are required.")
      return false
    }
    setSaving(true)
    try {
      await createOffboardingRequest(token, {
        employee_id: Number(requestForm.employee_id),
        branch_id: requestForm.branch_id ? Number(requestForm.branch_id) : undefined,
        department_id: requestForm.department_id ? Number(requestForm.department_id) : undefined,
        workflow_id: requestForm.workflow_id ? Number(requestForm.workflow_id) : undefined,
        title: requestForm.title.trim(),
        description: requestForm.description.trim(),
        offboarding_type: requestForm.offboarding_type,
        reason: requestForm.reason.trim(),
        notice_date: requestForm.notice_date || undefined,
        last_working_date: requestForm.last_working_date,
        submit: requestForm.submit === "true",
        metadata: {},
      })
      showSuccessAlert("Offboarding request created.")
      await reloadAll()
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
      const [approvals, audit, docs, progress] = await Promise.all([
        getOffboardingApprovals(token, id),
        getOffboardingAuditLogs(token, id),
        listOffboardingDocuments(token, id),
        getOffboardingProgress(token, id),
      ])
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

  async function runRequestAction(row: AdminRecord, action: "submit" | "approve" | "reject" | "cancel" | "complete") {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) return
    setSaving(true)
    try {
      if (action === "submit") await submitOffboardingRequest(token, id, { workflow_id: readNumber(row, ["workflow_id"]) ?? undefined })
      if (action === "approve") await approveOffboardingRequest(token, id, { approve: true, comments: "Approved" })
      if (action === "reject") await rejectOffboardingRequest(token, id, { comments: "Rejected" })
      if (action === "cancel") await cancelOffboardingRequest(token, id, { reason: "Cancelled by admin" })
      if (action === "complete") await completeOffboardingRequest(token, id)
      showSuccessAlert(`Request ${action}d successfully.`)
      await reloadAll()
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Action failed.")
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
      await reloadAll()
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create workflow.")
    } finally {
      setSaving(false)
    }
  }

  async function submitWorkflowStepForm() {
    const token = readStoredToken()
    if (!token || !selectedWorkflowId || !stepForm.step_name.trim() || !stepForm.task_title.trim()) return
    setSaving(true)
    try {
      await createOffboardingWorkflowStep(token, selectedWorkflowId, {
        approval_level: Number(stepForm.approval_level),
        step_name: stepForm.step_name.trim(),
        task_title: stepForm.task_title.trim(),
        task_description: stepForm.task_description.trim(),
        task_type: stepForm.task_type,
        approver_type: stepForm.approver_type,
        role_id: stepForm.role_id ? Number(stepForm.role_id) : undefined,
        position_id: stepForm.position_id ? Number(stepForm.position_id) : undefined,
        company_user_id: stepForm.company_user_id ? Number(stepForm.company_user_id) : undefined,
        assigned_branch_id: stepForm.assigned_branch_id ? Number(stepForm.assigned_branch_id) : undefined,
        assigned_department_id: stepForm.assigned_department_id ? Number(stepForm.assigned_department_id) : undefined,
        action_type: stepForm.action_type,
        is_required: stepForm.is_required === "true",
        expected_duration_days: Number(stepForm.expected_duration_days),
      })
      showSuccessAlert("Workflow step added.")
      await reloadAll()
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to add workflow step.")
    } finally {
      setSaving(false)
    }
  }

  async function submitTaskForm() {
    const token = readStoredToken()
    if (!token) return
    if (!taskForm.request_id) {
      showErrorAlert("Please select a request before adding a task.")
      return
    }
    if (!taskForm.title.trim()) {
      showErrorAlert("Task title is required.")
      return
    }
    setSaving(true)
    try {
      await createOffboardingTask(token, taskForm.request_id, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        task_type: taskForm.task_type,
        priority: taskForm.priority,
        assigned_to_company_user_id: taskForm.assigned_to_company_user_id ? Number(taskForm.assigned_to_company_user_id) : undefined,
        due_date: taskForm.due_date || undefined,
        metadata: {},
      })
      showSuccessAlert("Task created.")
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to create task.")
    } finally {
      setSaving(false)
    }
  }

  async function submitClearanceForm() {
    const token = readStoredToken()
    if (!token) return
    if (!clearanceForm.request_id) {
      showErrorAlert("Please select a request before adding a clearance.")
      return
    }
    setSaving(true)
    try {
      await createOffboardingClearance(token, clearanceForm.request_id, {
        clearance_type: clearanceForm.clearance_type,
        status: clearanceForm.status,
        remarks: clearanceForm.remarks,
      })
      showSuccessAlert("Clearance added.")
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to add clearance.")
    } finally {
      setSaving(false)
    }
  }

  async function submitDocumentForm() {
    const token = readStoredToken()
    if (!token) return
    if (!documentForm.request_id) {
      showErrorAlert("Please select a request before adding a document.")
      return
    }
    if (!documentForm.title.trim()) {
      showErrorAlert("Document title is required.")
      return
    }
    if (!documentForm.file_path.trim()) {
      showErrorAlert("File path is required.")
      return
    }
    setSaving(true)
    try {
      await addOffboardingDocument(token, documentForm.request_id, {
        title: documentForm.title,
        description: documentForm.description,
        file_name: documentForm.file_name,
        original_file_name: documentForm.original_file_name,
        file_path: documentForm.file_path,
        document_type: documentForm.document_type,
        mime_type: "application/octet-stream",
        file_extension: "bin",
        file_size: "0",
      })
      showSuccessAlert("Document added.")
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to add document.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className={tab === "requests" ? "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" : "rounded-md border border-slate-300 px-3 py-2 text-sm"} onClick={() => setTab("requests")}>Requests</button>
        <button type="button" className={tab === "workflows" ? "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" : "rounded-md border border-slate-300 px-3 py-2 text-sm"} onClick={() => setTab("workflows")}>Workflows</button>
        <button type="button" className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-sm" onClick={() => void reloadAll()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      {tab === "requests" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={() => setRequestSheetOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Create Offboarding
            </button>
          </div>

          <div className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-3">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={taskForm.request_id} onChange={(event) => { const v = event.target.value; setTaskForm((prev) => ({ ...prev, request_id: v })); setClearanceForm((prev) => ({ ...prev, request_id: v })); setDocumentForm((prev) => ({ ...prev, request_id: v })) }}>
              <option value="">Select request</option>
              {requests.map((row, index) => {
                const id = readNumber(row, ["id"])
                if (id === null) return null
                return <option key={`off-req-${id}-${index}`} value={String(id)}>{requestLabel(row)}</option>
              })}
            </select>
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Task title" value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} />
            <button
              type="button"
              className="rounded-md border border-slate-900 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void submitTaskForm()}
              disabled={saving}
              title="Add task"
            >
              Add Task
            </button>
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Document title" value={documentForm.title} onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))} />
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="File path" value={documentForm.file_path} onChange={(event) => setDocumentForm((prev) => ({ ...prev, file_path: event.target.value, file_name: event.target.value, original_file_name: event.target.value }))} />
            <button
              type="button"
              className="rounded-md border border-slate-900 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void submitDocumentForm()}
              disabled={saving}
              title="Add document"
            >
              Add Document
            </button>
            <div className="md:col-span-3">
              <button
                type="button"
                className="rounded-md border border-slate-900 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setClearanceDialogOpen(true)}
                disabled={saving}
                title="Add clearance"
              >
                Add Clearance
              </button>
            </div>
          </div>

          <TableScrollContainer>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50/90"><tr><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Title</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Employee</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Type</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Status</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Last Working</th><th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Actions</th></tr></thead>
              <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
                {requests.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  return (
                    <tr key={`off-row-${id ?? index}`}>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["title"])}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["employee_name", "employee_full_name", "employee_id"])}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["offboarding_type"])}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["status"])}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["last_working_date"])}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => void openRequestDetails(row)}>View</button>
                          <button type="button" className="rounded-md border border-blue-300 px-2 py-1 text-xs text-blue-700" onClick={() => void runRequestAction(row, "submit")}>Submit</button>
                          <button type="button" className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700" onClick={() => void runRequestAction(row, "approve")}>Approve</button>
                          <button type="button" className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700" onClick={() => void runRequestAction(row, "reject")}>Reject</button>
                          <button type="button" className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => void runRequestAction(row, "cancel")}>Cancel</button>
                          <button type="button" className="rounded-md border border-slate-300 px-2 py-1 text-xs" onClick={() => void runRequestAction(row, "complete")}>Complete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      ) : null}

      <Sheet open={requestSheetOpen} onOpenChange={setRequestSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Create Offboarding Request</SheetTitle>
            <SheetDescription>Fill details, choose workflow if needed, then create as draft or submitted request.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-3 px-4 pb-4 md:grid-cols-2">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.employee_id} onChange={(event) => setRequestForm((prev) => ({ ...prev, employee_id: event.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((employee, index) => {
                const id = readNumber(employee, ["id", "employee_id", "user_id"])
                if (id === null) return null
                return <option key={`off-emp-${id}-${index}`} value={String(id)}>{employeeLabel(employee)}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.offboarding_type} onChange={(event) => setRequestForm((prev) => ({ ...prev, offboarding_type: event.target.value }))}>
              <option value="resignation">resignation</option><option value="termination">termination</option><option value="retirement">retirement</option><option value="contract_end">contract_end</option><option value="absconded">absconded</option><option value="deceased">deceased</option><option value="layoff">layoff</option><option value="other">other</option>
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.submit} onChange={(event) => setRequestForm((prev) => ({ ...prev, submit: event.target.value }))}>
              <option value="false">Save draft</option><option value="true">Submit now</option>
            </select>
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Title" value={requestForm.title} onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))} />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.branch_id} onChange={(event) => setRequestForm((prev) => ({ ...prev, branch_id: event.target.value }))}>
              <option value="">Branch (optional)</option>
              {branches.map((row, index) => {
                const id = readNumber(row, ["id", "branch_id"])
                if (id === null) return null
                return <option key={`off-branch-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.department_id} onChange={(event) => setRequestForm((prev) => ({ ...prev, department_id: event.target.value }))}>
              <option value="">Department (optional)</option>
              {departments.map((row, index) => {
                const id = readNumber(row, ["id", "department_id"])
                if (id === null) return null
                return <option key={`off-dept-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={requestForm.workflow_id} onChange={(event) => setRequestForm((prev) => ({ ...prev, workflow_id: event.target.value }))}>
              <option value="">Workflow (optional)</option>
              {workflows.map((row, index) => {
                const id = readNumber(row, ["id", "workflow_id"])
                if (id === null) return null
                return <option key={`off-wf-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option>
              })}
            </select>
            <DatePickerPresets value={requestForm.notice_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, notice_date: value }))} placeholder="Notice date" />
            <DatePickerPresets value={requestForm.last_working_date} onChange={(value) => setRequestForm((prev) => ({ ...prev, last_working_date: value }))} placeholder="Last working date" />
            <textarea
              className="min-h-20 resize-none overflow-hidden rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Reason"
              value={requestForm.reason}
              onInput={autoResizeTextarea}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))}
            />
            <textarea
              className="min-h-20 resize-none overflow-hidden rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Description"
              value={requestForm.description}
              onInput={autoResizeTextarea}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <SheetFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setRequestSheetOpen(false)}>Cancel</button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              disabled={saving}
              onClick={async () => {
                const created = await submitRequestForm()
                if (created) {
                  setRequestSheetOpen(false)
                }
              }}
            >
              {saving ? "Saving..." : "Create Offboarding"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {tab === "workflows" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setWorkflowSheetOpen(true)}><Plus className="h-4 w-4" />Create Workflow</button>
          </div>

          <div className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-4">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={selectedWorkflowId} onChange={(event) => setSelectedWorkflowId(event.target.value)}>
              <option value="">Select workflow for steps</option>
              {workflows.map((row, index) => {
                const id = readNumber(row, ["id", "workflow_id"])
                if (id === null) return null
                return <option key={`owf-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option>
              })}
            </select>
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Step name" value={stepForm.step_name} onChange={(event) => setStepForm((prev) => ({ ...prev, step_name: event.target.value }))} />
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Task title" value={stepForm.task_title} onChange={(event) => setStepForm((prev) => ({ ...prev, task_title: event.target.value }))} />
            <button type="button" className="rounded-md border border-slate-900 px-3 py-2 text-sm" onClick={() => void submitWorkflowStepForm()} disabled={saving}>Add Step</button>
          </div>

          <TableScrollContainer>
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50/90"><tr><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Workflow</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Status</th><th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Default</th><th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Actions</th></tr></thead>
              <tbody className="[&_tr:nth-child(odd)]:bg-slate-50/35 [&_tr]:border-t [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/80">
                {workflows.map((row, index) => {
                  const id = readNumber(row, ["id", "workflow_id"])
                  return (
                    <tr key={`off-wf-row-${id ?? index}`}>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["name", "title"])}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{readString(row, ["status"])}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 whitespace-nowrap">{String(Boolean(row.is_default))}</td>
                      <td className="px-4 py-4 text-right">
                        <button type="button" className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={async () => {
                          const token = readStoredToken()
                          if (!token || id === null) return
                          try {
                            await deleteOffboardingWorkflow(token, id)
                            showSuccessAlert("Workflow deleted.")
                            await reloadAll()
                          } catch (errorObject) {
                            showErrorAlert(errorObject instanceof Error ? errorObject.message : "Failed to delete workflow.")
                          }
                        }}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      ) : null}

      <Sheet open={workflowSheetOpen} onOpenChange={setWorkflowSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full sm:data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Create Offboarding Workflow</SheetTitle>
            <SheetDescription>Configure the workflow and save it. Add detailed steps from the Workflows tab.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-3 px-4 pb-4 md:grid-cols-2">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Workflow name" value={workflowForm.name} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))} />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowForm.status} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, status: event.target.value }))}><option value="active">active</option><option value="inactive">inactive</option></select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowForm.is_default} onChange={(event) => setWorkflowForm((prev) => ({ ...prev, is_default: event.target.value }))}><option value="false">Not default</option><option value="true">Default</option></select>
            <textarea
              className="min-h-20 resize-none overflow-hidden rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Description"
              value={workflowForm.description}
              onInput={autoResizeTextarea}
              onChange={(event) => setWorkflowForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <SheetFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setWorkflowSheetOpen(false)}>Cancel</button>
            <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" disabled={saving} onClick={() => void submitWorkflowForm()}>{saving ? "Saving..." : "Create Workflow"}</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={requestDetailsOpen} onOpenChange={setRequestDetailsOpen}>
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedRequest ? readString(selectedRequest, ["title"]) : "Request details"}</DialogTitle>
            <DialogDescription>Approvals, progress, documents and audit trail.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 p-3 text-sm">Progress: {requestProgress ? JSON.stringify(requestProgress) : "-"}</div>
            <div className="rounded-md border border-slate-200 p-3 text-sm">Approvals: {requestApprovals.length}</div>
            <div className="rounded-md border border-slate-200 p-3 text-sm">Documents: {requestDocuments.length}</div>
            <div className="rounded-md border border-slate-200 p-3 text-sm">Audit logs: {requestAuditLogs.length}</div>
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setRequestDetailsOpen(false)}>Close</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={clearanceDialogOpen} onOpenChange={setClearanceDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Clearance</DialogTitle>
            <DialogDescription>Select a request and submit clearance details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={clearanceForm.request_id} onChange={(event) => setClearanceForm((prev) => ({ ...prev, request_id: event.target.value }))}>
              <option value="">Select request</option>
              {requests.map((row, index) => {
                const id = readNumber(row, ["id"])
                if (id === null) return null
                return <option key={`off-clr-req-${id}-${index}`} value={String(id)}>{requestLabel(row)}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={clearanceForm.clearance_type} onChange={(event) => setClearanceForm((prev) => ({ ...prev, clearance_type: event.target.value }))}><option value="laptop">laptop</option><option value="id_card">id_card</option><option value="email">email</option><option value="system_access">system_access</option><option value="vehicle">vehicle</option><option value="documents">documents</option><option value="finance">finance</option><option value="other">other</option></select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={clearanceForm.status} onChange={(event) => setClearanceForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="pending">pending</option>
              <option value="cleared">cleared</option>
              <option value="not_cleared">not_cleared</option>
            </select>
            <textarea
              className="min-h-20 resize-none overflow-hidden rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Clearance remarks"
              value={clearanceForm.remarks}
              onInput={autoResizeTextarea}
              onChange={(event) => setClearanceForm((prev) => ({ ...prev, remarks: event.target.value }))}
            />
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setClearanceDialogOpen(false)}>Cancel</button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              disabled={saving}
              onClick={async () => {
                await submitClearanceForm()
                setClearanceDialogOpen(false)
              }}
            >
              Add Clearance
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
