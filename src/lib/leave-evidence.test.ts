import { describe, expect, it } from "vitest"
import { evidenceRuleText, leaveEvidenceMessage, requiresEvidenceBeforeSubmission } from "./leave-evidence"
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

describe("attachment day threshold", () => {
  it("leaves the decision to the server when a threshold is set", () => {
    expect(requiresEvidenceBeforeSubmission({ requires_attachment: true, attachment_required_after_days: 2 })).toBe(false)
    expect(requiresEvidenceBeforeSubmission({ requires_attachment: true, attachment_required_after_days: null })).toBe(true)
  })
  it("describes the rule", () => {
    expect(evidenceRuleText({ requires_attachment: false })).toBe("Optional")
    expect(evidenceRuleText({ requires_attachment: true, attachment_required_after_days: "2.0" })).toBe("Required before submission for requests longer than 2 day(s)")
  })
})
