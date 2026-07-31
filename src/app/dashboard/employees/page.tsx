import { DashboardSectionRootRedirect } from "@/components/dashboard/dashboard-section-root-redirect"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

export default function EmployeesPage() {
  return (
    <DashboardSectionRootRedirect
      groups={employeeSectionTabGroups}
      fallbackHref="/dashboard/employees/all"
    />
  )
}
