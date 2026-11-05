import { describe, expect, it } from "vitest";
import {
  activityTaskSchema,
  employeeKpiFormSchema,
  performanceFormSchema,
  weightsTotalExactly100,
  workflowDate,
} from "./workflow-schemas";

const task = {
  title: "Prepare report",
  description: "Review source records",
  activity_date: "2026-10-12",
  start_time: "09:00",
  end_time: "10:00",
  priority: "MEDIUM",
  performance_relevance: "NOT_EVALUATED",
  audience: "self",
  employeeIds: [],
  checklistItems: [],
};

describe("wizard step validation", () => {
  it("accepts an optional performance-step skip with an explanation", () => {
    const schema = performanceFormSchema("workflow-action");
    expect(
      schema.safeParse({
        review_id: "50",
        decision: "SKIP",
        comment: "Not applicable",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ review_id: "50", decision: "SKIP", comment: "" })
        .success,
    ).toBe(false);
  });
  it("rejects rollover calendar dates and reversed task schedules before submission", () => {
    expect(workflowDate.safeParse("2026-02-30").success).toBe(false);
    expect(activityTaskSchema.safeParse(task).success).toBe(true);
    expect(
      activityTaskSchema.safeParse({ ...task, end_time: "08:59" }).success,
    ).toBe(false);
    expect(
      activityTaskSchema.safeParse({ ...task, due_date: "2026-10-11" }).success,
    ).toBe(false);
    expect(
      activityTaskSchema.safeParse({ ...task, audience: "employee" }).success,
    ).toBe(false);
    expect(
      activityTaskSchema.safeParse({
        ...task,
        performance_relevance: "KEY_DELIVERABLE",
      }).success,
    ).toBe(true);
    expect(
      activityTaskSchema.safeParse({
        ...task,
        performance_relevance: "BUSY_WORK",
      }).success,
    ).toBe(false);
  });
  it("uses exact persisted weight precision and preserves decimal totals", () => {
    expect(weightsTotalExactly100(["33.33", "33.33", "33.34"])).toBe(true);
    expect(weightsTotalExactly100(["50", "49.999"])).toBe(false);
    expect(weightsTotalExactly100(["100", "-1", "1"])).toBe(false);
    expect(weightsTotalExactly100(["abc"])).toBe(false);
    expect(weightsTotalExactly100(["100", "0"], true)).toBe(true);
  });
  it("rejects duplicate KPI versions even if template weights total 100", () => {
    const schema = performanceFormSchema("template");
    const input = {
      code: "SALES",
      name: "Sales",
      kpi_definition_version_id: "1",
      weight: "50",
      applicable_role_ids: "2",
      additionalTemplateItems: [{ versionId: "1", weight: "50", target: "" }],
    };
    expect(schema.safeParse(input).success).toBe(false);
    expect(
      schema.safeParse({
        ...input,
        additionalTemplateItems: [{ versionId: "3", weight: "50", target: "" }],
      }).success,
    ).toBe(true);
  });
  it("matches the existing workflow draft properties and blocks duplicate sequences", () => {
    const schema = performanceFormSchema("workflow");
    const step = {
      code: "MANAGER",
      label: "Manager",
      type: "MANAGER_REVIEW",
      sequenceNumber: "1",
      required: true,
      canFinalize: false,
    };
    expect(
      schema.safeParse({
        code: "DEFAULT",
        name: "Default",
        workflowSteps: [step],
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        code: "DEFAULT",
        name: "Default",
        workflowSteps: [step, { ...step, code: "HR" }],
      }).success,
    ).toBe(false);
  });
  it("rejects nonfinite KPI targets while retaining all supported measurement types", () => {
    const schema = employeeKpiFormSchema("create", false);
    const input = {
      performance_period_id: "1",
      title: "Revenue",
      description: "Monthly revenue",
      measurement_type: "CURRENCY",
      due_date: "2026-10-30",
      weight: "100",
      target_value: "10000",
    };
    expect(schema.safeParse(input).success).toBe(true);
    expect(schema.safeParse({ ...input, target_value: "NaN" }).success).toBe(
      false,
    );
  });
});
