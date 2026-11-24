import { describe, expect, it } from "vitest"
import { canAccessDashboardRoute, DASHBOARD_ROUTE_PERMISSIONS } from "./dashboard-permissions"

describe("employee-only management isolation", () => {
  const employee = ["data_scope:self", "employees:read", "leave_requests:read", "leave_balances:read", "attendance_summaries:read", "attendance_policies:read"]
  it("opens Team attendance only for the grant used by both team APIs", () => {
    const route = "/dashboard/me/team/attendance"
    expect(canAccessDashboardRoute(route, ["team_attendance:read", "data_scope:team"], "employee")).toBe(true)
    expect(canAccessDashboardRoute(route, ["manager:read", "manager_team:read"], "employee")).toBe(false)
  })
  it("blocks management pages while keeping personal pages", () => {
    for (const path of ["/dashboard/employees/all", "/dashboard/leave-management/requests", "/dashboard/leave-management/balances", "/dashboard/attendance/daily-summaries", "/dashboard/attendance/policies"]) {
      expect(canAccessDashboardRoute(path, employee, "employee")).toBe(false)
    }
    expect(canAccessDashboardRoute("/dashboard/me/leave/requests", employee, "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/attendance/attendance-history", employee, "employee")).toBe(true)
  })
  it("retains management access for scoped HR users", () => {
    expect(canAccessDashboardRoute("/dashboard/employees/all", [...employee, "data_scope:company"], "admin")).toBe(true)
  })
})


describe("seeded employee route catalog", () => {
  it("exposes only personal and common routes", () => {
    const permissions = ["data_scope:self", "employees:read", "notifications:read", "notifications:update", "notifications:delete", "holidays:read", "attendance_holiday_groups:read", "attendance_holidays:read", "attendance_policies:read", "leave_types:read", "leave_requests:read", "leave_requests:create", "leave_requests:cancel", "leave_balances:read", "leave_balances:read-own", "attendance_summaries:read", "attendance_mobile_punches:create", "shift_change_requests:read", "shift_change_requests:create", "onboarding_requests:read", "employment_contracts:self", "onboarding_requests:update", "onboarding_tasks:read", "onboarding_tasks:complete", "onboarding_documents:read", "onboarding_documents:create", "offboarding_workflows:read", "offboarding_requests:read", "offboarding_requests:create", "offboarding_requests:update", "offboarding_requests:submit", "offboarding_requests:cancel", "work_activities:self-service-read", "work_activities:self-service-update", "field_visits:self-service-read", "field_visits:self-service-update", "employee_finance:applications-self", "payroll:payslips-self"]
    const common = new Set(["/dashboard/forms-feedback", "/dashboard/attendance", "/dashboard/attendance/today", "/dashboard/attendance/punch-action", "/dashboard/attendance/attendance-history", "/dashboard/attendance/schedule-preview", "/dashboard/attendance/corrections", "/dashboard/attendance/work-from-home-requests", "/dashboard/operations/reports", "/dashboard/help", "/dashboard/settings"])
    const visible = Object.keys(DASHBOARD_ROUTE_PERMISSIONS).filter((route) => canAccessDashboardRoute(route, permissions, "employee"))
    expect(visible.filter((route) => !route.startsWith("/dashboard/me/") && !common.has(route))).toEqual([])
    expect(canAccessDashboardRoute("/dashboard/operations/reports", permissions, "employee")).toBe(true)
    expect(canAccessDashboardRoute("/dashboard/operations/payroll", permissions, "employee")).toBe(false)
    expect(canAccessDashboardRoute("/dashboard/me/team/members", permissions, "employee")).toBe(false)
  })
})
