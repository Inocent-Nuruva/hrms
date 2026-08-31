import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { positionsSectionTabGroups } from "@/lib/dashboard-sections"

export default function PeopleStructureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={positionsSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
