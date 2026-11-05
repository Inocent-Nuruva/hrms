import { EmployeeWorkspaceLayout } from "@/components/dashboard/employee-workspace-layout"

export default function SelfTeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <EmployeeWorkspaceLayout>{children}</EmployeeWorkspaceLayout>
}
