import { redirect } from "next/navigation"
import { AttendanceReportView } from "@/components/dashboard/attendance-report-view"
import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import {
  EmployeePromotionView,
  EmployeePayrollView,
} from "@/components/dashboard/employee-self-service-view"

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

  if (normalized === "promotion") {
    // For "My Promotion" (employee) and operations promotion we show the self-service promotion view for now
    return <EmployeePromotionView />
  }

  if (normalized === "payroll") {
    // My Payroll - bright background, under development with animated icons
    return <EmployeePayrollView />
  }

  if (normalized === "recruitment") {
    return <EmployeeInviteView />
  }

  if (normalized === "reports") {
    return <AttendanceReportView />
  }

  return null
}
