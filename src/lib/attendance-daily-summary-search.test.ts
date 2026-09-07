import { describe, expect, it } from "vitest"

import {
  filterRowsByEmployeeNameSearch,
  matchesEmployeeNameSearch,
} from "./attendance-daily-summary-search"

const elizabeth = {
  employee_id: 12,
  employee_name: "Elizabeth Martin Ndaro",
  employee_no: "A-012",
  branch_name: "Head Office",
  attendance_status: "PRESENT",
  check_in_time: "08:20",
}

const malekela = {
  employee_id: 88,
  employee_name: "John Malekela",
  employee_no: "A-088",
  first_name: "John",
  last_name: "Malekela",
  attendance_status: "PRESENT",
}

describe("daily summary name search", () => {
  it("does not treat Elizabeth as a match for malekela or emmy", () => {
    expect(matchesEmployeeNameSearch(elizabeth, "malekela")).toBe(false)
    expect(matchesEmployeeNameSearch(elizabeth, "emmy")).toBe(false)
    expect(filterRowsByEmployeeNameSearch([elizabeth, malekela], "malekela")).toEqual([
      malekela,
    ])
  })

  it("matches last name and nested employee name", () => {
    expect(matchesEmployeeNameSearch(malekela, "malekela")).toBe(true)
    expect(
      matchesEmployeeNameSearch(
        {
          employee_id: 9,
          employee: { first_name: "Emmy", last_name: "Hassan" },
        },
        "emmy",
      ),
    ).toBe(true)
  })

  it("does not match unrelated payload fields", () => {
    expect(
      matchesEmployeeNameSearch(
        {
          employee_name: "Elizabeth Martin Ndaro",
          remarks: "asked malekela to cover",
          email: "emmy.backup@example.com",
        },
        "malekela",
      ),
    ).toBe(false)
  })
})
