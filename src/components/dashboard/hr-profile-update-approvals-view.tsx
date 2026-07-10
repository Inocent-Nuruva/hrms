"use client"

import * as React from "react"
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react"

import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  approveHrProfileUpdateRequest,
  getHrProfileUpdateApprovalRequest,
  listHrProfileUpdateApprovalRequests,
  rejectHrProfileUpdateRequest,
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

function asRecordArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AdminRecord[]
  }
  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is AdminRecord => Boolean(entry))
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
    return value.trim() || "-"
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
  const nestedUser = asRecord(nestedEmployee?.user)
  const explicit =
    readString(row, ["employee_name", "full_name", "employee_full_name", "name"], "") ||
    readString(nestedEmployee, ["full_name", "name"], "") ||
    readString(nestedUser, ["full_name", "name"], "")

  if (explicit) {
    return explicit
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
    return [firstName, lastName].filter(Boolean).join(" ")
  }

  const employeeId = readNumber(row, ["employee_id", "employee_no", "user_id"])
  return employeeId === null ? "Employee" : `Employee #${employeeId}`
}

function getRequestTitle(row: AdminRecord | null) {
  return (
    readString(row, ["title", "request_no", "reference_no", "reference"], "") ||
    readString(row, ["reason", "request_type", "change_type"], "Profile update")
  )
}

function extractChangeRows(row: AdminRecord | null): ChangeRow[] {
  if (!row) {
    return []
  }

  const rowsByField = new Map<string, ChangeRow>()
  const currentValues =
    asRecord(row.current_values) ??
    asRecord(row.current_data) ??
    asRecord(row.previous_values) ??
    asRecord(row.existing_values)

  const upsert = (entry: ChangeRow) => {
    rowsByField.set(entry.field, entry)
  }

  const arrayCandidates = [
    row.requested_change_items,
    row.change_items,
    row.changes,
    row.requested_fields,
  ]

  arrayCandidates.forEach((candidate) => {
    asRecordArray(candidate).forEach((entry) => {
      const field =
        readString(entry, ["field", "field_name", "attribute", "key", "name"], "") || ""
      if (!field) {
        return
      }

      upsert({
        field,
        label: readString(entry, ["label", "field_label"], "") || humanizeFieldName(field),
        currentValue: formatUnknownValue(
          entry.current_value ?? entry.old_value ?? entry.previous_value ?? entry.from
        ),
        requestedValue: formatUnknownValue(
          entry.requested_value ?? entry.new_value ?? entry.next_value ?? entry.to ?? entry.value
        ),
      })
    })
  })

  const requestedChanges = asRecord(row.requested_changes)
  if (requestedChanges) {
    Object.entries(requestedChanges).forEach(([field, value]) => {
      upsert({
        field,
        label: humanizeFieldName(field),
        currentValue: formatUnknownValue(currentValues?.[field]),
        requestedValue: formatUnknownValue(value),
      })
    })
  }

  return Array.from(rowsByField.values())
}

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

export function HrProfileUpdateApprovalsView() {
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

  const changeRows = React.useMemo(() => extractChangeRows(activeRequest), [activeRequest])
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
      const detail = await getHrProfileUpdateApprovalRequest(token, requestId)
      setSelectedRequestDetail(detail)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load profile update request details."
      setError(message)
      showErrorAlert(message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const requestColumns = React.useMemo<Array<Column<AdminRecord>>>(() => [
    {
      key: "employee",
      label: "Employee",
      defaultWidth: 115,
      render: (row) => getEmployeeLabel(row),
    },
    {
      key: "request",
      label: "Request",
      defaultWidth: 140,
      render: (row) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{getRequestTitle(row)}</p>
          <p className="text-xs text-slate-500">{readString(row, ["reason"], "No reason supplied")}</p>
        </div>
      ),
    },
    {
      key: "submitted",
      label: "Submitted",
      defaultWidth: 95,
      render: (row) => formatDateTime(row.submitted_at ?? row.created_at ?? row.updated_at),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 80,
      render: (row) => {
        const meta = getStatusMeta(row.status)
        return (
          <Badge variant="outline" className={cn("capitalize", meta.className)}>
            {meta.label}
          </Badge>
        )
      },
    },
    {
      key: "actions",
      label: "Act",
      defaultWidth: 65,
      sortable: false,
      render: (row) => {
        const rowId = getRequestId(row)
        const isSelected = rowId === selectedRequestId
        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={cn(
                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
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
  ], [loadRequestDetail, selectedRequestId])

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
      const result = await listHrProfileUpdateApprovalRequests(token, {
        page: 1,
        limit: 100,
        sortBy: "created_at",
        sortOrder: "DESC",
        status: statusFilter === "all" ? undefined : statusFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      setRequests(result.rows)

      const currentSelection =
        result.rows.find((row) => getRequestId(row) === selectedRequestId) ?? result.rows[0] ?? null

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
          : "Failed to load profile update approval requests."
      setError(message)
      showErrorAlert(message)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, loadRequestDetail, selectedRequestId, statusFilter])

  React.useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleDecision = React.useCallback(async (action: "approve" | "reject") => {
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
      if (action === "approve") {
        await approveHrProfileUpdateRequest(token, requestId, {
          approve: true,
          comments: note || "Approved by HR",
        })
      } else {
        await rejectHrProfileUpdateRequest(token, requestId, {
          comments: note || "Rejected by HR",
          reason: note || "Rejected by HR",
        })
      }

      const successMessage =
        action === "approve"
          ? "Profile update request approved successfully."
          : "Profile update request rejected successfully."
      setFeedback(successMessage)
      setDecisionComment("")
      showSuccessAlert(successMessage)
      await loadRequests()
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : `Failed to ${action} profile update request.`
      setError(message)
      setFeedback(message)
      showErrorAlert(message)
    } finally {
      setActionLoading(null)
    }
  }, [activeRequest, decisionComment, loadRequests])

  const pendingCount = React.useMemo(
    () => requests.filter((row) => !getStatusMeta(row.status).terminal).length,
    [requests]
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile Update Approvals</CardTitle>
          <CardDescription>
            Review employee self-service profile changes, filter the queue, and approve or reject each request with HR notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {requests.length} request{requests.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
            {pendingCount} awaiting review
          </Badge>
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            {requests.filter((row) => String(row.status ?? "").toLowerCase() === "approved").length} approved
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by current approval status and request date range.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Status</p>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">From date</p>
            <DatePickerPresets value={dateFrom} onChange={setDateFrom} placeholder="From date" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">To date</p>
            <DatePickerPresets value={dateTo} onChange={setDateTo} placeholder="To date" />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              onClick={() => {
                setStatusFilter("all")
                setDateFrom("")
                setDateTo("")
                setFeedback(null)
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={() => void loadRequests()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
              Refresh
            </button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
            <CardDescription>Select a request to review its details and action history.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResizableTable
              title="Profile Update Approval Requests"
              data={requests}
              columns={requestColumns}
              itemsPerPage={15}
              loading={loading}
              storageKey="hr-profile-update-approval-requests"
            />
            {!loading && requests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                No profile update approval requests match the current filters.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>
              {activeRequest
                ? "Inspect the requested changes before recording your HR decision."
                : "Select a request from the list to review it here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailLoading ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading request details…
              </div>
            ) : null}

            {!detailLoading && !activeRequest ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                No request selected yet.
              </div>
            ) : null}

            {activeRequest ? (
              <>
                {feedback ? (
                  <div
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm",
                      error
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {feedback}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{getRequestTitle(activeRequest)}</p>
                    <p className="text-sm text-slate-500">{readString(activeRequest, ["reason"], "No reason supplied")}</p>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", statusMeta.className)}>
                    {statusMeta.label}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoItem label="Employee" value={getEmployeeLabel(activeRequest)} />
                  <InfoItem label="Submitted" value={formatDateTime(activeRequest.submitted_at ?? activeRequest.created_at)} />
                  <InfoItem label="Request ID" value={getRequestId(activeRequest) || "-"} />
                  <InfoItem label="Request Type" value={readString(activeRequest, ["request_type", "change_type"], "Profile update")} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Requested Changes</h3>
                    <span className="text-xs text-slate-500">
                      {changeRows.length} field{changeRows.length === 1 ? "" : "s"} changed
                    </span>
                  </div>
                  {changeRows.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Field</th>
                            <th className="px-3 py-2 font-medium">Current</th>
                            <th className="px-3 py-2 font-medium">Requested</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {changeRows.map((row) => (
                            <tr key={row.field}>
                              <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                              <td className="px-3 py-2 text-slate-600">{row.currentValue}</td>
                              <td className="px-3 py-2 text-slate-900">{row.requestedValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      This request did not include structured change rows. Review the request metadata above before taking action.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">HR Note</p>
                  <Textarea
                    className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder={
                      statusMeta.terminal
                        ? "This request is already closed."
                        : "Add the note that should accompany this approval or rejection."
                    }
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  />
                  <p className="text-xs text-slate-500">
                    Rejections should include a clear reason so the employee knows what to fix.
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleDecision("approve")}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  >
                    {actionLoading === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve Request
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleDecision("reject")}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  >
                    {actionLoading === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject Request
                  </button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
