"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { HeaderGlobalSearch, type HeaderSearchItem } from "@/components/header-global-search"
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Alert24Regular,
  Alert24Color,
  ArrowMove24Regular,
  ArrowSquare24Color,
  ArrowTrendingLines24Regular,
  ArrowTrendingLines24Color,
  Briefcase24Regular,
  Briefcase24Color,
  Building24Regular,
  Building24Color,
  BuildingMultiple24Regular,
  BuildingMultiple24Color,
  CalendarClock24Regular,
  CalendarClock24Color,
  Clock24Regular,
  Clock24Color,
  CoinMultiple24Regular,
  CoinMultiple24Color,
  DataBarVerticalAscending24Regular,
  DataBarVerticalAscending24Color,
  DataTrending24Regular,
  DataTrending24Color,
  LocationRipple24Regular,
  LocationRipple24Color,
  PeopleCommunity24Regular,
  PeopleCommunity24Color,
  PeopleTeam24Regular,
  PeopleTeam24Color,
  ShieldCheckmark24Regular,
  ShieldCheckmark24Color,
  Trophy24Regular,
  Trophy24Color,
  type FluentIcon,
} from "@fluentui/react-icons"
import type { AdminResourceKey } from "@/lib/admin-api"
import type { AuthScope } from "@/types"
import {
  normalizePermissionLabels,
} from "@/lib/dashboard-permissions"
import {
  canShowKpiNavigationRoute,
  isSelfServiceDashboardRoute,
  mergeUniqueNavItems,
} from "@/lib/dashboard-nav"
import { notificationAttentionIdsForRoute } from "@/lib/notification-attention"
import { useNotifications } from "@/lib/notifications-store"
import {
  accessControlSectionTabGroups,
  attendanceWorkspaceSectionTabGroups,
  employeeSectionTabGroups,
  fieldSectionTabGroups,
  insightsSectionTabGroups,
  leaveManagementSectionTabGroups,
  movementSectionTabGroups,
  notificationSectionTabGroups,
  operationsReportSectionTabGroups,
  probationSectionTabGroups,
  structureSectionTabGroups,
  type DashboardSectionTabGroup,
} from "@/lib/dashboard-sections"
import type { HomeDashboardKind } from "@/lib/dashboard-home"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import {
  useForbiddenPrefixes,
  useProbePlatformCompaniesAccess,
} from "@/hooks/use-forbidden-route-guard"
import { useNotificationAttentionRoutes } from "@/hooks/use-notification-attention"

export type AppSidebarAccessMode = "admin" | "employee"

export type SearchItem = { title: string; url: string; section: string; keywords: string[] }
type SidebarNavItem = {
  title: string
  url?: string
  matchUrls?: string[]
  items?: SidebarNavItem[]
  icon?: FluentIcon
  activeIcon?: FluentIcon
}
type SidebarData = {
  navMain: SidebarNavItem[]
}

function sidebarWorkspacesFromSections(
  groups: DashboardSectionTabGroup[],
): SidebarNavItem[] {
  return groups.flatMap((group) => {
    const firstItem = group.items[0]
    if (!group.title || !firstItem) return []

    return [{
      title: group.title,
      url: firstItem.url,
      matchUrls: group.items.map((item) => item.url),
    }]
  })
}

function sidebarLinksFromSections(
  groups: DashboardSectionTabGroup[],
): SidebarNavItem[] {
  return groups.flatMap((group) => group.items)
}

const notificationMatchUrls = [
  ...notificationSectionTabGroups.flatMap((group) => group.items.map((item) => item.url)),
  "/dashboard/sms/overview",
  "/dashboard/sms/registry",
  "/dashboard/sms/logs",
  "/dashboard/sms/platform",
]

const AccessControlIcon = ShieldCheckmark24Regular
const ActiveAccessControlIcon = ShieldCheckmark24Color
const AttendanceIcon = Clock24Regular
const ActiveAttendanceIcon = Clock24Color
const BranchesIcon = Building24Regular
const ActiveBranchesIcon = Building24Color
const CompaniesIcon = BuildingMultiple24Regular
const ActiveCompaniesIcon = BuildingMultiple24Color
const DepartmentsIcon = PeopleCommunity24Regular
const ActiveDepartmentsIcon = PeopleCommunity24Color
const EmployeesIcon = PeopleTeam24Regular
const ActiveEmployeesIcon = PeopleTeam24Color
const PromotionIcon = ArrowTrendingLines24Regular
const ActivePromotionIcon = ArrowTrendingLines24Color
const LeaveIcon = CalendarClock24Regular
const ActiveLeaveIcon = CalendarClock24Color
const ProbationIcon = Trophy24Regular
const ActiveProbationIcon = Trophy24Color
const FieldIcon = LocationRipple24Regular
const ActiveFieldIcon = LocationRipple24Color
const FinanceIcon = CoinMultiple24Regular
const ActiveFinanceIcon = CoinMultiple24Color
const MovementsIcon = ArrowMove24Regular
const ActiveMovementsIcon = ArrowSquare24Color
const PositionsIcon = Briefcase24Regular
const ActivePositionsIcon = Briefcase24Color
const ReportsIcon = DataTrending24Regular
const ActiveReportsIcon = DataTrending24Color
const NotificationsIcon = Alert24Regular
const ActiveNotificationsIcon = Alert24Color
const InsightsIcon = DataBarVerticalAscending24Regular
const ActiveInsightsIcon = DataBarVerticalAscending24Color

const adminData: SidebarData = {
  navMain: [
    {
      title: "KPI & Performance",
      url: "/dashboard/me/kpi/overview",
      matchUrls: [
        "/dashboard/me/kpi/overview",
        "/dashboard/me/kpi",
        "/dashboard/me/scorecards",
        "/dashboard/me/evaluations",
        "/dashboard/kpi",
      ],
      icon: ReportsIcon,
      activeIcon: ActiveReportsIcon,
      items: [
        {
          title: "My KPI & Performance",
          url: "/dashboard/me/kpi/overview",
          matchUrls: [
            "/dashboard/me/kpi",
            "/dashboard/me/scorecards",
            "/dashboard/me/evaluations",
          ],
        },
        { title: "KPI Management", url: "/dashboard/kpi" },
      ],
    },
    { title: "Forms & Feedback", url: "/dashboard/forms-feedback", icon: ReportsIcon, activeIcon: ActiveReportsIcon },
    {
      title: "To do",
      url: "/dashboard/me/requests/actions",
      matchUrls: [
        "/dashboard/me/requests/actions",
        "/dashboard/attendance/correction-requests",
        "/dashboard/employees/profile-update-approvals",
      ],
      icon: NotificationsIcon,
      activeIcon: ActiveNotificationsIcon,
      items: [
        { title: "Employee Requests", url: "/dashboard/me/requests/actions" },
        { title: "Correction Requests", url: "/dashboard/attendance/correction-requests" },
        { title: "Profile Update Approvals", url: "/dashboard/employees/profile-update-approvals" },
      ],
    },
    {
      title: "Access Control",
      url: "/dashboard/access-control",
      matchUrls: [
        "/dashboard/access-control",
        "/dashboard/access-control/roles",
        "/dashboard/access-control/permissions",
        "/dashboard/access-control/devices",
        "/dashboard/access-control/doors",
        "/dashboard/access-control/templates",
        "/dashboard/access-control/week-plans",
        "/dashboard/access-control/organizations",
        "/dashboard/access-control/groups",
        "/dashboard/access-control/access-credentials",
        "/dashboard/access-control/audit-logs",
        "/dashboard/access-control/device-command-logs",
        "/dashboard/access-control/hikvision-sync-logs",
        "/dashboard/roles",
        "/dashboard/permissions",
      ],
      icon: AccessControlIcon,
      activeIcon: ActiveAccessControlIcon,
      items: sidebarWorkspacesFromSections(accessControlSectionTabGroups),
    },
    {
      title: "Attendance",
      url: "/dashboard/attendance",
      matchUrls: [
        "/dashboard/attendance/today",
        "/dashboard/attendance/punch-action",
        "/dashboard/attendance/attendance-history",
        "/dashboard/attendance/schedule-preview",
        "/dashboard/attendance/corrections",
      ],
      icon: AttendanceIcon,
      activeIcon: ActiveAttendanceIcon,
      items: sidebarWorkspacesFromSections(attendanceWorkspaceSectionTabGroups),
    },
    {
      title: "Branches",
      url: "/dashboard/branches",
      icon: BranchesIcon,
      activeIcon: ActiveBranchesIcon,
    },
    {
      title: "Companies",
      url: "/dashboard/companies",
      icon: CompaniesIcon,
      activeIcon: ActiveCompaniesIcon,
    },
    {
      title: "Departments",
      url: "/dashboard/departments",
      icon: DepartmentsIcon,
      activeIcon: ActiveDepartmentsIcon,
    },
    {
      title: "Employees",
      url: "/dashboard/employees",
      matchUrls: [
        "/dashboard/employees",
        "/dashboard/employees/all",
        "/dashboard/employees/inactive",
        "/dashboard/employees/registration",
        "/dashboard/employees/invite",
        "/dashboard/employees/contracts",
        "/dashboard/employees/offboarding",
        "/dashboard/employees/onboarding",
        "/dashboard/employees/profile-update-approvals",
        "/dashboard/employees/profile-change-requests",
        "/dashboard/me/profile",
        "/dashboard/me/organization",
        "/dashboard/me/requests",
        "/dashboard/me/requests/actions",
        "/dashboard/me/requests/timeline",
        "/dashboard/me/requests/documents",
        "/dashboard/me/requests/profile-changes",
        "/dashboard/me/requests/resignation",
        "/dashboard/me/onboarding",
        "/dashboard/me/offboarding",
        "/dashboard/me/contracts",
        "/dashboard/me/team",
        "/dashboard/me/team/overview",
        "/dashboard/me/team/members",
        "/dashboard/me/team/attendance",
        "/dashboard/me/team/actions",
        "/dashboard/team/movements",
        "/dashboard/operations/recruitment",
      ],
      icon: EmployeesIcon,
      activeIcon: ActiveEmployeesIcon,
      items: sidebarWorkspacesFromSections(employeeSectionTabGroups),
    },
    {
      title: "Promotion",
      url: "/dashboard/me/promotion",
      icon: PromotionIcon,
      activeIcon: ActivePromotionIcon,
    },
    {
      title: "Leave Management",
      url: "/dashboard/leave-management",
      matchUrls: [
        "/dashboard/leave-management",
        "/dashboard/leave-management/types",
        "/dashboard/leave-management/requests",
        "/dashboard/leave-management/balances",
        "/dashboard/leave-management/balance-import",
        "/dashboard/leave-management/transactions",
        "/dashboard/leave-management/business-trips",
        "/dashboard/leave-management/holidays",
        "/dashboard/leave-management/policies",
        "/dashboard/leave-management/workflows",
        "/dashboard/me/leave",
        "/dashboard/me/leave/requests",
        "/dashboard/me/leave/balances",
        "/dashboard/me/leave/holidays",
        "/dashboard/me/leave/policies",
      ],
      icon: LeaveIcon,
      activeIcon: ActiveLeaveIcon,
      items: sidebarWorkspacesFromSections(leaveManagementSectionTabGroups),
    },
    {
      title: "Probation",
      url: "/dashboard/probation",
      matchUrls: [
        "/dashboard/probation",
        "/dashboard/probation/overview",
        "/dashboard/probation/policies",
        "/dashboard/probation/cases",
        "/dashboard/probation/team",
        "/dashboard/me/probation",
      ],
      icon: ProbationIcon,
      activeIcon: ActiveProbationIcon,
      items: sidebarWorkspacesFromSections(probationSectionTabGroups),
    },
    {
      title: "Field",
      url: "/dashboard/field",
      matchUrls: [
        "/dashboard/field",
        "/dashboard/field/overview",
        "/dashboard/field/visits",
        "/dashboard/field/map",
        "/dashboard/field/parties",
        "/dashboard/field/setup",
        "/dashboard/me/field",
        "/dashboard/me/field/visits",
        "/dashboard/me/field/plans",
        "/dashboard/me/field/follow-ups",
      ],
      icon: FieldIcon,
      activeIcon: ActiveFieldIcon,
      items: sidebarWorkspacesFromSections(fieldSectionTabGroups),
    },
    {
      title: "Finance",
      url: "/dashboard/finance",
      matchUrls: [
        "/dashboard/finance",
        "/dashboard/finance/overview",
        "/dashboard/finance/products",
        "/dashboard/finance/applications",
        "/dashboard/finance/accounts",
        "/dashboard/finance/servicing",
        "/dashboard/finance/payroll",
        "/dashboard/finance/reports",
        "/dashboard/finance/settings",
        "/dashboard/finance/integrations",
        "/dashboard/operations/payroll",
        "/dashboard/me/finance",
        "/dashboard/me/finance/applications",
        "/dashboard/me/finance/payroll",
        "/dashboard/me/payroll",
      ],
      icon: FinanceIcon,
      activeIcon: ActiveFinanceIcon,
      items: [
        {
          title: "Payroll",
          url: "/dashboard/operations/payroll",
          matchUrls: [
            "/dashboard/operations/payroll",
            "/dashboard/finance/payroll",
          ],
          items: [
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
          url: "/dashboard/me/finance/payroll",
          matchUrls: [
            "/dashboard/me/finance/payroll",
            "/dashboard/me/finance/applications",
          ],
        },
        {
          title: "Finance management",
          url: "/dashboard/finance/overview",
          matchUrls: [
            "/dashboard/finance/overview",
            "/dashboard/finance/products",
            "/dashboard/finance/applications",
            "/dashboard/finance/accounts",
            "/dashboard/finance/servicing",
            "/dashboard/finance/reports",
            "/dashboard/finance/settings",
            "/dashboard/finance/integrations",
          ],
        },
      ],
    },
    {
      title: "Movements",
      url: "/dashboard/movements",
      matchUrls: [
        "/dashboard/movements",
        "/dashboard/movements/overview",
        "/dashboard/movements/cases",
        "/dashboard/movements/operations",
        "/dashboard/me/movements",
      ],
      icon: MovementsIcon,
      activeIcon: ActiveMovementsIcon,
      items: sidebarWorkspacesFromSections(movementSectionTabGroups),
    },
    {
      title: "Positions",
      url: "/dashboard/positions",
      icon: PositionsIcon,
      activeIcon: ActivePositionsIcon,
    },
    {
      title: "Structure",
      url: "/dashboard/structure",
      matchUrls: [
        "/dashboard/structure",
        "/dashboard/structure/cost-centers",
        "/dashboard/structure/grades",
        "/dashboard/structure/numbering",
      ],
      icon: DepartmentsIcon,
      activeIcon: ActiveDepartmentsIcon,
      items: sidebarWorkspacesFromSections(structureSectionTabGroups),
    },
    {
      title: "Reports & Analytics",
      url: "/dashboard/operations/reports",
      matchUrls: [
        "/dashboard/operations/reports",
        "/dashboard/operations/scheduled-reporting",
      ],
      icon: ReportsIcon,
      activeIcon: ActiveReportsIcon,
      items: sidebarWorkspacesFromSections(operationsReportSectionTabGroups),
    },
    {
      title: "Notifications",
      url: "/dashboard/operations/notifications",
      matchUrls: notificationMatchUrls,
      icon: NotificationsIcon,
      activeIcon: ActiveNotificationsIcon,
      items: sidebarLinksFromSections(notificationSectionTabGroups),
    },
    {
      title: "Insights",
      url: "/dashboard/insights",
      matchUrls: [
        "/dashboard/insights",
        "/dashboard/insights/hr",
        "/dashboard/insights/management",
        "/dashboard/insights/manager",
        "/dashboard/insights/sales-field",
        "/dashboard/insights/readiness",
        "/dashboard/insights/identity-audit",
      ],
      icon: InsightsIcon,
      activeIcon: ActiveInsightsIcon,
      items: sidebarWorkspacesFromSections(insightsSectionTabGroups),
    },
  ],
}

const platformData: SidebarData = {
  navMain: [
    {
      title: "Companies",
      url: "/dashboard/companies",
      icon: CompaniesIcon,
      activeIcon: ActiveCompaniesIcon,
    },
    {
      title: "Access Governance",
      url: "/dashboard/roles",
      matchUrls: ["/dashboard/roles", "/dashboard/permissions"],
      icon: AccessControlIcon,
      activeIcon: ActiveAccessControlIcon,
      items: [
        { title: "Roles", url: "/dashboard/roles" },
        { title: "Permissions", url: "/dashboard/permissions" },
      ],
    },
    {
      title: "Notifications",
      url: "/dashboard/operations/notifications",
      matchUrls: notificationMatchUrls,
      icon: NotificationsIcon,
      activeIcon: ActiveNotificationsIcon,
      items: sidebarLinksFromSections(notificationSectionTabGroups),
    },
  ],
}

const platformSearchIndex: SearchItem[] = [
  { title: "Dashboard", url: "/dashboard", section: "Platform", keywords: ["platform", "overview"] },
  { title: "Companies", url: "/dashboard/companies", section: "Platform", keywords: ["tenants", "organizations"] },
  { title: "Roles", url: "/dashboard/roles", section: "Governance", keywords: ["access", "roles"] },
  { title: "Permissions", url: "/dashboard/permissions", section: "Governance", keywords: ["access", "permissions"] },
  { title: "Current notifications", url: "/dashboard/operations/notifications", section: "Notifications", keywords: ["inbox", "alerts", "read", "seen", "archive"] },
  { title: "Mail / SMTP configuration", url: "/dashboard/smtp", section: "Notifications", keywords: ["smtp", "email", "mail"] },
  { title: "SMS configuration", url: "/dashboard/sms", section: "Notifications", keywords: ["sms", "registry", "logs"] },
]

const adminSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Employees / All Employees", url: "/dashboard/employees/all", section: "Employees", keywords: ["employee", "directory", "staff"] },
  { title: "Employees / Inactive Employees", url: "/dashboard/employees/inactive", section: "Employees", keywords: ["employee", "inactive", "archived", "removed"] },
  { title: "Employees / Profile Updates", url: "/dashboard/employees/profile-update-approvals", section: "Employees", keywords: ["employee", "profile", "changes", "approval"] },
  { title: "Employees / Profile Changes", url: "/dashboard/employees/profile-change-requests", section: "Employees", keywords: ["employee", "profile", "change request"] },
  { title: "Employees / Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Employees / Onboarding", url: "/dashboard/employees/onboarding", section: "Employees", keywords: ["employee", "workflow", "request", "approve"] },
  { title: "Attendance / Biometric Access", url: "/dashboard/attendance/biometric-access", section: "Technical Access", keywords: ["employee", "device", "credential", "card", "fingerprint", "pin", "biometric"] },
  { title: "Attendance / Attendance Setup / Policies", url: "/dashboard/attendance/policies", section: "Attendance Setup", keywords: ["attendance", "policies"] },
  { title: "Attendance / Attendance Setup / Holiday Groups", url: "/dashboard/attendance/holiday-groups", section: "Attendance Setup", keywords: ["attendance", "holiday groups", "calendar"] },
  { title: "Attendance / Attendance Setup / Holidays", url: "/dashboard/attendance/holidays", section: "Attendance Setup", keywords: ["attendance", "holidays"] },
  { title: "Access Control / Devices", url: "/dashboard/access-control/devices", section: "Access Control", keywords: ["attendance", "devices", "terminal"] },
  { title: "Attendance / Attendance Setup / Geofences", url: "/dashboard/attendance/geofences", section: "Attendance Setup", keywords: ["attendance", "geofence", "gps", "location"] },
  { title: "Attendance / Attendance Setup / Wi-Fi Networks", url: "/dashboard/attendance/wifi-networks", section: "Attendance Setup", keywords: ["attendance", "wifi", "network", "ssid"] },
  { title: "Attendance / Attendance Setup / Checkpoints", url: "/dashboard/attendance/checkpoints", section: "Attendance Setup", keywords: ["attendance", "checkpoints"] },
  { title: "Attendance / Shift Management / Shifts", url: "/dashboard/attendance/shifts", section: "Shift Management", keywords: ["attendance", "shift", "schedule"] },
  { title: "Attendance / Shift Management / Shift Breaks", url: "/dashboard/attendance/shift-breaks", section: "Shift Management", keywords: ["attendance", "shift", "break"] },
  { title: "Attendance / Shift Management / Shift Assignments", url: "/dashboard/attendance/shift-assignments", section: "Shift Management", keywords: ["attendance", "shift", "assignments"] },
  { title: "Attendance / Shift Management / Shift Schedules", url: "/dashboard/attendance/shift-schedules", section: "Shift Management", keywords: ["attendance", "shift", "schedules"] },
  { title: "Attendance / Timetable Management / Generated Schedules", url: "/dashboard/attendance/timetable-generated-schedules", section: "Timetable Management", keywords: ["attendance", "employee", "published", "schedules"] },
  { title: "Attendance / Shift Management / Rotation Groups", url: "/dashboard/attendance/shift-rotation-groups", section: "Shift Management", keywords: ["attendance", "shift", "rotation", "groups"] },
  { title: "Attendance / Shift Management / Rotation Rules", url: "/dashboard/attendance/shift-rotation-rules", section: "Shift Management", keywords: ["attendance", "shift", "rotation", "rules"] },
  { title: "Attendance / Correction Requests", url: "/dashboard/attendance/correction-requests", section: "Correction Requests", keywords: ["attendance", "correction", "request", "approve", "hr"] },
  { title: "Attendance / Timetable Management / Timetables", url: "/dashboard/attendance/timetables", section: "Timetable Management", keywords: ["attendance", "timetable"] },
  { title: "Attendance / Timetable Management / Timetable Days", url: "/dashboard/attendance/timetable-days", section: "Timetable Management", keywords: ["attendance", "timetable", "days"] },
  { title: "Attendance / Timetable Management / Timetable Shift Options", url: "/dashboard/attendance/timetable-shift-rules", section: "Timetable Management", keywords: ["attendance", "timetable", "shift", "options"] },
  { title: "Attendance / Timetable Management / Timetable Holiday Rules", url: "/dashboard/attendance/timetable-holiday-rules", section: "Timetable Management", keywords: ["attendance", "timetable", "holiday rules"] },
  { title: "Attendance / Timetable Management / Timetable Rotations and Rules", url: "/dashboard/attendance/timetable-rotations", section: "Timetable Management", keywords: ["attendance", "timetable", "rotation"] },
  { title: "Attendance / Timetable Management / Employee Timetables", url: "/dashboard/attendance/employee-timetables", section: "Timetable Management", keywords: ["attendance", "employee", "timetable"] },
  { title: "Attendance / Attendance Operations / Mobile Punch Review", url: "/dashboard/attendance/mobile-punches", section: "Attendance Operations", keywords: ["attendance", "mobile", "punches", "check in", "check out"] },
  { title: "Attendance / Attendance Operations / Daily Summaries", url: "/dashboard/attendance/daily-summaries", section: "Attendance Operations", keywords: ["attendance", "daily", "summaries", "processed"] },
  { title: "Attendance / Attendance Operations / Recalculation Jobs", url: "/dashboard/attendance/recalculation-jobs", section: "Attendance Operations", keywords: ["attendance", "recalculation", "jobs", "processing"] },
  { title: "Attendance / Attendance Operations / Exemptions", url: "/dashboard/attendance/exemptions", section: "Attendance Operations", keywords: ["attendance", "exempt", "exemption", "not tracked", "no device"] },
  { title: "Attendance / Attendance Operations / Unmatched Logs", url: "/dashboard/attendance/unmatched-logs", section: "Attendance Operations", keywords: ["attendance", "unmatched", "logs", "processing"] },
  { title: "Attendance / Attendance Operations / Device Sync Logs", url: "/dashboard/attendance/device-sync-logs", section: "Attendance Operations", keywords: ["attendance", "sync logs"] },
  { title: "Access Control / Doors", url: "/dashboard/access-control/doors", section: "Access Control", keywords: ["attendance", "doors", "access"] },
  { title: "Access Control / Templates", url: "/dashboard/access-control/templates", section: "Access Control", keywords: ["attendance", "templates", "schedule"] },
  { title: "Access Control / Week Plans", url: "/dashboard/access-control/week-plans", section: "Access Control", keywords: ["attendance", "week plan", "schedule"] },
  { title: "Access Control / Organization", url: "/dashboard/access-control/organizations", section: "Access Control", keywords: ["attendance", "organization", "access"] },
  { title: "Access Control / Groups", url: "/dashboard/access-control/groups", section: "Access Control", keywords: ["attendance", "groups", "access"] },
  { title: "Access Control / Credentials", url: "/dashboard/access-control/access-credentials", section: "Access Control", keywords: ["credential", "card", "fingerprint", "pin"] },
  { title: "Access Control / Audit Logs", url: "/dashboard/access-control/audit-logs", section: "Access Control", keywords: ["audit", "logs", "device access"] },
  { title: "Access Control / Command Logs", url: "/dashboard/access-control/device-command-logs", section: "Access Control", keywords: ["command", "logs", "hikvision"] },
  { title: "Access Control / Sync Logs", url: "/dashboard/access-control/hikvision-sync-logs", section: "Access Control", keywords: ["sync", "logs", "hikvision"] },
  { title: "Leave Management / Leave Types", url: "/dashboard/leave-management/types", section: "Leave", keywords: ["leave", "types", "vacation"] },
  { title: "Leave Management / Leave Requests", url: "/dashboard/leave-management/requests", section: "Leave", keywords: ["leave", "request", "approval"] },
  { title: "Leave Management / Leave Balances", url: "/dashboard/leave-management/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "Leave Management / Balance Import", url: "/dashboard/leave-management/balance-import", section: "Leave", keywords: ["leave", "balance", "bulk", "import", "excel", "adjustment"] },
  { title: "Leave Management / Business Trips", url: "/dashboard/leave-management/business-trips", section: "Leave", keywords: ["leave", "business trip", "travel", "client visit"] },
  { title: "Leave Management / Holidays", url: "/dashboard/leave-management/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar"] },
  { title: "Leave Management / Policies", url: "/dashboard/leave-management/policies", section: "Leave", keywords: ["leave", "policy", "quota"] },
  { title: "Leave Management / Workflows", url: "/dashboard/leave-management/workflows", section: "Leave", keywords: ["leave", "workflow", "approval"] },
  { title: "Employees / Recruitment", url: "/dashboard/operations/recruitment", section: "Employees", keywords: ["recruitment", "pipeline", "candidate", "hire", "letters"] },
  { title: "Probation / Overview", url: "/dashboard/probation/overview", section: "Probation", keywords: ["probation", "confirmation"] },
  { title: "Probation / Policies", url: "/dashboard/probation/policies", section: "Probation", keywords: ["probation", "policy"] },
  { title: "Probation / Cases", url: "/dashboard/probation/cases", section: "Probation", keywords: ["probation", "case", "confirmation"] },
  { title: "Probation / Team", url: "/dashboard/probation/team", section: "Probation", keywords: ["probation", "team", "manager"] },
  { title: "Field / Overview", url: "/dashboard/field/overview", section: "Field", keywords: ["field", "visit", "map"] },
  { title: "Field / Visits", url: "/dashboard/field/visits", section: "Field", keywords: ["field", "visit"] },
  { title: "Field / Parties", url: "/dashboard/field/parties", section: "Field", keywords: ["field", "customer", "party"] },
  { title: "Finance / Overview", url: "/dashboard/finance/overview", section: "Finance", keywords: ["finance", "loan", "advance"] },
  { title: "Finance / Products", url: "/dashboard/finance/products", section: "Finance", keywords: ["loan", "advance", "product"] },
  { title: "Finance / Applications", url: "/dashboard/finance/applications", section: "Finance", keywords: ["loan", "advance", "application"] },
  { title: "Finance / Accounts", url: "/dashboard/finance/accounts", section: "Finance", keywords: ["loan", "repayment", "disbursement"] },
  { title: "Finance / Servicing", url: "/dashboard/finance/servicing", section: "Finance", keywords: ["deferment", "reschedule", "penalty", "waiver", "write-off", "exit recovery"] },
  { title: "Payroll / Payroll deductions", url: "/dashboard/finance/payroll", section: "Finance", keywords: ["loan", "payroll", "deduction", "shortfall"] },
  { title: "Finance / Bank, ERP & migration", url: "/dashboard/finance/integrations", section: "Finance", keywords: ["bank", "erp", "journal", "payment file", "statement", "migration"] },
  { title: "Finance / Settings", url: "/dashboard/finance/settings", section: "Finance", keywords: ["sanction letter", "template", "delegation"] },
  { title: "Movements / Overview", url: "/dashboard/movements/overview", section: "Movements", keywords: ["movement", "transfer", "promotion"] },
  { title: "Movements / Cases", url: "/dashboard/movements/cases", section: "Movements", keywords: ["movement", "approve", "apply"] },
  { title: "Movements / Operations", url: "/dashboard/movements/operations", section: "Movements", keywords: ["movement", "retry", "operation"] },
  { title: "Notifications / SMS overview", url: "/dashboard/sms/overview", section: "Notifications", keywords: ["sms", "text", "message"] },
  { title: "Notifications / SMS registry", url: "/dashboard/sms/registry", section: "Notifications", keywords: ["sms", "template", "registry"] },
  { title: "Notifications / SMS logs", url: "/dashboard/sms/logs", section: "Notifications", keywords: ["sms", "log", "retry"] },
  { title: "Notifications / Mail / SMTP configuration", url: "/dashboard/smtp", section: "Notifications", keywords: ["smtp", "email", "mail", "invitation", "reports"] },
  { title: "Structure / Cost centers", url: "/dashboard/structure/cost-centers", section: "Structure", keywords: ["cost center", "grade"] },
  { title: "Structure / Grades", url: "/dashboard/structure/grades", section: "Structure", keywords: ["grade", "level"] },
  { title: "Insights / HR", url: "/dashboard/insights/hr", section: "Insights", keywords: ["dashboard", "hr", "analytics"] },
  { title: "Insights / Readiness", url: "/dashboard/insights/readiness", section: "Insights", keywords: ["launch", "health", "security"] },
  { title: "Insights / Identity audit", url: "/dashboard/insights/identity-audit", section: "Insights", keywords: ["audit", "history", "rollback", "name", "email", "phone"] },
  { title: "Companies", url: "/dashboard/companies", section: "Organization", keywords: ["company", "organization", "tenant"] },
  { title: "Departments", url: "/dashboard/departments", section: "Organization", keywords: ["department", "org"] },
  { title: "Branches", url: "/dashboard/branches", section: "Organization", keywords: ["branch", "location"] },
  { title: "Positions", url: "/dashboard/positions", section: "Organization", keywords: ["position", "job title"] },
  { title: "Structure / Numbering", url: "/dashboard/structure/numbering", section: "Structure", keywords: ["employee number", "prefix"] },
  { title: "Insights / Sales field", url: "/dashboard/insights/sales-field", section: "Insights", keywords: ["sales", "field", "analytics"] },
  { title: "Help", url: "/dashboard/help", section: "General", keywords: ["help", "support", "sso", "shortcuts"] },
  { title: "Payroll / Setup & operations", url: "/dashboard/operations/payroll", section: "Finance", keywords: ["payroll", "setup", "runs", "payslips", "salary", "banking"] },
  { title: "Reports & Analytics", url: "/dashboard/operations/reports", section: "Operations", keywords: ["reports", "analytics", "attendance", "download", "xlsx", "csv", "pdf", "scheduled", "smtp", "templates"] },
  { title: "Scheduled Reporting", url: "/dashboard/operations/scheduled-reporting", section: "Operations", keywords: ["scheduled reporting", "templates", "schedules", "executions", "smtp"] },
  { title: "Current notifications", url: "/dashboard/operations/notifications", section: "Notifications", keywords: ["notifications", "inbox", "alerts", "read", "seen", "archive"] },
  { title: "Access Control / Roles", url: "/dashboard/access-control/roles", section: "Access Control", keywords: ["role", "access", "authorization"] },
  { title: "Access Control / Permissions", url: "/dashboard/access-control/permissions", section: "Access Control", keywords: ["permission", "policy", "authorization"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
  {
    title: "Settings / Default Avatars",
    url: "/dashboard/settings/default-avatars",
    section: "General",
    keywords: ["avatar", "profile picture", "default photo", "gallery"],
  },
]

const employeeSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "My Info", url: "/dashboard/me/profile", section: "Employees", keywords: ["profile", "my info", "account"] },
  { title: "Promotion", url: "/dashboard/me/promotion", section: "Promotion", keywords: ["promotion", "career", "movement", "progression"] },
  { title: "My Attendance / Overview", url: "/dashboard/attendance/today", section: "Employees", keywords: ["attendance", "timesheet"] },
  { title: "My Attendance / Today", url: "/dashboard/attendance/today", section: "Employee Attendance", keywords: ["attendance", "today", "state"] },
  { title: "My Attendance / Attendance History", url: "/dashboard/attendance/attendance-history", section: "Employee Attendance", keywords: ["attendance", "history", "punch"] },
  { title: "My Attendance / My Schedule", url: "/dashboard/attendance/schedule-preview", section: "Employee Attendance", keywords: ["attendance", "schedule", "schedule preview"] },
  { title: "My Attendance / Correction Requests", url: "/dashboard/attendance/corrections", section: "Employee Attendance", keywords: ["attendance", "correction", "request"] },
  { title: "My Leave / Requests", url: "/dashboard/me/leave/requests", section: "Leave", keywords: ["leave", "request"] },
  { title: "My Leave / Balances", url: "/dashboard/me/leave/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "My Leave / Holidays", url: "/dashboard/me/leave/holidays", section: "Leave", keywords: ["leave", "holiday"] },
  { title: "My Leave / Policies", url: "/dashboard/me/leave/policies", section: "Leave", keywords: ["leave", "policy"] },
  { title: "My Payroll", url: "/dashboard/me/finance/payroll", section: "Finance", keywords: ["payroll", "payslips", "salary", "earnings", "deductions"] },
  { title: "My Probation", url: "/dashboard/me/probation", section: "Probation", keywords: ["probation", "confirmation", "self assessment"] },
  { title: "My Field", url: "/dashboard/me/field/visits", section: "Field", keywords: ["field", "visit", "check in", "plan"] },
  { title: "My Finance", url: "/dashboard/me/finance/payroll", section: "Finance", keywords: ["loan", "advance", "application", "finance", "payroll"] },
  { title: "My Movements", url: "/dashboard/me/movements", section: "Movements", keywords: ["movement", "transfer", "acknowledge"] },
  { title: "My Team", url: "/dashboard/me/team/overview", section: "Team", keywords: ["team", "manager", "direct reports", "action items"] },
  { title: "My Team / Movements", url: "/dashboard/team/movements", section: "Team", keywords: ["team", "movement", "transfer", "promotion", "manager"] },
  { title: "Approvals / Attendance Corrections", url: "/dashboard/attendance/correction-requests", section: "Team", keywords: ["attendance", "correction", "approve", "team", "manager"] },
  { title: "Approvals / Profile Updates", url: "/dashboard/employees/profile-update-approvals", section: "Team", keywords: ["profile", "update", "approve", "team", "manager"] },
  { title: "My Requests", url: "/dashboard/me/requests/actions", section: "Requests", keywords: ["request", "document", "resignation", "profile change"] },
  { title: "Structure", url: "/dashboard/structure/cost-centers", section: "Structure", keywords: ["cost center", "grade"] },
  { title: "Insights", url: "/dashboard/insights/hr", section: "Insights", keywords: ["dashboard", "hr"] },
  { title: "SMS", url: "/dashboard/sms/overview", section: "SMS", keywords: ["sms", "text"] },
  { title: "Field", url: "/dashboard/field/overview", section: "Field", keywords: ["field", "visit"] },
  { title: "Finance", url: "/dashboard/finance/overview", section: "Finance", keywords: ["finance", "loan", "advance"] },
  { title: "Movements", url: "/dashboard/movements/overview", section: "Movements", keywords: ["movement", "transfer"] },
  { title: "Onboarding", url: "/dashboard/me/onboarding", section: "Employees", keywords: ["employee", "onboarding", "acknowledge"] },
  { title: "Offboarding", url: "/dashboard/me/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "My contracts", url: "/dashboard/me/contracts", section: "Employees", keywords: ["contract", "sign", "employment"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
  { title: "Help", url: "/dashboard/help", section: "General", keywords: ["help", "support", "shortcuts", "sso"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  accessMode?: AppSidebarAccessMode
  scope?: AuthScope | null
  roleNames?: string[]
  homeDashboardKind?: HomeDashboardKind
  permissionLabels?: string[]
  /** False until the dashboard shell has read the signed-in identity. */
  identityReady?: boolean
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
  searchItems?: HeaderSearchItem[]
}

function firstAccessibleNavUrl(
  url: string | undefined,
  matchUrls: string[] | undefined,
  normalizedPermissions: string[],
  accessMode: AppSidebarAccessMode,
  roleNames: string[],
  scope: AuthScope | null,
  homeDashboardKind?: HomeDashboardKind,
) {
  const candidates = [
    ...(url ? [url] : []),
    ...(Array.isArray(matchUrls) ? matchUrls : []),
  ]
  const orderedCandidates = accessMode === "employee"
    ? [
        ...candidates.filter(isSelfServiceDashboardRoute),
        ...candidates.filter((candidate) => !isSelfServiceDashboardRoute(candidate)),
      ]
    : candidates
  return orderedCandidates.find((candidate) =>
    canShowKpiNavigationRoute(candidate, roleNames, scope, normalizedPermissions) &&
    canSeeDashboardPage(candidate, normalizedPermissions, accessMode, { homeDashboardKind, roleNames, scope }),
  )
}

function filterNavByPermissions(
  navMain: SidebarNavItem[],
  normalizedPermissions: string[],
  accessMode: AppSidebarAccessMode,
  roleNames: string[],
  scope: AuthScope | null,
  homeDashboardKind?: HomeDashboardKind,
): SidebarNavItem[] {
  return navMain
    .map((item) => {
      const roleAwareTitle =
        accessMode === "employee" && item.title === "Attendance"
          ? "My attendance"
          : accessMode === "employee" && item.title === "Employees"
            ? "My profile"
            : item.title
      const hasChildren = Array.isArray(item.items) && item.items.length > 0
      const accessibleUrl = firstAccessibleNavUrl(
        item.url,
        item.matchUrls,
        normalizedPermissions,
        accessMode,
        roleNames,
        scope,
        homeDashboardKind,
      )

      if (!hasChildren) {
        if (!accessibleUrl) return null
        return {
          ...item,
          title: roleAwareTitle,
          ...(accessibleUrl === item.url ? {} : { url: accessibleUrl }),
        }
      }

      const filteredItems: SidebarNavItem[] = filterNavByPermissions(
        item.items ?? [],
        normalizedPermissions,
        accessMode,
        roleNames,
        scope,
        homeDashboardKind,
      )
      // Never show a section with zero visible children (no empty menus).
      if (filteredItems.length === 0) {
        return null
      }
      return {
        ...item,
        title: roleAwareTitle,
        url: accessibleUrl ?? filteredItems[0]?.url ?? item.url,
        items: filteredItems,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

function filterAdminSearchByPermissions(
  searchItems: SearchItem[],
  normalizedPermissions: string[],
  accessMode: AppSidebarAccessMode,
  homeDashboardKind?: HomeDashboardKind,
) {
  return searchItems.filter((item) =>
    canSeeDashboardPage(item.url, normalizedPermissions, accessMode, { homeDashboardKind }),
  )
}

export function resolveDashboardSearchItems({
  scope,
  permissionLabels,
  accessMode,
  homeDashboardKind,
}: {
  scope?: AuthScope | null
  permissionLabels: string[]
  accessMode: AppSidebarAccessMode
  homeDashboardKind?: HomeDashboardKind
}) {
  const normalizedPermissions = normalizePermissionLabels(permissionLabels)
  if (scope === "platform") {
    return filterAdminSearchByPermissions(
      platformSearchIndex,
      normalizedPermissions,
      accessMode,
      homeDashboardKind,
    )
  }
  return filterAdminSearchByPermissions(
    mergeUniqueNavItems(employeeSearchIndex, adminSearchIndex),
    normalizedPermissions,
    accessMode,
    homeDashboardKind,
  )
}

export function AppSidebar({
  accessMode = "admin",
  scope = null,
  roleNames = [],
  homeDashboardKind,
  permissionLabels = [],
  identityReady = false,
  activeResource,
  onSelectResource,
  searchItems = [],
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const attentionUrls = useNotificationAttentionRoutes()
  const { attentionItems, markAsRead } = useNotifications()
  const acknowledgingAttentionIds = React.useRef(new Set<number>())
  const normalizedPermissions = React.useMemo(
    () => normalizePermissionLabels(permissionLabels),
    [permissionLabels]
  )
  const resolvedAccessMode = accessMode
  const forbiddenVersion = useForbiddenPrefixes()
  useProbePlatformCompaniesAccess(
    normalizedPermissions,
    resolvedAccessMode,
    identityReady,
  )
  const [navReady, setNavReady] = React.useState(false)
  React.useEffect(() => {
    setNavReady(true)
  }, [])

  // Close the mobile drawer after any navigation (link click or programmatic push).
  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [pathname, isMobile, setOpenMobile])

  // An attention dot represents an unread notification for a specific page.
  // Once that exact page is open, acknowledge only its notifications so the
  // page/tab dot disappears without clearing attention elsewhere.
  React.useEffect(() => {
    if (!pathname) return

    const ids = notificationAttentionIdsForRoute(attentionItems, pathname)
      .filter((id) => !acknowledgingAttentionIds.current.has(id))

    if (ids.length === 0) return

    ids.forEach((id) => acknowledgingAttentionIds.current.add(id))
    void Promise.allSettled(ids.map((id) => markAsRead(id))).finally(() => {
      ids.forEach((id) => acknowledgingAttentionIds.current.delete(id))
    })
  }, [attentionItems, markAsRead, pathname])

  const permissionsResolved = navReady && identityReady

  const navData = React.useMemo(() => {
    // Do not paint the full admin/employee catalog first and then hide items.
    // SSR and the first client frame both render an empty rail; after identity
    // is known we show only the routes this person may open.
    if (!permissionsResolved) {
      return {
        navMain: [] as SidebarNavItem[],
      }
    }
    void forbiddenVersion
    if (scope === "platform") {
      return {
        navMain: filterNavByPermissions(
          platformData.navMain,
          normalizedPermissions,
          resolvedAccessMode,
          roleNames,
          scope,
          homeDashboardKind,
        ),
      }
    }
    const adminItems = filterNavByPermissions(
      adminData.navMain,
      normalizedPermissions,
      resolvedAccessMode,
      roleNames,
      scope,
      homeDashboardKind,
    )
    return {
      navMain: adminItems,
    }
  }, [
    forbiddenVersion,
    homeDashboardKind,
    normalizedPermissions,
    permissionsResolved,
    resolvedAccessMode,
    roleNames,
    scope,
  ])

  return (
    <Sidebar collapsible="offcanvas" className="app-sidebar" {...props}>
      <SidebarContent className="gap-2 px-0 pb-2 pt-10">
        {permissionsResolved && <div className="mx-3 mb-1 lg:hidden"><HeaderGlobalSearch items={searchItems} placement="sidebar" shortcutBreakpoint="small" /></div>}
        {permissionsResolved ? (
          <NavMain
            items={navData.navMain}
            attentionUrls={attentionUrls}
            activeResource={activeResource}
            onSelectResource={onSelectResource}
          />
        ) : (
          <div className="flex flex-col gap-1.5 px-1" aria-hidden>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
