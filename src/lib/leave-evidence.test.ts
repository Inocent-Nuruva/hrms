import { describe, expect, it } from "vitest"
import { leaveEvidenceMessage, requiresEvidenceBeforeSubmission } from "./leave-evidence"
describe("leave evidence", () => {
  it("retains legacy required-attachment validation", () => {
    expect(requiresEvidenceBeforeSubmission({ requires_attachment: true })).toBe(true)
    expect(requiresEvidenceBeforeSubmission({ requires_attachment: true, allow_deferred_attachment: true })).toBe(false)
    expect(requiresEvidenceBeforeSubmission({ requires_attachment: "true", allow_deferred_attachment: "false" })).toBe(true)
    expect(requiresEvidenceBeforeSubmission({ requires_attachment: false })).toBe(false)
  })
  it("explains routing holds and overdue evidence", () => {
    expect(leaveEvidenceMessage({ routing_required: true })).toContain("Awaiting manager assignment")
    expect(leaveEvidenceMessage({ evidence_status: "overdue", evidence_due_at: "2026-10-19T12:00:00Z" })).toContain("overdue")
    expect(leaveEvidenceMessage({ evidence_status: "received" })).toContain("received")
    expect(leaveEvidenceMessage({ evidence_status: "not_tracked" })).toBe("")
  })
})
