import { describe, expect, it } from "vitest"
import { actionReference, defaultInboxFilters, filterAndGroupActions } from "./request-inbox-utils"

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
})
