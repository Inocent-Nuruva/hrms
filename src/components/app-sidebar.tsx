"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { resolveBackendMediaUrl } from "@/lib/admin-api"
import { useMyProfilePhoto } from "@/lib/my-profile-photo"
import { UsersRound } from "@/components/animate-ui/icons/users-round"
import { Route } from "@/components/animate-ui/icons/route"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { ChartColumn } from "@/components/animate-ui/icons/chart-column"
import { ChartSpline } from "@/components/animate-ui/icons/chart-spline"
import { BadgeCheck } from "@/components/animate-ui/icons/badge-check"
import { MapPin } from "@/components/animate-ui/icons/map-pin"
import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { Bell } from "@/components/animate-ui/icons/bell"
import { LayoutDashboard } from "@/components/animate-ui/icons/layout-dashboard"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Search } from "@/components/animate-ui/icons/search"
import { MessageCircleQuestion } from "@/components/animate-ui/icons/message-circle-question"
import { Kanban } from "@/components/animate-ui/icons/kanban"
import type { AdminResourceKey } from "@/lib/admin-api"
import {
  normalizePermissionLabels,
} from "@/lib/dashboard-permissions"
import { canSeeDashboardPage } from "@/lib/forbidden-routes"
import {
  useForbiddenPrefixes,
  useProbePlatformCompaniesAccess,
} from "@/hooks/use-forbidden-route-guard"

const IUsers = <UsersRound size={48} animation="path-loop" />
const ILeave = <Route size={48} animation="path-loop" />
const IOffboarding = <CircleX size={48} animation="path-loop" />
const IAttendance = <ChartColumn size={48} animation="path-loop" />
const IPerformance = <ChartSpline size={48} animation="default-loop" />
const IProbation = <BadgeCheck size={48} animation="default" />
const IField = <MapPin size={48} animation="default" />
const IActivities = <ChartBar size={48} animation="default" />
const IMovements = <Route size={48} animation="default" />
const ISms = <Bell size={48} animation="default" />
const ITeam = <UsersRound size={48} animation="default" />
const IStructure = <Kanban size={48} animation="default" />
const IInsights = <LayoutDashboard size={48} animation="default" />
const IDepartments = <Kanban size={48} animation="default" />
const ISettings = <Settings size={48} animation="path-loop" />
const IHelp = <MessageCircleQuestion size={48} animation="path-loop" />
const ISearch = <Search size={48} animation="path-loop" />

type AppSidebarAccessMode = "admin" | "employee"

type SearchItem = { title: string; url: string; section: string; keywords: string[] }
type SidebarNavItem = {
  title: string
  url?: string
  matchUrls?: string[]
  items?: SidebarNavItem[]
  icon?: React.ReactNode
}
type SidebarData = {
  navMain: SidebarNavItem[]
  navSecondary: Array<{ title: string; url: string; icon: React.ReactNode }>
}

const adminData: SidebarData = {
  navMain: [
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
      icon: IUsers,
    },
    {
      title: "Attendance",
      url: "/dashboard/attendance",
      icon: IAttendance,
    },
    {
      title: "Branches",
      url: "/dashboard/branches",
      icon: IUsers,
    },
    {
      title: "Companies",
      url: "/dashboard/companies",
      icon: IUsers,
    },
    {
      title: "Departments",
      url: "/dashboard/departments",
      icon: IDepartments,
    },
    {
      title: "Employees",
      url: "/dashboard/employees",
      matchUrls: [
        "/dashboard/employees",
        "/dashboard/employees/all",
        "/dashboard/employees/registration",
        "/dashboard/employees/offboarding",
        "/dashboard/employees/onboarding",
        "/dashboard/employees/profile-update-approvals",
        "/dashboard/employees/profile-change-requests",
      ],
      icon: IUsers,
    },
    {
      title: "Leave Management",
      url: "/dashboard/leave-management",
      matchUrls: [
        "/dashboard/leave-management",
        "/dashboard/leave-management/types",
        "/dashboard/leave-management/requests",
        "/dashboard/leave-management/balances",
        "/dashboard/leave-management/business-trips",
        "/dashboard/leave-management/holidays",
        "/dashboard/leave-management/policies",
        "/dashboard/leave-management/workflows",
      ],
      icon: ILeave,
    },
    {
      title: "Performance",
      url: "/dashboard/performance",
      matchUrls: [
        "/dashboard/performance",
        "/dashboard/performance/overview",
        "/dashboard/performance/setup",
        "/dashboard/performance/plans",
        "/dashboard/performance/reviews",
        "/dashboard/performance/improvement",
      ],
      icon: IPerformance,
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
      ],
      icon: IProbation,
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
      ],
      icon: IField,
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
      ],
      icon: IUsers,
    },
    {
      title: "Activities",
      url: "/dashboard/activities",
      matchUrls: [
        "/dashboard/activities",
        "/dashboard/activities/overview",
        "/dashboard/activities/reports",
        "/dashboard/activities/reviews",
        "/dashboard/activities/exceptions",
        "/dashboard/activities/setup",
      ],
      icon: IActivities,
    },
    {
      title: "Movements",
      url: "/dashboard/movements",
      matchUrls: [
        "/dashboard/movements",
        "/dashboard/movements/overview",
        "/dashboard/movements/cases",
        "/dashboard/movements/operations",
      ],
      icon: IMovements,
    },
    {
      title: "Positions",
      url: "/dashboard/positions",
      icon: IUsers,
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
      icon: IStructure,
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
      ],
      icon: IInsights,
    },
    {
      title: "Invite & register",
      url: "/dashboard/operations/recruitment",
      icon: IUsers,
    },
    {
      title: "Payroll",
      url: "/dashboard/operations/payroll",
      icon: IUsers,
    },
    {
      title: "Reports",
      url: "/dashboard/operations/reports",
      matchUrls: [
        "/dashboard/operations/reports",
        "/dashboard/operations/scheduled-reporting",
      ],
      icon: IUsers,
    },
    {
      title: "Notifications",
      url: "/dashboard/operations/notifications",
      icon: IUsers,
    },
    {
      title: "SMS",
      url: "/dashboard/sms",
      matchUrls: [
        "/dashboard/sms",
        "/dashboard/sms/overview",
        "/dashboard/sms/registry",
        "/dashboard/sms/logs",
        "/dashboard/sms/platform",
      ],
      icon: ISms,
    },
  ],
  navSecondary: [
    {
      title: "Get Help",
      url: "/dashboard/help",
      icon: IHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: ISearch,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: ISettings,
    },
  ],
}

const adminSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Employees / All Employees", url: "/dashboard/employees/all", section: "Employees", keywords: ["employee", "directory", "staff"] },
  { title: "Employees / Profile Updates", url: "/dashboard/employees/profile-update-approvals", section: "Employees", keywords: ["employee", "profile", "changes", "approval"] },
  { title: "Employees / Profile Changes", url: "/dashboard/employees/profile-change-requests", section: "Employees", keywords: ["employee", "profile", "change request"] },
  { title: "Employees / Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Employees / Onboarding", url: "/dashboard/employees/onboarding", section: "Employees", keywords: ["employee", "workflow", "request", "approve"] },
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
  { title: "Attendance / Shift Management / Rotation Groups and Rules", url: "/dashboard/attendance/shift-rotation-groups", section: "Shift Management", keywords: ["attendance", "shift", "rotation"] },
  { title: "Attendance / Correction Requests", url: "/dashboard/attendance/correction-requests", section: "Correction Requests", keywords: ["attendance", "correction", "request", "approve", "hr"] },
  { title: "Attendance / Timetable Management / Timetables", url: "/dashboard/attendance/timetables", section: "Timetable Management", keywords: ["attendance", "timetable"] },
  { title: "Attendance / Timetable Management / Timetable Days", url: "/dashboard/attendance/timetable-days", section: "Timetable Management", keywords: ["attendance", "timetable", "days"] },
  { title: "Attendance / Timetable Management / Timetable Holiday Rules", url: "/dashboard/attendance/timetable-holiday-rules", section: "Timetable Management", keywords: ["attendance", "timetable", "holiday rules"] },
  { title: "Attendance / Timetable Management / Timetable Rotations and Rules", url: "/dashboard/attendance/timetable-rotations", section: "Timetable Management", keywords: ["attendance", "timetable", "rotation"] },
  { title: "Attendance / Timetable Management / Employee Timetables", url: "/dashboard/attendance/employee-timetables", section: "Timetable Management", keywords: ["attendance", "employee", "timetable"] },
  { title: "Attendance / Attendance Operations / Mobile Punch Review", url: "/dashboard/attendance/mobile-punches", section: "Attendance Operations", keywords: ["attendance", "mobile", "punches", "check in", "check out"] },
  { title: "Attendance / Attendance Operations / Daily Summaries", url: "/dashboard/attendance/daily-summaries", section: "Attendance Operations", keywords: ["attendance", "daily", "summaries", "processed"] },
  { title: "Attendance / Attendance Operations / Recalculation Jobs", url: "/dashboard/attendance/recalculation-jobs", section: "Attendance Operations", keywords: ["attendance", "recalculation", "jobs", "processing"] },
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
  { title: "Leave Management / Business Trips", url: "/dashboard/leave-management/business-trips", section: "Leave", keywords: ["leave", "business trip", "travel", "client visit"] },
  { title: "Leave Management / Holidays", url: "/dashboard/leave-management/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar"] },
  { title: "Leave Management / Policies", url: "/dashboard/leave-management/policies", section: "Leave", keywords: ["leave", "policy", "quota"] },
  { title: "Leave Management / Workflows", url: "/dashboard/leave-management/workflows", section: "Leave", keywords: ["leave", "workflow", "approval"] },
  { title: "Performance / Overview", url: "/dashboard/performance/overview", section: "Performance", keywords: ["performance", "kpi", "review", "score"] },
  { title: "Performance / Setup", url: "/dashboard/performance/setup", section: "Performance", keywords: ["performance", "kpi", "year", "period", "template"] },
  { title: "Performance / Plans", url: "/dashboard/performance/plans", section: "Performance", keywords: ["performance", "plan", "kpi"] },
  { title: "Performance / Reviews", url: "/dashboard/performance/reviews", section: "Performance", keywords: ["performance", "review", "appeal", "moderation"] },
  { title: "Performance / Improvement", url: "/dashboard/performance/improvement", section: "Performance", keywords: ["performance", "pip", "improvement"] },
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
  { title: "Activities / Overview", url: "/dashboard/activities/overview", section: "Activities", keywords: ["activity", "daily", "report"] },
  { title: "Activities / Reports", url: "/dashboard/activities/reports", section: "Activities", keywords: ["activity", "report"] },
  { title: "Activities / Reviews", url: "/dashboard/activities/reviews", section: "Activities", keywords: ["activity", "review", "approve"] },
  { title: "Activities / Exceptions", url: "/dashboard/activities/exceptions", section: "Activities", keywords: ["activity", "exception"] },
  { title: "Movements / Overview", url: "/dashboard/movements/overview", section: "Movements", keywords: ["movement", "transfer", "promotion"] },
  { title: "Movements / Cases", url: "/dashboard/movements/cases", section: "Movements", keywords: ["movement", "approve", "apply"] },
  { title: "Movements / Operations", url: "/dashboard/movements/operations", section: "Movements", keywords: ["movement", "retry", "operation"] },
  { title: "SMS / Overview", url: "/dashboard/sms/overview", section: "SMS", keywords: ["sms", "text", "message"] },
  { title: "SMS / Registry", url: "/dashboard/sms/registry", section: "SMS", keywords: ["sms", "template", "registry"] },
  { title: "SMS / Logs", url: "/dashboard/sms/logs", section: "SMS", keywords: ["sms", "log", "retry"] },
  { title: "Structure / Cost centers", url: "/dashboard/structure/cost-centers", section: "Structure", keywords: ["cost center", "grade"] },
  { title: "Structure / Grades", url: "/dashboard/structure/grades", section: "Structure", keywords: ["grade", "level"] },
  { title: "Insights / HR", url: "/dashboard/insights/hr", section: "Insights", keywords: ["dashboard", "hr", "analytics"] },
  { title: "Insights / Readiness", url: "/dashboard/insights/readiness", section: "Insights", keywords: ["launch", "health", "security"] },
  { title: "Companies", url: "/dashboard/companies", section: "Organization", keywords: ["company", "organization", "tenant"] },
  { title: "Departments", url: "/dashboard/departments", section: "Organization", keywords: ["department", "org"] },
  { title: "Branches", url: "/dashboard/branches", section: "Organization", keywords: ["branch", "location"] },
  { title: "Positions", url: "/dashboard/positions", section: "Organization", keywords: ["position", "job title"] },
  { title: "Invite & register", url: "/dashboard/operations/recruitment", section: "Operations", keywords: ["hiring", "talent", "recruitment", "invite"] },
  { title: "Structure / Numbering", url: "/dashboard/structure/numbering", section: "Structure", keywords: ["employee number", "prefix"] },
  { title: "Insights / Sales field", url: "/dashboard/insights/sales-field", section: "Insights", keywords: ["sales", "field", "analytics"] },
  { title: "Help", url: "/dashboard/help", section: "General", keywords: ["help", "support", "sso", "shortcuts"] },
  { title: "Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["payroll", "runs", "payslips", "salary", "banking"] },
  { title: "Reports", url: "/dashboard/operations/reports", section: "Operations", keywords: ["attendance", "download", "xlsx", "csv", "pdf", "scheduled", "smtp", "templates"] },
  { title: "Scheduled Reporting", url: "/dashboard/operations/scheduled-reporting", section: "Operations", keywords: ["scheduled reporting", "templates", "schedules", "executions", "smtp"] },
  { title: "Notifications", url: "/dashboard/operations/notifications", section: "Operations", keywords: ["notifications", "inbox", "alerts", "read", "seen", "archive"] },
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

const employeeData: SidebarData = {
  navMain: [
    {
      title: "My Attendance",
      icon: IAttendance,
      url: "/dashboard/attendance/today",
      matchUrls: [
        "/dashboard/attendance/today",
        "/dashboard/attendance/punch-action",
        "/dashboard/attendance/attendance-history",
        "/dashboard/attendance/schedule-preview",
        "/dashboard/attendance/corrections",
      ],
    },
    {
      title: "My Info",
      icon: IUsers,
      url: "/dashboard/me/profile",
      matchUrls: ["/dashboard/me/profile", "/dashboard/me/organization", "/dashboard/me/promotion"],
    },
    {
      title: "My Payroll",
      icon: IUsers,
      url: "/dashboard/me/payroll",
    },
    {
      title: "My Performance",
      icon: IPerformance,
      url: "/dashboard/me/performance/overview",
      matchUrls: [
        "/dashboard/me/performance",
        "/dashboard/me/performance/overview",
        "/dashboard/me/performance/assignments",
        "/dashboard/me/performance/reviews",
        "/dashboard/me/performance/achievements",
        "/dashboard/me/performance/improvement",
        "/dashboard/me/performance/team",
      ],
    },
    {
      title: "My Probation",
      icon: IProbation,
      url: "/dashboard/me/probation",
    },
    {
      title: "My Field",
      icon: IField,
      url: "/dashboard/me/field/visits",
      matchUrls: [
        "/dashboard/me/field",
        "/dashboard/me/field/visits",
        "/dashboard/me/field/plans",
        "/dashboard/me/field/follow-ups",
      ],
    },
    {
      title: "My Finance",
      icon: IUsers,
      url: "/dashboard/me/finance",
    },
    {
      title: "My Activities",
      icon: IActivities,
      url: "/dashboard/me/activities/today",
      matchUrls: [
        "/dashboard/me/activities",
        "/dashboard/me/activities/today",
        "/dashboard/me/activities/reports",
      ],
    },
    {
      title: "My Movements",
      icon: IMovements,
      url: "/dashboard/me/movements",
    },
    {
      title: "My Team",
      icon: ITeam,
      url: "/dashboard/me/team/overview",
      matchUrls: [
        "/dashboard/me/team",
        "/dashboard/me/team/overview",
        "/dashboard/me/team/members",
        "/dashboard/me/team/attendance",
        "/dashboard/me/team/actions",
      ],
    },
    {
      title: "My Insights",
      icon: IInsights,
      url: "/dashboard/me/insights",
    },
    {
      title: "My Requests",
      icon: ILeave,
      url: "/dashboard/me/requests/actions",
      matchUrls: [
        "/dashboard/me/requests",
        "/dashboard/me/requests/actions",
        "/dashboard/me/requests/timeline",
        "/dashboard/me/requests/documents",
        "/dashboard/me/requests/profile-changes",
        "/dashboard/me/requests/resignation",
      ],
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
      ],
      icon: IField,
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
      ],
      icon: IUsers,
    },
    {
      title: "Activities",
      url: "/dashboard/activities",
      matchUrls: [
        "/dashboard/activities",
        "/dashboard/activities/overview",
        "/dashboard/activities/reports",
        "/dashboard/activities/reviews",
        "/dashboard/activities/exceptions",
        "/dashboard/activities/setup",
      ],
      icon: IActivities,
    },
    {
      title: "Movements",
      url: "/dashboard/movements",
      matchUrls: [
        "/dashboard/movements",
        "/dashboard/movements/overview",
        "/dashboard/movements/cases",
        "/dashboard/movements/operations",
      ],
      icon: IMovements,
    },
    {
      title: "SMS",
      url: "/dashboard/sms",
      matchUrls: [
        "/dashboard/sms",
        "/dashboard/sms/overview",
        "/dashboard/sms/registry",
        "/dashboard/sms/logs",
        "/dashboard/sms/platform",
      ],
      icon: ISms,
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
      icon: IStructure,
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
      ],
      icon: IInsights,
    },
    {
      title: "My Leave",
      icon: ILeave,
      url: "/dashboard/me/leave/requests",
      matchUrls: [
        "/dashboard/me/leave/requests",
        "/dashboard/me/leave/balances",
        "/dashboard/me/leave/holidays",
        "/dashboard/me/leave/policies",
      ],
    },
    {
      title: "Onboarding",
      icon: IUsers,
      url: "/dashboard/me/onboarding",
    },
    {
      title: "Offboarding",
      icon: IOffboarding,
      // Self-service path — does not mount the HR Employees section tabs.
      url: "/dashboard/me/offboarding",
    },
  ],
  navSecondary: [
    {
      title: "Get Help",
      url: "/dashboard/help",
      icon: IHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: ISearch,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: ISettings,
    },
  ],
}

const employeeSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "My Info", url: "/dashboard/me/profile", section: "Employees", keywords: ["profile", "my info", "account"] },
  { title: "My Attendance / Overview", url: "/dashboard/attendance/today", section: "Employees", keywords: ["attendance", "timesheet"] },
  { title: "My Attendance / Today", url: "/dashboard/attendance/today", section: "Employee Attendance", keywords: ["attendance", "today", "state"] },
  { title: "My Attendance / Attendance History", url: "/dashboard/attendance/attendance-history", section: "Employee Attendance", keywords: ["attendance", "history", "punch"] },
  { title: "My Attendance / Schedule Preview", url: "/dashboard/attendance/schedule-preview", section: "Employee Attendance", keywords: ["attendance", "schedule preview"] },
  { title: "My Attendance / Correction Requests", url: "/dashboard/attendance/corrections", section: "Employee Attendance", keywords: ["attendance", "correction", "request"] },
  { title: "My Leave / Requests", url: "/dashboard/me/leave/requests", section: "Leave", keywords: ["leave", "request"] },
  { title: "My Leave / Balances", url: "/dashboard/me/leave/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "My Leave / Holidays", url: "/dashboard/me/leave/holidays", section: "Leave", keywords: ["leave", "holiday"] },
  { title: "My Leave / Policies", url: "/dashboard/me/leave/policies", section: "Leave", keywords: ["leave", "policy"] },
  { title: "My Payroll", url: "/dashboard/me/payroll", section: "Payroll", keywords: ["payroll", "payslips", "salary", "earnings", "deductions"] },
  { title: "My Performance", url: "/dashboard/me/performance/overview", section: "Performance", keywords: ["performance", "kpi", "review", "score", "self review"] },
  { title: "My Performance / Team", url: "/dashboard/me/performance/team", section: "Performance", keywords: ["performance", "team", "manager", "review"] },
  { title: "My Probation", url: "/dashboard/me/probation", section: "Probation", keywords: ["probation", "confirmation", "self assessment"] },
  { title: "My Field", url: "/dashboard/me/field/visits", section: "Field", keywords: ["field", "visit", "check in", "plan"] },
  { title: "My Finance", url: "/dashboard/me/finance", section: "Finance", keywords: ["loan", "advance", "application"] },
  { title: "My Activities", url: "/dashboard/me/activities/today", section: "Activities", keywords: ["activity", "daily", "report"] },
  { title: "My Movements", url: "/dashboard/me/movements", section: "Movements", keywords: ["movement", "transfer", "acknowledge"] },
  { title: "My Team", url: "/dashboard/me/team/overview", section: "Team", keywords: ["team", "manager", "direct reports", "action items"] },
  { title: "My Insights", url: "/dashboard/me/insights", section: "Insights", keywords: ["dashboard", "overview"] },
  { title: "My Requests", url: "/dashboard/me/requests/actions", section: "Requests", keywords: ["request", "document", "resignation", "profile change"] },
  { title: "Structure", url: "/dashboard/structure/cost-centers", section: "Structure", keywords: ["cost center", "grade"] },
  { title: "Insights", url: "/dashboard/insights/hr", section: "Insights", keywords: ["dashboard", "hr"] },
  { title: "SMS", url: "/dashboard/sms/overview", section: "SMS", keywords: ["sms", "text"] },
  { title: "Field", url: "/dashboard/field/overview", section: "Field", keywords: ["field", "visit"] },
  { title: "Finance", url: "/dashboard/finance/overview", section: "Finance", keywords: ["finance", "loan", "advance"] },
  { title: "Activities", url: "/dashboard/activities/overview", section: "Activities", keywords: ["activity", "report"] },
  { title: "Movements", url: "/dashboard/movements/overview", section: "Movements", keywords: ["movement", "transfer"] },
  { title: "Onboarding", url: "/dashboard/me/onboarding", section: "Employees", keywords: ["employee", "onboarding", "acknowledge"] },
  { title: "Offboarding", url: "/dashboard/me/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
  { title: "Help", url: "/dashboard/help", section: "General", keywords: ["help", "support", "shortcuts", "sso"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userName?: string | null
  userEmail?: string | null
  userAvatar?: string | null
  accessMode?: AppSidebarAccessMode
  permissionLabels?: string[]
  /** False until the dashboard shell has read the signed-in identity. */
  identityReady?: boolean
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}

function canAccessNavTarget(
  url: string | undefined,
  matchUrls: string[] | undefined,
  normalizedPermissions: string[],
  accessMode: AppSidebarAccessMode
) {
  const candidates = [
    ...(url ? [url] : []),
    ...(Array.isArray(matchUrls) ? matchUrls : []),
  ]
  if (candidates.length === 0) {
    return false
  }
  // Show a section if the user may open the section root or any linked sub-route.
  return candidates.some((candidate) =>
    canSeeDashboardPage(candidate, normalizedPermissions, accessMode)
  )
}

function filterNavByPermissions(
  navMain: SidebarNavItem[],
  normalizedPermissions: string[],
  accessMode: AppSidebarAccessMode
): SidebarNavItem[] {
  return navMain
    .map((item) => {
      const hasChildren = Array.isArray(item.items) && item.items.length > 0
      const directAccess = canAccessNavTarget(
        item.url,
        item.matchUrls,
        normalizedPermissions,
        accessMode
      )

      if (!hasChildren) {
        return directAccess ? item : null
      }

      const filteredItems: SidebarNavItem[] = filterNavByPermissions(
        item.items ?? [],
        normalizedPermissions,
        accessMode
      )
      // Never show a section with zero visible children (no empty menus).
      if (filteredItems.length === 0) {
        return null
      }
      return {
        ...item,
        items: filteredItems,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

function filterAdminSearchByPermissions(
  searchItems: SearchItem[],
  normalizedPermissions: string[],
  accessMode: AppSidebarAccessMode
) {
  return searchItems.filter((item) =>
    canSeeDashboardPage(item.url, normalizedPermissions, accessMode)
  )
}

export function AppSidebar({
  userName,
  userEmail,
  userAvatar,
  accessMode = "admin",
  permissionLabels = [],
  identityReady = false,
  activeResource,
  onSelectResource,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  // Keep footer avatar in sync with Change Photo / default avatar selection.
  const { url: liveProfilePhotoUrl, revision: photoRevision } = useMyProfilePhoto()
  const footerAvatar = React.useMemo(() => {
    const live = resolveBackendMediaUrl(liveProfilePhotoUrl) || liveProfilePhotoUrl?.trim() || ""
    const prop = resolveBackendMediaUrl(userAvatar) || userAvatar?.trim() || ""
    const base = live || prop || "/assets/alliance-logo.png"
    if (!base || base.startsWith("data:") || base.startsWith("blob:") || base.startsWith("/assets/")) {
      return base
    }
    if (photoRevision <= 0) return base
    const joiner = base.includes("?") ? "&" : "?"
    return `${base}${joiner}v=${photoRevision}`
  }, [liveProfilePhotoUrl, photoRevision, userAvatar])
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

  const permissionsResolved = navReady && identityReady

  const navData = React.useMemo(() => {
    const source = resolvedAccessMode === "employee" ? employeeData : adminData
    // Do not paint the full admin/employee catalog first and then hide items.
    // SSR and the first client frame both render an empty rail; after identity
    // is known we show only the routes this person may open.
    if (!permissionsResolved) {
      return {
        ...source,
        navMain: [] as SidebarNavItem[],
      }
    }
    void forbiddenVersion
    return {
      ...source,
      navMain: filterNavByPermissions(
        source.navMain,
        normalizedPermissions,
        resolvedAccessMode
      ),
    }
  }, [forbiddenVersion, normalizedPermissions, permissionsResolved, resolvedAccessMode])

  const searchIndex = React.useMemo(() => {
    const source = resolvedAccessMode === "employee" ? employeeSearchIndex : adminSearchIndex
    if (!permissionsResolved) {
      return [] as SearchItem[]
    }
    void forbiddenVersion
    return filterAdminSearchByPermissions(
      source,
      normalizedPermissions,
      resolvedAccessMode
    )
  }, [forbiddenVersion, normalizedPermissions, permissionsResolved, resolvedAccessMode])

  return (
    <Sidebar collapsible="offcanvas" className="app-sidebar" {...props}>
      {/* Decorative ambient orbs (purely visual) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-primary/[0.07] blur-2xl dark:bg-primary/15" />
        <div className="absolute -right-10 bottom-24 h-36 w-36 rounded-full bg-primary/[0.06] blur-3xl dark:bg-primary/12" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      </div>

      <SidebarContent className="relative z-[1] gap-2 px-2 pt-3">
        <div className="mb-1 px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">
            Navigation
          </p>
          <div className="mt-1.5 h-px w-10 rounded-full bg-gradient-to-r from-primary/50 to-transparent" />
        </div>
        {permissionsResolved ? (
          <NavMain
            items={navData.navMain}
            activeResource={activeResource}
            onSelectResource={onSelectResource}
          />
        ) : (
          <div className="space-y-1.5 px-1" aria-hidden>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        )}
        <NavSecondary items={navData.navSecondary} searchItems={searchIndex} className="mt-auto pt-1" />
      </SidebarContent>
      <SidebarFooter className="relative z-[1]">
        <NavUser
          key={`nav-user-${photoRevision}-${footerAvatar}`}
          user={{
            name: userName ?? "Admin",
            email: userEmail ?? "admin@hrms.local",
            avatar: footerAvatar,
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
