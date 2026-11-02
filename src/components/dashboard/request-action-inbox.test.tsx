// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { RequestActionInbox } from "./request-action-inbox"

const api = vi.hoisted(() => ({
  approveOnboardingRequest: vi.fn(),
  rejectOnboardingRequest: vi.fn(),
  approveOffboardingRequest: vi.fn(),
  rejectOffboardingRequest: vi.fn(),
  completeOnboardingTask: vi.fn(),
  completeOffboardingTask: vi.fn(),
  leaveRequestApprovalAction: vi.fn(),
  reportMyActionItemIssue: vi.fn(),
  getOnboardingRequest: vi.fn(),
}))
vi.mock("@/lib/admin-api", () => api)
vi.mock("@/lib/notifications-store", () => ({ useNotifications: () => ({}) }))
vi.mock("@/lib/session-client", () => ({ readStoredSessionTokens: () => ({ accessToken: "session-token" }) }))
vi.mock("@/components/ui/fluent-toast-store", () => ({ toast: { success: vi.fn() } }))
vi.mock("@/components/animate-ui/components/base/dialog", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  return {
    Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div role="dialog">{children}</div> : null,
    DialogPopup: Wrapper, DialogHeader: Wrapper, DialogTitle: Wrapper, DialogDescription: Wrapper, DialogFooter: Wrapper,
  }
})
vi.mock("@/components/ui/fluent-select", () => ({
  FluentSelect: ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { label: string; value: string }[] }) => (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
  ),
}))
let root: Root
let container: HTMLDivElement
const refresh = vi.fn().mockResolvedValue(undefined)
const task = {
  id: 1, sourceModule: "onboarding", sourceEntityType: "ONBOARDING_TASK", sourceEntityId: 10,
  actionType: "TASK", status: "OPEN", title: "Provide laptop", is_actionable: true,
  metadata: { onboarding_request_id: 20 }, subject_employee: { id: 30, name: "Amina John", employee_no: "EMP-30" },
}
beforeEach(() => {
  vi.clearAllMocks()
  api.getOnboardingRequest.mockResolvedValue({
    employee_details_review: {
      sections: [{ key: "personal", label: "Personal details", status: "pending", fields: [{ label: "First name", value: "Amina" }] }],
    },
  })
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal("matchMedia", () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((entry) => entry.textContent?.trim() === text)
  if (!button) throw new Error(`Missing button: ${text}`)
  await act(async () => button.click())
}
async function selectRequest(name = "Amina John") {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="Review requests for ${name}"]`)
  if (!button) throw new Error(`Missing request row for: ${name}`)
  await act(async () => button.click())
}
async function writeComment(value: string) {
  const textarea = container.querySelector("textarea")!
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!
    setter.call(textarea, value)
    const event = new Event("input", { bubbles: true })
    Object.defineProperty(event, "target", { value: textarea })
    textarea.dispatchEvent(event)
  })
}
describe("grouped request review", () => {
  it("shows pending task names by default and keeps a single task expandable", async () => {
    await act(async () => root.render(<RequestActionInbox actions={[task]} loading={false} onRefresh={refresh} />))
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Collapse requests for Amina John"]')!
    expect(toggle.getAttribute("aria-expanded")).toBe("true")
    expect(container.textContent).toContain("1 to complete")
    expect(container.querySelector('button[aria-label="Review Provide laptop"]')).not.toBeNull()
    await act(async () => toggle.click())
    expect(container.querySelector('button[aria-label="Review Provide laptop"]')).toBeNull()
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
  })

  it("shows the intended employee and reports a reason without completing work", async () => {
    await act(async () => root.render(<RequestActionInbox actions={[task]} loading={false} onRefresh={refresh} />))
    await selectRequest()
    expect(container.textContent).toContain("Amina John")
    expect(container.textContent).toContain("EMP-30")
    await click("Report issue to HR")
    expect(api.reportMyActionItemIssue).not.toHaveBeenCalled()
    expect(container.textContent).toContain("Explain the reason")
    await writeComment("No laptops in stock; awaiting procurement.")
    await click("Report issue to HR")
    expect(api.reportMyActionItemIssue).toHaveBeenCalledWith("session-token", "1", "No laptops in stock; awaiting procurement.")
    expect(api.completeOnboardingTask).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
  })
  it("approves the selected request from its dialog with a comment", async () => {
    await act(async () => root.render(<RequestActionInbox actions={[{ ...task, actionType: "APPROVAL", sourceEntityType: "ONBOARDING_REQUEST", sourceEntityId: 20 }]} loading={false} onRefresh={refresh} />))
    await selectRequest()
    await writeComment("Reviewed and approved.")
    await click("Approve and continue")
    expect(api.approveOnboardingRequest).toHaveBeenCalledWith("session-token", "20", { approve: true, comments: "Reviewed and approved." })
  })
  it("does not send the approval-only property when returning a request", async () => {
    await act(async () => root.render(<RequestActionInbox actions={[{ ...task, actionType: "APPROVAL", sourceEntityType: "ONBOARDING_REQUEST", sourceEntityId: 20 }]} loading={false} onRefresh={refresh} />))
    await selectRequest()
    await writeComment("The bank details need correction.")
    await click("Return for correction")
    expect(api.rejectOnboardingRequest).toHaveBeenCalledWith("session-token", "20", { comments: "The bank details need correction." })
  })
  it("routes employee detail submissions to their required section-by-section review", async () => {
    await act(async () => root.render(<RequestActionInbox actions={[{
      ...task,
      actionType: "APPROVAL",
      sourceEntityType: "ONBOARDING_REQUEST",
      sourceEntityId: 20,
      actionUrl: "/dashboard/employees/onboarding?request_id=20&workspace_tab=employee-details",
      metadata: { onboarding_request_id: 20, stage: "employee_details_review" },
    }]} loading={false} onRefresh={refresh} />))
    await selectRequest()
    expect(container.textContent).toContain("Submitted onboarding sections")
    expect(container.textContent).toContain("Personal details")
    expect(container.textContent).toContain("First name: Amina")
    expect(container.querySelector("textarea")).toBeNull()
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === "Approve and continue")).toBe(false)
    expect([...container.querySelectorAll('a[href="/dashboard/employees/onboarding?request_id=20&workspace_tab=employee-details"]')].some((link) => link.textContent?.includes("Review sections"))).toBe(true)
  })
  it("keeps workflow-gated tasks disabled and preserves comments after a failed issue submission", async () => {
    api.reportMyActionItemIssue.mockRejectedValueOnce(new Error("Network unavailable"))
    await act(async () => root.render(<RequestActionInbox actions={[{ ...task, is_actionable: false }]} loading={false} onRefresh={refresh} />))
    await selectRequest()
    const complete = [...container.querySelectorAll("button")].find((button) => button.textContent === "Mark item complete")
    expect(complete?.disabled).toBe(true)
    await writeComment("Email cannot be provisioned yet.")
    await click("Report issue to HR")
    expect(container.querySelector("textarea")?.value).toBe("Email cannot be provisioned yet.")
    expect(container.textContent).toContain("Network unavailable")
    expect(refresh).not.toHaveBeenCalled()
  })
})
