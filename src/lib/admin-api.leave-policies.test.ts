import { afterEach, describe, expect, it, vi } from "vitest"

import { getLeavePolicy } from "./admin-api"

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

describe("getLeavePolicy", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads a policy by id and keeps sibling leave_types", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 7,
          name: "Staff leave rules",
          accrual_method: "yearly",
        },
        leave_types: [{ leave_type_id: 4, annual_quota_days: 21 }],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const policy = await getLeavePolicy("token", 7)

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/leave/policies/7")
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ method: "GET" }))
    expect(policy).toEqual(
      expect.objectContaining({
        id: 7,
        name: "Staff leave rules",
        leave_types: [{ leave_type_id: 4, annual_quota_days: 21 }],
      }),
    )
  })

  it("does not peel a full policy down to a nested branch or leave type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 7,
          name: "Staff leave rules",
          accrual_method: "yearly",
          applicable_branch: { id: 3, name: "HQ" },
          leave_types: [{ leave_type_id: 4, annual_quota_days: 21, leave_type: { id: 4, name: "Annual" } }],
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const policy = await getLeavePolicy("token", 7)

    expect(policy).toEqual(
      expect.objectContaining({
        id: 7,
        name: "Staff leave rules",
        accrual_method: "yearly",
        leave_types: [expect.objectContaining({ leave_type_id: 4 })],
      }),
    )
  })
})
