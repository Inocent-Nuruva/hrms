import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { probationSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfProbationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0">
      <DashboardSectionTabs groups={probationSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
