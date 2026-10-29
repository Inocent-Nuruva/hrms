import { redirect } from "next/navigation"

import {
  ManagerSelfView,
  type ManagerSelfTab,
} from "@/components/dashboard/manager-self-view"

const ALLOWED_VIEWS = new Set<ManagerSelfTab>([
  "overview",
  "members",
  "attendance",
  "actions",
  "activity-summary",
])

interface SelfTeamViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SelfTeamViewPage({ params }: SelfTeamViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as ManagerSelfTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/team/overview")
  }
  return <ManagerSelfView activeTab={normalized} />
}
