import { redirect } from "next/navigation"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"

const ALLOWED_VIEWS = new Set([
  "promotion",
  "recruitment",
  "payroll",
  "reports",
])

interface OperationsViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function OperationsViewPage({
  params,
}: OperationsViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/operations/promotion")
  }

  return <AdminDashboardView />
}
