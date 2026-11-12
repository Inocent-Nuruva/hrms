import { notFound } from "next/navigation"
import { KpiWorkspace } from "@/components/dashboard/kpi/kpi-workspace"
const views = ["create", "templates", "periods", "assignments", "targets"]
export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params
  if (!views.includes(view)) notFound()
  return <KpiWorkspace view={view} />
}
