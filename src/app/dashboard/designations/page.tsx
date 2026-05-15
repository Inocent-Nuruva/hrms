import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { DesignationsView } from "@/components/dashboard/designations-view"

export default function DesignationsPage() {
  return (
    <AdminDashboardView>
      <DesignationsView />
    </AdminDashboardView>
  )
}
