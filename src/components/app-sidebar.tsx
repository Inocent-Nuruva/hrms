"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar"
import { UsersRound } from "@/components/animate-ui/icons/users-round"
import { Route } from "@/components/animate-ui/icons/route"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { ChartColumn } from "@/components/animate-ui/icons/chart-column"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Search } from "@/components/animate-ui/icons/search"
import { MessageCircleQuestion } from "@/components/animate-ui/icons/message-circle-question"
import { Kanban } from "@/components/animate-ui/icons/kanban"
import type { AdminResourceKey } from "@/lib/admin-api"

const IUsers = <UsersRound size={48} animation="path-loop" />
const ILeave = <Route size={48} animation="path-loop" />
const IPromotion = <Sparkles size={48} animation="path-loop" />
const IPayroll = <ChartBar size={48} animation="path-loop" />
const IOffboarding = <CircleX size={48} animation="path-loop" />
const IAttendance = <ChartColumn size={48} animation="path-loop" />
const ICorrections = <CircleX size={48} animation="path-loop" />
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
        "/dashboard/access-control/roles",
        "/dashboard/access-control/permissions",
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
      title: "Departments",
      url: "/dashboard/departments",
      icon: IDepartments,
    },
    {
      title: "Employees",
      url: "/dashboard/employees",
      matchUrls: ["/dashboard/employees/all", "/dashboard/employees/offboarding", "/dashboard/employees/onboarding"],
      icon: IUsers,
    },
    {
      title: "Leave Management",
      url: "/dashboard/leave-management",
      icon: ILeave,
    },
    {
      title: "Payroll",
      url: "/dashboard/operations/payroll",
      icon: IPayroll,
    },
    {
      title: "Positions",
      url: "/dashboard/positions",
      matchUrls: ["/dashboard/designations"],
      icon: IUsers,
    },
    {
      title: "Promotion",
      url: "/dashboard/operations/promotion",
      icon: IPromotion,
    },
    {
      title: "Recruitment",
      url: "/dashboard/operations/recruitment",
      icon: IUsers,
    },
    {
      title: "Reports",
      url: "/dashboard/operations/reports",
      icon: IUsers,
    },
  ],
  navSecondary: [
    {
      title: "Get Help",
      url: "#",
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
  { title: "Employees / Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Employees / Onboarding", url: "/dashboard/employees/onboarding", section: "Employees", keywords: ["employee", "workflow", "request", "approve"] },
  { title: "Attendance / Attendance Setup / Settings", url: "/dashboard/attendance/settings", section: "Attendance Setup", keywords: ["attendance", "settings"] },
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
  { title: "Access Control / Organization", url: "/dashboard/access-control/organizations", section: "Access Control", keywords: ["attendance", "organization", "access"] },
  { title: "Access Control / Groups", url: "/dashboard/access-control/groups", section: "Access Control", keywords: ["attendance", "groups", "access"] },
  { title: "Leave Management / Leave Types", url: "/dashboard/leave-management/types", section: "Leave", keywords: ["leave", "types", "vacation"] },
  { title: "Leave Management / Leave Requests", url: "/dashboard/leave-management/requests", section: "Leave", keywords: ["leave", "request", "approval"] },
  { title: "Leave Management / Leave Balances", url: "/dashboard/leave-management/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "Leave Management / Holidays", url: "/dashboard/leave-management/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar"] },
  { title: "Leave Management / Policies", url: "/dashboard/leave-management/policies", section: "Leave", keywords: ["leave", "policy", "quota"] },
  { title: "Leave Management / Workflows", url: "/dashboard/leave-management/workflows", section: "Leave", keywords: ["leave", "workflow", "approval"] },
  { title: "Departments", url: "/dashboard/departments", section: "Organization", keywords: ["department", "org"] },
  { title: "Branches", url: "/dashboard/branches", section: "Organization", keywords: ["branch", "location"] },
  { title: "Positions", url: "/dashboard/positions", section: "Organization", keywords: ["position", "job title"] },
  { title: "Designations", url: "/dashboard/designations", section: "Organization", keywords: ["designation", "grade", "hierarchy"] },
  { title: "Promotion", url: "/dashboard/operations/promotion", section: "Operations", keywords: ["career", "upgrade"] },
  { title: "Recruitment", url: "/dashboard/operations/recruitment", section: "Operations", keywords: ["hiring", "talent"] },
  { title: "Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["salary", "payments"] },
  { title: "Reports", url: "/dashboard/operations/reports", section: "Operations", keywords: ["analytics", "insights"] },
  { title: "Access Control / Roles", url: "/dashboard/access-control/roles", section: "Access Control", keywords: ["role", "access", "authorization"] },
  { title: "Access Control / Permissions", url: "/dashboard/access-control/permissions", section: "Access Control", keywords: ["permission", "policy", "authorization"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
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
        "/dashboard/attendance/punch-history",
        "/dashboard/attendance/attendance-history",
        "/dashboard/attendance/schedule-preview",
        "/dashboard/attendance/corrections",
      ],
    },
    {
      title: "My Info",
      icon: IUsers,
      url: "/dashboard/me/profile",
    },
    {
      title: "My Leave",
      icon: ILeave,
      url: "/dashboard/me/leave/balances",
    },
    {
      title: "My Payroll",
      url: "/dashboard/operations/payroll",
      icon: IPayroll,
    },
    {
      title: "My Promotion",
      icon: IPromotion,
      url: "/dashboard/operations/promotion",
    },
    {
      title: "Offboarding",
      icon: IOffboarding,
      url: "/dashboard/employees/offboarding",
    },
  ],
  navSecondary: [
    {
      title: "Get Help",
      url: "#",
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
  { title: "My Attendance / Punch History", url: "/dashboard/attendance/punch-history", section: "Employee Attendance", keywords: ["attendance", "punch history"] },
  { title: "My Attendance / Attendance History", url: "/dashboard/attendance/attendance-history", section: "Employee Attendance", keywords: ["attendance", "history"] },
  { title: "My Attendance / Schedule Preview", url: "/dashboard/attendance/schedule-preview", section: "Employee Attendance", keywords: ["attendance", "schedule preview"] },
  { title: "My Attendance / Correction Requests", url: "/dashboard/attendance/corrections", section: "Employee Attendance", keywords: ["attendance", "correction", "request"] },
  { title: "My Leave", url: "/dashboard/me/leave/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "My Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["salary", "payments", "payroll"] },
  { title: "My Promotion", url: "/dashboard/operations/promotion", section: "Operations", keywords: ["career", "upgrade"] },
  { title: "Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userName?: string | null
  userEmail?: string | null
  accessMode?: AppSidebarAccessMode
  permissionLabels?: string[]
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}

export const DASHBOARD_ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/dashboard/me/profile": [],
  "/dashboard/me/organization": [],
  "/dashboard/me/promotion": [],
  "/dashboard/me/leave": [],
  "/dashboard/me/leave/requests": [],
  "/dashboard/me/leave/balances": [],
  "/dashboard/me/leave/holidays": [],
  "/dashboard/me/leave/policies": [],
  "/dashboard/attendance/today": [],
  "/dashboard/attendance/punch-action": [],
  "/dashboard/attendance/punch-history": [],
  "/dashboard/attendance/attendance-history": [],
  "/dashboard/attendance/schedule-preview": [],
  "/dashboard/attendance/corrections": [],
  "/dashboard/employees": ["employees:read", "employees:create", "offboarding_requests:read", "offboarding_workflows:read", "onboarding_requests:read", "onboarding_workflows:read"],
  "/dashboard/employees/all": ["employees:read"],
  "/dashboard/employees/offboarding": [],
  "/dashboard/employees/onboarding": ["onboarding_requests:read", "onboarding_workflows:read"],
  "/dashboard/attendance": [
    "attendance_settings:read",
    "attendance_policies:read",
    "attendance_devices:read",
    "attendance_checkpoints:read",
    "attendance_holiday_groups:read",
    "attendance_geofences:read",
    "attendance_wifi_networks:read",
    "attendance_mobile_punches:read",
    "attendance_holidays:read",
    "attendance_device_sync_logs:read",
    "attendance_daily_summaries:read",
    "attendance_recalculation_jobs:read",
    "attendance_unmatched_logs:read",
    "attendance_shifts:read",
    "attendance_shift_breaks:read",
    "attendance_shift_assignments:read",
    "attendance_shift_schedules:read",
    "attendance_shift_rotation_groups:read",
    "attendance_shift_rotation_rules:read",
    "attendance_timetables:read",
    "attendance_timetable_days:read",
    "attendance_timetable_holiday_rules:read",
    "attendance_timetable_rotations:read",
    "attendance_timetable_rotation_rules:read",
    "attendance_employee_timetables:read",
  ],
  "/dashboard/attendance/settings": ["attendance_settings:read"],
  "/dashboard/attendance/policies": ["attendance_policies:read"],
  "/dashboard/attendance/devices": ["attendance_devices:read"],
  "/dashboard/attendance/checkpoints": ["attendance_checkpoints:read"],
  "/dashboard/attendance/holiday-groups": ["attendance_holiday_groups:read"],
  "/dashboard/attendance/geofences": ["attendance_geofences:read"],
  "/dashboard/attendance/wifi-networks": ["attendance_wifi_networks:read"],
  "/dashboard/attendance/mobile-punches": ["attendance_mobile_punches:read"],
  "/dashboard/attendance/holidays": ["attendance_holidays:read"],
  "/dashboard/attendance/device-sync-logs": ["attendance_device_sync_logs:read"],
  "/dashboard/attendance/daily-summaries": ["attendance_daily_summaries:read"],
  "/dashboard/attendance/recalculation-jobs": ["attendance_recalculation_jobs:read"],
  "/dashboard/attendance/unmatched-logs": ["attendance_unmatched_logs:read"],
  "/dashboard/attendance/shifts": ["attendance_shifts:read"],
  "/dashboard/attendance/shift-breaks": ["attendance_shift_breaks:read"],
  "/dashboard/attendance/shift-assignments": ["attendance_shift_assignments:read"],
  "/dashboard/attendance/shift-schedules": ["attendance_shift_schedules:read"],
  "/dashboard/attendance/shift-rotation-groups": ["attendance_shift_rotation_groups:read"],
  "/dashboard/attendance/shift-rotation-rules": ["attendance_shift_rotation_rules:read"],
  "/dashboard/attendance/timetables": ["attendance_timetables:read"],
  "/dashboard/attendance/timetable-days": ["attendance_timetable_days:read"],
  "/dashboard/attendance/timetable-holiday-rules": ["attendance_timetable_holiday_rules:read"],
  "/dashboard/attendance/timetable-rotations": ["attendance_timetable_rotations:read"],
  "/dashboard/attendance/timetable-rotation-rules": ["attendance_timetable_rotation_rules:read"],
  "/dashboard/attendance/employee-timetables": ["attendance_employee_timetables:read"],
  "/dashboard/departments": ["departments:read"],
  "/dashboard/branches": ["branches:read"],
  "/dashboard/positions": ["positions:read", "designations:read"],
  "/dashboard/designations": ["designations:read"],
  "/dashboard/leave-management": ["leave_types:read", "leave_requests:read", "leave_balances:read", "holidays:read", "attendance_holidays:read", "leave_policies:read", "leave_workflows:read"],
  "/dashboard/leave-management/types": ["leave_types:read"],
  "/dashboard/leave-management/requests": ["leave_requests:read"],
  "/dashboard/leave-management/balances": ["leave_balances:read"],
  "/dashboard/leave-management/holidays": ["holidays:read", "attendance_holidays:read"],
  "/dashboard/leave-management/policies": ["leave_policies:read"],
  "/dashboard/leave-management/workflows": ["leave_workflows:read"],
  "/dashboard/operations/promotion": [],
  "/dashboard/operations/recruitment": ["view_company_data"],
  "/dashboard/operations/payroll": [],
  "/dashboard/operations/reports": ["view_company_data"],
  "/dashboard/access-control": ["attendance_devices:read", "access_doors:read", "access_schedule_templates:read", "access_organizations:read", "access_groups:read", "roles:read", "permissions:read"],
  "/dashboard/access-control/devices": ["attendance_devices:read"],
  "/dashboard/access-control/doors": ["access_doors:read"],
  "/dashboard/access-control/templates": ["access_schedule_templates:read"],
  "/dashboard/access-control/organizations": ["access_organizations:read"],
  "/dashboard/access-control/groups": ["access_groups:read"],
  "/dashboard/access-control/roles": ["roles:read"],
  "/dashboard/access-control/permissions": ["permissions:read"],
  "/dashboard/roles": ["roles:read"],
  "/dashboard/permissions": ["permissions:read"],
}

function normalizePermissionLabels(permissionLabels: string[]) {
  return permissionLabels
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0)
}

function resolveRequiredPermissions(url: string) {
  const exactMatch = DASHBOARD_ROUTE_PERMISSIONS[url]
  if (exactMatch) {
    return exactMatch
  }

  const matchedEntry = Object.entries(DASHBOARD_ROUTE_PERMISSIONS)
    .sort(([left], [right]) => right.length - left.length)
    .find(([route]) => url === route || url.startsWith(`${route}/`))

  return matchedEntry?.[1]
}

export function canAccessDashboardRoute(url: string, normalizedPermissions: string[]) {
  const requiredPermissions = resolveRequiredPermissions(url)
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true
  }
  if (normalizedPermissions.length === 0) {
    return false
  }
  if (
    normalizedPermissions.some(
      (entry) => entry === "*" || entry === "all" || entry.includes("admin") || entry.includes("super")
    )
  ) {
    return true
  }
  return requiredPermissions.some((required) => normalizedPermissions.includes(required))
}

function filterNavByPermissions(
  navMain: SidebarNavItem[],
  normalizedPermissions: string[]
): SidebarNavItem[] {
  return navMain
    .map((item) => {
      const hasChildren = Array.isArray(item.items) && item.items.length > 0
      const directAccess = item.url
        ? canAccessDashboardRoute(item.url, normalizedPermissions)
        : !hasChildren

      if (!hasChildren) {
        return directAccess ? item : null
      }

      const filteredItems: SidebarNavItem[] = filterNavByPermissions(
        item.items ?? [],
        normalizedPermissions
      )
      if (!directAccess && filteredItems.length === 0) {
        return null
      }
      return {
        ...item,
        items: filteredItems,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

function filterAdminSearchByPermissions(searchItems: SearchItem[], normalizedPermissions: string[]) {
  return searchItems.filter((item) => canAccessDashboardRoute(item.url, normalizedPermissions))
}

export function AppSidebar({
  userName,
  userEmail,
  accessMode = "admin",
  permissionLabels = [],
  activeResource,
  onSelectResource,
  ...props
}: AppSidebarProps) {
  const normalizedPermissions = React.useMemo(
    () => normalizePermissionLabels(permissionLabels),
    [permissionLabels]
  )

  const navData = React.useMemo(() => {
    if (accessMode === "employee") {
      return {
        ...employeeData,
        navMain: filterNavByPermissions(employeeData.navMain, normalizedPermissions),
      }
    }
    return {
      ...adminData,
      navMain: filterNavByPermissions(adminData.navMain, normalizedPermissions),
    }
  }, [accessMode, normalizedPermissions])

  const searchIndex = React.useMemo(() => {
    if (accessMode === "employee") {
      return filterAdminSearchByPermissions(employeeSearchIndex, normalizedPermissions)
    }
    return filterAdminSearchByPermissions(adminSearchIndex, normalizedPermissions)
  }, [accessMode, normalizedPermissions])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarContent className="px-2 pt-3">
        <NavMain
          items={navData.navMain}
          activeResource={activeResource}
          onSelectResource={onSelectResource}
        />
        <NavSecondary items={navData.navSecondary} searchItems={searchIndex} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: userName ?? "Admin",
            email: userEmail ?? "admin@hrms.local",
            avatar: "/assets/alliance-logo.png",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
