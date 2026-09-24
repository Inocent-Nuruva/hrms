import { redirect } from "next/navigation"

interface LegacyOnboardingTasksPageProps {
  params: Promise<{ step: string }>
}

export default async function LegacyOnboardingTasksPage({ params }: LegacyOnboardingTasksPageProps) {
  const { step } = await params
  const query = new URLSearchParams({ request_id: step })

  redirect(`/dashboard/me/requests/actions?${query.toString()}`)
}
