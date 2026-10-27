import type { EmployeeInvitationHistoryStatus } from "@/lib/admin-api"

type InvitationRow = Record<string, unknown>

export const INVITATION_STATUS_FILTERS: Array<{
  value: EmployeeInvitationHistoryStatus
  label: string
}> = [
  { value: "all", label: "All invitations" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Done" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
]

/**
 * Status as HR should see it. Prefers the backend's effective_status; for
 * older responses, a pending invitation past its expiry reads as expired.
 */
export function invitationEffectiveStatus(
  row: InvitationRow,
  now: number = Date.now(),
): string {
  const effective = row.effective_status
  if (typeof effective === "string" && effective.trim()) {
    return effective.trim().toLowerCase()
  }
  const status =
    typeof row.status === "string" ? row.status.trim().toLowerCase() : ""
  const expiresAt =
    typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN
  if (status === "pending" && Number.isFinite(expiresAt) && expiresAt <= now) {
    return "expired"
  }
  return status
}

/** Pending invitations can be re-sent; expired ones can be revived. */
export function canResendInvitation(row: InvitationRow, now?: number): boolean {
  const status = invitationEffectiveStatus(row, now)
  return status === "pending" || status === "expired"
}
