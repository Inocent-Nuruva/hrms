import { describe, expect, it } from "vitest"

import { nullablePositiveInteger } from "@/lib/scheduled-reporting-payload"

describe("scheduled reporting payload helpers", () => {
  it("uses null instead of zero when an optional relation is not selected", () => {
    expect(nullablePositiveInteger("")).toBeNull()
    expect(nullablePositiveInteger("   ")).toBeNull()
    expect(nullablePositiveInteger("0")).toBeNull()
  })

  it("keeps a valid selected relation id", () => {
    expect(nullablePositiveInteger("5")).toBe(5)
  })
})
