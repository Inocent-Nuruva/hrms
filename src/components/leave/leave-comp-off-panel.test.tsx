// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getCompOffEligibility: vi.fn(),
  listCompOffCredits: vi.fn(),
  requestCompOff: vi.fn(),
  listPendingCompOffCredits: vi.fn(),
  listCompOffPolicies: vi.fn(),
  getCompOffUtilization: vi.fn(),
  decideCompOff: vi.fn(),
  reverseCompOff: vi.fn(),
  getCompOffHistory: vi.fn(),
  saveCompOffPolicy: vi.fn(),
  approveCompOffPolicy: vi.fn(),
}))
vi.mock("@/lib/admin-api", () => api)
vi.mock("@/lib/error-alert", () => ({ showErrorAlert: vi.fn() }))
vi.mock("@/lib/success-alert", () => ({ showSuccessAlert: vi.fn() }))

import { LeaveCompOffPanel } from "./leave-comp-off-panel"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  Object.values(api).forEach((fn) => fn.mockReset())
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const render = async (node: React.ReactNode) => {
  await act(async () => {
    root.render(node)
  })
  await act(async () => {})
}

describe("LeaveCompOffPanel", () => {
  it("renders nothing when no comp-off type exists", async () => {
    api.getCompOffEligibility.mockResolvedValue({ types: [], convertible_overtime: [] })
    api.listCompOffCredits.mockResolvedValue([])
    await render(<LeaveCompOffPanel token="t" mode="self" />)
    expect(host.textContent).toBe("")
  })

  it("shows the disabled reason and no request form while the policy is unapproved", async () => {
    api.getCompOffEligibility.mockResolvedValue({
      types: [{ id: 5, name: "Comp off", earning_enabled: false, disabled_reason: "Waiting for HR to approve the compensatory-off policy." }],
      convertible_overtime: [{ id: 9, work_date: "2026-11-07", requested_minutes: 480 }],
    })
    api.listCompOffCredits.mockResolvedValue([])
    await render(<LeaveCompOffPanel token="t" mode="self" />)
    expect(host.textContent).toContain("Waiting for HR to approve")
    expect(host.querySelector('[aria-label="Approved overtime"]')).toBeNull()
  })

  it("shows balance, expiry and the request form when earning is enabled", async () => {
    api.getCompOffEligibility.mockResolvedValue({
      types: [{ id: 5, name: "Comp off", earning_enabled: true }],
      convertible_overtime: [{ id: 9, work_date: "2026-11-07", requested_minutes: 480 }],
    })
    api.listCompOffCredits.mockResolvedValue([
      { id: 1, status: "credited", days: "1.00", hours: "8.00", work_date: "2026-10-01", expires_on: "2026-12-30", expired_days: "0" },
      { id: 2, status: "pending_approval", days: "0.50", hours: "4.00", work_date: "2026-11-01", expires_on: "2027-01-30", expired_days: "0" },
    ])
    await render(<LeaveCompOffPanel token="t" mode="self" />)
    expect(host.textContent).toContain("2026-12-30")
    expect(host.textContent).toContain("Waiting for approval")
    expect(host.querySelector('[aria-label="Approved overtime"]')).not.toBeNull()
    expect(host.textContent).toContain("2026-11-07 · 8.00 h")
  })

  it("HR view lists pending credits with approve/reject and blocks earning without a policy", async () => {
    api.listPendingCompOffCredits.mockResolvedValue([
      { id: 3, employee_id: 44, status: "pending_approval", days: "1.00", hours: "8.00", work_date: "2026-11-07", expires_on: null, expired_days: "0" },
    ])
    api.listCompOffCredits.mockResolvedValue([])
    api.listCompOffPolicies.mockResolvedValue([])
    api.getCompOffEligibility.mockResolvedValue({ types: [], convertible_overtime: [] })
    api.getCompOffUtilization.mockResolvedValue([])
    await render(<LeaveCompOffPanel token="t" mode="hr" canManagePolicy={false} />)
    expect(host.textContent).toContain("#44")
    expect(host.textContent).toContain("Approve")
    expect(host.textContent).toContain("Earning is blocked")
    expect(host.textContent).not.toContain("Save draft")
  })
})
