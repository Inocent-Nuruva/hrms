export type AdminResourceKey = "users" | "roles" | "permissions" | "companies"

export type AdminRecord = Record<string, unknown>
export type SortOrder = "ASC" | "DESC"

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

interface AdminRequestOptions {
  method?: HttpMethod
  token?: string
  body?: unknown
}

export interface AdminStats {
  users: number
  roles: number
  permissions: number
  companies: number
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

export interface OnboardingWorkflowsQueryParams extends UsersQueryParams {
  status?: string
}

export interface OnboardingRequestsQueryParams extends UsersQueryParams {
  employee_id?: number
  status?: string
}

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
  employment_status: "onboarding" | "active" | "suspended" | "terminated" | "exited"
  exit_date?: string
  exit_reason?: string
  notes?: string
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

  const nestedCandidates = [
    asRecord(record.data),
    asRecord(record.result),
    asRecord(record.pagination),
    asRecord(record.meta),
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
    readNumberFromRecord(root, ["page", "currentPage"]) ??
    readNumberFromRecord(rootResult, ["page", "currentPage"]) ??
    readNumberFromRecord(rootMeta, ["page", "currentPage"]) ??
    readNumberFromRecord(rootDataMeta, ["page", "currentPage"]) ??
    readNumberFromRecord(rootResultMeta, ["page", "currentPage"]) ??
    readNumberFromRecord(rootPagination, ["page", "currentPage"]) ??
    readNumberFromRecord(rootDataPagination, ["page", "currentPage"]) ??
    readNumberFromRecord(rootResultPagination, ["page", "currentPage"]) ??
    readNumberFromRecord(rootData, ["page", "currentPage"]) ??
    fallbackPage

  const limit =
    readNumberFromRecord(root, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootResult, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootMeta, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootDataMeta, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootResultMeta, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootPagination, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootDataPagination, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootResultPagination, ["limit", "perPage", "pageSize"]) ??
    readNumberFromRecord(rootData, ["limit", "perPage", "pageSize"]) ??
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
    readNumberFromRecord(root, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootResult, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootMeta, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootDataMeta, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootResultMeta, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootPagination, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootDataPagination, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootResultPagination, ["totalPages", "pageCount"]) ??
    readNumberFromRecord(rootData, ["totalPages", "pageCount"])

  return {
    page: Math.max(1, Math.floor(page)),
    limit: Math.max(1, Math.floor(limit)),
    total: total !== null ? Math.max(0, Math.floor(total)) : null,
    totalPages: totalPages !== null ? Math.max(1, Math.floor(totalPages)) : null,
  }
}

function normalizeSingle(payload: unknown): AdminRecord | null {
  const record = asRecord(payload)
  if (!record) {
    return null
  }

  const nested = [record.data, record.result, record.item, record.user, record.company]
  for (const candidate of nested) {
    const value = asRecord(candidate)
    if (value) {
      return value
    }
  }

  if ("id" in record || "email" in record || "name" in record || "company_name" in record) {
    return record
  }

  const list = normalizeList(payload)
  return list[0] ?? null
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
  return `Request failed with status ${status}`
}

async function adminRequest<T>(path: string, options: AdminRequestOptions = {}): Promise<T> {
  const { method = "GET", token, body } = options

  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
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
    }
    error.status = response.status
    throw error
  }

  return payload as T
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
  params: UsersQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildUsersQuery(params)
  const payload = await adminRequest<unknown>(`/api/users${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listEmployees(
  token: string,
  params: EmployeesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildEmployeesQuery(params)
  const payload = await adminRequest<unknown>(`/api/employees${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listDepartments(
  token: string,
  params: DepartmentsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildDepartmentsQuery(params)
  const payload = await adminRequest<unknown>(`/api/departments${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listBranches(
  token: string,
  params: BranchesQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildBranchesQuery(params)
  const payload = await adminRequest<unknown>(`/api/branches${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listPositions(
  token: string,
  params: PositionsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildPositionsQuery(params)
  const payload = await adminRequest<unknown>(`/api/positions${query}`, { token })
  const rows = normalizeList(payload)
  const pagination = extractUsersPagination(payload, fallbackPage, fallbackLimit)
  return { rows, ...pagination }
}

export async function listDesignations(
  token: string,
  params: DesignationsQueryParams = {}
): Promise<PaginatedUsersResult> {
  const fallbackPage = params.page && params.page > 0 ? params.page : 1
  const fallbackLimit = params.limit && params.limit > 0 ? params.limit : 20
  const query = buildDesignationsQuery(params)
  const payload = await adminRequest<unknown>(`/api/designations${query}`, { token })
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

export async function createOnboardingRequest(token: string, data: AdminRecord) {
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
  return adminRequest<unknown>(`/api/onboarding/requests/${id}/submit`, {
    method: "POST",
    token,
  })
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
  return adminRequest<unknown>(`/api/onboarding/requests/${id}`, {
    method: "DELETE",
    token,
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

export async function getCurrentAdmin(token: string) {
  const payload = await adminRequest<unknown>("/api/users/me", { token })
  return normalizeSingle(payload)
}

export async function getMyCompany(token: string) {
  const payload = await adminRequest<unknown>("/api/companies/my", { token })
  return normalizeSingle(payload)
}

export async function createResource(resource: AdminResourceKey, token: string, data: AdminRecord) {
  return adminRequest<unknown>(RESOURCE_PATHS[resource], {
    method: "POST",
    token,
    body: data,
  })
}

export async function createEmployeeProfile(token: string, data: AdminRecord) {
  return adminRequest<unknown>("/api/employees", {
    method: "POST",
    token,
    body: data,
  })
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
  return adminRequest<unknown>(`/api/employees/${employeeId}/status`, {
    method: "PATCH",
    token,
    body: data,
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
