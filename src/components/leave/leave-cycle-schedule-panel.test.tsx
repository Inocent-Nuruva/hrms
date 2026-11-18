// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  listLeaveCycles: vi.fn(),
  createRolloverRun: vi.fn(),
  days: (v: unknown) => (v == null ? "—" : `${Number(v)} d`),
}))
vi.mock("@/lib/leave-engine-api", () => api)
vi.mock("@/lib/session-client", () => ({ readStoredSessionTokens: () => ({ accessToken: "t" }) }))
vi.mock("@/lib/error-alert", () => ({ showErrorAlert: vi.fn() }))
vi.mock("@/lib/success-alert", () => ({ showSuccessAlert: vi.fn() }))

import { LeaveCycleSchedulePanel } from "./leave-cycle-schedule-panel"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  api.listLeaveCycles.mockReset()
  api.createRolloverRun.mockReset()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const row = (over: Record<string, unknown>) => ({
  balance_id: 1, employee_id: 1, employee_no: "E1", employee_name: "Ann", leave_type_id: 4,
  leave_type_name: "Annual", leave_year: "2025", cycle_start: "2025-08-15", cycle_end: "2026-08-14",
  next_rollover_date: "2026-08-15", closed_at: null, eligible_balance_estimate: 3, last_run_id: null,
  last_line_status: null, carry_forward_days: null, encash_days: null, encash_amount: null, lapse_days: null,
  last_error: null, last_exceptions: null, last_execution_at: null, processing_status: "open",
  retry_available: false, ...over,
})

describe("LeaveCycleSchedulePanel", () => {
  it("shows each balance's own cycle and lets managers retry a failed rollover", async () => {
    api.listLeaveCycles.mockResolvedValue({
      data: [
        row({}),
        row({ balance_id: 2, employee_name: "Ben", processing_status: "failed", retry_available: true, last_error: "boom" }),
      ],
      meta: { total: 2, page: 1, limit: 25 },
    })
    api.createRolloverRun.mockResolvedValue({})
    await act(async () => root.render(<LeaveCycleSchedulePanel canManage />))
    await act(async () => {})
    const text = document.body.textContent ?? ""
    expect(text).toContain("2025-08-15 – 2026-08-14")
    expect(text).toContain("Cycle running")
    expect(text).toContain("Rollover failed")
    expect(text).toContain("boom")
    const retry = [...document.querySelectorAll("button")].find((b) => b.textContent === "Retry")!
    await act(async () => retry.click())
    expect(api.createRolloverRun).toHaveBeenCalledWith("t", expect.objectContaining({ from_leave_year: "2025", leave_type_id: 4 }))
  })

  it("hides retry without manage permission", async () => {
    api.listLeaveCycles.mockResolvedValue({
      data: [row({ processing_status: "due", retry_available: true })],
      meta: { total: 1, page: 1, limit: 25 },
    })
    await act(async () => root.render(<LeaveCycleSchedulePanel canManage={false} />))
    await act(async () => {})
    expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Prepare")).toBe(false)
  })
})
