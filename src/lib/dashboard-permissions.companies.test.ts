import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  COMPANY_MANAGEMENT_ROUTE_PERMISSION,
  hasPermission,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "company_dashboard:read",
  "company_data:read",
  "company_users:read",
  "company_users:create",
  "company_users:update",
  "company_users:delete",
  "roles:read",
  "employees:read",
]

const PLATFORM_OWNER_PERMISSIONS = [
  "companies:read",
  "companies:update",
  "company_users:read",
]

describe("companies route access", () => {
  it("hides /dashboard/companies from company-scoped admins", () => {
    expect(
      canAccessDashboardRoute("/dashboard/companies", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(
      hasPermission(COMPANY_ADMIN_PERMISSIONS, COMPANY_MANAGEMENT_ROUTE_PERMISSION),
    ).toBe(false)
  })

  it("keeps /dashboard/companies for platform actors with companies:read", () => {
    expect(
      canAccessDashboardRoute("/dashboard/companies", PLATFORM_OWNER_PERMISSIONS, "admin"),
    ).toBe(true)
  })

  it("does not treat company_users permissions as platform company access", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/companies",
        ["company_users:read", "company_users:update"],
        "admin",
      ),
    ).toBe(false)
  })
})
