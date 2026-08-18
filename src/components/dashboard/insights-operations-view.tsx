"use client"

import * as React from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  asRecordArray,
  employeeLabel,
  formatDate,
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

export type InsightsOpsTab = "hr" | "management" | "manager" | "sales-field" | "readiness"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
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
  const [setup, setSetup] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [policyName, setPolicyName] = React.useState("Default attendance policy")
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [previewEmployeeId, setPreviewEmployeeId] = React.useState("")

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

  async function onWizard() {
    const token = readStoredToken()
    if (!token) return
    if (!policyName.trim()) {
      toast.error("Policy name is required.")
      return
    }
    setSaving(true)
    try {
      await runHrAttendanceSetupWizard(token, { policy: { name: policyName.trim() } })
      toast.success("Attendance setup wizard started.")
      await load()
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Wizard failed.")
    } finally {
      setSaving(false)
    }
  }

  async function onPreview() {
    const token = readStoredToken()
    if (!token || !previewEmployeeId) {
      toast.error("Employee id is required for a schedule preview.")
      return
    }
    try {
      const record = await getHrAttendanceSchedulePreview(token, {
        employee_id: Number(previewEmployeeId),
        ...(dateFrom ? { from_date: dateFrom } : {}),
        ...(dateTo ? { to_date: dateTo } : {}),
      })
      setDetail(record)
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Preview failed.")
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
    { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
    { key: "shift", label: "Shift", render: (row) => <StatusChip value={readString(row, ["shiftReady", "shift_ready", "hasShift", "has_shift"], "—")} /> },
    { key: "device", label: "Device", render: (row) => <StatusChip value={readString(row, ["deviceReady", "device_ready", "hasDevice", "has_device"], "—")} /> },
    { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status", "readiness", "ready"], "PENDING")} /> },
  ], [])

  const eventColumns = React.useMemo<Column<AdminRecord>[]>(() => [
    { key: "type", label: "Event", render: (row) => prettify(readString(row, ["eventType", "event_type", "type"], "Event")) },
    { key: "outcome", label: "Outcome", render: (row) => <StatusChip value={readString(row, ["outcome", "status"], "—")} /> },
    { key: "when", label: "When", render: (row) => formatDate(row.createdAt ?? row.created_at ?? row.occurredAt) },
    { key: "request", label: "Request", render: (row) => readString(row, ["requestId", "request_id"], "—") },
  ], [])

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
        eyebrow={embedded ? "Home" : "Insights"}
        title={
          activeTab === "readiness"
            ? "Launch readiness"
            : activeTab === "sales-field"
              ? "Sales-field dashboard"
              : `${prettify(activeTab)} dashboard`
        }
        description={
          activeTab === "readiness"
            ? "Health, launch blockers, attendance setup, and security events — one backend page each."
            : "Company dashboard payload from /api/dashboards. Shown only with a dashboards grant."
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
          <div className="flex flex-wrap gap-2">
            <input type="date" className={inputClass + " max-w-40"} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input type="date" className={inputClass + " max-w-40"} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
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
            <MetricTile label="Health" value={readString(health, ["status", "state"], health ? "OK" : "—")} />
            <MetricTile label="Live" value={readString(live, ["status", "state"], live ? "OK" : "—")} />
            <MetricTile label="Ready" value={readString(ready, ["status", "state"], ready ? "OK" : "—")} />
            <MetricTile label="Blockers" value={readNumber(readiness, ["blockerCount", "blocker_count", "blockers"]) ?? blockers.length} />
          </motion.div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Attendance setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {readString(setup, ["status", "message", "summary"], "Run the documented wizard with a policy name.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className={inputClass + " max-w-xs"} value={policyName} onChange={(event) => setPolicyName(event.target.value)} />
              <button type="button" className={primaryButtonClass} disabled={saving} onClick={() => void onWizard()}>
                {saving ? <Loader2Icon className="size-4 animate-spin" /> : "Run wizard"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className={inputClass + " max-w-[8rem]"} placeholder="Employee id" value={previewEmployeeId} onChange={(event) => setPreviewEmployeeId(event.target.value)} />
              <input type="date" className={inputClass + " max-w-40"} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <input type="date" className={inputClass + " max-w-40"} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              <button type="button" className={secondaryButtonClass} onClick={() => void onPreview()}>Preview schedule</button>
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
          <SearchToggleField value={search} onChange={setSearch} placeholder="Search employees or events" />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Employee readiness"
              data={visibleEmployees}
              columns={employeeColumns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey="insights-readiness-employees"
              onRowSelect={(_, row) => row && setDetail(row)}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Security events"
              data={visibleEvents}
              columns={eventColumns}
              loading={false}
              itemsPerPage={20}
              showExport={false}
              storageKey="insights-security-events"
              onRowSelect={(_, row) => row && setDetail(row)}
            />
          </div>
        </>
      )}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail) || "Details"} row={detail} />
    </motion.section>
  )
}
