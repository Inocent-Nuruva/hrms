import { describe, expect, it } from "vitest";
import {
  serializeContractWorkspace,
  type ContractWorkspaceModel,
} from "./contract-workspace-adapters";

const base: ContractWorkspaceModel = {
  mode: "live",
  contractType: "UNSPECIFIED",
  startDate: "2026-01-01",
  endDate: "",
  title: "Contract",
  fields: {},
  refs: {},
  overrides: {},
  savedOverrides: {},
  reasons: {},
  savedReasons: {},
  partTime: false,
  assignedSignatoryId: null,
  sections: [],
  salaryHidden: false,
};

describe("contract draft serialization", () => {
  it("keeps invalid overrides local while saving other fields", () => {
    const result = serializeContractWorkspace(
      { ...base, overrides: { salary: "2000" }, reasons: { salary: "x" } },
      "v1",
    );
    expect(result.errors).toEqual({ salary: "reason_required" });
    expect(result.payload.field_overrides).toEqual({});
    expect(result.payload.refs).toEqual({});
  });
  it("sends an explicit clear for existing overrides", () => {
    const result = serializeContractWorkspace(
      {
        ...base,
        savedOverrides: { salary: "1500" },
        savedReasons: { salary: "Agreed" },
      },
      "v1",
    );
    expect(result.payload.field_overrides).toEqual({ salary: "" });
  });
  it("preserves the legacy flat value and text override separately", () => {
    const result = serializeContractWorkspace(
      {
        ...base,
        mode: "legacy",
        fields: { job_title: "Column" },
        overrides: { job_title: "Printed" },
        reasons: { job_title: "Reason" },
      },
      "v1",
    );
    expect(result.payload).toMatchObject({
      job_title: "Column",
      field_overrides: { job_title: "Printed" },
    });
    expect(result.payload).not.toHaveProperty("mode");
    expect(result.payload).not.toHaveProperty("refs");
  });
});
