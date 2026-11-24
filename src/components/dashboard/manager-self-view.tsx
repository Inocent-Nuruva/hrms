"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import * as React from "react";
import { RefreshCwIcon } from "lucide-react";
import { SearchToggleField } from "@/components/common/search-toggle-field";
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
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
} from "@/components/dashboard/talent-visuals";
import {
  getManagerDashboard,
  getManagerActivitySummary,
  getManagerTeamMember,
  listManagerActionItems,
  listManagerTeam,
  listManagerTeamAttendance,
  type AdminRecord,
} from "@/lib/admin-api";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";

export type ManagerSelfTab =
  "overview" | "members" | "attendance" | "actions" | "activity-summary";

function formatClock(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

export function ManagerSelfView({ activeTab }: { activeTab: ManagerSelfTab }) {
  const actor = useDashboardActor();
  const leaveIfForbidden = useLeaveIfForbidden();
  const canAccess = canAccessDashboardRoute(
    `/dashboard/me/team/${activeTab}`,
    actor.permissionLabels,
    actor.accessMode,
  );
  useForbiddenRouteGuard(canAccess);
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [members, setMembers] = React.useState<AdminRecord[]>([]);
  const [attendance, setAttendance] = React.useState<AdminRecord[]>([]);
  const [actions, setActions] = React.useState<AdminRecord[]>([]);
  const [detail, setDetail] = React.useState<AdminRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [directOnly, setDirectOnly] = React.useState(true);
  const [actionStatus, setActionStatus] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [summaryPeriodType, setSummaryPeriodType] = React.useState("MONTHLY");
  const [summaryAnchorDate, setSummaryAnchorDate] = React.useState("");
  const [activitySummaryPage, setActivitySummaryPage] = React.useState(1);
  const [activitySummary, setActivitySummary] =
    React.useState<AdminRecord | null>(null);

  React.useEffect(() => {
    setActivitySummaryPage(1);
  }, [summaryPeriodType, summaryAnchorDate]);

  const load = React.useCallback(async () => {
    // Do not make manager API calls until the current access context is ready.
    // A fast 403 during actor hydration can otherwise be treated as a route
    // denial using an empty permission list and redirect the user to Profile.
    if (!actor.ready) return;

    const token = readStoredToken();
    if (!token) {
      setError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const tasks: Array<Promise<unknown>> = [];
    if (activeTab === "overview") {
      tasks.push(
        getManagerDashboard(token, {
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        })
          .then(setDashboard)
          .catch((errorObject) => {
            setDashboard(null);
            throw errorObject;
          }),
        listManagerActionItems(token, { limit: 20 })
          .then(setActions)
          .catch(() => setActions([])),
        listManagerTeam(token, { limit: 20, direct_reports_only: true })
          .then(setMembers)
          .catch(() => setMembers([])),
      );
    }
    if (activeTab === "members") {
      tasks.push(
        listManagerTeam(token, {
          limit: 50,
          direct_reports_only: directOnly,
        })
          .then(setMembers)
          .catch((errorObject) => {
            setMembers([]);
            throw errorObject;
          }),
      );
    }
    if (activeTab === "attendance") {
      tasks.push(
        listManagerTeamAttendance(token, {
          limit: 50,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        })
          .then(setAttendance)
          .catch((errorObject) => {
            setAttendance([]);
            throw errorObject;
          }),
      );
    }
    if (activeTab === "actions") {
      tasks.push(
        listManagerActionItems(token, {
          limit: 50,
          ...(actionStatus ? { status: actionStatus } : {}),
        })
          .then(setActions)
          .catch((errorObject) => {
            setActions([]);
            throw errorObject;
          }),
      );
    }
    if (activeTab === "activity-summary") {
      tasks.push(
        getManagerActivitySummary(token, {
          period_type: summaryPeriodType,
          ...(summaryAnchorDate ? { anchor_date: summaryAnchorDate } : {}),
          page: activitySummaryPage,
          limit: 25,
        })
          .then(setActivitySummary)
          .catch((errorObject) => {
            setActivitySummary(null);
            throw errorObject;
          }),
      );
    }
    const results = await Promise.allSettled(tasks);
    const first = results.find((result) => result.status === "rejected");
    if (first && first.status === "rejected") {
      if (leaveIfForbidden(first.reason)) {
        setLoading(false);
        return;
      }
      setError(
        first.reason instanceof Error
          ? first.reason.message
          : "Could not load manager data.",
      );
    }
    setLoading(false);
  }, [
    actionStatus,
    activeTab,
    activitySummaryPage,
    actor.ready,
    dateFrom,
    dateTo,
    directOnly,
    leaveIfForbidden,
    summaryAnchorDate,
    summaryPeriodType,
  ]);

  React.useEffect(() => {
    if (!actor.ready) return;
    void load();
  }, [actor.ready, load]);

  const activitySummaryRows = Array.isArray(activitySummary?.data)
    ? activitySummary.data.filter(
        (row): row is AdminRecord =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
  const rows =
    activeTab === "attendance"
      ? attendance
      : activeTab === "actions"
        ? actions
        : activeTab === "activity-summary"
          ? activitySummaryRows
          : members;
  const visible = rows.filter(
    (row) =>
      !search ||
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "activity-summary") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) =>
            readString(row, ["employee_name"], employeeLabel(row)),
        },
        {
          key: "submitted",
          label: "Submitted days",
          render: (row) => readNumber(row, ["submitted_days"]) ?? 0,
        },
        {
          key: "missing",
          label: "Missing days",
          render: (row) => readNumber(row, ["missing_days"]) ?? 0,
        },
        {
          key: "approved",
          label: "Approved reports",
          render: (row) => readNumber(row, ["approved_reports"]) ?? 0,
        },
        {
          key: "late",
          label: "Late reports",
          render: (row) => readNumber(row, ["late_reports"]) ?? 0,
        },
        {
          key: "states",
          label: "Report states",
          render: (row) => {
            const counts = row.report_status_counts;
            if (!counts || typeof counts !== "object" || Array.isArray(counts))
              return "—";
            const entries = Object.entries(counts as Record<string, unknown>)
              .filter(([, count]) => typeof count === "number" && count > 0)
              .map(([status, count]) => `${prettify(status)} ${count}`);
            return entries.length ? entries.join(" · ") : "—";
          },
        },
        {
          key: "planned",
          label: "Planned work",
          render: (row) => readNumber(row, ["planned_activities"]) ?? 0,
        },
        {
          key: "completed",
          label: "Completed",
          render: (row) => readNumber(row, ["completed_activities"]) ?? 0,
        },
        {
          key: "rate",
          label: "Completion",
          render: (row) => {
            const rate = readNumber(row, ["completion_rate"]);
            return rate === null ? "—" : `${rate}%`;
          },
        },
      ];
    }
    if (activeTab === "attendance") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => {
            const name = employeeLabel(row);
            const number = readString(row, ["employee_no", "employeeNo"], "");
            const photo = readString(row, ["profile_photo_url"], "");
            const initials = name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("");
            return (
              <div className="flex min-w-0 items-center gap-2.5">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials || "?"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{name}</p>
                  {number ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {number}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          },
        },
        {
          key: "date",
          label: "Date",
          render: (row) =>
            formatDate(row.date ?? row.attendanceDate ?? row.attendance_date),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip
              value={prettify(
                readString(
                  row,
                  ["status", "attendanceStatus", "attendance_status"],
                  "—",
                ),
              )}
            />
          ),
        },
        {
          key: "in",
          label: "Check in",
          render: (row) => formatClock(row.check_in_at ?? row.checkInAt),
        },
        {
          key: "out",
          label: "Check out",
          render: (row) => formatClock(row.check_out_at ?? row.checkOutAt),
        },
        {
          key: "late",
          label: "Late / early",
          render: (row) => {
            const late = readNumber(row, ["late_minutes"]) ?? 0;
            const early = readNumber(row, ["early_departure_minutes"]) ?? 0;
            if (!late && !early)
              return <span className="text-muted-foreground">—</span>;
            return (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {[late ? `${late}m late` : "", early ? `${early}m early` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            );
          },
        },
      ];
    }
    if (activeTab === "actions") {
      return [
        {
          key: "item",
          label: "Action",
          render: (row) =>
            readString(
              row,
              ["title", "summary", "name"],
              `Item #${rowId(row)}`,
            ),
        },
        {
          key: "module",
          label: "Module",
          render: (row) =>
            prettify(
              readString(row, ["sourceModule", "source_module", "module"], "—"),
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "employee",
          label: "Employee",
          render: (row) => employeeLabel(row),
        },
      ];
    }
    return [
      {
        key: "employee",
        label: "Employee",
        render: (row) => employeeLabel(row),
      },
      {
        key: "position",
        label: "Position",
        render: (row) =>
          readString(
            row,
            ["positionName", "position_name", "jobTitle", "job_title"],
            "—",
          ),
      },
      {
        key: "department",
        label: "Department",
        render: (row) =>
          readString(row, ["departmentName", "department_name"], "—"),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip
            value={readString(
              row,
              ["status", "employmentStatus", "employment_status"],
              "ACTIVE",
            )}
          />
        ),
      },
    ];
  }, [activeTab]);

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
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : (
                  <RefreshCwIcon className="size-4" />
                )}
                Refresh
              </button>
            }
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              label="Team"
              value={
                readNumber(dashboard, [
                  "team_count",
                  "teamCount",
                  "direct_reports",
                ]) ?? members.length
              }
            />
            <MetricTile
              label="Open actions"
              value={
                readNumber(dashboard, [
                  "open_actions",
                  "openActions",
                  "pending_actions",
                ]) ?? actions.length
              }
            />
            <MetricTile
              label="Present today"
              value={
                readNumber(dashboard, ["present_today", "presentToday"]) ?? "—"
              }
            />
            <MetricTile
              label="Exceptions"
              value={
                readNumber(dashboard, [
                  "exceptions",
                  "attendance_exceptions",
                ]) ?? "—"
              }
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "members"
                ? "Team members"
                : activeTab === "attendance"
                  ? "Team attendance"
                  : activeTab === "activity-summary"
                    ? "Team activity summary"
                    : "Action items"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "attendance"
                ? "Daily attendance for the people you manage. Pick a date range to narrow it down."
                : "Records for the people you manage."}
            </p>
          </div>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <FluentLoadingIndicator className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </button>
        </div>
      )}

      {activeTab !== "overview" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "members" ? (
              <SearchToggleField
                value={search}
                onChange={setSearch}
                placeholder="Search team"
              />
            ) : null}
            {activeTab === "members" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={directOnly}
                  onChange={(event) => setDirectOnly(event.target.checked)}
                />
                Direct reports only
              </label>
            ) : null}
            {activeTab === "attendance" ? (
              <>
                <DateInput
                  className={inputClass + " max-w-40"}
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
                <DateInput
                  className={inputClass + " max-w-40"}
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </>
            ) : null}
            {activeTab === "activity-summary" ? (
              <>
                <FluentSelect
                  ariaLabel="Summary period"
                  className="max-w-44"
                  value={summaryPeriodType}
                  onChange={setSummaryPeriodType}
                  options={[
                    { value: "WEEKLY", label: "Calendar week" },
                    { value: "MONTHLY", label: "Calendar month" },
                  ]}
                />
                <DateInput
                  className={inputClass + " max-w-40"}
                  value={summaryAnchorDate}
                  onChange={(event) => setSummaryAnchorDate(event.target.value)}
                />
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
          {activeTab === "activity-summary" ? (
            <>
              <p className="text-sm text-muted-foreground">
                {readString(
                  activitySummary?.period as AdminRecord | null,
                  ["date_from"],
                  "",
                )}{" "}
                –{" "}
                {readString(
                  activitySummary?.period as AdminRecord | null,
                  ["date_to"],
                  "",
                )}
                {readString(
                  activitySummary?.period as AdminRecord | null,
                  ["period_type"],
                  "",
                )
                  ? ` · ${prettify(readString(activitySummary?.period as AdminRecord | null, ["period_type"], ""))}`
                  : ""}
                {readString(
                  activitySummary?.period as AdminRecord | null,
                  ["timezone"],
                  "",
                )
                  ? ` · ${readString(activitySummary?.period as AdminRecord | null, ["timezone"], "")}`
                  : ""}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Team members"
                  value={
                    readNumber(activitySummary?.totals as AdminRecord | null, [
                      "team_members",
                    ]) ?? 0
                  }
                />
                <MetricTile
                  label="Eligible days"
                  value={
                    readNumber(activitySummary?.totals as AdminRecord | null, [
                      "eligible_days",
                    ]) ?? 0
                  }
                />
                <MetricTile
                  label="Missing days"
                  value={
                    readNumber(activitySummary?.totals as AdminRecord | null, [
                      "missing_days",
                    ]) ?? 0
                  }
                />
                <MetricTile
                  label="Planned / completed"
                  value={`${readNumber(activitySummary?.totals as AdminRecord | null, ["planned_activities"]) ?? 0} / ${readNumber(activitySummary?.totals as AdminRecord | null, ["completed_activities"]) ?? 0}`}
                />
              </div>
            </>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Team records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={activeTab === "activity-summary" ? 25 : 20}
              showExport={false}
              storageKey={`manager-${activeTab}`}
              onRowSelect={(_, row) => {
                if (!row) return;
                setDetail(row);
                const token = readStoredToken();
                const id = rowId(row, ["employeeId", "employee_id"]);
                if (token && id && activeTab === "members") {
                  void getManagerTeamMember(token, id)
                    .then((record) => record && setDetail(record))
                    .catch(() => undefined);
                }
              }}
            />
          </div>
          {activeTab === "activity-summary" ? (
            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                Page{" "}
                {readNumber(activitySummary?.pagination as AdminRecord | null, [
                  "page",
                ]) ?? 1}
                {" of "}
                {readNumber(activitySummary?.pagination as AdminRecord | null, [
                  "total_pages",
                ]) ?? 0}
                {" · "}
                {readNumber(activitySummary?.pagination as AdminRecord | null, [
                  "total",
                ]) ?? 0}{" "}
                team members
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={activitySummaryPage <= 1 || loading}
                  onClick={() =>
                    setActivitySummaryPage((page) => Math.max(1, page - 1))
                  }
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={
                    activitySummaryPage >=
                      (readNumber(
                        activitySummary?.pagination as AdminRecord | null,
                        ["total_pages"],
                      ) ?? 0) || loading
                  }
                  onClick={() => setActivitySummaryPage((page) => page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={optionLabel(detail) || employeeLabel(detail)}
        row={detail}
      />
    </section>
  );
}
