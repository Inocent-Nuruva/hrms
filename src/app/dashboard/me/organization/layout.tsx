import { EmployeeWorkspaceLayout } from "@/components/dashboard/employee-workspace-layout"

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeWorkspaceLayout>{children}</EmployeeWorkspaceLayout>
}
