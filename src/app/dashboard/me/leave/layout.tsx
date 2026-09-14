import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { leaveManagementSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfLeaveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={leaveManagementSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
