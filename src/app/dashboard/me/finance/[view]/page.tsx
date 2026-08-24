import { redirect } from "next/navigation"

import { EmployeePayrollView } from "@/components/dashboard/employee-self-service-view"
import { FinanceSelfView } from "@/components/dashboard/finance-self-view"

const ALLOWED_VIEWS = new Set(["applications", "payroll"])

interface SelfFinanceViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SelfFinanceViewPage({ params }: SelfFinanceViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() ?? ""

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/finance/payroll")
  }

  if (normalized === "payroll") {
    return <EmployeePayrollView />
  }

  return <FinanceSelfView />
}
