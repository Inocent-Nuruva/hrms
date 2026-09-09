import { describe, expect, it } from "vitest"

import {
  employeeBelongsToDirectory,
  employeeOwnsEmail,
  employeeOwnsPhone,
  filterEmployeesByDirectorySearch,
  formatEmployeeDirectoryPerson,
  getEmployeeDirectoryContactSummary,
  matchesEmployeeDirectorySearch,
} from "./employee-directory-search"

const jane = {
  id: 12,
  first_name: "Jane",
  last_name: "Doe",
  employee_no: "AICL/00012",
  email: "jane.doe@company.com",
  contacts: [
    {
      email: "jane.doe@company.com",
      phone_number: "+255 712 345 678",
      is_primary: true,
    },
  ],
}

const john = {
  id: 88,
  first_name: "John",
  last_name: "Malekela",
  employee_no: "AICL/00088",
  company_user: {
    user_no: "USR-88",
    email: "john.malekela@company.com",
    phone: "0712349999",
  },
}

describe("employee directory search", () => {
  it("routes historical statuses to the inactive directory", () => {
    for (const status of ["inactive", "resigned", "terminated", "retired", "exited"]) {
      expect(employeeBelongsToDirectory(status, "inactive")).toBe(true)
      expect(employeeBelongsToDirectory(status, "current")).toBe(false)
    }

    for (const status of ["onboarding", "pending", "active", "suspended", "offboarding"]) {
      expect(employeeBelongsToDirectory(status, "current")).toBe(true)
      expect(employeeBelongsToDirectory(status, "inactive")).toBe(false)
    }

    expect(employeeBelongsToDirectory(" Terminated ", "inactive")).toBe(true)
  })

  it("matches name and employee number", () => {
    expect(matchesEmployeeDirectorySearch(jane, "Jane")).toBe(true)
    expect(matchesEmployeeDirectorySearch(jane, "AICL/00012")).toBe(true)
    expect(matchesEmployeeDirectorySearch(jane, "malekela")).toBe(false)
  })

  it("matches email on the employee and nested contacts", () => {
    expect(matchesEmployeeDirectorySearch(jane, "jane.doe@company.com")).toBe(true)
    expect(matchesEmployeeDirectorySearch(jane, "jane.doe")).toBe(true)
    expect(matchesEmployeeDirectorySearch(john, "jane.doe@company.com")).toBe(false)
  })

  it("matches phone numbers across formatting and local prefixes", () => {
    expect(matchesEmployeeDirectorySearch(jane, "+255712345678")).toBe(true)
    expect(matchesEmployeeDirectorySearch(jane, "0712345678")).toBe(true)
    expect(matchesEmployeeDirectorySearch(jane, "712 345 678")).toBe(true)
    expect(matchesEmployeeDirectorySearch(jane, "0712349999")).toBe(false)
    expect(matchesEmployeeDirectorySearch(john, "0712349999")).toBe(true)
  })

  it("matches linked company-user email, phone, and user_no", () => {
    expect(matchesEmployeeDirectorySearch(john, "john.malekela@company.com")).toBe(true)
    expect(matchesEmployeeDirectorySearch(john, "USR-88")).toBe(true)
    expect(matchesEmployeeDirectorySearch(john, "+255712349999")).toBe(true)
  })

  it("matches and summarizes contact details nested under the linked company user", () => {
    const nestedAccount = {
      id: 145,
      employee_no: "AICL/00124",
      company_user: {
        status: "active",
        user: {
          email: "inocentnuruva@gmail.com",
          phone_number: "+255 616 698 346",
        },
      },
    }

    expect(matchesEmployeeDirectorySearch(nestedAccount, "255616698346")).toBe(true)
    expect(matchesEmployeeDirectorySearch(nestedAccount, "inocentnuruva@gmail.com")).toBe(true)
    expect(getEmployeeDirectoryContactSummary(nestedAccount)).toEqual({
      phone_number: "+255 616 698 346",
      email: "inocentnuruva@gmail.com",
    })
  })

  it("filters a directory by email or phone", () => {
    expect(filterEmployeesByDirectorySearch([jane, john], "jane.doe@company.com")).toEqual([jane])
    expect(filterEmployeesByDirectorySearch([jane, john], "0712349999")).toEqual([john])
  })

  it("identifies email and phone owners", () => {
    expect(employeeOwnsEmail(jane, "jane.doe@company.com")).toBe(true)
    expect(employeeOwnsPhone(jane, "0712 345 678")).toBe(true)
    expect(employeeOwnsPhone(john, "0712345678")).toBe(false)
  })

  it("describes employees and company users for conflict messages", () => {
    expect(formatEmployeeDirectoryPerson(jane, "employee")).toBe(
      "Jane Doe (employee AICL/00012)",
    )
    expect(
      formatEmployeeDirectoryPerson(
        { first_name: "Pat", last_name: "Lee", email: "pat@company.com" },
        "company_user",
      ),
    ).toBe("Pat Lee (company user, no employee profile)")
  })
})
