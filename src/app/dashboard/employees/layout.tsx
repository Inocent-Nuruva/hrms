"use client"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export default function EmployeesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:gap-2.5">
      <DashboardSectionTabs groups={employeeSectionTabGroups} />
      {children}
    </div>
  )
}
