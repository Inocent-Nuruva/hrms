"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { personalKpiSectionTabGroups } from "@/lib/dashboard-sections";

export function PersonalKpiLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const personalKpiRoute = pathname === "/dashboard/me/kpi" ||
    pathname.startsWith("/dashboard/me/kpi/") ||
    pathname === "/dashboard/me/scorecards" ||
    pathname.startsWith("/dashboard/me/scorecards/") ||
    pathname === "/dashboard/me/evaluations" ||
    pathname.startsWith("/dashboard/me/evaluations/");
  if (!personalKpiRoute) return <>{children}</>;
  return <div className="flex min-w-0 flex-col">
    <DashboardSectionTabs groups={personalKpiSectionTabGroups} />
    <div className="min-w-0">{children}</div>
  </div>;
}
