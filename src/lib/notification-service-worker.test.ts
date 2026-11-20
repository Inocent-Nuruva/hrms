import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

type WorkerEvent = { data?: { json: () => unknown }; notification?: { data?: { url?: string }; close: () => void }; waitUntil: (work: Promise<unknown>) => void }

function workerHarness(clients: Array<{ url: string; focused: boolean; postMessage: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }>) {
  const handlers = new Map<string, (event: WorkerEvent) => void>()
  const showNotification = vi.fn(async () => undefined)
  const openWindow = vi.fn(async () => undefined)
  const self = {
    location: { href: "http://localhost:3000/sw.js?dev=1", origin: "http://localhost:3000" },
    clients: { matchAll: vi.fn(async () => clients), openWindow },
    registration: { showNotification },
    addEventListener: (name: string, handler: (event: WorkerEvent) => void) => handlers.set(name, handler),
  }
  const source = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8")
  runInNewContext(source, { self, URL, caches: {}, fetch: vi.fn(), Response })
  async function dispatch(name: string, data: Partial<WorkerEvent>) {
    let work: Promise<unknown> | undefined
    handlers.get(name)?.({ ...data, waitUntil: (promise) => { work = promise } })
    await work
  }
  return { dispatch, showNotification, openWindow }
}

describe("browser push notification routing", () => {
  it("shows the app popup when a tab is focused", async () => {
    const focused = { url: "http://localhost:3000/dashboard", focused: true, postMessage: vi.fn(), navigate: vi.fn(), focus: vi.fn() }
    const worker = workerHarness([focused])
    await worker.dispatch("push", { data: { json: () => ({ id: 42, title: "Leave approved", body: "Your request was approved", actionUrl: "/dashboard/leave" }) } })
    expect(focused.postMessage).toHaveBeenCalledWith({
      type: "hrms:web-push",
      notification: { id: 42, title: "Leave approved", message: "Your request was approved", action_url: "/dashboard/leave" },
    })
    expect(worker.showNotification).not.toHaveBeenCalled()
  })

  it("shows a system alert when the app is minimized or closed", async () => {
    for (const clients of [
      [{ url: "http://localhost:3000/dashboard", focused: false, postMessage: vi.fn(), navigate: vi.fn(), focus: vi.fn() }],
      [],
    ]) {
      const worker = workerHarness(clients)
      await worker.dispatch("push", { data: { json: () => ({ id: 43, title: "New task", body: "Please review", actionUrl: "https://external.example/path" }) } })
      expect(worker.showNotification).toHaveBeenCalledWith("New task", expect.objectContaining({
        body: "Please review",
        data: { url: "/dashboard" },
      }))
    }
  })

  it("opens the alert destination when the app was closed", async () => {
    const worker = workerHarness([])
    const close = vi.fn()
    await worker.dispatch("notificationclick", { notification: { data: { url: "/dashboard/leave" }, close } })
    expect(close).toHaveBeenCalled()
    expect(worker.openWindow).toHaveBeenCalledWith("http://localhost:3000/dashboard/leave")
  })
})
