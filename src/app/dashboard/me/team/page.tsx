import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { selfTeamSectionTabGroups } from "@/lib/dashboard-sections"

export default function SelfTeamIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={selfTeamSectionTabGroups}
      fallbackHref="/dashboard/me/team/overview"
    />
  )
}
