import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { BranchesView } from "@/components/dashboard/branches-view"

export default function BranchesPage() {
  return (
    <AdminDashboardView>
      <BranchesView />
    </AdminDashboardView>
  )
}
