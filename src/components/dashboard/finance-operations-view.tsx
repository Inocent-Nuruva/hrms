"use client";

import * as React from "react";
import { Loader2Icon, PlusIcon, RefreshCwIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { RecordDetailsDialog } from "@/components/dashboard/admin-view-shared";
import {
  HeroBand,
  MetricTile,
  StatusChip,
  StatusStack,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  employeeLabel,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  statusChartItems,
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

function csvValue(value: unknown) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: AdminRecord[]) {
  if (rows.length === 0) return "";
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  return [
    keys.map(csvValue).join(","),
    ...rows.map((row) => keys.map((key) => csvValue(row[key])).join(",")),
  ].join("\n");
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const financeReportTypes = [
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

function csvCell(value: unknown) {
  const text =
    typeof value === "object" && value !== null
      ? JSON.stringify(value)
      : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadReportCsv(report: AdminRecord | null) {
  const rows = reportRows(report);
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvCell(row[header])).join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `employee-finance-${readString(report, ["reportType", "report_type"], "report")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  const [reportData, setReportData] = React.useState<AdminRecord | null>(null);
  const [auditTimeline, setAuditTimeline] = React.useState<AdminRecord[]>([]);
  const [reportLoading, setReportLoading] = React.useState(false);
  const [reportError, setReportError] = React.useState<string | null>(null);
  const [importingPayments, setImportingPayments] = React.useState(false);
  const [postingAccounting, setPostingAccounting] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createMode, setCreateMode] = React.useState<
    "product" | "disburse" | "repay" | "defer" | "reschedule"
  >("product");
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
      };
      const [report, audit] = await Promise.all([
        getEmployeeFinanceReport(token, selectedReport, params),
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
  }, [reportFilters.date_from, reportFilters.date_to, selectedReport]);

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
    const [documentsResult, guarantorsResult, sanctionResult] =
      await Promise.allSettled([
        listEmployeeFinanceApplicationDocuments(token, id),
        listEmployeeFinanceApplicationGuarantors(token, id),
        getEmployeeFinanceSanctionLetter(token, id),
      ]);
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
    async (row: AdminRecord, action: "recommend" | "hr" | "finance") => {
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
      mode: "disburse" | "repay" | "defer" | "reschedule",
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
      if (createMode === "product") {
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
        await createEmployeeFinanceProduct(token, {
          product_type: form.product_type || "STAFF_LOAN",
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          interest_method: form.interest_method || undefined,
          annual_interest_rate: form.annual_interest_rate || undefined,
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
          approval_configuration: {
            required_guarantors: optionalNumber(form.required_guarantors) ?? 0,
          },
          effective_from: form.effective_from,
        });
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
      } else if (createMode === "reschedule") {
        if (!form.account_id || !form.new_term_months || !form.reason)
          throw new Error("New term and reason are required.");
        await requestEmployeeFinanceReschedule(token, form.account_id, {
          new_term_months: Number(form.new_term_months),
          reason: form.reason,
        });
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
          key: "status",
          label: "Status",
          render: (row) => (
            <StatusChip value={readString(row, ["status"], "ACTIVE")} />
          ),
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
          return (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `recommend-${id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void actOnApplication(row, "recommend");
                }}
              >
                Recommend
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `hr-${id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void actOnApplication(row, "hr");
                }}
              >
                HR approve
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `fin-${id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void actOnApplication(row, "finance");
                }}
              >
                Finance approve
              </button>
            </div>
          );
        },
      },
    ];
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

  function exportAccountStatement() {
    if (!statementAccount || !accountStatement) return;
    const accountNo = readString(
      statementAccount,
      ["accountNo", "account_no"],
      rowId(statementAccount) || "account",
    );
    const rows = [
      ...accountInstallments.map((row) => ({
        section: "installments",
        ...row,
      })),
      ...accountLedger.map((row) => ({ section: "ledger", ...row })),
      ...accountDisbursements.map((row) => ({
        section: "disbursements",
        ...row,
      })),
      ...accountRepayments.map((row) => ({ section: "repayments", ...row })),
      ...accountDeferments.map((row) => ({ section: "deferments", ...row })),
      ...accountReschedules.map((row) => ({
        section: "reschedules",
        ...row,
      })),
      ...accountSettlementQuotes.map((row) => ({
        section: "settlement_quotes",
        ...row,
      })),
    ];
    downloadTextFile(
      rowsToCsv(rows),
      `finance-statement-${accountNo}.csv`,
      "text/csv;charset=utf-8",
    );
  }

  if (!canAccess) return null;

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      {activeTab === "overview" ? (
        <>
          <HeroBand
            eyebrow="Finance"
            title="Staff loans and advances"
            description="Products, applications, and accounts you are allowed to operate."
            actions={
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
              label="Open accounts"
              value={
                readNumber(dashboard, ["open_accounts", "openAccounts"]) ??
                accounts.length
              }
            />
            <MetricTile label="Applications" value={applications.length} />
            <MetricTile label="Products" value={products.length} />
            <MetricTile
              label="Outstanding"
              value={readString(
                dashboard,
                ["outstanding", "outstanding_balance"],
                "—",
              )}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Application mix</h2>
            <div className="mt-4">
              <StatusStack items={statusChartItems(applications)} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              )}
              Refresh
            </button>
            {activeTab === "products" ? (
              <>
                <button
                  type="button"
                  className={secondaryButtonClass}
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
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => {
                    setCreateMode("product");
                    setForm({
                      product_type: "STAFF_LOAN",
                      interest_method: "FLAT_RATE",
                    });
                    setCreateOpen(true);
                  }}
                >
                  <PlusIcon className="size-4" /> New product
                </button>
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
                  onChange={setSelectedReport}
                  options={financeReportTypes}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">From</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={reportFilters.date_from ?? ""}
                    onChange={(event) =>
                      setReportFilters((current) => ({
                        ...current,
                        date_from: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">To</span>
                  <input
                    type="date"
                    className={inputClass}
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
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-4" />
                  )}
                  Run
                </button>
                <label className={`${secondaryButtonClass} cursor-pointer`}>
                  {importingPayments ? (
                    <Loader2Icon className="size-4 animate-spin" />
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
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  Post ERP
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  onClick={() => downloadReportCsv(reportData)}
                  disabled={!currentReportRows.length}
                >
                  Export CSV
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
        <div className="space-y-3">
          <SearchToggleField
            value={search}
            onChange={setSearch}
            placeholder="Search"
          />
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Finance records"
              data={visible}
              columns={columns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
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
                        <Loader2Icon className="size-4 animate-spin" /> Loading
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={
                        !applicationDetail ||
                        busyId === `recommend-${rowId(applicationDetail)}`
                      }
                      onClick={() =>
                        applicationDetail &&
                        void actOnApplication(applicationDetail, "recommend")
                      }
                    >
                      Recommend
                    </button>
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={
                        !applicationDetail ||
                        busyId === `hr-${rowId(applicationDetail)}`
                      }
                      onClick={() =>
                        applicationDetail &&
                        void actOnApplication(applicationDetail, "hr")
                      }
                    >
                      HR approve
                    </button>
                    <button
                      type="button"
                      className={actionButtonClass}
                      disabled={
                        !applicationDetail ||
                        !supportReady ||
                        busyId === `finance-${rowId(applicationDetail)}`
                      }
                      onClick={() =>
                        applicationDetail &&
                        void actOnApplication(applicationDetail, "finance")
                      }
                    >
                      Finance approve
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Sanction letter</h3>
                    {sanctionLetter ? (
                      <StatusChip value="GENERATED" />
                    ) : (
                      <StatusChip value="PENDING" />
                    )}
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
                <Loader2Icon className="size-4 animate-spin" />
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
                disabled={!accountStatement}
                onClick={exportAccountStatement}
              >
                Export statement
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
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                    <h3 className="text-sm font-semibold">
                      Installment schedule
                    </h3>
                    {accountLoading ? (
                      <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Due</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Paid</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {accountInstallments.length ? (
                          accountInstallments.map((installment) => {
                            const id = rowId(installment);
                            const status = readString(
                              installment,
                              ["status"],
                              "SCHEDULED",
                            ).toUpperCase();
                            return (
                              <tr key={id}>
                                <td className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["installmentNumber", "installment_number"],
                                    id,
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["dueDate", "due_date"],
                                    "",
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["totalDue", "total_due"],
                                    "0.00",
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {readString(
                                    installment,
                                    ["paidAmount", "paid_amount"],
                                    "0.00",
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <StatusChip value={status} />
                                </td>
                                <td className="px-3 py-2">
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
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              className="px-3 py-4 text-muted-foreground"
                              colSpan={6}
                            >
                              No installment schedule found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
                <Loader2Icon className="size-4 animate-spin" />
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
              {createMode === "product"
                ? "New product"
                : createMode === "disburse"
                  ? "Disburse"
                  : createMode === "repay"
                    ? "Repayment"
                    : createMode === "defer"
                      ? "Deferment"
                      : "Reschedule"}
            </DialogTitle>
            <DialogDescription>
              Save this finance record for the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {createMode === "product" ? (
              <>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Type</span>
                  <FluentSelect
                    ariaLabel="Type"
                    className="w-full"
                    value={form.product_type ?? "STAFF_LOAN"}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        product_type: value,
                      }))
                    }
                    options={[
                      { value: "STAFF_LOAN", label: "Staff loan" },
                      { value: "SALARY_ADVANCE", label: "Salary advance" },
                    ]}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Code</span>
                  <input
                    className={inputClass}
                    value={form.code ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Name</span>
                  <input
                    className={inputClass}
                    value={form.name ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
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
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Annual interest %</span>
                    <input
                      className={inputClass}
                      value={form.annual_interest_rate ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          annual_interest_rate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Minimum amount</span>
                    <input
                      className={inputClass}
                      value={form.minimum_amount ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minimum_amount: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Maximum amount</span>
                    <input
                      className={inputClass}
                      value={form.maximum_amount ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maximum_amount: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Minimum term (months)</span>
                    <input
                      className={inputClass}
                      value={form.minimum_term_months ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minimum_term_months: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Maximum term (months)</span>
                    <input
                      className={inputClass}
                      value={form.maximum_term_months ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maximum_term_months: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Max salary multiple</span>
                    <input
                      className={inputClass}
                      value={form.maximum_salary_multiple ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maximum_salary_multiple: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Max installment %</span>
                    <input
                      className={inputClass}
                      value={form.maximum_installment_percentage ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maximum_installment_percentage: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Minimum service months</span>
                    <input
                      className={inputClass}
                      value={form.minimum_service_months ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minimum_service_months: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Max active accounts</span>
                    <input
                      className={inputClass}
                      value={form.maximum_active_accounts ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maximum_active_accounts: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Required document types</span>
                  <input
                    className={inputClass}
                    placeholder="PAYSLIP, ID_COPY"
                    value={form.required_document_types ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        required_document_types: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Required guarantors</span>
                  <input
                    className={inputClass}
                    value={form.required_guarantors ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        required_guarantors: event.target.value,
                      }))
                    }
                  />
                </label>
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
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={
                          (form[key] ??
                            (key.startsWith("allow_") ? "true" : "false")) ===
                          "true"
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [key]: event.target.checked ? "true" : "false",
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Effective from</span>
                  <input
                    type="date"
                    className={inputClass}
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
                  <input
                    className={inputClass}
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
                  <input
                    type="date"
                    className={inputClass}
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
                  <input
                    className={inputClass}
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
                  <input
                    className={inputClass}
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
                  <textarea
                    className={textareaClass}
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
                  <input
                    className={inputClass}
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
                  <textarea
                    className={textareaClass}
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
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void onSave()}
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
