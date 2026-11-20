import { describe, expect, it } from "vitest";
import { deviceAssignmentEmployeeId } from "./device-employee-link";

describe("device employee linkage", () => {
  it("does not mistake an assignment id for a linked employee", () => {
    expect(deviceAssignmentEmployeeId({ id: 104, employee_id: null })).toBeNull();
    expect(deviceAssignmentEmployeeId({ id: 104 })).toBeNull();
  });
  it("accepts a valid linked employee id", () => {
    expect(deviceAssignmentEmployeeId({ id: 104, employee_id: 23 })).toBe(23);
    expect(deviceAssignmentEmployeeId({ employeeId: "23" })).toBe(23);
    expect(deviceAssignmentEmployeeId({ employee_id: 0 })).toBeNull();
  });
});
