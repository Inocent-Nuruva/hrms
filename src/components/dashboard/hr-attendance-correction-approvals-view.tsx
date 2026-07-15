"use client"

import * as React from "react"
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react"

import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Badge } from "@/components/ui/badge"
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
  getHrAttendanceCorrectionApprovalRequest,
  listHrAttendanceCorrectionApprovalRequests,
  rejectHrAttendanceCorrectionRequest,
  type AdminRecord,
} from "@/lib/admin-api"
import { showErrorAlert } from "@/lib/error-alert"
import { showSuccessAlert } from "@/lib/success-alert"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { cn } from "@/lib/utils"

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
            : null
    if (label) {
      return label
    }
    try {
      return JSON.stringify(value)
    } catch {
      return "-"
    }
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

function getEmployeeLabel(row: AdminRecord | null) {
  const nestedEmployee = asRecord(row?.employee)
  const nestedUser = asRecord(nestedEmployee?.user) ?? asRecord(row?.user)
  const explicit =
    readString(row, ["employee_name", "full_name", "employee_full_name", "name"], "") ||
    readString(nestedEmployee, ["full_name", "name"], "") ||
    readString(nestedUser, ["full_name", "name"], "")

  const employeeNo =
    readString(row, ["employee_no", "employeeNo", "user_no"], "") ||
    readString(nestedEmployee, ["employee_no", "employeeNo", "user_no"], "") ||
    readString(nestedUser, ["employee_no", "employeeNo", "user_no"], "")

  if (explicit) {
    return employeeNo ? `${explicit} (${employeeNo})` : explicit
  }

  const firstName =
    readString(row, ["first_name"], "") ||
    readString(nestedEmployee, ["first_name"], "") ||
    readString(nestedUser, ["first_name"], "")
  const lastName =
    readString(row, ["last_name"], "") ||
    readString(nestedEmployee, ["last_name"], "") ||
    readString(nestedUser, ["last_name"], "")

  if (firstName || lastName) {
    const fullName = [firstName, lastName].filter(Boolean).join(" ")
    return employeeNo ? `${fullName} (${employeeNo})` : fullName
  }

  if (employeeNo) {
    return employeeNo
  }

  const employeeId = readNumber(row, ["employee_id", "user_id"])
  return employeeId === null ? "Employee" : `Employee #${employeeId}`
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

function extractCorrectionRows(row: AdminRecord | null): ChangeRow[] {
  if (!row) {
    return []
  }

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
    <div className="min-w-0 rounded-md border border-slate-200/80 bg-slate-50/80 px-2 py-1">
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="truncate text-xs font-medium text-slate-900" title={value}>
        {value}
      </p>
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  variant = "outline",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "outline" | "primary"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "border border-slate-300 text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  )
}

export function HrAttendanceCorrectionApprovalsView() {
  const [requests, setRequests] = React.useState<AdminRecord[]>([])
  const [selectedRequestId, setSelectedRequestId] = React.useState("")
  const [selectedRequestDetail, setSelectedRequestDetail] = React.useState<AdminRecord | null>(null)
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [decisionComment, setDecisionComment] = React.useState("")
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState<"approve" | "reject" | null>(null)

  const selectedListRequest = React.useMemo(
    () => requests.find((row) => getRequestId(row) === selectedRequestId) ?? null,
    [requests, selectedRequestId]
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
          <span className="text-xs font-medium text-slate-900">{getEmployeeLabel(row)}</span>
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
                    ? "bg-slate-900 text-white"
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
    [loadRequestDetail, selectedRequestId]
  )

  const selectedRequestIdRef = React.useRef(selectedRequestId)
  React.useEffect(() => {
    selectedRequestIdRef.current = selectedRequestId
  }, [selectedRequestId])

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
      const result = await listHrAttendanceCorrectionApprovalRequests(token, {
        page: 1,
        limit: 100,
        status: statusFilter === "all" ? undefined : statusFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setRequests(result.rows)

      const currentSelection =
        result.rows.find((row) => getRequestId(row) === selectedRequestIdRef.current) ??
        result.rows[0] ??
        null

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
  }, [dateFrom, dateTo, loadRequestDetail, statusFilter])

  React.useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleDecision = React.useCallback(
    async (action: "approve" | "reject") => {
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
      if (action === "reject" && !note) {
        const message = "Add a rejection reason before declining this request."
        setError(message)
        setFeedback(message)
        showErrorAlert(message)
        return
      }

      setActionLoading(action)
      setError(null)
      setFeedback(null)
      try {
        const body = {
          comment: note || (action === "approve" ? "Approved by HR" : "Rejected by HR"),
          metadata: {
            reviewed_from: "HR_PORTAL",
          },
        }

        if (action === "approve") {
          await approveHrAttendanceCorrectionRequest(token, requestId, body)
        } else {
          await rejectHrAttendanceCorrectionRequest(token, requestId, body)
        }

        const successMessage =
          action === "approve"
            ? "Attendance correction approved and applied to the daily summary."
            : "Attendance correction request rejected."
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <h2 className="shrink-0 text-sm font-semibold text-slate-900">Correction Requests</h2>
        <Badge
          variant="outline"
          className="h-5 border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-600"
        >
          {requests.length}
        </Badge>
        <Badge
          variant="outline"
          className="h-5 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700"
        >
          {pendingCount} pending
        </Badge>

        <div className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:block" />

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
          <SelectTrigger className="h-7 w-auto min-w-[7.5rem] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="min-w-[7.5rem]">
          <DatePickerPresets
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="From"
            className="h-7 px-2 text-xs"
          />
        </div>
        <div className="min-w-[7.5rem]">
          <DatePickerPresets
            value={dateTo}
            onChange={setDateTo}
            placeholder="To"
            className="h-7 px-2 text-xs"
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <ToolbarButton
            onClick={() => {
              setStatusFilter("all")
              setDateFrom("")
              setDateTo("")
              setFeedback(null)
            }}
          >
            Reset
          </ToolbarButton>
          <ToolbarButton variant="primary" onClick={() => void loadRequests()} disabled={loading}>
            <RefreshCw className={cn("size-3", loading ? "animate-spin" : "")} />
            Refresh
          </ToolbarButton>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,21rem)]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
            <p className="text-xs font-semibold text-slate-800">Requests</p>
            <p className="text-[11px] text-slate-500">Select a row to review</p>
          </div>
          <div className="p-1.5">
            <ResizableTable
              title="Correction Requests"
              data={requests}
              columns={requestColumns}
              itemsPerPage={12}
              loading={loading}
              storageKey="hr-attendance-correction-approval-requests-v2"
            />
            {!loading && requests.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-500">
                No correction requests match the current filters.
              </div>
            ) : null}
          </div>
        </div>

        <aside className="flex min-h-[16rem] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-2.5 py-1.5">
            <p className="text-xs font-semibold text-slate-800">Review</p>
            {activeRequest ? (
              <Badge
                variant="outline"
                className={cn("px-1.5 py-0 text-[10px] capitalize", statusMeta.className)}
              >
                {statusMeta.label}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col gap-2 p-2.5">
            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : null}

            {!detailLoading && !activeRequest ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
                Select a request to review
              </div>
            ) : null}

            {!detailLoading && activeRequest ? (
              <>
                {feedback ? (
                  <div
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-xs",
                      error
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {feedback}
                  </div>
                ) : null}

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {getRequestTitle(activeRequest)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">
                    {readString(activeRequest, ["reason"], "No reason supplied")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <MetaChip label="Employee" value={getEmployeeLabel(activeRequest)} />
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
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">Changes</p>
                    <span className="text-[11px] text-slate-500">
                      {changeRows.length} field{changeRows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {changeRows.length > 0 ? (
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-left text-[10px] tracking-wide text-slate-500 uppercase">
                          <tr>
                            <th className="px-2 py-1 font-medium">Field</th>
                            <th className="px-2 py-1 font-medium">Current</th>
                            <th className="px-2 py-1 font-medium">Requested</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {changeRows.map((row) => (
                            <tr key={row.field}>
                              <td className="px-2 py-1 font-medium text-slate-900">{row.label}</td>
                              <td className="px-2 py-1 text-slate-600">{row.currentValue}</td>
                              <td className="px-2 py-1 text-slate-900">{row.requestedValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 px-2 py-3 text-[11px] text-slate-500">
                      No structured diffs returned. Review metadata before acting.
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-800">HR note</p>
                  <Textarea
                    className="min-h-16 rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                    placeholder={
                      statusMeta.terminal
                        ? "This request is already closed."
                        : "Note for approval or rejection…"
                    }
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  />
                  <p className="text-[11px] text-slate-500">
                    Approve applies to the daily summary. Reject requires a clear reason.
                  </p>
                </div>

                <div className="mt-auto flex flex-wrap justify-end gap-1.5 border-t border-slate-100 pt-2">
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-300 px-2.5 text-xs font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleDecision("approve")}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  >
                    {actionLoading === "approve" ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-300 px-2.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleDecision("reject")}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  >
                    {actionLoading === "reject" ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <XCircle className="size-3" />
                    )}
                    Reject
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
