import { redirect } from "next/navigation"

import { EmployeeSelfServiceLeaveView } from "@/components/dashboard/employee-self-service-view"

const ALLOWED_VIEWS = new Set(["requests", "balances", "holidays", "policies"])

type LeaveView = "requests" | "balances" | "holidays" | "policies"

interface LeaveViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function DashboardSelfLeaveViewPage({ params }: LeaveViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/leave/requests")
  }

  return <EmployeeSelfServiceLeaveView tab={normalized as LeaveView} />
}
