import { redirect } from "next/navigation"

import {
  EmployeeRequestsView,
  type RequestsSelfTab,
} from "@/components/dashboard/employee-requests-view"

const ALLOWED_VIEWS = new Set<RequestsSelfTab>([
  "actions",
  "timeline",
  "documents",
  "profile-changes",
  "resignation",
])

interface SelfRequestsViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SelfRequestsViewPage({ params }: SelfRequestsViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as RequestsSelfTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/me/requests/actions")
  }
  return <EmployeeRequestsView activeTab={normalized} />
}
