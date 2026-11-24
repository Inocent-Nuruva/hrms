"use client";

import { SharedDashboardHeroBackground } from "@/components/dashboard/welcome-card-background"
import * as React from "react";
import { Button, Card, Input, Field, Textarea as FluentTextarea, Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, TeachingPopover, TeachingPopoverTrigger, TeachingPopoverSurface, TeachingPopoverHeader, TeachingPopoverBody, TeachingPopoverTitle, TeachingPopoverFooter } from "@fluentui/react-components";
import { Info20Regular, ArrowClockwise20Regular, ReceiptMoney24Regular } from "@fluentui/react-icons";

function PayrollGuide({ title, children, inverse = false }: { title: string; children: React.ReactNode; inverse?: boolean }) {
  return (
    <TeachingPopover positioning="below-start">
      <TeachingPopoverTrigger>
        <Button appearance="subtle" size="small" className={inverse ? "!text-primary-foreground hover:!bg-primary-foreground/10" : undefined} icon={<Info20Regular />} aria-label={`About ${title}`} />
      </TeachingPopoverTrigger>
      <TeachingPopoverSurface>
        <TeachingPopoverHeader>Quick guide</TeachingPopoverHeader>
        <TeachingPopoverBody>
          <TeachingPopoverTitle>{title}</TeachingPopoverTitle>
          {children}
        </TeachingPopoverBody>
        <TeachingPopoverFooter primary="Got it" />
      </TeachingPopoverSurface>
    </TeachingPopover>
  );
}

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/fluent-toast-store";
import {
  pageBleedClass,
  MetricTile,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  inputClass,
  prettify,
  primaryButtonClass,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { FluentSelect } from "@/components/ui/fluent-select";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";
import { readStoredSessionTokens } from "@/lib/session-client";
import {
  backfillEmployeeFinanceInterest,
  confirmEmployeeFinanceExitRecovery,
  createEmployeeFinanceDelegation,
  decideEmployeeFinanceAdjustment,
  decideEmployeeFinanceDeferment,
  decideEmployeeFinanceReschedule,
  getEmployeeFinancePayrollPreview,
  getEmployeeFinancePayrollRunDeductions,
  getEmployeeFinanceSanctionTemplate,
  listEmployeeFinanceAdjustments,
  listEmployeeFinanceDelegations,
  listEmployeeFinanceExitRecoveries,
  listEmployeeFinancePayrollShortfalls,
  listPendingEmployeeFinanceDeferments,
  listPendingEmployeeFinanceReschedules,
  previewEmployeeFinanceSanctionTemplate,
  resolveEmployeeFinancePayrollShortfall,
  revokeEmployeeFinanceDelegation,
  runEmployeeFinanceEscalationSweep,
  runEmployeeFinanceOverdueSweep,
  saveEmployeeFinanceSanctionTemplate,
  type AdminRecord,
} from "@/lib/admin-api";

export type FinanceServicingTab = "servicing" | "payroll" | "settings";

const APPROVAL_STAGES = ["MANAGER", "HR", "FINANCE", "MANAGEMENT"] as const;

function token() {
  return readStoredSessionTokens().accessToken.trim();
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function records(value: unknown): AdminRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is AdminRecord =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];
}

function Section({
  title,
  description,
  actions,
  guide = false,
  children,
}: {
  title: string;
  description?: string;
  guide?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="!gap-0 !p-0">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{title}</h2>{guide && description ? <PayrollGuide title={title}>{description}</PayrollGuide> : null}</div>
          {description && !guide ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function SimpleTable({
  columns,
  rows,
  empty,
}: {
  columns: Array<{ key: string; label: string; render: (row: AdminRecord) => React.ReactNode }>;
  rows: AdminRecord[];
  empty: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <Table className="w-full text-left text-sm">
        <TableHeader className="bg-muted text-xs text-muted-foreground">
          <TableRow>
            {columns.map((column) => (
              <TableHeaderCell key={column.key} className="whitespace-nowrap px-3 py-2">
                {column.label}
              </TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {rows.map((row, index) => (
            <TableRow key={rowId(row) || index}>
              {columns.map((column) => (
                <TableCell key={column.key} className="px-3 py-2 align-top">
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type DecisionTarget = {
  kind: "deferment" | "reschedule" | "adjustment";
  row: AdminRecord;
  decision: "APPROVED" | "REJECTED";
};

export function FinanceServicingView({
  activeTab,
}: {
  activeTab: FinanceServicingTab;
}) {
  const actor = useDashboardActor();
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(
      `/dashboard/finance/${activeTab}`,
      actor.permissionLabels,
      actor.accessMode,
    );
  const leaveIfForbidden = useLeaveIfForbidden();
  useForbiddenRouteGuard(canAccess);

  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState("");

  // Servicing queues
  const [deferments, setDeferments] = React.useState<AdminRecord[]>([]);
  const [reschedules, setReschedules] = React.useState<AdminRecord[]>([]);
  const [adjustments, setAdjustments] = React.useState<AdminRecord[]>([]);
  const [recoveries, setRecoveries] = React.useState<AdminRecord[]>([]);
  const [decision, setDecision] = React.useState<DecisionTarget | null>(null);
  const [decisionComments, setDecisionComments] = React.useState("");
  const [recoveryTarget, setRecoveryTarget] = React.useState<AdminRecord | null>(null);
  const [recoveryForm, setRecoveryForm] = React.useState<Record<string, string>>({});
  const [lastRun, setLastRun] = React.useState<AdminRecord | null>(null);

  // Payroll
  const [periodId, setPeriodId] = React.useState("");
  const [runId, setRunId] = React.useState("");
  const [preview, setPreview] = React.useState<AdminRecord | null>(null);
  const [runDeductions, setRunDeductions] = React.useState<AdminRecord | null>(null);
  const [shortfalls, setShortfalls] = React.useState<AdminRecord[]>([]);
  const [shortfallTarget, setShortfallTarget] = React.useState<AdminRecord | null>(null);
  const [shortfallForm, setShortfallForm] = React.useState<Record<string, string>>({
    resolution: "CARRY_FORWARD",
  });

  // Settings
  const [template, setTemplate] = React.useState<Record<string, string>>({});
  const [placeholders, setPlaceholders] = React.useState<string[]>([]);
  const [templatePreview, setTemplatePreview] = React.useState("");
  const [delegations, setDelegations] = React.useState<AdminRecord[]>([]);
  const [delegationForm, setDelegationForm] = React.useState<Record<string, string>>({});
  const [delegationStages, setDelegationStages] = React.useState<string[]>([]);

  const loadServicing = React.useCallback(async () => {
    const accessToken = token();
    if (!accessToken) return;
    setLoading(true);
    const results = await Promise.allSettled([
      listPendingEmployeeFinanceDeferments(accessToken),
      listPendingEmployeeFinanceReschedules(accessToken),
      listEmployeeFinanceAdjustments(accessToken),
      listEmployeeFinanceExitRecoveries(accessToken),
    ]);
    const [deferred, rescheduled, adjusted, recovered] = results;
    setDeferments(deferred.status === "fulfilled" ? deferred.value : []);
    setReschedules(rescheduled.status === "fulfilled" ? rescheduled.value : []);
    setAdjustments(adjusted.status === "fulfilled" ? adjusted.value : []);
    setRecoveries(recovered.status === "fulfilled" ? recovered.value : []);
    const failed = results.find((result) => result.status === "rejected");
    if (failed && failed.status === "rejected" && leaveIfForbidden(failed.reason)) {
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [leaveIfForbidden]);

  const loadShortfalls = React.useCallback(async () => {
    const accessToken = token();
    if (!accessToken) return;
    try {
      setShortfalls(
        await listEmployeeFinancePayrollShortfalls(accessToken, {
          payroll_period_id: periodId || undefined,
        }),
      );
    } catch (error) {
      if (!leaveIfForbidden(error)) {
        toast.error(errorText(error, "Could not load shortfalls."));
      }
    }
  }, [leaveIfForbidden, periodId]);

  const loadSettings = React.useCallback(async () => {
    const accessToken = token();
    if (!accessToken) return;
    setLoading(true);
    const [templateResult, delegationResult] = await Promise.allSettled([
      getEmployeeFinanceSanctionTemplate(accessToken),
      listEmployeeFinanceDelegations(accessToken),
    ]);
    if (templateResult.status === "fulfilled") {
      const payload = asRecord(templateResult.value);
      const current = asRecord(payload?.template);
      setTemplate({
        letterhead: readString(current, ["letterhead"], ""),
        body: readString(current, ["body"], readString(payload, ["default_body"], "")),
        signatory_name: readString(current, ["signatoryName", "signatory_name"], ""),
        signatory_title: readString(current, ["signatoryTitle", "signatory_title"], ""),
      });
      const keys = payload?.placeholders;
      setPlaceholders(Array.isArray(keys) ? keys.map(String) : []);
    }
    setDelegations(
      delegationResult.status === "fulfilled" ? delegationResult.value : [],
    );
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (!canAccess) return;
    if (activeTab === "servicing") void loadServicing();
    if (activeTab === "payroll") void loadShortfalls();
    if (activeTab === "settings") void loadSettings();
    // Payroll shortfalls reload explicitly when the period filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canAccess]);

  async function run(key: string, task: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      const result = await task();
      toast.success(success);
      return result;
    } catch (error) {
      toast.error(errorText(error, "Action failed."));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function submitDecision() {
    if (!decision) return;
    const id = rowId(decision.row);
    const payload = {
      decision: decision.decision,
      comments: decisionComments.trim() || undefined,
    };
    const task =
      decision.kind === "deferment"
        ? () => decideEmployeeFinanceDeferment(token(), id, payload)
        : decision.kind === "reschedule"
          ? () => decideEmployeeFinanceReschedule(token(), id, payload)
          : () => decideEmployeeFinanceAdjustment(token(), id, payload);
    const done = await run(
      `decision-${id}`,
      task,
      decision.decision === "APPROVED" ? "Approved." : "Rejected.",
    );
    if (done) {
      setDecision(null);
      setDecisionComments("");
      await loadServicing();
    }
  }

  async function submitRecovery() {
    if (!recoveryTarget) return;
    const done = await run(
      "recovery",
      () =>
        confirmEmployeeFinanceExitRecovery(token(), rowId(recoveryTarget), {
          amount: recoveryForm.amount,
          payment_reference: recoveryForm.payment_reference || undefined,
          payment_date: recoveryForm.payment_date || undefined,
        }),
      "Recovery posted to the loan.",
    );
    if (done) {
      setRecoveryTarget(null);
      await loadServicing();
    }
  }

  async function submitShortfall() {
    if (!shortfallTarget) return;
    const done = await run(
      "shortfall",
      () =>
        resolveEmployeeFinancePayrollShortfall(token(), readString(shortfallTarget, ["instruction_id"]), {
          resolution: shortfallForm.resolution,
          payment_reference: shortfallForm.payment_reference || undefined,
          payment_date: shortfallForm.payment_date || undefined,
          new_term_months: shortfallForm.new_term_months
            ? Number(shortfallForm.new_term_months)
            : undefined,
          comments: shortfallForm.comments || undefined,
        }),
      "Shortfall resolved.",
    );
    if (done) {
      setShortfallTarget(null);
      await loadShortfalls();
    }
  }

  const decisionButtons = (kind: DecisionTarget["kind"], row: AdminRecord) => (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={actionButtonClass}
        onClick={() => setDecision({ kind, row, decision: "APPROVED" })}
      >
        Approve
      </button>
      <button
        type="button"
        className={actionButtonClass}
        onClick={() => setDecision({ kind, row, decision: "REJECTED" })}
      >
        Reject
      </button>
    </div>
  );

  if (!canAccess) return null;

  const pendingAdjustments = adjustments.filter(
    (row) => readString(row, ["status"]).toUpperCase() === "PENDING",
  );
  const decidedAdjustments = adjustments.filter(
    (row) => readString(row, ["status"]).toUpperCase() !== "PENDING",
  );

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "payroll" ? (
        <header className={`${pageBleedClass} relative overflow-hidden bg-card px-5 py-7 text-foreground sm:px-8 sm:py-8`}>
          <SharedDashboardHeroBackground />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-5">
              <ReceiptMoney24Regular aria-hidden="true" className="size-9 shrink-0 text-muted-foreground" />
              <div aria-hidden="true" className="h-12 w-px bg-border" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Finance workspace</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payroll deductions</h1>
                  <PayrollGuide title="Payroll deductions">Check loan deductions before and after each payroll run, and decide how shortfalls are recovered.</PayrollGuide>
                </div>
              </div>
            </div>
            <Button appearance="subtle" size="large" className="!size-11 !min-w-11 !shrink-0 !text-foreground hover:!bg-primary/10 disabled:!opacity-50"
              aria-label="Refresh payroll deductions" title="Refresh payroll deductions" disabled={loading}
              icon={loading ? <FluentLoadingIndicator /> : <ArrowClockwise20Regular className="!size-6" />}
              onClick={() => void loadShortfalls()} />
          </div>
        </header>
      ) : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {activeTab === "servicing"
              ? "Loan servicing"
              : "Loan settings"}
          </h1>
          <div className="text-sm text-muted-foreground">
            {activeTab === "servicing"
              ? "Approve deferments, reschedules, penalties, waivers, write-offs, and exit recoveries. Requests need a second person to approve."
              : "Sanction letter wording and approval delegation while approvers are away."}
          </div>
        </div>
        <Button
          type="button"
          appearance="secondary"
          disabled={loading}
          onClick={() =>
            activeTab === "servicing"
              ? void loadServicing()
              : void loadSettings()
          }
        >
          {loading ? (
            <FluentLoadingIndicator className="size-4 animate-spin" />
          ) : (
            <ArrowClockwise20Regular />
          )}
          Refresh
        </Button>
      </div>
      )}

      {activeTab === "servicing" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Deferments waiting" value={deferments.length} />
            <MetricTile label="Reschedules waiting" value={reschedules.length} />
            <MetricTile label="Adjustments waiting" value={pendingAdjustments.length} />
            <MetricTile
              label="Open exit recoveries"
              value={
                recoveries.filter((row) =>
                  ["OPEN", "PARTIALLY_RECOVERED"].includes(
                    readString(row, ["status"]).toUpperCase(),
                  ),
                ).length
              }
            />
          </div>

          <Section
            title="Scheduled jobs"
            description="These run automatically every night (overdue) and every hour (approval reminders). Run them now if you need fresh figures."
            actions={
              <>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busy === "overdue"}
                  onClick={async () => {
                    const result = await run("overdue", () => runEmployeeFinanceOverdueSweep(token()), "Overdue check finished.");
                    setLastRun(asRecord(result));
                    await loadServicing();
                  }}
                >
                  Check overdue now
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busy === "escalation"}
                  onClick={async () => {
                    const result = await run("escalation", () => runEmployeeFinanceEscalationSweep(token()), "Approval reminders sent.");
                    setLastRun(asRecord(result));
                  }}
                >
                  Send approval reminders
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={busy === "backfill"}
                  onClick={async () => {
                    const result = await run("backfill", () => backfillEmployeeFinanceInterest(token(), true), "Interest check finished.");
                    setLastRun(asRecord(result));
                  }}
                >
                  Check older loans for missing interest
                </button>
              </>
            }
          >
            {lastRun ? (
              <div className="space-y-2 text-sm">
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(lastRun, null, 2)}
                </pre>
                {lastRun.dry_run === true && Number(lastRun.account_count ?? 0) > 0 ? (
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={busy === "backfill-apply"}
                    onClick={async () => {
                      const result = await run(
                        "backfill-apply",
                        () => backfillEmployeeFinanceInterest(token(), false),
                        "Missing interest booked.",
                      );
                      setLastRun(asRecord(result));
                    }}
                  >
                    Book missing interest on {String(lastRun.account_count)} loans
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No job run in this session.</p>
            )}
          </Section>

          <Section title="Deferment requests" description="Moving an instalment to after the last scheduled instalment.">
            <SimpleTable
              rows={deferments}
              empty="No deferments waiting."
              columns={[
                { key: "account", label: "Account", render: (row) => readString(row, ["accountId", "account_id"]) },
                { key: "due", label: "Current due date", render: (row) => readString(row, ["originalDueDate", "original_due_date"]) },
                { key: "reason", label: "Reason", render: (row) => readString(row, ["reason"]) },
                { key: "requested", label: "Requested", render: (row) => readString(row, ["createdAt", "created_at"]).slice(0, 10) },
                { key: "actions", label: "", render: (row) => decisionButtons("deferment", row) },
              ]}
            />
          </Section>

          <Section title="Reschedule requests" description="The approver sees the replacement schedule before anything changes.">
            <SimpleTable
              rows={reschedules}
              empty="No reschedules waiting."
              columns={[
                { key: "account", label: "Account", render: (row) => readString(row, ["accountId", "account_id"]) },
                {
                  key: "term",
                  label: "Term",
                  render: (row) =>
                    `${readString(row, ["oldTermMonths", "old_term_months"], "?")} → ${readString(row, ["newTermMonths", "new_term_months"])} months`,
                },
                {
                  key: "preview",
                  label: "New schedule",
                  render: (row) => {
                    const previewRow = asRecord(row.schedulePreview ?? row.schedule_preview);
                    return (
                      <div className="text-xs">
                        <p>Instalment {readString(previewRow, ["new_installment"], "—")}</p>
                        <p className="text-muted-foreground">
                          Principal {readString(previewRow, ["outstanding_principal"], "—")} · interest rebate{" "}
                          {readString(previewRow, ["unearned_interest_rebate"], "0.00")} · new interest{" "}
                          {readString(previewRow, ["new_interest_total"], "0.00")}
                        </p>
                      </div>
                    );
                  },
                },
                { key: "reason", label: "Reason", render: (row) => readString(row, ["reason"]) },
                { key: "actions", label: "", render: (row) => decisionButtons("reschedule", row) },
              ]}
            />
          </Section>

          <Section title="Penalties, waivers, and write-offs" description="Raised by Finance or by the overdue rule; posted only after approval.">
            <SimpleTable
              rows={pendingAdjustments}
              empty="No adjustments waiting."
              columns={[
                { key: "type", label: "Type", render: (row) => prettify(readString(row, ["adjustmentType", "adjustment_type"])) },
                { key: "account", label: "Account", render: (row) => readString(row, ["accountId", "account_id"]) },
                {
                  key: "amount",
                  label: "Amount",
                  render: (row) =>
                    [
                      ["principal", readString(row, ["principalAmount", "principal_amount"], "0.00")],
                      ["interest", readString(row, ["interestAmount", "interest_amount"], "0.00")],
                      ["fees", readString(row, ["feeAmount", "fee_amount"], "0.00")],
                    ]
                      .filter(([, value]) => Number(value) > 0)
                      .map(([label, value]) => `${label} ${value}`)
                      .join(", ") || "—",
                },
                { key: "source", label: "Source", render: (row) => prettify(readString(row, ["source"])) },
                { key: "reason", label: "Reason", render: (row) => readString(row, ["reason"]) },
                { key: "actions", label: "", render: (row) => decisionButtons("adjustment", row) },
              ]}
            />
            {decidedAdjustments.length ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Decided adjustments ({decidedAdjustments.length})
                </summary>
                <div className="mt-2">
                  <SimpleTable
                    rows={decidedAdjustments}
                    empty=""
                    columns={[
                      { key: "type", label: "Type", render: (row) => prettify(readString(row, ["adjustmentType", "adjustment_type"])) },
                      { key: "account", label: "Account", render: (row) => readString(row, ["accountId", "account_id"]) },
                      { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"])} /> },
                      { key: "reason", label: "Reason", render: (row) => readString(row, ["reason"]) },
                    ]}
                  />
                </div>
              </details>
            ) : null}
          </Section>

          <Section title="Exit recoveries" description="Loans of leavers, recovered from the final settlement. Record what was actually deducted.">
            <SimpleTable
              rows={recoveries}
              empty="No exit recoveries."
              columns={[
                { key: "offboarding", label: "Offboarding", render: (row) => readString(row, ["offboardingRequestId", "offboarding_request_id"]) },
                { key: "account", label: "Account", render: (row) => readString(asRecord(row.snapshot), ["account_no"], readString(row, ["accountId"])) },
                { key: "due", label: "To recover", render: (row) => readString(row, ["recoveryAmount", "recovery_amount"]) },
                { key: "done", label: "Recovered", render: (row) => readString(row, ["recoveredAmount", "recovered_amount"], "0.00") },
                { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"], "OPEN")} /> },
                {
                  key: "actions",
                  label: "",
                  render: (row) =>
                    ["OPEN", "PARTIALLY_RECOVERED"].includes(readString(row, ["status"], "OPEN").toUpperCase()) ? (
                      <button
                        type="button"
                        className={actionButtonClass}
                        onClick={() => {
                          setRecoveryTarget(row);
                          setRecoveryForm({ payment_date: new Date().toISOString().slice(0, 10) });
                        }}
                      >
                        Record recovery
                      </button>
                    ) : null,
                },
              ]}
            />
          </Section>
        </>
      ) : null}

      {activeTab === "payroll" ? (
        <>
          <Section
            guide
            title="Deduction preview"
            description="What loans expect the next payroll to deduct. Rows above the employee's usual deduction capacity are flagged so you can act before payroll runs."
            actions={
              <>
                <Input
                  className="!w-44"
                  aria-label="Payroll period ID" placeholder="Payroll period ID"
                  value={periodId}
                  onChange={(event) => setPeriodId(event.target.value)}
                />
                <Button
                  type="button"
                  appearance="primary"
                  disabled={!periodId || busy === "preview"}
                  onClick={async () => {
                    const result = await run("preview", () => getEmployeeFinancePayrollPreview(token(), periodId), "Preview ready.");
                    setPreview(asRecord(result));
                  }}
                >
                  Preview
                </Button>
              </>
            }
          >
            {preview ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  {Object.entries(asRecord(preview.totals) ?? {}).map(([key, value]) => (
                    <MetricTile key={key} label={prettify(key)} value={String(value ?? "")} />
                  ))}
                </div>
                <SimpleTable
                  rows={records(preview.employees)}
                  empty="Nothing due in this period."
                  columns={[
                    { key: "employee", label: "Employee", render: (row) => `${readString(row, ["employee_name"])} (${readString(row, ["employee_no"])})` },
                    { key: "total", label: "Deductions", render: (row) => readString(row, ["deduction_total"]) },
                    { key: "net", label: "Last net pay", render: (row) => readString(row, ["last_locked_net_pay"], "—") },
                    { key: "cap", label: "Capacity", render: (row) => readString(row, ["deduction_capacity"], "—") },
                    {
                      key: "risk",
                      label: "Risk",
                      render: (row) => (row.shortfall_risk ? <StatusChip value="SHORTFALL_RISK" /> : <StatusChip value="OK" />),
                    },
                    {
                      key: "items",
                      label: "Instalments",
                      render: (row) =>
                        records(row.items)
                          .map((item) => `${readString(item, ["account_no"])} #${readString(item, ["installment_number"])} ${readString(item, ["amount_due"])}`)
                          .join("; "),
                    },
                  ]}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a payroll period ID to preview.</p>
            )}
          </Section>

          <Section
            guide
            title="Payroll run reconciliation"
            description="For one run: what each loan asked for, what payroll reserved and put on the payslip, and what reached the loan ledger."
            actions={
              <>
                <Input
                  className="!w-44"
                  aria-label="Payroll run ID" placeholder="Payroll run ID"
                  value={runId}
                  onChange={(event) => setRunId(event.target.value)}
                />
                <Button
                  type="button"
                  appearance="primary"
                  disabled={!runId || busy === "run"}
                  onClick={async () => {
                    const result = await run("run", () => getEmployeeFinancePayrollRunDeductions(token(), runId), "Run loaded.");
                    setRunDeductions(asRecord(result));
                  }}
                >
                  Reconcile run
                </Button>
              </>
            }
          >
            {runDeductions ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  {Object.entries(asRecord(runDeductions.totals) ?? {}).map(([key, value]) => (
                    <MetricTile key={key} label={prettify(key)} value={String(value ?? "")} />
                  ))}
                </div>
                <SimpleTable
                  rows={records(runDeductions.rows)}
                  empty="No loan deductions in this run."
                  columns={[
                    { key: "employee", label: "Employee", render: (row) => readString(row, ["employee_name"], readString(row, ["employee_id"])) },
                    { key: "account", label: "Account", render: (row) => readString(row, ["account_no"]) },
                    { key: "requested", label: "Requested", render: (row) => readString(row, ["requested_amount"]) },
                    { key: "reserved", label: "Reserved", render: (row) => readString(row, ["reserved_amount"]) },
                    { key: "payslip", label: "Payslip", render: (row) => readString(row, ["payslip_amount"]) },
                    { key: "ledger", label: "Ledger", render: (row) => readString(row, ["ledger_amount"]) },
                    { key: "short", label: "Shortfall", render: (row) => readString(row, ["shortfall_amount"]) },
                    {
                      key: "issues",
                      label: "Check",
                      render: (row) => {
                        const issues = Array.isArray(row.issues) ? row.issues.map(String) : [];
                        return issues.length ? (
                          <span className="text-xs text-rose-600">{issues.map(prettify).join(", ")}</span>
                        ) : (
                          <StatusChip value="MATCHED" />
                        );
                      },
                    },
                  ]}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a payroll run ID to reconcile.</p>
            )}
          </Section>

          <Section
            guide
            title="Shortfalls"
            description="Deductions payroll could not take in full. Choose how each one is recovered."
            actions={
              <Button type="button" appearance="secondary" onClick={() => void loadShortfalls()}>
                Reload
              </Button>
            }
          >
            <SimpleTable
              rows={shortfalls}
              empty="No unresolved shortfalls."
              columns={[
                { key: "employee", label: "Employee", render: (row) => `${readString(row, ["employee_name"])} (${readString(row, ["employee_no"])})` },
                { key: "account", label: "Account", render: (row) => readString(row, ["account_no"]) },
                { key: "requested", label: "Requested", render: (row) => readString(row, ["requested_amount"]) },
                { key: "posted", label: "Deducted", render: (row) => readString(row, ["posted_amount"]) },
                { key: "short", label: "Shortfall", render: (row) => readString(row, ["shortfall_amount"]) },
                {
                  key: "actions",
                  label: "",
                  render: (row) => (
                    <Button
                      type="button"
                      appearance="secondary"
                      onClick={() => {
                        setShortfallTarget(row);
                        setShortfallForm({ resolution: "CARRY_FORWARD", payment_date: new Date().toISOString().slice(0, 10) });
                      }}
                    >
                      Resolve
                    </Button>
                  ),
                },
              ]}
            />
          </Section>
        </>
      ) : null}

      {activeTab === "settings" ? (
        <>
          <Section
            title="Sanction letter template"
            description="Used for letters issued from now on. Letters already issued keep the wording they were approved with."
            actions={
              <>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={!template.body || busy === "template-preview"}
                  onClick={async () => {
                    const result = await run(
                      "template-preview",
                      () => previewEmployeeFinanceSanctionTemplate(token(), template.body ?? ""),
                      "Preview ready.",
                    );
                    setTemplatePreview(readString(asRecord(result), ["content"], ""));
                  }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={busy === "template-save"}
                  onClick={() =>
                    void run(
                      "template-save",
                      () => saveEmployeeFinanceSanctionTemplate(token(), template),
                      "Template saved.",
                    )
                  }
                >
                  Save template
                </button>
              </>
            }
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Letterhead</span>
                  <input
                    className={inputClass}
                    value={template.letterhead ?? ""}
                    onChange={(event) => setTemplate((current) => ({ ...current, letterhead: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Letter body</span>
                  <Textarea
                    className={`${textareaClass} min-h-64 font-mono text-xs`}
                    value={template.body ?? ""}
                    onChange={(event) => setTemplate((current) => ({ ...current, body: event.target.value }))}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Signatory name</span>
                    <input
                      className={inputClass}
                      value={template.signatory_name ?? ""}
                      onChange={(event) => setTemplate((current) => ({ ...current, signatory_name: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Signatory title</span>
                    <input
                      className={inputClass}
                      value={template.signatory_title ?? ""}
                      onChange={(event) => setTemplate((current) => ({ ...current, signatory_title: event.target.value }))}
                    />
                  </label>
                </div>
                {placeholders.length ? (
                  <p className="text-xs text-muted-foreground">
                    Placeholders: {placeholders.map((key) => `{{${key}}}`).join(" ")}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Preview with sample data</p>
                <pre className="min-h-64 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
                  {templatePreview || "Select Preview to see the filled-in letter."}
                </pre>
              </div>
            </div>
          </Section>

          <Section
            title="Approval delegation"
            description="Let a colleague decide your loan approval stages while you are away. Their decisions are recorded as made on your behalf."
          >
            <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Delegate (company user ID)</span>
                  <input
                    className={inputClass}
                    value={delegationForm.delegate_company_user_id ?? ""}
                    onChange={(event) =>
                      setDelegationForm((current) => ({ ...current, delegate_company_user_id: event.target.value }))
                    }
                  />
                </label>
                <div className="grid gap-1.5 text-sm">
                  <span className="font-medium">Stages</span>
                  <div className="flex flex-wrap gap-3">
                    {APPROVAL_STAGES.map((stage) => (
                      <label key={stage} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={delegationStages.includes(stage)}
                          onChange={(event) =>
                            setDelegationStages((current) =>
                              event.target.checked
                                ? [...current, stage]
                                : current.filter((item) => item !== stage),
                            )
                          }
                        />
                        {prettify(stage)}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">From</span>
                    <DateInput
                      className={inputClass}
                      value={delegationForm.starts_on ?? ""}
                      onChange={(event) => setDelegationForm((current) => ({ ...current, starts_on: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">To</span>
                    <DateInput
                      className={inputClass}
                      value={delegationForm.ends_on ?? ""}
                      onChange={(event) => setDelegationForm((current) => ({ ...current, ends_on: event.target.value }))}
                    />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Reason</span>
                  <input
                    className={inputClass}
                    value={delegationForm.reason ?? ""}
                    onChange={(event) => setDelegationForm((current) => ({ ...current, reason: event.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={
                    busy === "delegate" ||
                    !delegationForm.delegate_company_user_id ||
                    !delegationForm.starts_on ||
                    !delegationForm.ends_on ||
                    !delegationStages.length
                  }
                  onClick={async () => {
                    const done = await run(
                      "delegate",
                      () =>
                        createEmployeeFinanceDelegation(token(), {
                          delegate_company_user_id: Number(delegationForm.delegate_company_user_id),
                          stages: delegationStages,
                          starts_on: delegationForm.starts_on,
                          ends_on: delegationForm.ends_on,
                          reason: delegationForm.reason || undefined,
                        }),
                      "Delegation created.",
                    );
                    if (done) {
                      setDelegationForm({});
                      setDelegationStages([]);
                      await loadSettings();
                    }
                  }}
                >
                  Delegate
                </button>
              </div>
              <SimpleTable
                rows={delegations}
                empty="No delegations."
                columns={[
                  { key: "from", label: "Delegator", render: (row) => readString(row, ["delegatorCompanyUserId", "delegator_company_user_id"]) },
                  { key: "to", label: "Delegate", render: (row) => readString(row, ["delegateCompanyUserId", "delegate_company_user_id"]) },
                  { key: "stages", label: "Stages", render: (row) => (Array.isArray(row.stages) ? row.stages.map(String).map(prettify).join(", ") : "") },
                  {
                    key: "dates",
                    label: "Dates",
                    render: (row) => `${readString(row, ["startsOn", "starts_on"])} – ${readString(row, ["endsOn", "ends_on"])}`,
                  },
                  { key: "status", label: "Status", render: (row) => <StatusChip value={readString(row, ["status"])} /> },
                  {
                    key: "actions",
                    label: "",
                    render: (row) =>
                      readString(row, ["status"]) === "ACTIVE" ? (
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={async () => {
                            const done = await run(`revoke-${rowId(row)}`, () => revokeEmployeeFinanceDelegation(token(), rowId(row)), "Delegation revoked.");
                            if (done) await loadSettings();
                          }}
                        >
                          Revoke
                        </button>
                      ) : null,
                  },
                ]}
              />
            </div>
          </Section>
        </>
      ) : null}

      <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decision?.decision === "APPROVED" ? "Approve" : "Reject"} {decision ? prettify(decision.kind) : ""}
            </DialogTitle>
            <DialogDescription>
              {decision?.decision === "APPROVED"
                ? "Approving posts the change to the loan immediately."
                : "Rejecting leaves the loan unchanged."}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Comments</span>
            <Textarea
              className={textareaClass}
              value={decisionComments}
              onChange={(event) => setDecisionComments(event.target.value)}
            />
          </label>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setDecision(null)}>
              Cancel
            </button>
            <button type="button" className={primaryButtonClass} disabled={Boolean(busy)} onClick={() => void submitDecision()}>
              Confirm
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={Boolean(recoveryTarget)} onOpenChange={(open) => !open && setRecoveryTarget(null)}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record exit recovery</DialogTitle>
            <DialogDescription>
              Enter the amount actually deducted from the final settlement. Anything short stays open for direct collection or write-off.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Amount recovered</span>
              <input
                className={inputClass}
                value={recoveryForm.amount ?? ""}
                onChange={(event) => setRecoveryForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Reference</span>
              <input
                className={inputClass}
                value={recoveryForm.payment_reference ?? ""}
                onChange={(event) => setRecoveryForm((current) => ({ ...current, payment_reference: event.target.value }))}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Date</span>
              <DateInput
                className={inputClass}
                value={recoveryForm.payment_date ?? ""}
                onChange={(event) => setRecoveryForm((current) => ({ ...current, payment_date: event.target.value }))}
              />
            </label>
          </div>
          <DialogFooter>
            <button type="button" className={secondaryButtonClass} onClick={() => setRecoveryTarget(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={!recoveryForm.amount || busy === "recovery"}
              onClick={() => void submitRecovery()}
            >
              Post recovery
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={Boolean(shortfallTarget)} onOpenChange={(open) => !open && setShortfallTarget(null)}>
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve shortfall of {readString(shortfallTarget, ["shortfall_amount"])}</DialogTitle>
            <DialogDescription>
              Carry forward leaves it for the next payroll. Direct collection and rescheduling create requests that still need approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Resolution">
              <FluentSelect
                ariaLabel="Resolution"
                className="w-full"
                value={shortfallForm.resolution ?? "CARRY_FORWARD"}
                onChange={(value) => setShortfallForm((current) => ({ ...current, resolution: value }))}
                options={[
                  { value: "CARRY_FORWARD", label: "Carry forward to next payroll" },
                  { value: "COLLECT_DIRECT", label: "Collect directly from the employee" },
                  { value: "RESCHEDULE", label: "Reschedule the loan" },
                ]}
              />
            </Field>
            {shortfallForm.resolution === "COLLECT_DIRECT" ? (
              <>
                <Field label="Payment reference">
                  <Input
                    className="w-full"
                    value={shortfallForm.payment_reference ?? ""}
                    onChange={(event) => setShortfallForm((current) => ({ ...current, payment_reference: event.target.value }))}
                  />
                </Field>
                <Field label="Payment date">
                  <DateInput
                    className="w-full"
                    value={shortfallForm.payment_date ?? ""}
                    onChange={(event) => setShortfallForm((current) => ({ ...current, payment_date: event.target.value }))}
                  />
                </Field>
              </>
            ) : null}
            {shortfallForm.resolution === "RESCHEDULE" ? (
              <Field label="New term (months)">
                <Input
                  className="w-full"
                  value={shortfallForm.new_term_months ?? ""}
                  onChange={(event) => setShortfallForm((current) => ({ ...current, new_term_months: event.target.value }))}
                />
              </Field>
            ) : null}
            <Field label="Comments">
              <FluentTextarea
                className="w-full"
                value={shortfallForm.comments ?? ""}
                onChange={(event) => setShortfallForm((current) => ({ ...current, comments: event.target.value }))}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" appearance="secondary" onClick={() => setShortfallTarget(null)}>
              Cancel
            </Button>
            <Button type="button" appearance="primary" disabled={busy === "shortfall"} onClick={() => void submitShortfall()}>
              Resolve
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
