import { describe, expect, it } from "vitest"

import { canSeeDashboardPage } from "./forbidden-routes"

// Permission subsets mirroring backend/src/database/seeds/005-company-roles.seed.ts.
const SELF_SERVICE = [
  "company_data:read",
  "employees:read",
  "leave_types:read",
  "leave_requests:read",
  "leave_requests:create",
  "leave_balances:read",
  "attendance_summaries:read",
  "attendance_mobile_punches:create",
]

const ROLES = {
  employee: {
    mode: "employee" as const,
    permissions: ["data_scope:self", ...SELF_SERVICE],
  },
  departmentManager: {
    mode: "employee" as const,
    permissions: [
      ...SELF_SERVICE,
      "company_dashboard:read",
      "data_scope:department",
      "manager_self_service:read",
      "manager_team:read",
      "manager:read",
      "leave_requests:approve",
      "self_service_requests:manager_review",
      "performance_development_plans:read",
      "team_attendance:read",
    ],
  },
  hrOfficer: {
    mode: "admin" as const,
    permissions: [
      ...SELF_SERVICE,
      "company_dashboard:read",
      "data_scope:company",
      "self_service_requests:approve",
      "self_service_requests:final_approve",
      "profile_change_request:view_all",
      "leave_requests:approve",
    ],
  },
  management: {
    mode: "admin" as const,
    permissions: [
      "company_dashboard:read",
      "company_data:read",
      "data_scope:company",
      "dashboard:management",
      "performance_dashboards:read",
    ],
  },
}

function sees(role: keyof typeof ROLES, url: string) {
  const { permissions, mode } = ROLES[role]
  return canSeeDashboardPage(url, permissions, mode)
}

describe("role-based navigation visibility", () => {
  it("shows employees their own attendance corrections and leave, not review queues", () => {
    expect(sees("employee", "/dashboard/attendance/corrections")).toBe(true)
    expect(sees("employee", "/dashboard/me/leave/requests")).toBe(true)
    expect(sees("employee", "/dashboard/me/leave/balances")).toBe(true)
    expect(sees("employee", "/dashboard/attendance/correction-requests")).toBe(false)
    expect(sees("employee", "/dashboard/employees/profile-update-approvals")).toBe(false)
  })

  it("shows department managers their team approval queues", () => {
    expect(sees("departmentManager", "/dashboard/attendance/correction-requests")).toBe(true)
    expect(sees("departmentManager", "/dashboard/employees/profile-update-approvals")).toBe(true)
    expect(sees("departmentManager", "/dashboard/me/team/actions")).toBe(true)
    expect(sees("departmentManager", "/dashboard/team/movements")).toBe(true)
    expect(sees("departmentManager", "/dashboard/attendance/corrections")).toBe(true)
  })

  it("keeps HR-only pages away from department managers", () => {
    // Profile change requests are backed by profile_change_request.view_all.
    expect(sees("departmentManager", "/dashboard/employees/profile-change-requests")).toBe(false)
    // Managers read their team's development plans, not the HR workspace.
    expect(sees("departmentManager", "/dashboard/performance/development")).toBe(false)
    expect(sees("departmentManager", "/dashboard/performance/calibration")).toBe(false)
    expect(sees("departmentManager", "/dashboard/operations/recruitment")).toBe(false)
  })

  it("shows HR every correction and profile review queue", () => {
    expect(sees("hrOfficer", "/dashboard/attendance/correction-requests")).toBe(true)
    expect(sees("hrOfficer", "/dashboard/employees/profile-update-approvals")).toBe(true)
    expect(sees("hrOfficer", "/dashboard/employees/profile-change-requests")).toBe(true)
  })

  it("does not grant read-only management correction review", () => {
    expect(sees("management", "/dashboard/attendance/correction-requests")).toBe(false)
    expect(sees("management", "/dashboard/employees/profile-update-approvals")).toBe(false)
  })
})
