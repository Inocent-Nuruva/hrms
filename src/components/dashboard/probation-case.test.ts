import { describe, expect, it } from "vitest"

import { probationCriteriaFromCase, resolveMyProbationCase } from "./probation-case"

describe("employee probation payload", () => {
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
})
