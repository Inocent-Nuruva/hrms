import { redirect } from "next/navigation"

import {
  FinanceOperationsView,
  type FinanceOpsTab,
} from "@/components/dashboard/finance-operations-view"
import { FinanceIntegrationsView } from "@/components/dashboard/finance-integrations-view"
import {
  FinanceServicingView,
  type FinanceServicingTab,
} from "@/components/dashboard/finance-servicing-view"

const ALLOWED_VIEWS = new Set<FinanceOpsTab>([
  "overview",
  "products",
  "applications",
  "accounts",
  "reports",
])

const SERVICING_VIEWS = new Set<FinanceServicingTab>([
  "servicing",
  "payroll",
  "settings",
])

interface FinanceViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function FinanceViewPage({ params }: FinanceViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()
  if (normalized === "integrations") {
    return <FinanceIntegrationsView />
  }
  if (SERVICING_VIEWS.has(normalized as FinanceServicingTab)) {
    return <FinanceServicingView activeTab={normalized as FinanceServicingTab} />
  }
  if (!ALLOWED_VIEWS.has(normalized as FinanceOpsTab)) {
    redirect("/dashboard/finance/overview")
  }
  return <FinanceOperationsView activeTab={normalized as FinanceOpsTab} />
}
