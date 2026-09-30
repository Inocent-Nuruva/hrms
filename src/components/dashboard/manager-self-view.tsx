"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import * as React from "react"
import { RefreshCwIcon } from "lucide-react";
import { SearchToggleField } from "@/components/common/search-toggle-field"
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared"
import {
  HeroBand,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  employeeLabel,
  formatDate,
  inputClass,
  optionLabel,
  prettify,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals"
import {
  getManagerDashboard,
  getManagerTeamMember,
  listManagerActionItems,
  listManagerTeam,
  listManagerTeamAttendance,
  type AdminRecord,
} from "@/lib/admin-api"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard"
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions"
import { readStoredSessionTokens } from "@/lib/session-client"
import { FluentSelect } from "@/components/ui/fluent-select"
import { ResizableTable, type Column } from "@/components/ui/resizable-table"

export type ManagerSelfTab = "overview" | "members" | "attendance" | "actions"

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim()
}

export function ManagerSelfView({ activeTab }: { activeTab: ManagerSelfTab }) {
  const actor = useDashboardActor()
  const leaveIfForbidden = useLeaveIfForbidden()
  const canAccess = canAccessDashboardRoute(
    `/dashboard/me/team/${activeTab}`,
    actor.permissionLabels,
    actor.accessMode,
  )
  useForbiddenRouteGuard(canAccess)
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null)
  const [members, setMembers] = React.useState<AdminRecord[]>([])
  const [attendance, setAttendance] = React.useState<AdminRecord[]>([])
  const [actions, setActions] = React.useState<AdminRecord[]>([])
  const [detail, setDetail] = React.useState<AdminRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [directOnly, setDirectOnly] = React.useState(true)
  const [actionStatus, setActionStatus] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")

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
    if (activeTab === "overview") {
      tasks.push(
        getManagerDashboard(token, {
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        }).then(setDashboard).catch((errorObject) => {
          setDashboard(null)
          throw errorObject
        }),
        listManagerActionItems(token, { limit: 20 }).then(setActions).catch(() => setActions([])),
        listManagerTeam(token, { limit: 20, direct_reports_only: true }).then(setMembers).catch(() => setMembers([])),
      )
    }
    if (activeTab === "members") {
      tasks.push(
        listManagerTeam(token, {
          limit: 50,
          direct_reports_only: directOnly,
        }).then(setMembers).catch((errorObject) => {
          setMembers([])
          throw errorObject
        }),
      )
    }
    if (activeTab === "attendance") {
      tasks.push(
        listManagerTeamAttendance(token, {
          limit: 50,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        }).then(setAttendance).catch((errorObject) => {
          setAttendance([])
          throw errorObject
        }),
      )
    }
    if (activeTab === "actions") {
      tasks.push(
        listManagerActionItems(token, {
          limit: 50,
          ...(actionStatus ? { status: actionStatus } : {}),
        }).then(setActions).catch((errorObject) => {
          setActions([])
          throw errorObject
        }),
      )
    }
    const results = await Promise.allSettled(tasks)
    const first = results.find((result) => result.status === "rejected")
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false)
        return
      }
      setError(first.reason instanceof Error ? first.reason.message : "Could not load manager data.")
    }
    setLoading(false)
  }, [actionStatus, activeTab, dateFrom, dateTo, directOnly, leaveIfForbidden])

  React.useEffect(() => {
    void load()
  }, [load])

  const rows =
    activeTab === "attendance" ? attendance : activeTab === "actions" ? actions : members
  const visible = rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "attendance") {
      return [
        { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
        { key: "date", label: "Date", render: (row) => formatDate(row.date ?? row.attendanceDate ?? row.attendance_date) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status", "attendanceStatus", "attendance_status"], "—")} /> },
        { key: "in", label: "Check in", render: (row) => readString(row, ["checkInAt", "check_in_at", "firstPunch"], "—") },
      ]
    }
    if (activeTab === "actions") {
      return [
        { key: "item", label: "Action", render: (row) => readString(row, ["title", "summary", "name"], `Item #${rowId(row)}`) },
        { key: "module", label: "Module", render: (row) => prettify(readString(row, ["sourceModule", "source_module", "module"], "—")) },
        { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
        { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
      ]
    }
    return [
      { key: "employee", label: "Employee", render: (row) => employeeLabel(row) },
      { key: "position", label: "Position", render: (row) => readString(row, ["positionName", "position_name", "jobTitle", "job_title"], "—") },
      { key: "department", label: "Department", render: (row) => readString(row, ["departmentName", "department_name"], "—") },
      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status", "employmentStatus", "employment_status"], "ACTIVE")} /> },
    ]
  }, [activeTab])

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="My team"
            title="Manager workspace"
            description="Your dashboard, direct reports, and open action items from /api/manager."
            actions={
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
                {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
                Refresh
              </button>
            }
          />
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Team" value={readNumber(dashboard, ["team_count", "teamCount", "direct_reports"]) ?? members.length} />
            <MetricTile label="Open actions" value={readNumber(dashboard, ["open_actions", "openActions", "pending_actions"]) ?? actions.length} />
            <MetricTile label="Present today" value={readNumber(dashboard, ["present_today", "presentToday"]) ?? "—"} />
            <MetricTile label="Exceptions" value={readNumber(dashboard, ["exceptions", "attendance_exceptions"]) ?? "—"} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "members" ? "Team members" : activeTab === "attendance" ? "Team attendance" : "Action items"}
            </h1>
            <p className="text-sm text-muted-foreground">One backend page at a time — filters are sent on the request.</p>
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>
            {loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            Refresh
          </button>
        </div>
      )}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "members" ? <SearchToggleField value={search} onChange={setSearch} placeholder="Search team" /> : null}
            {activeTab === "members" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={directOnly} onChange={(event) => setDirectOnly(event.target.checked)} />
                Direct reports only
              </label>
            ) : null}
            {activeTab === "attendance" ? (
              <>
                <DateInput className={inputClass + " max-w-40"} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                <DateInput className={inputClass + " max-w-40"} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </>
            ) : null}
            {activeTab === "actions" ? (
              <FluentSelect
                ariaLabel="Action status"
                className="max-w-40"
                value={actionStatus}
                placeholder="All statuses"
                onChange={setActionStatus}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "OPEN", label: "Open" },
                  { value: "PENDING", label: "Pending" },
                  { value: "DONE", label: "Done" },
                ]}
              />
            ) : null}
          </div>
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Team records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey={`manager-${activeTab}`}
              onRowSelect={(_, row) => {
                if (!row) return
                setDetail(row)
                const token = readStoredToken()
                const id = rowId(row, ["employeeId", "employee_id"])
                if (token && id && activeTab === "members") {
                  void getManagerTeamMember(token, id).then((record) => record && setDetail(record)).catch(() => undefined)
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)} title={optionLabel(detail) || employeeLabel(detail)} row={detail} />
    </section>
  )
}
