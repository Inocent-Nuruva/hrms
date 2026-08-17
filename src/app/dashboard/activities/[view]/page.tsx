import { redirect } from "next/navigation"

import {
  ActivityOperationsView,
  type ActivityOpsTab,
} from "@/components/dashboard/activity-operations-view"

const ALLOWED_VIEWS = new Set<ActivityOpsTab>([
  "overview",
  "reports",
  "reviews",
  "exceptions",
  "setup",
])

interface ActivitiesViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function ActivitiesViewPage({ params }: ActivitiesViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as ActivityOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/activities/overview")
  }
  return <ActivityOperationsView activeTab={normalized} />
}
