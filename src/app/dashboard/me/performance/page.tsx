import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { selfPerformanceSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfPerformanceIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={selfPerformanceSectionTabGroups}
      fallbackHref="/dashboard/me/performance/overview"
    />
  )
}
