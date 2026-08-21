import { afterEach, describe, expect, it, vi } from "vitest"

import { listEmployees } from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  })
}

describe("employee admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("keeps supported employee sort fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [{ id: 1, employee_no: "EMP-001" }],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await listEmployees("token", {
      page: 1,
      limit: 20,
      sortBy: "created_at",
      sortOrder: "DESC",
      search: "Ann",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees?page=1&limit=20&sortBy=created_at&sortOrder=DESC&search=Ann",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    )
  })

  it("drops unsupported employee sort fields such as sortValue", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [{ id: 1, employee_no: "EMP-001" }],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await listEmployees("token", {
      page: 1,
      limit: 20,
      sortBy: "sortValue",
      sortOrder: "DESC",
      search: "Ann",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees?page=1&limit=20&search=Ann",
      expect.objectContaining({
        method: "GET",
      }),
    )
  })
})
