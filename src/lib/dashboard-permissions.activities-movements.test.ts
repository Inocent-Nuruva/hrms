import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasActivitiesAccess,
  hasMovementsAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "view_company_dashboard",
  "view_company_data",
  "company_users:read",
  "employees:read",
  "roles:read",
]

describe("activity and movement route access", () => {
  it("hides activity operations without an activities permission", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/activities/overview",
        COMPANY_ADMIN_PERMISSIONS,
        "admin",
      ),
    ).toBe(false)
    expect(hasActivitiesAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows activity reports for activities:read but not reviews or setup", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/activities/reports",
        ["activities:read"],
        "employee",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/activities/reviews",
        ["activities:read"],
        "admin",
      ),
    ).toBe(false)
    expect(
      canAccessDashboardRoute(
        "/dashboard/activities/reviews",
        ["activities:update"],
        "admin",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/activities/setup",
        ["activities:read"],
        "admin",
      ),
    ).toBe(false)
  })

  it("hides movement operations without an employee-movements permission", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/movements/overview",
        COMPANY_ADMIN_PERMISSIONS,
        "admin",
      ),
    ).toBe(false)
    expect(hasMovementsAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows movement cases for read and operations only for update/approve", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/movements/cases",
        ["employee_movements:read"],
        "admin",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/movements/operations",
        ["employee_movements:read"],
        "employee",
      ),
    ).toBe(false)
    expect(
      canAccessDashboardRoute(
        "/dashboard/movements/operations",
        ["employee_movements:approve"],
        "admin",
      ),
    ).toBe(true)
  })

  it("shows team movements to manager-scoped users", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/team/movements",
        ["manager_team:read"],
        "employee",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/team/movements",
        COMPANY_ADMIN_PERMISSIONS,
        "admin",
      ),
    ).toBe(false)
  })

  it("leaves personal activities and movements available without operations permissions", () => {
    expect(
      canAccessDashboardRoute("/dashboard/me/activities/today", [], "employee"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/me/activities/reports", [], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/me/movements", [], "employee"),
    ).toBe(true)
  })
})
