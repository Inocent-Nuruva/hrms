import { describe, expect, it } from "vitest"
import { onboardingStepProgress } from "./onboarding-step-progress"

describe("onboarding checklist step progress", () => {
  const step = { id: 12, step_type: "task", name: "Equipment" }
  it("groups by workflow_step_id, not task ID or display title", () => {
    expect(onboardingStepProgress(step, [
      { id: 12, workflow_step_id: 99, status: "pending" },
      { id: 501, workflow_step_id: "12", status: "completed" },
      { id: 502, workflow_step_id: 12, status: "completed" },
    ], [])?.status).toBe("completed")
  })
  it("shows partial completion until all checklist items are complete", () => {
    expect(onboardingStepProgress(step, [
      { workflow_step_id: 12, status: "completed" },
      { workflow_step_id: 12, status: "pending" },
    ], [])).toMatchObject({ status: "in_progress", completed_at: null })
  })
  it("does not let obsolete task approval records override completed tasks", () => {
    expect(onboardingStepProgress(step, [{ workflow_step_id: 12, status: "completed" }],
      [{ workflow_step_id: 12, status: "pending" }])?.status).toBe("completed")
  })
  it("uses approval records for sign-off steps", () => {
    expect(onboardingStepProgress({ ...step, step_type: "sign_off" }, [], [
      { workflow_step_id: 12, status: "approved" },
      { workflow_step_id: 12, status: "skipped" },
    ])?.status).toBe("approved")
  })
  it("never borrows the status of an unrelated execution", () => {
    expect(onboardingStepProgress(step, [{ id: 12, workflow_step_id: 99, status: "completed" }], [])).toBeNull()
  })
})
