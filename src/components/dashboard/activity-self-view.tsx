"use client"

import * as React from "react"
import { Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  CompactStatStrip,
  HeroBand,
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

function resolveTodayReport(record: AdminRecord | null) {
  if (!record) return null
  const nested = asRecord(record.report) ?? asRecord(record.data) ?? record
  if (!nested) return null
  const hasIdentity =
    Boolean(rowId(nested)) ||
    Boolean(nested.activityDate) ||
    Boolean(nested.activity_date) ||
    Boolean(readString(nested, ["status"])) ||
    reportEntries(nested).length > 0
  return hasIdentity ? nested : null
}

export function ActivitySelfView({ activeTab }: { activeTab: ActivitySelfTab }) {
  const leaveIfForbidden = useLeaveIfForbidden()
  const [today, setToday] = React.useState<AdminRecord | null>(null)
  const [reports, setReports] = React.useState<AdminRecord[]>([])
  const [categories, setCategories] = React.useState<AdminRecord[]>([])
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)
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
        const report = resolveTodayReport(record)
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
    setMounted(true)
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

  const listedToday =
    reports.find((row) => {
      const date = String(row.activityDate ?? row.activity_date ?? "").slice(0, 10)
      return date === todayDate()
    }) ?? today
  const todayReport = today ?? listedToday
  const activeReport = activeTab === "today" ? todayReport : selected
  const entries = reportEntries(activeReport)
  const todayDateLabel = (() => {
    if (!todayReport) return "Today"
    const dated = formatDate(todayReport.activityDate ?? todayReport.activity_date)
    return dated === "—" ? "Today" : dated
  })()
  const todayStatus = listedToday
    ? prettify(readString(listedToday, ["status"], "DRAFT"))
    : "None"

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My activities"
        title={activeTab === "today" ? "Today's work" : "Report history"}
        description="Track your own work and manager-assigned tasks, then submit the day for review."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        }
      />
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <CompactStatStrip
        items={[
          { label: "Reports", value: loading ? "…" : String(reports.length) },
          { label: "Today", value: loading ? "…" : todayStatus },
          { label: "Entries today", value: loading ? "…" : String(reportEntries(todayReport).length) },
        ]}
      />
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            if (activeTab === "today" && todayReport) {
              setCreateMode("entry")
              setForm({ id: rowId(todayReport), status: "COMPLETED" })
            } else {
              setCreateMode("report")
              setForm({ activity_date: todayDate() })
            }
            setCreateOpen(true)
          }}
        >
          <PlusIcon className="size-4" />
          {activeTab === "today" && todayReport ? "Add work item" : "New report"}
        </button>
      </div>

      {activeTab === "today" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {loading && !todayReport ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading today&apos;s report...
            </div>
          ) : todayReport ? (
            <>
              <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{todayDateLabel}</p>
                    <StatusChip value={readString(todayReport, ["status"], "DRAFT")} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entries.length === 0
                      ? "No entries yet. Add the work you completed today."
                      : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} logged today.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={() => {
                      setCreateMode("entry")
                      setForm({ id: rowId(todayReport), status: "COMPLETED" })
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
                      setForm({ id: rowId(todayReport), employee_summary: "" })
                      setCreateOpen(true)
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
              {entries.length > 0 ? (
                <ul className="divide-y divide-border/70 border-t border-border/70">
                  {entries.map((entry) => {
                    const id = rowId(entry)
                    const managerAssigned =
                      readString(entry, ["taskReference", "task_reference", "externalReferenceType", "external_reference_type"])
                        .toUpperCase()
                        .includes("MANAGER")
                    return (
                      <li key={id || readString(entry, ["title"])} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{readString(entry, ["title"], "Work item")}</p>
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              {managerAssigned ? "Assigned by manager" : "My work"}
                            </span>
                          </div>
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
                              const reportId = rowId(todayReport)
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
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Today&apos;s report could not be loaded. Refresh the page to try again.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {loading && reports.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading your reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No daily reports yet. Create one to start logging work.
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {reports.map((row) => {
                const id = rowId(row)
                const isSelected = Boolean(id && rowId(selected) === id)
                const summary = readString(row, ["employeeSummary", "employee_summary"], "")
                const rowEntries = isSelected ? entries : []
                return (
                  <div key={id || readString(row, ["activity_date", "activityDate"])}>
                    <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        className="min-w-0 space-y-1 text-left"
                        onClick={() => void openReport(row)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            {formatDate(row.activityDate ?? row.activity_date)}
                          </p>
                          <StatusChip value={readString(row, ["status"], "DRAFT")} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {summary || "No summary yet."}
                        </p>
                      </button>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={() => {
                            setCreateMode("entry")
                            setForm({ id, status: "COMPLETED" })
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
                            setForm({ id, employee_summary: summary })
                            setCreateOpen(true)
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                    {rowEntries.length > 0 ? (
                      <ul className="divide-y divide-border/70 border-t border-border/70">
                        {rowEntries.map((entry) => (
                          <li
                            key={rowId(entry) || readString(entry, ["title"])}
                            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                          >
                            <p className="text-sm font-medium text-foreground">
                              {readString(entry, ["title"], "Entry")}
                            </p>
                            <StatusChip value={readString(entry, ["status"], "PLANNED")} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup
          from="bottom"
          className="flex max-h-[calc(100dvh-0.75rem)] w-[calc(100%-0.75rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90dvh,42rem)] sm:w-[calc(100%-2rem)]"
        >
          <DialogHeader className="m-0 shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-5">
            <DialogTitle>{createMode === "report" ? "Start a daily report" : createMode === "entry" ? "Add a work item" : "Submit report"}</DialogTitle>
            <DialogDescription>
              {createMode === "report"
                ? "Choose the work date. The report stays private to you and your authorized reviewers."
                : createMode === "entry"
                  ? "Add work you completed or plan to complete for this day."
                  : "Summarize the day and send it to your manager for review."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
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
          </div>
          <DialogFooter className="m-0 shrink-0 border-t border-border bg-background px-4 py-3 sm:px-5">
            <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className={primaryButtonClass} onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : "Save"}</button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  )
}
