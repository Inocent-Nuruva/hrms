import { EmployeeWorkspaceLayout } from "@/components/dashboard/employee-workspace-layout"
import { MyInsightsView } from "@/components/dashboard/my-insights-view"

export default function MyInsightsPage() {
  return (
    <EmployeeWorkspaceLayout>
      <MyInsightsView />
    </EmployeeWorkspaceLayout>
  )
}
