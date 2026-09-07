import { afterEach, describe, expect, it, vi } from "vitest"

import {
  acknowledgeMyMovement,
  cancelEmployeeMovement,
  clearAttendanceDailySummaryAdjustment,
  createEmployeeGrade,
  createEmployeeMovement,
  deleteEmployeeGrade,
  getEmployeeGrade,
  getEmployeeMovement,
  getEmployeeNumbering,
  getMyMovement,
  listAttendanceProcessingExceptions,
  listEmployeeGrades,
  listEmployeeMovementOperations,
  listEmployeeMovements,
  listMyMovements,
  patchEmployeeGrade,
  submitEmployeeMovement,
  updateAttendanceProcessingException,
  updateEmployeeNumbering,
  upsertAttendanceDailySummaryAdjustment,
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

describe("batch 2 admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("lists and fetches employee grades", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 4,
              name: "G4",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 4,
            name: "G4",
            description: "Executive grade",
          },
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listEmployeeGrades("token")
    const record = await getEmployeeGrade("token", 4)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employee-grades",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employee-grades/4",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(rows).toEqual([
      expect.objectContaining({
        id: 4,
        name: "G4",
      }),
    ])
    expect(record).toEqual(
      expect.objectContaining({
        id: 4,
        name: "G4",
      })
    )
  })

  it("creates, patches, and deletes employee grades", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 8, name: "G8" }))
      .mockResolvedValueOnce(jsonResponse({ id: 8, name: "G8A" }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await createEmployeeGrade("token", { name: "G8" })
    await patchEmployeeGrade("token", 8, { name: "G8A" })
    await deleteEmployeeGrade("token", 8)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employee-grades",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "G8" }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employee-grades/8",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "G8A" }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/employee-grades/8",
      expect.objectContaining({
        method: "DELETE",
      })
    )
  })

  it("loads and updates employee numbering with PUT", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            prefix: "AICL",
            padding: 5,
            next_number: 121,
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            prefix: "AICL",
            padding: 6,
            next_number: 122,
          },
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const current = await getEmployeeNumbering("token")
    const updated = await updateEmployeeNumbering("token", {
      prefix: "AICL",
      padding: 6,
      next_number: 122,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employee-numbering",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employee-numbering",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          prefix: "AICL",
          padding: 6,
          next_number: 122,
        }),
      })
    )
    expect(current).toEqual(
      expect.objectContaining({
        prefix: "AICL",
        padding: 5,
      })
    )
    expect(updated).toEqual(
      expect.objectContaining({
        prefix: "AICL",
        padding: 6,
      })
    )
  })

  it("lists employee movements and related operations", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 17,
              employee_id: 120,
              movement_type: "TRANSFER",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 17,
            employee_id: 120,
            movement_type: "TRANSFER",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 71,
              status: "PENDING",
            },
          ],
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listEmployeeMovements("token", {
      page: 2,
      limit: 25,
      employee_id: 120,
      movement_type: "TRANSFER",
    })
    const movement = await getEmployeeMovement("token", 17)
    const operations = await listEmployeeMovementOperations("token", 17)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employee-movements?page=2&limit=25&employee_id=120&movement_type=TRANSFER",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employee-movements/17",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/employee-movements/17/operations",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(rows).toEqual([
      expect.objectContaining({
        id: 17,
        movement_type: "TRANSFER",
      }),
    ])
    expect(movement).toEqual(
      expect.objectContaining({
        id: 17,
        movement_type: "TRANSFER",
      })
    )
    expect(operations).toEqual([
      expect.objectContaining({
        id: 71,
        status: "PENDING",
      }),
    ])
  })

  it("creates, submits, and cancels employee movements", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 18, status: "DRAFT" }))
      .mockResolvedValueOnce(jsonResponse({ id: 18, status: "PENDING_APPROVAL" }))
      .mockResolvedValueOnce(jsonResponse({ id: 18, status: "CANCELLED" }))
    vi.stubGlobal("fetch", fetchMock)

    await createEmployeeMovement("token", {
      employee_id: 120,
      movement_type: "TRANSFER",
      effective_date: "2026-08-13",
    })
    await submitEmployeeMovement("token", 18)
    await cancelEmployeeMovement("token", 18)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/employee-movements",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          employee_id: 120,
          movement_type: "TRANSFER",
          effective_date: "2026-08-13",
        }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/employee-movements/18/submit",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/employee-movements/18/cancel",
      expect.objectContaining({
        method: "POST",
      })
    )
  })

  it("lists, fetches, and acknowledges my self-service movements", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 44,
              movementType: "PROMOTION",
              status: "APPROVED",
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 44,
            movementType: "PROMOTION",
            employeeAcknowledgementRequired: true,
          },
        })
      )
      .mockResolvedValueOnce(new Response("", { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    const rows = await listMyMovements("token")
    const detail = await getMyMovement("token", 44)
    await acknowledgeMyMovement("token", 44)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/me/movements",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/me/movements/44",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/me/movements/44/acknowledge",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(rows).toEqual([
      expect.objectContaining({
        id: 44,
        movementType: "PROMOTION",
      }),
    ])
    expect(detail).toEqual(
      expect.objectContaining({
        id: 44,
        movementType: "PROMOTION",
        employeeAcknowledgementRequired: true,
      })
    )
  })

  it("updates and clears attendance daily summary adjustments", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "UPDATED" }))
      .mockResolvedValueOnce(new Response("", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await upsertAttendanceDailySummaryAdjustment("token", 120, "2026-08-13", {
      attendance_status: "PRESENT",
      notes: "Adjusted after review",
    })
    await clearAttendanceDailySummaryAdjustment("token", 120, "2026-08-13")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/attendance/daily-summaries/120/2026-08-13/adjustment",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          attendance_status: "PRESENT",
          notes: "Adjusted after review",
        }),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/attendance/daily-summaries/120/2026-08-13/adjustment",
      expect.objectContaining({
        method: "DELETE",
      })
    )
  })

  it("lists and updates attendance processing exceptions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: 55,
              exception_type: "MISSING_CHECK_OUT",
              status: "OPEN",
            },
          ],
          meta: {
            page: 1,
            limit: 2,
            total: 1,
            total_pages: 1,
          },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ id: 55, status: "RESOLVED" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await listAttendanceProcessingExceptions("token", {
      page: 1,
      limit: 2,
      device_id: 1,
      exception_type: "MISSING_CHECK_OUT",
      status: "OPEN",
    })
    await updateAttendanceProcessingException("token", 55, {
      status: "RESOLVED",
      resolution_note: "Checked against manual log",
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/attendance/processing/exceptions?page=1&limit=2&device_id=1&status=OPEN&exception_type=MISSING_CHECK_OUT",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/attendance/processing/exceptions/55",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "RESOLVED",
          resolution_note: "Checked against manual log",
        }),
      })
    )
    expect(result.rows).toEqual([
      expect.objectContaining({
        id: 55,
        exception_type: "MISSING_CHECK_OUT",
        status: "OPEN",
      }),
    ])
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
  })
})
