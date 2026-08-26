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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts"

import {
  getAnalyticsDashboard,
  getAnalyticsFreshness,
  listEmployees,
  listDepartments,
  listLeaveRequests,
  listAttendanceDailySummariesPage,
  listOnboardingRequests,
  listOffboardingRequests,
  type AdminRecord,
} from "@/lib/admin-api"
import {
  clearDashboardFromLoginFlag,
  consumeDashboardWarmCache,
  type DashboardWarmSnapshot,
} from "@/lib/dashboard-warm-cache"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { motion } from "framer-motion"
import { useDashboardMotion } from "@/lib/dashboard-motion"

const EMPLOYMENT_STATUS_OPACITY: Record<string, number> = {
  active: 1,
  onboarding: 0.72,
  suspended: 0.5,
  terminated: 0.34,
  exited: 0.2,
}

function employmentStatusColor(status: string) {
  const opacity = EMPLOYMENT_STATUS_OPACITY[status.trim().toLowerCase()] ?? 0.42
  return `rgb(var(--primary-rgb) / ${opacity})`
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

function readDeepValue(
  row: AdminRecord | null | undefined,
  keys: string[],
  depth = 0,
): unknown {
  if (!row) return null
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) {
      return row[key]
    }
  }
  if (depth >= 3) return null
  for (const value of Object.values(row)) {
    const nested = asRecord(value)
    if (!nested) continue
    const found = readDeepValue(nested, keys, depth + 1)
    if (found !== null && found !== undefined) {
      return found
    }
  }
  return null
}

function readNumberDeep(row: AdminRecord | null | undefined, keys: string[]) {
  const value = readDeepValue(row, keys)
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readStringDeep(row: AdminRecord | null | undefined, keys: string[]) {
  const value = readDeepValue(row, keys)
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function extractStatusCountsFromAnalytics(
  row: AdminRecord | null | undefined,
): Record<string, number> {
  if (!row) return {}

  const direct = [
    "employment_status_counts",
    "status_counts",
    "headcount_by_status",
    "statusBreakdown",
    "employmentStatusBreakdown",
  ]
    .map((key) => readDeepValue(row, [key]))
    .find((value) => value !== null && value !== undefined)

  if (Array.isArray(direct)) {
    const counts: Record<string, number> = {}
    for (const entry of direct) {
      const record = asRecord(entry)
      if (!record) continue
      const label =
        readString(record, ["status", "label", "name", "employment_status"]).toLowerCase()
      const count =
        readNumber(record, ["count", "value", "headcount", "total"]) ?? 0
      if (label) counts[label] = count
    }
    return counts
  }

  const record = asRecord(direct)
  if (!record) return {}
  const counts: Record<string, number> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      counts[key.toLowerCase()] = value
      continue
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        counts[key.toLowerCase()] = parsed
      }
    }
  }
  return counts
}

function extractDepartmentHeadcountsFromAnalytics(
  row: AdminRecord | null | undefined,
): Array<[string, number]> {
  if (!row) return []

  const direct = [
    "department_headcounts",
    "department_counts",
    "headcount_by_department",
    "departmentBreakdown",
    "departments_breakdown",
  ]
    .map((key) => readDeepValue(row, [key]))
    .find((value) => value !== null && value !== undefined)

  if (Array.isArray(direct)) {
    return direct
      .map((entry) => {
        const record = asRecord(entry)
        if (!record) return null
        const label = readString(record, [
          "name",
          "department_name",
          "departmentName",
          "department",
          "label",
        ])
        const count = readNumber(record, ["count", "headcount", "value", "total"])
        if (!label || count === null) return null
        return [label, count] as [string, number]
      })
      .filter((entry): entry is [string, number] => Boolean(entry))
  }

  const record = asRecord(direct)
  if (!record) return []
  return Object.entries(record)
    .map(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return [key, value] as [string, number]
      }
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
          return [key, parsed] as [string, number]
        }
      }
      return null
    })
    .filter((entry): entry is [string, number] => Boolean(entry))
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

function getEmployeeInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && part !== "-")
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
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
  if (["rejected", "cancelled", "canceled"].includes(s)) {
    return "text-primary/55"
  }
  if (s.includes("pending") || s.includes("review") || s.includes("submitted")) {
    return "text-primary"
  }
  return "text-primary/80"
}

function getAttendanceStatus(row: AdminRecord): string {
  return readString(row, ["status", "attendance_status", "work_status", "day_status"]).toLowerCase()
}

interface Metric {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  compact?: boolean
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
      const duration = 860
      const startedAt = performance.now()

      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
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
      const duration = 860
      const startedAt = performance.now()

      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
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
    <div className="mt-1.5 space-y-1.5" aria-hidden="true">
      <Skeleton className="h-6 w-12 rounded-md sm:h-7 sm:w-14" />
      <Skeleton className="hidden h-2.5 w-16 rounded-md sm:block" />
    </div>
  )
}

function MetricCard({
  metric,
  index,
  reduce,
  variants,
  hover,
}: {
  metric: Metric & { ready: boolean }
  index: number
  reduce: boolean
  variants: ReturnType<typeof useDashboardMotion>["metricCard"]
  hover: ReturnType<typeof useDashboardMotion>["hover"]
}) {
  const Icon = metric.icon
  const orbDelay = index * 0.12
  const cardClassName = cn(
    "dashboard-metric-card group relative isolate block h-full min-w-0 overflow-hidden border border-primary/20 bg-card dark:bg-[#181818]",
    "shadow-[0_1px_0_rgb(var(--primary-rgb)_/_0.12)_inset,0_12px_28px_-20px_rgb(var(--primary-rgb)_/_0.4)] dark:shadow-none",
    "transition-shadow duration-300",
    "rounded-xl p-2 sm:p-2.5 lg:p-3",
    metric.href
      ? "cursor-pointer !no-underline hover:!no-underline outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      : null,
  )

  const cardBody = (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: "var(--primary)" }}
        initial={reduce ? false : { clipPath: "circle(0% at 92% -6%)", opacity: 0 }}
        animate={{
          clipPath: "circle(34% at 94% -8%)",
          opacity: 1,
        }}
        transition={{ duration: 0.95, delay: orbDelay, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-5 h-12 w-12 rounded-full blur-xl sm:h-16 sm:w-16"
        style={{ clipPath: "circle(50% at 50% 50%)", backgroundColor: "var(--primary)" }}
        animate={
          reduce
            ? undefined
            : { y: [0, -8, 0], x: [0, 6, 0], scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }
        }
        transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut", delay: orbDelay }}
      />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <motion.span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-full border border-primary/15 bg-primary/12 text-primary shadow-sm dark:shadow-none sm:size-7 lg:size-8",
          )}
          initial={reduce ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.12 + orbDelay }}
        >
          <Icon className="size-3 sm:size-3.5" />
        </motion.span>
      </div>

      <div className="relative z-10 mt-2 min-w-0 sm:mt-2.5">
        <div className="truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[9px] lg:text-[10px] lg:tracking-[0.16em]">
          {metric.label}
        </div>
        {!metric.ready ? (
          <MetricValueSkeleton />
        ) : (
          <>
            <div className="mt-0.5 font-semibold leading-none tracking-tight tabular-nums text-primary text-[clamp(0.95rem,1.8vw,1.35rem)]">
              <AnimatedMetricValue value={metric.value} />
            </div>
            {metric.sub ? (
              <div className="mt-1 hidden truncate text-[10px] leading-4 text-muted-foreground sm:block">
                {metric.sub}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )

  return (
    <motion.div
      variants={variants}
      whileHover={hover}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      className="min-w-0"
    >
      {metric.href ? (
        <Link href={metric.href} className={cardClassName} aria-label={metric.label}>
          {cardBody}
        </Link>
      ) : (
        <article className={cardClassName}>{cardBody}</article>
      )}
    </motion.div>
  )
}

function DashboardSurface({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-none border border-primary/20 bg-card p-4 sm:p-5 dark:bg-[#181818]",
        "shadow-[0_1px_0_rgb(var(--primary-rgb)_/_0.12)_inset,0_16px_36px_-22px_rgb(var(--primary-rgb)_/_0.45)] dark:shadow-none",
        className,
      )}
    >
      {children}
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

const readySliceState = (): Record<DashboardSlice, boolean> =>
  Object.fromEntries(ALL_SLICES.map((s) => [s, true])) as Record<DashboardSlice, boolean>

function readInitialWarmSnapshot(): DashboardWarmSnapshot | null {
  if (typeof window === "undefined") return null
  return consumeDashboardWarmCache()
}

export default function HrAnalyticsDashboard({
  refreshKey = 0,
  companyName,
  adminRolesLabel,
}: HrAnalyticsDashboardProps) {
  const router = useRouter()
  const actor = useDashboardActor()
  // Lazy state (not a ref) so initial warm cache can seed UI without reading refs during render.
  const [warm] = React.useState<DashboardWarmSnapshot | null>(readInitialWarmSnapshot)

  /** True while any request is in flight (refresh icon only). */
  const [loading, setLoading] = React.useState(!warm)
  /** Per-slice: true only until that slice has completed its first successful/failed load. */
  const [sliceReady, setSliceReady] = React.useState(warm ? readySliceState() : emptySliceState())
  const [error, setError] = React.useState<string | null>(null)

  const [fromDate, setFromDate] = React.useState(
    warm?.fromDate ?? formatInputDate(shiftDays(new Date(), -30))
  )
  const [toDate, setToDate] = React.useState(warm?.toDate ?? formatInputDate(new Date()))

  const [employees, setEmployees] = React.useState<AdminRecord[]>(warm?.employees ?? [])
  const [employeesTotal, setEmployeesTotal] = React.useState<number | null>(
    warm?.employeesTotal ?? null
  )
  const [departments, setDepartments] = React.useState<AdminRecord[]>(warm?.departments ?? [])
  const [departmentHeadcounts, setDepartmentHeadcounts] = React.useState<Array<[string, number]>>(
    warm ? buildDepartmentHeadcounts(warm.departments, warm.employees) : []
  )
  const [leaveRequests, setLeaveRequests] = React.useState<AdminRecord[]>(
    warm?.leaveRequests ?? []
  )
  const [attendanceSummaries, setAttendanceSummaries] = React.useState<AdminRecord[]>(
    warm?.attendanceSummaries ?? []
  )
  const [onboardingRequests, setOnboardingRequests] = React.useState<AdminRecord[]>(
    warm?.onboardingRequests ?? []
  )
  const [offboardingRequests, setOffboardingRequests] = React.useState<AdminRecord[]>(
    warm?.offboardingRequests ?? []
  )
  const [analyticsSummary, setAnalyticsSummary] = React.useState<AdminRecord | null>(null)
  const [analyticsFreshness, setAnalyticsFreshness] = React.useState<AdminRecord[]>([])

  const employeesRef = React.useRef(employees)
  const departmentsRef = React.useRef(departments)
  const hydratedFromWarmRef = React.useRef(Boolean(warm))
  const firstFetchRef = React.useRef(true)
  const canOpenLeaveRequests =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/leave-management/requests",
      actor.permissionLabels,
      actor.accessMode
    )
  const canOpenEmployeeDirectory =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/all",
      actor.permissionLabels,
      actor.accessMode
    )
  const canOpenEmployeeProfiles =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/profile",
      actor.permissionLabels,
      actor.accessMode
    )
  const canOpenOnboarding =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/onboarding",
      actor.permissionLabels,
      actor.accessMode
    )
  const canOpenOffboarding =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/employees/offboarding",
      actor.permissionLabels,
      actor.accessMode
    )
  const canOpenDepartments =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/departments",
      actor.permissionLabels,
      actor.accessMode
    )
  const canOpenAttendance =
    actor.ready &&
    (canAccessDashboardRoute(
      "/dashboard/attendance/daily-summaries",
      actor.permissionLabels,
      actor.accessMode
    ) ||
      canAccessDashboardRoute(
        "/dashboard/attendance",
        actor.permissionLabels,
        actor.accessMode
      ))

  React.useEffect(() => {
    employeesRef.current = employees
  }, [employees])

  React.useEffect(() => {
    departmentsRef.current = departments
  }, [departments])

  React.useEffect(() => {
    // One-shot: clear post-login shell flag after overview mounts with data.
    if (hydratedFromWarmRef.current) {
      clearDashboardFromLoginFlag()
    }
  }, [])

  const markReady = React.useCallback((slice: DashboardSlice) => {
    setSliceReady((prev) => (prev[slice] ? prev : { ...prev, [slice]: true }))
  }, [])

  const fetchAll = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
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
      setSliceReady(readySliceState())
      setLoading(false)
      return
    }

    if (!silent) {
      setLoading(true)
    }
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
      getAnalyticsDashboard(token, "hr", {
        date_from: from_date,
        date_to: to_date,
        purpose: "dashboard",
      })
        .catch(() => null)
        .then((summary) => {
          setAnalyticsSummary(summary)
        }),

      getAnalyticsFreshness(token)
        .catch(() => [])
        .then((freshnessRows) => {
          setAnalyticsFreshness(freshnessRows)
        }),

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
    // First mount after login: revalidate quietly so we don't flash skeletons again.
    const silent = firstFetchRef.current && hydratedFromWarmRef.current
    firstFetchRef.current = false
    void fetchAll({ silent })
  }, [fetchAll])

  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      void fetchAll()
    }
  }, [refreshKey, fetchAll])

  const analyticsStatusCounts = React.useMemo(
    () => extractStatusCountsFromAnalytics(analyticsSummary),
    [analyticsSummary],
  )

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of employees) {
      const s = getEmploymentStatus(e).toLowerCase()
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [employees])

  const resolvedStatusCounts =
    Object.keys(analyticsStatusCounts).length > 0 ? analyticsStatusCounts : statusCounts

  // Derived metrics
  const totalHeadcount =
    readNumberDeep(analyticsSummary, [
      "headcount",
      "employee_count",
      "employees_total",
      "total_headcount",
    ]) ??
    employeesTotal ??
    employees.length

  const activeCount =
    readNumberDeep(analyticsSummary, ["active_headcount", "active_employees", "active_count"]) ??
    resolvedStatusCounts["active"] ??
    0
  const activePct = totalHeadcount > 0 ? Math.round((activeCount / totalHeadcount) * 100) : 0

  // Always derive from latest employees + departments so the chart cannot go stale
  // when one list request finishes before the other.
  const resolvedDepartmentHeadcounts = React.useMemo(() => {
    const analyticsRows = extractDepartmentHeadcountsFromAnalytics(analyticsSummary)
    return analyticsRows.length > 0
      ? analyticsRows
      : buildDepartmentHeadcounts(departments, employees)
  }, [analyticsSummary, departments, employees])

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

  const pendingLeaves =
    readNumberDeep(analyticsSummary, ["pending_leave", "pending_leaves", "leave_pending"]) ??
    leaveStatusCounts["pending"] ??
    leaveStatusCounts["submitted"] ??
    0
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
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "attendance_rate",
      "attendance_percentage",
      "present_rate",
    ])
    if (analyticsValue !== null) return analyticsValue
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
  }, [analyticsSummary, attendanceSummaries])

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
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "new_hires",
      "hires_in_range",
      "recent_hires",
    ])
    if (analyticsValue !== null) return analyticsValue
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
  }, [analyticsSummary, employees, fromDate, toDate])

  const pendingOnboarding = React.useMemo(() => {
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "pending_onboarding",
      "open_onboarding_requests",
      "onboarding_pending",
    ])
    if (analyticsValue !== null) return analyticsValue
    return onboardingRequests.filter((r) => {
      const s = readString(r, ["status", "request_status"]).toLowerCase()
      return !s || s.includes("pend") || s.includes("progress") || s === "open" || s === "in_progress"
    }).length
  }, [analyticsSummary, onboardingRequests])

  const pendingOffboarding = React.useMemo(() => {
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "pending_offboarding",
      "open_offboarding_requests",
      "offboarding_pending",
    ])
    if (analyticsValue !== null) return analyticsValue
    return offboardingRequests.filter((r) => {
      const s = readString(r, ["status", "request_status"]).toLowerCase()
      return !s || s.includes("pend") || s.includes("progress") || s === "open" || s === "in_progress"
    }).length
  }, [analyticsSummary, offboardingRequests])

  type MetricWithReady = Metric & { ready: boolean }

  const metrics: MetricWithReady[] = [
    {
      label: "Headcount",
      value: totalHeadcount,
      sub: `${activeCount} active • ${activePct}%`,
      icon: UsersIcon,
      ready: sliceReady.employees,
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Departments",
      value: departments.length || departmentHeadcounts.length || "-",
      sub: "Active structures",
      icon: Building2Icon,
      ready: sliceReady.departments,
      href: canOpenDepartments ? "/dashboard/departments" : undefined,
    },
    {
      label: "Pending Leave",
      value: pendingLeaves,
      sub: "Awaiting action",
      icon: CalendarIcon,
      ready: sliceReady.leave,
      href: canOpenLeaveRequests ? "/dashboard/leave-management/requests" : undefined,
    },
    {
      label: "Attendance",
      value: attendanceRate != null ? `${attendanceRate}%` : "—",
      sub: attendanceRate != null ? "Last period" : "No summary data",
      icon: ClockIcon,
      ready: sliceReady.attendance,
      href: canOpenAttendance
        ? canAccessDashboardRoute(
            "/dashboard/attendance/daily-summaries",
            actor.permissionLabels,
            actor.accessMode
          )
          ? "/dashboard/attendance/daily-summaries"
          : "/dashboard/attendance"
        : undefined,
    },
    {
      label: "New hires",
      value: hiresInRange,
      sub: fromDate && toDate ? `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}` : "Selected range",
      icon: UserCheckIcon,
      ready: sliceReady.employees,
      compact: true,
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Onboarding",
      value: pendingOnboarding,
      sub: "open requests",
      icon: UserPlusIcon,
      ready: sliceReady.onboarding,
      compact: true,
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
    {
      label: "Offboarding",
      value: pendingOffboarding,
      sub: "open requests",
      icon: UserMinusIcon,
      ready: sliceReady.offboarding,
      compact: true,
      href: canOpenOffboarding ? "/dashboard/employees/offboarding" : undefined,
    },
  ]

  const workforceReady = sliceReady.employees
  const leaveSectionReady = sliceReady.leave
  const departmentSectionReady = sliceReady.employees && sliceReady.departments

  const statusOrder = ["active", "onboarding", "suspended", "terminated", "exited"]
  const dashboardTitle = companyName?.trim() || "HRMS"
  const motionPreset = useDashboardMotion()
  const latestAnalyticsRefresh =
    analyticsFreshness
      .map((row) =>
        readStringDeep(row, [
          "refreshed_at",
          "updated_at",
          "last_refreshed_at",
          "lastUpdatedAt",
        ]),
      )
      .find(Boolean) || ""

  return (
    <motion.div
      className="w-full pb-6"
      variants={motionPreset.container}
      initial="hidden"
      animate="show"
    >
      <DoodleSprites />
      {/* Full-bleed identity strip — flush under the site header */}
      <motion.div
        className="relative w-full overflow-hidden border-b border-primary/20 px-4 py-4 text-white md:px-6 md:py-5"
        style={{ backgroundColor: "var(--primary)" }}
        variants={motionPreset.rise}
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-10 top-0 h-36 w-36 rounded-full bg-white/10"
          animate={
            motionPreset.reduce
              ? undefined
              : { x: [0, 16, 0], y: [0, 8, 0], opacity: [0.35, 0.55, 0.35] }
          }
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <Doodle name="doodle-circles" />
        <div className="relative z-10 flex w-full flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            {adminRolesLabel ? (
              <motion.p
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"
                initial={motionPreset.reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32 }}
              >
                {adminRolesLabel}
              </motion.p>
            ) : null}
            <motion.h1
              className="mt-0.5 truncate text-base font-semibold tracking-tight text-white sm:text-lg"
              initial={motionPreset.reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.05 }}
            >
              {dashboardTitle}
            </motion.h1>
            {latestAnalyticsRefresh ? (
              <p className="mt-1 text-[11px] text-white/70">
                Analytics snapshot refreshed {formatDateShort(latestAnalyticsRefresh)}
              </p>
            ) : null}
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
            {fromDate !== formatInputDate(shiftDays(new Date(), -30)) ||
            toDate !== formatInputDate(new Date()) ? (
              <button
                type="button"
                onClick={() => {
                  setFromDate(formatInputDate(shiftDays(new Date(), -30)))
                  setToDate(formatInputDate(new Date()))
                }}
                className="inline-flex h-9 items-center rounded-md border border-white/30 bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/20"
              >
                Reset
              </button>
            ) : null}
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
      </motion.div>

      <div className="px-3 md:px-4 lg:px-6">
      <motion.section
        className="relative border-b border-border/70 pt-5 pb-6 md:pt-6 md:pb-7"
        variants={motionPreset.item}
      >
        <motion.div
          className="grid grid-cols-7 items-stretch gap-1.5 sm:gap-2 lg:gap-2.5"
          aria-busy={loading}
          aria-live="polite"
          variants={motionPreset.metrics}
        >
          {metrics.map((m, idx) => (
            <MetricCard
              key={m.label}
              metric={m}
              index={idx}
              reduce={motionPreset.reduce}
              variants={motionPreset.metricCard}
              hover={motionPreset.hover}
            />
          ))}
        </motion.div>
      </motion.section>

      {error ? (
        <motion.div
          variants={motionPreset.item}
          className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </motion.div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12 lg:items-start">
        <motion.section className="self-start lg:col-span-6" variants={motionPreset.item}>
          <DashboardSurface>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Leave requests
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {fromDate && toDate
                    ? `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`
                    : "Latest activity"}
                </div>
              </div>
              {canOpenLeaveRequests ? (
                <Link
                  href="/dashboard/leave-management/requests"
                  className="inline-flex h-8 items-center rounded-full border border-primary/15 bg-primary/10 px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/15"
                >
                  View all
                </Link>
              ) : null}
            </div>

            <div className="mt-4">
              {!leaveSectionReady ? (
                <SectionSkeleton rows={4} />
              ) : recentLeaves.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-primary/10">
                  <table className="w-full text-xs">
                    <thead className="bg-primary/5 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Employee</th>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Dates</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/10 text-foreground">
                      {recentLeaves.map((lr, i) => {
                        const href = leaveDetailHref(lr)
                        const empNo = getLeaveEmployeeNo(lr)
                        const canOpenLeaveLink = canOpenLeaveRequests && Boolean(href)
                        return (
                          <motion.tr
                            key={getLeaveId(lr) ?? i}
                            className="transition hover:bg-primary/5"
                            initial={motionPreset.reduce ? false : { opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.28, delay: i * 0.04 }}
                          >
                            <td className="px-3 py-2.5 font-medium">
                              {canOpenLeaveLink ? (
                                <Link href={href} className="hover:text-primary hover:underline">
                                  {getLeaveEmployeeName(lr)}
                                </Link>
                              ) : (
                                getLeaveEmployeeName(lr)
                              )}
                              {empNo ? (
                                <div className="font-mono text-[10px] text-muted-foreground">{empNo}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5">{getLeaveType(lr)}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{getLeaveDates(lr)}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  "inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  leaveStatusTone(getLeaveStatus(lr))
                                )}
                              >
                                {getLeaveStatus(lr)}
                              </span>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/4 px-4 py-8 text-center">
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                    <CalendarIcon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">No leave requests to display</p>
                  <p className="mt-1 max-w-[16rem] text-[11px] leading-4 text-muted-foreground">
                    Nothing is waiting in this date range.
                  </p>
                </div>
              )}
            </div>
          </DashboardSurface>
        </motion.section>

        <motion.section className="self-start lg:col-span-6" variants={motionPreset.item}>
          <DashboardSurface>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Employment status
            </div>

            <div className="mt-4">
              {!workforceReady ? (
                <SectionSkeleton rows={3} />
              ) : Object.keys(resolvedStatusCounts).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/4 px-4 py-8 text-center">
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                    <UsersIcon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">No employee records yet</p>
                </div>
              ) : (
                (() => {
                  const chartRows = statusOrder
                    .filter((s) => resolvedStatusCounts[s] != null)
                    .concat(
                      Object.keys(resolvedStatusCounts).filter((s) => !statusOrder.includes(s)),
                    )
                    .map((status) => {
                      const count = resolvedStatusCounts[status] || 0
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
                        {chartRows.map((row, index) => (
                          <motion.div
                            key={row.status}
                            className="rounded-2xl border border-primary/12 bg-card px-3 py-2.5 dark:bg-[#181818] dark:shadow-none"
                            initial={motionPreset.reduce ? false : { opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 0.08 + index * 0.05 }}
                          >
                            <div className="flex items-center justify-between gap-3">
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
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10">
                              <motion.div
                                className="h-full rounded-full bg-primary"
                                initial={motionPreset.reduce ? false : { width: 0 }}
                                animate={{ width: `${row.pct}%` }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.16 + index * 0.05 }}
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )
                })()
              )}
            </div>
          </DashboardSurface>
        </motion.section>

        <motion.section className="lg:col-span-12" variants={motionPreset.item}>
          <DashboardSurface>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Recent people
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {canOpenEmployeeProfiles
                    ? "Newest records · click a row to open profile"
                    : "Newest employee records"}
                </div>
              </div>
              {canOpenEmployeeDirectory ? (
                <Link
                  href="/dashboard/employees/all"
                  className="inline-flex h-8 items-center rounded-full border border-primary/15 bg-primary/10 px-3 text-[11px] font-semibold text-primary transition hover:bg-primary/15"
                >
                  View all
                </Link>
              ) : null}
            </div>

            <div className="mt-4">
              {!workforceReady ? (
                <SectionSkeleton rows={5} />
              ) : recentEmployees.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/4 px-4 py-8 text-center">
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                    <UsersIcon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">No employee records loaded</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {recentEmployees.map((emp, idx) => {
                    const href = employeeProfileHref(emp)
                    const canOpenEmployeeLink = canOpenEmployeeProfiles && Boolean(href)
                    const name = getEmployeeName(emp)
                    const status = formatStatusLabel(getEmploymentStatus(emp))
                    const department = getDepartmentNameFromEmployee(emp) || "—"
                    const row = (
                      <motion.div
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border border-primary/12 bg-card px-3 py-2.5 dark:bg-[#181818] dark:shadow-none",
                          canOpenEmployeeLink ? "transition hover:border-primary/30 hover:bg-primary/5" : null,
                        )}
                        initial={motionPreset.reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: idx * 0.045 }}
                      >
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-[11px] font-semibold tracking-wide text-primary">
                          {getEmployeeInitials(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">{name}</div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            <span className="font-mono">{getEmployeeNo(emp)}</span>
                            <span className="px-1.5 text-primary/40">·</span>
                            <span>{department}</span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          {status}
                        </span>
                      </motion.div>
                    )

                    if (canOpenEmployeeLink && href) {
                      return (
                        <Link
                          key={getEmployeeNo(emp) || href || idx}
                          href={href}
                          className="block outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
                        >
                          {row}
                        </Link>
                      )
                    }

                    return <div key={getEmployeeNo(emp) || idx}>{row}</div>
                  })}
                </div>
              )}
            </div>
          </DashboardSurface>
        </motion.section>

        <motion.section className="self-start lg:col-span-12" variants={motionPreset.item}>
          <DashboardSurface>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Employees by department
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {departmentSectionReady && resolvedDepartmentHeadcounts.length > 0
                    ? `${resolvedDepartmentHeadcounts.length} departments`
                    : "Workforce by structure"}
                </div>
              </div>
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                <Building2Icon className="size-4" />
              </span>
            </div>

            <div className="mt-4">
              {!departmentSectionReady ? (
                <SectionSkeleton rows={6} />
              ) : resolvedDepartmentHeadcounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/4 px-4 py-8 text-center">
                  <span className="inline-flex size-11 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                    <Building2Icon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-foreground">No departments found</p>
                </div>
              ) : (
                (() => {
                  const chartData = [...resolvedDepartmentHeadcounts]
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => ({
                      name,
                      count: Number(count) || 0,
                      pct:
                        maxDeptCount > 0
                          ? Math.round((Number(count) / maxDeptCount) * 100)
                          : 0,
                    }))

                  return (
                    <div className="grid gap-2">
                      {chartData.map((row, index) => (
                        <motion.div
                          key={row.name}
                          className="rounded-2xl border border-primary/12 bg-card px-3 py-2.5 dark:bg-[#181818] dark:shadow-none"
                          initial={motionPreset.reduce ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, delay: index * 0.035 }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate text-sm font-medium text-foreground">
                              {row.name}
                            </div>
                            <div className="shrink-0 text-sm font-semibold tabular-nums text-primary">
                              {row.count}
                            </div>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              initial={motionPreset.reduce ? false : { width: 0 }}
                              animate={{ width: `${row.pct}%` }}
                              transition={{
                                duration: 0.8,
                                ease: [0.16, 1, 0.3, 1],
                                delay: 0.12 + index * 0.035,
                              }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>
          </DashboardSurface>
        </motion.section>
      </div>
      </div>
    </motion.div>
  )
}
