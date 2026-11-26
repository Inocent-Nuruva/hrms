import { describe, expect, it } from "vitest";
import type { Scorecard, ScorecardEntry } from "@/lib/scorecard-api";
import { formatReportNumber, formatReportPercent, reportActual, reportComparison, reportContributions, reportTarget } from "./scorecard-report-model";

function entry(index: number, weightedScore: string | null = "13.333333333333"): ScorecardEntry {
  return { assignmentId: index, definitionVersionId: index, targetRevisionId: index, weight: "40", required: true, kpiName: `KPI ${index}`, measurementType: "percentage", direction: "lower", measurementUnit: "%", target: { value: 90 }, actual: 30, achievement: "33.333333333333", weightedScore, status: "scored" };
}
function card(entries: ScorecardEntry[], mode: "weighted" | "strategic" = "weighted"): Scorecard {
  return { id: 2, code: "QA", subjectType: "employee", subjectId: 3, periodId: 1, managerEmployeeId: null, status: "published", currentVersion: { id: 2, version: 1, name: "QA", description: null, mode, policyVersionId: 1, publishedAt: "2026-11-01", entries }, versions: [], entries, period: { label: "November", startDate: "2026-11-01", endDate: "2026-11-30" }, overallScore: "67.333333333333", completenessPercent: "100", performanceStatus: "scored" };
}

describe("scorecard report presentation", () => {
  it("formats precision for display while preserving zero and source values", () => {
    const raw = "33.333333333333";
    expect(formatReportPercent(raw)).toBe("33.33%");
    expect(formatReportNumber("54", true)).toBe("54.00");
    expect(formatReportNumber("0", true)).toBe("0.00");
    expect(formatReportPercent(null)).toBe("—");
    expect(raw).toBe("33.333333333333");
  });
  it("uses actual weighted contributions for one, two, five and ten KPIs", () => {
    for (const count of [1, 2, 5, 10]) {
      const rows = Array.from({ length: count }, (_, index) => entry(index + 1, String(index + 1)));
      const result = reportContributions(card(rows));
      expect(result.visualizable).toBe(true);
      expect(result.items).toHaveLength(count);
      expect(result.items.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(100);
      if (count > 1) expect(result.items.at(-1)?.share).toBeGreaterThan(result.items[0].share);
    }
  });
  it("keeps unavailable contributions separate and does not chart negative or strategic scores", () => {
    const partial = reportContributions(card([entry(1, "0"), entry(2, null), entry(3, "54")]));
    expect(partial.missing).toBe(1);
    expect(partial.items[0].value).toBe(0);
    expect(partial.items[1].value).toBeNull();
    expect(reportContributions(card([entry(1, "-4"), entry(2, "10")])).visualizable).toBe(false);
    expect(reportContributions(card([entry(1, "54")], "strategic")).visualizable).toBe(false);
  });
  it("compares supported numeric values without assuming higher is better", () => {
    const row = entry(1);
    expect(reportTarget(row)).toBe("90%");
    expect(reportActual(row)).toBe("30%");
    expect(reportComparison(row)).toMatchObject({ direction: "Lower is better", targetWidth: 100 });
    expect(reportComparison({ ...row, measurementType: "binary", actual: true })).toBeNull();
    expect(reportComparison({ ...row, direction: "exact" })).toBeNull();
    expect(reportTarget({ ...row, target: { min: 10, max: 20 } })).toBe("10%–20%");
  });
});
