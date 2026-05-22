import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { EmployeeOrganizationView } from "@/components/dashboard/employee-self-service-view"

export default function DashboardSelfOrganizationPage() {
  return (
    <AdminDashboardView>
      <EmployeeOrganizationView />
    </AdminDashboardView>
  )
}
