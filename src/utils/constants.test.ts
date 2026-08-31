import { describe, expect, it } from "vitest"

import {
  buildDashboardResetPasswordHref,
  isDashboardResetPasswordLocation,
} from "./constants"

describe("dashboard reset-password routing helpers", () => {
  it("builds the dashboard settings password tab href", () => {
    expect(buildDashboardResetPasswordHref()).toBe("/dashboard/settings?tab=reset-password")
    expect(buildDashboardResetPasswordHref({ required: true })).toBe(
      "/dashboard/settings?tab=reset-password&required=1",
    )
  })

  it("recognizes the dashboard password tab location", () => {
    expect(isDashboardResetPasswordLocation("/dashboard/settings", "?tab=reset-password")).toBe(true)
    expect(isDashboardResetPasswordLocation("/dashboard/settings", "tab=password&required=1")).toBe(
      true,
    )
    expect(isDashboardResetPasswordLocation("/dashboard/settings", "?tab=devices")).toBe(false)
    expect(isDashboardResetPasswordLocation("/dashboard/employees", "?tab=reset-password")).toBe(
      false,
    )
  })
})
