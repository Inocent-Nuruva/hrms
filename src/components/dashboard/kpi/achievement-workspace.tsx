"use client";

import { KpiFluentInput, KpiFluentTextarea } from "./kpi-fluent-fields";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiFeedback, KpiPageHeader } from "./kpi-page-elements";
import { KpiModeSelector, KpiWizardControls, KpiWizardProgress, type KpiEntryMode } from "./kpi-guided-flow";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { achievementApi, type Achievement } from "@/lib/achievement-api";
import { kpiApi, type KpiAssignment } from "@/lib/kpi-api";
import { achievementsEnabled, readKpiToken } from "@/lib/kpi-session";
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";
function format(value: unknown) {
  return value === null || value === undefined
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function parseActual(type: string, raw: string): unknown {
  if (!raw.trim()) return undefined;
  if (["numeric", "percentage", "currency", "duration"].includes(type)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("Enter a finite numeric actual");
    return n;
  }
  if (type === "binary") {
    if (!["true", "false"].includes(raw.toLowerCase()))
      throw new Error("Enter true or false");
    return raw.toLowerCase() === "true";
  }
  if (type === "milestone") {
    if (!["true", "false"].includes(raw.toLowerCase()))
      throw new Error("Enter true or false for completion");
    return { completed: raw.toLowerCase() === "true" };
  }
  return raw.trim();
}
function initialActual(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value && "completed" in value)
    return String(value.completed);
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

export function EmployeeAchievement({
  assignmentId,
}: {
  assignmentId: number;
}) {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [assignment, setAssignment] = React.useState<KpiAssignment | null>(
      null,
    ),
    [record, setRecord] = React.useState<Achievement | null>(null);
  const [actual, setActual] = React.useState(""),
    [comments, setComments] = React.useState(""),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const [entryMode, setEntryMode] = React.useState<KpiEntryMode>("choose");
  const [wizardStep, setWizardStep] = React.useState(0);
  const wizardSteps = [
    { title: "Review assignment", description: "Check the KPI, target, unit and reporting period." },
    { title: "Enter actual", description: "Record what was achieved, then save a draft." },
    { title: "Attach evidence", description: "Optional private supporting files can be added to the draft." },
    { title: "Review and submit", description: "Only submitted achievements enter manager review." },
  ];
  const loadSequence = React.useRef(0);
  const load = React.useCallback(async () => {
    if (!token || !achievementsEnabled) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const [assignments, records] = await Promise.all([
        kpiApi.mine(token),
        achievementApi.mine(token),
      ]);
      const item = assignments.find((row) => row.id === assignmentId);
      if (!item) throw new Error("This KPI is not directly assigned to you");
      if (sequence !== loadSequence.current) return;
      setAssignment(item);
      const found =
        records.find((row) => row.assignmentId === assignmentId) ?? null;
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
  const draft = record?.current?.status === "draft";
  const blockedAchievement = assignment?.status !== "active" ? "This KPI assignment is inactive." : !assignment.currentTarget ? "An authorized manager must configure the assignment target before achievement submission." : undefined;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  function enteredActual() {
    return parseActual(
      assignment?.definitionVersion?.measurementType ?? "",
      actual,
    );
  }
  function nextWizard() {
    if (wizardStep === 1 && (!record || !draft)) { setError("Save a draft before attaching evidence or submitting."); return; }
    setError(""); setWizardStep((current) => Math.min(current + 1, wizardSteps.length - 1));
  }
  async function upload(file: File) {
    if (!record) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Evidence must be 10 MB or smaller");
      return;
    }
    await action(
      async () =>
        achievementApi.upload(token, record.id, record.current.rowVersion, {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileString: await fileToBase64(file),
        }),
      "Evidence uploaded",
    );
  }
  if (!achievementsEnabled)
    return (
      <p className="p-6">
        Achievement submissions are disabled in this environment.
      </p>
    );
  return (
    <div className="space-y-4 pt-3">
      <KpiPageHeader title={assignment?.definitionVersion?.name ?? "KPI achievement"} description="Save an actual as a draft, add evidence, then submit it for manager review." actions={<Link className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted" href="/dashboard/me/kpi">Back to My KPIs</Link>} />
      <KpiWorkflowGuidancePanel recordKind="assignment" recordId={assignmentId} />
      {assignment && (!record || draft) && entryMode === "choose" && <KpiModeSelector title="Achievement" description="Review the target, record an actual, attach evidence and submit for review." onSelect={setEntryMode} blockedReason={blockedAchievement} owner="Authorized manager" />}
      {assignment && (!record || draft) && entryMode === "guided" && <KpiWizardProgress steps={wizardSteps} step={wizardStep} />}
      {assignment && <KpiFluentButton className="text-sm text-primary underline" disabled={loading || busy} onClick={() => void load()}>Refresh status</KpiFluentButton>}
      {loading && <p>Loading achievement…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
      {assignment && (
        <div className="rounded-lg border p-4 text-sm">
          <p>{assignment.definitionVersion?.description}</p>
          <p className="mt-2">
            <b>Period:</b> {assignment.period?.label} · <b>Target:</b>{" "}
            {format(assignment.currentTarget?.target)} · <b>Unit:</b>{" "}
            {assignment.definitionVersion?.measurementUnit ??
              assignment.definitionVersion?.measurementType}
          </p>
          <p className="mt-1">
            <b>Responsible manager:</b>{" "}
            {assignment.managerEmployeeId
              ? `Employee #${assignment.managerEmployeeId}`
              : "Not specified"}
          </p>
        </div>
      )}
      {assignment && !blockedAchievement && (!record || draft) && (entryMode === "manual" || (entryMode === "guided" && wizardStep === 1)) && (
        <form
          className="space-y-4 rounded-lg border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void action(
              () =>
                record
                  ? achievementApi.update(
                      token,
                      record.id,
                      record.current.rowVersion,
                      enteredActual(),
                      comments,
                    )
                  : achievementApi.create(
                      token,
                      assignmentId,
                      enteredActual(),
                      comments,
                    ),
              record ? "Draft saved" : "Draft created",
            );
          }}
        >
          <h2 className="font-semibold">
            {record ? "Edit draft" : "Record achievement"}
          </h2>
          <label className="block text-sm">
            Actual achievement
            {["binary", "milestone"].includes(
              assignment.definitionVersion.measurementType,
            )
              ? " (true or false)"
              : ""}
            <KpiFluentInput
              className={inputClass}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              aria-label="Actual achievement"
              placeholder={
                assignment.definitionVersion.measurementType === "qualitative"
                  ? "Configured rubric rating"
                  : "Enter actual"
              }
            />
          </label>
          <label className="block text-sm">
            Supporting comments
            <KpiFluentTextarea
              className={inputClass}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              maxLength={4000}
            />
          </label>
          <KpiFluentButton
            className="rounded bg-[var(--primary)] px-4 py-2 text-sm text-white"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save draft"}
          </KpiFluentButton>
        </form>
      )}
      {record && (entryMode !== "guided" || wizardStep >= 2) && (
        <section className="space-y-3 rounded-lg border p-4 text-sm">
          <h2 className="font-semibold">Current submission</h2>
          <p>
            Status: <b>{record.current.status.replaceAll("_", " ")}</b> ·
            Revision {record.current.revision}
          </p>
          <p>
            Actual: {format(record.current.actual)} · Comments:{" "}
            {record.current.comments || "—"}
          </p>
          <p>Manager feedback: {record.current.reviewComment || "—"}</p>
          {draft && (
            <>
              <label className="block">
                Attach private evidence
                <KpiFluentInput
                  type="file"
                  className="mt-1 block"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt"
                  disabled={busy || !!blockedAchievement}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </label>
              {entryMode === "manual" && <KpiFluentButton
                className="rounded bg-[var(--primary)] px-4 py-2 text-white"
                disabled={busy || !!blockedAchievement}
                onClick={() =>
                  void action(
                    () =>
                      achievementApi.submit(
                        token,
                        record.id,
                        record.current.rowVersion,
                      ),
                    "Achievement submitted for review",
                  )
                }
              >
                Submit for review
              </KpiFluentButton>}
            </>
          )}
          {["returned", "rejected"].includes(record.current.status) && (
            <KpiFluentButton
              className="rounded bg-[var(--primary)] px-4 py-2 text-white"
              disabled={busy || !!blockedAchievement}
              onClick={() =>
                void action(
                  () => achievementApi.create(token, assignmentId),
                  "Correction draft created",
                )
              }
            >
              Prepare correction
            </KpiFluentButton>
          )}
        </section>
      )}
      {assignment && !blockedAchievement && (!record || draft) && entryMode === "guided" && <KpiWizardControls steps={wizardSteps} step={wizardStep} busy={busy} error={error} onBack={() => setWizardStep((current) => current - 1)} onNext={nextWizard} onCancel={() => setEntryMode("choose")} onFinish={() => { if (record && draft) void action(() => achievementApi.submit(token, record.id, record.current.rowVersion), "Achievement submitted for review") }} finishLabel="Submit for review" confirmFinish />}
      {record && (
        <section className="space-y-3 rounded-lg border p-4 text-sm">
          <h2 className="font-semibold">Revision and decision history</h2>
          {record.revisions.map((revision) => (
            <div className="rounded border p-3" key={revision.id}>
              <p>
                Revision {revision.revision} · {revision.effectiveStatus} ·
                Actual: {format(revision.actual)}
              </p>
              <p>Feedback: {revision.reviewComment || "—"}</p>
              {revision.evidence.map((evidence) => (
                <KpiFluentButton
                  key={evidence.id}
                  className="block text-primary underline"
                  onClick={() =>
                    void achievementApi
                      .download(token, record.id, evidence)
                      .catch((e: unknown) =>
                        setError(
                          e instanceof Error ? e.message : "Download failed",
                        ),
                      )
                  }
                >
                  {evidence.fileName}
                </KpiFluentButton>
              ))}
            </div>
          ))}
          <h3 className="font-medium">Audit events</h3>
          {record.history.map((event) => (
            <p key={event.id}>
              {new Date(event.createdAt).toLocaleString()} ·{" "}
              {event.action.replaceAll("_", " ")} · user #{event.actorId}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
