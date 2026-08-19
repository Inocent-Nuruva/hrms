import type { AdminRecord } from "@/lib/admin-api"

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is AdminRecord =>
        typeof entry === "object" && entry !== null && !Array.isArray(entry),
    )
  }
  return []
}

export function resolveMyProbationCase(payload: unknown): AdminRecord | null {
  const root = asRecord(payload)
  const nested =
    asRecord(root?.case) ??
    asRecord(root?.probation) ??
    asRecordArray(root?.cases)[0] ??
    asRecordArray(root?.data)[0]
  const candidate = nested ?? root
  if (!candidate) return null

  const hasCaseShape =
    candidate.id != null ||
    candidate.caseNo != null ||
    candidate.case_no != null ||
    candidate.status != null ||
    candidate.policy != null ||
    candidate.currentDueDate != null ||
    candidate.current_due_date != null ||
    candidate.objectives != null
  return hasCaseShape ? candidate : null
}

export function probationCriteriaFromCase(caseRecord: AdminRecord | null | undefined) {
  if (!caseRecord) return []
  const policy = asRecord(caseRecord.policy)
  return asRecordArray(policy?.criteria ?? caseRecord.criteria)
}
