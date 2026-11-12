"use client";

import * as React from "react";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Badge, Button, Card, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, tokens } from "@fluentui/react-components";
import { ArrowRight20Regular } from "@fluentui/react-icons";
import { readKpiToken } from "@/lib/kpi-session";
import { scorecardApi, type Scorecard } from "@/lib/scorecard-api";
import { selectCurrentPersonalScorecard, selectPersonalPeriod } from "@/lib/personal-performance";
import { KpiFeedback, KpiPageHeader, KpiStatusBadge } from "@/components/dashboard/kpi/kpi-page-elements";

function valueText(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`).join(" · ");
  return String(value);
}

export default function MyScorecardsPage() {
  const [rows, setRows] = React.useState<Scorecard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    const token = readKpiToken();
    if (!token) { setError("Sign in to view your scorecards."); setLoading(false); return; }
    setLoading(true);
    try { setRows(await scorecardApi.mine(token)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load your scorecards."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("hrms:refresh-page-data", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("hrms:refresh-page-data", refresh); window.removeEventListener("focus", refresh); };
  }, [load]);
  const today = new Date().toISOString().slice(0, 10);
  const period = selectPersonalPeriod([], rows, today);
  const current = selectCurrentPersonalScorecard(rows, period?.id ?? null);
  const history = rows.filter((row) => row.id !== current?.id).sort((a, b) =>
    (b.period?.endDate ?? "").localeCompare(a.period?.endDate ?? "") ||
    (b.currentVersion?.publishedAt ?? "").localeCompare(a.currentVersion?.publishedAt ?? "") || b.id - a.id,
  );
  const grouped = new Map<string, Scorecard[]>();
  history.forEach((row) => { const key = `${row.periodId}:${row.period?.label ?? "Period unavailable"}`; grouped.set(key, [...(grouped.get(key) ?? []), row]); });
  return <main className="space-y-4 pt-3">
    <KpiPageHeader title="My Scorecards" description="Current approved performance and distinct historical configurations. Live results may change; finalized appraisals stay frozen." section="My Performance" />
    {loading && <div className="py-4"><Spinner size="small" label="Loading your scorecards" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && rows.length === 0 && <Card appearance="outline" className="p-5"><Text as="h2" size={400} weight="semibold">No published personal scorecards</Text><Text as="p" size={300} style={{ color: tokens.colorNeutralForeground2 }}>HR or your authorized manager must publish a scorecard for an assigned KPI period. You can review your assignments in My KPIs.</Text><Button as="a" href="/dashboard/me/kpi" appearance="secondary">View My KPIs</Button></Card>}
    {!loading && !error && current && <Card appearance="outline" className="gap-4 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-col gap-1"><Text as="h2" size={500} weight="semibold">Current scorecard</Text><Text as="p" size={300}>{current.currentVersion.name} · {current.period?.label ?? "Reporting period unavailable"}</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Configuration v{current.currentVersion.version} · Scorecard #{current.id}</Text></div><KpiStatusBadge status={current.performanceStatus} /></div><div className="flex flex-wrap items-center gap-3"><Text size={500} weight="semibold">{current.performanceStatus === "scored" && current.overallScore !== null ? `Live approved score: ${current.overallScore}%` : "Awaiting approved data"}</Text><Badge appearance="outline">{current.completenessPercent ?? "0"}% complete</Badge></div>{current.performanceStatus === "partial" && <KpiFeedback intent="info">Approved data is incomplete ({current.completenessPercent ?? "0"}% complete). No final score is shown.</KpiFeedback>}{current.performanceStatus === "awaiting_data" && <Text size={300}>Your score will appear after the required achievements are approved.</Text>}
      <div className="overflow-x-auto"><Table size="small" aria-label="Current scorecard KPI breakdown"><TableHeader><TableRow><TableHeaderCell>KPI</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell><TableHeaderCell>Approved actual</TableHeaderCell><TableHeaderCell>Weight</TableHeaderCell><TableHeaderCell>Contribution</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell></TableRow></TableHeader><TableBody>{current.entries.map((entry) => <TableRow key={entry.assignmentId}><TableCell>{entry.kpiName ?? `KPI #${entry.assignmentId}`}</TableCell><TableCell>{valueText(entry.target)}</TableCell><TableCell>{valueText(entry.actual)}</TableCell><TableCell>{entry.weight}%</TableCell><TableCell>{entry.weightedScore ?? "—"}</TableCell><TableCell><KpiStatusBadge status={entry.status ?? "awaiting_data"} /></TableCell></TableRow>)}</TableBody></Table></div><Button as="a" href={`/dashboard/me/scorecards/${current.id}`} appearance="secondary" className="self-start">View calculation details <ArrowRight20Regular aria-hidden /></Button></Card>}
    {!loading && !error && history.length > 0 && <Card appearance="outline" className="gap-3 p-4 sm:p-5"><div className="flex flex-col gap-1"><Text as="h2" size={400} weight="semibold">History</Text><Text as="p" size={200} style={{ color: tokens.colorNeutralForeground2 }}>Scorecards are grouped by reporting period. Each row is a distinct scorecard and configuration version; finalized evaluation snapshots are in My Evaluations.</Text></div><Accordion collapsible multiple>{[...grouped].map(([key, periodRows]) => <AccordionItem key={key} value={key}><AccordionHeader>{periodRows[0].period?.label ?? "Period unavailable"} · {periodRows.length} scorecard{periodRows.length === 1 ? "" : "s"}</AccordionHeader><AccordionPanel><div className="grid gap-2 sm:grid-cols-2">{periodRows.map((row) => <Card key={row.id} appearance="filled-alternative" className="gap-2 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><Text weight="semibold">{row.currentVersion?.name ?? row.code}</Text><KpiStatusBadge status={row.performanceStatus} /></div><Text size={200}>Scorecard #{row.id} · configuration v{row.currentVersion?.version ?? "—"}</Text><Text size={200}>{row.performanceStatus === "scored" && row.overallScore !== null ? `Live approved score: ${row.overallScore}%` : `Awaiting approved data · ${row.completenessPercent ?? "0"}% complete`}</Text><Button as="a" href={`/dashboard/me/scorecards/${row.id}`} appearance="subtle" size="small" className="self-start">View scorecard</Button></Card>)}</div></AccordionPanel></AccordionItem>)}</Accordion></Card>}
  </main>;
}
