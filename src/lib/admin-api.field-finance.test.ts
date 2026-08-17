import { afterEach, describe, expect, it, vi } from "vitest"

import {
  approveEmployeeFinanceApplication,
  checkInMyFieldVisit,
  createEmployeeFinanceProduct,
  createFieldParty,
  createMyFinanceApplication,
  createMyFieldVisitPlan,
  getEmployeeFinanceDashboard,
  getManagerFieldVisitDashboard,
  listHrFieldVisits,
  listMyFieldVisits,
  listMyFinanceApplications,
  reviewManagerFieldVisit,
  submitMyFinanceApplication,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("field and finance admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists HR field visits with the documented filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: { items: [{ id: 9, status: "IN_PROGRESS", visit_type: "CUSTOMER_VISIT" }] },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listHrFieldVisits("token", {
      page: 1,
      status: "IN_PROGRESS",
      date_from: "2026-08-01",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/hr/field-visits?page=1&status=IN_PROGRESS&date_from=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    )
    expect(rows).toEqual([expect.objectContaining({ id: 9 })])
  })

  it("creates a party, a visit plan, and checks in", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 3 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 12 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 44, status: "CHECKED_IN" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { open_visits: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 44 }] } }))
    vi.stubGlobal("fetch", fetchMock)

    await createFieldParty("token", { party_type: "CUSTOMER", name: "Acme" })
    await createMyFieldVisitPlan("token", {
      visit_date: "2026-08-18",
      items: [{ visit_type: "CUSTOMER_VISIT", purpose: "Renewal" }],
    })
    await checkInMyFieldVisit("token", 44, {
      client_request_id: "11111111-1111-1111-1111-111111111111",
      captured_at: "2026-08-18T08:00:00.000Z",
      latitude: -6.8,
      longitude: 39.2,
    })
    await getManagerFieldVisitDashboard("token")
    await listMyFieldVisits("token", { status: "CHECKED_IN" })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/field-parties",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/me/field-visits/44/check-in",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("reviews a visit and runs employee finance product and application flows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 44, status: "APPROVED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { open_accounts: 3 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 7, code: "SL-01" } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 21, status: "DRAFT" }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 21, status: "DRAFT" } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 21, status: "SUBMITTED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 21, status: "APPROVED" } }))
    vi.stubGlobal("fetch", fetchMock)

    await reviewManagerFieldVisit("token", 44, { decision: "APPROVE", comments: "Good visit." })
    await getEmployeeFinanceDashboard("token")
    await createEmployeeFinanceProduct("token", {
      product_type: "STAFF_LOAN",
      code: "SL-01",
      name: "Staff loan",
      minimum_amount: "100000",
      maximum_term_months: 12,
      effective_from: "2026-01-01",
    })
    const mine = await listMyFinanceApplications("token")
    await createMyFinanceApplication("token", {
      product_id: 7,
      requested_amount: "250000",
      requested_term_months: 6,
      purpose: "School fees",
    })
    await submitMyFinanceApplication("token", 21)
    await approveEmployeeFinanceApplication("token", 21)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/manager/field-visits/44/review",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/employee-finance/products",
      expect.objectContaining({ method: "POST" }),
    )
    expect(mine).toEqual([expect.objectContaining({ id: 21 })])
  })
})
