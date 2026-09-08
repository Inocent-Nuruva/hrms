import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getShiftResourceById,
  listShiftResources,
  patchShiftResourceById,
} from "./admin-api"

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("attendance schedule API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("normalizes listed shift entity fields to the DTO field names", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 17,
            name: "Day Shift",
            branchId: 2,
            shiftType: "FIXED",
            startTime: "09:02:00",
            expectedWorkMinutes: 360,
            allowEarlyCheckin: true,
          },
        ],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listShiftResources("token", "shifts", {
      page: 1,
      limit: 100,
    })

    expect(result.rows).toEqual([
      {
        id: 17,
        name: "Day Shift",
        branch_id: 2,
        shift_type: "FIXED",
        start_time: "09:02:00",
        expected_work_minutes: 360,
        allow_early_checkin: true,
      },
    ])
  })

  it("normalizes a shift before it is used to prefill the edit form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 17,
          name: "Day Shift",
          code: "DAY",
          departmentId: 4,
          endTime: "17:02:00",
          minimumWorkMinutes: 180,
          isNightShift: false,
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getShiftResourceById("token", "shifts", 17)

    expect(result).toEqual({
      id: 17,
      name: "Day Shift",
      code: "DAY",
      department_id: 4,
      end_time: "17:02:00",
      minimum_work_minutes: 180,
      is_night_shift: false,
    })
  })

  it("sends only the DTO-shaped fields supplied for a shift update", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 17 } }))
    vi.stubGlobal("fetch", fetchMock)

    await patchShiftResourceById("token", "shifts", 17, {
      name: "Day Shift",
      start_time: "09:02",
      expected_work_minutes: 360,
      allow_early_checkin: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/attendance/schedule-definitions/shifts/17",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Day Shift",
          start_time: "09:02",
          expected_work_minutes: 360,
          allow_early_checkin: true,
        }),
      }),
    )
  })
})
