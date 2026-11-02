/** Keep administrative review separate from offboarding and final completion. */
export function resignationStage(status: string): number {
  if (status === "completed") return 3
  if (["in_progress", "approved", "ready_for_termination", "termination_scheduled",
    "terminating_access", "access_termination_failed", "ready_for_finalization"].includes(status)) return 2
  if (["pending", "pending_manager", "waiting_approval", "rejected", "cancelled"].includes(status)) return 1
  return 0
}
