"use client"

import { OffboardingView } from "@/components/dashboard/offboarding-view"

/**
 * Self-service offboarding for employees.
 * Intentionally under /dashboard/me so it does not use the HR Employees layout
 * (which exposes All Employees / Registration tabs).
 */
export default function MeOffboardingPage() {
  return <OffboardingView />
}
