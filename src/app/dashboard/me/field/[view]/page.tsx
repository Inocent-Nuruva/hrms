import { redirect } from "next/navigation"

import {
  FieldSelfView,
  type FieldSelfTab,
} from "@/components/dashboard/field-self-view"

const ALLOWED_VIEWS = new Set<FieldSelfTab>(["visits", "plans", "follow-ups"])

interface SelfFieldViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SelfFieldViewPage({ params }: SelfFieldViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as FieldSelfTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/field/visits")
  }
  return <FieldSelfView activeTab={normalized} />
}
