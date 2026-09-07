import { afterEach, describe, expect, it, vi } from "vitest"

import { createEmployeeProfile, listEmployees } from "./admin-api"

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
      "http://localhost:9999/api/employees?page=1&limit=20&sortBy=created_at&sortOrder=DESC&search=Ann",
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
      "http://localhost:9999/api/employees?page=1&limit=20&search=Ann",
      expect.objectContaining({
        method: "GET",
      }),
    )
  })

  it("omits an auto-filled current employee number when creating a new employee", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 44,
          employee_no: "AICL/00044",
        },
      }),
    )
    const localStorageMock = {
      getItem: vi.fn((key: string) =>
        key === "ess.auth.user"
          ? JSON.stringify({
              user_no: "AICL/00042",
              employee: {
                employee_no: "AICL/00042",
              },
            })
          : null,
      ),
    }
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("window", { localStorage: localStorageMock })

    await createEmployeeProfile("token", {
      employee_no: "AICL/00042",
      first_name: "New",
      last_name: "Employee",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          first_name: "New",
          last_name: "Employee",
        }),
      }),
    )
  })

  it("surfaces employee create validation errors instead of generic bad request", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(
        {
          statusCode: 400,
          message: "Bad Request",
          errors: {
            validation: [
              {
                property: "first_name",
                constraints: {
                  isNotEmpty: "first_name should not be empty",
                },
              },
              {
                property: "employee_no",
                constraints: {
                  isUnique: "employee number already exists",
                },
              },
            ],
          },
        },
        { status: 400 },
      )),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createEmployeeProfile("token", {
        employee_no: "AICL/00042",
        first_name: "",
        last_name: "Employee",
      }),
    ).rejects.toThrow(
      "first_name: first_name should not be empty. employee_no: employee number already exists",
    )
  })

  it("retries employee create without a duplicate employee number", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 409,
            message: 'duplicate key value violates unique constraint "UQ_employee_company_employee_no"',
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 45,
            employee_no: "AICL/00045",
          },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      employee_no: "AICL/00001",
      first_name: "New",
      last_name: "Employee",
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 45,
        employee_no: "AICL/00045",
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_no: "AICL/00001",
          first_name: "New",
          last_name: "Employee",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          first_name: "New",
          last_name: "Employee",
        }),
      }),
    )
  })

  it("allocates the next unused employee number when auto-assign collides", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url)
      const method = (init?.method ?? "GET").toUpperCase()
      if (method === "POST" && href.endsWith("/api/employees")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          employee_no?: string
        }
        if (body.employee_no === "AICL00044") {
          return jsonResponse({
            data: {
              id: 44,
              employee_no: "AICL00044",
            },
          })
        }
        return jsonResponse(
          {
            statusCode: 500,
            message: "UQ_employee_company_employee_no",
          },
          { status: 500 },
        )
      }
      if (href.includes("/api/employee-numbering")) {
        return jsonResponse({
          data: {
            prefix: "AICL",
            padding: 5,
            next_number: 44,
          },
        })
      }
      if (href.includes("sortBy=employee_no")) {
        return jsonResponse({
          data: {
            items: [{ id: 43, employee_no: "AICL00043" }],
            page: 1,
            limit: 1,
            total: 43,
            totalPages: 43,
          },
        })
      }
      if (href.includes("search=AICL00044")) {
        return jsonResponse({
          data: {
            items: [],
            page: 1,
            limit: 5,
            total: 0,
            totalPages: 0,
          },
        })
      }
      return jsonResponse({
        data: {
          items: [],
          page: 1,
          limit: 5,
          total: 0,
          totalPages: 0,
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      first_name: "New",
      last_name: "Employee",
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 44,
        employee_no: "AICL00044",
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          first_name: "New",
          last_name: "Employee",
          employee_no: "AICL00044",
        }),
      }),
    )
  })

  it("saves the employee without submitting onboarding when a required step has no approver", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            statusCode: 400,
            message: "Required workflow step at order 1 has no eligible approver",
          },
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 88,
            employee_no: "AICL/00088",
          },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      first_name: "New",
      last_name: "Employee",
      onboarding: {
        auto_start: true,
        submit: true,
        workflow_id: 1,
      },
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 88,
        employee_no: "AICL/00088",
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          first_name: "New",
          last_name: "Employee",
          onboarding: {
            auto_start: true,
            submit: true,
            workflow_id: 1,
          },
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          first_name: "New",
          last_name: "Employee",
          onboarding: {
            auto_start: true,
            submit: false,
            workflow_id: 1,
          },
        }),
      }),
    )
  })

  it("surfaces a unique employee-number constraint as a readable error", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(
          {
            statusCode: 409,
            message: "UQ_employee_company_employee_no",
          },
          { status: 409 },
        ),
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createEmployeeProfile("token", {
        employee_no: "AICL/00001",
        first_name: "New",
        last_name: "Employee",
      }),
    ).rejects.toThrow(
      "That employee number is already in use. Leave Employee Number blank to auto-assign the next number, or enter a unique number.",
    )
  })
})
