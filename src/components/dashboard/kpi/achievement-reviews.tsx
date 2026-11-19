"use client";

import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Dropdown, MessageBar, MessageBarBody, Option, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import { KpiFluentTextarea } from "./kpi-fluent-fields";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { achievementApi, type Achievement, type AchievementActivity } from "@/lib/achievement-api";
import { achievementsEnabled, readKpiToken } from "@/lib/kpi-session";
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance";
import { listBranches, listDepartments, listEmployees, type AdminRecord } from "@/lib/admin-api";
import { kpiApi } from "@/lib/kpi-api";
import { KpiSearchSelect, type KpiChoice } from "./kpi-search-select";

const input =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";
type AdvancedReviewFilters = { employee: string; department: string; branch: string; period: string };
const emptyAdvancedFilters: AdvancedReviewFilters = { employee: "", department: "", branch: "", period: "" };
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
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [draftFilters, setDraftFilters] = React.useState<AdvancedReviewFilters>(emptyAdvancedFilters);
  React.useEffect(() => {
    if (!actor.ready || !token || !achievementsEnabled) return;
    void achievementApi
      .pending(token, status)
      .then((result) => { setRows(result); setError(""); })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load reviews"),
      )
      .finally(() => setLoading(false));
  }, [actor.ready, token, status]);
  const loadEmployees = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await listEmployees(token, { limit: 100, search });
    return result.rows.map((row: AdminRecord) => ({ id: Number(row.id), label: [row.first_name ?? row.firstName, row.last_name ?? row.lastName].filter(Boolean).join(" ") || String(row.name ?? row.email ?? `Employee #${row.id}`) })).filter((choice) => Number.isInteger(choice.id));
  }, [token]);
  const loadDepartments = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await listDepartments(token, { limit: 100, search });
    return result.rows.map((row: AdminRecord) => ({ id: Number(row.id), label: String(row.name ?? `Department #${row.id}`) })).filter((choice) => Number.isInteger(choice.id));
  }, [token]);
  const loadBranches = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await listBranches(token, { limit: 100, search });
    return result.rows.map((row: AdminRecord) => ({ id: Number(row.id), label: String(row.name ?? `Branch #${row.id}`) })).filter((choice) => Number.isInteger(choice.id));
  }, [token]);
  const loadPeriods = React.useCallback(async (search: string): Promise<KpiChoice[]> => {
    const result = await kpiApi.periods(token);
    return result.filter((row) => row.label.toLowerCase().includes(search.toLowerCase())).map((row) => ({ id: row.id, label: row.label }));
  }, [token]);
  const filtered = rows.filter(
    (row) =>
      (!employee || String(row.assignment.subjectId) === employee) &&
      (!department || String(row.assignment.organizationSnapshot?.departmentId) === department) &&
      (!branch || String(row.assignment.organizationSnapshot?.branchId) === branch) &&
      (!period || String(row.assignment.periodId) === period),
  );
  const advancedFilterCount = [employee, department, branch, period].filter(Boolean).length;
  function openAdvancedFilters() {
    setDraftFilters({ employee, department, branch, period });
    setFiltersOpen(true);
  }
  function applyAdvancedFilters() {
    setEmployee(draftFilters.employee);
    setDepartment(draftFilters.department);
    setBranch(draftFilters.branch);
    setPeriod(draftFilters.period);
    setFiltersOpen(false);
  }
  if (!achievementsEnabled)
    return <p className="p-6">KPI reviews are disabled in this environment.</p>;
  return (
    <div className="space-y-4 pt-3">
      <KpiPageHeader title="Achievement Reviews" description="Check submitted results and evidence before approving them." actions={<span className="rounded-full border border-white/30 px-3 py-1 text-sm text-white">{rows.filter((row) => ["submitted", "under_review"].includes(row.current.status)).length} awaiting review</span>} />
      <section aria-label="Review filters" className="space-y-3 py-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="block w-full max-w-xs space-y-1 text-sm">
            <span className="font-medium">Show submissions</span>
            <Dropdown
              aria-label="Show submissions"
              className="w-full"
              button={{ className: "!w-full" }}
              value={{ "": "Awaiting review", submitted: "Submitted", under_review: "In review", approved: "Approved", returned: "Returned", rejected: "Rejected" }[status] ?? "Awaiting review"}
              selectedOptions={[status]}
              onOptionSelect={(_, data) => {
                const next = data.optionValue ?? "";
                if (next === status) return;
                setLoading(true);
                setError("");
                setStatus(next);
              }}
            >
              <Option value="">Awaiting review</Option>
              <Option value="submitted">Submitted</Option>
              <Option value="under_review">In review</Option>
              <Option value="approved">Approved</Option>
              <Option value="returned">Returned</Option>
              <Option value="rejected">Rejected</Option>
            </Dropdown>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button appearance="secondary" onClick={openAdvancedFilters}>More filters{advancedFilterCount ? ` (${advancedFilterCount})` : ""}</Button>
            {(status || advancedFilterCount > 0) && <Button appearance="subtle" onClick={() => { if (status) setLoading(true); setStatus(""); setEmployee(""); setDepartment(""); setBranch(""); setPeriod(""); }}>Clear filters</Button>}
          </div>
        </div>
      </section>
      <Dialog open={filtersOpen} onOpenChange={(_, data) => setFiltersOpen(data.open)}>
        <DialogSurface className="max-h-[90vh] !w-[min(44rem,calc(100vw-2rem))] overflow-y-auto">
          <DialogBody>
            <DialogTitle>Filter submissions</DialogTitle>
            <DialogContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Filter by person, team, or reporting period.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <KpiSearchSelect label="Employee" value={draftFilters.employee} onChange={(value) => setDraftFilters((current) => ({ ...current, employee: value }))} load={loadEmployees} emptyLabel="All employees" fluentDropdown />
                <KpiSearchSelect label="Department" value={draftFilters.department} onChange={(value) => setDraftFilters((current) => ({ ...current, department: value }))} load={loadDepartments} emptyLabel="All departments" fluentDropdown />
                <KpiSearchSelect label="Branch" value={draftFilters.branch} onChange={(value) => setDraftFilters((current) => ({ ...current, branch: value }))} load={loadBranches} emptyLabel="All branches" fluentDropdown />
                <KpiSearchSelect label="Period" value={draftFilters.period} onChange={(value) => setDraftFilters((current) => ({ ...current, period: value }))} load={loadPeriods} emptyLabel="All periods" fluentDropdown />
              </div>
              {Object.values(draftFilters).some(Boolean) && <Button appearance="subtle" size="small" onClick={() => setDraftFilters(emptyAdvancedFilters)}>Clear selections</Button>}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setFiltersOpen(false)}>Cancel</Button>
              <Button appearance="primary" onClick={applyAdvancedFilters}>Apply filters</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      {loading && <p>Loading submissions…</p>}
      {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="font-semibold">{status || employee || department || branch || period ? "No submissions match these filters" : "Nothing waiting for review"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{status || employee || department || branch || period ? "Change or clear a filter to see more submissions." : "Submitted KPI results will appear here when a manager needs to review them."}</p>
        </div>
      )}
      {!loading && filtered.length > 0 && <div className="overflow-x-auto rounded-lg border">
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
      </div>}
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
          <section className="space-y-3 rounded-lg border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Supporting activity log</h2>
              <span className="rounded-full border px-2 py-1 text-xs">{record.current.activities?.length ?? 0} activities</span>
            </div>
            {!record.current.activities?.length && <p>No detailed activities were attached to this revision. Review the submitted final actual and comments.</p>}
            {record.current.activities?.map((activity) => <ReviewActivity key={activity.id} activity={activity} achievementId={id} token={token} onError={setError} />)}
            {!!record.current.activities?.length && <p className="text-xs text-muted-foreground">Activity results are supporting evidence. No total is inferred because this KPI has no configured activity aggregation rule.</p>}
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
              <div key={revision.id} className="space-y-2 border-b py-2 last:border-0">
                <p>
                Revision {revision.revision}: {revision.effectiveStatus} ·
                actual {text(revision.actual)} · feedback{" "}
                {revision.reviewComment || "—"}
                </p>
                {revision.id !== record.current.id && revision.activities?.map((activity) => <ReviewActivity key={activity.id} activity={activity} achievementId={id} token={token} onError={setError} />)}
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
        </>
      )}
    </div>
  );
}

function ReviewActivity({
  activity,
  achievementId,
  token,
  onError,
}: {
  activity: AchievementActivity;
  achievementId: number;
  token: string;
  onError: (message: string) => void;
}) {
  return <article className="rounded-lg border bg-muted/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{activity.activityDate} · {activity.title}</p><KpiStatusBadge status={activity.status} /></div>
    <p className="mt-2 whitespace-pre-wrap">{activity.details}</p>
    <p className="mt-1 text-muted-foreground">Measured result: {text(activity.measurableResult)} · Comments: {activity.comments || "—"}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {activity.evidence.map((file) => <KpiFluentButton key={file.id} className="text-primary underline" onClick={() => void achievementApi.downloadActivityEvidence(token, achievementId, activity, file).catch((e: unknown) => onError(e instanceof Error ? e.message : "Download failed"))}>{file.fileName} · {(file.fileSize / 1024).toFixed(1)} KB</KpiFluentButton>)}
      {!activity.evidence.length && <span className="text-xs text-muted-foreground">No activity evidence</span>}
    </div>
  </article>;
}
