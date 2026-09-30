import { afterEach, describe, expect, it, vi } from "vitest"

import {
  calculatePayrollFinalSettlement,
  getEmployeeDashboard,
  getHrAttendanceSetupStatus,
  getHrAttendanceSchedulePreview,
  getHrDashboard,
  getHrLaunchReadiness,
  getHrLaunchReadinessEmployees,
  getMyDashboard,
  getSystemHealth,
  listSecurityEvents,
  runHrAttendanceSetupWizard,
  runPayrollReconciliation,
  runPayrollRunVariance,
} from "./admin-api"

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("insights, readiness, and payroll report API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads HR dashboards, health, launch readiness, and security events", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { welcome: "employee" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { headcount: 120 } }))
      .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
      .mockResolvedValueOnce(jsonResponse({ data: { blockers: [] } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            summary: { totalEmployees: 2, readyCount: 1, notReadyCount: 1 },
            ready: [{ employeeId: 1 }],
            notReady: [{ employeeId: 2 }],
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 7, event_type: "LOGIN" }] } }))
    vi.stubGlobal("fetch", fetchMock)

    const employeeDashboard = await getEmployeeDashboard("token")
    const dashboard = await getHrDashboard("token", "hr", { date_from: "2026-08-01" })
    const health = await getSystemHealth("token")
    const readiness = await getHrLaunchReadiness("token")
    const employeeReadiness = await getHrLaunchReadinessEmployees("token")
    const events = await listSecurityEvents("token", { page: 1, limit: 20, outcome: "SUCCESS" })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/dashboards/employee",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/dashboards/hr?date_from=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/health",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/hr/launch-readiness",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/hr/launch-readiness/employees",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/security-events?page=1&limit=20&outcome=SUCCESS",
      expect.objectContaining({ method: "GET" }),
    )
    expect(employeeDashboard).toEqual(expect.objectContaining({ welcome: "employee" }))
    expect(dashboard).toEqual(expect.objectContaining({ headcount: 120 }))
    expect(health).toEqual(expect.objectContaining({ status: "ok" }))
    expect(readiness).toEqual(expect.objectContaining({ blockers: [] }))
    expect(employeeReadiness).toEqual(
      expect.objectContaining({
        summary: { totalEmployees: 2, readyCount: 1, notReadyCount: 1 },
        ready: [expect.objectContaining({ employeeId: 1 })],
        notReady: [expect.objectContaining({ employeeId: 2 })],
      }),
    )
    expect(events).toEqual([expect.objectContaining({ id: 7 })])
  })

  it("preserves every section in a raw manager dashboard response", async () => {
    const managerDashboard = {
      generated_at: "2026-09-15T06:44:31.807Z",
      period: { date_from: "2026-09-15", date_to: "2026-09-15" },
      team: { total_members: 1, employees_on_leave: 0 },
      attendance: { total_records: 1, present: 1, absent: 0 },
      approvals: { open_action_items: 0, pending_attendance_corrections: 0 },
      performance: { pending_team_validations: 0, published_team_reviews: 0 },
      work_activities: { pending_activity_reviews: 1, approved_reports: 0 },
      capabilities: { activity_review: { available: true } },
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(managerDashboard)))

    const dashboard = await getHrDashboard("token", "manager")

    expect(dashboard).toEqual(managerDashboard)
    expect(dashboard?.team).toEqual({ total_members: 1, employees_on_leave: 0 })
    expect(dashboard?.work_activities).toEqual({
      pending_activity_reviews: 1,
      approved_reports: 0,
    })
  })

  it("preserves the full employee dashboard payload shape when the endpoint returns a dashboard object", async () => {
    const dashboardPayload = {
      generated_at: "2026-08-24T07:26:33.896Z",
      user: { id: 44, first_name: "Inocent", last_name: "Nuruva" },
      employee: { id: 42, employee_no: "AICL/00042" },
      attendance_today: { date: "2026-08-24" },
      leave: { current_fiscal_year: "2026" },
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(dashboardPayload)))

    const employeeDashboard = await getEmployeeDashboard("token")

    expect(employeeDashboard).toEqual(dashboardPayload)
  })

  it("unwraps a nested employee dashboard object from a data envelope", async () => {
    const dashboardPayload = {
      generated_at: "2026-08-24T07:26:33.896Z",
      user: { id: 44, first_name: "Inocent", last_name: "Nuruva" },
      employee: { id: 42, employee_no: "AICL/00042" },
      attendance_today: { date: "2026-08-24" },
      leave: { current_fiscal_year: "2026" },
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => jsonResponse({ data: dashboardPayload })),
    )

    await expect(getEmployeeDashboard("token")).resolves.toEqual(dashboardPayload)
    await expect(getMyDashboard("token")).resolves.toEqual(dashboardPayload)
  })

  it("runs attendance setup, schedule preview, and payroll report actions", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      jsonResponse({ data: { status: "queued" } }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await runHrAttendanceSetupWizard("token", { policy: { name: "Default" } })
    await getHrAttendanceSchedulePreview("token", { employee_id: 44, from_date: "2026-08-01" })
    await runPayrollReconciliation("token")
    await runPayrollRunVariance("token", 10, 9)
    await calculatePayrollFinalSettlement("token", 55)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/hr/attendance/setup/wizard",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/hr/attendance/schedules/preview?employee_id=44&from_date=2026-08-01",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/payroll/reports/reconciliation/run",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/payroll/reports/runs/10/variance?comparison_run_id=9",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/payroll/reports/final-settlements/55/calculate",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("preserves the complete attendance setup status instead of extracting the active policy", async () => {
    const setupStatus = {
      companyId: 1,
      isComplete: false,
      activePolicy: { id: 3, name: "Head office attendance" },
      missing: ["No default timetable is configured."],
      warnings: [],
    }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: setupStatus })),
    )

    await expect(getHrAttendanceSetupStatus("token")).resolves.toEqual(setupStatus)
  })
})
