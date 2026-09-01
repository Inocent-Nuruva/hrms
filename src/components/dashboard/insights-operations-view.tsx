"use client"

import * as React from "react"
import { InfoIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { DatePickerPresets } from "@/components/ui/date-picker-presets"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
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
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
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
import {
  isEmployeeReady,
  parseReadinessChecks,
  readinessCheckItems,
  readinessIssueText,
  readinessPersonName,
} from "@/lib/employee-readiness-plain"

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
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [eventDetail, setEventDetail] = React.useState<AdminRecord | null>(null)
  const [readinessDetail, setReadinessDetail] = React.useState<AdminRecord | null>(null)
  const [dateFrom, setDateFrom] = React.useState(() => defaultScheduleRange().from)
  const [dateTo, setDateTo] = React.useState(() => defaultScheduleRange().to)
  const [policyName, setPolicyName] = React.useState("Default attendance policy")
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
        getHrLaunchReadinessEmployees(token).then(setEmployees).catch(() => setEmployees([])),
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
                  ? "This page is under development. You can check system health, create starter clock-in rules, and review blocked actions — some tools are still being finished."
                  : "A snapshot of how the company is doing for the dates you pick."
              }
            />
          </>
        }
        actions={
          <>
            {activeTab !== "readiness" ? (
              <button type="button" className={secondaryButtonClass} onClick={() => void onExport()} disabled={exporting}>
                {exporting ? <Loader2Icon className="size-4 animate-spin" /> : null}
                Export CSV
              </button>
            ) : null}
            <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
              Refresh
            </button>
          </>
        }
      />
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {activeTab !== "readiness" ? (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-500">From</span>
              <DatePickerPresets value={dateFrom} onChange={setDateFrom} placeholder="Pick a date" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">To</span>
              <DatePickerPresets value={dateTo} onChange={setDateTo} placeholder="Pick a date" />
            </label>
          </div>
          <motion.div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" variants={motionPreset.fast}>
            {metrics.length > 0 ? metrics.map((item) => (
              <MetricTile key={item.label} label={item.label} value={item.value} />
            )) : (
              <MetricTile label="Records" value={dashboard ? "Loaded" : "—"} hint="No numeric tiles in this payload." />
            )}
          </motion.div>
          {dashboard ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <button type="button" className="text-sm font-semibold underline-offset-2 hover:underline" onClick={() => setDetail(dashboard)}>
                Open full dashboard payload
              </button>
            </div>
          ) : null}
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
                <TipIcon text="This page is under development. Creating rules here only builds a starter set. Full clock-in setup (devices, maps, shifts) is still being finished under Attendance." />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Give this starter set a simple label, then create it. Example: “Office clock-in”. This is not a person or a time — just a name so you can find the rules later.
              </p>
              {readString(asRecord(setup?.activePolicy), ["name"]) ? (
                <p className="mt-2 text-sm text-foreground">
                  Clock-in rules already exist:{" "}
                  <span className="font-medium">
                    {readString(asRecord(setup?.activePolicy), ["name"])}
                  </span>
                  . Creating the same name again will fail.
                </p>
              ) : (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                  No clock-in rules yet. People cannot punch in until you create this set.
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Name for these clock-in rules</span>
                  <input
                    className={inputClass}
                    value={policyName}
                    onChange={(event) => setPolicyName(event.target.value)}
                    placeholder="Office clock-in"
                  />
                </label>
                <button type="button" className={primaryButtonClass} disabled={saving} onClick={() => void onWizard()}>
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Create clock-in rules"}
                </button>
              </div>
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

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail) || "Details"} row={detail} />

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
