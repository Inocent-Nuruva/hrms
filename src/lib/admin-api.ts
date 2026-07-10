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
  employment_status?: "onboarding" | "active" | "suspended" | "terminated" | "exited"
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

export interface DesignationsQueryParams extends UsersQueryParams {
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
  status?: string
  attendance_status?: string
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

export interface TeamAttendanceQueryParams extends UsersQueryParams {
  date_from?: string
  date_to?: string
}

export interface EmployeePositionsQueryParams extends UsersQueryParams {
  employee_id?: number
  position_id?: number
  designation_id?: number
  status?: string
  assignment_type?: string
}

export interface EmployeeDesignationsQueryParams extends UsersQueryParams {
  employee_id?: number
  designation_id?: number
  is_current?: boolean
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
  primary_designation_id?: number
  position_id?: number
  employment_status?: EmployeeStatusValue
  employment_type?: "full_time" | "part_time" | "contract" | "intern" | "consultant" | "temporary"
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
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://192.168.1.30:8888").replace(/\/$/, "")
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${getBaseUrl()}${path}`
}

function asRecord(value: unknown): AdminRecord | null {
  return typeof value === "object" && value !== null ? (value as AdminRecord) : null
}

function asArray(value: unknown): AdminRecord[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  return value.filter((entry) => typeof entry === "object" && entry !== null) as AdminRecord[]
}

function getRecordArrays(record: AdminRecord | null) {
  if (!record) {
    return []
  }

  return Object.values(record)
    .map((value) => asArray(value))
    .filter((value): value is AdminRecord[] => value !== null)
}

function getNestedRecords(record: AdminRecord | null) {
  if (!record) {
    return []
  }

  return Object.values(record)
    .map((value) => asRecord(value))
    .filter((value): value is AdminRecord => value !== null)
}

function extractListFromRecord(record: AdminRecord | null): AdminRecord[] | null {
  if (!record) {
    return null
  }

  const directListCandidates = [
    record.data,
    record.items,
    record.results,
    record.records,
    record.users,
    record.rows,
    record.list,
  ]

  for (const candidate of directListCandidates) {
    const list = asArray(candidate)
    if (list) {
      return list
    }
  }

  for (const list of getRecordArrays(record)) {
    return list
  }

  const nestedCandidates = [
    asRecord(record.data),
    asRecord(record.result),
    asRecord(record.pagination),
    asRecord(record.meta),
    ...getNestedRecords(record),
  ]

  for (const nested of nestedCandidates) {
    if (!nested) {
      continue
    }
    const nestedList = extractListFromRecord(nested)
    if (nestedList) {
      return nestedList
    }
  }

  return null
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

function normalizeList(payload: unknown): AdminRecord[] {
  const direct = asArray(payload)
  if (direct) {
    return direct
  }

  const record = asRecord(payload)
  if (!record) {
    return []
  }

  return extractListFromRecord(record) ?? []
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

function buildDesignationsQuery(params: DesignationsQueryParams) {
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
  if (typeof params.designation_id === "number" && params.designation_id > 0) {
    searchParams.set("designation_id", String(params.designation_id))
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

function buildEmployeeDesignationsQuery(params: EmployeeDesignationsQueryParams) {
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
  if (typeof params.designation_id === "number" && params.designation_id > 0) {
    searchParams.set("designation_id", String(params.designation_id))
  }
  if (typeof params.is_current === "boolean") {
    searchParams.set("is_current", String(params.is_current))
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
    readNumberFromRecord(root, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootResult, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootMeta, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootDataMeta, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootResultMeta, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootPagination, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootDataPagination, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootResultPagination, ["limit", "perPage", "pageSize", "per_page"]) ??
    readNumberFromRecord(rootData, ["limit", "perPage", "pageSize", "per_page"]) ??
    fallbackLimit

  const total =
    readNumberFromRecord(root, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootResult, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootMeta, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootDataMeta, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootResultMeta, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootPagination, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootDataPagination, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootResultPagination, ["total", "totalItems", "count"]) ??
    readNumberFromRecord(rootData, ["total", "totalItems", "count"])

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

function extractMessage(payload: unknown, status: number) {
  const record = asRecord(payload)
  if (!record) {
    return `Request failed with status ${status}`
  }
  const candidate = record.message
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate
  }
  if (Array.isArray(candidate)) {
    const normalized = candidate
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim())
    if (normalized.length > 0) {
      return normalized.join(". ")
    }
  }
  const errorCandidate = record.error
  if (typeof errorCandidate === "string" && errorCandidate.trim()) {
    return errorCandidate.trim()
  }
  const detailCandidate = record.details
  if (typeof detailCandidate === "string" && detailCandidate.trim()) {
    return detailCandidate.trim()
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

export async function listResource(resource: AdminResourceKey, token: string) {
  const payload = await adminRequest<unknown>(RESOURCE_PATHS[resource], { token })
  return normalizeList(payload)
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
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
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

export async function listDesignations(
  token: string,
  params: DesignationsQueryParams = {},
  options: ListRequestOptions = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildDesignationsQuery(params)
  const payload = await adminRequest<unknown>(`/api/designations${query}`, {
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

async function listAttendanceCollectionPage(
  path: string,
  token: string,
  params: AttendanceQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildUsersQuery(params)
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
  const requestedLimit = params.limit && params.limit > 0 ? params.limit : 100
  const pageSize = Math.min(requestedLimit, 100)
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

export async function listAttendanceSettings(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/config/policies", token, params)
}

export async function listAttendancePolicies(token: string, params: AttendanceQueryParams = {}) {
  return listAllAttendanceCollection("/api/attendance/config/policies", token, params)
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

export async function rebuildAttendanceDailySummaries(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/daily-summaries/rebuild", {
    method: "POST",
    token,
    body: data,
  })
}

export async function processAttendanceRange(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/attendance/processing/run-range", {
    method: "POST",
    token,
    body: data,
  })
}

export async function listAttendanceUnmatchedLogs(
  token: string,
  params: AttendanceQueryParams = {}
) {
  return listAllAttendanceCollection("/api/attendance/processing/unmatched-logs", token, params)
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
  return normalizeSingle(payload)
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

export async function listEmployeeDesignations(
  token: string,
  params: EmployeeDesignationsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildEmployeeDesignationsQuery(params)
  const payload = await adminRequest<unknown>(`/api/employee-designations${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function getEmployeeDesignation(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/employee-designations/${id}`, { token })
  return normalizeSingle(payload)
}

export async function createEmployeeDesignation(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/employee-designations", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchEmployeeDesignation(token: string, id: string | number, data: AdminRecord) {
  return adminRequest<unknown>(`/api/employee-designations/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteEmployeeDesignation(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/employee-designations/${id}`, {
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

export async function createDesignation(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/designations", {
    method: "POST",
    token,
    body: data,
  })
}

export async function patchDesignation(
  token: string,
  id: string | number,
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/designations/${id}`, {
    method: "PATCH",
    token,
    body: data,
  })
}

export async function deleteDesignation(token: string, id: string | number) {
  return adminRequest<unknown>(`/api/designations/${id}`, {
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
  return normalizeSingle(payload)
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
  return normalizeSingle(payload)
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

export async function createOnboardingWorkflow(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/onboarding/workflows", {
    method: "POST",
    token,
    body: data,
  })
}

export async function getOnboardingWorkflow(token: string, id: string | number) {
  const payload = await adminRequest<unknown>(`/api/onboarding/workflows/${id}`, { token })
  return normalizeSingle(payload)
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
  data: AdminRecord
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
  data: AdminRecord
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

export async function getMyAttendanceToday(token: string) {
  const payload = await adminRequest<unknown>("/api/me/attendance/today", { token })
  return normalizeSingle(payload)
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

export async function listHrProfileUpdateApprovalRequests(
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
    `/api/hr/self-service/approvals/profile-updates?${query.toString()}`,
    { token }
  )
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
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
  data: AdminRecord
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
  data: AdminRecord
) {
  return adminRequest<unknown>(`/api/hr/self-service/approvals/profile-updates/${id}/reject`, {
    method: "POST",
    token,
    body: data,
  })
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
  params: UsersQueryParams = {}
): Promise<PaginatedUsersResult> {
  return listGenericCollection("/api/companies/current/users", token, params)
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
