import { describe, expect, it } from "vitest"
import { actionReference, defaultInboxFilters, filterAndGroupActions, groupsForInboxTab } from "./request-inbox-utils"

const actions = [
  { id: 1, sourceModule: "onboarding", actionType: "TASK", status: "OPEN", priority: "HIGH", title: "Provide laptop", dueAt: "2026-10-19T09:00:00Z", subject_employee: { id: 10, name: "Amina John", employee_no: "EMP-10", department: "Finance" } },
  { id: 2, sourceModule: "onboarding", actionType: "TASK", status: "OPEN", title: "Create email", subject_employee: { id: 10, name: "Amina John" } },
  { id: 3, sourceModule: "leave", actionType: "APPROVAL", status: "COMPLETED", title: "Leave approval", subject_employee: { id: 20, name: "Amina John", employee_no: "EMP-20" } },
]

describe("request inbox grouping and filters", () => {
  it("groups the same employee across items without merging namesakes", () => {
    const groups = filterAndGroupActions(actions, { ...defaultInboxFilters, status: "all" })
    expect(groups).toHaveLength(2)
    expect(groups[0].items.map((row) => row.id)).toEqual([1, 2])
    expect(groups[1].items.map((row) => row.id)).toEqual([3])
  })
  it("keeps completed requests beside the open ones for the same person on Pending", () => {
    const groups = groupsForInboxTab([
      ...actions,
      { id: 11, sourceModule: "onboarding", actionType: "TASK", status: "COMPLETED", title: "Collect ID", subject_employee: { id: 10, name: "Amina John" } },
      { id: 12, sourceModule: "onboarding", actionType: "TASK", status: "IN_PROGRESS", title: "Issue badge", subject_employee: { id: 10, name: "Amina John" } },
    ], defaultInboxFilters)
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((row) => row.id)).toEqual([1, 2, 11, 12])
  })
  it("combines search, priority, module, action and overdue filters", () => {
    const groups = filterAndGroupActions(actions, { ...defaultInboxFilters, search: "EMP-10", module: "onboarding", priority: "HIGH", kind: "TASK", due: "overdue" }, new Date("2026-10-20T10:00:00Z"))
    expect(groups.flatMap((group) => group.items).map((row) => row.id)).toEqual([1])
  })
  it("does not classify cancelled requests as completed", () => {
    const groups = filterAndGroupActions([...actions, { id: 4, status: "CANCELLED" }], { ...defaultInboxFilters, status: "completed" })
    expect(groups.flatMap((group) => group.items).map((row) => row.id)).toEqual([3])
  })
  it("does not merge unidentified people and resolves checklist request ids", () => {
    expect(filterAndGroupActions([{ id: 5 }, { id: 6 }], defaultInboxFilters)).toHaveLength(2)
    expect(actionReference({ sourceEntityType: "ONBOARDING_TASK", sourceEntityId: 9, metadata: { onboarding_request_id: 7 } })).toEqual({ type: "ONBOARDING_TASK", id: "9", requestId: "7" })
  })
  it("hides legacy missing-report escalation items", () => {
    const groups = filterAndGroupActions([
      { id: 7, status: "OPEN", sourceKey: "daily-activity:missing-escalation:manager:10:2026-10-20" },
      { id: 8, status: "OPEN", sourceKey: "daily-activity:missing:10:2026-10-20" },
    ], defaultInboxFilters)
    expect(groups.flatMap((group) => group.items).map((row) => row.id)).toEqual([8])
  })
  it("keeps daily activity reports out of employee requests", () => {
    const groups = filterAndGroupActions([
      { id: 9, status: "OPEN", sourceEntityType: "DAILY_ACTIVITY_REPORT", title: "Submit daily activity report" },
      { id: 10, status: "OPEN", sourceEntityType: "ONBOARDING_TASK", title: "Provide laptop" },
    ], defaultInboxFilters)
    expect(groups.flatMap((group) => group.items).map((row) => row.id)).toEqual([10])
  })
})
