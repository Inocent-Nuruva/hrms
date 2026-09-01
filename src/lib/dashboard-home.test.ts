import { describe, expect, it } from "vitest"

import { readRoleNamesFromUnknown } from "./dashboard-permissions"
import {
  canSeeHrLeaveRequestsQueue,
  isHumanResourcesEmployeeRecord,
  resolveHomeDashboardKind,
} from "./dashboard-home"

describe("isHumanResourcesEmployeeRecord", () => {
  it("recognizes a direct employee department", () => {
    expect(
      isHumanResourcesEmployeeRecord({
        employee_no: "AICL/00035",
        primary_department: { name: "Human Resources" },
      }),
    ).toBe(true)
  })

  it("recognizes the nested employee dashboard envelope", () => {
    expect(
      isHumanResourcesEmployeeRecord({
        data: {
          employee: {
            primary_department: { name: "Human Resources" },
          },
        },
      }),
    ).toBe(true)
  })

  it("does not infer HR from an unrelated position label", () => {
    expect(
      isHumanResourcesEmployeeRecord({
        primary_department: { name: "Administration" },
        primary_position: { name: "Human Resources Officer" },
      }),
    ).toBe(false)
  })
})

describe("resolveHomeDashboardKind", () => {
  it("sends platform scope to the platform operations dashboard", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        scope: "platform",
        permissionLabels: ["companies:read"],
        roleNames: ["SUPER_ADMIN"],
      }),
    ).toBe("platform")
  })

  it("sends HR Manager to the HR dashboard even with company-dashboard access", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "admin",
        permissionLabels: ["view_company_dashboard", "dashboards:read"],
        roleNames: ["HR_MANAGER"],
      }),
    ).toBe("hr")
  })

  it("recognizes HR inside longer job-role names", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "employee",
        permissionLabels: [],
        roleNames: ["Manager - Head of Department - HR Manager"],
      }),
    ).toBe("hr")
  })

  it("uses an explicit HR dashboard grant before the employee fallback", () => {
    expect(
      resolveHomeDashboardKind({
        accessMode: "employee",
        permissionLabels: ["hr_dashboards:read"],
        roleNames: ["COMPANY_USER"],
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

describe("canSeeHrLeaveRequestsQueue", () => {
  it("shows the company leave queue to HR", () => {
    expect(
      canSeeHrLeaveRequestsQueue({
        accessMode: "admin",
        permissionLabels: ["leave_requests:read", "leave_requests:approve"],
        roleNames: ["HR_MANAGER"],
      }),
    ).toBe(true)
  })

  it("hides the company leave queue from company admin", () => {
    expect(
      canSeeHrLeaveRequestsQueue({
        accessMode: "admin",
        permissionLabels: ["leave_requests:read", "leave_requests:approve", "view_company_dashboard"],
        roleNames: ["COMPANY_ADMIN"],
      }),
    ).toBe(false)
  })

  it("uses an explicit home kind when department detection upgraded the person to HR", () => {
    expect(
      canSeeHrLeaveRequestsQueue({
        homeDashboardKind: "hr",
        accessMode: "employee",
        permissionLabels: ["leave_requests:approve"],
        roleNames: ["COMPANY_USER"],
      }),
    ).toBe(true)
  })
})
