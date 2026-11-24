"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Button,
  Card,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Divider,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  OverlayDrawer,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableCellLayout,
  Text,
  createTableColumn,
  tokens,
} from "@fluentui/react-components";
import * as React from "react";
import { numericActivityTotal } from "@/lib/kpi-activity-total";
import { useRouter } from "next/navigation";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { achievementApi, type Achievement, type AchievementActivity } from "@/lib/achievement-api";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { achievementsEnabled, readKpiToken } from "@/lib/kpi-session";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import { KpiFluentInput, KpiFluentTextarea } from "./kpi-fluent-fields";
import { KpiFeedback, KpiStatusBadge } from "./kpi-page-elements";
import { ArrowLeft20Regular, ArrowUpload20Regular, Attach20Regular, Delete20Regular, Dismiss20Regular, Document20Regular, DocumentBulletList20Regular, Edit20Regular, Target20Regular } from "@fluentui/react-icons";

type AchievementFlowStep = "mode" | "quick" | "activities";
type ActivityForm = {
  activityDate: string;
  title: string;
  details: string;
  measurableResult: string;
  comments: string;
};
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function defaultActivityDate(period?: KpiAssignment["period"]) {
  const today = localToday();
  const start = period?.startDate?.slice(0, 10) ?? today;
  const end = period?.endDate?.slice(0, 10) ?? today;
  return today < start ? start : today > end ? end : today;
}
function emptyActivity(): ActivityForm {
  return {
  activityDate: "",
  title: "",
  details: "",
  measurableResult: "",
  comments: "",
  };
}

function format(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const row = value as Record<string, unknown>;
    if ("completed" in row && "eligible" in row) {
      const completed = Number(row.completed);
      const eligible = Number(row.eligible);
      return `${completed} completed / ${eligible} eligible`;
    }
    return Object.entries(row).map(([key, item]) => `${key}: ${String(item)}`).join(" · ");
  }
  return String(value);
}
function formatActivityResult(value: unknown, unit?: string | null) {
  const formatted = format(value);
  if (!unit || value === null || value === undefined || value === "") return formatted;
  if (typeof value === "object" && value && "completed" in value && "eligible" in value) return formatted;
  return `${formatted} ${unit}`;
}
function formatTarget(target: Record<string, unknown> | null, unit?: string | null) {
  if (!target) return "Not set";
  const entries = Object.entries(target);
  if (entries.length === 1 && entries[0][0] === "value") {
    return `${String(entries[0][1])}${unit ? ` ${unit}` : ""}`;
  }
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}
function isNumericValue(value: unknown): value is number | string {
  return typeof value === "number" && Number.isFinite(value) ||
    typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}
function displayPeriodDate(value?: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${Number(match[3])} ${months[month - 1]} ${match[1]}` : value;
}
function displayDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function friendlyStatus(status: string) {
  return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
function ActivityProgressBadge({ status }: { status: string }) {
  return status === "draft" ? <Badge appearance="outline" color="success">Saved</Badge> : <KpiStatusBadge status={status} />;
}
function parseActual(type: string, raw: string): unknown {
  if (!raw.trim()) return undefined;
  if (["numeric", "percentage", "currency", "duration"].includes(type)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("Enter a finite numeric actual");
    return n;
  }
  if (type === "binary") {
    if (!["true", "false"].includes(raw.toLowerCase())) throw new Error("Enter true or false");
    return raw.toLowerCase() === "true";
  }
  if (type === "milestone") {
    if (!["true", "false"].includes(raw.toLowerCase())) throw new Error("Enter true or false for completion");
    return { completed: raw.toLowerCase() === "true" };
  }
  return raw.trim();
}
function initialActual(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value && "completed" in value) return String(value.completed);
  return String(value);
}
function parseActivityResult(raw: string, measurementType: string): unknown {
  if (!raw.trim()) return undefined;
  if (measurementType === "percentage" && raw.includes("/")) {
    const [completedText, eligibleText, ...extra] = raw.split("/");
    const completed = Number(completedText.trim());
    const eligible = Number(eligibleText?.trim());
    if (extra.length || !Number.isFinite(completed) || !Number.isFinite(eligible) || eligible <= 0 || completed < 0 || completed > eligible) {
      throw new Error("Enter completed/eligible quantities, for example 18/20");
    }
    return { completed, eligible };
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : raw.trim();
}
function activityResultInput(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "completed" in value && "eligible" in value) {
    const result = value as Record<string, unknown>;
    return `${String(result.completed)}/${String(result.eligible)}`;
  }
  return String(value);
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export function EmployeeAchievement({ assignmentId, startAction }: { assignmentId: number; startAction?: "add-activity" | "record-achievement" }) {
  const router = useRouter();
  const actor = useDashboardActor();
  const token = readKpiToken();
  const [assignment, setAssignment] = React.useState<KpiAssignment | null>(null);
  const [availableAssignments, setAvailableAssignments] = React.useState<KpiAssignment[]>([]);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const [record, setRecord] = React.useState<Achievement | null>(null);
  const [actual, setActual] = React.useState("");
  const [useActivityTotal, setUseActivityTotal] = React.useState(false);
  const [comments, setComments] = React.useState("");
  const [modePickerOpen, setModePickerOpen] = React.useState(false);
  const [flowStep, setFlowStep] = React.useState<AchievementFlowStep>("mode");
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [selectedActivityId, setSelectedActivityId] = React.useState<number | null>(null);
  const [editingActivity, setEditingActivity] = React.useState<AchievementActivity | null>(null);
  const [activityForm, setActivityForm] = React.useState<ActivityForm>(emptyActivity);
  const [activityEvidenceFile, setActivityEvidenceFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activityFormError, setActivityFormError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const loadSequence = React.useRef(0);
  const initialFlowStarted = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!token || !achievementsEnabled) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const [assignments, records] = await Promise.all([kpiApi.mine(token), achievementApi.mine(token)]);
      const item = assignments.find((row) => row.id === assignmentId);
      if (!item) throw new Error("This KPI is not directly assigned to you");
      if (sequence !== loadSequence.current) return;
      setAssignment(item);
      setAvailableAssignments(assignments);
      const found = records.find((row) => row.assignmentId === assignmentId) ?? null;
      setRecord(found);
      setActual(initialActual(found?.current?.actual));
      setUseActivityTotal(false);
      setComments(found?.current?.comments ?? "");
      setError("");
    } catch (e) {
      if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : "Unable to load achievement");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [token, assignmentId]);
  React.useEffect(() => {
    if (actor.ready) void load();
  }, [actor.ready, load]);
  React.useEffect(() => {
    if (loading || !assignment || !startAction || initialFlowStarted.current) return;
    initialFlowStarted.current = true;
    if (assignment.status !== "active" || !assignment.currentTarget || (record && record.current.status !== "draft")) return;
    if (startAction === "record-achievement") {
      setFlowStep("mode");
      setModePickerOpen(true);
      return;
    }
    setEditingActivity(null);
    setActivityForm({ ...emptyActivity(), activityDate: defaultActivityDate(assignment.period) });
    setActivityEvidenceFile(null);
    setActivityFormError("");
    setActivityOpen(true);
  }, [loading, assignment, record, startAction]);

  const draft = !record || record.current?.status === "draft";
  const blockedAchievement = !assignment ? undefined : assignment.status !== "active"
    ? "This KPI assignment is inactive."
    : !assignment.currentTarget
      ? "An authorized manager must configure the assignment target before achievement submission."
      : undefined;
  const canEditDraft = draft && !blockedAchievement;
  const measurementType = assignment?.definitionVersion?.measurementType ?? "numeric";
  const activities = record?.current?.activities ?? [];
  const activityTotal = measurementType === "numeric" ? numericActivityTotal(activities.map((activity) => activity.measurableResult)) : null;
  const summedActivityValue = activityTotal?.total;
  React.useEffect(() => {
    if (useActivityTotal && summedActivityValue) setActual(summedActivityValue);
  }, [useActivityTotal, summedActivityValue]);
  const previousRevisions = record?.revisions.filter((revision) => revision.id !== record.current.id) ?? [];
  const selectedActivity = activities.find((activity) => activity.id === selectedActivityId) ?? null;
  const hasFinalResult = record?.current.actual !== null && record?.current.actual !== undefined;
  const targetValue = assignment?.currentTarget?.target?.value;
  const actualValue = record?.current.actual;
  const simpleTarget = isNumericValue(targetValue);
  const simpleActual = isNumericValue(actualValue);
  const achievementStatus = record?.current.status ?? assignment?.status ?? "draft";
  const nextStepTitle = canEditDraft
    ? record ? "Finish your draft" : "Record your first activity"
    : ["submitted", "under_review"].includes(achievementStatus) ? "Waiting for manager review"
    : achievementStatus === "approved" ? "Your result is approved"
    : ["returned", "rejected"].includes(achievementStatus) ? "Review your manager’s feedback"
    : "View your recorded work";

  function openActivityForm() {
    setEditingActivity(null);
    setActivityForm({ ...emptyActivity(), activityDate: defaultActivityDate(assignment?.period) });
    setActivityEvidenceFile(null);
    setActivityFormError("");
    setModePickerOpen(false);
    setActivityOpen(true);
  }

  async function action(task: () => Promise<Achievement>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await task();
      ++loadSequence.current;
      setRecord(result);
      setActual(initialActual(result.current.actual));
      setComments(result.current.comments ?? "");
      setNotice(message);
      window.dispatchEvent(new Event("hrms:refresh-page-data"));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function enteredActual() {
    return parseActual(measurementType, actual);
  }
  async function saveActivity() {
    if (!assignment) return;
    setActivityFormError("");
    if (!activityForm.title.trim() || !activityForm.details.trim()) {
      setActivityFormError("Add an activity title and work performed before saving.");
      return;
    }
    let measurableResult: unknown;
    try {
      measurableResult = parseActivityResult(activityForm.measurableResult, measurementType);
    } catch (e) {
      setActivityFormError(e instanceof Error ? e.message : "Check the measurable result");
      return;
    }
    const periodStart = assignment.period?.startDate?.slice(0, 10) ?? "";
    const periodEnd = assignment.period?.endDate?.slice(0, 10) ?? "";
    if (!activityForm.activityDate || activityForm.activityDate < periodStart || activityForm.activityDate > periodEnd) {
      setActivityFormError("Choose a date within the assigned reporting period.");
      return;
    }
    if (activityEvidenceFile && activityEvidenceFile.size > 10 * 1024 * 1024) {
      setActivityFormError("Evidence must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    let savedActivityForRetry: AchievementActivity | null = null;
    try {
      let current = record;
      if (!current) current = await achievementApi.create(token, assignmentId);
      const priorActivityIds = new Set(record?.current.activities?.map((activity) => activity.id) ?? []);
      const payload = {
        activityDate: activityForm.activityDate,
        title: activityForm.title,
        details: activityForm.details,
        measurableResult,
        comments: activityForm.comments,
      };
      const result = editingActivity
        ? achievementApi.updateActivity(token, current.id, editingActivity.id, { ...payload, rowVersion: editingActivity.rowVersion })
        : achievementApi.addActivity(token, current.id, payload);
      const saved = await result;
      let latest = saved;
      setRecord(saved);
      if (activityEvidenceFile) {
        savedActivityForRetry = saved.current.activities?.find((activity) => activity.id === editingActivity?.id)
          ?? saved.current.activities?.find((activity) => !priorActivityIds.has(activity.id) && activity.activityDate === payload.activityDate && activity.title === payload.title)
          ?? null;
        if (!savedActivityForRetry) throw new Error("Activity saved, but its evidence could not be attached. Reload and attach it from the activity list.");
        setEditingActivity(savedActivityForRetry);
        latest = await achievementApi.uploadActivityEvidence(token, saved.id, savedActivityForRetry.id, savedActivityForRetry.rowVersion, {
          fileName: activityEvidenceFile.name,
          fileSize: activityEvidenceFile.size,
          mimeType: activityEvidenceFile.type,
          fileString: await fileToBase64(activityEvidenceFile),
        });
      }
      ++loadSequence.current;
      setRecord(latest);
      setActual(initialActual(latest.current.actual));
      setComments(latest.current.comments ?? "");
      setNotice(editingActivity ? "Activity updated" : "Activity recorded");
      setActivityEvidenceFile(null);
      setEditingActivity(null);
      setActivityOpen(false);
      if (modePickerOpen) setFlowStep("activities");
      window.dispatchEvent(new Event("hrms:refresh-page-data"));
    } catch (e) {
      if (savedActivityForRetry) setEditingActivity(savedActivityForRetry);
      const message = e instanceof Error ? e.message : "Unable to save activity";
      setError(message);
      setActivityFormError(message);
    } finally {
      setBusy(false);
    }
  }
  async function removeActivity(activity: AchievementActivity) {
    if (!record) return false;
    const confirmed = await fluentConfirm(`Remove “${activity.title}” from this draft? Its evidence will also be removed unless another revision retains a reference.`, {
      title: "Remove activity",
      confirmLabel: "Remove activity",
    });
    if (!confirmed) return false;
    return action(() => achievementApi.removeActivity(token, record.id, activity.id, activity.rowVersion), "Activity removed");
  }
  async function uploadActivityFile(activity: AchievementActivity, file?: File) {
    if (!record || !file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Evidence must be 10 MB or smaller.");
      return;
    }
    await action(async () => achievementApi.uploadActivityEvidence(token, record.id, activity.id, activity.rowVersion, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileString: await fileToBase64(file),
    }), "Activity evidence uploaded");
  }
  async function submitAchievement() {
    if (!assignment) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const submittedActual = enteredActual();
      if (submittedActual === undefined || actual.trim() === "") {
        throw new Error("Enter the final actual achievement before requesting review.");
      }
      const draft = record
        ? await achievementApi.update(token, record.id, record.current.rowVersion, submittedActual, comments)
        : await achievementApi.create(token, assignmentId, submittedActual, comments);
      const submitted = await achievementApi.submit(token, draft.id, draft.current.rowVersion);
      ++loadSequence.current;
      setRecord(submitted);
      setActual(initialActual(submitted.current.actual));
      setComments(submitted.current.comments ?? "");
      setModePickerOpen(false);
      setNotice("Achievement submitted to your manager for review");
      window.dispatchEvent(new Event("hrms:refresh-page-data"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit the achievement");
    } finally {
      setBusy(false);
    }
  }

  if (!achievementsEnabled) return <p className="p-6">Achievement submissions are disabled in this environment.</p>;

  return (
    <div className="space-y-4">
      <header className="-mx-3 border-b border-border bg-background px-3 pb-4 sm:-mx-4 sm:px-4" aria-label="KPI achievement overview">
        <div className="flex items-center gap-2 py-2">
          <Button type="button" appearance="subtle" size="small" icon={<ArrowLeft20Regular />} aria-label="Back to KPI listings" title="Back to KPI listings" className="!size-8 !min-w-8 !rounded-full !p-0" onClick={() => router.push("/dashboard/me/kpi")} />
          <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>My KPIs</Text>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{assignment?.definitionVersion?.name ?? "KPI achievement"}</h1><KpiStatusBadge status={achievementStatus} /></div>
            {assignment?.definitionVersion?.description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{assignment.definitionVersion.description}</p>}
            <p className="mt-2 text-sm font-medium text-foreground">{nextStepTitle}</p>
          </div>
          <Button type="button" appearance="secondary" className="!shrink-0" onClick={() => setSwitcherOpen(true)}>Switch to other KPIs</Button>
        </div>
        {assignment && <dl className="mt-4 grid grid-cols-2 border-y border-border/70 sm:grid-cols-4">
          <div className="min-w-0 px-3 py-3 sm:border-r sm:border-border/70"><dt className="text-xs text-muted-foreground">Reporting period</dt><dd className="mt-1 break-words text-sm font-semibold">{displayPeriodDate(assignment.period?.startDate)} – {displayPeriodDate(assignment.period?.endDate)}</dd></div>
          <div className="min-w-0 border-l border-border/70 px-3 py-3 sm:border-l-0 sm:border-r"><dt className="text-xs text-muted-foreground">Target</dt><dd className="mt-1 break-words text-lg font-semibold text-primary">{simpleTarget ? formatActivityResult(targetValue, assignment.definitionVersion?.measurementUnit) : formatTarget(assignment.currentTarget?.target ?? null, assignment.definitionVersion?.measurementUnit)}</dd></div>
          <div className="min-w-0 border-t border-border/70 px-3 py-3 sm:border-r sm:border-t-0"><dt className="text-xs text-muted-foreground">Final result</dt><dd className="mt-1 break-words text-lg font-semibold">{simpleActual ? formatActivityResult(actualValue, assignment.definitionVersion?.measurementUnit) : hasFinalResult ? formatActivityResult(actualValue, assignment.definitionVersion?.measurementUnit) : "Not entered"}</dd></div>
          <div className="min-w-0 border-l border-t border-border/70 px-3 py-3 sm:border-l-0 sm:border-t-0"><dt className="text-xs text-muted-foreground">Activities</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{activities.length}</dd></div>
        </dl>}
        {(canEditDraft || (record && ["returned", "rejected"].includes(record.current.status))) && <div className="mt-4 flex flex-wrap justify-end gap-2">
          {canEditDraft && <><Button type="button" appearance="secondary" onClick={openActivityForm}>Add activity</Button><Button type="button" appearance="primary" disabled={busy} onClick={() => { setFlowStep("quick"); setModePickerOpen(true); }}>Submit achievement</Button></>}
          {record && ["returned", "rejected"].includes(record.current.status) && <Button type="button" appearance="primary" disabled={busy} onClick={() => void action(() => achievementApi.create(token, assignmentId), "Correction draft created")}>Start a correction</Button>}
        </div>}
      </header>
      {record?.current.reviewComment && <Card appearance="outline" className="p-4 sm:p-5" aria-label="Manager feedback"><Text as="h2" size={400} weight="semibold">Manager feedback</Text><Text as="p" size={300} className="whitespace-pre-wrap">{record.current.reviewComment}</Text></Card>}
      {!!record?.current.evidence.length && <div className="flex flex-wrap items-center gap-2"><Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Supporting files</Text>{record.current.evidence.map((evidence) => <Button key={evidence.id} size="small" appearance="subtle" icon={<Document20Regular />} onClick={() => void achievementApi.download(token, record.id, evidence).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>{evidence.fileName}</Button>)}</div>}
      {loading && <p>Loading achievement…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
      {blockedAchievement && <KpiFeedback intent="warning">{blockedAchievement}</KpiFeedback>}
      {assignment?.status !== "active" && assignment && !!assignment.targetHistory?.length && <Card appearance="outline" className="p-5" aria-label="Target history"><Text as="h2" size={400} weight="semibold">Target changes</Text><div className="mt-3 space-y-2">{assignment.targetHistory.map((item) => <Text as="p" size={300} key={item.revision} style={{ color: tokens.colorNeutralForeground2 }}>Revision {item.revision} · {formatTarget(item.target, assignment.definitionVersion?.measurementUnit)} · {item.reason} · {displayDateTime(item.changedAt)}</Text>)}</div></Card>}
      {assignment && <section className="space-y-4" aria-label="KPI activity list">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><Text as="h2" size={500} weight="semibold" style={{ display: "block" }}>Work recorded</Text><Text as="p" size={200} className="mt-1" style={{ color: tokens.colorNeutralForeground2, display: "block" }}>{activities.length === 1 ? "1 activity" : `${activities.length} activities`} during this reporting period</Text></div>{canEditDraft && activities.length > 0 && <Button type="button" appearance="secondary" onClick={openActivityForm}>Add another activity</Button>}</div>
        {activities.length === 0 ? <Card appearance="filled-alternative" className="items-center p-7 text-center"><Text as="h3" size={400} weight="semibold">No work recorded yet</Text><Text as="p" size={300} className="max-w-md" style={{ color: tokens.colorNeutralForeground2 }}>{assignment.status === "active" ? "Add an activity to show what you did during this period." : "No activities were recorded for this assignment."}</Text>{canEditDraft && <Button type="button" appearance="secondary" onClick={openActivityForm}>Add your first activity</Button>}</Card> : <ActivityTable activities={activities} unit={assignment.definitionVersion?.measurementUnit} onOpen={(activityId) => { setError(""); setNotice(""); setSelectedActivityId(activityId); }} />}
      </section>}

      <ActivityDetailsDialog
        activity={selectedActivity}
        unit={assignment?.definitionVersion?.measurementUnit}
        canEdit={canEditDraft}
        busy={busy}
        error={error}
        notice={notice}
        onClose={() => setSelectedActivityId(null)}
        onDownload={(activity, file) => { if (record) void achievementApi.downloadActivityEvidence(token, record.id, activity, file).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed")); }}
        onUpload={(activity, file) => void uploadActivityFile(activity, file)}
        onEdit={(activity) => { setSelectedActivityId(null); setEditingActivity(activity); setActivityForm({ activityDate: activity.activityDate.slice(0, 10), title: activity.title, details: activity.details, measurableResult: activityResultInput(activity.measurableResult), comments: activity.comments ?? "" }); setActivityEvidenceFile(null); setActivityFormError(""); setActivityOpen(true); }}
        onRemove={(activity) => { void removeActivity(activity).then((removed) => { if (removed) setSelectedActivityId(null); }); }}
      />

      <OverlayDrawer open={switcherOpen} onOpenChange={(_, data) => setSwitcherOpen(data.open)} position="end" size="small" style={{ width: "min(24rem, 100vw)" }}>
        <DrawerHeader>
          <DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close KPI switcher" onClick={() => setSwitcherOpen(false)} />}>Switch KPI</DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-3 !px-0 !pb-5">
          <Text as="p" size={300} className="px-4" style={{ color: tokens.colorNeutralForeground2 }}>Choose another KPI to open its activities and progress.</Text>
          {!!availableAssignments.length && <Table aria-label="Available KPI assignments" size="small" className="w-full table-fixed">
            <TableHeader><TableRow><TableHeaderCell className="w-auto !px-4">KPI</TableHeaderCell><TableHeaderCell className="w-24 !px-2">Status</TableHeaderCell></TableRow></TableHeader>
            <TableBody>{availableAssignments.map((item) => {
              const current = item.id === assignmentId;
              return <TableRow key={item.id} aria-current={current ? "page" : undefined} className={current ? "bg-primary/10" : "cursor-pointer hover:bg-muted/50"} onClick={() => { if (current) return; setSwitcherOpen(false); router.push(`/dashboard/me/kpi/${item.id}`); }}>
                <TableCell className="!px-4 !py-3"><button type="button" className="block w-full text-left" disabled={current} onClick={(event) => { event.stopPropagation(); setSwitcherOpen(false); router.push(`/dashboard/me/kpi/${item.id}`); }}><span className="block truncate text-sm font-semibold">{item.definitionVersion?.name ?? `KPI #${item.id}`}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.period?.label ?? "Reporting period unavailable"}{current ? " · Current KPI" : ""}</span></button></TableCell>
                <TableCell className="!px-2 !py-3"><KpiStatusBadge status={item.status} /></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>}
          {!availableAssignments.length && <Text as="p" size={300}>No KPI assignments are available.</Text>}
        </DrawerBody>
      </OverlayDrawer>

      {record && previousRevisions.length > 0 && <Card appearance="outline" className="p-3 sm:p-4" aria-label="Previous submissions">
        <Text as="h2" size={400} weight="semibold">Previous submissions</Text>
        <Accordion collapsible multiple className="mt-2">
          {previousRevisions.map((revision) => <AccordionItem value={`revision-${revision.id}`} key={revision.id}><AccordionHeader>Submission {revision.revision} · {friendlyStatus(revision.effectiveStatus)}</AccordionHeader><AccordionPanel><Text as="p" size={300}>Final result: {formatActivityResult(revision.actual, assignment?.definitionVersion?.measurementUnit)}</Text>{revision.reviewComment && <Text as="p" size={300} className="mt-2 block">Manager feedback: {revision.reviewComment}</Text>}<ActivityReadOnlyList activities={revision.activities ?? []} achievementId={record.id} token={token} onError={setError} />{revision.evidence.map((evidence) => <Button key={evidence.id} appearance="subtle" size="small" onClick={() => void achievementApi.download(token, record.id, evidence).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>{evidence.fileName}</Button>)}</AccordionPanel></AccordionItem>)}
        </Accordion>
      </Card>}

      <Dialog open={modePickerOpen} onOpenChange={(_, data) => { if (!busy) setModePickerOpen(data.open); }}>
        <DialogSurface className="max-h-[min(88vh,52rem)] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto"><DialogBody>
          <DialogTitle>{flowStep === "mode" ? "Record achievement" : flowStep === "quick" ? "Submit achievement" : flowStep === "activities" ? "Detailed Activity Log" : editingActivity ? "Edit activity" : "Add activity"}</DialogTitle>
          {flowStep === "mode" && <>
            <DialogContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose how you want to record this KPI result. Your choice opens the entry form here.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card appearance="outline" className="h-full overflow-hidden"><Button appearance="subtle" size="large" className="!h-full !min-h-28 !w-full !justify-start !whitespace-normal !px-4 !py-4 !text-left" onClick={() => { setFlowStep("quick"); }}><span className="flex w-full items-start gap-3"><Edit20Regular aria-hidden className="mt-0.5 shrink-0" /><span className="block min-w-0"><span className="block font-semibold">Quick Entry</span><span className="mt-1 block text-sm font-normal text-muted-foreground">Enter the final achievement and supporting comments.</span></span></span></Button></Card>
                <Card appearance="outline" className="h-full overflow-hidden"><Button appearance="subtle" size="large" className="!h-full !min-h-28 !w-full !justify-start !whitespace-normal !px-4 !py-4 !text-left" onClick={openActivityForm}><span className="flex w-full items-start gap-3"><DocumentBulletList20Regular aria-hidden className="mt-0.5 shrink-0" /><span className="block min-w-0"><span className="block font-semibold">Add Activity</span><span className="mt-1 block text-sm font-normal text-muted-foreground">Open the dated activity form to record work, a result and evidence.</span></span></span></Button></Card>
              </div>
            </DialogContent>
            <DialogActions><Button appearance="secondary" onClick={() => setModePickerOpen(false)}>Cancel</Button></DialogActions>
          </>}
          {flowStep === "quick" && <>
            <DialogContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{assignment!.definitionVersion?.name} · {assignment!.period?.label}</p>
              <KpiFeedback intent="info">Your {activities.length === 1 ? "activity is" : `${activities.length} activities are`} saved as supporting work. Enter the final result, then submit the complete achievement to your manager.</KpiFeedback>
              <div className="grid gap-3 sm:grid-cols-2"><Field label={`Final actual achievement${assignment!.definitionVersion?.measurementUnit ? ` (${assignment!.definitionVersion.measurementUnit})` : ""}`} required><KpiFluentInput value={actual} readOnly={useActivityTotal} onChange={(event) => setActual(event.target.value)} placeholder="Enter the reporting-period result" /></Field><Field label="Supporting comments"><KpiFluentTextarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={4000} rows={3} /></Field></div>
              {activityTotal && <div className="flex flex-wrap items-center gap-3"><Switch checked={useActivityTotal} onChange={(_, data) => { setUseActivityTotal(data.checked); if (data.checked) setActual(activityTotal.total) }} label="Use activity total as final result" /><span className="text-sm text-muted-foreground">Adds {activityTotal.count} numeric {activityTotal.count === 1 ? "activity result" : "activity results"}. Turn off to enter a result manually.</span></div>}
            </DialogContent>
            <DialogActions><Button appearance="secondary" onClick={() => setModePickerOpen(false)}>Cancel</Button><Button appearance="secondary" disabled={busy} onClick={() => { setModePickerOpen(false); void action(() => record ? achievementApi.update(token, record.id, record.current.rowVersion, enteredActual(), comments) : achievementApi.create(token, assignmentId, enteredActual(), comments), "Draft saved"); }}>Save for later</Button><Button appearance="primary" disabled={busy || !actual.trim()} onClick={() => void submitAchievement()}>{busy ? "Submitting…" : "Submit to manager"}</Button></DialogActions>
          </>}
          {flowStep === "activities" && <>
            <DialogContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{assignment!.definitionVersion?.name} · {assignment!.period?.label}. Activity results support your final actual; they are not automatically aggregated for this KPI.</p>
              <div className="grid gap-3 sm:grid-cols-2"><Card appearance="filled-alternative" className="p-3"><p className="text-sm text-muted-foreground">Target</p><p className="text-2xl font-bold text-sky-700 dark:text-sky-300">{formatTarget(assignment!.currentTarget?.target ?? null, assignment!.definitionVersion?.measurementUnit)}</p></Card><Card appearance="filled-alternative" className="p-3"><p className="text-sm text-muted-foreground">Recorded actual</p><p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{actual.trim() ? `${actual} ${assignment!.definitionVersion?.measurementUnit ?? ""}` : "—"}</p></Card></div>
              <div className="flex items-center justify-between"><h3 className="font-semibold">Activity records</h3><span className="text-sm text-muted-foreground">{activities.length} recorded</span></div>
              {activities.length ? <Card appearance="outline" className="overflow-x-auto"><Table aria-label="Activity records" className="w-full min-w-[32rem]"><TableHeader><TableRow><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Activity</TableHeaderCell><TableHeaderCell className="text-right">Result</TableHeaderCell></TableRow></TableHeader><TableBody>{activities.map((activity) => <TableRow key={activity.id}><TableCell>{new Date(`${activity.activityDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</TableCell><TableCell><details><summary className="cursor-pointer font-medium">{activity.title}</summary><p className="mt-1 text-sm text-muted-foreground">{activity.details}</p></details></TableCell><TableCell className="text-right">{formatActivityResult(activity.measurableResult, assignment!.definitionVersion?.measurementUnit)}</TableCell></TableRow>)}</TableBody></Table></Card> : <Card appearance="outline" className="p-4 text-center text-sm text-muted-foreground">No activity records yet. Add your first activity to begin.</Card>}
            </DialogContent>
            <DialogActions className="flex flex-wrap items-center justify-end gap-2"><Button size="medium" className="!min-w-24 !whitespace-nowrap" appearance="secondary" onClick={() => setFlowStep("mode")}>Back</Button><Button size="medium" className="!min-w-36 !whitespace-nowrap" appearance="secondary" onClick={openActivityForm}>+ Add Activity</Button><Button size="medium" className="!min-w-40 !whitespace-nowrap" appearance="primary" disabled={busy || !actual.trim()} onClick={() => void submitAchievement()}>{busy ? "Submitting…" : "Submit to manager"}</Button></DialogActions>
          </>}
        </DialogBody></DialogSurface>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={(_, data) => { if (!busy) setActivityOpen(data.open); }}>
        <DialogSurface className="max-h-[min(82vh,44rem)] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto"><DialogBody>
          <DialogTitle>{editingActivity ? "Edit activity" : "Add activity"}</DialogTitle>
          <DialogContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Activity date must be within {assignment?.period?.label} ({assignment?.period?.startDate?.slice(0, 10)} – {assignment?.period?.endDate?.slice(0, 10)}).</p>
            {activityFormError && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{activityFormError}</div>}
            <section className="space-y-2" aria-label="Activity details">
              <h3 className="text-sm font-semibold">Activity details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Activity date" required><KpiFluentInput type="date" min={assignment?.period?.startDate?.slice(0, 10)} max={assignment?.period?.endDate?.slice(0, 10)} value={activityForm.activityDate} aria-invalid={Boolean(activityFormError && activityFormError.toLowerCase().includes("date"))} onChange={(event) => { setActivityFormError(""); setActivityForm((value) => ({ ...value, activityDate: event.target.value })); }} /></Field>
                <Field label="Activity title" required><KpiFluentInput value={activityForm.title} maxLength={180} aria-invalid={Boolean(activityFormError && activityFormError.toLowerCase().includes("title"))} onChange={(event) => { setActivityFormError(""); setActivityForm((value) => ({ ...value, title: event.target.value })); }} /></Field>
              </div>
              <Field label="Work performed" required><KpiFluentTextarea value={activityForm.details} maxLength={10000} rows={3} aria-invalid={Boolean(activityFormError && activityFormError.toLowerCase().includes("work performed"))} onChange={(event) => { setActivityFormError(""); setActivityForm((value) => ({ ...value, details: event.target.value })); }} /></Field>
            </section>
            <section className="space-y-2 border-t pt-3" aria-label="Measurable result">
              <h3 className="text-sm font-semibold">Measurable result</h3>
              <Field label={`Result${assignment?.definitionVersion?.measurementUnit ? ` (${assignment.definitionVersion.measurementUnit})` : ""}`} hint={measurementType === "percentage" ? "Use a percentage value or completed/eligible quantities, such as 18/20. Percentages are not added together." : "Enter a result supported by this KPI’s measurement type; explain context in comments."}>
                <KpiFluentInput value={activityForm.measurableResult} aria-invalid={Boolean(activityFormError)} onChange={(event) => { setActivityFormError(""); setActivityForm((value) => ({ ...value, measurableResult: event.target.value })); }} placeholder={measurementType === "percentage" ? "18/20" : assignment?.definitionVersion?.measurementUnit ?? "Optional"} />
              </Field>
            </section>
            <section className="space-y-2 border-t pt-3" aria-label="Supporting information">
              <h3 className="text-sm font-semibold">Supporting information</h3>
              <Field label="Comments"><KpiFluentTextarea value={activityForm.comments} maxLength={4000} rows={2} onChange={(event) => setActivityForm((value) => ({ ...value, comments: event.target.value }))} /></Field>
              <Field label="Evidence attachment" hint="Private evidence is available to authorized reviewers. Maximum 10 MB.">
                <KpiFluentInput type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt" disabled={busy} onChange={(event) => setActivityEvidenceFile(event.target.files?.[0] ?? null)} />
                {activityEvidenceFile && <p role="status" className="text-xs text-muted-foreground">Selected: {activityEvidenceFile.name}</p>}
              </Field>
            </section>
          </DialogContent>
          <DialogActions><Button appearance="secondary" disabled={busy} onClick={() => setActivityOpen(false)}>Cancel</Button><Button appearance="primary" disabled={busy || !activityForm.title.trim() || !activityForm.details.trim()} onClick={() => void saveActivity()}>{busy ? "Saving…" : "Save activity"}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
}

function ActivityTable({ activities, unit, onOpen }: { activities: AchievementActivity[]; unit?: string | null; onOpen: (activityId: number) => void }) {
  const columns = React.useMemo(() => [
    createTableColumn<AchievementActivity>({
      columnId: "activity",
      compare: (a, b) => a.title.localeCompare(b.title),
      renderHeaderCell: () => "Activity",
      renderCell: (item) => <TableCellLayout media={<DocumentBulletList20Regular aria-hidden />}><Button type="button" appearance="subtle" size="small" className="!max-w-full !justify-start !px-1" onClick={(event) => { event.stopPropagation(); onOpen(item.id); }} title={`View ${item.title}`}>{item.title}</Button></TableCellLayout>,
    }),
    createTableColumn<AchievementActivity>({
      columnId: "date",
      compare: (a, b) => a.activityDate.localeCompare(b.activityDate),
      renderHeaderCell: () => "Date",
      renderCell: (item) => displayPeriodDate(item.activityDate.slice(0, 10)),
    }),
    createTableColumn<AchievementActivity>({
      columnId: "progress",
      compare: (a, b) => a.status.localeCompare(b.status),
      renderHeaderCell: () => "Progress",
      renderCell: (item) => <ActivityProgressBadge status={item.status} />,
    }),
    createTableColumn<AchievementActivity>({
      columnId: "result",
      compare: (a, b) => formatActivityResult(a.measurableResult, unit).localeCompare(formatActivityResult(b.measurableResult, unit)),
      renderHeaderCell: () => "Result",
      renderCell: (item) => item.measurableResult === null || item.measurableResult === undefined || item.measurableResult === "" ? <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>Not entered</Text> : formatActivityResult(item.measurableResult, unit),
    }),
    createTableColumn<AchievementActivity>({
      columnId: "files",
      compare: (a, b) => a.evidence.length - b.evidence.length,
      renderHeaderCell: () => "Files",
      renderCell: (item) => item.evidence.length === 1 ? "1 file" : `${item.evidence.length} files`,
    }),
  ], [onOpen, unit]);
  const widths: Record<string, string> = { activity: "37%", date: "17%", progress: "16%", result: "18%", files: "12%" };

  return <Card appearance="outline" className="min-w-0 overflow-hidden p-0">
    <div className="overflow-x-auto" role="region" aria-label="Recorded activities table" tabIndex={0}>
      <DataGrid items={activities} columns={columns} getRowId={(item) => item.id} sortable defaultSortState={{ sortColumn: "date", sortDirection: "descending" }} size="small" aria-label="Recorded activities" style={{ minWidth: "640px", width: "100%", tableLayout: "fixed" }}>
        <DataGridHeader style={{ backgroundColor: tokens.colorNeutralBackground2 }}><DataGridRow>{({ columnId, renderHeaderCell }) => <DataGridHeaderCell key={columnId} style={{ width: widths[String(columnId)] }}>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow></DataGridHeader>
        <DataGridBody<AchievementActivity>>{({ item, rowId }) => <DataGridRow<AchievementActivity> key={rowId} className="cursor-pointer" onClick={() => onOpen(item.id)} aria-label={`Open ${item.title}, ${friendlyStatus(item.status)}`}>{({ columnId, renderCell }) => <DataGridCell key={columnId} style={{ width: widths[String(columnId)] }}>{renderCell(item)}</DataGridCell>}</DataGridRow>}</DataGridBody>
      </DataGrid>
    </div>
  </Card>;
}

function ActivityDetailsDialog({
  activity,
  unit,
  canEdit,
  busy,
  error,
  notice,
  onClose,
  onDownload,
  onUpload,
  onEdit,
  onRemove,
}: {
  activity: AchievementActivity | null;
  unit?: string | null;
  canEdit: boolean;
  busy: boolean;
  error: string;
  notice: string;
  onClose: () => void;
  onDownload: (activity: AchievementActivity, file: AchievementActivity["evidence"][number]) => void;
  onUpload: (activity: AchievementActivity, file: File) => void;
  onEdit: (activity: AchievementActivity) => void;
  onRemove: (activity: AchievementActivity) => void;
}) {
  const fileInput = React.useRef<HTMLInputElement>(null);
  const hasResult = activity?.measurableResult !== null && activity?.measurableResult !== undefined && activity?.measurableResult !== "";
  return <Dialog open={!!activity} onOpenChange={(_, data) => { if (!data.open && !busy) onClose(); }}>
    <DialogSurface className="max-h-[min(88vh,48rem)] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto"><DialogBody>
      <DialogTitle>{activity?.title ?? "Activity details"}</DialogTitle>
      {activity && <><DialogContent className="space-y-4">
        {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
        {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
        <div className="flex flex-wrap items-center gap-2"><Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>{displayPeriodDate(activity.activityDate.slice(0, 10))}</Text><ActivityProgressBadge status={activity.status} /></div>
        <Divider />
        <div><Text as="p" size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground2, display: "block" }}>WORK COMPLETED</Text><Text as="p" size={300} className="mt-1 whitespace-pre-wrap break-words leading-relaxed" style={{ display: "block" }}>{activity.details}</Text></div>
        {activity.comments && <div><Text as="p" size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground2, display: "block" }}>ADDITIONAL NOTE</Text><Text as="p" size={300} className="mt-1 whitespace-pre-wrap break-words leading-relaxed" style={{ display: "block" }}>{activity.comments}</Text></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card appearance="filled-alternative" className="p-4"><Target20Regular aria-hidden style={{ color: tokens.colorBrandForeground1 }} /><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2, display: "block" }}>Result for this activity</Text><Text as="p" size={300} weight="semibold" style={{ display: "block" }}>{hasResult ? formatActivityResult(activity.measurableResult, unit) : "No result entered"}</Text></Card>
          <Card appearance="filled-alternative" className="p-4"><Attach20Regular aria-hidden style={{ color: tokens.colorBrandForeground1 }} /><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2, display: "block" }}>Supporting files</Text>{activity.evidence.length ? <div className="flex flex-wrap gap-2">{activity.evidence.map((file) => <Button type="button" key={file.id} appearance="subtle" size="small" icon={<Document20Regular />} onClick={() => onDownload(activity, file)}>{file.fileName}</Button>)}</div> : <Text as="p" size={300} style={{ display: "block" }}>No files attached yet</Text>}</Card>
        </div>
        {canEdit && <div><input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label={`Attach evidence to ${activity.title}`} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onUpload(activity, file); event.currentTarget.value = ""; }} /><Button type="button" appearance="secondary" size="small" className="!whitespace-nowrap !px-3" icon={<ArrowUpload20Regular />} disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? "Uploading…" : "Attach evidence"}</Button><Text as="p" size={200} className="mt-1" style={{ color: tokens.colorNeutralForeground2, display: "block" }}>Documents or images up to 10 MB</Text></div>}
      </DialogContent>
      <DialogActions className="!flex !flex-row flex-wrap items-center justify-end gap-2 [&>button]:!min-w-0 [&>button]:!whitespace-nowrap [&>button]:!px-4"><Button type="button" appearance="secondary" onClick={onClose} disabled={busy}>Close</Button>{canEdit && <><Button type="button" appearance="subtle" icon={<Delete20Regular />} disabled={busy} onClick={() => onRemove(activity)}>Remove</Button><Button type="button" appearance="primary" icon={<Edit20Regular />} disabled={busy} onClick={() => onEdit(activity)}>Edit activity</Button></>}</DialogActions></>}
    </DialogBody></DialogSurface>
  </Dialog>;
}

function ActivityReadOnlyList({
  activities,
  achievementId,
  token,
  onError,
}: {
  activities: AchievementActivity[];
  achievementId: number;
  token: string;
  onError: (message: string) => void;
}) {
  if (!activities.length) return null;
  return <div className="my-3 space-y-3">
    {activities.map((activity) => <Card key={activity.id} appearance="filled-alternative" className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><Text weight="semibold">{displayPeriodDate(activity.activityDate.slice(0, 10))} · {activity.title}</Text><ActivityProgressBadge status={activity.status} /></div>
      <Text as="p" size={300} className="whitespace-pre-wrap">{activity.details}</Text>
      <Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Result: {activity.measurableResult === null || activity.measurableResult === undefined ? "Not entered" : formatActivityResult(activity.measurableResult)}{activity.comments ? ` · Note: ${activity.comments}` : ""}</Text>
      <div className="flex flex-wrap gap-2">{activity.evidence.map((file) => <Button key={file.id} appearance="subtle" size="small" icon={<Document20Regular />} onClick={() => void achievementApi.downloadActivityEvidence(token, achievementId, activity, file).catch((e: unknown) => onError(e instanceof Error ? e.message : "Download failed"))}>{file.fileName}</Button>)}</div>
    </Card>)}
  </div>;
}
