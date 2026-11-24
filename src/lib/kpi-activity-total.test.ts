import { describe, expect, it } from "vitest";
import { numericActivityTotal } from "./kpi-activity-total";

describe("numeric activity totals", () => {
  it("adds finite numeric results without floating point drift and ignores other results", () => {
    expect(numericActivityTotal([0.1, 0.2, null, "3", { completed: 1, eligible: 2 }, Infinity])).toEqual({ total: "0.3", count: 2 });
  });
  it("preserves zero and returns no total when no numeric results exist", () => {
    expect(numericActivityTotal([0])).toEqual({ total: "0", count: 1 });
    expect(numericActivityTotal([null, "", "3"])).toBeNull();
  });
});
