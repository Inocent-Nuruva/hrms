import { afterEach, describe, expect, it, vi } from "vitest";
import { kpiAnalyticsApi } from "./kpi-analytics-api";

afterEach(() => vi.unstubAllGlobals());

function mockJson(value: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Phase 5 analytics API client", () => {
  it("calls the authorized read-only summary with bounded period filter", async () => {
    const fetchMock = mockJson({
      assignments: { total: 0 },
      overallIndex: null,
    });
    await kpiAnalyticsApi.overview("synthetic-token", { periodId: 12 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/api\/hr\/kpi\/analytics\/overview\?periodId=12$/,
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer synthetic-token",
        }),
      }),
    );
  });

  it("uses the session for personal analytics and sends no employee id", async () => {
    const fetchMock = mockJson({ rows: [], total: 0 });
    await kpiAnalyticsApi.scorecards("employee-token", { limit: 10 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/analytics/scorecards?limit=10",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("employeeId");
  });

  it("requests comparable department scorecards for one period", async () => {
    const fetchMock = mockJson({ rows: [], policyVersionId: null });
    await kpiAnalyticsApi.comparisons("management-token", {
      periodId: 3,
      comparisonType: "department",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /periodId=3&comparisonType=department/,
    );
  });

  it("requests personal scorecard history without accepting an employee identifier", async () => {
    const fetchMock = mockJson({ points: [] });
    await kpiAnalyticsApi.scorecardTrends("employee-token");
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(
      /\/analytics\/scorecard-trends$/,
    );
  });

  it("encodes assignment-only KPI filters", async () => {
    const fetchMock = mockJson({ assignments: { total: 0 } });
    await kpiAnalyticsApi.overview("hr-token", {
      category: "Claims & Service",
      approvalStatus: "pending",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "category=Claims+%26+Service&approvalStatus=pending",
    );
  });

  it("combines scope, scorecard, and review filters in one request", async () => {
    const fetchMock = mockJson({ rows: [], total: 0 });
    await kpiAnalyticsApi.scorecards("hr-token", {
      employeeId: 17,
      managerId: 5,
      periodId: 3,
      definitionId: 9,
      scorecardType: "employee",
      approvalStatus: "approved",
      evaluationStatus: "finalized",
      page: 2,
      limit: 10,
    });
    const url = new URL(
      String(fetchMock.mock.calls[0]?.[0]),
      "http://local.test",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      employeeId: "17",
      managerId: "5",
      periodId: "3",
      definitionId: "9",
      scorecardType: "employee",
      approvalStatus: "approved",
      evaluationStatus: "finalized",
      page: "2",
      limit: "10",
    });
  });

  it("searches bounded authorized subject options", async () => {
    const fetchMock = mockJson({ employees: [], managers: [], limit: 30 });
    await kpiAnalyticsApi.subjects("manager-token", { search: "Amina" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/analytics/subjects?search=Amina",
    );
  });
});
