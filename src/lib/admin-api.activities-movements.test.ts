import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addMyActivityEntry,
  addMyActivityEvidence,
  applyEmployeeMovement,
  approveEmployeeMovement,
  createMyActivityReport,
  deleteMyActivityEntry,
  getManagerActivitiesDashboard,
  getMyActivitiesToday,
  listHrActivities,
  listManagerPendingActivityReviews,
  listMyActivities,
  rejectEmployeeMovement,
  retryEmployeeMovementOperation,
  returnEmployeeMovement,
  reviewManagerActivityReport,
  submitMyActivityReport,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("daily activities and employee movement API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists HR and self-service daily activities with documented filters", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [{ id: 9, status: "SUBMITTED" }] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [{ id: 4, status: "DRAFT" }] } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: 4, activity_date: "2026-08-17" } }))
    vi.stubGlobal("fetch", fetchMock)

    const hr = await listHrActivities("token", { page: 1, status: "SUBMITTED", date_from: "2026-08-01" })
    const mine = await listMyActivities("token", { status: "DRAFT" })
    const today = await getMyActivitiesToday("token")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/hr/activities?page=1&status=SUBMITTED&date_from=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/me/activities?status=DRAFT",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/me/activities/today",
      expect.objectContaining({ method: "GET" }),
    )
    expect(hr).toEqual([expect.objectContaining({ id: 9 })])
    expect(mine).toEqual([expect.objectContaining({ id: 4 })])
    expect(today).toEqual(expect.objectContaining({ id: 4 }))
  })

  it("creates, fills, submits, and reviews a daily activity report", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 12 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 81 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 12, status: "SUBMITTED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { pending: 2 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 12 }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 12, status: "APPROVED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { deleted: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 1 } }, { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    await createMyActivityReport("token", { activity_date: "2026-08-17" })
    await addMyActivityEntry("token", 12, {
      activity_category_id: 3,
      title: "Client call",
      description: "Renewal follow-up",
    })
    await submitMyActivityReport("token", 12, {
      employee_summary: "Completed planned work.",
      client_request_id: "11111111-1111-1111-1111-111111111111",
    })
    await getManagerActivitiesDashboard("token", { date_from: "2026-08-01" })
    await listManagerPendingActivityReviews("token", { status: "SUBMITTED" })
    await reviewManagerActivityReport("token", 12, {
      decision: "APPROVE",
      comments: "Good report.",
    })
    await deleteMyActivityEntry("token", 12, 81)
    await addMyActivityEvidence("token", 81, { document_id: 44 })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/me/activities/reports",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/me/activities/reports/12/entries",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/me/activities/reports/12/submit",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:9999/api/manager/activities/dashboard?date_from=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:9999/api/manager/activities/reports/12/review",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:9999/api/me/activities/reports/12/entries/81",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "http://localhost:9999/api/me/activities/entries/81/evidence",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("approves, returns, rejects, applies, and retries employee movements", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      jsonResponse({ data: { id: 18, status: "APPROVED" } }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await approveEmployeeMovement("token", 18, { comments: "Looks correct." })
    await returnEmployeeMovement("token", 18, { comments: "Fix the effective date." })
    await rejectEmployeeMovement("token", 18, { comments: "Not justified." })
    await applyEmployeeMovement("token", 18)
    await retryEmployeeMovementOperation("token", 18, 71)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employee-movements/18/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ comments: "Looks correct." }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employee-movements/18/return",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/employee-movements/18/reject",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:9999/api/employee-movements/18/apply",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:9999/api/employee-movements/18/operations/71/retry",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
