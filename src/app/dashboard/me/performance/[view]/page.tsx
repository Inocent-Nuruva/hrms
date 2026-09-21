import { redirect } from "next/navigation"

import {
  PerformanceSelfView,
  type PerformanceSelfTab,
} from "@/components/dashboard/performance-self-view"
import { EmployeeKpiWorkspace } from "@/components/dashboard/employee-kpi-workspace"

const ALLOWED_VIEWS = new Set<PerformanceSelfTab>([
  "overview",
  "assignments",
  "assign-tasks",
  "reviews",
  "feedback",
  "development",
  "achievements",
  "improvement",
  "team",
])

interface SelfPerformanceViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SelfPerformanceViewPage({
  params,
}: SelfPerformanceViewPageProps) {
  const { view } = await params

  if (view?.toLowerCase() === "kpis") {
    return <EmployeeKpiWorkspace mode="self" />
  }

  if (view?.toLowerCase() === "kpi-reviews") {
    return <EmployeeKpiWorkspace mode="manager" />
  }

  const normalized = view?.toLowerCase() as PerformanceSelfTab

  if (normalized === "assign-tasks") {
    redirect("/dashboard/me/activities/today?create=1")
  }

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/performance/overview")
  }

  return <PerformanceSelfView activeTab={normalized} />
}
