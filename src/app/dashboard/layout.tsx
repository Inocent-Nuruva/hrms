import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminDashboardView>{children}</AdminDashboardView>
}
