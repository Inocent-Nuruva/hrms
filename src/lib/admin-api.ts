import { extractBackupCodes } from "@/lib/backup-codes";
import { env } from "@/lib/env";
import { z } from "zod";
import { ContractError } from "@/lib/request-json";
import { resolveBackendMediaUrl } from "@/lib/backend-media-url";
import {
  employeeOwnsEmail,
  employeeOwnsPhone,
  formatEmployeeDirectoryPerson,
} from "@/lib/employee-directory-search";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";

export { resolveBackendMediaUrl } from "@/lib/backend-media-url";

export type AdminResourceKey = "users" | "roles" | "permissions" | "companies";

export type AdminRecord = Record<string, unknown>;
export type SortOrder = "ASC" | "DESC";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface AdminRequestOptions {
  method?: HttpMethod;
  token?: string;
  body?: unknown;
  signal?: AbortSignal;
  cacheTtlMs?: number;
  dedupe?: boolean;
  invalidateCache?: boolean;
}

type CachedAdminResponse = {
  expiresAt: number;
  value: unknown;
};

const adminResponseCache = new Map<string, CachedAdminResponse>();
const inflightAdminRequests = new Map<string, Promise<unknown>>();
export const ADMIN_CACHE_INVALIDATED_EVENT = "hrms:admin-cache-invalidated";
const FORCE_PASSWORD_RESET_EVENT = "hrms:force-password-reset";
let adminCacheGeneration = 0;

function notifyPasswordChangeRequired(message: string) {
  if (
    typeof window !== "undefined" &&
    /temporary password|must change.+password|change.+password before continuing|before you can continue/i.test(
      message,
    )
  ) {
    window.dispatchEvent(new CustomEvent(FORCE_PASSWORD_RESET_EVENT));
  }
}

function getAdminRequestKey(
  path: string,
  method: HttpMethod,
  token?: string,
  body?: unknown,
) {
  return JSON.stringify({
    method,
    path: buildUrl(path),
    token: token ?? "",
    body: body ?? null,
  });
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

export function invalidateAdminGetCache() {
  adminCacheGeneration += 1;
  adminResponseCache.clear();
  inflightAdminRequests.clear();
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(new Event(ADMIN_CACHE_INVALIDATED_EVENT));
  }
}

export interface AdminStats {
  users: number;
  roles: number;
  permissions: number;
  companies: number;
}

function unsupportedAdminEndpoint(message: string): never {
  throw new Error(message);
}

export interface AdminResourceCollections {
  users: AdminRecord[];
  roles: AdminRecord[];
  permissions: AdminRecord[];
  companies: AdminRecord[];
}

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
  search?: string;
}

export interface EmployeesQueryParams extends UsersQueryParams {
  employment_status?:
    | "onboarding"
    | "pending"
    | "active"
    | "suspended"
    | "inactive"
    | "resigned"
    | "terminated"
    | "retired"
    | "deceased"
    | "exited";
  branch_id?: number;
  department_id?: number;
  position_id?: number;
}

const EMPLOYEE_SORT_FIELDS = new Set([
  "created_at",
  "first_name",
  "last_name",
  "email",
  "status",
  "employment_status",
  "employee_no",
]);

function normalizeSortBy(
  sortBy?: string,
  allowedFields?: ReadonlySet<string>,
): string | null {
  const trimmed = sortBy?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase() === "sortvalue") {
    return null;
  }

  if (allowedFields && !allowedFields.has(trimmed)) {
    return null;
  }

  return trimmed;
}

export interface DepartmentsQueryParams extends UsersQueryParams {
  status?: string;
  branch_id?: number;
  parent_id?: number;
}

export interface BranchesQueryParams extends UsersQueryParams {
  status?: string;
}

export interface PositionsQueryParams extends UsersQueryParams {
  status?: string;
  department_id?: number;
}

export interface LeaveTypesQueryParams extends UsersQueryParams {
  status?: string;
}

export interface LeaveRequestsQueryParams extends UsersQueryParams {
  employee_id?: number;
  leave_type_id?: number;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export interface LeaveTeamCalendarEntry {
  request_id: number;
  employee_id: number;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  duration_type: string;
  status: string;
}

export interface LeaveBalancesQueryParams extends UsersQueryParams {
  employee_id?: number;
  leave_type_id?: number;
  fiscal_year?: string;
}

export interface LeaveHolidaysQueryParams extends UsersQueryParams {
  from_date?: string;
  to_date?: string;
}

export interface LeavePoliciesQueryParams extends UsersQueryParams {
  status?: string;
  applicable_department_id?: number;
  applicable_position_id?: number;
}

export interface LeaveWorkflowsQueryParams extends UsersQueryParams {
  status?: string;
  leave_type_id?: number;
}

export interface OnboardingWorkflowsQueryParams extends UsersQueryParams {
  status?: string;
}

export interface OnboardingRequestsQueryParams extends UsersQueryParams {
  employee_id?: number;
  status?: string;
}

export interface OffboardingRequestsQueryParams extends UsersQueryParams {
  employee_id?: number;
  status?: string;
  offboarding_type?: string;
}

export interface OffboardingWorkflowsQueryParams extends UsersQueryParams {
  status?: string;
}

export interface AttendanceQueryParams extends UsersQueryParams {
  search?: string;
  check_in_after?: string;
  check_in_before?: string;
  employee_id?: number;
  employee_no?: string;
  device_id?: number;
  from_date?: string;
  to_date?: string;
  organization_id?: number;
  branch_id?: number;
  department_id?: number;
  shift_id?: number;
  timetable_id?: number;
  status?: string;
  attendance_status?: string;
  exception_type?: string;
  /** Filter attendance policies by active flag (GET /api/attendance/config/policies). */
  is_active?: boolean;
}

export interface AttendanceReportDownloadParams extends AttendanceQueryParams {
  late_only?: boolean;
  early_departure_only?: boolean;
  overtime_only?: boolean;
  format: "xlsx" | "csv" | "pdf";
}

export interface MyAttendanceHistoryQueryParams extends UsersQueryParams {
  employee_id?: number;
  employee_no?: string;
  from_date?: string;
  to_date?: string;
  organization_id?: number;
  status?: string;
  attendance_status?: string;
}

export interface MyAttendancePunchesQueryParams extends UsersQueryParams {
  employeeId?: number;
  branchId?: number;
  punchType?: "CHECK_IN" | "CHECK_OUT";
  validationStatus?:
    | "APPROVED"
    | "REJECTED"
    | "PENDING_OVERRIDE"
    | "OVERRIDE_APPROVED"
    | "OVERRIDE_REJECTED";
  dateFrom?: string;
  dateTo?: string;
}

export interface MyAttendanceScheduleQueryParams {
  from_date?: string;
  to_date?: string;
  days?: number;
}

export interface SelfServiceRequestQueryParams extends UsersQueryParams {
  status?: string;
  date_from?: string;
  date_to?: string;
}

export type NotificationStatus = "UNREAD" | "READ";
export type NotificationCategory =
  "GENERAL" | "HR" | "AUTH" | "ACCESS_CONTROL" | "SYSTEM";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "PUSH";
export type NotificationPreferenceType =
  | "GENERAL"
  | "AUTH_SECURITY"
  | "ACCESS_CHANGE"
  | "LEAVE_SUBMITTED"
  | "LEAVE_APPROVAL_REQUIRED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_RETURNED_FOR_CORRECTION"
  | "LEAVE_CANCELLED"
  | "LEAVE_EVIDENCE_REQUIRED"
  | "LEAVE_ROUTING_REQUIRED"
  | "ONBOARDING_SUBMITTED"
  | "ONBOARDING_APPROVAL_REQUIRED"
  | "ONBOARDING_APPROVED"
  | "ONBOARDING_REJECTED"
  | "ONBOARDING_TASK_ASSIGNED"
  | "ONBOARDING_TASK_OVERDUE"
  | "ONBOARDING_APPROVAL_REMINDER"
  | "ONBOARDING_COMPLETED"
  | "OFFBOARDING_SUBMITTED"
  | "OFFBOARDING_APPROVAL_REQUIRED"
  | "OFFBOARDING_APPROVED"
  | "OFFBOARDING_TASK_ASSIGNED"
  | "OFFBOARDING_TASK_OVERDUE"
  | "OFFBOARDING_APPROVAL_REMINDER"
  | "OFFBOARDING_CLEARANCE_REQUIRED"
  | "OFFBOARDING_CLEARANCE_OVERDUE"
  | "OFFBOARDING_ASSET_OVERDUE"
  | "OFFBOARDING_SETTLEMENT_OVERDUE"
  | "OFFBOARDING_COMPLETED"
  | "ATTENDANCE_CORRECTION"
  | "ATTENDANCE_MISSING"
  | "ATTENDANCE_LATE"
  | "DAILY_ACTIVITY_NOT_SUBMITTED"
  | "FIELD_VISIT_REPORT_PENDING"
  | "PROBATION_CONFIRMATION_DUE"
  | "PROBATION_CONFIRMATION_OVERDUE"
  | "KPI_UPDATE_PENDING"
  | "KPI_SCORE_PUBLISHED"
  | "PERFORMANCE_DEADLINE_REMINDER"
  | "PERFORMANCE_PIP_REMINDER"
  | "PERFORMANCE_DEVELOPMENT_REMINDER"
  | "PAYROLL_PROCESSED"
  | "PAYSLIP_AVAILABLE"
  | "STAFF_LOAN_INSTALLMENT_DEDUCTED"
  | "APPROVAL_OVERDUE"
  | "SYSTEM_ALERT";
export type NotificationDeliveryStatus =
  "PENDING" | "DELIVERED" | "FAILED" | "SKIPPED";
export type NotificationMailLogStatus =
  "PENDING" | "SENT" | "SKIPPED" | "FAILED";
export type NotificationTemplateStatus = "ACTIVE" | "INACTIVE";

export type NotificationItem = AdminRecord & {
  id?: number | string;
  notification_id?: number | string;
  notificationId?: number | string;
  title?: string;
  message?: string;
  status?: NotificationStatus | string;
  category?: NotificationCategory | string;
  priority?: NotificationPriority | string;
  type?: string;
  related_module?: string;
  relatedModule?: string;
  entity_type?: string;
  entityType?: string;
  entity_id?: string;
  entityId?: string;
  action_url?: string;
  actionUrl?: string;
  seen?: boolean;
  is_seen?: boolean;
  seen_at?: string;
  seenAt?: string;
  read_at?: string;
  readAt?: string;
  archived_at?: string;
  archivedAt?: string;
  created_at?: string;
  createdAt?: string;
  metadata?: AdminRecord | null;
};

export interface NotificationQueryParams extends UsersQueryParams {
  status?: NotificationStatus;
  type?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  related_module?: string;
  entity_type?: string;
  entity_id?: string;
  seen?: boolean;
  include_archived?: boolean;
}

export interface NotificationDeliveryQueryParams extends UsersQueryParams {
  channel?: NotificationChannel;
  status?: NotificationDeliveryStatus;
  notification_id?: number;
  receiver_company_user_id?: number;
  related_module?: string;
  entity_type?: string;
  entity_id?: string;
}

export interface NotificationMailLogQueryParams extends UsersQueryParams {
  status?: NotificationMailLogStatus;
  method?: string;
  recipient_email?: string;
  company_id?: number;
  only_unscoped?: boolean;
}

export interface NotificationChannelRegistryQueryParams {
  channel?: NotificationChannel;
  module?: string;
  search?: string;
}

export type NotificationChannelSetting = AdminRecord & {
  id?: number | string;
  channel?: NotificationChannel | string;
  isEnabled?: boolean;
  is_enabled?: boolean;
  description?: string | null;
  updatedByCompanyUserId?: number | string | null;
  updated_by_company_user_id?: number | string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

export type NotificationChannelRegistryItem = AdminRecord & {
  id?: number | string;
  channel?: NotificationChannel | string;
  code?: string;
  name?: string;
  module?: string;
  description?: string | null;
  isEnabled?: boolean;
  is_enabled?: boolean;
  updatedByCompanyUserId?: number | string | null;
  updated_by_company_user_id?: number | string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

export interface NotificationTemplateQueryParams {
  search?: string;
  template_code?: string;
  status?: NotificationTemplateStatus;
}

export type NotificationTemplateItem = AdminRecord & {
  id?: number | string;
  companyId?: number | string | null;
  company_id?: number | string | null;
  templateCode?: string;
  template_code?: string;
  title?: string;
  emailSubject?: string | null;
  email_subject?: string | null;
  systemMessage?: string;
  system_message?: string;
  emailBody?: string | null;
  email_body?: string | null;
  mobileMessage?: string | null;
  mobile_message?: string | null;
  availableVariables?: string[];
  available_variables?: string[];
  status?: NotificationTemplateStatus | string;
};

export interface NotificationRuleQueryParams {
  search?: string;
  notification_type?: string;
  trigger_event?: string;
  related_module?: string;
  enabled?: boolean;
}

export type NotificationRuleItem = AdminRecord & {
  id?: number | string;
  companyId?: number | string | null;
  company_id?: number | string | null;
  notificationType?: string;
  notification_type?: string;
  triggerEvent?: string;
  trigger_event?: string;
  relatedModule?: string | null;
  related_module?: string | null;
  recipientType?: string;
  recipient_type?: string;
  channels?: NotificationChannel[] | string[];
  priority?: NotificationPriority | string;
  enabled?: boolean;
};

export type NotificationPreference = AdminRecord & {
  id?: number | string;
  notification_type?: NotificationPreferenceType | string;
  notificationType?: NotificationPreferenceType | string;
  channel?: NotificationChannel | string;
  is_enabled?: boolean;
  isEnabled?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
};

export interface SetMyNotificationPreferenceInput {
  notification_type: NotificationPreferenceType;
  channel: NotificationChannel;
  is_enabled: boolean;
}

export type NotificationDeliveryLog = AdminRecord;
export type NotificationMailLog = AdminRecord;

export type CreateTestNotificationInput = {
  receiver_company_user_id: number;
  title: string;
  message: string;
  type?: string;
  category?: NotificationCategory | string;
  priority?: NotificationPriority | string;
  related_module?: string;
  entity_type?: string;
  entity_id?: string;
  action_url?: string;
  dedupe_key?: string;
  metadata?: AdminRecord;
};

export interface TeamAttendanceQueryParams extends UsersQueryParams {
  date_from?: string;
  date_to?: string;
}

export interface EmployeePositionsQueryParams extends UsersQueryParams {
  employee_id?: number;
  position_id?: number;
  status?: string;
  assignment_type?: string;
  is_primary?: boolean;
}

export interface EmployeeMovementsQueryParams extends UsersQueryParams {
  employee_id?: number;
  status?: string;
  movement_type?: string;
}

export type AttendanceResourceKey =
  | "settings"
  | "policies"
  | "devices"
  | "checkpoints"
  | "geofences"
  | "wifi-networks"
  | "mobile-punches"
  | "holiday-groups"
  | "holidays"
  | "device-sync-logs";

export type ShiftResourceKey =
  | "shift-assignments"
  | "shift-breaks"
  | "shift-rotation-groups"
  | "shift-rotation-rules"
  | "shift-schedules"
  | "shifts";

export type TimetableResourceKey =
  | "employee-timetables"
  | "timetable-days"
  | "timetable-generated-schedules"
  | "timetable-holiday-rules"
  | "timetable-rotation-rules"
  | "timetable-rotations"
  | "timetable-shift-rules"
  | "timetables";

export type AccessControlResourceKey =
  "doors" | "schedule-templates" | "organizations" | "groups" | "week-plans";

export type EmployeeProfileSection =
  | "contacts"
  | "addresses"
  | "relatives"
  | "identifications"
  | "bank-accounts"
  | "academic-qualifications"
  | "professional-qualifications"
  | "experience-details";

export interface EmployeeStatusPayload {
  employment_status:
    | "onboarding"
    | "active"
    | "suspended"
    | "inactive"
    | "resigned"
    | "terminated"
    | "retired"
    | "deceased"
    | "exited";
  effective_date: string;
  exit_date?: string;
  exit_reason?: string;
  notes?: string;
}

export interface EmployeeAssignmentPayload {
  effective_date: string;
  branch_id?: number | null;
  departments?: Array<{ department_id: number; is_primary?: boolean }>;
  primary_position_id?: number | null;
  reports_to?: number | null;
  grade_id?: number | null;
  cost_center_id?: number | null;
  reason?: string;
}

export const EMPLOYEE_STATUS_VALUES = [
  "onboarding",
  "active",
  "suspended",
  "inactive",
  "resigned",
  "terminated",
  "retired",
  "deceased",
  "exited",
] as const;

export type EmployeeStatusValue = (typeof EMPLOYEE_STATUS_VALUES)[number];

export type OnboardingAttendanceMode = "shift" | "timetable";

export interface OnboardingShiftProvisioning {
  shift_id: number;
  effective_from?: string;
  effective_to?: string | null;
  rotation_group_id?: number | null;
  is_primary?: boolean;
}

export interface OnboardingTimetableProvisioning {
  timetable_id: number;
  effective_from?: string;
  effective_to?: string | null;
}

export interface OnboardingDeviceProvisioning {
  employee_no?: string;
  access_group_id: number;
  organization_id?: number;
  valid_enabled?: boolean;
  valid_begin_time?: string;
  valid_end_time?: string;
  local_ui_right?: boolean;
  close_delay_enabled?: boolean;
  max_open_door_time?: number;
  open_door_time?: number;
  user_verify_mode?: string;
  metadata?: Record<string, unknown>;
  device_ids: number[];
  sync_now?: boolean;
  continue_on_error?: boolean;
}

export interface OnboardingProvisioning {
  role_ids?: number[];
  branch_access_ids?: number[];
  attendance_mode?: OnboardingAttendanceMode;
  attendance_policy_id?: number;
  leave_policy_id?: number;
  shift_assignment?: OnboardingShiftProvisioning;
  timetable_assignment?: OnboardingTimetableProvisioning;
  device_assignment?: OnboardingDeviceProvisioning;
}

export interface EmployeeOnboardingInput {
  auto_start?: boolean;
  workflow_id?: number;
  title?: string;
  description?: string;
  planned_start_date?: string;
  planned_completion_date?: string;
  submit?: boolean;
  provisioning?: OnboardingProvisioning;
}

export interface CreateOnboardingRequestPayload {
  employee_id: number;
  workflow_id?: number;
  title: string;
  description?: string;
  planned_start_date?: string;
  planned_completion_date?: string;
  submit?: boolean;
  provisioning?: OnboardingProvisioning;
}

export interface CreateEmployeePayload {
  employee_no?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  preferred_name?: string;
  gender?: string;
  date_of_birth?: string;
  marital_status?: string;
  nationality?: string;
  profile_photo_url?: string;
  primary_branch_id?: number;
  primary_department_id?: number;
  primary_position_id?: number;
  position_id?: number;
  employment_status?: EmployeeStatusValue;
  employment_type?:
    | "full_time"
    | "part_time"
    | "contract"
    | "probation"
    | "intern"
    | "consultant"
    | "temporary";
  hire_date?: string;
  probation_end_date?: string;
  confirmation_date?: string;
  exit_date?: string;
  reports_to?: number;
  exit_reason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  departments?: Array<{ department_id: number; is_primary?: boolean }>;
  contacts?: Array<Record<string, unknown>>;
  addresses?: Array<Record<string, unknown>>;
  relatives?: Array<Record<string, unknown>>;
  identifications?: Array<Record<string, unknown>>;
  bank_accounts?: Array<Record<string, unknown>>;
  academic_qualifications?: Array<Record<string, unknown>>;
  professional_qualifications?: Array<Record<string, unknown>>;
  experience_details?: Array<Record<string, unknown>>;
  onboarding?: EmployeeOnboardingInput;
}

export type CreateEmployeeResponse = AdminRecord & {
  employee_id?: number;
  warning?: string | null;
  onboarding_request?:
    | (AdminRecord & {
        id?: number;
        onboarding_no?: string;
        title?: string;
        status?: string;
        progress_percentage?: string;
        planned_start_date?: string | null;
        planned_completion_date?: string | null;
        provisioning?: OnboardingProvisioning | null;
        metadata?: Record<string, unknown> | null;
      })
    | null;
};

export type EmployeeInvitationChannel = "EMAIL" | "SMS";

export interface CreateEmployeeInvitationPayload {
  first_name: string;
  last_name: string;
  gender: string;
  email: string;
  phone: string;
  primary_branch_id: number;
  primary_department_id: number;
  primary_position_id: number;
  employment_type: NonNullable<CreateEmployeePayload["employment_type"]>;
  reports_to?: number;
  hire_date?: string;
  onboarding_workflow_id?: number;
  channels: EmployeeInvitationChannel[];
}

export interface PositionCapacity {
  position_id: number;
  headcount: number;
  filled: number;
  pending_invitations: number;
  available: number;
  /** True when one more acceptance would exceed the approved headcount. */
  will_overfill: boolean;
}

/** Seats taken in a position, counting pending invitations as taken. */
export async function getEmployeeInvitationPositionCapacity(
  token: string,
  positionId: number,
  departmentId: number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-invitations/position-capacity/${positionId}?departmentId=${departmentId}`,
    { token, dedupe: false },
  );
  return normalizeSingle(payload) as unknown as PositionCapacity;
}

export type EmployeeInvitationResponse = AdminRecord & {
  capacity?: PositionCapacity | null;
  id?: number;
  status?: string;
  expires_at?: string;
  expiresAt?: string;
  delivery?: {
    email?: {
      status?: string;
      message_id?: string | null;
      last_error?: string | null;
      transport?: "system_smtp";
    };
    sms?: {
      status?: string;
      message_id?: string | null;
      last_error?: string | null;
      transport?: "sms_gateway";
    };
  };
};

export interface PublicEmployeeInvitation {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  expires_at: string;
  /** True when the email already has an account; accept with its current password. */
  has_existing_account?: boolean;
}

export interface AcceptEmployeeInvitationResponse {
  status: string;
  employee_id?: number | null;
  login_url: string;
}

export type EmployeeImportMode =
  "CREATE_ONLY" | "UPDATE_EXISTING" | "CREATE_OR_UPDATE";
export type EmployeeImportExecutionMode = "NORMAL" | "SYNC";

export type EmployeeImportRequest = {
  import_mode: EmployeeImportMode;
  process_valid_rows_only?: boolean;
};

export type EmployeeImportConfirmRequest = {
  batch_id?: string;
  preview_token?: string;
  row_ids?: number[];
  excluded_row_ids?: number[];
  skip_existing_records?: boolean;
  exclude_invalid_records?: boolean;
  process_valid_rows_only?: boolean;
  execution_mode?: EmployeeImportExecutionMode;
};

export function isEmployeeStatusValue(
  value: unknown,
): value is EmployeeStatusValue {
  return (
    typeof value === "string" &&
    (EMPLOYEE_STATUS_VALUES as readonly string[]).includes(
      value.trim().toLowerCase(),
    )
  );
}

export interface PaginatedUsersResult {
  rows: AdminRecord[];
  page: number;
  limit: number;
  total: number | null;
  totalPages: number | null;
}

export const RESOURCE_LABELS: Record<AdminResourceKey, string> = {
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  companies: "Companies",
};

const RESOURCE_PATHS: Record<AdminResourceKey, string> = {
  users: "/api/users",
  roles: "/api/roles",
  permissions: "/api/permissions",
  companies: "/api/companies",
};

export const RESOURCE_CREATE_TEMPLATES: Record<AdminResourceKey, AdminRecord> =
  {
    users: {
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      password: "",
      user_no: "",
      status: "active",
    },
    roles: {
      name: "",
      display_name: "",
      description: "",
    },
    permissions: {
      name: "",
      display_name: "",
      description: "",
    },
    companies: {
      company_name: "",
      company_slug: "",
      admin_first_name: "",
      admin_last_name: "",
      admin_email: "",
      admin_phone: "",
      admin_password: "",
    },
  };

function getBaseUrl() {
  // Keep in sync with `resolveApiBaseUrl` in `@/utils/constants`.
  return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api$/i, "");
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null
    ? (value as AdminRecord)
    : null;
}

function asArray(value: unknown): AdminRecord[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  // Empty array is a valid empty collection.
  if (value.length === 0) {
    return [];
  }
  const records = value.filter(
    (entry) =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  ) as AdminRecord[];
  if (records.length > 0) {
    return records;
  }
  // Permission catalogs sometimes return ["roles:read", "users:update", ...].
  if (value.every((entry) => typeof entry === "string" && entry.trim())) {
    return (value as string[]).map((name) => ({
      id: name,
      name,
      display_name: name,
    }));
  }
  return null;
}

const PREFERRED_LIST_KEYS = [
  "data",
  "items",
  "results",
  "records",
  "rows",
  "list",
  "content", // Spring Data Page
  "users",
  "role_users",
  "roleUsers",
  "employees",
  "branches",
  "departments",
  "positions",
  "roles",
  "permissions",
  "companies",
  // Attendance config collections
  "policies",
  "policy_sets",
  "policySets",
  "attendance_policies",
  "attendancePolicies",
  "checkpoints",
  "geofences",
  "wifi_networks",
  "wifiNetworks",
  "holidays",
  "holiday_groups",
  "holidayGroups",
  "devices",
] as const;

/** Keys that look like collection payloads (used for deep fallback search). */
const POLICY_LIKE_FIELD_HINTS = [
  "name",
  "is_active",
  "isActive",
  "late_after_minutes",
  "lateAfterMinutes",
  "grace_period_minutes",
  "gracePeriodMinutes",
  "half_day_after_minutes",
  "halfDayAfterMinutes",
  "absent_after_minutes",
  "absentAfterMinutes",
  "weekend_days",
  "weekendDays",
  "authentication_modes",
  "authenticationModes",
] as const;

const SKIP_NESTED_KEYS = new Set([
  "meta",
  "pagination",
  "links",
  "errors",
  "error",
  "message",
  "messages",
  "permissions", // often actor permission strings on envelopes; list endpoint still uses preferred keys first
  "roles",
  "authorities",
  "scopes",
]);

function getRecordArrays(record: AdminRecord | null) {
  if (!record) {
    return [] as AdminRecord[][];
  }

  return Object.values(record)
    .map((value) => asArray(value))
    .filter((value): value is AdminRecord[] => value !== null);
}

function getNestedRecords(record: AdminRecord | null) {
  if (!record) {
    return [] as AdminRecord[];
  }

  return Object.entries(record)
    .filter(([key, value]) => {
      if (SKIP_NESTED_KEYS.has(key)) {
        return false;
      }
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    })
    .map(([, value]) => value as AdminRecord);
}

function extractListFromRecord(
  record: AdminRecord | null,
): AdminRecord[] | null {
  if (!record) {
    return null;
  }

  let emptyPreferred: AdminRecord[] | null = null;

  // 1) Preferred collection keys first (including empty arrays — those are real empties).
  for (const key of PREFERRED_LIST_KEYS) {
    if (!(key in record)) {
      continue;
    }
    const list = asArray(record[key]);
    if (list === null) {
      continue;
    }
    if (list.length > 0) {
      return list;
    }
    if (emptyPreferred === null) {
      emptyPreferred = list;
    }
  }

  // 2) Nested envelopes (data/result/...) before random sibling empty arrays.
  const nestedCandidates = [
    asRecord(record.data),
    asRecord(record.result),
    asRecord(record.payload),
    asRecord(record.response),
    ...getNestedRecords(record),
  ];

  for (const nested of nestedCandidates) {
    if (!nested) {
      continue;
    }
    const nestedList = extractListFromRecord(nested);
    if (nestedList && nestedList.length > 0) {
      return nestedList;
    }
    if (nestedList && nestedList.length === 0 && emptyPreferred === null) {
      emptyPreferred = nestedList;
    }
  }

  // 3) Any other non-empty record array on the object.
  for (const list of getRecordArrays(record)) {
    if (list.length > 0) {
      return list;
    }
  }

  // 4) Genuine empty collection under a preferred key / nested envelope.
  return emptyPreferred;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readNumberFromRecord(
  record: AdminRecord | null,
  keys: string[],
): number | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const parsed = readNumber(record[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function scoreRecordArray(rows: AdminRecord[]): number {
  if (rows.length === 0) {
    return 0;
  }
  let score = rows.length;
  for (const row of rows.slice(0, 8)) {
    for (const hint of POLICY_LIKE_FIELD_HINTS) {
      if (hint in row) {
        score += 3;
      }
    }
    if ("id" in row) {
      score += 1;
    }
  }
  return score;
}

/**
 * Walk nested envelopes for the best array-of-records candidate.
 * Used when preferred-key extraction fails for unfamiliar API shapes.
 */
function deepFindRecordArrays(
  value: unknown,
  depth = 0,
  maxDepth = 6,
): AdminRecord[][] {
  if (depth > maxDepth || value == null) {
    return [];
  }

  const asList = asArray(value);
  if (asList) {
    return asList.length > 0 ? [asList] : [];
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const preferredKeySet = new Set<string>(PREFERRED_LIST_KEYS);
  const found: AdminRecord[][] = [];
  for (const [key, child] of Object.entries(record)) {
    // Skip pure metadata, but never skip known collection keys.
    if (SKIP_NESTED_KEYS.has(key) && !preferredKeySet.has(key)) {
      continue;
    }
    found.push(...deepFindRecordArrays(child, depth + 1, maxDepth));
  }
  return found;
}

function normalizeList(payload: unknown): AdminRecord[] {
  const direct = asArray(payload);
  if (direct) {
    return direct;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  // An explicitly present primary collection is authoritative even when empty.
  // Do not substitute a sibling relation such as `employees` for `data: []`.
  const primaryList = asArray(record.data);
  if (primaryList) {
    return primaryList;
  }

  const list = extractListFromRecord(record);
  if (list && list.length > 0) {
    return list;
  }

  // Deep search: pick the highest-scoring array of plain records.
  const candidates = deepFindRecordArrays(record);
  if (candidates.length > 0) {
    const best = [...candidates].sort(
      (a, b) => scoreRecordArray(b) - scoreRecordArray(a),
    )[0];
    if (best && best.length > 0) {
      return best;
    }
  }

  // Some list endpoints return a single record under data/result when only one row exists.
  const single =
    asRecord(record.data) ??
    asRecord(record.result) ??
    asRecord(record.payload) ??
    asRecord(record.policy) ??
    asRecord(record.item);
  if (
    single &&
    (single.id !== undefined ||
      single.name !== undefined ||
      single.display_name !== undefined ||
      single.displayName !== undefined)
  ) {
    return [single];
  }

  return list ?? [];
}

const LEAVE_APPROVAL_LIST_KEYS = [
  "approvals",
  "approval_chain",
  "approvalChain",
  "approval_steps",
  "approvalSteps",
  "leave_request_approvals",
  "leaveRequestApprovals",
  "workflow_approvals",
  "workflowApprovals",
  "request_approvals",
  "requestApprovals",
  "pending_approvals",
  "pendingApprovals",
  "steps",
] as const;

/**
 * Coerce approval collections that may be a plain array or a nested envelope
 * like `{ data: [...] }` / `{ items: [...] }`.
 */
function coerceLeaveApprovalsList(value: unknown): AdminRecord[] {
  const direct = asArray(value);
  if (direct && direct.length > 0) {
    return direct;
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  for (const key of [
    "data",
    "items",
    "results",
    "rows",
    "records",
    "list",
    "approvals",
  ] as const) {
    const nested = asArray(record[key]);
    if (nested && nested.length > 0) {
      return nested;
    }
  }

  return [];
}

function extractLeaveApprovalsList(source: AdminRecord | null): AdminRecord[] {
  if (!source) {
    return [];
  }

  for (const key of LEAVE_APPROVAL_LIST_KEYS) {
    const list = coerceLeaveApprovalsList(source[key]);
    if (list.length > 0) {
      return list;
    }
  }

  const workflow = asRecord(
    source.workflow ?? source.approval_workflow ?? source.approvalWorkflow,
  );
  if (workflow) {
    for (const key of [
      "approvals",
      "steps",
      "approval_steps",
      "approvalSteps",
    ] as const) {
      const list = coerceLeaveApprovalsList(workflow[key]);
      if (list.length > 0) {
        return list;
      }
    }
  }

  return [];
}

/** True when a record looks like a leave request entity (not a nested company/employee/etc.). */
function looksLikeLeaveRequest(record: AdminRecord | null): boolean {
  if (!record) {
    return false;
  }

  // Strong identity fields from LeaveRequest schema.
  if (
    "leave_no" in record ||
    "leaveNo" in record ||
    "leave_type_id" in record ||
    "leaveTypeId" in record ||
    "current_approval_level" in record ||
    "currentApprovalLevel" in record ||
    "total_days" in record ||
    "totalDays" in record
  ) {
    return true;
  }

  // Submitted/in-review leave rows commonly carry start/end + status.
  // Do not treat "has approvals" alone as leave identity — envelopes may
  // carry sibling approvals next to a nested request body.
  if (
    ("start_date" in record || "startDate" in record) &&
    ("end_date" in record || "endDate" in record) &&
    "status" in record
  ) {
    return true;
  }

  return false;
}

/**
 * Unwrap leave-request detail without using generic normalizeSingle().
 *
 * normalizeSingle() prefers the first nested object (data/result/item/user/company),
 * so a bare LeaveRequest payload with relations would be reduced to `company` or
 * `employee` and drop `approvals` / workflow fields.
 */
function unwrapLeaveRequestCandidate(payload: unknown): AdminRecord | null {
  const root = asRecord(payload);
  if (!root) {
    const list = asArray(payload);
    return list?.[0] ?? null;
  }

  if (looksLikeLeaveRequest(root)) {
    return root;
  }

  const wrappers = [
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.payload),
    asRecord(root.response),
    asRecord(root.leave_request),
    asRecord(root.leaveRequest),
    asRecord(root.request),
  ];

  for (const wrapper of wrappers) {
    if (!wrapper) continue;
    if (looksLikeLeaveRequest(wrapper)) {
      return wrapper;
    }

    const nested =
      asRecord(wrapper.leave_request) ??
      asRecord(wrapper.leaveRequest) ??
      asRecord(wrapper.request) ??
      asRecord(wrapper.data) ??
      asRecord(wrapper.result) ??
      asRecord(wrapper.item);

    if (looksLikeLeaveRequest(nested)) {
      return nested;
    }
  }

  // Last resort: first nested leave-shaped relation, never company/user alone.
  for (const nested of getNestedRecords(root)) {
    if (looksLikeLeaveRequest(nested)) {
      return nested;
    }
  }

  return null;
}

/**
 * Preserve approval/workflow arrays that often sit next to (not inside) the leave request object.
 * Plain normalizeSingle() can drop sibling fields like root.approvals when it returns root.data,
 * and can also peel a bare leave request down to a nested company/employee relation.
 */
function normalizeLeaveRequestDetail(payload: unknown): AdminRecord | null {
  const root = asRecord(payload);
  const single =
    unwrapLeaveRequestCandidate(payload) ?? normalizeSingle(payload);
  if (!single && !root) {
    return null;
  }

  const nestedData = root ? asRecord(root.data) : null;
  const nestedResult = root ? asRecord(root.result) : null;
  const nestedItem = root ? asRecord(root.item) : null;
  const nestedPayload = root ? asRecord(root.payload) : null;
  const nestedRequest =
    asRecord(single?.leave_request) ??
    asRecord(single?.leaveRequest) ??
    asRecord(nestedData?.leave_request) ??
    asRecord(nestedData?.leaveRequest) ??
    asRecord(nestedResult?.leave_request) ??
    asRecord(nestedItem?.leave_request) ??
    asRecord(nestedPayload?.leave_request);

  // Prefer the leave-request-shaped record as the merge base so nested relations
  // (company/employee) never overwrite request fields when unwrapping failed partially.
  const leaveShaped =
    (looksLikeLeaveRequest(single) ? single : null) ??
    (looksLikeLeaveRequest(nestedRequest) ? nestedRequest : null) ??
    (looksLikeLeaveRequest(nestedData) ? nestedData : null) ??
    (looksLikeLeaveRequest(root) ? root : null) ??
    single ??
    nestedRequest ??
    root;

  const base: AdminRecord = {
    ...(nestedRequest && nestedRequest !== leaveShaped ? nestedRequest : {}),
    ...(leaveShaped ?? {}),
  };

  const approvalSources: Array<AdminRecord | null> = [
    base,
    leaveShaped,
    single,
    nestedRequest,
    nestedData,
    nestedResult,
    nestedItem,
    nestedPayload,
    root,
    asRecord(root?.meta),
    asRecord(nestedData?.meta),
  ];

  let approvals: AdminRecord[] = [];
  for (const source of approvalSources) {
    const list = extractLeaveApprovalsList(source);
    if (list.length > 0) {
      approvals = list;
      break;
    }
  }

  // Prefer the current approval cycle when the API returns historical cycles together.
  const currentCycle =
    readNumber(base.approval_cycle) ??
    readNumber(base.approvalCycle) ??
    readNumber(leaveShaped?.approval_cycle) ??
    readNumber(leaveShaped?.approvalCycle);

  if (approvals.length > 0 && currentCycle !== null) {
    const cycleFiltered = approvals.filter((entry) => {
      const cycle =
        readNumber(entry.approval_cycle) ?? readNumber(entry.approvalCycle);
      return cycle === null || cycle === currentCycle;
    });
    if (cycleFiltered.length > 0) {
      approvals = cycleFiltered;
    }
  }

  if (approvals.length > 0) {
    base.approvals = approvals;
  }

  // Keep useful workflow metadata from parent wrappers when missing on the request body.
  for (const source of approvalSources) {
    if (!source) continue;
    if (
      base.current_approval_level == null &&
      source.current_approval_level != null
    ) {
      base.current_approval_level = source.current_approval_level;
    }
    if (
      base.currentApprovalLevel == null &&
      source.currentApprovalLevel != null
    ) {
      base.currentApprovalLevel = source.currentApprovalLevel;
    }
    if (base.approval_cycle == null && source.approval_cycle != null) {
      base.approval_cycle = source.approval_cycle;
    }
    if (base.workflow == null && source.workflow != null) {
      base.workflow = source.workflow;
    }
  }

  if (!("id" in base) && !("status" in base) && approvals.length === 0) {
    return single;
  }

  return base;
}

function buildUsersQuery(params: UsersQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const sortBy = normalizeSortBy(params.sortBy);
  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }
  if (sortBy && (params.sortOrder === "ASC" || params.sortOrder === "DESC")) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNotificationsQuery(params: NotificationQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.type && params.type.trim()) {
    searchParams.set("type", params.type.trim());
  }
  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.priority) {
    searchParams.set("priority", params.priority);
  }
  if (params.related_module && params.related_module.trim()) {
    searchParams.set("related_module", params.related_module.trim());
  }
  if (params.entity_type && params.entity_type.trim()) {
    searchParams.set("entity_type", params.entity_type.trim());
  }
  if (params.entity_id && params.entity_id.trim()) {
    searchParams.set("entity_id", params.entity_id.trim());
  }
  if (typeof params.seen === "boolean") {
    searchParams.set("seen", String(params.seen));
  }
  if (typeof params.include_archived === "boolean") {
    searchParams.set("include_archived", String(params.include_archived));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNotificationDeliveriesQuery(
  params: NotificationDeliveryQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.channel) {
    searchParams.set("channel", params.channel);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (
    typeof params.notification_id === "number" &&
    params.notification_id > 0
  ) {
    searchParams.set("notification_id", String(params.notification_id));
  }
  if (
    typeof params.receiver_company_user_id === "number" &&
    params.receiver_company_user_id > 0
  ) {
    searchParams.set(
      "receiver_company_user_id",
      String(params.receiver_company_user_id),
    );
  }
  if (params.related_module && params.related_module.trim()) {
    searchParams.set("related_module", params.related_module.trim());
  }
  if (params.entity_type && params.entity_type.trim()) {
    searchParams.set("entity_type", params.entity_type.trim());
  }
  if (params.entity_id && params.entity_id.trim()) {
    searchParams.set("entity_id", params.entity_id.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNotificationMailLogsQuery(
  params: NotificationMailLogQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.method && params.method.trim()) {
    searchParams.set("method", params.method.trim());
  }
  if (params.recipient_email && params.recipient_email.trim()) {
    searchParams.set("recipient_email", params.recipient_email.trim());
  }
  if (typeof params.company_id === "number" && params.company_id > 0) {
    searchParams.set("company_id", String(params.company_id));
  }
  if (typeof params.only_unscoped === "boolean") {
    searchParams.set("only_unscoped", String(params.only_unscoped));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNotificationChannelRegistryQuery(
  params: NotificationChannelRegistryQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (params.channel) {
    searchParams.set("channel", params.channel);
  }
  if (params.module && params.module.trim()) {
    searchParams.set("module", params.module.trim());
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNotificationTemplateQuery(
  params: NotificationTemplateQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.template_code && params.template_code.trim()) {
    searchParams.set("template_code", params.template_code.trim());
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildNotificationRuleQuery(params: NotificationRuleQueryParams) {
  const searchParams = new URLSearchParams();
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.notification_type && params.notification_type.trim()) {
    searchParams.set("notification_type", params.notification_type.trim());
  }
  if (params.trigger_event && params.trigger_event.trim()) {
    searchParams.set("trigger_event", params.trigger_event.trim());
  }
  if (params.related_module && params.related_module.trim()) {
    searchParams.set("related_module", params.related_module.trim());
  }
  if (typeof params.enabled === "boolean") {
    searchParams.set("enabled", String(params.enabled));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildAttendanceReportQuery(params: AttendanceReportDownloadParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.check_in_after) searchParams.set("check_in_after", params.check_in_after);
  if (params.check_in_before) searchParams.set("check_in_before", params.check_in_before);
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (typeof params.device_id === "number" && params.device_id > 0) {
    searchParams.set("device_id", String(params.device_id));
  }
  if (params.employee_no && params.employee_no.trim()) {
    searchParams.set("employee_no", params.employee_no.trim());
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id));
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id));
  }
  if (
    typeof params.organization_id === "number" &&
    params.organization_id > 0
  ) {
    searchParams.set("organization_id", String(params.organization_id));
  }
  if (typeof params.shift_id === "number" && params.shift_id > 0) {
    searchParams.set("shift_id", String(params.shift_id));
  }
  if (typeof params.timetable_id === "number" && params.timetable_id > 0) {
    searchParams.set("timetable_id", String(params.timetable_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.late_only) searchParams.set("late_only", "true");
  if (params.early_departure_only) searchParams.set("early_departure_only", "true");
  if (params.overtime_only) searchParams.set("overtime_only", "true");
  if (params.exception_type && params.exception_type.trim()) {
    searchParams.set("exception_type", params.exception_type.trim());
  }
  if (params.attendance_status && params.attendance_status.trim()) {
    searchParams.set("attendance_status", params.attendance_status.trim());
  }
  searchParams.set("format", params.format);
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildEmployeesQuery(params: EmployeesQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const sortBy = normalizeSortBy(params.sortBy, EMPLOYEE_SORT_FIELDS);
  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }
  if (sortBy && (params.sortOrder === "ASC" || params.sortOrder === "DESC")) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.employment_status) {
    searchParams.set("employment_status", params.employment_status);
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id));
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id));
  }
  if (typeof params.position_id === "number" && params.position_id > 0) {
    searchParams.set("position_id", String(params.position_id));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildDepartmentsQuery(params: DepartmentsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id));
  }
  if (typeof params.parent_id === "number" && params.parent_id > 0) {
    searchParams.set("parent_id", String(params.parent_id));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildBranchesQuery(params: BranchesQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildPositionsQuery(params: PositionsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildLeaveTypesQuery(params: LeaveTypesQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildLeaveRequestsQuery(params: LeaveRequestsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (typeof params.leave_type_id === "number" && params.leave_type_id > 0) {
    searchParams.set("leave_type_id", String(params.leave_type_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildLeaveBalancesQuery(params: LeaveBalancesQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (typeof params.leave_type_id === "number" && params.leave_type_id > 0) {
    searchParams.set("leave_type_id", String(params.leave_type_id));
  }
  if (params.fiscal_year && params.fiscal_year.trim()) {
    searchParams.set("fiscal_year", params.fiscal_year.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildLeaveHolidaysQuery(params: LeaveHolidaysQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildLeavePoliciesQuery(params: LeavePoliciesQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (
    typeof params.applicable_department_id === "number" &&
    params.applicable_department_id > 0
  ) {
    searchParams.set(
      "applicable_department_id",
      String(params.applicable_department_id),
    );
  }
  if (
    typeof params.applicable_position_id === "number" &&
    params.applicable_position_id > 0
  ) {
    searchParams.set(
      "applicable_position_id",
      String(params.applicable_position_id),
    );
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildLeaveWorkflowsQuery(params: LeaveWorkflowsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (typeof params.leave_type_id === "number" && params.leave_type_id > 0) {
    searchParams.set("leave_type_id", String(params.leave_type_id));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildEmployeePositionsQuery(params: EmployeePositionsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (typeof params.position_id === "number" && params.position_id > 0) {
    searchParams.set("position_id", String(params.position_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.assignment_type && params.assignment_type.trim()) {
    searchParams.set("assignment_type", params.assignment_type.trim());
  }
  if (typeof params.is_primary === "boolean") {
    searchParams.set("is_primary", String(params.is_primary));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildOnboardingWorkflowsQuery(params: OnboardingWorkflowsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildOnboardingRequestsQuery(params: OnboardingRequestsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildOffboardingRequestsQuery(params: OffboardingRequestsQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.offboarding_type && params.offboarding_type.trim()) {
    searchParams.set("offboarding_type", params.offboarding_type.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildOffboardingWorkflowsQuery(
  params: OffboardingWorkflowsQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildMyAttendancePunchesQuery(params: MyAttendancePunchesQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const sortBy = normalizeSortBy(params.sortBy);
  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }
  if (sortBy && (params.sortOrder === "ASC" || params.sortOrder === "DESC")) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employeeId === "number" && params.employeeId > 0) {
    searchParams.set("employeeId", String(params.employeeId));
  }
  if (typeof params.branchId === "number" && params.branchId > 0) {
    searchParams.set("branchId", String(params.branchId));
  }
  if (params.punchType) {
    searchParams.set("punchType", params.punchType);
  }
  if (params.validationStatus) {
    searchParams.set("validationStatus", params.validationStatus);
  }
  if (params.dateFrom && params.dateFrom.trim()) {
    searchParams.set("dateFrom", params.dateFrom.trim());
  }
  if (params.dateTo && params.dateTo.trim()) {
    searchParams.set("dateTo", params.dateTo.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildMyAttendanceHistoryQuery(params: MyAttendanceHistoryQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const sortBy = normalizeSortBy(params.sortBy);
  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }
  if (sortBy && (params.sortOrder === "ASC" || params.sortOrder === "DESC")) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (params.employee_no && params.employee_no.trim()) {
    searchParams.set("employee_no", params.employee_no.trim());
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  if (
    typeof params.organization_id === "number" &&
    params.organization_id > 0
  ) {
    searchParams.set("organization_id", String(params.organization_id));
  }
  const status = params.status?.trim() || params.attendance_status?.trim();
  if (status) {
    searchParams.set("status", status);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildMyAttendanceScheduleQuery(
  params: MyAttendanceScheduleQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  if (typeof params.days === "number" && params.days > 0) {
    searchParams.set("days", String(params.days));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildSelfServiceRequestQuery(params: SelfServiceRequestQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const sortBy = normalizeSortBy(params.sortBy);
  if (sortBy) {
    searchParams.set("sortBy", sortBy);
  }
  if (sortBy && (params.sortOrder === "ASC" || params.sortOrder === "DESC")) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.date_from && params.date_from.trim()) {
    searchParams.set("date_from", params.date_from.trim());
  }
  if (params.date_to && params.date_to.trim()) {
    searchParams.set("date_to", params.date_to.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildTeamAttendanceQuery(params: TeamAttendanceQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.date_from && params.date_from.trim()) {
    searchParams.set("date_from", params.date_from.trim());
  }
  if (params.date_to && params.date_to.trim()) {
    searchParams.set("date_to", params.date_to.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function extractUsersPagination(
  payload: unknown,
  fallbackPage: number,
  fallbackLimit: number,
) {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);
  const rootMeta = asRecord(root?.meta);
  const rootDataMeta = asRecord(rootData?.meta);
  const rootResultMeta = asRecord(rootResult?.meta);
  const rootPagination = asRecord(root?.pagination);
  const rootDataPagination = asRecord(rootData?.pagination);
  const rootResultPagination = asRecord(rootResult?.pagination);

  const page =
    readNumberFromRecord(root, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootResult, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootMeta, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootDataMeta, [
      "page",
      "currentPage",
      "current_page",
    ]) ??
    readNumberFromRecord(rootResultMeta, [
      "page",
      "currentPage",
      "current_page",
    ]) ??
    readNumberFromRecord(rootPagination, [
      "page",
      "currentPage",
      "current_page",
    ]) ??
    readNumberFromRecord(rootDataPagination, [
      "page",
      "currentPage",
      "current_page",
    ]) ??
    readNumberFromRecord(rootResultPagination, [
      "page",
      "currentPage",
      "current_page",
    ]) ??
    readNumberFromRecord(rootData, ["page", "currentPage", "current_page"]) ??
    fallbackPage;

  const limit =
    readNumberFromRecord(root, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootResult, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootMeta, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootDataMeta, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootResultMeta, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootPagination, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootDataPagination, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootResultPagination, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    readNumberFromRecord(rootData, [
      "limit",
      "perPage",
      "pageSize",
      "per_page",
      "itemsPerPage",
      "items_per_page",
    ]) ??
    fallbackLimit;

  const total =
    readNumberFromRecord(root, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootResult, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootMeta, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootDataMeta, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootResultMeta, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootPagination, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootDataPagination, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootResultPagination, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]) ??
    readNumberFromRecord(rootData, [
      "total",
      "totalItems",
      "total_items",
      "count",
    ]);

  const totalPages =
    readNumberFromRecord(root, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootResult, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootMeta, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootDataMeta, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootResultMeta, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootPagination, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootDataPagination, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootResultPagination, [
      "totalPages",
      "pageCount",
      "total_pages",
    ]) ??
    readNumberFromRecord(rootData, ["totalPages", "pageCount", "total_pages"]);

  return {
    page: Math.max(1, Math.floor(page)),
    limit: Math.max(1, Math.floor(limit)),
    total: total !== null ? Math.max(0, Math.floor(total)) : null,
    totalPages:
      totalPages !== null ? Math.max(1, Math.floor(totalPages)) : null,
  };
}

function normalizeSingle(payload: unknown): AdminRecord | null {
  const directList = asArray(payload);
  if (directList) {
    return directList[0] ?? null;
  }

  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  // Prefer the entity envelope itself when it already has an identity. Nested
  // relations (for example company.id) must not shadow the entity's own ID.
  if ("id" in record) {
    return record;
  }

  const nested = [
    record.data,
    record.result,
    record.item,
    record.user,
    record.company,
    ...getNestedRecords(record),
  ];
  for (const candidate of nested) {
    const value = asRecord(candidate);
    if (value) {
      return value;
    }
  }

  if (
    "id" in record ||
    "email" in record ||
    "name" in record ||
    "company_name" in record ||
    "device_name" in record ||
    "deviceName" in record ||
    "device_code" in record ||
    "deviceCode" in record ||
    "device_serial_number" in record ||
    "deviceSerialNumber" in record ||
    "device_model" in record ||
    "deviceModel" in record ||
    "door_name" in record ||
    "doorName" in record ||
    "door_no" in record ||
    "doorNo" in record ||
    "group_name" in record ||
    "groupName" in record ||
    "org_name" in record ||
    "orgName" in record ||
    "template_name" in record ||
    "templateName" in record
  ) {
    return record;
  }

  const list = normalizeList(payload);
  return list[0] ?? null;
}

function looksLikeEmployeeRecord(value: AdminRecord | null) {
  if (!value) {
    return false;
  }
  return (
    "employee_no" in value ||
    "employee_number" in value ||
    "employee_code" in value ||
    "branch_id" in value ||
    "department_id" in value ||
    "position_id" in value ||
    "company_user_id" in value ||
    "employment_status" in value ||
    "branch" in value ||
    "department" in value ||
    "position" in value
  );
}

/** Detect Excel/ZIP/binary bodies that must never be shown as UI error text. */
function looksLikeBinaryPayload(text: string): boolean {
  if (!text) return false;
  // XLSX / ZIP local file header
  if (text.startsWith("PK") || text.includes("[Content_Types].xml")) {
    return true;
  }
  const sample = text.slice(0, 800);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i);
    if (code === 0 || code < 9 || (code > 13 && code < 32)) {
      nonPrintable += 1;
    }
  }
  return sample.length > 0 && nonPrintable / sample.length > 0.04;
}

function isBinaryContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return /(?:excel|spreadsheet|ms-excel|octet-stream|zip|application\/vnd\.|multipart\/form-data)/i.test(
    contentType,
  );
}

const EMPLOYEE_NUMBER_CONFLICT_PATTERN =
  /UQ_employee_company_employee_no|employee number already exists|employee number is already in use|duplicate key value violates unique constraint ["']?[^"']*employee_no/i;

function humanizeConstraintMessage(text: string): string | null {
  if (
    /required workflow step at order \d+ has no eligible approver/i.test(text)
  ) {
    return "The onboarding workflow cannot start because a required step has no eligible approver. Assign a person or a role with members on that step, or save the employee without submitting onboarding.";
  }
  if (/already has an employee profile/i.test(text)) {
    return "This person already has an employee profile. Open the existing employee instead of creating another invite.";
  }
  if (
    /UQ_employee_company_employee_no/i.test(text) ||
    /duplicate key value violates unique constraint ["']?[^"']*employee_no/i.test(
      text,
    )
  ) {
    return "That employee number is already in use. Leave Employee Number blank to auto-assign the next number, or enter a unique number.";
  }
  if (
    /^UQ_[A-Za-z0-9_]+$/.test(text.trim()) ||
    /duplicate key value violates unique constraint/i.test(text)
  ) {
    return "A record with those details already exists.";
  }
  return null;
}

function sanitizeHumanMessage(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (looksLikeBinaryPayload(trimmed)) return fallback;
  const constraintMessage = humanizeConstraintMessage(trimmed);
  if (constraintMessage) return constraintMessage;
  // Cap length so accidental HTML/log dumps don't flood the UI
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}

function parseResponseBodyText(
  text: string,
  contentType: string | null,
): unknown {
  if (!text) return null;

  if (isBinaryContentType(contentType) || looksLikeBinaryPayload(text)) {
    return {
      message:
        "The server returned a file instead of a status. Try again, or download the report if available.",
      _binaryResponse: true,
    };
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: sanitizeHumanMessage(text, "Unexpected response from server."),
    };
  }
}

function collectValidationMessages(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [prefix ? `${prefix}: ${trimmed}` : trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectValidationMessages(entry, prefix));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const field =
    typeof record.property === "string"
      ? record.property
      : typeof record.field === "string"
        ? record.field
        : typeof record.path === "string"
          ? record.path
          : prefix;

  const directMessages = [
    record.message,
    record.messages,
    record.error,
    record.errors,
    record.constraints,
  ].flatMap((entry) => collectValidationMessages(entry, field));

  const childMessages = [record.children, record.validation].flatMap((entry) =>
    collectValidationMessages(entry, field),
  );

  if (directMessages.length || childMessages.length) {
    return [...directMessages, ...childMessages];
  }

  return Object.entries(record).flatMap(([key, entry]) => {
    if (["property", "field", "path"].includes(key)) {
      return [];
    }
    return collectValidationMessages(entry, field || key);
  });
}

function extractValidationMessage(payload: unknown) {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }

  const errors = asRecord(record.errors);
  const messages = [
    ...collectValidationMessages(errors?.validation),
    ...collectValidationMessages(record.validation),
    ...collectValidationMessages(errors),
  ]
    .map((entry) => sanitizeHumanMessage(entry, ""))
    .filter(Boolean);
  const uniqueMessages = Array.from(new Set(messages));
  if (uniqueMessages.length === 0) {
    return null;
  }
  return uniqueMessages.slice(0, 6).join(". ");
}

const GET_THROTTLE_MAX_RETRIES = 3;
const GET_THROTTLE_RETRY_CAP_MS = 10_000;

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) {
    return null;
  }
  const trimmed = header.trim();
  if (!trimmed) {
    return null;
  }
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(Math.round(asSeconds * 1000), GET_THROTTLE_RETRY_CAP_MS);
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.min(
      Math.max(asDate - Date.now(), 0),
      GET_THROTTLE_RETRY_CAP_MS,
    );
  }
  return null;
}

async function waitForRetry(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function extractMessage(payload: unknown, status: number) {
  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  const record = asRecord(payload);
  if (!record) {
    return `Request failed with status ${status}`;
  }
  const validationMessage = extractValidationMessage(payload);
  if (validationMessage) {
    return validationMessage;
  }
  const candidate = record.message;
  if (typeof candidate === "string" && candidate.trim()) {
    return sanitizeHumanMessage(
      candidate,
      `Request failed with status ${status}`,
    );
  }
  if (Array.isArray(candidate)) {
    const normalized = candidate
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
      .map((entry) => sanitizeHumanMessage(entry, ""))
      .filter(Boolean);
    if (normalized.length > 0) {
      return normalized.join(". ");
    }
  }
  const errorCandidate = record.error;
  if (typeof errorCandidate === "string" && errorCandidate.trim()) {
    return sanitizeHumanMessage(
      errorCandidate,
      `Request failed with status ${status}`,
    );
  }
  const detailCandidate = record.details;
  if (typeof detailCandidate === "string" && detailCandidate.trim()) {
    return sanitizeHumanMessage(
      detailCandidate,
      `Request failed with status ${status}`,
    );
  }
  return `Request failed with status ${status}`;
}

export function adminRequest<T>(
  path: string,
  options?: AdminRequestOptions,
): Promise<T>;
export function adminRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options?: AdminRequestOptions,
): Promise<z.output<S>>;
export async function adminRequest<T>(
  path: string,
  schemaOrOptions: z.ZodType | AdminRequestOptions = {},
  schemaOptions: AdminRequestOptions = {},
): Promise<T> {
  const schema = schemaOrOptions instanceof z.ZodType ? schemaOrOptions : null;
  const options: AdminRequestOptions = schema
    ? schemaOptions
    : (schemaOrOptions as AdminRequestOptions);
  const {
    method = "GET",
    token,
    body,
    signal,
    cacheTtlMs = 0,
    dedupe = true,
    invalidateCache = true,
  } = options;
  const requestKey = getAdminRequestKey(path, method, token, body);
  const canReuseGetRequest = method === "GET" && body === undefined;
  const requestGeneration = adminCacheGeneration;

  if (signal?.aborted) {
    throw createAbortError();
  }

  if (method !== "GET" && invalidateCache) {
    invalidateAdminGetCache();
  }

  if (canReuseGetRequest && cacheTtlMs > 0) {
    const cached = adminResponseCache.get(requestKey);
    if (cached && cached.expiresAt > Date.now()) {
      return (
        schema ? parseAdminContract(schema, cached.value) : cached.value
      ) as T;
    }
    if (cached) {
      adminResponseCache.delete(requestKey);
    }
  }

  if (canReuseGetRequest && dedupe && !signal) {
    const inflight = inflightAdminRequests.get(requestKey);
    if (inflight) {
      if (process.env.NODE_ENV === "development") {
        console.debug(`[admin-api] duplicate GET deduped for ${path}`);
      }
      return inflight as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    let attempt = 0;
    while (true) {
      const response = await fetch(buildUrl(path), {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal,
      });

      if (
        response.status === 429 &&
        method === "GET" &&
        attempt < GET_THROTTLE_MAX_RETRIES
      ) {
        attempt += 1;
        await response.text().catch(() => "");
        const waitMs =
          parseRetryAfterMs(response.headers.get("retry-after")) ??
          Math.min(400 * 2 ** (attempt - 1), 4_000);
        await waitForRetry(waitMs, signal);
        continue;
      }

      const contentType = response.headers.get("content-type");
      const text = await response.text();
      const payload = parseResponseBodyText(text, contentType);

      if (canReuseGetRequest && requestGeneration !== adminCacheGeneration) {
        throw createAbortError();
      }

      if (!response.ok) {
        const message = extractMessage(payload, response.status);
        notifyPasswordChangeRequired(message);
        const error = new Error(message) as Error & {
          status?: number;
          payload?: unknown;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
      }

      if (canReuseGetRequest && cacheTtlMs > 0) {
        adminResponseCache.set(requestKey, {
          expiresAt: Date.now() + cacheTtlMs,
          value: payload,
        });
      }

      return (schema ? parseAdminContract(schema, payload) : payload) as T;
    }
  })();

  if (canReuseGetRequest && dedupe && !signal) {
    inflightAdminRequests.set(requestKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (inflightAdminRequests.get(requestKey) === requestPromise) {
      inflightAdminRequests.delete(requestKey);
    }
  }
}

function parseAdminContract<S extends z.ZodType>(
  schema: S,
  payload: unknown,
): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ContractError(
      "The service response does not match its expected contract.",
      result.error.issues,
    );
  }
  return result.data;
}

export type PerformanceKpiCategory = {
  id: number;
  name: string;
  description?: string | null;
};

function unwrapPerformanceKpiCategory(value: unknown): PerformanceKpiCategory {
  const record =
    value && typeof value === "object" ? (value as AdminRecord) : {};
  const item = record.data ?? record.result ?? record.item ?? record;
  return item as PerformanceKpiCategory;
}

export async function listPerformanceKpiCategories(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/kpi-categories",
    { token },
  );
  const record =
    payload && typeof payload === "object" ? (payload as AdminRecord) : {};
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.result)
        ? record.result
        : Array.isArray(record.items)
          ? record.items
          : [];
  return items.map(unwrapPerformanceKpiCategory);
}

export async function createPerformanceKpiCategory(
  token: string,
  data: Pick<PerformanceKpiCategory, "name" | "description">,
) {
  return unwrapPerformanceKpiCategory(
    await adminRequest<unknown>("/api/performance/kpi-categories", {
      method: "POST",
      token,
      body: data,
    }),
  );
}

export async function updatePerformanceKpiCategory(
  token: string,
  id: number,
  data: Pick<PerformanceKpiCategory, "name" | "description">,
) {
  return unwrapPerformanceKpiCategory(
    await adminRequest<unknown>(`/api/performance/kpi-categories/${id}`, {
      method: "PATCH",
      token,
      body: data,
    }),
  );
}

export async function deletePerformanceKpiCategory(token: string, id: number) {
  return adminRequest<unknown>(`/api/performance/kpi-categories/${id}`, {
    method: "DELETE",
    token,
  });
}

export interface ListRequestOptions {
  signal?: AbortSignal;
  cacheTtlMs?: number;
  dedupe?: boolean;
}

function dedupeAdminRecordsById(rows: AdminRecord[]): AdminRecord[] {
  const seen = new Set<string>();
  const out: AdminRecord[] = [];
  for (const row of rows) {
    const id =
      row.id ??
      row.role_id ??
      row.roleId ??
      row.permission_id ??
      row.permissionId;
    if (id === null || id === undefined || id === "") {
      out.push(row);
      continue;
    }
    const key = String(id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return out;
}

export interface CatalogQueryParams {
  page?: number;
  limit?: number;
  search?: string;
}

function isRoleCatalogRecord(row: AdminRecord): boolean {
  if (
    typeof row.is_system_generated === "boolean" ||
    typeof row.isSystemGenerated === "boolean"
  ) {
    return true;
  }
  if (
    typeof row.display_name === "string" ||
    typeof row.displayName === "string"
  ) {
    return true;
  }
  if (
    typeof row.company_scope_key === "number" ||
    typeof row.companyScopeKey === "number"
  ) {
    return true;
  }
  const name = typeof row.name === "string" ? row.name.trim() : "";
  return Boolean(name) && !name.includes(":");
}

function roleCatalogHaystack(row: AdminRecord): string {
  const parts = [
    row.name,
    row.display_name,
    row.displayName,
    row.description,
    row.title,
    row.code,
    row.key,
    row.id,
  ];
  return parts
    .filter(
      (value) => value !== null && value !== undefined && String(value).trim(),
    )
    .join(" ")
    .toLowerCase();
}

function normalizeRoleCatalog(payload: unknown): AdminRecord[] {
  const record = asRecord(payload);
  const nested = record
    ? (asRecord(record.data) ??
      asRecord(record.result) ??
      asRecord(record.payload))
    : null;
  for (const candidate of [record, nested]) {
    if (!candidate) continue;
    const fromRolesKey = asArray(candidate.roles);
    if (fromRolesKey && fromRolesKey.length > 0) {
      return fromRolesKey;
    }
  }

  const list = normalizeList(payload);
  const roleLike = list.filter(isRoleCatalogRecord);
  return roleLike.length > 0 ? roleLike : list;
}

/**
 * GET /api/roles has no documented query params. The Roles tab must not send
 * page/limit/search — those can come back as `{ total: 10, items: [] }`.
 */
export async function listRolesCatalog(
  token: string,
  params: CatalogQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const payload = await adminRequest<unknown>("/api/roles", {
    token,
    signal: options.signal,
    cacheTtlMs:
      options.cacheTtlMs === undefined
        ? env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS
        : options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const all = dedupeAdminRecordsById(normalizeRoleCatalog(payload));
  const search = params.search?.trim().toLowerCase() ?? "";
  const filtered = search
    ? all.filter((row) => roleCatalogHaystack(row).includes(search))
    : all;
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit =
    params.limit && params.limit > 0
      ? Math.min(params.limit, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100)
      : Math.max(filtered.length, 1);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  return {
    rows: filtered.slice(start, start + limit),
    page: safePage,
    limit,
    total,
    totalPages,
  };
}

/**
 * One backend page of roles or permissions. Do not loop this from the UI —
 * GET /api/roles and GET /api/permissions are already paginated and throttled.
 */
export async function listResourcePage(
  resource: AdminResourceKey,
  token: string,
  params: CatalogQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  if (resource === "roles") {
    return listRolesCatalog(token, params, options);
  }
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit =
    params.limit && params.limit > 0
      ? Math.min(params.limit, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100)
      : 20;
  const query = buildUsersQuery({
    page,
    limit,
    search: params.search,
  });
  const payload = await adminRequest<unknown>(
    `${RESOURCE_PATHS[resource]}${query}`,
    {
      token,
      signal: options.signal,
      cacheTtlMs:
        options.cacheTtlMs === undefined
          ? env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS
          : options.cacheTtlMs,
      dedupe: options.dedupe,
    },
  );
  const rows = dedupeAdminRecordsById(normalizeList(payload));
  const pagination = extractUsersPagination(payload, page, limit);
  return { rows, ...pagination };
}

/**
 * Fetch every page of a catalog resource (roles/permissions/…).
 * Prefer `listResourcePage` for the Roles/Permissions tabs so the backend
 * throttle is not hit by client-side page walking.
 */
export async function listResource(
  resource: AdminResourceKey,
  token: string,
  options: {
    pageAll?: boolean;
    pageSize?: number;
    maxPages?: number;
    cacheTtlMs?: number;
  } = {},
) {
  const pageAll = options.pageAll !== false;
  const pageSize =
    options.pageSize && options.pageSize > 0
      ? Math.min(options.pageSize, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100)
      : Math.min(100, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100);
  const maxPages =
    options.maxPages && options.maxPages > 0 ? options.maxPages : 50;
  const cacheTtlMs =
    options.cacheTtlMs === undefined
      ? env.NEXT_PUBLIC_LIST_CACHE_TTL_LONG_MS
      : options.cacheTtlMs;

  if (!pageAll) {
    const payload = await adminRequest<unknown>(RESOURCE_PATHS[resource], {
      token,
      cacheTtlMs,
    });
    return dedupeAdminRecordsById(normalizeList(payload));
  }

  const collected: AdminRecord[] = [];
  let page = 1;

  while (page <= maxPages) {
    // Only page/limit — avoid sortBy so backends that don't index roles by created_at still work.
    const query = buildUsersQuery({ page, limit: pageSize });
    let payload: unknown;
    try {
      payload = await adminRequest<unknown>(
        `${RESOURCE_PATHS[resource]}${query}`,
        {
          token,
          cacheTtlMs,
        },
      );
    } catch (errorObject) {
      if (collected.length > 0) {
        break;
      }
      throw errorObject;
    }
    const rows = normalizeList(payload);
    const pagination = extractUsersPagination(payload, page, pageSize);
    collected.push(...rows);

    const reachedEnd =
      rows.length === 0 ||
      (pagination.totalPages !== null
        ? page >= pagination.totalPages
        : pagination.total !== null
          ? collected.length >= pagination.total
          : rows.length < pageSize);

    if (reachedEnd) {
      break;
    }
    page += 1;
  }

  return dedupeAdminRecordsById(collected);
}

export async function listAllResources(
  token: string,
): Promise<AdminResourceCollections> {
  const [users, roles, permissions, companies] = await Promise.all([
    listResource("users", token).catch(() => []),
    listResource("roles", token).catch(() => []),
    listResource("permissions", token).catch(() => []),
    listResource("companies", token).catch(() => []),
  ]);

  return { users, roles, permissions, companies };
}

export async function listUsers(
  token: string,
  params: UsersQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildUsersQuery(params);
  const payload = await adminRequest<unknown>(`/api/users${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  // Flatten 2FA flags so UI always has consistent top-level fields regardless of API naming.
  const rows = normalizeList(payload).map((row) =>
    withNormalizedTwoFactorFields(row),
  );
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listNotifications(
  token: string,
  params: NotificationQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildNotificationsQuery(params);
  const payload = await adminRequest<unknown>(`/api/notifications${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getUnreadNotificationsCount(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/notifications/unread-count",
    { token },
  );
  const record = asRecord(payload);
  if (!record) {
    return 0;
  }
  return (
    readNumber(record.unread_count) ??
    readNumber(record.unreadCount) ??
    readNumber(record.count) ??
    readNumber(record.total) ??
    0
  );
}

export async function markNotificationAsRead(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(`/api/notifications/${id}/read`, {
    method: "PATCH",
    token,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function markNotificationAsSeen(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(`/api/notifications/${id}/seen`, {
    method: "PATCH",
    token,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function markAllNotificationsAsRead(token: string) {
  return adminRequest<unknown>("/api/notifications/read-all", {
    method: "PATCH",
    token,
  });
}

export async function deleteNotification(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/notifications/${id}`, {
    method: "DELETE",
    token,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function createTestNotification(
  token: string,
  data: CreateTestNotificationInput | AdminRecord,
) {
  const payload = await adminRequest<unknown>("/api/notifications/test", {
    method: "POST",
    token,
    body: data,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function listNotificationChannelSettings(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/notifications/channel-settings",
    { token },
  );
  return normalizeList(payload) as NotificationChannelSetting[];
}

export async function getNotificationChannelSetting(
  token: string,
  channel: string,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/channel-settings/${encodeURIComponent(channel)}`,
    {
      token,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationChannelSetting | null) ??
    (asRecord(payload) as NotificationChannelSetting | null)
  );
}

export async function updateNotificationChannelSetting(
  token: string,
  channel: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/channel-settings/${encodeURIComponent(channel)}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationChannelSetting | null) ??
    (asRecord(payload) as NotificationChannelSetting | null)
  );
}

export async function listNotificationChannelRegistry(
  token: string,
  params: NotificationChannelRegistryQueryParams = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/channel-registry${buildNotificationChannelRegistryQuery(params)}`,
    { token },
  );
  return normalizeList(payload) as NotificationChannelRegistryItem[];
}

export async function listPlatformNotificationChannelRegistry(
  token: string,
  params: NotificationChannelRegistryQueryParams = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/platform/channel-registry${buildNotificationChannelRegistryQuery(params)}`,
    { token },
  );
  return normalizeList(payload) as NotificationChannelRegistryItem[];
}

export async function getNotificationChannelRegistryItem(
  token: string,
  channel: string,
  code: string,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/channel-registry/${encodeURIComponent(channel)}/${encodeURIComponent(code)}`,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationChannelRegistryItem | null) ??
    (asRecord(payload) as NotificationChannelRegistryItem | null)
  );
}

export async function updateNotificationChannelRegistryItem(
  token: string,
  channel: string,
  code: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/channel-registry/${encodeURIComponent(channel)}/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationChannelRegistryItem | null) ??
    (asRecord(payload) as NotificationChannelRegistryItem | null)
  );
}

export async function updatePlatformNotificationChannelRegistryItem(
  token: string,
  channel: string,
  code: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/platform/channel-registry/${encodeURIComponent(channel)}/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationChannelRegistryItem | null) ??
    (asRecord(payload) as NotificationChannelRegistryItem | null)
  );
}

export async function listNotificationTemplates(
  token: string,
  params: NotificationTemplateQueryParams = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/templates${buildNotificationTemplateQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload) as NotificationTemplateItem[];
}

export async function getNotificationTemplate(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/templates/${id}`,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationTemplateItem | null) ??
    (asRecord(payload) as NotificationTemplateItem | null)
  );
}

export async function createNotificationTemplate(
  token: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>("/api/notifications/templates", {
    method: "POST",
    token,
    body: data,
  });
  return (
    (normalizeSingle(payload) as NotificationTemplateItem | null) ??
    (asRecord(payload) as NotificationTemplateItem | null)
  );
}

export async function updateNotificationTemplate(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/templates/${id}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationTemplateItem | null) ??
    (asRecord(payload) as NotificationTemplateItem | null)
  );
}

export async function listNotificationRules(
  token: string,
  params: NotificationRuleQueryParams = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/rules${buildNotificationRuleQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload) as NotificationRuleItem[];
}

export async function getNotificationRule(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/rules/${id}`,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationRuleItem | null) ??
    (asRecord(payload) as NotificationRuleItem | null)
  );
}

export async function createNotificationRule(token: string, data: AdminRecord) {
  const payload = await adminRequest<unknown>("/api/notifications/rules", {
    method: "POST",
    token,
    body: data,
  });
  return (
    (normalizeSingle(payload) as NotificationRuleItem | null) ??
    (asRecord(payload) as NotificationRuleItem | null)
  );
}

export async function updateNotificationRule(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/rules/${id}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationRuleItem | null) ??
    (asRecord(payload) as NotificationRuleItem | null)
  );
}

export async function listNotificationDeliveries(
  token: string,
  params: NotificationDeliveryQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildNotificationDeliveriesQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/notifications/deliveries${query}`,
    {
      token,
      signal: options.signal,
      cacheTtlMs: options.cacheTtlMs,
      dedupe: options.dedupe,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getNotificationDelivery(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/deliveries/${id}`,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationDeliveryLog | null) ??
    (asRecord(payload) as NotificationDeliveryLog | null)
  );
}

export async function listNotificationMailLogs(
  token: string,
  params: NotificationMailLogQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildNotificationMailLogsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/notifications/mail-logs${query}`,
    {
      token,
      signal: options.signal,
      cacheTtlMs: options.cacheTtlMs,
      dedupe: options.dedupe,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getNotificationMailLog(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/mail-logs/${id}`,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationMailLog | null) ??
    (asRecord(payload) as NotificationMailLog | null)
  );
}

export async function retryNotificationMailLog(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/mail-logs/${id}/retry`,
    {
      method: "POST",
      token,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationMailLog | null) ??
    (asRecord(payload) as NotificationMailLog | null)
  );
}

export async function listPlatformNotificationChannelSettings(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/notifications/platform/channel-settings",
    { token },
  );
  return normalizeList(payload) as NotificationChannelSetting[];
}

export async function updatePlatformNotificationChannelSetting(
  token: string,
  channel: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/platform/channel-settings/${encodeURIComponent(channel)}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationChannelSetting | null) ??
    (asRecord(payload) as NotificationChannelSetting | null)
  );
}

export async function listPlatformNotificationMailLogs(
  token: string,
  params: NotificationMailLogQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildNotificationMailLogsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/notifications/platform/mail-logs${query}`,
    {
      token,
      signal: options.signal,
      cacheTtlMs: options.cacheTtlMs,
      dedupe: options.dedupe,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getPlatformNotificationMailLog(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/platform/mail-logs/${id}`,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationMailLog | null) ??
    (asRecord(payload) as NotificationMailLog | null)
  );
}

export async function retryPlatformNotificationMailLog(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/notifications/platform/mail-logs/${id}/retry`,
    {
      method: "POST",
      token,
    },
  );
  return (
    (normalizeSingle(payload) as NotificationMailLog | null) ??
    (asRecord(payload) as NotificationMailLog | null)
  );
}

export async function listEmployees(
  token: string,
  params: EmployeesQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildEmployeesQuery(params);
  const payload = await adminRequest<unknown>(`/api/employees${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAllEmployees(
  token: string,
  params: EmployeesQueryParams = {},
  options: ListRequestOptions & { pageSize?: number; maxPages?: number } = {},
): Promise<AdminRecord[]> {
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? 100),
    env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100,
  );
  const maxPages = Math.max(1, options.maxPages ?? 50);
  const collected: AdminRecord[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listEmployees(
      token,
      {
        ...params,
        page,
        limit: pageSize,
        search: undefined,
      },
      options,
    );
    collected.push(...result.rows);
    const reachedEnd =
      result.rows.length === 0 ||
      result.rows.length < pageSize ||
      (result.totalPages !== null && page >= result.totalPages) ||
      (result.total !== null && collected.length >= result.total);
    if (reachedEnd) break;
  }

  return dedupeAdminRecordsById(collected);
}

function buildEmployeeImportHistoryQuery(
  params: { page?: number; limit?: number } = {},
) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function submitEmployeeImportRequest(
  path: string,
  token: string,
  data: EmployeeImportRequest,
  file: File | Blob,
  fileName?: string,
) {
  const formData = new FormData();
  formData.set("import_mode", data.import_mode);
  formData.set(
    "process_valid_rows_only",
    data.process_valid_rows_only === false ? "false" : "true",
  );
  if (file instanceof File) {
    formData.set("file", file);
  } else {
    formData.set("file", file, fileName?.trim() || "employee-import.xlsx");
  }

  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    cache: "no-store",
  });

  invalidateAdminGetCache();

  const contentType = response.headers.get("content-type");
  // Import endpoints must return JSON status. Binary/xlsx is never a valid status body.
  if (isBinaryContentType(contentType)) {
    // Drain body so the connection can close cleanly.
    await response.arrayBuffer().catch(() => undefined);
    if (!response.ok) {
      throw new Error(
        "Import failed. The server returned an error file instead of a status.",
      );
    }
    throw new Error(
      "Unexpected file response from import. Expected a status summary.",
    );
  }

  const text = await response.text();
  const payload = parseResponseBodyText(text, contentType);

  if (!response.ok) {
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  // Successful HTTP but body is binary disguised as text → reject for UI safety.
  const record = asRecord(payload);
  if (record?._binaryResponse === true) {
    throw new Error(
      typeof record.message === "string"
        ? record.message
        : "Unexpected file response from import. Expected a status summary.",
    );
  }

  return asRecord(payload) ?? normalizeSingle(payload);
}

export async function previewEmployeeImport(
  token: string,
  data: EmployeeImportRequest,
  file: File | Blob,
  fileName?: string,
) {
  return submitEmployeeImportRequest(
    "/api/employees/import/preview",
    token,
    data,
    file,
    fileName,
  );
}

export async function getEmployeeImportPreview(token: string, batchId: string) {
  const payload = await adminRequest<unknown>(
    `/api/employees/import/${encodeURIComponent(batchId)}/preview`,
    {
      token,
    },
  );
  return asRecord(payload) ?? normalizeSingle(payload);
}

export async function startEmployeeImport(
  token: string,
  data: EmployeeImportRequest,
  file: File | Blob,
  fileName?: string,
) {
  return submitEmployeeImportRequest(
    "/api/employees/import",
    token,
    data,
    file,
    fileName,
  );
}

export async function confirmEmployeeImport(
  token: string,
  data: EmployeeImportConfirmRequest,
) {
  const payload = await adminRequest<unknown>("/api/employees/import/confirm", {
    method: "POST",
    token,
    body: data,
  });
  return asRecord(payload) ?? normalizeSingle(payload);
}

export type EmployeeImportResultResponse =
  | {
      type: "json";
      payload: AdminRecord | null;
    }
  | {
      type: "file";
      blob: Blob;
      filename: string;
      contentType: string | null;
    };

function filenameFromContentDisposition(
  disposition: string | null,
  fallback: string,
) {
  const value = disposition ?? "";
  const filenameMatch = value.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename = filenameMatch?.[1] ?? filenameMatch?.[2] ?? fallback;
  try {
    return decodeURIComponent(rawFilename);
  } catch {
    return rawFilename;
  }
}

function isZipOrXlsxMagic(bytes: Uint8Array) {
  // ZIP / XLSX local file header: PK\x03\x04 (or empty PK\x05\x06)
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** Fetch the JSON status/summary for an employee import batch. */
export async function getEmployeeImportResult(
  token: string,
  batchId: string,
): Promise<EmployeeImportResultResponse> {
  const response = await fetch(
    buildUrl(`/api/employees/import/${encodeURIComponent(batchId)}/result`),
    {
      method: "GET",
      headers: {
        accept: "application/json, */*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  const contentType = response.headers.get("content-type");
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const looksLikeFile =
    isBinaryContentType(contentType) || isZipOrXlsxMagic(bytes);

  if (!response.ok) {
    if (looksLikeFile && buffer.byteLength > 0) {
      // Some APIs return an error workbook with a non-2xx status.
      return {
        type: "file",
        blob: new Blob([buffer], {
          type:
            contentType ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        filename: filenameFromContentDisposition(
          response.headers.get("content-disposition"),
          `employee-import-result-${batchId}.xlsx`,
        ),
        contentType,
      };
    }

    const text = new TextDecoder().decode(buffer);
    const payload = parseResponseBodyText(text, contentType);
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (looksLikeFile) {
    return {
      type: "file",
      blob: new Blob([buffer], {
        type:
          contentType ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename: filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        `employee-import-result-${batchId}.xlsx`,
      ),
      contentType,
    };
  }

  const text = new TextDecoder().decode(buffer);
  const payload = parseResponseBodyText(text, contentType);
  const record = asRecord(payload);

  if (record?._binaryResponse === true) {
    // Body looked binary after text decode; re-wrap original bytes as a file.
    return {
      type: "file",
      blob: new Blob([buffer], {
        type:
          contentType ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename: filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        `employee-import-result-${batchId}.xlsx`,
      ),
      contentType,
    };
  }

  return {
    type: "json",
    payload: record ?? normalizeSingle(payload),
  };
}

/** Download the import error/result report workbook for a batch. */
export async function downloadEmployeeImportErrorsReport(
  token: string,
  batchId: string,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(
      `/api/employees/import/${encodeURIComponent(batchId)}/errors/download`,
    ),
    {
      method: "GET",
      headers: {
        accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  const contentType = response.headers.get("content-type");
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const looksLikeFile =
    isBinaryContentType(contentType) || isZipOrXlsxMagic(bytes);

  if (!response.ok) {
    const text = new TextDecoder().decode(buffer);
    const payload = parseResponseBodyText(text, contentType);
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (!looksLikeFile) {
    const text = new TextDecoder().decode(buffer);
    const payload = parseResponseBodyText(text, contentType);
    const record = asRecord(payload);
    throw new Error(
      typeof record?.message === "string"
        ? record.message
        : "Unexpected response when downloading the import report.",
    );
  }

  return {
    blob: new Blob([buffer], {
      type:
        contentType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: filenameFromContentDisposition(
      response.headers.get("content-disposition"),
      `employee-import-result-${batchId}.xlsx`,
    ),
    contentType,
  };
}

/** Backward-compatible alias; this endpoint downloads the error workbook route. */
export async function downloadEmployeeImportResult(
  token: string,
  batchId: string,
) {
  return downloadEmployeeImportErrorsReport(token, batchId);
}

export async function listEmployeeImportHistory(
  token: string,
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildEmployeeImportHistoryQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/employees/import/history${query}`,
    {
      token,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function downloadEmployeeImportTemplate(
  token: string,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(buildUrl("/api/employees/import/template"), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? "employee-import-template.xlsx";
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function listDepartments(
  token: string,
  params: DepartmentsQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildDepartmentsQuery(params);
  const payload = await adminRequest<unknown>(`/api/departments${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listBranches(
  token: string,
  params: BranchesQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildBranchesQuery(params);
  const payload = await adminRequest<unknown>(`/api/branches${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listPositions(
  token: string,
  params: PositionsQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildPositionsQuery(params);
  const payload = await adminRequest<unknown>(`/api/positions${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listEmployeeGrades(token: string) {
  const payload = await adminRequest<unknown>("/api/employee-grades", {
    token,
  });
  return normalizeList(payload);
}

export async function getEmployeeGrade(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/employee-grades/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createEmployeeGrade(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/employee-grades", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchEmployeeGrade(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employee-grades/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteEmployeeGrade(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/employee-grades/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function getEmployeeNumbering(token: string) {
  const payload = await adminRequest<unknown>("/api/employee-numbering", {
    token,
  });
  return normalizeSingle(payload);
}

export async function updateEmployeeNumbering(
  token: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>("/api/employee-numbering", {
    method: "PUT",
    token,
    body: data,
  });
  return normalizeSingle(payload);
}

export async function listCostCenters(token: string) {
  const payload = await adminRequest<unknown>("/api/cost-centers", {
    token,
  });
  return normalizeList(payload);
}

export async function getCostCenter(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/cost-centers/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createCostCenter(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/cost-centers", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchCostCenter(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/cost-centers/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteCostCenter(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/cost-centers/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listLeaveTypes(
  token: string,
  params: LeaveTypesQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveTypesQuery(params);
  const payload = await adminRequest<unknown>(`/api/leave/types${query}`, {
    token,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAllLeaveTypes(
  token: string,
  params: LeaveTypesQueryParams = {},
  options: ListRequestOptions & { pageSize?: number; maxPages?: number } = {},
): Promise<PaginatedUsersResult> {
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? 100),
    env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100,
  );
  const maxPages = Math.max(1, options.maxPages ?? 50);
  const rows: AdminRecord[] = [];
  let total: number | null = null;
  let totalPages: number | null = null;
  let reachedEnd = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listLeaveTypes(token, {
      ...params,
      page,
      limit: pageSize,
    });
    rows.push(...result.rows);
    total ??= result.total;
    totalPages ??= result.totalPages;
    if (
      result.rows.length === 0 ||
      result.rows.length < pageSize ||
      (result.totalPages !== null && page >= result.totalPages) ||
      (result.total !== null && rows.length >= result.total)
    ) {
      reachedEnd = true;
      break;
    }
  }
  if (!reachedEnd)
    throw new Error(
      `Leave type catalog exceeds the ${pageSize * maxPages} row fetch limit.`,
    );
  return {
    rows,
    page: 1,
    limit: pageSize,
    total: total ?? rows.length,
    totalPages: totalPages ?? 1,
  };
}

export async function listLeaveRequests(
  token: string,
  params: LeaveRequestsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveRequestsQuery(params);
  const payload = await adminRequest<unknown>(`/api/leave/requests${query}`, {
    token,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAllLeaveRequests(
  token: string,
  params: LeaveRequestsQueryParams = {},
  options: ListRequestOptions & { pageSize?: number; maxPages?: number } = {},
): Promise<PaginatedUsersResult> {
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? 100),
    env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100,
  );
  const maxPages = Math.max(1, options.maxPages ?? 50);
  const rows: AdminRecord[] = [];
  let total: number | null = null;
  let totalPages: number | null = null;
  let reachedEnd = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listLeaveRequests(token, {
      ...params,
      page,
      limit: pageSize,
    });
    rows.push(...result.rows);
    total ??= result.total;
    totalPages ??= result.totalPages;
    if (
      result.rows.length === 0 ||
      result.rows.length < pageSize ||
      (result.totalPages !== null && page >= result.totalPages) ||
      (result.total !== null && rows.length >= result.total)
    ) {
      reachedEnd = true;
      break;
    }
  }
  if (!reachedEnd)
    throw new Error(
      `Leave request report exceeds the ${pageSize * maxPages} row export limit. Narrow the date range and try again.`,
    );
  return {
    rows,
    page: 1,
    limit: pageSize,
    total: total ?? rows.length,
    totalPages: totalPages ?? 1,
  };
}

export async function listLeaveTeamCalendar(
  token: string,
  fromDate: string,
  toDate: string,
): Promise<{ entries: LeaveTeamCalendarEntry[]; teamMemberCount: number }> {
  const searchParams = new URLSearchParams({
    from_date: fromDate,
    to_date: toDate,
  });
  const payload = await adminRequest<unknown>(
    `/api/leave/team-calendar?${searchParams.toString()}`,
    { token, cacheTtlMs: 0 },
  );
  const rows = normalizeList(payload).map((row) => ({
    request_id: Number(row.request_id ?? row.id),
    employee_id: Number(row.employee_id),
    employee_name: String(row.employee_name ?? "Employee"),
    leave_type: String(row.leave_type ?? "Leave"),
    start_date: String(row.start_date ?? ""),
    end_date: String(row.end_date ?? ""),
    total_days: Number(row.total_days ?? 0),
    duration_type: String(row.duration_type ?? "full_day"),
    status: String(row.status ?? "in_review"),
  }));
  const root = asRecord(payload);
  const meta = asRecord(root?.meta);
  return {
    entries: rows,
    teamMemberCount: Number(meta?.team_member_count ?? 0),
  };
}

export async function listLeaveBalances(
  token: string,
  params: LeaveBalancesQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveBalancesQuery(params);
  const payload = await adminRequest<unknown>(`/api/leave/balances${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAllLeaveBalances(
  token: string,
  params: LeaveBalancesQueryParams = {},
  options: ListRequestOptions & { pageSize?: number; maxPages?: number } = {},
): Promise<PaginatedUsersResult> {
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? 100),
    env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100,
  );
  const maxPages = Math.max(1, options.maxPages ?? 50);
  const collected: AdminRecord[] = [];
  let total: number | null = null;
  let totalPages: number | null = null;
  let completedAllPages = false;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listLeaveBalances(
      token,
      {
        ...params,
        page,
        limit: pageSize,
      },
      options,
    );
    collected.push(...result.rows);
    if (total === null && result.total !== null) {
      total = result.total;
    }
    if (totalPages === null && result.totalPages !== null) {
      totalPages = result.totalPages;
    }
    const reachedEnd =
      result.rows.length === 0 ||
      result.rows.length < pageSize ||
      (result.totalPages !== null && page >= result.totalPages) ||
      (result.total !== null && collected.length >= result.total);
    if (reachedEnd) {
      completedAllPages = true;
      break;
    }
  }
  if (!completedAllPages)
    throw new Error(
      `Leave balance report exceeds the ${pageSize * maxPages} employee export limit. Narrow the filters and try again.`,
    );

  const rows = collected.flatMap((row) => {
    const nestedBalances = asArray(row.leave_balances ?? row.leaveBalances);
    if (!nestedBalances) {
      return [row];
    }

    const employee = asRecord(row.employee) ?? asRecord(row.Employee);
    const employeeId = readNumberFromRecord(employee, [
      "id",
      "employee_id",
      "employeeId",
    ]);

    return nestedBalances.map((balance) => ({
      ...balance,
      ...(balance.employee === undefined && employee ? { employee } : {}),
      ...(balance.employee_id === undefined && employeeId !== null
        ? { employee_id: employeeId }
        : {}),
    }));
  });

  return {
    rows,
    page: 1,
    limit: rows.length || pageSize,
    total: rows.length,
    totalPages: 1,
  };
}

export async function listLeaveHolidays(
  token: string,
  params: LeaveHolidaysQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveHolidaysQuery(params);
  const payload = await adminRequest<unknown>(`/api/leave/holidays${query}`, {
    token,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listLeavePolicies(
  token: string,
  params: LeavePoliciesQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeavePoliciesQuery(params);
  const payload = await adminRequest<unknown>(`/api/leave/policies${query}`, {
    token,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listLeaveWorkflows(
  token: string,
  params: LeaveWorkflowsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveWorkflowsQuery(params);
  const payload = await adminRequest<unknown>(`/api/leave/workflows${query}`, {
    token,
  });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listOnboardingWorkflows(
  token: string,
  params: OnboardingWorkflowsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildOnboardingWorkflowsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/onboarding/workflows${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listOnboardingRequests(
  token: string,
  params: OnboardingRequestsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildOnboardingRequestsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listOffboardingRequests(
  token: string,
  params: OffboardingRequestsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildOffboardingRequestsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listOffboardingWorkflows(
  token: string,
  params: OffboardingWorkflowsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildOffboardingWorkflowsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/offboarding/workflows${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

/** Shared query string for attendance list endpoints (date range, employee, status, etc.). */
function buildAttendanceQuery(params: AttendanceQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (typeof params.device_id === "number" && params.device_id > 0) {
    searchParams.set("device_id", String(params.device_id));
  }
  if (params.employee_no && params.employee_no.trim()) {
    searchParams.set("employee_no", params.employee_no.trim());
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  if (
    typeof params.organization_id === "number" &&
    params.organization_id > 0
  ) {
    searchParams.set("organization_id", String(params.organization_id));
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id));
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id));
  }
  if (typeof params.shift_id === "number" && params.shift_id > 0) {
    searchParams.set("shift_id", String(params.shift_id));
  }
  if (typeof params.timetable_id === "number" && params.timetable_id > 0) {
    searchParams.set("timetable_id", String(params.timetable_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.exception_type && params.exception_type.trim()) {
    searchParams.set("exception_type", params.exception_type.trim());
  }
  if (params.attendance_status && params.attendance_status.trim()) {
    searchParams.set("attendance_status", params.attendance_status.trim());
  }
  if (typeof params.is_active === "boolean") {
    searchParams.set("is_active", params.is_active ? "true" : "false");
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

const PAGING_ONLY_QUERY_KEYS = new Set([
  "page",
  "limit",
  "sortBy",
  "sortOrder",
]);

function hasOnlyPagingParams(params: object): boolean {
  return Object.entries(params).every(
    ([key, value]) =>
      PAGING_ONLY_QUERY_KEYS.has(key) ||
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim()),
  );
}

/**
 * Some collection endpoints report a non-zero total but return no items when
 * paging/sort params are sent. Retry the bare path in that case. Requests that
 * carry a search or filter are never retried, so a filter is never dropped.
 */
async function retryEmptyPagedCollection(
  path: string,
  token: string,
  params: object,
  result: PaginatedUsersResult,
): Promise<PaginatedUsersResult> {
  if (result.rows.length > 0 || !result.total || !hasOnlyPagingParams(params)) {
    return result;
  }

  const payload = await adminRequest<unknown>(path, { token });
  const rows = normalizeList(payload);
  if (rows.length === 0) return result;

  return {
    rows,
    page: 1,
    limit: rows.length,
    total: rows.length,
    totalPages: 1,
  };
}

async function listAttendanceCollectionPage(
  path: string,
  token: string,
  params: AttendanceQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAttendanceQuery(params);
  const payload = await adminRequest<unknown>(`${path}${query}`, { token });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

async function listAllAttendanceCollection(
  path: string,
  token: string,
  params: AttendanceQueryParams = {},
): Promise<PaginatedUsersResult> {
  const requestedLimit =
    params.limit && params.limit > 0
      ? params.limit
      : env.NEXT_PUBLIC_MAX_PAGE_SIZE;
  const pageSize = Math.min(requestedLimit, env.NEXT_PUBLIC_MAX_PAGE_SIZE);
  const startPage = params.page && params.page > 0 ? params.page : 1;

  const mergedRows: AdminRecord[] = [];
  let page = startPage;
  let total: number | null = null;
  let totalPages: number | null = null;

  while (true) {
    const pageResult = await listAttendanceCollectionPage(path, token, {
      ...params,
      page,
      limit: pageSize,
    });

    mergedRows.push(...pageResult.rows);
    if (total === null && pageResult.total !== null) {
      total = pageResult.total;
    }
    if (totalPages === null && pageResult.totalPages !== null) {
      totalPages = pageResult.totalPages;
    }

    const hasMoreByCount = pageResult.rows.length === pageSize;
    const hasMoreByMeta = totalPages !== null ? page < totalPages : null;

    if (!hasMoreByCount) {
      break;
    }

    if (hasMoreByMeta === false) {
      break;
    }

    page += 1;
    if (page > 1000) {
      break;
    }
  }

  return retryEmptyPagedCollection(path, token, params, {
    rows: mergedRows,
    page: startPage,
    limit: mergedRows.length || pageSize,
    total,
    totalPages,
  });
}

/**
 * List attendance policies (GET /api/attendance/config/policies).
 *
 * Tries several query shapes because backends differ on pagination/sort support.
 * Never sends sortBy=created_at (OpenAPI documents User fields; that sort can
 * empty or break the policy list).
 */
export async function listAttendancePolicies(
  token: string,
  params: AttendanceQueryParams = {},
): Promise<PaginatedUsersResult> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const limit =
    params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 100;

  const queryAttempts: AttendanceQueryParams[] = [
    // Documented pagination only
    {
      page,
      limit,
      search: params.search,
      is_active: params.is_active,
    },
    // Safe name sort (when backends accept non-User sort fields)
    {
      page,
      limit,
      search: params.search,
      is_active: params.is_active,
      sortBy: "name",
      sortOrder: "ASC",
    },
    // Caller-provided sort if it is not the broken created_at default
    ...(params.sortBy &&
    params.sortBy.trim() &&
    params.sortBy.trim() !== "created_at"
      ? [
          {
            page,
            limit,
            search: params.search,
            is_active: params.is_active,
            sortBy: params.sortBy.trim(),
            sortOrder: params.sortOrder ?? ("ASC" as const),
          } satisfies AttendanceQueryParams,
        ]
      : []),
  ];

  let lastError: unknown = null;
  let lastEmpty: PaginatedUsersResult | null = null;

  for (const attempt of queryAttempts) {
    try {
      const result = await listAttendanceCollectionPage(
        "/api/attendance/config/policies",
        token,
        attempt,
      );
      if (result.rows.length > 0) {
        // If more pages exist, walk them without re-applying risky sorts.
        if (
          (result.totalPages !== null && result.totalPages > 1) ||
          (result.total !== null && result.total > result.rows.length) ||
          result.rows.length >= (attempt.limit ?? limit)
        ) {
          const all = await listAllAttendanceCollection(
            "/api/attendance/config/policies",
            token,
            {
              page: 1,
              limit: attempt.limit ?? limit,
              search: attempt.search,
              is_active: attempt.is_active,
              sortBy: attempt.sortBy,
              sortOrder: attempt.sortOrder,
            },
          );
          if (all.rows.length > 0) {
            return all;
          }
        }
        return result;
      }
      lastEmpty = result;
      lastError = null;
    } catch (errorObject) {
      lastError = errorObject;
    }
  }

  // Raw GET with no query string — some environments reject pagination/sort entirely.
  try {
    const payload = await adminRequest<unknown>(
      "/api/attendance/config/policies",
      { token },
    );
    if (process.env.NODE_ENV === "development") {
      const keys =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? Object.keys(payload as object)
          : Array.isArray(payload)
            ? [`array(${payload.length})`]
            : [typeof payload];
      console.debug("[listAttendancePolicies] raw payload keys:", keys);
    }
    const rows = normalizeList(payload);
    if (rows.length > 0) {
      return {
        rows,
        page: 1,
        limit: rows.length,
        total: rows.length,
        totalPages: 1,
      };
    }
  } catch (errorObject) {
    lastError = errorObject;
  }

  if (lastError) {
    throw lastError;
  }

  return (
    lastEmpty ?? {
      rows: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    }
  );
}

export async function listAttendanceSettings(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAttendancePolicies(token, params);
}

export async function getAttendancePolicy(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/attendance/config/policies/${id}`,
    {
      token,
    },
  );
  return normalizeSingle(payload);
}

export async function listAttendanceDevices(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection("/api/attendance/devices", token, params);
}

export async function listAttendanceMobileDeviceRegistrations(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/attendance/mobile-punches/devices", {
      token,
      cacheTtlMs: 0,
      dedupe: false,
    }),
  ) as AdminRecord[];
}

export async function getAttendanceSyncAlertReadiness(token: string) {
  return normalizeSingle(
    await adminRequest<unknown>(
      "/api/attendance/device-sync-alerts/readiness",
      { token, cacheTtlMs: 0, dedupe: false },
    ),
  ) as AdminRecord | null;
}

export async function sendAttendanceSyncAlertTest(token: string) {
  return adminRequest<unknown>("/api/attendance/device-sync-alerts/test", {
    method: "POST",
    token,
  });
}

export async function listAttendanceMobileDeviceRegistrationAudit(
  token: string,
  id: string | number,
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/attendance/mobile-punches/devices/${id}/audit`,
      { token, cacheTtlMs: 0, dedupe: false },
    ),
  ) as AdminRecord[];
}

export async function releaseAttendanceMobileDeviceRegistration(
  token: string,
  id: string | number,
  reason: string,
) {
  return adminRequest<unknown>(
    `/api/attendance/mobile-punches/devices/${id}/release`,
    { method: "PATCH", token, body: { reason } },
  );
}

export async function getAttendanceRetentionGovernanceReadiness(token: string) {
  return normalizeSingle(
    await adminRequest<unknown>(
      "/api/attendance/retention-governance/readiness",
      { token },
    ),
  );
}

export async function listAttendanceRetentionHolds(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/attendance/retention-governance/holds", {
      token,
    }),
  );
}

export async function createAttendanceRetentionHold(
  token: string,
  values: { category: string; recordId: number; reason: string },
) {
  return adminRequest<unknown>("/api/attendance/retention-governance/holds", {
    method: "POST",
    token,
    body: values,
  });
}

export async function releaseAttendanceRetentionHold(
  token: string,
  id: string | number,
  reason: string,
) {
  return adminRequest<unknown>(
    `/api/attendance/retention-governance/holds/${encodeURIComponent(String(id))}/release`,
    { method: "PATCH", token, body: { reason } },
  );
}

export async function listAttendanceRetentionPurgeApprovals(token: string) {
  return normalizeList(
    await adminRequest<unknown>(
      "/api/attendance/retention-governance/purge-approvals",
      { token },
    ),
  );
}

export async function listAttendanceLocationAccessLogs(token: string) {
  return normalizeList(
    await adminRequest<unknown>(
      "/api/attendance/mobile-punches/location-access-logs",
      { token, cacheTtlMs: 0, dedupe: false },
    ),
  );
}

export async function requestAttendanceRetentionPurgeApproval(
  token: string,
  values: { category: string; retentionDays: number; reason: string },
) {
  return adminRequest<unknown>(
    "/api/attendance/retention-governance/purge-approvals",
    { method: "POST", token, body: values },
  );
}

export async function reviewAttendanceRetentionPurgeApproval(
  token: string,
  id: string | number,
  values: { decision: "APPROVE" | "REJECT"; note: string },
) {
  return adminRequest<unknown>(
    `/api/attendance/retention-governance/purge-approvals/${encodeURIComponent(String(id))}/review`,
    { method: "PATCH", token, body: values },
  );
}

export async function listAttendanceDeviceEmployees(
  token: string,
  id: string | number,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    `/api/attendance/devices/${id}/employees`,
    token,
    params,
  );
}

export async function listAttendanceCheckpoints(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/checkpoints",
    token,
    params,
  );
}

export type AttendanceCheckpointQrTokenResponse = {
  token: string;
  qr_image_data_url: string;
  checkpoint_id: number;
  expires_at: string;
  valid_for_seconds: number;
};

export async function issueAttendanceCheckpointQrToken(
  token: string,
  checkpointId: string | number,
  validForSeconds = 60,
) {
  return adminRequest<AttendanceCheckpointQrTokenResponse>(
    `/api/attendance/checkpoints/${checkpointId}/qr-token`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ valid_for_seconds: validForSeconds }),
    },
  );
}

export async function listAttendanceGeofences(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/geofences",
    token,
    params,
  );
}

export async function listAttendanceWifiNetworks(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/wifi-networks",
    token,
    params,
  );
}

export async function listAttendanceMobilePunches(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/mobile-punches",
    token,
    params,
  );
}

export async function listAttendanceHolidays(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection("/api/attendance/holidays", token, params);
}

export async function listAttendanceHolidayGroups(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/holiday-groups",
    token,
    params,
  );
}

export async function listAttendanceDeviceSyncLogs(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/device-sync-logs",
    token,
    params,
  );
}

export async function listAttendanceDailySummaries(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/daily-summaries",
    token,
    params,
  );
}

/** Single-page daily summaries — use for paged UI and dashboard samples (not full history). */
export async function listAttendanceDailySummariesPage(
  token: string,
  params: AttendanceQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAttendanceQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/attendance/daily-summaries${query}`,
    {
      token,
      signal: options.signal,
      cacheTtlMs: options.cacheTtlMs,
      dedupe: options.dedupe,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getAttendanceDailySummary(
  token: string,
  employeeId: string | number,
  date: string,
) {
  const payload = await adminRequest<unknown>(
    `/api/attendance/daily-summaries/${employeeId}/${date}`,
    {
      token,
    },
  );
  return normalizeSingle(payload);
}

export async function upsertAttendanceDailySummaryAdjustment(
  token: string,
  employeeId: string | number,
  date: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/attendance/daily-summaries/${employeeId}/${encodeURIComponent(date)}/adjustment`,
    {
      method: "PUT",
      token,
      body: data,
    },
  );
}

export async function clearAttendanceDailySummaryAdjustment(
  token: string,
  employeeId: string | number,
  date: string,
) {
  return adminRequest<unknown>(
    `/api/attendance/daily-summaries/${employeeId}/${encodeURIComponent(date)}/adjustment`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function listAttendanceProcessingJobs(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/processing/jobs",
    token,
    params,
  );
}

export async function runPendingAttendanceProcessingJobs(token: string) {
  return adminRequest<unknown>("/api/attendance/processing/jobs/run-pending", {
    method: "POST",
    token,
  });
}

/**
 * POST /api/attendance/daily-summaries/refresh
 * RefreshAttendanceDailySummariesDto — rebuild summaries and/or reprocess from raw logs.
 */
export type RefreshAttendanceDailySummariesInput = {
  start_date: string;
  end_date: string;
  device_id?: number;
  employee_id?: number;
  /** Prefer for new clients: background | immediate */
  execution_mode?: "background" | "immediate";
  /** Legacy: sync | async */
  execution?: "sync" | "async";
  /** Prefer for new clients: fetch_and_process | database_only */
  processing_source?: "fetch_and_process" | "database_only";
  /** Legacy: summaries_only | from_raw_logs */
  mode?: "summaries_only" | "from_raw_logs";
};

export async function refreshAttendanceDailySummaries(
  token: string,
  data: RefreshAttendanceDailySummariesInput,
) {
  return adminRequest<unknown>("/api/attendance/daily-summaries/refresh", {
    method: "POST",
    token,
    body: data,
  });
}

/** @deprecated Use refreshAttendanceDailySummaries — maps to the same refresh endpoint. */
export async function rebuildAttendanceDailySummaries(
  token: string,
  data: AdminRecord | RefreshAttendanceDailySummariesInput,
) {
  return refreshAttendanceDailySummaries(
    token,
    data as RefreshAttendanceDailySummariesInput,
  );
}

/** @deprecated Prefer refreshAttendanceDailySummaries with processing_source. */
export async function processAttendanceRange(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/processing/run-range", {
    method: "POST",
    token,
    body: data,
  });
}

export async function downloadAttendanceReport(
  token: string,
  params: AttendanceReportDownloadParams,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const query = buildAttendanceReportQuery(params);
  const response = await fetch(
    buildUrl(`/api/attendance/reports/download${query}`),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ??
    filenameMatch?.[2] ??
    `attendance-report.${params.format}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function listAttendanceUnmatchedLogs(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/processing/unmatched-logs",
    token,
    params,
  );
}

export async function listAttendanceProcessingExceptions(
  token: string,
  params: AttendanceQueryParams = {},
) {
  return listAllAttendanceCollection(
    "/api/attendance/processing/exceptions",
    token,
    params,
  );
}

export async function updateAttendanceProcessingException(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/attendance/processing/exceptions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

function buildAttendanceBusinessTripsQuery(params: AttendanceQueryParams) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function listAttendanceBusinessTrips(
  token: string,
  params: AttendanceQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAttendanceBusinessTripsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/attendance/business-trips${query}`,
    {
      token,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAllAttendanceBusinessTrips(
  token: string,
  params: AttendanceQueryParams = {},
  options: ListRequestOptions & { pageSize?: number; maxPages?: number } = {},
): Promise<PaginatedUsersResult> {
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? 100),
    env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100,
  );
  const maxPages = Math.max(1, options.maxPages ?? 50);
  const collected: AdminRecord[] = [];
  let total: number | null = null;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await listAttendanceBusinessTrips(token, {
      ...params,
      page,
      limit: pageSize,
    });
    collected.push(...result.rows);
    if (total === null && result.total !== null) {
      total = result.total;
    }
    const reachedEnd =
      result.rows.length === 0 ||
      result.rows.length < pageSize ||
      (result.totalPages !== null && page >= result.totalPages) ||
      (result.total !== null && collected.length >= result.total);
    if (reachedEnd) {
      break;
    }
  }

  return {
    rows: collected,
    page: 1,
    limit: collected.length || pageSize,
    total: total ?? collected.length,
    totalPages: 1,
  };
}

export function buildAttendanceBusinessTripPayload(data: {
  employee_id: number;
  start_date: string;
  end_date: string;
  reason?: string;
  submit?: boolean;
}) {
  const body: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason?: string;
    submit?: boolean;
  } = {
    employee_id: data.employee_id,
    start_date: data.start_date,
    end_date: data.end_date,
  };
  if (data.reason?.trim()) {
    body.reason = data.reason.trim();
  }
  if (typeof data.submit === "boolean") {
    body.submit = data.submit;
  }
  return body;
}

export async function getAttendanceBusinessTrip(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/attendance/business-trips/${id}`,
    {
      token,
    },
  );
  return normalizeSingle(payload);
}

export async function createAttendanceBusinessTrip(
  token: string,
  data: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason?: string;
    submit?: boolean;
  },
) {
  return adminRequest<unknown>("/api/attendance/business-trips", {
    method: "POST",
    token,
    body: buildAttendanceBusinessTripPayload(data),
  });
}

export async function updateAttendanceBusinessTrip(
  token: string,
  id: string | number,
  data: {
    employee_id: number;
    start_date: string;
    end_date: string;
    reason?: string;
    submit?: boolean;
  },
) {
  return adminRequest<unknown>(`/api/attendance/business-trips/${id}`, {
    method: "PATCH",
    token,
    body: buildAttendanceBusinessTripPayload(data),
  });
}

export async function submitAttendanceBusinessTrip(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/attendance/business-trips/${id}/submit`, {
    method: "POST",
    token,
  });
}

export async function approveAttendanceBusinessTrip(
  token: string,
  id: string | number,
  note?: string,
) {
  return adminRequest<unknown>(`/api/attendance/business-trips/${id}/approve`, {
    method: "POST",
    token,
    body: note?.trim() ? { note: note.trim() } : {},
  });
}

export async function rejectAttendanceBusinessTrip(
  token: string,
  id: string | number,
  note?: string,
) {
  return adminRequest<unknown>(`/api/attendance/business-trips/${id}/reject`, {
    method: "POST",
    token,
    body: note?.trim() ? { note: note.trim() } : {},
  });
}

export async function cancelAttendanceBusinessTrip(
  token: string,
  id: string | number,
  reason?: string,
) {
  return adminRequest<unknown>(`/api/attendance/business-trips/${id}/cancel`, {
    method: "POST",
    token,
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

export async function createAttendanceMobilePunchCheckIn(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/attendance/mobile-punches/check-in", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyAttendanceMobilePunchPolicy(token: string) {
  return adminRequest<unknown>("/api/attendance/mobile-punches/my-policy", {
    token,
  });
}

export async function getCurrentLocationPrivacyNotice(token: string) {
  return adminRequest<unknown>("/api/location-privacy/current", { token });
}

export async function acknowledgeLocationPrivacyNotice(
  token: string,
  noticeId: number,
) {
  return adminRequest<unknown>("/api/location-privacy/acknowledgements", {
    method: "POST",
    token,
    body: { notice_id: noticeId },
  });
}

export async function listLocationPrivacyNotices(token: string) {
  return adminRequest<unknown[]>("/api/location-privacy/notices", { token });
}

export async function publishLocationPrivacyNotice(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/location-privacy/notices", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listLocationPrivacyAcknowledgements(
  token: string,
  noticeId: number,
) {
  return adminRequest<unknown[]>(
    `/api/location-privacy/notices/${noticeId}/acknowledgements`,
    { token },
  );
}

export async function createAttendanceMobilePunchCheckOut(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/attendance/mobile-punches/check-out", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getAttendanceMobilePunchSelfie(
  token: string,
  id: string | number,
): Promise<Blob> {
  const response = await fetch(
    buildUrl(`/api/attendance/mobile-punches/${id}/selfie`),
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(
      "No selfie is attached to this attendance punch or access was denied.",
    );
  return response.blob();
}

export async function approveAttendanceMobilePunchOverride(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/attendance/mobile-punches/${id}/approve-override`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function rejectAttendanceMobilePunchOverride(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/attendance/mobile-punches/${id}/reject-override`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function createAttendanceWorkFromHomeRequest(
  token: string,
  data: { start_date: string; end_date: string; reason: string },
) {
  return adminRequest<unknown>("/api/attendance/work-from-home/requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listAttendanceWorkFromHomeRequests(
  token: string,
  mine = false,
) {
  return adminRequest<unknown>(
    `/api/attendance/work-from-home/requests${mine ? "/mine" : ""}`,
    { token },
  );
}

export async function reviewAttendanceWorkFromHomeRequest(
  token: string,
  id: string | number,
  data: { decision: "APPROVE" | "REJECT"; comment?: string },
) {
  return adminRequest<unknown>(
    `/api/attendance/work-from-home/requests/${id}/review`,
    { method: "PATCH", token, body: data },
  );
}

export async function cancelAttendanceWorkFromHomeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/attendance/work-from-home/requests/${id}/cancel`,
    { method: "PATCH", token, body: {} },
  );
}

async function listGenericCollection(
  path: string,
  token: string,
  params: UsersQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildUsersQuery(params);
  const payload = await adminRequest<unknown>(`${path}${query}`, { token });
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return retryEmptyPagedCollection(path, token, params, {
    rows,
    ...pagination,
  });
}

function shiftResourcePath(resource: ShiftResourceKey) {
  const resourcePathMap: Partial<Record<ShiftResourceKey, string>> = {
    shifts: "/api/attendance/schedule-definitions/shifts",
    "shift-breaks": "/api/attendance/schedule-definitions/shift-breaks",
    "shift-rotation-groups":
      "/api/attendance/schedule-definitions/shift-rotation-groups",
    "shift-rotation-rules":
      "/api/attendance/schedule-definitions/shift-rotation-rules",
    "shift-assignments": "/api/attendance/assignments/shifts",
    "shift-schedules": "/api/attendance/schedules/manual-overrides",
  };

  return resourcePathMap[resource] ?? `/api/shift/${resource}`;
}

function timetableResourcePath(resource: TimetableResourceKey) {
  const resourcePathMap: Partial<Record<TimetableResourceKey, string>> = {
    timetables: "/api/attendance/schedule-definitions/timetables",
    "timetable-days": "/api/attendance/schedule-definitions/timetable-days",
    "timetable-shift-rules":
      "/api/attendance/schedule-definitions/timetable-day-shift-options",
    "timetable-generated-schedules":
      "/api/attendance/schedules/generated-schedules",
    "timetable-holiday-rules":
      "/api/attendance/schedule-definitions/timetable-holiday-rules",
    "timetable-rotations":
      "/api/attendance/schedule-definitions/timetable-rotations",
    "timetable-rotation-rules":
      "/api/attendance/schedule-definitions/timetable-rotation-rules",
    "employee-timetables": "/api/attendance/assignments/timetables",
  };

  return resourcePathMap[resource] ?? `/api/timetable/${resource}`;
}

function attendanceResourcePath(resource: AttendanceResourceKey) {
  const resourcePathMap: Record<AttendanceResourceKey, string> = {
    settings: "/api/attendance/config/policies",
    policies: "/api/attendance/config/policies",
    devices: "/api/attendance/devices",
    checkpoints: "/api/attendance/checkpoints",
    geofences: "/api/attendance/geofences",
    "wifi-networks": "/api/attendance/wifi-networks",
    "mobile-punches": "/api/attendance/mobile-punches",
    "holiday-groups": "/api/attendance/holiday-groups",
    holidays: "/api/attendance/holidays",
    "device-sync-logs": "/api/attendance/device-sync-logs",
  };

  return resourcePathMap[resource];
}

function accessControlResourcePath(resource: AccessControlResourceKey) {
  return `/api/access-control/${resource}`;
}

export async function getAttendanceResourceById(
  token: string,
  resource: AttendanceResourceKey,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `${attendanceResourcePath(resource)}/${id}`,
    { token },
  );
  // Prefer normalized entity, but keep envelope fields if normalize drops them.
  const single = normalizeSingle(payload);
  const root = asRecord(payload);
  if (single && root) {
    return { ...root, ...single };
  }
  return single ?? root;
}

export async function createAttendanceResource(
  token: string,
  resource: AttendanceResourceKey,
  data: AdminRecord,
) {
  return adminRequest<unknown>(attendanceResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateAttendanceResourceById(
  token: string,
  resource: Exclude<
    AttendanceResourceKey,
    "device-sync-logs" | "mobile-punches"
  >,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`${attendanceResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteAttendanceResourceById(
  token: string,
  resource: Exclude<
    AttendanceResourceKey,
    "device-sync-logs" | "mobile-punches"
  >,
  id: string | number,
) {
  return adminRequest<unknown>(`${attendanceResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function syncAttendanceDevice(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/attendance/devices/${id}/sync`, {
    method: "POST",
    token,
  });
}

export async function getAttendanceDeviceSyncStatus(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/attendance/devices/${id}/sync-status`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function testAttendanceDeviceConnection(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/attendance/devices/${id}/test-connection`,
    {
      method: "POST",
      token,
    },
  );
}

export async function getAccessControlAttendanceDeviceSyncStatus(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/attendance-devices/${id}/sync-status`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncAccessControlDeviceDoors(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/doors/sync-from-device/${id}`,
    {
      method: "POST",
      token,
    },
  );
}

export type AccessDoorLiveCommand =
  "open" | "close" | "always-open" | "always-close";

export async function commandAccessControlDoor(
  token: string,
  id: string | number,
  command: AccessDoorLiveCommand,
) {
  return adminRequest<unknown>(`/api/access-control/doors/${id}/${command}`, {
    method: "POST",
    token,
  });
}

export async function getAccessControlDoorDeviceConfig(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/doors/${id}/device-config`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncAccessControlDoorToDevice(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/doors/${id}/sync-to-device`,
    {
      method: "POST",
      token,
    },
  );
}

export async function syncAccessControlDeviceTemplates(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/schedule-templates/sync-from-device/${id}`,
    {
      method: "POST",
      token,
    },
  );
}

export type AccessScheduleType = "DOOR" | "ATTENDANCE" | "MIXED";
export type AccessScheduleTemplateStatus = "ACTIVE" | "INACTIVE";
export type AccessCredentialType =
  "CARD" | "FINGERPRINT" | "FACE" | "PASSWORD" | "QR" | "PIN";
export type AccessCredentialStatus =
  "ACTIVE" | "INACTIVE" | "LOST" | "BLOCKED" | "DELETED";
export type AccessAuditLogStatus = "PENDING" | "SUCCESS" | "FAILED";
export type HikvisionSyncLogStatus = "SUCCESS" | "FAILED" | "PARTIAL";
export type HikvisionSyncDirection = "PULL" | "PUSH";
export type HikvisionSyncType =
  | "ATTENDANCE"
  | "USERS"
  | "CARDS"
  | "FINGERPRINTS"
  | "DOORS"
  | "WEEK_PLANS"
  | "TEMPLATES"
  | "ORGANIZATIONS"
  | "ACCESS_GROUPS"
  | "FULL";

export interface AccessCredentialQueryParams extends UsersQueryParams {
  employee_id?: number;
  device_id?: number;
  credential_type?: AccessCredentialType | string;
  credential_status?: AccessCredentialStatus | string;
  employee_no?: string;
  card_no?: string;
  fingerprint_id?: string;
  sort_order?: SortOrder;
}

export interface AccessAuditLogQueryParams {
  companyId?: number;
  branchId?: number;
  deviceId?: number;
  employeeId?: number;
  employeeNo?: string;
  action?: string;
  status?: AccessAuditLogStatus | string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AccessDeviceCommandLogQueryParams {
  companyId?: number;
  branchId?: number;
  deviceId?: number;
  commandType?: string;
  status?: AccessAuditLogStatus | string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface HikvisionSyncLogQueryParams {
  deviceId?: number;
  syncType?: HikvisionSyncType | string;
  direction?: HikvisionSyncDirection | string;
  status?: HikvisionSyncLogStatus | string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AccessScheduleTemplatesQueryParams extends UsersQueryParams {
  status?: AccessScheduleTemplateStatus | string;
  schedule_type?: AccessScheduleType | string;
}

function buildAccessScheduleTemplatesQuery(
  params: AccessScheduleTemplatesQueryParams,
) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.schedule_type && params.schedule_type.trim()) {
    searchParams.set("schedule_type", params.schedule_type.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildAccessCredentialQuery(params: AccessCredentialQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (typeof params.device_id === "number" && params.device_id > 0) {
    searchParams.set("device_id", String(params.device_id));
  }
  if (params.credential_type?.trim()) {
    searchParams.set("credential_type", params.credential_type.trim());
  }
  if (params.credential_status?.trim()) {
    searchParams.set("credential_status", params.credential_status.trim());
  }
  if (params.employee_no?.trim()) {
    searchParams.set("employee_no", params.employee_no.trim());
  }
  if (params.card_no?.trim()) {
    searchParams.set("card_no", params.card_no.trim());
  }
  if (params.fingerprint_id?.trim()) {
    searchParams.set("fingerprint_id", params.fingerprint_id.trim());
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  const sortOrder = params.sort_order ?? params.sortOrder;
  if (sortOrder === "ASC" || sortOrder === "DESC") {
    searchParams.set("sort_order", sortOrder);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildAccessAuditLogQuery(params: AccessAuditLogQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (typeof params.companyId === "number" && params.companyId > 0) {
    searchParams.set("companyId", String(params.companyId));
  }
  if (typeof params.branchId === "number" && params.branchId > 0) {
    searchParams.set("branchId", String(params.branchId));
  }
  if (typeof params.deviceId === "number" && params.deviceId > 0) {
    searchParams.set("deviceId", String(params.deviceId));
  }
  if (typeof params.employeeId === "number" && params.employeeId > 0) {
    searchParams.set("employeeId", String(params.employeeId));
  }
  if (params.employeeNo?.trim()) {
    searchParams.set("employeeNo", params.employeeNo.trim());
  }
  if (params.action?.trim()) {
    searchParams.set("action", params.action.trim());
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.dateFrom?.trim()) {
    searchParams.set("dateFrom", params.dateFrom.trim());
  }
  if (params.dateTo?.trim()) {
    searchParams.set("dateTo", params.dateTo.trim());
  }
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildAccessDeviceCommandLogQuery(
  params: AccessDeviceCommandLogQueryParams = {},
) {
  const searchParams = new URLSearchParams();
  if (typeof params.companyId === "number" && params.companyId > 0) {
    searchParams.set("companyId", String(params.companyId));
  }
  if (typeof params.branchId === "number" && params.branchId > 0) {
    searchParams.set("branchId", String(params.branchId));
  }
  if (typeof params.deviceId === "number" && params.deviceId > 0) {
    searchParams.set("deviceId", String(params.deviceId));
  }
  if (params.commandType?.trim()) {
    searchParams.set("commandType", params.commandType.trim());
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.dateFrom?.trim()) {
    searchParams.set("dateFrom", params.dateFrom.trim());
  }
  if (params.dateTo?.trim()) {
    searchParams.set("dateTo", params.dateTo.trim());
  }
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function buildHikvisionSyncLogQuery(params: HikvisionSyncLogQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (typeof params.deviceId === "number" && params.deviceId > 0) {
    searchParams.set("deviceId", String(params.deviceId));
  }
  if (params.syncType?.trim()) {
    searchParams.set("syncType", params.syncType.trim());
  }
  if (params.direction?.trim()) {
    searchParams.set("direction", params.direction.trim());
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.dateFrom?.trim()) {
    searchParams.set("dateFrom", params.dateFrom.trim());
  }
  if (params.dateTo?.trim()) {
    searchParams.set("dateTo", params.dateTo.trim());
  }
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

/** List access schedule templates (GET /api/access-control/schedule-templates). */
export async function listAccessScheduleTemplates(
  token: string,
  params: AccessScheduleTemplatesQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessScheduleTemplatesQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/schedule-templates${query}`,
    {
      token,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

/** Get one access schedule template by id. */
export async function getAccessScheduleTemplate(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/schedule-templates/${id}`,
    {
      token,
    },
  );
  return normalizeSingle(payload);
}

/**
 * Create access schedule template.
 * Body: CreateAccessScheduleTemplateDto
 * (device_id, hikvision_template_no, hikvision_week_plan_no, template_name, week_plan_id, …)
 */
export async function createAccessScheduleTemplate(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/access-control/schedule-templates", {
    method: "POST",
    token,
    body: data,
  });
}

/** Partially update an access schedule template. */
export async function updateAccessScheduleTemplate(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/access-control/schedule-templates/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

/** Delete an access schedule template. */
export async function deleteAccessScheduleTemplate(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/access-control/schedule-templates/${id}`, {
    method: "DELETE",
    token,
  });
}

/** Push one schedule template to a Hikvision device. */
export async function syncAccessScheduleTemplateToDevice(
  token: string,
  id: string | number,
  data: { device_id: number },
) {
  return adminRequest<unknown>(
    `/api/access-control/schedule-templates/${id}/sync-to-device`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

/** Pull schedule templates from a Hikvision device and upsert locally. */
export async function syncAccessScheduleTemplatesFromDevice(
  token: string,
  deviceId: string | number,
) {
  return syncAccessControlDeviceTemplates(token, deviceId);
}

export async function syncAccessWeekPlanToDevice(
  token: string,
  id: string | number,
  data: { device_id: number },
) {
  return adminRequest<unknown>(
    `/api/access-control/week-plans/${id}/sync-to-device`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function syncHikvisionDeviceFingerprints(
  token: string,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/sync-fingerprints`,
    {
      method: "POST",
      token,
    },
  );
}

export async function syncHikvisionDeviceUsers(
  token: string,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/sync-users`,
    {
      method: "POST",
      token,
    },
  );
}

export async function listHikvisionAttendanceLogs(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hikvision/attendance/logs${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listHikvisionDeviceAttendanceLogs(
  token: string,
  deviceId: string | number,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/logs${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getHikvisionAttendanceCapabilities(
  token: string,
  deviceId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/capabilities`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHikvisionAttendanceSyncStatus(
  token: string,
  deviceId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/sync/status`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listHikvisionAttendanceSyncHistory(
  token: string,
  deviceId: string | number,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/sync-history${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function syncHikvisionAttendance(
  token: string,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/sync`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function syncHikvisionAttendanceByDate(
  token: string,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/sync-date`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function syncHikvisionAttendanceByEmployee(
  token: string,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/sync-employee`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function syncHikvisionAttendanceByRange(
  token: string,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/sync-range`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function pullHikvisionAttendancePage(
  token: string,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/hikvision/devices/${deviceId}/attendance/pull-page`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function manageHikvisionDevice(
  token: string,
  deviceId: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(`/api/hikvision/devices/${deviceId}/manage`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getHikvisionSyncJob(
  token: string,
  jobId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hikvision/sync-jobs/${jobId}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncAccessControlDeviceWeekPlans(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/week-plans/sync-from-device/${id}`,
    {
      method: "POST",
      token,
    },
  );
}

export async function listAccessCredentials(
  token: string,
  params: AccessCredentialQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessCredentialQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/access-credentials${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getAccessCredentialById(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/access-credentials/${id}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getAccessCredentialDeviceActionRoutes(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/access-credentials/${id}/device-action-routes`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updateAccessCredentialStatus(
  token: string,
  id: string | number,
  action: "block" | "disable" | "enable" | "lost" | "revoke",
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/access-control/access-credentials/${id}/${action}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function listEmployeeAccessCredentials(
  token: string,
  employeeId: string | number,
  params: AccessCredentialQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessCredentialQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/access-credentials${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAccessAuditLogs(
  token: string,
  params: AccessAuditLogQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessAuditLogQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/audit-logs${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getAccessAuditLogById(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/audit-logs/${id}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listAccessDeviceCommandLogs(
  token: string,
  params: AccessDeviceCommandLogQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessDeviceCommandLogQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/device-command-logs${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getAccessDeviceCommandLogById(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/device-command-logs/${id}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listAccessDeviceAuditLogs(
  token: string,
  deviceId: string | number,
  params: AccessAuditLogQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessAuditLogQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/devices/${deviceId}/audit-logs${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAccessDeviceScopedCommandLogs(
  token: string,
  deviceId: string | number,
  params: AccessDeviceCommandLogQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessDeviceCommandLogQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/devices/${deviceId}/command-logs${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listAccessEmployeeAuditLogs(
  token: string,
  employeeId: string | number,
  params: AccessAuditLogQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildAccessAuditLogQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/audit-logs${query}`,
    {
      token,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listHikvisionSyncLogs(
  token: string,
  params: HikvisionSyncLogQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildHikvisionSyncLogQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/access-control/hikvision-sync-logs${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getHikvisionSyncLogById(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/hikvision-sync-logs/${id}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function activateAttendancePolicy(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/attendance/config/policies/${id}/activate`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function activateAttendanceGeofence(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/attendance/geofences/${id}/activate`, {
    method: "PATCH",
    token,
  });
}

export async function deactivateAttendanceGeofence(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/attendance/geofences/${id}/deactivate`, {
    method: "PATCH",
    token,
  });
}

export async function validateAttendanceGeofenceLocation(
  token: string,
  id: string | number,
  data: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
  },
) {
  return adminRequest<unknown>(
    `/api/attendance/geofences/${id}/validate-location`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function activateAttendanceWifiNetwork(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/attendance/wifi-networks/${id}/activate`, {
    method: "PATCH",
    token,
  });
}

export async function deactivateAttendanceWifiNetwork(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/attendance/wifi-networks/${id}/deactivate`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function validateAttendanceWifiNetwork(
  token: string,
  id: string | number,
  data: {
    ssid?: string;
    bssid?: string;
    ipAddress?: string;
  } = {},
) {
  return adminRequest<unknown>(`/api/attendance/wifi-networks/${id}/validate`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listEmployeePositions(
  token: string,
  params: EmployeePositionsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildEmployeePositionsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/employee-positions${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

function buildEmployeeMovementsQuery(
  params: EmployeeMovementsQueryParams = {},
) {
  const searchParams = new URLSearchParams();

  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.movement_type?.trim()) {
    searchParams.set("movement_type", params.movement_type.trim());
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function listEmployeeMovements(
  token: string,
  params: EmployeeMovementsQueryParams = {},
) {
  const query = buildEmployeeMovementsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/employee-movements${query}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeeMovement(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/employee-movements/${id}`, {
    token,
  });
  // The movement nests snapshots and the employee; keep the root record.
  return unwrapRootRecord(payload, "id");
}

export async function listEmployeeMovementOperations(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-movements/${id}/operations`,
    { token },
  );
  return normalizeList(payload);
}

export async function createEmployeeMovement(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/employee-movements", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateEmployeeMovement(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function submitEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}/submit`, {
    method: "POST",
    token,
  });
}

export async function cancelEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}/cancel`, {
    method: "POST",
    token,
  });
}

export async function approveEmployeeMovement(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}/approve`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function rejectEmployeeMovement(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function returnEmployeeMovement(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}/return`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function applyEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/employee-movements/${id}/apply`, {
    method: "POST",
    token,
  });
}

export async function retryEmployeeMovementOperation(
  token: string,
  id: string | number,
  operationId: string | number,
) {
  return adminRequest<unknown>(
    `/api/employee-movements/${id}/operations/${operationId}/retry`,
    {
      method: "POST",
      token,
    },
  );
}

export async function getEmployeePosition(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/employee-positions/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createEmployeePosition(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/employee-positions", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchEmployeePosition(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employee-positions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteEmployeePosition(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/employee-positions/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listShiftResources(
  token: string,
  resource: ShiftResourceKey,
  params: UsersQueryParams = {},
) {
  const result = await listGenericCollection(
    shiftResourcePath(resource),
    token,
    params,
  );
  return {
    ...result,
    rows: result.rows.map(normalizeScheduleResourceRecord),
  };
}

function normalizeScheduleResourceKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/**
 * Attendance schedule entities are serialized by Nest/TypeORM with camelCase
 * property names, while their create/update DTOs intentionally accept
 * snake_case. Keep the UI on the DTO naming convention so list columns, edit
 * forms, and PATCH payloads all describe the same fields.
 */
function normalizeScheduleResourceRecord(record: AdminRecord): AdminRecord {
  const normalized: AdminRecord = {};

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeScheduleResourceKey(key);
    if (!(normalizedKey in normalized) || normalizedKey === key) {
      normalized[normalizedKey] = value;
    }
  }

  return normalized;
}

export async function getShiftResourceById(
  token: string,
  resource: ShiftResourceKey,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `${shiftResourcePath(resource)}/${id}`,
    { token },
  );
  const record = normalizeSingle(payload);
  return record ? normalizeScheduleResourceRecord(record) : null;
}

export async function getEmployeeAttendanceAssignmentPresence(
  token: string,
  employeeId: string | number,
) {
  const employeeIdValue = Number(employeeId);
  if (!Number.isFinite(employeeIdValue) || employeeIdValue < 1) {
    throw new Error("A valid employee is required.");
  }

  const query = new URLSearchParams({
    page: "1",
    limit: "100",
    employee_id: String(Math.trunc(employeeIdValue)),
    status: "ACTIVE",
  }).toString();
  const [shiftPayload, timetablePayload] = await Promise.all([
    adminRequest<unknown>(
      `${shiftResourcePath("shift-assignments")}?${query}`,
      { token },
    ),
    adminRequest<unknown>(
      `${timetableResourcePath("employee-timetables")}?${query}`,
      { token },
    ),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const hasCurrentAssignment = (payload: unknown) =>
    normalizeList(payload)
      .map(normalizeScheduleResourceRecord)
      .some((record) => {
        const effectiveTo = record.effective_to;
        return (
          typeof effectiveTo !== "string" ||
          !effectiveTo.trim() ||
          effectiveTo.slice(0, 10) >= today
        );
      });

  const hasShift = hasCurrentAssignment(shiftPayload);
  const hasTimetable = hasCurrentAssignment(timetablePayload);
  return {
    hasShift,
    hasTimetable,
    hasAssignment: hasShift || hasTimetable,
  };
}

export async function createShiftResource(
  token: string,
  resource: ShiftResourceKey,
  data: AdminRecord,
) {
  return adminRequest<unknown>(shiftResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchShiftResourceById(
  token: string,
  resource: ShiftResourceKey,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`${shiftResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteShiftResourceById(
  token: string,
  resource: ShiftResourceKey,
  id: string | number,
) {
  return adminRequest<unknown>(`${shiftResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listTimetableResources(
  token: string,
  resource: TimetableResourceKey,
  params: UsersQueryParams = {},
) {
  const result = await listGenericCollection(
    timetableResourcePath(resource),
    token,
    params,
  );
  return {
    ...result,
    rows: result.rows.map(normalizeScheduleResourceRecord),
  };
}

export async function getTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `${timetableResourcePath(resource)}/${id}`,
    { token },
  );
  const record = normalizeSingle(payload);
  return record ? normalizeScheduleResourceRecord(record) : null;
}

export async function createTimetableResource(
  token: string,
  resource: TimetableResourceKey,
  data: AdminRecord,
) {
  return adminRequest<unknown>(timetableResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  });
}

export async function publishGeneratedSchedule(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/attendance/schedules/generated-schedules/${id}/publish`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function unpublishGeneratedSchedule(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/attendance/schedules/generated-schedules/${id}/unpublish`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function createGeneratedSchedulesBulk(
  token: string,
  schedules: AdminRecord[],
) {
  return adminRequest<unknown>(
    "/api/attendance/schedules/generated-schedules/bulk",
    {
      method: "POST",
      token,
      body: schedules,
    },
  );
}

export async function patchTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`${timetableResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number,
) {
  return adminRequest<unknown>(`${timetableResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listAccessControlResources(
  token: string,
  resource: AccessControlResourceKey,
  params: UsersQueryParams = {},
) {
  return listGenericCollection(
    accessControlResourcePath(resource),
    token,
    params,
  );
}

export async function getAccessControlResourceById(
  token: string,
  resource: AccessControlResourceKey,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `${accessControlResourcePath(resource)}/${id}`,
    {
      token,
    },
  );
  return normalizeSingle(payload);
}

export async function createAccessControlResource(
  token: string,
  resource: AccessControlResourceKey,
  data: AdminRecord,
) {
  return adminRequest<unknown>(accessControlResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateAccessControlResourceById(
  token: string,
  resource: AccessControlResourceKey,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`${accessControlResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteAccessControlResourceById(
  token: string,
  resource: AccessControlResourceKey,
  id: string | number,
) {
  return adminRequest<unknown>(`${accessControlResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listAccessGroupDoors(
  token: string,
  groupId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/doors`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listAccessGroupDevices(
  token: string,
  groupId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/devices`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function assignAccessGroupDevices(
  token: string,
  groupId: string | number,
  deviceIds: Array<string | number>,
) {
  return adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/devices`,
    {
      method: "POST",
      token,
      body: {
        device_ids: deviceIds
          .map((deviceId) => Number(deviceId))
          .filter((deviceId) => Number.isFinite(deviceId)),
      },
    },
  );
}

export async function removeAccessGroupDevice(
  token: string,
  groupId: string | number,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/devices/${deviceId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function syncAccessGroup(token: string, groupId: string | number) {
  return adminRequest<unknown>(`/api/access-control/groups/${groupId}/sync`, {
    method: "POST",
    token,
  });
}

export async function assignAccessGroupDoors(
  token: string,
  groupId: string | number,
  items: Array<{
    door_id: string | number;
    schedule_template_id: string | number;
    device_id?: string | number | null;
  }>,
) {
  return adminRequest<unknown>(`/api/access-control/groups/${groupId}/doors`, {
    method: "POST",
    token,
    body: {
      items: items
        .map((item) => {
          const doorId = Number(item.door_id);
          const scheduleTemplateId = Number(item.schedule_template_id);
          const deviceId =
            item.device_id === undefined || item.device_id === null
              ? null
              : Number(item.device_id);

          return {
            door_id: doorId,
            schedule_template_id: scheduleTemplateId,
            ...(deviceId !== null && Number.isFinite(deviceId)
              ? { device_id: deviceId }
              : {}),
          };
        })
        .filter(
          (item) =>
            Number.isFinite(item.door_id) &&
            Number.isFinite(item.schedule_template_id),
        ),
    },
  });
}

export async function removeAccessGroupDoor(
  token: string,
  groupId: string | number,
  doorId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/doors/${doorId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function listAccessGroupEmployees(
  token: string,
  groupId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/employees`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function assignAccessGroupEmployees(
  token: string,
  groupId: string | number,
  employeeIds: Array<string | number>,
) {
  return adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/employees`,
    {
      method: "POST",
      token,
      body: {
        employee_ids: employeeIds
          .map((employeeId) => Number(employeeId))
          .filter((employeeId) => Number.isFinite(employeeId)),
      },
    },
  );
}

export async function listAccessOrganizationEmployees(
  token: string,
  organizationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/organizations/${organizationId}/employees`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function assignAccessOrganizationEmployees(
  token: string,
  organizationId: string | number,
  employeeIds: Array<string | number>,
) {
  return adminRequest<unknown>(
    `/api/access-control/organizations/${organizationId}/employees`,
    {
      method: "POST",
      token,
      body: {
        employee_ids: employeeIds
          .map((employeeId) => Number(employeeId))
          .filter((employeeId) => Number.isFinite(employeeId)),
      },
    },
  );
}

export async function removeAccessOrganizationEmployee(
  token: string,
  organizationId: string | number,
  employeeId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/organizations/${organizationId}/employees/${employeeId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function syncAccessOrganizationToDevice(
  token: string,
  organizationId: string | number,
  data: { device_id?: number; device_ids?: number[] },
) {
  return adminRequest<unknown>(
    `/api/access-control/organizations/${organizationId}/sync-to-device`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function syncAccessOrganizationsFromDevice(
  token: string,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/organizations/sync-from-device/${deviceId}`,
    {
      method: "POST",
      token,
    },
  );
}

export async function removeAccessGroupEmployee(
  token: string,
  groupId: string | number,
  employeeId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/groups/${groupId}/employees/${employeeId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function assignEmployeeDevices(
  token: string,
  employeeId: string | number,
  data: {
    access_group_id: string | number;
    device_ids: Array<string | number>;
    valid_enabled?: boolean;
    valid_begin_time?: string;
    valid_end_time?: string;
    local_ui_right?: boolean;
    close_delay_enabled?: boolean;
    max_open_door_time?: number;
    open_door_time?: number;
    user_verify_mode?: string;
    metadata?: AdminRecord;
    sync_now?: boolean;
    continue_on_error?: boolean;
  },
) {
  const accessGroupId = Number(data.access_group_id);
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices`,
    {
      method: "POST",
      token,
      body: {
        access_group_id: accessGroupId,
        device_ids: data.device_ids
          .map((deviceId) => Number(deviceId))
          .filter((deviceId) => Number.isFinite(deviceId)),
        ...(typeof data.valid_enabled === "boolean"
          ? { valid_enabled: data.valid_enabled }
          : {}),
        ...(data.valid_begin_time
          ? { valid_begin_time: data.valid_begin_time }
          : {}),
        ...(data.valid_end_time ? { valid_end_time: data.valid_end_time } : {}),
        ...(typeof data.local_ui_right === "boolean"
          ? { local_ui_right: data.local_ui_right }
          : {}),
        ...(typeof data.close_delay_enabled === "boolean"
          ? { close_delay_enabled: data.close_delay_enabled }
          : {}),
        ...(typeof data.max_open_door_time === "number"
          ? { max_open_door_time: data.max_open_door_time }
          : {}),
        ...(typeof data.open_door_time === "number"
          ? { open_door_time: data.open_door_time }
          : {}),
        ...(data.user_verify_mode
          ? { user_verify_mode: data.user_verify_mode }
          : {}),
        ...(data.metadata ? { metadata: data.metadata } : {}),
        ...(typeof data.sync_now === "boolean"
          ? { sync_now: data.sync_now }
          : {}),
        ...(typeof data.continue_on_error === "boolean"
          ? { continue_on_error: data.continue_on_error }
          : {}),
      },
    },
  );
}

/** List devices currently assigned to an employee (access-control). */
export async function listEmployeeDevices(
  token: string,
  employeeId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeeAccessCredentials(
  token: string,
  employeeId: string | number,
) {
  const result = await listEmployeeAccessCredentials(token, employeeId);
  return result.rows;
}

export async function createEmployeeAccessCredentials(
  _token: string,
  _employeeId: string | number,
  _data: AdminRecord,
) {
  void _token;
  void _employeeId;
  void _data;
  unsupportedAdminEndpoint(
    "Employee access credential creation is not available in the current backend API.",
  );
}

export async function updateEmployeeAccessCredentials(
  _token: string,
  _employeeId: string | number,
  _data: AdminRecord,
) {
  void _token;
  void _employeeId;
  void _data;
  unsupportedAdminEndpoint(
    "Employee access credential updates are not available in the current backend API.",
  );
}

export async function createEmployeeDevicePassword(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/password`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function updateEmployeeDevicePassword(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/password`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function captureEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/capture`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listEmployeeDeviceFingerprints(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listAttendanceDeviceAssignmentMatches(
  token: string,
  deviceId: string | number,
  employeeId: string | number,
) {
  const query = new URLSearchParams({
    deviceId: String(deviceId),
    employeeId: String(employeeId),
  });

  const payload = await adminRequest<unknown>(
    `/api/access-control/attendance-devices/employee-device-assignment-matches?${query.toString()}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function syncEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/sync`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function resyncEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/resync`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function disableEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/disable`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function enableEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/enable`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function listEmployeeDeviceCards(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards`,
    { token },
  );
  return normalizeList(payload);
}

export async function createEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function updateEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}`,
    { method: "PATCH", token, body: data },
  );
}

export async function deleteEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}`,
    { method: "DELETE", token },
  );
}

export async function enableEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}/enable`,
    { method: "PATCH", token },
  );
}

export async function disableEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}/disable`,
    { method: "PATCH", token },
  );
}

export async function syncEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}/sync`,
    { method: "POST", token, body: data },
  );
}

export async function enableEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/enable`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function disableEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/disable`,
    {
      method: "PATCH",
      token,
    },
  );
}

export async function removeEmployeeDeviceDoorPermission(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/remove-door-permission`,
    { method: "PATCH", token },
  );
}

export async function deleteEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}`,
    {
      method: "DELETE",
      token,
      body: data,
    },
  );
}

export async function registerEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/register`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function updateEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function resyncEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/resync`,
    {
      method: "POST",
      token,
    },
  );
}

export async function removeEmployeeDeviceAssignment(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function syncAccessControlDoorsFromDevice(
  token: string,
  deviceId: string | number,
) {
  return adminRequest<unknown>(
    `/api/access-control/doors/sync-from-device/${deviceId}`,
    {
      method: "POST",
      token,
    },
  );
}

export async function createDepartment(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/departments", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchDepartment(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/departments/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteDepartment(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/departments/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listDepartmentAccess(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/departments/${id}/access`, {
    token,
  });
  return normalizeList(payload);
}

export async function grantDepartmentAccess(
  token: string,
  departmentId: string | number,
  userId: string | number,
) {
  return adminRequest<unknown>(
    `/api/departments/${departmentId}/access/${userId}`,
    {
      method: "POST",
      token,
    },
  );
}

export async function revokeDepartmentAccess(
  token: string,
  departmentId: string | number,
  userId: string | number,
) {
  return adminRequest<unknown>(
    `/api/departments/${departmentId}/access/${userId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function createBranch(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/branches", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchBranch(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/branches/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteBranch(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/branches/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listBranchAccess(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/branches/${id}/access`, {
    token,
  });
  return normalizeList(payload);
}

export async function grantBranchAccess(
  token: string,
  branchId: string | number,
  userId: string | number,
) {
  return adminRequest<unknown>(`/api/branches/${branchId}/access/${userId}`, {
    method: "POST",
    token,
  });
}

export async function revokeBranchAccess(
  token: string,
  branchId: string | number,
  userId: string | number,
) {
  return adminRequest<unknown>(`/api/branches/${branchId}/access/${userId}`, {
    method: "DELETE",
    token,
  });
}

export async function createPosition(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/positions", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchPosition(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/positions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deletePosition(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/positions/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createLeaveType(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/types", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchLeaveType(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/leave/types/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeaveType(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/types/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createLeaveRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/requests", {
    method: "POST",
    token,
    body: data,
  });
}

export type LeaveImportRowResult = {
  row: number;
  employee_no: string;
  leave_type_code: string;
  status: "ready" | "created" | "failed";
  leave_request_id?: number | null;
  leave_no?: string | null;
  message?: string;
};

export type LeaveImportResult = {
  total: number;
  created: number;
  ready: number;
  failed: number;
  preview: boolean;
  results: LeaveImportRowResult[];
};

export type LeaveBalanceImportBatchStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "HAS_ERRORS"
  | "READY_FOR_IMPORT"
  | "PROCESSING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type LeaveBalanceImportMode = "STRICT" | "VALID_ROWS_ONLY";

export type LeaveBalanceImportValidationStatus =
  "VALID" | "WARNING" | "INVALID" | "NO_CHANGE";

export type LeaveBalanceImportResultStatus = "IMPORTED" | "SKIPPED" | "FAILED";

export type LeaveBalanceImportIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  field: string | null;
  message: string;
};

export type LeaveBalanceImportPerson = {
  id: number;
  name: string;
  email: string;
} | null;

export type LeaveBalanceImportBatch = {
  batch_id: string;
  status: LeaveBalanceImportBatchStatus;
  import_mode: LeaveBalanceImportMode | null;
  fiscal_year: string;
  original_file_name: string;
  file_size: number;
  template_generated_at: string | null;
  default_reason: string | null;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  invalid_rows: number;
  no_change_rows: number;
  changed_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  /** Changed rows applied so far while the batch is PROCESSING. */
  processed_rows: number;
  total_employees: number;
  employees_affected: number;
  failure_reason: string | null;
  uploaded_at: string;
  uploaded_by: LeaveBalanceImportPerson;
  confirmed_at: string | null;
  confirmed_by: LeaveBalanceImportPerson;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type LeaveBalanceImportFacet = {
  id: number;
  name: string;
  code?: string;
};

export type LeaveBalanceImportBatchDetail = LeaveBalanceImportBatch & {
  summary: {
    issue_counts?: Record<string, number>;
    total_increase_days?: string;
    total_decrease_days?: string;
    net_adjustment_days?: string;
    facets?: {
      leave_types?: LeaveBalanceImportFacet[];
      branches?: LeaveBalanceImportFacet[];
      departments?: LeaveBalanceImportFacet[];
    };
    result?: {
      imported_rows?: number;
      failed_rows?: number;
      skipped_rows?: number;
      net_adjustment_days?: string;
    };
  };
  actions: {
    can_confirm_strict: boolean;
    can_confirm_valid_rows_only: boolean;
    can_cancel: boolean;
    requires_warning_acknowledgement: boolean;
  };
};

export type LeaveBalanceImportRow = {
  id: number;
  row_number: number;
  employee_no: string | null;
  employee_name: string | null;
  branch_name: string | null;
  department_name: string | null;
  leave_type_code: string | null;
  leave_type_name: string | null;
  uploaded_current_balance: string | null;
  db_current_balance: string | null;
  new_balance: string | null;
  adjustment_days: string | null;
  reason: string | null;
  validation_status: LeaveBalanceImportValidationStatus;
  result_status: LeaveBalanceImportResultStatus | null;
  error_code: string | null;
  message: string | null;
  issues: LeaveBalanceImportIssue[];
  previous_balance_at_import: string | null;
  new_balance_at_import: string | null;
  processed_at: string | null;
};

export type LeaveBalanceImportRowFilter =
  | "ALL"
  | "VALID"
  | "WARNING"
  | "INVALID"
  | "CHANGED"
  | "UNCHANGED"
  | "CONFLICT"
  | "IMPORTED"
  | "SKIPPED"
  | "FAILED";

export type LeaveBalanceImportPage<T> = {
  rows: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type LeaveBalanceTemplateParams = {
  fiscal_year?: string;
  branch_id?: number;
  department_id?: number;
  leave_type_id?: number;
};

function buildLeaveBalanceImportQuery(
  params: Record<string, string | number | null | undefined>,
) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function toLeaveBalanceImportPage<T>(
  payload: unknown,
  fallbackPage: number,
  fallbackLimit: number,
): LeaveBalanceImportPage<T> {
  const record = asRecord(payload);
  const meta = asRecord(record?.meta);
  const rows = Array.isArray(record?.data) ? (record.data as T[]) : [];
  const total = Number(meta?.totalItems ?? rows.length);
  const limit = Number(meta?.itemsPerPage ?? fallbackLimit) || fallbackLimit;
  return {
    rows,
    page: Number(meta?.currentPage ?? fallbackPage) || fallbackPage,
    limit,
    total: Number.isFinite(total) ? total : rows.length,
    totalPages: Math.max(
      1,
      Number(meta?.totalPages ?? Math.ceil(total / limit)) || 1,
    ),
  };
}

async function fetchLeaveBalanceWorkbook(
  token: string,
  path: string,
  fallbackFilename: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
      accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type");
  const buffer = await response.arrayBuffer();

  if (
    !response.ok ||
    !(
      isBinaryContentType(contentType) ||
      isZipOrXlsxMagic(new Uint8Array(buffer))
    )
  ) {
    const payload = parseResponseBodyText(
      new TextDecoder().decode(buffer),
      contentType,
    );
    const error = new Error(
      response.ok
        ? "Unexpected response while downloading the workbook."
        : extractMessage(payload, response.status),
    ) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return {
    blob: new Blob([buffer], {
      type:
        contentType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: filenameFromContentDisposition(
      response.headers.get("content-disposition"),
      fallbackFilename,
    ),
  };
}

/** Template with every eligible Employee + Leave Type row and its current balance. */
export async function downloadLeaveBalanceImportTemplate(
  token: string,
  params: LeaveBalanceTemplateParams = {},
): Promise<{ blob: Blob; filename: string }> {
  return fetchLeaveBalanceWorkbook(
    token,
    `/api/leave/balances/import/template${buildLeaveBalanceImportQuery(params)}`,
    "leave-balance-template.xlsx",
  );
}

/** Uploads and validates a completed template. Balances do not change until confirmation. */
export async function uploadLeaveBalanceImport(
  token: string,
  file: File,
  options: { default_reason?: string } = {},
): Promise<LeaveBalanceImportBatchDetail> {
  const body = new FormData();
  body.set("file", file, file.name || "leave-balance-import.xlsx");
  const defaultReason = options.default_reason?.trim();
  if (defaultReason) body.set("default_reason", defaultReason);

  const response = await fetch(buildUrl("/api/leave/balances/import"), {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
    cache: "no-store",
  });
  invalidateAdminGetCache();

  const contentType = response.headers.get("content-type");
  const payload = parseResponseBodyText(await response.text(), contentType);
  if (!response.ok) {
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
      code?: string;
    };
    error.status = response.status;
    error.payload = payload;
    const code = asRecord(payload)?.code;
    if (typeof code === "string") error.code = code;
    throw error;
  }
  return payload as LeaveBalanceImportBatchDetail;
}

export async function getLeaveBalanceImport(
  token: string,
  batchId: string,
): Promise<LeaveBalanceImportBatchDetail> {
  return adminRequest<LeaveBalanceImportBatchDetail>(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}`,
    { token },
  );
}

export async function listLeaveBalanceImportRows(
  token: string,
  batchId: string,
  params: {
    page?: number;
    limit?: number;
    status?: LeaveBalanceImportRowFilter;
    search?: string;
    leave_type_id?: number;
    branch_id?: number;
    department_id?: number;
  } = {},
): Promise<LeaveBalanceImportPage<LeaveBalanceImportRow>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const payload = await adminRequest<unknown>(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/rows${buildLeaveBalanceImportQuery(
      {
        ...params,
        page,
        limit,
        status: params.status === "ALL" ? undefined : params.status,
      },
    )}`,
    { token },
  );
  return toLeaveBalanceImportPage<LeaveBalanceImportRow>(payload, page, limit);
}

export async function confirmLeaveBalanceImport(
  token: string,
  batchId: string,
  data: {
    import_mode: LeaveBalanceImportMode;
    acknowledge_warnings?: boolean;
    acknowledge_skipped_rows?: boolean;
  },
): Promise<LeaveBalanceImportBatchDetail> {
  return adminRequest<LeaveBalanceImportBatchDetail>(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/confirm`,
    { method: "POST", token, body: data },
  );
}

export async function cancelLeaveBalanceImport(
  token: string,
  batchId: string,
): Promise<LeaveBalanceImportBatchDetail> {
  return adminRequest<LeaveBalanceImportBatchDetail>(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/cancel`,
    { method: "POST", token },
  );
}

export async function listLeaveBalanceImportHistory(
  token: string,
  params: {
    page?: number;
    limit?: number;
    status?: LeaveBalanceImportBatchStatus;
  } = {},
): Promise<LeaveBalanceImportPage<LeaveBalanceImportBatch>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const payload = await adminRequest<unknown>(
    `/api/leave/balances/import/history${buildLeaveBalanceImportQuery({ ...params, page, limit })}`,
    { token },
  );
  return toLeaveBalanceImportPage<LeaveBalanceImportBatch>(
    payload,
    page,
    limit,
  );
}

/** Uploaded rows plus database balance, status, error code and description. */
export async function downloadLeaveBalanceImportReport(
  token: string,
  batchId: string,
): Promise<{ blob: Blob; filename: string }> {
  return fetchLeaveBalanceWorkbook(
    token,
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/report`,
    `leave-balance-import-${batchId}-report.xlsx`,
  );
}

export async function downloadLeaveImportTemplate(
  token: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    buildUrl("/api/leave/requests/import/template"),
    {
      headers: { accept: "*/*", Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      extractMessage(
        parseResponseBodyText(text, response.headers.get("content-type")),
        response.status,
      ),
    );
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i,
  );
  return {
    blob: await response.blob(),
    filename: decodeURIComponent(
      match?.[1] ?? match?.[2] ?? "leave-import-template.xlsx",
    ),
  };
}

async function uploadLeaveRequestImport(
  token: string,
  file: File,
  stage: "preview" | "confirm",
): Promise<LeaveImportResult> {
  const body = new FormData();
  body.set("file", file, file.name || "leave-import.xlsx");
  const endpoint = stage === "preview" ? "preview" : "confirm";
  const response = await fetch(
    buildUrl(`/api/leave/requests/import/${endpoint}`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      cache: "no-store",
    },
  );
  const text = await response.text();
  const payload = parseResponseBodyText(
    text,
    response.headers.get("content-type"),
  );
  if (!response.ok) throw new Error(extractMessage(payload, response.status));
  return payload as LeaveImportResult;
}

export function previewLeaveRequests(token: string, file: File) {
  return uploadLeaveRequestImport(token, file, "preview");
}

export function confirmLeaveRequestsImport(token: string, file: File) {
  return uploadLeaveRequestImport(token, file, "confirm");
}

export async function createMyLeaveRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/leave/requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listMyNotificationPreferences(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/me/notifications/preferences",
    {
      token,
    },
  );
  return normalizeList(payload) as NotificationPreference[];
}

export async function setMyNotificationPreference(
  token: string,
  data: SetMyNotificationPreferenceInput,
) {
  const payload = await adminRequest<unknown>(
    "/api/me/notifications/preferences",
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return (normalizeSingle(payload) as NotificationPreference | null) ?? null;
}

export async function listMyMovements(token: string) {
  const payload = await adminRequest<unknown>("/api/me/movements", { token });
  return normalizeList(payload);
}

export async function getMyMovement(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/movements/${id}`, {
    token,
  });
  return unwrapRootRecord(payload, "id");
}

export async function acknowledgeMyMovement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/movements/${id}/acknowledge`, {
    method: "POST",
    token,
  });
}

export async function listMyActionItems(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/action-items${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyRequests(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/requests${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listAllMyActionItems(token: string) {
  const records: AdminRecord[] = [];
  for (let page = 1; ; page += 1) {
    const rows = await listMyActionItems(token, { page, limit: 100 });
    records.push(...rows);
    if (rows.length < 100) return records;
  }
}

export async function reportMyActionItemIssue(
  token: string,
  id: string | number,
  comment: string,
) {
  return adminRequest<unknown>(`/api/me/action-items/${id}/comments`, {
    method: "POST",
    token,
    body: { comment },
  });
}

export async function listMyDocuments(token: string) {
  const payload = await adminRequest<unknown>("/api/me/documents", { token });
  return normalizeList(payload);
}

export async function uploadMyDocument(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/documents", {
    method: "POST",
    token,
    body: data,
  });
}

export async function downloadAdminBlob(
  path: string,
  token: string,
  fallbackName: string,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*?=(?:UTF-8''|"?)([^";]+)/i,
  );
  return {
    blob,
    filename: filenameMatch?.[1]
      ? decodeURIComponent(filenameMatch[1])
      : fallbackName,
    contentType: response.headers.get("content-type"),
  };
}

export async function downloadMyDocument(
  token: string,
  id: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  return downloadAdminBlob(
    `/api/me/documents/${id}/download`,
    token,
    `document-${id}`,
  );
}

export async function submitMyResignation(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/resignation", {
    method: "POST",
    token,
    body: data,
  });
}

function looksLikeProfileChangeRequest(
  value: AdminRecord | null,
): value is AdminRecord {
  if (!value) return false;
  return (
    "request_type" in value ||
    "requestType" in value ||
    "reference_number" in value ||
    "referenceNumber" in value ||
    "items" in value ||
    "files" in value
  );
}

/** Keep the request root instead of peeling it down to metadata/employee. */
function normalizeProfileChangeRequestDetail(
  payload: unknown,
): AdminRecord | null {
  const root = asRecord(payload);
  if (!root) return normalizeSingle(payload);

  const candidates = [
    root,
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.request),
    asRecord(root.profile_change_request),
    asRecord(root.profileChangeRequest),
  ];
  for (const candidate of candidates) {
    if (looksLikeProfileChangeRequest(candidate)) return candidate;
  }

  return normalizeSingle(payload) ?? root;
}

export async function listMyProfileChangeRequests(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/profile-change-requests${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function createMyProfileChangeRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/profile-change-requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function validateMyProfileChangeRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/profile-change-requests/validate", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/profile-change-requests/${id}`,
    { token },
  );
  return normalizeProfileChangeRequestDetail(payload);
}

export async function updateMyProfileChangeRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/profile-change-requests/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/profile-change-requests/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function submitMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/profile-change-requests/${id}/submit`, {
    method: "POST",
    token,
  });
}

export async function cancelMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/profile-change-requests/${id}/cancel`, {
    method: "POST",
    token,
  });
}

export async function listMyProfileChangeRequestHistory(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/profile-change-requests/${id}/history`,
    { token },
  );
  return normalizeList(payload);
}

export async function previewMyProfileChangeRequestFile(
  token: string,
  id: string | number,
  fileId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  return downloadAdminBlob(
    `/api/me/profile-change-requests/${id}/files/${fileId}`,
    token,
    `profile-change-${id}-file-${fileId}`,
  );
}

export async function uploadMyProfileChangePhoto(token: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(
    buildUrl("/api/me/profile-change-requests/profile-photo"),
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      cache: "no-store",
    },
  );

  invalidateAdminGetCache();

  const contentType = response.headers.get("content-type");
  const text = await response.text();
  const payload = parseResponseBodyText(text, contentType);

  if (!response.ok) {
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return normalizeSingle(payload) ?? asRecord(payload) ?? payload;
}

export async function listHrProfileChangeRequests(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/profile-change-requests${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getHrProfileChangeRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/profile-change-requests/${id}`,
    { token },
  );
  return normalizeProfileChangeRequestDetail(payload);
}

export async function startHrProfileChangeReview(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/hr/profile-change-requests/${id}/start-review`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function approveHrProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/hr/profile-change-requests/${id}/approve`,
    {
      method: "POST",
      token,
    },
  );
}

export async function rejectHrProfileChangeRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/hr/profile-change-requests/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function requestHrProfileChangeCorrection(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/hr/profile-change-requests/${id}/request-correction`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listHrProfileChangeRequestHistory(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/profile-change-requests/${id}/history`,
    { token },
  );
  return normalizeList(payload);
}

export async function previewHrProfileChangeRequestFile(
  token: string,
  id: string | number,
  fileId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  return downloadAdminBlob(
    `/api/hr/profile-change-requests/${id}/files/${fileId}`,
    token,
    `profile-change-${id}-file-${fileId}`,
  );
}

export async function listMyPayslips(token: string) {
  const payload = await adminRequest<unknown>("/api/me/payslips", { token });
  return normalizeList(payload);
}

export async function getMyPayslip(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/payslips/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function downloadMyPayslip(
  token: string,
  id: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(buildUrl(`/api/me/payslips/${id}/download`), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `my-payslip-${id}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function listMyLeaveRequests(
  token: string,
  params: LeaveRequestsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveRequestsQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/leave/requests${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listMyLeaveEncashmentRequests(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/leave/encashments/me", { token }),
  );
}

export async function createMyLeaveEncashmentRequest(
  token: string,
  data: {
    leave_type_id: number;
    fiscal_year: string;
    requested_days: number;
    reason: string;
  },
) {
  return adminRequest<unknown>("/api/leave/encashments", {
    method: "POST",
    token,
    body: data,
  });
}

export async function cancelMyLeaveEncashmentRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/leave/encashments/${id}/cancel`, {
    method: "POST",
    token,
  });
}

export async function decideLeaveEncashmentRequest(
  token: string,
  id: string | number,
  data: { approve: boolean; approved_days?: number; comments?: string },
) {
  return adminRequest<unknown>(`/api/leave/encashments/${id}/decision`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function recordLeaveEncashmentPayrollHandoff(
  token: string,
  id: string | number,
  reference: string,
) {
  return adminRequest<unknown>(`/api/leave/encashments/${id}/payroll-handoff`, {
    method: "POST",
    token,
    body: { reference },
  });
}

export async function getMyLeaveRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/leave/requests/${id}`, {
    token,
  });
  return normalizeLeaveRequestDetail(payload);
}

export async function submitMyLeaveRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/submit`, {
    method: "POST",
    token,
  });
}

export async function cancelMyLeaveRequest(
  token: string,
  id: string | number,
  reason: string,
) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function getMyLeaveRequestPdf(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/pdf`, { token });
}

export async function downloadMyLeaveRequestPdf(
  token: string,
  id: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(buildUrl(`/api/me/leave/requests/${id}/pdf`), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `leave-request-${id}.pdf`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function getLeaveRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/leave/requests/${id}`, {
    token,
  });
  return normalizeLeaveRequestDetail(payload);
}

export async function leaveRequestApprovalAction(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/leave/requests/${id}/approval-action`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function cancelLeaveRequest(
  token: string,
  id: string | number,
  reason: string,
) {
  return adminRequest<unknown>(`/api/leave/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export type LeaveBalanceAdjustMode = "ADD" | "DEDUCT" | "SET";

export async function adjustLeaveBalance(
  token: string,
  data: {
    employee_id: number;
    leave_type_id: number;
    fiscal_year: string;
    mode: LeaveBalanceAdjustMode;
    amount: number;
    reason: string;
  },
) {
  return adminRequest<unknown>("/api/leave/balances/adjust", {
    method: "PATCH",
    token,
    body: {
      employee_id: data.employee_id,
      leave_type_id: data.leave_type_id,
      fiscal_year: data.fiscal_year,
      mode: data.mode,
      amount: data.amount,
      reason: data.reason,
    },
  });
}

export async function generateLeaveBalances(
  token: string,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>("/api/leave/balances/generate", {
    method: "POST",
    token,
    body: data,
  });
}

export async function carryForwardLeaveBalances(
  token: string,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>("/api/leave/balances/carry-forward", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listLeaveBalanceAdjustments(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/leave/balances/adjustments${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listLeaveBalanceTransactions(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/leave/balances/transactions${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listAllLeaveBalanceReconciliation(
  token: string,
  fiscalYear: string,
): Promise<AdminRecord[]> {
  const rows: AdminRecord[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 50; page += 1) {
    const query = buildRecordQuery({
      fiscal_year: fiscalYear,
      page,
      limit: pageSize,
    });
    const payload = await adminRequest<unknown>(
      `/api/leave/balances/reconciliation${query}`,
      {
        token,
        cacheTtlMs: 0,
      },
    );
    const pageRows = normalizeList(payload);
    rows.push(...pageRows);
    const root = asRecord(payload);
    const meta = asRecord(root?.meta);
    const total = Number(meta?.total ?? 0);
    const totalPages = Number(meta?.totalPages ?? meta?.total_pages ?? 0);
    if (
      pageRows.length === 0 ||
      pageRows.length < pageSize ||
      (totalPages > 0 && page >= totalPages) ||
      (total > 0 && rows.length >= total)
    )
      break;
  }
  return rows;
}

export async function submitLeaveRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/requests/${id}/submit`, {
    method: "POST",
    token,
  });
}

export async function resubmitLeaveRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/requests/${id}/resubmit`, {
    method: "POST",
    token,
  });
}

export async function createLeaveHoliday(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/holidays", {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchLeaveHoliday(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/leave/holidays/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeaveHoliday(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/holidays/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createLeavePolicy(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/policies", {
    method: "POST",
    token,
    body: data,
  });
}

function looksLikeLeavePolicy(record: AdminRecord | null): boolean {
  if (!record) {
    return false;
  }
  const hasName = "name" in record || "title" in record;
  if (!hasName) {
    return false;
  }
  return (
    "accrual_method" in record ||
    "accrualMethod" in record ||
    "leave_types" in record ||
    "leaveTypes" in record ||
    "max_consecutive_days" in record ||
    "maxConsecutiveDays" in record ||
    "allow_during_probation" in record ||
    "allowDuringProbation" in record ||
    "applicable_department_id" in record ||
    "applicableDepartmentId" in record
  );
}

function unwrapLeavePolicy(payload: unknown): AdminRecord | null {
  const root = asRecord(payload);
  if (!root) {
    const list = asArray(payload);
    return list?.[0] ?? null;
  }
  if (looksLikeLeavePolicy(root)) {
    return root;
  }

  const wrappers = [
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.payload),
    asRecord(root.policy),
    asRecord(root.leave_policy),
    asRecord(root.leavePolicy),
  ];

  for (const wrapper of wrappers) {
    if (looksLikeLeavePolicy(wrapper)) {
      return wrapper;
    }
    const nested =
      asRecord(wrapper?.policy) ??
      asRecord(wrapper?.leave_policy) ??
      asRecord(wrapper?.leavePolicy) ??
      asRecord(wrapper?.data);
    if (looksLikeLeavePolicy(nested)) {
      return nested;
    }
  }

  return null;
}

export async function getLeavePolicy(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/leave/policies/${id}`, {
    token,
  });
  const root = asRecord(payload);
  const wrapper =
    asRecord(root?.data) ?? asRecord(root?.result) ?? asRecord(root?.item);
  const source =
    unwrapLeavePolicy(payload) ?? normalizeSingle(payload) ?? wrapper ?? root;
  if (!source) {
    return null;
  }

  const leaveTypes =
    source.leave_types ??
    source.leaveTypes ??
    wrapper?.leave_types ??
    wrapper?.leaveTypes ??
    root?.leave_types ??
    root?.leaveTypes;

  if (leaveTypes !== undefined && source.leave_types === undefined) {
    return { ...source, leave_types: leaveTypes };
  }
  return source;
}

export async function patchLeavePolicy(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/leave/policies/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeavePolicy(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/policies/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createLeaveWorkflow(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/workflows", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getLeaveWorkflow(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/leave/workflows/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function patchLeaveWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/leave/workflows/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeaveWorkflow(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/workflows/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listLeaveWorkflowSteps(
  token: string,
  workflowId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/leave/workflows/${workflowId}/steps`,
    { token },
  );
  return normalizeList(payload);
}

export async function createLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/leave/workflows/${workflowId}/steps`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/leave/workflows/${workflowId}/steps/${stepId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deleteLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
) {
  return adminRequest<unknown>(
    `/api/leave/workflows/${workflowId}/steps/${stepId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function addLeaveRequestDocument(
  token: string,
  leaveRequestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/leave/requests/${leaveRequestId}/documents`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function patchLeaveRequestMedicalDetail(
  token: string,
  leaveRequestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/leave/requests/${leaveRequestId}/medical-detail`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export function getLeaveRequestPdfUrl(id: string | number) {
  return buildUrl(`/api/leave/requests/${id}/pdf`);
}

export async function downloadLeaveRequestPdf(
  token: string,
  id: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(buildUrl(`/api/leave/requests/${id}/pdf`), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `leave-request-${id}.pdf`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function downloadLeaveRequestDocument(
  token: string,
  leaveRequestId: string | number,
  documentId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(
      `/api/leave/requests/${leaveRequestId}/documents/${documentId}/download`,
    ),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `leave-document-${documentId}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export type OnboardingWorkflowStepPayload = {
  is_required: boolean;
  name: string;
  description: string;
  step_type: string;
  assigned_role_id?: number;
  assigned_user_id?: number;
  assigned_department_id?: number;
  metadata?: AdminRecord;
  due_days: number;
  step_order?: number;
};

export type CreateOnboardingWorkflowPayload = {
  is_default?: boolean;
  status?: string;
  name: string;
  description?: string;
  steps?: OnboardingWorkflowStepPayload[];
};

export async function createOnboardingWorkflow(
  token: string,
  data: CreateOnboardingWorkflowPayload | AdminRecord,
) {
  return adminRequest<unknown>("/api/onboarding/workflows", {
    method: "POST",
    token,
    body: data,
  });
}

export async function cloneOnboardingWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${id}/clone`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getOnboardingWorkflow(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/workflows/${id}`,
    { token },
  );
  const single = normalizeSingle(payload);
  const root = asRecord(payload);

  // Prefer the normalized record, but re-attach step arrays that may live on the envelope
  // (e.g. { data: { name, … }, steps: [...] } or { workflow: {…}, steps: [...] }).
  if (single) {
    const rootSteps =
      root?.steps ??
      root?.workflow_steps ??
      root?.workflowSteps ??
      asRecord(root?.data)?.steps ??
      asRecord(root?.data)?.workflow_steps ??
      asRecord(root?.result)?.steps ??
      asRecord(root?.result)?.workflow_steps;

    if (
      rootSteps &&
      !single.steps &&
      !single.workflow_steps &&
      !single.workflowSteps
    ) {
      return { ...single, steps: rootSteps };
    }
    return single;
  }

  return root;
}

export async function listOnboardingWorkflowSteps(
  token: string,
  workflowId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/workflows/${workflowId}/steps`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function patchOnboardingWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteOnboardingWorkflow(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  data: OnboardingWorkflowStepPayload | AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/workflows/${workflowId}/steps`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function patchOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
  data: Partial<OnboardingWorkflowStepPayload> | AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/workflows/${workflowId}/steps/${stepId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deleteOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
) {
  return adminRequest<unknown>(
    `/api/onboarding/workflows/${workflowId}/steps/${stepId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function createOnboardingRequest(
  token: string,
  data: CreateOnboardingRequestPayload,
) {
  return adminRequest<unknown>("/api/onboarding/requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function ensureDraftOnboardingRequest(
  token: string,
  data: {
    employee_id: number;
    workflow_id?: number;
    title: string;
  },
) {
  try {
    const payload = await createOnboardingRequest(token, {
      employee_id: data.employee_id,
      workflow_id: data.workflow_id,
      title: data.title,
      submit: false,
    });
    return (normalizeSingle(payload) ?? asRecord(payload) ?? {}) as AdminRecord;
  } catch (errorObject) {
    if (
      /already has active onboarding request/i.test(
        errorMessageAndPayload(errorObject),
      )
    ) {
      return null;
    }
    throw errorObject;
  }
}

export async function startOrDraftOnboardingRequest(
  token: string,
  data: CreateOnboardingRequestPayload,
): Promise<{ request: AdminRecord | null; submitted: boolean }> {
  try {
    const payload = await createOnboardingRequest(token, {
      ...data,
      submit: data.submit !== false,
    });
    return {
      request: (normalizeSingle(payload) ??
        asRecord(payload) ??
        {}) as AdminRecord,
      submitted: data.submit !== false,
    };
  } catch (errorObject) {
    if (
      !isMissingOnboardingApprover(errorObject) &&
      !isExistingOnboardingConflict(errorObject)
    ) {
      throw errorObject;
    }
    const draft = await ensureDraftOnboardingRequest(token, {
      employee_id: data.employee_id,
      workflow_id: data.workflow_id,
      title: data.title,
    });
    return { request: draft, submitted: false };
  }
}

export async function getOnboardingRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests/${id}`,
    { token },
  );
  return unwrapOnboardingRequest(payload);
}

export async function patchOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function approveOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  const comments =
    typeof data.comments === "string" ? data.comments.trim() : "";
  const signatureUrl =
    typeof data.signature_url === "string" ? data.signature_url.trim() : "";
  const body: AdminRecord = {};
  if (typeof data.approve === "boolean") {
    body.approve = data.approve;
  }
  if (comments) {
    body.comments = comments;
  }
  // Empty signature_url fails URL validation on the backend.
  if (signatureUrl) {
    body.signature_url = signatureUrl;
  }
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/approve`, {
    method: "POST",
    token,
    body,
  });
}

export async function rejectOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function cancelOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function completeOnboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/complete`, {
    method: "POST",
    token,
  });
}

function looksLikeOnboardingRequest(record: AdminRecord | null) {
  if (!record) {
    return false;
  }
  if (
    record.employee_id != null ||
    record.employeeId != null ||
    record.onboarding_no != null ||
    record.onboardingNo != null ||
    record.current_approval_level != null ||
    record.currentApprovalLevel != null
  ) {
    return true;
  }
  const status =
    typeof record.status === "string" ? record.status.toLowerCase() : "";
  return Boolean(
    (record.title || record.workflow_id || record.workflowId) &&
    /draft|submitted|in_review|in_progress|ready_for_activation|completed|rejected|cancelled/.test(
      status,
    ),
  );
}

function collectOnboardingRecords(
  value: unknown,
  sink: AdminRecord[],
  depth = 0,
) {
  if (depth > 5 || value == null) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectOnboardingRecords(entry, sink, depth + 1));
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  sink.push(record);
  for (const key of [
    "data",
    "result",
    "item",
    "request",
    "onboarding_request",
    "onboardingRequest",
  ]) {
    collectOnboardingRecords(record[key], sink, depth + 1);
  }
}

function unwrapOnboardingRequest(payload: unknown): AdminRecord | null {
  const candidates: AdminRecord[] = [];
  collectOnboardingRecords(payload, candidates);
  return (
    candidates.find((row) => looksLikeOnboardingRequest(row)) ??
    normalizeSingle(payload)
  );
}

function isExistingOnboardingConflict(errorObject: unknown) {
  const status =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "status" in errorObject &&
    typeof (errorObject as { status?: unknown }).status === "number"
      ? (errorObject as { status: number }).status
      : null;
  const message = errorMessageAndPayload(errorObject);
  return (
    status === 409 ||
    /already has (an )?active onboarding request/i.test(message) ||
    /already has onboarding request/i.test(message)
  );
}

export async function submitOnboardingRequest(
  token: string,
  id: string | number,
  options: { allow_incomplete_employee_details?: boolean } = {},
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/submit`, {
    method: "POST",
    token,
    body: options,
  });
}

export async function submitMyOnboardingDetails(
  token: string,
  id: string | number,
  options: { not_provided_items?: string[] } = {},
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${id}/employee-details/submit`,
    { method: "POST", token, body: options },
  );
}

export async function reviewOnboardingEmployeeDetails(
  token: string,
  id: string | number,
  sections: Array<{
    section_key: string;
    status: "approved" | "changes_requested";
    comment?: string;
  }>,
  expectedVersion?: number,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${id}/employee-details/review`,
    {
      method: "POST",
      token,
      body: {
        sections,
        ...(expectedVersion ? { expected_version: expectedVersion } : {}),
      },
    },
  );
}

export async function reactivateOnboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}`, {
    method: "PATCH",
    token,
    body: {
      status: "active",
    },
  });
}

export async function deleteOnboardingRequest(
  token: string,
  id: string | number,
) {
  return cancelOnboardingRequest(token, id, {
    reason: "Cancelled by admin",
  });
}

export async function uploadOnboardingDocument(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/documents`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function uploadMyOnboardingDocument(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/onboarding/${requestId}/documents`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listOnboardingDocuments(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/documents`,
    { token },
  );
  return normalizeList(payload);
}

export async function updateOnboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/documents/${documentId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deleteOnboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/documents/${documentId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function downloadOnboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(
      `/api/onboarding/requests/${requestId}/documents/${documentId}/download`,
    ),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ??
    filenameMatch?.[2] ??
    `onboarding-document-${documentId}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function verifyOnboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/documents/${documentId}/verify`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function createOnboardingTask(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${requestId}/tasks`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listOnboardingTasks(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/tasks`,
    { token },
  );
  return normalizeList(payload);
}

export async function getOnboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/tasks/${taskId}`,
    { token },
  );
  return normalizeSingle(payload);
}

export async function reassignOnboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/tasks/${taskId}/assign`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function completeOnboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/tasks/${taskId}/complete`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export type OnboardingReadinessRequirement = {
  id: string;
  label: string;
  group: string;
  owner: string;
  required: boolean;
  status: "complete" | "pending" | "blocked" | "skipped";
  action: "details" | "tasks" | "approvals" | "payroll" | "contracts";
  waiting_reason?: string | null;
  due_date?: string | null;
  actionable?: boolean;
};

export type OnboardingReadiness = {
  employee_id: number;
  employee_status: string;
  request_status: string;
  ready_to_activate: boolean;
  closed: boolean;
  blocker_count: number;
  completed_required: number;
  total_required: number;
  next_action: OnboardingReadinessRequirement | null;
  requirements: OnboardingReadinessRequirement[];
};

export async function getOnboardingReadiness(
  token: string,
  requestId: string | number,
) {
  return adminRequest<OnboardingReadiness>(
    `/api/onboarding/requests/${requestId}/readiness`,
    { token },
  );
}

export type OnboardingOverviewRow = {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_no: string;
  onboarding_no: string;
  department: string;
  stage: string;
  overdue: boolean;
  overdue_task_count: number;
  planned_completion_date: string | null;
  owners: string[];
  blockers: OnboardingReadinessRequirement[];
  readiness: OnboardingReadiness;
  planned_start_date?: string | null;
  attention_reasons?: string[];
};

export type OnboardingWorkspaceNote = {
  id: number;
  requirement_id: string;
  visibility: "internal" | "employee";
  body: string;
  author_name: string;
  created_at: string;
};

export function getOnboardingWorkspaceNotes(
  token: string,
  requestId: number,
  employeeView = false,
) {
  return adminRequest<OnboardingWorkspaceNote[]>(
    `/api/onboarding/requests/${requestId}/workspace/${employeeView ? "my-notes" : "notes"}`,
    { token },
  );
}

export function addOnboardingWorkspaceNote(
  token: string,
  requestId: number,
  data: {
    requirement_id: string;
    visibility: "internal" | "employee";
    body: string;
    client_key: string;
  },
) {
  return adminRequest(`/api/onboarding/requests/${requestId}/workspace/notes`, {
    token,
    method: "POST",
    body: data,
  });
}

export function visitOnboardingWorkspace(token: string, requestId: number) {
  return adminRequest<{ previous_viewed_at: string | null; viewed_at: string }>(
    `/api/onboarding/requests/${requestId}/workspace/visit`,
    { token, method: "POST", invalidateCache: false },
  );
}

export async function getOnboardingOverview(token: string, after = 0) {
  return adminRequest<{
    data: OnboardingOverviewRow[];
    next_cursor: number | null;
  }>(`/api/onboarding/requests/overview?after=${after}`, { token });
}

export async function getOnboardingProgress(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/progress`,
    { token },
  );
  return asRecord(payload) ?? {};
}

export async function getOnboardingAuditLogs(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/audit-logs`,
    { token },
  );
  return normalizeList(payload);
}

/** GET /api/me/onboarding — current employee's onboarding requests. */
export async function listMyOnboardingRequests(
  token: string,
): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>("/api/me/onboarding", {
      token,
    });
    return normalizeList(payload);
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return [];
    throw error;
  }
}

/**
 * POST /api/onboarding/requests/{id}/acknowledge
 * Body: { accepted, acknowledgement_version }
 */
export async function acknowledgeOnboardingRequest(
  token: string,
  id: string | number,
  data: { accepted: boolean; acknowledgement_version: string; acknowledgement_document_id?: number },
) {
  const version = data.acknowledgement_version.trim();
  if (!version) {
    throw new Error("Acknowledgement version is required.");
  }
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/acknowledge`, {
    method: "POST",
    token,
    body: {
      accepted: data.accepted === true,
      acknowledgement_version: version.slice(0, 50),
      acknowledgement_document_id: data.acknowledgement_document_id,
    },
  });
}

/**
 * POST /api/onboarding/requests/{id}/approvals/{approvalId}/delegate
 * Body: { delegate_company_user_id, reason }
 */
export async function delegateOnboardingApproval(
  token: string,
  requestId: string | number,
  approvalId: string | number,
  data: { delegate_company_user_id: number; reason: string },
) {
  const delegateId = Number(data.delegate_company_user_id);
  const reason = data.reason.trim();
  if (!Number.isFinite(delegateId) || delegateId < 1) {
    throw new Error("A valid company user is required to delegate.");
  }
  if (!reason) {
    throw new Error("A delegation reason is required.");
  }
  return adminRequest<unknown>(
    `/api/onboarding/requests/${requestId}/approvals/${approvalId}/delegate`,
    {
      method: "POST",
      token,
      body: {
        delegate_company_user_id: Math.trunc(delegateId),
        reason: reason.slice(0, 1000),
      },
    },
  );
}

export async function createOffboardingWorkflow(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/offboarding/workflows", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getOffboardingWorkflow(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/workflows/${id}`,
    { token },
  );
  return normalizeSingle(payload);
}

export async function patchOffboardingWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteOffboardingWorkflow(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/workflows/${workflowId}/steps`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function patchOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/workflows/${workflowId}/steps/${stepId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deleteOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
) {
  return adminRequest<unknown>(
    `/api/offboarding/workflows/${workflowId}/steps/${stepId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function createOffboardingRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/offboarding/requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getOffboardingRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${id}`,
    { token },
  );
  return normalizeSingle(payload);
}

export async function patchOffboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function submitOffboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/submit`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function approveOffboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/approve`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function rejectOffboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function cancelOffboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function completeOffboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/complete`, {
    method: "POST",
    token,
  });
}

export async function finalizeOffboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/finalize`, {
    method: "POST",
    token,
  });
}

export async function addOffboardingDocument(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/documents`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listOffboardingDocuments(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/documents`,
    { token },
  );
  return normalizeList(payload);
}

/**
 * PATCH /api/offboarding/requests/{id}/documents/{documentId}
 * Body: { title?, description?, expiry_date? }
 */
export async function updateOffboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/documents/${documentId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

/** DELETE /api/offboarding/requests/{id}/documents/{documentId} */
export async function deleteOffboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/documents/${documentId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function downloadOffboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(
      `/api/offboarding/requests/${requestId}/documents/${documentId}/download`,
    ),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ??
    filenameMatch?.[2] ??
    `offboarding-document-${documentId}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function createOffboardingTask(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/tasks`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function completeOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/complete`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function rejectOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/reject`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function createOffboardingClearance(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/clearances`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function completeOffboardingClearance(
  token: string,
  requestId: string | number,
  clearanceId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/clearances/${clearanceId}/complete`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

/**
 * PATCH /api/offboarding/requests/{id}/clearances/{clearanceId}/assign
 * Body: { owner_company_user_id, due_date?, remarks? }
 */
export async function assignOffboardingClearance(
  token: string,
  requestId: string | number,
  clearanceId: string | number,
  data: {
    owner_company_user_id: number;
    due_date?: string;
    remarks?: string;
  },
) {
  const ownerId = Number(data.owner_company_user_id);
  if (!Number.isFinite(ownerId) || ownerId < 1) {
    throw new Error("A clearance owner is required.");
  }
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/clearances/${clearanceId}/assign`,
    {
      method: "PATCH",
      token,
      body: {
        owner_company_user_id: Math.trunc(ownerId),
        due_date: data.due_date?.trim() || undefined,
        remarks: data.remarks?.trim() || undefined,
      },
    },
  );
}

export async function getOffboardingProgress(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/progress`,
    { token },
  );
  return asRecord(payload) ?? {};
}

export async function getOffboardingApprovals(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/approvals`,
    { token },
  );
  return normalizeList(payload);
}

export async function getOffboardingAuditLogs(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/audit-logs`,
    { token },
  );
  return normalizeList(payload);
}

export async function getOffboardingDashboard(token: string) {
  const payload = await adminRequest<unknown>("/api/offboarding/dashboard", {
    token,
  });
  return asRecord(payload) ?? normalizeSingle(payload) ?? {};
}

function isForbiddenOrMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  if (status === 401 || status === 403 || status === 404) return true;
  const message = String(
    (error as { message?: string }).message ?? "",
  ).toLowerCase();
  return (
    message.includes("forbidden") ||
    message.includes("not allowed") ||
    message.includes("unauthorized") ||
    message.includes("access denied") ||
    message.includes("not found")
  );
}

/**
 * Soft-read helpers for "my" offboarding queues.
 * Many employee roles are not granted these endpoints (403 Forbidden resource).
 * Callers should treat an empty array as "none" and optionally fall back.
 */
/** GET /api/me/offboarding — current employee's offboarding requests. */
export async function listMyOffboardingRequests(
  token: string,
): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>("/api/me/offboarding", {
      token,
    });
    return normalizeList(payload);
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return [];
    throw error;
  }
}

export async function listMyOffboardingApprovals(
  token: string,
): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>(
      "/api/offboarding/approvals/my",
      { token },
    );
    return normalizeList(payload);
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return [];
    throw error;
  }
}

export async function listMyOffboardingTasks(
  token: string,
): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>("/api/offboarding/tasks/my", {
      token,
    });
    return normalizeList(payload);
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return [];
    throw error;
  }
}

export async function listMyOffboardingClearances(
  token: string,
): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>(
      "/api/offboarding/clearances/my",
      { token },
    );
    return normalizeList(payload);
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return [];
    throw error;
  }
}

/** Pull nested task/clearance arrays from a request detail or progress payload. */
export function extractOffboardingItemsFromRecord(
  record: AdminRecord | null | undefined,
  kinds: Array<"tasks" | "clearances">,
): { tasks: AdminRecord[]; clearances: AdminRecord[] } {
  const root = asRecord(record) ?? {};
  const nested =
    asRecord(root.data) ??
    asRecord(root.result) ??
    asRecord(root.item) ??
    asRecord(root.progress) ??
    root;

  const collect = (keys: string[]): AdminRecord[] => {
    for (const key of keys) {
      const value = nested[key] ?? root[key];
      if (Array.isArray(value)) {
        return value.filter(
          (entry): entry is AdminRecord =>
            typeof entry === "object" && entry !== null,
        );
      }
    }
    return [];
  };

  return {
    tasks: kinds.includes("tasks")
      ? collect([
          "tasks",
          "task_list",
          "taskList",
          "assigned_tasks",
          "my_tasks",
        ])
      : [],
    clearances: kinds.includes("clearances")
      ? collect([
          "clearances",
          "clearance_list",
          "clearanceList",
          "assigned_clearances",
          "my_clearances",
        ])
      : [],
  };
}

/**
 * Fallback when GET /tasks/my or /clearances/my is forbidden for the actor:
 * load the actor's offboarding requests and harvest nested items from detail/progress.
 */
export async function listOffboardingItemsFromOwnRequests(
  token: string,
  kind: "tasks" | "clearances",
  employeeId?: number | null,
): Promise<AdminRecord[]> {
  const requestsResult = await listOffboardingRequests(token, {
    page: 1,
    limit: 50,
    sortBy: "created_at",
    sortOrder: "DESC",
    employee_id: employeeId && employeeId > 0 ? employeeId : undefined,
  });

  const items: AdminRecord[] = [];
  const seen = new Set<string>();

  for (const request of requestsResult.rows) {
    const requestId = (() => {
      const id = request.id ?? request.request_id;
      if (typeof id === "number" && Number.isFinite(id)) return id;
      if (typeof id === "string" && id.trim()) return id.trim();
      return null;
    })();
    if (requestId === null) continue;

    let detail: AdminRecord | null = null;
    let progress: AdminRecord | null = null;
    try {
      detail = (await getOffboardingRequest(
        token,
        requestId,
      )) as AdminRecord | null;
    } catch {
      detail = null;
    }
    try {
      progress = (await getOffboardingProgress(
        token,
        requestId,
      )) as AdminRecord | null;
    } catch {
      progress = null;
    }

    const fromDetail = extractOffboardingItemsFromRecord(detail, [kind]);
    const fromProgress = extractOffboardingItemsFromRecord(progress, [kind]);
    const fromRequest = extractOffboardingItemsFromRecord(request, [kind]);
    const batch =
      kind === "tasks"
        ? [...fromDetail.tasks, ...fromProgress.tasks, ...fromRequest.tasks]
        : [
            ...fromDetail.clearances,
            ...fromProgress.clearances,
            ...fromRequest.clearances,
          ];

    for (const row of batch) {
      const itemId = row.id ?? row.task_id ?? row.clearance_id;
      const key = `${requestId}:${String(itemId ?? JSON.stringify(row).slice(0, 40))}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        ...row,
        offboarding_request_id: requestId,
        request_id: requestId,
      });
    }
  }

  return items;
}

export async function listOffboardingActions(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/actions`,
    { token },
  );
  return normalizeList(payload);
}

export async function createOffboardingAction(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/actions`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

/** PATCH /api/offboarding/requests/{id}/actions/{actionId} */
export async function updateOffboardingAction(
  token: string,
  requestId: string | number,
  actionId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/actions/${actionId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function listOffboardingAssets(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/assets`,
    { token },
  );
  return normalizeList(payload);
}

export async function createOffboardingAsset(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/assets`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

/** PATCH /api/offboarding/requests/{id}/assets/{assetReturnId} */
export async function updateOffboardingAssetReturn(
  token: string,
  requestId: string | number,
  assetReturnId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/assets/${assetReturnId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function listOffboardingSettlements(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/settlements`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listOffboardingLetters(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/letters`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listOffboardingAccessOperations(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/access-operations`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createOffboardingSettlement(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/settlements`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function getOffboardingExitInterview(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/exit-interview`,
    {
      token,
    },
  );
  return asRecord(payload) ?? normalizeSingle(payload);
}

export async function updateOffboardingExitInterview(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/exit-interview`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function reopenOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/reopen`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function emergencyOffboardingAccessTermination(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/access-termination/emergency`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function retryOffboardingAccessTermination(
  token: string,
  requestId: string | number,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/access-termination/retry`,
    {
      method: "POST",
      token,
    },
  );
}

export async function delegateOffboardingApproval(
  token: string,
  requestId: string | number,
  approvalId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/approvals/${approvalId}/delegate`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function updateOffboardingSettlement(
  token: string,
  requestId: string | number,
  itemId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/settlements/${itemId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function reassignOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/reassign`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function createEmployeeFinanceOffboardingRecoveries(
  token: string,
  offboardingRequestId: string | number,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/offboarding/${offboardingRequestId}/recoveries`,
    {
      method: "POST",
      token,
    },
  );
}

export async function getCurrentAdmin(token: string) {
  const payload = await adminRequest<unknown>("/api/users/me", {
    token,
    cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
  });
  return normalizeSingle(payload);
}

export async function getCurrentAdminProfile(token: string) {
  const payload = await adminRequest<unknown>("/api/users/me", { token });
  return normalizeSingle(payload);
}

function looksLikeCompanyRecord(row: AdminRecord | null): row is AdminRecord {
  if (!row) return false;
  return (
    typeof row.company_name === "string" ||
    typeof row.companyName === "string" ||
    typeof row.company_slug === "string" ||
    typeof row.companySlug === "string" ||
    typeof row.slug === "string" ||
    (typeof row.name === "string" &&
      (row.company_id !== undefined ||
        row.companyId !== undefined ||
        row.setup_complete !== undefined ||
        row.setupComplete !== undefined ||
        row.company_status !== undefined))
  );
}

function extractCompanyRecord(payload: unknown): AdminRecord | null {
  const root = asRecord(payload);
  const nested =
    asRecord(root?.data) ??
    asRecord(root?.result) ??
    asRecord(root?.company) ??
    asRecord(asRecord(root?.data)?.company);
  if (looksLikeCompanyRecord(nested)) {
    return nested;
  }
  if (looksLikeCompanyRecord(root)) {
    return root;
  }
  const list = normalizeList(payload);
  return list.find(looksLikeCompanyRecord) ?? null;
}

export async function getMyCompany(token: string) {
  const payload = await adminRequest<unknown>("/api/companies/my", { token });
  return extractCompanyRecord(payload);
}

/** Companies the authenticated user may enter with POST /api/auth/switch-company. */
export async function listMyCompanies(token: string) {
  const payload = await adminRequest<unknown>("/api/companies/my", {
    token,
    cacheTtlMs: 0,
  });
  return dedupeAdminRecordsById(normalizeList(payload));
}

function payloadDeniesPlatformAccess(payload: unknown) {
  const record = asRecord(payload);
  const haystack = [
    record?.message,
    record?.error,
    record?.details,
    record?.code,
  ]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /platform access is required/i.test(haystack);
}

/**
 * GET /api/companies is platform-scope only. Company-scoped System
 * Administrators receive 403 "Platform access is required" even when the JWT
 * includes companies:read. Throws that as a 403 so the nav can hide the page.
 */
export async function probePlatformCompaniesList(token: string) {
  const payload = await adminRequest<unknown>("/api/companies", {
    token,
    cacheTtlMs: 0,
  });
  if (payloadDeniesPlatformAccess(payload)) {
    const error = new Error("Platform access is required") as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = 403;
    error.payload = payload;
    throw error;
  }
  return dedupeAdminRecordsById(normalizeList(payload));
}

export async function getAdminCompany(token: string) {
  return getMyCompany(token);
}

export async function getCompanyById(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/companies/${id}`, {
    token,
  });
  return extractCompanyRecord(payload) ?? normalizeSingle(payload);
}

export async function createCompany(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/companies", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateCompanyById(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/companies/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

function extractCompanyModulesRecord(payload: unknown): AdminRecord | null {
  const root = asRecord(payload);
  const nested =
    asRecord(root?.data) ?? asRecord(root?.result) ?? asRecord(root?.modules);
  if (nested && ("roles" in nested || "permissions" in nested)) {
    return nested;
  }
  if (root && ("roles" in root || "permissions" in root)) {
    return root;
  }
  return nested ?? normalizeSingle(payload) ?? root;
}

export async function getCompanyModules(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/companies/${id}/modules`, {
    token,
    cacheTtlMs: 0,
  });
  return extractCompanyModulesRecord(payload);
}

export async function updateCompanyModules(
  token: string,
  id: string | number,
  modules: { roles: boolean; permissions: boolean },
) {
  const payload = await adminRequest<unknown>(`/api/companies/${id}/modules`, {
    method: "PATCH",
    token,
    body: {
      roles: modules.roles !== false,
      permissions: modules.permissions !== false,
    },
  });
  return extractCompanyModulesRecord(payload);
}

export async function activateCompany(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/companies/${id}/activate`, {
    method: "POST",
    token,
  });
}

export async function suspendCompany(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/companies/${id}/suspend`, {
    method: "POST",
    token,
  });
}

export async function getCurrentCompanyOnboardingStatus(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/companies/current/onboarding-status",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function createResource(
  resource: AdminResourceKey,
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(RESOURCE_PATHS[resource], {
    method: "POST",
    token,
    body: data,
  });
}

function readAdminRecordString(record: AdminRecord | null, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

const KNOWN_EMPLOYEE_NUMBER_KEYS = [
  "employee_no",
  "employeeNo",
  "employee_number",
  "employeeNumber",
  "user_no",
  "userNo",
];

function collectKnownEmployeeNumbersFromRecord(
  record: AdminRecord | null,
  into: Set<string>,
  visited: Set<object>,
) {
  if (!record || visited.has(record)) {
    return;
  }
  visited.add(record);

  const direct = readAdminRecordString(record, KNOWN_EMPLOYEE_NUMBER_KEYS);
  if (direct) {
    into.add(direct.toLowerCase());
  }

  for (const key of [
    "employee",
    "active_employee",
    "activeEmployee",
    "company_user",
    "companyUser",
    "membership",
    "user",
  ]) {
    collectKnownEmployeeNumbersFromRecord(asRecord(record[key]), into, visited);
  }

  for (const key of [
    "employees",
    "memberships",
    "company_users",
    "companyUsers",
  ]) {
    const value = record[key];
    if (Array.isArray(value)) {
      value.forEach((entry) =>
        collectKnownEmployeeNumbersFromRecord(asRecord(entry), into, visited),
      );
    }
  }
}

function collectKnownSessionEmployeeNumbers() {
  const numbers = new Set<string>();
  if (typeof window === "undefined") {
    return numbers;
  }

  try {
    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
    collectKnownEmployeeNumbersFromRecord(
      rawUser ? asRecord(JSON.parse(rawUser)) : null,
      numbers,
      new Set<object>(),
    );
  } catch {
    // Ignore malformed session snapshots.
  }

  return numbers;
}

function cloneCreateEmployeePayload(
  data: CreateEmployeePayload,
): CreateEmployeePayload {
  return {
    ...data,
    onboarding: data.onboarding
      ? {
          ...data.onboarding,
          provisioning: data.onboarding.provisioning
            ? {
                ...data.onboarding.provisioning,
                device_assignment: data.onboarding.provisioning
                  .device_assignment
                  ? { ...data.onboarding.provisioning.device_assignment }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function stripReservedEmployeeNumbers(body: CreateEmployeePayload) {
  const reservedNumbers = collectKnownSessionEmployeeNumbers();
  const candidateEmployeeNo = body.employee_no?.trim();
  if (
    !candidateEmployeeNo ||
    reservedNumbers.has(candidateEmployeeNo.toLowerCase())
  ) {
    delete body.employee_no;
  } else {
    body.employee_no = candidateEmployeeNo;
  }

  const deviceAssignment = body.onboarding?.provisioning?.device_assignment;
  const deviceEmployeeNo = deviceAssignment?.employee_no?.trim();
  if (deviceAssignment) {
    if (
      !deviceEmployeeNo ||
      reservedNumbers.has(deviceEmployeeNo.toLowerCase())
    ) {
      delete deviceAssignment.employee_no;
    } else {
      deviceAssignment.employee_no = deviceEmployeeNo;
    }
  }
}

function stripEmployeeNumbersFromCreatePayload(data: CreateEmployeePayload) {
  const body = cloneCreateEmployeePayload(data);
  delete body.employee_no;
  if (body.onboarding?.provisioning?.device_assignment) {
    delete body.onboarding.provisioning.device_assignment.employee_no;
  }
  return body;
}

function payloadHasExplicitEmployeeNumber(body: CreateEmployeePayload) {
  return Boolean(
    body.employee_no?.trim() ||
    body.onboarding?.provisioning?.device_assignment?.employee_no?.trim(),
  );
}

function errorMessageAndPayload(errorObject: unknown) {
  const message =
    errorObject instanceof Error ? errorObject.message : String(errorObject);
  const payload =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "payload" in errorObject
      ? JSON.stringify((errorObject as { payload?: unknown }).payload)
      : "";
  return `${message} ${payload}`;
}

function isMissingOnboardingApprover(errorObject: unknown) {
  return /no eligible approver/i.test(errorMessageAndPayload(errorObject));
}

function isExistingEmployeeProfileConflict(errorObject: unknown) {
  const status =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "status" in errorObject &&
    typeof (errorObject as { status?: unknown }).status === "number"
      ? (errorObject as { status: number }).status
      : null;
  const message = errorMessageAndPayload(errorObject);
  return (
    /already has an employee profile/i.test(message) ||
    (status === 409 && /employee profile/i.test(message))
  );
}

function isEmailPhoneUserConflict(errorObject: unknown) {
  return /email and phone belong to different/i.test(
    errorMessageAndPayload(errorObject),
  );
}

function readCreatedEmployeeId(record: AdminRecord | null): number | null {
  if (!record) {
    return null;
  }
  const direct = readNumberFromRecord(record, [
    "id",
    "employee_id",
    "employeeId",
  ]);
  if (direct !== null) {
    return direct;
  }
  const nested = asRecord(record.employee) ?? asRecord(record.employee_profile);
  return readNumberFromRecord(nested, ["id", "employee_id", "employeeId"]);
}

function unwrapCreatedEmployee(payload: unknown): CreateEmployeeResponse {
  const root = asRecord(payload);
  const nestedEmployee =
    asRecord(root?.employee) ??
    asRecord(asRecord(root?.data)?.employee) ??
    asRecord(asRecord(root?.result)?.employee);
  const candidates = [
    looksLikeEmployeeRecord(nestedEmployee) ? nestedEmployee : null,
    looksLikeEmployeeRecord(asRecord(root?.data)) ? asRecord(root?.data) : null,
    looksLikeEmployeeRecord(root) ? root : null,
    normalizeSingle(payload),
    asRecord(payload),
  ].filter((value): value is AdminRecord => Boolean(value));

  const record = (candidates.find(
    (candidate) => readCreatedEmployeeId(candidate) !== null,
  ) ??
    candidates[0] ??
    {}) as CreateEmployeeResponse;

  const onboardingRequest =
    asRecord(record.onboarding_request) ??
    asRecord(record.onboardingRequest) ??
    asRecord(root?.onboarding_request) ??
    asRecord(asRecord(root?.data)?.onboarding_request) ??
    null;
  if (onboardingRequest && !record.onboarding_request) {
    record.onboarding_request = onboardingRequest;
  }

  const envelope = asRecord(root?.data) ?? root;
  const warning =
    readAdminRecordString(record, [
      "warning",
      "onboarding_warning",
      "onboardingWarning",
    ]) ??
    readAdminRecordString(envelope, [
      "warning",
      "onboarding_warning",
      "onboardingWarning",
    ]) ??
    readAdminRecordString(root, [
      "warning",
      "onboarding_warning",
      "onboardingWarning",
    ]);
  if (warning) {
    record.warning = warning;
  }

  const envelopeEmployeeId = readNumberFromRecord(envelope, [
    "employee_id",
    "employeeId",
  ]);
  if (envelopeEmployeeId !== null && record.employee_id == null) {
    record.employee_id = envelopeEmployeeId;
    if (readCreatedEmployeeId(record) === null) {
      record.id = envelopeEmployeeId;
    }
  }
  return record;
}

function readInviteContactEmail(body: CreateEmployeePayload): string | null {
  for (const contact of body.contacts ?? []) {
    const email = readAdminRecordString(asRecord(contact), [
      "email",
      "work_email",
      "workEmail",
    ]);
    if (email) {
      return email.toLowerCase();
    }
  }
  return null;
}

function readInviteContactPhone(body: CreateEmployeePayload): string | null {
  for (const contact of body.contacts ?? []) {
    const phone = readAdminRecordString(asRecord(contact), [
      "phone_number",
      "phone",
      "mobile_number",
      "mobile",
    ]);
    if (phone) {
      return phone;
    }
  }
  return null;
}

function employeeMatchesCreatePayload(
  row: AdminRecord,
  body: CreateEmployeePayload,
) {
  const email = readInviteContactEmail(body);
  const phone = readInviteContactPhone(body);
  if (email) {
    return employeeOwnsEmail(row, email);
  }
  if (phone && employeeOwnsPhone(row, phone)) {
    return true;
  }
  const first = readAdminRecordString(row, [
    "first_name",
    "firstName",
  ])?.toLowerCase();
  const last = readAdminRecordString(row, [
    "last_name",
    "lastName",
  ])?.toLowerCase();
  return (
    Boolean(first && last) &&
    first === body.first_name.trim().toLowerCase() &&
    last === body.last_name.trim().toLowerCase()
  );
}

async function findExistingEmployeeForCreate(
  token: string,
  body: CreateEmployeePayload,
): Promise<CreateEmployeeResponse | null> {
  const email = readInviteContactEmail(body);
  const phone = readInviteContactPhone(body);
  const searches = [
    email,
    phone,
    `${body.first_name.trim()} ${body.last_name.trim()}`.trim(),
  ].filter((value): value is string => Boolean(value));

  for (const search of searches) {
    try {
      const result = await listEmployees(token, {
        page: 1,
        limit: 20,
        search,
      });
      const match = result.rows.find((row) =>
        employeeMatchesCreatePayload(row, body),
      );
      if (match && readCreatedEmployeeId(match) !== null) {
        return match as CreateEmployeeResponse;
      }
    } catch {
      // Keep trying other search keys.
    }
  }
  return null;
}

function employeeFromConflictPayload(
  errorObject: unknown,
): CreateEmployeeResponse | null {
  if (
    typeof errorObject !== "object" ||
    errorObject === null ||
    !("payload" in errorObject)
  ) {
    return null;
  }
  const payload = (errorObject as { payload?: unknown }).payload;
  const unwrapped = unwrapCreatedEmployee(payload);
  return readCreatedEmployeeId(unwrapped) === null ? null : unwrapped;
}

async function recoverExistingEmployeeFromCreateError(
  token: string,
  body: CreateEmployeePayload,
  errorObject: unknown,
): Promise<CreateEmployeeResponse | null> {
  if (
    !isExistingEmployeeProfileConflict(errorObject) &&
    !isMissingOnboardingApprover(errorObject)
  ) {
    return null;
  }
  return (
    employeeFromConflictPayload(errorObject) ??
    (await findExistingEmployeeForCreate(token, body))
  );
}

async function searchDirectoryOwner(
  token: string,
  query: string | null,
  match: "email" | "phone",
): Promise<{
  source: "employee" | "company_user";
  record: AdminRecord;
} | null> {
  if (!query) {
    return null;
  }

  const matches = (row: AdminRecord) =>
    match === "email"
      ? employeeOwnsEmail(row, query)
      : employeeOwnsPhone(row, query);

  try {
    const employees = await listEmployees(token, {
      page: 1,
      limit: 50,
      search: query,
    });
    const employeeHit = employees.rows.find(matches);
    if (employeeHit) {
      return { source: "employee", record: employeeHit };
    }
  } catch {
    // Try a full employee directory scan next.
  }

  try {
    const employees = await listAllEmployees(
      token,
      {},
      { pageSize: 100, maxPages: 20 },
    );
    const employeeHit = employees.find(matches);
    if (employeeHit) {
      return { source: "employee", record: employeeHit };
    }
  } catch {
    // Keep looking through company users.
  }

  try {
    const users = await listCurrentCompanyUsers(token, {
      page: 1,
      limit: 50,
      search: query,
    });
    const userHit = users.rows.find(matches);
    if (userHit) {
      return { source: "company_user", record: userHit };
    }
  } catch {
    // Fall through to a full company-user scan.
  }

  try {
    const users = await listAllCurrentCompanyUsers(token, { maxPages: 15 });
    const userHit = users.find(matches);
    if (userHit) {
      return { source: "company_user", record: userHit };
    }
  } catch {
    return null;
  }

  return null;
}

async function lookupEmailPhoneConflictOwners(
  token: string,
  body: CreateEmployeePayload,
): Promise<{ emailOwner: string | null; phoneOwner: string | null }> {
  const email = readInviteContactEmail(body);
  const phone = readInviteContactPhone(body);
  const [emailMatch, phoneMatch] = await Promise.all([
    searchDirectoryOwner(token, email, "email"),
    searchDirectoryOwner(token, phone, "phone"),
  ]);

  return {
    emailOwner: emailMatch
      ? formatEmployeeDirectoryPerson(emailMatch.record, emailMatch.source)
      : null,
    phoneOwner: phoneMatch
      ? formatEmployeeDirectoryPerson(phoneMatch.record, phoneMatch.source)
      : null,
  };
}

function buildEmailPhoneConflictMessage(
  body: CreateEmployeePayload,
  owners: { emailOwner: string | null; phoneOwner: string | null },
): string {
  const email = readInviteContactEmail(body);
  const phone = readInviteContactPhone(body);
  const parts = [
    "Email and phone belong to different existing users.",
    email
      ? owners.emailOwner
        ? `Email ${email} is already used by ${owners.emailOwner}.`
        : `Email ${email} already belongs to an existing user.`
      : null,
    phone
      ? owners.phoneOwner
        ? `Phone ${phone} is already used by ${owners.phoneOwner}.`
        : `Phone ${phone} already belongs to an existing user who may not appear under Employees.`
      : null,
    "Search Employees by email or phone, or use contact details that belong to the same person.",
  ];
  return parts.filter(Boolean).join(" ");
}

async function throwEmailPhoneConflictError(
  token: string,
  body: CreateEmployeePayload,
  errorObject: unknown,
): Promise<never> {
  const owners = await lookupEmailPhoneConflictOwners(token, body);
  const error = new Error(
    buildEmailPhoneConflictMessage(body, owners),
  ) as Error & {
    status?: number;
    payload?: unknown;
  };
  error.status =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "status" in errorObject &&
    typeof (errorObject as { status?: unknown }).status === "number"
      ? (errorObject as { status: number }).status
      : 409;
  if (
    typeof errorObject === "object" &&
    errorObject !== null &&
    "payload" in errorObject
  ) {
    error.payload = (errorObject as { payload?: unknown }).payload;
  }
  throw error;
}

async function createEmployeeDowngradingOnboarding(
  token: string,
  body: CreateEmployeePayload,
  errorObject: unknown,
) {
  const recover = async (retryError: unknown) => {
    const existing = await recoverExistingEmployeeFromCreateError(
      token,
      body,
      retryError,
    );
    if (existing) {
      return existing;
    }
    if (
      !isMissingOnboardingApprover(retryError) &&
      !isExistingEmployeeProfileConflict(retryError)
    ) {
      throw retryError;
    }
    return null;
  };

  const draft = cloneCreateEmployeePayload(body);
  draft.onboarding = {
    ...(draft.onboarding ?? {}),
    auto_start: true,
    submit: false,
  };
  if (body.onboarding?.submit !== false) {
    try {
      return await postCreateEmployee(token, draft);
    } catch (retryError) {
      const existing = await recover(retryError);
      if (existing) {
        return existing;
      }
    }
  }

  draft.onboarding = {
    ...(draft.onboarding ?? {}),
    auto_start: false,
    submit: false,
  };
  if (body.onboarding?.auto_start !== false) {
    try {
      return await postCreateEmployee(token, draft);
    } catch (retryError) {
      const existing = await recover(retryError);
      if (existing) {
        return existing;
      }
    }
  }

  const stripped = cloneCreateEmployeePayload(body);
  delete stripped.onboarding;
  try {
    return await postCreateEmployee(token, stripped);
  } catch (retryError) {
    const existing = await recover(retryError);
    if (existing) {
      return existing;
    }
  }

  const existing = await recoverExistingEmployeeFromCreateError(
    token,
    body,
    errorObject,
  );
  if (existing) {
    return existing;
  }

  throw errorObject;
}

function isEmployeeNumberConflict(errorObject: unknown) {
  const status =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "status" in errorObject &&
    typeof (errorObject as { status?: unknown }).status === "number"
      ? (errorObject as { status: number }).status
      : null;
  if (status === 400) {
    return false;
  }
  const message =
    errorObject instanceof Error ? errorObject.message : String(errorObject);
  const payload =
    typeof errorObject === "object" &&
    errorObject !== null &&
    "payload" in errorObject
      ? JSON.stringify((errorObject as { payload?: unknown }).payload)
      : "";
  return EMPLOYEE_NUMBER_CONFLICT_PATTERN.test(`${message} ${payload}`);
}

function incrementEmployeeNumber(current: string): string | null {
  const match = current.trim().match(/^(.*?)(\d+)$/);
  if (!match) {
    return null;
  }
  const nextValue = Number(match[2]) + 1;
  if (!Number.isSafeInteger(nextValue) || nextValue < 1) {
    return null;
  }
  return `${match[1]}${String(nextValue).padStart(match[2].length, "0")}`;
}

function formatEmployeeNumberFromSettings(record: AdminRecord | null) {
  if (!record) {
    return null;
  }
  const prefix = readAdminRecordString(record, ["prefix"]) ?? "";
  const padding = Number(record.padding);
  const nextNumber = Number(record.next_number ?? record.nextNumber);
  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    return null;
  }
  const width = Number.isInteger(padding) && padding > 0 ? padding : 5;
  return `${prefix}${String(nextNumber).padStart(width, "0")}`;
}

async function employeeNumberExists(token: string, employeeNo: string) {
  const existing = await listEmployees(token, {
    page: 1,
    limit: 5,
    search: employeeNo,
  });
  return existing.rows.some((row) => {
    const value = readAdminRecordString(row, [
      "employee_no",
      "employeeNo",
      "employee_number",
      "employeeNumber",
    ]);
    return value?.toLowerCase() === employeeNo.toLowerCase();
  });
}

async function resolveUnusedEmployeeNumber(token: string) {
  const [numberingResult, latestResult] = await Promise.allSettled([
    getEmployeeNumbering(token),
    listEmployees(token, {
      page: 1,
      limit: 1,
      sortBy: "employee_no",
      sortOrder: "DESC",
    }),
  ]);
  const numbering =
    numberingResult.status === "fulfilled" ? numberingResult.value : null;
  const latestNo =
    latestResult.status === "fulfilled"
      ? readAdminRecordString(latestResult.value.rows[0] ?? null, [
          "employee_no",
          "employeeNo",
          "employee_number",
          "employeeNumber",
        ])
      : null;

  const candidates: string[] = [];
  if (latestNo) {
    const incremented = incrementEmployeeNumber(latestNo);
    if (incremented) {
      candidates.push(incremented);
    }
  }
  const fromSettings = formatEmployeeNumberFromSettings(numbering);
  if (fromSettings) {
    candidates.push(fromSettings);
  }

  const seen = new Set<string>();
  const queue = candidates.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  for (let i = 0; i < 25 && queue.length > 0; i += 1) {
    const candidate = queue.shift()!;
    if (!(await employeeNumberExists(token, candidate))) {
      return candidate;
    }
    const next = incrementEmployeeNumber(candidate);
    if (next && !seen.has(next.toLowerCase())) {
      seen.add(next.toLowerCase());
      queue.push(next);
    }
  }

  return undefined;
}

async function postCreateEmployee(token: string, body: CreateEmployeePayload) {
  const payload = await adminRequest<unknown>("/api/employees", {
    method: "POST",
    token,
    body,
  });
  return unwrapCreatedEmployee(payload);
}

function applySafeEmployeeOnboardingDefaults(body: CreateEmployeePayload) {
  // Current backend: omitted onboarding is skipped. If the client does send
  // onboarding without submit, default to draft so create cannot 400 after commit.
  if (!body.onboarding) {
    return;
  }
  if (body.onboarding.submit === undefined) {
    body.onboarding.submit = false;
  }
}

export async function createEmployeeProfile(
  token: string,
  data: CreateEmployeePayload,
) {
  const body = cloneCreateEmployeePayload(data);
  stripReservedEmployeeNumbers(body);
  applySafeEmployeeOnboardingDefaults(body);

  try {
    return await postCreateEmployee(token, body);
  } catch (errorObject) {
    if (isEmailPhoneUserConflict(errorObject)) {
      await throwEmailPhoneConflictError(token, body, errorObject);
    }
    if (isMissingOnboardingApprover(errorObject)) {
      return await createEmployeeDowngradingOnboarding(
        token,
        body,
        errorObject,
      );
    }
    if (isExistingEmployeeProfileConflict(errorObject)) {
      const existing = await recoverExistingEmployeeFromCreateError(
        token,
        body,
        errorObject,
      );
      if (existing) {
        return existing;
      }
    }
    if (!isEmployeeNumberConflict(errorObject)) {
      throw errorObject;
    }

    const stripped = stripEmployeeNumbersFromCreatePayload(body);
    if (payloadHasExplicitEmployeeNumber(body)) {
      try {
        return await postCreateEmployee(token, stripped);
      } catch (retryError) {
        if (isMissingOnboardingApprover(retryError)) {
          return await createEmployeeDowngradingOnboarding(
            token,
            stripped,
            retryError,
          );
        }
        if (!isEmployeeNumberConflict(retryError)) {
          throw retryError;
        }
      }
    }

    let candidate = await resolveUnusedEmployeeNumber(token);
    for (let attempt = 0; attempt < 5 && candidate; attempt += 1) {
      const allocatedBody = {
        ...stripped,
        employee_no: candidate,
      };
      try {
        return await postCreateEmployee(token, allocatedBody);
      } catch (retryError) {
        if (isMissingOnboardingApprover(retryError)) {
          return await createEmployeeDowngradingOnboarding(
            token,
            allocatedBody,
            retryError,
          );
        }
        if (!isEmployeeNumberConflict(retryError)) {
          throw retryError;
        }
        candidate = incrementEmployeeNumber(candidate) ?? undefined;
      }
    }

    throw errorObject;
  }
}

export async function updateMyEmployeeProfile(
  token: string,
  data: Omit<
    CreateEmployeePayload,
    | "employee_no"
    | "primary_branch_id"
    | "primary_department_id"
    | "primary_position_id"
    | "position_id"
    | "employment_status"
    | "employment_type"
    | "hire_date"
    | "probation_end_date"
    | "reports_to"
    | "departments"
    | "onboarding"
  >,
) {
  return adminRequest<unknown>("/api/employees/me", {
    method: "PATCH",
    token,
    body: data,
  });
}

/**
 * Creates a pending employee invitation and queues both configured delivery
 * channels. The backend turns the invitation into a user and employee when
 * the recipient accepts it.
 */
export async function createEmployeeInvitation(
  token: string,
  data: CreateEmployeeInvitationPayload,
) {
  const payload = await adminRequest<unknown>("/api/employee-invitations", {
    method: "POST",
    token,
    body: data,
  });
  return normalizeSingle(payload) as EmployeeInvitationResponse;
}

export async function listPendingEmployeeInvitations(token: string) {
  const payload = await adminRequest<unknown>("/api/employee-invitations", {
    token,
  });
  return normalizeList(payload) as EmployeeInvitationResponse[];
}

export type EmployeeInvitationHistoryStatus =
  "all" | "pending" | "accepted" | "expired" | "cancelled";

export interface EmployeeInvitationHistoryQuery {
  status?: EmployeeInvitationHistoryStatus;
  search?: string;
  page?: number;
  limit?: number;
}

/** All invitations, filtered by effective status (overdue pending = expired). */
export async function listEmployeeInvitationHistory(
  token: string,
  query: EmployeeInvitationHistoryQuery = {},
) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const payload = await adminRequest<{
    data?: unknown;
    meta?: { totalItems?: number };
  }>(`/api/employee-invitations/history${suffix}`, { token, dedupe: false });
  return {
    data: normalizeList(payload) as EmployeeInvitationResponse[],
    totalItems: Number(payload?.meta?.totalItems ?? 0),
  };
}

export async function resendEmployeeInvitation(
  token: string,
  invitationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-invitations/${invitationId}/resend`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) as EmployeeInvitationResponse;
}

// The registration token is sent in the request body, never the URL, so it
// stays out of proxy and access logs.
export async function getPublicEmployeeInvitation(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-invitations/lookup",
    {
      method: "POST",
      body: { token },
      dedupe: false,
    },
  );
  return normalizeSingle(payload) as unknown as PublicEmployeeInvitation;
}

export async function acceptEmployeeInvitation(
  token: string,
  password: string,
) {
  const payload = await adminRequest<unknown>(
    "/api/employee-invitations/accept",
    {
      method: "POST",
      body: { token, password },
      dedupe: false,
    },
  );
  return normalizeSingle(
    payload,
  ) as unknown as AcceptEmployeeInvitationResponse;
}

export type PublicRecruitmentOffer = {
  candidate_name: string;
  job_title: string;
  salary: string;
  start_date: string;
  offer_expires_at: string;
  has_letter: boolean;
};

export async function getPublicRecruitmentOffer(token: string) {
  const payload = await adminRequest<unknown>(
    `/api/recruitment/offers/preview?token=${encodeURIComponent(token)}`,
    { dedupe: false },
  );
  return normalizeSingle(payload) as PublicRecruitmentOffer;
}

export async function acceptPublicRecruitmentOffer(token: string) {
  const payload = await adminRequest<unknown>(
    `/api/recruitment/offers/accept`,
    {
      method: "POST",
      body: { token },
      dedupe: false,
    },
  );
  return normalizeSingle(payload) as { status: string; candidate_id: number };
}

export async function listRecruitmentRequests(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/recruitment/requests", { token }),
  );
}

export async function listRecruitmentCandidates(
  token: string,
  requestId: number,
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/recruitment/requests/${requestId}/candidates`,
      { token },
    ),
  );
}

export async function recruitmentCommand(
  token: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const payload = await adminRequest<unknown>(`/api/recruitment/${path}`, {
    method: "POST",
    token,
    body: body ?? {},
    dedupe: false,
  });
  return normalizeSingle(payload) as AdminRecord;
}

export async function listEmploymentContracts(
  token: string,
  employeeId: number,
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/employment-contracts/employees/${employeeId}`,
      { token },
    ),
  );
}

export async function listEmploymentLetterTemplates(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/employment-letters/templates", { token }),
  );
}

export async function saveEmploymentLetterTemplate(
  token: string,
  body: AdminRecord,
) {
  return normalizeSingle(
    await adminRequest<unknown>("/api/employment-letters/templates", {
      method: "PUT",
      token,
      body,
      dedupe: false,
    }),
  );
}

export async function generateEmploymentLetter(
  token: string,
  type: "offer" | "appointment",
  id: number,
) {
  return normalizeSingle(
    await adminRequest<unknown>(
      `/api/employment-letters/${type === "offer" ? "candidates" : "employees"}/${id}/${type}`,
      {
        method: "POST",
        token,
        body: {},
        dedupe: false,
      },
    ),
  );
}

export async function generateEmployeeTemplateLetter(
  token: string,
  employeeId: number,
  letterType: "JOINING_FORM" | "OTHER",
) {
  return normalizeSingle(
    await adminRequest<unknown>(
      `/api/employment-letters/employees/${employeeId}/generate`,
      { method: "POST", token, body: { letter_type: letterType }, dedupe: false },
    ),
  );
}

export async function previewEmployeeTemplateLetter(
  token: string,
  employeeId: number,
  letterType: "JOINING_FORM" | "OTHER",
) {
  return normalizeSingle(
    await adminRequest<unknown>(
      `/api/employment-letters/employees/${employeeId}/preview`,
      { method: "POST", token, body: { letter_type: letterType }, dedupe: false },
    ),
  );
}

export async function listEmployeeLetterHistory(token: string, employeeId: number) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/employment-letters/employees/${employeeId}/history`,
      { token },
    ),
  );
}

export async function downloadEmploymentLetter(token: string, id: number) {
  const response = await fetch(
    buildUrl(`/api/employment-letters/documents/${id}/download`),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(`Could not download letter (${response.status})`);
  return response.blob();
}

export async function downloadEmployeeLetterPreview(
  token: string,
  employeeId: number,
  letterType: "JOINING_FORM" | "OTHER",
) {
  const response = await fetch(
    buildUrl(`/api/employment-letters/employees/${employeeId}/preview`),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ letter_type: letterType }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Could not preview letter (${response.status})`);
  const payload = (await response.json()) as { content_base64?: string };
  if (!payload.content_base64) throw new Error("Preview response did not include a PDF.");
  const binary = atob(payload.content_base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: "application/pdf" });
}

export async function signEmploymentContract(
  token: string,
  contractId: number,
  signedName: string,
) {
  const payload = await adminRequest<unknown>(
    `/api/employment-contracts/${contractId}/sign`,
    {
      method: "POST",
      token,
      body: { signed_name: signedName },
      dedupe: false,
    },
  );
  return normalizeSingle(payload);
}

export async function issueEmploymentContract(
  token: string,
  body: Record<string, unknown>,
) {
  return normalizeSingle(
    await adminRequest<unknown>("/api/employment-contracts", {
      method: "POST",
      token,
      body,
      dedupe: false,
    }),
  );
}

export async function attachEmploymentContract(
  token: string,
  contractId: number,
  file: Record<string, unknown>,
) {
  return normalizeSingle(
    await adminRequest<unknown>(
      `/api/employment-contracts/${contractId}/document`,
      {
        method: "POST",
        token,
        body: file,
        dedupe: false,
      },
    ),
  );
}

export async function getEmployeeById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/employees/${id}`, {
    token,
  });
  const root = asRecord(payload);
  if (looksLikeEmployeeRecord(root)) {
    return root;
  }
  return normalizeSingle(payload);
}

function findPositionRecordById(
  payload: unknown,
  positionId: string | number,
): AdminRecord | null {
  const targetId = String(positionId);
  const candidates: AdminRecord[] = [];
  const visited = new Set<object>();

  function visit(value: unknown) {
    if (typeof value !== "object" || value === null || visited.has(value)) {
      return;
    }
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as AdminRecord;
    if (record.id !== undefined && String(record.id) === targetId) {
      candidates.push(record);
    }
    Object.values(record).forEach(visit);
  }

  visit(payload);
  return (
    candidates.find(
      (record) =>
        "code" in record &&
        ("level" in record ||
          "is_manager" in record ||
          "isManager" in record ||
          "headcount" in record ||
          "department_ids" in record ||
          "departmentIds" in record ||
          "reports_to_position_id" in record),
    ) ??
    candidates.find((record) => "code" in record || "name" in record) ??
    null
  );
}

export async function getPosition(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/positions/${id}`, {
    token,
  });
  return findPositionRecordById(payload, id) ?? normalizeSingle(payload);
}

export async function listDepartmentPositions(
  token: string,
  departmentId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/departments/${departmentId}/positions`,
    { token },
  );
  return normalizeList(payload);
}

export async function assignDepartmentPosition(
  token: string,
  departmentId: string | number,
  positionId: string | number,
) {
  return adminRequest<unknown>(`/api/departments/${departmentId}/positions`, {
    method: "POST",
    token,
    body: { position_id: Number(positionId) },
  });
}

export async function removeDepartmentPosition(
  token: string,
  departmentId: string | number,
  positionId: string | number,
) {
  return adminRequest<unknown>(
    `/api/departments/${departmentId}/positions/${positionId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function patchEmployeeById(
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employees/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function getCurrentEmployee(token: string) {
  const payload = await adminRequest<unknown>("/api/employees/me", { token });
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);
  const rootItem = asRecord(root?.item);
  const candidates = [rootData, rootResult, rootItem, root];
  const nestedCandidates = [
    asRecord(rootData?.employee),
    asRecord(rootResult?.employee),
    asRecord(rootItem?.employee),
    asRecord(root?.employee),
  ];

  for (const candidate of candidates) {
    if (looksLikeEmployeeRecord(candidate)) {
      return candidate;
    }
  }

  for (const candidate of nestedCandidates) {
    if (looksLikeEmployeeRecord(candidate)) {
      return candidate;
    }
  }

  return normalizeSingle(payload);
}

export async function getMyProfile(token: string) {
  const payload = await adminRequest<unknown>("/api/me/profile", { token });
  return normalizeSingle(payload);
}

export type DashboardCardStyle = {
  palette:
    | "ocean"
    | "forest"
    | "plum"
    | "coral"
    | "midnight"
    | "berry"
    | "neutral"
    | "white";
  artwork: "none" | "orbit" | "waves" | "confetti" | "arches" | "sprigs";
};

export async function getMyDashboardCardStyle(token: string) {
  return adminRequest<DashboardCardStyle>(
    "/api/users/me/dashboard-card-style",
    {
      token,
      cacheTtlMs: 0,
      dedupe: false,
    },
  );
}

export async function uploadMyLeaveRequestDocument(
  token: string,
  id: number | string,
  file: File,
) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/documents`, {
    method: "POST",
    token,
    body: { file: await fileToBase64UploadDto(file) },
  });
}

export async function updateMyDashboardCardStyle(
  token: string,
  style: DashboardCardStyle,
) {
  return adminRequest<DashboardCardStyle>(
    "/api/users/me/dashboard-card-style",
    {
      method: "PATCH",
      token,
      body: style,
    },
  );
}

const PROFILE_PHOTO_URL_KEYS = [
  "profile_photo_url",
  "photo_url",
  "url",
  "avatar_url",
  "avatar",
  "image_url",
  "imageUrl",
  "signed_url",
  "public_url",
  "file_url",
  "fileUrl",
  "path",
  "file_path",
  "filePath",
  "storage_path",
  "storagePath",
  "relative_path",
  "relativePath",
  "image_path",
  "imagePath",
] as const;

/**
 * Map a backend media path/URL onto the current API host.
 * - `/uploads/default-avatars/company-1/x.svg` → `{API_BASE}/uploads/...`
 * - Absolute upload URLs from another host are rewritten to the current API base
 *   so environments can move without broken images.
 * - `data:` / `blob:` URLs are left unchanged.
 */
/**
 * Extract a profile picture URL from common API response shapes.
 * Supports plain strings, `{ url }`, nested `data`/`result`/`user`/`employee` objects.
 * Relative/upload paths are resolved against the active API base URL.
 */
export function extractProfilePhotoUrl(payload: unknown): string | null {
  if (typeof payload === "string") {
    return resolveBackendMediaUrl(payload);
  }

  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const candidates: Array<AdminRecord | null> = [
    root,
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.profile),
    asRecord(root.user),
    asRecord(root.employee),
    asRecord(asRecord(root.data)?.user),
    asRecord(asRecord(root.data)?.employee),
    asRecord(asRecord(root.result)?.user),
    asRecord(asRecord(root.result)?.employee),
    asRecord(asRecord(root.employee)?.company_user),
    asRecord(asRecord(asRecord(root.employee)?.company_user)?.user),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    for (const key of PROFILE_PHOTO_URL_KEYS) {
      const value = candidate[key];
      if (typeof value === "string" && value.trim()) {
        return resolveBackendMediaUrl(value);
      }
    }
  }

  return null;
}

/**
 * GET /api/me/profile/photo — returns the signed-in user's profile picture URL.
 * Missing photo (404) resolves to null rather than throwing.
 */
export async function getMyProfilePhotoUrl(
  token: string,
): Promise<string | null> {
  try {
    const payload = await adminRequest<unknown>("/api/me/profile/photo", {
      token,
      cacheTtlMs: 30_000,
    });
    return extractProfilePhotoUrl(payload);
  } catch (errorObject) {
    const status =
      typeof errorObject === "object" &&
      errorObject !== null &&
      "status" in errorObject
        ? Number((errorObject as { status?: number }).status)
        : null;
    if (status === 404 || status === 204) {
      try {
        const account = await adminRequest<unknown>("/api/users/me", {
          token,
          cacheTtlMs: 0,
          dedupe: false,
        });
        return extractProfilePhotoUrl(account);
      } catch {
        return null;
      }
    }
    throw errorObject;
  }
}

/**
 * Upload the signed-in user's profile picture. The backend applies HR uploads
 * immediately and routes other employee uploads through HR approval.
 * POST /api/me/profile/photo (multipart/form-data, field: file) → 201
 */
export async function uploadMyProfilePhoto(
  token: string,
  file: File | Blob,
  fileName?: string,
): Promise<AdminRecord | null> {
  const formData = new FormData();
  if (file instanceof File) {
    formData.set("file", file);
  } else {
    formData.set("file", file, fileName?.trim() || "profile-photo.jpg");
  }

  const response = await fetch(buildUrl("/api/me/profile/photo"), {
    method: "POST",
    headers: {
      // Let the browser set multipart boundary; do not force JSON content-type.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    cache: "no-store",
  });

  invalidateAdminGetCache();

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      const accountResponse = await fetch(
        buildUrl("/api/users/me/profile-photo"),
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
          cache: "no-store",
        },
      );
      invalidateAdminGetCache();
      const accountText = await accountResponse.text();
      let accountPayload: unknown = null;
      if (accountText) {
        try {
          accountPayload = JSON.parse(accountText) as unknown;
        } catch {
          accountPayload = { message: accountText };
        }
      }
      if (!accountResponse.ok) {
        const accountError = new Error(
          extractMessage(accountPayload, accountResponse.status),
        ) as Error & { status?: number; payload?: unknown };
        accountError.status = accountResponse.status;
        accountError.payload = accountPayload;
        throw accountError;
      }
      const accountUrl = extractProfilePhotoUrl(accountPayload);
      return {
        ...(asRecord(accountPayload) ?? {}),
        ...(accountUrl ? { profile_photo_url: accountUrl } : {}),
        approval_required: false,
        applied_immediately: true,
      };
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  // Prefer explicit URL from the upload response; otherwise re-fetch GET photo.
  const fromBody = extractProfilePhotoUrl(payload);
  if (fromBody) {
    return { ...(asRecord(payload) ?? {}), profile_photo_url: fromBody };
  }

  try {
    const photoUrl = await getMyProfilePhotoUrl(token);
    if (photoUrl) {
      return { profile_photo_url: photoUrl };
    }
  } catch {
    // Upload succeeded; URL may appear after a short delay.
  }

  return normalizeSingle(payload) ?? asRecord(payload);
}

/**
 * Select (or clear) a default profile avatar for the signed-in employee.
 * PATCH /api/me/profile/avatar — body: { default_avatar_id: number | null }
 * Pass null to clear the selection.
 *
 * Some backend avatar records throw 500 (missing file, unsupported format).
 * Callers should catch and optionally fall back to POST /api/me/profile/photo.
 */
export async function selectMyProfileAvatar(
  token: string,
  defaultAvatarId: number | null,
): Promise<AdminRecord | null> {
  // Backend DTO expects number | null — never send a string id.
  const body: { default_avatar_id: number | null } = {
    default_avatar_id:
      defaultAvatarId == null
        ? null
        : Number.isFinite(Number(defaultAvatarId))
          ? Math.trunc(Number(defaultAvatarId))
          : null,
  };
  if (defaultAvatarId != null && body.default_avatar_id == null) {
    throw new Error("Invalid default avatar id.");
  }

  const payload = await adminRequest<unknown>("/api/me/profile/avatar", {
    method: "PATCH",
    token,
    body,
  });

  const fromBody = extractProfilePhotoUrl(payload);
  if (fromBody) {
    return { ...(asRecord(payload) ?? {}), profile_photo_url: fromBody };
  }

  try {
    const photoUrl = await getMyProfilePhotoUrl(token);
    if (photoUrl) {
      return { ...(asRecord(payload) ?? {}), profile_photo_url: photoUrl };
    }
  } catch {
    // Selection succeeded; URL may appear after a short delay.
  }

  return normalizeSingle(payload) ?? asRecord(payload);
}

export { extractBackupCodes };

/**
 * GET /api/me/profile/avatar-options
 * Default avatars available to the signed-in employee.
 */
export async function listMyProfileAvatarOptions(
  token: string,
): Promise<AdminRecord[]> {
  const payload = await adminRequest<unknown>(
    "/api/me/profile/avatar-options",
    {
      token,
      cacheTtlMs: 0,
      dedupe: false,
    },
  );
  return normalizeList(payload);
}

/**
 * GET /api/users/me/available-avatars
 * Default avatars available to the current user (company + gender rules).
 */
export async function listMyAvailableAvatars(
  token: string,
): Promise<AdminRecord[]> {
  const payload = await adminRequest<unknown>(
    "/api/users/me/available-avatars",
    {
      token,
      cacheTtlMs: 0,
      dedupe: false,
    },
  );
  return normalizeList(payload);
}

/**
 * GET /api/users/me/avatars
 * Backward-compatible alias for listMyAvailableAvatars.
 */
export async function listMyAvailableAvatarsLegacy(
  token: string,
): Promise<AdminRecord[]> {
  const payload = await adminRequest<unknown>("/api/users/me/avatars", {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  });
  return normalizeList(payload);
}

/**
 * PATCH /api/users/me/avatar — assign an active default avatar to the current user.
 * Body: { avatar_id: number }
 */
export async function selectMyUserAvatar(token: string, avatarId: number) {
  const id = Number(avatarId);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid default avatar id.");
  }
  return adminRequest<unknown>("/api/users/me/avatar", {
    method: "PATCH",
    token,
    body: { avatar_id: Math.trunc(id) },
  });
}

/**
 * Employee/self-service avatar gallery. Tries the documented self-service
 * endpoints first so users without default-avatar admin grants still get options.
 */
export async function listSelectableAvatarsForMe(
  token: string,
): Promise<AdminRecord[]> {
  const loaders = [
    listMyProfileAvatarOptions,
    listMyAvailableAvatars,
    listMyAvailableAvatarsLegacy,
  ];

  for (const load of loaders) {
    try {
      const rows = (await load(token)).filter((row) =>
        isSelectableDefaultAvatar(row),
      );
      if (rows.length > 0) {
        return rows;
      }
    } catch {
      // Try the next documented source.
    }
  }

  return [];
}

export async function getMyStatus(token: string) {
  const payload = await adminRequest<unknown>("/api/me/status", { token });
  return normalizeSingle(payload);
}

function asPlainRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as AdminRecord)
    : null;
}

function isEmployeeDashboardRecord(value: unknown): value is AdminRecord {
  const record = asPlainRecord(value);
  return Boolean(
    record && asPlainRecord(record.user) && asPlainRecord(record.employee),
  );
}

function looksLikeEmployeeDashboardEnvelope(record: AdminRecord) {
  return (
    isEmployeeDashboardRecord(record) ||
    "generated_at" in record ||
    "attendance_today" in record ||
    "attendance_overview" in record ||
    "schedule_preview" in record
  );
}

function unwrapEmployeeDashboardPayload(payload: unknown): AdminRecord | null {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    const record = asPlainRecord(current);
    if (!record) {
      continue;
    }

    if (isEmployeeDashboardRecord(record)) {
      return record;
    }

    for (const key of ["data", "result", "payload", "dashboard", "item"]) {
      if (key in record) {
        queue.push(record[key]);
      }
    }
  }

  const record = asPlainRecord(payload);
  if (record && looksLikeEmployeeDashboardEnvelope(record)) {
    return record;
  }

  return normalizeSingle(payload) ?? record;
}

export async function getMyDashboard(token: string) {
  const payload = await adminRequest<unknown>("/api/me/dashboard", { token });
  return unwrapEmployeeDashboardPayload(payload);
}

export async function getEmployeeDashboard(token: string) {
  const payload = await adminRequest<unknown>("/api/dashboards/employee", {
    token,
  });
  return unwrapEmployeeDashboardPayload(payload);
}

export async function getMyAttendanceAssignments(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/me/attendance/assignments",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function createMyAttendanceCheckIn(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/attendance/check-in", {
    method: "POST",
    token,
    body: data,
  });
}

export async function createMyAttendanceCheckOut(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/attendance/check-out", {
    method: "POST",
    token,
    body: data,
  });
}

export async function createMyAttendanceCorrectionRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/attendance/correction-requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function addMyAttendanceCorrectionDocument(
  token: string,
  id: string | number,
  file: Base64FileDto,
) {
  return adminRequest<unknown>(
    `/api/me/attendance/correction-requests/${id}/documents`,
    { method: "POST", token, body: { file } },
  );
}

export async function listMyAttendanceCorrectionRequests(
  token: string,
  params: SelfServiceRequestQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildSelfServiceRequestQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/attendance/correction-requests${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getMyAttendanceCorrectionRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/attendance/correction-requests/${id}`,
    { token },
  );
  return normalizeSingle(payload);
}

export async function cancelMyAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/me/attendance/correction-requests/${id}/cancel`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function submitMyAttendanceCorrectionRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/me/attendance/correction-requests/${id}/submit`,
    {
      method: "POST",
      token,
    },
  );
}

export async function getMyAttendanceOverview(
  token: string,
  params: MyAttendanceHistoryQueryParams = {},
) {
  const query = buildMyAttendanceHistoryQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/attendance/overview${query}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyAttendanceHistory(
  token: string,
  params: MyAttendanceHistoryQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildMyAttendanceHistoryQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/attendance/history${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listMyAttendancePunches(
  token: string,
  params: MyAttendancePunchesQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildMyAttendancePunchesQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/attendance/punches${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getMyAttendanceSchedule(
  token: string,
  params: MyAttendanceScheduleQueryParams = {},
) {
  const query = buildMyAttendanceScheduleQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/attendance/schedule${query}`,
    { token },
  );
  return normalizeList(payload);
}

/**
 * Attendance "today" payloads often include nested relations (employee, branch, schedule).
 * Generic normalizeSingle() returns the first nested object and drops day status / punch times.
 */
function looksLikeAttendanceTodayRecord(record: AdminRecord | null): boolean {
  if (!record) return false;
  const keys = [
    "attendance_status",
    "attendanceStatus",
    "day_status",
    "dayStatus",
    "punch_state",
    "punchState",
    "first_punch",
    "first_punch_at",
    "first_check_in_at",
    "firstCheckInAt",
    "last_punch",
    "last_punch_at",
    "last_check_out_at",
    "lastCheckOutAt",
    "check_in_at",
    "checkInAt",
    "check_out_at",
    "checkOutAt",
    "worked_hours",
    "workedHours",
    "late_minutes",
    "lateMinutes",
    "schedule_start_at",
    "scheduleStartAt",
    "schedule_end_at",
    "scheduleEndAt",
    "is_off_day",
    "isOffDay",
    "processing_state",
    "processingState",
    "requires_checkout",
    "requiresCheckout",
    "flags",
  ] as const;
  return keys.some((key) => key in record);
}

function mergeAttendanceTodayLayers(
  ...layers: Array<AdminRecord | null | undefined>
): AdminRecord {
  const merged: AdminRecord = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null) continue;
      // Prefer first non-empty scalar; keep first object/array unless missing.
      if (!(key in merged)) {
        merged[key] = value;
        continue;
      }
      const existing = merged[key];
      if (
        (existing === "" ||
          existing === "-" ||
          existing === null ||
          existing === undefined) &&
        value !== "" &&
        value !== "-"
      ) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function normalizeMyAttendanceToday(payload: unknown): AdminRecord | null {
  const root = asRecord(payload);
  if (!root) {
    const list = asArray(payload);
    return list?.[0] ?? null;
  }

  // Prefer explicit envelope bodies without peeling to relations.
  const envelopeCandidates = [
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.payload),
    asRecord(root.response),
    asRecord(root.today),
    asRecord(root.attendance),
    asRecord(root.summary),
    asRecord(root.daily_summary),
    asRecord(root.dailySummary),
  ].filter(Boolean) as AdminRecord[];

  let base: AdminRecord | null = null;
  if (looksLikeAttendanceTodayRecord(root)) {
    base = root;
  } else {
    for (const candidate of envelopeCandidates) {
      if (looksLikeAttendanceTodayRecord(candidate)) {
        base = candidate;
        break;
      }
    }
  }

  // Fall back to first envelope object, then root — never first nested employee/branch alone.
  if (!base) {
    base = envelopeCandidates[0] ?? root;
  }

  const nestedSummary =
    asRecord(base.summary) ??
    asRecord(base.daily_summary) ??
    asRecord(base.dailySummary) ??
    asRecord(base.attendance) ??
    asRecord(base.today) ??
    asRecord(root.summary) ??
    asRecord(root.daily_summary);

  // Flatten useful nested summary fields onto the top-level record for UI readers.
  const flattened = mergeAttendanceTodayLayers(base, nestedSummary);

  // Preserve nested objects for detailed views (TodayOverview already reads summary).
  if (nestedSummary && !asRecord(flattened.summary)) {
    flattened.summary = nestedSummary;
  }

  return flattened;
}

export async function getMyAttendanceToday(token: string) {
  const payload = await adminRequest<unknown>("/api/me/attendance/today", {
    token,
  });
  return normalizeMyAttendanceToday(payload);
}

export async function createMyProfileUpdateRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/profile-update-requests", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listMyProfileUpdateRequests(
  token: string,
  params: SelfServiceRequestQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(fallbackPage));
  searchParams.set("limit", String(fallbackLimit));
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.date_from && params.date_from.trim()) {
    searchParams.set("date_from", params.date_from.trim());
  }
  if (params.date_to && params.date_to.trim()) {
    searchParams.set("date_to", params.date_to.trim());
  }
  const query = `?${searchParams.toString()}`;
  const payload = await adminRequest<unknown>(
    `/api/me/profile-update-requests${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getMyProfileUpdateRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/profile-update-requests/${id}`,
    { token },
  );
  return normalizeSingle(payload);
}

export async function cancelMyProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(`/api/me/profile-update-requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function submitMyProfileUpdateRequest(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/profile-update-requests/${id}/submit`, {
    method: "POST",
    token,
  });
}

/**
 * When "all / history" is requested, many backends only return actionable (pending)
 * rows unless a status is supplied. Fetch these statuses in parallel and merge.
 * Keep to values the HR approvals endpoint typically accepts (avoid draft — self-service only).
 */
const PROFILE_UPDATE_HISTORY_STATUSES = [
  "submitted",
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

function readProfileUpdateRequestRowId(row: AdminRecord) {
  const raw = row.id ?? row.request_id ?? row.requestId;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return "";
}

function profileUpdateRequestSortTime(row: AdminRecord) {
  const candidates = [
    row.submitted_at,
    row.updated_at,
    row.created_at,
    row.decided_at,
    row.reviewed_at,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      const time = Date.parse(value);
      if (Number.isFinite(time)) {
        return time;
      }
    }
  }
  return 0;
}

/**
 * Build list query for HR profile-update approvals.
 * Match attendance-corrections: only page/limit/status/from_date/to_date/employee_id.
 * Extra keys (sortBy, includeHistory, dual date aliases) caused HTTP 400 Bad Request
 * on backends with strict query validation.
 */
function buildHrProfileUpdateApprovalsQuery(
  params: SelfServiceRequestQueryParams & { employee_id?: number },
  status?: string,
) {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = new URLSearchParams();

  query.set("page", String(fallbackPage));
  query.set("limit", String(fallbackLimit));

  if (params.employee_id !== undefined) {
    query.set("employee_id", String(params.employee_id));
  }
  const statusValue = (status ?? params.status)?.trim();
  if (statusValue && statusValue.toLowerCase() !== "all") {
    query.set("status", statusValue);
  }
  if (params.date_from) {
    query.set("from_date", params.date_from);
  }
  if (params.date_to) {
    query.set("to_date", params.date_to);
  }

  return query;
}

export async function listHrProfileUpdateApprovalRequests(
  token: string,
  params: SelfServiceRequestQueryParams & {
    employee_id?: number;
    /** When true (and no single status), fetch pending + decided statuses for history. */
    includeHistory?: boolean;
  } = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;

  const fetchPage = async (status?: string) => {
    const query = buildHrProfileUpdateApprovalsQuery(
      status === undefined ? { ...params, status: undefined } : params,
      status,
    );
    const payload = await adminRequest<unknown>(
      `/api/hr/self-service/approvals/profile-updates?${query.toString()}`,
      {
        token,
      },
    );
    const rows = normalizeList(payload);
    const pagination = extractUsersPagination(
      payload,
      fallbackPage,
      fallbackLimit,
    );
    return { rows, ...pagination };
  };

  const mergeSettledPages = (
    settled: PromiseSettledResult<PaginatedUsersResult>[],
  ): PaginatedUsersResult | null => {
    const byId = new Map<string, AdminRecord>();
    let totalHint: number | null = null;
    let anyFulfilled = false;

    for (const result of settled) {
      if (result.status !== "fulfilled") {
        continue;
      }
      anyFulfilled = true;
      if (
        typeof result.value.total === "number" &&
        Number.isFinite(result.value.total)
      ) {
        totalHint = Math.max(totalHint ?? 0, result.value.total);
      }
      for (const row of result.value.rows) {
        const id = readProfileUpdateRequestRowId(row);
        if (!id) {
          byId.set(
            `anon-${byId.size}-${JSON.stringify(row).slice(0, 48)}`,
            row,
          );
          continue;
        }
        const existing = byId.get(id);
        byId.set(id, existing ? { ...existing, ...row } : row);
      }
    }

    if (!anyFulfilled) {
      return null;
    }

    const rows = Array.from(byId.values()).sort(
      (left, right) =>
        profileUpdateRequestSortTime(right) -
        profileUpdateRequestSortTime(left),
    );

    return {
      rows,
      total:
        totalHint !== null ? Math.max(totalHint, rows.length) : rows.length,
      page: fallbackPage,
      limit: fallbackLimit,
      totalPages:
        fallbackLimit > 0
          ? Math.max(
              1,
              Math.ceil(
                (totalHint !== null
                  ? Math.max(totalHint, rows.length)
                  : rows.length) / fallbackLimit,
              ),
            )
          : 1,
    };
  };

  const fetchHistoryMerged = async () => {
    const settled = await Promise.allSettled([
      fetchPage(undefined),
      ...PROFILE_UPDATE_HISTORY_STATUSES.map((status) => fetchPage(status)),
    ]);
    const merged = mergeSettledPages(settled);
    if (merged) {
      return merged;
    }

    // Last resort: bare request with only page/limit (no status/dates).
    const bare = new URLSearchParams({
      page: String(fallbackPage),
      limit: String(fallbackLimit),
    });
    const payload = await adminRequest<unknown>(
      `/api/hr/self-service/approvals/profile-updates?${bare.toString()}`,
      {
        token,
      },
    );
    const rows = normalizeList(payload);
    const pagination = extractUsersPagination(
      payload,
      fallbackPage,
      fallbackLimit,
    );
    return { rows, ...pagination };
  };

  // Single status filter — try API first; on 400, load history and filter client-side.
  if (
    params.status &&
    params.status.trim() &&
    params.status.trim().toLowerCase() !== "all"
  ) {
    const requestedStatus = params.status.trim().toLowerCase();
    try {
      return await fetchPage(params.status.trim());
    } catch (errorObject) {
      const statusCode =
        typeof errorObject === "object" &&
        errorObject !== null &&
        "status" in errorObject
          ? Number((errorObject as { status?: number }).status)
          : null;
      if (statusCode !== 400) {
        throw errorObject;
      }
      const history = await fetchHistoryMerged();
      const rows = history.rows.filter((row) => {
        const rowStatus = String(row.status ?? "")
          .trim()
          .toLowerCase();
        return (
          rowStatus === requestedStatus || rowStatus.includes(requestedStatus)
        );
      });
      return {
        rows,
        total: rows.length,
        page: fallbackPage,
        limit: fallbackLimit,
        totalPages:
          fallbackLimit > 0
            ? Math.max(1, Math.ceil(rows.length / fallbackLimit))
            : 1,
      };
    }
  }

  // Default / "all": unfiltered + status variants, same query shape as attendance corrections.
  if (params.includeHistory !== false) {
    return fetchHistoryMerged();
  }

  return fetchPage(undefined);
}

export async function getHrProfileUpdateApprovalRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/self-service/approvals/profile-updates/${id}`,
    {
      token,
    },
  );
  return normalizeSingle(payload);
}

export async function approveHrProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/hr/self-service/approvals/profile-updates/${id}/approve`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function rejectHrProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/hr/self-service/approvals/profile-updates/${id}/reject`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listHrAttendanceCorrectionApprovalRequests(
  token: string,
  params: SelfServiceRequestQueryParams & { employee_id?: number } = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = new URLSearchParams();

  query.set("page", String(fallbackPage));
  query.set("limit", String(fallbackLimit));

  if (params.employee_id !== undefined) {
    query.set("employee_id", String(params.employee_id));
  }
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.date_from) {
    query.set("from_date", params.date_from);
  }
  if (params.date_to) {
    query.set("to_date", params.date_to);
  }

  const payload = await adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections?${query.toString()}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getHrAttendanceCorrectionApprovalRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections/${id}`,
    { token },
  );
  return normalizeSingle(payload);
}

export async function downloadHrAttendanceCorrectionEvidence(
  token: string,
  requestId: string | number,
  documentId: string | number,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    buildUrl(`/api/hr/self-service/approvals/attendance-corrections/${requestId}/documents/${documentId}/download`),
    { headers: { Authorization: `Bearer ${token}`, accept: "*/*" }, cache: "no-store" },
  )
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(extractMessage(payload, response.status))
  }
  const disposition = response.headers.get("content-disposition") ?? ""
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i)
  return {
    blob: await response.blob(),
    filename: decodeURIComponent(match?.[1] ?? match?.[2] ?? `attendance-evidence-${documentId}`),
  }
}

export async function approveHrAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections/${id}/approve`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function rejectHrAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections/${id}/reject`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listMyTeamAttendance(
  token: string,
  params: TeamAttendanceQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildTeamAttendanceQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/team/attendance${query}`,
    { token },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listCurrentCompanyUsers(
  token: string,
  params: UsersQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildUsersQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/companies/current/users${query}`,
    {
      token,
      signal: options.signal,
      cacheTtlMs: options.cacheTtlMs,
      dedupe: options.dedupe,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

/** Page through company users (max 100 per page) for assignment UIs. */
export async function listAllCurrentCompanyUsers(
  token: string,
  options: { maxPages?: number; signal?: AbortSignal } = {},
): Promise<AdminRecord[]> {
  const maxPages =
    options.maxPages && options.maxPages > 0 ? options.maxPages : 15;
  const collected: AdminRecord[] = [];
  let page = 1;
  while (page <= maxPages) {
    const result = await listCurrentCompanyUsers(
      token,
      { page, limit: 100, sortBy: "created_at", sortOrder: "ASC" },
      {
        signal: options.signal,
        dedupe: false,
        cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
      },
    );
    collected.push(...result.rows);
    const hasKnownTotalPages =
      typeof result.totalPages === "number" && result.totalPages > 0;
    const hasKnownTotal = typeof result.total === "number";
    const reachedEnd =
      result.rows.length === 0 ||
      (hasKnownTotalPages
        ? page >= result.totalPages!
        : hasKnownTotal
          ? collected.length >= result.total!
          : result.rows.length < 100);
    if (reachedEnd) {
      break;
    }
    page += 1;
  }
  return collected;
}

export async function createCurrentCompanyUser(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/companies/current/users", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getCurrentCompanyUser(
  token: string,
  userId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/companies/current/users/${userId}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function deleteCurrentCompanyUser(
  token: string,
  userId: string | number,
) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}`, {
    method: "DELETE",
    token,
  });
}

export async function assignRoleToCurrentCompanyUser(
  token: string,
  userId: string | number,
  roleId: string | number,
) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}/roles`, {
    method: "POST",
    token,
    body: { role_id: Number(roleId) },
  });
}

export async function revokeRoleFromCurrentCompanyUser(
  token: string,
  userId: string | number,
  roleId: string | number,
) {
  return adminRequest<unknown>(
    `/api/companies/current/users/${userId}/roles/${roleId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function assignPermissionToCurrentCompanyUser(
  token: string,
  userId: string | number,
  permissionId: string | number,
) {
  return adminRequest<unknown>(
    `/api/companies/current/users/${userId}/permissions`,
    {
      method: "POST",
      token,
      body: { permission_id: Number(permissionId) },
    },
  );
}

export async function revokePermissionFromCurrentCompanyUser(
  token: string,
  userId: string | number,
  permissionId: string | number,
) {
  return adminRequest<unknown>(
    `/api/companies/current/users/${userId}/permissions/${permissionId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function listMyLeaveBalances(
  token: string,
  params: LeaveBalancesQueryParams = {},
): Promise<
  PaginatedUsersResult & {
    current_fiscal_year?: string;
    totals?: Record<string, number>;
  }
> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveBalancesQuery(params);
  const payload = await adminRequest<unknown>(
    `/api/me/leave/balances${query}`,
    { token },
  );
  const groupedRows = normalizeList(payload);
  // The self-service endpoint returns balances grouped under the employee
  // record, while the profile UI renders one card per leave type.
  const rows = groupedRows.flatMap((group) => {
    const leaveBalances = asArray(group.leave_balances ?? group.leaveBalances);
    if (!leaveBalances) {
      return [group];
    }
    return leaveBalances.map((balance) => ({
      ...balance,
      employee_id: balance.employee_id ?? group.employee_id ?? group.id,
      employee_name: balance.employee_name ?? group.employee_name,
    }));
  });
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  const record = asRecord(payload) || {};
  return {
    rows,
    ...pagination,
    current_fiscal_year: (record.current_fiscal_year ||
      record.currentFiscalYear ||
      "2026") as string,
    totals: (record.totals || {}) as Record<string, number>,
  };
}

export async function getUserById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/users/${id}`, { token });
  return normalizeSingle(payload);
}

export async function updateUserById(
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/users/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

/** PATCH /api/users/{id}/avatar — assign an active default avatar to a user. */
export async function resetUserPassword(
  token: string,
  userId: string | number,
  newPassword: string,
) {
  return adminRequest<unknown>(`/api/users/${userId}/reset-password`, {
    method: "POST",
    token,
    body: { new_password: newPassword },
  });
}

export async function assignUserAvatar(
  token: string,
  userId: string | number,
  avatarId: number,
) {
  return adminRequest<unknown>(`/api/users/${userId}/avatar`, {
    method: "PATCH",
    token,
    body: { avatar_id: avatarId },
  });
}

const TWO_FACTOR_FLAG_KEYS = [
  "is_two_factor_enabled",
  "isTwoFactorEnabled",
  "two_factor_enabled",
  "twoFactorEnabled",
  "is_2fa_enabled",
  "is2faEnabled",
  "is2FAEnabled",
  "two_factor_active",
  "twoFactorActive",
  "mfa_enabled",
  "mfaEnabled",
  "totp_enabled",
  "totpEnabled",
  "has_two_factor",
  "hasTwoFactor",
  "two_factor",
  "twoFactor",
] as const;

const TWO_FACTOR_STATUS_KEYS = [
  "two_factor_status",
  "twoFactorStatus",
  "mfa_status",
  "mfaStatus",
  "two_factor_state",
  "twoFactorState",
] as const;

const TWO_FACTOR_NEST_KEYS = [
  "user",
  "account",
  "company_user",
  "companyUser",
  "security",
  "auth",
  "profile",
  "settings",
] as const;

function coerceTwoFactorFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (
      [
        "true",
        "1",
        "yes",
        "y",
        "on",
        "enabled",
        "active",
        "activated",
        "verified",
        "complete",
        "completed",
        "setup_complete",
        "setup-complete",
        "enforced",
        "required_and_enabled",
      ].includes(normalized)
    ) {
      return true;
    }
    if (
      [
        "false",
        "0",
        "no",
        "n",
        "off",
        "disabled",
        "inactive",
        "none",
        "pending",
        "not_setup",
        "not-setup",
        "not_enabled",
        "not-enabled",
        "unverified",
      ].includes(normalized)
    ) {
      return false;
    }
  }
  return null;
}

function readTwoFactorFlagFromRecord(
  record: AdminRecord,
  depth: number,
): boolean | null {
  for (const key of TWO_FACTOR_FLAG_KEYS) {
    if (!(key in record)) {
      continue;
    }
    const coerced = coerceTwoFactorFlag(record[key]);
    if (coerced !== null) {
      return coerced;
    }
  }

  for (const key of TWO_FACTOR_STATUS_KEYS) {
    if (!(key in record)) {
      continue;
    }
    const coerced = coerceTwoFactorFlag(record[key]);
    if (coerced !== null) {
      return coerced;
    }
  }

  // Some APIs only expose whether a secret / TOTP method exists.
  for (const key of [
    "two_factor_secret",
    "twoFactorSecret",
    "totp_secret",
    "totpSecret",
    "two_factor_secret_set",
    "twoFactorSecretSet",
    "has_totp_secret",
    "hasTotpSecret",
  ] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return true;
    }
    if (value === true) {
      return true;
    }
  }

  if (depth >= 2) {
    return null;
  }

  for (const nestKey of TWO_FACTOR_NEST_KEYS) {
    const nested = asRecord(record[nestKey]);
    if (!nested) {
      continue;
    }
    const nestedFlag = readTwoFactorFlagFromRecord(nested, depth + 1);
    if (nestedFlag !== null) {
      return nestedFlag;
    }
  }

  return null;
}

/**
 * Resolve whether 2FA is enabled for a user/employee-like record.
 * Handles camelCase/snake_case, status strings, and nested `user` / `security` objects.
 */
export function readTwoFactorEnabled(
  record: AdminRecord | null | undefined,
): boolean {
  if (!record) {
    return false;
  }
  return readTwoFactorFlagFromRecord(record, 0) ?? false;
}

const FORCE_TWO_FACTOR_KEYS = [
  "force_two_factor",
  "forceTwoFactor",
  "two_factor_forced",
  "twoFactorForced",
  "two_factor_required",
  "twoFactorRequired",
] as const;

/** Resolve whether 2FA is mandatory for a user, independent of current setup. */
export function readForceTwoFactor(
  record: AdminRecord | null | undefined,
): boolean {
  if (!record) {
    return false;
  }

  for (const key of FORCE_TWO_FACTOR_KEYS) {
    if (!(key in record)) {
      continue;
    }
    const coerced = coerceTwoFactorFlag(record[key]);
    if (coerced !== null) {
      return coerced;
    }
  }

  for (const nestKey of TWO_FACTOR_NEST_KEYS) {
    const nested = asRecord(record[nestKey]);
    if (!nested) {
      continue;
    }
    for (const key of FORCE_TWO_FACTOR_KEYS) {
      if (!(key in nested)) {
        continue;
      }
      const coerced = coerceTwoFactorFlag(nested[key]);
      if (coerced !== null) {
        return coerced;
      }
    }
  }

  return false;
}

/** Attach consistent top-level 2FA fields for tables and toggles. */
export function withNormalizedTwoFactorFields(
  record: AdminRecord,
): AdminRecord {
  const enabled = readTwoFactorEnabled(record);
  const forced = readForceTwoFactor(record);
  return {
    ...record,
    two_factor_enabled: enabled,
    is_two_factor_enabled: enabled,
    twoFactorEnabled: enabled,
    force_two_factor: forced,
    forceTwoFactor: forced,
  };
}

/**
 * Build a userId → 2FA-enabled map from GET /api/users (paginated).
 * Stops early once every needed id is resolved (or the catalog ends).
 */
export async function buildUserTwoFactorMap(
  token: string,
  neededUserIds: Iterable<string | number> = [],
  options: {
    signal?: AbortSignal;
    maxPages?: number;
    cacheTtlMs?: number;
  } = {},
): Promise<Map<string, boolean>> {
  const needed = new Set(
    Array.from(neededUserIds)
      .map((id) => String(id).trim())
      .filter(Boolean),
  );
  const map = new Map<string, boolean>();
  const maxPages =
    options.maxPages && options.maxPages > 0 ? options.maxPages : 20;
  let page = 1;

  while (page <= maxPages) {
    const result = await listUsers(
      token,
      { page, limit: 100, sortBy: "created_at", sortOrder: "ASC" },
      {
        signal: options.signal,
        cacheTtlMs: options.cacheTtlMs,
        dedupe: true,
      },
    );

    for (const user of result.rows) {
      const id =
        user.id ??
        user.user_id ??
        user.userId ??
        user.company_user_id ??
        user.companyUserId;
      if (id === null || id === undefined || id === "") {
        continue;
      }
      map.set(String(id), readTwoFactorEnabled(user));
    }

    const allNeededFound =
      needed.size === 0 ? false : [...needed].every((id) => map.has(id));
    const reachedEnd =
      result.rows.length === 0 ||
      result.rows.length < 100 ||
      (typeof result.totalPages === "number" && page >= result.totalPages) ||
      (typeof result.total === "number" && map.size >= result.total);

    if (allNeededFound || reachedEnd) {
      break;
    }
    page += 1;
  }

  return map;
}

/** PATCH /api/users/{userId}/two-factor/enable — admin enables 2FA (user completes setup on next login). */
export async function enableUserTwoFactor(
  token: string,
  userId: string | number,
) {
  return adminRequest<unknown>(`/api/users/${userId}/two-factor/enable`, {
    method: "PATCH",
    token,
  });
}

/** PATCH /api/users/{userId}/two-factor/disable — admin disables 2FA and revokes recovery data. */
export async function disableUserTwoFactor(
  token: string,
  userId: string | number,
  reason?: string,
) {
  return adminRequest<unknown>(`/api/users/${userId}/two-factor/disable`, {
    method: "PATCH",
    token,
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

/**
 * PATCH /api/users/{userId}/two-factor/force
 * Mark 2FA as mandatory (or optional) for a specific user.
 */
export async function setUserForceTwoFactor(
  token: string,
  userId: string | number,
  force: boolean,
) {
  return adminRequest<unknown>(`/api/users/${userId}/two-factor/force`, {
    method: "PATCH",
    token,
    body: { force },
  });
}

/**
 * POST /api/users/2fa/backup-codes/regenerate
 * Requires the current TOTP token or an unused backup code.
 */
export async function regenerateMyTwoFactorBackupCodes(
  token: string,
  totpOrBackupCode: string,
) {
  const code = totpOrBackupCode.trim();
  if (!code) {
    throw new Error("Enter an authenticator code or backup code.");
  }
  const payload = await adminRequest<unknown>(
    "/api/users/2fa/backup-codes/regenerate",
    {
      method: "POST",
      token,
      body: { token: code },
    },
  );
  return extractBackupCodes(payload);
}

export async function deleteUserById(id: string | number, token: string) {
  return adminRequest<unknown>(`/api/users/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function updateCurrentUserProfile(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/users/me", {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function changeCurrentUserPassword(
  token: string,
  oldPassword: string,
  newPassword: string,
) {
  return adminRequest<unknown>("/api/users/me/change-password", {
    method: "POST",
    token,
    body: {
      old_password: oldPassword,
      new_password: newPassword,
    },
  });
}

export async function assignRoleToUser(
  token: string,
  userId: string | number,
  roleId: string | number,
) {
  return adminRequest<unknown>(`/api/users/${userId}/roles/${roleId}`, {
    method: "POST",
    token,
  });
}

export async function revokeRoleFromUser(
  token: string,
  userId: string | number,
  roleId: string | number,
) {
  return adminRequest<unknown>(`/api/users/${userId}/roles/${roleId}`, {
    method: "DELETE",
    token,
  });
}

export async function patchResource(
  resource: Exclude<AdminResourceKey, "companies">,
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`${RESOURCE_PATHS[resource]}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteResource(
  resource: Exclude<AdminResourceKey, "companies">,
  id: string | number,
  token: string,
) {
  return adminRequest<unknown>(`${RESOURCE_PATHS[resource]}/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function getRoleById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/roles/${id}`, {
    token,
    cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
  });
  return normalizeSingle(payload);
}

export async function updateRoleById(
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/roles/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteRoleById(id: string | number, token: string) {
  return adminRequest<unknown>(`/api/roles/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listRolePermissions(
  token: string,
  roleId: string | number,
  options: { cacheTtlMs?: number; pageSize?: number } = {},
): Promise<AdminRecord[]> {
  const pageSize =
    options.pageSize && options.pageSize > 0
      ? Math.min(options.pageSize, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100)
      : Math.min(100, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100);
  const cacheTtlMs =
    options.cacheTtlMs === undefined
      ? env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS
      : options.cacheTtlMs;
  const query = buildUsersQuery({ page: 1, limit: pageSize });
  const payload = await adminRequest<unknown>(
    `/api/roles/${roleId}/permissions${query}`,
    {
      token,
      cacheTtlMs,
    },
  );
  return dedupeAdminRecordsById(normalizeList(payload));
}

export async function assignPermissionToRole(
  token: string,
  roleId: string | number,
  permissionId: string | number,
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/permissions`, {
    method: "POST",
    token,
    body: { permission_id: Number(permissionId) },
  });
}

export async function revokePermissionFromRole(
  token: string,
  roleId: string | number,
  permissionId: string | number,
) {
  return adminRequest<unknown>(
    `/api/roles/${roleId}/permissions/${permissionId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function listRoleUsers(
  token: string,
  roleId: string | number,
  params: UsersQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 100;
  // GET /api/roles/{id}/users can return `{ total: N, items: [] }` when page/limit/sort
  // are sent, same as GET /api/roles. Keep page 1 on the bare path and only send
  // the page number when walking the remaining pages.
  const queryParams = new URLSearchParams();
  if (fallbackPage > 1) {
    queryParams.set("page", String(fallbackPage));
  }
  if (params.search?.trim()) {
    queryParams.set("search", params.search.trim());
  }
  const encodedQuery = queryParams.toString();
  const query = encodedQuery ? `?${encodedQuery}` : "";
  const payload = await adminRequest<unknown>(
    `/api/roles/${roleId}/users${query}`,
    {
      token,
    },
  );
  let rows = normalizeList(payload);
  if (rows.length === 0 && query) {
    const retry = await adminRequest<unknown>(`/api/roles/${roleId}/users`, {
      token,
    });
    rows = normalizeList(retry);
  }
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

/** Load every page returned by GET /api/roles/{id}/users for assignment UIs. */
export async function listAllRoleUsers(
  token: string,
  roleId: string | number,
  options: { maxPages?: number } = {},
): Promise<AdminRecord[]> {
  const maxPages =
    options.maxPages && options.maxPages > 0 ? options.maxPages : 30;
  const collected: AdminRecord[] = [];
  let page = 1;

  while (page <= maxPages) {
    const result = await listRoleUsers(token, roleId, { page });
    collected.push(...result.rows);

    const hasKnownTotalPages =
      typeof result.totalPages === "number" && result.totalPages > 0;
    const hasKnownTotal = typeof result.total === "number";
    const reachedEnd =
      result.rows.length === 0 ||
      (hasKnownTotalPages
        ? page >= result.totalPages!
        : hasKnownTotal
          ? collected.length >= result.total!
          : result.rows.length < result.limit);
    if (reachedEnd) {
      break;
    }
    page += 1;
  }

  return collected;
}

export async function assignUserToRole(
  token: string,
  roleId: string | number,
  userId: string | number,
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/users`, {
    method: "POST",
    token,
    body: { user_id: Number(userId) },
  });
}

export async function revokeUserFromRole(
  token: string,
  roleId: string | number,
  userId: string | number,
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/users/${userId}`, {
    method: "DELETE",
    token,
  });
}

export async function createPermission(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/permissions", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getPermissionById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/permissions/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function updatePermissionById(
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/permissions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function patchEmployeeSectionItem(
  token: string,
  employeeId: string | number,
  section: EmployeeProfileSection,
  itemId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/employees/${employeeId}/${section}/${itemId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function createEmployeeSectionItem(
  token: string,
  employeeId: string | number,
  section: EmployeeProfileSection,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/${section}`, {
    method: "POST",
    token,
    body: data,
  });
}

/** Self-onboarding: adds a section item to the caller's own employee profile. */
export async function createMyEmployeeSectionItem(
  token: string,
  section: EmployeeProfileSection,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employees/me/${section}`, {
    method: "POST",
    token,
    body: data,
  });
}

/** Self-onboarding: attaches a document to the caller's own employee profile. */
export async function createMyEmployeeDocument(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employees/me/documents`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function deleteEmployeeSectionItem(
  token: string,
  employeeId: string | number,
  section: EmployeeProfileSection,
  itemId: string | number,
) {
  return adminRequest<unknown>(
    `/api/employees/${employeeId}/${section}/${itemId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function patchEmployeeStatus(
  token: string,
  employeeId: string | number,
  data: EmployeeStatusPayload,
) {
  const normalizedStatus = String(data.employment_status ?? "")
    .trim()
    .toLowerCase();
  const effectiveDate =
    typeof data.effective_date === "string" ? data.effective_date.trim() : "";
  if (!isEmployeeStatusValue(normalizedStatus)) {
    throw new Error("Invalid employee status.");
  }
  if (!effectiveDate) {
    throw new Error("Effective date is required.");
  }

  const trimmedNotes = typeof data.notes === "string" ? data.notes.trim() : "";
  const normalizedPayload: EmployeeStatusPayload = {
    employment_status: normalizedStatus,
    effective_date: effectiveDate,
    notes: trimmedNotes || undefined,
  };

  if (
    ["resigned", "terminated", "retired", "deceased", "exited"].includes(normalizedStatus)
  ) {
    const trimmedExitDate =
      typeof data.exit_date === "string" ? data.exit_date.trim() : "";
    const trimmedExitReason =
      typeof data.exit_reason === "string" ? data.exit_reason.trim() : "";
    normalizedPayload.exit_date = trimmedExitDate || undefined;
    normalizedPayload.exit_reason = trimmedExitReason || undefined;
  }

  return adminRequest<unknown>(`/api/employees/${employeeId}/status`, {
    method: "PATCH",
    token,
    body: normalizedPayload,
  });
}

/** Archive an employee profile through the documented employee DELETE endpoint. */
export async function archiveEmployeeProfile(
  token: string,
  employeeId: string | number,
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}`, {
    method: "DELETE",
    token,
  });
}

export interface PermanentEmployeeDeletionResponse {
  message: string;
  employee_id: number;
  company_user_removed: boolean;
  user_account_removed: boolean;
  files_removed: number;
}

/**
 * Permanently delete an employee who is still onboarding, with their records.
 * The backend refuses (409) once the employee has working history, supervises
 * others, or has device access; the message explains why.
 */
export async function deleteEmployeePermanently(
  token: string,
  employeeId: string | number,
) {
  return adminRequest<PermanentEmployeeDeletionResponse>(
    `/api/employees/${employeeId}/permanent`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function unlinkEmployeeCompanyUser(
  token: string,
  employeeId: string | number,
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/company-user`, {
    method: "DELETE",
    token,
  });
}

export async function removeEmployeeLinkedAccount(
  token: string,
  employeeId: string | number,
) {
  return adminRequest<unknown>(
    `/api/employees/${employeeId}/company-user/account`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function patchEmployeeAssignment(
  token: string,
  employeeId: string | number,
  data: EmployeeAssignmentPayload,
) {
  const effectiveDate =
    typeof data.effective_date === "string" ? data.effective_date.trim() : "";
  if (!effectiveDate) {
    throw new Error("Effective date is required.");
  }

  const normalizedPayload: EmployeeAssignmentPayload = {
    effective_date: effectiveDate,
  };

  if ("branch_id" in data) {
    normalizedPayload.branch_id = data.branch_id ?? null;
  }
  if ("departments" in data) {
    normalizedPayload.departments = Array.isArray(data.departments)
      ? data.departments
      : [];
  }
  if ("primary_position_id" in data) {
    normalizedPayload.primary_position_id = data.primary_position_id ?? null;
  }
  if ("reports_to" in data) {
    normalizedPayload.reports_to = data.reports_to ?? null;
  }
  if ("grade_id" in data) {
    normalizedPayload.grade_id = data.grade_id ?? null;
  }
  if ("cost_center_id" in data) {
    normalizedPayload.cost_center_id = data.cost_center_id ?? null;
  }
  if (typeof data.reason === "string") {
    const trimmedReason = data.reason.trim();
    normalizedPayload.reason = trimmedReason || undefined;
  }

  return adminRequest<unknown>(`/api/employees/${employeeId}/assignment`, {
    method: "PATCH",
    token,
    body: normalizedPayload,
  });
}

export async function createEmployeeDocument(
  token: string,
  employeeId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/documents`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function deleteEmployeeDocument(
  token: string,
  employeeId: string | number,
  documentId: string | number,
) {
  return adminRequest<unknown>(
    `/api/employees/${employeeId}/documents/${documentId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function downloadEmployeeDocument(
  token: string,
  employeeId: string | number,
  documentId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  return downloadAdminBlob(
    `/api/employees/${employeeId}/documents/${documentId}/download`,
    token,
    `employee-${employeeId}-document-${documentId}`,
  );
}

// ---------------------------------------------------------------------------
// Scheduled Reporting
// ---------------------------------------------------------------------------

export type ScheduledReportSortOrder = SortOrder;

export interface ScheduledReportingListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: ScheduledReportSortOrder;
  search?: string;
  templateId?: number;
  scheduleId?: number;
  reportDefinitionId?: number;
  smtpConfigurationId?: number;
  status?: string;
  emailDeliveryStatus?: string;
  source?: string;
  scheduleType?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

function buildScheduledReportingQuery(
  params: ScheduledReportingListParams = {},
) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy?.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (typeof params.templateId === "number") {
    searchParams.set("templateId", String(params.templateId));
  }
  if (typeof params.scheduleId === "number") {
    searchParams.set("scheduleId", String(params.scheduleId));
  }
  if (typeof params.reportDefinitionId === "number") {
    searchParams.set("reportDefinitionId", String(params.reportDefinitionId));
  }
  if (typeof params.smtpConfigurationId === "number") {
    searchParams.set("smtpConfigurationId", String(params.smtpConfigurationId));
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }
  if (params.emailDeliveryStatus?.trim()) {
    searchParams.set("emailDeliveryStatus", params.emailDeliveryStatus.trim());
  }
  if (params.source?.trim()) {
    searchParams.set("source", params.source.trim());
  }
  if (params.scheduleType?.trim()) {
    searchParams.set("scheduleType", params.scheduleType.trim());
  }
  if (typeof params.isActive === "boolean") {
    searchParams.set("isActive", String(params.isActive));
  }
  if (typeof params.isDefault === "boolean") {
    searchParams.set("isDefault", String(params.isDefault));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

/**
 * Scheduled-reporting entities embed company / definition / SMTP / user relations.
 * Generic normalizeSingle() prefers the first nested object (data/result/item/user/company),
 * so a bare ReportTemplate payload would be reduced to `company` or `dateRangeConfig`
 * and the template detail sheet would render empty defaults.
 */
const SCHEDULED_REPORTING_IDENTITY_KEYS = [
  "reportDefinitionId",
  "report_definition_id",
  "smtpConfigurationId",
  "smtp_configuration_id",
  "outputFormat",
  "output_format",
  "dateRangeStrategy",
  "date_range_strategy",
  "filenamePattern",
  "filename_pattern",
  "emailSubjectTemplate",
  "email_subject_template",
  "emailBodyTemplate",
  "email_body_template",
  "attachReport",
  "attach_report",
  "scheduleType",
  "schedule_type",
  "executionTime",
  "execution_time",
  "misfireHandling",
  "misfire_handling",
  "senderEmail",
  "sender_email",
  "securityType",
  "security_type",
  "emailDeliveryStatus",
  "email_delivery_status",
] as const;

function looksLikeScheduledReportingRecord(
  record: AdminRecord | null,
): boolean {
  if (!record) {
    return false;
  }
  if (SCHEDULED_REPORTING_IDENTITY_KEYS.some((key) => key in record)) {
    return true;
  }
  if ("host" in record && "port" in record) {
    return true;
  }
  return Boolean(
    asRecord(record.reportDefinition) ||
    asRecord(record.report_definition) ||
    asRecord(record.smtpConfiguration) ||
    asRecord(record.smtp_configuration),
  );
}

function unwrapScheduledReportingCandidate(
  payload: unknown,
): AdminRecord | null {
  const root = asRecord(payload);
  if (!root) {
    const list = asArray(payload);
    return list?.[0] ?? null;
  }

  if (looksLikeScheduledReportingRecord(root)) {
    return root;
  }

  const wrappers = [
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.item),
    asRecord(root.payload),
    asRecord(root.response),
    asRecord(root.template),
    asRecord(root.reportTemplate),
    asRecord(root.report_template),
    asRecord(root.schedule),
    asRecord(root.reportSchedule),
    asRecord(root.report_schedule),
    asRecord(root.smtpConfiguration),
    asRecord(root.smtp_configuration),
    asRecord(root.execution),
    asRecord(root.reportExecution),
    asRecord(root.report_execution),
  ];

  for (const wrapper of wrappers) {
    if (!wrapper) continue;
    if (looksLikeScheduledReportingRecord(wrapper)) {
      return wrapper;
    }

    const nested =
      asRecord(wrapper.data) ??
      asRecord(wrapper.result) ??
      asRecord(wrapper.item) ??
      asRecord(wrapper.template) ??
      asRecord(wrapper.schedule) ??
      asRecord(wrapper.execution);
    if (looksLikeScheduledReportingRecord(nested)) {
      return nested;
    }
  }

  for (const nested of getNestedRecords(root)) {
    if (looksLikeScheduledReportingRecord(nested)) {
      return nested;
    }
  }

  return null;
}

function normalizeScheduledReportingRecord(
  payload: unknown,
): AdminRecord | null {
  return unwrapScheduledReportingCandidate(payload) ?? normalizeSingle(payload);
}

async function listScheduledReportingCollection(
  path: string,
  token: string,
  params: ScheduledReportingListParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const payload = await adminRequest<unknown>(
    `${path}${buildScheduledReportingQuery(params)}`,
    {
      token,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function listScheduledReportDefinitions(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/scheduled-reporting/report-definitions",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listScheduledReportTemplates(
  token: string,
  params: ScheduledReportingListParams = {},
) {
  return listScheduledReportingCollection(
    "/api/scheduled-reporting/templates",
    token,
    params,
  );
}

export async function getScheduledReportTemplate(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/templates/${id}`,
    {
      token,
    },
  );
  return normalizeScheduledReportingRecord(payload);
}

export async function createScheduledReportTemplate(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/scheduled-reporting/templates", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateScheduledReportTemplate(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/templates/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteScheduledReportTemplate(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/templates/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listScheduledReportSchedules(
  token: string,
  params: ScheduledReportingListParams = {},
) {
  return listScheduledReportingCollection(
    "/api/scheduled-reporting/schedules",
    token,
    params,
  );
}

export async function getScheduledReportSchedule(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/schedules/${id}`,
    {
      token,
    },
  );
  return normalizeScheduledReportingRecord(payload);
}

export async function createScheduledReportSchedule(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/scheduled-reporting/schedules", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateScheduledReportSchedule(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/schedules/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteScheduledReportSchedule(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/schedules/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listScheduledReportExecutions(
  token: string,
  params: ScheduledReportingListParams = {},
) {
  return listScheduledReportingCollection(
    "/api/scheduled-reporting/executions",
    token,
    params,
  );
}

export async function getScheduledReportExecution(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/executions/${id}`,
    {
      token,
    },
  );
  return normalizeScheduledReportingRecord(payload);
}

export async function retryScheduledReportExecution(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/executions/${id}/retry`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeScheduledReportingRecord(payload) ?? asRecord(payload);
}

export async function downloadScheduledReportExecution(
  token: string,
  id: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(`/api/scheduled-reporting/executions/${id}/download`),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ??
    filenameMatch?.[2] ??
    `scheduled-report-execution-${id}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function runScheduledReportTemplate(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/templates/${id}/run`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeScheduledReportingRecord(payload) ?? asRecord(payload);
}

export async function listScheduledReportSmtpConfigurations(
  token: string,
  params: ScheduledReportingListParams = {},
) {
  return listScheduledReportingCollection(
    "/api/scheduled-reporting/smtp-configurations",
    token,
    params,
  );
}

export async function getScheduledReportSmtpConfiguration(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/smtp-configurations/${id}`,
    { token },
  );
  return normalizeScheduledReportingRecord(payload);
}

export async function createScheduledReportSmtpConfiguration(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/scheduled-reporting/smtp-configurations", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateScheduledReportSmtpConfiguration(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/scheduled-reporting/smtp-configurations/${id}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deleteScheduledReportSmtpConfiguration(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/scheduled-reporting/smtp-configurations/${id}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function testScheduledReportSmtpConfiguration(
  token: string,
  id: string | number,
  data: { toEmail?: string; sendTestEmail?: boolean } = {},
) {
  return adminRequest<unknown>(
    `/api/scheduled-reporting/smtp-configurations/${id}/test`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

/** Test the platform MAIL_* transport used by invitations and notifications. */
export async function testSystemSmtpConfiguration(
  token: string,
  testRecipientEmail: string,
) {
  return adminRequest<unknown>(
    "/api/scheduled-reporting/smtp-configurations/test-system",
    {
      method: "POST",
      token,
      body: { testRecipientEmail },
    },
  );
}

/** Test SMTP using form values before the configuration is saved. */
export async function testScheduledReportSmtpConfigurationDraft(
  token: string,
  data: AdminRecord & { toEmail?: string; sendTestEmail?: boolean },
) {
  return adminRequest<unknown>(
    "/api/scheduled-reporting/smtp-configurations/test-draft",
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export interface PayrollListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
  employee_id?: number;
  payroll_period_id?: number;
  payroll_run_id?: number;
  year?: number;
  status?: string;
}

function buildPayrollQuery(params: PayrollListParams = {}) {
  const searchParams = new URLSearchParams();
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.sortBy?.trim()) {
    searchParams.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder?.trim()) {
    searchParams.set("sortOrder", params.sortOrder.trim());
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim());
  }
  if (
    typeof params.employee_id === "number" &&
    Number.isFinite(params.employee_id)
  ) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (
    typeof params.payroll_period_id === "number" &&
    Number.isFinite(params.payroll_period_id)
  ) {
    searchParams.set("payroll_period_id", String(params.payroll_period_id));
  }
  if (
    typeof params.payroll_run_id === "number" &&
    Number.isFinite(params.payroll_run_id)
  ) {
    searchParams.set("payroll_run_id", String(params.payroll_run_id));
  }
  if (typeof params.year === "number" && Number.isFinite(params.year)) {
    searchParams.set("year", String(params.year));
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }
  const startDate = (params as Record<string, unknown>).start_date;
  if (typeof startDate === "string" && startDate.trim()) {
    searchParams.set("start_date", startDate.trim());
  }
  const endDate = (params as Record<string, unknown>).end_date;
  if (typeof endDate === "string" && endDate.trim()) {
    searchParams.set("end_date", endDate.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function listPayrollCollection(
  path: string,
  token: string,
  params: PayrollListParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const payload = await adminRequest<unknown>(
    `${path}${buildPayrollQuery(params)}`,
    {
      token,
    },
  );
  const rows = normalizeList(payload);
  const pagination = extractUsersPagination(
    payload,
    fallbackPage,
    fallbackLimit,
  );
  return { rows, ...pagination };
}

export async function getPayrollDashboard(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/reports/dashboard",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function calculatePayrollFinalSettlement(
  token: string,
  offboardingRequestId: string | number,
) {
  return adminRequest<unknown>(
    `/api/payroll/reports/final-settlements/${offboardingRequestId}/calculate`,
    {
      method: "POST",
      token,
    },
  );
}

export async function payrollFinalSettlementAction(
  token: string,
  settlementId: string | number,
  action: "submit" | "decision" | "simulate-payment" | "reconcile" | "close",
  body?: Record<string, unknown>,
) {
  return adminRequest<unknown>(
    `/api/payroll/reports/final-settlements/${settlementId}/${action}`,
    { method: "POST", token, body },
  );
}

export async function downloadPayrollFinalSettlementStatement(
  token: string,
  settlementId: string | number,
) {
  const response = await fetch(
    buildUrl(
      `/api/payroll/reports/final-settlements/${settlementId}/statement`,
    ),
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = { message: text };
    }
    throw new Error(extractMessage(payload, response.status));
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename =
    disposition.match(/filename="?([^";]+)"?/i)?.[1] ??
    `DEMO-SETTLEMENT-${settlementId}.pdf`;
  return { blob: await response.blob(), filename };
}

export async function runPayrollReconciliation(token: string) {
  return adminRequest<unknown>("/api/payroll/reports/reconciliation/run", {
    method: "POST",
    token,
  });
}

export async function runPayrollRunVariance(
  token: string,
  runId: string | number,
  comparisonRunId: string | number,
) {
  return adminRequest<unknown>(
    `/api/payroll/reports/runs/${runId}/variance?comparison_run_id=${encodeURIComponent(String(comparisonRunId))}`,
    { method: "POST", token },
  );
}

export async function listPayrollRuns(
  token: string,
  params: PayrollListParams = {},
) {
  return listPayrollCollection("/api/payroll/runs", token, params);
}

export async function getPayrollRun(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/payroll/runs/${id}`, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createPayrollRun(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/runs", {
    method: "POST",
    token,
    body: data,
  });
}

export async function processPayrollRun(
  token: string,
  id: string | number,
  data?: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/runs/${id}/process`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function approvePayrollRun(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/runs/${id}/approve`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function lockPayrollRun(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/payroll/runs/${id}/lock`, {
    method: "POST",
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function validatePayrollRun(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/payroll/runs/${id}/validation`, {
    token,
  });
}

export async function markPayrollRunPaid(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/runs/${id}/mark-paid`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function closePayrollRun(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/payroll/runs/${id}/close`, {
    method: "POST",
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPayrollInputs(
  token: string,
  params: PayrollListParams = {},
) {
  return listPayrollCollection("/api/payroll/inputs", token, params);
}

export async function createPayrollInput(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/inputs", {
    method: "POST",
    token,
    body: data,
  });
}

export async function createPayrollAdjustment(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/inputs/adjustments", {
    method: "POST",
    token,
    body: data,
  });
}

export async function approvePayrollInput(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/inputs/${id}/approve`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPayrollSources(
  token: string,
  params: PayrollListParams = {},
) {
  return listPayrollCollection("/api/payroll/sources", token, params);
}

export async function createPayrollSource(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/sources", {
    method: "POST",
    token,
    body: data,
  });
}

export async function createPayrollSourcesBatch(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/sources/batch", {
    method: "POST",
    token,
    body: data,
  });
}

export async function generatePayrollSources(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/sources/generate", {
    method: "POST",
    token,
    body: data,
  });
}

export async function importPayrollSources(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/sources/import", {
    method: "POST",
    token,
    body: data,
  });
}

export async function approvePayrollSource(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/sources/${id}/approve`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function rejectPayrollSource(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/sources/${id}/reject`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function postPayrollSource(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/sources/${id}/post`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPayrollOvertimeApprovals(token: string) {
  return listPayrollCollection(
    "/api/payroll/overtime-requests/payroll",
    token,
    { page: 1, limit: 100 },
  );
}

export async function listMyOvertimeRequests(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/overtime-requests/me",
    { token },
  );
  return normalizeList(payload);
}

export async function createMyOvertimeRequest(
  token: string,
  data: { work_date: string; requested_minutes: number; reason: string },
) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/overtime-requests/me",
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerOvertimeRequests(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/overtime-requests/manager",
    { token },
  );
  return normalizeList(payload);
}

export async function listHrOvertimeRequests(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/overtime-requests/hr",
    { token },
  );
  return normalizeList(payload);
}

export async function decideOvertimeRequest(
  token: string,
  stage: "manager" | "hr",
  id: string | number,
  decision: "approve" | "reject",
  comments?: string,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/overtime-requests/${stage}/${id}/${decision}`,
    {
      method: "POST",
      token,
      body: comments ? { comments } : {},
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listEmployeePayrollProfiles(
  token: string,
  params: PayrollListParams = {},
) {
  return listPayrollCollection(
    "/api/payroll/employees/profiles",
    token,
    params,
  );
}

export async function upsertEmployeePayrollProfile(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/employees/profiles", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollPeriods(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/periods",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function generatePayrollPeriod(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/configuration/periods/generate", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updatePayrollPeriodDates(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/periods/${id}/dates`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function getPayrollSecurityPolicy(token: string) {
  return adminRequest<unknown>("/api/payroll/configuration/security-policy", {
    token,
  });
}

export async function updatePayrollSecurityPolicy(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/security-policy", {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listPayrollComponents(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/components",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollComponent(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/configuration/components", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollCalendars(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/calendars",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollCalendar(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/configuration/calendars", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updatePayrollCalendar(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/payroll/configuration/calendars/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listPayrollSalaryStructures(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/salary-structures",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getPayrollSalaryStructure(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}`,
    {
      token,
    },
  );
  return unwrapRootRecord(payload, "components");
}

export async function createPayrollSalaryStructure(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/salary-structures", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updatePayrollSalaryStructure(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deletePayrollSalaryStructure(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function activatePayrollSalaryStructure(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export async function retirePayrollSalaryStructure(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}/retire`,
    {
      method: "POST",
      token,
    },
  );
}

export async function createPayrollSalaryStructureVersion(
  token: string,
  id: string | number,
  data: { effective_from: string; name?: string },
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}/versions`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPayrollSalaryStructureEmployees(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/configuration/salary-structures/${id}/employees`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeePayrollSalary(
  token: string,
  employeeId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/employees/${employeeId}/salary`,
    {
      token,
    },
  );
  return unwrapRootRecord(payload, "employee");
}

export async function assignEmployeePayrollSalary(
  token: string,
  employeeId: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/employees/${employeeId}/salary`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return unwrapRootRecord(payload, "employee");
}

export async function approveEmployeePayrollSalary(
  token: string,
  employeeId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/employees/${employeeId}/salary/approve`,
    { method: "POST", token },
  );
  return unwrapRootRecord(payload, "employee");
}

/**
 * For payloads whose root record holds nested objects, where normalizeSingle
 * would return a child record instead of the root.
 */
function unwrapRootRecord(
  payload: unknown,
  markerKey: string,
): AdminRecord | null {
  const record = asRecord(payload);
  if (!record) return null;
  const data = asRecord(record.data);
  return data && markerKey in data ? data : record;
}

export async function listPayrollStatutorySchemes(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/statutory-schemes",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollStatutoryScheme(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/statutory-schemes", {
    method: "POST",
    token,
    body: data,
  });
}

export async function createPayrollStatutoryRule(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/statutory-rules", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollStatutoryRules(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/statutory-rules",
    { token },
  );
  return normalizeList(payload);
}

export async function approvePayrollStatutoryRule(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/payroll/configuration/statutory-rules/${id}/approve`,
    { method: "POST", token },
  );
}

export async function listPayrollAccountingMappings(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/accounting-mappings",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollAccountingMapping(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    "/api/payroll/configuration/accounting-mappings",
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPayrollGroupAssignments(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/group-assignments",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollGroupAssignment(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/group-assignments", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollLeaveRules(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/leave-rules",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollLeaveRule(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/configuration/leave-rules", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollPayslipsForRun(
  token: string,
  runId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/payslips/runs/${runId}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function generatePayrollPayslipsForRun(
  token: string,
  runId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/payslips/runs/${runId}/generate`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function generatePayrollBankingBatch(
  token: string,
  runId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/banking/runs/${runId}/batches`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function generatePayrollBankReadyBatch(
  token: string,
  runId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/banking/runs/${runId}/batches/bank-ready`,
    { method: "POST", token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getPayrollPaymentHistory(
  token: string,
  runId: string | number,
) {
  return adminRequest<unknown>(`/api/payroll/banking/runs/${runId}/history`, {
    method: "GET",
    token,
  });
}

export async function simulatePayrollRunPayment(
  token: string,
  runId: string | number,
  outcome: "SUCCESS" | "PENDING" | "FAILED" = "SUCCESS",
  attempt = 1,
) {
  return adminRequest<unknown>(
    `/api/payroll/banking/runs/${runId}/simulate-payment`,
    {
      method: "POST",
      token,
      body: { outcome, attempt },
    },
  );
}

export async function downloadPayrollBankingBatch(
  token: string,
  batchId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(`/api/payroll/banking/batches/${batchId}/download`),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ??
    filenameMatch?.[2] ??
    `payroll-banking-batch-${batchId}`;

  return {
    blob,
    filename: decodeURIComponent(rawFilename),
    contentType: response.headers.get("content-type"),
  };
}

export async function generatePayrollAccountingJournals(
  token: string,
  runId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/accounting/runs/${runId}/journals`,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getPayrollInternalLedger(
  token: string,
  runId?: string | number,
) {
  const query = runId
    ? `?payroll_run_id=${encodeURIComponent(String(runId))}`
    : "";
  return adminRequest<unknown>(`/api/payroll/accounting/ledger${query}`, {
    method: "GET",
    token,
  });
}

export async function exportPayrollAccountingJournal(
  token: string,
  batchId: string | number,
  format = "csv",
) {
  const response = await fetch(
    buildUrl(
      `/api/payroll/accounting/journals/${batchId}/export?format=${encodeURIComponent(format)}`,
    ),
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to export journal (${response.status})`);
  }
  const payload = (await response.json()) as AdminRecord;
  const content = typeof payload.content === "string" ? payload.content : "";
  return {
    blob: new Blob([content], {
      type:
        typeof payload.mime_type === "string"
          ? payload.mime_type
          : "text/plain",
    }),
    filename:
      typeof payload.file_name === "string"
        ? payload.file_name
        : `payroll-journal-${batchId}.${format}`,
  };
}

export async function postPayrollAccountingJournal(
  token: string,
  batchId: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/accounting/journals/${batchId}/post`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function reversePayrollAccountingJournal(
  token: string,
  batchId: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/accounting/journals/${batchId}/reverse`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function reconcilePayrollPayment(
  token: string,
  runId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/payroll/banking/runs/${runId}/reconcile`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function importPayrollBankStatement(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/banking/imports", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollReportCatalog(token: string) {
  const payload = await adminRequest<unknown>("/api/payroll/reports/catalog", {
    token,
  });
  return normalizeList(payload);
}

export async function getPayrollIntegrationCatalog(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/reports/integrations/catalog",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getPayrollNotificationCatalog(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/reports/notifications/catalog",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getPayrollReadiness(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/reports/readiness",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getPayrollReport(
  token: string,
  code: string,
  params: PayrollListParams & { payroll_run_id?: number; year?: number } = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/payroll/reports/${encodeURIComponent(code)}${buildPayrollQuery(params)}`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getPayrollRunReconciliation(
  token: string,
  runId: string | number,
) {
  return getPayrollReport(token, "payroll-run-reconciliation", {
    payroll_run_id: Number(runId),
  });
}

export async function getMyPayrollSummary(token: string, year?: number) {
  const suffix = year ? `?year=${encodeURIComponent(String(year))}` : "";
  return adminRequest<unknown>(`/api/me/payslips/summary/current${suffix}`, {
    token,
  });
}

function buildStatusQuery(status?: string) {
  const value = status?.trim();
  return value ? `?status=${encodeURIComponent(value)}` : "";
}

export async function getPerformanceDashboard(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/dashboard/summary",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPerformanceFinancialYears(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/financial-years",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPerformanceFinancialYear(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/financial-years", {
    method: "POST",
    token,
    body: data,
  });
}

export async function generatePerformancePeriods(
  token: string,
  yearId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/financial-years/${yearId}/generate-periods`,
    { method: "POST", token },
  );
}

export async function calculatePerformanceAggregates(
  token: string,
  yearId: string | number,
  periodType: string,
) {
  return adminRequest<unknown>(
    `/api/performance/financial-years/${yearId}/aggregates`,
    {
      method: "POST",
      token,
      body: { period_type: periodType },
    },
  );
}

/**
 * HR catalogue: GET /api/performance/periods (Performance_listPeriods).
 * There is no GET /api/performance/me/periods. Employee pages must use
 * GET /api/performance/me/assignments and GET /api/performance/me/kpis.
 */
export async function listPerformancePeriods(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/periods", {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformancePeriod(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/periods", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updatePerformancePeriod(
  token: string,
  periodId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/performance/periods/${periodId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function activatePerformancePeriod(
  token: string,
  periodId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/periods/${periodId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export async function closePerformancePeriod(
  token: string,
  periodId: string | number,
) {
  return adminRequest<unknown>(`/api/performance/periods/${periodId}/close`, {
    method: "POST",
    token,
  });
}

export async function reopenPerformancePeriod(
  token: string,
  periodId: string | number,
  reason: string,
) {
  return adminRequest<unknown>(`/api/performance/periods/${periodId}/reopen`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function createPerformancePeriodAssignments(
  token: string,
  periodId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/periods/${periodId}/assignments`,
    {
      method: "POST",
      token,
    },
  );
}

export async function syncPerformanceSystemKpis(
  token: string,
  periodId: string | number,
  providerKey?: string,
) {
  return adminRequest<unknown>(
    `/api/performance/periods/${periodId}/sync-system-kpis`,
    {
      method: "POST",
      token,
      body: providerKey ? { provider_key: providerKey } : {},
    },
  );
}

export async function listPerformanceKpis(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/kpis", {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceKpi(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/performance/kpis", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updatePerformanceKpi(
  token: string,
  kpiId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/performance/kpis/${kpiId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deletePerformanceKpi(
  token: string,
  kpiId: string | number,
) {
  return adminRequest<unknown>(`/api/performance/kpis/${kpiId}`, {
    method: "DELETE",
    token,
  });
}

export async function createPerformanceKpiVersion(
  token: string,
  kpiId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/performance/kpis/${kpiId}/versions`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceKpiTemplates(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/kpi-templates",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPerformanceKpiTemplate(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/kpi-templates", {
    method: "POST",
    token,
    body: data,
  });
}

export async function applyPerformanceKpiTemplate(
  token: string,
  periodId: string,
  templateId: string,
  conflictPolicy: "MERGE" | "SKIP" | "REPLACE",
) {
  return adminRequest<unknown>(
    `/api/performance/periods/${periodId}/apply-kpi-template`,
    {
      method: "POST",
      token,
      body: {
        template_id: Number(templateId),
        conflict_policy: conflictPolicy,
      },
    },
  );
}

export async function listPerformanceKpiRules(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/kpi-rules", {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceKpiRule(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/kpi-rules", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceCompetencyTemplates(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/competency-templates",
    { token },
  );
  return normalizeList(payload);
}

export async function createPerformanceCompetencyTemplate(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/competency-templates", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceRatingScales(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/rating-scales",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPerformanceRatingScale(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/rating-scales", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceScorecards(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/scorecards", {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceScorecard(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/scorecards", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceWorkflows(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/workflows", {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceWorkflow(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/workflows", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getPerformanceReviewWorkflow(
  token: string,
  reviewId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/workflow`,
    { token },
  );
  return normalizeList(payload);
}

export async function actionPerformanceReviewWorkflow(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/workflow/action`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPayrollGroups(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/groups",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollGroup(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/payroll/configuration/groups", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollOvertimePolicies(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/overtime-policies",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollOvertimePolicy(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/overtime-policies", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollBonusSchemes(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/payroll/configuration/bonus-schemes",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollBonusScheme(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/payroll/configuration/bonus-schemes", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformancePlans(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/plans", {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformancePlan(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/performance/plans", {
    method: "POST",
    token,
    body: data,
  });
}

export async function generatePerformancePlanFromRules(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/plans/generate-from-rules", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceImprovementPlans(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/improvement-plans",
    { token },
  );
  return normalizeList(payload);
}

export async function listPerformanceDevelopmentPlans(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/development-plans",
    { token },
  );
  return normalizeList(payload);
}

export async function createPerformanceDevelopmentPlan(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/development-plans", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updatePerformanceDevelopmentGoal(
  token: string,
  goalId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/performance/development-goals/${goalId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function carryForwardPerformanceDevelopmentGoals(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    "/api/performance/development-plans/carry-forward",
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPerformanceReportCatalog(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/reports/catalog",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function downloadPerformanceReport(
  token: string,
  reportCode: string,
  format: "csv" | "xlsx" | "pdf" | "json",
) {
  const response = await fetch(
    buildUrl(`/api/performance/reports/${reportCode}/export?format=${format}`),
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(await response.text().catch(() => "Report export failed."));
  }
  return response.blob();
}

export async function getPerformanceCalibrationDepartments(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/calibration/departments",
    { token },
  );
  return normalizeList(payload);
}

export async function getPerformanceCalibrationComparison(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/calibration/comparison",
    { token },
  );
  return normalizeList(payload);
}

export async function createPerformanceImprovementPlan(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/improvement-plan`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function closePerformanceImprovementPlan(
  token: string,
  planId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/improvement-plans/${planId}/close`,
    { method: "POST", token },
  );
}

export async function reviewPerformanceImprovementMilestone(
  token: string,
  milestoneId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/improvement-milestones/${milestoneId}/review`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function moderatePerformanceReview(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/moderate`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function reopenPerformanceReview(
  token: string,
  reviewId: string | number,
  reason: string,
) {
  return adminRequest<unknown>(`/api/performance/reviews/${reviewId}/reopen`, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function approvePerformanceReview(
  token: string,
  periodAssignmentId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/reviews/${periodAssignmentId}/approve`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function invitePerformanceFeedback360(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/feedback-360/invitations`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPerformanceFeedback360(
  token: string,
  reviewId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/feedback-360`,
    { token },
  );
  return normalizeList(payload);
}

export async function getPerformanceFeedback360Summary(
  token: string,
  reviewId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/performance/reviews/${reviewId}/feedback-360/summary`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPerformanceAppeals(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/appeals", {
    token,
  });
  return normalizeList(payload);
}

export async function getMyPerformanceSummary(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/me/summary", {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

function buildEmployeeKpiQuery(params: AdminRecord = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function listMyEmployeeKpis(
  token: string,
  params: AdminRecord = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/performance/me/kpis${buildEmployeeKpiQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listKpiCycleReviews(
  token: string,
  mode: "self" | "manager",
  periodId?: string,
) {
  const payload = await adminRequest<unknown>(
    `/api/performance/${mode === "self" ? "me" : "manager"}/kpi-reviews${periodId ? `?period_id=${encodeURIComponent(periodId)}` : ""}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyKpiCycleScores(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/me/kpi-scores",
    { token },
  );
  return normalizeList(payload);
}

export async function submitKpiCycleRating(
  token: string,
  mode: "self" | "manager",
  kpiId: string,
  kind: "MID" | "FINAL",
  rating: number,
  comment: string,
) {
  return adminRequest<unknown>(
    `/api/performance/${mode === "self" ? "me" : "manager"}/kpis/${kpiId}/reviews/${kind}/${mode === "self" ? "self" : "manager"}`,
    { method: "POST", token, body: { rating, comment } },
  );
}

export async function respondToKpiMidReview(
  token: string,
  kpiId: string,
  decision: "ACKNOWLEDGE" | "DISPUTE",
  comment: string,
) {
  return adminRequest<unknown>(
    `/api/performance/me/kpis/${kpiId}/reviews/mid/respond`,
    { method: "POST", token, body: { decision, comment } },
  );
}

export async function finalizeKpiCycleReview(
  token: string,
  kpiId: string,
  comment: string,
) {
  return adminRequest<unknown>(
    `/api/performance/manager/kpis/${kpiId}/reviews/final/finalize`,
    { method: "POST", token, body: { comment } },
  );
}

export async function createMyEmployeeKpi(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/performance/me/kpis", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateMyEmployeeKpi(
  token: string,
  kpiId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/performance/me/kpis/${kpiId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteMyEmployeeKpi(
  token: string,
  kpiId: string | number,
) {
  return adminRequest<unknown>(`/api/performance/me/kpis/${kpiId}`, {
    method: "DELETE",
    token,
  });
}

export async function submitMyEmployeeKpis(
  token: string,
  periodId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/me/kpis/periods/${periodId}/submit`,
    { method: "POST", token },
  );
}

export async function updateMyEmployeeKpiActual(
  token: string,
  kpiId: string | number,
  actualValue: number,
) {
  return adminRequest<unknown>(`/api/performance/me/kpis/${kpiId}/actual`, {
    method: "PATCH",
    token,
    body: { actual_value: actualValue },
  });
}

export async function listManagerEmployeeKpis(
  token: string,
  params: AdminRecord = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/performance/manager/kpis${buildEmployeeKpiQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createManagerEmployeeKpi(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/performance/manager/kpis", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerKpiAssignees(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/manager/kpi-assignees",
    { token },
  );
  return normalizeList(payload);
}

export async function beginManagerEmployeeKpiReview(
  token: string,
  kpiId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/manager/kpis/${kpiId}/begin-review`,
    { method: "POST", token },
  );
}

export async function reviewManagerEmployeeKpi(
  token: string,
  kpiId: string | number,
  decision: "APPROVE" | "RETURN" | "REJECT",
  comment?: string,
) {
  return adminRequest<unknown>(
    `/api/performance/manager/kpis/${kpiId}/review`,
    {
      method: "POST",
      token,
      body: { decision, comment },
    },
  );
}

export async function listMyPerformanceAssignments(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/me/assignments",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listMyPerformanceAchievements(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/me/achievements",
    { token },
  );
  return normalizeList(payload);
}

export async function updateMyPerformanceAchievement(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/performance/me/achievements/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listMyPerformanceReviews(token: string) {
  const payload = await adminRequest<unknown>("/api/performance/me/reviews", {
    token,
  });
  return normalizeList(payload);
}

export async function listMyPerformanceFeedback360(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/me/feedback-360",
    { token },
  );
  return normalizeList(payload);
}

export async function submitMyPerformanceSelfReview(
  token: string,
  periodAssignmentId: string | number,
  review: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/me/reviews/${periodAssignmentId}/self-review`,
    {
      method: "POST",
      token,
      body: { review },
    },
  );
}

export async function submitMyPerformanceFeedback360(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/me/feedback-360/${requestId}/submit`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function declineMyPerformanceFeedback360(
  token: string,
  requestId: string | number,
  reason?: string,
) {
  return adminRequest<unknown>(
    `/api/performance/me/feedback-360/${requestId}/decline`,
    {
      method: "POST",
      token,
      body: { reason },
    },
  );
}

export async function submitMyPerformanceAppeal(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/me/reviews/${reviewId}/appeal`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listMyPerformanceImprovementPlans(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/me/improvement-plans",
    { token },
  );
  return normalizeList(payload);
}

export async function listMyPerformanceDevelopmentPlans(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/me/development-plans",
    { token },
  );
  return normalizeList(payload);
}

export async function updateMyPerformanceDevelopmentGoal(
  token: string,
  goalId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/me/development-goals/${goalId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function acknowledgeMyPerformanceImprovementPlan(
  token: string,
  planId: string | number,
) {
  return adminRequest<unknown>(
    `/api/performance/me/improvement-plans/${planId}/acknowledge`,
    { method: "POST", token },
  );
}

export async function getManagerPerformanceSummary(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/manager/summary",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerTeamAchievements(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/performance/manager/team-achievements",
    { token },
  );
  return normalizeList(payload);
}

export async function createManagerActivityTask(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/manager/activities/tasks", {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerActivityCategories(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/activities/categories",
    { token },
  );
  return normalizeList(payload);
}

export async function listMyActivityCategories(token: string) {
  const payload = await adminRequest<unknown>("/api/me/activities/categories", {
    token,
  });
  return normalizeList(payload);
}

export async function validateManagerAchievement(
  token: string,
  achievementId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/manager/achievements/${achievementId}/validate`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function submitManagerPerformanceReview(
  token: string,
  periodAssignmentId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/performance/manager/reviews/${periodAssignmentId}/submit`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function getProbationDashboard(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/probation/dashboard/summary",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listProbationPolicies(token: string, status?: string) {
  const payload = await adminRequest<unknown>(
    `/api/probation/policies${buildStatusQuery(status)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function createProbationPolicy(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/probation/policies", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateProbationPolicy(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/probation/policies/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteProbationPolicy(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/probation/policies/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function listProbationCases(token: string, status?: string) {
  const payload = await adminRequest<unknown>(
    `/api/probation/cases${buildStatusQuery(status)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyTeamProbationCases(token: string, status?: string) {
  const payload = await adminRequest<unknown>(
    `/api/probation/cases/my-team${buildStatusQuery(status)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getProbationCase(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/probation/cases/${id}`, {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function deleteProbationCase(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/probation/cases/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createProbationCase(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/probation/cases", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateProbationCase(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/probation/cases/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function createProbationObjective(
  token: string,
  caseId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/probation/cases/${caseId}/objectives`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function submitProbationManagerReview(
  token: string,
  caseId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/probation/cases/${caseId}/manager-review`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function submitProbationHrDecision(
  token: string,
  caseId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/probation/cases/${caseId}/hr-decision`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function generateProbationLetter(
  token: string,
  caseId: string | number,
  letterType = "CONFIRMATION",
) {
  return adminRequest<unknown>(
    `/api/probation/cases/${caseId}/generate-letter`,
    {
      method: "POST",
      token,
      body: { letter_type: letterType },
    },
  );
}

export async function generateEmployeeMovementLetter(
  token: string,
  movementId: string | number,
  letterType: string,
) {
  return adminRequest<unknown>(
    `/api/employee-movements/${movementId}/generate-letter`,
    {
      method: "POST",
      token,
      body: { letter_type: letterType },
    },
  );
}

export async function getMyProbation(token: string, signal?: AbortSignal) {
  const payload = await adminRequest<unknown>("/api/me/probation", {
    token,
    signal,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function submitMyProbationSelfAssessment(
  token: string,
  caseId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/probation/${caseId}/self-assessment`, {
    method: "POST",
    token,
    body: data,
  });
}

function buildRecordQuery(
  params: Record<string, string | number | boolean | undefined>,
) {
  const search = new URLSearchParams();
  const sortBy = normalizeSortBy(
    typeof params.sortBy === "string" ? params.sortBy : undefined,
  );
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    if (key === "sortBy" && !sortBy) continue;
    if (key === "sortOrder" && !sortBy) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listFieldParties(token: string) {
  const payload = await adminRequest<unknown>("/api/field-parties", { token });
  return normalizeList(payload);
}

export async function createFieldParty(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/field-parties", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateFieldParty(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/field-parties/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listHrFieldVisits(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/field-visits${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

// The backend requires a purpose for every location-map view (it is written to the access log).
export async function getHrFieldVisitsMap(
  token: string,
  purpose = "HR field visit oversight",
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/field-visits/map${buildRecordQuery({ purpose })}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listHrFieldLocationAccessLogs(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/hr/field-locations/access-logs",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listHrActivities(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/activities${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listHrActivityDepartmentSummary(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return adminRequest<unknown>(
    `/api/hr/activities/department-summary${buildRecordQuery(params)}`,
    { token },
  );
}

export async function listHrPendingActivityReports(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return adminRequest<unknown>(
    `/api/hr/activities/pending-reports${buildRecordQuery(params)}`,
    { token },
  );
}

export async function getHrPlannedCompletedActivities(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return adminRequest<unknown>(
    `/api/hr/activities/planned-completed${buildRecordQuery(params)}`,
    { token },
  );
}

export async function downloadHrPlannedCompletedActivities(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const response = await fetch(
    buildUrl(`/api/hr/activities/planned-completed/export.csv${buildRecordQuery(params)}`),
    { headers: { accept: "text/csv", Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Export failed with status ${response.status}`);
  }
  return response.blob();
}

export async function downloadHrActivityReportExport(
  token: string,
  kind: "department-summary" | "pending-reports",
  params: Record<string, string | number | undefined> = {},
) {
  const response = await fetch(
    buildUrl(`/api/hr/activities/${kind}/export.csv${buildRecordQuery(params)}`),
    { headers: { accept: "text/csv", Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Export failed with status ${response.status}`);
  }
  return response.blob();
}

export async function listHrActivityCategories(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/hr/activity-categories",
    { token },
  );
  return normalizeList(payload);
}

export async function listHrActivityExceptions(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/activity-exceptions${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listActivityCategories(token: string) {
  const payload = await adminRequest<unknown>("/api/activity-categories", {
    token,
  });
  return normalizeList(payload);
}

export async function createActivityCategory(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/activity-categories", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateActivityCategory(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/activity-categories/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deactivateActivityCategory(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/activity-categories/${id}/deactivate`, {
    method: "POST",
    token,
  });
}

export async function listActivityPolicies(token: string) {
  const payload = await adminRequest<unknown>("/api/activity-policies", {
    token,
  });
  return normalizeList(payload);
}

export async function createActivityPolicy(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/activity-policies", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateActivityPolicy(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/activity-policies/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function getManagerFieldVisitDashboard(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/field-visits/dashboard",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getManagerFieldVisitCommercialPolicy(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/field-visits/commercial-policy",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function saveManagerFieldVisitCommercialPolicy(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/manager/field-visits/commercial-policy", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateManagerFieldOpportunityCommercial(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/manager/field-visits/opportunities/${id}/commercial`,
    { method: "POST", token, body: data },
  );
}

export async function getManagerFieldVisitCommercialSummary(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/field-visits/commercial-summary${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerFieldVisits(token: string) {
  const payload = await adminRequest<unknown>("/api/manager/field-visits", {
    token,
  });
  return normalizeList(payload);
}

export async function getManagerFieldVisit(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/manager/field-visits/${id}`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function reviewManagerFieldVisit(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/manager/field-visits/${id}/review`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerFieldVisitPlans(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/field-visits/plans",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function reviewManagerFieldVisitPlan(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/manager/field-visits/plans/${id}/review`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getManagerFieldVisitMap(
  token: string,
  purpose = "Manager team field visit review",
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/field-visits/map/view${buildRecordQuery({ purpose })}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getManagerFieldVisitExceptions(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/field-visits/exceptions/summary",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerFieldFollowUps(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/field-visits/follow-ups",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listMyFieldVisits(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/field-visits${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getMyFieldVisitCommercialPolicy(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/me/field-visits/commercial-policy",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getMyFieldVisit(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/field-visits/${id}`, {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyFieldVisitPlans(token: string) {
  const payload = await adminRequest<unknown>("/api/me/field-visits/plans", {
    token,
  });
  return normalizeList(payload);
}

export async function createMyFieldVisitPlan(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/field-visits/plans", {
    method: "POST",
    token,
    body: data,
  });
}

export async function submitMyFieldVisitPlan(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(`/api/me/field-visits/plans/${id}/submit`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createMyUnplannedFieldVisit(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/field-visits/unplanned", {
    method: "POST",
    token,
    body: data,
  });
}

export async function checkInMyFieldVisit(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/field-visits/${id}/check-in`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function checkOutMyFieldVisit(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/field-visits/${id}/check-out`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function addMyFieldVisitExpense(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/field-visits/${id}/expenses`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function addMyFieldVisitOpportunity(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/field-visits/${id}/opportunities`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listMyFieldFollowUps(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/field-visits/follow-ups/list${buildRecordQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function completeMyFieldFollowUp(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/me/field-visits/follow-ups/${id}/complete`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function createMyFieldFollowUp(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/field-visits/follow-ups", {
    method: "POST",
    token,
    body: data,
  });
}

export async function updateMyFieldFollowUp(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/field-visits/follow-ups/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function cancelMyFieldFollowUp(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/field-visits/follow-ups/${id}`, {
    method: "DELETE",
    token,
  });
}

export const listMyFieldVisitFollowUps = listMyFieldFollowUps;
export const completeMyFieldVisitFollowUp = completeMyFieldFollowUp;

export async function syncMyFieldWork(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/field-sync", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyFieldSync(
  token: string,
  syncRequestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/field-sync/${syncRequestId}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncMyFieldVisits(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/field-visits/sync", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyFieldVisitSync(
  token: string,
  syncRequestId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/field-visits/sync/${syncRequestId}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function addMyFieldVisitEvidence(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/field-visits/${id}/evidence`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerFieldPlannedVsActual(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/field-visits/planned-vs-actual${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceDashboard(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/reports/dashboard",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getEmployeeFinanceReport(
  token: string,
  reportType: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/reports/${encodeURIComponent(reportType)}${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listEmployeeFinanceAuditTimeline(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/reports/audit${buildRecordQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listEmployeeFinanceProducts(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/products",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createEmployeeFinanceProduct(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/employee-finance/products", {
    method: "POST",
    token,
    body: data,
  });
}

export async function evaluateEmployeeFinanceEligibility(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/employee-finance/products/eligibility", {
    method: "POST",
    token,
    body: data,
  });
}

export async function evaluateMyFinanceEligibility(
  token: string,
  data: AdminRecord,
) {
  const payload = await adminRequest<unknown>("/api/me/finance/eligibility", {
    method: "POST",
    token,
    body: data,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listEmployeeFinanceApplications(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/applications${buildRecordQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceApplication(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/applications/${id}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function approveEmployeeFinanceApplication(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/applications/${id}/approve`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function approveHrEmployeeFinanceApplication(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(`/api/hr/finance/applications/${id}/approve`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function recommendEmployeeFinanceApplication(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/manager/finance/applications/${id}/recommend`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listEmployeeFinanceAccounts(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/finance/employee-finance/accounts${buildRecordQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceAccountStatement(
  token: string,
  accountId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/finance/employee-finance/accounts/${accountId}/statement`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function createEmployeeFinanceDisbursement(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/finance/employee-finance/disbursements", {
    method: "POST",
    token,
    body: data,
  });
}

export async function approveEmployeeFinanceDisbursement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/disbursements/${id}/approve`,
    { method: "POST", token },
  );
}

export async function confirmEmployeeFinanceDisbursement(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/disbursements/${id}/confirm`,
    { method: "POST", token },
  );
}

export async function createEmployeeFinanceRepayment(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/finance/employee-finance/repayments", {
    method: "POST",
    token,
    body: data,
  });
}

export async function approveEmployeeFinanceRepayment(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/repayments/${id}/approve`,
    { method: "POST", token },
  );
}

export async function requestEmployeeFinanceDeferment(
  token: string,
  accountId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/accounts/${accountId}/deferments`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function requestEmployeeFinanceReschedule(
  token: string,
  accountId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/accounts/${accountId}/reschedules`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function createEmployeeFinanceSettlementQuote(
  token: string,
  accountId: string | number,
) {
  return adminRequest<unknown>(
    `/api/finance/employee-finance/accounts/${accountId}/settlement-quotes`,
    {
      method: "POST",
      token,
    },
  );
}

export async function runEmployeeFinanceReconciliation(token: string) {
  return adminRequest<unknown>("/api/employee-finance/reconciliation/run", {
    method: "POST",
    token,
  });
}

export async function listEmployeeFinanceApplicationDocuments(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/applications/${applicationId}/documents`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function verifyEmployeeFinanceApplicationDocument(
  token: string,
  applicationId: string | number,
  documentId: string | number,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    `/api/employee-finance/applications/${applicationId}/documents/${documentId}/verify`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listEmployeeFinanceApplicationGuarantors(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/applications/${applicationId}/guarantors`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceSanctionLetter(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/applications/${applicationId}/sanction-letter`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyFinanceApplications(token: string) {
  const payload = await adminRequest<unknown>("/api/me/finance/applications", {
    token,
  });
  return normalizeList(payload);
}

export async function createMyFinanceApplication(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/me/finance/applications", {
    method: "POST",
    token,
    body: data,
  });
}

export async function addMyFinanceApplicationDocument(
  token: string,
  applicationId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/finance/applications/${applicationId}/documents`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function uploadMyFinanceApplicationDocument(
  token: string,
  applicationId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/finance/applications/${applicationId}/documents/upload`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function importEmployeeFinancePayments(
  token: string,
  file: File,
  options: { dryRun?: boolean } = {},
) {
  return adminRequest<unknown>(
    "/api/finance/employee-finance/payments/import",
    {
      method: "POST",
      token,
      body: {
        file: await fileToBase64UploadDto(file),
        dry_run: options.dryRun ?? true,
      },
    },
  );
}

export async function postEmployeeFinanceAccounting(
  token: string,
  data: AdminRecord = {},
) {
  return adminRequest<unknown>(
    "/api/finance/employee-finance/accounting/post",
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listEmployeeFinanceReportCatalog(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/reports/catalog",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listEmployeeFinanceNotificationCatalog(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/reports/notifications/catalog",
    { token },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceReadiness(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/reports/readiness",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyFinanceApplicationDocuments(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/finance/applications/${applicationId}/documents`,
    { token },
  );
  return normalizeList(payload);
}

export async function addMyFinanceApplicationGuarantor(
  token: string,
  applicationId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/finance/applications/${applicationId}/guarantors`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listMyFinanceApplicationGuarantors(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/finance/applications/${applicationId}/guarantors`,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyFinanceGuarantorRequests(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/me/finance/guarantor-requests",
    { token },
  );
  return normalizeList(payload);
}

export async function decideMyFinanceGuarantorRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/finance/guarantor-requests/${id}/decide`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function submitMyFinanceApplication(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/finance/applications/${id}/submit`, {
    method: "POST",
    token,
  });
}

export async function acceptMyFinanceApplication(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/finance/applications/${id}/accept`, {
    method: "POST",
    token,
  });
}

export async function withdrawMyFinanceApplication(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/me/finance/applications/${id}/withdraw`, {
    method: "POST",
    token,
  });
}

export async function getMyFinanceAccountStatement(
  token: string,
  accountId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/me/finance/accounts/${accountId}/statement`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

// --- Staff loans: product lifecycle, approvals, servicing, payroll ops ---

function financePost(path: string, token: string, body: AdminRecord = {}) {
  return adminRequest<unknown>(path, { method: "POST", token, body });
}

export async function updateEmployeeFinanceProduct(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/employee-finance/products/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function createEmployeeFinanceProductVersion(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/employee-finance/products/${id}/versions`,
    token,
    data,
  );
}

export async function retireEmployeeFinanceProduct(
  token: string,
  id: string | number,
) {
  return financePost(`/api/employee-finance/products/${id}/retire`, token);
}

export async function listMyFinanceProducts(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/me/finance/products", { token }),
  );
}

export async function listMyFinanceAccounts(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/me/finance/accounts", { token }),
  );
}

export async function updateMyFinanceApplication(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/finance/applications/${id}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function requestMyFinanceDeferment(
  token: string,
  accountId: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/me/finance/accounts/${accountId}/deferments`,
    token,
    data,
  );
}

export async function downloadMyFinanceSanctionLetter(
  token: string,
  applicationId: string | number,
) {
  return downloadAdminBlob(
    `/api/me/finance/applications/${applicationId}/sanction-letter/pdf`,
    token,
    `sanction-letter-${applicationId}.pdf`,
  );
}

export async function downloadEmployeeFinanceSanctionLetter(
  token: string,
  applicationId: string | number,
) {
  return downloadAdminBlob(
    `/api/employee-finance/applications/${applicationId}/sanction-letter/pdf`,
    token,
    `sanction-letter-${applicationId}.pdf`,
  );
}

export async function getEmployeeFinanceApprovalHistory(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/applications/${applicationId}/approvals`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function decideEmployeeFinanceApplication(
  token: string,
  applicationId: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/employee-finance/applications/${applicationId}/decision`,
    token,
    data,
  );
}

export async function delegatedEmployeeFinanceDecision(
  token: string,
  applicationId: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/employee-finance/applications/${applicationId}/delegated-decision`,
    token,
    data,
  );
}

export async function approveManagementEmployeeFinanceApplication(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return financePost(
    `/api/management/finance/applications/${id}/approve`,
    token,
    data,
  );
}

export async function listEmployeeFinanceDelegations(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/employee-finance/delegations", { token }),
  );
}

export async function createEmployeeFinanceDelegation(
  token: string,
  data: AdminRecord,
) {
  return financePost("/api/employee-finance/delegations", token, data);
}

export async function revokeEmployeeFinanceDelegation(
  token: string,
  id: string | number,
) {
  return financePost(`/api/employee-finance/delegations/${id}/revoke`, token);
}

export async function getEmployeeFinanceSanctionTemplate(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/templates/sanction-letter",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function saveEmployeeFinanceSanctionTemplate(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    "/api/employee-finance/templates/sanction-letter",
    {
      method: "PUT",
      token,
      body: data,
    },
  );
}

export async function previewEmployeeFinanceSanctionTemplate(
  token: string,
  body: string,
) {
  const payload = await financePost(
    "/api/employee-finance/templates/sanction-letter/preview",
    token,
    { body },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function cancelEmployeeFinanceDisbursement(
  token: string,
  id: string | number,
  reason?: string,
) {
  return financePost(
    `/api/finance/employee-finance/disbursements/${id}/cancel`,
    token,
    { reason },
  );
}

export async function listPendingEmployeeFinanceDeferments(token: string) {
  return normalizeList(
    await adminRequest<unknown>(
      "/api/finance/employee-finance/deferments/pending",
      { token },
    ),
  );
}

export async function decideEmployeeFinanceDeferment(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/finance/employee-finance/deferments/${id}/decide`,
    token,
    data,
  );
}

export async function listPendingEmployeeFinanceReschedules(token: string) {
  return normalizeList(
    await adminRequest<unknown>(
      "/api/finance/employee-finance/reschedules/pending",
      { token },
    ),
  );
}

export async function decideEmployeeFinanceReschedule(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/finance/employee-finance/reschedules/${id}/decide`,
    token,
    data,
  );
}

export async function settleEmployeeFinanceQuote(
  token: string,
  quoteId: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/finance/employee-finance/settlement-quotes/${quoteId}/settle`,
    token,
    data,
  );
}

export async function listEmployeeFinanceExitRecoveries(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/finance/employee-finance/exit-recoveries${buildRecordQuery(params)}`,
      { token },
    ),
  );
}

export async function confirmEmployeeFinanceExitRecovery(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/finance/employee-finance/exit-recoveries/${id}/confirm`,
    token,
    data,
  );
}

export async function listEmployeeFinanceAdjustments(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/finance/employee-finance/adjustments${buildRecordQuery(params)}`,
      { token },
    ),
  );
}

export async function requestEmployeeFinanceAdjustment(
  token: string,
  accountId: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/finance/employee-finance/accounts/${accountId}/adjustments`,
    token,
    data,
  );
}

export async function decideEmployeeFinanceAdjustment(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/finance/employee-finance/adjustments/${id}/decide`,
    token,
    data,
  );
}

export async function runEmployeeFinanceOverdueSweep(token: string) {
  return financePost("/api/finance/employee-finance/overdue/run", token);
}

export async function runEmployeeFinanceEscalationSweep(token: string) {
  return financePost(
    "/api/finance/employee-finance/approvals/escalation-sweep",
    token,
  );
}

export async function backfillEmployeeFinanceInterest(
  token: string,
  dryRun: boolean,
) {
  return financePost(
    `/api/employee-finance/reconciliation/backfill-interest?dry_run=${dryRun ? "true" : "false"}`,
    token,
  );
}

export async function getEmployeeFinancePayrollPreview(
  token: string,
  payrollPeriodId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/payroll/preview?payroll_period_id=${payrollPeriodId}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getEmployeeFinancePayrollRunDeductions(
  token: string,
  payrollRunId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/payroll/runs/${payrollRunId}/deductions`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listEmployeeFinancePayrollShortfalls(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/employee-finance/payroll/shortfalls${buildRecordQuery(params)}`,
      { token },
    ),
  );
}

async function postAdminBlob(
  path: string,
  token: string,
  body: AdminRecord,
  fallbackName: string,
) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      accept: "*/*",
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = { message: text };
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      // keep text payload
    }
    throw new Error(extractMessage(payload, response.status));
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  return {
    blob: await response.blob(),
    filename: match?.[1] ? decodeURIComponent(match[1]) : fallbackName,
    contentType: response.headers.get("content-type"),
  };
}

export async function listEmployeeFinanceLoanReportCatalog(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/employee-finance/loan-reports", {
      token,
    }),
  );
}

export async function getEmployeeFinanceLoanReport(
  token: string,
  reportType: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/loan-reports/${encodeURIComponent(reportType)}${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function exportEmployeeFinanceReport(
  token: string,
  reportType: string,
  format: "xlsx" | "csv",
  params: Record<string, string | number | undefined> = {},
) {
  return downloadAdminBlob(
    `/api/employee-finance/loan-reports/${encodeURIComponent(reportType)}/export${buildRecordQuery({ ...params, format })}`,
    token,
    `loan-${reportType}.${format}`,
  );
}

export async function downloadEmployeeFinanceStatement(
  token: string,
  accountId: string | number,
  format: "pdf" | "xlsx",
) {
  return downloadAdminBlob(
    `/api/finance/employee-finance/accounts/${accountId}/statement/download?format=${format}`,
    token,
    `loan-statement-${accountId}.${format}`,
  );
}

export async function downloadMyFinanceStatement(
  token: string,
  accountId: string | number,
  format: "pdf" | "xlsx",
) {
  return downloadAdminBlob(
    `/api/me/finance/accounts/${accountId}/statement/download?format=${format}`,
    token,
    `loan-statement-${accountId}.${format}`,
  );
}

export async function getEmployeeFinanceIntegrationSettings(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/employee-finance/integrations/settings",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function saveEmployeeFinanceIntegrationSettings(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/employee-finance/integrations/settings", {
    method: "PUT",
    token,
    body: data,
  });
}

export async function testEmployeeFinanceIntegration(
  token: string,
  channel: "erp" | "bank",
) {
  return financePost(
    `/api/employee-finance/integrations/test/${channel}`,
    token,
  );
}

export async function listEmployeeFinanceIntegrationLogs(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return normalizeList(
    await adminRequest<unknown>(
      `/api/employee-finance/integrations/logs${buildRecordQuery(params)}`,
      { token },
    ),
  );
}

export async function retryEmployeeFinanceIntegration(
  token: string,
  logId: string | number,
) {
  return financePost(
    `/api/employee-finance/integrations/logs/${logId}/retry`,
    token,
  );
}

export async function previewEmployeeFinanceJournal(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/employee-finance/integrations/journal/preview${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function exportEmployeeFinanceJournal(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return downloadAdminBlob(
    `/api/employee-finance/integrations/journal/export${buildRecordQuery(params)}`,
    token,
    "loan-journal.xlsx",
  );
}

export async function postEmployeeFinanceJournal(
  token: string,
  data: AdminRecord = {},
) {
  return financePost(
    "/api/employee-finance/integrations/journal/post",
    token,
    data,
  );
}

export async function downloadEmployeeFinancePaymentFile(
  token: string,
  disbursementIds?: number[],
) {
  return postAdminBlob(
    "/api/employee-finance/integrations/bank/payment-file",
    token,
    { disbursement_ids: disbursementIds },
    "loan-payments.csv",
  );
}

export async function submitEmployeeFinancePayments(
  token: string,
  disbursementIds?: number[],
) {
  return financePost(
    "/api/employee-finance/integrations/bank/submit-payments",
    token,
    {
      disbursement_ids: disbursementIds,
    },
  );
}

export async function importEmployeeFinanceBankStatement(
  token: string,
  file: File,
  dryRun: boolean,
) {
  return financePost(
    "/api/employee-finance/integrations/bank/statement-import",
    token,
    {
      file: await fileToBase64UploadDto(file),
      dry_run: dryRun,
    },
  );
}

export async function downloadEmployeeFinanceMigrationTemplate(token: string) {
  return downloadAdminBlob(
    "/api/employee-finance/migration/template",
    token,
    "staff-loan-migration-template.xlsx",
  );
}

export async function importEmployeeFinanceMigration(
  token: string,
  file: File,
  options: { dryRun: boolean; cutoverDate?: string },
) {
  const payload = await financePost(
    "/api/employee-finance/migration/import",
    token,
    {
      file: await fileToBase64UploadDto(file),
      dry_run: options.dryRun,
      cutover_date: options.cutoverDate || undefined,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listEmployeeFinanceMigrationBatches(token: string) {
  return normalizeList(
    await adminRequest<unknown>("/api/employee-finance/migration/batches", {
      token,
    }),
  );
}

export async function signOffEmployeeFinanceMigration(
  token: string,
  batchId: string,
  comments?: string,
) {
  return financePost(
    `/api/employee-finance/migration/batches/${encodeURIComponent(batchId)}/sign-off`,
    token,
    { comments },
  );
}

export async function resolveEmployeeFinancePayrollShortfall(
  token: string,
  instructionId: string | number,
  data: AdminRecord,
) {
  return financePost(
    `/api/employee-finance/payroll/shortfalls/${instructionId}/resolve`,
    token,
    data,
  );
}

function normalizeActivityReport(payload: unknown) {
  const direct = asRecord(payload);
  if (
    direct &&
    ("activityDate" in direct ||
      "activity_date" in direct ||
      "employeeId" in direct ||
      "employee_id" in direct)
  ) {
    return direct;
  }

  return normalizeSingle(payload) ?? direct;
}

export async function listMyActivities(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/activities${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getMyActivitiesToday(token: string) {
  const payload = await adminRequest<unknown>("/api/me/activities/today", {
    token,
  });
  return normalizeActivityReport(payload);
}

export async function listMyActivityTasks(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/me/activities/tasks${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function createMyActivityTask(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/activities/tasks", {
    method: "POST",
    token,
    body: data,
  });
}

export async function addMyActivityComment(
  token: string,
  entryId: string | number,
  body: string,
) {
  return adminRequest<unknown>(
    `/api/me/activities/entries/${entryId}/comments`,
    {
      method: "POST",
      token,
      body: { body },
    },
  );
}

export async function createMyActivityReport(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/activities/reports", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyActivityReport(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/me/activities/reports/${id}`,
    { token },
  );
  return normalizeActivityReport(payload);
}

export async function addMyActivityEntry(
  token: string,
  reportId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/activities/reports/${reportId}/entries`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function updateMyActivityEntry(
  token: string,
  reportId: string | number,
  entryId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/activities/reports/${reportId}/entries/${entryId}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function deleteMyActivityEntry(
  token: string,
  reportId: string | number,
  entryId: string | number,
) {
  return adminRequest<unknown>(
    `/api/me/activities/reports/${reportId}/entries/${entryId}`,
    { method: "DELETE", token },
  );
}

export async function addMyActivityEvidence(
  token: string,
  entryId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/activities/entries/${entryId}/evidence`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function submitMyActivityReport(
  token: string,
  reportId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/me/activities/reports/${reportId}/submit`,
    { method: "POST", token, body: data },
  );
}

export async function getManagerActivitiesDashboard(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/activities/dashboard${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerPendingActivityReviews(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/activities/pending-reviews${buildRecordQuery(params)}`,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listManagerTeamActivities(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/activities/team${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listManagerActivityTasks(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/activities/tasks${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listManagerActivityAssignees(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/manager/activities/assignees",
    { token },
  );
  return normalizeList(payload);
}

export async function addManagerActivityComment(
  token: string,
  entryId: string | number,
  body: string,
) {
  return adminRequest<unknown>(
    `/api/manager/activities/entries/${entryId}/comments`,
    {
      method: "POST",
      token,
      body: { body },
    },
  );
}

export async function updateManagerActivitySchedule(
  token: string,
  entryId: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/manager/activities/entries/${entryId}/schedule`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function getManagerActivityReport(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/activities/reports/${id}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function reviewManagerActivityReport(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/manager/activities/reports/${id}/review`, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getManagerDashboard(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  return getHrDashboard(token, "manager", params);
}

export async function listManagerActionItems(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/action-items${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function listManagerTeam(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/team${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getManagerTeamMember(
  token: string,
  employeeId: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/team/${employeeId}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerTeamAttendance(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/manager/team/attendance${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getSmsGlobalSetting(token: string) {
  const payload = await adminRequest<unknown>("/api/sms/global", { token });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updateSmsGlobalSetting(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/sms/global", {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listSmsLogs(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/sms/logs${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function retrySmsLog(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/sms/logs/${id}/retry`, {
    method: "POST",
    token,
  });
}

export async function listSmsRegistry(token: string) {
  const payload = await adminRequest<unknown>("/api/sms/registry", { token });
  return normalizeList(payload);
}

export async function getSmsRegistryItem(token: string, code: string) {
  const payload = await adminRequest<unknown>(
    `/api/sms/registry/${encodeURIComponent(code)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updateSmsRegistryItem(
  token: string,
  code: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/sms/registry/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function sendTestSms(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/sms/test", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getPlatformSmsGlobalSetting(token: string) {
  const payload = await adminRequest<unknown>("/api/sms/platform/global", {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updatePlatformSmsGlobalSetting(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/sms/platform/global", {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listPlatformSmsLogs(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/sms/platform/logs${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function retryPlatformSmsLog(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/sms/platform/logs/${id}/retry`, {
    method: "POST",
    token,
  });
}

export async function listPlatformSmsRegistry(token: string) {
  const payload = await adminRequest<unknown>("/api/sms/platform/registry", {
    token,
  });
  return normalizeList(payload);
}

export async function getPlatformSmsRegistryItem(token: string, code: string) {
  const payload = await adminRequest<unknown>(
    `/api/sms/platform/registry/${encodeURIComponent(code)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updatePlatformSmsRegistryItem(
  token: string,
  code: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>(
    `/api/sms/platform/registry/${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export interface AnalyticsQueryParams {
  date_from?: string;
  date_to?: string;
  branch_id?: number;
  department_id?: number;
  employee_id?: number;
  purpose?: string;
}

export interface AnalyticsDashboardKindMap {
  hr: "hr";
  management: "management";
  manager: "manager";
  "sales-field": "sales-field";
}

export type AnalyticsDashboardKind = keyof AnalyticsDashboardKindMap;

export interface AnalyticsCustomReportPayload extends AnalyticsQueryParams {
  dataset_code: string;
  dimensions: string[];
  measures: string[];
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface AnalyticsExportPayload extends AnalyticsCustomReportPayload {
  output_format?: "CSV" | "XLSX" | "PDF" | "JSON";
  idempotency_key?: string;
}

export interface SaveAnalyticsReportPayload extends AnalyticsCustomReportPayload {
  name: string;
  description?: string;
  sorting?: Record<string, unknown>;
  grouping?: Record<string, unknown>;
  visibility?: "PRIVATE" | "DEPARTMENT" | "SHARED" | "ADMIN_ONLY";
  department_scope_id?: number | null;
}

export interface AnalyticsRefreshPayload extends AnalyticsQueryParams {
  dataset_code?: string;
  refresh_mode?: "INCREMENTAL" | "FULL_REFRESH" | "PERIOD_CLOSE" | "MANUAL";
}

export interface StatutoryReportRunPayload extends AnalyticsQueryParams {
  report_code: string;
}

function buildAnalyticsQuery(params: AnalyticsQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.date_from?.trim()) {
    searchParams.set("date_from", params.date_from.trim());
  }
  if (params.date_to?.trim()) {
    searchParams.set("date_to", params.date_to.trim());
  }
  if (
    typeof params.branch_id === "number" &&
    Number.isFinite(params.branch_id)
  ) {
    searchParams.set("branch_id", String(params.branch_id));
  }
  if (
    typeof params.department_id === "number" &&
    Number.isFinite(params.department_id)
  ) {
    searchParams.set("department_id", String(params.department_id));
  }
  if (
    typeof params.employee_id === "number" &&
    Number.isFinite(params.employee_id)
  ) {
    searchParams.set("employee_id", String(params.employee_id));
  }
  if (params.purpose?.trim()) {
    searchParams.set("purpose", params.purpose.trim());
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export type HrDashboardKind =
  "employee" | "hr" | "management" | "manager" | "sales-field";

function looksLikeRoleDashboardRecord(record: AdminRecord) {
  return [
    "generated_at",
    "generatedAt",
    "period",
    "team",
    "attendance",
    "approvals",
    "performance",
    "work_activities",
    "workActivities",
    "capabilities",
    "headcount",
    "workforce",
  ].some((key) => key in record);
}

/** Preserve nested dashboard sections instead of treating the first one as the response. */
function unwrapRoleDashboardPayload(payload: unknown) {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null || seen.has(current)) continue;
    seen.add(current);

    const record = asRecord(current);
    if (!record) continue;
    if (looksLikeRoleDashboardRecord(record)) return record;

    for (const key of ["data", "result", "payload", "dashboard", "item"]) {
      if (key in record) queue.push(record[key]);
    }
  }

  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHrDashboard(
  token: string,
  kind: HrDashboardKind,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/dashboards/${kind}${kind === "employee" ? "" : buildRecordQuery(params)}`,
    { token },
  );
  return unwrapRoleDashboardPayload(payload);
}

export async function getSystemHealth(token?: string) {
  const payload = await adminRequest<unknown>("/api/health", {
    token: token ?? "",
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getSystemHealthLive(token?: string) {
  const payload = await adminRequest<unknown>("/api/health/live", {
    token: token ?? "",
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getSystemHealthReady(token?: string) {
  const payload = await adminRequest<unknown>("/api/health/ready", {
    token: token ?? "",
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listSecurityEvents(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/security-events${buildRecordQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...params,
    })}`,
    { token },
  );
  return normalizeList(payload);
}

export async function getHrLaunchReadiness(token: string) {
  const payload = await adminRequest<unknown>("/api/hr/launch-readiness", {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHrLaunchReadinessEmployees(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/hr/launch-readiness/employees",
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHrAttendanceSetupStatus(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/hr/attendance/setup/status",
    {
      token,
    },
  );
  const root = asRecord(payload);
  const candidates = [asRecord(root?.data), asRecord(root?.result), root];

  for (const candidate of candidates) {
    if (
      candidate &&
      ("isComplete" in candidate ||
        "activePolicy" in candidate ||
        "missing" in candidate)
    ) {
      return candidate;
    }
  }

  return normalizeSingle(payload) ?? root;
}

export async function runHrAttendanceSetupWizard(
  token: string,
  data: AdminRecord,
) {
  return adminRequest<unknown>("/api/hr/attendance/setup/wizard", {
    method: "POST",
    token,
    body: data,
  });
}

export async function getHrAttendanceSchedulePreview(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/attendance/schedules/preview${buildRecordQuery(params)}`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getAnalyticsDashboard(
  token: string,
  kind: AnalyticsDashboardKind,
  params: AnalyticsQueryParams = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/analytics/dashboards/${kind}${buildAnalyticsQuery(params)}`,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listAnalyticsDatasets(token: string) {
  const payload = await adminRequest<unknown>("/api/analytics/datasets", {
    token,
  });
  return normalizeList(payload);
}

export async function listAnalyticsMetrics(token: string) {
  const payload = await adminRequest<unknown>("/api/analytics/metrics", {
    token,
  });
  return normalizeList(payload);
}

export async function listAnalyticsSources(token: string) {
  const payload = await adminRequest<unknown>("/api/analytics/sources", {
    token,
  });
  return normalizeList(payload);
}

export async function getAnalyticsFreshness(
  token: string,
  dataset_code?: string,
) {
  const query =
    dataset_code && dataset_code.trim()
      ? `?dataset_code=${encodeURIComponent(dataset_code.trim())}`
      : "";
  const payload = await adminRequest<unknown>(
    `/api/analytics/freshness${query}`,
    {
      token,
    },
  );
  const list = normalizeList(payload);
  if (list.length > 0) {
    return list;
  }
  const single = normalizeSingle(payload);
  return single ? [single] : [];
}

export async function refreshAnalyticsDataset(
  token: string,
  data: AnalyticsRefreshPayload,
) {
  const payload = await adminRequest<unknown>("/api/analytics/refresh", {
    method: "POST",
    token,
    body: data,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function runAnalyticsCustomReport(
  token: string,
  data: AnalyticsCustomReportPayload,
) {
  const payload = await adminRequest<unknown>("/api/analytics/reports/custom", {
    method: "POST",
    token,
    body: data,
  });
  const list = normalizeList(payload);
  if (list.length > 0) {
    return list;
  }
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getAnalyticsReportCatalog(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/analytics/reports/catalog",
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listOperationalAnalyticsReports(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/analytics/reports/operational",
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function runOperationalAnalyticsReport(
  token: string,
  code: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/analytics/reports/operational/${encodeURIComponent(code)}${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function downloadOperationalAnalyticsReport(
  token: string,
  code: string,
  params: Record<string, string | number | undefined> = {},
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(
      `/api/analytics/reports/operational/${encodeURIComponent(code)}/export${buildRecordQuery(params)}`,
    ),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `${code.toLowerCase()}-report`;

  return {
    blob,
    filename: decodeURIComponent(rawFilename),
    contentType: response.headers.get("content-type"),
  };
}

export async function listSavedAnalyticsReports(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest<unknown>(
    `/api/analytics/reports/saved${buildRecordQuery(params)}`,
    { token },
  );
  return normalizeList(payload);
}

export async function saveAnalyticsReport(
  token: string,
  data: SaveAnalyticsReportPayload,
) {
  const payload = await adminRequest<unknown>("/api/analytics/reports/saved", {
    method: "POST",
    token,
    body: data,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updateSavedAnalyticsReport(
  token: string,
  id: string | number,
  data: Partial<SaveAnalyticsReportPayload>,
) {
  const payload = await adminRequest<unknown>(
    `/api/analytics/reports/saved/${id}`,
    {
      method: "PUT",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function runSavedAnalyticsReport(
  token: string,
  id: string | number,
  data: AnalyticsQueryParams,
) {
  const payload = await adminRequest<unknown>(
    `/api/analytics/reports/saved/${id}/run`,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  const list = normalizeList(payload);
  if (list.length > 0) {
    return list;
  }
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function deleteSavedAnalyticsReport(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest<unknown>(
    `/api/analytics/reports/saved/${id}`,
    {
      method: "DELETE",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function exportAnalyticsReport(
  token: string,
  data: AnalyticsExportPayload,
) {
  const payload = await adminRequest<unknown>("/api/analytics/exports", {
    method: "POST",
    token,
    body: data,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function downloadAnalyticsExport(
  token: string,
  id: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(`/api/analytics/exports/${id}/download`),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `analytics-export-${id}`;

  return {
    blob,
    filename: decodeURIComponent(rawFilename),
    contentType: response.headers.get("content-type"),
  };
}

export async function runAnalyticsReconciliation(token: string) {
  const payload = await adminRequest<unknown>(
    "/api/analytics/reconciliation/run",
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function runStatutoryReport(
  token: string,
  data: StatutoryReportRunPayload,
) {
  const payload = await adminRequest<unknown>(
    "/api/analytics/statutory-reports/run",
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

// ── Default Avatars ──────────────────────────────────────────────────────────

export type DefaultAvatarGender = "male" | "female" | "neutral";
export type DefaultAvatarStatus = "active" | "inactive";

export interface Base64FileDto {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileString: string;
}

export interface CreateDefaultAvatarPayload {
  avatar_name: string;
  gender_category: DefaultAvatarGender;
  image_file: Base64FileDto;
  display_order?: number;
  is_default?: boolean;
  status?: DefaultAvatarStatus;
}

export interface UpdateDefaultAvatarPayload {
  avatar_name?: string;
  gender_category?: DefaultAvatarGender;
  image_file?: Base64FileDto;
  display_order?: number;
  is_default?: boolean;
  status?: DefaultAvatarStatus;
}

export interface DefaultAvatarsQueryParams {
  gender_category?: DefaultAvatarGender;
  status?: DefaultAvatarStatus;
  include_inactive?: boolean;
}

/** Resolve a displayable image URL from a default-avatar record. */
export function extractDefaultAvatarImageUrl(
  row: AdminRecord | null | undefined,
): string | null {
  if (!row) return null;

  // Prefer explicit media fields (relative or absolute) before nested structures.
  const pathKeys = [
    "image_url",
    "imageUrl",
    "url",
    "avatar_url",
    "avatarUrl",
    "photo_url",
    "photoUrl",
    "file_url",
    "fileUrl",
    "media_url",
    "mediaUrl",
    "public_url",
    "publicUrl",
    "signed_url",
    "signedUrl",
    "download_url",
    "downloadUrl",
    "path",
    "file_path",
    "filePath",
    "storage_path",
    "storagePath",
    "storage_key",
    "storageKey",
    "relative_path",
    "relativePath",
    "image_path",
    "imagePath",
    "thumbnail_url",
    "thumbnailUrl",
  ] as const;

  const resolvePathValue = (value: unknown): string | null => {
    if (typeof value !== "string" || !value.trim()) return null;
    return resolveBackendMediaUrl(value.trim());
  };

  for (const key of pathKeys) {
    const resolved = resolvePathValue(row[key]);
    if (resolved) return resolved;
  }

  // Reconstruct from company + filename when API only returns file metadata.
  // Example final URL: {API}/uploads/default-avatars/company-1/neutral-secondary.svg
  const fileName =
    (typeof row.file_name === "string" && row.file_name.trim()) ||
    (typeof row.fileName === "string" && row.fileName.trim()) ||
    (typeof row.filename === "string" && row.filename.trim()) ||
    (typeof row.stored_name === "string" && row.stored_name.trim()) ||
    (typeof row.storedName === "string" && row.storedName.trim()) ||
    (typeof row.original_name === "string" && row.original_name.trim()) ||
    "";
  const companyId =
    row.company_id ?? row.companyId ?? asRecord(row.company)?.id ?? null;
  if (fileName) {
    if (companyId != null && String(companyId).trim()) {
      const built = resolveBackendMediaUrl(
        `/uploads/default-avatars/company-${String(companyId).trim()}/${fileName.replace(/^\/+/, "")}`,
      );
      if (built) return built;
    }
    // Fallback when company is known only via path fragments.
    if (
      fileName.includes("default-avatars/") ||
      fileName.includes("uploads/")
    ) {
      const built = resolveBackendMediaUrl(fileName);
      if (built) return built;
    }
  }

  const direct = extractProfilePhotoUrl(row);
  if (direct) return direct;

  const nestedCandidates = [
    asRecord(row.image_file),
    asRecord(row.imageFile),
    asRecord(row.file),
    asRecord(row.media),
    asRecord(row.image),
  ];
  for (const nestedFile of nestedCandidates) {
    if (!nestedFile) continue;
    for (const key of pathKeys) {
      const resolved = resolvePathValue(nestedFile[key]);
      if (resolved) return resolved;
    }
    const fromNested = extractProfilePhotoUrl(nestedFile);
    if (fromNested) return fromNested;
    const nestedName =
      (typeof nestedFile.fileName === "string" && nestedFile.fileName.trim()) ||
      (typeof nestedFile.file_name === "string" &&
        nestedFile.file_name.trim()) ||
      (typeof nestedFile.filename === "string" && nestedFile.filename.trim()) ||
      "";
    if (nestedName && companyId != null && String(companyId).trim()) {
      const built = resolveBackendMediaUrl(
        `/uploads/default-avatars/company-${String(companyId).trim()}/${nestedName.replace(/^\/+/, "")}`,
      );
      if (built) return built;
    }
    const fileString =
      typeof nestedFile.fileString === "string"
        ? nestedFile.fileString
        : typeof nestedFile.file_string === "string"
          ? nestedFile.file_string
          : typeof nestedFile.base64 === "string"
            ? nestedFile.base64
            : "";
    const mime =
      typeof nestedFile.mimeType === "string"
        ? nestedFile.mimeType
        : typeof nestedFile.mime_type === "string"
          ? nestedFile.mime_type
          : "image/png";
    if (fileString.trim()) {
      const compact = fileString.trim();
      // Relative/path strings accidentally stored in fileString
      if (
        compact.startsWith("/") ||
        compact.startsWith("uploads/") ||
        compact.startsWith("default-avatars/") ||
        /^https?:\/\//i.test(compact)
      ) {
        return resolveBackendMediaUrl(compact);
      }
      if (compact.startsWith("data:image")) return compact;
      return `data:${mime};base64,${compact.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")}`;
    }
  }

  // Some APIs store raw base64 on the avatar itself.
  const raw =
    typeof row.fileString === "string"
      ? row.fileString
      : typeof row.file_string === "string"
        ? row.file_string
        : typeof row.image_base64 === "string"
          ? row.image_base64
          : typeof row.imageBase64 === "string"
            ? row.imageBase64
            : "";
  if (raw.trim()) {
    const compact = raw.trim();
    if (
      compact.startsWith("/") ||
      compact.startsWith("uploads/") ||
      compact.startsWith("default-avatars/") ||
      /^https?:\/\//i.test(compact)
    ) {
      return resolveBackendMediaUrl(compact);
    }
    if (compact.startsWith("data:image")) return compact;
    return `data:image/png;base64,${compact}`;
  }

  return null;
}

/**
 * GET /api/default-avatars
 * Query: gender_category?, status?, include_inactive?
 */
export async function listDefaultAvatars(
  token: string,
  params: DefaultAvatarsQueryParams = {},
): Promise<AdminRecord[]> {
  const searchParams = new URLSearchParams();
  if (params.gender_category)
    searchParams.set("gender_category", params.gender_category);
  if (params.status) searchParams.set("status", params.status);
  // Only send when explicitly requested (API: Include inactive avatars in the response.)
  if (params.include_inactive === true)
    searchParams.set("include_inactive", "true");
  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const payload = await adminRequest<unknown>(`/api/default-avatars${query}`, {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  });
  return normalizeList(payload);
}

/** GET /api/default-avatars/{id} */
export async function getDefaultAvatar(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/default-avatars/${id}`, {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

/**
 * POST /api/default-avatars → 201
 * Body: CreateDefaultAvatarDto
 *   avatar_name, gender_category, image_file (Base64FileDto),
 *   display_order?, is_default?, status?
 */
export async function createDefaultAvatar(
  token: string,
  data: CreateDefaultAvatarPayload,
): Promise<AdminRecord | null> {
  const payload = await adminRequest<unknown>("/api/default-avatars", {
    method: "POST",
    token,
    body: {
      avatar_name: data.avatar_name,
      gender_category: data.gender_category,
      image_file: {
        fileName: data.image_file.fileName,
        fileSize: Math.max(1, Number(data.image_file.fileSize) || 1),
        mimeType: data.image_file.mimeType,
        fileString: data.image_file.fileString,
      },
      display_order:
        typeof data.display_order === "number" &&
        Number.isFinite(data.display_order)
          ? Math.max(0, data.display_order)
          : 0,
      is_default: data.is_default === true,
      status: data.status === "inactive" ? "inactive" : "active",
    },
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

/**
 * PATCH /api/default-avatars/{id} → 200
 * Body: UpdateDefaultAvatarDto (partial create fields)
 */
export async function updateDefaultAvatar(
  token: string,
  id: string | number,
  data: UpdateDefaultAvatarPayload,
): Promise<AdminRecord | null> {
  const body: AdminRecord = {};
  if (typeof data.avatar_name === "string") body.avatar_name = data.avatar_name;
  if (data.gender_category) body.gender_category = data.gender_category;
  if (
    typeof data.display_order === "number" &&
    Number.isFinite(data.display_order)
  ) {
    body.display_order = Math.max(0, data.display_order);
  }
  if (typeof data.is_default === "boolean") body.is_default = data.is_default;
  if (data.status === "active" || data.status === "inactive")
    body.status = data.status;
  if (data.image_file) {
    body.image_file = {
      fileName: data.image_file.fileName,
      fileSize: Math.max(1, Number(data.image_file.fileSize) || 1),
      mimeType: data.image_file.mimeType,
      fileString: data.image_file.fileString,
    };
  }

  const payload = await adminRequest<unknown>(`/api/default-avatars/${id}`, {
    method: "PATCH",
    token,
    body,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

/**
 * POST /api/default-avatars/{id}/set-default → 201
 * Marks this avatar as the company default for its gender category.
 */
export async function setDefaultAvatarAsDefault(
  token: string,
  id: string | number,
) {
  return adminRequest<unknown>(`/api/default-avatars/${id}/set-default`, {
    method: "POST",
    token,
  });
}

/** DELETE /api/default-avatars/{id} → 200 */
export async function deleteDefaultAvatar(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/default-avatars/${id}`, {
    method: "DELETE",
    token,
  });
}

const SAFE_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

function sanitizeAvatarFileName(name: string, mimeType: string): string {
  const base = (name || "avatar")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("gif")
        ? "gif"
        : "jpg";
  if (/\.(png|jpe?g|webp|gif)$/i.test(base)) {
    return base;
  }
  return `${base || "avatar"}.${ext}`;
}

function estimateBase64ByteLength(base64: string): number {
  const compact = base64.replace(/\s+/g, "");
  const padding = compact.endsWith("==") ? 2 : compact.endsWith("=") ? 1 : 0;
  return Math.max(1, Math.floor((compact.length * 3) / 4) - padding);
}

function sanitizeUploadFileName(name: string, fallback = "upload"): string {
  const normalized = (name || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

export async function fileToBase64UploadDto(
  file: File,
): Promise<Base64FileDto> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file."));
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const fileString = (comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl).replace(
    /\s+/g,
    "",
  );
  if (!fileString) {
    throw new Error("File encoding produced an empty upload.");
  }
  const mimeFromHeader =
    header
      .match(/^data:([^;]+);/i)?.[1]
      ?.trim()
      .toLowerCase() || "";
  const mimeType = (file.type || mimeFromHeader || "application/octet-stream")
    .trim()
    .toLowerCase();

  return {
    fileName: sanitizeUploadFileName(file.name || "upload"),
    fileSize: estimateBase64ByteLength(fileString),
    mimeType,
    fileString,
  };
}

/**
 * Normalize any picked image into a backend-safe raster (PNG/JPEG).
 * SVG / exotic types often crash image processors (500). Large files can too.
 */
export async function normalizeAvatarImageFile(
  file: File,
  options: { maxEdge?: number; maxBytes?: number } = {},
): Promise<File> {
  const maxEdge = options.maxEdge ?? 1024;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const rawType = (file.type || "").toLowerCase().trim();
  const nameLower = file.name.toLowerCase();
  const looksSvg =
    rawType.includes("svg") ||
    nameLower.endsWith(".svg") ||
    rawType === "image/svg+xml";
  const looksHeic =
    rawType.includes("heic") ||
    rawType.includes("heif") ||
    nameLower.endsWith(".heic") ||
    nameLower.endsWith(".heif");

  if (looksHeic) {
    throw new Error(
      "HEIC/HEIF images are not supported. Please use PNG or JPG.",
    );
  }

  // Already a safe small raster — keep as-is when possible.
  if (
    !looksSvg &&
    SAFE_AVATAR_MIME.has(rawType === "image/jpg" ? "image/jpeg" : rawType) &&
    file.size > 0 &&
    file.size <= maxBytes
  ) {
    // Still re-encode if mime is ambiguous empty type.
    if (rawType) {
      return file;
    }
  }

  if (typeof document === "undefined" || typeof Image === "undefined") {
    // SSR / non-browser — return original; caller still base64-encodes it.
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Could not read this image. Try PNG or JPG."));
      img.src = objectUrl;
    });

    const srcW = Math.max(1, image.naturalWidth || image.width || 1);
    const srcH = Math.max(1, image.naturalHeight || image.height || 1);
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not process image.");
    }
    // White background so transparent SVG/PNG don't become black on JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const preferPng =
      looksSvg || rawType.includes("png") || rawType.includes("gif");
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Could not encode image."));
        },
        preferPng ? "image/png" : "image/jpeg",
        0.9,
      );
    });

    const outMime = blob.type || (preferPng ? "image/png" : "image/jpeg");
    const outName = sanitizeAvatarFileName(
      file.name.replace(/\.[^.]+$/, "") || "avatar",
      outMime,
    );
    return new File([blob], outName, { type: outMime });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Build Base64FileDto for CreateDefaultAvatarDto.image_file.
 * fileString is pure base64 (no data: prefix). fileSize matches decoded bytes.
 * Images are normalized to PNG/JPEG so the backend image processor is less likely to 500.
 */
export async function fileToBase64FileDto(file: File): Promise<Base64FileDto> {
  const normalized = await normalizeAvatarImageFile(file);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file."));
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(normalized);
  });
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";
  // Strip whitespace/newlines some browsers insert into large data URLs.
  const fileString = (comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl).replace(
    /\s+/g,
    "",
  );
  if (!fileString) {
    throw new Error("Image encoding produced an empty file.");
  }
  const mimeFromHeader =
    header
      .match(/^data:([^;]+);/i)?.[1]
      ?.trim()
      .toLowerCase() || "";
  let mimeType = (normalized.type || mimeFromHeader || "image/png")
    .trim()
    .toLowerCase();
  if (mimeType === "image/jpg") mimeType = "image/jpeg";
  if (!SAFE_AVATAR_MIME.has(mimeType)) {
    // Force a known-safe type after normalization.
    mimeType = "image/png";
  }
  const fileName = sanitizeAvatarFileName(
    normalized.name || file.name || "avatar",
    mimeType,
  );
  const fileSize = estimateBase64ByteLength(fileString);

  return {
    fileName,
    fileSize,
    mimeType,
    fileString,
  };
}

/**
 * Load a remote/default-avatar image URL into a File for upload fallback
 * (POST /api/me/profile/photo) when PATCH avatar returns 500.
 */
export async function fetchImageUrlAsAvatarFile(
  imageUrl: string,
  fileName = "avatar.png",
): Promise<File> {
  const resolved = resolveBackendMediaUrl(imageUrl) || imageUrl;
  const response = await fetch(resolved, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load avatar image for upload fallback.");
  }
  const blob = await response.blob();
  const mime = blob.type || "image/png";
  const safeName = sanitizeAvatarFileName(fileName, mime);
  const raw = new File([blob], safeName, { type: mime || "image/png" });
  return normalizeAvatarImageFile(raw);
}

/** Extract numeric/string id from a default-avatar API record. */
export function readDefaultAvatarId(
  row: AdminRecord | null | undefined,
): string | number | null {
  if (!row) return null;
  const value =
    row.id ?? row.avatar_id ?? row.default_avatar_id ?? row.defaultAvatarId;
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const asNum = Number(value.trim());
    return Number.isFinite(asNum) ? Math.trunc(asNum) : null;
  }
  return null;
}

/** True when a list row is usable for employee self-select (active + numeric id + image). */
export function isSelectableDefaultAvatar(
  row: AdminRecord | null | undefined,
): boolean {
  if (!row) return false;
  const id = readDefaultAvatarId(row);
  if (id == null) return false;
  const status = String(row.status ?? "active")
    .trim()
    .toLowerCase();
  if (status && status !== "active") return false;
  return Boolean(extractDefaultAvatarImageUrl(row));
}

// ---------------------------------------------------------------------------
// Identity change audit (names / email / phone synced between users and employees)
// ---------------------------------------------------------------------------

export type IdentityAuditField = "first_name" | "last_name" | "email" | "phone";
export type IdentityAuditSource =
  "user_update" | "employee_update" | "rollback";

export interface IdentityAuditEntry {
  id: number;
  change_set_id: string;
  company_id: number;
  user_id: number | null;
  employee_id: number | null;
  affected_employee_ids: number[];
  subject_name: string | null;
  field: IdentityAuditField;
  old_value: string | null;
  new_value: string | null;
  source: IdentityAuditSource;
  rollback_of_change_set_id: string | null;
  rolled_back_by_change_set_id: string | null;
  can_rollback: boolean;
  actor_user_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  reason: string | null;
  created_at: string;
}

export interface IdentityAuditQuery {
  page?: number;
  limit?: number;
  user_id?: number;
  employee_id?: number;
  field?: IdentityAuditField;
  source?: IdentityAuditSource;
  search?: string;
  from?: string;
  to?: string;
}

function buildIdentityAuditQuery(params: IdentityAuditQuery) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /api/identity-audit — paginated identity change history. */
export async function listIdentityAudit(
  token: string,
  params: IdentityAuditQuery = {},
) {
  return adminRequest<{
    items: IdentityAuditEntry[];
    total: number;
    page: number;
    limit: number;
  }>(`/api/identity-audit${buildIdentityAuditQuery(params)}`, { token });
}

/** GET /api/identity-audit/export — CSV of the filtered history. */
export async function downloadIdentityAuditCsv(
  token: string,
  params: IdentityAuditQuery = {},
): Promise<Blob> {
  const { page: _page, limit: _limit, ...filters } = params;
  void _page;
  void _limit;
  const response = await fetch(
    buildUrl(`/api/identity-audit/export${buildIdentityAuditQuery(filters)}`),
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      payload = { message: text };
    }
    throw new Error(extractMessage(payload, response.status));
  }
  return response.blob();
}

/** POST /api/identity-audit/{changeSetId}/rollback — revert the latest change. */
export async function rollbackIdentityChange(
  token: string,
  changeSetId: string,
  reason?: string,
) {
  return adminRequest<{ changeSetId: string | null; changedFields: string[] }>(
    `/api/identity-audit/${encodeURIComponent(changeSetId)}/rollback`,
    { method: "POST", token, body: { reason: reason || undefined } },
  );
}

export async function extendLeaveEvidenceDeadline(
  token: string,
  id: number,
  evidence_due_at: string,
  reason: string,
) {
  return adminRequest<AdminRecord>(
    `/api/leave/requests/${id}/evidence-deadline`,
    { token, method: "POST", body: { evidence_due_at, reason } },
  );
}
export async function retryLeaveRouting(token: string, id: number) {
  return adminRequest<AdminRecord>(`/api/leave/requests/${id}/retry-routing`, {
    token,
    method: "POST",
  });
}

export async function downloadMyLeaveRequestDocument(
  token: string,
  leaveRequestId: string | number,
  documentId: string | number,
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(
      `/api/me/leave/requests/${leaveRequestId}/documents/${documentId}/download`,
    ),
    {
      method: "GET",
      headers: {
        accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { message: text };
      }
    }
    const error = new Error(
      extractMessage(payload, response.status),
    ) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = disposition.match(
    /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i,
  );
  const rawFilename =
    filenameMatch?.[1] ?? filenameMatch?.[2] ?? `leave-document-${documentId}`;
  const filename = decodeURIComponent(rawFilename);

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  };
}

export async function patchMyLeaveRequestMedicalDetail(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/medical-detail`, {
    method: "PATCH",
    token,
    body: data,
  });
}
