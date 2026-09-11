"use client"

import * as React from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { InfoIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  employeeLabel,
  formatDate,
  optionLabel,
  prettify,
  primaryButtonClass,
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
  getHrProfileChangeRequest,
  listHrProfileChangeRequestHistory,
  listHrProfileChangeRequests,
  previewHrProfileChangeRequestFile,
  rejectHrProfileChangeRequest,
  requestHrProfileChangeCorrection,
  startHrProfileChangeReview,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { useDashboardMotion } from "@/lib/dashboard-motion"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

function TipIcon({
  text,
  variant = "default",
}: {
  text: string
  variant?: "default" | "onPrimary"
}) {
  const motionPreset = useDashboardMotion()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={
              variant === "onPrimary"
                ? "inline-flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:text-white"
                : "inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:text-primary"
            }
            aria-label="More information"
          />
        }
      >
        <motion.span
          className="inline-flex"
          animate={
            motionPreset.reduce
              ? undefined
              : { scale: [1, 1.15, 1], opacity: [0.65, 1, 0.65] }
          }
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </motion.span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-72 text-left leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

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

function profileChangeEmployeeName(row: AdminRecord | null) {
  const employee = asRecord(row?.employee)
  const directName = readString(row, ["employee_name", "employeeName", "full_name", "fullName"])
  if (directName) return directName

  const firstName = readString(employee, ["first_name", "firstName"])
  const lastName = readString(employee, ["last_name", "lastName"])
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()
  return fullName || employeeLabel(row)
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

  const detailEmployee = asRecord(detail?.employee)
  const detailItems = Array.isArray(detail?.items)
    ? detail.items.filter((item): item is AdminRecord => Boolean(asRecord(item))).map((item) => asRecord(item) as AdminRecord)
    : []
  const detailStatus = readString(detail, ["status"], "PENDING_REVIEW").toUpperCase()
  const detailContent = detail ? (
    <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">{profileChangeEmployeeName(detail)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {readString(detail, ["reference_number", "referenceNumber"], "Profile change request")}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${profileChangeStatusClass(detailStatus)}`}>
          {prettify(detailStatus)}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Employee no", readString(detailEmployee, ["employee_no", "employeeNo"], "—")],
          ["First name", readString(detailEmployee, ["first_name", "firstName"], "—")],
          ["Last name", readString(detailEmployee, ["last_name", "lastName"], "—")],
          ["Requested by", profileChangeRequesterName(detail)],
          ["Request type", prettify(readString(detail, ["request_type", "requestType"], "Change"))],
          ["Submitted", formatDate(detail.submitted_at ?? detail.submittedAt ?? detail.created_at ?? detail.createdAt)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {readString(detail, ["reason"]) !== "-" ? (
        <div className="rounded-xl border border-border bg-card px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">Reason</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{readString(detail, ["reason"])}</p>
        </div>
      ) : null}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">Requested items</p>
        {detailItems.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {detailItems.map((item, index) => (
              <div key={rowId(item) || index} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="break-words text-sm font-medium text-slate-900">{readString(item, ["field_label", "field_name"], "Profile field")}</p>
                <p className="mt-1 break-words text-xs text-slate-600">{readString(item, ["new_value", "newValue"], "No value")}</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">No field changes recorded.</p>}
      </div>
    </div>
  ) : undefined

  React.useEffect(() => {
    setPhotoPreview(null)
    setPhotoPreviewError(null)
    if (!detailId || !previewFile) {
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
    void previewHrProfileChangeRequestFile(token, detailId, previewFile.id)
      .then((result) => {
        objectUrl = URL.createObjectURL(result.blob)
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setPhotoPreview({ url: objectUrl, name: result.filename || previewFile.name })
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
  }, [detailId, previewFile?.id, previewFile?.name])

  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

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
      toast.success("Saved.")
      setFormOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "req",
      label: "Request",
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium">{profileChangeEmployeeName(row)}</p>
          <p className="text-xs text-muted-foreground">{prettify(readString(row, ["requestType", "request_type"], "Change"))}</p>
        </div>
      ),
    },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "SUBMITTED")} /> },
    { key: "when", label: "Submitted", render: (row) => formatDate(row.submittedAt ?? row.submitted_at ?? row.createdAt) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const id = rowId(row)
        return (
          <div className="flex flex-wrap gap-1">
            <button type="button" className={actionButtonClass} disabled={busyId === `rev-${id}`} onClick={() => {
              const token = readStoredToken()
              if (!token || !id) return
              setBusyId(`rev-${id}`)
              void startHrProfileChangeReview(token, id, {})
                .then(() => { toast.success("Review started."); return load() })
                .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not start review."))
                .finally(() => setBusyId(""))
            }}>Start review</button>
            <button type="button" className={actionButtonClass} onClick={() => { setForm({ id, mode: "approve" }); setFormOpen(true) }}>Approve</button>
            <button type="button" className={actionButtonClass} onClick={() => { setForm({ id, mode: "correct" }); setFormOpen(true) }}>Return</button>
            <button type="button" className={actionButtonClass} onClick={() => { setForm({ id, mode: "reject" }); setFormOpen(true) }}>Reject</button>
            <button
              type="button"
              className={actionButtonClass}
              disabled={busyId === `hist-${id}`}
              onClick={() => {
                const token = readStoredToken()
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
              }}
            >
              History
            </button>
          </div>
        )
      },
    },
  ], [busyId, load])

  if (!canAccess) return null

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="Employees"
        title={
          <>
            Requests
            <TipIcon
              variant="onPrimary"
              text="Review employee requests to change name, phone, address, or emergency contact. This is separate from older profile-update approvals."
            />
          </>
        }
        actions={
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      <div className="flex flex-wrap items-end gap-6">
        {[
          { label: "Requests", value: rows.length },
          {
            label: "Open",
            value: rows.filter(
              (row) =>
                !["APPROVED", "REJECTED", "CANCELLED"].includes(readString(row, ["status"]).toUpperCase()),
            ).length,
          },
          {
            label: "Approved",
            value: rows.filter((row) => readString(row, ["status"]).toUpperCase() === "APPROVED").length,
          },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className="text-lg font-semibold tabular-nums leading-none text-primary">{item.value}</p>
          </div>
        ))}
      </div>
      <SearchToggleField value={search} onChange={setSearch} placeholder="Search" />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="Profile change requests"
          data={visible}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey="hr-profile-change-requests"
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
        description={readString(detail, ["reference_number", "referenceNumber"], optionLabel(detail))}
        row={detail}
        content={detailContent}
        popupClassName="w-[min(96vw,56rem)] max-w-4xl"
        footer={
          profileChangeFiles(detail).length ? (
            <div className="w-full space-y-3">
              {photoPreviewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Loading submitted photo…
                </div>
              ) : null}
              {photoPreview ? (
                <div className="overflow-hidden rounded-xl border border-border bg-muted/20 p-2">
                  <Image
                    src={photoPreview.url}
                    alt={`Submitted profile photo for ${profileChangeEmployeeName(detail)}`}
                    width={640}
                    height={640}
                    unoptimized
                    className="mx-auto max-h-80 w-auto rounded-lg object-contain"
                  />
                  <p className="mt-2 text-center text-xs text-muted-foreground">{photoPreview.name}</p>
                </div>
              ) : null}
              {photoPreviewError ? <p className="text-sm text-rose-600">{photoPreviewError}</p> : null}
              <div className="flex flex-wrap gap-2">
                {profileChangeFiles(detail).map((fileItem) => (
                  <button
                    key={fileItem.id}
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `file-${fileItem.id}`}
                    onClick={() => {
                      const token = readStoredToken()
                      const id = detail ? rowId(detail) : ""
                      if (!token || !id) return
                      setBusyId(`file-${fileItem.id}`)
                      void previewHrProfileChangeRequestFile(token, id, fileItem.id)
                        .then((result) => downloadBlob(result.blob, result.filename))
                        .catch((errorObject) =>
                          toast.error(errorObject instanceof Error ? errorObject.message : "Could not open file."),
                        )
                        .finally(() => setBusyId(""))
                    }}
                  >
                    Download {fileItem.name}
                  </button>
                ))}
              </div>
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
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Rejection reason</span><textarea className={textareaClass} value={form.rejection_reason ?? ""} onChange={(event) => setForm((current) => ({ ...current, rejection_reason: event.target.value }))} /></label>
            ) : null}
            {form.mode === "correct" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Correction instructions</span><textarea className={textareaClass} value={form.correction_instructions ?? ""} onChange={(event) => setForm((current) => ({ ...current, correction_instructions: event.target.value }))} /></label>
            ) : null}
            {form.mode !== "approve" ? (
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Comment</span><textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} /></label>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onDecide()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
