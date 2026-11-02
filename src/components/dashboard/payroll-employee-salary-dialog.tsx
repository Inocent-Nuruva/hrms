"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import * as React from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  Field,
  Input,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  OverlayDrawer,
} from "@fluentui/react-components";

import { toast } from "@/components/ui/fluent-toast-store";

import { formatAdminValue } from "@/components/dashboard/admin-view-shared";
import { FluentSelect } from "@/components/ui/fluent-select";
import {
  assignEmployeePayrollSalary,
  approveEmployeePayrollSalary,
  getEmployeePayrollSalary,
  getPayrollSalaryStructure,
  listEligibleSalaryApprovers,
  type AdminRecord,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";

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
  canStartRevision = false,
  canApprove = canEdit,
  onChanged,
  drawer = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeLabel: string;
  structures: AdminRecord[];
  canEdit: boolean;
  canStartRevision?: boolean;
  canApprove?: boolean;
  onChanged?: () => void;
  drawer?: boolean;
}) {
  const [dirty, setDirty] = React.useState(false);
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
  const [approvers, setApprovers] = React.useState<AdminRecord[]>([]);
  const [assignedApproverId, setAssignedApproverId] = React.useState("");

  const closeSalary = async (nextOpen: boolean) => {
    if (!nextOpen && saving) return;
    if (
      !nextOpen &&
      dirty &&
      !(await fluentConfirm("Discard unsaved salary changes?", {
        title: "Discard salary changes?",
        confirmLabel: "Discard changes",
      }))
    )
      return;
    onOpenChange(nextOpen);
  };
  React.useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);

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
      const [salaryResult, approverRows] = await Promise.all([
        getEmployeePayrollSalary(token, employeeId),
        canEdit ? listEligibleSalaryApprovers(token) : Promise.resolve([]),
      ]);
      setSalary(salaryResult);
      setApprovers(approverRows);
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load employee salary.",
      );
    } finally {
      setLoading(false);
    }
  }, [canEdit, employeeId]);

  React.useEffect(() => {
    if (!open) return;
    setDirty(false);
    setStructureCode("");
    setStructureLines([]);
    setBaseSalary("");
    setEffectiveFrom(today());
    setJustification("");
    setOverrides({});
    setAssignedApproverId("");
    void load();
  }, [open, load]);

  async function onSelectStructure(code: string) {
    setDirty(true);
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
    if (!canEdit) {
      setError("Assign starting salary permission is required.");
      return;
    }
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token) return;
    if (
      !structureCode ||
      !baseSalary.trim() ||
      !effectiveFrom ||
      !assignedApproverId
    ) {
      setError(
        "Structure, base salary, effective date and salary approver are required.",
      );
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
    // Same grammar and rate bound the server applies to overrides.
    const isNumber = (value: string | undefined) =>
      /^\+?(\d+(\.\d+)?|\.\d+)$/.test(value ?? "");
    if (
      componentOverrides.some(
        (item) =>
          ("amount" in item && !isNumber(item.amount)) ||
          ("rate" in item &&
            (!isNumber(item.rate) || Number(item.rate) > 1000)),
      )
    ) {
      setError(
        "Enter a non-negative number for every amount override, and a rate between 0 and 1000 for every % of base override.",
      );
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
          assigned_approver_company_user_id: Number(assignedApproverId),
          justification: justification.trim() || undefined,
          component_overrides: componentOverrides.length
            ? componentOverrides
            : undefined,
        }),
      );
      toast.success("Salary structure assigned.");
      setDirty(false);
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

  async function onApprove() {
    const token = readStoredSessionTokens().accessToken.trim();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await approveEmployeePayrollSalary(token, employeeId);
      await load();
      toast.success("Starting salary approved and available to payroll.");
      setDirty(false);
      onChanged?.();
    } catch (errorObject) {
      setError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to approve salary.",
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
  const approval = rec(compensation?.approval);
  const submittedBy = rec(approval?.submitted_by);
  const assignedTo = rec(approval?.assigned_to);
  const approvedBy = rec(approval?.approved_by);

  return (
    <SalarySurface
      open={open}
      onOpenChange={(nextOpen) => void closeSalary(nextOpen)}
      drawer={drawer}
      employeeLabel={employeeLabel}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {error ? (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        ) : null}
        <div
          onChangeCapture={() => setDirty(true)}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
        >
          {loading && !salary ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading salary…
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <MessageBar intent="warning">
              <MessageBarBody className="space-y-1">
                {warnings.map((code) => (
                  <p key={code}>{WARNING_LABELS[code] ?? prettify(code)}</p>
                ))}
              </MessageBarBody>
            </MessageBar>
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

          {compensation ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Approval trail
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <SummaryField
                  label="Submitted by"
                  value={str(submittedBy, "name") || "Not recorded"}
                />
                <SummaryField
                  label="Assigned approver"
                  value={
                    str(assignedTo, "name") || "Any eligible salary approver"
                  }
                />
                <SummaryField
                  label="Approved by"
                  value={str(approvedBy, "name") || "Awaiting approval"}
                />
              </div>
            </Card>
          ) : null}

          {breakdown ? (
            <Card className="p-4">
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
                            <Badge appearance="outline" className="ml-2">
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
                    <Badge
                      key={str(item, "component_code")}
                      appearance="outline"
                    >
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
            </Card>
          ) : null}

          {compensation && canEdit ? (
            <MessageBar intent="info">
              <MessageBarBody>
                <span className="font-semibold">
                  Need to change this salary?
                </span>{" "}
                Start a salary revision to update the base salary, structure, or
                employee overrides. The revision will follow the movement
                approval workflow before payroll uses it.
              </MessageBarBody>
              {canStartRevision ? (
                <MessageBarActions>
                  <Button
                    appearance="primary"
                    onClick={() => {
                      window.location.assign(
                        `/dashboard/movements/cases?create=salary-revision&employee_id=${encodeURIComponent(employeeId)}`,
                      );
                    }}
                  >
                    Start salary revision
                  </Button>
                </MessageBarActions>
              ) : (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  The Employee movements: create permission is required to start
                  a revision.
                </p>
              )}
            </MessageBar>
          ) : null}

          {salary && !compensation && canEdit ? (
            <Card className="space-y-4 p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Assign salary structure
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Structure">
                  <FluentSelect
                    ariaLabel="Structure"
                    className="w-full"
                    value={structureCode}
                    onChange={(value) => void onSelectStructure(value)}
                    placeholder="Select structure"
                    options={[
                      { value: "", label: "Select structure" },
                      ...activeStructures.map((row) => ({
                        value: str(row, "code"),
                        label: `${str(row, "code")} · ${str(row, "name")}`,
                      })),
                    ]}
                  />
                </Field>
                <Field label="Base salary">
                  <Input
                    inputMode="decimal"
                    value={baseSalary}
                    onChange={(_, data) => setBaseSalary(data.value)}
                  />
                </Field>
                <Field label="Effective from">
                  <DateInput
                    className="max-w-none"
                    value={effectiveFrom}
                    onValueChange={setEffectiveFrom}
                  />
                </Field>
              </div>
              <Field
                label="Salary approver"
                hint="Only users granted “Approve starting salaries” can be selected. They are notified immediately."
              >
                <FluentSelect
                  ariaLabel="Salary approver"
                  className="w-full"
                  value={assignedApproverId}
                  onChange={setAssignedApproverId}
                  placeholder="Select the independent approver"
                  options={[
                    { value: "", label: "Select the independent approver" },
                    ...approvers.map((row) => ({
                      value: str(row, "company_user_id"),
                      label: str(row, "name") || str(row, "email"),
                    })),
                  ]}
                />
              </Field>
              <Field label="Justification">
                <Input
                  value={justification}
                  placeholder="Initial salary structure assignment"
                  onChange={(_, data) => setJustification(data.value)}
                />
              </Field>

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
                          <FluentSelect
                            ariaLabel={`${str(line, "component_name") || code} override`}
                            className="w-full"
                            value={draft.mode}
                            onChange={(value) =>
                              setOverrides((current) => ({
                                ...current,
                                [code]: {
                                  mode: value as OverrideDraft["mode"],
                                  value: "",
                                },
                              }))
                            }
                            options={[
                              { value: "default", label: "Use default" },
                              { value: "amount", label: "Fixed amount" },
                              { value: "rate", label: "% of base" },
                              { value: "exclude", label: "Exclude" },
                            ]}
                          />
                          <Input
                            inputMode="decimal"
                            disabled={
                              draft.mode === "default" ||
                              draft.mode === "exclude"
                            }
                            value={draft.value}
                            placeholder={
                              draft.mode === "rate" ? "Rate %" : "Amount"
                            }
                            onChange={(_, data) =>
                              setOverrides((current) => ({
                                ...current,
                                [code]: { ...draft, value: data.value },
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </Card>
          ) : null}
          {str(compensation, "status").toUpperCase() === "PENDING_APPROVAL" &&
          canApprove ? (
            <Button
              appearance="primary"
              disabled={saving}
              onClick={() => void onApprove()}
            >
              {saving ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : null}
              Approve starting salary
            </Button>
          ) : null}

          {history.length > 0 ? (
            <Card className="p-4">
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
            </Card>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button onClick={() => void closeSalary(false)}>Close</Button>
          {salary && !compensation && canEdit ? (
            <Button
              appearance="primary"
              disabled={saving}
              onClick={() => void onAssign()}
            >
              {saving ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : null}
              Assign salary
            </Button>
          ) : null}
        </div>
      </div>
    </SalarySurface>
  );
}

function SalarySurface({
  open,
  onOpenChange,
  drawer,
  employeeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawer: boolean;
  employeeLabel: string;
  children: React.ReactNode;
}) {
  if (drawer)
    return (
      <OverlayDrawer
        open={open}
        onOpenChange={(_, data) => onOpenChange(data.open)}
        position="end"
        size="large"
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button appearance="subtle" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            }
          >
            Joining salary & payroll
          </DrawerHeaderTitle>
          <p>{employeeLabel}</p>
        </DrawerHeader>
        <DrawerBody className="flex min-h-0 flex-col gap-4">
          {children}
        </DrawerBody>
      </OverlayDrawer>
    );
  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className="!w-[min(94vw,64rem)] !max-w-5xl">
        <DialogBody className="!max-h-[90vh] !min-h-0">
          <DialogTitle>Salary &amp; structure</DialogTitle>
          <DialogContent className="!flex !min-h-0 !flex-col !overflow-hidden">
            <p className="mb-4 text-sm text-muted-foreground">
              {employeeLabel}
            </p>
            {children}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <Card className="px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </Card>
  );
}
