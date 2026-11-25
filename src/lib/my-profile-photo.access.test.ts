import { beforeEach, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  user: { scope: "company", employeeLinked: false } as { scope: string; employeeLinked: boolean },
  loadPhoto: vi.fn(),
}))
vi.mock("@/lib/auth-session-store", () => ({
  getSessionSnapshot: () => ({ user: state.user }),
  getServerSessionSnapshot: () => ({ user: null }),
  subscribeSession: () => () => {},
}))
vi.mock("@/lib/session-client", () => ({
  readStoredSessionTokens: () => ({ accessToken: "token" }),
  SESSION_CLEARED_EVENT: "session-cleared",
}))
vi.mock("@/lib/admin-api", () => ({ getMyProfilePhotoUrl: state.loadPhoto }))

import { ensureMyProfilePhotoUrl, invalidateMyProfilePhoto } from "./my-profile-photo"

beforeEach(() => {
  state.user = { scope: "company", employeeLinked: false }
  state.loadPhoto.mockReset()
  invalidateMyProfilePhoto()
})

it("does not request an employee photo for an unlinked account", async () => {
  expect(await ensureMyProfilePhotoUrl("token")).toBeNull()
  expect(state.loadPhoto).not.toHaveBeenCalled()
})

it("loads the photo when the membership is linked", async () => {
  state.user.employeeLinked = true
  state.loadPhoto.mockResolvedValue("/photo.png")
  expect(await ensureMyProfilePhotoUrl("token")).toBe("/photo.png")
  expect(state.loadPhoto).toHaveBeenCalledWith("token")
})
