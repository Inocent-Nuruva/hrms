"use client"

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Filter, RefreshCw, Undo2, XCircle } from "lucide-react";
import { CheckmarkCircle20Filled, MailInboxRegular } from "@fluentui/react-icons"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  approveHrAttendanceCorrectionRequest,
  downloadHrAttendanceCorrectionEvidence,
  getEmployeeById,
  getHrAttendanceCorrectionApprovalRequest,
  listHrAttendanceCorrectionApprovalRequests,
  listEmployees,
  listUsers,
  listDepartments,
  rejectHrAttendanceCorrectionRequest,
  returnHrAttendanceCorrectionRequest,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  SELF_SERVICE_REVIEW_STATUS_OPTIONS,
  SelfServiceApprovalTimeline,
  canReviewSelfServiceRequest,
  getSelfServiceStatusMeta,
  isFinalApproval,
  reviewStatusFilterToQuery,
} from "@/components/dashboard/self-service-approval-timeline"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { cn } from "@/lib/utils"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useForbiddenRouteGuard } from "@/hooks/use-forbidden-route-guard"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

type ChangeRow = {
  field: string
  label: string
  currentValue: string
  requestedValue: string
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
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

function readString(row: AdminRecord | null, keys: string[], fallback = "-") {
  if (!row) {
    return fallback
  }
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return fallback
}

function readNumber(row: AdminRecord | null, keys: string[]) {
  if (!row) {
    return null
  }
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

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatDateOnly(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "-"
  }
  // Prefer bare YYYY-MM-DD display without timezone shift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-")
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date)
    }
  }
  return formatDateTime(value)
}

function formatUnknownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No"
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "-"
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return "-"
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed) || /^\d{4}-\d{2}-\d{2} /.test(trimmed)) {
      return formatDateTime(trimmed)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return formatDateOnly(trimmed)
    }
    return trimmed
  }
  if (Array.isArray(value)) {
    const labels = value.map((entry) => formatUnknownValue(entry)).filter((entry) => entry !== "-")
    return labels.length > 0 ? labels.join(", ") : "-"
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    const label =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : typeof record.label === "string" && record.label.trim()
            ? record.label.trim()
            : [record.first_name, record.middle_name, record.last_name]
                .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                .join(" ")
                .trim() ||
              [record.firstName, record.middleName, record.lastName]
                .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                .join(" ")
                .trim() ||
              (typeof record.employee_no === "string" && record.employee_no.trim()
                ? record.employee_no.trim()
                : typeof record.employeeNo === "string" && record.employeeNo.trim()
                  ? record.employeeNo.trim()
                  : typeof record.code === "string" && record.code.trim()
                    ? record.code.trim()
                    : null)
    if (label) {
      return label
    }

    const entries = Object.entries(record)
      .filter(([, nested]) => nested !== null && nested !== undefined && nested !== "")
      .slice(0, 4)
      .map(([key, nested]) => `${humanizeFieldName(key)}: ${formatUnknownValue(nested)}`)
      .filter((entry) => !entry.endsWith(": -"))

    return entries.length > 0 ? entries.join(" • ") : "-"
  }
  return "-"
}

function humanizeFieldName(field: string) {
  return field
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (value) => value.toUpperCase())
}

function getRequestId(row: AdminRecord | null) {
  const id = readNumber(row, ["id", "request_id"])
  return id === null ? "" : String(id)
}

function getStatusMeta(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : ""
  const normalized = raw.toLowerCase()
  const workflowMeta = getSelfServiceStatusMeta(normalized)
  if (workflowMeta) {
    return workflowMeta
  }

  if (normalized === "approved") {
    return {
      label: raw || "Approved",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      terminal: true,
    }
  }
  if (normalized === "rejected") {
    return {
      label: raw || "Rejected",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      terminal: true,
    }
  }
  if (normalized === "cancelled") {
    return {
      label: raw || "Cancelled",
      className: "border-slate-200 bg-slate-100 text-slate-700",
      terminal: true,
    }
  }
  if (["submitted", "pending", "in_review", "under_review"].includes(normalized)) {
    return {
      label: raw || "Pending",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      terminal: false,
    }
  }
  if (normalized === "draft") {
    return {
      label: raw || "Draft",
      className: "border-slate-200 bg-white text-slate-600",
      terminal: false,
    }
  }

  return {
    label: raw || "Pending",
    className: "border-slate-200 bg-white text-slate-700",
    terminal: false,
  }
}

/** Prefer real person name only — never “Employee #id” or employee numbers. */
function getEmployeeDisplayName(row: AdminRecord | null) {
  if (!row) {
    return ""
  }

  const companyUser =
    asRecord(row.company_user) ??
    asRecord(row.companyUser)
  const nestedEmployee =
    asRecord(row.employee) ??
    asRecord(row.employee_profile) ??
    asRecord(row.staff) ??
    asRecord(row.person)
  const nestedUser =
    asRecord(nestedEmployee?.user) ??
    asRecord(companyUser?.user) ??
    asRecord(row.user) ??
    asRecord(row.profile) ??
    companyUser

  const explicit =
    readString(
      row,
      ["employee_name", "full_name", "employee_full_name", "display_name", "name"],
      ""
    ) ||
    readString(companyUser, ["full_name", "display_name", "name", "employee_name"], "") ||
    readString(nestedEmployee, ["full_name", "display_name", "name", "employee_name"], "") ||
    readString(nestedUser, ["full_name", "display_name", "name"], "")

  if (explicit && !/^Employee #\d+$/i.test(explicit) && !looksLikeEmployeeCode(explicit)) {
    return explicit
  }

  const firstName =
    readString(row, ["first_name", "firstName"], "") ||
    readString(companyUser, ["first_name", "firstName"], "") ||
    readString(nestedEmployee, ["first_name", "firstName"], "") ||
    readString(nestedUser, ["first_name", "firstName"], "")
  const middleName =
    readString(row, ["middle_name", "middleName"], "") ||
    readString(companyUser, ["middle_name", "middleName"], "") ||
    readString(nestedEmployee, ["middle_name", "middleName"], "") ||
    readString(nestedUser, ["middle_name", "middleName"], "")
  const lastName =
    readString(row, ["last_name", "lastName"], "") ||
    readString(companyUser, ["last_name", "lastName"], "") ||
    readString(nestedEmployee, ["last_name", "lastName"], "") ||
    readString(nestedUser, ["last_name", "lastName"], "")

  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim()
}

function formatEmployeeOptionLabel(row: AdminRecord) {
  const nestedEmployee =
    asRecord(row.employee) ?? asRecord(row.employee_profile) ?? asRecord(row.staff) ?? asRecord(row.person)
  const primaryName =
    getEmployeeDisplayName(row) ||
    getEmployeeDisplayName(nestedEmployee) ||
    readString(nestedEmployee, ["full_name", "display_name", "name"], "")

  if (primaryName && !/^Employee #\d+$/i.test(primaryName) && !looksLikeEmployeeCode(primaryName)) {
    return primaryName
  }

  return "Unknown employee"
}

function looksLikeEmployeeCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  return /^[A-Z]{2,}[A-Z0-9-]*\d{2,}$/i.test(trimmed)
}

/** All numeric identifiers that might match correction.employee_id. */
function collectEmployeeLookupIds(row: AdminRecord): number[] {
  const ids = new Set<number>()
  const push = (value: number | null) => {
    if (value !== null) ids.add(value)
  }

  push(readNumber(row, ["id", "employee_id", "employeeId", "user_id", "userId", "company_user_id", "companyUserId", "staff_id"]))

  const nestedEmployee =
    asRecord(row.employee) ?? asRecord(row.employee_profile) ?? asRecord(row.staff)
  if (nestedEmployee) {
    push(readNumber(nestedEmployee, ["id", "employee_id", "user_id", "company_user_id"]))
  }

  const nestedUser =
    asRecord(row.user) ??
    asRecord(nestedEmployee?.user) ??
    asRecord(asRecord(row.company_user)?.user) ??
    asRecord(row.company_user)
  if (nestedUser) {
    push(readNumber(nestedUser, ["id", "user_id", "userId", "company_user_id"]))
  }

  return Array.from(ids)
}

function buildEmployeeLabelById(rows: AdminRecord[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const row of rows) {
    const label = formatEmployeeOptionLabel(row)
    if (!label || label === "Unknown employee") {
      continue
    }
    for (const id of collectEmployeeLookupIds(row)) {
      map.set(id, label)
    }
  }
  return map
}

function unwrapNamedEmployeeRecord(row: AdminRecord | null): AdminRecord | null {
  if (!row) {
    return null
  }
  if (formatEmployeeOptionLabel(row) !== "Unknown employee") {
    return row
  }

  const candidates = [
    asRecord(row.employee),
    asRecord(row.data),
    asRecord(row.user),
    asRecord(row.company_user),
    asRecord(asRecord(row.company_user)?.user),
    asRecord(asRecord(row.employee)?.user),
  ].filter((entry): entry is AdminRecord => Boolean(entry))

  for (const candidate of candidates) {
    if (formatEmployeeOptionLabel(candidate) !== "Unknown employee") {
      // Preserve original id fields so lookup by correction.employee_id still works.
      return { ...candidate, ...row, ...candidate }
    }
  }

  return row
}

async function resolveEmployeesForRequests(
  token: string,
  requestRows: AdminRecord[],
  directoryRows: AdminRecord[]
): Promise<AdminRecord[]> {
  const labelMap = buildEmployeeLabelById(directoryRows)
  const missingIds = Array.from(
    new Set(
      requestRows
        .map((row) => readNumber(row, ["employee_id", "employeeId", "user_id", "userId"]))
        .filter((id): id is number => id !== null && !labelMap.has(id))
    )
  )

  if (missingIds.length === 0) {
    return directoryRows
  }

  const extra: AdminRecord[] = []
  await Promise.all(
    missingIds.map(async (employeeId) => {
      try {
        const employee = unwrapNamedEmployeeRecord(await getEmployeeById(employeeId, token))
        if (employee && formatEmployeeOptionLabel(employee) !== "Unknown employee") {
          // Ensure correction.employee_id maps even if record uses another primary key.
          extra.push({
            ...employee,
            employee_id: employeeId,
            id: readNumber(employee, ["id"]) ?? employeeId,
          } as AdminRecord)
        }
      } catch {
        // fall through
      }
    })
  )

  // If still missing after employee GET, try company users directory.
  const stillMissing = missingIds.filter((id) => {
    const merged = buildEmployeeLabelById([...directoryRows, ...extra])
    return !merged.has(id)
  })

  const usersExtra: AdminRecord[] = []
  if (stillMissing.length > 0) {
    try {
      const usersResult = await listUsers(token, {
        page: 1,
        limit: 500,
        sortBy: "created_at",
        sortOrder: "DESC",
      })
      for (const rawUser of usersResult.rows as AdminRecord[]) {
        const user = unwrapNamedEmployeeRecord(rawUser)
        if (!user) continue
        const ids = collectEmployeeLookupIds(user)
        const matched = stillMissing.find((missingId) => ids.includes(missingId))
        if (matched == null) continue
        usersExtra.push({ ...user, employee_id: matched } as AdminRecord)
      }
    } catch {
      // ignore users fallback failures
    }
  }

  return [...directoryRows, ...extra, ...usersExtra]
}

function getRequestTitle(row: AdminRecord | null) {
  const requestType = readString(row, ["request_type", "correction_type", "type"], "")
  const attendanceDate = formatDateOnly(
    row?.attendance_date ?? row?.attendanceDate ?? row?.work_date ?? row?.date
  )
  if (requestType && attendanceDate !== "-") {
    return `${humanizeFieldName(requestType)} · ${attendanceDate}`
  }
  if (requestType) {
    return humanizeFieldName(requestType)
  }
  if (attendanceDate !== "-") {
    return `Correction · ${attendanceDate}`
  }
  return (
    readString(row, ["title", "request_no", "reference_no", "reference"], "") ||
    "Attendance correction"
  )
}

function extractCorrectionRows(source: AdminRecord | null): ChangeRow[] {
  if (!source) {
    return []
  }
  // Values captured at submission take precedence as the "current" side.
  const snapshot = asRecord(source.original_snapshot)
  const row: AdminRecord = snapshot
    ? {
        ...source,
        original_check_in_at: snapshot.check_in_at,
        original_check_out_at: snapshot.check_out_at,
        original_status: snapshot.attendance_status,
      }
    : source

  const pairs: Array<{
    field: string
    label: string
    currentKeys: string[]
    requestedKeys: string[]
  }> = [
    {
      field: "check_in",
      label: "Check in",
      currentKeys: [
        "current_check_in_at",
        "original_check_in_at",
        "existing_check_in_at",
        "previous_check_in_at",
        "check_in_at",
        "first_check_in_at",
      ],
      requestedKeys: ["requested_check_in_at", "requested_check_in", "new_check_in_at"],
    },
    {
      field: "check_out",
      label: "Check out",
      currentKeys: [
        "current_check_out_at",
        "original_check_out_at",
        "existing_check_out_at",
        "previous_check_out_at",
        "check_out_at",
        "last_check_out_at",
      ],
      requestedKeys: ["requested_check_out_at", "requested_check_out", "new_check_out_at"],
    },
    {
      field: "status",
      label: "Status",
      currentKeys: [
        "current_status",
        "original_status",
        "existing_status",
        "previous_status",
        "attendance_status",
      ],
      requestedKeys: ["requested_status", "new_status"],
    },
  ]

  const rows: ChangeRow[] = []
  for (const pair of pairs) {
    const requested = pair.requestedKeys
      .map((key) => row[key])
      .find((value) => value !== null && value !== undefined && String(value).trim() !== "")
    if (requested === undefined) {
      continue
    }
    const current = pair.currentKeys
      .map((key) => row[key])
      .find((value) => value !== null && value !== undefined && String(value).trim() !== "")
    rows.push({
      field: pair.field,
      label: pair.label,
      currentValue: formatUnknownValue(current),
      requestedValue: formatUnknownValue(requested),
    })
  }

  // Fall back to generic requested_* / current_* object maps if present.
  if (rows.length === 0) {
    const requestedChanges =
      asRecord(row.requested_changes) ??
      asRecord(row.requested_values) ??
      asRecord(row.requested)
    const currentValues =
      asRecord(row.current_values) ??
      asRecord(row.original_values) ??
      asRecord(row.previous_values)

    if (requestedChanges) {
      Object.entries(requestedChanges).forEach(([field, value]) => {
        rows.push({
          field,
          label: humanizeFieldName(field),
          currentValue: formatUnknownValue(currentValues?.[field]),
          requestedValue: formatUnknownValue(value),
        })
      })
    }
  }

  return rows
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="truncate text-xs font-medium text-foreground" title={value}>
        {value}
      </p>
    </div>
  )
}

export function HrAttendanceCorrectionApprovalsView() {
  const actor = useDashboardActor()
  useForbiddenRouteGuard(
    actor.ready &&
      canAccessDashboardRoute("/dashboard/attendance/correction-requests", actor.permissionLabels, actor.accessMode)
  )
  const searchParams = useSearchParams()
  const highlightedRequestId = React.useMemo(
    () =>
      searchParams?.get("highlight") ??
      searchParams?.get("requestId") ??
      searchParams?.get("request_id") ??
      "",
    [searchParams]
  )
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [selectedRequestId, setSelectedRequestId] = React.useState("")
  const [selectedRequestDetail, setSelectedRequestDetail] = React.useState<AdminRecord | null>(null)
  const [statusFilter, setStatusFilter] = React.useState("queue")
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [managerFilter, setManagerFilter] = React.useState("all")
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [decisionComment, setDecisionComment] = React.useState("")
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState<
    "approve" | "reject" | "return" | null
  >(null)
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  const selectedListRequest = React.useMemo(
    () => requests.find((row) => getRequestId(row) === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  )

  const employeeLabelById = React.useMemo(() => buildEmployeeLabelById(employees), [employees])

  const employeeLabelByCode = React.useMemo(() => {
    const map = new Map<string, string>()
    employees.forEach((row) => {
      const label = formatEmployeeOptionLabel(row)
      if (!label || label === "Unknown employee") {
        return
      }

      const codes = [
        readString(row, ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no"], ""),
        readString(asRecord(row.employee), ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no"], ""),
        readString(asRecord(row.user), ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no"], ""),
      ]
        .map((value) => value.trim())
        .filter(Boolean)

      codes.forEach((code) => {
        map.set(code.toLowerCase(), label)
      })
    })
    return map
  }, [employees])

  const requestEmployeeLabel = React.useCallback(
    (row: AdminRecord | null) => {
      if (!row) {
        return "Unknown employee"
      }

      // Prefer nested person data from the request/detail payload first.
      const directName = getEmployeeDisplayName(row)
      if (directName) {
        return directName
      }

      const employeeCodes = [
        readString(row, ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no"], ""),
        readString(asRecord(row.employee), ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no"], ""),
        readString(asRecord(asRecord(row.employee)?.user) ?? asRecord(row.user), ["employee_no", "employeeNo", "employee_number", "employee_code", "user_no"], ""),
      ]
        .map((value) => value.trim())
        .filter(Boolean)

      for (const code of employeeCodes) {
        const lookupByCode = employeeLabelByCode.get(code.toLowerCase())
        if (lookupByCode && lookupByCode !== "Unknown employee") {
          return lookupByCode
        }
      }

      const candidateIds = collectEmployeeLookupIds(row)
      // Correction list rows only have employee_id — always include that.
      const employeeId = readNumber(row, ["employee_id", "employeeId"])
      if (employeeId !== null && !candidateIds.includes(employeeId)) {
        candidateIds.push(employeeId)
      }

      for (const id of candidateIds) {
        const lookupLabel = employeeLabelById.get(id)
        if (lookupLabel && lookupLabel !== "Unknown employee") {
          return lookupLabel
        }
      }

      // Never fall back to employee numbers or “Employee #id”.
      return "Unknown employee"
    },
    [employeeLabelByCode, employeeLabelById]
  )

  const activeRequest = React.useMemo(() => {
    if (!selectedListRequest && !selectedRequestDetail) {
      return null
    }
    return {
      ...(selectedListRequest ?? {}),
      ...(selectedRequestDetail ?? {}),
    } as AdminRecord
  }, [selectedListRequest, selectedRequestDetail])

  const changeRows = React.useMemo(() => extractCorrectionRows(activeRequest), [activeRequest])
  const statusMeta = React.useMemo(
    () => getStatusMeta(activeRequest?.status ?? selectedListRequest?.status ?? ""),
    [activeRequest, selectedListRequest]
  )

  const loadRequestDetail = React.useCallback(async (requestId: string) => {
    const token = readStoredToken()
    if (!token || !requestId) {
      return
    }

    setDetailLoading(true)
    try {
      const detail = await getHrAttendanceCorrectionApprovalRequest(token, requestId)
      setSelectedRequestDetail(detail)
      setRequests((current) =>
        current.map((row) => (getRequestId(row) === requestId ? ({ ...row, ...detail } as AdminRecord) : row))
      )

      const detailEmployeeId = readNumber(detail, ["employee_id", "employeeId"])
      if (detailEmployeeId !== null) {
        try {
          const employee = unwrapNamedEmployeeRecord(await getEmployeeById(detailEmployeeId, token))
          if (employee && formatEmployeeOptionLabel(employee) !== "Unknown employee") {
            setEmployees((current) => {
              const labels = buildEmployeeLabelById(current)
              if (labels.has(detailEmployeeId)) {
                return current
              }
              return [
                ...current,
                {
                  ...employee,
                  employee_id: detailEmployeeId,
                  id: readNumber(employee, ["id"]) ?? detailEmployeeId,
                },
              ]
            })
          }
        } catch {
          /* ignore employee name hydrate failures */
        }
      }
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load attendance correction request details."
      setError(message)
      showErrorAlert(message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const requestColumns = React.useMemo<Array<Column<AdminRecord>>>(
    () => [
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 120,
        render: (row) => (
          <span className="text-xs font-medium text-slate-900">{requestEmployeeLabel(row)}</span>
        ),
      },
      {
        key: "attendance_date",
        label: "Date",
        defaultWidth: 80,
        render: (row) => (
          <span className="text-xs text-slate-700 tabular-nums">
            {formatDateOnly(
              row.attendance_date ?? row.attendanceDate ?? row.work_date ?? row.date
            )}
          </span>
        ),
      },
      {
        key: "request",
        label: "Request",
        defaultWidth: 150,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-900">{getRequestTitle(row)}</p>
            <p className="truncate text-[11px] text-slate-500">
              {readString(row, ["reason"], "No reason")}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 78,
        render: (row) => {
          const meta = getStatusMeta(row.status)
          return (
            <Badge
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px] capitalize", meta.className)}
            >
              {meta.label}
            </Badge>
          )
        },
      },
      {
        key: "actions",
        label: "",
        defaultWidth: 64,
        sortable: false,
        render: (row) => {
          const rowId = getRequestId(row)
          const isSelected = rowId === selectedRequestId
          return (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                  isSelected
                    ? "bg-primary !text-white"
                    : "text-slate-600 hover:bg-slate-100"
                )}
                onClick={() => {
                  setSelectedRequestId(rowId)
                  setFeedback(null)
                  setDecisionComment("")
                  void loadRequestDetail(rowId)
                }}
              >
                {isSelected ? "Open" : "Review"}
              </button>
            </div>
          )
        },
      },
    ],
    [loadRequestDetail, requestEmployeeLabel, selectedRequestId]
  )

  const selectedRequestIdRef = React.useRef(selectedRequestId)
  React.useEffect(() => {
    selectedRequestIdRef.current = selectedRequestId
  }, [selectedRequestId])

  const highlightedRequestIdRef = React.useRef(highlightedRequestId)
  React.useEffect(() => {
    highlightedRequestIdRef.current = highlightedRequestId
  }, [highlightedRequestId])

  const downloadCorrectionEvidence = React.useCallback(async (
    requestId: string,
    evidence: AdminRecord,
  ) => {
    const token = readStoredToken()
    const documentId = evidence.id
    if (!token || (typeof documentId !== "number" && typeof documentId !== "string")) {
      showErrorAlert("Evidence download is unavailable for this request.")
      return
    }
    try {
      const downloaded = await downloadHrAttendanceCorrectionEvidence(token, requestId, documentId)
      const url = URL.createObjectURL(downloaded.blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = downloaded.filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (errorObject) {
      showErrorAlert(errorObject instanceof Error ? errorObject.message : "Could not download evidence.")
    }
  }, [])

  const loadRequests = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      const message = "Authentication required. Please log in again."
      setError(message)
      setRequests([])
      setSelectedRequestId("")
      setSelectedRequestDetail(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [result, employeesResult, departmentsResult] = await Promise.all([
        listHrAttendanceCorrectionApprovalRequests(token, {
          page: 1,
          limit: 100,
          status: reviewStatusFilterToQuery(statusFilter),
          department_id:
            departmentFilter === "all" ? undefined : Number(departmentFilter),
          manager_employee_id:
            managerFilter === "all" ? undefined : Number(managerFilter),
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        listEmployees(token, {
          page: 1,
          limit: 500,
          sortBy: "created_at",
          sortOrder: "DESC",
        }).catch(() => ({ rows: [] as AdminRecord[], total: null })),
        listDepartments(token, { page: 1, limit: 200 }, { cacheTtlMs: 60_000 }).catch(
          () => ({ rows: [] as AdminRecord[], total: null })
        ),
      ])
      setDepartments(departmentsResult.rows ?? [])
      const requestRows = result.rows
      // List API returns only employee_id — resolve names via directory + per-id fetch.
      const resolvedEmployees = await resolveEmployeesForRequests(
        token,
        requestRows,
        employeesResult.rows ?? []
      )

      setRequests(requestRows)
      setEmployees(resolvedEmployees)

      const highlightedId = highlightedRequestIdRef.current
      if (highlightedId) {
        const highlightedRow =
          result.rows.find((row) => getRequestId(row) === highlightedId) ?? null
        if (highlightedRow) {
          setSelectedRequestId(highlightedId)
          setSelectedRequestDetail(highlightedRow)
          await loadRequestDetail(highlightedId)
        } else {
          setSelectedRequestId("")
          setSelectedRequestDetail(null)
        }
        return
      }

      if (!selectedRequestIdRef.current) {
        setSelectedRequestDetail(null)
        return
      }

      const currentSelection =
        result.rows.find((row) => getRequestId(row) === selectedRequestIdRef.current) ?? null

      if (!currentSelection) {
        setSelectedRequestId("")
        setSelectedRequestDetail(null)
        return
      }

      const nextRequestId = getRequestId(currentSelection)
      setSelectedRequestId(nextRequestId)
      await loadRequestDetail(nextRequestId)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load attendance correction approval requests."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, departmentFilter, loadRequestDetail, managerFilter, statusFilter])

  React.useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleDecision = React.useCallback(
    async (action: "approve" | "reject" | "return") => {
      const token = readStoredToken()
      if (!token || !activeRequest) {
        const message = "Authentication required. Please log in again."
        setError(message)
        showErrorAlert(message)
        return
      }

      const requestId = getRequestId(activeRequest)
      if (!requestId) {
        return
      }

      const note = decisionComment.trim()
      if (action !== "approve" && !note) {
        const message =
          action === "reject"
            ? "Add a rejection reason before declining this request."
            : "Explain what the employee must correct before returning this request."
        setError(message)
        setFeedback(message)
        showErrorAlert(message)
        return
      }

      setActionLoading(action)
      setError(null)
      setFeedback(null)
      try {
        const finalApproval = isFinalApproval(activeRequest)
        const body = {
          comment: note || (finalApproval ? "Approved by HR" : "Approved by manager"),
          metadata: {
            reviewed_from: "HR_PORTAL",
          },
        }

        if (action === "approve") {
          await approveHrAttendanceCorrectionRequest(token, requestId, body)
        } else if (action === "reject") {
          await rejectHrAttendanceCorrectionRequest(token, requestId, body)
        } else {
          await returnHrAttendanceCorrectionRequest(token, requestId, body)
        }

        const successMessage =
          action === "approve"
            ? finalApproval
              ? "Attendance correction approved and applied to the daily summary."
              : "Attendance correction approved and forwarded to HR for final approval."
            : action === "reject"
              ? "Attendance correction request rejected."
              : "Attendance correction request returned to the employee."
        setFeedback(successMessage)
        setDecisionComment("")
        showSuccessAlert(successMessage)
        await loadRequests()
      } catch (errorObject) {
        const message =
          errorObject instanceof Error
            ? errorObject.message
            : `Failed to ${action} attendance correction request.`
        setError(message)
        setFeedback(message)
        showErrorAlert(message)
      } finally {
        setActionLoading(null)
      }
    },
    [activeRequest, decisionComment, loadRequests]
  )

  const pendingCount = React.useMemo(
    () => requests.filter((row) => !getStatusMeta(row.status).terminal).length,
    [requests]
  )

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (statusFilter !== "queue") count += 1
    if (departmentFilter !== "all") count += 1
    if (managerFilter !== "all") count += 1
    if (dateFrom.trim()) count += 1
    if (dateTo.trim()) count += 1
    return count
  }, [dateFrom, dateTo, departmentFilter, managerFilter, statusFilter])

  const canDecide = canReviewSelfServiceRequest(activeRequest)
  const finalApproval = isFinalApproval(activeRequest)

  const resetFilters = React.useCallback(() => {
    setStatusFilter("queue")
    setDepartmentFilter("all")
    setManagerFilter("all")
    setDateFrom("")
    setDateTo("")
    setFeedback(null)
  }, [])

  const sectionTitleBlock = (
    <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        Correction Requests
      </h1>
      <div className="flex flex-wrap items-center gap-x-2 text-[11px]">
        <span className="text-sky-700 dark:text-sky-300">
          <span className="font-semibold tabular-nums">{requests.length}</span> total
        </span>
        <span className="text-border">·</span>
        <span className="text-amber-700 dark:text-amber-300">
          <span className="font-semibold tabular-nums">{pendingCount}</span> pending
        </span>
      </div>
    </div>
  )

  const selectedDetailTitle = activeRequest
    ? requestEmployeeLabel(activeRequest)
    : selectedRequestId
      ? "Loading request…"
      : "Select a request"

  const detailSheetOpen = Boolean(selectedRequestId)

  const closeDetailSheet = React.useCallback(() => {
    setSelectedRequestId("")
    setSelectedRequestDetail(null)
    setDecisionComment("")
    setFeedback(null)
  }, [])

  return (
    <div className="w-full space-y-2">
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <ResizableTable
        title="Correction Requests"
        data={requests}
        columns={requestColumns}
        itemsPerPage={12}
        loading={loading}
        showExport={false}
        storageKey="hr-attendance-correction-approval-requests-v3"
        toolbarStart={sectionTitleBlock}
        toolbarActions={
          <>
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger
                className={cn(
                  "relative inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-foreground transition hover:bg-muted",
                  activeFilterCount > 0 && "border-primary/40 bg-primary/5"
                )}
                aria-label="Open filters"
                title="Filters"
              >
                <Filter className="size-3.5 text-primary" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 ? (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </PopoverTrigger>
              <PopoverContent className="w-[min(100vw-1.5rem,18.5rem)] p-2.5" align="end">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Filters
                  </div>
                  <label className="grid min-w-0 gap-0.5 text-[10px]">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Status</span>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-7 w-full text-[11px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {SELF_SERVICE_REVIEW_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid min-w-0 gap-0.5 text-[10px]">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Department</span>
                    <Select
                      value={departmentFilter}
                      onValueChange={(value) => setDepartmentFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-7 w-full text-[11px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={String(department.id)} value={String(department.id)}>
                            {readString(department, ["name"], `Department ${String(department.id)}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="grid min-w-0 gap-0.5 text-[10px]">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Manager</span>
                    <Select
                      value={managerFilter}
                      onValueChange={(value) => setManagerFilter(value ?? "all")}
                    >
                      <SelectTrigger className="h-7 w-full text-[11px]">
                        <SelectValue placeholder="Manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All managers</SelectItem>
                        {employees.map((employee) => (
                          <SelectItem key={String(employee.id)} value={String(employee.id)}>
                            {[employee.first_name, employee.last_name]
                              .filter(Boolean)
                              .join(" ") || `Employee ${String(employee.id)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="grid min-w-0 gap-0.5 text-[10px]">
                      <span className="font-medium text-slate-600 dark:text-slate-300">From</span>
                      <DatePickerPresets
                        value={dateFrom}
                        onChange={setDateFrom}
                        placeholder="From"
                        className="h-7 gap-1 px-2 text-[11px] [&_svg]:size-3"
                      />
                    </label>
                    <label className="grid min-w-0 gap-0.5 text-[10px]">
                      <span className="font-medium text-slate-600 dark:text-slate-300">To</span>
                      <DatePickerPresets
                        value={dateTo}
                        onChange={setDateTo}
                        placeholder="To"
                        className="h-7 gap-1 px-2 text-[11px] [&_svg]:size-3"
                      />
                    </label>
                  </div>
                  <div className="flex gap-1 border-t border-border pt-1.5">
                    <button
                      type="button"
                      className="inline-flex h-7 flex-1 items-center justify-center rounded-md bg-primary px-2 text-[11px] font-semibold !text-white transition hover:brightness-95"
                      onClick={() => {
                        setFiltersOpen(false)
                        void loadRequests()
                      }}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-7 items-center justify-center rounded-md border border-border px-2 text-[11px] font-semibold text-foreground transition hover:bg-muted"
                      onClick={resetFilters}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void loadRequests()}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={cn("size-3.5 text-primary", loading && "animate-spin")} />
            </button>
          </>
        }
        emptyContent={
          <div className="flex flex-col items-center gap-1.5 py-5">
            <div
              className="relative grid size-11 place-items-center rounded-xl bg-sky-50 text-primary dark:bg-sky-950/40"
              aria-hidden
            >
              <MailInboxRegular className="size-6" />
              <CheckmarkCircle20Filled className="absolute -bottom-1 -right-1 size-5 text-emerald-500 dark:text-emerald-400" />
              <span className="absolute left-1 top-1 size-1.5 rounded-full bg-amber-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {activeFilterCount > 0 ? "No matching requests" : "Correction inbox is clear"}
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {activeFilterCount > 0
                ? "Try changing or resetting the filters to see other requests."
                : "New employee correction requests will appear here for review."}
            </p>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-primary hover:underline"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        }
      />

      <Sheet
        open={detailSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeDetailSheet()
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-md"
          showCloseButton
        >
          <SheetHeader className="border-b border-border bg-muted/20 px-4 py-3 pr-12">
            <SheetDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Selected request
            </SheetDescription>
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="truncate text-base font-semibold" title={selectedDetailTitle}>
                {selectedDetailTitle}
              </SheetTitle>
              {activeRequest || detailLoading ? (
                <Badge
                  variant="outline"
                  className={cn("shrink-0 px-1.5 py-0 text-[10px] capitalize", statusMeta.className)}
                >
                  {detailLoading && !activeRequest ? "Loading" : statusMeta.label}
                </Badge>
              ) : null}
            </div>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
            {detailLoading && !activeRequest ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                <FluentLoadingIndicator className="size-5 animate-spin text-primary" />
                Loading request details…
              </div>
            ) : null}

            {activeRequest ? (
              <>
                {detailLoading ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <FluentLoadingIndicator className="size-3 animate-spin" />
                    Refreshing details…
                  </div>
                ) : null}

                {feedback ? (
                  <div
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs",
                      error
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                    )}
                  >
                    {feedback}
                  </div>
                ) : null}

                <div className="min-w-0 rounded-lg border border-border bg-muted/15 px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {getRequestTitle(activeRequest)}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-xs leading-snug text-muted-foreground">
                    {readString(activeRequest, ["reason"], "No reason supplied")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Supporting evidence</p>
                  {Array.isArray(activeRequest.evidence) && activeRequest.evidence.length > 0 ? (
                    <div className="space-y-1">
                      {activeRequest.evidence.map((item, index) => {
                        const evidence = asRecord(item)
                        if (!evidence) return null
                        return (
                          <button
                            key={String(evidence.id ?? index)}
                            type="button"
                            className="block w-full truncate rounded-md border border-border px-2.5 py-2 text-left text-xs text-primary hover:bg-muted"
                            onClick={() => void downloadCorrectionEvidence(getRequestId(activeRequest), evidence)}
                          >
                            {readString(evidence, ["file_name"], "Download evidence")}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-2.5 py-2 text-xs text-muted-foreground">No evidence attached.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <MetaChip label="Employee" value={requestEmployeeLabel(activeRequest)} />
                  <MetaChip
                    label="Date"
                    value={formatDateOnly(
                      activeRequest.attendance_date ??
                        activeRequest.attendanceDate ??
                        activeRequest.work_date ??
                        activeRequest.date
                    )}
                  />
                  <MetaChip
                    label="Submitted"
                    value={formatDateTime(
                      activeRequest.submitted_at ?? activeRequest.created_at
                    )}
                  />
                  <MetaChip label="ID" value={getRequestId(activeRequest) || "—"} />
                  <MetaChip
                    label="Type"
                    value={humanizeFieldName(
                      readString(
                        activeRequest,
                        ["request_type", "correction_type", "type"],
                        "Correction"
                      )
                    )}
                  />
                  <MetaChip
                    label="Req. status"
                    value={readString(activeRequest, ["requested_status", "new_status"], "—")}
                  />
                  <MetaChip
                    label="Department"
                    value={readString(activeRequest, ["department_name"], "—")}
                  />
                  <MetaChip
                    label="Manager decision"
                    value={
                      activeRequest.manager_reviewed_at
                        ? `Approved ${formatDateTime(activeRequest.manager_reviewed_at)}`
                        : "—"
                    }
                  />
                </div>
                {typeof activeRequest.manager_review_comment === "string" &&
                activeRequest.manager_review_comment.trim() ? (
                  <p className="rounded-md border border-border bg-muted/15 px-2.5 py-1.5 text-xs text-muted-foreground">
                    Manager note: {activeRequest.manager_review_comment}
                  </p>
                ) : null}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">Requested changes</p>
                    <span className="text-[11px] text-muted-foreground">
                      {changeRows.length} field{changeRows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {changeRows.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-border">
                      <StandardTable className="min-w-full text-xs">
                        <StandardTableHeader className="bg-muted/40 text-left text-[10px] tracking-wide text-muted-foreground uppercase">
                          <StandardTableRow>
                            <StandardTableHead className="px-2.5 py-1.5 font-medium">Field</StandardTableHead>
                            <StandardTableHead className="px-2.5 py-1.5 font-medium">Current</StandardTableHead>
                            <StandardTableHead className="px-2.5 py-1.5 font-medium">Requested</StandardTableHead>
                          </StandardTableRow>
                        </StandardTableHeader>
                        <StandardTableBody className="divide-y divide-border bg-card">
                          {changeRows.map((row) => (
                            <StandardTableRow key={row.field}>
                              <StandardTableCell className="px-2.5 py-1.5 font-medium text-foreground">{row.label}</StandardTableCell>
                              <StandardTableCell className="px-2.5 py-1.5 text-muted-foreground">{row.currentValue}</StandardTableCell>
                              <StandardTableCell className="px-2.5 py-1.5 font-medium text-primary">{row.requestedValue}</StandardTableCell>
                            </StandardTableRow>
                          ))}
                        </StandardTableBody>
                      </StandardTable>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-2.5 py-3 text-[11px] text-muted-foreground">
                      No structured diffs returned. Review metadata before acting.
                    </div>
                  )}
                </div>

                <SelfServiceApprovalTimeline history={activeRequest.approval_history} />

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">
                    {finalApproval ? "HR note" : "Reviewer note"}
                  </p>
                  <Textarea
                    className="min-h-16 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                    placeholder={
                      canDecide
                        ? "Note for approval, rejection or return…"
                        : "This request is not awaiting your decision."
                    }
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                    disabled={!canDecide || actionLoading !== null}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {finalApproval
                      ? "Final approval applies the correction to the daily summary."
                      : "Approval forwards the request to HR for final approval."}{" "}
                    Reject and return require a clear reason.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {activeRequest ? (
            <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border bg-background p-4">
              <button
                type="button"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold !text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleDecision("approve")}
                disabled={!canDecide || actionLoading !== null}
              >
                {actionLoading === "approve" ? (
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {finalApproval ? "Final approve" : "Approve"}
              </button>
              <button
                type="button"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-orange-300 bg-background px-3 text-xs font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-orange-900/50 dark:text-orange-300 dark:hover:bg-orange-950/40"
                onClick={() => void handleDecision("return")}
                disabled={!canDecide || actionLoading !== null}
              >
                {actionLoading === "return" ? (
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                ) : (
                  <Undo2 className="size-3.5" />
                )}
                Return
              </button>
              <button
                type="button"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-background px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                onClick={() => void handleDecision("reject")}
                disabled={!canDecide || actionLoading !== null}
              >
                {actionLoading === "reject" ? (
                  <FluentLoadingIndicator className="size-3.5 animate-spin" />
                ) : (
                  <XCircle className="size-3.5" />
                )}
                Reject
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
