"use client"

import { EmployeeHomeDashboard } from "@/components/dashboard/employee-home-dashboard"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canViewCompanyDashboard } from "@/lib/dashboard-permissions"

/**
 * `/dashboard` children:
 * - admin/HR with company-dashboard permission → shell shows HrAnalyticsDashboard
 * - everyone else on self-service (or admin without that permission) → employee home
 *
 * Access mode is re-read after mount so we pick up permissions that
 * AdminDashboardView publishes into sessionStorage after identity resolves.
 */
export function DashboardLandingPage() {
  const actor = useDashboardActor()

  if (!actor.ready) {
    return null
  }

  // Company overview is owned by the shell (HrAnalyticsDashboard). Only show
  // the employee home when this user is not allowed to see company analytics.
  if (actor.accessMode === "admin" && canViewCompanyDashboard(actor.permissionLabels)) {
    return null
  }

  return <EmployeeHomeDashboard />
}
