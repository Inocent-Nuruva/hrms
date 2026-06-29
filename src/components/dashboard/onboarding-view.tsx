"use client"

import * as React from "react"
import { HorizontalScrollContainer } from "@/components/common/horizontal-scroll-container"
import { Ban, CheckCheck, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"

import {
  approveOnboardingRequest,
  cancelOnboardingRequest,
  completeOnboardingRequest,
  createOnboardingRequest,
  createOnboardingWorkflow,
  deleteOnboardingRequest,
  deleteOnboardingWorkflow,
  getOnboardingAuditLogs,
  getOnboardingProgress,
  getOnboardingRequest,
  getOnboardingWorkflow,
  listAccessControlResources,
  listAttendanceDevices,
  listBranches,
  listDepartments,
  listEmployees,
  listOnboardingRequests,
  listOnboardingWorkflows,
  listPositions,
  listResource,
  listShiftResources,
  listTimetableResources,
  listUsers,
  patchOnboardingWorkflow,
  rejectOnboardingRequest,
  type AdminRecord,
  type OnboardingProvisioning,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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

type OnboardingTab = "requests" | "workflows"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"
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

function rowMatchesRelation(
  row: AdminRecord,
  relationKeys: string[],
  selectedId: number | null
) {
  if (selectedId === null) {
    return true
  }

  let hasRelationKey = false
  for (const key of relationKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      hasRelationKey = true
      const relationId = readNumber(row, [key])
      if (relationId === selectedId) {
        return true
      }
    }
  }

  return !hasRelationKey
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
  | "approve"
  | "reject"
  | "cancel"
  | "complete"
  | "delete"

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

function parseAllowedActions(row: AdminRecord): Set<RequestAction> {
  const picked = new Set<RequestAction>()
  const normalized = (value: unknown) =>
    String(value ?? "")
      .toLowerCase()
      .trim()

  const tryAdd = (value: unknown) => {
    const action = normalized(value)
    if (
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

  return picked
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
}: {
  label: string
  options: Array<{ id: number; label: string; description?: string }>
  selectedIds: number[]
  onToggle: (id: number, checked: boolean) => void
  emptyText: string
  hint?: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {selectedIds.length > 0 ? (
          <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
        ) : null}
      </div>
      <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white">
        {options.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</div>
        ) : (
          <div className="grid gap-0.5 p-2">
            {options.map((option) => {
              const checked = selectedIds.includes(option.id)
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50"
                >
                  <Checkbox checked={checked} onCheckedChange={(value) => onToggle(option.id, Boolean(value))} />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">{option.label}</span>
                    {option.description ? (
                      <span className="block text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}

export function OnboardingView() {
  const [activeTab, setActiveTab] = React.useState<OnboardingTab>("requests")
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [users, setUsers] = React.useState<AdminRecord[]>([])
  const [roles, setRoles] = React.useState<AdminRecord[]>([])
  const [branches, setBranches] = React.useState<AdminRecord[]>([])
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [positions, setPositions] = React.useState<AdminRecord[]>([])
  const [shiftRecords, setShiftRecords] = React.useState<AdminRecord[]>([])
  const [timetableRecords, setTimetableRecords] = React.useState<AdminRecord[]>([])
  const [accessGroups, setAccessGroups] = React.useState<AdminRecord[]>([])
  const [accessOrganizations, setAccessOrganizations] = React.useState<AdminRecord[]>([])
  const [attendanceDevices, setAttendanceDevices] = React.useState<AdminRecord[]>([])
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [requestSearch, setRequestSearch] = React.useState("")
  const [requestStatusFilter, setRequestStatusFilter] = React.useState("all")
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([])
  const [requestDetailsOpen, setRequestDetailsOpen] = React.useState(false)
  const [requestDetailsLoading, setRequestDetailsLoading] = React.useState(false)
  const [selectedRequestRow, setSelectedRequestRow] = React.useState<AdminRecord | null>(null)
  const [selectedRequestDetails, setSelectedRequestDetails] = React.useState<AdminRecord | null>(null)
  const [selectedRequestProgress, setSelectedRequestProgress] = React.useState<AdminRecord | null>(null)
  const [selectedRequestAuditLogs, setSelectedRequestAuditLogs] = React.useState<AdminRecord[]>([])
  const [selectedWorkflowSteps, setSelectedWorkflowSteps] = React.useState<AdminRecord[]>([])

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
    task_title: "",
    task_description: "",
    task_type: "general",
    action_type: "recommend",
    approver_type: "role",
    approval_level: "1",
    expected_duration_days: "1",
    is_required: "true",
    assigned_branch_id: "",
    assigned_department_id: "",
    company_user_id: "",
    role_id: "",
    position_id: "",
  })
  const [workflowSteps, setWorkflowSteps] = React.useState<AdminRecord[]>([])
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false)
  const [editingStepIndex, setEditingStepIndex] = React.useState<number | null>(null)
  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false)
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<number | null>(null)

  const selectedBranchId = workflowForm.assigned_branch_id ? Number(workflowForm.assigned_branch_id) : null
  const selectedDepartmentId = workflowForm.assigned_department_id
    ? Number(workflowForm.assigned_department_id)
    : null
  const selectedRoleId = workflowForm.role_id ? Number(workflowForm.role_id) : null
  const selectedPositionId = workflowForm.position_id ? Number(workflowForm.position_id) : null

  const filteredDepartments = React.useMemo(
    () =>
      departments.filter((row) =>
        rowMatchesRelation(
          row,
          ["branch_id", "assigned_branch_id", "parent_branch_id"],
          selectedBranchId
        )
      ),
    [departments, selectedBranchId]
  )

  const filteredRoles = React.useMemo(
    () =>
      roles.filter((row) =>
        rowMatchesRelation(
          row,
          ["department_id", "assigned_department_id", "branch_department_id"],
          selectedDepartmentId
        )
      ),
    [roles, selectedDepartmentId]
  )

  const filteredPositions = React.useMemo(
    () =>
      positions.filter((row) =>
        rowMatchesRelation(
          row,
          ["role_id", "assigned_role_id", "position_role_id"],
          selectedRoleId
        )
      ),
    [positions, selectedRoleId]
  )

  const filteredUsers = React.useMemo(
    () =>
      users.filter((row) =>
        rowMatchesRelation(
          row,
          ["position_id", "assigned_position_id", "user_position_id"],
          selectedPositionId
        )
      ),
    [users, selectedPositionId]
  )
  const hasLevelUniquenessError =
    Boolean(error) &&
    String(error).toLowerCase().includes("workflow approval levels must be unique")

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
        requestsResult,
        workflowsResult,
        employeesResult,
        usersResult,
        rolesResult,
        branchesResult,
        departmentsResult,
        positionsResult,
        shiftsResult,
        timetablesResult,
        accessGroupsResult,
        accessOrganizationsResult,
        devicesResult,
      ] = await Promise.all([
        listOnboardingRequests(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listOnboardingWorkflows(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listEmployees(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listUsers(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listResource("roles", token),
        listBranches(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listDepartments(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listPositions(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listShiftResources(token, "shifts", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listTimetableResources(token, "timetables", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listAccessControlResources(token, "groups", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listAccessControlResources(token, "organizations", { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
        listAttendanceDevices(token, { page: 1, limit: 100, sortBy: "created_at", sortOrder: "DESC" }),
      ])

      setRequests(requestsResult.rows)
      setWorkflows(workflowsResult.rows)
      setEmployees(employeesResult.rows)
      setUsers(usersResult.rows)
      setRoles(rolesResult)
      setBranches(branchesResult.rows)
      setDepartments(departmentsResult.rows)
      setPositions(positionsResult.rows)
      setShiftRecords(shiftsResult.rows)
      setTimetableRecords(timetablesResult.rows)
      setAccessGroups(accessGroupsResult.rows)
      setAccessOrganizations(accessOrganizationsResult.rows)
      setAttendanceDevices(devicesResult.rows)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load onboarding data."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  function resolveEmployeeLabel(employeeId: number | null) {
    if (employeeId === null) {
      return "-"
    }

    const employee = employees.find((row) => readNumber(row, ["id", "employee_id", "user_id"]) === employeeId)
    if (!employee) {
      return `#${employeeId}`
    }

    const fullName = readString(employee, ["full_name", "name"])
    if (fullName !== "-") {
      return fullName
    }

    return [readString(employee, ["first_name"]), readString(employee, ["last_name"])]
      .filter((part) => part !== "-")
      .join(" ")
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
    const statuses = new Set<string>()
    requests.forEach((row) => {
      const value = String(row.status ?? "").trim().toLowerCase()
      if (value) statuses.add(value)
    })
    return ["all", ...Array.from(statuses)]
  }, [requests])

  const employeeLabelById = React.useMemo(() => {
    const map = new Map<number, string>()
    employees.forEach((row) => {
      const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
      if (employeeId === null) return
      const fullName = readString(row, ["full_name", "name"])
      if (fullName !== "-") {
        map.set(employeeId, fullName)
        return
      }
      const assembled = [readString(row, ["first_name"]), readString(row, ["last_name"])]
        .filter((part) => part !== "-")
        .join(" ")
      map.set(employeeId, assembled || `#${employeeId}`)
    })
    return map
  }, [employees])

  const filteredRequests = React.useMemo(() => {
    const searchValue = requestSearch.trim().toLowerCase()
    return requests.filter((row) => {
      const statusValue = String(row.status ?? "").trim().toLowerCase()
      if (requestStatusFilter !== "all" && statusValue !== requestStatusFilter) {
        return false
      }

      if (!searchValue) return true

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
        employeeLabelById.get(readNumber(row, ["employee_id"]) ?? -1) ?? "-",
      ]
      return rowValues.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(searchValue)
      )
    })
  }, [requests, requestSearch, requestStatusFilter, employeeLabelById])

  function resolveOptionLabel(
    rows: AdminRecord[],
    id: number | null,
    idKeys: string[],
    labelKeys: string[]
  ) {
    if (id === null) return "-"
    const found = rows.find((row) => readNumber(row, idKeys) === id)
    if (!found) return `#${id}`
    const label = readString(found, labelKeys)
    return label !== "-" ? label : `#${id}`
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

  const resolveResponsibleParty = React.useCallback((step: AdminRecord) => {
    const explicitPerson = readString(step, ["assignee_name", "assigned_to_name", "owner_name", "company_user_name"])
    if (explicitPerson !== "-") {
      return explicitPerson
    }

    const approverType = String(step.approver_type ?? "").toLowerCase().trim()

    const companyUserId = readNumber(step, ["company_user_id", "user_id", "assigned_user_id"])
    if (companyUserId !== null) {
      const personLabel = resolveOptionLabel(users, companyUserId, ["id", "user_id", "company_user_id"], [
        "full_name",
        "name",
        "email",
      ])
      if (personLabel !== "-") {
        return personLabel
      }
    }

    const roleId = readNumber(step, ["role_id", "assigned_role_id"])
    if (roleId !== null) {
      const roleLabel = resolveOptionLabel(roles, roleId, ["id", "role_id"], ["display_name", "name", "title"])
      if (roleLabel !== "-") {
        return `Role: ${roleLabel}`
      }
    }

    const positionId = readNumber(step, ["position_id", "assigned_position_id"])
    if (positionId !== null) {
      const positionLabel = resolveOptionLabel(
        positions,
        positionId,
        ["id", "position_id"],
        ["name", "title"]
      )
      if (positionLabel !== "-") {
        return `Position: ${positionLabel}`
      }
    }

    const branchId = readNumber(step, ["assigned_branch_id", "branch_id"])
    const departmentId = readNumber(step, ["assigned_department_id", "department_id"])
    const branchLabel =
      branchId !== null
        ? resolveOptionLabel(branches, branchId, ["id", "branch_id"], ["name", "title"])
        : "-"
    const departmentLabel =
      departmentId !== null
        ? resolveOptionLabel(
            departments,
            departmentId,
            ["id", "department_id"],
            ["name", "title"]
          )
        : "-"

    if (departmentLabel !== "-") {
      return `Department: ${departmentLabel}`
    }
    if (branchLabel !== "-") {
      return `Branch: ${branchLabel}`
    }
    if (approverType) {
      return toTitleCaseWords(approverType)
    }
    return "-"
  }, [branches, departments, positions, roles, users])

  function resetWorkflowStepForm() {
    setWorkflowForm((prev) => ({
      ...prev,
      step_name: "",
      task_title: "",
      task_description: "",
      task_type: "general",
      action_type: "recommend",
      approver_type: "role",
      approval_level: "1",
      expected_duration_days: "1",
      is_required: "true",
      assigned_branch_id: "",
      assigned_department_id: "",
      company_user_id: "",
      role_id: "",
      position_id: "",
    }))
  }

  function resetWorkflowForm() {
    setWorkflowForm({
      name: "",
      description: "",
      status: "active",
      is_default: "false",
      step_name: "",
      task_title: "",
      task_description: "",
      task_type: "general",
      action_type: "recommend",
      approver_type: "role",
      approval_level: "1",
      expected_duration_days: "1",
      is_required: "true",
      assigned_branch_id: "",
      assigned_department_id: "",
      company_user_id: "",
      role_id: "",
      position_id: "",
    })
    setWorkflowSteps([])
    setEditingStepIndex(null)
  }

  function buildStepFromWorkflowForm() {
    if (!workflowForm.step_name.trim()) {
      return { error: "Step name is required.", step: null as AdminRecord | null }
    }

    const approvalLevel = Number(workflowForm.approval_level)
    const expectedDurationDays = Number(workflowForm.expected_duration_days)
    if (!Number.isFinite(approvalLevel) || approvalLevel < 1) {
      return { error: "Approval level must be 1 or greater.", step: null as AdminRecord | null }
    }
    if (!Number.isFinite(expectedDurationDays) || expectedDurationDays < 1) {
      return { error: "Expected duration (days) must be 1 or greater.", step: null as AdminRecord | null }
    }

    const stepPayload: AdminRecord = {
      task_type: workflowForm.task_type || "general",
      is_required: workflowForm.is_required === "true",
      approval_level: approvalLevel,
      step_name: workflowForm.step_name.trim(),
      task_title: workflowForm.task_title.trim() || workflowForm.step_name.trim(),
      task_description: workflowForm.task_description.trim(),
      approver_type: workflowForm.approver_type || "role",
      action_type: workflowForm.action_type || "recommend",
      expected_duration_days: expectedDurationDays,
    }

    const assignedBranchId = Number(workflowForm.assigned_branch_id)
    const assignedDepartmentId = Number(workflowForm.assigned_department_id)
    const companyUserId = Number(workflowForm.company_user_id)
    const roleId = Number(workflowForm.role_id)
    const positionId = Number(workflowForm.position_id)
    if (Number.isFinite(assignedBranchId) && assignedBranchId > 0) stepPayload.assigned_branch_id = assignedBranchId
    if (Number.isFinite(assignedDepartmentId) && assignedDepartmentId > 0) stepPayload.assigned_department_id = assignedDepartmentId
    if (Number.isFinite(companyUserId) && companyUserId > 0) stepPayload.company_user_id = companyUserId
    if (Number.isFinite(roleId) && roleId > 0) stepPayload.role_id = roleId
    if (Number.isFinite(positionId) && positionId > 0) stepPayload.position_id = positionId

    return { error: null, step: stepPayload }
  }

  function addWorkflowStep() {
    const { error: stepError, step } = buildStepFromWorkflowForm()
    if (stepError || !step) {
      showErrorAlert(stepError ?? "Invalid step.")
      return
    }
    if (editingStepIndex !== null) {
      setWorkflowSteps((prev) => prev.map((entry, idx) => (idx === editingStepIndex ? step : entry)))
      showSuccessAlert("Workflow step updated.")
    } else {
      setWorkflowSteps((prev) => [...prev, step])
      showSuccessAlert("Workflow step added.")
    }
    setEditingStepIndex(null)
    setStepDialogOpen(false)
    resetWorkflowStepForm()
  }

  function openCreateStepDialog() {
    setEditingStepIndex(null)
    resetWorkflowStepForm()
    setStepDialogOpen(true)
  }

  function removeWorkflowStep(index: number) {
    setWorkflowSteps((prev) => prev.filter((_, stepIndex) => stepIndex !== index))
    showSuccessAlert("Workflow step removed.")
  }

  function editWorkflowStep(step: AdminRecord, index: number) {
    setEditingStepIndex(index)
    setWorkflowForm((prev) => ({
      ...prev,
      step_name: String(step.step_name ?? ""),
      task_title: String(step.task_title ?? ""),
      task_description: String(step.task_description ?? ""),
      task_type: String(step.task_type ?? "general"),
      action_type: String(step.action_type ?? "recommend"),
      approver_type: String(step.approver_type ?? "role"),
      approval_level: String(step.approval_level ?? "1"),
      expected_duration_days: String(step.expected_duration_days ?? "1"),
      is_required: String(step.is_required ?? true) === "true" ? "true" : "false",
      assigned_branch_id:
        typeof step.assigned_branch_id === "number" ? String(step.assigned_branch_id) : "",
      assigned_department_id:
        typeof step.assigned_department_id === "number" ? String(step.assigned_department_id) : "",
      company_user_id: typeof step.company_user_id === "number" ? String(step.company_user_id) : "",
      role_id: typeof step.role_id === "number" ? String(step.role_id) : "",
      position_id: typeof step.position_id === "number" ? String(step.position_id) : "",
    }))
    setStepDialogOpen(true)
  }

  async function openEditWorkflowSheet(workflowId: number | null) {
    if (workflowId === null) {
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
      const workflow = await getOnboardingWorkflow(token, workflowId)
      setWorkflowForm((prev) => ({
        ...prev,
        name: String(workflow?.name ?? workflow?.title ?? ""),
        description: String(workflow?.description ?? ""),
        status: String(workflow?.status ?? "active"),
        is_default: String(Boolean(workflow?.is_default ?? workflow?.default ?? false)),
      }))
      const stepsPayload = Array.isArray(workflow?.steps)
        ? (workflow.steps as AdminRecord[])
        : Array.isArray(workflow?.workflow_steps)
          ? (workflow.workflow_steps as AdminRecord[])
          : []
      setWorkflowSteps(stepsPayload)
      setEditingWorkflowId(workflowId)
      setWorkflowSheetOpen(true)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to load workflow details."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function removeWorkflow(workflowId: number | null) {
    if (workflowId === null) {
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
      await deleteOnboardingWorkflow(token, workflowId)
      showSuccessAlert("Workflow deleted successfully.")
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to delete workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitWorkflow() {
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
          description: workflowForm.description.trim(),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
          steps: workflowSteps,
        })
        showSuccessAlert("Onboarding workflow created.")
      } else {
        await patchOnboardingWorkflow(token, editingWorkflowId, {
          name: workflowForm.name.trim(),
          description: workflowForm.description.trim(),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
        })
        showSuccessAlert("Onboarding workflow updated.")
      }

      resetWorkflowForm()
      setWorkflowSheetOpen(false)
      setEditingWorkflowId(null)
      await reloadAll()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Failed to create workflow."
      setError(message)
      showErrorAlert(message)
    } finally {
      setSaving(false)
    }
  }

  async function submitRequest() {
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

      await createOnboardingRequest(token, {
        employee_id: Number(requestForm.employee_id),
        workflow_id: requestForm.workflow_id ? Number(requestForm.workflow_id) : undefined,
        title: requestForm.title.trim(),
        description: requestForm.description.trim(),
        planned_start_date: requestForm.planned_start_date || undefined,
        planned_completion_date: requestForm.planned_completion_date || undefined,
        submit: requestForm.submit === "true",
        provisioning: provisioningResult.provisioning,
      })

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
      showSuccessAlert("Onboarding request created.")
      await reloadAll()
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

    const token = readStoredToken()
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (action === "approve") {
        await approveOnboardingRequest(token, requestId, {
          approve: true,
          comments: "Approved",
          signature_url: "",
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
      } else {
        showSuccessAlert(
          action === "delete"
            ? "Onboarding request removed from list."
            : `Onboarding request ${action}d successfully.`
        )
      }
      await reloadAll()
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
              shiftRecords,
              shiftAssignment.rotation_group_id,
              ["id", "rotation_group_id", "shift_rotation_group_id"],
              ["name", "title", "code"]
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
    selectedRequestDetails,
    selectedRequestRow,
    shiftRecords,
    timetableRecords,
  ])

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
    setSelectedWorkflowSteps([])

    try {
      const [detail, progress, auditLogs] = await Promise.all([
        getOnboardingRequest(token, requestId),
        getOnboardingProgress(token, requestId),
        getOnboardingAuditLogs(token, requestId),
      ])
      setSelectedRequestDetails(detail)
      setSelectedRequestProgress(progress)
      setSelectedRequestAuditLogs(auditLogs)

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

  return (
    <div className="space-y-5 px-4 pb-6 pt-4 lg:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={activeTab === "requests" ? "default" : "outline"}
          onClick={() => setActiveTab("requests")}
        >
          Onboarding Requests
        </Button>
        <Button
          type="button"
          variant={activeTab === "workflows" ? "default" : "outline"}
          onClick={() => setActiveTab("workflows")}
        >
          Onboarding Workflows
        </Button>
        <Button type="button" variant="outline" size="icon" className="ml-auto" onClick={() => void reloadAll()}>
          <RefreshCw className="size-4 text-primary" />
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {activeTab === "requests" ? (
        <div className="space-y-5">
          <div className="space-y-4 rounded-xl border border-border p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={requestForm.title}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Onboarding request title"
              />
              <Select
                value={requestForm.employee_id}
                onValueChange={(value) => setRequestForm((prev) => ({ ...prev, employee_id: value ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee">
                    {requestForm.employee_id
                      ? resolveEmployeeLabel(Number(requestForm.employee_id))
                      : "Select employee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((row) => {
                    const employeeId = readNumber(row, ["id", "employee_id", "user_id"])
                    if (employeeId === null) {
                      return null
                    }
                    return (
                      <SelectItem key={employeeId} value={String(employeeId)}>
                        {resolveEmployeeLabel(employeeId)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <Select
                value={requestForm.workflow_id}
                onValueChange={(value) => setRequestForm((prev) => ({ ...prev, workflow_id: value ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Attach workflow (optional)">
                    {requestForm.workflow_id
                      ? resolveWorkflowLabel(Number(requestForm.workflow_id))
                      : "Attach workflow (optional)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workflows.map((row) => {
                    const workflowId = readNumber(row, ["id", "workflow_id"])
                    if (workflowId === null) {
                      return null
                    }
                    return (
                      <SelectItem key={workflowId} value={String(workflowId)}>
                        {readString(row, ["name", "title"])}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <Select
                value={requestForm.submit}
                onValueChange={(value) => setRequestForm((prev) => ({ ...prev, submit: value ?? "true" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Submission mode">{resolveBooleanLabel(requestForm.submit)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Submit immediately</SelectItem>
                  <SelectItem value="false">Save as draft</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={requestForm.planned_start_date}
                onChange={(event) =>
                  setRequestForm((prev) => ({ ...prev, planned_start_date: event.target.value }))
                }
              />
              <Input
                type="date"
                value={requestForm.planned_completion_date}
                onChange={(event) =>
                  setRequestForm((prev) => ({ ...prev, planned_completion_date: event.target.value }))
                }
              />

              <div className="md:col-span-2">
                <Input
                  value={requestForm.description}
                  onChange={(event) => setRequestForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Description"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <label className="flex items-start gap-3">
                <Checkbox
                  checked={requestProvisioningEnabled}
                  onCheckedChange={(value) => {
                    const checked = Boolean(value)
                    setRequestProvisioningEnabled(checked)
                    if (!checked) {
                      setRequestProvisioning({
                        ...EMPTY_REQUEST_PROVISIONING,
                        shiftAssignment: { ...EMPTY_ONBOARDING_SHIFT_ASSIGNMENT },
                        timetableAssignment: { ...EMPTY_ONBOARDING_TIMETABLE_ASSIGNMENT },
                        deviceAssignment: { ...EMPTY_ONBOARDING_DEVICE_ASSIGNMENT },
                      })
                    }
                  }}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium text-slate-900">Include provisioning payload</span>
                  <span className="block text-xs text-muted-foreground">
                    Match the richer onboarding setup used during employee registration.
                  </span>
                </span>
              </label>

              {requestProvisioningEnabled ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <MultiSelectChecklist
                    label="Roles"
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
                    label="Branch Access"
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

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-900">Attendance Mode</p>
                    <Select
                      value={requestProvisioning.attendanceMode || "none"}
                      onValueChange={(value) =>
                        setRequestAttendanceMode(value === "none" ? "" : (value as OnboardingProvisioningDraft["attendanceMode"]))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Attendance mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No attendance provisioning</SelectItem>
                        <SelectItem value="shift">Shift</SelectItem>
                        <SelectItem value="timetable">Timetable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {requestProvisioning.attendanceMode === "shift" ? (
                    <>
                        <Select
                          value={requestProvisioning.shiftAssignment.shiftId || "none"}
                          onValueChange={(value) =>
                            updateRequestShiftAssignmentField("shiftId", (value ?? "none") === "none" ? "" : (value ?? ""))
                          }
                        >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select shift" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select shift</SelectItem>
                          {requestShiftOptions.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={requestProvisioning.shiftAssignment.effectiveFrom}
                        onChange={(event) => updateRequestShiftAssignmentField("effectiveFrom", event.target.value)}
                        placeholder="Effective from"
                      />
                      <Input
                        type="date"
                        value={requestProvisioning.shiftAssignment.effectiveTo}
                        onChange={(event) => updateRequestShiftAssignmentField("effectiveTo", event.target.value)}
                        placeholder="Effective to"
                      />
                      <Input
                        value={requestProvisioning.shiftAssignment.rotationGroupId}
                        onChange={(event) => updateRequestShiftAssignmentField("rotationGroupId", event.target.value)}
                        placeholder="Rotation group ID (optional)"
                      />
                    </>
                  ) : null}

                  {requestProvisioning.attendanceMode === "timetable" ? (
                    <>
                        <Select
                          value={requestProvisioning.timetableAssignment.timetableId || "none"}
                          onValueChange={(value) =>
                            updateRequestTimetableAssignmentField("timetableId", (value ?? "none") === "none" ? "" : (value ?? ""))
                          }
                        >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timetable" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select timetable</SelectItem>
                          {requestTimetableOptions.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={requestProvisioning.timetableAssignment.effectiveFrom}
                        onChange={(event) => updateRequestTimetableAssignmentField("effectiveFrom", event.target.value)}
                        placeholder="Effective from"
                      />
                      <Input
                        type="date"
                        value={requestProvisioning.timetableAssignment.effectiveTo}
                        onChange={(event) => updateRequestTimetableAssignmentField("effectiveTo", event.target.value)}
                        placeholder="Effective to"
                      />
                    </>
                  ) : null}

                  <div className="md:col-span-2 space-y-4 rounded-md border border-slate-200 bg-white p-4">
                    <label className="flex items-start gap-3">
                      <Checkbox
                        checked={requestProvisioning.deviceAssignment.enabled}
                        onCheckedChange={(value) =>
                          updateRequestDeviceAssignmentField("enabled", Boolean(value))
                        }
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-slate-900">Enable device provisioning</span>
                        <span className="block text-xs text-muted-foreground">
                          Add access-control device setup to the onboarding request.
                        </span>
                      </span>
                    </label>

                    {requestProvisioning.deviceAssignment.enabled ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <Select
                          value={requestProvisioning.deviceAssignment.accessGroupId || "none"}
                          onValueChange={(value) =>
                            updateRequestDeviceAssignmentField("accessGroupId", (value ?? "none") === "none" ? "" : (value ?? ""))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Access group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select access group</SelectItem>
                            {requestAccessGroupOptions.map((option) => (
                              <SelectItem key={option.id} value={String(option.id)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={requestProvisioning.deviceAssignment.organizationId || "none"}
                          onValueChange={(value) =>
                            updateRequestDeviceAssignmentField("organizationId", (value ?? "none") === "none" ? "" : (value ?? ""))
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Organization (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No organization override</SelectItem>
                            {requestAccessOrganizationOptions.map((option) => (
                              <SelectItem key={option.id} value={String(option.id)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Input
                          value={requestProvisioning.deviceAssignment.employeeNo}
                          onChange={(event) => updateRequestDeviceAssignmentField("employeeNo", event.target.value)}
                          placeholder="Employee No override (optional)"
                        />
                        <Input
                          value={requestProvisioning.deviceAssignment.userVerifyMode}
                          onChange={(event) => updateRequestDeviceAssignmentField("userVerifyMode", event.target.value)}
                          placeholder="User verify mode (optional)"
                        />
                        <Input
                          type="datetime-local"
                          value={requestProvisioning.deviceAssignment.validBeginTime}
                          onChange={(event) => updateRequestDeviceAssignmentField("validBeginTime", event.target.value)}
                        />
                        <Input
                          type="datetime-local"
                          value={requestProvisioning.deviceAssignment.validEndTime}
                          onChange={(event) => updateRequestDeviceAssignmentField("validEndTime", event.target.value)}
                        />
                        <Input
                          value={requestProvisioning.deviceAssignment.maxOpenDoorTime}
                          onChange={(event) => updateRequestDeviceAssignmentField("maxOpenDoorTime", event.target.value)}
                          placeholder="Max open door time"
                        />
                        <Input
                          value={requestProvisioning.deviceAssignment.openDoorTime}
                          onChange={(event) => updateRequestDeviceAssignmentField("openDoorTime", event.target.value)}
                          placeholder="Open door time"
                        />

                        <div className="md:col-span-2">
                          <MultiSelectChecklist
                            label="Attendance Devices"
                            options={requestAttendanceDeviceOptions}
                            selectedIds={requestProvisioning.deviceAssignment.deviceIds}
                            onToggle={(id, checked) =>
                              updateRequestDeviceAssignmentField(
                                "deviceIds",
                                toggleNumericId(requestProvisioning.deviceAssignment.deviceIds, id, checked)
                              )
                            }
                            emptyText="No attendance devices available."
                            hint="Choose the devices that should receive this employee during onboarding."
                          />
                        </div>

                        <div className="md:col-span-2 grid gap-2 md:grid-cols-2">
                          {[
                            ["validEnabled", "Validity enabled"],
                            ["localUiRight", "Local UI right"],
                            ["closeDelayEnabled", "Close delay enabled"],
                            ["syncNow", "Sync now"],
                            ["continueOnError", "Continue on error"],
                          ].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                              <Checkbox
                                checked={Boolean(requestProvisioning.deviceAssignment[key as keyof OnboardingDeviceAssignmentDraft])}
                                onCheckedChange={(value) =>
                                  updateRequestDeviceAssignmentField(
                                    key as keyof OnboardingDeviceAssignmentDraft,
                                    Boolean(value) as never
                                  )
                                }
                              />
                              <span className="text-sm text-slate-800">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <Button type="button" onClick={() => void submitRequest()} disabled={saving}>
                Create Onboarding Request
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-2">
            <Input
              value={requestSearch}
              onChange={(event) => setRequestSearch(event.target.value)}
              placeholder="Search request by code, title, employee or status (e.g. ONB-2026-000002)"
            />
            <Select value={requestStatusFilter} onValueChange={(value) => setRequestStatusFilter(value ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by status">
                  {requestStatusFilter === "all"
                    ? "All statuses"
                    : toTitleCaseWords(requestStatusFilter)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {requestStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "all" ? "All statuses" : toTitleCaseWords(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[280px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((row, index) => {
                const requestId = readNumber(row, ["id", "request_id"])
                const employeeId = readNumber(row, ["employee_id"])
                const requestStatus = String(
                  readString(row, ["status", "request_status", "onboarding_status", "workflow_status"])
                ).toLowerCase()
                const isCancelled = requestStatus === "cancelled"
                const isCompleted = requestStatus === "completed"
                const allowedActions = parseAllowedActions(row)
                const canApprove = !isCancelled && allowedActions.has("approve")
                const canReject = !isCancelled && allowedActions.has("reject")
                const fallbackCancelableStatuses = new Set([
                  "draft",
                  "pending",
                  "submitted",
                  "active",
                  "in_review",
                  "request",
                ])
                const canCancel =
                  !isCancelled &&
                  !isCompleted &&
                  (allowedActions.has("cancel") || fallbackCancelableStatuses.has(requestStatus))
                const canComplete = !isCancelled && allowedActions.has("complete")
                const statusBadgeClass =
                  requestStatus === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : requestStatus === "cancelled"
                      ? "bg-rose-100 text-rose-700"
                      : requestStatus === "active"
                        ? "bg-sky-100 text-sky-700"
                        : requestStatus === "draft"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                return (
                  <TableRow
                    key={requestId ?? `request-${index}`}
                    className="cursor-pointer"
                    onClick={() => void openRequestDetails(row)}
                  >
                    <TableCell>{requestId ?? "-"}</TableCell>
                    <TableCell>{resolveEmployeeLabel(employeeId)}</TableCell>
                    <TableCell>{readString(row, ["title", "name"])}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass}`}>
                        {readString(row, ["status"])}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex min-h-9 flex-wrap items-center justify-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {canApprove ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            title="Approve"
                            aria-label="Approve"
                            onClick={() => void runRequestAction(requestId, "approve")}
                          >
                            <BadgeCheck size={18} animation="path-loop" animateOnHover="path-loop" />
                            Approve
                          </Button>
                        ) : null}
                        {canReject ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            title="Reject"
                            aria-label="Reject"
                            onClick={() => void runRequestAction(requestId, "reject")}
                          >
                            <CircleX size={18} animation="default" animateOnHover="default" />
                            Reject
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            title="Cancel"
                            aria-label="Cancel"
                            onClick={() => void runRequestAction(requestId, "cancel")}
                          >
                            <Ban className="h-4 w-4" />
                            Cancel
                          </Button>
                        ) : null}
                        {canComplete ? (
                          <Button
                            type="button"
                            size="sm"
                            title="Complete"
                            aria-label="Complete"
                            onClick={() => void runRequestAction(requestId, "complete")}
                          >
                            <CheckCheck className="h-4 w-4" />
                            Complete
                          </Button>
                        ) : null}
                        {!canApprove && !canReject && !canCancel && !canComplete ? (
                          <span className="text-xs text-muted-foreground">No actions available</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No onboarding requests found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

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
                        <div className="md:col-span-2 xl:col-span-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Provisioning Payload</p>
                          <pre className="mt-1 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                            {JSON.stringify(selectedRequestProvisioningSummary.rawProvisioning, null, 2)}
                          </pre>
                        </div>
                        {selectedRequestProvisioningSummary.metadata ? (
                          <div className="md:col-span-2 xl:col-span-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Metadata</p>
                            <pre className="mt-1 overflow-x-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                              {JSON.stringify(selectedRequestProvisioningSummary.metadata, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

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
                                Owner: <span className="font-medium text-slate-800">{node.owner || "-"}</span>
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
                                {readString(entry, ["actor_name", "performed_by_name", "user_name", "created_by"])}
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
                <Button type="button" variant="outline" onClick={() => setRequestDetailsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogPopup>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                resetWorkflowForm()
                setEditingWorkflowId(null)
                setWorkflowSheetOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((row, index) => {
                const workflowId = readNumber(row, ["id", "workflow_id"])
                return (
                  <TableRow key={workflowId ?? `workflow-${index}`}>
                    <TableCell>{workflowId ?? "-"}</TableCell>
                    <TableCell>{readString(row, ["name", "title"])}</TableCell>
                    <TableCell>{readString(row, ["description"])}</TableCell>
                    <TableCell>{readString(row, ["status"])}</TableCell>
                    <TableCell>{String(Boolean(row.is_default ?? row.default ?? false))}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void openEditWorkflowSheet(workflowId)}
                          aria-label={`Edit workflow ${workflowId ?? index + 1}`}
                          title="Edit workflow"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void removeWorkflow(workflowId)}
                          aria-label={`Delete workflow ${workflowId ?? index + 1}`}
                          title="Delete workflow"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!loading && workflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No workflows found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <Sheet open={workflowSheetOpen} onOpenChange={setWorkflowSheetOpen}>
            <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-1/2 sm:max-w-none">
              <SheetHeader>
                <SheetTitle>{editingWorkflowId === null ? "Create Workflow" : "Edit Workflow"}</SheetTitle>
                <SheetDescription>
                  {editingWorkflowId === null
                    ? "Configure workflow details, add steps, then create the workflow."
                    : "Update workflow details, manage steps, then save changes."}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    value={workflowForm.name}
                    onChange={(event) => setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Workflow name"
                  />
                  <Select
                    value={workflowForm.status}
                    onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, status: value ?? "active" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status">{toTitleCaseWords(workflowForm.status || "Status")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={workflowForm.is_default}
                    onValueChange={(value) => setWorkflowForm((prev) => ({ ...prev, is_default: value ?? "false" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Default workflow">
                        {workflowForm.is_default === "true" ? "Default" : "Not default"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Default</SelectItem>
                      <SelectItem value="false">Not default</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={workflowForm.description}
                    onChange={(event) => setWorkflowForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Workflow description"
                  />
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={openCreateStepDialog} disabled={saving}>
                      Add Step
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <p className="mb-3 text-sm font-medium">Steps to Create ({workflowSteps.length})</p>
                  {workflowSteps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No steps added yet. Click Add Step to create your first workflow step.
                    </p>
                  ) : (
                    <HorizontalScrollContainer className="rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Step Name</TableHead>
                            <TableHead>Task Type</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Approver</TableHead>
                            <TableHead>Required</TableHead>
                            <TableHead
                              className={hasLevelUniquenessError ? "bg-destructive/10 text-destructive" : ""}
                            >
                              Level
                            </TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="sticky right-0 z-10 bg-muted text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workflowSteps.map((step, index) => (
                            <TableRow key={`step-${index}`}>
                              <TableCell className="font-medium">{String(step.step_name ?? `Step ${index + 1}`)}</TableCell>
                              <TableCell>{toTitleCaseWords(String(step.task_type ?? "general"))}</TableCell>
                              <TableCell>{toTitleCaseWords(String(step.action_type ?? "recommend"))}</TableCell>
                              <TableCell>{toTitleCaseWords(String(step.approver_type ?? "role"))}</TableCell>
                              <TableCell>{resolveYesNoLabel(step.is_required)}</TableCell>
                              <TableCell
                                className={hasLevelUniquenessError ? "bg-destructive/10 font-medium text-destructive" : ""}
                              >
                                {String(step.approval_level ?? "-")}
                              </TableCell>
                              <TableCell>
                                {step.expected_duration_days ? `${String(step.expected_duration_days)} day(s)` : "-"}
                              </TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  branches,
                                  readNumber(step, ["assigned_branch_id"]),
                                  ["id", "branch_id"],
                                  ["name", "title"]
                                )}
                              </TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  departments,
                                  readNumber(step, ["assigned_department_id"]),
                                  ["id", "department_id"],
                                  ["name", "title"]
                                )}
                              </TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  roles,
                                  readNumber(step, ["role_id"]),
                                  ["id", "role_id"],
                                  ["name", "title"]
                                )}
                              </TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  positions,
                                  readNumber(step, ["position_id"]),
                                  ["id", "position_id"],
                                  ["name", "title"]
                                )}
                              </TableCell>
                              <TableCell>
                                {resolveOptionLabel(
                                  users,
                                  readNumber(step, ["company_user_id", "user_id", "id"]),
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
                  value={workflowForm.task_title}
                  onChange={(event) => setWorkflowForm((prev) => ({ ...prev, task_title: event.target.value }))}
                  placeholder="Task title (optional)"
                  className="h-11"
                />
                <Input
                  value={workflowForm.task_description}
                  onChange={(event) =>
                    setWorkflowForm((prev) => ({ ...prev, task_description: event.target.value }))
                  }
                  placeholder="Task description (optional)"
                  className="h-11"
                />
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.task_type}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, task_type: value ?? "general" }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Task type">
                        {toTitleCaseWords(workflowForm.task_type || "general")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="hr">HR</SelectItem>
                      <SelectItem value="it">IT</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the category that best describes this step responsibility.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.action_type}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, action_type: value ?? "recommend" }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Action type">
                        {toTitleCaseWords(workflowForm.action_type || "recommend")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recommend">Recommend</SelectItem>
                      <SelectItem value="verify">Verify</SelectItem>
                      <SelectItem value="approve">Approve</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select what outcome this step records in the workflow chain.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.approver_type}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({ ...prev, approver_type: value ?? "role" }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Approver type">
                        {toTitleCaseWords(workflowForm.approver_type || "role")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="role">Role</SelectItem>
                      <SelectItem value="position">Position</SelectItem>
                      <SelectItem value="company_user">Company user</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose whether this step is owned by a role, position, or specific user.
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
                    value={workflowForm.approval_level}
                    onChange={(event) =>
                      setWorkflowForm((prev) => ({ ...prev, approval_level: event.target.value }))
                    }
                    placeholder="Approval level"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Approval level order starts at 1 (first reviewer), then 2, 3, and so on.
                  </p>
                </div>
                <div className="grid gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={workflowForm.expected_duration_days}
                    onChange={(event) =>
                      setWorkflowForm((prev) => ({ ...prev, expected_duration_days: event.target.value }))
                    }
                    placeholder="Expected duration days"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of days expected to complete this step (minimum is 1 day).
                  </p>
                </div>
                <Select
                  value={workflowForm.assigned_branch_id}
                  onValueChange={(value) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      assigned_branch_id: value ?? "",
                      assigned_department_id: "",
                      role_id: "",
                      position_id: "",
                      company_user_id: "",
                    }))
                  }
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Assigned branch (optional)">
                      {workflowForm.assigned_branch_id
                        ? resolveOptionLabel(
                            branches,
                            Number(workflowForm.assigned_branch_id),
                            ["id", "branch_id"],
                            ["name", "title"]
                          )
                        : "Assigned branch (optional)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((row) => {
                      const branchId = readNumber(row, ["id", "branch_id"])
                      if (branchId === null) return null
                      return (
                        <SelectItem key={branchId} value={String(branchId)}>
                          {resolveOptionLabel(branches, branchId, ["id", "branch_id"], ["name", "title"])}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Select
                  value={workflowForm.assigned_department_id}
                  onValueChange={(value) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      assigned_department_id: value ?? "",
                      role_id: "",
                      position_id: "",
                      company_user_id: "",
                    }))
                  }
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Assigned department (optional)">
                      {workflowForm.assigned_department_id
                        ? resolveOptionLabel(
                            departments,
                            Number(workflowForm.assigned_department_id),
                            ["id", "department_id"],
                            ["name", "title"]
                          )
                        : "Assigned department (optional)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDepartments.map((row) => {
                      const departmentId = readNumber(row, ["id", "department_id"])
                      if (departmentId === null) return null
                      return (
                        <SelectItem key={departmentId} value={String(departmentId)}>
                          {resolveOptionLabel(
                            departments,
                            departmentId,
                            ["id", "department_id"],
                            ["name", "title"]
                          )}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <div className="grid gap-1">
                  <Select
                    value={workflowForm.role_id}
                    onValueChange={(value) =>
                      setWorkflowForm((prev) => ({
                        ...prev,
                        role_id: value ?? "",
                        position_id: "",
                        company_user_id: "",
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Role (optional)">
                        {workflowForm.role_id
                          ? resolveOptionLabel(roles, Number(workflowForm.role_id), ["id", "role_id"], [
                              "name",
                              "title",
                            ])
                          : "Role (optional)"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredRoles.map((row) => {
                        const roleId = readNumber(row, ["id", "role_id"])
                        if (roleId === null) return null
                        return (
                          <SelectItem key={roleId} value={String(roleId)}>
                            {resolveOptionLabel(roles, roleId, ["id", "role_id"], ["name", "title"])}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the role responsible for this step.
                  </p>
                </div>
                <Select
                  value={workflowForm.position_id}
                  onValueChange={(value) =>
                    setWorkflowForm((prev) => ({
                      ...prev,
                      position_id: value ?? "",
                      company_user_id: "",
                    }))
                  }
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Position (optional)">
                      {workflowForm.position_id
                        ? resolveOptionLabel(
                            positions,
                            Number(workflowForm.position_id),
                            ["id", "position_id"],
                            ["name", "title"]
                          )
                        : "Position (optional)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPositions.map((row) => {
                      const positionId = readNumber(row, ["id", "position_id"])
                      if (positionId === null) return null
                      return (
                        <SelectItem key={positionId} value={String(positionId)}>
                          {resolveOptionLabel(
                            positions,
                            positionId,
                            ["id", "position_id"],
                            ["name", "title"]
                          )}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Select
                  value={workflowForm.company_user_id}
                  onValueChange={(value) =>
                    setWorkflowForm((prev) => ({ ...prev, company_user_id: value ?? "" }))
                  }
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue placeholder="Approver user (optional)">
                      {workflowForm.company_user_id
                        ? resolveOptionLabel(
                            users,
                            Number(workflowForm.company_user_id),
                            ["id", "company_user_id", "user_id"],
                            ["full_name", "name", "email"]
                          )
                        : "Approver user (optional)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((row) => {
                      const userId = readNumber(row, ["id", "company_user_id", "user_id"])
                      if (userId === null) return null
                      return (
                        <SelectItem key={userId} value={String(userId)}>
                          {resolveOptionLabel(
                            users,
                            userId,
                            ["id", "company_user_id", "user_id"],
                            ["full_name", "name", "email"]
                          )}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
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
      )}
    </div>
  )
}
