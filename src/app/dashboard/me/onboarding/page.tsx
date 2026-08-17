"use client"

import { OnboardingView } from "@/components/dashboard/onboarding-view"

/**
 * Self-service onboarding for employees.
 * Kept under /dashboard/me so it does not mount the HR Employees section tabs.
 */
export default function MeOnboardingPage() {
  return <OnboardingView />
}
