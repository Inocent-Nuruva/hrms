import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { movementSectionTabGroups } from "@/lib/dashboard-sections"

export default function MovementsIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={movementSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
