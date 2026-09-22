"use client";

import * as React from "react";
import {
  CheckIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
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
  deleteMyEmployeeKpi,
  listManagerEmployeeKpis,
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

async function loadSelfServiceList(
  loader: () => Promise<AdminRecord[]>,
): Promise<AdminRecord[]> {
  try {
    return await loader();
  } catch (error) {
    if (isPermissionError(error)) return [];
    throw error;
  }
}

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
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [periods, setPeriods] = React.useState<AdminRecord[]>([]);
  const [periodId, setPeriodId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
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
        setRows(await listManagerEmployeeKpis(accessToken, { limit: 100 }));
      } else {
        const [kpis, assignments] = await Promise.all([
          loadSelfServiceList(() => listMyEmployeeKpis(accessToken)),
          loadSelfServiceList(() => listMyPerformanceAssignments(accessToken)),
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
      setError(cause instanceof Error ? cause.message : "Could not load KPIs.");
    } finally {
      setLoading(false);
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

  function showCreate() {
    const nextPeriodId =
      employeeKpiPeriodId(writablePeriod) || periodId;
    if (nextPeriodId && nextPeriodId !== periodId) {
      setPeriodId(nextPeriodId);
    }
    setSelected(null);
    setDialogMode("create");
    setForm({
      performance_period_id: nextPeriodId,
      measurement_type: "PERCENTAGE",
      progress_source: "MANUAL",
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
          throw new Error("A comment is required when returning or rejecting a KPI.");
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
        };
        const id = rowId(selected ?? {});
        if (dialogMode === "edit" && id) {
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
      const message = cause instanceof Error ? cause.message : "Could not save KPI.";
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
    if (!id || !window.confirm(`Delete KPI ${readString(row, ["title"], `#${id}`)}?`)) return;
    const accessToken = token();
    if (!accessToken) return;
    setSaving(true);
    try {
      await deleteMyEmployeeKpi(accessToken, id);
      toast.success("KPI deleted.");
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not delete KPI.";
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
          if (
            status === "APPROVED" &&
            readString(row, ["progressSource", "progress_source"]) === "MANUAL"
          ) {
            return (
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  showActual(row);
                }}
              >
                Update actual
              </button>
            );
          }
          return null;
        },
      },
    ];
    return base;
  }, [mode]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "manager" ? "KPI reviews" : "My KPIs"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "manager"
              ? "Review KPI proposals from employees in your reporting scope."
              : "Propose measurable objectives, balance their weights, and submit the full set for review."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "self" ? (
            <>
              <select
                className={inputClass}
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                aria-label="Performance period"
              >
                <option value="">All periods</option>
                {periods.map((period) => (
                  <option key={rowId(period)} value={rowId(period)}>
                    {optionLabel(period)} · {readString(period, ["status"])}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={primaryButtonClass}
                onClick={showCreate}
                disabled={!canCreateKpi}
              >
                <PlusIcon className="size-4" /> New KPI
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => void submitPeriod()}
                disabled={!periodId || saving}
              >
                Submit set ({totalWeight}%)
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}{" "}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {mode === "self" && periodId ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total weight</p>
            <p className="text-2xl font-semibold">{totalWeight}%</p>
          </div>
          <div className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">KPIs</p>
            <p className="text-2xl font-semibold">{visibleRows.length}</p>
          </div>
          <div className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Ready to submit</p>
            <p className="text-2xl font-semibold">
              {totalWeight === 100 ? "Yes" : "No"}
            </p>
          </div>
          <div className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Weighted score</p>
            <p className="text-2xl font-semibold">{overallScore.toFixed(2)}%</p>
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden border border-border bg-card">
        <ResizableTable
          title={mode === "manager" ? "Team KPI proposals" : "KPI proposals"}
          data={mode === "self" ? visibleRows : rows}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey={`employee-kpis-${mode}`}
        />
      </div>

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
                <div><span className="text-xs text-muted-foreground">Employee</span><p className="font-medium">{employeeLabel(selected?.employee as AdminRecord)}</p></div>
                <div><span className="text-xs text-muted-foreground">Period</span><p className="font-medium">{optionLabel(periodOf(selected ?? {}) ?? {})}</p></div>
                <div><span className="text-xs text-muted-foreground">Measurement</span><p className="font-medium">{readString(selected ?? {}, ["measurementType", "measurement_type"])}</p></div>
                <div><span className="text-xs text-muted-foreground">Target</span><p className="font-medium">{readString(selected ?? {}, ["targetValue", "target_value"], "Manual")} {readString(selected ?? {}, ["unit"])}</p></div>
                <div><span className="text-xs text-muted-foreground">Weight</span><p className="font-medium">{readString(selected ?? {}, ["weight"])}%</p></div>
                <div><span className="text-xs text-muted-foreground">Due date</span><p className="font-medium">{formatDate(selected?.dueDate ?? selected?.due_date)}</p></div>
                <div className="sm:col-span-2"><span className="text-xs text-muted-foreground">Description</span><p className="whitespace-pre-wrap">{readString(selected ?? {}, ["description"])}</p></div>
                {readString(selected ?? {}, ["reviewComment", "review_comment"]) ? (
                  <div className="sm:col-span-2"><span className="text-xs text-muted-foreground">Previous review comment</span><p className="whitespace-pre-wrap">{readString(selected ?? {}, ["reviewComment", "review_comment"])}</p></div>
                ) : null}
              </div>
              <label className="grid gap-1.5">
                <span className="font-medium">
                  Comment{" "}
                  {form.decision === "APPROVE" ? "(optional)" : "(required)"}
                </span>
                <textarea
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
              {dialogMode === "create" ? (
                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="font-medium">Period</span>
                  <select
                    className={inputClass}
                    value={form.performance_period_id ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        performance_period_id: event.target.value,
                      }))
                    }
                  >
                    {periods.filter(canProposeEmployeeKpis).map((period) => (
                      <option
                        key={employeeKpiPeriodId(period)}
                        value={employeeKpiPeriodId(period)}
                      >
                        {optionLabel(period)}
                        {readString(period, ["status"])
                          ? ` · ${readString(period, ["status"])}`
                          : ""}
                      </option>
                    ))}
                  </select>
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
                <textarea
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
                <select
                  className={inputClass}
                  value={form.measurement_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      measurement_type: event.target.value,
                    }))
                  }
                >
                  {[
                    "NUMBER",
                    "PERCENTAGE",
                    "CURRENCY",
                    "BOOLEAN",
                    "RATING",
                    "MANUAL",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Progress source</span>
                <select
                  className={inputClass}
                  value={form.progress_source}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      progress_source: event.target.value,
                    }))
                  }
                >
                  <option value="MANUAL">Manual actual</option>
                  <option value="APPROVED_ACTIVITIES">
                    Approved activities
                  </option>
                  <option value="SYSTEM">System</option>
                </select>
              </label>
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
                <input
                  className={inputClass}
                  type="date"
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
                <input
                  className={inputClass}
                  type="date"
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
                <Loader2Icon className="size-4 animate-spin" />
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
