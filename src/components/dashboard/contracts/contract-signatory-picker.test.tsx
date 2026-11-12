// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import { EmployeePicker } from "./contract-settings"

const mock = vi.hoisted(() => ({ listEmployees: vi.fn() }))
vi.mock("@/lib/admin-api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  listEmployees: mock.listEmployees,
}))

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe("company signatory employee picker", () => {
  it("shows and selects employees returned with API field names", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.useFakeTimers()
    const employee = { id: 7, firstName: "Filbert", lastName: "Msaki", employeeNo: "E007" }
    mock.listEmployees.mockResolvedValue({ rows: [employee] })
    const select = vi.fn()
    const element = document.createElement("div")
    document.body.append(element)
    const root = createRoot(element)
    await act(async () => root.render(<EmployeePicker token="token" onPick={select} />))
    const input = element.querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "fil")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await vi.advanceTimersByTimeAsync(300)
    })
    const option = element.querySelector("li button") as HTMLButtonElement
    expect(option.textContent).toContain("Filbert Msaki")
    expect(option.textContent).toContain("E007")
    await act(async () => option.click())
    expect(select).toHaveBeenCalledWith(employee)
    await act(async () => root.unmount())
    element.remove()
  })
})
