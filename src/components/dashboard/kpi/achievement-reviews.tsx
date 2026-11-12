"use client";

import { Button, MessageBar, MessageBarBody, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import { KpiFluentInput, KpiFluentSelect, KpiFluentTextarea } from "./kpi-fluent-fields";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { achievementApi, type Achievement } from "@/lib/achievement-api";
import { achievementsEnabled, readKpiToken } from "@/lib/kpi-session";
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance";

const input =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";
function text(value: unknown) {
  return value === null || value === undefined
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}

export function AchievementReviews() {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [rows, setRows] = React.useState<Achievement[]>([]),
    [status, setStatus] = React.useState(""),
    [employee, setEmployee] = React.useState(""),
    [department, setDepartment] = React.useState(""),
    [branch, setBranch] = React.useState(""),
    [period, setPeriod] = React.useState("");
  const [loading, setLoading] = React.useState(true),
    [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!actor.ready || !token || !achievementsEnabled) return;
    void achievementApi
      .pending(token, status)
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load reviews"),
      )
      .finally(() => setLoading(false));
  }, [actor.ready, token, status]);
  const filtered = rows.filter(
    (row) =>
      (!employee || String(row.assignment.subjectId).includes(employee)) &&
      (!department || String(row.assignment.organizationSnapshot?.departmentId) === department) &&
      (!branch || String(row.assignment.organizationSnapshot?.branchId) === branch) &&
      (!period || String(row.assignment.periodId) === period),
  );
  if (!achievementsEnabled)
    return <p className="p-6">KPI reviews are disabled in this environment.</p>;
  return (
    <div className="space-y-4 pt-3">
      <KpiPageHeader title="Achievement Reviews" description="Review submitted actuals and evidence before they contribute to scorecards." actions={<span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground">{rows.filter((row) => ["submitted", "under_review"].includes(row.current.status)).length} pending</span>} />
      <KpiWorkflowGuidancePanel compact />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          Status
          <KpiFluentSelect
            className={input}
            value={status}
            onChange={(e) => {
              setLoading(true);
              setStatus(e.target.value);
            }}
          >
            <option value="">Pending</option>
            {[
              "submitted",
              "under_review",
              "approved",
              "returned",
              "rejected",
            ].map((value) => (
              <option value={value} key={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </KpiFluentSelect>
        </label>
        <label className="text-sm">
          Employee ID
          <KpiFluentInput
            className={input}
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Department ID
          <KpiFluentInput className={input} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </label>
        <label className="text-sm">
          Branch ID
          <KpiFluentInput className={input} value={branch} onChange={(e) => setBranch(e.target.value)} />
        </label>
        <label className="text-sm">
          Period ID
          <KpiFluentInput
            className={input}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
      </div>
      {loading && <p>Loading submissions…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {!loading && filtered.length === 0 && (
        <p className="rounded border p-4 text-sm">
          No matching KPI submissions.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <Table className="w-full text-left text-sm">
          <TableHeader>
            <TableRow className="border-b">
              <TableHeaderCell className="p-3">KPI</TableHeaderCell>
              <TableHeaderCell className="p-3">Employee / subject</TableHeaderCell>
              <TableHeaderCell className="p-3">Period</TableHeaderCell>
              <TableHeaderCell className="p-3">Actual</TableHeaderCell>
              <TableHeaderCell className="p-3">Status</TableHeaderCell>
              <TableHeaderCell className="p-3">Action</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow className="border-b" key={row.id}>
                <TableCell className="p-3">
                  {row.assignment.definitionVersion?.name ??
                    `Assignment #${row.assignmentId}`}
                </TableCell>
                <TableCell className="p-3">
                  {row.assignment.subjectType} #{row.assignment.subjectId}
                </TableCell>
                <TableCell className="p-3">
                  {row.assignment.period?.label ?? row.assignment.periodId}
                </TableCell>
                <TableCell className="p-3">{text(row.current.actual)}</TableCell>
                <TableCell className="p-3">
                  <KpiStatusBadge status={row.current.status} />
                </TableCell>
                <TableCell className="p-3">
                  <Link
                    className="text-primary underline"
                    href={`/dashboard/kpi/reviews/${row.id}`}
                  >
                    Review
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function AchievementReviewDetail({ id }: { id: number }) {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [record, setRecord] = React.useState<Achievement | null>(null),
    [comments, setComments] = React.useState(""),
    [loading, setLoading] = React.useState(true),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  React.useEffect(() => {
    if (!actor.ready || !token || !achievementsEnabled) return;
    void achievementApi
      .get(token, id)
      .then(setRecord)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load submission"),
      )
      .finally(() => setLoading(false));
  }, [actor.ready, token, id]);
  async function action(task: () => Promise<Achievement>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await task();
      setRecord(result);
      setNotice(message);
      window.dispatchEvent(new Event("hrms:refresh-page-data"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }
  if (!achievementsEnabled)
    return <p className="p-6">KPI reviews are disabled in this environment.</p>;
  return (
    <div className="space-y-4 pt-3">
      <KpiPageHeader title="Review KPI Achievement" description="Check the submitted actual, evidence and history before recording a decision." actions={<Button as="a" href="/dashboard/kpi/reviews" appearance="secondary">Back to Reviews</Button>} />
      <KpiWorkflowGuidancePanel recordKind="achievement" recordId={id} />
      {loading && <p>Loading submission…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {notice && <KpiFeedback intent="success">{notice}</KpiFeedback>}
      {record && (
        <>
          <div className="rounded-lg border p-4 text-sm">
            <h2 className="font-semibold">
              {record.assignment.definitionVersion?.name}
            </h2>
            <p>
              Employee / subject: {record.assignment.subjectType} #
              {record.assignment.subjectId} · Period:{" "}
              {record.assignment.period?.label}
            </p>
            <p>
              Target: {text(record.assignment.currentTarget?.target)} · Actual:{" "}
              {text(record.current.actual)}
            </p>
            <p>
              Revision {record.current.revision} ·{" "}
              {record.current.status.replaceAll("_", " ")}
            </p>
            <p>Employee comments: {record.current.comments || "—"}</p>
          </div>
          <section className="space-y-2 rounded-lg border p-4 text-sm">
            <h2 className="font-semibold">Evidence</h2>
            {record.current.evidence.length === 0 && (
              <p>No evidence attached.</p>
            )}
            {record.current.evidence.map((file) => (
              <KpiFluentButton
                key={file.id}
                className="block text-primary underline"
                onClick={() =>
                  void achievementApi
                    .download(token, id, file)
                    .catch((e: unknown) =>
                      setError(
                        e instanceof Error ? e.message : "Download failed",
                      ),
                    )
                }
              >
                {file.fileName} · {(file.fileSize / 1024).toFixed(1)} KB
              </KpiFluentButton>
            ))}
          </section>
          {["submitted", "under_review"].includes(record.current.status) && (
            <section className="space-y-3 rounded-lg border p-4 text-sm">
              <h2 className="font-semibold">Decision</h2>
              <MessageBar intent="info"><MessageBarBody>Check the target, actual, evidence and revision history. Approve only when the submitted result is supported; a return or rejection requires feedback.</MessageBarBody></MessageBar>
              <label className="block">
                Review comments
                <KpiFluentTextarea
                  className={`${input} w-full`}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  maxLength={4000}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {record.current.status === "submitted" && (
                  <KpiFluentButton
                    className="rounded border px-3 py-2"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () =>
                          achievementApi.review(
                            token,
                            id,
                            record.current.rowVersion,
                          ),
                        "Review started",
                      )
                    }
                  >
                    Start review
                  </KpiFluentButton>
                )}
                <KpiFluentButton
                  className="rounded bg-green-700 px-3 py-2 text-white"
                  disabled={busy}
                  onClick={() =>
                    void fluentConfirm("Approve this KPI achievement? The approved result will become eligible for scorecard calculation.").then((confirmed) => { if (confirmed) void action(
                      () =>
                        achievementApi.decide(
                          token,
                          id,
                          "approve",
                          record.current.rowVersion,
                          comments,
                        ),
                      "Achievement approved",
                    ) })
                  }
                >
                  Approve
                </KpiFluentButton>
                <KpiFluentButton
                  className="rounded border px-3 py-2"
                  disabled={busy || !comments.trim()}
                  onClick={() =>
                    void action(
                      () =>
                        achievementApi.decide(
                          token,
                          id,
                          "return",
                          record.current.rowVersion,
                          comments,
                        ),
                      "Returned for correction",
                    )
                  }
                >
                  Return for correction
                </KpiFluentButton>
                <KpiFluentButton
                  className="rounded border px-3 py-2 text-red-700"
                  disabled={busy || !comments.trim()}
                  onClick={() =>
                    void action(
                      () =>
                        achievementApi.decide(
                          token,
                          id,
                          "reject",
                          record.current.rowVersion,
                          comments,
                        ),
                      "Achievement rejected",
                    )
                  }
                >
                  Reject
                </KpiFluentButton>
              </div>
            </section>
          )}
          {record.current.status === "approved" && (
            <KpiFluentButton
              className="rounded border px-3 py-2 text-sm"
              disabled={busy}
              onClick={() =>
                void action(
                  () => achievementApi.correction(token, id),
                  "Audited correction draft opened",
                )
              }
            >
              Open approved correction
            </KpiFluentButton>
          )}
          <section className="space-y-2 rounded-lg border p-4 text-sm">
            <h2 className="font-semibold">Revision history</h2>
            {record.revisions.map((revision) => (
              <p key={revision.id}>
                Revision {revision.revision}: {revision.effectiveStatus} ·
                actual {text(revision.actual)} · feedback{" "}
                {revision.reviewComment || "—"}
              </p>
            ))}
            <h3 className="font-medium">Audit events</h3>
            {record.history.map((event) => (
              <p key={event.id}>
                {new Date(event.createdAt).toLocaleString()} ·{" "}
                {event.action.replaceAll("_", " ")} · user #{event.actorId}
              </p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
