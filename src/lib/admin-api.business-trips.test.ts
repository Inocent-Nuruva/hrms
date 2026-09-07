import { afterEach, describe, expect, it, vi } from "vitest"

import {
  approveAttendanceBusinessTrip,
  buildAttendanceBusinessTripPayload,
  createAttendanceBusinessTrip,
  rejectAttendanceBusinessTrip,
} from "./admin-api"

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("business trip API payloads", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("omits empty metadata and optional reason from create", () => {
    expect(
      buildAttendanceBusinessTripPayload({
        employee_id: 12,
        start_date: "2026-06-15",
        end_date: "2026-06-17",
        submit: true,
      }),
    ).toEqual({
      employee_id: 12,
      start_date: "2026-06-15",
      end_date: "2026-06-17",
      submit: true,
    })
  })

  it("creates a trip with only the documented fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 1 } }))
    vi.stubGlobal("fetch", fetchMock)

    await createAttendanceBusinessTrip("token", {
      employee_id: 12,
      start_date: "2026-06-15",
      end_date: "2026-06-17",
      reason: "Client visit in Arusha",
      submit: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/attendance/business-trips",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_id: 12,
          start_date: "2026-06-15",
          end_date: "2026-06-17",
          reason: "Client visit in Arusha",
          submit: true,
        }),
      }),
    )
  })

  it("approves and rejects with note, not comments", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await approveAttendanceBusinessTrip("token", 4, "Approved by HR")
    await rejectAttendanceBusinessTrip("token", 4, "Dates clash")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/attendance/business-trips/4/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ note: "Approved by HR" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/attendance/business-trips/4/reject",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ note: "Dates clash" }),
      }),
    )
  })
})
