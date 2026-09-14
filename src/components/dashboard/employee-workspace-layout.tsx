import * as React from "react"

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export function EmployeeWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-0">
      <DashboardSectionTabs groups={employeeSectionTabGroups} />
      <div className="min-w-0 max-w-full">{children}</div>
    </div>
  )
}
