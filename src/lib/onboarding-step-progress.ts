import type { AdminRecord } from "@/lib/admin-api"

/** Execution IDs and template step IDs belong to different tables. */
export function onboardingStepProgress(step: AdminRecord, tasks: AdminRecord[], approvals: AdminRecord[]): AdminRecord | null {
  const stepId = Number(step.id ?? step.step_id)
  if (!Number.isInteger(stepId) || stepId <= 0) return null
  const signOff = String(step.step_type).toLowerCase() === "sign_off"
  const entries = (signOff ? approvals : tasks).filter((entry) => Number(entry.workflow_step_id) === stepId)
  if (!entries.length) return null
  const statuses = entries.map((entry) => String(entry.status ?? "pending").toLowerCase())
  const status = signOff
    ? statuses.includes("rejected") ? "rejected"
      : statuses.includes("approved") ? "approved"
        : statuses.includes("pending") ? "pending" : "skipped"
    : statuses.every((value) => value === "completed") ? "completed"
      : statuses.every((value) => value === "cancelled") ? "cancelled"
        : statuses.some((value) => ["completed", "in_progress"].includes(value)) ? "in_progress" : "pending"
  const completed = ["completed", "approved", "skipped"].includes(status)
  const dates = entries.map((entry) => entry.completed_at ?? entry.acted_at)
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))
  return { ...step, status, completed_at: completed ? dates[0] ?? null : null }
}
