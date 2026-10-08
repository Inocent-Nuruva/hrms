"use client"

import { usePathname } from "next/navigation"
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { myGoalsAndWorkTabGroups, teamGoalsAndWorkTabGroups } from "@/lib/dashboard-sections"

export default function SelfPerformanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const groups = pathname?.startsWith("/dashboard/me/performance/team") || pathname?.startsWith("/dashboard/me/performance/manager-kpis")
    ? teamGoalsAndWorkTabGroups
    : myGoalsAndWorkTabGroups
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={groups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
