// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { Tabs2 } from "./tabs-2"
import { employeeSectionTabGroups, managementKpiSectionTabGroups } from "@/lib/dashboard-sections"

const push = vi.hoisted(() => vi.fn())
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/hooks/use-notification-attention", () => ({ useNotificationAttentionRoutes: () => [] }))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
describe("employee workspace navigation", () => {
  it("makes joining reachable from the directory and keeps joining tabs together", async () => {
    await act(async () => root.render(<Tabs2 groups={employeeSectionTabGroups} currentPath="/dashboard/employees/all" showGroupNavigation />))
    const joining = [...container.querySelectorAll('[role="tablist"][aria-label="Workspace areas"] [role="tab"]')].find((button) => button.textContent?.includes("Joining & onboarding")) as HTMLButtonElement
    expect(joining).toBeDefined()
    expect(joining.getAttribute("aria-selected")).toBe("false")
    await act(async () => joining.click())
    expect(push).toHaveBeenCalledWith("/dashboard/employees/invite")
    await act(async () => root.render(<Tabs2 groups={employeeSectionTabGroups} currentPath="/dashboard/employees/invite" showGroupNavigation />))
    expect(joining.getAttribute("aria-selected")).toBe("true")
    const tabs = [...container.querySelectorAll('[role="tablist"][aria-label="Section pages"] [role="tab"]')]
    expect(tabs).toHaveLength(6)
    for (const [index, label] of ["Invite", "Registration", "Onboarding", "Contracts", "Salary approvals", "Recruitment"].entries()) {
      expect(tabs[index].textContent).toContain(label)
    }
    await act(async () => (tabs[3] as HTMLButtonElement).click())
    expect(push).toHaveBeenCalledWith("/dashboard/employees/contracts")
  })
})

describe("KPI workspace navigation", () => {
  it("shows the active task group despite the KPI Library parent route", async () => {
    await act(async () => root.render(<Tabs2 groups={managementKpiSectionTabGroups} currentPath="/dashboard/kpi/assignments" showGroupNavigation />))
    const group = [...container.querySelectorAll('[role="tablist"][aria-label="Workspace areas"] [role="tab"]')].find((button) => button.textContent === "Assign & review")
    expect(group?.getAttribute("aria-selected")).toBe("true")
    const tabs = [...container.querySelectorAll('[role="tablist"][aria-label="Section pages"] [role="tab"]')]
    expect(tabs).toHaveLength(3)
    for (const [index, label] of ["Assignments", "Scorecards", "Achievement Reviews"].entries()) {
      expect(tabs[index].textContent).toContain(label)
    }
  })

  it("opens Insights without a redundant Analytics subtab", async () => {
    await act(async () => root.render(<Tabs2 groups={managementKpiSectionTabGroups} currentPath="/dashboard/kpi/analytics" showGroupNavigation />))
    const insights = [...container.querySelectorAll('[role="tablist"][aria-label="Workspace areas"] [role="tab"]')].find((button) => button.textContent === "Insights") as HTMLButtonElement
    expect(insights.getAttribute("aria-selected")).toBe("true")
    expect(container.querySelector('[role="tablist"][aria-label="Section pages"]')).toBeNull()
    await act(async () => insights.click())
    expect(push).toHaveBeenCalledWith("/dashboard/kpi/analytics")
  })
})
