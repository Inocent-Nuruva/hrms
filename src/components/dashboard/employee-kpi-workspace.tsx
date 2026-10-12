"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import Link from "next/link";
import { Badge, Button as FluentButton, Input as FluentInput, ProgressBar } from "@fluentui/react-components";
import {
  CheckIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Filter24Regular, Search20Regular, Target20Regular as KpiIcon } from "@fluentui/react-icons";
import { toast } from "@/components/ui/fluent-toast-store";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import {
  StatusChip,
  actionButtonClass,
  asRecord,
  employeeLabel,
  formatDate,
  inputClass,
  isPermissionError,
  optionLabel,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  createMyEmployeeKpi,
  createManagerEmployeeKpi,
  deleteMyEmployeeKpi,
  listManagerEmployeeKpis,
  listManagerKpiAssignees,
  listPerformancePeriods,
  listMyEmployeeKpis,
  listMyPerformanceAssignments,
  reviewManagerEmployeeKpi,
  submitMyEmployeeKpis,
  updateMyEmployeeKpi,
  updateMyEmployeeKpiActual,
  type AdminRecord,
} from "@/lib/admin-api";
import {
  canProposeEmployeeKpis,
  collectEmployeeKpiPeriods,
  employeeKpiPeriodId,
  firstWritableEmployeeKpiPeriod,
} from "@/lib/employee-kpi-periods";
import { forgetForbiddenRoute } from "@/lib/forbidden-routes";
import { readStoredSessionTokens } from "@/lib/session-client";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { KpiCycleReviewPanel } from "@/components/dashboard/kpi-cycle-review-panel";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";

type WorkspaceMode = "self" | "manager";
type DialogMode = "create" | "edit" | "actual" | "review";

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function periodOf(row: AdminRecord) {
  return asRecord(row.performancePeriod ?? row.performance_period);
}

function progressOf(row: AdminRecord) {
  return asRecord(row.progress);
}

export function EmployeeKpiWorkspace({ mode }: { mode: WorkspaceMode }) {
  const actor = useDashboardActor();
  const canManagePerformance = canAccessDashboardRoute(
    "/dashboard/performance/setup",
    actor.permissionLabels,
    actor.accessMode,
  );
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [periods, setPeriods] = React.useState<AdminRecord[]>([]);
  const [employees, setEmployees] = React.useState<AdminRecord[]>([]);
  const [periodId, setPeriodId] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [reviewRefresh, setReviewRefresh] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("create");
  const [selected, setSelected] = React.useState<AdminRecord | null>(null);
  const [form, setForm] = React.useState<Record<string, string>>({
    measurement_type: "PERCENTAGE",
    progress_source: "MANUAL",
  });

  const load = React.useCallback(async () => {
    const accessToken = token();
    if (!accessToken) {
      setError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "manager") {
        const [kpis, team, availablePeriods] = await Promise.all([
          listManagerEmployeeKpis(accessToken, { limit: 100 }),
          listManagerKpiAssignees(accessToken),
          listPerformancePeriods(accessToken),
        ]);
        setRows(kpis);
        setEmployees(team);
        setPeriods(
          availablePeriods.filter(canProposeEmployeeKpis),
        );
      } else {
        const [kpis, assignments] = await Promise.all([
          listMyEmployeeKpis(accessToken),
          listMyPerformanceAssignments(accessToken),
        ]);
        const allPeriods = collectEmployeeKpiPeriods([...assignments, ...kpis]);
        setRows(kpis);
        setPeriods(allPeriods);
        const writablePeriod = firstWritableEmployeeKpiPeriod(allPeriods);
        setPeriodId(
          (current) =>
            current ||
            employeeKpiPeriodId(writablePeriod) ||
            employeeKpiPeriodId(allPeriods[0]) ||
            "",
        );
      }
    } catch (cause) {
      setError(
        isPermissionError(cause)
          ? "Your account does not have permission to view this KPI workflow. Ask an administrator to grant the required performance KPI permissions."
          : cause instanceof Error
            ? cause.message
            : "Could not load KPIs.",
      );
    } finally {
      setLoading(false);
      setReviewRefresh((current) => current + 1);
    }
  }, [mode]);

  React.useEffect(() => {
    forgetForbiddenRoute("/dashboard/me/performance/kpis");
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = React.useMemo(
    () =>
      periodId
        ? rows.filter(
            (row) =>
              String(
                readNumber(row, [
                  "performancePeriodId",
                  "performance_period_id",
                ]) ?? "",
              ) === periodId,
          )
        : rows,
    [periodId, rows],
  );
  const displayedRows = React.useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    if (!query) return visibleRows;
    return visibleRows.filter((row) =>
      [readString(row, ["title"]), readString(row, ["description"]), readString(row, ["status"]), readString(row, ["unit"])]
        .some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [searchTerm, visibleRows]);
  const totalWeight = visibleRows
    .filter((row) => readString(row, ["status"]) !== "REJECTED")
    .reduce((sum, row) => sum + (readNumber(row, ["weight"]) ?? 0), 0);
  const overallScore = visibleRows.reduce(
    (sum, row) =>
      sum +
      (readNumber(progressOf(row), [
        "weightedContribution",
        "weighted_contribution",
      ]) ?? 0),
    0,
  );

  const selectedPeriod =
    periods.find((period) => employeeKpiPeriodId(period) === periodId) ?? null;
  const writablePeriod =
    (canProposeEmployeeKpis(selectedPeriod) ? selectedPeriod : null) ??
    firstWritableEmployeeKpiPeriod(periods);
  const canCreateKpi = Boolean(writablePeriod);
  const unavailableReason =
    periods.length === 0
      ? "No performance period is linked to your KPI workspace yet. Performance management must open a cycle and assign your performance plan before you can propose KPIs."
      : "None of your assigned performance periods is accepting KPI proposals right now.";

  function showCreate() {
    const nextPeriodId =
      mode === "manager"
        ? employeeKpiPeriodId(periods[0])
        : employeeKpiPeriodId(writablePeriod) || periodId;
    if (nextPeriodId && nextPeriodId !== periodId) {
      setPeriodId(nextPeriodId);
    }
    setSelected(null);
    setDialogMode("create");
    setForm({
      performance_period_id: nextPeriodId,
      employee_id: "",
      measurement_type: "PERCENTAGE",
      progress_source: "MANUAL",
      scoring_type: "NUMERIC_TARGET",
      measurement_direction: "HIGHER_IS_BETTER",
      weight: "",
      target_value: "",
      start_date: "",
      due_date: "",
      unit: "%",
    });
    setOpen(true);
  }

  function showEdit(row: AdminRecord) {
    setSelected(row);
    setDialogMode("edit");
    setForm({
      title: readString(row, ["title"]),
      description: readString(row, ["description"]),
      measurement_type: readString(
        row,
        ["measurementType", "measurement_type"],
        "PERCENTAGE",
      ),
      target_value: readString(row, ["targetValue", "target_value"]),
      unit: readString(row, ["unit"]),
      weight: readString(row, ["weight"]),
      start_date: readString(row, ["startDate", "start_date"]),
      due_date: readString(row, ["dueDate", "due_date"]),
      progress_source: readString(
        row,
        ["progressSource", "progress_source"],
        "MANUAL",
      ),
      scoring_type: readString(row, ["scoringType", "scoring_type"], "NUMERIC_TARGET"),
      measurement_direction: readString(row, ["measurementDirection", "measurement_direction"], "HIGHER_IS_BETTER"),
    });
    setOpen(true);
  }

  function showActual(row: AdminRecord) {
    setSelected(row);
    setDialogMode("actual");
    setForm({ actual_value: readString(row, ["actualValue", "actual_value"]) });
    setOpen(true);
  }

  function showReview(
    row: AdminRecord,
    decision: "APPROVE" | "RETURN" | "REJECT",
  ) {
    setSelected(row);
    setDialogMode("review");
    setForm({ decision, comment: "" });
    setOpen(true);
  }

  async function save() {
    const accessToken = token();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      if (dialogMode === "review") {
        const id = rowId(selected ?? {});
        if (!id) throw new Error("KPI is missing.");
        if (form.decision !== "APPROVE" && !form.comment?.trim()) {
          throw new Error(
            "A comment is required when returning or rejecting a KPI.",
          );
        }
        await reviewManagerEmployeeKpi(
          accessToken,
          id,
          form.decision as "APPROVE" | "RETURN" | "REJECT",
          form.comment || undefined,
        );
        toast.success(`KPI ${form.decision.toLowerCase()}.`);
      } else if (dialogMode === "actual") {
        const id = rowId(selected ?? {});
        if (!id || form.actual_value === "")
          throw new Error("Enter an actual value.");
        await updateMyEmployeeKpiActual(
          accessToken,
          id,
          Number(form.actual_value),
        );
        toast.success("KPI progress updated.");
      } else {
        if (
          !form.title?.trim() ||
          !form.description?.trim() ||
          !form.due_date ||
          !form.weight
        ) {
          throw new Error(
            "Title, description, due date, and weight are required.",
          );
        }
        const payload: AdminRecord = {
          performance_period_id: Number(form.performance_period_id || periodId),
          title: form.title.trim(),
          description: form.description.trim(),
          measurement_type: form.measurement_type,
          target_value:
            form.target_value === "" ? undefined : Number(form.target_value),
          unit: form.unit || undefined,
          weight: Number(form.weight),
          start_date: form.start_date || undefined,
          due_date: form.due_date,
          progress_source: form.progress_source,
          scoring_type: form.scoring_type || "NUMERIC_TARGET",
          measurement_direction: form.measurement_direction || "HIGHER_IS_BETTER",
          formula_config: form.scoring_type === "MIXED" ? { numeric_share: Number(form.numeric_share || 0.5) } : form.scoring_type === "MILESTONE" ? { total_milestones: Number(form.total_milestones || form.target_value || 1) } : undefined,
        };
        const id = rowId(selected ?? {});
        if (dialogMode === "create" && mode === "manager") {
          if (!form.employee_id) throw new Error("Choose an employee.");
          await createManagerEmployeeKpi(accessToken, {
            ...payload,
            employee_id: Number(form.employee_id),
          });
          toast.success("KPI assigned and submitted for approval.");
        } else if (dialogMode === "edit" && id) {
          delete payload.performance_period_id;
          await updateMyEmployeeKpi(accessToken, id, payload);
          toast.success("KPI updated.");
        } else {
          await createMyEmployeeKpi(accessToken, payload);
          toast.success("KPI draft created.");
        }
      }
      setOpen(false);
      await load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not save KPI.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitPeriod() {
    const accessToken = token();
    if (!accessToken || !periodId) return;
    setSaving(true);
    try {
      await submitMyEmployeeKpis(accessToken, periodId);
      toast.success("KPI set submitted to your manager.");
      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not submit KPIs.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeKpi(row: AdminRecord) {
    const id = rowId(row);
    if (
      !id ||
      !window.confirm(`Delete KPI ${readString(row, ["title"], `#${id}`)}?`)
    )
      return;
    const accessToken = token();
    if (!accessToken) return;
    setSaving(true);
    try {
      await deleteMyEmployeeKpi(accessToken, id);
      toast.success("KPI deleted.");
      await load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not delete KPI.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    const base: Column<AdminRecord>[] = [
      ...(mode === "manager"
        ? [
            {
              key: "employee",
              label: "Employee",
              render: (row: AdminRecord) =>
                employeeLabel(row.employee as AdminRecord),
            },
          ]
        : []),
      {
        key: "kpi",
        label: "KPI",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(row, ["title"], `KPI #${rowId(row)}`)}
            </p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {readString(row, ["description"])}
            </p>
          </div>
        ),
      },
      {
        key: "period",
        label: "Period",
        render: (row) => optionLabel(periodOf(row) ?? row),
      },
      {
        key: "target",
        label: "Target / weight",
        render: (row) =>
          `${readString(row, ["targetValue", "target_value"], "Manual")} ${readString(row, ["unit"])} · ${readString(row, ["weight"])}%`,
      },
      {
        key: "progress",
        label: "Progress",
        render: (row) => {
          const progress = progressOf(row);
          return progress
            ? `${readString(progress, ["achievementPercent"], "—")}%`
            : "—";
        },
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "DRAFT")} />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const status = readString(row, ["status"]);
          if (mode === "manager") {
            const reviewable = [
              "SUBMITTED",
              "RESUBMITTED",
              "PENDING_REVIEW",
            ].includes(status);
            return reviewable ? (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showReview(row, "APPROVE");
                  }}
                >
                  <CheckIcon className="size-3.5" /> Approve
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showReview(row, "RETURN");
                  }}
                >
                  <RotateCcwIcon className="size-3.5" /> Return
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showReview(row, "REJECT");
                  }}
                >
                  <XIcon className="size-3.5" /> Reject
                </button>
              </div>
            ) : null;
          }
          if (["DRAFT", "RETURNED"].includes(status)) {
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showEdit(row);
                  }}
                >
                  Edit
                </button>
                {mode === "self" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeKpi(row);
                    }}
                    disabled={saving}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            );
          }
          if (status === "APPROVED") {
            return (
              <div className="flex flex-wrap gap-1">
                {readString(row, ["progressSource", "progress_source"]) === "MANUAL" ? <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    showActual(row);
                  }}
                >
                  Update actual
                </button> : null}
                <Link className={actionButtonClass} href={`/dashboard/me/activities/today?create=1&kpi=${encodeURIComponent(rowId(row))}`} onClick={(event) => event.stopPropagation()}>
                  Add linked activity
                </Link>
              </div>
            );
          }
          return null;
        },
      },
    ];
    return base;
  }, [mode]);

  return (
    <section className="space-y-5 pt-4">
      {mode === "self" ? (
        <>
          <header className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
                {periods.length > 0 ? <FluentButton className="justify-center" appearance="primary" icon={<PlusIcon className="size-4" />} onClick={showCreate} disabled={!canCreateKpi || loading} title={!canCreateKpi ? unavailableReason : undefined} aria-describedby={!canCreateKpi && !loading ? "kpi-create-unavailable" : undefined}>New KPI</FluentButton> : null}
                {periods.length > 0 ? <FluentButton className="justify-center" appearance="secondary" onClick={() => void submitPeriod()} disabled={!periodId || saving || totalWeight !== 100 || visibleRows.length === 0}>Submit set · {totalWeight}%</FluentButton> : null}
                <div className="flex items-center gap-1">
                  <Popover>
                  <PopoverTrigger className="inline-flex items-center justify-center p-1 text-muted-foreground transition-colors hover:text-primary" aria-label="Filter KPIs" title="Filter KPIs">
                    <Filter24Regular className="size-5" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] space-y-4 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Filter KPIs</p>
                      <p className="mt-1 text-xs text-muted-foreground">Search goals or choose a performance period.</p>
                    </div>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      Search
                      <FluentInput className="w-full" contentBefore={<Search20Regular className="block size-5" aria-hidden="true" />} placeholder="Search KPIs" aria-label="Search KPIs" value={searchTerm} onChange={(event) => setSearchTerm(event.currentTarget.value)} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                      Performance period
                      <FluentSelect ariaLabel="Performance period" className="w-full" value={periodId} onChange={setPeriodId} disabled={!periods.length} placeholder={periods.length ? "All periods" : "No periods assigned"} options={[...(periods.length ? [{ value: "", label: "All periods" }] : []), ...periods.map((period) => ({ value: rowId(period), label: `${optionLabel(period)} · ${readString(period, ["status"])}` }))]} />
                    </label>
                  </PopoverContent>
                  </Popover>
                  <FluentButton className="!min-w-0 !p-1" appearance="subtle" icon={loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />} onClick={() => void load()} disabled={loading} aria-label="Refresh KPIs" title="Refresh KPIs" />
                </div>
            </div>
          </header>

          {periods.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm">
            <p className="text-muted-foreground"><span className="font-semibold text-foreground">Workflow</span><span className="mx-2 text-primary">Set goals → get approval → link activities → track results</span></p>
            <Link href="/dashboard/me/activities/today" className="text-sm font-semibold text-primary hover:underline">Open my activities</Link>
          </div> : null}

          {error ? <p role="alert" className="border-l-2 border-rose-500 py-2 pl-3 text-sm text-rose-700">{error}</p> : null}
          {selectedPeriod && readString(selectedPeriod, ["kpiPhase", "kpi_phase"]) === "REOPENED" ? <p className="border-l-2 border-amber-500 py-2 pl-3 text-sm text-amber-900">This KPI cycle was reopened. {readString(selectedPeriod, ["kpiReopenReason", "kpi_reopen_reason"])}</p> : null}

          {!loading && !error && periods.length > 0 && !canCreateKpi ? (
            <div id="kpi-create-unavailable" className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4 text-sm">
              <p className="text-muted-foreground">{unavailableReason}</p>
              {canManagePerformance ? <Link href="/dashboard/performance/setup" className="font-semibold text-primary hover:underline">Open performance setup</Link> : null}
            </div>
          ) : null}

          {!loading && !error && periods.length === 0 ? (
            <section className="border-y border-border py-8">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <KpiIcon className="size-6 text-primary" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-foreground">Start by setting up your KPI cycle</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  A performance cycle and KPI plan need to be assigned to you before you can create goals or see cycle reviews. Ask your manager or HR to open a cycle and assign your plan; it will then appear here.
                </p>
                <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                  <li className="border-l-2 border-primary pl-3"><span className="block font-semibold text-foreground">1. Open a cycle</span><span className="text-muted-foreground">Manager or HR sets the review period.</span></li>
                  <li className="border-l-2 border-border pl-3"><span className="block font-semibold text-foreground">2. Assign your plan</span><span className="text-muted-foreground">Your KPI period becomes available here.</span></li>
                  <li className="border-l-2 border-border pl-3"><span className="block font-semibold text-foreground">3. Set goals and track work</span><span className="text-muted-foreground">Create KPIs, link activities, and review progress.</span></li>
                </ol>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {canManagePerformance ? <Link href="/dashboard/performance/setup" className={primaryButtonClass}>Open performance setup</Link> : <span className="text-sm font-medium text-muted-foreground">Your manager or HR can open performance setup and assign your plan.</span>}
                  <Link href="/dashboard/me/activities/today" className={secondaryButtonClass}>Open my activities</Link>
                </div>
              </div>
            </section>
          ) : null}

          {periodId ? <div className="grid gap-0 border-y border-border sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Weight allocated", value: `${totalWeight}%`, detail: "Target is 100%" },
              { label: "KPIs in this cycle", value: visibleRows.length, detail: "Goals assigned or proposed" },
              { label: "Submission", value: totalWeight === 100 && visibleRows.length > 0 ? "Ready" : "In progress", detail: "Requires exactly 100% weight" },
              { label: "Weighted progress", value: `${overallScore.toFixed(1)}%`, detail: "Based on recorded actuals" },
            ].map((metric) => <div key={metric.label} className="border-b border-border px-3 py-3 last:border-b-0 sm:px-5 xl:border-b-0 xl:border-r xl:last:border-r-0">
              <p className="text-sm font-semibold text-foreground">{metric.label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
            </div>)}
          </div> : null}

          {periods.length > 0 ? <section className="border-t border-border pt-2">
            <div className="flex flex-wrap items-end justify-between gap-3 px-1 py-3">
              <div><h2 className="text-base font-semibold text-foreground">Goals for this cycle</h2><p className="mt-0.5 text-xs text-muted-foreground">Targets, current progress, and linked work.</p></div>
              {selectedPeriod ? <Badge appearance="tint" color="brand">{optionLabel(selectedPeriod)}</Badge> : null}
            </div>
            {displayedRows.length ? <div className="divide-y divide-border">
              {displayedRows.map((row) => {
                const status = readString(row, ["status"], "DRAFT").toUpperCase()
                const progress = progressOf(row)
                const achievement = readNumber(progress, ["achievementPercent", "achievement_percent"])
                const actual = readString(progress, ["actualValue", "actual_value"], readString(row, ["actualValue", "actual_value"], "—"))
                const target = readString(row, ["targetValue", "target_value"], "Manual")
                const unit = readString(row, ["unit"])
                return <article key={rowId(row)} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><KpiIcon className="size-4 shrink-0 text-muted-foreground" /><h3 className="min-w-0 text-sm font-semibold text-foreground">{readString(row, ["title"], `KPI #${rowId(row)}`)}</h3><Badge appearance="tint" color={status === "APPROVED" ? "success" : status === "REJECTED" ? "danger" : status === "RETURNED" ? "warning" : "informative"}>{status.replaceAll("_", " ")}</Badge></div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{readString(row, ["description"], "No description provided.")}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Target <span className="font-semibold text-foreground">{target} {unit}</span><span className="mx-2">·</span>Weight <span className="font-semibold text-foreground">{readString(row, ["weight"], "0")}%</span><span className="mx-2">·</span>Due {formatDate(row.dueDate ?? row.due_date)}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">Progress</span><span className="font-semibold tabular-nums text-foreground">{achievement === null ? "Not started" : `${Math.round(achievement)}%`}</span></div>
                    <ProgressBar value={achievement === null ? 0 : Math.min(1, Math.max(0, achievement / 100))} thickness="medium" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Actual {actual}{unit ? ` ${unit}` : ""} of {target}{unit ? ` ${unit}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 lg:justify-end">
                    {["DRAFT", "RETURNED"].includes(status) ? <>
                      <FluentButton appearance="subtle" size="small" onClick={() => showEdit(row)}>Edit</FluentButton>
                      <FluentButton appearance="subtle" size="small" disabled={saving} onClick={() => void removeKpi(row)}>Delete</FluentButton>
                    </> : null}
                    {status === "APPROVED" ? <>
                      {readString(row, ["progressSource", "progress_source"]) === "MANUAL" ? <FluentButton appearance="subtle" size="small" onClick={() => showActual(row)}>Update actual</FluentButton> : null}
                      <Link className={actionButtonClass} href={`/dashboard/me/activities/today?create=1&kpi=${encodeURIComponent(rowId(row))}`}>Add linked activity</Link>
                    </> : null}
                  </div>
                </article>
              })}
            </div> : !loading ? <div className="flex flex-col items-center border-y border-border px-4 py-10 text-center">
              <KpiIcon className="size-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-foreground">No KPIs in this cycle yet</h3>
              <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">Create a measurable goal for this period. Once approved, you can link activities and track progress here.</p>
              <FluentButton appearance="primary" icon={<PlusIcon className="size-4" />} className="mt-4" onClick={showCreate} disabled={!canCreateKpi}>Create a KPI</FluentButton>
            </div> : null}
          </section> : null}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-xl font-semibold tracking-tight">KPI reviews</h1><p className="text-sm text-muted-foreground">Review KPI proposals from employees in your reporting scope.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={primaryButtonClass} onClick={showCreate} disabled={!periods.length || !employees.length || loading}><PlusIcon className="size-4" /> Assign KPI</button>
              <button type="button" className={secondaryButtonClass} onClick={() => void load()} disabled={loading}>{loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />} Refresh</button>
            </div>
          </div>
          {error ? <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <div className="overflow-hidden border border-border bg-card"><ResizableTable title="Team KPI proposals" data={rows} columns={columns} loading={loading} itemsPerPage={20} showExport={false} storageKey={`employee-kpis-${mode}`} /></div>
        </>
      )}
      {mode === "manager" || periods.length > 0 ? <KpiCycleReviewPanel mode={mode} periodId={periodId} refreshKey={reviewRefresh} /> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "review"
                ? `${form.decision} KPI`
                : dialogMode === "actual"
                  ? "Update KPI actual"
                  : dialogMode === "edit"
                    ? "Edit KPI"
                    : mode === "manager"
                      ? "Assign KPI"
                      : "Create KPI"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "review"
                ? readString(selected ?? {}, ["title"])
                : "Drafts can be saved below 100%; the complete period set is validated when submitted."}
            </DialogDescription>
          </DialogHeader>
          {dialogMode === "review" ? (
            <div className="grid gap-4 text-sm">
              <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-muted-foreground">
                    Employee
                  </span>
                  <p className="font-medium">
                    {employeeLabel(selected?.employee as AdminRecord)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Period</span>
                  <p className="font-medium">
                    {optionLabel(periodOf(selected ?? {}) ?? {})}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Measurement
                  </span>
                  <p className="font-medium">
                    {readString(selected ?? {}, [
                      "measurementType",
                      "measurement_type",
                    ])}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Target</span>
                  <p className="font-medium">
                    {readString(
                      selected ?? {},
                      ["targetValue", "target_value"],
                      "Manual",
                    )}{" "}
                    {readString(selected ?? {}, ["unit"])}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Weight</span>
                  <p className="font-medium">
                    {readString(selected ?? {}, ["weight"])}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">
                    Due date
                  </span>
                  <p className="font-medium">
                    {formatDate(selected?.dueDate ?? selected?.due_date)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    Description
                  </span>
                  <p className="whitespace-pre-wrap">
                    {readString(selected ?? {}, ["description"])}
                  </p>
                </div>
                {readString(selected ?? {}, [
                  "reviewComment",
                  "review_comment",
                ]) ? (
                  <div className="sm:col-span-2">
                    <span className="text-xs text-muted-foreground">
                      Previous review comment
                    </span>
                    <p className="whitespace-pre-wrap">
                      {readString(selected ?? {}, [
                        "reviewComment",
                        "review_comment",
                      ])}
                    </p>
                  </div>
                ) : null}
              </div>
              <label className="grid gap-1.5">
                <span className="font-medium">
                  Comment{" "}
                  {form.decision === "APPROVE" ? "(optional)" : "(required)"}
                </span>
                <Textarea
                  className={textareaClass}
                  value={form.comment ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      comment: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          ) : dialogMode === "actual" ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Actual value</span>
              <input
                className={inputClass}
                type="number"
                value={form.actual_value ?? ""}
                onChange={(event) =>
                  setForm({ actual_value: event.target.value })
                }
              />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {dialogMode === "create" && mode === "manager" ? (
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Employee</span>
                  <FluentSelect
                    ariaLabel="Employee"
                    className="w-full"
                    value={form.employee_id ?? ""}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, employee_id: value }))
                    }
                    options={[
                      { value: "", label: "Select employee" },
                      ...employees.map((employee) => ({
                        value: rowId(employee),
                        label: employeeLabel(employee),
                      })),
                    ]}
                  />
                </label>
              ) : null}
              {dialogMode === "create" ? (
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Period</span>
                  <FluentSelect
                    ariaLabel="Period"
                    className="w-full"
                    value={form.performance_period_id ?? ""}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        performance_period_id: value,
                      }))
                    }
                    options={(mode === "manager"
                      ? periods
                      : periods.filter(canProposeEmployeeKpis)
                    ).map((period) => ({
                      value: employeeKpiPeriodId(period),
                      label: `${optionLabel(period)}${
                        readString(period, ["status"])
                          ? ` · ${readString(period, ["status"])}`
                          : ""
                      }`,
                    }))}
                  />
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium">Title</span>
                <input
                  className={inputClass}
                  value={form.title ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium">Description</span>
                <Textarea
                  className={textareaClass}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Measurement</span>
                <FluentSelect
                  ariaLabel="Measurement"
                  className="w-full"
                  value={form.measurement_type}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      measurement_type: value,
                    }))
                  }
                  options={[
                    "NUMBER",
                    "PERCENTAGE",
                    "CURRENCY",
                    "BOOLEAN",
                    "RATING",
                    "MANUAL",
                  ].map((value) => ({ value, label: value }))}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Progress source</span>
                <FluentSelect
                  ariaLabel="Progress source"
                  className="w-full"
                  value={form.progress_source}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      progress_source: value,
                    }))
                  }
                  options={[
                    { value: "MANUAL", label: "Manual actual" },
                    {
                      value: "APPROVED_ACTIVITIES",
                      label: "Approved activities",
                    },
                    { value: "SYSTEM", label: "System" },
                  ]}
                />
              </label>
              <label className="grid gap-1.5 text-sm"><span className="font-medium">Scoring method</span><FluentSelect ariaLabel="Scoring method" value={form.scoring_type || "NUMERIC_TARGET"} onChange={(value) => setForm((current) => ({ ...current, scoring_type: value }))} options={[{ value: "NUMERIC_TARGET", label: "Numeric target" }, { value: "RATING_SCALE", label: "Manager rating" }, { value: "MILESTONE", label: "Milestones" }, { value: "MIXED", label: "Numeric and rating" }]} /></label>
              {form.scoring_type === "NUMERIC_TARGET" || form.scoring_type === "MIXED" ? <label className="grid gap-1.5 text-sm"><span className="font-medium">Target direction</span><FluentSelect ariaLabel="Target direction" value={form.measurement_direction || "HIGHER_IS_BETTER"} onChange={(value) => setForm((current) => ({ ...current, measurement_direction: value }))} options={[{ value: "HIGHER_IS_BETTER", label: "Higher is better" }, { value: "LOWER_IS_BETTER", label: "Lower is better" }, { value: "TARGET_MATCH", label: "Exact target" }]} /></label> : null}
              {form.scoring_type === "MIXED" ? <label className="grid gap-1.5 text-sm"><span className="font-medium">Numeric share (0–1)</span><input className={inputClass} type="number" min="0" max="1" step="0.1" value={form.numeric_share ?? "0.5"} onChange={(event) => setForm((current) => ({ ...current, numeric_share: event.target.value }))} /></label> : null}
              {form.scoring_type === "MILESTONE" ? <label className="grid gap-1.5 text-sm"><span className="font-medium">Total milestones</span><input className={inputClass} type="number" min="1" value={form.total_milestones ?? ""} onChange={(event) => setForm((current) => ({ ...current, total_milestones: event.target.value }))} /></label> : null}
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Target</span>
                <input
                  className={inputClass}
                  type="number"
                  value={form.target_value ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      target_value: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Unit</span>
                <input
                  className={inputClass}
                  value={form.unit ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Weight (%)</span>
                <input
                  className={inputClass}
                  type="number"
                  min="0.01"
                  max="100"
                  value={form.weight ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      weight: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Start date</span>
                <DateInput
                  className={inputClass}

                  value={form.start_date ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      start_date: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Due date</span>
                <DateInput
                  className={inputClass}

                  value={form.due_date ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
