import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { performanceSectionTabGroups } from "@/lib/dashboard-sections"

export default function PerformanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={performanceSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
