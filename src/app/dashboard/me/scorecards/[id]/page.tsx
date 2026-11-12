import { notFound } from "next/navigation"
import { ScorecardDetail } from "@/components/dashboard/kpi/scorecard-detail"
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id) || Number(id) < 1) notFound()
  return <ScorecardDetail id={Number(id)} personal />
}
