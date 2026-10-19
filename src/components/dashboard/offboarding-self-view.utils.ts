export function resolveOffboardingProgressStage(rawStatus: string): string {
  const status = rawStatus.trim().toUpperCase()
  if (["COMPLETED", "FINALIZED"].includes(status)) return "COMPLETED"
  if (["READY_FOR_FINALIZATION", "TERMINATING_ACCESS", "TERMINATION_SCHEDULED", "READY_FOR_TERMINATION"].includes(status)) {
    return "READY_FOR_TERMINATION"
  }
  if (["IN_PROGRESS", "APPROVED", "WAITING_APPROVAL", "PENDING", "PENDING_MANAGER", "REJECTED"].includes(status)) {
    return status === "REJECTED" ? "PENDING_MANAGER" : "IN_PROGRESS"
  }
  return "DRAFT"
}
