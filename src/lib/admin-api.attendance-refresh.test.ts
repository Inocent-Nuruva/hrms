import { afterEach, describe, expect, it, vi } from "vitest"

import {
  rebuildAttendanceDailySummaries,
  refreshAttendanceDailySummaries,
} from "./admin-api"

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("attendance daily summary refresh API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("posts the canonical refresh payload to the daily summaries refresh endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { processed: 3 } }))
    vi.stubGlobal("fetch", fetchMock)

    await refreshAttendanceDailySummaries("token", {
      start_date: "2026-08-01",
      end_date: "2026-08-03",
      employee_id: 101,
      processing_source: "database_only",
      execution_mode: "immediate",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/attendance/daily-summaries/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        }),
        body: JSON.stringify({
          start_date: "2026-08-01",
          end_date: "2026-08-03",
          employee_id: 101,
          processing_source: "database_only",
          execution_mode: "immediate",
        }),
      }),
    )
  })

  it("keeps the legacy rebuild helper mapped to the refresh endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { queued: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await rebuildAttendanceDailySummaries("token", {
      start_date: "2026-08-01",
      end_date: "2026-08-03",
      mode: "from_raw_logs",
      execution: "async",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/attendance/daily-summaries/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          start_date: "2026-08-01",
          end_date: "2026-08-03",
          mode: "from_raw_logs",
          execution: "async",
        }),
      }),
    )
  })
})
