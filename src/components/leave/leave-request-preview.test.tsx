// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { LeaveRequestPreview } from "@/lib/admin-api"
import { LeaveRequestPreviewPanel } from "./leave-request-preview"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const base: LeaveRequestPreview = {
  employee_id: 1,
  leave_type_id: 2,
  start_date: "2026-12-07",
  end_date: "2026-12-13",
  calendar_days: 7,
  chargeable_days: 4,
  weekly_off_days: 2,
  public_holiday_days: 1,
  included_dates: [],
  excluded_dates: [],
  evidence: { required: false, requires_attachment: true, required_after_days: 5, allow_deferred: false, grace_days: 3 },
  notice: { minimum_days: 0, days_until_start: 20, satisfied: true, override_applied: false },
  balance: { available_now: 10, bookable_for_dates: 12, allow_negative: false },
  issues: [],
  can_submit: true,
}

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function render(preview: LeaveRequestPreview) {
  act(() => root.render(<LeaveRequestPreviewPanel preview={preview} error={null} loading={false} />))
  return host.textContent ?? ""
}

describe("LeaveRequestPreviewPanel", () => {
  it("shows the server's working-day breakdown and document rule", () => {
    const text = render(base)
    expect(text).toContain("Calendar days7 d")
    expect(text).toContain("Leave days charged4 d")
    expect(text).toContain("Public holidays1 d")
    expect(text).toContain("Not needed (only beyond 5 working day(s))")
    expect(text).toContain("12 d")
  })

  it("lists blocking issues and an unmet notice period", () => {
    const text = render({
      ...base,
      notice: { minimum_days: 7, days_until_start: 2, satisfied: false, override_applied: false },
      issues: ["Insufficient leave balance"],
      can_submit: false,
    })
    expect(text).toContain("7 day(s) required; 2 given")
    expect(text).toContain("Insufficient leave balance")
  })
})
