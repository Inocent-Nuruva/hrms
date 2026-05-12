import { redirect } from "next/navigation"

import AdminDashboardView from "@/components/dashboard/admin-dashboard-view"
import { EmployeesListView } from "@/components/dashboard/employees-list-view"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"

const ALLOWED_VIEWS = new Set([
  "all",
  "register",
  "offboarding",
  "leave-management",
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

  return <AdminDashboardView />
}
