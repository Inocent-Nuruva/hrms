import { describe, expect, it } from "vitest"
import { onboardingActionMessage } from "./onboarding-action-feedback"

describe("onboarding action feedback", () => {
  it("preserves the saved action message when activation needs review", () => {
    expect(onboardingActionMessage({ activation: { status: "failed", message: "HR should refresh readiness." } }, "Task completed.")).toBe("Task completed. HR should refresh readiness.")
  })
  it("reports successful activation", () => {
    expect(onboardingActionMessage({ activation: { status: "completed", message: "Employee activated." } }, "Approved.")).toBe("Approved. Employee activated.")
  })
  it.each([null, undefined, {}, { activation: null }, { activation: { message: 42 } }])("supports older responses: %o", (response) => {
    expect(onboardingActionMessage(response, "Saved.")).toBe("Saved.")
  })
})
