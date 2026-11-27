"use client";

import { StandardTable, StandardTableHeader, StandardTableBody, StandardTableRow, StandardTableHead, StandardTableCell } from "@/components/ui/standard-fluent-table"
import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import * as React from "react";
import Link from "next/link";
import { InfoIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store";

import { SearchToggleField } from "@/components/common/search-toggle-field";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import { FluentSelect } from "@/components/ui/fluent-select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { DashboardIdentitySummary } from "@/components/dashboard/dashboard-identity";
import { useDashboardIdentity } from "@/components/dashboard/dashboard-identity";
import { WelcomeCardBackground } from "@/components/dashboard/welcome-card-background";
import { useDashboardHeroBackground } from "@/hooks/use-dashboard-hero-background";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowClockwise20Regular, PaintBrush20Regular, PeopleTeam24Regular, PersonAvailable24Regular, ClipboardTask24Regular, DocumentBulletList24Regular } from "@fluentui/react-icons";
import { MessageBar, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import {
  HeroBand,
  MetricTile,
  TalentDoodleSprites,
  asRecord,
  asRecordArray,
  employeeLabel,
  formatDate,
  formatDateTime,
  heroGhostButtonClass,
  inputClass,
  isPermissionError,
  optionLabel,
  prettify,
  primaryButtonClass,
  readBoolean,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
} from "@/components/dashboard/talent-visuals";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import {
  getHrAttendanceSchedulePreview,
  getHrAttendanceSetupStatus,
  exportAnalyticsReport,
  getAnalyticsDashboard,
  getAnalyticsSalesFieldDetails,
  createHrDocumentRequirement,
  deleteHrDocumentRequirement,
  getHrDocumentComplianceDetails,
  getHrDashboard,
  getManagerDashboard,
  getHrLaunchReadiness,
  getHrLaunchReadinessEmployees,
  getSystemHealth,
  getSystemHealthLive,
  getSystemHealthReady,
  listCurrentCompanyUsers,
  listEmployees,
  listSecurityEvents,
  runHrAttendanceSetupWizard,
  type AdminRecord,
  type AnalyticsSalesFieldDetailMetric,
} from "@/lib/admin-api";
import {
  canAccessDashboardRoute,
  canPerformPermission,
} from "@/lib/dashboard-permissions";
import { motion } from "framer-motion";
import { useDashboardMotion } from "@/lib/dashboard-motion";
import {
  useForbiddenRouteGuard,
  useLeaveIfForbidden,
} from "@/hooks/use-forbidden-route-guard";
import { readStoredSessionTokens } from "@/lib/session-client";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { describeSecurityEvent } from "@/lib/security-event-plain";
import {
  isEmployeeReady,
  parseReadinessChecks,
  readinessCheckItems,
  readinessIssueText,
  readinessPersonName,
} from "@/lib/employee-readiness-plain";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";

export type InsightsOpsTab =
  "hr" | "management" | "manager" | "sales-field" | "readiness";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultScheduleRange() {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 6);
  return { from: localDateString(start), to: localDateString(end) };
}

function schedulePreviewDays(record: AdminRecord | null) {
  if (!record) return [];
  for (const key of ["days", "items", "rows", "schedule", "preview"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is AdminRecord =>
          typeof entry === "object" && entry !== null,
      );
    }
  }
  return [];
}

function TipIcon({
  text,
  variant = "default",
}: {
  text: string;
  variant?: "default" | "onPrimary";
}) {
  const motionPreset = useDashboardMotion();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={
              variant === "onPrimary"
                ? "inline-flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:text-white"
                : "inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:text-primary"
            }
            aria-label="More information"
          />
        }
      >
        <motion.span
          className="inline-flex"
          animate={
            motionPreset.reduce
              ? undefined
              : { scale: [1, 1.15, 1], opacity: [0.65, 1, 0.65] }
          }
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </motion.span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-72 text-left leading-relaxed"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function friendlyStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "—") return "—";
  if (
    ["ok", "up", "healthy", "ready", "live", "true", "yes"].includes(normalized)
  ) {
    return "Working";
  }
  if (
    ["down", "fail", "failed", "unhealthy", "error", "false", "no"].includes(
      normalized,
    )
  ) {
    return "Needs attention";
  }
  return value;
}

function isCompanyTimezoneError(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const payload = record?.payload && typeof record.payload === "object" ? record.payload as Record<string, unknown> : null;
  return ["COMPANY_TIMEZONE_NOT_CONFIGURED", "COMPANY_TIMEZONE_INVALID"].includes(String(payload?.code ?? "")) ||
    /company timezone|IANA timezone/i.test(error instanceof Error ? error.message : String(error ?? ""));
}

function metricEntries(record: AdminRecord | null) {
  if (!record) return [];
  const skip = new Set([
    "id",
    "companyId",
    "company_id",
    "generatedAt",
    "generated_at",
    "asOf",
    "as_of",
  ]);
  const entries: Array<{ label: string; value: string | number }> = [];
  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      entries.push({ label: prettify(key), value });
      continue;
    }
    if (typeof value === "string" && value.trim() && value.length < 40) {
      entries.push({ label: prettify(key), value });
    }
  }
  return entries.slice(0, 8);
}

function dashboardScalarEntries(record: AdminRecord | null, prefix = "") {
  if (!record) return [] as Array<{ label: string; value: string | number }>;
  const skip = new Set([
    "id",
    "companyId",
    "company_id",
    "employee_id",
    "employee_no",
    "generated_at",
    "generatedAt",
    "source_updated_at",
  ]);
  const entries: Array<{ label: string; value: string | number }> = [];
  for (const [key, value] of Object.entries(record)) {
    if (skip.has(key) || value === null || value === undefined) continue;
    const label = prefix ? `${prefix} · ${prettify(key)}` : prettify(key);
    if (typeof value === "number" && Number.isFinite(value))
      entries.push({ label, value });
    else if (typeof value === "boolean")
      entries.push({ label, value: value ? "Yes" : "No" });
    else if (typeof value === "string" && value.trim() && value.length < 64)
      entries.push({ label, value });
    else if (typeof value === "object" && !Array.isArray(value)) {
      entries.push(
        ...dashboardScalarEntries(
          value as AdminRecord,
          prefix ? `${prefix} · ${prettify(key)}` : prettify(key),
        ),
      );
    }
  }
  return entries;
}

function DashboardMetricSection({
  title,
  record,
}: {
  title: string;
  record: AdminRecord | null;
}) {
  const entries = dashboardScalarEntries(record);
  if (!record || entries.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border/50 py-1.5"
          >
            <dt className="truncate text-xs text-muted-foreground">
              {item.label}
            </dt>
            <dd className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DashboardRowsSection({
  title,
  rows,
  labelKeys,
  valueKeys,
  secondaryValueKeys,
  secondaryValueLabel,
}: {
  title: string;
  rows: AdminRecord[];
  labelKeys: string[];
  valueKeys: string[];
  secondaryValueKeys?: string[];
  secondaryValueLabel?: string;
}) {
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="mt-3 divide-y divide-border/60">
        {rows.map((row, index) => (
          <div
            key={`${readString(row, labelKeys, String(index))}-${index}`}
            className="flex items-center justify-between gap-4 py-2 text-sm"
          >
            <span className="truncate text-foreground">
              {readString(row, labelKeys, "Unassigned")}
            </span>
            <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
              <span className="font-semibold text-foreground">
                {readNumber(row, valueKeys) ?? "—"}
              </span>
              {secondaryValueKeys?.length ? (
                <span className="text-xs text-muted-foreground">
                  {readNumber(row, secondaryValueKeys) ?? "—"} {secondaryValueLabel}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HrDocumentComplianceSection({
  inventory,
  canManage,
  filters,
  onRefresh,
}: {
  inventory: AdminRecord | null;
  canManage: boolean;
  filters: Record<string, string | number | undefined>;
  onRefresh: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [branchIds, setBranchIds] = React.useState("");
  const [departmentIds, setDepartmentIds] = React.useState("");
  const [employmentTypes, setEmploymentTypes] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState("");
  const [effectiveTo, setEffectiveTo] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [detailSelection, setDetailSelection] = React.useState<{
    requirementId: number;
    label: string;
    state: "COMPLIANT" | "MISSING" | "EXPIRED" | "UNVERIFIED";
  } | null>(null);
  const [detailPage, setDetailPage] = React.useState(1);
  const [detailData, setDetailData] = React.useState<AdminRecord | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [detailSearch, setDetailSearch] = React.useState("");
  const detailRequestRef = React.useRef(0);
  const requirementRows = asRecordArray(inventory?.configured_requirements);
  const compliance = asRecord(inventory?.compliance) ?? {};
  const scopeKey = [
    filters.date_from,
    filters.date_to,
    filters.employee_id,
  ].join(":");

  async function loadComplianceDetails(
    selection: NonNullable<typeof detailSelection>,
    page: number,
    search = detailSearch,
  ) {
    const requestId = ++detailRequestRef.current;
    const token = readStoredToken();
    if (!token) {
      setDetailError("Authentication required. Please log in again.");
      return;
    }
    setDetailSelection(selection);
    setDetailPage(page);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const result = await getHrDocumentComplianceDetails(
        token,
        selection.requirementId,
        {
          ...filters,
          state: selection.state,
          ...(search.trim() ? { search: search.trim() } : {}),
          page,
          limit: 20,
        },
      );
      if (detailRequestRef.current === requestId) setDetailData(result);
    } catch (errorObject) {
      if (detailRequestRef.current === requestId) {
        setDetailData(null);
        setDetailError(
          errorObject instanceof Error
            ? errorObject.message
            : "Could not load employee compliance details.",
        );
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    detailRequestRef.current += 1;
    setDetailSelection(null);
    setDetailData(null);
    setDetailLoading(false);
    setDetailPage(1);
    setDetailError(null);
    setDetailSearch("");
    return () => {
      detailRequestRef.current += 1;
    };
  }, [scopeKey]);

  async function onAddRequirement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = readStoredToken();
    if (!token) {
      toast.error("Authentication required. Please log in again.");
      return;
    }
    const parseIds = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map(Number);
    const branches = parseIds(branchIds);
    const departments = parseIds(departmentIds);
    if (
      [...branches, ...departments].some(
        (id) => !Number.isInteger(id) || id < 1,
      )
    ) {
      toast.error(
        "Branch and department filters must contain positive numeric IDs.",
      );
      return;
    }
    setSaving(true);
    try {
      await createHrDocumentRequirement(token, {
        document_type_code: code.trim().toUpperCase(),
        label: label.trim(),
        ...(branches.length ? { branch_ids: branches } : {}),
        ...(departments.length ? { department_ids: departments } : {}),
        ...(employmentTypes.trim()
          ? {
              employment_types: employmentTypes
                .split(",")
                .map((item) => item.trim().toUpperCase())
                .filter(Boolean),
            }
          : {}),
        ...(effectiveFrom ? { effective_from: effectiveFrom } : {}),
        ...(effectiveTo ? { effective_to: effectiveTo } : {}),
      });
      setCode("");
      setLabel("");
      setBranchIds("");
      setDepartmentIds("");
      setEmploymentTypes("");
      setEffectiveFrom("");
      setEffectiveTo("");
      toast.success("Required document type added.");
      onRefresh();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not add the document requirement.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveRequirement(requirementId: number) {
    const token = readStoredToken();
    if (!token) return;
    try {
      await deleteHrDocumentRequirement(token, requirementId);
      toast.success("Document requirement removed.");
      onRefresh();
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not remove that requirement.",
      );
    }
  }

  return (
    <section
      className="rounded-xl border border-border bg-card p-4"
      aria-label="Employee document compliance"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Required employee documents
      </h2>
      {readBoolean(compliance, ["available"]) ? (
        <>
          <p className="mt-2 text-sm text-foreground">
            {readNumber(compliance, ["compliant_requirement_count"]) ?? 0} of{" "}
            {readNumber(compliance, ["applicable_requirement_count"]) ?? 0}{" "}
            applicable employee-document requirements are satisfied
            {readNumber(compliance, ["compliance_rate"]) === null
              ? "."
              : ` (${readNumber(compliance, ["compliance_rate"])}%).`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            As of {readString(compliance, ["as_of_date"], "the dashboard date")}
            . A document must be verified and unexpired to satisfy a
            requirement.
          </p>
          {asRecordArray(compliance.requirements).length ? (
            <ul className="mt-3 divide-y divide-border/60">
              {asRecordArray(compliance.requirements).map((row) => (
                <li
                  key={String(row.requirement_id)}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">
                    {readString(
                      row,
                      ["label"],
                      readString(
                        row,
                        ["document_type_code"],
                        "Required document",
                      ),
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {readNumber(row, ["compliant_employee_count"]) ?? 0}/
                    {readNumber(row, ["applicable_employee_count"]) ?? 0}{" "}
                    compliant ·{" "}
                    {readNumber(row, ["missing_document_employee_count"]) ?? 0}{" "}
                    missing ·{" "}
                    {readNumber(row, ["expired_document_employee_count"]) ?? 0}{" "}
                    expired ·{" "}
                    {readNumber(row, ["unverified_document_employee_count"]) ??
                      0}{" "}
                    unverified
                  </span>
                  <div className="flex w-full flex-wrap gap-x-3 gap-y-1 pl-0 text-xs">
                    {(
                      [
                        ["COMPLIANT", "compliant", "compliant_employee_count"],
                        ["MISSING", "missing", "missing_document_employee_count"],
                        ["EXPIRED", "expired", "expired_document_employee_count"],
                        ["UNVERIFIED", "unverified", "unverified_document_employee_count"],
                      ] as const
                    ).map(([state, label, countKey]) => {
                      const count = readNumber(row, [countKey]) ?? 0;
                      const requirementId = readNumber(row, ["requirement_id"]);
                      return (
                        <button
                          key={state}
                          type="button"
                          className="rounded-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                          disabled={!requirementId || count === 0}
                          aria-label={`View ${count} ${label} employees for ${readString(row, ["label"], "document requirement")}`}
                          onClick={() => {
                            if (!requirementId) return;
                            void loadComplianceDetails(
                              {
                                requirementId,
                                label: readString(row, ["label"], "Document requirement"),
                                state,
                              },
                              1,
                              "",
                            );
                          }}
                        >
                          {count} {label} details
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No active employees match the configured requirement
              applicability.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {readString(compliance, ["reason"]) === "NO_EFFECTIVE_REQUIREMENTS"
            ? "No active document requirement is effective for the dashboard as-of date."
            : "Compliance is unavailable until the company configures at least one active required document type."}
        </p>
      )}
      {detailSelection ? (
        <section
          className="mt-4 rounded-lg border border-border p-3"
          aria-label={`${detailSelection.label} ${detailSelection.state.toLowerCase()} employees`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {detailSelection.label}: {detailSelection.state.toLowerCase()} employees
            </h3>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => {
                detailRequestRef.current += 1;
                setDetailSelection(null);
                setDetailData(null);
                setDetailLoading(false);
                setDetailError(null);
              }}
            >
              Close details
            </button>
          </div>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void loadComplianceDetails(detailSelection, 1, detailSearch);
            }}
          >
            <Input
              value={detailSearch}
              onChange={(event) => setDetailSearch(event.currentTarget.value)}
              placeholder="Search employee name or number"
              aria-label="Search compliance detail employees"
              className="h-9 min-w-48 flex-1"
            />
            <button
              type="submit"
              className={secondaryButtonClass}
              disabled={detailLoading}
            >
              Search
            </button>
          </form>
          {detailLoading ? (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              Loading employeesâ€¦
            </p>
          ) : null}
          {detailError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {detailError}
            </p>
          ) : null}
          {detailData ? (
            <>
              <ul className="mt-3 divide-y divide-border/60">
                {asRecordArray(detailData.items).map((item) => {
                  const document = asRecord(item.document);
                  return (
                    <li
                      key={String(item.employee_id)}
                      className="flex flex-wrap items-start justify-between gap-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium text-foreground">
                          {readString(item, ["employee_name"], "Employee")}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {readString(item, ["employee_no"], "")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {document
                          ? `${readString(document, ["title"], "Document")} Â· ${readBoolean(document, ["is_verified"]) ? "Verified" : "Unverified"} Â· expiry ${readString(document, ["expiry_date"], "not set")}`
                          : "No matching document uploaded"}
                      </span>
                    </li>
                  );
                })}
                {!asRecordArray(detailData.items).length && !detailLoading ? (
                  <li className="py-3 text-sm text-muted-foreground">
                    No employees match this status and dashboard scope.
                  </li>
                ) : null}
              </ul>
              {(() => {
                const pagination = asRecord(detailData.pagination) ?? {};
                const totalPages = readNumber(pagination, ["total_pages"]) ?? 0;
                const total = readNumber(pagination, ["total"]) ?? 0;
                return (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>
                      {total} employees Â· page {detailPage} of {Math.max(1, totalPages)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        disabled={detailLoading || detailPage <= 1}
                        onClick={() =>
                          void loadComplianceDetails(detailSelection, detailPage - 1, detailSearch)
                        }
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className={secondaryButtonClass}
                        disabled={detailLoading || detailPage >= totalPages}
                        onClick={() =>
                          void loadComplianceDetails(detailSelection, detailPage + 1, detailSearch)
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          ) : null}
        </section>
      ) : null}
      {canManage ? (
        <>
          {requirementRows.length ? (
            <div className="mt-3 border-t border-border pt-3">
              <h3 className="text-xs font-semibold text-foreground">
                Configured requirements
              </h3>
              <ul className="mt-2 space-y-2">
                {requirementRows.map((row) => {
                  const id = readNumber(row, ["id"]);
                  const applicability = asRecord(row.applicability);
                  const scopeLabel =
                    [
                      ...(Array.isArray(applicability?.branch_ids)
                        ? [`branches ${applicability.branch_ids.join(", ")}`]
                        : []),
                      ...(Array.isArray(applicability?.department_ids)
                        ? [
                            `departments ${applicability.department_ids.join(", ")}`,
                          ]
                        : []),
                      ...(Array.isArray(applicability?.employment_types)
                        ? [`types ${applicability.employment_types.join(", ")}`]
                        : []),
                    ].join(" · ") || "All active employees";
                  return (
                    <li
                      key={id ?? readString(row, ["document_type_code"])}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span>
                        {readString(
                          row,
                          ["label"],
                          readString(row, ["document_type_code"], "Document"),
                        )}{" "}
                        · {scopeLabel}
                      </span>
                      {id ? (
                        <button
                          type="button"
                          className="text-destructive underline"
                          onClick={() => void onRemoveRequirement(id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <form
            className="mt-4 grid gap-2 border-t border-border pt-3 sm:grid-cols-2"
            onSubmit={(event) => void onAddRequirement(event)}
          >
            <h3 className="sm:col-span-2 text-xs font-semibold text-foreground">
              Add a required document type
            </h3>
            <Input
              className={inputClass}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Document type code"
              aria-label="Document type code"
              required
              maxLength={100}
            />
            <Input
              className={inputClass}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Display name"
              aria-label="Document display name"
              required
              maxLength={160}
            />
            <Input
              className={inputClass}
              value={branchIds}
              onChange={(event) => setBranchIds(event.target.value)}
              placeholder="Branch IDs (optional, comma-separated)"
              aria-label="Applicable branch IDs"
            />
            <Input
              className={inputClass}
              value={departmentIds}
              onChange={(event) => setDepartmentIds(event.target.value)}
              placeholder="Department IDs (optional)"
              aria-label="Applicable department IDs"
            />
            <Input
              className={inputClass}
              value={employmentTypes}
              onChange={(event) => setEmploymentTypes(event.target.value)}
              placeholder="Employment types (optional)"
              aria-label="Applicable employment types"
            />
            <div className="flex gap-2">
              <Input
                className={inputClass}
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                aria-label="Requirement effective from"
              />
              <Input
                className={inputClass}
                type="date"
                value={effectiveTo}
                onChange={(event) => setEffectiveTo(event.target.value)}
                aria-label="Requirement effective to"
              />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Leave applicability fields empty to apply the requirement to all
              active employees. Compliance counts verified, unexpired matching
              employee documents.
            </p>
            <button
              className={`${primaryButtonClass} sm:col-span-2`}
              type="submit"
              disabled={saving}
            >
              {saving ? "Adding…" : "Add requirement"}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}

function ManagementFieldProductivityPanel({
  record,
}: {
  record: AdminRecord | null;
}) {
  if (!record) return null;
  const metrics = [
    ["Approved activity reports", "approved_reports"],
    ["Reviewed visits", "reviewed_visits"],
    ["Customer visits", "customer_visits"],
    ["Broker/intermediary visits", "broker_intermediary_visits"],
    ["Planned visit items", "planned_visit_items"],
    ["Completed planned items", "completed_planned_visit_items"],
    ["Unplanned completed visits", "unplanned_completed_visits"],
  ] as const;
  return (
    <section
      className="rounded-xl border border-border bg-card p-4"
      aria-label="Management field productivity summary"
    >
      <h2 className="text-sm font-semibold text-foreground">
        Field activity productivity
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, key]) => (
          <div key={key} className="rounded-lg bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
              {readNumber(record, [key]) ?? "—"}
            </dd>
          </div>
        ))}
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">
            Planned completion rate
          </dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {readNumber(record, ["planned_visit_completion_rate"]) === null
              ? "Unavailable"
              : `${readNumber(record, ["planned_visit_completion_rate"])}%`}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Activity and visit counts do not measure CRM leads, quotations, closed
        business, renewals, or collections.
      </p>
    </section>
  );
}

function DashboardMetricPanels({
  dashboard,
  activeTab,
  dateFrom,
  dateTo,
  employeeIdFilter,
  onLoadSalesFieldDetails,
  onCloseSalesFieldDetails,
  salesFieldDetailMetric,
  salesFieldDetails,
  salesFieldDetailsLoading,
  salesFieldDetailsError,
  salesFieldDetailsPage,
  salesFieldDetailCurrency,
  canManageDocumentRequirements,
  onRefreshDashboard,
}: {
  dashboard: AdminRecord | null;
  activeTab: InsightsOpsTab;
  dateFrom: string;
  dateTo: string;
  employeeIdFilter: string;
  onLoadSalesFieldDetails: (
    metric: AnalyticsSalesFieldDetailMetric,
    page?: number,
    currency?: string,
  ) => void;
  onCloseSalesFieldDetails: () => void;
  salesFieldDetailMetric: AnalyticsSalesFieldDetailMetric | null;
  salesFieldDetails: AdminRecord | null;
  salesFieldDetailsLoading: boolean;
  salesFieldDetailsError: string | null;
  salesFieldDetailsPage: number;
  salesFieldDetailCurrency: string;
  canManageDocumentRequirements: boolean;
  onRefreshDashboard: () => void;
}) {
  if (!dashboard) return null;
  const sections =
    activeTab === "hr"
      ? ([
          [
            "Workforce",
            dashboard.workforce ?? { active_employees: dashboard.headcount },
          ],
          ["Employee movements", dashboard.movements],
          ["Probation and confirmation", dashboard.probation],
          ["Attendance", dashboard.attendance],
          ["Leave", dashboard.leave],
          ["Workflow pipeline", dashboard.workflow_pipeline],
          ["Action inbox assigned to you", dashboard.action_inbox],
          ["Payroll", dashboard.payroll],
          ["Work activity", dashboard.work_activities],
        ] as Array<[string, unknown]>)
      : activeTab === "management"
        ? ([
            ["Workforce and attrition", dashboard.workforce],
            ["Attendance discipline", dashboard.attendance],
            ["Leave", dashboard.leave],
            ["Workflow pipeline", dashboard.workflow_pipeline],
            ["Action inbox assigned to you", dashboard.action_inbox],
            ["Field and work activity", dashboard.work_activities],
            ["Payroll", dashboard.payroll],
            ["Staff loans", dashboard.employee_finance],
          ] as Array<[string, unknown]>)
        : activeTab === "sales-field"
          ? ([
              ["Workforce", dashboard.workforce],
              ["Attendance", dashboard.attendance],
              ["Leave", dashboard.leave],
              ["Activity and field productivity", dashboard.activities],
              ["Actionable approvals", dashboard.approvals],
              ["Risk indicators", dashboard.risk_indicators],
            ] as Array<[string, unknown]>)
          : [];
  const unavailable = asRecordArray(dashboard.unavailable_widgets);
  const fieldUnavailable = unavailable.filter(
    (item) => readBoolean(item, ["available"]) === false,
  );

  return (
    <div className="space-y-3">
      {fieldUnavailable.length ? (
        <section
          className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:bg-amber-950/20"
          aria-label="Unavailable dashboard metrics"
        >
          <h2 className="text-sm font-semibold text-foreground">
            Some metrics are unavailable
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {fieldUnavailable.map((item, index) => (
              <li key={`${readString(item, ["code"], "metric")}-${index}`}>
                {prettify(readString(item, ["code"], "Metric"))}:{" "}
                {prettify(readString(item, ["reason"], "Unavailable"))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {sections.map(([title, value]) => (
          <DashboardMetricSection
            key={title}
            title={title}
            record={asRecord(value)}
          />
        ))}
      </div>
      {activeTab === "hr" || activeTab === "management" ? (
        <DashboardRowsSection
          title="Approved leave by month and type"
          rows={asRecordArray(
            asRecord(asRecord(dashboard.leave)?.approved_days_by_type)?.items,
          )}
          labelKeys={["label"]}
          valueKeys={["approved_days"]}
          secondaryValueKeys={["approved_request_count"]}
          secondaryValueLabel="requests"
        />
      ) : null}
      {activeTab === "hr" ? (
        <>
          <HrDocumentComplianceSection
            inventory={asRecord(dashboard.employee_document_inventory)}
            canManage={canManageDocumentRequirements}
            filters={{
              ...(dateFrom ? { date_from: dateFrom } : {}),
              ...(dateTo ? { date_to: dateTo } : {}),
              ...(employeeIdFilter
                ? { employee_id: Number(employeeIdFilter) }
                : {}),
            }}
            onRefresh={onRefreshDashboard}
          />
          <DashboardRowsSection
            title="Department manpower"
            rows={asRecordArray(dashboard.manpower)}
            labelKeys={["department_name", "name"]}
            valueKeys={["headcount", "employee_count"]}
          />
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              Assigned action inbox
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Open items assigned to your active company membership.
            </p>
            <Link
              className={`${secondaryButtonClass} mt-3 inline-flex`}
              href="/dashboard/me/requests/actions"
            >
              Open action inbox
            </Link>
          </section>
        </>
      ) : null}
      {activeTab === "management" ? (
        <>
          <ManagementFieldProductivityPanel
            record={asRecord(dashboard.work_activities)}
          />
          <DashboardRowsSection
            title="Headcount by department"
            rows={asRecordArray(
              asRecord(dashboard.workforce)?.department_headcount,
            )}
            labelKeys={["department_name"]}
            valueKeys={["headcount"]}
          />
          <DashboardRowsSection
            title="Headcount by branch"
            rows={asRecordArray(
              asRecord(dashboard.workforce)?.branch_headcount,
            )}
            labelKeys={["branch_name"]}
            valueKeys={["headcount"]}
          />
        </>
      ) : null}
      {activeTab === "sales-field" ? (
        <>
          {(() => {
            const commercial = asRecord(dashboard?.sales_field);
            const currencyRows = Array.isArray(
              commercial?.reported_potential_value_by_currency,
            )
              ? commercial.reported_potential_value_by_currency
              : [];
            const fieldMetrics = [
              [
                "Reviewed visits",
                managerMetric(commercial, ["reviewed_visits"]),
              ],
              [
                "Customer visits",
                managerMetric(commercial, ["customer_visits"]),
              ],
              [
                "Broker/intermediary visits",
                managerMetric(commercial, ["broker_intermediary_visits"]),
              ],
              [
                "Approved activity reports",
                managerMetric(commercial, ["approved_reports"]),
              ],
              [
                "Open follow-ups",
                managerMetric(commercial, ["open_follow_ups"]),
              ],
              [
                "Open exceptions",
                managerMetric(commercial, ["open_exceptions"]),
              ],
              [
                "Eligible planned visits",
                managerMetric(commercial, ["planned_visit_items"]),
              ],
              [
                "Completed planned visits",
                managerMetric(commercial, ["completed_planned_visit_items"]),
              ],
              [
                "Planned completion rate",
                managerMetric(commercial, ["planned_visit_completion_rate"]) ===
                "—"
                  ? "Unavailable"
                  : `${managerMetric(commercial, ["planned_visit_completion_rate"])}%`,
              ],
              [
                "Unplanned completed visits",
                managerMetric(commercial, ["unplanned_completed_visits"]),
              ],
            ];
            return (
              <section
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                aria-label="Field commercial summary"
              >
                {fieldMetrics.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                      {value}
                    </p>
                    {label === "Eligible planned visits" ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary underline"
                        onClick={() =>
                          onLoadSalesFieldDetails("PLANNED_VISITS")
                        }
                      >
                        View records
                      </button>
                    ) : null}
                    {label === "Completed planned visits" ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary underline"
                        onClick={() =>
                          onLoadSalesFieldDetails("COMPLETED_PLANNED_VISITS")
                        }
                      >
                        View records
                      </button>
                    ) : null}
                    {label === "Unplanned completed visits" ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary underline"
                        onClick={() =>
                          onLoadSalesFieldDetails("UNPLANNED_COMPLETED_VISITS")
                        }
                      >
                        View records
                      </button>
                    ) : null}
                    {label === "Customer visits" ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary underline"
                        onClick={() =>
                          onLoadSalesFieldDetails("CUSTOMER_VISITS")
                        }
                      >
                        View records
                      </button>
                    ) : null}
                    {label === "Broker/intermediary visits" ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary underline"
                        onClick={() =>
                          onLoadSalesFieldDetails("BROKER_INTERMEDIARY_VISITS")
                        }
                      >
                        View records
                      </button>
                    ) : null}
                  </div>
                ))}
                <p className="sm:col-span-2 xl:col-span-4 text-xs text-muted-foreground">
                  Planned completion uses the plan date. Eligible submitted,
                  approved, in-progress, completed, and locked plan items form
                  the denominator; linked visits count as complete after manager
                  approval. Cancelled visits and plans are excluded from the
                  denominator; unplanned completed visits are shown separately.
                </p>
                <div className="sm:col-span-2 xl:col-span-4 rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold text-foreground">
                    Reported opportunity pipeline
                  </h2>
                  {currencyRows.length ? (
                    <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {currencyRows.map((item, index) => {
                        const row = asRecord(item);
                        return (
                          <li
                            key={`${readString(row, ["currency"]) ?? "currency"}-${index}`}
                            className="rounded-lg bg-muted/50 p-3 text-sm"
                          >
                            <span className="font-medium">
                              {readString(row, ["currency"]) ??
                                "Unknown currency"}
                            </span>
                            <p className="mt-1 text-muted-foreground">
                              Potential:{" "}
                              {managerMetric(row, ["potential_value"])}
                            </p>
                            <p className="text-muted-foreground">
                              Manager validated:{" "}
                              {managerMetric(row, ["validated_actual_value"])}
                            </p>
                            <button
                              type="button"
                              className="mt-2 text-xs text-primary underline"
                              onClick={() =>
                                onLoadSalesFieldDetails(
                                  "OPPORTUNITIES",
                                  1,
                                  readString(row, ["currency"]) ?? "TZS",
                                )
                              }
                            >
                              View opportunity records
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No opportunity values are available for this period and
                      scope.
                    </p>
                  )}
                </div>
              </section>
            );
          })()}
          {salesFieldDetailMetric ? (
            <section
              className="rounded-xl border border-border bg-card p-4"
              aria-label="Sales-field detail records"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {salesFieldDetailMetric.replaceAll("_", " ").toLowerCase()}{" "}
                  detail
                </h2>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={onCloseSalesFieldDetails}
                >
                  Close details
                </button>
              </div>
              {salesFieldDetailsLoading ? (
                <p className="mt-3 text-sm text-muted-foreground" role="status">
                  Loading detail records…
                </p>
              ) : null}
              {salesFieldDetailsError ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {salesFieldDetailsError}
                </p>
              ) : null}
              {!salesFieldDetailsLoading &&
              !salesFieldDetailsError &&
              salesFieldDetails
                ? (() => {
                    const detailRows = asRecordArray(salesFieldDetails.rows);
                    const pagination = asRecord(salesFieldDetails.pagination);
                    const totalPages =
                      readNumber(pagination, ["total_pages"]) ?? 0;
                    const columns =
                      salesFieldDetailMetric === "PLANNED_VISITS" ||
                      salesFieldDetailMetric === "COMPLETED_PLANNED_VISITS"
                        ? [
                            ["plan_date", "Plan date"],
                            ["employee_name", "Employee"],
                            ["employee_no", "Employee no."],
                            ["plan_status", "Plan status"],
                            ["visit_type", "Visit type"],
                            ["purpose", "Purpose"],
                            ["linked_visit_count", "Linked visits"],
                            ["qualifying_completed_visit_count", "Completed"],
                            ["cancelled_visit_count", "Cancelled"],
                          ]
                        : [
                              "UNPLANNED_COMPLETED_VISITS",
                              "CUSTOMER_VISITS",
                              "BROKER_INTERMEDIARY_VISITS",
                            ].includes(salesFieldDetailMetric)
                          ? [
                              ["visit_date", "Visit date"],
                              ["employee_name", "Employee"],
                              ["employee_no", "Employee no."],
                              ["visit_no", "Visit no."],
                              ["visit_type", "Visit type"],
                              ["party_type", "Party type"],
                              ["purpose", "Purpose"],
                            ]
                          : [
                              ["visit_date", "Visit date"],
                              ["employee_name", "Employee"],
                              ["employee_no", "Employee no."],
                              ["opportunity_type", "Type"],
                              ["title", "Opportunity"],
                              ["status", "Status"],
                              ["currency", "Currency"],
                              ["potential_value", "Potential"],
                              ["actual_value", "Actual"],
                              ["validated_by_manager", "Validated"],
                            ];
                    return (
                      <>
                        {detailRows.length ? (
                          <div className="mt-3 overflow-x-auto">
                            <StandardTable className="min-w-full text-left text-xs">
                              <StandardTableHeader>
                                <StandardTableRow className="border-b border-border">
                                  {columns.map(([key, label]) => (
                                    <StandardTableHead
                                      key={key}
                                      className="px-2 py-2 font-semibold"
                                    >
                                      {label}
                                    </StandardTableHead>
                                  ))}
                                </StandardTableRow>
                              </StandardTableHeader>
                              <StandardTableBody>
                                {detailRows.map((row, index) => (
                                  <StandardTableRow
                                    key={String(
                                      row.plan_item_id ??
                                        row.visit_id ??
                                        row.opportunity_id ??
                                        index,
                                    )}
                                    className="border-b border-border/60"
                                  >
                                    {columns.map(([key]) => (
                                      <StandardTableCell
                                        key={key}
                                        className="max-w-64 px-2 py-2 text-muted-foreground"
                                      >
                                        {typeof row[key] === "boolean"
                                          ? row[key]
                                            ? "Yes"
                                            : "No"
                                          : row[key] == null
                                            ? "—"
                                            : String(row[key])}
                                      </StandardTableCell>
                                    ))}
                                  </StandardTableRow>
                                ))}
                              </StandardTableBody>
                            </StandardTable>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">
                            No detail records match this period and scope.
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {readNumber(pagination, ["total"]) ?? 0} records ·
                            Page {salesFieldDetailsPage} of {totalPages}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded border border-border px-2 py-1 disabled:opacity-50"
                              disabled={
                                salesFieldDetailsLoading ||
                                salesFieldDetailsPage <= 1
                              }
                              onClick={() =>
                                void onLoadSalesFieldDetails(
                                  salesFieldDetailMetric,
                                  salesFieldDetailsPage - 1,
                                  salesFieldDetailCurrency,
                                )
                              }
                            >
                              Previous
                            </button>
                            <button
                              type="button"
                              className="rounded border border-border px-2 py-1 disabled:opacity-50"
                              disabled={
                                salesFieldDetailsLoading ||
                                salesFieldDetailsPage >= totalPages
                              }
                              onClick={() =>
                                void onLoadSalesFieldDetails(
                                  salesFieldDetailMetric,
                                  salesFieldDetailsPage + 1,
                                  salesFieldDetailCurrency,
                                )
                              }
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()
                : null}
            </section>
          ) : null}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">
              Field operations
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the scoped visit workspace for plans, visit records,
              commercial statuses and authorized map events.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className={secondaryButtonClass}
                href="/dashboard/field/visits"
              >
                Open visits
              </Link>
              <Link
                className={secondaryButtonClass}
                href="/dashboard/field/map"
              >
                Open visit map
              </Link>
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:bg-amber-950/20">
            <h2 className="text-sm font-semibold text-foreground">
              Commercial source coverage
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This summary does not establish authoritative quotation issuance,
              closed business, completed renewals, or cash collections. Visit
              and follow-up activity must not be read as those outcomes.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function managerMetric(record: AdminRecord | null, keys: string[]) {
  return readNumber(record, keys) ?? "—";
}

function managerAttentionClass(value: string | number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return "text-muted-foreground";
  return numericValue === 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-primary";
}

function ManagerStatList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl className="mt-3 divide-y divide-border/70">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0"
          >
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ManagerAttendancePanel({ attendance }: { attendance: AdminRecord | null }) {
  const present = readNumber(attendance, ["present"]) ?? 0;
  const late = readNumber(attendance, ["late"]) ?? 0;
  const absent = readNumber(attendance, ["absent"]) ?? 0;
  const total = present + late + absent;
  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : null;
  const segments = [
    { label: "Present", value: present, color: "bg-emerald-500" },
    { label: "Late", value: late, color: "bg-amber-500" },
    { label: "Absent", value: absent, color: "bg-rose-500" },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-label="Team attendance">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-foreground">Team attendance</h2><p className="mt-0.5 text-sm text-muted-foreground">Attendance for the selected dates</p></div>
        <div className="text-right"><p className="text-3xl font-semibold tabular-nums text-primary" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{attendanceRate === null ? "—" : `${attendanceRate}%`}</p><p className="text-xs text-muted-foreground">attendance rate</p></div>
      </div>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={total > 0 ? `${present} present, ${late} late, ${absent} absent` : "No attendance records yet"}>
        {segments.map((item) => <span key={item.label} className={item.color} style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }} />)}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
        {segments.map((item) => <div key={item.label}><dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${item.color}`} />{item.label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{item.value}</dd></div>)}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">Early departures: {managerMetric(attendance, ["early_departure", "earlyDeparture"])}</p>
    </section>
  );
}

function ScopedInsightPanels({ dashboard }: { dashboard: AdminRecord | null }) {
  const attendance = asRecord(dashboard?.attendance) ?? dashboard;
  const present = readNumber(attendance, ["present", "present_today", "presentToday"]) ?? 0;
  const late = readNumber(attendance, ["late", "late_arrivals", "lateArrivals"]) ?? 0;
  const absent = readNumber(attendance, ["absent", "absent_today", "absentToday"]) ?? 0;
  const total = Math.max(1, present + late + absent);
  const rate = Math.round(((present + late) / total) * 1000) / 10;
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Attendance report</h2>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{rate}%</p>
      <p className="mt-1 text-xs text-muted-foreground">Attendance rate for the selected period</p>
    </section>
  );
}

function ManagerWelcomeHeader({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onRefresh,
  loading,
  generatedAt,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
  generatedAt: Date | null;
}) {
  const identity = useDashboardIdentity();
  const [background, saveBackground] = useDashboardHeroBackground();
  const nextBackground = background === "aurora" ? "geometric" : background === "geometric" ? "glow" : "aurora";
  const firstName = identity.name?.trim().split(/\s+/)[0] || "Manager";
  const initials = (identity.name ?? "M").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";

  return (
    <header className="relative isolate -mx-3 overflow-hidden border-y border-border bg-card px-5 py-5 shadow-sm sm:-mx-4 sm:px-7 sm:py-6" aria-label="Manager dashboard welcome">
      <WelcomeCardBackground background={background} />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-14 shrink-0 border-2 border-primary/15 bg-primary/10 shadow-sm sm:size-16">
            {identity.photoUrl && <AvatarImage src={identity.photoUrl} alt={identity.name ?? "Manager"} />}
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Welcome back</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>{firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your team, attendance, and work that needs your review.</p>
            <span className="mt-2 inline-flex rounded-full border border-primary/20 bg-background/75 px-2.5 py-0.5 text-xs font-medium text-primary">{identity.rolesLabel || "Manager"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end lg:justify-end">
          <div className="grid grid-cols-2 gap-2 sm:w-[18rem]">
            <label className="min-w-0 space-y-1"><span className="text-xs font-semibold text-muted-foreground">From</span><DatePickerPresets value={dateFrom} onChange={onDateFromChange} placeholder="Start date" className="w-full" /></label>
            <label className="min-w-0 space-y-1"><span className="text-xs font-semibold text-muted-foreground">To</span><DatePickerPresets value={dateTo} onChange={onDateToChange} placeholder="End date" className="w-full" /></label>
          </div>
          <div className="flex items-center gap-1 sm:pb-0.5">
            <button type="button" className="inline-flex size-9 items-center justify-center rounded-md text-primary hover:bg-primary/10" aria-label={`Change welcome background from ${background} to ${nextBackground}`} title="Change background" onClick={() => saveBackground(nextBackground)}><PaintBrush20Regular aria-hidden="true" /></button>
            <button type="button" className="inline-flex size-9 items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:opacity-50" aria-label="Refresh manager dashboard" title="Refresh dashboard" onClick={onRefresh} disabled={loading}><ArrowClockwise20Regular aria-hidden="true" className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>
      </div>
      {generatedAt && Number.isFinite(generatedAt.getTime()) && <p className="relative z-10 mt-3 text-right text-xs text-muted-foreground">Updated {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
    </header>
  );
}

function ManagerDashboardPanels({
  dashboard,
}: {
  dashboard: AdminRecord | null;
}) {
  const team = asRecord(dashboard?.team);
  const attendance = asRecord(dashboard?.attendance);
  const approvals = asRecord(dashboard?.approvals);
  const activities = asRecord(
    dashboard?.work_activities ?? dashboard?.workActivities,
  );
  const capabilities = asRecord(dashboard?.capabilities);
  const capabilityItems = [
    {
      label: "Activity report reviews",
      record: asRecord(
        capabilities?.activity_review ?? capabilities?.activityReview,
      ),
      href: "/dashboard/activities/reviews",
      linkLabel: "Open activity reviews",
      stats: [
        {
          label: "Pending",
          keys: ["pending_activity_reviews", "pendingActivityReviews"],
        },
      ],
    },
    {
      label: "Probation recommendations",
      record: asRecord(
        capabilities?.probation_recommendation ??
          capabilities?.probationRecommendation,
      ),
      href: "/dashboard/probation/team",
      linkLabel: "Open team probation",
      stats: [],
    },
  ];
  const availableCapabilityItems = capabilityItems.filter((item) =>
    Boolean(item.record),
  );
  const summaryItems = [
    {
      label: "Team members",
      icon: <PeopleTeam24Regular aria-hidden="true" />,
      value: managerMetric(team, ["total_members", "totalMembers"]),
      hintValue: managerMetric(team, [
        "employees_on_leave",
        "employeesOnLeave",
      ]),
      hintLabel: "currently on leave",
    },
    {
      label: "Present",
      icon: <PersonAvailable24Regular aria-hidden="true" />,
      value: managerMetric(attendance, ["present"]),
      hintValue: managerMetric(attendance, ["total_records", "totalRecords"]),
      hintLabel: "attendance records",
    },
    {
      label: "Open action items",
      icon: <ClipboardTask24Regular aria-hidden="true" />,
      value: managerMetric(approvals, ["open_action_items", "openActionItems"]),
      hintValue: managerMetric(approvals, [
        "pending_attendance_corrections",
        "pendingAttendanceCorrections",
      ]),
      hintLabel: "attendance corrections",
    },
    {
      label: "Activity reviews",
      icon: <DocumentBulletList24Regular aria-hidden="true" />,
      value: managerMetric(activities, [
        "pending_activity_reviews",
        "pendingActivityReviews",
      ]),
      hintValue: managerMetric(activities, [
        "approved_reports",
        "approvedReports",
      ]),
      hintLabel: "approved reports",
    },
  ];

  return (
    <>
      <section className="space-y-3" aria-label="Team overview">
        <div><h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "var(--font-fredoka), sans-serif" }}>Your team at a glance</h2><p className="mt-1 text-sm text-muted-foreground">Key figures and work needing your attention</p></div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-xl border border-border bg-card px-4 py-4"
            >
              <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><span className="text-primary">{item.icon}</span>{item.label}</dt>
              <dd
                className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${item.label === "Open action items" || item.label === "Activity reviews" ? managerAttentionClass(item.value) : "text-foreground"}`}
                style={{ fontFamily: "var(--font-fredoka), sans-serif" }}
              >
                {item.value}
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">
                <span
                  className={`font-semibold tabular-nums ${managerAttentionClass(item.hintValue)}`}
                >
                  {item.hintValue}
                </span>{" "}
                {item.hintLabel}
              </p>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <ManagerAttendancePanel attendance={attendance} />
        <ManagerStatList
          title="Work activities"
          items={[
            {
              label: "Pending report reviews",
              value: managerMetric(activities, [
                "pending_activity_reviews",
                "pendingActivityReviews",
              ]),
            },
            {
              label: "Pending visit reviews",
              value: managerMetric(activities, [
                "pending_visit_reviews",
                "pendingVisitReviews",
              ]),
            },
            {
              label: "Approved reports",
              value: managerMetric(activities, [
                "approved_reports",
                "approvedReports",
              ]),
            },
            {
              label: "Reviewed visits",
              value: managerMetric(activities, [
                "reviewed_visits",
                "reviewedVisits",
              ]),
            },
          ]}
        />
        <ManagerStatList
          title="Approvals"
          items={[
            { label: "Open action items", value: managerMetric(approvals, ["open_action_items", "openActionItems"]) },
            { label: "Attendance corrections", value: managerMetric(approvals, ["pending_attendance_corrections", "pendingAttendanceCorrections"]) },
          ]}
        />
      </div>

      {availableCapabilityItems.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            Available manager actions
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3 md:gap-0">
            {availableCapabilityItems.map(
              ({ label, record: candidate, href, linkLabel, stats }, index) => {
                const record = candidate as AdminRecord;
                const available = readBoolean(record, ["available"]);
                const reason = readString(record, ["reason"]);
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`relative flex min-h-36 flex-col py-1 !no-underline transition-transform duration-200 ease-out hover:z-10 hover:scale-[1.025] hover:!no-underline focus:!no-underline focus-visible:!no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 motion-reduce:transform-none md:px-4 ${index > 0 ? "md:border-l md:border-border/70" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {label}
                      </p>
                      <span
                        className={
                          available
                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }
                      >
                        {available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                    {stats.length > 0 ? (
                      <dl className="mt-3 flex divide-x divide-border/70">
                        {stats.map((stat, statIndex) => (
                          <div
                            key={stat.label}
                            className={
                              statIndex > 0
                                ? "min-w-0 flex-1 pl-3"
                                : "min-w-0 flex-1 pr-3"
                            }
                          >
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {stat.label}
                            </dt>
                            <dd
                              className={`mt-0.5 text-lg font-semibold tabular-nums ${managerAttentionClass(managerMetric(record, stat.keys))}`}
                            >
                              {managerMetric(record, stat.keys)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {reason ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {reason}
                      </p>
                    ) : null}
                    <span className="mt-auto pt-3 text-xs font-semibold text-primary">
                      {linkLabel} →
                    </span>
                  </Link>
                );
              },
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function InsightsOperationsView({
  activeTab,
  embedded = false,
}: {
  activeTab: InsightsOpsTab;
  embedded?: boolean;
}) {
  const actor = useDashboardActor();
  const motionPreset = useDashboardMotion();
  const canAccess =
    embedded ||
    (actor.ready &&
      canAccessDashboardRoute(
        `/dashboard/insights/${activeTab}`,
        actor.permissionLabels,
        actor.accessMode,
      ));
  const leaveIfForbidden = useLeaveIfForbidden();
  useForbiddenRouteGuard(canAccess);

  const [dashboard, setDashboard] = React.useState<AdminRecord | null>(null);
  const [health, setHealth] = React.useState<AdminRecord | null>(null);
  const [live, setLive] = React.useState<AdminRecord | null>(null);
  const [ready, setReady] = React.useState<AdminRecord | null>(null);
  const [readiness, setReadiness] = React.useState<AdminRecord | null>(null);
  const [employees, setEmployees] = React.useState<AdminRecord[]>([]);
  const [events, setEvents] = React.useState<AdminRecord[]>([]);
  const [companyUsers, setCompanyUsers] = React.useState<AdminRecord[]>([]);
  const [setup, setSetup] = React.useState<AdminRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [eventDetail, setEventDetail] = React.useState<AdminRecord | null>(
    null,
  );
  const [readinessDetail, setReadinessDetail] =
    React.useState<AdminRecord | null>(null);
  const [dateFrom, setDateFrom] = React.useState(
    () => defaultScheduleRange().from,
  );
  const [dateTo, setDateTo] = React.useState(() =>
    activeTab === "manager"
      ? localDateString(new Date())
      : defaultScheduleRange().to,
  );
  const [employeeIdFilter, setEmployeeIdFilter] = React.useState("");
  const [employeeIdDraft, setEmployeeIdDraft] = React.useState("");
  const [employeeLookupQuery, setEmployeeLookupQuery] = React.useState("");
  const [employeeLookupResults, setEmployeeLookupResults] = React.useState<
    AdminRecord[]
  >([]);
  const [employeeLookupLoading, setEmployeeLookupLoading] =
    React.useState(false);
  const [salesFieldDetailMetric, setSalesFieldDetailMetric] =
    React.useState<AnalyticsSalesFieldDetailMetric | null>(null);
  const [salesFieldDetails, setSalesFieldDetails] =
    React.useState<AdminRecord | null>(null);
  const [salesFieldDetailsLoading, setSalesFieldDetailsLoading] =
    React.useState(false);
  const [salesFieldDetailsError, setSalesFieldDetailsError] = React.useState<
    string | null
  >(null);
  const [salesFieldDetailsPage, setSalesFieldDetailsPage] = React.useState(1);
  const [salesFieldDetailCurrency, setSalesFieldDetailCurrency] =
    React.useState("");
  const canLookupEmployees = canPerformPermission(
    actor.permissionLabels,
    "employees:read",
  );
  const [policyName, setPolicyName] = React.useState("");
  const [clockInDialogOpen, setClockInDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [previewEmployeeId, setPreviewEmployeeId] = React.useState("");
  const [schedulePreview, setSchedulePreview] =
    React.useState<AdminRecord | null>(null);

  const load = React.useCallback(async () => {
    const token = readStoredToken();
    if (!token) {
      setError("Authentication required. Please log in again.");
      setLoading(false);
      return;
    }
    const trimmedEmployeeId = employeeIdFilter.trim();
    const parsedEmployeeId = trimmedEmployeeId
      ? Number(trimmedEmployeeId)
      : undefined;
    if (
      activeTab !== "readiness" &&
      activeTab !== "manager" &&
      trimmedEmployeeId &&
      (!Number.isSafeInteger(parsedEmployeeId) || (parsedEmployeeId ?? 0) < 1)
    ) {
      setDashboard(null);
      setError("Enter a positive whole employee ID to filter this dashboard.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const tasks: Array<Promise<unknown>> = [];
    if (activeTab !== "readiness") {
      const query = {
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        ...(activeTab !== "manager" && parsedEmployeeId
          ? { employee_id: parsedEmployeeId }
          : {}),
      };
      tasks.push(
        (activeTab === "sales-field"
          ? getAnalyticsDashboard(token, "sales-field", query)
          : activeTab === "manager"
            ? getManagerDashboard(token, query)
            : getHrDashboard(token, activeTab, query)
        )
          .then(setDashboard)
          .catch((errorObject) => {
            setDashboard(null);
            throw errorObject;
          }),
      );
    } else {
      tasks.push(
        getHrLaunchReadiness(token)
          .then(setReadiness)
          .catch((errorObject) => {
            setReadiness(null);
            throw errorObject;
          }),
        getHrLaunchReadinessEmployees(token)
          .then((report) => {
            const record =
              report && typeof report === "object" && !Array.isArray(report)
                ? report
                : null;
            const readinessRows = [
              ...asRecordArray(record?.ready),
              ...asRecordArray(record?.notReady),
            ];
            setEmployees(
              readinessRows.length > 0
                ? readinessRows
                : asRecordArray(record?.items ?? record?.employees ?? report),
            );
          })
          .catch(() => setEmployees([])),
        getSystemHealth(token)
          .then(setHealth)
          .catch(() => setHealth(null)),
        getSystemHealthLive(token)
          .then(setLive)
          .catch(() => setLive(null)),
        getSystemHealthReady(token)
          .then(setReady)
          .catch(() => setReady(null)),
        listSecurityEvents(token, { page: 1, limit: 20 })
          .then(setEvents)
          .catch(() => setEvents([])),
        listCurrentCompanyUsers(token, { page: 1, limit: 100 })
          .then((result) => setCompanyUsers(result.rows))
          .catch(() => setCompanyUsers([])),
        getHrAttendanceSetupStatus(token)
          .then(setSetup)
          .catch(() => setSetup(null)),
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
        isCompanyTimezoneError(first.reason)
          ? "Company timezone setup is required before this dashboard can calculate dates. A platform administrator can set it under Companies → Edit company. Use Africa/Dar_es_Salaam if that matches your company. Refresh this page after it is saved."
          : isPermissionError(first.reason)
          ? activeTab === "manager"
            ? "Your manager dashboard access is not enabled for this account. Ask an administrator to grant manager self-service access."
            : "You do not have access to this dashboard. Ask an administrator to review your permissions."
          : first.reason instanceof Error
            ? first.reason.message
            : "Could not load insights.",
      );
    }
    setLoading(false);
  }, [activeTab, dateFrom, dateTo, employeeIdFilter, leaveIfForbidden]);

  React.useEffect(() => {
    if (!canAccess) return;
    void load();
  }, [canAccess, load]);

  React.useEffect(() => {
    const query = employeeLookupQuery.trim();
    if (
      activeTab === "readiness" ||
      activeTab === "manager" ||
      !canLookupEmployees ||
      !query ||
      employeeIdDraft
    ) {
      setEmployeeLookupResults([]);
      setEmployeeLookupLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const token = readStoredToken();
      if (!token) return;
      setEmployeeLookupLoading(true);
      void listEmployees(
        token,
        { page: 1, limit: 20, search: query },
        { signal: controller.signal },
      )
        .then((result) => setEmployeeLookupResults(result.rows))
        .catch(() => {
          if (!controller.signal.aborted) setEmployeeLookupResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setEmployeeLookupLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activeTab, canLookupEmployees, employeeIdDraft, employeeLookupQuery]);

  React.useEffect(() => {
    setSalesFieldDetails(null);
    setSalesFieldDetailsError(null);
    setSalesFieldDetailMetric(null);
    setSalesFieldDetailsPage(1);
    setSalesFieldDetailCurrency("");
  }, [activeTab, dateFrom, dateTo, employeeIdFilter]);

  const metrics = metricEntries(dashboard);
  const dashboardGeneratedAt = readString(dashboard, [
    "generated_at",
    "generatedAt",
  ]);
  const dashboardTimezone = readString(asRecord(dashboard?.period), [
    "timezone",
  ]);
  const generatedAtDate = dashboardGeneratedAt
    ? new Date(dashboardGeneratedAt)
    : null;
  const blockers = asRecordArray(readiness?.blockers ?? readiness?.items);
  const visibleEmployees = employees.filter(
    (row) =>
      !search ||
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  const visibleEvents = events.filter(
    (row) =>
      !search ||
      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  const actorNames = React.useMemo(() => {
    const byCompanyUserId = new Map<number, string>();
    const byUserId = new Map<number, string>();
    companyUsers.forEach((row) => {
      const nestedUser =
        row.user && typeof row.user === "object"
          ? (row.user as AdminRecord)
          : null;
      const first =
        readString(row, ["first_name", "firstName"]) ||
        (nestedUser ? readString(nestedUser, ["first_name", "firstName"]) : "");
      const last =
        readString(row, ["last_name", "lastName"]) ||
        (nestedUser ? readString(nestedUser, ["last_name", "lastName"]) : "");
      const label =
        [first, last].filter(Boolean).join(" ").trim() ||
        readString(row, ["email", "full_name", "fullName"]) ||
        (nestedUser
          ? readString(nestedUser, ["email", "full_name", "fullName"])
          : "");
      if (!label) {
        return;
      }
      const companyUserId = readNumber(row, [
        "company_user_id",
        "companyUserId",
        "membership_id",
        "membershipId",
      ]);
      if (companyUserId !== null) {
        byCompanyUserId.set(companyUserId, label);
      }
      const userId =
        readNumber(row, [
          "user_id",
          "userId",
          "platform_user_id",
          "platformUserId",
          "id",
        ]) ??
        (nestedUser
          ? readNumber(nestedUser, ["id", "user_id", "userId"])
          : null);
      if (userId !== null) {
        byUserId.set(userId, label);
      }
    });
    return { byCompanyUserId, byUserId };
  }, [companyUsers]);

  async function onWizard() {
    const token = readStoredToken();
    if (!token) return;
    if (!policyName.trim()) {
      toast.error(
        "Type a short name for these clock-in rules, for example Office clock-in.",
      );
      return;
    }
    setSaving(true);
    try {
      const result = await runHrAttendanceSetupWizard(token, {
        policy: { name: policyName.trim() },
      });
      const payload = asRecord(result);
      const details = asRecord(payload?.data) ?? payload;
      const policyId = readNumber(details, ["policyId", "policy_id", "id"]);
      const apiMessage = readString(payload, ["message"]);
      toast.success(
        policyId || /created successfully/i.test(apiMessage)
          ? `Clock-in rules “${policyName.trim()}” are saved. This is a starter set — refine it later under Attendance.`
          : apiMessage || `Clock-in rules “${policyName.trim()}” are saved.`,
      );
      setClockInDialogOpen(false);
      setPolicyName("");
      await load();
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Could not create clock-in rules.";
      toast.error(
        /already exists/i.test(message)
          ? `Clock-in rules named "${policyName.trim()}" already exist. Use a different name only if you want a new set.`
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  async function onPreview() {
    const token = readStoredToken();
    if (!token) return;
    if (!previewEmployeeId) {
      toast.error("Choose an employee to preview their schedule.");
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error("Pick a start and end date.");
      return;
    }
    if (dateTo < dateFrom) {
      toast.error("End date must be on or after the start date.");
      return;
    }
    try {
      const record = await getHrAttendanceSchedulePreview(token, {
        employee_id: Number(previewEmployeeId),
        from_date: dateFrom,
        to_date: dateTo,
      });
      setSchedulePreview(record);
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load that schedule.",
      );
    }
  }

  async function loadSalesFieldDetails(
    metric: AnalyticsSalesFieldDetailMetric,
    page = 1,
    currency = "",
  ) {
    const token = readStoredToken();
    if (!token) {
      setSalesFieldDetailsError(
        "Authentication required. Please log in again.",
      );
      return;
    }
    setSalesFieldDetailMetric(metric);
    const detailCurrency = metric === "OPPORTUNITIES" ? currency : "";
    setSalesFieldDetailCurrency(detailCurrency);
    setSalesFieldDetailsPage(page);
    setSalesFieldDetailsLoading(true);
    setSalesFieldDetailsError(null);
    try {
      const result = await getAnalyticsSalesFieldDetails(token, {
        metric,
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        ...(employeeIdFilter ? { employee_id: Number(employeeIdFilter) } : {}),
        ...(detailCurrency ? { currency: detailCurrency } : {}),
        page,
        limit: 10,
      });
      setSalesFieldDetails(asRecord(result));
    } catch (errorObject) {
      setSalesFieldDetails(null);
      setSalesFieldDetailsError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load sales-field detail rows.",
      );
    } finally {
      setSalesFieldDetailsLoading(false);
    }
  }

  async function onExport() {
    const token = readStoredToken();
    if (!token) return;
    const datasetCode =
      activeTab === "sales-field" ? "sales_field" : "hr_headcount";
    setExporting(true);
    try {
      await exportAnalyticsReport(token, {
        dataset_code: datasetCode,
        dimensions: ["department_name"],
        measures: ["headcount"],
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        output_format: "CSV",
        idempotency_key: `insights-${activeTab}-${Date.now()}`,
      });
      toast.success("Analytics export queued.");
    } catch (errorObject) {
      toast.error(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not export this dashboard.",
      );
    } finally {
      setExporting(false);
    }
  }

  const employeeColumns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "employee",
        label: "Employee",
        render: (row) => readinessPersonName(row),
      },
      {
        key: "shift",
        label: "Has a shift",
        render: (row) =>
          parseReadinessChecks(row).hasShift ? "Yes" : "Not yet",
      },
      {
        key: "clockin",
        label: "How they clock in",
        render: (row) => {
          const checks = parseReadinessChecks(row);
          const methods = [
            checks.hasFingerprint ? "Fingerprint" : null,
            checks.hasCardOrPin ? "Card or PIN" : null,
          ].filter(Boolean);
          return methods.length > 0 ? methods.join(", ") : "Not set up";
        },
      },
      {
        key: "status",
        label: "Can clock in",
        render: (row) => (isEmployeeReady(row) ? "Ready" : "Not ready"),
      },
    ],
    [],
  );

  const eventColumns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "what",
        label: "What they tried",
        render: (row) => describeSecurityEvent(row, actorNames).what,
      },
      {
        key: "who",
        label: "Who",
        render: (row) => describeSecurityEvent(row, actorNames).who,
      },
      {
        key: "when",
        label: "When",
        render: (row) => {
          const when = formatDateTime(
            row.occurred_at ??
              row.occurredAt ??
              row.createdAt ??
              row.created_at ??
              row.timestamp,
          );
          return when === "—" ? "Time not recorded" : when;
        },
      },
    ],
    [actorNames],
  );

  if (!canAccess) return null;

  return (
    <motion.section
      className="space-y-4"
      variants={motionPreset.container}
      initial="hidden"
      animate="show"
    >
      <TalentDoodleSprites />
      {activeTab === "manager" && embedded ? (
        <ManagerWelcomeHeader
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onRefresh={() => void load()}
          loading={loading}
          generatedAt={generatedAtDate}
        />
      ) : <HeroBand
        identity={<DashboardIdentitySummary compact tone="default" />}
        eyebrow={embedded ? "Home" : "Insights"}
        title={
          <>
            {activeTab === "readiness"
              ? "Are we ready?"
              : activeTab === "sales-field"
                ? "Sales and field overview"
                : `${prettify(activeTab)} overview`}
            <TipIcon
              variant="onPrimary"
              text={
                activeTab === "readiness"
                  ? "Check system health, create starter clock-in rules, and review blocked actions."
                  : "A snapshot of how the company is doing for the dates you pick."
              }
            />
          </>
        }
        description={
          activeTab === "manager"
            ? "Team attendance, approvals, and work requiring your attention."
            : undefined
        }
        actions={
          <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto">
            {activeTab !== "readiness" ? (
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                    From
                  </span>
                  <DatePickerPresets
                    value={dateFrom}
                    onChange={setDateFrom}
                    placeholder="Start date"
                    appearance="onPrimary"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                    To
                  </span>
                  <DatePickerPresets
                    value={dateTo}
                    onChange={setDateTo}
                    placeholder="End date"
                    appearance="onPrimary"
                  />
                </label>
              </div>
            ) : null}
            {activeTab !== "readiness" && activeTab !== "manager" ? (
              <div className="relative w-full space-y-1 sm:w-64">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/75">
                  {canLookupEmployees ? "Find employee" : "Employee ID"}
                </span>
                <Input
                  type={canLookupEmployees ? "text" : "number"}
                  min={canLookupEmployees ? undefined : 1}
                  step={canLookupEmployees ? undefined : 1}
                  inputMode={canLookupEmployees ? "search" : "numeric"}
                  value={
                    canLookupEmployees ? employeeLookupQuery : employeeIdDraft
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (canLookupEmployees) {
                      setEmployeeLookupQuery(value);
                      setEmployeeIdDraft("");
                    } else {
                      setEmployeeIdDraft(value);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (employeeIdDraft) {
                        setEmployeeIdFilter(employeeIdDraft);
                      }
                    }
                  }}
                  placeholder={
                    canLookupEmployees
                      ? "Name or employee number"
                      : "All in your scope"
                  }
                  aria-label={
                    canLookupEmployees
                      ? "Search employees within your access scope"
                      : "Filter dashboard by employee ID"
                  }
                  aria-autocomplete={canLookupEmployees ? "list" : undefined}
                  aria-expanded={
                    canLookupEmployees && employeeLookupResults.length > 0
                  }
                  className="h-10 bg-white/95 text-foreground"
                />
                <span className="block text-[10px] text-white/70">
                  {employeeIdFilter
                    ? `Filtered to employee ID ${employeeIdFilter}.`
                    : "Search is access-scoped; the dashboard also enforces scope."}
                </span>
                {canLookupEmployees && employeeLookupLoading ? (
                  <span
                    className="block text-[10px] text-white/75"
                    role="status"
                  >
                    Searching employees…
                  </span>
                ) : null}
                {canLookupEmployees && employeeLookupResults.length > 0 ? (
                  <ul
                    className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                    role="listbox"
                    aria-label="Employee search results"
                  >
                    {employeeLookupResults.map((employee) => {
                      const id = readNumber(employee, [
                        "id",
                        "employee_id",
                        "employeeId",
                      ]);
                      if (id === null) return null;
                      const name =
                        readString(employee, [
                          "full_name",
                          "fullName",
                          "employee_name",
                          "employeeName",
                          "name",
                        ]) ||
                        [
                          readString(employee, ["first_name", "firstName"]),
                          readString(employee, ["middle_name", "middleName"]),
                          readString(employee, ["last_name", "lastName"]),
                        ]
                          .filter(Boolean)
                          .join(" ") ||
                        `Employee #${id}`;
                      const number = readString(employee, [
                        "employee_no",
                        "employeeNumber",
                      ]);
                      return (
                        <li key={id} role="option" aria-selected="false">
                          <button
                            type="button"
                            className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                            onClick={() => {
                              setEmployeeIdDraft(String(id));
                              setEmployeeLookupQuery(
                                `${name}${number ? ` (${number})` : ""}`,
                              );
                              setEmployeeLookupResults([]);
                            }}
                          >
                            <span className="block font-medium">{name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {number || `Employee ID ${id}`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {canLookupEmployees &&
                employeeLookupQuery.trim() &&
                !employeeLookupLoading &&
                employeeLookupResults.length === 0 &&
                !employeeIdDraft ? (
                  <span className="block text-xs text-white/75" role="status">
                    No accessible employees matched that search.
                  </span>
                ) : null}
                <span className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className={`${heroGhostButtonClass} h-8 px-2 text-xs`}
                    onClick={() => setEmployeeIdFilter(employeeIdDraft)}
                    disabled={!employeeIdDraft}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className={`${heroGhostButtonClass} h-8 px-2 text-xs`}
                    disabled={
                      !employeeIdFilter &&
                      !employeeIdDraft &&
                      !employeeLookupQuery
                    }
                    onClick={() => {
                      setEmployeeIdDraft("");
                      setEmployeeLookupQuery("");
                      setEmployeeLookupResults([]);
                      setEmployeeIdFilter("");
                    }}
                  >
                    Clear
                  </button>
                </span>
              </div>
            ) : null}
            {activeTab !== "readiness" && activeTab !== "manager" ? (
              <button
                type="button"
                className={`${heroGhostButtonClass} h-10`}
                onClick={() => void onExport()}
                disabled={exporting}
              >
                {exporting ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : null}
                Export CSV
              </button>
            ) : null}
            <button
              type="button"
              className={`${heroGhostButtonClass} h-10`}
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
        }
      />}
      {error ? <MessageBar intent={error.startsWith("Company timezone setup") ? "warning" : "error"} role="alert"><MessageBarBody><MessageBarTitle>{error.startsWith("Company timezone setup") ? "Company setup needed" : "Dashboard unavailable"}</MessageBarTitle>{error}</MessageBarBody></MessageBar> : null}
      {generatedAtDate && Number.isFinite(generatedAtDate.getTime()) && !(activeTab === "manager" && embedded) ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Dashboard generated {generatedAtDate.toLocaleString()}
          {dashboardTimezone !== "-"
            ? ` · Date boundaries: ${dashboardTimezone}`
            : ""}
        </p>
      ) : null}

      {activeTab !== "readiness" ? (
        <>
          {loading && !dashboard ? (
            <div
              className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground"
              role="status"
            >
              <FluentLoadingIndicator className="mr-2 inline-flex size-4 animate-spin" />
              Loading dashboard data…
            </div>
          ) : null}
          {!loading && !error && !dashboard ? (
            <div
              className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground"
              role="status"
            >
              No dashboard data is available for this view.
            </div>
          ) : null}
          {activeTab === "manager" ? (
            dashboard ? <ManagerDashboardPanels dashboard={dashboard} /> : null
          ) : (
            <>
              <DashboardMetricPanels
                dashboard={dashboard}
                activeTab={activeTab}
                dateFrom={dateFrom}
                dateTo={dateTo}
                employeeIdFilter={employeeIdFilter}
                onLoadSalesFieldDetails={loadSalesFieldDetails}
                onCloseSalesFieldDetails={() => {
                  setSalesFieldDetailMetric(null);
                  setSalesFieldDetails(null);
                  setSalesFieldDetailCurrency("");
                }}
                salesFieldDetailMetric={salesFieldDetailMetric}
                salesFieldDetails={salesFieldDetails}
                salesFieldDetailsLoading={salesFieldDetailsLoading}
                salesFieldDetailsError={salesFieldDetailsError}
                salesFieldDetailsPage={salesFieldDetailsPage}
                salesFieldDetailCurrency={salesFieldDetailCurrency}
                canManageDocumentRequirements={canPerformPermission(
                  actor.permissionLabels,
                  "employees:update",
                )}
                onRefreshDashboard={() => {
                  void load();
                }}
              />
              {activeTab === "management" ? (
                <>
                  <ScopedInsightPanels dashboard={dashboard} />
                </>
              ) : null}
              <motion.div
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                variants={motionPreset.fast}
              >
                {metrics.length > 0 ? (
                  metrics.map((item) => (
                    <MetricTile
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  ))
                ) : (
                  <MetricTile
                    label="Records"
                    value={dashboard ? "Loaded" : "—"}
                    hint="No numeric tiles in this payload."
                  />
                )}
              </motion.div>
            </>
          )}
        </>
      ) : (
        <>
          <motion.div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            variants={motionPreset.fast}
          >
            <MetricTile
              label="System"
              value={
                <span className="text-primary">
                  {friendlyStatus(
                    readString(
                      health,
                      ["status", "state"],
                      health ? "OK" : "—",
                    ),
                  )}
                </span>
              }
            />
            <MetricTile
              label="Online"
              value={
                <span className="text-primary">
                  {friendlyStatus(
                    readString(live, ["status", "state"], live ? "OK" : "—"),
                  )}
                </span>
              }
            />
            <MetricTile
              label="Ready to use"
              value={
                <span className="text-primary">
                  {friendlyStatus(
                    readString(ready, ["status", "state"], ready ? "OK" : "—"),
                  )}
                </span>
              }
            />
            <MetricTile
              label="Issues to fix"
              value={
                <span className="text-primary">
                  {readNumber(readiness, [
                    "blockerCount",
                    "blocker_count",
                    "blockers",
                  ]) ?? blockers.length}
                </span>
              }
            />
          </motion.div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-semibold">Set up clock-in</h2>
                <TipIcon text="Creating rules here only builds a starter set. Refine devices, maps, and shifts later under Attendance." />
              </div>
              {readString(asRecord(setup?.activePolicy), ["name"]) ? (
                <p className="mt-2 text-sm text-foreground">
                  Clock-in rules already exist:{" "}
                  <span className="font-medium">
                    {readString(asRecord(setup?.activePolicy), ["name"])}
                  </span>
                  .
                </p>
              ) : (
                <button
                  type="button"
                  className={`${primaryButtonClass} mt-3`}
                  onClick={() => setClockInDialogOpen(true)}
                >
                  Set up clock-in
                </button>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Preview a work schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a person and dates to see planned start and end times.
                This does not clock them in.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Employee
                  </span>
                  <FluentSelect
                    ariaLabel="Employee"
                    className="w-full"
                    value={previewEmployeeId}
                    onChange={setPreviewEmployeeId}
                    placeholder="Select an employee"
                    options={[
                      { value: "", label: "Select an employee" },
                      ...employees.flatMap((row) => {
                        const id = readNumber(row, [
                          "id",
                          "employee_id",
                          "employeeId",
                        ]);
                        if (id === null) return [];
                        return [
                          { value: String(id), label: employeeLabel(row) },
                        ];
                      }),
                    ]}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    From
                  </span>
                  <DatePickerPresets
                    value={dateFrom}
                    onChange={setDateFrom}
                    placeholder="Start date"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    To
                  </span>
                  <DatePickerPresets
                    value={dateTo}
                    onChange={setDateTo}
                    placeholder="End date"
                  />
                </label>
                <button
                  type="button"
                  className={`${secondaryButtonClass} sm:col-span-2`}
                  onClick={() => void onPreview()}
                >
                  Show planned hours
                </button>
              </div>
            </div>
          </div>
          {blockers.length > 0 ? (
            <motion.ul className="grid gap-2" variants={motionPreset.fast}>
              {blockers.map((item, index) => (
                <motion.li
                  key={rowId(item) || index}
                  variants={motionPreset.item}
                  className="border-l-2 border-amber-400 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
                >
                  {readString(
                    item,
                    ["message", "title", "code"],
                    optionLabel(item),
                  )}
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
          <SearchToggleField
            value={search}
            onChange={setSearch}
            placeholder="Search people or activity"
          />
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Employee"
              toolbarStart={
                <TipIcon text="Who can clock in, and what they still need." />
              }
              data={visibleEmployees}
              columns={employeeColumns}
              loading={loading}
              itemsPerPage={20}
              showExport={false}
              storageKey="insights-readiness-employees"
              onRowSelect={(_, row) => row && setReadinessDetail(row)}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ResizableTable
              title="Blocked action"
              toolbarStart={
                <TipIcon text="Times someone tried to open a page they do not have permission to use." />
              }
              data={visibleEvents}
              columns={eventColumns}
              loading={false}
              itemsPerPage={20}
              showExport={false}
              storageKey="insights-security-events"
              onRowSelect={(_, row) => row && setEventDetail(row)}
            />
          </div>
        </>
      )}

      <AlertDialog open={clockInDialogOpen} onOpenChange={setClockInDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set up clock-in</AlertDialogTitle>
            <AlertDialogDescription>
              Give this starter set a simple label, then create it. Example:
              “Office clock-in”. This is not a person or a time — just a name so
              you can find the rules later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
            No clock-in rules yet. People cannot punch in until you create this
            set.
          </p>
          <FormField className="mt-3" label="Name for these clock-in rules" htmlFor="clock-in-policy-name">
            <Input
              id="clock-in-policy-name"
              value={policyName}
              onChange={(event) => setPolicyName(event.target.value)}
              placeholder="Office clock-in"
            />
          </FormField>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <button
              type="button"
              className={primaryButtonClass}
              disabled={saving}
              onClick={() => void onWizard()}
            >
              {saving ? (
                <FluentLoadingIndicator className="size-4 animate-spin" />
              ) : (
                "Create clock-in rules"
              )}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(schedulePreview)}
        onOpenChange={(open) => !open && setSchedulePreview(null)}
      >
        <DialogPopup from="bottom" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule</DialogTitle>
            <DialogDescription>
              {employees.find(
                (row) =>
                  String(
                    readNumber(row, ["id", "employee_id", "employeeId"]),
                  ) === previewEmployeeId,
              )
                ? readinessPersonName(
                    employees.find(
                      (row) =>
                        String(
                          readNumber(row, ["id", "employee_id", "employeeId"]),
                        ) === previewEmployeeId,
                    ) as AdminRecord,
                  )
                : "Selected employee"}{" "}
              · {formatDate(dateFrom)} to {formatDate(dateTo)}
            </DialogDescription>
          </DialogHeader>
          {schedulePreviewDays(schedulePreview).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scheduled days in this range.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
              {schedulePreviewDays(schedulePreview).map((day, index) => {
                const dateLabel = formatDate(
                  day.date ?? day.work_date ?? day.workDate ?? day.day,
                );
                const shift = readString(
                  day,
                  [
                    "shift_name",
                    "shiftName",
                    "shift",
                    "status",
                    "kind",
                    "type",
                  ],
                  "",
                );
                const start = readString(
                  day,
                  ["start_time", "startTime", "in", "planned_in"],
                  "",
                );
                const end = readString(
                  day,
                  ["end_time", "endTime", "out", "planned_out"],
                  "",
                );
                const hours =
                  start && end && start !== "-" && end !== "-"
                    ? `${start} – ${end}`
                    : shift && shift !== "-"
                      ? shift
                      : "Off";
                return (
                  <li
                    key={`${dateLabel}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-1.5"
                  >
                    <span>
                      {dateLabel === "—" ? `Day ${index + 1}` : dateLabel}
                    </span>
                    <span className="font-medium">{hours}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              onClick={() => setSchedulePreview(null)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(readinessDetail)}
        onOpenChange={(open) => !open && setReadinessDetail(null)}
      >
        <DialogPopup from="bottom" className="sm:max-w-md">
          {readinessDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {readinessPersonName(readinessDetail)}
                </DialogTitle>
                <DialogDescription>
                  {isEmployeeReady(readinessDetail)
                    ? "Ready to clock in."
                    : readinessIssueText(readinessDetail) ||
                      "Not ready to clock in yet."}
                </DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-sm">
                {readinessCheckItems(readinessDetail).map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-2.5 py-1.5"
                  >
                    <span>{item.label}</span>
                    <span
                      className={
                        item.done
                          ? "font-medium text-emerald-700"
                          : "font-medium text-amber-700"
                      }
                    >
                      {item.done ? "Done" : "Missing"}
                    </span>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => setReadinessDetail(null)}
                >
                  Close
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogPopup>
      </Dialog>

      <Dialog
        open={Boolean(eventDetail)}
        onOpenChange={(open) => !open && setEventDetail(null)}
      >
        <DialogPopup from="bottom" className="sm:max-w-md">
          {eventDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>Access was blocked</DialogTitle>
                <DialogDescription>
                  {describeSecurityEvent(eventDetail, actorNames).who} was
                  stopped from opening something they cannot use.
                </DialogDescription>
              </DialogHeader>
              <dl className="grid gap-2 text-sm">
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    What they tried
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {describeSecurityEvent(eventDetail, actorNames).what}
                  </dd>
                </div>
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Why
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {describeSecurityEvent(eventDetail, actorNames).why}
                  </dd>
                </div>
                <div className="rounded-md border border-border/60 px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    When
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDateTime(
                      describeSecurityEvent(eventDetail, actorNames).whenRaw,
                    ) === "—"
                      ? "Time not recorded"
                      : formatDateTime(
                          describeSecurityEvent(eventDetail, actorNames)
                            .whenRaw,
                        )}
                  </dd>
                </div>
              </dl>
              <DialogFooter>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  onClick={() => setEventDetail(null)}
                >
                  Close
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogPopup>
      </Dialog>
    </motion.section>
  );
}
