import { redirect } from "next/navigation"

import {
  type ActivitySelfTab,
} from "@/components/dashboard/activity-self-view"
import { ActivityTaskWorkspace } from "@/components/dashboard/activity-task-workspace"

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
  return <ActivityTaskWorkspace mode="self" />
}
