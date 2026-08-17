import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getRoleById,
  listResource,
  listResourcePage,
  listRolePermissions,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  })
}

function throttleResponse(retryAfter = "0") {
  return new Response(JSON.stringify({ message: "ThrottlerException: Too Many Requests" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": retryAfter,
    },
  })
}

describe("roles and permissions admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("pages GET /api/roles until the last page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 1, name: "COMPANY_ADMIN" }],
          meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 2, name: "COMPANY_USER" }],
          meta: { page: 2, limit: 1, total: 2, totalPages: 2 },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listResource("roles", "token-roles-page", {
      pageSize: 1,
      cacheTtlMs: 0,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:8888/api/roles?page=1&limit=1",
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://localhost:8888/api/roles?page=2&limit=1",
    )
    expect(rows.map((row) => row.name)).toEqual(["COMPANY_ADMIN", "COMPANY_USER"])
  })

  it("retries a throttled GET /api/permissions and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(throttleResponse("0"))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: 10, name: "roles:read" }],
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listResource("permissions", "token-permissions-retry", {
      pageAll: false,
      cacheTtlMs: 0,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:8888/api/permissions")
    expect(rows).toEqual([expect.objectContaining({ id: 10, name: "roles:read" })])
  })

  it("normalizes a permission catalog returned as name strings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: ["roles:read", "permissions:read", "users:update"],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listResource("permissions", "token-permissions-strings", {
      pageAll: false,
      cacheTtlMs: 0,
    })

    expect(rows.map((row) => row.name)).toEqual([
      "roles:read",
      "permissions:read",
      "users:update",
    ])
  })

  it("surfaces a throttle message after GET retries are exhausted", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(throttleResponse("0")))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      listResource("roles", "token-roles-throttle", {
        pageAll: false,
        cacheTtlMs: 0,
      }),
    ).rejects.toMatchObject({
      status: 429,
      message: "Too many requests. Please wait a moment and try again.",
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("loads one backend page of permissions without walking the rest", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [{ id: 10, name: "roles:read" }],
          page: 1,
          limit: 20,
          total: 477,
          totalPages: 24,
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listResourcePage("permissions", "token-permissions-page", {
      page: 1,
      limit: 20,
      search: "roles",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/permissions?page=1&limit=20&search=roles",
      expect.objectContaining({ method: "GET" }),
    )
    expect(result.rows).toEqual([expect.objectContaining({ name: "roles:read" })])
    expect(result.total).toBe(477)
    expect(result.totalPages).toBe(24)
  })

  it("loads a role's permissions with a single request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: 1, name: "roles:read" }],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listRolePermissions("token-role-permissions", 4, {
      cacheTtlMs: 0,
      pageSize: 100,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:8888/api/roles/4/permissions?page=1&limit=100",
    )
    expect(rows.map((row) => row.name)).toEqual(["roles:read"])
  })

  it("loads a single role by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { id: 4, name: "HR_MANAGER", display_name: "HR Manager" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const role = await getRoleById(4, "token-role-by-id")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/roles/4",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-role-by-id",
        }),
      }),
    )
    expect(role).toEqual(
      expect.objectContaining({
        id: 4,
        name: "HR_MANAGER",
      }),
    )
  })
})
