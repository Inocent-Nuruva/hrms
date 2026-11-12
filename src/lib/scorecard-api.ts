import { adminRequest } from "@/lib/admin-api"

export type ScorecardEntry = {
  assignmentId: number; definitionVersionId: number; targetRevisionId: number; weight: string; required: boolean;
  kpiName?: string; measurementType?: string; direction?: string; measurementUnit?: string | null;
  target?: Record<string, unknown> | null; actual?: unknown | null; achievement?: string | null; rawAchievement?: string | null; weightedScore?: string | null; status?: string; managerFeedback?: string | null
}
export type ScorecardVersion = { id: number; version: number; name: string; description: string | null; mode: "weighted" | "strategic"; policyVersionId: number | null; entries: ScorecardEntry[]; publishedAt: string | null }
export type Scorecard = { id: number; code: string; subjectType: string; subjectId: number; periodId: number; managerEmployeeId: number | null; status: string;
  currentVersion: ScorecardVersion; versions: ScorecardVersion[]; entries: ScorecardEntry[]; period: { label: string; startDate: string; endDate: string }; overallScore: string | null; rating?: string | null; completenessPercent?: string; performanceStatus: "awaiting_data" | "partial" | "scored" }
export type ScoringConfig = { minScore: number; maxScore: number; scoreCap: number; displayDecimals: number; missingTreatment: "block" | "exclude_optional"; notApplicableTreatment: "block" | "redistribute"; exactTolerance: number; qualitativeRubric: Array<{ label: string; score: number }> }
export type RatingBand = { label: string; from: number; to: number }
export type ScoringPolicyVersion = { id: number; version: number; name: string; method: "weighted" | "strategic"; config: ScoringConfig; ratingBands: RatingBand[]; publishedAt: string | null }
export type ScoringPolicy = { id: number; code: string; versions: ScoringPolicyVersion[] }
export type ScorecardTemplate = { id: number; code: string; name: string; mode: "weighted" | "strategic"; policyVersionId: number | null; items: Array<{ definitionId: number; weight: string }>; status: "draft" | "published" }
export type ScorecardDraft = { name: string; description?: string; mode: "weighted" | "strategic"; policyVersionId?: number; entries: Array<{ assignmentId: number; weight: string; required: boolean }> }
export type ScorecardCreate = ScorecardDraft & { code: string; subjectType: string; subjectId: number; periodId: number; managerEmployeeId?: number }
const root = "/api/hr/kpi"
export const scorecardApi = {
  list: (token: string) => adminRequest<Scorecard[]>(`${root}/scorecards`, { token, dedupe: false }),
  mine: (token: string) => adminRequest<Scorecard[]>(`${root}/scorecards/me`, { token }),
  get: (token: string, id: number) => adminRequest<Scorecard>(`${root}/scorecards/${id}`, { token, dedupe: false }),
  create: (token: string, body: ScorecardCreate) => adminRequest<Scorecard>(`${root}/scorecards`, { token, method: "POST", body }),
  update: (token: string, id: number, body: ScorecardDraft) => adminRequest<Scorecard>(`${root}/scorecards/${id}/draft`, { token, method: "PATCH", body }),
  revise: (token: string, id: number) => adminRequest<Scorecard>(`${root}/scorecards/${id}/revisions`, { token, method: "POST" }),
  publish: (token: string, id: number) => adminRequest<Scorecard>(`${root}/scorecards/${id}/publish`, { token, method: "POST" }),
  activate: (token: string, id: number) => adminRequest<Scorecard>(`${root}/scorecards/${id}/activate`, { token, method: "POST" }),
  clone: (token: string, id: number, code: string, name?: string) => adminRequest<Scorecard>(`${root}/scorecards/${id}/clone`, { token, method: "POST", body: { code, name } }),
  archive: (token: string, id: number) => adminRequest<Scorecard>(`${root}/scorecards/${id}`, { token, method: "DELETE" }),
  preview: (token: string, id: number, examples: Array<{ assignmentId: number; actual?: unknown; notApplicable?: boolean }>) => adminRequest<{ exampleOnly: true; persisted: false; overallScore: string | null; rating: string | null; completenessPercent: string; entries: Array<{ entryId: number; status: string; rawAchievement: string | null; scoredAchievement: string | null; weightedContribution: string | null }> }>(`${root}/scorecards/${id}/preview`, { token, method: "POST", body: { examples } }),
  policies: (token: string) => adminRequest<ScoringPolicy[]>(`${root}/scoring-policies`, { token, dedupe: false }),
  policy: (token: string, id: number) => adminRequest<ScoringPolicy>(`${root}/scoring-policies/${id}`, { token }),
  createPolicy: (token: string, body: { code: string; name: string; method: "weighted" | "strategic"; config: ScoringConfig; ratingBands: RatingBand[] }) => adminRequest<ScoringPolicy>(`${root}/scoring-policies`, { token, method: "POST", body }),
  updatePolicy: (token: string, id: number, body: { name: string; method: "weighted" | "strategic"; config: ScoringConfig; ratingBands: RatingBand[] }) => adminRequest<ScoringPolicy>(`${root}/scoring-policies/${id}/draft`, { token, method: "PATCH", body }),
  revisePolicy: (token: string, id: number) => adminRequest<ScoringPolicy>(`${root}/scoring-policies/${id}/revisions`, { token, method: "POST" }),
  publishPolicy: (token: string, id: number) => adminRequest<ScoringPolicy>(`${root}/scoring-policies/${id}/publish`, { token, method: "POST" }),
  templates: (token: string) => adminRequest<ScorecardTemplate[]>(`${root}/scorecard-templates`, { token, dedupe: false }),
  createTemplate: (token: string, body: Omit<ScorecardTemplate, "id" | "status">) => adminRequest<ScorecardTemplate>(`${root}/scorecard-templates`, { token, method: "POST", body }),
  updateTemplate: (token: string, id: number, body: Omit<ScorecardTemplate, "id" | "status">) => adminRequest<ScorecardTemplate>(`${root}/scorecard-templates/${id}`, { token, method: "PATCH", body }),
  publishTemplate: (token: string, id: number) => adminRequest<ScorecardTemplate>(`${root}/scorecard-templates/${id}/publish`, { token, method: "POST" }),
  useTemplate: (token: string, id: number, body: { code: string; name?: string; subjectType: string; subjectId: number; periodId: number; managerEmployeeId?: number }) => adminRequest<Scorecard>(`${root}/scorecard-templates/${id}/scorecards`, { token, method: "POST", body }),
}
