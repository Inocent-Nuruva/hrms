import { describe, expect, it } from "vitest"

import { localSupportAnswer } from "./support-knowledge"

describe("localSupportAnswer", () => {
  it("greets without dumping a page list", () => {
    const result = localSupportAnswer("hello")
    expect(result.reply).toBe(
      "Hi. Ask me where to go in HRMS — leave, payroll, attendance, SMS, clock-in — and I will point you there. If I cannot help, tap Escalate to IT support.",
    )
    expect(result.links).toEqual([])
  })

  it("explains company payroll vs my payroll", () => {
    const result = localSupportAnswer("payroll", "", "admin")
    expect(result.links.some((link) => link.url.includes("/operations/payroll"))).toBe(true)
    expect(result.reply.toLowerCase()).toContain("payslip")
  })

  it("sends employees to their own payroll when they say my payroll", () => {
    const result = localSupportAnswer("my payroll", "", "employee")
    expect(result.links[0]?.url).toBe("/dashboard/me/finance/payroll")
  })

  it("explains clock-in setup vs personal punches", () => {
    const result = localSupportAnswer("how do I clock in")
    expect(result.reply.toLowerCase()).toContain("clock-in")
    expect(result.links.some((link) => link.url.includes("readiness"))).toBe(true)
  })
})
