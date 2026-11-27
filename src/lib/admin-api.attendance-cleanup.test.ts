import { afterEach, describe, expect, it, vi } from "vitest"
import { getAttendanceCleanupSettings, getAttendanceCleanupOverview, updateAttendanceCleanupSettings } from "./admin-api"

describe("attendance cleanup API", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  it("loads settings and preview and saves company settings with authentication", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: {} }), { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const settings = { recalculationJobs: true, unmatchedLogs: false, expiredSignInRequests: false, notificationQueue: true, importQueue: false, queueRetentionDays: 30 }

    await getAttendanceCleanupSettings("cleanup-token")
    await getAttendanceCleanupOverview("cleanup-token")
    await updateAttendanceCleanupSettings("cleanup-token", settings)

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8888/api/attendance/processing/cleanup-settings", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer cleanup-token" }) }))
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8888/api/attendance/processing/cleanup-preview", expect.objectContaining({ method: "GET" }))
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8888/api/attendance/processing/cleanup-settings", expect.objectContaining({ method: "PUT", body: JSON.stringify(settings) }))
  })
})
