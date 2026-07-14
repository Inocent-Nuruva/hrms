"use client"

import * as React from "react"

import { EmployeeHomeDashboard } from "@/components/dashboard/employee-home-dashboard"
import { getDashboardAccessModeFromBrowser } from "@/lib/dashboard-identity"

/**
 * `/dashboard` children:
 * - admin/HR → render nothing (shell shows HrAnalyticsDashboard overview)
 * - employee → self-service home
 *
 * Access mode is re-read briefly after mount so we pick up permissions that
 * AdminDashboardView publishes into sessionStorage after identity resolves.
 */
export function DashboardLandingPage() {
  const [accessMode, setAccessMode] = React.useState<"admin" | "employee" | null>(
    () => (typeof window === "undefined" ? null : getDashboardAccessModeFromBrowser())
  )

  React.useEffect(() => {
    const sync = () => setAccessMode(getDashboardAccessModeFromBrowser())
    sync()

    // Same-tab sessionStorage writes do not fire `storage` events; poll briefly
    // while the dashboard shell finishes identity resolution.
    const intervalId = window.setInterval(sync, 250)
    const stopId = window.setTimeout(() => window.clearInterval(intervalId), 4000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(stopId)
    }
  }, [])

  if (accessMode !== "employee") {
    return null
  }

  return <EmployeeHomeDashboard />
}
