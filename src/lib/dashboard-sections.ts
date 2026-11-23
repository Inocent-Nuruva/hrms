import {
  canAccessDashboardRoute,
  type DashboardAccessMode,
} from "@/lib/dashboard-permissions";

export type DashboardSectionTab = {
  title: string;
  url: string;
};

export type DashboardSectionTabGroup = {
  title?: string;
  items: DashboardSectionTab[];
};

const employeeOperationsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Employee management",
    items: [
      { title: "All Employees", url: "/dashboard/employees/all" },
      { title: "Inactive Employees", url: "/dashboard/employees/inactive" },
      {
        title: "Profile Updates",
        url: "/dashboard/employees/profile-update-approvals",
      },
      {
        title: "Profile Changes",
        url: "/dashboard/employees/profile-change-requests",
      },
      { title: "Offboarding", url: "/dashboard/employees/offboarding" },
    ],
  },
  {
    title: "Joining & onboarding",
    items: [
      { title: "Invite", url: "/dashboard/employees/invite" },
      { title: "Registration", url: "/dashboard/employees/registration" },
      { title: "Onboarding", url: "/dashboard/employees/onboarding" },
      { title: "Contracts", url: "/dashboard/employees/contracts" },
      {
        title: "Salary approvals",
        url: "/dashboard/employees/salary-approvals",
      },
      { title: "Recruitment", url: "/dashboard/operations/recruitment" },
    ],
  },
];

export const employeeSelfSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My employee workspace",
    items: [
      { title: "Profile", url: "/dashboard/me/profile" },
      {
        title: "Location privacy notice",
        url: "/dashboard/me/location-privacy",
      },
      { title: "Organization", url: "/dashboard/me/organization" },
      { title: "History", url: "/dashboard/me/requests/timeline" },
      { title: "Documents", url: "/dashboard/me/requests/documents" },
      {
        title: "Update details",
        url: "/dashboard/me/requests/profile-changes",
      },
      { title: "Resignation", url: "/dashboard/me/requests/resignation" },
      { title: "Onboarding", url: "/dashboard/me/onboarding" },
      { title: "Offboarding", url: "/dashboard/me/offboarding" },
      { title: "My contracts", url: "/dashboard/me/contracts" },
      { title: "Team overview", url: "/dashboard/me/team/overview" },
      { title: "Team members", url: "/dashboard/me/team/members" },
      { title: "Team attendance", url: "/dashboard/me/team/attendance" },
      { title: "Team actions", url: "/dashboard/me/team/actions" },
    ],
  },
];

export const employeeSectionTabGroups: DashboardSectionTabGroup[] = [
  ...employeeSelfSectionTabGroups,
  ...employeeOperationsSectionTabGroups,
];

export const attendanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Biometric Access",
    items: [
      {
        title: "Biometric Access",
        url: "/dashboard/attendance/biometric-access",
      },
    ],
  },
  {
    title: "Attendance Operations",
    items: [
      {
        title: "Daily Summaries",
        url: "/dashboard/attendance/daily-summaries",
      },
      {
        title: "Mobile Punch Review",
        url: "/dashboard/attendance/mobile-punches",
      },
      {
        title: "Processing Exceptions",
        url: "/dashboard/attendance/processing-exceptions",
      },
      {
        title: "Recalculation Jobs",
        url: "/dashboard/attendance/recalculation-jobs",
      },
      {
        title: "Exemptions",
        url: "/dashboard/attendance/exemptions",
      },
      { title: "Unmatched Logs", url: "/dashboard/attendance/unmatched-logs" },
      {
        title: "Device Sync Logs",
        url: "/dashboard/attendance/device-sync-logs",
      },
    ],
  },
  {
    title: "Attendance Setup",
    items: [
      { title: "Policies", url: "/dashboard/attendance/policies" },
      { title: "Holiday Groups", url: "/dashboard/attendance/holiday-groups" },
      { title: "Holidays", url: "/dashboard/attendance/holidays" },
      { title: "Geofences", url: "/dashboard/attendance/geofences" },
      { title: "Wi-Fi Networks", url: "/dashboard/attendance/wifi-networks" },
      { title: "Checkpoints", url: "/dashboard/attendance/checkpoints" },
    ],
  },
  {
    title: "Shift Management",
    items: [
      {
        title: "Shift Schedules",
        url: "/dashboard/attendance/shift-schedules",
      },
      {
        title: "Generated Schedules",
        url: "/dashboard/attendance/timetable-generated-schedules",
      },
      { title: "Shifts", url: "/dashboard/attendance/shifts" },
      { title: "Shift Breaks", url: "/dashboard/attendance/shift-breaks" },
      {
        title: "Shift Assignments",
        url: "/dashboard/attendance/shift-assignments",
      },
      {
        title: "Rotation Groups",
        url: "/dashboard/attendance/shift-rotation-groups",
      },
      {
        title: "Rotation Rules",
        url: "/dashboard/attendance/shift-rotation-rules",
      },
    ],
  },
  {
    title: "Timetable Management",
    items: [
      { title: "Timetables", url: "/dashboard/attendance/timetables" },
      { title: "Timetable Days", url: "/dashboard/attendance/timetable-days" },
      {
        title: "Timetable Shift Options",
        url: "/dashboard/attendance/timetable-shift-rules",
      },
      {
        title: "Timetable Holiday Rules",
        url: "/dashboard/attendance/timetable-holiday-rules",
      },
      {
        title: "Timetable Rotations and Rules",
        url: "/dashboard/attendance/timetable-rotations",
      },
      {
        title: "Employee Timetables",
        url: "/dashboard/attendance/employee-timetables",
      },
    ],
  },
];

export const employeeAttendanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My attendance",
    items: [
      {
        title: "Attendance History",
        url: "/dashboard/attendance/attendance-history",
      },
      { title: "My Schedule", url: "/dashboard/attendance/schedule-preview" },
      {
        title: "Correction Requests",
        url: "/dashboard/attendance/corrections",
      },
      {
        title: "Work-from-home Requests",
        url: "/dashboard/attendance/work-from-home-requests",
      },
    ],
  },
];

export const attendanceWorkspaceSectionTabGroups: DashboardSectionTabGroup[] = [
  ...employeeAttendanceSectionTabGroups,
  ...attendanceSectionTabGroups,
];

/**
 * HR staff can intentionally use the employee shell while retaining access to
 * operational attendance pages. Route permissions, rather than the shell
 * label alone, decide whether Attendance opens the HR or personal workspace.
 */
export function resolveAttendanceSectionTabGroups(
  permissionLabels: string[],
  accessMode: DashboardAccessMode,
  isAdmin: boolean,
): DashboardSectionTabGroup[] {
  const canAccessAttendanceOperations = Boolean(
    findFirstAccessibleSectionUrl(
      attendanceSectionTabGroups,
      permissionLabels,
      accessMode,
    ),
  );

  return isAdmin || canAccessAttendanceOperations
    ? attendanceWorkspaceSectionTabGroups
    : employeeAttendanceSectionTabGroups;
}

export const selfRequestSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My requests",
    items: [
      { title: "History", url: "/dashboard/me/requests/timeline" },
      { title: "Documents", url: "/dashboard/me/requests/documents" },
      {
        title: "Update details",
        url: "/dashboard/me/requests/profile-changes",
      },
      { title: "Resignation", url: "/dashboard/me/requests/resignation" },
    ],
  },
];

export const selfLeaveSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My leave",
    items: [
      { title: "Requests", url: "/dashboard/me/leave/requests" },
      { title: "Balances", url: "/dashboard/me/leave/balances" },
      { title: "Holidays", url: "/dashboard/me/leave/holidays" },
      { title: "Policies", url: "/dashboard/me/leave/policies" },
    ],
  },
];

export const personalKpiSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My KPI & Performance",
    items: [
      { title: "My Performance", url: "/dashboard/me/kpi/overview" },
      { title: "My KPIs", url: "/dashboard/me/kpi" },
      { title: "My Scorecards", url: "/dashboard/me/scorecards" },
      { title: "My Reviews", url: "/dashboard/me/evaluations" },
      { title: "My KPI Report", url: "/dashboard/me/kpi/reports" },
    ],
  },
];

export const managementKpiSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Set up",
    items: [
      { title: "KPI Library", url: "/dashboard/kpi" },
      { title: "Reporting Periods", url: "/dashboard/kpi/periods" },
      { title: "Templates", url: "/dashboard/kpi/templates" },
    ],
  },
  {
    title: "Assign & review",
    items: [
      { title: "Assignments", url: "/dashboard/kpi/assignments" },
      { title: "Scorecards", url: "/dashboard/kpi/scorecards" },
      { title: "Achievement Reviews", url: "/dashboard/kpi/reviews" },
    ],
  },
  {
    title: "Evaluate",
    items: [
      { title: "Performance Reviews", url: "/dashboard/kpi/evaluations" },
      { title: "Review Periods", url: "/dashboard/kpi/evaluation-cycles" },
      { title: "Review Criteria", url: "/dashboard/kpi/evaluation-templates" },
    ],
  },
  {
    title: "Insights",
    items: [
      { title: "Analytics", url: "/dashboard/kpi/analytics" },
      { title: "Reports", url: "/dashboard/kpi/reports" },
    ],
  },
  {
    title: "Settings",
    items: [
      { title: "Scoring Policies", url: "/dashboard/kpi/scoring-policies" },
      { title: "Scorecard Templates", url: "/dashboard/kpi/scorecard-templates" },
    ],
  },
];

export const positionsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [{ title: "Positions", url: "/dashboard/positions" }],
  },
];


const probationOperationsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Probation management",
    items: [
      { title: "Overview", url: "/dashboard/probation/overview" },
      { title: "Policies", url: "/dashboard/probation/policies" },
      { title: "Letter templates", url: "/dashboard/probation/letter-templates" },
      { title: "Cases", url: "/dashboard/probation/cases" },
      { title: "My team", url: "/dashboard/probation/team" },
    ],
  },
];

export const probationSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My probation",
    items: [{ title: "Overview", url: "/dashboard/me/probation" }],
  },
  ...probationOperationsSectionTabGroups,
];

const fieldOperationsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Field management",
    items: [
      { title: "Overview", url: "/dashboard/field/overview" },
      { title: "Visits", url: "/dashboard/field/visits" },
      { title: "Map", url: "/dashboard/field/map" },
      { title: "Parties", url: "/dashboard/field/parties" },
      { title: "Setup", url: "/dashboard/field/setup" },
    ],
  },
];

export const selfFieldSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My field work",
    items: [
      { title: "My visits", url: "/dashboard/me/field/visits" },
      { title: "Plans", url: "/dashboard/me/field/plans" },
      { title: "Follow-ups", url: "/dashboard/me/field/follow-ups" },
    ],
  },
];

export const fieldSectionTabGroups: DashboardSectionTabGroup[] = [
  ...selfFieldSectionTabGroups,
  ...fieldOperationsSectionTabGroups,
];

const financeOperationsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Finance management",
    items: [
      { title: "Overview", url: "/dashboard/finance/overview" },
      { title: "Products", url: "/dashboard/finance/products" },
      { title: "Applications", url: "/dashboard/finance/applications" },
      { title: "Accounts", url: "/dashboard/finance/accounts" },
      { title: "Servicing", url: "/dashboard/finance/servicing" },
      { title: "Reports", url: "/dashboard/finance/reports" },
      { title: "Settings", url: "/dashboard/finance/settings" },
      {
        title: "Bank, ERP & migration",
        url: "/dashboard/finance/integrations",
      },
    ],
  },
];

export const selfFinanceSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My finance",
    items: [
      { title: "Payroll", url: "/dashboard/me/finance/payroll" },
      {
        title: "Loans & advances",
        url: "/dashboard/me/finance/applications",
      },
    ],
  },
];

export const financeSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Payroll",
    items: [
      {
        title: "Bank directory",
        url: "/dashboard/settings/banks",
      },
      {
        title: "Payroll setup & operations",
        url: "/dashboard/operations/payroll",
      },
      {
        title: "Payroll deductions",
        url: "/dashboard/finance/payroll",
      },
    ],
  },
  {
    title: "My finance",
    items: [
      { title: "Payroll", url: "/dashboard/me/finance/payroll" },
      {
        title: "Loans & advances",
        url: "/dashboard/me/finance/applications",
      },
    ],
  },
  ...financeOperationsSectionTabGroups,
];

export const selfActivitySectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [{ title: "My activities", url: "/dashboard/me/activities/today" }],
  },
];

export const activitySectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "My activities", url: "/dashboard/me/activities/today" },
      { title: "Team work", url: "/dashboard/activities/team" },
      { title: "Overview", url: "/dashboard/activities/overview" },
      { title: "Reports", url: "/dashboard/activities/reports" },
      { title: "Reviews", url: "/dashboard/activities/reviews" },
      { title: "Exceptions", url: "/dashboard/activities/exceptions" },
      { title: "Setup", url: "/dashboard/activities/setup" },
    ],
  },
];


const movementOperationsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Movement operations",
    items: [
      { title: "Overview", url: "/dashboard/movements/overview" },
      { title: "Cases", url: "/dashboard/movements/cases" },
      { title: "Operations", url: "/dashboard/movements/operations" },
    ],
  },
];

export const movementSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My movements",
    items: [{ title: "Overview", url: "/dashboard/me/movements" }],
  },
  ...movementOperationsSectionTabGroups,
];

export const smsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Overview", url: "/dashboard/sms/overview" },
      { title: "Registry", url: "/dashboard/sms/registry" },
      { title: "Logs", url: "/dashboard/sms/logs" },
      { title: "Platform", url: "/dashboard/sms/platform" },
    ],
  },
];

export const notificationSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      {
        title: "Current notifications",
        url: "/dashboard/operations/notifications",
      },
      { title: "Mail / SMTP configuration", url: "/dashboard/smtp" },
      { title: "SMS configuration", url: "/dashboard/sms" },
    ],
  },
];

export const operationsReportSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Reports",
    items: [
      { title: "Reports & Analytics", url: "/dashboard/operations/reports" },
      {
        title: "Scheduled Reporting",
        url: "/dashboard/operations/scheduled-reporting",
      },
    ],
  },
];

export const selfTeamSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "My team",
    items: [
      { title: "Overview", url: "/dashboard/me/team/overview" },
      { title: "Members", url: "/dashboard/me/team/members" },
      { title: "Attendance", url: "/dashboard/me/team/attendance" },
      { title: "Activity summary", url: "/dashboard/me/team/activity-summary" },
      { title: "Actions", url: "/dashboard/me/team/actions" },
      { title: "Movements", url: "/dashboard/team/movements" },
    ],
  },
];

export const structureSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "Cost centers", url: "/dashboard/structure/cost-centers" },
      { title: "Grades", url: "/dashboard/structure/grades" },
      { title: "Numbering", url: "/dashboard/structure/numbering" },
    ],
  },
];

export const insightsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    items: [
      { title: "HR", url: "/dashboard/insights/hr" },
      { title: "Management", url: "/dashboard/insights/management" },
      { title: "Manager", url: "/dashboard/insights/manager" },
      { title: "Sales field", url: "/dashboard/insights/sales-field" },
      { title: "Ready?", url: "/dashboard/insights/readiness" },
      { title: "Identity audit", url: "/dashboard/insights/identity-audit" },
    ],
  },
];

const leaveOperationsSectionTabGroups: DashboardSectionTabGroup[] = [
  {
    title: "Leave management",
    items: [
      { title: "Leave Types", url: "/dashboard/leave-management/types" },
      { title: "Leave Requests", url: "/dashboard/leave-management/requests" },
      {
        title: "Team Calendar",
        url: "/dashboard/leave-management/team-calendar",
      },
      { title: "Leave Balances", url: "/dashboard/leave-management/balances" },
      {
        title: "Balance Import",
        url: "/dashboard/leave-management/balance-import",
      },
      {
        title: "Balance Transactions",
        url: "/dashboard/leave-management/transactions",
      },
      { title: "Leave Reports", url: "/dashboard/leave-management/reports" },
      {
        title: "Business Trips",
        url: "/dashboard/leave-management/business-trips",
      },
      { title: "Holidays", url: "/dashboard/leave-management/holidays" },
      { title: "Policies", url: "/dashboard/leave-management/policies" },
      { title: "Workflows", url: "/dashboard/leave-management/workflows" },
      { title: "Year-end Rollover", url: "/dashboard/leave-management/rollover" },
      { title: "Statutory Rules", url: "/dashboard/leave-management/statutory" },
      {
        title: "Leave Payroll",
        url: "/dashboard/leave-management/payroll-integration",
      },
      { title: "Leave Operations", url: "/dashboard/leave-management/operations" },
    ],
  },
];

export const leaveManagementSectionTabGroups: DashboardSectionTabGroup[] = [
  ...selfLeaveSectionTabGroups,
  ...leaveOperationsSectionTabGroups,
];

const ACCESS_CONTROL_DEVICE_TABS: DashboardSectionTab[] = [
  { title: "Devices", url: "/dashboard/access-control/devices" },
  { title: "Doors", url: "/dashboard/access-control/doors" },
  { title: "Templates", url: "/dashboard/access-control/templates" },
  { title: "Week Plans", url: "/dashboard/access-control/week-plans" },
  { title: "Organization", url: "/dashboard/access-control/organizations" },
  { title: "Groups", url: "/dashboard/access-control/groups" },
  { title: "Credentials", url: "/dashboard/access-control/access-credentials" },
  { title: "Audit Logs", url: "/dashboard/access-control/audit-logs" },
  {
    title: "Command Logs",
    url: "/dashboard/access-control/device-command-logs",
  },
  { title: "Sync Logs", url: "/dashboard/access-control/hikvision-sync-logs" },
];

const ACCESS_GOVERNANCE_TABS: DashboardSectionTab[] = [
  { title: "Roles", url: "/dashboard/roles" },
  { title: "Permissions", url: "/dashboard/permissions" },
];

export const accessControlDeviceSectionTabGroups: DashboardSectionTabGroup[] = [
  { items: ACCESS_CONTROL_DEVICE_TABS },
];

export const accessGovernanceSectionTabGroups: DashboardSectionTabGroup[] = [
  { items: ACCESS_GOVERNANCE_TABS },
];

export const accessControlSectionTabGroups: DashboardSectionTabGroup[] = [
  { items: [...ACCESS_CONTROL_DEVICE_TABS, ...ACCESS_GOVERNANCE_TABS, { title: "Users", url: "/dashboard/users" }] },
];

export function allDashboardSectionTabGroups(): DashboardSectionTabGroup[] {
  return [
    employeeSectionTabGroups,
    attendanceSectionTabGroups,
    employeeAttendanceSectionTabGroups,
    selfRequestSectionTabGroups,
    selfLeaveSectionTabGroups,
    positionsSectionTabGroups,
    probationSectionTabGroups,
    fieldSectionTabGroups,
    selfFieldSectionTabGroups,
    financeSectionTabGroups,
    selfFinanceSectionTabGroups,
    activitySectionTabGroups,
    selfActivitySectionTabGroups,
    movementSectionTabGroups,
    smsSectionTabGroups,
    operationsReportSectionTabGroups,
    selfTeamSectionTabGroups,
    structureSectionTabGroups,
    leaveManagementSectionTabGroups,
    accessControlSectionTabGroups,
    insightsSectionTabGroups,
  ].flat();
}

export function findFirstAccessibleSectionUrl(
  groups: DashboardSectionTabGroup[],
  permissionLabels: string[],
  accessMode?: "admin" | "employee",
) {
  for (const group of groups) {
    const item = group.items.find((entry) =>
      canAccessDashboardRoute(entry.url, permissionLabels, accessMode),
    );
    if (item) {
      return item.url;
    }
  }

  return null;
}
