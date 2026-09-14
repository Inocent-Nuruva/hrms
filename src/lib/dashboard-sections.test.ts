import { describe, expect, it } from "vitest"

import {
  attendanceWorkspaceSectionTabGroups,
  employeeAttendanceSectionTabGroups,
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
    expect(resolveAttendanceSectionTabGroups([], "admin", true)).toBe(
      attendanceWorkspaceSectionTabGroups,
    )
  })
})
