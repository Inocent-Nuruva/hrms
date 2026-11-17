import { describe, expect, it } from "vitest"

import {
  emptyLeavePolicyForm,
  emptyLeavePolicyTypeAssignment,
  leavePolicyEnginePayload,
  leavePolicyRecordToForm,
  leavePolicyTypeCarryForwardPayload,
} from "./leave-policy-form"
import { days, statusTone } from "./leave-engine-api"

describe("leave policy engine form payloads", () => {
  it("sends calendar years and manual rollover by default", () => {
    expect(leavePolicyEnginePayload(emptyLeavePolicyForm())).toEqual({
      leave_year_type: "calendar",
      leave_year_start_month: null,
      leave_year_start_day: null,
      rollover_execution_mode: "manual_approval",
    })
  })

  it("sends custom year start, version date, reason and draft flag", () => {
    expect(
      leavePolicyEnginePayload({
        ...emptyLeavePolicyForm(),
        leave_year_type: "custom",
        leave_year_start_month: "7",
        leave_year_start_day: "1",
        rollover_execution_mode: "automatic",
        effective_from: "2027-01-01",
        change_reason: "  New CBA  ",
        save_as_draft: "true",
      }),
    ).toEqual({
      leave_year_type: "custom",
      leave_year_start_month: 7,
      leave_year_start_day: 1,
      rollover_execution_mode: "automatic",
      effective_from: "2027-01-01",
      change_reason: "New CBA",
      save_as_draft: true,
    })
  })

  it("sends carry-forward percentage, lapse, protection and auto-encashment", () => {
    const payload = leavePolicyTypeCarryForwardPayload({
      ...emptyLeavePolicyTypeAssignment(),
      carry_forward_enabled: "true",
      carry_forward_method: "percentage",
      carry_forward_percentage: "50",
      lapse_enabled: "false",
      protected_minimum_days: "5",
      auto_encash_enabled: "true",
      auto_encash_method: "limited",
      auto_encash_max_days: "3",
      encashment_salary_basis: "gross",
    })
    expect(payload).toMatchObject({
      carry_forward_method: "percentage",
      carry_forward_percentage: 50,
      lapse_enabled: false,
      protected_minimum_days: 5,
      auto_encash_enabled: true,
      auto_encash_method: "limited",
      auto_encash_max_days: 3,
      encashment_salary_basis: "gross",
    })
  })

  it("reads the new fields back from a policy record", () => {
    const form = leavePolicyRecordToForm({
      name: "P",
      leave_year_type: "anniversary",
      rollover_execution_mode: "automatic",
      leave_types: [
        {
          leave_type_id: 1,
          annual_quota_days: "28.00",
          carry_forward_method: "limited",
          lapse_enabled: false,
          protected_minimum_days: "2.00",
          auto_encash_enabled: true,
          encashment_salary_basis: "gross",
        },
      ],
    })
    expect(form.leave_year_type).toBe("anniversary")
    expect(form.rollover_execution_mode).toBe("automatic")
    expect(form.leave_types[0]).toMatchObject({
      carry_forward_method: "limited",
      lapse_enabled: "false",
      protected_minimum_days: "2",
      auto_encash_enabled: "true",
      encashment_salary_basis: "gross",
    })
  })
})

describe("leave engine labels", () => {
  it("formats days and status tones", () => {
    expect(days("7.5000")).toBe("7.5")
    expect(days(null)).toBe("0")
    expect(statusTone("completed")).toContain("emerald")
    expect(statusTone("failed")).toContain("rose")
  })
})
