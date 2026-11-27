// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({ createPlan: vi.fn(), visits: vi.fn(), plans: vi.fn(), followUps: vi.fn(), parties: vi.fn(), leave: () => false }))
vi.mock("@/lib/session-client", () => ({ readStoredSessionTokens: () => ({ accessToken: "test-token" }) }))
vi.mock("@/hooks/use-forbidden-route-guard", () => ({ useLeaveIfForbidden: () => api.leave }))
vi.mock("@/lib/admin-api", () => ({
  createMyFieldVisitPlan: api.createPlan,
  listMyFieldVisits: api.visits,
  listMyFieldVisitPlans: api.plans,
  listMyFieldFollowUps: api.followUps,
  listFieldParties: api.parties,
  getMyFieldVisitCommercialPolicy: vi.fn().mockResolvedValue(null),
  getMyFieldAttendancePolicy: vi.fn().mockResolvedValue(null),
  getMyAttendanceToday: vi.fn().mockResolvedValue(null),
  updateMyFieldVisitPlan: vi.fn(), submitMyFieldVisitPlan: vi.fn(),
  checkInMyFieldVisit: vi.fn(), checkOutMyFieldVisit: vi.fn(),
  createMyUnplannedFieldVisit: vi.fn(), createMyFieldFollowUp: vi.fn(),
  updateMyFieldFollowUp: vi.fn(), completeMyFieldFollowUp: vi.fn(), cancelMyFieldFollowUp: vi.fn(),
  addMyFieldVisitExpense: vi.fn(), addMyFieldVisitOpportunity: vi.fn(),
  uploadMyFieldAttachment: vi.fn(), downloadFieldAttachment: vi.fn(), fileToBase64UploadDto: vi.fn(),
  getMyFieldVisit: vi.fn(), retryMyFieldAttendance: vi.fn(), setMyFieldVisitDisposition: vi.fn(),
  requestMyFieldCheckoutCorrection: vi.fn(), reviseMyFieldVisitOutcome: vi.fn(),
  suggestMyFieldPlanRoute: vi.fn(), repeatMyFieldPlan: vi.fn(),
}))
vi.mock("@/components/dashboard/talent-visuals", async (original) => ({ ...(await original<typeof import("@/components/dashboard/talent-visuals")>()), TalentDoodleSprites: () => null }))
vi.mock("@/components/animate-ui/components/base/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return { Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null, DialogPopup: Wrapper, DialogHeader: Wrapper, DialogFooter: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper }
})
vi.mock("@/components/ui/resizable-table", () => ({ ResizableTable: () => null }))
vi.mock("@/components/ui/fluent-select", () => ({ FluentSelect: () => null }))
vi.mock("@/components/ui/date-input", () => ({ DateInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} type="date" /> }))
vi.mock("@/components/ui/time-input", () => ({ TimeInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} type="time" /> }))
import { FieldSelfView } from "./field-self-view"

let root: Root
let container: HTMLDivElement
const button = (label: string) => {
  const result = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === label)
  if (!result) throw new Error(`Button ${label} not found`)
  return result
}
function change(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value)
  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

beforeEach(async () => {
  api.visits.mockResolvedValue([]); api.plans.mockResolvedValue([]); api.followUps.mockResolvedValue([]); api.parties.mockResolvedValue([]); api.createPlan.mockResolvedValue({ id: 1 })
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container)
  await act(async () => { root.render(<FieldSelfView activeTab="plans" />) })
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks() })

describe("field planner", () => {
  it("saves multiple named visits with their own scheduled times", async () => {
    await act(async () => { button("New plan").click() })
    const firstName = container.querySelector('input[placeholder="e.g. Renewal meeting with ABC Company"]') as HTMLInputElement
    const date = container.querySelector('input[type="date"]') as HTMLInputElement
    const firstPurpose = container.querySelector("textarea") as HTMLTextAreaElement
    await act(async () => { change(firstName, "First visit"); change(date, "2026-11-25"); change(firstPurpose, "Meet customer"); const times = container.querySelectorAll<HTMLInputElement>('input[type="time"]'); change(times[0], "09:00"); change(times[1], "10:00"); button("Add another visit").click() })
    const second = container.querySelector("fieldset")!
    await act(async () => { change(second.querySelector("input")!, "Second visit"); change(second.querySelector("textarea")!, "Inspect site"); const times = second.querySelectorAll<HTMLInputElement>('input[type="time"]'); change(times[0], "11:00"); change(times[1], "12:00") })
    await act(async () => { button("Save").click() })
    expect(api.createPlan).toHaveBeenCalledWith("test-token", expect.objectContaining({ visit_date: "2026-11-25", items: [expect.objectContaining({ visit_name: "First visit", purpose: "Meet customer", planned_start_time: new Date("2026-11-25T09:00").toISOString() }), expect.objectContaining({ visit_name: "Second visit", purpose: "Inspect site", planned_start_time: new Date("2026-11-25T11:00").toISOString() })] }))
  })
})
