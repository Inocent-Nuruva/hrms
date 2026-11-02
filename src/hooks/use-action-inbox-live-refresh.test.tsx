// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ACTION_INBOX_CHANGED } from "@/lib/employee-lifecycle-events"
import { useActionInboxLiveRefresh } from "./use-action-inbox-live-refresh"

vi.mock("@/lib/notifications-store", () => ({ useNotifications: () => ({}) }))

function Probe({ refresh, busy }: { refresh: () => Promise<void>; busy: boolean }) {
  useActionInboxLiveRefresh(refresh, busy)
  return null
}

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("action inbox live refresh", () => {
  it("refreshes after the inbox changes and waits while a submission is in progress", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    await act(async () => root.render(<Probe refresh={refresh} busy={false} />))
    await act(async () => { window.dispatchEvent(new Event(ACTION_INBOX_CHANGED)) })
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(refresh).toHaveBeenCalledTimes(1)

    refresh.mockClear()
    await act(async () => root.render(<Probe refresh={refresh} busy />))
    await act(async () => { window.dispatchEvent(new Event(ACTION_INBOX_CHANGED)) })
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(refresh).not.toHaveBeenCalled()
  })
})
