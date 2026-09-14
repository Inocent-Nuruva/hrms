import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { financeSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfFinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={financeSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
