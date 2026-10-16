import { afterEach, describe, expect, it, vi } from "vitest"

import { adjustLeaveBalance, listAllLeaveBalances, listMyLeaveBalances } from "./admin-api"

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("listAllLeaveBalances", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("walks every page so grouping is not limited to the first 100 leave-type rows", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      employee_id: Math.floor(index / 12) + 1,
      employee_name: `Employee ${Math.floor(index / 12) + 1}`,
    }))
    const secondPage = Array.from({ length: 20 }, (_, index) => ({
      id: 101 + index,
      employee_id: Math.floor((100 + index) / 12) + 1,
      employee_name: `Employee ${Math.floor((100 + index) / 12) + 1}`,
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: firstPage, meta: { page: 1, limit: 100, total: 120, totalPages: 2 } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: secondPage, meta: { page: 2, limit: 100, total: 120, totalPages: 2 } }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listAllLeaveBalances("token")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/leave/balances")
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("page=1")
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("page=2")
    expect(result.rows).toHaveLength(120)
    expect(result.total).toBe(120)
  })

  it("sends only the adjust DTO fields the API accepts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await adjustLeaveBalance("token", {
      employee_id: 9,
      leave_type_id: 4,
      fiscal_year: "2026",
      mode: "SET",
      amount: 3,
      reason: "Correction after review",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/leave/balances/adjust",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          employee_id: 9,
          leave_type_id: 4,
          fiscal_year: "2026",
          mode: "SET",
          amount: 3,
          reason: "Correction after review",
        }),
      }),
    )
  })
})

describe("listMyLeaveBalances", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("flattens the employee-grouped self-service response into leave-type balances", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: [{
        id: 12,
        employee_id: 12,
        employee_name: "Amina Example",
        leave_balances: [{
          id: 91,
          leave_type_id: 4,
          leave_type_name: "Annual leave",
          fiscal_year: "2026",
          allocated_days: "28.00",
          used_days: "5.00",
          pending_days: "2.00",
          carried_forward_days: "0.00",
          expired_days: "0.00",
          available_days: "21.00",
        }],
      }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      current_fiscal_year: "2026",
      totals: { allocated_days: 28, used_days: 5, pending_days: 2, available_days: 21 },
    }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await listMyLeaveBalances("token", { page: 1, limit: 100 })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      employee_id: 12,
      employee_name: "Amina Example",
      leave_type_name: "Annual leave",
      allocated_days: "28.00",
      available_days: "21.00",
    })
    expect(result.totals?.available_days).toBe(21)
  })
})
