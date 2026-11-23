import { describe, expect, it } from "vitest"

import { canShowKpiNavigationRoute, mergeUniqueNavItems, selfServiceHomeFor } from "./dashboard-nav"
import { canSeeDashboardPage } from "./forbidden-routes"

describe("mixed employee helper navigation", () => {
  it("matches KPI navigation to company role and review authority", () => {
    const see = (url: string, role: string, scope: "company" | "platform" = "company") =>
      canShowKpiNavigationRoute(url, [role], scope)
    for (const role of ["COMPANY_ADMIN", "HR_MANAGER"]) {
      expect(see("/dashboard/kpi", role)).toBe(true)
      expect(see("/dashboard/kpi/reviews", role)).toBe(true)
      expect(see("/dashboard/kpi/evaluations", role)).toBe(true)
      expect(see("/dashboard/kpi/analytics", role)).toBe(true)
      expect(see("/dashboard/kpi/reports", role)).toBe(true)
      expect(see("/dashboard/me/kpi/reports", role)).toBe(false)
      expect(see("/dashboard/me/kpi", role)).toBe(true)
    }
    for (const role of ["DEPARTMENT_MANAGER", "BRANCH_MANAGER"]) {
      expect(see("/dashboard/kpi/scorecards", role)).toBe(true)
      expect(see("/dashboard/kpi/reviews", role)).toBe(true)
      expect(see("/dashboard/kpi/evaluations", role)).toBe(true)
      expect(see("/dashboard/kpi/evaluation-cycles", role)).toBe(false)
    }
    expect(see("/dashboard/kpi/analytics", "MANAGEMENT")).toBe(true)
    expect(see("/dashboard/kpi/reviews", "MANAGEMENT")).toBe(false)
    expect(see("/dashboard/kpi/evaluations", "MANAGEMENT")).toBe(false)
    expect(see("/dashboard/me/evaluations", "MANAGEMENT")).toBe(false)
    expect(see("/dashboard/me/kpi", "EMPLOYEE")).toBe(true)
    expect(see("/dashboard/me/kpi/reports", "EMPLOYEE")).toBe(true)
    expect(see("/dashboard/kpi", "EMPLOYEE")).toBe(false)
    expect(canShowKpiNavigationRoute("/dashboard/kpi", ["TEST"], "company", ["kpi_assignments:read"])).toBe(true)
    expect(canShowKpiNavigationRoute("/dashboard/kpi/assignments", ["TEST"], "company", ["kpi_assignments:read", "kpi_assignments:create"])).toBe(true)
    expect(canShowKpiNavigationRoute("/dashboard/kpi/reviews", ["TEST"], "company", ["kpi_assignments:read"])).toBe(false)
    expect(canShowKpiNavigationRoute("/dashboard/kpi/create", ["TEST"], "company", ["kpi_definitions:create"])).toBe(true)
    expect(canShowKpiNavigationRoute("/dashboard/kpi/create", ["DEPARTMENT_MANAGER"], "company")).toBe(true)
    expect(canShowKpiNavigationRoute("/dashboard/kpi/create", ["BRANCH_MANAGER"], "company")).toBe(true)
    expect(canShowKpiNavigationRoute("/dashboard/kpi/create", ["HR_MANAGER"], "company")).toBe(true)
    expect(see("/dashboard/kpi", "COMPANY_ADMIN", "platform")).toBe(false)
    expect(see("/dashboard/leave-management", "EMPLOYEE")).toBe(true)
  })
  it("keeps personal routes visible to company users in an admin shell", () => {
    const permissions: string[] = []
    const options = { scope: "company" as const }
    expect(canSeeDashboardPage("/dashboard/me/probation", permissions, "admin", options)).toBe(true)
    expect(canSeeDashboardPage("/dashboard/me/leave/requests", permissions, "admin", options)).toBe(true)
  })

  it("does not expose company employee self-service to platform operators", () => {
    expect(
      canSeeDashboardPage("/dashboard/me/profile", [], "admin", {
        scope: "platform",
      }),
    ).toBe(false)
  })

  it("puts My links ahead of granted admin routes and does not drop either", () => {
    const merged = mergeUniqueNavItems(
      [
        { title: "My Leave", url: "/dashboard/me/leave/requests" },
        { title: "My Probation", url: "/dashboard/me/probation" },
      ],
      [
        { title: "Attendance", url: "/dashboard/attendance" },
        { title: "My Leave", url: "/dashboard/me/leave/requests" },
      ],
    )
    expect(merged.map((item) => item.title)).toEqual([
      "My Leave",
      "My Probation",
      "Attendance",
    ])
  })

  it("maps HR modules back to the matching My page instead of the dashboard", () => {
    expect(selfServiceHomeFor("/dashboard/probation/cases")).toBe("/dashboard/me/probation")
    expect(selfServiceHomeFor("/dashboard/leave-management/requests")).toBe(
      "/dashboard/me/leave/requests",
    )
    expect(selfServiceHomeFor("/dashboard/operations/payroll")).toBe("/dashboard/me/finance/payroll")
    expect(selfServiceHomeFor("/dashboard/field/visits")).toBe("/dashboard/me/field/visits")
    expect(selfServiceHomeFor("/dashboard/attendance/policies")).toBe("/dashboard/attendance/attendance-history")
    expect(selfServiceHomeFor("/dashboard/me/insights")).toBe("/dashboard")
  })
})
