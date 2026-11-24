import { AUTH_STORAGE_KEYS } from "@/utils/constants"
import { clearPublishedCompanyModules } from "@/lib/company-modules"
import { reportsEnabled } from "@/lib/kpi-session"
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

const COMPANY_DASHBOARD_SWITCH_PERMISSION = "company_dashboard:read"

/**
 * Company-wide overview (HR analytics on `/dashboard`).
 * Driven only by permission labels from the API — not role name hardcoding.
 * Aligns with other company-level routes that already use `company_data:read`.
 */
export const COMPANY_DASHBOARD_PERMISSION: PermissionRequirement = {
  permissions: [
    "company_dashboard:read",
    "company_data:read",
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
    "payroll_reports:read",

    // Labels seeded by the backend (001-permissions.seed.ts) and enforced by
    // /api/payroll/*. `payroll:payslips-self` is self-service and stays out.
    "payroll:config",
    "payroll:config-read",
    "payroll:profiles",
    "payroll:profiles-read",
    "payroll:periods",
    "payroll:periods-read",
    "payroll:inputs",
    "payroll:inputs-read",
    "payroll:inputs-approve",
    "payroll:runs",
    "payroll:runs-read",
    "payroll:runs-process",
    "payroll:runs-approve",
    "payroll:runs-lock",
    "payroll:runs-cancel",
    "payroll:runs-reverse",
    "payroll:payments-confirm",
    "payroll:runs-close",
    "payroll:payslips",
    "payroll:payslips-read",
    "payroll:banking",
    "payroll:accounting",
    "payroll:reports",
    "payroll:final-settlements",
  ],
  mode: "any",
}

export const EMPLOYMENT_CONTRACT_READ_PERMISSION: PermissionRequirement = {
  permissions: ["employment_contracts:read", "employment_contracts:manage"],
  mode: "any",
}

export const EMPLOYMENT_CONTRACT_MANAGE_PERMISSION = "employment_contracts:manage"

/**
 * HR Probation (`/dashboard/probation/*`).
 * Company dashboard access is not enough — /api/probation/* is its own grant.
 */

export const PROBATION_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: ["probation_cases:read", "probation_cases:read-team", "manager:read", "manager_team:read", "manager_self_service:read"],
  mode: "any",
}

export const PROBATION_POLICIES_PERMISSION: PermissionRequirement = {
  permissions: ["probation_policies:read", "probation_policies:create"],
  mode: "any",
}

export const PROBATION_CASES_PERMISSION: PermissionRequirement = {
  permissions: ["probation_cases:read", "probation_cases:read-team", "manager:read", "manager_team:read", "manager_self_service:read"],
  mode: "any",
}

export const PROBATION_TEAM_PERMISSION: PermissionRequirement = {
  permissions: ["probation_cases:read-team", "manager:read", "manager_team:read", "manager_self_service:read", "probation_reviews:manager-review", "probation_reviews:manager-review-any"],
  mode: "any",
}

export const PROBATION_SECTION_PERMISSION: PermissionRequirement = {
  permissions: ["probation_policies:read", "probation_policies:create", "probation_cases:read", "probation_letters:generate", "probation_reviews:manager-review", "probation_reviews:manager-review-any", "probation_cases:read-team", "manager:read", "manager_team:read", "manager_self_service:read"],
  mode: "any",
}

/**
 * Field operations (`/dashboard/field/*`).
 * Shown when the actor has a field / work-activity grant — not by HR identity.
 */

export const FIELD_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: ["field_visits:hr-read", "field_visits:manager-read", "field_visits:manager-review", "field_visits:config", "field_locations:read", "field_reports:read"],
  mode: "any",
}

export const FIELD_VISITS_PERMISSION: PermissionRequirement = {
  permissions: ["field_visits:hr-read", "field_visits:manager-read", "field_visits:manager-review"],
  mode: "any",
}

export const FIELD_PARTIES_PERMISSION: PermissionRequirement = {
  permissions: ["field_visits:config"],
  mode: "any",
}

/**
 * Employee finance operations (`/dashboard/finance/*`).
 * Shown when the actor has a finance / loan / advance grant — not by HR identity.
 */

export const FINANCE_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    // Labels seeded by the backend and enforced by /api/employee-finance/*.
    // `employee_finance:applications-self` is self-service and stays out.
    "employee_finance:products",
    "employee_finance:products-read",
    "employee_finance:applications-read",
    "employee_finance:applications-manager-review",
    "employee_finance:applications-hr-approve",
    "employee_finance:applications-finance-approve",
    "employee_finance:accounts-read",
    "employee_finance:disbursements",
    "employee_finance:disbursements-approve",
    "employee_finance:repayments",
    "employee_finance:repayments-approve",
    "employee_finance:payroll",
    "employee_finance:settlements",
    "employee_finance:reports",
    "employee_finance:reconciliation",
    "employee_finance:applications-management-approve",
    "employee_finance:settlements-approve",
    "employee_finance:adjustments",
    "employee_finance:adjustments-approve",
    "employee_finance:templates",
    "employee_finance:integrations",
    "employee_finance:migration",
  ],
  mode: "any",
}

/** Deferment, reschedule, adjustment, and exit-recovery queues. */
export const FINANCE_SERVICING_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_finance:settlements",
    "employee_finance:settlements-approve",
    "employee_finance:adjustments",
    "employee_finance:adjustments-approve",
    "employee_finance:reconciliation",
  ],
  mode: "any",
}

export const FINANCE_PAYROLL_PERMISSION: PermissionRequirement = {
  permissions: ["employee_finance:payroll"],
  mode: "any",
}

/** Bank and ERP connections, journal and payment files, and loan migration. */
export const FINANCE_INTEGRATIONS_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_finance:integrations",
    "employee_finance:migration",
  ],
  mode: "any",
}

/** Sanction letter template and approval delegations. */
export const FINANCE_SETTINGS_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_finance:templates",
    "employee_finance:delegations",
  ],
  mode: "any",
}

export const FINANCE_PRODUCTS_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_finance:products",
    "employee_finance:products-read",
  ],
  mode: "any",
}

export const FINANCE_ACCOUNTS_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_finance:accounts-read",
    "employee_finance:disbursements",
    "employee_finance:disbursements-approve",
    "employee_finance:repayments",
    "employee_finance:repayments-approve",
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

  "work_activities:manager-read",
  "work_activities:manager-review",
  "work_activities:hr-read",
  "work_activities:config",
]

export const ACTIVITY_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...ACTIVITY_MODULE_WIDE,
  ],
  mode: "any",
}

export const ACTIVITY_REVIEWS_PERMISSION: PermissionRequirement = {
  permissions: ["work_activities:manager-review"],
  mode: "any",
}

export const ACTIVITY_SETUP_PERMISSION: PermissionRequirement = {
  permissions: [
    "work_activities:config",
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
]

export const MOVEMENT_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    ...MOVEMENT_MODULE_WIDE,
    "employee_movements:approve",
  ],
  mode: "any",
}

export const MOVEMENT_OPERATIONS_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_movements:approve",
    "employee_movements:apply",
  ],
  mode: "any",
}

const SMS_SETTINGS_READ_LABELS = [
  "sms:settings-read",
]

const SMS_SETTINGS_UPDATE_LABELS = [
  "sms:settings-update",
]

const SMS_LOGS_READ_LABELS = [
  "sms:logs-read",
]

const SMS_LOGS_RETRY_LABELS = [
  "sms:logs-retry",
]

const SMS_TEST_LABELS = [
  "sms:test",
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
]

const GRADE_PERMISSIONS = [
  "employee_grades:read",
  "employee_grades:create",
  "employee_grades:update",
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
  ],
  mode: "any",
}

/**
 * HR / management dashboards (`/dashboard/insights/*`).
 * Company dashboard access is not enough — /api/dashboards/* is its own grant.
 */
export const ANALYTICS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: ["analytics:audit-read", "analytics:dashboards-hr", "analytics:dashboards-management", "analytics:dashboards-manager", "analytics:dashboards-sales-field", "analytics:datasets-read", "analytics:exports", "analytics:location", "analytics:metrics-read", "analytics:reconciliation", "analytics:refresh", "analytics:reports", "analytics:sensitive", "analytics:sources-read", "analytics:statutory-reports"],
  mode: "any",
}

export const INSIGHTS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: ["analytics:dashboards-hr", "analytics:dashboards-management", "analytics:dashboards-manager", "analytics:dashboards-sales-field", "hrms_launch_readiness:read", "identity_audit:read"],
  mode: "any",
}

export const INSIGHTS_HR_PERMISSION: PermissionRequirement = {
  permissions: ["analytics:dashboards-hr"],
  mode: "any",
}

export const INSIGHTS_MANAGEMENT_PERMISSION: PermissionRequirement = {
  permissions: ["analytics:dashboards-management"],
  mode: "any",
}

export const INSIGHTS_MANAGER_PERMISSION: PermissionRequirement = {
  permissions: [
    "manager_self_service:read",
    "analytics:dashboards-manager",
  ],
  mode: "any",
}

export const INSIGHTS_READINESS_PERMISSION: PermissionRequirement = {
  permissions: ["hrms_launch_readiness:read"],
  mode: "any",
}

export const INSIGHTS_IDENTITY_AUDIT_PERMISSION: PermissionRequirement = {
  permissions: ["identity_audit:read"],
  mode: "any",
}

export const INSIGHTS_SALES_FIELD_PERMISSION: PermissionRequirement = {
  permissions: ["analytics:dashboards-sales-field"],
  mode: "any",
}

export const NUMBERING_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "employee_numbering:read",
    "employee_numbering:update",
  ],
  mode: "any",
}

export const MANAGER_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "manager:read",
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
    "notifications:settings-read",
    "notifications:settings-update",
    "notifications:mail-logs-read",
    "notifications:mail-logs-retry",
  ],
  mode: "any",
}

export const ATTENDANCE_REPORTS_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: [
    "reports:read",
    "reports:export",
    "custom_reports:create",
    "custom_reports:manage",
    "employee_reports:read",
    "attendance_reports:read",
    "leave_reports:read",
    "field_reports:read",
    "activity_reports:read",
    "payroll_reports:read",
    "loan_reports:read",
    "analytics:reports",
    "analytics:exports",
    "analytics:dashboards-hr",
    "attendance_summaries:read",
    "attendance_processing:read",
    "company_data:read",
  ],
  mode: "any",
}

/**
 * Platform tenant registry at `/dashboard/companies`.
 * `company_users:*` is company-scoped membership and must not unlock this
 * page — those users get "Platform access is required" from GET /api/companies.
 */
export const COMPANY_MANAGEMENT_ROUTE_PERMISSION: PermissionRequirement = {
  permissions: ["companies:read", "companies:update",  ],
  mode: "any",
}

/**
 * Attendance correction and profile update review queues. HR holds
 * approve/final_approve; line and department managers hold manager_review and
 * only ever see their own team (enforced by the API).
 */
export const SELF_SERVICE_REVIEW_ROUTE_PERMISSION = {
  permissions: [
    "self_service_requests:approve",
    "self_service_requests:manager_review",
    "self_service_requests:final_approve",
  ],
  mode: "any",
} satisfies PermissionRequirement

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

const DASHBOARD_ROUTE_SHELLS: Record<string, DashboardAccessMode | null> = {
  // This is the admin-shell overview surface, not a generic feature route.
  "/dashboard/company-overview": "admin",
  "/dashboard/probation": "admin",
  "/dashboard/probation/team": null,
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
    "company_accounts:create",
  ],
  mode: "any",
}

/** Permissions that allow an administrator or HR user to register another employee. */
export const EMPLOYEE_REGISTRATION_PERMISSION = {
  permissions: [
    "employees:create",
    "company_users:create",
    "users:create",
    "company_accounts:create",
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
    "employee_access_credentials:read",
    "attendance_devices:update",
  ],
  mode: "any",
}

export const DASHBOARD_ROUTE_PERMISSIONS: Record<string, PermissionRequirement | null> = {
  "/dashboard/me/kpi": null,
  "/dashboard/me/scorecards": null,
  "/dashboard/me/evaluations": null,
  "/dashboard/kpi": { permissions: ["kpi_assignments:read", "kpi_definitions:create"], mode: "any" },
  "/dashboard/me/profile": null,
  "/dashboard/me/organization": null,
  "/dashboard/me/promotion": null,
  "/dashboard/me/payroll": null,
  "/dashboard/me/finance/payroll": null,
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
  "/dashboard/me/team/attendance": "team_attendance:read",
  "/dashboard/me/team/activity-summary": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/team/actions": MANAGER_ROUTE_PERMISSION,
  "/dashboard/me/insights": null,
  "/dashboard/me/team/recommendations": "manager_recommendations:submit",
  "/dashboard/to-do": null,
  "/dashboard/to-do/recommendations": "manager_recommendations:review",
  "/dashboard/forms-feedback": null,
  "/dashboard/me/requests": null,
  "/dashboard/me/requests/actions": null,
  "/dashboard/me/requests/timeline": null,
  "/dashboard/me/requests/documents": null,
  "/dashboard/me/requests/profile-changes": null,
  "/dashboard/me/requests/resignation": null,
  "/dashboard/me/onboarding": null,
  "/dashboard/me/offboarding": null,
  "/dashboard/me/contracts": null,
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
  "/dashboard/attendance/work-from-home-requests": null,
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
      "company_accounts:create",
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
  "/dashboard/employees/invite": "employees:create",
  "/dashboard/employees/contracts": EMPLOYMENT_CONTRACT_READ_PERMISSION,
  "/dashboard/employees/salary-approvals": {
    permissions: ["payroll:salary-approve", "payroll:profiles-read"],
    mode: "any",
  },
  "/dashboard/employees/offboarding": {
    permissions: ["offboarding_requests:read", "offboarding_workflows:read"],
    mode: "any",
  },
  "/dashboard/employees/onboarding": {
    // This is the company-wide HR workspace. Ordinary employees also receive
    // onboarding_requests:read for their own checklist, so that permission is
    // deliberately insufficient for invitation and company request data.
    permissions: [
      COMPANY_DASHBOARD_SWITCH_PERMISSION,
      "employees:create",
      "onboarding_workflows:read",
      "onboarding_requests:create",
      "onboarding_requests:approve",
      "onboarding_requests:complete",
    ],
    mode: "any",
  },
  // Other employees' profiles — not self profile under /dashboard/me/profile.
  "/dashboard/employees/profile": EMPLOYEE_DIRECTORY_ROUTE_PERMISSION,
  "/dashboard/employees/profile/": EMPLOYEE_DIRECTORY_ROUTE_PERMISSION,
  "/dashboard/employees/profile-update-approvals": SELF_SERVICE_REVIEW_ROUTE_PERMISSION,
  // Backed by /api/hr/profile-change-requests (profile_change_request:view_all).
  "/dashboard/employees/profile-change-requests": "profile_change_request:view_all",
  "/dashboard/attendance": ATTENDANCE_ROUTE_PERMISSIONS,
  "/dashboard/attendance/business-trips": ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION,
  "/dashboard/attendance/biometric-access": {
    permissions: [
      "employee_access_credentials:read",
      "attendance_devices:update",
    ],
    mode: "any",
  },
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
  "/dashboard/attendance/exemptions": "attendance_summaries:read",
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
  "/dashboard/attendance/correction-requests": SELF_SERVICE_REVIEW_ROUTE_PERMISSION,
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
      "leave_requests:approve",
      "leave_balances:read",
      "leave_balances:list",
      "leave_balances:manage",
      "leave_balances:export",
      "leave_balances:import",
      "leave_balances:read-import-history",
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
  "/dashboard/leave-management/team-calendar": {
    permissions: ["leave_requests:read", "leave_requests:approve"],
    mode: "any",
  },
  "/dashboard/leave-management/balances": {
    // Matches GET /leave/balances{,/transactions} (leave_balances:list).
    permissions: ["leave_balances:list", "leave_balances:manage"],
    mode: "any",
  },
  "/dashboard/leave-management/transactions": {
    // Matches GET /leave/balances{,/transactions} (leave_balances:list).
    permissions: ["leave_balances:list", "leave_balances:manage"],
    mode: "any",
  },
  "/dashboard/leave-management/balance-import": {
    permissions: [
      "leave_balances:export",
      "leave_balances:import",
      "leave_balances:read-import-history",
    ],
    mode: "any",
  },
  // Same set as backend leave-reports.controller (PermissionsAny).
  "/dashboard/leave-management/reports": {
    permissions: ["leave_reports:read", "leave_balances:list", "leave_balances:export", "leave_requests:approve"],
    mode: "any",
  },
  "/dashboard/leave-management/business-trips": ATTENDANCE_BUSINESS_TRIPS_ROUTE_PERMISSION,
  "/dashboard/leave-management/holidays": {
    permissions: ["holidays:read", "attendance_holidays:read"],
    mode: "any",
  },
  "/dashboard/leave-management/policies": "leave_policies:read",
  "/dashboard/leave-management/workflows": "leave_workflows:read",
  "/dashboard/leave-management/rollover": "leave_rollover:read",
  "/dashboard/leave-management/operations": "leave_operations:read",
  "/dashboard/leave-management/statutory": "leave_statutory:read",
  "/dashboard/leave-management/payroll-integration": {
    permissions: [
      "leave_balances:manage",
      "leave_balances:adjust-manually",
      "leave_encashment:finance_confirm",
    ],
    mode: "any",
  },
  // Any shell restriction is handled separately so this remains the permission source of truth.
  "/dashboard/company-overview": COMPANY_DASHBOARD_PERMISSION,
  "/dashboard/operations/promotion": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/operations/recruitment": EMPLOYEE_DIRECTORY_MANAGE_PERMISSIONS,
  "/dashboard/operations/payroll": PAYROLL_ROUTE_PERMISSION,
  "/dashboard/operations/reports": ATTENDANCE_REPORTS_ROUTE_PERMISSION,
  "/dashboard/operations/scheduled-reporting": SCHEDULED_REPORTING_ROUTE_PERMISSION,
  "/dashboard/operations/notifications": NOTIFICATIONS_ADMIN_ROUTE_PERMISSION,
  "/dashboard/probation": PROBATION_SECTION_PERMISSION,
  "/dashboard/probation/overview": PROBATION_ROUTE_PERMISSION,
  "/dashboard/probation/policies": PROBATION_POLICIES_PERMISSION,
  "/dashboard/probation/letter-templates": "probation_letters:generate",
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
  "/dashboard/finance/servicing": FINANCE_SERVICING_PERMISSION,
  "/dashboard/finance/payroll": FINANCE_PAYROLL_PERMISSION,
  "/dashboard/finance/settings": FINANCE_SETTINGS_PERMISSION,
  "/dashboard/finance/integrations": FINANCE_INTEGRATIONS_PERMISSION,
  "/dashboard/activities": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/overview": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/reports": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/team": {
    permissions: ["work_activities:manager-read", "work_activities:manager-review"],
    mode: "any",
  },
  "/dashboard/activities/reviews": ACTIVITY_REVIEWS_PERMISSION,
  "/dashboard/activities/exceptions": ACTIVITY_ROUTE_PERMISSION,
  "/dashboard/activities/setup": ACTIVITY_SETUP_PERMISSION,
  "/dashboard/movements": { permissions: [...MOVEMENT_ROUTE_PERMISSION.permissions, "employee_movements:manage-settings"], mode: "any" },
  "/dashboard/movements/settings": { permissions: ["employee_movements:manage-settings"], mode: "any" },
  "/dashboard/movements/overview": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/movements/cases": MOVEMENT_ROUTE_PERMISSION,
  "/dashboard/movements/operations": MOVEMENT_OPERATIONS_PERMISSION,
  "/dashboard/team/movements": { permissions: ["manager_team:read", "manager_self_service:read", "manager:read"], mode: "any" },
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
  "/dashboard/users": "users:read",
  "/dashboard/access-control": {
    permissions: [
      "users:read",
      "access_control_sync:execute",
      "attendance_devices:read",
      "access_doors:read",
      "access_schedule_templates:read",
      "access_week_plans:read",
      "employee_access_credentials:read",
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
  "/dashboard/access-control/week-plans": "access_week_plans:read",
  "/dashboard/access-control/organizations": "access_organizations:read",
  "/dashboard/access-control/groups": "access_groups:read",
  "/dashboard/access-control/access-credentials": "employee_access_credentials:read",
  "/dashboard/access-control/audit-logs": "access_control_sync:execute",
  "/dashboard/access-control/device-command-logs": "access_control_sync:execute",
  "/dashboard/access-control/hikvision-sync-logs": "access_control_sync:execute",
  "/dashboard/access-control/roles": "roles:read",
  "/dashboard/access-control/permissions": "permissions:read",
  "/dashboard/roles": "roles:read",
  "/dashboard/permissions": "permissions:read",
  "/dashboard/settings": null,
  "/dashboard/settings/banks": "employees:update",
  "/dashboard/settings/default-avatars": {
    permissions: [
      "company_data:read",
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
  return label.trim()
}

function looksLikePermissionLabel(value: string) {
  return /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/.test(value)
}

export function normalizePermissionLabels(permissionLabels: string[]) {
  return Array.from(
    new Set(
      permissionLabels
        .map((label) => canonicalizePermissionLabel(label))
        .filter(looksLikePermissionLabel)
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
  if (!resolved) return true
  if (!resolved.permissions.length) return false

  const normalizedPermissions = normalizePermissionLabels(permissionLabels)

  if (normalizedPermissions.length === 0) {
    return false
  }

  const requiredPermissions = normalizePermissionLabels(resolved.permissions)
  if (requiredPermissions.length === 0) {
    return false
  }

  if (resolved.mode === "all") {
    return requiredPermissions.every((required) =>
      normalizedPermissions.includes(required)
    )
  }

  return requiredPermissions.some((required) =>
    normalizedPermissions.includes(required)
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
  return hasPermission(permissionLabels, PAYROLL_ROUTE_PERMISSION)
}

export function hasProbationAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, PROBATION_ROUTE_PERMISSION)
}

export function hasFieldAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, FIELD_ROUTE_PERMISSION)
}

export function hasFinanceAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, FINANCE_ROUTE_PERMISSION)
}

export function hasActivitiesAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, ACTIVITY_ROUTE_PERMISSION)
}

export function hasSmsAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, SMS_ROUTE_PERMISSION)
}

export function hasCostCenterAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, COST_CENTER_ROUTE_PERMISSION)
}

export function hasGradeAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, GRADE_ROUTE_PERMISSION)
}

export function hasNumberingAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, NUMBERING_ROUTE_PERMISSION)
}

export function hasStructureAccess(permissionLabels: string[]) {
  return (
    hasCostCenterAccess(permissionLabels) ||
    hasGradeAccess(permissionLabels) ||
    hasNumberingAccess(permissionLabels)
  )
}

export function hasAnalyticsAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, ANALYTICS_ROUTE_PERMISSION)
}

export function hasInsightsAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, INSIGHTS_ROUTE_PERMISSION)
}

export function hasMovementsAccess(permissionLabels: string[]) {
  return hasPermission(permissionLabels, MOVEMENT_ROUTE_PERMISSION)
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

  // Broad legacy read permissions also support personal screens. They must not
  // expose operational workspaces to users whose data scope is self only.
  const normalizedLabels = normalizePermissionLabels(permissionLabels)
  const selfOnly = normalizedLabels.includes("data_scope:self") &&
    !["data_scope:company", "data_scope:branch", "data_scope:department", "data_scope:team"].some((scope) => normalizedLabels.includes(scope))
  // The shared Reports page also hosts personal KPI reports. Self-scoped
  // employees may enter it, while the page keeps operational data out of view.
  if (path === "/dashboard/operations/reports" && selfOnly && reportsEnabled) return true
  const personalAttendance = ["today", "punch-action", "attendance-history", "schedule-preview", "corrections", "work-from-home-requests"]
  if (selfOnly && (path === "/dashboard/employees" || path.startsWith("/dashboard/employees/") || path === "/dashboard/leave-management" || path.startsWith("/dashboard/leave-management/") || path === "/dashboard/operations" || path.startsWith("/dashboard/operations/") || (path.startsWith("/dashboard/attendance/") && !personalAttendance.some((part) => path === `/dashboard/attendance/${part}` || path.startsWith(`/dashboard/attendance/${part}/`))))) {
    return false
  }

  const requiredShell = resolveDashboardRouteShellRequirement(path)
  if (requiredShell && accessMode && accessMode !== requiredShell) {
    return false
  }

  if (path === "/dashboard/sms/platform" || path.startsWith("/dashboard/sms/platform/")) {
    return hasSmsPlatformAccess(permissionLabels)
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
