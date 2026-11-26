"use client";

import * as React from "react";
import { Button, Spinner, Tab, TabList } from "@fluentui/react-components";
import { readKpiToken } from "@/lib/kpi-session";
import { scorecardApi, type Scorecard } from "@/lib/scorecard-api";
import { selectVisiblePersonalScorecards } from "@/lib/personal-performance";
import { KpiFeedback, KpiPageHeader } from "@/components/dashboard/kpi/kpi-page-elements";
import { ScorecardCollection } from "@/components/dashboard/kpi/scorecard-collection";
import type { ScorecardCollectionView } from "@/components/dashboard/kpi/scorecard-collection-model";
import styles from "@/components/dashboard/kpi/scorecard-collection.module.css";

export default function MyScorecardsPage() {
  const [rows, setRows] = React.useState<Scorecard[]>([]);
  const [view, setView] = React.useState<ScorecardCollectionView>("grid");
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

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentScorecards = selectVisiblePersonalScorecards(rows, today);
  const hasActivePeriod = currentScorecards.some((row) => !!row.period?.startDate && !!row.period?.endDate && row.period.startDate <= today && today <= row.period.endDate);
  const currentIds = new Set(currentScorecards.map((row) => row.id));
  const history = rows.filter((row) => !currentIds.has(row.id)).sort((a, b) =>
    (b.period?.endDate ?? "").localeCompare(a.period?.endDate ?? "") ||
    (b.currentVersion?.publishedAt ?? "").localeCompare(a.currentVersion?.publishedAt ?? "") || b.id - a.id,
  );
  const grouped = new Map<string, Scorecard[]>();
  history.forEach((row) => {
    const key = `${row.periodId}:${row.period?.label ?? "Period unavailable"}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  });

  return <main className={`min-w-0 space-y-6 pt-3 ${styles.page}`}>
    <KpiPageHeader title="My Scorecards" section="My Performance" />
    {loading && <div className="py-4"><Spinner size="small" label="Loading your scorecards" /></div>}
    {error && <KpiFeedback intent="error">{error}</KpiFeedback>}
    {!loading && !error && rows.length === 0 && <div className="space-y-3 py-8"><h2 className="text-lg font-semibold">No scorecards yet</h2><p className="text-sm text-muted-foreground">Your published scorecards will appear here when they are ready.</p><Button as="a" href="/dashboard/me/kpi" appearance="secondary">View My KPIs</Button></div>}
    {!loading && !error && rows.length > 0 && <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className={`font-semibold ${styles.sectionHeading}`}>{currentScorecards.length > 0 ? (hasActivePeriod ? "Current scorecards" : "Latest scorecards") : "My scorecards"} <span className="font-normal text-muted-foreground">({currentScorecards.length || rows.length})</span></h2>
        <TabList size="small" aria-label="Scorecard view" selectedValue={view} onTabSelect={(_, data) => setView(data.value as ScorecardCollectionView)}><Tab value="grid">Grid</Tab><Tab value="list">List</Tab></TabList>
      </div>
      {currentScorecards.length > 0 && <ScorecardCollection scorecards={currentScorecards} view={view} label={hasActivePeriod ? "Current scorecards" : "Latest scorecards"} />}
      {history.length > 0 && <div className="space-y-5 pt-2"><h3 className={`border-b border-border pb-3 font-semibold ${styles.groupHeading}`}>History ({history.length})</h3>{[...grouped].map(([key, periodRows]) => <div key={key} className="space-y-3"><h4 className="break-words text-sm font-medium text-muted-foreground [overflow-wrap:anywhere]">{periodRows[0].period?.label ?? "Period unavailable"}</h4><ScorecardCollection scorecards={periodRows} view={view} label={`${periodRows[0].period?.label ?? "Period"} scorecards`} /></div>)}</div>}
    </>}
  </main>;
}
