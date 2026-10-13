import { z } from "zod";
import { RecordSchema } from "@/lib/request-json";
import { getSessionSnapshot, subscribeSession } from "@/lib/auth-session-store";
import {
  ADMIN_CACHE_INVALIDATED_EVENT,
  listAttendanceDailySummariesPage,
  listAllEmployees,
  listDepartments,
  listLeaveRequests,
  listOffboardingRequests,
  listOnboardingRequests,
} from "@/lib/admin-api";
import {
  clearDashboardFromLoginFlag,
  isDashboardFromLogin,
  markDashboardFromLogin,
} from "@/lib/dashboard-login-flag";
export {
  clearDashboardFromLoginFlag,
  isDashboardFromLogin,
  markDashboardFromLogin,
};

const WARM_SNAPSHOT_KEY = "hrms.dashboard.warmSnapshot";
const WARM_TTL_MS = 90_000;
const PREFETCH_CACHE_TTL_MS = 30_000;
const Rows = z.array(RecordSchema);
const SnapshotSchema = z.object({
  subject: z.string().min(1),
  companyId: z.number().int().positive(),
  credentialVersion: z.string().min(1),
  savedAt: z.number().finite(),
  fromDate: z.string(),
  toDate: z.string(),
  employees: Rows,
  employeesTotal: z.number().nonnegative().nullable(),
  departments: Rows,
  leaveRequests: Rows,
  attendanceSummaries: Rows,
  onboardingRequests: Rows,
  offboardingRequests: Rows,
});
export type DashboardWarmSnapshot = z.output<typeof SnapshotSchema>;
let warmSnapshotMemory: DashboardWarmSnapshot | null = null;
let warmGeneration = 0;
let observedCredentials = getSessionSnapshot().credentialVersion;
export function resetDashboardWarmCache(): void {
  warmGeneration += 1;
  warmSnapshotMemory = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY);
    } catch {
      /* Memory still clears. */
    }
  }
}
if (typeof window !== "undefined")
  window.addEventListener(
    ADMIN_CACHE_INVALIDATED_EVENT,
    resetDashboardWarmCache,
  );
subscribeSession(() => {
  const version = getSessionSnapshot().credentialVersion;
  if (version !== observedCredentials) {
    observedCredentials = version;
    resetDashboardWarmCache();
  }
});
function isCurrent(snapshot: DashboardWarmSnapshot): boolean {
  const actor = getSessionSnapshot();
  const age = Date.now() - snapshot.savedAt;
  return (
    snapshot.subject === actor.subject &&
    snapshot.companyId === actor.companyId &&
    snapshot.credentialVersion === actor.credentialVersion &&
    age >= 0 &&
    age <= WARM_TTL_MS
  );
}
function date(value: Date) {
  return value.toISOString().slice(0, 10);
}
export async function prefetchDashboardWarmCache(token: string): Promise<void> {
  if (typeof window === "undefined") return;
  const actor = getSessionSnapshot();
  if (!actor.subject || !actor.companyId || actor.tokens?.accessToken !== token)
    return;
  const generation = warmGeneration;
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fromDate = date(from);
  const toDate = date(new Date());
  const options = { cacheTtlMs: PREFETCH_CACHE_TTL_MS };
  // A failed request must not manufacture a ready, empty overview.
  let results;
  try {
    results = await Promise.all([
      listAllEmployees(token, {}, options),
      listDepartments(token, { page: 1, limit: 100 }, options),
      listLeaveRequests(token, {
        page: 1,
        limit: 40,
        from_date: fromDate,
        to_date: toDate,
      }),
      listAttendanceDailySummariesPage(
        token,
        { page: 1, limit: 100, from_date: fromDate, to_date: toDate },
        options,
      ),
      listOnboardingRequests(token, { page: 1, limit: 50 }),
      listOffboardingRequests(token, { page: 1, limit: 50 }),
    ]);
  } catch {
    return;
  }
  if (
    generation !== warmGeneration ||
    getSessionSnapshot().credentialVersion !== actor.credentialVersion
  )
    return;
  const [employees, departments, leave, attendance, onboarding, offboarding] =
    results;
  const snapshot = SnapshotSchema.parse({
    subject: actor.subject,
    companyId: actor.companyId,
    credentialVersion: actor.credentialVersion,
    savedAt: Date.now(),
    fromDate,
    toDate,
    employees,
    employeesTotal: employees.length,
    departments: departments.rows,
    leaveRequests: leave.rows,
    attendanceSummaries: attendance.rows,
    onboardingRequests: onboarding.rows,
    offboardingRequests: offboarding.rows,
  });
  if (!isCurrent(snapshot)) return;
  warmSnapshotMemory = snapshot;
  markDashboardFromLogin();
  try {
    window.sessionStorage.setItem(WARM_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* Memory remains usable. */
  }
}
export function consumeDashboardWarmCache(): DashboardWarmSnapshot | null {
  if (typeof window === "undefined") return null;
  if (warmSnapshotMemory) {
    if (isCurrent(warmSnapshotMemory)) return warmSnapshotMemory;
    resetDashboardWarmCache();
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(WARM_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = SnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !isCurrent(parsed.data)) {
      resetDashboardWarmCache();
      return null;
    }
    warmSnapshotMemory = parsed.data;
    window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY);
    return warmSnapshotMemory;
  } catch {
    resetDashboardWarmCache();
    return null;
  }
}
