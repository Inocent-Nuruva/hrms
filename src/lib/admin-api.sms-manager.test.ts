import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createCostCenter,
  getManagerDashboard,
  getManagerTeamMember,
  getSmsGlobalSetting,
  listManagerActionItems,
  listManagerTeam,
  listSmsLogs,
  listSmsRegistry,
  retrySmsLog,
  sendTestSms,
  updatePlatformSmsRegistryItem,
  updateSmsGlobalSetting,
  updateSmsRegistryItem,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("sms and manager self-service API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("reads and updates company SMS settings, registry, and logs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { isEnabled: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { isEnabled: false } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ code: "LEAVE_APPROVED", isEnabled: true }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 9, status: "FAILED" }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 9, status: "PENDING" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 1 } }, { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    const setting = await getSmsGlobalSetting("token")
    await updateSmsGlobalSetting("token", { is_enabled: false })
    const registry = await listSmsRegistry("token")
    const logs = await listSmsLogs("token", { page: 1, status: "FAILED" })
    await retrySmsLog("token", 9)
    await sendTestSms("token", { recipient_phone: "+255700000000", message: "Test" })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/sms/global",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/sms/global",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ is_enabled: false }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/sms/logs?page=1&status=FAILED",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/sms/logs/9/retry",
      expect.objectContaining({ method: "POST" }),
    )
    expect(setting).toEqual(expect.objectContaining({ isEnabled: true }))
    expect(registry).toEqual([expect.objectContaining({ code: "LEAVE_APPROVED" })])
    expect(logs).toEqual([expect.objectContaining({ id: 9 })])
  })

  it("updates a platform registry item and loads manager self-service lists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { code: "LEAVE_APPROVED", isEnabled: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { code: "PAYSLIP_READY", isEnabled: true } }))
      .mockResolvedValueOnce(jsonResponse({ data: { team_count: 6 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 2, title: "Approve leave" }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 44, full_name: "Ada" }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 44, full_name: "Ada" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 3, code: "CC-01" } }, { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    await updateSmsRegistryItem("token", "LEAVE_APPROVED", {
      is_enabled: true,
      sms_template: "Approved",
    })
    await updatePlatformSmsRegistryItem("token", "PAYSLIP_READY", { is_enabled: false })
    const dashboard = await getManagerDashboard("token", { date_from: "2026-08-01" })
    const items = await listManagerActionItems("token", { status: "OPEN", limit: 20 })
    const team = await listManagerTeam("token", { direct_reports_only: true, limit: 20 })
    const member = await getManagerTeamMember("token", 44)
    await createCostCenter("token", { code: "CC-01", name: "HQ" })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/sms/platform/registry/PAYSLIP_READY",
      expect.objectContaining({ method: "PATCH" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/dashboards/manager?date_from=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/manager/action-items?status=OPEN&limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/manager/team?direct_reports_only=true&limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/manager/team/44",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:8888/api/cost-centers",
      expect.objectContaining({ method: "POST" }),
    )
    expect(dashboard).toEqual(expect.objectContaining({ team_count: 6 }))
    expect(items).toEqual([expect.objectContaining({ id: 2 })])
    expect(team).toEqual([expect.objectContaining({ id: 44 })])
    expect(member).toEqual(expect.objectContaining({ id: 44 }))
  })
})
