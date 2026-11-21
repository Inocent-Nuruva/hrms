"use client";

import * as React from "react";
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FluentSelect } from "@/components/ui/fluent-select";
import { toast } from "@/components/ui/fluent-toast-store";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  activatePayrollAttendanceDeductionPolicy,
  cancelPayrollRecovery,
  createPayrollAttendanceDeductionPolicy,
  createPayrollRecovery,
  decidePayrollRecovery,
  generatePayrollPaymentRetry,
  getPayrollPaymentProgress,
  listPayrollApprovalWorkflows,
  listPayrollAttendanceDeductionPolicies,
  listPayrollRecoveries,
  recordPayrollRecoverySettlement,
  retirePayrollAttendanceDeductionPolicy,
  savePayrollApprovalWorkflow,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background";
const textareaClass =
  "min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background";
const actionButtonClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted";
const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted";

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function text(row: AdminRecord | null | undefined, ...keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}

function pretty(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : String(value ?? "—");
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" || status === "SETTLED" || status === "PAID"
      ? "border-emerald-300 text-emerald-700 dark:text-emerald-300"
      : status === "PENDING_APPROVAL" ||
          status === "DRAFT" ||
          status === "PARTIALLY_PAID"
        ? "border-amber-300 text-amber-700 dark:text-amber-300"
        : status === "REJECTED" || status === "FAILED" || status === "CANCELLED"
          ? "border-rose-300 text-rose-700 dark:text-rose-300"
          : "";
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", tone)}>
      {pretty(status || "—")}
    </Badge>
  );
}

function PanelShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function useList(loader: (token: string) => Promise<AdminRecord[]>) {
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const reload = React.useCallback(async () => {
    const value = token();
    if (!value) return;
    setLoading(true);
    try {
      setRows(await loader(value));
    } catch (error) {
      toast.error(errorText(error, "Could not load the list."));
    } finally {
      setLoading(false);
    }
  }, [loader]);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, loading, reload };
}

function EmptyOrLoading({
  loading,
  empty,
}: {
  loading: boolean;
  empty: string;
}) {
  return (
    <div className="flex justify-center py-8 text-sm text-muted-foreground">
      {loading ? (
        <FluentLoadingIndicator className="size-5 animate-spin" />
      ) : (
        empty
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overpayment recoveries                                              */
/* ------------------------------------------------------------------ */

const RECOVERY_METHODS = [
  ["INSTALLMENTS", "Instalments from future payroll"],
  ["NEXT_PAYROLL", "Whole balance from next payroll"],
  ["REFUND", "Employee refund"],
  ["ACCOUNTING_ADJUSTMENT", "Accounting adjustment (no recovery from pay)"],
] as const;

const LEGAL_BASES = [
  ["EMPLOYEE_CONSENT", "Employee consent"],
  ["WRITTEN_AGREEMENT", "Written agreement"],
  ["COURT_ORDER", "Court order"],
  ["STATUTORY", "Statutory"],
  ["NOT_APPLICABLE", "Not applicable (refund / adjustment)"],
] as const;

function emptyRecoveryForm() {
  return {
    employeeId: "",
    originalRunId: "",
    amount: "",
    method: "INSTALLMENTS",
    installment: "",
    legalBasis: "EMPLOYEE_CONSENT",
    consentReference: "",
    reason: "",
  };
}

type RecoveryAction =
  | { kind: "approve" | "reject" | "cancel"; row: AdminRecord }
  | { kind: "refunds" | "accounting-adjustments"; row: AdminRecord };

export function PayrollRecoveriesPanel({
  canManage,
  canApprove,
  canAccounting,
}: {
  canManage: boolean;
  canApprove: boolean;
  canAccounting: boolean;
}) {
  const { rows, loading, reload } = useList(listPayrollRecoveries);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyRecoveryForm);
  const [action, setAction] = React.useState<RecoveryAction | null>(null);
  const [note, setNote] = React.useState("");
  const [settlement, setSettlement] = React.useState({
    amount: "",
    reference: "",
    evidence: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const deductsFromPay = ["INSTALLMENTS", "NEXT_PAYROLL"].includes(form.method);

  async function submitCreate() {
    setError(null);
    setSaving(true);
    try {
      await createPayrollRecovery(token(), {
        employee_id: Number(form.employeeId),
        original_payroll_run_id: Number(form.originalRunId),
        overpaid_amount: form.amount.trim(),
        method: form.method,
        installment_amount:
          form.method === "INSTALLMENTS" ? form.installment.trim() : undefined,
        legal_basis: form.legalBasis,
        consent_reference: form.consentReference.trim() || undefined,
        reason: form.reason.trim(),
      });
      toast.success("Recovery raised. It needs an independent approval.");
      setCreateOpen(false);
      setForm(emptyRecoveryForm());
      await reload();
    } catch (failure) {
      setError(errorText(failure, "Could not raise the recovery."));
    } finally {
      setSaving(false);
    }
  }

  async function submitAction() {
    if (!action) return;
    setError(null);
    setSaving(true);
    try {
      const id = text(action.row, "id");
      if (action.kind === "approve" || action.kind === "reject") {
        await decidePayrollRecovery(
          token(),
          id,
          action.kind,
          note.trim() || undefined,
        );
      } else if (action.kind === "cancel") {
        await cancelPayrollRecovery(token(), id, note.trim());
      } else {
        await recordPayrollRecoverySettlement(token(), id, action.kind, {
          amount: settlement.amount.trim(),
          reference: settlement.reference.trim(),
          evidence: settlement.evidence.trim(),
        });
      }
      toast.success("Recovery updated.");
      setAction(null);
      await reload();
    } catch (failure) {
      setError(errorText(failure, "Could not update the recovery."));
    } finally {
      setSaving(false);
    }
  }

  function openAction(next: RecoveryAction) {
    setAction(next);
    setNote("");
    setSettlement({ amount: "", reference: "", evidence: "" });
    setError(null);
  }

  return (
    <PanelShell
      title="Overpayment recoveries"
      description="Paid payroll is never edited. Overpayments are recovered through approved future deductions, a verified employee refund, or an accounting adjustment. Deductions need a documented legal basis and post only when the later salary is confirmed paid."
      action={
        canManage ? (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setForm(emptyRecoveryForm());
              setError(null);
              setCreateOpen(true);
            }}
          >
            Raise recovery
          </button>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyOrLoading loading={loading} empty="No overpayment recoveries." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Original run</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3 text-right">Overpaid</th>
                <th className="py-2 pr-3 text-right">Recovered</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = text(row, "status");
                const method = text(row, "method");
                return (
                  <tr
                    key={text(row, "id")}
                    className="border-t border-border/60 align-top"
                  >
                    <td className="py-2 pr-3">
                      #{text(row, "employeeId", "employee_id")}
                    </td>
                    <td className="py-2 pr-3">
                      #
                      {text(
                        row,
                        "originalPayrollRunId",
                        "original_payroll_run_id",
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div>{pretty(method)}</div>
                      <div className="text-xs text-muted-foreground">
                        {pretty(text(row, "legalBasis", "legal_basis"))}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {money(row.overpaidAmount ?? row.overpaid_amount)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {money(row.recoveredAmount ?? row.recovered_amount)}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {status === "PENDING_APPROVAL" && canApprove ? (
                          <>
                            <button
                              type="button"
                              className={actionButtonClass}
                              onClick={() =>
                                openAction({ kind: "approve", row })
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className={actionButtonClass}
                              onClick={() =>
                                openAction({ kind: "reject", row })
                              }
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                        {status === "ACTIVE" && canManage ? (
                          <button
                            type="button"
                            className={actionButtonClass}
                            onClick={() => openAction({ kind: "refunds", row })}
                          >
                            Record refund
                          </button>
                        ) : null}
                        {status === "ACTIVE" &&
                        method === "ACCOUNTING_ADJUSTMENT" &&
                        canAccounting ? (
                          <button
                            type="button"
                            className={actionButtonClass}
                            onClick={() =>
                              openAction({
                                kind: "accounting-adjustments",
                                row,
                              })
                            }
                          >
                            Accounting adjustment
                          </button>
                        ) : null}
                        {["PENDING_APPROVAL", "ACTIVE"].includes(status) &&
                        canManage ? (
                          <button
                            type="button"
                            className={actionButtonClass}
                            onClick={() => openAction({ kind: "cancel", row })}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Raise overpayment recovery</DialogTitle>
            <DialogDescription>
              For salary already paid. Use the original paid run and the
              employee who was overpaid.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Employee ID">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.employeeId}
                onChange={(e) =>
                  setForm((c) => ({ ...c, employeeId: e.target.value }))
                }
              />
            </Field>
            <Field label="Original payroll run ID">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.originalRunId}
                onChange={(e) =>
                  setForm((c) => ({ ...c, originalRunId: e.target.value }))
                }
              />
            </Field>
            <Field label="Overpaid amount">
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) =>
                  setForm((c) => ({ ...c, amount: e.target.value }))
                }
              />
            </Field>
            <Field label="Recovery method">
              <FluentSelect
                ariaLabel="Recovery method"
                className="w-full"
                value={form.method}
                onChange={(value) => setForm((c) => ({ ...c, method: value }))}
                options={RECOVERY_METHODS.map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            {form.method === "INSTALLMENTS" ? (
              <Field label="Instalment per payroll">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={form.installment}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, installment: e.target.value }))
                  }
                />
              </Field>
            ) : null}
            <Field
              label="Legal basis"
              hint={
                deductsFromPay
                  ? "Required for deductions from salary."
                  : undefined
              }
            >
              <FluentSelect
                ariaLabel="Legal basis"
                className="w-full"
                value={form.legalBasis}
                onChange={(value) =>
                  setForm((c) => ({ ...c, legalBasis: value }))
                }
                options={LEGAL_BASES.map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Field
              label="Consent / agreement / order reference"
              className="md:col-span-2"
            >
              <input
                className={inputClass}
                value={form.consentReference}
                onChange={(e) =>
                  setForm((c) => ({ ...c, consentReference: e.target.value }))
                }
              />
            </Field>
            <Field label="Reason" className="md:col-span-2">
              <Textarea
                className={textareaClass}
                value={form.reason}
                onChange={(e) =>
                  setForm((c) => ({ ...c, reason: e.target.value }))
                }
              />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setCreateOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void submitCreate()}
            >
              {saving ? "Saving…" : "Raise recovery"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
      >
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action ? pretty(action.kind.replace(/-/g, "_")) : ""}
            </DialogTitle>
            <DialogDescription>
              {action?.kind === "refunds" ||
              action?.kind === "accounting-adjustments"
                ? "Recorded once per reference and only within the open balance."
                : "Your decision is recorded in the payroll audit log."}
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {action?.kind === "refunds" ||
          action?.kind === "accounting-adjustments" ? (
            <div className="grid gap-3">
              <Field label="Amount">
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={settlement.amount}
                  onChange={(e) =>
                    setSettlement((c) => ({ ...c, amount: e.target.value }))
                  }
                />
              </Field>
              <Field label="Reference (receipt / journal no.)">
                <input
                  className={inputClass}
                  value={settlement.reference}
                  onChange={(e) =>
                    setSettlement((c) => ({ ...c, reference: e.target.value }))
                  }
                />
              </Field>
              <Field label="Evidence">
                <Textarea
                  className={textareaClass}
                  value={settlement.evidence}
                  onChange={(e) =>
                    setSettlement((c) => ({ ...c, evidence: e.target.value }))
                  }
                />
              </Field>
            </div>
          ) : (
            <Field
              label={action?.kind === "approve" ? "Note (optional)" : "Reason"}
            >
              <Textarea
                className={textareaClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setAction(null)}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void submitAction()}
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Approval workflows                                                  */
/* ------------------------------------------------------------------ */

const STAGES = ["HR", "FINANCE", "MANAGEMENT"] as const;

type StageDraft = {
  stage: string;
  enabled: boolean;
  approvers: string;
  limit: string;
};

export function PayrollApprovalWorkflowsPanel({
  canManage,
}: {
  canManage: boolean;
}) {
  const { rows, loading, reload } = useList(listPayrollApprovalWorkflows);
  const [open, setOpen] = React.useState(false);
  const [scope, setScope] = React.useState("COMPANY");
  const [scopeId, setScopeId] = React.useState("");
  const [name, setName] = React.useState("");
  const [stages, setStages] = React.useState<StageDraft[]>(
    STAGES.map((stage) => ({ stage, enabled: true, approvers: "", limit: "" })),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function move(index: number, delta: number) {
    setStages((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await savePayrollApprovalWorkflow(token(), {
        scope,
        branch_id: scope === "BRANCH" ? Number(scopeId) : undefined,
        payroll_group_id:
          scope === "PAYROLL_GROUP" ? Number(scopeId) : undefined,
        name: name.trim(),
        stages: stages
          .filter((item) => item.enabled)
          .map((item) => ({
            stage: item.stage,
            approver_company_user_ids: item.approvers
              .split(",")
              .map((value) => Number(value.trim()))
              .filter((value) => Number.isInteger(value) && value > 0),
            max_net_pay_total: item.limit.trim() || undefined,
          })),
      });
      toast.success(
        "Approval workflow saved. Runs already in approval keep their workflow.",
      );
      setOpen(false);
      await reload();
    } catch (failure) {
      setError(errorText(failure, "Could not save the workflow."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelShell
      title="Payroll approval workflows"
      description="Choose which stages approve payroll and in which order, per company, branch or payroll group (most specific wins). The preparer can never approve, and one person can approve only one stage. A run keeps the workflow it was calculated with."
      action={
        canManage ? (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            New workflow version
          </button>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyOrLoading
          loading={loading}
          empty="No custom workflow: runs use HR → Finance → Management."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const stageList = Array.isArray(row.stages)
              ? (row.stages as AdminRecord[])
              : [];
            return (
              <div
                key={text(row, "id")}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{text(row, "name")}</div>
                  <Badge variant="outline">
                    v{text(row, "versionNumber", "version_number")}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {pretty(text(row, "scope"))}
                  {text(row, "branchId", "branch_id")
                    ? ` · branch #${text(row, "branchId", "branch_id")}`
                    : ""}
                  {text(row, "payrollGroupId", "payroll_group_id")
                    ? ` · group #${text(row, "payrollGroupId", "payroll_group_id")}`
                    : ""}
                </div>
                <ol className="mt-2 space-y-1 text-sm">
                  {stageList.map((stage, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="text-muted-foreground">
                        {index + 1}.
                      </span>
                      <span className="font-medium">
                        {pretty(text(stage, "stage"))}
                      </span>
                      {text(stage, "max_net_pay_total") ? (
                        <span className="text-xs text-muted-foreground">
                          limit {money(stage.max_net_pay_total)}
                        </span>
                      ) : null}
                      {Array.isArray(stage.approver_company_user_ids) &&
                      stage.approver_company_user_ids.length ? (
                        <span className="text-xs text-muted-foreground">
                          approvers #
                          {(stage.approver_company_user_ids as number[]).join(
                            ", #",
                          )}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New approval workflow version</DialogTitle>
            <DialogDescription>
              Saving replaces the active workflow for this scope. Leave
              approvers empty to allow anyone with payroll approval permission.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Applies to">
              <FluentSelect
                ariaLabel="Workflow scope"
                className="w-full"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "COMPANY", label: "Whole company" },
                  { value: "BRANCH", label: "One branch" },
                  { value: "PAYROLL_GROUP", label: "One payroll group" },
                ]}
              />
            </Field>
            {scope !== "COMPANY" ? (
              <Field
                label={scope === "BRANCH" ? "Branch ID" : "Payroll group ID"}
              >
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                />
              </Field>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {stages.map((item, index) => (
              <div
                key={item.stage}
                className="grid gap-2 rounded-lg border border-border p-2 md:grid-cols-[auto_1fr_1fr_auto] md:items-end"
              >
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) =>
                      setStages((current) =>
                        current.map((stage, i) =>
                          i === index
                            ? { ...stage, enabled: e.target.checked }
                            : stage,
                        ),
                      )
                    }
                  />
                  {index + 1}. {pretty(item.stage)}
                </label>
                <Field label="Approver user IDs (comma separated)">
                  <input
                    className={inputClass}
                    value={item.approvers}
                    onChange={(e) =>
                      setStages((current) =>
                        current.map((stage, i) =>
                          i === index
                            ? { ...stage, approvers: e.target.value }
                            : stage,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Net pay limit (optional)">
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={item.limit}
                    onChange={(e) =>
                      setStages((current) =>
                        current.map((stage, i) =>
                          i === index
                            ? { ...stage, limit: e.target.value }
                            : stage,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={actionButtonClass}
                    aria-label="Move up"
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={actionButtonClass}
                    aria-label="Move down"
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save workflow"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance deduction policies                                       */
/* ------------------------------------------------------------------ */

function emptyPolicyForm() {
  return {
    name: "",
    effectiveFrom: "",
    effectiveTo: "",
    standardMinutes: "480",
    absence: false,
    halfDay: false,
    lateness: false,
    lateGrace: "0",
    lateThreshold: "0",
    early: false,
    earlyGrace: "0",
    earlyThreshold: "0",
    cap: "",
    exempt: "",
  };
}

export function PayrollAttendanceDeductionPoliciesPanel({
  canManage,
  canActivate,
}: {
  canManage: boolean;
  canActivate: boolean;
}) {
  const { rows, loading, reload } = useList(
    listPayrollAttendanceDeductionPolicies,
  );
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyPolicyForm);
  const [activateRow, setActivateRow] = React.useState<AdminRecord | null>(
    null,
  );
  const [legalReference, setLegalReference] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<ReturnType<typeof emptyPolicyForm>>) =>
    setForm((current) => ({ ...current, ...patch }));

  async function create() {
    setError(null);
    setSaving(true);
    try {
      await createPayrollAttendanceDeductionPolicy(token(), {
        name: form.name.trim(),
        effective_from: form.effectiveFrom,
        effective_to: form.effectiveTo || undefined,
        rules: {
          standard_minutes_per_day: Number(form.standardMinutes),
          unauthorized_absence: { enabled: form.absence },
          half_day: { enabled: form.halfDay },
          lateness: {
            enabled: form.lateness,
            grace_minutes: Number(form.lateGrace || 0),
            monthly_threshold_minutes: Number(form.lateThreshold || 0),
          },
          early_departure: {
            enabled: form.early,
            grace_minutes: Number(form.earlyGrace || 0),
            monthly_threshold_minutes: Number(form.earlyThreshold || 0),
          },
          monthly_cap_percent_of_basic: form.cap ? Number(form.cap) : null,
          exempt_employee_ids: form.exempt
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0),
        },
      });
      toast.success(
        "Draft policy saved. It does not affect pay until activated.",
      );
      setOpen(false);
      setForm(emptyPolicyForm());
      await reload();
    } catch (failure) {
      setError(errorText(failure, "Could not save the policy."));
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!activateRow) return;
    setError(null);
    setSaving(true);
    try {
      await activatePayrollAttendanceDeductionPolicy(
        token(),
        text(activateRow, "id"),
        legalReference.trim(),
      );
      toast.success(
        "Policy activated. It applies from the next payroll calculation.",
      );
      setActivateRow(null);
      await reload();
    } catch (failure) {
      setError(errorText(failure, "Could not activate the policy."));
    } finally {
      setSaving(false);
    }
  }

  async function retire(row: AdminRecord) {
    try {
      await retirePayrollAttendanceDeductionPolicy(token(), text(row, "id"));
      toast.success("Policy retired.");
      await reload();
    } catch (failure) {
      toast.error(errorText(failure, "Could not retire the policy."));
    }
  }

  const ruleSummary = (row: AdminRecord) => {
    const rules = (row.rules ?? {}) as Record<
      string,
      { enabled?: boolean } | number | null
    >;
    const on = (key: string) =>
      Boolean((rules[key] as { enabled?: boolean } | undefined)?.enabled);
    const parts = [
      on("unauthorized_absence") && "Absence",
      on("half_day") && "Half day",
      on("lateness") && "Lateness",
      on("early_departure") && "Early departure",
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "No monetary rules enabled";
  };

  return (
    <PanelShell
      title="Attendance deduction policies"
      description="Lateness, early departure and absence are always recorded and reported. They reduce pay only under an ACTIVE policy, which needs approval by someone other than its author and the reference of the completed HR and legal compliance review. Days on approved leave and unverified attendance are never deducted."
      action={
        canManage ? (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => {
              setError(null);
              setForm(emptyPolicyForm());
              setOpen(true);
            }}
          >
            New draft policy
          </button>
        ) : null
      }
    >
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Monetary attendance deductions are off unless a policy below is Active.
      </div>
      {rows.length === 0 ? (
        <EmptyOrLoading
          loading={loading}
          empty="No attendance deduction policies."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Policy</th>
                <th className="py-2 pr-3">Effective</th>
                <th className="py-2 pr-3">Rules</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = text(row, "status");
                return (
                  <tr
                    key={text(row, "id")}
                    className="border-t border-border/60 align-top"
                  >
                    <td className="py-2 pr-3 font-medium">
                      {text(row, "name")}
                    </td>
                    <td className="py-2 pr-3">
                      {text(row, "effectiveFrom", "effective_from")} →{" "}
                      {text(row, "effectiveTo", "effective_to") || "open"}
                    </td>
                    <td className="py-2 pr-3">
                      <div>{ruleSummary(row)}</div>
                      {text(
                        row,
                        "legalReviewReference",
                        "legal_review_reference",
                      ) ? (
                        <div className="text-xs text-muted-foreground">
                          Legal review:{" "}
                          {text(
                            row,
                            "legalReviewReference",
                            "legal_review_reference",
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {status === "DRAFT" && canActivate ? (
                          <button
                            type="button"
                            className={actionButtonClass}
                            onClick={() => {
                              setError(null);
                              setLegalReference("");
                              setActivateRow(row);
                            }}
                          >
                            Activate
                          </button>
                        ) : null}
                        {status !== "RETIRED" && canManage ? (
                          <button
                            type="button"
                            className={actionButtonClass}
                            onClick={() => void retire(row)}
                          >
                            Retire
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New draft attendance deduction policy</DialogTitle>
            <DialogDescription>
              Drafts are saved for review and never change pay.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Name" className="md:col-span-3">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </Field>
            <Field label="Effective from">
              <input
                type="date"
                className={inputClass}
                value={form.effectiveFrom}
                onChange={(e) => set({ effectiveFrom: e.target.value })}
              />
            </Field>
            <Field label="Effective to (optional)">
              <input
                type="date"
                className={inputClass}
                value={form.effectiveTo}
                onChange={(e) => set({ effectiveTo: e.target.value })}
              />
            </Field>
            <Field label="Standard minutes per day">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.standardMinutes}
                onChange={(e) => set({ standardMinutes: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.absence}
                onChange={(e) => set({ absence: e.target.checked })}
              />{" "}
              Deduct unauthorised absence days
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.halfDay}
                onChange={(e) => set({ halfDay: e.target.checked })}
              />{" "}
              Deduct half days
            </label>
            <div className="space-y-2 rounded-lg border border-border p-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.lateness}
                  onChange={(e) => set({ lateness: e.target.checked })}
                />{" "}
                Deduct lateness
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Grace min/day">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.lateGrace}
                    onChange={(e) => set({ lateGrace: e.target.value })}
                  />
                </Field>
                <Field label="Free min/month">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.lateThreshold}
                    onChange={(e) => set({ lateThreshold: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.early}
                  onChange={(e) => set({ early: e.target.checked })}
                />{" "}
                Deduct early departure
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Grace min/day">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.earlyGrace}
                    onChange={(e) => set({ earlyGrace: e.target.value })}
                  />
                </Field>
                <Field label="Free min/month">
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={form.earlyThreshold}
                    onChange={(e) => set({ earlyThreshold: e.target.value })}
                  />
                </Field>
              </div>
            </div>
            <Field label="Monthly cap (% of basic, optional)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.cap}
                onChange={(e) => set({ cap: e.target.value })}
              />
            </Field>
            <Field label="Exempt employee IDs (comma separated)">
              <input
                className={inputClass}
                value={form.exempt}
                onChange={(e) => set({ exempt: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void create()}
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={activateRow !== null}
        onOpenChange={(value) => !value && setActivateRow(null)}
      >
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Activate monetary deductions</DialogTitle>
            <DialogDescription>
              Only activate after HR and Legal have approved these rules under
              Tanzanian employment law. You cannot activate a policy you
              authored.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Field label="HR / legal review reference">
            <input
              className={inputClass}
              value={legalReference}
              onChange={(e) => setLegalReference(e.target.value)}
            />
          </Field>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setActivateRow(null)}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void activate()}
            >
              {saving ? "Saving…" : "Activate"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Payment progress and retry                                          */
/* ------------------------------------------------------------------ */

export function PayrollPaymentProgressDialog({
  runId,
  canRetry,
  onClose,
  onChanged,
}: {
  runId: string | null;
  canRetry: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = React.useState<AdminRecord | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!runId) return;
    setData(null);
    setReason("");
    setError(null);
    setLoading(true);
    getPayrollPaymentProgress(token(), runId)
      .then(setData)
      .catch((failure) =>
        setError(errorText(failure, "Could not load payment progress.")),
      )
      .finally(() => setLoading(false));
  }, [runId]);

  async function retry() {
    if (!runId) return;
    setError(null);
    setSaving(true);
    try {
      await generatePayrollPaymentRetry(token(), runId, reason.trim());
      toast.success(
        "Retry payment file generated for outstanding amounts only.",
      );
      onChanged();
      onClose();
    } catch (failure) {
      setError(errorText(failure, "Could not generate the retry file."));
    } finally {
      setSaving(false);
    }
  }

  const rows = Array.isArray(data?.rows) ? (data!.rows as AdminRecord[]) : [];
  const retryable = rows.some((row) =>
    ["FAILED", "PARTIALLY_PAID"].includes(text(row, "state")),
  );

  return (
    <Dialog open={runId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPopup className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Payment progress</DialogTitle>
          <DialogDescription>
            From imported bank statements. A payment file alone is not proof of
            payment. Loan and recovery deductions post only for fully paid
            employees.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {loading ? (
          <div className="flex justify-center py-6">
            <FluentLoadingIndicator className="size-5 animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center text-sm md:grid-cols-5">
              {(
                [
                  ["State", pretty(text(data, "payment_state"))],
                  ["Paid", text(data, "paid_count") || "0"],
                  ["Partial", text(data, "partially_paid_count") || "0"],
                  ["Failed", text(data, "failed_count") || "0"],
                  ["Outstanding", money(data.outstanding_total)],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-border p-2"
                >
                  <div className="font-semibold">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <div className="max-h-[45vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">Employee</th>
                    <th className="py-1 pr-2 text-right">Net pay</th>
                    <th className="py-1 pr-2 text-right">Confirmed</th>
                    <th className="py-1 pr-2 text-right">Outstanding</th>
                    <th className="py-1">State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={text(row, "employee_id")}
                      className="border-t border-border/60"
                    >
                      <td className="py-1.5 pr-2">
                        {text(row, "employee_name") ||
                          `#${text(row, "employee_id")}`}
                        <div className="text-xs text-muted-foreground">
                          {text(row, "employee_no")}
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {money(row.net_pay)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {money(row.confirmed_amount)}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {money(row.outstanding_amount)}
                      </td>
                      <td className="py-1.5">
                        <StatusBadge status={text(row, "state")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canRetry && retryable ? (
              <Field
                label="Retry reason"
                hint="Import the statement for the previous file first. The retry contains only outstanding amounts, with new references."
              >
                <input
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            ) : null}
          </div>
        ) : null}
        <DialogFooter className="mt-4">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onClose}
          >
            Close
          </button>
          {canRetry && retryable ? (
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving || !reason.trim()}
              onClick={() => void retry()}
            >
              {saving ? "Saving…" : "Generate retry file"}
            </button>
          ) : null}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
