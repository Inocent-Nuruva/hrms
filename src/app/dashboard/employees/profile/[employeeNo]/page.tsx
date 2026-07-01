import { EmployeeProfilePage } from "@/components/dashboard/employee-profile-page"

interface EmployeeProfileRouteProps {
  params: Promise<{
    employeeNo: string
  }>
  searchParams: Promise<{
    missing?: string | string[]
  }>
}

export default async function EmployeeProfileRoute({ params, searchParams }: EmployeeProfileRouteProps) {
  const { employeeNo } = await params
  const { missing } = await searchParams
  const requestedMissingItem = Array.isArray(missing) ? missing[0] : missing

  return <EmployeeProfilePage employeeNo={employeeNo} requestedMissingItem={requestedMissingItem} />
}
