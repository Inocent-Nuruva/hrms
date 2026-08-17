import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { selfActivitySectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfActivitiesIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={selfActivitySectionTabGroups}
      fallbackHref="/dashboard/me/activities/today"
    />
  )
}
