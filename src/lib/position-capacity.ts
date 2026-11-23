import type { PositionCapacity } from "@/lib/admin-api"

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`

/**
 * Warning shown on the invite form when the chosen position has no free
 * seat. Pending invitations count as taken because each one becomes an
 * employee on acceptance. Returns null when there is room.
 */
export function positionCapacityWarning(
  capacity: PositionCapacity | null | undefined,
): string | null {
  if (!capacity || !capacity.will_overfill) return null
  const pending =
    capacity.pending_invitations > 0
      ? ` and ${plural(capacity.pending_invitations, "pending invitation")}`
      : ""
  if (capacity.enforced) return `This position is full in the selected department. ${capacity.filled} of ${plural(capacity.headcount, "seat")} filled${pending}. A seat must be available before an invitation can be sent.`
  return `This position is full in the selected department: ${capacity.filled} of ${plural(capacity.headcount, "seat")} filled${pending}. Accepting this invitation will exceed that department's staffing limit.`
}
