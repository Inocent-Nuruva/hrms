import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { selfLeaveSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfLeaveLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:gap-2.5">
      <DashboardSectionTabs groups={selfLeaveSectionTabGroups} />
      {children}
    </div>
  )
}
