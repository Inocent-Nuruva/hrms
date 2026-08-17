"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowRightIcon,
  CheckCircle2,
  FilterIcon,
  ImageIcon,
  InfoIcon,
  Loader2,
  RefreshCw,
  UserRoundIcon,
  XCircle,
  XIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  getEmployeeById,
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

  if (normalized === "approved") {
    return {
      label: raw || "Approved",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      textClassName: "text-emerald-700 dark:text-emerald-400",
      terminal: true,
    }
  }
  if (normalized === "rejected") {
    return {
      label: raw || "Rejected",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      textClassName: "text-rose-700 dark:text-rose-400",
      terminal: true,
    }
  }
  if (normalized === "cancelled") {
    return {
      label: raw || "Cancelled",
      className: "border-slate-200 bg-slate-100 text-slate-700",
      textClassName: "text-muted-foreground",
      terminal: true,
    }
  }
  if (["submitted", "pending", "in_review", "under_review"].includes(normalized)) {
    return {
      label: raw || "Pending",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      textClassName: "text-amber-700 dark:text-amber-400",
      terminal: false,
    }
  }
  if (normalized === "draft") {
    return {
      label: raw || "Draft",
      className: "border-slate-200 bg-white text-slate-600",
      textClassName: "text-muted-foreground",
      terminal: false,
    }
  }

  return {
    label: raw || "Pending",
    className: "border-slate-200 bg-white text-slate-700",
    textClassName: "text-muted-foreground",
    terminal: false,
  }
}

const PERSON_NAME_KEYS = [
  "employee_name",
  "employeeName",
  "full_name",
  "fullName",
  "employee_full_name",
  "employeeFullName",
  "display_name",
  "displayName",
  "preferred_name",
  "preferredName",
  "name",
] as const

const PERSON_NEST_KEYS = [
  "employee",
  "user",
  "company_user",
  "companyUser",
  "requested_by",
  "requestedBy",
  "requester",
  "applicant",
  "submitted_by",
  "submittedBy",
  "created_by",
  "createdBy",
  "owner",
  "person",
  "profile",
] as const

function isLikelyPersonName(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === "-") return false
  // Avoid using request titles as employee names.
  const lower = trimmed.toLowerCase()
  if (
    lower.includes("requested change") ||
    lower.includes("profile update") ||
    lower.includes("personal detail") ||
    lower.startsWith("request")
  ) {
    return false
  }
  return true
}

function nameFromRecord(record: AdminRecord | null): string {
  if (!record) return ""

  for (const key of PERSON_NAME_KEYS) {
    const value = readString(record, [key], "")
    if (value && isLikelyPersonName(value)) {
      return value
    }
  }

  const firstName = readString(record, ["first_name", "firstName", "given_name", "givenName"], "")
  const middleName = readString(record, ["middle_name", "middleName"], "")
  const lastName = readString(record, ["last_name", "lastName", "family_name", "familyName", "surname"], "")
  const composed = [firstName, middleName, lastName].filter(Boolean).join(" ").trim()
  if (composed && isLikelyPersonName(composed)) {
    return composed
  }

  return ""
}

function readEmployeeId(row: AdminRecord | null): number | null {
  if (!row) return null

  const direct = readNumber(row, ["employee_id", "employeeId", "user_id", "userId"])
  if (direct !== null) return direct

  for (const key of PERSON_NEST_KEYS) {
    const nested = asRecord(row[key])
    const nestedId = readNumber(nested, ["id", "employee_id", "employeeId", "user_id", "userId"])
    if (nestedId !== null) return nestedId
  }

  return null
}

/** Display name only (no employee number). */
function getEmployeeName(row: AdminRecord | null) {
  if (!row) return "Employee"

  const sources: Array<AdminRecord | null> = [row]
  for (const key of PERSON_NEST_KEYS) {
    sources.push(asRecord(row[key]))
  }
  // One more level: employee.user / company_user.user
  for (const key of PERSON_NEST_KEYS) {
    const nested = asRecord(row[key])
    if (!nested) continue
    sources.push(asRecord(nested.user))
    sources.push(asRecord(nested.company_user))
    sources.push(asRecord(nested.companyUser))
    sources.push(asRecord(nested.employee))
  }

  for (const source of sources) {
    const name = nameFromRecord(source)
    if (name) return name
  }

  return "Employee"
}

async function enrichRowsWithEmployeeNames(
  token: string,
  rows: AdminRecord[]
): Promise<AdminRecord[]> {
  const cache = new Map<number, string>()
  const idsToFetch = new Set<number>()

  for (const row of rows) {
    if (getEmployeeName(row) !== "Employee") continue
    const id = readEmployeeId(row)
    if (id !== null) idsToFetch.add(id)
  }

  await Promise.all(
    Array.from(idsToFetch).map(async (id) => {
      try {
        const employee = await getEmployeeById(id, token)
        const name = getEmployeeName(employee as AdminRecord)
        if (name && name !== "Employee") {
          cache.set(id, name)
        }
      } catch {
        // Keep fallback label when lookup fails.
      }
    })
  )

  if (cache.size === 0) {
    return rows
  }

  return rows.map((row) => {
    if (getEmployeeName(row) !== "Employee") return row
    const id = readEmployeeId(row)
    if (id === null) return row
    const resolved = cache.get(id)
    if (!resolved) return row
    return {
      ...row,
      employee_name: resolved,
      employeeName: resolved,
      full_name: resolved,
      fullName: resolved,
    }
  })
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

function isPhotoField(field: string, label: string) {
  const haystack = `${field} ${label}`.toLowerCase()
  return /photo|avatar|profile[_\s-]?image|profile[_\s-]?picture|image[_\s-]?url|picture|headshot/.test(
    haystack
  )
}

function looksLikeImageUrl(value: string) {
  const v = value.trim()
  if (!v || v === "-") return false
  if (v.startsWith("data:image/")) return true
  if (/\.(jpe?g|png|gif|webp|svg|avif)(\?|#|$)/i.test(v)) return true
  if (/\/uploads\/|profile[-_]?photos?|avatars?\//i.test(v)) return true
  if (/^https?:\/\//i.test(v) && /(photo|image|avatar|picture|upload)/i.test(v)) return true
  return false
}

function shouldRenderAsPhoto(row: ChangeRow) {
  return (
    isPhotoField(row.field, row.label) ||
    looksLikeImageUrl(row.currentValue) ||
    looksLikeImageUrl(row.requestedValue)
  )
}

function PhotoThumb({
  src,
  alt,
  emptyLabel,
}: {
  src: string
  alt: string
  emptyLabel: string
}) {
  const [broken, setBroken] = React.useState(false)
  const hasSrc = Boolean(src && src !== "-" && !broken)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex size-28 items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border sm:size-32">
        {hasSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote/local upload URLs from API
          <img
            src={src}
            alt={alt}
            className="size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-3 text-center text-muted-foreground">
            <UserRoundIcon className="size-8 opacity-40" />
            <span className="text-[10px] font-medium leading-tight">{emptyLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ChangeComparison({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No structured field changes were returned for this request.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => {
        const asPhoto = shouldRenderAsPhoto(row)
        if (asPhoto) {
          return (
            <div key={row.field} className="space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-3.5 text-primary" />
                <p className="text-sm font-medium text-foreground">{row.label}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start sm:gap-6">
                <div className="space-y-1.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Current
                  </p>
                  <PhotoThumb src={row.currentValue} alt="Current profile photo" emptyLabel="No photo" />
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="space-y-1.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                    Requested
                  </p>
                  <PhotoThumb
                    src={row.requestedValue}
                    alt="Requested profile photo"
                    emptyLabel="No photo"
                  />
                </div>
              </div>
            </div>
          )
        }

        return (
          <div key={row.field} className="grid gap-2 border-t border-border/70 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] sm:gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:sr-only">
                Field
              </p>
              <p className="text-sm font-medium text-foreground">{row.label}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Current
              </p>
              <p className="mt-0.5 break-words text-sm text-muted-foreground">
                {row.currentValue}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
                Requested
              </p>
              <p className="mt-0.5 break-words text-sm font-medium text-foreground">
                {row.requestedValue}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function HrProfileUpdateApprovalsView() {
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
  const [selectedRequestId, setSelectedRequestId] = React.useState("")
  const [selectedRequestDetail, setSelectedRequestDetail] = React.useState<AdminRecord | null>(null)
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [decisionComment, setDecisionComment] = React.useState("")
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState<"approve" | "reject" | null>(null)
  const [reviewOpen, setReviewOpen] = React.useState(false)

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
      let detail = (await getHrProfileUpdateApprovalRequest(token, requestId)) as AdminRecord | null
      if (detail && getEmployeeName(detail) === "Employee") {
        const employeeId = readEmployeeId(detail)
        if (employeeId !== null) {
          try {
            const employee = (await getEmployeeById(employeeId, token)) as AdminRecord | null
            const resolvedName = getEmployeeName(employee)
            if (resolvedName && resolvedName !== "Employee") {
              detail = {
                ...detail,
                employee: employee ?? detail.employee,
                employee_name: resolvedName,
                employeeName: resolvedName,
                full_name: resolvedName,
                fullName: resolvedName,
              }
            }
          } catch {
            // Keep original detail when employee lookup fails.
          }
        }
      }

      setSelectedRequestDetail(detail)

      // Keep the list row label in sync once we know the real name.
      if (detail && getEmployeeName(detail) !== "Employee") {
        const resolvedName = getEmployeeName(detail)
        setRequests((prev) =>
          prev.map((row) => {
            if (getRequestId(row) !== requestId) return row
            if (getEmployeeName(row) !== "Employee") return row
            return {
              ...row,
              employee_name: resolvedName,
              employeeName: resolvedName,
              full_name: resolvedName,
              fullName: resolvedName,
            }
          })
        )
      }
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

  const openReview = React.useCallback(
    (rowId: string) => {
      if (!rowId) return
      setSelectedRequestId(rowId)
      setFeedback(null)
      setDecisionComment("")
      setReviewOpen(true)
      void loadRequestDetail(rowId)
    },
    [loadRequestDetail]
  )

  const requestColumns = React.useMemo<Array<Column<AdminRecord>>>(
    () => [
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 160,
        render: (row) => (
          <span className="text-sm font-medium text-foreground">{getEmployeeName(row)}</span>
        ),
      },
      {
        key: "request",
        label: "Request",
        defaultWidth: 160,
        render: (row) => (
          <div className="min-w-0 space-y-0.5">
            <p className="truncate font-medium text-foreground">{getRequestTitle(row)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {readString(row, ["reason"], "No reason supplied")}
            </p>
          </div>
        ),
      },
      {
        key: "submitted",
        label: "Submitted",
        defaultWidth: 110,
        render: (row) => formatDateTime(row.submitted_at ?? row.created_at ?? row.updated_at),
      },
      {
        key: "status",
        label: "Status",
        defaultWidth: 100,
        render: (row) => {
          const meta = getStatusMeta(row.status)
          return (
            <span className={cn("text-xs font-semibold capitalize", meta.textClassName)}>
              {meta.label}
            </span>
          )
        },
      },
      {
        key: "actions",
        label: "Act",
        defaultWidth: 80,
        sortable: false,
        render: (row) => {
          const rowId = getRequestId(row)
          const isHistory = getStatusMeta(row.status).terminal
          return (
            <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                onClick={() => openReview(rowId)}
              >
                {isHistory ? "View" : "Review"}
              </button>
            </div>
          )
        },
      },
    ],
    [openReview]
  )

  const selectedRequestIdRef = React.useRef(selectedRequestId)
  React.useEffect(() => {
    selectedRequestIdRef.current = selectedRequestId
  }, [selectedRequestId])

  const highlightedRequestIdRef = React.useRef(highlightedRequestId)
  React.useEffect(() => {
    highlightedRequestIdRef.current = highlightedRequestId
  }, [highlightedRequestId])

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
      // Match attendance-corrections query shape — avoid sortBy/includeHistory flags
      // that some backends reject with HTTP 400 Bad Request.
      // "draft" is self-service only; load history and filter client-side.
      const apiStatus =
        statusFilter === "all" || statusFilter === "draft" ? undefined : statusFilter
      const result = await listHrProfileUpdateApprovalRequests(token, {
        page: 1,
        limit: 100,
        status: apiStatus,
        includeHistory: statusFilter === "all" || statusFilter === "draft",
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      const listRows =
        statusFilter === "draft"
          ? result.rows.filter((row) => {
              const status = String(row.status ?? "").trim().toLowerCase()
              return status === "draft" || status.includes("draft")
            })
          : result.rows
      // List payloads often only include employee_id — resolve names for display.
      const enrichedRows = await enrichRowsWithEmployeeNames(token, listRows)
      setRequests(enrichedRows)

      // Deep-link / notification highlight opens the review modal once.
      const highlightedId = highlightedRequestIdRef.current
      if (highlightedId) {
        const highlightedRow =
          enrichedRows.find((row) => getRequestId(row) === highlightedId) ?? null
        setSelectedRequestId(highlightedId)
        setSelectedRequestDetail(highlightedRow)
        setReviewOpen(true)
        await loadRequestDetail(highlightedId)
        return
      }

      // Keep selection if it still exists; do not auto-open review modal.
      const currentSelection =
        enrichedRows.find((row) => getRequestId(row) === selectedRequestIdRef.current) ?? null

      if (!currentSelection) {
        setSelectedRequestId("")
        setSelectedRequestDetail(null)
        return
      }

      setSelectedRequestId(getRequestId(currentSelection))
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
  }, [dateFrom, dateTo, loadRequestDetail, statusFilter])

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
      const body = {
        comment: note || (action === "approve" ? "Approved by HR" : "Rejected by HR"),
        metadata: {
          reviewed_from: "HR_PORTAL",
        },
      }

      if (action === "approve") {
        await approveHrProfileUpdateRequest(token, requestId, body)
      } else {
        await rejectHrProfileUpdateRequest(token, requestId, body)
      }

      const successMessage =
        action === "approve"
          ? "Profile update approved and applied to the employee record."
          : "Profile update request rejected."
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

  const filteredRequests = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return requests

    return requests.filter((row) => {
      const haystack = [
        getEmployeeName(row),
        getRequestTitle(row),
        readString(row, ["reason"], ""),
        String(row.status ?? ""),
        getRequestId(row),
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [requests, searchQuery])

  const pendingCount = React.useMemo(
    () => filteredRequests.filter((row) => !getStatusMeta(row.status).terminal).length,
    [filteredRequests]
  )

  const historyCount = React.useMemo(
    () => filteredRequests.filter((row) => getStatusMeta(row.status).terminal).length,
    [filteredRequests]
  )

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (statusFilter !== "all") count += 1
    if (dateFrom.trim()) count += 1
    if (dateTo.trim()) count += 1
    return count
  }, [dateFrom, dateTo, statusFilter])

  const clearFilters = React.useCallback(() => {
    setStatusFilter("all")
    setDateFrom("")
    setDateTo("")
    setSearchQuery("")
    setFeedback(null)
  }, [])

  const employeeName = activeRequest ? getEmployeeName(activeRequest) : ""
  const submittedAt = activeRequest
    ? formatDateTime(activeRequest.submitted_at ?? activeRequest.created_at)
    : ""
  const requestId = activeRequest ? getRequestId(activeRequest) || "—" : "—"
  const requestType = activeRequest
    ? readString(activeRequest, ["request_type", "change_type"], "Profile update")
    : ""

  return (
    <div className="w-full min-w-0 max-w-full space-y-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          Profile Update Approvals
        </h2>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
            onClick={() => void loadRequests()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-rose-500/[0.07] px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-500/15 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="min-w-0 max-w-full space-y-2">
        <div className="flex min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-full">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Requests</h3>
            <p className="text-xs text-muted-foreground">
              Review pending changes and browse past approvals and rejections.
            </p>
          </div>
          <div className="flex min-w-0 max-w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 max-w-full items-center gap-1.5">
              <SearchToggleField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search name, request, status…"
                label="Search requests"
                className="min-w-0 max-w-full"
              />
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger
                  type="button"
                  className={cn(
                    "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted",
                    activeFilterCount > 0 && "border-primary/40 text-primary"
                  )}
                  aria-label="Open filters"
                  title="Filters"
                >
                  <FilterIcon className="size-3.5" />
                  {activeFilterCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold !text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[min(18rem,calc(100vw-1.5rem))] space-y-3 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Filters</p>
                    {activeFilterCount > 0 ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={clearFilters}
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-approval-status" className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => setStatusFilter(value ?? "all")}
                    >
                      <SelectTrigger id="profile-approval-status" className="h-8 w-full text-xs">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All (incl. history)</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">From date</Label>
                    <DatePickerPresets
                      value={dateFrom}
                      onChange={setDateFrom}
                      placeholder="From"
                      className="h-8 w-full px-2 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">To date</Label>
                    <DatePickerPresets
                      value={dateTo}
                      onChange={setDateTo}
                      placeholder="To"
                      className="h-8 w-full px-2 text-xs"
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="min-w-0 max-w-full text-xs leading-relaxed sm:ml-1">
              <span className="font-semibold text-muted-foreground">
                {filteredRequests.length} total
              </span>
              <span className="mx-1.5 text-border">·</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {pendingCount} pending
              </span>
              <span className="mx-1.5 text-border">·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {historyCount} history
              </span>
            </p>
          </div>
        </div>

        <div className="min-w-0 max-w-full">
          <ResizableTable
            title="Profile Update Approval Requests"
            data={filteredRequests}
            columns={requestColumns}
            itemsPerPage={15}
            loading={loading}
            storageKey="hr-profile-update-approval-requests"
            showToolbar={false}
            getRowId={(row) => getRequestId(row) || String(row.id ?? "")}
            onRowSelect={(id) => {
              if (id) openReview(id)
            }}
          />
        </div>
        {!loading && filteredRequests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {requests.length === 0
              ? statusFilter === "all"
                ? "No profile update requests yet — pending and past decisions will appear here."
                : `No ${statusFilter} profile update requests match the current filters.`
              : "No requests match your search."}
          </p>
        ) : null}
      </div>

      <AlertDialog
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open)
          if (!open) {
            setFeedback(null)
          }
        }}
      >
        <AlertDialogContent className="max-h-[min(90vh,44rem)] w-[calc(100%-1.25rem)] max-w-lg overflow-hidden p-0 sm:w-full sm:max-w-xl">
          <div className="sticky top-0 z-10 border-b border-border/70 bg-popover px-5 pt-5 pb-4">
            <AlertDialogHeader className="gap-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Review
                  </p>
                  <AlertDialogTitle className="text-base">
                    {activeRequest ? getRequestTitle(activeRequest) : "Profile update"}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[13px]">
                    {activeRequest
                      ? "Inspect the requested changes, then approve or reject."
                      : "Loading request…"}
                  </AlertDialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {activeRequest ? (
                    <span
                      className={cn(
                        "text-xs font-semibold capitalize",
                        statusMeta.textClassName
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground"
                    onClick={() => setReviewOpen(false)}
                    aria-label="Close"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </AlertDialogHeader>
          </div>

          <div className="max-h-[min(70vh,36rem)] space-y-5 overflow-y-auto px-5 py-4">
            {detailLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading request details…
              </div>
            ) : null}

            {!detailLoading && !activeRequest ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <UserRoundIcon className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Could not load this request.</p>
              </div>
            ) : null}

            {!detailLoading && activeRequest ? (
              <>
                {feedback ? (
                  <div
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 text-sm",
                      error
                        ? "bg-rose-500/[0.07] text-rose-700 ring-1 ring-rose-500/15 dark:text-rose-300"
                        : "bg-emerald-500/[0.07] text-emerald-800 ring-1 ring-emerald-500/15 dark:text-emerald-200"
                    )}
                  >
                    {feedback}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Employee</span>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{employeeName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted</span>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{submittedAt}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Request</span>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      #{requestId}
                      <span className="mx-1.5 text-border">·</span>
                      <span className="font-normal text-muted-foreground">{requestType}</span>
                    </p>
                  </div>
                </div>

                {readString(activeRequest, ["reason"], "") &&
                readString(activeRequest, ["reason"], "") !== "-" ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Reason: </span>
                    {readString(activeRequest, ["reason"], "")}
                  </p>
                ) : null}

                <div className="space-y-3 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Requested changes
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {changeRows.length} field{changeRows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ChangeComparison rows={changeRows} />
                </div>

                <div className="space-y-2.5 border-t border-border/70 pt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    HR note
                  </p>
                  <Textarea
                    className="min-h-[5.5rem] resize-y text-sm"
                    placeholder={
                      statusMeta.terminal
                        ? "This request is already closed."
                        : "Optional note for approval — required clarity on rejection."
                    }
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                    disabled={statusMeta.terminal || actionLoading !== null}
                  />
                  <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-sky-700 dark:text-sky-300">
                    <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span>
                      Approve applies changes to the employee record. Reject with a clear reason so
                      they know what to fix.
                    </span>
                  </p>
                </div>

                {!statusMeta.terminal ? (
                  <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                    <button
                      type="button"
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                      onClick={() => void handleDecision("approve")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "approve" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-300/80 bg-background px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/40 sm:flex-none"
                      onClick={() => void handleDecision("reject")}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "reject" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Reject
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
