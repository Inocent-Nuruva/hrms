import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { fieldSectionTabGroups } from "@/lib/dashboard-sections"

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs groups={fieldSectionTabGroups} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
