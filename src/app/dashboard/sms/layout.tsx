import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { smsSectionTabGroups } from "@/lib/dashboard-sections"

export default function SmsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={smsSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
