import { expect, it } from "vitest"
import { onboardingStepAssignmentPayload } from "./onboarding-step-assignment"

it("serializes clearing a person as null while preserving the department", () => {
  const payload = JSON.parse(JSON.stringify(onboardingStepAssignmentPayload({ assigned_department_id: 7 })))
  expect(payload).toEqual({ assigned_user_id: null, assigned_role_id: null, assigned_department_id: 7 })
})

it("preserves a selected person and removes a previous role fallback", () => {
  expect(onboardingStepAssignmentPayload({ assigned_user_id: 12, assigned_department_id: 7 })).toEqual({
    assigned_user_id: 12, assigned_department_id: 7, assigned_role_id: null,
  })
})
