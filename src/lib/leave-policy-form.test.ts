import { describe, expect, it } from "vitest"

import {
  assignmentDefaultsFromLeaveType,
  hasPolicyAdvancedRules,
  hasPolicyCoverageLimits,
  leavePolicyRecordToForm,
} from "./leave-policy-form"

describe("leavePolicyRecordToForm", () => {
  it("maps nested relations, camelCase fields, and 1/0 booleans from a detail payload", () => {
    const form = leavePolicyRecordToForm({
      name: "Staff leave rules",
      description: "Default staff policy",
      status: "ACTIVE",
      accrualMethod: "MONTHLY",
      accrualRate: "1.5",
      priority: 10,
      applicable_branch: { id: 3, name: "HQ" },
      applicableDepartmentId: 8,
      applicable_position: { id: 12, name: "Officer" },
      applicable_grade: { id: 4 },
      applicable_employment_type: "Full Time",
      applicableConfirmationStatus: "confirmed",
      maxConsecutiveDays: 14,
      min_service_months: 6,
      allow_during_probation: 0,
      allowNegativeBalance: 1,
      weekly_off_treatment: "include",
      holidayTreatment: "EXCLUDE",
      allow_half_day: "yes",
      allow_short_leave: "1",
      minimumShortLeaveMinutes: 45,
      maximum_short_leave_minutes: 180,
      minimum_notice_days: 2,
      maximum_backdate_days: 5,
      cancellation_requires_approval: true,
      cancellation_cutoff_days: 1,
      maximum_accumulation_days: 30,
      attendance_balance_deduction_enabled: "true",
      absent_day_deduction_days: 1,
      unpaid_leave_day_deduction_days: 1,
      half_day_deduction_days: 0.5,
      leaveTypes: [
        {
          id: 99,
          leave_type_id: 4,
          annualQuotaDays: 21,
          max_per_request_days: 7,
          requires_approval: 1,
          encashment_enabled: true,
          maximum_encashment_days: 10,
          minimum_balance_after_encashment: 5,
          encashment_requires_approval: false,
          maximum_accumulation_days: 42,
          leave_type: { id: 4, name: "Annual leave" },
        },
        {
          leaveType: { id: 5, name: "Sick leave" },
          annual_quota_days: "14",
          requiresApproval: false,
        },
      ],
    })

    expect(form.name).toBe("Staff leave rules")
    expect(form.description).toBe("Default staff policy")
    expect(form.status).toBe("active")
    expect(form.accrual_method).toBe("monthly")
    expect(form.accrual_rate).toBe("1.5")
    expect(form.priority).toBe("10")
    expect(form.applicable_branch_id).toBe("3")
    expect(form.applicable_department_id).toBe("8")
    expect(form.applicable_position_id).toBe("12")
    expect(form.applicable_grade_id).toBe("4")
    expect(form.applicable_employment_type).toBe("full_time")
    expect(form.applicable_confirmation_status).toBe("CONFIRMED")
    expect(form.max_consecutive_days).toBe("14")
    expect(form.min_service_months).toBe("6")
    expect(form.allow_during_probation).toBe("false")
    expect(form.allow_negative_balance).toBe("true")
    expect(form.weekly_off_treatment).toBe("INCLUDE")
    expect(form.holiday_treatment).toBe("EXCLUDE")
    expect(form.allow_half_day).toBe("true")
    expect(form.allow_short_leave).toBe("true")
    expect(form.minimum_short_leave_minutes).toBe("45")
    expect(form.maximum_short_leave_minutes).toBe("180")
    expect(form.leave_types).toHaveLength(2)
    expect(form.leave_types[0]).toMatchObject({
      leave_type_id: "4",
      leave_type_name: "Annual leave",
      annual_quota_days: "21",
      max_per_request_days: "7",
      requires_approval: "true",
      encashment_enabled: "true",
      maximum_encashment_days: "10",
      minimum_balance_after_encashment: "5",
      encashment_requires_approval: "false",
      maximum_accumulation_days: "42",
    })
    expect(form.leave_types[1]).toMatchObject({
      leave_type_id: "5",
      leave_type_name: "Sick leave",
      annual_quota_days: "14",
      requires_approval: "false",
    })
    expect(hasPolicyCoverageLimits(form)).toBe(true)
    expect(hasPolicyAdvancedRules(form)).toBe(true)
  })

  it("does not treat assignment ids as leave type ids and keeps approval default true", () => {
    const form = leavePolicyRecordToForm({
      name: "Sparse policy",
      leave_types: [{ id: 77, annual_quota_days: 10 }],
    })

    expect(form.leave_types).toHaveLength(1)
    expect(form.leave_types[0]?.leave_type_id).toBe("")
    expect(form.leave_types[0]?.requires_approval).toBe("true")
    expect(form.allow_during_probation).toBe("true")
    expect(form.status).toBe("active")
  })

  it("reads leave type ids from a bare numeric array", () => {
    const form = leavePolicyRecordToForm({
      name: "Numeric types",
      leave_types: [4, "9"],
    })

    expect(form.leave_types.map((row) => row.leave_type_id)).toEqual(["4", "9"])
  })
})

describe("assignmentDefaultsFromLeaveType", () => {
  it("copies yearly max into quota and max per request, and carry-forward into the accumulation cap", () => {
    const assignment = assignmentDefaultsFromLeaveType("4", {
      name: "Annual leave",
      maxDaysPerYear: 21,
      carryForwardAllowed: true,
      maxCarryForwardDays: 5,
    })

    expect(assignment).toMatchObject({
      leave_type_id: "4",
      leave_type_name: "Annual leave",
      annual_quota_days: "21",
      max_per_request_days: "21",
      maximum_accumulation_days: "5",
    })
  })

  it("uses 0 when the leave type has no yearly maximum", () => {
    const assignment = assignmentDefaultsFromLeaveType("8", {
      maxDaysPerYear: 0,
      carryForwardAllowed: false,
      maxCarryForwardDays: 10,
    })

    expect(assignment.annual_quota_days).toBe("0")
    expect(assignment.max_per_request_days).toBe("0")
    expect(assignment.maximum_accumulation_days).toBe("0")
  })
})
