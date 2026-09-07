import { afterEach, describe, expect, it, vi } from "vitest"

import {
  assignAccessGroupDevices,
  assignAccessOrganizationEmployees,
  getAccessAuditLogById,
  getAccessCredentialById,
  getAccessCredentialDeviceActionRoutes,
  getAccessDeviceCommandLogById,
  getEmployeeAccessCredentials,
  getHikvisionSyncLogById,
  listAccessAuditLogs,
  listAccessCredentials,
  listAccessDeviceCommandLogs,
  listAccessGroupDevices,
  listAccessOrganizationEmployees,
  listHikvisionSyncLogs,
  removeAccessGroupDevice,
  removeAccessOrganizationEmployee,
  syncAccessGroup,
  syncAccessOrganizationToDevice,
  syncAccessOrganizationsFromDevice,
  syncAccessWeekPlanToDevice,
  updateAccessCredentialStatus,
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

describe("access control admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists access credentials with supported filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 11,
            credential_type: "CARD",
            credential_status: "ACTIVE",
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listAccessCredentials("token", {
      page: 1,
      limit: 20,
      employee_id: 39,
      device_id: 2,
      credential_type: "CARD",
      credential_status: "ACTIVE",
      employee_no: "00039",
      card_no: "12345",
      fingerprint_id: "1",
      search: "john",
      sort_order: "ASC",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/access-control/access-credentials?page=1&limit=20&employee_id=39&device_id=2&credential_type=CARD&credential_status=ACTIVE&employee_no=00039&card_no=12345&fingerprint_id=1&search=john&sort_order=ASC",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    )
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 11,
        credential_type: "CARD",
      }),
    ])
  })

  it("loads credential detail, action routes, and applies lifecycle updates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 15,
            credential_status: "ACTIVE",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            disable_route: "/api/device/disable",
            revoke_route: "/api/device/revoke",
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "UPDATED" } }))
    vi.stubGlobal("fetch", fetchMock)

    const detail = await getAccessCredentialById("token", 15)
    const routes = await getAccessCredentialDeviceActionRoutes("token", 15)
    await updateAccessCredentialStatus("token", 15, "disable", {
      reason: "Card misplaced",
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/access-control/access-credentials/15",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/access-control/access-credentials/15/device-action-routes",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/access-control/access-credentials/15/disable",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          reason: "Card misplaced",
        }),
      })
    )
    expect(detail).toEqual(expect.objectContaining({ id: 15 }))
    expect(routes).toEqual(
      expect.objectContaining({
        disable_route: "/api/device/disable",
      })
    )
  })

  it("lists one employee's access credentials through the employee-scoped endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 21,
            credential_type: "FINGERPRINT",
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getEmployeeAccessCredentials("token", 120)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/access-control/employees/120/access-credentials",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(result).toEqual([
      expect.objectContaining({
        id: 21,
      }),
    ])
  })

  it("lists and fetches audit, command, and Hikvision sync logs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 31,
              action: "ENABLE_ACCESS",
              status: "SUCCESS",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 31,
            action: "ENABLE_ACCESS",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 41,
              commandType: "SET_USER",
              status: "SUCCESS",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 41,
            commandType: "SET_USER",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 51,
              syncType: "USERS",
              status: "PARTIAL",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 51,
            syncType: "USERS",
          },
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const auditRows = await listAccessAuditLogs("token", {
      companyId: 1,
      branchId: 2,
      deviceId: 3,
      employeeId: 4,
      employeeNo: "E-4",
      action: "ENABLE_ACCESS",
      status: "SUCCESS",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-15",
      page: 1,
      limit: 20,
    })
    const auditDetail = await getAccessAuditLogById("token", 31)
    const commandRows = await listAccessDeviceCommandLogs("token", {
      deviceId: 3,
      commandType: "SET_USER",
      status: "SUCCESS",
      page: 1,
      limit: 20,
    })
    const commandDetail = await getAccessDeviceCommandLogById("token", 41)
    const syncRows = await listHikvisionSyncLogs("token", {
      deviceId: 3,
      syncType: "USERS",
      direction: "PUSH",
      status: "PARTIAL",
      page: 1,
      limit: 20,
    })
    const syncDetail = await getHikvisionSyncLogById("token", 51)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/access-control/audit-logs?companyId=1&branchId=2&deviceId=3&employeeId=4&employeeNo=E-4&action=ENABLE_ACCESS&status=SUCCESS&dateFrom=2026-08-01&dateTo=2026-08-15&page=1&limit=20",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/access-control/audit-logs/31",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/access-control/device-command-logs?deviceId=3&commandType=SET_USER&status=SUCCESS&page=1&limit=20",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/access-control/device-command-logs/41",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/access-control/hikvision-sync-logs?deviceId=3&syncType=USERS&direction=PUSH&status=PARTIAL&page=1&limit=20",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/access-control/hikvision-sync-logs/51",
      expect.objectContaining({ method: "GET" })
    )
    expect(auditRows.rows).toHaveLength(1)
    expect(auditDetail).toEqual(expect.objectContaining({ id: 31 }))
    expect(commandRows.rows).toHaveLength(1)
    expect(commandDetail).toEqual(expect.objectContaining({ id: 41 }))
    expect(syncRows.rows).toHaveLength(1)
    expect(syncDetail).toEqual(expect.objectContaining({ id: 51 }))
  })

  it("syncs one access week plan to a target device", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { status: "QUEUED" } }))
    vi.stubGlobal("fetch", fetchMock)

    await syncAccessWeekPlanToDevice("token", 9, { device_id: 14 })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/access-control/week-plans/9/sync-to-device",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ device_id: 14 }),
      })
    )
  })

  it("manages group devices and group sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 7,
              device_name: "HQ Door Terminal",
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "ASSIGNED" } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "QUEUED" } }))
    vi.stubGlobal("fetch", fetchMock)

    const devices = await listAccessGroupDevices("token", 12)
    await assignAccessGroupDevices("token", 12, [7, "9"])
    await removeAccessGroupDevice("token", 12, 7)
    await syncAccessGroup("token", 12)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/access-control/groups/12/devices",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/access-control/groups/12/devices",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          device_ids: [7, 9],
        }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/access-control/groups/12/devices/7",
      expect.objectContaining({ method: "DELETE" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/access-control/groups/12/sync",
      expect.objectContaining({ method: "POST" })
    )
    expect(devices).toEqual([
      expect.objectContaining({
        id: 7,
      }),
    ])
  })

  it("manages organization employees and device sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              employee_id: 120,
              employee_no: "EMP-120",
            },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "ASSIGNED" } }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "QUEUED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "SYNCED" } }))
    vi.stubGlobal("fetch", fetchMock)

    const employees = await listAccessOrganizationEmployees("token", 9)
    await assignAccessOrganizationEmployees("token", 9, [120, "121"])
    await removeAccessOrganizationEmployee("token", 9, 120)
    await syncAccessOrganizationToDevice("token", 9, { device_id: 4 })
    await syncAccessOrganizationsFromDevice("token", 4)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/access-control/organizations/9/employees",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/access-control/organizations/9/employees",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_ids: [120, 121],
        }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/access-control/organizations/9/employees/120",
      expect.objectContaining({ method: "DELETE" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/access-control/organizations/9/sync-to-device",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ device_id: 4 }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/access-control/organizations/sync-from-device/4",
      expect.objectContaining({ method: "POST" })
    )
    expect(employees).toEqual([
      expect.objectContaining({
        employee_id: 120,
      }),
    ])
  })
})
