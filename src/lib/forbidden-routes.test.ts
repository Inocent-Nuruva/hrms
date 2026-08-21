import { afterEach, describe, expect, it, vi } from "vitest"

import { canAccessDashboardRoute } from "./dashboard-permissions"
import {
  canSeeDashboardPage,
  confirmPlatformRoute,
  firstVisibleSiblingOrHome,
  isRememberedForbiddenRoute,
  rememberForbiddenRoute,
} from "./forbidden-routes"

describe("forbidden route memory", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubSession() {
    const store = new Map<string, string>()
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
      },
      dispatchEvent: () => true,
    })
  }

  it("hides only the tab that failed, not sibling tabs", () => {
    stubSession()
    expect(canSeeDashboardPage("/dashboard/structure/grades", ["employee_grades:read"], "admin")).toBe(true)
    rememberForbiddenRoute("/dashboard/structure/grades")
    expect(isRememberedForbiddenRoute("/dashboard/structure/grades")).toBe(true)
    expect(isRememberedForbiddenRoute("/dashboard/structure/cost-centers")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/structure/grades", ["employee_grades:read"], "admin")).toBe(false)
    expect(
      canSeeDashboardPage("/dashboard/structure/cost-centers", ["cost_centers:read"], "admin"),
    ).toBe(true)
  })

  it("still hides operations routes that lack JWT grants", () => {
    expect(canAccessDashboardRoute("/dashboard/field/overview", ["employees:read"], "admin")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/sms/overview", ["employees:read"], "admin")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/sms", ["employees:read"], "admin")).toBe(false)
  })

  it("opens the first SMS tab from the section root instead of the dashboard", () => {
    expect(firstVisibleSiblingOrHome("/dashboard/sms", ["sms:read"], "admin")).toBe(
      "/dashboard/sms/overview",
    )
    expect(canSeeDashboardPage("/dashboard/sms", ["sms:read"], "admin")).toBe(true)
    expect(
      firstVisibleSiblingOrHome(
        "/dashboard/sms",
        ["sms:settings:read", "sms:logs:read", "companies:read"],
        "admin",
      ),
    ).toBe("/dashboard/sms/overview")
    expect(
      canSeeDashboardPage("/dashboard/sms/overview", ["sms:settings:read"], "admin"),
    ).toBe(true)
    expect(
      canSeeDashboardPage("/dashboard/sms/platform", ["sms:settings:read", "companies:read"], "admin"),
    ).toBe(false)
  })

  it("does not hide company SMS after an API permission error", () => {
    stubSession()
    rememberForbiddenRoute("/dashboard/sms")
    rememberForbiddenRoute("/dashboard/sms/overview")
    rememberForbiddenRoute("/dashboard/sms/registry")
    rememberForbiddenRoute("/dashboard/sms/logs")
    expect(isRememberedForbiddenRoute("/dashboard/sms/overview")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/sms/overview", ["sms:read"], "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/sms", ["sms:read"], "admin")).toBe(true)
  })

  it("sends a forbidden tab to the next visible sibling", () => {
    stubSession()
    rememberForbiddenRoute("/dashboard/structure/grades")
    expect(
      firstVisibleSiblingOrHome("/dashboard/structure/grades", ["cost_centers:read"], "admin"),
    ).toBe("/dashboard/structure/cost-centers")
  })

  it("does not hide My pages after an API permission error", () => {
    stubSession()
    rememberForbiddenRoute("/dashboard/me/performance")
    rememberForbiddenRoute("/dashboard/me/performance/overview")
    rememberForbiddenRoute("/dashboard/me/probation")
    rememberForbiddenRoute("/dashboard/me/leave/requests")
    rememberForbiddenRoute("/dashboard/attendance/today")
    expect(isRememberedForbiddenRoute("/dashboard/me/performance/overview")).toBe(false)
    expect(isRememberedForbiddenRoute("/dashboard/me/probation")).toBe(false)
    expect(isRememberedForbiddenRoute("/dashboard/me/leave/requests")).toBe(false)
    expect(isRememberedForbiddenRoute("/dashboard/attendance/today")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/me/performance/overview", [], "employee")).toBe(true)
    expect(firstVisibleSiblingOrHome("/dashboard/probation/overview", [], "employee")).toBe(
      "/dashboard/me/probation",
    )
  })

  it("keeps self-service routes directly accessible but out of admin navigation", () => {
    expect(canAccessDashboardRoute("/dashboard/me/performance/overview", [], "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/me/performance/overview", [], "admin")).toBe(false)
    expect(canSeeDashboardPage("/dashboard/attendance/today", [], "admin")).toBe(false)
  })

  it("shows permission-granted HR routes in employee navigation", () => {
    expect(canAccessDashboardRoute("/dashboard/employees/all", ["employees:read"], "employee")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/employees/all", ["employees:read"], "employee")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/companies", ["employees:read"], "employee")).toBe(false)
  })

  it("redirects restricted self-service manager routes to a safe fallback", () => {
    expect(firstVisibleSiblingOrHome("/dashboard/me/team/overview", [], "employee")).toBe(
      "/dashboard/me/profile",
    )
    expect(firstVisibleSiblingOrHome("/dashboard/me/performance/team", [], "employee")).toBe(
      "/dashboard/me/performance/overview",
    )
  })

  it("keeps admin-shell fallbacks out of personal self-service routes", () => {
    expect(firstVisibleSiblingOrHome("/dashboard/operations/payroll", [], "admin")).toBe(
      "/dashboard",
    )
    expect(firstVisibleSiblingOrHome("/dashboard/probation/team", [], "admin")).toBe(
      "/dashboard",
    )
  })

  it("does not hide Reports after an analytics permission error", () => {
    stubSession()
    rememberForbiddenRoute("/dashboard/operations/reports")
    expect(isRememberedForbiddenRoute("/dashboard/operations/reports")).toBe(false)
    expect(
      canSeeDashboardPage("/dashboard/operations/reports", ["attendance_summaries:read"], "admin"),
    ).toBe(true)
  })

  it("hides Companies until GET /api/companies is confirmed", () => {
    stubSession()
    expect(
      canSeeDashboardPage("/dashboard/companies", ["companies:read"], "admin"),
    ).toBe(false)
    confirmPlatformRoute("/dashboard/companies")
    expect(
      canSeeDashboardPage("/dashboard/companies", ["companies:read"], "admin"),
    ).toBe(true)
  })

  it("hides the Structure nav item when no child page is usable", () => {
    stubSession()
    expect(
      canSeeDashboardPage(
        "/dashboard/structure",
        ["cost_centers:read", "employee_grades:read"],
        "admin",
      ),
    ).toBe(true)
    rememberForbiddenRoute("/dashboard/structure/cost-centers")
    rememberForbiddenRoute("/dashboard/structure/grades")
    expect(canSeeDashboardPage("/dashboard/structure", ["cost_centers:read"], "admin")).toBe(false)
  })

  it("keeps Companies hidden after a platform-scope 403", () => {
    stubSession()
    confirmPlatformRoute("/dashboard/companies")
    rememberForbiddenRoute("/dashboard/companies")
    expect(
      canSeeDashboardPage("/dashboard/companies", ["companies:read"], "admin"),
    ).toBe(false)
  })
})
