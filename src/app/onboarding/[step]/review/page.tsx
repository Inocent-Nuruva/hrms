import { redirect } from "next/navigation"

interface LegacyOnboardingReviewPageProps {
  params: Promise<{ step: string }>
}

export default async function LegacyOnboardingReviewPage({ params }: LegacyOnboardingReviewPageProps) {
  const { step } = await params
  const query = new URLSearchParams({ tab: "requests", request_id: step })

  redirect(`/dashboard/employees/onboarding?${query.toString()}`)
}
