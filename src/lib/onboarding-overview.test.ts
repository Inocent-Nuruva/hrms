import { describe, expect, it } from "vitest"
import type { OnboardingOverviewRow } from "./admin-api"
import { emptyOnboardingOverviewFilters, filterOnboardingOverview, groupOnboardingOverview } from "./onboarding-overview"

const rows = [
  { id: 1, employee_name: "Amina Ali", employee_no: "EMP-1", onboarding_no: "ONB-1", stage: "Checklist & documents", department: "Finance", overdue: true, owners: ["IT", "Payroll"], blockers: [{ label: "Laptop", group: "Checklist & documents" }, { label: "TIN", group: "Employment & payroll" }] },
  { id: 2, employee_name: "Neema David", employee_no: "EMP-2", onboarding_no: "ONB-2", stage: "Ready for activation", department: "Sales", overdue: false, owners: [], blockers: [] },
] as OnboardingOverviewRow[]

describe("onboarding overview filters", () => {
  it("filters attention flags without hiding older responses that omit the field", () => {
    const flagged = { ...rows[0], attention_reasons: ["Start date passed with blockers"] }
    expect(filterOnboardingOverview([flagged, rows[1]], { ...emptyOnboardingOverviewFilters, attention: "any" })).toEqual([flagged])
    expect(filterOnboardingOverview([flagged, rows[1]], { ...emptyOnboardingOverviewFilters, attention: "Start date passed with blockers" })).toEqual([flagged])
    expect(filterOnboardingOverview(rows, emptyOnboardingOverviewFilters)).toEqual(rows)
  })
  it("combines search, department, owner, stage, blocker and overdue filters", () => {
    expect(filterOnboardingOverview(rows, { search: "amina", stage: "Checklist & documents", department: "Finance", owner: "Payroll", blocker: "Employment & payroll", overdue: "overdue" }).map((row) => row.id)).toEqual([1])
  })
  it("finds a blocker even if it is not the primary stage", () => {
    expect(filterOnboardingOverview(rows, { ...emptyOnboardingOverviewFilters, blocker: "Employment & payroll" })).toEqual([rows[0]])
  })
  it("matches employee numbers, request numbers and blocker labels case-insensitively", () => {
    for (const search of [" EMP-1 ", "onb-1", "laptop"]) expect(filterOnboardingOverview(rows, { ...emptyOnboardingOverviewFilters, search })).toEqual([rows[0]])
  })
  it("filters ready and non-overdue requests and supports an empty result", () => {
    expect(filterOnboardingOverview(rows, { ...emptyOnboardingOverviewFilters, overdue: "not_overdue" })).toEqual([rows[1]])
    expect(filterOnboardingOverview(rows, { ...emptyOnboardingOverviewFilters, owner: "Unknown" })).toEqual([])
  })
  it("puts activation-ready employees first without losing blocked employees", () => {
    expect(groupOnboardingOverview(rows).map(([stage]) => stage)).toEqual(["Ready for activation", "Checklist & documents"])
  })
})
