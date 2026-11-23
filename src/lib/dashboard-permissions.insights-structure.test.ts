import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasAnalyticsAccess,
  hasInsightsAccess,
  hasStructureAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "company_dashboard:read",
  "company_data:read",
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
    expect(
      canAccessDashboardRoute("/dashboard/structure", ["employee_numbering:read"], "admin"),
    ).toBe(true)
    expect(hasStructureAccess(["employee_numbering:read"])).toBe(true)
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

  it("shows the sales-field dashboard for analytics:dashboards-sales-field", () => {
    expect(
      canAccessDashboardRoute("/dashboard/insights/sales-field", ["analytics:dashboards-sales-field"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/insights/sales-field", ["employees:read"], "admin"),
    ).toBe(false)
  })

  it("shows HR insights for analytics:dashboards-hr but not readiness", () => {
    expect(canAccessDashboardRoute("/dashboard/insights/hr", ["analytics:dashboards-hr"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/insights/readiness", ["analytics:dashboards-hr"], "employee")).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/insights/readiness", ["hrms_launch_readiness:read"], "admin"),
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
        ["employee_access_credentials:read"],
        "admin",
      ),
    ).toBe(true)
  })

  it("does not treat company dashboard access as analytics catalog access", () => {
    expect(hasAnalyticsAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
    expect(hasAnalyticsAccess(["analytics:dashboards-sales-field"])).toBe(true)
  })

  it("leaves leftover personal insights links available so they can redirect home", () => {
    expect(canAccessDashboardRoute("/dashboard/me/insights", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/onboarding", [], "employee")).toBe(true)
  })
})
