"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { formatAdminValue } from "@/components/dashboard/admin-view-shared";
import { Badge } from "@/components/ui/badge";
import {
  assignEmployeePayrollSalary,
  getEmployeePayrollSalary,
  getPayrollSalaryStructure,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background";
const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted";

const WARNING_LABELS: Record<string, string> = {
  NO_COMPENSATION:
    "No active compensation. This employee is skipped by payroll runs until a salary is assigned.",
  NO_SALARY_STRUCTURE:
    "Compensation has no salary structure, so only base salary and payroll inputs are paid.",
  SALARY_STRUCTURE_NOT_EFFECTIVE:
    "The assigned structure has no active version on this date. Only base salary will be paid.",
  CURRENCY_MISMATCH:
    "Compensation currency differs from the structure currency.",
};

const SKIP_LABELS: Record<string, string> = {
  BASE_SALARY_FROM_COMPENSATION: "Paid from base salary",
  EXCLUDED_BY_EMPLOYEE_OVERRIDE: "Excluded for this employee",
  REPLACED_BY_PAYROLL_INPUT: "Replaced by payroll input",
  COMPONENT_INACTIVE: "Component inactive",
  NON_RECURRING_COMPONENT: "Not a recurring component",
  INFORMATIONAL_COMPONENT: "Informational only",
  ZERO_AMOUNT: "Zero amount",
};

type OverrideDraft = {
  mode: "default" | "amount" | "rate" | "exclude";
  value: string;
};

function str(row: AdminRecord | null | undefined, ...keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}

function rec(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function recs(value: unknown): AdminRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is AdminRecord => rec(entry) !== null)
    : [];
}

function money(value: unknown, currency: string) {
  const parsed = Number(value);
  if (value === null || value === undefined || !Number.isFinite(parsed)) {
    return "—";
  }
  return `${currency} ${parsed.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function prettify(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PayrollEmployeeSalaryDialog({
  open,
  onOpenChange,
  employeeId,
  employeeLabel,
  structures,
  canEdit,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeLabel: string;
  structures: AdminRecord[];
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [salary, setSalary] = React.useState<AdminRecord | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [structureCode, setStructureCode] = React.useState("");
  const [structureLines, setStructureLines] = React.useState<AdminRecord[]>([]);
  const [baseSalary, setBaseSalary] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState(today());
  const [justification, setJustification] = React.useState("");
  const [overrides, setOverrides] = React.useState<
    Record<string, OverrideDraft>
  >({});

  // One entry per code: the newest active version.
  const activeStructures = React.useMemo(() => {
    const byCode = new Map<string, AdminRecord>();
    for (const row of structures) {
      if (str(row, "status").toUpperCase() !== "ACTIVE") continue;
      const code = str(row, "code");
      const existing = byCode.get(code);
      if (
        !existing ||
        Number(str(row, "versionNumber", "version_number")) >
          Number(str(existing, "versionNumber", "version_number"))
      ) {
        byCode.set(code, row);
      }
    }
    return [...byCode.values()];
  }, [structures]);

  const load = React.useCallback(async () => {
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token || !employeeId) return;
    setLoading(true);
    setError(null);
    try {
      setSalary(await getEmployeePayrollSalary(token, employeeId));
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load employee salary.",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  React.useEffect(() => {
    if (!open) return;
    setStructureCode("");
    setStructureLines([]);
    setBaseSalary("");
    setEffectiveFrom(today());
    setJustification("");
    setOverrides({});
    void load();
  }, [open, load]);

  async function onSelectStructure(code: string) {
    setStructureCode(code);
    setOverrides({});
    setStructureLines([]);
    const row = activeStructures.find((item) => str(item, "code") === code);
    const token = readStoredSessionTokens().accessToken.trim();
    if (!row || !token) return;
    try {
      const detail = await getPayrollSalaryStructure(token, str(row, "id"));
      const lines = recs(detail?.components);
      setStructureLines(lines);
      const basic = lines.find(
        (line) => str(line, "component_code") === "BASIC",
      );
      if (basic && !baseSalary) {
        setBaseSalary(str(basic, "defaultAmount", "default_amount"));
      }
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load structure lines.",
      );
    }
  }

  async function onAssign() {
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token) return;
    if (!structureCode || !baseSalary.trim() || !effectiveFrom) {
      setError("Structure, base salary and effective date are required.");
      return;
    }
    const componentOverrides = Object.entries(overrides)
      .filter(([, draft]) => draft.mode !== "default")
      .map(([code, draft]) => ({
        component_code: code,
        ...(draft.mode === "exclude" ? { excluded: true } : {}),
        ...(draft.mode === "amount" ? { amount: draft.value.trim() } : {}),
        ...(draft.mode === "rate" ? { rate: draft.value.trim() } : {}),
      }));
    if (
      componentOverrides.some(
        (item) =>
          ("amount" in item && !item.amount) || ("rate" in item && !item.rate),
      )
    ) {
      setError("Enter a value for every amount or rate override.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setSalary(
        await assignEmployeePayrollSalary(token, employeeId, {
          salary_structure_code: structureCode,
          base_salary: baseSalary.trim(),
          effective_from: effectiveFrom,
          justification: justification.trim() || undefined,
          component_overrides: componentOverrides.length
            ? componentOverrides
            : undefined,
        }),
      );
      toast.success("Salary structure assigned.");
      onChanged?.();
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to assign salary.",
      );
    } finally {
      setSaving(false);
    }
  }

  const compensation = rec(salary?.compensation);
  const structure = rec(salary?.salary_structure);
  const breakdown = rec(salary?.breakdown);
  const rawWarnings = salary?.warnings;
  const warnings = Array.isArray(rawWarnings)
    ? rawWarnings.filter((item): item is string => typeof item === "string")
    : [];
  const history = recs(salary?.history);
  const currency = str(compensation, "currency") || "TZS";
  const overrideMap = rec(compensation?.componentOverrides) ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="flex max-h-[90vh] w-[min(980px,96vw)] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Salary &amp; structure</DialogTitle>
          <DialogDescription>{employeeLabel}</DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {loading && !salary ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Loading salary…
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="space-y-1 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              {warnings.map((code) => (
                <p key={code}>{WARNING_LABELS[code] ?? prettify(code)}</p>
              ))}
            </div>
          ) : null}

          {compensation ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryField
                label="Base salary"
                value={money(compensation.baseSalary, currency)}
              />
              <SummaryField
                label="Structure"
                value={
                  structure
                    ? `${str(structure, "code")} · v${str(structure, "version_number")}`
                    : str(compensation, "salaryStructureCode") || "—"
                }
              />
              <SummaryField
                label="Effective from"
                value={formatAdminValue(compensation.effectiveFrom)}
              />
              <SummaryField
                label="Status"
                value={prettify(str(compensation, "status"))}
              />
            </div>
          ) : null}

          {breakdown ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Monthly breakdown
                </h3>
                <p className="text-xs text-muted-foreground">
                  {str(breakdown, "note")}
                </p>
              </div>
              <div className="mt-3 grid gap-1.5">
                {recs(breakdown.lines).map((line) => {
                  const code = str(line, "componentCode");
                  const isEmployer = str(line, "componentType").startsWith(
                    "EMPLOYER",
                  );
                  return (
                    <div
                      key={code}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {str(line, "componentName") || code}
                          {overrideMap[code] ? (
                            <Badge variant="outline" className="ml-2">
                              Override
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {prettify(str(line, "componentType"))}
                        </p>
                      </div>
                      <p className="font-medium tabular-nums">
                        {money(
                          isEmployer ? line.employerAmount : line.amount,
                          currency,
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
              {recs(breakdown.skipped).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {recs(breakdown.skipped).map((item) => (
                    <Badge key={str(item, "component_code")} variant="outline">
                      {str(item, "component_code")}:{" "}
                      {SKIP_LABELS[str(item, "reason")] ??
                        prettify(str(item, "reason"))}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <SummaryField
                  label="Gross"
                  value={money(breakdown.gross_pay, currency)}
                />
                <SummaryField
                  label="Recurring deductions"
                  value={money(breakdown.recurring_deductions, currency)}
                />
                <SummaryField
                  label="Net before statutory"
                  value={money(breakdown.net_before_statutory, currency)}
                />
                <SummaryField
                  label="Employer cost"
                  value={money(breakdown.employer_cost, currency)}
                />
              </div>
            </div>
          ) : null}

          {compensation && canEdit ? (
            <p className="text-xs text-muted-foreground">
              To change base salary, structure or overrides, raise a salary
              revision movement for this employee. Changes then follow the
              movement approval workflow.
            </p>
          ) : null}

          {salary && !compensation && canEdit ? (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Assign salary structure
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Structure
                  </span>
                  <select
                    className={inputClass}
                    value={structureCode}
                    onChange={(event) =>
                      void onSelectStructure(event.target.value)
                    }
                  >
                    <option value="">Select structure</option>
                    {activeStructures.map((row) => (
                      <option key={str(row, "id")} value={str(row, "code")}>
                        {str(row, "code")} · {str(row, "name")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Base salary
                  </span>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={baseSalary}
                    onChange={(event) => setBaseSalary(event.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Effective from
                  </span>
                  <input
                    type="date"
                    className={inputClass}
                    value={effectiveFrom}
                    onChange={(event) => setEffectiveFrom(event.target.value)}
                  />
                </label>
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Justification
                </span>
                <input
                  className={inputClass}
                  value={justification}
                  placeholder="Initial salary structure assignment"
                  onChange={(event) => setJustification(event.target.value)}
                />
              </label>

              {structureLines.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee overrides
                  </p>
                  {structureLines
                    .filter((line) => str(line, "component_code") !== "BASIC")
                    .map((line) => {
                      const code = str(line, "component_code");
                      const draft = overrides[code] ?? {
                        mode: "default",
                        value: "",
                      };
                      const rate = str(line, "defaultRate", "default_rate");
                      return (
                        <div
                          key={code}
                          className="grid items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 md:grid-cols-[minmax(0,1fr)_160px_160px]"
                        >
                          <div className="min-w-0 text-sm">
                            <p className="truncate font-medium">
                              {str(line, "component_name") || code}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Default{" "}
                              {rate
                                ? `${rate}% of base`
                                : money(
                                    line.defaultAmount ?? line.default_amount,
                                    currency,
                                  )}
                            </p>
                          </div>
                          <select
                            className={inputClass}
                            value={draft.mode}
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                [code]: {
                                  mode: event.target
                                    .value as OverrideDraft["mode"],
                                  value: "",
                                },
                              }))
                            }
                          >
                            <option value="default">Use default</option>
                            <option value="amount">Fixed amount</option>
                            <option value="rate">% of base</option>
                            <option value="exclude">Exclude</option>
                          </select>
                          <input
                            className={cn(
                              inputClass,
                              (draft.mode === "default" ||
                                draft.mode === "exclude") &&
                                "opacity-50",
                            )}
                            inputMode="decimal"
                            disabled={
                              draft.mode === "default" ||
                              draft.mode === "exclude"
                            }
                            value={draft.value}
                            placeholder={
                              draft.mode === "rate" ? "Rate %" : "Amount"
                            }
                            onChange={(event) =>
                              setOverrides((current) => ({
                                ...current,
                                [code]: { ...draft, value: event.target.value },
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Compensation history
              </h3>
              <div className="mt-3 grid gap-1.5">
                {history.map((item) => (
                  <div
                    key={str(item, "id")}
                    className="grid gap-1 rounded-lg bg-muted/40 px-3 py-2 text-xs md:grid-cols-4"
                  >
                    <span className="font-medium text-foreground">
                      {money(
                        item.baseSalary,
                        str(item, "currency") || currency,
                      )}
                    </span>
                    <span>
                      {str(item, "salaryStructureCode") || "No structure"}
                    </span>
                    <span>
                      {formatAdminValue(item.effectiveFrom)} →{" "}
                      {formatAdminValue(item.effectiveTo)}
                    </span>
                    <span>{prettify(str(item, "status"))}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => onOpenChange(false)}
          >
            Close
          </button>
          {salary && !compensation && canEdit ? (
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void onAssign()}
            >
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Assign salary
            </button>
          ) : null}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
