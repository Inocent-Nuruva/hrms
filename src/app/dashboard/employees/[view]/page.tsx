import { redirect } from "next/navigation"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { EmployeesListView } from "@/components/dashboard/employees-list-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"
import { OnboardingView } from "@/components/dashboard/onboarding-view"
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

  if (normalized === "departments") {
    redirect("/dashboard/departments")
  }

  if (!ALLOWED_VIEWS.has(normalized)) {
    redirect("/dashboard/employees/register")
  }

  if (normalized === "register") {
    return (
      <AdminDashboardView>
        <EmployeeRegisterForm />
      </AdminDashboardView>
    )
  }

  if (normalized === "all") {
    return (
      <AdminDashboardView>
        <EmployeesListView />
      </AdminDashboardView>
    )
  }

  if (normalized === "onboarding") {
    return (
      <AdminDashboardView>
        <OnboardingView />
      </AdminDashboardView>
    )
  }

  return <AdminDashboardView />
}
