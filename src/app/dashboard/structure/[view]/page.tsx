import { redirect } from "next/navigation"

import {
  StructureOperationsView,
  type StructureOpsTab,
} from "@/components/dashboard/structure-operations-view"

const ALLOWED_VIEWS = new Set<StructureOpsTab>(["cost-centers", "grades", "numbering"])

interface StructureViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function StructureViewPage({ params }: StructureViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as StructureOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/structure/cost-centers")
  }
  return <StructureOperationsView activeTab={normalized} />
}
