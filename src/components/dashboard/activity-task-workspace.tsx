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
import {
  addIsoDays,
  canCloseReport,
  closeReportIssues,
  defaultCloseEntryIds,
  isCloseableActivityStatus,
  isClosedReportStatus,
  isManagerAssignedActivity,
  isTeamAssignedActivity,
  localIsoDate,
  partitionActivityTasks,
  pastActivityReports,
  plannedDueDateOf,
  plannedStartDateOf,
  policyLimits,
  reportDateOf,
  reportForDate,
  reportStatusOf,
} from "@/lib/activity-day"
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
  extractProfilePhotoUrl,
  type AdminRecord,
} from "@/lib/admin-api"
import { useMyProfilePhoto } from "@/lib/my-profile-photo"
import { resolveBackendMediaUrl } from "@/lib/backend-media-url"
import { readStoredSessionTokens } from "@/lib/session-client"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"

type WorkspaceMode = "self" | "manager"
type ListTab = "today" | "upcoming" | "history" | "assigned" | "tasks"

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

function newRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `req-${Math.random().toString(16).slice(2)}`
}

function today() {
  return localIsoDate()
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

function viewerEmployeeId(reports: AdminRecord[], tasks: AdminRecord[]) {
  for (const row of [...reports, ...tasks]) {
    const id = readString(row, ["employeeId", "employee_id"])
    if (id) return id
  }
  return ""
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
  return plannedDueDateOf(task) || reportDateOf(task)
}

function hasDueDate(task: AdminRecord) {
  return Boolean(plannedDueDateOf(task))
}

function isDraftReportStatus(status: string) {
  return canCloseReport({ status })
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

function Avatar({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className?: string }) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    setFailed(false)
  }, [photoUrl])
  const showPhoto = Boolean(photoUrl) && !failed
  return (
    <span className={cn("relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800 ring-1 ring-slate-200", className)}>
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl ?? ""} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  )
}

function photoFromRecord(value: unknown) {
  return resolveBackendMediaUrl(extractProfilePhotoUrl(value))
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
  return <span className={cn("inline-flex rounded-full px-1.5 py-px text-[10px] font-medium leading-4", tone)}>{label}</span>
}

export function ActivityTaskWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor()
  const leaveIfForbidden = useLeaveIfForbidden()
  const { url: myPhotoUrl } = useMyProfilePhoto()
  const [tab, setTab] = React.useState<ListTab>(mode === "manager" ? "tasks" : "today")
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
  const [addWorkReason, setAddWorkReason] = React.useState<"close" | null>(null)
  const [employeeIds, setEmployeeIds] = React.useState<string[]>([])
  const [teamQuery, setTeamQuery] = React.useState("")
  const [previewReport, setPreviewReport] = React.useState<AdminRecord | null>(null)
  const [previewSummary, setPreviewSummary] = React.useState("")
  const [previewEntryIds, setPreviewEntryIds] = React.useState<string[]>([])
  const [taskEditStatus, setTaskEditStatus] = React.useState("PLANNED")
  const [audience, setAudience] = React.useState<"employee" | "self">(mode === "manager" ? "employee" : "self")
  const [updatingChecklistId, setUpdatingChecklistId] = React.useState<string | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null)
  const openedFocusRef = React.useRef<string | null>(null)
  const resumeCloseDayRef = React.useRef<string | null>(null)

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
        const [taskRows, reportRows] = await Promise.all([
          listMyActivityTasks(accessToken, { limit: 100 }).catch(() => []),
          listMyActivities(accessToken, { limit: 100 }),
        ])
        const fromReports = entriesFromReports(reportRows)
        const reportEntryById = new Map(fromReports.map((entry) => [entryIdOf(entry) || rowId(entry), entry]))
        const mergedTasks = (taskRows.length ? taskRows : fromReports).map((task) => {
          const nested = reportEntryById.get(entryIdOf(task) || rowId(task))
          const dated = reportDateOf(task) || reportDateOf(nested)
          return {
            ...nested,
            ...task,
            report_id: reportIdOf(task) || reportIdOf(nested),
            activity_date: dated,
            activityDate: dated,
            planned_start_time: task.planned_start_time ?? task.plannedStartTime ?? nested?.planned_start_time ?? nested?.plannedStartTime,
            planned_end_time: task.planned_end_time ?? task.plannedEndTime ?? nested?.planned_end_time ?? nested?.plannedEndTime,
            employee_id: task.employee_id ?? task.employeeId ?? nested?.employee_id ?? nested?.employeeId,
            report_status: readString(task, ["report_status", "reportStatus"]) || readString(nested, ["report_status", "reportStatus"]),
            checklist: asRecordArray(task.checklist).length ? task.checklist : nested?.checklist,
          }
        })
        setTasks(mergedTasks)
        setReports(reportRows)
        setTeam([])
      } else {
        const [taskRows, teamRows] = await Promise.all([
          listManagerActivityTasks(accessToken, { limit: 100 }).catch(() => []),
          listManagerActivityAssignees(accessToken).catch(() => []),
        ])
        setTasks(
          taskRows
            .filter((task) => isTeamAssignedActivity(task))
            .map((task) => ({ ...task, report_id: reportIdOf(task) })),
        )
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
    if (loading || !resumeCloseDayRef.current) return
    const day = resumeCloseDayRef.current
    const report = reportForDate(reports, day)
    resumeCloseDayRef.current = null
    if (report) openReportPreview(report)
  }, [loading, reports])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("create") === "1") setCreateOpen(true)
  }, [])

  const day = today()
  const groupedTasks = React.useMemo(() => partitionActivityTasks(tasks, day), [day, tasks])
  const historyReports = React.useMemo(() => pastActivityReports(reports, day), [day, reports])
  const todayReport = React.useMemo(() => reportForDate(reports, day), [day, reports])
  const myEmployeeId = React.useMemo(() => viewerEmployeeId(reports, tasks), [reports, tasks])

  function isManagerAssigned(task: AdminRecord) {
    return isManagerAssignedActivity(task, myEmployeeId)
  }

  const visibleRows = React.useMemo(() => {
    const lower = query.trim().toLowerCase()
    const matchesQuery = (row: AdminRecord) => !lower || JSON.stringify(row).toLowerCase().includes(lower)
    if (tab === "history") {
      return historyReports.map(asReportRow).filter(matchesQuery)
    }
    const source = tab === "upcoming"
      ? groupedTasks.upcoming
      : tab === "assigned"
        ? tasks.filter((task) => isManagerAssignedActivity(task, myEmployeeId))
        : tab === "today"
          ? groupedTasks.today
          : tasks
    return source.filter((task) => {
      if (statusFilter !== "ALL" && taskStatus(task) !== statusFilter) return false
      if (priorityFilter !== "ALL" && taskPriority(task) !== priorityFilter) return false
      return matchesQuery(task)
    })
  }, [groupedTasks.today, groupedTasks.upcoming, historyReports, myEmployeeId, priorityFilter, query, statusFilter, tab, tasks])

  const canAssign = team.length > 0
  const filteredTeam = React.useMemo(() => {
    const needle = teamQuery.trim().toLowerCase()
    if (!needle) return team
    return team.filter((member) => personName(member, optionLabel(member)).toLowerCase().includes(needle))
  }, [team, teamQuery])

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
          ? {
              ...task,
              ...entry,
              report_id: reportId,
              activity_date: reportDateOf(report),
              activityDate: reportDateOf(report),
              report_status: reportStatusOf(report),
              taskReference: entry.taskReference ?? entry.task_reference ?? task.taskReference ?? task.task_reference,
              task_reference: entry.task_reference ?? entry.taskReference ?? task.task_reference ?? task.taskReference,
              externalReferenceType: entry.externalReferenceType ?? entry.external_reference_type ?? task.externalReferenceType ?? task.external_reference_type,
              assignedByEmployeeId: entry.assignedByEmployeeId ?? entry.assigned_by_employee_id ?? task.assignedByEmployeeId ?? task.assigned_by_employee_id,
              assignedBySnapshot: entry.assignedBySnapshot ?? entry.assigned_by_snapshot ?? task.assignedBySnapshot ?? task.assigned_by_snapshot,
              employee_id: report?.employeeId ?? report?.employee_id ?? task.employee_id ?? task.employeeId,
              employeeId: report?.employeeId ?? report?.employee_id ?? task.employeeId ?? task.employee_id,
              comments: entry.comments ?? report?.comments,
              employee: report?.employeeSnapshot ?? report?.employee_snapshot ?? task.employee,
            }
          : {
              ...task,
              report_id: reportId,
              report_status: reportStatusOf(report) || reportStatusOf(task),
              employee_id: report?.employeeId ?? report?.employee_id ?? task.employee_id ?? task.employeeId,
            }
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
    const dated = reportDateOf(match)
    if (mode === "self" && dated && dated > today()) setTab("upcoming")
    else if (mode === "self") setTab("today")
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

  function defaultCreateDate() {
    const closed = Boolean(todayReport) && !canCloseReport(todayReport)
    if (tab === "upcoming" || closed) return addIsoDays(today(), 1)
    return today()
  }

  function resetComposer() {
    setForm({ activity_date: defaultCreateDate(), priority: "MEDIUM" })
    setChecklistDraft("")
    setChecklistItems([])
    setEmployeeIds([])
    setTeamQuery("")
    setCreateOpen(false)
    setAddWorkReason(null)
    setAudience(mode === "manager" ? "employee" : "self")
  }

  function openAddWorkForDay(day: string, reason: "close" | null = null) {
    setPreviewReport(null)
    setSelected(null)
    setAudience("self")
    setAddWorkReason(reason)
    setForm({ activity_date: day, priority: "MEDIUM" })
    setChecklistDraft("")
    setChecklistItems([])
    if (mode === "self") setTab("today")
    setCreateOpen(true)
  }

  async function saveTask() {
    const accessToken = token()
    if (!accessToken) return
    setSaving(true)
    try {
      if (!form.title?.trim() || !form.description?.trim()) {
        throw new Error("Task name and notes are required.")
      }
      const targetDate = form.activity_date || today()
      const existing = reportForDate(reports, targetDate)
      if (existing && isClosedReportStatus(reportStatusOf(existing))) {
        throw new Error("That day is already closed. Pick another date.")
      }
      const taskPayload = {
        activity_date: targetDate,
        title: form.title.trim(),
        description: form.description.trim(),
        planned_start_time: `${targetDate}T09:00:00.000Z`,
        planned_end_time: form.due_date ? `${form.due_date}T17:00:00.000Z` : undefined,
        priority: form.priority || "MEDIUM",
        checklist: checklistPayload(),
      }
      if (audience === "employee") {
        const assigneeIds = [...new Set(employeeIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
        if (!assigneeIds.length) throw new Error("Choose at least one employee.")
        await createManagerActivityTask(accessToken, {
          ...taskPayload,
          employee_id: assigneeIds[0],
          employee_ids: assigneeIds,
        })
        toast.success(assigneeIds.length === 1 ? "Task assigned." : `Task assigned to ${assigneeIds.length} people.`)
      } else {
        await createMyActivityTask(accessToken, taskPayload)
        toast.success(taskPayload.activity_date > today() ? "Work added to an upcoming day." : "Work added to today.")
        if (addWorkReason === "close") resumeCloseDayRef.current = targetDate
        if (mode === "self" && taskPayload.activity_date > today()) setTab("upcoming")
        else if (mode === "self") setTab("today")
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

  function canEditTask(task: AdminRecord) {
    if (mode !== "self" || task.is_report_row) return false
    const status = reportStatusOf(task)
    if (!status) return true
    return isDraftReportStatus(status)
  }

  async function toggleRowComplete(task: AdminRecord, event: React.MouseEvent) {
    event.stopPropagation()
    if (!canEditTask(task)) return
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
    if (!selected || !canEditTask(selected)) return
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
    if (!selected || !canEditTask(selected)) return
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
    const dayToClose = reportDateOf(report) || today()
    if (work.length === 0) {
      openAddWorkForDay(dayToClose, "close")
      return
    }
    setPreviewSummary("")
    setPreviewEntryIds(defaultCloseEntryIds(work))
    setPreviewReport({ ...report, entries: work })
  }

  async function submitReport(report: AdminRecord) {
    const accessToken = token()
    const reportId = reportIdOf(report) || rowId(report)
    const work = asRecordArray(report.entries)
    const selected = work.filter((entry) => previewEntryIds.includes(entryIdOf(entry) || rowId(entry)))
    const dayToClose = reportDateOf(report)
    const issues = closeReportIssues({
      report,
      day: dayToClose,
      entryCount: selected.length,
      completedCount: selected.filter((entry) => taskStatus(entry) === "COMPLETED").length,
      summary: previewSummary,
    })
    if (issues.length) {
      toast.error(issues[0])
      return
    }
    if (!accessToken || !reportId) return
    setSubmitting(true)
    try {
      await submitMyActivityReport(accessToken, reportId, {
        employee_summary: previewSummary.trim(),
        client_request_id: newRequestId(),
        entry_ids: selected.map((entry) => Number(entryIdOf(entry) || rowId(entry))).filter((id) => Number.isFinite(id)),
      })
      const keptOpen = work.length - selected.length
      toast.success(keptOpen > 0 ? `Closed ${formatDate(dayToClose)}. ${keptOpen} item${keptOpen === 1 ? "" : "s"} kept open.` : `Closed ${formatDate(dayToClose)}.`)
      setSelected(null)
      setPreviewReport(null)
      setTab(dayToClose === today() ? "today" : "history")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not close this day.")
    } finally {
      setSubmitting(false)
    }
  }

  function closeOnScreenDay() {
    if (!todayReport || workItemsForReport(todayReport).length === 0) {
      openAddWorkForDay(today(), "close")
      return
    }
    if (!canCloseReport(todayReport)) {
      toast.error("Today is already closed.")
      return
    }
    openReportPreview(todayReport)
  }

  const assignedBy = (task: AdminRecord) => {
    if (isManagerAssigned(task)) {
      return personName(task.assignedBySnapshot ?? task.assigned_by_snapshot, "Manager")
    }
    return "You"
  }

  const photoForAssignee = (task: AdminRecord, who: string) => {
    if (who === "You") return resolveBackendMediaUrl(myPhotoUrl) || myPhotoUrl
    if (mode === "manager") {
      return photoFromRecord(task.employee) || photoFromRecord(task.employeeSnapshot ?? task.employee_snapshot)
    }
    return photoFromRecord(task.assignedBySnapshot ?? task.assigned_by_snapshot)
  }

  const assignedCount = tasks.filter((task) => isManagerAssignedActivity(task, myEmployeeId)).length
  const tabs: Array<[ListTab, string]> = mode === "self"
    ? [
        ["today", "Today"],
        ["assigned", `Assigned to me (${assignedCount})`],
        ["upcoming", `Upcoming (${groupedTasks.upcoming.length})`],
        ["history", `History (${historyReports.length})`],
      ]
    : [["tasks", "Team work"]]

  const todayCompleted = groupedTasks.today.filter((task) => taskStatus(task) === "COMPLETED").length
  const todayStatus = reportStatusOf(todayReport) || (groupedTasks.today.length ? "DRAFT" : "")
  const showTaskFilters = tab !== "history"
  const todayClosed = Boolean(todayReport) && !canCloseReport(todayReport)

  const heroDescription = mode === "manager"
    ? "Work you assigned to your team. Their personal daily items stay in My activities."
    : tab === "upcoming"
      ? "Work filed on a later day. It will not be included when you close today."
      : tab === "assigned"
        ? "Work a manager assigned to you. Close it with the day it belongs to."
        : tab === "history"
        ? "Past days. Open a returned day to close it — this never submits a different date."
        : todayReport
          ? `${formatDate(day)} · ${statusLabel[todayStatus] ?? todayStatus} · ${todayCompleted} of ${groupedTasks.today.length} completed`
          : `${formatDate(day)} · nothing on today's report yet`

  return (
    <section className="min-w-0 space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow={mode === "manager" ? "Team activities" : "My activities"}
        title={mode === "manager" ? "Team activities" : tab === "upcoming" ? "Upcoming work" : tab === "assigned" ? "Assigned to me" : tab === "history" ? "History" : "Today's work"}
        description={heroDescription}
        actions={
          <>
            {mode === "self" && tab === "today" ? (
              <button type="button" className={heroGhostButtonClass} onClick={() => void closeOnScreenDay()} disabled={submitting || todayClosed}>
                {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
                {todayClosed ? "Today closed" : "Close today"}
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
            <input className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "history" ? "Search days..." : "Search work..."} />
          </div>
          {showTaskFilters ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>

      {tab !== "history" ? (
        <div className="flex justify-end">
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setAudience(mode === "manager" ? "employee" : "self")
              setForm((current) => ({ ...current, activity_date: defaultCreateDate(), priority: current.priority || "MEDIUM" }))
              setCreateOpen(true)
            }}
          >
            <PlusIcon className="size-4" /> {mode === "self" ? "Add work" : "Create task"}
          </button>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {tab === "history" ? (
          <div className="hidden grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.4fr)_88px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
            <span>Date</span>
            <span>Work on that day</span>
            <span>Status</span>
          </div>
        ) : (
          <div className="hidden grid-cols-[28px_minmax(160px,1.5fr)_minmax(120px,0.8fr)_88px_88px_72px_88px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
            <span />
            <span>Task name</span>
            <span>{mode === "manager" ? "Assigned to" : "Assigned by"}</span>
            <span>Start date</span>
            <span>Due date</span>
            <span>Priority</span>
            <span>Status</span>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Loading activities...
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <ClipboardListIcon className="size-8 text-muted-foreground/60" />
            <p className="font-medium">{tab === "history" ? "No past days yet" : tab === "upcoming" ? "No upcoming work" : tab === "assigned" ? "Nothing assigned to you" : "Nothing on today's report"}</p>
            <p className="text-sm text-muted-foreground">
              {tab === "history"
                ? "Closed and unclosed previous days will show up here."
                : tab === "upcoming"
                  ? "Add work for a later date if it should not go into today's close-out."
                  : tab === "assigned"
                    ? "When a manager assigns you work, it will show up here."
                  : mode === "manager"
                    ? "Assign work to your team to see it here. Personal daily work stays in My activities."
                    : "Add work for today, or wait for a manager to assign something."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRows.map((task) => {
              if (tab === "history") {
                const entries = asRecordArray(task.entries)
                const dated = reportDateOf(task)
                return (
                  <button
                    type="button"
                    key={reportIdOf(task) || dated}
                    className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 lg:grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.4fr)_88px]"
                    onClick={() => void openTask(task)}
                  >
                    <span className="font-medium text-slate-900">{formatDate(dated)}</span>
                    <span className="text-sm text-slate-600">
                      {entries.length ? `${entries.length} work item${entries.length === 1 ? "" : "s"}` : "No work items"}
                      {canCloseReport(task) ? " · still open" : ""}
                    </span>
                    <span className="hidden lg:block"><StatusPill value={reportStatusOf(task) || "DRAFT"} /></span>
                  </button>
                )
              }
              const status = taskStatus(task)
              const priority = taskPriority(task)
              const due = dueMeta(plannedDueDateOf(task) || taskDate(task))
              const start = plannedStartDateOf(task)
              const assigned = isManagerAssigned(task)
              const who = mode === "manager" ? personName(task.employee) : assignedBy(task)
              const progress = checklistProgress(task)
              const editable = canEditTask(task)
              return (
                <div
                  key={entryIdOf(task) || reportIdOf(task) || `${readString(task, ["title"])}-${String(taskDate(task))}`}
                  className="grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 lg:grid-cols-[28px_minmax(160px,1.5fr)_minmax(120px,0.8fr)_88px_88px_72px_88px]"
                >
                  <button
                    type="button"
                    className="flex size-4 items-center justify-center rounded border border-slate-300 text-primary"
                    aria-label={status === "COMPLETED" ? "Mark not started" : "Mark complete"}
                    disabled={!editable || updatingTaskId === entryIdOf(task)}
                    onClick={(event) => void toggleRowComplete(task, event)}
                  >
                    {updatingTaskId === entryIdOf(task) ? <Loader2Icon className="size-3 animate-spin" /> : <CheckCircle2Icon className={status === "COMPLETED" ? "size-3" : "hidden"} />}
                  </button>
                  <button type="button" className="min-w-0 text-left" onClick={() => void openTask(task)}>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-900">{readString(task, ["title"], "Untitled task")}</span>
                      {assigned ? (
                        <span className="rounded-full bg-sky-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-700">Assigned</span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-700">My work</span>
                      )}
                      {progress ? <span className="text-[10px] text-slate-500">{progress.label}</span> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500 lg:hidden">{who} · {due.label}</span>
                  </button>
                  <button type="button" className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-slate-600 lg:flex" onClick={() => void openTask(task)}>
                    <Avatar name={who} photoUrl={photoForAssignee(task, who)} className="size-6 text-[10px]" />
                    <span className="min-w-0 truncate">{who}</span>
                  </button>
                  <button type="button" className="hidden text-left text-xs text-slate-700 lg:block" onClick={() => void openTask(task)}>
                    {start ? formatDate(start) : ""}
                  </button>
                  <button type="button" className="hidden text-left text-xs lg:block" onClick={() => void openTask(task)}>
                    <span className="block text-slate-700">{plannedDueDateOf(task) ? formatDate(plannedDueDateOf(task)) : ""}</span>
                    {plannedDueDateOf(task) ? (
                      <span className={cn("text-[10px]", due.tone === "danger" ? "text-rose-600" : due.tone === "warn" ? "text-amber-600" : "text-slate-500")}>{due.label}</span>
                    ) : null}
                  </button>
                  <button type="button" className="hidden items-center gap-1 text-xs text-slate-700 lg:flex" onClick={() => void openTask(task)}>
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">{mode === "self" ? "Add work" : "Create task"}</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{audience === "employee" ? "Assign planned work" : mode === "self" ? "Add work to a day" : "Create a task"}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {addWorkReason === "close"
                    ? `Add at least one work item for ${formatDate(form.activity_date || today())}, then you can close that day.`
                    : mode === "self"
                    ? "This item is added to that day's report. Closing a day only submits that date."
                    : "Assign the same task to one person or several people on your team."}
                </p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setCreateOpen(false)}><XIcon className="size-5" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {audience === "employee" ? (
                <div className="grid gap-1.5 text-sm md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Assign to</span>
                    <span className="text-xs text-slate-500">{employeeIds.length ? `${employeeIds.length} of ${team.length} selected` : `Select one, several, or all ${team.length} people`}</span>
                  </div>
                  {!canAssign ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">No employees in your reporting scope</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-slate-300">
                      <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-1.5">
                        <SearchIcon className="size-4 shrink-0 text-slate-400" />
                        <input
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                          value={teamQuery}
                          onChange={(event) => setTeamQuery(event.target.value)}
                          placeholder="Search team members"
                        />
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                          onClick={() => {
                            const visibleIds = filteredTeam.map((member) => rowId(member)).filter(Boolean)
                            const allSelected = visibleIds.length > 0 && visibleIds.every((id) => employeeIds.includes(id))
                            setEmployeeIds((current) => allSelected ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])])
                          }}
                        >
                          {filteredTeam.length > 0 && filteredTeam.every((member) => employeeIds.includes(rowId(member))) ? "Clear visible" : "Select visible"}
                        </button>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                          onClick={() => {
                            const ids = team.map((member) => rowId(member)).filter(Boolean)
                            const allSelected = ids.length > 0 && ids.every((id) => employeeIds.includes(id))
                            setEmployeeIds(allSelected ? [] : ids)
                          }}
                        >
                          {team.length > 0 && team.every((member) => employeeIds.includes(rowId(member))) ? "Clear all" : "Select all"}
                        </button>
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {filteredTeam.map((member) => {
                          const id = rowId(member)
                          const checked = employeeIds.includes(id)
                          return (
                            <label key={id} className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50">
                              <input
                                type="checkbox"
                                className="size-4 accent-sky-700"
                                checked={checked}
                                onChange={() => setEmployeeIds((current) => checked ? current.filter((item) => item !== id) : [...current, id])}
                              />
                              <Avatar name={personName(member, optionLabel(member))} photoUrl={photoFromRecord(member)} className="size-6 text-[10px]" />
                              <span className="min-w-0 flex-1 truncate">{personName(member, optionLabel(member))}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><Avatar name="You" photoUrl={myPhotoUrl} /> Assigned to you</div>
              )}
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Task name</span>
                <input className={inputClass} value={form.title ?? ""} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Prepare monthly attendance summary" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">{mode === "self" ? "Which day is this for?" : "Start date"}</span>
                <DatePickerPresets value={form.activity_date ?? today()} onChange={(value) => setForm((current) => ({ ...current, activity_date: value }))} placeholder="Select the day" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Due date <span className="font-normal text-slate-500">(optional)</span></span>
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
                {audience === "employee" ? (employeeIds.length > 1 ? `Assign to ${employeeIds.length} people` : "Assign task") : "Create task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setPreviewReport(null)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            {(() => {
              const closeDate = reportDateOf(previewReport)
              const entries = asRecordArray(previewReport.entries)
              const selectedEntries = entries.filter((entry) => previewEntryIds.includes(entryIdOf(entry) || rowId(entry)))
              const deferred = entries.filter((entry) => !previewEntryIds.includes(entryIdOf(entry) || rowId(entry)))
              const limits = policyLimits(previewReport)
              const issues = closeReportIssues({
                report: previewReport,
                day: closeDate,
                entryCount: selectedEntries.length,
                completedCount: selectedEntries.filter((entry) => taskStatus(entry) === "COMPLETED").length,
                summary: previewSummary,
              })
              function toggleCloseEntry(entry: AdminRecord) {
                const id = entryIdOf(entry) || rowId(entry)
                if (!id || !isCloseableActivityStatus(taskStatus(entry))) return
                setPreviewEntryIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
              }
              return (
                <>
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Close this day</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">{formatDate(closeDate)}</h2>
                <p className="mt-1 text-sm text-slate-500">Pick the work to submit. In-progress items stay open and move to the next day.</p>
              </div>
              <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setPreviewReport(null)}><XIcon className="size-5" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <StatusPill value={readString(previewReport, ["status"], "DRAFT")} />
                <span className="text-slate-500">{selectedEntries.length} selected · {deferred.length} kept open</span>
                <span className="text-slate-500">Need {limits.minCompleted} complete · cutoff {limits.cutoff}</span>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Submit these</p>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {entries.map((entry) => {
                    const id = entryIdOf(entry) || rowId(entry)
                    const closeable = isCloseableActivityStatus(taskStatus(entry))
                    const checked = previewEntryIds.includes(id)
                    return (
                      <label key={id} className={cn("flex items-start gap-3 px-3 py-2.5", closeable ? "cursor-pointer" : "cursor-not-allowed bg-slate-50")}>
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-sky-700"
                          checked={checked}
                          disabled={!closeable}
                          onChange={() => toggleCloseEntry(entry)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">{readString(entry, ["title"], "Untitled task")}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {closeable ? readString(entry, ["description"], "No notes") : "In progress — this stays open and will not be locked."}
                          </p>
                        </div>
                        <StatusPill value={taskStatus(entry)} />
                      </label>
                    )
                  })}
                </div>
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Summary for your manager</span>
                <textarea className={`${inputClass} min-h-20 py-2`} value={previewSummary} onChange={(event) => setPreviewSummary(event.target.value)} placeholder="What should your manager know about this day?" />
              </label>
              {issues.length ? (
                <ul className="space-y-1 text-sm text-rose-700">
                  {issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" className={secondaryButtonClass} onClick={() => setPreviewReport(null)}>Back</button>
              {entries.filter((entry) => isCloseableActivityStatus(taskStatus(entry))).length === 0 ? (
                <button type="button" className={primaryButtonClass} onClick={() => openAddWorkForDay(closeDate, "close")}>
                  <PlusIcon className="size-4" /> Add a work item
                </button>
              ) : (
                <button type="button" className={primaryButtonClass} onClick={() => void submitReport(previewReport)} disabled={submitting || issues.length > 0}>
                  {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                  Close {formatDate(closeDate)}
                </button>
              )}
            </div>
                </>
              )
            })()}
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
                  <Avatar
                    name={mode === "manager" ? personName(selected.employee) : assignedBy(selected)}
                    photoUrl={photoForAssignee(selected, mode === "manager" ? personName(selected.employee) : assignedBy(selected))}
                  />
                  <div>
                    <p className="font-medium">{mode === "manager" ? personName(selected.employee) : assignedBy(selected)}</p>
                    {hasDueDate(selected) || reportDateOf(selected) ? (
                      <p className="text-xs text-slate-500">
                        {hasDueDate(selected)
                          ? `Due ${formatDate(plannedDueDateOf(selected))}`
                          : formatDate(reportDateOf(selected))}
                      </p>
                    ) : null}
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
                  {mode === "self" && canCloseReport(selected) ? (
                    <button type="button" className={`${primaryButtonClass} mt-4`} onClick={() => openReportPreview(selected)} disabled={submitting}>
                      {submitting ? <Loader2Icon className="size-4 animate-spin" /> : <FileTextIcon className="size-4" />}
                      Close {formatDate(reportDateOf(selected))}
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Status
                      {mode === "self" && canEditTask(selected) ? (
                        <select className={inputClass} value={taskEditStatus} onChange={(event) => setTaskEditStatus(event.target.value)}>
                          <option value="PLANNED">Not started</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="DEFERRED">Deferred</option>
                        </select>
                      ) : (
                        <span className="flex h-10 items-center"><StatusPill value={taskStatus(selected)} /></span>
                      )}
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Priority
                      <span className="flex h-10 items-center gap-1.5 text-sm font-medium text-slate-800"><PriorityDot priority={taskPriority(selected)} /> {taskPriority(selected).charAt(0) + taskPriority(selected).slice(1).toLowerCase()}</span>
                    </label>
                    {plannedStartDateOf(selected) ? (
                      <div className="grid gap-1 text-xs font-medium text-slate-500">
                        Start date
                        <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800"><CalendarDaysIcon className="size-4 text-slate-400" />{formatDate(plannedStartDateOf(selected))}</span>
                      </div>
                    ) : null}
                    {hasDueDate(selected) ? (
                      <div className="grid gap-1 text-xs font-medium text-slate-500">
                        Due date
                        <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800"><CalendarDaysIcon className="size-4 text-slate-400" />{formatDate(plannedDueDateOf(selected))}</span>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                  {mode === "self" && canEditTask(selected) ? (
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
                              {mode === "self" && canEditTask(selected) ? (
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
                        const authorPhoto = author === "You" ? myPhotoUrl : photoFromRecord(item.authorSnapshot ?? item.author_snapshot)
                        return (
                          <div key={rowId(item)} className="flex gap-2 text-sm">
                            <Avatar name={author} photoUrl={authorPhoto} />
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
