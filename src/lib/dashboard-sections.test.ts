import { describe, expect, it } from "vitest"

import {
  activitySectionTabGroups,
  attendanceWorkspaceSectionTabGroups,
  employeeSectionTabGroups,
  employeeAttendanceSectionTabGroups,
  findFirstAccessibleSectionUrl,
  resolveAttendanceSectionTabGroups,
} from "@/lib/dashboard-sections"

describe("attendance section selection", () => {
  it("opens attendance operations for HR staff using the employee shell", () => {
    expect(
      resolveAttendanceSectionTabGroups(
        ["attendance_summaries:read"],
        "employee",
        false,
      ),
    ).toBe(attendanceWorkspaceSectionTabGroups)
  })

  it("keeps ordinary employees in My Attendance", () => {
    expect(resolveAttendanceSectionTabGroups([], "employee", false)).toBe(
      employeeAttendanceSectionTabGroups,
    )
  })

  it("preserves the attendance operations workspace for administrators", () => {
    const groups = resolveAttendanceSectionTabGroups([], "admin", true)
    expect(groups).toBe(attendanceWorkspaceSectionTabGroups)
    expect(findFirstAccessibleSectionUrl(groups, [], "admin")).toBe(
      "/dashboard/attendance/today",
    )
  })
})

describe("activity section navigation", () => {
  it("keeps my activities and team activities on one tab row", () => {
    expect(activitySectionTabGroups).toHaveLength(1)
    expect(activitySectionTabGroups[0]?.title).toBeUndefined()
    expect(activitySectionTabGroups[0]?.items.map((item) => item.title)).toEqual([
      "My activities",
      "Team work",
      "Overview",
      "Reports",
      "Reviews",
      "Exceptions",
      "Setup",
    ])
  })
})

describe("employee section navigation", () => {
  it("separates personal employee pages from permission-controlled management", () => {
    expect(employeeSectionTabGroups.map((group) => group.title)).toEqual([
      "My employee workspace",
      "Employee management",
    ])
    expect(employeeSectionTabGroups[0]?.items).toContainEqual({
      title: "Profile",
      url: "/dashboard/me/profile",
    })
    expect(employeeSectionTabGroups[1]?.items).toContainEqual({
      title: "All Employees",
      url: "/dashboard/employees/all",
    })
  })

  it("keeps promotion outside the employee tab groups", () => {
    const urls = employeeSectionTabGroups.flatMap((group) =>
      group.items.map((item) => item.url),
    )
    expect(urls).not.toContain("/dashboard/me/promotion")
  })
})
