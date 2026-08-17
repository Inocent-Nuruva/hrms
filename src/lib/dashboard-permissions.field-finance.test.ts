import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasFieldAccess,
  hasFinanceAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "view_company_dashboard",
  "view_company_data",
  "company_users:read",
  "employees:read",
  "roles:read",
]

describe("field and finance route access", () => {
  it("hides field operations without a field permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/field/overview", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasFieldAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows field operations for field_visits:read regardless of access mode", () => {
    expect(
      canAccessDashboardRoute("/dashboard/field/visits", ["field_visits:read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/field/visits", ["field_visits:read"], "employee"),
    ).toBe(true)
  })

  it("hides finance operations without a finance permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/finance/overview", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasFinanceAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows finance operations for employee_finance:read regardless of access mode", () => {
    expect(
      canAccessDashboardRoute("/dashboard/finance/applications", ["employee_finance:read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/finance/accounts", ["employee_finance:read"], "employee"),
    ).toBe(true)
  })

  it("leaves personal field and finance available without operations permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/me/field/visits", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/finance", [], "admin")).toBe(true)
  })
})
