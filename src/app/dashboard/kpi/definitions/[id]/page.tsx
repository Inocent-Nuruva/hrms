import { KpiDefinitionDetail } from "@/components/dashboard/kpi/kpi-definition-detail"
import { notFound } from "next/navigation"
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id) || Number(id) < 1) notFound()
  return <KpiDefinitionDetail id={Number(id)} />
}
