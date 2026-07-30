import { afterEach, describe, expect, it, vi } from "vitest"
import {
  downloadEmployeeImportResult,
  getEmployeeImportPreview,
  getEmployeeImportResult,
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

describe("employee import admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads the stored preview payload for the mapped workbook batch", async () => {
    const previewPayload = {
      batchId: "IMPORT-20260730-MAPPED",
      previewToken: "preview-token",
      importMode: "CREATE_OR_UPDATE",
      process_valid_rows_only: true,
      totalRows: 119,
      validRows: 117,
      invalidRows: 2,
      duplicateRows: 0,
      rowsReadyForImport: 117,
      summary: {
        totalRows: 119,
        readyForImport: 117,
        invalidRecords: 2,
      },
      rows: [
        {
          rowNumber: 59,
          identifier: "Jayman Hiten Chohan",
          status: "INVALID_RECORD",
          issues: [
            {
              field: "employment_date",
              message: "Employment date cannot be in the future",
            },
          ],
        },
        {
          rowNumber: 68,
          identifier: "KVA Krishnan",
          status: "INVALID_RECORD",
          issues: [
            {
              field: "device_employee_number",
              message:
                "Device employee number is required when access device codes are provided",
            },
          ],
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(previewPayload))
    vi.stubGlobal("fetch", fetchMock)

    const result = await getEmployeeImportPreview("token", "IMPORT-20260730-MAPPED")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees/import/IMPORT-20260730-MAPPED/preview",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        }),
      })
    )
    expect(result).toEqual(previewPayload)
  })

  it("returns a JSON import result summary for the mapped workbook batch", async () => {
    const resultPayload = {
      batchId: "IMPORT-20260730-MAPPED",
      status: "COMPLETED_WITH_ERRORS",
      summary: {
        totalUploaded: 119,
        selectedForImport: 117,
        successfullyImported: 117,
        invalidSkipped: 2,
      },
      rows: [
        {
          rowNumber: 59,
          status: "INVALID_RECORD",
        },
      ],
    }

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(resultPayload))
    vi.stubGlobal("fetch", fetchMock)

    const result = await getEmployeeImportResult("token", "IMPORT-20260730-MAPPED")

    expect(result).toEqual({
      type: "json",
      payload: resultPayload,
    })
  })

  it("treats a result endpoint workbook response as a downloadable file", async () => {
    const workbookBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(workbookBytes, {
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition":
            'attachment; filename="employee-import-result-IMPORT-20260730-MAPPED.xlsx"',
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await getEmployeeImportResult("token", "IMPORT-20260730-MAPPED")

    expect(result.type).toBe("file")
    if (result.type !== "file") {
      throw new Error("Expected a file response")
    }
    expect(result.filename).toBe(
      "employee-import-result-IMPORT-20260730-MAPPED.xlsx"
    )
    expect(result.blob.size).toBe(workbookBytes.byteLength)
  })

  it("downloads the dedicated Excel error report route", async () => {
    const workbookBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(workbookBytes, {
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition":
            'attachment; filename="IMPORT-20260730-MAPPED-result.xlsx"',
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await downloadEmployeeImportResult(
      "token",
      "IMPORT-20260730-MAPPED"
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/employees/import/IMPORT-20260730-MAPPED/errors/download",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(result.filename).toBe("IMPORT-20260730-MAPPED-result.xlsx")
    expect(result.blob.size).toBe(workbookBytes.byteLength)
  })
})
