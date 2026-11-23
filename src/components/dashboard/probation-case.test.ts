import { describe, expect, it } from "vitest"

import { managerRatingPayload, managerReviewCriteria, probationCriteriaFromCase, resolveMyProbationCase } from "./probation-case"
import { policyFormValues, policyRulePayload } from "./probation-policy-form"

describe("employee probation payload", () => {
  it("sends every current-cycle manager rating, including zero and manager-only criteria", () => {
    const record = { managerReviewCriteria: [{criterionCode: "WORK", criterionName: "Work", maximumRating: "4"}], policySnapshot: { criteria: [{code:"OLD"}] } }
    expect(managerReviewCriteria(record)).toHaveLength(1)
    expect(managerRatingPayload(record, {rating_WORK:"0"})).toEqual([{criterion_code:"WORK", rating:0}])
    expect(() => managerRatingPayload(record, {})).toThrow("Rate Work")
    expect(() => managerRatingPayload(record, { rating_WORK:"5" })).toThrow("Rate Work")
    expect(managerRatingPayload({managerReviewCriteria: []}, {})).toEqual([])
  })

  it("round-trips targeting, zero extensions and false policy flags, and clears optional targets", () => {
    const form = policyFormValues({branchId:7,maximumExtensions:0,managerReviewRequired:false,effectiveTo:"2027-01-01",isDefault:true})
    expect(policyRulePayload({...form, effective_from:"2026-01-01", branch_id:""})).toMatchObject({
      branch_id:null,maximum_extensions:0,manager_review_required:false,effective_to:"2027-01-01",is_default:true,
    })
  })
  it("treats a missing or empty payload as no case", () => {
    expect(resolveMyProbationCase(null)).toBeNull()
    expect(resolveMyProbationCase({ case: null })).toBeNull()
    expect(resolveMyProbationCase({ data: null })).toBeNull()
    expect(probationCriteriaFromCase(null)).toEqual([])
  })

  it("reads a case even when policy is null", () => {
    const record = resolveMyProbationCase({
      id: 18,
      status: "IN_PROGRESS",
      policy: null,
      criteria: [{ code: "QUALITY", name: "Quality" }],
    })
    expect(record).toEqual(expect.objectContaining({ id: 18, status: "IN_PROGRESS" }))
    expect(probationCriteriaFromCase(record).map((item) => item.code)).toEqual(["QUALITY"])
  })

  it("omits criteria that do not allow employee self-ratings", () => {
    const record = {
      id: 19,
      policy: {
        criteria: [
          { code: "QUALITY", selfRatingEnabled: true },
          { code: "ATTENDANCE", self_rating_enabled: false },
        ],
      },
    }
    expect(probationCriteriaFromCase(record).map((item) => item.code)).toEqual(["QUALITY"])
  })
})
