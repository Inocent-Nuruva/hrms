import { describe, expect, it } from "vitest"
import { canAccessDashboardRoute } from "./dashboard-permissions"

describe("joining workspace access", () => {
  it("keeps company onboarding out of employee self-service", () => {
    const selfServicePermissions = [
      "onboarding_requests:read",
      "onboarding_requests:update",
      "onboarding_tasks:read",
      "onboarding_documents:read",
    ]

    expect(canAccessDashboardRoute("/dashboard/employees/onboarding", selfServicePermissions, "employee")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/me/onboarding", [], "employee")).toBe(true)
  })
  it.each([
    "employees:create",
    "onboarding_workflows:read",
    "onboarding_requests:create",
    "onboarding_requests:approve",
    "onboarding_requests:complete",
  ])("allows company onboarding with %s", (permission) => {
    expect(canAccessDashboardRoute("/dashboard/employees/onboarding", [permission], "admin")).toBe(true)
  })
  it("requires invitation creation permission", () => {
    expect(canAccessDashboardRoute("/dashboard/employees/invite", ["employees:create"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/employees/invite", ["employees:read"], "admin")).toBe(false)
  })
  it("requires an explicit employment contract permission", () => {
    for (const permissions of [[], ["employees:read"], ["employees:create"], ["employees:update"], ["onboarding_requests:read"]]) {
      expect(canAccessDashboardRoute("/dashboard/employees/contracts", permissions, "admin")).toBe(false)
    }
    expect(canAccessDashboardRoute("/dashboard/employees/contracts", ["employment_contracts:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/employees/contracts", ["employment_contracts:manage"], "admin")).toBe(true)
  })
})
