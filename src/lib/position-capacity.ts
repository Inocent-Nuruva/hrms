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
  return `This position is full: ${capacity.filled} of ${plural(capacity.headcount, "seat")} filled${pending}. Accepting this invitation will exceed the approved headcount.`
}
