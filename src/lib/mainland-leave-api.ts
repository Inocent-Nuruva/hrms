import { adminRequest, buildUrl } from "@/lib/admin-api";

/** Client for the Mainland Tanzania leave endpoints (/api/leave/mainland, /api/leave/policy-revisions). */

export type LeaveFamily =
  | "annual"
  | "sick"
  | "maternity"
  | "paternity"
  | "compassionate"
  | "unpaid";

export type MainlandBucket = {
  source_cycle_start: string;
  remaining: number;
  expires_on: string | null;
  status: "active" | "flagged" | "extended" | "forfeited";
};

export type MainlandBalance = {
  status: "mainland";
  employee_id: number;
  family: LeaveFamily;
  as_of: string;
  cycle: { cycleNumber: number; startDate: string; endDate: string } | null;
  entitlement: number;
  accrued: number;
  carried: number;
  taken: number;
  pending: number;
  scheduled: number;
  forfeited: number;
  paid_out: number;
  balance: number;
  available: number;
  expired_flagged: number;
  buckets: MainlandBucket[];
  tier_usage: { pay_rate: number; days: number }[];
  projected: { hypothetical: true; unposted_accrual: number; available_including_projection: number };
};

export type CutoverSnapshot = {
  id: number;
  policy_id: number;
  policy_revision_id: number;
  cutover_date: string;
  status: "draft" | "approved" | "posted" | "void" | "reversed";
  rows_sha256: string | null;
  created_by_company_user_id: number;
  approved_by_company_user_id: number | null;
  approved_at: string | null;
  approval_evidence: string | null;
  posted_at: string | null;
};

export type CutoverRow = {
  id: number;
  employee_id: number;
  family: "annual" | "sick" | "compassionate";
  cycle_anchor: string;
  cycle_start: string;
  prior_cycle_start: string | null;
  prior_carry_days: string;
  carry_expires_on: string | null;
  accrued_days: string;
  taken_days: string;
  outstanding_days: string;
  proposed_days: string;
  override_days: string | null;
  override_reason: string | null;
  exceptions: string[];
  resolved: boolean;
};

export type PolicyRevision = {
  id: number;
  policy_id: number;
  jurisdiction: "mainland" | "zanzibar";
  effective_date: string;
  rules_sha256: string;
  source_draft_revision_id: number;
  approval_reason: string;
  approved_at: string;
  withdrawn_at: string | null;
};

export type PolicyDraft = {
  id: number;
  policy_id: number;
  proposed_effective_date: string;
  rules: Record<string, unknown>;
  reason: string;
  created_at: string;
};

export type JobRun = {
  id: number;
  run_date: string;
  status: "running" | "succeeded" | "failed";
  attempts: number;
  error: string | null;
  stats: { employees?: number; entries?: number; warnings?: number; errors?: string[] } | null;
};

const post = <T,>(token: string, path: string, body: unknown = {}) =>
  adminRequest<T>(path, { token, method: "POST", body });
const get = <T,>(token: string, path: string) =>
  adminRequest<T>(path, { token });

// --- employee profiles
export const getLeaveProfile = (token: string, employeeId: number, asOf: string) =>
  get<Record<string, unknown> | null>(token, `/api/leave/employee-profiles/${employeeId}?as_of=${asOf}`);
export const createLeaveProfile = (
  token: string,
  employeeId: number,
  body: {
    effective_date: string;
    jurisdiction: "mainland" | "zanzibar";
    fte: number;
    cycle_anchor_date?: string | null;
    previous_employment_periods: { start_date: string; end_date: string }[];
    reason: string;
  },
) => post(token, `/api/leave/employee-profiles/${employeeId}`, body);
export const listMissingProfiles = (token: string, asOf: string) =>
  get<{ id: number; employee_no: string; first_name: string; last_name: string; hire_date: string | null }[]>(
    token,
    `/api/leave/policy-revisions/missing-profiles?as_of=${asOf}`,
  );

// --- drafts, revisions, assignments
export const listPolicyDrafts = (token: string, policyId: number) =>
  get<PolicyDraft[]>(token, `/api/leave/policies/${policyId}/draft-revisions`);
export const validatePolicyDraft = (token: string, policyId: number, date: string, rules: Record<string, unknown>) =>
  post<{ schema_valid: boolean; errors: string[] }>(token, `/api/leave/policies/${policyId}/draft-revisions/validate`, { proposed_effective_date: date, rules });
export const createPolicyDraft = (token: string, policyId: number, date: string, rules: Record<string, unknown>, reason: string) =>
  post<PolicyDraft & { validation_errors: string[] }>(token, `/api/leave/policies/${policyId}/draft-revisions`, { proposed_effective_date: date, rules, reason });
export const listPolicyRevisions = (token: string, policyId: number) =>
  get<PolicyRevision[]>(token, `/api/leave/policy-revisions/policy/${policyId}`);
export const approvePolicyDraft = (token: string, draftId: number, jurisdiction: "mainland" | "zanzibar", reason: string) =>
  post<PolicyRevision>(token, `/api/leave/policy-revisions/drafts/${draftId}/approve`, { jurisdiction, reason });
export const withdrawPolicyRevision = (token: string, revisionId: number, reason: string) =>
  post(token, `/api/leave/policy-revisions/${revisionId}/withdraw`, { reason });
export const assignPolicy = (
  token: string,
  body: { employee_ids: number[]; policy_id: number; effective_date: string; reason: string; cutover_snapshot_id?: number },
) => post<{ assigned: number; revision_id: number }>(token, "/api/leave/policy-revisions/assignments", body);
export const resolveLeaveContext = (token: string, employeeId: number, asOf: string) =>
  get<{ status: string; issues?: string[]; reason?: string }>(token, `/api/leave/policy-revisions/resolve/${employeeId}?as_of=${asOf}`);

// --- cutover
export const listCutovers = (token: string) => get<CutoverSnapshot[]>(token, "/api/leave/mainland/cutovers");
export const buildCutover = (token: string, policyId: number, cutoverDate: string) =>
  post<{ snapshot: CutoverSnapshot; skipped: string[] }>(token, "/api/leave/mainland/cutovers", { policy_id: policyId, cutover_date: cutoverDate });
export const listCutoverRows = (token: string, id: number) => get<CutoverRow[]>(token, `/api/leave/mainland/cutovers/${id}/rows`);
export const resolveCutoverRow = (token: string, rowId: number, reason: string, overrideDays?: number | null) =>
  post<CutoverRow>(token, `/api/leave/mainland/cutover-rows/${rowId}/resolve`, { reason, override_days: overrideDays ?? null });
export const approveCutover = (token: string, id: number, reason: string, evidence: string) =>
  post<CutoverSnapshot>(token, `/api/leave/mainland/cutovers/${id}/approve`, { reason, evidence });
export const postCutover = (token: string, id: number) =>
  post<{ posted: number; already_posted: boolean }>(token, `/api/leave/mainland/cutovers/${id}/post`);
export const voidCutover = (token: string, id: number, reason: string) => post(token, `/api/leave/mainland/cutovers/${id}/void`, { reason });
export const reverseCutover = (token: string, id: number, reason: string) => post(token, `/api/leave/mainland/cutovers/${id}/reverse`, { reason });

// --- balances, carry-over, job
export const getMainlandBalance = (token: string, employeeId: number, family: LeaveFamily, asOf: string) =>
  get<MainlandBalance | { status: string }>(token, `/api/leave/mainland/balances/${employeeId}/${family}?as_of=${asOf}`);
export const extendCarryOver = (token: string, employeeId: number, src: string, reason: string) =>
  post(token, `/api/leave/mainland/carry-over/${employeeId}/${src}/extend`, { reason });
export const forfeitCarryOver = (token: string, employeeId: number, src: string, reason: string) =>
  post(token, `/api/leave/mainland/carry-over/${employeeId}/${src}/forfeit`, { reason });
export const listJobRuns = (token: string) => get<JobRun[]>(token, "/api/leave/mainland/cycle-job/runs");
export const runCycleJob = (token: string) => post<JobRun>(token, "/api/leave/mainland/cycle-job/run");
export const seedMainlandHolidays = (token: string) =>
  post<{ created: string[]; skipped: number }>(token, "/api/leave/mainland/holidays/seed");
export type HolidayReviewRow = {
  id: number;
  name: string;
  date: string;
  is_provisional: boolean;
  seed_key: string | null;
  branch_id: number | null;
  days_until: number;
  needs_check: boolean;
};
export const getHolidayReview = (token: string, asOf: string, withinDays = 60) =>
  get<{ as_of: string; rows: HolidayReviewRow[]; deleted_seeded: { key: string; name: string; seeded_date: string }[] }>(
    token,
    `/api/leave/mainland/holidays/review?as_of=${asOf}&within_days=${withinDays}`,
  );
export const confirmMainlandHoliday = (token: string, id: number, body: { date?: string | null; reason: string; evidence?: string | null }) =>
  post<{ id: number; from_date: string; date: string; affected_requests: { id: number; leave_no: string; employee_id: number; status: string; start_date: string; end_date: string }[] }>(
    token,
    `/api/leave/mainland/holidays/${id}/confirm`,
    body,
  );

// --- preview, life events, overrides
export type RequestPreview = {
  mode: "mainland" | "legacy" | "blocked";
  issues?: string[];
  countBasis?: string;
  countedDates?: string[];
  excludedDates?: { date: string; reason: string }[];
  units?: number;
  segments?: { sourceCycleStart: string; days: number; payRate: number | null; expiresOn?: string | null }[];
  findings?: { code: string; severity: "error" | "warning"; message: string }[];
  evidence?: string[];
  available?: number;
};
export const previewMainlandRequest = (
  token: string,
  body: { employee_id: number; leave_type_id: number; start_date: string; end_date: string; duration_type?: string; leave_life_event_id?: number; included_dates?: string[] },
) => post<RequestPreview>(token, "/api/leave/mainland/preview", body);
export const listLifeEvents = (token: string, employeeId: number) =>
  get<{ id: number; event_type: string; event_date: string; multiple_birth: boolean; verified_at: string | null; nssf_reference: string | null }[]>(token, `/api/leave/mainland/life-events/${employeeId}`);
export const createLifeEvent = (token: string, employeeId: number, body: Record<string, unknown>) =>
  post(token, `/api/leave/mainland/life-events/${employeeId}`, body);
export const verifyLifeEvent = (token: string, employeeId: number, eventId: number) =>
  post(token, `/api/leave/mainland/life-events/${employeeId}/${eventId}/verify`);
export const createRuleOverride = (token: string, employeeId: number, body: Record<string, unknown>) =>
  post(token, `/api/leave/mainland/overrides/${employeeId}`, body);

// --- reports
export type ReportKind = "balances" | "liability" | "expiring" | "sick-tiers" | "maternity-terms";
export const getMainlandReport = <T = { rows: Record<string, unknown>[]; totals?: Record<string, unknown> }>(
  token: string,
  kind: ReportKind,
  params: Record<string, string | number | undefined>,
) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
  return get<T>(token, `/api/leave/mainland/reports/${kind}?${q.toString()}`);
};

/** CSV export (or the cutover reconciliation) as a file download. */
export async function downloadMainlandCsv(token: string, path: string, filename: string) {
  const res = await fetch(buildUrl(path), { headers: { Authorization: `Bearer ${token}`, accept: "text/csv" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
