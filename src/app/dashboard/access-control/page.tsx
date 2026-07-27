import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { accessControlSectionTabGroups } from "@/lib/dashboard-sections"

export default function AccessControlIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={accessControlSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
