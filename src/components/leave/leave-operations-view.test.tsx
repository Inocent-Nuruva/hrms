// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getLeaveReadiness: vi.fn(),
  getLeavePayrollReconciliation: vi.fn(),
  previewLeaveBackfill: vi.fn(),
  applyLeaveBackfill: vi.fn(),
  listLeaveBackfillBatches: vi.fn(),
  revertLeaveBackfillBatch: vi.fn(),
  retryEncashmentHandoffs: vi.fn(),
  listLeaveOperationsHistory: vi.fn(),
}))
const perms = vi.hoisted(() => ({ labels: [] as string[] }))
vi.mock("@/lib/leave-engine-api", () => api)
vi.mock("@/lib/session-client", () => ({ readStoredSessionTokens: () => ({ accessToken: "t" }) }))
vi.mock("@/lib/error-alert", () => ({ showErrorAlert: vi.fn() }))
vi.mock("@/lib/success-alert", () => ({ showSuccessAlert: vi.fn() }))
vi.mock("@/hooks/use-dashboard-actor", () => ({ useDashboardActor: () => ({ permissionLabels: perms.labels }) }))
vi.mock("@/lib/dashboard-permissions", () => ({
  canPerformPermission: (labels: string[], p: string) => labels.includes(p),
}))
vi.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock("./leave-notifications-panel", () => ({ LeaveNotificationsPanel: () => <div>notifications</div> }))

import { LeaveOperationsView } from "./leave-operations-view"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getLeaveReadiness.mockResolvedValue({
    generated_at: "2026-11-18T08:00:00Z",
    findings: [
      { area: "workflows", severity: "blocker", code: "no_active_workflow", message: "No active leave approval workflow", owner: "HR" },
      { area: "scheduler", severity: "ok", code: "scheduler_enabled", message: "Scheduled leave jobs are enabled", owner: "IT" },
    ],
    blocked_features: ["Leave routing"],
    summary: { ok: 1, warning: 0, blocker: 1 },
  })
  api.listLeaveBackfillBatches.mockResolvedValue([])
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})
const render = async () => {
  await act(async () => root.render(<LeaveOperationsView />))
  await act(async () => {})
}
const click = async (text: string) => {
  const el = [...document.querySelectorAll("button")].find((b) => b.textContent === text)!
  await act(async () => el.click())
  await act(async () => {})
}

describe("LeaveOperationsView", () => {
  it("shows the readiness report with blockers first", async () => {
    perms.labels = ["leave_operations:read"]
    await render()
    const text = document.body.textContent ?? ""
    expect(text).toContain("1 blocker(s)")
    expect(text).toContain("Leave routing")
    expect(text.indexOf("No active leave approval workflow")).toBeLessThan(text.indexOf("Scheduled leave jobs"))
  })

  it("read-only users can preview the backfill but not apply it", async () => {
    perms.labels = ["leave_operations:read"]
    api.previewLeaveBackfill.mockResolvedValue({ scanned: 3, proposed: 2, needsReview: 1, candidates: [] })
    await render()
    await click("Allocation backfill")
    await click("Preview (dry run)")
    expect(api.previewLeaveBackfill).toHaveBeenCalled()
    expect(document.body.textContent).toContain("2 can be rebuilt")
    expect([...document.querySelectorAll("button")].some((b) => b.textContent === "Apply")).toBe(false)
  })

  it("applying needs the typed confirmation", async () => {
    perms.labels = ["leave_operations:read", "leave_operations:execute"]
    api.previewLeaveBackfill.mockResolvedValue({ scanned: 3, proposed: 2, needsReview: 1, candidates: [] })
    api.applyLeaveBackfill.mockResolvedValue({ batchId: "b", applied: 2, needsReview: 1 })
    await render()
    await click("Allocation backfill")
    await click("Preview (dry run)")
    const prompt = vi.spyOn(window, "prompt").mockReturnValueOnce("no").mockReturnValueOnce("APPLY")
    await click("Apply")
    expect(api.applyLeaveBackfill).not.toHaveBeenCalled()
    await click("Preview (dry run)")
    await click("Apply")
    expect(api.applyLeaveBackfill).toHaveBeenCalledTimes(1)
    prompt.mockRestore()
  })

  it("reconciliation hides matched rows by default", async () => {
    perms.labels = ["leave_operations:read"]
    api.getLeavePayrollReconciliation.mockResolvedValue({
      from: "2026-01-01",
      to: "2026-11-18",
      summary: { leave_days: {}, encashments: {}, exit_settlements: {} },
      leave_days: [],
      exit_settlements: [],
      encashments: [
        { encashment_id: 1, status: "PAID", notes: "" },
        { encashment_id: 2, status: "MISMATCH", notes: "amount differs" },
      ],
    })
    await render()
    await click("Payroll reconciliation")
    await click("Reconcile")
    const text = document.body.textContent ?? ""
    expect(text).toContain("amount differs")
    expect(text).toContain("Encashments (1)")
  })
})
