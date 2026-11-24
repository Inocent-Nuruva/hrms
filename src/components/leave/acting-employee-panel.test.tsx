// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import { ActingEmployeePanel } from "./acting-employee-panel"

vi.mock("@/lib/admin-api", () => ({
  getLeaveActingAssignment: async () => ({ current: null, history: [], can_manage: true }),
}))

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("acting appointment controls", () => {
  it("labels the optional routing switch and keeps routing off until selected", async () => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)
    try {
      await act(async () => root.render(<ActingEmployeePanel token="test" leaveRequestId={5}
        leaveStatus="pending_hr" leaveStart="2031-04-07" leaveEnd="2031-04-09" absentEmployeeId={3} />))
      const button = (label: string) => [...host.querySelectorAll("button")].find(el => el.textContent === label)
      await act(async () => button("Appoint acting employee")!.click())
      const toggle = host.querySelector<HTMLInputElement>('[role="switch"][aria-label="Route leave approvals to the acting employee"]')!
      expect(toggle.checked).toBe(false)
      await act(async () => toggle.click())
      expect(toggle.checked).toBe(true)
      expect(button("Save")).toBeInstanceOf(HTMLButtonElement)
    } finally {
      act(() => root.unmount())
      host.remove()
    }
  })
})
