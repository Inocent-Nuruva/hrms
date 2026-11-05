import { EmployeeWorkspaceLayout } from "@/components/dashboard/employee-workspace-layout"

export default function SelfRequestsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EmployeeWorkspaceLayout
      hideOnPaths={["/dashboard/me/requests/actions"]}
    >
      {children}
    </EmployeeWorkspaceLayout>
  )
}
