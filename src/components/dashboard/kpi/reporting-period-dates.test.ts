import { describe, expect, it } from "vitest";
import { monthEndPosition, monthNumber, monthPosition, periodDate, periodDateRange, periodDayCount } from "./reporting-period-dates";

describe("reporting period dates", () => {
  it("keeps date-only boundaries stable across months and years", () => {
    expect(periodDateRange("2026-11-26", "2026-11-30")).toBe("26–30 Nov 2026");
    expect(periodDateRange("2026-11-26", "2026-12-01")).toBe("26 Nov – 1 Dec 2026");
    expect(periodDateRange("2026-12-30", "2027-01-03")).toBe("30 Dec 2026 – 3 Jan 2027");
    expect(periodDayCount("2026-12-30", "2027-01-03")).toBe(5);
    expect(periodDate("2026-02-30")).toBeNull();
  });

  it("positions inclusive timeline bars using each month's real length", () => {
    const november = monthNumber(periodDate("2026-11-01")!);
    expect(monthPosition(periodDate("2026-11-26")!, november)).toBeCloseTo(25 / 30);
    expect(monthEndPosition(periodDate("2026-12-01")!, november)).toBeCloseTo(1 + 1 / 31);
    expect(monthEndPosition(periodDate("2026-11-30")!, november)).toBe(1);
  });
});
