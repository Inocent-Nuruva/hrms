import { describe, expect, it } from "vitest"
import {
  normalizeOnboardingWorkspaceTab,
  onboardingRequestHref,
} from "./onboarding-workspace-link"

describe("onboarding workspace links", () => {
  it("keeps known tabs and maps legacy aliases", () => {
    expect(normalizeOnboardingWorkspaceTab("payroll")).toBe("payroll")
    expect(normalizeOnboardingWorkspaceTab("employee-details")).toBe("details")
    expect(normalizeOnboardingWorkspaceTab("unknown")).toBe("overview")
    expect(normalizeOnboardingWorkspaceTab(null)).toBe("overview")
  })

  it("builds a link the onboarding view opens on the requested tab", () => {
    const href = onboardingRequestHref(42, "details")
    const url = new URL(href, "http://localhost")
    expect(url.pathname).toBe("/dashboard/employees/onboarding")
    expect(url.searchParams.get("tab")).toBe("requests")
    expect(url.searchParams.get("request_id")).toBe("42")
    expect(normalizeOnboardingWorkspaceTab(url.searchParams.get("workspace_tab"))).toBe("details")
  })
})
