import { describe, expect, it } from "vitest"
import { canAccessDashboardRoute } from "./dashboard-permissions"

describe("Phase 1A KPI dashboard routes", () => {
  it("keeps management pages behind organization scope permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/kpi", ["data_scope:company", "kpi_assignments:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/kpi/assignments", ["data_scope:department", "kpi_assignments:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/kpi", ["data_scope:self"], "employee")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/kpi", ["data_scope:company"], "admin")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/kpi", [], "admin")).toBe(false)
  })
  it("allows the personal route without exposing management pages", () => {
    expect(canAccessDashboardRoute("/dashboard/me/kpi", ["data_scope:self"], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/kpi/targets", ["data_scope:self"], "employee")).toBe(false)
  })
})
