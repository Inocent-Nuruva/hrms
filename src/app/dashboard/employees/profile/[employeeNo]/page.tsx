import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { EmployeeProfilePage } from "@/components/dashboard/employee-profile-page"

interface EmployeeProfileRouteProps {
  params: Promise<{
    employeeNo: string
  }>
}

export default async function EmployeeProfileRoute({ params }: EmployeeProfileRouteProps) {
  const { employeeNo } = await params

  return (
    <AdminDashboardView>
      <EmployeeProfilePage employeeNo={employeeNo} />
    </AdminDashboardView>
  )
}
