import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { positionsSectionTabGroups } from "@/lib/dashboard-sections"

export default function PeopleStructureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 md:gap-2.5">
      <DashboardSectionTabs groups={positionsSectionTabGroups} />
      {children}
    </div>
  )
}
