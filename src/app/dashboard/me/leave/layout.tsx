import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { selfLeaveSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfLeaveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <DashboardSectionTabs groups={selfLeaveSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
