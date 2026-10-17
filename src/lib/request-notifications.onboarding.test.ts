import { describe, expect, it, vi } from "vitest"
import { createTestNotification, listAllCurrentCompanyUsers } from "./admin-api"
import { notifySubmittedRequestApprovers } from "./request-notifications"

vi.mock("./admin-api", () => ({
  createTestNotification: vi.fn(),
  listAllCurrentCompanyUsers: vi.fn(),
}))

describe("onboarding notifications", () => {
  it("leaves notification routing to the backend without broadcasting fallback approvals", async () => {
    const loadRequest = vi.fn()
    expect(await notifySubmittedRequestApprovers({
      kind: "onboarding_request", token: "test", request: { id: 1 }, loadRequest,
    })).toBe(0)
    expect(loadRequest).not.toHaveBeenCalled()
    expect(listAllCurrentCompanyUsers).not.toHaveBeenCalled()
    expect(createTestNotification).not.toHaveBeenCalled()
  })
})
