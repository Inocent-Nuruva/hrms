import type { OnboardingOverviewRow } from "@/lib/admin-api"

export type OnboardingOverviewFilters = {
  search: string
  stage: string
  department: string
  owner: string
  blocker: string
  overdue: string
}

export const emptyOnboardingOverviewFilters: OnboardingOverviewFilters = {
  search: "", stage: "", department: "", owner: "", blocker: "", overdue: "",
}

export function filterOnboardingOverview(rows: OnboardingOverviewRow[], filters: OnboardingOverviewFilters) {
  const search = filters.search.trim().toLowerCase()
  return rows.filter((row) =>
    (!search || [row.employee_name, row.employee_no, row.onboarding_no, ...row.blockers.map((item) => item.label)].join(" ").toLowerCase().includes(search)) &&
    (!filters.stage || row.stage === filters.stage) &&
    (!filters.department || row.department === filters.department) &&
    (!filters.owner || row.owners.includes(filters.owner)) &&
    (!filters.blocker || row.blockers.some((item) => item.group === filters.blocker)) &&
    (!filters.overdue || (filters.overdue === "overdue" ? row.overdue : !row.overdue)),
  )
}

export function groupOnboardingOverview(rows: OnboardingOverviewRow[]) {
  const groups = new Map<string, OnboardingOverviewRow[]>()
  for (const row of rows) groups.set(row.stage, [...(groups.get(row.stage) ?? []), row])
  return [...groups].sort(([first], [second]) =>
    first === "Ready for activation" ? -1 : second === "Ready for activation" ? 1 : first.localeCompare(second),
  )
}
