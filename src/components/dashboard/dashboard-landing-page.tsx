"use client"

import { EmployeeHomeDashboard } from "@/components/dashboard/employee-home-dashboard"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"

/**
 * `/dashboard` children:
 * - admin/HR → render nothing (shell shows HrAnalyticsDashboard overview)
 * - employee → self-service home
 *
 * Access mode is re-read briefly after mount so we pick up permissions that
 * AdminDashboardView publishes into sessionStorage after identity resolves.
 */
export function DashboardLandingPage() {
  const actor = useDashboardActor()

  if (!actor.ready || actor.accessMode !== "employee") {
    return null
  }

  return <EmployeeHomeDashboard />
}
