import { redirect } from "next/navigation"

import {
  SmsOperationsView,
  type SmsOpsTab,
} from "@/components/dashboard/sms-operations-view"

const ALLOWED_VIEWS = new Set<SmsOpsTab>([
  "overview",
  "registry",
  "logs",
  "platform",
])

interface SmsViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function SmsViewPage({ params }: SmsViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase() as SmsOpsTab
  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/sms/overview")
  }
  return <SmsOperationsView activeTab={normalized} />
}
