import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { fieldSectionTabGroups } from "@/lib/dashboard-sections"

export default function FieldIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={fieldSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
