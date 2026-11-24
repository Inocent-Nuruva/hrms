import { MovementSettingsView } from "@/components/dashboard/movement-settings-view"
import { redirect } from "next/navigation"

import {
  MovementOperationsView,
  type MovementOpsTab,
} from "@/components/dashboard/movement-operations-view"

const ALLOWED_VIEWS = new Set<MovementOpsTab>([
  "overview",
  "cases",
  "operations",
])

interface MovementsViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function MovementsViewPage({ params }: MovementsViewPageProps) {
  const { view } = await params
  if (view.toLowerCase() === "settings") return <MovementSettingsView />
  const normalized = view?.toLowerCase() as MovementOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/movements/overview")
  }
  return <MovementOperationsView activeTab={normalized} />
}
