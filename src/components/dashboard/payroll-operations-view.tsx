"use client";

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { fluentConfirm } from "@/components/ui/fluent-dialog-service";
import * as React from "react";
import {
  Add20Regular,
  ArrowClockwise20Regular,
  ArrowSwap20Regular,
  BuildingBank20Regular,
  CheckmarkCircle20Regular,
  CloudArrowUp20Regular,
  Delete20Regular,
  DocumentBulletList20Regular,
  DocumentSearch20Regular,
  Eye20Regular,
  PersonMoney20Regular,
} from "@fluentui/react-icons";
import {
  Avatar as FluentAvatar,
  Badge as FluentBadge,
  Button as FluentButton,
  Card as FluentCard,
  CardHeader as FluentCardHeader,
  Input as FluentInput,
  Field as FluentField,
  MessageBar,
  MessageBarBody,
  Tab,
  TabList,
  Text,
} from "@fluentui/react-components";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions";
import {
  RecordDetailsDialog,
  formatAdminValue,
} from "@/components/dashboard/admin-view-shared";
import {
  approvePayrollInput,
  approvePayrollRun,
  rejectPayrollRun,
  cancelPayrollRun,
  reversePayrollRun,
  getPayrollRunEligibility,
  approvePayrollStatutoryRule,
  approvePayrollSource,
  closePayrollRun,
  createPayrollAdjustment,
  createPayrollAccountingMapping,
  createPayrollBonusScheme,
  createPayrollCalendar,
  createPayrollComponent,
  createPayrollGroup,
  createPayrollGroupAssignment,
  createPayrollInput,
  createPayrollLeaveRule,
  createPayrollOvertimePolicy,
  createPayrollRun,
  activatePayrollSalaryStructure,
  createPayrollSalaryStructure,
  createPayrollSalaryStructureVersion,
  deletePayrollSalaryStructure,
  listPayrollSalaryStructureEmployees,
  retirePayrollSalaryStructure,
  updatePayrollSalaryStructure,
  updatePayrollCalendar,
  updatePayrollPeriodDates,
  updatePayrollSecurityPolicy,
  createPayrollSource,
  createPayrollStatutoryRule,
  createPayrollStatutoryScheme,
  downloadPayrollBankingBatch,
  exportPayrollAccountingJournal,
  generatePayrollAccountingJournals,
  generatePayrollBankingBatch,
  generatePayrollBankReadyBatch,
  generatePayrollPayslipsForRun,
  generatePayrollPeriod,
  getPayrollReport,
  calculatePayrollFinalSettlement,
  payrollFinalSettlementAction,
  downloadPayrollFinalSettlementStatement,
  extractDefaultAvatarImageUrl,
  extractProfilePhotoUrl,
  getPayrollDashboard,
  getPayrollIntegrationCatalog,
  getPayrollInternalLedger,
  getPayrollPaymentHistory,
  getPayrollNotificationCatalog,
  getPayrollReadiness,
  getPayrollRun,
  getPayrollSecurityPolicy,
  getPayrollSalaryStructure,
  importPayrollBankStatement,
  importPayrollSources,
  listPayrollReportCatalog,
  listAllEmployees,
  listEmployeePayrollProfiles,
  listOffboardingRequests,
  listPayrollAccountingMappings,
  listPayrollBonusSchemes,
  listPayrollCalendars,
  listPayrollComponents,
  listPayrollGroupAssignments,
  listPayrollGroups,
  listPayrollInputs,
  listPayrollLeaveRules,
  listPayrollOvertimeApprovals,
  listPayrollOvertimePolicies,
  listPayrollPayslipsForRun,
  listPayrollPeriods,
  listPayrollRuns,
  listPayrollSalaryStructures,
  listPayrollSources,
  listPayrollStatutorySchemes,
  listPayrollStatutoryRules,
  lockPayrollRun,
  markPayrollRunPaid,
  processPayrollRun,
  postPayrollAccountingJournal,
  postPayrollSource,
  reconcilePayrollPayment,
  rejectPayrollSource,
  reversePayrollAccountingJournal,
  validatePayrollRun,
  runPayrollReconciliation,
  runPayrollRunVariance,
  reviewPayrollVariance,
  simulatePayrollRunPayment,
  type AdminRecord,
  upsertEmployeePayrollProfile,
} from "@/lib/admin-api";
import { readStoredSessionTokens } from "@/lib/session-client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { Badge } from "@/components/ui/badge";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import { PayrollEmployeeSalaryDialog } from "@/components/dashboard/payroll-employee-salary-dialog";
import {
  PayrollApprovalWorkflowsPanel,
  PayrollAttendanceDeductionPoliciesPanel,
  PayrollPaymentProgressDialog,
  PayrollRecoveriesPanel,
} from "@/components/dashboard/payroll-lifecycle-panels";
import {
  PayrollContractWarningsDialog,
  contractWarningsCleared,
} from "@/components/dashboard/contracts/payroll-contract-warnings-dialog";
import type { PayrollContractWarnings } from "@/lib/contracts-api";

type PayrollTab =
  | "overview"
  | "runs"
  | "inputs"
  | "sources"
  | "overtimeApprovals"
  | "profiles"
  | "periods"
  | "reports"
  | "recoveries"
  | "configuration";

type PayrollConfigTab =
  | "components"
  | "calendars"
  | "structures"
  | "schemes"
  | "mappings"
  | "groups"
  | "assignments"
  | "overtime"
  | "bonus"
  | "leaveRules"
  | "security"
  | "approvalWorkflows"
  | "attendanceDeductions";

type CreateDialogMode =
  | "run"
  | "input"
  | "profile"
  | "period"
  | "component"
  | "calendar"
  | "structure"
  | "scheme"
  | "mapping"
  | "group"
  | "assignment"
  | "overtime"
  | "bonus"
  | "leaveRule"
  | "source"
  | "sourceImport"
  | "adjustment";

const TABS: Array<{ id: PayrollTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "runs", label: "Runs" },
  { id: "inputs", label: "Inputs" },
  { id: "sources", label: "Sources" },
  { id: "overtimeApprovals", label: "Approved OT" },
  { id: "profiles", label: "Profiles" },
  { id: "periods", label: "Periods" },
  { id: "reports", label: "Reports" },
  { id: "recoveries", label: "Recoveries" },
  { id: "configuration", label: "Configuration" },
];

const CONFIG_TABS: Array<{ id: PayrollConfigTab; label: string }> = [
  { id: "components", label: "Components" },
  { id: "calendars", label: "Calendars" },
  { id: "structures", label: "Structures" },
  { id: "schemes", label: "Schemes" },
  { id: "mappings", label: "Mappings" },
  { id: "groups", label: "Groups" },
  { id: "assignments", label: "Assignments" },
  { id: "overtime", label: "Overtime" },
  { id: "bonus", label: "Bonus" },
  { id: "leaveRules", label: "Leave rules" },
  { id: "security", label: "Security & approvals" },
  { id: "approvalWorkflows", label: "Approval workflows" },
  { id: "attendanceDeductions", label: "Attendance deductions" },
];

const RUN_TYPES = [
  "REGULAR",
  "SUPPLEMENTARY",
  "OFF_CYCLE",
  "FINAL_SETTLEMENT",
  "BONUS",
  "ARREARS",
  "ADJUSTMENT",
  "REVERSAL",
  "PARALLEL_TEST",
] as const;

const PAYROLL_REPORT_CODES = [
  "payroll-register",
  "payroll-summary",
  "employee-payroll-history",
  "department-payroll",
  "branch-payroll",
  "cost-centre-payroll",
  "gross-to-net",
  "allowances",
  "deductions",
  "deduction-shortfalls",
  "overtime",
  "loan",
  "advance",
  "payroll-run-reconciliation",
  "employer-contributions",
  "tax",
  "pension",
  "wcf",
  "bank-payment",
  "payroll-journal",
  "payroll-cost",
  "headcount-vs-payroll",
  "ytd-earnings",
  "ytd-tax",
  "ytd-contributions",
] as const;

const PAYROLL_REPORT_SHORTCUTS = [
  { code: "payroll-register", label: "Register" },
  { code: "tax", label: "Tax" },
  { code: "pension", label: "Pension" },
  { code: "wcf", label: "WCF" },
  { code: "payroll-cost", label: "Cost" },
  { code: "headcount-vs-payroll", label: "Headcount" },
] as const;

const PAYROLL_DRILLDOWN_SHORTCUTS = [
  { code: "payroll-run-reconciliation", label: "Run reconciliation" },
  { code: "loan", label: "Loans" },
  { code: "advance", label: "Advances" },
  { code: "deduction-shortfalls", label: "Shortfalls" },
  { code: "ytd-earnings", label: "YTD" },
  { code: "ytd-tax", label: "YTD tax" },
  { code: "ytd-contributions", label: "Pension YTD" },
  { code: "employee-payroll-history", label: "History" },
] as const;

const APPROVAL_STAGES = ["HR", "FINANCE", "MANAGEMENT"] as const;
// Mirrors PayrollRunService.cancel / reverseRun allowed source statuses.
const CANCELLABLE_RUN_STATUSES = new Set([
  "DRAFT",
  "VALIDATION_FAILED",
  "PENDING_HR_APPROVAL",
  "PENDING_FINANCE_APPROVAL",
  "PENDING_MANAGEMENT_APPROVAL",
  "APPROVED",
]);
const REVERSIBLE_RUN_STATUSES = new Set([
  "LOCKED",
  "PAYMENT_FILE_GENERATED",
  "PAID",
]);
const INPUT_STATUSES = [
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "LOCKED",
  "PENDING_LOAN_INTEGRATION",
] as const;
const COMPONENT_TYPES = [
  "EARNING",
  "DEDUCTION",
  "EMPLOYER_CONTRIBUTION",
  "EMPLOYER_LEVY",
  "REIMBURSEMENT",
  "TAXABLE_BENEFIT",
  "INFORMATIONAL",
] as const;
const FREQUENCIES = [
  "RECURRING",
  "ONE_TIME",
  "DAILY",
  "HOURLY",
  "ANNUAL",
] as const;
const CALCULATION_METHODS = [
  "FIXED_AMOUNT",
  "PERCENTAGE_OF_BASE",
  "PERCENTAGE_OF_GROSS",
  "PERCENTAGE_OF_COMPONENTS",
  "QUANTITY_TIMES_RATE",
  "PROGRESSIVE_BANDS",
  "THRESHOLD_BANDS",
  "FORMULA_TEMPLATE",
  "EXTERNAL_INPUT",
] as const;
const TAX_TREATMENTS = [
  "TAXABLE",
  "NON_TAXABLE",
  "PARTIALLY_TAXABLE",
  "TAX_EXEMPT",
] as const;
const SCHEME_TYPES = [
  "PAYE",
  "PENSION",
  "HEALTH_INSURANCE",
  "EMPLOYER_LEVY",
  "OTHER",
] as const;
const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "CASH",
  "CHEQUE",
] as const;
const PAY_FREQUENCIES = [
  "MONTHLY",
  "SEMI_MONTHLY",
  "BIWEEKLY",
  "WEEKLY",
] as const;

const inputClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background";
const textareaClass =
  "min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-border dark:bg-background";
const actionButtonClass =
  "inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted";
const primaryButtonClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold !text-white transition hover:brightness-95 disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function readString(
  row: AdminRecord | null | undefined,
  keys: string[],
  fallback = "",
) {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
  }
  return fallback;
}

function readNumber(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBoolean(row: AdminRecord | null | undefined, keys: string[]) {
  if (!row) return false;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
  }
  return false;
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function asRecordArray(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AdminRecord =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

function prettify(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCurrencyAmount(value: unknown, currencyHint?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${currencyHint ?? ""} ${value.toLocaleString()}`.trim();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return `${currencyHint ?? ""} ${parsed.toLocaleString()}`.trim();
    }
    return value;
  }
  return "—";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type BankPaymentEntry = {
  id: number;
  employeeNo: string;
  accountMasked: string;
  reference: string;
  amount: string;
  status: string;
};

const BANK_STATEMENT_HEADERS = [
  "employee_id",
  "employee_no",
  "account_number_masked",
  "reference",
  "amount",
  "status",
];

function bankStatementRowsToCsv(rows: BankPaymentEntry[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const values = rows
    .filter(
      (row) =>
        row.employeeNo || row.accountMasked || row.reference || row.amount,
    )
    .map((row) => [
      "",
      row.employeeNo,
      row.accountMasked,
      row.reference,
      row.amount,
      row.status,
    ]);
  return [
    BANK_STATEMENT_HEADERS.join(","),
    ...values.map((row) => row.map(escape).join(",")),
  ].join("\n");
}

function downloadBankStatementTemplate() {
  const csv = `${BANK_STATEMENT_HEADERS.join(",")}\n`;
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    "payroll-bank-statement-template.csv",
  );
}

function optionLabel(row: AdminRecord) {
  return (
    readString(row, ["name", "title", "code", "display_name", "displayName"]) ||
    `#${readNumber(row, ["id"]) ?? "record"}`
  );
}

function readDimensionEntries(
  row: AdminRecord,
): Array<{ label: string; value: string }> {
  let raw: unknown =
    row.dimensions ?? row.dimensions_json ?? row.dimensionsJson;
  if (typeof raw === "string" && raw.trim()) {
    const rawText = raw.trim();
    try {
      raw = JSON.parse(rawText);
    } catch {
      return [{ label: "Notes", value: rawText }];
    }
  }
  const record = asRecord(raw);
  if (!record) return [];
  return Object.entries(record)
    .map(([key, value]) => ({
      label: prettify(key),
      value:
        typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : formatAdminValue(value),
    }))
    .filter((entry) => entry.value && entry.value !== "-");
}

function groupReportIssues(result: AdminRecord | null) {
  const issues = asRecordArray(result?.issues);
  const issueCount =
    readNumber(result, ["issue_count", "issueCount"]) ?? issues.length;
  const groups = new Map<string, AdminRecord[]>();
  for (const issue of issues) {
    const code = readString(issue, ["code", "type"], "UNKNOWN");
    const current = groups.get(code) ?? [];
    current.push(issue);
    groups.set(code, current);
  }
  return {
    issueCount,
    groups: Array.from(groups.entries())
      .map(([code, rows]) => ({ code, rows, count: rows.length }))
      .sort((first, second) => second.count - first.count),
  };
}

type EmployeeNameLookup = Map<
  number,
  { name: string; number: string; avatarUrl: string | null }
>;

function nameFromEmployeeRow(row: AdminRecord) {
  const first = readString(row, ["first_name", "firstName"]);
  const last = readString(row, ["last_name", "lastName"]);
  const combined = [first, last].filter(Boolean).join(" ");
  return (
    readString(row, [
      "full_name",
      "fullName",
      "employee_name",
      "employeeName",
      "display_name",
      "displayName",
      "name",
    ]) || combined
  );
}

function employeeNumberFromRow(row: AdminRecord) {
  return readString(row, [
    "employee_no",
    "employeeNo",
    "employee_number",
    "staff_no",
    "staffNo",
  ]);
}

function employeeAvatarFromRow(row: AdminRecord) {
  const direct = extractProfilePhotoUrl(row);
  if (direct) return direct;
  const defaultAvatar =
    asRecord(row.selected_default_avatar) ??
    asRecord(row.selectedDefaultAvatar) ??
    asRecord(asRecord(row.user)?.selected_default_avatar) ??
    asRecord(asRecord(row.user)?.selectedDefaultAvatar);
  return extractDefaultAvatarImageUrl(defaultAvatar);
}

function issueSubject(issue: AdminRecord, names?: EmployeeNameLookup) {
  const employeeId = readNumber(issue, ["employee_id", "employeeId"]);
  if (employeeId !== null) {
    const known = names?.get(employeeId);
    if (known?.name) return known.name;
    return `Employee ${employeeId}`;
  }
  const runId = readNumber(issue, ["run_id", "runId"]);
  if (runId !== null) return `Run ${runId}`;
  const message = readString(issue, ["message", "detail", "description"]);
  if (message) return message;
  return "Issue";
}

function issueDetailLines(issue: AdminRecord, names?: EmployeeNameLookup) {
  const employeeId = readNumber(issue, ["employee_id", "employeeId"]);
  const known = employeeId !== null ? names?.get(employeeId) : undefined;
  const lines = Object.entries(issue)
    .filter(([key, value]) => {
      if (["code", "type", "employee_id", "employeeId"].includes(key))
        return false;
      return value !== null && value !== undefined && value !== "";
    })
    .map(([key, value]) => ({
      label: prettify(key),
      value:
        typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : formatAdminValue(value),
    }))
    .filter((entry) => entry.value && entry.value !== "-");

  if (known?.number) {
    lines.unshift({ label: "Employee no", value: known.number });
  } else if (employeeId !== null && !known?.name) {
    lines.unshift({ label: "Employee no", value: String(employeeId) });
  }

  return lines;
}

function rowId(row: AdminRecord | null | undefined) {
  const id = readNumber(row, [
    "id",
    "runId",
    "run_id",
    "profileId",
    "profile_id",
  ]);
  return id !== null ? String(id) : "";
}

function statusTone(label: string) {
  const normalized = label.toUpperCase();
  if (
    [
      "ACTIVE",
      "APPROVED",
      "COMPLETED",
      "SUCCESS",
      "LOCKED",
      "READY",
      "GENERATED",
    ].includes(normalized)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (
    ["PENDING", "DRAFT", "PROCESSING", "RUNNING", "IN_PROGRESS"].includes(
      normalized,
    )
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300";
  }
  if (["FAILED", "REJECTED", "ERROR", "HOLD"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
  }
  return "border-border bg-muted/40 text-muted-foreground";
}

function issueGroupTone(code: string) {
  const normalized = code.toUpperCase();
  if (normalized.includes("PROFILE")) {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60";
  }
  if (normalized.includes("COMPENSATION") || normalized.includes("SALARY")) {
    return "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60";
  }
  if (normalized.includes("BANK")) {
    return "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/60";
  }
  return "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-950/60";
}

function issueGroupDot(code: string) {
  const normalized = code.toUpperCase();
  if (normalized.includes("PROFILE")) return "bg-amber-500";
  if (normalized.includes("COMPENSATION") || normalized.includes("SALARY"))
    return "bg-rose-500";
  if (normalized.includes("BANK")) return "bg-sky-500";
  return "bg-violet-500";
}

function readPeriodLabel(row: AdminRecord | null | undefined) {
  if (!row) return "—";
  return (
    readString(row, ["name", "title", "period_name", "periodName"]) ||
    [readString(row, ["month"]), readString(row, ["year"])]
      .filter(Boolean)
      .join(" / ") ||
    `Period #${readNumber(row, ["id"]) ?? "—"}`
  );
}

function readEmployeeLabel(
  row: AdminRecord | null | undefined,
  names?: EmployeeNameLookup,
) {
  if (!row) return "—";
  const employeeId = readNumber(row, ["employee_id", "employeeId"]);
  const nestedEmployee =
    (typeof row.employee === "object" &&
    row.employee &&
    !Array.isArray(row.employee)
      ? (row.employee as AdminRecord)
      : null) ?? null;
  return (
    readString(row, [
      "employee_name",
      "employeeName",
      "full_name",
      "fullName",
    ]) ||
    readString(nestedEmployee, ["full_name", "fullName", "name"]) ||
    (employeeId !== null ? names?.get(employeeId)?.name : "") ||
    (employeeId !== null ? `Employee #${employeeId}` : "—")
  );
}

function readStatus(row: AdminRecord | null | undefined) {
  return readString(
    row,
    ["status", "run_status", "state", "approval_status"],
    "UNKNOWN",
  );
}

function emptyRunForm() {
  return {
    payrollPeriodId: "",
    payrollGroupId: "",
    runType: "REGULAR",
    parentRunId: "",
    offboardingRequestId: "",
  };
}

function emptyInputForm() {
  return {
    payrollPeriodId: "",
    employeeId: "",
    componentCode: "",
    sourceModule: "",
    sourceReference: "",
    amount: "",
    quantity: "",
    rate: "",
    currency: "TZS",
    status: "DRAFT",
    lateAdjustmentReason: "",
  };
}

function emptyProfileForm() {
  return {
    employeeId: "",
    payrollNumber: "",
    taxpayerIdentificationNumber: "",
    socialSecuritySchemeCode: "",
    socialSecurityNumber: "",
    healthInsuranceSchemeCode: "",
    healthInsuranceNumber: "",
    taxResidencyCode: "",
    employmentTaxCategory: "",
    paymentMethod: "",
    primaryBankAccountId: "",
    currency: "TZS",
    payFrequency: "MONTHLY",
    payrollEnabled: "true",
    payrollHold: "false",
    payrollHoldReason: "",
    effectiveFrom: "",
    effectiveTo: "",
  };
}

function emptyPeriodForm() {
  const today = new Date();
  return {
    payrollCalendarId: "",
    year: String(today.getFullYear()),
    month: String(today.getMonth() + 1),
  };
}

function emptyComponentForm() {
  return {
    code: "",
    name: "",
    componentType: "EARNING",
    frequency: "RECURRING",
    calculationMethod: "FIXED_AMOUNT",
    taxTreatment: "TAXABLE",
    taxablePercentage: "",
    pensionable: "false",
    healthInsuranceApplicable: "false",
    includedInGross: "true",
    includedInNet: "true",
    includedInEmployerCost: "false",
    subjectToProration: "false",
    allowManualInput: "true",
    calculationOrder: "1",
  };
}

function emptyCalendarForm() {
  return {
    code: "",
    name: "",
    cutoffDay: "25",
    paymentDay: "28",
    timezone: "Africa/Dar_es_Salaam",
    currency: "TZS",
    isDefault: "false",
    reason: "",
  };
}

type StructureLine = {
  componentId: string;
  defaultAmount: string;
  defaultRate: string;
  calculationOrder: string;
};

function emptyStructureLine(): StructureLine {
  return {
    componentId: "",
    defaultAmount: "",
    defaultRate: "",
    calculationOrder: "1",
  };
}

function emptyStructureForm() {
  return {
    code: "",
    name: "",
    description: "",
    currency: "TZS",
    effectiveFrom: "",
    effectiveTo: "",
    components: [emptyStructureLine()],
  };
}

function emptySchemeForm() {
  return {
    code: "",
    name: "",
    schemeType: "PAYE",
    jurisdiction: "",
  };
}

function emptyRuleForm() {
  return {
    schemeId: "",
    versionNumber: "1",
    calculationMethod: "FIXED_AMOUNT",
    employeeRate: "",
    employerRate: "",
    maximumBasis: "",
    deductEmployeeBeforeTax: "false",
    effectiveFrom: "",
    effectiveTo: "",
    lowerLimit: "",
    upperLimit: "",
    baseTax: "",
    ratePercent: "",
    sortOrder: "1",
    sourceReference: "",
    employerExempt: "false",
  };
}

function emptyMappingForm() {
  return {
    componentCode: "",
    debitAccountCode: "",
    creditAccountCode: "",
    projectDebitMap: "",
    projectCreditMap: "",
    costCenterDebitMap: "",
    costCenterCreditMap: "",
    departmentDebitMap: "",
    departmentCreditMap: "",
    branchDebitMap: "",
    branchCreditMap: "",
    categoryDebitMap: "",
    categoryCreditMap: "",
    groupDebitMap: "",
    groupCreditMap: "",
    dimensionsJson: "",
  };
}

function emptyAdvancedPayrollForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    code: "",
    name: "",
    frequency: "MONTHLY",
    payrollCalendarId: "",
    branchId: "",
    departmentId: "",
    employeeCategory: "",
    employmentType: "",
    currency: "TZS",
    componentCode: "",
    regularMultiplier: "1.5",
    weekendMultiplier: "2",
    holidayMultiplier: "2",
    minimumMinutes: "0",
    effectiveFrom: today,
    effectiveTo: "",
    schemeType: "BONUS",
    calculationMethod: "FIXED_AMOUNT",
    defaultAmount: "",
    defaultRate: "",
    payrollPeriodId: "",
    employeeId: "",
    amount: "",
    reason: "",
    adjustmentType: "ADJUSTMENT",
    effectivePeriodCode: "",
    correctionOfRunId: "",
    autoApprove: "true",
    reportCode: "",
    reportRunId: "",
    reportYear: String(new Date().getFullYear()),
    paymentReference: "",
    paymentDate: today,
    paidAmount: "",
    importText: "",
    providerKey: "",
    autoPost: "false",
    bankImportRunId: "",
    bankBatchId: "",
    journalRunId: "",
    journalBatchId: "",
    externalReference: "",
    exportFormat: "csv",
    sourceType: "SALES",
    sourceReference: "",
    schemeCode: "",
    sourceAmount: "",
    quantity: "",
    rate: "",
    calculatedAmount: "",
    payrollGroupId: "",
    leaveTypeCode: "",
    paidPercentage: "100",
    paidDaysCap: "",
    halfPayAfterDays: "",
    unpaidAfterDays: "",
    carryForwardCapDays: "",
  };
}

function emptyApproveRunForm() {
  return {
    stage: "HR",
    calculationHash: "",
    comments: "",
  };
}

function parseAccountingDimensionMap(value: string) {
  const entries = value
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key?.trim(), rest.join("=").trim()] as const;
    })
    .filter(([key, account]) => key && account);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function setDimensionMap(
  target: Record<string, unknown>,
  key: string,
  value: string,
) {
  const parsed = parseAccountingDimensionMap(value);
  if (parsed) target[key] = parsed;
}

function reportRowsToCsv(rows: AdminRecord[]) {
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  ).slice(0, 24);
  const escape = (value: unknown) =>
    `"${formatAdminValue(value).replace(/"/g, '""')}"`;
  return [
    columns.join(","),
    ...rows.map((row) =>
      columns.map((column) => escape(row[column])).join(","),
    ),
  ].join("\n");
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </div>
  );
}

function PayrollDetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function PayrollDetailsContent({
  tab,
  configTab,
  row,
}: {
  tab: PayrollTab;
  configTab: PayrollConfigTab;
  row: AdminRecord | null;
}) {
  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">
        No payroll details are available for this record.
      </p>
    );
  }

  const status = readStatus(row);
  const statusClass = statusTone(status);
  const currency = readString(row, ["currency"], "TZS");
  const createdAt = formatDateTime(row.created_at ?? row.createdAt);
  const updatedAt = formatDateTime(row.updated_at ?? row.updatedAt);

  if (tab === "runs") {
    const gross = formatCurrencyAmount(
      row.gross_pay ?? row.grossPay ?? row.total_gross_pay ?? row.totalGrossPay,
      currency,
    );
    const net = formatCurrencyAmount(
      row.net_pay ?? row.netPay ?? row.total_net_pay ?? row.totalNetPay,
      currency,
    );
    const payslips = asRecordArray(row.payslips);
    const runApprovals = asRecordArray(row.approvals);
    const currentCalculationHash = readString(row, [
      "calculation_hash",
      "calculationHash",
    ]);
    const employeeCount =
      readNumber(row, [
        "employee_count",
        "employeeCount",
        "processed_employee_count",
        "processedEmployeeCount",
      ]) ?? payslips.length;
    const runName = readString(
      row,
      ["run_no", "runNo", "name"],
      `Run #${rowId(row) || "—"}`,
    );
    const runType = prettify(
      readString(row, ["run_type", "runType"], "REGULAR"),
    );

    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">
                {runName}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {runType} for {readPeriodLabel(row)}
              </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField label="Gross pay" value={gross} />
          <PayrollDetailField label="Net pay" value={net} />
          <PayrollDetailField
            label="Employees"
            value={employeeCount !== null ? String(employeeCount) : "—"}
          />
          <PayrollDetailField
            label="Payslips generated"
            value={String(payslips.length)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Run information
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PayrollDetailField label="Period" value={readPeriodLabel(row)} />
              <PayrollDetailField label="Currency" value={currency} />
              <PayrollDetailField
                label="Parent run"
                value={readString(
                  row,
                  [
                    "parent_run_no",
                    "parentRunNo",
                    "parent_run_id",
                    "parentRunId",
                  ],
                  "—",
                )}
              />
              <PayrollDetailField
                label="Offboarding request"
                value={readString(
                  row,
                  ["offboarding_request_id", "offboardingRequestId"],
                  "—",
                )}
              />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Audit</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <PayrollDetailField label="Created" value={createdAt} />
              <PayrollDetailField label="Updated" value={updatedAt} />
              <PayrollDetailField
                label="Approval status"
                value={readString(
                  row,
                  ["approval_status", "approvalStatus"],
                  "—",
                )}
              />
              <PayrollDetailField
                label="Calculation hash"
                value={readString(
                  row,
                  ["calculation_hash", "calculationHash"],
                  "—",
                )}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Approval workflow
          </h3>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {["HR", "FINANCE", "MANAGEMENT"].map((stage) => {
              const approval = [...runApprovals]
                .reverse()
                .find(
                  (item) => readString(item, ["stage"]).toUpperCase() === stage,
                );
              const current = Boolean(
                approval &&
                readString(approval, ["decision"]).toUpperCase() ===
                  "APPROVED" &&
                readString(approval, [
                  "calculationHash",
                  "calculation_hash",
                ]) === currentCalculationHash,
              );
              return (
                <div
                  key={stage}
                  className="rounded-lg border border-border/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {prettify(stage)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize",
                        current ? statusTone("APPROVED") : "",
                      )}
                    >
                      {current ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                  {current ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Approver #
                      {readString(approval!, [
                        "approvedByCompanyUserId",
                        "approved_by_company_user_id",
                      ])}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Approvals apply only to the current calculation hash; all approvers
            must be different users and separate from the payroll creator.
          </p>
          {runApprovals.length ? (
            <div className="mt-3 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Decision history
              </h4>
              {[...runApprovals].reverse().map((item, index) => {
                const decision = readString(item, ["decision"]).toUpperCase();
                const rejected = decision === "REJECTED";
                const comments = readString(item, ["comments"]);
                const when = readString(item, ["createdAt", "created_at"]);
                return (
                  <div
                    key={`${rowId(item) || index}`}
                    className={cn(
                      "rounded-lg border p-2 text-xs",
                      rejected
                        ? "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
                        : "border-border/70",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {prettify(readString(item, ["stage"]))} ·{" "}
                        {rejected ? "Rejected" : "Approved"} by user #
                        {readString(item, [
                          "approvedByCompanyUserId",
                          "approved_by_company_user_id",
                        ])}
                      </span>
                      <span className="text-muted-foreground">
                        {when ? new Date(when).toLocaleString() : ""}
                      </span>
                    </div>
                    {comments ? (
                      <p
                        className={cn(
                          "mt-1",
                          rejected
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {rejected ? "Reason: " : ""}
                        {comments}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {payslips.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Generated payslips
            </h3>
            <div className="mt-3 grid gap-2">
              {payslips.slice(0, 8).map((payslip, index) => (
                <div
                  key={`${rowId(payslip) || index}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2"
                >
                  <div className="text-sm font-medium text-foreground">
                    {readEmployeeLabel(payslip)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrencyAmount(
                      payslip.net_pay ?? payslip.netPay,
                      readString(payslip, ["currency"], currency),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (tab === "inputs") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">
                {readEmployeeLabel(row)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {readString(
                  row,
                  ["component_code", "componentCode"],
                  "Component",
                )}{" "}
                for {readPeriodLabel(row)}
              </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Amount"
            value={formatCurrencyAmount(
              row.amount,
              readString(row, ["currency"], currency),
            )}
          />
          <PayrollDetailField
            label="Quantity"
            value={formatAdminValue(row.quantity)}
          />
          <PayrollDetailField label="Rate" value={formatAdminValue(row.rate)} />
          <PayrollDetailField
            label="Currency"
            value={readString(row, ["currency"], currency)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayrollDetailField
            label="Source module"
            value={readString(row, ["source_module", "sourceModule"], "—")}
          />
          <PayrollDetailField
            label="Source reference"
            value={readString(
              row,
              ["source_reference", "sourceReference"],
              "—",
            )}
          />
          <PayrollDetailField label="Created" value={createdAt} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    );
  }

  if (tab === "profiles") {
    const enabled = readBoolean(row, ["payroll_enabled", "payrollEnabled"]);
    const onHold = readBoolean(row, ["payroll_hold", "payrollHold"]);
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">
            {readEmployeeLabel(row)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {readString(
              row,
              ["payroll_number", "payrollNumber"],
              "Payroll number pending",
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Payroll status"
            value={enabled ? "Enabled" : "Disabled"}
          />
          <PayrollDetailField
            label="Hold status"
            value={onHold ? "On hold" : "Normal processing"}
          />
          <PayrollDetailField
            label="Payment method"
            value={readString(row, ["payment_method", "paymentMethod"], "—")}
          />
          <PayrollDetailField
            label="Currency"
            value={readString(row, ["currency"], currency)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayrollDetailField
            label="Effective from"
            value={formatAdminValue(row.effective_from ?? row.effectiveFrom)}
          />
          <PayrollDetailField
            label="Effective to"
            value={formatAdminValue(row.effective_to ?? row.effectiveTo)}
          />
          <PayrollDetailField
            label="Tax category"
            value={readString(
              row,
              ["employment_tax_category", "employmentTaxCategory"],
              "—",
            )}
          />
          <PayrollDetailField
            label="Pay frequency"
            value={readString(row, ["pay_frequency", "payFrequency"], "—")}
          />
          <PayrollDetailField
            label="TIN"
            value={readString(
              row,
              [
                "taxpayer_identification_number",
                "taxpayerIdentificationNumber",
              ],
              "—",
            )}
          />
          <PayrollDetailField
            label="Bank account ID"
            value={readString(
              row,
              ["primary_bank_account_id", "primaryBankAccountId"],
              "—",
            )}
          />
          <PayrollDetailField
            label="Hold reason"
            value={readString(
              row,
              ["payroll_hold_reason", "payrollHoldReason"],
              "—",
            )}
          />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    );
  }

  if (tab === "periods") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-foreground">
                {readPeriodLabel(row)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {readString(
                  row,
                  ["code", "period_code", "periodCode"],
                  "Period code not provided",
                )}
              </div>
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Calendar"
            value={readString(
              row,
              ["calendar_name", "calendarName", "payroll_calendar_name"],
              "—",
            )}
          />
          <PayrollDetailField
            label="Start date"
            value={formatAdminValue(row.start_date ?? row.startDate)}
          />
          <PayrollDetailField
            label="End date"
            value={formatAdminValue(row.end_date ?? row.endDate)}
          />
          <PayrollDetailField
            label="Payment date"
            value={formatAdminValue(row.payment_date ?? row.paymentDate)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PayrollDetailField
            label="Month"
            value={readString(row, ["month"], "—")}
          />
          <PayrollDetailField
            label="Year"
            value={readString(row, ["year"], "—")}
          />
          <PayrollDetailField label="Created" value={createdAt} />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    );
  }

  if (configTab === "components") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">
            {optionLabel(row)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {prettify(
              readString(row, ["component_type", "componentType"], "EARNING"),
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Calculation"
            value={prettify(
              readString(
                row,
                ["calculation_method", "calculationMethod"],
                "FIXED_AMOUNT",
              ),
            )}
          />
          <PayrollDetailField
            label="Frequency"
            value={prettify(readString(row, ["frequency"], "RECURRING"))}
          />
          <PayrollDetailField
            label="Tax treatment"
            value={prettify(
              readString(row, ["tax_treatment", "taxTreatment"], "TAXABLE"),
            )}
          />
          <PayrollDetailField
            label="Order"
            value={readString(
              row,
              ["calculation_order", "calculationOrder"],
              "—",
            )}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PayrollDetailField
            label="Included in gross"
            value={
              readBoolean(row, ["included_in_gross", "includedInGross"])
                ? "Yes"
                : "No"
            }
          />
          <PayrollDetailField
            label="Included in net"
            value={
              readBoolean(row, ["included_in_net", "includedInNet"])
                ? "Yes"
                : "No"
            }
          />
          <PayrollDetailField
            label="Manual input"
            value={
              readBoolean(row, ["allow_manual_input", "allowManualInput"])
                ? "Allowed"
                : "System only"
            }
          />
          <PayrollDetailField
            label="Pensionable"
            value={readBoolean(row, ["pensionable"]) ? "Yes" : "No"}
          />
          <PayrollDetailField
            label="Health insurance"
            value={
              readBoolean(row, [
                "health_insurance_applicable",
                "healthInsuranceApplicable",
              ])
                ? "Applicable"
                : "Not applicable"
            }
          />
          <PayrollDetailField
            label="Prorated"
            value={
              readBoolean(row, ["subject_to_proration", "subjectToProration"])
                ? "Yes"
                : "No"
            }
          />
        </div>
      </div>
    );
  }

  if (configTab === "calendars") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">
            {optionLabel(row)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {readString(row, ["timezone"], "Africa/Dar_es_Salaam")}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Currency"
            value={readString(row, ["currency"], currency)}
          />
          <PayrollDetailField
            label="Cut-off day"
            value={readString(row, ["cutoff_day", "cutoffDay"], "—")}
          />
          <PayrollDetailField
            label="Payment day"
            value={readString(row, ["payment_day", "paymentDay"], "—")}
          />
          <PayrollDetailField
            label="Default"
            value={readBoolean(row, ["is_default", "isDefault"]) ? "Yes" : "No"}
          />
        </div>
      </div>
    );
  }

  if (configTab === "structures") {
    const lines = asRecordArray(row.components);
    const versions = asRecordArray(row.versions);
    const employees = asRecordArray(row.assigned_employees);
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold text-foreground">
              {optionLabel(row)}
            </div>
            <Badge variant="outline" className={cn("capitalize", statusClass)}>
              {prettify(status)}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {readString(row, ["code"])} · v
            {readString(row, ["versionNumber", "version_number"], "1")} ·{" "}
            {readString(row, ["currency"], currency)}
          </div>
          {readString(row, ["description"]) ? (
            <p className="mt-2 text-sm text-foreground">
              {readString(row, ["description"])}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Effective from"
            value={formatAdminValue(row.effective_from ?? row.effectiveFrom)}
          />
          <PayrollDetailField
            label="Effective to"
            value={formatAdminValue(row.effective_to ?? row.effectiveTo)}
          />
          <PayrollDetailField
            label="Employees"
            value={String(
              readNumber(row, ["assigned_employee_count"]) ?? employees.length,
            )}
          />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>

        {lines.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">
              Structure lines
            </h3>
            <div className="mt-3 grid gap-2">
              {lines.map((line, index) => (
                <div
                  key={`${rowId(line) || index}`}
                  className="grid gap-2 rounded-xl bg-muted/40 px-3 py-2 md:grid-cols-[minmax(0,1fr)_140px_140px]"
                >
                  <div className="text-sm font-medium text-foreground">
                    {readString(
                      asRecord(line.component),
                      ["name", "title", "code"],
                      readString(
                        line,
                        ["component_name", "component_code", "componentCode"],
                        `Component ${index + 1}`,
                      ),
                    )}
                    {readString(line, ["component_code"]) === "BASIC" ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Paid from employee base salary
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Amount:{" "}
                    {formatCurrencyAmount(
                      line.default_amount ?? line.defaultAmount,
                      currency,
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rate:{" "}
                    {formatAdminValue(line.default_rate ?? line.defaultRate)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {versions.length > 1 ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Versions</h3>
            <div className="mt-3 grid gap-2">
              {versions.map((version) => (
                <div
                  key={rowId(version)}
                  className="grid gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs md:grid-cols-3"
                >
                  <span className="font-medium text-foreground">
                    v{readString(version, ["versionNumber", "version_number"])}
                    {rowId(version) === rowId(row) ? " (this)" : ""}
                  </span>
                  <span>{prettify(readStatus(version))}</span>
                  <span>
                    {formatAdminValue(version.effectiveFrom)} →{" "}
                    {formatAdminValue(version.effectiveTo)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Assigned employees
          </h3>
          {employees.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No employees are paid on this structure yet. Assign it from a
              payroll profile&apos;s Salary action, or with a salary revision
              movement.
            </p>
          ) : (
            <div className="mt-3 grid gap-2">
              {employees.map((employee) => (
                <div
                  key={readString(employee, ["compensation_id"])}
                  className="grid gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs md:grid-cols-[minmax(0,1fr)_140px_140px]"
                >
                  <span className="text-sm font-medium text-foreground">
                    {readString(employee, ["employee_name"], "Employee")}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {readString(employee, ["employee_no"])}
                    </span>
                    {readBoolean(employee, ["has_overrides"]) ? (
                      <Badge variant="outline" className="ml-2">
                        Overrides
                      </Badge>
                    ) : null}
                  </span>
                  <span>
                    {formatCurrencyAmount(
                      employee.base_salary,
                      readString(employee, ["currency"], currency),
                    )}
                  </span>
                  <span>From {formatAdminValue(employee.effective_from)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (configTab === "schemes") {
    return (
      <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-base font-semibold text-foreground">
            {optionLabel(row)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {prettify(readString(row, ["scheme_type", "schemeType"], "OTHER"))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PayrollDetailField
            label="Jurisdiction"
            value={readString(row, ["jurisdiction"], "—")}
          />
          <PayrollDetailField
            label="Code"
            value={readString(row, ["code"], "—")}
          />
          <PayrollDetailField
            label="Status"
            value={
              readBoolean(row, ["is_active", "isActive"])
                ? "Active"
                : prettify(status)
            }
          />
          <PayrollDetailField label="Updated" value={updatedAt} />
        </div>
      </div>
    );
  }

  const dimensions = readDimensionEntries(row);

  return (
    <div className="max-h-[65vh] space-y-4 overflow-auto pr-1">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-base font-semibold text-foreground">
          {readString(
            row,
            ["component_code", "componentCode"],
            optionLabel(row),
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PayrollDetailField
          label="Debit account"
          value={readString(
            row,
            ["debit_account_code", "debitAccountCode"],
            "—",
          )}
        />
        <PayrollDetailField
          label="Credit account"
          value={readString(
            row,
            ["credit_account_code", "creditAccountCode"],
            "—",
          )}
        />
        <PayrollDetailField label="Currency" value={currency} />
        <PayrollDetailField label="Updated" value={updatedAt} />
      </div>

      {dimensions.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {dimensions.map((entry) => (
            <PayrollDetailField
              key={entry.label}
              label={entry.label}
              value={entry.value}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PayrollOperationsView() {
  const router = useRouter();
  const actor = useDashboardActor();
  const canAccessPayroll = canAccessDashboardRoute(
    "/dashboard/operations/payroll",
    actor.permissionLabels,
    actor.accessMode,
  );

  React.useEffect(() => {
    if (!actor.ready) {
      return;
    }
    if (!canAccessPayroll) {
      router.replace(
        actor.accessMode === "employee"
          ? "/dashboard/me/finance/payroll"
          : "/dashboard",
      );
    }
  }, [actor.accessMode, actor.ready, canAccessPayroll, router]);

  const [tab, setTab] = React.useState<PayrollTab>("overview");
  const [configTab, setConfigTab] =
    React.useState<PayrollConfigTab>("components");
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [profileSummaryRows, setProfileSummaryRows] = React.useState<
    AdminRecord[] | null
  >(null);
  const [periods, setPeriods] = React.useState<AdminRecord[]>([]);
  const [components, setComponents] = React.useState<AdminRecord[]>([]);
  const [calendars, setCalendars] = React.useState<AdminRecord[]>([]);
  const [structures, setStructures] = React.useState<AdminRecord[]>([]);
  const [schemes, setSchemes] = React.useState<AdminRecord[]>([]);
  const [statutoryRules, setStatutoryRules] = React.useState<AdminRecord[]>([]);
  const [approvingStatutoryRuleId, setApprovingStatutoryRuleId] =
    React.useState("");
  const [mappings, setMappings] = React.useState<AdminRecord[]>([]);
  const [groups, setGroups] = React.useState<AdminRecord[]>([]);
  const [, setGroupAssignments] = React.useState<AdminRecord[]>([]);
  const [, setOvertimePolicies] = React.useState<AdminRecord[]>([]);
  const [, setBonusSchemes] = React.useState<AdminRecord[]>([]);
  const [, setLeaveRules] = React.useState<AdminRecord[]>([]);
  const [recentRuns, setRecentRuns] = React.useState<AdminRecord[]>([]);
  const [offboardingRequests, setOffboardingRequests] = React.useState<
    AdminRecord[]
  >([]);
  const [varianceRunId, setVarianceRunId] = React.useState("");
  const [comparisonRunId, setComparisonRunId] = React.useState("");
  const [varianceExplanations, setVarianceExplanations] = React.useState<
    Record<string, string>
  >({});
  const [settlementRequestId, setSettlementRequestId] = React.useState("");
  const [reportBusy, setReportBusy] = React.useState("");
  const [reportResult, setReportResult] = React.useState<AdminRecord | null>(
    null,
  );
  const [reportKind, setReportKind] = React.useState<
    | "reconciliation"
    | "variance"
    | "settlement"
    | "validation"
    | "catalog"
    | "report"
    | "readiness"
    | "integrations"
    | "notifications"
    | ""
  >("");
  const [reportCatalog, setReportCatalog] = React.useState<AdminRecord[]>([]);
  const [issueDialogCode, setIssueDialogCode] = React.useState("");
  const [issueSearch, setIssueSearch] = React.useState("");
  const [employeeNames, setEmployeeNames] = React.useState<EmployeeNameLookup>(
    new Map(),
  );
  const [employeeDirectoryLoaded, setEmployeeDirectoryLoaded] =
    React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [periodFilter, setPeriodFilter] = React.useState("");

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailRecord, setDetailRecord] = React.useState<AdminRecord | null>(
    null,
  );

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<CreateDialogMode>("run");
  const [ruleOpen, setRuleOpen] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [approveRunId, setApproveRunId] = React.useState("");
  const [lifecycleAction, setLifecycleAction] = React.useState<{
    kind: "cancel" | "reverse" | "paid";
    row: AdminRecord;
  } | null>(null);
  const [lifecycleReason, setLifecycleReason] = React.useState("");
  const [paymentProgressRunId, setPaymentProgressRunId] = React.useState<
    string | null
  >(null);
  const [lifecyclePaymentReference, setLifecyclePaymentReference] =
    React.useState("");
  const [lifecyclePaymentDate, setLifecyclePaymentDate] = React.useState("");
  const [lifecycleBankWithdrawn, setLifecycleBankWithdrawn] =
    React.useState(false);
  const [lifecycleError, setLifecycleError] = React.useState<string | null>(
    null,
  );
  const [eligibilityReport, setEligibilityReport] = React.useState<{
    loading: boolean;
    data: AdminRecord | null;
  } | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [runForm, setRunForm] = React.useState(emptyRunForm);
  const [inputForm, setInputForm] = React.useState(emptyInputForm);
  const [profileForm, setProfileForm] = React.useState(emptyProfileForm);
  const [periodForm, setPeriodForm] = React.useState(emptyPeriodForm);
  const [componentForm, setComponentForm] = React.useState(emptyComponentForm);
  const [calendarForm, setCalendarForm] = React.useState(emptyCalendarForm);
  const [securityPolicy, setSecurityPolicy] = React.useState<AdminRecord>({
    allow_verified_login: false,
    allow_fresh_authenticator: true,
  });
  const [securityPolicyReason, setSecurityPolicyReason] = React.useState("");
  const [securityPolicyLoading, setSecurityPolicyLoading] =
    React.useState(false);
  const [securityPolicySaving, setSecurityPolicySaving] = React.useState(false);
  const [editingCalendar, setEditingCalendar] =
    React.useState<AdminRecord | null>(null);
  const [periodDatesTarget, setPeriodDatesTarget] =
    React.useState<AdminRecord | null>(null);
  const [periodDatesForm, setPeriodDatesForm] = React.useState({
    cutoffDate: "",
    paymentDate: "",
    reason: "",
  });
  const [structureForm, setStructureForm] = React.useState(emptyStructureForm);
  const [editingStructure, setEditingStructure] =
    React.useState<AdminRecord | null>(null);
  const [structureActionId, setStructureActionId] = React.useState("");
  const [versionTarget, setVersionTarget] = React.useState<AdminRecord | null>(
    null,
  );
  const [versionEffectiveFrom, setVersionEffectiveFrom] = React.useState("");
  const [salaryTarget, setSalaryTarget] = React.useState<{
    employeeId: string;
    label: string;
  } | null>(null);
  const [schemeForm, setSchemeForm] = React.useState(emptySchemeForm);
  const [ruleForm, setRuleForm] = React.useState(emptyRuleForm);
  const ruleSchemeCode = React.useMemo(() => {
    const selected = schemes.find(
      (row) => String(readNumber(row, ["id"]) ?? "") === ruleForm.schemeId,
    );
    return readString(selected ?? {}, ["code"]).toUpperCase();
  }, [ruleForm.schemeId, schemes]);
  const [mappingForm, setMappingForm] = React.useState(emptyMappingForm);
  const [advancedForm, setAdvancedForm] = React.useState(
    emptyAdvancedPayrollForm,
  );
  const [reportPage, setReportPage] = React.useState(1);
  const [reportSearch, setReportSearch] = React.useState("");
  const [bankInputMode, setBankInputMode] = React.useState<"manual" | "csv">(
    "manual",
  );
  const [bankPaymentRows, setBankPaymentRows] = React.useState<
    BankPaymentEntry[]
  >([
    {
      id: 1,
      employeeNo: "",
      accountMasked: "",
      reference: "",
      amount: "",
      status: "PAID",
    },
  ]);
  const [bankCsvText, setBankCsvText] = React.useState("");
  const [bankCsvName, setBankCsvName] = React.useState("");
  const [bankCsvError, setBankCsvError] = React.useState("");
  const bankFileInputRef = React.useRef<HTMLInputElement>(null);
  const [approveForm, setApproveForm] = React.useState(emptyApproveRunForm);

  const [processingRunId, setProcessingRunId] = React.useState("");
  const [processTarget, setProcessTarget] = React.useState<AdminRecord | null>(
    null,
  );
  const [processAuthenticatorCode, setProcessAuthenticatorCode] =
    React.useState("");
  const [lockingRunId, setLockingRunId] = React.useState("");
  const [contractWarnings, setContractWarnings] =
    React.useState<PayrollContractWarnings | null>(null);
  const pendingLockRow = React.useRef<AdminRecord | null>(null);
  const [validatingRunId, setValidatingRunId] = React.useState("");
  const [paidRunId, setPaidRunId] = React.useState("");
  const [simulatingPaymentRunId, setSimulatingPaymentRunId] =
    React.useState("");
  const [closingRunId, setClosingRunId] = React.useState("");
  const [reconcilingRunId, setReconcilingRunId] = React.useState("");
  const [payslipRunId, setPayslipRunId] = React.useState("");
  const [bankingRunId, setBankingRunId] = React.useState("");
  const [journalRunId, setJournalRunId] = React.useState("");
  const [approvingInputId, setApprovingInputId] = React.useState("");
  const [sourceActionId, setSourceActionId] = React.useState("");
  const requestIdRef = React.useRef(0);
  const lookupsCacheRef = React.useRef<{
    dashboard: AdminRecord | null;
    profiles: AdminRecord[] | null;
    periods: AdminRecord[];
    components: AdminRecord[];
    calendars: AdminRecord[];
    structures: AdminRecord[];
    schemes: AdminRecord[];
    statutoryRules: AdminRecord[];
    mappings: AdminRecord[];
    groups: AdminRecord[];
    groupAssignments: AdminRecord[];
    overtimePolicies: AdminRecord[];
    bonusSchemes: AdminRecord[];
    leaveRules: AdminRecord[];
    recentRuns: AdminRecord[];
  } | null>(null);

  const applyLookups = React.useCallback(
    (next: NonNullable<typeof lookupsCacheRef.current>) => {
      setDashboard(next.dashboard);
      setProfileSummaryRows(next.profiles);
      setPeriods(next.periods);
      setComponents(next.components);
      setCalendars(next.calendars);
      setStructures(next.structures);
      setSchemes(next.schemes);
      setStatutoryRules(next.statutoryRules);
      setMappings(next.mappings);
      setGroups(next.groups);
      setGroupAssignments(next.groupAssignments);
      setOvertimePolicies(next.overtimePolicies);
      setBonusSchemes(next.bonusSchemes);
      setLeaveRules(next.leaveRules);
      setRecentRuns(next.recentRuns);
    },
    [],
  );

  const fetchLookups = React.useCallback(
    async (token: string, force = false) => {
      if (lookupsCacheRef.current && !force) {
        return lookupsCacheRef.current;
      }

      const [
        dashboardResult,
        profilesResult,
        periodsResult,
        componentsResult,
        calendarsResult,
        structuresResult,
        schemesResult,
        statutoryRulesResult,
        mappingsResult,
        groupsResult,
        groupAssignmentsResult,
        overtimePoliciesResult,
        bonusSchemesResult,
        leaveRulesResult,
        recentRunsResult,
      ] = await Promise.allSettled([
        getPayrollDashboard(token),
        listEmployeePayrollProfiles(token, { page: 1, limit: 100 }),
        listPayrollPeriods(token),
        listPayrollComponents(token),
        listPayrollCalendars(token),
        listPayrollSalaryStructures(token),
        listPayrollStatutorySchemes(token),
        listPayrollStatutoryRules(token),
        listPayrollAccountingMappings(token),
        listPayrollGroups(token),
        listPayrollGroupAssignments(token),
        listPayrollOvertimePolicies(token),
        listPayrollBonusSchemes(token),
        listPayrollLeaveRules(token),
        listPayrollRuns(token, { page: 1, limit: 5 }),
      ]);

      const next = {
        dashboard:
          dashboardResult.status === "fulfilled" && dashboardResult.value
            ? dashboardResult.value
            : null,
        profiles:
          profilesResult.status === "fulfilled"
            ? profilesResult.value.rows
            : null,
        periods:
          periodsResult.status === "fulfilled" ? periodsResult.value : [],
        components:
          componentsResult.status === "fulfilled" ? componentsResult.value : [],
        calendars:
          calendarsResult.status === "fulfilled" ? calendarsResult.value : [],
        structures:
          structuresResult.status === "fulfilled" ? structuresResult.value : [],
        schemes:
          schemesResult.status === "fulfilled" ? schemesResult.value : [],
        statutoryRules:
          statutoryRulesResult.status === "fulfilled"
            ? statutoryRulesResult.value
            : [],
        mappings:
          mappingsResult.status === "fulfilled" ? mappingsResult.value : [],
        groups: groupsResult.status === "fulfilled" ? groupsResult.value : [],
        groupAssignments:
          groupAssignmentsResult.status === "fulfilled"
            ? groupAssignmentsResult.value
            : [],
        overtimePolicies:
          overtimePoliciesResult.status === "fulfilled"
            ? overtimePoliciesResult.value
            : [],
        bonusSchemes:
          bonusSchemesResult.status === "fulfilled"
            ? bonusSchemesResult.value
            : [],
        leaveRules:
          leaveRulesResult.status === "fulfilled" ? leaveRulesResult.value : [],
        recentRuns:
          recentRunsResult.status === "fulfilled"
            ? (recentRunsResult.value.rows ?? [])
            : [],
      };
      lookupsCacheRef.current = next;
      applyLookups(next);
      return next;
    },
    [applyLookups],
  );

  const loadRows = React.useCallback(
    async (options?: { refreshLookups?: boolean }) => {
      if (!actor.ready) {
        return;
      }
      if (!canAccessPayroll) {
        setRows([]);
        setLoading(false);
        setError(null);
        return;
      }

      const token = readStoredToken();
      if (!token) {
        setError("Authentication required. Please log in again.");
        setRows([]);
        setLoading(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoading(true);
      setError(null);

      try {
        const lookups = await fetchLookups(
          token,
          options?.refreshLookups === true,
        );
        if (requestIdRef.current !== requestId) return;

        if (tab === "overview") {
          setRows([]);
          return;
        }

        if (tab === "reports") {
          const [runsResult, offboardingResult] = await Promise.allSettled([
            listPayrollRuns(token, { page: 1, limit: 20 }),
            listOffboardingRequests(token, { page: 1, limit: 20 }),
          ]);
          if (requestIdRef.current !== requestId) return;
          if (runsResult.status === "fulfilled")
            setRecentRuns(runsResult.value.rows ?? []);
          if (offboardingResult.status === "fulfilled")
            setOffboardingRequests(offboardingResult.value.rows ?? []);
          setRows([]);
          return;
        }

        if (tab === "runs") {
          const result = await listPayrollRuns(token, {
            page: 1,
            limit: 100,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
          });
          if (requestIdRef.current === requestId) setRows(result.rows);
          return;
        }

        if (tab === "inputs") {
          const result = await listPayrollInputs(token, {
            page: 1,
            limit: 100,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
          });
          if (requestIdRef.current === requestId) setRows(result.rows);
          return;
        }

        if (tab === "sources") {
          const result = await listPayrollSources(token, {
            page: 1,
            limit: 100,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
          });
          if (requestIdRef.current === requestId) setRows(result.rows);
          return;
        }

        if (tab === "overtimeApprovals") {
          const result = await listPayrollOvertimeApprovals(token);
          if (requestIdRef.current === requestId) setRows(result.rows);
          return;
        }

        if (tab === "profiles") {
          const result = await listEmployeePayrollProfiles(token, {
            page: 1,
            limit: 100,
            search: search.trim() || undefined,
            status: statusFilter || undefined,
            employee_id: undefined,
          });
          if (requestIdRef.current === requestId) setRows(result.rows);
          return;
        }

        if (tab === "periods") {
          const query = search.trim().toLowerCase();
          const filtered = lookups.periods.filter((row) => {
            if (!query) return true;
            return [
              readString(row, ["name", "title", "month", "year", "status"]),
              readString(row, ["period_code", "periodCode"]),
              readString(row, ["start_date", "startDate"]),
              readString(row, ["end_date", "endDate"]),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);
          });
          setRows(filtered);
          return;
        }

        const configRows =
          configTab === "components"
            ? lookups.components
            : configTab === "calendars"
              ? lookups.calendars
              : configTab === "structures"
                ? lookups.structures
                : configTab === "schemes"
                  ? lookups.schemes
                  : configTab === "mappings"
                    ? lookups.mappings
                    : configTab === "groups"
                      ? lookups.groups
                      : configTab === "overtime"
                        ? lookups.overtimePolicies
                        : configTab === "bonus"
                          ? lookups.bonusSchemes
                          : configTab === "assignments"
                            ? lookups.groupAssignments
                            : configTab === "leaveRules"
                              ? lookups.leaveRules
                              : [];

        const query = search.trim().toLowerCase();
        const filtered = configRows.filter((row) => {
          if (!query) return true;
          return JSON.stringify(row).toLowerCase().includes(query);
        });
        setRows(filtered);
      } catch (errorObject) {
        if (requestIdRef.current === requestId) {
          setError(
            errorObject instanceof Error
              ? errorObject.message
              : "Failed to load payroll.",
          );
          setRows([]);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [
      actor.ready,
      canAccessPayroll,
      configTab,
      fetchLookups,
      periodFilter,
      search,
      statusFilter,
      tab,
    ],
  );

  React.useEffect(() => {
    void loadRows();
  }, [loadRows]);

  React.useEffect(() => {
    if (tab !== "configuration" || configTab !== "security") return;
    const token = readStoredToken();
    if (!token) return;
    let active = true;
    setSecurityPolicyLoading(true);
    void getPayrollSecurityPolicy(token)
      .then((payload) => {
        if (active && payload && typeof payload === "object") {
          setSecurityPolicy(payload as AdminRecord);
        }
      })
      .catch((errorObject) => {
        if (active) {
          toast.error(
            errorObject instanceof Error
              ? errorObject.message
              : "Could not load payroll security settings.",
          );
        }
      })
      .finally(() => {
        if (active) setSecurityPolicyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configTab, tab]);

  React.useEffect(() => {
    setSearch("");
    setStatusFilter("");
    setPeriodFilter("");
    setRows([]);
    setDetailOpen(false);
    setDetailRecord(null);
    setDetailLoading(false);
    setFormError(null);
  }, [tab, configTab]);

  const openCreate = (mode: CreateDialogMode) => {
    setFormError(null);
    setCreateMode(mode);
    if (mode === "calendar" && editingCalendar) {
      setEditingCalendar(null);
      setCalendarForm(emptyCalendarForm());
    }
    if (
      [
        "group",
        "assignment",
        "overtime",
        "bonus",
        "leaveRule",
        "source",
        "sourceImport",
        "adjustment",
      ].includes(mode)
    ) {
      setAdvancedForm(emptyAdvancedPayrollForm());
    }
    if (mode === "structure" && editingStructure) {
      setEditingStructure(null);
      setStructureForm(emptyStructureForm());
    }
    setCreateOpen(true);
  };

  const openEditCalendar = (row: AdminRecord) => {
    setEditingCalendar(row);
    setCalendarForm({
      code: readString(row, ["code"]),
      name: readString(row, ["name"]),
      cutoffDay: readString(row, ["cutoffDay", "cutoff_day"], "20"),
      paymentDay: readString(row, ["paymentDay", "payment_day"], "28"),
      timezone: readString(row, ["timezone"], "Africa/Dar_es_Salaam"),
      currency: readString(row, ["currency"], "TZS"),
      isDefault: readBoolean(row, ["isDefault", "is_default"])
        ? "true"
        : "false",
      reason: "",
    });
    setFormError(null);
    setCreateMode("calendar");
    setCreateOpen(true);
  };

  const openEditPeriodDates = (row: AdminRecord) => {
    setPeriodDatesTarget(row);
    setPeriodDatesForm({
      cutoffDate: readString(row, ["cutoffDate", "cutoff_date"]),
      paymentDate: readString(row, ["paymentDate", "payment_date"]),
      reason: "",
    });
    setFormError(null);
  };

  const openEditStructure = async (row: AdminRecord) => {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setStructureActionId(id);
    try {
      const detail = (await getPayrollSalaryStructure(token, id)) ?? row;
      const lines = asRecordArray(detail.components);
      setStructureForm({
        code: readString(detail, ["code"]),
        name: readString(detail, ["name"]),
        description: readString(detail, ["description"]),
        currency: readString(detail, ["currency"], "TZS"),
        effectiveFrom: readString(detail, ["effectiveFrom", "effective_from"]),
        effectiveTo: readString(detail, ["effectiveTo", "effective_to"]),
        components: lines.length
          ? lines.map((line) => ({
              componentId: readString(line, ["componentId", "component_id"]),
              defaultAmount: readString(line, [
                "defaultAmount",
                "default_amount",
              ]),
              defaultRate: readString(line, ["defaultRate", "default_rate"]),
              calculationOrder: readString(
                line,
                ["calculationOrder", "calculation_order"],
                "1",
              ),
            }))
          : [emptyStructureLine()],
      });
      setEditingStructure(detail);
      setFormError(null);
      setCreateMode("structure");
      setCreateOpen(true);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load structure.",
      );
    } finally {
      setStructureActionId("");
    }
  };

  async function runStructureAction(
    row: AdminRecord,
    action: "activate" | "retire" | "delete",
  ) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    const label = `${readString(row, ["code"])} v${readString(row, ["versionNumber", "version_number"], "1")}`;
    if (
      action !== "activate" &&
      !(await fluentConfirm(
        action === "delete"
          ? `Delete draft structure ${label}? This cannot be undone.`
          : `Retire structure ${label}? It stops applying after today.`,
      ))
    ) {
      return;
    }
    setStructureActionId(id);
    try {
      if (action === "activate") {
        await activatePayrollSalaryStructure(token, id);
        toast.success(`Structure ${label} activated.`);
      } else if (action === "retire") {
        await retirePayrollSalaryStructure(token, id);
        toast.success(`Structure ${label} retired.`);
      } else {
        await deletePayrollSalaryStructure(token, id);
        toast.success(`Structure ${label} deleted.`);
      }
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Salary structure action failed.",
      );
    } finally {
      setStructureActionId("");
    }
  }

  async function onCreateStructureVersion() {
    const token = readStoredToken();
    const id = rowId(versionTarget);
    if (!token || !id || !versionEffectiveFrom) return;
    setStructureActionId(id);
    try {
      await createPayrollSalaryStructureVersion(token, id, {
        effective_from: versionEffectiveFrom,
      });
      toast.success(
        "Draft version created. Review its lines, then activate it.",
      );
      setVersionTarget(null);
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to create version.",
      );
    } finally {
      setStructureActionId("");
    }
  }

  const openRuleDialog = () => {
    setFormError(null);
    setRuleOpen(true);
  };

  const sectionTitle =
    tab === "overview"
      ? "Payroll overview"
      : tab === "runs"
        ? "Payroll runs"
        : tab === "inputs"
          ? "Payroll inputs"
          : tab === "profiles"
            ? "Employee payroll profiles"
            : tab === "sources"
              ? "Payroll source records"
              : tab === "overtimeApprovals"
                ? "Approved overtime"
                : tab === "periods"
                  ? "Payroll periods"
                  : tab === "reports"
                    ? "Payroll reports"
                    : `Payroll ${CONFIG_TABS.find((entry) => entry.id === configTab)?.label.toLowerCase()}`;

  const canMutatePayroll = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "payroll:create",
      "payroll:update",
      "payroll_runs:create",
      "payroll_inputs:create",
      "payroll_configuration:create",
      "manage_payroll",
      "payroll:config",
      "payroll:profiles",
      "payroll:periods",
      "payroll:inputs",
      "payroll:runs",
      "payroll:runs-process",
      "payroll:payslips",
      "payroll:banking",
      "payroll:accounting",
      "payroll:final-settlements",
    ],
    mode: "any",
  });
  const canApprovePayroll = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "payroll:update",
      "payroll_runs:update",
      "payroll_runs:approve",
      "payroll_inputs:approve",
      "manage_payroll",
      "payroll:runs-approve",
      "payroll:runs-lock",
      "payroll:inputs-approve",
    ],
    mode: "any",
  });
  const canManageRecoveries = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:recoveries-manage", "manage_payroll"],
    mode: "any",
  });
  const canApproveRecoveries = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:recoveries-approve", "manage_payroll"],
    mode: "any",
  });
  const canPostAccounting = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:accounting", "manage_payroll"],
    mode: "any",
  });
  const canRetryPayments = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:banking", "manage_payroll"],
    mode: "any",
  });
  const canCancelPayrollRun = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:runs-cancel", "manage_payroll"],
    mode: "any",
  });
  const canReversePayrollRun = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:runs-reverse", "manage_payroll"],
    mode: "any",
  });
  const canStartSalaryRevision = canPerformPermission(actor.permissionLabels, {
    permissions: ["employee_movements:create", "manage_employee_movements"],
    mode: "any",
  });
  const canApproveStatutoryRule = canPerformPermission(actor.permissionLabels, {
    permissions: ["payroll:statutory-approve"],
  });
  const canCreate =
    canMutatePayroll &&
    tab !== "overview" &&
    tab !== "reports" &&
    tab !== "recoveries" &&
    tab !== "overtimeApprovals" &&
    (tab !== "configuration" ||
      [
        "components",
        "calendars",
        "structures",
        "schemes",
        "mappings",
        "groups",
        "assignments",
        "overtime",
        "bonus",
        "leaveRules",
      ].includes(configTab));

  const primaryCreateMode: CreateDialogMode =
    tab === "runs"
      ? "run"
      : tab === "inputs"
        ? "input"
        : tab === "sources"
          ? "source"
          : tab === "profiles"
            ? "profile"
            : tab === "periods"
              ? "period"
              : configTab === "components"
                ? "component"
                : configTab === "calendars"
                  ? "calendar"
                  : configTab === "structures"
                    ? "structure"
                    : configTab === "schemes"
                      ? "scheme"
                      : configTab === "mappings"
                        ? "mapping"
                        : configTab === "groups"
                          ? "group"
                          : configTab === "assignments"
                            ? "assignment"
                            : configTab === "overtime"
                              ? "overtime"
                              : configTab === "bonus"
                                ? "bonus"
                                : "leaveRule";

  const createButtonLabel =
    createMode === "run"
      ? "New run"
      : createMode === "input"
        ? "New input"
        : createMode === "profile"
          ? "New profile"
          : createMode === "period"
            ? "Generate period"
            : createMode === "component"
              ? "New component"
              : createMode === "calendar"
                ? "New calendar"
                : createMode === "structure"
                  ? editingStructure
                    ? "Edit structure"
                    : "New structure"
                  : createMode === "scheme"
                    ? "New scheme"
                    : createMode === "mapping"
                      ? "New mapping"
                      : createMode === "group"
                        ? "New group"
                        : createMode === "assignment"
                          ? "Assign employee"
                          : createMode === "overtime"
                            ? "New overtime policy"
                            : createMode === "bonus"
                              ? "New bonus scheme"
                              : createMode === "leaveRule"
                                ? "New leave rule"
                                : createMode === "source"
                                  ? "New source"
                                  : createMode === "sourceImport"
                                    ? "Import sources"
                                      : "New adjustment";

  const columns: Column<AdminRecord>[] = (() => {
    if (tab === "runs") {
      return [
        {
          key: "run",
          label: "Run",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">
                {readString(
                  row,
                  ["run_no", "runNo", "name"],
                  `Run #${readNumber(row, ["id"]) ?? "—"}`,
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {prettify(readString(row, ["run_type", "runType"], "REGULAR"))}
              </p>
            </div>
          ),
        },
        {
          key: "period",
          label: "Period",
          render: (row) => readPeriodLabel(row),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readStatus(row);
            return (
              <Badge
                variant="outline"
                className={cn("capitalize", statusTone(status))}
              >
                {prettify(status)}
              </Badge>
            );
          },
        },
        {
          key: "amounts",
          label: "Totals",
          render: (row) => {
            const currency = readString(row, ["currency"], "TZS");
            const net = formatCurrencyAmount(
              row.net_pay ?? row.netPay ?? row.total_net_pay ?? row.totalNetPay,
              currency,
            );
            const gross = formatCurrencyAmount(
              row.gross_pay ??
                row.grossPay ??
                row.total_gross_pay ??
                row.totalGrossPay,
              currency,
            );
            return (
              <div className="space-y-0.5 text-xs">
                <p>Gross: {gross}</p>
                <p className="text-muted-foreground">Net: {net}</p>
              </div>
            );
          },
        },
        {
          key: "created_at",
          label: "Created",
          render: (row) => formatDateTime(row.created_at ?? row.createdAt),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            const status = readStatus(row);
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openDetail(row);
                  }}
                >
                  View
                </button>
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={simulatingPaymentRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onSimulateRunPayment(row, "SUCCESS", 1);
                    }}
                  >
                    {simulatingPaymentRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Simulate payment"
                    )}
                  </button>
                ) : null}
                {canMutatePayroll ? (
                  <>
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={simulatingPaymentRunId === id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onSimulateRunPayment(row, "PENDING", 1);
                      }}
                    >
                      Pending demo
                    </button>
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={simulatingPaymentRunId === id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onSimulateRunPayment(row, "FAILED", 1);
                      }}
                    >
                      Failed demo
                    </button>
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={simulatingPaymentRunId === id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onSimulateRunPayment(row, "SUCCESS", 2);
                      }}
                    >
                      Retry demo
                    </button>
                  </>
                ) : null}
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={processingRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setProcessTarget(row);
                      setProcessAuthenticatorCode("");
                    }}
                  >
                    {processingRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Process"
                    )}
                  </button>
                ) : null}
                {canApprovePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      setApproveRunId(id);
                      setApproveForm(emptyApproveRunForm());
                      setApproveOpen(true);
                    }}
                  >
                    Approve
                  </button>
                ) : null}
                {canApprovePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={lockingRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onLockRun(row);
                    }}
                  >
                    {lockingRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Lock"
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={validatingRunId === id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onValidateRun(row);
                  }}
                >
                  {validatingRunId === id ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Validate"
                  )}
                </button>
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={
                      payslipRunId === id || status.toUpperCase() === "DRAFT"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void onGeneratePayslips(row);
                    }}
                  >
                    {payslipRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Payslips"
                    )}
                  </button>
                ) : null}
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={bankingRunId === id}
                    title="Optional external bank file; requires the approved bank format and encryption key."
                    onClick={(event) => {
                      event.stopPropagation();
                      void onGenerateBankingBatch(row, true);
                    }}
                  >
                    Bank-ready file
                  </button>
                ) : null}
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={bankingRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onGenerateBankingBatch(row);
                    }}
                  >
                    {bankingRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Internal payment list"
                    )}
                  </button>
                ) : null}
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={reconcilingRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onReconcileRunPayment(row);
                    }}
                  >
                    {reconcilingRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Reconcile"
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={journalRunId === id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onGenerateJournals(row);
                  }}
                >
                  {journalRunId === id ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Journals"
                  )}
                </button>
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={paidRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onMarkRunPaid(row);
                    }}
                  >
                    {paidRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Paid"
                    )}
                  </button>
                ) : null}
                {canApprovePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={closingRunId === id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onCloseRun(row);
                    }}
                  >
                    {closingRunId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Close"
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onOpenEligibility(row);
                  }}
                >
                  Eligibility
                </button>
                {["LOCKED", "PAYMENT_FILE_GENERATED", "PAID", "CLOSED"].includes(
                  status.toUpperCase(),
                ) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPaymentProgressRunId(id);
                    }}
                  >
                    Payments
                  </button>
                ) : null}
                {canCancelPayrollRun &&
                CANCELLABLE_RUN_STATUSES.has(status.toUpperCase()) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      openLifecycleAction("cancel", row);
                    }}
                  >
                    Cancel run
                  </button>
                ) : null}
                {canReversePayrollRun &&
                REVERSIBLE_RUN_STATUSES.has(status.toUpperCase()) ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      openLifecycleAction("reverse", row);
                    }}
                  >
                    Reverse
                  </button>
                ) : null}
              </div>
            );
          },
        },
      ];
    }

    if (tab === "inputs") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readEmployeeLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(
                  row,
                  ["component_code", "componentCode"],
                  "Component",
                )}
              </p>
            </div>
          ),
        },
        {
          key: "period",
          label: "Period",
          render: (row) => readPeriodLabel(row),
        },
        {
          key: "amount",
          label: "Amount",
          render: (row) =>
            formatCurrencyAmount(
              row.amount,
              readString(row, ["currency"], "TZS"),
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readStatus(row);
            return (
              <Badge
                variant="outline"
                className={cn("capitalize", statusTone(status))}
              >
                {prettify(status)}
              </Badge>
            );
          },
        },
        {
          key: "source",
          label: "Source",
          render: (row) =>
            readString(
              row,
              [
                "source_module",
                "sourceModule",
                "source_reference",
                "sourceReference",
              ],
              "—",
            ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            return (
              <div className="flex gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openDetail(row);
                  }}
                >
                  View
                </button>
                <button
                  type="button"
                  className={actionButtonClass}
                  disabled={
                    approvingInputId === id ||
                    readStatus(row).toUpperCase() === "APPROVED"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    void onApproveInput(row);
                  }}
                >
                  {approvingInputId === id ? (
                    <FluentLoadingIndicator className="size-3.5 animate-spin" />
                  ) : (
                    "Approve"
                  )}
                </button>
              </div>
            );
          },
        },
      ];
    }

    if (tab === "sources") {
      return [
        {
          key: "source",
          label: "Source",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">
                {prettify(
                  readString(row, ["source_type", "sourceType"], "SOURCE"),
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {readString(
                  row,
                  ["source_reference", "sourceReference"],
                  "Reference pending",
                )}
              </p>
            </div>
          ),
        },
        {
          key: "employee",
          label: "Employee",
          render: (row) => readEmployeeLabel(row),
        },
        {
          key: "component",
          label: "Component",
          render: (row) =>
            readString(row, ["component_code", "componentCode"], "—"),
        },
        {
          key: "amount",
          label: "Calculated",
          render: (row) =>
            formatCurrencyAmount(
              row.calculated_amount ?? row.calculatedAmount,
              readString(row, ["currency"], "TZS"),
            ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <Badge
              variant="outline"
              className={cn("capitalize", statusTone(readStatus(row)))}
            >
              {prettify(readStatus(row))}
            </Badge>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            const status = readStatus(row).toUpperCase();
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openDetail(row);
                  }}
                >
                  View
                </button>
                {canApprovePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={
                      sourceActionId === id ||
                      status === "APPROVED" ||
                      status === "POSTED"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void onApproveSource(row);
                    }}
                  >
                    {sourceActionId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Approve"
                    )}
                  </button>
                ) : null}
                {canMutatePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={sourceActionId === id || status !== "APPROVED"}
                    onClick={(event) => {
                      event.stopPropagation();
                      void onPostSource(row);
                    }}
                  >
                    {sourceActionId === id ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Post"
                    )}
                  </button>
                ) : null}
                {canApprovePayroll ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={
                      sourceActionId === id ||
                      status === "POSTED" ||
                      status === "REJECTED"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      void onRejectSource(row);
                    }}
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            );
          },
        },
      ];
    }

    if (tab === "overtimeApprovals") {
      return [
        {
          key: "employee",
          label: "Employee",
          render: (row) => readEmployeeLabel(row),
        },
        {
          key: "attendance_date",
          label: "Work date",
          render: (row) => formatAdminValue(row.work_date ?? row.workDate),
        },
        {
          key: "calculated_minutes",
          label: "Calculated",
          render: (row) =>
            `${readNumber(row, ["actual_minutes", "actualMinutes"]) ?? 0} min`,
        },
        {
          key: "requested_minutes",
          label: "Requested",
          render: (row) =>
            `${readNumber(row, ["requested_minutes", "requestedMinutes"]) ?? 0} min`,
        },
        {
          key: "approved_minutes",
          label: "Approved",
          render: (row) =>
            `${readNumber(row, ["requested_minutes", "requestedMinutes"]) ?? 0} min`,
        },
        {
          key: "payable_minutes",
          label: "Payable",
          render: (row) =>
            `${Math.min(
              readNumber(row, ["requested_minutes", "requestedMinutes"]) ?? 0,
              readNumber(row, ["actual_minutes", "actualMinutes"]) ?? 0,
            )} min`,
        },
        {
          key: "pending_minutes",
          label: "Unapproved calculated",
          render: (row) => {
            const requested =
              readNumber(row, ["requested_minutes", "requestedMinutes"]) ?? 0;
            const calculated =
              readNumber(row, ["actual_minutes", "actualMinutes"]) ?? 0;
            return `${Math.max(0, calculated - requested)} min`;
          },
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readString(row, ["status"], "APPROVED");
            return (
              <Badge
                variant="outline"
                className={cn("capitalize", statusTone(status))}
              >
                {prettify(status)}
              </Badge>
            );
          },
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openDetail(row);
                  }}
                >
                  View
                </button>
              </div>
            );
          },
        },
      ];
    }

    if (tab === "profiles") {
      return [
        {
          key: "employee",
          label: "Employee",
          defaultWidth: 230,
          render: (row) => {
            const employeeId = readNumber(row, ["employee_id", "employeeId"]);
            const employee =
              employeeId !== null ? employeeNames.get(employeeId) : undefined;
            const name = readEmployeeLabel(row, employeeNames);
            const initials = name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("");
            return (
              <div className="flex min-w-0 items-center gap-3 py-1">
                <FluentAvatar
                  color="brand"
                  image={
                    employee?.avatarUrl
                      ? { src: employee.avatarUrl }
                      : undefined
                  }
                  initials={initials || "—"}
                  name={name}
                  size={32}
                />
                <span className="min-w-0">
                  <Text weight="semibold" className="!block truncate">
                    {name}
                  </Text>
                  <Text
                    size={200}
                    className="!block truncate text-muted-foreground"
                  >
                    {[
                      employee?.number,
                      readString(row, ["payroll_number", "payrollNumber"]),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Payroll number pending"}
                  </Text>
                </span>
              </div>
            );
          },
        },
        {
          key: "status",
          label: "Payroll status",
          defaultWidth: 165,
          render: (row) => {
            const enabled = readBoolean(row, [
              "payroll_enabled",
              "payrollEnabled",
            ]);
            const onHold = readBoolean(row, ["payroll_hold", "payrollHold"]);
            return (
              <div className="flex flex-col items-start gap-1">
                <FluentBadge
                  appearance="tint"
                  color={enabled ? "success" : "subtle"}
                >
                  {enabled ? "Enabled" : "Disabled"}
                </FluentBadge>
                <Text size={200} className="text-muted-foreground">
                  {onHold ? "On hold" : "Normal processing"}
                </Text>
              </div>
            );
          },
        },
        {
          key: "payment_method",
          label: "Payment details",
          defaultWidth: 190,
          render: (row) => (
            <div className="space-y-0.5">
              <Text weight="medium" className="!block">
                {prettify(
                  readString(row, ["payment_method", "paymentMethod"], "—"),
                )}
              </Text>
              <Text size={200} className="!block text-muted-foreground">
                {prettify(
                  readString(row, ["pay_frequency", "payFrequency"], "—"),
                )}
                {" · "}
                {readString(row, ["currency"], "—")}
              </Text>
            </div>
          ),
        },
        {
          key: "effective",
          label: "Effective",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatAdminValue(row.effective_from ?? row.effectiveFrom)}</p>
              <p className="text-muted-foreground">
                To {formatAdminValue(row.effective_to ?? row.effectiveTo)}
              </p>
            </div>
          ),
        },
        {
          key: "actions",
          label: "Actions",
          defaultWidth: 200,
          render: (row) => {
            const employeeId = readString(row, ["employeeId", "employee_id"]);
            return (
              <div className="flex items-center justify-end gap-2">
                <FluentButton
                  appearance="subtle"
                  size="small"
                  icon={<Eye20Regular />}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openDetail(row);
                  }}
                >
                  View
                </FluentButton>
                {employeeId ? (
                  <FluentButton
                    appearance="secondary"
                    size="small"
                    icon={<PersonMoney20Regular />}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSalaryTarget({
                        employeeId,
                        label: readEmployeeLabel(row, employeeNames),
                      });
                    }}
                  >
                    Salary
                  </FluentButton>
                ) : null}
              </div>
            );
          },
        },
      ];
    }

    if (tab === "periods") {
      return [
        {
          key: "period",
          label: "Period",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{readPeriodLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code", "period_code", "periodCode"], "")}
              </p>
            </div>
          ),
        },
        {
          key: "calendar",
          label: "Calendar",
          render: (row) =>
            readString(
              row,
              ["calendar_name", "calendarName", "payroll_calendar_name"],
              "—",
            ),
        },
        {
          key: "dates",
          label: "Dates",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>Start: {formatAdminValue(row.start_date ?? row.startDate)}</p>
              <p className="text-muted-foreground">
                End: {formatAdminValue(row.end_date ?? row.endDate)}
              </p>
            </div>
          ),
        },
        {
          key: "payroll_dates",
          label: "Cut-off / Payment",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>
                Cut-off: {formatAdminValue(row.cutoff_date ?? row.cutoffDate)}
              </p>
              <p className="text-muted-foreground">
                Payment: {formatAdminValue(row.payment_date ?? row.paymentDate)}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readStatus(row);
            return (
              <Badge
                variant="outline"
                className={cn("capitalize", statusTone(status))}
              >
                {prettify(status)}
              </Badge>
            );
          },
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const status = readStatus(row).toUpperCase();
            const editable =
              !["LOCKED", "PAID", "CLOSED", "CANCELLED"].includes(status) &&
              !readBoolean(row, ["lockedAt", "locked_at"]);
            return canMutatePayroll && editable ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openEditPeriodDates(row);
                }}
              >
                Edit dates
              </button>
            ) : (
              "—"
            );
          },
        },
      ];
    }

    if (configTab === "components") {
      return [
        {
          key: "component",
          label: "Component",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(
                  readString(
                    row,
                    ["component_type", "componentType"],
                    "EARNING",
                  ),
                )}
              </p>
            </div>
          ),
        },
        {
          key: "method",
          label: "Calculation",
          render: (row) =>
            prettify(
              readString(
                row,
                ["calculation_method", "calculationMethod"],
                "FIXED_AMOUNT",
              ),
            ),
        },
        {
          key: "flags",
          label: "Flags",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>
                {readBoolean(row, ["included_in_gross", "includedInGross"])
                  ? "Included in gross"
                  : "Excluded from gross"}
              </p>
              <p className="text-muted-foreground">
                {readBoolean(row, ["allow_manual_input", "allowManualInput"])
                  ? "Manual input allowed"
                  : "System calculated"}
              </p>
            </div>
          ),
        },
      ];
    }

    if (configTab === "calendars") {
      return [
        {
          key: "calendar",
          label: "Calendar",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["timezone"], "Africa/Dar_es_Salaam")}
              </p>
            </div>
          ),
        },
        {
          key: "cutoff_day",
          label: "Cut-off",
          render: (row) => readString(row, ["cutoff_day", "cutoffDay"], "—"),
        },
        {
          key: "payment_day",
          label: "Payment day",
          render: (row) => readString(row, ["payment_day", "paymentDay"], "—"),
        },
        {
          key: "default",
          label: "Default",
          render: (row) =>
            readBoolean(row, ["is_default", "isDefault"]) ? "Yes" : "No",
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) =>
            canMutatePayroll ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openEditCalendar(row);
                }}
              >
                Edit
              </button>
            ) : (
              "—"
            ),
        },
      ];
    }

    if (configTab === "structures") {
      return [
        {
          key: "structure",
          label: "Structure",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["code"])} · v
                {readString(row, ["versionNumber", "version_number"], "1")} ·{" "}
                {readString(row, ["currency"], "TZS")}
              </p>
            </div>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <Badge
              variant="outline"
              className={cn("capitalize", statusTone(readStatus(row)))}
            >
              {prettify(readStatus(row))}
            </Badge>
          ),
        },
        {
          key: "effective",
          label: "Effective",
          render: (row) => (
            <div className="space-y-0.5 text-xs">
              <p>{formatAdminValue(row.effective_from ?? row.effectiveFrom)}</p>
              <p className="text-muted-foreground">
                To {formatAdminValue(row.effective_to ?? row.effectiveTo)}
              </p>
            </div>
          ),
        },
        {
          key: "components",
          label: "Lines",
          render: (row) =>
            String(
              readNumber(row, ["component_count"]) ??
                asRecordArray(row.components).length,
            ),
        },
        {
          key: "employees",
          label: "Employees",
          render: (row) =>
            String(readNumber(row, ["assigned_employee_count"]) ?? 0),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const id = rowId(row);
            const status = readStatus(row).toUpperCase();
            const busy = structureActionId === id;
            return (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={actionButtonClass}
                  onClick={(event) => {
                    event.stopPropagation();
                    void openDetail(row);
                  }}
                >
                  View
                </button>
                {canMutatePayroll && status !== "RETIRED" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void openEditStructure(row);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {canMutatePayroll && status === "DRAFT" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void runStructureAction(row, "activate");
                    }}
                  >
                    {busy ? (
                      <FluentLoadingIndicator className="size-3.5 animate-spin" />
                    ) : (
                      "Activate"
                    )}
                  </button>
                ) : null}
                {canMutatePayroll && status !== "DRAFT" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      setVersionEffectiveFrom("");
                      setVersionTarget(row);
                    }}
                  >
                    New version
                  </button>
                ) : null}
                {canMutatePayroll && status === "ACTIVE" ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void runStructureAction(row, "retire");
                    }}
                  >
                    Retire
                  </button>
                ) : null}
                {canMutatePayroll && status === "DRAFT" ? (
                  <button
                    type="button"
                    className={cn(actionButtonClass, "text-rose-600")}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void runStructureAction(row, "delete");
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            );
          },
        },
      ];
    }

    if (configTab === "schemes") {
      return [
        {
          key: "scheme",
          label: "Scheme",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(
                  readString(row, ["scheme_type", "schemeType"], "OTHER"),
                )}
              </p>
            </div>
          ),
        },
        {
          key: "jurisdiction",
          label: "Jurisdiction",
          render: (row) => readString(row, ["jurisdiction"], "—"),
        },
        {
          key: "status",
          label: "Status",
          render: (row) =>
            readBoolean(row, ["is_active", "isActive"])
              ? "Active"
              : readStatus(row),
        },
      ];
    }

    if (configTab === "groups") {
      return [
        {
          key: "group",
          label: "Group",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(readString(row, ["frequency"], "MONTHLY"))}
              </p>
            </div>
          ),
        },
        {
          key: "rules",
          label: "Rule filters",
          render: (row) =>
            [
              readString(row, ["branch_id", "branchId"]),
              readString(row, ["department_id", "departmentId"]),
              readString(row, ["employee_category", "employeeCategory"]),
              readString(row, ["employment_type", "employmentType"]),
            ]
              .filter(Boolean)
              .join(" / ") || "All eligible",
        },
        {
          key: "currency",
          label: "Currency",
          render: (row) => readString(row, ["currency"], "TZS"),
        },
      ];
    }

    if (configTab === "assignments") {
      return [
        {
          key: "group",
          label: "Group",
          render: (row) =>
            `Group #${readString(row, ["payroll_group_id", "payrollGroupId"], "")}`,
        },
        {
          key: "employee",
          label: "Employee",
          render: (row) => readEmployeeLabel(row),
        },
        {
          key: "effective",
          label: "Effective",
          render: (row) =>
            `${formatAdminValue(row.effective_from ?? row.effectiveFrom)} - ${formatAdminValue(row.effective_to ?? row.effectiveTo)}`,
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <Badge
              variant="outline"
              className={cn("capitalize", statusTone(readStatus(row)))}
            >
              {prettify(readStatus(row))}
            </Badge>
          ),
        },
      ];
    }

    if (configTab === "overtime") {
      return [
        {
          key: "policy",
          label: "Policy",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(
                  row,
                  ["component_code", "componentCode"],
                  "OVERTIME",
                )}
              </p>
            </div>
          ),
        },
        {
          key: "multipliers",
          label: "Multipliers",
          render: (row) =>
            `R ${readString(row, ["regular_multiplier", "regularMultiplier"], "1.5")} / W ${readString(row, ["weekend_multiplier", "weekendMultiplier"], "2")} / H ${readString(row, ["holiday_multiplier", "holidayMultiplier"], "2")}`,
        },
        {
          key: "approval",
          label: "Approval",
          render: (row) =>
            readBoolean(row, ["approval_required", "approvalRequired"])
              ? "Required"
              : "Not required",
        },
      ];
    }

    if (configTab === "bonus") {
      return [
        {
          key: "scheme",
          label: "Scheme",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["component_code", "componentCode"], "BONUS")}
              </p>
            </div>
          ),
        },
        {
          key: "method",
          label: "Method",
          render: (row) =>
            prettify(
              readString(
                row,
                ["calculation_method", "calculationMethod"],
                "FIXED_AMOUNT",
              ),
            ),
        },
        {
          key: "default",
          label: "Default",
          render: (row) =>
            readString(
              row,
              [
                "default_amount",
                "defaultAmount",
                "default_rate",
                "defaultRate",
              ],
              "-",
            ),
        },
      ];
    }

    if (configTab === "leaveRules") {
      return [
        {
          key: "rule",
          label: "Rule",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {readString(row, ["leave_type_code", "leaveTypeCode"], "LEAVE")}
              </p>
            </div>
          ),
        },
        {
          key: "pay",
          label: "Pay behavior",
          render: (row) =>
            `${readString(row, ["paid_percentage", "paidPercentage"], "100")}% paid, half after ${readString(row, ["half_pay_after_days", "halfPayAfterDays"], "-")}`,
        },
        {
          key: "caps",
          label: "Caps",
          render: (row) =>
            `Paid ${readString(row, ["paid_days_cap", "paidDaysCap"], "-")} / unpaid after ${readString(row, ["unpaid_after_days", "unpaidAfterDays"], "-")}`,
        },
      ];
    }

    return [
      {
        key: "component_code",
        label: "Component",
        render: (row) =>
          readString(row, ["component_code", "componentCode"], "—"),
      },
      {
        key: "debit_account_code",
        label: "Debit",
        render: (row) =>
          readString(row, ["debit_account_code", "debitAccountCode"], "—"),
      },
      {
        key: "credit_account_code",
        label: "Credit",
        render: (row) =>
          readString(row, ["credit_account_code", "creditAccountCode"], "—"),
      },
    ];
  })();

  async function openDetail(row: AdminRecord) {
    const token = readStoredToken();
    if (!token) {
      toast.error("Authentication required.");
      return;
    }

    const id = rowId(row);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRecord(row);

    try {
      if (tab === "runs" && id) {
        const [runDetail, payslips] = await Promise.all([
          getPayrollRun(token, id),
          listPayrollPayslipsForRun(token, id).catch(() => []),
        ]);
        setDetailRecord({
          ...(runDetail ?? row),
          payslips,
        });
      } else if (tab === "configuration" && configTab === "structures" && id) {
        const [structureDetail, assignedEmployees] = await Promise.all([
          getPayrollSalaryStructure(token, id),
          listPayrollSalaryStructureEmployees(token, id).catch(() => []),
        ]);
        setDetailRecord({
          ...(structureDetail ?? row),
          assigned_employees: assignedEmployees,
        });
      } else {
        setDetailRecord(row);
      }
    } catch (errorObject) {
      setDetailRecord(row);
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load details.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function onProcessRun(row: AdminRecord, authenticatorCode?: string) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setProcessingRunId(id);
    try {
      await processPayrollRun(
        token,
        id,
        authenticatorCode
          ? { authenticator_code: authenticatorCode }
          : undefined,
      );
      toast.success("Payroll run queued for processing.");
      setProcessTarget(null);
      setProcessAuthenticatorCode("");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to process run.",
      );
    } finally {
      setProcessingRunId("");
    }
  }

  async function onLockRun(row: AdminRecord, acknowledged = false) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    // Contract warnings never block pay but must be acknowledged first.
    if (!acknowledged) {
      const pending = await contractWarningsCleared(token, Number(id));
      if (pending) {
        pendingLockRow.current = row;
        setContractWarnings(pending);
        return;
      }
    }
    setLockingRunId(id);
    try {
      await lockPayrollRun(token, id);
      toast.success("Payroll run locked.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to lock run.",
      );
    } finally {
      setLockingRunId("");
    }
  }

  async function onValidateRun(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setValidatingRunId(id);
    try {
      const result = await validatePayrollRun(token, id);
      setReportKind("validation");
      setReportResult(
        (result as AdminRecord | null) ?? { status: "validated" },
      );
      toast.success("Payroll validation completed.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to validate run.",
      );
    } finally {
      setValidatingRunId("");
    }
  }

  function onMarkRunPaid(row: AdminRecord) {
    openLifecycleAction("paid", row);
  }

  async function submitMarkRunPaid(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setPaidRunId(id);
    try {
      await markPayrollRunPaid(token, id, {
        payment_reference: lifecyclePaymentReference.trim(),
        payment_date: lifecyclePaymentDate,
        confirmation_note: lifecycleReason.trim(),
      });
      setLifecycleAction(null);
      toast.success("Payment confirmed. Loan repayments have been posted.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to mark run as paid.",
      );
    } finally {
      setPaidRunId("");
    }
  }

  async function onSimulateRunPayment(
    row: AdminRecord,
    outcome: "SUCCESS" | "PENDING" | "FAILED",
    attempt: number,
  ) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setSimulatingPaymentRunId(id);
    try {
      const result = await simulatePayrollRunPayment(
        token,
        id,
        outcome,
        attempt,
      );
      const recordedStatus = readString(
        asRecord(asRecord(result)?.import),
        ["status"],
        outcome,
      );
      toast.success(
        `Demo payment result recorded (${recordedStatus}). No external transfer was sent.`,
      );
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Demo payment simulation failed.",
      );
    } finally {
      setSimulatingPaymentRunId("");
    }
  }

  function openLifecycleAction(
    kind: "cancel" | "reverse" | "paid",
    row: AdminRecord,
  ) {
    setLifecycleAction({ kind, row });
    setLifecycleReason("");
    setLifecyclePaymentReference("");
    setLifecyclePaymentDate(new Date().toISOString().slice(0, 10));
    setLifecycleBankWithdrawn(false);
    setLifecycleError(null);
  }

  async function onSubmitLifecycleAction() {
    const token = readStoredToken();
    const id = lifecycleAction ? rowId(lifecycleAction.row) : "";
    if (!token || !id || !lifecycleAction) return;
    const reason = lifecycleReason.trim();
    if (!reason) {
      setLifecycleError(
        lifecycleAction.kind === "paid"
          ? "A confirmation note is required."
          : "A reason is required.",
      );
      return;
    }
    if (lifecycleAction.kind === "paid") {
      if (!lifecyclePaymentReference.trim() || !lifecyclePaymentDate) {
        setLifecycleError("Bank payment reference and date are required.");
        return;
      }
      setLifecycleError(null);
      await submitMarkRunPaid(lifecycleAction.row);
      return;
    }
    setLifecycleError(null);
    setSaving(true);
    try {
      if (lifecycleAction.kind === "cancel") {
        await cancelPayrollRun(token, id, { reason });
        toast.success("Payroll run cancelled. Loan reservations released.");
      } else {
        await reversePayrollRun(token, id, {
          reason,
          bank_file_withdrawn: lifecycleBankWithdrawn,
        });
        toast.success("Payroll run reversed and period reopened.");
      }
      setLifecycleAction(null);
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      setLifecycleError(
        errorObject instanceof Error
          ? errorObject.message
          : "The payroll run could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onOpenEligibility(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setEligibilityReport({ loading: true, data: null });
    try {
      const data = await getPayrollRunEligibility(token, id);
      setEligibilityReport({ loading: false, data });
    } catch (errorObject) {
      setEligibilityReport(null);
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load the eligibility report.",
      );
    }
  }

  async function onCloseRun(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setClosingRunId(id);
    try {
      await closePayrollRun(token, id);
      toast.success("Payroll period closed.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to close payroll run.",
      );
    } finally {
      setClosingRunId("");
    }
  }

  async function onGeneratePayslips(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setPayslipRunId(id);
    try {
      await generatePayrollPayslipsForRun(token, id);
      toast.success("Payslip generation started.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to generate payslips.",
      );
    } finally {
      setPayslipRunId("");
    }
  }

  async function onRunReconciliation() {
    const token = readStoredToken();
    if (!token) return;
    setReportBusy("reconciliation");
    try {
      const result = await runPayrollReconciliation(token);
      setReportKind("reconciliation");
      setReportResult((result as AdminRecord | null) ?? { status: "queued" });
      toast.success("Payroll reconciliation started.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to run reconciliation.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onRunCatalog() {
    const token = readStoredToken();
    if (!token) return;
    setReportBusy("catalog");
    try {
      const rows = await listPayrollReportCatalog(token);
      setReportCatalog(rows);
      setReportKind("catalog");
      setReportResult({ status: "ready", reports: rows, issues: [] });
      toast.success("Report catalog loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load report catalog.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onLoadReadiness() {
    const token = readStoredToken();
    if (!token) return;
    setReportBusy("readiness");
    try {
      const result = await getPayrollReadiness(token);
      setReportKind("readiness");
      setReportResult((result as AdminRecord | null) ?? { status: "ready" });
      toast.success("Payroll readiness loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load payroll readiness.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onLoadIntegrations() {
    const token = readStoredToken();
    if (!token) return;
    setReportBusy("integrations");
    try {
      const result = await getPayrollIntegrationCatalog(token);
      setReportKind("integrations");
      setReportResult((result as AdminRecord | null) ?? { status: "ready" });
      toast.success("Payroll integration options loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load payroll integrations.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onLoadNotificationCatalog() {
    const token = readStoredToken();
    if (!token) return;
    setReportBusy("notifications");
    try {
      const rows = await getPayrollNotificationCatalog(token);
      setReportKind("notifications");
      setReportResult({ status: "ready", notifications: rows, rows });
      toast.success("Payroll notification catalog loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load payroll notifications.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onRunCatalogReport(
    reportCodeOverride?: string,
    pageOverride = reportPage,
  ) {
    const token = readStoredToken();
    const reportCode = (reportCodeOverride ?? advancedForm.reportCode).trim();
    if (!token || !reportCode) return;
    setReportBusy("catalog-report");
    try {
      const result = await getPayrollReport(token, reportCode, {
        payroll_run_id: advancedForm.reportRunId
          ? Number(advancedForm.reportRunId)
          : undefined,
        payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
        year: advancedForm.reportYear
          ? Number(advancedForm.reportYear)
          : undefined,
        page: pageOverride,
        limit: 50,
        search: reportSearch.trim() || undefined,
      });
      setReportKind("report");
      setReportPage(pageOverride);
      setAdvancedForm((current) => ({ ...current, reportCode }));
      setReportResult((result as AdminRecord | null) ?? { status: "ready" });
      toast.success("Payroll report loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load payroll report.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onExportReportCsv(rows: AdminRecord[]) {
    if (reportKind !== "report") {
      downloadBlob(
        new Blob([reportRowsToCsv(rows)], { type: "text/csv;charset=utf-8" }),
        `payroll-${advancedForm.reportCode || reportKind || "report"}.csv`,
      );
      return;
    }
    const token = readStoredToken();
    const reportCode = advancedForm.reportCode.trim();
    if (!token || !reportCode) return;
    setReportBusy("report-export");
    try {
      const payload = await getPayrollReport(token, reportCode, {
        payroll_run_id: advancedForm.reportRunId
          ? Number(advancedForm.reportRunId)
          : undefined,
        payroll_period_id: periodFilter ? Number(periodFilter) : undefined,
        year: advancedForm.reportYear
          ? Number(advancedForm.reportYear)
          : undefined,
        search: reportSearch.trim() || undefined,
        page: 1,
        limit: 50,
        export_all: true,
      });
      const allRows = asRecordArray(asRecord(payload)?.rows);
      downloadBlob(
        new Blob([reportRowsToCsv(allRows)], {
          type: "text/csv;charset=utf-8",
        }),
        `payroll-${reportCode}.csv`,
      );
      toast.success(`Exported ${allRows.length} filtered payroll rows.`);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to export payroll report.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onRunVariance() {
    const token = readStoredToken();
    if (!token || !varianceRunId || !comparisonRunId) {
      return;
    }
    setReportBusy("variance");
    try {
      const result = await runPayrollRunVariance(
        token,
        varianceRunId,
        comparisonRunId,
      );
      setReportKind("variance");
      setReportResult((result as AdminRecord | null) ?? { status: "queued" });
      toast.success("Variance report started.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to run variance.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onReviewVarianceRow(row: AdminRecord) {
    const token = readStoredToken();
    const varianceId = readNumber(reportResult, ["id"]);
    const employeeId = readNumber(row, ["employee_id", "employeeId"]);
    const explanation = varianceExplanations[String(employeeId)]?.trim();
    if (
      !token ||
      !varianceRunId ||
      !varianceId ||
      !employeeId ||
      !explanation
    ) {
      toast.error("Enter an explanation before saving the review.");
      return;
    }
    setReportBusy(`variance-review-${employeeId}`);
    try {
      const result = await reviewPayrollVariance(
        token,
        varianceRunId,
        varianceId,
        employeeId,
        explanation,
      );
      setReportResult((result as AdminRecord | null) ?? reportResult);
      toast.success(`Variance for employee ${employeeId} reviewed.`);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to save variance review.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onCalculateSettlement() {
    const token = readStoredToken();
    if (!token || !settlementRequestId) {
      return;
    }
    setReportBusy("settlement");
    try {
      const result = await calculatePayrollFinalSettlement(
        token,
        settlementRequestId,
      );
      setReportKind("settlement");
      setReportResult((result as AdminRecord | null) ?? { status: "queued" });
      toast.success("Final settlement calculated.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to calculate settlement.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onFinalSettlementAction(
    action: "submit" | "decision" | "simulate-payment" | "reconcile" | "close",
    body?: Record<string, unknown>,
  ) {
    const token = readStoredToken();
    const settlementId = readString(reportResult, ["id"], "");
    if (!token || !settlementId) return;
    setReportBusy("settlement-action");
    try {
      const result = await payrollFinalSettlementAction(
        token,
        settlementId,
        action,
        body,
      );
      const actionResult = asRecord(result);
      const normalized = asRecord(actionResult?.settlement) ?? actionResult;
      setReportResult(normalized ?? { status: "updated", id: settlementId });
      toast.success(
        `Final settlement ${action.replaceAll("-", " ")} completed.`,
      );
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Final settlement action failed.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onDownloadSettlementStatement() {
    const token = readStoredToken();
    const settlementId = readString(reportResult, ["id"], "");
    if (!token || !settlementId) return;
    try {
      const file = await downloadPayrollFinalSettlementStatement(
        token,
        settlementId,
      );
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not download settlement statement.",
      );
    }
  }

  async function onGenerateBankingBatch(row: AdminRecord, bankReady = false) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setBankingRunId(id);
    try {
      const batch = bankReady
        ? await generatePayrollBankReadyBatch(token, id)
        : await generatePayrollBankingBatch(token, id);
      const batchId =
        readNumber(batch, ["batchId", "batch_id", "id"]) ??
        readNumber(
          typeof batch?.data === "object" &&
            batch.data &&
            !Array.isArray(batch.data)
            ? (batch.data as AdminRecord)
            : null,
          ["batchId", "batch_id", "id"],
        );
      if (batchId !== null) {
        const download = await downloadPayrollBankingBatch(token, batchId);
        downloadBlob(download.blob, download.filename);
        toast.success(
          bankReady
            ? "Encrypted bank-ready file generated and downloaded."
            : "Internal payment list generated and downloaded.",
        );
      } else {
        toast.success(
          bankReady
            ? "Bank-ready file generation started."
            : "Internal payment list generation started.",
        );
      }
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : bankReady
            ? "Failed to generate bank-ready file."
            : "Failed to generate internal payment list.",
      );
    } finally {
      setBankingRunId("");
    }
  }

  async function onReconcileRunPayment(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    const currency = readString(row, ["currency"], "TZS");
    const paidAmount =
      advancedForm.paidAmount.trim() ||
      String(
        readNumber(row, [
          "net_pay",
          "netPay",
          "total_net_pay",
          "totalNetPay",
        ]) ??
          readNumber(row, ["totalAmount", "total_amount"]) ??
          "",
      );
    setReconcilingRunId(id);
    try {
      await reconcilePayrollPayment(token, id, {
        payment_reference:
          advancedForm.paymentReference.trim() || `PAYROLL-${id}`,
        payment_date:
          advancedForm.paymentDate || new Date().toISOString().slice(0, 10),
        paid_amount: paidAmount,
        currency,
      });
      toast.success("Payment reconciliation saved.");
      setAdvancedForm((current) => ({
        ...current,
        paymentReference: "",
        paidAmount: "",
      }));
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to reconcile payment.",
      );
    } finally {
      setReconcilingRunId("");
    }
  }

  async function onGenerateJournals(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setJournalRunId(id);
    try {
      await generatePayrollAccountingJournals(token, id);
      toast.success("Accounting journals generated.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to generate journals.",
      );
    } finally {
      setJournalRunId("");
    }
  }

  async function onImportBankStatement() {
    const token = readStoredToken();
    const fileText =
      bankInputMode === "csv"
        ? bankCsvText.trim()
        : bankStatementRowsToCsv(bankPaymentRows);
    const completedRows = bankPaymentRows.filter(
      (row) =>
        row.employeeNo.trim() ||
        row.accountMasked.trim() ||
        row.reference.trim() ||
        row.amount.trim(),
    );
    if (bankInputMode === "manual") {
      if (completedRows.length === 0) {
        toast.error("Add at least one payment row before importing.");
        return;
      }
      if (
        completedRows.some(
          (row) =>
            !row.employeeNo.trim() ||
            !Number.isFinite(Number(row.amount)) ||
            Number(row.amount) <= 0,
        )
      ) {
        toast.error(
          "Each payment needs an employee number and a positive amount.",
        );
        return;
      }
    }
    if (
      bankInputMode === "csv" &&
      bankCsvText.trim().split(/\r?\n/).filter(Boolean).length < 2
    ) {
      toast.error("Add at least one payment row to the CSV before importing.");
      return;
    }
    if (!token || !advancedForm.bankImportRunId || !fileText.trim()) {
      toast.error(
        "Choose a payroll run and add at least one bank payment row.",
      );
      return;
    }
    setReportBusy("bank-import");
    try {
      const result = await importPayrollBankStatement(token, {
        payroll_run_id: Number(advancedForm.bankImportRunId),
        bank_batch_id: advancedForm.bankBatchId
          ? Number(advancedForm.bankBatchId)
          : undefined,
        provider_key: advancedForm.providerKey.trim() || undefined,
        payment_reference: advancedForm.paymentReference.trim() || undefined,
        payment_date: advancedForm.paymentDate || undefined,
        file_text: fileText,
      });
      setReportKind("report");
      setReportResult((result as AdminRecord | null) ?? { status: "imported" });
      toast.success("Bank statement imported and matched.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to import bank statement.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onBankStatementFileSelected(file: File | null) {
    setBankCsvError("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setBankCsvError("Choose a CSV file smaller than 5 MB.");
      return;
    }
    try {
      const text = await file.text();
      const header = (text.split(/\r?\n/, 1)[0] ?? "")
        .split(",")
        .map((value) =>
          value.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"),
        );
      const hasAmount = header.includes("amount");
      const hasEmployeeMatch = [
        "employee_no",
        "employee_id",
        "account_number_masked",
        "reference",
      ].some((key) => header.includes(key));
      if (
        text.trim().split(/\r?\n/).filter(Boolean).length < 2 ||
        !hasAmount ||
        !hasEmployeeMatch
      ) {
        setBankCsvError(
          "This file needs an amount column and at least one employee or payment reference column. Download the template if you need a starting point.",
        );
        return;
      }
      setBankCsvText(text);
      setBankCsvName(file.name);
      setBankInputMode("csv");
    } catch {
      setBankCsvError(
        "We could not read this file. Try saving it as a CSV and upload it again.",
      );
    }
  }

  async function onExportJournal() {
    const token = readStoredToken();
    if (!token || !advancedForm.journalBatchId) {
      toast.error("Enter a journal batch ID.");
      return;
    }
    setReportBusy("journal-export");
    try {
      const result = await exportPayrollAccountingJournal(
        token,
        advancedForm.journalBatchId,
        advancedForm.exportFormat,
      );
      downloadBlob(result.blob, result.filename);
      toast.success("Journal exported.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to export journal.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onLoadInternalLedger() {
    const token = readStoredToken();
    if (!token) return;
    setReportBusy("internal-ledger");
    try {
      const result = await getPayrollInternalLedger(
        token,
        advancedForm.journalRunId || undefined,
      );
      setReportResult((result as AdminRecord | null) ?? {});
      setReportKind("report");
      toast.success("Internal payroll ledger loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load the internal payroll ledger.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onLoadPaymentHistory() {
    const token = readStoredToken();
    const runId = advancedForm.bankImportRunId;
    if (!token || !runId) {
      toast.error("Select a payroll run to view payment history.");
      return;
    }
    setReportBusy("payment-history");
    try {
      const result = await getPayrollPaymentHistory(token, runId);
      setReportResult((result as AdminRecord | null) ?? {});
      setReportKind("report");
      toast.success("Payment history loaded.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load payment history.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onPostJournal() {
    const token = readStoredToken();
    if (!token || !advancedForm.journalBatchId) {
      toast.error("Enter a journal batch ID.");
      return;
    }
    setReportBusy("journal-post");
    try {
      const result = await postPayrollAccountingJournal(
        token,
        advancedForm.journalBatchId,
        {
          provider_key: advancedForm.providerKey.trim() || undefined,
          external_reference:
            advancedForm.externalReference.trim() || undefined,
          format: advancedForm.exportFormat,
        },
      );
      setReportKind("report");
      setReportResult((result as AdminRecord | null) ?? { status: "posted" });
      toast.success("Journal marked as posted.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to post journal.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onReverseJournal() {
    const token = readStoredToken();
    if (!token || !advancedForm.journalBatchId) {
      toast.error("Enter a journal batch ID.");
      return;
    }
    setReportBusy("journal-reverse");
    try {
      const result = await reversePayrollAccountingJournal(
        token,
        advancedForm.journalBatchId,
        {
          provider_key: advancedForm.providerKey.trim() || undefined,
          external_reference:
            advancedForm.externalReference.trim() || undefined,
        },
      );
      setReportKind("report");
      setReportResult((result as AdminRecord | null) ?? { status: "reversed" });
      toast.success("Journal reversed.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to reverse journal.",
      );
    } finally {
      setReportBusy("");
    }
  }

  async function onApproveInput(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setApprovingInputId(id);
    try {
      await approvePayrollInput(token, id);
      toast.success("Payroll input approved.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to approve input.",
      );
    } finally {
      setApprovingInputId("");
    }
  }

  async function onApproveSource(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setSourceActionId(id);
    try {
      await approvePayrollSource(token, id);
      toast.success("Payroll source approved.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to approve source.",
      );
    } finally {
      setSourceActionId("");
    }
  }

  async function onRejectSource(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setSourceActionId(id);
    try {
      await rejectPayrollSource(token, id);
      toast.success("Payroll source rejected.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to reject source.",
      );
    } finally {
      setSourceActionId("");
    }
  }

  async function onPostSource(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setSourceActionId(id);
    try {
      await postPayrollSource(token, id);
      toast.success("Payroll source posted to inputs.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to post source.",
      );
    } finally {
      setSourceActionId("");
    }
  }

  async function onCreate() {
    const token = readStoredToken();
    if (!token) {
      setFormError("Authentication required. Please log in again.");
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      if (createMode === "run") {
        if (!runForm.payrollPeriodId) {
          throw new Error("Select a payroll period.");
        }
        await createPayrollRun(token, {
          payroll_period_id: Number(runForm.payrollPeriodId),
          payroll_group_id: runForm.payrollGroupId
            ? Number(runForm.payrollGroupId)
            : undefined,
          run_type: runForm.runType,
          parent_run_id: runForm.parentRunId
            ? Number(runForm.parentRunId)
            : undefined,
          offboarding_request_id: runForm.offboardingRequestId
            ? Number(runForm.offboardingRequestId)
            : undefined,
        });
      } else if (createMode === "input") {
        if (
          !inputForm.payrollPeriodId ||
          !inputForm.componentCode.trim() ||
          !inputForm.amount.trim()
        ) {
          throw new Error(
            "Payroll period, component code, and amount are required.",
          );
        }
        await createPayrollInput(token, {
          payroll_period_id: Number(inputForm.payrollPeriodId),
          employee_id: inputForm.employeeId
            ? Number(inputForm.employeeId)
            : undefined,
          component_code: inputForm.componentCode.trim(),
          source_module: inputForm.sourceModule.trim() || undefined,
          source_reference: inputForm.sourceReference.trim() || undefined,
          amount: inputForm.amount.trim(),
          quantity: inputForm.quantity.trim() || undefined,
          rate: inputForm.rate.trim() || undefined,
          currency: inputForm.currency.trim() || undefined,
          status: inputForm.status,
          late_adjustment_reason:
            inputForm.lateAdjustmentReason.trim() || undefined,
        });
      } else if (createMode === "source") {
        if (
          !advancedForm.payrollPeriodId ||
          !advancedForm.componentCode.trim()
        ) {
          throw new Error("Payroll period and component code are required.");
        }
        await createPayrollSource(token, {
          payroll_period_id: Number(advancedForm.payrollPeriodId),
          employee_id: advancedForm.employeeId
            ? Number(advancedForm.employeeId)
            : undefined,
          source_type: advancedForm.sourceType,
          source_reference: advancedForm.sourceReference.trim() || undefined,
          scheme_code: advancedForm.schemeCode.trim() || undefined,
          component_code: advancedForm.componentCode.trim(),
          source_amount: advancedForm.sourceAmount.trim() || undefined,
          quantity: advancedForm.quantity.trim() || undefined,
          rate: advancedForm.rate.trim() || undefined,
          calculated_amount: advancedForm.calculatedAmount.trim() || undefined,
          currency: advancedForm.currency.trim() || undefined,
        });
      } else if (createMode === "sourceImport") {
        if (!advancedForm.payrollPeriodId || !advancedForm.importText.trim()) {
          throw new Error("Payroll period and CSV or TSV rows are required.");
        }
        await importPayrollSources(token, {
          payroll_period_id: Number(advancedForm.payrollPeriodId),
          provider_key: advancedForm.providerKey.trim() || undefined,
          source_type: advancedForm.sourceType,
          component_code: advancedForm.componentCode.trim() || undefined,
          currency: advancedForm.currency.trim() || undefined,
          file_text: advancedForm.importText.trim(),
          auto_approve: advancedForm.autoApprove === "true",
          auto_post: advancedForm.autoPost === "true",
        });
      } else if (createMode === "profile") {
        if (
          !profileForm.employeeId ||
          !profileForm.payrollNumber.trim() ||
          !profileForm.effectiveFrom
        ) {
          throw new Error(
            "Employee ID, payroll number, and effective from date are required.",
          );
        }
        await upsertEmployeePayrollProfile(token, {
          employee_id: Number(profileForm.employeeId),
          payroll_number: profileForm.payrollNumber.trim(),
          taxpayer_identification_number:
            profileForm.taxpayerIdentificationNumber.trim() || undefined,
          social_security_scheme_code:
            profileForm.socialSecuritySchemeCode.trim() || undefined,
          social_security_number:
            profileForm.socialSecurityNumber.trim() || undefined,
          health_insurance_scheme_code:
            profileForm.healthInsuranceSchemeCode.trim() || undefined,
          health_insurance_number:
            profileForm.healthInsuranceNumber.trim() || undefined,
          tax_residency_code: profileForm.taxResidencyCode.trim() || undefined,
          employment_tax_category:
            profileForm.employmentTaxCategory.trim() || undefined,
          payment_method: profileForm.paymentMethod.trim() || undefined,
          primary_bank_account_id: profileForm.primaryBankAccountId
            ? Number(profileForm.primaryBankAccountId)
            : undefined,
          currency: profileForm.currency.trim() || undefined,
          pay_frequency: profileForm.payFrequency.trim() || undefined,
          payroll_enabled: profileForm.payrollEnabled === "true",
          payroll_hold: profileForm.payrollHold === "true",
          payroll_hold_reason:
            profileForm.payrollHoldReason.trim() || undefined,
          effective_from: profileForm.effectiveFrom,
          effective_to: profileForm.effectiveTo || undefined,
        });
      } else if (createMode === "period") {
        if (
          !periodForm.payrollCalendarId ||
          !periodForm.year ||
          !periodForm.month
        ) {
          throw new Error("Calendar, year, and month are required.");
        }
        await generatePayrollPeriod(token, {
          payroll_calendar_id: Number(periodForm.payrollCalendarId),
          year: Number(periodForm.year),
          month: Number(periodForm.month),
        });
      } else if (createMode === "component") {
        if (!componentForm.code.trim() || !componentForm.name.trim()) {
          throw new Error("Code and name are required.");
        }
        await createPayrollComponent(token, {
          code: componentForm.code.trim(),
          name: componentForm.name.trim(),
          component_type: componentForm.componentType,
          frequency: componentForm.frequency,
          calculation_method: componentForm.calculationMethod,
          tax_treatment: componentForm.taxTreatment,
          taxable_percentage:
            componentForm.taxablePercentage.trim() || undefined,
          pensionable: componentForm.pensionable === "true",
          health_insurance_applicable:
            componentForm.healthInsuranceApplicable === "true",
          included_in_gross: componentForm.includedInGross === "true",
          included_in_net: componentForm.includedInNet === "true",
          included_in_employer_cost:
            componentForm.includedInEmployerCost === "true",
          subject_to_proration: componentForm.subjectToProration === "true",
          allow_manual_input: componentForm.allowManualInput === "true",
          calculation_order: Number(componentForm.calculationOrder) || 1,
        });
      } else if (createMode === "calendar") {
        if (editingCalendar) {
          if (!calendarForm.name.trim() || !calendarForm.reason?.trim()) {
            throw new Error("Calendar name and change reason are required.");
          }
          await updatePayrollCalendar(token, rowId(editingCalendar), {
            name: calendarForm.name.trim(),
            cutoff_day: Number(calendarForm.cutoffDay),
            payment_day: Number(calendarForm.paymentDay),
            timezone: calendarForm.timezone.trim(),
            currency: calendarForm.currency.trim(),
            is_default: calendarForm.isDefault === "true",
            reason: calendarForm.reason.trim(),
          });
        } else {
          if (!calendarForm.code.trim() || !calendarForm.name.trim()) {
            throw new Error("Code and name are required.");
          }
          await createPayrollCalendar(token, {
            code: calendarForm.code.trim(),
            name: calendarForm.name.trim(),
            cutoff_day: Number(calendarForm.cutoffDay) || undefined,
            payment_day: Number(calendarForm.paymentDay) || undefined,
            timezone: calendarForm.timezone.trim() || undefined,
            currency: calendarForm.currency.trim() || undefined,
            is_default: calendarForm.isDefault === "true",
          });
        }
      } else if (createMode === "structure") {
        const lines = structureForm.components
          .filter((line) => line.componentId)
          .map((line) => ({
            component_id: Number(line.componentId),
            default_amount: line.defaultAmount.trim() || undefined,
            default_rate: line.defaultRate.trim() || undefined,
            calculation_order: Number(line.calculationOrder) || 1,
          }));
        if (
          !structureForm.code.trim() ||
          !structureForm.name.trim() ||
          !structureForm.effectiveFrom ||
          lines.length === 0
        ) {
          throw new Error(
            "Code, name, effective from, and at least one component line are required.",
          );
        }
        const editingId = rowId(editingStructure);
        if (editingId) {
          const isActive =
            readStatus(editingStructure).toUpperCase() === "ACTIVE";
          await updatePayrollSalaryStructure(token, editingId, {
            name: structureForm.name.trim(),
            description: structureForm.description.trim() || null,
            effective_to: structureForm.effectiveTo || null,
            ...(isActive
              ? {}
              : {
                  currency: structureForm.currency.trim() || undefined,
                  effective_from: structureForm.effectiveFrom,
                  components: lines,
                }),
          });
          setEditingStructure(null);
        } else {
          await createPayrollSalaryStructure(token, {
            code: structureForm.code.trim(),
            name: structureForm.name.trim(),
            description: structureForm.description.trim() || undefined,
            currency: structureForm.currency.trim() || undefined,
            effective_from: structureForm.effectiveFrom,
            effective_to: structureForm.effectiveTo || undefined,
            components: lines,
          });
        }
      } else if (createMode === "scheme") {
        if (!schemeForm.code.trim() || !schemeForm.name.trim()) {
          throw new Error("Code and name are required.");
        }
        await createPayrollStatutoryScheme(token, {
          code: schemeForm.code.trim(),
          name: schemeForm.name.trim(),
          scheme_type: schemeForm.schemeType,
          jurisdiction: schemeForm.jurisdiction.trim() || undefined,
        });
      } else if (createMode === "mapping") {
        if (
          !mappingForm.componentCode.trim() ||
          !mappingForm.debitAccountCode.trim() ||
          !mappingForm.creditAccountCode.trim()
        ) {
          throw new Error(
            "Component code, debit account, and credit account are required.",
          );
        }
        let dimensions: Record<string, unknown> | undefined;
        if (mappingForm.dimensionsJson.trim()) {
          try {
            dimensions = JSON.parse(mappingForm.dimensionsJson) as Record<
              string,
              unknown
            >;
          } catch {
            throw new Error("Dimensions must be valid JSON.");
          }
        }
        const guidedDimensions = { ...(dimensions ?? {}) };
        setDimensionMap(
          guidedDimensions,
          "debit_accounts_by_project",
          mappingForm.projectDebitMap,
        );
        setDimensionMap(
          guidedDimensions,
          "credit_accounts_by_project",
          mappingForm.projectCreditMap,
        );
        setDimensionMap(
          guidedDimensions,
          "debit_accounts_by_cost_center",
          mappingForm.costCenterDebitMap,
        );
        setDimensionMap(
          guidedDimensions,
          "credit_accounts_by_cost_center",
          mappingForm.costCenterCreditMap,
        );
        setDimensionMap(
          guidedDimensions,
          "debit_accounts_by_department",
          mappingForm.departmentDebitMap,
        );
        setDimensionMap(
          guidedDimensions,
          "credit_accounts_by_department",
          mappingForm.departmentCreditMap,
        );
        setDimensionMap(
          guidedDimensions,
          "debit_accounts_by_branch",
          mappingForm.branchDebitMap,
        );
        setDimensionMap(
          guidedDimensions,
          "credit_accounts_by_branch",
          mappingForm.branchCreditMap,
        );
        setDimensionMap(
          guidedDimensions,
          "debit_accounts_by_employee_category",
          mappingForm.categoryDebitMap,
        );
        setDimensionMap(
          guidedDimensions,
          "credit_accounts_by_employee_category",
          mappingForm.categoryCreditMap,
        );
        setDimensionMap(
          guidedDimensions,
          "debit_accounts_by_payroll_group",
          mappingForm.groupDebitMap,
        );
        setDimensionMap(
          guidedDimensions,
          "credit_accounts_by_payroll_group",
          mappingForm.groupCreditMap,
        );
        await createPayrollAccountingMapping(token, {
          component_code: mappingForm.componentCode.trim(),
          debit_account_code: mappingForm.debitAccountCode.trim(),
          credit_account_code: mappingForm.creditAccountCode.trim(),
          dimensions:
            Object.keys(guidedDimensions).length > 0
              ? guidedDimensions
              : undefined,
        });
      } else if (createMode === "group") {
        if (!advancedForm.code.trim() || !advancedForm.name.trim()) {
          throw new Error("Code and name are required.");
        }
        await createPayrollGroup(token, {
          code: advancedForm.code.trim(),
          name: advancedForm.name.trim(),
          frequency: advancedForm.frequency,
          payroll_calendar_id: advancedForm.payrollCalendarId
            ? Number(advancedForm.payrollCalendarId)
            : undefined,
          branch_id: advancedForm.branchId
            ? Number(advancedForm.branchId)
            : undefined,
          department_id: advancedForm.departmentId
            ? Number(advancedForm.departmentId)
            : undefined,
          employee_category: advancedForm.employeeCategory.trim() || undefined,
          employment_type: advancedForm.employmentType.trim() || undefined,
          currency: advancedForm.currency.trim() || undefined,
        });
      } else if (createMode === "assignment") {
        if (
          !advancedForm.payrollGroupId ||
          !advancedForm.employeeId ||
          !advancedForm.effectiveFrom
        ) {
          throw new Error(
            "Payroll group, employee ID, and effective from are required.",
          );
        }
        await createPayrollGroupAssignment(token, {
          payroll_group_id: Number(advancedForm.payrollGroupId),
          employee_id: Number(advancedForm.employeeId),
          effective_from: advancedForm.effectiveFrom,
          effective_to: advancedForm.effectiveTo || undefined,
        });
      } else if (createMode === "overtime") {
        if (
          !advancedForm.code.trim() ||
          !advancedForm.name.trim() ||
          !advancedForm.componentCode.trim()
        ) {
          throw new Error("Code, name, and component code are required.");
        }
        await createPayrollOvertimePolicy(token, {
          code: advancedForm.code.trim(),
          name: advancedForm.name.trim(),
          component_code: advancedForm.componentCode.trim(),
          regular_multiplier:
            advancedForm.regularMultiplier.trim() || undefined,
          weekend_multiplier:
            advancedForm.weekendMultiplier.trim() || undefined,
          holiday_multiplier:
            advancedForm.holidayMultiplier.trim() || undefined,
          minimum_minutes: Number(advancedForm.minimumMinutes) || 0,
          effective_from: advancedForm.effectiveFrom || undefined,
          effective_to: advancedForm.effectiveTo || undefined,
        });
      } else if (createMode === "bonus") {
        if (
          !advancedForm.code.trim() ||
          !advancedForm.name.trim() ||
          !advancedForm.componentCode.trim()
        ) {
          throw new Error("Code, name, and component code are required.");
        }
        await createPayrollBonusScheme(token, {
          code: advancedForm.code.trim(),
          name: advancedForm.name.trim(),
          scheme_type: advancedForm.schemeType,
          component_code: advancedForm.componentCode.trim(),
          calculation_method: advancedForm.calculationMethod,
          default_amount: advancedForm.defaultAmount.trim() || undefined,
          default_rate: advancedForm.defaultRate.trim() || undefined,
          effective_from: advancedForm.effectiveFrom || undefined,
          effective_to: advancedForm.effectiveTo || undefined,
        });
      } else if (createMode === "leaveRule") {
        if (
          !advancedForm.code.trim() ||
          !advancedForm.name.trim() ||
          !advancedForm.leaveTypeCode.trim()
        ) {
          throw new Error("Code, name, and leave type code are required.");
        }
        await createPayrollLeaveRule(token, {
          code: advancedForm.code.trim(),
          name: advancedForm.name.trim(),
          leave_type_code: advancedForm.leaveTypeCode.trim(),
          paid_percentage: advancedForm.paidPercentage.trim() || undefined,
          paid_days_cap: advancedForm.paidDaysCap.trim() || undefined,
          half_pay_after_days:
            advancedForm.halfPayAfterDays.trim() || undefined,
          unpaid_after_days: advancedForm.unpaidAfterDays.trim() || undefined,
          carry_forward_cap_days:
            advancedForm.carryForwardCapDays.trim() || undefined,
          effective_from: advancedForm.effectiveFrom || undefined,
          effective_to: advancedForm.effectiveTo || undefined,
        });
      } else if (createMode === "adjustment") {
        if (
          !advancedForm.payrollPeriodId ||
          !advancedForm.employeeId ||
          !advancedForm.componentCode.trim() ||
          !advancedForm.amount.trim()
        ) {
          throw new Error(
            "Payroll period, employee ID, component code, and amount are required.",
          );
        }
        await createPayrollAdjustment(token, {
          payroll_period_id: Number(advancedForm.payrollPeriodId),
          employee_id: Number(advancedForm.employeeId),
          component_code: advancedForm.componentCode.trim(),
          amount: advancedForm.amount.trim(),
          reason: advancedForm.reason.trim() || undefined,
          adjustment_type: advancedForm.adjustmentType,
          effective_period_code:
            advancedForm.effectivePeriodCode.trim() || undefined,
          correction_of_run_id: advancedForm.correctionOfRunId
            ? Number(advancedForm.correctionOfRunId)
            : undefined,
        });
      }

      toast.success(
        createMode === "profile" ? "Payroll profile saved." : "Saved.",
      );
      setCreateOpen(false);
      setEditingCalendar(null);
      setRunForm(emptyRunForm());
      setInputForm(emptyInputForm());
      setProfileForm(emptyProfileForm());
      setPeriodForm(emptyPeriodForm());
      setComponentForm(emptyComponentForm());
      setCalendarForm(emptyCalendarForm());
      setStructureForm(emptyStructureForm());
      setSchemeForm(emptySchemeForm());
      setMappingForm(emptyMappingForm());
      setAdvancedForm(emptyAdvancedPayrollForm());
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to save payroll record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSavePeriodDates() {
    const token = readStoredToken();
    const id = rowId(periodDatesTarget);
    if (!token || !id) {
      setFormError("Authentication or payroll period is missing.");
      return;
    }
    if (
      !periodDatesForm.cutoffDate ||
      !periodDatesForm.paymentDate ||
      !periodDatesForm.reason.trim()
    ) {
      setFormError("Cut-off date, payment date, and reason are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await updatePayrollPeriodDates(token, id, {
        cutoff_date: periodDatesForm.cutoffDate,
        payment_date: periodDatesForm.paymentDate,
        reason: periodDatesForm.reason.trim(),
      });
      toast.success("Payroll period dates updated.");
      setPeriodDatesTarget(null);
      setPeriodDatesForm({ cutoffDate: "", paymentDate: "", reason: "" });
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update payroll period dates.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSaveSecurityPolicy() {
    const token = readStoredToken();
    if (!token) return toast.error("Authentication required.");
    const loginAllowed = readBoolean(securityPolicy, ["allow_verified_login"]);
    const freshAllowed = readBoolean(securityPolicy, [
      "allow_fresh_authenticator",
    ]);
    if (!loginAllowed && !freshAllowed) {
      toast.error("Enable at least one payroll generation 2FA method.");
      return;
    }
    if (!securityPolicyReason.trim()) {
      toast.error("Provide a reason for changing payroll security settings.");
      return;
    }
    setSecurityPolicySaving(true);
    try {
      const payload = await updatePayrollSecurityPolicy(token, {
        allow_verified_login: loginAllowed,
        allow_fresh_authenticator: freshAllowed,
        reason: securityPolicyReason.trim(),
      });
      if (payload && typeof payload === "object") {
        setSecurityPolicy(payload as AdminRecord);
      }
      setSecurityPolicyReason("");
      toast.success("Payroll security policy updated.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not save payroll security policy.",
      );
    } finally {
      setSecurityPolicySaving(false);
    }
  }

  async function onCreateRule() {
    const token = readStoredToken();
    if (!token) {
      setFormError("Authentication required. Please log in again.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (!ruleForm.schemeId || !ruleForm.effectiveFrom) {
        throw new Error("Scheme and effective-from date are required.");
      }
      if (!ruleForm.sourceReference.trim()) {
        throw new Error(
          "An official source or evidence reference is required.",
        );
      }
      const bands =
        ruleForm.lowerLimit.trim() || ruleForm.ratePercent.trim()
          ? [
              {
                lower_limit: ruleForm.lowerLimit.trim(),
                upper_limit: ruleForm.upperLimit.trim() || undefined,
                base_tax: ruleForm.baseTax.trim() || undefined,
                rate_percent: ruleForm.ratePercent.trim(),
                sort_order: Number(ruleForm.sortOrder) || 1,
              },
            ]
          : undefined;
      const configuration =
        ruleSchemeCode === "SDL"
          ? {
              basis: "GROSS_EMOLUMENTS",
              employeeCountThreshold: 10,
              employerExempt: ruleForm.employerExempt === "true",
            }
          : ruleSchemeCode === "WCF"
            ? { basis: "BASIC_PLUS_REGULAR_FIXED_ALLOWANCES" }
            : undefined;
      await createPayrollStatutoryRule(token, {
        scheme_id: Number(ruleForm.schemeId),
        version_number: Number(ruleForm.versionNumber) || 1,
        calculation_method: ruleForm.calculationMethod,
        employee_rate: ruleForm.employeeRate.trim() || undefined,
        employer_rate: ruleForm.employerRate.trim() || undefined,
        maximum_basis: ruleForm.maximumBasis.trim() || undefined,
        deduct_employee_before_tax: ruleForm.deductEmployeeBeforeTax === "true",
        effective_from: ruleForm.effectiveFrom,
        effective_to: ruleForm.effectiveTo || undefined,
        source_reference: ruleForm.sourceReference.trim(),
        configuration,
        bands,
      });
      toast.success("Statutory rule created.");
      setRuleOpen(false);
      setRuleForm(emptyRuleForm());
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to save statutory rule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onApproveStatutoryRule(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setApprovingStatutoryRuleId(id);
    try {
      await approvePayrollStatutoryRule(token, id);
      toast.success("Statutory rule approved and recorded.");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not approve statutory rule.",
      );
    } finally {
      setApprovingStatutoryRuleId("");
    }
  }

  async function onApproveRun() {
    const token = readStoredToken();
    if (!token || !approveRunId) return;
    if (!approveForm.calculationHash.trim()) {
      setFormError("Calculation hash is required for approval.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await approvePayrollRun(token, approveRunId, {
        stage: approveForm.stage,
        calculation_hash: approveForm.calculationHash.trim(),
        comments: approveForm.comments.trim() || undefined,
      });
      toast.success("Payroll run approved.");
      setApproveOpen(false);
      setApproveRunId("");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to approve run.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onRejectRun() {
    const token = readStoredToken();
    if (!token || !approveRunId) return;
    const reason = approveForm.comments.trim();
    if (!approveForm.calculationHash.trim()) {
      setFormError("Calculation hash is required for rejection.");
      return;
    }
    if (!reason) {
      setFormError("Enter the rejection reason in Comments.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await rejectPayrollRun(token, approveRunId, {
        stage: approveForm.stage,
        calculation_hash: approveForm.calculationHash.trim(),
        reason,
      });
      toast.success("Payroll run returned to the preparer.");
      setApproveOpen(false);
      setApproveRunId("");
      await loadRows({ refreshLookups: true });
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to reject run.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderCreateFields() {
    if (createMode === "run") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll period">
            <FluentSelect
              ariaLabel="Payroll period"
              className="w-full"
              value={runForm.payrollPeriodId}
              placeholder="Select a period"
              onChange={(value) =>
                setRunForm((current) => ({
                  ...current,
                  payrollPeriodId: value,
                }))
              }
              options={[
                { value: "", label: "Select a period" },
                ...periods.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: readPeriodLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Run type">
            <FluentSelect
              ariaLabel="Run type"
              className="w-full"
              value={runForm.runType}
              onChange={(value) =>
                setRunForm((current) => ({
                  ...current,
                  runType: value,
                }))
              }
              options={RUN_TYPES.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Payroll group">
            <FluentSelect
              ariaLabel="Payroll group"
              className="w-full"
              value={runForm.payrollGroupId}
              placeholder="All eligible employees"
              onChange={(value) =>
                setRunForm((current) => ({
                  ...current,
                  payrollGroupId: value,
                }))
              }
              options={[
                { value: "", label: "All eligible employees" },
                ...groups.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: optionLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Parent run ID">
            <input
              className={inputClass}
              value={runForm.parentRunId}
              onChange={(event) =>
                setRunForm((current) => ({
                  ...current,
                  parentRunId: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Offboarding request ID">
            <input
              className={inputClass}
              value={runForm.offboardingRequestId}
              onChange={(event) =>
                setRunForm((current) => ({
                  ...current,
                  offboardingRequestId: event.target.value,
                }))
              }
              placeholder="Optional final settlement link"
            />
          </Field>
        </div>
      );
    }

    if (createMode === "input") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll period">
            <FluentSelect
              ariaLabel="Payroll period"
              className="w-full"
              value={inputForm.payrollPeriodId}
              placeholder="Select a period"
              onChange={(value) =>
                setInputForm((current) => ({
                  ...current,
                  payrollPeriodId: value,
                }))
              }
              options={[
                { value: "", label: "Select a period" },
                ...periods.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: readPeriodLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={inputForm.employeeId}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  employeeId: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Component code">
            <input
              className={inputClass}
              value={inputForm.componentCode}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              placeholder="BASIC_SALARY"
              list="payroll-component-codes"
            />
            <datalist id="payroll-component-codes">
              {components.map((row, index) => (
                <option
                  key={`component-code-${index}`}
                  value={readString(row, ["code"], "")}
                />
              ))}
            </datalist>
          </Field>
          <Field label="Amount">
            <input
              className={inputClass}
              value={inputForm.amount}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </Field>
          <Field label="Quantity">
            <input
              className={inputClass}
              value={inputForm.quantity}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Rate">
            <input
              className={inputClass}
              value={inputForm.rate}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  rate: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={inputForm.currency}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Status">
            <FluentSelect
              ariaLabel="Status"
              className="w-full"
              value={inputForm.status}
              onChange={(value) =>
                setInputForm((current) => ({
                  ...current,
                  status: value,
                }))
              }
              options={INPUT_STATUSES.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Source module">
            <input
              className={inputClass}
              value={inputForm.sourceModule}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  sourceModule: event.target.value,
                }))
              }
              placeholder="Attendance"
            />
          </Field>
          <Field label="Source reference">
            <input
              className={inputClass}
              value={inputForm.sourceReference}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  sourceReference: event.target.value,
                }))
              }
              placeholder="Optional reference"
            />
          </Field>
          <Field label="Late adjustment reason">
            <input
              className={inputClass}
              value={inputForm.lateAdjustmentReason}
              onChange={(event) =>
                setInputForm((current) => ({
                  ...current,
                  lateAdjustmentReason: event.target.value,
                }))
              }
              placeholder="Required only after the period cutoff"
            />
          </Field>
        </div>
      );
    }

    if (createMode === "source") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll period">
            <FluentSelect
              ariaLabel="Payroll period"
              className="w-full"
              value={advancedForm.payrollPeriodId}
              placeholder="Select a period"
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  payrollPeriodId: value,
                }))
              }
              options={[
                { value: "", label: "Select a period" },
                ...periods.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: readPeriodLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Source type">
            <FluentSelect
              ariaLabel="Source type"
              className="w-full"
              value={advancedForm.sourceType}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  sourceType: value,
                }))
              }
              options={["SALES", "COMMISSION"].map(
                (value) => ({
                  value,
                  label: prettify(value),
                }),
              )}
            />
          </Field>
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={advancedForm.employeeId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employeeId: event.target.value,
                }))
              }
              placeholder="Optional for company-wide input"
            />
          </Field>
          <Field label="Component code">
            <input
              className={inputClass}
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
            />
          </Field>
          <Field label="Source reference">
            <input
              className={inputClass}
              value={advancedForm.sourceReference}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  sourceReference: event.target.value,
                }))
              }
              placeholder="Invoice or deal ID"
            />
          </Field>
          <Field label="Scheme code">
            <input
              className={inputClass}
              value={advancedForm.schemeCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  schemeCode: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Source amount">
            <input
              className={inputClass}
              value={advancedForm.sourceAmount}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  sourceAmount: event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </Field>
          <Field label="Calculated amount">
            <input
              className={inputClass}
              value={advancedForm.calculatedAmount}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  calculatedAmount: event.target.value,
                }))
              }
              placeholder="Overrides quantity x rate"
            />
          </Field>
          <Field label="Quantity">
            <input
              className={inputClass}
              value={advancedForm.quantity}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Rate">
            <input
              className={inputClass}
              value={advancedForm.rate}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  rate: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={advancedForm.currency}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "sourceImport") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll period">
            <FluentSelect
              ariaLabel="Payroll period"
              className="w-full"
              value={advancedForm.payrollPeriodId}
              placeholder="Select a period"
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  payrollPeriodId: value,
                }))
              }
              options={[
                { value: "", label: "Select a period" },
                ...periods.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: readPeriodLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Provider">
            <input
              className={inputClass}
              value={advancedForm.providerKey}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  providerKey: event.target.value,
                }))
              }
              placeholder="SALES_CSV, CRM, POS"
            />
          </Field>
          <Field label="Source type">
            <FluentSelect
              ariaLabel="Source type"
              className="w-full"
              value={advancedForm.sourceType}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  sourceType: value,
                }))
              }
              options={["SALES", "COMMISSION"].map(
                (value) => ({
                  value,
                  label: prettify(value),
                }),
              )}
            />
          </Field>
          <Field label="Default component">
            <input
              className={inputClass}
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
              placeholder="COMMISSION"
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={advancedForm.currency}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Approval">
            <FluentSelect
              ariaLabel="Approval"
              className="w-full"
              value={advancedForm.autoApprove}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  autoApprove: value,
                }))
              }
              options={[
                { value: "true", label: "Auto approve" },
                { value: "false", label: "Keep draft" },
              ]}
            />
          </Field>
          <Field label="Posting">
            <FluentSelect
              ariaLabel="Posting"
              className="w-full"
              value={advancedForm.autoPost}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  autoPost: value,
                }))
              }
              options={[
                { value: "false", label: "Do not post yet" },
                { value: "true", label: "Post to payroll inputs" },
              ]}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="CSV or TSV rows">
              <Textarea
                className={cn(textareaClass, "min-h-40 font-mono text-xs")}
                value={advancedForm.importText}
                onChange={(event) =>
                  setAdvancedForm((current) => ({
                    ...current,
                    importText: event.target.value,
                  }))
                }
                placeholder={
                  "employee_id,employee_no,component_code,source_reference,amount,quantity,rate,calculated_amount\n101,,COMMISSION,INV-1001,150000,,,150000"
                }
              />
            </Field>
          </div>
        </div>
      );
    }

    if (createMode === "adjustment") {
      return (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <FluentField label="Payroll period">
            <FluentSelect
              ariaLabel="Payroll period"
              className="w-full"
              value={advancedForm.payrollPeriodId}
              placeholder="Select a period"
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  payrollPeriodId: value,
                }))
              }
              options={[
                { value: "", label: "Select a period" },
                ...periods.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: readPeriodLabel(row) }];
                }),
              ]}
            />
          </FluentField>
          <FluentField label="Employee ID">
            <FluentInput
              className="w-full"
              value={advancedForm.employeeId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employeeId: event.target.value,
                }))
              }
            />
          </FluentField>
          <FluentField label="Component code">
            <FluentInput
              className="w-full"
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
            />
          </FluentField>
          <FluentField label="Amount">
            <FluentInput
              className="w-full"
              value={advancedForm.amount}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </FluentField>
          <FluentField label="Adjustment type">
            <FluentSelect
              ariaLabel="Adjustment type"
              className="w-full"
              value={advancedForm.adjustmentType}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  adjustmentType: value,
                }))
              }
              options={[
                { value: "ADJUSTMENT", label: "Adjustment" },
                { value: "ARREARS", label: "Arrears" },
                { value: "RETROACTIVE_SALARY", label: "Retroactive salary" },
                { value: "CORRECTION", label: "Correction" },
                { value: "BONUS", label: "Bonus" },
                { value: "COMMISSION", label: "Commission" },
              ]}
            />
          </FluentField>
          <FluentField label="Effective period code">
            <FluentInput
              className="w-full"
              value={advancedForm.effectivePeriodCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectivePeriodCode: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </FluentField>
          <FluentField label="Corrects paid run ID">
            <FluentInput
              className="w-full"
              value={advancedForm.correctionOfRunId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  correctionOfRunId: event.target.value,
                }))
              }
              placeholder="Only for corrections of paid payroll"
            />
          </FluentField>
          <FluentField label="Reason" className="md:col-span-2">
            <Textarea
              formatting
              formattingHint
              className="min-h-24"
              value={advancedForm.reason}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              placeholder="Reason for the adjustment"
            />
          </FluentField>
        </div>
      );
    }

    if (createMode === "group") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Frequency">
            <FluentSelect
              ariaLabel="Frequency"
              className="w-full"
              value={advancedForm.frequency}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  frequency: value,
                }))
              }
              options={[
                ...PAY_FREQUENCIES.map((value) => ({
                  value,
                  label: prettify(value),
                })),
                { value: "CASUAL", label: "Casual" },
                { value: "DAILY", label: "Daily" },
              ]}
            />
          </Field>
          <Field label="Calendar">
            <FluentSelect
              ariaLabel="Calendar"
              className="w-full"
              value={advancedForm.payrollCalendarId}
              placeholder="Optional"
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  payrollCalendarId: value,
                }))
              }
              options={[
                { value: "", label: "Optional" },
                ...calendars.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: optionLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Branch ID">
            <input
              className={inputClass}
              value={advancedForm.branchId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  branchId: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Department ID">
            <input
              className={inputClass}
              value={advancedForm.departmentId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  departmentId: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Employee category">
            <input
              className={inputClass}
              value={advancedForm.employeeCategory}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employeeCategory: event.target.value,
                }))
              }
              placeholder="Management, expatriate, branch..."
            />
          </Field>
          <Field label="Employment type">
            <input
              className={inputClass}
              value={advancedForm.employmentType}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employmentType: event.target.value,
                }))
              }
              placeholder="Permanent, casual, contract..."
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={advancedForm.currency}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "overtime") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Payroll component">
            <input
              className={inputClass}
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
            />
          </Field>
          <Field label="Regular multiplier">
            <input
              className={inputClass}
              value={advancedForm.regularMultiplier}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  regularMultiplier: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Weekend multiplier">
            <input
              className={inputClass}
              value={advancedForm.weekendMultiplier}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  weekendMultiplier: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Holiday multiplier">
            <input
              className={inputClass}
              value={advancedForm.holidayMultiplier}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  holidayMultiplier: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Minimum minutes">
            <input
              className={inputClass}
              value={advancedForm.minimumMinutes}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  minimumMinutes: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective from">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveFrom}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective to">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveTo}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveTo: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "bonus") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Scheme type">
            <FluentSelect
              ariaLabel="Scheme type"
              className="w-full"
              value={advancedForm.schemeType}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  schemeType: value,
                }))
              }
              options={[
                { value: "BONUS", label: "Bonus" },
                { value: "COMMISSION", label: "Commission" },
                { value: "INCENTIVE", label: "Incentive" },
                { value: "THIRTEENTH_MONTH", label: "Thirteenth month" },
              ]}
            />
          </Field>
          <Field label="Payroll component">
            <input
              className={inputClass}
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
            />
          </Field>
          <Field label="Calculation method">
            <FluentSelect
              ariaLabel="Calculation method"
              className="w-full"
              value={advancedForm.calculationMethod}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  calculationMethod: value,
                }))
              }
              options={[
                ...CALCULATION_METHODS.map((value) => ({
                  value,
                  label: prettify(value),
                })),
                { value: "PERCENTAGE_OF_SALES", label: "Percentage of sales" },
                { value: "FORMULA", label: "Formula" },
              ]}
            />
          </Field>
          <Field label="Default amount">
            <input
              className={inputClass}
              value={advancedForm.defaultAmount}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  defaultAmount: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Default rate">
            <input
              className={inputClass}
              value={advancedForm.defaultRate}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  defaultRate: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Effective from">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveFrom}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective to">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveTo}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveTo: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "profile") {
      return (
        <div className="space-y-5">
          <FormSection title="Employee">
            <Field label="Employee ID">
              <input
                className={inputClass}
                value={profileForm.employeeId}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    employeeId: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Payroll number">
              <input
                className={inputClass}
                value={profileForm.payrollNumber}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    payrollNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Effective from">
              <DateInput
                className={inputClass}

                value={profileForm.effectiveFrom}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Effective to">
              <DateInput
                className={inputClass}

                value={profileForm.effectiveTo}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    effectiveTo: event.target.value,
                  }))
                }
              />
            </Field>
          </FormSection>
          <FormSection title="Payment">
            <Field label="Payment method">
              <FluentSelect
                ariaLabel="Payment method"
                className="w-full"
                value={profileForm.paymentMethod}
                placeholder="Select method"
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    paymentMethod: value,
                  }))
                }
                options={[
                  { value: "", label: "Select method" },
                  ...PAYMENT_METHODS.map((value) => ({
                    value,
                    label: prettify(value),
                  })),
                ]}
              />
            </Field>
            <Field label="Primary bank account ID">
              <input
                className={inputClass}
                value={profileForm.primaryBankAccountId}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    primaryBankAccountId: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Currency">
              <input
                className={inputClass}
                value={profileForm.currency}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    currency: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Pay frequency">
              <FluentSelect
                ariaLabel="Pay frequency"
                className="w-full"
                value={profileForm.payFrequency}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    payFrequency: value,
                  }))
                }
                options={PAY_FREQUENCIES.map((value) => ({
                  value,
                  label: prettify(value),
                }))}
              />
            </Field>
          </FormSection>
          <FormSection title="Tax and statutory">
            <Field label="TIN">
              <input
                className={inputClass}
                value={profileForm.taxpayerIdentificationNumber}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    taxpayerIdentificationNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Social security scheme">
              <input
                className={inputClass}
                value={profileForm.socialSecuritySchemeCode}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    socialSecuritySchemeCode: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Social security number">
              <input
                className={inputClass}
                value={profileForm.socialSecurityNumber}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    socialSecurityNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Health scheme">
              <input
                className={inputClass}
                value={profileForm.healthInsuranceSchemeCode}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    healthInsuranceSchemeCode: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Health number">
              <input
                className={inputClass}
                value={profileForm.healthInsuranceNumber}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    healthInsuranceNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Tax residency code">
              <input
                className={inputClass}
                value={profileForm.taxResidencyCode}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    taxResidencyCode: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Tax category">
              <input
                className={inputClass}
                value={profileForm.employmentTaxCategory}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    employmentTaxCategory: event.target.value,
                  }))
                }
              />
            </Field>
          </FormSection>
          <FormSection title="Processing">
            <Field label="Payroll enabled">
              <FluentSelect
                ariaLabel="Payroll enabled"
                className="w-full"
                value={profileForm.payrollEnabled}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    payrollEnabled: value,
                  }))
                }
                options={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
              />
            </Field>
            <Field label="Payroll hold">
              <FluentSelect
                ariaLabel="Payroll hold"
                className="w-full"
                value={profileForm.payrollHold}
                onChange={(value) =>
                  setProfileForm((current) => ({
                    ...current,
                    payrollHold: value,
                  }))
                }
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ]}
              />
            </Field>
            <Field label="Hold reason" className="md:col-span-2">
              <Textarea
                className={textareaClass}
                value={profileForm.payrollHoldReason}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    payrollHoldReason: event.target.value,
                  }))
                }
              />
            </Field>
          </FormSection>
        </div>
      );
    }

    if (createMode === "period") {
      return (
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Payroll calendar">
            <FluentSelect
              ariaLabel="Payroll calendar"
              className="w-full"
              value={periodForm.payrollCalendarId}
              placeholder="Select a calendar"
              onChange={(value) =>
                setPeriodForm((current) => ({
                  ...current,
                  payrollCalendarId: value,
                }))
              }
              options={[
                { value: "", label: "Select a calendar" },
                ...calendars.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: optionLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Year">
            <input
              className={inputClass}
              value={periodForm.year}
              onChange={(event) =>
                setPeriodForm((current) => ({
                  ...current,
                  year: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Month">
            <input
              className={inputClass}
              value={periodForm.month}
              onChange={(event) =>
                setPeriodForm((current) => ({
                  ...current,
                  month: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "component") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={componentForm.code}
              onChange={(event) =>
                setComponentForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={componentForm.name}
              onChange={(event) =>
                setComponentForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Component type">
            <FluentSelect
              ariaLabel="Component type"
              className="w-full"
              value={componentForm.componentType}
              onChange={(value) =>
                setComponentForm((current) => ({
                  ...current,
                  componentType: value,
                }))
              }
              options={COMPONENT_TYPES.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Frequency">
            <FluentSelect
              ariaLabel="Frequency"
              className="w-full"
              value={componentForm.frequency}
              onChange={(value) =>
                setComponentForm((current) => ({
                  ...current,
                  frequency: value,
                }))
              }
              options={FREQUENCIES.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Calculation method">
            <FluentSelect
              ariaLabel="Calculation method"
              className="w-full"
              value={componentForm.calculationMethod}
              onChange={(value) =>
                setComponentForm((current) => ({
                  ...current,
                  calculationMethod: value,
                }))
              }
              options={CALCULATION_METHODS.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Tax treatment">
            <FluentSelect
              ariaLabel="Tax treatment"
              className="w-full"
              value={componentForm.taxTreatment}
              onChange={(value) =>
                setComponentForm((current) => ({
                  ...current,
                  taxTreatment: value,
                }))
              }
              options={TAX_TREATMENTS.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Taxable percentage">
            <input
              className={inputClass}
              value={componentForm.taxablePercentage}
              onChange={(event) =>
                setComponentForm((current) => ({
                  ...current,
                  taxablePercentage: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Calculation order">
            <input
              className={inputClass}
              value={componentForm.calculationOrder}
              onChange={(event) =>
                setComponentForm((current) => ({
                  ...current,
                  calculationOrder: event.target.value,
                }))
              }
            />
          </Field>
          {[
            ["pensionable", "Pensionable"],
            ["healthInsuranceApplicable", "Health insurance applicable"],
            ["includedInGross", "Included in gross"],
            ["includedInNet", "Included in net"],
            ["includedInEmployerCost", "Included in employer cost"],
            ["subjectToProration", "Subject to proration"],
            ["allowManualInput", "Allow manual input"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <FluentSelect
                ariaLabel={label}
                className="w-full"
                value={
                  componentForm[key as keyof typeof componentForm] as string
                }
                onChange={(value) =>
                  setComponentForm((current) => ({
                    ...current,
                    [key]: value,
                  }))
                }
                options={[
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]}
              />
            </Field>
          ))}
        </div>
      );
    }

    if (createMode === "calendar") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {!editingCalendar ? (
            <Field label="Code">
              <input
                className={inputClass}
                value={calendarForm.code}
                onChange={(event) =>
                  setCalendarForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
              />
            </Field>
          ) : null}
          <Field label="Name">
            <input
              className={inputClass}
              value={calendarForm.name}
              onChange={(event) =>
                setCalendarForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Cut-off day">
            <input
              className={inputClass}
              value={calendarForm.cutoffDay}
              onChange={(event) =>
                setCalendarForm((current) => ({
                  ...current,
                  cutoffDay: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Payment day">
            <input
              className={inputClass}
              value={calendarForm.paymentDay}
              onChange={(event) =>
                setCalendarForm((current) => ({
                  ...current,
                  paymentDay: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Timezone">
            <input
              className={inputClass}
              value={calendarForm.timezone}
              onChange={(event) =>
                setCalendarForm((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={calendarForm.currency}
              onChange={(event) =>
                setCalendarForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Default calendar">
            <FluentSelect
              ariaLabel="Default calendar"
              className="w-full"
              value={calendarForm.isDefault}
              onChange={(value) =>
                setCalendarForm((current) => ({
                  ...current,
                  isDefault: value,
                }))
              }
              options={[
                { value: "false", label: "No" },
                { value: "true", label: "Yes" },
              ]}
            />
          </Field>
          {editingCalendar ? (
            <Field label="Reason for change" className="md:col-span-2">
              <Textarea
                className={textareaClass}
                value={calendarForm.reason}
                onChange={(event) =>
                  setCalendarForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </Field>
          ) : null}
          {editingCalendar ? (
            <p className="text-xs text-muted-foreground md:col-span-2">
              Calendar defaults apply to periods generated in the future.
              Existing periods keep their saved dates.
            </p>
          ) : null}
        </div>
      );
    }

    if (createMode === "structure") {
      const linesLocked =
        readStatus(editingStructure).toUpperCase() === "ACTIVE";
      return (
        <div className="space-y-4">
          {linesLocked ? (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
              This version is active. Only name, description and effective to
              can change. Use &ldquo;New version&rdquo; to change lines,
              currency or start date.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Code">
              <input
                className={inputClass}
                disabled={Boolean(editingStructure)}
                value={structureForm.code}
                onChange={(event) =>
                  setStructureForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Name">
              <input
                className={inputClass}
                value={structureForm.name}
                onChange={(event) =>
                  setStructureForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Currency">
              <input
                className={inputClass}
                disabled={linesLocked}
                value={structureForm.currency}
                onChange={(event) =>
                  setStructureForm((current) => ({
                    ...current,
                    currency: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Effective from">
              <DateInput
                className={inputClass}

                disabled={linesLocked}
                value={structureForm.effectiveFrom}
                onChange={(event) =>
                  setStructureForm((current) => ({
                    ...current,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Effective to">
              <DateInput
                className={inputClass}

                value={structureForm.effectiveTo}
                onChange={(event) =>
                  setStructureForm((current) => ({
                    ...current,
                    effectiveTo: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea
                className={textareaClass}
                value={structureForm.description}
                onChange={(event) =>
                  setStructureForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <fieldset
            disabled={linesLocked}
            className="space-y-3 rounded-lg border border-border bg-muted/10 p-3 disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Component lines</p>
                <p className="text-xs text-muted-foreground">
                  Add the payroll components that make up this structure.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium"
                onClick={() =>
                  setStructureForm((current) => ({
                    ...current,
                    components: [...current.components, emptyStructureLine()],
                  }))
                }
              >
                <Add20Regular className="size-3.5" />
                Add line
              </button>
            </div>
            {structureForm.components.map((line, index) => (
              <div
                key={`structure-line-${index}`}
                className="grid gap-3 rounded-lg border border-border/70 bg-background p-3 md:grid-cols-4"
              >
                <Field label="Component">
                  <FluentSelect
                    ariaLabel="Component"
                    className="w-full"
                    value={line.componentId}
                    placeholder="Select a component"
                    onChange={(value) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map(
                          (entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, componentId: value }
                              : entry,
                        ),
                      }))
                    }
                    options={[
                      { value: "", label: "Select a component" },
                      ...components.flatMap((row) => {
                        const id = readNumber(row, ["id"]);
                        if (id === null) return [];
                        return [{ value: String(id), label: optionLabel(row) }];
                      }),
                    ]}
                  />
                </Field>
                <Field label="Default amount">
                  <input
                    className={inputClass}
                    value={line.defaultAmount}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map(
                          (entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, defaultAmount: event.target.value }
                              : entry,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Default rate">
                  <input
                    className={inputClass}
                    value={line.defaultRate}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map(
                          (entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, defaultRate: event.target.value }
                              : entry,
                        ),
                      }))
                    }
                  />
                </Field>
                <Field label="Order">
                  <input
                    className={inputClass}
                    value={line.calculationOrder}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        components: current.components.map(
                          (entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  calculationOrder: event.target.value,
                                }
                              : entry,
                        ),
                      }))
                    }
                  />
                </Field>
                {structureForm.components.length > 1 ? (
                  <div className="md:col-span-4">
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-600"
                      onClick={() =>
                        setStructureForm((current) => ({
                          ...current,
                          components: current.components.filter(
                            (_, entryIndex) => entryIndex !== index,
                          ),
                        }))
                      }
                    >
                      Remove line
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </fieldset>
        </div>
      );
    }

    if (createMode === "scheme") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={schemeForm.code}
              onChange={(event) =>
                setSchemeForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={schemeForm.name}
              onChange={(event) =>
                setSchemeForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Scheme type">
            <FluentSelect
              ariaLabel="Scheme type"
              className="w-full"
              value={schemeForm.schemeType}
              onChange={(value) =>
                setSchemeForm((current) => ({
                  ...current,
                  schemeType: value,
                }))
              }
              options={SCHEME_TYPES.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Jurisdiction">
            <input
              className={inputClass}
              value={schemeForm.jurisdiction}
              onChange={(event) =>
                setSchemeForm((current) => ({
                  ...current,
                  jurisdiction: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (false) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Frequency">
            <FluentSelect
              ariaLabel="Frequency"
              className="w-full"
              value={advancedForm.frequency}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  frequency: value,
                }))
              }
              options={PAY_FREQUENCIES.map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Payroll calendar">
            <FluentSelect
              ariaLabel="Payroll calendar"
              className="w-full"
              value={advancedForm.payrollCalendarId}
              placeholder="Optional"
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  payrollCalendarId: value,
                }))
              }
              options={[
                { value: "", label: "Optional" },
                ...calendars.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: optionLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Branch ID">
            <input
              className={inputClass}
              value={advancedForm.branchId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  branchId: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Department ID">
            <input
              className={inputClass}
              value={advancedForm.departmentId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  departmentId: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Employee category">
            <input
              className={inputClass}
              value={advancedForm.employeeCategory}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employeeCategory: event.target.value,
                }))
              }
              placeholder="Management, expatriate, casual"
            />
          </Field>
          <Field label="Employment type">
            <input
              className={inputClass}
              value={advancedForm.employmentType}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employmentType: event.target.value,
                }))
              }
              placeholder="Permanent, casual, contract"
            />
          </Field>
          <Field label="Currency">
            <input
              className={inputClass}
              value={advancedForm.currency}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "assignment") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Payroll group">
            <FluentSelect
              ariaLabel="Payroll group"
              className="w-full"
              value={advancedForm.payrollGroupId}
              placeholder="Select a group"
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  payrollGroupId: value,
                }))
              }
              options={[
                { value: "", label: "Select a group" },
                ...groups.flatMap((row) => {
                  const id = readNumber(row, ["id"]);
                  if (id === null) return [];
                  return [{ value: String(id), label: optionLabel(row) }];
                }),
              ]}
            />
          </Field>
          <Field label="Employee ID">
            <input
              className={inputClass}
              value={advancedForm.employeeId}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  employeeId: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective from">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveFrom}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective to">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveTo}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveTo: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (false) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Component code">
            <input
              className={inputClass}
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
            />
          </Field>
          <Field label="Regular multiplier">
            <input
              className={inputClass}
              value={advancedForm.regularMultiplier}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  regularMultiplier: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Weekend multiplier">
            <input
              className={inputClass}
              value={advancedForm.weekendMultiplier}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  weekendMultiplier: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Holiday multiplier">
            <input
              className={inputClass}
              value={advancedForm.holidayMultiplier}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  holidayMultiplier: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Minimum minutes">
            <input
              className={inputClass}
              value={advancedForm.minimumMinutes}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  minimumMinutes: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective from">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveFrom}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective to">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveTo}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveTo: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (false) {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Scheme type">
            <FluentSelect
              ariaLabel="Scheme type"
              className="w-full"
              value={advancedForm.schemeType}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  schemeType: value,
                }))
              }
              options={["BONUS", "COMMISSION"].map(
                (value) => ({
                  value,
                  label: prettify(value),
                }),
              )}
            />
          </Field>
          <Field label="Component code">
            <input
              className={inputClass}
              value={advancedForm.componentCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  componentCode: event.target.value,
                }))
              }
              list="payroll-component-codes"
            />
          </Field>
          <Field label="Calculation method">
            <FluentSelect
              ariaLabel="Calculation method"
              className="w-full"
              value={advancedForm.calculationMethod}
              onChange={(value) =>
                setAdvancedForm((current) => ({
                  ...current,
                  calculationMethod: value,
                }))
              }
              options={[
                "FIXED_AMOUNT",
                "PERCENTAGE_OF_BASE",
                "PERCENTAGE_OF_SALES",
                "FORMULA",
              ].map((value) => ({
                value,
                label: prettify(value),
              }))}
            />
          </Field>
          <Field label="Default amount">
            <input
              className={inputClass}
              value={advancedForm.defaultAmount}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  defaultAmount: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Default rate">
            <input
              className={inputClass}
              value={advancedForm.defaultRate}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  defaultRate: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Effective from">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveFrom}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective to">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveTo}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveTo: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    if (createMode === "leaveRule") {
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Code">
            <input
              className={inputClass}
              value={advancedForm.code}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={advancedForm.name}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Leave type code">
            <input
              className={inputClass}
              value={advancedForm.leaveTypeCode}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  leaveTypeCode: event.target.value,
                }))
              }
              placeholder="SICK, MATERNITY, ANNUAL"
            />
          </Field>
          <Field label="Paid percentage">
            <input
              className={inputClass}
              value={advancedForm.paidPercentage}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  paidPercentage: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Paid days cap">
            <input
              className={inputClass}
              value={advancedForm.paidDaysCap}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  paidDaysCap: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Half pay after days">
            <input
              className={inputClass}
              value={advancedForm.halfPayAfterDays}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  halfPayAfterDays: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Unpaid after days">
            <input
              className={inputClass}
              value={advancedForm.unpaidAfterDays}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  unpaidAfterDays: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Carry forward cap">
            <input
              className={inputClass}
              value={advancedForm.carryForwardCapDays}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  carryForwardCapDays: event.target.value,
                }))
              }
              placeholder="Optional"
            />
          </Field>
          <Field label="Effective from">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveFrom}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveFrom: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Effective to">
            <DateInput
              className={inputClass}

              value={advancedForm.effectiveTo}
              onChange={(event) =>
                setAdvancedForm((current) => ({
                  ...current,
                  effectiveTo: event.target.value,
                }))
              }
            />
          </Field>
        </div>
      );
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Component code">
          <input
            className={inputClass}
            value={mappingForm.componentCode}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                componentCode: event.target.value,
              }))
            }
            list="mapping-component-codes"
          />
          <datalist id="mapping-component-codes">
            {components.map((row, index) => (
              <option
                key={`mapping-code-${index}`}
                value={readString(row, ["code"], "")}
              />
            ))}
          </datalist>
        </Field>
        <Field label="Debit account code">
          <input
            className={inputClass}
            value={mappingForm.debitAccountCode}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                debitAccountCode: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Credit account code">
          <input
            className={inputClass}
            value={mappingForm.creditAccountCode}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                creditAccountCode: event.target.value,
              }))
            }
          />
        </Field>
        <Field label="Debit by project">
          <Textarea
            className={textareaClass}
            value={mappingForm.projectDebitMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                projectDebitMap: event.target.value,
              }))
            }
            placeholder="PROJECT_A=5010"
          />
        </Field>
        <Field label="Credit by project">
          <Textarea
            className={textareaClass}
            value={mappingForm.projectCreditMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                projectCreditMap: event.target.value,
              }))
            }
            placeholder="PROJECT_A=2110"
          />
        </Field>
        <Field label="Debit by cost center">
          <Textarea
            className={textareaClass}
            value={mappingForm.costCenterDebitMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                costCenterDebitMap: event.target.value,
              }))
            }
            placeholder="CC-100=5020"
          />
        </Field>
        <Field label="Credit by cost center">
          <Textarea
            className={textareaClass}
            value={mappingForm.costCenterCreditMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                costCenterCreditMap: event.target.value,
              }))
            }
            placeholder="CC-100=2120"
          />
        </Field>
        <Field label="Debit by department">
          <Textarea
            className={textareaClass}
            value={mappingForm.departmentDebitMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                departmentDebitMap: event.target.value,
              }))
            }
            placeholder="10=5030"
          />
        </Field>
        <Field label="Credit by department">
          <Textarea
            className={textareaClass}
            value={mappingForm.departmentCreditMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                departmentCreditMap: event.target.value,
              }))
            }
            placeholder="10=2130"
          />
        </Field>
        <Field label="Debit by branch">
          <Textarea
            className={textareaClass}
            value={mappingForm.branchDebitMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                branchDebitMap: event.target.value,
              }))
            }
            placeholder="3=5040"
          />
        </Field>
        <Field label="Credit by branch">
          <Textarea
            className={textareaClass}
            value={mappingForm.branchCreditMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                branchCreditMap: event.target.value,
              }))
            }
            placeholder="3=2140"
          />
        </Field>
        <Field label="Debit by category">
          <Textarea
            className={textareaClass}
            value={mappingForm.categoryDebitMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                categoryDebitMap: event.target.value,
              }))
            }
            placeholder="MANAGEMENT=5050"
          />
        </Field>
        <Field label="Credit by category">
          <Textarea
            className={textareaClass}
            value={mappingForm.categoryCreditMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                categoryCreditMap: event.target.value,
              }))
            }
            placeholder="MANAGEMENT=2150"
          />
        </Field>
        <Field label="Debit by payroll group">
          <Textarea
            className={textareaClass}
            value={mappingForm.groupDebitMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                groupDebitMap: event.target.value,
              }))
            }
            placeholder="MGMT=5060"
          />
        </Field>
        <Field label="Credit by payroll group">
          <Textarea
            className={textareaClass}
            value={mappingForm.groupCreditMap}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                groupCreditMap: event.target.value,
              }))
            }
            placeholder="MGMT=2160"
          />
        </Field>
        <Field label="Dimensions JSON" className="md:col-span-2">
          <Textarea
            className={textareaClass}
            value={mappingForm.dimensionsJson}
            onChange={(event) =>
              setMappingForm((current) => ({
                ...current,
                dimensionsJson: event.target.value,
              }))
            }
            placeholder='{"department":"HQ"}'
          />
        </Field>
      </div>
    );
  }

  const overviewStats = React.useMemo(() => {
    const activeRuns =
      readNumber(dashboard, [
        "active_runs",
        "activeRuns",
        "processing_runs",
        "processingRuns",
      ]) ??
      recentRuns.filter((row) =>
        ["PENDING", "PROCESSING", "RUNNING"].includes(
          readStatus(row).toUpperCase(),
        ),
      ).length;
    const openInputs =
      readNumber(dashboard, [
        "pending_inputs",
        "pendingInputs",
        "open_inputs",
        "openInputs",
      ]) ?? 0;
    const dashboardEnabledProfiles = readNumber(dashboard, [
      "enabled_profiles",
      "enabledProfiles",
      "payroll_profiles",
      "profileCount",
    ]);
    const enabledProfiles =
      profileSummaryRows !== null
        ? profileSummaryRows.filter((profile) =>
            readBoolean(profile, ["payroll_enabled", "payrollEnabled"]),
          ).length
        : (dashboardEnabledProfiles ?? 0);
    const totalPeriods =
      readNumber(dashboard, ["total_periods", "periodCount"]) ?? periods.length;
    return { activeRuns, openInputs, enabledProfiles, totalPeriods };
  }, [dashboard, periods.length, profileSummaryRows, recentRuns]);

  const openIssueGroup = React.useMemo(() => {
    if (!issueDialogCode || !reportResult) return null;
    return (
      groupReportIssues(reportResult).groups.find(
        (group) => group.code === issueDialogCode,
      ) ?? null
    );
  }, [issueDialogCode, reportResult]);

  const visibleIssueRows = React.useMemo(() => {
    if (!openIssueGroup) return [];
    const query = issueSearch.trim().toLowerCase();
    if (!query) return openIssueGroup.rows;
    return openIssueGroup.rows.filter((issue) =>
      [
        issueSubject(issue, employeeNames),
        ...issueDetailLines(issue, employeeNames).map(
          (line) => `${line.label} ${line.value}`,
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [employeeNames, issueSearch, openIssueGroup]);

  React.useEffect(() => {
    if (!reportResult) return;
    const issues = asRecordArray(reportResult.issues);
    const needsNames = issues.some(
      (issue) => readNumber(issue, ["employee_id", "employeeId"]) !== null,
    );
    if (!needsNames) return;
    const token = readStoredToken();
    if (!token) return;
    let cancelled = false;
    void listAllEmployees(token, {}, { pageSize: 100, maxPages: 20 })
      .then((rows) => {
        if (cancelled) return;
        const next: EmployeeNameLookup = new Map();
        for (const row of rows) {
          const id = readNumber(row, ["id", "employee_id", "employeeId"]);
          if (id === null) continue;
          next.set(id, {
            name: nameFromEmployeeRow(row),
            number: employeeNumberFromRow(row),
            avatarUrl: employeeAvatarFromRow(row),
          });
        }
        setEmployeeNames(next);
        setEmployeeDirectoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setEmployeeDirectoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reportResult]);

  React.useEffect(() => {
    if (tab !== "profiles" || employeeDirectoryLoaded) return;
    const token = readStoredToken();
    if (!token) return;
    let cancelled = false;
    void listAllEmployees(token, {}, { pageSize: 100, maxPages: 20 })
      .then((employees) => {
        if (cancelled) return;
        const next: EmployeeNameLookup = new Map();
        for (const employee of employees) {
          const id = readNumber(employee, ["id", "employee_id", "employeeId"]);
          if (id === null) continue;
          next.set(id, {
            name: nameFromEmployeeRow(employee),
            number: employeeNumberFromRow(employee),
            avatarUrl: employeeAvatarFromRow(employee),
          });
        }
        setEmployeeNames(next);
        setEmployeeDirectoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setEmployeeDirectoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeDirectoryLoaded, tab]);

  if (!actor.ready) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <FluentLoadingIndicator className="size-4 animate-spin" />
        Checking payroll access…
      </div>
    );
  }

  if (!canAccessPayroll) {
    return null;
  }

  return (
    <div className="w-full space-y-5 pb-6">
      <PayrollContractWarningsDialog
        token={readStoredToken() ?? ""}
        warnings={contractWarnings}
        onClose={() => setContractWarnings(null)}
        onAcknowledged={() => {
          setContractWarnings(null);
          const row = pendingLockRow.current;
          pendingLockRow.current = null;
          if (row) void onLockRun(row, true);
        }}
      />
      <section>
        <header className="flex min-h-14 items-center gap-3 border-b border-border/70 px-1 pb-3">
          <PersonMoney20Regular
            className="size-6 shrink-0 text-primary"
            aria-hidden="true"
          />
          <Text as="h1" size={500} weight="semibold">
            Payroll
          </Text>
        </header>

        <div className="tab-rail-scroll">
          <TabList
            aria-label="Payroll sections"
            size="small"
            selectedValue={tab}
            onTabSelect={(_, data) => setTab(data.value as PayrollTab)}
          >
            {TABS.map((entry) => {
              return (
                <Tab key={entry.id} value={entry.id} className="shrink-0">
                  {entry.label}
                </Tab>
              );
            })}
          </TabList>
        </div>
      </section>

      {tab === "configuration" ? (
        <FluentCard className="overflow-hidden p-0">
          <div className="border-b border-border/70 px-4 py-3">
            <Text weight="semibold">Payroll configuration</Text>
            <Text
              as="p"
              size={200}
              className="mt-0.5 !block text-muted-foreground"
            >
              Configure the building blocks used to calculate and process
              payroll.
            </Text>
          </div>
          <div className="tab-rail-scroll px-2">
            <TabList
              aria-label="Payroll configuration sections"
              size="small"
              selectedValue={configTab}
              onTabSelect={(_, data) =>
                setConfigTab(data.value as PayrollConfigTab)
              }
            >
              {CONFIG_TABS.map((entry) => {
                return (
                  <Tab key={entry.id} value={entry.id} className="shrink-0">
                    {entry.label}
                  </Tab>
                );
              })}
            </TabList>
          </div>
        </FluentCard>
      ) : null}

      {error ? (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Active runs",
                tone: "text-blue-600 dark:text-blue-400",
                value: overviewStats.activeRuns,
                hint: "Processing or waiting for approval",
                icon: <ArrowClockwise20Regular aria-hidden="true" />,
              },
              {
                label: "Open inputs",
                tone: "text-orange-600 dark:text-orange-400",
                value: overviewStats.openInputs,
                hint: "Not yet approved",
                icon: <DocumentBulletList20Regular aria-hidden="true" />,
              },
              {
                label: "Enabled profiles",
                tone: "text-emerald-600 dark:text-emerald-400",
                value: overviewStats.enabledProfiles,
                hint: "Employees included in payroll",
                icon: <PersonMoney20Regular aria-hidden="true" />,
              },
              {
                label: "Periods",
                tone: "text-violet-600 dark:text-violet-400",
                value: overviewStats.totalPeriods,
                hint: "Generated pay periods",
                icon: <CheckmarkCircle20Regular aria-hidden="true" />,
              },
            ].map((item) => (
              <FluentCard key={item.label} className="relative isolate overflow-hidden min-h-32 p-4 shadow-sm">
                <div aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${item.tone}`}>
                  <div className="absolute -right-12 -top-16 size-56 rounded-full border-[28px] border-current opacity-[0.06]" />
                  <div className="absolute right-6 top-8 size-28 rounded-full border border-current opacity-[0.12]" />
                  <div className="absolute -bottom-10 right-20 h-40 w-20 rotate-[25deg] bg-current opacity-[0.035]" />
                  <div className="absolute left-[55%] top-8 h-20 w-px rotate-[38deg] bg-current opacity-[0.12]" />
                  <div className="absolute left-[58%] top-10 size-1.5 rounded-full bg-current opacity-[0.15]" />
                  <div className="absolute left-[62%] top-16 size-1 rounded-full bg-current opacity-[0.12]" />
                </div>
                <FluentCardHeader
                  image={
                    <span className={`flex size-7 items-center justify-center ${item.tone}`}>
                      {item.icon}
                    </span>
                  }
                  header={
                    <Text
                      size={200}
                      weight="semibold"
                      className="uppercase tracking-wide text-muted-foreground"
                    >
                      {item.label}
                    </Text>
                  }
                />
                <Text
                  size={700}
                  weight="semibold"
                  className="mt-2 tabular-nums"
                >
                  {item.value}
                </Text>
                <Text size={200} className="text-muted-foreground">
                  {item.hint}
                </Text>
              </FluentCard>
            ))}
          </div>

          <FluentCard className="overflow-hidden p-0 shadow-sm">
            <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
              <BuildingBank20Regular
                className="mt-0.5 size-6 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <Text size={400} weight="semibold">
                  Payroll setup
                </Text>
                <Text
                  as="p"
                  size={200}
                  className="mt-1 !block text-muted-foreground"
                >
                  Review the building blocks used to calculate and post payroll.
                </Text>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  id: "components" as const,
                  label: "Components",
                  value: components.length,
                  detail: "Earnings and deductions",
                  icon: <DocumentBulletList20Regular aria-hidden="true" />,
                },
                {
                  id: "calendars" as const,
                  label: "Calendars",
                  value: calendars.length,
                  detail: "Payroll schedules",
                  icon: <CheckmarkCircle20Regular aria-hidden="true" />,
                },
                {
                  id: "structures" as const,
                  label: "Structures",
                  value: structures.length,
                  detail: "Salary arrangements",
                  icon: <PersonMoney20Regular aria-hidden="true" />,
                },
                {
                  id: "schemes" as const,
                  label: "Schemes",
                  value: schemes.length,
                  detail: "Statutory programmes",
                  icon: <BuildingBank20Regular aria-hidden="true" />,
                },
                {
                  id: "mappings" as const,
                  label: "Mappings",
                  value: mappings.length,
                  detail: "Accounting destinations",
                  icon: <ArrowSwap20Regular aria-hidden="true" />,
                },
              ].map((item) => (
                <FluentButton
                  key={item.id}
                  appearance="subtle"
                  onClick={() => {
                    setConfigTab(item.id);
                    setTab("configuration");
                  }}
                  className="!h-auto !min-h-24 !justify-start !rounded-xl !border !border-border/70 !bg-background !px-4 !py-3 !text-left hover:!border-primary/40 hover:!bg-primary/[0.035]"
                >
                  <span className="flex w-full items-center gap-3">
                    <span className="shrink-0 text-primary">{item.icon}</span>
                    <span className="min-w-0 flex-1 text-left">
                      <Text weight="semibold" className="!block">
                        {item.label}
                      </Text>
                      <Text
                        size={200}
                        className="!block truncate text-muted-foreground"
                      >
                        {item.detail}
                      </Text>
                    </span>
                    <FluentBadge appearance="tint" color="brand" size="large">
                      {item.value}
                    </FluentBadge>
                  </span>
                </FluentButton>
              ))}
            </div>
          </FluentCard>

          <FluentCard className="p-4 shadow-sm">
            <div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Recent runs
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Latest payroll cycles.
                  </p>
                </div>
                <FluentButton
                  appearance="secondary"
                  onClick={() => setTab("runs")}
                >
                  View all
                </FluentButton>
              </div>
              <div className="mt-4 space-y-2">
                {recentRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent runs returned yet.
                  </p>
                ) : (
                  recentRuns.map((row, index) => {
                    const status = readStatus(row);
                    return (
                      <FluentButton
                        key={`recent-run-${rowId(row) || index}`}
                        appearance="subtle"
                        className="!flex !h-auto !w-full !items-center !justify-between !gap-3 !rounded-lg !px-3 !py-2 !text-left"
                        onClick={() => {
                          setTab("runs");
                          void openDetail(row);
                        }}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate font-medium text-foreground">
                            {readString(
                              row,
                              ["run_no", "runNo", "name"],
                              `Run #${readNumber(row, ["id"]) ?? "—"}`,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {readPeriodLabel(row)} •{" "}
                            {prettify(
                              readString(
                                row,
                                ["run_type", "runType"],
                                "REGULAR",
                              ),
                            )}
                          </p>
                        </div>
                        <FluentBadge
                          appearance="outline"
                          className={statusTone(status)}
                        >
                          {prettify(status)}
                        </FluentBadge>
                      </FluentButton>
                    );
                  })
                )}
              </div>
            </div>
          </FluentCard>
        </div>
      ) : tab === "reports" ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/20">
            <p className="text-sm font-semibold text-foreground">
              How to use these tools
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Check setup before processing, compare two runs to see what
              changed, and calculate final pay for an offboarding request. These
              tools create checks and reports; start or process payroll from the
              Runs tab.
            </p>
            <nav
              aria-label="Payroll report tasks"
              className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
            >
              {[
                {
                  href: "#payroll-reconciliation",
                  icon: <CheckmarkCircle20Regular aria-hidden="true" />,
                  title: "1. Check setup",
                  detail: "Find blockers before a run",
                },
                {
                  href: "#payroll-run-comparison",
                  icon: <ArrowSwap20Regular aria-hidden="true" />,
                  title: "2. Compare runs",
                  detail: "See what changed",
                },
                {
                  href: "#payroll-final-settlement",
                  icon: <PersonMoney20Regular aria-hidden="true" />,
                  title: "3. Final pay",
                  detail: "Review an exit settlement",
                },
                {
                  href: "#payroll-bank-match",
                  icon: <BuildingBank20Regular aria-hidden="true" />,
                  title: "4. Match bank results",
                  detail: "Record payments already sent",
                },
              ].map((step) => (
                <a
                  key={step.href}
                  href={step.href}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left transition hover:bg-muted/40"
                >
                  <span className="text-primary">{step.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">
                      {step.title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {step.detail}
                    </span>
                  </span>
                </a>
              ))}
            </nav>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid gap-0 lg:grid-cols-3">
              <div
                id="payroll-reconciliation"
                className="scroll-mt-24 space-y-3 border-border p-4 lg:border-r"
              >
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <CheckmarkCircle20Regular
                      aria-hidden="true"
                      className="text-primary"
                    />
                    Reconciliation
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Find missing employee payroll profiles, salary mappings, or
                    setup items that could stop payroll from running. This check
                    does not create a payroll run.
                  </p>
                </div>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={reportBusy === "reconciliation"}
                  onClick={() => void onRunReconciliation()}
                >
                  {reportBusy === "reconciliation" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Run reconciliation
                </button>
              </div>
              <div
                id="payroll-run-comparison"
                className="scroll-mt-24 space-y-3 border-t border-border p-4 lg:border-l-0 lg:border-r lg:border-t-0"
              >
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <ArrowSwap20Regular
                      aria-hidden="true"
                      className="text-primary"
                    />
                    Run variance
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select two runs to see differences in payroll totals and
                    employee amounts. Choose the first run, then the run you
                    want to compare it with.
                  </p>
                </div>
                <FluentSelect
                  ariaLabel="Primary run"
                  className="w-full"
                  value={varianceRunId}
                  placeholder="First payroll run"
                  onChange={setVarianceRunId}
                  options={[
                    { value: "", label: "First payroll run" },
                    ...recentRuns.map((row) => ({
                      value: rowId(row),
                      label:
                        readPeriodLabel(row) !== "-"
                          ? readPeriodLabel(row)
                          : `Run #${rowId(row)}`,
                    })),
                  ]}
                />
                <FluentSelect
                  ariaLabel="Comparison run"
                  className="w-full"
                  value={comparisonRunId}
                  placeholder="Compare with"
                  onChange={setComparisonRunId}
                  options={[
                    { value: "", label: "Compare with" },
                    ...recentRuns.map((row) => ({
                      value: rowId(row),
                      label:
                        readPeriodLabel(row) !== "-"
                          ? readPeriodLabel(row)
                          : `Run #${rowId(row)}`,
                    })),
                  ]}
                />
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={
                    reportBusy === "variance" ||
                    !varianceRunId ||
                    !comparisonRunId
                  }
                  onClick={() => void onRunVariance()}
                >
                  {reportBusy === "variance" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Compare runs
                </button>
              </div>
              <div
                id="payroll-final-settlement"
                className="scroll-mt-24 space-y-3 border-t border-border p-4 lg:border-t-0"
              >
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <PersonMoney20Regular
                      aria-hidden="true"
                      className="text-primary"
                    />
                    Final settlement
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Calculate final pay for an employee leaving the company.
                    Select the offboarding request to review its settlement
                    details.
                  </p>
                </div>
                <FluentSelect
                  ariaLabel="Offboarding request"
                  className="w-full"
                  value={settlementRequestId}
                  placeholder="Select offboarding request"
                  onChange={setSettlementRequestId}
                  options={[
                    { value: "", label: "Offboarding request" },
                    ...offboardingRequests.map((row) => ({
                      value: rowId(row),
                      label: `#${rowId(row)} ${readString(
                        row,
                        ["employeeName", "employee_name", "status"],
                        "",
                      )}`,
                    })),
                  ]}
                />
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={reportBusy === "settlement" || !settlementRequestId}
                  onClick={() => void onCalculateSettlement()}
                >
                  {reportBusy === "settlement" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Calculate final pay
                </button>
                {reportKind === "settlement" &&
                readString(reportResult, ["id"], "") ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span>
                        Settlement #{readString(reportResult, ["id"], "-")}
                      </span>
                      <Badge variant="outline">
                        {prettify(
                          readString(reportResult, ["status"], "unknown"),
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Gross{" "}
                      {readString(
                        reportResult,
                        ["grossSettlement", "gross_settlement"],
                        "0.00",
                      )}{" "}
                      · Deductions{" "}
                      {readString(
                        reportResult,
                        ["deductionTotal", "deduction_total"],
                        "0.00",
                      )}{" "}
                      · Net{" "}
                      {readString(
                        reportResult,
                        ["netSettlement", "net_settlement"],
                        "0.00",
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {readString(reportResult, ["status"], "") ===
                        "CALCULATED" ||
                      readString(reportResult, ["status"], "") ===
                        "REJECTED" ? (
                        <button
                          type="button"
                          className={actionButtonClass}
                          disabled={reportBusy === "settlement-action"}
                          onClick={() => void onFinalSettlementAction("submit")}
                        >
                          Submit for approval
                        </button>
                      ) : null}
                      {readString(reportResult, ["status"], "") ===
                      "SUBMITTED" ? (
                        <>
                          <button
                            type="button"
                            className={actionButtonClass}
                            disabled={reportBusy === "settlement-action"}
                            onClick={() =>
                              void onFinalSettlementAction("decision", {
                                decision: "APPROVE",
                                comments: "Demo Finance approval",
                              })
                            }
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={actionButtonClass}
                            disabled={reportBusy === "settlement-action"}
                            onClick={() =>
                              void onFinalSettlementAction("decision", {
                                decision: "REJECT",
                                comments: "Returned for demo correction",
                              })
                            }
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {readString(reportResult, ["status"], "") ===
                        "APPROVED" ||
                      readString(reportResult, ["status"], "").startsWith(
                        "PAYMENT_",
                      ) ? (
                        <button
                          type="button"
                          className={actionButtonClass}
                          disabled={reportBusy === "settlement-action"}
                          onClick={() =>
                            void onFinalSettlementAction("simulate-payment", {
                              outcome: "SUCCESS",
                              attempt:
                                readString(reportResult, ["status"], "") ===
                                "APPROVED"
                                  ? 1
                                  : 2,
                            })
                          }
                        >
                          {readString(reportResult, ["status"], "") ===
                          "APPROVED"
                            ? "Simulate payment"
                            : "Retry simulated payment"}
                        </button>
                      ) : null}
                      {readString(reportResult, ["status"], "") === "PAID" ? (
                        <button
                          type="button"
                          className={actionButtonClass}
                          disabled={reportBusy === "settlement-action"}
                          onClick={() =>
                            void onFinalSettlementAction("reconcile")
                          }
                        >
                          Reconcile payment
                        </button>
                      ) : null}
                      {readString(reportResult, ["status"], "") ===
                      "RECONCILED" ? (
                        <button
                          type="button"
                          className={actionButtonClass}
                          disabled={reportBusy === "settlement-action"}
                          onClick={() => void onFinalSettlementAction("close")}
                        >
                          Close settlement
                        </button>
                      ) : null}
                      {["APPROVED", "PAID", "RECONCILED", "CLOSED"].includes(
                        readString(reportResult, ["status"], ""),
                      ) ? (
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={() => void onDownloadSettlementStatement()}
                        >
                          Download statement
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Payments are simulated only when backend
                      PAYROLL_DEMO_MODE=true. Finance approval requires a
                      different user from the preparer.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div
            id="payroll-readiness"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card p-4"
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CheckmarkCircle20Regular
                    aria-hidden="true"
                    className="text-primary"
                  />
                  Deployment readiness
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Check whether payroll is ready to run, and review connected
                  services and payroll notifications. Use this when setting up
                  or troubleshooting payroll.
                </p>
                {reportKind === "readiness" && reportResult ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {asRecordArray(reportResult.checks)
                      .slice(0, 9)
                      .map((check, index) => (
                        <div
                          key={`payroll-readiness-${readString(check, ["code"], String(index))}`}
                          className="rounded-lg border border-border bg-muted/20 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">
                              {prettify(readString(check, ["code"], "check"))}
                            </span>
                            <Badge
                              variant="outline"
                              className={statusTone(
                                readString(check, ["status"], ""),
                              )}
                            >
                              {prettify(
                                readString(check, ["status"], "unknown"),
                              )}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            {readString(check, ["detail"], "No detail")}
                          </p>
                        </div>
                      ))}
                  </div>
                ) : reportKind === "integrations" && reportResult ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {asRecordArray(reportResult.providers).map(
                      (provider, index) => (
                        <div
                          key={`payroll-provider-${readString(provider, ["code"], String(index))}`}
                          className="rounded-lg border border-border bg-muted/20 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">
                              {readString(provider, ["label"], "Provider")}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                readBoolean(provider, ["configured"])
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : "border-amber-300 bg-amber-50 text-amber-700"
                              }
                            >
                              {readBoolean(provider, ["configured"])
                                ? "Configured"
                                : "Optional"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatAdminValue(provider.modes) ||
                              readString(provider, ["code"], "")}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : reportKind === "notifications" && reportResult ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {asRecordArray(reportResult.notifications).length} payroll
                    notification events returned.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={reportBusy === "readiness"}
                  onClick={() => void onLoadReadiness()}
                >
                  {reportBusy === "readiness" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Check readiness
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={reportBusy === "integrations"}
                  onClick={() => void onLoadIntegrations()}
                >
                  {reportBusy === "integrations" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  View integrations
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={reportBusy === "notifications"}
                  onClick={() => void onLoadNotificationCatalog()}
                >
                  {reportBusy === "notifications" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  View notification events
                </button>
              </div>
            </div>
          </div>
          <div
            id="payroll-report-catalog"
            className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card p-4"
          >
            <div className="mb-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <DocumentSearch20Regular
                  aria-hidden="true"
                  className="text-primary"
                />
                Generate a payroll report
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a report and optionally narrow it to a payroll run or
                year. Use the catalog to see available reports.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.75fr_1fr_auto_auto_auto] lg:items-end">
              <Field label="Report type">
                <FluentSelect
                  ariaLabel="Report type"
                  className="w-full"
                  value={advancedForm.reportCode}
                  placeholder="Choose a report"
                  onChange={(value) =>
                    setAdvancedForm((current) => ({
                      ...current,
                      reportCode: value,
                    }))
                  }
                  options={[
                    { value: "", label: "Choose a report" },
                    ...(reportCatalog.length > 0
                      ? reportCatalog
                      : PAYROLL_REPORT_CODES.map((code) => ({ code }))
                    ).flatMap((row) => {
                      const code = readString(row, ["code"], "");
                      if (!code) return [];
                      return [
                        {
                          value: code,
                          label: readString(row, ["name"], prettify(code)),
                        },
                      ];
                    }),
                  ]}
                />
              </Field>
              <Field label="Payroll run (optional)">
                <FluentSelect
                  ariaLabel="Payroll run (optional)"
                  className="w-full"
                  value={advancedForm.reportRunId}
                  placeholder="Any recent run"
                  onChange={(value) =>
                    setAdvancedForm((current) => ({
                      ...current,
                      reportRunId: value,
                    }))
                  }
                  options={[
                    { value: "", label: "Any recent run" },
                    ...recentRuns.map((row) => ({
                      value: rowId(row),
                      label:
                        readPeriodLabel(row) !== "-"
                          ? readPeriodLabel(row)
                          : `Run #${rowId(row)}`,
                    })),
                  ]}
                />
              </Field>
              <Field label="Year (optional)">
                <input
                  className={inputClass}
                  value={advancedForm.reportYear}
                  onChange={(event) =>
                    setAdvancedForm((current) => ({
                      ...current,
                      reportYear: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Filter results (optional)">
                <input
                  className={inputClass}
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                  maxLength={100}
                  placeholder="Employee, component, or dimension"
                />
              </Field>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={reportBusy === "catalog"}
                onClick={() => void onRunCatalog()}
              >
                {reportBusy === "catalog" ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                View report catalog
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={
                  reportBusy === "catalog-report" || !advancedForm.reportCode
                }
                onClick={() => void onRunCatalogReport(undefined, 1)}
              >
                {reportBusy === "catalog-report" ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Generate report
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={
                  reportBusy === "catalog-report" || !advancedForm.reportRunId
                }
                onClick={() =>
                  void onRunCatalogReport("payroll-run-reconciliation")
                }
              >
                {reportBusy === "catalog-report" &&
                advancedForm.reportCode === "payroll-run-reconciliation" ? (
                  <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Reconcile selected run
              </button>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div
              id="payroll-bank-match"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <BuildingBank20Regular
                    aria-hidden="true"
                    className="text-primary"
                  />
                  Match bank payments to a payroll run
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record the results of a payment batch your bank has already
                  processed. Choose a run, enter payments below or upload a CSV,
                  then match the rows to employees. This does not send money.
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Step 1 · Payroll run to match">
                    <FluentSelect
                      ariaLabel="Payroll run to match"
                      className="w-full"
                      value={advancedForm.bankImportRunId}
                      placeholder="Choose a payroll run"
                      onChange={(value) =>
                        setAdvancedForm((current) => ({
                          ...current,
                          bankImportRunId: value,
                        }))
                      }
                      options={[
                        { value: "", label: "Choose a payroll run" },
                        ...recentRuns.map((row) => ({
                          value: rowId(row),
                          label:
                            readPeriodLabel(row) !== "-"
                              ? readPeriodLabel(row)
                              : `Run #${rowId(row)}`,
                        })),
                      ]}
                    />
                  </Field>
                  <p className="self-end pb-2 text-xs text-muted-foreground">
                    Choose the payroll run whose bank payments you are checking.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/15 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Step 2 · Add payment details
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enter payments one by one, or upload a CSV statement
                        from your bank.
                      </p>
                    </div>
                    <div
                      role="group"
                      aria-label="Payment entry method"
                      className="inline-flex rounded-md border border-border bg-background p-1"
                    >
                      <button
                        type="button"
                        aria-pressed={bankInputMode === "manual"}
                        className={cn(
                          "rounded px-3 py-1.5 text-xs font-medium",
                          bankInputMode === "manual"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                        onClick={() => setBankInputMode("manual")}
                      >
                        Enter payments
                      </button>
                      <button
                        type="button"
                        aria-pressed={bankInputMode === "csv"}
                        className={cn(
                          "rounded px-3 py-1.5 text-xs font-medium",
                          bankInputMode === "csv"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                        onClick={() => setBankInputMode("csv")}
                      >
                        Upload CSV
                      </button>
                    </div>
                  </div>
                  {bankInputMode === "manual" ? (
                    <div className="mt-3 space-y-2">
                      {bankPaymentRows.map((row, index) => (
                        <div
                          key={row.id}
                          className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_0.8fr_0.8fr_auto] xl:items-end"
                        >
                          <Field label={`Employee number · row ${index + 1}`}>
                            <input
                              className={inputClass}
                              value={row.employeeNo}
                              placeholder="e.g. EMP-0101"
                              onChange={(event) =>
                                setBankPaymentRows((rows) =>
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? {
                                          ...entry,
                                          employeeNo: event.target.value,
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Masked bank account">
                            <input
                              className={inputClass}
                              value={row.accountMasked}
                              placeholder="Optional · ****1234"
                              onChange={(event) =>
                                setBankPaymentRows((rows) =>
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? {
                                          ...entry,
                                          accountMasked: event.target.value,
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Bank reference">
                            <input
                              className={inputClass}
                              value={row.reference}
                              placeholder="Optional · e.g. PAY-1001"
                              onChange={(event) =>
                                setBankPaymentRows((rows) =>
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? {
                                          ...entry,
                                          reference: event.target.value,
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Amount paid">
                            <input
                              className={inputClass}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.amount}
                              placeholder="0.00"
                              onChange={(event) =>
                                setBankPaymentRows((rows) =>
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? { ...entry, amount: event.target.value }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          </Field>
                          <Field label="Bank result">
                            <FluentSelect
                              ariaLabel={`Bank result for row ${index + 1}`}
                              className="w-full"
                              value={row.status}
                              onChange={(value) =>
                                setBankPaymentRows((rows) =>
                                  rows.map((entry) =>
                                    entry.id === row.id
                                      ? { ...entry, status: value }
                                      : entry,
                                  ),
                                )
                              }
                              options={[
                                { value: "PAID", label: "Paid" },
                                { value: "FAILED", label: "Failed" },
                                { value: "PENDING", label: "Pending" },
                              ]}
                            />
                          </Field>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
                            aria-label={`Remove payment row ${index + 1}`}
                            disabled={bankPaymentRows.length === 1}
                            onClick={() =>
                              setBankPaymentRows((rows) =>
                                rows.filter((entry) => entry.id !== row.id),
                              )
                            }
                          >
                            <Delete20Regular aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        onClick={() =>
                          setBankPaymentRows((rows) => [
                            ...rows,
                            {
                              id: Date.now(),
                              employeeNo: "",
                              accountMasked: "",
                              reference: "",
                              amount: "",
                              status: "PAID",
                            },
                          ])
                        }
                      >
                        <Add20Regular aria-hidden="true" />
                        Add another payment
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border border-dashed border-border bg-background p-4">
                      <input
                        ref={bankFileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        aria-label="Choose bank statement CSV"
                        onChange={(event) => {
                          void onBankStatementFileSelected(
                            event.target.files?.[0] ?? null,
                          );
                          event.currentTarget.value = "";
                        }}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={() => bankFileInputRef.current?.click()}
                        >
                          <CloudArrowUp20Regular aria-hidden="true" />
                          Choose CSV file
                        </button>
                        <button
                          type="button"
                          className={secondaryButtonClass}
                          onClick={downloadBankStatementTemplate}
                        >
                          <DocumentBulletList20Regular aria-hidden="true" />
                          Download CSV template
                        </button>
                        {bankCsvName ? (
                          <span className="text-xs text-muted-foreground">
                            {bankCsvName} ·{" "}
                            {Math.max(
                              0,
                              bankCsvText.trim().split(/\r?\n/).filter(Boolean)
                                .length - 1,
                            )}{" "}
                            payment rows
                          </span>
                        ) : null}
                        {bankCsvName ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => {
                              setBankCsvText("");
                              setBankCsvName("");
                              setBankCsvError("");
                            }}
                          >
                            Remove file
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground">
                        CSV must include an <strong>amount</strong> column and
                        at least one matching field:{" "}
                        <strong>employee_no</strong>,{" "}
                        <strong>employee_id</strong>,{" "}
                        <strong>account_number_masked</strong>, or{" "}
                        <strong>reference</strong>. Maximum file size: 5 MB.
                      </p>
                      {bankCsvError ? (
                        <p
                          role="alert"
                          className="mt-2 text-xs font-medium text-destructive"
                        >
                          {bankCsvError}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
                <details className="rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-foreground">
                    Optional batch details
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Field label="Bank batch ID">
                      <input
                        className={inputClass}
                        value={advancedForm.bankBatchId}
                        onChange={(event) =>
                          setAdvancedForm((current) => ({
                            ...current,
                            bankBatchId: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field label="Payment reference">
                      <input
                        className={inputClass}
                        value={advancedForm.paymentReference}
                        onChange={(event) =>
                          setAdvancedForm((current) => ({
                            ...current,
                            paymentReference: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </Field>
                    <Field label="Payment date">
                      <DateInput
                        className={inputClass}
                        value={advancedForm.paymentDate}
                        onChange={(event) =>
                          setAdvancedForm((current) => ({
                            ...current,
                            paymentDate: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </details>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={
                    reportBusy === "bank-import" ||
                    !advancedForm.bankImportRunId ||
                    (bankInputMode === "csv" && !bankCsvText.trim())
                  }
                  onClick={() => void onImportBankStatement()}
                >
                  {reportBusy === "bank-import" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Import payments
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={reportBusy === "payment-history"}
                  onClick={() => void onLoadPaymentHistory()}
                >
                  {reportBusy === "payment-history" ? (
                    <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  View payment history
                </button>
              </div>
            </div>
            <div
              id="payroll-journal"
              className="scroll-mt-24 rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <DocumentBulletList20Regular
                    aria-hidden="true"
                    className="text-primary"
                  />
                  Accounting journal
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Export a journal batch, mark it as posted to your accounting
                  system, or reverse a posted batch when correcting an entry.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Journal batch ID">
                  <input
                    className={inputClass}
                    value={advancedForm.journalBatchId}
                    onChange={(event) =>
                      setAdvancedForm((current) => ({
                        ...current,
                        journalBatchId: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Ledger run ID (optional)">
                  <input
                    className={inputClass}
                    value={advancedForm.journalRunId}
                    onChange={(event) =>
                      setAdvancedForm((current) => ({
                        ...current,
                        journalRunId: event.target.value,
                      }))
                    }
                    placeholder="All posted payroll journals"
                  />
                </Field>
                <Field label="Optional ERP provider">
                  <input
                    className={inputClass}
                    value={advancedForm.providerKey}
                    onChange={(event) =>
                      setAdvancedForm((current) => ({
                        ...current,
                        providerKey: event.target.value,
                      }))
                    }
                    placeholder="Leave blank to post internally"
                  />
                </Field>
                <Field label="External reference">
                  <input
                    className={inputClass}
                    value={advancedForm.externalReference}
                    onChange={(event) =>
                      setAdvancedForm((current) => ({
                        ...current,
                        externalReference: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Export format">
                  <FluentSelect
                    ariaLabel="Export format"
                    className="w-full"
                    value={advancedForm.exportFormat}
                    onChange={(value) =>
                      setAdvancedForm((current) => ({
                        ...current,
                        exportFormat: value,
                      }))
                    }
                    options={[
                      { value: "csv", label: "CSV" },
                      { value: "json", label: "JSON" },
                    ]}
                  />
                </Field>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={reportBusy === "internal-ledger"}
                    onClick={() => void onLoadInternalLedger()}
                  >
                    {reportBusy === "internal-ledger" ? (
                      <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Internal ledger
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={reportBusy === "journal-export"}
                    onClick={() => void onExportJournal()}
                  >
                    {reportBusy === "journal-export" ? (
                      <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Download journal
                  </button>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    disabled={reportBusy === "journal-post"}
                    onClick={() => void onPostJournal()}
                  >
                    {reportBusy === "journal-post" ? (
                      <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Mark as posted
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    disabled={reportBusy === "journal-reverse"}
                    onClick={() => void onReverseJournal()}
                  >
                    {reportBusy === "journal-reverse" ? (
                      <FluentLoadingIndicator className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Reverse journal
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold">
                  Statutory and cost reports
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Payroll register, tax, pension, WCF, cost, and headcount
                  views.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PAYROLL_REPORT_SHORTCUTS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={secondaryButtonClass}
                    disabled={reportBusy === "catalog-report"}
                    onClick={() => void onRunCatalogReport(item.code)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3">
                <h2 className="text-sm font-semibold">Employee drilldowns</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Focused views for loans, advances, shortfalls, YTD, and
                  payroll history.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PAYROLL_DRILLDOWN_SHORTCUTS.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={secondaryButtonClass}
                    disabled={reportBusy === "catalog-report"}
                    onClick={() => void onRunCatalogReport(item.code)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {reportResult ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">
                {reportKind === "variance"
                  ? "Variance summary"
                  : reportKind === "settlement"
                    ? "Settlement summary"
                    : reportKind === "validation"
                      ? "Validation summary"
                      : reportKind === "catalog"
                        ? "Report catalog"
                        : reportKind === "report"
                          ? "Report result"
                          : "Reconciliation summary"}
              </h2>
              {(() => {
                const summary = groupReportIssues(reportResult);
                const net = readNumber(reportResult, [
                  "net",
                  "net_amount",
                  "netAmount",
                  "net_pay",
                  "netPay",
                ]);
                const gross = readNumber(reportResult, [
                  "gross",
                  "gross_amount",
                  "grossAmount",
                ]);
                const status = readString(reportResult, ["status"], "");
                const reportRows =
                  asRecordArray(reportResult.rows) ||
                  asRecordArray(reportResult.data) ||
                  asRecordArray(reportResult.reports);
                const resultSummary = asRecord(reportResult.summary);
                const layout = readString(reportResult, ["layout"], "");
                const summaryEntries = resultSummary
                  ? Object.entries(resultSummary).filter(
                      ([, value]) =>
                        value !== null && value !== undefined && value !== "",
                    )
                  : [];
                return (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Issues
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                          {summary.issueCount}
                        </p>
                      </div>
                      {layout ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Layout
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {prettify(layout)}
                          </p>
                        </div>
                      ) : null}
                      {gross !== null ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Gross
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums">
                            {formatCurrencyAmount(gross)}
                          </p>
                        </div>
                      ) : null}
                      {net !== null ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Net
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums">
                            {formatCurrencyAmount(net)}
                          </p>
                        </div>
                      ) : null}
                      {status ? (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Status
                          </p>
                          <p className="mt-1 text-sm font-medium">
                            {prettify(status)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    {summaryEntries.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {summaryEntries.slice(0, 8).map(([key, value]) => {
                          const numeric =
                            typeof value === "number"
                              ? value
                              : typeof value === "string"
                                ? Number(value)
                                : Number.NaN;
                          const width = Number.isFinite(numeric)
                            ? Math.max(
                                8,
                                Math.min(100, numeric > 100 ? 100 : numeric),
                              )
                            : 20;
                          return (
                            <div
                              key={key}
                              className="rounded-lg border border-border bg-muted/30 p-3"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {prettify(key)}
                              </p>
                              <p className="mt-1 truncate text-lg font-semibold tabular-nums">
                                {formatAdminValue(value)}
                              </p>
                              <div className="mt-2 h-1.5 rounded-full bg-background">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${width}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    {readString(reportResult, ["code"]) ===
                    "payroll-run-reconciliation" ? (
                      <div className="grid gap-3 xl:grid-cols-2">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              Deduction preview
                            </h3>
                            <Badge variant="outline">
                              {asRecordArray(reportResult.rows).length}
                            </Badge>
                          </div>
                          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-background">
                            <StandardTable className="w-full text-left text-xs">
                              <StandardTableHeader className="sticky top-0 bg-muted text-muted-foreground">
                                <StandardTableRow>
                                  <StandardTableHead className="px-3 py-2">Employee</StandardTableHead>
                                  <StandardTableHead className="px-3 py-2">Component</StandardTableHead>
                                  <StandardTableHead className="px-3 py-2">Requested</StandardTableHead>
                                  <StandardTableHead className="px-3 py-2">Reserved</StandardTableHead>
                                  <StandardTableHead className="px-3 py-2">Status</StandardTableHead>
                                </StandardTableRow>
                              </StandardTableHeader>
                              <StandardTableBody className="divide-y divide-border">
                                {asRecordArray(reportResult.rows).map(
                                  (row, index) => (
                                    <StandardTableRow key={`deduction-preview-${index}`}>
                                      <StandardTableCell className="px-3 py-2">
                                        {readNumber(row, [
                                          "employee_id",
                                          "employeeId",
                                        ]) ?? "-"}
                                      </StandardTableCell>
                                      <StandardTableCell className="px-3 py-2">
                                        {readString(row, [
                                          "component_code",
                                          "componentCode",
                                        ])}
                                      </StandardTableCell>
                                      <StandardTableCell className="px-3 py-2">
                                        {readString(row, [
                                          "requested_amount",
                                          "requestedAmount",
                                        ])}
                                      </StandardTableCell>
                                      <StandardTableCell className="px-3 py-2">
                                        {readString(row, [
                                          "reserved_amount",
                                          "reservedAmount",
                                        ])}
                                      </StandardTableCell>
                                      <StandardTableCell className="px-3 py-2">
                                        <Badge
                                          variant="outline"
                                          className={statusTone(
                                            readString(row, ["status"], ""),
                                          )}
                                        >
                                          {prettify(
                                            readString(row, ["status"], "-"),
                                          )}
                                        </Badge>
                                      </StandardTableCell>
                                    </StandardTableRow>
                                  ),
                                )}
                              </StandardTableBody>
                            </StandardTable>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              Shortfall drilldown
                            </h3>
                            <Badge variant="outline">
                              {asRecordArray(reportResult.shortfalls).length}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-2">
                            {asRecordArray(reportResult.shortfalls).length ===
                            0 ? (
                              <p className="text-sm text-muted-foreground">
                                No payroll deduction shortfalls returned.
                              </p>
                            ) : (
                              asRecordArray(reportResult.shortfalls)
                                .slice(0, 8)
                                .map((row, index) => (
                                  <div
                                    key={`payroll-shortfall-${index}`}
                                    className="rounded-md border border-border bg-background px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-medium">
                                        Employee{" "}
                                        {readNumber(row, [
                                          "employee_id",
                                          "employeeId",
                                        ]) ?? "-"}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={statusTone(
                                          readString(row, ["status"], ""),
                                        )}
                                      >
                                        {prettify(
                                          readString(row, ["status"], "OPEN"),
                                        )}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {readString(row, [
                                        "component_code",
                                        "componentCode",
                                      ])}{" "}
                                      deferred{" "}
                                      {readString(row, [
                                        "deferred_amount",
                                        "deferredAmount",
                                      ])}{" "}
                                      from{" "}
                                      {readString(row, [
                                        "requested_amount",
                                        "requestedAmount",
                                      ])}
                                    </p>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <h3 className="text-sm font-semibold">
                            Approval checklist
                          </h3>
                          <div className="mt-3 space-y-2">
                            {asRecordArray(reportResult.approvals).length ===
                            0 ? (
                              <p className="text-sm text-muted-foreground">
                                No approval records returned.
                              </p>
                            ) : (
                              asRecordArray(reportResult.approvals).map(
                                (row, index) => (
                                  <div
                                    key={`payroll-approval-${index}`}
                                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                                  >
                                    <span>
                                      {prettify(
                                        readString(row, ["stage"], "stage"),
                                      )}
                                    </span>
                                    <Badge variant="outline">
                                      {prettify(
                                        readString(row, ["decision", "status"]),
                                      )}
                                    </Badge>
                                  </div>
                                ),
                              )
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <h3 className="text-sm font-semibold">
                            Reconciliation outputs
                          </h3>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {[
                              ["Bank batch", reportResult.bank_batch],
                              ["Journal batch", reportResult.journal_batch],
                            ].map(([label, value]) => {
                              const record = asRecord(value);
                              return (
                                <div
                                  key={String(label)}
                                  className="rounded-md border border-border bg-background px-3 py-2"
                                >
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {String(label)}
                                  </p>
                                  <p className="mt-1 text-sm font-medium">
                                    {record
                                      ? `#${rowId(record)} ${prettify(readString(record, ["status"], "generated"))}`
                                      : "Not generated"}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {
                              asRecordArray(
                                reportResult.payment_reconciliations,
                              ).length
                            }{" "}
                            payment reconciliation records returned.
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {summary.groups.length > 0 ? (
                      <div className="space-y-2">
                        {summary.groups.map((group) => (
                          <button
                            key={group.code}
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                              issueGroupTone(group.code),
                            )}
                            onClick={() => {
                              setIssueDialogCode(group.code);
                              setIssueSearch("");
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "size-2 shrink-0 rounded-full",
                                  issueGroupDot(group.code),
                                )}
                              />
                              <span className="truncate font-medium">
                                {prettify(group.code)}
                              </span>
                            </span>
                            <span className="font-semibold tabular-nums">
                              {group.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : summary.issueCount === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No issues returned.
                      </p>
                    ) : null}
                    {reportRows && reportRows.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          {(() => {
                            const pagination = asRecord(
                              reportResult.pagination,
                            );
                            if (!pagination) return <span />;
                            const currentPage =
                              readNumber(pagination, ["page"]) ?? 1;
                            const totalPages =
                              readNumber(pagination, ["total_pages"]) ?? 1;
                            const totalRows =
                              readNumber(pagination, ["total_rows"]) ??
                              reportRows.length;
                            return (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  {totalRows} filtered rows · page {currentPage}{" "}
                                  of {Math.max(totalPages, 1)}
                                </span>
                                <button
                                  type="button"
                                  className={secondaryButtonClass}
                                  disabled={
                                    currentPage <= 1 ||
                                    reportBusy === "catalog-report"
                                  }
                                  onClick={() =>
                                    void onRunCatalogReport(
                                      undefined,
                                      currentPage - 1,
                                    )
                                  }
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  className={secondaryButtonClass}
                                  disabled={
                                    currentPage >= totalPages ||
                                    reportBusy === "catalog-report"
                                  }
                                  onClick={() =>
                                    void onRunCatalogReport(
                                      undefined,
                                      currentPage + 1,
                                    )
                                  }
                                >
                                  Next
                                </button>
                              </div>
                            );
                          })()}
                          <button
                            type="button"
                            className={secondaryButtonClass}
                            disabled={reportBusy === "report-export"}
                            onClick={() => void onExportReportCsv(reportRows)}
                          >
                            Export CSV
                          </button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <StandardTable className="min-w-full divide-y divide-border text-xs">
                            <StandardTableHeader className="bg-muted/40 text-muted-foreground">
                              <StandardTableRow>
                                {Object.keys(reportRows[0])
                                  .slice(0, 8)
                                  .map((key) => (
                                    <StandardTableHead
                                      key={key}
                                      className="px-3 py-2 text-left font-semibold"
                                    >
                                      {prettify(key)}
                                    </StandardTableHead>
                                  ))}
                                {reportKind === "variance" ? (
                                  <StandardTableHead className="px-3 py-2 text-left font-semibold">
                                    Review explanation
                                  </StandardTableHead>
                                ) : null}
                              </StandardTableRow>
                            </StandardTableHeader>
                            <StandardTableBody className="divide-y divide-border">
                              {reportRows.slice(0, 50).map((row, index) => (
                                <StandardTableRow key={`report-row-${index}`}>
                                  {Object.keys(reportRows[0])
                                    .slice(0, 8)
                                    .map((key) => (
                                      <StandardTableCell
                                        key={`${key}-${index}`}
                                        className="px-3 py-2 text-muted-foreground"
                                      >
                                        {formatAdminValue(row[key])}
                                      </StandardTableCell>
                                    ))}
                                  {reportKind === "variance" ? (
                                    <StandardTableCell className="min-w-64 px-3 py-2">
                                      <div className="flex min-w-64 items-center gap-2">
                                        <Textarea
                                          value={
                                            varianceExplanations[
                                              String(
                                                readNumber(row, [
                                                  "employee_id",
                                                  "employeeId",
                                                ]) ?? "",
                                              )
                                            ] ??
                                            readString(row, ["explanation"], "")
                                          }
                                          onChange={(event) =>
                                            setVarianceExplanations(
                                              (current) => ({
                                                ...current,
                                                [String(
                                                  readNumber(row, [
                                                    "employee_id",
                                                    "employeeId",
                                                  ]) ?? "",
                                                )]: event.target.value,
                                              }),
                                            )
                                          }
                                          placeholder="Explain this change"
                                          rows={2}
                                          maxLength={2000}
                                          disabled={
                                            readString(row, [
                                              "explanation_status",
                                            ]) === "REVIEWED" ||
                                            reportBusy ===
                                              `variance-review-${readNumber(row, ["employee_id", "employeeId"])}`
                                          }
                                        />
                                        <button
                                          type="button"
                                          className={secondaryButtonClass}
                                          onClick={() =>
                                            void onReviewVarianceRow(row)
                                          }
                                          disabled={
                                            readString(row, [
                                              "explanation_status",
                                            ]) === "REVIEWED" ||
                                            reportBusy ===
                                              `variance-review-${readNumber(row, ["employee_id", "employeeId"])}`
                                          }
                                        >
                                          {readString(row, [
                                            "explanation_status",
                                          ]) === "REVIEWED"
                                            ? "Reviewed"
                                            : "Save review"}
                                        </button>
                                      </div>
                                    </StandardTableCell>
                                  ) : null}
                                </StandardTableRow>
                              ))}
                            </StandardTableBody>
                          </StandardTable>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      ) : tab === "recoveries" ? (
        <PayrollRecoveriesPanel
          canManage={canManageRecoveries}
          canApprove={canApproveRecoveries}
          canAccounting={canPostAccounting}
        />
      ) : tab === "configuration" && configTab === "approvalWorkflows" ? (
        <PayrollApprovalWorkflowsPanel canManage={canMutatePayroll} />
      ) : tab === "configuration" && configTab === "attendanceDeductions" ? (
        <PayrollAttendanceDeductionPoliciesPanel
          canManage={canMutatePayroll}
          canActivate={canApproveStatutoryRule}
        />
      ) : tab === "configuration" && configTab === "security" ? (
        <section className="space-y-5 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">
              Payroll generation security
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enable at least one method. Operators can generate payroll with a
              2FA verified login or a fresh authenticator code, based on the
              methods you allow.
            </p>
          </div>
          {securityPolicyLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading payroll security policy…
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-4">
                <input
                  type="checkbox"
                  checked={readBoolean(securityPolicy, [
                    "allow_verified_login",
                  ])}
                  disabled={!canMutatePayroll || securityPolicySaving}
                  onChange={(event) =>
                    setSecurityPolicy((current) => ({
                      ...current,
                      allow_verified_login: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    Verified 2FA login
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Allow generation from a session that completed authenticator
                    verification during sign-in.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-4">
                <input
                  type="checkbox"
                  checked={readBoolean(securityPolicy, [
                    "allow_fresh_authenticator",
                  ])}
                  disabled={!canMutatePayroll || securityPolicySaving}
                  onChange={(event) =>
                    setSecurityPolicy((current) => ({
                      ...current,
                      allow_fresh_authenticator: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    Fresh authenticator code
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Require a new six-digit code when payroll is generated.
                    Codes are single-use for payroll generation.
                  </span>
                </span>
              </label>
            </div>
          )}
          <Field label="Reason for policy change">
            <Textarea
              className={textareaClass}
              value={securityPolicyReason}
              disabled={!canMutatePayroll || securityPolicySaving}
              onChange={(event) => setSecurityPolicyReason(event.target.value)}
            />
          </Field>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">
              Mandatory payroll approvals
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              All three stages are required in order. The run creator cannot
              approve; each stage must be approved by a different user, using
              the same calculation hash.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {["HR", "Finance", "Management"].map((stage) => (
                <Badge key={stage} variant="outline">
                  {stage} required
                </Badge>
              ))}
            </div>
          </div>
          {canMutatePayroll ? (
            <div className="flex justify-end">
              <button
                type="button"
                className={primaryButtonClass}
                disabled={securityPolicySaving || securityPolicyLoading}
                onClick={() => void onSaveSecurityPolicy()}
              >
                {securityPolicySaving ? "Saving…" : "Save security policy"}
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="space-y-4">
          <ResizableTable
            title={sectionTitle}
            data={rows}
            columns={columns}
            loading={loading}
            itemsPerPage={20}
            showExport={false}
            fluent
            sortIconOnly
            toolbarClassName="!rounded-t-xl !border-border/70 !bg-card !px-4 !py-3"
            frameClassName="!rounded-b-xl !border-border/70 !shadow-sm"
            storageKey={`operations-payroll-${tab}-${configTab}`}
            toolbarStart={
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  {sectionTitle}
                </h2>
              </div>
            }
            toolbarActions={
              <>
                <SearchToggleField
                  className="min-w-0"
                  placeholder="Search payroll"
                  value={search}
                  onChange={setSearch}
                />
                {["runs", "inputs", "sources"].includes(tab) ? (
                  <FluentSelect
                    ariaLabel="Payroll period"
                    value={periodFilter}
                    placeholder="All periods"
                    onChange={setPeriodFilter}
                    options={[
                      { value: "", label: "All periods" },
                      ...periods.flatMap((row) => {
                        const id = readNumber(row, ["id"]);
                        if (id === null) return [];
                        return [
                          { value: String(id), label: readPeriodLabel(row) },
                        ];
                      }),
                    ]}
                  />
                ) : null}
                {["runs", "inputs", "sources", "periods"].includes(tab) ? (
                  <FluentInput
                    size="medium"
                    className="w-32"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    placeholder="Status"
                  />
                ) : null}
                {canCreate ? (
                  <FluentButton
                    appearance="primary"
                    icon={<Add20Regular />}
                    onClick={() => openCreate(primaryCreateMode)}
                  >
                    <span className="hidden sm:inline">
                      {tab === "periods" ? "Generate period" : "Create"}
                    </span>
                  </FluentButton>
                ) : null}
                {tab === "configuration" && configTab === "schemes" ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={openRuleDialog}
                  >
                    <Add20Regular className="h-3.5 w-3.5" />
                    Add rule
                  </button>
                ) : null}
                {tab === "inputs" && canMutatePayroll ? (
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => openCreate("adjustment")}
                  >
                    <Add20Regular className="h-3.5 w-3.5" />
                    Adjustment
                  </button>
                ) : null}
                {tab === "sources" && canMutatePayroll ? (
                  <>
                    <button
                      type="button"
                      className={secondaryButtonClass}
                      onClick={() => openCreate("sourceImport")}
                    >
                      <Add20Regular className="h-3.5 w-3.5" />
                      Import
                    </button>
                  </>
                ) : null}
                <FluentButton
                  appearance="subtle"
                  size="small"
                  icon={
                    <ArrowClockwise20Regular
                      className={cn(loading && "animate-spin")}
                    />
                  }
                  disabled={loading}
                  onClick={() => void loadRows({ refreshLookups: true })}
                  aria-label="Refresh"
                  title="Refresh"
                />
              </>
            }
            emptyContent={
              <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                <DocumentSearch20Regular
                  className="size-10 text-primary/75"
                  aria-hidden="true"
                />
                <Text
                  size={400}
                  weight="semibold"
                  className="mt-3 !block text-foreground"
                >
                  No {sectionTitle.toLowerCase()} yet
                </Text>
                <Text
                  size={200}
                  className="mt-1 !block max-w-md text-muted-foreground"
                >
                  {search || statusFilter || periodFilter
                    ? "No records match the current search or filters. Try changing them."
                    : `Create the first ${sectionTitle.toLowerCase().replace(/s$/, "")} to begin working here.`}
                </Text>
                {canCreate && !search && !statusFilter && !periodFilter ? (
                  <FluentButton
                    appearance="primary"
                    icon={<Add20Regular />}
                    className="mt-4"
                    onClick={() => openCreate(primaryCreateMode)}
                  >
                    {tab === "periods" ? "Generate period" : "Create"}
                  </FluentButton>
                ) : null}
              </div>
            }
            onRowSelect={(_, row) => {
              if (!row) return;
              void openDetail(row);
            }}
          />
          {tab === "configuration" && configTab === "schemes" ? (
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    Statutory rule versions
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verify each rule against its source evidence. A different
                    user from the rule creator must approve it.
                  </p>
                </div>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={loading}
                  onClick={() => void loadRows({ refreshLookups: true })}
                >
                  Refresh rules
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {statutoryRules.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                    No statutory rule versions found.
                  </p>
                ) : (
                  statutoryRules.map((rule) => {
                    const id = rowId(rule);
                    const scheme = asRecord(rule.scheme);
                    const configuration = asRecord(rule.configuration);
                    const status = readStatus(rule).toUpperCase();
                    const busy = approvingStatutoryRuleId === id;
                    return (
                      <div
                        key={id}
                        className="grid gap-3 rounded-lg border border-border/70 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {readString(
                                scheme,
                                ["name", "code"],
                                "Statutory scheme",
                              )}{" "}
                              · v
                              {readString(
                                rule,
                                ["version_number", "versionNumber"],
                                "1",
                              )}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn("capitalize", statusTone(status))}
                            >
                              {prettify(status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {prettify(
                              readString(
                                rule,
                                ["calculation_method", "calculationMethod"],
                                "",
                              ),
                            )}{" "}
                            · Effective{" "}
                            {formatAdminValue(
                              rule.effective_from ?? rule.effectiveFrom,
                            )}{" "}
                            to{" "}
                            {formatAdminValue(
                              rule.effective_to ?? rule.effectiveTo,
                            )}{" "}
                            · {asRecordArray(rule.bands).length} tax band(s)
                          </p>
                          <p className="break-words text-xs text-muted-foreground">
                            Source:{" "}
                            {readString(
                              configuration,
                              ["source_reference", "sourceReference"],
                              "Missing source reference",
                            )}
                          </p>
                        </div>
                        {status === "DRAFT" && canApproveStatutoryRule ? (
                          <button
                            type="button"
                            className={primaryButtonClass}
                            disabled={
                              busy ||
                              !readString(configuration, [
                                "source_reference",
                                "sourceReference",
                              ])
                            }
                            onClick={() => void onApproveStatutoryRule(rule)}
                          >
                            {busy ? "Approving…" : "Approve rule"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <Dialog
        open={Boolean(openIssueGroup)}
        onOpenChange={(open) => {
          if (!open) {
            setIssueDialogCode("");
            setIssueSearch("");
          }
        }}
      >
        <DialogPopup className="flex max-h-[90vh] w-[min(720px,96vw)] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openIssueGroup ? (
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    issueGroupDot(openIssueGroup.code),
                  )}
                />
              ) : null}
              {openIssueGroup ? prettify(openIssueGroup.code) : "Issues"}
            </DialogTitle>
            <DialogDescription>
              {openIssueGroup
                ? `${openIssueGroup.count} ${openIssueGroup.count === 1 ? "record" : "records"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
            <input
              className={inputClass}
              value={issueSearch}
              onChange={(event) => setIssueSearch(event.target.value)}
              placeholder="Search these issues"
            />
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {visibleIssueRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching records.
                </p>
              ) : (
                visibleIssueRows.map((issue, index) => {
                  const lines = issueDetailLines(issue, employeeNames);
                  return (
                    <div
                      key={`${issueSubject(issue, employeeNames)}-${index}`}
                      className="rounded-lg border border-border px-3 py-2.5"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {issueSubject(issue, employeeNames)}
                      </p>
                      {lines.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {lines.map((line) => (
                            <span key={`${line.label}-${line.value}`}>
                              {line.label}: {line.value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            {openIssueGroup?.code === "EMPLOYEE_PAYROLL_PROFILE_MISSING" ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setIssueDialogCode("");
                  setTab("profiles");
                }}
              >
                Open profiles
              </button>
            ) : null}
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                setIssueDialogCode("");
                setIssueSearch("");
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <PayrollEmployeeSalaryDialog
        open={Boolean(salaryTarget)}
        onOpenChange={(open) => {
          if (!open) setSalaryTarget(null);
        }}
        employeeId={salaryTarget?.employeeId ?? ""}
        employeeLabel={salaryTarget?.label ?? ""}
        structures={structures}
        canEdit={canMutatePayroll}
        canStartRevision={canStartSalaryRevision}
        onChanged={() => void loadRows({ refreshLookups: true })}
      />

      <Dialog
        open={Boolean(versionTarget)}
        onOpenChange={(open) => {
          if (!open) setVersionTarget(null);
        }}
      >
        <DialogPopup className="w-[min(480px,96vw)]">
          <DialogHeader>
            <DialogTitle>New structure version</DialogTitle>
            <DialogDescription>
              Copies {versionTarget ? optionLabel(versionTarget) : ""} into a
              draft version. Employees on this code move to it automatically
              once it is activated and its start date is reached.
            </DialogDescription>
          </DialogHeader>
          <Field label="Effective from">
            <DateInput
              className={inputClass}
              value={versionEffectiveFrom}
              onChange={(event) => setVersionEffectiveFrom(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setVersionTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={
                !versionEffectiveFrom ||
                structureActionId === rowId(versionTarget)
              }
              onClick={() => void onCreateStructureVersion()}
            >
              Create draft
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <RecordDetailsDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Payroll details"
        description={sectionTitle}
        row={detailRecord}
        content={
          <PayrollDetailsContent
            tab={tab}
            configTab={configTab}
            row={detailRecord}
          />
        }
        resolveLabel={(key) => prettify(key)}
        resolveValue={(key, row) => {
          const value = row[key];
          if (Array.isArray(value)) {
            return value.length === 0
              ? "—"
              : value.map((entry) => formatAdminValue(entry)).join(", ");
          }
          if (typeof value === "object" && value !== null) {
            const label = readString(value as AdminRecord, [
              "name",
              "title",
              "code",
              "full_name",
              "fullName",
            ]);
            return label || JSON.stringify(value);
          }
          return formatAdminValue(value);
        }}
        footer={
          detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading latest details…
            </div>
          ) : null
        }
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditingCalendar(null);
        }}
      >
        <DialogPopup className="flex max-h-[90vh] w-[min(980px,96vw)] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingCalendar ? "Edit payroll calendar" : createButtonLabel}
            </DialogTitle>
            <DialogDescription>
              {createMode === "profile"
                ? "Create or update an employee payroll profile."
                : createMode === "period"
                  ? "Generate a pay period from a calendar."
                  : createMode === "adjustment"
                    ? "Add a payroll adjustment."
                  : `Add a ${createButtonLabel.replace(/^New /, "").toLowerCase()}.`}
            </DialogDescription>
          </DialogHeader>
          {formError ? (
            <p className="text-sm text-rose-600">{formError}</p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {renderCreateFields()}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <FluentButton
                type="button"
                appearance="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </FluentButton>
              <FluentButton
                type="button"
                appearance="primary"
                disabled={saving}
                onClick={() => void onCreate()}
              >
                {saving
                  ? "Saving…"
                  : editingCalendar
                    ? "Save changes"
                    : createMode === "period"
                      ? "Generate"
                      : "Create"}
              </FluentButton>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(processTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setProcessTarget(null);
            setProcessAuthenticatorCode("");
          }
        }}
      >
        <DialogPopup className="w-[min(520px,96vw)]">
          <DialogHeader>
            <DialogTitle>Generate payroll run</DialogTitle>
            <DialogDescription>
              {`Run ${readString(processTarget, ["runNo", "run_no"], rowId(processTarget))} will be calculated and sent through HR, Finance, and Management approval.`}{" "}
              If your current login completed 2FA, you may continue without a
              code. Otherwise enter a fresh authenticator code if that method is
              enabled.
            </DialogDescription>
          </DialogHeader>
          <Field label="Fresh six-digit authenticator code (optional for verified login)">
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={processAuthenticatorCode}
              onChange={(event) =>
                setProcessAuthenticatorCode(
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
            />
          </Field>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setProcessTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={
                processingRunId === rowId(processTarget) ||
                (processAuthenticatorCode.length > 0 &&
                  processAuthenticatorCode.length !== 6)
              }
              onClick={() =>
                processTarget &&
                void onProcessRun(
                  processTarget,
                  processAuthenticatorCode || undefined,
                )
              }
            >
              {processingRunId === rowId(processTarget)
                ? "Processing…"
                : "Generate payroll"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(periodDatesTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setPeriodDatesTarget(null);
            setFormError(null);
          }
        }}
      >
        <DialogPopup className="w-[min(560px,96vw)]">
          <DialogHeader>
            <DialogTitle>Edit payroll period dates</DialogTitle>
            <DialogDescription>
              Edit before payroll processing. Locked, paid, closed, or cancelled
              periods cannot be changed. Each change is audited.
            </DialogDescription>
          </DialogHeader>
          {formError ? (
            <p className="text-sm text-rose-600">{formError}</p>
          ) : null}
          <div className="grid gap-3">
            <Field label="Cut-off date">
              <DateInput
                className={inputClass}
                value={periodDatesForm.cutoffDate}
                onChange={(event) =>
                  setPeriodDatesForm((current) => ({
                    ...current,
                    cutoffDate: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Payment date">
              <DateInput
                className={inputClass}
                value={periodDatesForm.paymentDate}
                onChange={(event) =>
                  setPeriodDatesForm((current) => ({
                    ...current,
                    paymentDate: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Reason for change">
              <Textarea
                className={textareaClass}
                value={periodDatesForm.reason}
                onChange={(event) =>
                  setPeriodDatesForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setPeriodDatesTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void onSavePeriodDates()}
            >
              {saving ? "Saving…" : "Save dates"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogPopup className="flex max-h-[90vh] w-[min(920px,96vw)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create statutory rule</DialogTitle>
            <DialogDescription>
              Tax or contribution rule for an existing scheme.
            </DialogDescription>
          </DialogHeader>
          {formError ? (
            <p className="text-sm text-rose-600">{formError}</p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Scheme">
                <FluentSelect
                  ariaLabel="Scheme"
                  className="w-full"
                  value={ruleForm.schemeId}
                  placeholder="Select a scheme"
                  onChange={(value) => {
                    const latestVersion = Math.max(
                      0,
                      ...statutoryRules
                        .filter(
                          (rule) =>
                            String(
                              readNumber(rule, ["schemeId", "scheme_id"]) ??
                                readNumber(
                                  (rule.scheme as AdminRecord | undefined) ??
                                    {},
                                  ["id"],
                                ) ??
                                "",
                            ) === value,
                        )
                        .map(
                          (rule) =>
                            readNumber(rule, [
                              "versionNumber",
                              "version_number",
                            ]) ?? 0,
                        ),
                    );
                    setRuleForm((current) => ({
                      ...current,
                      schemeId: value,
                      versionNumber: String(latestVersion + 1),
                    }));
                  }}
                  options={[
                    { value: "", label: "Select a scheme" },
                    ...schemes.flatMap((row) => {
                      const id = readNumber(row, ["id"]);
                      if (id === null) return [];
                      return [{ value: String(id), label: optionLabel(row) }];
                    }),
                  ]}
                />
              </Field>
              <Field label="Version number">
                <input
                  className={inputClass}
                  value={ruleForm.versionNumber}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      versionNumber: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Calculation method">
                <FluentSelect
                  ariaLabel="Calculation method"
                  className="w-full"
                  value={ruleForm.calculationMethod}
                  onChange={(value) =>
                    setRuleForm((current) => ({
                      ...current,
                      calculationMethod: value,
                    }))
                  }
                  options={CALCULATION_METHODS.map((value) => ({
                    value,
                    label: prettify(value),
                  }))}
                />
              </Field>
              <Field label="Effective from">
                <DateInput
                  className={inputClass}

                  value={ruleForm.effectiveFrom}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      effectiveFrom: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Effective to">
                <DateInput
                  className={inputClass}

                  value={ruleForm.effectiveTo}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      effectiveTo: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Official source / evidence reference">
                <input
                  className={inputClass}
                  value={ruleForm.sourceReference}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      sourceReference: event.target.value,
                    }))
                  }
                  placeholder="Circular, gazette, or controlled document ID"
                />
              </Field>
              <Field label="Employee rate">
                <input
                  className={inputClass}
                  value={ruleForm.employeeRate}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      employeeRate: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Employer rate">
                <input
                  className={inputClass}
                  value={ruleForm.employerRate}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      employerRate: event.target.value,
                    }))
                  }
                />
              </Field>
              {ruleSchemeCode === "SDL" ? (
                <Field label="Employer exempt from SDL">
                  <FluentSelect
                    ariaLabel="Employer exempt from SDL"
                    className="w-full"
                    value={ruleForm.employerExempt}
                    onChange={(value) =>
                      setRuleForm((current) => ({
                        ...current,
                        employerExempt: value,
                      }))
                    }
                    options={[
                      { value: "false", label: "No - standard levy applies" },
                      { value: "true", label: "Yes - exemption approved" },
                    ]}
                  />
                </Field>
              ) : null}
              <Field label="Maximum basis">
                <input
                  className={inputClass}
                  value={ruleForm.maximumBasis}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      maximumBasis: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Deduct before tax">
                <FluentSelect
                  ariaLabel="Deduct before tax"
                  className="w-full"
                  value={ruleForm.deductEmployeeBeforeTax}
                  onChange={(value) =>
                    setRuleForm((current) => ({
                      ...current,
                      deductEmployeeBeforeTax: value,
                    }))
                  }
                  options={[
                    { value: "false", label: "No" },
                    { value: "true", label: "Yes" },
                  ]}
                />
              </Field>
              <Field label="Band lower limit">
                <input
                  className={inputClass}
                  value={ruleForm.lowerLimit}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      lowerLimit: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Band upper limit">
                <input
                  className={inputClass}
                  value={ruleForm.upperLimit}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      upperLimit: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Base tax">
                <input
                  className={inputClass}
                  value={ruleForm.baseTax}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      baseTax: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Rate percent">
                <input
                  className={inputClass}
                  value={ruleForm.ratePercent}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      ratePercent: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Band sort order">
                <input
                  className={inputClass}
                  value={ruleForm.sortOrder}
                  onChange={(event) =>
                    setRuleForm((current) => ({
                      ...current,
                      sortOrder: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => setRuleOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={saving}
                onClick={() => void onCreateRule()}
              >
                {saving ? "Saving…" : "Create rule"}
              </button>
            </div>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve payroll run</DialogTitle>
            <DialogDescription>
              Choose the approval stage and enter the calculation hash. To
              reject, enter the reason in Comments.
            </DialogDescription>
          </DialogHeader>
          {formError ? (
            <p className="text-sm text-rose-600">{formError}</p>
          ) : null}
          <div className="grid gap-3">
            <Field label="Approval stage">
              <FluentSelect
                ariaLabel="Approval stage"
                className="w-full"
                value={approveForm.stage}
                onChange={(value) =>
                  setApproveForm((current) => ({
                    ...current,
                    stage: value,
                  }))
                }
                options={APPROVAL_STAGES.map((value) => ({
                  value,
                  label: prettify(value),
                }))}
              />
            </Field>
            <Field label="Calculation hash">
              <input
                className={inputClass}
                value={approveForm.calculationHash}
                onChange={(event) =>
                  setApproveForm((current) => ({
                    ...current,
                    calculationHash: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Comments">
              <Textarea
                className={textareaClass}
                value={approveForm.comments}
                onChange={(event) =>
                  setApproveForm((current) => ({
                    ...current,
                    comments: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setApproveOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => void onRejectRun()}
            >
              Reject to preparer
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void onApproveRun()}
            >
              {saving ? "Saving…" : "Approve run"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <Dialog
        open={lifecycleAction !== null}
        onOpenChange={(open) => {
          if (!open) setLifecycleAction(null);
        }}
      >
        <DialogPopup className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {lifecycleAction?.kind === "reverse"
                ? "Reverse payroll run"
                : lifecycleAction?.kind === "paid"
                  ? "Confirm salary payment"
                  : "Cancel payroll run"}
            </DialogTitle>
            <DialogDescription>
              {lifecycleAction?.kind === "reverse"
                ? "Reversal is only allowed when no salary payment is confirmed. Reverse the payroll journal first if one was posted. Calculations and history are kept."
                : lifecycleAction?.kind === "paid"
                  ? "Use this only when the bank has confirmed the transfer and no statement will be imported. Confirming posts loan repayments and cannot be undone except by a correction run. Prefer importing the bank statement."
                  : "Cancelling keeps the calculations and approval history, and releases loan deductions back to the next run. Locked or paid payroll must be reversed instead."}
            </DialogDescription>
          </DialogHeader>
          {lifecycleError ? (
            <p className="text-sm text-rose-600">{lifecycleError}</p>
          ) : null}
          <div className="grid gap-3">
            {lifecycleAction?.kind === "paid" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Bank payment reference">
                  <input
                    className={inputClass}
                    value={lifecyclePaymentReference}
                    onChange={(event) =>
                      setLifecyclePaymentReference(event.target.value)
                    }
                  />
                </Field>
                <Field label="Value date">
                  <input
                    type="date"
                    className={inputClass}
                    value={lifecyclePaymentDate}
                    onChange={(event) =>
                      setLifecyclePaymentDate(event.target.value)
                    }
                  />
                </Field>
              </div>
            ) : null}
            <Field
              label={
                lifecycleAction?.kind === "paid"
                  ? "Confirmation note (who confirmed, how)"
                  : "Reason"
              }
            >
              <Textarea
                className={textareaClass}
                value={lifecycleReason}
                onChange={(event) => setLifecycleReason(event.target.value)}
              />
            </Field>
            {lifecycleAction?.kind === "reverse" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={lifecycleBankWithdrawn}
                  onChange={(event) =>
                    setLifecycleBankWithdrawn(event.target.checked)
                  }
                />
                <span>
                  If a bank payment file was generated, I confirm it was not
                  submitted to the bank or has been withdrawn.
                </span>
              </label>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setLifecycleAction(null)}
            >
              Back
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void onSubmitLifecycleAction()}
            >
              {saving
                ? "Saving…"
                : lifecycleAction?.kind === "reverse"
                  ? "Reverse run"
                  : lifecycleAction?.kind === "paid"
                    ? "Confirm payment"
                    : "Cancel run"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      <PayrollPaymentProgressDialog
        runId={paymentProgressRunId}
        canRetry={canRetryPayments}
        onClose={() => setPaymentProgressRunId(null)}
        onChanged={() => void loadRows({ refreshLookups: true })}
      />
      <Dialog
        open={eligibilityReport !== null}
        onOpenChange={(open) => {
          if (!open) setEligibilityReport(null);
        }}
      >
        <DialogPopup className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payroll eligibility</DialogTitle>
            <DialogDescription>
              Everyone employed during the period. Errors must be fixed before
              the run can be processed; exclusions are deliberate.
            </DialogDescription>
          </DialogHeader>
          {eligibilityReport?.loading ? (
            <div className="flex justify-center py-6">
              <FluentLoadingIndicator className="size-5 animate-spin" />
            </div>
          ) : eligibilityReport?.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {(
                  [
                    ["Eligible", "eligible_count", ""],
                    ["Excluded", "excluded_count", ""],
                    ["Errors", "error_count", "text-rose-600"],
                  ] as const
                ).map(([label, key, tone]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-border p-2"
                  >
                    <div className={cn("text-lg font-semibold", tone)}>
                      {readNumber(eligibilityReport.data!, [key]) ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              <div className="max-h-[50vh] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">Employee</th>
                      <th className="py-1 pr-2">Status</th>
                      <th className="py-1">Reason / action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asRecordArray(eligibilityReport.data.rows)
                      .filter(
                        (item) => readString(item, ["status"]) !== "ELIGIBLE",
                      )
                      .map((item) => (
                        <tr
                          key={readString(item, ["employee_id"])}
                          className="border-t border-border/60 align-top"
                        >
                          <td className="py-1.5 pr-2">
                            <div className="font-medium">
                              {readString(item, ["employee_name"])}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {readString(item, ["employee_no"])}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                readString(item, ["status"]) === "ERROR" &&
                                  "border-rose-300 text-rose-700 dark:text-rose-300",
                              )}
                            >
                              {prettify(readString(item, ["status"]))}
                            </Badge>
                          </td>
                          <td className="py-1.5">
                            <div>{readString(item, ["reason"])}</div>
                            {readString(item, ["action"]) ? (
                              <div className="text-xs text-muted-foreground">
                                {readString(item, ["action"])}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {asRecordArray(eligibilityReport.data.rows).every(
                  (item) => readString(item, ["status"]) === "ELIGIBLE",
                ) ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Every employee in the period is eligible.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogPopup>
      </Dialog>
    </div>
  );
}

export default PayrollOperationsView;
