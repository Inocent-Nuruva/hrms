import { afterEach, describe, expect, it, vi } from "vitest"

import {
  activateCompany,
  assignDepartmentPosition,
  downloadEmployeeDocument,
  getCompanyById,
  getCompanyModules,
  getCurrentCompanyOnboardingStatus,
  getMyCompany,
  grantDepartmentAccess,
  probePlatformCompaniesList,
  listDepartmentAccess,
  removeDepartmentPosition,
  revokeDepartmentAccess,
  suspendCompany,
  updateCompanyById,
  updateCompanyModules,
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

describe("foundation admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads a company by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 9,
          company_name: "Alliance East",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getCompanyById("token", 9)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies/9",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 9,
        company_name: "Alliance East",
      })
    )
  })

  it("updates a company by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await updateCompanyById("token", 9, { company_name: "Alliance HQ" })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies/9",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ company_name: "Alliance HQ" }),
      })
    )
  })

  it("loads split company role and permission modules from a data envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          roles: true,
          permissions: false,
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getCompanyModules("token", 4)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies/4/modules",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        roles: true,
        permissions: false,
      }),
    )
  })

  it("loads split company modules from a first-class roles/permissions body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        roles: false,
        permissions: false,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getCompanyModules("token", 4)

    expect(result).toEqual(
      expect.objectContaining({
        roles: false,
        permissions: false,
      }),
    )
  })

  it("updates split company role and permission modules", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          roles: true,
          permissions: false,
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await updateCompanyModules("token", 4, {
      roles: true,
      permissions: false,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies/4/modules",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          roles: true,
          permissions: false,
        }),
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        roles: true,
        permissions: false,
      }),
    )
  })

  it("activates and suspends companies with dedicated endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await activateCompany("token", 4)
    await suspendCompany("token", 4)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/companies/4/activate",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/companies/4/suspend",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("reads the current company from GET /api/companies/my without picking nested users", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 4,
          company_name: "Alliance Insurance",
          company_slug: "alliance",
          users: [{ id: 71, email: "manager@example.com" }],
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getMyCompany("token")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies/my",
      expect.objectContaining({ method: "GET" }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 4,
        company_name: "Alliance Insurance",
        company_slug: "alliance",
      }),
    )
  })

  it("treats a platform-scope denial on GET /api/companies as a 403", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: "Platform access is required" }, { status: 403 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(probePlatformCompaniesList("token")).rejects.toMatchObject({
      message: "Platform access is required",
      status: 403,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("treats a 200 platform-denial envelope on GET /api/companies as a 403", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, message: "Platform access is required" }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(probePlatformCompaniesList("token")).rejects.toMatchObject({
      message: "Platform access is required",
      status: 403,
    })
  })

  it("loads current company onboarding status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 12,
          setup_complete: false,
          completed_steps: ["company_profile", "branches"],
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getCurrentCompanyOnboardingStatus("token")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/companies/current/onboarding-status",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 12,
        setup_complete: false,
      })
    )
  })

  it("lists department access assignments", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            user_id: 71,
            email: "manager@example.com",
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listDepartmentAccess("token", 3)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/departments/3/access",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(result).toEqual([
      expect.objectContaining({
        user_id: 71,
      }),
    ])
  })

  it("grants and revokes department access by user id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await grantDepartmentAccess("token", 3, 71)
    await revokeDepartmentAccess("token", 3, 71)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/departments/3/access/71",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/departments/3/access/71",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("assigns and removes a position on a department", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { position_id: 12 } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await assignDepartmentPosition("token", 3, 12)
    await removeDepartmentPosition("token", 3, 12)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/departments/3/positions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ position_id: 12 }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/departments/3/positions/12",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("downloads an employee document from the HR file endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["file"], { type: "application/pdf" }), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="id-scan.pdf"',
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await downloadEmployeeDocument("token", 39, 8)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/employees/39/documents/8/download",
      expect.objectContaining({ method: "GET" }),
    )
    expect(result.filename).toBe("id-scan.pdf")
    expect(result.contentType).toBe("application/pdf")
  })
})
