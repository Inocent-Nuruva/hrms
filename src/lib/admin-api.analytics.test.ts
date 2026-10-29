import { afterEach, describe, expect, it, vi } from "vitest";

import {
  exportAnalyticsReport,
  getAnalyticsDashboard,
  getAnalyticsSalesFieldDetails,
  getAnalyticsFreshness,
  listAnalyticsDatasets,
  listAnalyticsMetrics,
  refreshAnalyticsDataset,
  runAnalyticsCustomReport,
  runAnalyticsReconciliation,
  runStatutoryReport,
} from "./admin-api";

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

describe("analytics admin API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the HR dashboard with the supported filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          headcount: 132,
          attendance_rate: 94,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAnalyticsDashboard("token", "hr", {
      date_from: "2026-07-01",
      date_to: "2026-07-31",
      branch_id: 4,
      department_id: 7,
      employee_id: 120,
      purpose: "dashboard",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/analytics/dashboards/hr?date_from=2026-07-01&date_to=2026-07-31&branch_id=4&department_id=7&employee_id=120&purpose=dashboard",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        headcount: 132,
        attendance_rate: 94,
      }),
    );
  });

  it("loads paginated sales-field details with identical dashboard filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          metric: "OPPORTUNITIES",
          currency: "TZS",
          rows: [{ plan_item_id: 12 }],
          pagination: { page: 2, limit: 10, total: 11, total_pages: 2 },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAnalyticsSalesFieldDetails("token", {
      metric: "OPPORTUNITIES",
      currency: "TZS",
      date_from: "2026-10-01",
      date_to: "2026-10-31",
      branch_id: 4,
      department_id: 7,
      employee_id: 120,
      page: 2,
      limit: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/analytics/dashboards/sales-field/details?date_from=2026-10-01&date_to=2026-10-31&branch_id=4&department_id=7&employee_id=120&metric=OPPORTUNITIES&page=2&limit=10&currency=TZS",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(result).toMatchObject({
      metric: "OPPORTUNITIES",
      rows: [{ plan_item_id: 12 }],
      pagination: { page: 2, total: 11 },
    });
  });

  it("lists datasets and metrics from analytics catalog endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              code: "hr_headcount",
              name: "HR Headcount",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              code: "headcount",
              name: "Headcount",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const datasets = await listAnalyticsDatasets("token");
    const metrics = await listAnalyticsMetrics("token");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/analytics/datasets",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/analytics/metrics",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(datasets).toEqual([
      expect.objectContaining({
        code: "hr_headcount",
      }),
    ]);
    expect(metrics).toEqual([
      expect.objectContaining({
        code: "headcount",
      }),
    ]);
  });

  it("loads freshness, runs custom reports, and queues exports", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            dataset_code: "attendance_daily",
            refreshed_at: "2026-08-14T10:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              department_name: "Engineering",
              headcount: 24,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: 81,
            status: "QUEUED",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const freshness = await getAnalyticsFreshness("token", "attendance_daily");
    const custom = await runAnalyticsCustomReport("token", {
      dataset_code: "hr_headcount",
      dimensions: ["department_name"],
      measures: ["headcount"],
      date_from: "2026-08-01",
      date_to: "2026-08-14",
      limit: 100,
    });
    const exportJob = await exportAnalyticsReport("token", {
      dataset_code: "hr_headcount",
      dimensions: ["department_name"],
      measures: ["headcount"],
      output_format: "CSV",
      idempotency_key: "analytics-export-1",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/analytics/freshness?dataset_code=attendance_daily",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/analytics/reports/custom",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dataset_code: "hr_headcount",
          dimensions: ["department_name"],
          measures: ["headcount"],
          date_from: "2026-08-01",
          date_to: "2026-08-14",
          limit: 100,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/analytics/exports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dataset_code: "hr_headcount",
          dimensions: ["department_name"],
          measures: ["headcount"],
          output_format: "CSV",
          idempotency_key: "analytics-export-1",
        }),
      }),
    );
    expect(freshness).toEqual([
      expect.objectContaining({
        dataset_code: "attendance_daily",
      }),
    ]);
    expect(custom).toEqual([
      expect.objectContaining({
        department_name: "Engineering",
      }),
    ]);
    expect(exportJob).toEqual(
      expect.objectContaining({
        id: 81,
        status: "QUEUED",
      }),
    );
  });

  it("runs refresh, reconciliation, and statutory report actions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { status: "QUEUED" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "STARTED" } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { report_code: "PAYE", status: "GENERATED" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const refresh = await refreshAnalyticsDataset("token", {
      dataset_code: "attendance_daily",
      refresh_mode: "FULL_REFRESH",
      date_from: "2026-08-01",
      date_to: "2026-08-14",
    });
    const reconciliation = await runAnalyticsReconciliation("token");
    const statutory = await runStatutoryReport("token", {
      report_code: "PAYE",
      date_from: "2026-08-01",
      date_to: "2026-08-14",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/analytics/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          dataset_code: "attendance_daily",
          refresh_mode: "FULL_REFRESH",
          date_from: "2026-08-01",
          date_to: "2026-08-14",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/analytics/reconciliation/run",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/analytics/statutory-reports/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          report_code: "PAYE",
          date_from: "2026-08-01",
          date_to: "2026-08-14",
        }),
      }),
    );
    expect(refresh).toEqual(expect.objectContaining({ status: "QUEUED" }));
    expect(reconciliation).toEqual(
      expect.objectContaining({ status: "STARTED" }),
    );
    expect(statutory).toEqual(
      expect.objectContaining({
        report_code: "PAYE",
      }),
    );
  });
});
