"use client"

import { OffboardingSelfView } from "@/components/dashboard/offboarding-self-view"

/**
 * Employee offboarding — /api/me/offboarding plus assigned tasks/clearances.
 * The HR OffboardingView stays on /dashboard/employees/offboarding.
 */
export default function MeOffboardingPage() {
  return <OffboardingSelfView />
}
