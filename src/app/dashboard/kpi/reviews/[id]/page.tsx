import { notFound } from "next/navigation"
import { AchievementReviewDetail } from "@/components/dashboard/kpi/achievement-reviews"
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id) || Number(id) < 1) notFound()
  return <AchievementReviewDetail id={Number(id)} />
}
