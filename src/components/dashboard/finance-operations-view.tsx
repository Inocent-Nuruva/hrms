"use client";

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import { SharedDashboardHeroBackground } from "@/components/dashboard/welcome-card-background"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import { DateInput } from "@/components/ui/date-input"
import { Textarea } from "@/components/ui/textarea"
import * as React from "react";
import { RefreshCwIcon, UploadIcon } from "lucide-react";
import {
  Add20Regular,
  AppsList24Regular,
  ArrowClockwise20Regular,
  ArrowTrending24Regular,
  CheckmarkCircle20Regular,
  DocumentBulletList24Regular,
  Money24Regular,
  Wallet24Regular,
} from "@fluentui/react-icons";
import { Button, Checkbox } from "@fluentui/react-components";
import { Input } from "@/components/ui/input";
import { FormField as Field } from "@/components/ui/form-field";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
import {
  MetricTile,
  StatusChip,
  StatusStack,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  employeeLabel,
  optionLabel,
  pageBleedClass,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  statusChartItems,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  approveEmployeeFinanceDisbursement,
  approveEmployeeFinanceApplication,
  approveEmployeeFinanceRepayment,
  approveHrEmployeeFinanceApplication,
  confirmEmployeeFinanceDisbursement,
  createEmployeeFinanceDisbursement,
  createEmployeeFinanceProduct,
  createEmployeeFinanceRepayment,
  createEmployeeFinanceSettlementQuote,
  evaluateEmployeeFinanceEligibility,
  getEmployeeFinanceAccountStatement,
  getEmployeeFinanceSanctionLetter,
  getEmployeeFinanceDashboard,
  getEmployeeFinanceReport,
  importEmployeeFinancePayments,
  listEmployeeFinanceApplicationDocuments,
  listEmployeeFinanceApplicationGuarantors,
  listEmployeeFinanceAccounts,
  listEmployeeFinanceApplications,
  listEmployeeFinanceAuditTimeline,
  listEmployeeFinanceProducts,
  postEmployeeFinanceAccounting,
  recommendEmployeeFinanceApplication,
  requestEmployeeFinanceDeferment,
  requestEmployeeFinanceReschedule,
  runEmployeeFinanceReconciliation,
  verifyEmployeeFinanceApplicationDocument,
  approveManagementEmployeeFinanceApplication,
  cancelEmployeeFinanceDisbursement,
  createEmployeeFinanceProductVersion,
  decideEmployeeFinanceApplication,
  downloadEmployeeFinanceSanctionLetter,
  getEmployeeFinanceApprovalHistory,
  requestEmployeeFinanceAdjustment,
  retireEmployeeFinanceProduct,
  settleEmployeeFinanceQuote,
  updateEmployeeFinanceProduct,
  downloadEmployeeFinanceStatement,
  exportEmployeeFinanceReport,
  getEmployeeFinanceLoanReport,
  type AdminRecord,
} from "@/lib/admin-api";
import { canAccessDashboardRoute } from "@/lib/dashboard-permissions";
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";

export type FinanceOpsTab =
  "overview" | "products" | "applications" | "accounts" | "reports";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function approvalPayload(row: AdminRecord) {
  const snapshotHash = readString(row, [
    "eligibilitySnapshotHash",
    "eligibility_snapshot_hash",
    "snapshotHash",
    "snapshot_hash",
  ]);
  return snapshotHash ? { snapshot_hash: snapshotHash } : {};
}

function requiredDocumentsFromApplication(row: AdminRecord | null) {
  const product = asRecord(row?.productSnapshot ?? row?.product_snapshot);
  const raw =
    product?.requiredDocumentTypes ?? product?.required_document_types;
  return Array.isArray(raw)
    ? raw.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
}

function requiredGuarantorCountFromApplication(row: AdminRecord | null) {
  const product = asRecord(row?.productSnapshot ?? row?.product_snapshot);
  const approval = asRecord(
    product?.approvalConfiguration ?? product?.approval_configuration,
  );
  const eligibility = asRecord(
    product?.eligibilityConfiguration ?? product?.eligibility_configuration,
  );
  return (
    readNumber(product, ["requiredGuarantors", "required_guarantors"]) ??
    readNumber(approval, [
      "required_guarantors",
      "guarantor_count",
      "requiredGuarantorCount",
    ]) ??
    readNumber(eligibility, [
      "required_guarantors",
      "guarantor_count",
      "requiredGuarantorCount",
    ]) ??
    0
  );
}

function statementArray(statement: AdminRecord | null, key: string) {
  const value = statement?.[key];
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is AdminRecord =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];
}

function sumRecordAmounts(rows: AdminRecord[], keys: string[]) {
  return rows.reduce((sum, row) => {
    const value = readNumber(row, keys);
    return sum + (value ?? 0);
  }, 0);
}




const LOAN_REPORT_TYPES = new Set([
  "applications",
  "approvals",
  "active-loans",
  "monthly-deductions",
  "outstanding",
  "settled-loans",
  "exit-recoveries",
]);

const financeReportTypes = [
  { value: "applications", label: "Loan applications" },
  { value: "approvals", label: "Loan approvals" },
  { value: "active-loans", label: "Active loans" },
  { value: "monthly-deductions", label: "Monthly loan deductions" },
  { value: "outstanding", label: "Outstanding and overdue" },
  { value: "settled-loans", label: "Settled loans" },
  { value: "exit-recoveries", label: "Recovery at final settlement" },
  { value: "aging", label: "Aging" },
  { value: "exposure", label: "Outstanding exposure" },
  { value: "repayment-performance", label: "Repayment performance" },
  { value: "disbursements", label: "Disbursements" },
  { value: "settlements", label: "Settlements" },
  { value: "default-risk", label: "Default risk" },
  { value: "support-compliance", label: "Support compliance" },
];

function reportRows(report: AdminRecord | null) {
  return statementArray(report, "rows");
}



function parseCsvList(value?: string) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function optionalNumber(value?: string) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const STAGE_BY_STATUS: Record<string, "recommend" | "hr" | "finance" | "management"> = {
  PENDING_MANAGER_RECOMMENDATION: "recommend",
  PENDING_HR_APPROVAL: "hr",
  PENDING_FINANCE_APPROVAL: "finance",
  PENDING_MANAGEMENT_APPROVAL: "management",
};

const STAGE_CODE: Record<"recommend" | "hr" | "finance" | "management", string> = {
  recommend: "MANAGER",
  hr: "HR",
  finance: "FINANCE",
  management: "MANAGEMENT",
};

const STAGE_LABEL: Record<"recommend" | "hr" | "finance" | "management", string> = {
  recommend: "Recommend",
  hr: "HR approve",
  finance: "Finance approve",
  management: "Management approve",
};

function currentStageAction(row: AdminRecord | null) {
  return STAGE_BY_STATUS[readString(row, ["status"], "").toUpperCase()] ?? null;
}

function saveBlob(file: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type TierDraft = { minimum_amount: string; maximum_amount: string; stages: string[] };

function FinanceInputField({
  label,
  value,
  onValueChange,
  disabled,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  type?: React.ComponentProps<typeof Input>["type"];
}) {
  return (
    <Field label={label}>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </Field>
  );
}

function tiersFromProduct(row: AdminRecord | null): TierDraft[] {
  const approval = asRecord(row?.approvalConfiguration ?? row?.approval_configuration);
  const raw = approval?.approval_tiers;
  return Array.isArray(raw)
    ? raw.map((tier) => {
        const record = asRecord(tier);
        return {
          minimum_amount: readString(record, ["minimum_amount"], "0"),
          maximum_amount: readString(record, ["maximum_amount"], ""),
          stages: Array.isArray(record?.stages) ? record.stages.map(String) : [],
        };
      })
    : [];
}

function makerCheckerSummary(row: AdminRecord, includeConfirmation = false) {
  const createdBy = readString(row, [
    "createdByCompanyUserId",
    "created_by_company_user_id",
  ]);
  const approvedBy = readString(row, [
    "approvedByCompanyUserId",
    "approved_by_company_user_id",
  ]);
  const approvedAt = readString(row, ["approvedAt", "approved_at"]);
  const confirmedAt = includeConfirmation
    ? readString(row, ["confirmedAt", "confirmed_at"])
    : "";

  return [
    createdBy ? `Created by ${createdBy}` : "",
    approvedBy ? `Approved by ${approvedBy}` : "",
    approvedAt ? `Approved ${approvedAt}` : "",
    confirmedAt ? `Confirmed ${confirmedAt}` : "",
  ].filter(Boolean);
}

export function FinanceOperationsView({
  activeTab,
}: {
  activeTab: FinanceOpsTab;
}) {
  const actor = useDashboardActor();
  const canAccess =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/finance/overview",
      actor.permissionLabels,
      actor.accessMode,
    );
  const leaveIfForbidden = useLeaveIfForbidden();
  useForbiddenRouteGuard(canAccess);

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [products, setProducts] = React.useState<AdminRecord[]>([]);
  const [applications, setApplications] = React.useState<AdminRecord[]>([]);
  const [accounts, setAccounts] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [detail, setDetail] = React.useState<AdminRecord | null>(null);
  const [applicationDetail, setApplicationDetail] =
    React.useState<AdminRecord | null>(null);
  const [applicationDocuments, setApplicationDocuments] = React.useState<
    AdminRecord[]
  >([]);
  const [applicationGuarantors, setApplicationGuarantors] = React.useState<
    AdminRecord[]
  >([]);
  const [sanctionLetter, setSanctionLetter] =
    React.useState<AdminRecord | null>(null);
  const [applicationLoading, setApplicationLoading] = React.useState(false);
  const [applicationError, setApplicationError] = React.useState<string | null>(
    null,
  );
  const [accountDetail, setAccountDetail] = React.useState<AdminRecord | null>(
    null,
  );
  const [accountStatement, setAccountStatement] =
    React.useState<AdminRecord | null>(null);
  const [accountLoading, setAccountLoading] = React.useState(false);
  const [accountError, setAccountError] = React.useState<string | null>(null);
  const [selectedReport, setSelectedReport] = React.useState("aging");
  const [reportFilters, setReportFilters] = React.useState<
    Record<string, string>
  >({});
  const [reportPage, setReportPage] = React.useState(1);
  const [reportData, setReportData] = React.useState<AdminRecord | null>(null);
  const [auditTimeline, setAuditTimeline] = React.useState<AdminRecord[]>([]);
  const [reportLoading, setReportLoading] = React.useState(false);
  const [reportError, setReportError] = React.useState<string | null>(null);
  const [importingPayments, setImportingPayments] = React.useState(false);
  const [postingAccounting, setPostingAccounting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<
    | "product"
    | "product-edit"
    | "product-version"
    | "disburse"
    | "repay"
    | "defer"
    | "reschedule"
    | "adjust"
    | "settle"
  >("product");
  const [productTarget, setProductTarget] = React.useState<AdminRecord | null>(null);
  const [tiers, setTiers] = React.useState<TierDraft[]>([]);
  const [approvalHistory, setApprovalHistory] = React.useState<AdminRecord | null>(null);
  const [decisionTarget, setDecisionTarget] = React.useState<{
    row: AdminRecord;
    decision: "REJECTED" | "RETURNED";
  } | null>(null);
  const [decisionComments, setDecisionComments] = React.useState("");
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");

  const load = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      setError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const tasks: Array<Promise<unknown>> = [
      getEmployeeFinanceDashboard(token)
        .then(setDashboard)
        .catch(() => setDashboard(null)),
    ];
    if (activeTab === "products" || activeTab === "overview") {
      tasks.push(
        listEmployeeFinanceProducts(token)
          .then(setProducts)
          .catch(() => setProducts([])),
      );
    }
    if (activeTab === "applications" || activeTab === "overview") {
      tasks.push(
        listEmployeeFinanceApplications(token)
          .then(setApplications)
          .catch(() => setApplications([])),
      );
    }
    if (activeTab === "accounts" || activeTab === "overview") {
      tasks.push(
        listEmployeeFinanceAccounts(token)
          .then(setAccounts)
          .catch(() => setAccounts([])),
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
          : "Could not load finance data.",
      );
    }
    setLoading(false);
  }, [activeTab, leaveIfForbidden]);

  React.useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  const loadReports = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const params = {
        date_from: reportFilters.date_from || undefined,
        date_to: reportFilters.date_to || undefined,
        as_of: reportFilters.as_of || undefined,
        page: reportPage,
        limit: 20,
        sort_by: reportFilters.sort_by || undefined,
        sort_order: reportFilters.sort_order || undefined,
      };
      const [report, audit] = await Promise.all([
        LOAN_REPORT_TYPES.has(selectedReport)
          ? getEmployeeFinanceLoanReport(token, selectedReport, params)
          : getEmployeeFinanceReport(token, selectedReport, params),
        listEmployeeFinanceAuditTimeline(token, { limit: 100 }),
      ]);
      setReportData(report);
      setAuditTimeline(audit);
    } catch (errorObject) {
      setReportData(null);
      setAuditTimeline([]);
      setReportError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load finance reports.",
      );
    } finally {
      setReportLoading(false);
    }
  }, [reportFilters.as_of, reportFilters.date_from, reportFilters.date_to, reportFilters.sort_by, reportFilters.sort_order, reportPage, selectedReport]);

  React.useEffect(() => {
    if (!canAccess || activeTab !== "reports") return;
    void loadReports();
  }, [activeTab, canAccess, loadReports]);

  const loadApplicationDetail = React.useCallback(async (row: AdminRecord) => {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setApplicationDetail(row);
    setApplicationLoading(true);
    setApplicationError(null);
    const [documentsResult, guarantorsResult, sanctionResult, historyResult] =
      await Promise.allSettled([
        listEmployeeFinanceApplicationDocuments(token, id),
        listEmployeeFinanceApplicationGuarantors(token, id),
        getEmployeeFinanceSanctionLetter(token, id),
        getEmployeeFinanceApprovalHistory(token, id),
      ]);
    setApprovalHistory(
      historyResult.status === "fulfilled" ? asRecord(historyResult.value) : null,
    );
    if (documentsResult.status === "fulfilled") {
      setApplicationDocuments(documentsResult.value);
    } else {
      setApplicationDocuments([]);
      setApplicationError(
        documentsResult.reason instanceof Error
          ? documentsResult.reason.message
          : "Could not load documents.",
      );
    }
    if (guarantorsResult.status === "fulfilled") {
      setApplicationGuarantors(guarantorsResult.value);
    } else {
      setApplicationGuarantors([]);
    }
    if (sanctionResult.status === "fulfilled") {
      setSanctionLetter(sanctionResult.value);
    } else {
      setSanctionLetter(null);
    }
    setApplicationLoading(false);
  }, []);

  const loadAccountDetail = React.useCallback(async (row: AdminRecord) => {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setAccountDetail(row);
    setAccountLoading(true);
    setAccountError(null);
    try {
      const statement = await getEmployeeFinanceAccountStatement(token, id);
      setAccountStatement(statement);
      const account = asRecord(statement?.account) ?? row;
      setAccountDetail(account);
    } catch (errorObject) {
      setAccountStatement(null);
      setAccountError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load account statement.",
      );
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const rows =
    activeTab === "products"
      ? products
      : activeTab === "accounts"
        ? accounts
        : applications;
  const visible = rows.filter(
    (row) =>
      !search ||
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );

  const actOnApplication = React.useCallback(
    async (
      row: AdminRecord,
      action: "recommend" | "hr" | "finance" | "management",
    ) => {
      const token = readStoredToken();
      const id = rowId(row);
      if (!token || !id) return;
      const busyKey = `${action}-${id}`;
      setBusyId(busyKey);
      try {
        const payload = approvalPayload(row);
        if (!payload.snapshot_hash) {
          throw new Error("Application snapshot hash is missing.");
        }
        if (action === "recommend") {
          await recommendEmployeeFinanceApplication(token, id, payload);
          toast.success("Recommended.");
        } else if (action === "hr") {
          await approveHrEmployeeFinanceApplication(token, id, payload);
          toast.success("HR approved.");
        } else if (action === "management") {
          await approveManagementEmployeeFinanceApplication(token, id, payload);
          toast.success("Management approved.");
        } else {
          await approveEmployeeFinanceApplication(token, id, payload);
          toast.success("Finance approved.");
        }
        await load();
        if (applicationDetail && rowId(applicationDetail) === id) {
          await loadApplicationDetail({ ...applicationDetail, ...row });
        }
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not update application.",
        );
      } finally {
        setBusyId("");
      }
    },
    [applicationDetail, load, loadApplicationDetail],
  );

  async function exportServerReport(format: "xlsx" | "csv") {
    const token = readStoredToken();
    if (!token) return;
    try {
      saveBlob(
        await exportEmployeeFinanceReport(token, selectedReport, format, {
          date_from: reportFilters.date_from || undefined,
          date_to: reportFilters.date_to || undefined,
          as_of: reportFilters.as_of || undefined,
          sort_by: reportFilters.sort_by || undefined,
          sort_order: reportFilters.sort_order || undefined,
        }),
      );
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not export.");
    }
  }

  async function downloadStatement(format: "pdf" | "xlsx") {
    const token = readStoredToken();
    const id = rowId(accountDetail);
    if (!token || !id) return;
    try {
      saveBlob(await downloadEmployeeFinanceStatement(token, id, format));
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not download the statement.");
    }
  }

  async function submitApplicationDecision() {
    const token = readStoredToken();
    if (!token || !decisionTarget) return;
    const action = currentStageAction(decisionTarget.row);
    const id = rowId(decisionTarget.row);
    if (!action || !id) return;
    setBusyId(`decision-${id}`);
    try {
      await decideEmployeeFinanceApplication(token, id, {
        stage: STAGE_CODE[action],
        decision: decisionTarget.decision,
        comments: decisionComments.trim(),
      });
      toast.success(
        decisionTarget.decision === "RETURNED"
          ? "Returned to the employee for correction."
          : "Application declined.",
      );
      setDecisionTarget(null);
      setDecisionComments("");
      await load();
      if (applicationDetail && rowId(applicationDetail) === id) {
        await loadApplicationDetail({ ...applicationDetail, ...decisionTarget.row });
      }
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Could not record the decision.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function downloadSanctionLetter(row: AdminRecord | null) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    try {
      saveBlob(await downloadEmployeeFinanceSanctionLetter(token, id));
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error ? errorObject.message : "Could not download the letter.",
      );
    }
  }

  function openProductForm(
    mode: "product" | "product-edit" | "product-version",
    row: AdminRecord | null,
  ) {
    setCreateMode(mode);
    setProductTarget(row);
    setFormError(null);
    if (!row) {
      setForm({ product_type: "STAFF_LOAN", interest_method: "FLAT_RATE" });
      setTiers([]);
      setCreateOpen(true);
      return;
    }
    const approval = asRecord(row.approvalConfiguration ?? row.approval_configuration);
    const policy = asRecord(
      asRecord(row.eligibilityConfiguration ?? row.eligibility_configuration)
        ?.policy_configuration,
    );
    const penalty = asRecord(policy?.penalty);
    const flag = (keys: string[]) =>
      String(Boolean((row as Record<string, unknown>)[keys[0]] ?? (row as Record<string, unknown>)[keys[1]]));
    setForm({
      product_type: readString(row, ["productType", "product_type"], "STAFF_LOAN"),
      code: readString(row, ["code"], ""),
      name: readString(row, ["name"], ""),
      description: readString(row, ["description"], ""),
      interest_method: readString(row, ["interestMethod", "interest_method"], "ZERO_INTEREST"),
      annual_interest_rate: readString(row, ["annualInterestRate", "annual_interest_rate"], ""),
      processing_fee_method: readString(row, ["processingFeeMethod", "processing_fee_method"], "NONE"),
      processing_fee_value: readString(row, ["processingFeeValue", "processing_fee_value"], ""),
      minimum_amount: readString(row, ["minimumAmount", "minimum_amount"], ""),
      maximum_amount: readString(row, ["maximumAmount", "maximum_amount"], ""),
      minimum_term_months: readString(row, ["minimumTermMonths", "minimum_term_months"], ""),
      maximum_term_months: readString(row, ["maximumTermMonths", "maximum_term_months"], ""),
      maximum_salary_multiple: readString(row, ["maximumSalaryMultiple", "maximum_salary_multiple"], ""),
      maximum_installment_percentage: readString(row, ["maximumInstallmentPercentage", "maximum_installment_percentage"], ""),
      minimum_service_months: readString(row, ["minimumServiceMonths", "minimum_service_months"], ""),
      maximum_active_accounts: readString(row, ["maximumActiveAccounts", "maximum_active_accounts"], ""),
      required_document_types: (Array.isArray(row.requiredDocumentTypes ?? row.required_document_types)
        ? ((row.requiredDocumentTypes ?? row.required_document_types) as unknown[]).map(String)
        : []
      ).join(", "),
      required_guarantors: readString(approval, ["required_guarantors"], ""),
      penalty_method: readString(penalty, ["method"], "NONE"),
      penalty_value: readString(penalty, ["value"], ""),
      requires_confirmation: flag(["requiresConfirmation", "requires_confirmation"]),
      allow_during_probation: flag(["allowDuringProbation", "allow_during_probation"]),
      allow_rescheduling: flag(["allowRescheduling", "allow_rescheduling"]),
      allow_deferment: flag(["allowDeferment", "allow_deferment"]),
      allow_early_settlement: flag(["allowEarlySettlement", "allow_early_settlement"]),
      allow_additional_repayment: flag(["allowAdditionalRepayment", "allow_additional_repayment"]),
      effective_from:
        mode === "product-version"
          ? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
          : readString(row, ["effectiveFrom", "effective_from"], ""),
    });
    setTiers(tiersFromProduct(row));
    setCreateOpen(true);
  }

  async function retireProduct(row: AdminRecord) {
    const token = readStoredToken();
    const id = rowId(row);
    if (!token || !id) return;
    setBusyId(`retire-${id}`);
    try {
      await retireEmployeeFinanceProduct(token, id);
      toast.success("Product retired; existing loans are unaffected.");
      await load();
    } catch (errorObject) {
      toast.error(errorObject instanceof Error ? errorObject.message : "Could not retire.");
    } finally {
      setBusyId("");
    }
  }

  const decideDocument = React.useCallback(
    async (document: AdminRecord, status: "VERIFIED" | "REJECTED") => {
      const token = readStoredToken();
      const applicationId = rowId(applicationDetail);
      const documentId = rowId(document);
      if (!token || !applicationId || !documentId || !applicationDetail) return;
      setBusyId(`doc-${status}-${documentId}`);
      try {
        await verifyEmployeeFinanceApplicationDocument(
          token,
          applicationId,
          documentId,
          { status },
        );
        toast.success(
          status === "VERIFIED" ? "Document verified." : "Document rejected.",
        );
        await loadApplicationDetail(applicationDetail);
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not update document.",
        );
      } finally {
        setBusyId("");
      }
    },
    [applicationDetail, loadApplicationDetail],
  );

  const openAccountAction = React.useCallback(
    (
      mode: "disburse" | "repay" | "defer" | "reschedule" | "adjust" | "settle",
      account: AdminRecord,
      extra: Record<string, string> = {},
    ) => {
      setCreateMode(mode);
      setForm({
        account_id: rowId(account),
        payment_date: new Date().toISOString().slice(0, 10),
        ...extra,
      });
      setFormError(null);
      setCreateOpen(true);
    },
    [],
  );

  const quoteAccount = React.useCallback(
    async (account: AdminRecord) => {
      const token = readStoredToken();
      const id = rowId(account);
      if (!token || !id) return;
      setBusyId(`quote-${id}`);
      try {
        await createEmployeeFinanceSettlementQuote(token, id);
        toast.success("Settlement quote created.");
        await load();
        await loadAccountDetail(account);
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not quote.",
        );
      } finally {
        setBusyId("");
      }
    },
    [load, loadAccountDetail],
  );

  const actOnDisbursement = React.useCallback(
    async (item: AdminRecord, action: "approve" | "confirm") => {
      const token = readStoredToken();
      const id = rowId(item);
      if (!token || !id || !accountDetail) return;
      setBusyId(`disb-${action}-${id}`);
      try {
        if (action === "approve") {
          await approveEmployeeFinanceDisbursement(token, id);
          toast.success("Disbursement approved.");
        } else {
          await confirmEmployeeFinanceDisbursement(token, id);
          toast.success("Disbursement confirmed.");
        }
        await load();
        await loadAccountDetail(accountDetail);
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not update disbursement.",
        );
      } finally {
        setBusyId("");
      }
    },
    [accountDetail, load, loadAccountDetail],
  );

  const approveRepayment = React.useCallback(
    async (item: AdminRecord) => {
      const token = readStoredToken();
      const id = rowId(item);
      if (!token || !id || !accountDetail) return;
      setBusyId(`repay-approve-${id}`);
      try {
        await approveEmployeeFinanceRepayment(token, id);
        toast.success("Repayment approved.");
        await load();
        await loadAccountDetail(accountDetail);
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not approve repayment.",
        );
      } finally {
        setBusyId("");
      }
    },
    [accountDetail, load, loadAccountDetail],
  );

  const importPaymentFile = React.useCallback(
    async (file: File | null) => {
      const token = readStoredToken();
      if (!token || !file) return;
      setImportingPayments(true);
      try {
        const result = await importEmployeeFinancePayments(token, file, {
          dryRun: false,
        });
        const summary = asRecord(asRecord(result)?.summary);
        toast.success(
          `Payment import complete: ${readString(summary, ["posted_rows"], "0")} posted.`,
        );
        await load();
        if (activeTab === "reports") await loadReports();
      } catch (errorObject) {
        toast.error(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not import payment file.",
        );
      } finally {
        setImportingPayments(false);
      }
    },
    [activeTab, load, loadReports],
  );

  const postAccounting = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) return;
    setPostingAccounting(true);
    try {
      const result = await postEmployeeFinanceAccounting(token, {
        date_from: reportFilters.date_from || undefined,
        date_to: reportFilters.date_to || undefined,
        dry_run: false,
      });
      const summary = asRecord(asRecord(result)?.summary);
      toast.success(
        `Accounting batch ready: ${readString(summary, ["journal_count"], "0")} journals.`,
      );
      if (activeTab === "reports") await loadReports();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not post accounting batch.",
      );
    } finally {
      setPostingAccounting(false);
    }
  }, [activeTab, loadReports, reportFilters.date_from, reportFilters.date_to]);

  async function onSave() {
    const token = readStoredToken();
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      if (
        createMode === "product" ||
        createMode === "product-edit" ||
        createMode === "product-version"
      ) {
        if (
          !form.code ||
          !form.name ||
          !form.minimum_amount ||
          !form.maximum_term_months ||
          !form.effective_from
        ) {
          throw new Error(
            "Code, name, minimum amount, term, and effective from are required.",
          );
        }
        for (const tier of tiers) {
          if (!tier.stages.length) {
            throw new Error("Each approval tier needs at least one stage.");
          }
        }
        const existingEligibility = asRecord(
          productTarget?.eligibilityConfiguration ??
            productTarget?.eligibility_configuration,
        );
        const existingPolicy = asRecord(existingEligibility?.policy_configuration);
        const payload: AdminRecord = {
          product_type: form.product_type || "STAFF_LOAN",
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          interest_method: form.interest_method || undefined,
          annual_interest_rate: form.annual_interest_rate || undefined,
          processing_fee_method: form.processing_fee_method || "NONE",
          processing_fee_value: form.processing_fee_value || undefined,
          minimum_amount: form.minimum_amount,
          maximum_amount: form.maximum_amount || undefined,
          maximum_salary_multiple: form.maximum_salary_multiple || undefined,
          minimum_term_months: optionalNumber(form.minimum_term_months),
          maximum_term_months: Number(form.maximum_term_months),
          minimum_service_months: optionalNumber(form.minimum_service_months),
          maximum_installment_percentage:
            form.maximum_installment_percentage || undefined,
          maximum_active_accounts: optionalNumber(form.maximum_active_accounts),
          requires_confirmation: form.requires_confirmation === "true",
          allow_during_probation: form.allow_during_probation === "true",
          allow_rescheduling: form.allow_rescheduling !== "false",
          allow_deferment: form.allow_deferment !== "false",
          allow_early_settlement: form.allow_early_settlement !== "false",
          allow_additional_repayment:
            form.allow_additional_repayment !== "false",
          required_document_types: parseCsvList(form.required_document_types),
          eligibility_configuration: {
            ...(existingEligibility ?? {}),
            policy_configuration: {
              ...(existingPolicy ?? {}),
              penalty:
                form.penalty_method && form.penalty_method !== "NONE"
                  ? { method: form.penalty_method, value: form.penalty_value }
                  : { method: "NONE" },
            },
          },
          approval_configuration: {
            required_guarantors: optionalNumber(form.required_guarantors) ?? 0,
            approval_tiers: tiers.map((tier) => ({
              minimum_amount: tier.minimum_amount || "0",
              maximum_amount: tier.maximum_amount || null,
              stages: tier.stages,
            })),
          },
          effective_from: form.effective_from,
        };
        const targetId = rowId(productTarget);
        if (createMode === "product-edit" && targetId) {
          await updateEmployeeFinanceProduct(token, targetId, payload);
        } else if (createMode === "product-version" && targetId) {
          await createEmployeeFinanceProductVersion(token, targetId, payload);
        } else {
          await createEmployeeFinanceProduct(token, payload);
        }
      } else if (createMode === "adjust") {
        if (!form.account_id || !form.adjustment_type || !form.reason) {
          throw new Error("Type and reason are required.");
        }
        if (form.adjustment_type !== "WRITE_OFF" && !form.amount) {
          throw new Error("Amount is required.");
        }
        await requestEmployeeFinanceAdjustment(token, form.account_id, {
          adjustment_type: form.adjustment_type,
          amount: form.adjustment_type === "WRITE_OFF" ? undefined : form.amount,
          reason: form.reason,
        });
        toast.success("Sent for approval by a second Finance user.");
      } else if (createMode === "settle") {
        if (!form.quote_id || !form.payment_reference || !form.payment_date) {
          throw new Error("Payment reference and date are required.");
        }
        await settleEmployeeFinanceQuote(token, form.quote_id, {
          payment_reference: form.payment_reference,
          payment_date: form.payment_date,
        });
        toast.success("Payoff recorded; a second Finance user must approve the repayment.");
      } else if (createMode === "disburse") {
        if (
          !form.account_id ||
          !form.amount ||
          !form.payment_reference ||
          !form.payment_date
        ) {
          throw new Error("Account, amount, reference, and date are required.");
        }
        await createEmployeeFinanceDisbursement(token, {
          account_id: Number(form.account_id),
          amount: form.amount,
          payment_reference: form.payment_reference,
          payment_date: form.payment_date,
        });
      } else if (createMode === "repay") {
        if (!form.account_id || !form.amount || !form.payment_date)
          throw new Error("Account, amount, and date are required.");
        await createEmployeeFinanceRepayment(token, {
          account_id: Number(form.account_id),
          amount: form.amount,
          payment_date: form.payment_date,
          payment_reference: form.payment_reference || undefined,
        });
      } else if (createMode === "defer") {
        if (!form.account_id || !form.installment_id || !form.reason)
          throw new Error("Installment and reason are required.");
        await requestEmployeeFinanceDeferment(token, form.account_id, {
          installment_id: Number(form.installment_id),
          reason: form.reason,
        });
        toast.success("Deferment sent for approval.");
      } else if (createMode === "reschedule") {
        if (!form.account_id || !form.new_term_months || !form.reason)
          throw new Error("New term and reason are required.");
        await requestEmployeeFinanceReschedule(token, form.account_id, {
          new_term_months: Number(form.new_term_months),
          reason: form.reason,
        });
        toast.success("Reschedule sent for approval with a preview of the new schedule.");
      }
      toast.success("Saved.");
      setCreateOpen(false);
      await load();
      if (
        accountDetail &&
        form.account_id &&
        rowId(accountDetail) === String(form.account_id)
      ) {
        await loadAccountDetail(accountDetail);
      }
    } catch (errorObject) {
      setFormError(
        errorObject instanceof Error ? errorObject.message : "Could not save.",
      );
    } finally {
      setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(() => {
    if (activeTab === "products") {
      return [
        {
          key: "product",
          label: "Product",
          render: (row) => (
            <div className="space-y-0.5">
              <p className="font-medium">{optionLabel(row)}</p>
              <p className="text-xs text-muted-foreground">
                {prettify(
                  readString(
                    row,
                    ["productType", "product_type"],
                    "STAFF_LOAN",
                  ),
                )}
              </p>
            </div>
          ),
        },
        {
          key: "amount",
          label: "Min amount",
          render: (row) =>
            readString(row, ["minimumAmount", "minimum_amount"], "—"),
        },
        {
          key: "term",
          label: "Max term",
          render: (row) =>
            readString(row, ["maximumTermMonths", "maximum_term_months"], "—"),
        },
        {
          key: "capacity",
          label: "Payroll cap",
          render: (row) =>
            `${readString(row, ["maximumInstallmentPercentage", "maximum_installment_percentage"], "0")}%`,
        },
        {
          key: "support",
          label: "Support",
          render: (row) => {
            const documents =
              row.requiredDocumentTypes ?? row.required_document_types;
            const documentCount = Array.isArray(documents)
              ? documents.length
              : 0;
            const approval = asRecord(
              row.approvalConfiguration ?? row.approval_configuration,
            );
            return `${documentCount} docs / ${readString(approval, ["required_guarantors", "requiredGuarantors"], "0")} guarantors`;
          },
        },
        {
          key: "version",
          label: "Version",
          render: (row) =>
            `v${readString(row, ["versionNumber", "version_number"], "1")}${
              readString(row, ["effectiveTo", "effective_to"], "")
                ? ` · to ${readString(row, ["effectiveTo", "effective_to"])}`
                : ""
            }`,
        },
        {
          key: "status",
          label: "Status",
          render: (row) => {
            const status = readString(row, ["status"], "ACTIVE").toUpperCase();
            const tone =
              status === "ACTIVE"
                ? "text-emerald-600 dark:text-emerald-400"
                : status === "RETIRED"
                  ? "text-muted-foreground"
                  : status === "DRAFT"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-primary";

            return (
              <span className={`inline-flex items-center gap-2 text-sm font-medium ${tone}`}>
                <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                {prettify(status)}
              </span>
            );
          },
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => {
            const locked = Boolean(row.isLocked ?? row.is_locked);
            const retired = readString(row, ["status"]) === "RETIRED";
            return (
              <div className="flex flex-wrap gap-1">
                {!locked && !retired ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={(event) => {
                      event.stopPropagation();
                      openProductForm("product-edit", row);
                    }}
                  >
                    Edit
                  </button>
                ) : null}
                {!retired ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    title="Publish changed terms; existing loans keep their terms"
                    onClick={(event) => {
                      event.stopPropagation();
                      openProductForm("product-version", row);
                    }}
                  >
                    New version
                  </button>
                ) : null}
                {!retired ? (
                  <button
                    type="button"
                    className={actionButtonClass}
                    disabled={busyId === `retire-${rowId(row)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void retireProduct(row);
                    }}
                  >
                    Retire
                  </button>
                ) : null}
              </div>
            );
          },
        },
      ];
    }
    if (activeTab === "accounts") {
      return [
        {
          key: "account",
          label: "Account",
          render: (row) => employeeLabel(row),
        },
        {
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "OPEN")} />
          ),
        },
        {
          key: "balance",
          label: "Balance",
          render: (row) =>
            readString(
              row,
              ["outstandingBalance", "outstanding_balance", "balance"],
              "—",
            ),
        },
        {
          key: "actions",
          label: "Actions",
          render: (row) => (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openAccountAction("disburse", row);
                }}
              >
                Disburse
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openAccountAction("repay", row);
                }}
              >
                Repay
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  openAccountAction("reschedule", row);
                }}
              >
                Reschedule
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `quote-${rowId(row)}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void quoteAccount(row);
                }}
              >
                Quote
              </button>
            </div>
          ),
        },
      ];
    }
    return [
      {
        key: "app",
        label: "Application",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">{employeeLabel(row)}</p>
            <p className="text-xs text-muted-foreground">
              {readString(row, ["purpose"], optionLabel(row))}
            </p>
          </div>
        ),
      },
      {
        key: "amount",
        label: "Amount",
        render: (row) =>
          readString(row, ["requestedAmount", "requested_amount"], "—"),
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
          const id = rowId(row);
          const action = currentStageAction(row);
          if (!action) return null;
          return (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `${action}-${id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void actOnApplication(row, action);
                }}
              >
                {STAGE_LABEL[action]}
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  setDecisionTarget({ row, decision: "RETURNED" });
                }}
              >
                Return
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={(event) => {
                  event.stopPropagation();
                  setDecisionTarget({ row, decision: "REJECTED" });
                }}
              >
                Reject
              </button>
            </div>
          );
        },
      },
    ];
    // openProductForm and retireProduct only read state through setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, actOnApplication, busyId, openAccountAction, quoteAccount]);

  const requiredApplicationDocuments =
    requiredDocumentsFromApplication(applicationDetail);
  const requiredApplicationGuarantors =
    requiredGuarantorCountFromApplication(applicationDetail);
  const verifiedDocumentTypes = new Set(
    applicationDocuments
      .filter(
        (document) =>
          readString(document, ["status"], "").toUpperCase() === "VERIFIED",
      )
      .map((document) =>
        readString(
          document,
          ["documentType", "document_type"],
          "",
        ).toUpperCase(),
      )
      .filter(Boolean),
  );
  const missingVerifiedDocuments = requiredApplicationDocuments.filter(
    (documentType) => !verifiedDocumentTypes.has(documentType.toUpperCase()),
  );
  const approvedGuarantors = applicationGuarantors.filter(
    (guarantor) =>
      readString(guarantor, ["status"], "").toUpperCase() === "APPROVED",
  );
  const supportReady =
    missingVerifiedDocuments.length === 0 &&
    approvedGuarantors.length >= requiredApplicationGuarantors;
  const sanctionContent = readString(sanctionLetter, ["content"], "");
  const statementAccount = asRecord(accountStatement?.account) ?? accountDetail;
  const accountInstallments = statementArray(accountStatement, "installments");
  const accountLedger = statementArray(accountStatement, "ledger");
  const accountDisbursements = statementArray(
    accountStatement,
    "disbursements",
  );
  const accountRepayments = statementArray(accountStatement, "repayments");
  const accountDeferments = statementArray(accountStatement, "deferments");
  const accountReschedules = statementArray(accountStatement, "reschedules");
  const accountSettlementQuotes = statementArray(
    accountStatement,
    "settlementQuotes",
  );
  const installmentScheduledTotal = sumRecordAmounts(accountInstallments, [
    "totalDue",
    "total_due",
  ]);
  const installmentPaidTotal = sumRecordAmounts(accountInstallments, [
    "paidAmount",
    "paid_amount",
  ]);
  const ledgerCreditTotal = sumRecordAmounts(
    accountLedger.filter(
      (entry) => readString(entry, ["direction"]).toUpperCase() === "CREDIT",
    ),
    ["totalAmount", "total_amount"],
  );
  const ledgerDebitTotal = sumRecordAmounts(
    accountLedger.filter(
      (entry) => readString(entry, ["direction"]).toUpperCase() === "DEBIT",
    ),
    ["totalAmount", "total_amount"],
  );
  const nextInstallment =
    accountInstallments.find((installment) =>
      ["SCHEDULED", "PARTIALLY_PAID", "OVERDUE"].includes(
        readString(installment, ["status"], "").toUpperCase(),
      ),
    ) ?? null;
  const currentReportRows = reportRows(reportData);
  const reportTotals =
    asRecord(reportData?.totals) ?? asRecord(reportData?.buckets);


  if (!canAccess) return null;

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <div className={`${pageBleedClass} overflow-hidden border-y border-border bg-background`}>
          <div className="relative isolate overflow-hidden border-b border-border bg-card px-5 py-7 text-foreground sm:px-8 sm:py-8"
          >
            <SharedDashboardHeroBackground />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex max-w-2xl items-center gap-5">
                <Wallet24Regular className="size-9 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="h-12 w-px shrink-0 bg-border" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Finance workspace
                  </p>
                  <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                    Staff loans and advances
                  </h1>
                </div>
              </div>
              <Button
                appearance="transparent"
                size="large"
                icon={
                  loading ? (
                    <FluentLoadingIndicator className="size-4 animate-spin" />
                  ) : (
                    <ArrowClockwise20Regular aria-hidden="true" />
                  )
                }
                aria-label="Refresh finance overview"
                title="Refresh"
                className="!min-w-0 !text-foreground hover:!bg-primary/10"
                onClick={() => void load()}
                disabled={loading}
              />
            </div>
          </div>
          {error ? (
            <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="p-4 sm:p-6">
            <div className="grid border-y border-border sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Open accounts",
                  value:
                    readNumber(dashboard, ["open_accounts", "openAccounts"]) ??
                    accounts.length,
                  hint: "Currently being serviced",
                  icon: Wallet24Regular,
                },
                {
                  label: "Applications",
                  value: applications.length,
                  hint: "Across all stages",
                  icon: DocumentBulletList24Regular,
                },
                {
                  label: "Available products",
                  value: products.length,
                  hint: "Ready for employees",
                  icon: AppsList24Regular,
                },
                {
                  label: "Outstanding balance",
                  value: readString(
                    dashboard,
                    ["outstanding", "outstanding_balance"],
                    "—",
                  ),
                  hint: "Across open accounts",
                  icon: Money24Regular,
                },
              ].map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className={`flex min-h-28 items-start gap-4 px-3 py-5 sm:px-5 ${index ? "border-t border-border sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t xl:border-l xl:border-t-0" : ""}`}
                  >
                    <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
              <section className="border-y border-border py-5 xl:pr-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Application pipeline</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Distribution of applications by their current status.
                    </p>
                  </div>
                  <ArrowTrending24Regular className="size-6 shrink-0 text-primary" aria-hidden="true" />
                </div>
                <div className="mt-6">
                  {applications.length ? (
                    <StatusStack items={statusChartItems(applications)} />
                  ) : (
                    <div className="flex min-h-28 flex-col items-center justify-center px-4 text-center">
                      <DocumentBulletList24Regular className="text-muted-foreground" aria-hidden="true" />
                      <p className="mt-2 text-sm font-medium text-foreground">No applications yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">New applications will appear here as they are submitted.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="border-y border-border py-5 xl:pl-5">
                <h2 className="text-base font-semibold text-foreground">Portfolio snapshot</h2>
                <p className="mt-1 text-sm text-muted-foreground">A quick view of finance activity.</p>
                <dl className="mt-5 divide-y divide-border">
                  <div className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <dt className="text-sm text-muted-foreground">Products in catalogue</dt>
                    <dd className="text-sm font-semibold text-foreground">{products.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-sm text-muted-foreground">Applications per product</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {products.length ? (applications.length / products.length).toFixed(1) : "0.0"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
                    <dt className="text-sm text-muted-foreground">Open account ratio</dt>
                    <dd className="text-sm font-semibold text-foreground">
                      {applications.length
                        ? `${Math.round(((readNumber(dashboard, ["open_accounts", "openAccounts"]) ?? accounts.length) / applications.length) * 100)}%`
                        : "0%"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>
      ) : (
        <div className={activeTab === "products" ? `${pageBleedClass} flex flex-col gap-4 border-y border-border bg-muted/20 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7` : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"}>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {activeTab === "products"
                ? "Finance products"
                : activeTab === "accounts"
                  ? "Finance accounts"
                  : activeTab === "reports"
                    ? "Finance reports"
                    : "Applications"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "products"
                ? "Staff loan and salary advance products."
                : activeTab === "reports"
                  ? "Loan reports, exports, and audit timeline."
                  : "Act only on records your permissions allow."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTab === "products" ? (
              <Button
                appearance="subtle"
                icon={loading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <ArrowClockwise20Regular />}
                onClick={() => void load()}
                disabled={loading}
              >
                Refresh
              </Button>
            ) : (
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
            )}
            {activeTab === "products" ? (
              <>
                <Button
                  appearance="secondary"
                  icon={<CheckmarkCircle20Regular />}
                  onClick={() => {
                    const token = readStoredToken();
                    if (!token) return;
                    void evaluateEmployeeFinanceEligibility(token, {
                      employee_id: Number(form.employee_id || 0) || undefined,
                      product_id: Number(rowId(products[0])),
                    })
                      .then(() => toast.success("Eligibility checked."))
                      .catch((errorObject) =>
                        toast.error(
                          errorObject instanceof Error
                            ? errorObject.message
                            : "Could not check eligibility.",
                        ),
                      );
                  }}
                >
                  Check eligibility
                </Button>
                <Button
                  appearance="primary"
                  icon={<Add20Regular />}
                  onClick={() => openProductForm("product", null)}
                >
                  New product
                </Button>
              </>
            ) : null}
            {activeTab === "accounts" ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token) return;
                  void runEmployeeFinanceReconciliation(token)
                    .then(() => toast.success("Reconciliation started."))
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not reconcile.",
                      ),
                    );
                }}
              >
                Reconcile
              </button>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === "reports" ? (
        <div className="space-y-4">
          {reportError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {reportError}
            </div>
          ) : null}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-3 lg:grid-cols-[220px_1fr_auto] lg:items-end">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Report</span>
                <FluentSelect
                  ariaLabel="Report"
                  className="w-full"
                  value={selectedReport}
                  onChange={(value) => { setSelectedReport(value); setReportPage(1); }}
                  options={financeReportTypes}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">From</span>
                  <DateInput
                    value={reportFilters.date_from ?? ""}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        date_from: event.target.value,
                      }))
                    }
                  />
                </label>
                {selectedReport === "outstanding" ? (
                  <label className="grid gap-1.5 text-sm sm:col-span-2">
                    <span className="font-medium">Overdue as of</span>
                    <DateInput value={reportFilters.as_of ?? ""} onChange={(event) => { setReportPage(1); setReportFilters((current) => ({ ...current, as_of: event.target.value })); }} />
                  </label>
                ) : null}
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">To</span>
                  <DateInput
                    value={reportFilters.date_to ?? ""}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        date_to: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void loadReports()}
                  disabled={reportLoading}
                >
                  {reportLoading ? (
                    <FluentLoadingIndicator className="size-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-4" />
                  )}
                  Run
                </button>
                <label className={`${secondaryButtonClass} cursor-pointer`}>
                  {importingPayments ? (
                    <FluentLoadingIndicator className="size-4 animate-spin" />
                  ) : (
                    <UploadIcon className="size-4" />
                  )}
                  Import bank CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importingPayments}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      void importPaymentFile(file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void postAccounting()}
                  disabled={postingAccounting}
                >
                  {postingAccounting ? (
                    <FluentLoadingIndicator className="size-4 animate-spin" />
                  ) : null}
                  Post ERP
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => void exportServerReport("csv")}
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => void exportServerReport("xlsx")}
                >
                  Export Excel
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {reportTotals ? (
              Object.entries(reportTotals)
                .slice(0, 4)
                .map(([key, value]) => (
                  <MetricTile
                    key={key}
                    label={prettify(key)}
                    value={
                      typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "0")
                    }
                  />
                ))
            ) : (
              <>
                <MetricTile label="Rows" value={currentReportRows.length} />
                <MetricTile label="Report" value={prettify(selectedReport)} />
                <MetricTile label="Audit events" value={auditTimeline.length} />
                <MetricTile
                  label="Status"
                  value={reportLoading ? "Loading" : "Ready"}
                />
              </>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ResizableTable
                title={
                  financeReportTypes.find(
                    (report) => report.value === selectedReport,
                  )?.label ?? "Report"
                }
                data={currentReportRows}
                columns={[
                  {
                    key: "primary",
                    label: "Record",
                    render: (row) =>
                      readString(
                        row,
                        [
                          "account_no",
                          "quote_no",
                          "payment_reference",
                          "repayment_id",
                          "disbursement_id",
                        ],
                        rowId(row) || "Record",
                      ),
                  },
                  {
                    key: "amount",
                    label: "Amount",
                    render: (row) =>
                      readString(
                        row,
                        [
                          "outstanding_total",
                          "settlement_amount",
                          "amount",
                          "repayment_total",
                          "overdue_amount",
                        ],
                        "0.00",
                      ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <StatusChip
                        value={readString(
                          row,
                          ["status", "aging_bucket"],
                          "OPEN",
                        )}
                      />
                    ),
                  },
                  {
                    key: "date",
                    label: "Date",
                    render: (row) =>
                      readString(
                        row,
                        ["payment_date", "valid_until", "next_due_date"],
                        "-",
                      ),
                  },
                ]}
                loading={reportLoading}
                itemsPerPage={20}
                showExport={false}
                storageKey={`finance-report-${selectedReport}`}
              />
              {asRecord(reportData?.pagination) ? (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                  <span>{String(asRecord(reportData?.pagination)?.total_rows ?? 0)} rows · page {reportPage} of {String(asRecord(reportData?.pagination)?.total_pages ?? 0)}</span>
                  <div className="flex gap-2">
                    <button type="button" className={secondaryButtonClass} disabled={reportPage <= 1 || reportLoading} onClick={() => setReportPage((page) => Math.max(1, page - 1))}>Previous</button>
                    <button type="button" className={secondaryButtonClass} disabled={reportPage >= Number(asRecord(reportData?.pagination)?.total_pages ?? 0) || reportLoading} onClick={() => setReportPage((page) => page + 1)}>Next</button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-3 py-2">
                <h2 className="text-sm font-semibold">Audit timeline</h2>
              </div>
              <div className="max-h-[560px] divide-y divide-border overflow-auto">
                {auditTimeline.length ? (
                  auditTimeline.map((entry) => (
                    <div key={rowId(entry)} className="px-3 py-3 text-sm">
                      <p className="font-medium">
                        {prettify(readString(entry, ["action"], "Audit event"))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {readString(entry, ["entityType", "entity_type"], "")} #
                        {readString(entry, ["entityId", "entity_id"], "")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {readString(entry, ["createdAt", "created_at"], "")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No audit events found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab !== "overview" && activeTab !== "reports" ? (
        <div className={activeTab === "products" ? `${pageBleedClass} space-y-0` : "space-y-3"}>
          {activeTab === "products" ? (
            <div className="grid border-b border-border bg-background sm:grid-cols-3">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
                <AppsList24Regular className="shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Products</p>
                  <p className="text-lg font-semibold text-foreground">{products.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:border-b-0 sm:border-r sm:px-7">
                <CheckmarkCircle20Regular className="size-6 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active</p>
                  <p className="text-lg font-semibold text-foreground">
                    {products.filter((product) => readString(product, ["status"], "ACTIVE") === "ACTIVE").length}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-4 sm:px-7">
                <DocumentBulletList24Regular className="shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Product types</p>
                  <p className="text-lg font-semibold text-foreground">
                    {new Set(products.map((product) => readString(product, ["productType", "product_type"], "STAFF_LOAN"))).size}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div className={activeTab === "products" ? "flex items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 sm:px-7" : undefined}>
            <SearchToggleField
              value={search}
              onChange={setSearch}
              placeholder={activeTab === "products" ? "Search finance products" : "Search"}
              label={activeTab === "products" ? "Search finance products" : "Search"}
            />
            {activeTab === "products" ? (
              <span className="text-xs text-muted-foreground">{visible.length} shown</span>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className={activeTab === "products" ? "overflow-hidden bg-background" : "overflow-hidden rounded-xl border border-border bg-card"}>
            <ResizableTable
              title={activeTab === "products" ? "Finance products" : "Finance records"}
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              showToolbar={activeTab !== "products"}
              frameClassName={activeTab === "products" ? "!rounded-none !border-x-0 !shadow-none" : undefined}
              storageKey={`finance-${activeTab}`}
              onRowSelect={(_, row) => {
                if (!row) return;
                if (activeTab === "applications") {
                  void loadApplicationDetail(row);
                  return;
                }
                if (activeTab === "accounts") {
                  void loadAccountDetail(row);
                  return;
                }
                setDetail(row);
              }}
            />
          </div>
        </div>
      ) : null}

      <RecordDetailsDialog
        open={Boolean(detail)}
        onOpenChange={(open) => !open && setDetail(null)}
        title={optionLabel(detail)}
        row={detail}
      />

      <Dialog
        open={Boolean(applicationDetail)}
        onOpenChange={(open) => {
          if (!open) {
            setApplicationDetail(null);
            setApplicationDocuments([]);
            setApplicationGuarantors([]);
            setSanctionLetter(null);
            setApplicationError(null);
          }
        }}
      >
        <DialogPopup className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {applicationDetail
                ? `Application ${readString(applicationDetail, ["applicationNo", "application_no"], rowId(applicationDetail))}`
                : "Application"}
            </DialogTitle>
            <DialogDescription>
              Review supporting records, verify documents, approve stages, and
              inspect the sanction letter.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            {applicationError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {applicationError}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-4">
              <MetricTile
                label="Requested"
                value={readString(
                  applicationDetail,
                  ["requestedAmount", "requested_amount"],
                  "0.00",
                )}
              />
              <MetricTile
                label="Term"
                value={`${readString(applicationDetail, ["requestedTermMonths", "requested_term_months"], "0")} months`}
              />
              <MetricTile
                label="Status"
                value={
                  <StatusChip
                    value={readString(applicationDetail, ["status"], "DRAFT")}
                  />
                }
              />
              <MetricTile
                label="Support"
                value={supportReady ? "Ready" : "Pending"}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">Documents</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {applicationLoading ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                        <FluentLoadingIndicator className="size-4 animate-spin" /> Loading
                        documents
                      </div>
                    ) : applicationDocuments.length ? (
                      applicationDocuments.map((document) => {
                        const id = rowId(document);
                        const status = readString(
                          document,
                          ["status"],
                          "UPLOADED",
                        ).toUpperCase();
                        return (
                          <div
                            key={id}
                            className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div>
                              <p className="font-medium">
                                {prettify(
                                  readString(
                                    document,
                                    ["documentType", "document_type"],
                                    "Document",
                                  ),
                                )}
                              </p>
                              <p className="break-all text-xs text-muted-foreground">
                                {readString(
                                  document,
                                  ["fileUrl", "file_url"],
                                  readString(
                                    document,
                                    ["documentId", "document_id"],
                                    "No file reference",
                                  ),
                                )}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <StatusChip value={status} />
                              <button
                                type="button"
                                className={actionButtonClass}
                                disabled={busyId === `doc-VERIFIED-${id}`}
                                onClick={() =>
                                  void decideDocument(document, "VERIFIED")
                                }
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                className={actionButtonClass}
                                disabled={busyId === `doc-REJECTED-${id}`}
                                onClick={() =>
                                  void decideDocument(document, "REJECTED")
                                }
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No documents attached.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">Guarantors</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {applicationGuarantors.length ? (
                      applicationGuarantors.map((guarantor) => {
                        const id = rowId(guarantor);
                        const snapshot = asRecord(guarantor.snapshot);
                        return (
                          <div
                            key={id}
                            className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
                          >
                            <div>
                              <p className="font-medium">
                                {readString(
                                  snapshot,
                                  ["full_name"],
                                  `Employee ${readString(guarantor, ["guarantorEmployeeId", "guarantor_employee_id"], "")}`,
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {readString(snapshot, ["employee_no"], "")}
                              </p>
                            </div>
                            <StatusChip
                              value={readString(
                                guarantor,
                                ["status"],
                                "PENDING",
                              )}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No guarantors attached.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <h3 className="font-semibold">Approval readiness</h3>
                  <div className="mt-3 grid gap-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Required docs
                      </span>
                      <span className="font-medium">
                        {requiredApplicationDocuments.length}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Missing verified
                      </span>
                      <span className="font-medium">
                        {missingVerifiedDocuments.length}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Guarantors</span>
                      <span className="font-medium">
                        {approvedGuarantors.length}/
                        {requiredApplicationGuarantors}
                      </span>
                    </div>
                  </div>
                  {missingVerifiedDocuments.length ? (
                    <p className="mt-3 text-xs text-amber-700">
                      Missing:{" "}
                      {missingVerifiedDocuments.map(prettify).join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <h3 className="text-sm font-semibold">Stage actions</h3>
                  {(() => {
                    const action = currentStageAction(applicationDetail);
                    const route = Array.isArray(approvalHistory?.approval_route)
                      ? approvalHistory.approval_route.map(String)
                      : [];
                    const isFinal =
                      action !== null && route[route.length - 1] === STAGE_CODE[action];
                    if (!action || !applicationDetail) {
                      return (
                        <p className="mt-3 text-sm text-muted-foreground">
                          No approval is waiting at this status.
                        </p>
                      );
                    }
                    return (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={actionButtonClass}
                          disabled={
                            busyId === `${action}-${rowId(applicationDetail)}` ||
                            (isFinal && !supportReady)
                          }
                          title={isFinal && !supportReady ? "Verify documents and guarantors first" : undefined}
                          onClick={() => void actOnApplication(applicationDetail, action)}
                        >
                          {STAGE_LABEL[action]}
                        </button>
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={() =>
                            setDecisionTarget({ row: applicationDetail, decision: "RETURNED" })
                          }
                        >
                          Return for correction
                        </button>
                        <button
                          type="button"
                          className={actionButtonClass}
                          onClick={() =>
                            setDecisionTarget({ row: applicationDetail, decision: "REJECTED" })
                          }
                        >
                          Reject
                        </button>
                      </div>
                    );
                  })()}
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <h3 className="text-sm font-semibold">Approval route</h3>
                  {approvalHistory ? (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {(Array.isArray(approvalHistory.approval_route)
                          ? approvalHistory.approval_route.map(String)
                          : []
                        )
                          .map(prettify)
                          .join(" → ")}{" "}
                        · cycle {readString(approvalHistory, ["approval_cycle"], "1")}
                        {Number(approvalHistory.escalation_level ?? 0) > 0
                          ? ` · escalated (level ${String(approvalHistory.escalation_level)})`
                          : ""}
                      </p>
                      {readString(approvalHistory, ["decision_comments"], "") ? (
                        <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                          Last comment: {readString(approvalHistory, ["decision_comments"])}
                        </p>
                      ) : null}
                      <ul className="divide-y divide-border">
                        {(Array.isArray(approvalHistory.approvals)
                          ? (approvalHistory.approvals as AdminRecord[])
                          : []
                        ).map((item) => (
                          <li key={rowId(item)} className="py-1.5 text-xs">
                            <span className="font-medium">
                              {prettify(readString(item, ["stage"]))}: {prettify(readString(item, ["decision"]))}
                            </span>{" "}
                            <span className="text-muted-foreground">
                              cycle {readString(item, ["approvalCycle", "approval_cycle"], "1")} · user{" "}
                              {readString(item, ["createdByCompanyUserId", "created_by_company_user_id"])}
                              {readString(item, ["onBehalfOfCompanyUserId", "on_behalf_of_company_user_id"], "")
                                ? ` for ${readString(item, ["onBehalfOfCompanyUserId", "on_behalf_of_company_user_id"])}`
                                : ""}
                            </span>
                            {readString(item, ["comments"], "") ? (
                              <p className="text-muted-foreground">{readString(item, ["comments"])}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No history loaded.</p>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Sanction letter</h3>
                    <div className="flex items-center gap-2">
                      {sanctionLetter ? (
                        <>
                          <StatusChip
                            value={
                              readString(sanctionLetter, ["acceptedAt", "accepted_at"], "")
                                ? "ACCEPTED"
                                : "GENERATED"
                            }
                          />
                          <button
                            type="button"
                            className={actionButtonClass}
                            onClick={() => void downloadSanctionLetter(applicationDetail)}
                          >
                            PDF
                          </button>
                        </>
                      ) : (
                        <StatusChip value="PENDING" />
                      )}
                    </div>
                  </div>
                  {sanctionContent ? (
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed text-foreground">
                      {sanctionContent}
                    </pre>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Generated after final finance approval.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() =>
                applicationDetail &&
                void loadApplicationDetail(applicationDetail)
              }
              disabled={!applicationDetail || applicationLoading}
            >
              {applicationLoading ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => setApplicationDetail(null)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(accountDetail)}
        onOpenChange={(open) => {
          if (!open) {
            setAccountDetail(null);
            setAccountStatement(null);
            setAccountError(null);
          }
        }}
      >
        <DialogPopup className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {statementAccount
                ? `Account ${readString(statementAccount, ["accountNo", "account_no"], rowId(statementAccount))}`
                : "Finance account"}
            </DialogTitle>
            <DialogDescription>
              Review schedule, ledger, disbursements, repayments, restructures,
              and settlement quotes.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
            {accountError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {accountError}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-4">
              <MetricTile
                label="Outstanding"
                value={readString(
                  statementAccount,
                  [
                    "outstandingTotal",
                    "outstanding_total",
                    "outstandingBalance",
                    "outstanding_balance",
                  ],
                  "0.00",
                )}
              />
              <MetricTile
                label="Installment"
                value={readString(
                  statementAccount,
                  [
                    "scheduledMonthlyInstallment",
                    "scheduled_monthly_installment",
                  ],
                  "0.00",
                )}
              />
              <MetricTile
                label="Term"
                value={`${readString(statementAccount, ["termMonths", "term_months"], "0")} months`}
              />
              <MetricTile
                label="Status"
                value={
                  <StatusChip
                    value={readString(statementAccount, ["status"], "OPEN")}
                  />
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricTile
                label="Scheduled"
                value={installmentScheduledTotal.toFixed(2)}
              />
              <MetricTile
                label="Paid schedule"
                value={installmentPaidTotal.toFixed(2)}
              />
              <MetricTile
                label="Ledger debits"
                value={ledgerDebitTotal.toFixed(2)}
              />
              <MetricTile
                label="Ledger credits"
                value={ledgerCreditTotal.toFixed(2)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={!accountDetail}
                onClick={() => void downloadStatement("pdf")}
              >
                Statement PDF
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={!accountDetail}
                onClick={() => void downloadStatement("xlsx")}
              >
                Statement Excel
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  accountDetail && openAccountAction("disburse", accountDetail)
                }
              >
                Disburse
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  accountDetail && openAccountAction("repay", accountDetail)
                }
              >
                Record repayment
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  accountDetail &&
                  nextInstallment &&
                  openAccountAction("defer", accountDetail, {
                    installment_id: rowId(nextInstallment),
                  })
                }
                disabled={!nextInstallment}
              >
                Defer next due
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  accountDetail &&
                  openAccountAction("reschedule", accountDetail)
                }
              >
                Reschedule
              </button>
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() =>
                  accountDetail &&
                  openAccountAction("adjust", accountDetail, {
                    adjustment_type: "PENALTY",
                  })
                }
              >
                Penalty / waiver / write-off
              </button>
              <button
                type="button"
                className={primaryButtonClass}
                disabled={
                  !accountDetail || busyId === `quote-${rowId(accountDetail)}`
                }
                onClick={() =>
                  accountDetail && void quoteAccount(accountDetail)
                }
              >
                Quote settlement
              </button>
              {accountSettlementQuotes[0] &&
              readString(accountSettlementQuotes[0], ["status"], "") === "OPEN" ? (
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() =>
                    accountDetail &&
                    openAccountAction("settle", accountDetail, {
                      quote_id: rowId(accountSettlementQuotes[0]),
                    })
                  }
                >
                  Record payoff of{" "}
                  {readString(accountSettlementQuotes[0], ["settlementAmount", "settlement_amount"])}
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">
                      Installment schedule
                    </h3>
                    {accountLoading ? (
                      <FluentLoadingIndicator className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <StandardTable className="w-full text-left text-sm">
                      <StandardTableHeader className="sticky top-0 bg-muted text-xs text-muted-foreground">
                        <StandardTableRow>
                          <StandardTableHead className="px-3 py-2">#</StandardTableHead>
                          <StandardTableHead className="px-3 py-2">Due</StandardTableHead>
                          <StandardTableHead className="px-3 py-2">Amount</StandardTableHead>
                          <StandardTableHead className="px-3 py-2">Paid</StandardTableHead>
                          <StandardTableHead className="px-3 py-2">Status</StandardTableHead>
                          <StandardTableHead className="px-3 py-2">Action</StandardTableHead>
                        </StandardTableRow>
                      </StandardTableHeader>
                      <StandardTableBody className="divide-y divide-border">
                        {accountInstallments.length ? (
                          accountInstallments.map((installment) => {
                            const id = rowId(installment);
                            const status = readString(
                              installment,
                              ["status"],
                              "SCHEDULED",
                            ).toUpperCase();
                            return (
                              <StandardTableRow key={id}>
                                <StandardTableCell className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["installmentNumber", "installment_number"],
                                    id,
                                  )}
                                </StandardTableCell>
                                <StandardTableCell className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["dueDate", "due_date"],
                                    "",
                                  )}
                                </StandardTableCell>
                                <StandardTableCell className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["totalDue", "total_due"],
                                    "0.00",
                                  )}
                                </StandardTableCell>
                                <StandardTableCell className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["paidAmount", "paid_amount"],
                                    "0.00",
                                  )}
                                </StandardTableCell>
                                <StandardTableCell className="px-3 py-2">
                                  <StatusChip value={status} />
                                </StandardTableCell>
                                <StandardTableCell className="px-3 py-2">
                                  <button
                                    type="button"
                                    className={actionButtonClass}
                                    disabled={
                                      !accountDetail || status === "PAID"
                                    }
                                    onClick={() =>
                                      accountDetail &&
                                      openAccountAction(
                                        "defer",
                                        accountDetail,
                                        { installment_id: id },
                                      )
                                    }
                                  >
                                    Defer
                                  </button>
                                </StandardTableCell>
                              </StandardTableRow>
                            );
                          })
                        ) : (
                          <StandardTableRow>
                            <StandardTableCell
                              className="px-3 py-4 text-muted-foreground"
                              colSpan={6}
                            >
                              No installment schedule found.
                            </StandardTableCell>
                          </StandardTableRow>
                        )}
                      </StandardTableBody>
                    </StandardTable>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">Ledger</h3>
                  </div>
                  <div className="max-h-72 overflow-auto divide-y divide-border">
                    {accountLedger.length ? (
                      accountLedger.map((entry) => (
                        <div
                          key={rowId(entry)}
                          className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]"
                        >
                          <div>
                            <p className="font-medium">
                              {prettify(
                                readString(
                                  entry,
                                  ["entryType", "entry_type"],
                                  "Entry",
                                ),
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {readString(
                                entry,
                                ["effectiveDate", "effective_date"],
                                "",
                              )}{" "}
                              ·{" "}
                              {readString(
                                entry,
                                ["sourceType", "source_type"],
                                "",
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {readString(
                                entry,
                                ["totalAmount", "total_amount"],
                                "0.00",
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {readString(entry, ["direction"], "")}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No ledger entries posted.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">Disbursements</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {accountDisbursements.length ? (
                      accountDisbursements.map((item) => {
                        const id = rowId(item);
                        const auditSummary = makerCheckerSummary(item, true);
                        return (
                          <div key={id} className="space-y-2 px-3 py-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {readString(item, ["amount"], "0.00")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {readString(
                                    item,
                                    ["paymentReference", "payment_reference"],
                                    "",
                                  )}
                                </p>
                              </div>
                              <StatusChip
                                value={readString(item, ["status"], "PENDING")}
                              />
                            </div>
                            {auditSummary.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {auditSummary.map((entry) => (
                                  <span
                                    key={entry}
                                    className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                                  >
                                    {entry}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className={actionButtonClass}
                                disabled={busyId === `disb-approve-${id}`}
                                onClick={() =>
                                  void actOnDisbursement(item, "approve")
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className={actionButtonClass}
                                disabled={busyId === `disb-confirm-${id}`}
                                onClick={() =>
                                  void actOnDisbursement(item, "confirm")
                                }
                              >
                                Confirm
                              </button>
                              {["PENDING_APPROVAL", "APPROVED"].includes(
                                readString(item, ["status"], "").toUpperCase(),
                              ) ? (
                                <button
                                  type="button"
                                  className={actionButtonClass}
                                  disabled={busyId === `disb-cancel-${id}`}
                                  onClick={async () => {
                                    const accessToken = readStoredToken();
                                    if (!accessToken || !accountDetail) return;
                                    setBusyId(`disb-cancel-${id}`);
                                    try {
                                      await cancelEmployeeFinanceDisbursement(accessToken, id);
                                      toast.success("Disbursement cancelled.");
                                      await loadAccountDetail(accountDetail);
                                    } catch (errorObject) {
                                      toast.error(
                                        errorObject instanceof Error
                                          ? errorObject.message
                                          : "Could not cancel.",
                                      );
                                    } finally {
                                      setBusyId("");
                                    }
                                  }}
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No disbursements recorded.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card">
                  <div className="border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">Repayments</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {accountRepayments.length ? (
                      accountRepayments.map((item) => {
                        const id = rowId(item);
                        const auditSummary = makerCheckerSummary(item);
                        return (
                          <div key={id} className="space-y-2 px-3 py-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {readString(item, ["amount"], "0.00")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {readString(
                                    item,
                                    ["paymentDate", "payment_date"],
                                    "",
                                  )}
                                </p>
                              </div>
                              <StatusChip
                                value={readString(item, ["status"], "DRAFT")}
                              />
                            </div>
                            {auditSummary.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {auditSummary.map((entry) => (
                                  <span
                                    key={entry}
                                    className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                                  >
                                    {entry}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <button
                              type="button"
                              className={actionButtonClass}
                              disabled={busyId === `repay-approve-${id}`}
                              onClick={() => void approveRepayment(item)}
                            >
                              Approve
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No repayments recorded.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <h3 className="text-sm font-semibold">Restructure history</h3>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Deferments</span>
                      <span className="font-medium">
                        {accountDeferments.length}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Reschedules</span>
                      <span className="font-medium">
                        {accountReschedules.length}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Settlement quotes
                      </span>
                      <span className="font-medium">
                        {accountSettlementQuotes.length}
                      </span>
                    </div>
                  </div>
                  {accountSettlementQuotes[0] ? (
                    <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                      <p className="font-medium">
                        {readString(
                          accountSettlementQuotes[0],
                          ["settlementAmount", "settlement_amount"],
                          "0.00",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valid until{" "}
                        {readString(
                          accountSettlementQuotes[0],
                          ["validUntil", "valid_until"],
                          "",
                        )}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() =>
                accountDetail && void loadAccountDetail(accountDetail)
              }
              disabled={!accountDetail || accountLoading}
            >
              {accountLoading ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="size-4" />
              )}
              Refresh
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => setAccountDetail(null)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {(
                {
                  product: "New product",
                  "product-edit": "Edit product",
                  "product-version": "New product version",
                  disburse: "Disburse",
                  repay: "Repayment",
                  defer: "Request deferment",
                  reschedule: "Request reschedule",
                  adjust: "Penalty, waiver, or write-off",
                  settle: "Record early settlement payment",
                } as const
              )[createMode]}
            </DialogTitle>
            <DialogDescription>
              {createMode === "product-version"
                ? "Changed terms apply to applications from the effective date. Loans already granted keep their terms."
                : createMode === "adjust" ||
                    createMode === "defer" ||
                    createMode === "reschedule" ||
                    createMode === "settle"
                  ? "This creates a request that a second Finance user must approve."
                  : "Save this finance record for the employee."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            {createMode === "adjust" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Adjustment type"
                    className="w-full"
                    value={form.adjustment_type ?? "PENALTY"}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, adjustment_type: value }))
                    }
                    options={[
                      { value: "PENALTY", label: "Late-payment penalty" },
                      { value: "INTEREST_WAIVER", label: "Waive interest" },
                      { value: "FEE_WAIVER", label: "Waive fees" },
                      { value: "WRITE_OFF", label: "Write off the remaining balance" },
                    ]}
                  />
                </label>
                {form.adjustment_type !== "WRITE_OFF" ? (
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Amount</span>
                    <Input
                      value={form.amount ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, amount: event.target.value }))
                      }
                    />
                  </label>
                ) : null}
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Reason</span>
                  <Textarea
                    value={form.reason ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, reason: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}
            {createMode === "settle" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Bank payment reference</span>
                  <Input
                    value={form.payment_reference ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, payment_reference: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Payment date</span>
                  <DateInput
                    value={form.payment_date ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, payment_date: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}
            {createMode === "product" ||
            createMode === "product-edit" ||
            createMode === "product-version" ? (
              <>
                <FluentSelect
                  label="Type"
                  ariaLabel="Type"
                  className="w-full"
                  value={form.product_type ?? "STAFF_LOAN"}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, product_type: value }))
                  }
                  options={[
                    { value: "STAFF_LOAN", label: "Staff loan" },
                    { value: "SALARY_ADVANCE", label: "Salary advance" },
                  ]}
                />
                <FinanceInputField
                  label="Code"
                  disabled={createMode === "product-version"}
                  value={form.code ?? ""}
                  onValueChange={(value) => setForm((current) => ({ ...current, code: value }))}
                />
                <FinanceInputField
                  label="Name"
                  value={form.name ?? ""}
                  onValueChange={(value) => setForm((current) => ({ ...current, name: value }))}
                />
                <Field label="Description">
                  <Textarea
                    resize="vertical"
                    className="min-h-24"
                    value={form.description ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Interest method</span>
                    <FluentSelect
                      ariaLabel="Interest method"
                      className="w-full"
                      value={form.interest_method ?? "ZERO_INTEREST"}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          interest_method: value,
                        }))
                      }
                      options={[
                        { value: "ZERO_INTEREST", label: "Zero interest" },
                        { value: "FLAT_RATE", label: "Flat rate" },
                        { value: "REDUCING_BALANCE", label: "Reducing balance" },
                      ]}
                    />
                  </label>
                  <FinanceInputField
                    label="Annual interest %"
                    type="number"
                    value={form.annual_interest_rate ?? ""}
                    onValueChange={(value) => setForm((current) => ({ ...current, annual_interest_rate: value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Processing fee</span>
                    <FluentSelect
                      ariaLabel="Processing fee"
                      className="w-full"
                      value={form.processing_fee_method ?? "NONE"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, processing_fee_method: value }))
                      }
                      options={[
                        { value: "NONE", label: "No fee" },
                        { value: "FLAT", label: "Flat amount" },
                        { value: "PERCENT", label: "Percent of loan" },
                      ]}
                    />
                  </label>
                  <FinanceInputField
                    label="Fee value"
                    type="number"
                    disabled={(form.processing_fee_method ?? "NONE") === "NONE"}
                    value={form.processing_fee_value ?? ""}
                    onValueChange={(value) => setForm((current) => ({ ...current, processing_fee_value: value }))}
                  />
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Late-payment penalty</span>
                    <FluentSelect
                      ariaLabel="Late-payment penalty"
                      className="w-full"
                      value={form.penalty_method ?? "NONE"}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, penalty_method: value }))
                      }
                      options={[
                        { value: "NONE", label: "No penalty" },
                        { value: "FLAT", label: "Flat amount per overdue instalment" },
                        { value: "PERCENT_OF_OVERDUE", label: "Percent of overdue amount" },
                      ]}
                    />
                  </label>
                  <FinanceInputField
                    label="Penalty value"
                    type="number"
                    disabled={(form.penalty_method ?? "NONE") === "NONE"}
                    value={form.penalty_value ?? ""}
                    onValueChange={(value) => setForm((current) => ({ ...current, penalty_value: value }))}
                  />
                </div>
                <div className="grid gap-2 rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Approval stages by amount</span>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Add20Regular />}
                      onClick={() =>
                        setTiers((current) => [
                          ...current,
                          { minimum_amount: "0", maximum_amount: "", stages: ["MANAGER", "HR", "FINANCE"] },
                        ])
                      }
                    >
                      Add tier
                    </Button>
                  </div>
                  {tiers.length ? null : (
                    <p className="text-xs text-muted-foreground">
                      No tiers: every application goes Manager → HR → Finance.
                    </p>
                  )}
                  {tiers.map((tier, index) => (
                    <div key={index} className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[1fr_1fr_auto]">
                      <FinanceInputField
                        label="From amount"
                        type="number"
                        placeholder="From amount"
                        value={tier.minimum_amount}
                        onValueChange={(value) =>
                          setTiers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, minimum_amount: value } : item,
                            ),
                          )
                        }
                      />
                      <FinanceInputField
                        label="To amount"
                        type="number"
                        placeholder="To amount (blank = no limit)"
                        value={tier.maximum_amount}
                        onValueChange={(value) =>
                          setTiers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, maximum_amount: value } : item,
                            ),
                          )
                        }
                      />
                      <Button
                        appearance="subtle"
                        size="small"
                        onClick={() =>
                          setTiers((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        Remove
                      </Button>
                      <div className="flex flex-wrap gap-3 sm:col-span-3">
                        {["MANAGER", "HR", "FINANCE", "MANAGEMENT"].map((stage) => (
                          <Checkbox
                              key={stage}
                              label={prettify(stage)}
                              className="text-xs"
                              checked={tier.stages.includes(stage)}
                              onChange={(_event, data) =>
                                setTiers((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          stages: data.checked
                                            ? [...item.stages, stage]
                                            : item.stages.filter((value) => value !== stage),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ["minimum_amount", "Minimum amount"],
                    ["maximum_amount", "Maximum amount"],
                    ["minimum_term_months", "Minimum term (months)"],
                    ["maximum_term_months", "Maximum term (months)"],
                    ["maximum_salary_multiple", "Max salary multiple"],
                    ["maximum_installment_percentage", "Max installment %"],
                    ["minimum_service_months", "Minimum service months"],
                    ["maximum_active_accounts", "Max active accounts"],
                  ] as const).map(([key, label]) => (
                    <FinanceInputField
                      key={key}
                      label={label}
                      type="number"
                      value={form[key] ?? ""}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, [key]: value }))
                      }
                    />
                  ))}
                </div>
                <FinanceInputField
                  label="Required document types"
                  placeholder="PAYSLIP, ID_COPY"
                  value={form.required_document_types ?? ""}
                  onValueChange={(value) => setForm((current) => ({ ...current, required_document_types: value }))}
                />
                <FinanceInputField
                  label="Required guarantors"
                  type="number"
                  value={form.required_guarantors ?? ""}
                  onValueChange={(value) => setForm((current) => ({ ...current, required_guarantors: value }))}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["requires_confirmation", "Requires employee confirmation"],
                    ["allow_during_probation", "Allow during probation"],
                    ["allow_rescheduling", "Allow rescheduling"],
                    ["allow_deferment", "Allow deferment"],
                    ["allow_early_settlement", "Allow early settlement"],
                    [
                      "allow_additional_repayment",
                      "Allow additional repayment",
                    ],
                  ].map(([key, label]) => (
                    <Checkbox
                      key={key}
                      label={label}
                        checked={
                          (form[key] ??
                            (key.startsWith("allow_") ? "true" : "false")) ===
                          "true"
                        }
                        onChange={(_event, data) =>
                          setForm((current) => ({
                            ...current,
                            [key]: data.checked ? "true" : "false",
                          }))
                        }
                    />
                  ))}
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Effective from</span>
                  <DateInput
                    value={form.effective_from ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        effective_from: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}
            {createMode === "disburse" || createMode === "repay" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Amount</span>
                  <Input
                    value={form.amount ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Payment date</span>
                  <DateInput
                    value={form.payment_date ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        payment_date: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Reference</span>
                  <Input
                    value={form.payment_reference ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        payment_reference: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}
            {createMode === "reschedule" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">New term (months)</span>
                  <Input
                    value={form.new_term_months ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        new_term_months: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Reason</span>
                  <Textarea
                    value={form.reason ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}
            {createMode === "defer" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Installment ID</span>
                  <Input
                    value={form.installment_id ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        installment_id: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Reason</span>
                  <Textarea
                    value={form.reason ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}
            {formError ? (
              <p className="text-sm text-rose-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              appearance="secondary"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={() => void onSave()}
              disabled={saving}
            >
              {saving ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionTarget(null);
            setDecisionComments("");
          }
        }}
      >
        <DialogPopup className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.decision === "RETURNED"
                ? "Return for correction"
                : "Reject application"}
            </DialogTitle>
            <DialogDescription>
              {decisionTarget?.decision === "RETURNED"
                ? "The employee can change the application and submit it again; it then restarts the approval route."
                : "The application is closed. The employee will see your reason."}
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Reason for the employee</span>
            <Textarea
              value={decisionComments}
              onChange={(event) => setDecisionComments(event.target.value)}
            />
          </label>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setDecisionTarget(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={decisionComments.trim().length < 3 || busyId.startsWith("decision-")}
              onClick={() => void submitApplicationDecision()}
            >
              Confirm
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
