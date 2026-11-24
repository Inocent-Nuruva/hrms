import type { AdminRecord } from "./admin-api"

export function movementAcknowledgement(row: AdminRecord | null | undefined) {
  if (row?.employeeAcknowledgedAt || row?.employee_acknowledged_at)
    return "Acknowledged"
  if (
    !(
      row?.employeeAcknowledgementRequired === true ||
      row?.employee_acknowledgement_required === true
    )
  )
    return "Not required"
  if (row.status === "APPLIED") return "Needed"
  if (row.status === "CANCELLED" || row.status === "REJECTED")
    return "Not applicable"
  return "After application"
}
