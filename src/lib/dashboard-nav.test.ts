import { describe, expect, it } from "vitest"

import { mergeUniqueNavItems, selfServiceHomeFor } from "./dashboard-nav"
import { canSeeDashboardPage } from "./forbidden-routes"

describe("mixed employee helper navigation", () => {
  it("keeps self-service links when a helper also has an HR grant", () => {
    const permissions = ["performance:read", "performance_reviews:read"]
    expect(canSeeDashboardPage("/dashboard/me/performance/overview", permissions, "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/me/probation", permissions, "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/me/leave/requests", permissions, "admin")).toBe(true)
    expect(canSeeDashboardPage("/dashboard/performance/overview", permissions, "admin")).toBe(true)
  })

  it("puts My links ahead of granted admin routes and does not drop either", () => {
    const merged = mergeUniqueNavItems(
      [
        { title: "My Performance", url: "/dashboard/me/performance/overview" },
        { title: "My Probation", url: "/dashboard/me/probation" },
      ],
      [
        { title: "Performance", url: "/dashboard/performance" },
        { title: "My Performance", url: "/dashboard/me/performance/overview" },
      ],
    )
    expect(merged.map((item) => item.title)).toEqual([
      "My Performance",
      "My Probation",
      "Performance",
    ])
  })

  it("maps HR modules back to the matching My page instead of the dashboard", () => {
    expect(selfServiceHomeFor("/dashboard/probation/cases")).toBe("/dashboard/me/probation")
    expect(selfServiceHomeFor("/dashboard/leave-management/requests")).toBe(
      "/dashboard/me/leave/requests",
    )
    expect(selfServiceHomeFor("/dashboard/operations/payroll")).toBe("/dashboard/me/payroll")
    expect(selfServiceHomeFor("/dashboard/field/visits")).toBe("/dashboard/me/field/visits")
    expect(selfServiceHomeFor("/dashboard/attendance/policies")).toBe("/dashboard/attendance/today")
  })
})
