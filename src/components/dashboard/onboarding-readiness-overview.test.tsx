// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { OnboardingReadinessOverview } from "./onboarding-readiness-overview"

const getReadiness = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin-api", () => ({ getOnboardingReadiness: getReadiness }))
let root: Root
let container: HTMLDivElement
const activate = vi.fn()
const navigate = vi.fn()
const data = {
  employee_id: 2, employee_status: "onboarding", request_status: "in_progress",
  ready_to_activate: false, closed: false, blocker_count: 1,
  completed_required: 1, total_required: 2,
  next_action: { label: "Signed contract", owner: "HR / Employee" },
  requirements: [
    { id: "contract", label: "Signed contract", group: "Contract", owner: "HR / Employee", required: true, status: "pending", action: "contracts" },
    { id: "laptop", label: "Provide laptop", group: "Checklist", owner: "IT", required: true, status: "complete", action: "tasks" },
  ],
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })))
  getReadiness.mockResolvedValue(data)
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
async function render(canActivate = true, canViewPayroll = false, canViewContracts = true) {
  await act(async () => root.render(<OnboardingReadinessOverview token="token" requestId={1} employeeName="Amina" canActivate={canActivate} canViewPayroll={canViewPayroll} canViewContracts={canViewContracts} saving={false} onActivate={activate} onNavigate={navigate} />))
}
function button(label: string) {
  return [...document.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === label)!
}
function labelledButton(label: string) {
  return [...document.querySelectorAll("button")].find((entry) => entry.getAttribute("aria-label") === label)!
}
describe("onboarding activation overview", () => {
  it("shows blockers and prevents activation until ready", async () => {
    await render()
    expect(container.textContent).toContain("1 activation requirements outstanding")
    expect(container.textContent).toContain("Responsible: HR / Employee")
    expect(button("Activate employee")).toBeUndefined()
    await act(async () => button("Open requirement").click())
    expect(navigate).toHaveBeenCalledWith("contracts", "contract")
    expect(container.textContent).not.toContain("Provide laptop")
    await act(async () => button("Show completed requirements (1)").click())
    expect(container.textContent).toContain("Provide laptop")
  })
  it("enables activation only after a successful readiness response", async () => {
    getReadiness.mockResolvedValue({ ...data, ready_to_activate: true, blocker_count: 0, next_action: null })
    await render()
    await act(async () => button("Activate employee").click())
    expect(activate).not.toHaveBeenCalled()
    await act(async () => button("Confirm activation").click())
    expect(activate).toHaveBeenCalledOnce()
  })
  it("does not offer activation without permission", async () => {
    getReadiness.mockResolvedValue({ ...data, ready_to_activate: true })
    await render(false)
    expect(button("Activate employee")).toBeUndefined()
  })
  it("hides payroll requirements unless payroll read access is granted", async () => {
    const payrollRequirement = { id: "TIN", label: "Tax identification number", group: "Employment & payroll", owner: "Payroll", required: true, status: "pending", action: "payroll" }
    getReadiness.mockResolvedValue({ ...data, blocker_count: 2, total_required: 3, next_action: payrollRequirement, requirements: [payrollRequirement, ...data.requirements] })
    await render()
    expect(container.textContent).not.toContain("Tax identification number")
    expect(container.textContent).not.toContain("Payroll & salary")
    expect(container.textContent).toContain("1 activation requirements outstanding")
    await act(async () => root.unmount())
    container.remove()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await render(true, true)
    expect(container.textContent).toContain("Tax identification number")
    expect(container.textContent).toContain("Payroll & salary")
    expect(container.textContent).toContain("2 activation requirements outstanding")
  })
  it("hides contract requirements without contract read access", async () => {
    await render(true, false, false)
    expect(container.textContent).not.toContain("Signed contract")
    expect(container.textContent).not.toContain("Employment contract")
  })
  it("fails closed and lets HR retry a failed readiness check", async () => {
    getReadiness.mockRejectedValueOnce(new Error("Unavailable"))
    await render()
    expect(container.textContent).toContain("Readiness unavailable")
    expect(button("Activate employee")).toBeUndefined()
    await act(async () => labelledButton("Refresh readiness").click())
    expect(getReadiness).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain("Signed contract")
  })
})
