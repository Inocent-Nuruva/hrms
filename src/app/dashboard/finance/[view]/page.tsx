import { redirect } from "next/navigation"

import {
  FinanceOperationsView,
  type FinanceOpsTab,
} from "@/components/dashboard/finance-operations-view"

const ALLOWED_VIEWS = new Set<FinanceOpsTab>([
  "overview",
  "products",
  "applications",
  "accounts",
])

interface FinanceViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function FinanceViewPage({ params }: FinanceViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as FinanceOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/finance/overview")
  }
  return <FinanceOperationsView activeTab={normalized} />
}
