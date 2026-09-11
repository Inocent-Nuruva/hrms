import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addMyFieldVisitEvidence,
  approveHrProfileChangeRequest,
  carryForwardLeaveBalances,
  createEmployeeDeviceCard,
  createEmployeeFinanceOffboardingRecoveries,
  createMyProfileChangeRequest,
  emergencyOffboardingAccessTermination,
  generateLeaveBalances,
  listMyActionItems,
  listMyDocuments,
  submitLeaveRequest,
  submitMyResignation,
  syncHikvisionAttendanceByDate,
  syncMyFieldWork,
  updateActivityCategory,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("leftover documented API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("covers self-service extras and the new profile-change API", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { id: 1 } }))
    vi.stubGlobal("fetch", fetchMock)

    await listMyActionItems("token", { limit: 20 })
    await listMyDocuments("token")
    await submitMyResignation("token", { last_working_date: "2026-09-01", reason: "Relocation" })
    await createMyProfileChangeRequest("token", {
      request_type: "CONTACT_INFORMATION",
      changes: { phone: "0700" },
    })
    await approveHrProfileChangeRequest("token", 9)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/action-items?limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/me/resignation",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/hr/profile-change-requests/9/approve",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("covers leave, field, catalog, offboarding, finance, hikvision, and cards", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await generateLeaveBalances("token", { force_recalculate: true })
    await carryForwardLeaveBalances("token", {})
    await submitLeaveRequest("token", 12)
    await syncMyFieldWork("token", {
      sync_request_id: "11111111-1111-1111-1111-111111111111",
      device_identifier: "web",
      items: [],
    })
    await addMyFieldVisitEvidence("token", 44, { evidence_type: "DOCUMENT", document_id: 3 })
    await updateActivityCategory("token", 5, { name: "Calls" })
    await emergencyOffboardingAccessTermination("token", 8, { reason: "Security" })
    await createEmployeeFinanceOffboardingRecoveries("token", 8)
    await syncHikvisionAttendanceByDate("token", 2, { date: "2026-08-17" })
    await createEmployeeDeviceCard("token", 39, 2, { card_no: "12345", sync_to_device: true })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/leave/balances/generate",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/me/field-sync",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:8888/api/offboarding/requests/8/access-termination/emergency",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      9,
      "http://localhost:8888/api/hikvision/devices/2/attendance/sync-date",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      10,
      "http://localhost:8888/api/access-control/employees/39/devices/2/users/cards",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
