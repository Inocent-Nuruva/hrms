"use client"

import * as React from "react"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  attendanceSectionTabGroups,
  employeeAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"

export function AttendanceSectionTabs() {
  const actor = useDashboardActor()

  if (!actor.ready) {
    return null
  }

  return (
    <DashboardSectionTabs
      groups={actor.isAdmin ? attendanceSectionTabGroups : employeeAttendanceSectionTabGroups}
    />
  )
}
