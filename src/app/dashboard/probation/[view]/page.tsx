import { redirect } from "next/navigation"

import {
  ProbationManagementView,
  type ProbationHrTab,
} from "@/components/dashboard/probation-management-view"

const ALLOWED_VIEWS = new Set<ProbationHrTab>([
  "overview",
  "policies",
  "cases",
  "team",
])

interface ProbationViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function ProbationViewPage({
  params,
}: ProbationViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as ProbationHrTab

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/probation/overview")
  }

  return <ProbationManagementView activeTab={normalized} />
}
