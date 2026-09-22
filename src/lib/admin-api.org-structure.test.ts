import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createBranch,
  createCostCenter,
  createEmployeePosition,
  deleteBranch,
  deleteCostCenter,
  deleteEmployeePosition,
  getCostCenter,
  getEmployeePosition,
  grantBranchAccess,
  listBranchAccess,
  listCostCenters,
  listEmployeePositions,
  patchBranch,
  patchCostCenter,
  patchEmployeePosition,
  revokeBranchAccess,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("organization structure admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("routes employee position assignment lifecycle requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 51 }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 51 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 51 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 51 } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await listEmployeePositions("token", {
      employee_id: 701,
      position_id: 31,
      status: "ACTIVE",
      is_primary: true,
      page: 2,
      limit: 10,
    })
    await getEmployeePosition("token", 51)
    await createEmployeePosition("token", {
      employee_id: 701,
      position_id: 31,
      start_date: "2026-09-01",
      assignment_type: "PRIMARY",
    })
    await patchEmployeePosition("token", 51, {
      status: "COMPLETED",
      end_date: "2026-12-31",
    })
    await deleteEmployeePosition("token", 51)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/employee-positions?page=2&limit=10&employee_id=701&position_id=31&status=ACTIVE&is_primary=true",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/employee-positions/51",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/employee-positions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_id: 701,
          position_id: 31,
          start_date: "2026-09-01",
          assignment_type: "PRIMARY",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/employee-positions/51",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "COMPLETED",
          end_date: "2026-12-31",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/employee-positions/51",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("routes branch CRUD and branch access helper requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 11 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 11 } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ user_id: 41 }] }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await createBranch("token", { name: "HQ", code: "HQ" })
    await patchBranch("token", 11, { city: "Dar es Salaam" })
    await deleteBranch("token", 11)
    const access = await listBranchAccess("token", 11)
    await grantBranchAccess("token", 11, 41)
    await revokeBranchAccess("token", 11, 41)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/branches",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "HQ", code: "HQ" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/branches/11",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ city: "Dar es Salaam" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/branches/11",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/branches/11/access",
      expect.objectContaining({ method: "GET" }),
    )
    expect(access).toEqual([expect.objectContaining({ user_id: 41 })])
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/branches/11/access/41",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/branches/11/access/41",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("routes complete cost-center CRUD helper requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 61, code: "OPS-DSM" }] }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 61, code: "OPS-DSM" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 61 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 61 } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listCostCenters("token")
    const one = await getCostCenter("token", 61)
    await createCostCenter("token", {
      code: "OPS-DSM",
      name: "Operations Dar es Salaam",
      branch_id: 11,
      department_id: 21,
    })
    await patchCostCenter("token", 61, { status: "inactive" })
    await deleteCostCenter("token", 61)

    expect(rows).toEqual([expect.objectContaining({ code: "OPS-DSM" })])
    expect(one).toEqual(expect.objectContaining({ id: 61 }))
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/cost-centers",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/cost-centers/61",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/cost-centers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "OPS-DSM",
          name: "Operations Dar es Salaam",
          branch_id: 11,
          department_id: 21,
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/cost-centers/61",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "inactive" }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/cost-centers/61",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
