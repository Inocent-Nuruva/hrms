"use client"

import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  attendanceSectionTabGroups,
  employeeAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"

export default function AttendanceIndexPage() {
  const actor = useDashboardActor()

  if (!actor.ready) {
    return null
  }

  return (
    <DashboardSectionRootRedirect
      groups={actor.isAdmin ? attendanceSectionTabGroups : employeeAttendanceSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
