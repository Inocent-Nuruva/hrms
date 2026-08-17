import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { structureSectionTabGroups } from "@/lib/dashboard-sections"

export default function StructureIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={structureSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
