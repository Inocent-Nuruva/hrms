import { describe, expect, it } from "vitest"

import {
  availableRoleSuggestions,
  existingRoleTokens,
  resolveSuggestionPermissions,
  ROLE_SUGGESTION_TEMPLATES,
  suggestionAlreadyExists,
} from "./role-suggestions"
import type { PermissionOption } from "./permission-selection"

const catalog = [
  "data_scope:self",
  "data_scope:company",
  "employees:read",
  "employees:create",
  "employees:delete",
  "leave_requests:read",
  "leave_requests:approve",
  "attendance_policies:read",
  "attendance_devices:read",
  "field_visits:self-service-read",
  "field_visits:self-service-update",
  "field_visits:config",
  "company_data:read",
  "users:update",
].map(
  (name, index): PermissionOption => ({
    id: String(index + 1),
    name,
    label: name,
    group: name.split(":")[0] ?? "General",
  }),
)

describe("role suggestions", () => {
  it("hides Employee when that role already exists", () => {
    const tokens = existingRoleTokens([{ name: "EMPLOYEE", display_name: "Employee" }])
    const employee = ROLE_SUGGESTION_TEMPLATES.find((item) => item.id === "employee")
    expect(employee).toBeDefined()
    expect(suggestionAlreadyExists(employee!, tokens)).toBe(true)
    expect(
      availableRoleSuggestions([{ name: "EMPLOYEE" }], catalog).some(
        (item) => item.id === "employee",
      ),
    ).toBe(false)
  })

  it("keeps HR and Sales suggestions when only Company Admin exists", () => {
    const available = availableRoleSuggestions(
      [{ name: "COMPANY_ADMIN", display_name: "Company Admin" }],
      catalog,
    )
    expect(available.map((item) => item.id)).toEqual(
      expect.arrayContaining(["hr-manager", "sales-representative", "employee"]),
    )
  })

  it("resolves HR permissions from the catalog and skips hardware access", () => {
    const hr = ROLE_SUGGESTION_TEMPLATES.find((item) => item.id === "hr-manager")!
    const names = resolveSuggestionPermissions(
      hr,
      catalog.map((item) => item.name),
    )
    expect(names).toContain("employees:create")
    expect(names).toContain("leave_requests:approve")
    expect(names).not.toContain("attendance_devices:read")
  })

  it("keeps sales on field self-service and out of field config", () => {
    const sales = ROLE_SUGGESTION_TEMPLATES.find(
      (item) => item.id === "sales-representative",
    )!
    const names = resolveSuggestionPermissions(
      sales,
      catalog.map((item) => item.name),
    )
    expect(names).toContain("field_visits:self-service-update")
    expect(names).not.toContain("field_visits:config")
  })
})
