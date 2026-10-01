import { afterEach, describe, expect, it, vi } from "vitest"

import {
  approvePerformanceReview,
  createPerformanceFinancialYear,
  createPerformanceImprovementPlan,
  createPerformanceKpi,
  createPerformanceKpiRule,
  createPerformanceKpiVersion,
  generatePerformancePeriods,
  getManagerPerformanceSummary,
  getMyPerformanceSummary,
  getPerformanceDashboard,
  listMyPerformanceReviews,
  listPerformanceFinancialYears,
  listPerformanceKpiRules,
  listPerformanceKpis,
  listPerformanceImprovementPlans,
  submitManagerPerformanceReview,
  submitMyPerformanceSelfReview,
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

describe("performance admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("loads the dashboard summary and lists financial years", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            open_reviews: 4,
            average_score: 82.5,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [{ id: 12, code: "FY2026", name: "FY 2026", status: "OPEN" }],
          },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const dashboard = await getPerformanceDashboard("token")
    const years = await listPerformanceFinancialYears("token")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/performance/dashboard/summary",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/performance/financial-years",
      expect.objectContaining({ method: "GET" }),
    )
    expect(dashboard).toEqual(
      expect.objectContaining({
        open_reviews: 4,
        average_score: 82.5,
      }),
    )
    expect(years).toEqual([
      expect.objectContaining({
        id: 12,
        code: "FY2026",
      }),
    ])
  })

  it("creates a financial year, generates periods, and creates a KPI", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { id: 12 } }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ data: { generated: 12 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 88, code: "ATT-01" } }, { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    await createPerformanceFinancialYear("token", {
      code: "FY2026",
      name: "FY 2026",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
    })
    await generatePerformancePeriods("token", 12)
    await createPerformanceKpi("token", {
      code: "ATT-01",
      name: "Attendance",
      description: "On-time rate",
      measurement_unit: "%",
      measurement_direction: "HIGHER_IS_BETTER",
      scoring_formula: "PERCENT_TO_TARGET",
      data_source_type: "ATTENDANCE",
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/performance/financial-years",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "FY2026",
          name: "FY 2026",
          start_date: "2026-01-01",
          end_date: "2026-12-31",
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/performance/financial-years/12/generate-periods",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/performance/kpis",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("creates a KPI version on an existing definition", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ data: { id: 88, currentVersionId: 14 } }, { status: 201 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await createPerformanceKpiVersion("token", 88, {
      code: "ATT-01",
      name: "Attendance",
      description: "On-time rate v2",
      measurement_unit: "%",
      measurement_direction: "HIGHER_IS_BETTER",
      scoring_formula: "PERCENT_TO_TARGET",
      data_source_type: "ATTENDANCE",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/performance/kpis/88/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "ATT-01",
          name: "Attendance",
          description: "On-time rate v2",
          measurement_unit: "%",
          measurement_direction: "HIGHER_IS_BETTER",
          scoring_formula: "PERCENT_TO_TARGET",
          data_source_type: "ATTENDANCE",
        }),
      }),
    )
  })

  it("loads self and manager summaries and submits reviews", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { current_score: 78 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [{ id: 9, status: "SELF_REVIEW_PENDING" }],
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { team_size: 6 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 9, status: "MANAGER_REVIEW_PENDING" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 9, status: "HR_REVIEW_PENDING" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 9, status: "APPROVED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 3 } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            items: [{ id: 3, status: "OPEN" }],
          },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    await getMyPerformanceSummary("token")
    const reviews = await listMyPerformanceReviews("token")
    await getManagerPerformanceSummary("token")
    await submitMyPerformanceSelfReview("token", 41, { comment: "Met the target." })
    await submitManagerPerformanceReview("token", 41, {
      review: { comment: "Strong quarter." },
      areas_of_strength: ["Delivery"],
    })
    await approvePerformanceReview("token", 41, { publish: true })
    await createPerformanceImprovementPlan("token", 9, {
      summary: "Raise close rate",
      objectives: ["Shadow top performer"],
      milestones: [{ title: "Week 2 review", due_date: "2026-09-01" }],
    })
    const pips = await listPerformanceImprovementPlans("token")

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/performance/me/summary",
      expect.objectContaining({ method: "GET" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:8888/api/performance/me/reviews/41/self-review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ review: { comment: "Met the target." } }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:8888/api/performance/manager/reviews/41/submit",
      expect.objectContaining({ method: "POST" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "http://localhost:8888/api/performance/reviews/41/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ publish: true }),
      }),
    )
    expect(reviews).toEqual([expect.objectContaining({ id: 9 })])
    expect(pips).toEqual([expect.objectContaining({ id: 3 })])
  })

  it("loads KPI definitions and applicability rules and sends supported rule scope fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 8, code: "SALES", name: "Sales" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 19, kpiDefinitionVersionId: 11, departmentId: 3 }]))
      .mockResolvedValueOnce(jsonResponse({ id: 20, kpiDefinitionVersionId: 11 }))
    vi.stubGlobal("fetch", fetchMock)

    const kpis = await listPerformanceKpis("token")
    const rules = await listPerformanceKpiRules("token")
    await createPerformanceKpiRule("token", {
      kpi_definition_version_id: 11,
      branch_id: 2,
      department_id: 3,
      position_id: 4,
      grade_id: 5,
      employee_id: 6,
      employment_type: "FULL_TIME",
      financial_year_id: 7,
      review_cycle: "QUARTERLY",
      template_code: "SALES_QTR",
      weight_override: 25,
      target_override: 100,
    })

    expect(kpis).toEqual([{ id: 8, code: "SALES", name: "Sales" }])
    expect(rules).toEqual([{ id: 19, kpiDefinitionVersionId: 11, departmentId: 3 }])
    expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:8888/api/performance/kpis", expect.objectContaining({ method: "GET" }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8888/api/performance/kpi-rules", expect.objectContaining({ method: "GET" }))
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/performance/kpi-rules",
      expect.objectContaining({ method: "POST", body: JSON.stringify({
        kpi_definition_version_id: 11,
        branch_id: 2,
        department_id: 3,
        position_id: 4,
        grade_id: 5,
        employee_id: 6,
        employment_type: "FULL_TIME",
        financial_year_id: 7,
        review_cycle: "QUARTERLY",
        template_code: "SALES_QTR",
        weight_override: 25,
        target_override: 100,
      }) }),
    )
  })
})
