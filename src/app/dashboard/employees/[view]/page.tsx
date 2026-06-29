import { redirect } from "next/navigation"

import { EmployeesListView } from "@/components/dashboard/employees-list-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"
import { OnboardingView } from "@/components/dashboard/onboarding-view"
import { OffboardingView } from "@/components/dashboard/offboarding-view"
const ALLOWED_VIEWS = new Set([
  "all",
  "register",
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

  if (normalized === "register") {
    return <EmployeeRegisterForm />
  }

  if (normalized === "all") {
    return <EmployeesListView />
  }

  if (normalized === "onboarding") {
    return <OnboardingView />
  }

  if (normalized === "offboarding") {
    return <OffboardingView />
  }

  return null
}
