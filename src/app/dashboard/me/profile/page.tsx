import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { EmployeeSelfServiceProfileView } from "@/components/dashboard/employee-self-service-view"

export default function DashboardSelfProfilePage() {
  return (
    <AdminDashboardView>
      <EmployeeSelfServiceProfileView />
    </AdminDashboardView>
  )
}
