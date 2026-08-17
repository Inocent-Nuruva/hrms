import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { financeSectionTabGroups } from "@/lib/dashboard-sections"

export default function FinanceIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={financeSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
