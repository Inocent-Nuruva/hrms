"use client"

import * as React from "react"
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ClipboardListIcon,
  FileTextIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  asRecord,
  asRecordArray,
  formatDate,
  HeroBand,
  heroGhostButtonClass,
  inputClass,
  optionLabel,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
  TalentDoodleSprites,
} from "@/components/dashboard/talent-visuals"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { cn } from "@/lib/utils"
import {
  addManagerActivityComment,
  addMyActivityComment,
  createManagerActivityTask,
  createMyActivityTask,
  getManagerActivityReport,
  getMyActivityReport,
  listManagerActivityAssignees,
  listManagerActivityTasks,
  listMyActivities,
  listMyActivityTasks,
  submitMyActivityReport,
  updateMyActivityEntry,
  type AdminRecord,
} from "@/lib/admin-api"
import { readStoredSessionTokens } from "@/lib/session-client"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"

type WorkspaceMode = "self" | "manager"
type ListTab = "tasks" | "drafts" | "submitted"

const statusLabel: Record<string, string> = {
  PLANNED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  RETURNED_FOR_CORRECTION: "Returned",
  REJECTED: "Rejected",
}

function token() {
  return readStoredSessionTokens().accessToken.trim()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function personName(value: unknown, fallback = "Unassigned") {
  const record = asRecord(value)
  if (!record) return fallback
  return readString(record, ["full_name", "fullName", "name"], fallback)
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`.toUpperCase() || "?"
}

function isManagerAssigned(task: AdminRecord) {
  const reference = readString(task, ["taskReference", "task_reference", "externalReferenceType", "external_reference_type"]).toUpperCase()
  return reference.includes("MANAGER") || Boolean(task.assignedByEmployeeId ?? task.assigned_by_employee_id)
}

function taskStatus(task: AdminRecord) {
  return readString(task, ["status"], "PLANNED").toUpperCase()
}

function taskPriority(task: AdminRecord) {
  return readString(task, ["priority"], "MEDIUM").toUpperCase()
}

function reportIdOf(row: AdminRecord | null | undefined) {
  return readString(row, ["report_id", "reportId", "dailyActivityReportId", "daily_activity_report_id"])
}

function entryIdOf(row: AdminRecord | null | undefined) {
  if (!row || row.is_report_row) return ""
  return readString(row, ["id"])
}

function taskDate(task: AdminRecord) {
  return task.plannedEndTime ?? task.planned_end_time ?? task.activity_date ?? task.activityDate
}

function isDraftReportStatus(status: string) {
  const value = status.toUpperCase()
  return value === "DRAFT" || value === "RETURNED_FOR_CORRECTION"
}

function checklistProgress(task: AdminRecord) {
  const items = asRecordArray(task.checklist)
  if (!items.length) return null
  const done = items.filter((item) => item.completed === true).length
  return { done, total: items.length, label: `${done}/${items.length}` }
}

function dueMeta(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return { label: "No date", tone: "muted" as const }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { label: value, tone: "muted" as const }
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000)
  if (days === 0) return { label: "Due today", tone: "danger" as const }
  if (days === 1) return { label: "Tomorrow", tone: "warn" as const }
  if (days > 1 && days < 14) return { label: `In ${days} days`, tone: "muted" as const }
  if (days === -1) return { label: "Yesterday", tone: "danger" as const }
  if (days < 0) return { label: `${Math.abs(days)} days overdue`, tone: "danger" as const }
  return { label: formatDate(value), tone: "muted" as const }
}

function entriesFromReports(reports: AdminRecord[]): AdminRecord[] {
  return reports.flatMap((report) =>
    asRecordArray(report.entries ?? report.items ?? report.activities).map((entry) => ({
      ...entry,
      report_id: reportIdOf(report) || rowId(report),
      activity_date: report.activityDate ?? report.activity_date,
      report_status: report.status,
      employee_id: report.employeeId ?? report.employee_id,
      employee: report.employeeSnapshot ?? report.employee_snapshot,
    })),
  )
}

function asReportRow(report: AdminRecord): AdminRecord {
  const entries = asRecordArray(report.entries ?? report.items ?? report.activities)
  const dated = formatDate(report.activityDate ?? report.activity_date)
  return {
    ...report,
    report_id: reportIdOf(report) || rowId(report),
    title: dated && dated !== "—" ? `Daily report · ${dated}` : "Daily report",
    description: entries.length
      ? `${entries.length} work item${entries.length === 1 ? "" : "s"}`
      : "No work items yet",
    report_status: readString(report, ["status"], "DRAFT"),
    status: readString(report, ["status"], "DRAFT"),
    is_report_row: true,
    entries,
  }
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800", className)}>
      {initials(name)}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const color = {
    URGENT: "bg-rose-500",
    HIGH: "bg-rose-500",
    MEDIUM: "bg-amber-400",
    LOW: "bg-emerald-500",
  }[priority] ?? "bg-slate-400"
  return <span className={cn("size-2 rounded-full", color)} />
}

function StatusPill({ value }: { value: string }) {
  const label = statusLabel[value] ?? value
  const tone = value === "COMPLETED"
    ? "bg-emerald-50 text-emerald-700"
    : value === "IN_PROGRESS"
      ? "bg-sky-50 text-sky-700"
      : value === "DRAFT" || value === "RETURNED_FOR_CORRECTION"
        ? "bg-amber-50 text-amber-800"
        : "bg-slate-100 text-slate-600"
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium", tone)}>{label}</span>
}

export function ActivityTaskWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor()
  const leaveIfForbidden = useLeaveIfForbidden()
  const [tab, setTab] = React.useState<ListTab>("tasks")
  const [tasks, setTasks] = React.useState<AdminRecord[]>([])
  const [reports, setReports] = React.useState<AdminRecord[]>([])
  const [team, setTeam] = React.useState<AdminRecord[]>([])
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("ALL")
  const [priorityFilter, setPriorityFilter] = React.useState("ALL")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({ activity_date: today(), priority: "MEDIUM" })
  const [checklistDraft, setChecklistDraft] = React.useState("")
  const [checklistItems, setChecklistItems] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [comment, setComment] = React.useState("")
  const [commenting, setCommenting] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [previewReport, setPreviewReport] = React.useState<AdminRecord | null>(null)
  const [previewSummary, setPreviewSummary] = React.useState("")
  const [taskEditStatus, setTaskEditStatus] = React.useState("PLANNED")
  const [audience, setAudience] = React.useState<"employee" | "self">(mode === "manager" ? "employee" : "self")
  const [updatingChecklistId, setUpdatingChecklistId] = React.useState<string | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null)
  const openedFocusRef = React.useRef<string | null>(null)

  const load = React.useCallback(async () => {
    const accessToken = token()
    if (!accessToken) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (mode === "self") {
        const [taskRows, reportRows, teamRows] = await Promise.all([
          listMyActivityTasks(accessToken, { limit: 100 }).catch(() => []),
          listMyActivities(accessToken, { limit: 100 }),
          listManagerActivityAssignees(accessToken).catch(() => []),
        ])
        const fromReports = entriesFromReports(reportRows)
        const reportEntryById = new Map(fromReports.map((entry) => [entryIdOf(entry) || rowId(entry), entry]))
        const mergedTasks = (taskRows.length ? taskRows : fromReports).map((task) => {
          const nested = reportEntryById.get(entryIdOf(task) || rowId(task))
          return {
            ...nested,
            ...task,
            report_id: reportIdOf(task) || reportIdOf(nested),
            report_status: readString(task, ["report_status", "reportStatus"]) || readString(nested, ["report_status", "reportStatus"]),
            checklist: asRecordArray(task.checklist).length ? task.checklist : nested?.checklist,
          }
        })
        setTasks(mergedTasks)
        setReports(reportRows)
        setTeam(teamRows)
      } else {
        const [taskRows, teamRows] = await Promise.all([
          listManagerActivityTasks(accessToken, { limit: 100 }).catch(() => []),
          listManagerActivityAssignees(accessToken).catch(() => []),
        ])
        setTasks(taskRows.map((task) => ({ ...task, report_id: reportIdOf(task) })))
        setTeam(teamRows)
      }
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) return
      setError(errorObject instanceof Error ? errorObject.message : "Could not load activities.")
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden, mode])

  React.useEffect(() => {
    if (actor.ready) void load()
  }, [actor.ready, load])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("create") === "1") setCreateOpen(true)
  }, [])

  const visibleRows = React.useMemo(() => {
    const lower = query.trim().toLowerCase()
    const matchesQuery = (row: AdminRecord) => !lower || JSON.stringify(row).toLowerCase().includes(lower)
    if (tab === "drafts" || tab === "submitted") {
      return reports
        .filter((report) => {
          const draft = isDraftReportStatus(readString(report, ["status"], "DRAFT"))
          return tab === "drafts" ? draft : !draft
        })
        .map(asReportRow)
        .filter(matchesQuery)
    }
    return tasks.filter((task) => {
      if (statusFilter !== "ALL" && taskStatus(task) !== statusFilter) return false
      if (priorityFilter !== "ALL" && taskPriority(task) !== priorityFilter) return false
      return matchesQuery(task)
    })
  }, [priorityFilter, query, reports, statusFilter, tab, tasks])

  const reportCounts = React.useMemo(() => ({
    drafts: reports.filter((report) => isDraftReportStatus(readString(report, ["status"], "DRAFT"))).length,
    submitted: reports.filter((report) => !isDraftReportStatus(readString(report, ["status"], "DRAFT"))).length,
  }), [reports])

  const canAssign = team.length > 0

  async function openTask(task: AdminRecord) {
    const accessToken = token()
    const reportId = reportIdOf(task)
    if (accessToken && reportId) {
      try {
        const report = mode === "self"
          ? await getMyActivityReport(accessToken, reportId)
          : await getManagerActivityReport(accessToken, reportId)
        if (task.is_report_row) {
          setSelected(asReportRow((report ?? task) as AdminRecord))
          return
        }
        const wanted = entryIdOf(task)
        const entry = asRecordArray(report?.entries).find((candidate) => entryIdOf(candidate) === wanted)
        const detail = entry
          ? { ...entry, report_id: reportId, comments: entry.comments ?? report?.comments, employee: report?.employeeSnapshot ?? report?.employee_snapshot ?? task.employee }
          : { ...task, report_id: reportId }
        setSelected(detail)
        setTaskEditStatus(taskStatus(detail))
        return
      } catch {
        // Keep the grid row available when the detail request is unavailable.
      }
    }
    setSelected({ ...task, report_id: reportId })
    setTaskEditStatus(taskStatus(task))
  }

  React.useEffect(() => {
    if (loading || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const focusId = params.get("task") || params.get("highlight")
    if (!focusId || openedFocusRef.current === focusId) return
    const match = tasks.find((task) => entryIdOf(task) === focusId)
    if (!match) return
    openedFocusRef.current = focusId
    void openTask(match)
  }, [loading, tasks])

  function addChecklistItem() {
    const item = checklistDraft.trim()
    if (!item) return
    setChecklistItems((current) => [...current, item])
    setChecklistDraft("")
  }

  function checklistPayload() {
    return checklistItems.map((title, index) => ({
      id: `item-${index + 1}`,
      title,
      completed: false,
    }))
  }

  function resetComposer() {
    setForm({ activity_date: today(), priority: "MEDIUM" })
    setChecklistDraft("")
    setChecklistItems([])
    setCreateOpen(false)
    setAudience(mode === "manager" ? "employee" : "self")
  }

  async function saveTask() {
    const accessToken = token()
    if (!accessToken) return
    setSaving(true)
    try {
      if (!form.title?.trim() || !form.description?.trim()) {
        throw new Error("Task name and notes are required.")
      }
      const taskPayload = {
        activity_date: form.activity_date || today(),
        title: form.title.trim(),
        description: form.description.trim(),
        planned_end_time: form.due_date ? `${form.due_date}T17:00:00.000Z` : undefined,
        priority: form.priority || "MEDIUM",
        checklist: checklistPayload(),
      }
      if (audience === "employee") {
        if (!form.employee_id) throw new Error("Choose an employee to assign this task.")
        await createManagerActivityTask(accessToken, {
          ...taskPayload,
          employee_id: Number(form.employee_id),
        })
        toast.success("Task assigned.")
      } else {
        await createMyActivityTask(accessToken, taskPayload)
        toast.success("Task created.")
      }
      resetComposer()
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not save task.")
    } finally {
      setSaving(false)
    }
  }

  async function patchEntry(task: AdminRecord, data: AdminRecord) {
    const accessToken = token()
    const reportId = reportIdOf(task)
    const entryId = entryIdOf(task)
    if (!accessToken || !reportId || !entryId) {
      throw new Error("This task is missing its report link. Refresh and try again.")
    }
    await updateMyActivityEntry(accessToken, reportId, entryId, data)
  }

  async function toggleRowComplete(task: AdminRecord, event: React.MouseEvent) {
    event.stopPropagation()
    if (mode !== "self" || task.is_report_row) return
    const entryId = entryIdOf(task)
    const next = taskStatus(task) === "COMPLETED" ? "PLANNED" : "COMPLETED"
    setUpdatingTaskId(entryId)
    try {
      await patchEntry(task, {
        status: next,
        completion_percentage: next === "COMPLETED" ? 100 : 0,
      })
      toast.success(next === "COMPLETED" ? "Task marked complete." : "Task reopened.")
      await load()
      if (selected && entryIdOf(selected) === entryId) {
        setSelected((current) => current ? { ...current, status: next } : current)
        setTaskEditStatus(next)
      }
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not update the task.")
    } finally {
      setUpdatingTaskId(null)
    }
  }

  async function toggleChecklistItem(itemId: string) {
    if (!selected || mode !== "self" || selected.is_report_row) return
    const previousChecklist = asRecordArray(selected.checklist)
    const nextChecklist = previousChecklist.map((item) => (
      String(item.id ?? item.title) === itemId
        ? { ...item, completed: item.completed !== true }
        : item
    ))
    const changedItem = nextChecklist.find((item) => String(item.id ?? item.title) === itemId)
    setSelected((current) => current ? { ...current, checklist: nextChecklist } : current)
    setUpdatingChecklistId(itemId)
    try {
      await patchEntry(selected, { checklist: nextChecklist })
      toast.success(changedItem?.completed === true ? "Checklist item completed." : "Checklist item reopened.")
      await load()
      await openTask({ ...selected, checklist: nextChecklist, report_id: reportIdOf(selected) })
    } catch (errorObject) {
      setSelected((current) => current ? { ...current, checklist: previousChecklist } : current)
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not update checklist.")
    } finally {
      setUpdatingChecklistId(null)
    }
  }

  async function updateTaskStatus() {
    if (!selected || mode !== "self" || selected.is_report_row) return
    try {
      await patchEntry(selected, {
        status: taskEditStatus,
        completion_percentage: taskEditStatus === "COMPLETED" ? 100 : taskEditStatus === "IN_PROGRESS" ? 50 : 0,
      })
      toast.success("Progress saved.")
      setSelected((current) => current ? { ...current, status: taskEditStatus } : current)
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not update task.")
    }
  }

  async function addComment() {
    const accessToken = token()
    const entryId = entryIdOf(selected)
    if (!accessToken || !entryId || !comment.trim()) return
    setCommenting(true)
    try {
      if (mode === "manager") await addManagerActivityComment(accessToken, entryId, comment.trim())
      else await addMyActivityComment(accessToken, entryId, comment.trim())
      setComment("")
      toast.success("Comment added.")
      if (selected) await openTask(selected)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not add comment.")
    } finally {
      setCommenting(false)
    }
  }

  function workItemsForReport(report: AdminRecord) {
    const reportId = reportIdOf(report) || rowId(report)
    const entries = asRecordArray(report.entries ?? report.items ?? report.activities)
    const fromTasks = tasks.filter((task) => reportIdOf(task) === reportId)
    return entries.length ? entries : fromTasks
  }

  function openReportPreview(report: AdminRecord) {
    const work = workItemsForReport(report)
    const completed = work.filter((entry) => taskStatus(entry) === "COMPLETED")
    if (completed.length < 1) {
      toast.error("Mark at least one task as completed before submitting this report.")
      return
    }
    setPreviewSummary("")
    setPreviewReport({ ...report, entries: work })
  }

  async function submitReport(report: AdminRecord) {
    const accessToken = token()
    const reportId = reportIdOf(report) || rowId(report)
    if (!accessToken || !reportId) return
    setSubmitting(true)
    try {
      await submitMyActivityReport(accessToken, reportId, {
        employee_summary: previewSummary.trim() || "Submitted from activities workspace",
        client_request_id: globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`,
      })
      toast.success("Daily report submitted.")
      setSelected(null)
      setPreviewReport(null)
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not submit the report.")
    } finally {
      setSubmitting(false)
    }
  }

  function submitTodayReport() {
    const draft = reports.find((report) => {
      const dated = String(report.activityDate ?? report.activity_date).slice(0, 10)
      return isDraftReportStatus(readString(report, ["status"], "DRAFT")) && dated === today()
    }) ?? reports.find((report) => isDraftReportStatus(readString(report, ["status"], "DRAFT")))
    if (!draft) {
      toast.error("There is no draft report to submit yet. Create a task first.")
      return
    }
    openReportPreview(draft)
  }

  const assignedBy = (task: AdminRecord) => {
    if (isManagerAssigned(task)) {
      return personName(task.assignedBySnapshot ?? task.assigned_by_snapshot, "Manager")
    }
    return "You"
  }

  const tabs: Array<[ListTab, string]> = mode === "self"
    ? [
        ["tasks", "My tasks"],
        ["drafts", `Drafts (${reportCounts.drafts})`],
        ["submitted", `Submitted (${reportCounts.submitted})`],
      ]
    : [["tasks", "Team work"]]

  return (
    <section className="min-w-0 space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow={mode === "manager" ? "Team activities" : "My activities"}
        title={mode === "manager" ? "Team activities" : "My activities"}
        description={mode === "manager"
          ? "Create tasks for your team, follow progress, and keep delivery in one place."
          : "View and manage work assigned to you, track your progress, and submit your daily work."}
        actions={
          <>
            {mode === "self" ? (
              <button type="button" className={heroGhostButtonClass} onClick={() => void submitTodayReport()} disabled={submitting}>
                {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
                Prepare daily report
              </button>
            ) : null}
            <button type="button" className={heroGhostButtonClass} onClick={() => void load()}>
              <Loader2Icon className={loading ? "size-4 animate-spin" : "hidden"} />
              <CircleDotIcon className={loading ? "hidden" : "size-4"} /> Refresh
            </button>
          </>
        }
      />

      <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2">
          {tabs.map(([value, label]) => {
            const active = tab === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "h-9 shrink-0 rounded-md px-3 text-sm font-medium transition",
                  active ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex min-w-0 flex-nowrap items-center gap-2">
          <div className="relative w-44 shrink-0">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." />
          </div>
          <select
            className="h-9 w-24 max-w-24 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-foreground outline-none [field-sizing:fixed] focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="ALL">Priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            className="h-9 w-24 max-w-24 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-foreground outline-none [field-sizing:fixed] focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">Status</option>
            <option value="PLANNED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            setAudience(mode === "manager" ? "employee" : "self")
            setCreateOpen(true)
          }}
        >
          <PlusIcon className="size-4" /> Create task
        </button>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[40px_minmax(220px,1.4fr)_minmax(160px,0.9fr)_140px_110px_120px] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
          <span />
          <span>Task name</span>
          <span>{mode === "manager" ? "Assigned to" : "Assigned by"}</span>
          <span>Due date</span>
          <span>Priority</span>
          <span>Status</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Loading activities...
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <ClipboardListIcon className="size-8 text-muted-foreground/60" />
            <p className="font-medium">{tab === "drafts" ? "No draft reports" : tab === "submitted" ? "No submitted reports" : "No tasks yet"}</p>
            <p className="text-sm text-muted-foreground">{tab === "tasks" ? "Create a task or wait for one to be assigned to you." : "Reports appear here after you add and submit work."}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRows.map((task) => {
              const status = taskStatus(task)
              const priority = taskPriority(task)
              const due = dueMeta(taskDate(task))
              const assigned = isManagerAssigned(task)
              const who = mode === "manager" ? personName(task.employee) : assignedBy(task)
              const progress = checklistProgress(task)
              return (
                <div
                  key={entryIdOf(task) || reportIdOf(task) || `${readString(task, ["title"])}-${String(taskDate(task))}`}
                  className="grid w-full grid-cols-[40px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 lg:grid-cols-[40px_minmax(220px,1.4fr)_minmax(160px,0.9fr)_140px_110px_120px]"
                >
                  <button
                    type="button"
                    className="flex size-5 items-center justify-center rounded border border-slate-300 text-primary"
                    aria-label={status === "COMPLETED" ? "Mark not started" : "Mark complete"}
                    disabled={mode !== "self" || Boolean(task.is_report_row) || updatingTaskId === entryIdOf(task)}
                    onClick={(event) => void toggleRowComplete(task, event)}
                  >
                    {updatingTaskId === entryIdOf(task) ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckCircle2Icon className={status === "COMPLETED" ? "size-3.5" : "hidden"} />}
                  </button>
                  <button type="button" className="min-w-0 text-left" onClick={() => void openTask(task)}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{readString(task, ["title"], "Untitled task")}</span>
                      {task.is_report_row ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Report</span>
                      ) : assigned ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">Assigned</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">My work</span>
                      )}
                      {progress ? <span className="text-[11px] text-slate-500">{progress.label} done</span> : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500 lg:hidden">{who} · {due.label}</span>
                  </button>
                  <button type="button" className="hidden items-center gap-2 truncate text-sm text-slate-600 lg:flex" onClick={() => void openTask(task)}>
                    {who === "You" ? <UserRoundIcon className="size-4 text-slate-400" /> : <Avatar name={who} />}
                    <span className="min-w-0 truncate">{who}</span>
                  </button>
                  <button type="button" className="hidden text-left text-sm lg:block" onClick={() => void openTask(task)}>
                    <span className="block text-slate-700">{formatDate(taskDate(task))}</span>
                    <span className={cn("text-xs", due.tone === "danger" ? "text-rose-600" : due.tone === "warn" ? "text-amber-600" : "text-slate-500")}>{due.label}</span>
                  </button>
                  <button type="button" className="hidden items-center gap-1.5 text-sm text-slate-700 lg:flex" onClick={() => void openTask(task)}>
                    <PriorityDot priority={priority} /> {priority.charAt(0) + priority.slice(1).toLowerCase()}
                  </button>
                  <button type="button" className="hidden lg:block" onClick={() => void openTask(task)}>
                    <StatusPill value={status} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Create task</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{audience === "employee" ? "Assign planned work" : "Create a task"}</h2>
                <p className="mt-1 text-sm text-slate-500">The task will appear in My Activities with the person who assigned it.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setCreateOpen(false)}><XIcon className="size-5" /></button>
            </div>
            <div className="mb-4 flex w-full rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Task owner">
              <button type="button" className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium", audience === "self" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")} onClick={() => setAudience("self")}>Yourself</button>
              <button type="button" className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium", audience === "employee" ? "bg-white text-sky-700 shadow-sm" : "text-slate-500")} onClick={() => setAudience("employee")}>Assign to employees</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {audience === "employee" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Assign to</span>
                  <select className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))} disabled={!canAssign}>
                    <option value="">{canAssign ? "Choose employee" : "No employees in your reporting scope"}</option>
                    {team.map((member) => <option key={rowId(member)} value={rowId(member)}>{personName(member, optionLabel(member))}</option>)}
                  </select>
                </label>
              ) : (
                <div className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><UserRoundIcon className="size-4 text-sky-700" /> Assigned to you</div>
              )}
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Task name</span>
                <input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Prepare monthly attendance summary" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Start date</span>
                <DatePickerPresets value={form.activity_date ?? today()} onChange={(value) => setForm((current) => ({ ...current, activity_date: value }))} placeholder="Select start date" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Due date</span>
                <DatePickerPresets value={form.due_date ?? ""} onChange={(value) => setForm((current) => ({ ...current, due_date: value }))} placeholder="Select due date" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Priority</span>
                <select className={inputClass} value={form.priority ?? "MEDIUM"} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm md:col-span-2">
                <span className="font-medium">Notes</span>
                <textarea className={`${inputClass} min-h-24 py-2`} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="What should be delivered?" />
              </label>
              <div className="grid content-start gap-1.5 text-sm md:col-span-2">
                <span className="font-medium">Checklist <span className="font-normal text-slate-500">(optional)</span></span>
                <div className="flex min-w-0 gap-2">
                  <input
                    className={`${inputClass} min-w-0 flex-1`}
                    value={checklistDraft}
                    onChange={(event) => setChecklistDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      event.preventDefault()
                      addChecklistItem()
                    }}
                    placeholder="Add a checklist item"
                    aria-label="Checklist item"
                  />
                  <button type="button" className={`${secondaryButtonClass} shrink-0`} onClick={addChecklistItem} disabled={!checklistDraft.trim()}>
                    <PlusIcon className="size-4" /> Add
                  </button>
                </div>
                {checklistItems.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <CheckCircle2Icon className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{item}</span>
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => setChecklistItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item}`}>
                      <XIcon className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="button" className={primaryButtonClass} onClick={() => void saveTask()} disabled={saving}>
                {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                {audience === "employee" ? "Assign task" : "Create task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setPreviewReport(null)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Preview daily report</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{formatDate(previewReport.activityDate ?? previewReport.activity_date)}</h2>
                <p className="mt-1 text-sm text-slate-500">Review the work below, then submit. This cannot be edited after submission.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setPreviewReport(null)}><XIcon className="size-5" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <StatusPill value={readString(previewReport, ["status"], "DRAFT")} />
                <span className="text-slate-500">{asRecordArray(previewReport.entries).filter((entry) => taskStatus(entry) === "COMPLETED").length} of {asRecordArray(previewReport.entries).length} completed</span>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {asRecordArray(previewReport.entries).map((entry) => {
                  const progress = checklistProgress(entry)
                  return (
                    <div key={entryIdOf(entry) || rowId(entry)} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{readString(entry, ["title"], "Untitled task")}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{readString(entry, ["description"], "No notes")}</p>
                        {progress ? <p className="mt-1 text-xs text-slate-500">Checklist {progress.label}</p> : null}
                      </div>
                      <StatusPill value={taskStatus(entry)} />
                    </div>
                  )
                })}
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Summary for your manager <span className="font-normal text-slate-500">(optional)</span></span>
                <textarea className={`${inputClass} min-h-20 py-2`} value={previewSummary} onChange={(event) => setPreviewSummary(event.target.value)} placeholder="What should your manager know about today?" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" className={secondaryButtonClass} onClick={() => setPreviewReport(null)}>Back</button>
              <button type="button" className={primaryButtonClass} onClick={() => void submitReport(previewReport)} disabled={submitting}>
                {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                Submit report
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20" onClick={() => setSelected(null)}>
          <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", selected.is_report_row ? "bg-amber-50 text-amber-800" : isManagerAssigned(selected) ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700")}>
                {selected.is_report_row ? "Daily report" : isManagerAssigned(selected) ? "Assigned task" : "My work"}
              </span>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelected(null)}><XIcon className="size-5" /></button>
            </div>
            <div className="space-y-6 px-5 py-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{readString(selected, ["title"], "Untitled task")}</h2>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  {mode === "manager" ? <Avatar name={personName(selected.employee)} /> : isManagerAssigned(selected) ? <Avatar name={assignedBy(selected)} /> : <UserRoundIcon className="size-4 text-slate-400" />}
                  <div>
                    <p className="font-medium">{mode === "manager" ? personName(selected.employee) : assignedBy(selected)}</p>
                    <p className="text-xs text-slate-500">{formatDate(selected.activity_date ?? selected.activityDate)} · {formatDate(taskDate(selected))}</p>
                  </div>
                </div>
              </div>

              {selected.is_report_row ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Work items</h3>
                  {asRecordArray(selected.entries).length ? (
                    <div className="space-y-2">
                      {asRecordArray(selected.entries).map((entry) => {
                        const progress = checklistProgress(entry)
                        return (
                          <button type="button" key={entryIdOf(entry) || rowId(entry)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => void openTask({ ...entry, report_id: reportIdOf(selected) })}>
                            <span className="min-w-0 truncate font-medium">{readString(entry, ["title"], "Untitled task")}</span>
                            <span className="shrink-0 text-xs text-slate-500">{progress ? `${progress.label} done` : statusLabel[taskStatus(entry)] ?? taskStatus(entry)}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No work items yet. Create a task to fill this report.</p>
                  )}
                  {mode === "self" ? (
                    <button type="button" className={`${primaryButtonClass} mt-4`} onClick={() => openReportPreview(selected)} disabled={submitting}>
                      {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
                      Submit report
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Status
                      {mode === "self" ? (
                        <select className={inputClass} value={taskEditStatus} onChange={(event) => setTaskEditStatus(event.target.value)}>
                          <option value="PLANNED">Not started</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="DEFERRED">Deferred</option>
                        </select>
                      ) : (
                        <StatusPill value={taskStatus(selected)} />
                      )}
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Priority
                      <span className="flex h-10 items-center gap-1.5 text-sm font-medium text-slate-800"><PriorityDot priority={taskPriority(selected)} /> {taskPriority(selected).charAt(0) + taskPriority(selected).slice(1).toLowerCase()}</span>
                    </label>
                    <div className="grid gap-1 text-xs font-medium text-slate-500">
                      Start date
                      <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800"><CalendarDaysIcon className="size-4 text-slate-400" />{formatDate(selected.activity_date ?? selected.activityDate)}</span>
                    </div>
                    <div className="grid gap-1 text-xs font-medium text-slate-500">
                      Due date
                      <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800"><CalendarDaysIcon className="size-4 text-slate-400" />{formatDate(taskDate(selected))}</span>
                    </div>
                  </div>
                  {mode === "self" ? (
                    <button type="button" className={secondaryButtonClass} onClick={() => void updateTaskStatus()}>Save progress</button>
                  ) : null}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Checklist ({asRecordArray(selected.checklist).length})</h3>
                      <span className="text-xs text-slate-500">{asRecordArray(selected.checklist).filter((item) => item.completed).length} of {asRecordArray(selected.checklist).length} completed</span>
                    </div>
                    {asRecordArray(selected.checklist).length ? (
                      <div className="space-y-2">
                        {asRecordArray(selected.checklist).map((item) => {
                          const itemKey = String(item.id ?? item.title)
                          return (
                            <label key={itemKey} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
                              {mode === "self" ? (
                                <input type="checkbox" checked={item.completed === true} disabled={Boolean(updatingChecklistId)} onChange={() => void toggleChecklistItem(itemKey)} className="size-4 accent-sky-700" />
                              ) : (
                                <CheckCircle2Icon className={item.completed ? "size-4 text-emerald-600" : "size-4 text-slate-300"} />
                              )}
                              <span className={item.completed ? "text-slate-400 line-through" : "text-slate-800"}>{readString(item, ["title"], "Checklist item")}</span>
                              {updatingChecklistId === itemKey ? <Loader2Icon className="ml-auto size-4 animate-spin text-sky-700" /> : null}
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No checklist items.</p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Notes</h3>
                    <p className="text-sm leading-6 text-slate-600">{readString(selected, ["description"], "No notes")}</p>
                  </div>

                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MessageSquareIcon className="size-4 text-sky-700" /> Activity</h3>
                    <div className="space-y-3">
                      {asRecordArray(selected.comments).length ? asRecordArray(selected.comments).map((item) => {
                        const author = personName(item.authorSnapshot ?? item.author_snapshot, "Team member")
                        return (
                          <div key={rowId(item)} className="flex gap-2 text-sm">
                            <Avatar name={author} />
                            <div>
                              <p><span className="font-medium">{author}</span> <span className="text-xs text-slate-500">{formatDate(item.createdAt ?? item.created_at)}</span></p>
                              <p className="text-slate-600">{readString(item, ["body"], "")}</p>
                            </div>
                          </div>
                        )
                      }) : <p className="text-sm text-slate-500">No comments yet.</p>}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input className={inputClass} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add a comment..." />
                      <button type="button" className={primaryButtonClass} onClick={() => void addComment()} disabled={commenting || !comment.trim()}>
                        {commenting ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
