import { redirect } from "next/navigation"

import { EmployeesListView } from "@/components/dashboard/employees-list-view"
import { EmployeeRegistrationView } from "@/components/dashboard/employee-registration-view"
import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import { EmployeeContractsWorkspace } from "@/components/dashboard/employee-contracts-workspace"
import { SalaryApprovalsView } from "@/components/dashboard/salary-approvals-view"
import { OnboardingView } from "@/components/dashboard/onboarding-view"
import { OffboardingView } from "@/components/dashboard/offboarding-view"
import { HrProfileUpdateApprovalsView } from "@/components/dashboard/hr-profile-update-approvals-view"
import { HrProfileChangeRequestsView } from "@/components/dashboard/hr-profile-change-requests-view"

const ALLOWED_VIEWS = new Set([
  "all",
  "inactive",
  "registration",
  "invite",
  "contracts",
  "salary-approvals",
  "offboarding",
  "onboarding",
  "profile-update-approvals",
  "profile-change-requests",
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

  if (normalized === "invite") {
    return <EmployeeInviteView />
  }

  if (normalized === "contracts") {
    return <EmployeeContractsWorkspace />
  }

  if (normalized === "salary-approvals") {
    return <SalaryApprovalsView />
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

  if (normalized === "inactive") {
    return <EmployeesListView directoryMode="inactive" />
  }

  if (normalized === "registration") {
    return <EmployeeRegistrationView />
  }

  if (normalized === "onboarding") {
    return <OnboardingView />
  }

  if (normalized === "offboarding") {
    return <OffboardingView />
  }

  if (normalized === "profile-update-approvals") {
    return <HrProfileUpdateApprovalsView />
  }

  if (normalized === "profile-change-requests") {
    return <HrProfileChangeRequestsView />
  }

  return null
}
