"use client"

import * as React from "react"
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
  if (!row) return [] as Array<{ id: string; name: string }>
  const candidates = [row.files, row.pendingFiles, row.pending_files, row.attachments, row.file]
  const files: Array<{ id: string; name: string }> = []
  for (const candidate of candidates) {
    const list = Array.isArray(candidate) ? candidate : candidate ? [candidate] : []
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const record = item as AdminRecord
      const id = rowId(record)
      if (!id) continue
      files.push({
        id,
        name: readString(record, ["fileName", "file_name", "name", "originalName"], `File ${id}`),
      })
    }
  }
  return files
}

export function HrProfileChangeRequestsView() {
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

  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  async function onDecide() {
    const token = readStoredToken()
    if (!token || !form.id) return
    setSaving(true)
    setFormError(null)
    try {
      if (form.mode === "approve") await approveHrProfileChangeRequest(token, form.id, { comment: form.comment || undefined })
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
          <p className="font-medium">{employeeLabel(row)}</p>
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
            setDetail(row)
            const token = readStoredToken()
            const id = rowId(row)
            if (token && id) {
              void getHrProfileChangeRequest(token, id).then((record) => record && setDetail(record)).catch(() => undefined)
            }
          }}
        />
      </div>
      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={optionLabel(detail)}
        row={detail}
        footer={
          profileChangeFiles(detail).length ? (
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
                  Preview {fileItem.name}
                </button>
              ))}
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
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Comment</span><textarea className={textareaClass} value={form.comment ?? ""} onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))} /></label>
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
