import { describe, expect, it } from "vitest"

import {
  buildDashboardActorSnapshotFromSources,
  canAccessDashboardRoute,
  hasAdminDashboardAccess,
  hasPermission,
  readPermissionLabelsFromUnknown,
} from "./dashboard-permissions"

describe("tightened dashboard permissions", () => {
  it("fails closed on unmapped dashboard routes", () => {
    expect(canAccessDashboardRoute("/dashboard/users", ["employees:read"], "admin")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/unknown-module", ["view_company_dashboard"], "admin")).toBe(
      false,
    )
    expect(canAccessDashboardRoute("/dashboard", [], "employee")).toBe(true)
  })

  it("does not treat role names or resource wildcards as global bypass", () => {
    expect(hasPermission(["admin"], "payroll:read")).toBe(false)
    expect(hasPermission(["administrator"], "companies:read")).toBe(false)
    expect(hasPermission(["employees:*"], "employees:read")).toBe(true)
    expect(hasPermission(["employees:*"], "payroll:read")).toBe(false)
    expect(hasPermission(["*"], "payroll:read")).toBe(true)
  })

  it("does not collect a display name or role as a permission label", () => {
    expect(
      readPermissionLabelsFromUnknown({
        name: "Administrator",
        role: "admin",
        user_type: "owner",
        permissions: ["employees:read"],
      }),
    ).toEqual(["employees:read"])
  })

  it("uses employee-creation permissions, not HR or admin role names, for registration", () => {
    expect(
      canAccessDashboardRoute("/dashboard/employees/registration", ["employees:create"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/registration", ["company_users:create"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/registration", ["users:create"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/registration", ["admin", "hr_manager"], "admin"),
    ).toBe(false)
  })

  it("keeps explicit employee identity on the employee shell even with extra grants", () => {
    expect(hasAdminDashboardAccess(["branches:read"])).toBe(true)
    expect(hasAdminDashboardAccess(["leave_types:read"])).toBe(true)
    expect(hasAdminDashboardAccess(["self_service_requests:approve"])).toBe(true)
    expect(hasAdminDashboardAccess(["employees:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["leave_requests:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["leave_balances:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["attendance_summaries:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["performance:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["leave_types:read"])).toBe(true)
    expect(buildDashboardActorSnapshotFromSources({ permissions: ["employees:read"] }).accessMode).toBe(
      "employee",
    )
    expect(
      buildDashboardActorSnapshotFromSources({
        dashboard_type: "employee",
        permissions: ["branches:read"],
      }).accessMode,
    ).toBe("employee")
    expect(
      buildDashboardActorSnapshotFromSources({
        role: "employee",
        permissions: ["leave_types:read"],
      }).accessMode,
    ).toBe("employee")
    expect(
      buildDashboardActorSnapshotFromSources({
        permissions: ["leave_requests:read", "leave_balances:read"],
      }).accessMode,
    ).toBe("employee")
    expect(
      buildDashboardActorSnapshotFromSources({
        permissions: ["branches:read"],
      }).accessMode,
    ).toBe("employee")
    expect(
      buildDashboardActorSnapshotFromSources({
        permissions: ["employees:read"],
        roles: [{ name: "HR_MANAGER" }],
      }).accessMode,
    ).toBe("admin")
    expect(
      buildDashboardActorSnapshotFromSources({
        dashboard_type: "admin",
        permissions: [],
      }).accessMode,
    ).toBe("admin")
    expect(
      buildDashboardActorSnapshotFromSources({
        roles: [{ name: "ADMIN" }],
        permissions: [],
      }).accessMode,
    ).toBe("admin")
  })

  it("lets an employee-shell actor open granted HR routes without flipping shells", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/employees/profile-update-approvals",
        ["self_service_requests:approve"],
        "employee",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/all", ["employees:read"], "employee"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/all", ["employees:read"], "admin"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/profile/EMP-001", ["employees:read"], "employee"),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/branches", ["branches:read"], "employee"),
    ).toBe(true)
  })

  it("lets employee-shell users open Business Trips with any trip grant", () => {
    for (const permission of [
      "attendance_business_trips:approve",
      "attendance_business_trips:cancel",
      "attendance_business_trips:create",
      "attendance_business_trips:delete",
      "attendance_business_trips:read",
      "attendance_business_trips:update",
    ]) {
      expect(
        canAccessDashboardRoute(
          "/dashboard/leave-management/business-trips",
          [permission],
          "employee",
        ),
      ).toBe(true)
    }
  })

  it("does not let employees:read open Access Control", () => {
    expect(
      canAccessDashboardRoute("/dashboard/access-control", ["employees:read"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/access-control", ["attendance_devices:read"], "admin"),
    ).toBe(true)
  })

  it("gates recruitment and operations promotion on the real module grant", () => {
    expect(
      canAccessDashboardRoute("/dashboard/operations/recruitment", ["view_company_dashboard"], "admin"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/operations/recruitment", ["employees:create"], "admin"),
    ).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/operations/promotion", [], "admin")).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/operations/promotion", ["employee_movements:read"], "admin"),
    ).toBe(true)
  })

  it("does not let attendance report access open scheduled reporting", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/scheduled-reporting",
        ["attendance_summaries:read", "attendance_reports:read"],
        "admin",
      ),
    ).toBe(false)
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/scheduled-reporting",
        ["scheduled_reporting:read", "manage_scheduled_reports"],
        "admin",
      ),
    ).toBe(false)
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/scheduled-reporting",
        ["scheduled_reports:read"],
        "admin",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/scheduled-reporting",
        ["scheduled_reports:manage_smtp"],
        "admin",
      ),
    ).toBe(true)
  })

  it.each([
    "scheduled_reports:read",
    "scheduled_reports:create",
    "scheduled_reports:update",
    "scheduled_reports:manage_smtp",
    "scheduled_reports:view_history",
  ])("opens scheduled reporting for its feature permission %s", (permission) => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/operations/scheduled-reporting",
        [permission],
        "admin",
      ),
    ).toBe(true)
  })

  it("keeps company overview as an intentional admin-shell-only route", () => {
    expect(
      canAccessDashboardRoute("/dashboard/company-overview", ["view_company_dashboard"], "employee"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/company-overview", ["view_company_dashboard"], "admin"),
    ).toBe(true)
  })

  it("lets HR Manager open the admin shell even if login still says employee", () => {
    expect(
      buildDashboardActorSnapshotFromSources({
        dashboard_type: "employee",
        roles: [{ name: "HR_MANAGER" }],
        permissions: ["view_company_dashboard"],
      }).accessMode,
    ).toBe("admin")
  })

  it("uses an explicit admin dashboard_type ahead of token fallback claims", () => {
    expect(
      buildDashboardActorSnapshotFromSources(
        { dashboard_type: "admin", roles: [{ name: "EMPLOYEE" }] },
        { dashboard_type: "employee" },
      ).accessMode,
    ).toBe("admin")
  })

  it("preserves platform scope independently from the admin dashboard type", () => {
    const snapshot = buildDashboardActorSnapshotFromSources({
      scope: "platform",
      dashboard_type: "admin",
      roles: ["SUPER_ADMIN"],
      permissions: ["companies:read"],
    })

    expect(snapshot.scope).toBe("platform")
    expect(snapshot.accessMode).toBe("admin")
  })
})
