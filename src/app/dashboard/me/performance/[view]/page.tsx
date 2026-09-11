import { redirect } from "next/navigation"

import {
  PerformanceSelfView,
  type PerformanceSelfTab,
} from "@/components/dashboard/performance-self-view"

const ALLOWED_VIEWS = new Set<PerformanceSelfTab>([
  "overview",
  "assignments",
  "assign-tasks",
  "reviews",
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
  const normalized = view?.toLowerCase() as PerformanceSelfTab

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/performance/overview")
  }

  return <PerformanceSelfView activeTab={normalized} />
}
