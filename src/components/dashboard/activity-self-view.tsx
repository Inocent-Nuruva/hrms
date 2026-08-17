"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  HeroBand,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  formatDate,
  inputClass,
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
import {
  addMyActivityEntry,
  createMyActivityReport,
  deleteMyActivityEntry,
  getMyActivitiesToday,
  getMyActivityReport,
  listActivityCategories,
  listMyActivities,
  submitMyActivityReport,
  type AdminRecord,
} from "@/lib/admin-api"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type ActivitySelfTab = "today" | "reports"

const ENTRY_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "DEFERRED", "CANCELLED"] as const

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function newRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function reportEntries(report: AdminRecord | null) {
  if (!report) return []
  return asRecordArray(report.entries ?? report.items ?? report.activities)
}

export function ActivitySelfView({ activeTab }: { activeTab: ActivitySelfTab }) {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [today, setToday] = React.useState<AdminRecord | null>(null)
  const [reports, setReports] = React.useState<AdminRecord[]>([])
  const [categories, setCategories] = React.useState<AdminRecord[]>([])
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createMode, setCreateMode] = React.useState<"report" | "entry" | "submit">("report")
  const [form, setForm] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [busyId, setBusyId] = React.useState("")

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const results = await Promise.allSettled([
      getMyActivitiesToday(token).then((record) => {
        const report = asRecord(record?.report) ?? record
        setToday(report)
        if (activeTab === "today") setSelected(report)
      }),
      listMyActivities(token, { limit: 50 }).then(setReports),
      listActivityCategories(token).then(setCategories).catch(() => setCategories([])),
    ])
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load your activities.")
    }
    setLoading(false)
  }, [activeTab, leaveIfForbidden])

  React.useEffect(() => {
    void load()
  }, [load])

  async function openReport(row: AdminRecord) {
    const token = readStoredToken()
    const id = rowId(row)
    if (!token || !id) {
      setSelected(row)
      return
    }
    try {
      const detail = await getMyActivityReport(token, id)
      setSelected(detail ?? row)
    } catch {
      setSelected(row)
    }
  }

  async function onSave() {
    const token = readStoredToken()
    if (!token) return
    setSaving(true)
    setFormError(null)
    try {
      if (createMode === "report") {
        if (!form.activity_date) throw new Error("Activity date is required.")
        await createMyActivityReport(token, {
          activity_date: form.activity_date,
          client_request_id: newRequestId(),
          source: "WEB",
        })
      } else if (createMode === "entry") {
        if (!form.id || !form.activity_category_id || !form.title || !form.description) {
          throw new Error("Category, title, and description are required.")
        }
        await addMyActivityEntry(token, form.id, {
          activity_category_id: Number(form.activity_category_id),
          title: form.title,
          description: form.description,
          status: form.status || "PLANNED",
          outcome: form.outcome || undefined,
          client_request_id: newRequestId(),
        })
      } else {
        if (!form.id || !form.employee_summary) throw new Error("A summary is required to submit.")
        await submitMyActivityReport(token, form.id, {
          employee_summary: form.employee_summary,
          overall_remarks: form.overall_remarks || undefined,
          client_request_id: newRequestId(),
        })
      }
      toast.success("Saved.")
      setCreateOpen(false)
      await load()
    } catch (errorObject) {
      setFormError(errorObject instanceof Error ? errorObject.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const activeReport = activeTab === "today" ? today : selected
  const entries = reportEntries(activeReport)

  const columns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "date",
      label: "Date",
      render: (row) => formatDate(row.activityDate ?? row.activity_date),
    },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "DRAFT")} /> },
    { key: "summary", label: "Summary", render: (row) => readString(row, ["employeeSummary", "employee_summary", "title"], "—") },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={actionButtonClass} onClick={() => void openReport(row)}>Open</button>
          <button
            type="button"
            className={actionButtonClass}
            onClick={() => {
              setCreateMode("entry")
              setForm({ id: rowId(row), status: "COMPLETED" })
              setCreateOpen(true)
            }}
          >
            Add entry
          </button>
          <button
            type="button"
            className={actionButtonClass}
            onClick={() => {
              setCreateMode("submit")
              setForm({ id: rowId(row), employee_summary: "" })
              setCreateOpen(true)
            }}
          >
            Submit
          </button>
        </div>
      ),
    },
  ], [])

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My activities"
        title={activeTab === "today" ? "Today's report" : "My daily reports"}
        description="Log work, add entries, and submit the report your manager reviews."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setCreateMode("report")
                setForm({ activity_date: todayDate() })
                setCreateOpen(true)
              }}
            >
              <PlusIcon className="size-4" /> New report
            </button>
          </div>
        }
      />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Reports" value={reports.length} />
        <MetricTile label="Today" value={today ? readString(today, ["status"], "OPEN") : "None"} />
        <MetricTile label="Entries today" value={reportEntries(today).length} />
      </div>

      {activeTab === "today" ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          {today ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{formatDate(today.activityDate ?? today.activity_date)}</p>
                  <StatusChip value={readString(today, ["status"], "DRAFT")} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => {
                      setCreateMode("entry")
                      setForm({ id: rowId(today), status: "COMPLETED" })
                      setCreateOpen(true)
                    }}
                  >
                    Add entry
                  </button>
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => {
                      setCreateMode("submit")
                      setForm({ id: rowId(today), employee_summary: "" })
                      setCreateOpen(true)
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet. Add the work you completed today.</p>
              ) : (
                <ul className="grid gap-2">
                  {entries.map((entry) => {
                    const id = rowId(entry)
                    return (
                      <li key={id || readString(entry, ["title"])} className="rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{readString(entry, ["title"], "Entry")}</p>
                            <p className="text-xs text-muted-foreground">{readString(entry, ["description"], "")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusChip value={readString(entry, ["status"], "PLANNED")} />
                            <button
                              type="button"
                              className={actionButtonClass}
                              disabled={busyId === `del-${id}`}
                              onClick={() => {
                                const token = readStoredToken()
                                const reportId = rowId(today)
                                if (!token || !reportId || !id) return
                                setBusyId(`del-${id}`)
                                void deleteMyActivityEntry(token, reportId, id)
                                  .then(() => { toast.success("Entry removed."); return load() })
                                  .catch((errorObject) => toast.error(errorObject instanceof Error ? errorObject.message : "Could not delete."))
                                  .finally(() => setBusyId(""))
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No report for today yet. Create one to start logging work.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ResizableTable
            title="My reports"
            data={reports}
            columns={columns}
            loading={loading}
            itemsPerPage={20}
            showExport={false}
            storageKey="me-activities-reports"
            onRowSelect={(_, row) => row && void openReport(row)}
          />
        </div>
      )}

      {activeTab === "reports" && selected ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{formatDate(selected.activityDate ?? selected.activity_date)}</h2>
            <StatusChip value={readString(selected, ["status"], "DRAFT")} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{readString(selected, ["employeeSummary", "employee_summary"], "No summary yet.")}</p>
          <ul className="mt-3 grid gap-2">
            {entries.map((entry) => (
              <li key={rowId(entry) || readString(entry, ["title"])} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{readString(entry, ["title"], "Entry")}</span>
                <span className="ml-2 text-xs text-muted-foreground">{prettify(readString(entry, ["status"], ""))}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{createMode === "report" ? "New daily report" : createMode === "entry" ? "Add activity" : "Submit report"}</DialogTitle>
            <DialogDescription>Log the work you did so your manager can review it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "report" ? (
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Activity date</span>
                <input type="date" className={inputClass} value={form.activity_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, activity_date: event.target.value }))} />
              </label>
            ) : null}
            {createMode === "entry" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Category</span>
                  <select className={inputClass} value={form.activity_category_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, activity_category_id: event.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={rowId(category)} value={rowId(category)}>{optionLabel(category)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Title</span><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Description</span><textarea className={textareaClass} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Status</span>
                  <select className={inputClass} value={form.status ?? "COMPLETED"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                    {ENTRY_STATUSES.map((status) => <option key={status} value={status}>{prettify(status)}</option>)}
                  </select>
                </label>
              </>
            ) : null}
            {createMode === "submit" ? (
              <>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Summary</span><textarea className={textareaClass} value={form.employee_summary ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_summary: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm"><span className="font-medium">Remarks</span><textarea className={textareaClass} value={form.overall_remarks ?? ""} onChange={(event) => setForm((current) => ({ ...current, overall_remarks: event.target.value }))} /></label>
              </>
            ) : null}
            {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
