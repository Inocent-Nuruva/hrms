import { describe, expect, it } from "vitest"
import { resignationStage } from "./resignation-progress"

describe("resignation timeline", () => {
  it.each(["pending", "pending_manager", "waiting_approval"])("keeps %s in review", (status) => {
    expect(resignationStage(status)).toBe(1)
  })
  it.each(["in_progress", "approved", "ready_for_termination", "termination_scheduled", "terminating_access", "access_termination_failed", "ready_for_finalization"])("does not treat %s as completed", (status) => {
    expect(resignationStage(status)).toBe(2)
  })
  it.each(["rejected", "cancelled"])("does not complete offboarding for %s", (status) => {
    expect(resignationStage(status)).toBeLessThan(2)
  })
  it("only completes the timeline for a finalized request", () => {
    expect(resignationStage("completed")).toBe(3)
    expect(resignationStage("")).toBe(0)
    expect(resignationStage("draft")).toBe(0)
    expect(resignationStage("unknown")).toBe(0)
  })
})
