"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { CommandIcon } from "lucide-react"
import { UsersRound } from "@/components/animate-ui/icons/users-round"
import { Route } from "@/components/animate-ui/icons/route"
import { Sparkles } from "@/components/animate-ui/icons/sparkles"
import { ChartBar } from "@/components/animate-ui/icons/chart-bar"
import { Key } from "@/components/animate-ui/icons/key"
import { CircleX } from "@/components/animate-ui/icons/circle-x"
import { ChartColumn } from "@/components/animate-ui/icons/chart-column"
import { Bell } from "@/components/animate-ui/icons/bell"
import { Settings } from "@/components/animate-ui/icons/settings"
import { Search } from "@/components/animate-ui/icons/search"
import { MessageCircleQuestion } from "@/components/animate-ui/icons/message-circle-question"
import type { AdminResourceKey } from "@/lib/admin-api"

const IUsers = <UsersRound size={48} animation="path-loop" />
const ILeave = <Route size={48} animation="path-loop" />
const IPromotion = <Sparkles size={48} animation="path-loop" />
const IPayroll = <ChartBar size={48} animation="path-loop" />
const IRegistration = <Key size={48} animation="path-loop" />
const IOffboarding = <CircleX size={48} animation="path-loop" />
const IAttendance = <ChartColumn size={48} animation="path-loop" />
const IHolidays = <Bell size={48} animation="path-loop" />
const ISettings = <Settings size={48} animation="path-loop" />
const IHelp = <MessageCircleQuestion size={48} animation="path-loop" />
const ISearch = <Search size={48} animation="path-loop" />

type AppSidebarAccessMode = "admin" | "employee"

type SearchItem = { title: string; url: string; section: string; keywords: string[] }

const adminData = {
  navMain: [
    {
      title: "Employees",
      icon: IUsers,
      items: [
        {
          title: "All Employees",
          url: "/dashboard/employees/all",
        },
        {
          title: "Register",
          url: "/dashboard/employees/register",
        },
        {
          title: "Offboarding",
          url: "/dashboard/employees/offboarding",
        },
        {
          title: "Onboarding",
          url: "/dashboard/employees/onboarding",
        },
      ],
    },
    {
      title: "Attendance",
      icon: IAttendance,
      items: [
        {
          title: "Attendance Setup",
          items: [
            { title: "Settings", url: "/dashboard/attendance/settings" },
            { title: "Policies", url: "/dashboard/attendance/policies" },
            { title: "Holiday Groups", url: "/dashboard/attendance/holiday-groups" },
            { title: "Holidays", url: "/dashboard/attendance/holidays" },
            { title: "Devices", url: "/dashboard/attendance/devices" },
            { title: "Geofences", url: "/dashboard/attendance/geofences" },
            { title: "Wi-Fi Networks", url: "/dashboard/attendance/wifi-networks" },
            { title: "Checkpoints", url: "/dashboard/attendance/checkpoints" },
          ],
        },
        {
          title: "Shift Management",
          items: [
            { title: "Shifts", url: "/dashboard/attendance/shifts" },
            { title: "Shift Breaks", url: "/dashboard/attendance/shift-breaks" },
            { title: "Shift Attendance Rules", url: "/dashboard/attendance/shift-attendance-rules" },
            { title: "Shift Overtime Rules", url: "/dashboard/attendance/shift-overtime-rules" },
            { title: "Shift Assignments", url: "/dashboard/attendance/shift-assignments" },
            { title: "Shift Schedules", url: "/dashboard/attendance/shift-schedules" },
            { title: "Shift Templates", url: "/dashboard/attendance/shift-templates" },
            { title: "Rotation Groups and Rules", url: "/dashboard/attendance/shift-rotation-groups" },
            { title: "Shift Change Requests", url: "/dashboard/attendance/shift-change-requests" },
          ],
        },
        {
          title: "Timetable Management",
          items: [
            { title: "Timetables", url: "/dashboard/attendance/timetables" },
            { title: "Timetable Days", url: "/dashboard/attendance/timetable-days" },
            { title: "Timetable Shift Rules", url: "/dashboard/attendance/timetable-shift-rules" },
            { title: "Timetable Holiday Rules", url: "/dashboard/attendance/timetable-holiday-rules" },
            { title: "Timetable Attendance Rules", url: "/dashboard/attendance/timetable-attendance-rules" },
            { title: "Timetable Rotations and Rules", url: "/dashboard/attendance/timetable-rotations" },
            { title: "Employee Timetables", url: "/dashboard/attendance/employee-timetables" },
            { title: "Generated Schedules", url: "/dashboard/attendance/timetable-generated-schedules" },
          ],
        },
        {
          title: "Attendance Operations",
          items: [
            { title: "Mobile Punch Review", url: "/dashboard/attendance/mobile-punches" },
            { title: "Daily Summaries", url: "/dashboard/attendance/daily-summaries" },
            { title: "Recalculation Jobs", url: "/dashboard/attendance/recalculation-jobs" },
            { title: "Unmatched Logs", url: "/dashboard/attendance/unmatched-logs" },
            { title: "Device Sync Logs", url: "/dashboard/attendance/device-sync-logs" },
          ],
        },
      ],
    },
    {
      title: "Departments",
      url: "/dashboard/departments",
      icon: IUsers,
    },
    {
      title: "Branches",
      url: "/dashboard/branches",
      icon: IUsers,
    },
    {
      title: "Positions",
      icon: IUsers,
      items: [
        {
          title: "Positions",
          url: "/dashboard/positions",
        },
        {
          title: "Designations",
          url: "/dashboard/designations",
        },
      ],
    },
    {
      title: "Leave Management",
      icon: ILeave,
      items: [
        {
          title: "Leave Types",
          url: "/dashboard/leave-management/types",
        },
        {
          title: "Leave Requests",
          url: "/dashboard/leave-management/requests",
        },
        {
          title: "Leave Balances",
          url: "/dashboard/leave-management/balances",
        },
        {
          title: "Holidays",
          url: "/dashboard/leave-management/holidays",
        },
        {
          title: "Policies",
          url: "/dashboard/leave-management/policies",
        },
        {
          title: "Workflows",
          url: "/dashboard/leave-management/workflows",
        },
      ],
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
      title: "Payroll",
      url: "/dashboard/operations/payroll",
      icon: IPayroll,
    },
    {
      title: "Reports",
      url: "/dashboard/operations/reports",
      icon: IUsers,
    },
    {
      title: "Access Control",
      icon: IUsers,
      items: [
        {
          title: "Doors",
          url: "/dashboard/attendance/doors",
        },
        {
          title: "Templates",
          url: "/dashboard/attendance/templates",
        },
        {
          title: "Organization",
          url: "/dashboard/attendance/organizations",
        },
        {
          title: "Groups",
          url: "/dashboard/attendance/groups",
        },
        {
          title: "Roles",
          url: "/dashboard/roles",
        },
        {
          title: "Permissions",
          url: "/dashboard/permissions",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: ISettings,
    },
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
  ],
}

const adminSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Employees / All Employees", url: "/dashboard/employees/all", section: "Employees", keywords: ["employee", "directory", "staff"] },
  { title: "Employees / Register", url: "/dashboard/employees/register", section: "Employees", keywords: ["employee", "onboard"] },
  { title: "Employees / Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Employees / Onboarding", url: "/dashboard/employees/onboarding", section: "Employees", keywords: ["employee", "workflow", "request", "approve"] },
  { title: "Attendance / Attendance Setup / Settings", url: "/dashboard/attendance/settings", section: "Attendance Setup", keywords: ["attendance", "settings"] },
  { title: "Attendance / Attendance Setup / Policies", url: "/dashboard/attendance/policies", section: "Attendance Setup", keywords: ["attendance", "policies"] },
  { title: "Attendance / Attendance Setup / Holiday Groups", url: "/dashboard/attendance/holiday-groups", section: "Attendance Setup", keywords: ["attendance", "holiday groups", "calendar"] },
  { title: "Attendance / Attendance Setup / Holidays", url: "/dashboard/attendance/holidays", section: "Attendance Setup", keywords: ["attendance", "holidays"] },
  { title: "Attendance / Attendance Setup / Devices", url: "/dashboard/attendance/devices", section: "Attendance Setup", keywords: ["attendance", "devices"] },
  { title: "Attendance / Attendance Setup / Geofences", url: "/dashboard/attendance/geofences", section: "Attendance Setup", keywords: ["attendance", "geofence", "gps", "location"] },
  { title: "Attendance / Attendance Setup / Wi-Fi Networks", url: "/dashboard/attendance/wifi-networks", section: "Attendance Setup", keywords: ["attendance", "wifi", "network", "ssid"] },
  { title: "Attendance / Attendance Setup / Checkpoints", url: "/dashboard/attendance/checkpoints", section: "Attendance Setup", keywords: ["attendance", "checkpoints"] },
  { title: "Attendance / Shift Management / Shifts", url: "/dashboard/attendance/shifts", section: "Shift Management", keywords: ["attendance", "shift", "schedule"] },
  { title: "Attendance / Shift Management / Shift Breaks", url: "/dashboard/attendance/shift-breaks", section: "Shift Management", keywords: ["attendance", "shift", "break"] },
  { title: "Attendance / Shift Management / Shift Attendance Rules", url: "/dashboard/attendance/shift-attendance-rules", section: "Shift Management", keywords: ["attendance", "shift", "rules", "lateness"] },
  { title: "Attendance / Shift Management / Shift Overtime Rules", url: "/dashboard/attendance/shift-overtime-rules", section: "Shift Management", keywords: ["attendance", "shift", "overtime"] },
  { title: "Attendance / Shift Management / Shift Assignments", url: "/dashboard/attendance/shift-assignments", section: "Shift Management", keywords: ["attendance", "shift", "assignments"] },
  { title: "Attendance / Shift Management / Shift Schedules", url: "/dashboard/attendance/shift-schedules", section: "Shift Management", keywords: ["attendance", "shift", "schedules"] },
  { title: "Attendance / Shift Management / Shift Templates", url: "/dashboard/attendance/shift-templates", section: "Shift Management", keywords: ["attendance", "shift", "templates"] },
  { title: "Attendance / Shift Management / Rotation Groups and Rules", url: "/dashboard/attendance/shift-rotation-groups", section: "Shift Management", keywords: ["attendance", "shift", "rotation"] },
  { title: "Attendance / Shift Management / Shift Change Requests", url: "/dashboard/attendance/shift-change-requests", section: "Shift Management", keywords: ["attendance", "shift", "change", "requests"] },
  { title: "Attendance / Timetable Management / Timetables", url: "/dashboard/attendance/timetables", section: "Timetable Management", keywords: ["attendance", "timetable"] },
  { title: "Attendance / Timetable Management / Timetable Days", url: "/dashboard/attendance/timetable-days", section: "Timetable Management", keywords: ["attendance", "timetable", "days"] },
  { title: "Attendance / Timetable Management / Timetable Shift Rules", url: "/dashboard/attendance/timetable-shift-rules", section: "Timetable Management", keywords: ["attendance", "timetable", "shift rules"] },
  { title: "Attendance / Timetable Management / Timetable Holiday Rules", url: "/dashboard/attendance/timetable-holiday-rules", section: "Timetable Management", keywords: ["attendance", "timetable", "holiday rules"] },
  { title: "Attendance / Timetable Management / Timetable Attendance Rules", url: "/dashboard/attendance/timetable-attendance-rules", section: "Timetable Management", keywords: ["attendance", "timetable", "attendance rules"] },
  { title: "Attendance / Timetable Management / Timetable Rotations and Rules", url: "/dashboard/attendance/timetable-rotations", section: "Timetable Management", keywords: ["attendance", "timetable", "rotation"] },
  { title: "Attendance / Timetable Management / Employee Timetables", url: "/dashboard/attendance/employee-timetables", section: "Timetable Management", keywords: ["attendance", "employee", "timetable"] },
  { title: "Attendance / Timetable Management / Generated Schedules", url: "/dashboard/attendance/timetable-generated-schedules", section: "Timetable Management", keywords: ["attendance", "generated", "schedules"] },
  { title: "Attendance / Attendance Operations / Mobile Punch Review", url: "/dashboard/attendance/mobile-punches", section: "Attendance Operations", keywords: ["attendance", "mobile", "punches", "check in", "check out"] },
  { title: "Attendance / Attendance Operations / Daily Summaries", url: "/dashboard/attendance/daily-summaries", section: "Attendance Operations", keywords: ["attendance", "daily", "summaries", "processed"] },
  { title: "Attendance / Attendance Operations / Recalculation Jobs", url: "/dashboard/attendance/recalculation-jobs", section: "Attendance Operations", keywords: ["attendance", "recalculation", "jobs", "processing"] },
  { title: "Attendance / Attendance Operations / Unmatched Logs", url: "/dashboard/attendance/unmatched-logs", section: "Attendance Operations", keywords: ["attendance", "unmatched", "logs", "processing"] },
  { title: "Attendance / Attendance Operations / Device Sync Logs", url: "/dashboard/attendance/device-sync-logs", section: "Attendance Operations", keywords: ["attendance", "sync logs"] },
  { title: "Access Control / Doors", url: "/dashboard/attendance/doors", section: "Access Control", keywords: ["attendance", "doors", "access"] },
  { title: "Access Control / Templates", url: "/dashboard/attendance/templates", section: "Access Control", keywords: ["attendance", "templates", "schedule"] },
  { title: "Access Control / Organization", url: "/dashboard/attendance/organizations", section: "Access Control", keywords: ["attendance", "organization", "access"] },
  { title: "Access Control / Groups", url: "/dashboard/attendance/groups", section: "Access Control", keywords: ["attendance", "groups", "access"] },
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
  { title: "Roles", url: "/dashboard/roles", section: "Access Control", keywords: ["role", "access", "authorization"] },
  { title: "Permissions", url: "/dashboard/permissions", section: "Access Control", keywords: ["permission", "policy", "authorization"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

const employeeData = {
  navMain: [
    {
      title: "Registration",
      icon: IRegistration,
      url: "/dashboard/employees/register",
    },
    {
      title: "My Info",
      icon: IUsers,
      url: "/dashboard/me/profile",
    },
    {
      title: "My Attendance",
      icon: IAttendance,
      items: [
        { title: "Overview", url: "/dashboard/employees/attendance" },
        { title: "Today", url: "/dashboard/attendance/today" },
        { title: "Punch Action", url: "/dashboard/attendance/punch-action" },
        { title: "Punch History", url: "/dashboard/attendance/punch-history" },
        { title: "Attendance History", url: "/dashboard/attendance/attendance-history" },
        { title: "Schedule Preview", url: "/dashboard/attendance/schedule-preview" },
      ],
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
      title: "Office Holidays",
      icon: IHolidays,
      url: "/dashboard/me/leave/holidays",
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
      title: "Settings",
      url: "/dashboard/settings",
      icon: ISettings,
    },
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
  ],
}

const employeeSearchIndex = [
  { title: "Dashboard", url: "/dashboard", section: "General", keywords: ["home", "overview"] },
  { title: "Registration", url: "/dashboard/employees/register", section: "Employees", keywords: ["employee", "register", "onboard"] },
  { title: "My Info", url: "/dashboard/me/profile", section: "Employees", keywords: ["profile", "my info", "account"] },
  { title: "My Attendance / Overview", url: "/dashboard/employees/attendance", section: "Employees", keywords: ["attendance", "timesheet"] },
  { title: "My Attendance / Today", url: "/dashboard/attendance/today", section: "Employee Attendance", keywords: ["attendance", "today", "state"] },
  { title: "My Attendance / Punch Action", url: "/dashboard/attendance/punch-action", section: "Employee Attendance", keywords: ["attendance", "punch", "check in", "check out"] },
  { title: "My Attendance / Punch History", url: "/dashboard/attendance/punch-history", section: "Employee Attendance", keywords: ["attendance", "punch history"] },
  { title: "My Attendance / Attendance History", url: "/dashboard/attendance/attendance-history", section: "Employee Attendance", keywords: ["attendance", "history"] },
  { title: "My Attendance / Schedule Preview", url: "/dashboard/attendance/schedule-preview", section: "Employee Attendance", keywords: ["attendance", "schedule preview"] },
  { title: "My Leave", url: "/dashboard/me/leave/balances", section: "Leave", keywords: ["leave", "balance", "quota"] },
  { title: "My Payroll", url: "/dashboard/operations/payroll", section: "Operations", keywords: ["salary", "payments", "payroll"] },
  { title: "Office Holidays", url: "/dashboard/me/leave/holidays", section: "Leave", keywords: ["leave", "holiday", "calendar", "office"] },
  { title: "My Promotion", url: "/dashboard/operations/promotion", section: "Operations", keywords: ["career", "upgrade"] },
  { title: "Offboarding", url: "/dashboard/employees/offboarding", section: "Employees", keywords: ["employee", "exit"] },
  { title: "Settings", url: "/dashboard/settings", section: "General", keywords: ["preferences", "account"] },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userName?: string | null
  userEmail?: string | null
  companyName?: string | null
  accessMode?: AppSidebarAccessMode
  permissionLabels?: string[]
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}

const ADMIN_ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/dashboard/employees/all": ["employees:read"],
  "/dashboard/employees/register": ["employees:create"],
  "/dashboard/employees/offboarding": ["offboarding_requests:read", "offboarding_workflows:read"],
  "/dashboard/employees/onboarding": ["onboarding_requests:read", "onboarding_workflows:read"],
  "/dashboard/attendance/settings": ["attendance_settings:read"],
  "/dashboard/attendance/policies": ["attendance_policies:read"],
  "/dashboard/attendance/devices": ["attendance_devices:read"],
  "/dashboard/attendance/checkpoints": ["attendance_checkpoints:read"],
  "/dashboard/attendance/holiday-groups": ["attendance_holiday_groups:read"],
  "/dashboard/attendance/geofences": ["attendance_geofences:read"],
  "/dashboard/attendance/wifi-networks": ["attendance_wifi_networks:read"],
  "/dashboard/attendance/mobile-punches": ["attendance_mobile_punches:read"],
  "/dashboard/attendance/doors": ["access_doors:read"],
  "/dashboard/attendance/templates": ["access_schedule_templates:read"],
  "/dashboard/attendance/organizations": ["access_organizations:read"],
  "/dashboard/attendance/groups": ["access_groups:read"],
  "/dashboard/attendance/holidays": ["attendance_holidays:read"],
  "/dashboard/attendance/device-sync-logs": ["attendance_device_sync_logs:read"],
  "/dashboard/employees/attendance": [
    "attendance_devices:read",
    "attendance_settings:read",
    "attendance_policies:read",
    "attendance_checkpoints:read",
  ],
  "/dashboard/departments": ["departments:read"],
  "/dashboard/branches": ["branches:read"],
  "/dashboard/positions": ["positions:read"],
  "/dashboard/designations": ["designations:read"],
  "/dashboard/leave-management/types": ["leave_types:read"],
  "/dashboard/leave-management/requests": ["leave_requests:read"],
  "/dashboard/leave-management/balances": ["leave_balances:read"],
  "/dashboard/leave-management/holidays": ["holidays:read", "attendance_holidays:read"],
  "/dashboard/leave-management/policies": ["leave_policies:read"],
  "/dashboard/leave-management/workflows": ["leave_workflows:read"],
  "/dashboard/operations/promotion": ["view_company_data"],
  "/dashboard/operations/recruitment": ["view_company_data"],
  "/dashboard/operations/payroll": ["view_company_data"],
  "/dashboard/operations/reports": ["view_company_data"],
  "/dashboard/roles": ["roles:read"],
  "/dashboard/permissions": ["permissions:read"],
}

function normalizePermissionLabels(permissionLabels: string[]) {
  return permissionLabels
    .map((label) => label.trim().toLowerCase())
    .filter((label) => label.length > 0)
}

function canAccessAdminRoute(url: string, normalizedPermissions: string[]) {
  const requiredPermissions = ADMIN_ROUTE_PERMISSIONS[url]
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

function filterAdminNavByPermissions(navMain: typeof adminData.navMain, normalizedPermissions: string[]) {
  return navMain
    .map((item) => {
      if ("url" in item) {
        return canAccessAdminRoute(item.url ?? "", normalizedPermissions) ? item : null
      }
      const filteredItems = item.items
        .map((subItem) => {
          if ("url" in subItem) {
            return canAccessAdminRoute(subItem.url, normalizedPermissions) ? subItem : null
          }
          const nestedItems = subItem.items.filter((nestedItem) =>
            canAccessAdminRoute(nestedItem.url, normalizedPermissions)
          )
          if (nestedItems.length === 0) {
            return null
          }
          return {
            ...subItem,
            items: nestedItems,
          }
        })
        .filter((subItem): subItem is NonNullable<typeof subItem> => subItem !== null)
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

function filterAdminSearchByPermissions(searchItems: SearchItem[], normalizedPermissions: string[]) {
  return searchItems.filter((item) => canAccessAdminRoute(item.url, normalizedPermissions))
}

export function AppSidebar({
  userName,
  userEmail,
  companyName,
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
      return employeeData
    }
    return {
      ...adminData,
      navMain: filterAdminNavByPermissions(adminData.navMain, normalizedPermissions),
    }
  }, [accessMode, normalizedPermissions])

  const searchIndex = React.useMemo(() => {
    if (accessMode === "employee") {
      return employeeSearchIndex
    }
    return filterAdminSearchByPermissions(adminSearchIndex, normalizedPermissions)
  }, [accessMode, normalizedPermissions])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:cursor-default data-[slot=sidebar-menu-button]:rounded-xl data-[slot=sidebar-menu-button]:p-2.5!"
              render={<div />}
              aria-disabled="true"
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">
                {companyName ?? (accessMode === "employee" ? "HRMS Portal" : "HRMS Admin")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2">
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
