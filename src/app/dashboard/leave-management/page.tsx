import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { leaveManagementSectionTabGroups } from "@/lib/dashboard-sections"

export default function LeaveManagementIndexPage() {
  return (
    <DashboardSectionRootRedirect
      groups={leaveManagementSectionTabGroups}
      fallbackHref="/dashboard"
    />
  )
}
