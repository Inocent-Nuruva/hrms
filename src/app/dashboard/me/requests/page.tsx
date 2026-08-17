import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { selfRequestSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfRequestsIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={selfRequestSectionTabGroups}
      fallbackHref="/dashboard/me/requests/actions"
    />
  )
}
