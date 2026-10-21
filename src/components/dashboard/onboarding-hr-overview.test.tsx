// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OnboardingHrOverview } from "./onboarding-hr-overview"

const getOverview = vi.hoisted(() => vi.fn())
vi.mock("@/lib/admin-api", () => ({ getOnboardingOverview: getOverview }))
let root: Root
let container: HTMLDivElement
const open = vi.fn()
const row = {
  id: 1, employee_id: 7, employee_name: "Amina Ali", employee_no: "EMP-7", onboarding_no: "ONB-1",
  department: "Finance", stage: "Contract", overdue: true, owners: ["HR / Employee"],
  readiness: { ready_to_activate: false, completed_required: 9, total_required: 10 },
  blockers: [{ id: "contract", label: "Signed contract", owner: "HR / Employee", group: "Contract" }],
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  getOverview.mockResolvedValue({ data: [row], next_cursor: null })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
async function render(detailsOpen = false) {
  await act(async () => root.render(<OnboardingHrOverview token="token" detailsOpen={detailsOpen} onOpen={open} />))
}
function button(label: string) {
  return [...container.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === label)!
}
describe("HR onboarding overview", () => {
  it("loads every batch before showing complete counts and opens the existing request dialog", async () => {
    getOverview.mockResolvedValueOnce({ data: [row], next_cursor: 1 }).mockResolvedValueOnce({ data: [{ ...row, id: 2, employee_name: "Neema David", stage: "Ready for activation", blockers: [], owners: [], overdue: false, readiness: { ready_to_activate: true, completed_required: 10, total_required: 10 } }], next_cursor: null })
    await render()
    expect(getOverview).toHaveBeenNthCalledWith(2, "token", 1)
    expect(container.textContent).toContain("2 of 2 open requests · 1 ready for activation · 1 overdue")
    expect(container.textContent).toContain("Signed contract")
    expect(container.textContent).toContain("Responsible: HR / Employee")
    await act(async () => button("Review onboarding for Amina Ali").click())
    expect(open).toHaveBeenCalledWith(1)
  })
  it("fails closed on a failed later batch rather than showing partial ready counts", async () => {
    getOverview.mockResolvedValueOnce({ data: [row], next_cursor: 1 }).mockRejectedValueOnce(new Error("Unavailable"))
    await render()
    expect(container.textContent).toContain("Overview unavailable")
    expect(container.textContent).not.toContain("of 1 open requests")
    expect(button("Review onboarding for Amina Ali")).toBeUndefined()
    await act(async () => button("Refresh overview").click())
    expect(container.textContent).toContain("1 of 1 open requests")
  })
  it("refreshes after the workflow dialog closes", async () => {
    await render()
    await render(true)
    expect(getOverview).toHaveBeenCalledTimes(1)
    await render(false)
    expect(getOverview).toHaveBeenCalledTimes(2)
  })
  it("stops a broken pagination cursor and shows a retry error", async () => {
    getOverview.mockResolvedValue({ data: [row], next_cursor: 0 })
    await render()
    expect(container.textContent).toContain("pagination did not advance")
    expect(getOverview).toHaveBeenCalledTimes(1)
  })
})
