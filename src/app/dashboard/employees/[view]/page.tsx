import { redirect } from "next/navigation"

import { EmployeesListView } from "@/components/dashboard/employees-list-view"
import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import { EmployeeRegistrationView } from "@/components/dashboard/employee-registration-view"
import { OnboardingView } from "@/components/dashboard/onboarding-view"
import { OffboardingView } from "@/components/dashboard/offboarding-view"
const ALLOWED_VIEWS = new Set([
  "all",
  "registration",
  "invite",
  "offboarding",
  "onboarding",
  "attendance",
])

interface EmployeesViewPageProps {
  params: Promise<{
    view: string
  }>
}

export default async function EmployeesViewPage({
  params,
}: EmployeesViewPageProps) {
  const { view } = await params
  const normalized = view?.toLowerCase()

  if (normalized === "attendance") {
    redirect("/dashboard/attendance")
  }

  if (normalized === "departments") {
    redirect("/dashboard/departments")
  }

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/employees")
  }

  // register route repurposed to offboarding only (register tab/contents removed)
  if (normalized === "register") {
    return <OffboardingView />
  }

  if (normalized === "all") {
    return <EmployeesListView />
  }

  if (normalized === "registration") {
    return <EmployeeRegistrationView />
  }

  if (normalized === "invite") {
    return <EmployeeInviteView />
  }

  if (normalized === "onboarding") {
    return <OnboardingView />
  }

  if (normalized === "offboarding") {
    return <OffboardingView />
  }

  return null
}
