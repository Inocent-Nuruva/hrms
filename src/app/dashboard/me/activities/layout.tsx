import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { activitySectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfActivitiesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={activitySectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
