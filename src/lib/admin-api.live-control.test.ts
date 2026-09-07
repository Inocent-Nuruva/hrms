import { afterEach, describe, expect, it, vi } from "vitest"

import {
  activateAttendanceGeofence,
  activateAttendanceWifiNetwork,
  commandAccessControlDoor,
  completeMyFieldFollowUp,
  deactivateAttendanceGeofence,
  deactivateAttendanceWifiNetwork,
  getAccessControlDoorDeviceConfig,
  getHikvisionSyncJob,
  listAccessDeviceAuditLogs,
  listAccessDeviceScopedCommandLogs,
  listAccessEmployeeAuditLogs,
  listHrProfileChangeRequestHistory,
  listMyFieldFollowUps,
  listMyProfileChangeRequestHistory,
  manageHikvisionDevice,
  previewHrProfileChangeRequestFile,
  previewMyProfileChangeRequestFile,
  syncAccessControlDoorToDevice,
  uploadMyProfileChangePhoto,
  validateAttendanceGeofenceLocation,
  validateAttendanceWifiNetwork,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("live control and leftover documented API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("sends door live-control commands and reads device config", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { ok: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await commandAccessControlDoor("token", 8, "open")
    await commandAccessControlDoor("token", 8, "close")
    await commandAccessControlDoor("token", 8, "always-open")
    await commandAccessControlDoor("token", 8, "always-close")
    await getAccessControlDoorDeviceConfig("token", 8)
    await syncAccessControlDoorToDevice("token", 8)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/access-control/doors/8/open",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/access-control/doors/8/close",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/access-control/doors/8/always-open",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/access-control/doors/8/always-close",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/access-control/doors/8/device-config",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/access-control/doors/8/sync-to-device",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("activates, deactivates, and validates geofences and Wi-Fi networks", async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ data: { valid: true } }))
    vi.stubGlobal("fetch", fetchMock)

    await activateAttendanceGeofence("token", 4)
    await deactivateAttendanceGeofence("token", 4)
    await validateAttendanceGeofenceLocation("token", 4, {
      latitude: -6.7924,
      longitude: 39.2083,
      accuracyMeters: 12,
    })
    await activateAttendanceWifiNetwork("token", 5)
    await deactivateAttendanceWifiNetwork("token", 5)
    await validateAttendanceWifiNetwork("token", 5, {
      ssid: "HQ-Staff",
      bssid: "aa:bb:cc:dd:ee:ff",
      ipAddress: "192.168.1.40",
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/attendance/geofences/4/activate",
      expect.objectContaining({ method: "PATCH" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/attendance/geofences/4/deactivate",
      expect.objectContaining({ method: "PATCH" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/attendance/geofences/4/validate-location",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          latitude: -6.7924,
          longitude: 39.2083,
          accuracyMeters: 12,
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/attendance/wifi-networks/5/activate",
      expect.objectContaining({ method: "PATCH" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/attendance/wifi-networks/5/deactivate",
      expect.objectContaining({ method: "PATCH" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/attendance/wifi-networks/5/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ssid: "HQ-Staff",
          bssid: "aa:bb:cc:dd:ee:ff",
          ipAddress: "192.168.1.40",
        }),
      }),
    )
  })

  it("manages hikvision devices, reads sync jobs, and lists scoped access logs", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/manage")) {
        return jsonResponse({ data: { jobId: "job-9" } })
      }
      if (String(url).includes("/sync-jobs/")) {
        return jsonResponse({ data: { id: "job-9", status: "RUNNING" } })
      }
      return jsonResponse({
        data: [{ id: 1, action: "OPEN_DOOR", status: "SUCCESS" }],
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await manageHikvisionDevice("token", 2, { reboot: true })
    const job = await getHikvisionSyncJob("token", "job-9")
    const deviceAudit = await listAccessDeviceAuditLogs("token", 2, { page: 1, limit: 20 })
    const commandLogs = await listAccessDeviceScopedCommandLogs("token", 2, {
      commandType: "SET_USER",
      page: 1,
      limit: 20,
    })
    const employeeAudit = await listAccessEmployeeAuditLogs("token", 39, {
      action: "ENABLE_ACCESS",
      page: 1,
      limit: 20,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/hikvision/devices/2/manage",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reboot: true }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/hikvision/sync-jobs/job-9",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/access-control/devices/2/audit-logs?page=1&limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/access-control/devices/2/command-logs?commandType=SET_USER&page=1&limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/access-control/employees/39/audit-logs?action=ENABLE_ACCESS&page=1&limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(job).toEqual(expect.objectContaining({ id: "job-9", status: "RUNNING" }))
    expect(deviceAudit.rows).toHaveLength(1)
    expect(commandLogs.rows).toHaveLength(1)
    expect(employeeAudit.rows).toHaveLength(1)
  })

  it("covers profile-change history, file preview, photo upload, and field follow-up aliases", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/files/")) {
        return new Response(new Blob(["photo"], { type: "image/jpeg" }), {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
            "content-disposition": 'attachment; filename="pending.jpg"',
          },
        })
      }
      if (String(url).includes("/profile-photo")) {
        return jsonResponse({ data: { id: 11, request_type: "PROFILE_PHOTO" } })
      }
      return jsonResponse({ data: [{ id: 3, action: "SUBMITTED" }] })
    })
    vi.stubGlobal("fetch", fetchMock)

    await listMyProfileChangeRequestHistory("token", 11)
    await listHrProfileChangeRequestHistory("token", 11)
    const myFile = await previewMyProfileChangeRequestFile("token", 11, 4)
    const hrFile = await previewHrProfileChangeRequestFile("token", 11, 4)
    await uploadMyProfileChangePhoto(
      "token",
      new File(["photo"], "face.jpg", { type: "image/jpeg" }),
    )
    await listMyFieldFollowUps("token", { status: "OPEN", limit: 20 })
    await completeMyFieldFollowUp("token", 7, { completion_note: "Done" })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/me/profile-change-requests/11/history",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/hr/profile-change-requests/11/history",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/me/profile-change-requests/11/files/4",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/hr/profile-change-requests/11/files/4",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/me/profile-change-requests/profile-photo",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/me/field-visits/follow-ups/list?status=OPEN&limit=20",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://localhost:8888/api/me/field-visits/follow-ups/7/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ completion_note: "Done" }),
      }),
    )
    expect(myFile.filename).toBe("pending.jpg")
    expect(hrFile.contentType).toBe("image/jpeg")
  })
})
