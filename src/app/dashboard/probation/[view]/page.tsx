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
  searchParams: Promise<{ case?: string | string[] }>
  params: Promise<{
    view: string
  }>
}

export default async function ProbationViewPage({
  params, searchParams,
}: ProbationViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as ProbationHrTab

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/probation/overview")
  }

  const caseId = (await searchParams).case
  return <ProbationManagementView activeTab={normalized} requestedCaseId={
    normalized === "team" && typeof caseId === "string" && /^[1-9]\d*$/.test(caseId) ? caseId : undefined
  } />
}
