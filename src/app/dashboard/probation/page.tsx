import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { probationSectionTabGroups } from "@/lib/dashboard-sections"

export default function ProbationIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={probationSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
