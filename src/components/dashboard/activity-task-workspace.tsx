"use client";

import { ActivityEvidencePicker } from "@/components/dashboard/activity-evidence-picker";
import { WorkflowGuide } from "@/components/dashboard/workflow-guide";
import { ValidatedWorkflowForm } from "@/components/dashboard/validated-workflow-form";
import { activityTaskSchema } from "@/lib/workflow-schemas";
import { workflowFailure } from "@/lib/workflow-error";
import { useWorkflowRequest } from "@/hooks/use-workflow-request";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { Input as FluentInput } from "@fluentui/react-components";
import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  Clock3Icon,
  ClipboardListIcon,
  Columns3Icon,
  FileTextIcon,
  GripVerticalIcon,
  HistoryIcon,
  InboxIcon,
  ListIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SendIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import {
  Info20Regular,
  Search20Regular as SearchIcon,
} from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

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
} from "@/components/dashboard/talent-visuals";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import { FluentSelect } from "@/components/ui/fluent-select";
import { TimeClockPicker } from "@/components/ui/time-clock-picker";
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
} from "@/lib/activity-day";
import { cn } from "@/lib/utils";
import {
  addManagerActivityComment,
  addMyActivityComment,
  createManagerActivityTask,
  createMyActivityTask,
  getManagerActivityReport,
  getMyActivityReport,
  getMyAttendanceSchedule,
  listManagerActivityAssignees,
  listManagerActivityCategories,
  listManagerActivityTasks,
  listManagerEmployeeKpis,
  listMyActivities,
  listMyActivityCategories,
  listMyActivityTasks,
  listMyEmployeeKpis,
  submitMyActivityReport,
  updateManagerActivitySchedule,
  updateMyActivityEntry,
  extractProfilePhotoUrl,
  type AdminRecord,
} from "@/lib/admin-api";
import { useMyProfilePhoto } from "@/lib/my-profile-photo";
import { resolveBackendMediaUrl } from "@/lib/backend-media-url";
import { hasPermission } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type WorkspaceMode = "self" | "manager";
type ListTab = "today" | "upcoming" | "history" | "assigned" | "tasks";
type WorkspaceView = "timeline" | "board" | "list";
type TimelineDragMode = "move" | "resize-start" | "resize-end";
type TimelineDrag = {
  key: string;
  task: AdminRecord;
  mode: TimelineDragMode;
  originX: number;
  trackWidth: number;
  originalStart: number;
  originalEnd: number;
  previewStart: number;
  previewEnd: number;
};

const statusLabel: Record<string, string> = {
  PLANNED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  PENDING: "Pending review",
  NOT_REQUIRED: "No review",
  RETURNED_FOR_CORRECTION: "Returned",
  REJECTED: "Rejected",
};

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function newRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return localIsoDate();
}

function personName(value: unknown, fallback = "Unassigned") {
  const record = asRecord(value);
  if (!record) return fallback;
  return readString(record, ["full_name", "fullName", "name"], fallback);
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? parts[0]?.[1] ?? ""}`.toUpperCase() ||
    "?"
  );
}

function viewerEmployeeId(reports: AdminRecord[], tasks: AdminRecord[]) {
  for (const row of [...reports, ...tasks]) {
    const id = readString(row, ["employeeId", "employee_id"]);
    if (id) return id;
  }
  return "";
}

function taskStatus(task: AdminRecord) {
  return readString(task, ["status"], "PLANNED").toUpperCase();
}

function taskPriority(task: AdminRecord) {
  return readString(task, ["priority"], "MEDIUM").toUpperCase();
}

function taskReviewStatus(task: AdminRecord) {
  return readString(
    task,
    ["reviewStatus", "review_status"],
    "NOT_REQUIRED",
  ).toUpperCase();
}

function taskPerformanceRelevance(task: AdminRecord) {
  return readString(
    task,
    ["performanceRelevance", "performance_relevance"],
    "NOT_EVALUATED",
  ).toUpperCase();
}

function performanceRelevanceLabel(value: string) {
  return (
    {
      NOT_EVALUATED: "Not evaluated",
      SUPPORTING_EVIDENCE: "Supporting evidence",
      KEY_DELIVERABLE: "Key deliverable",
      DEVELOPMENT_ACTIVITY: "Development activity",
    }[value] ?? value
  );
}

function reportIdOf(row: AdminRecord | null | undefined) {
  return readString(row, [
    "report_id",
    "reportId",
    "dailyActivityReportId",
    "daily_activity_report_id",
  ]);
}

function entryIdOf(row: AdminRecord | null | undefined) {
  if (!row || row.is_report_row) return "";
  return readString(row, ["id"]);
}

function taskDate(task: AdminRecord) {
  return plannedDueDateOf(task) || reportDateOf(task);
}

function hasDueDate(task: AdminRecord) {
  return Boolean(plannedDueDateOf(task));
}

function isDraftReportStatus(status: string) {
  return canCloseReport({ status });
}

function checklistProgress(task: AdminRecord) {
  const items = asRecordArray(task.checklist);
  if (!items.length) return null;
  const done = items.filter((item) => item.completed === true).length;
  return { done, total: items.length, label: `${done}/${items.length}` };
}

function dueMeta(value: unknown) {
  if (typeof value !== "string" || !value.trim())
    return { label: "No date", tone: "muted" as const };
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return { label: value, tone: "muted" as const };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return { label: "Due today", tone: "danger" as const };
  if (days === 1) return { label: "Tomorrow", tone: "warn" as const };
  if (days > 1 && days < 14)
    return { label: `In ${days} days`, tone: "muted" as const };
  if (days === -1) return { label: "Yesterday", tone: "danger" as const };
  if (days < 0)
    return { label: `${Math.abs(days)} days overdue`, tone: "danger" as const };
  return { label: formatDate(value), tone: "muted" as const };
}

function plannedDateTimeOf(task: AdminRecord, kind: "start" | "end") {
  const value =
    kind === "start"
      ? readString(task, ["plannedStartTime", "planned_start_time"])
      : readString(task, ["plannedEndTime", "planned_end_time"]);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesOfDay(value: Date) {
  return value.getHours() * 60 + value.getMinutes();
}

function minutesFromScheduleTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(trimmed);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : minutesOfDay(parsed);
}

function formatTimelineTime(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function localTaskDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function timeFromMinutes(value: number) {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(value)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function entriesFromReports(reports: AdminRecord[]): AdminRecord[] {
  return reports.flatMap((report) =>
    asRecordArray(report.entries ?? report.items ?? report.activities).map(
      (entry) => ({
        ...entry,
        report_id: reportIdOf(report) || rowId(report),
        activity_date: report.activityDate ?? report.activity_date,
        report_status: report.status,
        employee_id: report.employeeId ?? report.employee_id,
        employee: report.employeeSnapshot ?? report.employee_snapshot,
      }),
    ),
  );
}

function asReportRow(report: AdminRecord): AdminRecord {
  const entries = asRecordArray(
    report.entries ?? report.items ?? report.activities,
  );
  const dated = formatDate(report.activityDate ?? report.activity_date);
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
  };
}

function Avatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [photoUrl]);
  const showPhoto = Boolean(photoUrl) && !failed;
  return (
    <span
      className={cn(
        "relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800 ring-1 ring-slate-200",
        className,
      )}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl ?? ""}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function photoFromRecord(value: unknown) {
  return resolveBackendMediaUrl(extractProfilePhotoUrl(value));
}

function PriorityDot({ priority }: { priority: string }) {
  const color =
    {
      URGENT: "bg-rose-500",
      HIGH: "bg-rose-500",
      MEDIUM: "bg-amber-400",
      LOW: "bg-emerald-500",
    }[priority] ?? "bg-slate-400";
  return <span className={cn("size-2 rounded-full", color)} />;
}

function StatusPill({ value }: { value: string }) {
  const label = statusLabel[value] ?? value;
  const tone =
    value === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700"
      : value === "IN_PROGRESS"
        ? "bg-sky-50 text-sky-700"
        : value === "DRAFT" || value === "RETURNED_FOR_CORRECTION"
          ? "bg-amber-50 text-amber-800"
          : "bg-slate-100 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-1.5 py-px text-[10px] font-medium leading-4",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function ActivityTaskWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor();
  const { url: myPhotoUrl } = useMyProfilePhoto();
  const [tab, setTab] = React.useState<ListTab>(
    mode === "manager" ? "tasks" : "today",
  );
  const [workspaceView, setWorkspaceView] =
    React.useState<WorkspaceView>("timeline");
  const [tasks, setTasks] = React.useState<AdminRecord[]>([]);
  const [reports, setReports] = React.useState<AdminRecord[]>([]);
  const [dailySchedule, setDailySchedule] = React.useState<AdminRecord | null>(
    null,
  );
  const [team, setTeam] = React.useState<AdminRecord[]>([]);
  const [employeeKpis, setEmployeeKpis] = React.useState<AdminRecord[]>([]);
  const [activityCategories, setActivityCategories] = React.useState<
    AdminRecord[]
  >([]);
  const [selected, setSelected] = React.useState<AdminRecord | null>(null);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [priorityFilter, setPriorityFilter] = React.useState("ALL");
  const [reviewFilter, setReviewFilter] = React.useState("ALL");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({
    activity_date: today(),
    start_time: "09:00",
    end_time: "10:00",
    priority: "MEDIUM",
    performance_relevance: "NOT_EVALUATED",
  });
  const [checklistDraft, setChecklistDraft] = React.useState("");
  const [checklistItems, setChecklistItems] = React.useState<string[]>([]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [commenting, setCommenting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [addWorkReason, setAddWorkReason] = React.useState<"close" | null>(
    null,
  );
  const [employeeIds, setEmployeeIds] = React.useState<string[]>([]);
  const [teamQuery, setTeamQuery] = React.useState("");
  const [previewReport, setPreviewReport] = React.useState<AdminRecord | null>(
    null,
  );
  const [previewSummary, setPreviewSummary] = React.useState("");
  const [previewEntryIds, setPreviewEntryIds] = React.useState<string[]>([]);
  const [taskEditStatus, setTaskEditStatus] = React.useState("PLANNED");
  const [taskOutcome, setTaskOutcome] = React.useState("");
  const [audience, setAudience] = React.useState<"employee" | "self">(
    mode === "manager" ? "employee" : "self",
  );
  const [updatingChecklistId, setUpdatingChecklistId] = React.useState<
    string | null
  >(null);
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(
    null,
  );
  const [scheduleTarget, setScheduleTarget] =
    React.useState<AdminRecord | null>(null);
  const [scheduleForm, setScheduleForm] = React.useState({
    date: today(),
    start: "09:00",
    end: "10:00",
  });
  const [scheduleSaving, setScheduleSaving] = React.useState(false);
  const [timelineDrag, setTimelineDrag] = React.useState<TimelineDrag | null>(
    null,
  );
  const [timelineSavingId, setTimelineSavingId] = React.useState<string | null>(
    null,
  );
  const [unscheduledOpen, setUnscheduledOpen] = React.useState(false);
  const timelineDragRef = React.useRef<TimelineDrag | null>(null);
  const timelineMovedRef = React.useRef(false);
  const openedFocusRef = React.useRef<string | null>(null);
  const resumeCloseDayRef = React.useRef<string | null>(null);

  const { begin, invalidate, credential } = useWorkflowRequest(mode);

  const load = React.useCallback(async () => {
    const { commit, current } = begin();
    void current;
    const accessToken = credential?.trim() || token();
    if (!accessToken) {
      commit(() => setError("Authentication required. Please log in again."));
      commit(() => setLoading(false));
      return;
    }
    commit(() => setLoading(true));
    commit(() => setError(null));
    try {
      if (mode === "self") {
        const scheduleDate = today();
        const [taskRows, reportRows, kpiRows, scheduleRows, categoryRows] =
          await Promise.all([
            listMyActivityTasks(accessToken, { limit: 100 }),
            listMyActivities(accessToken, { limit: 100 }),
            listMyEmployeeKpis(accessToken, { status: "APPROVED", limit: 100 }),
            getMyAttendanceSchedule(accessToken, {
              from_date: scheduleDate,
              to_date: scheduleDate,
            }),
            listMyActivityCategories(accessToken),
          ]);
        const fromReports = entriesFromReports(reportRows);
        const reportEntryById = new Map(
          fromReports.map((entry) => [entryIdOf(entry) || rowId(entry), entry]),
        );
        const mergedTasks = (taskRows.length ? taskRows : fromReports).map(
          (task) => {
            const nested = reportEntryById.get(entryIdOf(task) || rowId(task));
            const dated = reportDateOf(task) || reportDateOf(nested);
            return {
              ...nested,
              ...task,
              report_id: reportIdOf(task) || reportIdOf(nested),
              activity_date: dated,
              activityDate: dated,
              planned_start_time:
                task.planned_start_time ??
                task.plannedStartTime ??
                nested?.planned_start_time ??
                nested?.plannedStartTime,
              planned_end_time:
                task.planned_end_time ??
                task.plannedEndTime ??
                nested?.planned_end_time ??
                nested?.plannedEndTime,
              employee_id:
                task.employee_id ??
                task.employeeId ??
                nested?.employee_id ??
                nested?.employeeId,
              report_status:
                readString(task, ["report_status", "reportStatus"]) ||
                readString(nested, ["report_status", "reportStatus"]),
              checklist: asRecordArray(task.checklist).length
                ? task.checklist
                : nested?.checklist,
            };
          },
        );
        commit(() => setTasks(mergedTasks));
        commit(() => setReports(reportRows));
        commit(() =>
          setDailySchedule(
            scheduleRows.find(
              (schedule) => readString(schedule, ["date"]) === scheduleDate,
            ) ?? null,
          ),
        );
        commit(() => setTeam([]));
        commit(() => setEmployeeKpis(kpiRows));
        commit(() => setActivityCategories(categoryRows));
      } else {
        const [taskRows, teamRows, kpiRows, categoryRows] = await Promise.all([
          listManagerActivityTasks(accessToken, { limit: 100 }),
          listManagerActivityAssignees(accessToken),
          listManagerEmployeeKpis(accessToken, {
            status: "APPROVED",
            limit: 100,
          }),
          listManagerActivityCategories(accessToken),
        ]);
        commit(() =>
          setTasks(
            taskRows
              .filter((task) => isTeamAssignedActivity(task))
              .map((task) => ({ ...task, report_id: reportIdOf(task) })),
          ),
        );
        commit(() => setTeam(teamRows));
        commit(() => setEmployeeKpis(kpiRows));
        commit(() => setActivityCategories(categoryRows));
        commit(() => setDailySchedule(null));
      }
    } catch (errorObject) {
      commit(() =>
        setError(workflowFailure(errorObject, "Could not load activities.")),
      );
    } finally {
      commit(() => setLoading(false));
    }
  }, [begin, credential, mode]);

  React.useEffect(() => {
    if (actor.ready) void load();
    return invalidate;
  }, [actor.ready, load, invalidate]);

  const openPreviewFromEffect = React.useEffectEvent((report: AdminRecord) =>
    openReportPreview(report),
  );
  const openTaskFromEffect = React.useEffectEvent((task: AdminRecord) => {
    void openTask(task);
  });

  React.useEffect(() => {
    if (loading || !resumeCloseDayRef.current) return;
    const day = resumeCloseDayRef.current;
    const report = reportForDate(reports, day);
    resumeCloseDayRef.current = null;
    if (report) openPreviewFromEffect(report);
  }, [loading, reports]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") setCreateOpen(true);
    if (mode === "self" && params.get("tab") === "tasks") setTab("tasks");
    if (
      ["PLANNED", "IN_PROGRESS", "COMPLETED"].includes(
        params.get("status") ?? "",
      )
    ) {
      setStatusFilter(params.get("status") ?? "ALL");
    }
    const linkedKpiId = params.get("kpi");
    if (linkedKpiId)
      setForm((current) => ({
        ...current,
        employee_kpi_id: linkedKpiId,
        performance_relevance:
          !current.performance_relevance ||
          current.performance_relevance === "NOT_EVALUATED"
            ? "KEY_DELIVERABLE"
            : current.performance_relevance,
      }));
  }, [mode]);

  const day = today();
  const groupedTasks = React.useMemo(
    () => partitionActivityTasks(tasks, day),
    [day, tasks],
  );
  const historyReports = React.useMemo(
    () => pastActivityReports(reports, day),
    [day, reports],
  );
  const todayReport = React.useMemo(
    () => reportForDate(reports, day),
    [day, reports],
  );
  const myEmployeeId = React.useMemo(
    () => viewerEmployeeId(reports, tasks),
    [reports, tasks],
  );

  function isManagerAssigned(task: AdminRecord) {
    return isManagerAssignedActivity(task, myEmployeeId);
  }

  const visibleRows = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    const matchesQuery = (row: AdminRecord) =>
      !lower || JSON.stringify(row).toLowerCase().includes(lower);
    if (tab === "history") {
      return historyReports.map(asReportRow).filter(matchesQuery);
    }
    const source =
      tab === "upcoming"
        ? groupedTasks.upcoming
        : tab === "assigned"
          ? tasks.filter((task) =>
              isManagerAssignedActivity(task, myEmployeeId),
            )
          : tab === "today"
            ? groupedTasks.today
            : tasks;
    return source.filter((task) => {
      if (statusFilter !== "ALL" && taskStatus(task) !== statusFilter)
        return false;
      if (priorityFilter !== "ALL" && taskPriority(task) !== priorityFilter)
        return false;
      if (reviewFilter !== "ALL" && taskReviewStatus(task) !== reviewFilter)
        return false;
      return matchesQuery(task);
    });
  }, [
    groupedTasks.today,
    groupedTasks.upcoming,
    historyReports,
    myEmployeeId,
    priorityFilter,
    query,
    reviewFilter,
    statusFilter,
    tab,
    tasks,
  ]);

  const boardColumns = React.useMemo(() => {
    const columns = [
      {
        id: "todo",
        label: "To-do",
        tone: "text-slate-600",
        rows: [] as AdminRecord[],
      },
      {
        id: "progress",
        label: "In progress",
        tone: "text-sky-700",
        rows: [] as AdminRecord[],
      },
      {
        id: "review",
        label: "On review",
        tone: "text-amber-700",
        rows: [] as AdminRecord[],
      },
      {
        id: "complete",
        label: "Complete",
        tone: "text-emerald-700",
        rows: [] as AdminRecord[],
      },
    ];
    visibleRows.forEach((task) => {
      const status = taskStatus(task);
      const reviewStatus = taskReviewStatus(task);
      if (
        ["PENDING", "SUBMITTED", "UNDER_REVIEW"].includes(status) ||
        reviewStatus === "PENDING"
      ) {
        columns[2].rows.push(task);
      } else if (
        ["COMPLETED", "APPROVED", "CLOSED"].includes(status) ||
        reviewStatus === "APPROVED"
      ) {
        columns[3].rows.push(task);
      } else if (status === "IN_PROGRESS") {
        columns[1].rows.push(task);
      } else {
        columns[0].rows.push(task);
      }
    });
    return columns;
  }, [visibleRows]);

  const timeline = React.useMemo(() => {
    const rows = visibleRows
      .filter((task) => !task.is_report_row)
      .map((task) => {
        const start = plannedDateTimeOf(task, "start");
        const end = plannedDateTimeOf(task, "end");
        return { task, start, end };
      })
      .sort(
        (left, right) =>
          (left.start?.getTime() ?? 0) - (right.start?.getTime() ?? 0),
      );

    const scheduled = rows.filter(
      (row): row is { task: AdminRecord; start: Date; end: Date } =>
        Boolean(row.start && row.end),
    );
    const unscheduled = rows.filter((row) => !row.start || !row.end);
    const shift = asRecord(dailySchedule?.shift);
    const shiftStart = minutesFromScheduleTime(
      shift?.start_time ?? shift?.startTime ?? dailySchedule?.start_time,
    );
    const shiftEnd = minutesFromScheduleTime(
      shift?.end_time ?? shift?.endTime ?? dailySchedule?.end_time,
    );
    const firstMinute = scheduled.length
      ? Math.min(
          ...scheduled.map((row) => minutesOfDay(row.start)),
          shiftStart ?? Number.POSITIVE_INFINITY,
        )
      : (shiftStart ?? 8 * 60);
    const lastMinute = scheduled.length
      ? Math.max(
          ...scheduled.map((row) => minutesOfDay(row.end)),
          shiftEnd ?? Number.NEGATIVE_INFINITY,
        )
      : (shiftEnd ?? 17 * 60);
    const startHour = Math.max(0, Math.floor(firstMinute / 60));
    const endHour = Math.min(24, Math.ceil(lastMinute / 60));
    const totalMinutes = Math.max(60, (endHour - startHour) * 60);

    return {
      rows: scheduled,
      unscheduled,
      startHour,
      endHour,
      totalMinutes,
      hours: Array.from(
        { length: endHour - startHour + 1 },
        (_, index) => startHour + index,
      ),
    };
  }, [dailySchedule, visibleRows]);

  const canAssign = team.length > 0;
  const selectedTeamMembers = employeeIds
    .map((id) => team.find((member) => rowId(member) === id))
    .filter((member): member is AdminRecord => Boolean(member));
  const managerSelectableCategories = activityCategories.filter((category) =>
    selectedTeamMembers.every((member) => {
      const departmentId = readString(category, [
        "departmentId",
        "department_id",
      ]);
      const positionId = readString(category, ["positionId", "position_id"]);
      const gradeId = readString(category, ["gradeId", "grade_id"]);
      const memberDepartmentId =
        rowId(asRecord(member.department)) ||
        readString(member, ["primary_department_id", "department_id"]);
      const memberPositionId =
        rowId(asRecord(member.position)) ||
        readString(member, ["primary_position_id", "position_id"]);
      const memberGradeId = readString(member, ["grade_id", "gradeId"]);
      return (
        (!departmentId || departmentId === memberDepartmentId) &&
        (!positionId || positionId === memberPositionId) &&
        (!gradeId || gradeId === memberGradeId)
      );
    }),
  );
  const filteredTeam = React.useMemo(() => {
    const needle = teamQuery.trim().toLowerCase();
    if (!needle) return team;
    return team.filter((member) =>
      personName(member, optionLabel(member)).toLowerCase().includes(needle),
    );
  }, [team, teamQuery]);

  const { begin: beginDetail, invalidate: invalidateDetail } =
    useWorkflowRequest(`${mode}:detail`);

  function clearSelected() {
    invalidateDetail();
    setSelected(null);
  }

  async function openTask(task: AdminRecord) {
    const { current } = beginDetail();
    const accessToken = token();
    const reportId = reportIdOf(task);
    if (accessToken && reportId) {
      try {
        const report =
          mode === "self"
            ? await getMyActivityReport(accessToken, reportId)
            : await getManagerActivityReport(accessToken, reportId);
        if (!current()) return;
        if (task.is_report_row) {
          setSelected(asReportRow((report ?? task) as AdminRecord));
          setTaskOutcome("");
          return;
        }
        const wanted = entryIdOf(task);
        const entry = asRecordArray(report?.entries).find(
          (candidate) => entryIdOf(candidate) === wanted,
        );
        const detail = entry
          ? {
              ...task,
              ...entry,
              report_id: reportId,
              activity_date: reportDateOf(report),
              activityDate: reportDateOf(report),
              report_status: reportStatusOf(report),
              taskReference:
                entry.taskReference ??
                entry.task_reference ??
                task.taskReference ??
                task.task_reference,
              task_reference:
                entry.task_reference ??
                entry.taskReference ??
                task.task_reference ??
                task.taskReference,
              externalReferenceType:
                entry.externalReferenceType ??
                entry.external_reference_type ??
                task.externalReferenceType ??
                task.external_reference_type,
              assignedByEmployeeId:
                entry.assignedByEmployeeId ??
                entry.assigned_by_employee_id ??
                task.assignedByEmployeeId ??
                task.assigned_by_employee_id,
              assignedBySnapshot:
                entry.assignedBySnapshot ??
                entry.assigned_by_snapshot ??
                task.assignedBySnapshot ??
                task.assigned_by_snapshot,
              employee_id:
                report?.employeeId ??
                report?.employee_id ??
                task.employee_id ??
                task.employeeId,
              employeeId:
                report?.employeeId ??
                report?.employee_id ??
                task.employeeId ??
                task.employee_id,
              comments: entry.comments ?? report?.comments,
              employee:
                report?.employeeSnapshot ??
                report?.employee_snapshot ??
                task.employee,
            }
          : {
              ...task,
              report_id: reportId,
              report_status: reportStatusOf(report) || reportStatusOf(task),
              employee_id:
                report?.employeeId ??
                report?.employee_id ??
                task.employee_id ??
                task.employeeId,
            };
        setSelected(detail);
        setTaskEditStatus(taskStatus(detail));
        setTaskOutcome(readString(detail, ["outcome"]));
        return;
      } catch (cause) {
        if (!current()) return;
        toast.error(
          cause instanceof Error
            ? cause.message
            : "The task details could not be loaded. The list snapshot is shown.",
        );
      }
    }
    setSelected({ ...task, report_id: reportId });
    setTaskEditStatus(taskStatus(task));
    setTaskOutcome(readString(task, ["outcome"]));
  }

  React.useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get("task") || params.get("highlight");
    if (!focusId || openedFocusRef.current === focusId) return;
    const match = tasks.find((task) => entryIdOf(task) === focusId);
    if (!match) return;
    openedFocusRef.current = focusId;
    const dated = reportDateOf(match);
    if (mode === "self" && dated && dated > today()) setTab("upcoming");
    else if (mode === "self") setTab("today");
    openTaskFromEffect(match);
  }, [loading, tasks, mode]);

  function addChecklistItem() {
    const item = checklistDraft.trim();
    if (!item) return;
    setChecklistItems((current) => [...current, item]);
    setChecklistDraft("");
  }

  function checklistPayload() {
    return checklistItems.map((title, index) => ({
      id: `item-${index + 1}`,
      title,
      completed: false,
    }));
  }

  function defaultCreateDate() {
    const closed = Boolean(todayReport) && !canCloseReport(todayReport);
    if (tab === "upcoming" || closed) return addIsoDays(today(), 1);
    return today();
  }

  function resetComposer() {
    setForm({
      activity_date: defaultCreateDate(),
      start_time: "09:00",
      end_time: "10:00",
      priority: "MEDIUM",
      performance_relevance: "NOT_EVALUATED",
      activity_category_id: "",
    });
    setChecklistDraft("");
    setChecklistItems([]);
    setEmployeeIds([]);
    setTeamQuery("");
    setCreateOpen(false);
    setAddWorkReason(null);
    setAudience(mode === "manager" ? "employee" : "self");
  }

  function openAddWorkForDay(day: string, reason: "close" | null = null) {
    setPreviewReport(null);
    clearSelected();
    setAudience("self");
    setAddWorkReason(reason);
    setForm({
      activity_date: day,
      start_time: "09:00",
      end_time: "10:00",
      priority: "MEDIUM",
      performance_relevance: "NOT_EVALUATED",
      activity_category_id: "",
    });
    setChecklistDraft("");
    setChecklistItems([]);
    if (mode === "self") setTab("today");
    setCreateOpen(true);
  }

  const { begin: beginMutation } = useWorkflowRequest(
    `${mode}:${JSON.stringify({ form, audience, employeeIds, checklistItems })}`,
  );
  React.useEffect(() => {
    setSaving(false);
  }, [credential, mode, beginMutation]);

  async function saveTask() {
    const validationResult = activityTaskSchema.safeParse({
      ...form,
      audience,
      employeeIds,
      checklistItems,
    });
    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues
          .map(
            (issue) => issue.path.map(String).join(".") + ": " + issue.message,
          )
          .join("; "),
      );
      return;
    }
    if (saving) return;
    const accessToken = token();
    if (!accessToken) return;
    setFormError(null);
    const { current: isMutationCurrent } = beginMutation();
    setSaving(true);
    try {
      if (!form.title?.trim() || !form.description?.trim()) {
        throw new Error("Task name and notes are required.");
      }
      const targetDate = form.activity_date || today();
      const startTime = form.start_time || "09:00";
      const endTime = form.end_time || "10:00";
      const plannedStart = localTaskDateTime(targetDate, startTime);
      const plannedEnd = localTaskDateTime(targetDate, endTime);
      if (!plannedStart || !plannedEnd) {
        throw new Error("Choose a valid start and end time.");
      }
      if (new Date(plannedEnd).getTime() <= new Date(plannedStart).getTime()) {
        throw new Error("End time must be later than start time.");
      }
      const existing = reportForDate(reports, targetDate);
      if (existing && isClosedReportStatus(reportStatusOf(existing))) {
        throw new Error("That day is already closed. Pick another date.");
      }
      const relatedKpi = employeeKpis.find(
        (kpi) => rowId(kpi) === form.employee_kpi_id,
      );
      const canLinkRelatedKpi =
        Boolean(relatedKpi) &&
        (audience !== "employee" ||
          (employeeIds.length === 1 &&
            readString(relatedKpi, ["employeeId", "employee_id"]) ===
              employeeIds[0]));
      const taskPayload = {
        activity_date: targetDate,
        activity_category_id: form.activity_category_id
          ? Number(form.activity_category_id)
          : undefined,
        title: form.title.trim(),
        description: form.description.trim(),
        planned_start_time: plannedStart,
        planned_end_time: plannedEnd,
        due_date: form.due_date || undefined,
        expected_result: form.expected_result?.trim() || undefined,
        employee_kpi_id: canLinkRelatedKpi
          ? Number(form.employee_kpi_id)
          : undefined,
        performance_relevance:
          form.performance_relevance ||
          (canLinkRelatedKpi ? "KEY_DELIVERABLE" : "NOT_EVALUATED"),
        priority: form.priority || "MEDIUM",
        checklist: checklistPayload(),
      };
      if (audience === "employee") {
        const assigneeIds = [
          ...new Set(
            employeeIds
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0),
          ),
        ];
        if (!assigneeIds.length)
          throw new Error("Choose at least one employee.");
        await createManagerActivityTask(accessToken, {
          ...taskPayload,
          employee_id: assigneeIds[0],
          employee_ids: assigneeIds,
        });
        if (!isMutationCurrent()) return;
        toast.success(
          assigneeIds.length === 1
            ? "Task assigned."
            : `Task assigned to ${assigneeIds.length} people.`,
        );
      } else {
        await createMyActivityTask(accessToken, taskPayload);
        if (!isMutationCurrent()) return;
        toast.success(
          taskPayload.activity_date > today()
            ? "Work added to an upcoming day."
            : "Work added to today.",
        );
        if (addWorkReason === "close") resumeCloseDayRef.current = targetDate;
        if (mode === "self" && taskPayload.activity_date > today())
          setTab("upcoming");
        else if (mode === "self") setTab("today");
      }
      resetComposer();
      await load();
      if (!isMutationCurrent()) return;
    } catch (errorObject) {
      if (!isMutationCurrent()) return;
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not save task.",
      );
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not save task.",
      );
    } finally {
      if (isMutationCurrent()) setSaving(false);
    }
  }

  async function patchEntry(task: AdminRecord, data: AdminRecord) {
    const accessToken = token();
    const reportId = reportIdOf(task);
    const entryId = entryIdOf(task);
    if (!accessToken || !reportId || !entryId) {
      throw new Error(
        "This task is missing its report link. Refresh and try again.",
      );
    }
    await updateMyActivityEntry(accessToken, reportId, entryId, data);
  }

  function canEditTask(task: AdminRecord) {
    if (mode !== "self" || task.is_report_row) return false;
    const status = reportStatusOf(task);
    if (!status) return true;
    return isDraftReportStatus(status);
  }

  function canScheduleTask(task: AdminRecord) {
    if (task.is_report_row) return false;
    if (mode === "self") return canEditTask(task);
    if (
      !hasPermission(actor.permissionLabels, "work_activities:manager:review")
    )
      return false;
    const status = reportStatusOf(task);
    return !status || isDraftReportStatus(status);
  }

  function openScheduleTask(task: AdminRecord) {
    const start = plannedDateTimeOf(task, "start");
    const end = plannedDateTimeOf(task, "end");
    setScheduleTarget(task);
    setScheduleForm({
      date: reportDateOf(task) || taskDate(task) || today(),
      start: start ? timeFromMinutes(minutesOfDay(start)) : "09:00",
      end: end ? timeFromMinutes(minutesOfDay(end)) : "10:00",
    });
  }

  async function persistTimelinePosition(
    task: AdminRecord,
    date: string,
    startMinute: number,
    endMinute: number,
  ) {
    const accessToken = token();
    const entryId = entryIdOf(task);
    if (!accessToken || !entryId) {
      throw new Error(
        "This task is missing its activity link. Refresh and try again.",
      );
    }
    const plannedStart = localTaskDateTime(date, timeFromMinutes(startMinute));
    const plannedEnd = localTaskDateTime(date, timeFromMinutes(endMinute));
    if (
      !plannedStart ||
      !plannedEnd ||
      new Date(plannedEnd).getTime() <= new Date(plannedStart).getTime()
    ) {
      throw new Error("End time must be later than start time.");
    }
    const payload = {
      planned_start_time: plannedStart,
      planned_end_time: plannedEnd,
    };
    if (mode === "manager") {
      await updateManagerActivitySchedule(accessToken, entryId, payload);
    } else {
      await patchEntry(task, payload);
    }
  }

  async function saveSchedule() {
    if (!scheduleTarget || !canScheduleTask(scheduleTarget)) return;
    const start = localTaskDateTime(scheduleForm.date, scheduleForm.start);
    const end = localTaskDateTime(scheduleForm.date, scheduleForm.end);
    if (
      !start ||
      !end ||
      new Date(end).getTime() <= new Date(start).getTime()
    ) {
      toast.error("End time must be later than start time.");
      return;
    }
    setScheduleSaving(true);
    try {
      await persistTimelinePosition(
        scheduleTarget,
        scheduleForm.date,
        minutesOfDay(new Date(start)),
        minutesOfDay(new Date(end)),
      );
      toast.success("Task added to the timeline.");
      setScheduleTarget(null);
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not schedule the task.",
      );
    } finally {
      setScheduleSaving(false);
    }
  }

  function beginTimelineDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    task: AdminRecord,
    startMinute: number,
    endMinute: number,
  ) {
    if (!canScheduleTask(task)) return;
    const track = event.currentTarget.parentElement;
    if (!track) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const handle = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-timeline-resize]",
    );
    const mode =
      (handle?.dataset.timelineResize as TimelineDragMode | undefined) ??
      "move";
    const next: TimelineDrag = {
      key: entryIdOf(task) || rowId(task),
      task,
      mode,
      originX: event.clientX,
      trackWidth: track.getBoundingClientRect().width,
      originalStart: startMinute,
      originalEnd: endMinute,
      previewStart: startMinute,
      previewEnd: endMinute,
    };
    timelineMovedRef.current = false;
    timelineDragRef.current = next;
    setTimelineDrag(next);
  }

  function moveTimelineDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = timelineDragRef.current;
    if (!current || current.trackWidth <= 0) return;
    const delta =
      ((event.clientX - current.originX) / current.trackWidth) *
      timeline.totalMinutes;
    const snappedDelta = Math.round(delta / 15) * 15;
    const minimum = timeline.startHour * 60;
    const maximum = timeline.endHour * 60;
    const minDuration = 15;
    let previewStart = current.originalStart;
    let previewEnd = current.originalEnd;
    if (current.mode === "move") {
      const duration = current.originalEnd - current.originalStart;
      previewStart = Math.max(
        minimum,
        Math.min(maximum - duration, current.originalStart + snappedDelta),
      );
      previewEnd = previewStart + duration;
    } else if (current.mode === "resize-start") {
      previewStart = Math.max(
        minimum,
        Math.min(
          current.originalEnd - minDuration,
          current.originalStart + snappedDelta,
        ),
      );
    } else {
      previewEnd = Math.min(
        maximum,
        Math.max(
          current.originalStart + minDuration,
          current.originalEnd + snappedDelta,
        ),
      );
    }
    const next = { ...current, previewStart, previewEnd };
    if (
      previewStart !== current.originalStart ||
      previewEnd !== current.originalEnd
    )
      timelineMovedRef.current = true;
    timelineDragRef.current = next;
    setTimelineDrag(next);
  }

  async function endTimelineDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const current = timelineDragRef.current;
    if (!current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    timelineDragRef.current = null;
    setTimelineDrag(null);
    if (!timelineMovedRef.current) return;

    const entryId = entryIdOf(current.task);
    setTimelineSavingId(entryId);
    setTasks((items) =>
      items.map((item) =>
        entryIdOf(item) === entryId
          ? {
              ...item,
              planned_start_time: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewStart),
              ),
              planned_end_time: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewEnd),
              ),
              plannedStartTime: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewStart),
              ),
              plannedEndTime: localTaskDateTime(
                reportDateOf(item) || taskDate(item) || today(),
                timeFromMinutes(current.previewEnd),
              ),
            }
          : item,
      ),
    );
    try {
      await persistTimelinePosition(
        current.task,
        reportDateOf(current.task) || taskDate(current.task) || today(),
        current.previewStart,
        current.previewEnd,
      );
      toast.success(
        `${current.mode === "move" ? "Moved" : "Resized"} to ${timeFromMinutes(current.previewStart)}–${timeFromMinutes(current.previewEnd)}.`,
      );
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not move the task.",
      );
      await load();
    } finally {
      setTimelineSavingId(null);
    }
  }

  async function toggleRowComplete(
    task: AdminRecord,
    event?: { stopPropagation: () => void },
  ) {
    event?.stopPropagation();
    if (!canEditTask(task)) return;
    const entryId = entryIdOf(task);
    const next = taskStatus(task) === "COMPLETED" ? "PLANNED" : "COMPLETED";
    setUpdatingTaskId(entryId);
    try {
      await patchEntry(task, {
        status: next,
        completion_percentage: next === "COMPLETED" ? 100 : 0,
      });
      toast.success(
        next === "COMPLETED" ? "Task marked complete." : "Task reopened.",
      );
      await load();
      if (selected && entryIdOf(selected) === entryId) {
        setSelected((current) =>
          current ? { ...current, status: next } : current,
        );
        setTaskEditStatus(next);
      }
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update the task.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function toggleChecklistItem(itemId: string) {
    if (!selected || !canEditTask(selected)) return;
    const previousChecklist = asRecordArray(selected.checklist);
    const nextChecklist = previousChecklist.map((item) =>
      String(item.id ?? item.title) === itemId
        ? { ...item, completed: item.completed !== true }
        : item,
    );
    const changedItem = nextChecklist.find(
      (item) => String(item.id ?? item.title) === itemId,
    );
    setSelected((current) =>
      current ? { ...current, checklist: nextChecklist } : current,
    );
    setUpdatingChecklistId(itemId);
    try {
      await patchEntry(selected, { checklist: nextChecklist });
      toast.success(
        changedItem?.completed === true
          ? "Checklist item completed."
          : "Checklist item reopened.",
      );
      await load();
      await openTask({
        ...selected,
        checklist: nextChecklist,
        report_id: reportIdOf(selected),
      });
    } catch (errorObject) {
      setSelected((current) =>
        current ? { ...current, checklist: previousChecklist } : current,
      );
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update checklist.",
      );
    } finally {
      setUpdatingChecklistId(null);
    }
  }

  async function updateTaskStatus() {
    if (!selected || !canEditTask(selected)) return;
    try {
      await patchEntry(selected, {
        status: taskEditStatus,
        completion_percentage:
          taskEditStatus === "COMPLETED"
            ? 100
            : taskEditStatus === "IN_PROGRESS"
              ? 50
              : 0,
        outcome: taskOutcome.trim() || undefined,
      });
      toast.success("Progress saved.");
      setSelected((current) =>
        current
          ? {
              ...current,
              status: taskEditStatus,
              outcome: taskOutcome.trim() || current.outcome,
            }
          : current,
      );
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update task.",
      );
    }
  }

  async function addComment() {
    const accessToken = token();
    const entryId = entryIdOf(selected);
    if (!accessToken || !entryId || !comment.trim()) return;
    setCommenting(true);
    try {
      if (mode === "manager")
        await addManagerActivityComment(accessToken, entryId, comment.trim());
      else await addMyActivityComment(accessToken, entryId, comment.trim());
      setComment("");
      toast.success("Comment added.");
      if (selected) await openTask(selected);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not add comment.",
      );
    } finally {
      setCommenting(false);
    }
  }

  function workItemsForReport(report: AdminRecord) {
    const reportId = reportIdOf(report) || rowId(report);
    const entries = asRecordArray(
      report.entries ?? report.items ?? report.activities,
    );
    const fromTasks = tasks.filter((task) => reportIdOf(task) === reportId);
    return entries.length ? entries : fromTasks;
  }

  function openReportPreview(report: AdminRecord) {
    const work = workItemsForReport(report);
    const dayToClose = reportDateOf(report) || today();
    if (work.length === 0) {
      openAddWorkForDay(dayToClose, "close");
      return;
    }
    setPreviewSummary("");
    setPreviewEntryIds(defaultCloseEntryIds(work));
    setPreviewReport({ ...report, entries: work });
  }

  async function submitReport(report: AdminRecord) {
    const accessToken = token();
    const reportId = reportIdOf(report) || rowId(report);
    const work = asRecordArray(report.entries);
    const selected = work.filter((entry) =>
      previewEntryIds.includes(entryIdOf(entry) || rowId(entry)),
    );
    const dayToClose = reportDateOf(report);
    const issues = closeReportIssues({
      report,
      day: dayToClose,
      entryCount: selected.length,
      completedCount: selected.filter(
        (entry) => taskStatus(entry) === "COMPLETED",
      ).length,
      summary: previewSummary,
    });
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }
    if (!accessToken || !reportId) return;
    setSubmitting(true);
    try {
      await submitMyActivityReport(accessToken, reportId, {
        employee_summary: previewSummary.trim(),
        client_request_id: newRequestId(),
        entry_ids: selected
          .map((entry) => Number(entryIdOf(entry) || rowId(entry)))
          .filter((id) => Number.isFinite(id)),
      });
      const keptOpen = work.length - selected.length;
      toast.success(
        keptOpen > 0
          ? `Closed ${formatDate(dayToClose)}. ${keptOpen} item${keptOpen === 1 ? "" : "s"} kept open.`
          : `Closed ${formatDate(dayToClose)}.`,
      );
      clearSelected();
      setPreviewReport(null);
      setTab(dayToClose === today() ? "today" : "history");
      await load();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not close this day.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeOnScreenDay() {
    if (!todayReport || workItemsForReport(todayReport).length === 0) {
      openAddWorkForDay(today(), "close");
      return;
    }
    if (!canCloseReport(todayReport)) {
      toast.error("Today is already closed.");
      return;
    }
    openReportPreview(todayReport);
  }

  const assignedBy = (task: AdminRecord) => {
    if (isManagerAssigned(task)) {
      return personName(
        task.assignedBySnapshot ?? task.assigned_by_snapshot,
        "Manager",
      );
    }
    return "You";
  };

  const photoForAssignee = (task: AdminRecord, who: string) => {
    if (who === "You") return resolveBackendMediaUrl(myPhotoUrl) || myPhotoUrl;
    if (mode === "manager") {
      return (
        photoFromRecord(task.employee) ||
        photoFromRecord(task.employeeSnapshot ?? task.employee_snapshot)
      );
    }
    return photoFromRecord(
      task.assignedBySnapshot ?? task.assigned_by_snapshot,
    );
  };

  const assignedCount = tasks.filter((task) =>
    isManagerAssignedActivity(task, myEmployeeId),
  ).length;
  const tabs: Array<{
    value: ListTab;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> =
    mode === "self"
      ? [
          {
            value: "today",
            label: "Today",
            count: groupedTasks.today.length,
            icon: <CalendarDaysIcon className="size-3.5" />,
          },
          {
            value: "tasks",
            label: "All work",
            count: tasks.length,
            icon: <ClipboardListIcon className="size-3.5" />,
          },
          {
            value: "assigned",
            label: "Assigned to me",
            count: assignedCount,
            icon: <InboxIcon className="size-3.5" />,
          },
          {
            value: "upcoming",
            label: "Upcoming",
            count: groupedTasks.upcoming.length,
            icon: <Clock3Icon className="size-3.5" />,
          },
          {
            value: "history",
            label: "History",
            count: historyReports.length,
            icon: <HistoryIcon className="size-3.5" />,
          },
        ]
      : [
          {
            value: "tasks",
            label: "Team work",
            count: tasks.length,
            icon: <ClipboardListIcon className="size-3.5" />,
          },
        ];

  const todayCompleted = groupedTasks.today.filter(
    (task) => taskStatus(task) === "COMPLETED",
  ).length;
  const todayStatus =
    reportStatusOf(todayReport) || (groupedTasks.today.length ? "DRAFT" : "");
  const showTaskFilters = tab !== "history";
  const todayClosed = Boolean(todayReport) && !canCloseReport(todayReport);
  const currentMinute = minutesOfDay(new Date());
  const currentTimeLeft =
    ((currentMinute - timeline.startHour * 60) / timeline.totalMinutes) * 100;
  const showCurrentTime =
    tab === "today" && currentTimeLeft >= 0 && currentTimeLeft <= 100;

  const heroDescription =
    mode === "manager"
      ? "Work you assigned to your team. Their personal daily items stay in My activities."
      : tab === "upcoming"
        ? "Work filed on a later day. It will not be included when you close today."
        : tab === "assigned"
          ? "Work a manager assigned to you. Close it with the day it belongs to."
          : tab === "history"
            ? "Past days. Open a returned day to close it — this never submits a different date."
            : todayReport
              ? `${formatDate(day)} · ${statusLabel[todayStatus] ?? todayStatus} · ${todayCompleted} of ${groupedTasks.today.length} completed`
              : `${formatDate(day)} · nothing on today's report yet`;

  if (loading && !createOpen)
    return (
      <section aria-busy="true" className="flex flex-col gap-3">
        <FluentLoadingIndicator />
        <p role="status">
          Loading this workflow and checking its available actions…
        </p>
      </section>
    );

  if (error && !loading && !createOpen)
    return (
      <section className="flex flex-col gap-4">
        <WorkflowGuide
          title="This workflow needs attention"
          unavailable={error}
          steps={[
            "Resolve the permission, setup, or network issue described above.",
            "Reload this view before continuing.",
          ]}
        />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => void load()}
        >
          Reload workflow
        </button>
      </section>
    );

  return (
    <section className="min-w-0 space-y-5">
      <WorkflowGuide
        title="Plan and complete your work"
        steps={[
          "Create a task with its day, times, assignees, and optional checklist.",
          "Update progress and checklist items as you work.",
          "Record the outcome when completing a task.",
          "Review your daily summary before closing the day.",
        ]}
        unavailable={error}
      />
      <header className="flex flex-col gap-3 border-b border-border px-1 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === "manager" ? "Team activities" : "My activities"}
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {heroDescription}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {mode === "self" ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-primary"
                    aria-label="Activity guidance"
                  />
                }
              >
                <Info20Regular className="size-5" />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                className="max-w-[min(22rem,calc(100vw-2rem))] whitespace-normal text-left leading-5"
              >
                Record daily work here. You can link related work to an approved
                KPI when useful, then close the day when your report is ready
                for review.
              </TooltipContent>
            </Tooltip>
          ) : null}
          {mode === "self" && tab === "today" ? (
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => void closeOnScreenDay()}
              disabled={submitting || todayClosed}
            >
              {submitting ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <FileTextIcon className="size-4" />
              )}
              {todayClosed ? "Today closed" : "Close today"}
            </button>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void load()}
          >
            <FluentLoadingIndicator
              className={loading ? "size-4 animate-spin" : "hidden"}
            />
            <CircleDotIcon className={loading ? "hidden" : "size-4"} /> Refresh
          </button>
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-border">
            {tabs.map(({ value, label, count, icon }) => {
              const active = tab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "group relative inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center justify-center">
                    {icon}
                  </span>
                  <span>{label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {tab !== "history" ? (
            <div className="flex shrink-0 items-center rounded-lg border border-border bg-muted/50 p-1">
              {(["timeline", "board", "list"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setWorkspaceView(view)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold capitalize transition",
                    workspaceView === view
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {view === "timeline" ? (
                    <Clock3Icon className="size-3.5" />
                  ) : view === "board" ? (
                    <Columns3Icon className="size-3.5" />
                  ) : (
                    <ListIcon className="size-3.5" />
                  )}
                  {view}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          <FluentInput
            className="min-w-44 flex-1 xl:w-56 xl:flex-none"
            contentBefore={<SearchIcon className="size-4" aria-hidden="true" />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={
              tab === "history" ? "Search days..." : "Search work..."
            }
            aria-label={
              tab === "history" ? "Search activity history" : "Search work"
            }
          />
          {showTaskFilters ? (
            <Popover>
              <PopoverTrigger className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition hover:border-primary/30 hover:text-primary">
                <SlidersHorizontalIcon className="size-3.5" />
                Filters
                {[priorityFilter, statusFilter, reviewFilter].filter(
                  (value) => value !== "ALL",
                ).length ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {
                      [priorityFilter, statusFilter, reviewFilter].filter(
                        (value) => value !== "ALL",
                      ).length
                    }
                  </span>
                ) : null}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3 p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Filter work
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Narrow the board without hiding these controls.
                  </p>
                </div>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Priority
                  <FluentSelect
                    ariaLabel="Priority"
                    className="w-full"
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={[
                      { value: "ALL", label: "All priorities" },
                      { value: "URGENT", label: "Urgent" },
                      { value: "HIGH", label: "High" },
                      { value: "MEDIUM", label: "Medium" },
                      { value: "LOW", label: "Low" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Status
                  <FluentSelect
                    ariaLabel="Status"
                    className="w-full"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All statuses" },
                      { value: "PLANNED", label: "Not started" },
                      { value: "IN_PROGRESS", label: "In progress" },
                      { value: "COMPLETED", label: "Completed" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Review status
                  <FluentSelect
                    ariaLabel="Review status"
                    className="w-full"
                    value={reviewFilter}
                    onChange={setReviewFilter}
                    options={[
                      { value: "ALL", label: "All review statuses" },
                      { value: "NOT_REQUIRED", label: "No review" },
                      { value: "PENDING", label: "Pending" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "RETURNED", label: "Returned" },
                      { value: "REJECTED", label: "Rejected" },
                    ]}
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-8 w-full items-center justify-center rounded-md border border-border text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    setPriorityFilter("ALL");
                    setStatusFilter("ALL");
                    setReviewFilter("ALL");
                  }}
                >
                  Clear filters
                </button>
              </PopoverContent>
            </Popover>
          ) : null}
          {tab !== "history" ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setAudience(mode === "manager" ? "employee" : "self");
                setForm({
                  activity_date: defaultCreateDate(),
                  start_time: "09:00",
                  end_time: "10:00",
                  priority: "MEDIUM",
                  performance_relevance: "NOT_EVALUATED",
                  activity_category_id: "",
                });
                setChecklistDraft("");
                setChecklistItems([]);
                setCreateOpen(true);
              }}
            >
              <PlusIcon className="size-4" />{" "}
              {mode === "self" ? "Add work" : "Create task"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {tab !== "history" && workspaceView === "timeline" ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border bg-gradient-to-r from-muted/50 via-card to-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Clock3Icon className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Work timeline
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Drag a block to move it. Resize either edge in 15-minute
                  steps; the assigned time updates automatically.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {timeline.unscheduled.length ? (
                <Popover
                  open={unscheduledOpen}
                  onOpenChange={setUnscheduledOpen}
                >
                  <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[11px] font-semibold text-foreground shadow-xs transition hover:border-primary/35 hover:text-primary">
                    <PlusIcon className="size-3.5" /> Add unscheduled
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {timeline.unscheduled.length}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 p-0">
                    <div className="border-b border-border px-3 py-2.5">
                      <p className="text-sm font-semibold text-foreground">
                        Unscheduled work
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Choose a task, then set its time.
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1.5">
                      {timeline.unscheduled.map(({ task }, index) => {
                        const editable = canScheduleTask(task);
                        return (
                          <div
                            key={entryIdOf(task) || rowId(task) || index}
                            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/60"
                          >
                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <ClipboardListIcon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-foreground">
                                {readString(task, ["title"], "Untitled task")}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                {formatDate(
                                  reportDateOf(task) || taskDate(task),
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={!editable}
                              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2 text-[10px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                              onClick={() => {
                                setUnscheduledOpen(false);
                                openScheduleTask(task);
                              }}
                              title={
                                editable
                                  ? "Add to timeline"
                                  : "This task can no longer be rescheduled"
                              }
                            >
                              <PlusIcon className="size-3" /> Add
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}
              <span className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-xs">
                <span className="size-1.5 rounded-full bg-primary" />{" "}
                {timeline.rows.length} scheduled
              </span>
            </div>
          </div>
          <div className="overflow-x-auto p-3 sm:p-4">
            <div className="min-w-[860px] overflow-hidden rounded-xl border border-border/80 bg-background">
              <div className="grid grid-cols-[200px_minmax(640px,1fr)] border-b border-border bg-muted/35">
                <div className="flex items-center px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Work item
                </div>
                <div
                  className="relative h-12 border-l border-border/80 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)]"
                  style={{
                    backgroundSize: `${100 / Math.max(1, timeline.endHour - timeline.startHour)}% 100%`,
                  }}
                >
                  {timeline.hours.map((hour) => {
                    const left =
                      (((hour - timeline.startHour) * 60) /
                        timeline.totalMinutes) *
                      100;
                    return (
                      <span
                        key={hour}
                        className="absolute inset-y-0 flex items-center text-[10px] font-semibold tabular-nums text-muted-foreground"
                        style={{
                          left: `${left}%`,
                          transform:
                            hour === timeline.startHour
                              ? "translateX(8px)"
                              : hour === timeline.endHour
                                ? "translateX(-100%)"
                                : "translateX(-50%)",
                        }}
                      >
                        {new Date(2000, 0, 1, hour).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-border" />
                      </span>
                    );
                  })}
                  {showCurrentTime ? (
                    <span
                      className="absolute inset-y-0 z-10 w-0.5 bg-primary/70 shadow-[0_0_8px_rgba(37,99,235,0.28)]"
                      style={{ left: `${currentTimeLeft}%` }}
                    >
                      <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                        Now
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              {timeline.rows.map(({ task, start, end }, index) => {
                const key = entryIdOf(task) || rowId(task) || String(index);
                const activeDrag =
                  timelineDrag?.key === key ? timelineDrag : null;
                const startMinute =
                  activeDrag?.previewStart ?? minutesOfDay(start);
                const endMinute =
                  activeDrag?.previewEnd ??
                  Math.max(startMinute + 15, minutesOfDay(end));
                const left = Math.max(
                  0,
                  Math.min(
                    100,
                    ((startMinute - timeline.startHour * 60) /
                      timeline.totalMinutes) *
                      100,
                  ),
                );
                const width = Math.max(
                  3,
                  Math.min(
                    100 - left,
                    ((endMinute - startMinute) / timeline.totalMinutes) * 100,
                  ),
                );
                const who =
                  mode === "manager"
                    ? personName(task.employee)
                    : assignedBy(task);
                const priority = taskPriority(task);
                const isComplete = ["COMPLETED", "APPROVED", "CLOSED"].includes(
                  taskStatus(task),
                );
                const blockTone = isComplete
                  ? "border-emerald-400/70 bg-gradient-to-r from-emerald-100 to-emerald-50 text-emerald-950 dark:from-emerald-950/70 dark:to-emerald-900/30 dark:text-emerald-100"
                  : priority === "URGENT" || priority === "HIGH"
                    ? "border-rose-400/70 bg-gradient-to-r from-rose-100 to-rose-50 text-rose-950 dark:from-rose-950/70 dark:to-rose-900/30 dark:text-rose-100"
                    : priority === "MEDIUM"
                      ? "border-sky-400/70 bg-gradient-to-r from-sky-100 to-sky-50 text-sky-950 dark:from-sky-950/70 dark:to-sky-900/30 dark:text-sky-100"
                      : "border-violet-400/70 bg-gradient-to-r from-violet-100 to-violet-50 text-violet-950 dark:from-violet-950/70 dark:to-violet-900/30 dark:text-violet-100";
                const editable = canScheduleTask(task);
                const savingPosition = timelineSavingId === entryIdOf(task);
                return (
                  <div
                    key={key}
                    className="group/row grid min-h-[84px] grid-cols-[200px_minmax(640px,1fr)] border-b border-border/70 last:border-b-0"
                  >
                    <button
                      type="button"
                      className="group min-w-0 border-r border-border/60 px-4 py-3 text-left transition hover:bg-primary/[0.035]"
                      onClick={() => void openTask(task)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            priority === "URGENT" || priority === "HIGH"
                              ? "bg-rose-500"
                              : priority === "MEDIUM"
                                ? "bg-amber-400"
                                : "bg-emerald-500",
                          )}
                        />
                        <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                          {readString(task, ["title"], "Untitled task")}
                        </span>
                      </span>
                      <span className="mt-1.5 block truncate pl-4 text-[10px] text-muted-foreground">
                        {who} ·{" "}
                        {statusLabel[taskStatus(task)] ?? taskStatus(task)}
                      </span>
                    </button>
                    <div
                      className="relative border-l border-border/80 bg-muted/15 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px)] group-hover/row:bg-muted/30"
                      style={{
                        backgroundSize: `${100 / Math.max(1, timeline.endHour - timeline.startHour)}% 100%`,
                      }}
                    >
                      {showCurrentTime ? (
                        <span
                          className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-primary/35"
                          style={{ left: `${currentTimeLeft}%` }}
                        />
                      ) : null}
                      <button
                        type="button"
                        className={cn(
                          "group absolute top-4 flex h-12 min-w-20 touch-none items-center gap-2 overflow-hidden rounded-xl border px-3 text-left shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md",
                          blockTone,
                          editable
                            ? activeDrag?.mode === "resize-start" ||
                              activeDrag?.mode === "resize-end"
                              ? "cursor-ew-resize"
                              : "cursor-grab active:cursor-grabbing"
                            : "cursor-pointer",
                          activeDrag &&
                            "z-10 border-primary bg-primary/20 shadow-lg ring-2 ring-primary/20",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onPointerDown={(event) =>
                          beginTimelineDrag(event, task, startMinute, endMinute)
                        }
                        onPointerMove={moveTimelineDrag}
                        onPointerUp={(event) => void endTimelineDrag(event)}
                        onPointerCancel={() => {
                          timelineDragRef.current = null;
                          setTimelineDrag(null);
                        }}
                        onClick={(event) => {
                          if (timelineMovedRef.current) {
                            event.preventDefault();
                            timelineMovedRef.current = false;
                            return;
                          }
                          void openTask(task);
                        }}
                        title={
                          editable
                            ? "Drag to change the scheduled time"
                            : "Open task"
                        }
                      >
                        {editable ? (
                          <>
                            <span
                              data-timeline-resize="resize-start"
                              aria-label="Resize task start"
                              title="Drag to change start time"
                              className="absolute inset-y-0 left-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-primary/15 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                            >
                              <span className="h-4 w-0.5 rounded-full bg-primary/70" />
                            </span>
                            <span
                              data-timeline-resize="resize-end"
                              aria-label="Resize task end"
                              title="Drag to change end time"
                              className="absolute inset-y-0 right-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-primary/15 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
                            >
                              <span className="h-4 w-0.5 rounded-full bg-primary/70" />
                            </span>
                          </>
                        ) : null}
                        <span
                          className={cn(
                            "h-6 w-1 shrink-0 rounded-full",
                            priority === "URGENT" || priority === "HIGH"
                              ? "bg-rose-500"
                              : priority === "MEDIUM"
                                ? "bg-amber-500"
                                : "bg-primary",
                          )}
                        />
                        {editable ? (
                          <GripVerticalIcon className="size-3.5 shrink-0 opacity-55" />
                        ) : null}
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {readString(task, ["title"], "Untitled task")}
                          </span>
                          <span className="block truncate text-[10px] font-medium text-foreground/65">
                            {savingPosition
                              ? "Saving…"
                              : `${timeFromMinutes(startMinute)} – ${timeFromMinutes(endMinute)}`}
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {!loading && timeline.rows.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center">
                  <Clock3Icon className="size-7 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">
                    No scheduled work in this view
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Add a task with a start and end time to place it on the
                    timeline.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : tab !== "history" && workspaceView === "board" ? (
        <section className="space-y-4">
          <div className="w-full">
            <div className="grid w-full grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {boardColumns.map((column) => {
                const theme = {
                  todo: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Ready to begin",
                    iconNode: <ListIcon className="size-4" />,
                  },
                  progress: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Moving forward",
                    iconNode: <Clock3Icon className="size-4" />,
                  },
                  review: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Needs attention",
                    iconNode: <MessageSquareIcon className="size-4" />,
                  },
                  complete: {
                    rail: "bg-border",
                    icon: "bg-muted text-muted-foreground",
                    shell: "from-muted/20",
                    subtitle: "Finished work",
                    iconNode: <CheckCircle2Icon className="size-4" />,
                  },
                }[column.id] ?? {
                  rail: "bg-border",
                  icon: "bg-muted text-muted-foreground",
                  shell: "from-muted/20",
                  subtitle: "Work items",
                  iconNode: <CircleDotIcon className="size-4" />,
                };
                const share = visibleRows.length
                  ? Math.round((column.rows.length / visibleRows.length) * 100)
                  : 0;
                return (
                  <section
                    key={column.id}
                    className={cn(
                      "min-w-0 overflow-hidden rounded-2xl border border-border bg-gradient-to-b to-card",
                      theme.shell,
                    )}
                  >
                    <header className="border-b border-border/70 px-3.5 pb-3 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              "inline-flex size-8 shrink-0 items-center justify-center rounded-xl",
                              theme.icon,
                            )}
                          >
                            {theme.iconNode}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {column.label}
                            </h3>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {theme.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-bold tabular-nums text-foreground">
                          {column.rows.length}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground"
                            aria-label={`${column.label} column actions`}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-40">
                            <DropdownMenuItem
                              onClick={() => {
                                setStatusFilter(
                                  column.id === "progress"
                                    ? "IN_PROGRESS"
                                    : column.id === "complete"
                                      ? "COMPLETED"
                                      : column.id === "todo"
                                        ? "PLANNED"
                                        : "ALL",
                                );
                                setReviewFilter(
                                  column.id === "review" ? "PENDING" : "ALL",
                                );
                              }}
                            >
                              <SparklesIcon className="size-3.5" /> Show only
                              this column
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setStatusFilter("ALL");
                                setReviewFilter("ALL");
                              }}
                            >
                              <Columns3Icon className="size-3.5" /> Show all
                              columns
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-background/80">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            theme.rail,
                          )}
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </header>
                    <div className="min-h-64 space-y-3 p-3">
                      {column.rows.map((task) => {
                        const status = taskStatus(task);
                        const priority = taskPriority(task);
                        const due = dueMeta(
                          plannedDueDateOf(task) || taskDate(task),
                        );
                        const assigned = isManagerAssigned(task);
                        const who =
                          mode === "manager"
                            ? personName(task.employee)
                            : assignedBy(task);
                        const progress = checklistProgress(task);
                        const editable = canEditTask(task);
                        const scheduled = Boolean(
                          plannedDateTimeOf(task, "start") &&
                          plannedDateTimeOf(task, "end"),
                        );
                        const taskKey =
                          entryIdOf(task) ||
                          reportIdOf(task) ||
                          `${readString(task, ["title"])}-${String(taskDate(task))}`;
                        const priorityStyle =
                          "border-border bg-muted/60 text-muted-foreground";
                        return (
                          <article
                            key={taskKey}
                            className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors duration-200 hover:border-border/80"
                          >
                            <div className="flex items-center justify-between gap-2 pl-3.5 pr-2.5 pt-2.5">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold capitalize",
                                  priorityStyle,
                                )}
                              >
                                {priority.toLowerCase()}
                              </span>
                              <div className="flex items-center gap-1">
                                <span className="inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-medium leading-4 text-muted-foreground">
                                  {statusLabel[status] ??
                                    status.replaceAll("_", " ")}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                                    aria-label="Task actions"
                                  >
                                    <MoreHorizontalIcon className="size-4" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="min-w-40"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => void openTask(task)}
                                    >
                                      <FileTextIcon className="size-3.5" /> View
                                      details
                                    </DropdownMenuItem>
                                    {!scheduled ? (
                                      <DropdownMenuItem
                                        disabled={!canScheduleTask(task)}
                                        onClick={() => openScheduleTask(task)}
                                      >
                                        <Clock3Icon className="size-3.5" /> Add
                                        to timeline
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuItem
                                      disabled={
                                        !editable ||
                                        updatingTaskId === entryIdOf(task)
                                      }
                                      onClick={(event) =>
                                        void toggleRowComplete(task, event)
                                      }
                                    >
                                      <CheckCircle2Icon className="size-3.5" />
                                      {status === "COMPLETED"
                                        ? "Reopen task"
                                        : "Mark complete"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="block w-full px-3.5 pb-3 pt-2 text-left"
                              onClick={() => void openTask(task)}
                            >
                              <h4 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-primary">
                                {readString(task, ["title"], "Untitled task")}
                              </h4>
                              <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
                                {readString(
                                  task,
                                  [
                                    "description",
                                    "expectedResult",
                                    "expected_result",
                                  ],
                                  "No additional instructions.",
                                )}
                              </p>
                              {progress ? (
                                <div className="mt-3">
                                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                                    <span className="font-medium text-muted-foreground">
                                      Checklist
                                    </span>
                                    <span className="font-semibold tabular-nums text-foreground">
                                      {progress.label}
                                    </span>
                                  </div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-foreground/50 transition-all"
                                      style={{
                                        width: `${(progress.done / progress.total) * 100}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </button>
                            <footer className="flex items-center justify-between gap-2 border-t border-border/70 bg-muted/20 px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-2">
                                <Avatar
                                  name={who}
                                  photoUrl={photoForAssignee(task, who)}
                                  className="size-7 text-[9px] ring-2 ring-background"
                                />
                                <span className="truncate text-[10px] font-medium text-muted-foreground">
                                  {assigned
                                    ? mode === "manager"
                                      ? "Assigned to"
                                      : "Assigned by"
                                    : "My work"}{" "}
                                  · {who}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                                  <CalendarDaysIcon className="size-3" />
                                  {due.label}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-background text-primary transition hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50"
                                  aria-label={
                                    status === "COMPLETED"
                                      ? "Mark not started"
                                      : "Mark complete"
                                  }
                                  disabled={
                                    !editable ||
                                    updatingTaskId === entryIdOf(task)
                                  }
                                  onClick={(event) =>
                                    void toggleRowComplete(task, event)
                                  }
                                >
                                  {updatingTaskId === entryIdOf(task) ? (
                                    <FluentLoadingIndicator className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2Icon className="size-3.5" />
                                  )}
                                </button>
                              </div>
                            </footer>
                          </article>
                        );
                      })}
                      {!loading && column.rows.length === 0 ? (
                        <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/65 px-4 text-center">
                          <span
                            className={cn(
                              "inline-flex size-9 items-center justify-center rounded-xl",
                              theme.icon,
                            )}
                          >
                            {theme.iconNode}
                          </span>
                          <p className="mt-3 text-xs font-semibold text-foreground">
                            Nothing here yet
                          </p>
                          <p className="mt-1 max-w-40 text-[10px] leading-4 text-muted-foreground">
                            {column.id === "todo"
                              ? "New work will appear here when it is ready to start."
                              : column.id === "progress"
                                ? "Work moves here once someone starts it."
                                : column.id === "review"
                                  ? "Completed work waiting for review appears here."
                                  : "Finished work will collect here."}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-border dark:bg-card">
          {tab === "history" ? (
            <div className="hidden grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.4fr)_88px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid">
              <span>Date</span>
              <span>Work on that day</span>
              <span>Work / review</span>
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
              <FluentLoadingIndicator className="size-4 animate-spin" /> Loading
              activities...
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <ClipboardListIcon className="size-8 text-muted-foreground/60" />
              <p className="font-medium">
                {tab === "history"
                  ? "No past days yet"
                  : tab === "upcoming"
                    ? "No upcoming work"
                    : tab === "assigned"
                      ? "Nothing assigned to you"
                      : "Nothing on today's report"}
              </p>
              <p className="text-sm text-muted-foreground">
                {tab === "history"
                  ? "Closed and unclosed previous days will show up here."
                  : tab === "upcoming"
                    ? "Add work for a later date if it should not go into today's close-out."
                    : tab === "assigned"
                      ? "When a manager assigns you work, it will show up here."
                      : mode === "manager"
                        ? "Assign work to your team to see it here. Personal daily work stays in My activities."
                        : tab === "today"
                          ? "Select Add work to record today’s activity. When your report is ready, select Close today to send it for review."
                          : "Add work for today, or wait for a manager to assign something."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleRows.map((task) => {
                if (tab === "history") {
                  const entries = asRecordArray(task.entries);
                  const dated = reportDateOf(task);
                  return (
                    <button
                      type="button"
                      key={reportIdOf(task) || dated}
                      className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 lg:grid-cols-[minmax(120px,0.7fr)_minmax(180px,1.4fr)_88px]"
                      onClick={() => void openTask(task)}
                    >
                      <span className="font-medium text-slate-900">
                        {formatDate(dated)}
                      </span>
                      <span className="text-sm text-slate-600">
                        {entries.length
                          ? `${entries.length} work item${entries.length === 1 ? "" : "s"}`
                          : "No work items"}
                        {canCloseReport(task) ? " · still open" : ""}
                      </span>
                      <span className="hidden lg:block">
                        <StatusPill value={reportStatusOf(task) || "DRAFT"} />
                      </span>
                    </button>
                  );
                }
                const status = taskStatus(task);
                const priority = taskPriority(task);
                const due = dueMeta(plannedDueDateOf(task) || taskDate(task));
                const start = plannedStartDateOf(task);
                const assigned = isManagerAssigned(task);
                const who =
                  mode === "manager"
                    ? personName(task.employee)
                    : assignedBy(task);
                const progress = checklistProgress(task);
                const editable = canEditTask(task);
                return (
                  <div
                    key={
                      entryIdOf(task) ||
                      reportIdOf(task) ||
                      `${readString(task, ["title"])}-${String(taskDate(task))}`
                    }
                    className="grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 lg:grid-cols-[28px_minmax(160px,1.5fr)_minmax(120px,0.8fr)_88px_88px_72px_88px]"
                  >
                    <button
                      type="button"
                      className="flex size-4 items-center justify-center rounded border border-slate-300 text-primary"
                      aria-label={
                        status === "COMPLETED"
                          ? "Mark not started"
                          : "Mark complete"
                      }
                      disabled={!editable || updatingTaskId === entryIdOf(task)}
                      onClick={(event) => void toggleRowComplete(task, event)}
                    >
                      {updatingTaskId === entryIdOf(task) ? (
                        <FluentLoadingIndicator className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2Icon
                          className={
                            status === "COMPLETED" ? "size-3" : "hidden"
                          }
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => void openTask(task)}
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {readString(task, ["title"], "Untitled task")}
                        </span>
                        {assigned ? (
                          <span className="rounded-full bg-sky-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-700">
                            Assigned
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                            My work
                          </span>
                        )}
                        {progress ? (
                          <span className="text-[10px] text-slate-500">
                            {progress.label}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500 lg:hidden">
                        {who} · {due.label}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="hidden min-w-0 items-center gap-1.5 truncate text-xs text-slate-600 lg:flex"
                      onClick={() => void openTask(task)}
                    >
                      <Avatar
                        name={who}
                        photoUrl={photoForAssignee(task, who)}
                        className="size-6 text-[10px]"
                      />
                      <span className="min-w-0 truncate">{who}</span>
                    </button>
                    <button
                      type="button"
                      className="hidden text-left text-xs text-slate-700 lg:block"
                      onClick={() => void openTask(task)}
                    >
                      {start ? formatDate(start) : ""}
                    </button>
                    <button
                      type="button"
                      className="hidden text-left text-xs lg:block"
                      onClick={() => void openTask(task)}
                    >
                      <span className="block text-slate-700">
                        {plannedDueDateOf(task)
                          ? formatDate(plannedDueDateOf(task))
                          : ""}
                      </span>
                      {plannedDueDateOf(task) ? (
                        <span
                          className={cn(
                            "text-[10px]",
                            due.tone === "danger"
                              ? "text-rose-600"
                              : due.tone === "warn"
                                ? "text-amber-600"
                                : "text-slate-500",
                          )}
                        >
                          {due.label}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="hidden items-center gap-1 text-xs text-slate-700 lg:flex"
                      onClick={() => void openTask(task)}
                    >
                      <PriorityDot priority={priority} />{" "}
                      {priority.charAt(0) + priority.slice(1).toLowerCase()}
                    </button>
                    <button
                      type="button"
                      className="hidden lg:block"
                      onClick={() => void openTask(task)}
                    >
                      <span className="flex flex-col items-start gap-1">
                        <StatusPill value={status} />
                        {taskReviewStatus(task) !== "NOT_REQUIRED" ? (
                          <StatusPill value={taskReviewStatus(task)} />
                        ) : null}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {scheduleTarget ? (
        <Dialog
          open={Boolean(scheduleTarget)}
          onOpenChange={(open) => !open && setScheduleTarget(null)}
        >
          <DialogPopup
            from="bottom"
            className="max-w-md overflow-hidden p-0"
            showCloseButton
          >
            <DialogHeader className="mb-0 border-b border-border px-4 pb-3 pt-4 sm:px-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                Timeline
              </p>
              <DialogTitle className="pr-8 text-lg">
                Schedule this task
              </DialogTitle>
              <DialogDescription className="line-clamp-2">
                {readString(scheduleTarget, ["title"], "Untitled task")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/35 px-3 py-2.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDaysIcon className="size-4" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Work day
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDate(scheduleForm.date)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
                  Starts at
                  <TimeClockPicker
                    value={scheduleForm.start}
                    onChange={(value) =>
                      setScheduleForm((current) => ({
                        ...current,
                        start: value,
                      }))
                    }
                    placeholder="Start time"
                    aria-label="Timeline start time"
                    className="h-10 rounded-lg px-3 text-sm"
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-xs font-medium text-foreground">
                  Ends at
                  <TimeClockPicker
                    value={scheduleForm.end}
                    onChange={(value) =>
                      setScheduleForm((current) => ({ ...current, end: value }))
                    }
                    placeholder="End time"
                    aria-label="Timeline end time"
                    className="h-10 rounded-lg px-3 text-sm"
                  />
                </label>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                After adding it, drag the task bar left or right to adjust the
                time in 15-minute steps.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                className={`${secondaryButtonClass} w-full justify-center sm:w-auto`}
                onClick={() => setScheduleTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${primaryButtonClass} w-full justify-center sm:w-auto`}
                onClick={() => void saveSchedule()}
                disabled={scheduleSaving}
              >
                {scheduleSaving ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <Clock3Icon className="size-4" />
                )}
                Add to timeline
              </button>
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}

      {createOpen ? (
        <Dialog
          open={createOpen}
          onOpenChange={(next) => {
            if (!saving) setCreateOpen(next);
          }}
        >
          <DialogPopup
            from="bottom"
            className="flex max-h-[min(94dvh,52rem)] max-w-2xl flex-col overflow-hidden p-0"
            showCloseButton
          >
            <DialogHeader className="mb-0 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                {mode === "self" ? "Add work" : "Create task"}
              </p>
              <DialogTitle className="pr-8 text-lg sm:text-xl">
                {audience === "employee"
                  ? "Assign planned work"
                  : mode === "self"
                    ? "Add work to a day"
                    : "Create a task"}
              </DialogTitle>
              <DialogDescription>
                {addWorkReason === "close"
                  ? `Add at least one work item for ${formatDate(form.activity_date || today())}, then you can close that day.`
                  : mode === "self"
                    ? "Set the work day and time range so it appears correctly on your timeline."
                    : "Assign the task, its time window, and checklist to one or several people."}
              </DialogDescription>
            </DialogHeader>
            <ValidatedWorkflowForm
              key={audience}
              saving={saving}
              submitError={formError}
              onSubmit={saveTask}
              validation={{
                schema: activityTaskSchema,
                input: { ...form, audience, employeeIds, checklistItems },
              }}
              description="Describe the work, choose its schedule and assignees, then review before creating the task."
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {audience === "employee" ? (
                    <div className="grid gap-1.5 text-sm sm:col-span-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Assign to</span>
                        <span className="text-xs text-slate-500">
                          {employeeIds.length
                            ? `${employeeIds.length} of ${team.length} selected`
                            : `Select one, several, or all ${team.length} people`}
                        </span>
                      </div>
                      {!canAssign ? (
                        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          No employees in your reporting scope
                        </p>
                      ) : (
                        <div className="overflow-hidden rounded-md border border-slate-300">
                          <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1.5">
                            <SearchIcon className="size-4 shrink-0 text-slate-400" />
                            <input
                              className="min-w-28 flex-1 bg-transparent text-sm outline-none"
                              value={teamQuery}
                              onChange={(event) =>
                                setTeamQuery(event.target.value)
                              }
                              placeholder="Search team members"
                            />
                            <button
                              type="button"
                              className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                              onClick={() => {
                                const visibleIds = filteredTeam
                                  .map((member) => rowId(member))
                                  .filter(Boolean);
                                const allSelected =
                                  visibleIds.length > 0 &&
                                  visibleIds.every((id) =>
                                    employeeIds.includes(id),
                                  );
                                setEmployeeIds((current) =>
                                  allSelected
                                    ? current.filter(
                                        (id) => !visibleIds.includes(id),
                                      )
                                    : [...new Set([...current, ...visibleIds])],
                                );
                              }}
                            >
                              {filteredTeam.length > 0 &&
                              filteredTeam.every((member) =>
                                employeeIds.includes(rowId(member)),
                              )
                                ? "Clear visible"
                                : "Select visible"}
                            </button>
                            <button
                              type="button"
                              className="shrink-0 text-xs font-medium text-sky-700 hover:underline"
                              onClick={() => {
                                const ids = team
                                  .map((member) => rowId(member))
                                  .filter(Boolean);
                                const allSelected =
                                  ids.length > 0 &&
                                  ids.every((id) => employeeIds.includes(id));
                                setEmployeeIds(allSelected ? [] : ids);
                              }}
                            >
                              {team.length > 0 &&
                              team.every((member) =>
                                employeeIds.includes(rowId(member)),
                              )
                                ? "Clear all"
                                : "Select all"}
                            </button>
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {filteredTeam.map((member) => {
                              const id = rowId(member);
                              const checked = employeeIds.includes(id);
                              return (
                                <label
                                  key={id}
                                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-sky-700"
                                    checked={checked}
                                    onChange={() =>
                                      setEmployeeIds((current) =>
                                        checked
                                          ? current.filter(
                                              (item) => item !== id,
                                            )
                                          : [...current, id],
                                      )
                                    }
                                  />
                                  <Avatar
                                    name={personName(
                                      member,
                                      optionLabel(member),
                                    )}
                                    photoUrl={photoFromRecord(member)}
                                    className="size-6 text-[10px]"
                                  />
                                  <span className="min-w-0 flex-1 truncate">
                                    {personName(member, optionLabel(member))}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 self-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <Avatar name="You" photoUrl={myPhotoUrl} /> Assigned to
                      you
                    </div>
                  )}
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Task name</span>
                    <input
                      className={inputClass}
                      value={form.title ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                      placeholder="e.g. Prepare monthly attendance summary"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Activity category{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <FluentSelect
                      ariaLabel="Activity category"
                      className="w-full"
                      value={form.activity_category_id ?? ""}
                      placeholder="Select an activity category"
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          activity_category_id: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Uncategorized task" },
                        ...(audience === "employee"
                          ? managerSelectableCategories
                          : activityCategories
                        ).map((category) => ({
                          value: rowId(category),
                          label: optionLabel(category),
                        })),
                      ]}
                    />
                    {audience === "employee" && employeeIds.length > 1 ? (
                      <span className="text-xs text-slate-500">
                        A scoped category must apply to every selected employee.
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      {mode === "self"
                        ? "Which day is this for?"
                        : "Start date"}
                    </span>
                    <DatePickerPresets
                      value={form.activity_date ?? today()}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          activity_date: value,
                        }))
                      }
                      placeholder="Select the day"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    <label className="grid min-w-0 gap-1.5 text-sm">
                      <span className="font-medium">Starts at</span>
                      <TimeClockPicker
                        value={form.start_time ?? "09:00"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            start_time: value,
                          }))
                        }
                        placeholder="Start time"
                        aria-label="Task start time"
                        className="h-10 rounded-md px-3 text-sm"
                      />
                    </label>
                    <label className="grid min-w-0 gap-1.5 text-sm">
                      <span className="font-medium">Ends at</span>
                      <TimeClockPicker
                        value={form.end_time ?? "10:00"}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            end_time: value,
                          }))
                        }
                        placeholder="End time"
                        aria-label="Task end time"
                        className="h-10 rounded-md px-3 text-sm"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Due date{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <DatePickerPresets
                      value={form.due_date ?? ""}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, due_date: value }))
                      }
                      placeholder="Select due date"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Related KPI{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <FluentSelect
                      ariaLabel="Related KPI"
                      className="w-full"
                      value={form.employee_kpi_id ?? ""}
                      placeholder="No related KPI"
                      onChange={(value) =>
                        setForm((current) => {
                          const relevance =
                            current.performance_relevance || "NOT_EVALUATED";
                          return {
                            ...current,
                            employee_kpi_id: value,
                            performance_relevance: value
                              ? relevance === "NOT_EVALUATED"
                                ? "KEY_DELIVERABLE"
                                : relevance
                              : relevance === "KEY_DELIVERABLE" ||
                                  relevance === "SUPPORTING_EVIDENCE"
                                ? "NOT_EVALUATED"
                                : relevance,
                          };
                        })
                      }
                      options={[
                        { value: "", label: "No related KPI" },
                        ...employeeKpis
                          .filter((kpi) => {
                            if (audience !== "employee") return true;
                            if (employeeIds.length !== 1) return false;
                            return (
                              readString(kpi, ["employeeId", "employee_id"]) ===
                              employeeIds[0]
                            );
                          })
                          .map((kpi) => ({
                            value: rowId(kpi),
                            label: optionLabel(kpi),
                          })),
                      ]}
                    />
                    {audience === "employee" && employeeIds.length !== 1 ? (
                      <span className="text-xs text-slate-500">
                        Select one employee to link this task to a KPI.
                      </span>
                    ) : null}
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Performance relevance</span>
                    <FluentSelect
                      ariaLabel="Performance relevance"
                      className="w-full"
                      value={form.performance_relevance ?? "NOT_EVALUATED"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          performance_relevance: value,
                        }))
                      }
                      options={[
                        { value: "NOT_EVALUATED", label: "Not evaluated" },
                        {
                          value: "KEY_DELIVERABLE",
                          label: "Key deliverable",
                        },
                        {
                          value: "SUPPORTING_EVIDENCE",
                          label: "Supporting evidence",
                        },
                        {
                          value: "DEVELOPMENT_ACTIVITY",
                          label: "Development activity",
                        },
                      ]}
                    />
                    <span className="text-xs text-slate-500">
                      Only manager-approved key deliverables increment
                      activity-based KPI progress.
                    </span>
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Priority</span>
                    <FluentSelect
                      ariaLabel="Priority"
                      className="w-full"
                      value={form.priority ?? "MEDIUM"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, priority: value }))
                      }
                      options={[
                        { value: "LOW", label: "Low" },
                        { value: "MEDIUM", label: "Medium" },
                        { value: "HIGH", label: "High" },
                        { value: "URGENT", label: "Urgent" },
                      ]}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Notes</span>
                    <Textarea
                      className={`${inputClass} min-h-24 py-2`}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="What should be delivered?"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">
                      Expected result{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <Textarea
                      className={`${inputClass} min-h-20 py-2`}
                      value={form.expected_result ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          expected_result: event.target.value,
                        }))
                      }
                      placeholder="Describe the result that will count as complete."
                    />
                  </label>
                  <div className="grid content-start gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">
                      Checklist{" "}
                      <span className="font-normal text-slate-500">
                        (optional)
                      </span>
                    </span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        className={`${inputClass} min-w-0 flex-1`}
                        value={checklistDraft}
                        onChange={(event) =>
                          setChecklistDraft(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addChecklistItem();
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
                    {checklistItems.map((item, index) => (
                      <div
                        key={`${item}-${index}`}
                        className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
                      >
                        <CheckCircle2Icon className="size-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          onClick={() =>
                            setChecklistItems((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          aria-label={`Remove ${item}`}
                        >
                          <XIcon className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {formError ? (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
            </ValidatedWorkflowForm>
            <div className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                className={`${secondaryButtonClass} w-full justify-center sm:w-auto`}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}

      {previewReport ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4"
          onClick={() => setPreviewReport(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const closeDate = reportDateOf(previewReport);
              const entries = asRecordArray(previewReport.entries);
              const selectedEntries = entries.filter((entry) =>
                previewEntryIds.includes(entryIdOf(entry) || rowId(entry)),
              );
              const deferred = entries.filter(
                (entry) =>
                  !previewEntryIds.includes(entryIdOf(entry) || rowId(entry)),
              );
              const limits = policyLimits(previewReport);
              const issues = closeReportIssues({
                report: previewReport,
                day: closeDate,
                entryCount: selectedEntries.length,
                completedCount: selectedEntries.filter(
                  (entry) => taskStatus(entry) === "COMPLETED",
                ).length,
                summary: previewSummary,
              });
              function toggleCloseEntry(entry: AdminRecord) {
                const id = entryIdOf(entry) || rowId(entry);
                if (!id || !isCloseableActivityStatus(taskStatus(entry)))
                  return;
                setPreviewEntryIds((current) =>
                  current.includes(id)
                    ? current.filter((item) => item !== id)
                    : [...current, id],
                );
              }
              return (
                <>
                  <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                        Close this day
                      </p>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">
                        {formatDate(closeDate)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Pick the work to submit. In-progress items stay open and
                        move to the next day.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                      onClick={() => setPreviewReport(null)}
                    >
                      <XIcon className="size-5" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <StatusPill
                        value={readString(previewReport, ["status"], "DRAFT")}
                      />
                      <span className="text-slate-500">
                        {selectedEntries.length} selected · {deferred.length}{" "}
                        kept open
                      </span>
                      <span className="text-slate-500">
                        Need {limits.minCompleted} complete · cutoff{" "}
                        {limits.cutoff}
                      </span>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Submit these
                      </p>
                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {entries.map((entry) => {
                          const id = entryIdOf(entry) || rowId(entry);
                          const closeable = isCloseableActivityStatus(
                            taskStatus(entry),
                          );
                          const checked = previewEntryIds.includes(id);
                          return (
                            <label
                              key={id}
                              className={cn(
                                "flex items-start gap-3 px-3 py-2.5",
                                closeable
                                  ? "cursor-pointer"
                                  : "cursor-not-allowed bg-slate-50",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 size-4 accent-sky-700"
                                checked={checked}
                                disabled={!closeable}
                                onChange={() => toggleCloseEntry(entry)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-900">
                                  {readString(
                                    entry,
                                    ["title"],
                                    "Untitled task",
                                  )}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                                  {closeable
                                    ? readString(
                                        entry,
                                        ["description"],
                                        "No notes",
                                      )
                                    : "In progress — this stays open and will not be locked."}
                                </p>
                              </div>
                              <StatusPill value={taskStatus(entry)} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <label className="grid gap-1.5 text-sm">
                      <span className="font-medium">
                        Summary for your manager
                      </span>
                      <Textarea
                        className={`${inputClass} min-h-20 py-2`}
                        value={previewSummary}
                        onChange={(event) =>
                          setPreviewSummary(event.target.value)
                        }
                        placeholder="What should your manager know about this day?"
                      />
                    </label>
                    {issues.length ? (
                      <ul className="space-y-1 text-sm text-rose-700">
                        {issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => setPreviewReport(null)}
                    >
                      Back
                    </button>
                    {entries.filter((entry) =>
                      isCloseableActivityStatus(taskStatus(entry)),
                    ).length === 0 ? (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => openAddWorkForDay(closeDate, "close")}
                      >
                        <PlusIcon className="size-4" /> Add a work item
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => void submitReport(previewReport)}
                        disabled={submitting || issues.length > 0}
                      >
                        {submitting ? (
                          <FluentLoadingIndicator className="size-4 animate-spin" />
                        ) : (
                          <SendIcon className="size-4" />
                        )}
                        Close {formatDate(closeDate)}
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {selected ? (
        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) clearSelected();
          }}
        >
          <DialogPopup
            from="bottom"
            className="flex max-h-[min(90dvh,50rem)] max-w-2xl flex-col overflow-hidden p-0"
            showCloseButton
          >
            <DialogHeader className="mb-0 gap-2 px-5 pb-4 pt-5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  selected.is_report_row
                    ? "bg-amber-50 text-amber-800"
                    : isManagerAssigned(selected)
                      ? "bg-sky-50 text-sky-700"
                      : "bg-emerald-50 text-emerald-700",
                )}
              >
                {selected.is_report_row
                  ? "Daily report"
                  : isManagerAssigned(selected)
                    ? "Assigned task"
                    : "My work"}
              </span>
              <DialogTitle className="pr-8 text-xl">
                {readString(selected, ["title"], "Untitled task")}
              </DialogTitle>
              <DialogDescription>
                {readString(selected, [
                  "activity_category_name",
                  "activityCategoryName",
                ])
                  ? `Category: ${readString(selected, ["activity_category_name", "activityCategoryName"])}. `
                  : ""}
                Review the assignment, update its progress, and keep the
                activity trail together.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 overflow-y-auto px-5 py-5">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Avatar
                    name={
                      mode === "manager"
                        ? personName(selected.employee)
                        : assignedBy(selected)
                    }
                    photoUrl={photoForAssignee(
                      selected,
                      mode === "manager"
                        ? personName(selected.employee)
                        : assignedBy(selected),
                    )}
                  />
                  <div>
                    <p className="font-medium">
                      {mode === "manager"
                        ? personName(selected.employee)
                        : assignedBy(selected)}
                    </p>
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
                        const progress = checklistProgress(entry);
                        return (
                          <button
                            type="button"
                            key={entryIdOf(entry) || rowId(entry)}
                            className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                            onClick={() =>
                              void openTask({
                                ...entry,
                                report_id: reportIdOf(selected),
                              })
                            }
                          >
                            <span className="min-w-0 truncate font-medium">
                              {readString(entry, ["title"], "Untitled task")}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {progress
                                ? `${progress.label} done`
                                : (statusLabel[taskStatus(entry)] ??
                                  taskStatus(entry))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No work items yet. Create a task to fill this report.
                    </p>
                  )}
                  {mode === "self" && canCloseReport(selected) ? (
                    <button
                      type="button"
                      className={`${primaryButtonClass} mt-4`}
                      onClick={() => openReportPreview(selected)}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <FluentLoadingIndicator className="size-4 animate-spin" />
                      ) : (
                        <FileTextIcon className="size-4" />
                      )}
                      Close {formatDate(reportDateOf(selected))}
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Status
                      {mode === "self" && canEditTask(selected) ? (
                        <FluentSelect
                          ariaLabel="Status"
                          className="w-full"
                          value={taskEditStatus}
                          onChange={setTaskEditStatus}
                          options={[
                            { value: "PLANNED", label: "Not started" },
                            { value: "IN_PROGRESS", label: "In progress" },
                            { value: "COMPLETED", label: "Completed" },
                            { value: "DEFERRED", label: "Deferred" },
                          ]}
                        />
                      ) : (
                        <span className="flex h-10 items-center">
                          <StatusPill value={taskStatus(selected)} />
                        </span>
                      )}
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Priority
                      <span className="flex h-10 items-center gap-1.5 text-sm font-medium text-slate-800">
                        <PriorityDot priority={taskPriority(selected)} />{" "}
                        {taskPriority(selected).charAt(0) +
                          taskPriority(selected).slice(1).toLowerCase()}
                      </span>
                    </label>
                    <div className="grid gap-1 text-xs font-medium text-slate-500">
                      Review status
                      <span className="flex h-10 items-center">
                        <StatusPill value={taskReviewStatus(selected)} />
                      </span>
                    </div>
                    <div className="grid gap-1 text-xs font-medium text-slate-500">
                      Performance relevance
                      <span className="flex h-10 items-center text-sm font-medium text-slate-800">
                        {performanceRelevanceLabel(
                          taskPerformanceRelevance(selected),
                        )}
                      </span>
                    </div>
                    {plannedStartDateOf(selected) ? (
                      <div className="grid gap-1 text-xs font-medium text-slate-500">
                        Start date
                        <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800">
                          <CalendarDaysIcon className="size-4 text-slate-400" />
                          {formatDate(plannedStartDateOf(selected))}
                        </span>
                      </div>
                    ) : null}
                    {hasDueDate(selected) ? (
                      <div className="grid gap-1 text-xs font-medium text-slate-500">
                        Due date
                        <span className="flex h-10 items-center gap-1.5 text-sm text-slate-800">
                          <CalendarDaysIcon className="size-4 text-slate-400" />
                          {formatDate(plannedDueDateOf(selected))}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}
                    {plannedDateTimeOf(selected, "start") &&
                    plannedDateTimeOf(selected, "end") ? (
                      <div className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                        Scheduled time
                        <span className="flex h-10 items-center gap-1.5 text-sm text-foreground">
                          <Clock3Icon className="size-4 text-muted-foreground" />
                          {formatTimelineTime(
                            plannedDateTimeOf(selected, "start")!,
                          )}{" "}
                          –{" "}
                          {formatTimelineTime(
                            plannedDateTimeOf(selected, "end")!,
                          )}
                        </span>
                      </div>
                    ) : canScheduleTask(selected) ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 sm:col-span-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">
                            Not on the timeline
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Set a start and end time to schedule it.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground"
                          onClick={() => {
                            const task = selected;
                            clearSelected();
                            openScheduleTask(task);
                          }}
                        >
                          <PlusIcon className="size-3.5" /> Add to timeline
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {mode === "self" &&
                  canEditTask(selected) &&
                  entryIdOf(selected) ? (
                    <ActivityEvidencePicker
                      entryId={entryIdOf(selected)}
                      onAttached={load}
                    />
                  ) : null}
                  {mode === "self" && canEditTask(selected) ? (
                    <div className="space-y-3">
                      <label className="grid gap-1.5 text-sm">
                        <span className="font-medium">
                          Outcome / actual result
                        </span>
                        <Textarea
                          className={`${inputClass} min-h-20 py-2`}
                          value={taskOutcome}
                          onChange={(event) =>
                            setTaskOutcome(event.target.value)
                          }
                          placeholder="Describe what was delivered, especially before marking the activity complete."
                        />
                      </label>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() => void updateTaskStatus()}
                      >
                        Save progress
                      </button>
                    </div>
                  ) : null}

                  {mode !== "self" && readString(selected, ["outcome"]) ? (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">
                        Outcome / actual result
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {readString(selected, ["outcome"])}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        Checklist ({asRecordArray(selected.checklist).length})
                      </h3>
                      <span className="text-xs text-slate-500">
                        {
                          asRecordArray(selected.checklist).filter(
                            (item) => item.completed,
                          ).length
                        }{" "}
                        of {asRecordArray(selected.checklist).length} completed
                      </span>
                    </div>
                    {asRecordArray(selected.checklist).length ? (
                      <div className="space-y-2">
                        {asRecordArray(selected.checklist).map((item) => {
                          const itemKey = String(item.id ?? item.title);
                          return (
                            <label
                              key={itemKey}
                              className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm"
                            >
                              {mode === "self" && canEditTask(selected) ? (
                                <input
                                  type="checkbox"
                                  checked={item.completed === true}
                                  disabled={Boolean(updatingChecklistId)}
                                  onChange={() =>
                                    void toggleChecklistItem(itemKey)
                                  }
                                  className="size-4 accent-sky-700"
                                />
                              ) : (
                                <CheckCircle2Icon
                                  className={
                                    item.completed
                                      ? "size-4 text-emerald-600"
                                      : "size-4 text-slate-300"
                                  }
                                />
                              )}
                              <span
                                className={
                                  item.completed
                                    ? "text-slate-400 line-through"
                                    : "text-slate-800"
                                }
                              >
                                {readString(item, ["title"], "Checklist item")}
                              </span>
                              {updatingChecklistId === itemKey ? (
                                <FluentLoadingIndicator className="ml-auto size-4 animate-spin text-sky-700" />
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No checklist items.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Notes</h3>
                    <p className="text-sm leading-6 text-slate-600">
                      {readString(selected, ["description"], "No notes")}
                    </p>
                  </div>

                  {readString(selected, [
                    "expectedResult",
                    "expected_result",
                  ]) ? (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">
                        Expected result
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {readString(selected, [
                          "expectedResult",
                          "expected_result",
                        ])}
                      </p>
                    </div>
                  ) : null}

                  {readString(selected, [
                    "employeeKpiId",
                    "employee_kpi_id",
                  ]) ? (
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">
                        Related KPI
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {optionLabel(
                          employeeKpis.find(
                            (kpi) =>
                              rowId(kpi) ===
                              readString(selected, [
                                "employeeKpiId",
                                "employee_kpi_id",
                              ]),
                          ) ?? {},
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <MessageSquareIcon className="size-4 text-sky-700" />{" "}
                      Activity
                    </h3>
                    <div className="space-y-3">
                      {asRecordArray(selected.comments).length ? (
                        asRecordArray(selected.comments).map((item) => {
                          const author = personName(
                            item.authorSnapshot ?? item.author_snapshot,
                            "Team member",
                          );
                          const authorPhoto =
                            author === "You"
                              ? myPhotoUrl
                              : photoFromRecord(
                                  item.authorSnapshot ?? item.author_snapshot,
                                );
                          return (
                            <div
                              key={rowId(item)}
                              className="flex gap-2 text-sm"
                            >
                              <Avatar name={author} photoUrl={authorPhoto} />
                              <div>
                                <p>
                                  <span className="font-medium">{author}</span>{" "}
                                  <span className="text-xs text-slate-500">
                                    {formatDate(
                                      item.createdAt ?? item.created_at,
                                    )}
                                  </span>
                                </p>
                                <p className="text-slate-600">
                                  {readString(item, ["body"], "")}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500">
                          No comments yet.
                        </p>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        className={inputClass}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Add a comment..."
                      />
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() => void addComment()}
                        disabled={commenting || !comment.trim()}
                      >
                        {commenting ? (
                          <FluentLoadingIndicator className="size-4 animate-spin" />
                        ) : (
                          <SendIcon className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogPopup>
        </Dialog>
      ) : null}
    </section>
  );
}
