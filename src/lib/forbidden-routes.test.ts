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
  })

  it("sends a forbidden tab to the next visible sibling", () => {
    stubSession()
    rememberForbiddenRoute("/dashboard/structure/grades")
    expect(
      firstVisibleSiblingOrHome("/dashboard/structure/grades", ["cost_centers:read"], "admin"),
    ).toBe("/dashboard/structure/cost-centers")
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
