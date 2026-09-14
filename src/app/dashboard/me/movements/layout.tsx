import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { movementSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfMovementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0">
      <DashboardSectionTabs groups={movementSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
