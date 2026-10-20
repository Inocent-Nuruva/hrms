// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { EmploymentContractsView } from "./employment-contracts-view"

const api = vi.hoisted(() => ({
  listEmployees: vi.fn(),
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
