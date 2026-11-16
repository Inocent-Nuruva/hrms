import { describe, expect, it } from "vitest";
import { missingInheritedReasons } from "./contract-workspace-inheritance";

describe("inherited override reasons", () => {
  it("requires reasons for existing overrides and references without using labels as IDs", () => {
    const contract = {
      salaryHidden: true,
      particulars: {
        field_overrides: {
          salary: null,
          job_title: "Nurse",
          work_location: "Legacy text",
        },
        refs: { department_id: 7 },
        override_reasons: { job_title: "Agreed role" },
      },
    } as never;
    expect(missingInheritedReasons(contract)).toEqual(
      expect.arrayContaining(["salary", "work_location", "department"]),
    );
    expect(missingInheritedReasons(contract)).not.toContain("job_title");
    expect(missingInheritedReasons(contract)).not.toContain("position_id");
  });
  it("recognizes a valid hidden salary reason without receiving its text", () => {
    const contract = {
      salaryHidden: true,
      salary_override_reason_valid: true,
      particulars: {
        field_overrides: { salary: null },
        override_reasons: { salary: null },
      },
    } as never;
    expect(missingInheritedReasons(contract)).toEqual([]);
  });
});
