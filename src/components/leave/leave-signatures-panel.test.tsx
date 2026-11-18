// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  listLeaveSignatures: vi.fn(),
  listMyLeaveSignatures: vi.fn(),
  signLeaveApplication: vi.fn(),
  signMyLeaveApplication: vi.fn(),
  signLeaveApproval: vi.fn(),
  getLeaveVerificationState: vi.fn(),
}))
vi.mock("@/lib/leave-engine-api", () => api)
vi.mock("@/lib/error-alert", () => ({ showErrorAlert: vi.fn() }))
vi.mock("@/lib/success-alert", () => ({ showSuccessAlert: vi.fn() }))

import { LeaveSignaturesPanel } from "./leave-signatures-panel"

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
const buttons = () => [...document.querySelectorAll("button")]
const byText = (t: string) => buttons().find((b) => b.textContent?.includes(t))

describe("LeaveSignaturesPanel", () => {
  it("lists signatures with validity and offers the applicant to sign via /me", async () => {
    api.listMyLeaveSignatures.mockResolvedValue([
      {
        id: 1, role: "APPROVER", approval_id: 5, signer_name: "Mary HR", decision: "approved",
        signed_at: "2026-11-18T08:00:00Z", reference: "SIG-1", method: "x", valid: false,
        invalid_reason: "Application changed after signing",
      },
    ])
    api.signMyLeaveApplication.mockResolvedValue({})
    await render(
      <LeaveSignaturesPanel token="t" requestId={9} currentCompanyUserId={null} isApplicant selfService status="pending_hr" />,
    )
    expect(api.listMyLeaveSignatures).toHaveBeenCalledWith("t", 9)
    expect(api.listLeaveSignatures).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("Mary HR")
    expect(document.body.textContent).toContain("Application changed after signing")

    await act(async () => byText("Sign my application")!.click())
    const sign = buttons().find((b) => b.textContent === "Sign")!
    expect(sign.disabled).toBe(true) // confirmation checkbox required
    const box = document.querySelector<HTMLInputElement>('[role="alertdialog"] input[type="checkbox"], input[type="checkbox"]')!
    await act(async () => box.click())
    await act(async () => buttons().find((b) => b.textContent === "Sign")!.click())
    expect(api.signMyLeaveApplication).toHaveBeenCalledWith("t", 9)
  })

  it("offers approvers to sign only their own decided, unsigned stage", async () => {
    api.listLeaveSignatures.mockResolvedValue([])
    await render(
      <LeaveSignaturesPanel
        token="t"
        requestId={3}
        currentCompanyUserId={77}
        isApplicant={false}
        approvals={[
          { id: 1, approver_company_user_id: 77, status: "approved", approval_level: 1 },
          { id: 2, approver_company_user_id: 77, status: "pending", approval_level: 2 },
          { id: 3, approver_company_user_id: 99, status: "approved", approval_level: 3 },
        ]}
      />,
    )
    const signButtons = buttons().filter((b) => b.textContent?.startsWith("Sign my"))
    expect(signButtons.map((b) => b.textContent)).toEqual(["Sign my level 1 decision"])
    expect(byText("Sign my application")).toBeUndefined()
  })
})
