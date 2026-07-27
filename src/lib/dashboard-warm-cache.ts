import {
  listAttendanceDailySummariesPage,
  listDepartments,
  listEmployees,
  listLeaveRequests,
  listOffboardingRequests,
  listOnboardingRequests,
  type AdminRecord,
} from "@/lib/admin-api"

const WARM_SNAPSHOT_KEY = "hrms.dashboard.warmSnapshot"
const FROM_LOGIN_FLAG_KEY = "hrms.dashboard.fromLogin"
/** How long a post-login snapshot stays valid for first paint. */
const WARM_TTL_MS = 90_000
const PREFETCH_CACHE_TTL_MS = 30_000

export type DashboardWarmSnapshot = {
  savedAt: number
  fromDate: string
  toDate: string
  employees: AdminRecord[]
  employeesTotal: number | null
  departments: AdminRecord[]
  leaveRequests: AdminRecord[]
  attendanceSummaries: AdminRecord[]
  onboardingRequests: AdminRecord[]
  offboardingRequests: AdminRecord[]
}

function formatInputDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shiftDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function defaultDateRange() {
  return {
    fromDate: formatInputDate(shiftDays(new Date(), -30)),
    toDate: formatInputDate(new Date()),
  }
}

/** Set before redirect so dashboard shells can skip skeleton flash. */
export function markDashboardFromLogin() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(FROM_LOGIN_FLAG_KEY, "1")
  } catch {
    // ignore quota / private mode
  }
}

export function isDashboardFromLogin(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(FROM_LOGIN_FLAG_KEY) === "1"
  } catch {
    return false
  }
}

export function clearDashboardFromLoginFlag() {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(FROM_LOGIN_FLAG_KEY)
  } catch {
    // ignore
  }
}

/**
 * Prefetch overview APIs during the login loader, then store a snapshot that
 * survives full-page redirect (in-memory admin cache does not).
 */
export async function prefetchDashboardWarmCache(token: string): Promise<void> {
  if (typeof window === "undefined" || !token.trim()) {
    return
  }

  markDashboardFromLogin()

  const { fromDate, toDate } = defaultDateRange()
  const listOpts = { cacheTtlMs: PREFETCH_CACHE_TTL_MS }

  const leaveParams: Record<string, string | number> = { page: 1, limit: 40 }
  if (fromDate) leaveParams.from_date = fromDate
  if (toDate) leaveParams.to_date = toDate

  const attParams: Record<string, string | number> = { page: 1, limit: 100 }
  if (fromDate) attParams.from_date = fromDate
  if (toDate) attParams.to_date = toDate

  const emptyPage = { rows: [] as AdminRecord[], total: null as number | null }

  const [empRes, deptRes, leaveRes, attRes, onboardRes, offboardRes] = await Promise.all([
    listEmployees(token, { page: 1, limit: 200 }, listOpts).catch(() => emptyPage),
    listDepartments(token, { page: 1, limit: 100 }, listOpts).catch(() => emptyPage),
    listLeaveRequests(token, leaveParams).catch(() => emptyPage),
    listAttendanceDailySummariesPage(token, attParams, listOpts).catch(() => emptyPage),
    listOnboardingRequests(token, { page: 1, limit: 50 }).catch(() => emptyPage),
    listOffboardingRequests(token, { page: 1, limit: 50 }).catch(() => emptyPage),
  ])

  const snapshot: DashboardWarmSnapshot = {
    savedAt: Date.now(),
    fromDate,
    toDate,
    employees: empRes.rows ?? [],
    employeesTotal: empRes.total ?? empRes.rows?.length ?? null,
    departments: deptRes.rows ?? [],
    leaveRequests: leaveRes.rows ?? [],
    attendanceSummaries: attRes.rows ?? [],
    onboardingRequests: onboardRes.rows ?? [],
    offboardingRequests: offboardRes.rows ?? [],
  }

  try {
    window.sessionStorage.setItem(WARM_SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // Still keep from-login flag so shells can skip heavy skeletons.
  }
}

/**
 * Module memory so React Strict Mode remounts still see the same snapshot
 * after sessionStorage was read once on this page load.
 */
let warmSnapshotMemory: DashboardWarmSnapshot | null | undefined

/** Read once for first paint (safe under Strict Mode double-mount). */
export function consumeDashboardWarmCache(): DashboardWarmSnapshot | null {
  if (typeof window === "undefined") return null

  if (warmSnapshotMemory !== undefined) {
    return warmSnapshotMemory
  }

  try {
    const raw = window.sessionStorage.getItem(WARM_SNAPSHOT_KEY)
    if (!raw) {
      warmSnapshotMemory = null
      return null
    }

    const parsed = JSON.parse(raw) as DashboardWarmSnapshot
    if (!parsed || typeof parsed.savedAt !== "number") {
      window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY)
      warmSnapshotMemory = null
      return null
    }

    if (Date.now() - parsed.savedAt > WARM_TTL_MS) {
      window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY)
      warmSnapshotMemory = null
      return null
    }

    window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY)
    warmSnapshotMemory = parsed
    return parsed
  } catch {
    try {
      window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY)
    } catch {
      // ignore
    }
    warmSnapshotMemory = null
    return null
  }
}
