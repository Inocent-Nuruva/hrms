import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfRequestsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0">
      <DashboardSectionTabs
        groups={employeeSectionTabGroups}
        hideOnPaths={["/dashboard/me/requests/actions"]}
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
