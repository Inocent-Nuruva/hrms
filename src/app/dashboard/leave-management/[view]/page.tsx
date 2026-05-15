import { redirect } from "next/navigation"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { LeaveManagementView } from "@/components/dashboard/leave-management-view"

const ALLOWED_VIEWS = new Set(["types", "requests", "balances", "holidays"])

type LeaveView = "types" | "requests" | "balances" | "holidays"

interface LeaveManagementViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function LeaveManagementViewPage({
  params,
}: LeaveManagementViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/leave-management/types")
  }

  return (
    <AdminDashboardView>
      <LeaveManagementView activeTab={normalized as LeaveView} showTabButtons={false} />
    </AdminDashboardView>
  )
}
