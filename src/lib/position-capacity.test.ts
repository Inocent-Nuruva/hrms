import { describe, expect, it } from "vitest"
import { positionCapacityWarning } from "./position-capacity"

const base = {
  position_id: 9,
  headcount: 2,
  filled: 1,
  pending_invitations: 0,
  available: 1,
  will_overfill: false,
}

describe("positionCapacityWarning", () => {
  it("explains why an enforced full position blocks an invitation", () => {
    expect(positionCapacityWarning({...base,enforced:true,will_overfill:true,available:0,pending_invitations:1})).toContain("A seat must be available")
  })
  it("stays quiet while there is room or capacity is unknown", () => {
    expect(positionCapacityWarning(base)).toBeNull()
    expect(positionCapacityWarning(null)).toBeNull()
    expect(positionCapacityWarning(undefined)).toBeNull()
  })

  it("explains a full position including pending invitations", () => {
    expect(
      positionCapacityWarning({
        ...base,
        pending_invitations: 1,
        available: 0,
        will_overfill: true,
      }),
    ).toBe(
      "This position is full in the selected department: 1 of 2 seats filled and 1 pending invitation. Accepting this invitation will exceed that department's staffing limit.",
    )
  })

  it("uses singular wording and omits pending when there are none", () => {
    expect(
      positionCapacityWarning({
        ...base,
        headcount: 1,
        filled: 1,
        available: 0,
        will_overfill: true,
      }),
    ).toBe(
      "This position is full in the selected department: 1 of 1 seat filled. Accepting this invitation will exceed that department's staffing limit.",
    )
  })
})
