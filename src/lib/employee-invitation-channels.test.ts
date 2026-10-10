import { describe, expect, it } from "vitest"
import {
  invitationChannels,
  invitationDeliveryOutcome,
} from "./employee-invitation-channels"

describe("invitationChannels", () => {
  it("always includes email and adds SMS only when requested", () => {
    expect(invitationChannels(true)).toEqual(["EMAIL", "SMS"])
    expect(invitationChannels(false)).toEqual(["EMAIL"])
  })
})

describe("invitationDeliveryOutcome", () => {
  it("reports email-only success when SMS was skipped", () => {
    expect(
      invitationDeliveryOutcome({ email: "sent", sms: "skipped" }),
    ).toEqual({ kind: "success", message: "Invitation sent by email." })
  })

  it("reports the SMS reminder when it was sent", () => {
    expect(
      invitationDeliveryOutcome({ email: "SENT", sms: "accepted" }).message,
    ).toBe("Invitation sent by email, with an SMS reminder.")
  })

  it("flags failed channels without counting a skipped SMS as failed", () => {
    expect(
      invitationDeliveryOutcome({ email: "failed", sms: "skipped" }),
    ).toEqual({
      kind: "partial",
      message:
        "Invitation saved, but email delivery failed. You can resend it after checking the channel settings.",
    })
    expect(
      invitationDeliveryOutcome({ email: "failed", sms: "failed" }).message,
    ).toMatch(/email and SMS delivery failed/)
  })
})
