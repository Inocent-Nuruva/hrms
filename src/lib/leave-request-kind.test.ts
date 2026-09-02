import { describe, expect, it } from "vitest"

import { isMedicalLeaveRequest } from "@/lib/leave-request-kind"

describe("isMedicalLeaveRequest", () => {
  it("does not treat annual leave as medical leave", () => {
    expect(
      isMedicalLeaveRequest({
        leave_type: { code: "ANNUAL", name: "Annual Leave" },
      })
    ).toBe(false)
  })

  it.each([
    { leave_type: { code: "SICK", name: "Sick Leave" } },
    { leave_type: { code: "MEDICAL_LEAVE", name: "Medical Leave" } },
    { leave_type_name: "Illness Leave" },
  ])("detects a medical leave type from the API payload", (row) => {
    expect(isMedicalLeaveRequest(row)).toBe(true)
  })

  it("does not confuse a general attachment requirement with medical leave", () => {
    expect(
      isMedicalLeaveRequest({
        leave_type: {
          code: "STUDY",
          name: "Study Leave",
          requires_attachment: true,
        },
      })
    ).toBe(false)
  })
})
