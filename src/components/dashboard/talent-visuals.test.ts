import { describe, expect, it } from "vitest"

import { employeeLabel } from "./talent-visuals"

describe("employeeLabel", () => {
  it("uses the employee snapshot name before falling back to an id", () => {
    expect(
      employeeLabel({
        employeeId: 42,
        employeeSnapshot: { full_name: "Inocent Nuruva" },
      }),
    ).toBe("Inocent Nuruva")
  })

  it("supports snake-case employee snapshots returned by older endpoints", () => {
    expect(
      employeeLabel({
        employee_id: 42,
        employee_snapshot: { fullName: "Emmy Malekela" },
      }),
    ).toBe("Emmy Malekela")
  })
})
