import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { insightsSectionTabGroups } from "@/lib/dashboard-sections"

export default function InsightsIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={insightsSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
