import { describe, expect, it } from "vitest";
import { directDraftBody } from "./contract-workspace-direct";
import type { ContractDetail } from "@/lib/contracts-api";

const contract = { particulars: { mode: "live" } } as unknown as ContractDetail;
const state = {
  legacyValues: {},
  values: {
    contract_type: "UNSPECIFIED",
    title: "Contract",
    start_date: "2026-01-01",
    end_date: "",
    probation_months: "3",
    place_of_recruitment: "",
    job_description: "",
    benefits: "",
    task_description: "",
  },
  probationReason: "",
  overrides: { salary: "2000" },
  refs: { department_id: 2 },
  reasons: {},
  sections: [],
  signatoryId: null,
  revisions: { "override:salary": 1, "ref:department_id": 2 },
  sequence: 2,
};
describe("live override and reference save gates", () => {
  it("keeps valid direct edits while excluding an override with an invalid reason", () => {
    const result = directDraftBody(
      {
        ...state,
        values: { ...state.values, place_of_recruitment: "Arusha" },
        revisions: { place_of_recruitment: 3, "override:salary": 1 },
      },
      contract,
    );
    expect(result.issue).toBe("reason_required");
    expect(result.body).toMatchObject({ place_of_recruitment: "Arusha" });
    expect(result.body).not.toHaveProperty("field_overrides");
    expect(result.included).toContain("place_of_recruitment");
  });
  it("omits incomplete overrides and references instead of sending them", () => {
    const result = directDraftBody(state, contract);
    expect(result.issue).toBe("reason_required");
    expect(result.body).not.toHaveProperty("field_overrides");
    expect(result.body).not.toHaveProperty("refs");
  });
  it("sends valid reasons and represents resets explicitly", () => {
    const valid = directDraftBody(
      { ...state, reasons: { salary: "Agreed", department: "Transfer" } },
      contract,
    );
    expect(valid.body).toMatchObject({
      field_overrides: { salary: "2000" },
      refs: { department_id: 2 },
      override_reasons: { salary: "Agreed", department: "Transfer" },
    });
    const cleared = directDraftBody(
      { ...state, overrides: { salary: "" }, refs: { department_id: null } },
      contract,
    );
    expect(cleared.body).toMatchObject({
      field_overrides: { salary: "" },
      refs: { department_id: null },
    });
  });
});

describe("legacy draft patches", () => {
  const legacy = {
    particulars: {
      mode: "legacy",
      field_overrides: { job_title: "Printed title" },
    },
  } as unknown as ContractDetail;
  it("preserves an existing override when editing its displayed value, without writing refs", () => {
    const result = directDraftBody(
      {
        ...state,
        legacyValues: {
          contract_type: "UNSPECIFIED",
          start_date: "2026-01-01",
          job_title: "Revised title",
        },
        overrides: { job_title: "Printed title" },
        revisions: { "legacy:job_title": 3 },
      },
      legacy,
    );
    expect(result.body).toEqual({
      field_overrides: { job_title: "Revised title" },
    });
    expect(result.body).not.toHaveProperty("refs");
  });
  it("writes legacy flat fields and explicitly clears overrides", () => {
    const result = directDraftBody(
      {
        ...state,
        legacyValues: {
          contract_type: "UNSPECIFIED",
          start_date: "2026-01-01",
          hours_of_work: "40",
        },
        overrides: { job_title: "" },
        revisions: { "legacy:hours_of_work": 3, "override:job_title": 4 },
      },
      legacy,
    );
    expect(result.body).toEqual({
      hours_of_work: "40",
      field_overrides: { job_title: "" },
    });
  });
});
