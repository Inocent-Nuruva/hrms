import type { AdminRecord } from "@/lib/admin-api"
import type { PermissionOption } from "@/components/dashboard/permission-selection"

export type RoleSuggestionTemplate = {
  id: string
  key: string
  displayName: string
  description: string
  audience: string
  aliases: string[]
  include: string[]
  includePrefixes: string[]
  excludePrefixes: string[]
}

export type ResolvedRoleSuggestion = RoleSuggestionTemplate & {
  permissionNames: string[]
}

const SELF_SERVICE = [
  "data_scope:self",
  "company_data:read",
  "users:update",
  "employees:read",
  "notifications:read",
  "notifications:update",
  "notifications:delete",
  "holidays:read",
  "attendance_holiday_groups:read",
  "attendance_holidays:read",
  "attendance_policies:read",
  "leave_types:read",
  "leave_requests:read",
  "leave_requests:create",
  "leave_requests:cancel",
  "leave_balances:read",
  "leave_balances:read-own",
  "attendance_summaries:read",
  "attendance_mobile_punches:create",
  "shift_change_requests:read",
  "shift_change_requests:create",
  "offboarding_workflows:read",
  "offboarding_requests:read",
  "offboarding_requests:create",
  "offboarding_requests:update",
  "offboarding_requests:submit",
  "offboarding_requests:cancel",
]

const ORG_READ = [
  "branches:read",
  "departments:read",
  "positions:read",
  "employee_grades:read",
  "cost_centers:read",
  "employee_assignments:read",
  "employee_numbering:read",
]

export const ROLE_SUGGESTION_TEMPLATES: RoleSuggestionTemplate[] = [
  {
    id: "employee",
    key: "EMPLOYEE",
    displayName: "Employee",
    description: "Self-service only: own profile, leave, attendance, and requests.",
    audience: "Every staff member",
    aliases: ["company_user", "staff", "self_service"],
    include: SELF_SERVICE,
    includePrefixes: [],
    excludePrefixes: [],
  },
  {
    id: "hr-manager",
    key: "HR_MANAGER",
    displayName: "HR Manager",
    description: "Runs HR: employees, leave, attendance, onboarding, and reports.",
    audience: "HR leadership",
    aliases: ["human_resources_manager", "hr"],
    include: [
      "data_scope:company",
      "company_dashboard:read",
      "users:read",
      ...SELF_SERVICE,
      ...ORG_READ,
      "notifications:send",
      "notifications:test",
    ],
    includePrefixes: [
      "employees:",
      "employees.",
      "leave_",
      "leave-",
      "holidays:",
      "attendance_",
      "shifts:",
      "shift_",
      "timetables:",
      "timetable_",
      "onboarding_",
      "offboarding_",
      "profile_change_request",
      "self_service_requests",
      "team_attendance",
      "hrms_launch_readiness",
    ],
    excludePrefixes: [
      "attendance_devices",
      "employee_access_credentials",
      "employee_device_assignments",
      "access_control",
    ],
  },
  {
    id: "hr-officer",
    key: "HR_OFFICER",
    displayName: "HR Officer",
    description: "Day-to-day HR records, leave review, and onboarding tasks.",
    audience: "HR operations",
    aliases: ["hr_staff", "human_resources_officer"],
    include: [
      "data_scope:company",
      "users:read",
      ...SELF_SERVICE,
      ...ORG_READ,
    ],
    includePrefixes: [
      "employees:",
      "employees.",
      "leave_requests",
      "leave-balances",
      "leave_balances",
      "leave_types:read",
      "leave_policies:read",
      "holidays:read",
      "attendance_policies:read",
      "attendance_summaries",
      "attendance_mobile_punches",
      "attendance_processing:read",
      "attendance_business_trips",
      "shifts:read",
      "shift_assignments:read",
      "shift_schedules:read",
      "shift_change_requests",
      "onboarding_",
      "offboarding_",
      "profile_change_request",
      "self_service_requests",
    ],
    excludePrefixes: [
      "employees:delete",
      "employees:change-status",
      "employees:force-exit",
      "attendance_devices",
    ],
  },
  {
    id: "sales-representative",
    key: "SALES_REPRESENTATIVE",
    displayName: "Sales Representative",
    description: "Own field visits, activities, and customer follow-up.",
    audience: "Sales / field staff",
    aliases: ["sales", "salesperson", "field_officer", "sales_rep"],
    include: [
      ...SELF_SERVICE,
      "field_visits:self-service-read",
      "field_visits:self-service-update",
      "work_activities:self-service-read",
      "work_activities:self-service-update",
      "field_locations:read",
      "analytics:dashboards-sales-field",
    ],
    includePrefixes: ["field_visits:self-service", "work_activities:self-service"],
    excludePrefixes: ["field_visits:config", "work_activities:config"],
  },
  {
    id: "sales-manager",
    key: "SALES_MANAGER",
    displayName: "Sales Manager",
    description: "Reviews team field visits, activities, and sales follow-up.",
    audience: "Sales leadership",
    aliases: ["field_manager", "sales_lead"],
    include: [
      "data_scope:department",
      "company_dashboard:read",
      ...SELF_SERVICE,
      ...ORG_READ,
      "field_visits:manager-read",
      "field_visits:manager-review",
      "work_activities:manager-read",
      "work_activities:manager-review",
      "field_locations:read",
      "analytics:dashboards-sales-field",
      "leave_requests:approve",
      "team_attendance:read",
    ],
    includePrefixes: [
      "field_visits:manager",
      "work_activities:manager",
      "field_locations",
    ],
    excludePrefixes: ["field_visits:config", "work_activities:config"],
  },
  {
    id: "department-manager",
    key: "DEPARTMENT_MANAGER",
    displayName: "Department Manager",
    description: "Approves team leave, attendance, and onboarding steps.",
    audience: "Line managers",
    aliases: ["manager", "line_manager", "hod", "head_of_department"],
    include: [
      "data_scope:department",
      "company_dashboard:read",
      ...SELF_SERVICE,
      ...ORG_READ,
      "leave_balances:list",
      "leave_requests:approve",
      "team_attendance:read",
      "shifts:read",
      "shift_assignments:read",
      "shift_schedules:read",
    ],
    includePrefixes: [
      "shift_change_requests",
      "onboarding_requests",
      "onboarding_tasks",
      "onboarding_documents",
      "offboarding_requests",
      "offboarding_tasks",
      "offboarding_clearances",
    ],
    excludePrefixes: [],
  },
]

export function normalizeRoleToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function readRoleToken(row: AdminRecord, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

export function existingRoleTokens(roles: AdminRecord[]) {
  const tokens = new Set<string>()
  for (const role of roles) {
    for (const key of ["name", "display_name", "displayName", "key", "code"]) {
      const value = readRoleToken(role, [key])
      if (value) tokens.add(normalizeRoleToken(value))
    }
  }
  return tokens
}

export function suggestionAlreadyExists(
  template: RoleSuggestionTemplate,
  existingTokens: Iterable<string>,
) {
  const existing = existingTokens instanceof Set ? existingTokens : new Set(existingTokens)
  const candidates = [template.key, template.displayName, ...template.aliases].map(
    normalizeRoleToken,
  )
  return candidates.some((token) => token && existing.has(token))
}

function matchesPrefix(name: string, prefix: string) {
  return name === prefix || name.startsWith(prefix)
}

export function resolveSuggestionPermissions(
  template: RoleSuggestionTemplate,
  catalogNames: Iterable<string>,
) {
  const catalog = Array.from(catalogNames)
  const include = new Set(template.include)
  const selected = catalog.filter((name) => {
    if (template.excludePrefixes.some((prefix) => matchesPrefix(name, prefix))) {
      return false
    }
    if (include.has(name)) return true
    return template.includePrefixes.some((prefix) => matchesPrefix(name, prefix))
  })
  return Array.from(new Set(selected)).sort()
}

export function availableRoleSuggestions(
  roles: AdminRecord[],
  permissionOptions: PermissionOption[],
): ResolvedRoleSuggestion[] {
  const existing = existingRoleTokens(roles)
  const catalogNames = permissionOptions.map((option) => option.name)
  return ROLE_SUGGESTION_TEMPLATES.filter(
    (template) => !suggestionAlreadyExists(template, existing),
  )
    .map((template) => ({
      ...template,
      permissionNames: resolveSuggestionPermissions(template, catalogNames),
    }))
    .filter((suggestion) => suggestion.permissionNames.length > 0 || catalogNames.length === 0)
}
