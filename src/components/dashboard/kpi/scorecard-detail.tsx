"use client";

import { KpiFluentInput } from "./kpi-fluent-fields";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { Card, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, Text } from "@fluentui/react-components";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import { KpiPageHeader, KpiStatusBadge } from "./kpi-page-elements";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session";
import { scorecardApi, type Scorecard } from "@/lib/scorecard-api";
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance";

function textTarget(target: Record<string, unknown> | null | undefined) {
  return target
    ? Object.entries(target)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" · ")
    : "—";
}
function parseExample(type: string | undefined, raw: string): unknown {
  if (!raw.trim()) return undefined;
  if (["numeric", "percentage", "currency", "duration"].includes(type ?? "")) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("Enter a valid numeric example");
    return n;
  }
  if (type === "binary") {
    if (!["true", "false"].includes(raw.toLowerCase()))
      throw new Error("Enter true or false");
    return raw.toLowerCase() === "true";
  }
  if (type === "milestone") {
    if (!["true", "false"].includes(raw.toLowerCase()))
      throw new Error("Enter true or false for milestone completion");
    return { completed: raw.toLowerCase() === "true" };
  }
  return raw;
}

export function ScorecardDetail({
  id,
  personal = false,
}: {
  id: number;
  personal?: boolean;
}) {
  const actor = useDashboardActor(),
    token = readKpiToken();
  const [card, setCard] = React.useState<Scorecard | null>(null),
    [loading, setLoading] = React.useState(true);
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
    <div className="space-y-4 pt-3">
      <KpiPageHeader title="Scorecard details" description="Approved results appear here; missing achievements remain awaiting data." actions={<Link className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted" href={personal ? "/dashboard/me/scorecards" : "/dashboard/kpi/scorecards"}>Back to scorecards</Link>} />
      <KpiWorkflowGuidancePanel recordKind="scorecard" recordId={id} />
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                {card.currentVersion.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {card.code} · {card.subjectType} #{card.subjectId} ·{" "}
                {card.period.label} · <KpiStatusBadge status={card.status} />
              </p>
              <p className="mt-1 text-sm">{card.currentVersion.description}</p>
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
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <p>
              <b>Configuration:</b> version {card.currentVersion.version} ·{" "}
              {card.currentVersion.mode} ·{" "}
              {card.currentVersion.publishedAt ? "Published" : "Draft"}
            </p>
            <p>
              <b>Scoring policy version:</b>{" "}
              {card.currentVersion.policyVersionId ?? "Not selected"}
            </p>
            <p>
              <b>Weight total:</b>{" "}
              {card.entries
                .reduce((sum, e) => sum + Number(e.weight), 0)
                .toFixed(4)}
              %
            </p>
            <p>
              <b>Performance:</b> {card.performanceStatus.replaceAll("_", " ")} · Completeness {card.completenessPercent ?? "0"}% · Overall score {card.overallScore ?? "Unavailable"} · Rating {card.rating ?? "Unavailable"}
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="w-full text-left text-sm">
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
                  <TableRow key={e.assignmentId} className="border-b">
                    <TableCell className="p-3">
                      {e.kpiName}
                      <span className="block text-xs text-muted-foreground">
                        Definition version #{e.definitionVersionId} · target
                        revision #{e.targetRevisionId}
                      </span>
                    </TableCell>
                    <TableCell className="p-3">{textTarget(e.target)}</TableCell>
                    <TableCell className="p-3">{e.actual === null || e.actual === undefined ? "—" : typeof e.actual === "object" ? JSON.stringify(e.actual) : String(e.actual)}</TableCell>
                    <TableCell className="p-3">{e.weight}%</TableCell>
                    <TableCell className="p-3">{e.achievement === null || e.achievement === undefined ? "—" : `${e.achievement}%`}{e.rawAchievement && e.rawAchievement !== e.achievement ? ` (raw ${e.rawAchievement}%)` : ""}</TableCell>
                    <TableCell className="p-3">{e.weightedScore ?? "—"}</TableCell>
                    <TableCell className="p-3">{e.status === "scored" ? "Approved" : "Awaiting Data"}{e.managerFeedback ? ` · ${e.managerFeedback}` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="font-semibold">Configuration history</h2>
            {card.versions.map((v) => (
              <p className="text-sm" key={v.id}>
                Version {v.version}:{" "}
                {v.publishedAt
                  ? `Published ${new Date(v.publishedAt).toLocaleString()}`
                  : "Draft"}{" "}
                · policy version #{v.policyVersionId ?? "—"} ·{" "}
                {v.entries.length} KPIs
              </p>
            ))}
          </section>
          {canEdit && (
            <section className="space-y-3 rounded-lg border p-4">
              <h2 className="font-semibold">Clone into a new draft</h2>
              <div className="flex flex-wrap gap-2">
                <KpiFluentInput
                  className="rounded border px-3 py-2 text-sm"
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
          )}
          {canEdit && (
            <section className="space-y-3 rounded-lg border p-4">
              <h2 className="font-semibold">Example scoring preview</h2>
              <p className="text-sm text-muted-foreground">
                Example inputs are calculated only. They are never saved as
                employee achievements.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {card.entries.map((e) => (
                  <label key={e.assignmentId} className="space-y-1 text-sm">
                    <span>
                      {e.kpiName} example actual{" "}
                      {e.measurementType === "milestone" ||
                      e.measurementType === "binary"
                        ? "(true/false)"
                        : ""}
                    </span>
                    <KpiFluentInput
                      className="w-full rounded border px-3 py-2"
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
                Calculate example preview
              </KpiFluentButton>
              {preview && (
                <Card appearance="outline" className="p-3">
                  <p>
                    <Text weight="semibold">Example only — not an employee result</Text>
                  </p>
                  <p>
                    Completeness: {preview.completenessPercent}% · Preview
                    score: {preview.overallScore ?? "Unavailable"} · Rating:{" "}
                    {preview.rating ?? "Unavailable"}
                  </p>
                  {preview.entries.map((e) => (
                    <p key={e.entryId}>
                      Assignment #{e.entryId}: {e.status} · raw{" "}
                      {e.rawAchievement ?? "—"} · scored{" "}
                      {e.scoredAchievement ?? "—"} · weighted{" "}
                      {e.weightedContribution ?? "—"}
                    </p>
                  ))}
                </Card>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
