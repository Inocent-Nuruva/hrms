import { adminRequest } from "@/lib/admin-api";

export type AnalyticsFilters = {
  periodId?: number;
  cycleId?: number;
  definitionId?: number;
  employeeId?: number;
  managerId?: number;
  companyId?: number;
  departmentId?: number;
  branchId?: number;
  category?: string;
  scorecardType?:
    | "employee"
    | "department"
    | "branch"
    | "manager_group"
    | "organization";
  evaluationStatus?:
    | "self_draft"
    | "self_submitted"
    | "self_returned"
    | "manager_draft"
    | "manager_submitted"
    | "hr_reviewed"
    | "approved"
    | "finalized"
    | "cancelled";
  search?: string;
  approvalStatus?:
    | "approved"
    | "pending"
    | "missing"
    | "draft"
    | "returned"
    | "rejected";
  page?: number;
  limit?: number;
};
export type AnalyticsOverview = {
  audience: "admin" | "manager" | "executive" | "employee";
  periodId: number | null;
  refreshedAt: string;
  assignments: {
    total: number;
    approved: number;
    missing: number;
    pending: number;
    pendingReview: number;
    returned: number;
    rejected: number;
    draft: number;
  };
  completenessPercent: number | null;
  overallIndex: null;
  overallIndexStatus: string;
  riskStatus: null;
  riskStatusStatus: string;
  evaluations: EvaluationSummary["summary"];
  privacy: string | null;
};
export type AnalyticsCoverage = {
  suppressed: boolean;
  reason?: string;
  eligibleEmployees?: number;
  employeesWithScorecards?: number;
  employeesWithoutScorecards?: number;
  scorecards?: number;
  completeScorecards?: number;
  incompleteScorecards?: number;
  awaitingApprovedAchievements?: number;
  finalizedEvaluations?: number | null;
  evaluationsInProgress?: number | null;
  note?: string;
  refreshedAt: string;
};
export type HistoricalKpiDefinition = { id: number; code: string; status: string; name: string; category: string; version: number };
export type AnalyticsScorecard = {
  id: number;
  name: string;
  subjectType: string;
  subjectId: number;
  periodId: number;
  periodLabel: string;
  status: string;
  policyVersionId: number | null;
  scorecardVersionId: number | null;
  performanceStatus: string;
  completenessPercent: string | null;
  overallScore: string | null;
  rating: string | null;
  entries: Array<{
    assignmentId: number;
    achievementId: number | null;
    definitionId: number | null;
    kpiName: string;
    measurementType: string | null;
    measurementUnit: string | null;
    target: unknown;
    actual: unknown;
    rawAchievement: string | null;
    scoredAchievement: string | null;
    weightedContribution: string | null;
    weight: string;
    status: string;
    targetStatus: "exceeded_target" | "target_achieved" | "below_target" | null;
    required: boolean;
  }>;
};
export type ScorecardPage = {
  rows: AnalyticsScorecard[];
  total: number;
  page: number;
  limit: number;
  pageSummary?: {
    complete?: number | null;
    incomplete?: number | null;
    withheld?: number;
  };
  refreshedAt: string;
};
export type ComparisonPage = {
  periodId: number;
  comparisonType: "department" | "branch";
  total: number;
  page: number;
  limit: number;
  policyVersionId: number | null;
  rows: Array<{
    id: number;
    name: string;
    subjectId: number;
    completenessPercent: string | null;
    score: string | null;
    comparable: boolean;
    reason: string | null;
  }>;
  note: string;
  refreshedAt: string;
};
export type AnalyticsSubjects = {
  employees: Array<{ id: number; name: string }>;
  managers: Array<{ id: number; name: string }>;
  limit: number;
  refreshedAt: string;
};
export type TeamPage = {
  rows: Array<{
    employeeId: number;
    name: string;
    departmentId: number | null;
    branchId: number | null;
    assignedKpis: number;
    approvedKpis: number;
    completenessPercent: number | null;
    evaluationStatus: string | null;
    scorecardId: number | null;
    scorecardScore: string | null;
    scorecardStatus: string | null;
  }>;
  total: number;
  page: number;
  limit: number;
  refreshedAt: string;
};
export type EvaluationSummary = {
  summary: {
    total: number | null;
    finalized: number | null;
    completionPercent: number | null;
    acknowledged: number | null;
    disputed: number | null;
    overdue: number | null;
    activeCycles: number | null;
    pendingSelf: number | null;
    pendingManager: number | null;
    pendingHr: number | null;
    byStatus: Record<string, number>;
    suppressed?: boolean;
  };
  ratingDistribution: null;
  ratingDistributionStatus: string;
  refreshedAt: string;
};
export type AnalyticsTrend = {
  definitionId: number;
  employeeId: number;
  refreshedAt: string;
  points: Array<{
    assignmentId: number;
    periodId: number;
    periodLabel: string;
    frequency: string;
    definitionVersionId: number;
    targetRevisionId: number | null;
    target: Record<string, unknown> | null;
    approvedActual: Record<string, unknown> | null;
    comparable: boolean;
    limitation: string | null;
  }>;
};
export type RatingDistribution = {
  kpi: Array<{ policyVersionId: string | null; rating: string; count: number }>;
  competency: Array<{
    templateVersionId: number;
    rating: string;
    count: number;
  }>;
  combined: null;
  combinedStatus: string;
  note: string;
  refreshedAt: string;
};
export type ScorecardTrend = {
  employeeId: number;
  policyVersionId: number | null;
  points: Array<{
    scorecardId: number;
    periodId: number;
    periodLabel: string;
    scorecardVersionId: number;
    policyVersionId: number | null;
    completenessPercent: string;
    liveScore: string | null;
    finalizedScore: string | null;
    finalizedAt: string | null;
    comparable: boolean;
    reason: string | null;
  }>;
  note: string;
  refreshedAt: string;
};

function query(filters: AnalyticsFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  return params.size ? `?${params.toString()}` : "";
}
const root = "/api/hr/kpi/analytics";
export const kpiAnalyticsApi = {
  subjects: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<AnalyticsSubjects>(`${root}/subjects${query(filters)}`, {
      token,
      dedupe: false,
    }),
  overview: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<AnalyticsOverview>(`${root}/overview${query(filters)}`, {
      token,
      dedupe: false,
    }),
  coverage: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<AnalyticsCoverage>(`${root}/coverage${query(filters)}`, { token, dedupe: false }),
  historicalDefinitions: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<{ rows: HistoricalKpiDefinition[]; limit: number; refreshedAt: string }>(`${root}/historical-definitions${query(filters)}`, { token, dedupe: false }),
  scorecards: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<ScorecardPage>(`${root}/scorecards${query(filters)}`, {
      token,
      dedupe: false,
    }),
  evaluations: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<EvaluationSummary>(`${root}/evaluations${query(filters)}`, {
      token,
      dedupe: false,
    }),
  trends: (token: string, filters: AnalyticsFilters) =>
    adminRequest<AnalyticsTrend>(`${root}/trends${query(filters)}`, {
      token,
      dedupe: false,
    }),
  comparisons: (
    token: string,
    filters: AnalyticsFilters & {
      comparisonType: "department" | "branch";
      periodId: number;
    },
  ) =>
    adminRequest<ComparisonPage>(`${root}/comparisons${query(filters)}`, {
      token,
      dedupe: false,
    }),
  team: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<TeamPage>(`${root}/team${query(filters)}`, {
      token,
      dedupe: false,
    }),
  ratings: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<RatingDistribution>(`${root}/ratings${query(filters)}`, {
      token,
      dedupe: false,
    }),
  scorecardTrends: (token: string, filters: AnalyticsFilters = {}) =>
    adminRequest<ScorecardTrend>(`${root}/scorecard-trends${query(filters)}`, {
      token,
      dedupe: false,
    }),
};
