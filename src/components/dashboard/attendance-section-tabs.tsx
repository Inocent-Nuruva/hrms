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
      // Design: tabs start 8px in on phones and 20px on wider screens, flush under the top bar.
      className="!px-2 !pt-0 sm:!px-5"
    />
  )
}
