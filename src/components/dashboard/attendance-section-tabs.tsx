"use client"

import * as React from "react"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  resolveAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"

export function AttendanceSectionTabs() {
  const actor = useDashboardActor()

  if (!actor.ready) {
    return null
  }

  return (
    <DashboardSectionTabs
      groups={resolveAttendanceSectionTabGroups(
        actor.permissionLabels,
        actor.accessMode,
        actor.isAdmin,
      )}
      // Correction approvals are a To do workflow, not part of the personal
      // Attendance workspace. Keep its queue free of Attendance tabs.
      hideOnPaths={["/dashboard/attendance/correction-requests"]}
    />
  )
}
