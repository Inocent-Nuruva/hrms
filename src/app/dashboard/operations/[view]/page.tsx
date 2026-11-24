import { redirect } from "next/navigation"
import { NotificationsView } from "@/components/dashboard/notifications-view"
import { PayrollOperationsView } from "@/components/dashboard/payroll-operations-view"
import { UnifiedReportsView } from "@/components/dashboard/unified-reports-view"
import { ScheduledReportingView } from "@/components/dashboard/scheduled-reporting-view"
import { RecruitmentView } from "@/components/dashboard/recruitment-view"
import { MovementOperationsView } from "@/components/dashboard/movement-operations-view"

const ALLOWED_VIEWS = new Set([
  "promotion",
  "recruitment",
  "payroll",
  "reports",
  "scheduled-reporting",
  "notifications",
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
    redirect("/dashboard/operations/reports")
  }

  if (normalized === "promotion") {
    return <MovementOperationsView activeTab="cases" />
  }

  if (normalized === "payroll") {
    return <PayrollOperationsView />
  }

  if (normalized === "recruitment") {
    return <RecruitmentView />
  }

  if (normalized === "reports") {
    return <UnifiedReportsView />
  }

  if (normalized === "scheduled-reporting") {
    return <ScheduledReportingView />
  }

  if (normalized === "notifications") {
    return <NotificationsView />
  }

  return null
}
