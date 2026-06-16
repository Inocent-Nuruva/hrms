"use client"

import * as React from "react"
import {
  UsersIcon,
  UserCheckIcon,
  CalendarIcon,
  ClockIcon,
  Building2Icon,
  RefreshCwIcon,
  AlertCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
} from "lucide-react"

import {
  listEmployees,
  listDepartments,
  listLeaveRequests,
  listAttendanceDailySummaries,
  listOnboardingRequests,
  listOffboardingRequests,
  type AdminRecord,
} from "@/lib/admin-api"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken"

function readStoredToken(): string {
  if (typeof window === "undefined") return ""
  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? ""
  if (direct) return direct
  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens)
  if (!authTokensRaw) return ""
  try {
    const parsed = JSON.parse(authTokensRaw) as { accessToken?: string; access_token?: string }
    return (parsed.accessToken ?? parsed.access_token ?? "").trim()
  } catch {
    return ""
  }
}

function readString(row: AdminRecord, keys: string[]): string {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function readNumber(row: AdminRecord, keys: string[]): number | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim()) {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is AdminRecord => !!v && typeof v === "object")
}

function asRecord(value: unknown): AdminRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as AdminRecord
  }
  return null
}

function formatDateShort(value: unknown): string {
  if (!value) return "-"
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return "-"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getEmployeeName(row: AdminRecord): string {
  const direct = readString(row, ["full_name", "fullName", "name", "display_name"])
  if (direct) return direct
  const parts = [
    readString(row, ["first_name", "firstName"]),
    readString(row, ["middle_name", "middleName"]),
    readString(row, ["last_name", "lastName"]),
  ].filter(Boolean)
  return parts.length ? parts.join(" ") : "-"
}

function getEmployeeNo(row: AdminRecord): string {
  return readString(row, ["employee_no", "employeeNo", "user_no", "employee_number", "code"]) || "-"
}

function getEmploymentStatus(row: AdminRecord): string {
  const s = readString(row, ["employment_status", "status", "employmentStatus"])
  return s || "unknown"
}

function getDepartmentNameFromEmployee(row: AdminRecord): string {
  // Prefer nested objects (common in this system: primary_department or department)
  const primary = asRecord(row.primary_department)
  if (primary) {
    const n = readString(primary, ["name", "department_name", "title"])
    if (n) return n
  }

  const dept = asRecord(row.department)
  if (dept) {
    const n = readString(dept, ["name", "department_name", "title"])
    if (n) return n
  }

  const direct = readString(row, [
    "department_name",
    "departmentName",
    "dept_name",
    "primary_department",
    "department",
  ])
  if (direct) return direct

  const arr = asRecordArray(row.departments ?? row.dept ?? row.departments_list)
  for (const item of arr) {
    const n = readString(item, ["name", "department_name", "title"])
    if (n) return n
  }

  const id = readNumber(row, [
    "department_id",
    "dept_id",
    "primary_department_id",
    "departmentId",
    "deptId",
    "department_id_fk",
  ])
  if (id != null) return `Dept #${id}`
  return ""
}

function getLeaveStatus(row: AdminRecord): string {
  return readString(row, ["status", "leave_status", "request_status"]).toLowerCase() || "unknown"
}

function getLeaveType(row: AdminRecord): string {
  const t = readString(row, ["leave_type_name", "leave_type", "type_name", "name"])
  if (t) return t
  const lt = row.leave_type as AdminRecord | undefined
  if (lt && typeof lt === "object") {
    return readString(lt, ["name", "code", "title"]) || "Leave"
  }
  return "Leave"
}

function getLeaveEmployeeName(row: AdminRecord): string {
  const direct = readString(row, ["employee_name", "full_name", "employee_full_name"])
  if (direct) return direct
  const emp = row.employee as AdminRecord | undefined
  if (emp && typeof emp === "object") {
    return getEmployeeName(emp)
  }
  return "-"
}

function getLeaveDates(row: AdminRecord): string {
  const from = readString(row, ["from_date", "start_date", "date_from"])
  const to = readString(row, ["to_date", "end_date", "date_to"])
  if (from && to) return `${formatDateShort(from)} – ${formatDateShort(to)}`
  if (from) return formatDateShort(from)
  return "-"
}

function getAttendanceStatus(row: AdminRecord): string {
  return readString(row, ["status", "attendance_status", "work_status", "day_status"]).toLowerCase()
}

interface Metric {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
}

interface HrAnalyticsDashboardProps {
  refreshKey?: number
}

export default function HrAnalyticsDashboard({ refreshKey = 0 }: HrAnalyticsDashboardProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)

  const [range, setRange] = React.useState<"7d" | "30d" | "90d" | "all">("30d")

  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [employeesTotal, setEmployeesTotal] = React.useState<number | null>(null)
  const [departments, setDepartments] = React.useState<AdminRecord[]>([])
  const [departmentHeadcounts, setDepartmentHeadcounts] = React.useState<Array<[string, number]>>([])
  const [leaveRequests, setLeaveRequests] = React.useState<AdminRecord[]>([])
  const [attendanceSummaries, setAttendanceSummaries] = React.useState<AdminRecord[]>([])
  const [onboardingRequests, setOnboardingRequests] = React.useState<AdminRecord[]>([])
  const [offboardingRequests, setOffboardingRequests] = React.useState<AdminRecord[]>([])

  const fetchAll = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("No active session. Please sign in again.")
      setEmployees([])
      setDepartments([])
      setLeaveRequests([])
      setAttendanceSummaries([])
      setOnboardingRequests([])
      setOffboardingRequests([])
      setEmployeesTotal(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Compute date filters for this range (closed over current range)
    let from_date: string | undefined
    let to_date: string | undefined
    if (range !== "all") {
      const now = new Date()
      const from = new Date(now)
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
      from.setDate(from.getDate() - days)
      from_date = from.toISOString().slice(0, 10)
      to_date = now.toISOString().slice(0, 10)
    }

    const leaveParams: any = { page: 1, limit: 40 }
    if (from_date) leaveParams.from_date = from_date
    if (to_date) leaveParams.to_date = to_date

    const attParams: any = { page: 1, limit: 30 }
    if (from_date) attParams.from_date = from_date
    if (to_date) attParams.to_date = to_date

    try {
      const [empRes, deptRes, leaveRes, attRes, onboardRes, offboardRes] = await Promise.all([
        listEmployees(token, { page: 1, limit: 200 }).catch(() => ({ rows: [] as AdminRecord[], total: null })),
        listDepartments(token, { page: 1, limit: 100 }).catch(() => ({ rows: [] as AdminRecord[], total: null })),
        listLeaveRequests(token, leaveParams).catch(() => ({ rows: [] as AdminRecord[], total: null })),
        listAttendanceDailySummaries(token, attParams).catch(() => [] as AdminRecord[]),
        listOnboardingRequests(token, { page: 1, limit: 50 }).catch(() => ({ rows: [] as AdminRecord[] })),
        listOffboardingRequests(token, { page: 1, limit: 50 }).catch(() => ({ rows: [] as AdminRecord[] })),
      ])

      const empRows = (empRes as any).rows ?? []
      const deptRows = (deptRes as any).rows ?? []
      const leaveRows = (leaveRes as any).rows ?? []
      const attRows = Array.isArray(attRes) ? attRes : ((attRes as any)?.rows ?? [])
      const onboardRows = (onboardRes as any).rows ?? []
      const offboardRows = (offboardRes as any).rows ?? []

      setEmployees(empRows)
      setEmployeesTotal((empRes as any).total ?? empRows.length)
      setDepartments(deptRows)
      setLeaveRequests(leaveRows)
      setAttendanceSummaries(attRows)
      setOnboardingRequests(onboardRows)
      setOffboardingRequests(offboardRows)
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))

      // Accurate department headcounts: use the department_id filter + total from listEmployees.
      // This is reliable even when the employee list rows do not embed department linkage.
      const deptsForCounts = deptRows.slice(0, 10)
      const countPromises = deptsForCounts.map(async (d: AdminRecord) => {
        const did = readNumber(d, ["id", "department_id"])
        if (did == null) return null
        const nm = readString(d, ["name", "department_name", "title"]) || `Dept #${did}`
        try {
          const res = await listEmployees(token, { page: 1, limit: 1, department_id: did } as any)
          const cnt = (res as any).total ?? (res as any).rows?.length ?? 0
          return [nm, cnt] as [string, number]
        } catch {
          return [nm, 0] as [string, number]
        }
      })
      const countResults = (await Promise.all(countPromises)).filter((x): x is [string, number] => x != null)
      setDepartmentHeadcounts(countResults.sort((a, b) => b[1] - a[1]))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load analytics."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [range])

  React.useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      void fetchAll()
    }
  }, [refreshKey, fetchAll])

  // Derived metrics
  const totalHeadcount = employeesTotal ?? employees.length

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of employees) {
      const s = getEmploymentStatus(e).toLowerCase()
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [employees])

  const activeCount = statusCounts["active"] || 0
  const activePct = totalHeadcount > 0 ? Math.round((activeCount / totalHeadcount) * 100) : 0

  // Note: departmentHeadcounts (accurate via filtered queries) is populated in fetchAll.
  // We keep a simple max for the bars from the accurate data.
  const maxDeptCount = React.useMemo(() => {
    return Math.max(1, ...departmentHeadcounts.map(([, c]) => c))
  }, [departmentHeadcounts])

  const leaveStatusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of leaveRequests) {
      const s = getLeaveStatus(l)
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [leaveRequests])

  const pendingLeaves = leaveStatusCounts["pending"] || leaveStatusCounts["submitted"] || 0
  const recentLeaves = React.useMemo(() => {
    return [...leaveRequests]
      .sort((a, b) => {
        const da = String(a.created_at || a.requested_at || "")
        const db = String(b.created_at || b.requested_at || "")
        return db.localeCompare(da)
      })
      .slice(0, 6)
  }, [leaveRequests])

  // Attendance rate from summaries (defensive)
  const attendanceRate = React.useMemo(() => {
    if (!attendanceSummaries.length) return null
    let present = 0
    let total = 0
    for (const s of attendanceSummaries) {
      const st = getAttendanceStatus(s)
      total += 1
      if (
        st.includes("present") ||
        st.includes("worked") ||
        st.includes("on_time") ||
        st.includes("ontime") ||
        st === "ok" ||
        st.includes("full")
      ) {
        present += 1
      }
    }
    if (total === 0) return null
    return Math.round((present / total) * 100)
  }, [attendanceSummaries])

  const recentEmployees = React.useMemo(() => {
    return [...employees]
      .sort((a, b) => {
        const da = String(a.created_at || a.hire_date || a.joined_at || "")
        const db = String(b.created_at || b.hire_date || b.joined_at || "")
        return db.localeCompare(da)
      })
      .slice(0, 5)
  }, [employees])

  // Surface more: hires within the chosen date range (client-side on the loaded sample)
  const hiresInRange = React.useMemo(() => {
    if (range === "all") return 0
    const now = new Date()
    const from = new Date(now)
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90
    from.setDate(from.getDate() - days)
    let c = 0
    for (const e of employees) {
      const ds = readString(e, [
        "created_at",
        "createdAt",
        "hire_date",
        "hired_at",
        "joined_at",
        "start_date",
        "employment_start",
      ])
      if (!ds) continue
      const d = new Date(ds)
      if (isNaN(d.getTime())) continue
      if (d >= from && d <= now) c += 1
    }
    return c
  }, [employees, range])

  const pendingOnboarding = React.useMemo(() => {
    return onboardingRequests.filter((r) => {
      const s = readString(r, ["status", "request_status"]).toLowerCase()
      return !s || s.includes("pend") || s.includes("progress") || s === "open" || s === "in_progress"
    }).length
  }, [onboardingRequests])

  const pendingOffboarding = React.useMemo(() => {
    return offboardingRequests.filter((r) => {
      const s = readString(r, ["status", "request_status"]).toLowerCase()
      return !s || s.includes("pend") || s.includes("progress") || s === "open" || s === "in_progress"
    }).length
  }, [offboardingRequests])

  const metrics: Metric[] = [
    {
      label: "Headcount",
      value: totalHeadcount,
      sub: `${activeCount} active • ${activePct}%`,
      icon: UsersIcon,
    },
    {
      label: "Departments",
      value: departments.length || departmentHeadcounts.length || "-",
      sub: "Active structures",
      icon: Building2Icon,
    },
    {
      label: "Pending Leave",
      value: pendingLeaves,
      sub: "Awaiting action",
      icon: CalendarIcon,
    },
    {
      label: "Attendance",
      value: attendanceRate != null ? `${attendanceRate}%` : "—",
      sub: attendanceRate != null ? "Last period" : "No summary data",
      icon: ClockIcon,
    },
    {
      label: "New hires",
      value: hiresInRange,
      sub: range === "all" ? "All time (sample)" : `Last ${range}`,
      icon: UserCheckIcon,
    },
    {
      label: "Onboarding",
      value: pendingOnboarding,
      sub: "open requests",
      icon: UserPlusIcon,
    },
    {
      label: "Offboarding",
      value: pendingOffboarding,
      sub: "open requests",
      icon: UserMinusIcon,
    },
  ]

  const statusOrder = ["active", "onboarding", "suspended", "terminated", "exited"]

  const rangeOptions: Array<{ key: "7d" | "30d" | "90d" | "all"; label: string }> = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
  ]

  return (
    <div className="px-4 pb-10 pt-2 lg:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Company overview</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Workforce Analytics</h1>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="mr-1 text-[11px] uppercase tracking-[0.06em] text-slate-500">Range</span>
            {rangeOptions.map((opt) => {
              const active = range === opt.key
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRange(opt.key)}
                  disabled={loading}
                  className={`rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => fetchAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircleIcon className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {metrics.map((m, idx) => {
          const Icon = m.icon
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
            >
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{m.value}</div>
              {m.sub ? <div className="mt-0.5 text-xs text-slate-500">{m.sub}</div> : null}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Status breakdown */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-medium text-slate-800">Employment Status</div>
            <div className="text-xs text-slate-500">Distribution from loaded records</div>
          </div>
          <div className="p-4">
            {Object.keys(statusCounts).length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No employee records yet.</div>
            ) : (
              <div className="space-y-2">
                {statusOrder
                  .filter((s) => statusCounts[s] != null)
                  .concat(Object.keys(statusCounts).filter((s) => !statusOrder.includes(s)))
                  .map((status) => {
                    const count = statusCounts[status] || 0
                    const pct = totalHeadcount > 0 ? Math.round((count / totalHeadcount) * 100) : 0
                    return (
                      <div key={status} className="flex items-center gap-3 text-sm">
                        <div className="w-28 shrink-0 font-medium text-slate-700 capitalize">{status}</div>
                        <div className="flex-1">
                          <div className="h-2 w-full rounded bg-slate-100">
                            <div
                              className="h-2 rounded bg-slate-800"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-16 text-right tabular-nums text-slate-600">
                          {count} <span className="text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
            {totalHeadcount} total • based on current sample
          </div>
        </div>

        {/* Department breakdown - clean horizontal bars (accurate counts via backend filter) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-medium text-slate-800">Employees by Department</div>
            <div className="text-xs text-slate-500">Top populated departments (live counts)</div>
          </div>
          <div className="p-4">
            {departmentHeadcounts.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No departments found.</div>
            ) : (
              <div className="space-y-2.5">
                {departmentHeadcounts.map(([name, count]) => {
                  const width = Math.max(4, Math.round((count / maxDeptCount) * 100))
                  return (
                    <div key={name} className="grid grid-cols-[1fr,auto] items-center gap-x-4 text-sm">
                      <div className="truncate pr-2 text-slate-700" title={name}>{name}</div>
                      <div className="text-right tabular-nums text-slate-500 w-9">{count}</div>
                      <div className="col-span-2 mt-1">
                        <div className="h-1.5 w-full rounded bg-slate-100">
                          <div className="h-1.5 rounded bg-slate-700" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
                {departmentHeadcounts.every(([, c]) => c === 0) && (
                  <div className="pt-1 text-[11px] text-amber-600">All shown as 0 — no employees assigned or filter returned no matches. Check employee department linkages.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Leave snapshot + recent requests */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-800">Leave Requests</div>
              <div className="text-xs text-slate-500">
                {range === "all" ? "Latest activity" : `In selected range (${range})`}
              </div>
            </div>
            <div className="text-xs font-medium text-slate-500 tabular-nums">{leaveRequests.length} shown</div>
          </div>

          <div className="p-4">
            {/* Status pills */}
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.keys(leaveStatusCounts).length === 0 && (
                <span className="text-xs text-slate-500">No recent leave requests.</span>
              )}
              {Object.entries(leaveStatusCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([st, ct]) => (
                  <span
                    key={st}
                    className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-700"
                  >
                    {st} <span className="ml-1 font-mono text-slate-400">· {ct}</span>
                  </span>
                ))}
            </div>

            {/* Recent leave list */}
            {recentLeaves.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-normal">Employee</th>
                      <th className="px-3 py-2 text-left font-normal">Type</th>
                      <th className="px-3 py-2 text-left font-normal">Dates</th>
                      <th className="px-3 py-2 text-left font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentLeaves.map((lr, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{getLeaveEmployeeName(lr)}</td>
                        <td className="px-3 py-2">{getLeaveType(lr)}</td>
                        <td className="px-3 py-2 text-slate-500">{getLeaveDates(lr)}</td>
                        <td className="px-3 py-2">
                          <span className="rounded border border-slate-200 px-1.5 py-px text-[10px] uppercase tracking-wider text-slate-600">
                            {getLeaveStatus(lr)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-2 text-sm text-slate-500">No leave requests to display.</div>
            )}
          </div>
        </div>

        {/* Recent people + attendance summary */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-medium text-slate-800">Recent People</div>
            <div className="text-xs text-slate-500">Newest records (current snapshot)</div>
          </div>
          <div className="p-4">
            {recentEmployees.length === 0 ? (
              <div className="py-5 text-sm text-slate-500">No employee records loaded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="px-2 pb-2">Employee No</th>
                      <th className="px-2 pb-2">Name</th>
                      <th className="px-2 pb-2">Status</th>
                      <th className="px-2 pb-2">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {recentEmployees.map((emp, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-2.5 font-mono text-xs text-slate-500">{getEmployeeNo(emp)}</td>
                        <td className="px-2 py-2.5 font-medium">{getEmployeeName(emp)}</td>
                        <td className="px-2 py-2.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">
                            {getEmploymentStatus(emp)}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-slate-500">
                          {getDepartmentNameFromEmployee(emp) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {attendanceRate != null && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              Attendance rate (from summaries): <span className="font-medium text-slate-700">{attendanceRate}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-[11px] text-slate-400">
        {lastUpdated ? `Last updated ${lastUpdated}` : "Loading data…"} • Data sampled from API (range: {range}). Refresh via header or local button.
      </div>
    </div>
  )
}
