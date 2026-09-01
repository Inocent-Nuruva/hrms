export type CompanyModuleKey = "roles" | "permissions"

export type CompanyModules = {
  roles: boolean
  permissions: boolean
}

export const DEFAULT_COMPANY_MODULES: CompanyModules = {
  roles: true,
  permissions: true,
}

/** Platform operators always keep the Roles and Permissions catalog. */
export const PLATFORM_COMPANY_MODULES: CompanyModules = {
  roles: true,
  permissions: true,
}

export const COMPANY_MODULES_EVENT = "hrms:company-modules-changed"
const COMPANY_MODULES_STORAGE_KEY = "hrms.company.modules"
const FORBIDDEN_ROUTES_EVENT = "hrms:forbidden-routes-changed"

const ROLE_PATHS = new Set(["/dashboard/roles", "/dashboard/access-control/roles"])
const PERMISSION_PATHS = new Set([
  "/dashboard/permissions",
  "/dashboard/access-control/permissions",
])

type CompanyModulesSnapshot = {
  modules: CompanyModules
  ready: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizePath(url: string) {
  const path = url.split("?")[0] ?? url
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path
}

function readOptionalBoolean(
  record: Record<string, unknown> | null,
  keys: string[],
): boolean | undefined {
  if (!record) return undefined
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue
    const value = record[key]
    if (typeof value === "boolean") return value
    if (typeof value === "number") {
      if (value === 1) return true
      if (value === 0) return false
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase()
      if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true
      if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false
    }
  }
  return undefined
}

export function parseCompanyModules(metadata: unknown): CompanyModules {
  let record = asRecord(metadata)
  if (!record && typeof metadata === "string" && metadata.trim()) {
    try {
      record = asRecord(JSON.parse(metadata))
    } catch {
      record = null
    }
  }

  const nested =
    asRecord(record?.modules) ?? asRecord(record?.features) ?? record

  const combined = readOptionalBoolean(nested, [
    "access_governance",
    "accessGovernance",
    "access-governance",
    "roles_and_permissions",
    "rolesAndPermissions",
  ])
  const fallback = combined ?? true

  return {
    roles: readOptionalBoolean(nested, ["roles", "roles_enabled", "rolesEnabled"]) ?? fallback,
    permissions:
      readOptionalBoolean(nested, [
        "permissions",
        "permissions_enabled",
        "permissionsEnabled",
      ]) ?? fallback,
  }
}

export function parseCompanyModulesFromCompany(company: unknown): CompanyModules {
  const record = asRecord(company)
  if (!record) return { ...DEFAULT_COMPANY_MODULES }
  return parseCompanyModules(record.modules ?? record.features ?? record.metadata ?? record)
}

export function readCompanyId(value: unknown): string | number | null {
  const record = asRecord(value)
  if (!record) return null

  const nestedCompany =
    asRecord(record.company) ??
    asRecord(record.organization) ??
    asRecord(record.tenant)

  const pick = (source: Record<string, unknown> | null, keys: string[]) => {
    if (!source) return null
    for (const key of keys) {
      const raw = source[key]
      if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw
      if (typeof raw === "bigint") {
        const parsed = Number(raw)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
      }
      if (typeof raw === "string" && raw.trim()) {
        const parsed = Number(raw)
        if (Number.isFinite(parsed) && parsed > 0) return parsed
        return raw.trim()
      }
    }
    return null
  }

  return (
    pick(record, ["company_id", "companyId"]) ??
    pick(nestedCompany, ["id", "company_id", "companyId"]) ??
    pick(record, ["id"])
  )
}

export function withCompanyModules<T extends Record<string, unknown>>(
  company: T,
  modules: CompanyModules,
): T & { modules: CompanyModules } {
  return {
    ...company,
    modules: {
      roles: modules.roles !== false,
      permissions: modules.permissions !== false,
    },
  }
}

const COMPANY_MODULES_BY_ID_KEY = "hrms.company.modules.byId"

function readModulesByIdMap(): Record<string, CompanyModules> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.sessionStorage.getItem(COMPANY_MODULES_BY_ID_KEY)
    if (!raw) return {}
    const parsed = asRecord(JSON.parse(raw))
    if (!parsed) return {}
    const result: Record<string, CompanyModules> = {}
    for (const [key, value] of Object.entries(parsed)) {
      result[key] = parseCompanyModules(value)
    }
    return result
  } catch {
    return {}
  }
}

export function rememberCompanyModules(
  companyId: string | number,
  modules: CompanyModules,
) {
  if (typeof window === "undefined") return
  const map = readModulesByIdMap()
  map[String(companyId)] = {
    roles: modules.roles !== false,
    permissions: modules.permissions !== false,
  }
  window.sessionStorage.setItem(COMPANY_MODULES_BY_ID_KEY, JSON.stringify(map))
}

export function readRememberedCompanyModules(
  companyId: string | number,
): CompanyModules | null {
  return readModulesByIdMap()[String(companyId)] ?? null
}

export async function resolveCompanyDashboardModules(options: {
  company: unknown
  extraIdSources?: unknown[]
  loadModules: (id: string | number) => Promise<unknown>
}): Promise<CompanyModules> {
  const id =
    readCompanyId(options.company) ??
    options.extraIdSources?.map(readCompanyId).find((value) => value != null) ??
    null
  const remembered = id != null ? readRememberedCompanyModules(id) : null
  const fallback = remembered ?? parseCompanyModulesFromCompany(options.company)
  if (id == null) return fallback

  try {
    const payload = await options.loadModules(id)
    if (payload == null) return fallback
    const modules = parseCompanyModules(payload)
    rememberCompanyModules(id, modules)
    return modules
  } catch {
    return fallback
  }
}

export function toCompanyModulesPayload(modules: CompanyModules) {
  const parsed = parseCompanyModules(modules)
  return {
    roles: parsed.roles !== false,
    permissions: parsed.permissions !== false,
  }
}

export function companyModulesSummary(modules: CompanyModules) {
  const parts: string[] = []
  if (modules.roles) parts.push("Roles")
  if (modules.permissions) parts.push("Permissions")
  return parts.length > 0 ? parts.join(" · ") : "None"
}

export function companyModuleForDashboardRoute(url: string): CompanyModuleKey | null {
  const path = normalizePath(url)
  if (ROLE_PATHS.has(path)) return "roles"
  if (PERMISSION_PATHS.has(path)) return "permissions"
  return null
}

export function isDashboardRouteEnabledForCompanyModules(
  url: string,
  modules: CompanyModules,
) {
  const kind = companyModuleForDashboardRoute(url)
  if (kind === null) return true
  return modules[kind] !== false
}

function notifyCompanyModulesChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(COMPANY_MODULES_EVENT))
  // Sidebar, tab rails, and route guards already refresh on this event.
  window.dispatchEvent(new Event(FORBIDDEN_ROUTES_EVENT))
}

export function publishCompanyModules(modules: CompanyModules) {
  if (typeof window === "undefined") return
  const snapshot: CompanyModulesSnapshot = {
    modules: {
      roles: modules.roles !== false,
      permissions: modules.permissions !== false,
    },
    ready: true,
  }
  window.sessionStorage.setItem(COMPANY_MODULES_STORAGE_KEY, JSON.stringify(snapshot))
  notifyCompanyModulesChanged()
}

export function clearPublishedCompanyModules() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(COMPANY_MODULES_STORAGE_KEY)
  notifyCompanyModulesChanged()
}

export function readPublishedCompanyModulesSnapshot(): CompanyModulesSnapshot {
  if (typeof window === "undefined") {
    return { modules: { ...DEFAULT_COMPANY_MODULES }, ready: false }
  }
  try {
    const raw = window.sessionStorage.getItem(COMPANY_MODULES_STORAGE_KEY)
    if (!raw) {
      return { modules: { ...DEFAULT_COMPANY_MODULES }, ready: false }
    }
    const parsed = asRecord(JSON.parse(raw))
    const nested = asRecord(parsed?.modules)
    return {
      modules: {
        roles: nested?.roles !== false,
        permissions: nested?.permissions !== false,
      },
      ready: parsed?.ready === true,
    }
  } catch {
    return { modules: { ...DEFAULT_COMPANY_MODULES }, ready: false }
  }
}

export function readPublishedCompanyModules() {
  return readPublishedCompanyModulesSnapshot().modules
}
