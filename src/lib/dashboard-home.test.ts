import { describe, expect, it } from "vitest"

import { readRoleNamesFromUnknown } from "./dashboard-permissions"
import { resolveHomeDashboardKind } from "./dashboard-home"

describe("resolveHomeDashboardKind", () => {
  it("sends HR Manager to the HR dashboard even with company-dashboard access", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        permissionLabels: ["view_company_dashboard", "dashboards:read"],
        roleNames: ["HR_MANAGER"],
      }),
    ).toBe("hr")
  })

  it("sends a line manager to the manager dashboard, not management", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        permissionLabels: ["view_manager_dashboard"],
        roleNames: ["MANAGER"],
      }),
    ).toBe("manager")
  })

  it("sends management / director roles to the management dashboard", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        permissionLabels: [],
        roleNames: ["MANAGEMENT"],
      }),
    ).toBe("management")
  })

  it("sends company admin to the company overview", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        permissionLabels: ["view_company_dashboard"],
        roleNames: ["COMPANY_ADMIN"],
      }),
    ).toBe("company")
  })

  it("uses a specific dashboard grant when the role name is generic", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        permissionLabels: ["sales_field:read"],
        roleNames: ["COMPANY_USER"],
      }),
    ).toBe("sales-field")
  })

  it("reads role names from the user record and JWT-shaped payload", () => {
    expect(
      readRoleNamesFromUnknown({
        roles: [{ name: "HR_MANAGER", display_name: "HR Manager" }],
      }),
    ).toEqual(["HR_MANAGER"])
  })

  it("keeps employees on the self-service home", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "employee",
        permissionLabels: [],
        roleNames: ["COMPANY_USER"],
      }),
    ).toBe("employee")
  })

  it("does not let permission grants replace the employee home dashboard", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "employee",
        permissionLabels: ["view_company_dashboard", "view_manager_dashboard", "sales_field:read"],
        roleNames: ["COMPANY_USER"],
      }),
    ).toBe("employee")
  })

  it("still lets role-derived manager identities keep their role home", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "employee",
        permissionLabels: ["view_manager_dashboard"],
        roleNames: ["MANAGER"],
      }),
    ).toBe("manager")
  })
})
