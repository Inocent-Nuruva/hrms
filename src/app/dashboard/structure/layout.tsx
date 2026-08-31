import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { structureSectionTabGroups } from "@/lib/dashboard-sections"

export default function StructureLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={structureSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
