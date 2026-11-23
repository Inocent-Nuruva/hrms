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
  const snapshot = asRecord(caseRecord.policySnapshot ?? caseRecord.policy_snapshot)
  const policy = asRecord(caseRecord.policy)
  return asRecordArray(snapshot?.criteria ?? policy?.criteria ?? caseRecord.criteria).filter(
    (criterion) => criterion.selfRatingEnabled !== false && criterion.self_rating_enabled !== false,
  )
}

export function managerReviewCriteria(record: AdminRecord | null) {
  const snapshot = asRecord(record?.policySnapshot ?? record?.policy_snapshot)
  const criteria = asRecordArray(record?.managerReviewCriteria ?? snapshot?.criteria ?? asRecord(record?.policy)?.criteria)
  return criteria.map(item => ({
    code: String(item.criterionCode ?? item.code),
    name: String(item.criterionName ?? item.name ?? item.code),
    maximum: Number(item.maximumRating ?? item.maximum_rating ?? 5),
  }))
}

export function managerRatingPayload(record: AdminRecord | null, form: Record<string, string>) {
  return managerReviewCriteria(record).map(({ code, name, maximum }) => {
    const input = form[`rating_${code}`]?.trim()
    const rating = Number(input)
    if (!input || !Number.isFinite(rating) || rating < 0 || rating > maximum) {
      throw new Error(`Rate ${name} between 0 and ${maximum}.`)
    }
    return { criterion_code: code, rating, comment: form[`comment_${code}`]?.trim() || undefined }
  })
}
