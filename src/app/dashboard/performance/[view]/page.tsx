import { redirect } from "next/navigation"

import {
  PerformanceManagementView,
  type PerformanceHrTab,
} from "@/components/dashboard/performance-management-view"

const ALLOWED_VIEWS = new Set<PerformanceHrTab>([
  "overview",
  "setup",
  "plans",
  "reviews",
  "improvement",
])

interface PerformanceViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function PerformanceViewPage({
  params,
}: PerformanceViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as PerformanceHrTab

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/performance/overview")
  }

  return <PerformanceManagementView activeTab={normalized} />
}
