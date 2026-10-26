// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { EmploymentContractsView } from "./employment-contracts-view"

const api = vi.hoisted(() => ({
  listEmployees: vi.fn(),
  listEmploymentContractSummary: vi.fn(),
  listEmploymentContracts: vi.fn(),
  issueEmploymentContract: vi.fn(),
  attachEmploymentContract: vi.fn(),
}))
vi.mock("@/lib/admin-api", () => api)
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  localStorage.setItem("hrms.admin.accessToken", "token")
  api.listEmployees.mockResolvedValue({ rows: [] })
  api.listEmploymentContractSummary.mockResolvedValue([])
  api.listEmploymentContracts.mockResolvedValue([])
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllGlobals()
})
describe("employee-scoped contracts", () => {
  it("loads only the current employee and hides mutation actions for readers", async () => {
    await act(async () => root.render(<EmploymentContractsView employee={{ id: 12, full_name: "Amina John" }} canManage={false} />))
    expect(api.listEmployees).not.toHaveBeenCalled()
    expect(api.listEmploymentContracts).toHaveBeenCalledWith("token", 12)
    expect(container.textContent).toContain("Amina John")
    expect(container.querySelector('[aria-label="Employee"]')).toBeNull()
    expect([...container.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Contract")).toBe(false)
  })
})

describe("contract employee filters", () => {
  it("searches employees and filters those with contracts", async () => {
    api.listEmployees.mockResolvedValue({
      rows: [
        { id: 12, full_name: "Amina John", employee_no: "EMP-012" },
        { id: 24, full_name: "Bosco Richard", employee_no: "EMP-024" },
      ],
    })
    api.listEmploymentContractSummary.mockResolvedValue([{ employeeId: 24, contractCount: 1 }])

    await act(async () => root.render(<EmploymentContractsView />))
    await act(async () => await Promise.resolve())

    expect(api.listEmploymentContractSummary).toHaveBeenCalledWith("token")
    expect(container.textContent).toContain("Contracted 1")
    expect(container.textContent).toContain("Not contracted 1")

    const contracted = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Contracted"))
    await act(async () => contracted?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(contracted?.getAttribute("aria-pressed")).toBe("true")
    expect(container.textContent).toContain("1 employee")
  })

  it("keeps employee search available when the contract summary endpoint is unavailable", async () => {
    api.listEmployees.mockResolvedValue({ rows: [{ id: 12, full_name: "Amina John" }] })
    api.listEmploymentContractSummary.mockRejectedValue(new Error("Not found"))

    await act(async () => root.render(<EmploymentContractsView />))
    await act(async () => await Promise.resolve())

    expect(container.querySelector('[aria-label="Employee"]')).not.toBeNull()
    expect(container.textContent).toContain("1 employee")
    expect(container.querySelector('[aria-label="Contract status filter"]')).toBeNull()
  })
})
