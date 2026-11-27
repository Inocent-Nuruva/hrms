// @vitest-environment jsdom
import * as React from "react"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getAttendanceCleanupSettings: vi.fn(),
  updateAttendanceCleanupSettings: vi.fn(),
  getAttendanceCleanupOverview: vi.fn(),
}))
vi.mock("@/lib/admin-api", () => api)
import { AttendanceCleanupSettingsPanel } from "./attendance-cleanup-settings"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let host: HTMLDivElement
let root: Root
const initial = { recalculationJobs: false, unmatchedLogs: false, expiredSignInRequests: false, notificationQueue: false, importQueue: false, queueRetentionDays: 30 }

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  api.getAttendanceCleanupSettings.mockResolvedValue(initial)
  api.updateAttendanceCleanupSettings.mockImplementation(async (_token, settings) => settings)
  api.getAttendanceCleanupOverview.mockResolvedValue({
    storage: [{ type: "recalculationJobs", count: 5, bytes: "4096" }],
    preview: [{ type: "recalculationJobs", count: 2, bytes: "2048" }],
    history: [],
  })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("attendance cleanup settings", () => {
  it("loads company settings and saves the chosen cleanup", async () => {
    await act(async () => { root.render(<AttendanceCleanupSettingsPanel token="company-token" />) })
    expect(api.getAttendanceCleanupSettings).toHaveBeenCalledWith("company-token")
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(checkbox.checked).toBe(false)
    await act(async () => checkbox.click())
    const save = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Save settings"))!
    await act(async () => save.click())
    expect(api.updateAttendanceCleanupSettings).toHaveBeenCalledWith("company-token", { ...initial, recalculationJobs: true })
    expect(host.textContent).toContain("Settings saved for your company")
  })

  it("shows the company storage preview and eligible counts", async () => {
    await act(async () => { root.render(<AttendanceCleanupSettingsPanel token="company-token" />) })
    const preview = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("Preview and view history"))!
    await act(async () => preview.click())
    expect(api.getAttendanceCleanupOverview).toHaveBeenCalledWith("company-token")
    expect(host.textContent).toContain("4.0 KB")
    expect(host.textContent).toContain("2.0 KB")
    expect(host.textContent).toContain("No runs recorded yet")
  })
})
