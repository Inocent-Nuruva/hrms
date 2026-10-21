import { describe, expect, it } from "vitest"

import {
  activitySectionTabGroups,
  attendanceWorkspaceSectionTabGroups,
  employeeSectionTabGroups,
  employeeAttendanceSectionTabGroups,
  findFirstAccessibleSectionUrl,
  notificationSectionTabGroups,
  operationsReportSectionTabGroups,
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
      "/dashboard/attendance/attendance-history",
    )
  })

  it("keeps correction requests out of Attendance navigation", () => {
    const urls = attendanceWorkspaceSectionTabGroups.flatMap((group) =>
      group.items.map((item) => item.url),
    )
    expect(urls).not.toContain("/dashboard/attendance/correction-requests")
    expect(urls).not.toContain("/dashboard/attendance/corrections")
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

describe("operations report navigation", () => {
  it("lists report pages together and respects route permissions for the first accessible page", () => {
    expect(operationsReportSectionTabGroups[0]?.items.map((item) => item.title)).toEqual([
      "Reports & Analytics",
      "Scheduled Reporting",
    ])
    expect(
      findFirstAccessibleSectionUrl(
        operationsReportSectionTabGroups,
        ["scheduled_reports:read"],
        "admin",
      ),
    ).toBe("/dashboard/operations/scheduled-reporting")
    expect(
      findFirstAccessibleSectionUrl(
        operationsReportSectionTabGroups,
        ["scheduled_reports:manage_smtp"],
        "admin",
      ),
    ).toBe("/dashboard/operations/scheduled-reporting")
  })
})

describe("notification navigation", () => {
  it("groups the inbox and delivery configuration together", () => {
    expect(notificationSectionTabGroups[0]?.items).toEqual([
      { title: "Current notifications", url: "/dashboard/operations/notifications" },
      { title: "Mail / SMTP configuration", url: "/dashboard/smtp" },
      { title: "SMS configuration", url: "/dashboard/sms" },
    ])
  })
})

describe("employee section navigation", () => {
  it("separates personal employee pages from permission-controlled management", () => {
    expect(employeeSectionTabGroups.map((group) => group.title)).toEqual([
      "My employee workspace",
      "Employee management",
      "Joining & onboarding",
    ])
    expect(employeeSectionTabGroups[0]?.items).toContainEqual({
      title: "Profile",
      url: "/dashboard/me/profile",
    })
    expect(employeeSectionTabGroups[1]?.items).toContainEqual({
      title: "All Employees",
      url: "/dashboard/employees/all",
    })
    expect(employeeSectionTabGroups[2]?.items).toEqual([
      { title: "Invite", url: "/dashboard/employees/invite" },
      { title: "Registration", url: "/dashboard/employees/registration" },
      { title: "Onboarding", url: "/dashboard/employees/onboarding" },
      { title: "Contracts", url: "/dashboard/employees/contracts" },
    ])
  })

  it("keeps promotion outside the employee tab groups", () => {
    const urls = employeeSectionTabGroups.flatMap((group) =>
      group.items.map((item) => item.url),
    )
    expect(urls).not.toContain("/dashboard/me/promotion")
  })
})
