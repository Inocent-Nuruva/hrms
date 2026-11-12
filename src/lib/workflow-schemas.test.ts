import { describe, expect, it } from "vitest";
import { activityTaskSchema, workflowDate } from "./workflow-schemas";

const task = {
  title: "Prepare report",
  description: "Review source records",
  activity_date: "2026-10-12",
  start_time: "09:00",
  end_time: "10:00",
  priority: "MEDIUM",
  audience: "self",
  employeeIds: [],
  checklistItems: [],
};

describe("activity task validation", () => {
  it("rejects invalid dates and reversed schedules", () => {
    expect(workflowDate.safeParse("2026-02-30").success).toBe(false);
    expect(activityTaskSchema.safeParse(task).success).toBe(true);
    expect(activityTaskSchema.safeParse({ ...task, end_time: "08:59" }).success).toBe(false);
    expect(activityTaskSchema.safeParse({ ...task, due_date: "2026-10-11" }).success).toBe(false);
    expect(activityTaskSchema.safeParse({ ...task, audience: "employee" }).success).toBe(false);
  });
});
