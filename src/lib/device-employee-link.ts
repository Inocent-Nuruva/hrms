/** An assignment row's `id` identifies the assignment, not an HR employee. */
export function deviceAssignmentEmployeeId(row: Record<string, unknown>): number | null {
  for (const key of ["employee_id", "employeeId"]) {
    const value = row[key];
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    if (Number.isSafeInteger(number) && number > 0) return number;
  }
  return null;
}
