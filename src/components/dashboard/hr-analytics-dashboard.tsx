"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  UsersIcon,
  CalendarIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ArrowUpRightIcon,
  InfoIcon,
  UserCheckIcon,
  UserMinusIcon,
  UserXIcon,
  FilterIcon,
  MoreHorizontalIcon,
  FileTextIcon,
} from "lucide-react"
import {
  getAnalyticsDashboard,
  getHrDashboard,
  listAllEmployees,
  listDepartments,
  listLeaveRequests,
  listAttendanceHolidays,
  listAttendanceDailySummariesPage,
  listOnboardingRequests,
  listOffboardingRequests,
  listPayrollRuns,
  listPayrollPayslipsForRun,
  type AdminRecord,
} from "@/lib/admin-api"
import { isHistoricalEmployeeStatus } from "@/lib/employee-directory-search"
import {
  clearDashboardFromLoginFlag,
  consumeDashboardWarmCache,
  type DashboardWarmSnapshot,
} from "@/lib/dashboard-warm-cache"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { Card as UiCard, CardContent as UiCardContent } from "@/components/ui/card"
import {
  Badge as FluentBadge,
  Caption1,
  Card as FluentCard,
  CardHeader as FluentCardHeader,
  Persona,
  Skeleton as FluentSkeleton,
  SkeletonItem,
  Text as FluentText,
} from "@fluentui/react-components"
import { FluentSearchBox } from "@/components/common/fluent-search-box"
import { MoreHorizontal20Regular } from "@fluentui/react-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { motion } from "framer-motion"
import { useDashboardMotion } from "@/lib/dashboard-motion"

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

function formatLocalDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function recordDateKey(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return ""
  const raw = String(value)
  const direct = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (direct) return direct
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : formatLocalDateKey(parsed)
}

function holidayDateKey(row: AdminRecord) {
  return recordDateKey(
    row.date ?? row.holiday_date ?? row.holidayDate ?? row.start_date ?? row.startDate,
  )
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
  href?: string
  compact?: boolean
}

type WorkforceMetricTone = "emerald" | "amber" | "rose"

interface WorkforceMetric {
  label: string
  value: number
  percentage: number
  description: React.ReactNode
  icon: React.ReactNode
  tone: WorkforceMetricTone
  visualization: "sparkline" | "bars" | "ticks" | "progress"
  href?: string
}

type PagedRowsResult = {
  rows: AdminRecord[]
  total: number | null
}

interface HrAnalyticsDashboardProps {
  refreshKey?: number
  companyName?: string | null
  adminRolesLabel?: string | null
  assignedRoleNames?: string[]
  userName?: string | null
  profilePhotoUrl?: string | null
  showLeaveRequests?: boolean
  showHrAnalytics?: boolean
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
    <FluentSkeleton aria-label="Loading metric" className="mt-1.5 flex flex-col gap-1.5">
      <SkeletonItem shape="rectangle" className="!h-6 !w-12 !rounded-md sm:!h-7 sm:!w-14" />
      <SkeletonItem shape="rectangle" className="hidden !h-2.5 !w-16 !rounded-md sm:block" />
    </FluentSkeleton>
  )
}

function MetricCard({
  metric,
  reduce,
  variants,
  hover,
}: {
  metric: Metric & { ready: boolean }
  reduce: boolean
  variants: ReturnType<typeof useDashboardMotion>["metricCard"]
  hover: ReturnType<typeof useDashboardMotion>["hover"]
}) {
  const router = useRouter()
  const cardClassName = cn(
    "dashboard-metric-card group relative block h-full w-full min-w-0 overflow-hidden !gap-0 !rounded-lg !border-border/70 !bg-card !p-4 after:!border-border/70 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-r-full before:bg-primary/55 dark:!border-border/80 dark:after:!border-border/80",
    "shadow-sm transition duration-200",
    metric.href
      ? "outline-none hover:-translate-y-px hover:shadow-md"
      : null,
  )

  const cardBody = (
    <>
      <FluentCardHeader
        className="!p-0"
        header={
          metric.href ? (
            <Link href={metric.href} className="truncate !no-underline hover:!no-underline">
              <FluentText size={200} weight="semibold">{metric.label}</FluentText>
            </Link>
          ) : (
            <FluentText size={200} weight="semibold">{metric.label}</FluentText>
          )
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label={`${metric.label} actions`}
            >
              <MoreHorizontal20Regular aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem disabled={!metric.href} onClick={() => metric.href && router.push(metric.href)}>
                Open records
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!metric.href}
                onClick={() => metric.href && window.open(metric.href, "_blank", "noopener,noreferrer")}
              >
                Open in new tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {!metric.ready ? (
        <MetricValueSkeleton />
      ) : (
        <div className="mt-3 flex min-w-0 items-baseline gap-1.5">
          <div className="text-2xl font-semibold leading-none tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400">
            <AnimatedMetricValue value={metric.value} />
          </div>
          {metric.sub ? <span className="truncate text-[10px] text-foreground">{metric.sub}</span> : null}
        </div>
      )}
      <div className="mt-4 flex items-end justify-between gap-3">
        <FluentBadge color="success" appearance="tint" shape="rounded" size="small">
          <ArrowUpRightIcon className="size-2.5" aria-hidden="true" />
          Current period
        </FluentBadge>
        {metric.label === "Departments" ? (
          <div className="flex h-7 items-end gap-1" aria-hidden="true">
            {[25, 42, 58, 78, 100].map((height, index) => (
              <span key={height} className={cn("w-1.5 rounded-sm", index === 4 ? "bg-emerald-500" : "bg-emerald-500/10")} style={{ height: `${height}%` }} />
            ))}
          </div>
        ) : metric.label === "New hires" ? (
          <div className="flex h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="w-3/5 bg-emerald-500" />
            <span className="w-1/5 bg-emerald-500/40" />
          </div>
        ) : (
          <svg viewBox="0 0 72 24" className="h-7 w-20" aria-hidden="true">
            <path d="M2 15 C8 3 13 22 20 10 C27 -1 31 22 39 10 C47 0 52 22 59 9 C64 2 67 14 70 8" fill="none" stroke="rgb(16 185 129)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </div>
    </>
  )

  return (
    <motion.div
      variants={variants}
      whileHover={hover}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      className="h-full w-full min-w-0"
    >
      <FluentCard appearance="outline" size="small" className={cardClassName}>
        {cardBody}
      </FluentCard>
    </motion.div>
  )
}

const workforceMetricTone = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-500 text-white",
    accent: "before:bg-emerald-500/65",
    visual: "bg-emerald-500",
    soft: "bg-emerald-500/10",
    stroke: "rgb(16 185 129)",
  },
  amber: {
    icon: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    pill: "bg-orange-500 text-white",
    accent: "before:bg-orange-500/65",
    visual: "bg-orange-500",
    soft: "bg-orange-500/12",
    stroke: "rgb(249 115 22)",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    pill: "bg-rose-500 text-white",
    accent: "before:bg-rose-500/65",
    visual: "bg-rose-500",
    soft: "bg-rose-500/12",
    stroke: "rgb(244 63 94)",
  },
} satisfies Record<WorkforceMetricTone, Record<string, string>>

function WorkforceMetricVisual({ metric }: { metric: WorkforceMetric }) {
  const tone = workforceMetricTone[metric.tone]
  const percentage = Math.min(100, Math.max(0, metric.percentage))

  if (metric.visualization === "sparkline") {
    return (
      <svg viewBox="0 0 150 42" className="h-8 w-full" aria-hidden="true">
        <path
          d="M2 34 C17 34 17 38 30 38 C42 38 38 20 52 20 C66 20 62 35 77 35 C94 35 88 38 104 38 C119 38 113 10 128 10 C140 10 136 3 148 3"
          fill="none"
          stroke={tone.stroke}
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.7"
        />
      </svg>
    )
  }

  if (metric.visualization === "bars") {
    return (
      <div className="flex h-8 items-end gap-1" aria-hidden="true">
        {[45, 62, 38, 88, 58, 76, 52].map((height, index) => (
          <span
            key={height + index}
            className={cn("w-2.5 rounded-t-md", index === 3 ? tone.visual : tone.soft)}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    )
  }

  if (metric.visualization === "ticks") {
    return (
      <div className="flex h-8 items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className={cn("h-6 w-1 rounded-full", index < Math.round(percentage / 5.56) ? tone.visual : tone.soft)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("h-5 overflow-hidden rounded-full", tone.soft)} aria-hidden="true">
      <div className={cn("h-full rounded-full transition-[width] duration-700", tone.visual)} style={{ width: `${percentage}%` }} />
    </div>
  )
}

function WorkforceMetricCard({
  metric,
  reduce,
  variants,
}: {
  metric: WorkforceMetric
  reduce: boolean
  variants: ReturnType<typeof useDashboardMotion>["metricCard"]
}) {
  const tone = workforceMetricTone[metric.tone]
  const badgeColor = metric.tone === "emerald"
    ? "success"
    : metric.tone === "amber"
      ? "warning"
      : "severe"
  const content = (
    <>
      <FluentCardHeader
        className="!p-0"
        header={
          <span className="flex min-w-0 items-center gap-1.5">
            <FluentText size={200} weight="semibold" truncate>
              {metric.label}
            </FluentText>
            <InfoIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          </span>
        }
        action={
          <FluentBadge
            color={badgeColor}
            appearance="tint"
            shape="rounded"
            size="small"
          >
            <ArrowUpRightIcon className="size-2.5" aria-hidden="true" />
            {metric.percentage}%
          </FluentBadge>
        }
      />

      <div className="mt-4 flex items-center gap-2.5">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", tone.icon)}>
          {metric.icon}
        </span>
        <div className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
          <AnimatedMetricValue value={metric.value} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(58px,0.7fr)_minmax(0,1.3fr)] items-end gap-2.5">
        <WorkforceMetricVisual metric={metric} />
        <Caption1
          block
          className="truncate !text-muted-foreground"
          title={typeof metric.description === "string" ? metric.description : undefined}
        >
          {metric.description}
        </Caption1>
      </div>
    </>
  )

  return (
    <motion.div variants={variants} whileTap={reduce ? undefined : { scale: 0.99 }} className="h-full w-full min-w-0">
      {metric.href ? (
        <Link
          href={metric.href}
          className="block h-full !no-underline hover:!no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&_*]:!no-underline"
        >
          <FluentCard
            appearance="outline"
            className={cn(
              "relative h-full min-h-40 overflow-hidden !gap-0 !rounded-lg !border-border/70 !bg-card !p-4 shadow-sm transition duration-200 after:!border-border/70 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-r-full hover:-translate-y-px hover:shadow-md dark:!border-border/80 dark:after:!border-border/80",
              tone.accent,
            )}
          >
            {content}
          </FluentCard>
        </Link>
      ) : (
        <FluentCard
          appearance="outline"
          className={cn(
            "relative h-full min-h-40 overflow-hidden !gap-0 !rounded-lg !border-border/70 !bg-card !p-4 shadow-sm after:!border-border/70 before:absolute before:inset-y-4 before:left-0 before:w-0.5 before:rounded-r-full dark:!border-border/80 dark:after:!border-border/80",
            tone.accent,
          )}
        >
          {content}
        </FluentCard>
      )}
    </motion.div>
  )
}

type AttendanceChartDay = {
  label: string
  present: number
  late: number
  absent: number
}

type PerformanceStat = {
  label: string
  value: number
}

function WorkforceInsightPanels({
  rangeLabel,
  attendanceRate,
  present,
  late,
  absent,
  attendanceDays,
  performanceScore,
  performanceStats,
}: {
  rangeLabel: string
  attendanceRate: number
  present: number
  late: number
  absent: number
  attendanceDays: AttendanceChartDay[]
  performanceScore: number
  performanceStats: PerformanceStat[]
}) {
  const maxPerformanceValue = Math.max(1, ...performanceStats.map((item) => item.value))

  return (
    <div className="mt-3 grid w-full gap-3 lg:grid-cols-2">
      <section className="h-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_16px_42px_-34px_rgb(15_23_42_/_0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Attendance report</h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">{attendanceRate}%</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                Attendance rate
              </span>
            </div>
          </div>
          <span className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] font-medium text-foreground">{rangeLabel}</span>
        </div>
        <div className="mt-4 grid w-full grid-cols-3 gap-2 border-y border-border/60 py-3">
          {[
            ["On time", present, "border-emerald-500"],
            ["Late", late, "border-amber-400"],
            ["Absent", absent, "border-rose-400"],
          ].map(([label, value, border]) => (
            <div key={String(label)} className={cn("border-l-2 pl-2", border)}>
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          ))}
        </div>
        {attendanceDays.length > 0 ? (
          <div className="mt-4 flex h-40 items-end gap-2 overflow-hidden">
            {attendanceDays.map((day) => {
              const total = Math.max(1, day.present + day.late + day.absent)
              return (
                <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-28 w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-md bg-muted/40">
                    <span className="bg-emerald-500" style={{ height: `${(day.present / total) * 100}%` }} />
                    <span className="bg-amber-300" style={{ height: `${(day.late / total) * 100}%` }} />
                    <span className="bg-rose-300" style={{ height: `${(day.absent / total) * 100}%` }} />
                  </div>
                  <span className="truncate text-[9px] text-muted-foreground">{day.label}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 flex h-40 items-center justify-center rounded-xl bg-muted/20 text-xs text-muted-foreground">
            No attendance records in this period.
          </div>
        )}
      </section>

      <section className="h-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_16px_42px_-34px_rgb(15_23_42_/_0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Team performance</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Published reviews and approved work</p>
          </div>
          <span className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] font-medium text-foreground">{rangeLabel}</span>
        </div>
        <div className="mt-5">
          <p className="text-3xl font-semibold leading-none tabular-nums text-foreground">{performanceScore}%</p>
          <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400">Current performance score</p>
        </div>
        <div className="mt-6 flex h-36 items-end justify-around gap-4 border-b border-border/60 pb-2">
          {performanceStats.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full max-w-12 items-end justify-center gap-1">
                <span className="w-2.5 rounded-t bg-emerald-500/20" style={{ height: `${Math.max(12, (item.value / maxPerformanceValue) * 70)}%` }} />
                <span className="w-2.5 rounded-t bg-emerald-500" style={{ height: `${Math.max(18, (item.value / maxPerformanceValue) * 100)}%` }} />
              </div>
              <span className="truncate text-[9px] font-medium text-foreground">{item.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[9px] text-muted-foreground">
          {performanceStats.map((item) => (
            <span key={item.label}><span className="font-semibold text-foreground">{item.value}</span> {item.label.toLowerCase()}</span>
          ))}
        </div>
      </section>
    </div>
  )
}

function formatDashboardCurrency(value: unknown, currency = "TZS") {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount)) return "—"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function PeopleExperiencePanels({
  satisfactionScore,
  satisfactionCategories,
  payrollRows,
  canOpenPayroll,
}: {
  satisfactionScore: number
  satisfactionCategories: Array<{ label: string; value: number }>
  payrollRows: AdminRecord[]
  canOpenPayroll: boolean
}) {
  const [payrollSearch, setPayrollSearch] = React.useState("")
  const filteredPayrollRows = payrollRows.filter((row) => {
    if (!payrollSearch.trim()) return true
    const employee = asRecord(row.employee)
    const haystack = [
      readStringDeep(row, ["employee_name", "full_name", "employee_no", "employeeNo"]),
      readStringDeep(employee, ["full_name", "name", "employee_no", "employeeNo"]),
      readStringDeep(row, ["job_title", "designation_name", "position_name"]),
    ].join(" ").toLowerCase()
    return haystack.includes(payrollSearch.trim().toLowerCase())
  })
  const gaugeLength = 126
  const gaugeProgress = gaugeLength * (Math.min(100, Math.max(0, satisfactionScore)) / 100)

  return (
    <div className="mt-3 grid w-full gap-3 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <section className="h-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Employee satisfaction</h2>
          <MoreHorizontalIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="mt-4 grid grid-cols-[180px_minmax(0,1fr)] items-center gap-3">
          <div className="relative h-24">
            <svg viewBox="0 0 120 68" className="h-full w-full" aria-hidden="true">
              <path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="rgb(226 232 240)" strokeWidth="10" strokeLinecap="round" pathLength={gaugeLength} />
              <path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="rgb(16 185 129)" strokeWidth="10" strokeLinecap="round" pathLength={gaugeLength} strokeDasharray={`${gaugeProgress} ${gaugeLength}`} />
            </svg>
            <div className="absolute inset-x-0 bottom-1 text-center">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{satisfactionScore}%</p>
              <p className="text-[9px] text-muted-foreground">average satisfaction</p>
            </div>
          </div>
          <div className="space-y-2 text-[10px] text-muted-foreground">
            <p><span className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500" />Satisfied</p>
            <p><span className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500/25" />Neutral</p>
            <p><span className="mr-1.5 inline-block size-2 rounded-sm bg-muted" />Needs attention</p>
          </div>
        </div>
        {satisfactionCategories.some((item) => item.value > 0) ? (
          <div className="mt-4 space-y-3">
            {satisfactionCategories.map((item) => (
              <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.value}% satisfaction</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, item.value)}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-muted/30 px-3 py-3 text-xs text-muted-foreground">No employee satisfaction survey data is available yet.</p>
        )}
      </section>

      <section className="h-full min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Payroll summary</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Latest generated employee payslips</p>
          </div>
          <div className="flex items-center gap-2">
            <FluentSearchBox
              size="small"
              value={payrollSearch}
              onChange={(_event, data) => setPayrollSearch(data.value)}
              placeholder="Search employee"
              aria-label="Search payroll employees"
              className="hidden !w-44 sm:flex"
            />
            {canOpenPayroll ? (
              <Link href="/dashboard/operations/payroll" className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[10px] font-semibold !text-primary-foreground !no-underline hover:!no-underline">
                View payroll
              </Link>
            ) : null}
          </div>
        </div>
        {filteredPayrollRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-muted/35 text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-3 py-2 font-medium">Job title</th>
                  <th className="px-3 py-2 font-medium">Gross</th>
                  <th className="px-3 py-2 font-medium">Deductions</th>
                  <th className="px-3 py-2 font-medium">Net pay</th>
                  <th className="px-4 py-2 text-right font-medium">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPayrollRows.slice(0, 6).map((row, index) => {
                  const employee = asRecord(row.employee)
                  const name = readStringDeep(row, ["employee_name", "full_name"]) || readStringDeep(employee, ["full_name", "name"]) || `Employee ${index + 1}`
                  const number = readStringDeep(row, ["employee_no", "employeeNo"]) || readStringDeep(employee, ["employee_no", "employeeNo"])
                  const title = readStringDeep(row, ["job_title", "designation_name", "position_name"]) || readStringDeep(employee, ["job_title", "designation_name", "position_name"]) || "—"
                  const currency = readStringDeep(row, ["currency", "currency_code"]) || "TZS"
                  return (
                    <tr key={`${readNumber(row, ["id", "payslip_id"]) ?? index}`} className="text-xs text-foreground hover:bg-muted/20">
                      <td className="px-4 py-2.5"><p className="font-medium">{name}</p><p className="text-[9px] text-muted-foreground">{number || "—"}</p></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{title}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatDashboardCurrency(readDeepValue(row, ["gross_pay", "grossPay", "total_gross_pay"]), currency)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{formatDashboardCurrency(readDeepValue(row, ["total_deductions", "deductions", "deduction_amount"]), currency)}</td>
                      <td className="px-3 py-2.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatDashboardCurrency(readDeepValue(row, ["net_pay", "netPay", "total_net_pay"]), currency)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canOpenPayroll ? <Link href="/dashboard/operations/payroll" className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-700 !no-underline hover:!no-underline"><FileTextIcon className="size-3" />Open</Link> : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-56 items-center justify-center px-6 text-center text-xs text-muted-foreground">
            {canOpenPayroll ? "No generated payslips are available for the latest payroll run." : "Payroll access is not available for this account."}
          </div>
        )}
      </section>
    </div>
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
    <UiCard
      size="sm"
      className={cn(
        "gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-[0_18px_42px_-34px_rgb(var(--primary-rgb)_/_0.6)]",
        className,
      )}
    >
      <UiCardContent className="p-4 sm:p-5">{children}</UiCardContent>
    </UiCard>
  )
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <FluentSkeleton className="flex flex-col gap-2 py-1" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonItem key={i} shape="rectangle" className="!h-9 !w-full !rounded-md" />
      ))}
    </FluentSkeleton>
  )
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
  adminRolesLabel,
  assignedRoleNames = [],
  userName,
  profilePhotoUrl,
  showLeaveRequests = false,
  showHrAnalytics = false,
}: HrAnalyticsDashboardProps) {
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
  const [dateFilterOpen, setDateFilterOpen] = React.useState(false)

  const [employees, setEmployees] = React.useState<AdminRecord[]>(warm?.employees ?? [])
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
  const [todayAttendanceSummaries, setTodayAttendanceSummaries] = React.useState<AdminRecord[]>([])
  const [onboardingRequests, setOnboardingRequests] = React.useState<AdminRecord[]>(
    warm?.onboardingRequests ?? []
  )
  const [offboardingRequests, setOffboardingRequests] = React.useState<AdminRecord[]>(
    warm?.offboardingRequests ?? []
  )
  const [payrollPayslips, setPayrollPayslips] = React.useState<AdminRecord[]>([])
  const [analyticsSummary, setAnalyticsSummary] = React.useState<AdminRecord | null>(null)
  const [upcomingHoliday, setUpcomingHoliday] = React.useState<AdminRecord | null>(null)

  const employeesRef = React.useRef(employees)
  const departmentsRef = React.useRef(departments)
  const hydratedFromWarmRef = React.useRef(Boolean(warm))
  const firstFetchRef = React.useRef(true)
  const canOpenLeaveRequests =
    showLeaveRequests &&
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
  const canOpenPayroll =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/operations/payroll",
      actor.permissionLabels,
      actor.accessMode
    )

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
      setTodayAttendanceSummaries([])
      setOnboardingRequests([])
      setOffboardingRequests([])
      setUpcomingHoliday(null)
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
    const todayAttendanceDate = formatLocalDateKey(new Date())
    const todayAttendanceParams: Record<string, string | number> = {
      page: 1,
      limit: 500,
      from_date: todayAttendanceDate,
      to_date: todayAttendanceDate,
    }

    // Progressive paint: each slice updates as soon as it resolves (no waiting on the slowest).
    const tasks: Promise<void>[] = [
      // The advanced analytics HR dashboard is the authoritative structured
      // contract. Keep the older role dashboard as a compatibility fallback.
      getAnalyticsDashboard(token, "hr", {
        date_from: from_date,
        date_to: to_date,
        purpose: "dashboard",
      })
        .catch(() =>
          getHrDashboard(token, "hr", {
            date_from: from_date,
            date_to: to_date,
          }),
        )
        .catch(() => null)
        .then((summary) => {
          setAnalyticsSummary(summary)
        }),

      listAllEmployees(token, {}, listOpts)
        .catch((): AdminRecord[] => [])
        .then((empRows) => {
          setEmployees(empRows)
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

      showLeaveRequests
        ? listLeaveRequests(token, leaveParams)
            .catch((): PagedRowsResult => ({ rows: [], total: null }))
            .then((leaveRes) => {
              setLeaveRequests(leaveRes.rows ?? [])
              markReady("leave")
            })
        : Promise.resolve().then(() => {
            setLeaveRequests([])
            markReady("leave")
          }),

      listAttendanceDailySummariesPage(token, attParams, listOpts)
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((attRes) => {
          setAttendanceSummaries(attRes.rows ?? [])
          markReady("attendance")
        }),

      listAttendanceDailySummariesPage(token, todayAttendanceParams, { cacheTtlMs: 0 })
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((attRes) => {
          setTodayAttendanceSummaries(attRes.rows ?? [])
        }),

      listAttendanceHolidays(token, { page: 1, limit: 100 })
        .catch((): PagedRowsResult => ({ rows: [], total: null }))
        .then((holidayResult) => {
          const today = formatLocalDateKey(new Date())
          const nextHoliday = [...(holidayResult.rows ?? [])]
            .filter((holiday) => {
              const date = holidayDateKey(holiday)
              return Boolean(date && date >= today)
            })
            .sort((left, right) => holidayDateKey(left).localeCompare(holidayDateKey(right)))[0]
          setUpcomingHoliday(nextHoliday ?? null)
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

      canOpenPayroll
        ? listPayrollRuns(token, { page: 1, limit: 1, sortBy: "created_at", sortOrder: "DESC" })
            .then(async (result) => {
              const run = result.rows[0]
              const runId = run ? readNumber(run, ["id", "payroll_run_id", "payrollRunId"]) : null
              setPayrollPayslips(runId === null ? [] : await listPayrollPayslipsForRun(token, runId).catch(() => []))
            })
            .catch(() => setPayrollPayslips([]))
        : Promise.resolve().then(() => setPayrollPayslips([])),
    ]

    await Promise.allSettled(tasks)
    setLoading(false)
  }, [canOpenPayroll, fromDate, toDate, markReady, showLeaveRequests])

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

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of employees) {
      const s = getEmploymentStatus(e).toLowerCase()
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [employees])

  const currentEmployees = React.useMemo(
    () =>
      employees.filter(
        (employee) => !isHistoricalEmployeeStatus(getEmploymentStatus(employee)),
      ),
    [employees],
  )

  // Derived metrics
  const totalHeadcount = currentEmployees.length

  const activeCount = statusCounts["active"] ?? 0
  // Always derive from latest employees + departments so the chart cannot go stale
  // when one list request finishes before the other.
  const resolvedDepartmentHeadcounts = React.useMemo(() => {
    const analyticsRows = extractDepartmentHeadcountsFromAnalytics(analyticsSummary)
    return analyticsRows.length > 0
      ? analyticsRows
      : buildDepartmentHeadcounts(departments, currentEmployees)
  }, [analyticsSummary, currentEmployees, departments])

  const recentLeaves = React.useMemo(() => {
    return [...leaveRequests]
      .sort((a, b) => {
        const da = String(a.created_at || a.requested_at || "")
        const db = String(b.created_at || b.requested_at || "")
        return db.localeCompare(da)
      })
      .slice(0, 6)
  }, [leaveRequests])

  // Surface more: hires within the chosen date range (client-side on the loaded sample)
  const hiresInRange = React.useMemo(() => {
    const analyticsValue = readNumberDeep(analyticsSummary, [
      "new_hires",
      "hires_in_range",
      "recent_hires",
      "joiners",
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

  const todayKey = formatLocalDateKey(new Date())
  const analyticsTodayPresent = readNumberDeep(analyticsSummary, [
    "today_present",
    "todayPresent",
    "present_today",
    "presentToday",
  ])
  const analyticsTodayAbsent = readNumberDeep(analyticsSummary, [
    "today_absent",
    "todayAbsent",
    "absent_today",
    "absentToday",
  ])
  const analyticsTodayLeave = readNumberDeep(analyticsSummary, [
    "today_on_leave",
    "todayOnLeave",
    "employees_currently_on_leave",
    "employeesCurrentlyOnLeave",
    "on_leave_today",
    "onLeaveToday",
  ])
  const analyticsTodayTotalRecords = readNumberDeep(analyticsSummary, [
    "today_total_records",
    "todayTotalRecords",
    "today_attendance_records",
    "todayAttendanceRecords",
  ])
  const todayAttendance = React.useMemo(() => {
    const rows = new Map<string, AdminRecord>()
    const sourceSummaries = [...attendanceSummaries, ...todayAttendanceSummaries]
    sourceSummaries.forEach((summary, index) => {
      const date = recordDateKey(
        readDeepValue(summary, ["attendance_date", "work_date", "summary_date", "date", "record_date"])
      )
      if (date !== todayKey) return
      const employeeId = readNumberDeep(summary, ["employee_id", "employeeId", "company_user_id", "user_id"])
      const employeeNo = readStringDeep(summary, ["employee_no", "employeeNo", "staff_no"])
      rows.set(employeeId !== null ? `id:${employeeId}` : employeeNo ? `no:${employeeNo}` : `row:${index}`, summary)
    })
    return Array.from(rows.values())
  }, [attendanceSummaries, todayAttendanceSummaries, todayKey])

  const sampledTodayPresent = React.useMemo(
    () =>
      todayAttendance.filter((summary) => {
        const status = getAttendanceStatus(summary)
        return (
          status.includes("present") ||
          status.includes("late") ||
          status.includes("early_departure") ||
          status.includes("early departure") ||
          status.includes("overtime") ||
          status.includes("half_day") ||
          status.includes("half day") ||
          status.includes("worked") ||
          status.includes("on_time") ||
          status.includes("ontime") ||
          status === "ok" ||
          status.includes("full")
        )
      }).length,
    [todayAttendance]
  )
  const useAnalyticsTodayCounts =
    todayAttendance.length === 0 &&
    (analyticsTodayTotalRecords !== 0 || todayAttendanceSummaries.length === 0) &&
    (analyticsTodayPresent !== null || analyticsTodayAbsent !== null || analyticsTodayLeave !== null)
  const todayPresent =
    useAnalyticsTodayCounts && analyticsTodayPresent !== null
      ? analyticsTodayPresent
      : sampledTodayPresent

  const sampledTodayLeave = React.useMemo(() => {
    const employeesOnLeave = new Set<string>()
    todayAttendance.forEach((summary, index) => {
      const status = getAttendanceStatus(summary)
      if (!status.includes("leave")) return
      const employeeId = readNumberDeep(summary, ["employee_id", "employeeId", "company_user_id", "user_id"])
      const employeeNo = readStringDeep(summary, ["employee_no", "employeeNo", "staff_no"])
      employeesOnLeave.add(employeeId !== null ? `id:${employeeId}` : employeeNo ? `no:${employeeNo}` : `attendance:${index}`)
    })
    leaveRequests.forEach((request, index) => {
      const status = getLeaveStatus(request)
      if (status.includes("reject") || status.includes("cancel") || status.includes("pending") || status.includes("submitted")) {
        return
      }
      const start = recordDateKey(readDeepValue(request, ["start_date", "from_date", "date_from"]))
      const end = recordDateKey(readDeepValue(request, ["end_date", "to_date", "date_to"])) || start
      if (!start || todayKey < start || todayKey > end) return
      const employeeId = readNumberDeep(request, ["employee_id", "employeeId", "company_user_id", "user_id"])
      const employeeNo = readStringDeep(request, ["employee_no", "employeeNo", "staff_no"])
      employeesOnLeave.add(employeeId !== null ? `id:${employeeId}` : employeeNo ? `no:${employeeNo}` : `row:${index}`)
    })
    return employeesOnLeave.size
  }, [leaveRequests, todayAttendance, todayKey])
  const todayLeave =
    useAnalyticsTodayCounts && analyticsTodayLeave !== null ? analyticsTodayLeave : sampledTodayLeave

  const explicitTodayAbsent = React.useMemo(
    () =>
      todayAttendance.filter((summary) => {
        const status = getAttendanceStatus(summary)
        return status.includes("absent") || status.includes("no_show") || status.includes("no show")
      }).length,
    [todayAttendance]
  )
  const todayAbsent =
    useAnalyticsTodayCounts && analyticsTodayAbsent !== null
      ? analyticsTodayAbsent
      : explicitTodayAbsent > 0
        ? explicitTodayAbsent
        : todayAttendance.length > 0
          ? Math.max(0, totalHeadcount - todayPresent - todayLeave)
          : 0
  const percentageOfHeadcount = (value: number) =>
    totalHeadcount > 0 ? Math.min(100, Math.round((value / totalHeadcount) * 100)) : 0
  const toneForPercentage = (percentage: number): WorkforceMetricTone => {
    if (percentage <= 0) return "rose"
    if (percentage < 70) return "amber"
    return "emerald"
  }
  const attendanceReport = React.useMemo(() => {
    const byDate = new Map<string, AttendanceChartDay>()
    let present = 0
    let late = 0
    let absent = 0

    attendanceSummaries.forEach((summary) => {
      const status = getAttendanceStatus(summary)
      const isLate = status.includes("late")
      const isAbsent = status.includes("absent") || status.includes("no_show") || status.includes("no show")
      const isPresent =
        !isAbsent &&
        (isLate ||
          status.includes("present") ||
          status.includes("worked") ||
          status.includes("on_time") ||
          status.includes("ontime") ||
          status === "ok" ||
          status.includes("full"))

      if (isAbsent) absent += 1
      else if (isLate) late += 1
      else if (isPresent) present += 1

      const date = recordDateKey(
        readDeepValue(summary, ["attendance_date", "work_date", "summary_date", "date", "record_date"])
      )
      if (!date || (!isPresent && !isAbsent)) return
      const current = byDate.get(date) ?? { label: date, present: 0, late: 0, absent: 0 }
      if (isAbsent) current.absent += 1
      else if (isLate) current.late += 1
      else current.present += 1
      byDate.set(date, current)
    })

    const total = present + late + absent
    return {
      present,
      late,
      absent,
      rate: total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0,
      days: Array.from(byDate.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-14)
        .map(([date, values]) => ({
          ...values,
          label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit" }),
        })),
    }
  }, [attendanceSummaries])
  const rawPerformanceScore = readNumberDeep(analyticsSummary, [
    "average_score",
    "team_performance",
    "performance_score",
    "average_performance_score",
  ])
  const performanceScore = rawPerformanceScore === null
    ? 0
    : Math.min(100, Math.round((rawPerformanceScore <= 5 ? rawPerformanceScore * 20 : rawPerformanceScore) * 10) / 10)
  const performanceStats: PerformanceStat[] = [
    {
      label: "Reviews",
      value: readNumberDeep(analyticsSummary, ["published_reviews", "published_team_reviews"]) ?? 0,
    },
    {
      label: "Reports",
      value: readNumberDeep(analyticsSummary, ["approved_daily_reports", "approved_reports"]) ?? 0,
    },
    {
      label: "Visits",
      value: readNumberDeep(analyticsSummary, ["reviewed_field_visits", "reviewed_visits"]) ?? 0,
    },
  ]
  const rawSatisfactionScore = readNumberDeep(analyticsSummary, [
    "employee_satisfaction",
    "satisfaction_score",
    "employee_satisfaction_score",
    "engagement_score",
  ])
  const satisfactionScore = rawSatisfactionScore === null
    ? 0
    : Math.min(100, Math.round((rawSatisfactionScore <= 5 ? rawSatisfactionScore * 20 : rawSatisfactionScore) * 10) / 10)
  const satisfactionCategories = [
    {
      label: "Compensation & benefits",
      value: readNumberDeep(analyticsSummary, ["compensation_satisfaction", "benefits_satisfaction"]) ?? 0,
    },
    {
      label: "Work culture",
      value: readNumberDeep(analyticsSummary, ["work_culture_satisfaction", "culture_satisfaction"]) ?? 0,
    },
    {
      label: "Work-life balance",
      value: readNumberDeep(analyticsSummary, ["work_life_balance_satisfaction", "work_life_balance"]) ?? 0,
    },
    {
      label: "Career growth",
      value: readNumberDeep(analyticsSummary, ["career_growth_satisfaction", "career_growth_score"]) ?? 0,
    },
  ].map((item) => ({ ...item, value: Math.min(100, Math.max(0, item.value)) }))

  const workforceMetrics: WorkforceMetric[] = [
    {
      label: "Total employees",
      value: totalHeadcount,
      percentage: totalHeadcount > 0 ? 100 : 0,
      description: `${activeCount} active across ${departments.length || resolvedDepartmentHeadcounts.length} departments`,
      icon: <UsersIcon className="size-5" aria-hidden="true" />,
      tone: toneForPercentage(totalHeadcount > 0 ? 100 : 0),
      visualization: "sparkline",
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Today present",
      value: todayPresent,
      percentage: percentageOfHeadcount(todayPresent),
      description: `${percentageOfHeadcount(todayPresent)}% of employees are present today (${todayPresent} of ${totalHeadcount})`,
      icon: <UserCheckIcon className="size-5" aria-hidden="true" />,
      tone: toneForPercentage(percentageOfHeadcount(todayPresent)),
      visualization: "bars",
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
      label: "Today absent",
      value: todayAbsent,
      percentage: percentageOfHeadcount(todayAbsent),
      description: `${percentageOfHeadcount(todayAbsent)}% of employees are absent today (${todayAbsent} of ${totalHeadcount})`,
      icon: <UserXIcon className="size-5" aria-hidden="true" />,
      tone: toneForPercentage(percentageOfHeadcount(todayAbsent)),
      visualization: "ticks",
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
      label: "Today on leave",
      value: todayLeave,
      percentage: percentageOfHeadcount(todayLeave),
      description: `${percentageOfHeadcount(todayLeave)}% of employees are on approved leave today (${todayLeave} of ${totalHeadcount})`,
      icon: <UserMinusIcon className="size-5" aria-hidden="true" />,
      tone: toneForPercentage(percentageOfHeadcount(todayLeave)),
      visualization: "progress",
      href: canOpenLeaveRequests ? "/dashboard/leave-management/requests" : undefined,
    },
  ]

  type MetricWithReady = Metric & { ready: boolean }

  const metrics: MetricWithReady[] = [
    {
      label: "Departments",
      value: departments.length || departmentHeadcounts.length || "-",
      sub: "Active structures",
      ready: sliceReady.departments,
      href: canOpenDepartments ? "/dashboard/departments" : undefined,
    },
    {
      label: "New hires",
      value: hiresInRange,
      sub: fromDate && toDate ? `${formatDateShort(fromDate)} - ${formatDateShort(toDate)}` : "Selected range",
      ready: sliceReady.employees,
      compact: true,
      href: canOpenEmployeeDirectory ? "/dashboard/employees/all" : undefined,
    },
    {
      label: "Onboarding",
      value: pendingOnboarding,
      sub: "open requests",
      ready: sliceReady.onboarding,
      compact: true,
      href: canOpenOnboarding ? "/dashboard/employees/onboarding" : undefined,
    },
    {
      label: "Offboarding",
      value: pendingOffboarding,
      sub: "open requests",
      ready: sliceReady.offboarding,
      compact: true,
      href: canOpenOffboarding ? "/dashboard/employees/offboarding" : undefined,
    },
  ]

  const leaveSectionReady = sliceReady.leave
  const motionPreset = useDashboardMotion()
  const hrAnalyticsGroups = React.useMemo(() => {
    if (!analyticsSummary) return []

    const number = (keys: string[]) => readNumberDeep(analyticsSummary, keys)
    const decimal = (value: number | null) =>
      value === null
        ? "—"
        : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
    const percent = (keys: string[]) => {
      const value = number(keys)
      return value === null ? "—" : `${decimal(value)}%`
    }
    const workMinutes = number(["work_minutes"])
    const hours = workMinutes === null ? null : Math.round((workMinutes / 60) * 10) / 10
    const risks = Array.isArray(analyticsSummary.risk_indicators)
      ? analyticsSummary.risk_indicators.length
      : null

    return [
      {
        title: "Workforce movement",
        items: [
          { label: "Period-end headcount", value: decimal(number(["period_end_headcount"])) },
          { label: "Joiners", value: decimal(number(["joiners"])) },
          { label: "Exits", value: decimal(number(["exits"])) },
          { label: "Attrition rate", value: percent(["attrition_rate"]) },
        ],
      },
      {
        title: "Attendance and leave",
        items: [
          { label: "Finalized days", value: decimal(number(["finalized_days"])) },
          { label: "Work hours", value: decimal(hours) },
          { label: "Late rate", value: percent(["late_rate"]) },
          { label: "Missing punch days", value: decimal(number(["missing_punch_days"])) },
          { label: "Approved leave requests", value: decimal(number(["approved_requests"])) },
          { label: "Approved leave days", value: decimal(number(["approved_days"])) },
        ],
      },
      {
        title: "Payroll and employee finance",
        items: [
          { label: "Locked payroll runs", value: decimal(number(["locked_runs"])) },
          { label: "Gross pay", value: decimal(number(["gross_pay"])) },
          { label: "Net pay", value: decimal(number(["net_pay"])) },
          { label: "Employer cost", value: decimal(number(["employer_cost"])) },
          { label: "Outstanding finance", value: decimal(number(["total_outstanding"])) },
          { label: "Arrears ratio", value: percent(["arrears_ratio"]) },
        ],
      },
      {
        title: "Performance and operations",
        items: [
          { label: "Published reviews", value: decimal(number(["published_reviews"])) },
          { label: "Average score", value: decimal(number(["average_score"])) },
          { label: "Approved daily reports", value: decimal(number(["approved_daily_reports"])) },
          { label: "Reviewed field visits", value: decimal(number(["reviewed_field_visits"])) },
          { label: "Pending approvals", value: decimal(number(["pending_actions"])) },
          { label: "Risk indicators", value: decimal(risks) },
        ],
      },
    ]
  }, [analyticsSummary])
  const dateRangePresets = [
    { label: "Last week", days: 7 },
    { label: "Last 2 weeks", days: 14 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
  ]
  const todayInputDate = formatInputDate(new Date())
  const activeDateRangeLabel =
    dateRangePresets.find(
      (preset) =>
        fromDate === formatInputDate(shiftDays(new Date(), -preset.days)) &&
        toDate === todayInputDate
    )?.label ?? "Custom range"

  const applyDateRangePreset = (days: number) => {
    setFromDate(formatInputDate(shiftDays(new Date(), -days)))
    setToDate(formatInputDate(new Date()))
    setDateFilterOpen(false)
  }
  const visibleRoleNames = Array.from(
    new Set([
      ...assignedRoleNames,
      ...(adminRolesLabel?.split("•").map((role) => role.trim()).filter(Boolean) ?? []),
    ]),
  )
  const upcomingHolidayName = upcomingHoliday
    ? readString(upcomingHoliday, ["name", "holiday_name", "holidayName", "title"])
    : ""
  const upcomingHolidayDate = upcomingHoliday ? holidayDateKey(upcomingHoliday) : ""

  return (
    <motion.div
      className="w-full pb-6"
      variants={motionPreset.container}
      initial="hidden"
      animate="show"
    >
      <motion.header
        className="relative mx-1 mt-2 overflow-hidden border-x-0 border-b border-t-0 border-slate-200 bg-white px-3 py-4 text-slate-900 shadow-none sm:mx-2 sm:px-4 md:py-5 lg:mx-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        variants={motionPreset.rise}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-sky-500/70 dark:text-sky-300/60">
          <span className="absolute left-[29%] top-5 text-xs text-blue-400/60 dark:text-blue-200/45">✧</span>
          <span className="absolute left-[43%] bottom-4 text-sm">✦</span>
          <span className="absolute right-[42%] top-3 text-[10px] text-blue-400/60 dark:text-blue-200/45">✧</span>
          <span className="absolute right-[34%] top-10 text-xs text-blue-400/70 dark:text-blue-200/50">✧</span>
          <span className="absolute right-[26%] bottom-4 text-[10px] text-sky-400/60 dark:text-sky-200/45">✧</span>
          <span className="absolute right-[18%] top-4 text-lg">✦</span>
          <span className="absolute right-[8%] bottom-3 text-sm">✦</span>
        </div>
        <div className="relative z-10 flex w-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Persona
              name={userName || "Company user"}
              primaryText={{
                children: userName || "Company user",
                style: { color: "var(--foreground)", fontWeight: 600 },
              }}
              secondaryText={{
                children: "Available",
                style: { color: "var(--muted-foreground)" },
              }}
              presence={{ status: "available" }}
              avatar={{
                color: "brand",
                image: profilePhotoUrl
                  ? { src: profilePhotoUrl, alt: userName || "HR profile" }
                  : undefined,
              }}
              size="extra-large"
              textAlignment="center"
              className="min-h-14 min-w-[11.375rem] [&_.fui-Persona__primaryText]:font-semibold [&_.fui-Persona__primaryText]:!text-foreground [&_.fui-Persona__secondaryText]:!text-muted-foreground"
            />
          </div>
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5 pl-[68px] sm:absolute sm:right-2 sm:top-1 sm:mt-0 sm:pl-0 xl:static xl:ml-auto"
            aria-label="Assigned roles"
          >
            {visibleRoleNames.length > 0 ? (
              visibleRoleNames.map((roleName) => (
                <span
                  key={roleName}
                  className="inline-flex h-5 items-center rounded-full border border-white/70 bg-white/60 px-2 text-[9px] font-semibold text-slate-700 shadow-sm backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white"
                >
                  {roleName}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground">No roles assigned</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {upcomingHoliday && upcomingHolidayDate ? (
              <Link
                href="/dashboard/attendance/holidays"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/70 bg-white/60 px-2.5 text-[10px] text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white/80 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                aria-label={`Upcoming holiday ${upcomingHolidayName || "Holiday"} on ${formatDateShort(upcomingHolidayDate)}`}
              >
                <CalendarIcon className="size-3.5 text-sky-300" aria-hidden="true" />
                <span className="text-slate-500 dark:text-white/70">Upcoming</span>
                <span className="max-w-40 truncate font-semibold">
                  {upcomingHolidayName || "Holiday"}
                </span>
                <span className="text-slate-500 dark:text-white/70">{formatDateShort(upcomingHolidayDate)}</span>
              </Link>
            ) : null}
            <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
              <PopoverTrigger
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/70 bg-white/60 px-2.5 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                aria-label="Filter dashboard date range"
              >
                <FilterIcon className="size-3" aria-hidden="true" />
                <span>{activeDateRangeLabel}</span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(19rem,calc(100vw-1.5rem))] p-2.5">
                <div>
                  <p className="text-xs font-semibold text-foreground">Dashboard period</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDateShort(fromDate)} – {formatDateShort(toDate)}
                  </p>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  {dateRangePresets.map((preset) => {
                    const active = activeDateRangeLabel === preset.label
                    return (
                      <button
                        key={preset.days}
                        type="button"
                        className={cn(
                          "h-7 rounded-md px-2 text-left text-[10px] font-medium transition",
                          active
                            ? "bg-primary !text-primary-foreground"
                            : "bg-muted/50 text-foreground hover:bg-muted"
                        )}
                        onClick={() => applyDateRangePreset(preset.days)}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2.5 border-t border-border pt-2.5">
                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Custom range
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <DatePickerPresets
                      value={fromDate}
                      onChange={setFromDate}
                      placeholder="From date"
                      className="h-7 px-2 text-[10px]"
                    />
                    <DatePickerPresets
                      value={toDate}
                      onChange={setToDate}
                      placeholder="To date"
                      className="h-7 px-2 text-[10px]"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={() => void fetchAll()}
              disabled={loading}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-white/70 bg-white/60 text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white/80 disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              title="Refresh"
            >
              <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </motion.header>

      <div className="w-full px-1 sm:px-2 lg:px-3">
      <motion.section
        className="relative pb-1 pt-3 md:pt-4"
        variants={motionPreset.item}
      >
        <motion.div
          className="grid w-full grid-cols-1 items-stretch gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
          aria-busy={loading}
          aria-live="polite"
          variants={motionPreset.metrics}
        >
          {workforceMetrics.map((metric) => (
            <WorkforceMetricCard
              key={metric.label}
              metric={metric}
              reduce={motionPreset.reduce}
              variants={motionPreset.metricCard}
            />
          ))}
        </motion.div>
        <motion.div
          className="mt-2.5 grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] items-stretch gap-2.5"
          variants={motionPreset.metrics}
        >
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              metric={metric}
              reduce={motionPreset.reduce}
              variants={motionPreset.metricCard}
              hover={motionPreset.hover}
            />
          ))}
        </motion.div>
        <WorkforceInsightPanels
          rangeLabel={activeDateRangeLabel}
          attendanceRate={attendanceReport.rate}
          present={attendanceReport.present}
          late={attendanceReport.late}
          absent={attendanceReport.absent}
          attendanceDays={attendanceReport.days}
          performanceScore={performanceScore}
          performanceStats={performanceStats}
        />
        <PeopleExperiencePanels
          satisfactionScore={satisfactionScore}
          satisfactionCategories={satisfactionCategories}
          payrollRows={payrollPayslips}
          canOpenPayroll={canOpenPayroll}
        />
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

      {showHrAnalytics && hrAnalyticsGroups.length > 0 ? (
        <motion.section className="mt-6" variants={motionPreset.item}>
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">HR analytics</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Workforce, attendance, pay, and performance snapshot
            </p>
          </div>
          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3">
            {hrAnalyticsGroups.map((group) => (
              <UiCard key={group.title} size="sm" className="gap-0 rounded-2xl border-border/70 py-0 shadow-sm">
                <UiCardContent className="p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    {group.title}
                  </h3>
                  <dl className="mt-3 flex flex-col gap-2">
                    {group.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between gap-3 border-t border-border/70 pt-2 first:border-t-0 first:pt-0"
                      >
                        <dt className="text-xs leading-5 text-muted-foreground">{item.label}</dt>
                        <dd className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </UiCardContent>
              </UiCard>
            ))}
          </div>
        </motion.section>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        {showLeaveRequests ? (
        <motion.section className="lg:col-span-12" variants={motionPreset.item}>
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
        ) : null}

      </div>
      </div>
    </motion.div>
  )
}
