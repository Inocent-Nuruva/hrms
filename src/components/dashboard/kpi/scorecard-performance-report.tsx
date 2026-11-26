"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@fluentui/react-components";
import { ArrowLeft20Regular, ArrowUpRight20Regular, CheckmarkCircle20Regular, ClipboardTask20Regular } from "@fluentui/react-icons";
import type { Scorecard, ScorecardEntry } from "@/lib/scorecard-api";
import { KpiStatusBadge } from "./kpi-page-elements";
import { formatReportNumber, formatReportPercent, reportActual, reportComparison, reportContributions, reportTarget, reportWeightTotal } from "./scorecard-report-model";
import styles from "./scorecard-performance-report.module.css";

const seriesColors = [
  "var(--report-series-1)", "var(--report-series-2)", "var(--report-series-3)",
  "var(--report-series-4)", "var(--report-series-5)",
];

function seriesColor(index: number) { return seriesColors[index % seriesColors.length]; }

function ContributionChart({ card }: { card: Scorecard }) {
  const data = reportContributions(card);
  const weighted = card.currentVersion.mode === "weighted";
  const canChart = data.visualizable;
  const chartLabel = data.items.filter((item) => item.value !== null).map((item) => `${item.entry.kpiName ?? `KPI ${item.index + 1}`}: ${formatReportNumber(item.value, true)} points`).join("; ");
  const circumference = 2 * Math.PI * 40;
  const arcs = data.items.filter((item) => item.value !== null && item.value > 0).reduce<Array<{ item: typeof data.items[number]; start: number; length: number }>>((result, item) => {
    const length = item.share / 100 * circumference;
    const last = result.at(-1);
    return [...result, { item, start: last ? last.start + last.length : 0, length }];
  }, []);
  return <section className={styles.contribution} aria-labelledby="weighted-score-contribution">
    <div className={styles.sectionHead}><div><h2 id="weighted-score-contribution">{weighted ? "Weighted score contribution" : "KPI result status"}</h2><p>{weighted ? "Approved KPI points that contribute to this scorecard." : "This scorecard tracks approved results without combining them into a score."}</p></div></div>
    {canChart ? <>
      <div className={styles.chartLayout}>
        <figure className={styles.donutFigure} role="img" aria-label={`Share of available weighted contributions. ${chartLabel}`}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="10" />
            {arcs.map(({ item, start, length }) => <circle key={`${item.entry.assignmentId}-${item.index}`} cx="50" cy="50" r="40" fill="none" stroke={seriesColor(item.index)} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`} strokeDashoffset={-start} transform="rotate(-90 50 50)" />)}
          </svg>
          <figcaption><strong>{card.entries.length}</strong><span>{card.entries.length === 1 ? "KPI" : "KPIs"}</span></figcaption>
        </figure>
        <div className={styles.chartLegend}>
          {data.items.map((item) => <div className={styles.legendRow} key={`${item.entry.assignmentId}-${item.index}`}>
            <span className={styles.legendSwatch} style={{ backgroundColor: item.value === null ? "var(--muted-foreground)" : seriesColor(item.index) }} aria-hidden="true" />
            <span className={styles.legendName}>{item.entry.kpiName ?? `KPI ${item.index + 1}`}</span>
            <strong>{item.value === null ? "Unavailable" : formatReportNumber(item.value, true)}</strong>
          </div>)}
        </div>
      </div>
      <div className={styles.stack} role="img" aria-label={`Weighted contribution shares. ${chartLabel}`}>
        {data.items.filter((item) => item.value !== null && item.value > 0).map((item) => <span key={`${item.entry.assignmentId}-${item.index}`} className={styles.stackSegment} style={{ width: `${item.share}%`, backgroundColor: seriesColor(item.index) }} title={`${item.entry.kpiName ?? `KPI ${item.index + 1}`}: ${formatReportNumber(item.value, true)} points`}>{item.share >= 14 ? formatReportNumber(item.value, true) : null}</span>)}
      </div>
      <p className={styles.chartNote}>Segment sizes show each KPI&apos;s share of available weighted points. The live approved score above is the API result.{data.missing > 0 ? ` ${data.missing} ${data.missing === 1 ? "KPI has" : "KPIs have"} no weighted score yet.` : ""}</p>
    </> : <div className={styles.chartFallback}>
      <p>{!weighted ? "This strategic scorecard has no weighted contribution chart." : data.negative ? "Negative contributions are listed below; a proportional donut would misrepresent them." : "No approved weighted contributions are available yet."}</p>
      {data.items.some((item) => item.value !== null) && <ul>{data.items.map((item) => <li key={`${item.entry.assignmentId}-${item.index}`}><span>{item.entry.kpiName ?? `KPI ${item.index + 1}`}</span><strong>{item.value === null ? "Unavailable" : formatReportNumber(item.value, true)}</strong></li>)}</ul>}
    </div>}
  </section>;
}

function KpiBreakdown({ entry, index, weighted }: { entry: ScorecardEntry; index: number; weighted: boolean }) {
  const comparison = reportComparison(entry);
  const status = entry.status === "scored" ? "approved" : entry.status || "awaiting_data";
  return <article className={styles.kpiCard} data-scorecard-kpi>
    <div className={styles.kpiTop}><div><span className={styles.kpiIndex}>KPI {String(index + 1).padStart(2, "0")}</span><h3>{entry.kpiName ?? `KPI ${index + 1}`}</h3></div>{entry.status === "target_changed" ? <Badge appearance="outline" color="warning">Target changed · revise scorecard</Badge> : <KpiStatusBadge status={status} />}</div>
    <dl className={styles.kpiValues}>
      <div><dt>Target</dt><dd>{reportTarget(entry)}</dd></div>
      <div><dt>Approved actual</dt><dd>{reportActual(entry)}</dd></div>
      {weighted && <div><dt>Weight</dt><dd>{formatReportPercent(entry.weight)}</dd></div>}
      <div><dt>Achievement</dt><dd>{formatReportPercent(entry.achievement)}</dd></div>
      {weighted && <div><dt>Weighted score</dt><dd>{formatReportNumber(entry.weightedScore, true)}</dd></div>}
    </dl>
    {comparison && <div className={styles.comparison} role="img" aria-label={`${entry.kpiName ?? `KPI ${index + 1}`}. Target ${reportTarget(entry)}; actual ${reportActual(entry)}. ${comparison.direction}. Bars use the same scale.`}>
      <div><span>Target</span><span className={styles.comparisonTrack}><span className={styles.targetFill} style={{ width: `${comparison.targetWidth}%` }} /></span></div>
      <div><span>Actual</span><span className={styles.comparisonTrack}><span className={styles.actualFill} style={{ width: `${comparison.actualWidth}%` }} /></span></div>
      <p>{comparison.direction} · Bars compare values, not performance scores.</p>
    </div>}
    {!comparison && <p className={styles.textComparison}>Target and actual are shown above. A value bar is unavailable for this measurement or scoring direction.</p>}
    {entry.rawAchievement && entry.rawAchievement !== entry.achievement && <p className={styles.footnote}>Raw achievement: {formatReportPercent(entry.rawAchievement)}</p>}
    {entry.managerFeedback && <p className={styles.feedback}>Manager feedback: {entry.managerFeedback}</p>}
  </article>;
}

export function ScorecardPerformanceReport({ card, owner, personal, embedded, actions, workflow }: { card: Scorecard; owner: string; personal: boolean; embedded: boolean; actions?: ReactNode; workflow?: ReactNode }) {
  const weighted = card.currentVersion.mode === "weighted";
  const approvedCount = card.entries.filter((entry) => entry.status === "scored").length;
  const completeness = Number(card.completenessPercent);
  const isComplete = Number.isFinite(completeness) && completeness >= 100;
  const score = card.overallScore === null || card.overallScore === "" ? null : Number(card.overallScore);
  const scoreProgress = score === null || !Number.isFinite(score) ? 0 : Math.max(0, Math.min(100, score));
  const reportStyle = { "--report-score-progress": `${scoreProgress}%` } as CSSProperties;
  return <div className={styles.report} style={reportStyle} data-scorecard-report>
    <header className={styles.header}>
      {!embedded && <Link className={styles.backLink} href={personal ? "/dashboard/me/scorecards" : "/dashboard/kpi/scorecards"}><ArrowLeft20Regular aria-hidden="true" />{personal ? "My scorecards" : "Scorecards"}</Link>}
      <div className={styles.headerMain}><div className={styles.headerText}><div className={styles.titleLine}><h1>{card.currentVersion.name}</h1><KpiStatusBadge status={card.status} /></div><p className={styles.identifier}>Scorecard #{String(card.id).padStart(3, "0")} · {card.code}</p>{card.currentVersion.description?.trim() && card.currentVersion.description.trim().toLowerCase() !== card.currentVersion.name.trim().toLowerCase() && <p className={styles.description}>{card.currentVersion.description}</p>}</div>{actions && <div className={styles.headerActions}>{actions}</div>}</div>
      <dl className={styles.identityStrip}><div><dt>Owner</dt><dd>{owner}</dd></div><div><dt>Reporting period</dt><dd>{card.period?.label ?? "Unavailable"}</dd></div><div><dt>Configuration</dt><dd>Version {card.currentVersion.version} · {card.currentVersion.publishedAt ? "Published" : "Draft"}</dd></div></dl>
    </header>

    {card.missingAssignmentIds?.length ? <p className={styles.warning} role="alert">{card.missingAssignmentIds.length} active {card.missingAssignmentIds.length === 1 ? "KPI is" : "KPIs are"} missing from this published configuration. Publish a revision to include {card.missingAssignmentIds.length === 1 ? "it" : "them"} before using the score.</p> : null}

    <div className={styles.summaryGrid}>
      <section className={styles.overview} aria-labelledby="scorecard-overview"><div className={styles.sectionHead}><div><h2 id="scorecard-overview">Performance overview</h2><p>Live approved results for this scorecard.</p></div><KpiStatusBadge status={card.performanceStatus} /></div>
        <div className={styles.scorePanel}><span>Overall approved score</span><strong className={styles.bigScore} data-scorecard-report-score>{!weighted ? "Status only" : score === null || !Number.isFinite(score) ? "Unavailable" : formatReportPercent(card.overallScore)}</strong>{weighted && score !== null && Number.isFinite(score) && score >= 0 && score <= 100 && <span className={styles.scoreTrack} aria-hidden="true"><span /></span>}{weighted && score !== null && Number.isFinite(score) && (score < 0 || score > 100) && <span>Score outside the 0–100 display range; the progress bar is omitted.</span>}{weighted && <p>{card.rating ?? "Rating unavailable"}</p>}</div>
        <dl className={styles.metrics}>
          <div><dt>{weighted ? "Data completeness" : "Approved results"}</dt><dd>{weighted ? formatReportPercent(card.completenessPercent) : `${approvedCount} of ${card.entries.length}`}{(weighted ? isComplete : card.entries.length > 0 && approvedCount === card.entries.length) && <CheckmarkCircle20Regular className={styles.successIcon} aria-label="Complete" />}</dd><span className={styles.completeTrack} aria-hidden="true"><span style={{ width: `${weighted ? Number.isFinite(completeness) ? Math.max(0, Math.min(100, completeness)) : 0 : card.entries.length ? approvedCount / card.entries.length * 100 : 0}%` }} /></span></div>
          <div><dt>KPIs included</dt><dd>{card.entries.length}</dd></div>
          <div><dt>Total weight</dt><dd>{weighted ? formatReportPercent(reportWeightTotal(card)) : "Not used"}</dd></div>
        </dl>
      </section>
      <ContributionChart card={card} />
    </div>

    {workflow && <div className={styles.workflow}>{workflow}</div>}

    <section className={styles.results} aria-labelledby="scorecard-results"><div className={styles.sectionHead}><div><h2 id="scorecard-results">Target versus actual</h2><p>{weighted ? "Each KPI uses its approved result and official weighted contribution." : "Approved results are shown individually; this scorecard has no combined score."}</p></div><span>{card.entries.length} {card.entries.length === 1 ? "indicator" : "indicators"}</span></div><div className={styles.kpiGrid}>{card.entries.map((entry, index) => <KpiBreakdown key={`${entry.assignmentId}-${index}`} entry={entry} index={index} weighted={weighted} />)}</div></section>

    <div className={styles.detailsGrid}>
      <details className={styles.details}><summary><ClipboardTask20Regular aria-hidden="true" />Scorecard configuration</summary><dl><div><dt>Code</dt><dd>{card.code}</dd></div><div><dt>Version</dt><dd>{card.currentVersion.version}</dd></div><div><dt>Status</dt><dd>{card.currentVersion.publishedAt ? "Published" : "Draft"}</dd></div><div><dt>Scoring method</dt><dd>{weighted ? "Weighted" : "Strategic"}</dd></div><div><dt>Scoring policy</dt><dd>{card.currentVersion.policyVersionId ? `Policy #${card.currentVersion.policyVersionId}` : "Not selected"}</dd></div><div><dt>Total weight</dt><dd>{weighted ? formatReportPercent(reportWeightTotal(card)) : "Not used"}</dd></div></dl></details>
      <details className={styles.details}><summary><ArrowUpRight20Regular aria-hidden="true" />Configuration history</summary><ol>{card.versions.map((version) => <li key={version.id}><strong>Version {version.version}</strong><span>{version.publishedAt ? `Published ${new Date(version.publishedAt).toLocaleString()}` : "Draft"}</span><span>{version.entries.length} {version.entries.length === 1 ? "KPI" : "KPIs"} · {version.policyVersionId ? `Policy #${version.policyVersionId}` : "No scoring policy"}</span></li>)}</ol></details>
    </div>
  </div>;
}
