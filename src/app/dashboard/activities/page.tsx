import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { activitySectionTabGroups } from "@/lib/dashboard-sections"

export default function ActivitiesIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={activitySectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
