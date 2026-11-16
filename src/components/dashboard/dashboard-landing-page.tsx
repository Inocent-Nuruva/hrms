"use client";

import { EmployeeHomeDashboard } from "@/components/dashboard/employee-home-dashboard";
import { KpiHomeWidget } from "@/components/dashboard/kpi/kpi-home-widget";
import { PlatformAdminDashboard } from "@/components/dashboard/platform-admin-dashboard";
import {
  InsightsOperationsView,
  type InsightsOpsTab,
} from "@/components/dashboard/insights-operations-view";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { resolveHomeDashboardKind } from "@/lib/dashboard-home";

const INSIGHTS_HOME_TABS = new Set<InsightsOpsTab>([
  "management",
  "manager",
  "sales-field",
]);

/**
 * `/dashboard` shows the dashboard that belongs to this person's role:
 * HR, management, line manager, sales-field, company admin, or employee.
 */
export function DashboardLandingPage() {
  const actor = useDashboardActor();

  if (!actor.ready) {
    return null;
  }

  const kind = resolveHomeDashboardKind({
    accessMode: actor.accessMode,
    scope: actor.scope,
    permissionLabels: actor.permissionLabels,
    roleNames: actor.roleNames ?? [],
  });

  if (kind === "employee") {
    return <EmployeeHomeDashboard />;
  }

  if (kind === "platform") {
    return <PlatformAdminDashboard />;
  }

  // Company administrators and HR users receive the full workforce dashboard
  // from the surrounding dashboard shell. Returning no second view prevents
  // the lighter Insights screen from being mounted underneath it.
  if (kind === "company" || kind === "hr") {
    return null;
  }

  if (INSIGHTS_HOME_TABS.has(kind)) {
    return (
      <>
        <KpiHomeWidget personal={false} />
        <InsightsOperationsView activeTab={kind} embedded />
      </>
    );
  }

  return <EmployeeHomeDashboard />;
}
