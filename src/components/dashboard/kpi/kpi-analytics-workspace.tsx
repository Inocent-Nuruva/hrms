"use client";

import { KpiFluentSelect } from "./kpi-fluent-fields";
import * as React from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Input } from "@fluentui/react-components";
import { KpiFluentButton } from "./kpi-fluent-button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChartMultiple24Regular, ClipboardTaskListLtr24Regular, Dismiss24Regular, Filter24Regular, PeopleTeam24Regular, Search20Regular } from "@fluentui/react-icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert, AlertDescription, AlertTitle, Card, CardContent, CardDescription,
  CardHeader, CardTitle, Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "./kpi-fluent-surface";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  listBranches,
  listDepartments,
  type AdminRecord,
} from "@/lib/admin-api";
import { evaluationApi, type EvaluationCycle } from "@/lib/evaluation-api";
import { kpiApi, type KpiPeriod } from "@/lib/kpi-api";
import {
  kpiAnalyticsApi,
  type AnalyticsOverview,
  type AnalyticsCoverage,
  type HistoricalKpiDefinition,
  type AnalyticsScorecard,
  type AnalyticsTrend,
  type ComparisonPage,
  type EvaluationSummary,
  type ScorecardPage,
  type TeamPage,
  type RatingDistribution,
  type ScorecardTrend,
  type AnalyticsSubjects,
} from "@/lib/kpi-analytics-api";
import { analyticsEnabled, readKpiToken } from "@/lib/kpi-session";
import { SharedDashboardHeroBackground } from "@/components/dashboard/welcome-card-background";

const statusColors: Record<string, string> = {
  approved: "#16a34a",
  pending: "#f59e0b",
  missing: "#94a3b8",
  draft: "#3b82f6",
  returned: "#ef4444",
  rejected: "#a855f7",
};
function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function display(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object" && value !== null && "value" in value && Object.keys(value).length === 1)
    return String((value as { value: unknown }).value);
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join(" · ");
  return String(value);
}
function getScorecardPageSummary(page: ScorecardPage) {
  const rows = Array.isArray(page.rows) ? page.rows : [];
  return {
    complete:
      page.pageSummary?.complete ??
      rows.filter((row) => row.performanceStatus === "scored" || row.performanceStatus === "status_only").length,
    incomplete:
      page.pageSummary?.incomplete ??
      rows.filter(
        (row) =>
          row.performanceStatus !== "scored" &&
          row.performanceStatus !== "status_only" &&
          row.performanceStatus !== "withheld",
      ).length,
    withheld:
      page.pageSummary?.withheld ??
      rows.filter((row) => row.performanceStatus === "withheld").length,
  };
}
function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="min-w-0 border-l-2 border-primary/25 py-1 pl-4">
      <p className="text-base font-semibold leading-snug text-foreground">{title}</p>
      <p className="mt-1 text-3xl font-bold leading-tight text-foreground" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
function StatusChart({ counts }: { counts: AnalyticsOverview["assignments"] }) {
  const values = [
    "approved",
    "pending",
    "missing",
    "draft",
    "returned",
    "rejected",
  ]
    .map((key) => ({
      name: label(key),
      value: counts[key as keyof typeof counts],
      color: statusColors[key],
    }))
    .filter((row) => row.value > 0);
  return (
    <section className="min-w-0 border-t border-border pt-5" aria-label="Achievement data status">
      <h2 className="text-2xl font-bold">Achievement data status</h2>
      <p className="text-sm text-muted-foreground">Only approved results count toward a score.</p>
      <div className="mt-4">
        {values.length ? (
          <div className="flex flex-wrap items-center gap-5 sm:flex-nowrap">
            <div className="relative size-40 shrink-0" role="img" aria-label={values.map((row) => `${row.name}: ${row.value}`).join(", ")}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={values} dataKey="value" nameKey="name" innerRadius={49} outerRadius={70} stroke="none">
                    {values.map((row) => <Cell key={row.name} fill={row.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{counts.total}</span>
                <span className="text-xs text-muted-foreground">assigned</span>
              </div>
            </div>
            <ul className="grid min-w-0 flex-1 gap-2 text-sm">
              {values.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-4 border-b border-border/70 pb-1 last:border-0">
                  <span className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />{row.name}</span>
                  <span className="font-semibold tabular-nums">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No KPI assignments in this scope or period.
          </p>
        )}
      </div>
    </section>
  );
}
function EvaluationChart({
  summary,
}: {
  summary: EvaluationSummary["summary"];
}) {
  if (summary.suppressed)
    return (
      <section className="min-w-0 border-t border-border pt-5">
        <h2 className="text-2xl font-bold">Evaluation progress</h2>
        <p className="text-sm text-muted-foreground">Confidential evaluation totals are unavailable.</p>
      </section>
    );
  const values = Object.entries(summary.byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status: label(status), count }));
  return (
    <section className="min-w-0 border-t border-border pt-5" aria-label="Evaluation progress">
      <h2 className="text-2xl font-bold">Evaluation progress</h2>
      <p className="text-sm text-muted-foreground">Finalized evaluations count toward completion.</p>
      <div className="mt-3">
        {values.length ? (
          <>
            <div
              className="h-44"
              role="img"
              aria-label={values
                .map((row) => `${row.status}: ${row.count}`)
                .join(", ")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={values} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    height={55}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {values.map((row) => (
                <li key={row.status}>
                  {row.status}: {row.count}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex min-h-40 items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5">
            <ChartMultiple24Regular className="shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">No evaluations in this scope or period.</p>
          </div>
        )}
      </div>
    </section>
  );
}
function ScorecardPanel({
  row,
  personal,
  subjectName,
}: {
  row: AnalyticsScorecard;
  personal: boolean;
  subjectName?: string;
}) {
  if (row.performanceStatus === "withheld")
    return (
      <section className="border-t border-border py-4">
        <h3 className="text-xl font-bold">{row.name}</h3>
        <p className="text-sm text-muted-foreground">{row.periodLabel} · Details withheld pending an approved disclosure policy.</p>
      </section>
    );
  const link = personal
    ? "/dashboard/me/scorecards"
    : "/dashboard/kpi/scorecards";
  const contributions = row.entries
    .filter((entry) => entry.weightedContribution != null)
    .map((entry) => ({
      name: entry.kpiName,
      contribution: Number(entry.weightedContribution),
    }));
  return (
    <section className="min-w-0 border-t border-border py-5">
      <div>
        <h3 className="text-xl font-bold">
          <Link
            className="underline underline-offset-2"
            href={`${link}/${row.id}`}
          >
            {row.name}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">
          {subjectName ?? `${label(row.subjectType)} #${row.subjectId}`} · {row.periodLabel} ·{" "}
          {row.performanceStatus === "scored"
            ? `Score ${row.overallScore}%`
            : row.performanceStatus === "status_only"
              ? "Complete · status only"
            : row.performanceStatus === "needs_revision"
              ? "Scorecard revision needed"
            : "Awaiting complete approved data"}{" "}
          · {row.completenessPercent}% complete
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {contributions.length > 0 && (
          <div
            className="h-52"
            role="img"
            aria-label={contributions
              .map(
                (item) => `${item.name}: ${item.contribution} weighted points`,
              )
              .join(", ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contributions}
                layout="vertical"
                margin={{ left: 8, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar
                  dataKey="contribution"
                  fill="#16a34a"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="overflow-x-auto"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Approved actual</TableHead>
              <TableHead>Achievement</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Contribution</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.entries.map((entry) => (
              <TableRow key={entry.assignmentId}>
                <TableCell>
                  <Link
                    className="underline"
                    href={
                      personal
                        ? `/dashboard/me/kpi/${entry.assignmentId}`
                        : entry.achievementId
                          ? `/dashboard/kpi/reviews/${entry.achievementId}`
                          : `/dashboard/kpi/assignments`
                    }
                  >
                    {entry.kpiName}
                  </Link>
                </TableCell>
                <TableCell>{display(entry.target)}</TableCell>
                <TableCell>{display(entry.actual)}</TableCell>
                <TableCell>
                  {entry.scoredAchievement == null
                    ? "—"
                    : `${entry.scoredAchievement}%`}
                </TableCell>
                <TableCell>{entry.weight}%</TableCell>
                <TableCell>
                  {entry.weightedContribution == null
                    ? "—"
                    : entry.weightedContribution}
                </TableCell>
                <TableCell>
                  {entry.targetStatus
                    ? label(entry.targetStatus)
                    : label(entry.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table></div>
      </div>
    </section>
  );
}
function numericValue(value: Record<string, unknown> | null): number | null {
  const candidate = value?.value;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function TrendPanel({
  trend,
  personal,
}: {
  trend: AnalyticsTrend;
  personal: boolean;
}) {
  const compatible = trend.points.filter(
    (point) =>
      point.comparable &&
      numericValue(point.target) !== null &&
      numericValue(point.approvedActual) !== null,
  );
  const data = compatible.map((point) => ({
    period: point.periodLabel,
    target: numericValue(point.target),
    actual: numericValue(point.approvedActual),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">Approved KPI trend</CardTitle>
        <CardDescription>
          Only matching definition versions and frequencies are charted. Missing
          periods are left blank.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {data.length ? (
          <div
            className="h-64"
            role="img"
            aria-label={data
              .map(
                (point) =>
                  `${point.period}: target ${point.target}, approved actual ${point.actual}`,
              )
              .join(", ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="target" fill="#64748b" name="Target" />
                <Bar dataKey="actual" fill="#16a34a" name="Approved actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No comparable approved numeric measurements yet.
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Approved actual</TableHead>
              <TableHead>Comparable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trend.points.map((point) => (
              <TableRow key={point.assignmentId}>
                <TableCell>
                  {personal ? (
                    <Link
                      className="underline"
                      href={`/dashboard/me/kpi/${point.assignmentId}`}
                    >
                      {point.periodLabel}
                    </Link>
                  ) : (
                    point.periodLabel
                  )}
                </TableCell>
                <TableCell>{display(point.target)}</TableCell>
                <TableCell>{display(point.approvedActual)}</TableCell>
                <TableCell>
                  {point.comparable ? "Yes" : point.limitation}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ComparisonPanel({ comparison }: { comparison: ComparisonPage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">{label(comparison.comparisonType)} scorecards</CardTitle>
        <CardDescription>{comparison.note}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Scorecard</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Completeness</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Comparison status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.reason?.includes("withheld") ? (
                    row.name
                  ) : (
                    <Link
                      className="underline"
                      href={`/dashboard/kpi/scorecards/${row.id}`}
                    >
                      {row.name}
                    </Link>
                  )}
                </TableCell>
                <TableCell>#{row.subjectId}</TableCell>
                <TableCell>
                  {row.completenessPercent == null
                    ? "Withheld"
                    : `${row.completenessPercent}%`}
                </TableCell>
                <TableCell>
                  {row.score == null ? "—" : `${row.score}%`}
                </TableCell>
                <TableCell>{row.reason ?? "Comparable"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {comparison.rows.length === 0 && (
          <p className="p-4 text-muted-foreground">
            No comparable scorecards for this scope and period.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TeamPanel({
  team,
  employeeNames,
  search,
  onSearchChange,
  onPageChange,
  onEmployeeSelect,
}: {
  team: TeamPage;
  employeeNames: Record<number, string>;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onEmployeeSelect: (employeeId: number) => void;
}) {
  return (
    <section className="pt-4" aria-label="My reporting team">
      <h2 className="flex items-center gap-2 text-2xl font-bold"><PeopleTeam24Regular className="text-primary" /> My reporting team</h2>
      <p className="mt-1 text-sm text-muted-foreground">Employees you manage. Select a name to see their details.</p>
      <div className="mt-4 max-w-sm">
        <Input
          aria-label="Search reporting team"
          contentBefore={<Search20Regular aria-hidden="true" />}
          placeholder="Search name or employee number"
          maxLength={80}
          value={search}
          onChange={(_, data) => onSearchChange(data.value)}
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Assigned KPIs</TableHead>
              <TableHead>Approved actuals</TableHead>
              <TableHead>Completeness</TableHead>
              <TableHead>Scorecard</TableHead>
              <TableHead>Evaluation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.rows.map((row) => (
              <TableRow key={row.employeeId}>
                <TableCell><button type="button" className="font-medium text-primary hover:underline" onClick={() => onEmployeeSelect(row.employeeId)}>{row.name?.trim() || employeeNames[row.employeeId]?.trim() || `Employee #${row.employeeId}`}</button></TableCell>
                <TableCell>{row.assignedKpis}</TableCell>
                <TableCell>{row.approvedKpis}</TableCell>
                <TableCell>
                  {row.completenessPercent == null
                    ? "N/A"
                    : `${row.completenessPercent}%`}
                </TableCell>
                <TableCell>
                  {row.scorecardId ? (
                    <Link
                      className="underline"
                      href={`/dashboard/kpi/scorecards/${row.scorecardId}`}
                    >
                      {row.scorecardScore == null
                        ? "Awaiting data"
                        : `${row.scorecardScore}%`}
                    </Link>
                  ) : (
                    "None"
                  )}
                </TableCell>
                <TableCell>
                  {row.evaluationStatus ? label(row.evaluationStatus) : "None"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {team.rows.length === 0 && (
          <p className="p-4 text-muted-foreground">
            {search.trim() ? "No employees match your search." : "No employees in your reporting scope."}
          </p>
        )}
        {team.total > team.limit && (
          <div className="mt-3 flex items-center justify-end gap-3 text-sm">
            <KpiFluentButton
              type="button"
              className="rounded border px-3 py-2 disabled:opacity-50"
              disabled={team.page <= 1}
              onClick={() => onPageChange(team.page - 1)}
            >
              Previous
            </KpiFluentButton>
            <span>
              Page {team.page} of {Math.ceil(team.total / team.limit)}
            </span>
            <KpiFluentButton
              type="button"
              className="rounded border px-3 py-2 disabled:opacity-50"
              disabled={team.page * team.limit >= team.total}
              onClick={() => onPageChange(team.page + 1)}
            >
              Next
            </KpiFluentButton>
          </div>
        )}
      </div>
    </section>
  );
}

function RatingPanel({ ratings }: { ratings: RatingDistribution }) {
  const kpi = ratings.kpi.map((item) => ({
    name: `Policy ${item.policyVersionId ?? "—"} · ${item.rating}`,
    count: item.count,
  }));
  const competency = ratings.competency.map((item) => ({
    name: `Template ${item.templateVersionId} · ${item.rating}`,
    count: item.count,
  }));
  return (
    <section
      className="grid gap-4 lg:grid-cols-2"
      aria-label="Finalized rating distributions"
    >
      {[
        { title: "Finalized KPI ratings", rows: kpi },
        { title: "Competency responses", rows: competency },
      ].map((group) => (
        <Card key={group.title}>
          <CardHeader>
            <CardTitle className="text-xl font-bold">{group.title}</CardTitle>
            <CardDescription>{ratings.note}</CardDescription>
          </CardHeader>
          <CardContent>
            {group.rows.length ? (
              <>
                <div
                  className="h-56"
                  role="img"
                  aria-label={group.rows
                    .map((item) => `${item.name}: ${item.count}`)
                    .join(", ")}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={group.rows}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        interval={0}
                        angle={-20}
                        height={70}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Policy or template and rating</TableHead>
                      <TableHead>Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((item) => (
                      <TableRow key={item.name}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <p className="text-muted-foreground">
                No finalized results in this scope.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function ScorecardTrendPanel({
  trend,
  personal,
}: {
  trend: ScorecardTrend;
  personal: boolean;
}) {
  const chart = trend.points
    .filter((point) => point.comparable && point.liveScore != null)
    .map((point) => ({
      period: point.periodLabel,
      score: Number(point.liveScore),
    }));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-bold">Scorecard history</CardTitle>
        <CardDescription>{trend.note}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {chart.length ? (
          <div
            className="h-64"
            role="img"
            aria-label={chart
              .map((point) => `${point.period}: ${point.score}% live score`)
              .join(", ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar
                  dataKey="score"
                  fill="#2563eb"
                  name="Comparable live score"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No complete, comparable live scorecards across periods.
          </p>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Live score</TableHead>
              <TableHead>Finalized appraisal snapshot</TableHead>
              <TableHead>Completeness</TableHead>
              <TableHead>Comparison</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trend.points.map((point) => (
              <TableRow key={point.scorecardId}>
                <TableCell>
                  <Link
                    className="underline"
                    href={`${personal ? "/dashboard/me/scorecards" : "/dashboard/kpi/scorecards"}/${point.scorecardId}`}
                  >
                    {point.periodLabel}
                  </Link>
                </TableCell>
                <TableCell>
                  {point.liveScore == null ? "—" : `${point.liveScore}%`}
                </TableCell>
                <TableCell>
                  {point.finalizedScore == null
                    ? "—"
                    : `${point.finalizedScore}%`}
                </TableCell>
                <TableCell>{point.completenessPercent}%</TableCell>
                <TableCell>{point.reason ?? "Comparable"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function KpiAnalyticsWorkspace({
  personal = false,
}: {
  personal?: boolean;
}) {
  const actor = useDashboardActor();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = readKpiToken();
  const [periods, setPeriods] = React.useState<KpiPeriod[]>([]);
  const [definitions, setDefinitions] = React.useState<HistoricalKpiDefinition[]>([]);
  const [coverage, setCoverage] = React.useState<AnalyticsCoverage | null>(null);
  const [periodId, setPeriodId] = React.useState("");
  const [departments, setDepartments] = React.useState<AdminRecord[]>([]);
  const [branches, setBranches] = React.useState<AdminRecord[]>([]);
  const [departmentSearch, setDepartmentSearch] = React.useState("");
  const [branchSearch, setBranchSearch] = React.useState("");
  const [cycles, setCycles] = React.useState<EvaluationCycle[]>([]);
  const [departmentId, setDepartmentId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [cycleId, setCycleId] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [definitionId, setDefinitionId] = React.useState("");
  const [approvalStatus, setApprovalStatus] = React.useState("");
  const [scorecardType, setScorecardType] = React.useState("");
  const [evaluationStatus, setEvaluationStatus] = React.useState("");
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [managerId, setManagerId] = React.useState("");
  const [subjectSearch, setSubjectSearch] = React.useState("");
  const [subjectOptions, setSubjectOptions] =
    React.useState<AnalyticsSubjects | null>(null);
  const [knownEmployeeNames, setKnownEmployeeNames] = React.useState<Record<number, string>>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("");
  const [overview, setOverview] = React.useState<AnalyticsOverview | null>(
    null,
  );
  const [scorecards, setScorecards] = React.useState<ScorecardPage | null>(
    null,
  );
  const [evaluations, setEvaluations] =
    React.useState<EvaluationSummary | null>(null);
  const [team, setTeam] = React.useState<TeamPage | null>(null);
  const [ratings, setRatings] = React.useState<RatingDistribution | null>(null);
  const [comparison, setComparison] = React.useState<ComparisonPage | null>(
    null,
  );
  const [comparisonType, setComparisonType] = React.useState<
    "department" | "branch"
  >("department");
  const [trendKey, setTrendKey] = React.useState("");
  const [trend, setTrend] = React.useState<AnalyticsTrend | null>(null);
  const [scorecardTrend, setScorecardTrend] =
    React.useState<ScorecardTrend | null>(null);
  const [page, setPage] = React.useState(1);
  const [teamPage, setTeamPage] = React.useState(1);
  const [teamSearch, setTeamSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const canManage =
    actor.roleNames?.some((role) =>
      [
        "COMPANY_ADMIN",
        "HR_MANAGER",
        "DEPARTMENT_MANAGER",
        "BRANCH_MANAGER",
        "MANAGEMENT",
      ].includes(role),
    ) ?? false;
  const isAdmin =
    actor.roleNames?.some((role) =>
      ["COMPANY_ADMIN", "HR_MANAGER"].includes(role),
    ) ?? false;
  const isExecutive =
    !isAdmin && (actor.roleNames?.includes("MANAGEMENT") ?? false);
  const isManager =
    !isAdmin &&
    !isExecutive &&
    (actor.roleNames?.some((role) =>
      ["DEPARTMENT_MANAGER", "BRANCH_MANAGER"].includes(role),
    ) ??
      false);
  const requestedEmployeeId = searchParams?.get("employeeId") ?? "";
  const employeeId = selectedEmployeeId;
  const activeFilterCount = [periodId, departmentId, branchId, cycleId, category, definitionId, approvalStatus, scorecardType, evaluationStatus, managerId, employeeId].filter(Boolean).length;
  React.useEffect(() => {
    setSelectedEmployeeId(
      /^\d+$/.test(requestedEmployeeId) ? requestedEmployeeId : "",
    );
  }, [requestedEmployeeId]);
  React.useEffect(() => {
    setKnownEmployeeNames({});
  }, [token]);
  React.useEffect(() => {
    if (personal || !token || (!isAdmin && !isManager)) return;
    let live = true;
    const timeout = setTimeout(() => {
      void kpiAnalyticsApi
        .subjects(token, { search: subjectSearch })
        .then((result) => {
          if (live) {
            setSubjectOptions(result);
            setKnownEmployeeNames((current) => ({
              ...current,
              ...Object.fromEntries(result.employees.map((employee) => [employee.id, employee.name])),
            }));
          }
        })
        .catch(() => {
          if (live) setSubjectOptions(null);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timeout);
    };
  }, [personal, token, isAdmin, isManager, subjectSearch]);
  React.useEffect(() => {
    if (personal || !token || !canManage) return;
    void kpiApi
      .periods(token)
      .then(setPeriods)
      .catch(() => setPeriods([]));
    // Cycle configuration is HR-only. Managers can still filter by the
    // periods and subjects available within their own reporting scope.
    if (isAdmin) {
      void evaluationApi
        .cycles(token)
        .then(setCycles)
        .catch(() => setCycles([]));
    }
    void kpiAnalyticsApi
      .historicalDefinitions(token)
      .then((result) => setDefinitions(result.rows))
      .catch(() => setDefinitions([]));
  }, [personal, token, canManage, isAdmin]);
  React.useEffect(() => {
    if (!analyticsEnabled || !actor.ready || !token || (!personal && !canManage) || (!personal && !isExecutive && !employeeId)) {
      setCoverage(null);
      return;
    }
    let live = true;
    void kpiAnalyticsApi.coverage(token, {
      ...(periodId ? { periodId: Number(periodId) } : {}),
      ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      ...(branchId ? { branchId: Number(branchId) } : {}),
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(managerId ? { managerId: Number(managerId) } : {}),
      ...(cycleId ? { cycleId: Number(cycleId) } : {}),
      ...(scorecardType ? { scorecardType: scorecardType as "employee" | "department" | "branch" | "manager_group" | "organization" } : {}),
      ...(evaluationStatus ? { evaluationStatus: evaluationStatus as "self_draft" | "self_submitted" | "self_returned" | "manager_draft" | "manager_submitted" | "hr_reviewed" | "approved" | "finalized" | "cancelled" } : {}),
    }).then((result) => { if (live) setCoverage(result); }).catch(() => { if (live) setCoverage(null); });
    return () => { live = false; };
  }, [actor.ready, token, personal, canManage, isExecutive, periodId, departmentId, branchId, employeeId, managerId, cycleId, scorecardType, evaluationStatus]);
  React.useEffect(() => {
    if (personal || !token || !canManage) return;
    let live = true;
    const timeout = setTimeout(() => {
      void Promise.all([
        listDepartments(token, { limit: 100, search: departmentSearch }),
        listBranches(token, { limit: 100, search: branchSearch }),
      ])
        .then(([departmentResult, branchResult]) => {
          if (live) {
            setDepartments(departmentResult.rows);
            setBranches(branchResult.rows);
          }
        })
        .catch(() => {
          if (live) {
            setDepartments([]);
            setBranches([]);
          }
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timeout);
    };
  }, [personal, token, canManage, departmentSearch, branchSearch]);
  React.useEffect(() => {
    if (
      !analyticsEnabled ||
      !actor.ready ||
      !token ||
      (!personal && !canManage) ||
      (!personal && !isExecutive && !employeeId)
    ) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    const filters = {
      ...(periodId ? { periodId: Number(periodId) } : {}),
      ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      ...(branchId ? { branchId: Number(branchId) } : {}),
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(managerId ? { managerId: Number(managerId) } : {}),
      page,
      limit: 10,
    };
    void Promise.all([
      kpiAnalyticsApi.overview(token, {
        ...filters,
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(category ? { category } : {}),
        ...(definitionId ? { definitionId: Number(definitionId) } : {}),
        ...(approvalStatus
          ? {
              approvalStatus: approvalStatus as
                | "approved"
                | "pending"
                | "missing"
                | "draft"
                | "returned"
                | "rejected",
            }
          : {}),
      }),
      kpiAnalyticsApi.scorecards(token, {
        ...filters,
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(definitionId ? { definitionId: Number(definitionId) } : {}),
        ...(category ? { category } : {}),
        ...(approvalStatus
          ? {
              approvalStatus: approvalStatus as
                | "approved"
                | "pending"
                | "missing"
                | "draft"
                | "returned"
                | "rejected",
            }
          : {}),
        ...(scorecardType
          ? {
              scorecardType: scorecardType as
                | "employee"
                | "department"
                | "branch"
                | "manager_group"
                | "organization",
            }
          : {}),
        ...(evaluationStatus
          ? {
              evaluationStatus: evaluationStatus as
                | "self_draft"
                | "self_submitted"
                | "self_returned"
                | "manager_draft"
                | "manager_submitted"
                | "hr_reviewed"
                | "approved"
                | "finalized"
                | "cancelled",
            }
          : {}),
      }),
      kpiAnalyticsApi.evaluations(token, {
        ...filters,
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(evaluationStatus
          ? {
              evaluationStatus: evaluationStatus as
                | "self_draft"
                | "self_submitted"
                | "self_returned"
                | "manager_draft"
                | "manager_submitted"
                | "hr_reviewed"
                | "approved"
                | "finalized"
                | "cancelled",
            }
          : {}),
      }),
    ])
      .then(([o, s, e]) => {
        if (live) {
          setOverview(o);
          setScorecards(s);
          setEvaluations(e);
        }
      })
      .catch((cause: unknown) => {
        if (live)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load KPI analytics",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [
    actor.ready,
    approvalStatus,
    scorecardType,
    evaluationStatus,
    managerId,
    branchId,
    canManage,
    category,
    cycleId,
    definitionId,
    departmentId,
    employeeId,
    isExecutive,
    page,
    periodId,
    personal,
    token,
  ]);
  React.useEffect(() => {
    if (!analyticsEnabled || !token || !isManager || personal) return;
    let live = true;
    const timeout = setTimeout(() => {
      void kpiAnalyticsApi
        .team(token, {
        ...(periodId ? { periodId: Number(periodId) } : {}),
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
        ...(branchId ? { branchId: Number(branchId) } : {}),
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(managerId ? { managerId: Number(managerId) } : {}),
        ...(category ? { category } : {}),
        ...(definitionId ? { definitionId: Number(definitionId) } : {}),
        ...(approvalStatus
          ? {
              approvalStatus: approvalStatus as
                | "approved"
                | "pending"
                | "missing"
                | "draft"
                | "returned"
                | "rejected",
            }
          : {}),
        ...(evaluationStatus
          ? {
              evaluationStatus: evaluationStatus as
                | "self_draft"
                | "self_submitted"
                | "self_returned"
                | "manager_draft"
                | "manager_submitted"
                | "hr_reviewed"
                | "approved"
                | "finalized"
                | "cancelled",
            }
          : {}),
        limit: 20,
        page: teamPage,
        ...(teamSearch.trim() ? { search: teamSearch.trim() } : {}),
        })
        .then((data) => {
          if (live) setTeam(data);
        })
        .catch(() => {
          if (live) setTeam(null);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timeout);
    };
  }, [
    branchId,
    cycleId,
    departmentId,
    employeeId,
    managerId,
    category,
    definitionId,
    approvalStatus,
    evaluationStatus,
    isManager,
    personal,
    periodId,
    teamPage,
    teamSearch,
    token,
  ]);
  React.useEffect(() => {
    if (!analyticsEnabled || !token || !isAdmin || personal) return;
    let live = true;
    void kpiAnalyticsApi
      .ratings(token, {
        ...(periodId ? { periodId: Number(periodId) } : {}),
        ...(cycleId ? { cycleId: Number(cycleId) } : {}),
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
        ...(branchId ? { branchId: Number(branchId) } : {}),
        ...(employeeId ? { employeeId: Number(employeeId) } : {}),
        ...(managerId ? { managerId: Number(managerId) } : {}),
        ...(evaluationStatus
          ? {
              evaluationStatus: evaluationStatus as
                | "self_draft"
                | "self_submitted"
                | "self_returned"
                | "manager_draft"
                | "manager_submitted"
                | "hr_reviewed"
                | "approved"
                | "finalized"
                | "cancelled",
            }
          : {}),
      })
      .then((data) => {
        if (live) setRatings(data);
      })
      .catch(() => {
        if (live) setRatings(null);
      });
    return () => {
      live = false;
    };
  }, [
    branchId,
    cycleId,
    departmentId,
    employeeId,
    managerId,
    evaluationStatus,
    isAdmin,
    personal,
    periodId,
    token,
  ]);
  React.useEffect(() => {
    if (
      !analyticsEnabled ||
      !token ||
      personal ||
      (!isAdmin && !isExecutive) ||
      !periodId
    ) {
      setComparison(null);
      return;
    }
    let live = true;
    void kpiAnalyticsApi
      .comparisons(token, {
        periodId: Number(periodId),
        comparisonType,
        ...(departmentId ? { departmentId: Number(departmentId) } : {}),
        ...(branchId ? { branchId: Number(branchId) } : {}),
        limit: 20,
      })
      .then((data) => {
        if (live) setComparison(data);
      })
      .catch(() => {
        if (live) setComparison(null);
      });
    return () => {
      live = false;
    };
  }, [
    comparisonType,
    departmentId,
    branchId,
    isAdmin,
    isExecutive,
    personal,
    periodId,
    token,
  ]);
  React.useEffect(() => {
    if (!analyticsEnabled || !token || !trendKey) {
      setTrend(null);
      return;
    }
    const [definitionId, employeeId] = trendKey.split(":").map(Number);
    let live = true;
    void kpiAnalyticsApi
      .trends(token, { definitionId, employeeId })
      .then((data) => {
        if (live) setTrend(data);
      })
      .catch(() => {
        if (live) setTrend(null);
      });
    return () => {
      live = false;
    };
  }, [token, trendKey]);
  React.useEffect(() => {
    if (
      !analyticsEnabled ||
      !token ||
      (!personal && !((isManager || isAdmin) && employeeId))
    ) {
      setScorecardTrend(null);
      return;
    }
    let live = true;
    void kpiAnalyticsApi
      .scorecardTrends(
        token,
        personal ? {} : { employeeId: Number(employeeId) },
      )
      .then((data) => {
        if (live) setScorecardTrend(data);
      })
      .catch(() => {
        if (live) setScorecardTrend(null);
      });
    return () => {
      live = false;
    };
  }, [employeeId, isAdmin, isManager, personal, token]);
  const trendOptions = Array.from(new Map((scorecards?.rows
      .filter((row) => row.subjectType === "employee")
      .flatMap((row) =>
        row.entries
          .filter((entry) => entry.definitionId)
          .map((entry) => ({
            key: `${entry.definitionId}:${row.subjectId}`,
            name: `${entry.kpiName} · ${personal ? "Me" : knownEmployeeNames[row.subjectId] ?? team?.rows.find((employee) => employee.employeeId === row.subjectId)?.name ?? `Employee #${row.subjectId}`}`,
          })),
      ) ?? []).map((option) => [option.key, option] as const)).values());
  const scorecardSummary = scorecards
    ? getScorecardPageSummary(scorecards)
    : null;
  const selectedEmployeeName = subjectOptions?.employees.find((item) => String(item.id) === employeeId)?.name
    ?? knownEmployeeNames[Number(employeeId)]
    ?? team?.rows.find((item) => String(item.employeeId) === employeeId)?.name
    ?? `Employee #${employeeId}`;
  const openEmployee = (id: number) => {
    setOverview(null);
    setScorecards(null);
    setEvaluations(null);
    setSelectedEmployeeId(String(id));
    setPage(1);
    router.replace(`/dashboard/kpi/analytics?employeeId=${id}`);
  };
  const closeEmployee = () => {
    setSelectedEmployeeId("");
    setTrendKey("");
    router.replace("/dashboard/kpi/analytics");
  };
  const renderDetails = (content: React.ReactNode) => {
    if (personal || isExecutive) return content;
    return (
      <Dialog open={Boolean(employeeId)} onOpenChange={(_, data) => { if (!data.open) closeEmployee(); }}>
        <DialogSurface style={{ width: "min(1080px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)" }} className="max-h-[calc(100dvh-24px)] overflow-y-auto">
          <DialogBody>
            <DialogTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close employee analytics" onClick={closeEmployee} />}><span className="text-3xl font-bold" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{selectedEmployeeName}</span></DialogTitle>
            <DialogContent className="min-w-0 space-y-6 pt-4">{content}</DialogContent>
            <DialogActions><Button appearance="secondary" onClick={closeEmployee}>Close</Button></DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    );
  };
  if (!analyticsEnabled)
    return (
      <p className="p-6">KPI analytics are disabled in this environment.</p>
    );
  if (actor.ready && !personal && !canManage)
    return (
      <p className="p-6">You do not have access to management analytics.</p>
    );
  return (
    <main className={`flex flex-col ${isManager && !personal ? "gap-0" : "gap-8"}`}>
      <header className="relative isolate -mx-3 overflow-hidden border-y border-border bg-card px-5 py-6 shadow-sm sm:-mx-4 sm:px-7 sm:py-8">
        <SharedDashboardHeroBackground />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ChartMultiple24Regular className="size-10 shrink-0 text-primary sm:size-12" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">KPI management</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>
                {personal ? "My performance overview" : "KPI performance analytics"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">Approved results, scorecard completeness, and evaluation progress</p>
            </div>
          </div>
          {!personal && <Button appearance="secondary" className="self-start sm:self-auto" icon={<Filter24Regular />} onClick={() => setFiltersOpen(true)}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>}
        </div>
      </header>
      {!personal && (
        <Dialog open={filtersOpen} onOpenChange={(_, data) => setFiltersOpen(data.open)}>
          <DialogSurface style={{ width: "min(900px, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)" }} className="max-h-[calc(100dvh-32px)] overflow-y-auto">
            <DialogBody>
              <DialogTitle><span className="text-2xl font-bold">Filter KPI analytics</span></DialogTitle>
              <DialogContent className="space-y-6 pt-2">
                <p className="text-sm text-muted-foreground">Choose a scope or KPI to narrow these results. Changes appear as you select them.</p>
          <section className="space-y-3 border-b border-border pb-5" aria-label="Reporting scope">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold"><Filter24Regular className="text-primary" /> Scope and period</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              Reporting period
              <KpiFluentSelect
                aria-label="Reporting period"
                appearance="underline"
                className="w-full"
                value={periodId}
                onChange={(event) => {
                  setPeriodId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All periods</option>
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label} · {period.frequency}
                  </option>
                ))}
              </KpiFluentSelect>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              Find department
              <Input appearance="underline"
                aria-label="Find department"
                className="w-full"
                value={departmentSearch}
                onChange={(event) => setDepartmentSearch(event.target.value)}
                placeholder="Search departments"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              Department
              <KpiFluentSelect
                aria-label="Department"
                appearance="underline"
                className="w-full"
                value={departmentId}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All departments</option>
                {departments.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {String(
                      item.name ??
                        item.department_name ??
                        `Department #${item.id}`,
                    )}
                  </option>
                ))}
              </KpiFluentSelect>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              Find branch
              <Input appearance="underline"
                aria-label="Find branch"
                className="w-full"
                value={branchSearch}
                onChange={(event) => setBranchSearch(event.target.value)}
                placeholder="Search branches"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              Branch
              <KpiFluentSelect
                aria-label="Branch"
                appearance="underline"
                className="w-full"
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All branches</option>
                {branches.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {String(
                      item.name ?? item.branch_name ?? `Branch #${item.id}`,
                    )}
                  </option>
                ))}
              </KpiFluentSelect>
            </label>
            {cycles.length > 0 && (
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                Evaluation cycle
                <KpiFluentSelect
                  aria-label="Evaluation cycle"
                  appearance="underline"
                className="w-full"
                  value={cycleId}
                  onChange={(event) => {
                    setCycleId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All cycles</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </option>
                  ))}
                </KpiFluentSelect>
              </label>
            )}
          </div>
          </section>
          <section
          className="grid gap-4 border-b border-border pb-5 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="People and scorecard filters"
        >
          <h2 className="col-span-full text-xl font-bold">People and evaluation</h2>
          {(isAdmin || isManager) && (
            <>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                Find a person
                <Input appearance="underline"
                  aria-label="Find a person"
                  className="w-full"
                  value={subjectSearch}
                  onChange={(event) => setSubjectSearch(event.target.value)}
                  placeholder="Search by name"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                Employee
                <KpiFluentSelect
                  aria-label="Employee"
                  appearance="underline"
                className="w-full"
                  value={employeeId}
                  onChange={(event) => {
                    setFiltersOpen(false);
                    if (event.target.value) openEmployee(Number(event.target.value));
                    else closeEmployee();
                  }}
                >
                  <option value="">All authorized employees</option>
                  {subjectOptions?.employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </KpiFluentSelect>
              </label>
              {isAdmin && (
                <label className="flex min-w-0 flex-col gap-1 text-sm">
                  Responsible manager
                  <KpiFluentSelect
                    aria-label="Responsible manager"
                    appearance="underline"
                className="w-full"
                    value={managerId}
                    onChange={(event) => {
                      setManagerId(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All managers</option>
                    {subjectOptions?.managers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </KpiFluentSelect>
                </label>
              )}
            </>
          )}
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            Scorecard type
            <KpiFluentSelect
              aria-label="Scorecard type"
              appearance="underline"
                className="w-full"
              value={scorecardType}
              onChange={(event) => {
                setScorecardType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All types</option>
              {[
                "employee",
                "department",
                "branch",
                "manager_group",
                "organization",
              ]
                .filter((value) => !isExecutive || value === "organization")
                .map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
            </KpiFluentSelect>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            Evaluation status
            <KpiFluentSelect
              aria-label="Evaluation status"
              appearance="underline"
                className="w-full"
              value={evaluationStatus}
              onChange={(event) => {
                setEvaluationStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                "self_draft",
                "self_submitted",
                "self_returned",
                "manager_draft",
                "manager_submitted",
                "hr_reviewed",
                "approved",
                "finalized",
                "cancelled",
              ].map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </KpiFluentSelect>
          </label>
          </section>
          <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="KPI assignment filters"
        >
          <h2 className="col-span-full text-xl font-bold">KPI filters</h2>
          {definitions.length > 0 && (
            <>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                KPI category
                <KpiFluentSelect
                  aria-label="KPI category"
                  appearance="underline"
                className="w-full"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setDefinitionId("");
                  }}
                >
                  <option value="">All categories</option>
                  {Array.from(
                    new Set(
                      definitions
                        .map((item) => item.category)
                        .filter((value): value is string => !!value),
                    ),
                  )
                    .sort()
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </KpiFluentSelect>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-sm">
                KPI definition
                <KpiFluentSelect
                  aria-label="KPI definition"
                  appearance="underline"
                className="w-full"
                  value={definitionId}
                  onChange={(event) => setDefinitionId(event.target.value)}
                >
                  <option value="">All definitions</option>
                  {definitions
                    .filter(
                      (item) =>
                        !category || item.category === category,
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.status === "archived" ? "(archived)" : ""}
                      </option>
                    ))}
                </KpiFluentSelect>
              </label>
            </>
          )}
          <label className="flex min-w-0 flex-col gap-1 text-sm">
            Submission status
            <KpiFluentSelect
              aria-label="Submission status"
              appearance="underline"
                className="w-full"
              value={approvalStatus}
              onChange={(event) => setApprovalStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "approved",
                "pending",
                "missing",
                "draft",
                "returned",
                "rejected",
              ].map((item) => (
                <option key={item} value={item}>
                  {label(item)}
                </option>
              ))}
            </KpiFluentSelect>
          </label>
          </section>
              </DialogContent>
              <DialogActions>
                {activeFilterCount > 0 && (
                  <Button appearance="subtle" onClick={() => {
                    setPeriodId(""); setDepartmentId(""); setBranchId(""); setCycleId("");
                    setCategory(""); setDefinitionId(""); setApprovalStatus("");
                    setScorecardType(""); setEvaluationStatus(""); setManagerId("");
                    closeEmployee(); setDepartmentSearch(""); setBranchSearch(""); setSubjectSearch("");
                    setPage(1);
                  }}>Clear all</Button>
                )}
                <Button appearance="primary" onClick={() => setFiltersOpen(false)}>Done</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
      {isAdmin && !personal && (
        <section className="max-w-xl space-y-3" aria-label="Select employee">
          <h2 className="text-2xl font-bold">Employee performance</h2>
          <p className="text-sm text-muted-foreground">Select an employee to open their KPI results.</p>
          <Input aria-label="Find employee" placeholder="Search employees" value={subjectSearch} onChange={(_, data) => setSubjectSearch(data.value)} />
          <KpiFluentSelect aria-label="Select employee" className="w-full" value={employeeId} onChange={(event) => { if (event.target.value) openEmployee(Number(event.target.value)); else closeEmployee(); }}>
            <option value="">Select an employee</option>
            {subjectOptions?.employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </KpiFluentSelect>
        </section>
      )}
      {isManager && !personal && team && <TeamPanel team={team} employeeNames={knownEmployeeNames} search={teamSearch} onSearchChange={(value) => { setTeamSearch(value); setTeamPage(1); }} onPageChange={setTeamPage} onEmployeeSelect={openEmployee} />}
      {renderDetails(<>
      {loading && <p role="status">Loading authorized performance data…</p>}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Analytics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!loading && !error && overview && evaluations && scorecards && (
        <>
          <section aria-label="Performance at a glance" className="space-y-5 rounded-xl bg-primary/5 p-5">
            <h2 className="flex items-center gap-2 text-2xl font-bold"><ChartMultiple24Regular className="text-primary" /> At a glance</h2>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              title="Assigned KPIs"
              value={overview.assignments.total}
            />
            <Metric
              title="Approved actuals"
              value={overview.assignments.approved}
            />
            <Metric
              title="KPI data completeness"
              value={
                overview.completenessPercent == null
                  ? "N/A"
                  : `${overview.completenessPercent}%`
              }
            />
            <Metric
              title="Finalized evaluations"
              value={evaluations.summary.finalized ?? "N/A"}
            />
          </div>
          </section>
          {!isExecutive && trendOptions.length > 0 && (
            <section className="space-y-4 border-t border-border pt-6" aria-label="KPI historical trend">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-2xl font-bold"><ChartMultiple24Regular className="text-primary" /> KPI historical trend</h2>
                <KpiFluentSelect
                  aria-label="KPI historical trend"
                  className="w-full sm:w-72"
                  value={trendKey}
                  onChange={(event) => setTrendKey(event.target.value)}
                >
                  <option value="">{personal || employeeId ? "Select a KPI" : "Select a KPI and employee"}</option>
                  {trendOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.name}
                    </option>
                  ))}
                </KpiFluentSelect>
              </div>
              {trend ? <TrendPanel trend={trend} personal={personal} /> : <p className="text-sm text-muted-foreground">Choose a KPI to view its approved results over time.</p>}
            </section>
          )}
          {coverage && (
            <section aria-label="Scorecard coverage" className="space-y-5 border-t border-border pt-6">
              <h2 className="flex items-center gap-2 text-2xl font-bold"><ClipboardTaskListLtr24Regular className="text-primary" /> {personal || employeeId ? "Scorecard status" : "Published scorecard coverage"}</h2>
              {coverage.suppressed ? <p className="text-sm text-muted-foreground">{coverage.reason}</p> : personal || employeeId ? (
                (coverage.scorecards ?? 0) === 0 ? (
                  <div className="flex items-start gap-4 rounded-xl border border-dashed border-border bg-muted/30 p-5">
                    <ClipboardTaskListLtr24Regular className="mt-0.5 shrink-0 text-primary" />
                    <div>
                      <h3 className="text-xl font-bold">No published scorecard yet</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Draft scorecards, if any, appear in the scorecard list below. Once published, their completion status will appear here.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Published scorecards for this employee. Drafts appear in the list below and are excluded from these totals.</p>
                    <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                      <Metric title="Published" value={coverage.scorecards ?? 0} />
                      <Metric title="Complete" value={coverage.completeScorecards ?? 0} detail="All required results approved" />
                      <Metric title="Incomplete" value={coverage.incompleteScorecards ?? 0} />
                      <Metric title="Awaiting approved data" value={coverage.awaitingApprovedAchievements ?? 0} detail="Included in incomplete" />
                    </div>
                  </>
                )
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">How many employees have published scorecards, and how many have approved results. Draft scorecards appear in the list below but are excluded here.</p>
                  <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric title="Active or onboarding employees in scope" value={coverage.eligibleEmployees ?? 0} />
                    <Metric title="Employees with scorecards" value={coverage.employeesWithScorecards ?? 0} />
                    <Metric title="Employees without scorecards" value={coverage.employeesWithoutScorecards ?? 0} />
                    <Metric title="Published scorecards" value={coverage.scorecards ?? 0} />
                    <Metric title="Complete scorecards" value={coverage.completeScorecards ?? 0} detail="All required entries have approved actuals" />
                    <Metric title="Incomplete scorecards" value={coverage.incompleteScorecards ?? 0} />
                    <Metric title="Awaiting approved data" value={coverage.awaitingApprovedAchievements ?? 0} detail="Subset of incomplete scorecards" />
                    <Metric title="Evaluations in progress" value={coverage.evaluationsInProgress ?? "N/A"} />
                  </div>
                  <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">How coverage is counted</summary><p className="mt-2">{coverage.note}</p></details>
                </>
              )}
            </section>
          )}
          {!personal && !employeeId && (
            <Alert>
              <AlertTitle>{overview.overallIndexStatus}</AlertTitle>
              <AlertDescription>
                Company KPIs use different units and policies. Review complete
                scorecards individually; no company-wide average is calculated.
              </AlertDescription>
            </Alert>
          )}
          {evaluations.summary.suppressed && (
            <Alert>
              <AlertTitle>Evaluation aggregate withheld</AlertTitle>
              <AlertDescription>
                Confidential evaluation totals remain unavailable to executive
                analytics until an organization disclosure policy is approved.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <StatusChart counts={overview.assignments} />
            <EvaluationChart summary={evaluations.summary} />
          </div>
          {!isExecutive && (
            <p className="text-sm">
              <Link
                className="underline"
                href={
                  personal
                    ? "/dashboard/me/evaluations"
                    : "/dashboard/kpi/evaluations"
                }
              >
                Open authorized evaluation records and review history
              </Link>
              {!personal && isAdmin && (
                <>
                  <span className="mx-2">·</span>
                  <Link
                    className="underline"
                    href="/dashboard/kpi/evaluation-cycles"
                  >
                    Open evaluation cycles
                  </Link>
                </>
              )}
            </p>
          )}
          <section className="space-y-4 border-t border-border pt-6" aria-label="Items needing attention">
          <h2 className="text-2xl font-bold">Needs attention</h2>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              title="Awaiting review"
              value={overview.assignments.pendingReview}
            />
            <Metric
              title="Missing submissions"
              value={overview.assignments.missing}
            />
            <Metric title="Returned" value={overview.assignments.returned} />
            <Metric
              title="Evaluation completion"
              value={
                evaluations.summary.completionPercent == null
                  ? "N/A"
                  : `${evaluations.summary.completionPercent}%`
              }
              detail={
                evaluationStatus
                  ? "Clear the evaluation-status filter to view the full eligible completion rate"
                  : "Finalized / enrolled evaluations"
              }
            />
          </div>
          </section>
          <section className="space-y-4 border-t border-border pt-6" aria-label="Evaluation workflow">
          <h2 className="text-2xl font-bold">Evaluation workflow</h2>
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              title="Active evaluation cycles"
              value={evaluations.summary.activeCycles ?? "N/A"}
            />
            <Metric
              title="Pending self-assessments"
              value={evaluations.summary.pendingSelf ?? "N/A"}
            />
            <Metric
              title="Pending manager reviews"
              value={evaluations.summary.pendingManager ?? "N/A"}
            />
            <Metric
              title="Overdue evaluation steps"
              value={evaluations.summary.overdue ?? "N/A"}
              detail="Company-local deadline dates; soft deadlines remain open"
            />
            {(isAdmin || isExecutive) && !personal && (
              <Metric
                title="Pending HR reviews"
                value={evaluations.summary.pendingHr ?? "N/A"}
              />
            )}
            {(isAdmin || isExecutive) && !personal && (
              <Metric
                title="Acknowledged"
                value={evaluations.summary.acknowledged ?? "N/A"}
              />
            )}
            {(isAdmin || isExecutive) && !personal && (
              <Metric
                title="Disputed"
                value={evaluations.summary.disputed ?? "N/A"}
              />
            )}
          </div>
          </section>
          {isAdmin && !personal && ratings && <RatingPanel ratings={ratings} />}
          {(isAdmin || isExecutive) && !personal && periods.length > 0 && (
            <section className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Organization comparison
                <KpiFluentSelect
                  aria-label="Organization comparison"
                  className="w-fit rounded-md border bg-background px-3 py-2"
                  value={comparisonType}
                  onChange={(event) =>
                    setComparisonType(
                      event.target.value as "department" | "branch",
                    )
                  }
                >
                  <option value="department">Departments</option>
                  <option value="branch">Branches</option>
                </KpiFluentSelect>
              </label>
              {comparison ? (
                <ComparisonPanel comparison={comparison} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a reporting period to compare complete scorecards under
                  the same policy.
                </p>
              )}
            </section>
          )}
          {scorecardTrend && (
            <ScorecardTrendPanel trend={scorecardTrend} personal={personal} />
          )}
          <section className="flex flex-col gap-3 border-t border-border pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {personal ? "My scorecards" : "Authorized scorecards"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {scorecards.total} in this view
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {scorecardSummary?.withheld
                ? `${scorecardSummary.withheld} scorecard details withheld on this page.`
                : `This page: ${scorecardSummary?.complete ?? 0} complete, ${scorecardSummary?.incomplete ?? 0} awaiting approved data. Draft scorecards can appear here.`}{" "}
              {overview.riskStatusStatus}.
            </p>
            {scorecards.rows.length ? (
              scorecards.rows.map((row) => (
                <ScorecardPanel key={row.id} row={row} personal={personal} subjectName={row.subjectType === "employee" ? subjectOptions?.employees.find((item) => String(item.id) === String(row.subjectId))?.name ?? team?.rows.find((item) => String(item.employeeId) === String(row.subjectId))?.name : undefined} />
              ))
            ) : (
              <Card>
                <CardContent className="text-muted-foreground">
                  No scorecards are available for this scope and period.
                </CardContent>
              </Card>
            )}
            {scorecards.total > scorecards.limit && (
              <div className="flex items-center gap-3">
                <KpiFluentButton
                  className="rounded border px-3 py-2 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </KpiFluentButton>
                <span>
                  Page {page} of{" "}
                  {Math.ceil(scorecards.total / scorecards.limit)}
                </span>
                <KpiFluentButton
                  className="rounded border px-3 py-2 disabled:opacity-50"
                  disabled={page * scorecards.limit >= scorecards.total}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </KpiFluentButton>
              </div>
            )}
          </section>
          <footer className="text-xs text-muted-foreground">
            Updated {new Date(overview.refreshedAt).toLocaleString()} · Live
            scorecards may change after approval. Finalized appraisals retain
            their recorded snapshots. {overview.privacy ?? ""}
          </footer>
        </>
      )}
      </>)}
    </main>
  );
}
