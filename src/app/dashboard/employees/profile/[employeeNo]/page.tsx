import { EmployeeProfilePage } from "@/components/dashboard/employee-profile-page"

interface EmployeeProfileRouteProps {
  params: Promise<{
    employeeNo: string
  }>
}

export default async function EmployeeProfileRoute({ params }: EmployeeProfileRouteProps) {
  const { employeeNo } = await params

  return <EmployeeProfilePage employeeNo={employeeNo} />
}
