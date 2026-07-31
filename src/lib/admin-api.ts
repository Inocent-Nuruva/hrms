import { env } from "@/lib/env"

export type AdminResourceKey = "users" | "roles" | "permissions" | "companies"

export type AdminRecord = Record<string, unknown>
export type SortOrder = "ASC" | "DESC"

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

interface AdminRequestOptions {
  method?: HttpMethod
  token?: string
  body?: unknown
  signal?: AbortSignal
  cacheTtlMs?: number
  dedupe?: boolean
}

type CachedAdminResponse = {
  expiresAt: number
  value: unknown
}

const adminResponseCache = new Map<string, CachedAdminResponse>()
const inflightAdminRequests = new Map<string, Promise<unknown>>()

function getAdminRequestKey(path: string, method: HttpMethod, token?: string, body?: unknown) {
  return JSON.stringify({
    method,
    path: buildUrl(path),
    token: token ?? "",
    body: body ?? null,
  })
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError")
}

function invalidateAdminGetCache() {
  adminResponseCache.clear()
}

export interface AdminStats {
  users: number
  roles: number
  permissions: number
  companies: number
}

function unsupportedAdminEndpoint(message: string): never {
  throw new Error(message)
}

export interface AdminResourceCollections {
  users: AdminRecord[]
  roles: AdminRecord[]
  permissions: AdminRecord[]
  companies: AdminRecord[]
}

export interface UsersQueryParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: SortOrder
  search?: string
}

export interface EmployeesQueryParams extends UsersQueryParams {
  employment_status?: "onboarding" | "pending" | "active" | "suspended" | "terminated" | "exited"
  branch_id?: number
  department_id?: number
  position_id?: number
}

export interface DepartmentsQueryParams extends UsersQueryParams {
  status?: string
  branch_id?: number
  parent_id?: number
}

export interface BranchesQueryParams extends UsersQueryParams {
  status?: string
}

export interface PositionsQueryParams extends UsersQueryParams {
  status?: string
  department_id?: number
}

export interface LeaveTypesQueryParams extends UsersQueryParams {
  status?: string
}

export interface LeaveRequestsQueryParams extends UsersQueryParams {
  employee_id?: number
  leave_type_id?: number
  status?: string
  from_date?: string
  to_date?: string
}

export interface LeaveBalancesQueryParams extends UsersQueryParams {
  employee_id?: number
  leave_type_id?: number
  fiscal_year?: string
}

export interface LeaveHolidaysQueryParams extends UsersQueryParams {
  from_date?: string
  to_date?: string
}

export interface LeavePoliciesQueryParams extends UsersQueryParams {
  status?: string
  applicable_department_id?: number
  applicable_position_id?: number
}

export interface LeaveWorkflowsQueryParams extends UsersQueryParams {
  status?: string
  leave_type_id?: number
}

export interface OnboardingWorkflowsQueryParams extends UsersQueryParams {
  status?: string
}

export interface OnboardingRequestsQueryParams extends UsersQueryParams {
  employee_id?: number
  status?: string
}

export interface OffboardingRequestsQueryParams extends UsersQueryParams {
  employee_id?: number
  status?: string
  offboarding_type?: string
}

export interface OffboardingWorkflowsQueryParams extends UsersQueryParams {
  status?: string
}

export interface AttendanceQueryParams extends UsersQueryParams {
  employee_id?: number
  employee_no?: string
  from_date?: string
  to_date?: string
  organization_id?: number
  branch_id?: number
  department_id?: number
  shift_id?: number
  timetable_id?: number
  status?: string
  attendance_status?: string
  /** Filter attendance policies by active flag (GET /api/attendance/config/policies). */
  is_active?: boolean
}

export interface AttendanceReportDownloadParams extends AttendanceQueryParams {
  format: "xlsx" | "csv" | "pdf"
}

export interface MyAttendanceHistoryQueryParams extends UsersQueryParams {
  employee_id?: number
  employee_no?: string
  from_date?: string
  to_date?: string
  organization_id?: number
  status?: string
  attendance_status?: string
}

export interface MyAttendancePunchesQueryParams extends UsersQueryParams {
  employeeId?: number
  branchId?: number
  punchType?: "CHECK_IN" | "CHECK_OUT"
  validationStatus?:
    | "APPROVED"
    | "REJECTED"
    | "PENDING_OVERRIDE"
    | "OVERRIDE_APPROVED"
    | "OVERRIDE_REJECTED"
  dateFrom?: string
  dateTo?: string
}

export interface MyAttendanceScheduleQueryParams {
  from_date?: string
  to_date?: string
  days?: number
}

export interface SelfServiceRequestQueryParams extends UsersQueryParams {
  status?: string
  date_from?: string
  date_to?: string
}

export type NotificationStatus = "UNREAD" | "READ"
export type NotificationCategory = "GENERAL" | "HR" | "AUTH" | "ACCESS_CONTROL" | "SYSTEM"
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT"

export type NotificationItem = AdminRecord & {
  id?: number | string
  notification_id?: number | string
  notificationId?: number | string
  title?: string
  message?: string
  status?: NotificationStatus | string
  category?: NotificationCategory | string
  priority?: NotificationPriority | string
  type?: string
  related_module?: string
  relatedModule?: string
  entity_type?: string
  entityType?: string
  entity_id?: string
  entityId?: string
  action_url?: string
  actionUrl?: string
  seen?: boolean
  is_seen?: boolean
  seen_at?: string
  seenAt?: string
  read_at?: string
  readAt?: string
  archived_at?: string
  archivedAt?: string
  created_at?: string
  createdAt?: string
  metadata?: AdminRecord | null
}

export interface NotificationQueryParams extends UsersQueryParams {
  status?: NotificationStatus
  type?: string
  category?: NotificationCategory
  priority?: NotificationPriority
  related_module?: string
  entity_type?: string
  entity_id?: string
  seen?: boolean
  include_archived?: boolean
}

export type CreateTestNotificationInput = {
  receiver_company_user_id: number
  title: string
  message: string
  type?: string
  category?: NotificationCategory | string
  priority?: NotificationPriority | string
  related_module?: string
  entity_type?: string
  entity_id?: string
  action_url?: string
  dedupe_key?: string
  metadata?: AdminRecord
}

export interface TeamAttendanceQueryParams extends UsersQueryParams {
  date_from?: string
  date_to?: string
}

export interface EmployeePositionsQueryParams extends UsersQueryParams {
  employee_id?: number
  position_id?: number
  status?: string
  assignment_type?: string
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
  | "device-sync-logs"

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
  | "shifts"

export type TimetableResourceKey =
  | "employee-timetables"
  | "timetable-attendance-rules"
  | "timetable-days"
  | "timetable-generated-schedules"
  | "timetable-holiday-rules"
  | "timetable-rotation-rules"
  | "timetable-rotations"
  | "timetable-shift-rules"
  | "timetables"

export type AccessControlResourceKey =
  | "doors"
  | "schedule-templates"
  | "organizations"
  | "groups"
  | "week-plans"

export type EmployeeProfileSection =
  | "contacts"
  | "addresses"
  | "relatives"
  | "identifications"
  | "bank-accounts"
  | "academic-qualifications"
  | "professional-qualifications"
  | "experience-details"

export interface EmployeeStatusPayload {
  employment_status:
    | "onboarding"
    | "active"
    | "suspended"
    | "inactive"
    | "resigned"
    | "terminated"
    | "retired"
    | "exited"
  exit_date?: string
  exit_reason?: string
  notes?: string
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
] as const

export type EmployeeStatusValue = (typeof EMPLOYEE_STATUS_VALUES)[number]

export type OnboardingAttendanceMode = "shift" | "timetable"

export interface OnboardingShiftProvisioning {
  shift_id: number
  effective_from?: string
  effective_to?: string | null
  rotation_group_id?: number | null
  is_primary?: boolean
}

export interface OnboardingTimetableProvisioning {
  timetable_id: number
  effective_from?: string
  effective_to?: string | null
}

export interface OnboardingDeviceProvisioning {
  employee_no?: string
  access_group_id: number
  organization_id?: number
  valid_enabled?: boolean
  valid_begin_time?: string
  valid_end_time?: string
  local_ui_right?: boolean
  close_delay_enabled?: boolean
  max_open_door_time?: number
  open_door_time?: number
  user_verify_mode?: string
  metadata?: Record<string, unknown>
  device_ids: number[]
  sync_now?: boolean
  continue_on_error?: boolean
}

export interface OnboardingProvisioning {
  role_ids?: number[]
  branch_access_ids?: number[]
  attendance_mode?: OnboardingAttendanceMode
  shift_assignment?: OnboardingShiftProvisioning
  timetable_assignment?: OnboardingTimetableProvisioning
  device_assignment?: OnboardingDeviceProvisioning
}

export interface EmployeeOnboardingInput {
  auto_start?: boolean
  workflow_id?: number
  title?: string
  description?: string
  planned_start_date?: string
  planned_completion_date?: string
  submit?: boolean
  provisioning?: OnboardingProvisioning
}

export interface CreateOnboardingRequestPayload {
  employee_id: number
  workflow_id?: number
  title: string
  description?: string
  planned_start_date?: string
  planned_completion_date?: string
  submit?: boolean
  provisioning?: OnboardingProvisioning
}

export interface CreateEmployeePayload {
  employee_no?: string
  first_name: string
  middle_name?: string
  last_name: string
  preferred_name?: string
  gender?: string
  date_of_birth?: string
  marital_status?: string
  nationality?: string
  profile_photo_url?: string
  primary_branch_id?: number
  primary_department_id?: number
  primary_position_id?: number
  position_id?: number
  employment_status?: EmployeeStatusValue
  employment_type?: "full_time" | "part_time" | "contract" | "probation" | "intern" | "consultant" | "temporary"
  hire_date?: string
  probation_end_date?: string
  confirmation_date?: string
  exit_date?: string
  reports_to?: number
  exit_reason?: string
  notes?: string
  metadata?: Record<string, unknown>
  departments?: Array<{ department_id: number; is_primary?: boolean }>
  contacts?: Array<Record<string, unknown>>
  addresses?: Array<Record<string, unknown>>
  relatives?: Array<Record<string, unknown>>
  identifications?: Array<Record<string, unknown>>
  bank_accounts?: Array<Record<string, unknown>>
  academic_qualifications?: Array<Record<string, unknown>>
  professional_qualifications?: Array<Record<string, unknown>>
  experience_details?: Array<Record<string, unknown>>
  onboarding?: EmployeeOnboardingInput
}

export type CreateEmployeeResponse = AdminRecord & {
  onboarding_request?: (AdminRecord & {
    id?: number
    onboarding_no?: string
    title?: string
    status?: string
    progress_percentage?: string
    planned_start_date?: string | null
    planned_completion_date?: string | null
    provisioning?: OnboardingProvisioning | null
    metadata?: Record<string, unknown> | null
  }) | null
}

export type EmployeeImportMode = "CREATE_ONLY" | "UPDATE_EXISTING" | "CREATE_OR_UPDATE"

export type EmployeeImportRequest = {
  import_mode: EmployeeImportMode
  process_valid_rows_only?: boolean
}

export type EmployeeImportConfirmRequest = {
  batch_id?: string
  preview_token?: string
  row_ids?: number[]
  excluded_row_ids?: number[]
  skip_existing_records?: boolean
  exclude_invalid_records?: boolean
  process_valid_rows_only?: boolean
}

export function isEmployeeStatusValue(value: unknown): value is EmployeeStatusValue {
  return (
    typeof value === "string" &&
    (EMPLOYEE_STATUS_VALUES as readonly string[]).includes(value.trim().toLowerCase())
  )
}

export interface PaginatedUsersResult {
  rows: AdminRecord[]
  page: number
  limit: number
  total: number | null
  totalPages: number | null
}

export const RESOURCE_LABELS: Record<AdminResourceKey, string> = {
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  companies: "Companies",
}

const RESOURCE_PATHS: Record<AdminResourceKey, string> = {
  users: "/api/users",
  roles: "/api/roles",
  permissions: "/api/permissions",
  companies: "/api/companies",
}

export const RESOURCE_CREATE_TEMPLATES: Record<AdminResourceKey, AdminRecord> = {
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
}

function getBaseUrl() {
  // Keep in sync with `resolveApiBaseUrl` in `@/utils/constants`.
  return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/api$/i, "")
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  const baseUrl = getBaseUrl()
  return baseUrl ? `${baseUrl}${path}` : path
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function asArray(value: unknown): AdminRecord[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  // Empty array is a valid empty collection.
  if (value.length === 0) {
    return []
  }
  const records = value.filter(
    (entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry)
  ) as AdminRecord[]
  // Non-empty arrays of primitives (permission strings, ids, etc.) are not record lists.
  if (records.length === 0) {
    return null
  }
  return records
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
] as const

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
] as const

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
])

function getRecordArrays(record: AdminRecord | null) {
  if (!record) {
    return [] as AdminRecord[][]
  }

  return Object.values(record)
    .map((value) => asArray(value))
    .filter((value): value is AdminRecord[] => value !== null)
}

function getNestedRecords(record: AdminRecord | null) {
  if (!record) {
    return [] as AdminRecord[]
  }

  return Object.entries(record)
    .filter(([key, value]) => {
      if (SKIP_NESTED_KEYS.has(key)) {
        return false
      }
      return typeof value === "object" && value !== null && !Array.isArray(value)
    })
    .map(([, value]) => value as AdminRecord)
}

function extractListFromRecord(record: AdminRecord | null): AdminRecord[] | null {
  if (!record) {
    return null
  }

  let emptyPreferred: AdminRecord[] | null = null

  // 1) Preferred collection keys first (including empty arrays — those are real empties).
  for (const key of PREFERRED_LIST_KEYS) {
    if (!(key in record)) {
      continue
    }
    const list = asArray(record[key])
    if (list === null) {
      continue
    }
    if (list.length > 0) {
      return list
    }
    if (emptyPreferred === null) {
      emptyPreferred = list
    }
  }

  // 2) Nested envelopes (data/result/...) before random sibling empty arrays.
  const nestedCandidates = [
    asRecord(record.data),
    asRecord(record.result),
    asRecord(record.payload),
    asRecord(record.response),
    ...getNestedRecords(record),
  ]

  for (const nested of nestedCandidates) {
    if (!nested) {
      continue
    }
    const nestedList = extractListFromRecord(nested)
    if (nestedList && nestedList.length > 0) {
      return nestedList
    }
    if (nestedList && nestedList.length === 0 && emptyPreferred === null) {
      emptyPreferred = nestedList
    }
  }

  // 3) Any other non-empty record array on the object.
  for (const list of getRecordArrays(record)) {
    if (list.length > 0) {
      return list
    }
  }

  // 4) Genuine empty collection under a preferred key / nested envelope.
  return emptyPreferred
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

function readNumberFromRecord(record: AdminRecord | null, keys: string[]): number | null {
  if (!record) {
    return null
  }
  for (const key of keys) {
    const parsed = readNumber(record[key])
    if (parsed !== null) {
      return parsed
    }
  }
  return null
}

function scoreRecordArray(rows: AdminRecord[]): number {
  if (rows.length === 0) {
    return 0
  }
  let score = rows.length
  for (const row of rows.slice(0, 8)) {
    for (const hint of POLICY_LIKE_FIELD_HINTS) {
      if (hint in row) {
        score += 3
      }
    }
    if ("id" in row) {
      score += 1
    }
  }
  return score
}

/**
 * Walk nested envelopes for the best array-of-records candidate.
 * Used when preferred-key extraction fails for unfamiliar API shapes.
 */
function deepFindRecordArrays(value: unknown, depth = 0, maxDepth = 6): AdminRecord[][] {
  if (depth > maxDepth || value == null) {
    return []
  }

  const asList = asArray(value)
  if (asList) {
    return asList.length > 0 ? [asList] : []
  }

  const record = asRecord(value)
  if (!record) {
    return []
  }

  const preferredKeySet = new Set<string>(PREFERRED_LIST_KEYS)
  const found: AdminRecord[][] = []
  for (const [key, child] of Object.entries(record)) {
    // Skip pure metadata, but never skip known collection keys.
    if (SKIP_NESTED_KEYS.has(key) && !preferredKeySet.has(key)) {
      continue
    }
    found.push(...deepFindRecordArrays(child, depth + 1, maxDepth))
  }
  return found
}

function normalizeList(payload: unknown): AdminRecord[] {
  const direct = asArray(payload)
  if (direct) {
    return direct
  }

  const record = asRecord(payload)
  if (!record) {
    return []
  }

  const list = extractListFromRecord(record)
  if (list && list.length > 0) {
    return list
  }

  // Deep search: pick the highest-scoring array of plain records.
  const candidates = deepFindRecordArrays(record)
  if (candidates.length > 0) {
    const best = [...candidates].sort((a, b) => scoreRecordArray(b) - scoreRecordArray(a))[0]
    if (best && best.length > 0) {
      return best
    }
  }

  // Some list endpoints return a single record under data/result when only one row exists.
  const single =
    asRecord(record.data) ??
    asRecord(record.result) ??
    asRecord(record.payload) ??
    asRecord(record.policy) ??
    asRecord(record.item)
  if (
    single &&
    (single.id !== undefined ||
      single.name !== undefined ||
      single.display_name !== undefined ||
      single.displayName !== undefined)
  ) {
    return [single]
  }

  return list ?? []
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
] as const

/**
 * Coerce approval collections that may be a plain array or a nested envelope
 * like `{ data: [...] }` / `{ items: [...] }`.
 */
function coerceLeaveApprovalsList(value: unknown): AdminRecord[] {
  const direct = asArray(value)
  if (direct && direct.length > 0) {
    return direct
  }

  const record = asRecord(value)
  if (!record) {
    return []
  }

  for (const key of ["data", "items", "results", "rows", "records", "list", "approvals"] as const) {
    const nested = asArray(record[key])
    if (nested && nested.length > 0) {
      return nested
    }
  }

  return []
}

function extractLeaveApprovalsList(source: AdminRecord | null): AdminRecord[] {
  if (!source) {
    return []
  }

  for (const key of LEAVE_APPROVAL_LIST_KEYS) {
    const list = coerceLeaveApprovalsList(source[key])
    if (list.length > 0) {
      return list
    }
  }

  const workflow = asRecord(source.workflow ?? source.approval_workflow ?? source.approvalWorkflow)
  if (workflow) {
    for (const key of ["approvals", "steps", "approval_steps", "approvalSteps"] as const) {
      const list = coerceLeaveApprovalsList(workflow[key])
      if (list.length > 0) {
        return list
      }
    }
  }

  return []
}

/** True when a record looks like a leave request entity (not a nested company/employee/etc.). */
function looksLikeLeaveRequest(record: AdminRecord | null): boolean {
  if (!record) {
    return false
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
    return true
  }

  // Submitted/in-review leave rows commonly carry start/end + status.
  // Do not treat "has approvals" alone as leave identity — envelopes may
  // carry sibling approvals next to a nested request body.
  if (
    ("start_date" in record || "startDate" in record) &&
    ("end_date" in record || "endDate" in record) &&
    "status" in record
  ) {
    return true
  }

  return false
}

/**
 * Unwrap leave-request detail without using generic normalizeSingle().
 *
 * normalizeSingle() prefers the first nested object (data/result/item/user/company),
 * so a bare LeaveRequest payload with relations would be reduced to `company` or
 * `employee` and drop `approvals` / workflow fields.
 */
function unwrapLeaveRequestCandidate(payload: unknown): AdminRecord | null {
  const root = asRecord(payload)
  if (!root) {
    const list = asArray(payload)
    return list?.[0] ?? null
  }

  if (looksLikeLeaveRequest(root)) {
    return root
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
  ]

  for (const wrapper of wrappers) {
    if (!wrapper) continue
    if (looksLikeLeaveRequest(wrapper)) {
      return wrapper
    }

    const nested =
      asRecord(wrapper.leave_request) ??
      asRecord(wrapper.leaveRequest) ??
      asRecord(wrapper.request) ??
      asRecord(wrapper.data) ??
      asRecord(wrapper.result) ??
      asRecord(wrapper.item)

    if (looksLikeLeaveRequest(nested)) {
      return nested
    }
  }

  // Last resort: first nested leave-shaped relation, never company/user alone.
  for (const nested of getNestedRecords(root)) {
    if (looksLikeLeaveRequest(nested)) {
      return nested
    }
  }

  return null
}

/**
 * Preserve approval/workflow arrays that often sit next to (not inside) the leave request object.
 * Plain normalizeSingle() can drop sibling fields like root.approvals when it returns root.data,
 * and can also peel a bare leave request down to a nested company/employee relation.
 */
function normalizeLeaveRequestDetail(payload: unknown): AdminRecord | null {
  const root = asRecord(payload)
  const single = unwrapLeaveRequestCandidate(payload) ?? normalizeSingle(payload)
  if (!single && !root) {
    return null
  }

  const nestedData = root ? asRecord(root.data) : null
  const nestedResult = root ? asRecord(root.result) : null
  const nestedItem = root ? asRecord(root.item) : null
  const nestedPayload = root ? asRecord(root.payload) : null
  const nestedRequest =
    asRecord(single?.leave_request) ??
    asRecord(single?.leaveRequest) ??
    asRecord(nestedData?.leave_request) ??
    asRecord(nestedData?.leaveRequest) ??
    asRecord(nestedResult?.leave_request) ??
    asRecord(nestedItem?.leave_request) ??
    asRecord(nestedPayload?.leave_request)

  // Prefer the leave-request-shaped record as the merge base so nested relations
  // (company/employee) never overwrite request fields when unwrapping failed partially.
  const leaveShaped =
    (looksLikeLeaveRequest(single) ? single : null) ??
    (looksLikeLeaveRequest(nestedRequest) ? nestedRequest : null) ??
    (looksLikeLeaveRequest(nestedData) ? nestedData : null) ??
    (looksLikeLeaveRequest(root) ? root : null) ??
    single ??
    nestedRequest ??
    root

  const base: AdminRecord = {
    ...(nestedRequest && nestedRequest !== leaveShaped ? nestedRequest : {}),
    ...(leaveShaped ?? {}),
  }

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
  ]

  let approvals: AdminRecord[] = []
  for (const source of approvalSources) {
    const list = extractLeaveApprovalsList(source)
    if (list.length > 0) {
      approvals = list
      break
    }
  }

  // Prefer the current approval cycle when the API returns historical cycles together.
  const currentCycle =
    readNumber(base.approval_cycle) ??
    readNumber(base.approvalCycle) ??
    readNumber(leaveShaped?.approval_cycle) ??
    readNumber(leaveShaped?.approvalCycle)

  if (approvals.length > 0 && currentCycle !== null) {
    const cycleFiltered = approvals.filter((entry) => {
      const cycle = readNumber(entry.approval_cycle) ?? readNumber(entry.approvalCycle)
      return cycle === null || cycle === currentCycle
    })
    if (cycleFiltered.length > 0) {
      approvals = cycleFiltered
    }
  }

  if (approvals.length > 0) {
    base.approvals = approvals
  }

  // Keep useful workflow metadata from parent wrappers when missing on the request body.
  for (const source of approvalSources) {
    if (!source) continue
    if (base.current_approval_level == null && source.current_approval_level != null) {
      base.current_approval_level = source.current_approval_level
    }
    if (base.currentApprovalLevel == null && source.currentApprovalLevel != null) {
      base.currentApprovalLevel = source.currentApprovalLevel
    }
    if (base.approval_cycle == null && source.approval_cycle != null) {
      base.approval_cycle = source.approval_cycle
    }
    if (base.workflow == null && source.workflow != null) {
      base.workflow = source.workflow
    }
  }

  if (!("id" in base) && !("status" in base) && approvals.length === 0) {
    return single
  }

  return base
}

function buildUsersQuery(params: UsersQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildNotificationsQuery(params: NotificationQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status) {
    searchParams.set("status", params.status)
  }
  if (params.type && params.type.trim()) {
    searchParams.set("type", params.type.trim())
  }
  if (params.category) {
    searchParams.set("category", params.category)
  }
  if (params.priority) {
    searchParams.set("priority", params.priority)
  }
  if (params.related_module && params.related_module.trim()) {
    searchParams.set("related_module", params.related_module.trim())
  }
  if (params.entity_type && params.entity_type.trim()) {
    searchParams.set("entity_type", params.entity_type.trim())
  }
  if (params.entity_id && params.entity_id.trim()) {
    searchParams.set("entity_id", params.entity_id.trim())
  }
  if (typeof params.seen === "boolean") {
    searchParams.set("seen", String(params.seen))
  }
  if (typeof params.include_archived === "boolean") {
    searchParams.set("include_archived", String(params.include_archived))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildAttendanceReportQuery(params: AttendanceReportDownloadParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (params.employee_no && params.employee_no.trim()) {
    searchParams.set("employee_no", params.employee_no.trim())
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id))
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id))
  }
  if (typeof params.organization_id === "number" && params.organization_id > 0) {
    searchParams.set("organization_id", String(params.organization_id))
  }
  if (typeof params.shift_id === "number" && params.shift_id > 0) {
    searchParams.set("shift_id", String(params.shift_id))
  }
  if (typeof params.timetable_id === "number" && params.timetable_id > 0) {
    searchParams.set("timetable_id", String(params.timetable_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.attendance_status && params.attendance_status.trim()) {
    searchParams.set("attendance_status", params.attendance_status.trim())
  }
  searchParams.set("format", params.format)
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildEmployeesQuery(params: EmployeesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.employment_status) {
    searchParams.set("employment_status", params.employment_status)
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id))
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id))
  }
  if (typeof params.position_id === "number" && params.position_id > 0) {
    searchParams.set("position_id", String(params.position_id))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildDepartmentsQuery(params: DepartmentsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id))
  }
  if (typeof params.parent_id === "number" && params.parent_id > 0) {
    searchParams.set("parent_id", String(params.parent_id))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildBranchesQuery(params: BranchesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildPositionsQuery(params: PositionsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildLeaveTypesQuery(params: LeaveTypesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildLeaveRequestsQuery(params: LeaveRequestsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (typeof params.leave_type_id === "number" && params.leave_type_id > 0) {
    searchParams.set("leave_type_id", String(params.leave_type_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildLeaveBalancesQuery(params: LeaveBalancesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (typeof params.leave_type_id === "number" && params.leave_type_id > 0) {
    searchParams.set("leave_type_id", String(params.leave_type_id))
  }
  if (params.fiscal_year && params.fiscal_year.trim()) {
    searchParams.set("fiscal_year", params.fiscal_year.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildLeaveHolidaysQuery(params: LeaveHolidaysQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildLeavePoliciesQuery(params: LeavePoliciesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (typeof params.applicable_department_id === "number" && params.applicable_department_id > 0) {
    searchParams.set("applicable_department_id", String(params.applicable_department_id))
  }
  if (typeof params.applicable_position_id === "number" && params.applicable_position_id > 0) {
    searchParams.set("applicable_position_id", String(params.applicable_position_id))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildLeaveWorkflowsQuery(params: LeaveWorkflowsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (typeof params.leave_type_id === "number" && params.leave_type_id > 0) {
    searchParams.set("leave_type_id", String(params.leave_type_id))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildEmployeePositionsQuery(params: EmployeePositionsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (typeof params.position_id === "number" && params.position_id > 0) {
    searchParams.set("position_id", String(params.position_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.assignment_type && params.assignment_type.trim()) {
    searchParams.set("assignment_type", params.assignment_type.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildOnboardingWorkflowsQuery(params: OnboardingWorkflowsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildOnboardingRequestsQuery(params: OnboardingRequestsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildOffboardingRequestsQuery(params: OffboardingRequestsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.offboarding_type && params.offboarding_type.trim()) {
    searchParams.set("offboarding_type", params.offboarding_type.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildOffboardingWorkflowsQuery(params: OffboardingWorkflowsQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildMyAttendancePunchesQuery(params: MyAttendancePunchesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employeeId === "number" && params.employeeId > 0) {
    searchParams.set("employeeId", String(params.employeeId))
  }
  if (typeof params.branchId === "number" && params.branchId > 0) {
    searchParams.set("branchId", String(params.branchId))
  }
  if (params.punchType) {
    searchParams.set("punchType", params.punchType)
  }
  if (params.validationStatus) {
    searchParams.set("validationStatus", params.validationStatus)
  }
  if (params.dateFrom && params.dateFrom.trim()) {
    searchParams.set("dateFrom", params.dateFrom.trim())
  }
  if (params.dateTo && params.dateTo.trim()) {
    searchParams.set("dateTo", params.dateTo.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildMyAttendanceHistoryQuery(params: MyAttendanceHistoryQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (params.employee_no && params.employee_no.trim()) {
    searchParams.set("employee_no", params.employee_no.trim())
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  if (typeof params.organization_id === "number" && params.organization_id > 0) {
    searchParams.set("organization_id", String(params.organization_id))
  }
  const status = params.status?.trim() || params.attendance_status?.trim()
  if (status) {
    searchParams.set("status", status)
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildMyAttendanceScheduleQuery(params: MyAttendanceScheduleQueryParams) {
  const searchParams = new URLSearchParams()
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  if (typeof params.days === "number" && params.days > 0) {
    searchParams.set("days", String(params.days))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildSelfServiceRequestQuery(params: SelfServiceRequestQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.date_from && params.date_from.trim()) {
    searchParams.set("date_from", params.date_from.trim())
  }
  if (params.date_to && params.date_to.trim()) {
    searchParams.set("date_to", params.date_to.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function buildTeamAttendanceQuery(params: TeamAttendanceQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.date_from && params.date_from.trim()) {
    searchParams.set("date_from", params.date_from.trim())
  }
  if (params.date_to && params.date_to.trim()) {
    searchParams.set("date_to", params.date_to.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

function extractUsersPagination(payload: unknown, fallbackPage: number, fallbackLimit: number) {
  const root = asRecord(payload)
  const rootData = asRecord(root?.data)
  const rootResult = asRecord(root?.result)
  const rootMeta = asRecord(root?.meta)
  const rootDataMeta = asRecord(rootData?.meta)
  const rootResultMeta = asRecord(rootResult?.meta)
  const rootPagination = asRecord(root?.pagination)
  const rootDataPagination = asRecord(rootData?.pagination)
  const rootResultPagination = asRecord(rootResult?.pagination)

  const page =
    readNumberFromRecord(root, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootResult, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootMeta, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootDataMeta, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootResultMeta, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootPagination, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootDataPagination, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootResultPagination, ["page", "currentPage", "current_page"]) ??
    readNumberFromRecord(rootData, ["page", "currentPage", "current_page"]) ??
    fallbackPage

  const limit =
    readNumberFromRecord(root, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootResult, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootMeta, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootDataMeta, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootResultMeta, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootPagination, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootDataPagination, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootResultPagination, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    readNumberFromRecord(rootData, ["limit", "perPage", "pageSize", "per_page", "itemsPerPage", "items_per_page"]) ??
    fallbackLimit

  const total =
    readNumberFromRecord(root, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootResult, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootMeta, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootDataMeta, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootResultMeta, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootPagination, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootDataPagination, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootResultPagination, ["total", "totalItems", "total_items", "count"]) ??
    readNumberFromRecord(rootData, ["total", "totalItems", "total_items", "count"])

  const totalPages =
    readNumberFromRecord(root, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootResult, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootMeta, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootDataMeta, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootResultMeta, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootPagination, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootDataPagination, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootResultPagination, ["totalPages", "pageCount", "total_pages"]) ??
    readNumberFromRecord(rootData, ["totalPages", "pageCount", "total_pages"])

  return {
    page: Math.max(1, Math.floor(page)),
    limit: Math.max(1, Math.floor(limit)),
    total: total !== null ? Math.max(0, Math.floor(total)) : null,
    totalPages: totalPages !== null ? Math.max(1, Math.floor(totalPages)) : null,
  }
}

function normalizeSingle(payload: unknown): AdminRecord | null {
  const directList = asArray(payload)
  if (directList) {
    return directList[0] ?? null
  }

  const record = asRecord(payload)
  if (!record) {
    return null
  }

  const nested = [
    record.data,
    record.result,
    record.item,
    record.user,
    record.company,
    ...getNestedRecords(record),
  ]
  for (const candidate of nested) {
    const value = asRecord(candidate)
    if (value) {
      return value
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
    return record
  }

  const list = normalizeList(payload)
  return list[0] ?? null
}

function looksLikeEmployeeRecord(value: AdminRecord | null) {
  if (!value) {
    return false
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
  )
}

/** Detect Excel/ZIP/binary bodies that must never be shown as UI error text. */
function looksLikeBinaryPayload(text: string): boolean {
  if (!text) return false
  // XLSX / ZIP local file header
  if (text.startsWith("PK") || text.includes("[Content_Types].xml")) {
    return true
  }
  const sample = text.slice(0, 800)
  let nonPrintable = 0
  for (let i = 0; i < sample.length; i += 1) {
    const code = sample.charCodeAt(i)
    if (code === 0 || (code < 9) || (code > 13 && code < 32)) {
      nonPrintable += 1
    }
  }
  return sample.length > 0 && nonPrintable / sample.length > 0.04
}

function isBinaryContentType(contentType: string | null): boolean {
  if (!contentType) return false
  return /(?:excel|spreadsheet|ms-excel|octet-stream|zip|application\/vnd\.|multipart\/form-data)/i.test(
    contentType
  )
}

function sanitizeHumanMessage(text: string, fallback: string): string {
  const trimmed = text.trim()
  if (!trimmed) return fallback
  if (looksLikeBinaryPayload(trimmed)) return fallback
  // Cap length so accidental HTML/log dumps don't flood the UI
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed
}

function parseResponseBodyText(text: string, contentType: string | null): unknown {
  if (!text) return null

  if (isBinaryContentType(contentType) || looksLikeBinaryPayload(text)) {
    return {
      message: "The server returned a file instead of a status. Try again, or download the report if available.",
      _binaryResponse: true,
    }
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return {
      message: sanitizeHumanMessage(text, "Unexpected response from server."),
    }
  }
}

function extractMessage(payload: unknown, status: number) {
  const record = asRecord(payload)
  if (!record) {
    return `Request failed with status ${status}`
  }
  const candidate = record.message
  if (typeof candidate === "string" && candidate.trim()) {
    return sanitizeHumanMessage(candidate, `Request failed with status ${status}`)
  }
  if (Array.isArray(candidate)) {
    const normalized = candidate
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => sanitizeHumanMessage(entry, ""))
      .filter(Boolean)
    if (normalized.length > 0) {
      return normalized.join(". ")
    }
  }
  const errorCandidate = record.error
  if (typeof errorCandidate === "string" && errorCandidate.trim()) {
    return sanitizeHumanMessage(errorCandidate, `Request failed with status ${status}`)
  }
  const detailCandidate = record.details
  if (typeof detailCandidate === "string" && detailCandidate.trim()) {
    return sanitizeHumanMessage(detailCandidate, `Request failed with status ${status}`)
  }
  return `Request failed with status ${status}`
}

async function adminRequest<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    token,
    body,
    signal,
    cacheTtlMs = 0,
    dedupe = true,
  } = options
  const requestKey = getAdminRequestKey(path, method, token, body)
  const canReuseGetRequest = method === "GET" && body === undefined

  if (signal?.aborted) {
    throw createAbortError()
  }

  if (method !== "GET") {
    invalidateAdminGetCache()
  }

  if (canReuseGetRequest && cacheTtlMs > 0) {
    const cached = adminResponseCache.get(requestKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T
    }
    if (cached) {
      adminResponseCache.delete(requestKey)
    }
  }

  if (canReuseGetRequest && dedupe && !signal) {
    const inflight = inflightAdminRequests.get(requestKey)
    if (inflight) {
      if (process.env.NODE_ENV === "development") {
        console.debug(`[admin-api] duplicate GET deduped for ${path}`)
      }
      return inflight as Promise<T>
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    })

    const contentType = response.headers.get("content-type")
    const text = await response.text()
    const payload = parseResponseBodyText(text, contentType)

    if (!response.ok) {
      const error = new Error(extractMessage(payload, response.status)) as Error & {
        status?: number
        payload?: unknown
      }
      error.status = response.status
      error.payload = payload
      throw error
    }

    if (canReuseGetRequest && cacheTtlMs > 0) {
      adminResponseCache.set(requestKey, {
        expiresAt: Date.now() + cacheTtlMs,
        value: payload,
      })
    }

    return payload as T
  })()

  if (canReuseGetRequest && dedupe && !signal) {
    inflightAdminRequests.set(requestKey, requestPromise)
  }

  try {
    return await requestPromise
  } finally {
    inflightAdminRequests.delete(requestKey)
  }
}

export interface ListRequestOptions {
  signal?: AbortSignal
  cacheTtlMs?: number
  dedupe?: boolean
}

function dedupeAdminRecordsById(rows: AdminRecord[]): AdminRecord[] {
  const seen = new Set<string>()
  const out: AdminRecord[] = []
  for (const row of rows) {
    const id = row.id ?? row.role_id ?? row.roleId ?? row.permission_id ?? row.permissionId
    if (id === null || id === undefined || id === "") {
      out.push(row)
      continue
    }
    const key = String(id)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(row)
  }
  return out
}

/**
 * Fetch every page of a catalog resource (roles/permissions/…).
 * A single GET often only returns the first page (default limit 10–20), which
 * hides system roles such as "company user" that sit later in the list.
 */
export async function listResource(
  resource: AdminResourceKey,
  token: string,
  options: { pageAll?: boolean; pageSize?: number; maxPages?: number } = {}
) {
  const pageAll = options.pageAll !== false
  const pageSize =
    options.pageSize && options.pageSize > 0
      ? Math.min(options.pageSize, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100)
      : Math.min(100, env.NEXT_PUBLIC_MAX_PAGE_SIZE || 100)
  const maxPages = options.maxPages && options.maxPages > 0 ? options.maxPages : 50

  if (!pageAll) {
    const payload = await adminRequest<unknown>(RESOURCE_PATHS[resource], { token })
    return dedupeAdminRecordsById(normalizeList(payload))
  }

  const collected: AdminRecord[] = []
  let page = 1

  while (page <= maxPages) {
    // Only page/limit — avoid sortBy so backends that don't index roles by created_at still work.
    const query = buildUsersQuery({ page, limit: pageSize })
    const payload = await adminRequest<unknown>(`${RESOURCE_PATHS[resource]}${query}`, {
      token,
    })
    const rows = normalizeList(payload)
    const pagination = extractUsersPagination(payload, page, pageSize)
    collected.push(...rows)

    const reachedEnd =
      rows.length === 0 ||
      rows.length < pageSize ||
      (pagination.totalPages !== null && page >= pagination.totalPages) ||
      (pagination.total !== null && collected.length >= pagination.total)

    if (reachedEnd) {
      break
    }
    page += 1
  }

  return dedupeAdminRecordsById(collected)
}

export async function listAllResources(token: string): Promise<AdminResourceCollections> {
  const [users, roles, permissions, companies] = await Promise.all([
    listResource("users", token).catch(() => []),
    listResource("roles", token).catch(() => []),
    listResource("permissions", token).catch(() => []),
    listResource("companies", token).catch(() => []),
  ])

  return { users, roles, permissions, companies }
}

export async function listUsers(
  token: string,
  params: UsersQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildUsersQuery(params)
  const payload = await adminRequest<unknown>(`/api/users${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  // Flatten 2FA flags so UI always has consistent top-level fields regardless of API naming.
  const rows = normalizeList(payload).map((row) => withNormalizedTwoFactorFields(row))
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listNotifications(
  token: string,
  params: NotificationQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildNotificationsQuery(params)
  const payload = await adminRequest<unknown>(`/api/notifications${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getUnreadNotificationsCount(token: string) {
  const payload = await adminRequest<unknown>("/api/notifications/unread-count", { token })
  const record = asRecord(payload)
  if (!record) {
    return 0
  }
  return (
    readNumber(record.unread_count) ??
    readNumber(record.unreadCount) ??
    readNumber(record.count) ??
    readNumber(record.total) ??
    0
  )
}

export async function markNotificationAsRead(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/notifications/${id}/read`, {
    method: "PATCH",
    token,
  })
  return (normalizeSingle(payload) as NotificationItem | null) ?? null
}

export async function markNotificationAsSeen(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/notifications/${id}/seen`, {
    method: "PATCH",
    token,
  })
  return (normalizeSingle(payload) as NotificationItem | null) ?? null
}

export async function markAllNotificationsAsRead(token: string) {
  return adminRequest<unknown>("/api/notifications/read-all", {
    method: "PATCH",
    token,
  })
}

export async function deleteNotification(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/notifications/${id}`, {
    method: "DELETE",
    token,
  })
  return (normalizeSingle(payload) as NotificationItem | null) ?? null
}

export async function createTestNotification(
  token: string,
  data: CreateTestNotificationInput | AdminRecord
) {
  const payload = await adminRequest<unknown>("/api/notifications/test", {
    method: "POST",
    token,
    body: data,
  })
  return (normalizeSingle(payload) as NotificationItem | null) ?? null
}

export async function listEmployees(
  token: string,
  params: EmployeesQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildEmployeesQuery(params)
  const payload = await adminRequest<unknown>(`/api/employees${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

function buildEmployeeImportHistoryQuery(params: { page?: number; limit?: number } = {}) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

async function submitEmployeeImportRequest(
  path: string,
  token: string,
  data: EmployeeImportRequest,
  file: File | Blob,
  fileName?: string
) {
  const formData = new FormData()
  formData.set("import_mode", data.import_mode)
  formData.set(
    "process_valid_rows_only",
    data.process_valid_rows_only === false ? "false" : "true"
  )
  if (file instanceof File) {
    formData.set("file", file)
  } else {
    formData.set("file", file, fileName?.trim() || "employee-import.xlsx")
  }

  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    cache: "no-store",
  })

  invalidateAdminGetCache()

  const contentType = response.headers.get("content-type")
  // Import endpoints must return JSON status. Binary/xlsx is never a valid status body.
  if (isBinaryContentType(contentType)) {
    // Drain body so the connection can close cleanly.
    await response.arrayBuffer().catch(() => undefined)
    if (!response.ok) {
      throw new Error("Import failed. The server returned an error file instead of a status.")
    }
    throw new Error("Unexpected file response from import. Expected a status summary.")
  }

  const text = await response.text()
  const payload = parseResponseBodyText(text, contentType)

  if (!response.ok) {
    const error = new Error(extractMessage(payload, response.status)) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  // Successful HTTP but body is binary disguised as text → reject for UI safety.
  const record = asRecord(payload)
  if (record?._binaryResponse === true) {
    throw new Error(
      typeof record.message === "string"
        ? record.message
        : "Unexpected file response from import. Expected a status summary."
    )
  }

  return asRecord(payload) ?? normalizeSingle(payload)
}

export async function previewEmployeeImport(
  token: string,
  data: EmployeeImportRequest,
  file: File | Blob,
  fileName?: string
) {
  return submitEmployeeImportRequest("/api/employees/import/preview", token, data, file, fileName)
}

export async function getEmployeeImportPreview(token: string, batchId: string) {
  const payload = await adminRequest<unknown>(
    `/api/employees/import/${encodeURIComponent(batchId)}/preview`,
    {
      token,
    }
  )
  return asRecord(payload) ?? normalizeSingle(payload)
}

export async function startEmployeeImport(
  token: string,
  data: EmployeeImportRequest,
  file: File | Blob,
  fileName?: string
) {
  return submitEmployeeImportRequest("/api/employees/import", token, data, file, fileName)
}

export async function confirmEmployeeImport(token: string, data: EmployeeImportConfirmRequest) {
  const payload = await adminRequest<unknown>("/api/employees/import/confirm", {
    method: "POST",
    token,
    body: data,
  })
  return asRecord(payload) ?? normalizeSingle(payload)
}

export type EmployeeImportResultResponse =
  | {
      type: "json"
      payload: AdminRecord | null
    }
  | {
      type: "file"
      blob: Blob
      filename: string
      contentType: string | null
    }

function filenameFromContentDisposition(disposition: string | null, fallback: string) {
  const value = disposition ?? ""
  const filenameMatch = value.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i)
  const rawFilename = filenameMatch?.[1] ?? filenameMatch?.[2] ?? fallback
  try {
    return decodeURIComponent(rawFilename)
  } catch {
    return rawFilename
  }
}

function isZipOrXlsxMagic(bytes: Uint8Array) {
  // ZIP / XLSX local file header: PK\x03\x04 (or empty PK\x05\x06)
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b
}

/** Fetch the JSON status/summary for an employee import batch. */
export async function getEmployeeImportResult(
  token: string,
  batchId: string
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
    }
  )

  const contentType = response.headers.get("content-type")
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const looksLikeFile =
    isBinaryContentType(contentType) || isZipOrXlsxMagic(bytes)

  if (!response.ok) {
    if (looksLikeFile && buffer.byteLength > 0) {
      // Some APIs return an error workbook with a non-2xx status.
      return {
        type: "file",
        blob: new Blob([buffer], {
          type: contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        filename: filenameFromContentDisposition(
          response.headers.get("content-disposition"),
          `employee-import-result-${batchId}.xlsx`
        ),
        contentType,
      }
    }

    const text = new TextDecoder().decode(buffer)
    const payload = parseResponseBodyText(text, contentType)
    const error = new Error(extractMessage(payload, response.status)) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (looksLikeFile) {
    return {
      type: "file",
      blob: new Blob([buffer], {
        type: contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename: filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        `employee-import-result-${batchId}.xlsx`
      ),
      contentType,
    }
  }

  const text = new TextDecoder().decode(buffer)
  const payload = parseResponseBodyText(text, contentType)
  const record = asRecord(payload)

  if (record?._binaryResponse === true) {
    // Body looked binary after text decode; re-wrap original bytes as a file.
    return {
      type: "file",
      blob: new Blob([buffer], {
        type: contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename: filenameFromContentDisposition(
        response.headers.get("content-disposition"),
        `employee-import-result-${batchId}.xlsx`
      ),
      contentType,
    }
  }

  return {
    type: "json",
    payload: record ?? normalizeSingle(payload),
  }
}

/** Download the import error/result report workbook for a batch. */
export async function downloadEmployeeImportResult(
  token: string,
  batchId: string
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(
    buildUrl(`/api/employees/import/${encodeURIComponent(batchId)}/errors/download`),
    {
      method: "GET",
      headers: {
        accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    }
  )

  const contentType = response.headers.get("content-type")
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const looksLikeFile = isBinaryContentType(contentType) || isZipOrXlsxMagic(bytes)

  if (!response.ok) {
    const text = new TextDecoder().decode(buffer)
    const payload = parseResponseBodyText(text, contentType)
    const error = new Error(extractMessage(payload, response.status)) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (!looksLikeFile) {
    const text = new TextDecoder().decode(buffer)
    const payload = parseResponseBodyText(text, contentType)
    const record = asRecord(payload)
    throw new Error(
      typeof record?.message === "string"
        ? record.message
        : "Unexpected response when downloading the import report."
    )
  }

  return {
    blob: new Blob([buffer], {
      type: contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename: filenameFromContentDisposition(
      response.headers.get("content-disposition"),
      `employee-import-result-${batchId}.xlsx`
    ),
    contentType,
  }
}

export async function listEmployeeImportHistory(
  token: string,
  params: { page?: number; limit?: number } = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildEmployeeImportHistoryQuery(params)
  const payload = await adminRequest<unknown>(`/api/employees/import/history${query}`, {
    token,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function downloadEmployeeImportTemplate(
  token: string
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const response = await fetch(buildUrl("/api/employees/import/template"), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        payload = { message: text }
      }
    }
    const error = new Error(extractMessage(payload, response.status)) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  const blob = await response.blob()
  const disposition = response.headers.get("content-disposition") ?? ""
  const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i)
  const rawFilename = filenameMatch?.[1] ?? filenameMatch?.[2] ?? "employee-import-template.xlsx"
  const filename = decodeURIComponent(rawFilename)

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  }
}

export async function listDepartments(
  token: string,
  params: DepartmentsQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildDepartmentsQuery(params)
  const payload = await adminRequest<unknown>(`/api/departments${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listBranches(
  token: string,
  params: BranchesQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildBranchesQuery(params)
  const payload = await adminRequest<unknown>(`/api/branches${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listPositions(
  token: string,
  params: PositionsQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildPositionsQuery(params)
  const payload = await adminRequest<unknown>(`/api/positions${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listLeaveTypes(
  token: string,
  params: LeaveTypesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveTypesQuery(params)
  const payload = await adminRequest<unknown>(`/api/leave/types${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listLeaveRequests(
  token: string,
  params: LeaveRequestsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveRequestsQuery(params)
  const payload = await adminRequest<unknown>(`/api/leave/requests${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listLeaveBalances(
  token: string,
  params: LeaveBalancesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveBalancesQuery(params)
  const payload = await adminRequest<unknown>(`/api/leave/balances${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listLeaveHolidays(
  token: string,
  params: LeaveHolidaysQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveHolidaysQuery(params)
  const payload = await adminRequest<unknown>(`/api/leave/holidays${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listLeavePolicies(
  token: string,
  params: LeavePoliciesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeavePoliciesQuery(params)
  const payload = await adminRequest<unknown>(`/api/leave/policies${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listLeaveWorkflows(
  token: string,
  params: LeaveWorkflowsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveWorkflowsQuery(params)
  const payload = await adminRequest<unknown>(`/api/leave/workflows${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listOnboardingWorkflows(
  token: string,
  params: OnboardingWorkflowsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildOnboardingWorkflowsQuery(params)
  const payload = await adminRequest<unknown>(`/api/onboarding/workflows${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listOnboardingRequests(
  token: string,
  params: OnboardingRequestsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildOnboardingRequestsQuery(params)
  const payload = await adminRequest<unknown>(`/api/onboarding/requests${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listOffboardingRequests(
  token: string,
  params: OffboardingRequestsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildOffboardingRequestsQuery(params)
  const payload = await adminRequest<unknown>(`/api/offboarding/requests${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listOffboardingWorkflows(
  token: string,
  params: OffboardingWorkflowsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildOffboardingWorkflowsQuery(params)
  const payload = await adminRequest<unknown>(`/api/offboarding/workflows${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

/** Shared query string for attendance list endpoints (date range, employee, status, etc.). */
function buildAttendanceQuery(params: AttendanceQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (params.employee_no && params.employee_no.trim()) {
    searchParams.set("employee_no", params.employee_no.trim())
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  if (typeof params.organization_id === "number" && params.organization_id > 0) {
    searchParams.set("organization_id", String(params.organization_id))
  }
  if (typeof params.branch_id === "number" && params.branch_id > 0) {
    searchParams.set("branch_id", String(params.branch_id))
  }
  if (typeof params.department_id === "number" && params.department_id > 0) {
    searchParams.set("department_id", String(params.department_id))
  }
  if (typeof params.shift_id === "number" && params.shift_id > 0) {
    searchParams.set("shift_id", String(params.shift_id))
  }
  if (typeof params.timetable_id === "number" && params.timetable_id > 0) {
    searchParams.set("timetable_id", String(params.timetable_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.attendance_status && params.attendance_status.trim()) {
    searchParams.set("attendance_status", params.attendance_status.trim())
  }
  if (typeof params.is_active === "boolean") {
    searchParams.set("is_active", params.is_active ? "true" : "false")
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

async function listAttendanceCollectionPage(
  path: string,
  token: string,
  params: AttendanceQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildAttendanceQuery(params)
  const payload = await adminRequest<unknown>(`${path}${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

async function listAllAttendanceCollection(
  path: string,
  token: string,
  params: AttendanceQueryParams = {}
): Promise<PaginatedUsersResult> {
  const requestedLimit = params.limit && params.limit > 0 ? params.limit : env.NEXT_PUBLIC_MAX_PAGE_SIZE
  const pageSize = Math.min(requestedLimit, env.NEXT_PUBLIC_MAX_PAGE_SIZE)
  const startPage = params.page && params.page > 0 ? params.page : 1

  const mergedRows: AdminRecord[] = []
  let page = startPage
  let total: number | null = null
  let totalPages: number | null = null

  while (true) {
    const pageResult = await listAttendanceCollectionPage(path, token, {
      ...params,
      page,
      limit: pageSize,
    })

    mergedRows.push(...pageResult.rows)
    if (total === null && pageResult.total !== null) {
      total = pageResult.total
    }
    if (totalPages === null && pageResult.totalPages !== null) {
      totalPages = pageResult.totalPages
    }

    const hasMoreByCount = pageResult.rows.length === pageSize
    const hasMoreByMeta = totalPages !== null ? page < totalPages : null

    if (!hasMoreByCount) {
      break
    }

    if (hasMoreByMeta === false) {
      break
    }

    page += 1
    if (page > 1000) {
      break
    }
  }

  return {
    rows: mergedRows,
    page: startPage,
    limit: mergedRows.length || pageSize,
    total,
    totalPages,
  }
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
  params: AttendanceQueryParams = {}
): Promise<PaginatedUsersResult> {
  const page = params.page && params.page > 0 ? params.page : 1
  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 100

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
    ...(params.sortBy && params.sortBy.trim() && params.sortBy.trim() !== "created_at"
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
  ]

  let lastError: unknown = null
  let lastEmpty: PaginatedUsersResult | null = null

  for (const attempt of queryAttempts) {
    try {
      const result = await listAttendanceCollectionPage(
        "/api/attendance/config/policies",
        token,
        attempt
      )
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
            }
          )
          if (all.rows.length > 0) {
            return all
          }
        }
        return result
      }
      lastEmpty = result
      lastError = null
    } catch (errorObject) {
      lastError = errorObject
    }
  }

  // Raw GET with no query string — some environments reject pagination/sort entirely.
  try {
    const payload = await adminRequest<unknown>("/api/attendance/config/policies", { token })
    if (process.env.NODE_ENV === "development") {
      const keys =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? Object.keys(payload as object)
          : Array.isArray(payload)
            ? [`array(${payload.length})`]
            : [typeof payload]
      console.debug("[listAttendancePolicies] raw payload keys:", keys)
    }
    const rows = normalizeList(payload)
    if (rows.length > 0) {
      return {
        rows,
        page: 1,
        limit: rows.length,
        total: rows.length,
        totalPages: 1,
      }
    }
  } catch (errorObject) {
    lastError = errorObject
  }

  if (lastError) {
    throw lastError
  }

  return (
    lastEmpty ?? {
      rows: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    }
  )
}

export async function listAttendanceSettings(token: string, params: AttendanceQueryParams = {}) {
  return listAttendancePolicies(token, params)
}

export async function getAttendancePolicy(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/attendance/config/policies/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function listAttendanceDevices(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/devices", token, params)
}

export async function listAttendanceDeviceEmployees(
  token: string,
  id: string | number,
  params: AttendanceQueryParams = {}
) {
  return listAllAttendanceCollection(`/api/attendance/devices/${id}/employees`, token, params)
}

export async function listAttendanceCheckpoints(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/checkpoints", token, params)
}

export async function listAttendanceGeofences(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/geofences", token, params)
}

export async function listAttendanceWifiNetworks(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/wifi-networks", token, params)
}

export async function listAttendanceMobilePunches(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/mobile-punches", token, params)
}

export async function listAttendanceHolidays(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/holidays", token, params)
}

export async function listAttendanceHolidayGroups(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/holiday-groups", token, params)
}

export async function listAttendanceDeviceSyncLogs(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/device-sync-logs", token, params)
}

export async function listAttendanceDailySummaries(
  token: string,
  params: AttendanceQueryParams = {}
) {
  return listAllAttendanceCollection("/api/attendance/daily-summaries", token, params)
}

/** Single-page daily summaries — use for paged UI and dashboard samples (not full history). */
export async function listAttendanceDailySummariesPage(
  token: string,
  params: AttendanceQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildAttendanceQuery(params)
  const payload = await adminRequest<unknown>(`/api/attendance/daily-summaries${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getAttendanceDailySummary(
  token: string,
  employeeId: string | number,
  date: string
) {
  const payload = await adminRequest<unknown>(`/api/attendance/daily-summaries/${employeeId}/${date}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function listAttendanceProcessingJobs(
  token: string,
  params: AttendanceQueryParams = {}
) {
  return listAllAttendanceCollection("/api/attendance/processing/jobs", token, params)
}

export async function runPendingAttendanceProcessingJobs(token: string) {
  return adminRequest<unknown>("/api/attendance/processing/jobs/run-pending", {
    method: "POST",
    token,
  })
}

/**
 * POST /api/attendance/daily-summaries/refresh
 * RefreshAttendanceDailySummariesDto — rebuild summaries and/or reprocess from raw logs.
 */
export type RefreshAttendanceDailySummariesInput = {
  start_date: string
  end_date: string
  device_id?: number
  employee_id?: number
  /** Prefer for new clients: background | immediate */
  execution_mode?: "background" | "immediate"
  /** Legacy: sync | async */
  execution?: "sync" | "async"
  /** Prefer for new clients: fetch_and_process | database_only */
  processing_source?: "fetch_and_process" | "database_only"
  /** Legacy: summaries_only | from_raw_logs */
  mode?: "summaries_only" | "from_raw_logs"
}

export async function refreshAttendanceDailySummaries(
  token: string,
  data: RefreshAttendanceDailySummariesInput
) {
  return adminRequest<unknown>("/api/attendance/daily-summaries/refresh", {
    method: "POST",
    token,
    body: data,
  })
}

/** @deprecated Use refreshAttendanceDailySummaries — maps to the same refresh endpoint. */
export async function rebuildAttendanceDailySummaries(
  token: string,
  data: AdminRecord | RefreshAttendanceDailySummariesInput
) {
  return refreshAttendanceDailySummaries(token, data as RefreshAttendanceDailySummariesInput)
}

/** @deprecated Prefer refreshAttendanceDailySummaries with processing_source. */
export async function processAttendanceRange(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/processing/run-range", {
    method: "POST",
    token,
    body: data,
  })
}

export async function downloadAttendanceReport(
  token: string,
  params: AttendanceReportDownloadParams
): Promise<{ blob: Blob; filename: string; contentType: string | null }> {
  const query = buildAttendanceReportQuery(params)
  const response = await fetch(buildUrl(`/api/attendance/reports/download${query}`), {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        payload = { message: text }
      }
    }
    const error = new Error(extractMessage(payload, response.status)) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  const blob = await response.blob()
  const disposition = response.headers.get("content-disposition") ?? ""
  const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i)
  const rawFilename = filenameMatch?.[1] ?? filenameMatch?.[2] ?? `attendance-report.${params.format}`
  const filename = decodeURIComponent(rawFilename)

  return {
    blob,
    filename,
    contentType: response.headers.get("content-type"),
  }
}

export async function listAttendanceUnmatchedLogs(
  token: string,
  params: AttendanceQueryParams = {}
) {
  return listAllAttendanceCollection("/api/attendance/processing/unmatched-logs", token, params)
}

function buildAttendanceBusinessTripsQuery(params: AttendanceQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.employee_id === "number" && params.employee_id > 0) {
    searchParams.set("employee_id", String(params.employee_id))
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.from_date && params.from_date.trim()) {
    searchParams.set("from_date", params.from_date.trim())
  }
  if (params.to_date && params.to_date.trim()) {
    searchParams.set("to_date", params.to_date.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

export async function listAttendanceBusinessTrips(
  token: string,
  params: AttendanceQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildAttendanceBusinessTripsQuery(params)
  const payload = await adminRequest<unknown>(`/api/attendance/business-trips${query}`, {
    token,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getAttendanceBusinessTrip(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/attendance/business-trips/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function createAttendanceBusinessTrip(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/business-trips", {
    method: "POST",
    token,
    body: data,
  })
}

export async function updateAttendanceBusinessTrip(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/attendance/business-trips/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function createAttendanceMobilePunchCheckIn(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/mobile-punches/check-in", {
    method: "POST",
    token,
    body: data,
  })
}

export async function createAttendanceMobilePunchCheckOut(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/mobile-punches/check-out", {
    method: "POST",
    token,
    body: data,
  })
}

export async function approveAttendanceMobilePunchOverride(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/attendance/mobile-punches/${id}/approve-override`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function rejectAttendanceMobilePunchOverride(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/attendance/mobile-punches/${id}/reject-override`, {
    method: "PATCH",
    token,
    body: data,
  })
}

async function listGenericCollection(
  path: string,
  token: string,
  params: UsersQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildUsersQuery(params)
  const payload = await adminRequest<unknown>(`${path}${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

function shiftResourcePath(resource: ShiftResourceKey) {
  const resourcePathMap: Partial<Record<ShiftResourceKey, string>> = {
    shifts: "/api/attendance/schedule-definitions/shifts",
    "shift-breaks": "/api/attendance/schedule-definitions/shift-breaks",
    "shift-rotation-groups": "/api/attendance/schedule-definitions/shift-rotation-groups",
    "shift-rotation-rules": "/api/attendance/schedule-definitions/shift-rotation-rules",
    "shift-assignments": "/api/attendance/assignments/shifts",
    "shift-schedules": "/api/attendance/schedules/manual-overrides",
  }

  return resourcePathMap[resource] ?? `/api/shift/${resource}`
}

function timetableResourcePath(resource: TimetableResourceKey) {
  const resourcePathMap: Partial<Record<TimetableResourceKey, string>> = {
    timetables: "/api/attendance/schedule-definitions/timetables",
    "timetable-days": "/api/attendance/schedule-definitions/timetable-days",
    "timetable-holiday-rules": "/api/attendance/schedule-definitions/timetable-holiday-rules",
    "timetable-rotations": "/api/attendance/schedule-definitions/timetable-rotations",
    "timetable-rotation-rules": "/api/attendance/schedule-definitions/timetable-rotation-rules",
    "employee-timetables": "/api/attendance/assignments/timetables",
  }

  return resourcePathMap[resource] ?? `/api/timetable/${resource}`
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
  }

  return resourcePathMap[resource]
}

function accessControlResourcePath(resource: AccessControlResourceKey) {
  return `/api/access-control/${resource}`
}

export async function getAttendanceResourceById(
  token: string,
  resource: AttendanceResourceKey,
  id: string | number
) {
  const payload = await adminRequest<unknown>(`${attendanceResourcePath(resource)}/${id}`, { token })
  // Prefer normalized entity, but keep envelope fields if normalize drops them.
  const single = normalizeSingle(payload)
  const root = asRecord(payload)
  if (single && root) {
    return { ...root, ...single }
  }
  return single ?? root
}

export async function createAttendanceResource(
  token: string,
  resource: AttendanceResourceKey,
  data: AdminRecord
) {
  return adminRequest<unknown>(attendanceResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  })
}

export async function updateAttendanceResourceById(
  token: string,
  resource: Exclude<AttendanceResourceKey, "device-sync-logs" | "mobile-punches">,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`${attendanceResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteAttendanceResourceById(
  token: string,
  resource: Exclude<AttendanceResourceKey, "device-sync-logs" | "mobile-punches">,
  id: string | number
) {
  return adminRequest<unknown>(`${attendanceResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function syncAttendanceDevice(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/attendance/devices/${id}/sync`, {
    method: "POST",
    token,
  })
}

export async function getAttendanceDeviceSyncStatus(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/attendance/devices/${id}/sync-status`, { token })
  return normalizeSingle(payload) ?? asRecord(payload)
}

export async function testAttendanceDeviceConnection(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/attendance/devices/${id}/test-connection`, {
    method: "POST",
    token,
  })
}

export async function getAccessControlAttendanceDeviceSyncStatus(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/attendance-devices/${id}/sync-status`,
    { token }
  )
  return normalizeSingle(payload) ?? asRecord(payload)
}

export async function syncAccessControlDeviceDoors(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/access-control/doors/sync-from-device/${id}`, {
    method: "POST",
    token,
  })
}

export async function syncAccessControlDeviceTemplates(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/access-control/schedule-templates/sync-from-device/${id}`, {
    method: "POST",
    token,
  })
}

export type AccessScheduleType = "DOOR" | "ATTENDANCE" | "MIXED"
export type AccessScheduleTemplateStatus = "ACTIVE" | "INACTIVE"

export interface AccessScheduleTemplatesQueryParams extends UsersQueryParams {
  status?: AccessScheduleTemplateStatus | string
  schedule_type?: AccessScheduleType | string
}

function buildAccessScheduleTemplatesQuery(params: AccessScheduleTemplatesQueryParams) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy && params.sortBy.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search && params.search.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.schedule_type && params.schedule_type.trim()) {
    searchParams.set("schedule_type", params.schedule_type.trim())
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

/** List access schedule templates (GET /api/access-control/schedule-templates). */
export async function listAccessScheduleTemplates(
  token: string,
  params: AccessScheduleTemplatesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildAccessScheduleTemplatesQuery(params)
  const payload = await adminRequest<unknown>(`/api/access-control/schedule-templates${query}`, {
    token,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

/** Get one access schedule template by id. */
export async function getAccessScheduleTemplate(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/access-control/schedule-templates/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

/**
 * Create access schedule template.
 * Body: CreateAccessScheduleTemplateDto
 * (device_id, hikvision_template_no, hikvision_week_plan_no, template_name, week_plan_id, …)
 */
export async function createAccessScheduleTemplate(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/access-control/schedule-templates", {
    method: "POST",
    token,
    body: data,
  })
}

/** Partially update an access schedule template. */
export async function updateAccessScheduleTemplate(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/access-control/schedule-templates/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

/** Delete an access schedule template. */
export async function deleteAccessScheduleTemplate(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/access-control/schedule-templates/${id}`, {
    method: "DELETE",
    token,
  })
}

/** Push one schedule template to a Hikvision device. */
export async function syncAccessScheduleTemplateToDevice(
  token: string,
  id: string | number,
  data: { device_id: number }
) {
  return adminRequest<unknown>(`/api/access-control/schedule-templates/${id}/sync-to-device`, {
    method: "POST",
    token,
    body: data,
  })
}

/** Pull schedule templates from a Hikvision device and upsert locally. */
export async function syncAccessScheduleTemplatesFromDevice(
  token: string,
  deviceId: string | number
) {
  return syncAccessControlDeviceTemplates(token, deviceId)
}

export async function syncHikvisionDeviceFingerprints(token: string, deviceId: string | number) {
  return adminRequest<unknown>(`/api/hikvision/devices/${deviceId}/sync-fingerprints`, {
    method: "POST",
    token,
  })
}

export async function syncHikvisionDeviceUsers(token: string, deviceId: string | number) {
  return adminRequest<unknown>(`/api/hikvision/devices/${deviceId}/sync-users`, {
    method: "POST",
    token,
  })
}

export async function syncAccessControlDeviceWeekPlans(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/access-control/week-plans/sync-from-device/${id}`, {
    method: "POST",
    token,
  })
}

export async function activateAttendancePolicy(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/attendance/config/policies/${id}/activate`, {
    method: "PATCH",
    token,
  })
}

export async function listEmployeePositions(
  token: string,
  params: EmployeePositionsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildEmployeePositionsQuery(params)
  const payload = await adminRequest<unknown>(`/api/employee-positions${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getEmployeePosition(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/employee-positions/${id}`, { token })
  return normalizeSingle(payload)
}

export async function createEmployeePosition(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/employee-positions", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchEmployeePosition(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/employee-positions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteEmployeePosition(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/employee-positions/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listShiftResources(
  token: string,
  resource: ShiftResourceKey,
  params: UsersQueryParams = {}
) {
  return listGenericCollection(shiftResourcePath(resource), token, params)
}

export async function getShiftResourceById(
  token: string,
  resource: ShiftResourceKey,
  id: string | number
) {
  const payload = await adminRequest<unknown>(`${shiftResourcePath(resource)}/${id}`, { token })
  return normalizeSingle(payload)
}

export async function createShiftResource(token: string, resource: ShiftResourceKey, data: AdminRecord) {
  return adminRequest<unknown>(shiftResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchShiftResourceById(
  token: string,
  resource: ShiftResourceKey,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`${shiftResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteShiftResourceById(
  token: string,
  resource: ShiftResourceKey,
  id: string | number
) {
  return adminRequest<unknown>(`${shiftResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listTimetableResources(
  token: string,
  resource: TimetableResourceKey,
  params: UsersQueryParams = {}
) {
  return listGenericCollection(timetableResourcePath(resource), token, params)
}

export async function getTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number
) {
  const payload = await adminRequest<unknown>(`${timetableResourcePath(resource)}/${id}`, { token })
  return normalizeSingle(payload)
}

export async function createTimetableResource(
  token: string,
  resource: TimetableResourceKey,
  data: AdminRecord
) {
  return adminRequest<unknown>(timetableResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`${timetableResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteTimetableResourceById(
  token: string,
  resource: TimetableResourceKey,
  id: string | number
) {
  return adminRequest<unknown>(`${timetableResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listAccessControlResources(
  token: string,
  resource: AccessControlResourceKey,
  params: UsersQueryParams = {}
) {
  return listGenericCollection(accessControlResourcePath(resource), token, params)
}

export async function getAccessControlResourceById(
  token: string,
  resource: AccessControlResourceKey,
  id: string | number
) {
  const payload = await adminRequest<unknown>(`${accessControlResourcePath(resource)}/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function createAccessControlResource(
  token: string,
  resource: AccessControlResourceKey,
  data: AdminRecord
) {
  return adminRequest<unknown>(accessControlResourcePath(resource), {
    method: "POST",
    token,
    body: data,
  })
}

export async function updateAccessControlResourceById(
  token: string,
  resource: AccessControlResourceKey,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`${accessControlResourcePath(resource)}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteAccessControlResourceById(
  token: string,
  resource: AccessControlResourceKey,
  id: string | number
) {
  return adminRequest<unknown>(`${accessControlResourcePath(resource)}/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listAccessGroupDoors(token: string, groupId: string | number) {
  const payload = await adminRequest<unknown>(`/api/access-control/groups/${groupId}/doors`, {
    token,
  })
  return normalizeList(payload)
}

export async function assignAccessGroupDoors(
  token: string,
  groupId: string | number,
  items: Array<{
    door_id: string | number
    schedule_template_id: string | number
    device_id?: string | number | null
  }>
) {
  return adminRequest<unknown>(`/api/access-control/groups/${groupId}/doors`, {
    method: "POST",
    token,
    body: {
      items: items
        .map((item) => {
          const doorId = Number(item.door_id)
          const scheduleTemplateId = Number(item.schedule_template_id)
          const deviceId =
            item.device_id === undefined || item.device_id === null ? null : Number(item.device_id)

          return {
            door_id: doorId,
            schedule_template_id: scheduleTemplateId,
            ...(deviceId !== null && Number.isFinite(deviceId) ? { device_id: deviceId } : {}),
          }
        })
        .filter(
          (item) =>
            Number.isFinite(item.door_id) && Number.isFinite(item.schedule_template_id)
        ),
    },
  })
}

export async function removeAccessGroupDoor(
  token: string,
  groupId: string | number,
  doorId: string | number
) {
  return adminRequest<unknown>(`/api/access-control/groups/${groupId}/doors/${doorId}`, {
    method: "DELETE",
    token,
  })
}

export async function listAccessGroupEmployees(token: string, groupId: string | number) {
  const payload = await adminRequest<unknown>(`/api/access-control/groups/${groupId}/employees`, {
    token,
  })
  return normalizeList(payload)
}

export async function assignAccessGroupEmployees(
  token: string,
  groupId: string | number,
  employeeIds: Array<string | number>
) {
  return adminRequest<unknown>(`/api/access-control/groups/${groupId}/employees`, {
    method: "POST",
    token,
    body: {
      employee_ids: employeeIds
        .map((employeeId) => Number(employeeId))
        .filter((employeeId) => Number.isFinite(employeeId)),
    },
  })
}

export async function removeAccessGroupEmployee(
  token: string,
  groupId: string | number,
  employeeId: string | number
) {
  return adminRequest<unknown>(`/api/access-control/groups/${groupId}/employees/${employeeId}`, {
    method: "DELETE",
    token,
  })
}

export async function assignEmployeeDevices(
  token: string,
  employeeId: string | number,
  data: {
    access_group_id: string | number
    device_ids: Array<string | number>
    valid_enabled?: boolean
    valid_begin_time?: string
    valid_end_time?: string
    local_ui_right?: boolean
    close_delay_enabled?: boolean
    max_open_door_time?: number
    open_door_time?: number
    user_verify_mode?: string
    metadata?: AdminRecord
    sync_now?: boolean
    continue_on_error?: boolean
  }
) {
  const accessGroupId = Number(data.access_group_id)
  return adminRequest<unknown>(`/api/access-control/employees/${employeeId}/devices`, {
    method: "POST",
    token,
    body: {
      access_group_id: accessGroupId,
      device_ids: data.device_ids
        .map((deviceId) => Number(deviceId))
        .filter((deviceId) => Number.isFinite(deviceId)),
      ...(typeof data.valid_enabled === "boolean" ? { valid_enabled: data.valid_enabled } : {}),
      ...(data.valid_begin_time ? { valid_begin_time: data.valid_begin_time } : {}),
      ...(data.valid_end_time ? { valid_end_time: data.valid_end_time } : {}),
      ...(typeof data.local_ui_right === "boolean" ? { local_ui_right: data.local_ui_right } : {}),
      ...(typeof data.close_delay_enabled === "boolean"
        ? { close_delay_enabled: data.close_delay_enabled }
        : {}),
      ...(typeof data.max_open_door_time === "number"
        ? { max_open_door_time: data.max_open_door_time }
        : {}),
      ...(typeof data.open_door_time === "number" ? { open_door_time: data.open_door_time } : {}),
      ...(data.user_verify_mode ? { user_verify_mode: data.user_verify_mode } : {}),
      ...(data.metadata ? { metadata: data.metadata } : {}),
      ...(typeof data.sync_now === "boolean" ? { sync_now: data.sync_now } : {}),
      ...(typeof data.continue_on_error === "boolean"
        ? { continue_on_error: data.continue_on_error }
        : {}),
    },
  })
}

/** List devices currently assigned to an employee (access-control). */
export async function listEmployeeDevices(token: string, employeeId: string | number) {
  const payload = await adminRequest<unknown>(`/api/access-control/employees/${employeeId}/devices`, {
    token,
  })
  return normalizeList(payload)
}

export async function getEmployeeAccessCredentials(_token: string, _employeeId: string | number) {
  void _token
  void _employeeId
  unsupportedAdminEndpoint(
    "Employee access credential management is not available in the current backend API."
  )
}

export async function createEmployeeAccessCredentials(
  _token: string,
  _employeeId: string | number,
  _data: AdminRecord
) {
  void _token
  void _employeeId
  void _data
  unsupportedAdminEndpoint(
    "Employee access credential creation is not available in the current backend API."
  )
}

export async function updateEmployeeAccessCredentials(
  _token: string,
  _employeeId: string | number,
  _data: AdminRecord
) {
  void _token
  void _employeeId
  void _data
  unsupportedAdminEndpoint(
    "Employee access credential updates are not available in the current backend API."
  )
}

export async function createEmployeeDevicePassword(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/password`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function updateEmployeeDevicePassword(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/password`,
    {
      method: "PATCH",
      token,
      body: data,
    }
  )
}

export async function captureEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/capture`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function listEmployeeDeviceFingerprints(
  token: string,
  employeeId: string | number,
  deviceId: string | number
) {
  const payload = await adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints`,
    {
      token,
    }
  )
  return normalizeList(payload)
}

export async function listAttendanceDeviceAssignmentMatches(
  token: string,
  deviceId: string | number,
  employeeId: string | number
) {
  const query = new URLSearchParams({
    deviceId: String(deviceId),
    employeeId: String(employeeId),
  })

  const payload = await adminRequest<unknown>(
    `/api/access-control/attendance-devices/employee-device-assignment-matches?${query.toString()}`,
    {
      token,
    }
  )
  return normalizeList(payload)
}

export async function syncEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/sync`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function resyncEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/resync`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function disableEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/disable`,
    {
      method: "PATCH",
      token,
    }
  )
}

export async function enableEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}/enable`,
    {
      method: "PATCH",
      token,
    }
  )
}

export async function deleteEmployeeDeviceFingerprint(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  fingerprintId: string,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/fingerprints/${fingerprintId}`,
    {
      method: "DELETE",
      token,
      body: data,
    }
  )
}

export async function registerEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/register`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function updateEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users`,
    {
      method: "PATCH",
      token,
      body: data,
    }
  )
}

export async function resyncEmployeeDeviceUser(
  token: string,
  employeeId: string | number,
  deviceId: string | number
) {
  return adminRequest<unknown>(
    `/api/access-control/employees/${employeeId}/devices/${deviceId}/users/resync`,
    {
      method: "POST",
      token,
    }
  )
}

export async function removeEmployeeDeviceAssignment(
  token: string,
  employeeId: string | number,
  deviceId: string | number
) {
  return adminRequest<unknown>(`/api/access-control/employees/${employeeId}/devices/${deviceId}`, {
    method: "DELETE",
    token,
  })
}

export async function syncAccessControlDoorsFromDevice(token: string, deviceId: string | number) {
  return adminRequest<unknown>(`/api/access-control/doors/sync-from-device/${deviceId}`, {
    method: "POST",
    token,
  })
}

export async function createDepartment(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/departments", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchDepartment(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/departments/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteDepartment(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/departments/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createBranch(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/branches", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchBranch(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/branches/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteBranch(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/branches/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listBranchAccess(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/branches/${id}/access`, { token })
  return normalizeList(payload)
}

export async function grantBranchAccess(
  token: string,
  branchId: string | number,
  userId: string | number
) {
  return adminRequest<unknown>(`/api/branches/${branchId}/access/${userId}`, {
    method: "POST",
    token,
  })
}

export async function revokeBranchAccess(
  token: string,
  branchId: string | number,
  userId: string | number
) {
  return adminRequest<unknown>(`/api/branches/${branchId}/access/${userId}`, {
    method: "DELETE",
    token,
  })
}

export async function createPosition(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/positions", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchPosition(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/positions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deletePosition(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/positions/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createLeaveType(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/types", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchLeaveType(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/leave/types/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteLeaveType(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/types/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createLeaveRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/requests", {
    method: "POST",
    token,
    body: data,
  })
}

export async function createMyLeaveRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/leave/requests", {
    method: "POST",
    token,
    body: data,
  })
}

export async function listMyLeaveRequests(
  token: string,
  params: LeaveRequestsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveRequestsQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/leave/requests${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getMyLeaveRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/leave/requests/${id}`, { token })
  return normalizeLeaveRequestDetail(payload)
}

export async function submitMyLeaveRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/submit`, {
    method: "POST",
    token,
  })
}

export async function cancelMyLeaveRequest(token: string, id: string | number, reason: string) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: { reason },
  })
}

export async function getMyLeaveRequestPdf(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/me/leave/requests/${id}/pdf`, { token })
}

export async function getLeaveRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/leave/requests/${id}`, { token })
  return normalizeLeaveRequestDetail(payload)
}

export async function leaveRequestApprovalAction(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/leave/requests/${id}/approval-action`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function cancelLeaveRequest(token: string, id: string | number, reason: string) {
  return adminRequest<unknown>(`/api/leave/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: { reason },
  })
}

export async function adjustLeaveBalance(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/balances/adjust", {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function createLeaveHoliday(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/holidays", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchLeaveHoliday(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/leave/holidays/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteLeaveHoliday(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/holidays/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createLeavePolicy(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/policies", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchLeavePolicy(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/leave/policies/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteLeavePolicy(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/policies/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createLeaveWorkflow(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/leave/workflows", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getLeaveWorkflow(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/leave/workflows/${id}`, { token })
  return normalizeSingle(payload)
}

export async function patchLeaveWorkflow(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/leave/workflows/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteLeaveWorkflow(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/leave/workflows/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listLeaveWorkflowSteps(token: string, workflowId: string | number) {
  const payload = await adminRequest<unknown>(`/api/leave/workflows/${workflowId}/steps`, { token })
  return normalizeList(payload)
}

export async function createLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/leave/workflows/${workflowId}/steps`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/leave/workflows/${workflowId}/steps/${stepId}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteLeaveWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number
) {
  return adminRequest<unknown>(`/api/leave/workflows/${workflowId}/steps/${stepId}`, {
    method: "DELETE",
    token,
  })
}

export async function addLeaveRequestDocument(
  token: string,
  leaveRequestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/leave/requests/${leaveRequestId}/documents`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchLeaveRequestMedicalDetail(
  token: string,
  leaveRequestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/leave/requests/${leaveRequestId}/medical-detail`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export function getLeaveRequestPdfUrl(id: string | number) {
  return buildUrl(`/api/leave/requests/${id}/pdf`)
}

export type OnboardingWorkflowStepPayload = {
  is_required: boolean
  name: string
  description: string
  step_type: string
  assigned_role_id?: number
  assigned_user_id?: number
  due_days: number
  step_order?: number
}

export type CreateOnboardingWorkflowPayload = {
  is_default?: boolean
  status?: string
  name: string
  description?: string
  steps?: OnboardingWorkflowStepPayload[]
}

export async function createOnboardingWorkflow(
  token: string,
  data: CreateOnboardingWorkflowPayload | AdminRecord
) {
  return adminRequest<unknown>("/api/onboarding/workflows", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOnboardingWorkflow(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/onboarding/workflows/${id}`, { token })
  const single = normalizeSingle(payload)
  const root = asRecord(payload)

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
      asRecord(root?.result)?.workflow_steps

    if (
      rootSteps &&
      !single.steps &&
      !single.workflow_steps &&
      !single.workflowSteps
    ) {
      return { ...single, steps: rootSteps }
    }
    return single
  }

  return root
}

export async function listOnboardingWorkflowSteps(token: string, workflowId: string | number) {
  const payload = await adminRequest<unknown>(`/api/onboarding/workflows/${workflowId}/steps`, {
    token,
  })
  return normalizeList(payload)
}

export async function patchOnboardingWorkflow(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteOnboardingWorkflow(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  data: OnboardingWorkflowStepPayload | AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${workflowId}/steps`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
  data: Partial<OnboardingWorkflowStepPayload> | AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${workflowId}/steps/${stepId}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteOnboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number
) {
  return adminRequest<unknown>(`/api/onboarding/workflows/${workflowId}/steps/${stepId}`, {
    method: "DELETE",
    token,
  })
}

export async function createOnboardingRequest(token: string, data: CreateOnboardingRequestPayload) {
  return adminRequest<unknown>("/api/onboarding/requests", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOnboardingRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/onboarding/requests/${id}`, { token })
  return normalizeSingle(payload)
}

export async function patchOnboardingRequest(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function approveOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/approve`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function rejectOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function cancelOnboardingRequest(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function completeOnboardingRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/complete`, {
    method: "POST",
    token,
  })
}

export async function submitOnboardingRequest(token: string, id: string | number) {
  unsupportedAdminEndpoint(
    `Onboarding request submission is no longer exposed as a standalone endpoint in the current API spec. Request ${id} should be created with submit=true instead.`
  )
}

export async function reactivateOnboardingRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/onboarding/requests/${id}`, {
    method: "PATCH",
    token,
    body: {
      status: "active",
    },
  })
}

export async function deleteOnboardingRequest(token: string, id: string | number) {
  return cancelOnboardingRequest(token, id, {
    reason: "Cancelled by admin",
  })
}

export async function uploadOnboardingDocument(
  token: string,
  requestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${requestId}/documents`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function verifyOnboardingDocument(
  token: string,
  requestId: string | number,
  documentId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${requestId}/documents/${documentId}/verify`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function createOnboardingTask(
  token: string,
  requestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${requestId}/tasks`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function completeOnboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/onboarding/requests/${requestId}/tasks/${taskId}/complete`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOnboardingProgress(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/onboarding/requests/${requestId}/progress`, { token })
  return asRecord(payload) ?? {}
}

export async function getOnboardingAuditLogs(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/onboarding/requests/${requestId}/audit-logs`, { token })
  return normalizeList(payload)
}

export async function createOffboardingWorkflow(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/offboarding/workflows", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOffboardingWorkflow(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/workflows/${id}`, { token })
  return normalizeSingle(payload)
}

export async function patchOffboardingWorkflow(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteOffboardingWorkflow(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function createOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${workflowId}/steps`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${workflowId}/steps/${stepId}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteOffboardingWorkflowStep(
  token: string,
  workflowId: string | number,
  stepId: string | number
) {
  return adminRequest<unknown>(`/api/offboarding/workflows/${workflowId}/steps/${stepId}`, {
    method: "DELETE",
    token,
  })
}

export async function createOffboardingRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/offboarding/requests", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOffboardingRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${id}`, { token })
  return normalizeSingle(payload)
}

export async function patchOffboardingRequest(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function submitOffboardingRequest(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/submit`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function approveOffboardingRequest(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/approve`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function rejectOffboardingRequest(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function cancelOffboardingRequest(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function completeOffboardingRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/offboarding/requests/${id}/complete`, {
    method: "POST",
    token,
  })
}

export async function addOffboardingDocument(
  token: string,
  requestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/documents`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function listOffboardingDocuments(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/documents`, { token })
  return normalizeList(payload)
}

export async function createOffboardingTask(
  token: string,
  requestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/tasks`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function completeOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/tasks/${taskId}/complete`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function rejectOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/tasks/${taskId}/reject`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function createOffboardingClearance(
  token: string,
  requestId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/clearances`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function completeOffboardingClearance(
  token: string,
  requestId: string | number,
  clearanceId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/clearances/${clearanceId}/complete`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOffboardingProgress(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/progress`, { token })
  return asRecord(payload) ?? {}
}

export async function getOffboardingApprovals(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/approvals`, { token })
  return normalizeList(payload)
}

export async function getOffboardingAuditLogs(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/audit-logs`, { token })
  return normalizeList(payload)
}

export async function getOffboardingDashboard(token: string) {
  const payload = await adminRequest<unknown>("/api/offboarding/dashboard", { token })
  return asRecord(payload) ?? normalizeSingle(payload) ?? {}
}

function isForbiddenOrMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const status = (error as { status?: number }).status
  if (status === 401 || status === 403 || status === 404) return true
  const message = String((error as { message?: string }).message ?? "").toLowerCase()
  return (
    message.includes("forbidden") ||
    message.includes("not allowed") ||
    message.includes("unauthorized") ||
    message.includes("access denied") ||
    message.includes("not found")
  )
}

/**
 * Soft-read helpers for "my" offboarding queues.
 * Many employee roles are not granted these endpoints (403 Forbidden resource).
 * Callers should treat an empty array as "none" and optionally fall back.
 */
export async function listMyOffboardingApprovals(token: string): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>("/api/offboarding/approvals/my", { token })
    return normalizeList(payload)
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return []
    throw error
  }
}

export async function listMyOffboardingTasks(token: string): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>("/api/offboarding/tasks/my", { token })
    return normalizeList(payload)
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return []
    throw error
  }
}

export async function listMyOffboardingClearances(token: string): Promise<AdminRecord[]> {
  try {
    const payload = await adminRequest<unknown>("/api/offboarding/clearances/my", { token })
    return normalizeList(payload)
  } catch (error) {
    if (isForbiddenOrMissingError(error)) return []
    throw error
  }
}

/** Pull nested task/clearance arrays from a request detail or progress payload. */
export function extractOffboardingItemsFromRecord(
  record: AdminRecord | null | undefined,
  kinds: Array<"tasks" | "clearances">
): { tasks: AdminRecord[]; clearances: AdminRecord[] } {
  const root = asRecord(record) ?? {}
  const nested =
    asRecord(root.data) ??
    asRecord(root.result) ??
    asRecord(root.item) ??
    asRecord(root.progress) ??
    root

  const collect = (keys: string[]): AdminRecord[] => {
    for (const key of keys) {
      const value = nested[key] ?? root[key]
      if (Array.isArray(value)) {
        return value.filter(
          (entry): entry is AdminRecord => typeof entry === "object" && entry !== null
        )
      }
    }
    return []
  }

  return {
    tasks: kinds.includes("tasks")
      ? collect(["tasks", "task_list", "taskList", "assigned_tasks", "my_tasks"])
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
  }
}

/**
 * Fallback when GET /tasks/my or /clearances/my is forbidden for the actor:
 * load the actor's offboarding requests and harvest nested items from detail/progress.
 */
export async function listOffboardingItemsFromOwnRequests(
  token: string,
  kind: "tasks" | "clearances",
  employeeId?: number | null
): Promise<AdminRecord[]> {
  const requestsResult = await listOffboardingRequests(token, {
    page: 1,
    limit: 50,
    sortBy: "created_at",
    sortOrder: "DESC",
    employee_id: employeeId && employeeId > 0 ? employeeId : undefined,
  })

  const items: AdminRecord[] = []
  const seen = new Set<string>()

  for (const request of requestsResult.rows) {
    const requestId = (() => {
      const id = request.id ?? request.request_id
      if (typeof id === "number" && Number.isFinite(id)) return id
      if (typeof id === "string" && id.trim()) return id.trim()
      return null
    })()
    if (requestId === null) continue

    let detail: AdminRecord | null = null
    let progress: AdminRecord | null = null
    try {
      detail = (await getOffboardingRequest(token, requestId)) as AdminRecord | null
    } catch {
      detail = null
    }
    try {
      progress = (await getOffboardingProgress(token, requestId)) as AdminRecord | null
    } catch {
      progress = null
    }

    const fromDetail = extractOffboardingItemsFromRecord(detail, [kind])
    const fromProgress = extractOffboardingItemsFromRecord(progress, [kind])
    const fromRequest = extractOffboardingItemsFromRecord(request, [kind])
    const batch = kind === "tasks"
      ? [...fromDetail.tasks, ...fromProgress.tasks, ...fromRequest.tasks]
      : [...fromDetail.clearances, ...fromProgress.clearances, ...fromRequest.clearances]

    for (const row of batch) {
      const itemId = row.id ?? row.task_id ?? row.clearance_id
      const key = `${requestId}:${String(itemId ?? JSON.stringify(row).slice(0, 40))}`
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        ...row,
        offboarding_request_id: requestId,
        request_id: requestId,
      })
    }
  }

  return items
}

export async function listOffboardingActions(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/actions`, { token })
  return normalizeList(payload)
}

export async function listOffboardingAssets(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/assets`, { token })
  return normalizeList(payload)
}

export async function listOffboardingSettlements(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/settlements`, {
    token,
  })
  return normalizeList(payload)
}

export async function getOffboardingExitInterview(token: string, requestId: string | number) {
  const payload = await adminRequest<unknown>(`/api/offboarding/requests/${requestId}/exit-interview`, {
    token,
  })
  return asRecord(payload) ?? normalizeSingle(payload)
}

export async function reopenOffboardingTask(
  token: string,
  requestId: string | number,
  taskId: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/offboarding/requests/${requestId}/tasks/${taskId}/reopen`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function getCurrentAdmin(token: string) {
  const payload = await adminRequest<unknown>("/api/users/me", { token })
  return normalizeSingle(payload)
}

export async function getCurrentAdminProfile(token: string) {
  const payload = await adminRequest<unknown>("/api/users/me", { token })
  return normalizeSingle(payload)
}

export async function getMyCompany(token: string) {
  const payload = await adminRequest<unknown>("/api/companies/my", { token })
  const companies = normalizeList(payload)
  return companies[0] ?? normalizeSingle(payload)
}

export async function getAdminCompany(token: string) {
  const payload = await adminRequest<unknown>("/api/companies/my", { token })
  const companies = normalizeList(payload)
  return companies[0] ?? normalizeSingle(payload)
}

export async function createResource(resource: AdminResourceKey, token: string, data: AdminRecord) {
  return adminRequest<unknown>(RESOURCE_PATHS[resource], {
    method: "POST",
    token,
    body: data,
  })
}

export async function createEmployeeProfile(token: string, data: CreateEmployeePayload) {
  const payload = await adminRequest<unknown>("/api/employees", {
    method: "POST",
    token,
    body: data,
  })
  return ((normalizeSingle(payload) ?? asRecord(payload) ?? {}) as CreateEmployeeResponse)
}

export async function getEmployeeById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/employees/${id}`, { token })
  const root = asRecord(payload)
  if (looksLikeEmployeeRecord(root)) {
    return root
  }
  return normalizeSingle(payload)
}

export async function getCurrentEmployee(token: string) {
  const payload = await adminRequest<unknown>("/api/employees/me", { token })
  const root = asRecord(payload)
  const rootData = asRecord(root?.data)
  const rootResult = asRecord(root?.result)
  const rootItem = asRecord(root?.item)
  const candidates = [rootData, rootResult, rootItem, root]
  const nestedCandidates = [
    asRecord(rootData?.employee),
    asRecord(rootResult?.employee),
    asRecord(rootItem?.employee),
    asRecord(root?.employee),
  ]

  for (const candidate of candidates) {
    if (looksLikeEmployeeRecord(candidate)) {
      return candidate
    }
  }

  for (const candidate of nestedCandidates) {
    if (looksLikeEmployeeRecord(candidate)) {
      return candidate
    }
  }

  return normalizeSingle(payload)
}

export async function getMyProfile(token: string) {
  const payload = await adminRequest<unknown>("/api/me/profile", { token })
  return normalizeSingle(payload)
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
] as const

/**
 * Map a backend media path/URL onto the current API host.
 * - `/uploads/default-avatars/company-1/x.svg` → `{API_BASE}/uploads/...`
 * - Absolute upload URLs from another host are rewritten to the current API base
 *   so environments can move without broken images.
 * - `data:` / `blob:` URLs are left unchanged.
 */
export function resolveBackendMediaUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw

  const base = getBaseUrl().replace(/\/$/, "")

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      // Backend-hosted assets always rebind to the active API origin.
      if (
        url.pathname.startsWith("/uploads/") ||
        url.pathname.includes("/default-avatars/") ||
        url.pathname.includes("/profile-photos/")
      ) {
        return `${base}${url.pathname}${url.search}`
      }
      return raw
    } catch {
      return raw
    }
  }

  if (raw.startsWith("//")) {
    try {
      const url = new URL(`http:${raw}`)
      if (
        url.pathname.startsWith("/uploads/") ||
        url.pathname.includes("/default-avatars/") ||
        url.pathname.includes("/profile-photos/")
      ) {
        return `${base}${url.pathname}${url.search}`
      }
    } catch {
      // fall through
    }
  }

  // Relative path or bare filename under uploads.
  let path = raw.replace(/\\/g, "/")
  if (!path.startsWith("/")) {
    // e.g. uploads/default-avatars/... or default-avatars/company-1/...
    if (path.startsWith("uploads/") || path.startsWith("default-avatars/") || path.startsWith("profile-photos/")) {
      path = path.startsWith("uploads/") ? `/${path}` : `/uploads/${path}`
    } else {
      path = `/${path}`
    }
  }
  return `${base}${path}`
}

/**
 * Extract a profile picture URL from common API response shapes.
 * Supports plain strings, `{ url }`, nested `data`/`result`/`user`/`employee` objects.
 * Relative/upload paths are resolved against the active API base URL.
 */
export function extractProfilePhotoUrl(payload: unknown): string | null {
  if (typeof payload === "string") {
    return resolveBackendMediaUrl(payload)
  }

  const root = asRecord(payload)
  if (!root) {
    return null
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
  ]

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    for (const key of PROFILE_PHOTO_URL_KEYS) {
      const value = candidate[key]
      if (typeof value === "string" && value.trim()) {
        return resolveBackendMediaUrl(value)
      }
    }
  }

  return null
}

/**
 * GET /api/me/profile/photo — returns the signed-in user's profile picture URL.
 * Missing photo (404) resolves to null rather than throwing.
 */
export async function getMyProfilePhotoUrl(token: string): Promise<string | null> {
  try {
    const payload = await adminRequest<unknown>("/api/me/profile/photo", {
      token,
      cacheTtlMs: 30_000,
    })
    return extractProfilePhotoUrl(payload)
  } catch (errorObject) {
    const status =
      typeof errorObject === "object" &&
      errorObject !== null &&
      "status" in errorObject
        ? Number((errorObject as { status?: number }).status)
        : null
    if (status === 404 || status === 204) {
      return null
    }
    throw errorObject
  }
}

/**
 * Upload the signed-in user's profile picture.
 * POST /api/me/profile/photo (multipart/form-data, field: file) → 201
 */
export async function uploadMyProfilePhoto(
  token: string,
  file: File | Blob,
  fileName?: string
): Promise<AdminRecord | null> {
  const formData = new FormData()
  if (file instanceof File) {
    formData.set("file", file)
  } else {
    formData.set("file", file, fileName?.trim() || "profile-photo.jpg")
  }

  const response = await fetch(buildUrl("/api/me/profile/photo"), {
    method: "POST",
    headers: {
      // Let the browser set multipart boundary; do not force JSON content-type.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    cache: "no-store",
  })

  invalidateAdminGetCache()

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text) as unknown
    } catch {
      payload = { message: text }
    }
  }

  if (!response.ok) {
    const error = new Error(extractMessage(payload, response.status)) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  // Prefer explicit URL from the upload response; otherwise re-fetch GET photo.
  const fromBody = extractProfilePhotoUrl(payload)
  if (fromBody) {
    return { ...(asRecord(payload) ?? {}), profile_photo_url: fromBody }
  }

  try {
    const photoUrl = await getMyProfilePhotoUrl(token)
    if (photoUrl) {
      return { profile_photo_url: photoUrl }
    }
  } catch {
    // Upload succeeded; URL may appear after a short delay.
  }

  return normalizeSingle(payload) ?? asRecord(payload)
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
  defaultAvatarId: number | null
): Promise<AdminRecord | null> {
  // Backend DTO expects number | null — never send a string id.
  const body: { default_avatar_id: number | null } = {
    default_avatar_id:
      defaultAvatarId == null
        ? null
        : Number.isFinite(Number(defaultAvatarId))
          ? Math.trunc(Number(defaultAvatarId))
          : null,
  }
  if (defaultAvatarId != null && body.default_avatar_id == null) {
    throw new Error("Invalid default avatar id.")
  }

  const payload = await adminRequest<unknown>("/api/me/profile/avatar", {
    method: "PATCH",
    token,
    body,
  })

  const fromBody = extractProfilePhotoUrl(payload)
  if (fromBody) {
    return { ...(asRecord(payload) ?? {}), profile_photo_url: fromBody }
  }

  try {
    const photoUrl = await getMyProfilePhotoUrl(token)
    if (photoUrl) {
      return { ...(asRecord(payload) ?? {}), profile_photo_url: photoUrl }
    }
  } catch {
    // Selection succeeded; URL may appear after a short delay.
  }

  return normalizeSingle(payload) ?? asRecord(payload)
}

export async function getMyStatus(token: string) {
  const payload = await adminRequest<unknown>("/api/me/status", { token })
  return normalizeSingle(payload)
}

export async function getMyDashboard(token: string) {
  const payload = await adminRequest<unknown>("/api/me/dashboard", { token })
  return asRecord(payload) ?? normalizeSingle(payload)
}

export async function getMyAttendanceAssignments(token: string) {
  const payload = await adminRequest<unknown>("/api/me/attendance/assignments", { token })
  return normalizeSingle(payload) ?? asRecord(payload)
}

export async function createMyAttendanceCheckIn(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/attendance/check-in", {
    method: "POST",
    token,
    body: data,
  })
}

export async function createMyAttendanceCheckOut(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/attendance/check-out", {
    method: "POST",
    token,
    body: data,
  })
}

export async function createMyAttendanceCorrectionRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/attendance/correction-requests", {
    method: "POST",
    token,
    body: data,
  })
}

export async function listMyAttendanceCorrectionRequests(
  token: string,
  params: SelfServiceRequestQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildSelfServiceRequestQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/attendance/correction-requests${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getMyAttendanceCorrectionRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/attendance/correction-requests/${id}`, { token })
  return normalizeSingle(payload)
}

export async function cancelMyAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/me/attendance/correction-requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function submitMyAttendanceCorrectionRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/me/attendance/correction-requests/${id}/submit`, {
    method: "POST",
    token,
  })
}

export async function getMyAttendanceOverview(
  token: string,
  params: MyAttendanceHistoryQueryParams = {}
) {
  const query = buildMyAttendanceHistoryQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/attendance/overview${query}`, { token })
  return normalizeSingle(payload) ?? asRecord(payload)
}

export async function listMyAttendanceHistory(
  token: string,
  params: MyAttendanceHistoryQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildMyAttendanceHistoryQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/attendance/history${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listMyAttendancePunches(
  token: string,
  params: MyAttendancePunchesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildMyAttendancePunchesQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/attendance/punches${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getMyAttendanceSchedule(
  token: string,
  params: MyAttendanceScheduleQueryParams = {}
) {
  const query = buildMyAttendanceScheduleQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/attendance/schedule${query}`, { token })
  return normalizeList(payload)
}

/**
 * Attendance "today" payloads often include nested relations (employee, branch, schedule).
 * Generic normalizeSingle() returns the first nested object and drops day status / punch times.
 */
function looksLikeAttendanceTodayRecord(record: AdminRecord | null): boolean {
  if (!record) return false
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
  ] as const
  return keys.some((key) => key in record)
}

function mergeAttendanceTodayLayers(...layers: Array<AdminRecord | null | undefined>): AdminRecord {
  const merged: AdminRecord = {}
  for (const layer of layers) {
    if (!layer) continue
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null) continue
      // Prefer first non-empty scalar; keep first object/array unless missing.
      if (!(key in merged)) {
        merged[key] = value
        continue
      }
      const existing = merged[key]
      if (
        (existing === "" || existing === "-" || existing === null || existing === undefined) &&
        value !== "" &&
        value !== "-"
      ) {
        merged[key] = value
      }
    }
  }
  return merged
}

function normalizeMyAttendanceToday(payload: unknown): AdminRecord | null {
  const root = asRecord(payload)
  if (!root) {
    const list = asArray(payload)
    return list?.[0] ?? null
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
  ].filter(Boolean) as AdminRecord[]

  let base: AdminRecord | null = null
  if (looksLikeAttendanceTodayRecord(root)) {
    base = root
  } else {
    for (const candidate of envelopeCandidates) {
      if (looksLikeAttendanceTodayRecord(candidate)) {
        base = candidate
        break
      }
    }
  }

  // Fall back to first envelope object, then root — never first nested employee/branch alone.
  if (!base) {
    base = envelopeCandidates[0] ?? root
  }

  const nestedSummary =
    asRecord(base.summary) ??
    asRecord(base.daily_summary) ??
    asRecord(base.dailySummary) ??
    asRecord(base.attendance) ??
    asRecord(base.today) ??
    asRecord(root.summary) ??
    asRecord(root.daily_summary)

  // Flatten useful nested summary fields onto the top-level record for UI readers.
  const flattened = mergeAttendanceTodayLayers(base, nestedSummary)

  // Preserve nested objects for detailed views (TodayOverview already reads summary).
  if (nestedSummary && !asRecord(flattened.summary)) {
    flattened.summary = nestedSummary
  }

  return flattened
}

export async function getMyAttendanceToday(token: string) {
  const payload = await adminRequest<unknown>("/api/me/attendance/today", { token })
  return normalizeMyAttendanceToday(payload)
}

export async function createMyProfileUpdateRequest(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/me/profile-update-requests", {
    method: "POST",
    token,
    body: data,
  })
}

export async function listMyProfileUpdateRequests(
  token: string,
  params: SelfServiceRequestQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const searchParams = new URLSearchParams()
  searchParams.set("page", String(fallbackPage))
  searchParams.set("limit", String(fallbackLimit))
  if (params.status && params.status.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.date_from && params.date_from.trim()) {
    searchParams.set("date_from", params.date_from.trim())
  }
  if (params.date_to && params.date_to.trim()) {
    searchParams.set("date_to", params.date_to.trim())
  }
  const query = `?${searchParams.toString()}`
  const payload = await adminRequest<unknown>(`/api/me/profile-update-requests${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getMyProfileUpdateRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/me/profile-update-requests/${id}`, { token })
  return normalizeSingle(payload)
}

export async function cancelMyProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/me/profile-update-requests/${id}/cancel`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function submitMyProfileUpdateRequest(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/me/profile-update-requests/${id}/submit`, {
    method: "POST",
    token,
  })
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
] as const

function readProfileUpdateRequestRowId(row: AdminRecord) {
  const raw = row.id ?? row.request_id ?? row.requestId
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw)
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim()
  }
  return ""
}

function profileUpdateRequestSortTime(row: AdminRecord) {
  const candidates = [row.submitted_at, row.updated_at, row.created_at, row.decided_at, row.reviewed_at]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      const time = Date.parse(value)
      if (Number.isFinite(time)) {
        return time
      }
    }
  }
  return 0
}

/**
 * Build list query for HR profile-update approvals.
 * Match attendance-corrections: only page/limit/status/from_date/to_date/employee_id.
 * Extra keys (sortBy, includeHistory, dual date aliases) caused HTTP 400 Bad Request
 * on backends with strict query validation.
 */
function buildHrProfileUpdateApprovalsQuery(
  params: SelfServiceRequestQueryParams & { employee_id?: number },
  status?: string
) {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = new URLSearchParams()

  query.set("page", String(fallbackPage))
  query.set("limit", String(fallbackLimit))

  if (params.employee_id !== undefined) {
    query.set("employee_id", String(params.employee_id))
  }
  const statusValue = (status ?? params.status)?.trim()
  if (statusValue && statusValue.toLowerCase() !== "all") {
    query.set("status", statusValue)
  }
  if (params.date_from) {
    query.set("from_date", params.date_from)
  }
  if (params.date_to) {
    query.set("to_date", params.date_to)
  }

  return query
}

export async function listHrProfileUpdateApprovalRequests(
  token: string,
  params: SelfServiceRequestQueryParams & {
    employee_id?: number
    /** When true (and no single status), fetch pending + decided statuses for history. */
    includeHistory?: boolean
  } = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20

  const fetchPage = async (status?: string) => {
    const query = buildHrProfileUpdateApprovalsQuery(
      status === undefined ? { ...params, status: undefined } : params,
      status
    )
    const payload = await adminRequest<unknown>(
      `/api/hr/self-service/approvals/profile-updates?${query.toString()}`,
      { token }
    )
    const rows = normalizeList(payload)
    const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
    return { rows, ...pagination }
  }

  const mergeSettledPages = (
    settled: PromiseSettledResult<PaginatedUsersResult>[]
  ): PaginatedUsersResult | null => {
    const byId = new Map<string, AdminRecord>()
    let totalHint: number | null = null
    let anyFulfilled = false

    for (const result of settled) {
      if (result.status !== "fulfilled") {
        continue
      }
      anyFulfilled = true
      if (typeof result.value.total === "number" && Number.isFinite(result.value.total)) {
        totalHint = Math.max(totalHint ?? 0, result.value.total)
      }
      for (const row of result.value.rows) {
        const id = readProfileUpdateRequestRowId(row)
        if (!id) {
          byId.set(`anon-${byId.size}-${JSON.stringify(row).slice(0, 48)}`, row)
          continue
        }
        const existing = byId.get(id)
        byId.set(id, existing ? { ...existing, ...row } : row)
      }
    }

    if (!anyFulfilled) {
      return null
    }

    const rows = Array.from(byId.values()).sort(
      (left, right) => profileUpdateRequestSortTime(right) - profileUpdateRequestSortTime(left)
    )

    return {
      rows,
      total: totalHint !== null ? Math.max(totalHint, rows.length) : rows.length,
      page: fallbackPage,
      limit: fallbackLimit,
      totalPages:
        fallbackLimit > 0
          ? Math.max(1, Math.ceil((totalHint !== null ? Math.max(totalHint, rows.length) : rows.length) / fallbackLimit))
          : 1,
    }
  }

  const fetchHistoryMerged = async () => {
    const settled = await Promise.allSettled([
      fetchPage(undefined),
      ...PROFILE_UPDATE_HISTORY_STATUSES.map((status) => fetchPage(status)),
    ])
    const merged = mergeSettledPages(settled)
    if (merged) {
      return merged
    }

    // Last resort: bare request with only page/limit (no status/dates).
    const bare = new URLSearchParams({
      page: String(fallbackPage),
      limit: String(fallbackLimit),
    })
    const payload = await adminRequest<unknown>(
      `/api/hr/self-service/approvals/profile-updates?${bare.toString()}`,
      { token }
    )
    const rows = normalizeList(payload)
    const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
    return { rows, ...pagination }
  }

  // Single status filter — try API first; on 400, load history and filter client-side.
  if (params.status && params.status.trim() && params.status.trim().toLowerCase() !== "all") {
    const requestedStatus = params.status.trim().toLowerCase()
    try {
      return await fetchPage(params.status.trim())
    } catch (errorObject) {
      const statusCode =
        typeof errorObject === "object" &&
        errorObject !== null &&
        "status" in errorObject
          ? Number((errorObject as { status?: number }).status)
          : null
      if (statusCode !== 400) {
        throw errorObject
      }
      const history = await fetchHistoryMerged()
      const rows = history.rows.filter((row) => {
        const rowStatus = String(row.status ?? "").trim().toLowerCase()
        return rowStatus === requestedStatus || rowStatus.includes(requestedStatus)
      })
      return {
        rows,
        total: rows.length,
        page: fallbackPage,
        limit: fallbackLimit,
        totalPages:
          fallbackLimit > 0 ? Math.max(1, Math.ceil(rows.length / fallbackLimit)) : 1,
      }
    }
  }

  // Default / "all": unfiltered + status variants, same query shape as attendance corrections.
  if (params.includeHistory !== false) {
    return fetchHistoryMerged()
  }

  return fetchPage(undefined)
}

export async function getHrProfileUpdateApprovalRequest(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/hr/self-service/approvals/profile-updates/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function approveHrProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/hr/self-service/approvals/profile-updates/${id}/approve`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function rejectHrProfileUpdateRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(`/api/hr/self-service/approvals/profile-updates/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function listHrAttendanceCorrectionApprovalRequests(
  token: string,
  params: SelfServiceRequestQueryParams & { employee_id?: number } = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = new URLSearchParams()

  query.set("page", String(fallbackPage))
  query.set("limit", String(fallbackLimit))

  if (params.employee_id !== undefined) {
    query.set("employee_id", String(params.employee_id))
  }
  if (params.status) {
    query.set("status", params.status)
  }
  if (params.date_from) {
    query.set("from_date", params.date_from)
  }
  if (params.date_to) {
    query.set("to_date", params.date_to)
  }

  const payload = await adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections?${query.toString()}`,
    { token }
  )
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getHrAttendanceCorrectionApprovalRequest(
  token: string,
  id: string | number
) {
  const payload = await adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections/${id}`,
    { token }
  )
  return normalizeSingle(payload)
}

export async function approveHrAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections/${id}/approve`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function rejectHrAttendanceCorrectionRequest(
  token: string,
  id: string | number,
  data: AdminRecord = {}
) {
  return adminRequest<unknown>(
    `/api/hr/self-service/approvals/attendance-corrections/${id}/reject`,
    {
      method: "POST",
      token,
      body: data,
    }
  )
}

export async function listMyTeamAttendance(
  token: string,
  params: TeamAttendanceQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildTeamAttendanceQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/team/attendance${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listCurrentCompanyUsers(
  token: string,
  params: UsersQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildUsersQuery(params)
  const payload = await adminRequest<unknown>(`/api/companies/current/users${query}`, {
    token,
    signal: options.signal,
    cacheTtlMs: options.cacheTtlMs,
    dedupe: options.dedupe,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

/** Page through company users (max 100 per page) for assignment UIs. */
export async function listAllCurrentCompanyUsers(
  token: string,
  options: { maxPages?: number; signal?: AbortSignal } = {}
): Promise<AdminRecord[]> {
  const maxPages = options.maxPages && options.maxPages > 0 ? options.maxPages : 15
  const collected: AdminRecord[] = []
  let page = 1
  while (page <= maxPages) {
    const result = await listCurrentCompanyUsers(
      token,
      { page, limit: 100, sortBy: "created_at", sortOrder: "ASC" },
      { signal: options.signal, dedupe: false }
    )
    collected.push(...result.rows)
    const reachedEnd =
      result.rows.length === 0 ||
      result.rows.length < 100 ||
      (typeof result.totalPages === "number" && page >= result.totalPages) ||
      (typeof result.total === "number" && collected.length >= result.total)
    if (reachedEnd) {
      break
    }
    page += 1
  }
  return collected
}

export async function createCurrentCompanyUser(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/companies/current/users", {
    method: "POST",
    token,
    body: data,
  })
}

export async function deleteCurrentCompanyUser(token: string, userId: string | number) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}`, {
    method: "DELETE",
    token,
  })
}

export async function assignRoleToCurrentCompanyUser(
  token: string,
  userId: string | number,
  roleId: string | number
) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}/roles`, {
    method: "POST",
    token,
    body: { role_id: Number(roleId) },
  })
}

export async function revokeRoleFromCurrentCompanyUser(
  token: string,
  userId: string | number,
  roleId: string | number
) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}/roles/${roleId}`, {
    method: "DELETE",
    token,
  })
}

export async function assignPermissionToCurrentCompanyUser(
  token: string,
  userId: string | number,
  permissionId: string | number
) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}/permissions`, {
    method: "POST",
    token,
    body: { permission_id: Number(permissionId) },
  })
}

export async function revokePermissionFromCurrentCompanyUser(
  token: string,
  userId: string | number,
  permissionId: string | number
) {
  return adminRequest<unknown>(`/api/companies/current/users/${userId}/permissions/${permissionId}`, {
    method: "DELETE",
    token,
  })
}

export async function listMyLeaveBalances(
  token: string,
  params: LeaveBalancesQueryParams = {}
): Promise<PaginatedUsersResult & { current_fiscal_year?: string; totals?: Record<string, number> }> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildLeaveBalancesQuery(params)
  const payload = await adminRequest<unknown>(`/api/me/leave/balances${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  const record = asRecord(payload) || {}
  return {
    rows,
    ...pagination,
    current_fiscal_year: (record.current_fiscal_year || record.currentFiscalYear || "2026") as string,
    totals: (record.totals || {}) as Record<string, number>,
  }
}

export async function getUserById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/users/${id}`, { token })
  return normalizeSingle(payload)
}

export async function updateUserById(id: string | number, token: string, data: AdminRecord) {
  return adminRequest<unknown>(`/api/users/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

/** PATCH /api/users/{id}/avatar — assign an active default avatar to a user. */
export async function assignUserAvatar(
  token: string,
  userId: string | number,
  avatarId: number
) {
  return adminRequest<unknown>(`/api/users/${userId}/avatar`, {
    method: "PATCH",
    token,
    body: { avatar_id: avatarId },
  })
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
] as const

const TWO_FACTOR_STATUS_KEYS = [
  "two_factor_status",
  "twoFactorStatus",
  "mfa_status",
  "mfaStatus",
  "two_factor_state",
  "twoFactorState",
] as const

const TWO_FACTOR_NEST_KEYS = [
  "user",
  "account",
  "company_user",
  "companyUser",
  "security",
  "auth",
  "profile",
  "settings",
] as const

function coerceTwoFactorFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized) {
      return null
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
      return true
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
      return false
    }
  }
  return null
}

function readTwoFactorFlagFromRecord(record: AdminRecord, depth: number): boolean | null {
  for (const key of TWO_FACTOR_FLAG_KEYS) {
    if (!(key in record)) {
      continue
    }
    const coerced = coerceTwoFactorFlag(record[key])
    if (coerced !== null) {
      return coerced
    }
  }

  for (const key of TWO_FACTOR_STATUS_KEYS) {
    if (!(key in record)) {
      continue
    }
    const coerced = coerceTwoFactorFlag(record[key])
    if (coerced !== null) {
      return coerced
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
    const value = record[key]
    if (typeof value === "string" && value.trim()) {
      return true
    }
    if (value === true) {
      return true
    }
  }

  if (depth >= 2) {
    return null
  }

  for (const nestKey of TWO_FACTOR_NEST_KEYS) {
    const nested = asRecord(record[nestKey])
    if (!nested) {
      continue
    }
    const nestedFlag = readTwoFactorFlagFromRecord(nested, depth + 1)
    if (nestedFlag !== null) {
      return nestedFlag
    }
  }

  return null
}

/**
 * Resolve whether 2FA is enabled for a user/employee-like record.
 * Handles camelCase/snake_case, status strings, and nested `user` / `security` objects.
 */
export function readTwoFactorEnabled(record: AdminRecord | null | undefined): boolean {
  if (!record) {
    return false
  }
  return readTwoFactorFlagFromRecord(record, 0) ?? false
}

/** Attach consistent top-level 2FA fields for tables and toggles. */
export function withNormalizedTwoFactorFields(record: AdminRecord): AdminRecord {
  const enabled = readTwoFactorEnabled(record)
  return {
    ...record,
    two_factor_enabled: enabled,
    is_two_factor_enabled: enabled,
    twoFactorEnabled: enabled,
  }
}

/**
 * Build a userId → 2FA-enabled map from GET /api/users (paginated).
 * Stops early once every needed id is resolved (or the catalog ends).
 */
export async function buildUserTwoFactorMap(
  token: string,
  neededUserIds: Iterable<string | number> = [],
  options: { signal?: AbortSignal; maxPages?: number; cacheTtlMs?: number } = {}
): Promise<Map<string, boolean>> {
  const needed = new Set(
    Array.from(neededUserIds)
      .map((id) => String(id).trim())
      .filter(Boolean)
  )
  const map = new Map<string, boolean>()
  const maxPages = options.maxPages && options.maxPages > 0 ? options.maxPages : 20
  let page = 1

  while (page <= maxPages) {
    const result = await listUsers(
      token,
      { page, limit: 100, sortBy: "created_at", sortOrder: "ASC" },
      {
        signal: options.signal,
        cacheTtlMs: options.cacheTtlMs,
        dedupe: true,
      }
    )

    for (const user of result.rows) {
      const id =
        user.id ??
        user.user_id ??
        user.userId ??
        user.company_user_id ??
        user.companyUserId
      if (id === null || id === undefined || id === "") {
        continue
      }
      map.set(String(id), readTwoFactorEnabled(user))
    }

    const allNeededFound =
      needed.size === 0 ? false : [...needed].every((id) => map.has(id))
    const reachedEnd =
      result.rows.length === 0 ||
      result.rows.length < 100 ||
      (typeof result.totalPages === "number" && page >= result.totalPages) ||
      (typeof result.total === "number" && map.size >= result.total)

    if (allNeededFound || reachedEnd) {
      break
    }
    page += 1
  }

  return map
}

/** PATCH /api/users/{userId}/two-factor/enable — admin enables 2FA (user completes setup on next login). */
export async function enableUserTwoFactor(token: string, userId: string | number) {
  return adminRequest<unknown>(`/api/users/${userId}/two-factor/enable`, {
    method: "PATCH",
    token,
  })
}

/** PATCH /api/users/{userId}/two-factor/disable — admin disables 2FA and revokes recovery data. */
export async function disableUserTwoFactor(
  token: string,
  userId: string | number,
  reason?: string
) {
  return adminRequest<unknown>(`/api/users/${userId}/two-factor/disable`, {
    method: "PATCH",
    token,
    body: reason?.trim() ? { reason: reason.trim() } : {},
  })
}

export async function deleteUserById(id: string | number, token: string) {
  return adminRequest<unknown>(`/api/users/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function updateCurrentUserProfile(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/users/me", {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function changeCurrentUserPassword(
  token: string,
  oldPassword: string,
  newPassword: string
) {
  return adminRequest<unknown>("/api/users/me/change-password", {
    method: "POST",
    token,
    body: {
      old_password: oldPassword,
      new_password: newPassword,
    },
  })
}

export async function assignRoleToUser(token: string, userId: string | number, roleId: string | number) {
  return adminRequest<unknown>(`/api/users/${userId}/roles/${roleId}`, {
    method: "POST",
    token,
  })
}

export async function revokeRoleFromUser(token: string, userId: string | number, roleId: string | number) {
  return adminRequest<unknown>(`/api/users/${userId}/roles/${roleId}`, {
    method: "DELETE",
    token,
  })
}

export async function patchResource(
  resource: Exclude<AdminResourceKey, "companies">,
  id: string | number,
  token: string,
  data: AdminRecord
) {
  return adminRequest<unknown>(`${RESOURCE_PATHS[resource]}/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteResource(
  resource: Exclude<AdminResourceKey, "companies">,
  id: string | number,
  token: string
) {
  return adminRequest<unknown>(`${RESOURCE_PATHS[resource]}/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function getRoleById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/roles/${id}`, { token })
  return normalizeSingle(payload)
}

export async function updateRoleById(
  id: string | number,
  token: string,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/roles/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteRoleById(id: string | number, token: string) {
  return adminRequest<unknown>(`/api/roles/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listRolePermissions(
  token: string,
  roleId: string | number
): Promise<AdminRecord[]> {
  const payload = await adminRequest<unknown>(`/api/roles/${roleId}/permissions`, {
    token,
  })
  return normalizeList(payload)
}

export async function assignPermissionToRole(
  token: string,
  roleId: string | number,
  permissionId: string | number
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/permissions`, {
    method: "POST",
    token,
    body: { permission_id: Number(permissionId) },
  })
}

export async function revokePermissionFromRole(
  token: string,
  roleId: string | number,
  permissionId: string | number
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/permissions/${permissionId}`, {
    method: "DELETE",
    token,
  })
}

export async function listRoleUsers(
  token: string,
  roleId: string | number,
  params: UsersQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 100
  const query = buildUsersQuery({
    page: fallbackPage,
    limit: fallbackLimit,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    search: params.search,
  })
  const payload = await adminRequest<unknown>(`/api/roles/${roleId}/users${query}`, {
    token,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function assignUserToRole(
  token: string,
  roleId: string | number,
  userId: string | number
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/users`, {
    method: "POST",
    token,
    body: { user_id: Number(userId) },
  })
}

export async function revokeUserFromRole(
  token: string,
  roleId: string | number,
  userId: string | number
) {
  return adminRequest<unknown>(`/api/roles/${roleId}/users/${userId}`, {
    method: "DELETE",
    token,
  })
}

export async function createPermission(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/permissions", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getPermissionById(id: string | number, token: string) {
  const payload = await adminRequest<unknown>(`/api/permissions/${id}`, { token })
  return normalizeSingle(payload)
}

export async function updatePermissionById(
  id: string | number,
  token: string,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/permissions/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function patchEmployeeSectionItem(
  token: string,
  employeeId: string | number,
  section: EmployeeProfileSection,
  itemId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/${section}/${itemId}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function createEmployeeSectionItem(
  token: string,
  employeeId: string | number,
  section: EmployeeProfileSection,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/${section}`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function deleteEmployeeSectionItem(
  token: string,
  employeeId: string | number,
  section: EmployeeProfileSection,
  itemId: string | number
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/${section}/${itemId}`, {
    method: "DELETE",
    token,
  })
}

export async function patchEmployeeStatus(
  token: string,
  employeeId: string | number,
  data: EmployeeStatusPayload
) {
  const normalizedStatus = String(data.employment_status ?? "").trim().toLowerCase()
  if (!isEmployeeStatusValue(normalizedStatus)) {
    throw new Error("Invalid employee status.")
  }

  const trimmedNotes = typeof data.notes === "string" ? data.notes.trim() : ""
  const normalizedPayload: EmployeeStatusPayload = {
    employment_status: normalizedStatus,
    notes: trimmedNotes || undefined,
  }

  if (normalizedStatus === "exited") {
    const trimmedExitDate = typeof data.exit_date === "string" ? data.exit_date.trim() : ""
    const trimmedExitReason = typeof data.exit_reason === "string" ? data.exit_reason.trim() : ""
    normalizedPayload.exit_date = trimmedExitDate || undefined
    normalizedPayload.exit_reason = trimmedExitReason || undefined
  }

  return adminRequest<unknown>(`/api/employees/${employeeId}/status`, {
    method: "PATCH",
    token,
    body: normalizedPayload,
  })
}

export async function createEmployeeDocument(
  token: string,
  employeeId: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/documents`, {
    method: "POST",
    token,
    body: data,
  })
}

export async function deleteEmployeeDocument(
  token: string,
  employeeId: string | number,
  documentId: string | number
) {
  return adminRequest<unknown>(`/api/employees/${employeeId}/documents/${documentId}`, {
    method: "DELETE",
    token,
  })
}

// ---------------------------------------------------------------------------
// Scheduled Reporting
// ---------------------------------------------------------------------------

export type ScheduledReportSortOrder = SortOrder

export interface ScheduledReportingListParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: ScheduledReportSortOrder
  search?: string
  templateId?: number
  scheduleId?: number
  reportDefinitionId?: number
  smtpConfigurationId?: number
  status?: string
  emailDeliveryStatus?: string
  source?: string
  scheduleType?: string
  isActive?: boolean
  isDefault?: boolean
}

function buildScheduledReportingQuery(params: ScheduledReportingListParams = {}) {
  const searchParams = new URLSearchParams()
  if (typeof params.page === "number" && params.page > 0) {
    searchParams.set("page", String(params.page))
  }
  if (typeof params.limit === "number" && params.limit > 0) {
    searchParams.set("limit", String(params.limit))
  }
  if (params.sortBy?.trim()) {
    searchParams.set("sortBy", params.sortBy.trim())
  }
  if (params.sortOrder === "ASC" || params.sortOrder === "DESC") {
    searchParams.set("sortOrder", params.sortOrder)
  }
  if (params.search?.trim()) {
    searchParams.set("search", params.search.trim())
  }
  if (typeof params.templateId === "number") {
    searchParams.set("templateId", String(params.templateId))
  }
  if (typeof params.scheduleId === "number") {
    searchParams.set("scheduleId", String(params.scheduleId))
  }
  if (typeof params.reportDefinitionId === "number") {
    searchParams.set("reportDefinitionId", String(params.reportDefinitionId))
  }
  if (typeof params.smtpConfigurationId === "number") {
    searchParams.set("smtpConfigurationId", String(params.smtpConfigurationId))
  }
  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim())
  }
  if (params.emailDeliveryStatus?.trim()) {
    searchParams.set("emailDeliveryStatus", params.emailDeliveryStatus.trim())
  }
  if (params.source?.trim()) {
    searchParams.set("source", params.source.trim())
  }
  if (params.scheduleType?.trim()) {
    searchParams.set("scheduleType", params.scheduleType.trim())
  }
  if (typeof params.isActive === "boolean") {
    searchParams.set("isActive", String(params.isActive))
  }
  if (typeof params.isDefault === "boolean") {
    searchParams.set("isDefault", String(params.isDefault))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

async function listScheduledReportingCollection(
  path: string,
  token: string,
  params: ScheduledReportingListParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const payload = await adminRequest<unknown>(`${path}${buildScheduledReportingQuery(params)}`, {
    token,
  })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listScheduledReportDefinitions(token: string) {
  const payload = await adminRequest<unknown>("/api/scheduled-reporting/report-definitions", {
    token,
  })
  return normalizeList(payload)
}

export async function listScheduledReportTemplates(
  token: string,
  params: ScheduledReportingListParams = {}
) {
  return listScheduledReportingCollection("/api/scheduled-reporting/templates", token, params)
}

export async function getScheduledReportTemplate(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/scheduled-reporting/templates/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function createScheduledReportTemplate(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/scheduled-reporting/templates", {
    method: "POST",
    token,
    body: data,
  })
}

export async function updateScheduledReportTemplate(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/templates/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteScheduledReportTemplate(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/scheduled-reporting/templates/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listScheduledReportSchedules(
  token: string,
  params: ScheduledReportingListParams = {}
) {
  return listScheduledReportingCollection("/api/scheduled-reporting/schedules", token, params)
}

export async function getScheduledReportSchedule(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/scheduled-reporting/schedules/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function createScheduledReportSchedule(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/scheduled-reporting/schedules", {
    method: "POST",
    token,
    body: data,
  })
}

export async function updateScheduledReportSchedule(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/schedules/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteScheduledReportSchedule(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/scheduled-reporting/schedules/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function listScheduledReportExecutions(
  token: string,
  params: ScheduledReportingListParams = {}
) {
  return listScheduledReportingCollection("/api/scheduled-reporting/executions", token, params)
}

export async function getScheduledReportExecution(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/scheduled-reporting/executions/${id}`, {
    token,
  })
  return normalizeSingle(payload)
}

export async function listScheduledReportSmtpConfigurations(
  token: string,
  params: ScheduledReportingListParams = {}
) {
  return listScheduledReportingCollection(
    "/api/scheduled-reporting/smtp-configurations",
    token,
    params
  )
}

export async function getScheduledReportSmtpConfiguration(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(
    `/api/scheduled-reporting/smtp-configurations/${id}`,
    { token }
  )
  return normalizeSingle(payload)
}

export async function createScheduledReportSmtpConfiguration(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/scheduled-reporting/smtp-configurations", {
    method: "POST",
    token,
    body: data,
  })
}

export async function updateScheduledReportSmtpConfiguration(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/smtp-configurations/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteScheduledReportSmtpConfiguration(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/scheduled-reporting/smtp-configurations/${id}`, {
    method: "DELETE",
    token,
  })
}

export async function testScheduledReportSmtpConfiguration(
  token: string,
  id: string | number,
  data: { toEmail?: string; sendTestEmail?: boolean } = {}
) {
  return adminRequest<unknown>(`/api/scheduled-reporting/smtp-configurations/${id}/test`, {
    method: "POST",
    token,
    body: data,
  })
}

/** Test SMTP using form values before the configuration is saved. */
export async function testScheduledReportSmtpConfigurationDraft(
  token: string,
  data: AdminRecord & { toEmail?: string; sendTestEmail?: boolean }
) {
  return adminRequest<unknown>("/api/scheduled-reporting/smtp-configurations/test", {
    method: "POST",
    token,
    body: data,
  })
}

// ── Default Avatars ──────────────────────────────────────────────────────────

export type DefaultAvatarGender = "male" | "female" | "neutral"
export type DefaultAvatarStatus = "active" | "inactive"

export interface Base64FileDto {
  fileName: string
  fileSize: number
  mimeType: string
  fileString: string
}

export interface CreateDefaultAvatarPayload {
  avatar_name: string
  gender_category: DefaultAvatarGender
  image_file: Base64FileDto
  display_order?: number
  is_default?: boolean
  status?: DefaultAvatarStatus
}

export interface UpdateDefaultAvatarPayload {
  avatar_name?: string
  gender_category?: DefaultAvatarGender
  image_file?: Base64FileDto
  display_order?: number
  is_default?: boolean
  status?: DefaultAvatarStatus
}

export interface DefaultAvatarsQueryParams {
  gender_category?: DefaultAvatarGender
  status?: DefaultAvatarStatus
  include_inactive?: boolean
}

/** Resolve a displayable image URL from a default-avatar record. */
export function extractDefaultAvatarImageUrl(row: AdminRecord | null | undefined): string | null {
  if (!row) return null

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
  ] as const

  const resolvePathValue = (value: unknown): string | null => {
    if (typeof value !== "string" || !value.trim()) return null
    return resolveBackendMediaUrl(value.trim())
  }

  for (const key of pathKeys) {
    const resolved = resolvePathValue(row[key])
    if (resolved) return resolved
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
    ""
  const companyId =
    row.company_id ??
    row.companyId ??
    asRecord(row.company)?.id ??
    null
  if (fileName) {
    if (companyId != null && String(companyId).trim()) {
      const built = resolveBackendMediaUrl(
        `/uploads/default-avatars/company-${String(companyId).trim()}/${fileName.replace(/^\/+/, "")}`
      )
      if (built) return built
    }
    // Fallback when company is known only via path fragments.
    if (fileName.includes("default-avatars/") || fileName.includes("uploads/")) {
      const built = resolveBackendMediaUrl(fileName)
      if (built) return built
    }
  }

  const direct = extractProfilePhotoUrl(row)
  if (direct) return direct

  const nestedCandidates = [
    asRecord(row.image_file),
    asRecord(row.imageFile),
    asRecord(row.file),
    asRecord(row.media),
    asRecord(row.image),
  ]
  for (const nestedFile of nestedCandidates) {
    if (!nestedFile) continue
    for (const key of pathKeys) {
      const resolved = resolvePathValue(nestedFile[key])
      if (resolved) return resolved
    }
    const fromNested = extractProfilePhotoUrl(nestedFile)
    if (fromNested) return fromNested
    const nestedName =
      (typeof nestedFile.fileName === "string" && nestedFile.fileName.trim()) ||
      (typeof nestedFile.file_name === "string" && nestedFile.file_name.trim()) ||
      (typeof nestedFile.filename === "string" && nestedFile.filename.trim()) ||
      ""
    if (nestedName && companyId != null && String(companyId).trim()) {
      const built = resolveBackendMediaUrl(
        `/uploads/default-avatars/company-${String(companyId).trim()}/${nestedName.replace(/^\/+/, "")}`
      )
      if (built) return built
    }
    const fileString =
      typeof nestedFile.fileString === "string"
        ? nestedFile.fileString
        : typeof nestedFile.file_string === "string"
          ? nestedFile.file_string
          : typeof nestedFile.base64 === "string"
            ? nestedFile.base64
            : ""
    const mime =
      typeof nestedFile.mimeType === "string"
        ? nestedFile.mimeType
        : typeof nestedFile.mime_type === "string"
          ? nestedFile.mime_type
          : "image/png"
    if (fileString.trim()) {
      const compact = fileString.trim()
      // Relative/path strings accidentally stored in fileString
      if (
        compact.startsWith("/") ||
        compact.startsWith("uploads/") ||
        compact.startsWith("default-avatars/") ||
        /^https?:\/\//i.test(compact)
      ) {
        return resolveBackendMediaUrl(compact)
      }
      if (compact.startsWith("data:image")) return compact
      return `data:${mime};base64,${compact.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")}`
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
            : ""
  if (raw.trim()) {
    const compact = raw.trim()
    if (
      compact.startsWith("/") ||
      compact.startsWith("uploads/") ||
      compact.startsWith("default-avatars/") ||
      /^https?:\/\//i.test(compact)
    ) {
      return resolveBackendMediaUrl(compact)
    }
    if (compact.startsWith("data:image")) return compact
    return `data:image/png;base64,${compact}`
  }

  return null
}

/**
 * GET /api/default-avatars
 * Query: gender_category?, status?, include_inactive?
 */
export async function listDefaultAvatars(
  token: string,
  params: DefaultAvatarsQueryParams = {}
): Promise<AdminRecord[]> {
  const searchParams = new URLSearchParams()
  if (params.gender_category) searchParams.set("gender_category", params.gender_category)
  if (params.status) searchParams.set("status", params.status)
  // Only send when explicitly requested (API: Include inactive avatars in the response.)
  if (params.include_inactive === true) searchParams.set("include_inactive", "true")
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ""
  const payload = await adminRequest<unknown>(`/api/default-avatars${query}`, {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  })
  return normalizeList(payload)
}

/** GET /api/default-avatars/{id} */
export async function getDefaultAvatar(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/default-avatars/${id}`, {
    token,
    cacheTtlMs: 0,
    dedupe: false,
  })
  return normalizeSingle(payload) ?? asRecord(payload)
}

/**
 * POST /api/default-avatars → 201
 * Body: CreateDefaultAvatarDto
 *   avatar_name, gender_category, image_file (Base64FileDto),
 *   display_order?, is_default?, status?
 */
export async function createDefaultAvatar(
  token: string,
  data: CreateDefaultAvatarPayload
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
        typeof data.display_order === "number" && Number.isFinite(data.display_order)
          ? Math.max(0, data.display_order)
          : 0,
      is_default: data.is_default === true,
      status: data.status === "inactive" ? "inactive" : "active",
    },
  })
  return normalizeSingle(payload) ?? asRecord(payload)
}

/**
 * PATCH /api/default-avatars/{id} → 200
 * Body: UpdateDefaultAvatarDto (partial create fields)
 */
export async function updateDefaultAvatar(
  token: string,
  id: string | number,
  data: UpdateDefaultAvatarPayload
): Promise<AdminRecord | null> {
  const body: AdminRecord = {}
  if (typeof data.avatar_name === "string") body.avatar_name = data.avatar_name
  if (data.gender_category) body.gender_category = data.gender_category
  if (typeof data.display_order === "number" && Number.isFinite(data.display_order)) {
    body.display_order = Math.max(0, data.display_order)
  }
  if (typeof data.is_default === "boolean") body.is_default = data.is_default
  if (data.status === "active" || data.status === "inactive") body.status = data.status
  if (data.image_file) {
    body.image_file = {
      fileName: data.image_file.fileName,
      fileSize: Math.max(1, Number(data.image_file.fileSize) || 1),
      mimeType: data.image_file.mimeType,
      fileString: data.image_file.fileString,
    }
  }

  const payload = await adminRequest<unknown>(`/api/default-avatars/${id}`, {
    method: "PATCH",
    token,
    body,
  })
  return normalizeSingle(payload) ?? asRecord(payload)
}

/**
 * POST /api/default-avatars/{id}/set-default → 201
 * Marks this avatar as the company default for its gender category.
 */
export async function setDefaultAvatarAsDefault(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/default-avatars/${id}/set-default`, {
    method: "POST",
    token,
  })
}

/** DELETE /api/default-avatars/{id} → 200 */
export async function deleteDefaultAvatar(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/default-avatars/${id}`, {
    method: "DELETE",
    token,
  })
}

const SAFE_AVATAR_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
])

function sanitizeAvatarFileName(name: string, mimeType: string): string {
  const base = (name || "avatar")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
  const ext =
    mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : mimeType.includes("gif")
          ? "gif"
          : "jpg"
  if (/\.(png|jpe?g|webp|gif)$/i.test(base)) {
    return base
  }
  return `${base || "avatar"}.${ext}`
}

function estimateBase64ByteLength(base64: string): number {
  const compact = base64.replace(/\s+/g, "")
  const padding = compact.endsWith("==") ? 2 : compact.endsWith("=") ? 1 : 0
  return Math.max(1, Math.floor((compact.length * 3) / 4) - padding)
}

/**
 * Normalize any picked image into a backend-safe raster (PNG/JPEG).
 * SVG / exotic types often crash image processors (500). Large files can too.
 */
export async function normalizeAvatarImageFile(
  file: File,
  options: { maxEdge?: number; maxBytes?: number } = {}
): Promise<File> {
  const maxEdge = options.maxEdge ?? 1024
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024
  const rawType = (file.type || "").toLowerCase().trim()
  const nameLower = file.name.toLowerCase()
  const looksSvg =
    rawType.includes("svg") || nameLower.endsWith(".svg") || rawType === "image/svg+xml"
  const looksHeic =
    rawType.includes("heic") ||
    rawType.includes("heif") ||
    nameLower.endsWith(".heic") ||
    nameLower.endsWith(".heif")

  if (looksHeic) {
    throw new Error("HEIC/HEIF images are not supported. Please use PNG or JPG.")
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
      return file
    }
  }

  if (typeof document === "undefined" || typeof Image === "undefined") {
    // SSR / non-browser — return original; caller still base64-encodes it.
    return file
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Could not read this image. Try PNG or JPG."))
      img.src = objectUrl
    })

    const srcW = Math.max(1, image.naturalWidth || image.width || 1)
    const srcH = Math.max(1, image.naturalHeight || image.height || 1)
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
    const width = Math.max(1, Math.round(srcW * scale))
    const height = Math.max(1, Math.round(srcH * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not process image.")
    }
    // White background so transparent SVG/PNG don't become black on JPEG.
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const preferPng = looksSvg || rawType.includes("png") || rawType.includes("gif")
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error("Could not encode image."))
        },
        preferPng ? "image/png" : "image/jpeg",
        0.9
      )
    })

    const outMime = blob.type || (preferPng ? "image/png" : "image/jpeg")
    const outName = sanitizeAvatarFileName(
      file.name.replace(/\.[^.]+$/, "") || "avatar",
      outMime
    )
    return new File([blob], outName, { type: outMime })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Build Base64FileDto for CreateDefaultAvatarDto.image_file.
 * fileString is pure base64 (no data: prefix). fileSize matches decoded bytes.
 * Images are normalized to PNG/JPEG so the backend image processor is less likely to 500.
 */
export async function fileToBase64FileDto(file: File): Promise<Base64FileDto> {
  const normalized = await normalizeAvatarImageFile(file)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Could not read file."))
    }
    reader.onerror = () => reject(new Error("Could not read file."))
    reader.readAsDataURL(normalized)
  })
  const comma = dataUrl.indexOf(",")
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ""
  // Strip whitespace/newlines some browsers insert into large data URLs.
  const fileString = (comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl).replace(/\s+/g, "")
  if (!fileString) {
    throw new Error("Image encoding produced an empty file.")
  }
  const mimeFromHeader = header.match(/^data:([^;]+);/i)?.[1]?.trim().toLowerCase() || ""
  let mimeType = (normalized.type || mimeFromHeader || "image/png").trim().toLowerCase()
  if (mimeType === "image/jpg") mimeType = "image/jpeg"
  if (!SAFE_AVATAR_MIME.has(mimeType)) {
    // Force a known-safe type after normalization.
    mimeType = "image/png"
  }
  const fileName = sanitizeAvatarFileName(normalized.name || file.name || "avatar", mimeType)
  const fileSize = estimateBase64ByteLength(fileString)

  return {
    fileName,
    fileSize,
    mimeType,
    fileString,
  }
}

/**
 * Load a remote/default-avatar image URL into a File for upload fallback
 * (POST /api/me/profile/photo) when PATCH avatar returns 500.
 */
export async function fetchImageUrlAsAvatarFile(
  imageUrl: string,
  fileName = "avatar.png"
): Promise<File> {
  const resolved = resolveBackendMediaUrl(imageUrl) || imageUrl
  const response = await fetch(resolved, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Could not load avatar image for upload fallback.")
  }
  const blob = await response.blob()
  const mime = blob.type || "image/png"
  const safeName = sanitizeAvatarFileName(fileName, mime)
  const raw = new File([blob], safeName, { type: mime || "image/png" })
  return normalizeAvatarImageFile(raw)
}

/** Extract numeric/string id from a default-avatar API record. */
export function readDefaultAvatarId(row: AdminRecord | null | undefined): string | number | null {
  if (!row) return null
  const value = row.id ?? row.avatar_id ?? row.default_avatar_id ?? row.defaultAvatarId
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value)
  if (typeof value === "string" && value.trim()) {
    const asNum = Number(value.trim())
    return Number.isFinite(asNum) ? Math.trunc(asNum) : null
  }
  return null
}

/** True when a list row is usable for employee self-select (active + numeric id + image). */
export function isSelectableDefaultAvatar(row: AdminRecord | null | undefined): boolean {
  if (!row) return false
  const id = readDefaultAvatarId(row)
  if (id == null) return false
  const status = String(row.status ?? "active").trim().toLowerCase()
  if (status && status !== "active") return false
  return Boolean(extractDefaultAvatarImageUrl(row))
}
