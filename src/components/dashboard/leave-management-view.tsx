"use client";
import { RecalculateLeaveBalanceButton } from "@/components/leave/leave-recalculation-dialog"
import { downloadLeavePdfWithFallback } from "@/lib/leave-pdf-download"
import { ActingEmployeePanel, type ActingDraft } from "@/components/leave/acting-employee-panel"

import { Button } from "@/components/ui/button";
import { fluentConfirm, fluentForm } from "@/components/ui/fluent-dialog-service";
import { Input } from "@/components/ui/input";
import { leaveEvidenceMessage } from "@/lib/leave-evidence";
import {
  extendLeaveEvidenceDeadline,
  retryLeaveRouting,
} from "@/lib/admin-api";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { useDashboardIdentity } from "@/components/dashboard/dashboard-identity";
import {
  LeaveWorkflowEditorSheet,
  type LeaveWorkflowEditorStep,
} from "@/components/dashboard/leave-workflow-editor-sheet";
import {
  LeavePolicyEditorSheet,
  emptyLeavePolicyForm,
} from "@/components/dashboard/leave-policy-editor-sheet";
import { LeavePolicyPreviewSheet } from "@/components/dashboard/leave-policy-preview-sheet";
import { LeaveTypesCatalog } from "@/components/dashboard/leave-types-catalog";
import { LeavePoliciesCatalog } from "@/components/dashboard/leave-policies-catalog";
import { LeaveWorkflowsCatalog } from "@/components/dashboard/leave-workflows-catalog";
import { LeaveWorkflowStepDialog } from "@/components/dashboard/leave-workflow-step-dialog";
import { LeaveTeamCalendar } from "@/components/dashboard/leave-team-calendar";
import { canSeeHrLeaveRequestsQueue } from "@/lib/dashboard-home";
import { canPerformPermission } from "@/lib/dashboard-permissions";
import { LEAVE_BALANCE_IMPORT_PERMISSIONS } from "@/lib/leave-balance-import";
import { ResizableTable } from "@/components/ui/resizable-table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Paperclip,
  ShieldOff,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { SearchToggleField } from "@/components/common/search-toggle-field";

import {
  addLeaveRequestDocument,
  adjustLeaveBalance,
  type LeaveBalanceAdjustMode,
  cancelLeaveRequest,
  endLeaveEarly,
  carryForwardLeaveBalances,
  createLeaveHoliday,
  createLeavePolicy,
  createLeaveRequest,
  createLeaveType,
  createLeaveWorkflow,
  createLeaveWorkflowStep,
  deleteLeaveHoliday,
  deleteLeavePolicy,
  deleteLeaveType,
  deleteLeaveWorkflow,
  deleteLeaveWorkflowStep,
  downloadLeaveRequestDocument,
  downloadLeaveRequestPdf,
  downloadLeaveImportTemplate,
  fileToBase64UploadDto,
  getCurrentAdmin,
  getLeavePolicy,
  getLeaveRequest,
  getLeaveWorkflow,
  leaveRequestApprovalAction,
  revokeLeaveVerificationCode,
  listBranches,
  listDepartments,
  listEmployeeGrades,
  listAllEmployees,
  generateLeaveBalances,
  previewLeaveRequests,
  confirmLeaveRequestsImport,
  listLeaveBalanceAdjustments,
  listLeaveBalanceTransactions,
  decideLeaveEncashmentRequest,
  listLeaveEncashmentRequests,
  recordLeaveEncashmentPayment,
  recordLeaveEncashmentPayrollHandoff,
  listAllLeaveBalanceReconciliation,
  listLeaveOpeningPreviewReviews,
  recordLeaveOpeningPreviewReview,
  listAllLeaveBalances,
  listEmployeesWithoutLeaveBalances,
  listLeaveHolidays,
  listLeavePolicies,
  listLeaveRequests,
  getLeaveRequestSummary,
  bulkLeaveApprovalAction,
  listAllLeaveRequests,
  listAllLeaveTypes,
  listLeaveWorkflowSteps,
  listLeaveWorkflows,
  listPositions,
  listResource,
  patchLeaveHoliday,
  patchLeavePolicy,
  patchLeaveRequestMedicalDetail,
  patchLeaveType,
  patchLeaveWorkflow,
  resubmitLeaveRequest,
  submitLeaveRequest,
  patchLeaveWorkflowStep,
  type AdminRecord,
  type LeaveImportResult,
} from "@/lib/admin-api";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import {
  formatBalanceDays,
  groupLeaveBalancesByEmployee,
  readBalanceDays,
  readBalanceEmployeeId,
  readBalanceFiscalYear,
  resolveLeaveBalanceEmployeeName,
  sortLeaveBalanceRows,
  type LeaveBalanceEmployeeGroup,
} from "@/lib/leave-balance-groups";
import { isMedicalLeaveRequest } from "@/lib/leave-request-kind";
import { LeaveManagementRulesPanel } from "@/components/dashboard/leave-management-rules-panel";
import { LeaveHrOperationsPanel } from "@/components/leave/leave-hr-operations-panel";
import { LeaveSignaturesPanel } from "@/components/leave/leave-signatures-panel";
import { useLeaveDecisionSignature } from "@/components/leave/leave-decision-sign-dialog";
import { LeaveDelegationsPanel } from "@/components/leave/leave-delegations-panel";
import { LeaveCompOffPanel } from "@/components/leave/leave-comp-off-panel";
import { LeaveReportDownloads } from "@/components/leave/leave-report-downloads";
import {
  LeaveRequestPreviewPanel,
  useLeaveRequestPreview,
} from "@/components/leave/leave-request-preview";
import { LeavePolicyVersionsPanel } from "@/components/leave/leave-policy-versions-panel";
import { reverseLeaveEncashment } from "@/lib/leave-engine-api";
import {
  leavePolicyRecordToForm,
  leavePolicyTypeCarryForwardPayload,
  leavePolicyEnginePayload,
  type LeavePolicyFormValue,
} from "@/lib/leave-policy-form";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DatePickerPresets } from "@/components/ui/date-picker-presets";
import { FluentSelect } from "@/components/ui/fluent-select";
import {
  TalentDoodleSprites,
} from "@/components/dashboard/talent-visuals";
import ExampleProgress from "@/components/ui/progress-1";
import { showErrorAlert } from "@/lib/error-alert";
import { showSuccessAlert } from "@/lib/success-alert";
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
import {
  WorkflowChoiceCard,
  WorkflowSelect,
} from "@/components/dashboard/leave-workflow-ui";
import { MarkCheckbox } from "@/components/ui/mark-checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TOKEN_STORAGE_KEY = "hrms.admin.accessToken";
const WORKFLOW_CREATE_DRAFT_KEY = "hrms.leaveWorkflow.createDraft.v1";

type WorkflowCreateDraft = {
  form: {
    name: string;
    leave_type_id: string;
    status: string;
    is_default: string;
    reminder_after_days?: string;
    escalate_after_days?: string;
    max_escalations?: string;
  };
  steps: AdminRecord[];
  stage: "details" | "path";
};

function readWorkflowCreateDraft(): WorkflowCreateDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_CREATE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkflowCreateDraft;
    if (!parsed?.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWorkflowCreateDraft(draft: WorkflowCreateDraft) {
  window.localStorage.setItem(WORKFLOW_CREATE_DRAFT_KEY, JSON.stringify(draft));
}

function clearWorkflowCreateDraft() {
  window.localStorage.removeItem(WORKFLOW_CREATE_DRAFT_KEY);
}

type LeaveTab =
  | "types"
  | "requests"
  | "team-calendar"
  | "balances"
  | "transactions"
  | "reports"
  | "holidays"
  | "policies"
  | "workflows";
type LeaveLookupKey =
  | "types"
  | "employees"
  | "departments"
  | "positions"
  | "branches"
  | "roles"
  | "grades";
type LeaveManagementViewProps = {
  activeTab?: LeaveTab;
  showTabButtons?: boolean;
};

type LeaveTypeWizardStep = "details" | "rules" | "review";

const LEAVE_TYPE_WIZARD_STEPS: Array<{
  key: LeaveTypeWizardStep;
  number: string;
  label: string;
}> = [
  { key: "details", number: "01", label: "Basic details" },
  { key: "rules", number: "02", label: "Usage rules" },
  { key: "review", number: "03", label: "Review" },
];

type LeaveRequestWizardStep = "who" | "when" | "review";

const LEAVE_REQUEST_WIZARD_STEPS: Array<{
  key: LeaveRequestWizardStep;
  number: string;
  label: string;
}> = [
  { key: "who", number: "01", label: "Who & type" },
  { key: "when", number: "02", label: "Dates" },
  { key: "review", number: "03", label: "Review" },
];

function emptyLeaveRequestForm() {
  return {
    employee_id: "",
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    notice_override_reason: "",
    submit: "true",
  };
}

function LeaveTypeField({
  label,
  help,
  className,
  children,
}: {
  label: string;
  help: string;
  className?: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const generatedId = React.useId();
  const controlId = children.props.id ?? generatedId;

  return (
    <div className={cn("grid min-w-0 gap-1", className)}>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <label htmlFor={controlId}>{label}</label>
        <Popover>
          <PopoverTrigger
            className="inline-flex size-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={`${label}: ${help}`}
          >
            <Info className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-64 p-3 text-left text-xs font-normal leading-relaxed"
          >
            {help}
          </PopoverContent>
        </Popover>
      </span>
      {React.cloneElement(children, { id: controlId })}
    </div>
  );
}

const leaveTypeControlClass =
  "mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border dark:bg-background dark:text-foreground";

function createEmptyLeaveTypeForm() {
  return {
    name: "",
    code: "",
    description: "",
    status: "active",
    is_paid: "true",
    requires_attachment: "false",
    allow_deferred_attachment: "false",
    attachment_grace_days: "3",
    attachment_required_after_days: "",
    auto_approve_after_days: "",
    is_carry_forward_allowed: "false",
    sandwich_rule: "false",
    max_carry_forward_days: "0",
    max_days_per_year: "0",
    gender_restriction: "any",
  };
}

function createEmptyLeaveMedicalForm() {
  return {
    sickness_nature: "",
    doctor_name: "",
    doctor_phone: "",
    hospital_name: "",
    treatment_start_date: "",
    treatment_end_date: "",
    attachment_url: "",
  };
}

type WorkflowStepPayload = {
  approval_level: number;
  approver_type: string;
  action_type: string;
  role_id?: number;
  position_id?: number;
  company_user_id?: number;
  assigned_branch_id?: number;
  assigned_department_id?: number;
  is_required: boolean;
};

type HolidayImportCountryCode = "TZ" | "KE" | "UG";

type ImportableHoliday = {
  countryCode: HolidayImportCountryCode;
  countryName: string;
  name: string;
  localName: string;
  holidayDate: string;
  isRecurring: boolean;
  type: string;
};

const HOLIDAY_IMPORT_COUNTRIES: Array<{
  code: HolidayImportCountryCode;
  label: string;
}> = [
  { code: "TZ", label: "Tanzania" },
  { code: "KE", label: "Kenya" },
  { code: "UG", label: "Uganda" },
];

const TRANSACTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  INITIAL_ALLOCATION: "Initial leave days assigned to an employee.",
  ACCRUAL: "Leave days earned through the configured accrual process.",
  RECALCULATION:
    "Balance rebuilt after a policy, holiday, or calculation change.",
  ADJUSTMENT: "Manual balance increase or decrease recorded by HR.",
  CARRY_FORWARD: "Unused days moved into a new leave year.",
  TAKEN: "Days consumed by an approved leave request.",
  RESERVED: "Days held while a leave request is pending approval.",
  RESERVATION_RELEASED:
    "Held days returned after a request is cancelled or rejected.",
  CANCELLED_REVERSAL: "Previously consumed days restored after cancellation.",
  EXPIRED: "Days removed because their validity period ended.",
  MANUAL_CORRECTION:
    "A direct correction made to resolve a balance discrepancy.",
  ATTENDANCE_DEDUCTION: "Days deducted by an attendance or absence rule.",
  ENCASHMENT: "Unused days paid out as money instead of leave.",
  LAPSED:
    "Unused days not carried into the next year; recorded at year end.",
};

function formatTransactionType(value: string) {
  if (!value || value === "-") {
    return "-";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const TAB_LOOKUP_REQUIREMENTS: Record<LeaveTab, LeaveLookupKey[]> = {
  types: [],
  requests: ["employees", "types", "departments"],
  "team-calendar": [],
  balances: ["employees", "types"],
  transactions: ["employees", "types"],
  reports: [],
  holidays: [],
  policies: ["types", "departments", "positions", "branches", "grades"],
  workflows: [],
};

function readStoredToken() {
  if (typeof window === "undefined") {
    return "";
  }

  const direct = window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? "";
  if (direct) {
    return direct;
  }

  const authTokensRaw = window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens);
  if (!authTokensRaw) {
    return "";
  }

  try {
    const parsed = JSON.parse(authTokensRaw) as {
      accessToken?: string;
      access_token?: string;
    };
    return (parsed.accessToken ?? parsed.access_token ?? "").trim();
  } catch {
    return "";
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return asRecord(JSON.parse(atob(padded)));
  } catch {
    return null;
  }
}

function readString(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "-";
}

function readNumber(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function readBoolean(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") {
        return true;
      }
      if (value.toLowerCase() === "false") {
        return false;
      }
    }
  }
  return false;
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

function readDisplayValue(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
  }
  return "-";
}

function formatLeaveDateTime(value: string) {
  if (!value || value === "-") {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leaveTypeIdFromRow(row: AdminRecord) {
  const direct = readNumber(row, [
    "leave_type_id",
    "leaveTypeId",
    "type_id",
    "typeId",
  ]);
  if (direct !== null) {
    return direct;
  }
  const nested =
    asRecord(row.leave_type) ?? asRecord(row.leaveType) ?? asRecord(row.type);
  if (nested) {
    return readNumber(nested, [
      "id",
      "leave_type_id",
      "leaveTypeId",
      "type_id",
      "typeId",
    ]);
  }
  return null;
}

function emptyBalanceForm() {
  return {
    employee_id: "",
    leave_type_id: "",
    fiscal_year: String(new Date().getFullYear()),
    mode: "SET" as LeaveBalanceAdjustMode,
    amount: "0",
    remaining: "0",
    reason: "",
    cap_override_reason: "",
  };
}

function formFromBalanceRow(row: AdminRecord) {
  const remaining = readBalanceDays(row, [
    "remaining_days",
    "remaining",
    "remainingDays",
  ]);
  return {
    employee_id: String(
      readBalanceEmployeeId(row) ??
        readNumber(row, ["employee_id", "employeeId"]) ??
        "",
    ),
    leave_type_id: String(leaveTypeIdFromRow(row) ?? ""),
    fiscal_year:
      readString(row, ["fiscal_year", "fiscalYear"]) === "-"
        ? String(new Date().getFullYear())
        : readString(row, ["fiscal_year", "fiscalYear"]),
    mode: "SET" as LeaveBalanceAdjustMode,
    amount: String(remaining),
    remaining: String(remaining),
    reason: "",
    cap_override_reason: "",
  };
}

function normalizeHolidayValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function readHolidayDate(row: AdminRecord) {
  const raw = readString(row, [
    "holiday_date",
    "date",
    "from_date",
    "start_date",
  ]);
  return raw === "-" ? "" : (raw.split("T")[0]?.split(" ")[0] ?? raw);
}

function holidayMatchKey(name: string, date: string) {
  return `${normalizeHolidayValue(name)}::${date.trim()}`;
}

function progressPercent(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((completed / total) * 100);
}

function readLeaveTypeId(row: AdminRecord | null | undefined) {
  if (!row) {
    return null;
  }
  return readNumber(row, ["id", "leave_type_id", "leaveTypeId"]);
}

function readLeaveHolidayId(row: AdminRecord | null | undefined) {
  if (!row) {
    return null;
  }
  return readNumber(row, [
    "id",
    "holiday_id",
    "leave_holiday_id",
    "leaveHolidayId",
  ]);
}

function buildWorkflowStepPayload(form: {
  approval_level: string;
  approver_type: string;
  action_type: string;
  role_id: string;
  position_id: string;
  company_user_id: string;
  assigned_branch_id: string;
  assigned_department_id: string;
  is_required: string;
}): WorkflowStepPayload {
  return {
    approval_level: Number(form.approval_level),
    approver_type: form.approver_type,
    action_type: form.action_type,
    role_id: form.role_id ? Number(form.role_id) : undefined,
    position_id: form.position_id ? Number(form.position_id) : undefined,
    company_user_id: form.company_user_id
      ? Number(form.company_user_id)
      : undefined,
    assigned_branch_id: form.assigned_branch_id
      ? Number(form.assigned_branch_id)
      : undefined,
    assigned_department_id: form.assigned_department_id
      ? Number(form.assigned_department_id)
      : undefined,
    is_required: form.is_required === "true",
  };
}

function leaveRequestLabel(row: AdminRecord) {
  const title = readString(row, ["leave_no", "request_no", "title", "reason"]);
  if (title !== "-") return title;
  const employeeId = readNumber(row, ["employee_id"]);
  if (employeeId !== null) return `Employee #${employeeId} request`;
  const id = readNumber(row, ["id"]);
  return id === null ? "Unnamed request" : `Request #${id}`;
}

type SearchableOption = {
  value: string;
  label: string;
};

const LEAVE_WORKFLOW_STATUS_LABELS: Record<string, string> = {
  pending_department_manager: "Pending manager",
  pending_hr: "Pending HR",
  in_review: "Pending management",
  returned_for_correction: "Returned",
};

function StatusIndicator({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  const label =
    LEAVE_WORKFLOW_STATUS_LABELS[normalized] ??
    (status
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || "—");

  const tone = ["active", "approved", "completed", "present"].includes(
    normalized,
  )
    ? "good"
    : ["inactive", "rejected", "cancelled", "canceled", "terminated"].includes(
          normalized,
        )
      ? "bad"
      : [
            "pending",
            "submitted",
            "in_review",
            "pending_department_manager",
            "pending_hr",
            "returned_for_correction",
            "draft",
            "probation",
            "suspended",
          ].includes(normalized)
        ? "warn"
        : "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        tone === "good" && "text-emerald-600 dark:text-emerald-400",
        tone === "bad" && "text-rose-600 dark:text-rose-400",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "neutral" && "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "good" && "bg-emerald-500",
          tone === "bad" && "bg-rose-500",
          tone === "warn" && "bg-amber-500",
          tone === "neutral" && "bg-muted-foreground/50",
        )}
      />
      {label}
    </span>
  );
}

type LeaveActor = {
  membershipId: number | null;
  userId: number | null;
  email: string;
  employeeId: number | null;
  isCompanyAdmin: boolean;
  /** Approvers/HR may cancel any open or approved request (backend: leave_requests:approve). */
  canCancelAny?: boolean;
  /** HR may act in place of an unavailable manager (leave_requests:override). */
  canOverride?: boolean;
};

type LeaveApprovalRecord = {
  id: number | null;
  level: number;
  status: string;
  companyUserId: number | null;
  userId: number | null;
  email: string;
  name: string;
  actedAt: string;
  comments: string;
  isCurrentLevel: boolean;
};

function asRecordList(value: unknown): AdminRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AdminRecord => !!entry && typeof entry === "object",
  );
}

function personName(record: AdminRecord | null, fallback = "Unknown") {
  if (!record) return fallback;
  const full = readString(record, ["full_name", "fullName", "name"]);
  if (full !== "-") return full;
  const first = readString(record, ["first_name", "firstName"]);
  const last = readString(record, ["last_name", "lastName"]);
  const composed = [first !== "-" ? first : "", last !== "-" ? last : ""]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || fallback;
}

function resolveLeaveActor(
  token: string,
  profile: AdminRecord | null,
): LeaveActor {
  const jwt = decodeJwtPayload(token);
  const membershipId =
    readNumber(jwt ?? {}, [
      "membershipId",
      "membership_id",
      "company_user_id",
      "companyUserId",
    ]) ??
    readNumber(profile ?? {}, [
      "membership_id",
      "membershipId",
      "company_user_id",
      "companyUserId",
    ]);
  const userId =
    readNumber(jwt ?? {}, ["sub", "user_id", "userId", "id"]) ??
    readNumber(profile ?? {}, ["id", "user_id", "userId"]);
  const email = (
    readString(jwt ?? {}, ["email"]) !== "-"
      ? readString(jwt ?? {}, ["email"])
      : readString(profile ?? {}, ["email"])
  )
    .trim()
    .toLowerCase();
  const employeeId = readNumber(profile ?? {}, ["employee_id", "employeeId"]);
  const roleNames = Array.isArray(jwt?.roles)
    ? jwt!.roles.map((role) => String(role).toLowerCase())
    : asRecordList(profile?.roles).map((role) =>
        readString(role, ["name", "display_name"]).toLowerCase(),
      );
  const isCompanyAdmin = roleNames.some(
    (role) => role.includes("company_admin") || role.includes("admin"),
  );

  return {
    membershipId,
    userId,
    email: email === "-" ? "" : email,
    employeeId,
    isCompanyAdmin,
  };
}

function getLeaveApprovals(row: AdminRecord): LeaveApprovalRecord[] {
  const currentLevel =
    readNumber(row, ["current_approval_level", "currentApprovalLevel"]) ?? 0;

  const approvalKeys = [
    "approvals",
    "approval_chain",
    "approvalChain",
    "leave_request_approvals",
    "leaveRequestApprovals",
    "workflow_approvals",
    "workflowApprovals",
  ] as const;

  let source = asRecordList(row.approvals);
  if (source.length === 0) {
    for (const key of approvalKeys) {
      const list = asRecordList(row[key]);
      if (list.length > 0) {
        source = list;
        break;
      }
    }
  }

  const currentCycle = readNumber(row, ["approval_cycle", "approvalCycle"]);
  if (currentCycle !== null && source.length > 0) {
    const cycleFiltered = source.filter((approval) => {
      const cycle = readNumber(approval, ["approval_cycle", "approvalCycle"]);
      return cycle === null || cycle === currentCycle;
    });
    if (cycleFiltered.length > 0) {
      source = cycleFiltered;
    }
  }

  return source
    .map((approval) => {
      const approver =
        asRecord(approval.approver) ??
        asRecord(approval.company_user) ??
        asRecord(approval.companyUser);
      const nestedUser = asRecord(approver?.user);
      const level =
        readNumber(approval, ["approval_level", "approvalLevel", "level"]) ?? 0;
      const status = readString(approval, ["status"]).toLowerCase();
      const approverName =
        personName(approver, "") ||
        personName(nestedUser, "") ||
        readString(approval, ["approver_name", "approverName", "name"]) ||
        "Approver";
      return {
        id: readNumber(approval, ["id"]),
        level,
        status: status === "-" ? "pending" : status,
        companyUserId: readNumber(approval, [
          "approver_company_user_id",
          "approverCompanyUserId",
          "company_user_id",
          "companyUserId",
        ]),
        userId:
          readNumber(nestedUser ?? {}, ["id", "user_id", "userId"]) ??
          readNumber(approver ?? {}, ["user_id", "userId", "id"]),
        email: (
          readString(approver ?? {}, ["email"]) ||
          readString(nestedUser ?? {}, ["email"])
        ).toLowerCase(),
        name: approverName,
        actedAt:
          readString(approval, [
            "acted_at",
            "actedAt",
            "updated_at",
            "updatedAt",
          ]) === "-"
            ? ""
            : readString(approval, [
                "acted_at",
                "actedAt",
                "updated_at",
                "updatedAt",
              ]),
        comments:
          readString(approval, ["comments", "comment", "notes"]) === "-"
            ? ""
            : readString(approval, ["comments", "comment", "notes"]),
        isCurrentLevel: currentLevel > 0 ? level === currentLevel : level === 1,
      };
    })
    .sort(
      (a, b) => a.level - b.level || (a.name || "").localeCompare(b.name || ""),
    );
}

function isLeaveActorMatch(actor: LeaveActor, approval: LeaveApprovalRecord) {
  if (
    actor.membershipId !== null &&
    approval.companyUserId !== null &&
    actor.membershipId === approval.companyUserId
  ) {
    return true;
  }
  if (
    actor.userId !== null &&
    approval.userId !== null &&
    actor.userId === approval.userId
  ) {
    return true;
  }
  if (actor.email && approval.email && actor.email === approval.email) {
    return true;
  }
  return false;
}

function normalizeLeaveStatusLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function isLeaveRequestTerminalStatus(status: string) {
  const normalized = normalizeLeaveStatusLabel(status);
  return [
    "rejected",
    "cancelled",
    "canceled",
    "completed",
    "approved",
  ].includes(normalized);
}

function isLeaveRequestApprovalOpenStatus(status: string) {
  const normalized = normalizeLeaveStatusLabel(status);
  if (!normalized || isLeaveRequestTerminalStatus(normalized)) {
    return false;
  }
  return (
    normalized === "pending" ||
    normalized === "submitted" ||
    normalized === "in review" ||
    normalized.includes("pending") ||
    normalized.includes("awaiting") ||
    normalized.includes("review")
  );
}

function getLeaveRequestPermissions(
  row: AdminRecord,
  actor: LeaveActor | null,
) {
  const status = readString(row, ["status"]).toLowerCase();
  const normalizedStatus = normalizeLeaveStatusLabel(status);
  const isTerminal = isLeaveRequestTerminalStatus(status);
  const approvals = getLeaveApprovals(row);
  const currentLevel =
    readNumber(row, ["current_approval_level", "currentApprovalLevel"]) ??
    (status === "in_review" || status === "submitted" ? 1 : 0);

  const pendingAtCurrent = approvals.filter(
    (approval) =>
      approval.status === "pending" &&
      (currentLevel > 0
        ? approval.level === currentLevel
        : approval.isCurrentLevel),
  );

  const myPending = actor
    ? pendingAtCurrent.find((approval) => isLeaveActorMatch(actor, approval))
    : undefined;

  const canApproveOrReject =
    row.routing_required !== true &&
    !isTerminal &&
    Boolean(myPending) &&
    isLeaveRequestApprovalOpenStatus(status);

  const employeeId = readNumber(row, ["employee_id", "employeeId"]);
  const nestedEmployee = asRecord(row.employee);
  const requestEmployeeId =
    employeeId ?? readNumber(nestedEmployee ?? {}, ["id"]);
  const isOwner =
    actor !== null &&
    ((actor.employeeId !== null &&
      requestEmployeeId !== null &&
      actor.employeeId === requestEmployeeId) ||
      (actor.userId !== null &&
        readNumber(nestedEmployee ?? {}, ["user_id", "userId"]) ===
          actor.userId));

  // Owners may cancel approved leave too; the backend enforces start date and cutoff rules.
  const canCancel =
    !isTerminal &&
    Boolean(actor) &&
    (isOwner || Boolean(actor?.isCompanyAdmin) || Boolean(actor?.canCancelAny));

  // HR stepping in for an unavailable manager (backend: hr_override at level 1).
  const canOverride =
    !canApproveOrReject &&
    !isOwner &&
    row.routing_required !== true &&
    status === "pending_department_manager" &&
    Boolean(actor?.canOverride);

  const pendingNames = pendingAtCurrent
    .map((approval) => approval.name)
    .filter(Boolean);
  const waitingLabel = isTerminal
    ? normalizedStatus === "approved"
      ? "All approvals completed"
      : normalizedStatus === "rejected"
        ? currentLevel > 0
          ? `Rejected at level ${currentLevel}`
          : "Request rejected"
        : normalizedStatus === "completed"
          ? "Leave completed"
          : normalizedStatus === "cancelled" || normalizedStatus === "canceled"
            ? "Request cancelled"
            : "Request closed"
    : pendingNames.length === 0
      ? currentLevel > 0
        ? `Waiting at level ${currentLevel}`
        : "No active approver"
      : pendingNames.length === 1
        ? `Pending: ${pendingNames[0]}`
        : `Pending: ${pendingNames[0]} +${pendingNames.length - 1}`;

  return {
    status,
    isTerminal,
    canApproveOrReject,
    canCancel,
    canOverride,
    currentLevel,
    myPending,
    pendingAtCurrent,
    waitingLabel,
    approvals,
    reasonApprove: canApproveOrReject
      ? "You can approve this request at the current level."
      : isTerminal
        ? "This request is already closed."
        : pendingAtCurrent.length === 0
          ? "No pending approval step is available."
          : `Waiting for ${pendingNames.join(", ") || "another approver"} at level ${currentLevel || "—"}.`,
    reasonCancel: canCancel
      ? "You can cancel this request."
      : isTerminal
        ? "This request is already closed."
        : "Only the requester, an approver or a company admin can cancel this request.",
  };
}

function formatLeaveRequestCardDate(value: string) {
  if (!value || value === "-") return "Not set";
  const dateOnly = value.slice(0, 10);
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function leaveRequestDuration(row: AdminRecord) {
  const start = readString(row, ["start_date"]);
  const end = readString(row, ["end_date"]);
  if (!start || !end || start === "-" || end === "-") return "";
  const startDate = new Date(`${start.slice(0, 10)}T00:00:00`);
  const endDate = new Date(`${end.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return "";
  const days =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (days < 1) return "";
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function ApprovalChain({
  row,
  actor,
  compact = false,
}: {
  row: AdminRecord;
  actor: LeaveActor | null;
  compact?: boolean;
}) {
  const permissions = getLeaveRequestPermissions(row, actor);
  const levels = Array.from(
    new Set(permissions.approvals.map((item) => item.level)),
  ).sort((a, b) => a - b);

  if (permissions.approvals.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", compact && "mt-2")}>
        No approval chain is attached to this request yet.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col", compact ? "mt-3 gap-2" : "gap-3")}>
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Approval chain</p>
          <p className="text-[11px] text-muted-foreground">
            {permissions.waitingLabel}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {permissions.waitingLabel}
        </p>
      )}

      <ol className="relative flex flex-col gap-0 border-l border-border/80 pl-4">
        {levels.map((level) => {
          const items = permissions.approvals.filter(
            (item) => item.level === level,
          );
          const isCurrent =
            !permissions.isTerminal &&
            permissions.currentLevel > 0 &&
            level === permissions.currentLevel;
          const levelDone =
            items.length > 0 &&
            items.every((item) => item.status === "approved");
          const levelRejected = items.some(
            (item) => item.status === "rejected",
          );

          return (
            <li
              key={`approval-level-${level}`}
              className="relative pb-4 last:pb-0"
            >
              <span
                className={cn(
                  "absolute top-1.5 -left-[1.28rem] size-2.5 rounded-full ring-4 ring-background",
                  levelRejected
                    ? "bg-rose-500"
                    : levelDone
                      ? "bg-emerald-500"
                      : isCurrent
                        ? "bg-amber-500"
                        : "bg-muted-foreground/40",
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-foreground">
                  Level {level}
                </p>
                {isCurrent ? (
                  <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    Current
                  </span>
                ) : null}
                {levelDone ? (
                  <span className="text-[10px] font-medium text-emerald-600">
                    Complete
                  </span>
                ) : null}
              </div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {items.map((item) => {
                  const mine = actor ? isLeaveActorMatch(actor, item) : false;
                  return (
                    <li
                      key={`${item.id ?? item.name}-${item.level}-${item.companyUserId ?? item.userId}`}
                      className={cn(
                        "rounded-md border border-border/60 px-2.5 py-2",
                        isCurrent &&
                          item.status === "pending" &&
                          "border-amber-500/30 bg-amber-500/5",
                        mine &&
                          item.status === "pending" &&
                          "ring-1 ring-primary/30",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-foreground">
                            {item.name}
                            {mine ? (
                              <span className="ml-1 text-[10px] font-normal text-primary">
                                (you)
                              </span>
                            ) : null}
                          </p>
                          {item.email && item.email !== "-" ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {item.email}
                            </p>
                          ) : null}
                        </div>
                        <StatusIndicator status={item.status} />
                      </div>
                      {item.comments ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {item.comments}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LeaveManagementView({
  activeTab = "types",
  showTabButtons = true,
}: LeaveManagementViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const actor = useDashboardActor();
  const identity = useDashboardIdentity();
  // Approve = sign: every leave decision is signed (typed or drawn).
  const [signDialog, askSignature] = useLeaveDecisionSignature();
  const canCreateTypes = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_types:create", "leave_types:update"],
    mode: "any",
  });
  const canOverrideBalanceCap = canPerformPermission(
    actor.permissionLabels,
    "leave_balances:override_cap",
  );
  const canDeleteTypes = canPerformPermission(
    actor.permissionLabels,
    "leave_types:delete",
  );
  const canCreateRequests = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_requests:create", "leave_requests:update"],
    mode: "any",
  });
  const canReadTypes = canPerformPermission(
    actor.permissionLabels,
    "leave_types:read",
  );
  const canReadRequests = canSeeHrLeaveRequestsQueue({
    homeDashboardKind: identity.homeDashboardKind,
    accessMode: actor.accessMode,
    scope: actor.scope,
    permissionLabels: actor.permissionLabels,
    roleNames: actor.roleNames,
  });
  const canReadTeamCalendar = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_requests:read", "leave_requests:approve"],
    mode: "any",
  });
  const canReadBalances = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "leave_balances:read",
      "leave_balances:list",
      "leave_balances:manage",
    ],
    mode: "any",
  });
  const canReadLeaveReports = canReadBalances || canReadRequests;
  const canBulkDecide = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_requests:approve"],
    mode: "any",
  });
  const canOverrideManager = canPerformPermission(
    actor.permissionLabels,
    "leave_requests:override",
  );
  const canAdjustBalances = canPerformPermission(actor.permissionLabels, {
    permissions: [
      "leave_balances:update",
      "leave_balances:create",
      "leave_balances:manage",
    ],
    mode: "any",
  });
  const canUseBalanceBulkImport = canPerformPermission(actor.permissionLabels, {
    permissions: [
      LEAVE_BALANCE_IMPORT_PERMISSIONS.export,
      LEAVE_BALANCE_IMPORT_PERMISSIONS.bulkImport,
      LEAVE_BALANCE_IMPORT_PERMISSIONS.history,
    ],
    mode: "any",
  });
  const canReadHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:read", "attendance_holidays:read"],
    mode: "any",
  });
  const canCreateHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:create", "attendance_holidays:create"],
    mode: "any",
  });
  const canUpdateHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:update", "attendance_holidays:update"],
    mode: "any",
  });
  const canDeleteHolidays = canPerformPermission(actor.permissionLabels, {
    permissions: ["holidays:delete", "attendance_holidays:delete"],
    mode: "any",
  });
  const canReadPolicies = canPerformPermission(
    actor.permissionLabels,
    "leave_policies:read",
  );
  const canCreatePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:create"],
    mode: "any",
  });
  const canUpdatePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:update"],
    mode: "any",
  });
  const canDeletePolicies = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_policies:delete"],
    mode: "any",
  });
  const canReadWorkflows = canPerformPermission(
    actor.permissionLabels,
    "leave_workflows:read",
  );
  const canCreateWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:create"],
    mode: "any",
  });
  const canUpdateWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:update"],
    mode: "any",
  });
  const canDeleteWorkflows = canPerformPermission(actor.permissionLabels, {
    permissions: ["leave_workflows:delete"],
    mode: "any",
  });
  const highlightedRequestId = React.useMemo(
    () =>
      searchParams?.get("highlight") ??
      searchParams?.get("requestId") ??
      searchParams?.get("request_id") ??
      "",
    [searchParams],
  );
  const [tab, setTab] = React.useState<LeaveTab>(activeTab);
  const [types, setTypes] = React.useState<AdminRecord[]>([]);
  const [requests, setRequests] = React.useState<AdminRecord[]>([]);
  const [requestSearch, setRequestSearch] = React.useState("");
  const [evidenceDeadline, setEvidenceDeadline] = React.useState("");
  const [evidenceReason, setEvidenceReason] = React.useState("");
  const [requestStatusFilter, setRequestStatusFilter] = React.useState("all");
  // Approval queue views are filtered server-side by the active approval level.
  const [requestView, setRequestView] = React.useState<
    "all" | "pending_my_approval" | "my_approval_history"
  >("all");
  const [pendingMyApprovalCount, setPendingMyApprovalCount] = React.useState<
    number | null
  >(null);
  // Server-side request list: filters, paging and bulk selection.
  const [requestFilters, setRequestFilters] = React.useState({
    department_id: "",
    manager_employee_id: "",
    leave_type_id: "",
    from_date: "",
    to_date: "",
  });
  const [requestPage, setRequestPage] = React.useState(1);
  const [requestMeta, setRequestMeta] = React.useState<{
    total: number | null;
    totalPages: number | null;
  }>({ total: null, totalPages: null });
  const [selectedRequestIds, setSelectedRequestIds] = React.useState<string[]>(
    [],
  );
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const requestQueryRef = React.useRef({
    page: 1,
    view: "all" as "all" | "pending_my_approval" | "my_approval_history",
    status: "all",
    search: "",
    filters: {
      department_id: "",
      manager_employee_id: "",
      leave_type_id: "",
      from_date: "",
      to_date: "",
    },
  });
  const [transactionSearch, setTransactionSearch] = React.useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] =
    React.useState("all");

  const [balances, setBalances] = React.useState<AdminRecord[]>([]);
  const [balanceYear, setBalanceYear] = React.useState(String(new Date().getFullYear()));
  const [balanceSearch, setBalanceSearch] = React.useState("");
  const [balanceType, setBalanceType] = React.useState("all");
  const [balanceStatus, setBalanceStatus] = React.useState("all");
  const [balanceDepartment, setBalanceDepartment] = React.useState("all");
  const [missingBalances, setMissingBalances] = React.useState<AdminRecord[]>([]);
  const [missingPage, setMissingPage] = React.useState(1);
  const [missingTotalPages, setMissingTotalPages] = React.useState<number | null>(null);
  const [missingError, setMissingError] = React.useState("");
  const [missingLoading, setMissingLoading] = React.useState(false);
  const [balanceAdjustments, setBalanceAdjustments] = React.useState<
    AdminRecord[]
  >([]);
  const [balanceTransactions, setBalanceTransactions] = React.useState<
    AdminRecord[]
  >([]);
  const [reconciliationOpen, setReconciliationOpen] = React.useState(false);
  const [reconciliationRows, setReconciliationRows] = React.useState<
    AdminRecord[]
  >([]);
  const [reconciliationLoading, setReconciliationLoading] =
    React.useState(false);
  // Reconcile uses the same year as the balance list filter.
  const reconciliationYear = balanceYear;
  const [leaveReportKind, setLeaveReportKind] = React.useState<
    "balances" | "taken" | "pending" | "encashments"
  >("taken");
  const [encashmentRows, setEncashmentRows] = React.useState<AdminRecord[]>([]);
  const [encashmentLoading, setEncashmentLoading] = React.useState(false);
  const [leaveReportYear, setLeaveReportYear] = React.useState(
    String(new Date().getFullYear()),
  );
  const [leaveReportFrom, setLeaveReportFrom] = React.useState("");
  const [leaveReportTo, setLeaveReportTo] = React.useState("");
  const [leaveReportLoading, setLeaveReportLoading] = React.useState(false);
  const [holidays, setHolidays] = React.useState<AdminRecord[]>([]);
  const [policies, setPolicies] = React.useState<AdminRecord[]>([]);
  const [workflows, setWorkflows] = React.useState<AdminRecord[]>([]);
  const [employees, setEmployees] = React.useState<AdminRecord[]>([]);
  const [departments, setDepartments] = React.useState<AdminRecord[]>([]);
  const [positions, setPositions] = React.useState<AdminRecord[]>([]);
  const [branches, setBranches] = React.useState<AdminRecord[]>([]);
  const [roles, setRoles] = React.useState<AdminRecord[]>([]);
  const [grades, setGrades] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pendingTypeDelete, setPendingTypeDelete] =
    React.useState<AdminRecord | null>(null);
  const [pendingHolidayDelete, setPendingHolidayDelete] =
    React.useState<AdminRecord | null>(null);
  const [pendingRequestCancel, setPendingRequestCancel] =
    React.useState<AdminRecord | null>(null);
  const [pendingPolicyDelete, setPendingPolicyDelete] =
    React.useState<AdminRecord | null>(null);
  const [pendingWorkflowDelete, setPendingWorkflowDelete] =
    React.useState<AdminRecord | null>(null);
  const [typeDialogOpen, setTypeDialogOpen] = React.useState(false);
  const [typeDialogStep, setTypeDialogStep] =
    React.useState<LeaveTypeWizardStep>("details");
  const [requestDialogOpen, setRequestDialogOpen] = React.useState(false);
  const [requestDialogStep, setRequestDialogStep] =
    React.useState<LeaveRequestWizardStep>("who");
  const [requestImportOpen, setRequestImportOpen] = React.useState(false);
  const [requestImportFile, setRequestImportFile] = React.useState<File | null>(
    null,
  );
  const [requestImportResult, setRequestImportResult] =
    React.useState<LeaveImportResult | null>(null);
  const [requestImportBusy, setRequestImportBusy] = React.useState(false);
  const [requestTemplateBusy, setRequestTemplateBusy] = React.useState(false);
  const [balanceDialogOpen, setBalanceDialogOpen] = React.useState(false);
  const [holidayDialogOpen, setHolidayDialogOpen] = React.useState(false);
  const [holidayImportDialogOpen, setHolidayImportDialogOpen] =
    React.useState(false);
  const [holidayRemoveDialogOpen, setHolidayRemoveDialogOpen] =
    React.useState(false);
  const [policySheetOpen, setPolicySheetOpen] = React.useState(false);
  const [editingPolicyId, setEditingPolicyId] = React.useState<number | null>(
    null,
  );
  const [policyPreviewOpen, setPolicyPreviewOpen] = React.useState(false);
  const [policyPreviewLoading, setPolicyPreviewLoading] = React.useState(false);
  const [policyPreviewForm, setPolicyPreviewForm] =
    React.useState<LeavePolicyFormValue | null>(null);
  const policyPreviewRequestRef = React.useRef(0);
  const [selectedPolicyRow, setSelectedPolicyRow] =
    React.useState<AdminRecord | null>(null);
  const [selectedBalanceRow, setSelectedBalanceRow] =
    React.useState<AdminRecord | null>(null);
  const [selectedBalanceGroup, setSelectedBalanceGroup] =
    React.useState<LeaveBalanceEmployeeGroup | null>(null);
  const [employeeBalanceDetailsOpen, setEmployeeBalanceDetailsOpen] =
    React.useState(false);
  const [balanceHistory, setBalanceHistory] = React.useState<AdminRecord[]>([]);
  const [balanceHistoryPage, setBalanceHistoryPage] = React.useState(1);
  const [balanceHistoryError, setBalanceHistoryError] = React.useState("");
  const [balanceHistoryLoading, setBalanceHistoryLoading] = React.useState(false);
  const [returnToEmployeeBalances, setReturnToEmployeeBalances] =
    React.useState(false);
  const returnToEmployeeBalancesRef = React.useRef(false);
  const selectedBalanceGroupRef =
    React.useRef<LeaveBalanceEmployeeGroup | null>(null);
  selectedBalanceGroupRef.current = selectedBalanceGroup;
  const [overrideDialog, setOverrideDialog] = React.useState<{
    row: AdminRecord;
    action: "approve" | "reject" | "return_for_correction";
  } | null>(null);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [balanceBulkDialog, setBalanceBulkDialog] = React.useState<
    null | "generate" | "carry-forward"
  >(null);
  const [balanceBulkYear, setBalanceBulkYear] = React.useState(
    String(new Date().getFullYear()),
  );
  const [workflowSteps, setWorkflowSteps] = React.useState<AdminRecord[]>([]);
  const [workflowSheetOpen, setWorkflowSheetOpen] = React.useState(false);
  const [workflowStartStage, setWorkflowStartStage] = React.useState<
    "details" | "path"
  >("details");
  const [workflowDraft, setWorkflowDraft] =
    React.useState<WorkflowCreateDraft | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = React.useState(false);
  const [editingWorkflowId, setEditingWorkflowId] = React.useState<
    number | null
  >(null);
  const [editingWorkflowStepId, setEditingWorkflowStepId] = React.useState<
    number | null
  >(null);
  const [editingLeaveTypeRow, setEditingLeaveTypeRow] =
    React.useState<AdminRecord | null>(null);
  const [selectedLeaveRequestRow, setSelectedLeaveRequestRow] =
    React.useState<AdminRecord | null>(null);
  const [leaveRequestDetailsOpen, setLeaveRequestDetailsOpen] =
    React.useState(false);
  // Acting employee chosen in the request detail; sent with the approval.
  const actingDraftRef = React.useRef<{ id: number; draft: ActingDraft } | null>(null);
  const actingDraftRequestId = React.useRef<number | null>(null);
  const handleActingDraft = React.useCallback((draft: ActingDraft) => {
    const id = actingDraftRequestId.current;
    actingDraftRef.current = id !== null && draft ? { id, draft } : null;
  }, []);
  const [requestDetailTab, setRequestDetailTab] = React.useState<
    "overview" | "approvals" | "documents" | "medical"
  >("overview");
  const [currentActor, setCurrentActor] = React.useState<LeaveActor | null>(
    null,
  );
  const [cancelReason, setCancelReason] = React.useState("Cancelled by admin");
  const [leaveMedicalForm, setLeaveMedicalForm] = React.useState(
    createEmptyLeaveMedicalForm,
  );
  const [leaveMedicalAttachmentFile, setLeaveMedicalAttachmentFile] =
    React.useState<File | null>(null);
  const [leaveDocumentFile, setLeaveDocumentFile] = React.useState<File | null>(
    null,
  );
  const leaveMedicalAttachmentInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState("");
  const [holidayImportCountry, setHolidayImportCountry] =
    React.useState<HolidayImportCountryCode>("TZ");
  const [holidayImportYear, setHolidayImportYear] = React.useState(
    String(new Date().getFullYear()),
  );
  const [holidayImportCatalog, setHolidayImportCatalog] = React.useState<
    ImportableHoliday[]
  >([]);
  const [holidayImportLoading, setHolidayImportLoading] = React.useState(false);
  const [holidayImportBusy, setHolidayImportBusy] = React.useState(false);
  const [holidayImportError, setHolidayImportError] = React.useState<
    string | null
  >(null);
  const [holidayImportProgress, setHolidayImportProgress] = React.useState<{
    completed: number;
    total: number;
    label: string;
  } | null>(null);
  const [holidayRemoveCountry, setHolidayRemoveCountry] =
    React.useState<HolidayImportCountryCode>("TZ");
  const [holidayRemoveYear, setHolidayRemoveYear] = React.useState(
    String(new Date().getFullYear()),
  );
  const [holidayRemoveCatalog, setHolidayRemoveCatalog] = React.useState<
    ImportableHoliday[]
  >([]);
  const [holidayRemoveLoading, setHolidayRemoveLoading] = React.useState(false);
  const [holidayRemoveBusy, setHolidayRemoveBusy] = React.useState(false);
  const [holidayRemoveError, setHolidayRemoveError] = React.useState<
    string | null
  >(null);
  const [holidayRemoveProgress, setHolidayRemoveProgress] = React.useState<{
    completed: number;
    total: number;
    label: string;
  } | null>(null);
  const [loadedLookups, setLoadedLookups] = React.useState<
    Record<LeaveLookupKey, boolean>
  >({
    types: false,
    employees: false,
    departments: false,
    positions: false,
    branches: false,
    roles: false,
    grades: false,
  });

  const [typeForm, setTypeForm] = React.useState(createEmptyLeaveTypeForm);

  const [requestForm, setRequestForm] = React.useState(emptyLeaveRequestForm);
  // Server dry run of the request being filed (day count, documents,
  // notice, balance) once employee, type and dates are chosen.
  const requestPreviewPayload = React.useMemo(() => {
    if (
      !requestDialogOpen ||
      requestDialogStep === "who" ||
      !requestForm.employee_id ||
      !requestForm.leave_type_id ||
      !requestForm.start_date ||
      !requestForm.end_date ||
      requestForm.end_date < requestForm.start_date
    )
      return null;
    return {
      employee_id: Number(requestForm.employee_id),
      leave_type_id: Number(requestForm.leave_type_id),
      start_date: requestForm.start_date,
      end_date: requestForm.end_date,
      ...(requestForm.notice_override_reason.trim().length >= 5
        ? { notice_override_reason: requestForm.notice_override_reason.trim() }
        : {}),
    };
  }, [
    requestDialogOpen,
    requestDialogStep,
    requestForm.employee_id,
    requestForm.leave_type_id,
    requestForm.start_date,
    requestForm.end_date,
    requestForm.notice_override_reason,
  ]);
  const requestPreview = useLeaveRequestPreview({
    token: requestDialogOpen ? readStoredToken() || null : null,
    mode: "hr",
    payload: requestPreviewPayload,
  });
  const noticeOverrideNeeded = Boolean(
    requestPreview.preview &&
      !requestPreview.preview.notice.satisfied &&
      requestPreview.preview.notice.days_until_start > 0,
  );

  const [balanceForm, setBalanceForm] = React.useState(emptyBalanceForm);

  const [holidayForm, setHolidayForm] = React.useState({
    name: "",
    holiday_date: "",
    is_recurring: "false",
  });

  const [policyForm, setPolicyForm] = React.useState(emptyLeavePolicyForm);

  const [workflowForm, setWorkflowForm] = React.useState({
    name: "",
    leave_type_id: "",
    status: "active",
    is_default: "false",
    reminder_after_days: "",
    escalate_after_days: "",
    max_escalations: "",
  });

  const [workflowStepForm, setWorkflowStepForm] = React.useState({
    approval_level: "1",
    approver_type: "role",
    action_type: "recommend",
    role_id: "",
    position_id: "",
    company_user_id: "",
    assigned_branch_id: "",
    assigned_department_id: "",
    is_required: "true",
  });

  const visibleLeaveTabs = React.useMemo(
    () =>
      [
        {
          key: "types" as LeaveTab,
          label: "Leave Types",
          visible: canReadTypes,
        },
        {
          key: "requests" as LeaveTab,
          label: "Leave Requests",
          visible: canReadRequests,
        },
        {
          key: "team-calendar" as LeaveTab,
          label: "Team Calendar",
          visible: canReadTeamCalendar,
        },
        {
          key: "balances" as LeaveTab,
          label: "Leave Balances",
          visible: canReadBalances,
        },
        {
          key: "transactions" as LeaveTab,
          label: "Balance Transactions",
          visible: canReadBalances,
        },
        {
          key: "reports" as LeaveTab,
          label: "Leave Reports",
          visible: canReadLeaveReports,
        },
        {
          key: "holidays" as LeaveTab,
          label: "Holidays",
          visible: canReadHolidays,
        },
        {
          key: "policies" as LeaveTab,
          label: "Leave Policies",
          visible: canReadPolicies,
        },
        {
          key: "workflows" as LeaveTab,
          label: "Leave Workflows",
          visible: canReadWorkflows,
        },
      ].filter((entry) => entry.visible),
    [
      canReadBalances,
      canReadLeaveReports,
      canReadHolidays,
      canReadPolicies,
      canReadRequests,
      canReadTeamCalendar,
      canReadTypes,
      canReadWorkflows,
    ],
  );

  React.useEffect(() => {
    setWorkflowDraft(readWorkflowCreateDraft());
  }, []);

  React.useEffect(() => {
    if (!canReadRequests && canReadBalances) setLeaveReportKind("balances");
  }, [canReadBalances, canReadRequests]);

  React.useEffect(() => {
    if (!actor.ready || activeTab !== "requests" || canReadRequests) {
      return;
    }
    const fallback = visibleLeaveTabs.find((entry) => entry.key !== "requests");
    router.replace(
      fallback
        ? `/dashboard/leave-management/${fallback.key}`
        : "/dashboard/leave-management",
    );
  }, [activeTab, actor.ready, canReadRequests, router, visibleLeaveTabs]);

  const hydrateLeaveMedicalForm = React.useCallback(
    (row: AdminRecord | null) => {
      const medical = row ? asRecord(row.medical_detail) : null;
      const readMedicalValue = (key: string) => {
        if (!medical) {
          return "";
        }
        const value = readString(medical, [key]);
        return value === "-" ? "" : value;
      };
      setLeaveMedicalForm({
        sickness_nature: readMedicalValue("sickness_nature"),
        doctor_name: readMedicalValue("doctor_name"),
        doctor_phone: readMedicalValue("doctor_phone"),
        hospital_name: readMedicalValue("hospital_name"),
        treatment_start_date:
          readMedicalValue("treatment_start_date")
            .replace("T", " ")
            .split(" ")[0] ?? "",
        treatment_end_date:
          readMedicalValue("treatment_end_date")
            .replace("T", " ")
            .split(" ")[0] ?? "",
        attachment_url: readMedicalValue("attachment_url"),
      });
    },
    [],
  );

  const leaveRequestDocuments = React.useMemo(() => {
    if (
      !selectedLeaveRequestRow ||
      !Array.isArray(selectedLeaveRequestRow.documents)
    ) {
      return [] as AdminRecord[];
    }
    return selectedLeaveRequestRow.documents
      .map((value) => asRecord(value))
      .filter((value): value is AdminRecord => Boolean(value));
  }, [selectedLeaveRequestRow]);

  React.useEffect(() => {
    setEvidenceDeadline("");
    setEvidenceReason("");
    hydrateLeaveMedicalForm(selectedLeaveRequestRow);
    setLeaveMedicalAttachmentFile(null);
    if (leaveMedicalAttachmentInputRef.current) {
      leaveMedicalAttachmentInputRef.current.value = "";
    }
    setLeaveDocumentFile(null);
  }, [hydrateLeaveMedicalForm, selectedLeaveRequestRow]);

  const loadedLookupsRef = React.useRef(loadedLookups);
  loadedLookupsRef.current = loadedLookups;

  const loadLookups = React.useCallback(
    async (token: string, lookupKeys: LeaveLookupKey[], force = false) => {
      const missingKeys = force
        ? lookupKeys
        : lookupKeys.filter((key) => !loadedLookupsRef.current[key]);
      if (missingKeys.length === 0) {
        return;
      }

      const results = await Promise.all(
        missingKeys.map(async (key) => {
          switch (key) {
            case "types":
              return {
                key,
                result: await listAllLeaveTypes(
                  token,
                  { sortBy: "created_at", sortOrder: "DESC" },
                  { cacheTtlMs: force ? 0 : undefined },
                ),
              };
            case "employees":
              return {
                key,
                result: {
                  rows: await listAllEmployees(
                    token,
                    {},
                    { cacheTtlMs: force ? 0 : undefined },
                  ),
                },
              };
            case "departments":
              return {
                key,
                result: await listDepartments(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              };
            case "positions":
              return {
                key,
                result: await listPositions(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              };
            case "branches":
              return {
                key,
                result: await listBranches(token, {
                  page: 1,
                  limit: 100,
                  sortBy: "created_at",
                  sortOrder: "DESC",
                }),
              };
            case "roles":
              return {
                key,
                result: await listResource("roles", token).then((rows) => ({
                  rows,
                  page: 1,
                  limit: 100,
                  total: rows.length,
                  totalPages: 1,
                })),
              };
            case "grades":
              return {
                key,
                result: {
                  rows: await listEmployeeGrades(token),
                },
              };
          }
        }),
      );

      results.forEach((entry) => {
        if (!entry) {
          return;
        }
        switch (entry.key) {
          case "types":
            setTypes(entry.result.rows);
            break;
          case "employees":
            setEmployees(entry.result.rows);
            break;
          case "departments":
            setDepartments(entry.result.rows);
            break;
          case "positions":
            setPositions(entry.result.rows);
            break;
          case "branches":
            setBranches(entry.result.rows);
            break;
          case "roles":
            setRoles(entry.result.rows);
            break;
          case "grades":
            setGrades(entry.result.rows);
            break;
        }
      });

      setLoadedLookups((current) => {
        let changed = false;
        const next = { ...current };
        missingKeys.forEach((key) => {
          if (!next[key]) {
            next[key] = true;
            changed = true;
          }
        });
        return changed ? next : current;
      });
    },
    [],
  );

  const ensureLookups = React.useCallback(
    async (lookupKeys: LeaveLookupKey[], force = false) => {
      const token = readStoredToken();
      if (!token) {
        const message = "Authentication required. Please log in again.";
        setError(message);
        showErrorAlert(message);
        return false;
      }

      if (lookupKeys.length === 0) {
        return true;
      }

      const missingKeys = force
        ? lookupKeys
        : lookupKeys.filter((key) => !loadedLookupsRef.current[key]);
      if (missingKeys.length === 0) {
        return true;
      }

      setLoading(true);
      setError(null);
      try {
        await loadLookups(token, lookupKeys, force);
        return true;
      } catch (errorObject) {
        const message =
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load form data.";
        setError(message);
        showErrorAlert(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadLookups],
  );

  requestQueryRef.current = {
    page: requestPage,
    view: requestView,
    status: requestStatusFilter,
    search: requestSearch,
    filters: requestFilters,
  };

  const reloadAll = React.useCallback(
    async (targetTab: LeaveTab = tab, force = false) => {
      const token = readStoredToken();
      if (!token) {
        const message = "Authentication required. Please log in again.";
        setError(message);
        showErrorAlert(message);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await loadLookups(token, TAB_LOOKUP_REQUIREMENTS[targetTab], force);

        switch (targetTab) {
          case "types": {
            const result = await listAllLeaveTypes(
              token,
              { sortBy: "created_at", sortOrder: "DESC" },
              { cacheTtlMs: force ? 0 : undefined },
            );
            setTypes(result.rows);
            break;
          }
          case "requests": {
            const query = requestQueryRef.current;
            // Evidence and routing views filter the current page client-side.
            const clientOnlyStatus = [
              "all",
              "evidence_overdue",
              "evidence_pending",
              "routing_required",
            ].includes(query.status);
            const toId = (value: string) =>
              value ? Number(value) : undefined;
            const result = await listLeaveRequests(token, {
              view: query.view,
              page: query.page,
              limit: 25,
              sortBy: "created_at",
              sortOrder: "DESC",
              status: clientOnlyStatus ? undefined : query.status,
              search: query.search.trim() || undefined,
              department_id: toId(query.filters.department_id),
              manager_employee_id: toId(query.filters.manager_employee_id),
              leave_type_id: toId(query.filters.leave_type_id),
              from_date: query.filters.from_date || undefined,
              to_date: query.filters.to_date || undefined,
            });
            setRequests(result.rows);
            void getLeaveRequestSummary(token, { view: "pending_my_approval" })
              .then((summary) =>
                setPendingMyApprovalCount(summary.pending_my_approval),
              )
              .catch(() => setPendingMyApprovalCount(null));
            setRequestMeta({
              total: result.total ?? null,
              totalPages: result.totalPages ?? null,
            });
            setSelectedRequestIds([]);
            break;
          }
          case "team-calendar": {
            break;
          }
          case "balances": {
            const result = await listAllLeaveBalances(
              token,
              { sortBy: "created_at", sortOrder: "DESC" },
              { cacheTtlMs: force ? 0 : undefined },
            );
            setBalances(result.rows);
            const adjustments = await listLeaveBalanceAdjustments(token, {
              limit: 50,
            }).catch(() => []);
            setBalanceAdjustments(adjustments);
            break;
          }
          case "transactions": {
            const transactions = await listLeaveBalanceTransactions(token, {
              limit: 50,
            }).catch(() => []);
            setBalanceTransactions(transactions);
            break;
          }
          case "holidays": {
            const result = await listLeaveHolidays(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            });
            setHolidays(result.rows);
            break;
          }
          case "policies": {
            const result = await listLeavePolicies(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            });
            setPolicies(result.rows);
            break;
          }
          case "workflows": {
            const result = await listLeaveWorkflows(token, {
              page: 1,
              limit: 100,
              sortBy: "created_at",
              sortOrder: "DESC",
            });
            setWorkflows(result.rows);
            break;
          }
        }
      } catch (errorObject) {
        const message =
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load leave management data.";
        setError(message);
        showErrorAlert(message);
      } finally {
        setLoading(false);
      }
    },
    [loadLookups, tab],
  );

  React.useEffect(() => {
    const fallbackTab = visibleLeaveTabs[0]?.key ?? activeTab;
    const nextTab = visibleLeaveTabs.some((entry) => entry.key === activeTab)
      ? activeTab
      : fallbackTab;
    setTab((current) => (current === nextTab ? current : nextTab));
  }, [activeTab, visibleLeaveTabs]);

  React.useEffect(() => {
    const fallbackTab = visibleLeaveTabs[0]?.key;
    if (!fallbackTab) {
      return;
    }
    if (!visibleLeaveTabs.some((entry) => entry.key === tab)) {
      setTab(fallbackTab);
    }
  }, [tab, visibleLeaveTabs]);

  // Always refetch the active tab when it changes (or on login remount).
  // Previously we skipped after the first load via loadedTabs, so new leave
  // requests/workflows created elsewhere never appeared until a full hard refresh.
  React.useEffect(() => {
    void reloadAll(tab, false);
  }, [reloadAll, tab]);

  // Filters change the result set, so they restart at page 1.
  React.useEffect(() => {
    setRequestPage(1);
  }, [requestFilters, requestSearch, requestStatusFilter, requestView]);

  const requestReloadKey = JSON.stringify([
    requestPage,
    requestFilters,
    requestStatusFilter,
    requestView,
  ]);
  const lastRequestReloadKey = React.useRef(requestReloadKey);
  const lastRequestSearch = React.useRef(requestSearch);
  React.useEffect(() => {
    if (tab !== "requests") return;
    const searchChanged = lastRequestSearch.current !== requestSearch;
    if (!searchChanged && lastRequestReloadKey.current === requestReloadKey)
      return;
    lastRequestReloadKey.current = requestReloadKey;
    lastRequestSearch.current = requestSearch;
    // Debounce typing; filters and paging reload immediately.
    const timer = window.setTimeout(
      () => void reloadAll("requests", true),
      searchChanged ? 400 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [reloadAll, requestReloadKey, requestSearch, tab]);

  const runBulkDecision = React.useCallback(
    async (action: "approve" | "reject") => {
      const token = readStoredToken();
      if (!token || selectedRequestIds.length === 0) return;
      let comments: string | undefined;
      if (action === "reject") {
        const form = await fluentForm(
          [
            {
              name: "reason",
              label: "Reason for rejecting",
              type: "textarea",
              required: true,
            },
          ],
          {
            title: `Reject ${selectedRequestIds.length} request(s)`,
            confirmLabel: "Reject",
          },
        );
        if (!form?.reason) return;
        comments = form.reason;
      } else if (
        !(await fluentConfirm(`Approve ${selectedRequestIds.length} request(s)?`, {
          title: "Approve requests",
          confirmLabel: "Approve",
        }))
      ) {
        return;
      }
      const signed = await askSignature({
        title: `Sign ${selectedRequestIds.length} decision(s)`,
        description:
          "One signature is recorded on each selected request and printed on each leave form.",
        confirmLabel: action === "approve" ? "Approve" : "Reject",
        commentRequired: action !== "approve",
        defaultComment: comments ?? "",
        signerName: identity.name ?? "",
        destructive: action !== "approve",
      });
      if (!signed) return;
      setBulkBusy(true);
      try {
        const result = await bulkLeaveApprovalAction(token, {
          ids: selectedRequestIds.map(Number),
          action,
          comments: signed.comments || comments,
          signature: signed.signature,
        });
        const failed = Number(result?.failed ?? 0);
        const succeeded = Number(result?.succeeded ?? 0);
        if (failed) {
          const firstErrors = (
            Array.isArray(result?.results) ? result.results : []
          )
            .filter((row: AdminRecord) => !row.ok)
            .slice(0, 3)
            .map((row: AdminRecord) => `#${String(row.id)}: ${String(row.error)}`)
            .join("\n");
          showErrorAlert(
            `${succeeded} done, ${failed} could not be processed.\n${firstErrors}`,
          );
        } else {
          showSuccessAlert(`${succeeded} request(s) ${action === "approve" ? "approved" : "rejected"}.`);
        }
        await reloadAll("requests", true);
      } catch (errorObject) {
        showErrorAlert(
          errorObject instanceof Error
            ? errorObject.message
            : "Bulk decision failed.",
        );
      } finally {
        setBulkBusy(false);
      }
    },
    [reloadAll, selectedRequestIds],
  );

  const resetTypeForm = React.useCallback(() => {
    setTypeForm(createEmptyLeaveTypeForm());
    setEditingLeaveTypeRow(null);
    setTypeDialogStep("details");
  }, []);

  const openTypeDialogForCreate = React.useCallback(() => {
    resetTypeForm();
    setTypeDialogOpen(true);
  }, [resetTypeForm]);

  const openTypeDialogForEdit = React.useCallback((row: AdminRecord) => {
    setTypeDialogStep("details");
    setEditingLeaveTypeRow(row);
    setTypeForm({
      name: readString(row, ["name"]) === "-" ? "" : readString(row, ["name"]),
      code: readString(row, ["code"]) === "-" ? "" : readString(row, ["code"]),
      description:
        readString(row, ["description"]) === "-"
          ? ""
          : readString(row, ["description"]),
      status:
        readString(row, ["status"]) === "inactive" ? "inactive" : "active",
      is_paid: readBoolean(row, ["is_paid"]) ? "true" : "false",
      requires_attachment: readBoolean(row, ["requires_attachment"])
        ? "true"
        : "false",
      allow_deferred_attachment: readBoolean(row, ["allow_deferred_attachment"])
        ? "true"
        : "false",
      attachment_grace_days: String(
        readNumber(row, ["attachment_grace_days"]) ?? 3,
      ),
      attachment_required_after_days: String(
        readNumber(row, ["attachment_required_after_days"]) ?? "",
      ),
      auto_approve_after_days: String(
        readNumber(row, ["auto_approve_after_days"]) ?? "",
      ),
      is_carry_forward_allowed: readBoolean(row, ["is_carry_forward_allowed"])
        ? "true"
        : "false",
      sandwich_rule: readBoolean(row, ["sandwich_rule"]) ? "true" : "false",
      // Blank = no cap (stored as null); 0 = nothing carries forward.
      max_carry_forward_days:
        readDisplayValue(row, ["max_carry_forward_days"]) === "-"
          ? ""
          : readDisplayValue(row, ["max_carry_forward_days"]),
      max_days_per_year:
        readDisplayValue(row, ["max_days_per_year"]) === "-"
          ? "0"
          : readDisplayValue(row, ["max_days_per_year"]),
      gender_restriction: (() => {
        const value = readString(row, ["gender_restriction"]).toLowerCase();
        if (value === "male" || value === "female") {
          return value;
        }
        return "any";
      })(),
    });
    setTypeDialogOpen(true);
  }, []);

  const openLeaveRequestDetails = React.useCallback(
    async (row: AdminRecord) => {
      setSelectedLeaveRequestRow(row);
      setLeaveRequestDetailsOpen(true);

      const token = readStoredToken();
      const requestId = readNumber(row, [
        "id",
        "leave_request_id",
        "leaveRequestId",
      ]);
      if (!token || requestId === null) {
        return;
      }

      try {
        const detail = await getLeaveRequest(token, requestId);
        if (detail) {
          setSelectedLeaveRequestRow({
            ...row,
            ...detail,
          });
        }
      } catch (errorObject) {
        console.warn(
          "[leave] Failed to load highlighted leave request detail.",
          errorObject,
        );
      }
    },
    [],
  );

  const refreshLeaveRequestDetail = React.useCallback(
    async (row: AdminRecord | null) => {
      const token = readStoredToken();
      const requestId = row
        ? readNumber(row, ["id", "leave_request_id", "leaveRequestId"])
        : null;
      if (!token || requestId === null) {
        return null;
      }

      const detail = await getLeaveRequest(token, requestId);
      if (!detail) {
        return null;
      }

      setSelectedLeaveRequestRow((current) => ({
        ...(current ?? row ?? {}),
        ...(row ?? {}),
        ...detail,
      }));

      setRequests((current) =>
        current.map((entry) =>
          readNumber(entry, ["id", "leave_request_id", "leaveRequestId"]) ===
          requestId
            ? { ...entry, ...detail }
            : entry,
        ),
      );

      return detail;
    },
    [],
  );

  const openedHighlightedRequestRef = React.useRef("");
  React.useEffect(() => {
    if (tab !== "requests" || !highlightedRequestId) {
      return;
    }
    if (openedHighlightedRequestRef.current === highlightedRequestId) {
      return;
    }

    const highlightedRow = requests.find(
      (row) =>
        String(
          readNumber(row, ["id", "leave_request_id", "leaveRequestId"]) ?? "",
        ) === highlightedRequestId,
    ) ?? { id: highlightedRequestId };

    openedHighlightedRequestRef.current = highlightedRequestId;
    void openLeaveRequestDetails(highlightedRow);
  }, [highlightedRequestId, openLeaveRequestDetails, requests, tab]);

  const fetchHolidayCatalog = React.useCallback(
    async (country: HolidayImportCountryCode, yearValue: string) => {
      const year = Number(yearValue);
      if (!Number.isInteger(year) || year < 1970 || year > 2100) {
        throw new Error("Enter a valid year between 1970 and 2100.");
      }

      const response = await fetch(
        `/api/holiday-catalog?country=${country}&year=${year}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        holidays?: ImportableHoliday[];
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load country holidays.");
      }
      return Array.isArray(payload.holidays) ? payload.holidays : [];
    },
    [],
  );

  const loadHolidayImportCatalog = React.useCallback(async () => {
    setHolidayImportLoading(true);
    setHolidayImportError(null);
    try {
      const holidays = await fetchHolidayCatalog(
        holidayImportCountry,
        holidayImportYear,
      );
      setHolidayImportCatalog(holidays);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load country holidays.";
      setHolidayImportCatalog([]);
      setHolidayImportError(message);
    } finally {
      setHolidayImportLoading(false);
    }
  }, [fetchHolidayCatalog, holidayImportCountry, holidayImportYear]);

  const loadHolidayRemoveCatalog = React.useCallback(async () => {
    setHolidayRemoveLoading(true);
    setHolidayRemoveError(null);
    try {
      const holidays = await fetchHolidayCatalog(
        holidayRemoveCountry,
        holidayRemoveYear,
      );
      setHolidayRemoveCatalog(holidays);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to load country holidays.";
      setHolidayRemoveCatalog([]);
      setHolidayRemoveError(message);
    } finally {
      setHolidayRemoveLoading(false);
    }
  }, [fetchHolidayCatalog, holidayRemoveCountry, holidayRemoveYear]);

  React.useEffect(() => {
    if (!holidayImportDialogOpen) {
      if (!holidayImportBusy) {
        setHolidayImportProgress(null);
      }
      return;
    }
    void loadHolidayImportCatalog();
  }, [holidayImportBusy, holidayImportDialogOpen, loadHolidayImportCatalog]);

  React.useEffect(() => {
    if (!holidayRemoveDialogOpen) {
      if (!holidayRemoveBusy) {
        setHolidayRemoveProgress(null);
      }
      return;
    }
    void loadHolidayRemoveCatalog();
  }, [holidayRemoveBusy, holidayRemoveDialogOpen, loadHolidayRemoveCatalog]);

  const existingHolidayKeys = React.useMemo(() => {
    return new Set(
      holidays.map((row) =>
        holidayMatchKey(readString(row, ["name"]), readHolidayDate(row)),
      ),
    );
  }, [holidays]);

  const selectedHolidayMatches = React.useMemo(() => {
    return holidayImportCatalog.filter((entry) =>
      existingHolidayKeys.has(holidayMatchKey(entry.name, entry.holidayDate)),
    );
  }, [existingHolidayKeys, holidayImportCatalog]);

  const selectedHolidayMissing = React.useMemo(() => {
    return holidayImportCatalog.filter(
      (entry) =>
        !existingHolidayKeys.has(
          holidayMatchKey(entry.name, entry.holidayDate),
        ),
    );
  }, [existingHolidayKeys, holidayImportCatalog]);

  const removableCountryHolidays = React.useMemo(() => {
    return holidays.filter((row) =>
      holidayRemoveCatalog.some(
        (entry) =>
          holidayMatchKey(entry.name, entry.holidayDate) ===
          holidayMatchKey(readString(row, ["name"]), readHolidayDate(row)),
      ),
    );
  }, [holidayRemoveCatalog, holidays]);

  const employeeNameById = React.useMemo(() => {
    const names = new Map<number, string>();
    employees.forEach((row) => {
      const label = personName(row, "");
      if (!label) {
        return;
      }
      (
        ["id", "employee_id", "employeeId", "user_id", "userId"] as const
      ).forEach((key) => {
        const id = readNumber(row, [key]);
        if (id !== null && !names.has(id)) {
          names.set(id, label);
        }
      });
    });
    return names;
  }, [employees]);

  const employeeLabel = (employeeId: number | null) => {
    if (employeeId === null) {
      return "-";
    }
    return employeeNameById.get(employeeId) ?? `#${employeeId}`;
  };

  const employeeLabelFromRow = React.useCallback(
    (row: AdminRecord) => {
      return resolveLeaveBalanceEmployeeName(row, employeeNameById);
    },
    [employeeNameById],
  );

  const leaveTypeLabelFromRequest = (row: AdminRecord) => {
    const nestedType = asRecord(row.leave_type) ?? asRecord(row.leaveType);
    if (nestedType) {
      const name = readString(nestedType, ["name", "code"]);
      if (name !== "-") return name;
    }
    const direct = readString(row, [
      "leave_type_name",
      "leaveTypeName",
      "leave_type",
      "leave_type_id",
    ]);
    if (direct !== "-" && Number.isNaN(Number(direct))) return direct;
    return leaveTypeLabel(readNumber(row, ["leave_type_id", "leaveTypeId"]));
  };

  React.useEffect(() => {
    const token = readStoredToken();
    if (!token) {
      setCurrentActor(null);
      return;
    }
    let cancelled = false;
    void getCurrentAdmin(token)
      .then((profile) => {
        if (cancelled) return;
        setCurrentActor({ ...resolveLeaveActor(token, profile), canCancelAny: canBulkDecide, canOverride: canOverrideManager });
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentActor({ ...resolveLeaveActor(token, null), canCancelAny: canBulkDecide, canOverride: canOverrideManager });
      });
    return () => {
      cancelled = true;
    };
  }, [canBulkDecide, canOverrideManager]);

  const leaveTypeLabel = React.useCallback(
    (leaveTypeId: number | null) => {
      if (leaveTypeId === null) {
        return "-";
      }
      const match = types.find(
        (row) =>
          readNumber(row, [
            "id",
            "leave_type_id",
            "leaveTypeId",
            "type_id",
            "typeId",
          ]) === leaveTypeId,
      );
      if (!match) {
        return `#${leaveTypeId}`;
      }
      return readString(match, [
        "name",
        "leave_type_name",
        "leaveTypeName",
        "type_name",
        "typeName",
        "title",
      ]);
    },
    [types],
  );

  const leaveTypeLabelFromRow = React.useCallback(
    (row: AdminRecord) => {
      const nestedLeaveType =
        asRecord(row.leave_type) ??
        asRecord(row.leaveType) ??
        asRecord(row.type);

      const inlineLeaveTypeName = readString(row, [
        "leave_type_name",
        "leaveTypeName",
        "type_name",
        "typeName",
      ]);
      if (inlineLeaveTypeName !== "-") {
        return inlineLeaveTypeName;
      }
      if (nestedLeaveType) {
        const nestedLeaveTypeName = readString(nestedLeaveType, [
          "name",
          "leave_type_name",
          "leaveTypeName",
          "type_name",
          "typeName",
          "title",
        ]);
        if (nestedLeaveTypeName !== "-") {
          return nestedLeaveTypeName;
        }
      }
      return leaveTypeLabel(
        readNumber(row, [
          "leave_type_id",
          "leaveTypeId",
          "type_id",
          "typeId",
          "leave_type",
          "leaveType",
        ]),
      );
    },
    [leaveTypeLabel],
  );

  const groupedBalances = React.useMemo(
    () =>
      groupLeaveBalancesByEmployee(balances.filter((row) => readBalanceFiscalYear(row) === balanceYear && (balanceDepartment === "all" || String(readNumber(asRecord(asRecord(row.employee)?.department) ?? {}, ["id"])) === balanceDepartment) && (balanceType === "all" || String(readNumber(row, ["leave_type_id"])) === balanceType) && (balanceStatus === "all" || (balanceStatus === "negative" ? readBalanceDays(row, ["available_days", "remaining_days"]) < 0 : readBalanceDays(row, ["available_days", "remaining_days"]) <= 5))), (row) =>
        employeeLabelFromRow(row),
      ).filter((group) => `${group.employeeName} ${group.employeeId ?? ""} ${readString(asRecord(group.rows[0]?.employee) ?? {}, ["employee_number", "employee_no"])}`.toLowerCase().includes(balanceSearch.trim().toLowerCase())),
    [balances, employeeLabelFromRow, balanceYear, balanceSearch, balanceType, balanceStatus, balanceDepartment],
  );

  const allEmployeeBalancesForYear = React.useMemo(
    () => groupLeaveBalancesByEmployee(
      balances.filter((row) => readBalanceFiscalYear(row) === balanceYear),
      employeeLabelFromRow,
    ),
    [balances, balanceYear, employeeLabelFromRow],
  );

  const balanceDepartments = React.useMemo(() => {
    const options = new Map<string, string>();
    balances.forEach((row) => { const department = asRecord(asRecord(row.employee)?.department); if (department && department.id != null) options.set(String(department.id), readString(department, ["name"])); });
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [balances]);

  const balanceGroupColumns = React.useMemo(
    () => [
      {
        key: "employee",
        label: "Employee",
        defaultWidth: 160,
        sortValue: (group: LeaveBalanceEmployeeGroup) => group.employeeName,
        render: (group: LeaveBalanceEmployeeGroup) => group.employeeName,
      },
      { key: "department", label: "Department", render: (group: LeaveBalanceEmployeeGroup) => readString(asRecord(asRecord(group.rows[0]?.employee)?.department) ?? {}, ["name"]) },
      ...(["annual", "sick"] as const).map((kind) => {
        // Matches the leave type by name, e.g. "Annual Leave" / "Sick Leave".
        const findRow = (group: LeaveBalanceEmployeeGroup) =>
          group.rows.find((row) =>
            leaveTypeLabelFromRow(row).toLowerCase().includes(kind),
          );
        const available = (row: Record<string, unknown>) =>
          readBalanceDays(row, ["available_days", "remaining_days"]);
        return {
          key: `${kind}_left`,
          label: kind === "annual" ? "Annual leave left" : "Sick leave left",
          defaultWidth: 110,
          sortValue: (group: LeaveBalanceEmployeeGroup) => {
            const row = findRow(group);
            return row ? available(row) : -Infinity;
          },
          render: (group: LeaveBalanceEmployeeGroup) => {
            const row = findRow(group);
            if (!row) return "—";
            const allocated = readBalanceDays(row, [
              "allocated_days",
              "allocated",
              "allocatedDays",
            ]);
            const left = available(row);
            return (
              <span
                className={cn(
                  "tabular-nums",
                  left < 0 && "font-semibold text-destructive",
                )}
              >
                {formatBalanceDays(left)}
                <span className="text-muted-foreground">
                  {" "}
                  / {formatBalanceDays(allocated)}
                </span>
              </span>
            );
          },
        };
      }),
    ],
    [leaveTypeLabelFromRow],
  );

  React.useEffect(() => {
    setSelectedBalanceGroup((current) => {
      if (!current) {
        return current;
      }
      return (
        allEmployeeBalancesForYear.find((group) => group.key === current.key) ?? null
      );
    });
  }, [allEmployeeBalancesForYear]);

  const selectedBalanceGroupRows = React.useMemo(
    () =>
      selectedBalanceGroup
        ? sortLeaveBalanceRows(selectedBalanceGroup.rows, (row) =>
            leaveTypeLabelFromRow(row),
          )
        : [],
    [selectedBalanceGroup, leaveTypeLabelFromRow],
  );

  React.useEffect(() => {
    const employeeId = selectedBalanceGroup?.employeeId;
    const token = readStoredToken();
    if (!employeeBalanceDetailsOpen || !employeeId || !token) return;
    let cancelled = false;
    setBalanceHistoryLoading(true); setBalanceHistoryError(""); setBalanceHistory([]);
    listLeaveBalanceTransactions(token, { employee_id: employeeId, fiscal_year: balanceYear, page: balanceHistoryPage, limit: 20 })
      .then((rows) => { if (!cancelled) setBalanceHistory(rows); })
      .catch((error: unknown) => { if (!cancelled) setBalanceHistoryError(error instanceof Error ? error.message : "Could not load transaction history."); })
      .finally(() => { if (!cancelled) setBalanceHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [employeeBalanceDetailsOpen, selectedBalanceGroup?.employeeId, balanceYear, balanceHistoryPage]);

  React.useEffect(() => {
    if (tab !== "balances" || !/^\d{4}$/.test(balanceYear)) return;
    const token = readStoredToken(); if (!token) return;
    let cancelled = false; setMissingLoading(true); setMissingError("");
    listEmployeesWithoutLeaveBalances(token, balanceYear, missingPage)
      .then((result) => { if (!cancelled) { setMissingBalances(result.rows); setMissingTotalPages(result.totalPages); } })
      .catch((error: unknown) => { if (!cancelled) { setMissingBalances([]); setMissingError(error instanceof Error ? error.message : "Could not load employees without balances."); } })
      .finally(() => { if (!cancelled) setMissingLoading(false); });
    return () => { cancelled = true; };
  }, [tab, balanceYear, missingPage, balances]);

  const resetBalanceForm = React.useCallback(() => {
    setBalanceForm(emptyBalanceForm());
  }, []);

  const optionLabel = (
    rows: AdminRecord[],
    id: number | null,
    nameKeys: string[] = ["name", "title"],
  ) => {
    if (id === null) {
      return "-";
    }
    const match = rows.find(
      (row) =>
        readNumber(row, [
          "id",
          "role_id",
          "department_id",
          "position_id",
          "branch_id",
          "user_id",
        ]) === id,
    );
    if (!match) {
      return `#${id}`;
    }
    return readString(match, nameKeys);
  };

  const employeeOptions: SearchableOption[] = employees
    .map((employee) => {
      const id = readNumber(employee, ["id", "employee_id", "user_id"]);
      if (id === null) return null;
      return { value: String(id), label: employeeLabel(id) };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const leaveTypeOptions = types
    .map((type) => {
      const id = readNumber(type, ["id", "leave_type_id", "leaveTypeId"]);
      if (id === null) return null;
      const label = readString(type, [
        "name",
        "leave_type_name",
        "leaveTypeName",
        "title",
        "code",
      ]);
      const yearlyMax = readDisplayValue(type, [
        "max_days_per_year",
        "maxDaysPerYear",
      ]);
      const carryMax = readDisplayValue(type, [
        "max_carry_forward_days",
        "maxCarryForwardDays",
      ]);
      return {
        value: String(id),
        label: label && label !== "-" ? label : `Leave type ${id}`,
        maxDaysPerYear: yearlyMax === "-" ? "0" : yearlyMax,
        maxCarryForwardDays: carryMax === "-" ? "0" : carryMax,
        carryForwardAllowed: readBoolean(type, [
          "is_carry_forward_allowed",
          "isCarryForwardAllowed",
        ]),
      };
    })
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  const gradeOptions: SearchableOption[] = grades
    .map((row) => {
      const id = readNumber(row, ["id", "grade_id"]);
      if (id === null) return null;
      return {
        value: String(id),
        label: readString(row, ["name", "title", "grade_name"]),
      };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const policyBranchOptions: SearchableOption[] = branches
    .map((row) => {
      const id = readNumber(row, ["id", "branch_id"]);
      if (id === null) return null;
      return { value: String(id), label: readString(row, ["name", "title"]) };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const positionOptions: SearchableOption[] = positions
    .map((row) => {
      const id = readNumber(row, ["id", "position_id"]);
      if (id === null) return null;
      return { value: String(id), label: readString(row, ["name", "title"]) };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const workflowRoleOptions: SearchableOption[] = roles
    .map((row) => {
      const id = readNumber(row, ["id", "role_id"]);
      if (id === null) return null;
      return {
        value: String(id),
        label: readString(row, ["display_name", "name", "title"]),
      };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const workflowBranchOptions: SearchableOption[] = branches
    .map((row) => {
      const id = readNumber(row, ["id", "branch_id"]);
      if (id === null) return null;
      return { value: String(id), label: readString(row, ["name", "title"]) };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const workflowDepartmentOptions: SearchableOption[] = departments
    .map((row) => {
      const id = readNumber(row, ["id", "department_id"]);
      if (id === null) return null;
      return { value: String(id), label: readString(row, ["name", "title"]) };
    })
    .filter((option): option is SearchableOption => Boolean(option));

  const workflowEditorSteps: LeaveWorkflowEditorStep[] = workflowSteps.map(
    (row, index) => {
      const stepId = readNumber(row, ["id", "step_id"]);
      const approverTypeValue = readString(row, ["approver_type"]);
      const approverType =
        approverTypeValue === "-" ? "role" : approverTypeValue;
      const approverId =
        approverType === "position"
          ? readNumber(row, ["position_id"])
          : approverType === "company_user"
            ? readNumber(row, ["company_user_id"])
            : readNumber(row, ["role_id"]);
      const directApproverLabel =
        approverType === "position"
          ? readString(row, ["position_name", "approver_name"])
          : approverType === "company_user"
            ? readString(row, [
                "company_user_name",
                "approver_name",
                "user_name",
              ])
            : readString(row, ["role_name", "approver_name"]);
      const resolvedApproverLabel =
        approverType === "position"
          ? optionLabel(positions, approverId)
          : approverType === "company_user"
            ? (employeeOptions.find(
                (option) => option.value === String(approverId ?? ""),
              )?.label ??
              (approverId === null
                ? "Approver not selected"
                : `User #${approverId}`))
            : optionLabel(roles, approverId, ["display_name", "name", "title"]);
      const branchId = readNumber(row, ["assigned_branch_id"]);
      const departmentId = readNumber(row, ["assigned_department_id"]);

      return {
        key: `workflow-editor-step-${stepId ?? index}`,
        level: String(readNumber(row, ["approval_level"]) ?? "—"),
        action:
          readString(row, ["action_type"]) === "-"
            ? "recommend"
            : readString(row, ["action_type"]),
        approverType,
        approverLabel:
          directApproverLabel !== "-"
            ? directApproverLabel
            : resolvedApproverLabel,
        branchLabel:
          branchId === null ? "All branches" : optionLabel(branches, branchId),
        departmentLabel:
          departmentId === null
            ? "All departments"
            : optionLabel(departments, departmentId),
        isRequired: readBoolean(row, ["is_required"]),
      };
    },
  );

  const workflowDraftRow: AdminRecord | null = workflowDraft
    ? {
        id: "local-draft",
        name: workflowDraft.form.name.trim() || "Untitled workflow",
        status: "draft",
        is_default: false,
        leave_type_id: workflowDraft.form.leave_type_id,
        leave_type_name:
          leaveTypeOptions.find(
            (option) => option.value === workflowDraft.form.leave_type_id,
          )?.label ?? "",
        _isLocalDraft: true,
      }
    : null;
  const canSubmitPolicyChanges =
    editingPolicyId === null ? canCreatePolicies : canUpdatePolicies;
  const canSubmitWorkflowChanges =
    editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows;
  const canManageWorkflowSteps =
    editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows;

  const filteredRequests = requests.filter((row) => {
    const status = readString(row, ["status"]).toLowerCase();
    if (
      requestStatusFilter === "evidence_overdue" &&
      row.evidence_status !== "overdue"
    )
      return false;
    if (
      requestStatusFilter === "evidence_pending" &&
      row.evidence_status !== "awaiting_evidence"
    )
      return false;
    if (
      requestStatusFilter === "routing_required" &&
      row.routing_required !== true
    )
      return false;
    if (
      ![
        "all",
        "evidence_overdue",
        "evidence_pending",
        "routing_required",
      ].includes(requestStatusFilter) &&
      status !== requestStatusFilter
    ) {
      return false;
    }
    const query = requestSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }
    const employee = employeeLabel(
      readNumber(row, ["employee_id"]),
    ).toLowerCase();
    const leaveType = readString(row, [
      "leave_type_name",
      "leave_type",
      "leave_type_id",
    ]).toLowerCase();
    const reason = readString(row, ["reason"]).toLowerCase();
    const dateRange =
      `${readString(row, ["start_date"])} ${readString(row, ["end_date"])}`.toLowerCase();
    return (
      employee.includes(query) ||
      leaveType.includes(query) ||
      reason.includes(query) ||
      dateRange.includes(query)
    );
  });

  const transactionTypes = React.useMemo(
    () =>
      Array.from(
        new Set(
          balanceTransactions
            .map((row) => readString(row, ["transaction_type", "type"]))
            .filter((value) => value && value !== "-"),
        ),
      ).sort(),
    [balanceTransactions],
  );

  const filteredBalanceTransactions = React.useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    return balanceTransactions.filter((row) => {
      const type = readString(row, ["transaction_type", "type"]);
      if (transactionTypeFilter !== "all" && type !== transactionTypeFilter) {
        return false;
      }
      if (!query) return true;
      return [
        employeeLabelFromRow(row),
        type,
        formatTransactionType(type),
        readString(row, ["amount_days", "days", "amount"]),
        readString(row, ["reason", "description"]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    balanceTransactions,
    transactionSearch,
    transactionTypeFilter,
    employeeLabelFromRow,
  ]);

  async function importCountryHolidays() {
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    if (selectedHolidayMissing.length === 0) {
      showSuccessAlert(
        "All selected country holidays are already in the list.",
      );
      return;
    }

    setHolidayImportBusy(true);
    setError(null);
    try {
      const total = selectedHolidayMissing.length;
      setHolidayImportProgress({
        completed: 0,
        total,
        label: `Importing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry}`,
      });

      let completed = 0;
      for (const entry of selectedHolidayMissing) {
        await createLeaveHoliday(token, {
          name: entry.name.trim(),
          holiday_date: entry.holidayDate,
          is_recurring: entry.isRecurring,
        });
        completed += 1;
        setHolidayImportProgress({
          completed,
          total,
          label: `Importing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((country) => country.code === holidayImportCountry)?.label ?? holidayImportCountry}`,
        });
      }
      await reloadAll(tab, true);
      setHolidayImportProgress({
        completed: total,
        total,
        label: `Imported holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry}`,
      });
      showSuccessAlert(
        `${selectedHolidayMissing.length} holiday${selectedHolidayMissing.length === 1 ? "" : "ies"} imported for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry}.`,
      );
      setHolidayImportDialogOpen(false);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to import country holidays.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setHolidayImportBusy(false);
      window.setTimeout(() => {
        setHolidayImportProgress((current) => {
          if (!current || current.completed < current.total) {
            return current;
          }
          return null;
        });
      }, 1800);
    }
  }

  async function removeCountryHolidays() {
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    if (removableCountryHolidays.length === 0) {
      showSuccessAlert(
        "No imported country holidays matched the current list.",
      );
      return;
    }

    setHolidayRemoveBusy(true);
    setError(null);
    try {
      const total = removableCountryHolidays.length;
      setHolidayRemoveProgress({
        completed: 0,
        total,
        label: `Removing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}`,
      });

      let completed = 0;
      for (const row of removableCountryHolidays) {
        const id = readLeaveHolidayId(row);
        if (id === null) {
          continue;
        }
        await deleteLeaveHoliday(token, id);
        completed += 1;
        setHolidayRemoveProgress({
          completed,
          total,
          label: `Removing holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}`,
        });
      }
      await reloadAll(tab, true);
      setHolidayRemoveProgress({
        completed: total,
        total,
        label: `Removed holidays for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}`,
      });
      showSuccessAlert(
        `${removableCountryHolidays.length} holiday${removableCountryHolidays.length === 1 ? "" : "ies"} removed for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry}.`,
      );
      setHolidayRemoveDialogOpen(false);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to remove country holidays.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setHolidayRemoveBusy(false);
      window.setTimeout(() => {
        setHolidayRemoveProgress((current) => {
          if (!current || current.completed < current.total) {
            return current;
          }
          return null;
        });
      }, 1800);
    }
  }

  async function submitTypeForm() {
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    const name = typeForm.name.trim();
    const maxDays = Number(typeForm.max_days_per_year || "0");
    const carryDays =
      typeForm.max_carry_forward_days.trim() === ""
        ? null
        : Number(typeForm.max_carry_forward_days);
    const graceDays = Number(typeForm.attachment_grace_days || "3");
    const attachmentAfterDays =
      typeForm.requires_attachment === "true" &&
      typeForm.attachment_required_after_days.trim() !== ""
        ? Number(typeForm.attachment_required_after_days)
        : null;
    const autoApproveDays =
      typeForm.auto_approve_after_days.trim() === ""
        ? null
        : Number(typeForm.auto_approve_after_days);
    if (
      autoApproveDays !== null &&
      (!Number.isInteger(autoApproveDays) ||
        autoApproveDays < 1 ||
        autoApproveDays > 90)
    ) {
      const message = "Auto-approve after must be a whole number from 1 to 90 days.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (
      attachmentAfterDays !== null &&
      (!Number.isFinite(attachmentAfterDays) ||
        attachmentAfterDays < 0 ||
        attachmentAfterDays > 365)
    ) {
      const message =
        "Days before a document is required must be between 0 and 365.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (!name) {
      const message = "Leave type name is required.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (name.length > 120) {
      const message = "Leave type name must be 120 characters or fewer.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (
      [maxDays, carryDays ?? 0].some(
        (value) =>
          !Number.isFinite(value) ||
          value < 0 ||
          Math.round(value * 100) !== value * 100,
      )
    ) {
      const message =
        "Day limits must be zero or a positive number with at most two decimal places.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (!Number.isInteger(graceDays) || graceDays < 1 || graceDays > 365) {
      const message =
        "Evidence due days must be a whole number between 1 and 365.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        description: typeForm.description.trim(),
        status: typeForm.status,
        is_paid: typeForm.is_paid === "true",
        requires_attachment: typeForm.requires_attachment === "true",
        allow_deferred_attachment:
          typeForm.allow_deferred_attachment === "true",
        attachment_grace_days: Number(typeForm.attachment_grace_days),
        attachment_required_after_days: attachmentAfterDays,
        auto_approve_after_days: autoApproveDays,
        is_carry_forward_allowed: typeForm.is_carry_forward_allowed === "true",
        sandwich_rule: typeForm.sandwich_rule === "true",
        max_carry_forward_days: carryDays,
        max_days_per_year: maxDays,
        gender_restriction: typeForm.gender_restriction,
      };

      const editingId = readLeaveTypeId(editingLeaveTypeRow);
      if (editingId !== null) {
        await patchLeaveType(token, editingId, payload);
      } else {
        await createLeaveType(token, payload);
      }

      resetTypeForm();
      setTypeDialogOpen(false);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : editingLeaveTypeRow
            ? "Failed to update leave type."
            : "Failed to create leave type.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitRequestForm() {
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    if (!requestForm.employee_id) {
      const message = "Please select an employee.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (!requestForm.leave_type_id) {
      const message = "Please select a leave type.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (!requestForm.start_date || !requestForm.end_date) {
      const message = "Please select both start and end dates.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (
      new Date(requestForm.start_date).getTime() >
      new Date(requestForm.end_date).getTime()
    ) {
      const message = "Start date cannot be after end date.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (!requestForm.reason.trim()) {
      const message = "Reason is required.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (
      noticeOverrideNeeded &&
      requestForm.notice_override_reason.trim().length < 5
    ) {
      const message =
        "This leave starts inside the policy notice period. Give a notice override reason (at least 5 characters).";
      setError(message);
      showErrorAlert(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createLeaveRequest(token, {
        employee_id: Number(requestForm.employee_id),
        leave_type_id: Number(requestForm.leave_type_id),
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        reason: requestForm.reason.trim(),
        ...(noticeOverrideNeeded
          ? { notice_override_reason: requestForm.notice_override_reason.trim() }
          : {}),
        submit: requestForm.submit === "true",
      });
      setRequestForm(emptyLeaveRequestForm());
      setRequestDialogStep("who");
      setRequestDialogOpen(false);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to create leave request.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function downloadRequestImportTemplate() {
    const token = readStoredToken();
    if (!token) return;
    setRequestTemplateBusy(true);
    try {
      const result = await downloadLeaveImportTemplate(token);
      downloadBlob(result.blob, result.filename);
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Template download failed.",
      );
    } finally {
      setRequestTemplateBusy(false);
    }
  }

  async function uploadRequestImport() {
    const token = readStoredToken();
    if (!token || !requestImportFile) return;
    setRequestImportBusy(true);
    setRequestImportResult(null);
    try {
      const result = requestImportResult?.preview
        ? await confirmLeaveRequestsImport(token, requestImportFile)
        : await previewLeaveRequests(token, requestImportFile);
      setRequestImportResult(result);
      if (result.created > 0) await reloadAll("requests", true);
      if (result.preview && result.failed === 0) {
        showSuccessAlert(
          `${result.ready} leave request${result.ready === 1 ? "" : "s"} are ready for confirmation. No requests have been created yet.`,
        );
      } else if (!result.preview && result.failed === 0) {
        showSuccessAlert(
          `${result.created} leave request${result.created === 1 ? "" : "s"} imported.`,
        );
      }
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Leave import failed.",
      );
    } finally {
      setRequestImportBusy(false);
    }
  }

  async function openRequestDialog() {
    const loaded = await ensureLookups(["types", "employees"]);
    if (!loaded) {
      return;
    }
    setRequestForm(emptyLeaveRequestForm());
    setRequestDialogStep("who");
    setRequestDialogOpen(true);
  }

  async function submitBalanceAdjustment() {
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    const employeeId = Number(balanceForm.employee_id);
    const leaveTypeId = Number(balanceForm.leave_type_id);
    const amount = Number(balanceForm.amount);
    const fiscalYear = balanceForm.fiscal_year.trim();
    const reason = balanceForm.reason.trim();
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      showErrorAlert("Please select an employee.");
      return;
    }
    if (!Number.isFinite(leaveTypeId) || leaveTypeId <= 0) {
      showErrorAlert("Please select a leave type.");
      return;
    }
    if (!/^\d{4}$/.test(fiscalYear)) {
      showErrorAlert("Enter a valid four-digit fiscal year.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      showErrorAlert("Enter a valid amount of 0 or more.");
      return;
    }
    if (!reason) {
      showErrorAlert("A reason is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await adjustLeaveBalance(token, {
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        fiscal_year: fiscalYear,
        mode: balanceForm.mode,
        amount,
        reason,
        cap_override_reason: canOverrideBalanceCap
          ? balanceForm.cap_override_reason
          : undefined,
      });
      showSuccessAlert("Leave balance updated.");
      finishBalanceEditor();
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to adjust leave balance.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  function findMatchingBalanceRow(
    employeeId: string,
    leaveTypeId: string,
    fiscalYear: string,
  ) {
    const employeeNumber = Number(employeeId);
    const typeNumber = Number(leaveTypeId);
    if (!Number.isFinite(employeeNumber) || !Number.isFinite(typeNumber)) {
      return null;
    }
    const year = fiscalYear.trim();
    const pool = [...(selectedBalanceGroup?.rows ?? []), ...balances];
    return (
      pool.find((row) => {
        const rowEmployee = readBalanceEmployeeId(row);
        const rowType = leaveTypeIdFromRow(row);
        const rowYear = readString(row, ["fiscal_year", "fiscalYear"]);
        return (
          rowEmployee === employeeNumber &&
          rowType === typeNumber &&
          (year === "" || rowYear === "-" || rowYear === year)
        );
      }) ?? null
    );
  }

  function applyBalanceSelection(next: {
    employee_id: string;
    leave_type_id: string;
    fiscal_year: string;
  }) {
    const match = findMatchingBalanceRow(
      next.employee_id,
      next.leave_type_id,
      next.fiscal_year,
    );
    if (match) {
      setSelectedBalanceRow(match);
      setBalanceForm(formFromBalanceRow(match));
      return;
    }
    setSelectedBalanceRow(null);
    setBalanceForm((prev) => ({
      ...prev,
      ...next,
      amount: "0",
      remaining: "0",
    }));
  }

  function openEmployeeBalanceDetails(group: LeaveBalanceEmployeeGroup) {
    setSelectedBalanceGroup(allEmployeeBalancesForYear.find((item) => item.key === group.key) ?? group);
    setBalanceHistoryPage(1);
    setEmployeeBalanceDetailsOpen(true);
  }

  function openBalanceBulkDialog(action: "generate" | "carry-forward") {
    const yearFromRows = groupedBalances.find(
      (group) => group.fiscalYears.length > 0,
    )?.fiscalYears[0];
    setBalanceBulkYear(yearFromRows || String(new Date().getFullYear()));
    setBalanceBulkDialog(action);
  }

  async function submitBalanceBulkAction() {
    const token = readStoredToken();
    if (!token || !balanceBulkDialog) {
      return;
    }
    const fiscalYear = balanceBulkYear.trim();
    if (!/^\d{4}$/.test(fiscalYear)) {
      showErrorAlert("Enter a valid four-digit fiscal year.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (balanceBulkDialog === "generate") {
        await generateLeaveBalances(token, {
          fiscal_year: fiscalYear,
          force_recalculate: true,
        });
        showSuccessAlert("Leave balances generated.");
      } else {
        await carryForwardLeaveBalances(token, {
          fiscal_year: fiscalYear,
        });
        showSuccessAlert("Carry-forward calculated.");
      }
      setBalanceBulkDialog(null);
      await reloadAll("balances", true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : balanceBulkDialog === "generate"
            ? "Generate failed."
            : "Carry-forward failed.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function runBalanceReconciliation() {
    const token = readStoredToken();
    const year = reconciliationYear.trim();
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      showErrorAlert("Enter a valid four-digit fiscal year.");
      return;
    }
    setReconciliationLoading(true);
    try {
      const rows = await listAllLeaveBalanceReconciliation(token, year);
      setReconciliationRows(rows);
      setReconciliationOpen(true);
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not reconcile leave balances.",
      );
    } finally {
      setReconciliationLoading(false);
    }
  }

  async function reviewOpeningPreview(row: AdminRecord) {
    const token = readStoredToken();
    const balanceId = readNumber(row, ["balance_id"]);
    const fingerprint = readString(row, ["opening_preview_fingerprint"]);
    if (!token || balanceId === null || fingerprint === "-") return;
    const reason = window
      .prompt(
        "What did you check? (Recorded in the audit log; not cutover sign-off.)",
      )
      ?.trim();
    if (!reason) return;
    try {
      await recordLeaveOpeningPreviewReview(token, {
        balance_id: balanceId,
        fingerprint,
        reason,
      });
      const history = await listLeaveOpeningPreviewReviews(token, balanceId);
      showSuccessAlert(
        `Review recorded (${history.length} review${history.length === 1 ? "" : "s"} for this balance).`,
      );
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not record the review.",
      );
    }
  }

  async function downloadLeaveReport() {
    const token = readStoredToken();
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }
    if (
      leaveReportKind === "balances" &&
      !/^\d{4}$/.test(leaveReportYear.trim())
    ) {
      showErrorAlert("Enter a valid four-digit fiscal year.");
      return;
    }
    if (
      leaveReportKind !== "balances" &&
      leaveReportFrom &&
      leaveReportTo &&
      leaveReportFrom > leaveReportTo
    ) {
      showErrorAlert("The start date must be before or equal to the end date.");
      return;
    }

    setLeaveReportLoading(true);
    try {
      let headers: string[];
      let records: string[][];
      let filename: string;
      if (leaveReportKind === "balances") {
        const result = await listAllLeaveBalances(token, {
          fiscal_year: leaveReportYear.trim(),
        });
        headers = [
          "Employee number",
          "Employee",
          "Leave type",
          "Fiscal year",
          "Entitlement days",
          "Accrued days",
          "Used days",
          "Pending days",
          "Adjusted days",
          "Available days",
        ];
        records = result.rows.map((row) => [
          readString(asRecord(row.employee) ?? {}, ["employee_no"]),
          employeeLabelFromRow(row),
          leaveTypeLabelFromRow(row),
          readString(row, ["fiscal_year"]),
          readString(row, ["entitlement_days", "allocated_days"]),
          readString(row, ["accrued_days"]),
          readString(row, ["used_days"]),
          readString(row, ["pending_days"]),
          readString(row, ["adjusted_days"]),
          readString(row, ["available_days", "remaining_days"]),
        ]);
        filename = `leave-balances-${leaveReportYear.trim()}.csv`;
      } else if (leaveReportKind === "encashments") {
        const result = await listLeaveEncashmentRequests(token, {
          page: 1,
          limit: 100,
          from_date: leaveReportFrom || undefined,
          to_date: leaveReportTo || undefined,
        });
        const selectedRows = result.rows;
        headers = [
          "Employee number",
          "Employee",
          "Leave type",
          "Leave year",
          "Requested days",
          "Approved days",
          "Status",
          "Payroll handoff reference",
          "Payroll handoff date",
          "Payroll period",
          "Amount",
          "Currency",
          "Payment status",
          "Payment reference",
          "Paid at",
        ];
        records = selectedRows.map((row) => {
          const employee = asRecord(row.employee) ?? {};
          const type = asRecord(row.leave_type) ?? {};
          return [
            readString(employee, ["employee_no"]),
            employeeLabelFromRow(row),
            readString(type, ["name", "code"]),
            readString(row, ["fiscal_year"]),
            readString(row, ["requested_days"]),
            readString(row, ["approved_days"]),
            readString(row, ["status"]),
            readString(row, ["payroll_handoff_reference"]),
            readString(row, ["payroll_handed_off_at"]),
            readString(row, ["payroll_period_code"]),
            readString(row, ["payable_amount"]),
            readString(row, ["currency"]),
            readString(row, ["payment_status"]),
            readString(row, ["payment_reference"]),
            readString(row, ["paid_at"]),
          ];
        });
        filename = `leave-encashments-${leaveReportFrom || "all"}-to-${leaveReportTo || "all"}.csv`;
      } else {
        const result = await listAllLeaveRequests(token, {
          ...(leaveReportFrom ? { from_date: leaveReportFrom } : {}),
          ...(leaveReportTo ? { to_date: leaveReportTo } : {}),
          sortBy: "start_date",
          sortOrder: "ASC",
        });
        const pendingStatuses = new Set([
          "pending_department_manager",
          "pending_hr",
          "in_review",
        ]);
        const selectedRows = result.rows.filter((row) => {
          const status = readString(row, ["status"]).toLowerCase();
          return leaveReportKind === "taken"
            ? status === "approved"
            : pendingStatuses.has(status);
        });
        headers = [
          "Leave number",
          "Employee number",
          "Employee",
          "Leave type",
          "Start date",
          "End date",
          "Days",
          "Status",
          "Submitted at",
        ];
        records = selectedRows.map((row) => {
          const employee = asRecord(row.employee) ?? {};
          const type = asRecord(row.leave_type) ?? {};
          return [
            readString(row, ["leave_no"]),
            readString(employee, ["employee_no"]),
            employeeLabelFromRow(row),
            readString(type, ["name", "code"]) || leaveTypeLabelFromRow(row),
            readString(row, ["start_date"]),
            readString(row, ["end_date"]),
            readString(row, ["total_days"]),
            readString(row, ["status"]),
            readString(row, ["applied_at", "created_at"]),
          ];
        });
        filename = `leave-${leaveReportKind}-${leaveReportFrom || "all"}-to-${leaveReportTo || "all"}.csv`;
      }
      const csvCell = (value: string) => {
        const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
        return `"${safe.replaceAll('"', '""')}"`;
      };
      const csv = [headers, ...records]
        .map((row) => row.map(csvCell).join(","))
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showSuccessAlert(
        `Downloaded ${records.length} leave report row${records.length === 1 ? "" : "s"}.`,
      );
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not prepare the leave report.",
      );
    } finally {
      setLeaveReportLoading(false);
    }
  }

  async function sendEncashmentToPayroll(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    const form = await fluentForm(
      [
        {
          name: "periodCode",
          label: "Payroll period code",
          defaultValue: new Date().toISOString().slice(0, 7),
          required: true,
          hint: "An open payroll period, e.g. 2026-11.",
        },
        {
          name: "amount",
          label: `Amount for ${String(row.approved_days ?? "")} day(s)`,
          type: "number",
          defaultValue:
            row.calculated_amount != null
              ? String(row.calculated_amount)
              : row.payable_amount != null
                ? String(row.payable_amount)
                : "",
          required: true,
          hint:
            row.calculated_amount != null
              ? `Calculated from the policy: ${String(row.daily_rate ?? "")} per day (${String(row.salary_basis ?? "basic")} salary ÷ ${String(row.rate_divisor ?? "")}). Changing it is an override.`
              : "No calculated amount (check the policy divisor and the employee's compensation). Entering one is an override.",
        },
        {
          name: "overrideReason",
          label: "Override reason (only if you changed the amount)",
          defaultValue: "",
        },
        {
          name: "currency",
          label: "Currency",
          defaultValue:
            readString(row, ["currency"]) !== "-"
              ? readString(row, ["currency"])
              : "TZS",
          required: true,
          hint: "3-letter code, e.g. TZS.",
        },
      ],
      { title: "Send encashment to payroll", confirmLabel: "Send to payroll" },
    );
    if (!form) return;
    const periodCode = form.periodCode;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showErrorAlert("Enter an amount greater than zero.");
      return;
    }
    const currency = form.currency.toUpperCase();
    if (currency.length !== 3) {
      showErrorAlert("Currency must be a 3-letter code such as TZS.");
      return;
    }
    const calculated =
      row.calculated_amount != null ? Number(row.calculated_amount) : null;
    const isOverride =
      calculated === null || Math.abs(calculated - amount) > 0.009;
    if (isOverride && (form.overrideReason ?? "").trim().length < 5) {
      showErrorAlert(
        "You changed the calculated amount. Give an override reason (at least 5 characters).",
      );
      return;
    }
    try {
      await recordLeaveEncashmentPayrollHandoff(token, id, {
        payroll_period_code: periodCode.trim(),
        currency,
        ...(isOverride
          ? {
              payable_amount: amount,
              override_reason: (form.overrideReason ?? "").trim(),
            }
          : {}),
      });
      showSuccessAlert(
        "Sent to payroll as a draft input. Payroll must approve it before the run.",
      );
      await loadEncashmentRows();
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not send the encashment to payroll.",
      );
    }
  }

  async function reverseEncashment(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    const form = await fluentForm(
      [
        {
          name: "reason",
          label: "Why is this encashment being reversed?",
          required: true,
          hint: "The days are returned to the balance and any draft payroll input is withdrawn.",
        },
      ],
      { title: "Reverse encashment", confirmLabel: "Reverse" },
    );
    if (!form?.reason?.trim()) return;
    try {
      await reverseLeaveEncashment(token, id, form.reason.trim());
      showSuccessAlert("Encashment reversed and the days returned.");
      await loadEncashmentRows();
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not reverse the encashment.",
      );
    }
  }

  async function decideEncashment(row: AdminRecord, approve: boolean) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    const requested = readString(row, ["requested_days"]);
    const form = await fluentForm(
      approve
        ? [
            {
              name: "days",
              label: "Days to approve",
              type: "number",
              defaultValue: requested !== "-" ? requested : "",
              required: true,
              hint: "Leave as requested to approve in full.",
            },
            { name: "comments", label: "Comment (optional)", type: "textarea" },
          ]
        : [
            {
              name: "comments",
              label: "Reason for rejecting",
              type: "textarea",
              required: true,
            },
          ],
      {
        title: approve ? "Approve encashment" : "Reject encashment",
        confirmLabel: approve ? "Approve" : "Reject",
      },
    );
    if (!form) return;
    let approvedDays: number | undefined;
    if (approve) {
      approvedDays = Number(form.days);
      if (!Number.isFinite(approvedDays) || approvedDays <= 0) {
        showErrorAlert("Enter a number of days greater than zero.");
        return;
      }
    }
    const comments = form.comments;
    try {
      await decideLeaveEncashmentRequest(token, id, {
        approve,
        approved_days: approvedDays,
        comments: comments || undefined,
      });
      showSuccessAlert(approve ? "Encashment approved." : "Encashment rejected.");
      await loadEncashmentRows();
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error ? errorObject.message : "Could not record the decision.",
      );
    }
  }

  async function recordEncashmentPayment(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    const amount = Number(row.payable_amount);
    const currency = readString(row, ["currency"]);
    if (!Number.isFinite(amount) || amount <= 0 || currency === "-") {
      showErrorAlert("This encashment has no payroll amount yet.");
      return;
    }
    const form = await fluentForm(
      [
        {
          name: "reference",
          label: "Payment reference",
          required: true,
          placeholder: "Payslip or bank reference",
        },
        {
          name: "paidAt",
          label: "Paid on",
          type: "date",
          defaultValue: new Date().toISOString().slice(0, 10),
          required: true,
        },
      ],
      {
        title: "Record encashment payment",
        message: `Amount: ${amount} ${currency}`,
        confirmLabel: "Record payment",
      },
    );
    if (!form) return;
    const reference = form.reference;
    const paidAt = form.paidAt;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      showErrorAlert("Choose a valid payment date.");
      return;
    }
    try {
      await recordLeaveEncashmentPayment(token, id, {
        payment_reference: reference,
        paid_at: paidAt,
        currency,
        amount,
      });
      showSuccessAlert("Payment recorded.");
      await loadEncashmentRows();
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error ? errorObject.message : "Could not record the payment.",
      );
    }
  }

  async function loadEncashmentRows() {
    const token = readStoredToken();
    if (!token) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }
    setEncashmentLoading(true);
    try {
      const result = await listLeaveEncashmentRequests(token, {
        page: 1,
        limit: 100,
        from_date: leaveReportFrom || undefined,
        to_date: leaveReportTo || undefined,
      });
      setEncashmentRows(result.rows);
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load leave encashments.",
      );
    } finally {
      setEncashmentLoading(false);
    }
  }

  function finishBalanceEditor() {
    const shouldReturn =
      returnToEmployeeBalancesRef.current &&
      Boolean(selectedBalanceGroupRef.current);
    returnToEmployeeBalancesRef.current = false;
    setReturnToEmployeeBalances(false);
    setBalanceDialogOpen(false);
    setSelectedBalanceRow(null);
    resetBalanceForm();
    if (shouldReturn) {
      window.setTimeout(() => {
        setEmployeeBalanceDetailsOpen(true);
      }, 50);
    }
  }

  async function openBalanceDialog(row?: AdminRecord) {
    const cameFromEmployee = employeeBalanceDetailsOpen;
    if (row && cameFromEmployee) {
      returnToEmployeeBalancesRef.current = true;
      setReturnToEmployeeBalances(true);
    }
    const loaded = await ensureLookups(["types", "employees"]);
    if (!loaded) {
      if (row && cameFromEmployee) {
        returnToEmployeeBalancesRef.current = false;
        setReturnToEmployeeBalances(false);
      }
      return;
    }
    if (row) {
      returnToEmployeeBalancesRef.current = cameFromEmployee;
      setReturnToEmployeeBalances(cameFromEmployee);
      setEmployeeBalanceDetailsOpen(false);
      setSelectedBalanceRow(row);
      setBalanceForm(formFromBalanceRow(row));
    } else {
      returnToEmployeeBalancesRef.current = false;
      setReturnToEmployeeBalances(false);
      setSelectedBalanceRow(null);
      resetBalanceForm();
    }
    setBalanceDialogOpen(true);
  }

  async function submitHolidayForm() {
    if (!canCreateHolidays) {
      return;
    }
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createLeaveHoliday(token, {
        name: holidayForm.name.trim(),
        holiday_date: holidayForm.holiday_date,
        is_recurring: holidayForm.is_recurring === "true",
      });
      setHolidayForm({ name: "", holiday_date: "", is_recurring: "false" });
      setHolidayDialogOpen(false);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to create holiday.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function submitPolicyForm() {
    if (
      (editingPolicyId === null && !canCreatePolicies) ||
      (editingPolicyId !== null && !canUpdatePolicies)
    ) {
      return;
    }
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    const assignments = policyForm.leave_types.filter(
      (row) => Number(row.leave_type_id) > 0,
    );
    if (assignments.length === 0) {
      const message = "Add at least one leave type quota to this policy.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    const optionalId = (value: string) => {
      const parsed = Number(value);
      return value && Number.isFinite(parsed) && parsed > 0
        ? parsed
        : undefined;
    };
    const optionalNumber = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: policyForm.name.trim(),
        description: policyForm.description.trim() || undefined,
        status: policyForm.status,
        accrual_method: policyForm.accrual_method,
        accrual_rate: optionalNumber(policyForm.accrual_rate),
        priority: optionalNumber(policyForm.priority) ?? 0,
        applicable_branch_id: optionalId(policyForm.applicable_branch_id),
        applicable_department_id: optionalId(
          policyForm.applicable_department_id,
        ),
        applicable_position_id: optionalId(policyForm.applicable_position_id),
        applicable_grade_id: optionalId(policyForm.applicable_grade_id),
        applicable_employment_type:
          policyForm.applicable_employment_type || undefined,
        applicable_confirmation_status:
          policyForm.applicable_confirmation_status || undefined,
        max_consecutive_days: optionalNumber(policyForm.max_consecutive_days),
        min_service_months: optionalNumber(policyForm.min_service_months) ?? 0,
        allow_during_probation: policyForm.allow_during_probation === "true",
        allow_negative_balance: policyForm.allow_negative_balance === "true",
        weekly_off_treatment: policyForm.weekly_off_treatment,
        holiday_treatment: policyForm.holiday_treatment,
        allow_half_day: policyForm.allow_half_day === "true",
        allow_short_leave: policyForm.allow_short_leave === "true",
        minimum_short_leave_minutes:
          policyForm.allow_short_leave === "true"
            ? optionalNumber(policyForm.minimum_short_leave_minutes)
            : undefined,
        maximum_short_leave_minutes:
          policyForm.allow_short_leave === "true"
            ? optionalNumber(policyForm.maximum_short_leave_minutes)
            : undefined,
        minimum_notice_days: optionalNumber(policyForm.minimum_notice_days),
        maximum_backdate_days:
          optionalNumber(policyForm.maximum_backdate_days) ?? 0,
        cancellation_requires_approval:
          policyForm.cancellation_requires_approval === "true",
        cancellation_cutoff_days:
          optionalNumber(policyForm.cancellation_cutoff_days) ?? 0,
        maximum_accumulation_days: optionalNumber(
          policyForm.maximum_accumulation_days,
        ),
        attendance_balance_deduction_enabled:
          policyForm.attendance_balance_deduction_enabled === "true",
        absent_day_deduction_days: optionalNumber(
          policyForm.absent_day_deduction_days,
        ),
        unpaid_leave_day_deduction_days: optionalNumber(
          policyForm.unpaid_leave_day_deduction_days,
        ),
        half_day_deduction_days: optionalNumber(
          policyForm.half_day_deduction_days,
        ),
        leave_types: assignments.map((row) => ({
          leave_type_id: Number(row.leave_type_id),
          annual_quota_days: Number(row.annual_quota_days) || 0,
          max_per_request_days: optionalNumber(row.max_per_request_days),
          requires_approval: row.requires_approval === "true",
          encashment_enabled: row.encashment_enabled === "true",
          maximum_encashment_days: optionalNumber(row.maximum_encashment_days),
          encashment_rate_divisor: optionalNumber(row.encashment_rate_divisor),
          minimum_balance_after_encashment: optionalNumber(
            row.minimum_balance_after_encashment,
          ),
          encashment_requires_approval:
            row.encashment_requires_approval === "true",
          maximum_accumulation_days: optionalNumber(
            row.maximum_accumulation_days,
          ),
          ...leavePolicyTypeCarryForwardPayload(row),
        })),
        ...leavePolicyEnginePayload(policyForm),
      };
      if (editingPolicyId === null) {
        await createLeavePolicy(token, payload);
      } else {
        const saved = (await patchLeavePolicy(
          token,
          editingPolicyId,
          payload,
        )) as AdminRecord | null;
        const lifecycle = saved ? String(saved.lifecycle_status ?? "") : "";
        if (lifecycle === "pending_approval") {
          showSuccessAlert(
            "Saved as a new version awaiting approval. The current version stays in effect until it is approved.",
          );
        } else if (lifecycle === "draft") {
          showSuccessAlert("Saved as a draft version.");
        } else if (saved?.version_no) {
          showSuccessAlert(
            `Version ${String(saved.version_no)} is in effect from ${String(saved.effective_from ?? "today")}.`,
          );
        }
      }
      setPolicyForm(emptyLeavePolicyForm());
      setEditingPolicyId(null);
      setPolicySheetOpen(false);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : editingPolicyId === null
            ? "Failed to create leave policy."
            : "Failed to update leave policy.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePolicyStatus(row: AdminRecord) {
    if (!canUpdatePolicies) {
      return;
    }
    const token = readStoredToken();
    const id = readNumber(row, ["id", "policy_id"]);
    if (!token || id === null) {
      return;
    }
    const nextStatus =
      readString(row, ["status"]).toLowerCase() === "active"
        ? "inactive"
        : "active";
    setSaving(true);
    try {
      await patchLeavePolicy(token, id, { status: nextStatus });
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update policy status.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function removePolicy(row: AdminRecord) {
    if (!canDeletePolicies) {
      return;
    }
    const token = readStoredToken();
    const id = readNumber(row, ["id", "policy_id"]);
    if (!token || id === null) {
      return;
    }
    setSaving(true);
    try {
      await deleteLeavePolicy(token, id);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete policy.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function resolvePolicyRecord(row: AdminRecord): Promise<AdminRecord> {
    const token = readStoredToken();
    const policyId = readNumber(row, ["id", "policy_id"]);
    if (!token || policyId === null) {
      return row;
    }
    try {
      const detailed = await getLeavePolicy(token, policyId);
      return detailed ? { ...row, ...detailed } : row;
    } catch {
      return row;
    }
  }

  async function loadPolicyIntoForm(row: AdminRecord) {
    if (!canUpdatePolicies) {
      return;
    }
    const loaded = await ensureLookups([
      "types",
      "departments",
      "positions",
      "branches",
      "grades",
    ]);
    if (!loaded) {
      return;
    }
    const policyId = readNumber(row, ["id", "policy_id"]);
    const detailed = await resolvePolicyRecord(row);
    setPolicyForm(leavePolicyRecordToForm(detailed));
    setEditingPolicyId(policyId);
    setPolicySheetOpen(true);
  }

  function openPolicyPreview(row: AdminRecord) {
    const requestId = ++policyPreviewRequestRef.current;
    setSelectedPolicyRow(row);
    setPolicyPreviewForm(leavePolicyRecordToForm(row));
    setPolicyPreviewOpen(true);
    setPolicyPreviewLoading(true);
    void (async () => {
      await ensureLookups([
        "types",
        "departments",
        "positions",
        "branches",
        "grades",
      ]);
      const detailed = await resolvePolicyRecord(row);
      if (policyPreviewRequestRef.current !== requestId) {
        return;
      }
      setSelectedPolicyRow(detailed);
      setPolicyPreviewForm(leavePolicyRecordToForm(detailed));
      setPolicyPreviewLoading(false);
    })();
  }

  function openCreatePolicySheet() {
    if (!canCreatePolicies) {
      return;
    }
    void (async () => {
      const loaded = await ensureLookups([
        "types",
        "departments",
        "positions",
        "branches",
        "grades",
      ]);
      if (!loaded) {
        return;
      }
      setEditingPolicyId(null);
      setPolicyForm(emptyLeavePolicyForm());
      setPolicySheetOpen(true);
    })();
  }

  async function submitWorkflowForm() {
    if (
      (editingWorkflowId === null && !canCreateWorkflows) ||
      (editingWorkflowId !== null && !canUpdateWorkflows)
    ) {
      return;
    }
    const token = readStoredToken();
    if (!token) {
      const message = "Authentication required. Please log in again.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (editingWorkflowId === null && workflowSteps.length === 0) {
      const message =
        "Add at least one workflow step before creating the workflow.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingWorkflowId === null) {
        await createLeaveWorkflow(token, {
          name: workflowForm.name.trim(),
          leave_type_id: Number(workflowForm.leave_type_id),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
          reminder_after_days: workflowForm.reminder_after_days
            ? Number(workflowForm.reminder_after_days)
            : null,
          escalate_after_days: workflowForm.escalate_after_days
            ? Number(workflowForm.escalate_after_days)
            : null,
          max_escalations: workflowForm.max_escalations
            ? Number(workflowForm.max_escalations)
            : 1,
          steps: workflowSteps.map((row) =>
            buildWorkflowStepPayload({
              approval_level: String(readNumber(row, ["approval_level"]) ?? 1),
              approver_type:
                readString(row, ["approver_type"]) === "-"
                  ? "role"
                  : String(row.approver_type ?? "role"),
              action_type:
                readString(row, ["action_type"]) === "-"
                  ? "recommend"
                  : String(row.action_type ?? "recommend"),
              role_id: String(readNumber(row, ["role_id"]) ?? ""),
              position_id: String(readNumber(row, ["position_id"]) ?? ""),
              company_user_id: String(
                readNumber(row, ["company_user_id"]) ?? "",
              ),
              assigned_branch_id: String(
                readNumber(row, ["assigned_branch_id"]) ?? "",
              ),
              assigned_department_id: String(
                readNumber(row, ["assigned_department_id"]) ?? "",
              ),
              is_required: readBoolean(row, ["is_required"]) ? "true" : "false",
            }),
          ),
        });
      } else {
        await patchLeaveWorkflow(token, editingWorkflowId, {
          name: workflowForm.name.trim(),
          leave_type_id: Number(workflowForm.leave_type_id),
          status: workflowForm.status,
          is_default: workflowForm.is_default === "true",
          reminder_after_days: workflowForm.reminder_after_days
            ? Number(workflowForm.reminder_after_days)
            : null,
          escalate_after_days: workflowForm.escalate_after_days
            ? Number(workflowForm.escalate_after_days)
            : null,
          max_escalations: workflowForm.max_escalations
            ? Number(workflowForm.max_escalations)
            : 1,
        });
      }
      setWorkflowForm({
        name: "",
        leave_type_id: "",
        status: "active",
        is_default: "false",
        reminder_after_days: "",
        escalate_after_days: "",
        max_escalations: "",
      });
      setEditingWorkflowId(null);
      setSelectedWorkflowId("");
      setWorkflowSteps([]);
      setWorkflowStartStage("details");
      clearWorkflowCreateDraft();
      setWorkflowDraft(null);
      setWorkflowSheetOpen(false);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to create leave workflow.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  function openCreateWorkflowSheet() {
    if (!canCreateWorkflows) {
      return;
    }
    void (async () => {
      const loaded = await ensureLookups(["types"]);
      if (!loaded) {
        return;
      }
      setEditingWorkflowId(null);
      setSelectedWorkflowId("");
      const draft = readWorkflowCreateDraft();
      if (draft) {
        setWorkflowForm({
          name: draft.form.name ?? "",
          leave_type_id: draft.form.leave_type_id ?? "",
          status: draft.form.status === "inactive" ? "inactive" : "active",
          is_default: draft.form.is_default === "true" ? "true" : "false",
          reminder_after_days: draft.form.reminder_after_days ?? "",
          escalate_after_days: draft.form.escalate_after_days ?? "",
          max_escalations: draft.form.max_escalations ?? "",
        });
        setWorkflowSteps(Array.isArray(draft.steps) ? draft.steps : []);
        setWorkflowStartStage(draft.stage === "path" ? "path" : "details");
      } else {
        setWorkflowSteps([]);
        setWorkflowForm({
          name: "",
          leave_type_id: "",
          status: "active",
          is_default: "false",
          reminder_after_days: "",
          escalate_after_days: "",
          max_escalations: "",
        });
        setWorkflowStartStage("details");
      }
      setWorkflowSheetOpen(true);
    })();
  }

  async function openEditWorkflowSheet(row: AdminRecord) {
    if (!canUpdateWorkflows) {
      return;
    }
    const loaded = await ensureLookups(["types"]);
    if (!loaded) {
      return;
    }
    const workflowId = readNumber(row, ["id", "workflow_id"]);
    if (workflowId === null) {
      return;
    }
    setEditingWorkflowId(workflowId);
    setWorkflowForm({
      name:
        readString(row, ["name", "title"]) === "-"
          ? ""
          : readString(row, ["name", "title"]),
      leave_type_id: String(readNumber(row, ["leave_type_id"]) ?? ""),
      status:
        readString(row, ["status"]).toLowerCase() === "inactive"
          ? "inactive"
          : "active",
      is_default: readBoolean(row, ["is_default"]) ? "true" : "false",
      reminder_after_days: String(readNumber(row, ["reminder_after_days"]) ?? ""),
      escalate_after_days: String(readNumber(row, ["escalate_after_days"]) ?? ""),
      max_escalations: String(readNumber(row, ["max_escalations"]) ?? ""),
    });
    setSelectedWorkflowId(String(workflowId));
    setWorkflowStartStage("path");
    await loadWorkflowSteps(String(workflowId));
    setWorkflowSheetOpen(true);
  }

  async function loadWorkflowSteps(workflowId: string) {
    const token = readStoredToken();
    if (!token || !workflowId) {
      setWorkflowSteps([]);
      return;
    }
    try {
      const detailed = await getLeaveWorkflow(token, workflowId);
      const inlineSteps = Array.isArray(detailed?.steps)
        ? (detailed?.steps as AdminRecord[])
        : Array.isArray(detailed?.workflow_steps)
          ? (detailed?.workflow_steps as AdminRecord[])
          : [];
      if (inlineSteps.length > 0) {
        setWorkflowSteps(inlineSteps);
        return;
      }
      const rows = await listLeaveWorkflowSteps(token, workflowId);
      setWorkflowSteps(rows);
    } catch {
      setWorkflowSteps([]);
    }
  }

  async function submitWorkflowStepForm(workflowIdOverride?: string) {
    const workflowId = workflowIdOverride ?? selectedWorkflowId;
    const canManageDraftSteps =
      editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows;
    if (
      (!workflowId && !canManageDraftSteps) ||
      (workflowId && !canUpdateWorkflows)
    ) {
      return;
    }
    const token = readStoredToken();
    const stepPayload = buildWorkflowStepPayload(workflowStepForm);

    if (
      !Number.isFinite(stepPayload.approval_level) ||
      stepPayload.approval_level < 1 ||
      stepPayload.approval_level > 2
    ) {
      const message =
        "Use level 1 (department manager) or level 2 (HR). For a third approval, add a management approval rule.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (stepPayload.approver_type === "role" && !stepPayload.role_id) {
      const message = "Choose a role for this workflow step.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (stepPayload.approver_type === "position" && !stepPayload.position_id) {
      const message = "Choose a position for this workflow step.";
      setError(message);
      showErrorAlert(message);
      return;
    }
    if (
      stepPayload.approver_type === "company_user" &&
      !stepPayload.company_user_id
    ) {
      const message = "Choose a company user for this workflow step.";
      setError(message);
      showErrorAlert(message);
      return;
    }

    if (!workflowId) {
      const draftStepId = editingWorkflowStepId ?? -Date.now();
      const draftStep: AdminRecord = {
        id: draftStepId,
        step_id: draftStepId,
        approval_level: stepPayload.approval_level,
        approver_type: stepPayload.approver_type,
        action_type: stepPayload.action_type,
        role_id: stepPayload.role_id ?? null,
        position_id: stepPayload.position_id ?? null,
        company_user_id: stepPayload.company_user_id ?? null,
        assigned_branch_id: stepPayload.assigned_branch_id ?? null,
        assigned_department_id: stepPayload.assigned_department_id ?? null,
        is_required: stepPayload.is_required,
      };

      setWorkflowSteps((current) => {
        if (editingWorkflowStepId === null) {
          return [...current, draftStep].sort(
            (left, right) =>
              (readNumber(left, ["approval_level"]) ?? 0) -
              (readNumber(right, ["approval_level"]) ?? 0),
          );
        }
        return current
          .map((row) => {
            const id = readNumber(row, ["id", "step_id"]);
            return id === editingWorkflowStepId ? draftStep : row;
          })
          .sort(
            (left, right) =>
              (readNumber(left, ["approval_level"]) ?? 0) -
              (readNumber(right, ["approval_level"]) ?? 0),
          );
      });
      setWorkflowStepForm((prev) => ({
        ...prev,
        approval_level: String((Number(prev.approval_level) || 0) + 1),
      }));
      setEditingWorkflowStepId(null);
      setStepDialogOpen(false);
      return;
    }

    if (!token) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingWorkflowStepId === null) {
        await createLeaveWorkflowStep(token, workflowId, stepPayload);
      } else {
        await patchLeaveWorkflowStep(
          token,
          workflowId,
          editingWorkflowStepId,
          stepPayload,
        );
      }
      setWorkflowStepForm((prev) => ({
        ...prev,
        approval_level: String((Number(prev.approval_level) || 0) + 1),
      }));
      setEditingWorkflowStepId(null);
      setStepDialogOpen(false);
      await loadWorkflowSteps(workflowId);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to create workflow step.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  function openCreateStepDialog() {
    const canManageDraftSteps =
      editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows;
    if (!canManageDraftSteps) {
      return;
    }
    void (async () => {
      const loaded = await ensureLookups([
        "employees",
        "departments",
        "positions",
        "branches",
        "roles",
      ]);
      if (!loaded) {
        return;
      }
      setEditingWorkflowStepId(null);
      setWorkflowStepForm({
        approval_level: String((workflowSteps.length || 0) + 1),
        approver_type: "role",
        action_type: "recommend",
        role_id: "",
        position_id: "",
        company_user_id: "",
        assigned_branch_id: "",
        assigned_department_id: "",
        is_required: "true",
      });
      setStepDialogOpen(true);
    })();
  }

  function openEditStepDialog(row: AdminRecord) {
    const canManageDraftSteps =
      editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows;
    if (!canManageDraftSteps) {
      return;
    }
    void (async () => {
      const loaded = await ensureLookups([
        "employees",
        "departments",
        "positions",
        "branches",
        "roles",
      ]);
      if (!loaded) {
        return;
      }
      const stepId = readNumber(row, ["id", "step_id"]);
      if (stepId === null) {
        return;
      }
      setEditingWorkflowStepId(stepId);
      setWorkflowStepForm({
        approval_level: String(readNumber(row, ["approval_level"]) ?? 1),
        approver_type:
          readString(row, ["approver_type"]) === "-"
            ? "role"
            : String(row.approver_type ?? "role"),
        action_type:
          readString(row, ["action_type"]) === "-"
            ? "recommend"
            : String(row.action_type ?? "recommend"),
        role_id: String(readNumber(row, ["role_id"]) ?? ""),
        position_id: String(readNumber(row, ["position_id"]) ?? ""),
        company_user_id: String(readNumber(row, ["company_user_id"]) ?? ""),
        assigned_branch_id: String(
          readNumber(row, ["assigned_branch_id"]) ?? "",
        ),
        assigned_department_id: String(
          readNumber(row, ["assigned_department_id"]) ?? "",
        ),
        is_required: readBoolean(row, ["is_required"]) ? "true" : "false",
      });
      setStepDialogOpen(true);
    })();
  }

  async function toggleWorkflowStatus(row: AdminRecord) {
    if (!canUpdateWorkflows) {
      return;
    }
    const token = readStoredToken();
    const id = readNumber(row, ["id", "workflow_id"]);
    if (!token || id === null) {
      return;
    }
    const nextStatus =
      readString(row, ["status"]).toLowerCase() === "active"
        ? "inactive"
        : "active";
    setSaving(true);
    try {
      await patchLeaveWorkflow(token, id, { status: nextStatus });
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update workflow status.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeWorkflow(row: AdminRecord) {
    if (!canDeleteWorkflows) {
      return;
    }
    const token = readStoredToken();
    const id = readNumber(row, ["id", "workflow_id"]);
    if (!token || id === null) {
      return;
    }
    setSaving(true);
    try {
      await deleteLeaveWorkflow(token, id);
      if (String(id) === selectedWorkflowId) {
        setSelectedWorkflowId("");
        setWorkflowSteps([]);
      }
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete workflow.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeWorkflowStep(row: AdminRecord) {
    const canManageDraftSteps =
      editingWorkflowId === null ? canCreateWorkflows : canUpdateWorkflows;
    if (
      (!selectedWorkflowId && !canManageDraftSteps) ||
      (selectedWorkflowId && !canDeleteWorkflows)
    ) {
      return;
    }
    const token = readStoredToken();
    const stepId = readNumber(row, ["id", "step_id"]);
    if (stepId === null) {
      return;
    }
    if (!selectedWorkflowId) {
      setWorkflowSteps((current) =>
        current.filter((entry) => {
          const entryId = readNumber(entry, ["id", "step_id"]);
          return entryId !== stepId;
        }),
      );
      return;
    }
    if (!token) {
      return;
    }
    setSaving(true);
    try {
      await deleteLeaveWorkflowStep(token, selectedWorkflowId, stepId);
      await loadWorkflowSteps(selectedWorkflowId);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete workflow step.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTypeStatus(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      return;
    }
    const currentStatus =
      readString(row, ["status"]) === "active" ? "active" : "inactive";
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    setSaving(true);
    try {
      await patchLeaveType(token, id, { status: nextStatus });
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update leave type status.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeType(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      return;
    }
    setSaving(true);
    try {
      await deleteLeaveType(token, id);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete leave type.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function approveRequest(
    row: AdminRecord,
    action: "approve" | "reject" | "return_for_correction" = "approve",
  ) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      return;
    }
    const permissions = getLeaveRequestPermissions(row, currentActor);
    if (!permissions.canApproveOrReject) {
      showErrorAlert(permissions.reasonApprove);
      return;
    }
    const signed = await askSignature({
      title:
        action === "approve"
          ? `Approve ${leaveRequestLabel(row)}`
          : action === "reject"
            ? `Reject ${leaveRequestLabel(row)}`
            : `Return ${leaveRequestLabel(row)} for correction`,
      confirmLabel:
        action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Return",
      commentRequired: action !== "approve",
      commentLabel: action === "approve" ? "Remarks" : "Reason",
      signerName: identity.name ?? "",
      destructive: action === "reject",
    });
    if (!signed) return;
    setSaving(true);
    try {
      // API: POST /api/leave/requests/{id}/approval-action
      // body: { action: approve | reject | return_for_correction, comments?: string }
      // Do not send `approve` — backend rejects that property.
      const defaultComment =
        action === "approve"
          ? "Approved from dashboard"
          : action === "reject"
            ? "Rejected from dashboard"
            : "Returned for correction from dashboard";

      const acting =
        action === "approve" && actingDraftRef.current?.id === id
          ? actingDraftRef.current.draft
          : null;
      const actionResult = await leaveRequestApprovalAction(token, id, {
        action,
        comments: signed.comments || defaultComment,
        signature: signed.signature,
        ...(acting ? { acting_assignment: acting } : {}),
      });
      if (acting) actingDraftRef.current = null;

      const successMessage =
        action === "approve"
          ? readString(asRecord(actionResult) ?? {}, ["status"]) === "approved"
            ? "Leave request fully approved."
            : "Your approval was recorded. The request is awaiting the next reviewer."
          : action === "reject"
            ? "Leave request rejected."
            : "Leave request returned for correction.";
      showSuccessAlert(successMessage);
      await reloadAll(tab, true);
      if (
        selectedLeaveRequestRow &&
        readNumber(selectedLeaveRequestRow, ["id"]) === id
      ) {
        const refreshed = (
          await listLeaveRequests(token, {
            page: 1,
            limit: 100,
            sortBy: "created_at",
            sortOrder: "DESC",
          })
        ).rows.find((item) => readNumber(item, ["id"]) === id);
        if (refreshed) setSelectedLeaveRequestRow(refreshed);
      }
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update leave request.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function overrideRequest(
    row: AdminRecord,
    action: "approve" | "reject" | "return_for_correction",
  ) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    setOverrideDialog({ row, action });
    setOverrideReason("");
  }

  async function submitOverrideRequest() {
    if (!overrideDialog) return;
    const { action } = overrideDialog;
    const token = readStoredToken();
    const id = readNumber(overrideDialog.row, ["id"]);
    if (!token || id === null) return;
    const reason = overrideReason.trim();
    if (reason.length < 5) {
      showErrorAlert("Give a reason of at least 5 characters.");
      return;
    }
    const signed = await askSignature({
      title: "Sign the decision you record for the manager",
      confirmLabel: action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Return",
      commentLabel: "Reason (in place of the manager)",
      commentRequired: true,
      defaultComment: reason,
      signerName: identity.name ?? "",
      destructive: action === "reject",
    });
    if (!signed) return;
    setSaving(true);
    try {
      // API: POST /api/leave/requests/{id}/approval-action with hr_override (needs leave_requests:override)
      await leaveRequestApprovalAction(token, id, {
        action,
        comments: signed.comments || reason,
        hr_override: true,
        signature: signed.signature,
      });
      showSuccessAlert(
        action === "approve"
          ? "Manager stage completed by HR. The request moves to the HR stage."
          : action === "reject"
            ? "Leave request rejected by HR in place of the manager."
            : "Leave request returned for correction by HR.",
      );
      setOverrideDialog(null);
      setOverrideReason("");
      await reloadAll(tab, true);
      setSelectedLeaveRequestRow(null);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update leave request.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest(row: AdminRecord, reason: string) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      return;
    }
    if (!reason.trim()) {
      return;
    }
    const permissions = getLeaveRequestPermissions(row, currentActor);
    if (!permissions.canCancel) {
      showErrorAlert(permissions.reasonCancel);
      return;
    }
    setSaving(true);
    try {
      await cancelLeaveRequest(token, id, reason.trim());
      showSuccessAlert("Leave request cancelled.");
      await reloadAll(tab, true);
      setLeaveRequestDetailsOpen(false);
      setSelectedLeaveRequestRow(null);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to cancel leave request.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function endRequestEarly(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    const start = String(row.start_date ?? "").slice(0, 10);
    const end = String(row.end_date ?? "").slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const suggested = today > start && today < end ? today : start;
    const form = await fluentForm(
      [
        {
          name: "newEnd",
          label: "New last day of leave",
          type: "date",
          defaultValue: suggested,
          required: true,
          hint: `From ${start} to the day before ${end}.`,
        },
        {
          name: "reason",
          label: "Reason (optional)",
          type: "textarea",
          defaultValue: "Returned to work early",
        },
      ],
      {
        title: "End leave early",
        message: "Unused days return to the employee's balance.",
        confirmLabel: "End leave",
      },
    );
    if (!form?.newEnd) return;
    const newEnd = form.newEnd;
    const reason = form.reason;
    setSaving(true);
    try {
      await endLeaveEarly(token, id, {
        new_end_date: newEnd.trim(),
        reason: reason?.trim() || undefined,
      });
      showSuccessAlert("Leave shortened. Unused days were returned to the balance.");
      await reloadAll(tab, true);
      setLeaveRequestDetailsOpen(false);
      setSelectedLeaveRequestRow(null);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Could not end leave early.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function revokeRequestVerificationCode(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    const form = await fluentForm(
      [
        {
          name: "reason",
          label: "Reason",
          type: "textarea",
          required: true,
          hint: "At least 5 characters. Recorded in the audit log.",
          placeholder: "e.g. Printed copy was altered",
        },
      ],
      {
        title: "Revoke QR verification code",
        message:
          "Anyone scanning a PDF already issued for this request will see \"Approval revoked\". The leave request itself is not changed. The next PDF download gets a new code.",
        confirmLabel: "Revoke code",
      },
    );
    if (!form) return;
    if (form.reason.length < 5) {
      showErrorAlert("Give a reason of at least 5 characters.");
      return;
    }
    setSaving(true);
    try {
      await revokeLeaveVerificationCode(token, id, form.reason);
      showSuccessAlert(
        "Verification code revoked. Download the PDF again to issue a new code.",
      );
    } catch (errorObject) {
      showErrorAlert(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not revoke the verification code.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadRequestPdf(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      const result = await downloadLeavePdfWithFallback((options) =>
        downloadLeaveRequestPdf(token, id, options),
      );
      if (!result) return;
      downloadBlob(result.blob, result.filename);
      showSuccessAlert(
        result.formOnly
          ? "Leave form downloaded without supporting documents."
          : "Leave request PDF downloaded.",
      );
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to download leave request PDF.";
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveLeaveMedicalDetail(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      let attachmentUrl = leaveMedicalForm.attachment_url.trim();
      if (leaveMedicalAttachmentFile) {
        const file = await fileToBase64UploadDto(leaveMedicalAttachmentFile);
        const uploadedDocument = asRecord(
          await addLeaveRequestDocument(token, id, { file }),
        );
        attachmentUrl = uploadedDocument
          ? readString(uploadedDocument, ["file_url"])
          : "";
        if (!attachmentUrl) {
          throw new Error(
            "The attachment was uploaded, but its file reference was not returned.",
          );
        }
        setLeaveMedicalForm((current) => ({
          ...current,
          attachment_url: attachmentUrl,
        }));
        setLeaveMedicalAttachmentFile(null);
        if (leaveMedicalAttachmentInputRef.current) {
          leaveMedicalAttachmentInputRef.current.value = "";
        }
      }
      await patchLeaveRequestMedicalDetail(token, id, {
        sickness_nature: leaveMedicalForm.sickness_nature.trim() || undefined,
        doctor_name: leaveMedicalForm.doctor_name.trim() || undefined,
        doctor_phone: leaveMedicalForm.doctor_phone.trim() || undefined,
        hospital_name: leaveMedicalForm.hospital_name.trim() || undefined,
        treatment_start_date:
          leaveMedicalForm.treatment_start_date || undefined,
        treatment_end_date: leaveMedicalForm.treatment_end_date || undefined,
        attachment_url: attachmentUrl || undefined,
      });
      await refreshLeaveRequestDetail(row);
      showSuccessAlert("Medical detail saved.");
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to save medical detail.";
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function manageLeaveFollowUp(
    row: AdminRecord,
    action: "routing" | "deadline",
  ) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) return;
    setSaving(true);
    try {
      if (action === "routing") await retryLeaveRouting(token, id);
      else {
        if (!evidenceDeadline || !evidenceReason.trim())
          throw new Error("Enter a new deadline and a reason.");
        await extendLeaveEvidenceDeadline(
          token,
          id,
          new Date(evidenceDeadline).toISOString(),
          evidenceReason.trim(),
        );
      }
      await refreshLeaveRequestDetail(row);
      setEvidenceDeadline("");
      setEvidenceReason("");
      showSuccessAlert(
        action === "routing"
          ? "Manager routing restored."
          : "Evidence deadline extended.",
      );
    } catch (error) {
      showErrorAlert(
        error instanceof Error
          ? error.message
          : "Could not update leave request.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadLeaveDocument(row: AdminRecord) {
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }
    if (!leaveDocumentFile) {
      showErrorAlert("Choose a document to upload first.");
      return;
    }

    setSaving(true);
    try {
      const file = await fileToBase64UploadDto(leaveDocumentFile);
      await addLeaveRequestDocument(token, id, { file });
      setLeaveDocumentFile(null);
      await refreshLeaveRequestDetail(row);
      showSuccessAlert("Leave document uploaded.");
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to upload leave document.";
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function downloadRequestDocument(
    row: AdminRecord,
    documentRow: AdminRecord,
  ) {
    const token = readStoredToken();
    const requestId = readNumber(row, ["id"]);
    const documentId = readNumber(documentRow, ["id"]);
    if (!token || requestId === null || documentId === null) {
      showErrorAlert("Authentication required. Please log in again.");
      return;
    }

    setSaving(true);
    try {
      const result = await downloadLeaveRequestDocument(
        token,
        requestId,
        documentId,
      );
      downloadBlob(result.blob, result.filename);
      showSuccessAlert("Leave document downloaded.");
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to download leave document.";
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleHolidayRecurring(row: AdminRecord) {
    if (!canUpdateHolidays) {
      return;
    }
    const token = readStoredToken();
    const id = readNumber(row, ["id"]);
    if (!token || id === null) {
      return;
    }
    setSaving(true);
    try {
      await patchLeaveHoliday(token, id, {
        is_recurring: !readBoolean(row, ["is_recurring"]),
      });
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to update holiday.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(row: AdminRecord) {
    if (!canDeleteHolidays) {
      return;
    }
    const token = readStoredToken();
    const id = readLeaveHolidayId(row);
    if (!token || id === null) {
      return;
    }
    setSaving(true);
    try {
      await deleteLeaveHoliday(token, id);
      await reloadAll(tab, true);
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Failed to delete holiday.";
      setError(message);
      showErrorAlert(message);
    } finally {
      setSaving(false);
    }
  }

  const refreshButton = (
    <button
      type="button"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm"
      onClick={() => void reloadAll(tab, true)}
      disabled={loading}
      aria-label="Refresh"
      title="Refresh"
    >
      <RefreshCw
        className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`}
      />
    </button>
  );

  const canContinueLeaveTypeWizard = Boolean(
    typeForm.name.trim(),
  );
  const leaveTypeWizardIndex = LEAVE_TYPE_WIZARD_STEPS.findIndex(
    (item) => item.key === typeDialogStep,
  );
  const leaveRequestWizardIndex = LEAVE_REQUEST_WIZARD_STEPS.findIndex(
    (item) => item.key === requestDialogStep,
  );
  const canContinueRequestWho = Boolean(
    requestForm.employee_id && requestForm.leave_type_id,
  );
  const canContinueRequestWhen = Boolean(
    requestForm.start_date &&
    requestForm.end_date &&
    new Date(requestForm.start_date).getTime() <=
      new Date(requestForm.end_date).getTime(),
  );
  const requestEmployeeLabel =
    employeeOptions.find((option) => option.value === requestForm.employee_id)
      ?.label || "Not selected";
  const requestLeaveTypeLabel =
    leaveTypeOptions.find(
      (option) => option.value === requestForm.leave_type_id,
    )?.label || "Not selected";
  const formatRequestDate = (value: string) => {
    if (!value) return "Not set";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  const leaveRequestReviewItems = [
    ...(requestPreview.preview
      ? [
          {
            label: "Leave days charged",
            value: `${requestPreview.preview.chargeable_days} of ${requestPreview.preview.calendar_days} calendar day(s)`,
          },
        ]
      : []),
    { label: "Employee", value: requestEmployeeLabel },
    { label: "Leave type", value: requestLeaveTypeLabel },
    { label: "Start", value: formatRequestDate(requestForm.start_date) },
    { label: "End", value: formatRequestDate(requestForm.end_date) },
    {
      label: "Action",
      value: requestForm.submit === "true" ? "Submit now" : "Save as draft",
    },
  ];
  const leaveTypeReviewItems = [
    {
      label: "Leave type",
      value: typeForm.code.trim()
        ? `${typeForm.name.trim() || "Not named"} · ${typeForm.code.trim()}`
        : typeForm.name.trim() || "Not named",
    },
    {
      label: "Availability",
      value: typeForm.status === "active" ? "Active" : "Inactive",
    },
    {
      label: "Pay",
      value: typeForm.is_paid === "true" ? "Paid leave" : "Unpaid leave",
    },
    {
      label: "Document",
      value:
        typeForm.requires_attachment !== "true"
          ? "Optional"
          : typeForm.attachment_required_after_days.trim() !== ""
            ? `Required over ${typeForm.attachment_required_after_days} day(s)`
            : "Required",
    },
    {
      label: "Unused days",
      value:
        typeForm.is_carry_forward_allowed === "true"
          ? typeForm.max_carry_forward_days.trim() === ""
            ? "Move to next year · no cap"
            : `Move to next year · up to ${Number(typeForm.max_carry_forward_days) || 0} days`
          : "Expire at year end",
    },
    {
      label: "Yearly maximum",
      value:
        Number(typeForm.max_days_per_year) > 0
          ? `${typeForm.max_days_per_year} days`
          : "No limit",
    },
    {
      label: "Who can use it",
      value:
        typeForm.gender_restriction === "male"
          ? "Male employees only"
          : typeForm.gender_restriction === "female"
            ? "Female employees only"
            : "Everyone",
    },
  ];

  return (
    <div className="space-y-2">
      {showTabButtons ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleLeaveTabs.map(({ key, label }) => {
            return (
              <button
                key={key}
                type="button"
                className={
                  tab === key
                    ? "inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-medium !text-white"
                    : "inline-flex h-8 items-center rounded-md border border-slate-300 px-2.5 text-xs"
                }
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {tab === "types" ? (
        <LeaveTypesCatalog
          types={types}
          loading={loading}
          canEdit={canCreateTypes}
          canDelete={canDeleteTypes}
          onRefresh={() => void reloadAll(tab, true)}
          onCreate={openTypeDialogForCreate}
          onEdit={openTypeDialogForEdit}
          onDelete={(row) => setPendingTypeDelete(row)}
          onToggleStatus={(row) => void toggleTypeStatus(row)}
        />
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-2">
          <div
            role="tablist"
            aria-label="Leave request views"
            className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
          >
            {(
              [
                ["all", "All requests"],
                ["pending_my_approval", "Pending my approval"],
                ["my_approval_history", "My approval history"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={requestView === key}
                onClick={() => setRequestView(key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  requestView === key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
                {key === "pending_my_approval" &&
                pendingMyApprovalCount !== null &&
                pendingMyApprovalCount > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                    {pendingMyApprovalCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-1.5 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              <SearchToggleField
                className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
                placeholder="Search leave requests"
                value={requestSearch}
                onChange={setRequestSearch}
              />
              <FluentSelect
                ariaLabel="Filter leave request status"
                size="small"
                className="w-[8.5rem]"
                value={requestStatusFilter}
                onChange={setRequestStatusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  {
                    value: "pending_department_manager",
                    label: "Manager review",
                  },
                  { value: "pending_hr", label: "HR review" },
                  { value: "routing_required", label: "Routing correction" },
                  { value: "evidence_overdue", label: "Evidence overdue" },
                  { value: "evidence_pending", label: "Evidence pending" },
                  { value: "draft", label: "draft" },
                  { value: "submitted", label: "submitted" },
                  { value: "in_review", label: "Management review" },
                  { value: "approved", label: "approved" },
                  { value: "rejected", label: "rejected" },
                  { value: "cancelled", label: "cancelled" },
                  { value: "completed", label: "completed" },
                ]}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canCreateRequests ? (
                <>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold"
                    onClick={() => {
                      setRequestImportFile(null);
                      setRequestImportResult(null);
                      setRequestImportOpen(true);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Import
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={() => void openRequestDialog()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Leave Request
                  </button>
                </>
              ) : null}
              {refreshButton}
            </div>
          </div>

          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {loading && filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading leave requests…
              </p>
            ) : filteredRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No leave requests found.
              </p>
            ) : (
              filteredRequests.map((row, index) => {
                const permissions = getLeaveRequestPermissions(
                  row,
                  currentActor,
                );
                const rowKey = String(
                  readNumber(row, ["id"]) ?? leaveRequestLabel(row) ?? index,
                );
                const status = readString(row, ["status"]);
                const normalizedStatus = normalizeLeaveStatusLabel(status);
                const completedSuccessfully =
                  normalizedStatus === "approved" ||
                  normalizedStatus === "completed";
                const duration = leaveRequestDuration(row);
                const hasActions =
                  permissions.canApproveOrReject || permissions.canCancel;

                return (
                  <div
                    key={`leave-request-card-${rowKey}`}
                    className="overflow-hidden rounded-lg border border-border/70 bg-background"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30"
                      onClick={() => void openLeaveRequestDetails(row)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {employeeLabelFromRow(row)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {leaveRequestLabel(row)}
                        </p>
                        <p className="mt-1 truncate text-xs font-medium text-foreground/80">
                          {leaveTypeLabelFromRequest(row)}
                        </p>
                      </div>
                      <StatusIndicator status={status} />
                    </button>

                    <div className="mx-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg bg-muted/45 px-3 py-2.5">
                      <div className="min-w-0">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Starts
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {formatLeaveRequestCardDate(
                            readString(row, ["start_date"]),
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                        <ArrowRight className="size-3.5" />
                        {duration ? (
                          <span className="whitespace-nowrap text-[10px]">
                            {duration}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-right">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Ends
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                          {formatLeaveRequestCardDate(
                            readString(row, ["end_date"]),
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mx-3 mt-2.5 flex w-[calc(100%_-_1.5rem)] items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-left transition-colors hover:bg-muted/30"
                      onClick={() => void openLeaveRequestDetails(row)}
                    >
                      <span
                        className={cn(
                          "inline-flex size-5 shrink-0 items-center justify-center",
                          permissions.isTerminal
                            ? completedSuccessfully
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-rose-700 dark:text-rose-300"
                            : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {permissions.isTerminal ? (
                          completedSuccessfully ? (
                            <Check className="size-3.5" />
                          ) : (
                            <X className="size-3.5" />
                          )
                        ) : (
                          <Clock3 className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Approval progress
                        </span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-foreground">
                          {permissions.waitingLabel}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>

                    {hasActions ? (
                      <div className="mt-3 flex gap-2 border-t border-border/60 px-3 py-2.5">
                        {permissions.canApproveOrReject ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={saving}
                              title={permissions.reasonApprove}
                              onClick={() =>
                                void approveRequest(row, "approve")
                              }
                            >
                              <Check className="size-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950/30"
                              disabled={saving}
                              title={permissions.reasonApprove}
                              onClick={() => void approveRequest(row, "reject")}
                            >
                              <X className="size-3.5" />
                              Reject
                            </button>
                          </>
                        ) : null}
                        {permissions.canCancel ? (
                          <button
                            type="button"
                            className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                            disabled={saving}
                            title={permissions.reasonCancel}
                            onClick={() => {
                              setPendingRequestCancel(row);
                              setCancelReason("Cancelled by admin");
                            }}
                          >
                            Cancel request
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 flex w-full items-center justify-center gap-1 border-t border-border/60 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                        onClick={() => void openLeaveRequestDetails(row)}
                      >
                        View request details
                        <ChevronRight className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop / tablet table */}
          <div className="hidden min-w-0 md:block">
            <ResizableTable
              title="Leave Requests"
              toolbarStart={
                <>
                  <span className="mr-1 shrink-0 text-xs font-semibold text-foreground">
                    Leave Requests
                  </span>
                  <SearchToggleField
                    className="min-w-0 !w-auto !max-w-[12rem] !flex-none"
                    placeholder="Search leave requests"
                    value={requestSearch}
                    onChange={setRequestSearch}
                  />
                  <FluentSelect
                    ariaLabel="Filter leave request status"
                    size="small"
                    className="w-[8.5rem]"
                    value={requestStatusFilter}
                    onChange={setRequestStatusFilter}
                    options={[
                      { value: "all", label: "All statuses" },
                      {
                        value: "pending_department_manager",
                        label: "Manager review",
                      },
                      { value: "pending_hr", label: "HR review" },
                      {
                        value: "routing_required",
                        label: "Routing correction",
                      },
                      { value: "evidence_overdue", label: "Evidence overdue" },
                      { value: "evidence_pending", label: "Evidence pending" },
                      { value: "draft", label: "draft" },
                      { value: "submitted", label: "submitted" },
                      { value: "in_review", label: "Management review" },
                      { value: "approved", label: "approved" },
                      { value: "rejected", label: "rejected" },
                      { value: "cancelled", label: "cancelled" },
                      { value: "completed", label: "completed" },
                    ]}
                  />
                </>
              }
              toolbarActions={
                <>
                  {canCreateRequests ? (
                    <>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold"
                        onClick={() => {
                          setRequestImportFile(null);
                          setRequestImportResult(null);
                          setRequestImportOpen(true);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Import Excel
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                        onClick={() => void openRequestDialog()}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Leave Request
                      </button>
                    </>
                  ) : null}
                  {refreshButton}
                </>
              }
              data={filteredRequests}
              getRowId={(row) => String(readNumber(row, ["id"]) ?? "")}
              page={requestPage}
              totalPages={requestMeta.totalPages}
              totalItems={requestMeta.total}
              onPageChange={setRequestPage}
              showCheckboxes={canBulkDecide}
              selectedRowIds={selectedRequestIds}
              onSelectedRowIdsChange={setSelectedRequestIds}
              filterCount={
                Object.values(requestFilters).filter(Boolean).length
              }
              filterContent={
                <div className="grid w-72 gap-2 text-xs">
                  <label className="grid gap-1">
                    <span className="font-medium">Department</span>
                    <FluentSelect
                      ariaLabel="Filter by department"
                      size="small"
                      value={requestFilters.department_id}
                      onChange={(value) =>
                        setRequestFilters((prev) => ({ ...prev, department_id: value }))
                      }
                      options={[
                        { value: "", label: "All departments" },
                        ...departments.map((row) => ({
                          value: String(row.id),
                          label: readString(row, ["name"]) || `#${String(row.id)}`,
                        })),
                      ]}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="font-medium">Manager</span>
                    <FluentSelect
                      ariaLabel="Filter by manager"
                      size="small"
                      value={requestFilters.manager_employee_id}
                      onChange={(value) =>
                        setRequestFilters((prev) => ({ ...prev, manager_employee_id: value }))
                      }
                      options={[
                        { value: "", label: "Any manager" },
                        ...employees.map((row) => ({
                          value: String(row.id),
                          label: employeeLabel(readNumber(row, ["id"])),
                        })),
                      ]}
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="font-medium">Leave type</span>
                    <FluentSelect
                      ariaLabel="Filter by leave type"
                      size="small"
                      value={requestFilters.leave_type_id}
                      onChange={(value) =>
                        setRequestFilters((prev) => ({ ...prev, leave_type_id: value }))
                      }
                      options={[{ value: "", label: "All leave types" }, ...leaveTypeOptions]}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1">
                      <span className="font-medium">From</span>
                      <input
                        type="date"
                        className="h-8 rounded-md border border-border bg-background px-2"
                        value={requestFilters.from_date}
                        onChange={(event) =>
                          setRequestFilters((prev) => ({ ...prev, from_date: event.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium">To</span>
                      <input
                        type="date"
                        className="h-8 rounded-md border border-border bg-background px-2"
                        value={requestFilters.to_date}
                        onChange={(event) =>
                          setRequestFilters((prev) => ({ ...prev, to_date: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="text-left font-medium text-primary hover:underline"
                    onClick={() =>
                      setRequestFilters({
                        department_id: "",
                        manager_employee_id: "",
                        leave_type_id: "",
                        from_date: "",
                        to_date: "",
                      })
                    }
                  >
                    Clear filters
                  </button>
                </div>
              }
              toolbarSummary={
                selectedRequestIds.length ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
                    <span className="font-medium">
                      {selectedRequestIds.length} selected
                    </span>
                    <Button
                      appearance="primary"
                      size="small"
                      disabled={bulkBusy}
                      onClick={() => void runBulkDecision("approve")}
                    >
                      Approve selected
                    </Button>
                    <Button
                      appearance="secondary"
                      size="small"
                      disabled={bulkBusy}
                      onClick={() => void runBulkDecision("reject")}
                    >
                      Reject selected
                    </Button>
                    <span className="text-muted-foreground">
                      Each request is checked individually; ones you cannot act on are reported back.
                    </span>
                  </div>
                ) : undefined
              }
              onRowSelect={(_, row) => {
                if (row) {
                  void openLeaveRequestDetails(row);
                }
              }}
              columns={[
                {
                  key: "leave_id",
                  label: "ID",
                  defaultWidth: 72,
                  render: (r) => leaveRequestLabel(r),
                },
                {
                  key: "employee",
                  label: "Employee",
                  defaultWidth: 110,
                  render: (r) => employeeLabelFromRow(r),
                },
                {
                  key: "leave_type",
                  label: "Type",
                  defaultWidth: 90,
                  render: (r) => leaveTypeLabelFromRequest(r),
                },
                {
                  key: "start_date",
                  label: "Start",
                  defaultWidth: 84,
                  render: (r) => readString(r, ["start_date"]),
                },
                {
                  key: "end_date",
                  label: "End",
                  defaultWidth: 84,
                  render: (r) => readString(r, ["end_date"]),
                },
                {
                  key: "status",
                  label: "Status",
                  defaultWidth: 100,
                  render: (r) => (
                    <StatusIndicator status={readString(r, ["status"])} />
                  ),
                },
                {
                  key: "pending",
                  label: "Pending with",
                  defaultWidth: 130,
                  sortable: false,
                  render: (r) => {
                    const permissions = getLeaveRequestPermissions(
                      r,
                      currentActor,
                    );
                    if (permissions.isTerminal) {
                      return (
                        <span className="text-[11px] text-muted-foreground">
                          —
                        </span>
                      );
                    }
                    return (
                      <span
                        className="block max-w-full truncate text-xs text-foreground"
                        title={permissions.waitingLabel}
                      >
                        {permissions.waitingLabel}
                      </span>
                    );
                  },
                },
                {
                  key: "actions",
                  label: "Actions",
                  defaultWidth: 56,
                  sortable: false,
                  render: (row) => {
                    const permissions = getLeaveRequestPermissions(
                      row,
                      currentActor,
                    );

                    if (permissions.isTerminal) {
                      return (
                        <span className="text-[11px] text-muted-foreground">
                          —
                        </span>
                      );
                    }

                    return (
                      <div
                        className="flex w-full items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted"
                            aria-label="Request actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-48">
                            <DropdownMenuItem
                              disabled={
                                !permissions.canApproveOrReject || saving
                              }
                              onClick={() => {
                                if (!permissions.canApproveOrReject) return;
                                void approveRequest(row, "approve");
                              }}
                              className="text-emerald-700 focus:text-emerald-700"
                            >
                              <Check className="size-3.5" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={
                                !permissions.canApproveOrReject || saving
                              }
                              onClick={() => {
                                if (!permissions.canApproveOrReject) return;
                                void approveRequest(row, "reject");
                              }}
                              className="text-amber-700 focus:text-amber-700"
                            >
                              <X className="size-3.5" />
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={saving}
                              onClick={() => {
                                const token = readStoredToken();
                                const id = readNumber(row, ["id"]);
                                if (!token || id === null) return;
                                void submitLeaveRequest(token, id)
                                  .then(() => {
                                    showSuccessAlert(
                                      "Leave request submitted.",
                                    );
                                    return reloadAll("requests", true);
                                  })
                                  .catch((errorObject) =>
                                    showErrorAlert(
                                      errorObject instanceof Error
                                        ? errorObject.message
                                        : "Submit failed.",
                                    ),
                                  );
                              }}
                            >
                              Submit draft
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={saving}
                              onClick={() => {
                                const token = readStoredToken();
                                const id = readNumber(row, ["id"]);
                                if (!token || id === null) return;
                                void resubmitLeaveRequest(token, id)
                                  .then(() => {
                                    showSuccessAlert(
                                      "Leave request resubmitted.",
                                    );
                                    return reloadAll("requests", true);
                                  })
                                  .catch((errorObject) =>
                                    showErrorAlert(
                                      errorObject instanceof Error
                                        ? errorObject.message
                                        : "Resubmit failed.",
                                    ),
                                  );
                              }}
                            >
                              Resubmit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={!permissions.canCancel || saving}
                              onClick={() => {
                                if (!permissions.canCancel) return;
                                setPendingRequestCancel(row);
                                setCancelReason("Cancelled by admin");
                              }}
                            >
                              Cancel request
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void openLeaveRequestDetails(row)}
                            >
                              View approval chain
                            </DropdownMenuItem>
                            {!permissions.canApproveOrReject ? (
                              <div className="border-t border-border px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
                                {permissions.reasonApprove}
                              </div>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  },
                },
              ]}
              loading={loading}
              showExport={false}
              storageKey="leave-requests-v3"
            />
          </div>

          <Dialog
            open={leaveRequestDetailsOpen}
            onOpenChange={(open) => {
              setLeaveRequestDetailsOpen(open);
              if (!open) {
                setSelectedLeaveRequestRow(null);
                setRequestDetailTab("overview");
                setLeaveDocumentFile(null);
                setLeaveMedicalForm(createEmptyLeaveMedicalForm());
              }
            }}
          >
            <DialogPopup
              from="bottom"
              className="w-[calc(100%-1rem)] max-w-2xl !p-0 sm:max-w-3xl"
              bodyClassName="!gap-0 !max-h-[94dvh] overscroll-contain"
            >
              {selectedLeaveRequestRow ? (
                (() => {
                  const row = selectedLeaveRequestRow;
                  const isMedical = isMedicalLeaveRequest(row);
                  const totalDays = readNumber(row, ["total_days", "days"]);
                  const durationType = readString(row, ["duration_type"]);
                  const reasonText = readString(row, ["reason"]);
                  const applied = readString(row, ["submitted_at", "applied_at", "created_at"]);
                  const docCount = leaveRequestDocuments.length;
                  const tabs: Array<{ key: typeof requestDetailTab; label: string; badge?: number }> = [
                    { key: "overview", label: "Overview" },
                    { key: "approvals", label: "Approvals" },
                    { key: "documents", label: "Documents", badge: docCount },
                    ...(isMedical ? [{ key: "medical" as const, label: "Medical" }] : []),
                  ];
                  const activeTab = tabs.some((t) => t.key === requestDetailTab)
                    ? requestDetailTab
                    : "overview";
                  const fact = (label: string, value: React.ReactNode) => (
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  );
                  return (
                    <>
                      <DialogHeader className="!mb-0 space-y-3 border-b border-border !px-4 pb-3 !pt-4 pr-12 text-left sm:!px-6">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <DialogTitle className="text-lg leading-snug">
                              {leaveRequestLabel(row)}
                            </DialogTitle>
                            <StatusIndicator status={readString(row, ["status"])} />
                          </div>
                          <DialogDescription className="text-sm">
                            {employeeLabelFromRow(row)} · {leaveTypeLabelFromRequest(row)}
                          </DialogDescription>
                        </div>
                        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 px-3 py-2.5 sm:grid-cols-4">
                          {fact(
                            "Period",
                            `${formatLeaveDateTime(readString(row, ["start_date"])).split(",")[0]} – ${formatLeaveDateTime(readString(row, ["end_date"])).split(",")[0]}`,
                          )}
                          {fact("Days", totalDays !== null ? `${totalDays} day${totalDays === 1 ? "" : "s"}` : "-")}
                          {fact(
                            "Duration",
                            durationType && durationType !== "-"
                              ? durationType.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())
                              : "Full day",
                          )}
                          {fact("Applied", applied && applied !== "-" ? formatLeaveDateTime(applied) : "-")}
                        </div>
                        <div className="-mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Leave request sections">
                          {tabs.map((t) => (
                            <button
                              key={t.key}
                              type="button"
                              role="tab"
                              aria-selected={activeTab === t.key}
                              onClick={() => setRequestDetailTab(t.key)}
                              className={cn(
                                "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                                activeTab === t.key
                                  ? "border-primary font-semibold text-foreground"
                                  : "border-transparent text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {t.label}
                              {t.badge ? (
                                <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
                                  {t.badge}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </DialogHeader>

                      <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
                        {activeTab === "overview" ? (
                          <>
                            <section className="space-y-1.5">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Reason
                              </h3>
                              <p className="whitespace-pre-wrap rounded-lg border border-border px-3 py-2.5 text-sm text-foreground">
                                {reasonText && reasonText !== "-" ? reasonText : "No reason given."}
                              </p>
                            </section>
                            {(() => {
                              const requestId = readNumber(row, ["id"]);
                              if (requestId === null) return null;
                              actingDraftRequestId.current = requestId;
                              return (
                                <ActingEmployeePanel
                                  key={requestId}
                                  token={readStoredToken()}
                                  leaveRequestId={requestId}
                                  leaveStatus={readString(row, ["status"])}
                                  leaveStart={readString(row, ["start_date"])}
                                  leaveEnd={readString(row, ["end_date"])}
                                  absentEmployeeId={readNumber(row, ["employee_id"])}
                                  savesWithDecision={
                                    getLeaveRequestPermissions(row, currentActor).canApproveOrReject
                                  }
                                  onDraftChange={handleActingDraft}
                                />
                              );
                            })()}
                            <section className="space-y-2">
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Status and follow-up
                              </h3>
                                <p role="status" className="text-sm text-muted-foreground">
                                  {leaveEvidenceMessage(selectedLeaveRequestRow)}
                                </p>
                                {selectedLeaveRequestRow.notice_overridden_at ? (
                                  <p
                                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
                                    data-testid="leave-notice-override"
                                  >
                                    <span className="font-semibold">
                                      Notice period overridden by HR
                                    </span>
                                    {" on "}
                                    {new Date(
                                      String(selectedLeaveRequestRow.notice_overridden_at),
                                    ).toLocaleString()}
                                    {": "}
                                    {String(selectedLeaveRequestRow.notice_override_reason ?? "")}
                                  </p>
                                ) : null}
                                {selectedLeaveRequestRow.routing_required === true ? (
                                  <Button
                                    disabled={saving}
                                    onClick={() =>
                                      void manageLeaveFollowUp(
                                        selectedLeaveRequestRow,
                                        "routing",
                                      )
                                    }
                                  >
                                    Retry routing after correcting manager assignment
                                  </Button>
                                ) : null}
                                {["awaiting_evidence", "overdue"].includes(
                                  String(selectedLeaveRequestRow.evidence_status),
                                ) ? (
                                  <div className="flex flex-col gap-2">
                                    <label htmlFor="leave-evidence-deadline">
                                      Extend evidence deadline (HR reviewer)
                                    </label>
                                    <Input
                                      id="leave-evidence-deadline"
                                      type="datetime-local"
                                      value={evidenceDeadline}
                                      onChange={(event) =>
                                        setEvidenceDeadline(event.target.value)
                                      }
                                    />
                                    <label htmlFor="leave-evidence-reason">
                                      Reason for extension
                                    </label>
                                    <Input
                                      id="leave-evidence-reason"
                                      value={evidenceReason}
                                      onChange={(event) =>
                                        setEvidenceReason(event.target.value)
                                      }
                                    />
                                    <Button
                                      disabled={
                                        saving || !evidenceDeadline || !evidenceReason.trim()
                                      }
                                      onClick={() =>
                                        void manageLeaveFollowUp(
                                          selectedLeaveRequestRow,
                                          "deadline",
                                        )
                                      }
                                    >
                                      Extend deadline
                                    </Button>
                                  </div>
                                ) : null}
                            </section>
                          </>
                        ) : null}

                        {activeTab === "approvals" ? (
                          <div className="space-y-4">
                          <ApprovalChain
                            row={selectedLeaveRequestRow}
                            actor={currentActor}
                          />

                          {readNumber(selectedLeaveRequestRow, ["id"]) ? (
                            <LeaveSignaturesPanel
                              key={String(selectedLeaveRequestRow.id)}
                              token={readStoredToken()}
                              requestId={Number(selectedLeaveRequestRow.id)}
                              approvals={
                                Array.isArray(selectedLeaveRequestRow.approvals)
                                  ? (selectedLeaveRequestRow.approvals as AdminRecord[])
                                  : []
                              }
                              currentCompanyUserId={currentActor?.membershipId ?? null}
                              isApplicant={
                                currentActor?.employeeId != null &&
                                readNumber(selectedLeaveRequestRow, ["employee_id"]) ===
                                  currentActor.employeeId
                              }
                              canViewVerification={canOverrideManager}
                              status={readString(selectedLeaveRequestRow, ["status"])}
                            />
                          ) : null}
                          </div>
                        ) : null}

                        {activeTab === "documents" ? (
                          <section className="space-y-3">
                            <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
                              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted">
                                <Paperclip className="size-4" />
                                {leaveDocumentFile ? "Change file" : "Attach file"}
                                <input
                                  type="file"
                                  className="sr-only"
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    setLeaveDocumentFile(file);
                                  }}
                                />
                              </label>
                              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {leaveDocumentFile
                                  ? leaveDocumentFile.name
                                  : "PDF, image or other supporting document."}
                              </p>
                              <Button
                                size="sm"
                                disabled={saving || !leaveDocumentFile}
                                onClick={() => void uploadLeaveDocument(row)}
                              >
                                Upload
                              </Button>
                            </div>
                            {docCount === 0 ? (
                              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                                No supporting documents attached yet.
                              </p>
                            ) : (
                              <ul className="divide-y divide-border rounded-lg border border-border">
                                {leaveRequestDocuments.map((documentRow, index) => (
                                  <li
                                    key={`leave-document-${readNumber(documentRow, ["id"]) ?? index}`}
                                    className="flex items-center gap-3 px-3 py-2.5"
                                  >
                                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-foreground">
                                        {readString(documentRow, ["file_name"])}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        Uploaded {formatLeaveDateTime(readString(documentRow, ["uploaded_at"]))}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                                      disabled={saving}
                                      aria-label={`Download ${readString(documentRow, ["file_name"])}`}
                                      title="Download"
                                      onClick={() => void downloadRequestDocument(row, documentRow)}
                                    >
                                      <Download className="size-4" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </section>
                        ) : null}

                        {activeTab === "medical" && isMedical ? (
                          <div className="grid gap-3 rounded-lg border border-border/70 bg-background/60 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  Medical detail
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Save treatment details and upload a supporting
                                  medical attachment.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={saving}
                                onClick={() =>
                                  void saveLeaveMedicalDetail(selectedLeaveRequestRow)
                                }
                              >
                                Save medical detail
                              </button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-600">
                                  Sickness nature
                                </p>
                                <input
                                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                                  value={leaveMedicalForm.sickness_nature}
                                  onChange={(event) =>
                                    setLeaveMedicalForm((current) => ({
                                      ...current,
                                      sickness_nature: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-600">
                                  Doctor name
                                </p>
                                <input
                                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                                  value={leaveMedicalForm.doctor_name}
                                  onChange={(event) =>
                                    setLeaveMedicalForm((current) => ({
                                      ...current,
                                      doctor_name: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-600">
                                  Doctor phone
                                </p>
                                <input
                                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                                  value={leaveMedicalForm.doctor_phone}
                                  onChange={(event) =>
                                    setLeaveMedicalForm((current) => ({
                                      ...current,
                                      doctor_phone: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-600">
                                  Hospital name
                                </p>
                                <input
                                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                                  value={leaveMedicalForm.hospital_name}
                                  onChange={(event) =>
                                    setLeaveMedicalForm((current) => ({
                                      ...current,
                                      hospital_name: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-600">
                                  Treatment start
                                </p>
                                <DatePickerPresets
                                  value={leaveMedicalForm.treatment_start_date}
                                  placeholder="Select treatment start"
                                  onChange={(value) =>
                                    setLeaveMedicalForm((current) => ({
                                      ...current,
                                      treatment_start_date: value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-slate-600">
                                  Treatment end
                                </p>
                                <DatePickerPresets
                                  value={leaveMedicalForm.treatment_end_date}
                                  placeholder="Select treatment end"
                                  onChange={(value) =>
                                    setLeaveMedicalForm((current) => ({
                                      ...current,
                                      treatment_end_date: value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <p className="text-xs font-medium text-slate-600">
                                  Medical attachment
                                </p>
                                <input
                                  ref={leaveMedicalAttachmentInputRef}
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt"
                                  className="block w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                                  onChange={(event) =>
                                    setLeaveMedicalAttachmentFile(
                                      event.target.files?.[0] ?? null,
                                    )
                                  }
                                />
                                <p className="text-[11px] text-muted-foreground">
                                  {leaveMedicalAttachmentFile
                                    ? `Ready to upload when you save: ${leaveMedicalAttachmentFile.name}`
                                    : leaveMedicalForm.attachment_url
                                      ? "A medical attachment is already saved. Choose another file to replace it."
                                      : "Choose a PDF, image, Word, Excel, or text file (up to 10 MB)."}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="sticky bottom-0 z-10 border-t border-border bg-background px-4 py-3 sm:px-6">
                      {(() => {
                        const permissions = getLeaveRequestPermissions(
                          row,
                          currentActor,
                        );
                        return (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                              disabled={saving}
                              onClick={() =>
                                void downloadRequestPdf(row)
                              }
                            >
                              <Download className="size-3.5" />
                              PDF
                            </button>
                            {canOverrideManager ? (
                              <button
                                type="button"
                                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                                disabled={saving}
                                title="Withdraw the QR verification code printed on this request's PDFs"
                                onClick={() =>
                                  void revokeRequestVerificationCode(
                                    row,
                                  )
                                }
                              >
                                <ShieldOff className="size-3.5" />
                                Revoke QR
                              </button>
                            ) : null}
                            {permissions.canApproveOrReject ? (
                              <div className="ml-auto flex w-full gap-1.5 sm:w-auto">
                                <button
                                  type="button"
                                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                                  disabled={saving}
                                  title={permissions.reasonApprove}
                                  onClick={() =>
                                    void approveRequest(
                                      row,
                                      "approve",
                                    )
                                  }
                                >
                                  <Check className="size-3.5" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950/30 sm:flex-none"
                                  disabled={saving}
                                  title={permissions.reasonApprove}
                                  onClick={() =>
                                    void approveRequest(
                                      row,
                                      "reject",
                                    )
                                  }
                                >
                                  <X className="size-3.5" />
                                  Reject
                                </button>
                              </div>
                            ) : null}
                            {permissions.canOverride ? (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-amber-400 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300 dark:hover:bg-amber-950/30 sm:flex-none"
                                  disabled={saving}
                                  title="Approve at the manager stage in place of an unavailable manager (reason required, audited)."
                                  onClick={() =>
                                    void overrideRequest(
                                      row,
                                      "approve",
                                    )
                                  }
                                >
                                  <Check className="size-3.5" />
                                  Approve for manager
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-amber-400 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300 dark:hover:bg-amber-950/30 sm:flex-none"
                                  disabled={saving}
                                  title="Reject at the manager stage in place of an unavailable manager (reason required, audited)."
                                  onClick={() =>
                                    void overrideRequest(
                                      row,
                                      "reject",
                                    )
                                  }
                                >
                                  <X className="size-3.5" />
                                  Reject for manager
                                </button>
                              </>
                            ) : null}
                            {permissions.canCancel ? (
                              <button
                                type="button"
                                className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 sm:flex-none"
                                disabled={saving}
                                title={permissions.reasonCancel}
                                onClick={() => {
                                  setPendingRequestCancel(row);
                                  setCancelReason("Cancelled by admin");
                                }}
                              >
                                Cancel request
                              </button>
                            ) : null}
                            {(() => {
                              
                              const today = new Date().toISOString().slice(0, 10);
                              const end = String(row.end_date ?? "").slice(0, 10);
                              const start = String(row.start_date ?? "").slice(0, 10);
                              const fullDay =
                                String(row.duration_type ?? "FULL_DAY").toUpperCase() ===
                                "FULL_DAY";
                              const canEndEarly =
                                String(row.status ?? "").toLowerCase() === "approved" &&
                                fullDay &&
                                end > start &&
                                end > today;
                              if (!canEndEarly) return null;
                              return (
                                <button
                                  type="button"
                                  className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 sm:flex-none"
                                  disabled={saving}
                                  title="Shorten this leave; unused days return to the balance"
                                  onClick={() => void endRequestEarly(row)}
                                >
                                  End early
                                </button>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      </div>
                    </>
                  );
                })()
              ) : (
                <DialogHeader className="px-4 pt-4">
                  <DialogTitle>Leave request</DialogTitle>
                  <DialogDescription>Approval details</DialogDescription>
                </DialogHeader>
              )}
            </DialogPopup>
          </Dialog>
        </div>
      ) : null}

      {tab === "team-calendar" ? <LeaveTeamCalendar /> : null}
      {signDialog}

      <Dialog
        open={overrideDialog !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setOverrideDialog(null);
            setOverrideReason("");
          }
        }}
      >
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {overrideDialog?.action === "approve"
                ? "Approve in place of manager"
                : overrideDialog?.action === "reject"
                  ? "Reject in place of manager"
                  : "Return for correction in place of manager"}
            </DialogTitle>
            <DialogDescription>
              The reason is recorded on the request and in the audit log.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm font-medium text-foreground">
            Reason
            <textarea
              autoFocus
              rows={3}
              className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal"
              placeholder="e.g. Manager on leave until next week"
              value={overrideReason}
              disabled={saving}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
            <span className="block text-xs font-normal text-muted-foreground">
              At least 5 characters.
            </span>
          </label>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              disabled={saving}
              onClick={() => {
                setOverrideDialog(null);
                setOverrideReason("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium !text-white disabled:opacity-60 ${
                overrideDialog?.action === "reject" ? "bg-rose-600" : "bg-primary"
              }`}
              disabled={saving || overrideReason.trim().length < 5}
              onClick={() => void submitOverrideRequest()}
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={requestImportOpen}
        onOpenChange={(open) => {
          if (!requestImportBusy) setRequestImportOpen(open);
        }}
      >
        <DialogPopup from="bottom" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Leave Requests</DialogTitle>
            <DialogDescription>
              Download the company template, fill one leave request per row,
              then validate the workbook. Preview makes no changes; confirmation
              creates requests and rechecks current leave rules, balances,
              overlaps, and approvals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
              disabled={requestTemplateBusy}
              onClick={() => void downloadRequestImportTemplate()}
            >
              <Download className="size-4" />
              {requestTemplateBusy
                ? "Preparing template…"
                : "Download Excel template"}
            </button>
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Completed Excel file
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={requestImportBusy}
                onChange={(event) => {
                  setRequestImportFile(event.target.files?.[0] ?? null);
                  setRequestImportResult(null);
                }}
              />
            </label>
            {requestImportResult ? (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">
                  {requestImportResult.preview
                    ? `${requestImportResult.ready} ready · ${requestImportResult.failed} invalid · ${requestImportResult.total} total · no changes made`
                    : `${requestImportResult.created} created · ${requestImportResult.failed} failed · ${requestImportResult.total} total`}
                </p>
                {requestImportResult.preview ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Policy, balance, overlap, and approval rules are checked
                    again when you confirm.
                  </p>
                ) : null}
                {requestImportResult.failed > 0 ? (
                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-rose-700">
                    {requestImportResult.results
                      .filter((row) => row.status === "failed")
                      .map((row) => (
                        <p key={`${row.row}-${row.employee_no}`}>
                          Row {row.row} ({row.employee_no || "no employee"}):{" "}
                          {row.message || "Import failed"}
                        </p>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              disabled={requestImportBusy}
              onClick={() => setRequestImportOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:opacity-60"
              disabled={
                !requestImportFile ||
                requestImportBusy ||
                Boolean(requestImportResult && !requestImportResult.preview)
              }
              onClick={() => void uploadRequestImport()}
            >
              {requestImportBusy
                ? "Processing…"
                : requestImportResult
                  ? requestImportResult.preview
                    ? "Confirm and import"
                    : "Import complete"
                  : "Validate file"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={requestDialogOpen}
        onOpenChange={(open) => {
          setRequestDialogOpen(open);
          if (!open) {
            setRequestForm(emptyLeaveRequestForm());
            setRequestDialogStep("who");
          }
        }}
      >
        <DialogPopup
          from="bottom"
          className="grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Create leave request</DialogTitle>
            <DialogDescription>
              {requestDialogStep === "who"
                ? "Choose the employee and the leave type they are taking."
                : requestDialogStep === "when"
                  ? "Set the start and end dates for this leave."
                  : "Add a reason, then submit now or save a draft."}
            </DialogDescription>
          </DialogHeader>
          <nav
            className="grid grid-cols-3 gap-2"
            aria-label="Leave request steps"
          >
            {LEAVE_REQUEST_WIZARD_STEPS.map((item, index) => {
              const active = item.key === requestDialogStep;
              const done = leaveRequestWizardIndex > index;
              const unlocked =
                item.key === "who" ||
                (item.key === "when" && canContinueRequestWho) ||
                (item.key === "review" &&
                  canContinueRequestWho &&
                  canContinueRequestWhen);
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!unlocked}
                  aria-current={active ? "step" : undefined}
                  onClick={() => unlocked && setRequestDialogStep(item.key)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "border-primary bg-primary text-white"
                      : done
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : unlocked
                          ? "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      active
                        ? "bg-white/20"
                        : done
                          ? "bg-primary text-white"
                          : "bg-slate-100",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      item.number
                    )}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
            {requestDialogStep === "who" ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Who is taking leave?
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pick the employee and the leave type this request uses.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LeaveTypeField
                    label="Employee"
                    help="The person this leave request is for."
                  >
                    <div className="mt-1">
                      <WorkflowSelect
                        value={requestForm.employee_id}
                        options={employeeOptions}
                        placeholder="Select employee"
                        onValueChange={(next) =>
                          setRequestForm((prev) => ({
                            ...prev,
                            employee_id: next,
                          }))
                        }
                      />
                    </div>
                  </LeaveTypeField>
                  <LeaveTypeField
                    label="Leave type"
                    help="Annual, sick, maternity, and other types already set up."
                  >
                    <div className="mt-1">
                      <WorkflowSelect
                        value={requestForm.leave_type_id}
                        options={leaveTypeOptions}
                        placeholder="Select leave type"
                        onValueChange={(next) =>
                          setRequestForm((prev) => ({
                            ...prev,
                            leave_type_id: next,
                          }))
                        }
                      />
                    </div>
                  </LeaveTypeField>
                </div>
              </section>
            ) : null}

            {requestDialogStep === "when" ? (
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    When is the leave?
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {requestEmployeeLabel} · {requestLeaveTypeLabel}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LeaveTypeField
                    label="Start date"
                    help="First day of the leave."
                  >
                    <div className="mt-1">
                      <DatePickerPresets
                        value={requestForm.start_date}
                        onChange={(value) =>
                          setRequestForm((prev) => ({
                            ...prev,
                            start_date: value,
                            ...(value && (!prev.end_date || prev.end_date < value)
                              ? { end_date: value }
                              : {}),
                          }))
                        }
                        placeholder="Start date"
                      />
                    </div>
                  </LeaveTypeField>
                  <LeaveTypeField
                    label="End date"
                    help="Last day of the leave."
                  >
                    <div className="mt-1">
                      <DatePickerPresets
                        value={requestForm.end_date}
                        min={requestForm.start_date}
                        onChange={(value) =>
                          setRequestForm((prev) => ({
                            ...prev,
                            end_date: value,
                          }))
                        }
                        placeholder="End date"
                      />
                    </div>
                  </LeaveTypeField>
                </div>
                {requestForm.start_date &&
                requestForm.end_date &&
                new Date(requestForm.start_date).getTime() >
                  new Date(requestForm.end_date).getTime() ? (
                  <p className="text-xs text-rose-600">
                    Start date cannot be after end date.
                  </p>
                ) : null}
                <LeaveRequestPreviewPanel
                  preview={requestPreview.preview}
                  error={requestPreview.error}
                  loading={requestPreview.loading}
                />
              </section>
            ) : null}

            {requestDialogStep === "review" ? (
              <section className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {leaveRequestReviewItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-border dark:bg-muted/30"
                    >
                      <p className="text-xs font-medium text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <LeaveRequestPreviewPanel
                  preview={requestPreview.preview}
                  error={requestPreview.error}
                  loading={requestPreview.loading}
                />
                {noticeOverrideNeeded ? (
                  <LeaveTypeField
                    label="Notice override reason"
                    help={`This leave starts in ${requestPreview.preview?.notice.days_until_start ?? 0} day(s); the policy needs ${requestPreview.preview?.notice.minimum_days ?? 0}. Filing it anyway is recorded as an HR override on the request and in the audit log.`}
                  >
                    <Textarea
                      className="mt-1 min-h-16 rounded-md border border-amber-300 px-3 py-2 text-sm"
                      placeholder="Why the notice period is being overridden"
                      value={requestForm.notice_override_reason}
                      onChange={(event) =>
                        setRequestForm((prev) => ({
                          ...prev,
                          notice_override_reason: event.target.value,
                        }))
                      }
                    />
                  </LeaveTypeField>
                ) : null}
                <LeaveTypeField
                  label="Reason"
                  help="Why this leave is needed. Approvers will see this."
                >
                  <Textarea
                    className="mt-1 min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Reason for leave"
                    value={requestForm.reason}
                    onChange={(event) =>
                      setRequestForm((prev) => ({
                        ...prev,
                        reason: event.target.value,
                      }))
                    }
                  />
                </LeaveTypeField>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    What should happen next?
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <WorkflowChoiceCard
                      active={requestForm.submit === "true"}
                      layoutId="leave-request-submit-choice"
                      onClick={() =>
                        setRequestForm((prev) => ({ ...prev, submit: "true" }))
                      }
                    >
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          requestForm.submit === "true"
                            ? "text-white"
                            : "text-slate-900",
                        )}
                      >
                        Submit now
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs",
                          requestForm.submit === "true"
                            ? "text-white/80"
                            : "text-slate-500",
                        )}
                      >
                        Send it into the approval path.
                      </span>
                    </WorkflowChoiceCard>
                    <WorkflowChoiceCard
                      active={requestForm.submit === "false"}
                      layoutId="leave-request-submit-choice"
                      onClick={() =>
                        setRequestForm((prev) => ({ ...prev, submit: "false" }))
                      }
                    >
                      <span
                        className={cn(
                          "block text-sm font-semibold",
                          requestForm.submit === "false"
                            ? "text-white"
                            : "text-slate-900",
                        )}
                      >
                        Save as draft
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs",
                          requestForm.submit === "false"
                            ? "text-white/80"
                            : "text-slate-500",
                        )}
                      >
                        Keep it until you are ready to submit.
                      </span>
                    </WorkflowChoiceCard>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 pt-3 dark:border-border">
            {requestDialogStep !== "who" ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() =>
                  setRequestDialogStep(
                    requestDialogStep === "review" ? "when" : "who",
                  )
                }
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setRequestDialogOpen(false)}
            >
              Cancel
            </button>
            {requestDialogStep === "who" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueRequestWho}
                onClick={() => setRequestDialogStep("when")}
              >
                Next: Dates
              </button>
            ) : requestDialogStep === "when" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueRequestWhen}
                onClick={() => setRequestDialogStep("review")}
              >
                Next: Review
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !requestForm.reason.trim()}
                onClick={() => void submitRequestForm()}
              >
                {saving
                  ? "Saving..."
                  : requestForm.submit === "true"
                    ? "Submit request"
                    : "Save draft"}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={typeDialogOpen}
        onOpenChange={(open) => {
          setTypeDialogOpen(open);
          if (!open) {
            resetTypeForm();
          }
        }}
      >
        <DialogPopup
          from="bottom"
          className="grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>
              {editingLeaveTypeRow ? "Edit Leave Type" : "Create Leave Type"}
            </DialogTitle>
            <DialogDescription>
              {typeDialogStep === "details"
                ? "Start with the name employees will see."
                : typeDialogStep === "rules"
                  ? "Choose the simple rules for using this leave."
                  : "Check the details before saving."}
            </DialogDescription>
          </DialogHeader>
          <nav className="grid grid-cols-3 gap-2" aria-label="Leave type steps">
            {LEAVE_TYPE_WIZARD_STEPS.map((item, index) => {
              const active = item.key === typeDialogStep;
              const done = leaveTypeWizardIndex > index;
              const unlocked =
                item.key === "details" || canContinueLeaveTypeWizard;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!unlocked}
                  aria-current={active ? "step" : undefined}
                  onClick={() => unlocked && setTypeDialogStep(item.key)}
                  className={cn(
                    "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    active
                      ? "border-primary bg-primary text-white"
                      : done
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : unlocked
                          ? "border-slate-200 bg-white text-slate-600 hover:border-primary/40"
                          : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      active
                        ? "bg-white/20"
                        : done
                          ? "bg-primary text-white"
                          : "bg-slate-100",
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      item.number
                    )}
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
            {typeDialogStep === "details" ? (
              <section
                aria-labelledby="leave-type-basic-heading"
                className="space-y-3"
              >
                <div>
                  <h3
                    id="leave-type-basic-heading"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Basic details
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    How this leave type will appear to HR and employees.
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LeaveTypeField
                    label="Leave name"
                    help="The name employees will see. Example: Sick Leave."
                  >
                    <input
                      autoFocus
                      required
                      className={leaveTypeControlClass}
                      placeholder="Example: Sick Leave"
                      value={typeForm.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        setTypeForm((prev) => ({ ...prev, name }));
                      }}
                    />
                  </LeaveTypeField>
                  <LeaveTypeField
                    label="Availability"
                    help="Active means staff can use it. Inactive turns it off."
                  >
                    <div className="mt-1">
                      <WorkflowSelect
                        value={typeForm.status}
                        options={[
                          { value: "active", label: "Active" },
                          { value: "inactive", label: "Inactive" },
                        ]}
                        placeholder="Choose status"
                        onValueChange={(next) => {
                          if (next)
                            setTypeForm((prev) => ({ ...prev, status: next }));
                        }}
                      />
                    </div>
                  </LeaveTypeField>
                </div>
              </section>
            ) : null}

            {typeDialogStep === "rules" ? (
              <section
                aria-labelledby="leave-type-rules-heading"
                className="space-y-3"
              >
                <div>
                  <h3
                    id="leave-type-rules-heading"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  >
                    Usage rules
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Simple rules for pay, documents, unused days, and who can
                    use this leave.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <MarkCheckbox
                    className="md:col-span-2"
                    checked={typeForm.is_paid === "true"}
                    onCheckedChange={(checked) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        is_paid: checked ? "true" : "false",
                      }))
                    }
                    label="Paid leave"
                    description="Employee keeps their normal salary while on this leave."
                  />
                  <MarkCheckbox
                    className="md:col-span-2"
                    checked={typeForm.requires_attachment === "true"}
                    onCheckedChange={(checked) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        requires_attachment: checked ? "true" : "false",
                      }))
                    }
                    label="Document required"
                    description="Employee must upload proof, such as a medical note."
                  />
                  <MarkCheckbox
                    className="md:col-span-2"
                    checked={typeForm.is_carry_forward_allowed === "true"}
                    onCheckedChange={(checked) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        is_carry_forward_allowed: checked ? "true" : "false",
                        ...(checked ? {} : { max_carry_forward_days: "0" }),
                      }))
                    }
                    label="Carry unused days"
                    description="Unused days can move into the next year instead of expiring."
                  />
                  <MarkCheckbox
                    className="md:col-span-2"
                    checked={typeForm.sandwich_rule === "true"}
                    onCheckedChange={(checked) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        sandwich_rule: checked ? "true" : "false",
                      }))
                    }
                    label="Count days in between (sandwich rule)"
                    description="Weekends and holidays that fall between two leave days are counted as leave."
                  />
                  {typeForm.requires_attachment === "true" ? (
                    <>
                      <LeaveTypeField
                        label="Only require it for requests longer than (days)"
                        help="Counted leave days, after weekends and holidays are excluded. Leave blank to always require it. Example: 2 means a sick note is needed from the 3rd day."
                      >
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          step={0.5}
                          placeholder="Always required"
                          value={typeForm.attachment_required_after_days}
                          onChange={(event) =>
                            setTypeForm((prev) => ({
                              ...prev,
                              attachment_required_after_days:
                                event.target.value,
                            }))
                          }
                        />
                      </LeaveTypeField>
                      <MarkCheckbox
                        checked={typeForm.allow_deferred_attachment === "true"}
                        onCheckedChange={(checked) =>
                          setTypeForm((prev) => ({
                            ...prev,
                            allow_deferred_attachment: checked
                              ? "true"
                              : "false",
                          }))
                        }
                        label="Allow documents after submission"
                        description="Approval can continue while the employee obtains evidence. Missing documents trigger reminders."
                      />
                      {typeForm.allow_deferred_attachment === "true" ? (
                        <LeaveTypeField
                          label="Evidence due after submission (calendar days)"
                          help="The employee is reminded when evidence is overdue, then every three days."
                        >
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={typeForm.attachment_grace_days}
                            onChange={(event) =>
                              setTypeForm((prev) => ({
                                ...prev,
                                attachment_grace_days: event.target.value,
                              }))
                            }
                          />
                        </LeaveTypeField>
                      ) : null}
                    </>
                  ) : null}
                  <LeaveTypeField
                    label="Auto-approve after (days)"
                    help="Off by default. Only use for special leave types: a request still waiting this many days after it was applied is approved by the system and the remaining approvers are skipped. Leave blank to keep it off."
                  >
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      placeholder="Off"
                      value={typeForm.auto_approve_after_days}
                      onChange={(event) =>
                        setTypeForm((prev) => ({
                          ...prev,
                          auto_approve_after_days: event.target.value,
                        }))
                      }
                    />
                  </LeaveTypeField>
                  {typeForm.is_carry_forward_allowed === "true" ? (
                    <LeaveTypeField
                      label="Days that can move forward"
                      help="The most unused days an employee can keep for next year. Leave blank for no cap. Policies can set expiry and stricter rules per employee group."
                    >
                      <input
                        type="number"
                        min={0}
                        placeholder="No cap"
                        className={leaveTypeControlClass}
                        value={typeForm.max_carry_forward_days}
                        onChange={(event) =>
                          setTypeForm((prev) => ({
                            ...prev,
                            max_carry_forward_days: event.target.value,
                          }))
                        }
                      />
                    </LeaveTypeField>
                  ) : null}
                  <LeaveTypeField
                    label="Yearly maximum"
                    help="The most days an employee can receive in one year. Enter 0 for no limit."
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0 = no limit"
                      className={leaveTypeControlClass}
                      value={typeForm.max_days_per_year}
                      onChange={(event) => {
                        const raw = event.target.value.replace(/[^0-9.]/g, "");
                        const [whole, ...rest] = raw.split(".");
                        const next =
                          rest.length > 0
                            ? `${whole}.${rest.join("").slice(0, 2)}`
                            : whole;
                        setTypeForm((prev) => ({
                          ...prev,
                          max_days_per_year: next,
                        }));
                      }}
                    />
                  </LeaveTypeField>
                  <LeaveTypeField
                    label="Who can use this leave?"
                    help="Choose Everyone unless this leave is only for male or female staff."
                    className={
                      typeForm.is_carry_forward_allowed === "true"
                        ? "md:col-span-2"
                        : undefined
                    }
                  >
                    <div className="mt-1">
                      <WorkflowSelect
                        value={typeForm.gender_restriction}
                        options={[
                          { value: "any", label: "Everyone" },
                          { value: "male", label: "Male employees only" },
                          { value: "female", label: "Female employees only" },
                        ]}
                        placeholder="Choose who can use this"
                        onValueChange={(next) => {
                          if (next)
                            setTypeForm((prev) => ({
                              ...prev,
                              gender_restriction: next,
                            }));
                        }}
                      />
                    </div>
                  </LeaveTypeField>
                </div>
              </section>
            ) : null}

            {typeDialogStep === "review" ? (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  {leaveTypeReviewItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-border dark:bg-muted/30"
                    >
                      <p className="text-xs font-medium text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <LeaveTypeField
                  label="Description"
                  help="Explain when this leave should be used. You can leave this blank."
                >
                  <Textarea
                    className="mt-1 min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Optional description"
                    value={typeForm.description}
                    onChange={(event) =>
                      setTypeForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </LeaveTypeField>
              </div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-slate-200 pt-3 dark:border-border">
            {typeDialogStep !== "details" ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                onClick={() =>
                  setTypeDialogStep(
                    typeDialogStep === "review" ? "rules" : "details",
                  )
                }
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setTypeDialogOpen(false)}
            >
              Cancel
            </button>
            {typeDialogStep === "details" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canContinueLeaveTypeWizard}
                onClick={() => setTypeDialogStep("rules")}
              >
                Next: Usage rules
              </button>
            ) : typeDialogStep === "rules" ? (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white"
                onClick={() => setTypeDialogStep("review")}
              >
                Next: Review
              </button>
            ) : (
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || !canContinueLeaveTypeWizard}
                onClick={() => void submitTypeForm()}
              >
                {saving
                  ? "Saving..."
                  : editingLeaveTypeRow
                    ? "Save Leave Type"
                    : "Add Leave Type"}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={balanceDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            finishBalanceEditor();
            return;
          }
          setBalanceDialogOpen(true);
        }}
      >
        <DialogPopup from="bottom" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedBalanceRow || returnToEmployeeBalances
                ? "Edit leave balance"
                : "Adjust leave balance"}
            </DialogTitle>
            <DialogDescription>
              {returnToEmployeeBalances && selectedBalanceGroup
                ? `${selectedBalanceGroup.employeeName}${balanceForm.fiscal_year ? ` · FY ${balanceForm.fiscal_year}` : ""}`
                : selectedBalanceRow
                  ? `${employeeLabelFromRow(selectedBalanceRow)}${balanceForm.fiscal_year ? ` · FY ${balanceForm.fiscal_year}` : ""}`
                  : "Choose an employee and leave type, then set the days."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {returnToEmployeeBalances ? null : (
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Employee</span>
                <FluentSelect
                  ariaLabel="Employee"
                  className="w-full"
                  value={balanceForm.employee_id}
                  placeholder="Select employee"
                  onChange={(value) =>
                    applyBalanceSelection({
                      employee_id: value,
                      leave_type_id: balanceForm.leave_type_id,
                      fiscal_year: balanceForm.fiscal_year,
                    })
                  }
                  options={[
                    { value: "", label: "Select employee" },
                    ...employees.flatMap((employee) => {
                      const id = readNumber(employee, [
                        "id",
                        "employee_id",
                        "user_id",
                      ]);
                      if (id === null) return [];
                      return [{ value: String(id), label: employeeLabel(id) }];
                    }),
                  ]}
                />
              </label>
            )}
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Leave type</span>
              <FluentSelect
                ariaLabel="Leave type"
                className="w-full"
                value={balanceForm.leave_type_id}
                placeholder="Select leave type"
                onChange={(value) =>
                  applyBalanceSelection({
                    employee_id: balanceForm.employee_id,
                    leave_type_id: value,
                    fiscal_year: balanceForm.fiscal_year,
                  })
                }
                options={[
                  { value: "", label: "Select leave type" },
                  ...(returnToEmployeeBalances && selectedBalanceGroup
                    ? selectedBalanceGroup.rows
                    : types
                  ).flatMap((entry) => {
                    const id =
                      leaveTypeIdFromRow(entry) ?? readNumber(entry, ["id"]);
                    if (id === null) return [];
                    const name = returnToEmployeeBalances
                      ? leaveTypeLabelFromRow(entry)
                      : readString(entry, ["name"]);
                    return [{ value: String(id), label: name }];
                  }),
                ]}
              />
            </label>
            {returnToEmployeeBalances ? null : (
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Fiscal year</span>
                <input
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="2026"
                  value={balanceForm.fiscal_year}
                  onChange={(event) =>
                    applyBalanceSelection({
                      employee_id: balanceForm.employee_id,
                      leave_type_id: balanceForm.leave_type_id,
                      fiscal_year: event.target.value,
                    })
                  }
                />
              </label>
            )}
            <p className="text-xs text-slate-500">
              Current remaining:{" "}
              <span className="font-medium text-slate-900">
                {formatBalanceDays(Number(balanceForm.remaining) || 0)}
              </span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Mode</span>
                <FluentSelect
                  ariaLabel="Mode"
                  className="w-full"
                  value={balanceForm.mode}
                  onChange={(value) =>
                    setBalanceForm((prev) => ({
                      ...prev,
                      mode: value as LeaveBalanceAdjustMode,
                    }))
                  }
                  options={[
                    { value: "SET", label: "Set remaining to" },
                    { value: "ADD", label: "Add days" },
                    { value: "DEDUCT", label: "Deduct days" },
                  ]}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-500">Amount</span>
                <input
                  type="number"
                  min={0}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  value={balanceForm.amount}
                  onChange={(event) =>
                    setBalanceForm((prev) => ({
                      ...prev,
                      amount: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs text-slate-500">Reason</span>
              <Textarea
                className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Why is this balance being changed?"
                value={balanceForm.reason}
                onChange={(event) =>
                  setBalanceForm((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
              />
            </label>
            <p className="text-xs text-slate-500">
              Credits cannot take the balance above the policy&apos;s maximum
              accumulation. If they would, the server refuses and states how
              many days can still be credited.
            </p>
            {canOverrideBalanceCap ? (
              <label className="space-y-1">
                <span className="text-xs text-slate-500">
                  Maximum accumulation override reason (optional)
                </span>
                <Textarea
                  className="min-h-16 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Only fill in to credit above the maximum accumulation. Recorded in the audit log."
                  value={balanceForm.cap_override_reason}
                  onChange={(event) =>
                    setBalanceForm((prev) => ({
                      ...prev,
                      cap_override_reason: event.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => finishBalanceEditor()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white"
              disabled={saving}
              onClick={() => void submitBalanceAdjustment()}
            >
              {saving ? "Saving..." : selectedBalanceRow ? "Save" : "Adjust"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={employeeBalanceDetailsOpen}
        onOpenChange={(open) => {
          setEmployeeBalanceDetailsOpen(open);
          if (!open && !returnToEmployeeBalancesRef.current) {
            setSelectedBalanceGroup(null);
          }
        }}
      >
        <DialogPopup
          from="bottom"
          className="flex max-h-[min(92dvh,40rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-3 sm:max-w-xl sm:p-4"
          bodyClassName="!max-h-[min(92dvh,40rem)] overscroll-contain"
        >
          <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
            <DialogTitle className="text-base leading-snug sm:text-lg">
              {selectedBalanceGroup?.employeeName ?? "Leave balances"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selectedBalanceGroup
                ? `${selectedBalanceGroup.typeCount} leave type${selectedBalanceGroup.typeCount === 1 ? "" : "s"}${
                    selectedBalanceGroup.fiscalYears.length > 0
                      ? ` · FY ${selectedBalanceGroup.fiscalYears.join(", ")}`
                      : ""
                  }`
                : "All leave balances for this employee."}
            </DialogDescription>
          </DialogHeader>

          {selectedBalanceGroup ? (
            <div className="shrink-0 space-y-3 py-2">
              <TalentDoodleSprites />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Available by leave type
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Available days exclude pending and approved future leave.
                  Tap a type to see how its balance is made up.
                </p>
              </div>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div
                  className={cn(
                    "grid gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500",
                    canAdjustBalances
                      ? "grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_4.5rem_2rem]"
                      : "grid-cols-[minmax(0,1fr)_4.5rem_3.5rem_4.5rem]",
                  )}
                >
                  <span>Type</span>
                  <span className="text-right">Allocated</span>
                  <span className="text-right">Used</span>
                  <span className="text-right">Available</span>
                  {canAdjustBalances ? (
                    <span className="sr-only">Actions</span>
                  ) : null}
                </div>
                {selectedBalanceGroupRows.map((row, index) => {
                  const typeName = leaveTypeLabelFromRow(row);
                  const rowKey = String(
                    readNumber(row, ["id", "leave_type_id", "leaveTypeId"]) ??
                      `${typeName}-${index}`,
                  );
                  return (
                    <div
                      key={rowKey}
                      className={cn(
                        "grid items-start gap-2 border-b border-slate-100 px-2.5 py-2 text-xs last:border-b-0",
                        index % 2 === 1 ? "bg-primary/[0.08]" : "bg-background",
                        canAdjustBalances
                          ? "grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_3.5rem_2rem]"
                          : "grid-cols-[minmax(0,1fr)_4.25rem_3.5rem_3.5rem]",
                      )}
                    >
                      <div className="min-w-0">
                        <details className="group">
                          <summary
                            className="cursor-pointer list-none truncate font-medium text-slate-900 underline-offset-2 hover:underline"
                            title={typeName}
                          >
                            {typeName}
                          </summary>
                          <dl className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                            {(
                              [
                                ["Opening", "opening_balance_days"],
                                ["Carried forward", "carried_forward_days"],
                                ["Entitlement", "entitlement_days"],
                                ["Accrued", "accrued_days"],
                                ["Adjustment", "adjusted_days"],
                                ["Used", "used_days"],
                                ["Pending", "pending_days"],
                                ["Approved future", "approved_future_days"],
                                ["Expired", "expired_days"],
                                ["Attendance deduction", "attendance_deduction_days"],
                              ] as const
                            )
                              .filter(([, key]) => readBalanceDays(row, [key]) !== 0)
                              .map(([label, key]) => (
                                <div key={key} className="flex justify-between gap-2">
                                  <dt>{label}</dt>
                                  <dd className="tabular-nums">
                                    {formatBalanceDays(readBalanceDays(row, [key]))}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                        </details>
                        {selectedBalanceGroup.fiscalYears.length > 1 ? (
                          <p className="text-[10px] text-muted-foreground">
                            FY {readBalanceFiscalYear(row) || "-"}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-right tabular-nums text-slate-700">
                        {formatBalanceDays(
                          readBalanceDays(row, [
                            "allocated_days",
                            "allocated",
                            "allocatedDays",
                          ]),
                        )}
                      </span>
                      <span className="text-right tabular-nums text-slate-700">
                        {formatBalanceDays(
                          readBalanceDays(row, [
                            "used_days",
                            "used",
                            "usedDays",
                          ]),
                        )}
                      </span>
                      <span className="self-start text-right tabular-nums font-medium text-slate-900">
                        {formatBalanceDays(
                          readBalanceDays(row, [
                            "available_days",
                            "remaining_days",
                            "remaining",
                            "remainingDays",
                          ]),
                        )}
                      </span>
                      {canAdjustBalances ? (
                        <button
                          type="button"
                          className="admin-table-icon-button justify-self-end"
                          title={`Edit ${typeName}`}
                          onClick={() => void openBalanceDialog(row)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {selectedBalanceGroup && employeeBalanceDetailsOpen ? (
            <section className="shrink-0 border-t border-border pt-2 text-xs">
              <div className="flex items-center justify-between"><h3 className="font-semibold">Transaction history - FY {balanceYear}</h3><div className="flex gap-2"><button type="button" disabled={balanceHistoryPage === 1 || balanceHistoryLoading} onClick={() => setBalanceHistoryPage((page) => page - 1)}>Previous</button><span>Page {balanceHistoryPage}</span><button type="button" disabled={balanceHistory.length < 20 || balanceHistoryLoading} onClick={() => setBalanceHistoryPage((page) => page + 1)}>Next</button></div></div>
              <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
                {balanceHistoryLoading ? (
                  <p className="p-2">Loading history...</p>
                ) : balanceHistoryError ? (
                  <p role="alert" className="p-2">{balanceHistoryError}</p>
                ) : balanceHistory.length === 0 ? (
                  <p className="p-2">No transactions found.</p>
                ) : (
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-2 py-1">Date</th>
                        <th className="px-2 py-1">Type</th>
                        <th className="px-2 py-1">Leave</th>
                        <th className="px-2 py-1 text-right">Days</th>
                        <th className="px-2 py-1">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceHistory.map((row, index) => (
                        <tr
                          key={String(row.id ?? index)}
                          className="border-t border-slate-100"
                          title={`Reason: ${readString(row, ["reason"])}`}
                        >
                          <td className="whitespace-nowrap px-2 py-1">
                            {readString(row, ["effective_date", "created_at"]).slice(0, 10)}
                          </td>
                          <td className="px-2 py-1">{readString(row, ["transaction_type"])}</td>
                          <td className="px-2 py-1">{leaveTypeLabelFromRow(row)}</td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {readString(row, ["amount_days"])}
                          </td>
                          <td className="px-2 py-1">
                            {personName(asRecord(row.created_by) ?? {}, "System")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          ) : null}
          <DialogFooter className="mt-2 shrink-0 border-t border-slate-100 pt-2 sm:justify-end">
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700"
              onClick={() => setEmployeeBalanceDetailsOpen(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>
              Enter holiday details, then save them.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Holiday name"
              value={holidayForm.name}
              onChange={(event) =>
                setHolidayForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
            <DatePickerPresets
              value={holidayForm.holiday_date}
              onChange={(value) =>
                setHolidayForm((prev) => ({ ...prev, holiday_date: value }))
              }
              placeholder="Holiday date"
            />
            <FluentSelect
              ariaLabel="Holiday repeat"
              value={holidayForm.is_recurring}
              onChange={(value) =>
                setHolidayForm((prev) => ({ ...prev, is_recurring: value }))
              }
              options={[
                { value: "false", label: "One-time" },
                { value: "true", label: "Recurring" },
              ]}
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setHolidayDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white"
              disabled={saving}
              onClick={() => void submitHolidayForm()}
            >
              {saving ? "Saving..." : "Add Holiday"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={holidayImportDialogOpen}
        onOpenChange={setHolidayImportDialogOpen}
      >
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Country Holidays</DialogTitle>
            <DialogDescription>
              Select a country and year, review what is missing, then import
              those holidays.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">
                  Country
                </span>
                <FluentSelect
                  ariaLabel="Country"
                  className="w-full"
                  value={holidayImportCountry}
                  disabled={holidayImportBusy}
                  onChange={(value) =>
                    setHolidayImportCountry(value as HolidayImportCountryCode)
                  }
                  options={HOLIDAY_IMPORT_COUNTRIES.map((entry) => ({
                    value: entry.code,
                    label: entry.label,
                  }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">
                  Year
                </span>
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={holidayImportYear}
                  onChange={(event) => setHolidayImportYear(event.target.value)}
                  disabled={holidayImportBusy}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span>
                {holidayImportLoading
                  ? "Loading official holidays..."
                  : `${holidayImportCatalog.length} official holiday${holidayImportCatalog.length === 1 ? "" : "s"} available for ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayImportCountry)?.label ?? holidayImportCountry} ${holidayImportYear}.`}
              </span>
              {!holidayImportLoading && holidayImportCatalog.length > 0 ? (
                <>
                  <span>{selectedHolidayMissing.length} ready to import</span>
                  <span>
                    {selectedHolidayMatches.length} already in this list
                  </span>
                </>
              ) : null}
            </div>
            {holidayImportError ? (
              <p className="text-sm text-rose-600">{holidayImportError}</p>
            ) : null}
            {holidayImportProgress ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <ExampleProgress
                  label={holidayImportProgress.label}
                  value={progressPercent(
                    holidayImportProgress.completed,
                    holidayImportProgress.total,
                  )}
                  helperText={`${holidayImportProgress.completed} of ${holidayImportProgress.total} holidays processed`}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setHolidayImportDialogOpen(false)}
              disabled={holidayImportBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              onClick={() => void loadHolidayImportCatalog()}
              disabled={holidayImportLoading || holidayImportBusy}
            >
              {holidayImportLoading ? "Refreshing..." : "Refresh List"}
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void importCountryHolidays()}
              disabled={
                holidayImportLoading ||
                holidayImportBusy ||
                selectedHolidayMissing.length === 0
              }
            >
              {holidayImportBusy ? "Importing..." : "Import Holidays"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={holidayRemoveDialogOpen}
        onOpenChange={setHolidayRemoveDialogOpen}
      >
        <DialogPopup from="bottom" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Remove Country Holidays</DialogTitle>
            <DialogDescription>
              Select a country and year to remove holidays that match a
              previously imported country set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">
                  Country
                </span>
                <FluentSelect
                  ariaLabel="Country"
                  className="w-full"
                  value={holidayRemoveCountry}
                  disabled={holidayRemoveBusy}
                  onChange={(value) =>
                    setHolidayRemoveCountry(value as HolidayImportCountryCode)
                  }
                  options={HOLIDAY_IMPORT_COUNTRIES.map((entry) => ({
                    value: entry.code,
                    label: entry.label,
                  }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-slate-700">
                  Year
                </span>
                <input
                  type="number"
                  min={1970}
                  max={2100}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={holidayRemoveYear}
                  onChange={(event) => setHolidayRemoveYear(event.target.value)}
                  disabled={holidayRemoveBusy}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
              <span>
                {holidayRemoveLoading
                  ? "Loading country holidays..."
                  : `${removableCountryHolidays.length} holiday${removableCountryHolidays.length === 1 ? "" : "s"} currently match ${HOLIDAY_IMPORT_COUNTRIES.find((entry) => entry.code === holidayRemoveCountry)?.label ?? holidayRemoveCountry} ${holidayRemoveYear}.`}
              </span>
              {!holidayRemoveLoading && holidayRemoveCatalog.length > 0 ? (
                <span>
                  {holidayRemoveCatalog.length} official holidays checked
                  against your list
                </span>
              ) : null}
            </div>
            {holidayRemoveError ? (
              <p className="text-sm text-rose-600">{holidayRemoveError}</p>
            ) : null}
            {holidayRemoveProgress ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <ExampleProgress
                  label={holidayRemoveProgress.label}
                  value={progressPercent(
                    holidayRemoveProgress.completed,
                    holidayRemoveProgress.total,
                  )}
                  helperText={`${holidayRemoveProgress.completed} of ${holidayRemoveProgress.total} holidays removed`}
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={() => setHolidayRemoveDialogOpen(false)}
              disabled={holidayRemoveBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              onClick={() => void loadHolidayRemoveCatalog()}
              disabled={holidayRemoveLoading || holidayRemoveBusy}
            >
              {holidayRemoveLoading ? "Refreshing..." : "Refresh List"}
            </button>
            <button
              type="button"
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void removeCountryHolidays()}
              disabled={
                holidayRemoveLoading ||
                holidayRemoveBusy ||
                removableCountryHolidays.length === 0
              }
            >
              {holidayRemoveBusy ? "Removing..." : "Remove Country Holidays"}
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {tab === "reports" ? (
        <LeaveReportDownloads token={readStoredToken()} />
      ) : null}

      {tab === "reports" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-6">
          <div>
            <h2 className="text-lg font-semibold">Leave reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download filtered leave data as CSV for review and spreadsheet
              analysis.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">
                Report
              </span>
              <WorkflowSelect
                value={leaveReportKind}
                options={[
                  ...(canReadBalances
                    ? [
                        {
                          value: "balances",
                          label: "Balances by employee and type",
                        },
                      ]
                    : []),
                  ...(canReadRequests
                    ? [
                        { value: "taken", label: "Approved leave taken" },
                        { value: "pending", label: "Pending approvals" },
                        { value: "encashments", label: "Leave encashments" },
                      ]
                    : []),
                ]}
                placeholder="Choose report"
                onValueChange={(next) => {
                  if (
                    next === "balances" ||
                    next === "taken" ||
                    next === "pending" ||
                    next === "encashments"
                  )
                    setLeaveReportKind(next);
                }}
              />
            </label>
            {leaveReportKind === "balances" ? (
              <label className="space-y-1">
                <span className="block text-xs font-medium text-muted-foreground">
                  Fiscal year
                </span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  inputMode="numeric"
                  maxLength={4}
                  value={leaveReportYear}
                  onChange={(event) =>
                    setLeaveReportYear(
                      event.target.value.replace(/[^\d]/g, "").slice(0, 4),
                    )
                  }
                />
              </label>
            ) : (
              <>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-muted-foreground">
                    From
                  </span>
                  <input
                    type="date"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={leaveReportFrom}
                    onChange={(event) => setLeaveReportFrom(event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-muted-foreground">
                    To
                  </span>
                  <input
                    type="date"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={leaveReportTo}
                    onChange={(event) => setLeaveReportTo(event.target.value)}
                  />
                </label>
              </>
            )}
            <div className="flex items-end">
              <button
                type="button"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold !text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  leaveReportLoading ||
                  (leaveReportKind === "balances"
                    ? !canReadBalances
                    : !canReadRequests)
                }
                onClick={() => void downloadLeaveReport()}
              >
                <Download className="size-4" />
                {leaveReportLoading ? "Preparing report..." : "Download CSV"}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Balance reports use the selected leave year. Request and encashment
            reports use the selected date filters; leave taken includes approved
            requests, pending approvals includes requests awaiting review, and
            encashments show the recorded payroll handoff and payment details.
          </p>
          {leaveReportKind === "encashments" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Encashment requests</h3>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium disabled:opacity-60"
                  onClick={() => void loadEncashmentRows()}
                  disabled={encashmentLoading}
                >
                  <RefreshCw className={cn("size-4", encashmentLoading && "animate-spin")} />
                  {encashmentLoading ? "Loading…" : "Load list"}
                </button>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Leave type / year</th>
                      <th className="px-3 py-2">Days</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Payroll handoff reference</th>
                      <th className="px-3 py-2">Payroll period</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Payment status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encashmentRows
                      .filter((row) => {
                        const created = readString(row, ["created_at"]).slice(0, 10);
                        return (
                          (!leaveReportFrom || created >= leaveReportFrom) &&
                          (!leaveReportTo || created <= leaveReportTo)
                        );
                      })
                      .map((row) => {
                      const type = asRecord(row.leave_type) ?? {};
                      return (
                        <tr key={readString(row, ["id"])} className="border-t border-border">
                          <td className="px-3 py-2">{employeeLabelFromRow(row)}</td>
                          <td className="px-3 py-2">
                            {readString(type, ["name", "code"])} · FY {readString(row, ["fiscal_year"])}
                          </td>
                          <td className="px-3 py-2">
                            {String(row.approved_days ?? "—")} / {String(row.requested_days ?? "—")}
                          </td>
                          <td className="px-3 py-2">
                            {readString(row, ["status"])}
                            {canBulkDecide && readString(row, ["status"]).toLowerCase() === "pending" ? (
                              <span className="ml-2 inline-flex gap-1">
                                <button
                                  type="button"
                                  className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                                  onClick={() => void decideEncashment(row, true)}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                  onClick={() => void decideEncashment(row, false)}
                                >
                                  Reject
                                </button>
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {readString(row, ["payroll_handoff_reference"]) !== "-" ? readString(row, ["payroll_handoff_reference"]) :
                              (readString(row, ["status"]).toLowerCase() === "approved" && canAdjustBalances ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                                  onClick={() => void sendEncashmentToPayroll(row)}
                                >
                                  Send to payroll
                                </button>
                              ) : (
                                "Not handed off"
                              ))}
                          </td>
                          <td className="px-3 py-2">{readString(row, ["payroll_period_code"]) !== "-" ? readString(row, ["payroll_period_code"]) : "—"}</td>
                          <td className="px-3 py-2">{row.payable_amount != null && row.payable_amount !== "" ? `${String(row.payable_amount)} ${readString(row, ["currency"]) !== "-" ? readString(row, ["currency"]) : ""}` : "—"}</td>
                          <td className="px-3 py-2">
                            {(() => {
                              const payment = readString(row, ["payment_status"]).toUpperCase();
                              const approved = readString(row, ["status"]).toLowerCase() === "approved";
                              const label =
                                payment === "PAID"
                                  ? readString(row, ["payment_confirmed_via"]) === "payroll"
                                    ? "Paid by payroll"
                                    : "Paid (recorded by HR)"
                                  : payment === "IN_PAYROLL"
                                    ? "In payroll — awaiting payment"
                                    : payment === "REVERSED"
                                      ? "Reversed by payroll"
                                      : "Not paid";
                              return (
                                <span className="flex flex-col gap-1">
                                  <span data-testid="encashment-payment-status">{label}</span>
                                  {row.amount_overridden === true ? (
                                    <span className="text-xs text-amber-700 dark:text-amber-300">Amount overridden: {String(row.override_reason ?? "")}</span>
                                  ) : null}
                                  {canAdjustBalances && payment === "IN_PAYROLL" ? (
                                    <button
                                      type="button"
                                      className="w-fit rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                                      onClick={() => void recordEncashmentPayment(row)}
                                    >
                                      Record payment outside payroll
                                    </button>
                                  ) : null}
                                  {canAdjustBalances && approved && payment !== "PAID" ? (
                                    <button
                                      type="button"
                                      className="w-fit rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                                      onClick={() => void reverseEncashment(row)}
                                    >
                                      Reverse
                                    </button>
                                  ) : null}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                      })}
                    {!encashmentRows.filter((row) => {
                      const created = readString(row, ["created_at"]).slice(0, 10);
                      return (
                        (!leaveReportFrom || created >= leaveReportFrom) &&
                        (!leaveReportTo || created <= leaveReportTo)
                      );
                    }).length ? (
                      <tr>
                        <td className="px-3 py-4 text-muted-foreground" colSpan={8}>
                          {encashmentLoading ? "Loading encashments…" : "Load the list to view company encashment requests."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "balances" ? (
        <div className="space-y-2">
          <ResizableTable
            title="Leave Balances"
            toolbarActions={
              <>
                <input aria-label="Balance fiscal year" inputMode="numeric" maxLength={4} className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs" value={balanceYear} onChange={(event) => { setBalanceYear(event.target.value.replace(/[^\d]/g, "").slice(0, 4)); setMissingPage(1); }} />
                <input aria-label="Search employee balances" placeholder="Employee name or ID" className="h-8 w-36 rounded-md border border-border bg-background px-2 text-xs" value={balanceSearch} onChange={(event) => setBalanceSearch(event.target.value)} />
                <select aria-label="Filter department" className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={balanceDepartment} onChange={(event) => setBalanceDepartment(event.target.value)}><option value="all">All departments</option>{balanceDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
                <select aria-label="Filter leave type" className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={balanceType} onChange={(event) => setBalanceType(event.target.value)}>
                  <option value="all">All leave types</option>
                  {types.map((type) => <option key={String(type.id)} value={String(type.id)}>{readString(type, ["name", "code"])}</option>)}
                </select>
                <select aria-label="Filter available balance" className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={balanceStatus} onChange={(event) => setBalanceStatus(event.target.value)}>
                  <option value="all">All balances</option><option value="low">5 days or less</option><option value="negative">Negative</option>
                </select>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium disabled:opacity-60"
                  disabled={reconciliationLoading}
                  onClick={() => void runBalanceReconciliation()}
                >
                  {reconciliationLoading
                    ? "Reconciling..."
                    : "Reconcile balances"}
                </button>
                <RecalculateLeaveBalanceButton token={readStoredToken() || null} />
                {canAdjustBalances ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                    onClick={() => openBalanceBulkDialog("generate")}
                  >
                    Generate
                  </button>
                ) : null}
                {canAdjustBalances ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                    onClick={() => openBalanceBulkDialog("carry-forward")}
                  >
                    Carry forward
                  </button>
                ) : null}
                {canAdjustBalances ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={() => void openBalanceDialog()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adjust Leave Balance
                  </button>
                ) : null}
                {canUseBalanceBulkImport ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground"
                    onClick={() =>
                      router.push("/dashboard/leave-management/balance-import")
                    }
                  >
                    <Download className="h-3.5 w-3.5" />
                    Bulk import
                  </button>
                ) : null}
                {refreshButton}
              </>
            }
            data={groupedBalances}
            getRowId={(group) => group.key}
            onRowSelect={(_, group) => {
              if (group) {
                openEmployeeBalanceDetails(group);
              }
            }}
            columns={balanceGroupColumns}
            itemsPerPage={20}
            loading={loading}
            storageKey="leave-balances-by-employee"
          />
          <section className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Employees with missing balance records</h3><p className="text-xs text-muted-foreground">FY {balanceYear}. Shows missing records for active leave types, matching balance generation. Review policy eligibility before using a balance.</p></div><div className="flex gap-2 text-xs"><button type="button" disabled={missingPage <= 1 || missingLoading} onClick={() => setMissingPage((page) => page - 1)}>Previous</button><span>Page {missingPage}</span><button type="button" disabled={missingLoading || (missingTotalPages !== null ? missingPage >= missingTotalPages : missingBalances.length < 20)} onClick={() => setMissingPage((page) => page + 1)}>Next</button></div></div>
            {!/^\d{4}$/.test(balanceYear) ? <p className="mt-2">Enter a four-digit fiscal year.</p> : missingLoading ? <p className="mt-2">Loading...</p> : missingError ? <p role="alert" className="mt-2">{missingError}</p> : missingBalances.length ? <ul className="mt-2 space-y-1">{missingBalances.map((employee) => <li key={String(employee.id)}>{personName(employee, "Employee")} - {readString(employee, ["employee_number"])} - {readString(asRecord(employee.department) ?? {}, ["name"])} - Missing: {Array.isArray(employee.missing_leave_types) ? employee.missing_leave_types.map((type: unknown) => readString(asRecord(type) ?? {}, ["name", "code"])).join(", ") : "-"}</li>)}</ul> : <p className="mt-2">{ /^\d{4}$/.test(balanceYear) ? "No missing records for active employees and leave types." : "Enter a four-digit fiscal year." }</p>}
          </section>
          <LeaveHrOperationsPanel
            token={readStoredToken()}
            leaveTypeLabel={leaveTypeLabel}
          />
          {balanceAdjustments.length > 0 ? (
            <ResizableTable
              title="Balance adjustments"
              toolbarStart={
                <span className="text-xs font-semibold text-foreground">
                  Balance adjustments
                </span>
              }
              data={balanceAdjustments}
              columns={[
                {
                  key: "employee",
                  label: "Employee",
                  render: (r) => employeeLabelFromRow(r),
                },
                {
                  key: "leave_type",
                  label: "Leave type",
                  render: (r) =>
                    readString(asRecord(r.leave_type) ?? {}, [
                      "name",
                      "code",
                    ]) || "—",
                },
                {
                  key: "balance",
                  label: "Balance",
                  render: (r) =>
                    `${readString(r, ["old_balance_days"]) || "—"} → ${readString(r, ["new_balance_days"]) || "—"}`,
                },
                {
                  key: "days",
                  label: "Days",
                  render: (r) =>
                    readString(r, [
                      "adjustment_amount_days",
                      "days",
                      "adjustment_days",
                      "amount",
                    ]),
                },
                {
                  key: "source",
                  label: "Source",
                  render: (r) =>
                    readString(r, ["source"]) === "BULK_IMPORT"
                      ? `Bulk import · ${readString(r, ["import_batch_id"]) || "—"}`
                      : "Manual",
                },
                {
                  key: "reason",
                  label: "Reason",
                  render: (r) => readString(r, ["reason", "remarks"]),
                },
              ]}
              itemsPerPage={10}
              loading={false}
              showExport={false}
              storageKey="leave-balance-adjustments"
            />
          ) : null}
        </div>
      ) : null}

      {tab === "transactions" ? (
        <ResizableTable
          title="Balance transactions"
          toolbarStart={
            <>
              <span className="mr-1 shrink-0 text-xs font-semibold text-foreground">
                Balance transaction history
              </span>
              <SearchToggleField
                className="min-w-0 !w-auto !max-w-[13rem] !flex-none"
                placeholder="Search transactions"
                value={transactionSearch}
                onChange={setTransactionSearch}
              />
              <FluentSelect
                ariaLabel="Filter balance transaction type"
                size="small"
                className="w-[11rem]"
                value={transactionTypeFilter}
                onChange={setTransactionTypeFilter}
                options={[
                  { value: "all", label: "All transaction types" },
                  ...transactionTypes.map((type) => ({
                    value: type,
                    label: formatTransactionType(type),
                  })),
                ]}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-primary"
                      aria-label="Transaction type descriptions"
                    />
                  }
                >
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col items-stretch gap-0 rounded-lg border border-primary/25 bg-background p-3 text-left text-foreground shadow-xl"
                >
                  <div className="mb-2 border-b border-border pb-2 text-xs font-semibold text-primary">
                    Transaction type descriptions
                  </div>
                  <div className="space-y-2.5">
                    {Object.entries(TRANSACTION_TYPE_DESCRIPTIONS).map(
                      ([type, description]) => (
                        <div key={type} className="space-y-0.5">
                          <div className="text-xs font-bold text-primary">
                            {formatTransactionType(type)}
                          </div>
                          <div className="text-xs leading-relaxed text-muted-foreground">
                            {description}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-bold text-primary">-</span> means no
                    value was recorded or the field does not apply to that
                    transaction.
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          }
          data={filteredBalanceTransactions}
          columns={[
            {
              key: "employee",
              label: "Employee",
              render: (r) => employeeLabelFromRow(r),
            },
            {
              key: "type",
              label: "Type",
              render: (r) =>
                formatTransactionType(
                  readString(r, ["transaction_type", "type"]),
                ),
            },
            {
              key: "days",
              label: "Days",
              render: (r) => readString(r, ["amount_days", "days", "amount"]),
            },
          ]}
          itemsPerPage={10}
          loading={loading}
          showExport={false}
          storageKey="leave-balance-transactions"
        />
      ) : null}

      {tab === "holidays" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">This calendar is shared with Attendance. Manage company-wide dates here and branch dates in Attendance Setup → Holidays.</p>
          <ResizableTable
            title="Holidays"
            toolbarActions={
              <>
                {canCreateHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
                    onClick={() => setHolidayImportDialogOpen(true)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Import
                  </button>
                ) : null}
                {canDeleteHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700"
                    onClick={() => setHolidayRemoveDialogOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Country
                  </button>
                ) : null}
                {canCreateHolidays ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold !text-white"
                    onClick={() => setHolidayDialogOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Holiday
                  </button>
                ) : null}
                {refreshButton}
              </>
            }
            data={holidays}
            columns={[
              {
                key: "name",
                label: "Name",
                defaultWidth: 110,
                sortable: true,
                render: (r) => readString(r, ["name"]),
              },
              {
                key: "holiday_date",
                label: "Date",
                defaultWidth: 70,
                sortable: true,
                render: (r) => readString(r, ["holiday_date"]),
              },
              {
                key: "branch_name",
                label: "Applies to",
                defaultWidth: 80,
                render: (r) =>
                  r.branch_id == null ? (
                    "All branches"
                  ) : (
                    <span title="Branch holiday. Manage it under Attendance > Holidays.">
                      {readString(r, ["branch_name"]) || `Branch #${String(r.branch_id)}`}
                    </span>
                  ),
              },
              {
                key: "is_recurring",
                label: "Recur",
                defaultWidth: 50,
                render: (r) => (
                  <Switch
                    size="sm"
                    checked={readBoolean(r, ["is_recurring"])}
                    disabled={!canUpdateHolidays || r.editable_here === false}
                    onCheckedChange={
                      canUpdateHolidays && r.editable_here !== false
                        ? () => void toggleHolidayRecurring(r)
                        : undefined
                    }
                    aria-label="Toggle recurring"
                    className="scale-90"
                  />
                ),
              },
              ...(canDeleteHolidays
                ? [
                    {
                      key: "actions",
                      label: "Act",
                      defaultWidth: 45,
                      sortable: false,
                      render: (row: AdminRecord) => (
                        <div
                          className="flex justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="rounded-md border border-rose-200 p-2 text-rose-600 disabled:opacity-40"
                            disabled={row.editable_here === false}
                            title={
                              row.editable_here === false
                                ? "Branch holiday. Manage it under Attendance > Holidays."
                                : undefined
                            }
                            onClick={() => setPendingHolidayDelete(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            itemsPerPage={20}
            loading={loading}
            storageKey="leave-holidays"
          />
        </div>
      ) : null}

      {tab === "policies" ? (
        <div className="space-y-2">
          <LeavePoliciesCatalog
            policies={policies}
            loading={loading}
            canCreate={canCreatePolicies}
            canEdit={canUpdatePolicies}
            canDelete={canDeletePolicies}
            saving={saving}
            onRefresh={() => void reloadAll(tab, true)}
            onCreate={openCreatePolicySheet}
            onOpen={openPolicyPreview}
            onEdit={(row) => void loadPolicyIntoForm(row)}
            onDelete={(row) => setPendingPolicyDelete(row)}
            onToggleStatus={(row) => void togglePolicyStatus(row)}
          />

          <LeavePolicyVersionsPanel
            policies={policies}
            onChanged={() => void reloadAll(tab, true)}
          />

          <LeavePolicyEditorSheet
            open={policySheetOpen}
            mode={editingPolicyId === null ? "create" : "edit"}
            value={policyForm}
            leaveTypeOptions={leaveTypeOptions}
            branchOptions={policyBranchOptions}
            departmentOptions={workflowDepartmentOptions}
            positionOptions={positionOptions}
            gradeOptions={gradeOptions}
            saving={saving}
            canSubmit={canSubmitPolicyChanges}
            onOpenChange={(open) => {
              setPolicySheetOpen(open);
              if (!open) setEditingPolicyId(null);
            }}
            onValueChange={(patch) =>
              setPolicyForm((prev) => ({ ...prev, ...patch }))
            }
            onSubmit={submitPolicyForm}
          />

          <LeavePolicyPreviewSheet
            open={policyPreviewOpen}
            loading={policyPreviewLoading}
            value={policyPreviewForm}
            leaveTypeOptions={leaveTypeOptions}
            branchOptions={policyBranchOptions}
            departmentOptions={workflowDepartmentOptions}
            positionOptions={positionOptions}
            gradeOptions={gradeOptions}
            canEdit={canUpdatePolicies}
            onOpenChange={(open) => {
              setPolicyPreviewOpen(open);
              if (!open) {
                setPolicyPreviewLoading(false);
              }
            }}
            onEdit={() => {
              if (selectedPolicyRow) {
                void loadPolicyIntoForm(selectedPolicyRow);
              }
              setPolicyPreviewOpen(false);
            }}
          />
        </div>
      ) : null}

      {tab === "workflows" ? (
        <div className="space-y-2">
          <LeaveWorkflowsCatalog
            workflows={workflows}
            draftRow={workflowDraftRow}
            loading={loading}
            canCreate={canCreateWorkflows}
            canEdit={canUpdateWorkflows}
            canDelete={canDeleteWorkflows}
            saving={saving}
            onRefresh={() => void reloadAll(tab, true)}
            onCreate={openCreateWorkflowSheet}
            onOpen={(row) => {
              if (readBoolean(row, ["_isLocalDraft"])) {
                openCreateWorkflowSheet();
                return;
              }
              if (canUpdateWorkflows) void openEditWorkflowSheet(row);
            }}
            onEdit={(row) => {
              if (readBoolean(row, ["_isLocalDraft"])) {
                openCreateWorkflowSheet();
                return;
              }
              void openEditWorkflowSheet(row);
            }}
            onDelete={(row) => {
              if (readBoolean(row, ["_isLocalDraft"])) {
                clearWorkflowCreateDraft();
                setWorkflowDraft(null);
                return;
              }
              setPendingWorkflowDelete(row);
            }}
            onToggleStatus={(row) => void toggleWorkflowStatus(row)}
            draftBanner={
              workflowDraft ? (
                <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-950">
                      Draft:{" "}
                      {workflowDraft.form.name.trim() || "Untitled workflow"}
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      {leaveTypeOptions.find(
                        (option) =>
                          option.value === workflowDraft.form.leave_type_id,
                      )?.label || "No leave type"}
                      {" · "}
                      {workflowDraft.steps.length}{" "}
                      {workflowDraft.steps.length === 1 ? "step" : "steps"}
                      {" · "}
                      Continue where you left off
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-white px-2.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                      onClick={() => {
                        clearWorkflowCreateDraft();
                        setWorkflowDraft(null);
                      }}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-white transition hover:brightness-95"
                      onClick={openCreateWorkflowSheet}
                    >
                      Continue draft
                    </button>
                  </div>
                </div>
              ) : null
            }
          />

          <LeaveManagementRulesPanel
            token={readStoredToken()}
            canEdit={canUpdateWorkflows}
          />

          {canUpdateWorkflows ? (
            <LeaveDelegationsPanel token={readStoredToken()} mode="hr" />
          ) : null}

          <LeaveCompOffPanel
            token={readStoredToken()}
            mode="hr"
            canManagePolicy={canUpdateWorkflows}
          />

          <LeaveWorkflowEditorSheet
            open={workflowSheetOpen}
            mode={editingWorkflowId === null ? "create" : "edit"}
            value={workflowForm}
            leaveTypeOptions={leaveTypeOptions}
            steps={workflowEditorSteps}
            saving={saving}
            canSubmit={canSubmitWorkflowChanges}
            canManageSteps={canManageWorkflowSteps}
            canDeleteSteps={canDeleteWorkflows || !selectedWorkflowId}
            startStage={workflowStartStage}
            onOpenChange={setWorkflowSheetOpen}
            onValueChange={(patch) =>
              setWorkflowForm((prev) => ({ ...prev, ...patch }))
            }
            onSaveDraft={(stage) => {
              const draft = {
                form: workflowForm,
                steps: workflowSteps,
                stage,
              };
              writeWorkflowCreateDraft(draft);
              setWorkflowDraft(draft);
              showSuccessAlert(
                "Draft saved. Continue it from Leave Workflows.",
              );
            }}
            onDiscard={() => {
              clearWorkflowCreateDraft();
              setWorkflowDraft(null);
              setWorkflowForm({
                name: "",
                leave_type_id: "",
                status: "active",
                is_default: "false",
                reminder_after_days: "",
                escalate_after_days: "",
                max_escalations: "",
              });
              setWorkflowSteps([]);
              setWorkflowStartStage("details");
            }}
            onAddStep={openCreateStepDialog}
            onEditStep={(index) => {
              const step = workflowSteps[index];
              if (step) {
                openEditStepDialog(step);
              }
            }}
            onDeleteStep={(index) => {
              const step = workflowSteps[index];
              if (step) {
                void removeWorkflowStep(step);
              }
            }}
            onSubmit={submitWorkflowForm}
          />

          <LeaveWorkflowStepDialog
            open={stepDialogOpen}
            mode={editingWorkflowStepId === null ? "create" : "edit"}
            value={workflowStepForm}
            roleOptions={workflowRoleOptions}
            positionOptions={positionOptions}
            companyUserOptions={employeeOptions}
            branchOptions={workflowBranchOptions}
            departmentOptions={workflowDepartmentOptions}
            saving={saving}
            canSubmit={canManageWorkflowSteps}
            onOpenChange={setStepDialogOpen}
            onValueChange={(patch) =>
              setWorkflowStepForm((prev) => ({ ...prev, ...patch }))
            }
            onSubmit={async () => {
              const targetWorkflowId =
                selectedWorkflowId ||
                (editingWorkflowId !== null ? String(editingWorkflowId) : "");
              if (targetWorkflowId) {
                setSelectedWorkflowId(targetWorkflowId);
              }
              await submitWorkflowStepForm(targetWorkflowId || undefined);
            }}
          />
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(balanceBulkDialog)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setBalanceBulkDialog(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {balanceBulkDialog === "carry-forward"
                ? "Carry forward leave balances"
                : "Generate leave balances"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {balanceBulkDialog === "carry-forward"
                ? "Move unused days from the previous year into this fiscal year for leave types that allow carry forward."
                : "Create or recalculate allocated balances for every employee in this fiscal year."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Fiscal year</p>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              inputMode="numeric"
              maxLength={4}
              placeholder="2026"
              value={balanceBulkYear}
              onChange={(event) =>
                setBalanceBulkYear(
                  event.target.value.replace(/[^\d]/g, "").slice(0, 4),
                )
              }
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium !text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void submitBalanceBulkAction()}
            >
              {saving
                ? balanceBulkDialog === "carry-forward"
                  ? "Calculating..."
                  : "Generating..."
                : balanceBulkDialog === "carry-forward"
                  ? "Carry forward"
                  : "Generate"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reconciliationOpen} onOpenChange={setReconciliationOpen}>
        <DialogPopup from="bottom" className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              Leave balance reconciliation · FY {reconciliationYear}
            </DialogTitle>
            <DialogDescription>
              Compares stored used, pending, and adjustment totals with
              immutable ledger transactions. Legacy balances without ledger
              history are identified separately.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border border-border">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  {[
                    "Employee",
                    "Leave type",
                    "Available",
                    "Used: balance / ledger",
                    "Pending: balance / ledger",
                    "Adjusted: balance / ledger",
                    "Status",
                    "Opening review",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reconciliationRows.map((row, index) => {
                  const status = readString(row, ["status"]);
                  return (
                    <tr
                      key={`${readString(row, ["employee_id"])}-${readString(row, ["leave_type_id"])}-${index}`}
                    >
                      <td className="px-3 py-2">
                        {readString(row, ["employee_name"]) ||
                          readString(row, ["employee_no"])}
                      </td>
                      <td className="px-3 py-2">
                        {readString(row, ["leave_type"])}
                      </td>
                      <td className="px-3 py-2">
                        {readString(row, ["available_days"])}
                      </td>
                      <td className="px-3 py-2">
                        {readString(row, ["balance_used_days"])} /{" "}
                        {readString(row, ["ledger_used_days"])}
                      </td>
                      <td className="px-3 py-2">
                        {readString(row, ["balance_pending_days"])} /{" "}
                        {readString(row, ["ledger_pending_days"])}
                      </td>
                      <td className="px-3 py-2">
                        {readString(row, ["balance_adjusted_days"])} /{" "}
                        {readString(row, ["ledger_adjusted_days"])}
                      </td>
                      <td
                        className={`px-3 py-2 font-semibold ${status === "mismatch" ? "text-rose-600" : status === "legacy_no_ledger" ? "text-amber-600" : "text-emerald-600"}`}
                      >
                        {status === "legacy_no_ledger"
                          ? "No ledger history"
                          : status === "mismatch"
                            ? "Mismatch"
                            : "Reconciled"}
                      </td>
                      <td className="px-3 py-2">
                        {canAdjustBalances &&
                        readString(row, ["opening_preview_fingerprint"]) !== "-" ? (
                          <button
                            type="button"
                            className="rounded-md border border-border px-2 py-1 text-xs"
                            title="Record that you checked this legacy opening preview. This is not cutover sign-off and posts nothing."
                            onClick={() => void reviewOpeningPreview(row)}
                          >
                            Record review
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {reconciliationRows.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-muted-foreground"
                      colSpan={8}
                    >
                      No balances found for FY {reconciliationYear}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm"
              onClick={() => setReconciliationOpen(false)}
            >
              Close
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingTypeDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTypeDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave type? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingTypeDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingTypeDelete) {
                  return;
                }
                const row = pendingTypeDelete;
                setPendingTypeDelete(null);
                await removeType(row);
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingHolidayDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingHolidayDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this holiday? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingHolidayDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingHolidayDelete) {
                  return;
                }
                const row = pendingHolidayDelete;
                setPendingHolidayDelete(null);
                await removeHoliday(row);
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingPolicyDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPolicyDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave policy? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingPolicyDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingPolicyDelete) {
                  return;
                }
                const row = pendingPolicyDelete;
                setPendingPolicyDelete(null);
                await removePolicy(row);
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingWorkflowDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingWorkflowDelete(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this leave workflow? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingWorkflowDelete}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingWorkflowDelete) {
                  return;
                }
                const row = pendingWorkflowDelete;
                setPendingWorkflowDelete(null);
                await removeWorkflow(row);
              }}
            >
              {saving ? "Deleting..." : "Delete"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRequestCancel)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRequestCancel(null);
            setCancelReason("Cancelled by admin");
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Leave Request</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a reason for cancellation. This will be recorded against the
              request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason
            </label>
            <Textarea
              className="min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Enter cancellation reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <button
              type="button"
              disabled={saving || !pendingRequestCancel || !cancelReason.trim()}
              className="rounded-md bg-[hsl(358,82%,59%)] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={async () => {
                if (!pendingRequestCancel) {
                  return;
                }
                const row = pendingRequestCancel;
                const reason = cancelReason;
                setPendingRequestCancel(null);
                setCancelReason("Cancelled by admin");
                await cancelRequest(row, reason);
              }}
            >
              {saving ? "Cancelling..." : "Cancel Request"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
