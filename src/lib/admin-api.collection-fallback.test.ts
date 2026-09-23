import { afterEach, describe, expect, it, vi } from "vitest"

import { listAttendanceDevices, listShiftResources } from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("admin API collection fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("retries shift collections without query params when the paged response is empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total: 1,
          items: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 7, name: "Morning Shift", code: "MORNING" }],
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listShiftResources("token", "shifts", {
      page: 1,
      limit: 100,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/attendance/schedule-definitions/shifts?page=1&limit=100",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/attendance/schedule-definitions/shifts",
      expect.objectContaining({ method: "GET" }),
    )
    expect(result.rows).toEqual([
      expect.objectContaining({ id: 7, name: "Morning Shift", code: "MORNING" }),
    ])
  })

  it("does not drop an explicit shift search when the filtered response is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        total: 0,
        items: [],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listShiftResources("token", "shifts", {
      page: 1,
      limit: 100,
      search: "night",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/attendance/schedule-definitions/shifts?page=1&limit=100&search=night",
      expect.objectContaining({ method: "GET" }),
    )
    expect(result.rows).toEqual([])
  })

  it("retries attendance devices without query params when the first page comes back empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          total: 1,
          items: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 11, device_name: "Main Gate Terminal", ip_address: "192.168.1.30" }],
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listAttendanceDevices("token", {
      page: 1,
      limit: 20,
      sortBy: "created_at",
      sortOrder: "DESC",
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/attendance/devices?page=1&limit=20&sortBy=created_at&sortOrder=DESC",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/attendance/devices",
      expect.objectContaining({ method: "GET" }),
    )
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 11,
        device_name: "Main Gate Terminal",
        ip_address: "192.168.1.30",
      }),
    ])
  })
})
