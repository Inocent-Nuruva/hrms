// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, afterEach, expect, it, vi } from "vitest"
import { useAccountAppearance } from "./use-account-appearance"
const mocks = vi.hoisted(() => ({ pathname: "/dashboard", request: vi.fn(), error: vi.fn(), session: { subject: "user-1", tokens: { accessToken: "token" } } }))
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }))
vi.mock("@/lib/admin-api", () => ({ adminRequest: mocks.request }))
vi.mock("@/lib/auth-session-store", () => ({ getSessionSnapshot: () => mocks.session, getServerSessionSnapshot: () => mocks.session, subscribeSession: () => () => {} }))
vi.mock("@/components/ui/fluent-toast-store", () => ({ toast: { error: mocks.error } }))
let root: Root
let apply: ReturnType<typeof vi.fn<(value: string) => void>>
let save: (value: string) => void
function Harness() {
  const update = useAccountAppearance("accent", "#303194", apply)
  React.useEffect(() => { save = update }, [update])
  return null
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mocks.pathname = "/dashboard"
  localStorage.clear()
  mocks.request.mockReset()
  mocks.error.mockReset()
  apply = vi.fn()
  root = createRoot(document.createElement("div"))
})
afterEach(async () => { await act(async () => root.unmount()) })
it("restores the account colour on a device with no local cache", async () => {
  mocks.request.mockResolvedValue({ accent: "#0078D4" })
  await act(async () => root.render(<Harness />))
  expect(apply).toHaveBeenLastCalledWith("#0078D4")
})
it("patches only the changed field and reports failed persistence", async () => {
  mocks.request.mockResolvedValueOnce({ accent: "#0078D4" }).mockRejectedValueOnce(new Error("offline"))
  await act(async () => root.render(<Harness />))
  await act(async () => save("#22C55E"))
  expect(mocks.request).toHaveBeenLastCalledWith("/api/users/me/appearance", { token: "token", method: "PATCH", body: { accent: "#22C55E" } })
  expect(mocks.error).toHaveBeenCalled()
})
it("does not overwrite a fresh choice with an older in-flight read", async () => {
  let resolve!: (value: object) => void
  mocks.request.mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValue({})
  await act(async () => root.render(<Harness />))
  await act(async () => save("#22C55E"))
  await act(async () => resolve({ accent: "#0078D4" }))
  expect(apply).toHaveBeenLastCalledWith("#22C55E")
})

it("keeps login appearance local despite a stored session and syncs after entering the dashboard", async () => {
  mocks.pathname = "/login"
  mocks.request.mockResolvedValue({ accent: "#0078D4" })
  await act(async () => root.render(<Harness />))
  await act(async () => { window.dispatchEvent(new Event("focus")) })
  await act(async () => save("#22C55E"))
  expect(apply).toHaveBeenLastCalledWith("#22C55E")
  expect(mocks.request).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
  mocks.pathname = "/dashboard"
  await act(async () => root.render(<Harness />))
  expect(apply).toHaveBeenLastCalledWith("#0078D4")
})
it("ignores a failed appearance load after returning to login", async () => {
  let reject!: (error: Error) => void
  mocks.request.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  await act(async () => root.render(<Harness />))
  mocks.pathname = "/login"
  await act(async () => root.render(<Harness />))
  await act(async () => reject(new Error("unauthorized")))
  expect(mocks.error).not.toHaveBeenCalled()
})
