import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { selfFinanceSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfFinanceIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={selfFinanceSectionTabGroups}
      fallbackHref="/dashboard/me/finance/payroll"
    />
  )
}
