import type { AdminRecord } from "./admin-api"
const yes = (value: unknown) => value === true || value === "true"
/** Day limit above which evidence is needed; null = always needed. */
export function evidenceDayThreshold(type: AdminRecord | null | undefined): number | null {
  const raw = type?.attachment_required_after_days
  if (raw === null || raw === undefined || raw === "") return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}
/**
 * Evidence never blocks submission: it is optional when applying and must
 * be uploaded by the end of the leave (plus the type's grace days).
 */
export function requiresEvidenceBeforeSubmission(_type: AdminRecord | null | undefined) {
  return false
}

/** "Upload by the end of the leave + N days" wording for a leave type. */
export function evidenceDueText(type: AdminRecord | null | undefined) {
  const grace = Number(type?.attachment_grace_days ?? 3)
  return `You can attach it now or later; it must be uploaded within ${Number.isFinite(grace) ? grace : 3} day(s) after the leave ends to close the leave.`
}
export function evidenceRuleText(type: AdminRecord | null | undefined) {
  if (!yes(type?.requires_attachment)) return "Optional"
  const threshold = evidenceDayThreshold(type)
  const when = threshold === null ? "" : ` for requests longer than ${threshold} day(s)`
  return `Due ${type?.attachment_grace_days ?? 3} days after the leave ends${when}`
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
