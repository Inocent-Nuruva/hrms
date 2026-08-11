import { afterEach, describe, expect, it, vi } from "vitest"

import {
  activateCompany,
  getCompanyById,
  getCurrentCompanyOnboardingStatus,
  grantDepartmentAccess,
  listDepartmentAccess,
  revokeDepartmentAccess,
  suspendCompany,
  updateCompanyById,
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
      "http://localhost:8888/api/companies/9",
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
      "http://localhost:8888/api/companies/9",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ company_name: "Alliance HQ" }),
      })
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
      "http://localhost:8888/api/companies/4/activate",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/companies/4/suspend",
      expect.objectContaining({ method: "POST" })
    )
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
      "http://localhost:8888/api/companies/current/onboarding-status",
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
      "http://localhost:8888/api/departments/3/access",
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
      "http://localhost:8888/api/departments/3/access/71",
      expect.objectContaining({ method: "POST" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/departments/3/access/71",
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
