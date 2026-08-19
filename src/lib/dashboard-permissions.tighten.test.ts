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

  it("flips the admin shell from specialist grants, not only company-dashboard", () => {
    expect(hasAdminDashboardAccess(["branches:read"])).toBe(true)
    expect(hasAdminDashboardAccess(["leave_types:read"])).toBe(true)
    expect(hasAdminDashboardAccess(["self_service_requests:approve"])).toBe(true)
    expect(hasAdminDashboardAccess(["employees:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["leave_requests:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["leave_balances:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["attendance_summaries:read"])).toBe(false)
    expect(hasAdminDashboardAccess(["leave_types:read"])).toBe(true)
    expect(buildDashboardActorSnapshotFromSources({ permissions: ["branches:read"] }).accessMode).toBe(
      "admin",
    )
    expect(buildDashboardActorSnapshotFromSources({ permissions: ["employees:read"] }).accessMode).toBe(
      "employee",
    )
    expect(
      buildDashboardActorSnapshotFromSources({
        permissions: ["leave_requests:read", "leave_balances:read"],
      }).accessMode,
    ).toBe("employee")
    expect(
      buildDashboardActorSnapshotFromSources({
        permissions: ["employees:read"],
        roles: [{ name: "HR_MANAGER" }],
      }).accessMode,
    ).toBe("admin")
  })

  it("lets an employee-shell approver open HR approval routes only", () => {
    expect(
      canAccessDashboardRoute(
        "/dashboard/employees/profile-update-approvals",
        ["self_service_requests:approve"],
        "employee",
      ),
    ).toBe(true)
    expect(
      canAccessDashboardRoute("/dashboard/employees/all", ["employees:read"], "employee"),
    ).toBe(false)
    expect(
      canAccessDashboardRoute("/dashboard/employees/all", ["employees:read"], "admin"),
    ).toBe(true)
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

  it("prefers grants over a stale employee dashboard_type", () => {
    expect(
      buildDashboardActorSnapshotFromSources({
        dashboard_type: "employee",
        permissions: ["branches:read"],
      }).accessMode,
    ).toBe("admin")
  })
})
