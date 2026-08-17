import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { selfFieldSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfFieldIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={selfFieldSectionTabGroups}
      fallbackHref="/dashboard/me/field/visits"
    />
  )
}
