import type { EmployeeInvitationChannel } from "@/lib/admin-api"

// The registration link only travels by email. SMS is an optional,
// link-free reminder, so EMAIL is always included.
export function invitationChannels(
  sendSmsReminder: boolean,
): EmployeeInvitationChannel[] {
  return sendSmsReminder ? ["EMAIL", "SMS"] : ["EMAIL"]
}

type DeliveryStatuses = {
  email?: string | null
  sms?: string | null
}

export type InvitationDeliveryOutcome =
  | { kind: "success"; message: string }
  | { kind: "partial"; message: string }

export function invitationDeliveryOutcome(
  statuses: DeliveryStatuses,
): InvitationDeliveryOutcome {
  const email = statuses.email?.toLowerCase() ?? ""
  const sms = statuses.sms?.toLowerCase() ?? ""
  const failed = [
    email === "failed" ? "email" : null,
    sms === "failed" ? "SMS" : null,
  ].filter((channel): channel is string => channel !== null)

  if (failed.length > 0) {
    return {
      kind: "partial",
      message: `Invitation saved, but ${failed.join(" and ")} delivery failed. You can resend it after checking the channel settings.`,
    }
  }
  return {
    kind: "success",
    message:
      sms === "skipped" || sms === ""
        ? "Invitation sent by email."
        : "Invitation sent by email, with an SMS reminder.",
  }
}
