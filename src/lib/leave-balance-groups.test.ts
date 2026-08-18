import { describe, expect, it } from "vitest"

import {
  formatBalanceDays,
  groupLeaveBalancesByEmployee,
  sortLeaveBalanceRows,
} from "./leave-balance-groups"

describe("groupLeaveBalancesByEmployee", () => {
  it("collapses every leave type for the same employee into one row", () => {
    const grouped = groupLeaveBalancesByEmployee(
      [
        {
          employee_id: 12,
          employee_name: "Audifas August Riwa",
          leave_type_name: "Sick Leave",
          fiscal_year: "2026",
          allocated_days: "126.00",
          used_days: "0.00",
          remaining_days: "126.00",
        },
        {
          employee_id: 12,
          employee_name: "Audifas August Riwa",
          leave_type_name: "Annual Leave",
          fiscal_year: "2026",
          allocated_days: 28,
          used_days: 0,
          remaining_days: 13,
        },
        {
          employee_id: 12,
          employee_name: "Audifas August Riwa",
          leave_type_name: "Maternity Leave",
          fiscal_year: "2026",
          allocated_days: 84,
          used_days: 0,
          remaining_days: 84,
        },
      ],
      (row) => String(row.employee_name),
    )

    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.employeeName).toBe("Audifas August Riwa")
    expect(grouped[0]?.typeCount).toBe(3)
    expect(grouped[0]?.fiscalYears).toEqual(["2026"])
    expect(grouped[0]?.allocatedDays).toBe(238)
    expect(grouped[0]?.usedDays).toBe(0)
    expect(grouped[0]?.remainingDays).toBe(223)
    expect(grouped[0]?.rows).toHaveLength(3)
  })

  it("keeps different employees on their own rows", () => {
    const grouped = groupLeaveBalancesByEmployee(
      [
        { employee_id: 1, employee_name: "Jane Doe", allocated_days: 10, used_days: 2, remaining_days: 8 },
        { employee_id: 2, employee_name: "John Smith", allocated_days: 5, used_days: 1, remaining_days: 4 },
        { employee_id: 1, employee_name: "Jane Doe", allocated_days: 4, used_days: 0, remaining_days: 4 },
      ],
      (row) => String(row.employee_name),
    )

    expect(grouped.map((group) => group.employeeName)).toEqual(["Jane Doe", "John Smith"])
    expect(grouped[0]?.typeCount).toBe(2)
    expect(grouped[1]?.typeCount).toBe(1)
  })

  it("groups by employee name when an id is missing", () => {
    const grouped = groupLeaveBalancesByEmployee(
      [
        { employee_name: "No Id", allocated_days: 3, remaining_days: 3 },
        { employee_name: "No Id", allocated_days: 2, remaining_days: 1 },
      ],
      (row) => String(row.employee_name),
    )

    expect(grouped).toHaveLength(1)
    expect(grouped[0]?.key).toBe("name:no id")
    expect(grouped[0]?.typeCount).toBe(2)
  })
})

describe("sortLeaveBalanceRows", () => {
  it("sorts types alphabetically within the fiscal year", () => {
    const sorted = sortLeaveBalanceRows(
      [
        { leave_type_name: "Sick Leave", fiscal_year: "2026" },
        { leave_type_name: "Annual Leave", fiscal_year: "2026" },
        { leave_type_name: "Compassionate Leave", fiscal_year: "2025" },
      ],
      (row) => String(row.leave_type_name),
    )

    expect(sorted.map((row) => row.leave_type_name)).toEqual([
      "Compassionate Leave",
      "Annual Leave",
      "Sick Leave",
    ])
  })
})

describe("formatBalanceDays", () => {
  it("formats finite totals to two decimals", () => {
    expect(formatBalanceDays(126)).toBe("126.00")
    expect(formatBalanceDays(13)).toBe("13.00")
    expect(formatBalanceDays(Number.NaN)).toBe("0.00")
  })
})
