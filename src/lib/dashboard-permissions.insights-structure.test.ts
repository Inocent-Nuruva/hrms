import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasAnalyticsAccess,
  hasInsightsAccess,
  hasStructureAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "view_company_dashboard",
  "view_company_data",
  "company_users:read",
  "employees:read",
  "roles:read",
]

describe("structure and insights route access", () => {
  it("hides structure without a cost-center or grade permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/structure/cost-centers", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasStructureAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows structure for cost_centers:read regardless of access mode", () => {
    expect(
      canAccessDashboardRoute("/dashboard/structure/cost-centers", ["cost_centers:read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/structure/grades", ["employee_grades:read"], "employee"),
    ).toBe(true)
  })

  it("does not treat employees:create as numbering access", () => {
    expect(
      canAccessDashboardRoute("/dashboard/structure/numbering", ["employees:create", "employees:update"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/structure/numbering", ["employee_numbering:read"], "admin"),
    ).toBe(true)
  })

  it("hides grades when the actor only has cost-center access", () => {
    expect(
      canAccessDashboardRoute("/dashboard/structure/grades", ["cost_centers:read"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/structure/cost-centers", ["employee_grades:read"], "admin"),
    ).toBe(false)
  })

  it("hides insights from company admins without a dashboards grant", () => {
    expect(
      canAccessDashboardRoute("/dashboard/insights/hr", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasInsightsAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows the sales-field dashboard for analytics:read", () => {
    expect(
      canAccessDashboardRoute("/dashboard/insights/sales-field", ["analytics:read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/insights/sales-field", ["employees:read"], "admin"),
    ).toBe(false)
  })

  it("shows HR insights for dashboards:read but not readiness", () => {
    expect(canAccessDashboardRoute("/dashboard/insights/hr", ["dashboards:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/insights/readiness", ["dashboards:read"], "employee")).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/insights/readiness", ["launch_readiness:read"], "admin"),
    ).toBe(true)
  })

  it("hides access credentials when the actor only has employees:read", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/access-control/access-credentials",
        ["employees:read", "attendance_devices:read"],
        "admin",
      ),
    ).toBe(false)
    expect(
      canAccessDashboardRoute(
        "/dashboard/access-control/access-credentials",
        ["access_credentials:read"],
        "admin",
      ),
    ).toBe(true)
  })

  it("does not treat company dashboard access as analytics catalog access", () => {
    expect(hasAnalyticsAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
    expect(hasAnalyticsAccess(["analytics:read"])).toBe(true)
  })

  it("leaves personal insights available without operations permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/me/insights", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/onboarding", [], "employee")).toBe(true)
  })
})
