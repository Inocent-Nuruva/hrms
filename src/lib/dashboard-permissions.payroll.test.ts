import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasPayrollAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "view_company_dashboard",
  "view_company_data",
  "company_users:read",
  "employees:read",
  "roles:read",
]

describe("payroll route access", () => {
  it("hides operations payroll from company admins without payroll permissions", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/payroll",
        COMPANY_ADMIN_PERMISSIONS,
        "admin",
      ),
    ).toBe(false)
    expect(hasPayrollAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("keeps operations payroll for actors with payroll:read", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/payroll",
        ["payroll:read", "view_company_dashboard"],
        "admin",
      ),
    ).toBe(true)
  })

  it("treats payroll_runs:read as enough to open the route", () => {
    expect(hasPayrollAccess(["payroll_runs:read"])).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/operations/payroll", ["payroll_runs:read"], "admin"),
    ).toBe(true)
  })

  it("lets employee-shell users open operations payroll when they have payroll access", () => {
    expect(
      canAccessDashboardRoute("/dashboard/operations/payroll", ["payroll:read"], "employee"),
    ).toBe(true)
  })

  it("leaves personal payroll available without payroll admin permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/me/payroll", [], "employee")).toBe(true)
  })
})
