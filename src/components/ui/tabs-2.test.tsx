// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { Tabs2 } from "./tabs-2"
import { employeeSectionTabGroups } from "@/lib/dashboard-sections"

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
    const joining = [...container.querySelectorAll("nav button")].find((button) => button.textContent === "Joining & onboarding") as HTMLButtonElement
    expect(joining).toBeDefined()
    expect(joining.hasAttribute("data-hrms-button-tone")).toBe(false)
    await act(async () => joining.click())
    expect(push).toHaveBeenCalledWith("/dashboard/employees/invite")
    await act(async () => root.render(<Tabs2 groups={employeeSectionTabGroups} currentPath="/dashboard/employees/invite" showGroupNavigation />))
    expect(joining.getAttribute("data-hrms-button-tone")).toBe("brand")
    const tabs = [...container.querySelectorAll('[role="tab"]')]
    expect(tabs).toHaveLength(6)
    for (const [index, label] of ["Invite", "Registration", "Onboarding", "Contracts", "Salary approvals", "Recruitment"].entries()) {
      expect(tabs[index].textContent).toContain(label)
    }
    await act(async () => (tabs[3] as HTMLButtonElement).click())
    expect(push).toHaveBeenCalledWith("/dashboard/employees/contracts")
  })
})
