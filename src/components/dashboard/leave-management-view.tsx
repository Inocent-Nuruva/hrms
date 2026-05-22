"use client"

import * as React from "react"
import { Check, Copy, FileText, Pencil, Plus, Trash2, Upload, X } from "lucide-react"

import {
  addLeaveRequestDocument,
  adjustLeaveBalance,
  cancelLeaveRequest,
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
  getLeaveWorkflow,
  leaveRequestApprovalAction,
  listBranches,
  listDepartments,
  listEmployees,
  listLeaveBalances,
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
  patchLeaveType,
  patchLeaveWorkflow,
  patchLeaveWorkflowStep,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { Switch } from "@/components/ui/switch"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { showErrorAlert } from "@/lib/error-alert"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type LeaveTab = "types" | "requests" | "balances" | "holidays" | "policies" | "workflows"
type LeaveManagementViewProps = {
  activeTab?: LeaveTab
  showTabButtons?: boolean
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

export function LeaveManagementView({
  activeTab = "types",
  showTabButtons = true,
}: LeaveManagementViewProps) {
  const [tab, setTab] = React.useState<LeaveTab>(activeTab)
  const [types, setTypes] = React.useState<AdminRecord[]>([])
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [requestSearch, setRequestSearch] = React.useState("")
  const [requestStatusFilter, setRequestStatusFilter] = React.useState("all")
  const [balances, setBalances] = React.useState<AdminRecord[]>([])
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
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false)
  const [balanceDialogOpen, setBalanceDialogOpen] = React.useState(false)
  const [holidayDialogOpen, setHolidayDialogOpen] = React.useState(false)
  const [policySheetOpen, setPolicySheetOpen] = React.useState(false)
  const [editingPolicyId, setEditingPolicyId] = React.useState<number | null>(null)
  const [policyPreviewOpen, setPolicyPreviewOpen] = React.useState(false)
  const [selectedPolicyRow, setSelectedPolicyRow] = React.useState<AdminRecord | null>(null)
  const [workflowSteps, setWorkflowSteps] = React.useState<AdminRecord[]>([])
  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<number | null>(null)
  const [editingWorkflowStepId, setEditingWorkflowStepId] = React.useState<number | null>(null)
  const [cancelReason, setCancelReason] = React.useState("Cancelled by admin")
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState("")
  const [requestDocumentForm, setRequestDocumentForm] = React.useState({
    request_id: "",
    file_name: "",
    file_type: "",
    file_url: "",
  })
  const [requestDocumentFile, setRequestDocumentFile] = React.useState<File | null>(null)
  const [copiedLeaveId, setCopiedLeaveId] = React.useState("")

  const [typeForm, setTypeForm] = React.useState({
    name: "",
    code: "",
    description: "",
    status: "active",
    is_paid: "true",
    requires_attachment: "false",
  })

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

  const reloadAll = React.useCallback(async () => {
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
      const [
        typesResult,
        requestsResult,
        balancesResult,
        holidaysResult,
        employeesResult,
        policiesResult,
        workflowsResult,
        departmentsResult,
        positionsResult,
        branchesResult,
        rolesResult,
      ] = await Promise.all([
        listLeaveTypes(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveRequests(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveBalances(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveHolidays(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listEmployees(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeavePolicies(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listLeaveWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listPositions(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listResource("roles", token).then((rows) => ({
          rows,
          page: 1,
          limit: 100,
          total: rows.length,
          totalPages: 1,
        })),
      ])
      setTypes(typesResult.rows)
      setRequests(requestsResult.rows)
      setBalances(balancesResult.rows)
      setHolidays(holidaysResult.rows)
      setEmployees(employeesResult.rows)
      setPolicies(policiesResult.rows)
      setWorkflows(workflowsResult.rows)
      setDepartments(departmentsResult.rows)
      setPositions(positionsResult.rows)
      setBranches(branchesResult.rows)
      setRoles(rolesResult.rows)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load leave management data."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  React.useEffect(() => {
    setTab(activeTab)
  }, [activeTab])

  const employeeLabel = (employeeId: number | null) => {
    if (employeeId === null) {
      return "-"
    }
    const match = employees.find((row) => readNumber(row, ["id", "employee_id", "user_id"]) === employeeId)
    if (!match) {
      return `#${employeeId}`
    }
    const fullName = readString(match, ["full_name", "name"])
    if (fullName !== "-") {
      return fullName
    }
    return [readString(match, ["first_name"]), readString(match, ["last_name"])]
      .filter((part) => part !== "-")
      .join(" ")
  }

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

  const leaveRequestOptions: SearchableOption[] = requests
    .map((row) => {
      const id = readNumber(row, ["id"])
      if (id === null) return null
      return { value: String(id), label: leaveRequestLabel(row) }
    })
    .filter((option): option is SearchableOption => Boolean(option))

  async function submitTypeForm() {
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
      await createLeaveType(token, {
        name: typeForm.name.trim(),
        code: typeForm.code.trim(),
        description: typeForm.description.trim(),
        status: typeForm.status,
        is_paid: typeForm.is_paid === "true",
        requires_attachment: typeForm.requires_attachment === "true",
      })
      setTypeForm({
        name: "",
        code: "",
        description: "",
        status: "active",
        is_paid: "true",
        requires_attachment: "false",
      })
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave type."
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
      await createLeaveRequest(token, {
        employee_id: Number(requestForm.employee_id),
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason.trim(),
        submit: requestForm.submit === "true",
      })
      setRequestForm({
        employee_id: "",
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        submit: "true",
      })
      setRequestDialogOpen(false)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave request."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
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
      setBalanceDialogOpen(false)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to adjust leave balance."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
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
      await reloadAll()
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
      await reloadAll()
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
      await reloadAll()
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
      await reloadAll()
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
  }

  async function submitWorkflowForm() {
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
      if (editingWorkflowId === null) {
        await createLeaveWorkflow(token, {
          name: workflowForm.name.trim(),
          leave_type_id: Number(workflowForm.leave_type_id),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
          steps: [],
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
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create leave workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function openCreateWorkflowSheet() {
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
  }

  async function openEditWorkflowSheet(row: AdminRecord) {
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
    if (!token || !workflowId) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const stepPayload = {
        approval_level: Number(workflowStepForm.approval_level),
        approver_type: workflowStepForm.approver_type,
        action_type: workflowStepForm.action_type,
        role_id: workflowStepForm.role_id ? Number(workflowStepForm.role_id) : undefined,
        position_id: workflowStepForm.position_id ? Number(workflowStepForm.position_id) : undefined,
        company_user_id: workflowStepForm.company_user_id ? Number(workflowStepForm.company_user_id) : undefined,
        assigned_branch_id: workflowStepForm.assigned_branch_id ? Number(workflowStepForm.assigned_branch_id) : undefined,
        assigned_department_id: workflowStepForm.assigned_department_id ? Number(workflowStepForm.assigned_department_id) : undefined,
        is_required: workflowStepForm.is_required === "true",
      }
      if (editingWorkflowStepId === null) {
        await createLeaveWorkflowStep(token, workflowId, stepPayload)
      } else {
        await patchLeaveWorkflowStep(token, workflowId, editingWorkflowStepId, stepPayload)
      }
      setWorkflowStepForm((prev) => ({ ...prev, approval_level: String((Number(prev.approval_level) || 0) + 1) }))
      setEditingWorkflowStepId(null)
      setStepDialogOpen(false)
      await loadWorkflowSteps(workflowId)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create workflow step."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  function openCreateStepDialog() {
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
  }

  function openEditStepDialog(row: AdminRecord) {
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
      await reloadAll()
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
      await reloadAll()
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
    if (!token || !selectedWorkflowId || stepId === null) {
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

  async function submitRequestDocument() {
    const token = readStoredToken()
    if (!token) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      const finalFileName = requestDocumentForm.file_name.trim() || requestDocumentFile?.name || ""
      const extensionFromName = finalFileName.includes(".") ? finalFileName.split(".").pop() ?? "" : ""
      const finalFileType =
        requestDocumentForm.file_type.trim() ||
        extensionFromName ||
        requestDocumentFile?.type ||
        ""
      const finalFileUrl = requestDocumentForm.file_url.trim()

      if (!finalFileName || !finalFileType || !finalFileUrl) {
        const message = "Please select a file so name, type and URL can be filled automatically."
        setError(message)
        showErrorAlert(message)
        setSaving(false)
        return
      }

      await addLeaveRequestDocument(token, Number(requestDocumentForm.request_id), {
        file_name: finalFileName,
        file_type: finalFileType,
        file_url: finalFileUrl,
      })
      setRequestDocumentForm({ request_id: "", file_name: "", file_type: "", file_url: "" })
      setRequestDocumentFile(null)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to attach leave document."
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
      await reloadAll()
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
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete leave type."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function approveRequest(row: AdminRecord, approve: boolean) {
    const token = readStoredToken()
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await leaveRequestApprovalAction(token, id, {
        approve,
        comments: approve ? "Approved from dashboard" : "Rejected from dashboard",
      })
      await reloadAll()
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
    setSaving(true)
    try {
      await cancelLeaveRequest(token, id, reason.trim())
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to cancel leave request."
      setError(message)
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
      await reloadAll()
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
    const id = readNumber(row, ["id"])
    if (!token || id === null) {
      return
    }
    setSaving(true)
    try {
      await deleteLeaveHoliday(token, id)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete holiday."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-5 shadow-sm lg:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {showTabButtons ? ["types", "requests", "balances", "holidays", "policies", "workflows"].map((entry) => {
          const key = entry as LeaveTab
          return (
            <button
              key={entry}
              type="button"
              className={
                tab === key
                  ? "rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                  : "rounded-md border border-slate-300 px-3 py-2 text-sm"
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
        }) : null}
        <button
          type="button"
          className={`${showTabButtons ? "ml-auto" : ""} rounded-md border border-slate-300 px-3 py-2 text-sm`}
          onClick={() => void reloadAll()}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

      {tab === "types" ? (
        <div className="space-y-4">
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
            <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3" placeholder="Description" value={typeForm.description} onChange={(event) => setTypeForm((prev) => ({ ...prev, description: event.target.value }))} />
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white md:col-span-3" disabled={saving} onClick={() => void submitTypeForm()}>
              Add Leave Type
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <div className="grid gap-3 border-b border-slate-200 p-3 md:grid-cols-2">
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Search requests"
                value={requestSearch}
                onChange={(event) => setRequestSearch(event.target.value)}
              />
              <select
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                value={requestStatusFilter}
                onChange={(event) => setRequestStatusFilter(event.target.value)}
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
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Code</th>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Paid</th>
                  <th className="px-4 py-3 text-right text-[0.82rem] font-semibold uppercase tracking-[0.11em] text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {types.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  const isActive = readString(row, ["status"]) === "active"
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-4 py-3">{readString(row, ["name"])}</td>
                      <td className="px-4 py-3">{readString(row, ["code"])}</td>
                      <td className="px-4 py-3">
                        <span className={isActive ? "inline-flex rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white" : "inline-flex rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"}>
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{readBoolean(row, ["is_paid"]) ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Switch checked={isActive} onCheckedChange={() => void toggleTypeStatus(row)} aria-label="Toggle Status" />
                          <button
                            type="button"
                            className="group rounded-md border border-rose-200 p-2 text-rose-600 transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:bg-rose-50 hover:shadow-sm active:scale-95"
                            onClick={() => setPendingTypeDelete(row)}
                            aria-label="Delete leave type"
                            title="Delete leave type"
                          >
                            <Trash2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={() => setRequestDialogOpen(true)}
            >
              Create Leave Request
            </button>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Attach Supporting Document
              </CardTitle>
              <CardDescription>Select request, upload one document, then attach it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <SearchableSelect
                id="leave-request-document-search"
                value={requestDocumentForm.request_id}
                options={leaveRequestOptions}
                placeholder="Search request"
                onValueChange={(value) => setRequestDocumentForm((prev) => ({ ...prev, request_id: value }))}
              />

              <label
                htmlFor="leave-request-document-file"
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/50 px-4 py-5 text-center transition-colors hover:bg-slate-100/70"
              >
                <div className="rounded-full bg-slate-100 p-2">
                  <Upload className="h-5 w-5 text-slate-700" />
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {requestDocumentFile ? "Change file" : "Drop file here or click to browse"}
                </p>
                <p className="text-xs text-slate-500">PDF, DOC, DOCX, images and common docs</p>
                <input
                  id="leave-request-document-file"
                  type="file"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    if (!file) {
                      setRequestDocumentFile(null)
                      setRequestDocumentForm((prev) => ({ ...prev, file_name: "", file_type: "", file_url: "" }))
                      return
                    }
                    const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "") : ""
                    const generatedUrl = URL.createObjectURL(file)
                    setRequestDocumentFile(file)
                    setRequestDocumentForm((prev) => ({
                      ...prev,
                      file_name: file.name,
                      file_type: extension || file.type || "",
                      file_url: generatedUrl,
                    }))
                  }}
                />
              </label>

              {requestDocumentFile ? (
                <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{requestDocumentForm.file_name}</p>
                    <p className="text-xs text-slate-500">{requestDocumentForm.file_type || "unknown type"}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => {
                      setRequestDocumentFile(null)
                      setRequestDocumentForm((prev) => ({ ...prev, file_name: "", file_type: "", file_url: "" }))
                    }}
                    aria-label="Remove selected file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <button
                type="button"
                className="w-full rounded-md border border-slate-900 px-3 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || !requestDocumentForm.request_id || !requestDocumentFile}
                onClick={() => void submitRequestDocument()}
              >
                Attach Supporting Document
              </button>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Leave ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Leave Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Start</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">End</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRequests.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  const status = readString(row, ["status"]).toLowerCase()
                  const isTerminal = status === "rejected" || status === "cancelled" || status === "completed"
                  const showReviewActions = !isTerminal && status !== "approved"
                  const showCancelAction = !isTerminal
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-3 py-2">
                        <div className="inline-flex items-center gap-2">
                          <span>{leaveRequestLabel(row)}</span>
                          {leaveRequestLabel(row) !== "-" ? (
                            <button
                              type="button"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-600 transition hover:bg-blue-100 hover:text-blue-700"
                              aria-label="Copy leave ID"
                              title="Copy leave ID"
                              onClick={async () => {
                                const value = leaveRequestLabel(row)
                                try {
                                  await navigator.clipboard.writeText(value)
                                  setCopiedLeaveId(value)
                                  window.setTimeout(() => setCopiedLeaveId(""), 1200)
                                } catch {
                                  setError("Unable to copy leave ID.")
                                }
                              }}
                            >
                              {copiedLeaveId === leaveRequestLabel(row) ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">{employeeLabel(readNumber(row, ["employee_id"]))}</td>
                      <td className="px-3 py-2">{readString(row, ["leave_type_name", "leave_type", "leave_type_id"])}</td>
                      <td className="px-3 py-2">{readString(row, ["start_date"])}</td>
                      <td className="px-3 py-2">{readString(row, ["end_date"])}</td>
                      <td className="px-3 py-2">{readString(row, ["status"])}</td>
                      <td className="px-3 py-2 text-right">
                        {isTerminal ? (
                          <span className="text-xs text-slate-500">No actions</span>
                        ) : (
                          <div className="inline-flex gap-2">
                            {showReviewActions ? (
                              <>
                                <button type="button" className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700" onClick={() => void approveRequest(row, true)}>Approve</button>
                                <button type="button" className="rounded-md border border-amber-300 px-2 py-1 text-xs text-amber-700" onClick={() => void approveRequest(row, false)}>Reject</button>
                              </>
                            ) : null}
                            {showCancelAction ? (
                              <button
                                type="button"
                                className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700"
                                onClick={() => {
                                  setPendingRequestCancel(row)
                                  setCancelReason("Cancelled by admin")
                                }}
                              >
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
            <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-3" placeholder="Reason" value={requestForm.reason} onChange={(event) => setRequestForm((prev) => ({ ...prev, reason: event.target.value }))} />
          </div>
          <DialogFooter>
            <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setRequestDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" disabled={saving} onClick={() => void submitRequestForm()}>
              {saving ? "Saving..." : "Create Leave Request"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {tab === "balances" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.employee_id} onChange={(event) => setBalanceForm((prev) => ({ ...prev, employee_id: event.target.value }))}>
              <option value="">Select employee</option>
              {employees.map((employee) => {
                const id = readNumber(employee, ["id", "employee_id", "user_id"])
                if (id === null) return null
                return <option key={id} value={String(id)}>{employeeLabel(id)}</option>
              })}
            </select>
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={balanceForm.leave_type_id} onChange={(event) => setBalanceForm((prev) => ({ ...prev, leave_type_id: event.target.value }))}>
              <option value="">Select leave type</option>
              {types.map((type) => {
                const id = readNumber(type, ["id"])
                if (id === null) return null
                return <option key={id} value={String(id)}>{readString(type, ["name"])}</option>
              })}
            </select>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Fiscal year to apply this balance adjustment (for example 2026).</p>
              <input className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Fiscal year" value={balanceForm.fiscal_year} onChange={(event) => setBalanceForm((prev) => ({ ...prev, fiscal_year: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Total leave granted for this year.</p>
              <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Allocated days" value={balanceForm.allocated_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, allocated_days: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Unused days moved from the previous year.</p>
              <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Carried forward" value={balanceForm.carried_forward_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, carried_forward_days: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Days removed because they are no longer valid.</p>
              <input type="number" min={0} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" placeholder="Expired days" value={balanceForm.expired_days} onChange={(event) => setBalanceForm((prev) => ({ ...prev, expired_days: event.target.value }))} />
            </div>
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white md:col-span-3" disabled={saving} onClick={() => void submitBalanceAdjustment()}>
              Adjust Leave Balance
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Fiscal Year</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Allocated</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Used</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {balances.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-3 py-2">{employeeLabel(readNumber(row, ["employee_id"]))}</td>
                      <td className="px-3 py-2">{readString(row, ["leave_type_name", "leave_type", "leave_type_id"])}</td>
                      <td className="px-3 py-2">{readString(row, ["fiscal_year"])}</td>
                      <td className="px-3 py-2">{String(readNumber(row, ["allocated_days"]) ?? "-")}</td>
                      <td className="px-3 py-2">{String(readNumber(row, ["used_days"]) ?? "-")}</td>
                      <td className="px-3 py-2">{String(readNumber(row, ["remaining_days"]) ?? "-")}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "holidays" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Holiday name" value={holidayForm.name} onChange={(event) => setHolidayForm((prev) => ({ ...prev, name: event.target.value }))} />
            <DatePickerPresets value={holidayForm.holiday_date} onChange={(value) => setHolidayForm((prev) => ({ ...prev, holiday_date: value }))} placeholder="Holiday date" />
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={holidayForm.is_recurring} onChange={(event) => setHolidayForm((prev) => ({ ...prev, is_recurring: event.target.value }))}>
              <option value="false">One-time</option>
              <option value="true">Recurring</option>
            </select>
            <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white md:col-span-3" disabled={saving} onClick={() => void submitHolidayForm()}>
              Add Holiday
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Recurring</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {holidays.map((row, index) => {
                  const id = readNumber(row, ["id"])
                  return (
                    <tr key={String(id ?? index)}>
                      <td className="px-3 py-2">{readString(row, ["name"])}</td>
                      <td className="px-3 py-2">{readString(row, ["holiday_date"])}</td>
                      <td className="px-3 py-2">
                        <Switch
                          checked={readBoolean(row, ["is_recurring"])}
                          onCheckedChange={() => void toggleHolidayRecurring(row)}
                          aria-label="Toggle recurring holiday"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-rose-200 p-2 text-rose-600 transition-transform duration-200 hover:scale-110 hover:bg-rose-50 active:scale-95"
                            onClick={() => setPendingHolidayDelete(row)}
                            aria-label="Delete holiday"
                            title="Delete holiday"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "policies" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={openCreatePolicySheet}
            >
              <Plus className="h-4 w-4" />
              Create Policy
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Accrual</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Department</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Position</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {policies.map((row, index) => {
                  const id = readNumber(row, ["id", "policy_id"])
                  return (
                    <tr
                      key={`policy-${id ?? index}`}
                      className="cursor-pointer transition hover:bg-slate-50"
                      onClick={() => openPolicyPreview(row)}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{readString(row, ["name", "title"])}</td>
                      <td className="px-3 py-2">{readString(row, ["status"])}</td>
                      <td className="px-3 py-2">{readString(row, ["accrual_method"])}</td>
                      <td className="px-3 py-2">{optionLabel(departments, readNumber(row, ["applicable_department_id"]), ["name", "title"])}</td>
                      <td className="px-3 py-2">{optionLabel(positions, readNumber(row, ["applicable_position_id"]), ["name", "title"])}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Switch
                            checked={readString(row, ["status"]).toLowerCase() === "active"}
                            onCheckedChange={() => void togglePolicyStatus(row)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Toggle policy status"
                          />
                          <button
                            type="button"
                            className="group rounded-md border border-rose-200 p-2 text-rose-600 transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:bg-rose-50 hover:shadow-sm active:scale-95"
                            onClick={(event) => {
                              event.stopPropagation()
                              setPendingPolicyDelete(row)
                            }}
                            aria-label="Delete policy"
                            title="Delete policy"
                          >
                            <Trash2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
                <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="Description" value={policyForm.description} onChange={(event) => setPolicyForm((prev) => ({ ...prev, description: event.target.value }))} />
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
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
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
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
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
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={openCreateWorkflowSheet}
            >
              <Plus className="h-4 w-4" />
              Create Workflow
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Workflow</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Leave Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Default</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {workflows.map((row, index) => {
                  const id = readNumber(row, ["id", "workflow_id"])
                  return (
                    <tr key={`workflow-${id ?? index}`}>
                      <td className="px-3 py-2">{readString(row, ["name", "title"])}</td>
                      <td className="px-3 py-2">{readString(row, ["leave_type_name", "leave_type", "leave_type_id"])}</td>
                      <td className="px-3 py-2">{readString(row, ["status"])}</td>
                      <td className="px-3 py-2">{readBoolean(row, ["is_default"]) ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={readString(row, ["status"]).toLowerCase() === "active"}
                            onCheckedChange={() => void toggleWorkflowStatus(row)}
                            aria-label="Toggle workflow status"
                          />
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 p-2 text-slate-700 hover:bg-slate-100"
                            onClick={() => void openEditWorkflowSheet(row)}
                            aria-label="Edit workflow"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => setPendingWorkflowDelete(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                    <p className="text-sm text-slate-500">No steps yet. Use Add Workflow Step to create approval flow.</p>
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
                <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled={saving} onClick={() => void submitWorkflowForm()}>
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
              <div className="grid gap-3 md:grid-cols-3">
                <input type="number" min={1} className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="Approval level" value={workflowStepForm.approval_level} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, approval_level: event.target.value }))} />
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.action_type} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, action_type: event.target.value }))}>
                  <option value="recommend">recommend</option><option value="verify">verify</option><option value="approve">approve</option>
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.approver_type} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, approver_type: event.target.value }))}>
                  <option value="role">role</option><option value="position">position</option><option value="company_user">company_user</option>
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.role_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, role_id: event.target.value }))}>
                  <option value="">Role (optional)</option>{roles.map((row, index) => { const id = readNumber(row, ["id", "role_id"]); if (id === null) return null; return <option key={`dlg-role-${id}-${index}`} value={String(id)}>{readString(row, ["display_name", "name"])}</option> })}
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.position_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, position_id: event.target.value }))}>
                  <option value="">Position (optional)</option>{positions.map((row, index) => { const id = readNumber(row, ["id", "position_id"]); if (id === null) return null; return <option key={`dlg-pos-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option> })}
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.company_user_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, company_user_id: event.target.value }))}>
                  <option value="">Company user (optional)</option>{employeeOptions.map((option) => <option key={`dlg-user-${option.value}`} value={option.value}>{option.label}</option>)}
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.assigned_branch_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, assigned_branch_id: event.target.value }))}>
                  <option value="">Assigned branch (optional)</option>{branches.map((row, index) => { const id = readNumber(row, ["id", "branch_id"]); if (id === null) return null; return <option key={`dlg-branch-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option> })}
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.assigned_department_id} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, assigned_department_id: event.target.value }))}>
                  <option value="">Assigned department (optional)</option>{departments.map((row, index) => { const id = readNumber(row, ["id", "department_id"]); if (id === null) return null; return <option key={`dlg-dept-${id}-${index}`} value={String(id)}>{readString(row, ["name", "title"])}</option> })}
                </select>
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" value={workflowStepForm.is_required} onChange={(event) => setWorkflowStepForm((prev) => ({ ...prev, is_required: event.target.value }))}>
                  <option value="true">Required</option><option value="false">Optional</option>
                </select>
              </div>
              <DialogFooter>
                <button type="button" className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => setStepDialogOpen(false)}>Cancel</button>
                <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" disabled={saving} onClick={async () => {
                  const targetWorkflowId = selectedWorkflowId || (editingWorkflowId !== null ? String(editingWorkflowId) : "")
                  if (!targetWorkflowId) {
                    showErrorAlert("Save workflow details first, then add steps.")
                    return
                  }
                  setSelectedWorkflowId(targetWorkflowId)
                  await submitWorkflowStepForm(targetWorkflowId)
                }}>
                  {editingWorkflowStepId === null ? "Add Step" : "Save Step"}
                </button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>

        </div>
      ) : null}

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
            <textarea
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
