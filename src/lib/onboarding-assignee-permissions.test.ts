import { describe, expect, it } from "vitest"

import {
  onboardingAssigneeHasPermission,
  onboardingAssigneePermissionNames,
  requiredPermissionForOnboardingStep,
} from "@/lib/onboarding-assignee-permissions"

describe("onboarding assignee permissions", () => {
  it("requires approval permission for sign-off steps", () => {
    expect(requiredPermissionForOnboardingStep("sign_off")).toBe("onboarding_requests:approve")
  })

  it("requires task completion permission for task steps", () => {
    expect(requiredPermissionForOnboardingStep("task")).toBe("onboarding_tasks:complete")
  })

  it("reads direct and role permissions from a company user", () => {
    const user = {
      permission_names: ["employees:read"],
      direct_permissions: [{ name: "onboarding_tasks:complete" }],
      roles: [{ name: "HR", permissions: [{ name: "onboarding_requests:approve" }] }],
    }

    expect(onboardingAssigneePermissionNames(user)).toEqual(
      expect.arrayContaining([
        "employees:read",
        "onboarding_tasks:complete",
        "onboarding_requests:approve",
      ]),
    )
    expect(onboardingAssigneeHasPermission(user, "task")).toBe(true)
    expect(onboardingAssigneeHasPermission(user, "sign_off")).toBe(true)
  })

  it("rejects an assignee who lacks the permission required by the step", () => {
    expect(
      onboardingAssigneeHasPermission(
        { permission_names: ["onboarding_tasks:complete"] },
        "sign_off",
      ),
    ).toBe(false)
  })
})
