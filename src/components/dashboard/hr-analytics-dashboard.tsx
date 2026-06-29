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
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
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

function formatInputDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function shiftDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
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
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose"
}

type PagedRowsResult = {
  rows: AdminRecord[]
  total: number | null
}

type AttendanceListResult = AdminRecord[] | { rows?: AdminRecord[] }

interface HrAnalyticsDashboardProps {
  refreshKey?: number
}

function AnimatedMetricValue({ value }: { value: string | number }) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    typeof value === "number" ? "0" : typeof value === "string" && value.endsWith("%") ? "0%" : String(value)
  )

  React.useEffect(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      let frame = 0
      const duration = 650
      const startedAt = performance.now()

      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplayValue(String(Math.round(value * eased)))
        if (progress < 1) {
          frame = window.requestAnimationFrame(tick)
        }
      }

      frame = window.requestAnimationFrame(tick)
      return () => window.cancelAnimationFrame(frame)
    }

    if (typeof value === "string" && value.endsWith("%")) {
      const numeric = Number(value.replace("%", ""))
      if (!Number.isFinite(numeric)) {
        setDisplayValue(value)
        return
      }

      let frame = 0
      const duration = 650
      const startedAt = performance.now()

      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplayValue(`${Math.round(numeric * eased)}%`)
        if (progress < 1) {
          frame = window.requestAnimationFrame(tick)
        }
      }

      frame = window.requestAnimationFrame(tick)
      return () => window.cancelAnimationFrame(frame)
    }

    setDisplayValue(String(value))
  }, [value])

  return <>{displayValue}</>
}

export default function HrAnalyticsDashboard({ refreshKey = 0 }: HrAnalyticsDashboardProps) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null)

  const [fromDate, setFromDate] = React.useState(() => formatInputDate(shiftDays(new Date(), -30)))
  const [toDate, setToDate] = React.useState(() => formatInputDate(new Date()))

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

    const from_date = fromDate.trim() || undefined
    const to_date = toDate.trim() || undefined

    const leaveParams: Record<string, string | number> = { page: 1, limit: 40 }
    if (from_date) leaveParams.from_date = from_date
    if (to_date) leaveParams.to_date = to_date

    const attParams: Record<string, string | number> = { page: 1, limit: 30 }
    if (from_date) attParams.from_date = from_date
    if (to_date) attParams.to_date = to_date

    try {
      const [empRes, deptRes, leaveRes, attRes, onboardRes, offboardRes] = await Promise.all([
        listEmployees(token, { page: 1, limit: 200 }).catch((): PagedRowsResult => ({ rows: [], total: null })),
        listDepartments(token, { page: 1, limit: 100 }).catch((): PagedRowsResult => ({ rows: [], total: null })),
        listLeaveRequests(token, leaveParams).catch((): PagedRowsResult => ({ rows: [], total: null })),
        listAttendanceDailySummaries(token, attParams).catch((): AttendanceListResult => []),
        listOnboardingRequests(token, { page: 1, limit: 50 }).catch((): PagedRowsResult => ({ rows: [], total: null })),
        listOffboardingRequests(token, { page: 1, limit: 50 }).catch((): PagedRowsResult => ({ rows: [], total: null })),
      ])

      const empRows = empRes.rows ?? []
      const deptRows = deptRes.rows ?? []
      const leaveRows = leaveRes.rows ?? []
      const attRows = Array.isArray(attRes) ? attRes : (attRes.rows ?? [])
      const onboardRows = onboardRes.rows ?? []
      const offboardRows = offboardRes.rows ?? []

      setEmployees(empRows)
      setEmployeesTotal(empRes.total ?? empRows.length)
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
          const res = await listEmployees(token, { page: 1, limit: 1, department_id: did })
          const cnt = res.total ?? res.rows?.length ?? 0
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
  }, [fromDate, toDate])

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
    if (!fromDate || !toDate) return 0
    const from = new Date(fromDate)
    const to = new Date(toDate)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
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
      if (d >= from && d <= to) c += 1
    }
    return c
  }, [employees, fromDate, toDate])

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
      tone: "blue",
    },
    {
      label: "Departments",
      value: departments.length || departmentHeadcounts.length || "-",
      sub: "Active structures",
      icon: Building2Icon,
      tone: "slate",
    },
    {
      label: "Pending Leave",
      value: pendingLeaves,
      sub: "Awaiting action",
      icon: CalendarIcon,
      tone: "amber",
    },
    {
      label: "Attendance",
      value: attendanceRate != null ? `${attendanceRate}%` : "—",
      sub: attendanceRate != null ? "Last period" : "No summary data",
      icon: ClockIcon,
      tone: "emerald",
    },
    {
      label: "New hires",
      value: hiresInRange,
      sub: fromDate && toDate ? `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}` : "Selected range",
      icon: UserCheckIcon,
      tone: "blue",
    },
    {
      label: "Onboarding",
      value: pendingOnboarding,
      sub: "open requests",
      icon: UserPlusIcon,
      tone: "emerald",
    },
    {
      label: "Offboarding",
      value: pendingOffboarding,
      sub: "open requests",
      icon: UserMinusIcon,
      tone: "rose",
    },
  ]

  const statusOrder = ["active", "onboarding", "suspended", "terminated", "exited"]

  return (
    <div className="px-4 pb-10 pt-3 lg:px-6">
      <section className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div>
                <h1 className="text-2xl font-normal tracking-[-0.04em] text-slate-700 sm:text-[2.85rem]">
                  Workforce Analytics
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <div className="grid min-w-[260px] gap-2 sm:grid-cols-2">
                <DatePickerPresets value={fromDate} onChange={setFromDate} placeholder="From date" />
                <DatePickerPresets value={toDate} onChange={setToDate} placeholder="To date" />
              </div>
              <button
                type="button"
                onClick={() => fetchAll()}
                disabled={loading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                <RefreshCwIcon className={`h-4 w-4 text-primary ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(formatInputDate(shiftDays(new Date(), -30)))
                  setToDate(formatInputDate(new Date()))
                }}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset dates
              </button>
              <div className="text-xs text-slate-500">
                {lastUpdated ? `Updated ${lastUpdated}` : "Waiting for latest sync"}
              </div>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((m, idx) => {
              return (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 transition-transform duration-500 ease-out last:border-b-0 sm:last:border-b sm:nth-[3]:border-b-0 xl:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {m.label}
                    </div>
                    <div className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950">
                      <AnimatedMetricValue value={m.value} />
                    </div>
                    {m.sub ? <div className="mt-1 text-sm leading-5 text-slate-500">{m.sub}</div> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          <AlertCircleIcon className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12 lg:items-start">
        {/* Leave snapshot + recent requests */}
        <section className="self-start lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Leave Requests</div>
              <div className="text-xs text-slate-500">
                {fromDate && toDate ? `${formatDateShort(fromDate)} to ${formatDateShort(toDate)}` : "Latest activity"}
              </div>
            </div>
            <div className="text-xs font-medium text-slate-500 tabular-nums">{leaveRequests.length} shown</div>
          </div>

          <div className="pt-4">
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
                    className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700"
                  >
                    {st} <span className="ml-1 font-mono text-slate-400">· {ct}</span>
                  </span>
                ))}
            </div>

            {/* Recent leave list */}
            {recentLeaves.length > 0 ? (
              <div className="overflow-hidden">
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
        </section>

        {/* Status breakdown */}
        <section className="self-start lg:col-span-6">
          <div className="border-b border-slate-200 pb-3">
            <div className="text-sm font-semibold text-slate-900">Employment Status</div>
            <div className="text-xs text-slate-500">Current workforce mix from loaded records</div>
          </div>
          <div className="space-y-4 pt-4">
            {Object.keys(statusCounts).length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No employee records yet.</div>
            ) : (
              <>
                <div className="space-y-3">
                  {statusOrder
                    .filter((s) => statusCounts[s] != null)
                    .concat(Object.keys(statusCounts).filter((s) => !statusOrder.includes(s)))
                    .map((status) => {
                      const count = statusCounts[status] || 0
                      const pct = totalHeadcount > 0 ? Math.round((count / totalHeadcount) * 100) : 0
                      const isActive = status === "active"
                      return (
                        <div key={status} className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {status}
                            </div>
                            <div className="tabular-nums text-slate-500">
                              <span className="mr-2 text-xl font-semibold text-slate-900">{count}</span>
                              {pct}%
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200/80">
                            <div
                              className={isActive ? "h-2 rounded-full bg-emerald-500" : "h-2 rounded-full bg-slate-500"}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{totalHeadcount}</span> total employees in the current sample.
                </div>
              </>
            )}
          </div>
        </section>

        {/* Recent people + attendance summary */}
        <section className="lg:col-span-12">
          <div className="border-b border-slate-200 pb-3">
            <div className="text-sm font-semibold text-slate-900">Recent People</div>
            <div className="text-xs text-slate-500">Newest records (current snapshot)</div>
          </div>
          <div className="pt-4">
            {recentEmployees.length === 0 ? (
              <div className="py-5 text-sm text-slate-500">No employee records loaded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 capitalize">
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
            <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
              Attendance rate (from summaries): <span className="font-medium text-slate-700">{attendanceRate}%</span>
            </div>
          )}
        </section>

        {/* Department breakdown */}
        <section className="self-start lg:col-span-12">
          <div className="border-b border-slate-200 pb-3">
            <div className="text-sm font-semibold text-slate-900">Employees by Department</div>
            <div className="text-xs text-slate-500">Top populated departments (live counts)</div>
          </div>
          <div className="space-y-5 pt-4">
            {departmentHeadcounts.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">No departments found.</div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-3">
                  {departmentHeadcounts.slice(0, 3).map(([name, count], index) => (
                    <div key={name} className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Rank {index + 1}
                          </div>
                          <div className="mt-2 truncate text-base font-semibold text-slate-900" title={name}>
                            {name}
                          </div>
                        </div>
                        <div className="shrink-0 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{count}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
                  {departmentHeadcounts.map(([name, count]) => {
                    const width = Math.max(4, Math.round((count / maxDeptCount) * 100))
                    return (
                      <div key={name} className="space-y-2">
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <div className="truncate text-sm font-medium text-slate-800" title={name}>
                            {name}
                          </div>
                          <div className="text-sm font-medium tabular-nums text-slate-500">
                            {count}
                          </div>
                        </div>
                        <div>
                          <div className="h-2 w-full rounded-full bg-slate-200/80">
                            <div className="h-2 rounded-full bg-sky-600" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {departmentHeadcounts.every(([, c]) => c === 0) && (
                  <div className="text-[11px] text-amber-700">
                    All shown as 0 — no employees assigned or filter returned no matches. Check employee department linkages.
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 text-[11px] text-slate-400">
        {lastUpdated ? `Last updated ${lastUpdated}` : "Loading data…"}
      </div>
    </div>
  )
}
