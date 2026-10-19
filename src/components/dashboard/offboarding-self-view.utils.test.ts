import { describe, expect, it } from "vitest"
import { resolveOffboardingProgressStage } from "./offboarding-self-view.utils"

describe("resolveOffboardingProgressStage", () => {
  it.each([
    ["draft", "DRAFT"],
    ["pending_manager", "IN_PROGRESS"],
    ["waiting_approval", "IN_PROGRESS"],
    ["rejected", "PENDING_MANAGER"],
    ["in_progress", "IN_PROGRESS"],
    ["termination_scheduled", "READY_FOR_TERMINATION"],
    ["ready_for_finalization", "READY_FOR_TERMINATION"],
    ["completed", "COMPLETED"],
    ["cancelled", "DRAFT"],
  ])("maps %s to the matching employee progress stage", (status, expected) => {
    expect(resolveOffboardingProgressStage(status)).toBe(expected)
  })
})
