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
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { ChartColumn } from "@/components/animate-ui/icons/chart-column"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Search } from "@/components/animate-ui/icons/search"
import { MessageCircleQuestion } from "@/components/animate-ui/icons/message-circle-question"
import { Kanban } from "@/components/animate-ui/icons/kanban"
import type { AdminResourceKey } from "@/lib/admin-api"
import {
  canAccessDashboardRoute,
  normalizePermissionLabels,
} from "@/lib/dashboard-permissions"

const IUsers = <UsersRound size={48} animation="path-loop" />
const ILeave = <Route size={48} animation="path-loop" />
const IOffboarding = <CircleX size={48} animation="path-loop" />
const IAttendance = <ChartColumn size={48} animation="path-loop" />
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
        "/dashboard/access-control/organizations",
        "/dashboard/access-control/groups",
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
      matchUrls: [
        "/dashboard/employees",
        "/dashboard/employees/all",
        "/dashboard/employees/registration",
        "/dashboard/employees/offboarding",
        "/dashboard/employees/onboarding",
        "/dashboard/employees/profile-update-approvals",
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
      title: "Positions",
      url: "/dashboard/positions",
      icon: IUsers,
    },
    {
      title: "Recruitment",
      url: "/dashboard/operations/recruitment",
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
  { title: "Employees / Profile Updates", url: "/dashboard/employees/profile-update-approvals", section: "Employees", keywords: ["employee", "profile", "changes", "approval"] },
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
  { title: "Access Control / Organization", url: "/dashboard/access-control/organizations", section: "Access Control", keywords: ["attendance", "organization", "access"] },
  { title: "Access Control / Groups", url: "/dashboard/access-control/groups", section: "Access Control", keywords: ["attendance", "groups", "access"] },
  { title: "Leave Management / Leave Types", url: "/dashboard/leave-management/types", section: "Leave", keywords: ["leave", "types", "vacation"] },
  { title: "Leave Management / Leave Requests", url: "/dashboard/leave-management/requests", section: "Leave", keywords: ["leave", "request", "approval"] },
  { title: "Leave Management / Leave Balances", url: "/dashboard/leave-management/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "Leave Management / Business Trips", url: "/dashboard/leave-management/business-trips", section: "Leave", keywords: ["leave", "business trip", "travel", "client visit"] },
  { title: "Leave Management / Holidays", url: "/dashboard/leave-management/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar"] },
  { title: "Leave Management / Policies", url: "/dashboard/leave-management/policies", section: "Leave", keywords: ["leave", "policy", "quota"] },
  { title: "Leave Management / Workflows", url: "/dashboard/leave-management/workflows", section: "Leave", keywords: ["leave", "workflow", "approval"] },
  { title: "Departments", url: "/dashboard/departments", section: "Organization", keywords: ["department", "org"] },
  { title: "Branches", url: "/dashboard/branches", section: "Organization", keywords: ["branch", "location"] },
  { title: "Positions", url: "/dashboard/positions", section: "Organization", keywords: ["position", "job title"] },
  { title: "Recruitment", url: "/dashboard/operations/recruitment", section: "Operations", keywords: ["hiring", "talent"] },
  { title: "Reports", url: "/dashboard/operations/reports", section: "Operations", keywords: ["attendance", "download", "xlsx", "csv", "pdf", "scheduled", "smtp", "templates"] },
  { title: "Scheduled Reporting", url: "/dashboard/operations/scheduled-reporting", section: "Operations", keywords: ["scheduled reporting", "templates", "schedules", "executions", "smtp"] },
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
  { title: "My Attendance / Attendance History", url: "/dashboard/attendance/attendance-history", section: "Employee Attendance", keywords: ["attendance", "history", "punch"] },
  { title: "My Attendance / Schedule Preview", url: "/dashboard/attendance/schedule-preview", section: "Employee Attendance", keywords: ["attendance", "schedule preview"] },
  { title: "My Attendance / Correction Requests", url: "/dashboard/attendance/corrections", section: "Employee Attendance", keywords: ["attendance", "correction", "request"] },
  { title: "My Leave / Requests", url: "/dashboard/me/leave/requests", section: "Leave", keywords: ["leave", "request"] },
  { title: "My Leave / Balances", url: "/dashboard/me/leave/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "My Leave / Holidays", url: "/dashboard/me/leave/holidays", section: "Leave", keywords: ["leave", "holiday"] },
  { title: "My Leave / Policies", url: "/dashboard/me/leave/policies", section: "Leave", keywords: ["leave", "policy"] },
  { title: "Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userName?: string | null
  userEmail?: string | null
  userAvatar?: string | null
  accessMode?: AppSidebarAccessMode
  permissionLabels?: string[]
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
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
  userAvatar,
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
  const resolvedAccessMode = accessMode

  const navData = React.useMemo(() => {
    if (resolvedAccessMode === "employee") {
      return {
        ...employeeData,
        navMain: filterNavByPermissions(employeeData.navMain, normalizedPermissions),
      }
    }
    return {
      ...adminData,
      navMain: filterNavByPermissions(adminData.navMain, normalizedPermissions),
    }
  }, [normalizedPermissions, resolvedAccessMode])

  const searchIndex = React.useMemo(() => {
    if (resolvedAccessMode === "employee") {
      return filterAdminSearchByPermissions(employeeSearchIndex, normalizedPermissions)
    }
    return filterAdminSearchByPermissions(adminSearchIndex, normalizedPermissions)
  }, [normalizedPermissions, resolvedAccessMode])

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
        <NavMain
          items={navData.navMain}
          activeResource={activeResource}
          onSelectResource={onSelectResource}
        />
        <NavSecondary items={navData.navSecondary} searchItems={searchIndex} className="mt-auto pt-1" />
      </SidebarContent>
      <SidebarFooter className="relative z-[1]">
        <NavUser
          user={{
            name: userName ?? "Admin",
            email: userEmail ?? "admin@hrms.local",
            avatar: userAvatar?.trim() || "/assets/alliance-logo.png",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
