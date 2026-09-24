"use client"

import * as React from "react"
import Link from "next/link"
import { InfoIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { DashboardIdentitySummary } from "@/components/dashboard/dashboard-identity"
import {
  HeroBand,
  MetricTile,
  TalentDoodleSprites,
  asRecord,
  asRecordArray,
  employeeLabel,
  formatDate,
  formatDateTime,
  heroGhostButtonClass,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readBoolean,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  getHrAttendanceSchedulePreview,
  getHrAttendanceSetupStatus,
  exportAnalyticsReport,
  getAnalyticsDashboard,
  getHrDashboard,
  getManagerDashboard,
  getHrLaunchReadiness,
  getHrLaunchReadinessEmployees,
  getSystemHealth,
  getSystemHealthLive,
  getSystemHealthReady,
  listCurrentCompanyUsers,
  listSecurityEvents,
  runHrAttendanceSetupWizard,
  type AdminRecord,
} from "@/lib/admin-api"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { motion } from "framer-motion"
import { useDashboardMotion } from "@/lib/dashboard-motion"
import { useForbiddenRouteGuard, useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard"
import { readStoredSessionTokens } from "@/lib/session-client"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { describeSecurityEvent } from "@/lib/security-event-plain"
import { cn } from "@/lib/utils"
import {
  isEmployeeReady,
  parseReadinessChecks,
  readinessCheckItems,
  readinessIssueText,
  readinessPersonName,
} from "@/lib/employee-readiness-plain"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"

export type InsightsOpsTab = "hr" | "management" | "manager" | "sales-field" | "readiness"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

function localDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function defaultScheduleRange() {
  const start = new Date()
  const end = new Date()
  end.setDate(end.getDate() + 6)
  return { from: localDateString(start), to: localDateString(end) }
}

function schedulePreviewDays(record: AdminRecord | null) {
  if (!record) return []
  for (const key of ["days", "items", "rows", "schedule", "preview"]) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value.filter((entry): entry is AdminRecord => typeof entry === "object" && entry !== null)
    }
  }
  return []
}

function TipIcon({
  text,
  variant = "default",
}: {
  text: string
  variant?: "default" | "onPrimary"
}) {
  const motionPreset = useDashboardMotion()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={
              variant === "onPrimary"
                ? "inline-flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:text-white"
                : "inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:text-primary"
            }
            aria-label="More information"
          />
        }
      >
        <motion.span
          className="inline-flex"
          animate={
            motionPreset.reduce
              ? undefined
              : { scale: [1, 1.15, 1], opacity: [0.65, 1, 0.65] }
          }
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </motion.span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-72 text-left leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function friendlyStatus(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized === "—") return "—"
  if (["ok", "up", "healthy", "ready", "live", "true", "yes"].includes(normalized)) {
    return "Working"
  }
  if (["down", "fail", "failed", "unhealthy", "error", "false", "no"].includes(normalized)) {
    return "Needs attention"
  }
  return value
}

function metricEntries(record: AdminRecord | null) {
  if (!record) return []
  const skip = new Set(["id", "companyId", "company_id", "generatedAt", "generated_at", "asOf", "as_of"])
  const entries: Array<{ label: string; value: string | number }> = []
  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key)) continue
    if (typeof value === "number" && Number.isFinite(value)) {
      entries.push({ label: prettify(key), value })
      continue
    }
    if (typeof value === "string" && value.trim() && value.length < 40) {
      entries.push({ label: prettify(key), value })
    }
  }
  return entries.slice(0, 8)
}

function managerMetric(record: AdminRecord | null, keys: string[]) {
  return readNumber(record, keys) ?? "—"
}

function managerAttentionClass(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numericValue)) return "text-muted-foreground"
  return numericValue === 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-primary"
}

function ManagerStatList({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; value: string | number }>
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="mt-3 divide-y divide-border/70">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
          >
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ScopedInsightPanels({ dashboard }: { dashboard: AdminRecord | null }) {
  const attendance = asRecord(dashboard?.attendance) ?? dashboard
  const performance = asRecord(dashboard?.performance) ?? dashboard
  const present = readNumber(attendance, ["present", "present_today", "presentToday"]) ?? 0
  const late = readNumber(attendance, ["late", "late_arrivals", "lateArrivals"]) ?? 0
  const absent = readNumber(attendance, ["absent", "absent_today", "absentToday"]) ?? 0
  const attendanceTotal = Math.max(1, present + late + absent)
  const attendanceRate = Math.round(((present + late) / attendanceTotal) * 1000) / 10
  const published = readNumber(performance, ["published_team_reviews", "publishedTeamReviews", "published_reviews"]) ?? 0
  const pending = readNumber(performance, ["pending_team_validations", "pendingTeamValidations", "pending_validations"]) ?? 0
  const approved = readNumber(performance, ["approved_reports", "approvedReports", "approved_daily_reports"]) ?? 0
  const rawScore = readNumber(performance, ["average_score", "averageScore", "performance_score", "performanceScore"])
  const performanceScore = rawScore !== null
    ? Math.min(100, Math.round((rawScore <= 5 ? rawScore * 20 : rawScore) * 10) / 10)
    : published + pending > 0
      ? Math.round((published / (published + pending)) * 1000) / 10
      : 0
  const attendanceBars = [
    { label: "On time", value: present, color: "bg-emerald-500" },
    { label: "Late", value: late, color: "bg-amber-300" },
    { label: "Absent", value: absent, color: "bg-rose-300" },
  ]
  const performanceBars = [
    { label: "Reviews", value: published },
    { label: "Pending", value: pending },
    { label: "Approved", value: approved },
  ]
  const attendanceMax = Math.max(1, ...attendanceBars.map((item) => item.value))
  const performanceMax = Math.max(1, ...performanceBars.map((item) => item.value))

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Attendance report</h2>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">{attendanceRate}%</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Attendance rate</span>
            </div>
          </div>
          <span className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] font-medium text-foreground">Selected period</span>
        </div>
        <div className="mt-6 flex h-40 items-end justify-around gap-6 border-b border-border/60 px-4 pb-2">
          {attendanceBars.map((item) => (
            <div key={item.label} className="flex h-full min-w-16 flex-1 flex-col items-center justify-end gap-2">
              <span className="text-xs font-semibold tabular-nums text-foreground">{item.value}</span>
              <span className={cn("w-full max-w-16 rounded-t-md", item.color)} style={{ height: `${Math.max(8, (item.value / attendanceMax) * 75)}%` }} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Team performance</h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Reviews and approved work</p>
          </div>
          <span className="rounded-lg bg-muted/40 px-3 py-2 text-[10px] font-medium text-foreground">This period</span>
        </div>
        <p className="mt-5 text-3xl font-semibold leading-none tabular-nums text-foreground">{performanceScore}%</p>
        <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400">Current performance score</p>
        <div className="mt-5 flex h-28 items-end justify-around gap-3 border-b border-border/60 pb-2">
          {performanceBars.map((item) => (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-20 items-end gap-1">
                <span className="w-3 rounded-t bg-emerald-500/20" style={{ height: `${Math.max(10, (item.value / performanceMax) * 65)}%` }} />
                <span className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(14, (item.value / performanceMax) * 100)}%` }} />
              </div>
              <span className="truncate text-[9px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ManagerDashboardPanels({ dashboard }: { dashboard: AdminRecord | null }) {
  const team = asRecord(dashboard?.team)
  const attendance = asRecord(dashboard?.attendance)
  const approvals = asRecord(dashboard?.approvals)
  const performance = asRecord(dashboard?.performance)
  const activities = asRecord(dashboard?.work_activities ?? dashboard?.workActivities)
  const capabilities = asRecord(dashboard?.capabilities)
  const capabilityItems = [
    {
      label: "Activity report reviews",
      record: asRecord(capabilities?.activity_review ?? capabilities?.activityReview),
      href: "/dashboard/activities/reviews",
      linkLabel: "Open activity reviews",
      stats: [
        {
          label: "Pending",
          keys: ["pending_activity_reviews", "pendingActivityReviews"],
        },
      ],
    },
    {
      label: "KPI reviews",
      record: asRecord(capabilities?.kpi_review ?? capabilities?.kpiReview),
      href: "/dashboard/performance/reviews",
      linkLabel: "Open performance reviews",
      stats: [
        {
          label: "Pending validations",
          keys: ["pending_team_validations", "pendingTeamValidations"],
        },
        {
          label: "Published reviews",
          keys: ["published_team_reviews", "publishedTeamReviews"],
        },
      ],
    },
    {
      label: "Probation recommendations",
      record: asRecord(
        capabilities?.probation_recommendation ?? capabilities?.probationRecommendation,
      ),
      href: "/dashboard/probation/team",
      linkLabel: "Open team probation",
      stats: [],
    },
  ]
  const availableCapabilityItems = capabilityItems.filter((item) => Boolean(item.record))
  const summaryItems = [
    {
      label: "Team members",
      value: managerMetric(team, ["total_members", "totalMembers"]),
      hintValue: managerMetric(team, ["employees_on_leave", "employeesOnLeave"]),
      hintLabel: "currently on leave",
    },
    {
      label: "Present today",
      value: managerMetric(attendance, ["present"]),
      hintValue: managerMetric(attendance, ["total_records", "totalRecords"]),
      hintLabel: "attendance records",
    },
    {
      label: "Open action items",
      value: managerMetric(approvals, ["open_action_items", "openActionItems"]),
      hintValue: managerMetric(approvals, ["pending_attendance_corrections", "pendingAttendanceCorrections"]),
      hintLabel: "attendance corrections",
    },
    {
      label: "Activity reviews",
      value: managerMetric(activities, ["pending_activity_reviews", "pendingActivityReviews"]),
      hintValue: managerMetric(activities, ["approved_reports", "approvedReports"]),
      hintLabel: "approved reports",
    },
  ]

  return (
    <>
      <ScopedInsightPanels dashboard={dashboard} />
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item, index) => (
            <div
              key={item.label}
              className={`min-w-0 px-4 py-3 ${index === 1 || index === 3 ? "sm:border-l sm:border-border/70" : ""} ${index === 2 ? "xl:border-l xl:border-border/70" : ""}`}
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd className={`mt-1 text-2xl font-semibold tracking-tight ${managerAttentionClass(item.value)}`}>
                {item.value}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className={`font-semibold tabular-nums ${managerAttentionClass(item.hintValue)}`}>
                  {item.hintValue}
                </span>{" "}
                {item.hintLabel}
              </p>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ManagerStatList
          title="Attendance"
          items={[
            { label: "Present", value: managerMetric(attendance, ["present"]) },
            { label: "Absent", value: managerMetric(attendance, ["absent"]) },
            { label: "Late", value: managerMetric(attendance, ["late"]) },
            {
              label: "Early departure",
              value: managerMetric(attendance, ["early_departure", "earlyDeparture"]),
            },
          ]}
        />
        <ManagerStatList
          title="Work activities"
          items={[
            {
              label: "Pending report reviews",
              value: managerMetric(activities, ["pending_activity_reviews", "pendingActivityReviews"]),
            },
            {
              label: "Pending visit reviews",
              value: managerMetric(activities, ["pending_visit_reviews", "pendingVisitReviews"]),
            },
            {
              label: "Approved reports",
              value: managerMetric(activities, ["approved_reports", "approvedReports"]),
            },
            {
              label: "Reviewed visits",
              value: managerMetric(activities, ["reviewed_visits", "reviewedVisits"]),
            },
          ]}
        />
        <ManagerStatList
          title="Performance and approvals"
          items={[
            {
              label: "Team validations",
              value: managerMetric(performance, ["pending_team_validations", "pendingTeamValidations"]),
            },
            {
              label: "Published reviews",
              value: managerMetric(performance, ["published_team_reviews", "publishedTeamReviews"]),
            },
            {
              label: "Open action items",
              value: managerMetric(approvals, ["open_action_items", "openActionItems"]),
            },
            {
              label: "Attendance corrections",
              value: managerMetric(approvals, ["pending_attendance_corrections", "pendingAttendanceCorrections"]),
            },
          ]}
        />
      </div>

      {availableCapabilityItems.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Available manager actions</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3 md:gap-0">
            {availableCapabilityItems.map(({ label, record: candidate, href, linkLabel, stats }, index) => {
              const record = candidate as AdminRecord
              const available = readBoolean(record, ["available"])
              const reason = readString(record, ["reason"])
              return (
                <Link
                  key={label}
                  href={href}
                  className={`relative flex min-h-36 flex-col py-1 !no-underline transition-transform duration-200 ease-out hover:z-10 hover:scale-[1.025] hover:!no-underline focus:!no-underline focus-visible:!no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 motion-reduce:transform-none md:px-4 ${index > 0 ? "md:border-l md:border-border/70" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <span
                      className={
                        available
                          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }
                    >
                      {available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  {stats.length > 0 ? (
                    <dl className="mt-3 flex divide-x divide-border/70">
                      {stats.map((stat, statIndex) => (
                        <div key={stat.label} className={statIndex > 0 ? "min-w-0 flex-1 pl-3" : "min-w-0 flex-1 pr-3"}>
                          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {stat.label}
                          </dt>
                          <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${managerAttentionClass(managerMetric(record, stat.keys))}`}>
                            {managerMetric(record, stat.keys)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {reason ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{reason}</p>
                  ) : null}
                  <span className="mt-auto pt-3 text-xs font-semibold text-primary">
                    {linkLabel} →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    </>
  )
}

export function InsightsOperationsView({
  activeTab,
  embedded = false,
}: {
  activeTab: InsightsOpsTab
  embedded?: boolean
}) {
  const actor = useDashboardActor()
  const motionPreset = useDashboardMotion()
  const canAccess =
    embedded ||
    (actor.ready &&
      canAccessDashboardRoute(
        `/dashboard/insights/${activeTab}`,
        actor.permissionLabels,
        actor.accessMode,
      ))
  const leaveIfForbidden = useLeaveIfForbidden()
  useForbiddenRouteGuard(canAccess)

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [health, setHealth] = React.useState<AdminRecord | null>(null)
  const [live, setLive] = React.useState<AdminRecord | null>(null)
  const [ready, setReady] = React.useState<AdminRecord | null>(null)
  const [readiness, setReadiness] = React.useState<AdminRecord | null>(null)
  const [employees, setEmployees] = React.useState<AdminRecord[]>([])
  const [events, setEvents] = React.useState<AdminRecord[]>([])
  const [companyUsers, setCompanyUsers] = React.useState<AdminRecord[]>([])
  const [setup, setSetup] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [eventDetail, setEventDetail] = React.useState<AdminRecord | null>(null)
  const [readinessDetail, setReadinessDetail] = React.useState<AdminRecord | null>(null)
  const [dateFrom, setDateFrom] = React.useState(() => defaultScheduleRange().from)
  const [dateTo, setDateTo] = React.useState(() =>
    activeTab === "manager" ? localDateString(new Date()) : defaultScheduleRange().to,
  )
  const [policyName, setPolicyName] = React.useState("")
  const [clockInDialogOpen, setClockInDialogOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [previewEmployeeId, setPreviewEmployeeId] = React.useState("")
  const [schedulePreview, setSchedulePreview] = React.useState<AdminRecord | null>(null)

  const load = React.useCallback(async () => {
    const token = readStoredToken()
    if (!token) {
      setError("Authentication required. Please log in again.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const tasks: Array<Promise<unknown>> = []
    if (activeTab !== "readiness") {
      const query = {
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
      }
      tasks.push(
        (activeTab === "sales-field"
          ? getAnalyticsDashboard(token, "sales-field", query)
          : activeTab === "manager"
            ? getManagerDashboard(token, query)
            : getHrDashboard(token, activeTab, query)
        ).then(setDashboard).catch((errorObject) => {
          setDashboard(null)
          throw errorObject
        }),
      )
    } else {
      tasks.push(
        getHrLaunchReadiness(token).then(setReadiness).catch((errorObject) => {
          setReadiness(null)
          throw errorObject
        }),
        getHrLaunchReadinessEmployees(token)
          .then((report) => {
            const record = report && typeof report === "object" && !Array.isArray(report) ? report : null
            const readinessRows = [
              ...asRecordArray(record?.ready),
              ...asRecordArray(record?.notReady),
            ]
            setEmployees(
              readinessRows.length > 0
                ? readinessRows
                : asRecordArray(record?.items ?? record?.employees ?? report),
            )
          })
          .catch(() => setEmployees([])),
        getSystemHealth(token).then(setHealth).catch(() => setHealth(null)),
        getSystemHealthLive(token).then(setLive).catch(() => setLive(null)),
        getSystemHealthReady(token).then(setReady).catch(() => setReady(null)),
        listSecurityEvents(token, { page: 1, limit: 20 }).then(setEvents).catch(() => setEvents([])),
        listCurrentCompanyUsers(token, { page: 1, limit: 100 })
          .then((result) => setCompanyUsers(result.rows))
          .catch(() => setCompanyUsers([])),
        getHrAttendanceSetupStatus(token).then(setSetup).catch(() => setSetup(null)),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load insights.")
    }
    setLoading(false)
  }, [activeTab, dateFrom, dateTo, leaveIfForbidden])

  React.useEffect(() => {
    if (!canAccess) return
    void load()
  }, [canAccess, load])

  const metrics = metricEntries(dashboard)
  const blockers = asRecordArray(readiness?.blockers ?? readiness?.items)
  const visibleEmployees = employees.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
  const visibleEvents = events.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
  const actorNames = React.useMemo(() => {
    const byCompanyUserId = new Map<number, string>()
    const byUserId = new Map<number, string>()
    companyUsers.forEach((row) => {
      const nestedUser = row.user && typeof row.user === "object" ? (row.user as AdminRecord) : null
      const first =
        readString(row, ["first_name", "firstName"]) ||
        (nestedUser ? readString(nestedUser, ["first_name", "firstName"]) : "")
      const last =
        readString(row, ["last_name", "lastName"]) ||
        (nestedUser ? readString(nestedUser, ["last_name", "lastName"]) : "")
      const label =
        [first, last].filter(Boolean).join(" ").trim() ||
        readString(row, ["email", "full_name", "fullName"]) ||
        (nestedUser ? readString(nestedUser, ["email", "full_name", "fullName"]) : "")
      if (!label) {
        return
      }
      const companyUserId = readNumber(row, [
        "company_user_id",
        "companyUserId",
        "membership_id",
        "membershipId",
      ])
      if (companyUserId !== null) {
        byCompanyUserId.set(companyUserId, label)
      }
      const userId =
        readNumber(row, ["user_id", "userId", "platform_user_id", "platformUserId", "id"]) ??
        (nestedUser ? readNumber(nestedUser, ["id", "user_id", "userId"]) : null)
      if (userId !== null) {
        byUserId.set(userId, label)
      }
    })
    return { byCompanyUserId, byUserId }
  }, [companyUsers])

  async function onWizard() {
    const token = readStoredToken()
    if (!token) return
    if (!policyName.trim()) {
      toast.error("Type a short name for these clock-in rules, for example Office clock-in.")
      return
    }
    setSaving(true)
    try {
      const result = await runHrAttendanceSetupWizard(token, {
        policy: { name: policyName.trim() },
      })
      const payload = asRecord(result)
      const details = asRecord(payload?.data) ?? payload
      const policyId = readNumber(details, ["policyId", "policy_id", "id"])
      const apiMessage = readString(payload, ["message"])
      toast.success(
        policyId || /created successfully/i.test(apiMessage)
          ? `Clock-in rules “${policyName.trim()}” are saved. This is a starter set — refine it later under Attendance.`
          : apiMessage || `Clock-in rules “${policyName.trim()}” are saved.`,
      )
      setClockInDialogOpen(false)
      setPolicyName("")
      await load()
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Could not create clock-in rules."
      toast.error(
        /already exists/i.test(message)
          ? `Clock-in rules named "${policyName.trim()}" already exist. Use a different name only if you want a new set.`
          : message,
      )
    } finally {
      setSaving(false)
    }
  }

  async function onPreview() {
    const token = readStoredToken()
    if (!token) return
    if (!previewEmployeeId) {
      toast.error("Choose an employee to preview their schedule.")
      return
    }
    if (!dateFrom || !dateTo) {
      toast.error("Pick a start and end date.")
      return
    }
    if (dateTo < dateFrom) {
      toast.error("End date must be on or after the start date.")
      return
    }
    try {
      const record = await getHrAttendanceSchedulePreview(token, {
        employee_id: Number(previewEmployeeId),
        from_date: dateFrom,
        to_date: dateTo,
      })
      setSchedulePreview(record)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not load that schedule.")
    }
  }

  async function onExport() {
    const token = readStoredToken()
    if (!token) return
    const datasetCode = activeTab === "sales-field" ? "sales_field" : "hr_headcount"
    setExporting(true)
    try {
      await exportAnalyticsReport(token, {
        dataset_code: datasetCode,
        dimensions: ["department_name"],
        measures: ["headcount"],
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        output_format: "CSV",
        idempotency_key: `insights-${activeTab}-${Date.now()}`,
      })
      toast.success("Analytics export queued.")
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not export this dashboard.")
    } finally {
      setExporting(false)
    }
  }

  const employeeColumns = React.useMemo<Column<AdminRecord>[]>(() => [
    { key: "employee", label: "Employee", render: (row) => readinessPersonName(row) },
    {
      key: "shift",
      label: "Has a shift",
      render: (row) => (parseReadinessChecks(row).hasShift ? "Yes" : "Not yet"),
    },
    {
      key: "clockin",
      label: "How they clock in",
      render: (row) => {
        const checks = parseReadinessChecks(row)
        const methods = [
          checks.hasFingerprint ? "Fingerprint" : null,
          checks.hasCardOrPin ? "Card or PIN" : null,
        ].filter(Boolean)
        return methods.length > 0 ? methods.join(", ") : "Not set up"
      },
    },
    {
      key: "status",
      label: "Can clock in",
      render: (row) => (isEmployeeReady(row) ? "Ready" : "Not ready"),
    },
  ], [])

  const eventColumns = React.useMemo<Column<AdminRecord>[]>(() => [
    {
      key: "what",
      label: "What they tried",
      render: (row) => describeSecurityEvent(row, actorNames).what,
    },
    {
      key: "who",
      label: "Who",
      render: (row) => describeSecurityEvent(row, actorNames).who,
    },
    {
      key: "when",
      label: "When",
      render: (row) => {
        const when = formatDateTime(
          row.occurred_at ?? row.occurredAt ?? row.createdAt ?? row.created_at ?? row.timestamp,
        )
        return when === "—" ? "Time not recorded" : when
      },
    },
  ], [actorNames])

  if (!canAccess) return null

  return (
    <motion.section
      className="space-y-4"
      variants={motionPreset.container}
      initial="hidden"
      animate="show"
    >
      <TalentDoodleSprites />
      <HeroBand
        identity={<DashboardIdentitySummary compact />}
        eyebrow={embedded ? "Home" : "Insights"}
        title={
          <>
            {activeTab === "readiness"
              ? "Are we ready?"
              : activeTab === "sales-field"
                ? "Sales and field overview"
                : `${prettify(activeTab)} overview`}
            <TipIcon
              variant="onPrimary"
              text={
                activeTab === "readiness"
                  ? "Check system health, create starter clock-in rules, and review blocked actions."
                  : "A snapshot of how the company is doing for the dates you pick."
              }
            />
          </>
        }
        description={
          activeTab === "manager"
            ? "Team attendance, approvals, performance, and work requiring your attention."
            : undefined
        }
        actions={
          <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto">
            {activeTab !== "readiness" ? (
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                    From
                  </span>
                  <DatePickerPresets
                    value={dateFrom}
                    onChange={setDateFrom}
                    placeholder="Start date"
                    appearance="onPrimary"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                    To
                  </span>
                  <DatePickerPresets
                    value={dateTo}
                    onChange={setDateTo}
                    placeholder="End date"
                    appearance="onPrimary"
                  />
                </label>
              </div>
            ) : null}
            {activeTab !== "readiness" && activeTab !== "manager" ? (
              <button type="button" className={`${heroGhostButtonClass} h-10`} onClick={() => void onExport()} disabled={exporting}>
                {exporting ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Export CSV
              </button>
            ) : null}
            <button type="button" className={`${heroGhostButtonClass} h-10`} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
          </div>
        }
      />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {activeTab !== "readiness" ? (
        <>
          {activeTab === "manager" ? (
            <ManagerDashboardPanels dashboard={dashboard} />
          ) : (
            <>
              {activeTab === "management" ? <ScopedInsightPanels dashboard={dashboard} /> : null}
              <motion.div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={motionPreset.fast}>
                {metrics.length > 0 ? metrics.map((item) => (
                  <MetricTile key={item.label} label={item.label} value={item.value} />
                )) : (
                  <MetricTile label="Records" value={dashboard ? "Loaded" : "—"} hint="No numeric tiles in this payload." />
                )}
              </motion.div>
            </>
          )}
        </>
      ) : (
        <>
          <motion.div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={motionPreset.fast}>
            <MetricTile
              label="System"
              value={
                <span className="text-primary">
                  {friendlyStatus(readString(health, ["status", "state"], health ? "OK" : "—"))}
                </span>
              }
            />
            <MetricTile
              label="Online"
              value={
                <span className="text-primary">
                  {friendlyStatus(readString(live, ["status", "state"], live ? "OK" : "—"))}
                </span>
              }
            />
            <MetricTile
              label="Ready to use"
              value={
                <span className="text-primary">
                  {friendlyStatus(readString(ready, ["status", "state"], ready ? "OK" : "—"))}
                </span>
              }
            />
            <MetricTile
              label="Issues to fix"
              value={
                <span className="text-primary">
                  {readNumber(readiness, ["blockerCount", "blocker_count", "blockers"]) ?? blockers.length}
                </span>
              }
            />
          </motion.div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold">Set up clock-in</h2>
                <TipIcon text="Creating rules here only builds a starter set. Refine devices, maps, and shifts later under Attendance." />
              </div>
              {readString(asRecord(setup?.activePolicy), ["name"]) ? (
                <p className="mt-2 text-sm text-foreground">
                  Clock-in rules already exist:{" "}
                  <span className="font-medium">
                    {readString(asRecord(setup?.activePolicy), ["name"])}
                  </span>
                  .
                </p>
              ) : (
                <button
                  type="button"
                  className={`${primaryButtonClass} mt-3`}
                  onClick={() => setClockInDialogOpen(true)}
                >
                  Set up clock-in
                </button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Preview a work schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a person and dates to see planned start and end times. This does not clock them in.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">Employee</span>
                  <select
                    className={inputClass}
                    value={previewEmployeeId}
                    onChange={(event) => setPreviewEmployeeId(event.target.value)}
                  >
                    <option value="">Select an employee</option>
                    {employees.map((row, index) => {
                      const id = readNumber(row, ["id", "employee_id", "employeeId"])
                      if (id === null) return null
                      return (
                        <option key={`${id}-${index}`} value={String(id)}>
                          {employeeLabel(row)}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">From</span>
                  <DatePickerPresets value={dateFrom} onChange={setDateFrom} placeholder="Start date" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">To</span>
                  <DatePickerPresets value={dateTo} onChange={setDateTo} placeholder="End date" />
                </label>
                <button
                  type="button"
                  className={`${secondaryButtonClass} sm:col-span-2`}
                  onClick={() => void onPreview()}
                >
                  Show planned hours
                </button>
              </div>
            </div>
          </div>
          {blockers.length > 0 ? (
            <motion.ul className="grid gap-2" variants={motionPreset.fast}>
              {blockers.map((item, index) => (
                <motion.li
                  key={rowId(item) || index}
                  variants={motionPreset.item}
                  className="border-l-2 border-amber-400 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
                >
                  {readString(item, ["message", "title", "code"], optionLabel(item))}
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search people or activity" />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Employee"
              toolbarStart={
                <TipIcon text="Who can clock in, and what they still need." />
              }
              data={visibleEmployees}
              columns={employeeColumns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey="insights-readiness-employees"
              onRowSelect={(_, row) => row && setReadinessDetail(row)}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Blocked action"
              toolbarStart={
                <TipIcon text="Times someone tried to open a page they do not have permission to use." />
              }
              data={visibleEvents}
              columns={eventColumns}
              loading={false}
              itemsPerPage={20}
              showExport={false}
              storageKey="insights-security-events"
              onRowSelect={(_, row) => row && setEventDetail(row)}
            />
          </div>
        </>
      )}

      <AlertDialog open={clockInDialogOpen} onOpenChange={setClockInDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set up clock-in</AlertDialogTitle>
            <AlertDialogDescription>
              Give this starter set a simple label, then create it. Example: “Office clock-in”. This is not a person or a time — just a name so you can find the rules later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            No clock-in rules yet. People cannot punch in until you create this set.
          </p>
          <label className="mt-3 block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Name for these clock-in rules</span>
            <input
              className={inputClass}
              value={policyName}
              onChange={(event) => setPolicyName(event.target.value)}
              placeholder="Office clock-in"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <button type="button" className={primaryButtonClass} disabled={saving} onClick={() => void onWizard()}>
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Create clock-in rules"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(schedulePreview)} onOpenChange={(open) => !open && setSchedulePreview(null)}>
        <DialogPopup from="bottom" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule</DialogTitle>
            <DialogDescription>
              {employees.find((row) => String(readNumber(row, ["id", "employee_id", "employeeId"])) === previewEmployeeId)
                ? readinessPersonName(
                    employees.find((row) => String(readNumber(row, ["id", "employee_id", "employeeId"])) === previewEmployeeId) as AdminRecord,
                  )
                : "Selected employee"}{" "}
              · {formatDate(dateFrom)} to {formatDate(dateTo)}
            </DialogDescription>
          </DialogHeader>
          {schedulePreviewDays(schedulePreview).length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled days in this range.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
              {schedulePreviewDays(schedulePreview).map((day, index) => {
                const dateLabel = formatDate(day.date ?? day.work_date ?? day.workDate ?? day.day)
                const shift =
                  readString(day, ["shift_name", "shiftName", "shift", "status", "kind", "type"], "")
                const start = readString(day, ["start_time", "startTime", "in", "planned_in"], "")
                const end = readString(day, ["end_time", "endTime", "out", "planned_out"], "")
                const hours =
                  start && end && start !== "-" && end !== "-"
                    ? `${start} – ${end}`
                    : shift && shift !== "-"
                      ? shift
                      : "Off"
                return (
                  <li key={`${dateLabel}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-1.5">
                    <span>{dateLabel === "—" ? `Day ${index + 1}` : dateLabel}</span>
                    <span className="font-medium">{hours}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => setSchedulePreview(null)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={Boolean(readinessDetail)} onOpenChange={(open) => !open && setReadinessDetail(null)}>
        <DialogPopup from="bottom" className="sm:max-w-md">
          {readinessDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>{readinessPersonName(readinessDetail)}</DialogTitle>
                <DialogDescription>
                  {isEmployeeReady(readinessDetail)
                    ? "Ready to clock in."
                    : readinessIssueText(readinessDetail) || "Not ready to clock in yet."}
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-sm">
                {readinessCheckItems(readinessDetail).map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-1.5">
                    <span>{item.label}</span>
                    <span className={item.done ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                      {item.done ? "Done" : "Missing"}
                    </span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => setReadinessDetail(null)}
                >
                  Close
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogPopup>
      </Dialog>

      <Dialog open={Boolean(eventDetail)} onOpenChange={(open) => !open && setEventDetail(null)}>
        <DialogPopup from="bottom" className="sm:max-w-md">
          {eventDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>Access was blocked</DialogTitle>
                <DialogDescription>
                  {describeSecurityEvent(eventDetail, actorNames).who} was stopped from opening something they cannot use.
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-2 text-sm">
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">What they tried</dt>
                  <dd className="mt-0.5 font-medium">{describeSecurityEvent(eventDetail, actorNames).what}</dd>
                </div>
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Why</dt>
                  <dd className="mt-0.5 font-medium">{describeSecurityEvent(eventDetail, actorNames).why}</dd>
                </div>
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">When</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDateTime(describeSecurityEvent(eventDetail, actorNames).whenRaw) === "—"
                      ? "Time not recorded"
                      : formatDateTime(describeSecurityEvent(eventDetail, actorNames).whenRaw)}
                  </dd>
                </div>
              </dl>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => setEventDetail(null)}
                >
                  Close
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogPopup>
      </Dialog>
    </motion.section>
  )
}
