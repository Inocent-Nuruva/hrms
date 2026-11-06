import { describe, expect, it } from "vitest"

import { buildDocumentUpdate } from "./onboarding-document-edit-dialog"
import { buildTaskReassignment } from "./onboarding-task-reassign-dialog"

describe("task reassignment payload", () => {
  const current = { title: "Laptop", assignedUserId: 7, assignedDepartmentId: 3, dueDate: "2026-11-10" }

  it("sends only the fields that changed", () => {
    expect(buildTaskReassignment(current, { userId: "9", departmentId: "3", dueDate: "2026-11-10" })).toEqual({
      assigned_company_user_id: 9,
    })
    expect(buildTaskReassignment(current, { userId: "7", departmentId: "4", dueDate: "2026-11-12" })).toEqual({
      assigned_department_id: 4,
      due_date: "2026-11-12",
    })
  })

  it("is empty when nothing changed or a selection was cleared", () => {
    expect(buildTaskReassignment(current, { userId: "7", departmentId: "3", dueDate: "2026-11-10" })).toEqual({})
    expect(buildTaskReassignment(current, { userId: "", departmentId: "", dueDate: "" })).toEqual({})
  })
})

describe("document update payload", () => {
  const current = { title: "Passport", description: "Bio page", expiryDate: "2030-01-01" }

  it("trims and sends changed fields", () => {
    expect(buildDocumentUpdate(current, { ...current, title: "  Passport copy " })).toEqual({ title: "Passport copy" })
  })

  it("clears description and expiry when emptied", () => {
    expect(buildDocumentUpdate(current, { ...current, description: " ", expiryDate: "" })).toEqual({
      description: null,
      expiry_date: null,
    })
  })

  it("never sends an empty title", () => {
    expect(buildDocumentUpdate(current, { ...current, title: "" })).toEqual({})
  })
})
