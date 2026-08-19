import { describe, expect, it } from "vitest"

import {
  canonicalizePermissionNames,
  isPermissionSelected,
  permissionTokenFromAssignment,
  togglePermissionSelection,
  type PermissionOption,
} from "./permission-selection"

const employeesRead: PermissionOption = {
  id: "12",
  name: "employees:read",
  label: "Read employees",
  group: "Employees",
}

const employeesWrite: PermissionOption = {
  id: "13",
  name: "employees:write",
  label: "Write employees",
  group: "Employees",
}

describe("permission picker selection", () => {
  it("prefers a permission key over a display name on assignment records", () => {
    expect(
      permissionTokenFromAssignment({
        id: 99,
        display_name: "Read employees",
        permission: { id: 12, name: "employees:read", display_name: "Read employees" },
      }),
    ).toBe("employees:read")
  })

  it("treats id and label aliases as selected and toggles them off by name", () => {
    expect(isPermissionSelected(employeesRead, ["12"])).toBe(true)
    expect(isPermissionSelected(employeesRead, ["Read employees"])).toBe(true)
    expect(togglePermissionSelection(employeesRead, ["12", "employees:write"])).toEqual([
      "employees:write",
    ])
    expect(togglePermissionSelection(employeesRead, ["employees:write"])).toEqual([
      "employees:write",
      "employees:read",
    ])
  })

  it("canonicalizes mixed ids and labels onto catalog names", () => {
    expect(
      canonicalizePermissionNames(
        ["12", "Read employees", "employees:write", "unknown.perm"],
        [employeesRead, employeesWrite],
      ),
    ).toEqual(["employees:read", "employees:write", "unknown.perm"])
  })
})
