import { describe, expect, it } from "vitest"
import { canAccessDashboardRoute } from "./dashboard-permissions"

describe("joining workspace access", () => {
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
