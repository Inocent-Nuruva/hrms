"use client";

import { KpiFluentInput } from "./kpi-fluent-fields";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell } from "@fluentui/react-components";
import { Calculator20Regular, Copy20Regular, DocumentBulletList24Regular, History20Regular } from "@fluentui/react-icons";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session";
import { scorecardApi, type Scorecard, type ScorecardEntry } from "@/lib/scorecard-api";
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance";
import { scorecardEmployeeNames } from "./scorecard-subject-names";

function textTarget(entry: ScorecardEntry) {
  const target = entry.target;
  if (!target) return "—";
  const unit = entry.measurementUnit === "%" ? "%" : entry.measurementUnit ? ` ${entry.measurementUnit}` : "";
  if (target.min !== undefined && target.max !== undefined) return `${target.min}–${target.max}${unit}`;
  if (typeof target.value === "boolean") return target.value ? "Yes" : "No";
  if (target.value !== undefined && target.value !== null) return `${target.value}${unit}`;
  if (typeof target.description === "string") return target.description;
  return Object.values(target).map(String).join(" · ") || "—";
}
function parseExample(type: string | undefined, raw: string): unknown {
  if (!raw.trim()) return undefined;
  if (["numeric", "percentage", "currency", "duration"].includes(type ?? "")) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("Enter a number for the sample result.");
    return n;
  }
  if (type === "binary") {
    if (!["true", "false", "yes", "no"].includes(raw.trim().toLowerCase()))
      throw new Error("Enter Yes or No for the sample result.");
    return ["true", "yes"].includes(raw.trim().toLowerCase());
  }
  if (type === "milestone") {
    if (!["true", "false", "yes", "no"].includes(raw.trim().toLowerCase()))
      throw new Error("Enter Yes or No for the sample milestone.");
    return { completed: ["true", "yes"].includes(raw.trim().toLowerCase()) };
  }
  return raw;
}

export function ScorecardDetail({
  id,
  personal = false,
  embedded = false,
}: {
  id: number;
  personal?: boolean;
  embedded?: boolean;
}) {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [card, setCard] = React.useState<Scorecard | null>(null),
    [loading, setLoading] = React.useState(true);
  const [employeeName, setEmployeeName] = React.useState("");
  const [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState(""),
    [busy, setBusy] = React.useState(false);
  const [cloneCode, setCloneCode] = React.useState(""),
    [examples, setExamples] = React.useState<Record<number, string>>({});
  const loadSequence = React.useRef(0);
  const [preview, setPreview] = React.useState<{
    overallScore: string | null;
    rating: string | null;
    completenessPercent: string;
    entries: Array<{
      entryId: number;
      status: string;
      rawAchievement: string | null;
      scoredAchievement: string | null;
      weightedContribution: string | null;
    }>;
  } | null>(null);
  const reload = React.useCallback(async () => {
    if (!scorecardsEnabled || !token) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const next = await scorecardApi.get(token, id);
      if (sequence === loadSequence.current) {
        setCard(next);
        setError("");
      }
    } catch (e) {
      if (sequence === loadSequence.current)
        setError(e instanceof Error ? e.message : "Unable to load scorecard");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [token, id]);
  React.useEffect(() => {
    if (actor.ready) void reload();
  }, [actor.ready, reload]);
  React.useEffect(() => {
    if (!token || card?.subjectType !== "employee") return;
    let active = true;
    void scorecardEmployeeNames(token, [card.subjectId]).then((names) => {
      if (active) setEmployeeName(names[card.subjectId] ?? "");
    });
    return () => { active = false; };
  }, [token, card?.subjectType, card?.subjectId]);
  const canEdit =
    !personal &&
    actor.roleNames.some((r) =>
      [
        "COMPANY_ADMIN",
        "HR_MANAGER",
        "DEPARTMENT_MANAGER",
        "BRANCH_MANAGER",
      ].includes(r),
    );
  async function action(run: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await run();
      if (
        result &&
        typeof result === "object" &&
        "currentVersion" in result &&
        "id" in result &&
        result.id === id
      ) {
        ++loadSequence.current;
        setCard(result as Scorecard);
        setLoading(false);
      } else {
        await reload();
      }
      setNotice(message);
      window.dispatchEvent(new Event("hrms:refresh-page-data"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  if (!scorecardsEnabled)
    return <p className="p-6">Scorecards are disabled in this environment.</p>;
  return (
    <div className="space-y-7 pb-8 pt-5">
      {!embedded && <KpiPageHeader title="Scorecard details" description="Approved results appear here; missing achievements remain awaiting data." actions={<Link className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted" href={personal ? "/dashboard/me/scorecards" : "/dashboard/kpi/scorecards"}>Back to scorecards</Link>} />}
      {!embedded && <KpiWorkflowGuidancePanel recordKind="scorecard" recordId={id} />}
      {loading && <p>Loading scorecard…</p>}
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-green-50 p-3 text-green-700">
          {notice}
        </p>
      )}
      {card && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
            <div className="min-w-0 space-y-3">
              {!embedded && <h1 className="text-2xl font-semibold">
                {card.currentVersion.name}
              </h1>}
              <div className="flex flex-wrap items-center gap-3">
                <KpiStatusBadge status={card.status} />
                <span className="text-sm text-muted-foreground">{card.code}</span>
              </div>
              <dl className="flex flex-wrap gap-x-7 gap-y-2 text-sm"><div><dt className="text-muted-foreground">Owner</dt><dd className="mt-0.5 font-medium">{card.subjectType === "employee" ? employeeName || `Employee #${card.subjectId}` : `${card.subjectType.replaceAll("_", " ")} #${card.subjectId}`}</dd></div><div><dt className="text-muted-foreground">Reporting period</dt><dd className="mt-0.5 font-medium">{card.period.label}</dd></div></dl>
              {card.currentVersion.description?.trim() && card.currentVersion.description.trim().toLocaleLowerCase() !== card.currentVersion.name.trim().toLocaleLowerCase() && <p className="max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">{card.currentVersion.description}</p>}
            </div>
            {canEdit && card.status !== "archived" && (
              <div className="flex flex-wrap items-center gap-2">
                {card.currentVersion.publishedAt ? (
                  <KpiFluentButton
                    className="rounded border px-3 py-2 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () => scorecardApi.revise(token, id),
                        "Draft revision created",
                      )
                    }
                  >
                    Create draft revision
                  </KpiFluentButton>
                ) : (
                  <>
                    <Link
                      className="rounded border px-3 py-2 text-sm"
                      href={`/dashboard/kpi/scorecards/${id}/edit`}
                    >
                      Edit draft
                    </Link>
                    <KpiFluentButton
                      className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() =>
                        void action(
                          () => scorecardApi.publish(token, id),
                          "Scorecard configuration published",
                        )
                      }
                    >
                      Publish configuration
                    </KpiFluentButton>
                  </>
                )}
                {card.status === "published" && (
                  <KpiFluentButton
                    className="rounded border px-3 py-2 text-sm"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        () => scorecardApi.activate(token, id),
                        "Scorecard activated",
                      )
                    }
                  >
                    Activate
                  </KpiFluentButton>
                )}
                <KpiFluentButton
                  className="rounded border px-3 py-2 text-sm text-red-700"
                  disabled={busy}
                  onClick={async () => {
                    if (await fluentConfirm("Archive this scorecard configuration?"))
                      void action(
                        () => scorecardApi.archive(token, id),
                        "Scorecard archived",
                      );
                  }}
                >
                  Archive
                </KpiFluentButton>
              </div>
            )}
          </header>
          {card.missingAssignmentIds?.length ? <div role="alert" className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">{card.missingAssignmentIds.length} active {card.missingAssignmentIds.length === 1 ? "KPI is" : "KPIs are"} missing from this published scorecard. Create and publish a scorecard revision to include {card.missingAssignmentIds.length === 1 ? "it" : "them"} before using the score.</div> : null}
          <section aria-label="Scorecard summary" className="space-y-4">
            <div className="flex items-center gap-3"><DocumentBulletList24Regular className="shrink-0 text-primary" aria-hidden="true" /><div><h2 className="font-semibold">Scorecard overview</h2><p className="text-sm text-muted-foreground">Configuration and current results for this period.</p></div></div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-3 lg:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">Configuration</dt><dd className="mt-1 font-medium">Version {card.currentVersion.version} · {card.currentVersion.mode === "weighted" ? "Weighted" : "Strategic"}</dd><p className="text-xs text-muted-foreground">{card.currentVersion.publishedAt ? "Published" : "Draft"}</p></div>
              <div><dt className="text-xs text-muted-foreground">Scoring policy</dt><dd className="mt-1 font-medium">{card.currentVersion.policyVersionId ? `Policy #${card.currentVersion.policyVersionId}` : "Not selected"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Weight total</dt><dd className="mt-1 font-medium">{card.entries.reduce((sum, entry) => sum + Number(entry.weight), 0).toFixed(2)}%</dd></div>
              <div><dt className="text-xs text-muted-foreground">Performance</dt><dd className="mt-1 font-medium capitalize">{card.performanceStatus.replaceAll("_", " ")}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{card.missingAssignmentIds?.length ? "Included KPI completeness" : "Completeness"}</dt><dd className="mt-1 font-medium">{card.completenessPercent ?? "0"}%</dd></div>
              <div><dt className="text-xs text-muted-foreground">Overall score</dt><dd className="mt-1 font-medium">{card.overallScore ?? "Unavailable"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Rating</dt><dd className="mt-1 font-medium">{card.rating ?? "Unavailable"}</dd></div>
            </dl>
          </section>
          <section aria-labelledby="scorecard-kpis" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="scorecard-kpis" className="font-semibold">KPI results</h2><span className="text-sm text-muted-foreground">{card.entries.length} {card.entries.length === 1 ? "KPI" : "KPIs"}</span></div>
            <div className="overflow-x-auto border-y border-border">
            <Table className="min-w-[760px] w-full text-left text-sm">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHeaderCell className="p-3">KPI</TableHeaderCell>
                  <TableHeaderCell className="p-3">Target</TableHeaderCell>
                  <TableHeaderCell className="p-3">Actual</TableHeaderCell>
                  <TableHeaderCell className="p-3">Weight</TableHeaderCell>
                  <TableHeaderCell className="p-3">Achievement</TableHeaderCell>
                  <TableHeaderCell className="p-3">Weighted score</TableHeaderCell>
                  <TableHeaderCell className="p-3">Status</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {card.entries.map((e) => (
                  <TableRow key={e.assignmentId} className="border-b border-border last:border-0">
                    <TableCell className="p-3">
                      <span className="font-medium">{e.kpiName}</span>
                    </TableCell>
                    <TableCell className="p-3">{textTarget(e)}</TableCell>
                    <TableCell className="p-3">{e.actual === null || e.actual === undefined ? "—" : typeof e.actual === "object" ? JSON.stringify(e.actual) : typeof e.actual === "boolean" ? e.actual ? "Yes" : "No" : `${e.actual}${e.measurementUnit === "%" ? "%" : e.measurementUnit ? ` ${e.measurementUnit}` : ""}`}</TableCell>
                    <TableCell className="p-3">{e.weight}%</TableCell>
                    <TableCell className="p-3">{e.achievement === null || e.achievement === undefined ? "—" : `${e.achievement}%`}{e.rawAchievement && e.rawAchievement !== e.achievement ? ` (raw ${e.rawAchievement}%)` : ""}</TableCell>
                    <TableCell className="p-3">{e.weightedScore ?? "—"}</TableCell>
                    <TableCell className="p-3">{e.status === "target_changed" ? <span className="text-sm font-medium text-amber-700">Target changed · revise scorecard</span> : <KpiStatusBadge status={e.status === "scored" ? "approved" : "awaiting_data"} />}{e.managerFeedback && <span className="mt-1 block max-w-48 text-xs text-muted-foreground">{e.managerFeedback}</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </section>
          <section className="space-y-3 border-t border-border pt-6">
            <h2 className="flex items-center gap-2 font-semibold"><History20Regular className="text-primary" aria-hidden="true" />Configuration history</h2>
            <ol className="divide-y divide-border border-y border-border">{card.versions.map((version) => (
              <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm" key={version.id}>
                <span className="font-medium">Version {version.version}</span>
                <span className="text-muted-foreground">{version.publishedAt ? `Published ${new Date(version.publishedAt).toLocaleString()}` : "Draft"} · {version.entries.length} {version.entries.length === 1 ? "KPI" : "KPIs"} · {version.policyVersionId ? `Policy #${version.policyVersionId}` : "No scoring policy"}</span>
              </li>
            ))}</ol>
          </section>
          {canEdit && <div className="grid gap-8 border-t border-border pt-6 lg:grid-cols-2 lg:gap-0">
            <section className="space-y-3 lg:border-r lg:border-border lg:pr-8">
              <h2 className="flex items-center gap-2 font-semibold"><Copy20Regular className="text-primary" aria-hidden="true" />Clone into a new draft</h2>
              <p className="text-sm text-muted-foreground">Create a separate scorecard based on this configuration.</p>
              <div className="flex flex-wrap gap-2">
                <KpiFluentInput
                  className="min-w-44 flex-1 rounded border px-3 py-2 text-sm"
                  aria-label="New scorecard identifier"
                  placeholder="NEW_SCORECARD_CODE"
                  value={cloneCode}
                  onChange={(e) => setCloneCode(e.target.value)}
                />
                <KpiFluentButton
                  className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-white"
                  disabled={busy || !cloneCode.trim()}
                  onClick={() =>
                    void action(
                      () => scorecardApi.clone(token, id, cloneCode),
                      "Scorecard cloned",
                    )
                  }
                >
                  Clone
                </KpiFluentButton>
              </div>
            </section>
            <section className="space-y-3 lg:pl-8">
              <h2 className="flex items-center gap-2 font-semibold"><Calculator20Regular className="text-primary" aria-hidden="true" />Try a sample score</h2>
              <p className="text-sm text-muted-foreground">
                Enter a possible result for each KPI to see the score it would produce. Nothing you enter here is saved.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {card.entries.map((e) => (
                  <label key={e.assignmentId} className="space-y-1 text-sm">
                    <span>
                      Sample result for {e.kpiName}{" "}
                      {e.measurementType === "milestone" ||
                      e.measurementType === "binary"
                        ? "(Yes or No)"
                        : ""}
                    </span>
                    <KpiFluentInput
                      className="w-full rounded border px-3 py-2"
                      placeholder={e.measurementType === "milestone" || e.measurementType === "binary" ? "Yes or No" : ["numeric", "percentage", "currency", "duration"].includes(e.measurementType ?? "") ? "Enter a number" : "Enter a result"}
                      value={examples[e.assignmentId] ?? ""}
                      onChange={(event) =>
                        setExamples((values) => ({
                          ...values,
                          [e.assignmentId]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <KpiFluentButton
                className="rounded bg-[var(--primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  try {
                    const actuals = card.entries.map((e) => ({
                      assignmentId: e.assignmentId,
                      actual: parseExample(
                        e.measurementType,
                        examples[e.assignmentId] ?? "",
                      ),
                    }));
                    setBusy(true);
                    setError("");
                    void scorecardApi
                      .preview(token, id, actuals)
                      .then(setPreview)
                      .catch((e: unknown) =>
                        setError(
                          e instanceof Error ? e.message : "Preview failed",
                        ),
                      )
                      .finally(() => setBusy(false));
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Invalid example",
                    );
                  }
                }}
              >
                See sample score
              </KpiFluentButton>
              {preview && (
                <div className="space-y-2 border-t border-border pt-4 text-sm">
                  <p className="font-medium">Sample score · nothing saved</p>
                  <p className="text-muted-foreground">Data complete: {preview.completenessPercent}% · Score: {preview.overallScore ?? "Unavailable"} · Rating: {preview.rating ?? "Unavailable"}</p>
                  {preview.entries.map((entry, index) => <p key={entry.entryId} className="text-muted-foreground">Result {index + 1}: {entry.status.replaceAll("_", " ")} · KPI score {entry.scoredAchievement ?? "—"} · Weighted score {entry.weightedContribution ?? "—"}{entry.rawAchievement && entry.rawAchievement !== entry.scoredAchievement ? ` · Before adjustment ${entry.rawAchievement}` : ""}</p>)}
                </div>
              )}
            </section>
          </div>}
        </>
      )}
    </div>
  );
}
