import { redirect } from "next/navigation"

import {
  ActivitySelfView,
  type ActivitySelfTab,
} from "@/components/dashboard/activity-self-view"

const ALLOWED_VIEWS = new Set<ActivitySelfTab>(["today", "reports"])

interface SelfActivitiesViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SelfActivitiesViewPage({ params }: SelfActivitiesViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as ActivitySelfTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/activities/today")
  }
  return <ActivitySelfView activeTab={normalized} />
}
