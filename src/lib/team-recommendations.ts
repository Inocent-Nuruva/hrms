import { adminRequest } from "@/lib/admin-api"

export type RecommendationKind = "PROMOTION" | "TRANSFER" | "DISCIPLINARY"
export type Destination = {
  proposed_position_title?: string
  proposed_department_id?: number
  proposed_branch_id?: number
  proposed_department_name?: string
  proposed_branch_name?: string
}
export type Recommendation = {
  id: number
  employee_id: number
  employee: string | null
  submitted_by: string | null
  recommendation_type: RecommendationKind
  rationale: string
  proposal: Destination
  proposed_effective_date: string | null
  status: "SUBMITTED" | "RETURNED" | "APPROVED" | "REJECTED"
  feedback: string | null
  revises_id: number | null
  submitted_at: string
  reviewed_at: string | null
}
export type Choices = {
  employees: { id: number; name: string }[]
  departments: { id: number; name: string; branch_id: number | null }[]
  branches: { id: number; name: string }[]
}
export type Submission = {
  employee_id: number
  recommendation_type: RecommendationKind
  rationale: string
  proposal: Destination
  proposed_effective_date?: string
  revises_id?: number
}
export type ReviewDecision = "APPROVE" | "RETURN" | "REJECT"
const team = "/api/me/team/recommendations"
const review = "/api/hr/recommendations"
export async function getTeamWorkspace(token: string) {
  const [rows, choices] = await Promise.all([
    adminRequest<{ data: Recommendation[] }>(team, { token, cacheTtlMs: 0 }),
    adminRequest<Choices>(team + "/options", { token, cacheTtlMs: 0 }),
  ])
  return { rows: rows.data, choices }
}
export async function getReviewWorkspace(token: string) {
  const response = await adminRequest<{ data: Recommendation[] }>(
    review + "/pending",
    { token, cacheTtlMs: 0 }
  )
  return response.data
}
export function submitRecommendation(token: string, body: Submission) {
  return adminRequest<{ id: number; status: string }>(team, {
    token,
    method: "POST",
    body,
  })
}
export function decideRecommendation(
  token: string,
  id: number,
  decision: ReviewDecision,
  comment: string
) {
  return adminRequest<{ id: number; status: string }>(
    `${review}/${id}/decision`,
    {
      token,
      method: "POST",
      body: {
        decision,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      },
    }
  )
}
