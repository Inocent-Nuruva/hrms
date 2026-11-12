import { notFound } from "next/navigation"
import { EmployeeAchievement } from "@/components/dashboard/kpi/achievement-workspace"
export default async function Page({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params
  if (!/^\d+$/.test(assignmentId) || Number(assignmentId) < 1) notFound()
  return <EmployeeAchievement assignmentId={Number(assignmentId)} />
}
