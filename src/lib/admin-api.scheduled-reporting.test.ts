import { afterEach, describe, expect, it, vi } from "vitest"

import {
  downloadScheduledReportExecution,
  getScheduledReportSchedule,
  getScheduledReportSmtpConfiguration,
  getScheduledReportTemplate,
  listScheduledReportDefinitions,
  retryScheduledReportExecution,
  runScheduledReportTemplate,
  testScheduledReportSmtpConfigurationDraft,
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

describe("scheduled reporting admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("runs a report template with spec-shaped custom range fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 41,
          template_id: 7,
          status: "QUEUED",
          source: "MANUAL",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await runScheduledReportTemplate("token", 7, {
      date_from: "2026-08-01",
      date_to: "2026-08-13",
      output_format: "PDF",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/scheduled-reporting/templates/7/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          date_from: "2026-08-01",
          date_to: "2026-08-13",
          output_format: "PDF",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 41,
        template_id: 7,
        status: "QUEUED",
      })
    )
  })

  it("lists report definitions from the scheduled reporting contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [
          {
            id: 3,
            reportCode: "ATTENDANCE_DAILY",
            name: "Daily attendance summary",
            supportedFormats: ["PDF", "CSV"],
            generatorService: "attendance-engine",
            isActive: true,
          },
        ],
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await listScheduledReportDefinitions("token")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/scheduled-reporting/report-definitions",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    )
    expect(result).toEqual([
      expect.objectContaining({
        reportCode: "ATTENDANCE_DAILY",
        name: "Daily attendance summary",
      }),
    ])
  })

  it("loads template, schedule, and SMTP configuration detail records", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 7,
            name: "Daily branch report",
            reportDefinitionId: 3,
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 9,
            name: "Morning schedule",
            scheduleType: "DAILY",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 5,
            name: "Primary SMTP",
            host: "smtp.example.com",
          },
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const template = await getScheduledReportTemplate("token", 7)
    const schedule = await getScheduledReportSchedule("token", 9)
    const smtp = await getScheduledReportSmtpConfiguration("token", 5)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:9999/api/scheduled-reporting/templates/7",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:9999/api/scheduled-reporting/schedules/9",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:9999/api/scheduled-reporting/smtp-configurations/5",
      expect.objectContaining({
        method: "GET",
      })
    )
    expect(template).toEqual(expect.objectContaining({ id: 7, name: "Daily branch report" }))
    expect(schedule).toEqual(expect.objectContaining({ id: 9, name: "Morning schedule" }))
    expect(smtp).toEqual(expect.objectContaining({ id: 5, name: "Primary SMTP" }))
  })

  it("keeps template detail fields when the entity includes nested company relations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 7,
        name: "Morning Attendance Report",
        reportDefinitionId: 3,
        smtpConfigurationId: 5,
        outputFormat: "XLSX",
        dateRangeStrategy: "CURRENT_DAY",
        attachReport: true,
        isActive: true,
        createdAt: "2026-08-01T06:00:00.000Z",
        updatedAt: "2026-08-13T06:00:00.000Z",
        dateRangeConfig: {},
        reportFilters: {},
        company: { id: 1, name: "Acme Corp" },
        reportDefinition: { id: 3, name: "Morning Attendance Report" },
        smtpConfiguration: { id: 5, name: "Primary SMTP", host: "smtp.example.com" },
        createdByCompanyUser: { id: 11, email: "hr@example.com" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const template = await getScheduledReportTemplate("token", 7)

    expect(template).toEqual(
      expect.objectContaining({
        id: 7,
        name: "Morning Attendance Report",
        reportDefinitionId: 3,
        smtpConfigurationId: 5,
        outputFormat: "XLSX",
        dateRangeStrategy: "CURRENT_DAY",
        attachReport: true,
        isActive: true,
      })
    )
  })

  it("unwraps a nested data envelope without peeling company or dateRangeConfig", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          id: 8,
          name: "End of Day Attendance Report",
          reportDefinitionId: 4,
          smtpConfigurationId: 5,
          outputFormat: "XLSX",
          dateRangeStrategy: "CURRENT_DAY",
          attachReport: true,
          isActive: true,
          dateRangeConfig: { timezone: "Africa/Dar_es_Salaam" },
          company: { id: 1, name: "Acme Corp" },
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const template = await getScheduledReportTemplate("token", 8)

    expect(template).toEqual(
      expect.objectContaining({
        id: 8,
        name: "End of Day Attendance Report",
        outputFormat: "XLSX",
        isActive: true,
      })
    )
  })

  it("retries an execution and returns the normalized execution record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result: {
          id: 52,
          template_id: 7,
          status: "QUEUED",
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await retryScheduledReportExecution("token", 52)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/scheduled-reporting/executions/52/retry",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        id: 52,
        status: "QUEUED",
      })
    )
  })

  it("downloads the generated execution artifact using the backend filename", async () => {
    const csvBytes = new Uint8Array([0x69, 0x64, 0x2c, 0x6e, 0x61, 0x6d, 0x65])
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(csvBytes, {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "content-disposition":
            'attachment; filename="scheduled-report-52.csv"',
        },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await downloadScheduledReportExecution("token", 52)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/scheduled-reporting/executions/52/download",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      })
    )
    expect(result.filename).toBe("scheduled-report-52.csv")
    expect(result.contentType).toBe("text/csv")
    expect(result.blob.size).toBe(csvBytes.byteLength)
  })

  it("surfaces a parsed backend message when execution download fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          message: "Execution output is not ready yet.",
        },
        {
          status: 409,
        }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      downloadScheduledReportExecution("token", 52)
    ).rejects.toMatchObject({
      message: "Execution output is not ready yet.",
      status: 409,
    })
  })

  it("tests a draft SMTP configuration against the updated test-draft endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await testScheduledReportSmtpConfigurationDraft("token", {
      host: "smtp.example.com",
      port: 587,
      senderEmail: "reports@example.com",
      toEmail: "hr@example.com",
      sendTestEmail: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:9999/api/scheduled-reporting/smtp-configurations/test-draft",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          host: "smtp.example.com",
          port: 587,
          senderEmail: "reports@example.com",
          toEmail: "hr@example.com",
          sendTestEmail: true,
        }),
      })
    )
  })
})
