"use client"

import * as React from "react"

import { usePathname } from "next/navigation"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { SubTabs } from "@/components/theme-v2"
import { useOptionalUiTheme } from "@/components/ui-theme/UiThemeProvider"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  resolveAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"

export function AttendanceSectionTabs() {
  const actor = useDashboardActor()
  const pathname = usePathname() ?? ""
  const ui = useOptionalUiTheme()?.ui ?? "v1"

  if (!actor.ready) {
    return null
  }

  if (ui === "v2") {
    if (pathname.startsWith("/dashboard/attendance/correction-requests")) return null
    // Theme 2 shows the tabs of the group the current page belongs to.
    const group = resolveAttendanceSectionTabGroups(
      actor.permissionLabels,
      actor.accessMode,
      actor.isAdmin,
    ).find((candidate) => candidate.items.some((item) => pathname === item.url || pathname.startsWith(item.url + "/")))
    const items = (group?.items ?? []).filter((item) =>
      canAccessDashboardRoute(item.url, actor.permissionLabels, actor.accessMode),
    )
    return items.length > 1 ? <SubTabs items={items.map((item) => ({ label: item.title, href: item.url }))} /> : null
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
