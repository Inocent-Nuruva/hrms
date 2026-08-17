"use client"

import { OnboardingSelfView } from "@/components/dashboard/onboarding-self-view"

/**
 * Employee onboarding — /api/me/onboarding only.
 * The HR OnboardingView stays on /dashboard/employees/onboarding.
 */
export default function MeOnboardingPage() {
  return <OnboardingSelfView />
}
