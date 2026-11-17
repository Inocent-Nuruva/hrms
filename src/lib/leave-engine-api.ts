import { adminRequest, buildUrl, type AdminRecord } from "./admin-api"

/* ------------------------------------------------------------------ types */

export type PolicyLifecycleStatus = "draft" | "pending_approval" | "active" | "superseded" | "archived"

export type PolicyVersion = AdminRecord & {
  id: number
  name: string
  policy_key: string
  version_no: number
  lifecycle_status: PolicyLifecycleStatus
  effective_from: string | null
  effective_to: string | null
  change_reason: string | null
  approved_at: string | null
  leave_year_type?: string
  rollover_execution_mode?: string
}

export type PolicyChange = {
  field: string
  leave_type_id?: number
  leave_type_name?: string | null
  before: unknown
  after: unknown
}

export type PolicyImpactRow = {
  employee_id: number
  employee_no: string | null
  employee_name: string
  leave_type_id: number
  leave_type_name: string | null
  current_policy_version: number | null
  proposed_policy_version: number | null
  current_entitlement: number | null
  proposed_entitlement: number | null
  entitlement_change: number
  current_available: number | null
  proposed_maximum_accumulation: number | null
  days_above_new_cap: number
  warnings: string[]
}

export type PolicyImpact = {
  policy_id: number
  version_no: number
  effective_from: string
  employees_affected: number
  rows_with_warnings: number
  data: PolicyImpactRow[]
}

export type RolloverRunStatus =
  | "draft"
  | "previewed"
  | "pending_approval"
  | "approved"
  | "processing"
  | "completed"
  | "partially_failed"
  | "failed"
  | "cancelled"

export type RolloverException = { code: string; message: string; severity: "info" | "warning" | "error" }

export type RolloverLine = {
  id: number
  employee_id: number
  employee_no: string | null
  employee_name: string | null
  leave_type_id: number
  leave_type_name: string | null
  policy_id: number | null
  policy_version_no: number | null
  opening_days: string
  accrued_days: string
  used_days: string
  unused_days: string
  protected_days: string
  carry_forward_days: string
  encash_days: string
  lapse_days: string
  retained_days: string
  closing_days: string
  encash_amount: string | null
  currency: string | null
  status: "pending" | "posted" | "failed" | "skipped"
  exceptions: RolloverException[]
  error: string | null
}

export type RolloverRun = {
  id: number
  from_leave_year: string
  leave_type_id: number | null
  status: RolloverRunStatus
  execution_mode: "manual_approval" | "automatic"
  as_of_date: string
  totals: Record<string, number> | null
  exception_count: number
  notes: string | null
  error: string | null
  submitted_at: string | null
  approved_at: string | null
  completed_at: string | null
  created_at: string
  lines?: RolloverLine[]
}

export type StatutoryRuleType =
  | "annual_leave"
  | "sick_leave"
  | "maternity_leave"
  | "paternity_leave"
  | "public_holiday"
  | "termination_settlement"

export type StatutoryRule = {
  id?: number
  rule_type: StatutoryRuleType
  leave_type_id: number | null
  settings: Record<string, unknown>
  legal_reference: string | null
}

export type LegalReference = { title: string; citation?: string | null; url?: string | null }

export type StatutoryRuleSet = {
  id: number
  jurisdiction_code: string
  name: string
  version_no: number
  status: PolicyLifecycleStatus
  effective_from: string | null
  effective_to: string | null
  legal_authority: string | null
  legal_references: LegalReference[]
  verification_status: "unverified" | "verified" | "rejected"
  verification_notes: string | null
  verified_at: string | null
  is_test_configuration: boolean
  change_reason: string | null
  rules: StatutoryRule[]
}

export type StatutorySettings = {
  default_jurisdiction_code: string | null
  branches: Array<{ id: number; name: string; statutory_jurisdiction_code: string | null }>
}

export type LeavePayrollComponentStatus = {
  code: string
  name: string
  status: string
  tax_treatment: string
  taxable_percentage: string
  pensionable: boolean
  general_ledger_account_code: string | null
  finance_verified: boolean
  test_configuration: boolean
  placeholder_gl: boolean
  verified_at: string | null
  ready_for_handoff: boolean
}

/* -------------------------------------------------------------- versions */

const post = <T,>(path: string, token: string, body?: unknown) =>
  adminRequest<T>(path, { method: "POST", token, body: (body ?? {}) as AdminRecord })

export function listPolicyVersions(token: string, policyId: number) {
  return adminRequest<{ policy_key: string; data: PolicyVersion[] }>(`/api/leave/policies/${policyId}/versions`, { token })
}

export function revisePolicyVersion(token: string, policyId: number, body: AdminRecord) {
  return post<PolicyVersion>(`/api/leave/policies/${policyId}/versions`, token, body)
}

export function submitPolicyVersion(token: string, policyId: number) {
  return post<PolicyVersion>(`/api/leave/policies/${policyId}/submit`, token)
}

export function approvePolicyVersion(
  token: string,
  policyId: number,
  body: { effective_from?: string; change_reason?: string; allow_retroactive?: boolean },
) {
  return post<PolicyVersion>(`/api/leave/policies/${policyId}/approve`, token, body)
}

export function returnPolicyVersion(token: string, policyId: number, reason: string) {
  return post<PolicyVersion>(`/api/leave/policies/${policyId}/return`, token, { reason })
}

export function discardPolicyVersion(token: string, policyId: number) {
  return post<PolicyVersion>(`/api/leave/policies/${policyId}/discard`, token)
}

export function comparePolicyVersions(token: string, policyId: number, otherId: number) {
  return adminRequest<{ from: { id: number; version_no: number }; to: { id: number; version_no: number }; changes: PolicyChange[] }>(
    `/api/leave/policies/${policyId}/compare/${otherId}`,
    { token },
  )
}

export function getPolicyImpact(token: string, policyId: number) {
  return adminRequest<PolicyImpact>(`/api/leave/policies/${policyId}/impact`, { token })
}

/* -------------------------------------------------------------- rollover */

export function listRolloverRuns(token: string) {
  return adminRequest<RolloverRun[]>("/api/leave/rollover/runs", { token })
}

export function getRolloverRun(token: string, runId: number) {
  return adminRequest<RolloverRun>(`/api/leave/rollover/runs/${runId}`, { token })
}

export function createRolloverRun(token: string, body: { from_leave_year: string; leave_type_id?: number; notes?: string }) {
  return post<RolloverRun>("/api/leave/rollover/runs", token, body)
}

export function refreshRolloverRun(token: string, runId: number) {
  return post<RolloverRun>(`/api/leave/rollover/runs/${runId}/refresh`, token)
}

export function submitRolloverRun(token: string, runId: number) {
  return post<RolloverRun>(`/api/leave/rollover/runs/${runId}/submit`, token)
}

export function approveRolloverRun(token: string, runId: number) {
  return post<RolloverRun>(`/api/leave/rollover/runs/${runId}/approve`, token)
}

export function cancelRolloverRun(token: string, runId: number, reason: string) {
  return post<RolloverRun>(`/api/leave/rollover/runs/${runId}/cancel`, token, { reason })
}

export async function downloadRolloverReport(token: string, runId: number) {
  const response = await fetch(buildUrl(`/api/leave/rollover/runs/${runId}/report.csv`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Could not download the rollover report.")
  return { blob: await response.blob(), filename: `leave-rollover-run-${runId}.csv` }
}

/* ------------------------------------------------------------- statutory */

export function listStatutoryRuleSets(token: string) {
  return adminRequest<StatutoryRuleSet[]>("/api/leave/statutory/rule-sets", { token })
}

export function createStatutoryRuleSet(token: string, body: AdminRecord) {
  return post<StatutoryRuleSet>("/api/leave/statutory/rule-sets", token, body)
}

export function updateStatutoryRuleSet(token: string, id: number, body: AdminRecord) {
  return adminRequest<StatutoryRuleSet>(`/api/leave/statutory/rule-sets/${id}`, { method: "PATCH", token, body })
}

export function reviseStatutoryRuleSet(token: string, id: number) {
  return post<StatutoryRuleSet>(`/api/leave/statutory/rule-sets/${id}/revise`, token)
}

export function submitStatutoryRuleSet(token: string, id: number) {
  return post<StatutoryRuleSet>(`/api/leave/statutory/rule-sets/${id}/submit`, token)
}

export function verifyStatutoryRuleSet(
  token: string,
  id: number,
  body: { verified: boolean; notes: string; legal_references?: LegalReference[] },
) {
  return post<StatutoryRuleSet>(`/api/leave/statutory/rule-sets/${id}/verify`, token, body)
}

export function activateStatutoryRuleSet(token: string, id: number, body: { effective_from: string; change_reason?: string }) {
  return post<StatutoryRuleSet>(`/api/leave/statutory/rule-sets/${id}/activate`, token, body)
}

export function discardStatutoryRuleSet(token: string, id: number) {
  return post<StatutoryRuleSet>(`/api/leave/statutory/rule-sets/${id}/discard`, token)
}

export function getStatutorySettings(token: string) {
  return adminRequest<StatutorySettings>("/api/leave/statutory/settings", { token })
}

export function updateStatutorySettings(
  token: string,
  body: { default_jurisdiction_code?: string | null; branches?: Array<{ branch_id: number; jurisdiction_code: string | null }> },
) {
  return adminRequest<StatutorySettings>("/api/leave/statutory/settings", { method: "PUT", token, body: body as AdminRecord })
}

export function calculatePublicHolidayCompensation(
  token: string,
  body: { from_date: string; to_date: string; payroll_period_code?: string; post?: boolean },
) {
  return post<{ from_date: string; to_date: string; total_amount: number; posted_inputs: number; data: AdminRecord[] }>(
    "/api/leave/statutory/public-holiday-compensation",
    token,
    body,
  )
}

/* -------------------------------------------------- encashment ↔ payroll */

export function reverseLeaveEncashment(token: string, id: number, reason: string) {
  return post<AdminRecord>(`/api/leave/encashments/${id}/reverse`, token, { reason })
}

export function syncLeaveEncashmentPayments(token: string) {
  return post<{ checked: number; paid: number; reversed: number }>("/api/leave/encashments/sync-payments", token)
}

export function getLeavePayrollComponentStatus(token: string) {
  return adminRequest<LeavePayrollComponentStatus[]>("/api/leave/payroll-components/status", { token })
}

export function confirmLeavePayrollComponent(token: string, body: AdminRecord) {
  return post<AdminRecord>("/api/leave/payroll-components/confirm", token, body)
}

/* ---------------------------------------------------------------- labels */

export const POLICY_STATUS_LABEL: Record<PolicyLifecycleStatus, string> = {
  draft: "Draft",
  pending_approval: "Awaiting approval",
  active: "Active",
  superseded: "Superseded",
  archived: "Archived",
}

export const ROLLOVER_STATUS_LABEL: Record<RolloverRunStatus, string> = {
  draft: "Draft",
  previewed: "Previewed",
  pending_approval: "Awaiting approval",
  approved: "Approved",
  processing: "Posting…",
  completed: "Completed",
  partially_failed: "Partly failed",
  failed: "Failed",
  cancelled: "Cancelled",
}

export const STATUTORY_RULE_LABEL: Record<StatutoryRuleType, string> = {
  annual_leave: "Annual leave",
  sick_leave: "Sick leave",
  maternity_leave: "Maternity leave",
  paternity_leave: "Paternity leave",
  public_holiday: "Public holiday work",
  termination_settlement: "Termination settlement",
}

export function statusTone(status: string): string {
  if (["active", "completed", "posted", "verified"].includes(status))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
  if (["pending_approval", "previewed", "approved", "processing", "pending"].includes(status))
    return "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"
  if (["failed", "partially_failed", "rejected"].includes(status))
    return "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
  if (["draft", "unverified"].includes(status))
    return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
  return "bg-muted text-muted-foreground"
}

export function days(value: unknown): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return "-"
  return number.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
