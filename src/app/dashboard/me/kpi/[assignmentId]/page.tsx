import { notFound } from "next/navigation"
import { EmployeeAchievement } from "@/components/dashboard/kpi/achievement-workspace"
export default async function Page({ params, searchParams }: { params: Promise<{ assignmentId: string }>; searchParams: Promise<{ action?: string }> }) {
  const [{ assignmentId }, query] = await Promise.all([params, searchParams])
  if (!/^\d+$/.test(assignmentId) || Number(assignmentId) < 1) notFound()
  return <EmployeeAchievement assignmentId={Number(assignmentId)} startAction={query.action === "add-activity" ? "add-activity" : query.action === "record-achievement" ? "record-achievement" : undefined} />
}
