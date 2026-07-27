"use client"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <DashboardSectionTabs groups={employeeSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
