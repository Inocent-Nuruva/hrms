import { describe, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/components/dashboard/employees-list-view", () => ({ EmployeesListView: () => null }))
vi.mock("@/components/dashboard/employee-registration-view", () => ({ EmployeeRegistrationView: () => null }))
vi.mock("@/components/dashboard/employee-invite-view", () => ({ EmployeeInviteView: () => null }))
vi.mock("@/components/dashboard/employee-contracts-workspace", () => ({ EmployeeContractsWorkspace: () => null }))
vi.mock("@/components/dashboard/salary-approvals-view", () => ({ SalaryApprovalsView: () => null }))
vi.mock("@/components/dashboard/onboarding-view", () => ({ OnboardingView: () => null }))
vi.mock("@/components/dashboard/offboarding-view", () => ({ OffboardingView: () => null }))
vi.mock("@/components/dashboard/hr-profile-update-approvals-view", () => ({ HrProfileUpdateApprovalsView: () => null }))
vi.mock("@/components/dashboard/hr-profile-change-requests-view", () => ({ HrProfileChangeRequestsView: () => null }))
import { redirect } from "next/navigation"
import { EmployeeInviteView } from "@/components/dashboard/employee-invite-view"
import { EmployeeContractsWorkspace } from "@/components/dashboard/employee-contracts-workspace"
import { SalaryApprovalsView } from "@/components/dashboard/salary-approvals-view"
import EmployeesViewPage from "./page"

describe("employee joining routes", () => {
  it.each([
    ["invite", EmployeeInviteView],
    ["contracts", EmployeeContractsWorkspace],
    ["salary-approvals", SalaryApprovalsView],
  ] as const)("renders %s inside employee management without redirecting", async (view, component) => {
    const result = await EmployeesViewPage({ params: Promise.resolve({ view }) })
    expect(result?.type).toBe(component)
    expect(redirect).not.toHaveBeenCalled()
  })
})
