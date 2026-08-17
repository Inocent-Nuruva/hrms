import { redirect } from "next/navigation"

import {
  InsightsOperationsView,
  type InsightsOpsTab,
} from "@/components/dashboard/insights-operations-view"

const ALLOWED_VIEWS = new Set<InsightsOpsTab>([
  "hr",
  "management",
  "manager",
  "readiness",
])

interface InsightsViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function InsightsViewPage({ params }: InsightsViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as InsightsOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/insights/hr")
  }
  return <InsightsOperationsView activeTab={normalized} />
}
