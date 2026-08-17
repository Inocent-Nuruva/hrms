import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasSmsAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "view_company_dashboard",
  "view_company_data",
  "company_users:read",
  "employees:read",
  "roles:read",
]

describe("sms and manager route access", () => {
  it("hides SMS operations without an sms permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/sms/overview", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasSmsAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows SMS operations for sms:read regardless of access mode", () => {
    expect(canAccessDashboardRoute("/dashboard/sms/logs", ["sms:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/sms/registry", ["sms:read"], "employee")).toBe(true)
  })

  it("leaves personal team pages available without operations permissions", () => {
    expect(canAccessDashboardRoute("/dashboard/me/team/overview", [], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/team/actions", [], "admin")).toBe(true)
  })
})
