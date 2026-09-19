import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMyEmployeeKpi,
  listManagerEmployeeKpis,
  listMyEmployeeKpis,
  listMyPerformanceAssignments,
  reviewManagerEmployeeKpi,
  submitMyEmployeeKpis,
  updateMyEmployeeKpiActual,
} from "./admin-api";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("employee KPI API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates and submits an employee KPI set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 7, status: "DRAFT" } }, 201),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [{ id: 7, status: "DRAFT" }] } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { items: [{ id: 7, status: "SUBMITTED" }] } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createMyEmployeeKpi("token", {
      performance_period_id: 3,
      title: "Acquire customers",
      description: "Acquire 20 customers",
      measurement_type: "NUMBER",
      target_value: 20,
      unit: "Customers",
      weight: 100,
      due_date: "2026-09-30",
    });
    const drafts = await listMyEmployeeKpis("token", {
      performance_period_id: 3,
      status: "DRAFT",
    });
    await submitMyEmployeeKpis("token", 3);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/performance/me/kpis?performance_period_id=3&status=DRAFT",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/performance/me/kpis/periods/3/submit",
      expect.objectContaining({ method: "POST" }),
    );
    expect(drafts).toEqual([expect.objectContaining({ id: 7 })]);
  });

  it("surfaces the permissions-guard message from GET /api/performance/me/kpis", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          statusCode: 403,
          message: "You do not have permission to perform this action",
        },
        403,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listMyEmployeeKpis("token")).rejects.toMatchObject({
      status: 403,
      message: "You do not have permission to perform this action",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/performance/me/kpis",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("loads the employee assignment list instead of HR performance periods", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: {
          items: [
            {
              id: 91,
              performancePeriodId: 3,
              performancePeriod: { id: 3, name: "Q1 2026", status: "OPEN" },
            },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const assignments = await listMyPerformanceAssignments("token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8888/api/performance/me/assignments",
      expect.objectContaining({ method: "GET" }),
    );
    expect(assignments).toEqual([
      expect.objectContaining({
        id: 91,
        performancePeriodId: 3,
      }),
    ]);
  });

  it("supports scoped manager review and manual progress updates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { items: [{ id: 7 }] } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 7, status: "RETURNED" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { id: 7, actualValue: "15" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await listManagerEmployeeKpis("token", {
      status: "SUBMITTED",
      employee_id: 11,
    });
    await reviewManagerEmployeeKpi("token", 7, "RETURN", "Clarify the target.");
    await updateMyEmployeeKpiActual("token", 7, 15);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8888/api/performance/manager/kpis?status=SUBMITTED&employee_id=11",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8888/api/performance/manager/kpis/7/review",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          decision: "RETURN",
          comment: "Clarify the target.",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:8888/api/performance/me/kpis/7/actual",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ actual_value: 15 }),
      }),
    );
  });
});
