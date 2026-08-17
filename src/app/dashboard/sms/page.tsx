import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { smsSectionTabGroups } from "@/lib/dashboard-sections"

export default function SmsIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={smsSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
