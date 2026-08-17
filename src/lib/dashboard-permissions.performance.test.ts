import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasPerformanceAccess,
  hasProbationAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "view_company_dashboard",
  "view_company_data",
  "company_users:read",
  "employees:read",
  "roles:read",
]

describe("performance and probation route access", () => {
  it("hides HR performance from company admins without performance permissions", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/performance/overview",
        COMPANY_ADMIN_PERMISSIONS,
        "admin",
      ),
    ).toBe(false)
    expect(hasPerformanceAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("keeps HR performance for actors with performance:read", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/performance/setup",
        ["performance:read", "view_company_dashboard"],
        "admin",
      ),
    ).toBe(true)
  })

  it("treats performance_reviews:read as enough to open reviews, not setup", () => {
    expect(hasPerformanceAccess(["performance_reviews:read"])).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/performance/reviews",
        ["performance_reviews:read"],
        "admin",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/performance/setup",
        ["performance_reviews:read"],
        "admin",
      ),
    ).toBe(false)
  })

  it("shows performance and probation whenever the actor has the permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/performance/overview", ["performance:read"], "employee"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/probation/cases", ["probation:read"], "employee"),
    ).toBe(true)
  })

  it("leaves personal performance and probation available without HR permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/me/performance/overview", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/performance/team", [], "employee")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/me/performance/team", ["manager:read"], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/probation", [], "employee")).toBe(true)
  })

  it("hides HR probation from company admins without probation permissions", () => {
    expect(
      canAccessDashboardRoute("/dashboard/probation/overview", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasProbationAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("keeps HR probation cases for probation_cases:read but not the team tab", () => {
    expect(hasProbationAccess(["probation_cases:read"])).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/probation/cases", ["probation_cases:read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/probation/team", ["probation_cases:read"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/probation/team", ["manager:read"], "admin"),
    ).toBe(true)
  })
})
