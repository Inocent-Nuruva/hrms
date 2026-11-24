"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChartMultiple24Regular, DocumentData24Regular } from "@fluentui/react-icons"

import ReportsAnalyticsView from "@/components/dashboard/reports-analytics-view"
import { KpiReportsWorkspace } from "@/components/dashboard/kpi/kpi-reports-workspace"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  ATTENDANCE_REPORTS_ROUTE_PERMISSION,
  hasPermission,
  normalizePermissionLabels,
} from "@/lib/dashboard-permissions"
import { reportsEnabled } from "@/lib/kpi-session"
import { cn } from "@/lib/utils"

export function UnifiedReportsView() {
  const actor = useDashboardActor()
  const router = useRouter()
  const searchParams = useSearchParams()
  const labels = normalizePermissionLabels(actor.permissionLabels)
  const selfOnly = labels.includes("data_scope:self") &&
    !["data_scope:company", "data_scope:branch", "data_scope:department", "data_scope:team"].some((scope) => labels.includes(scope))
  const operationalAccess = !selfOnly && hasPermission(actor.permissionLabels, ATTENDANCE_REPORTS_ROUTE_PERMISSION)
  const kpiAccess = reportsEnabled && actor.scope === "company"
  const requestedTab = searchParams?.get("tab")
  const selectedTab = requestedTab === "kpi" && kpiAccess ? "kpi" :
    requestedTab === "operations" && operationalAccess ? "operations" :
    operationalAccess ? "operations" : "kpi"
  const roles = actor.roleNames ?? []
  const personal = selfOnly || !roles.some((role) =>
    ["COMPANY_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "BRANCH_MANAGER", "MANAGEMENT"].includes(role.toUpperCase()),
  )

  if (!actor.ready) return <div className="px-6 py-10 text-sm text-muted-foreground">Loading reports…</div>
  if (!operationalAccess && !kpiAccess) return <div className="px-6 py-10 text-sm text-muted-foreground">No reports are available for this account.</div>

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Generate reports from the data you are authorized to see.</p>
          {operationalAccess && kpiAccess && (
            <nav className="mt-5 flex flex-wrap gap-2" aria-label="Report categories">
              {([
                ["operations", "Operational reports", DocumentData24Regular],
                ["kpi", "KPI reports", ChartMultiple24Regular],
              ] as const).map(([tab, title, Icon]) => (
                <button
                  key={tab}
                  type="button"
                  aria-current={selectedTab === tab ? "page" : undefined}
                  onClick={() => router.replace(`/dashboard/operations/reports?tab=${tab}`, { scroll: false })}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition-colors",
                    selectedTab === tab ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <Icon aria-hidden="true" />{title}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
      {selectedTab === "operations" && operationalAccess ? (
        <ReportsAnalyticsView embedded />
      ) : kpiAccess ? (
        <div className="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6">
          <KpiReportsWorkspace personal={personal} embedded />
        </div>
      ) : null}
    </div>
  )
}
