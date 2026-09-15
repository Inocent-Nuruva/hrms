import { describe, expect, it } from "vitest"

import {
  addIsoDays,
  canCloseReport,
  closeReportIssues,
  defaultCloseEntryIds,
  isManagerAssignedActivity,
  isTeamAssignedActivity,
  isoDate,
  localIsoDate,
  partitionActivityTasks,
  pastActivityReports,
  plannedDueDateOf,
  plannedStartDateOf,
  policyLimits,
  reportDateOf,
  reportForDate,
} from "./activity-day"

const monday = "2026-09-14"
const tuesday = "2026-09-15"
const friday = "2026-09-18"

describe("activity day grouping", () => {
  it("reads a report date from either casing and ignores the time", () => {
    expect(reportDateOf({ activityDate: "2026-09-15T08:00:00.000Z" })).toBe(tuesday)
    expect(reportDateOf({ activity_date: "2026-09-15" })).toBe(tuesday)
    expect(isoDate("not-a-date")).toBe("")
  })

  it("keeps only the selected day's work on Today and future-dated work in Upcoming", () => {
    const { today, upcoming } = partitionActivityTasks(
      [
        { id: 1, title: "Today item", activity_date: tuesday },
        { id: 2, title: "Friday item", activityDate: friday },
        { id: 3, title: "Yesterday item", activity_date: monday },
        { id: 4, title: "Undated item" },
      ],
      tuesday,
    )

    expect(today.map((row) => row.id)).toEqual([1, 4])
    expect(upcoming.map((row) => row.id)).toEqual([2])
  })

  it("lists only past reports in history, newest first", () => {
    const history = pastActivityReports(
      [
        { id: 10, activity_date: tuesday, status: "DRAFT" },
        { id: 11, activity_date: monday, status: "DRAFT" },
        { id: 12, activityDate: "2026-09-13", status: "SUBMITTED" },
        { id: 13, activity_date: friday, status: "DRAFT" },
      ],
      tuesday,
    )

    expect(history.map((row) => row.id)).toEqual([11, 12])
  })

  it("closes only the report for the on-screen date, never another draft", () => {
    const reports = [
      { id: 20, activity_date: monday, status: "DRAFT" },
      { id: 21, activity_date: tuesday, status: "DRAFT" },
    ]

    expect(reportForDate(reports, tuesday)).toEqual(expect.objectContaining({ id: 21 }))
    expect(reportForDate(reports, "2026-09-16")).toBeNull()
    expect(canCloseReport(reports[1])).toBe(true)
    expect(canCloseReport({ status: "SUBMITTED" })).toBe(false)
  })

  it("requires a real summary and the policy minimums before close-out", () => {
    const report = {
      activity_date: tuesday,
      status: "DRAFT",
      policySnapshot: {
        minimum_activity_count: 2,
        minimum_completed_activity_count: 1,
      },
    }

    expect(
      closeReportIssues({
        report,
        day: tuesday,
        entryCount: 2,
        completedCount: 1,
        summary: "Visited two branches and filed the attendance pack.",
      }),
    ).toEqual([])

    expect(
      closeReportIssues({
        report,
        day: tuesday,
        entryCount: 1,
        completedCount: 0,
        summary: "   ",
      }),
    ).toEqual([
      "Add at least 2 work items before closing this day.",
      "Mark at least 1 item complete before closing this day.",
      "Write a short summary of the day for your manager.",
    ])

    expect(
      closeReportIssues({
        report: reportsFallback(monday),
        day: tuesday,
        entryCount: 2,
        completedCount: 2,
        summary: "Done",
      }),
    ).toContain("This close-out is for a different date than the report.")
  })

  it("labels self-created work as mine even when assignedBy is the same employee", () => {
    expect(
      isManagerAssignedActivity({
        task_reference: "SELF_CREATED",
        assignedByEmployeeId: 44,
        employee_id: 44,
      }),
    ).toBe(false)
    expect(
      isManagerAssignedActivity({
        external_reference_type: "MANAGER_TASK",
        assigned_by_employee_id: 12,
        employeeId: 44,
      }),
    ).toBe(true)
    expect(
      isManagerAssignedActivity({
        assignedByEmployeeId: 44,
        employee_id: 44,
      }),
    ).toBe(false)
    expect(
      isManagerAssignedActivity({
        assignedByEmployeeId: 44,
      }),
    ).toBe(false)
    expect(
      isManagerAssignedActivity(
        {
          external_reference_type: "MANAGER_TASK",
          assignedByEmployeeId: 44,
        },
        44,
      ),
    ).toBe(false)
    expect(
      isManagerAssignedActivity(
        {
          assignedByEmployeeId: 12,
        },
        44,
      ),
    ).toBe(true)
  })

  it("does not treat the report day as a due date", () => {
    expect(plannedDueDateOf({ activity_date: tuesday, planned_end_time: "2026-09-18T17:00:00.000Z" })).toBe(friday)
    expect(plannedDueDateOf({ activityDate: tuesday })).toBe("")
  })

  it("keeps team work limited to manager-assigned tasks", () => {
    expect(
      isTeamAssignedActivity({
        task_reference: "MANAGER_ASSIGNED",
        assignedByEmployeeId: 12,
        employee_id: 44,
      }),
    ).toBe(true)
    expect(
      isTeamAssignedActivity({
        task_reference: "SELF_CREATED",
        assignedByEmployeeId: 44,
        employee_id: 44,
      }),
    ).toBe(false)
  })

  it("selects only completed work for close-out by default", () => {
    expect(
      defaultCloseEntryIds([
        { id: 1, status: "COMPLETED" },
        { id: 2, status: "IN_PROGRESS" },
        { id: 3, status: "PLANNED" },
        { id: 4, status: "COMPLETED" },
      ]),
    ).toEqual(["1", "4"])
  })

  it("uses the planned start time and falls back to the report day so start is never blank", () => {
    expect(plannedStartDateOf({ planned_start_time: "2026-09-15T09:00:00.000Z", activity_date: monday })).toBe(tuesday)
    expect(plannedStartDateOf({ activity_date: friday })).toBe(friday)
    expect(plannedStartDateOf({})).toBe("")
  })

  it("reads policy limits from a snapshot and keeps a local calendar day", () => {
    expect(policyLimits({ policy_snapshot: { minimumActivityCount: 3 } }).minItems).toBe(3)
    expect(localIsoDate(new Date(2026, 8, 15, 23, 30))).toBe(tuesday)
    expect(addIsoDays(tuesday, 1)).toBe("2026-09-16")
  })
})

function reportsFallback(day: string) {
  return { activity_date: day, status: "DRAFT" }
}
