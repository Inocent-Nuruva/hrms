import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { DepartmentsView } from "@/components/dashboard/departments-view"

export default function DepartmentsPage() {
  return (
    <AdminDashboardView>
      <DepartmentsView />
    </AdminDashboardView>
  )
}
