import { afterEach, describe, expect, it, vi } from "vitest"

import {
  confirmLeaveBalanceImport,
  downloadLeaveBalanceImportReport,
  downloadLeaveBalanceImportTemplate,
  listLeaveBalanceImportRows,
  uploadLeaveBalanceImport,
} from "./admin-api"

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function workbookResponse(filename: string) {
  return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

describe("leave balance bulk import API", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("downloads the template for the selected leave year and filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(workbookResponse("leave-balance-template-2026-20260926.xlsx"))
    vi.stubGlobal("fetch", fetchMock)

    const result = await downloadLeaveBalanceImportTemplate("token", { fiscal_year: "2026", branch_id: 3 })

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/leave/balances/import/template?fiscal_year=2026&branch_id=3",
    )
    expect(result.filename).toBe("leave-balance-template-2026-20260926.xlsx")
    expect(result.blob.size).toBe(6)
  })

  it("uploads the workbook with the default reason for validation only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ batch_id: "LBI-1", status: "READY_FOR_IMPORT" }))
    vi.stubGlobal("fetch", fetchMock)
    const file = new File(["xlsx"], "balances.xlsx")

    const batch = await uploadLeaveBalanceImport("token", file, { default_reason: "  Opening balances  " })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/api/leave/balances/import")
    expect(init.method).toBe("POST")
    const body = init.body as FormData
    expect((body.get("file") as File).name).toBe("balances.xlsx")
    expect(body.get("default_reason")).toBe("Opening balances")
    expect(batch.batch_id).toBe("LBI-1")
  })

  it("surfaces the server message and code when a template is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { statusCode: 400, message: "This template was generated for a different company.", code: "COMPANY_MISMATCH" },
          400,
        ),
      ),
    )

    await expect(uploadLeaveBalanceImport("token", new File(["x"], "balances.xlsx"))).rejects.toMatchObject({
      message: "This template was generated for a different company.",
      code: "COMPANY_MISMATCH",
      status: 400,
    })
  })

  it("pages rows with filters and reads the pagination meta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: 1, row_number: 2 }],
        meta: { totalItems: 120, itemCount: 1, itemsPerPage: 50, totalPages: 3, currentPage: 2 },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const page = await listLeaveBalanceImportRows("token", "LBI-1", {
      page: 2,
      status: "INVALID",
      search: "AICL",
      leave_type_id: 4,
    })

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain("/api/leave/balances/import/LBI-1/rows?")
    expect(url).toContain("status=INVALID")
    expect(url).toContain("search=AICL")
    expect(url).toContain("leave_type_id=4")
    expect(page).toMatchObject({ total: 120, totalPages: 3, page: 2, limit: 50 })
  })

  it("omits the ALL filter and confirms with the chosen mode", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [], meta: { totalItems: 0, itemsPerPage: 50, totalPages: 1, currentPage: 1 } }))
      .mockResolvedValueOnce(jsonResponse({ batch_id: "LBI-1", status: "COMPLETED" }))
    vi.stubGlobal("fetch", fetchMock)

    await listLeaveBalanceImportRows("token", "LBI-1", { status: "ALL" })
    await confirmLeaveBalanceImport("token", "LBI-1", { import_mode: "STRICT", acknowledge_warnings: true })

    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("status=")
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toContain("/api/leave/balances/import/LBI-1/confirm")
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual({ import_mode: "STRICT", acknowledge_warnings: true })
  })

  it("downloads the error report workbook", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(workbookResponse("leave-balance-import-LBI-1-report.xlsx")))

    const report = await downloadLeaveBalanceImportReport("token", "LBI-1")

    expect(report.filename).toBe("leave-balance-import-LBI-1-report.xlsx")
  })
})
