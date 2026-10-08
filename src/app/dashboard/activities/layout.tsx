"use client"

import { usePathname } from "next/navigation"
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { activityManagementTabGroups, teamGoalsAndWorkTabGroups } from "@/lib/dashboard-sections"

export default function ActivitiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const groups = pathname?.startsWith("/dashboard/activities/team")
    ? teamGoalsAndWorkTabGroups
    : activityManagementTabGroups
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={groups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
