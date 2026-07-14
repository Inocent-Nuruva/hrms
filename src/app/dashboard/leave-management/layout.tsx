import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { leaveManagementSectionTabGroups } from "@/lib/dashboard-sections"

export default function LeaveManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:gap-2.5">
      <DashboardSectionTabs groups={leaveManagementSectionTabGroups} />
      {children}
    </div>
  )
}
