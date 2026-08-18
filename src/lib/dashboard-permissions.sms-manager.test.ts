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
    expect(canAccessDashboardRoute("/dashboard/sms", ["sms:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/sms/logs", ["sms:read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/sms/registry", ["sms:read"], "employee")).toBe(true)
  })

  it("does not treat a loose *_sms grant as company SMS admin", () => {
    expect(hasSmsAccess(["send_sms", "notification_sms:read", "otp_sms"])).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/sms", ["send_sms", "companies:read"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/sms/platform", ["send_sms", "companies:read"], "admin"),
    ).toBe(false)
  })

  it("hides personal team pages without a manager grant", () => {
    expect(canAccessDashboardRoute("/dashboard/me/team/overview", [], "employee")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/me/team/actions", [], "admin")).toBe(false)
  })

  it("shows personal team pages for manager:read", () => {
    expect(canAccessDashboardRoute("/dashboard/me/team/overview", ["manager:read"], "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/me/team/actions", ["view_team"], "admin")).toBe(true)
  })

  it("does not treat sms:read as platform SMS access", () => {
    expect(canAccessDashboardRoute("/dashboard/sms/platform", ["sms:read"], "admin")).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/sms/platform", ["sms:read", "companies:read"], "admin"),
    ).toBe(true)
  })
})
