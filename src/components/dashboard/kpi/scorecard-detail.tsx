"use client";

import { KpiFluentInput } from "./kpi-fluent-fields";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service"
import { Calculator20Regular, Copy20Regular } from "@fluentui/react-icons";
import * as React from "react";
import { KpiFluentButton } from "./kpi-fluent-button";
import Link from "next/link";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { readKpiToken, scorecardsEnabled } from "@/lib/kpi-session";
import { scorecardApi, type Scorecard } from "@/lib/scorecard-api";
import { ScorecardPerformanceReport } from "./scorecard-performance-report";
import { formatReportNumber, formatReportPercent } from "./scorecard-report-model";
import { KpiWorkflowGuidancePanel } from "./kpi-workflow-guidance";
import { scorecardEmployeeNames } from "./scorecard-subject-names";

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
    <div className="space-y-4 pb-5 pt-3">
      {loading && <p>Loading scorecard…</p>}
      {error && <p role="alert" className="border-l-4 border-destructive bg-card p-3 text-destructive">{error}</p>}
      {notice && <p role="status" className="border-l-4 border-[var(--success)] bg-card p-3">{notice}</p>}
      {card && (<>
        <ScorecardPerformanceReport
          card={card}
          owner={card.subjectType === "employee" ? employeeName || (personal ? "You" : `Employee #${card.subjectId}`) : `${card.subjectType.replaceAll("_", " ")} #${card.subjectId}`}
          personal={personal}
          embedded={embedded}
          workflow={!embedded ? <KpiWorkflowGuidancePanel recordKind="scorecard" recordId={id} /> : undefined}
          actions={<>
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
          </>}
        />
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
                  <p className="text-muted-foreground">Data complete: {formatReportPercent(preview.completenessPercent)} · Score: {preview.overallScore === null ? "Unavailable" : formatReportPercent(preview.overallScore)} · Rating: {preview.rating ?? "Unavailable"}</p>
                  {preview.entries.map((entry, index) => <p key={entry.entryId} className="text-muted-foreground">Result {index + 1}: {entry.status.replaceAll("_", " ")} · KPI score {formatReportPercent(entry.scoredAchievement)} · Weighted score {formatReportNumber(entry.weightedContribution, true)}{entry.rawAchievement && entry.rawAchievement !== entry.scoredAchievement ? ` · Before adjustment ${formatReportPercent(entry.rawAchievement)}` : ""}</p>)}
                </div>
              )}
            </section>
          </div>}
        </>
      )}
    </div>
  );
}
