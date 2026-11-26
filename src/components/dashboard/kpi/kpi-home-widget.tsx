"use client";

import * as React from "react";
import Link from "next/link";
import { ProgressBar } from "@fluentui/react-components";
import { ArrowRight20Regular, ChartMultiple24Regular, CheckmarkCircle24Regular, Clock24Regular, Target24Regular } from "@fluentui/react-icons";
import {
  kpiAnalyticsApi,
  type AnalyticsOverview,
} from "@/lib/kpi-analytics-api";
import { analyticsEnabled, readKpiToken } from "@/lib/kpi-session";

export function KpiHomeWidget({ personal }: { personal: boolean }) {
  const [summary, setSummary] = React.useState<AnalyticsOverview | null>(null);
  React.useEffect(() => {
    if (!analyticsEnabled) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = () => {
      const token = readKpiToken();
      if (!token) {
        if (attempts++ < 20) timer = setTimeout(load, 500);
        return;
      }
      void kpiAnalyticsApi
        .overview(token)
        .then((result) => {
          if (live) setSummary(result);
        })
        .catch(() => {
          if (live) setSummary(null);
        });
    };
    load();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  if (!analyticsEnabled || !summary) return null;
  const total = summary.assignments.total;
  const approved = summary.assignments.approved;
  const completeness = summary.completenessPercent == null ? null : Math.max(0, Math.min(100, Number(summary.completenessPercent)));
  const percentLabel = completeness === null || !Number.isFinite(completeness) ? "—" : `${Math.round(completeness)}%`;
  const stats = [
    { label: "Assigned KPIs", value: total, icon: <Target24Regular aria-hidden="true" /> },
    { label: "Approved results", value: approved, icon: <CheckmarkCircle24Regular aria-hidden="true" /> },
    { label: "Awaiting review", value: summary.assignments.pendingReview, icon: <Clock24Regular aria-hidden="true" /> },
  ];
  return (
    <section className="mx-3 my-5 border-y border-border bg-background py-5 sm:mx-4 md:my-6" aria-labelledby="home-kpi-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ChartMultiple24Regular aria-hidden="true" /></span>
          <div><h2 id="home-kpi-title" className="text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>KPI performance</h2><p className="mt-0.5 text-sm text-muted-foreground">Approved results in your authorized scope</p></div>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href={personal ? "/dashboard/me/kpi" : "/dashboard/kpi/analytics"}>View details <ArrowRight20Regular aria-hidden="true" /></Link>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(13rem,1fr)_minmax(0,2fr)] lg:items-center lg:gap-8">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3"><span className="text-3xl font-semibold tabular-nums text-primary" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{percentLabel}</span><span className="text-xs text-muted-foreground">data complete</span></div>
          <ProgressBar value={completeness === null || !Number.isFinite(completeness) ? 0 : completeness / 100} thickness="large" aria-label={`${percentLabel} of assigned KPI results approved`} />
          <p className="text-xs text-muted-foreground">{total > 0 ? `${approved} of ${total} assigned KPIs have approved results` : "No KPIs assigned in this scope yet"}</p>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-border border-t border-border pt-4 lg:border-t-0 lg:pt-0">
          {stats.map((item) => <div key={item.label} className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-5"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden text-primary sm:inline-flex">{item.icon}</span>{item.label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums text-foreground" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{item.value}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}
