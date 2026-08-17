import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { performanceSectionTabGroups } from "@/lib/dashboard-sections"

export default function PerformanceIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={performanceSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
