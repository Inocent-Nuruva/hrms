import { describe, expect, it } from "vitest";
import type { Scorecard } from "@/lib/scorecard-api";
import { scorecardDisplay } from "./scorecard-collection-model";

function fixture(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    id: 2,
    code: "BOSCO_NOVEMBER",
    subjectType: "employee",
    subjectId: 3,
    periodId: 1,
    managerEmployeeId: null,
    status: "published",
    currentVersion: { id: 1, version: 1, name: "Bosco November KPI scorecard", description: null, mode: "weighted", policyVersionId: 1, entries: [], publishedAt: "2026-11-01" },
    versions: [],
    entries: [{ assignmentId: 1 }, { assignmentId: 2 }] as Scorecard["entries"],
    period: { label: "KPI QA — November 2026", startDate: "2026-11-01", endDate: "2026-11-30" },
    overallScore: "67.33",
    completenessPercent: "100",
    performanceStatus: "scored",
    ...overrides,
  };
}

describe("scorecard collection display", () => {
  it("uses actual score, completeness, count and reporting period data", () => {
    expect(scorecardDisplay(fixture())).toMatchObject({
      periodName: "November 2026", secondaryLabel: "KPI QA", scoreText: "67.33%",
      scoreProgress: 67.33, completenessText: "100%", isComplete: true, kpiCount: 2,
    });
  });
  it("distinguishes a genuine zero from a missing score", () => {
    expect(scorecardDisplay(fixture({ overallScore: "0" })).scoreText).toBe("0%");
    expect(scorecardDisplay(fixture({ overallScore: null })).scoreText).toBe("Awaiting data");
    expect(scorecardDisplay(fixture({ overallScore: "", performanceStatus: "partial" })).hasScore).toBe(false);
  });
  it("shows scores over 100 while capping only the visual indicator", () => {
    expect(scorecardDisplay(fixture({ overallScore: "124.5" }))).toMatchObject({ scoreText: "124.5%", scoreProgress: 100 });
  });
  it("shows partial and missing completeness without a success indicator", () => {
    expect(scorecardDisplay(fixture({ completenessPercent: "50" }))).toMatchObject({ completenessText: "50%", completenessProgress: 50, isComplete: false });
    expect(scorecardDisplay(fixture({ completenessPercent: undefined }))).toMatchObject({ completenessText: "—", completenessProgress: 0, isComplete: false });
  });
  it("keeps lifecycle status when the record is a draft", () => {
    expect(scorecardDisplay(fixture({ status: "draft" })).status).toBe("draft");
  });
});
