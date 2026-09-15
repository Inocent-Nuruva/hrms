import { describe, expect, it } from "vitest"

import {
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

describe("employee section navigation", () => {
  it("keeps promotion outside the employee tab groups", () => {
    const urls = employeeSectionTabGroups.flatMap((group) =>
      group.items.map((item) => item.url),
    )
    expect(urls).not.toContain("/dashboard/me/promotion")
  })
})
