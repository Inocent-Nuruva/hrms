import { describe, expect, it } from "vitest"
import {
  canDeletePermanently,
  employmentStatusOf,
  isPermanentDeleteConfirmed,
  permanentDeleteSummary,
} from "./employee-permanent-delete"

describe("canDeletePermanently", () => {
  it("allows onboarding employees", () => {
    expect(canDeletePermanently({ employment_status: "onboarding" })).toBe(true)
  })

  it.each(["active", "inactive", "resigned", "terminated", "retired", "deceased", "exited", ""])(
    "refuses %j",
    (status) => {
      expect(canDeletePermanently({ employment_status: status })).toBe(false)
    },
  )

  it("supports the camel-case status field", () => {
    expect(canDeletePermanently({ employmentStatus: " ONBOARDING " })).toBe(true)
  })
})

describe("employmentStatusOf", () => {
  it("prefers employment_status over the generic status key", () => {
    expect(
      employmentStatusOf({ employment_status: "onboarding", status: "active" }),
    ).toBe("onboarding")
  })
})

describe("isPermanentDeleteConfirmed", () => {
  it("requires the exact word DELETE", () => {
    expect(isPermanentDeleteConfirmed("DELETE")).toBe(true)
    expect(isPermanentDeleteConfirmed(" DELETE ")).toBe(true)
    expect(isPermanentDeleteConfirmed("delete")).toBe(false)
    expect(isPermanentDeleteConfirmed("")).toBe(false)
  })
})

describe("permanentDeleteSummary", () => {
  it("describes whether the login was removed or kept", () => {
    expect(
      permanentDeleteSummary({
        company_user_removed: true,
        user_account_removed: true,
      }),
    ).toMatch(/login permanently deleted/)
    expect(
      permanentDeleteSummary({
        company_user_removed: true,
        user_account_removed: false,
      }),
    ).toMatch(/kept because it is used by another company/)
    expect(permanentDeleteSummary({})).toBe("Employee permanently deleted.")
  })
})
