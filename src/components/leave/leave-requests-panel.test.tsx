import { describe, expect, it } from "vitest"

import { describeProgress, formatLeavePeriod } from "./leave-requests-panel"

const progress = (overrides: Record<string, unknown>) => ({
  total_levels: 3,
  completed_levels: 0,
  current_position: null,
  rejected_at_position: null,
  state: "pending",
  ...overrides,
})

describe("formatLeavePeriod", () => {
  it("keeps one year when the leave stays within it", () => {
    expect(formatLeavePeriod("2026-11-18", "2026-11-23")).toBe("18 Nov – 23 Nov 2026")
  })
  it("shows both years when the leave crosses a year", () => {
    expect(formatLeavePeriod("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 – 3 Jan 2027")
  })
  it("shows a single day once", () => {
    expect(formatLeavePeriod("2026-11-18", "2026-11-18")).toBe("18 Nov 2026")
  })
})

describe("describeProgress", () => {
  it("names the active level while pending", () => {
    expect(
      describeProgress({
        status: "in_review",
        approval_progress: progress({ completed_levels: 1, current_position: 2 }),
      }),
    ).toBe("Level 2 of 3 · Pending")
  })
  it("reports full approval", () => {
    expect(
      describeProgress({ status: "approved", approval_progress: progress({ completed_levels: 3 }) }),
    ).toBe("3 of 3 · Approved")
  })
  it("names the level that rejected", () => {
    expect(
      describeProgress({
        status: "rejected",
        approval_progress: progress({ completed_levels: 1, rejected_at_position: 2 }),
      }),
    ).toBe("Rejected at Level 2")
  })
  it("describes drafts and returned requests without levels", () => {
    expect(describeProgress({ status: "draft" })).toBe("Not submitted")
    expect(describeProgress({ status: "returned_for_correction" })).toBe("Returned for changes")
  })
})
