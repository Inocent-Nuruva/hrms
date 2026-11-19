import { adminRequest } from "@/lib/admin-api";
const root = "/api/hr/kpi/evaluations";
export type Competency = { code: string; name: string; description?: string };
export type ScalePoint = { value: number; label: string; description?: string };
export type EvaluationTemplateVersion = { id: number; templateId: number; version: number; name: string; config: { competencies: Competency[]; scale: ScalePoint[]; requireHrReview: boolean; sectionWeights?: { kpi: number; competency: number } | null }; publishedAt: string | null };
export type EvaluationTemplate = { id: number; code: string; versions: EvaluationTemplateVersion[] };
export type EvaluationCycle = { id: number; code: string; name: string; frequency: string; periodId: number; templateVersionId: number; startDate: string; endDate: string; selfDeadline: string | null; managerDeadline: string | null; hrDeadline: string | null; ackDeadline: string | null; hrReviewerCompanyUserId: number | null; deadlinePolicy: { mode: "soft" | "hard" }; status: string };
export type Evaluation = { id: number; companyId: number; cycleId: number; employeeId: number; managerEmployeeId: number; hrReviewerCompanyUserId: number | null; scorecardId: number; templateVersionId: number; status: string; rowVersion: number; selfData: Record<string, unknown> | null; managerData: Record<string, unknown> | null; hrComment: string | null; finalSnapshot: Record<string, unknown> | null; ackStatus: string | null; ackComment: string | null; amendedFromId: number | null; deadlineInfo?: { stage: string | null; dueDate: string | null; overdue: boolean; mode: "soft" | "hard" }; cycle?: EvaluationCycle; templateVersion?: EvaluationTemplateVersion; scorecard?: { overallScore: string | null; completenessPercent: string; rating: string | null; entries: Array<{ kpiName: string; target: unknown; actual: unknown; achievement: string | null; weightedScore: string | null; status: string; required: boolean; approvedRevisionId?: number }> }; revisions?: Array<{ id: number; section: string; revision: number; data: Record<string, unknown>; createdAt: string }>; history?: Array<{ id: number; action: string; actorId: number; createdAt: string; details: Record<string, unknown> }> };
export type SelfData = { achievements: string; challenges: string; observations: string; developmentNeeds: string; futureGoals: string; comments: string; competencyRatings: Record<string, number> };
export type ManagerData = { competencyRatings: Record<string, number>; strengths: string; developmentNeeds: string; feedback: string; recommendations: string };
const call = <T>(token: string, path: string, method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) => adminRequest<T>(root + path, { token, method, body, dedupe: false });
export const evaluationApi = {
  templates: (token: string) => call<EvaluationTemplate[]>(token, "/templates"),
  createTemplate: (token: string, body: { code: string; name: string; competencies: Competency[]; scale: ScalePoint[]; requireHrReview: boolean }) => call<EvaluationTemplate>(token, "/templates", "POST", body),
  reviseTemplate: (token: string, id: number, body: { name: string; competencies: Competency[]; scale: ScalePoint[]; requireHrReview: boolean }) => call<EvaluationTemplateVersion>(token, `/templates/${id}/revisions`, "POST", body),
  publishTemplate: (token: string, id: number) => call<EvaluationTemplateVersion>(token, `/template-versions/${id}/publish`, "POST"),
  cycles: (token: string) => call<EvaluationCycle[]>(token, "/cycles"),
  createCycle: (token: string, body: Record<string, unknown>) => call<EvaluationCycle>(token, "/cycles", "POST", body),
  cycleAction: (token: string, id: number, action: "open" | "in-progress" | "review" | "close") => call<EvaluationCycle>(token, `/cycles/${id}/${action}`, "POST"),
  setDeadlinePolicy: (token: string, id: number, mode: "soft" | "hard", reason: string) => call<EvaluationCycle>(token, `/cycles/${id}/deadline-policy`, "POST", { mode, reason }),
  enroll: (token: string, id: number, employeeId: number, managerEmployeeId: number, scorecardId: number) => call<Evaluation>(token, `/cycles/${id}/participants`, "POST", { employeeId, managerEmployeeId, scorecardId }),
  dashboard: (token: string) => call<{ total: number; finalized: number; pendingSelf: number; pendingManager: number; pendingHr: number; activeCycles: number; overdue: number; ratingDistribution: Record<string, number>; completionPercent: number }>(token, "/dashboard"),
  list: (token: string) => call<Evaluation[]>(token, ""),
  mine: (token: string) => call<Evaluation[]>(token, "/me"),
  get: (token: string, id: number) => call<Evaluation>(token, `/${id}`),
  saveSelf: (token: string, id: number, rowVersion: number, body: SelfData) => call<Evaluation>(token, `/${id}/self`, "PATCH", { rowVersion, ...body }),
  submitSelf: (token: string, id: number, rowVersion: number) => call<Evaluation>(token, `/${id}/self/submit`, "POST", { rowVersion }),
  saveManager: (token: string, id: number, rowVersion: number, body: ManagerData) => call<Evaluation>(token, `/${id}/manager`, "PATCH", { rowVersion, ...body }),
  managerAction: (token: string, id: number, rowVersion: number, action: "submit" | "return", comment?: string) => call<Evaluation>(token, `/${id}/manager/${action}`, "POST", { rowVersion, comment }),
  hrAction: (token: string, id: number, rowVersion: number, action: "review" | "approve" | "return", comment?: string) => call<Evaluation>(token, `/${id}/hr/${action}`, "POST", { rowVersion, comment }),
  finalize: (token: string, id: number, rowVersion: number) => call<Evaluation>(token, `/${id}/finalize`, "POST", { rowVersion }),
  acknowledge: (token: string, id: number, status: "acknowledged" | "disputed", comment?: string) => call<Evaluation>(token, `/${id}/acknowledge`, "POST", { status, comment }),
  amend: (token: string, id: number, reason: string) => call<Evaluation>(token, `/${id}/amend`, "POST", { reason }),
  cancel: (token: string, id: number, rowVersion: number, comment: string) => call<Evaluation>(token, `/${id}/cancel`, "POST", { rowVersion, comment }),
  reassignManager: (token: string, id: number, managerEmployeeId: number, reason: string) => call<Evaluation>(token, `/${id}/reassign-manager`, "POST", { managerEmployeeId, reason }),
  reassignHrReviewer: (token: string, id: number, companyUserId: number, reason: string) => call<Evaluation>(token, `/${id}/reassign-hr-reviewer`, "POST", { companyUserId, reason }),
  grantDeadlineException: (token: string, id: number, stage: "self" | "manager" | "hr" | "ack", reason: string) => call(token, `/${id}/deadline-exceptions`, "POST", { stage, reason }),
};
