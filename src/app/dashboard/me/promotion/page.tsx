import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { EmployeePromotionView } from "@/components/dashboard/employee-self-service-view"

export default function DashboardSelfPromotionPage() {
  return (
    <AdminDashboardView>
      <EmployeePromotionView />
    </AdminDashboardView>
  )
}
