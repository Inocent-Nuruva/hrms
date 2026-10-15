# Batch 3 — Complete refactored code blocks

All six requested target files are implemented in the workspace and reproduced below in full. The concrete transport, schema, storage and workflow helpers and the affected auth writers/callers are also included in full. There are no abbreviated service bodies, placeholder functions or omitted API wrappers.

## Contracts and integration

- `apiRequest` and `adminRequest` now require a Zod schema as the second argument: `(path, schema, options)`. They infer their output from the schema and delegate validation to `requestJson`. Repository call sites were migrated; external callers must use the new signature too.
- Dynamic admin endpoints explicitly use a record/array wire contract. Existing concrete typed response contracts have named field schemas (leave imports, dashboard card styles and identity audit). This does not claim every dynamic `AdminRecord` endpoint now has a complete domain DTO schema; callers can provide stricter schemas directly.
- Successful invalid JSON and schema mismatches raise `ContractError`. Explicit no-content contracts accept empty bodies. Plain-text/HTML success bodies no longer silently become a typed payload. HTTP failures preserve structured status, payload, validation messages and retry-after information.
- Collection normalization accepts a direct record array, the primary named `data`/`result`/`item` envelope, or an explicitly supported `items`/`rows` page. There is no recursive relation discovery, array scoring, mixed-row filtering or first-object guessing. An explicitly present empty primary collection stays empty. Permission string catalogs and role catalogs have explicit endpoint-specific adapters.
- Single-record normalization preserves entities with a root identity and otherwise unwraps only the named envelope. Company/user relations cannot overwrite the root ID.
- `useLocalStorage` uses `useSyncExternalStore` with a stable server snapshot and requires a schema for persisted values. `useAuth` consumes one canonical session record, not separately initialized token/user hook states.
- Session persistence validates user/tokens, publishes one canonical record, then maintains legacy key mirrors. Logout persists a tombstone so stale mirrors cannot revive a cleared session. Native cross-tab storage events and same-window dispatches feed the shared observer loop. Persistence errors are surfaced, not silently converted into authenticated React state.
- Credential, subject, company and access-context changes invalidate cache generations. Permission metadata changes also purge caches. Auth/session refresh completions are checked against the credentials that initiated them before committing; stale failures cannot clear another session.
- Warm snapshots contain `subject`, `companyId` and `credentialVersion`, are runtime validated, and recheck identity and the 90-second TTL even when served from memory. In-flight prefetches cannot republish after invalidation. Failed prefetches do not manufacture ready zero-count dashboards.
- Administrative mutations invalidate at start and completion. Old pending GETs reject with an AbortError-named stale response error and cannot repaint callers or repopulate caches. Deduplication is generation/schema scoped; cached raw payloads are cloned and revalidated, including transforming schemas. Cache size is bounded.
- Finance list effects use active flags, request sequences and credential checks. Eligibility effects clear their timer and drop late results after input/dialog/credential changes.
- Finance draft recovery stores a validated checkpoint under the actor/company sessionStorage key. The generated draft ID and completed steps survive partial failures; reopen/reload resumes the same plan. Server document/guarantor lists are reconciled before retries, including operations whose acknowledgements were lost. A completed server submission is recognized without posting another submit.
- An uncertain draft-create response is reconciled against exact payload fields and its creation timestamp. If it cannot be identified uniquely, recovery blocks another create rather than inventing an idempotency guarantee. No backend idempotency feature is assumed.
- Browser `File` objects are not serialized. After reloading, the user must reselect only documents that are still missing on the server. Once a plan is checkpointed, its core terms/guarantors/submission choice are frozen; definite pre-create 4xx failures allow correcting the form.
- Added jsdom and its types for real React hydration/lifecycle regression tests. No backend/schema migration is required for Batch 3.

## Validation

- Frontend: 78 test files, 510 tests passed.
- TypeScript and focused ESLint passed; Git whitespace checks passed.
- New regression coverage includes stable hydration, synchronized mounted auth consumers, native cross-tab events, company/credential cache isolation, warm-memory TTL, response contract rejection, preserved empty envelopes/root IDs, stale GET rejection, transformed-cache schemas, partial finance retries, uncertain-create protection and a rendered finance component whose old eligibility response resolves last.
- The stricter contracts exposed incomplete leave-import/single-record collection fixtures; those fixtures were corrected to match their actual endpoint contracts.
- Existing user edits were preserved. No live backend mutations, deployment, or paid provider calls were performed for Batch 3.

## [src/services/api.ts](/home/innocent/systems/hrms/src/services/api.ts)

```typescript
import { z } from "zod";
import { API_BASE_URL } from "@/utils/constants";
import { requestJson } from "@/lib/request-json";

export { ApiError } from "@/lib/request-json";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}
function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  options: RequestOptions = {},
): Promise<z.output<S>> {
  const { method = "GET", body, token, headers, signal } = options;
  return requestJson(buildUrl(path), schema, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}
```

## [src/lib/admin-api.ts](/home/innocent/systems/hrms/src/lib/admin-api.ts)

```typescript
import { LeaveBalanceImportRowsPageSchema, LeaveBalanceImportBatchesPageSchema, LeaveBalanceImportBatchDetailSchema, DashboardCardStyleSchema, IdentityAuditPageSchema, IdentityRollbackSchema, LeaveBalanceImportBatchSchema, LeaveBalanceImportRowSchema } from "@/lib/admin-response-schemas";
import { z } from "zod";
import { requestJson, ApiError, ContractError, RecordSchema } from "@/lib/request-json";
import { getSessionSnapshot, subscribeSession } from "@/lib/auth-session-store";
import { ApiResponseSchema } from "@/lib/request-json";
import { extractBackupCodes } from "@/lib/backup-codes";
import { env } from "@/lib/env";
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
}

type CachedAdminResponse = {
  expiresAt: number;
  value: unknown;
  generation: number;
};

const adminResponseCache = new Map<string, CachedAdminResponse>();
const inflightAdminRequests = new Map<string, { promise: Promise<unknown>; raw: () => unknown }>();
export const ADMIN_CACHE_INVALIDATED_EVENT = "hrms:admin-cache-invalidated";
let cacheGeneration = 0;
let mutationsInFlight = 0;
const schemaIds = new WeakMap<z.ZodType, number>();
let nextSchemaId = 0;
let credentialVersion = getSessionSnapshot().credentialVersion;
subscribeSession(() => {
  const current = getSessionSnapshot().credentialVersion;
  if (current !== credentialVersion) {
    credentialVersion = current;
    invalidateAdminGetCache();
  }
});
export class StaleRequestError extends Error {
  constructor() { super("This response belongs to an obsolete cache generation."); this.name = "AbortError"; }
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
  cacheGeneration += 1;
  adminResponseCache.clear();
  inflightAdminRequests.clear();
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(ADMIN_CACHE_INVALIDATED_EVENT));
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
  | "shift-attendance-rules"
  | "shift-breaks"
  | "shift-change-requests"
  | "shift-overtime-rules"
  | "shift-rotation-groups"
  | "shift-rotation-rules"
  | "shift-schedules"
  | "shift-templates"
  | "shifts";

export type TimetableResourceKey =
  | "employee-timetables"
  | "timetable-attendance-rules"
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

export type EmployeeInvitationResponse = AdminRecord & {
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
  const result = RecordSchema.safeParse(value);
  return result.success ? result.data : null;
}
function asArray(value: unknown): AdminRecord[] | null {
  const result = z.array(RecordSchema).safeParse(value);
  return result.success ? result.data : null;
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

const CollectionSchema = z.array(RecordSchema);
const PageSchema = z.union([
  z.object({ items: CollectionSchema }).passthrough().transform((page) => page.items),
  z.object({ rows: CollectionSchema }).passthrough().transform((page) => page.rows),
]);
const CollectionValueSchema = z.union([CollectionSchema, PageSchema]);

function normalizeList(payload: unknown): AdminRecord[] {
  if (Array.isArray(payload)) return CollectionSchema.parse(payload);
  const root = asRecord(payload);
  if (!root) throw new ContractError("Expected a collection response.");
  // An explicitly present primary envelope is authoritative, including data: [].
  for (const key of ["data", "result", "item"] as const) {
    if (Object.hasOwn(root, key)) {
      const parsed = CollectionValueSchema.safeParse(root[key]);
      if (!parsed.success) throw new ContractError(`Invalid collection envelope: ${key}.`, parsed.error.issues);
      return parsed.data;
    }
  }
  const page = PageSchema.safeParse(root);
  if (page.success) return page.data;
  throw new ContractError("Expected data, result, item, items, rows, or a direct record array.");
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
  if (payload === undefined || payload === null) return null;
  const root = asRecord(payload);
  if (!root) throw new ContractError("Expected a single record response.");
  // A resource with its own identity remains the resource, including its relations.
  if (Object.hasOwn(root, "id")) return root;
  for (const key of ["data", "result", "item"] as const) {
    if (Object.hasOwn(root, key)) {
      if (root[key] === null) return null;
      const parsed = RecordSchema.safeParse(root[key]);
      if (!parsed.success) throw new ContractError(`Invalid single-record envelope: ${key}.`, parsed.error.issues);
      return parsed.data;
    }
  }
  return root;
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

export async function adminRequest<S extends z.ZodType>(
  path: string, schema: S, options: AdminRequestOptions = {},
): Promise<z.output<S>> {
  const { method = "GET", token, body, signal, cacheTtlMs = 0, dedupe = true } = options;
  if (signal?.aborted) throw createAbortError();
  const isGet = method === "GET" && body === undefined;
  if (!isGet) { mutationsInFlight += 1; invalidateAdminGetCache(); }
  const generation = cacheGeneration;
  const schemaId = schemaIds.get(schema) ?? ++nextSchemaId;
  schemaIds.set(schema, schemaId);
  const key = `${generation}:${schemaId}:${getAdminRequestKey(path, method, token, body)}`;
  const assertCurrent = () => {
    if (isGet && (generation !== cacheGeneration || mutationsInFlight > 0)) throw new StaleRequestError();
  };
  if (isGet && cacheTtlMs > 0) {
    const cached = adminResponseCache.get(key);
    if (cached && cached.generation === generation && cached.expiresAt > Date.now()) {
      assertCurrent(); return schema.parse(structuredClone(cached.value));
    }
    adminResponseCache.delete(key);
  }
  if (isGet && dedupe && !signal) {
    const pending = inflightAdminRequests.get(key);
    if (pending) { await pending.promise; assertCurrent(); return schema.parse(pending.raw()); }
  }
  let raw: unknown;
  const captured = z.preprocess((value) => { raw = structuredClone(value); return value; }, schema);
  const promise = (async () => {
    let attempt = 0;
    while (true) {
      try {
        const result = await requestJson(buildUrl(path), captured, {
          method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal,
        });
        assertCurrent();
        if (isGet && cacheTtlMs > 0) {
          for (const [entryKey, value] of adminResponseCache) {
            if (value.expiresAt <= Date.now()) adminResponseCache.delete(entryKey);
          }
          if (adminResponseCache.size >= 512) {
            const oldest = adminResponseCache.keys().next().value;
            if (oldest) adminResponseCache.delete(oldest);
          }
          adminResponseCache.set(key, { generation, expiresAt: Date.now() + cacheTtlMs, value: raw });
        }
        return result;
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.statusCode === 429 && isGet && attempt < GET_THROTTLE_MAX_RETRIES) {
            attempt += 1;
            await waitForRetry(parseRetryAfterMs(error.retryAfter) ?? Math.min(400 * 2 ** (attempt - 1), 4_000), signal);
            assertCurrent(); continue;
          }
          error.message = extractMessage(error.payload, error.statusCode);
        }
        throw error;
      }
    }
  })();
  const entry = { promise, raw: () => raw };
  if (isGet && dedupe && !signal) inflightAdminRequests.set(key, entry);
  try { return await promise; }
  finally {
    if (inflightAdminRequests.get(key) === entry) inflightAdminRequests.delete(key);
    if (!isGet) { mutationsInFlight -= 1; invalidateAdminGetCache(); }
  }
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
  const root = asRecord(payload);
  if (root) {
    for (const key of ["data", "result", "item"] as const) {
      if (!Object.hasOwn(root, key)) continue;
      const value = asRecord(root[key]);
      if (value && Object.hasOwn(value, "roles")) return CollectionSchema.parse(value.roles);
      return normalizeList(payload);
    }
    if (Object.hasOwn(root, "roles")) return CollectionSchema.parse(root.roles);
  }
  return normalizeList(payload);
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
  const payload = await adminRequest("/api/roles", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `${RESOURCE_PATHS[resource]}${query}`, ApiResponseSchema,
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
function normalizeResourceCollection(resource: AdminResourceKey, payload: unknown): AdminRecord[] {
  if (resource !== "permissions") return normalizeList(payload);
  const root = asRecord(payload);
  const value = root && Object.hasOwn(root, "data") ? root.data : payload;
  const names = z.array(z.string().min(1)).safeParse(value);
  if (names.success) return names.data.map((name) => ({ id: name, name, display_name: name }));
  return normalizeList(payload);
}

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
    const payload = await adminRequest(RESOURCE_PATHS[resource], ApiResponseSchema, {
      token,
      cacheTtlMs,
    });
    return dedupeAdminRecordsById(normalizeResourceCollection(resource, payload));
  }

  const collected: AdminRecord[] = [];
  let page = 1;

  while (page <= maxPages) {
    // Only page/limit — avoid sortBy so backends that don't index roles by created_at still work.
    const query = buildUsersQuery({ page, limit: pageSize });
    let payload: unknown;
    try {
      payload = await adminRequest(
        `${RESOURCE_PATHS[resource]}${query}`, ApiResponseSchema,
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
    const rows = normalizeResourceCollection(resource, payload);
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
  const payload = await adminRequest(`/api/users${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/notifications${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    "/api/notifications/unread-count", ApiResponseSchema,
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
  const payload = await adminRequest(`/api/notifications/${id}/read`, ApiResponseSchema, {
    method: "PATCH",
    token,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function markNotificationAsSeen(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(`/api/notifications/${id}/seen`, ApiResponseSchema, {
    method: "PATCH",
    token,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function markAllNotificationsAsRead(token: string) {
  return adminRequest("/api/notifications/read-all", ApiResponseSchema, {
    method: "PATCH",
    token,
  });
}

export async function deleteNotification(token: string, id: string | number) {
  const payload = await adminRequest(`/api/notifications/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function createTestNotification(
  token: string,
  data: CreateTestNotificationInput | AdminRecord,
) {
  const payload = await adminRequest("/api/notifications/test", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
  return (normalizeSingle(payload) as NotificationItem | null) ?? null;
}

export async function listNotificationChannelSettings(token: string) {
  const payload = await adminRequest(
    "/api/notifications/channel-settings", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload) as NotificationChannelSetting[];
}

export async function getNotificationChannelSetting(
  token: string,
  channel: string,
) {
  const payload = await adminRequest(
    `/api/notifications/channel-settings/${encodeURIComponent(channel)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/channel-settings/${encodeURIComponent(channel)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/channel-registry${buildNotificationChannelRegistryQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload) as NotificationChannelRegistryItem[];
}

export async function listPlatformNotificationChannelRegistry(
  token: string,
  params: NotificationChannelRegistryQueryParams = {},
) {
  const payload = await adminRequest(
    `/api/notifications/platform/channel-registry${buildNotificationChannelRegistryQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload) as NotificationChannelRegistryItem[];
}

export async function getNotificationChannelRegistryItem(
  token: string,
  channel: string,
  code: string,
) {
  const payload = await adminRequest(
    `/api/notifications/channel-registry/${encodeURIComponent(channel)}/${encodeURIComponent(code)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/channel-registry/${encodeURIComponent(channel)}/${encodeURIComponent(code)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/platform/channel-registry/${encodeURIComponent(channel)}/${encodeURIComponent(code)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/templates${buildNotificationTemplateQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/templates/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest("/api/notifications/templates", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/notifications/templates/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/rules${buildNotificationRuleQuery(params)}`, ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload) as NotificationRuleItem[];
}

export async function getNotificationRule(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/notifications/rules/${id}`, ApiResponseSchema,
    { token },
  );
  return (
    (normalizeSingle(payload) as NotificationRuleItem | null) ??
    (asRecord(payload) as NotificationRuleItem | null)
  );
}

export async function createNotificationRule(token: string, data: AdminRecord) {
  const payload = await adminRequest("/api/notifications/rules", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/notifications/rules/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/deliveries${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/deliveries/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/mail-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/mail-logs/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/mail-logs/${id}/retry`, ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/notifications/platform/channel-settings", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload) as NotificationChannelSetting[];
}

export async function updatePlatformNotificationChannelSetting(
  token: string,
  channel: string,
  data: AdminRecord,
) {
  const payload = await adminRequest(
    `/api/notifications/platform/channel-settings/${encodeURIComponent(channel)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/platform/mail-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/platform/mail-logs/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/notifications/platform/mail-logs/${id}/retry`, ApiResponseSchema,
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
  const payload = await adminRequest(`/api/employees${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/employees/import/${encodeURIComponent(batchId)}/preview`, ApiResponseSchema,
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
  const payload = await adminRequest("/api/employees/import/confirm", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/employees/import/history${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(`/api/departments${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/branches${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/positions${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest("/api/employee-grades", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function getEmployeeGrade(token: string, id: string | number) {
  const payload = await adminRequest(`/api/employee-grades/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createEmployeeGrade(token: string, data: AdminRecord) {
  return adminRequest("/api/employee-grades", ApiResponseSchema, {
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
  return adminRequest(`/api/employee-grades/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteEmployeeGrade(token: string, id: string | number) {
  return adminRequest(`/api/employee-grades/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function getEmployeeNumbering(token: string) {
  const payload = await adminRequest("/api/employee-numbering", ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function updateEmployeeNumbering(
  token: string,
  data: AdminRecord,
) {
  const payload = await adminRequest("/api/employee-numbering", ApiResponseSchema, {
    method: "PUT",
    token,
    body: data,
  });
  return normalizeSingle(payload);
}

export async function listCostCenters(token: string) {
  const payload = await adminRequest("/api/cost-centers", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function getCostCenter(token: string, id: string | number) {
  const payload = await adminRequest(`/api/cost-centers/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createCostCenter(token: string, data: AdminRecord) {
  return adminRequest("/api/cost-centers", ApiResponseSchema, {
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
  return adminRequest(`/api/cost-centers/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteCostCenter(token: string, id: string | number) {
  return adminRequest(`/api/cost-centers/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/leave/types${query}`, ApiResponseSchema, {
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

export async function listLeaveRequests(
  token: string,
  params: LeaveRequestsQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveRequestsQuery(params);
  const payload = await adminRequest(`/api/leave/requests${query}`, ApiResponseSchema, {
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

export async function listLeaveBalances(
  token: string,
  params: LeaveBalancesQueryParams = {},
  options: ListRequestOptions = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildLeaveBalancesQuery(params);
  const payload = await adminRequest(`/api/leave/balances${query}`, ApiResponseSchema, {
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
      break;
    }
  }

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
  const payload = await adminRequest(`/api/leave/holidays${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/leave/policies${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/leave/workflows${query}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/onboarding/workflows${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/onboarding/requests${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/workflows${query}`, ApiResponseSchema,
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

  const payload = await adminRequest(path, ApiResponseSchema, { token });
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
  const payload = await adminRequest(`${path}${query}`, ApiResponseSchema, { token });
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
    const payload = await adminRequest(
      "/api/attendance/config/policies", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/attendance/config/policies/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/attendance/daily-summaries${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/attendance/daily-summaries/${employeeId}/${date}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/attendance/daily-summaries/${employeeId}/${encodeURIComponent(date)}/adjustment`, ApiResponseSchema,
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
  return adminRequest(
    `/api/attendance/daily-summaries/${employeeId}/${encodeURIComponent(date)}/adjustment`, ApiResponseSchema,
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
  return adminRequest("/api/attendance/processing/jobs/run-pending", ApiResponseSchema, {
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
  return adminRequest("/api/attendance/daily-summaries/refresh", ApiResponseSchema, {
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
  return adminRequest("/api/attendance/processing/run-range", ApiResponseSchema, {
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
  return adminRequest(`/api/attendance/processing/exceptions/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/attendance/business-trips${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/attendance/business-trips/${id}`, ApiResponseSchema,
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
  return adminRequest("/api/attendance/business-trips", ApiResponseSchema, {
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
  return adminRequest(`/api/attendance/business-trips/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: buildAttendanceBusinessTripPayload(data),
  });
}

export async function submitAttendanceBusinessTrip(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/attendance/business-trips/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function approveAttendanceBusinessTrip(
  token: string,
  id: string | number,
  note?: string,
) {
  return adminRequest(`/api/attendance/business-trips/${id}/approve`, ApiResponseSchema, {
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
  return adminRequest(`/api/attendance/business-trips/${id}/reject`, ApiResponseSchema, {
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
  return adminRequest(`/api/attendance/business-trips/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

export async function createAttendanceMobilePunchCheckIn(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/attendance/mobile-punches/check-in", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createAttendanceMobilePunchCheckOut(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/attendance/mobile-punches/check-out", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function approveAttendanceMobilePunchOverride(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(
    `/api/attendance/mobile-punches/${id}/approve-override`, ApiResponseSchema,
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
  return adminRequest(
    `/api/attendance/mobile-punches/${id}/reject-override`, ApiResponseSchema,
    {
      method: "PATCH",
      token,
      body: data,
    },
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
  const payload = await adminRequest(`${path}${query}`, ApiResponseSchema, { token });
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
  const payload = await adminRequest(
    `${attendanceResourcePath(resource)}/${id}`, ApiResponseSchema,
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
  return adminRequest(attendanceResourcePath(resource), ApiResponseSchema, {
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
  return adminRequest(`${attendanceResourcePath(resource)}/${id}`, ApiResponseSchema, {
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
  return adminRequest(`${attendanceResourcePath(resource)}/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function syncAttendanceDevice(token: string, id: string | number) {
  return adminRequest(`/api/attendance/devices/${id}/sync`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function getAttendanceDeviceSyncStatus(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/attendance/devices/${id}/sync-status`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function testAttendanceDeviceConnection(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/attendance/devices/${id}/test-connection`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/attendance-devices/${id}/sync-status`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncAccessControlDeviceDoors(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/access-control/doors/sync-from-device/${id}`, ApiResponseSchema,
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
  return adminRequest(`/api/access-control/doors/${id}/${command}`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function getAccessControlDoorDeviceConfig(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/access-control/doors/${id}/device-config`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncAccessControlDoorToDevice(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/access-control/doors/${id}/sync-to-device`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/schedule-templates/sync-from-device/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/schedule-templates${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/schedule-templates/${id}`, ApiResponseSchema,
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
  return adminRequest("/api/access-control/schedule-templates", ApiResponseSchema, {
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
  return adminRequest(`/api/access-control/schedule-templates/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/access-control/schedule-templates/${id}`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/access-control/schedule-templates/${id}/sync-to-device`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/week-plans/${id}/sync-to-device`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/sync-fingerprints`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/sync-users`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/hikvision/attendance/logs${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listHikvisionDeviceAttendanceLogs(
  token: string,
  deviceId: string | number,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/logs${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getHikvisionAttendanceCapabilities(
  token: string,
  deviceId: string | number,
) {
  const payload = await adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/capabilities`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHikvisionAttendanceSyncStatus(
  token: string,
  deviceId: string | number,
) {
  const payload = await adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/sync/status`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listHikvisionAttendanceSyncHistory(
  token: string,
  deviceId: string | number,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/sync-history${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function syncHikvisionAttendance(
  token: string,
  deviceId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/sync`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/sync-date`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/sync-employee`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/sync-range`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hikvision/devices/${deviceId}/attendance/pull-page`, ApiResponseSchema,
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
  return adminRequest(`/api/hikvision/devices/${deviceId}/manage`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getHikvisionSyncJob(
  token: string,
  jobId: string | number,
) {
  const payload = await adminRequest(
    `/api/hikvision/sync-jobs/${jobId}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncAccessControlDeviceWeekPlans(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/access-control/week-plans/sync-from-device/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/access-credentials${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/access-credentials/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getAccessCredentialDeviceActionRoutes(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/access-control/access-credentials/${id}/device-action-routes`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/access-credentials/${id}/${action}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/employees/${employeeId}/access-credentials${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/audit-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/audit-logs/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/device-command-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/device-command-logs/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/devices/${deviceId}/audit-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/devices/${deviceId}/command-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/employees/${employeeId}/audit-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/hikvision-sync-logs${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/hikvision-sync-logs/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function activateAttendancePolicy(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/attendance/config/policies/${id}/activate`, ApiResponseSchema,
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
  return adminRequest(`/api/attendance/geofences/${id}/activate`, ApiResponseSchema, {
    method: "PATCH",
    token,
  });
}

export async function deactivateAttendanceGeofence(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/attendance/geofences/${id}/deactivate`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/attendance/geofences/${id}/validate-location`, ApiResponseSchema,
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
  return adminRequest(`/api/attendance/wifi-networks/${id}/activate`, ApiResponseSchema, {
    method: "PATCH",
    token,
  });
}

export async function deactivateAttendanceWifiNetwork(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/attendance/wifi-networks/${id}/deactivate`, ApiResponseSchema,
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
  return adminRequest(`/api/attendance/wifi-networks/${id}/validate`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/employee-positions${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/employee-movements${query}`, ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getEmployeeMovement(token: string, id: string | number) {
  const payload = await adminRequest(`/api/employee-movements/${id}`, ApiResponseSchema, {
    token,
  });
  // The movement nests snapshots and the employee; keep the root record.
  return unwrapRootRecord(payload, "id");
}

export async function listEmployeeMovementOperations(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/employee-movements/${id}/operations`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createEmployeeMovement(token: string, data: AdminRecord) {
  return adminRequest("/api/employee-movements", ApiResponseSchema, {
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
  return adminRequest(`/api/employee-movements/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/employee-movements/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function submitEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/employee-movements/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function cancelEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/employee-movements/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function approveEmployeeMovement(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(`/api/employee-movements/${id}/approve`, ApiResponseSchema, {
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
  return adminRequest(`/api/employee-movements/${id}/reject`, ApiResponseSchema, {
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
  return adminRequest(`/api/employee-movements/${id}/return`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function applyEmployeeMovement(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/employee-movements/${id}/apply`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function retryEmployeeMovementOperation(
  token: string,
  id: string | number,
  operationId: string | number,
) {
  return adminRequest(
    `/api/employee-movements/${id}/operations/${operationId}/retry`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
}

export async function getEmployeePosition(token: string, id: string | number) {
  const payload = await adminRequest(`/api/employee-positions/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createEmployeePosition(token: string, data: AdminRecord) {
  return adminRequest("/api/employee-positions", ApiResponseSchema, {
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
  return adminRequest(`/api/employee-positions/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteEmployeePosition(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/employee-positions/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `${shiftResourcePath(resource)}/${id}`, ApiResponseSchema,
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
    adminRequest(
      `${shiftResourcePath("shift-assignments")}?${query}`, ApiResponseSchema,
      { token },
    ),
    adminRequest(
      `${timetableResourcePath("employee-timetables")}?${query}`, ApiResponseSchema,
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
  return adminRequest(shiftResourcePath(resource), ApiResponseSchema, {
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
  return adminRequest(`${shiftResourcePath(resource)}/${id}`, ApiResponseSchema, {
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
  return adminRequest(`${shiftResourcePath(resource)}/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `${timetableResourcePath(resource)}/${id}`, ApiResponseSchema,
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
  return adminRequest(timetableResourcePath(resource), ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function patchTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`${timetableResourcePath(resource)}/${id}`, ApiResponseSchema, {
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
  return adminRequest(`${timetableResourcePath(resource)}/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `${accessControlResourcePath(resource)}/${id}`, ApiResponseSchema,
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
  return adminRequest(accessControlResourcePath(resource), ApiResponseSchema, {
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
  return adminRequest(`${accessControlResourcePath(resource)}/${id}`, ApiResponseSchema, {
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
  return adminRequest(`${accessControlResourcePath(resource)}/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function listAccessGroupDoors(
  token: string,
  groupId: string | number,
) {
  const payload = await adminRequest(
    `/api/access-control/groups/${groupId}/doors`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/groups/${groupId}/devices`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/groups/${groupId}/devices`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/groups/${groupId}/devices/${deviceId}`, ApiResponseSchema,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function syncAccessGroup(token: string, groupId: string | number) {
  return adminRequest(`/api/access-control/groups/${groupId}/sync`, ApiResponseSchema, {
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
  return adminRequest(`/api/access-control/groups/${groupId}/doors`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/access-control/groups/${groupId}/doors/${doorId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/groups/${groupId}/employees`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/groups/${groupId}/employees`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/organizations/${organizationId}/employees`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/organizations/${organizationId}/employees`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/organizations/${organizationId}/employees/${employeeId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/organizations/${organizationId}/sync-to-device`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/organizations/sync-from-device/${deviceId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/groups/${groupId}/employees/${employeeId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/employees/${employeeId}/devices`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/password`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/password`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/capture`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints`, ApiResponseSchema,
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

  const payload = await adminRequest(
    `/api/access-control/attendance-devices/employee-device-assignment-matches?${query.toString()}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/sync`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/resync`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/disable`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/enable`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}`, ApiResponseSchema,
    { method: "PATCH", token, body: data },
  );
}

export async function deleteEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
) {
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}`, ApiResponseSchema,
    { method: "DELETE", token },
  );
}

export async function enableEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
) {
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}/enable`, ApiResponseSchema,
    { method: "PATCH", token },
  );
}

export async function disableEmployeeDeviceCard(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  cardId: string | number,
) {
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}/disable`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/cards/${cardId}/sync`, ApiResponseSchema,
    { method: "POST", token, body: data },
  );
}

export async function enableEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
) {
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/enable`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/disable`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/remove-door-permission`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/register`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/resync`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/access-control/doors/sync-from-device/${deviceId}`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
}

export async function createDepartment(token: string, data: AdminRecord) {
  return adminRequest("/api/departments", ApiResponseSchema, {
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
  return adminRequest(`/api/departments/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteDepartment(token: string, id: string | number) {
  return adminRequest(`/api/departments/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function listDepartmentAccess(token: string, id: string | number) {
  const payload = await adminRequest(`/api/departments/${id}/access`, ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function grantDepartmentAccess(
  token: string,
  departmentId: string | number,
  userId: string | number,
) {
  return adminRequest(
    `/api/departments/${departmentId}/access/${userId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/departments/${departmentId}/access/${userId}`, ApiResponseSchema,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function createBranch(token: string, data: AdminRecord) {
  return adminRequest("/api/branches", ApiResponseSchema, {
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
  return adminRequest(`/api/branches/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteBranch(token: string, id: string | number) {
  return adminRequest(`/api/branches/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function listBranchAccess(token: string, id: string | number) {
  const payload = await adminRequest(`/api/branches/${id}/access`, ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function grantBranchAccess(
  token: string,
  branchId: string | number,
  userId: string | number,
) {
  return adminRequest(`/api/branches/${branchId}/access/${userId}`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function revokeBranchAccess(
  token: string,
  branchId: string | number,
  userId: string | number,
) {
  return adminRequest(`/api/branches/${branchId}/access/${userId}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createPosition(token: string, data: AdminRecord) {
  return adminRequest("/api/positions", ApiResponseSchema, {
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
  return adminRequest(`/api/positions/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deletePosition(token: string, id: string | number) {
  return adminRequest(`/api/positions/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createLeaveType(token: string, data: AdminRecord) {
  return adminRequest("/api/leave/types", ApiResponseSchema, {
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
  return adminRequest(`/api/leave/types/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeaveType(token: string, id: string | number) {
  return adminRequest(`/api/leave/types/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createLeaveRequest(token: string, data: AdminRecord) {
  return adminRequest("/api/leave/requests", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export type LeaveImportRowResult = {
  row: number;
  employee_no: string;
  leave_type_code: string;
  status: "created" | "failed";
  leave_request_id?: number | null;
  leave_no?: string | null;
  message?: string;
};

export type LeaveImportResult = {
  total: number;
  created: number;
  failed: number;
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
  | "VALID"
  | "WARNING"
  | "INVALID"
  | "NO_CHANGE";

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

export type LeaveBalanceImportFacet = { id: number; name: string; code?: string };

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

function toLeaveBalanceImportPage<S extends z.ZodType>(
  payload: unknown,
  rowSchema: S,
  fallbackPage: number,
  fallbackLimit: number,
): LeaveBalanceImportPage<z.output<S>> {
  const record = asRecord(payload);
  const meta = asRecord(record?.meta);
  const rows = z.array(rowSchema).parse(record?.data);
  const total = Number(meta?.totalItems ?? rows.length);
  const limit = Number(meta?.itemsPerPage ?? fallbackLimit) || fallbackLimit;
  return {
    rows,
    page: Number(meta?.currentPage ?? fallbackPage) || fallbackPage,
    limit,
    total: Number.isFinite(total) ? total : rows.length,
    totalPages: Math.max(1, Number(meta?.totalPages ?? Math.ceil(total / limit)) || 1),
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

  if (!response.ok || !(isBinaryContentType(contentType) || isZipOrXlsxMagic(new Uint8Array(buffer)))) {
    const payload = parseResponseBodyText(new TextDecoder().decode(buffer), contentType);
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
    const error = new Error(extractMessage(payload, response.status)) as Error & {
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
  return LeaveBalanceImportBatchDetailSchema.parse(payload);
}

export async function getLeaveBalanceImport(
  token: string,
  batchId: string,
): Promise<LeaveBalanceImportBatchDetail> {
  return adminRequest(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}`, LeaveBalanceImportBatchDetailSchema,
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
  const payload = await adminRequest(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/rows${buildLeaveBalanceImportQuery({
      ...params,
      page,
      limit,
      status: params.status === "ALL" ? undefined : params.status,
    })}`, LeaveBalanceImportRowsPageSchema,
    { token },
  );
  return toLeaveBalanceImportPage(payload, LeaveBalanceImportRowSchema, page, limit);
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
  return adminRequest(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/confirm`, LeaveBalanceImportBatchDetailSchema,
    { method: "POST", token, body: data },
  );
}

export async function cancelLeaveBalanceImport(
  token: string,
  batchId: string,
): Promise<LeaveBalanceImportBatchDetail> {
  return adminRequest(
    `/api/leave/balances/import/${encodeURIComponent(batchId)}/cancel`, LeaveBalanceImportBatchDetailSchema,
    { method: "POST", token },
  );
}

export async function listLeaveBalanceImportHistory(
  token: string,
  params: { page?: number; limit?: number; status?: LeaveBalanceImportBatchStatus } = {},
): Promise<LeaveBalanceImportPage<LeaveBalanceImportBatch>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const payload = await adminRequest(
    `/api/leave/balances/import/history${buildLeaveBalanceImportQuery({ ...params, page, limit })}`, LeaveBalanceImportBatchesPageSchema,
    { token },
  );
  return toLeaveBalanceImportPage(payload, LeaveBalanceImportBatchSchema, page, limit);
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

export async function importLeaveRequests(
  token: string,
  file: File,
): Promise<LeaveImportResult> {
  const body = new FormData();
  body.set("file", file, file.name || "leave-import.xlsx");
  const response = await fetch(buildUrl("/api/leave/requests/import"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    cache: "no-store",
  });
  const text = await response.text();
  const payload = parseResponseBodyText(
    text,
    response.headers.get("content-type"),
  );
  if (!response.ok) throw new Error(extractMessage(payload, response.status));
  return payload as LeaveImportResult;
}

export async function createMyLeaveRequest(token: string, data: AdminRecord) {
  return adminRequest("/api/me/leave/requests", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listMyNotificationPreferences(token: string) {
  const payload = await adminRequest(
    "/api/me/notifications/preferences", ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/me/notifications/preferences", ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return (normalizeSingle(payload) as NotificationPreference | null) ?? null;
}

export async function listMyMovements(token: string) {
  const payload = await adminRequest("/api/me/movements", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function getMyMovement(token: string, id: string | number) {
  const payload = await adminRequest(`/api/me/movements/${id}`, ApiResponseSchema, {
    token,
  });
  return unwrapRootRecord(payload, "id");
}

export async function acknowledgeMyMovement(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/movements/${id}/acknowledge`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function listMyActionItems(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/me/action-items${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyRequests(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/me/requests${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyDocuments(token: string) {
  const payload = await adminRequest("/api/me/documents", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function uploadMyDocument(token: string, data: AdminRecord) {
  return adminRequest("/api/me/documents", ApiResponseSchema, {
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
  return adminRequest("/api/me/resignation", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/me/profile-change-requests${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createMyProfileChangeRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/profile-change-requests", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function validateMyProfileChangeRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/profile-change-requests/validate", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/me/profile-change-requests/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeProfileChangeRequestDetail(payload);
}

export async function updateMyProfileChangeRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/me/profile-change-requests/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/profile-change-requests/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function submitMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/profile-change-requests/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function cancelMyProfileChangeRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/profile-change-requests/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function listMyProfileChangeRequestHistory(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/me/profile-change-requests/${id}/history`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/hr/profile-change-requests${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getHrProfileChangeRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/hr/profile-change-requests/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeProfileChangeRequestDetail(payload);
}

export async function startHrProfileChangeReview(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(
    `/api/hr/profile-change-requests/${id}/start-review`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hr/profile-change-requests/${id}/approve`, ApiResponseSchema,
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
  return adminRequest(`/api/hr/profile-change-requests/${id}/reject`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/hr/profile-change-requests/${id}/request-correction`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/hr/profile-change-requests/${id}/history`, ApiResponseSchema,
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
  const payload = await adminRequest("/api/me/payslips", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function getMyPayslip(token: string, id: string | number) {
  const payload = await adminRequest(`/api/me/payslips/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/me/leave/requests${query}`, ApiResponseSchema,
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

export async function getMyLeaveRequest(token: string, id: string | number) {
  const payload = await adminRequest(`/api/me/leave/requests/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeLeaveRequestDetail(payload);
}

export async function submitMyLeaveRequest(token: string, id: string | number) {
  return adminRequest(`/api/me/leave/requests/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function cancelMyLeaveRequest(
  token: string,
  id: string | number,
  reason: string,
) {
  return adminRequest(`/api/me/leave/requests/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function getMyLeaveRequestPdf(token: string, id: string | number) {
  return adminRequest(`/api/me/leave/requests/${id}/pdf`, ApiResponseSchema, { token });
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
  const payload = await adminRequest(`/api/leave/requests/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeLeaveRequestDetail(payload);
}

export async function leaveRequestApprovalAction(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/leave/requests/${id}/approval-action`, ApiResponseSchema, {
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
  return adminRequest(`/api/leave/requests/${id}/cancel`, ApiResponseSchema, {
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
  return adminRequest("/api/leave/balances/adjust", ApiResponseSchema, {
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
  return adminRequest("/api/leave/balances/generate", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function carryForwardLeaveBalances(
  token: string,
  data: AdminRecord = {},
) {
  return adminRequest("/api/leave/balances/carry-forward", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listLeaveBalanceAdjustments(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/leave/balances/adjustments${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listLeaveBalanceTransactions(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/leave/balances/transactions${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function submitLeaveRequest(token: string, id: string | number) {
  return adminRequest(`/api/leave/requests/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function resubmitLeaveRequest(token: string, id: string | number) {
  return adminRequest(`/api/leave/requests/${id}/resubmit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function createLeaveHoliday(token: string, data: AdminRecord) {
  return adminRequest("/api/leave/holidays", ApiResponseSchema, {
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
  return adminRequest(`/api/leave/holidays/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeaveHoliday(token: string, id: string | number) {
  return adminRequest(`/api/leave/holidays/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createLeavePolicy(token: string, data: AdminRecord) {
  return adminRequest("/api/leave/policies", ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/leave/policies/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/leave/policies/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeavePolicy(token: string, id: string | number) {
  return adminRequest(`/api/leave/policies/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createLeaveWorkflow(token: string, data: AdminRecord) {
  return adminRequest("/api/leave/workflows", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getLeaveWorkflow(token: string, id: string | number) {
  const payload = await adminRequest(`/api/leave/workflows/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function patchLeaveWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/leave/workflows/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteLeaveWorkflow(token: string, id: string | number) {
  return adminRequest(`/api/leave/workflows/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function listLeaveWorkflowSteps(
  token: string,
  workflowId: string | number,
) {
  const payload = await adminRequest(
    `/api/leave/workflows/${workflowId}/steps`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/leave/workflows/${workflowId}/steps`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/leave/workflows/${workflowId}/steps/${stepId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/leave/workflows/${workflowId}/steps/${stepId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/leave/requests/${leaveRequestId}/documents`, ApiResponseSchema,
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
  return adminRequest(
    `/api/leave/requests/${leaveRequestId}/medical-detail`, ApiResponseSchema,
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
  return adminRequest("/api/onboarding/workflows", ApiResponseSchema, {
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
  return adminRequest(`/api/onboarding/workflows/${id}/clone`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getOnboardingWorkflow(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/onboarding/workflows/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/onboarding/workflows/${workflowId}/steps`, ApiResponseSchema,
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
  return adminRequest(`/api/onboarding/workflows/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteOnboardingWorkflow(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/onboarding/workflows/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  data: OnboardingWorkflowStepPayload | AdminRecord,
) {
  return adminRequest(
    `/api/onboarding/workflows/${workflowId}/steps`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/workflows/${workflowId}/steps/${stepId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/workflows/${workflowId}/steps/${stepId}`, ApiResponseSchema,
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
  return adminRequest("/api/onboarding/requests", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/onboarding/requests/${id}`, ApiResponseSchema,
    { token },
  );
  return unwrapOnboardingRequest(payload);
}

export async function patchOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/onboarding/requests/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/onboarding/requests/${id}/approve`, ApiResponseSchema, {
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
  return adminRequest(`/api/onboarding/requests/${id}/reject`, ApiResponseSchema, {
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
  return adminRequest(`/api/onboarding/requests/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function completeOnboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/onboarding/requests/${id}/complete`, ApiResponseSchema, {
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
  return adminRequest(`/api/onboarding/requests/${id}/submit`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/onboarding/requests/${id}/employee-details/submit`, ApiResponseSchema,
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
) {
  return adminRequest(
    `/api/onboarding/requests/${id}/employee-details/review`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: { sections },
    },
  );
}

export async function reactivateOnboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/onboarding/requests/${id}`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/documents`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listOnboardingDocuments(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest(
    `/api/onboarding/requests/${requestId}/documents`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/documents/${documentId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/documents/${documentId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/documents/${documentId}/verify`, ApiResponseSchema,
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
  return adminRequest(`/api/onboarding/requests/${requestId}/tasks`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listOnboardingTasks(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest(
    `/api/onboarding/requests/${requestId}/tasks`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getOnboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
) {
  const payload = await adminRequest(
    `/api/onboarding/requests/${requestId}/tasks/${taskId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/tasks/${taskId}/assign`, ApiResponseSchema,
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/tasks/${taskId}/complete`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function getOnboardingProgress(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest(
    `/api/onboarding/requests/${requestId}/progress`, ApiResponseSchema,
    { token },
  );
  return asRecord(payload) ?? {};
}

export async function getOnboardingAuditLogs(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest(
    `/api/onboarding/requests/${requestId}/audit-logs`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

/** GET /api/me/onboarding — current employee's onboarding requests. */
export async function listMyOnboardingRequests(
  token: string,
): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest("/api/me/onboarding", ApiResponseSchema, {
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
  data: { accepted: boolean; acknowledgement_version: string },
) {
  const version = data.acknowledgement_version.trim();
  if (!version) {
    throw new Error("Acknowledgement version is required.");
  }
  return adminRequest(`/api/onboarding/requests/${id}/acknowledge`, ApiResponseSchema, {
    method: "POST",
    token,
    body: {
      accepted: data.accepted === true,
      acknowledgement_version: version.slice(0, 50),
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
  return adminRequest(
    `/api/onboarding/requests/${requestId}/approvals/${approvalId}/delegate`, ApiResponseSchema,
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
  return adminRequest("/api/offboarding/workflows", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getOffboardingWorkflow(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/offboarding/workflows/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload);
}

export async function patchOffboardingWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/offboarding/workflows/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteOffboardingWorkflow(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/offboarding/workflows/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/offboarding/workflows/${workflowId}/steps`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/workflows/${workflowId}/steps/${stepId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/workflows/${workflowId}/steps/${stepId}`, ApiResponseSchema,
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
  return adminRequest("/api/offboarding/requests", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getOffboardingRequest(
  token: string,
  id: string | number,
) {
  const payload = await adminRequest(
    `/api/offboarding/requests/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload);
}

export async function patchOffboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/offboarding/requests/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/offboarding/requests/${id}/submit`, ApiResponseSchema, {
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
  return adminRequest(`/api/offboarding/requests/${id}/approve`, ApiResponseSchema, {
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
  return adminRequest(`/api/offboarding/requests/${id}/reject`, ApiResponseSchema, {
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
  return adminRequest(`/api/offboarding/requests/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function completeOffboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/offboarding/requests/${id}/complete`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function finalizeOffboardingRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/offboarding/requests/${id}/finalize`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function addOffboardingDocument(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/offboarding/requests/${requestId}/documents`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/documents`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/documents/${documentId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/documents/${documentId}`, ApiResponseSchema,
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
  return adminRequest(`/api/offboarding/requests/${requestId}/tasks`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/complete`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/reject`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/clearances`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/clearances/${clearanceId}/complete`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/clearances/${clearanceId}/assign`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/progress`, ApiResponseSchema,
    { token },
  );
  return asRecord(payload) ?? {};
}

export async function getOffboardingApprovals(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/approvals`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getOffboardingAuditLogs(
  token: string,
  requestId: string | number,
) {
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/audit-logs`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getOffboardingDashboard(token: string) {
  const payload = await adminRequest("/api/offboarding/dashboard", ApiResponseSchema, {
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
    const payload = await adminRequest("/api/me/offboarding", ApiResponseSchema, {
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
    const payload = await adminRequest(
      "/api/offboarding/approvals/my", ApiResponseSchema,
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
    const payload = await adminRequest("/api/offboarding/tasks/my", ApiResponseSchema, {
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
    const payload = await adminRequest(
      "/api/offboarding/clearances/my", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/actions`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createOffboardingAction(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/offboarding/requests/${requestId}/actions`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/actions/${actionId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/assets`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createOffboardingAsset(
  token: string,
  requestId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/offboarding/requests/${requestId}/assets`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/assets/${assetReturnId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/settlements`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/letters`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/access-operations`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/settlements`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/offboarding/requests/${requestId}/exit-interview`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/exit-interview`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/reopen`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/access-termination/emergency`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/access-termination/retry`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/approvals/${approvalId}/delegate`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/settlements/${itemId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/offboarding/requests/${requestId}/tasks/${taskId}/reassign`, ApiResponseSchema,
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
  return adminRequest(
    `/api/finance/employee-finance/offboarding/${offboardingRequestId}/recoveries`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
}

export async function getCurrentAdmin(token: string) {
  const payload = await adminRequest("/api/users/me", ApiResponseSchema, {
    token,
    cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
  });
  return normalizeSingle(payload);
}

export async function getCurrentAdminProfile(token: string) {
  const payload = await adminRequest("/api/users/me", ApiResponseSchema, { token });
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
  const payload = await adminRequest("/api/companies/my", ApiResponseSchema, { token });
  return extractCompanyRecord(payload);
}

/** Companies the authenticated user may enter with POST /api/auth/switch-company. */
export async function listMyCompanies(token: string) {
  const payload = await adminRequest("/api/companies/my", ApiResponseSchema, {
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
  const payload = await adminRequest("/api/companies", ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/companies/${id}`, ApiResponseSchema, {
    token,
  });
  return extractCompanyRecord(payload) ?? normalizeSingle(payload);
}

export async function createCompany(token: string, data: AdminRecord) {
  return adminRequest("/api/companies", ApiResponseSchema, {
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
  return adminRequest(`/api/companies/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/companies/${id}/modules`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/companies/${id}/modules`, ApiResponseSchema, {
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
  return adminRequest(`/api/companies/${id}/activate`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function suspendCompany(token: string, id: string | number) {
  return adminRequest(`/api/companies/${id}/suspend`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function getCurrentCompanyOnboardingStatus(token: string) {
  const payload = await adminRequest(
    "/api/companies/current/onboarding-status", ApiResponseSchema,
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
  return adminRequest(RESOURCE_PATHS[resource], ApiResponseSchema, {
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
  const payload = await adminRequest("/api/employees", ApiResponseSchema, {
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
  return adminRequest("/api/employees/me", ApiResponseSchema, {
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
  const payload = await adminRequest("/api/employee-invitations", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
  return normalizeSingle(payload) as EmployeeInvitationResponse;
}

export async function listPendingEmployeeInvitations(token: string) {
  const payload = await adminRequest("/api/employee-invitations", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload) as EmployeeInvitationResponse[];
}

export async function resendEmployeeInvitation(
  token: string,
  invitationId: string | number,
) {
  const payload = await adminRequest(
    `/api/employee-invitations/${invitationId}/resend`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) as EmployeeInvitationResponse;
}

export async function getPublicEmployeeInvitation(token: string) {
  const payload = await adminRequest(
    `/api/employee-invitations/accept/${encodeURIComponent(token)}`, ApiResponseSchema,
    {
      dedupe: false,
    },
  );
  return normalizeSingle(payload) as unknown as PublicEmployeeInvitation;
}

export async function acceptEmployeeInvitation(
  token: string,
  password: string,
) {
  const payload = await adminRequest(
    `/api/employee-invitations/accept/${encodeURIComponent(token)}`, ApiResponseSchema,
    {
      method: "POST",
      body: { password },
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
  const payload = await adminRequest(
    `/api/recruitment/offers/preview?token=${encodeURIComponent(token)}`, ApiResponseSchema,
    { dedupe: false },
  );
  return normalizeSingle(payload) as PublicRecruitmentOffer;
}

export async function acceptPublicRecruitmentOffer(token: string) {
  const payload = await adminRequest(`/api/recruitment/offers/accept`, ApiResponseSchema, {
    method: 'POST',
    body: { token },
    dedupe: false,
  });
  return normalizeSingle(payload) as { status: string; candidate_id: number };
}

export async function listRecruitmentRequests(token: string) {
  return normalizeList(await adminRequest('/api/recruitment/requests', ApiResponseSchema, { token }))
}

export async function listRecruitmentCandidates(token: string, requestId: number) {
  return normalizeList(await adminRequest(`/api/recruitment/requests/${requestId}/candidates`, ApiResponseSchema, { token }))
}

export async function recruitmentCommand(
  token: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const payload = await adminRequest(`/api/recruitment/${path}`, ApiResponseSchema, {
    method: 'POST', token, body: body ?? {}, dedupe: false,
  })
  return normalizeSingle(payload) as AdminRecord
}

export async function listEmploymentContracts(token: string, employeeId: number) {
  return normalizeList(await adminRequest(
    `/api/employment-contracts/employees/${employeeId}`, ApiResponseSchema, { token },
  ))
}

export async function signEmploymentContract(token: string, contractId: number, signedName: string) {
  const payload = await adminRequest(`/api/employment-contracts/${contractId}/sign`, ApiResponseSchema, {
    method: 'POST', token, body: { signed_name: signedName }, dedupe: false,
  })
  return normalizeSingle(payload)
}

export async function issueEmploymentContract(token: string, body: Record<string, unknown>) {
  return normalizeSingle(await adminRequest('/api/employment-contracts', ApiResponseSchema, {
    method: 'POST', token, body, dedupe: false,
  }))
}

export async function attachEmploymentContract(token: string, contractId: number, file: Record<string, unknown>) {
  return normalizeSingle(await adminRequest(`/api/employment-contracts/${contractId}/document`, ApiResponseSchema, {
    method: 'POST', token, body: file, dedupe: false,
  }))
}

export async function getEmployeeById(id: string | number, token: string) {
  const payload = await adminRequest(`/api/employees/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(`/api/positions/${id}`, ApiResponseSchema, {
    token,
  });
  return findPositionRecordById(payload, id) ?? normalizeSingle(payload);
}

export async function listDepartmentPositions(
  token: string,
  departmentId: string | number,
) {
  const payload = await adminRequest(
    `/api/departments/${departmentId}/positions`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function assignDepartmentPosition(
  token: string,
  departmentId: string | number,
  positionId: string | number,
) {
  return adminRequest(`/api/departments/${departmentId}/positions`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/departments/${departmentId}/positions/${positionId}`, ApiResponseSchema,
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
  return adminRequest(`/api/employees/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function getCurrentEmployee(token: string) {
  const payload = await adminRequest("/api/employees/me", ApiResponseSchema, { token });
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
  const payload = await adminRequest("/api/me/profile", ApiResponseSchema, { token });
  return normalizeSingle(payload);
}

export type DashboardCardStyle = {
  palette: "ocean" | "forest" | "plum" | "coral" | "midnight" | "berry" | "neutral" | "white"
  artwork: "none" | "orbit" | "waves" | "confetti" | "arches" | "sprigs"
}

export async function getMyDashboardCardStyle(token: string) {
  return adminRequest("/api/users/me/dashboard-card-style", DashboardCardStyleSchema, {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  })
}

export async function updateMyDashboardCardStyle(
  token: string,
  style: DashboardCardStyle,
) {
  return adminRequest("/api/users/me/dashboard-card-style", DashboardCardStyleSchema, {
    method: "PATCH",
    token,
    body: style,
  })
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
    const payload = await adminRequest("/api/me/profile/photo", ApiResponseSchema, {
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
        const account = await adminRequest("/api/users/me", ApiResponseSchema, {
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
      const accountResponse = await fetch(buildUrl("/api/users/me/profile-photo"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        cache: "no-store",
      });
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

  const payload = await adminRequest("/api/me/profile/avatar", ApiResponseSchema, {
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
  const payload = await adminRequest(
    "/api/me/profile/avatar-options", ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/users/me/available-avatars", ApiResponseSchema,
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
  const payload = await adminRequest("/api/users/me/avatars", ApiResponseSchema, {
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
  return adminRequest("/api/users/me/avatar", ApiResponseSchema, {
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
  const payload = await adminRequest("/api/me/status", ApiResponseSchema, { token });
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
  const payload = await adminRequest("/api/me/dashboard", ApiResponseSchema, { token });
  return unwrapEmployeeDashboardPayload(payload);
}

export async function getEmployeeDashboard(token: string) {
  const payload = await adminRequest("/api/dashboards/employee", ApiResponseSchema, {
    token,
  });
  return unwrapEmployeeDashboardPayload(payload);
}

export async function getMyAttendanceAssignments(token: string) {
  const payload = await adminRequest(
    "/api/me/attendance/assignments", ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function createMyAttendanceCheckIn(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/attendance/check-in", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createMyAttendanceCheckOut(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/attendance/check-out", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createMyAttendanceCorrectionRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/attendance/correction-requests", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listMyAttendanceCorrectionRequests(
  token: string,
  params: SelfServiceRequestQueryParams = {},
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1;
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20;
  const query = buildSelfServiceRequestQuery(params);
  const payload = await adminRequest(
    `/api/me/attendance/correction-requests${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/attendance/correction-requests/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload);
}

export async function cancelMyAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(
    `/api/me/attendance/correction-requests/${id}/cancel`, ApiResponseSchema,
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
  return adminRequest(
    `/api/me/attendance/correction-requests/${id}/submit`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/attendance/overview${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/attendance/history${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/attendance/punches${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/attendance/schedule${query}`, ApiResponseSchema,
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
  const payload = await adminRequest("/api/me/attendance/today", ApiResponseSchema, {
    token,
  });
  return normalizeMyAttendanceToday(payload);
}

export async function createMyProfileUpdateRequest(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/profile-update-requests", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/me/profile-update-requests${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/profile-update-requests/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload);
}

export async function cancelMyProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(`/api/me/profile-update-requests/${id}/cancel`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function submitMyProfileUpdateRequest(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/profile-update-requests/${id}/submit`, ApiResponseSchema, {
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
    const payload = await adminRequest(
      `/api/hr/self-service/approvals/profile-updates?${query.toString()}`, ApiResponseSchema,
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
    const payload = await adminRequest(
      `/api/hr/self-service/approvals/profile-updates?${bare.toString()}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/hr/self-service/approvals/profile-updates/${id}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hr/self-service/approvals/profile-updates/${id}/approve`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hr/self-service/approvals/profile-updates/${id}/reject`, ApiResponseSchema,
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

  const payload = await adminRequest(
    `/api/hr/self-service/approvals/attendance-corrections?${query.toString()}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/hr/self-service/approvals/attendance-corrections/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload);
}

export async function approveHrAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(
    `/api/hr/self-service/approvals/attendance-corrections/${id}/approve`, ApiResponseSchema,
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
  return adminRequest(
    `/api/hr/self-service/approvals/attendance-corrections/${id}/reject`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/team/attendance${query}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/companies/current/users${query}`, ApiResponseSchema,
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
  return adminRequest("/api/companies/current/users", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getCurrentCompanyUser(
  token: string,
  userId: string | number,
) {
  const payload = await adminRequest(
    `/api/companies/current/users/${userId}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function deleteCurrentCompanyUser(
  token: string,
  userId: string | number,
) {
  return adminRequest(`/api/companies/current/users/${userId}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function assignRoleToCurrentCompanyUser(
  token: string,
  userId: string | number,
  roleId: string | number,
) {
  return adminRequest(`/api/companies/current/users/${userId}/roles`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/companies/current/users/${userId}/roles/${roleId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/companies/current/users/${userId}/permissions`, ApiResponseSchema,
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
  return adminRequest(
    `/api/companies/current/users/${userId}/permissions/${permissionId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/leave/balances${query}`, ApiResponseSchema,
    { token },
  );
  const rows = normalizeList(payload);
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
  const payload = await adminRequest(`/api/users/${id}`, ApiResponseSchema, { token });
  return normalizeSingle(payload);
}

export async function updateUserById(
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest(`/api/users/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/users/${userId}/reset-password`, ApiResponseSchema, {
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
  return adminRequest(`/api/users/${userId}/avatar`, ApiResponseSchema, {
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
  return adminRequest(`/api/users/${userId}/two-factor/enable`, ApiResponseSchema, {
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
  return adminRequest(`/api/users/${userId}/two-factor/disable`, ApiResponseSchema, {
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
  return adminRequest(`/api/users/${userId}/two-factor/force`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    "/api/users/2fa/backup-codes/regenerate", ApiResponseSchema,
    {
      method: "POST",
      token,
      body: { token: code },
    },
  );
  return extractBackupCodes(payload);
}

export async function deleteUserById(id: string | number, token: string) {
  return adminRequest(`/api/users/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function updateCurrentUserProfile(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/users/me", ApiResponseSchema, {
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
  return adminRequest("/api/users/me/change-password", ApiResponseSchema, {
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
  return adminRequest(`/api/users/${userId}/roles/${roleId}`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function revokeRoleFromUser(
  token: string,
  userId: string | number,
  roleId: string | number,
) {
  return adminRequest(`/api/users/${userId}/roles/${roleId}`, ApiResponseSchema, {
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
  return adminRequest(`${RESOURCE_PATHS[resource]}/${id}`, ApiResponseSchema, {
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
  return adminRequest(`${RESOURCE_PATHS[resource]}/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function getRoleById(id: string | number, token: string) {
  const payload = await adminRequest(`/api/roles/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/roles/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteRoleById(id: string | number, token: string) {
  return adminRequest(`/api/roles/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/roles/${roleId}/permissions${query}`, ApiResponseSchema,
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
  return adminRequest(`/api/roles/${roleId}/permissions`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/roles/${roleId}/permissions/${permissionId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/roles/${roleId}/users${query}`, ApiResponseSchema,
    {
      token,
    },
  );
  let rows = normalizeList(payload);
  if (rows.length === 0 && query) {
    const retry = await adminRequest(`/api/roles/${roleId}/users`, ApiResponseSchema, {
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
  return adminRequest(`/api/roles/${roleId}/users`, ApiResponseSchema, {
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
  return adminRequest(`/api/roles/${roleId}/users/${userId}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createPermission(token: string, data: AdminRecord) {
  return adminRequest("/api/permissions", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getPermissionById(id: string | number, token: string) {
  const payload = await adminRequest(`/api/permissions/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function updatePermissionById(
  id: string | number,
  token: string,
  data: AdminRecord,
) {
  return adminRequest(`/api/permissions/${id}`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/employees/${employeeId}/${section}/${itemId}`, ApiResponseSchema,
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
  return adminRequest(`/api/employees/${employeeId}/${section}`, ApiResponseSchema, {
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
  return adminRequest(`/api/employees/me/${section}`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

/** Self-onboarding: attaches a document to the caller's own employee profile. */
export async function createMyEmployeeDocument(token: string, data: AdminRecord) {
  return adminRequest(`/api/employees/me/documents`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/employees/${employeeId}/${section}/${itemId}`, ApiResponseSchema,
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
    ["resigned", "terminated", "retired", "exited"].includes(normalizedStatus)
  ) {
    const trimmedExitDate =
      typeof data.exit_date === "string" ? data.exit_date.trim() : "";
    const trimmedExitReason =
      typeof data.exit_reason === "string" ? data.exit_reason.trim() : "";
    normalizedPayload.exit_date = trimmedExitDate || undefined;
    normalizedPayload.exit_reason = trimmedExitReason || undefined;
  }

  return adminRequest(`/api/employees/${employeeId}/status`, ApiResponseSchema, {
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
  return adminRequest(`/api/employees/${employeeId}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function unlinkEmployeeCompanyUser(
  token: string,
  employeeId: string | number,
) {
  return adminRequest(`/api/employees/${employeeId}/company-user`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function removeEmployeeLinkedAccount(
  token: string,
  employeeId: string | number,
) {
  return adminRequest(
    `/api/employees/${employeeId}/company-user/account`, ApiResponseSchema,
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

  return adminRequest(`/api/employees/${employeeId}/assignment`, ApiResponseSchema, {
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
  return adminRequest(`/api/employees/${employeeId}/documents`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/employees/${employeeId}/documents/${documentId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `${path}${buildScheduledReportingQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/scheduled-reporting/report-definitions", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/scheduled-reporting/templates/${id}`, ApiResponseSchema,
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
  return adminRequest("/api/scheduled-reporting/templates", ApiResponseSchema, {
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
  return adminRequest(`/api/scheduled-reporting/templates/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteScheduledReportTemplate(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/scheduled-reporting/templates/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/scheduled-reporting/schedules/${id}`, ApiResponseSchema,
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
  return adminRequest("/api/scheduled-reporting/schedules", ApiResponseSchema, {
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
  return adminRequest(`/api/scheduled-reporting/schedules/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteScheduledReportSchedule(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/scheduled-reporting/schedules/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/scheduled-reporting/executions/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/scheduled-reporting/executions/${id}/retry`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/scheduled-reporting/templates/${id}/run`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/scheduled-reporting/smtp-configurations/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeScheduledReportingRecord(payload);
}

export async function createScheduledReportSmtpConfiguration(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/scheduled-reporting/smtp-configurations", ApiResponseSchema, {
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
  return adminRequest(
    `/api/scheduled-reporting/smtp-configurations/${id}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/scheduled-reporting/smtp-configurations/${id}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/scheduled-reporting/smtp-configurations/${id}/test`, ApiResponseSchema,
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
  return adminRequest(
    "/api/scheduled-reporting/smtp-configurations/test-system", ApiResponseSchema,
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
  return adminRequest(
    "/api/scheduled-reporting/smtp-configurations/test-draft", ApiResponseSchema,
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
  const payload = await adminRequest(
    `${path}${buildPayrollQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/payroll/reports/dashboard", ApiResponseSchema,
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
  return adminRequest(
    `/api/payroll/reports/final-settlements/${offboardingRequestId}/calculate`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
}

export async function runPayrollReconciliation(token: string) {
  return adminRequest("/api/payroll/reports/reconciliation/run", ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function runPayrollRunVariance(
  token: string,
  runId: string | number,
  comparisonRunId: string | number,
) {
  return adminRequest(
    `/api/payroll/reports/runs/${runId}/variance?comparison_run_id=${encodeURIComponent(String(comparisonRunId))}`, ApiResponseSchema,
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
  const payload = await adminRequest(`/api/payroll/runs/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload);
}

export async function createPayrollRun(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/runs", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function processPayrollRun(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/payroll/runs/${id}/process`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function approvePayrollRun(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  const payload = await adminRequest(
    `/api/payroll/runs/${id}/approve`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function lockPayrollRun(token: string, id: string | number) {
  const payload = await adminRequest(`/api/payroll/runs/${id}/lock`, ApiResponseSchema, {
    method: "POST",
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function validatePayrollRun(token: string, id: string | number) {
  return adminRequest(`/api/payroll/runs/${id}/validation`, ApiResponseSchema, {
    token,
  });
}

export async function markPayrollRunPaid(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/payroll/runs/${id}/mark-paid`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function closePayrollRun(token: string, id: string | number) {
  const payload = await adminRequest(`/api/payroll/runs/${id}/close`, ApiResponseSchema, {
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
  return adminRequest("/api/payroll/inputs", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createPayrollAdjustment(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/payroll/inputs/adjustments", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function approvePayrollInput(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/payroll/inputs/${id}/approve`, ApiResponseSchema,
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
  return adminRequest("/api/payroll/sources", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createPayrollSourcesBatch(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/payroll/sources/batch", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function generatePayrollSources(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/sources/generate", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function importPayrollSources(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/sources/import", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function approvePayrollSource(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/payroll/sources/${id}/approve`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function rejectPayrollSource(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/payroll/sources/${id}/reject`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function postPayrollSource(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/payroll/sources/${id}/post`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPayrollOvertimeApprovals(
  token: string,
) {
  return listPayrollCollection(
    "/api/payroll/overtime-requests/payroll",
    token,
    { page: 1, limit: 100 },
  );
}

export async function listMyOvertimeRequests(token: string) {
  const payload = await adminRequest("/api/payroll/overtime-requests/me", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function createMyOvertimeRequest(
  token: string,
  data: { work_date: string; requested_minutes: number; reason: string },
) {
  const payload = await adminRequest(
    "/api/payroll/overtime-requests/me", ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerOvertimeRequests(token: string) {
  const payload = await adminRequest("/api/payroll/overtime-requests/manager", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function listHrOvertimeRequests(token: string) {
  const payload = await adminRequest("/api/payroll/overtime-requests/hr", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function decideOvertimeRequest(
  token: string,
  stage: "manager" | "hr",
  id: string | number,
  decision: "approve" | "reject",
  comments?: string,
) {
  const payload = await adminRequest(
    `/api/payroll/overtime-requests/${stage}/${id}/${decision}`, ApiResponseSchema,
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
  return adminRequest("/api/payroll/employees/profiles", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollPeriods(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/periods", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function generatePayrollPeriod(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/configuration/periods/generate", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollComponents(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/components", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollComponent(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/configuration/components", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollCalendars(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/calendars", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollCalendar(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/configuration/calendars", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollSalaryStructures(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/salary-structures", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/configuration/salary-structures/${id}`, ApiResponseSchema,
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
  return adminRequest("/api/payroll/configuration/salary-structures", ApiResponseSchema, {
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
  return adminRequest(
    `/api/payroll/configuration/salary-structures/${id}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/payroll/configuration/salary-structures/${id}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/payroll/configuration/salary-structures/${id}/activate`, ApiResponseSchema,
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
  return adminRequest(
    `/api/payroll/configuration/salary-structures/${id}/retire`, ApiResponseSchema,
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
  return adminRequest(
    `/api/payroll/configuration/salary-structures/${id}/versions`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/configuration/salary-structures/${id}/employees`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/employees/${employeeId}/salary`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/employees/${employeeId}/salary`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
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
  const payload = await adminRequest(
    "/api/payroll/configuration/statutory-schemes", ApiResponseSchema,
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
  return adminRequest("/api/payroll/configuration/statutory-schemes", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createPayrollStatutoryRule(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/payroll/configuration/statutory-rules", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollAccountingMappings(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/accounting-mappings", ApiResponseSchema,
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
  return adminRequest(
    "/api/payroll/configuration/accounting-mappings", ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPayrollGroupAssignments(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/group-assignments", ApiResponseSchema,
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
  return adminRequest("/api/payroll/configuration/group-assignments", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollLeaveRules(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/leave-rules", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollLeaveRule(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/configuration/leave-rules", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollPayslipsForRun(
  token: string,
  runId: string | number,
) {
  const payload = await adminRequest(
    `/api/payroll/payslips/runs/${runId}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/payslips/runs/${runId}/generate`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/banking/runs/${runId}/batches`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
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
  const payload = await adminRequest(
    `/api/payroll/accounting/runs/${runId}/journals`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
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
  const payload = await adminRequest(
    `/api/payroll/accounting/journals/${batchId}/post`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/accounting/journals/${batchId}/reverse`, ApiResponseSchema,
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
  return adminRequest(`/api/payroll/banking/runs/${runId}/reconcile`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function importPayrollBankStatement(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/payroll/banking/imports", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollReportCatalog(token: string) {
  const payload = await adminRequest("/api/payroll/reports/catalog", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function getPayrollIntegrationCatalog(token: string) {
  const payload = await adminRequest(
    "/api/payroll/reports/integrations/catalog", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getPayrollNotificationCatalog(token: string) {
  const payload = await adminRequest(
    "/api/payroll/reports/notifications/catalog", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function getPayrollReadiness(token: string) {
  const payload = await adminRequest(
    "/api/payroll/reports/readiness", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/payroll/reports/${encodeURIComponent(code)}${buildPayrollQuery(params)}`, ApiResponseSchema,
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
  return adminRequest(`/api/me/payslips/summary/current${suffix}`, ApiResponseSchema, {
    token,
  });
}

function buildStatusQuery(status?: string) {
  const value = status?.trim();
  return value ? `?status=${encodeURIComponent(value)}` : "";
}

export async function getPerformanceDashboard(token: string) {
  const payload = await adminRequest(
    "/api/performance/dashboard/summary", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPerformanceFinancialYears(token: string) {
  const payload = await adminRequest(
    "/api/performance/financial-years", ApiResponseSchema,
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
  return adminRequest("/api/performance/financial-years", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function generatePerformancePeriods(
  token: string,
  yearId: string | number,
) {
  return adminRequest(
    `/api/performance/financial-years/${yearId}/generate-periods`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function calculatePerformanceAggregates(
  token: string,
  yearId: string | number,
  periodType: string,
) {
  return adminRequest(
    `/api/performance/financial-years/${yearId}/aggregates`, ApiResponseSchema,
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
  const payload = await adminRequest("/api/performance/periods", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformancePeriod(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/periods", ApiResponseSchema, {
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
  return adminRequest(`/api/performance/periods/${periodId}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function activatePerformancePeriod(
  token: string,
  periodId: string | number,
) {
  return adminRequest(
    `/api/performance/periods/${periodId}/activate`, ApiResponseSchema,
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
  return adminRequest(`/api/performance/periods/${periodId}/close`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function reopenPerformancePeriod(
  token: string,
  periodId: string | number,
  reason: string,
) {
  return adminRequest(`/api/performance/periods/${periodId}/reopen`, ApiResponseSchema, {
    method: "POST",
    token,
    body: { reason },
  });
}

export async function createPerformancePeriodAssignments(
  token: string,
  periodId: string | number,
) {
  return adminRequest(
    `/api/performance/periods/${periodId}/assignments`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/periods/${periodId}/sync-system-kpis`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: providerKey ? { provider_key: providerKey } : {},
    },
  );
}

export async function listPerformanceKpis(token: string) {
  const payload = await adminRequest("/api/performance/kpis", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceKpi(token: string, data: AdminRecord) {
  return adminRequest("/api/performance/kpis", ApiResponseSchema, {
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
  return adminRequest(`/api/performance/kpis/${kpiId}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deletePerformanceKpi(
  token: string,
  kpiId: string | number,
) {
  return adminRequest(`/api/performance/kpis/${kpiId}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createPerformanceKpiVersion(
  token: string,
  kpiId: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/performance/kpis/${kpiId}/versions`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceKpiTemplates(token: string) {
  const payload = await adminRequest(
    "/api/performance/kpi-templates", ApiResponseSchema,
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
  return adminRequest("/api/performance/kpi-templates", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function applyPerformanceKpiTemplate(token: string, periodId: string, templateId: string, conflictPolicy: 'MERGE' | 'SKIP' | 'REPLACE') {
  return adminRequest(`/api/performance/periods/${periodId}/apply-kpi-template`, ApiResponseSchema, { method: 'POST', token, body: { template_id: Number(templateId), conflict_policy: conflictPolicy } });
}

export async function listPerformanceKpiRules(token: string) {
  const payload = await adminRequest("/api/performance/kpi-rules", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceKpiRule(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/kpi-rules", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceCompetencyTemplates(token: string) {
  const payload = await adminRequest(
    "/api/performance/competency-templates", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createPerformanceCompetencyTemplate(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/competency-templates", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceRatingScales(token: string) {
  const payload = await adminRequest(
    "/api/performance/rating-scales", ApiResponseSchema,
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
  return adminRequest("/api/performance/rating-scales", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceScorecards(token: string) {
  const payload = await adminRequest("/api/performance/scorecards", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceScorecard(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/scorecards", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceWorkflows(token: string) {
  const payload = await adminRequest("/api/performance/workflows", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformanceWorkflow(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/workflows", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getPerformanceReviewWorkflow(
  token: string,
  reviewId: string | number,
) {
  const payload = await adminRequest(
    `/api/performance/reviews/${reviewId}/workflow`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function actionPerformanceReviewWorkflow(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/performance/reviews/${reviewId}/workflow/action`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPayrollGroups(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/groups", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function createPayrollGroup(token: string, data: AdminRecord) {
  return adminRequest("/api/payroll/configuration/groups", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollOvertimePolicies(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/overtime-policies", ApiResponseSchema,
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
  return adminRequest("/api/payroll/configuration/overtime-policies", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPayrollBonusSchemes(token: string) {
  const payload = await adminRequest(
    "/api/payroll/configuration/bonus-schemes", ApiResponseSchema,
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
  return adminRequest("/api/payroll/configuration/bonus-schemes", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformancePlans(token: string) {
  const payload = await adminRequest("/api/performance/plans", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createPerformancePlan(token: string, data: AdminRecord) {
  return adminRequest("/api/performance/plans", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function generatePerformancePlanFromRules(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/plans/generate-from-rules", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listPerformanceImprovementPlans(token: string) {
  const payload = await adminRequest(
    "/api/performance/improvement-plans", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listPerformanceDevelopmentPlans(token: string) {
  const payload = await adminRequest(
    "/api/performance/development-plans", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createPerformanceDevelopmentPlan(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/performance/development-plans", ApiResponseSchema, {
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
  return adminRequest(`/api/performance/development-goals/${goalId}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function carryForwardPerformanceDevelopmentGoals(
  token: string,
  data: AdminRecord,
) {
  return adminRequest(
    "/api/performance/development-plans/carry-forward", ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listPerformanceReportCatalog(token: string) {
  const payload = await adminRequest(
    "/api/performance/reports/catalog", ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/performance/calibration/departments", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getPerformanceCalibrationComparison(token: string) {
  const payload = await adminRequest(
    "/api/performance/calibration/comparison", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createPerformanceImprovementPlan(
  token: string,
  reviewId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/performance/reviews/${reviewId}/improvement-plan`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/improvement-plans/${planId}/close`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function reviewPerformanceImprovementMilestone(
  token: string,
  milestoneId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/performance/improvement-milestones/${milestoneId}/review`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/reviews/${reviewId}/moderate`, ApiResponseSchema,
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
  return adminRequest(`/api/performance/reviews/${reviewId}/reopen`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/performance/reviews/${periodAssignmentId}/approve`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/reviews/${reviewId}/feedback-360/invitations`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/performance/reviews/${reviewId}/feedback-360`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getPerformanceFeedback360Summary(
  token: string,
  reviewId: string | number,
) {
  const payload = await adminRequest(
    `/api/performance/reviews/${reviewId}/feedback-360/summary`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listPerformanceAppeals(token: string) {
  const payload = await adminRequest("/api/performance/appeals", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function getMyPerformanceSummary(token: string) {
  const payload = await adminRequest("/api/performance/me/summary", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/performance/me/kpis${buildEmployeeKpiQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listKpiCycleReviews(token: string, mode: 'self' | 'manager', periodId?: string) {
  const payload = await adminRequest(`/api/performance/${mode === 'self' ? 'me' : 'manager'}/kpi-reviews${periodId ? `?period_id=${encodeURIComponent(periodId)}` : ''}`, ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function listMyKpiCycleScores(token: string) {
  const payload = await adminRequest('/api/performance/me/kpi-scores', ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function submitKpiCycleRating(token: string, mode: 'self' | 'manager', kpiId: string, kind: 'MID' | 'FINAL', rating: number, comment: string) {
  return adminRequest(`/api/performance/${mode === 'self' ? 'me' : 'manager'}/kpis/${kpiId}/reviews/${kind}/${mode === 'self' ? 'self' : 'manager'}`, ApiResponseSchema, { method: 'POST', token, body: { rating, comment } });
}

export async function respondToKpiMidReview(token: string, kpiId: string, decision: 'ACKNOWLEDGE' | 'DISPUTE', comment: string) {
  return adminRequest(`/api/performance/me/kpis/${kpiId}/reviews/mid/respond`, ApiResponseSchema, { method: 'POST', token, body: { decision, comment } });
}

export async function finalizeKpiCycleReview(token: string, kpiId: string, comment: string) {
  return adminRequest(`/api/performance/manager/kpis/${kpiId}/reviews/final/finalize`, ApiResponseSchema, { method: 'POST', token, body: { comment } });
}

export async function createMyEmployeeKpi(token: string, data: AdminRecord) {
  return adminRequest("/api/performance/me/kpis", ApiResponseSchema, {
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
  return adminRequest(`/api/performance/me/kpis/${kpiId}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteMyEmployeeKpi(
  token: string,
  kpiId: string | number,
) {
  return adminRequest(`/api/performance/me/kpis/${kpiId}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function submitMyEmployeeKpis(
  token: string,
  periodId: string | number,
) {
  return adminRequest(
    `/api/performance/me/kpis/periods/${periodId}/submit`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function updateMyEmployeeKpiActual(
  token: string,
  kpiId: string | number,
  actualValue: number,
) {
  return adminRequest(`/api/performance/me/kpis/${kpiId}/actual`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: { actual_value: actualValue },
  });
}

export async function listManagerEmployeeKpis(
  token: string,
  params: AdminRecord = {},
) {
  const payload = await adminRequest(
    `/api/performance/manager/kpis${buildEmployeeKpiQuery(params)}`, ApiResponseSchema,
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
  return adminRequest("/api/performance/manager/kpis", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerKpiAssignees(token: string) {
  const payload = await adminRequest(
    "/api/performance/manager/kpi-assignees", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function beginManagerEmployeeKpiReview(
  token: string,
  kpiId: string | number,
) {
  return adminRequest(
    `/api/performance/manager/kpis/${kpiId}/begin-review`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function reviewManagerEmployeeKpi(
  token: string,
  kpiId: string | number,
  decision: "APPROVE" | "RETURN" | "REJECT",
  comment?: string,
) {
  return adminRequest(
    `/api/performance/manager/kpis/${kpiId}/review`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: { decision, comment },
    },
  );
}

export async function listMyPerformanceAssignments(token: string) {
  const payload = await adminRequest(
    "/api/performance/me/assignments", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listMyPerformanceAchievements(token: string) {
  const payload = await adminRequest(
    "/api/performance/me/achievements", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function updateMyPerformanceAchievement(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/performance/me/achievements/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listMyPerformanceReviews(token: string) {
  const payload = await adminRequest("/api/performance/me/reviews", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function listMyPerformanceFeedback360(token: string) {
  const payload = await adminRequest(
    "/api/performance/me/feedback-360", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function submitMyPerformanceSelfReview(
  token: string,
  periodAssignmentId: string | number,
  review: AdminRecord,
) {
  return adminRequest(
    `/api/performance/me/reviews/${periodAssignmentId}/self-review`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/me/feedback-360/${requestId}/submit`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/me/feedback-360/${requestId}/decline`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/me/reviews/${reviewId}/appeal`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listMyPerformanceImprovementPlans(token: string) {
  const payload = await adminRequest(
    "/api/performance/me/improvement-plans", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyPerformanceDevelopmentPlans(token: string) {
  const payload = await adminRequest(
    "/api/performance/me/development-plans", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function updateMyPerformanceDevelopmentGoal(
  token: string,
  goalId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/performance/me/development-goals/${goalId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/me/improvement-plans/${planId}/acknowledge`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function getManagerPerformanceSummary(token: string) {
  const payload = await adminRequest(
    "/api/performance/manager/summary", ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerTeamAchievements(token: string) {
  const payload = await adminRequest(
    "/api/performance/manager/team-achievements", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createManagerActivityTask(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/manager/activities/tasks", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerActivityCategories(token: string) {
  const payload = await adminRequest(
    "/api/manager/activities/categories", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function validateManagerAchievement(
  token: string,
  achievementId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/performance/manager/achievements/${achievementId}/validate`, ApiResponseSchema,
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
  return adminRequest(
    `/api/performance/manager/reviews/${periodAssignmentId}/submit`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function getProbationDashboard(token: string) {
  const payload = await adminRequest(
    "/api/probation/dashboard/summary", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listProbationPolicies(token: string, status?: string) {
  const payload = await adminRequest(
    `/api/probation/policies${buildStatusQuery(status)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createProbationPolicy(token: string, data: AdminRecord) {
  return adminRequest("/api/probation/policies", ApiResponseSchema, {
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
  return adminRequest(`/api/probation/policies/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deleteProbationPolicy(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/probation/policies/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function listProbationCases(token: string, status?: string) {
  const payload = await adminRequest(
    `/api/probation/cases${buildStatusQuery(status)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyTeamProbationCases(token: string, status?: string) {
  const payload = await adminRequest(
    `/api/probation/cases/my-team${buildStatusQuery(status)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getProbationCase(token: string, id: string | number) {
  const payload = await adminRequest(`/api/probation/cases/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function deleteProbationCase(token: string, id: string | number) {
  return adminRequest(`/api/probation/cases/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export async function createProbationCase(token: string, data: AdminRecord) {
  return adminRequest("/api/probation/cases", ApiResponseSchema, {
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
  return adminRequest(`/api/probation/cases/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/probation/cases/${caseId}/objectives`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/probation/cases/${caseId}/manager-review`, ApiResponseSchema,
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
  return adminRequest(`/api/probation/cases/${caseId}/hr-decision`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/probation/cases/${caseId}/generate-letter`, ApiResponseSchema,
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
  return adminRequest(
    `/api/employee-movements/${movementId}/generate-letter`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: { letter_type: letterType },
    },
  );
}

export async function getMyProbation(token: string, signal?: AbortSignal) {
  const payload = await adminRequest("/api/me/probation", ApiResponseSchema, {
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
  return adminRequest(`/api/me/probation/${caseId}/self-assessment`, ApiResponseSchema, {
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
  const payload = await adminRequest("/api/field-parties", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function createFieldParty(token: string, data: AdminRecord) {
  return adminRequest("/api/field-parties", ApiResponseSchema, {
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
  return adminRequest(`/api/field-parties/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listHrFieldVisits(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/hr/field-visits${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

// The backend requires a purpose for every location-map view (it is written to the access log).
export async function getHrFieldVisitsMap(
  token: string,
  purpose = "HR field visit oversight",
) {
  const payload = await adminRequest(
    `/api/hr/field-visits/map${buildRecordQuery({ purpose })}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listHrFieldLocationAccessLogs(token: string) {
  const payload = await adminRequest(
    "/api/hr/field-locations/access-logs", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/hr/activities${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listHrActivityExceptions(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/hr/activity-exceptions${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listActivityCategories(token: string) {
  const payload = await adminRequest("/api/activity-categories", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createActivityCategory(token: string, data: AdminRecord) {
  return adminRequest("/api/activity-categories", ApiResponseSchema, {
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
  return adminRequest(`/api/activity-categories/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function deactivateActivityCategory(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/activity-categories/${id}/deactivate`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function listActivityPolicies(token: string) {
  const payload = await adminRequest("/api/activity-policies", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createActivityPolicy(token: string, data: AdminRecord) {
  return adminRequest("/api/activity-policies", ApiResponseSchema, {
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
  return adminRequest(`/api/activity-policies/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function getManagerFieldVisitDashboard(token: string) {
  const payload = await adminRequest(
    "/api/manager/field-visits/dashboard", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerFieldVisits(token: string) {
  const payload = await adminRequest("/api/manager/field-visits", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function getManagerFieldVisit(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/manager/field-visits/${id}`, ApiResponseSchema,
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
  return adminRequest(`/api/manager/field-visits/${id}/review`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerFieldVisitPlans(token: string) {
  const payload = await adminRequest(
    "/api/manager/field-visits/plans", ApiResponseSchema,
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
  return adminRequest(`/api/manager/field-visits/plans/${id}/review`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getManagerFieldVisitMap(
  token: string,
  purpose = "Manager team field visit review",
) {
  const payload = await adminRequest(
    `/api/manager/field-visits/map/view${buildRecordQuery({ purpose })}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getManagerFieldVisitExceptions(token: string) {
  const payload = await adminRequest(
    "/api/manager/field-visits/exceptions/summary", ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerFieldFollowUps(token: string) {
  const payload = await adminRequest(
    "/api/manager/field-visits/follow-ups", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/field-visits${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getMyFieldVisit(token: string, id: string | number) {
  const payload = await adminRequest(`/api/me/field-visits/${id}`, ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyFieldVisitPlans(token: string) {
  const payload = await adminRequest("/api/me/field-visits/plans", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createMyFieldVisitPlan(token: string, data: AdminRecord) {
  return adminRequest("/api/me/field-visits/plans", ApiResponseSchema, {
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
  return adminRequest(`/api/me/field-visits/plans/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function createMyUnplannedFieldVisit(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/field-visits/unplanned", ApiResponseSchema, {
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
  return adminRequest(`/api/me/field-visits/${id}/check-in`, ApiResponseSchema, {
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
  return adminRequest(`/api/me/field-visits/${id}/check-out`, ApiResponseSchema, {
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
  return adminRequest(`/api/me/field-visits/${id}/expenses`, ApiResponseSchema, {
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
  return adminRequest(`/api/me/field-visits/${id}/opportunities`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listMyFieldFollowUps(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/me/field-visits/follow-ups/list${buildRecordQuery(params)}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/me/field-visits/follow-ups/${id}/complete`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function createMyFieldFollowUp(token: string, data: AdminRecord) {
  return adminRequest("/api/me/field-visits/follow-ups", ApiResponseSchema, {
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
  return adminRequest(`/api/me/field-visits/follow-ups/${id}`, ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function cancelMyFieldFollowUp(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/field-visits/follow-ups/${id}`, ApiResponseSchema, {
    method: "DELETE",
    token,
  });
}

export const listMyFieldVisitFollowUps = listMyFieldFollowUps;
export const completeMyFieldVisitFollowUp = completeMyFieldFollowUp;

export async function syncMyFieldWork(token: string, data: AdminRecord) {
  return adminRequest("/api/me/field-sync", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyFieldSync(
  token: string,
  syncRequestId: string | number,
) {
  const payload = await adminRequest(
    `/api/me/field-sync/${syncRequestId}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function syncMyFieldVisits(token: string, data: AdminRecord) {
  return adminRequest("/api/me/field-visits/sync", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyFieldVisitSync(
  token: string,
  syncRequestId: string | number,
) {
  const payload = await adminRequest(
    `/api/me/field-visits/sync/${syncRequestId}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function addMyFieldVisitEvidence(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/me/field-visits/${id}/evidence`, ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function listManagerFieldPlannedVsActual(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/manager/field-visits/planned-vs-actual${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceDashboard(token: string) {
  const payload = await adminRequest(
    "/api/employee-finance/reports/dashboard", ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getEmployeeFinanceReport(
  token: string,
  reportType: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/employee-finance/reports/${encodeURIComponent(reportType)}${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listEmployeeFinanceAuditTimeline(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/employee-finance/reports/audit${buildRecordQuery(params)}`, ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listEmployeeFinanceProducts(token: string) {
  const payload = await adminRequest(
    "/api/employee-finance/products", ApiResponseSchema,
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
  return adminRequest("/api/employee-finance/products", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function evaluateEmployeeFinanceEligibility(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/employee-finance/products/eligibility", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function evaluateMyFinanceEligibility(
  token: string,
  data: AdminRecord,
) {
  const payload = await adminRequest("/api/me/finance/eligibility", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/employee-finance/applications${buildRecordQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/employee-finance/applications/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function approveEmployeeFinanceApplication(
  token: string,
  id: string | number,
  data: AdminRecord = {},
) {
  return adminRequest(
    `/api/finance/employee-finance/applications/${id}/approve`, ApiResponseSchema,
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
  return adminRequest(`/api/hr/finance/applications/${id}/approve`, ApiResponseSchema, {
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
  return adminRequest(
    `/api/manager/finance/applications/${id}/recommend`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/finance/employee-finance/accounts${buildRecordQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/finance/employee-finance/accounts/${accountId}/statement`, ApiResponseSchema,
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
  return adminRequest("/api/finance/employee-finance/disbursements", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function approveEmployeeFinanceDisbursement(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/finance/employee-finance/disbursements/${id}/approve`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function confirmEmployeeFinanceDisbursement(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/finance/employee-finance/disbursements/${id}/confirm`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function createEmployeeFinanceRepayment(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/finance/employee-finance/repayments", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function approveEmployeeFinanceRepayment(
  token: string,
  id: string | number,
) {
  return adminRequest(
    `/api/finance/employee-finance/repayments/${id}/approve`, ApiResponseSchema,
    { method: "POST", token },
  );
}

export async function requestEmployeeFinanceDeferment(
  token: string,
  accountId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/finance/employee-finance/accounts/${accountId}/deferments`, ApiResponseSchema,
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
  return adminRequest(
    `/api/finance/employee-finance/accounts/${accountId}/reschedules`, ApiResponseSchema,
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
  return adminRequest(
    `/api/finance/employee-finance/accounts/${accountId}/settlement-quotes`, ApiResponseSchema,
    {
      method: "POST",
      token,
    },
  );
}

export async function runEmployeeFinanceReconciliation(token: string) {
  return adminRequest("/api/employee-finance/reconciliation/run", ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function listEmployeeFinanceApplicationDocuments(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest(
    `/api/employee-finance/applications/${applicationId}/documents`, ApiResponseSchema,
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
  return adminRequest(
    `/api/employee-finance/applications/${applicationId}/documents/${documentId}/verify`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/employee-finance/applications/${applicationId}/guarantors`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/employee-finance/applications/${applicationId}/sanction-letter`, ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyFinanceApplications(token: string) {
  const payload = await adminRequest("/api/me/finance/applications", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function createMyFinanceApplication(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/me/finance/applications", ApiResponseSchema, {
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
  return adminRequest(
    `/api/me/finance/applications/${applicationId}/documents`, ApiResponseSchema,
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
  return adminRequest(
    `/api/me/finance/applications/${applicationId}/documents/upload`, ApiResponseSchema,
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
  return adminRequest(
    "/api/finance/employee-finance/payments/import", ApiResponseSchema,
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
  return adminRequest(
    "/api/finance/employee-finance/accounting/post", ApiResponseSchema,
    {
      method: "POST",
      token,
      body: data,
    },
  );
}

export async function listEmployeeFinanceReportCatalog(token: string) {
  const payload = await adminRequest(
    "/api/employee-finance/reports/catalog", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeList(payload);
}

export async function listEmployeeFinanceNotificationCatalog(token: string) {
  const payload = await adminRequest(
    "/api/employee-finance/reports/notifications/catalog", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getEmployeeFinanceReadiness(token: string) {
  const payload = await adminRequest(
    "/api/employee-finance/reports/readiness", ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listMyFinanceApplicationDocuments(
  token: string,
  applicationId: string | number,
) {
  const payload = await adminRequest(
    `/api/me/finance/applications/${applicationId}/documents`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function addMyFinanceApplicationGuarantor(
  token: string,
  applicationId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/me/finance/applications/${applicationId}/guarantors`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/me/finance/applications/${applicationId}/guarantors`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listMyFinanceGuarantorRequests(token: string) {
  const payload = await adminRequest(
    "/api/me/finance/guarantor-requests", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function decideMyFinanceGuarantorRequest(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/me/finance/guarantor-requests/${id}/decide`, ApiResponseSchema,
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
  return adminRequest(`/api/me/finance/applications/${id}/submit`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function acceptMyFinanceApplication(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/finance/applications/${id}/accept`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function withdrawMyFinanceApplication(
  token: string,
  id: string | number,
) {
  return adminRequest(`/api/me/finance/applications/${id}/withdraw`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function getMyFinanceAccountStatement(
  token: string,
  accountId: string | number,
) {
  const payload = await adminRequest(
    `/api/me/finance/accounts/${accountId}/statement`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
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
  const payload = await adminRequest(
    `/api/me/activities${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getMyActivitiesToday(token: string) {
  const payload = await adminRequest("/api/me/activities/today", ApiResponseSchema, {
    token,
  });
  return normalizeActivityReport(payload);
}

export async function listMyActivityTasks(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/me/activities/tasks${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function createMyActivityTask(token: string, data: AdminRecord) {
  return adminRequest("/api/me/activities/tasks", ApiResponseSchema, {
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
  return adminRequest(
    `/api/me/activities/entries/${entryId}/comments`, ApiResponseSchema,
    {
      method: "POST",
      token,
      body: { body },
    },
  );
}

export async function createMyActivityReport(token: string, data: AdminRecord) {
  return adminRequest("/api/me/activities/reports", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getMyActivityReport(token: string, id: string | number) {
  const payload = await adminRequest(
    `/api/me/activities/reports/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeActivityReport(payload);
}

export async function addMyActivityEntry(
  token: string,
  reportId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/me/activities/reports/${reportId}/entries`, ApiResponseSchema,
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
  return adminRequest(
    `/api/me/activities/reports/${reportId}/entries/${entryId}`, ApiResponseSchema,
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
  return adminRequest(
    `/api/me/activities/reports/${reportId}/entries/${entryId}`, ApiResponseSchema,
    { method: "DELETE", token },
  );
}

export async function addMyActivityEvidence(
  token: string,
  entryId: string | number,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/me/activities/entries/${entryId}/evidence`, ApiResponseSchema,
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
  return adminRequest(
    `/api/me/activities/reports/${reportId}/submit`, ApiResponseSchema,
    { method: "POST", token, body: data },
  );
}

export async function getManagerActivitiesDashboard(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/manager/activities/dashboard${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerPendingActivityReviews(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/manager/activities/pending-reviews${buildRecordQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/manager/activities/team${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listManagerActivityTasks(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/manager/activities/tasks${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listManagerActivityAssignees(token: string) {
  const payload = await adminRequest(
    "/api/manager/activities/assignees", ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function addManagerActivityComment(
  token: string,
  entryId: string | number,
  body: string,
) {
  return adminRequest(
    `/api/manager/activities/entries/${entryId}/comments`, ApiResponseSchema,
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
  return adminRequest(
    `/api/manager/activities/entries/${entryId}/schedule`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/manager/activities/reports/${id}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function reviewManagerActivityReport(
  token: string,
  id: string | number,
  data: AdminRecord,
) {
  return adminRequest(`/api/manager/activities/reports/${id}/review`, ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/manager/action-items${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function listManagerTeam(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/manager/team${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getManagerTeamMember(
  token: string,
  employeeId: string | number,
) {
  const payload = await adminRequest(
    `/api/manager/team/${employeeId}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listManagerTeamAttendance(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/manager/team/attendance${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getSmsGlobalSetting(token: string) {
  const payload = await adminRequest("/api/sms/global", ApiResponseSchema, { token });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updateSmsGlobalSetting(token: string, data: AdminRecord) {
  return adminRequest("/api/sms/global", ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listSmsLogs(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/sms/logs${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function retrySmsLog(token: string, id: string | number) {
  return adminRequest(`/api/sms/logs/${id}/retry`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function listSmsRegistry(token: string) {
  const payload = await adminRequest("/api/sms/registry", ApiResponseSchema, { token });
  return normalizeList(payload);
}

export async function getSmsRegistryItem(token: string, code: string) {
  const payload = await adminRequest(
    `/api/sms/registry/${encodeURIComponent(code)}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updateSmsRegistryItem(
  token: string,
  code: string,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/sms/registry/${encodeURIComponent(code)}`, ApiResponseSchema,
    {
      method: "PATCH",
      token,
      body: data,
    },
  );
}

export async function sendTestSms(token: string, data: AdminRecord) {
  return adminRequest("/api/sms/test", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getPlatformSmsGlobalSetting(token: string) {
  const payload = await adminRequest("/api/sms/platform/global", ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updatePlatformSmsGlobalSetting(
  token: string,
  data: AdminRecord,
) {
  return adminRequest("/api/sms/platform/global", ApiResponseSchema, {
    method: "PATCH",
    token,
    body: data,
  });
}

export async function listPlatformSmsLogs(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/sms/platform/logs${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function retryPlatformSmsLog(token: string, id: string | number) {
  return adminRequest(`/api/sms/platform/logs/${id}/retry`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

export async function listPlatformSmsRegistry(token: string) {
  const payload = await adminRequest("/api/sms/platform/registry", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function getPlatformSmsRegistryItem(token: string, code: string) {
  const payload = await adminRequest(
    `/api/sms/platform/registry/${encodeURIComponent(code)}`, ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function updatePlatformSmsRegistryItem(
  token: string,
  code: string,
  data: AdminRecord,
) {
  return adminRequest(
    `/api/sms/platform/registry/${encodeURIComponent(code)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/dashboards/${kind}${kind === "employee" ? "" : buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return unwrapRoleDashboardPayload(payload);
}

export async function getSystemHealth(token?: string) {
  const payload = await adminRequest("/api/health", ApiResponseSchema, {
    token: token ?? "",
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getSystemHealthLive(token?: string) {
  const payload = await adminRequest("/api/health/live", ApiResponseSchema, {
    token: token ?? "",
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getSystemHealthReady(token?: string) {
  const payload = await adminRequest("/api/health/ready", ApiResponseSchema, {
    token: token ?? "",
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listSecurityEvents(
  token: string,
  params: Record<string, string | number | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/security-events${buildRecordQuery({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...params,
    })}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function getHrLaunchReadiness(token: string) {
  const payload = await adminRequest("/api/hr/launch-readiness", ApiResponseSchema, {
    token,
  });
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHrLaunchReadinessEmployees(token: string) {
  const payload = await adminRequest(
    "/api/hr/launch-readiness/employees", ApiResponseSchema,
    { token },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function getHrAttendanceSetupStatus(token: string) {
  const payload = await adminRequest(
    "/api/hr/attendance/setup/status", ApiResponseSchema,
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
  return adminRequest("/api/hr/attendance/setup/wizard", ApiResponseSchema, {
    method: "POST",
    token,
    body: data,
  });
}

export async function getHrAttendanceSchedulePreview(
  token: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const payload = await adminRequest(
    `/api/hr/attendance/schedules/preview${buildRecordQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/analytics/dashboards/${kind}${buildAnalyticsQuery(params)}`, ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listAnalyticsDatasets(token: string) {
  const payload = await adminRequest("/api/analytics/datasets", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function listAnalyticsMetrics(token: string) {
  const payload = await adminRequest("/api/analytics/metrics", ApiResponseSchema, {
    token,
  });
  return normalizeList(payload);
}

export async function listAnalyticsSources(token: string) {
  const payload = await adminRequest("/api/analytics/sources", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/analytics/freshness${query}`, ApiResponseSchema,
    {
      token,
    },
  );
  const root = asRecord(payload);
  const value = root && Object.hasOwn(root, "data") ? root.data : payload;
  if (Array.isArray(value)) return normalizeList(payload);
  const single = normalizeSingle(payload);
  return single ? [single] : [];
}

export async function refreshAnalyticsDataset(
  token: string,
  data: AnalyticsRefreshPayload,
) {
  const payload = await adminRequest("/api/analytics/refresh", ApiResponseSchema, {
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
  const payload = await adminRequest("/api/analytics/reports/custom", ApiResponseSchema, {
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
  const payload = await adminRequest(
    "/api/analytics/reports/catalog", ApiResponseSchema,
    {
      token,
    },
  );
  return normalizeSingle(payload) ?? asRecord(payload);
}

export async function listOperationalAnalyticsReports(token: string) {
  const payload = await adminRequest(
    "/api/analytics/reports/operational", ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/analytics/reports/operational/${encodeURIComponent(code)}${buildRecordQuery(params)}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/analytics/reports/saved${buildRecordQuery(params)}`, ApiResponseSchema,
    { token },
  );
  return normalizeList(payload);
}

export async function saveAnalyticsReport(
  token: string,
  data: SaveAnalyticsReportPayload,
) {
  const payload = await adminRequest("/api/analytics/reports/saved", ApiResponseSchema, {
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
  const payload = await adminRequest(
    `/api/analytics/reports/saved/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/analytics/reports/saved/${id}/run`, ApiResponseSchema,
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
  const payload = await adminRequest(
    `/api/analytics/reports/saved/${id}`, ApiResponseSchema,
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
  const payload = await adminRequest("/api/analytics/exports", ApiResponseSchema, {
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
  const payload = await adminRequest(
    "/api/analytics/reconciliation/run", ApiResponseSchema,
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
  const payload = await adminRequest(
    "/api/analytics/statutory-reports/run", ApiResponseSchema,
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
  const payload = await adminRequest(`/api/default-avatars${query}`, ApiResponseSchema, {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  });
  return normalizeList(payload);
}

/** GET /api/default-avatars/{id} */
export async function getDefaultAvatar(token: string, id: string | number) {
  const payload = await adminRequest(`/api/default-avatars/${id}`, ApiResponseSchema, {
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
  const payload = await adminRequest("/api/default-avatars", ApiResponseSchema, {
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

  const payload = await adminRequest(`/api/default-avatars/${id}`, ApiResponseSchema, {
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
  return adminRequest(`/api/default-avatars/${id}/set-default`, ApiResponseSchema, {
    method: "POST",
    token,
  });
}

/** DELETE /api/default-avatars/{id} → 200 */
export async function deleteDefaultAvatar(token: string, id: string | number) {
  return adminRequest(`/api/default-avatars/${id}`, ApiResponseSchema, {
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
export type IdentityAuditSource = "user_update" | "employee_update" | "rollback";

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
  return adminRequest(`/api/identity-audit${buildIdentityAuditQuery(params)}`, IdentityAuditPageSchema, { token });
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
  return adminRequest(
    `/api/identity-audit/${encodeURIComponent(changeSetId)}/rollback`, IdentityRollbackSchema,
    { method: "POST", token, body: { reason: reason || undefined } },
  );
}
```

## [src/hooks/useLocalStorage.ts](/home/innocent/systems/hrms/src/hooks/useLocalStorage.ts)

```typescript
"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  readStorage,
  subscribeStorage,
  writeStorageBatch,
} from "@/lib/local-storage-store";

export function useLocalStorage<S extends z.ZodType>(
  key: string,
  initialValue: z.output<S>,
  schema: S,
) {
  const raw = useSyncExternalStore(
    subscribeStorage,
    useCallback(() => readStorage(key), [key]),
    () => null,
  );
  const value = useMemo(() => {
    if (raw === null) return initialValue;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : initialValue;
    } catch {
      return initialValue;
    }
  }, [raw, schema, initialValue]);
  const updateValue = useCallback(
    (next: z.output<S>) => {
      writeStorageBatch({ [key]: JSON.stringify(schema.parse(next)) });
    },
    [key, schema],
  );
  const removeValue = useCallback(
    () => writeStorageBatch({ [key]: null }),
    [key],
  );
  return [value, updateValue, removeValue] as const;
}
```

## [src/hooks/useAuth.ts](/home/innocent/systems/hrms/src/hooks/useAuth.ts)

```typescript
import { useState, useSyncExternalStore } from "react";
import { ApiError } from "@/services/api";
import { authService } from "@/services/authService";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
  persistAuthUser,
  AuthUserSchema,
} from "@/lib/auth-session-store";
import {
  clearStoredSession,
  persistSessionTokens,
  readStoredSessionTokens,
} from "@/lib/session-client";
import {
  publishDashboardActorSnapshotFromSources,
  requestDashboardAccessRefresh,
} from "@/lib/dashboard-permissions";
import type {
  AuthSessionRecord,
  AuthScope,
  DashboardType,
  AuthTokens,
  AuthUser,
  AuthSwitchCompanyResponse,
  LoginRequest,
  LoginResponse,
  VerifyOtpResponse,
} from "@/types";

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const storedTokens = session.tokens;
  const storedUser = session.user;
  const setStoredUser = persistAuthUser;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSession = () => {
    clearStoredSession();
  };

  const saveSession = (
    tokens: AuthTokens,
    user?: AuthUser,
    dashboardType?: DashboardType,
    scope?: AuthScope,
  ) => {
    const sessionUser =
      user && (dashboardType || scope)
        ? { ...user, dashboardType, scope }
        : user;
    persistSessionTokens(
      tokens.accessToken,
      tokens.refreshToken,
      sessionUser ?? null,
    );
    publishDashboardActorSnapshotFromSources(
      ...(dashboardType ? [{ dashboard_type: dashboardType }] : []),
      ...(scope ? [{ scope }] : []),
      sessionUser ?? null,
      ...(sessionUser?.accessContextResolved
        ? []
        : [tokens, tokens.accessToken]),
    );
    setError(null);
  };

  const login = async (payload: LoginRequest): Promise<LoginResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(payload);

      if (!response.requiresOtp && response.tokens) {
        saveSession(
          response.tokens,
          response.user,
          response.dashboardType,
          response.scope,
        );
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const completeOtpLogin = async (
    tempToken: string,
    code: string,
  ): Promise<VerifyOtpResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyOtp({ tempToken, code });
      saveSession(
        response.tokens,
        response.user,
        response.user.dashboardType,
        response.user.scope,
      );
      return response;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OTP verification failed.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const accessToken = storedTokens?.accessToken;

  const refreshCurrentUser = async () => {
    if (!accessToken) {
      return null;
    }

    setIsLoading(true);

    try {
      const user = await authService.getCurrentUser(accessToken);
      if (readStoredSessionTokens().accessToken !== accessToken) return null;
      setStoredUser(user);
      publishDashboardActorSnapshotFromSources(
        user,
        ...(user.accessContextResolved ? [] : [storedTokens, accessToken]),
      );
      return user;
    } catch (error) {
      if (readStoredSessionTokens().accessToken !== accessToken) return null;
      if (error instanceof ApiError && error.statusCode === 401) clearSession();
      else
        setError(
          error instanceof Error
            ? error.message
            : "Could not refresh your profile.",
        );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    const session = readStoredSessionTokens();
    const previous = getSessionSnapshot();
    const refreshToken = session.refreshToken;
    if (!refreshToken) {
      throw new Error(
        "Your session cannot be refreshed. Please sign in again.",
      );
    }
    const response = await authService.refresh(refreshToken);
    if (getSessionSnapshot().credentialVersion !== previous.credentialVersion)
      throw new DOMException("Session changed during refresh.", "AbortError");
    saveSession(
      response.tokens,
      response.user ?? storedUser ?? undefined,
      response.user?.dashboardType ?? storedUser?.dashboardType,
      response.user?.scope ?? storedUser?.scope,
    );
    requestDashboardAccessRefresh();
    return response;
  };

  const acceptPasswordChangeTokens = (payload: unknown) => {
    const record =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : {};
    const data =
      typeof record.data === "object" && record.data !== null
        ? (record.data as Record<string, unknown>)
        : record;
    const accessToken =
      typeof data.accessToken === "string"
        ? data.accessToken
        : typeof data.access_token === "string"
          ? data.access_token
          : "";
    const refreshToken =
      typeof data.refreshToken === "string"
        ? data.refreshToken
        : typeof data.refresh_token === "string"
          ? data.refresh_token
          : "";
    if (!accessToken || !refreshToken) {
      throw new Error(
        "Password changed, but the server did not return a refreshed session. Please sign in again.",
      );
    }
    const nextTokens = { accessToken, refreshToken };

    const userRecord =
      typeof data.user === "object" && data.user !== null
        ? AuthUserSchema.parse(data.user)
        : storedUser;
    if (userRecord) {
      const nextUser = { ...userRecord, requiresPasswordChange: false };
      persistSessionTokens(accessToken, refreshToken, nextUser);
      publishDashboardActorSnapshotFromSources(
        nextUser,
        nextTokens,
        accessToken,
      );
    } else {
      persistSessionTokens(accessToken, refreshToken, null);
      publishDashboardActorSnapshotFromSources(nextTokens, accessToken);
    }
    requestDashboardAccessRefresh();
    return nextTokens;
  };

  const logout = async () => {
    try {
      const session = readStoredSessionTokens();
      await authService.logout({
        accessToken: storedTokens?.accessToken || session.accessToken,
        refreshToken: storedTokens?.refreshToken || session.refreshToken,
      });
    } finally {
      clearSession();
    }
  };

  const logoutAll = async () => {
    if (!accessToken) {
      clearSession();
      return;
    }
    await authService.logoutAll(accessToken);
    clearSession();
  };

  const listSessions = async (): Promise<AuthSessionRecord[]> => {
    if (!accessToken) {
      return [];
    }
    return authService.listSessions(accessToken);
  };

  const revokeSession = async (sessionId: string) => {
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    await authService.revokeSession(accessToken, sessionId);
  };

  const switchCompany = async (
    companyId: number,
  ): Promise<AuthSwitchCompanyResponse> => {
    if (!accessToken || !storedTokens) {
      throw new Error("Authentication required. Please sign in again.");
    }
    const previous = getSessionSnapshot();
    const response = await authService.switchCompany(accessToken, companyId);
    if (getSessionSnapshot().credentialVersion !== previous.credentialVersion)
      throw new DOMException(
        "Session changed during company switch.",
        "AbortError",
      );
    saveSession(
      {
        accessToken: response.accessToken,
        refreshToken: storedTokens.refreshToken,
      },
      storedUser
        ? {
            ...storedUser,
            companyId: response.companyId ?? storedUser.companyId,
            companyName: response.companyName ?? storedUser.companyName,
            // Dashboard type is company-membership specific. Never retain the
            // previous company's shell while the refreshed /users/me loads.
            dashboardType: response.dashboardType,
            scope: response.scope,
            permissions: undefined,
            accessContextResolved: false,
          }
        : undefined,
      response.dashboardType,
      response.scope,
    );
    requestDashboardAccessRefresh();
    return response;
  };

  const state: AuthState = {
    user: storedUser,
    tokens: storedTokens,
    isAuthenticated: Boolean(accessToken),
    isLoading,
    error,
  };

  return {
    ...state,
    login,
    completeOtpLogin,
    refreshCurrentUser,
    refreshSession,
    acceptPasswordChangeTokens,
    logout,
    logoutAll,
    listSessions,
    revokeSession,
    switchCompany,
    clearSession,
  };
}
```

## [src/lib/dashboard-warm-cache.ts](/home/innocent/systems/hrms/src/lib/dashboard-warm-cache.ts)

```typescript
import { z } from "zod";
import { RecordSchema } from "@/lib/request-json";
import { getSessionSnapshot, subscribeSession } from "@/lib/auth-session-store";
import {
  ADMIN_CACHE_INVALIDATED_EVENT,
  listAttendanceDailySummariesPage,
  listAllEmployees,
  listDepartments,
  listLeaveRequests,
  listOffboardingRequests,
  listOnboardingRequests,
} from "@/lib/admin-api";
import {
  clearDashboardFromLoginFlag,
  isDashboardFromLogin,
  markDashboardFromLogin,
} from "@/lib/dashboard-login-flag";
export {
  clearDashboardFromLoginFlag,
  isDashboardFromLogin,
  markDashboardFromLogin,
};

const WARM_SNAPSHOT_KEY = "hrms.dashboard.warmSnapshot";
const WARM_TTL_MS = 90_000;
const PREFETCH_CACHE_TTL_MS = 30_000;
const Rows = z.array(RecordSchema);
const SnapshotSchema = z.object({
  subject: z.string().min(1),
  companyId: z.number().int().positive(),
  credentialVersion: z.string().min(1),
  savedAt: z.number().finite(),
  fromDate: z.string(),
  toDate: z.string(),
  employees: Rows,
  employeesTotal: z.number().nonnegative().nullable(),
  departments: Rows,
  leaveRequests: Rows,
  attendanceSummaries: Rows,
  onboardingRequests: Rows,
  offboardingRequests: Rows,
});
export type DashboardWarmSnapshot = z.output<typeof SnapshotSchema>;
let warmSnapshotMemory: DashboardWarmSnapshot | null = null;
let warmGeneration = 0;
let observedCredentials = getSessionSnapshot().credentialVersion;
export function resetDashboardWarmCache(): void {
  warmGeneration += 1;
  warmSnapshotMemory = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY);
    } catch {
      /* Memory still clears. */
    }
  }
}
if (typeof window !== "undefined")
  window.addEventListener(
    ADMIN_CACHE_INVALIDATED_EVENT,
    resetDashboardWarmCache,
  );
subscribeSession(() => {
  const version = getSessionSnapshot().credentialVersion;
  if (version !== observedCredentials) {
    observedCredentials = version;
    resetDashboardWarmCache();
  }
});
function isCurrent(snapshot: DashboardWarmSnapshot): boolean {
  const actor = getSessionSnapshot();
  const age = Date.now() - snapshot.savedAt;
  return (
    snapshot.subject === actor.subject &&
    snapshot.companyId === actor.companyId &&
    snapshot.credentialVersion === actor.credentialVersion &&
    age >= 0 &&
    age <= WARM_TTL_MS
  );
}
function date(value: Date) {
  return value.toISOString().slice(0, 10);
}
export async function prefetchDashboardWarmCache(token: string): Promise<void> {
  if (typeof window === "undefined") return;
  const actor = getSessionSnapshot();
  if (!actor.subject || !actor.companyId || actor.tokens?.accessToken !== token)
    return;
  const generation = warmGeneration;
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fromDate = date(from);
  const toDate = date(new Date());
  const options = { cacheTtlMs: PREFETCH_CACHE_TTL_MS };
  // A failed request must not manufacture a ready, empty overview.
  let results;
  try {
    results = await Promise.all([
      listAllEmployees(token, {}, options),
      listDepartments(token, { page: 1, limit: 100 }, options),
      listLeaveRequests(token, {
        page: 1,
        limit: 40,
        from_date: fromDate,
        to_date: toDate,
      }),
      listAttendanceDailySummariesPage(
        token,
        { page: 1, limit: 100, from_date: fromDate, to_date: toDate },
        options,
      ),
      listOnboardingRequests(token, { page: 1, limit: 50 }),
      listOffboardingRequests(token, { page: 1, limit: 50 }),
    ]);
  } catch {
    return;
  }
  if (
    generation !== warmGeneration ||
    getSessionSnapshot().credentialVersion !== actor.credentialVersion
  )
    return;
  const [employees, departments, leave, attendance, onboarding, offboarding] =
    results;
  const snapshot = SnapshotSchema.parse({
    subject: actor.subject,
    companyId: actor.companyId,
    credentialVersion: actor.credentialVersion,
    savedAt: Date.now(),
    fromDate,
    toDate,
    employees,
    employeesTotal: employees.length,
    departments: departments.rows,
    leaveRequests: leave.rows,
    attendanceSummaries: attendance.rows,
    onboardingRequests: onboarding.rows,
    offboardingRequests: offboarding.rows,
  });
  if (!isCurrent(snapshot)) return;
  warmSnapshotMemory = snapshot;
  markDashboardFromLogin();
  try {
    window.sessionStorage.setItem(WARM_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* Memory remains usable. */
  }
}
export function consumeDashboardWarmCache(): DashboardWarmSnapshot | null {
  if (typeof window === "undefined") return null;
  if (warmSnapshotMemory) {
    if (isCurrent(warmSnapshotMemory)) return warmSnapshotMemory;
    resetDashboardWarmCache();
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(WARM_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = SnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !isCurrent(parsed.data)) {
      resetDashboardWarmCache();
      return null;
    }
    warmSnapshotMemory = parsed.data;
    window.sessionStorage.removeItem(WARM_SNAPSHOT_KEY);
    return warmSnapshotMemory;
  } catch {
    resetDashboardWarmCache();
    return null;
  }
}
```

## [src/components/dashboard/finance-self-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/finance-self-view.tsx)

```typescript
"use client";

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator";
import * as React from "react";
import { ApiError } from "@/lib/request-json";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth-session-store";
import {
  FinanceCheckpointSchema,
  FinanceInputSchema,
  resumeFinanceDraft,
  type FinanceCheckpoint,
} from "@/lib/finance-draft-workflow";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2Icon,
  FileTextIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store";

import {
  CompactStatStrip,
  HeroBand,
  StatusChip,
  TalentDoodleSprites,
  actionButtonClass,
  asRecord,
  asRecordArray,
  inputClass,
  optionLabel,
  prettify,
  primaryButtonClass,
  readNumber,
  readString,
  rowId,
  secondaryButtonClass,
  textareaClass,
} from "@/components/dashboard/talent-visuals";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import {
  acceptMyFinanceApplication,
  addMyFinanceApplicationGuarantor,
  createMyFinanceApplication,
  decideMyFinanceGuarantorRequest,
  evaluateMyFinanceEligibility,
  fileToBase64UploadDto,
  listEmployeeFinanceProducts,
  listMyFinanceApplications,
  listMyFinanceApplicationDocuments,
  listMyFinanceApplicationGuarantors,
  listMyFinanceGuarantorRequests,
  submitMyFinanceApplication,
  uploadMyFinanceApplicationDocument,
  withdrawMyFinanceApplication,
  type AdminRecord,
} from "@/lib/admin-api";
import { useLeaveIfForbidden } from "@/hooks/use-forbidden-route-guard";
import { readStoredSessionTokens } from "@/lib/session-client";
import { FluentSelect } from "@/components/ui/fluent-select";
import { ResizableTable, type Column } from "@/components/ui/resizable-table";

function readStoredToken() {
  return readStoredSessionTokens().accessToken.trim();
}

const wizardSteps = ["Product", "Terms", "Support", "Review"];

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function selectedProduct(products: AdminRecord[], productId?: string) {
  if (!productId) return null;
  return products.find((product) => rowId(product) === productId) ?? null;
}

function productRequiredDocuments(product: AdminRecord | null) {
  if (!product) return [];
  return readStringArray(
    product.requiredDocumentTypes ?? product.required_document_types,
  ).map((value) => value.toUpperCase());
}

function productRequiredGuarantors(
  product: AdminRecord | null,
  eligibility: AdminRecord | null,
) {
  const fromEligibility = readNumber(eligibility, [
    "requiredGuarantorCount",
    "required_guarantor_count",
  ]);
  if (fromEligibility !== null) return fromEligibility;
  const approval = asRecord(
    product?.approvalConfiguration ?? product?.approval_configuration,
  );
  return (
    readNumber(approval, [
      "required_guarantor_count",
      "requiredGuarantorCount",
      "guarantor_count",
    ]) ?? 0
  );
}

function recordIdFromPayload(payload: unknown) {
  const direct = asRecord(payload);
  const nested = asRecord(direct?.data);
  return rowId(nested) || rowId(direct);
}

function parseGuarantorIds(value?: string) {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(Number)
    .filter((entry) => Number.isSafeInteger(entry) && entry > 0);
}

function moneyValue(row: AdminRecord | null | undefined, keys: string[]) {
  const value = readString(row, keys, "0.00");
  return value === "0.00" ? "0.00" : value;
}

function eligibilityChecks(eligibility: AdminRecord | null) {
  return asRecordArray(eligibility?.checks);
}

export function FinanceSelfView() {
  const leaveIfForbidden = useLeaveIfForbidden();
  const session = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const [checkpoint, setCheckpoint] = React.useState<FinanceCheckpoint | null>(
    null,
  );
  const checkpointRef = React.useRef<FinanceCheckpoint | null>(null);
  const mountedRef = React.useRef(false);
  const createInFlight = React.useRef(false);
  const loadSequence = React.useRef(0);
  const recoveryKey =
    session.subject && session.companyId
      ? `hrms.finance.draft:${session.subject}:${session.companyId}`
      : null;
  const [applications, setApplications] = React.useState<AdminRecord[]>([]);
  const [products, setProducts] = React.useState<AdminRecord[]>([]);
  const [guarantorRequests, setGuarantorRequests] = React.useState<
    AdminRecord[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [wizardStep, setWizardStep] = React.useState(0);
  const [eligibility, setEligibility] = React.useState<AdminRecord | null>(
    null,
  );
  const [eligibilityLoading, setEligibilityLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [documentFiles, setDocumentFiles] = React.useState<
    Record<string, File | null>
  >({});

  const load = React.useCallback(
    async (isActive: () => boolean = () => mountedRef.current) => {
      const current = getSessionSnapshot();
      const token = current.tokens?.accessToken;
      const sequence = ++loadSequence.current;
      const active = () =>
        isActive() &&
        sequence === loadSequence.current &&
        getSessionSnapshot().credentialVersion === current.credentialVersion;
      if (!token) {
        if (active()) {
          setError("Authentication required. Please log in again.");
          setLoading(false);
        }
        return;
      }
      if (!active()) return;
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        listMyFinanceApplications(token),
        listEmployeeFinanceProducts(token),
        listMyFinanceGuarantorRequests(token),
      ]);
      if (!active()) return;
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") {
        if (!leaveIfForbidden(failed.reason))
          setError(
            failed.reason instanceof Error
              ? failed.reason.message
              : "Could not load finance data.",
          );
      }
      if (results[0].status === "fulfilled") setApplications(results[0].value);
      if (results[1].status === "fulfilled") setProducts(results[1].value);
      if (results[2].status === "fulfilled")
        setGuarantorRequests(results[2].value);
      setLoading(false);
    },
    [leaveIfForbidden],
  );

  React.useEffect(() => {
    let active = true;
    mountedRef.current = true;
    setMounted(true);
    void load(() => active);
    return () => {
      active = false;
      mountedRef.current = false;
      loadSequence.current += 1;
    };
  }, [load, session.credentialVersion]);

  React.useEffect(() => {
    checkpointRef.current = null;
    setCheckpoint(null);
    setForm({});
    setDocumentFiles({});
    setCreateOpen(false);
    setApplications([]);
    setProducts([]);
    setGuarantorRequests([]);
    if (!recoveryKey) return;
    try {
      const raw = window.sessionStorage.getItem(recoveryKey);
      if (!raw) return;
      const restored = FinanceCheckpointSchema.parse(JSON.parse(raw));
      checkpointRef.current = restored;
      setCheckpoint(restored);
      setForm(restored.form);
      setWizardStep(3);
      setCreateOpen(true);
    } catch {
      window.sessionStorage.removeItem(recoveryKey);
    }
  }, [recoveryKey]);

  const currentProduct = React.useMemo(
    () => selectedProduct(products, form.product_id),
    [products, form.product_id],
  );
  const requiredDocuments = React.useMemo(
    () => productRequiredDocuments(currentProduct),
    [currentProduct],
  );
  const requiredGuarantors = productRequiredGuarantors(
    currentProduct,
    eligibility,
  );
  const guarantorIds = [
    ...new Set(parseGuarantorIds(form.guarantor_employee_ids)),
  ];
  const checks = eligibilityChecks(eligibility);
  const eligible = eligibility
    ? readString(eligibility, ["eligible"]) === "true"
    : false;
  const canCreate =
    checkpoint !== null ||
    (Boolean(
      form.product_id &&
      form.requested_amount &&
      form.requested_term_months &&
      form.purpose,
    ) &&
      requiredDocuments.every((type) => Boolean(documentFiles[type])) &&
      guarantorIds.length >= requiredGuarantors);

  React.useEffect(() => {
    let active = true;
    const token = readStoredToken();
    setEligibility(null);
    setEligibilityLoading(false);
    if (
      !createOpen ||
      !token ||
      !form.product_id ||
      !form.requested_amount ||
      !form.requested_term_months
    ) {
      return () => {
        active = false;
      };
    }
    const timer = window.setTimeout(() => {
      if (!active) return;
      setEligibilityLoading(true);
      evaluateMyFinanceEligibility(token, {
        product_id: Number(form.product_id),
        requested_amount: form.requested_amount,
        requested_term_months: Number(form.requested_term_months),
      })
        .then((value) => {
          if (active) setEligibility(value);
        })
        .catch((error) => {
          if (active) {
            setEligibility(null);
            setFormError(
              error instanceof Error
                ? error.message
                : "Could not evaluate eligibility.",
            );
          }
        })
        .finally(() => {
          if (active) setEligibilityLoading(false);
        });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    createOpen,
    form.product_id,
    form.requested_amount,
    form.requested_term_months,
    session.credentialVersion,
  ]);

  async function onCreate() {
    if (createInFlight.current || !recoveryKey) return;
    const actor = getSessionSnapshot();
    const token = actor.tokens?.accessToken;
    if (!token) return;
    const isActive = () =>
      mountedRef.current &&
      getSessionSnapshot().credentialVersion === actor.credentialVersion;
    createInFlight.current = true;
    setSaving(true);
    setFormError(null);
    const save = (next: FinanceCheckpoint) => {
      if (!isActive()) return;
      checkpointRef.current = next;
      setCheckpoint(next);
      window.sessionStorage.setItem(recoveryKey, JSON.stringify(next));
    };
    try {
      let initial = checkpointRef.current;
      if (!initial) {
        const missingDocuments = requiredDocuments.filter(
          (type) => !documentFiles[type],
        );
        if (missingDocuments.length)
          throw new Error(
            `Choose required documents: ${missingDocuments.join(", ")}.`,
          );
        const payload = FinanceInputSchema.parse({
          product_id: Number(form.product_id),
          requested_amount: form.requested_amount,
          requested_term_months: Number(form.requested_term_months),
          purpose: form.purpose,
        });
        if (guarantorIds.length < requiredGuarantors)
          throw new Error(`Add at least ${requiredGuarantors} guarantors.`);
        if (eligibility && !eligible)
          throw new Error("Eligibility checks are not passing yet.");
        initial = {
          payload,
          form: { ...form },
          requiredDocuments,
          guarantorIds,
          autoSubmit: form.auto_submit === "true",
          draftId: null,
          startedAt: Date.now(),
          creationPending: false,
          completedDocuments: [],
          completedGuarantors: [],
          submitted: false,
        };
        save(initial);
      }
      const completed = await resumeFinanceDraft(
        initial,
        documentFiles,
        {
          create: async (payload) =>
            recordIdFromPayload(
              await createMyFinanceApplication(token, payload),
            ),
          applications: () => listMyFinanceApplications(token),
          documents: (id) => listMyFinanceApplicationDocuments(token, id),
          guarantors: (id) => listMyFinanceApplicationGuarantors(token, id),
          upload: async (id, type, file) =>
            uploadMyFinanceApplicationDocument(token, id, {
              document_type: type,
              file: await fileToBase64UploadDto(file),
            }),
          addGuarantor: (id, employeeId) =>
            addMyFinanceApplicationGuarantor(token, id, {
              guarantor_employee_id: employeeId,
            }),
          submit: (id) => submitMyFinanceApplication(token, id),
        },
        save,
        isActive,
      );
      if (!isActive()) return;
      window.sessionStorage.removeItem(recoveryKey);
      checkpointRef.current = null;
      setCheckpoint(null);
      toast.success(
        completed.submitted ? "Application submitted." : "Application created.",
      );
      setCreateOpen(false);
      setForm({});
      setDocumentFiles({});
      setWizardStep(0);
      setEligibility(null);
      await load(isActive);
    } catch (error) {
      if (isActive()) {
        if (
          error instanceof ApiError &&
          !checkpointRef.current?.draftId &&
          !checkpointRef.current?.creationPending
        ) {
          checkpointRef.current = null;
          setCheckpoint(null);
          window.sessionStorage.removeItem(recoveryKey);
        }
        setFormError(
          error instanceof Error
            ? error.message
            : "Could not complete the application.",
        );
      }
    } finally {
      createInFlight.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  const columns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "app",
        label: "Application",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(row, ["purpose"], `Application #${rowId(row)}`)}
            </p>
            <p className="text-xs text-muted-foreground">
              {prettify(readString(row, ["productType", "product_type"], ""))}
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
        key: "term",
        label: "Term",
        render: (row) =>
          readString(
            row,
            ["requestedTermMonths", "requested_term_months"],
            "—",
          ),
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
                disabled={busyId === `sub-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`sub-${id}`);
                  void submitMyFinanceApplication(token, id)
                    .then(() => {
                      toast.success("Submitted.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not submit.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Submit
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `acc-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`acc-${id}`);
                  void acceptMyFinanceApplication(token, id)
                    .then(() => {
                      toast.success("Accepted.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not accept.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Accept
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `wd-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`wd-${id}`);
                  void withdrawMyFinanceApplication(token, id)
                    .then(() => {
                      toast.success("Withdrawn.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not withdraw.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Withdraw
              </button>
            </div>
          );
        },
      },
    ],
    [busyId, load],
  );

  const guarantorColumns = React.useMemo<Column<AdminRecord>[]>(
    () => [
      {
        key: "request",
        label: "Request",
        render: (row) => (
          <div className="space-y-0.5">
            <p className="font-medium">
              {readString(
                asRecord(
                  row.application ??
                    row.applicationSnapshot ??
                    row.application_snapshot,
                ),
                ["purpose"],
                `Guarantee #${rowId(row)}`,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Applicant{" "}
              {readString(
                row,
                ["applicantEmployeeId", "applicant_employee_id"],
                "unknown",
              )}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <StatusChip value={readString(row, ["status"], "PENDING")} />
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row) => {
          const id = rowId(row);
          const status = readString(row, ["status"], "PENDING").toUpperCase();
          if (status !== "PENDING")
            return (
              <span className="text-xs text-muted-foreground">Completed</span>
            );
          return (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `guar-a-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`guar-a-${id}`);
                  void decideMyFinanceGuarantorRequest(token, id, {
                    decision: "APPROVED",
                  })
                    .then(() => {
                      toast.success("Guarantee accepted.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not accept request.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Accept
              </button>
              <button
                type="button"
                className={actionButtonClass}
                disabled={busyId === `guar-r-${id}`}
                onClick={() => {
                  const token = readStoredToken();
                  if (!token || !id) return;
                  setBusyId(`guar-r-${id}`);
                  void decideMyFinanceGuarantorRequest(token, id, {
                    decision: "REJECTED",
                  })
                    .then(() => {
                      toast.success("Guarantee rejected.");
                      return load();
                    })
                    .catch((errorObject) =>
                      toast.error(
                        errorObject instanceof Error
                          ? errorObject.message
                          : "Could not reject request.",
                      ),
                    )
                    .finally(() => setBusyId(""));
                }}
              >
                Reject
              </button>
            </div>
          );
        },
      },
    ],
    [busyId, load],
  );

  return (
    <section className="space-y-4">
      <TalentDoodleSprites />
      <HeroBand
        eyebrow="My finance"
        title="Loans and advances"
        description="Apply, submit, accept an offer, or withdraw — only your own applications."
        actions={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20 hover:text-white disabled:opacity-60"
            onClick={() => void load()}
            disabled={mounted ? loading : undefined}
          >
            {mounted && loading ? (
              <FluentLoadingIndicator className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Refresh
          </button>
        }
      />
      <CompactStatStrip
        items={[
          { label: "Applications", value: String(applications.length) },
          { label: "Products", value: String(products.length) },
          {
            label: "Open",
            value: String(
              applications.filter(
                (row) =>
                  !["WITHDRAWN", "REJECTED", "CLOSED"].includes(
                    readString(row, ["status"]).toUpperCase(),
                  ),
              ).length,
            ),
          },
          {
            label: "Guarantee requests",
            value: String(guarantorRequests.length),
          },
        ]}
      />
      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            if (checkpointRef.current) {
              setCreateOpen(true);
              return;
            }
            setForm({});
            setDocumentFiles({});
            setWizardStep(0);
            setEligibility(null);
            setFormError(null);
            setCreateOpen(true);
          }}
        >
          <PlusIcon className="size-4" />{" "}
          {checkpoint ? "Resume application" : "New application"}
        </button>
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My applications"
          data={applications}
          columns={columns}
          loading={loading}
          itemsPerPage={20}
          showExport={false}
          storageKey="me-finance-applications"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ResizableTable
          title="My guarantor requests"
          data={guarantorRequests}
          columns={guarantorColumns}
          loading={loading}
          itemsPerPage={10}
          showExport={false}
          storageKey="me-finance-guarantor-requests"
        />
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!saving) setCreateOpen(open);
        }}
      >
        <DialogPopup className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {checkpoint ? "Resume application" : "New application"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {checkpoint ? (
              <p role="status" className="text-sm text-muted-foreground">
                Your draft and completed steps are saved. Retry continues the
                unfinished steps. Choose any missing documents again after
                reloading.
              </p>
            ) : null}
            <fieldset disabled={saving} className="contents">
              <div className="grid grid-cols-4 gap-2">
                {wizardSteps.map((step, index) => (
                  <button
                    key={step}
                    type="button"
                    className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                      wizardStep === index
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setWizardStep(index)}
                  >
                    {index + 1}. {step}
                  </button>
                ))}
              </div>
            </fieldset>
            {wizardStep === 0 ? (
              <div className="grid gap-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Product</span>
                  <FluentSelect
                    disabled={saving || Boolean(checkpoint)}
                    ariaLabel="Product"
                    className="w-full"
                    value={form.product_id ?? ""}
                    onChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        product_id: value,
                      }))
                    }
                    placeholder="Select product"
                    options={[
                      { value: "", label: "Select product" },
                      ...products.map((product) => ({
                        value: rowId(product),
                        label: optionLabel(product),
                      })),
                    ]}
                  />
                </label>
                {currentProduct ? (
                  <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="font-medium">
                        {prettify(
                          readString(
                            currentProduct,
                            ["productType", "product_type"],
                            "",
                          ),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Amount range
                      </p>
                      <p className="font-medium">
                        {readString(
                          currentProduct,
                          ["minimumAmount", "minimum_amount"],
                          "0.00",
                        )}{" "}
                        -{" "}
                        {readString(
                          currentProduct,
                          ["maximumAmount", "maximum_amount"],
                          "Open",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Term</p>
                      <p className="font-medium">
                        {readString(
                          currentProduct,
                          ["minimumTermMonths", "minimum_term_months"],
                          "1",
                        )}{" "}
                        -{" "}
                        {readString(
                          currentProduct,
                          ["maximumTermMonths", "maximum_term_months"],
                          "0",
                        )}{" "}
                        months
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Amount</span>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      disabled={saving || Boolean(checkpoint)}
                      value={form.requested_amount ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          requested_amount: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Term (months)</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      disabled={saving || Boolean(checkpoint)}
                      value={form.requested_term_months ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          requested_term_months: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">Purpose</span>
                    <Textarea
                      className={textareaClass}
                      disabled={saving || Boolean(checkpoint)}
                      value={form.purpose ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          purpose: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">Eligibility</p>
                    {eligibilityLoading ? (
                      <FluentLoadingIndicator className="size-4 animate-spin text-muted-foreground" />
                    ) : eligibility ? (
                      eligible ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : (
                        <XCircleIcon className="size-4 text-rose-600" />
                      )
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Installment</span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "estimatedInstallment",
                          "estimated_installment",
                        ])}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "availableInstallment",
                          "available_installment",
                        ])}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        After deduction
                      </span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "estimatedNetPayAfterDeduction",
                          "estimated_net_pay_after_deduction",
                        ])}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Max eligible
                      </span>
                      <span className="font-medium">
                        {moneyValue(eligibility, [
                          "maximumEligibleAmount",
                          "maximum_eligible_amount",
                        ])}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileTextIcon className="size-4" /> Required documents
                  </div>
                  {requiredDocuments.length ? (
                    requiredDocuments.map((type) => (
                      <label key={type} className="grid gap-1.5 text-sm">
                        <span className="font-medium">{prettify(type)}</span>
                        <input
                          className={inputClass}
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx"
                          onChange={(event) =>
                            setDocumentFiles((current) => ({
                              ...current,
                              [type]: event.target.files?.[0] ?? null,
                            }))
                          }
                        />
                        {documentFiles[type] ? (
                          <span className="text-xs text-muted-foreground">
                            {documentFiles[type]?.name}
                          </span>
                        ) : null}
                      </label>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      No document is required for this product.
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheckIcon className="size-4" /> Guarantors
                  </div>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium">
                      Employee IDs{" "}
                      {requiredGuarantors
                        ? `(minimum ${requiredGuarantors})`
                        : ""}
                    </span>
                    <input
                      className={inputClass}
                      placeholder="Example: 12, 25"
                      disabled={saving || Boolean(checkpoint)}
                      value={form.guarantor_employee_ids ?? ""}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          guarantor_employee_ids: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="grid gap-3">
                <div className="grid gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Product</p>
                    <p className="font-medium">
                      {currentProduct
                        ? optionLabel(currentProduct)
                        : "Not selected"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Amount / term
                    </p>
                    <p className="font-medium">
                      {form.requested_amount || "0.00"} over{" "}
                      {form.requested_term_months || "0"} months
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Documents</p>
                    <p className="font-medium">
                      {requiredDocuments.length
                        ? `${requiredDocuments.length} required`
                        : "None required"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Guarantors</p>
                    <p className="font-medium">
                      {guarantorIds.length} added, {requiredGuarantors} required
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {checks.length ? (
                    checks.map((check, index) => {
                      const passed = readString(check, ["passed"]) === "true";
                      const code = readString(
                        check,
                        ["code"],
                        `check-${index}`,
                      );
                      return (
                        <div
                          key={code}
                          className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          {passed ? (
                            <CheckCircle2Icon className="mt-0.5 size-4 text-emerald-600" />
                          ) : (
                            <XCircleIcon className="mt-0.5 size-4 text-rose-600" />
                          )}
                          <div>
                            <p className="font-medium">{prettify(code)}</p>
                            <p className="text-xs text-muted-foreground">
                              {readString(check, ["message"], "")}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                      Eligibility checks appear after product, amount, and term
                      are entered.
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={saving || Boolean(checkpoint)}
                    checked={form.auto_submit === "true"}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        auto_submit: event.target.checked ? "true" : "false",
                      }))
                    }
                  />
                  Submit immediately after creating the draft
                </label>
              </div>
            ) : null}
            {formError ? (
              <p className="text-sm text-rose-600">{formError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setWizardStep((step) => Math.max(0, step - 1))}
              disabled={wizardStep === 0 || saving}
            >
              Back
            </button>
            {wizardStep < wizardSteps.length - 1 ? (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() =>
                  setWizardStep((step) =>
                    Math.min(wizardSteps.length - 1, step + 1),
                  )
                }
                disabled={saving}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => void onCreate()}
                disabled={saving || !canCreate}
              >
                {saving ? (
                  <FluentLoadingIndicator className="size-4 animate-spin" />
                ) : checkpoint ? (
                  "Continue draft"
                ) : (
                  "Create"
                )}
              </button>
            )}
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
```

## [src/lib/request-json.ts](/home/innocent/systems/hrms/src/lib/request-json.ts)

```typescript
import { z } from "zod";

export class ContractError extends Error {
  readonly status = 502;
  readonly statusCode = 502;
  constructor(
    message: string,
    public readonly issues: readonly z.core.$ZodIssue[] = [],
  ) {
    super(message);
    this.name = "ContractError";
  }
}
export class ApiError extends Error {
  readonly status: number;
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, string | string[]>,
    public readonly payload?: unknown,
    public readonly retryAfter: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = statusCode;
  }
}
export const RecordSchema = z.record(z.string(), z.unknown());
// Structural wire contract for endpoints whose domain fields remain dynamic.
// Invalid JSON, scalar HTML/text bodies, mixed record arrays and nonfinite numbers never succeed.
export const ApiResponseSchema = z.union([
  RecordSchema,
  z.array(RecordSchema),
  z.array(z.string().min(1)),
  z.null(),
  z.undefined(),
]);
export const EmptyResponseSchema = z.union([RecordSchema, z.undefined()]);

function record(value: unknown): Record<string, unknown> {
  return RecordSchema.safeParse(value).success ? RecordSchema.parse(value) : {};
}
function errorMessage(payload: unknown, status: number): string {
  const data = record(payload);
  const validation = record(data.errors).validation;
  const lines = Array.isArray(validation)
    ? validation.filter((value): value is string => typeof value === "string")
    : [];
  if (lines.length) return lines.join(". ");
  if (Array.isArray(data.message))
    return data.message.filter((value) => typeof value === "string").join(". ");
  if (typeof data.message === "string" && data.message.trim())
    return data.message;
  return status === 410
    ? "This reset link has expired or is no longer valid."
    : `Request failed with status ${status}`;
}

export async function requestJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<z.output<S>> {
  const response = await fetch(path, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let raw: unknown;
  if (!text.trim()) raw = undefined;
  else {
    try {
      raw = JSON.parse(text);
    } catch {
      if (response.ok) throw new ContractError("The service returned an invalid JSON response.");
      raw = { message: text.slice(0, 2_000) };
    }
  }
  if (!response.ok) {
    const details = z
      .record(z.string(), z.union([z.string(), z.array(z.string())]))
      .safeParse(record(raw).details);
    throw new ApiError(
      errorMessage(raw, response.status),
      response.status,
      details.success ? details.data : undefined,
      raw,
      response.headers.get("retry-after"),
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new ContractError(
      "The service response does not match its expected contract.",
      result.error.issues,
    );
  return result.data;
}
```

## [src/lib/admin-response-schemas.ts](/home/innocent/systems/hrms/src/lib/admin-response-schemas.ts)

```typescript
import { z } from "zod";

export const LeaveBalanceImportBatchDetailSchema = z
  .object({
    batch_id: z.string(),
    status: z.union([
      z.literal("UPLOADED"),
      z.literal("VALIDATING"),
      z.literal("VALIDATED"),
      z.literal("HAS_ERRORS"),
      z.literal("READY_FOR_IMPORT"),
      z.literal("PROCESSING"),
      z.literal("COMPLETED"),
      z.literal("PARTIALLY_COMPLETED"),
      z.literal("FAILED"),
      z.literal("CANCELLED"),
    ]),
    import_mode: z.union([
      z.null(),
      z.literal("STRICT"),
      z.literal("VALID_ROWS_ONLY"),
    ]),
    fiscal_year: z.string(),
    original_file_name: z.string(),
    file_size: z.number(),
    template_generated_at: z.union([z.null(), z.string()]),
    default_reason: z.union([z.null(), z.string()]),
    total_rows: z.number(),
    valid_rows: z.number(),
    warning_rows: z.number(),
    invalid_rows: z.number(),
    no_change_rows: z.number(),
    changed_rows: z.number(),
    imported_rows: z.number(),
    skipped_rows: z.number(),
    failed_rows: z.number(),
    processed_rows: z.number(),
    total_employees: z.number(),
    employees_affected: z.number(),
    failure_reason: z.union([z.null(), z.string()]),
    uploaded_at: z.string(),
    uploaded_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    confirmed_at: z.union([z.null(), z.string()]),
    confirmed_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    completed_at: z.union([z.null(), z.string()]),
    cancelled_at: z.union([z.null(), z.string()]),
    summary: z
      .object({
        issue_counts: z
          .union([z.undefined(), z.record(z.string(), z.number())])
          .optional(),
        total_increase_days: z.union([z.undefined(), z.string()]).optional(),
        total_decrease_days: z.union([z.undefined(), z.string()]).optional(),
        net_adjustment_days: z.union([z.undefined(), z.string()]).optional(),
        facets: z
          .union([
            z.undefined(),
            z
              .object({
                leave_types: z
                  .union([
                    z.undefined(),
                    z.array(
                      z
                        .object({
                          id: z.number(),
                          name: z.string(),
                          code: z.union([z.undefined(), z.string()]).optional(),
                        })
                        .passthrough(),
                    ),
                  ])
                  .optional(),
                branches: z
                  .union([
                    z.undefined(),
                    z.array(
                      z
                        .object({
                          id: z.number(),
                          name: z.string(),
                          code: z.union([z.undefined(), z.string()]).optional(),
                        })
                        .passthrough(),
                    ),
                  ])
                  .optional(),
                departments: z
                  .union([
                    z.undefined(),
                    z.array(
                      z
                        .object({
                          id: z.number(),
                          name: z.string(),
                          code: z.union([z.undefined(), z.string()]).optional(),
                        })
                        .passthrough(),
                    ),
                  ])
                  .optional(),
              })
              .passthrough(),
          ])
          .optional(),
        result: z
          .union([
            z.undefined(),
            z
              .object({
                imported_rows: z.union([z.undefined(), z.number()]).optional(),
                failed_rows: z.union([z.undefined(), z.number()]).optional(),
                skipped_rows: z.union([z.undefined(), z.number()]).optional(),
                net_adjustment_days: z
                  .union([z.undefined(), z.string()])
                  .optional(),
              })
              .passthrough(),
          ])
          .optional(),
      })
      .passthrough(),
    actions: z
      .object({
        can_confirm_strict: z.boolean(),
        can_confirm_valid_rows_only: z.boolean(),
        can_cancel: z.boolean(),
        requires_warning_acknowledgement: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough();

export const DashboardCardStyleSchema = z
  .object({
    palette: z.union([
      z.literal("ocean"),
      z.literal("forest"),
      z.literal("plum"),
      z.literal("coral"),
      z.literal("midnight"),
      z.literal("berry"),
      z.literal("neutral"),
      z.literal("white"),
    ]),
    artwork: z.union([
      z.literal("none"),
      z.literal("orbit"),
      z.literal("waves"),
      z.literal("confetti"),
      z.literal("arches"),
      z.literal("sprigs"),
    ]),
  })
  .passthrough();

export const IdentityAuditPageSchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.number(),
          change_set_id: z.string(),
          company_id: z.number(),
          user_id: z.union([z.null(), z.number()]),
          employee_id: z.union([z.null(), z.number()]),
          affected_employee_ids: z.array(z.number()),
          subject_name: z.union([z.null(), z.string()]),
          field: z.union([
            z.literal("first_name"),
            z.literal("last_name"),
            z.literal("email"),
            z.literal("phone"),
          ]),
          old_value: z.union([z.null(), z.string()]),
          new_value: z.union([z.null(), z.string()]),
          source: z.union([
            z.literal("user_update"),
            z.literal("employee_update"),
            z.literal("rollback"),
          ]),
          rollback_of_change_set_id: z.union([z.null(), z.string()]),
          rolled_back_by_change_set_id: z.union([z.null(), z.string()]),
          can_rollback: z.boolean(),
          actor_user_id: z.union([z.null(), z.number()]),
          actor_name: z.union([z.null(), z.string()]),
          actor_email: z.union([z.null(), z.string()]),
          reason: z.union([z.null(), z.string()]),
          created_at: z.string(),
        })
        .passthrough(),
    ),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
  .passthrough();

export const IdentityRollbackSchema = z
  .object({
    changeSetId: z.union([z.null(), z.string()]),
    changedFields: z.array(z.string()),
  })
  .passthrough();

export const LeaveBalanceImportBatchSchema = z
  .object({
    batch_id: z.string(),
    status: z.union([
      z.literal("UPLOADED"),
      z.literal("VALIDATING"),
      z.literal("VALIDATED"),
      z.literal("HAS_ERRORS"),
      z.literal("READY_FOR_IMPORT"),
      z.literal("PROCESSING"),
      z.literal("COMPLETED"),
      z.literal("PARTIALLY_COMPLETED"),
      z.literal("FAILED"),
      z.literal("CANCELLED"),
    ]),
    import_mode: z.union([
      z.null(),
      z.literal("STRICT"),
      z.literal("VALID_ROWS_ONLY"),
    ]),
    fiscal_year: z.string(),
    original_file_name: z.string(),
    file_size: z.number(),
    template_generated_at: z.union([z.null(), z.string()]),
    default_reason: z.union([z.null(), z.string()]),
    total_rows: z.number(),
    valid_rows: z.number(),
    warning_rows: z.number(),
    invalid_rows: z.number(),
    no_change_rows: z.number(),
    changed_rows: z.number(),
    imported_rows: z.number(),
    skipped_rows: z.number(),
    failed_rows: z.number(),
    processed_rows: z.number(),
    total_employees: z.number(),
    employees_affected: z.number(),
    failure_reason: z.union([z.null(), z.string()]),
    uploaded_at: z.string(),
    uploaded_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    confirmed_at: z.union([z.null(), z.string()]),
    confirmed_by: z.union([
      z.null(),
      z
        .object({ id: z.number(), name: z.string(), email: z.string() })
        .passthrough(),
    ]),
    completed_at: z.union([z.null(), z.string()]),
    cancelled_at: z.union([z.null(), z.string()]),
  })
  .passthrough();

export const LeaveBalanceImportRowSchema = z
  .object({
    id: z.number(),
    row_number: z.number(),
    employee_no: z.union([z.null(), z.string()]),
    employee_name: z.union([z.null(), z.string()]),
    branch_name: z.union([z.null(), z.string()]),
    department_name: z.union([z.null(), z.string()]),
    leave_type_code: z.union([z.null(), z.string()]),
    leave_type_name: z.union([z.null(), z.string()]),
    uploaded_current_balance: z.union([z.null(), z.string()]),
    db_current_balance: z.union([z.null(), z.string()]),
    new_balance: z.union([z.null(), z.string()]),
    adjustment_days: z.union([z.null(), z.string()]),
    reason: z.union([z.null(), z.string()]),
    validation_status: z.union([
      z.literal("VALID"),
      z.literal("WARNING"),
      z.literal("INVALID"),
      z.literal("NO_CHANGE"),
    ]),
    result_status: z.union([
      z.null(),
      z.literal("FAILED"),
      z.literal("IMPORTED"),
      z.literal("SKIPPED"),
    ]),
    error_code: z.union([z.null(), z.string()]),
    message: z.union([z.null(), z.string()]),
    issues: z.array(
      z
        .object({
          code: z.string(),
          severity: z.union([
            z.literal("error"),
            z.literal("warning"),
            z.literal("info"),
          ]),
          field: z.union([z.null(), z.string()]),
          message: z.string(),
        })
        .passthrough(),
    ),
    previous_balance_at_import: z.union([z.null(), z.string()]),
    new_balance_at_import: z.union([z.null(), z.string()]),
    processed_at: z.union([z.null(), z.string()]),
  })
  .passthrough();

const ImportPageMetaSchema = z
  .object({
    totalItems: z.number().int().nonnegative().optional(),
    itemCount: z.number().int().nonnegative().optional(),
    itemsPerPage: z.number().int().positive().optional(),
    currentPage: z.number().int().positive().optional(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .passthrough();
export const LeaveBalanceImportRowsPageSchema = z
  .object({
    data: z.array(LeaveBalanceImportRowSchema),
    meta: ImportPageMetaSchema.optional(),
  })
  .passthrough();
export const LeaveBalanceImportBatchesPageSchema = z
  .object({
    data: z.array(LeaveBalanceImportBatchSchema),
    meta: ImportPageMetaSchema.optional(),
  })
  .passthrough();
```

## [src/lib/local-storage-store.ts](/home/innocent/systems/hrms/src/lib/local-storage-store.ts)

```typescript
export const STORAGE_CHANGED_EVENT = "hrms:storage-changed";
const listeners = new Set<() => void>();
let observedWindow: Window | null = null;
function notify() {
  for (const listener of [...listeners]) listener();
}
function observe() {
  if (typeof window === "undefined" || observedWindow === window) return;
  observedWindow = window;
  if (typeof window.addEventListener !== "function") return;
  window.addEventListener("storage", notify);
  window.addEventListener(STORAGE_CHANGED_EVENT, notify);
}
export function subscribeStorage(listener: () => void): () => void {
  observe();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
/** Commit the complete write set, rollback persistence failures, then notify same-tab readers once. */
export function writeStorageBatch(
  updates: Readonly<Record<string, string | null>>,
): void {
  if (typeof window === "undefined") return;
  const previous = new Map<string, string | null>();
  try {
    for (const [key, value] of Object.entries(updates)) {
      previous.set(key, window.localStorage.getItem(key));
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    }
  } catch (error) {
    for (const [key, value] of previous) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {
        /* The original persistence error is reported to the caller. */
      }
    }
    throw error;
  }
  observe();
  if (typeof window.dispatchEvent === "function")
    window.dispatchEvent(new Event(STORAGE_CHANGED_EVENT));
}
```

## [src/lib/auth-session-store.ts](/home/innocent/systems/hrms/src/lib/auth-session-store.ts)

```typescript
"use client";
import { z } from "zod";
import { AUTH_STORAGE_KEYS } from "@/utils/constants";
import {
  readStorage,
  subscribeStorage,
  writeStorageBatch,
} from "@/lib/local-storage-store";

export const SESSION_STORAGE_KEY = "hrms.auth.session.v1";
export const ACCESS_TOKEN_STORAGE_KEY = "hrms.admin.accessToken";
export const AuthTokensSchema = z.object({
  accessToken: z.string().trim().min(1),
  refreshToken: z.string(),
});
export const AuthUserSchema = z
  .object({
    id: z.union([z.string().min(1), z.number().int().positive()]),
    employeeId: z.string().optional(),
    fullName: z.string(),
    email: z.string(),
    role: z.string().optional(),
    scope: z.enum(["platform", "company"]).optional(),
    dashboardType: z.enum(["admin", "employee"]).optional(),
    companyId: z.number().int().positive().optional(),
    companyName: z.string().optional(),
    requiresPasswordChange: z.boolean().optional(),
    permissions: z.array(z.string()).optional(),
    accessContextResolved: z.boolean().optional(),
  })
  .passthrough();
const StoredSession = z.object({
  tokens: AuthTokensSchema.nullable(),
  user: AuthUserSchema.nullable(),
  credentialVersion: z.string(),
});
export type SessionSnapshot = z.output<typeof StoredSession> & {
  subject: string | null;
  companyId: number | null;
};
const EMPTY: SessionSnapshot = Object.freeze({
  tokens: null,
  user: null,
  credentialVersion: "",
  subject: null,
  companyId: null,
});
const listeners = new Set<() => void>();
let cached = EMPTY;
let cachedKey: string | undefined;
let cachedWindow: Window | undefined;
let legacyVersion = 0;
let unsubscribe: (() => void) | undefined;
function json(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function claims(token: string | undefined): {
  subject: string | null;
  companyId: number | null;
} {
  if (!token || typeof window === "undefined")
    return { subject: null, companyId: null };
  try {
    const part = token.split(".")[1];
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const value = z
      .object({
        sub: z.union([z.string(), z.number()]).optional(),
        companyId: z.number().int().positive().optional(),
      })
      .parse(
        JSON.parse(
          window.atob(
            normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
          ),
        ),
      );
    return {
      subject: value.sub === undefined ? null : String(value.sub),
      companyId: value.companyId ?? null,
    };
  } catch {
    return { subject: null, companyId: null };
  }
}
export function getServerSessionSnapshot(): SessionSnapshot {
  return EMPTY;
}
export function getSessionSnapshot(): SessionSnapshot {
  if (typeof window === "undefined") return EMPTY;
  const canonical = readStorage(SESSION_STORAGE_KEY);
  const tokenRaw = readStorage(AUTH_STORAGE_KEYS.tokens);
  const userRaw = readStorage(AUTH_STORAGE_KEYS.user);
  const direct = readStorage(ACCESS_TOKEN_STORAGE_KEY);
  const key = canonical ?? JSON.stringify([tokenRaw, userRaw, direct]);
  if (cachedWindow === window && cachedKey === key) return cached;
  cachedWindow = window;
  cachedKey = key;
  let record: z.output<typeof StoredSession>;
  if (canonical !== null) {
    const parsed = StoredSession.safeParse(json(canonical));
    if (!parsed.success) {
      cached = EMPTY;
      return cached;
    }
    record = parsed.data;
  } else {
    const tokens = AuthTokensSchema.safeParse(json(tokenRaw));
    const user = AuthUserSchema.safeParse(json(userRaw));
    record = {
      tokens: tokens.success
        ? tokens.data
        : direct
          ? { accessToken: direct, refreshToken: "" }
          : null,
      user: user.success ? user.data : null,
      credentialVersion: `legacy-${++legacyVersion}`,
    };
    if (!record.tokens)
      record = { tokens: null, user: null, credentialVersion: "" };
  }
  if (record.tokens) Object.freeze(record.tokens);
  if (record.user) {
    if (record.user.permissions) Object.freeze(record.user.permissions);
    Object.freeze(record.user);
  }
  const identity = claims(record.tokens?.accessToken);
  cached = Object.freeze({
    ...record,
    subject: identity.subject ?? (record.user ? String(record.user.id) : null),
    companyId: identity.companyId ?? record.user?.companyId ?? null,
  });
  return cached;
}
function observeSession() {
  if (unsubscribe || typeof window === "undefined") return;
  unsubscribe = subscribeStorage(() => {
    const before = cached;
    const next = getSessionSnapshot();
    if (before !== next) for (const listener of [...listeners]) listener();
  });
}
export function subscribeSession(listener: () => void): () => void {
  observeSession();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function persistAuthSession(
  tokens: z.output<typeof AuthTokensSchema> | null,
  user: unknown,
): void {
  const previous = getSessionSnapshot();
  const verifiedTokens =
    tokens === null ? null : AuthTokensSchema.parse(tokens);
  const verifiedUser =
    user === null || user === undefined ? null : AuthUserSchema.parse(user);
  const changed =
    verifiedTokens === null ||
    previous.tokens?.accessToken !== verifiedTokens?.accessToken ||
    previous.tokens?.refreshToken !== verifiedTokens?.refreshToken ||
    previous.user?.id !== verifiedUser?.id ||
    previous.user?.companyId !== verifiedUser?.companyId ||
    previous.user?.scope !== verifiedUser?.scope ||
    previous.user?.dashboardType !== verifiedUser?.dashboardType ||
    previous.user?.employeeId !== verifiedUser?.employeeId ||
    previous.user?.role !== verifiedUser?.role ||
    JSON.stringify(previous.user?.permissions) !==
      JSON.stringify(verifiedUser?.permissions);
  const credentialVersion = changed
    ? `${Date.now()}-${Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4))).join("-")}`
    : previous.credentialVersion;
  // Publish one canonical record first. Even logout persists a tombstone so stale legacy mirrors cannot revive it.
  writeStorageBatch({
    [SESSION_STORAGE_KEY]: JSON.stringify({
      tokens: verifiedTokens,
      user: verifiedTokens ? verifiedUser : null,
      credentialVersion,
    }),
    [ACCESS_TOKEN_STORAGE_KEY]: verifiedTokens?.accessToken ?? null,
    [AUTH_STORAGE_KEYS.tokens]: verifiedTokens
      ? JSON.stringify(verifiedTokens)
      : null,
    [AUTH_STORAGE_KEYS.user]: verifiedUser
      ? JSON.stringify(verifiedUser)
      : null,
  });
  getSessionSnapshot();
}
export function persistAuthUser(user: unknown): void {
  persistAuthSession(getSessionSnapshot().tokens, user);
}
```

## [src/lib/finance-draft-workflow.ts](/home/innocent/systems/hrms/src/lib/finance-draft-workflow.ts)

```typescript
import { z } from "zod";
import { ApiError, RecordSchema } from "@/lib/request-json";
export const FinanceInputSchema = z.object({
  product_id: z.number().int().positive(),
  requested_amount: z
    .string()
    .max(18)
    .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/),
  requested_term_months: z.number().int().min(1).max(600),
  purpose: z.string().trim().min(1),
});
export const FinanceCheckpointSchema = z.object({
  payload: FinanceInputSchema,
  form: z.record(z.string(), z.string()),
  requiredDocuments: z.array(z.string()),
  guarantorIds: z.array(z.number().int().positive()),
  autoSubmit: z.boolean(),
  draftId: z.string().nullable(),
  startedAt: z.number(),
  creationPending: z.boolean(),
  completedDocuments: z.array(z.string()),
  completedGuarantors: z.array(z.number().int().positive()),
  submitted: z.boolean(),
});
export type FinanceCheckpoint = z.output<typeof FinanceCheckpointSchema>;
type RecordData = z.output<typeof RecordSchema>;
export interface FinanceWorkflowApi {
  create: (payload: z.output<typeof FinanceInputSchema>) => Promise<string>;
  applications: () => Promise<RecordData[]>;
  documents: (id: string) => Promise<RecordData[]>;
  guarantors: (id: string) => Promise<RecordData[]>;
  upload: (id: string, type: string, file: File) => Promise<unknown>;
  addGuarantor: (id: string, employeeId: number) => Promise<unknown>;
  submit: (id: string) => Promise<unknown>;
}
function amountKey(value: unknown): string | null {
  const parsed = z
    .string()
    .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/)
    .safeParse(value);
  if (!parsed.success) return null;
  const [whole, fraction = ""] = parsed.data.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export async function resumeFinanceDraft(
  initial: FinanceCheckpoint,
  files: Record<string, File | null>,
  api: FinanceWorkflowApi,
  save: (checkpoint: FinanceCheckpoint) => void,
  isActive: () => boolean,
): Promise<FinanceCheckpoint> {
  let state = FinanceCheckpointSchema.parse(initial);
  const check = () => {
    if (!isActive())
      throw new DOMException("Finance workflow superseded.", "AbortError");
  };
  const commit = (next: FinanceCheckpoint) => {
    check();
    state = next;
    save(state);
  };
  check();
  if (!state.draftId) {
    if (state.creationPending) {
      const rows = await api.applications();
      check();
      const matches = rows.filter((row) => {
        const created = Date.parse(
          String(row.createdAt ?? row.created_at ?? ""),
        );
        return (
          Number(row.productId ?? row.product_id) ===
            state.payload.product_id &&
          amountKey(row.requestedAmount ?? row.requested_amount) ===
            amountKey(state.payload.requested_amount) &&
          Number(row.requestedTermMonths ?? row.requested_term_months) ===
            state.payload.requested_term_months &&
          row.purpose === state.payload.purpose &&
          Number.isFinite(created) &&
          created >= state.startedAt - 5_000
        );
      });
      if (matches.length !== 1 || !matches[0].id) {
        throw new Error(
          "The draft creation result is unconfirmed. Refresh your applications and retry recovery; a second draft will not be created.",
        );
      }
      commit({
        ...state,
        draftId: String(matches[0].id),
        creationPending: false,
      });
    } else {
      commit({ ...state, creationPending: true });
      let draftId: string;
      try {
        draftId = await api.create(state.payload);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.statusCode >= 400 &&
          error.statusCode < 500 &&
          error.statusCode !== 408
        ) {
          commit({ ...state, creationPending: false });
        }
        throw error;
      }
      check();
      if (!draftId)
        throw new Error(
          "The server did not identify the created draft. Retry recovery.",
        );
      commit({ ...state, draftId, creationPending: false });
    }
  }
  const id = state.draftId!;
  const [documents, guarantors, applications] = await Promise.all([
    api.documents(id),
    api.guarantors(id),
    api.applications(),
  ]);
  check();
  const current = applications.find((row) => String(row.id) === id);
  if (!current)
    throw new Error("The saved application is no longer available.");
  const status = String(current.status ?? "").toUpperCase();
  if (!["DRAFT", "RETURNED_FOR_CORRECTION"].includes(status)) {
    if (["WITHDRAWN", "REJECTED", "CANCELLED", "EXPIRED"].includes(status)) {
      throw new Error(
        "This application cannot be resumed. Review it in your applications.",
      );
    }
    commit({ ...state, submitted: true });
    return state;
  }
  commit({
    ...state,
    completedDocuments: documents
      .filter(
        (row) =>
          !["REJECTED", "DELETED"].includes(String(row.status).toUpperCase()),
      )
      .map((row) =>
        String(row.documentType ?? row.document_type ?? "")
          .trim()
          .toUpperCase(),
      ),
    completedGuarantors: guarantors
      .map((row) =>
        Number(row.guarantorEmployeeId ?? row.guarantor_employee_id),
      )
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  });
  for (const type of state.requiredDocuments) {
    check();
    if (state.completedDocuments.includes(type)) continue;
    const file = files[type];
    if (!file)
      throw new Error(
        `Choose the missing ${type} document to continue your draft.`,
      );
    await api.upload(id, type, file);
    check();
    commit({
      ...state,
      completedDocuments: [...state.completedDocuments, type],
    });
  }
  for (const employeeId of state.guarantorIds) {
    check();
    if (state.completedGuarantors.includes(employeeId)) continue;
    await api.addGuarantor(id, employeeId);
    check();
    commit({
      ...state,
      completedGuarantors: [...state.completedGuarantors, employeeId],
    });
  }
  if (state.autoSubmit && !state.submitted) {
    await api.submit(id);
    check();
    commit({ ...state, submitted: true });
  }
  return state;
}
```

## [src/lib/session-client.ts](/home/innocent/systems/hrms/src/lib/session-client.ts)

```typescript
"use client";

import {
  getSessionSnapshot,
  persistAuthSession,
  persistAuthUser,
} from "@/lib/auth-session-store";
import type { AuthUser } from "@/types";

import { ROUTES } from "@/utils/constants";
import {
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
} from "@/lib/dashboard-permissions";

const LEGACY_SESSION_TOKEN_KEY = "ess_auth_token";

export const SESSION_CLEARED_EVENT = "hrms:session-cleared";

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

export function readStoredSessionTokens(): StoredTokens {
  const tokens = getSessionSnapshot().tokens;
  return {
    accessToken: tokens?.accessToken ?? "",
    refreshToken: tokens?.refreshToken ?? "",
  };
}
export function persistSessionTokens(
  accessToken: string,
  refreshToken: string,
  user?: AuthUser | null,
) {
  if (typeof window === "undefined") return;
  persistAuthSession(
    { accessToken, refreshToken },
    user === undefined ? getSessionSnapshot().user : user,
  );
  persistDashboardAccessToken(accessToken);
}
export function persistSessionUser(user: unknown) {
  persistAuthUser(user);
}

export function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  persistAuthSession(null, null);
  window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  clearDashboardActorSnapshot();
  void import("@/lib/forbidden-routes").then((mod) => {
    mod.clearDashboardRouteMemory();
  });
  // The photo store listens for this. Importing it here would pull the full
  // admin API client into every page that clears a session, including login.
  window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
}

export function readJwtExpiry(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

export function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname !== ROUTES.login) {
    window.location.assign(ROUTES.login);
  }
}
```

## [src/services/authService.ts](/home/innocent/systems/hrms/src/services/authService.ts)

```typescript
import { ApiResponseSchema, EmptyResponseSchema } from "@/lib/request-json";
import type {
  AuthSessionRecord,
  AuthScope,
  AuthSwitchCompanyResponse,
  ChangePasswordRequest,
  DashboardType,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  ResetPasswordRequest,
  TwoFactorSetupResponse,
  UserSecurityFlags,
  VerifyOtpRequest,
  VerifyOtpResponse,
  AuthUser,
  AuthTokens,
} from "@/types";
import { extractBackupCodes } from "@/lib/backup-codes";
import { readPermissionLabelsFromUnknown } from "@/lib/dashboard-permissions";
import { apiRequest, ApiError } from "@/services/api";
import { decodeJwtPayload, isLikelyRefreshToken } from "@/utils/token-utils";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : null;
}

function asRecordArray(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is UnknownRecord => Boolean(entry));
}

function readString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function readNumber(record: UnknownRecord | null, keys: string[]): number | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
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

  return undefined;
}

function readBoolean(record: UnknownRecord | null, keys: string[]): boolean | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") {
        return true;
      }
      if (normalized === "false") {
        return false;
      }
    }
  }

  return undefined;
}

function readSessionId(record: UnknownRecord | null): string | undefined {
  if (!record) {
    return undefined;
  }

  for (const key of ["id", "session_id", "sessionId", "sid"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function normalizeAuthSessionLabel(record: UnknownRecord) {
  const direct =
    readString(record, [
      "device_name",
      "deviceName",
      "session_name",
      "sessionName",
      "label",
      "title",
      "browser",
      "user_agent",
      "userAgent",
    ]) ?? "";
  if (direct) {
    return direct;
  }

  const browser = readString(record, ["browser"]);
  const os = readString(record, ["os", "platform"]);
  if (browser && os) {
    return `${browser} on ${os}`;
  }
  if (browser) {
    return browser;
  }
  if (os) {
    return os;
  }

  return "Session";
}

function normalizeAuthSessions(payload: unknown): AuthSessionRecord[] {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const listCandidates = [
    payload,
    root?.sessions,
    root?.items,
    root?.rows,
    rootData?.sessions,
    rootData?.items,
    rootData?.rows,
    rootData,
  ];

  const seen = new Set<string>();
  const sessions: AuthSessionRecord[] = [];

  for (const candidate of listCandidates) {
    for (const record of asRecordArray(candidate)) {
      const id = readSessionId(record);
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      sessions.push({
        id,
        label: normalizeAuthSessionLabel(record),
        isCurrent:
          readBoolean(record, ["is_current", "isCurrent", "current"]) ?? false,
        createdAt: readString(record, ["created_at", "createdAt", "issued_at", "issuedAt"]),
        lastUsedAt: readString(record, ["last_used_at", "lastUsedAt", "updated_at", "updatedAt"]),
        expiresAt: readString(record, ["expires_at", "expiresAt"]),
        ipAddress: readString(record, ["ip_address", "ipAddress"]),
        userAgent: readString(record, ["user_agent", "userAgent"]),
        deviceName: readString(record, ["device_name", "deviceName"]),
        browser: readString(record, ["browser"]),
        os: readString(record, ["os", "platform"]),
        location: readString(record, ["location"]),
        raw: record,
      });
    }
  }

  return sessions;
}

function normalizeDashboardType(value: unknown): DashboardType | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "admin" || normalized === "employee") {
    return normalized
  }

  return undefined
}

function normalizeAuthScope(value: unknown): AuthScope | undefined {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "platform" || normalized === "company") {
    return normalized
  }

  return undefined
}

function readAuthScope(payload: unknown): AuthScope | undefined {
  const root = asRecord(payload)
  const rootData = asRecord(root?.data)
  const rootResult = asRecord(root?.result)
  const candidates = [
    root,
    rootData,
    rootResult,
    asRecord(root?.user),
    asRecord(rootData?.user),
    asRecord(rootResult?.user),
  ]

  for (const candidate of candidates) {
    const scope = normalizeAuthScope(candidate?.scope)
    if (scope) {
      return scope
    }
  }

  return undefined
}

function readDashboardType(payload: unknown): DashboardType | undefined {
  const root = asRecord(payload)
  const rootData = asRecord(root?.data)
  const rootResult = asRecord(root?.result)
  const candidates = [
    root,
    rootData,
    rootResult,
    asRecord(root?.user),
    asRecord(rootData?.user),
    asRecord(rootResult?.user),
  ]

  for (const candidate of candidates) {
    const dashboardType =
      normalizeDashboardType(candidate?.dashboard_type) ??
      normalizeDashboardType(candidate?.dashboardType)
    if (dashboardType) {
      return dashboardType
    }
  }

  return undefined
}

function readRole(record: UnknownRecord | null): string | undefined {
  const direct = readString(record, ["role", "user_type"]);
  if (direct) {
    return direct;
  }

  const roles = Array.isArray(record?.roles) ? record.roles : [];
  for (const role of roles) {
    if (typeof role === "string" && role.trim()) {
      return role.trim();
    }

    const roleRecord = asRecord(role);
    const roleName = readString(roleRecord, ["name", "display_name", "displayName", "role"]);
    if (roleName) {
      return roleName;
    }
  }

  return undefined;
}

const ACCESS_CONTEXT_KEYS = new Set([
  "permissions",
  "effective_permissions",
  "effectivePermissions",
  "direct_permissions",
  "directPermissions",
  "role_permissions",
  "rolePermissions",
  "granted_permissions",
  "grantedPermissions",
  "authorities",
  "scopes",
  "roles",
]);

function hasExplicitAccessContext(value: unknown, seen = new Set<object>()): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => hasExplicitAccessContext(entry, seen));
  }

  const record = asRecord(value);
  if (!record || seen.has(record)) {
    return false;
  }
  seen.add(record);

  if (Object.keys(record).some((key) => ACCESS_CONTEXT_KEYS.has(key))) {
    return true;
  }

  return Object.values(record).some((entry) =>
    typeof entry === "object" && entry !== null
      ? hasExplicitAccessContext(entry, seen)
      : false,
  );
}

function normalizeTokens(payload: unknown): AuthTokens | undefined {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);
  const tokenCandidates = [
    root,
    asRecord(root?.tokens),
    rootData,
    asRecord(rootData?.tokens),
    rootResult,
    asRecord(rootResult?.tokens),
  ];

  for (const candidate of tokenCandidates) {
    const accessToken = readString(candidate, ["accessToken", "access_token", "token"]);
    const refreshToken = readString(candidate, ["refreshToken", "refresh_token"]);

    if (
      accessToken &&
      refreshToken &&
      accessToken !== refreshToken &&
      !isLikelyRefreshToken(accessToken, refreshToken)
    ) {
      return { accessToken, refreshToken };
    }
  }

  return undefined;
}

function normalizeUser(payload: unknown): AuthUser | undefined {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);
  const rootCompanies = asRecordArray(root?.companies);
  const rootDataCompanies = asRecordArray(rootData?.companies);
  const rootResultCompanies = asRecordArray(rootResult?.companies);
  const userCandidates = [
    asRecord(root?.user),
    asRecord(rootData?.user),
    asRecord(rootResult?.user),
    root,
    rootData,
    rootResult,
  ];

  for (const candidate of userCandidates) {
    if (!candidate) {
      continue;
    }

    const id = candidate.id ?? candidate.user_id;
    const email = readString(candidate, ["email"]);
    const companyCandidates = [
      asRecord(candidate.company),
      asRecord(candidate.active_company),
      asRecord(root?.company),
      asRecord(root?.active_company),
      asRecord(rootData?.company),
      asRecord(rootData?.active_company),
      asRecord(rootResult?.company),
      asRecord(rootResult?.active_company),
      rootCompanies[0] ?? null,
      rootDataCompanies[0] ?? null,
      rootResultCompanies[0] ?? null,
    ];
    const membershipCandidates = [
      asRecord(candidate.active_company_membership),
      asRecord(root?.active_company_membership),
      asRecord(rootData?.active_company_membership),
      asRecord(rootResult?.active_company_membership),
      rootCompanies[0] ?? null,
      rootDataCompanies[0] ?? null,
      rootResultCompanies[0] ?? null,
    ];
    const fullNameParts = [readString(candidate, ["first_name", "firstName"]), readString(candidate, ["last_name", "lastName"])]
      .filter(Boolean)
      .join(" ")
      .trim();
    const fullName =
      readString(candidate, ["fullName", "full_name", "name"]) ??
      (fullNameParts || (email ? email.split("@")[0]?.replace(/[._-]+/g, " ").trim() : undefined));

    if ((typeof id === "string" || typeof id === "number") && email && fullName) {
      const companyRecord = asRecord(candidate.company);
      const resolvedCompanyRecord =
        companyCandidates.find((entry) => entry && (readString(entry, ["name", "company_name", "companyName"]) || readNumber(entry, ["id", "company_id", "companyId"]))) ??
        companyRecord;
      const resolvedMembershipRecord =
        membershipCandidates.find((entry) => entry && (readString(entry, ["employee_no", "user_no"]) || readNumber(entry, ["employee_id", "employeeId", "membershipId"]))) ??
        null;
      const employeeId =
        readString(candidate, ["employee_no", "employeeId", "employee_id", "user_no"]) ??
        readString(resolvedMembershipRecord, ["employee_no", "employeeId", "employee_id", "user_no"]) ??
        (() => {
          const numericEmployeeId =
            readNumber(candidate, ["employee_id", "employeeId"]) ??
            readNumber(resolvedMembershipRecord, ["employee_id", "employeeId", "employeeId"]);
          return numericEmployeeId !== null && numericEmployeeId !== undefined
            ? String(numericEmployeeId)
            : undefined;
        })();
      return {
        id,
        fullName,
        email,
        role: readRole(candidate),
        scope: readAuthScope(payload),
        dashboardType: readDashboardType(payload),
        employeeId,
        requiresPasswordChange:
          readBoolean(candidate, [
            "requiresPasswordChange",
            "requires_password_change",
          ]) ??
          readBoolean(root, [
            "requiresPasswordChange",
            "requires_password_change",
          ]) ??
          readBoolean(rootData, [
            "requiresPasswordChange",
            "requires_password_change",
          ]) ??
          readBoolean(rootResult, [
            "requiresPasswordChange",
            "requires_password_change",
          ]),
        companyId:
          readNumber(candidate, ["companyId", "company_id"]) ??
          readNumber(resolvedCompanyRecord, ["companyId", "company_id", "id"]),
        companyName:
          readString(candidate, ["companyName", "company_name", "organization_name"]) ??
          readString(resolvedCompanyRecord, ["companyName", "company_name", "name", "display_name"]),
        permissions: readPermissionLabelsFromUnknown(candidate, root, rootData, rootResult),
        accessContextResolved: hasExplicitAccessContext(payload),
      };
    }
  }

  return undefined;
}

function normalizeLoginResponse(payload: unknown): LoginResponse {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const rootResult = asRecord(root?.result);

  const tempToken =
    readString(root, ["tempToken", "temp_token", "temporary_token", "temporaryToken"]) ??
    readString(rootData, ["tempToken", "temp_token", "temporary_token", "temporaryToken"]) ??
    readString(rootResult, ["tempToken", "temp_token", "temporary_token", "temporaryToken"]);

  const tokens = normalizeTokens(payload);
  const user = normalizeUser(payload);
  const scope = readAuthScope(payload) ?? user?.scope;
  const dashboardType = readDashboardType(payload) ?? user?.dashboardType;
  const twoFactorKeys = [
    "requiresOtp",
    "requires_otp",
    "requires2FA",
    "requires_2fa",
    "twoFactorRequired",
    "two_factor_required",
    "mfaRequired",
    "mfa_required",
  ] as const;
  const explicitRequiresOtp =
    readBoolean(root, [...twoFactorKeys]) ??
    readBoolean(rootData, [...twoFactorKeys]) ??
    readBoolean(rootResult, [...twoFactorKeys]);

  // Login step returns a temporary token when 2FA is required (no final JWT pair yet).
  const requiresOtp = explicitRequiresOtp === true || Boolean(tempToken && !tokens);
  const requiresPasswordChange =
    readBoolean(root, ["requiresPasswordChange", "requires_password_change"]) ??
    readBoolean(rootData, ["requiresPasswordChange", "requires_password_change"]) ??
    readBoolean(rootResult, ["requiresPasswordChange", "requires_password_change"]) ??
    user?.requiresPasswordChange ??
    false;
  const requiresEmailVerification =
    readBoolean(root, ["requiresEmailVerification", "requires_email_verification"]) ??
    readBoolean(rootData, ["requiresEmailVerification", "requires_email_verification"]) ??
    readBoolean(rootResult, ["requiresEmailVerification", "requires_email_verification"]) ??
    false;
  const requires2FASetup =
    readBoolean(root, ["requires2FASetup", "requires_2fa_setup"]) ??
    readBoolean(rootData, ["requires2FASetup", "requires_2fa_setup"]) ??
    readBoolean(rootResult, ["requires2FASetup", "requires_2fa_setup"]) ??
    false;
  const message =
    readString(root, ["message"]) ??
    readString(rootData, ["message"]) ??
    readString(rootResult, ["message"]);

  if (user) {
    user.requiresPasswordChange = requiresPasswordChange;
    user.scope = scope;
    user.dashboardType = dashboardType;
  }

  return {
    requiresOtp,
    tempToken,
    tokens,
    user,
    scope,
    dashboardType,
    requiresPasswordChange,
    requiresEmailVerification,
    requires2FASetup,
    message,
  };
}

function normalizeVerifyOtpResponse(payload: unknown): VerifyOtpResponse {
  const tokens = normalizeTokens(payload);
  let user = normalizeUser(payload);
  const dashboardType = readDashboardType(payload);
  const scope = readAuthScope(payload);

  // Complete-login may return a minimal user { id, email } without names.
  if (!user && tokens) {
    const root = asRecord(payload);
    const rootData = asRecord(root?.data);
    const candidate =
      asRecord(root?.user) ?? asRecord(rootData?.user) ?? rootData ?? root;
    const id = candidate?.id ?? candidate?.user_id;
    const email = readString(candidate, ["email"]);
    if ((typeof id === "string" || typeof id === "number") && email) {
      user = {
        id,
        email,
        fullName:
          readString(candidate, ["fullName", "full_name", "name"]) ??
          email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ??
          email,
        dashboardType,
        scope,
      };
    }
  }

  if (user && dashboardType) {
    user.dashboardType = dashboardType;
  }
  if (user && scope) {
    user.scope = scope;
  }

  if (!tokens) {
    throw new Error("2FA verification response is missing session tokens.");
  }
  if (!user) {
    throw new Error("2FA verification response is missing user profile data.");
  }

  return { tokens, user };
}

function normalizeSwitchCompanyResponse(payload: unknown): AuthSwitchCompanyResponse {
  const root = asRecord(payload);
  const rootData = asRecord(root?.data);
  const accessToken =
    readString(root, ["access_token", "accessToken", "token"]) ??
    readString(rootData, ["access_token", "accessToken", "token"]);

  if (!accessToken) {
    throw new Error("Company switch response did not include a new access token.");
  }

  // The documented response only guarantees the refreshed token and company
  // identity. Read context claims from that token so the UI changes shells
  // immediately even when `scope` and `dashboard_type` are omitted by the API.
  const tokenPayload = decodeJwtPayload(accessToken);

  return {
    accessToken,
    scope: readAuthScope(payload) ?? readAuthScope(tokenPayload),
    dashboardType: readDashboardType(payload) ?? readDashboardType(tokenPayload),
    companyId:
      readNumber(root, ["company_id", "companyId"]) ??
      readNumber(rootData, ["company_id", "companyId"]) ??
      readNumber(tokenPayload, ["company_id", "companyId"]),
    companyName:
      readString(root, ["company_name", "companyName"]) ??
      readString(rootData, ["company_name", "companyName"]) ??
      readString(tokenPayload, ["company_name", "companyName"]),
  };
}

export const authService = {
  async login(payload: LoginRequest) {
    const body = {
      email: payload.email,
      password: payload.password,
    };

    const response = await apiRequest("/api/auth/login", ApiResponseSchema, {
      method: "POST",
      body,
    });
    return normalizeLoginResponse(response);
  },

  async verifyOtp(payload: VerifyOtpRequest) {
    // Backend Complete2FALoginDto accepts tempToken + code (login flow).
    const response = await apiRequest("/api/auth/2fa/complete-login", ApiResponseSchema, {
      method: "POST",
      body: {
        tempToken: payload.tempToken,
        code: payload.code,
      },
    });
    return normalizeVerifyOtpResponse(response);
  },

  async setupTwoFactor(token: string): Promise<TwoFactorSetupResponse> {
    const response = await apiRequest("/api/users/2fa/setup", ApiResponseSchema, {
      method: "POST",
      token,
    });
    const root = asRecord(response);
    const data = asRecord(root?.data) ?? root;
    const secret = readString(data, ["secret", "base32", "base32Secret"]);
    if (!secret) {
      throw new Error("2FA setup response did not include a secret.");
    }
    return {
      secret,
      qrCode: readString(data, ["qrCode", "qr_code", "qr"]),
      otpAuthUrl: readString(data, ["otpAuthUrl", "otp_auth_url", "otpauth_url", "uri"]),
    };
  },

  async verifyTwoFactor(token: string, code: string) {
    return apiRequest("/api/users/2fa/verify", ApiResponseSchema, {
      method: "POST",
      token,
      body: { token: code },
    });
  },

  async disableTwoFactor(token: string, code: string) {
    return apiRequest("/api/users/2fa/disable", ApiResponseSchema, {
      method: "POST",
      token,
      body: { token: code },
    });
  },

  async regenerateBackupCodes(token: string, code: string): Promise<string[]> {
    const response = await apiRequest(
      "/api/users/2fa/backup-codes/regenerate", ApiResponseSchema,
      {
        method: "POST",
        token,
        body: { token: code.trim() },
      },
    );
    return extractBackupCodes(response);
  },

  async getSecurityFlags(token: string): Promise<UserSecurityFlags> {
    const response = await apiRequest("/api/users/me", ApiResponseSchema, {
      method: "GET",
      token,
    });
    const root = asRecord(response);
    const candidates = [
      asRecord(root?.user),
      asRecord(asRecord(root?.data)?.user),
      asRecord(root?.data),
      root,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const hasTwoFactorField =
        "is_two_factor_enabled" in candidate ||
        "isTwoFactorEnabled" in candidate ||
        "two_factor_enabled" in candidate ||
        "twoFactorEnabled" in candidate ||
        "is_2fa_enabled" in candidate ||
        "is2faEnabled" in candidate ||
        "is2FAEnabled" in candidate ||
        "mfa_enabled" in candidate ||
        "mfaEnabled" in candidate ||
        "totp_enabled" in candidate ||
        "totpEnabled" in candidate ||
        "two_factor_status" in candidate ||
        "twoFactorStatus" in candidate;
      const hasEmailField =
        "is_email_verified" in candidate ||
        "isEmailVerified" in candidate ||
        "email_verified" in candidate ||
        "emailVerified" in candidate;
      if (!hasTwoFactorField && !hasEmailField) continue;
      return {
        isTwoFactorEnabled:
          readBoolean(candidate, [
            "is_two_factor_enabled",
            "isTwoFactorEnabled",
            "two_factor_enabled",
            "twoFactorEnabled",
            "is_2fa_enabled",
            "is2faEnabled",
            "is2FAEnabled",
            "mfa_enabled",
            "mfaEnabled",
            "totp_enabled",
            "totpEnabled",
          ]) ?? false,
        isEmailVerified:
          readBoolean(candidate, [
            "is_email_verified",
            "isEmailVerified",
            "email_verified",
            "emailVerified",
          ]) ?? false,
      };
    }
    return { isTwoFactorEnabled: false, isEmailVerified: false };
  },

  async resendVerification(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new Error("Email is required.");
    }
    await apiRequest("/api/auth/resend-verification", ApiResponseSchema, {
      method: "POST",
      body: { email: normalizedEmail },
    });
  },

  async verifyEmail(token: string): Promise<void> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new Error("Verification token is missing.");
    }
    const searchParams = new URLSearchParams({ token: normalizedToken });
    await apiRequest(`/api/auth/verify-email?${searchParams.toString()}`, ApiResponseSchema, {
      method: "GET",
    });
  },

  async logoutAll(token: string): Promise<void> {
    const accessToken = token.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    await apiRequest("/api/auth/logout-all", ApiResponseSchema, {
      method: "POST",
      token: accessToken,
    });
  },

  async listSessions(token: string): Promise<AuthSessionRecord[]> {
    const accessToken = token.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    const response = await apiRequest("/api/auth/sessions", ApiResponseSchema, {
      method: "GET",
      token: accessToken,
    });
    return normalizeAuthSessions(response);
  },

  async revokeSession(token: string, sessionId: string): Promise<void> {
    const accessToken = token.trim();
    const normalizedSessionId = sessionId.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    if (!normalizedSessionId) {
      throw new Error("Session id is required.");
    }
    await apiRequest(`/api/auth/sessions/${encodeURIComponent(normalizedSessionId)}`, ApiResponseSchema, {
      method: "DELETE",
      token: accessToken,
    });
  },

  async switchCompany(token: string, companyId: number): Promise<AuthSwitchCompanyResponse> {
    const accessToken = token.trim();
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in again.");
    }
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new Error("A valid company id is required.");
    }
    const response = await apiRequest("/api/auth/switch-company", ApiResponseSchema, {
      method: "POST",
      token: accessToken,
      body: { company_id: companyId },
    });
    return normalizeSwitchCompanyResponse(response);
  },

  async refresh(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiRequest("/api/auth/refresh", ApiResponseSchema, {
      method: "POST",
      body: { refresh_token: refreshToken },
    });

    const tokens = normalizeTokens(response);
    const user = normalizeUser(response);
    if (!tokens) {
      throw new Error("Refresh response did not contain valid tokens.");
    }

    return { tokens, user };
  },

  changePassword(payload: ChangePasswordRequest, token: string) {
    return apiRequest("/api/users/me/change-password", ApiResponseSchema, {
      method: "POST",
      body: {
        old_password: payload.currentPassword,
        new_password: payload.newPassword,
      },
      token,
    });
  },

  /**
   * Request a password-reset email.
   * POST /api/auth/forgot-password  body: { email }
   * Always resolves on success; backends may return 200 with an empty body.
   */
  async forgotPassword(payload: ForgotPasswordRequest): Promise<void> {
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required.");
    }
    await apiRequest("/api/auth/forgot-password", ApiResponseSchema, {
      method: "POST",
      body: { email },
    });
  },

  /**
   * Complete password reset with the email token.
   * POST /api/auth/reset-password  body: { token, new_password }
   * 410 → token expired; 400 → validation error.
   */
  async resetPassword(payload: ResetPasswordRequest): Promise<void> {
    const token = payload.token.trim();
    const newPassword = payload.new_password;
    if (!token) {
      throw new Error("Reset token is missing. Open the link from your email again.");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    try {
      await apiRequest("/api/auth/reset-password", ApiResponseSchema, {
        method: "POST",
        body: {
          token,
          new_password: newPassword,
        },
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 410) {
        throw new ApiError(
          error.message || "This reset link has expired or is no longer valid.",
          410,
          error.details
        );
      }
      throw error;
    }
  },

  async getCurrentUser(token: string) {
    const response = await apiRequest("/api/users/me", ApiResponseSchema, {
      method: "GET",
      token,
    });

    const user = normalizeUser(response);
    if (!user) {
      throw new Error("Current user response is missing required profile fields.");
    }

    return user;
  },

  async logout(tokens?: Partial<AuthTokens> | null) {
    const accessToken = tokens?.accessToken?.trim() ?? "";
    const refreshToken = tokens?.refreshToken?.trim() ?? "";
    if (!accessToken) {
      return;
    }

    // Session is identified by the Bearer access token. Include refresh_token
    // only when we still have one — a blank refresh must not skip logout.
    await apiRequest("/api/auth/logout", EmptyResponseSchema, {
      method: "POST",
      token: accessToken,
      body: refreshToken ? { refresh_token: refreshToken } : {},
    }).catch(() => undefined);
  },
};
```

## [src/components/auth/session-expiry-guard.tsx](/home/innocent/systems/hrms/src/components/auth/session-expiry-guard.tsx)

```typescript
"use client";

import * as React from "react";

import {
  clearStoredSession,
  persistSessionUser,
  persistSessionTokens,
  readJwtExpiry,
  readStoredSessionTokens,
  redirectToLogin,
} from "@/lib/session-client";
import {
  DASHBOARD_ACCESS_REFRESH_EVENT,
  DASHBOARD_PERMISSION_STORAGE_KEY,
  publishDashboardActorSnapshot,
  publishDashboardActorSnapshotFromBrowserStorage,
  publishDashboardActorSnapshotFromSources,
  readDashboardActorSnapshotFromBrowser,
} from "@/lib/dashboard-permissions";
import { authService } from "@/services/authService";
import { ApiError } from "@/services/api";
import { ROUTES } from "@/utils/constants";
import { env } from "@/lib/env";

const SESSION_CHECK_INTERVAL_MS = env.NEXT_PUBLIC_SESSION_CHECK_INTERVAL_MS;
const ACCESS_TOKEN_REFRESH_WINDOW_MS = env.NEXT_PUBLIC_TOKEN_REFRESH_WINDOW_MS;

export function SessionExpiryGuard() {
  const refreshInFlightRef = React.useRef<Promise<void> | null>(null);
  const accessSyncInFlightRef = React.useRef<Promise<
    "ok" | "unauthorized" | "failed"
  > | null>(null);
  const lastAccessSyncAtRef = React.useRef(0);

  const expireSession = React.useCallback(() => {
    clearStoredSession();
    redirectToLogin();
  }, []);

  const isProtectedPath = React.useCallback((pathname: string) => {
    return (
      pathname.startsWith(ROUTES.dashboard) ||
      pathname.startsWith(ROUTES.onboarding)
    );
  }, []);

  const syncAccessContext = React.useCallback(
    async (accessToken: string, force = false) => {
      if (
        !force &&
        Date.now() - lastAccessSyncAtRef.current < SESSION_CHECK_INTERVAL_MS
      ) {
        return "ok" as const;
      }

      if (!accessSyncInFlightRef.current) {
        accessSyncInFlightRef.current = (async () => {
          const cachedActor = readDashboardActorSnapshotFromBrowser();
          if (cachedActor.scope === "platform") {
            // /api/users/me is company-membership scoped and correctly rejects
            // platform-only owners. Re-verify from the signed login/JWT context
            // instead of repeatedly turning that expected 403 into shell churn.
            publishDashboardActorSnapshotFromBrowserStorage(accessToken);
            lastAccessSyncAtRef.current = Date.now();
            return "ok" as const;
          }

          try {
            const user = await authService.getCurrentUser(accessToken);
            if (readStoredSessionTokens().accessToken !== accessToken)
              return "failed" as const;
            persistSessionUser(user);
            // When /api/users/me explicitly includes access fields it replaces
            // every cached/JWT permission. Older API deployments that omit the
            // access context retain the current token as a compatibility fallback.
            publishDashboardActorSnapshotFromSources(
              user,
              ...(user.accessContextResolved ? [] : [accessToken]),
            );
            lastAccessSyncAtRef.current = Date.now();
            return "ok" as const;
          } catch (errorObject) {
            if (readStoredSessionTokens().accessToken !== accessToken)
              return "failed" as const;
            if (
              errorObject instanceof ApiError &&
              errorObject.statusCode === 401
            ) {
              return "unauthorized" as const;
            }
            // A temporary network outage must not make the authenticated shell
            // unusable. Prefer the last exact live snapshot; only older sessions
            // without one need the legacy browser/JWT compatibility fallback.
            if (
              window.sessionStorage.getItem(
                DASHBOARD_PERMISSION_STORAGE_KEY,
              ) !== null
            ) {
              publishDashboardActorSnapshot(
                readDashboardActorSnapshotFromBrowser(),
              );
            } else {
              publishDashboardActorSnapshotFromBrowserStorage(accessToken);
            }
            return "failed" as const;
          } finally {
            accessSyncInFlightRef.current = null;
          }
        })();
      }

      return accessSyncInFlightRef.current;
    },
    [],
  );

  const ensureFreshSession = React.useCallback(
    async (forceAccessSync = false) => {
      if (typeof window === "undefined") {
        return;
      }

      const pathname = window.location.pathname;

      if (pathname === ROUTES.login) {
        return;
      }

      const { accessToken, refreshToken } = readStoredSessionTokens();
      if (!accessToken) {
        if (isProtectedPath(pathname)) {
          expireSession();
        }
        return;
      }

      const accessExpiry = readJwtExpiry(accessToken);
      let activeAccessToken = accessToken;

      if (
        accessExpiry !== null &&
        accessExpiry - Date.now() <= ACCESS_TOKEN_REFRESH_WINDOW_MS &&
        !refreshToken
      ) {
        expireSession();
        return;
      }

      if (
        accessExpiry !== null &&
        accessExpiry - Date.now() <= ACCESS_TOKEN_REFRESH_WINDOW_MS &&
        refreshToken &&
        !refreshInFlightRef.current
      ) {
        refreshInFlightRef.current = (async () => {
          try {
            const response = await authService.refresh(refreshToken);
            const nextAccessToken = response.tokens.accessToken.trim();
            const nextRefreshToken = response.tokens.refreshToken.trim();

            if (!nextAccessToken || !nextRefreshToken) {
              expireSession();
              return;
            }

            if (
              readStoredSessionTokens().refreshToken !== refreshToken ||
              readStoredSessionTokens().accessToken !== accessToken
            )
              return;
            persistSessionTokens(
              nextAccessToken,
              nextRefreshToken,
              response.user,
            );
            activeAccessToken = nextAccessToken;
          } catch {
            if (
              readStoredSessionTokens().accessToken === accessToken &&
              readStoredSessionTokens().refreshToken === refreshToken
            )
              expireSession();
          } finally {
            refreshInFlightRef.current = null;
          }
        })();
      }

      if (refreshInFlightRef.current) {
        await refreshInFlightRef.current;
        activeAccessToken =
          readStoredSessionTokens().accessToken || activeAccessToken;
      }

      const accessSyncResult = await syncAccessContext(
        activeAccessToken,
        forceAccessSync,
      );
      if (accessSyncResult === "unauthorized") {
        expireSession();
      }
    },
    [expireSession, isProtectedPath, syncAccessContext],
  );

  React.useEffect(() => {
    void ensureFreshSession(true);

    const intervalId = window.setInterval(() => {
      void ensureFreshSession();
    }, SESSION_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void ensureFreshSession(true);
      }
    };

    const handleFocus = () => {
      void ensureFreshSession(true);
    };

    const handleAccessRefreshRequest = () => {
      void ensureFreshSession(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(
      DASHBOARD_ACCESS_REFRESH_EVENT,
      handleAccessRefreshRequest,
    );

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        DASHBOARD_ACCESS_REFRESH_EVENT,
        handleAccessRefreshRequest,
      );
    };
  }, [ensureFreshSession]);

  return null;
}
```

## [src/components/dashboard/admin-dashboard-view.tsx](/home/innocent/systems/hrms/src/components/dashboard/admin-dashboard-view.tsx)

```typescript
"use client";
import {
  clearStoredSession as clearSharedSession,
  persistSessionTokens as persistSharedTokens,
  readStoredSessionTokens as readSharedTokens,
} from "@/lib/session-client";

import * as React from "react";
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth-session-store";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import {
  AppSidebar,
  resolveDashboardSearchItems,
} from "@/components/app-sidebar";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { ThemeTogglerButton } from "@/components/animate-ui/components/buttons/theme-toggler";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog";
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { AccessSkeleton } from "@/components/ui/access-skeleton";
import { SiteHeader } from "@/components/site-header";
import {
  accessControlSectionTabGroups,
  accessGovernanceSectionTabGroups,
} from "@/lib/dashboard-sections";
import {
  isHumanResourcesEmployeeRecord,
  resolveHomeDashboardKind,
} from "@/lib/dashboard-home";
import dynamic from "next/dynamic";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const DataTable = dynamic(
  () => import("@/components/data-table").then((mod) => mod.DataTable),
  { ssr: false },
);
const SupportChatWidget = dynamic(
  () =>
    import("@/components/support-chat-widget").then(
      (mod) => mod.SupportChatWidget,
    ),
  { ssr: false },
);
const AccountSettingsPanel = dynamic(
  () =>
    import("@/components/dashboard/account-settings-panel").then(
      (mod) => mod.AccountSettingsPanel,
    ),
  { ssr: false },
);

const HrAnalyticsDashboard = dynamic(
  () => import("@/components/dashboard/hr-analytics-dashboard"),
  {
    ssr: false,
    loading: () => {
      // After login we already showed a loader on the sign-in screen — skip a second skeleton flash.
      if (typeof window !== "undefined") {
        try {
          if (
            window.sessionStorage.getItem("hrms.dashboard.fromLogin") === "1"
          ) {
            return null;
          }
        } catch {
          // ignore
        }
      }
      return (
        <div className="grid gap-x-4 gap-y-2 px-4 pt-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 lg:px-6">
          {Array.from({ length: 7 }, (_, i) => (
            <div
              key={i}
              className="min-w-0 space-y-1.5 border-b border-border pb-2"
            >
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              <div className="h-8 w-14 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      );
    },
  },
);
import type {
  CatalogQueryParams,
  AdminRecord,
  AdminResourceCollections,
  AdminResourceKey,
  UsersQueryParams,
} from "@/lib/admin-api";

function loadAdminApi() {
  return import("@/lib/admin-api");
}
import {
  useMyProfilePhoto,
  withMyProfilePhotoRevision,
} from "@/lib/my-profile-photo";
import { DashboardIdentityProvider } from "@/components/dashboard/dashboard-identity";
import {
  DEFAULT_COMPANY_MODULES,
  isDashboardRouteEnabledForCompanyModules,
  PLATFORM_COMPANY_MODULES,
  publishCompanyModules,
  readPublishedCompanyModules,
  resolveCompanyDashboardModules,
} from "@/lib/company-modules";
import {
  canAccessDashboardRoute,
  clearDashboardActorSnapshot,
  persistDashboardAccessToken,
  requestDashboardAccessRefresh,
} from "@/lib/dashboard-permissions";
import { useDashboardActor } from "@/hooks/use-dashboard-actor";
import { authService } from "@/services/authService";
import { asRecord, readString } from "@/utils/token-utils";
import { env } from "@/lib/env";
import { AUTH_STORAGE_KEYS, ROUTES } from "@/utils/constants";
import { isSelfServiceDashboardRoute } from "@/lib/dashboard-nav";
import {
  firstVisibleSiblingOrHome,
  rememberForbiddenRoute,
} from "@/lib/forbidden-routes";
import { useHideRememberedForbiddenPath } from "@/hooks/use-forbidden-route-guard";

const FORCE_PASSWORD_RESET_EVENT = "hrms:force-password-reset";
const DEFAULT_USERS_QUERY: Required<UsersQueryParams> = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC",
  search: "",
};
const DEFAULT_CATALOG_QUERY: Required<CatalogQueryParams> = {
  page: 1,
  limit: 20,
  search: "",
};
const DEFAULT_EMPLOYEE_PREFETCH_QUERY = {
  page: 1,
  limit: 20,
  sortBy: "created_at",
  sortOrder: "DESC" as const,
};
const RESOURCE_ROUTE_MAP: Record<AdminResourceKey, string> = {
  users: "/dashboard/employees/all",
  roles: "/dashboard/access-control/roles",
  permissions: "/dashboard/access-control/permissions",
  companies: "/dashboard/companies",
};

function decodeBase64Url(input: string) {
  try {
    const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return atob(padded);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }

  try {
    return asRecord(JSON.parse(decoded));
  } catch {
    return null;
  }
}

function getStringValue(record: AdminRecord | null, keys: string[]) {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function resolveUserAvatarUrl(...sources: Array<AdminRecord | null>) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    const direct = getStringValue(source, [
      "profile_photo_url",
      "photo_url",
      "avatar_url",
      "avatar",
      "image_url",
    ]);
    if (direct) {
      return direct;
    }

    const nestedCandidates = [
      asRecord(source.user),
      asRecord(source.company_user),
      asRecord(asRecord(source.company_user)?.user),
      asRecord(source.profile),
    ];
    for (const nested of nestedCandidates) {
      const nestedValue = getStringValue(nested, [
        "profile_photo_url",
        "photo_url",
        "avatar_url",
        "avatar",
        "image_url",
      ]);
      if (nestedValue) {
        return nestedValue;
      }
    }
  }

  return null;
}

function collectRoleNamesFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    sink.add(value.trim());
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectRoleNamesFromUnknown(entry, sink));
    return;
  }

  const record = asRecord(value);
  if (!record) {
    return;
  }

  const directRole = readString(record, [
    "name",
    "display_name",
    "title",
    "role_name",
    "roleName",
  ]);
  if (directRole) {
    sink.add(directRole);
  }

  for (const key of [
    "role",
    "roles",
    "user_roles",
    "userRoles",
    "assigned_roles",
    "assignedRoles",
    "data",
    "items",
  ]) {
    collectRoleNamesFromUnknown(record[key], sink);
  }
}

function collectAssignedRoleNames(
  value: unknown,
  sink: Set<string>,
  visited = new Set<AdminRecord>(),
) {
  const record = asRecord(value);
  if (!record || visited.has(record)) return;
  visited.add(record);

  for (const key of [
    "role",
    "roles",
    "user_roles",
    "userRoles",
    "assigned_roles",
    "assignedRoles",
  ]) {
    collectRoleNamesFromUnknown(record[key], sink);
  }

  for (const key of [
    "user",
    "company_user",
    "companyUser",
    "membership",
    "employee",
    "profile",
    "data",
    "result",
    "item",
    "dashboard",
    "fallback_dashboard",
  ]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      nested.forEach((entry) => collectAssignedRoleNames(entry, sink, visited));
    } else {
      collectAssignedRoleNames(nested, sink, visited);
    }
  }
}

function formatRoleName(roleName: string) {
  return roleName
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface AdminDashboardViewProps {
  activeResource?: AdminResourceKey;
  showOverview?: boolean;
  showSettings?: boolean;
  useApis?: boolean;
  children?: React.ReactNode;
}

function isUnauthorizedError(errorObject: unknown) {
  if (typeof errorObject === "object" && errorObject !== null) {
    const statusValue = (
      errorObject as { status?: unknown; statusCode?: unknown }
    ).status;
    if (statusValue === 401) {
      return true;
    }
    const statusCodeValue = (
      errorObject as { status?: unknown; statusCode?: unknown }
    ).statusCode;
    if (statusCodeValue === 401) {
      return true;
    }
  }

  const message = errorObject instanceof Error ? errorObject.message : "";
  return /\b401\b|unauthorized/i.test(message);
}

function isPasswordResetRequiredMessage(message: string) {
  return /temporary password|must change.+password|change.+password before continuing|before you can continue/i.test(
    message,
  );
}

function readStoredUserPasswordChangeRequirement() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as { requiresPasswordChange?: unknown };
    return parsed.requiresPasswordChange === true;
  } catch {
    return false;
  }
}

export default function AdminDashboardView({
  activeResource,
  showOverview = false,
  showSettings = false,
  useApis = false,
  children,
}: AdminDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const actorSnapshot = useDashboardActor();
  useHideRememberedForbiddenPath();
  const inferredActiveResource = React.useMemo(() => {
    const match = currentPath.match(
      /^\/dashboard\/(?:(?:access-control\/)?(roles|permissions)|users)(?:\/|$)/,
    );
    return (
      ((match?.[1] ?? match?.[2]) as AdminResourceKey | undefined) ?? undefined
    );
  }, [currentPath]);
  const resolvedActiveResource = activeResource ?? inferredActiveResource;
  const resolvedShowOverview = showOverview || currentPath === "/dashboard";
  const resolvedShowSettings =
    showSettings || currentPath === "/dashboard/settings";
  const resolvedUseApis = useApis || Boolean(resolvedActiveResource);

  // Keep Access Control tabs mounted in the shell so switching Devices → Roles
  // (different route trees) does not remount/refresh the tab rail.
  // Keep Access Control tabs mounted in the shell so switching Devices → Roles
  // (different route trees) does not remount/refresh the tab rail.
  // Platform Access Governance is roles/permissions only — not tenant devices.
  const showAccessControlTabs =
    currentPath === "/dashboard/roles" ||
    currentPath === "/dashboard/permissions" ||
    currentPath === "/dashboard/access-control" ||
    currentPath.startsWith("/dashboard/access-control/");
  const accessControlTabGroups =
    actorSnapshot.scope === "platform"
      ? accessGovernanceSectionTabGroups
      : accessControlSectionTabGroups;
  const authSession = React.useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const token = authSession.tokens?.accessToken ?? "";
  const [collections, setCollections] =
    React.useState<AdminResourceCollections>({
      users: [],
      roles: [],
      permissions: [],
      companies: [],
    });
  const [rows, setRows] = React.useState<AdminRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentAdmin, setCurrentAdmin] = React.useState<AdminRecord | null>(
    null,
  );
  const [currentEmployeeIdentity, setCurrentEmployeeIdentity] =
    React.useState<AdminRecord | null>(null);
  const [currentEmployeeProfile, setCurrentEmployeeProfile] =
    React.useState<AdminRecord | null>(null);
  const [employeeIdentityChecked, setEmployeeIdentityChecked] =
    React.useState(false);
  const [overviewRefreshKey, setOverviewRefreshKey] = React.useState(0);
  const [forcePasswordResetOpen, setForcePasswordResetOpen] =
    React.useState(false);
  const [forcePasswordResetBusy, setForcePasswordResetBusy] =
    React.useState(false);
  const [forcePasswordResetError, setForcePasswordResetError] = React.useState<
    string | null
  >(null);
  const [myCompany, setMyCompany] = React.useState<AdminRecord | null>(null);
  const [usersQuery, setUsersQuery] =
    React.useState<Required<UsersQueryParams>>(DEFAULT_USERS_QUERY);
  const [usersTotal, setUsersTotal] = React.useState<number | null>(null);
  const [usersTotalPages, setUsersTotalPages] = React.useState<number | null>(
    null,
  );
  const [catalogByResource, setCatalogByResource] = React.useState<
    Record<"roles" | "permissions", Required<CatalogQueryParams>>
  >({
    roles: { page: 1, limit: 100, search: "" },
    permissions: DEFAULT_CATALOG_QUERY,
  });
  const [catalogMeta, setCatalogMeta] = React.useState<
    Record<
      "roles" | "permissions",
      { total: number | null; totalPages: number | null }
    >
  >({
    roles: { total: null, totalPages: null },
    permissions: { total: null, totalPages: null },
  });
  const catalogQuery =
    resolvedActiveResource === "roles" ||
    resolvedActiveResource === "permissions"
      ? catalogByResource[resolvedActiveResource]
      : DEFAULT_CATALOG_QUERY;
  const catalogTotal =
    resolvedActiveResource === "roles" ||
    resolvedActiveResource === "permissions"
      ? catalogMeta[resolvedActiveResource].total
      : null;
  const catalogTotalPages =
    resolvedActiveResource === "roles" ||
    resolvedActiveResource === "permissions"
      ? catalogMeta[resolvedActiveResource].totalPages
      : null;

  const resolveStoredTokens = React.useCallback(readSharedTokens, []);

  const clearStoredSession = React.useCallback(clearSharedSession, []);
  const persistSessionTokens = React.useCallback(persistSharedTokens, []);

  const hydrateTokenFromStorage = React.useCallback(() => {
    return resolveStoredTokens().accessToken;
  }, [resolveStoredTokens]);

  const attemptRefreshToken = React.useCallback(async () => {
    const { refreshToken, accessToken: previousAccessToken } =
      resolveStoredTokens();
    if (!refreshToken) {
      return "";
    }

    try {
      const response = await authService.refresh(refreshToken);
      const nextAccessToken = response.tokens.accessToken.trim();
      const nextRefreshToken = response.tokens.refreshToken.trim();
      if (!nextAccessToken || !nextRefreshToken) {
        return "";
      }
      if (
        readSharedTokens().refreshToken !== refreshToken ||
        readSharedTokens().accessToken !== previousAccessToken
      )
        return "";
      persistSessionTokens(nextAccessToken, nextRefreshToken, response.user);
      return nextAccessToken;
    } catch {
      return "";
    }
  }, [persistSessionTokens, resolveStoredTokens]);

  const loadData = React.useCallback(
    async function runLoadData(
      accessToken: string,
      retryOnUnauthorized = true,
    ) {
      // Use path-resolved flag so /dashboard/permissions and /dashboard/roles
      // still hit GET /api/permissions and GET /api/roles even when the layout
      // mounts AdminDashboardView without useApis/activeResource props.
      if (!resolvedUseApis) {
        setLoading(false);
        return;
      }

      if (!accessToken) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // One backend page only. Roles/permissions lists are already paginated
        // server-side — walking every page here trips the API throttle.
        const needsUsers = resolvedActiveResource === "users";
        const needsRoles = resolvedActiveResource === "roles";
        const needsPermissions = resolvedActiveResource === "permissions";

        const rolesQuery = catalogByResource.roles;
        const permissionsQuery = catalogByResource.permissions;
        const api = await loadAdminApi();
        const [usersResult, rolesResult, permissionsResult, admin] =
          await Promise.all([
            needsUsers
              ? api.listUsers(accessToken, usersQuery)
              : Promise.resolve(null),
            needsRoles
              ? api.listRolesCatalog(accessToken, rolesQuery)
              : Promise.resolve(null),
            needsPermissions
              ? api.listResourcePage(
                  "permissions",
                  accessToken,
                  permissionsQuery,
                )
              : Promise.resolve(null),
            api.getCurrentAdmin(accessToken).catch(() => null),
          ]);

        setCollections((previous) => ({
          users: usersResult ? usersResult.rows : previous.users,
          roles: rolesResult ? rolesResult.rows : previous.roles,
          permissions: permissionsResult
            ? permissionsResult.rows
            : previous.permissions,
          companies: previous.companies,
        }));
        setCurrentAdmin(admin);
        if (usersResult) {
          setUsersTotal(usersResult.total);
          setUsersTotalPages(usersResult.totalPages);
        }
        if (rolesResult) {
          setCatalogMeta((previous) => ({
            ...previous,
            roles: {
              total: rolesResult.total,
              totalPages: rolesResult.totalPages,
            },
          }));
        }
        if (permissionsResult) {
          setCatalogMeta((previous) => ({
            ...previous,
            permissions: {
              total: permissionsResult.total,
              totalPages: permissionsResult.totalPages,
            },
          }));
        }
      } catch (errorObject) {
        if (retryOnUnauthorized && isUnauthorizedError(errorObject)) {
          const refreshedToken = await attemptRefreshToken();
          if (refreshedToken) {
            await runLoadData(refreshedToken, false);
            return;
          }

          clearStoredSession();

          setError("Your session has expired. Please log in again.");
          router.replace(ROUTES.login);
          return;
        }

        const message =
          errorObject instanceof Error
            ? errorObject.message
            : "Failed to load dashboard data.";
        if (isPasswordResetRequiredMessage(message)) {
          setError(null);
          setForcePasswordResetOpen(true);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(FORCE_PASSWORD_RESET_EVENT));
          }
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      attemptRefreshToken,
      clearStoredSession,
      resolvedActiveResource,
      resolvedUseApis,
      router,
      token,
      usersQuery,
      catalogByResource,
    ],
  );

  React.useEffect(() => {
    setCollections({ users: [], roles: [], permissions: [], companies: [] });
    setRows([]);
    setMyCompany(null);
    setCurrentAdmin(null);
    setCurrentEmployeeIdentity(null);
    setCurrentEmployeeProfile(null);
  }, [authSession.credentialVersion]);

  React.useEffect(() => {
    setRows(
      resolvedActiveResource ? (collections[resolvedActiveResource] ?? []) : [],
    );
  }, [resolvedActiveResource, collections]);

  React.useEffect(() => {
    if (
      resolvedActiveResource === "roles" ||
      resolvedActiveResource === "permissions"
    ) {
      setLoading(true);
    }
  }, [resolvedActiveResource]);

  const navigateToResource = React.useCallback(
    (resource: AdminResourceKey) => {
      const target = RESOURCE_ROUTE_MAP[resource];
      if (target) {
        router.push(target);
      }
    },
    [router],
  );

  const refreshCurrentResource = React.useCallback(async () => {
    const accessToken = resolveStoredTokens().accessToken;

    await loadData(accessToken);
  }, [loadData, resolveStoredTokens, token]);

  const handleHeaderRefresh = React.useCallback(async () => {
    if (resolvedShowOverview) {
      setOverviewRefreshKey((k) => k + 1);
    }
    if (resolvedUseApis) {
      await refreshCurrentResource();
    }
    router.refresh();
  }, [resolvedShowOverview, resolvedUseApis, refreshCurrentResource, router]);

  const handleCreate = async (
    resource: AdminResourceKey,
    payload: AdminRecord,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    await api.createResource(resource, accessToken, payload);
    await loadData(accessToken);
  };

  const handlePatch = async (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
    payload: AdminRecord,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    await api.patchResource(resource, id, accessToken, payload);
    await loadData(accessToken);
  };

  const handleDelete = async (
    resource: Exclude<AdminResourceKey, "companies">,
    id: string | number,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    await api.deleteResource(resource, id, accessToken);
    await loadData(accessToken);
  };

  const handleCatalogQueryChange = (
    next: Partial<Required<CatalogQueryParams>>,
  ) => {
    if (
      resolvedActiveResource !== "roles" &&
      resolvedActiveResource !== "permissions"
    ) {
      return;
    }
    const resource = resolvedActiveResource;
    setCatalogByResource((previous) => {
      const updated = { ...previous[resource], ...next };
      if (next.search !== undefined && next.page === undefined) {
        updated.page = 1;
      }
      return { ...previous, [resource]: updated };
    });
  };

  const handleUsersQueryChange = (
    next: Partial<Required<UsersQueryParams>>,
  ) => {
    setUsersQuery((previous) => {
      const updated = { ...previous, ...next };
      const shouldResetPage =
        next.search !== undefined ||
        next.sortBy !== undefined ||
        next.sortOrder !== undefined ||
        next.limit !== undefined;
      if (shouldResetPage && next.page === undefined) {
        updated.page = 1;
      }
      return updated;
    });
  };

  const handleUpdateUser = async (
    id: string | number,
    payload: AdminRecord,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    await api.updateUserById(id, accessToken, payload);
    await loadData(accessToken);
  };

  const handleChangeMyPassword = async (
    oldPassword: string,
    newPassword: string,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    await api.changeCurrentUserPassword(accessToken, oldPassword, newPassword);
  };

  const handleForcedPasswordReset = React.useCallback(
    async (payload: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      setForcePasswordResetBusy(true);
      setForcePasswordResetError(null);
      try {
        await handleChangeMyPassword(
          payload.currentPassword,
          payload.newPassword,
        );
        setForcePasswordResetOpen(false);
        clearStoredSession();

        router.replace(ROUTES.login);
      } catch (err) {
        setForcePasswordResetError(
          err instanceof Error ? err.message : "Unable to update password.",
        );
      } finally {
        setForcePasswordResetBusy(false);
      }
    },
    [clearStoredSession, handleChangeMyPassword, router],
  );

  const handleUseDifferentAccountForForcedReset = React.useCallback(() => {
    setForcePasswordResetOpen(false);
    setForcePasswordResetError(null);
    clearStoredSession();

    router.replace(ROUTES.login);
  }, [clearStoredSession, router]);

  const handleSetUserPassword = async (
    id: string | number,
    newPassword: string,
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    await api.resetUserPassword(accessToken, id, newPassword);
    await loadData(accessToken);
  };

  const handleSyncUserRoles = async (
    userId: string | number,
    addRoleIds: (string | number)[],
    removeRoleIds: (string | number)[],
  ) => {
    const accessToken = resolveStoredTokens().accessToken;
    if (!accessToken) {
      throw new Error("Authentication required. Please log in again.");
    }

    const api = await loadAdminApi();
    for (const roleId of addRoleIds) {
      await api.assignRoleToCurrentCompanyUser(accessToken, userId, roleId);
    }
    for (const roleId of removeRoleIds) {
      await api.revokeRoleFromCurrentCompanyUser(accessToken, userId, roleId);
    }
    await loadData(accessToken);
    requestDashboardAccessRefresh();
  };

  const [clientIdentity, setClientIdentity] = React.useState<{
    adminName: string | null;
    adminEmail: string | null;
    companyName: string | null;
    tokenCompanyName: string | null;
    rawUser: AdminRecord | null;
    tokenPayload: AdminRecord | null;
  }>({
    adminName: null,
    adminEmail: null,
    companyName: null,
    tokenCompanyName: null,
    rawUser: null,
    tokenPayload: null,
  });
  const [identityReady, setIdentityReady] = React.useState(false);
  const [companyModulesReady, setCompanyModulesReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let adminName: string | null = null;
    let adminEmail: string | null = null;
    let companyName: string | null = null;
    let parsedUser: AdminRecord | null = null;

    const rawUser = window.localStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as unknown;
        const root = asRecord(parsed);
        parsedUser = root;
        const companyCandidates = [
          root,
          asRecord(root?.company),
          asRecord(root?.organization),
          asRecord(root?.tenant),
        ];

        for (const candidate of companyCandidates) {
          const value = readString(candidate, [
            "companyName",
            "company_name",
            "display_name",
            "company",
            "organization_name",
            "tenant_name",
            "name",
          ]);
          if (value) {
            companyName = value;
            break;
          }
        }

        const composedAdminName =
          [
            readString(root, ["firstName", "first_name"]),
            readString(root, ["lastName", "last_name"]),
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || null;
        adminName =
          readString(root, ["fullName", "full_name", "name"]) ??
          composedAdminName;
        adminEmail = readString(root, ["email"]) ?? null;
      } catch {
        adminName = null;
        adminEmail = null;
        companyName = null;
      }
    }

    const accessToken = resolveStoredTokens().accessToken;
    const payload = accessToken ? decodeJwtPayload(accessToken) : null;
    const tokenCompanyName =
      readString(payload, [
        "companyName",
        "company_name",
        "company",
        "organization_name",
      ]) ?? null;
    setClientIdentity({
      adminName,
      adminEmail,
      companyName,
      tokenCompanyName,
      rawUser: parsedUser,
      tokenPayload: payload,
    });
    setIdentityReady(true);
  }, [resolveStoredTokens]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromStoredUser = () => {
      setForcePasswordResetOpen(
        Boolean(token) && readStoredUserPasswordChangeRequirement(),
      );
    };
    const openFromApiGuard = () => {
      setForcePasswordResetOpen(Boolean(token));
    };

    syncFromStoredUser();
    window.addEventListener("focus", syncFromStoredUser);
    window.addEventListener(FORCE_PASSWORD_RESET_EVENT, openFromApiGuard);

    return () => {
      window.removeEventListener("focus", syncFromStoredUser);
      window.removeEventListener(FORCE_PASSWORD_RESET_EVENT, openFromApiGuard);
    };
  }, [token]);

  const adminName =
    getStringValue(currentAdmin, ["full_name", "fullName", "name"]) ??
    ([
      getStringValue(currentAdmin, ["first_name"]),
      getStringValue(currentAdmin, ["last_name"]),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
      null) ??
    clientIdentity.adminName ??
    null;
  const adminEmail =
    getStringValue(currentAdmin, ["email"]) ??
    clientIdentity.adminEmail ??
    null;
  const { url: myProfilePhotoUrl, revision: myProfilePhotoRevision } =
    useMyProfilePhoto(token);
  const resolvedAdminAvatar =
    myProfilePhotoUrl ||
    resolveUserAvatarUrl(
      currentAdmin,
      currentEmployeeProfile,
      currentEmployeeIdentity,
      clientIdentity.rawUser,
      clientIdentity.tokenPayload,
    ) ||
    null;
  const adminAvatar = myProfilePhotoUrl
    ? withMyProfilePhotoRevision(resolvedAdminAvatar, myProfilePhotoRevision)
    : resolvedAdminAvatar;
  const companyName =
    getStringValue(myCompany, ["company_name", "name", "display_name"]) ??
    getStringValue(currentAdmin, ["company_name", "companyName", "company"]) ??
    clientIdentity.companyName ??
    clientIdentity.tokenCompanyName ??
    null;
  const adminRoleNames = React.useMemo(() => {
    const roleNames = new Set<string>();
    actorSnapshot.roleNames.forEach((roleName) => roleNames.add(roleName));
    collectAssignedRoleNames(currentAdmin, roleNames);
    collectAssignedRoleNames(currentEmployeeProfile, roleNames);
    collectAssignedRoleNames(currentEmployeeIdentity, roleNames);
    collectAssignedRoleNames(clientIdentity.rawUser, roleNames);
    collectAssignedRoleNames(clientIdentity.tokenPayload, roleNames);

    const orderedNames = Array.from(
      new Set(
        Array.from(roleNames)
          .filter(Boolean)
          .map((roleName) => formatRoleName(roleName)),
      ),
    )
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    return orderedNames;
  }, [
    actorSnapshot.roleNames,
    clientIdentity.rawUser,
    clientIdentity.tokenPayload,
    currentAdmin,
    currentEmployeeIdentity,
    currentEmployeeProfile,
  ]);
  const adminRolesLabel =
    adminRoleNames.length > 0 ? adminRoleNames.join(" • ") : null;
  const accessMode = actorSnapshot.accessMode;
  const effectivePermissionLabels = actorSnapshot.permissionLabels;
  const accessIdentityReady = identityReady && actorSnapshot.ready;

  React.useEffect(() => {
    if (!accessIdentityReady) {
      setCompanyModulesReady(false);
      return;
    }

    if (actorSnapshot.scope === "platform") {
      publishCompanyModules(PLATFORM_COMPANY_MODULES);
      setMyCompany(null);
      setCompanyModulesReady(true);
      return;
    }

    if (!token) {
      publishCompanyModules(DEFAULT_COMPANY_MODULES);
      setCompanyModulesReady(true);
      return;
    }

    let active = true;
    setCompanyModulesReady(false);
    void loadAdminApi()
      .then(async (api) => {
        const company = await api.getMyCompany(token);
        if (!active) return;
        setMyCompany(company);
        const modules = await resolveCompanyDashboardModules({
          company,
          extraIdSources: [clientIdentity.rawUser, clientIdentity.tokenPayload],
          loadModules: (id) => api.getCompanyModules(token, id),
        });
        if (!active) return;
        publishCompanyModules(modules);
      })
      .catch(() => {
        if (!active) return;
        setMyCompany(null);
        publishCompanyModules(DEFAULT_COMPANY_MODULES);
      })
      .finally(() => {
        if (active) setCompanyModulesReady(true);
      });

    return () => {
      active = false;
    };
  }, [
    accessIdentityReady,
    actorSnapshot.scope,
    clientIdentity.rawUser,
    clientIdentity.tokenPayload,
    token,
  ]);

  const navigationReady = accessIdentityReady && companyModulesReady;
  const homeDashboardKind = resolveHomeDashboardKind({
    accessMode,
    scope: actorSnapshot.scope,
    permissionLabels: effectivePermissionLabels,
    roleNames: actorSnapshot.roleNames,
  });
  React.useEffect(() => {
    if (
      !accessIdentityReady ||
      !token ||
      actorSnapshot.scope === "platform" ||
      homeDashboardKind !== "employee"
    ) {
      setCurrentEmployeeIdentity(null);
      setCurrentEmployeeProfile(null);
      setEmployeeIdentityChecked(homeDashboardKind !== "employee");
      return;
    }

    let active = true;
    setEmployeeIdentityChecked(false);
    void loadAdminApi()
      .then(async (api) => {
        const [employee, profile] = await Promise.all([
          api.getCurrentEmployee(token).catch(() => null),
          api.getMyProfile(token).catch(() => null),
        ]);
        let identity = employee;

        // The employee dashboard endpoint is the authoritative source used by
        // the employee home itself and can contain a richer nested department.
        if (!isHumanResourcesEmployeeRecord(identity)) {
          const dashboard = await api
            .getEmployeeDashboard(token)
            .catch(() => null);
          if (isHumanResourcesEmployeeRecord(dashboard)) identity = dashboard;
        }

        if (!isHumanResourcesEmployeeRecord(identity)) {
          const fallbackDashboard = await api
            .getMyDashboard(token)
            .catch(() => null);
          if (isHumanResourcesEmployeeRecord(fallbackDashboard)) {
            identity = fallbackDashboard;
          }
        }

        return { identity, profile };
      })
      .then(({ identity, profile }) => {
        if (!active) return;
        setCurrentEmployeeIdentity(identity);
        setCurrentEmployeeProfile(profile);
      })
      .catch(() => {
        if (!active) return;
        setCurrentEmployeeIdentity(null);
        setCurrentEmployeeProfile(null);
      })
      .finally(() => {
        if (active) setEmployeeIdentityChecked(true);
      });

    return () => {
      active = false;
    };
  }, [accessIdentityReady, actorSnapshot.scope, homeDashboardKind, token]);

  React.useEffect(() => {
    if (
      !resolvedShowOverview ||
      !accessIdentityReady ||
      !token ||
      currentAdmin
    ) {
      return;
    }

    let active = true;
    void loadAdminApi()
      .then((api) => api.getCurrentAdmin(token))
      .then((admin) => {
        if (active) setCurrentAdmin(admin);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [accessIdentityReady, currentAdmin, resolvedShowOverview, token]);

  const effectiveHomeDashboardKind =
    homeDashboardKind === "employee" &&
    isHumanResourcesEmployeeRecord(currentEmployeeIdentity)
      ? "hr"
      : homeDashboardKind;
  const showWorkforceDashboard =
    accessIdentityReady &&
    (effectiveHomeDashboardKind === "company" ||
      effectiveHomeDashboardKind === "hr");
  const checkingEmployeeDashboardIdentity =
    accessIdentityReady &&
    homeDashboardKind === "employee" &&
    !employeeIdentityChecked;

  React.useEffect(() => {
    if (!resolvedUseApis || !accessIdentityReady || !token) {
      return;
    }
    void loadData(token);
  }, [
    accessMode,
    currentPath,
    effectivePermissionLabels,
    accessIdentityReady,
    token,
    loadData,
    resolvedUseApis,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (
      accessMode !== "admin" ||
      actorSnapshot.scope === "platform" ||
      !token
    ) {
      return;
    }

    const prefetchEmployees = () => {
      void loadAdminApi()
        .then((api) =>
          api.listEmployees(token, DEFAULT_EMPLOYEE_PREFETCH_QUERY, {
            cacheTtlMs: env.NEXT_PUBLIC_LIST_CACHE_TTL_SHORT_MS,
          }),
        )
        .catch(() => undefined);
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(prefetchEmployees, {
        timeout: 2500,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(prefetchEmployees, 600);
    return () => globalThis.clearTimeout(timeoutId);
  }, [accessMode, actorSnapshot.scope, token]);

  React.useEffect(() => {
    if (!accessIdentityReady) {
      return;
    }

    if (currentPath === "/dashboard") {
      return;
    }

    if (isSelfServiceDashboardRoute(currentPath)) {
      return;
    }

    if (
      currentPath === "/dashboard/performance" ||
      currentPath.startsWith("/dashboard/performance/")
    ) {
      return;
    }

    if (
      !canAccessDashboardRoute(
        currentPath,
        effectivePermissionLabels,
        accessMode,
      )
    ) {
      rememberForbiddenRoute(currentPath);
      router.replace(
        firstVisibleSiblingOrHome(
          currentPath,
          effectivePermissionLabels,
          accessMode,
        ),
      );
    }
  }, [
    accessMode,
    currentPath,
    effectivePermissionLabels,
    accessIdentityReady,
    router,
  ]);

  return (
    <DashboardIdentityProvider
      value={{
        name: adminName,
        photoUrl: adminAvatar,
        rolesLabel: adminRolesLabel,
        homeDashboardKind: effectiveHomeDashboardKind,
      }}
    >
      <SidebarProvider
        style={
          {
            "--sidebar-width": "15.5rem",
            "--header-height": "calc(var(--spacing) * 14)",
          } as React.CSSProperties
        }
      >
        <AppSidebar
          variant="inset"
          accessMode={accessMode}
          scope={actorSnapshot.scope}
          homeDashboardKind={effectiveHomeDashboardKind}
          identityReady={navigationReady}
          permissionLabels={effectivePermissionLabels}
          activeResource={resolvedActiveResource}
          onSelectResource={navigateToResource}
        />
        <SidebarTrigger
          className="fixed left-3 top-2 z-[60] !hidden text-[var(--sidebar-icon-color)] transition-colors duration-200 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-active-link-color)] md:!inline-flex"
          aria-label="Toggle navigation"
          title="Navigation"
        />
        <SidebarInset className="min-w-0 overflow-hidden">
          {/* Header stays pinned; only this page body scrolls (single scrollbar). */}
          <SiteHeader
            onRefresh={handleHeaderRefresh}
            loading={loading}
            adminName={adminName}
            adminEmail={adminEmail}
            adminAvatar={adminAvatar}
            companyName={companyName}
            scope={actorSnapshot.scope}
            searchItems={
              navigationReady
                ? resolveDashboardSearchItems({
                    scope: actorSnapshot.scope,
                    permissionLabels: effectivePermissionLabels,
                    accessMode,
                    homeDashboardKind: effectiveHomeDashboardKind,
                  })
                : []
            }
          />
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
            <div className="@container/main flex min-w-0 max-w-full flex-col">
              {resolvedShowOverview && showWorkforceDashboard ? (
                <HrAnalyticsDashboard
                  refreshKey={overviewRefreshKey}
                  companyName={companyName}
                  adminRolesLabel={adminRolesLabel}
                  assignedRoleNames={adminRoleNames}
                  userName={adminName}
                  profilePhotoUrl={adminAvatar}
                  showLeaveRequests={effectiveHomeDashboardKind === "hr"}
                  showHrAnalytics={effectiveHomeDashboardKind === "hr"}
                />
              ) : null}
              <div
                className={`flex min-w-0 max-w-full flex-col px-3 pt-0 pb-3 sm:px-4 md:px-4 md:pb-4 ${showAccessControlTabs ? "gap-2 md:gap-3" : "gap-3 md:gap-4"}`}
              >
                {navigationReady && showAccessControlTabs ? (
                  <DashboardSectionTabs groups={accessControlTabGroups} />
                ) : null}
                <div className="min-w-0">
                  {accessIdentityReady ? (
                    resolvedShowOverview &&
                    (showWorkforceDashboard ||
                      checkingEmployeeDashboardIdentity) ? null : (
                      children
                    )
                  ) : (
                    <AccessSkeleton className="min-h-40" variant="dashboard" />
                  )}
                </div>
                {accessIdentityReady &&
                resolvedActiveResource &&
                resolvedUseApis &&
                resolvedActiveResource !== "companies" &&
                (resolvedActiveResource !== "roles" &&
                resolvedActiveResource !== "permissions"
                  ? true
                  : navigationReady &&
                    isDashboardRouteEnabledForCompanyModules(
                      `/dashboard/${resolvedActiveResource}`,
                      readPublishedCompanyModules(),
                    )) ? (
                  <DataTable
                    token={token}
                    activeResource={resolvedActiveResource}
                    rows={rows}
                    roles={collections.roles}
                    permissions={collections.permissions}
                    actorPermissions={effectivePermissionLabels}
                    usersQuery={usersQuery}
                    usersTotal={usersTotal}
                    usersTotalPages={usersTotalPages}
                    onUsersQueryChange={handleUsersQueryChange}
                    catalogQuery={catalogQuery}
                    catalogTotal={catalogTotal}
                    catalogTotalPages={catalogTotalPages}
                    onCatalogQueryChange={handleCatalogQueryChange}
                    loading={
                      loading ||
                      ((resolvedActiveResource === "roles" ||
                        resolvedActiveResource === "permissions") &&
                        !token)
                    }
                    error={error}
                    onCreate={handleCreate}
                    onPatch={handlePatch}
                    onDelete={handleDelete}
                    onUpdateUser={handleUpdateUser}
                    onSetUserPassword={handleSetUserPassword}
                    onSyncUserRoles={handleSyncUserRoles}
                    onRefresh={refreshCurrentResource}
                  />
                ) : null}
                {accessIdentityReady && resolvedShowSettings ? (
                  <AccountSettingsPanel
                    token={token}
                    loading={loading}
                    onChangeMyPassword={handleChangeMyPassword}
                    profilePhotoUrl={adminAvatar}
                    displayName={adminName}
                    profilePictureHref={
                      actorSnapshot.scope !== "platform"
                        ? "/dashboard/me/profile?tab=summary&edit=profile-photo"
                        : null
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        </SidebarInset>
        <Dialog open={forcePasswordResetOpen}>
          <DialogPopup
            className="!h-dvh !w-screen !max-w-none !max-h-none !rounded-none !border-0 !p-0"
            bodyClassName="!h-full !max-h-none !gap-0 !overflow-y-auto !p-0"
            showCloseButton={false}
          >
            <div className="relative flex min-h-full w-full items-center justify-center bg-background p-3 text-card-foreground sm:p-5 lg:p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
              <div className="fixed right-3 top-3 z-20 md:right-4 md:top-4">
                <ThemeTogglerButton
                  variant="ghost"
                  size="icon-sm"
                  modes={["light", "dark", "system"]}
                  className="!border-0 !bg-transparent text-foreground !shadow-none hover:!bg-transparent"
                />
              </div>
              <div className="relative z-10 w-full max-w-[860px] py-8 sm:py-10">
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xl md:grid md:min-h-[min(640px,calc(100dvh-4rem))] md:grid-cols-2">
                  <section
                    className="relative hidden flex-col justify-between overflow-hidden p-8 text-white md:flex lg:p-10"
                    style={{ backgroundColor: "var(--colorBrandBackground)" }}
                    aria-label="Alliance HRMS account security"
                  >
                    <div className="relative z-10">
                      <span className="text-sm font-semibold tracking-tight">
                        Alliance HRMS
                      </span>
                      <div className="mt-16 max-w-sm">
                        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                          <ShieldCheck className="size-6" />
                        </div>
                        <h1 className="text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
                          A fresh start for your account.
                        </h1>
                        <p className="mt-4 text-sm leading-6 text-white/80">
                          Choose a personal password to keep your HRMS account
                          secure.
                        </p>
                      </div>
                    </div>
                    <p className="relative z-10 text-xs text-white/60">
                      © {new Date().getFullYear()} Alliance Insurance
                      Corporation Ltd
                    </p>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#fff_0.9px,transparent_1px)] bg-[length:5px_5px] opacity-20" />
                  </section>

                  <section className="flex min-w-0 items-center bg-background px-5 py-7 sm:px-8 sm:py-9 md:bg-card lg:px-10">
                    <div className="mx-auto w-full max-w-[360px]">
                      <div className="mb-6 text-center md:hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/assets/alliance-logo.png"
                          alt="Alliance Insurance"
                          className="mx-auto mb-4 h-8 w-auto dark:brightness-0 dark:invert"
                        />
                        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <LockKeyhole className="size-5" />
                        </div>
                      </div>
                      <DialogHeader className="mb-5">
                        <DialogTitle className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                          Change your temporary password
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-5 text-muted-foreground">
                          Your administrator provided a temporary password.
                          Create a new one before continuing.
                        </DialogDescription>
                      </DialogHeader>
                      <ChangePasswordForm
                        onSubmit={handleForcedPasswordReset}
                        loading={forcePasswordResetBusy}
                        error={forcePasswordResetError}
                        requiredMode
                        onUseDifferentAccount={
                          handleUseDifferentAccountForForcedReset
                        }
                      />
                    </div>
                  </section>
                </div>
                <p className="mt-4 text-center text-[10px] text-muted-foreground md:hidden">
                  © {new Date().getFullYear()} Alliance Insurance Corporation
                  Ltd
                </p>
              </div>
            </div>
          </DialogPopup>
        </Dialog>
        <SupportChatWidget />
      </SidebarProvider>
    </DashboardIdentityProvider>
  );
}
```

## [src/components/dashboard/account-settings-panel.tsx](/home/innocent/systems/hrms/src/components/dashboard/account-settings-panel.tsx)

```typescript
"use client"

import { FluentLoadingIndicator } from "@/components/common/FluentLoadingIndicator"
import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircle2, Copy, ImageIcon, InfoIcon, KeyRound, LogOut, MailCheck, RefreshCw, ShieldCheck, ShieldOff, Smartphone, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/fluent-toast-store"
import {
  extractDefaultAvatarImageUrl,
  extractBackupCodes,
  extractProfilePhotoUrl,
  listSelectableAvatarsForMe,
  listMyNotificationPreferences,
  readDefaultAvatarId,
  selectMyUserAvatar,
  setMyNotificationPreference,
  uploadMyProfilePhoto,
  type AdminRecord,
  type NotificationChannel,
  type NotificationPreference,
  type NotificationPreferenceType,
} from "@/lib/admin-api"
import { setMyProfilePhotoUrl } from "@/lib/my-profile-photo"
import { clearStoredSession, persistSessionUser, readStoredSessionTokens } from "@/lib/session-client"
import { showSuccessAlert } from "@/lib/success-alert"
import { useFluentToastState } from "@/components/ui/use-fluent-toast-state"
import { authService } from "@/services/authService"
import type { AuthSessionRecord, TwoFactorSetupResponse } from "@/types"
import { useDashboardActor } from "@/hooks/use-dashboard-actor"
import {
  canAccessDashboardRoute,
  publishDashboardActorSnapshotFromBrowserStorage,
} from "@/lib/dashboard-permissions"
import {
  AUTH_STORAGE_KEYS,
  ROUTES,
  SETTINGS_SECURITY_TABS,
  buildDashboardResetPasswordHref,
} from "@/utils/constants"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/animate-ui/components/base/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AccountSettingsPanelProps {
  token: string
  loading: boolean
  onChangeMyPassword: (oldPassword: string, newPassword: string) => Promise<void>
  profilePhotoUrl?: string | null
  displayName?: string | null
  profilePictureHref?: string | null
}

type SecurityTab = "reset-password" | "two-factor" | "devices" | "email"

const NOTIFICATION_PREFERENCE_CHANNELS: NotificationChannel[] = [
  "IN_APP",
  "EMAIL",
  "SMS",
  "PUSH",
]

const NOTIFICATION_PREFERENCE_GROUPS: Array<{
  title: string
  types: NotificationPreferenceType[]
}> = [
  {
    title: "General",
    types: ["GENERAL", "AUTH_SECURITY", "ACCESS_CHANGE", "SYSTEM_ALERT"],
  },
  {
    title: "Leave",
    types: [
      "LEAVE_SUBMITTED",
      "LEAVE_APPROVAL_REQUIRED",
      "LEAVE_APPROVED",
      "LEAVE_REJECTED",
      "LEAVE_RETURNED_FOR_CORRECTION",
      "LEAVE_CANCELLED",
    ],
  },
  {
    title: "Onboarding",
    types: [
      "ONBOARDING_SUBMITTED",
      "ONBOARDING_APPROVAL_REQUIRED",
      "ONBOARDING_APPROVED",
      "ONBOARDING_REJECTED",
      "ONBOARDING_TASK_ASSIGNED",
      "ONBOARDING_TASK_OVERDUE",
      "ONBOARDING_APPROVAL_REMINDER",
      "ONBOARDING_COMPLETED",
    ],
  },
  {
    title: "Offboarding",
    types: [
      "OFFBOARDING_SUBMITTED",
      "OFFBOARDING_APPROVAL_REQUIRED",
      "OFFBOARDING_APPROVED",
      "OFFBOARDING_TASK_ASSIGNED",
      "OFFBOARDING_TASK_OVERDUE",
      "OFFBOARDING_APPROVAL_REMINDER",
      "OFFBOARDING_CLEARANCE_REQUIRED",
      "OFFBOARDING_CLEARANCE_OVERDUE",
      "OFFBOARDING_ASSET_OVERDUE",
      "OFFBOARDING_SETTLEMENT_OVERDUE",
      "OFFBOARDING_COMPLETED",
    ],
  },
  {
    title: "Attendance",
    types: ["ATTENDANCE_CORRECTION"],
  },
]

function securityTabFromQuery(value: string | null): SecurityTab {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "two-factor" || normalized === "2fa" || normalized === "mfa") return "two-factor"
  if (normalized === "devices" || normalized === "device") return "devices"
  if (normalized === "email" || normalized === "verify-email" || normalized === "verify") return "email"
  if (normalized === "password" || normalized === SETTINGS_SECURITY_TABS.resetPassword) {
    return SETTINGS_SECURITY_TABS.resetPassword
  }
  return SETTINGS_SECURITY_TABS.resetPassword
}

function persistCurrentUserSnapshot(user: unknown, accessToken: string) {
  if (typeof window === "undefined" || !user || typeof user !== "object") {
    return false
  }

  try {
    persistSessionUser(user)
    publishDashboardActorSnapshotFromBrowserStorage(user, accessToken)
    return true
  } catch {
    return false
  }
}

function clearStoredPasswordChangeRequirement(accessToken: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
    if (!raw) {
      return
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return
    }

    const nextUser = {
      ...parsed,
      requiresPasswordChange: false,
    }
    persistCurrentUserSnapshot(nextUser, accessToken)
  } catch {
    // Ignore malformed local cache and rely on the next sync.
  }
}

function resolveQrImageSrc(qrCode?: string | null): string | null {
  if (!qrCode?.trim()) return null
  const value = qrCode.trim()
  if (value.startsWith("data:image")) return value
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`
  }
  // Common API shape: raw base64 PNG/JPEG
  const compact = value.replace(/\s+/g, "")
  if (compact.length > 80 && /^[A-Za-z0-9+/=]+$/.test(compact)) {
    const mime = compact.startsWith("/9j/") ? "image/jpeg" : "image/png"
    return `data:${mime};base64,${compact}`
  }
  return null
}

function normalizeTotpCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6)
}

function formatSessionTimestamp(value?: string) {
  if (!value?.trim()) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function formatNotificationPreferenceLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildNotificationPreferenceKey(
  notificationType: NotificationPreferenceType,
  channel: NotificationChannel
) {
  return `${notificationType}:${channel}`
}

function readNotificationPreferenceType(
  preference: NotificationPreference | null | undefined
): NotificationPreferenceType | null {
  const value = preference?.notification_type ?? preference?.notificationType
  return typeof value === "string" && value.trim()
    ? (value.trim().toUpperCase() as NotificationPreferenceType)
    : null
}

function readNotificationPreferenceChannel(
  preference: NotificationPreference | null | undefined
): NotificationChannel | null {
  const value = preference?.channel
  return typeof value === "string" && value.trim()
    ? (value.trim().toUpperCase() as NotificationChannel)
    : null
}

function readNotificationPreferenceEnabled(
  preference: NotificationPreference | null | undefined
) {
  // The backend treats a missing row as enabled. Reflect that default in the
  // UI instead of making new accounts look opted out of every channel.
  if (!preference) return true
  if (typeof preference.is_enabled === "boolean") return preference.is_enabled
  if (typeof preference.isEnabled === "boolean") return preference.isEnabled
  return false
}

function resolveFreshAccessToken(fallbackToken: string) {
  if (typeof window === "undefined") {
    return fallbackToken.trim()
  }
  const stored = readStoredSessionTokens().accessToken.trim()
  return stored || fallbackToken.trim()
}

function buildSettingsTabHref(pathname: string | null, searchParams: ReturnType<typeof useSearchParams>, tab: SecurityTab) {
  const params = new URLSearchParams(searchParams?.toString() ?? "")
  params.set("tab", tab)
  const query = params.toString()
  const safePathname = pathname?.trim() || "/dashboard"
  return query ? `${safePathname}?${query}` : safePathname
}

function AccountSettingsPanelLoadingFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security & Authentication</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Loading security settings...
      </CardContent>
    </Card>
  )
}

function AccountSettingsPanelContent({
  token,
  loading,
  onChangeMyPassword,
  profilePhotoUrl,
  displayName,
  profilePictureHref,
}: AccountSettingsPanelProps) {
  const router = useRouter()
  const actor = useDashboardActor()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [hasHydrated, setHasHydrated] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<SecurityTab>("reset-password")
  const [requiresPasswordChange, setRequiresPasswordChange] = React.useState(false)
  const [passwordBusy, setPasswordBusy] = React.useState(false)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false)
  const [emailVerified, setEmailVerified] = React.useState(false)
  const [securityLoading, setSecurityLoading] = React.useState(false)
  const [twoFactorBusy, setTwoFactorBusy] = React.useState(false)
  const [setupData, setSetupData] = React.useState<TwoFactorSetupResponse | null>(null)
  const [verifyCode, setVerifyCode] = React.useState("")
  const [disableCode, setDisableCode] = React.useState("")
  const [backupCodes, setBackupCodes] = React.useState<string[]>([])
  const [regenerateCode, setRegenerateCode] = React.useState("")
  const [regenerateBusy, setRegenerateBusy] = React.useState(false)
  const [accountEmail, setAccountEmail] = React.useState("")
  const [emailBusy, setEmailBusy] = React.useState(false)
  const [sessions, setSessions] = React.useState<AuthSessionRecord[]>([])
  const [sessionsLoading, setSessionsLoading] = React.useState(false)
  const [sessionActionId, setSessionActionId] = React.useState<string | null>(null)
  const [sessionMessage, setSessionMessage] = React.useState<string | null>(null)
  const [sessionError, setSessionError] = React.useState<string | null>(null)

  useFluentToastState(sessionMessage, setSessionMessage, "success")
  const [logoutAllBusy, setLogoutAllBusy] = React.useState(false)
  const [notificationPreferences, setNotificationPreferences] = React.useState<NotificationPreference[]>([])
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = React.useState(false)
  const [notificationPreferencesError, setNotificationPreferencesError] = React.useState<string | null>(null)
  const [notificationPreferenceBusyKey, setNotificationPreferenceBusyKey] = React.useState<string | null>(null)
  const [profilePictureOpen, setProfilePictureOpen] = React.useState(false)
  const [profilePictureSaving, setProfilePictureSaving] = React.useState(false)
  const [profilePictureError, setProfilePictureError] = React.useState<string | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = React.useState("")
  const [profilePictureFile, setProfilePictureFile] = React.useState<File | null>(null)
  const [profilePictureFileName, setProfilePictureFileName] = React.useState("")
  const [defaultAvatars, setDefaultAvatars] = React.useState<AdminRecord[]>([])
  const [defaultAvatarsLoading, setDefaultAvatarsLoading] = React.useState(false)
  const [selectedDefaultAvatarId, setSelectedDefaultAvatarId] = React.useState<number | null>(null)
  const profilePictureInputRef = React.useRef<HTMLInputElement | null>(null)
  const canManageDefaultAvatars =
    actor.ready &&
    canAccessDashboardRoute(
      "/dashboard/settings/default-avatars",
      actor.permissionLabels,
      actor.accessMode
    )

  React.useEffect(() => {
    setHasHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hasHydrated) {
      return
    }
    setActiveTab(securityTabFromQuery(searchParams?.get("tab") ?? null))
  }, [hasHydrated, searchParams])

  React.useEffect(() => {
    if (!profilePictureOpen) return
    const accessToken = resolveFreshAccessToken(token)
    setProfilePictureError(null)
    setProfilePicturePreview(profilePhotoUrl ?? "")
    setProfilePictureFile(null)
    setProfilePictureFileName("")
    setSelectedDefaultAvatarId(null)
    if (!accessToken) return

    let cancelled = false
    setDefaultAvatarsLoading(true)
    void listSelectableAvatarsForMe(accessToken)
      .then((rows) => {
        if (!cancelled) setDefaultAvatars(rows)
      })
      .catch(() => {
        if (!cancelled) setDefaultAvatars([])
      })
      .finally(() => {
        if (!cancelled) setDefaultAvatarsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profilePictureOpen, profilePhotoUrl, token])

  const handleProfilePictureFile = React.useCallback((file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setProfilePictureError("Please choose a PNG, JPG, or WEBP image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfilePictureError("Please choose an image smaller than 5 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const preview = typeof reader.result === "string" ? reader.result : ""
      if (!preview) {
        setProfilePictureError("We couldn't read that image. Please choose another file.")
        return
      }
      setProfilePictureError(null)
      setProfilePictureFile(file)
      setProfilePictureFileName(file.name)
      setSelectedDefaultAvatarId(null)
      setProfilePicturePreview(preview)
    }
    reader.onerror = () => setProfilePictureError("We couldn't read that image. Please choose another file.")
    reader.readAsDataURL(file)
  }, [])

  const saveProfilePicture = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      setProfilePictureError("Session expired. Please sign in again.")
      return
    }
    if (!profilePictureFile && selectedDefaultAvatarId == null) {
      setProfilePictureError("Choose a default avatar or upload an image first.")
      return
    }

    setProfilePictureSaving(true)
    setProfilePictureError(null)
    try {
      const result = profilePictureFile
        ? await uploadMyProfilePhoto(accessToken, profilePictureFile)
        : await selectMyUserAvatar(accessToken, selectedDefaultAvatarId!)
      const savedUrl = extractProfilePhotoUrl(result) || profilePicturePreview
      if (savedUrl) setMyProfilePhotoUrl(savedUrl)
      toast.success(profilePictureFile ? "Profile picture updated." : "Default avatar applied.")
      setProfilePictureOpen(false)
    } catch (errorObject) {
      setProfilePictureError(
        errorObject instanceof Error ? errorObject.message : "Could not update your profile picture."
      )
    } finally {
      setProfilePictureSaving(false)
    }
  }, [profilePictureFile, profilePicturePreview, selectedDefaultAvatarId, token])

  React.useEffect(() => {
    if (!hasHydrated) {
      return
    }

    setRequiresPasswordChange(searchParams?.get("required") === "1")
  }, [hasHydrated, searchParams])

  const handleTabChange = React.useCallback(
    (tab: SecurityTab) => {
      if (requiresPasswordChange && tab !== SETTINGS_SECURITY_TABS.resetPassword) {
        router.replace(buildDashboardResetPasswordHref({ required: true }), { scroll: false })
        return
      }
      const nextHref = buildSettingsTabHref(pathname, searchParams, tab)
      router.replace(nextHref, { scroll: false })
    },
    [pathname, requiresPasswordChange, router, searchParams]
  )

  const refreshSecurityFlags = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) return
    setSecurityLoading(true)
    try {
      const [flags, currentUser] = await Promise.all([
        authService.getSecurityFlags(accessToken),
        authService.getCurrentUser(accessToken).catch(() => null),
      ])
      setTwoFactorEnabled(flags.isTwoFactorEnabled)
      setEmailVerified(flags.isEmailVerified)
      if (currentUser?.email) {
        setAccountEmail(currentUser.email)
      }
    } catch {
      // Keep last known state if status fetch fails.
    } finally {
      setSecurityLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void refreshSecurityFlags()
  }, [refreshSecurityFlags])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEYS.user)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw) as { email?: unknown }
      if (typeof parsed.email === "string" && parsed.email.trim()) {
        setAccountEmail(parsed.email.trim())
      }
    } catch {
      // Ignore malformed local session cache and fall back to API refresh.
    }
  }, [])

  const loadSessions = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) return
    setSessionsLoading(true)
    setSessionError(null)
    setSessionMessage(null)
    try {
      const nextSessions = await authService.listSessions(accessToken)
      setSessions(nextSessions)
    } catch (errorObject) {
      setSessions([])
      setSessionError(
        errorObject instanceof Error ? errorObject.message : "Could not load active sessions."
      )
    } finally {
      setSessionsLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    if (activeTab === "devices") {
      void loadSessions()
    }
  }, [activeTab, loadSessions])

  const loadNotificationPreferences = React.useCallback(async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      setNotificationPreferences([])
      return
    }

    setNotificationPreferencesLoading(true)
    setNotificationPreferencesError(null)
    try {
      const rows = await listMyNotificationPreferences(accessToken)
      setNotificationPreferences(rows)
    } catch (errorObject) {
      setNotificationPreferences([])
      setNotificationPreferencesError(
        errorObject instanceof Error
          ? errorObject.message
          : "Could not load notification preferences."
      )
    } finally {
      setNotificationPreferencesLoading(false)
    }
  }, [token])

  React.useEffect(() => {
    void loadNotificationPreferences()
  }, [loadNotificationPreferences])

  const tabIndex =
    activeTab === "reset-password"
      ? 0
      : activeTab === "two-factor"
        ? 1
        : activeTab === "devices"
          ? 2
          : 3
  const avatarLabel = displayName?.trim() || "Your profile"
  const initials =
    avatarLabel
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"

  const qrImageSrc = resolveQrImageSrc(setupData?.qrCode)
  const notificationPreferencesByKey = React.useMemo(() => {
    const map = new Map<string, NotificationPreference>()
    notificationPreferences.forEach((preference) => {
      const notificationType = readNotificationPreferenceType(preference)
      const channel = readNotificationPreferenceChannel(preference)
      if (!notificationType || !channel) return
      map.set(buildNotificationPreferenceKey(notificationType, channel), preference)
    })
    return map
  }, [notificationPreferences])

  const handleChangePassword = async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }) => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      const message = "Your session expired. Please sign in again."
      setPasswordError(message)
      toast.error(message)
      return
    }

    setPasswordBusy(true)
    setPasswordError(null)
    try {
      await onChangeMyPassword(currentPassword, newPassword)
      const currentUser = await authService.getCurrentUser(accessToken).catch(() => null)
      if (!persistCurrentUserSnapshot(currentUser, accessToken)) {
        clearStoredPasswordChangeRequirement(accessToken)
      }
      setRequiresPasswordChange(false)
      showSuccessAlert(
        searchParams?.get("required") === "1"
          ? "Password updated. You can continue in HRMS."
          : "Password changed.",
      )
      if (searchParams?.get("required") === "1") {
        router.replace(buildDashboardResetPasswordHref(), { scroll: false })
      }
      void refreshSecurityFlags()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Password change failed."
      setPasswordError(message)
      toast.error(message)
    } finally {
      setPasswordBusy(false)
    }
  }

  const handleUseDifferentAccount = React.useCallback(() => {
    clearStoredSession()
    window.location.assign(ROUTES.login)
  }, [])

  const handleStartTwoFactorSetup = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    setTwoFactorBusy(true)
    try {
      const setup = await authService.setupTwoFactor(accessToken)
      setSetupData(setup)
      setVerifyCode("")
      toast.message("Scan the QR code with your authenticator app, then enter the 6-digit code.")
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not start 2FA setup."
      toast.error(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleVerifyTwoFactor = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    const code = normalizeTotpCode(verifyCode)
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    setTwoFactorBusy(true)
    try {
      const verifyResult = await authService.verifyTwoFactor(accessToken, code)
      const nextBackupCodes = extractBackupCodes(verifyResult)
      setSetupData(null)
      setVerifyCode("")
      setTwoFactorEnabled(true)
      if (nextBackupCodes.length > 0) {
        setBackupCodes(nextBackupCodes)
        showSuccessAlert("Two-factor authentication is now enabled. Save your backup codes.")
      } else {
        showSuccessAlert("Two-factor authentication is now enabled.")
      }
      void refreshSecurityFlags()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Invalid 2FA code."
      toast.error(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleDisableTwoFactor = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    const code = normalizeTotpCode(disableCode)
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.")
      return
    }
    setTwoFactorBusy(true)
    try {
      await authService.disableTwoFactor(accessToken, code)
      setDisableCode("")
      setSetupData(null)
      setBackupCodes([])
      setRegenerateCode("")
      setTwoFactorEnabled(false)
      showSuccessAlert("Two-factor authentication has been disabled.")
      void refreshSecurityFlags()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not disable 2FA."
      toast.error(message)
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const handleRegenerateBackupCodes = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    const code = regenerateCode.trim()
    if (!code) {
      toast.error("Enter an authenticator code or unused backup code.")
      return
    }
    setRegenerateBusy(true)
    try {
      const nextCodes = await authService.regenerateBackupCodes(accessToken, code)
      if (nextCodes.length === 0) {
        throw new Error("The server did not return new backup codes.")
      }
      setBackupCodes(nextCodes)
      setRegenerateCode("")
      showSuccessAlert("New backup codes generated. Store them in a safe place.")
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Could not regenerate backup codes."
      toast.error(message)
    } finally {
      setRegenerateBusy(false)
    }
  }

  const handleCopyBackupCodes = async () => {
    if (backupCodes.length === 0) return
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"))
      toast.success("Backup codes copied.")
    } catch {
      toast.error("Could not copy backup codes.")
    }
  }

  const handleCopySecret = async () => {
    if (!setupData?.secret) return
    try {
      await navigator.clipboard.writeText(setupData.secret)
      toast.success("Secret copied.")
    } catch {
      toast.error("Could not copy secret.")
    }
  }

  const handleCancelSetup = () => {
    setSetupData(null)
    setVerifyCode("")
  }

  const handleResendVerification = async () => {
    if (!accountEmail.trim()) {
      toast.error("We could not determine which email address to verify.")
      return
    }
    setEmailBusy(true)
    try {
      await authService.resendVerification(accountEmail)
      showSuccessAlert(`Verification link sent to ${accountEmail}.`)
    } catch (errorObject) {
      const message =
        errorObject instanceof Error ? errorObject.message : "Could not resend verification email."
      toast.error(message)
    } finally {
      setEmailBusy(false)
    }
  }

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    setSessionActionId(sessionId)
    setSessionError(null)
    setSessionMessage(null)
    try {
      await authService.revokeSession(accessToken, sessionId)
      if (isCurrent) {
        clearStoredSession()
        window.location.assign(ROUTES.login)
        return
      }
      setSessionMessage("Session revoked.")
      await loadSessions()
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not revoke session."
      setSessionError(message)
      toast.error(message)
    } finally {
      setSessionActionId(null)
    }
  }

  const handleLogoutAllSessions = async () => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }
    setLogoutAllBusy(true)
    setSessionError(null)
    setSessionMessage(null)
    try {
      await authService.logoutAll(accessToken)
      clearStoredSession()
      window.location.assign(ROUTES.login)
    } catch (errorObject) {
      const message = errorObject instanceof Error ? errorObject.message : "Could not sign out all sessions."
      setSessionError(message)
      toast.error(message)
    } finally {
      setLogoutAllBusy(false)
    }
  }

  const handleToggleNotificationPreference = async (
    notificationType: NotificationPreferenceType,
    channel: NotificationChannel,
    nextEnabled: boolean
  ) => {
    const accessToken = resolveFreshAccessToken(token)
    if (!accessToken) {
      toast.error("Your session expired. Please sign in again.")
      return
    }

    const key = buildNotificationPreferenceKey(notificationType, channel)
    setNotificationPreferenceBusyKey(key)
    setNotificationPreferencesError(null)
    try {
      const updated = await setMyNotificationPreference(accessToken, {
        notification_type: notificationType,
        channel,
        is_enabled: nextEnabled,
      })
      const nextPreference =
        updated ??
        ({
          notification_type: notificationType,
          channel,
          is_enabled: nextEnabled,
        } satisfies NotificationPreference)

      setNotificationPreferences((current) => {
        const next = [...current]
        const index = next.findIndex((preference) => {
          return (
            readNotificationPreferenceType(preference) === notificationType &&
            readNotificationPreferenceChannel(preference) === channel
          )
        })
        if (index >= 0) {
          next[index] = nextPreference
          return next
        }
        return [...next, nextPreference]
      })
      toast.success(
        `${formatNotificationPreferenceLabel(notificationType)} ${formatNotificationPreferenceLabel(channel)} notifications ${nextEnabled ? "enabled" : "disabled"}.`
      )
    } catch (errorObject) {
      const message =
        errorObject instanceof Error
          ? errorObject.message
          : "Could not update the notification preference."
      setNotificationPreferencesError(message)
      toast.error(message)
    } finally {
      setNotificationPreferenceBusyKey(null)
    }
  }

  return (
    <div className="grid gap-4 px-4 lg:px-6">
      {profilePictureHref ? (
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 ring-1 ring-border" size="lg">
                {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={avatarLabel} /> : null}
                <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{avatarLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Update the photo shown on your dashboard, profile, and account menu.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="self-start sm:self-auto"
              onClick={() => setProfilePictureOpen(true)}
            >
              <ImageIcon className="size-4" />
              Change Profile Picture
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={profilePictureOpen} onOpenChange={setProfilePictureOpen}>
        <DialogPopup from="bottom" className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Profile Picture</DialogTitle>
            <DialogDescription>
              Pick a default avatar or upload your own image. The saved picture updates across the dashboard and account menu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-3">
              <Avatar className="size-16 ring-2 ring-background shadow-sm" size="lg">
                {profilePicturePreview ? (
                  <AvatarImage src={profilePicturePreview} alt="Selected profile picture" />
                ) : null}
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {profilePictureFileName || "Current profile picture"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  PNG, JPG, or WEBP up to 5 MB. Administrator uploads apply immediately.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Default avatars</Label>
                {defaultAvatarsLoading ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <FluentLoadingIndicator className="size-3 animate-spin" /> Loading
                  </span>
                ) : null}
              </div>
              {!defaultAvatarsLoading && defaultAvatars.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                  No default avatars are available yet. You can upload your own image below.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {defaultAvatars.map((avatar) => {
                    const id = readDefaultAvatarId(avatar)
                    const imageUrl = extractDefaultAvatarImageUrl(avatar)
                    if (id == null || !imageUrl) return null
                    const selected = selectedDefaultAvatarId === Number(id)
                    return (
                      <button
                        key={String(id)}
                        type="button"
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 transition ${selected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-primary/30"}`}
                        onClick={() => {
                          setSelectedDefaultAvatarId(Number(id))
                          setProfilePictureFile(null)
                          setProfilePictureFileName(
                            typeof avatar.avatar_name === "string" ? avatar.avatar_name : "Default avatar"
                          )
                          setProfilePicturePreview(imageUrl)
                          setProfilePictureError(null)
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="Default avatar" className="size-full object-cover" />
                        {selected ? (
                          <span className="absolute bottom-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckCircle2 className="size-3.5" />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-profile-picture">Upload your own image</Label>
              <input
                ref={profilePictureInputRef}
                id="account-profile-picture"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => handleProfilePictureFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => profilePictureInputRef.current?.click()}
              >
                <ImageIcon className="size-4" /> Choose image
              </Button>
            </div>

            {profilePictureError ? (
              <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {profilePictureError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProfilePictureOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveProfilePicture()} disabled={profilePictureSaving}>
              {profilePictureSaving ? <FluentLoadingIndicator className="size-4 animate-spin" /> : null}
              Save picture
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
      {canManageDefaultAvatars ? (
        <Card>
          <CardHeader>
            <CardTitle>Company default avatars</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Manage the gallery of default profile avatars employees can choose from (by gender category).
            </p>
            <Link
              href="/dashboard/settings/default-avatars"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground self-start sm:self-auto"
            >
              <ImageIcon className="size-4" />
              Manage avatars
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Security & Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1 sm:grid-cols-4">
            <Button
              type="button"
              variant="ghost"
              aria-pressed={activeTab === "reset-password"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "reset-password"
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-700 shadow-sm hover:bg-blue-500/20 dark:text-blue-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("reset-password")}
            >
              <KeyRound
                className={`size-4 transition-all duration-300 ${
                  activeTab === "reset-password"
                    ? "text-blue-600 dark:text-blue-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Password
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={activeTab === "two-factor"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "two-factor"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-sm hover:bg-emerald-500/20 dark:text-emerald-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("two-factor")}
              disabled={requiresPasswordChange}
            >
              <ShieldCheck
                className={`size-4 transition-all duration-300 ${
                  activeTab === "two-factor"
                    ? "text-emerald-600 dark:text-emerald-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              2FA
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={activeTab === "devices"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "devices"
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-700 shadow-sm hover:bg-violet-500/20 dark:text-violet-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("devices")}
              disabled={requiresPasswordChange}
            >
              <Smartphone
                className={`size-4 transition-all duration-300 ${
                  activeTab === "devices"
                    ? "text-violet-600 dark:text-violet-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Devices
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={activeTab === "email"}
              className={`justify-center gap-2 border px-2 text-xs transition-colors sm:text-sm ${
                activeTab === "email"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-800 shadow-sm hover:bg-amber-500/20 dark:text-amber-300"
                  : "border-transparent"
              }`}
              onClick={() => handleTabChange("email")}
              disabled={requiresPasswordChange}
            >
              <MailCheck
                className={`size-4 transition-all duration-300 ${
                  activeTab === "email"
                    ? "text-amber-600 dark:text-amber-400 scale-110"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              />
              Email
            </Button>
          </div>

          {requiresPasswordChange ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Finish updating your temporary password to unlock the rest of security settings.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-lg border">
            <div
              className="flex w-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${tabIndex * 100}%)` }}
            >
              <div className="w-full shrink-0 p-4">
                <ChangePasswordForm
                  onSubmit={handleChangePassword}
                  loading={passwordBusy || loading}
                  error={passwordError}
                  requiredMode={requiresPasswordChange}
                  onUseDifferentAccount={requiresPasswordChange ? handleUseDifferentAccount : undefined}
                />
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    {securityLoading ? (
                      <FluentLoadingIndicator className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : twoFactorEnabled ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <ShieldOff className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {securityLoading
                          ? "Checking 2FA status…"
                          : twoFactorEnabled
                            ? "Two-factor authentication is enabled"
                            : "Two-factor authentication is not enabled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use an authenticator app (Google Authenticator, Authy, Microsoft Authenticator) to
                        generate one-time codes when signing in.
                      </p>
                    </div>
                  </div>

                  {!twoFactorEnabled && !setupData ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Set up 2FA to require a code from your phone in addition to your password.
                      </p>
                      <Button onClick={handleStartTwoFactorSetup} disabled={twoFactorBusy || !token}>
                        {twoFactorBusy ? (
                          <>
                            <FluentLoadingIndicator className="size-4 animate-spin" />
                            Starting setup…
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="size-4" />
                            Set up 2FA
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}

                  {!twoFactorEnabled && setupData ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                        <div className="flex flex-col items-center gap-2">
                          {qrImageSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrImageSrc}
                              alt="2FA QR code"
                              className="size-40 rounded-lg border bg-white p-2 shadow-sm"
                            />
                          ) : (
                            <div className="flex size-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                              QR image unavailable. Use the secret below.
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label>Manual secret</Label>
                            <div className="flex gap-2">
                              <Input
                                readOnly
                                value={setupData.secret}
                                className="font-mono text-xs"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={handleCopySecret}
                                aria-label="Copy secret"
                              >
                                <Copy className="size-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              If you cannot scan the QR code, enter this secret manually in your app.
                            </p>
                          </div>
                          {setupData.otpAuthUrl ? (
                            <p className="break-all font-mono text-[10px] text-muted-foreground">
                              {setupData.otpAuthUrl}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-2 border-t pt-3">
                        <Label htmlFor="verify-2fa-code">Authenticator code</Label>
                        <Input
                          id="verify-2fa-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={verifyCode}
                          onChange={(event) => setVerifyCode(normalizeTotpCode(event.target.value))}
                          className="max-w-[10rem] font-mono tracking-[0.2em]"
                        />
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            onClick={handleVerifyTwoFactor}
                            disabled={twoFactorBusy || verifyCode.length !== 6}
                          >
                            {twoFactorBusy ? (
                              <>
                                <FluentLoadingIndicator className="size-4 animate-spin" />
                                Verifying…
                              </>
                            ) : (
                              "Verify & activate"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCancelSetup}
                            disabled={twoFactorBusy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {twoFactorEnabled ? (
                    <div className="space-y-3 border-t pt-3">
                      {backupCodes.length > 0 ? (
                        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">Backup codes</p>
                              <p className="text-xs text-muted-foreground">
                                Store these somewhere safe. Each code can be used once if you lose your authenticator.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleCopyBackupCodes()}
                            >
                              <Copy className="size-3.5" />
                              Copy
                            </Button>
                          </div>
                          <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                            {backupCodes.map((code) => (
                              <li key={code} className="rounded-md border bg-background px-2 py-1">
                                {code}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Regenerate backup codes</p>
                        <p className="text-xs text-muted-foreground">
                          This replaces any unused backup codes. Enter a current authenticator code or an unused backup code.
                        </p>
                        <Label htmlFor="regenerate-2fa-code">Authenticator or backup code</Label>
                        <Input
                          id="regenerate-2fa-code"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={regenerateCode}
                          onChange={(event) => setRegenerateCode(event.target.value)}
                          className="max-w-[14rem] font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRegenerateBackupCodes()}
                          disabled={regenerateBusy || twoFactorBusy || !regenerateCode.trim()}
                        >
                          {regenerateBusy ? (
                            <>
                              <FluentLoadingIndicator className="size-4 animate-spin" />
                              Regenerating…
                            </>
                          ) : (
                            <>
                              <KeyRound className="size-4" />
                              Generate new backup codes
                            </>
                          )}
                        </Button>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        To disable 2FA, enter a current code from your authenticator app.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="disable-2fa-code">Authenticator code</Label>
                        <Input
                          id="disable-2fa-code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={disableCode}
                          onChange={(event) => setDisableCode(normalizeTotpCode(event.target.value))}
                          className="max-w-[10rem] font-mono tracking-[0.2em]"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        onClick={handleDisableTwoFactor}
                        disabled={twoFactorBusy || disableCode.length !== 6}
                      >
                        {twoFactorBusy ? (
                          <>
                            <FluentLoadingIndicator className="size-4 animate-spin" />
                            Disabling…
                          </>
                        ) : (
                          <>
                            <ShieldOff className="size-4" />
                            Disable 2FA
                          </>
                        )}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Active sessions</p>
                      <p className="text-xs text-muted-foreground">
                        Review the devices and browsers currently signed in to your account.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadSessions()}
                        disabled={sessionsLoading || !token}
                      >
                        {sessionsLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleLogoutAllSessions}
                        disabled={logoutAllBusy || !token}
                      >
                        {logoutAllBusy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                        Sign out all
                      </Button>
                    </div>
                  </div>

                  {sessionError ? (
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                      {sessionError}
                    </div>
                  ) : null}

                  {sessionsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                      <FluentLoadingIndicator className="size-4 animate-spin" />
                      Loading active sessions...
                    </div>
                  ) : sessionError ? null : sessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                      No active sessions were returned for this account.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map((session) => {
                        const createdAt = formatSessionTimestamp(session.createdAt)
                        const lastUsedAt = formatSessionTimestamp(session.lastUsedAt)
                        const expiresAt = formatSessionTimestamp(session.expiresAt)
                        const isActing = sessionActionId === session.id
                        return (
                          <div
                            key={session.id}
                            className="rounded-lg border bg-background px-3 py-3 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{session.label}</p>
                                  {session.isCurrent ? (
                                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                      Current
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  {session.deviceName ? <span>Device: {session.deviceName}</span> : null}
                                  {session.browser ? <span>Browser: {session.browser}</span> : null}
                                  {session.os ? <span>OS: {session.os}</span> : null}
                                  {session.ipAddress ? <span>IP: {session.ipAddress}</span> : null}
                                  {session.location ? <span>Location: {session.location}</span> : null}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                  {createdAt ? <span>Created: {createdAt}</span> : null}
                                  {lastUsedAt ? <span>Last used: {lastUsedAt}</span> : null}
                                  {expiresAt ? <span>Expires: {expiresAt}</span> : null}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant={session.isCurrent ? "destructive" : "outline"}
                                onClick={() => void handleRevokeSession(session.id, session.isCurrent)}
                                disabled={isActing || logoutAllBusy}
                              >
                                {isActing ? (
                                  <FluentLoadingIndicator className="size-4 animate-spin" />
                                ) : session.isCurrent ? (
                                  <LogOut className="size-4" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                                {session.isCurrent ? "Sign out this device" : "Revoke session"}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full shrink-0 p-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                    {securityLoading ? (
                      <FluentLoadingIndicator className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : emailVerified ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <MailCheck className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {securityLoading
                          ? "Checking email status…"
                          : emailVerified
                            ? "Email is verified"
                            : "Email is not verified"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emailVerified
                          ? "Your email can be used for recovery and security alerts."
                          : "Verify your email so account recovery and security alerts can reach you."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                    {accountEmail
                      ? `Verification email address: ${accountEmail}`
                      : "We will use the email address attached to your account for verification and recovery."}
                  </div>
                  {!emailVerified ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Request a fresh verification link if you still have not confirmed your email.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={emailBusy || !accountEmail}
                        >
                          {emailBusy ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
                          Resend verification
                        </Button>
                        <Link
                          href={ROUTES.verifyEmail}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          Open verification page
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-700 dark:text-emerald-300">
                      Email verification is complete. Recovery and security notifications can be sent to this address.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>Notification Preferences</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="About notification preferences"
                >
                  <InfoIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="max-w-xs space-y-2 text-left">
                  <p>
                    Choose which channels should alert you for leave, onboarding, offboarding, attendance, and system events.
                  </p>
                  <p>
                    Rows marked “Default on” are enabled unless you turn them off or an administrator disables delivery system-wide.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadNotificationPreferences()}
            disabled={notificationPreferencesLoading || !token}
          >
            {notificationPreferencesLoading ? <FluentLoadingIndicator className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationPreferencesError ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {notificationPreferencesError}
            </div>
          ) : null}

          {notificationPreferencesLoading ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
              <FluentLoadingIndicator className="size-4 animate-spin" />
              Loading notification preferences...
            </div>
          ) : (
            <div className="space-y-4">
              {NOTIFICATION_PREFERENCE_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {group.types.length} type{group.types.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Notification
                          </th>
                          {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => (
                            <th
                              key={channel}
                              className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            >
                              {formatNotificationPreferenceLabel(channel)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.types.map((notificationType) => (
                          <tr key={notificationType} className="border-t">
                            <td className="px-3 py-3 align-top">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">
                                  {formatNotificationPreferenceLabel(notificationType)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {notificationType}
                                </p>
                              </div>
                            </td>
                            {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => {
                              const key = buildNotificationPreferenceKey(notificationType, channel)
                              const preference = notificationPreferencesByKey.get(key) ?? null
                              const busy = notificationPreferenceBusyKey === key
                              const hasExplicitPreference = Boolean(preference)
                              return (
                                <td key={channel} className="px-3 py-3 text-center align-middle">
                                  <div className="flex flex-col items-center gap-1">
                                    <Switch
                                      checked={readNotificationPreferenceEnabled(preference)}
                                      disabled={busy || !token}
                                      aria-label={`${formatNotificationPreferenceLabel(notificationType)} ${formatNotificationPreferenceLabel(channel)}`}
                                      onCheckedChange={(checked) =>
                                        void handleToggleNotificationPreference(
                                          notificationType,
                                          channel,
                                          Boolean(checked)
                                        )
                                      }
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      {busy
                                        ? "Saving..."
                                        : hasExplicitPreference
                                          ? readNotificationPreferenceEnabled(preference)
                                            ? "On"
                                            : "Off"
                                          : "Default on"}
                                    </span>
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function AccountSettingsPanel(props: AccountSettingsPanelProps) {
  return (
    <React.Suspense fallback={<AccountSettingsPanelLoadingFallback />}>
      <AccountSettingsPanelContent {...props} />
    </React.Suspense>
  )
}
```

## Regression test files

- [Transport/cache contracts](/home/innocent/systems/hrms/src/lib/admin-api.contract-cache.test.ts)
- [Auth hydration/storage](/home/innocent/systems/hrms/src/lib/auth-storage-react.test.tsx)
- [Finance recovery](/home/innocent/systems/hrms/src/lib/finance-draft-workflow.test.ts)
- [Finance rendered lifecycle](/home/innocent/systems/hrms/src/components/dashboard/finance-self-view.lifecycle.test.tsx)
