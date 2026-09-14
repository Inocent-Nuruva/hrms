"use client"

import * as React from "react"
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  ClipboardListIcon,
  FilterIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SlidersHorizontalIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  asRecord,
  asRecordArray,
  formatDate,
  inputClass,
  optionLabel,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
  StatusChip,
  TalentDoodleSprites,
  HeroBand,
} from "@/components/dashboard/talent-visuals"
import {
  addManagerActivityComment,
  addMyActivityComment,
  addMyActivityEntry,
  createManagerActivityTask,
  getMyActivityReport,
  listActivityCategories,
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
type SelfTab = "assigned" | "my-work" | "drafts" | "submitted"
type ManagerTab = "team-work" | "assign"

const statusLabel: Record<string, string> = {
  PLANNED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
  CANCELLED: "Cancelled",
}

const priorityClasses: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300",
  MEDIUM: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  HIGH: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  URGENT: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
}

function token() {
  return readStoredSessionTokens().accessToken.trim()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function entriesFromReports(reports: AdminRecord[]) {
  return reports.flatMap((report) =>
    asRecordArray(report.entries ?? report.items ?? report.activities).map((entry) => ({
      ...entry,
      report_id: rowId(report),
      activity_date: report.activityDate ?? report.activity_date,
      report_status: report.status,
      employee_id: report.employeeId ?? report.employee_id,
      employee: report.employeeSnapshot ?? report.employee_snapshot,
    })),
  )
}

function isManagerAssigned(task: AdminRecord) {
  return readString(task, ["taskReference", "task_reference", "externalReferenceType", "external_reference_type"])
    .toUpperCase()
    .includes("MANAGER") || Boolean(task.assignedByEmployeeId ?? task.assigned_by_employee_id)
}

function taskStatus(task: AdminRecord) {
  return readString(task, ["status"], "PLANNED").toUpperCase()
}

function taskPriority(task: AdminRecord) {
  return readString(task, ["priority"], "MEDIUM").toUpperCase()
}

function personName(value: unknown, fallback = "Unassigned") {
  const record = asRecord(value)
  if (!record) return fallback
  return readString(record, ["full_name", "fullName", "name"], fallback)
}

function taskDate(task: AdminRecord) {
  return task.plannedEndTime ?? task.planned_end_time ?? task.activity_date ?? task.activityDate
}

export function ActivityTaskWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor()
  const leaveIfForbidden = useLeaveIfForbidden()
  const [selfTab, setSelfTab] = React.useState<SelfTab>("assigned")
  const [managerTab, setManagerTab] = React.useState<ManagerTab>("team-work")
  const [tasks, setTasks] = React.useState<AdminRecord[]>([])
  const [reports, setReports] = React.useState<AdminRecord[]>([])
  const [categories, setCategories] = React.useState<AdminRecord[]>([])
  const [team, setTeam] = React.useState<AdminRecord[]>([])
  const [selected, setSelected] = React.useState<AdminRecord | null>(null)
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("ALL")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<Record<string, string>>({ activity_date: today(), priority: "MEDIUM" })
  const [checklistDraft, setChecklistDraft] = React.useState("")
  const [checklistItems, setChecklistItems] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [comment, setComment] = React.useState("")
  const [commenting, setCommenting] = React.useState(false)
  const [selfCreateOpen, setSelfCreateOpen] = React.useState(false)
  const [taskEditStatus, setTaskEditStatus] = React.useState("PLANNED")

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
        const [taskRows, reportRows, categoryRows] = await Promise.all([
          listMyActivityTasks(accessToken, { limit: 100 }).catch(() => []),
          listMyActivities(accessToken, { limit: 100 }),
          listActivityCategories(accessToken).catch(() => []),
        ])
        setTasks(taskRows.length ? taskRows : entriesFromReports(reportRows))
        setReports(reportRows)
        setCategories(categoryRows)
      } else {
        const [taskRows, teamRows] = await Promise.all([
          listManagerActivityTasks(accessToken, { limit: 100 }).catch(() => []),
          listManagerActivityAssignees(accessToken).catch(() => []),
        ])
        setTasks(taskRows)
        setTeam(teamRows)
      }
    } catch (errorObject) {
      if (leaveIfForbidden(errorObject)) return
      setError(errorObject instanceof Error ? errorObject.message : "Could not load activities.")
    } finally {
      setLoading(false)
    }
  }, [leaveIfForbidden, mode])

  function addChecklistItem() {
    const item = checklistDraft.trim()
    if (!item) return
    setChecklistItems((current) => [...current, item])
    setChecklistDraft("")
  }

  React.useEffect(() => {
    if (actor.ready) void load()
  }, [actor.ready, load])

  const visibleTasks = React.useMemo(() => {
    const lower = query.trim().toLowerCase()
    return tasks.filter((task) => {
      const managerAssigned = isManagerAssigned(task)
      const reportStatus = readString(task, ["report_status", "reportStatus"], "DRAFT").toUpperCase()
      if (mode === "self") {
        if (selfTab === "assigned" && !managerAssigned) return false
        if (selfTab === "my-work" && managerAssigned) return false
        if (selfTab === "drafts" && reportStatus !== "DRAFT" && reportStatus !== "RETURNED_FOR_CORRECTION") return false
        if (selfTab === "submitted" && reportStatus === "DRAFT") return false
      }
      if (statusFilter !== "ALL" && taskStatus(task) !== statusFilter) return false
      if (!lower) return true
      return JSON.stringify(task).toLowerCase().includes(lower)
    })
  }, [mode, query, selfTab, statusFilter, tasks])

  const reportCounts = React.useMemo(() => ({
    drafts: reports.filter((report) => ["DRAFT", "RETURNED_FOR_CORRECTION"].includes(readString(report, ["status"], "DRAFT").toUpperCase())).length,
    submitted: reports.filter((report) => !["DRAFT", "RETURNED_FOR_CORRECTION"].includes(readString(report, ["status"], "DRAFT").toUpperCase())).length,
  }), [reports])

  async function openTask(task: AdminRecord) {
    const accessToken = token()
    const reportId = rowId(task, ["report_id", "reportId"])
    if (mode === "self" && accessToken && reportId) {
      try {
        const report = await getMyActivityReport(accessToken, reportId)
        const entry = asRecordArray(report?.entries).find((candidate) => rowId(candidate) === rowId(task))
        const detail = entry ? { ...report, ...entry, report_id: reportId } : task
        setSelected(detail)
        setTaskEditStatus(taskStatus(detail))
        return
      } catch {
        // Keep the grid row available when the detail request is unavailable.
      }
    }
    setSelected(task)
    setTaskEditStatus(taskStatus(task))
  }

  async function saveTask() {
    const accessToken = token()
    if (!accessToken) return
    setSaving(true)
    try {
      if (mode === "manager") {
        if (!form.employee_id || !form.title || !form.description) {
          throw new Error("Employee, title, and description are required.")
        }
        await createManagerActivityTask(accessToken, {
          employee_id: Number(form.employee_id),
          activity_date: form.activity_date || today(),
          title: form.title,
          description: form.description,
          planned_end_time: form.due_date ? `${form.due_date}T17:00:00.000Z` : undefined,
          priority: form.priority || "MEDIUM",
          checklist: checklistItems.map((title, index) => ({
            id: `item-${index + 1}`,
            title,
            completed: false,
          })),
        })
        toast.success("Task assigned.")
      } else {
        if (!form.report_id || !form.activity_category_id || !form.title || !form.description) {
          throw new Error("Report, category, title, and description are required.")
        }
        await addMyActivityEntry(accessToken, form.report_id, {
          activity_category_id: Number(form.activity_category_id),
          title: form.title,
          description: form.description,
          status: "COMPLETED",
          priority: form.priority || "MEDIUM",
        })
        toast.success("Work added to your report.")
      }
      setForm({ activity_date: today(), priority: "MEDIUM" })
      setChecklistDraft("")
      setChecklistItems([])
      setSelfCreateOpen(false)
      await load()
      setManagerTab("team-work")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not save task.")
    } finally {
      setSaving(false)
    }
  }

  async function addComment() {
    const accessToken = token()
    const entryId = rowId(selected)
    if (!accessToken || !entryId || !comment.trim()) return
    setCommenting(true)
    try {
      if (mode === "manager") await addManagerActivityComment(accessToken, entryId, comment.trim())
      else await addMyActivityComment(accessToken, entryId, comment.trim())
      setComment("")
      toast.success("Comment added.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not add comment.")
    } finally {
      setCommenting(false)
    }
  }

  async function updateTaskStatus() {
    const accessToken = token()
    const reportId = rowId(selected, ["report_id", "reportId"])
    const entryId = rowId(selected)
    if (!accessToken || !reportId || !entryId || mode !== "self") return
    try {
      await updateMyActivityEntry(accessToken, reportId, entryId, {
        status: taskEditStatus,
        completion_percentage: taskEditStatus === "COMPLETED" ? 100 : taskEditStatus === "IN_PROGRESS" ? 50 : 0,
      })
      toast.success("Task status updated.")
      setSelected((current) => current ? { ...current, status: taskEditStatus } : current)
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not update task.")
    }
  }

  const tabs = mode === "self"
    ? [
        ["assigned", "Assigned to me"],
        ["my-work", "My work"],
        ["drafts", `Draft reports (${reportCounts.drafts})`],
        ["submitted", `Submitted (${reportCounts.submitted})`],
      ] as Array<[SelfTab, string]>
    : [["team-work", "Team work"], ["assign", "Assign tasks"]] as Array<[ManagerTab, string]>

  return (
    <section className="min-w-0 space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow={mode === "manager" ? "Team activities" : "My activities"}
        title={mode === "manager" ? "Plan and review work" : "Your work, in one place"}
        description={mode === "manager" ? "Assign planned work to people in your reporting scope and follow delivery." : "Track assigned tasks, add your work, and submit a clear daily report."}
        actions={
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20" onClick={() => void load()}>
            <Loader2Icon className={loading ? "size-4 animate-spin" : "hidden"} />
            <CircleDotIcon className={loading ? "hidden" : "size-4"} /> Refresh
          </button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-1">
        <div className="flex min-w-0 flex-wrap gap-1">
          {tabs.map(([value, label]) => {
            const active = mode === "self" ? selfTab === value : managerTab === value
            return <button key={value} type="button" onClick={() => mode === "self" ? setSelfTab(value as SelfTab) : setManagerTab(value as ManagerTab)} className={`border-b-2 px-3 py-3 text-sm font-medium transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>
          })}
        </div>
        <button type="button" className={primaryButtonClass} onClick={() => {
          if (mode === "manager") setManagerTab("assign")
          else {
            setForm((current) => ({ ...current, report_id: rowId(reports.find((report) => String(report.activityDate ?? report.activity_date).slice(0, 10) === today()) ?? reports[0] ?? {}), activity_category_id: "" }))
            setSelfCreateOpen(true)
          }
        }}>
          <PlusIcon className="size-4" /> {mode === "manager" ? "Assign a task" : "Add my work"}
        </button>
      </div>
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {mode === "manager" && managerTab === "assign" ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><SendIcon className="size-5" /></div><div><h2 className="font-semibold">Assign planned work</h2><p className="text-sm text-muted-foreground">Choose a person in your reporting scope. Their task will appear in My Activities and can be included in their daily report.</p></div></div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Assign to</span><select className={inputClass} value={form.employee_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Choose employee</option>{team.map((member) => <option key={rowId(member)} value={rowId(member)}>{personName(member, optionLabel(member))}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Task name</span><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Prepare renewal pipeline" /></label>
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Due date</span><input className={inputClass} type="date" value={form.due_date ?? ""} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm md:col-span-2"><span className="font-medium">Description</span><textarea className={`${inputClass} min-h-24`} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="What outcome should be delivered?" /></label>
            <label className="grid gap-1.5 text-sm"><span className="font-medium">Priority</span><select className={inputClass} value={form.priority ?? "MEDIUM"} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
            <div className="grid content-start gap-1.5 text-sm">
              <span className="font-medium">Checklist <span className="font-normal text-muted-foreground">(optional)</span></span>
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
                <button
                  type="button"
                  className={`${secondaryButtonClass} shrink-0`}
                  onClick={addChecklistItem}
                  disabled={!checklistDraft.trim()}
                >
                  <PlusIcon className="size-4" /> Add
                </button>
              </div>
              {checklistItems.length > 0 ? (
                <div className="mt-1 grid gap-1.5">
                  {checklistItems.map((item, index) => (
                    <div key={`${item}-${index}`} className="flex min-w-0 items-center gap-2 rounded-md border border-border/80 bg-muted/25 px-2.5 py-2">
                      <CheckCircle2Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{item}</span>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        onClick={() => setChecklistItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        aria-label={`Remove ${item}`}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-5 flex justify-end pr-16"><button type="button" className={primaryButtonClass} onClick={() => void saveTask()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />} Assign task</button></div>
        </div>
      ) : (
        <>
          {mode === "self" && selfCreateOpen ? <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5 shadow-sm"><div className="mb-4 flex items-start justify-between"><div><h2 className="font-semibold">Add work to your report</h2><p className="text-sm text-muted-foreground">Capture a work item so it can be included in today&apos;s submission.</p></div><button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted" onClick={() => setSelfCreateOpen(false)}><XIcon className="size-4" /></button></div><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="font-medium">Activity category</span><select className={inputClass} value={form.activity_category_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, activity_category_id: event.target.value }))}><option value="">Choose category</option>{categories.map((category) => <option key={rowId(category)} value={rowId(category)}>{optionLabel(category)}</option>)}</select></label><label className="grid gap-1.5 text-sm"><span className="font-medium">Priority</span><select className={inputClass} value={form.priority ?? "MEDIUM"} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label className="grid gap-1.5 text-sm md:col-span-2"><span className="font-medium">Work item</span><input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="What did you work on?" /></label><label className="grid gap-1.5 text-sm md:col-span-2"><span className="font-medium">Description</span><textarea className={`${inputClass} min-h-24`} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Add enough context for your manager." /></label></div><div className="mt-4 flex justify-end"><button type="button" className={primaryButtonClass} onClick={() => void saveTask()} disabled={saving}>{saving ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />} Add work</button></div></div> : null}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="relative min-w-[220px] flex-1"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, people, or reports" /></div>
            <div className="flex items-center gap-2"><FilterIcon className="size-4 text-muted-foreground" /><select className={`${inputClass} w-auto min-w-36`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="PLANNED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="DEFERRED">Deferred</option></select></div>
            <button type="button" className={secondaryButtonClass}><SlidersHorizontalIcon className="size-4" /> Filters</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="hidden grid-cols-[28px_minmax(220px,1fr)_minmax(140px,0.75fr)_120px_100px_130px_28px] gap-3 border-b border-border bg-muted/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground lg:grid"><span /><span>Task</span><span>{mode === "manager" ? "Assigned to" : "Assigned by"}</span><span>Due</span><span>Priority</span><span>Status</span><span /></div>
            {loading ? <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-muted-foreground"><Loader2Icon className="size-4 animate-spin" /> Loading activities...</div> : visibleTasks.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center"><ClipboardListIcon className="size-8 text-muted-foreground/60" /><p className="font-medium">No work items in this view</p><p className="text-sm text-muted-foreground">Assigned tasks and your report items will appear here.</p></div> : <div className="divide-y divide-border/70">{visibleTasks.map((task) => { const status = taskStatus(task); const priority = taskPriority(task); const employee = asRecord(task.employee); const assignedBy = task.assignedBySnapshot ?? task.assigned_by_snapshot; return <button type="button" key={rowId(task) || `${readString(task, ["title"])}-${readString(task, ["activity_date"])}`} onClick={() => void openTask(task)} className="grid w-full grid-cols-[28px_minmax(0,1fr)] gap-3 px-4 py-4 text-left transition hover:bg-muted/30 lg:grid-cols-[28px_minmax(220px,1fr)_minmax(140px,0.75fr)_120px_100px_130px_28px] lg:items-center"><span className="mt-1 flex size-4 items-center justify-center rounded border border-border text-primary"><CheckCircle2Icon className={status === "COMPLETED" ? "size-3.5" : "hidden"} /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-medium text-foreground">{readString(task, ["title"], "Untitled task")}</span><span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">{statusLabel[status] ?? status}</span></span><span className="mt-1 block truncate text-xs text-muted-foreground">{readString(task, ["description"], "No description")}</span><span className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground lg:hidden"><span>{mode === "manager" ? personName(employee) : personName(assignedBy, isManagerAssigned(task) ? "Manager" : "My work")}</span><span>•</span><span>{formatDate(taskDate(task))}</span></span></span><span className="hidden truncate text-sm text-muted-foreground lg:block">{mode === "manager" ? personName(employee) : personName(assignedBy, isManagerAssigned(task) ? "Manager" : "My work")}</span><span className="hidden text-sm text-muted-foreground lg:block">{formatDate(taskDate(task))}</span><span className={`hidden w-fit rounded-full px-2 py-1 text-[11px] font-semibold lg:block ${priorityClasses[priority] ?? priorityClasses.MEDIUM}`}>{priority}</span><span className="hidden lg:block"><StatusChip value={statusLabel[status] ?? status} /></span><ChevronRightIcon className="size-4 text-muted-foreground" /></button> })}</div>}
          </div>
        </>
      )}
      {mode === "self" && selfTab !== "assigned" && selfTab !== "my-work" ? <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Use the task rows above to open the report they belong to. Draft reports can be completed and submitted from the report detail drawer.</div> : null}
      {selected ? <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={() => setSelected(null)}><aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{isManagerAssigned(selected) ? "Assigned task" : "Work item"}</span><StatusChip value={statusLabel[taskStatus(selected)] ?? taskStatus(selected)} /></div><button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted" onClick={() => setSelected(null)}><XIcon className="size-5" /></button></div><div className="space-y-6 px-5 py-6"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{mode === "manager" ? "Team task" : "Task details"}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{readString(selected, ["title"], "Untitled task")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{readString(selected, ["description"], "No description")}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{mode === "manager" ? "Assigned to" : "Assigned by"}</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium"><UserRoundIcon className="size-4 text-primary" />{mode === "manager" ? personName(selected.employee) : personName(selected.assignedBySnapshot ?? selected.assigned_by_snapshot, isManagerAssigned(selected) ? "Manager" : "You")}</p></div><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Due date</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium"><CalendarDaysIcon className="size-4 text-primary" />{formatDate(taskDate(selected))}</p></div><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Priority</p><p className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityClasses[taskPriority(selected)] ?? priorityClasses.MEDIUM}`}>{taskPriority(selected)}</p></div><div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Report date</p><p className="mt-1 text-sm font-medium">{formatDate(selected.activity_date ?? selected.activityDate)}</p></div></div>{mode === "self" && selected.report_id ? <div className="rounded-lg border border-border p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Progress</h3><p className="text-xs text-muted-foreground">Update this item before submitting your report.</p></div><select className={`${inputClass} w-auto`} value={taskEditStatus} onChange={(event) => setTaskEditStatus(event.target.value)}><option value="PLANNED">Not started</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="DEFERRED">Deferred</option></select></div><button type="button" className={`${secondaryButtonClass} mt-3`} onClick={() => void updateTaskStatus()}>Save progress</button></div> : null}<div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Checklist</h3><span className="text-xs text-muted-foreground">{asRecordArray(selected.checklist).filter((item) => item.completed).length}/{asRecordArray(selected.checklist).length} complete</span></div>{asRecordArray(selected.checklist).length ? <div className="space-y-2">{asRecordArray(selected.checklist).map((item) => <div key={rowId(item) || readString(item, ["id", "title"])} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><CheckCircle2Icon className={item.completed ? "size-4 text-emerald-600" : "size-4 text-muted-foreground"} />{readString(item, ["title"], "Checklist item")}</div>)}</div> : <p className="text-sm text-muted-foreground">No checklist items.</p>}</div><div><h3 className="mb-2 flex items-center gap-2 font-semibold"><MessageSquareIcon className="size-4 text-primary" /> Activity</h3><div className="space-y-2">{asRecordArray(selected.comments).length ? asRecordArray(selected.comments).map((item) => <div key={rowId(item)} className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><p>{readString(item, ["body"], "")}</p><p className="mt-1 text-xs text-muted-foreground">{personName(item.authorSnapshot ?? item.author_snapshot, "Team member")} · {formatDate(item.createdAt ?? item.created_at)}</p></div>) : <p className="text-sm text-muted-foreground">No comments yet.</p>}</div><div className="mt-3 flex gap-2"><input className={inputClass} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Add an update" /><button type="button" className={primaryButtonClass} onClick={() => void addComment()} disabled={commenting || !comment.trim()}>{commenting ? <Loader2Icon className="size-4 animate-spin" /> : <MessageSquareIcon className="size-4" />}</button></div></div>{mode === "self" && selected.report_id ? <button type="button" className={primaryButtonClass} onClick={async () => { const accessToken = token(); if (!accessToken) return; await submitMyActivityReport(accessToken, selected.report_id as string, { employee_summary: "Submitted from activities workspace", client_request_id: globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}` }); toast.success("Report submitted."); setSelected(null); await load() }}>Submit report</button> : null}</div></aside></div> : null}
    </section>
  )
}
