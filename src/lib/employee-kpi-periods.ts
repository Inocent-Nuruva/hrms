import type { AdminRecord } from "@/lib/admin-api";

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function readText(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function recordId(row: AdminRecord | null | undefined) {
  if (!row) return "";
  for (const key of ["id", "performancePeriodId", "performance_period_id"]) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * My KPIs has no GET /api/performance/me/periods.
 *
 * Documented employee sources:
 * - GET /api/performance/me/assignments (PerformanceSelfService_listAssignments)
 *   includes PerformancePeriodAssignment.performancePeriod
 * - GET /api/performance/me/kpis (PerformanceSelfService_listKpis)
 *
 * GET /api/performance/periods is HR Performance Management and 403s employees.
 * GET /api/payroll/configuration/periods is payroll, not this page.
 */
export function periodRecordFromEmployeeRow(
  row: AdminRecord,
): AdminRecord | null {
  const nested = asRecord(row.performancePeriod ?? row.performance_period);
  const nestedId = recordId(nested);
  if (nested && nestedId) {
    return {
      ...nested,
      id: nested.id ?? (Number(nestedId) || nestedId),
      status: readText(nested, ["status"]),
    };
  }

  const periodId = row.performancePeriodId ?? row.performance_period_id;
  if (periodId === undefined || periodId === null || periodId === "") {
    return null;
  }

  return {
    id: periodId,
    name: readText(row, ["period_name", "periodName"]),
    status: readText(row, ["period_status", "periodStatus"]),
  };
}

export function collectEmployeeKpiPeriods(rows: AdminRecord[]) {
  const byId = new Map<string, AdminRecord>();
  for (const row of rows) {
    const period = periodRecordFromEmployeeRow(row);
    const id = recordId(period);
    if (!period || !id) continue;
    const existing = byId.get(id);
    byId.set(id, existing ? { ...period, ...existing } : period);
  }
  return Array.from(byId.values());
}

const CLOSED_PERIOD_STATUSES = new Set([
  "LOCKED",
  "CANCELLED",
  "CANCELED",
  "CLOSED",
  "PUBLISHED",
  "APPROVED",
  "HR_REVIEW",
  "MODERATION",
  "SELF_REVIEW",
  "MANAGER_REVIEW",
]);

export function employeeKpiPeriodId(period: AdminRecord | null | undefined) {
  return recordId(period);
}

/** The API accepts employee KPI proposals only while the period is OPEN. */
export function canProposeEmployeeKpis(period: AdminRecord | null | undefined) {
  if (!employeeKpiPeriodId(period)) return false;
  const status = readText(period, ["status"]).toUpperCase();
  if (status !== "OPEN" || CLOSED_PERIOD_STATUSES.has(status)) return false;
  const phase = readText(period, ["kpiPhase", "kpi_phase"]).toUpperCase();
  if (!phase || phase === "REOPENED") return true;
  if (phase !== "GOAL_SETTING") return false;
  const deadline = readText(period, ["goalSettingDeadline", "goal_setting_deadline"]);
  return !deadline || new Date().toISOString().slice(0, 10) <= deadline.slice(0, 10);
}

export function firstWritableEmployeeKpiPeriod(periods: AdminRecord[]) {
  return periods.find((period) => canProposeEmployeeKpis(period)) ?? null;
}
