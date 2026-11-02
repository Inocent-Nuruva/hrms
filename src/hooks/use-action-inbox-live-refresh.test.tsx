// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ACTION_INBOX_CHANGED } from "@/lib/employee-lifecycle-events"
import { useActionInboxLiveRefresh } from "./use-action-inbox-live-refresh"
vi.mock("@/lib/notifications-store", () => ({ useNotifications: () => ({}) }))
let root: Root
const refresh = vi.fn<() => Promise<void>>()
function Harness({ busy = false }: { busy?: boolean }) {
  useActionInboxLiveRefresh(refresh, busy)
  return null
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.useFakeTimers()
  refresh.mockReset().mockResolvedValue()
  root = createRoot(document.createElement("div"))
})
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers() })
it("coalesces multiple websocket changes into one refresh", async () => {
  await act(async () => root.render(<Harness />))
  window.dispatchEvent(new Event(ACTION_INBOX_CHANGED))
  window.dispatchEvent(new Event(ACTION_INBOX_CHANGED))
  await act(async () => vi.advanceTimersByTimeAsync(400))
  expect(refresh).toHaveBeenCalledTimes(1)
})
it("waits until an in-flight user action finishes", async () => {
  await act(async () => root.render(<Harness busy />))
  window.dispatchEvent(new Event(ACTION_INBOX_CHANGED))
  await act(async () => vi.advanceTimersByTimeAsync(400))
  expect(refresh).not.toHaveBeenCalled()
  await act(async () => root.render(<Harness />))
  await act(async () => vi.advanceTimersByTimeAsync(400))
  expect(refresh).toHaveBeenCalledTimes(1)
})
it("refreshes again when another update arrives during a load", async () => {
  let resolve!: () => void
  refresh.mockImplementationOnce(() => new Promise<void>(r => { resolve = r }))
  await act(async () => root.render(<Harness />))
  window.dispatchEvent(new Event(ACTION_INBOX_CHANGED))
  await act(async () => vi.advanceTimersByTimeAsync(400))
  window.dispatchEvent(new Event(ACTION_INBOX_CHANGED))
  await act(async () => vi.advanceTimersByTimeAsync(400))
  expect(refresh).toHaveBeenCalledTimes(1)
  await act(async () => resolve())
  await act(async () => vi.advanceTimersByTimeAsync(400))
  expect(refresh).toHaveBeenCalledTimes(2)
})
