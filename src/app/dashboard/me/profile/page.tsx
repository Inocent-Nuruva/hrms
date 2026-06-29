import { Suspense } from "react"
import { EmployeeSelfServiceProfileView } from "@/components/dashboard/employee-self-service-view"

export default function DashboardSelfProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading profile...</div>}>
      <EmployeeSelfServiceProfileView />
    </Suspense>
  )
}
