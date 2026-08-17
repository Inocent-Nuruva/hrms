import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { movementSectionTabGroups } from "@/lib/dashboard-sections"

export default function MovementsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <DashboardSectionTabs groups={movementSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
