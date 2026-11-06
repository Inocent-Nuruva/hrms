export const ONBOARDING_WORKSPACE_TABS = [
  "overview",
  "details",
  "payroll",
  "tasks",
  "activity",
] as const

export type OnboardingWorkspaceTab = (typeof ONBOARDING_WORKSPACE_TABS)[number]

// Older links and other modules used descriptive names for the same tabs.
const TAB_ALIASES: Record<string, OnboardingWorkspaceTab> = {
  "employee-details": "details",
  employee_details: "details",
  review: "details",
  checklist: "tasks",
  documents: "tasks",
  audit: "activity",
  history: "activity",
}

export function normalizeOnboardingWorkspaceTab(
  value: string | null | undefined,
): OnboardingWorkspaceTab {
  const key = (value ?? "").trim().toLowerCase()
  if ((ONBOARDING_WORKSPACE_TABS as readonly string[]).includes(key)) {
    return key as OnboardingWorkspaceTab
  }
  return TAB_ALIASES[key] ?? "overview"
}

/** Link to one onboarding request in the HR workspace. */
export function onboardingRequestHref(
  requestId: string | number,
  workspaceTab?: OnboardingWorkspaceTab,
) {
  const params = new URLSearchParams({
    tab: "requests",
    request_id: String(requestId),
  })
  if (workspaceTab) params.set("workspace_tab", workspaceTab)
  return `/dashboard/employees/onboarding?${params.toString()}`
}
