"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  listEmployees,
  listDepartments,
  listLeaveRequests,
  listAttendanceDailySummariesPage,
  listOnboardingRequests,
  listOffboardingRequests,
  type AdminRecord,
} from "@/lib/admin-api"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"

const EMPLOYMENT_STATUS_COLORS: Record<string, string> = {
  active: "var(--primary)",
  onboarding: "#0ea5e9",
  suspended: "#f59e0b",
  terminated: "#f43f5e",
  exited: "#94a3b8",
}

function employmentStatusColor(status: string) {
  return EMPLOYMENT_STATUS_COLORS[status.trim().toLowerCase()] ?? "#a1a1aa"
}

/** Short client cache so revisiting / refresh feels instant. */
const DASHBOARD_CACHE_TTL_MS = 20_000

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

function formatStatusLabel(status: string): string {
  return status
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
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

function normalizeDepartmentName(value: string): string {
  return value.trim().toLowerCase()
}

function getDepartmentIdFromRecord(row: AdminRecord): number | null {
  return readNumber(row, ["id", "department_id", "primary_department_id", "departmentId"])
}

function getDepartmentNameFromRecord(row: AdminRecord): string {
  return readString(row, ["name", "department_name", "departmentName", "title"])
}

function getDepartmentAssignmentFromEmployee(row: AdminRecord): {
  id: number | null
  name: string
} | null {
  const primary = asRecord(row.primary_department)
  if (primary) {
    const id = getDepartmentIdFromRecord(primary)
    const name = getDepartmentNameFromRecord(primary)
    if (id !== null || name) {
      return { id, name }
    }
  }

  const department = asRecord(row.department)
  if (department) {
    const id = getDepartmentIdFromRecord(department)
    const name = getDepartmentNameFromRecord(department)
    if (id !== null || name) {
      return { id, name }
    }
  }

  const assignments = asRecordArray(row.departments ?? row.dept ?? row.departments_list)
  if (assignments.length > 0) {
    const primaryAssignment =
      assignments.find((item) => item.is_primary === true || item.isPrimary === true) ??
      assignments[0]

    if (primaryAssignment) {
      const nestedDepartment =
        asRecord(primaryAssignment.department) ??
        asRecord(primaryAssignment.primary_department)
      const id =
        (nestedDepartment ? getDepartmentIdFromRecord(nestedDepartment) : null) ??
        getDepartmentIdFromRecord(primaryAssignment)
      const name =
        (nestedDepartment ? getDepartmentNameFromRecord(nestedDepartment) : "") ||
        getDepartmentNameFromRecord(primaryAssignment)

      if (id !== null || name) {
        return { id, name }
      }
    }
  }

  const directId = readNumber(row, [
    "primary_department_id",
    "department_id",
    "departmentId",
    "dept_id",
    "department_id_fk",
  ])
  const directName = readString(row, [
    "department_name",
    "departmentName",
    "dept_name",
    "primary_department",
    "department",
  ])

  if (directId !== null || directName) {
    return { id: directId, name: directName }
  }

  return null
}

function buildDepartmentHeadcounts(
  departmentRows: AdminRecord[],
  employeeRows: AdminRecord[]
): Array<[string, number]> {
  const countsByLabel = new Map<string, number>()
  const nameById = new Map<number, string>()
  const labelByNormalizedName = new Map<string, string>()

  for (const row of departmentRows) {
    const id = getDepartmentIdFromRecord(row)
    const name = getDepartmentNameFromRecord(row)
    const label = name || (id !== null ? `Dept #${id}` : "")
    if (!label) {
      continue
    }
    countsByLabel.set(label, 0)
    if (id !== null) {
      nameById.set(id, label)
    }
    labelByNormalizedName.set(normalizeDepartmentName(label), label)
  }

  for (const employee of employeeRows) {
    // Prefer structured assignment, then fall back to loose name/id fields.
    const assignment =
      getDepartmentAssignmentFromEmployee(employee) ??
      (() => {
        const name = getDepartmentNameFromEmployee(employee)
        if (!name) return null
        const id = readNumber(employee, [
          "primary_department_id",
          "department_id",
          "departmentId",
          "dept_id",
        ])
        return { id, name }
      })()

    if (!assignment) {
      continue
    }

    const label =
      ((assignment.id !== null ? nameById.get(assignment.id) : undefined) ??
        (assignment.name
          ? labelByNormalizedName.get(normalizeDepartmentName(assignment.name))
          : undefined) ??
        assignment.name) ||
      (assignment.id !== null ? `Dept #${assignment.id}` : "")

    if (!label) {
      continue
    }

    // Register labels discovered from employees even if departments list omitted them.
    if (!countsByLabel.has(label)) {
      countsByLabel.set(label, 0)
      labelByNormalizedName.set(normalizeDepartmentName(label), label)
      if (assignment.id !== null && !nameById.has(assignment.id)) {
        nameById.set(assignment.id, label)
      }
    }

    countsByLabel.set(label, (countsByLabel.get(label) ?? 0) + 1)
  }

  // If we only have department rows and no employee matches, still show them.
  // Prefer non-zero first when sorting.
  return Array.from(countsByLabel.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1]
    }
    return left[0].localeCompare(right[0])
  })
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

function getLeaveEmployeeNo(row: AdminRecord): string {
  const direct = readString(row, ["employee_no", "employeeNo"])
  if (direct) return direct
  const emp = asRecord(row.employee)
  if (emp) return getEmployeeNo(emp)
  return ""
}

function getLeaveId(row: AdminRecord): number | null {
  return readNumber(row, ["id", "leave_request_id", "leaveRequestId"])
}

function employeeProfileHref(row: AdminRecord): string | null {
  const no = getEmployeeNo(row)
  if (no && no !== "-") {
    return `/dashboard/employees/profile/${encodeURIComponent(no)}`
  }
  const id = readNumber(row, ["id", "employee_id", "employeeId"])
  if (id != null) {
    return `/dashboard/employees/profile/${id}`
  }
  return null
}

function leaveDetailHref(row: AdminRecord): string {
  const id = getLeaveId(row)
  if (id != null) {
    return `/dashboard/leave-management/requests?highlight=${id}`
  }
  return "/dashboard/leave-management/requests"
}

function getLeaveDates(row: AdminRecord): string {
  const from = readString(row, ["from_date", "start_date", "date_from"])
  const to = readString(row, ["to_date", "end_date", "date_to"])
  if (from && to) return `${formatDateShort(from)} – ${formatDateShort(to)}`
  if (from) return formatDateShort(from)
  return "-"
}

function leaveStatusTone(status: string) {
  const s = status.toLowerCase()
  if (["approved", "completed"].includes(s)) {
    return "text-emerald-700 dark:text-emerald-400"
  }
  if (["rejected", "cancelled", "canceled"].includes(s)) {
    return "text-rose-700 dark:text-rose-400"
  }
  if (s.includes("pending") || s.includes("review") || s.includes("submitted")) {
    return "text-amber-700 dark:text-amber-400"
  }
  return "text-slate-600 dark:text-slate-300"
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

interface HrAnalyticsDashboardProps {
  refreshKey?: number
  companyName?: string | null
  adminRolesLabel?: string | null
}

function AnimatedMetricValue({ value }: { value: string | number }) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    typeof value === "number" ? "0" : typeof value === "string" && value.endsWith("%") ? "0%" : String(value)
  )

  React.useEffect(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      let frame = 0
      const duration = 320
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
      const duration = 320
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

function MetricValueSkeleton() {
  return (
    <div className="mt-0.5 space-y-1.5" aria-hidden="true">
      <Skeleton className="h-8 w-16 rounded-md" />
      <Skeleton className="h-3 w-24 rounded-md" />
    </div>
  )
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </div>
  )
}

// Reusable doodle components (for admin dashboard header styling, matching employee dashboards)
function DoodleSprites() {
  return (
    <svg width="0" height="0" className="hidden" aria-hidden="true">
      <symbol id="doodle-circles" viewBox="0 0 316 316">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" opacity="0.3">
          <path d="M 323.074 256.963 C 312.956 263.991 295.834 280.024 295.479 292.107 C 294.971 309.41 311.806 311.371 322.384 317.098" />
          <path d="M 322.384 225.723 C 303.276 230.431 291.393 236.843 273.403 256.963 C 252.542 280.29 261.674 308.503 261.674 315.536" />
          <path d="M 320.316 193.268 C 285.716 194.491 258.866 221.733 245.117 244.813 C 225.414 277.888 238.218 316.923 236.839 320.568" />
        </g>
      </symbol>
    </svg>
  )
}

function Doodle({ name = "doodle-circles" }: { name?: string }) {
  const doodleType = name.replace('doodle-', '');
  return (
    <svg 
      className={`absolute inset-0 w-full h-full pointer-events-none doodle doodle-${doodleType}`} 
      aria-hidden="true"
    >
      <use href={`#${name}`} />
    </svg>
  );
}

type DashboardSlice =
  | "employees"
  | "departments"
  | "leave"
  | "attendance"
  | "onboarding"
  | "offboarding"

const ALL_SLICES: DashboardSlice[] = [
  "employees",
  "departments",
  "leave",
  "attendance",
  "onboarding",
  "offboarding",
]

const emptySliceState = (): Record<DashboardSlice, boolean> =>
  Object.fromEntries(ALL_SLICES.map((s) => [s, false])) as Record<DashboardSlice, boolean>

export default function HrAnalyticsDashboard({
  refreshKey = 0,
  companyName,
  adminRolesLabel,
}: HrAnalyticsDashboardProps) {
  const router = useRouter()
  /** True while any request is in flight (refresh icon only). */
  const [loading, setLoading] = React.useState(true)
  /** Per-slice: true only until that slice has completed its first successful/failed load. */
  const [sliceReady, setSliceReady] = React.useState(emptySliceState)
  const [error, setError] = React.useState<string | null>(null)

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

  const employeesRef = React.useRef(employees)
  const departmentsRef = React.useRef(departments)
  employeesRef.current = employees
  departmentsRef.current = departments

  const markReady = React.useCallback((slice: DashboardSlice) => {
    setSliceReady((prev) => (prev[slice] ? prev : { ...prev, [slice]: true }))
  }, [])

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
      setDepartmentHeadcounts([])
      setSliceReady(Object.fromEntries(ALL_SLICES.map((s) => [s, true])) as Record<DashboardSlice, boolean>)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const from_date = fromDate.trim() || undefined
    const to_date = toDate.trim() || undefined
    const listOpts = { cacheTtlMs: DASHBOARD_CACHE_TTL_MS }

    const leaveParams: Record<string, string | number> = { page: 1, limit: 40 }
    if (from_date) leaveParams.from_date = from_date
    if (to_date) leaveParams.to_date = to_date

    // Single page only — full daily-summary history was paging for a long time and blocked the UI.
    const attParams: Record<string, string | number> = { page: 1, limit: 100 }
    if (from_date) attParams.from_date = from_date
    if (to_date) attParams.to_date = to_date

    // Progressive paint: each slice updates as soon as it resolves (no waiting on the slowest).
    const tasks: Promise<void>[] = [
      listEmployees(token, { page: 1, limit: 200 }, listOpts)
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((empRes) => {
          const empRows = empRes.rows ?? []
          setEmployees(empRows)
          setEmployeesTotal(empRes.total ?? empRows.length)
          setDepartmentHeadcounts(buildDepartmentHeadcounts(departmentsRef.current, empRows))
          markReady("employees")
        }),

      listDepartments(token, { page: 1, limit: 100 }, listOpts)
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((deptRes) => {
          const deptRows = deptRes.rows ?? []
          setDepartments(deptRows)
          setDepartmentHeadcounts(buildDepartmentHeadcounts(deptRows, employeesRef.current))
          markReady("departments")
        }),

      listLeaveRequests(token, leaveParams)
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((leaveRes) => {
          setLeaveRequests(leaveRes.rows ?? [])
          markReady("leave")
        }),

      listAttendanceDailySummariesPage(token, attParams, listOpts)
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((attRes) => {
          setAttendanceSummaries(attRes.rows ?? [])
          markReady("attendance")
        }),

      listOnboardingRequests(token, { page: 1, limit: 50 })
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((onboardRes) => {
          setOnboardingRequests(onboardRes.rows ?? [])
          markReady("onboarding")
        }),

      listOffboardingRequests(token, { page: 1, limit: 50 })
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((offboardRes) => {
          setOffboardingRequests(offboardRes.rows ?? [])
          markReady("offboarding")
        }),
    ]

    await Promise.allSettled(tasks)
    setLoading(false)
  }, [fromDate, toDate, markReady])

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

  // Always derive from latest employees + departments so the chart cannot go stale
  // when one list request finishes before the other.
  const resolvedDepartmentHeadcounts = React.useMemo(
    () => buildDepartmentHeadcounts(departments, employees),
    [departments, employees]
  )

  const maxDeptCount = React.useMemo(() => {
    return Math.max(1, ...resolvedDepartmentHeadcounts.map(([, c]) => c), 0)
  }, [resolvedDepartmentHeadcounts])

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

  type MetricWithReady = Metric & { ready: boolean }

  const metrics: MetricWithReady[] = [
    {
      label: "Headcount",
      value: totalHeadcount,
      sub: `${activeCount} active • ${activePct}%`,
      icon: UsersIcon,
      tone: "blue",
      ready: sliceReady.employees,
    },
    {
      label: "Departments",
      value: departments.length || departmentHeadcounts.length || "-",
      sub: "Active structures",
      icon: Building2Icon,
      tone: "slate",
      ready: sliceReady.departments,
    },
    {
      label: "Pending Leave",
      value: pendingLeaves,
      sub: "Awaiting action",
      icon: CalendarIcon,
      tone: "amber",
      ready: sliceReady.leave,
    },
    {
      label: "Attendance",
      value: attendanceRate != null ? `${attendanceRate}%` : "—",
      sub: attendanceRate != null ? "Last period" : "No summary data",
      icon: ClockIcon,
      tone: "emerald",
      ready: sliceReady.attendance,
    },
    {
      label: "New hires",
      value: hiresInRange,
      sub: fromDate && toDate ? `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}` : "Selected range",
      icon: UserCheckIcon,
      tone: "blue",
      ready: sliceReady.employees,
    },
    {
      label: "Onboarding",
      value: pendingOnboarding,
      sub: "open requests",
      icon: UserPlusIcon,
      tone: "emerald",
      ready: sliceReady.onboarding,
    },
    {
      label: "Offboarding",
      value: pendingOffboarding,
      sub: "open requests",
      icon: UserMinusIcon,
      tone: "rose",
      ready: sliceReady.offboarding,
    },
  ]

  const workforceReady = sliceReady.employees
  const leaveSectionReady = sliceReady.leave
  const departmentSectionReady = sliceReady.employees && sliceReady.departments

  const statusOrder = ["active", "onboarding", "suspended", "terminated", "exited"]
  const dashboardTitle = companyName?.trim() || "HRMS"

  return (
    <div className="w-full pb-6">
      <DoodleSprites />
      {/* Full-bleed identity strip — flush under the site header */}
      <div
        className="relative w-full overflow-hidden border-b border-primary/20 px-4 py-4 text-white md:px-6 md:py-5"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <Doodle name="doodle-circles" />
        <div className="relative z-10 flex w-full flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            {adminRolesLabel ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {adminRolesLabel}
              </p>
            ) : null}
            <h1 className="mt-0.5 truncate text-base font-semibold tracking-tight text-white sm:text-lg">
              {dashboardTitle}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <div className="grid min-w-[240px] gap-2 sm:grid-cols-2">
              <DatePickerPresets
                value={fromDate}
                onChange={setFromDate}
                placeholder="From date"
                appearance="onPrimary"
                className="h-9 text-xs"
              />
              <DatePickerPresets
                value={toDate}
                onChange={setToDate}
                placeholder="To date"
                appearance="onPrimary"
                className="h-9 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => void fetchAll()}
              disabled={loading}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/30 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCwIcon className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(formatInputDate(shiftDays(new Date(), -30)))
                setToDate(formatInputDate(new Date()))
              }}
              className="inline-flex h-9 items-center rounded-md border border-white/30 bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/20"
            >
              Last 30 days
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-4 lg:px-6">
      <section className="border-b border-border pt-3 pb-3 md:pt-4">
        <div className="flex flex-col gap-3">
          <div
            className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
            aria-busy={loading}
            aria-live="polite"
          >
            {metrics.map((m, idx) => (
              <div
                key={idx}
                className="min-w-0 border-b border-border pb-2 last:border-b-0 sm:last:border-b xl:border-b-0"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {m.label}
                </div>
                {!m.ready ? (
                  <MetricValueSkeleton />
                ) : (
                  <>
                    <div className="mt-0.5 text-2xl font-semibold tabular-nums text-primary sm:text-[1.75rem]">
                      <AnimatedMetricValue value={m.value} />
                    </div>
                    {m.sub ? (
                      <div className="truncate text-[11px] leading-4 text-muted-foreground">{m.sub}</div>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-12 lg:items-start">
        <section className="self-start lg:col-span-6">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <div className="text-sm font-semibold text-foreground">Leave requests</div>
              <div className="text-[11px] text-muted-foreground">
                {fromDate && toDate
                  ? `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`
                  : "Latest activity"}
              </div>
            </div>
            <Link
              href="/dashboard/leave-management/requests"
              className="text-[11px] font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="pt-3">
            {!leaveSectionReady ? (
              <SectionSkeleton rows={4} />
            ) : recentLeaves.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium">Employee</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Dates</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {recentLeaves.map((lr, i) => {
                      const href = leaveDetailHref(lr)
                      const empNo = getLeaveEmployeeNo(lr)
                      return (
                        <tr key={getLeaveId(lr) ?? i} className="transition hover:bg-muted/40">
                          <td className="px-2.5 py-1.5 font-medium">
                            <Link href={href} className="hover:text-primary hover:underline">
                              {getLeaveEmployeeName(lr)}
                            </Link>
                            {empNo ? (
                              <div className="font-mono text-[10px] text-muted-foreground">{empNo}</div>
                            ) : null}
                          </td>
                          <td className="px-2.5 py-1.5">{getLeaveType(lr)}</td>
                          <td className="px-2.5 py-1.5 text-muted-foreground">{getLeaveDates(lr)}</td>
                          <td className="px-2.5 py-1.5">
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wide",
                                leaveStatusTone(getLeaveStatus(lr))
                              )}
                            >
                              {getLeaveStatus(lr)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-2 text-sm text-muted-foreground">No leave requests to display.</div>
            )}
          </div>
        </section>

        <section className="self-start lg:col-span-6">
          <div className="border-b border-border pb-2">
            <div className="text-sm font-semibold text-foreground">Employment status</div>
          </div>

          <div className="pt-3">
            {!workforceReady ? (
              <SectionSkeleton rows={3} />
            ) : Object.keys(statusCounts).length === 0 ? (
              <div className="py-5 text-center text-sm text-muted-foreground">
                No employee records yet.
              </div>
            ) : (
              (() => {
                const chartRows = statusOrder
                  .filter((s) => statusCounts[s] != null)
                  .concat(Object.keys(statusCounts).filter((s) => !statusOrder.includes(s)))
                  .map((status) => {
                    const count = statusCounts[status] || 0
                    const pct =
                      totalHeadcount > 0 ? Math.round((count / totalHeadcount) * 100) : 0
                    return {
                      status,
                      label: formatStatusLabel(status),
                      count,
                      pct,
                      color: employmentStatusColor(status),
                    }
                  })
                  .filter((row) => row.count > 0)

                return (
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                    <div className="relative h-[168px] w-[168px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartRows}
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={chartRows.length > 1 ? 2 : 0}
                            stroke="none"
                            isAnimationActive
                          >
                            {chartRows.map((row) => (
                              <Cell key={row.status} fill={row.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-semibold tabular-nums leading-none text-primary">
                          {totalHeadcount}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          total
                        </div>
                      </div>
                    </div>

                    <div className="w-full min-w-0 flex-1 space-y-2">
                      {chartRows.map((row) => (
                        <div
                          key={row.status}
                          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            <span className="truncate text-sm font-medium text-foreground">
                              {row.label}
                            </span>
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <div className="text-sm font-semibold text-primary">{row.count}</div>
                            <div className="text-[11px] text-muted-foreground">{row.pct}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        </section>

        <section className="lg:col-span-12">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div>
              <div className="text-sm font-semibold text-foreground">Recent people</div>
              <div className="text-[11px] text-muted-foreground">Newest records · click a row to open profile</div>
            </div>
            <Link
              href="/dashboard/employees/all"
              className="text-[11px] font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="pt-3">
            {!workforceReady ? (
              <SectionSkeleton rows={5} />
            ) : recentEmployees.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">No employee records loaded.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-2.5 py-2">Employee No</th>
                      <th className="px-2.5 py-2">Name</th>
                      <th className="px-2.5 py-2">Status</th>
                      <th className="px-2.5 py-2">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {recentEmployees.map((emp, idx) => {
                      const href = employeeProfileHref(emp)
                      return (
                        <tr
                          key={idx}
                          className={cn(
                            "transition",
                            href ? "cursor-pointer hover:bg-muted/40" : null
                          )}
                          onClick={() => {
                            if (href) router.push(href)
                          }}
                        >
                          <td className="px-2.5 py-2 font-mono text-xs text-muted-foreground">
                            {getEmployeeNo(emp)}
                          </td>
                          <td className="px-2.5 py-2 font-medium">
                            {href ? (
                              <Link
                                href={href}
                                className="hover:text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {getEmployeeName(emp)}
                              </Link>
                            ) : (
                              getEmployeeName(emp)
                            )}
                          </td>
                          <td className="px-2.5 py-2">
                            <span className="text-xs font-medium capitalize text-primary">
                              {getEmploymentStatus(emp)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 text-muted-foreground">
                            {getDepartmentNameFromEmployee(emp) || "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="self-start lg:col-span-12">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="text-sm font-semibold text-foreground">Employees by department</div>
            {departmentSectionReady && resolvedDepartmentHeadcounts.length > 0 ? (
              <div className="text-xs tabular-nums text-muted-foreground">
                {resolvedDepartmentHeadcounts.length} departments
              </div>
            ) : null}
          </div>
          <div className="pt-3">
            {!departmentSectionReady ? (
              <SectionSkeleton rows={6} />
            ) : resolvedDepartmentHeadcounts.length === 0 ? (
              <div className="py-5 text-center text-sm text-muted-foreground">No departments found.</div>
            ) : (
              (() => {
                // Highest first — horizontal bars scale cleanly for many departments.
                const chartData = [...resolvedDepartmentHeadcounts]
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => ({
                    name,
                    count: Number(count) || 0,
                  }))
                const rowHeight = 34
                const chartHeight = Math.max(220, chartData.length * rowHeight + 24)
                // Solid fills only — color-mix()/CSS vars can fail as SVG fills in some browsers.
                const primaryFill = "var(--primary)"
                const mutedFill = "var(--primary)"

                return (
                  <div className="w-full" style={{ height: chartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
                        barCategoryGap={10}
                      >
                        <CartesianGrid
                          horizontal={false}
                          stroke="currentColor"
                          className="text-border"
                          strokeDasharray="3 3"
                          opacity={0.35}
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          domain={[0, "dataMax"]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "currentColor", fontSize: 11 }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={156}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "currentColor", fontSize: 12 }}
                          className="text-foreground"
                        />
                        <Tooltip
                          cursor={{ fill: "currentColor", opacity: 0.06 }}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--card)",
                            color: "var(--card-foreground)",
                            fontSize: 12,
                            boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                          }}
                          formatter={(value) => [
                            typeof value === "number" ? value : Number(value ?? 0),
                            "Employees",
                          ]}
                          labelFormatter={(label) => String(label)}
                        />
                        <Bar
                          dataKey="count"
                          radius={[0, 6, 6, 0]}
                          maxBarSize={18}
                          isAnimationActive
                          fill={primaryFill}
                          label={{
                            position: "right",
                            fill: "currentColor",
                            fontSize: 11,
                            fontWeight: 600,
                            className: "text-primary",
                          }}
                        >
                          {chartData.map((row) => (
                            <Cell
                              key={row.name}
                              fill={
                                row.count === maxDeptCount && row.count > 0
                                  ? primaryFill
                                  : mutedFill
                              }
                              fillOpacity={
                                row.count === maxDeptCount && row.count > 0 ? 1 : 0.55
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()
            )}
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
