import { describe, expect, it } from "vitest"
import {
  canResendInvitation,
  invitationEffectiveStatus,
} from "./employee-invitation-status"

const now = Date.parse("2026-10-10T12:00:00Z")

describe("invitationEffectiveStatus", () => {
  it("prefers the backend effective_status", () => {
    expect(
      invitationEffectiveStatus({ status: "pending", effective_status: "EXPIRED" }),
    ).toBe("expired")
  })

  it("derives expired for an overdue pending row from older backends", () => {
    expect(
      invitationEffectiveStatus(
        { status: "pending", expires_at: "2026-10-10T11:00:00Z" },
        now,
      ),
    ).toBe("expired")
    expect(
      invitationEffectiveStatus(
        { status: "pending", expires_at: "2026-10-11T11:00:00Z" },
        now,
      ),
    ).toBe("pending")
  })

  it("passes other statuses through", () => {
    expect(invitationEffectiveStatus({ status: "Accepted" })).toBe("accepted")
    expect(invitationEffectiveStatus({})).toBe("")
  })
})

describe("canResendInvitation", () => {
  it.each([
    [{ effective_status: "pending" }, true],
    [{ effective_status: "expired" }, true],
    [{ effective_status: "accepted" }, false],
    [{ effective_status: "cancelled" }, false],
  ])("%j -> %s", (row, expected) => {
    expect(canResendInvitation(row, now)).toBe(expected)
  })
})
