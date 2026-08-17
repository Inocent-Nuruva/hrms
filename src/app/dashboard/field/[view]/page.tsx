import { redirect } from "next/navigation"

import {
  FieldOperationsView,
  type FieldOpsTab,
} from "@/components/dashboard/field-operations-view"

const ALLOWED_VIEWS = new Set<FieldOpsTab>([
  "overview",
  "visits",
  "map",
  "parties",
  "setup",
])

interface FieldViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function FieldViewPage({ params }: FieldViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as FieldOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/field/overview")
  }
  return <FieldOperationsView activeTab={normalized} />
}
