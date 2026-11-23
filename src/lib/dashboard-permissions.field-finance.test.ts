import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasFieldAccess,
  hasFinanceAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "company_dashboard:read",
  "company_data:read",
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

  it("shows field visits for field_visits:hr-read but not parties", () => {
    expect(
      canAccessDashboardRoute("/dashboard/field/visits", ["field_visits:hr-read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/field/visits", ["field_visits:hr-read"], "employee"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/field/parties", ["field_visits:hr-read"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/field/parties", ["field_visits:config"], "admin"),
    ).toBe(true)
  })

  it("hides finance operations without a finance permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/finance/overview", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasFinanceAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows finance applications for read, not products or accounts", () => {
    expect(
      canAccessDashboardRoute("/dashboard/finance/applications", ["employee_finance:applications-read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/finance/accounts", ["employee_finance:applications-read"], "employee"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/finance/accounts", ["employee_finance:accounts-read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/finance/products", ["employee_finance:applications-read"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/finance/products", ["employee_finance:products"], "admin"),
    ).toBe(true)
  })

  it("leaves personal field and finance available without operations permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/me/field/visits", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/finance", [], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/finance/applications", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/finance/payroll", [], "employee")).toBe(true)
  })
})
