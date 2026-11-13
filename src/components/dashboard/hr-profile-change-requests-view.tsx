"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { useSearchParams } from "next/navigation"
import {
  ArrowRightIcon, CheckIcon, FilterIcon, HistoryIcon, RefreshCwIcon, RotateCcwIcon, UserRoundIcon, XIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  actionButtonClass,
  asRecord,
  formatDate,
  pageBleedClass,
  prettify,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  approveHrProfileChangeRequest,
  extractProfilePhotoUrl,
  getHrProfileChangeRequest,
  listHrProfileChangeRequestHistory,
  listHrProfileChangeRequests,
  previewHrProfileChangeRequestFile,
  rejectHrProfileChangeRequest,
  requestHrProfileChangeCorrection,
  startHrProfileChangeReview,
  type AdminRecord,
} from "@/lib/admin-api"
import { cn } from "@/lib/utils"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { PageHeader } from "@/components/ui/page-header"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function profileChangeFiles(row: AdminRecord | null) {
  if (!row) return [] as Array<{ id: string; name: string; mimeType: string }>
  const candidates = [row.files, row.pendingFiles, row.pending_files, row.attachments, row.file]
  const files: Array<{ id: string; name: string; mimeType: string }> = []
  for (const candidate of candidates) {
    const list = Array.isArray(candidate) ? candidate : candidate ? [candidate] : []
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const record = item as AdminRecord
      const id = rowId(record)
      if (!id) continue
      files.push({
        id,
        name: readString(
          record,
          ["original_file_name", "originalFileName", "fileName", "file_name", "name", "originalName"],
          `File ${id}`,
        ),
        mimeType: readString(record, ["mime_type", "mimeType", "content_type", "contentType"]),
      })
    }
  }
  return files
}

function personName(...records: Array<AdminRecord | null | undefined>) {
  for (const record of records) {
    const firstName = readString(record, ["first_name", "firstName"])
    const lastName = readString(record, ["last_name", "lastName"])
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
    if (fullName) return fullName
    const named = readString(record, ["full_name", "fullName", "employee_name", "employeeName"])
    if (named) return named
  }
  return ""
}

function profileChangeEmployeeName(row: AdminRecord | null) {
  const employee = asRecord(row?.employee)
  const user = asRecord(employee?.user) ?? asRecord(asRecord(employee?.company_user)?.user)
  return (
    personName(employee, user) ||
    readString(row, ["employee_name", "employeeName"]) ||
    personName(asRecord(row?.requested_by_user)) ||
    readString(employee, ["employee_no", "employeeNo"]) ||
    "Employee"
  )
}

function profileChangeEmployeeNo(row: AdminRecord | null) {
  return readString(asRecord(row?.employee), ["employee_no", "employeeNo"])
}

function requestReference(row: AdminRecord | null) {
  return readString(row, ["reference_number", "referenceNumber"])
}

function requestWhen(row: AdminRecord | null) {
  if (!row) return "—"
  return formatDate(
    row.submitted_at ?? row.submittedAt ?? row.created_at ?? row.createdAt ?? row.approved_at ?? row.reviewed_at,
  )
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function profileChangeRequesterName(row: AdminRecord | null) {
  const requester = asRecord(row?.requested_by_user)
  const firstName = readString(requester, ["first_name", "firstName"])
  const lastName = readString(requester, ["last_name", "lastName"])
  const name = [firstName, lastName].filter(Boolean).join(" ").trim()
  const email = readString(requester, ["email"])
  return (
    name ||
    readString(row, ["requested_by_name", "requestedByName", "requester_name", "requesterName"]) ||
    email ||
    "Unknown requester"
  )
}

function requestStatus(row: AdminRecord | null) {
  return readString(row, ["status"], "PENDING_REVIEW").toUpperCase()
}

function isOpenRequest(row: AdminRecord | null) {
  return !["APPROVED", "REJECTED", "CANCELLED", "SUPERSEDED"].includes(requestStatus(row))
}

function looksLikeFilePath(value: string) {
  const text = value.trim()
  if (!text) return false
  return /[/\\]/.test(text) && /(\.png|\.jpe?g|\.webp|\.gif|\.svg|uploads|private-uploads|profile-photo)/i.test(text)
}

function isPhotoChange(row: AdminRecord | null, item?: AdminRecord | null) {
  const type = readString(row, ["request_type", "requestType"]).toUpperCase()
  const field = readString(item, ["field_name", "fieldName", "field_label", "fieldLabel"]).toLowerCase()
  const next = readString(item, ["new_value", "newValue"])
  return type === "PROFILE_PHOTO" || field.includes("photo") || field.includes("avatar") || looksLikeFilePath(next)
}

function publicPhotoUrl(value: string | null | undefined) {
  const text = value?.trim() ?? ""
  if (!text || text === "—" || /private-uploads/i.test(text)) return null
  return extractProfilePhotoUrl(text)
}

function employeeAvatarUrl(row: AdminRecord | null) {
  const employee = asRecord(row?.employee)
  const picture = asRecord(employee?.profile_picture)
  const candidates = [
    readString(employee, [
      "profile_photo_url",
      "profilePhotoUrl",
      "uploaded_profile_photo_url",
      "uploadedProfilePhotoUrl",
    ]),
    readString(picture, ["url", "src", "path"]),
    extractProfilePhotoUrl(employee),
  ]
  for (const candidate of candidates) {
    const resolved = publicPhotoUrl(candidate)
    if (resolved) return resolved
  }
  return null
}

function PersonAvatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    setFailed(false)
  }, [src])
  const showPhoto = Boolean(src) && !failed
  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold tracking-wide text-slate-600">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src ?? ""} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initialsFromName(name)
      )}
    </div>
  )
}

function requestChangeSummary(row: AdminRecord) {
  if (isPhotoChange(row, asRecord(Array.isArray(row.items) ? row.items[0] : null))) {
    return "Profile photo"
  }
  const items = Array.isArray(row.items) ? row.items : []
  const first = items.map((item) => asRecord(item)).find(Boolean)
  if (!first) return prettify(readString(row, ["request_type", "requestType"], "Profile change"))
  const label = readString(first, ["field_label", "field_name", "fieldName"], "Profile field")
  const next = readString(first, ["new_value", "newValue"], "")
  if (looksLikeFilePath(next)) return label
  return next ? `${label} → ${next}` : label
}

function PhotoFrame({
  src,
  label,
  loading,
  empty,
}: {
  src?: string | null
  label: string
  loading?: boolean
  empty?: string
}) {
  return (
    <figure className="flex min-w-0 flex-col items-center text-center">
      <div className="flex size-36 items-center justify-center overflow-hidden rounded-full bg-slate-100 sm:size-40">
        {loading ? (
          <FluentLoadingIndicator className="size-5 animate-spin text-slate-400" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 px-3 text-slate-400">
            <UserRoundIcon className="size-8" />
            <span className="text-[11px] leading-tight">{empty ?? "No photo"}</span>
          </div>
        )}
      </div>
      <figcaption className="mt-3 text-sm font-medium text-slate-600">{label}</figcaption>
    </figure>
  )
}

const approveButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
const declineButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
const returnButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"

function profileChangeStatusClass(status: string) {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "REJECTED":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "UNDER_REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "PENDING_REVIEW":
      return "border-sky-200 bg-sky-50 text-sky-700"
    case "SUPERSEDED":
      return "border-slate-200 bg-slate-100 text-slate-600"
    default:
      return "border-violet-200 bg-violet-50 text-violet-700"
  }
}

export function HrProfileChangeRequestsView() {
  const searchParams = useSearchParams()
  const highlightedRequestId = (
    searchParams?.get("highlight") ??
    searchParams?.get("requestId") ??
    searchParams?.get("request_id") ??
    ""
  ).trim()
  const actor = useDashboardActor()
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute("/dashboard/employees/profile-change-requests", actor.permissionLabels, actor.accessMode)
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [rows, setRows] = React.useState<AdminRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"open" | "all" | "approved" | "rejected">("all")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [historyRows, setHistoryRows] = React.useState<AdminRecord[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [photoPreview, setPhotoPreview] = React.useState<{ url: string; name: string } | null>(null)
  const [photoPreviewLoading, setPhotoPreviewLoading] = React.useState(false)
  const [photoPreviewError, setPhotoPreviewError] = React.useState<string | null>(null)
  const openedHighlightedRequestRef = React.useRef("")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setRows(await listHrProfileChangeRequests(token, { limit: 50 }))
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) {
        setLoading(false)
        return
      }
      setRows([])
      setError(errorObject instanceof Error ? errorObject.message : "Could not load profile change requests.")
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const openRequestDetails = React.useCallback((row: AdminRecord) => {
    setDetail(row)
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    void getHrProfileChangeRequest(token, id)
      .then((record) => {
        if (record) setDetail(record)
      })
      .catch((errorObject) =>
        toast.error(errorObject instanceof Error ? errorObject.message : "Could not load request details."),
      )
  }, [])

  React.useEffect(() => {
    if (!canAccess || !highlightedRequestId) return
    if (openedHighlightedRequestRef.current === highlightedRequestId) return
    openedHighlightedRequestRef.current = highlightedRequestId
    const listedRow = rows.find((row) => rowId(row) === highlightedRequestId)
    openRequestDetails(listedRow ?? { id: highlightedRequestId })
  }, [canAccess, highlightedRequestId, openRequestDetails, rows])

  const detailId = rowId(detail)
  const previewFile = profileChangeFiles(detail).find(
    (file) => file.mimeType.startsWith("image/") || readString(detail, ["request_type", "requestType"]).toUpperCase() === "PROFILE_PHOTO",
  )
  const previewFileId = previewFile?.id
  const previewFileName = previewFile?.name

  const detailItems = Array.isArray(detail?.items)
    ? detail.items.filter((item): item is AdminRecord => Boolean(asRecord(item))).map((item) => asRecord(item) as AdminRecord)
    : []
  const photoChangeItems = detailItems.filter((item) => isPhotoChange(detail, item))
  const textChangeItems = detailItems.filter((item) => !isPhotoChange(detail, item))
  const showPhotoComparison = photoChangeItems.length > 0 || isPhotoChange(detail)
  const currentPhotoSrc =
    publicPhotoUrl(
      readString(photoChangeItems[0], ["old_value", "oldValue", "current_value", "currentValue"]),
    ) || employeeAvatarUrl(detail)
  const detailStatus = requestStatus(detail)
  const detailIsOpen = isOpenRequest(detail)
  const detailReason = readString(detail, ["reason"])
  const detailType = prettify(readString(detail, ["request_type", "requestType"], "Profile change"))
  const detailWhen = requestWhen(detail)
  const detailContent = detail ? (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{detailType}</p>
          <p className="mt-1 text-xs text-slate-500">
            {[requestReference(detail), detailWhen !== "—" ? detailWhen : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${profileChangeStatusClass(detailStatus)}`}>
          {prettify(detailStatus)}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-slate-600">
          Requested by <span className="font-medium text-slate-900">{profileChangeRequesterName(detail)}</span>
        </p>
        {detailReason && detailReason !== "-" ? (
          <p className="text-slate-500">{detailReason}</p>
        ) : null}
      </div>
      {showPhotoComparison ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start justify-items-center gap-x-4 pt-1 sm:gap-x-8">
          <PhotoFrame src={currentPhotoSrc} label="Current" empty="No current photo" />
          <div className="flex h-36 items-center sm:h-40">
            <ArrowRightIcon className="size-5 text-slate-300" />
          </div>
          <PhotoFrame
            src={photoPreview?.url}
            label="Requested"
            loading={photoPreviewLoading}
            empty={photoPreviewError ?? "Photo not available"}
          />
        </div>
      ) : null}
      {textChangeItems.length ? (
        <div className="space-y-4">
          {textChangeItems.map((item, index) => {
            const previous = readString(item, ["old_value", "oldValue", "current_value", "currentValue"], "—")
            const next = readString(item, ["new_value", "newValue"], "—")
            return (
              <div key={rowId(item) || index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-baseline">
                <p className="text-xs font-medium text-slate-500 sm:col-span-3">
                  {readString(item, ["field_label", "field_name", "fieldName"], "Requested")}
                </p>
                <p className="min-w-0 break-words text-sm text-slate-500">{previous || "—"}</p>
                <ArrowRightIcon className="hidden size-4 text-slate-300 sm:block" />
                <p className="min-w-0 break-words text-sm font-medium text-slate-900">{next}</p>
              </div>
            )
          })}
        </div>
      ) : null}
      {!showPhotoComparison && textChangeItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No field changes recorded.</p>
      ) : null}
    </div>
  ) : undefined

  React.useEffect(() => {
    setPhotoPreview(null)
    setPhotoPreviewError(null)
    if (!detailId || !previewFileId) {
      setPhotoPreviewLoading(false)
      return
    }

    const token = readStoredToken()
    if (!token) {
      setPhotoPreviewError("Authentication required to preview this photo.")
      return
    }

    let active = true
    let objectUrl = ""
    setPhotoPreviewLoading(true)
    void previewHrProfileChangeRequestFile(token, detailId, previewFileId)
      .then((result) => {
        objectUrl = URL.createObjectURL(result.blob)
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setPhotoPreview({ url: objectUrl, name: result.filename || previewFileName || "Requested photo" })
      })
      .catch((errorObject) => {
        if (active) {
          setPhotoPreviewError(errorObject instanceof Error ? errorObject.message : "Could not preview this photo.")
        }
      })
      .finally(() => {
        if (active) setPhotoPreviewLoading(false)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [detailId, previewFileId, previewFileName])

  const counts = React.useMemo(() => ({
    all: rows.length,
    open: rows.filter((row) => isOpenRequest(row)).length,
    approved: rows.filter((row) => requestStatus(row) === "APPROVED").length,
    rejected: rows.filter((row) => requestStatus(row) === "REJECTED").length,
  }), [rows])

  const visible = rows.filter((row) => {
    const status = requestStatus(row)
    if (statusFilter === "open" && !isOpenRequest(row)) return false
    if (statusFilter === "approved" && status !== "APPROVED") return false
    if (statusFilter === "rejected" && status !== "REJECTED") return false
    if (search && !JSON.stringify(row).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function openDecision(row: AdminRecord, mode: "approve" | "reject" | "correct") {
    const id = rowId(row)
    if (!id) return
    setForm({ id, mode })
    setFormError(null)
    setFormOpen(true)
  }

  function openHistory(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) return
    setBusyId(`hist-${id}`)
    setHistoryOpen(true)
    setHistoryLoading(true)
    void listHrProfileChangeRequestHistory(token, id)
      .then(setHistoryRows)
      .catch((errorObject) => {
        setHistoryRows([])
        toast.error(errorObject instanceof Error ? errorObject.message : "Could not load history.")
      })
      .finally(() => {
        setHistoryLoading(false)
        setBusyId("")
      })
  }

  async function onDecide() {
    const token = readStoredToken()
    if (!token || !form.id) return
    setSaving(true)
    setFormError(null)
    try {
      if (form.mode === "approve") await approveHrProfileChangeRequest(token, form.id)
      else if (form.mode === "reject") {
        if (!form.rejection_reason) throw new Error("Rejection reason is required.")
        await rejectHrProfileChangeRequest(token, form.id, {
          rejection_reason: form.rejection_reason,
          comment: form.comment || undefined,
        })
      } else {
        if (!form.correction_instructions) throw new Error("Correction instructions are required.")
        await requestHrProfileChangeCorrection(token, form.id, {
          correction_instructions: form.correction_instructions,
          comment: form.comment || undefined,
        })
      }
      toast.success(form.mode === "approve" ? "Request approved." : form.mode === "reject" ? "Request declined." : "Sent back for correction.")
      setFormOpen(false)
      setDetail(null)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "employee",
      label: "Employee",
      defaultWidth: 260,
      render: (row) => {
        const name = profileChangeEmployeeName(row)
        return (
          <div className="flex min-w-0 items-center gap-3">
            <PersonAvatar name={name} src={employeeAvatarUrl(row)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
              <p className="truncate text-xs text-slate-500">
                {[profileChangeEmployeeNo(row), requestReference(row)].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: "change",
      label: "Change",
      defaultWidth: 140,
      render: (row) => (
        <span className="inline-flex max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
          {requestChangeSummary(row)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      defaultWidth: 120,
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${profileChangeStatusClass(requestStatus(row))}`}>
          {prettify(requestStatus(row))}
        </span>
      ),
    },
    {
      key: "when",
      label: "Submitted",
      defaultWidth: 120,
      render: (row) => <span className="text-sm font-medium text-slate-800">{requestWhen(row)}</span>,
    },
    {
      key: "actions",
      label: "",
      defaultWidth: 88,
      render: (row) => (
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md bg-sky-50 px-2.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
          onClick={(event) => {
            event.stopPropagation()
            openRequestDetails(row)
          }}
        >
          {isOpenRequest(row) ? "Review" : "View"}
        </button>
      ),
    },
  ], [openRequestDetails])

  if (!canAccess) return null

  return (
    <section
      className={cn(
        pageBleedClass,
        "min-w-0 overflow-hidden border-y border-border bg-background shadow-sm sm:border-x",
      )}
    >
      <PageHeader
        className="border-b border-border px-3 py-3"
        title="Profile changes"
        description="Review employee change requests and return incomplete submissions"
        actions={
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary transition-colors hover:bg-muted disabled:opacity-60"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh profile change requests"
          title="Refresh"
        >
          <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
        </button>
        }
      />
      <div className="border-b border-border bg-muted/[0.12]">
        <div className="grid grid-cols-4">
          {([
            { key: "all", label: "All", value: counts.all, valueClass: "text-foreground", activeClass: "bg-primary/[0.06]" },
            { key: "open", label: "Open", value: counts.open, valueClass: "text-sky-600 dark:text-sky-400", activeClass: "bg-sky-500/[0.08]" },
            { key: "approved", label: "Approved", value: counts.approved, valueClass: "text-emerald-600 dark:text-emerald-400", activeClass: "bg-emerald-500/[0.08]" },
            { key: "rejected", label: "Declined", value: counts.rejected, valueClass: "text-rose-600 dark:text-rose-400", activeClass: "bg-rose-500/[0.08]" },
          ] as const).map((item, index) => {
            const active = statusFilter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                aria-pressed={active}
                className={cn(
                  "relative min-w-0 px-3 py-1.5 text-left transition-colors",
                  active ? item.activeClass : "hover:bg-muted/40",
                )}
              >
                {index > 0 ? <span className="absolute top-2 bottom-2 left-0 w-px bg-border" aria-hidden /> : null}
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className={cn("mt-0.5 text-sm font-semibold tabular-nums leading-tight tracking-tight", item.valueClass)}>
                  {item.value}
                </p>
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-b border-border px-3 py-2">
        <SearchToggleField value={search} onChange={setSearch} placeholder="Search employee or change" active={Boolean(search.trim())} />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Filter requests"
                title="Filter"
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                  statusFilter === "all"
                    ? "border-sky-200/80 bg-sky-50/70 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                    : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
                )}
              />
            }
          >
            <FilterIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {([
              ["all", "All"],
              ["open", `Open (${counts.open})`],
              ["approved", "Approved"],
              ["rejected", "Declined"],
            ] as const).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                className="justify-between gap-2 text-xs"
                onClick={() => setStatusFilter(value)}
              >
                <span>{label}</span>
                {statusFilter === value ? <CheckIcon className="size-3.5 text-[var(--primary)]" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error ? <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-300">{error}</div> : null}
      <div className="min-w-0">
        <ResizableTable
          title="Profile change requests"
          data={visible}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey="hr-profile-change-requests"
          compact
          toolbarClassName="mb-0 border-b border-border bg-muted/[0.12] px-3 py-2"
          frameClassName="rounded-none border-0 shadow-none"
          onRowSelect={(_, row) => {
            if (!row) return
            openRequestDetails(row)
          }}
        />
      </div>
      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={profileChangeEmployeeName(detail)}
        description={profileChangeEmployeeNo(detail)}
        row={detail}
        content={
          detail ? (
            <div className="space-y-6">
              {detailContent}
              {detailIsOpen ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button type="button" className={declineButtonClass} onClick={() => openDecision(detail, "reject")}>
                    <XIcon className="size-4" /> Decline
                  </button>
                  <button type="button" className={returnButtonClass} onClick={() => openDecision(detail, "correct")}>
                    <RotateCcwIcon className="size-4" /> Return
                  </button>
                  <button type="button" className={approveButtonClass} onClick={() => openDecision(detail, "approve")}>
                    <CheckIcon className="size-4" /> Approve
                  </button>
                </div>
              ) : null}
            </div>
          ) : undefined
        }
        popupClassName="w-[calc(100%-1rem)] max-w-2xl"
        footer={
          detail ? (
            <div className="flex w-full flex-wrap items-center gap-2">
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `hist-${detailId}`}
                onClick={() => openHistory(detail)}
              >
                <HistoryIcon className="size-3.5" /> History
              </button>
              {profileChangeFiles(detail).map((fileItem) => (
                <button
                  key={fileItem.id}
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `file-${fileItem.id}`}
                  onClick={() => {
                    const token = readStoredToken()
                    if (!token || !detailId) return
                    setBusyId(`file-${fileItem.id}`)
                    void previewHrProfileChangeRequestFile(token, detailId, fileItem.id)
                      .then((result) => downloadBlob(result.blob, result.filename))
                      .catch((errorObject) =>
                        toast.error(errorObject instanceof Error ? errorObject.message : "Could not open file."),
                      )
                      .finally(() => setBusyId(""))
                  }}
                >
                  Download {fileItem.mimeType.startsWith("image/") ? "photo" : fileItem.name}
                </button>
              ))}
              {detailIsOpen && detailStatus === "PENDING_REVIEW" ? (
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busyId === `rev-${detailId}`}
                  onClick={() => {
                    const token = readStoredToken()
                    if (!token || !detailId) return
                    setBusyId(`rev-${detailId}`)
                    void startHrProfileChangeReview(token, detailId, {})
                      .then(() => {
                        toast.success("Review started.")
                        return getHrProfileChangeRequest(token, detailId)
                      })
                      .then((record) => {
                        if (record) setDetail(record)
                        return load()
                      })
                      .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not start review."))
                      .finally(() => setBusyId(""))
                  }}
                >
                  {busyId === `rev-${detailId}` ? <FluentLoadingIndicator className="size-3.5 animate-spin" /> : null}
                  Start review
                </button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Request history</DialogTitle>
            <DialogDescription>Audit events for this profile change request.</DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-auto">
              {historyRows.map((row, index) => (
                <div key={rowId(row) || index} className="border-b border-border py-2 text-sm last:border-0">
                  <p className="font-medium">{prettify(readString(row, ["action", "event", "status", "type"], "Update"))}</p>
                  <p className="text-muted-foreground">
                    {readString(row, ["comment", "note", "message"], formatDate(row.createdAt ?? row.created_at))}
                  </p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setHistoryOpen(false)}>
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.mode === "approve" ? "Approve" : form.mode === "reject" ? "Reject" : "Return for correction"}</DialogTitle>
            <DialogDescription>
              {form.mode === "approve"
                ? "Confirm this change. It will be applied to the employee record."
                : form.mode === "reject"
                  ? "Tell the employee why this cannot be applied."
                  : "Ask the employee to correct the request and send it again."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {form.mode === "reject" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Rejection reason</span><Textarea className={textareaClass} value={form.rejection_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, rejection_reason: event.target.value }))} /></label>
            ) : null}
            {form.mode === "correct" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Correction instructions</span><Textarea className={textareaClass} value={form.correction_instructions ?? ""} onChange={(event) => setForm((current) => ({ ...current, correction_instructions: event.target.value }))} /></label>
            ) : null}
            {form.mode !== "approve" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Comment</span><Textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} /></label>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setFormOpen(false)}>Cancel</button>
            <button
              type="button"
              className={form.mode === "approve" ? approveButtonClass : form.mode === "reject" ? declineButtonClass : returnButtonClass}
              onClick={() => void onDecide()}
              disabled={saving}
            >
              {saving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null}
              {form.mode === "approve" ? "Approve request" : form.mode === "reject" ? "Decline request" : "Send back"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
