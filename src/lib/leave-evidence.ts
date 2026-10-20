import type { AdminRecord } from "./admin-api"
const yes = (value: unknown) => value === true || value === "true"
export function requiresEvidenceBeforeSubmission(type: AdminRecord | null | undefined) {
  return yes(type?.requires_attachment) && !yes(type?.allow_deferred_attachment)
}
export function leaveEvidenceMessage(row: AdminRecord | null | undefined) {
  if (!row) return ""
  const routing = row.routing_required === true ? "Awaiting manager assignment. HR must correct routing before approval begins. " : ""
  const status = row.evidence_status
  if (status === "received") return `${routing}Supporting evidence received.`
  if (status !== "awaiting_evidence" && status !== "overdue") return routing.trim()
  const date = typeof row.evidence_due_at === "string" ? new Date(row.evidence_due_at) : null
  const due = date && Number.isFinite(date.getTime()) ? ` Due ${date.toLocaleString()}.` : ""
  return `${routing}${status === "overdue" ? "Supporting evidence is overdue." : "Supporting evidence is still needed."}${due} You can upload it below.`
}
