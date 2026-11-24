// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { listEmployeeEmploymentHistory } from "@/lib/admin-api"
import { EmployeeStatusHistorySection } from "./employee-status-history"

vi.mock("@/lib/admin-api", () => ({ listEmployeeEmploymentHistory: vi.fn() }))

it("shows the applied movement and effective date in the employee’s Status History", async () => {
  vi.mocked(listEmployeeEmploymentHistory).mockResolvedValue([{
    id: 51, event_type: "MOVEMENT_APPLIED", effective_date: "2026-11-02",
    title: "Movement applied", description: "Salary Revision (MOV-0042)",
    source_module: "employee_movements", old_values: null, new_values: null,
    created_by_company_user_id: null, created_at: "2026-11-03T06:00:00Z",
  }])
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  const host = document.createElement("div")
  const root = createRoot(host)
  try {
    await act(async () => root.render(<EmployeeStatusHistorySection employeeId={7} token="fixture" />))
    const panel = host.querySelector('[aria-label="Status history"]')
    expect(panel?.textContent).toContain("Movement applied")
    expect(panel?.textContent).toContain("Salary Revision (MOV-0042)")
    expect(panel?.textContent).toContain("Effective 2026-11-02")
    expect(listEmployeeEmploymentHistory).toHaveBeenCalledWith("fixture", 7)
  } finally {
    await act(async () => root.unmount())
    vi.unstubAllGlobals()
  }
})
