import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { selfFinanceSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfFinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={selfFinanceSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
