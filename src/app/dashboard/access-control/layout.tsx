import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { accessControlSectionTabGroups } from "@/lib/dashboard-sections"

export default function AccessControlLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <DashboardSectionTabs groups={accessControlSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
