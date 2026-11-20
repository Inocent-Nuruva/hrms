"use client";

import {
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  tokens,
} from "@fluentui/react-components";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { achievementApi, type Achievement, type AchievementActivity } from "@/lib/achievement-api";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { achievementsEnabled, readKpiToken } from "@/lib/kpi-session";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import { KpiFluentInput, KpiFluentTextarea } from "./kpi-fluent-fields";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import { ArrowRight20Regular, CalendarLtr24Regular, DocumentBulletList20Regular, Edit20Regular } from "@fluentui/react-icons";

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
function displayPeriodDate(value?: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${Number(match[3])} ${months[month - 1]} ${match[1]}` : value;
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
  const [record, setRecord] = React.useState<Achievement | null>(null);
  const [actual, setActual] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [modePickerOpen, setModePickerOpen] = React.useState(false);
  const [flowStep, setFlowStep] = React.useState<AchievementFlowStep>("mode");
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [editingActivity, setEditingActivity] = React.useState<AchievementActivity | null>(null);
  const [activityForm, setActivityForm] = React.useState<ActivityForm>(emptyActivity);
  const [activityEvidenceFile, setActivityEvidenceFile] = React.useState<File | null>(null);
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
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
      const found = records.find((row) => row.assignmentId === assignmentId) ?? null;
      setRecord(found);
      setActual(initialActual(found?.current?.actual));
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
  const blockedAchievement = assignment?.status !== "active"
    ? "This KPI assignment is inactive."
    : !assignment.currentTarget
      ? "An authorized manager must configure the assignment target before achievement submission."
      : undefined;
  const canEditDraft = draft && !blockedAchievement;
  const measurementType = assignment?.definitionVersion?.measurementType ?? "numeric";
  const activities = record?.current?.activities ?? [];

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
    if (!record) return;
    const confirmed = await fluentConfirm(`Remove “${activity.title}” from this draft? Its evidence will also be removed unless another revision retains a reference.`, {
      title: "Remove activity",
      confirmLabel: "Remove activity",
    });
    if (!confirmed) return;
    await action(() => achievementApi.removeActivity(token, record.id, activity.id, activity.rowVersion), "Activity removed");
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
  async function prepareSubmission() {
    if (!assignment) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const submittedActual = enteredActual();
      if (submittedActual === undefined || actual.trim() === "") {
        throw new Error("Enter the final actual achievement before requesting review.");
      }
      const latest = record
        ? await achievementApi.update(token, record.id, record.current.rowVersion, submittedActual, comments)
        : await achievementApi.create(token, assignmentId, submittedActual, comments);
      setRecord(latest);
      setActual(initialActual(latest.current.actual));
      setComments(latest.current.comments ?? "");
      setConfirmSubmit(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare the submission");
    } finally {
      setBusy(false);
    }
  }

  if (!achievementsEnabled) return <p className="p-6">Achievement submissions are disabled in this environment.</p>;

  return (
    <div className="space-y-4 pt-3">
      <KpiPageHeader
        title={assignment?.definitionVersion?.name ?? "KPI achievement"}
        description={undefined}
        variant="plain"
        titleFontFamily="var(--font-fredoka)"
        titleSize={800}
        actions={<Button onClick={() => router.push("/dashboard/me/kpi")} appearance="secondary" size="medium">Back to My KPIs</Button>}
      />
      {assignment && <div className="flex flex-wrap items-center gap-3" aria-label="Reporting period dates"><CalendarLtr24Regular aria-hidden style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} /><Text as="span" size={700} weight="semibold" style={{ color: tokens.colorNeutralForeground1, fontFamily: "var(--font-fredoka)", lineHeight: 1.1 }}>{displayPeriodDate(assignment.period?.startDate)}</Text><ArrowRight20Regular aria-hidden style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} /><Text as="span" size={700} weight="semibold" style={{ color: tokens.colorNeutralForeground1, fontFamily: "var(--font-fredoka)", lineHeight: 1.1 }}>{displayPeriodDate(assignment.period?.endDate)}</Text></div>}
      {assignment?.definitionVersion?.description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{assignment.definitionVersion.description}</p>}
      <hr className="border-0 border-t" style={{ borderColor: tokens.colorNeutralStroke2 }} />
      {loading && <p>Loading achievement…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
      {blockedAchievement && <KpiFeedback intent="warning">{blockedAchievement}</KpiFeedback>}
      {assignment?.status !== "active" && assignment && <section className="space-y-3 rounded-xl border p-4" aria-label="Inactive assignment history">
        <h2 className="font-semibold">Assignment history</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Reporting period</dt><dd className="font-medium">{assignment.period?.label} · {displayPeriodDate(assignment.period?.startDate)} – {displayPeriodDate(assignment.period?.endDate)}</dd></div><div><dt className="text-muted-foreground">Final target</dt><dd className="font-medium">{format(assignment.currentTarget?.target)}{assignment.definitionVersion?.measurementUnit ? ` ${assignment.definitionVersion.measurementUnit}` : ""}</dd></div></dl>
        {!!assignment.targetHistory?.length && <div className="space-y-2 border-t pt-3"><h3 className="text-sm font-medium">Target changes</h3>{assignment.targetHistory.map((item) => <p key={item.revision} className="text-sm text-muted-foreground">Revision {item.revision} · {format(item.target)}{assignment.definitionVersion?.measurementUnit ? ` ${assignment.definitionVersion.measurementUnit}` : ""} · {item.reason} · {new Date(item.changedAt).toLocaleString()}</p>)}</div>}
      </section>}
      {assignment && <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" aria-label="KPI activity list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Activity records <span className="ml-1 text-base font-normal text-muted-foreground">({activities.length})</span></h2><p className="text-sm text-muted-foreground">{assignment.period?.label}</p></div>
          <KpiStatusBadge status={record?.current.status ?? assignment.status} />
        </div>
        {canEditDraft && <div className="flex flex-wrap gap-2 border-b pb-4">
          <Button type="button" appearance="secondary" onClick={openActivityForm}>Add Activity</Button>
          <Button type="button" appearance="primary" onClick={() => { setFlowStep("mode"); setModePickerOpen(true); }}>Submit Achievement</Button>
          <Button type="button" appearance="secondary" disabled={busy || !actual.trim()} onClick={() => void prepareSubmission()}>{busy ? "Preparing…" : "Review & Submit"}</Button>
        </div>}
        {record && !draft && <div className="space-y-2 border-b pb-4 text-sm">
          <p>Final actual: <b>{format(record.current.actual)}{assignment.definitionVersion?.measurementUnit ? ` ${assignment.definitionVersion.measurementUnit}` : ""}</b> · Revision {record.current.revision}</p>
          {record.current.reviewComment && <p>Manager feedback: {record.current.reviewComment}</p>}
          {record.current.evidence.map((evidence) => <Button key={evidence.id} appearance="subtle" onClick={() => void achievementApi.download(token, record.id, evidence).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>{evidence.fileName}</Button>)}
          {["returned", "rejected"].includes(record.current.status) && <Button appearance="primary" disabled={busy} onClick={() => void action(() => achievementApi.create(token, assignmentId), "Correction draft created")}>Prepare correction</Button>}
        </div>}
        {activities.length === 0 ? <div className="py-8 text-center"><p className="font-medium">No activity records</p><p className="mt-1 text-sm text-muted-foreground">{assignment.status === "active" ? "Use Add Activity to record work, or Submit Achievement to enter a final result." : "No activities were recorded for this inactive assignment. Achievement revisions and review events, when present, are listed below."}</p></div> : <>
          <div className="space-y-2 md:hidden">{activities.map((activity) => <Card key={activity.id} appearance="outline" className="space-y-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{displayPeriodDate(activity.activityDate.slice(0, 10))}</p><h3 className="font-medium">{activity.title}</h3></div><KpiStatusBadge status={activity.status} /></div>
            <details><summary className="cursor-pointer text-sm">View work details</summary><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{activity.details}</p>{activity.comments && <p className="mt-1 text-sm">{activity.comments}</p>}</details>
            <p className="text-sm"><span className="font-medium">Result:</span> {formatActivityResult(activity.measurableResult, assignment.definitionVersion?.measurementUnit)}</p>
            <div className="flex flex-wrap items-center gap-2">{activity.evidence.map((file) => <Button type="button" key={file.id} appearance="subtle" size="small" onClick={() => void achievementApi.downloadActivityEvidence(token, record!.id, activity, file).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>{file.fileName}</Button>)}{canEditDraft && record && <KpiFluentInput type="file" aria-label={`Attach evidence to ${activity.title}`} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadActivityFile(activity, file); event.currentTarget.value = ""; }} />}</div>
            {canEditDraft && <div className="flex gap-2"><Button type="button" appearance="subtle" size="small" onClick={() => { setEditingActivity(activity); setActivityForm({ activityDate: activity.activityDate.slice(0, 10), title: activity.title, details: activity.details, measurableResult: activityResultInput(activity.measurableResult), comments: activity.comments ?? "" }); setActivityEvidenceFile(null); setActivityFormError(""); setActivityOpen(true); }}>Edit</Button><Button type="button" appearance="subtle" size="small" onClick={() => void removeActivity(activity)}>Remove</Button></div>}
          </Card>)}</div>
          <div className="hidden overflow-x-auto md:block"><Table aria-label="Recorded KPI activities" className="w-full min-w-[560px]"><TableHeader><TableRow><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Activity</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell className="text-right">Result</TableHeaderCell><TableHeaderCell>Evidence and actions</TableHeaderCell></TableRow></TableHeader><TableBody>{activities.map((activity) => <TableRow key={activity.id}>
            <TableCell className="whitespace-nowrap">{new Date(`${activity.activityDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</TableCell>
            <TableCell><details className="max-w-xl"><summary className="cursor-pointer font-medium">{activity.title}</summary><div className="mt-2 space-y-2 text-sm"><p className="whitespace-pre-wrap text-muted-foreground">{activity.details}</p>{activity.comments && <p>Note: {activity.comments}</p>}</div></details></TableCell>
            <TableCell><KpiStatusBadge status={activity.status} /></TableCell><TableCell className="text-right tabular-nums">{formatActivityResult(activity.measurableResult, assignment.definitionVersion?.measurementUnit)}</TableCell>
            <TableCell><div className="flex flex-wrap items-center gap-1">{activity.evidence.map((file) => <Button type="button" key={file.id} appearance="subtle" size="small" onClick={() => void achievementApi.downloadActivityEvidence(token, record!.id, activity, file).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>{file.fileName}</Button>)}{canEditDraft && record && <KpiFluentInput type="file" aria-label={`Attach evidence to ${activity.title}`} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadActivityFile(activity, file); event.currentTarget.value = ""; }} />}{canEditDraft && <><Button type="button" appearance="subtle" size="small" onClick={() => { setEditingActivity(activity); setActivityForm({ activityDate: activity.activityDate.slice(0, 10), title: activity.title, details: activity.details, measurableResult: activityResultInput(activity.measurableResult), comments: activity.comments ?? "" }); setActivityEvidenceFile(null); setActivityFormError(""); setActivityOpen(true); }}>Edit</Button><Button type="button" appearance="subtle" size="small" onClick={() => void removeActivity(activity)}>Remove</Button></>}</div>{!activity.evidence.length && <p className="text-xs text-muted-foreground">No evidence attached</p>}</TableCell>
          </TableRow>)}</TableBody></Table></div>
        </>}
      </section>}

      {record && <section className="space-y-3 rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">Revision and activity history</h2>
        {record.revisions.map((revision) => (
          <details className="rounded-lg border p-3" key={revision.id} open={revision.id === record.current.id}>
            <summary className="cursor-pointer font-medium">Revision {revision.revision} · {revision.effectiveStatus} · Actual: {format(revision.actual)}</summary>
            <p className="mt-2">Feedback: {revision.reviewComment || "—"}</p>
            <ActivityReadOnlyList activities={revision.activities ?? []} achievementId={record.id} token={token} onError={setError} />
            {revision.evidence.map((evidence) => <Button key={evidence.id} appearance="subtle" onClick={() => void achievementApi.download(token, record.id, evidence).catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))}>{evidence.fileName}</Button>)}
          </details>
        ))}
        <h3 className="font-medium">Audit events</h3>
        {record.history.map((event) => <p key={event.id}>{new Date(event.createdAt).toLocaleString()} · {event.action.replaceAll("_", " ")} · user #{event.actorId}</p>)}
      </section>}

      <Dialog open={modePickerOpen} onOpenChange={(_, data) => { if (!busy) setModePickerOpen(data.open); }}>
        <DialogSurface className="max-h-[min(88vh,52rem)] w-[min(46rem,calc(100vw-2rem))] overflow-y-auto"><DialogBody>
          <DialogTitle>{flowStep === "mode" ? "Record achievement" : flowStep === "quick" ? "Quick Entry" : flowStep === "activities" ? "Detailed Activity Log" : editingActivity ? "Edit activity" : "Add activity"}</DialogTitle>
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
              <div className="grid gap-3 sm:grid-cols-2"><Field label={`Final actual achievement${assignment!.definitionVersion?.measurementUnit ? ` (${assignment!.definitionVersion.measurementUnit})` : ""}`} required><KpiFluentInput value={actual} onChange={(event) => setActual(event.target.value)} placeholder="Enter the reporting-period result" /></Field><Field label="Supporting comments"><KpiFluentTextarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={4000} rows={3} /></Field></div>
            </DialogContent>
            <DialogActions><Button appearance="secondary" onClick={() => setFlowStep("mode")}>Back</Button><Button appearance="secondary" disabled={busy} onClick={() => { setModePickerOpen(false); void action(() => record ? achievementApi.update(token, record.id, record.current.rowVersion, enteredActual(), comments) : achievementApi.create(token, assignmentId, enteredActual(), comments), "Draft saved"); }}>Save draft</Button><Button appearance="primary" disabled={busy || !actual.trim()} onClick={() => { setModePickerOpen(false); void prepareSubmission(); }}>Review &amp; Submit</Button></DialogActions>
          </>}
          {flowStep === "activities" && <>
            <DialogContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{assignment!.definitionVersion?.name} · {assignment!.period?.label}. Activity results support your final actual; they are not automatically aggregated for this KPI.</p>
              <div className="grid gap-3 sm:grid-cols-2"><Card appearance="filled-alternative" className="p-3"><p className="text-sm text-muted-foreground">Target</p><p className="text-2xl font-bold text-sky-700 dark:text-sky-300">{formatTarget(assignment!.currentTarget?.target ?? null, assignment!.definitionVersion?.measurementUnit)}</p></Card><Card appearance="filled-alternative" className="p-3"><p className="text-sm text-muted-foreground">Recorded actual</p><p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{actual.trim() ? `${actual} ${assignment!.definitionVersion?.measurementUnit ?? ""}` : "—"}</p></Card></div>
              <div className="flex items-center justify-between"><h3 className="font-semibold">Activity records</h3><span className="text-sm text-muted-foreground">{activities.length} recorded</span></div>
              {activities.length ? <Card appearance="outline" className="overflow-x-auto"><Table aria-label="Activity records" className="w-full min-w-[32rem]"><TableHeader><TableRow><TableHeaderCell>Date</TableHeaderCell><TableHeaderCell>Activity</TableHeaderCell><TableHeaderCell className="text-right">Result</TableHeaderCell></TableRow></TableHeader><TableBody>{activities.map((activity) => <TableRow key={activity.id}><TableCell>{new Date(`${activity.activityDate}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</TableCell><TableCell><details><summary className="cursor-pointer font-medium">{activity.title}</summary><p className="mt-1 text-sm text-muted-foreground">{activity.details}</p></details></TableCell><TableCell className="text-right">{formatActivityResult(activity.measurableResult, assignment!.definitionVersion?.measurementUnit)}</TableCell></TableRow>)}</TableBody></Table></Card> : <Card appearance="outline" className="p-4 text-center text-sm text-muted-foreground">No activity records yet. Add your first activity to begin.</Card>}
            </DialogContent>
            <DialogActions className="flex flex-wrap items-center justify-end gap-2"><Button size="medium" className="!min-w-24 !whitespace-nowrap" appearance="secondary" onClick={() => setFlowStep("mode")}>Back</Button><Button size="medium" className="!min-w-36 !whitespace-nowrap" appearance="secondary" onClick={openActivityForm}>+ Add Activity</Button><Button size="medium" className="!min-w-40 !whitespace-nowrap" appearance="primary" disabled={busy || !actual.trim()} onClick={() => { setModePickerOpen(false); void prepareSubmission(); }}>Submit Achievement</Button></DialogActions>
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
      <Dialog open={confirmSubmit} onOpenChange={(_, data) => setConfirmSubmit(data.open)}>
        <DialogSurface><DialogBody>
          <DialogTitle>Review achievement submission</DialogTitle>
          <DialogContent className="space-y-3 text-sm">
            <p><b>KPI:</b> {assignment?.definitionVersion?.name}</p>
            <p><b>Reporting period:</b> {assignment?.period?.label}</p>
            <p><b>Target:</b> {formatTarget(assignment?.currentTarget?.target ?? null, assignment?.definitionVersion?.measurementUnit)}</p>
            <p><b>Final actual:</b> {format(record?.current.actual)}{assignment?.definitionVersion?.measurementUnit ? ` ${assignment.definitionVersion.measurementUnit}` : ""}</p>
            <p><b>Supporting comments:</b> {record?.current.comments || "—"}</p>
            <p><b>Recorded activities:</b> {activities.length} · {activities.reduce((sum, activity) => sum + activity.evidence.length, 0)} activity evidence files · {record?.current.evidence.length ?? 0} submission evidence files</p>
            {record?.current.evidence.map((evidence) => <p key={evidence.id} className="text-xs text-muted-foreground">Submission evidence: {evidence.fileName}</p>)}
            {activities.map((activity) => <div key={activity.id} className="rounded border p-2"><b>{activity.activityDate} · {activity.title}</b><p className="mt-1 whitespace-pre-wrap">{activity.details}</p><span className="text-muted-foreground">Result: {format(activity.measurableResult)} · {activity.evidence.length} evidence files</span>{activity.evidence.map((file) => <p key={file.id} className="text-xs text-muted-foreground">{file.fileName}</p>)}</div>)}
            <KpiFeedback intent="info">Submitting freezes this revision for manager review. The scorecard changes only after approval.</KpiFeedback>
          </DialogContent>
          <DialogActions><Button appearance="secondary" disabled={busy} onClick={() => setConfirmSubmit(false)}>Continue editing</Button><Button appearance="primary" disabled={busy || !record} onClick={() => { setConfirmSubmit(false); if (record) void action(() => achievementApi.submit(token, record.id, record.current.rowVersion), "Achievement submitted for review"); }}>{busy ? "Submitting…" : "Submit for manager review"}</Button></DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </div>
  );
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
  return <div className="my-3 space-y-2 border-l-2 border-primary/30 pl-3">
    {activities.map((activity) => <div key={activity.id} className="rounded-md bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{activity.activityDate} · {activity.title}</p><KpiStatusBadge status={activity.status} /></div>
      <p className="mt-1 whitespace-pre-wrap">{activity.details}</p>
      <p className="mt-1 text-muted-foreground">Measured result: {formatActivityResult(activity.measurableResult)} · Comments: {activity.comments || "—"}</p>
      {activity.evidence.map((file) => <Button key={file.id} appearance="subtle" size="small" onClick={() => void achievementApi.downloadActivityEvidence(token, achievementId, activity, file).catch((e: unknown) => onError(e instanceof Error ? e.message : "Download failed"))}>{file.fileName}</Button>)}
      {!activity.evidence.length && <span className="text-xs text-muted-foreground">No evidence attached</span>}
    </div>)}
  </div>;
}
