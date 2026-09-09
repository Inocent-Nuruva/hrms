import { afterEach, describe, expect, it, vi } from "vitest"

import {
  acceptEmployeeInvitation,
  archiveEmployeeProfile,
  createEmployeeInvitation,
  createEmployeeProfile,
  getPublicEmployeeInvitation,
  listEmployees,
  patchEmployeeStatus,
  removeEmployeeLinkedAccount,
  unlinkEmployeeCompanyUser,
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

describe("employee admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("archives an employee through the documented DELETE endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("", { status: 200 })))
    vi.stubGlobal("fetch", fetchMock)

    await archiveEmployeeProfile("token", 156)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees/156",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    )
  })

  it("supports unlinking and removing linked employee account access", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("", { status: 200 })))
    vi.stubGlobal("fetch", fetchMock)

    await unlinkEmployeeCompanyUser("token", 156)
    await removeEmployeeLinkedAccount("token", 157)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/employees/156/company-user",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/employees/157/company-user/account",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("creates an employee invitation for email and SMS delivery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { id: 44, status: "pending" } }, { status: 201 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await createEmployeeInvitation("token", {
      first_name: "Amina",
      last_name: "Moshi",
      gender: "female",
      email: "amina@example.com",
      phone: "+255712345678",
      primary_branch_id: 2,
      primary_department_id: 5,
      primary_position_id: 9,
      employment_type: "full_time",
      onboarding_workflow_id: 3,
      channels: ["EMAIL", "SMS"],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employee-invitations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
        body: JSON.stringify({
          first_name: "Amina",
          last_name: "Moshi",
          gender: "female",
          email: "amina@example.com",
          phone: "+255712345678",
          primary_branch_id: 2,
          primary_department_id: 5,
          primary_position_id: 9,
          employment_type: "full_time",
          onboarding_workflow_id: 3,
          channels: ["EMAIL", "SMS"],
        }),
      }),
    )
  })

  it("loads and accepts a public employee invitation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            first_name: "Amina",
            email: "amina@example.com",
            company_name: "Alliance",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { status: "accepted", login_url: "/login" } }),
      )
    vi.stubGlobal("fetch", fetchMock)

    await getPublicEmployeeInvitation("invite token")
    await acceptEmployeeInvitation("invite token", "StrongPass#2026")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/employee-invitations/accept/invite%20token",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/employee-invitations/accept/invite%20token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "StrongPass#2026" }),
      }),
    )
  })

  it("requests inactive employees with the supported lifecycle filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await listEmployees("token", { page: 1, limit: 20, employment_status: "inactive" })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees?page=1&limit=20&employment_status=inactive",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("sends optional exit details for a terminated employee", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 156 }))
    vi.stubGlobal("fetch", fetchMock)

    await patchEmployeeStatus("token", 156, {
      employment_status: "terminated",
      effective_date: "2026-09-09",
      exit_date: "2026-09-09",
      exit_reason: "Contract ended",
      notes: "Approved termination",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees/156/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          employment_status: "terminated",
          effective_date: "2026-09-09",
          notes: "Approved termination",
          exit_date: "2026-09-09",
          exit_reason: "Contract ended",
        }),
      }),
    )
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
      "http://localhost:8888/api/employees",
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
      "http://localhost:8888/api/employees",
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
      "http://localhost:8888/api/employees",
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
      "http://localhost:8888/api/employees",
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
      "http://localhost:8888/api/employees",
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
      "http://localhost:8888/api/employees",
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

  it("recovers the existing employee when create fails after a missing-approver 400", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url)
      const method = (init?.method ?? "GET").toUpperCase()
      if (method === "POST" && href.endsWith("/api/employees")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          onboarding?: { submit?: boolean }
        }
        if (body.onboarding?.submit !== false) {
          return jsonResponse(
            {
              statusCode: 400,
              message: "Required workflow step at order 1 has no eligible approver",
            },
            { status: 400 },
          )
        }
        return jsonResponse(
          {
            statusCode: 409,
            message: "This company user already has an employee profile",
          },
          { status: 409 },
        )
      }
      return jsonResponse({
        data: {
          items: [
            {
              id: 91,
              first_name: "New",
              last_name: "Employee",
              email: "new.employee@example.com",
              contacts: [{ email: "new.employee@example.com", is_primary: true }],
            },
          ],
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      first_name: "New",
      last_name: "Employee",
      contacts: [{ email: "new.employee@example.com", is_primary: true }],
      onboarding: {
        auto_start: true,
        submit: true,
        workflow_id: 1,
      },
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 91,
        first_name: "New",
        last_name: "Employee",
      }),
    )
  })

  it("keeps a 201 employee id when onboarding is saved as a draft with a warning", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          id: 88,
          employee_no: "AICL/00088",
          warning: "Required workflow step at order 1 has no eligible approver",
          onboarding_request: { id: 12, status: "draft" },
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      first_name: "New",
      last_name: "Employee",
      onboarding: { auto_start: true, submit: true, workflow_id: 1 },
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 88,
        warning: "Required workflow step at order 1 has no eligible approver",
        onboarding_request: expect.objectContaining({ id: 12, status: "draft" }),
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("uses the employee id from a duplicate-profile 409 instead of creating again", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          statusCode: 409,
          message: "This company user already has an employee profile",
          employee_id: 91,
          employee: {
            id: 91,
            first_name: "New",
            last_name: "Employee",
            employee_no: "AICL/00091",
          },
        },
        { status: 409 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      first_name: "New",
      last_name: "Employee",
      contacts: [{ email: "new.employee@example.com", is_primary: true }],
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 91,
        employee_no: "AICL/00091",
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("unwraps a nested employee id from the create envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          company_user: { id: 5, email: "new.employee@example.com" },
          employee: {
            id: 77,
            employee_no: "AICL/00077",
            first_name: "Nested",
            last_name: "Person",
          },
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const created = await createEmployeeProfile("token", {
      first_name: "Nested",
      last_name: "Person",
    })

    expect(created).toEqual(
      expect.objectContaining({
        id: 77,
        employee_no: "AICL/00077",
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

  it("explains which people own the email and phone on a 409 contact conflict", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url)
      const method = (init?.method ?? "GET").toUpperCase()
      if (method === "POST" && href.endsWith("/api/employees")) {
        return jsonResponse(
          {
            statusCode: 409,
            message: "Email and phone belong to different existing users",
          },
          { status: 409 },
        )
      }
      if (href.includes("/api/companies/current/users")) {
        return jsonResponse({
          data: {
            items: [
              {
                id: 7,
                first_name: "Pat",
                last_name: "Lee",
                email: "pat.lee@company.com",
                phone: "0712349999",
              },
            ],
            page: 1,
            limit: 100,
            total: 1,
            totalPages: 1,
          },
        })
      }
      return jsonResponse({
        data: {
          items: [
            {
              id: 12,
              first_name: "Jane",
              last_name: "Doe",
              employee_no: "AICL/00012",
              email: "jane.doe@company.com",
              contacts: [{ email: "jane.doe@company.com", phone_number: "+255700000000" }],
            },
          ],
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
        },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      createEmployeeProfile("token", {
        first_name: "New",
        last_name: "Employee",
        contacts: [
          {
            email: "jane.doe@company.com",
            phone_number: "0712349999",
          },
        ],
      }),
    ).rejects.toThrow(
      /Email jane.doe@company.com is already used by Jane Doe \(employee AICL\/00012\). Phone 0712349999 is already used by Pat Lee \(company user, no employee profile\)/i,
    )
  })
})
