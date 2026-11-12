"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./kpi-fluent-surface";
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
  return (
    <Card className="mx-4 mb-4 md:mx-8">
      <CardHeader>
        <CardTitle>KPI performance</CardTitle>
        <CardDescription>
          Approved results for your authorized scope ·{" "}
          {summary.completenessPercent == null
            ? "No eligible KPIs"
            : `${summary.completenessPercent}%`}{" "}
          data complete
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <span className="text-sm">{summary.assignments.total} assigned</span>
        <span className="text-sm">{summary.assignments.approved} approved</span>
        <span className="text-sm">
          {summary.assignments.pendingReview} awaiting review
        </span>
        <Link
          className="ml-auto text-sm font-medium underline"
          href={
            personal ? "/dashboard/me/kpi/overview" : "/dashboard/kpi/analytics"
          }
        >
          Open performance dashboard
        </Link>
      </CardContent>
    </Card>
  );
}
