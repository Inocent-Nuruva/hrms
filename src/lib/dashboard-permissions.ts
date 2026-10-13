import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { clearPublishedCompanyModules } from "@/lib/company-modules"
import { asRecord, readString } from "@/utils/token-utils"
import type { AuthScope } from "@/types"

export const DASHBOARD_ACTOR_EVENT = "hrms:dashboard-actor-changed"
export const DASHBOARD_ACCESS_REFRESH_EVENT = "hrms:dashboard-access-refresh-requested"
export const DASHBOARD_PERMISSION_STORAGE_KEY = "hrms.dashboard.actorPermissions"
export const DASHBOARD_ACCESS_MODE_STORAGE_KEY = "hrms.dashboard.accessMode"
export const DASHBOARD_IS_ADMIN_STORAGE_KEY = "hrms.dashboard.isAdmin"
export const DASHBOARD_ROLES_STORAGE_KEY = "hrms.dashboard.actorRoles"
export const DASHBOARD_SCOPE_STORAGE_KEY = "hrms.dashboard.scope"
export const DASHBOARD_AUTH_COOKIE = "hrms_dashboard_auth"
export const DASHBOARD_TOKEN_COOKIE = "hrms_dashboard_token"
export const DASHBOARD_PERMISSIONS_COOKIE = "hrms_dashboard_permissions"

const LEGACY_ADMIN_USER_STORAGE_KEY = "hrms.admin.user"
const FORBIDDEN_ROUTES_STORAGE_KEY = "hrms.forbiddenRoutes.v3"
const CONFIRMED_PLATFORM_ROUTES_STORAGE_KEY = "hrms.confirmedPlatformRoutes"
const FORBIDDEN_ROUTES_EVENT = "hrms:forbidden-routes-changed"

// A persisted snapshot makes reloads fast, but it is not authoritative. Each
// new document keeps permission-controlled UI hidden until /api/users/me has
// verified the current access context (or a safe fallback is deliberately used).
let dashboardActorVerifiedThisPage = false

type PermissionMode = "any" | "all"

export type PermissionRequirement =
  | string
  | {
      permissions: string[]
      mode?: PermissionMode
    }

export type DashboardAccessMode = "admin" | "employee"

export type DashboardActorSnapshot = {
  permissionLabels: string[]
  roleNames: string[]
  scope: AuthScope | null
  accessMode: DashboardAccessMode
  isAdmin: boolean
  ready: boolean
  version: number
}

type DashboardActorIdentityResolution = {
  permissionLabels: string[]
  roleNames: string[]
  scope: AuthScope | null
  hasExplicitAdminIdentity: boolean
  hasExplicitEmployeeIdentity: boolean
  hasPermissionBasedAdminAccess: boolean
  accessMode: DashboardAccessMode
  isAdmin: boolean
}

const COMPANY_DASHBOARD_SWITCH_PERMISSION = "view_company_dashboard"

/** Only true platform wildcards grant every route. Role names and `employees:*` do not. */
const GLOBAL_BYPASS_LABELS = new Set(["*", "*:*", "all"])

/**
 * Company-wide overview (HR analytics on `/dashboard`).
 * Driven only by permission labels from the API — not role name hardcoding.
 * Aligns with other company-level routes that already use `view_company_data`.
 */
export const COMPANY_DASHBOARD_PERMISSION: PermissionRequirement = {
  permissions: [
    "view_company_dashboard",
    "view_company_data",
  ],
  mode: "any",
}

/**
 * Operations payroll (`/dashboard/operations/payroll`).
 * Company dashboard access is not enough — those users get
 * "You do not have permission to perform this action" from /api/payroll/*.
 */
export const PAYROLL_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "payroll:read",
    "payroll:create",
    "payroll:update",
    "payrolls:read",
    "payroll_runs:read",
    "payroll_runs:create",
    "payroll_inputs:read",
    "payroll_profiles:read",
    "employee_payroll_profiles:read",
    "payroll_employees:read",
    "payroll_configuration:read",
    "payroll_periods:read",
    "payroll_reports:read",
    "manage_payroll",
    "view_payroll",
    // Labels seeded by the backend (001-permissions.seed.ts) and enforced by
    // /api/payroll/*. `payroll:payslips:self` is self-service and stays out.
    "payroll:config",
    "payroll:config:read",
    "payroll:profiles",
    "payroll:profiles:read",
    "payroll:periods",
    "payroll:periods:read",
    "payroll:inputs",
    "payroll:inputs:read",
    "payroll:inputs:approve",
    "payroll:runs",
    "payroll:runs:read",
    "payroll:runs:process",
    "payroll:runs:approve",
    "payroll:runs:lock",
    "payroll:payslips",
    "payroll:payslips:read",
    "payroll:banking",
    "payroll:accounting",
    "payroll:reports",
    "payroll:final-settlements",
  ],
  mode: "any",
}

/**
 * HR Performance (`/dashboard/performance/*`).
 * Company dashboard actors can see the HR performance overview/setup shell; deeper
 * workflows still use their feature-specific grants.
 */
const PERFORMANCE_MODULE_WIDE = [
  "performance:read",
  "performance:create",
  "performance:update",
  "manage_performance",
  "view_performance",
]

export const PERFORMANCE_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...PERFORMANCE_MODULE_WIDE,
    "performance_years:read",
    "performance_periods:read",
    "performance_kpis:read",
    "performance_plans:read",
    "performance_reviews:read",
    "performance_improvement_plans:read",
    COMPANY_DASHBOARD_SWITCH_PERMISSION,
  ],
  mode: "any",
}

export const PERFORMANCE_SETUP_PERMISSION: PermissionRequirement = {
  permissions: [
    ...PERFORMANCE_MODULE_WIDE,
    "performance_years:read",
    "performance_periods:read",
    "performance_kpis:read",
    "performance_templates:read",
    "kpi_templates:read",
    "performance_rating_scales:read",
    "kpi_rules:read",
    COMPANY_DASHBOARD_SWITCH_PERMISSION,
  ],
  mode: "any",
}

export const PERFORMANCE_PLANS_PERMISSION: PermissionRequirement = {
  permissions: [...PERFORMANCE_MODULE_WIDE, "performance_plans:read"],
  mode: "any",
}

export const PERFORMANCE_REVIEWS_PERMISSION: PermissionRequirement = {
  permissions: [...PERFORMANCE_MODULE_WIDE, "performance_reviews:read", "performance_appeals:read"],
  mode: "any",
}

export const PERFORMANCE_IMPROVEMENT_PERMISSION: PermissionRequirement = {
  permissions: [...PERFORMANCE_MODULE_WIDE, "performance_improvement_plans:read"],
  mode: "any",
}

/**
 * HR Probation (`/dashboard/probation/*`).
 * Company dashboard access is not enough — /api/probation/* is its own grant.
 */
const PROBATION_MODULE_WIDE = [
  "probation:read",
  "probation:create",
  "probation:update",
  "manage_probation",
  "view_probation",
]

export const PROBATION_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [...PROBATION_MODULE_WIDE, "probation_policies:read", "probation_cases:read"],
  mode: "any",
}

export const PROBATION_POLICIES_PERMISSION: PermissionRequirement = {
  permissions: [...PROBATION_MODULE_WIDE, "probation_policies:read"],
  mode: "any",
}

export const PROBATION_CASES_PERMISSION: PermissionRequirement = {
  permissions: [...PROBATION_MODULE_WIDE, "probation_cases:read"],
  mode: "any",
}

export const PROBATION_TEAM_PERMISSION: PermissionRequirement = {
  permissions: [
    ...PROBATION_MODULE_WIDE,
    "probation_cases:read-team",
    "manager:read",
    "team:read",
    "view_team",
    "manager_team:read",
  ],
  mode: "any",
}

export const PROBATION_SECTION_PERMISSION: PermissionRequirement = {
  permissions: [
    ...PROBATION_MODULE_WIDE,
    "probation_policies:read",
    "probation_cases:read",
    "probation_cases:read-team",
    "manager:read",
    "team:read",
    "view_team",
    "manager_team:read",
  ],
  mode: "any",
}

/**
 * Field operations (`/dashboard/field/*`).
 * Shown when the actor has a field / work-activity grant — not by HR identity.
 */
const FIELD_MODULE_WIDE = [
  "field:read",
  "field:create",
  "view_field",
  "manage_field",
]

export const FIELD_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...FIELD_MODULE_WIDE,
    "field_visits:read",
    "field_visits:create",
    "field_parties:read",
    "field_parties:create",
    "view_field_visits",
    "manage_field_visits",
  ],
  mode: "any",
}

export const FIELD_VISITS_PERMISSION: PermissionRequirement = {
  permissions: [
    ...FIELD_MODULE_WIDE,
    "field_visits:read",
    "field_visits:create",
    "view_field_visits",
    "manage_field_visits",
  ],
  mode: "any",
}

export const FIELD_PARTIES_PERMISSION: PermissionRequirement = {
  permissions: [...FIELD_MODULE_WIDE, "field_parties:read", "field_parties:create"],
  mode: "any",
}

/**
 * Employee finance operations (`/dashboard/finance/*`).
 * Shown when the actor has a finance / loan / advance grant — not by HR identity.
 */
const FINANCE_MODULE_WIDE = [
  "finance:read",
  "finance:create",
  "view_finance",
  "manage_finance",
  "view_employee_finance",
  "manage_employee_finance",
]

export const FINANCE_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...FINANCE_MODULE_WIDE,
    "employee_finance:read",
    "employee_finance:create",
    "employee_finance:update",
    "staff_loans:read",
    "salary_advances:read",
    // Labels seeded by the backend and enforced by /api/employee-finance/*.
    // `employee_finance:applications:self` is self-service and stays out.
    "employee_finance:products",
    "employee_finance:products:read",
    "employee_finance:applications:read",
    "employee_finance:applications:manager-review",
    "employee_finance:applications:hr-approve",
    "employee_finance:applications:finance-approve",
    "employee_finance:accounts:read",
    "employee_finance:disbursements",
    "employee_finance:disbursements:approve",
    "employee_finance:repayments",
    "employee_finance:repayments:approve",
    "employee_finance:payroll",
    "employee_finance:settlements",
    "employee_finance:reports",
    "employee_finance:reconciliation",
  ],
  mode: "any",
}

export const FINANCE_PRODUCTS_PERMISSION: PermissionRequirement = {
  permissions: [
    ...FINANCE_MODULE_WIDE,
    "employee_finance:create",
    "employee_finance_products:read",
    "finance_products:read",
    "employee_finance:products",
    "employee_finance:products:read",
  ],
  mode: "any",
}

export const FINANCE_ACCOUNTS_PERMISSION: PermissionRequirement = {
  permissions: [
    ...FINANCE_MODULE_WIDE,
    "employee_finance:update",
    "employee_finance_accounts:read",
    "staff_loans:read",
    "salary_advances:read",
    "employee_finance:accounts:read",
    "employee_finance:disbursements",
    "employee_finance:disbursements:approve",
    "employee_finance:repayments",
    "employee_finance:repayments:approve",
    "employee_finance:settlements",
    "employee_finance:reconciliation",
  ],
  mode: "any",
}

/**
 * Daily activity operations (`/dashboard/activities/*`).
 * Shown when the actor has an activities / work-activity grant — not by HR identity.
 */
const ACTIVITY_MODULE_WIDE = [
  "activities:read",
  "activities:create",
  "activities:update",
  "work_activities:read",
  "work_activities:create",
  "daily_activities:read",
  "view_activities",
  "manage_activities",
  "view_daily_activities",
  "manage_daily_activities",
  "work_activities:manager:read",
  "work_activities:manager:review",
]

export const ACTIVITY_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...ACTIVITY_MODULE_WIDE,
    "activity_categories:read",
    "activity_policies:read",
  ],
  mode: "any",
}

export const ACTIVITY_REVIEWS_PERMISSION: PermissionRequirement = {
  permissions: [
    "activities:update",
    "activities:approve",
    "work_activities:update",
    "manage_activities",
    "manage_daily_activities",
  ],
  mode: "any",
}

export const ACTIVITY_SETUP_PERMISSION: PermissionRequirement = {
  permissions: [
    "activity_categories:read",
    "activity_categories:create",
    "activity_policies:read",
    "activity_policies:create",
    "activities:create",
    "manage_activities",
  ],
  mode: "any",
}

/**
 * Employee movement operations (`/dashboard/movements/*`).
 * Shown when the actor has an employee-movements grant — not by HR identity.
 */
const MOVEMENT_MODULE_WIDE = [
  "employee_movements:read",
  "employee_movements:create",
  "movements:read",
  "movements:create",
  "view_employee_movements",
]

export const MOVEMENT_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...MOVEMENT_MODULE_WIDE,
    "employee_movements:update",
    "employee_movements:approve",
    "manage_employee_movements",
  ],
  mode: "any",
}

export const MOVEMENT_OPERATIONS_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_movements:update",
    "employee_movements:approve",
    "employee_movements:apply",
    "manage_employee_movements",
  ],
  mode: "any",
}

const SMS_SETTINGS_READ_LABELS = [
  "sms:settings:read",
  "sms:read",
  "sms_registry:read",
  "view_sms",
  "manage_sms",
]

const SMS_SETTINGS_UPDATE_LABELS = [
  "sms:settings:update",
  "sms:update",
  "manage_sms",
]

const SMS_LOGS_READ_LABELS = [
  "sms:logs:read",
  "sms:read",
  "sms_logs:read",
  "view_sms",
  "manage_sms",
]

const SMS_LOGS_RETRY_LABELS = [
  "sms:logs:retry",
  "sms:update",
  "manage_sms",
]

const SMS_TEST_LABELS = [
  "sms:test",
  "sms:create",
  "manage_sms",
]

/**
 * Company SMS operations (`/dashboard/sms/*`).
 * Live API labels are `sms:settings:*`, `sms:logs:*`, and `sms:test`.
 * Platform SMS tabs still require companies:read, same as notification platform.
 */
export const SMS_SETTINGS_READ_PERMISSION: PermissionRequirement = {
  permissions: SMS_SETTINGS_READ_LABELS,
  mode: "any",
}

export const SMS_SETTINGS_UPDATE_PERMISSION: PermissionRequirement = {
  permissions: SMS_SETTINGS_UPDATE_LABELS,
  mode: "any",
}

export const SMS_LOGS_READ_PERMISSION: PermissionRequirement = {
  permissions: SMS_LOGS_READ_LABELS,
  mode: "any",
}

export const SMS_LOGS_RETRY_PERMISSION: PermissionRequirement = {
  permissions: SMS_LOGS_RETRY_LABELS,
  mode: "any",
}

export const SMS_TEST_PERMISSION: PermissionRequirement = {
  permissions: SMS_TEST_LABELS,
  mode: "any",
}

export const SMS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...SMS_SETTINGS_READ_LABELS,
    ...SMS_SETTINGS_UPDATE_LABELS,
    ...SMS_LOGS_READ_LABELS,
    ...SMS_LOGS_RETRY_LABELS,
    ...SMS_TEST_LABELS,
  ],
  mode: "any",
}

/**
 * Structure catalogs (`/dashboard/structure/*`).
 * Shown for cost-center or grade grants — not by HR identity.
 */
const COST_CENTER_PERMISSIONS = [
  "cost_centers:read",
  "cost_centers:create",
  "cost_centers:update",
  "view_cost_centers",
  "manage_cost_centers",
]

const GRADE_PERMISSIONS = [
  "employee_grades:read",
  "employee_grades:create",
  "employee_grades:update",
  "view_employee_grades",
  "manage_employee_grades",
]

export const COST_CENTER_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: COST_CENTER_PERMISSIONS,
  mode: "any",
}

export const GRADE_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: GRADE_PERMISSIONS,
  mode: "any",
}

export const STRUCTURE_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...COST_CENTER_PERMISSIONS,
    ...GRADE_PERMISSIONS,
    "employee_numbering:read",
    "employee_numbering:update",
    "employee_numbering:create",
  ],
  mode: "any",
}

/**
 * HR / management dashboards (`/dashboard/insights/*`).
 * Company dashboard access is not enough — /api/dashboards/* is its own grant.
 */
export const ANALYTICS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "analytics:read",
    "analytics:create",
    "analytics_datasets:read",
    "analytics_reports:read",
    "view_analytics",
    "manage_analytics",
  ],
  mode: "any",
}

export const INSIGHTS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "dashboards:read",
    "hr_dashboards:read",
    "view_dashboards",
    "view_hr_dashboard",
    "manage_dashboards",
    "launch_readiness:read",
    "security_events:read",
    "identity_audit:read",
    "analytics:read",
    "sales_field:read",
  ],
  mode: "any",
}

export const INSIGHTS_HR_PERMISSION: PermissionRequirement = {
  permissions: [
    "dashboards:read",
    "hr_dashboards:read",
    "view_dashboards",
    "view_hr_dashboard",
    "manage_dashboards",
  ],
  mode: "any",
}

export const INSIGHTS_MANAGEMENT_PERMISSION: PermissionRequirement = {
  permissions: [
    "dashboards:read",
    "view_dashboards",
    "view_management_dashboard",
    "management_dashboards:read",
    "manage_dashboards",
  ],
  mode: "any",
}

export const INSIGHTS_MANAGER_PERMISSION: PermissionRequirement = {
  permissions: [
    "dashboards:read",
    "view_dashboards",
    "view_manager_dashboard",
    "manager_dashboards:read",
    "manage_dashboards",
  ],
  mode: "any",
}

export const INSIGHTS_READINESS_PERMISSION: PermissionRequirement = {
  permissions: ["launch_readiness:read", "security_events:read", "view_launch_readiness"],
  mode: "any",
}

export const INSIGHTS_IDENTITY_AUDIT_PERMISSION: PermissionRequirement = {
  permissions: ["identity_audit:read"],
  mode: "any",
}

export const INSIGHTS_SALES_FIELD_PERMISSION: PermissionRequirement = {
  permissions: [
    "analytics:read",
    "dashboards:read",
    "view_dashboards",
    "view_sales_field",
    "sales_field:read",
    "manage_analytics",
  ],
  mode: "any",
}

export const NUMBERING_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_numbering:read",
    "employee_numbering:update",
    "employee_numbering:create",
  ],
  mode: "any",
}

export const MANAGER_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "manager:read",
    "managers:read",
    "team:read",
    "teams:read",
    "view_team",
    "view_manager_dashboard",
    "manager_dashboard:read",
    "manager_team:read",
  ],
  mode: "any",
}

/**
 * Scheduled reporting and SMTP are company-scoped (`scheduled_reports:*`).
 * Do not treat platform/shared aliases as access — each company configures
 * its own SMTP and only that company's Company Admin (or a company role
 * granted these permissions) can see it.
 */
const SCHEDULED_REPORTING_BACKEND_PERMISSIONS = [
  "scheduled_reports:read",
  "scheduled_reports:create",
  "scheduled_reports:update",
  "scheduled_reports:delete",
  "scheduled_reports:run",
  "scheduled_reports:manage_smtp",
  "scheduled_reports:test_smtp",
  "scheduled_reports:view_history",
  "scheduled_reports:download",
]

export const SCHEDULED_REPORTING_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [...SCHEDULED_REPORTING_BACKEND_PERMISSIONS],
  mode: "any",
}

export const SCHEDULED_REPORTING_MUTATE_PERMISSION: PermissionRequirement = {
  permissions: [
    "scheduled_reports:create",
    "scheduled_reports:update",
    "scheduled_reports:delete",
    "scheduled_reports:manage_smtp",
  ],
  mode: "any",
}

export const SCHEDULED_REPORTING_SMTP_PERMISSION: PermissionRequirement = {
  permissions: ["scheduled_reports:manage_smtp", "scheduled_reports:test_smtp"],
  mode: "any",
}

export const NOTIFICATIONS_ADMIN_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "notifications:read",
    "notifications:update",
    "notifications:create",
    "notifications:settings:read",
    "notifications:settings:update",
    "notifications:mail-logs:read",
    "notifications:mail-logs:retry",
    "view_notifications",
    "manage_notifications",
  ],
  mode: "any",
}

export const ATTENDANCE_REPORTS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "reports.view",
    "reports.export",
    "reports.custom.create",
    "reports.custom.manage",
    "employee_reports.view",
    "attendance_reports.view",
    "leave_reports.view",
    "field_reports.view",
    "activity_reports.view",
    "performance_reports.view",
    "payroll_reports.view",
    "loan_reports.view",
    "analytics:reports",
    "analytics:exports",
    "analytics:dashboards:hr",
    "attendance_summaries:read",
    "attendance_processing:read",
    "attendance_reports:read",
    "view_attendance_reports",
    "view_company_data",
  ],
  mode: "any",
}

/**
 * Platform tenant registry at `/dashboard/companies`.
 * `company_users:*` is company-scoped membership and must not unlock this
 * page — those users get "Platform access is required" from GET /api/companies.
 */
export const COMPANY_MANAGEMENT_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: ["companies:read", "companies:update", "view_companies", "update_company"],
  mode: "any",
}

export const ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION = {
  permissions: [
    "attendance_business_trips:approve",
    "attendance_business_trips:cancel",
    "attendance_business_trips:create",
    "attendance_business_trips:delete",
    "attendance_business_trips:read",
    "attendance_business_trips:update",
  ],
  mode: "any",
} satisfies PermissionRequirement

const ADMIN_DASHBOARD_LANDING_ROUTES = [
  "/dashboard/branches",
  "/dashboard/departments",
  // Do NOT use /dashboard/employees/all here — normal employees often have
  // employees:read for self-service and must not flip into admin mode.
  "/dashboard/employees/registration",
  "/dashboard/employees/onboarding",
  "/dashboard/employees/offboarding",
  "/dashboard/employees/profile-update-approvals",
  "/dashboard/employees/profile-change-requests",
  "/dashboard/attendance/policies",
  "/dashboard/attendance/shifts",
  "/dashboard/attendance/correction-requests",
  "/dashboard/access-control",
  "/dashboard/positions",
  // Do not use /dashboard/leave-management or daily-summaries here.
  // Employees routinely have leave_requests:read / leave_balances:read /
  // attendance_summaries:read for self-service and must keep the My * shell.
  "/dashboard/leave-management/types",
  "/dashboard/leave-management/policies",
  "/dashboard/leave-management/workflows",
  // Do not use /dashboard/performance/overview here. Employees may have
  // performance:read for self-service and must keep the My * shell.
  "/dashboard/probation/overview",
  "/dashboard/field/overview",
  "/dashboard/finance/overview",
  "/dashboard/activities/overview",
  "/dashboard/movements/overview",
  "/dashboard/sms/overview",
  "/dashboard/smtp",
  "/dashboard/structure",
  "/dashboard/insights/hr",
  "/dashboard/operations/payroll",
  "/dashboard/operations/recruitment",
  "/dashboard/operations/scheduled-reporting",
  "/dashboard/operations/notifications",
  "/dashboard/users",
  "/dashboard/roles",
  "/dashboard/permissions",
]

const DASHBOARD_ROUTE_SHELLS: Record<string, DashboardAccessMode> = {
  // This is the admin-shell overview surface, not a generic feature route.
  "/dashboard/company-overview": "admin",
  "/dashboard/performance": "admin",
  "/dashboard/probation": "admin",
}

/** Permissions that unlock the company employee directory and employee profiles. */
const EMPLOYEE_DIRECTORY_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "employees:read",
    "employees:create",
    "employees:update",
    "employees:delete",
    "company_users:create",
    "users:create",
    "create_company_user",
  ],
  mode: "any",
}

/** Permissions that allow an administrator or HR user to register another employee. */
export const EMPLOYEE_REGISTRATION_PERMISSION = {
  permissions: [
    "employees:create",
    "company_users:create",
    "users:create",
    "create_company_user",
  ],
  mode: "any",
} satisfies PermissionRequirement

/** Permissions that unlock employee administration workflows beyond directory read. */
const EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS: PermissionRequirement = {
  permissions: [
    ...EMPLOYEE_REGISTRATION_PERMISSION.permissions,
    "employees:update",
    "employees:delete",
  ],
  mode: "any",
}

const ADMIN_IDENTITY_HINTS = new Set([
  "admin",
  "administrator",
  "hr",
  "human resources",
  "human_resources",
  "human-resources",
  "super admin",
  "super_admin",
  "super-admin",
  "root",
  "owner",
])

const EMPLOYEE_IDENTITY_HINTS = new Set([
  "employee",
  "staff",
  "self service",
  "self_service",
  "self-service",
  "ess",
  "company user",
  "company_user",
])

function roleNameImpliesAdminShell(value: string) {
  const name = normalizeIdentityHint(value)
  if (!name || EMPLOYEE_IDENTITY_HINTS.has(name)) {
    return false
  }
  if (name.includes("employee") && !name.includes("admin") && !name.includes("hr")) {
    return false
  }
  if (ADMIN_IDENTITY_HINTS.has(name)) {
    return true
  }
  return (
    name.includes("human resource") ||
    name.startsWith("hr ") ||
    name.endsWith(" hr") ||
    name.includes("administrator") ||
    name.includes("admin") ||
    name.includes("director") ||
    name.includes("management") ||
    name.includes("super admin")
  )
}

const ATTENDANCE_ROUTE_PERMISSIONS: PermissionRequirement = {
  permissions: [
    "attendance_policies:read",
    "attendance_devices:read",
    "attendance_checkpoints:read",
    "attendance_holiday_groups:read",
    "attendance_geofences:read",
    "attendance_wifi_networks:read",
    "attendance_mobile_punches:read",
    "attendance_holidays:read",
    "attendance_device_sync_logs:read",
    "attendance_summaries:read",
    "attendance_processing:read",
    "attendance_recalculation:execute",
    "shifts:read",
    "shift_breaks:read",
    "shift_assignments:read",
    "shift_schedules:read",
    "shift_rotation_groups:read",
    "shift_rotation_rules:read",
    "timetables:read",
    "timetable_days:read",
    "timetable_holiday_rules:read",
    "timetable_rotations:read",
    "timetable_rotation_rules:read",
    "employee_timetables:read",
    "self_service_requests:approve",
  ],
  mode: "any",
}

export const DASHBOARD_ROUTE_PERMISSIONS: Record<string, PermissionRequirement | null> = {
  "/dashboard/me/profile": null,
  "/dashboard/me/organization": null,
  "/dashboard/me/promotion": null,
  "/dashboard/me/payroll": null,
  "/dashboard/me/finance/payroll": null,
  "/dashboard/me/performance": null,
  "/dashboard/me/performance/overview": null,
  "/dashboard/me/performance/kpis": null,
  "/dashboard/me/performance/assignments": null,
  "/dashboard/me/performance/assign-tasks": {
    permissions: ["work_activities:manager:review"],
    mode: "any",
  },
  "/dashboard/me/performance/reviews": null,
  "/dashboard/me/performance/achievements": null,
  "/dashboard/me/performance/improvement": null,
  "/dashboard/me/performance/team": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/performance/manager-kpis": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/probation": null,
  "/dashboard/me/field": null,
  "/dashboard/me/field/visits": null,
  "/dashboard/me/field/plans": null,
  "/dashboard/me/field/follow-ups": null,
  "/dashboard/me/finance": null,
  "/dashboard/me/finance/applications": null,
  "/dashboard/me/activities": null,
  "/dashboard/me/activities/today": null,
  "/dashboard/me/activities/reports": null,
  "/dashboard/me/movements": null,
  "/dashboard/me/team": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/team/overview": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/team/members": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/team/attendance": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/team/actions": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/insights": null,
  "/dashboard/me/requests": null,
  "/dashboard/me/requests/actions": null,
  "/dashboard/me/requests/timeline": null,
  "/dashboard/me/requests/documents": null,
  "/dashboard/me/requests/profile-changes": null,
  "/dashboard/me/requests/resignation": null,
  "/dashboard/me/onboarding": null,
  "/dashboard/me/offboarding": null,
  "/dashboard/me/leave": null,
  "/dashboard/me/leave/requests": null,
  "/dashboard/me/leave/balances": null,
  "/dashboard/me/leave/holidays": null,
  "/dashboard/me/leave/policies": null,
  "/dashboard/attendance/today": null,
  "/dashboard/attendance/punch-action": null,
  "/dashboard/attendance/attendance-history": null,
  "/dashboard/attendance/schedule-preview": null,
  "/dashboard/attendance/corrections": null,
  // Route permissions stay permission-first regardless of shell unless an
  // explicit shell requirement is defined separately.
  "/dashboard/employees": {
    permissions: [
      "employees:read",
      "employees:create",
      "employees:update",
      "employees:delete",
      "company_users:create",
      "users:create",
      "create_company_user",
      "offboarding_requests:read",
      "offboarding_workflows:read",
      "onboarding_requests:read",
      "onboarding_workflows:read",
      "self_service_requests:approve",
    ],
    mode: "any",
  },
  "/dashboard/employees/all": EMPLOYEE_DIRECTORY_ROUTE_PERMISSION,
  "/dashboard/employees/inactive": EMPLOYEE_DIRECTORY_ROUTE_PERMISSION,
  "/dashboard/employees/registration": EMPLOYEE_REGISTRATION_PERMISSION,
  "/dashboard/employees/offboarding": {
    permissions: ["offboarding_requests:read", "offboarding_workflows:read"],
    mode: "any",
  },
  "/dashboard/employees/onboarding": {
    permissions: ["onboarding_requests:read", "onboarding_workflows:read"],
    mode: "any",
  },
  // Other employees' profiles — not self profile under /dashboard/me/profile.
  "/dashboard/employees/profile": EMPLOYEE_DIRECTORY_ROUTE_PERMISSION,
  "/dashboard/employees/profile/": EMPLOYEE_DIRECTORY_ROUTE_PERMISSION,
  "/dashboard/employees/profile-update-approvals": "self_service_requests:approve",
  "/dashboard/employees/profile-change-requests": "self_service_requests:approve",
  "/dashboard/attendance": ATTENDANCE_ROUTE_PERMISSIONS,
  "/dashboard/attendance/settings": "attendance_policies:read",
  "/dashboard/attendance/policies": "attendance_policies:read",
  "/dashboard/attendance/devices": "attendance_devices:read",
  "/dashboard/attendance/checkpoints": "attendance_checkpoints:read",
  "/dashboard/attendance/holiday-groups": "attendance_holiday_groups:read",
  "/dashboard/attendance/geofences": "attendance_geofences:read",
  "/dashboard/attendance/wifi-networks": "attendance_wifi_networks:read",
  "/dashboard/attendance/mobile-punches": "attendance_mobile_punches:read",
  "/dashboard/attendance/holidays": "attendance_holidays:read",
  "/dashboard/attendance/device-sync-logs": "attendance_device_sync_logs:read",
  "/dashboard/attendance/daily-summaries": "attendance_summaries:read",
  "/dashboard/attendance/processing-exceptions": "attendance_processing:read",
  "/dashboard/attendance/recalculation-jobs": {
    permissions: ["attendance_processing:read", "attendance_recalculation:execute"],
    mode: "any",
  },
  "/dashboard/attendance/unmatched-logs": "attendance_processing:read",
  "/dashboard/attendance/shifts": "shifts:read",
  "/dashboard/attendance/shift-breaks": "shift_breaks:read",
  "/dashboard/attendance/shift-assignments": "shift_assignments:read",
  "/dashboard/attendance/shift-schedules": "shift_schedules:read",
  "/dashboard/attendance/timetable-generated-schedules": "shift_schedules:read",
  "/dashboard/attendance/shift-rotation-groups": "shift_rotation_groups:read",
  "/dashboard/attendance/shift-rotation-rules": "shift_rotation_rules:read",
  "/dashboard/attendance/correction-requests": "self_service_requests:approve",
  "/dashboard/attendance/timetables": "timetables:read",
  "/dashboard/attendance/timetable-days": "timetable_days:read",
  "/dashboard/attendance/timetable-shift-rules": "timetable_days:read",
  "/dashboard/attendance/timetable-holiday-rules": "timetable_holiday_rules:read",
  "/dashboard/attendance/timetable-rotations": "timetable_rotations:read",
  "/dashboard/attendance/timetable-rotation-rules": "timetable_rotation_rules:read",
  "/dashboard/attendance/employee-timetables": "employee_timetables:read",
  "/dashboard/departments": "departments:read",
  "/dashboard/branches": "branches:read",
  "/dashboard/positions": "positions:read",
  "/dashboard/companies": COMPANY_MANAGEMENT_ROUTE_PERMISSION,
  "/dashboard/leave-management": {
    permissions: [
      "leave_types:read",
      "leave_requests:read",
      "leave_balances:read",
      "leave-balances.view",
      "leave-balances.manage",
      "leave-balances.export",
      "leave-balances.bulk-import",
      "leave-balances.import-history",
      "holidays:read",
      "attendance_holidays:read",
      "leave_policies:read",
      "leave_workflows:read",
      ...ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION.permissions,
    ],
    mode: "any",
  },
  "/dashboard/leave-management/types": "leave_types:read",
  "/dashboard/leave-management/requests": {
    permissions: [
      "leave_requests:read",
      "leave_requests:approve",
      "leave_requests:update",
    ],
    mode: "any",
  },
  "/dashboard/leave-management/balances": {
    permissions: ["leave_balances:read", "leave-balances.view", "leave-balances.manage"],
    mode: "any",
  },
  "/dashboard/leave-management/transactions": {
    permissions: ["leave_balances:read", "leave-balances.view", "leave-balances.manage"],
    mode: "any",
  },
  "/dashboard/leave-management/balance-import": {
    permissions: [
      "leave-balances.export",
      "leave-balances.bulk-import",
      "leave-balances.import-history",
    ],
    mode: "any",
  },
  "/dashboard/leave-management/business-trips": ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION,
  "/dashboard/leave-management/holidays": {
    permissions: ["holidays:read", "attendance_holidays:read"],
    mode: "any",
  },
  "/dashboard/leave-management/policies": "leave_policies:read",
  "/dashboard/leave-management/workflows": "leave_workflows:read",
  // Any shell restriction is handled separately so this remains the permission source of truth.
  "/dashboard/company-overview": COMPANY_DASHBOARD_PERMISSION,
  "/dashboard/operations/promotion": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/operations/recruitment": EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS,
  "/dashboard/operations/payroll": PAYROLL_ROUTE_PERMISSION,
  "/dashboard/operations/reports": ATTENDANCE_REPORTS_ROUTE_PERMISSION,
  "/dashboard/operations/scheduled-reporting": SCHEDULED_REPORTING_ROUTE_PERMISSION,
  "/dashboard/operations/notifications": NOTIFICATIONS_ADMIN_ROUTE_PERMISSION,
  "/dashboard/performance": PERFORMANCE_ROUTE_PERMISSION,
  "/dashboard/performance/overview": PERFORMANCE_ROUTE_PERMISSION,
  "/dashboard/performance/setup": PERFORMANCE_SETUP_PERMISSION,
  "/dashboard/performance/plans": PERFORMANCE_PLANS_PERMISSION,
  "/dashboard/performance/reviews": PERFORMANCE_REVIEWS_PERMISSION,
  "/dashboard/performance/improvement": PERFORMANCE_IMPROVEMENT_PERMISSION,
  "/dashboard/probation": PROBATION_SECTION_PERMISSION,
  "/dashboard/probation/overview": PROBATION_ROUTE_PERMISSION,
  "/dashboard/probation/policies": PROBATION_POLICIES_PERMISSION,
  "/dashboard/probation/cases": PROBATION_CASES_PERMISSION,
  "/dashboard/probation/team": PROBATION_TEAM_PERMISSION,
  "/dashboard/field": FIELD_ROUTE_PERMISSION,
  "/dashboard/field/overview": FIELD_ROUTE_PERMISSION,
  "/dashboard/field/visits": FIELD_VISITS_PERMISSION,
  "/dashboard/field/map": FIELD_VISITS_PERMISSION,
  "/dashboard/field/parties": FIELD_PARTIES_PERMISSION,
  "/dashboard/field/setup": FIELD_PARTIES_PERMISSION,
  "/dashboard/finance": FINANCE_ROUTE_PERMISSION,
  "/dashboard/finance/overview": FINANCE_ROUTE_PERMISSION,
  "/dashboard/finance/products": FINANCE_PRODUCTS_PERMISSION,
  "/dashboard/finance/applications": FINANCE_ROUTE_PERMISSION,
  "/dashboard/finance/accounts": FINANCE_ACCOUNTS_PERMISSION,
  "/dashboard/finance/reports": FINANCE_ROUTE_PERMISSION,
  "/dashboard/activities": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/overview": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/reports": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/team": {
    permissions: ["work_activities:manager:read", "work_activities:manager:review"],
    mode: "any",
  },
  "/dashboard/activities/reviews": ACTIVITY_REVIEWS_PERMISSION,
  "/dashboard/activities/exceptions": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/setup": ACTIVITY_SETUP_PERMISSION,
  "/dashboard/movements": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/movements/overview": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/movements/cases": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/movements/operations": MOVEMENT_OPERATIONS_PERMISSION,
  "/dashboard/team/movements": MANAGER_ROUTE_PERMISSION,
  "/dashboard/sms": SMS_ROUTE_PERMISSION,
  "/dashboard/sms/overview": SMS_ROUTE_PERMISSION,
  "/dashboard/sms/registry": SMS_SETTINGS_READ_PERMISSION,
  "/dashboard/sms/logs": SMS_LOGS_READ_PERMISSION,
  "/dashboard/sms/platform": COMPANY_MANAGEMENT_ROUTE_PERMISSION,
  "/dashboard/smtp": SCHEDULED_REPORTING_SMTP_PERMISSION,
  "/dashboard/structure": STRUCTURE_ROUTE_PERMISSION,
  "/dashboard/structure/cost-centers": COST_CENTER_ROUTE_PERMISSION,
  "/dashboard/structure/grades": GRADE_ROUTE_PERMISSION,
  "/dashboard/structure/numbering": NUMBERING_ROUTE_PERMISSION,
  "/dashboard/insights": INSIGHTS_ROUTE_PERMISSION,
  "/dashboard/insights/hr": INSIGHTS_HR_PERMISSION,
  "/dashboard/insights/management": INSIGHTS_MANAGEMENT_PERMISSION,
  "/dashboard/insights/manager": INSIGHTS_MANAGER_PERMISSION,
  "/dashboard/insights/sales-field": INSIGHTS_SALES_FIELD_PERMISSION,
  "/dashboard/insights/readiness": INSIGHTS_READINESS_PERMISSION,
  "/dashboard/insights/identity-audit": INSIGHTS_IDENTITY_AUDIT_PERMISSION,
  "/dashboard/help": null,
  "/dashboard/users": {
    permissions: [
      "users:read",
      "users:create",
      "users:update",
      "company_users:read",
      "company_users:create",
    ],
    mode: "any",
  },
  "/dashboard/access-control": {
    permissions: [
      "attendance_devices:read",
      "access_doors:read",
      "access_schedule_templates:read",
      "access_organizations:read",
      "access_groups:read",
      "roles:read",
      "permissions:read",
    ],
    mode: "any",
  },
  "/dashboard/access-control/devices": "attendance_devices:read",
  "/dashboard/access-control/doors": "access_doors:read",
  "/dashboard/access-control/templates": "access_schedule_templates:read",
  "/dashboard/access-control/week-plans": {
    permissions: ["access_schedule_templates:read", "attendance_devices:read"],
    mode: "any",
  },
  "/dashboard/access-control/organizations": "access_organizations:read",
  "/dashboard/access-control/groups": "access_groups:read",
  "/dashboard/access-control/access-credentials": {
    permissions: [
      "access_credentials:read",
      "access_credentials:update",
      "employee_access_credentials:read",
      "attendance_devices:update",
    ],
    mode: "any",
  },
  "/dashboard/access-control/audit-logs": "attendance_devices:read",
  "/dashboard/access-control/device-command-logs": "attendance_devices:read",
  "/dashboard/access-control/hikvision-sync-logs": "attendance_devices:read",
  "/dashboard/access-control/roles": "roles:read",
  "/dashboard/access-control/permissions": "permissions:read",
  "/dashboard/roles": "roles:read",
  "/dashboard/permissions": "permissions:read",
  "/dashboard/settings": null,
  "/dashboard/settings/default-avatars": {
    permissions: [
      "view_company_data",
      "users:update",
      "employees:update",
      "employees:create",
    ],
    mode: "any",
  },
}

function decodeBase64Url(input: string) {
  try {
    if (typeof atob === "function") {
      const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
      return atob(padded)
    }
    return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  } catch {
    return null
  }
}

export function canonicalizePermissionLabel(label: string) {
  return label.trim().toLowerCase().replace(/\./g, ":")
}

function isGlobalBypassLabel(label: string) {
  return GLOBAL_BYPASS_LABELS.has(canonicalizePermissionLabel(label))
}

function permissionMatches(owned: string, required: string) {
  if (owned === required) {
    return true
  }
  if (isGlobalBypassLabel(owned)) {
    return true
  }
  if (owned.endsWith(":*")) {
    const resource = owned.slice(0, -2)
    return Boolean(resource) && (required === resource || required.startsWith(`${resource}:`))
  }
  return false
}

function looksLikePermissionLabel(label: string) {
  const normalized = canonicalizePermissionLabel(label)
  return (
    isGlobalBypassLabel(normalized) ||
    normalized.includes(":") ||
    normalized.startsWith("view_") ||
    normalized.startsWith("create_") ||
    normalized.startsWith("update_") ||
    normalized.startsWith("delete_") ||
    normalized.startsWith("manage_")
  )
}

export function normalizePermissionLabels(permissionLabels: string[]) {
  return Array.from(
    new Set(
      permissionLabels
        .map((label) => canonicalizePermissionLabel(label))
        .filter((label) => label.length > 0)
    )
  )
}

export function decodeJwtPayload(token: string) {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) {
    return null
  }

  const decoded = decodeBase64Url(parts[1])
  if (!decoded) {
    return null
  }

  try {
    return asRecord(JSON.parse(decoded))
  } catch {
    return null
  }
}

export function collectPermissionLabelsFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    const normalized = canonicalizePermissionLabel(value)
    if (looksLikePermissionLabel(normalized)) {
      sink.add(normalized)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectPermissionLabelsFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const direct = readString(record, [
    "name",
    "key",
    "code",
    "slug",
    "permission",
    "action",
  ])
  if (direct) {
    collectPermissionLabelsFromUnknown(direct, sink)
  }

  for (const key of [
    "permissions",
    "permission",
    "authorities",
    "scopes",
    "actions",
    "role_permissions",
    "rolePermissions",
    "granted_permissions",
    "grantedPermissions",
    "roles",
    "data",
    "items",
    "records",
    "results",
    "user",
    "profile",
    "meta",
  ]) {
    collectPermissionLabelsFromUnknown(record[key], sink)
  }
}

export function readPermissionLabelsFromUnknown(...sources: unknown[]) {
  const labels = new Set<string>()

  for (const source of sources) {
    if (!source) {
      continue
    }

    if (typeof source === "string" && source.includes(".")) {
      collectPermissionLabelsFromUnknown(decodeJwtPayload(source), labels)
      continue
    }

    collectPermissionLabelsFromUnknown(source, labels)
  }

  return normalizePermissionLabels(Array.from(labels))
}

function normalizeIdentityHint(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ")
}

function normalizeDashboardAccessMode(value: unknown): DashboardAccessMode | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === "admin" || normalized === "employee") {
    return normalized
  }

  return null
}

function normalizeDashboardScope(value: unknown): AuthScope | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized === "platform" || normalized === "company" ? normalized : null
}

function readDashboardScopeFromUnknown(value: unknown): AuthScope | null {
  if (!value) return null
  if (typeof value === "string") {
    return value.includes(".")
      ? readDashboardScopeFromUnknown(decodeJwtPayload(value))
      : normalizeDashboardScope(value)
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const scope = readDashboardScopeFromUnknown(entry)
      if (scope) return scope
    }
    return null
  }

  const record = asRecord(value)
  if (!record) return null
  const direct = normalizeDashboardScope(record.scope)
  if (direct) return direct

  for (const key of ["user", "profile", "data", "result", "tokens", "accessToken", "access_token", "token"]) {
    const scope = readDashboardScopeFromUnknown(record[key])
    if (scope) return scope
  }
  return null
}

function readDashboardScope(...sources: unknown[]): AuthScope | null {
  for (const source of sources) {
    const scope = readDashboardScopeFromUnknown(source)
    if (scope) return scope
  }
  return null
}

function readExplicitDashboardAccessModeFromUnknown(value: unknown): DashboardAccessMode | null {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    if (value.includes(".")) {
      return readExplicitDashboardAccessModeFromUnknown(decodeJwtPayload(value))
    }
    return normalizeDashboardAccessMode(value)
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = readExplicitDashboardAccessModeFromUnknown(entry)
      if (resolved) {
        return resolved
      }
    }

    return null
  }

  const record = asRecord(value)
  if (!record) {
    return null
  }

  const direct =
    normalizeDashboardAccessMode(record.dashboard_type) ??
    normalizeDashboardAccessMode(record.dashboardType) ??
    normalizeDashboardAccessMode(record.access_mode) ??
    normalizeDashboardAccessMode(record.accessMode)
  if (direct) {
    return direct
  }

  for (const key of [
    "user",
    "profile",
    "data",
    "result",
    "results",
    "tokens",
    "accessToken",
    "access_token",
    "token",
  ]) {
    const resolved = readExplicitDashboardAccessModeFromUnknown(record[key])
    if (resolved) {
      return resolved
    }
  }

  return null
}

function readExplicitDashboardAccessMode(...sources: unknown[]) {
  for (const source of sources) {
    const resolved = readExplicitDashboardAccessModeFromUnknown(source)
    if (resolved) {
      return resolved
    }
  }

  return null
}

function collectDashboardIdentityHintsFromUnknown(
  value: unknown,
  sink: Set<string>
) {
  if (typeof value === "string" && value.trim()) {
    sink.add(normalizeIdentityHint(value))
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectDashboardIdentityHintsFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const direct = readString(record, [
    "user_type",
    "userType",
    "role",
    "role_name",
    "roleName",
    "type",
    "account_type",
    "accountType",
  ])
  if (direct) {
    sink.add(normalizeIdentityHint(direct))
  }

  for (const key of ["user", "profile", "role", "roles", "data", "items", "results"]) {
    collectDashboardIdentityHintsFromUnknown(record[key], sink)
  }
}

function collectRoleNamesFromUnknown(value: unknown, sink: Set<string>) {
  if (typeof value === "string" && value.trim()) {
    const text = value.trim()
    if (!text.includes(":") && !text.startsWith("view_")) {
      sink.add(text)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectRoleNamesFromUnknown(entry, sink))
    return
  }

  const record = asRecord(value)
  if (!record) {
    return
  }

  const direct = readString(record, [
    "name",
    "display_name",
    "displayName",
    "title",
    "role_name",
    "roleName",
  ])
  if (direct && !direct.includes(":") && !direct.startsWith("view_")) {
    sink.add(direct)
  }

  for (const key of [
    "role",
    "roles",
    "user_roles",
    "userRoles",
    "assigned_roles",
    "assignedRoles",
  ]) {
    collectRoleNamesFromUnknown(record[key], sink)
  }

  for (const key of ["user", "profile", "data"]) {
    const nested = asRecord(record[key])
    if (nested) {
      collectRoleNamesFromUnknown(nested.role, sink)
      collectRoleNamesFromUnknown(nested.roles, sink)
    }
  }
}

export function readRoleNamesFromUnknown(...sources: unknown[]): string[] {
  const sink = new Set<string>()
  for (const source of sources) {
    if (!source) continue
    if (typeof source === "string" && source.includes(".")) {
      collectRoleNamesFromUnknown(decodeJwtPayload(source), sink)
      continue
    }
    collectRoleNamesFromUnknown(source, sink)
  }
  return Array.from(sink)
}

function readDashboardIdentityHintsFromUnknown(...sources: unknown[]) {
  const hints = new Set<string>()

  for (const source of sources) {
    if (!source) {
      continue
    }

    if (typeof source === "string" && source.includes(".")) {
      collectDashboardIdentityHintsFromUnknown(decodeJwtPayload(source), hints)
      continue
    }

    collectDashboardIdentityHintsFromUnknown(source, hints)
  }

  return hints
}

function resolvePermissionRequirement(
  requirement: PermissionRequirement | null | undefined
): { permissions: string[]; mode: PermissionMode } | null {
  if (!requirement) {
    return null
  }

  if (typeof requirement === "string") {
    return { permissions: [requirement], mode: "any" }
  }

  return {
    permissions: requirement.permissions,
    mode: requirement.mode ?? "any",
  }
}

export function hasPermission(
  permissionLabels: string[],
  requirement: PermissionRequirement | null | undefined
) {
  const resolved = resolvePermissionRequirement(requirement)
  if (!resolved || resolved.permissions.length === 0) {
    return true
  }

  const normalizedPermissions = normalizePermissionLabels(permissionLabels)
  if (normalizedPermissions.some(isGlobalBypassLabel)) {
    return true
  }

  if (normalizedPermissions.length === 0) {
    return false
  }

  const requiredPermissions = normalizePermissionLabels(resolved.permissions)
  if (requiredPermissions.length === 0) {
    return true
  }

  if (resolved.mode === "all") {
    return requiredPermissions.every((required) =>
      normalizedPermissions.some((owned) => permissionMatches(owned, required))
    )
  }

  return requiredPermissions.some((required) =>
    normalizedPermissions.some((owned) => permissionMatches(owned, required))
  )
}

function resolveRequiredPermissions(url: string) {
  const exactMatch = DASHBOARD_ROUTE_PERMISSIONS[url]
  if (exactMatch !== undefined) {
    return exactMatch
  }

  const matchedEntry = Object.entries(DASHBOARD_ROUTE_PERMISSIONS)
    .sort(([left], [right]) => right.length - left.length)
    .find(([route]) => route !== "/dashboard" && (url === route || url.startsWith(`${route}/`)))

  return matchedEntry?.[1]
}

export function canViewCompanyDashboard(permissionLabels: string[]) {
  return hasPermission(permissionLabels, COMPANY_DASHBOARD_SWITCH_PERMISSION)
}

export function hasPayrollAccess(permissionLabels: string[]) {
  if (hasPermission(permissionLabels, PAYROLL_ROUTE_PERMISSION)) {
    return true
  }
  return normalizePermissionLabels(permissionLabels).some((label) => {
    const compact = label.replace(/[.-]/g, "_")
    return (
      compact.startsWith("payroll") ||
      compact.includes("_payroll") ||
      compact.startsWith("view_payroll") ||
      compact.startsWith("manage_payroll")
    )
  })
}

function hasPrefixedAccess(
  permissionLabels: string[],
  requirement: PermissionRequirement,
  prefixes: string[],
) {
  if (hasPermission(permissionLabels, requirement)) {
    return true
  }
  return normalizePermissionLabels(permissionLabels).some((label) => {
    const compact = label.replace(/[.-]/g, "_")
    return prefixes.some(
      (prefix) =>
        compact === prefix ||
        compact.startsWith(`${prefix}:`) ||
        compact.startsWith(`${prefix}_`) ||
        compact.includes(`_${prefix}`),
    )
  })
}

export function hasPerformanceAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, PERFORMANCE_ROUTE_PERMISSION, [
    "performance",
    "view_performance",
    "manage_performance",
  ])
}

/** HR performance admin grants — not the generic performance:read employees may hold. */
const PERFORMANCE_ADMIN_SHELL_PERMISSION: PermissionRequirement = {
  permissions: [
    "performance:create",
    "performance:update",
    "manage_performance",
    "performance_years:read",
    "performance_periods:read",
    "performance_kpis:read",
    "performance_templates:read",
    "performance_plans:read",
    "performance_reviews:read",
    "performance_improvement_plans:read",
    "performance_appeals:read",
  ],
  mode: "any",
}

function hasHrPerformanceAdminAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, PERFORMANCE_ADMIN_SHELL_PERMISSION)
}

export function hasProbationAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, PROBATION_ROUTE_PERMISSION, [
    "probation",
    "view_probation",
    "manage_probation",
  ])
}

export function hasFieldAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, FIELD_ROUTE_PERMISSION, [
    "field",
    "field_visit",
    "field_party",
    "view_field",
    "manage_field",
  ])
}

export function hasFinanceAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, FINANCE_ROUTE_PERMISSION, [
    "finance",
    "employee_finance",
    "staff_loan",
    "salary_advance",
    "view_finance",
    "manage_finance",
  ])
}

export function hasActivitiesAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, ACTIVITY_ROUTE_PERMISSION, [
    "activities",
    "work_activit",
    "daily_activit",
    "activity_categor",
    "activity_polic",
    "view_activities",
    "manage_activities",
  ])
}

export function hasSmsAccess(permissionLabels: string[]) {
  if (hasPermission(permissionLabels, SMS_ROUTE_PERMISSION)) {
    return true
  }
  // "sms" is too short for hasPrefixedAccess — `*_sms` would treat OTP or
  // notification channel grants as company SMS admin.
  return normalizePermissionLabels(permissionLabels).some((label) => {
    const compact = label.replace(/[.-]/g, "_")
    return (
      compact === "sms" ||
      compact.startsWith("sms:") ||
      compact.startsWith("sms_") ||
      compact === "view_sms" ||
      compact === "manage_sms" ||
      compact.startsWith("view_sms_") ||
      compact.startsWith("manage_sms_")
    )
  })
}

export function hasCostCenterAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, COST_CENTER_ROUTE_PERMISSION, [
    "cost_center",
    "view_cost_center",
    "manage_cost_center",
  ])
}

export function hasGradeAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, GRADE_ROUTE_PERMISSION, [
    "employee_grade",
    "view_employee_grade",
    "manage_employee_grade",
  ])
}

export function hasNumberingAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, NUMBERING_ROUTE_PERMISSION, [
    "employee_numbering",
    "employee_number",
  ])
}

export function hasStructureAccess(permissionLabels: string[]) {
  return (
    hasCostCenterAccess(permissionLabels) ||
    hasGradeAccess(permissionLabels) ||
    hasNumberingAccess(permissionLabels)
  )
}

export function hasAnalyticsAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, ANALYTICS_ROUTE_PERMISSION, [
    "analytic",
    "view_analytic",
    "manage_analytic",
  ])
}

export function hasInsightsAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, INSIGHTS_ROUTE_PERMISSION, [
    "hr_dashboard",
    "view_hr_dashboard",
    "launch_readiness",
    "security_event",
  ])
}

export function hasMovementsAccess(permissionLabels: string[]) {
  return hasPrefixedAccess(permissionLabels, MOVEMENT_ROUTE_PERMISSION, [
    "employee_movement",
    "view_employee_movement",
    "manage_employee_movement",
  ])
}

function resolveDashboardRouteShellRequirement(url: string) {
  const exactMatch = DASHBOARD_ROUTE_SHELLS[url]
  if (exactMatch !== undefined) {
    return exactMatch
  }

  const matchedEntry = Object.entries(DASHBOARD_ROUTE_SHELLS)
    .sort(([left], [right]) => right.length - left.length)
    .find(([route]) => route !== "/dashboard" && (url === route || url.startsWith(`${route}/`)))

  return matchedEntry?.[1]
}

export function hasSmsPlatformAccess(permissionLabels: string[]) {
  return (
    hasSmsAccess(permissionLabels) &&
    hasPermission(permissionLabels, COMPANY_MANAGEMENT_ROUTE_PERMISSION)
  )
}

export function canAccessDashboardRoute(
  url: string,
  permissionLabels: string[],
  accessMode?: DashboardAccessMode
) {
  const path = url.split("?")[0] ?? url

  if (path === "/dashboard") {
    return true
  }

  const requiredShell = resolveDashboardRouteShellRequirement(path)
  if (requiredShell && accessMode && accessMode !== requiredShell) {
    const canRecoverStalePerformanceShell =
      requiredShell === "admin" &&
      path.startsWith("/dashboard/performance") &&
      canViewCompanyDashboard(permissionLabels)
    if (!canRecoverStalePerformanceShell) {
      return false
    }
  }

  if (path === "/dashboard/sms/platform" || path.startsWith("/dashboard/sms/platform/")) {
    return hasSmsPlatformAccess(permissionLabels)
  }

  if (path === "/dashboard/sms" || path.startsWith("/dashboard/sms/")) {
    return hasSmsAccess(permissionLabels)
  }

  const requirement = resolveRequiredPermissions(path)
  if (requirement === undefined) {
    return false
  }

  return hasPermission(permissionLabels, requirement)
}

export function canPerformPermission(
  permissionLabels: string[],
  requirement: PermissionRequirement
) {
  return hasPermission(permissionLabels, requirement)
}

export function hasAdminDashboardAccess(permissionLabels: string[]) {
  if (canViewCompanyDashboard(permissionLabels)) {
    return true
  }
  if (hasPermission(permissionLabels, COMPANY_MANAGEMENT_ROUTE_PERMISSION)) {
    return true
  }
  if (
    hasPayrollAccess(permissionLabels) ||
    hasHrPerformanceAdminAccess(permissionLabels) ||
    hasProbationAccess(permissionLabels) ||
    hasFieldAccess(permissionLabels) ||
    hasFinanceAccess(permissionLabels) ||
    hasActivitiesAccess(permissionLabels) ||
    hasMovementsAccess(permissionLabels) ||
    hasSmsAccess(permissionLabels) ||
    hasStructureAccess(permissionLabels) ||
    hasInsightsAccess(permissionLabels) ||
    hasAnalyticsAccess(permissionLabels) ||
    hasPermission(permissionLabels, MANAGER_ROUTE_PERMISSION) ||
    hasPermission(permissionLabels, SCHEDULED_REPORTING_ROUTE_PERMISSION) ||
    hasPermission(permissionLabels, NOTIFICATIONS_ADMIN_ROUTE_PERMISSION) ||
    hasPermission(permissionLabels, EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS)
  ) {
    return true
  }

  return ADMIN_DASHBOARD_LANDING_ROUTES.some((route) => {
    const requirement = resolveRequiredPermissions(route)
    return requirement != null && hasPermission(permissionLabels, requirement)
  })
}

function resolveDashboardActorIdentity(...sources: unknown[]): DashboardActorIdentityResolution {
  const explicitAccessMode = readExplicitDashboardAccessMode(...sources)
  const scope = readDashboardScope(...sources)
  const permissionLabels = readPermissionLabelsFromUnknown(...sources)
  const roleNames = readRoleNamesFromUnknown(...sources)
  const identityHints = readDashboardIdentityHintsFromUnknown(...sources)
  const hasExplicitAdminIdentity = Array.from(identityHints).some((hint) =>
    ADMIN_IDENTITY_HINTS.has(hint)
  )
  const hasExplicitEmployeeIdentity = Array.from(identityHints).some((hint) =>
    EMPLOYEE_IDENTITY_HINTS.has(hint)
  )
  const hasPermissionBasedAdminAccess = hasAdminDashboardAccess(permissionLabels)
  const hasAdminRole = roleNames.some(roleNameImpliesAdminShell)
  const accessMode: DashboardAccessMode =
    explicitAccessMode === "admin" ||
    (explicitAccessMode === "employee" && hasAdminRole && hasPermissionBasedAdminAccess)
      ? "admin"
      : explicitAccessMode === "employee"
        ? "employee"
        : hasExplicitAdminIdentity || hasAdminRole
          ? "admin"
          : "employee"

  return {
    permissionLabels,
    roleNames,
    scope,
    hasExplicitAdminIdentity: explicitAccessMode
      ? explicitAccessMode === "admin"
      : hasExplicitAdminIdentity,
    hasExplicitEmployeeIdentity: explicitAccessMode
      ? explicitAccessMode === "employee"
      : hasExplicitEmployeeIdentity,
    hasPermissionBasedAdminAccess,
    accessMode,
    isAdmin: accessMode === "admin",
  }
}

function writeCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === "undefined") {
    return
  }

  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"]
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    parts.push("Secure")
  }
  if (typeof maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`)
  }
  document.cookie = parts.join("; ")
}

function clearCookie(name: string) {
  writeCookie(name, "", 0)
}

export function buildDashboardActorSnapshotFromSources(
  ...sources: unknown[]
): DashboardActorSnapshot {
  const { permissionLabels, roleNames, scope, accessMode, isAdmin } =
    resolveDashboardActorIdentity(...sources)

  return {
    permissionLabels,
    roleNames,
    scope,
    accessMode,
    isAdmin,
    ready: true,
    version: Date.now(),
  }
}

export function publishDashboardActorSnapshot(snapshot: DashboardActorSnapshot) {
  if (typeof window === "undefined") {
    return
  }

  const previousPermissionsRaw = window.sessionStorage.getItem(
    DASHBOARD_PERMISSION_STORAGE_KEY,
  )
  const previousAccessMode = window.sessionStorage.getItem(
    DASHBOARD_ACCESS_MODE_STORAGE_KEY,
  )
  const previousScope = window.sessionStorage.getItem(DASHBOARD_SCOPE_STORAGE_KEY)
  let previousPermissions: string[] = []
  try {
    const parsed = previousPermissionsRaw ? JSON.parse(previousPermissionsRaw) : []
    previousPermissions = Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : []
  } catch {
    previousPermissions = []
  }

  const previousFingerprint = [
    previousAccessMode ?? "",
    previousScope ?? "",
    ...normalizePermissionLabels(previousPermissions).sort(),
  ].join("|")
  const nextFingerprint = [
    snapshot.accessMode,
    snapshot.scope ?? "",
    ...normalizePermissionLabels(snapshot.permissionLabels).sort(),
  ].join("|")
  const accessChanged = Boolean(previousPermissionsRaw) && previousFingerprint !== nextFingerprint

  dashboardActorVerifiedThisPage = true
  window.sessionStorage.setItem(
    DASHBOARD_PERMISSION_STORAGE_KEY,
    JSON.stringify(snapshot.permissionLabels)
  )
  window.sessionStorage.setItem(DASHBOARD_ACCESS_MODE_STORAGE_KEY, snapshot.accessMode)
  if (snapshot.scope) {
    window.sessionStorage.setItem(DASHBOARD_SCOPE_STORAGE_KEY, snapshot.scope)
  } else {
    window.sessionStorage.removeItem(DASHBOARD_SCOPE_STORAGE_KEY)
  }
  window.sessionStorage.setItem(DASHBOARD_IS_ADMIN_STORAGE_KEY, snapshot.isAdmin ? "1" : "0")
  window.sessionStorage.setItem(
    DASHBOARD_ROLES_STORAGE_KEY,
    JSON.stringify(snapshot.roleNames ?? []),
  )

  writeCookie(DASHBOARD_AUTH_COOKIE, "1")
  // Permission lists can exceed the 4KB browser cookie limit for admin/HR users.
  // Keep the authoritative live snapshot in sessionStorage and clear the legacy
  // cookie so browsers do not reject it on every dashboard refresh.
  clearCookie(DASHBOARD_PERMISSIONS_COOKIE)

  if (accessChanged) {
    // A denial learned under the old grant set must not survive a later grant,
    // and a platform confirmation must be re-probed after access changes.
    window.sessionStorage.removeItem(FORBIDDEN_ROUTES_STORAGE_KEY)
    window.sessionStorage.removeItem(CONFIRMED_PLATFORM_ROUTES_STORAGE_KEY)
    window.dispatchEvent(new Event(FORBIDDEN_ROUTES_EVENT))
  }

  window.dispatchEvent(
    new CustomEvent<DashboardActorSnapshot>(DASHBOARD_ACTOR_EVENT, {
      detail: snapshot,
    })
  )
}

export function publishDashboardActorSnapshotFromSources(...sources: unknown[]) {
  const snapshot = buildDashboardActorSnapshotFromSources(...sources)
  publishDashboardActorSnapshot(snapshot)
  return snapshot
}

export function clearDashboardActorSnapshot() {
  if (typeof window === "undefined") {
    return
  }

  dashboardActorVerifiedThisPage = false
  window.sessionStorage.removeItem(DASHBOARD_PERMISSION_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_ACCESS_MODE_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_IS_ADMIN_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_ROLES_STORAGE_KEY)
  window.sessionStorage.removeItem(DASHBOARD_SCOPE_STORAGE_KEY)
  clearPublishedCompanyModules()

  clearCookie(DASHBOARD_AUTH_COOKIE)
  clearCookie(DASHBOARD_TOKEN_COOKIE)
  clearCookie(DASHBOARD_PERMISSIONS_COOKIE)

  window.dispatchEvent(
    new CustomEvent<DashboardActorSnapshot>(DASHBOARD_ACTOR_EVENT, {
      detail: {
        permissionLabels: [],
        roleNames: [],
        scope: null,
        accessMode: "employee",
        isAdmin: false,
        ready: true,
        version: Date.now(),
      },
    })
  )
}

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return ""
  }

  const pattern = `${name}=`
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(pattern))

  if (!match) {
    return ""
  }

  return decodeURIComponent(match.slice(pattern.length))
}

function readDashboardActorBrowserSources() {
  if (typeof window === "undefined") {
    return [] as unknown[]
  }

  const localSources: unknown[] = []
  const hasActiveAuthSession =
    Boolean(window.localStorage.getItem(AUTH_STORAGE_KEYS.user)) ||
    Boolean(window.localStorage.getItem(AUTH_STORAGE_KEYS.tokens))

  const sourceKeys = hasActiveAuthSession
    ? [AUTH_STORAGE_KEYS.user, AUTH_STORAGE_KEYS.tokens]
    : [
        AUTH_STORAGE_KEYS.user,
        AUTH_STORAGE_KEYS.tokens,
        LEGACY_ADMIN_USER_STORAGE_KEY,
        "hrms.admin.accessToken",
      ]

  for (const key of sourceKeys) {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      continue
    }

    if (key === "hrms.admin.accessToken") {
      localSources.push(rawValue)
      continue
    }

    try {
      localSources.push(JSON.parse(rawValue))
    } catch {
      localSources.push(rawValue)
    }
  }

  const tokenCookie = readCookieValue(DASHBOARD_TOKEN_COOKIE)
  if (tokenCookie) {
    localSources.push(tokenCookie)
  }

  return localSources
}

export function readDashboardActorSnapshotFromBrowser(): DashboardActorSnapshot {
  if (typeof window === "undefined") {
    return {
      permissionLabels: [],
      roleNames: [],
      scope: null,
      accessMode: "employee",
      isAdmin: false,
      ready: false,
      version: 0,
    }
  }

  const rawPermissions = window.sessionStorage.getItem(DASHBOARD_PERMISSION_STORAGE_KEY)
  if (rawPermissions) {
    try {
      const parsed = JSON.parse(rawPermissions) as unknown
      const permissionLabels = normalizePermissionLabels(
        Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : []
      )
      const derivedSnapshot = buildDashboardActorSnapshotFromSources(
        ...readDashboardActorBrowserSources()
      )
      const storedAccessMode = window.sessionStorage.getItem(
        DASHBOARD_ACCESS_MODE_STORAGE_KEY,
      )
      const storedScope = window.sessionStorage.getItem(DASHBOARD_SCOPE_STORAGE_KEY)
      const accessMode: DashboardAccessMode =
        storedAccessMode === "admin" || storedAccessMode === "employee"
          ? storedAccessMode
          : derivedSnapshot.accessMode
      const rawRoleNames = window.sessionStorage.getItem(DASHBOARD_ROLES_STORAGE_KEY)
      let roleNames = derivedSnapshot.roleNames
      try {
        const parsedRoleNames = rawRoleNames ? JSON.parse(rawRoleNames) : []
        if (Array.isArray(parsedRoleNames)) {
          roleNames = parsedRoleNames.filter(
            (entry): entry is string => typeof entry === "string",
          )
        }
      } catch {
        // Fall back to identity hints when stored roles are malformed.
      }
      return {
        // An empty list is a valid, authoritative revocation result. Never
        // refill it from a stale local user record or JWT.
        permissionLabels,
        roleNames,
        scope:
          storedScope === "platform" || storedScope === "company"
            ? storedScope
            : derivedSnapshot.scope,
        accessMode,
        isAdmin: accessMode === "admin",
        ready: dashboardActorVerifiedThisPage,
        version: Date.now(),
      }
    } catch {
      // Fall through to storage/cookie sources.
    }
  }

  const snapshot = buildDashboardActorSnapshotFromSources(...readDashboardActorBrowserSources())
  return {
    ...snapshot,
    ready: dashboardActorVerifiedThisPage,
  }
}

export function readDashboardPermissionLabelsFromBrowser() {
  return readDashboardActorSnapshotFromBrowser().permissionLabels
}

export function getDashboardAccessModeFromBrowser(): DashboardAccessMode {
  return readDashboardActorSnapshotFromBrowser().accessMode
}

export function hasDashboardAdminIdentity() {
  return readDashboardActorSnapshotFromBrowser().isAdmin
}

export function persistDashboardAccessToken(token: string) {
  if (typeof window === "undefined") {
    return
  }

  if (!token.trim()) {
    clearCookie(DASHBOARD_TOKEN_COOKIE)
    clearCookie(DASHBOARD_AUTH_COOKIE)
    return
  }

  writeCookie(DASHBOARD_AUTH_COOKIE, "1")
  writeCookie(DASHBOARD_TOKEN_COOKIE, token.trim())
}

export function publishDashboardActorSnapshotFromBrowserStorage(...sources: unknown[]) {
  const snapshot = buildDashboardActorSnapshotFromSources(
    ...readDashboardActorBrowserSources(),
    ...sources
  )
  publishDashboardActorSnapshot(snapshot)
  return snapshot
}

export function requestDashboardAccessRefresh() {
  if (typeof window === "undefined") {
    return
  }
  window.dispatchEvent(new Event(DASHBOARD_ACCESS_REFRESH_EVENT))
}

export function subscribeToDashboardActorSnapshot(
  listener: () => void
) {
  if (typeof window === "undefined") {
    return () => undefined
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      !event.key ||
      [
        AUTH_STORAGE_KEYS.tokens,
        AUTH_STORAGE_KEYS.user,
        "hrms.admin.accessToken",
        LEGACY_ADMIN_USER_STORAGE_KEY,
        DASHBOARD_PERMISSION_STORAGE_KEY,
        DASHBOARD_ACCESS_MODE_STORAGE_KEY,
        DASHBOARD_IS_ADMIN_STORAGE_KEY,
        DASHBOARD_SCOPE_STORAGE_KEY,
      ].includes(event.key)
    ) {
      listener()
    }
  }

  window.addEventListener(DASHBOARD_ACTOR_EVENT, listener)
  window.addEventListener("storage", handleStorage)

  return () => {
    window.removeEventListener(DASHBOARD_ACTOR_EVENT, listener)
    window.removeEventListener("storage", handleStorage)
  }
}
