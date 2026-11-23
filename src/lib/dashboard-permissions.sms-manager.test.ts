import { describe, expect, it } from "vitest"

import {
  canAccessDashboardRoute,
  hasSmsAccess,
} from "./dashboard-permissions"

const COMPANY_ADMIN_PERMISSIONS = [
  "company_dashboard:read",
  "company_data:read",
  "company_users:read",
  "employees:read",
  "roles:read",
]

const COMPANY_ADMIN_SMS_PERMISSIONS = [
  "sms:settings-read",
  "sms:settings-update",
  "sms:logs-read",
  "sms:logs-retry",
  "sms:test",
]

describe("sms and manager route access", () => {
  it("hides SMS operations without an sms permission", () => {
    expect(
      canAccessDashboardRoute("/dashboard/sms/overview", COMPANY_ADMIN_PERMISSIONS, "admin"),
    ).toBe(false)
    expect(hasSmsAccess(COMPANY_ADMIN_PERMISSIONS)).toBe(false)
  })

  it("shows SMS operations for sms:logs-read regardless of access mode", () => {
    expect(canAccessDashboardRoute("/dashboard/sms", ["sms:logs-read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/sms/logs", ["sms:logs-read"], "admin")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/sms/registry", ["sms:logs-read"], "employee")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/sms/registry", ["sms:settings-read"], "employee")).toBe(true)
  })

  it("shows company SMS for the live sms:settings and sms:logs grants", () => {
    expect(hasSmsAccess(COMPANY_ADMIN_SMS_PERMISSIONS)).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/sms/overview", COMPANY_ADMIN_SMS_PERMISSIONS, "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/sms/registry", COMPANY_ADMIN_SMS_PERMISSIONS, "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/sms/logs", COMPANY_ADMIN_SMS_PERMISSIONS, "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/sms/platform", COMPANY_ADMIN_SMS_PERMISSIONS, "admin"),
    ).toBe(false)
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
    expect(canAccessDashboardRoute("/dashboard/me/team/actions", ["manager_team:read"], "admin")).toBe(true)
  })

  it("does not treat sms:read as platform SMS access", () => {
    expect(canAccessDashboardRoute("/dashboard/sms/platform", ["sms:logs-read"], "admin")).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/sms/platform", ["sms:logs-read", "companies:read"], "admin"),
    ).toBe(true)
  })
})
