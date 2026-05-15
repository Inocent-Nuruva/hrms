import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { PositionsView } from "@/components/dashboard/positions-view"

export default function PositionsPage() {
  return (
    <AdminDashboardView>
      <PositionsView />
    </AdminDashboardView>
  )
}
