import { describe, expect, it, vi } from "vitest"
import { createTestNotification, listAllCurrentCompanyUsers } from "./admin-api"
import { notifySubmittedRequestApprovers, notifyLeaveRequestRequester } from "./request-notifications"
vi.mock("./admin-api", () => ({ createTestNotification: vi.fn(), listAllCurrentCompanyUsers: vi.fn() }))
describe("server-owned leave notifications", () => {
  it.each([0, 1, 2])("does not broadcast from the client at level %s", async level => {
    const loadRequest = vi.fn()
    expect(await notifySubmittedRequestApprovers({ kind: "leave_request", token: "test", request: { id: 7, current_approval_level: level }, loadRequest })).toBe(0)
    expect(loadRequest).not.toHaveBeenCalled()
    expect(createTestNotification).not.toHaveBeenCalled()
    expect(listAllCurrentCompanyUsers).not.toHaveBeenCalled()
  })
  it("does not announce final approval after an intermediate decision", async () => {
    expect(await notifyLeaveRequestRequester({ action: "approve", token: "test", request: { id: 7, status: "pending_hr" } })).toBe(0)
    expect(createTestNotification).not.toHaveBeenCalled()
  })
})
